/* ============================================================
   host.js — the host's browser acts as the authoritative server.
   It owns the quiz, the clock, and every score.
   ============================================================ */

import * as UI from './ui.js';
import { $, $$ } from './ui.js';
import { startHost } from './net.js';
import { buildQuiz, scoreAnswer, rankPlayers } from './engine.js';
import { sound } from './sound.js';
import { burst, stop as stopConfetti } from './confetti.js';
import {
  avatarHTML, packPayload, pickFree, renderStrip, stripItem, setMood, poke,
} from './avatars.js';

const REVEAL_PAUSE = 4200;
const BOARD_PAUSE = 4200;

export async function hostGame(config, onExit) {
  UI.setRole('host');
  UI.setPack(config.pack);
  UI.setMotion(config.anims !== false);
  UI.show('lobby');
  $('#lobbyPin').textContent = '······';
  $('#lobbyHint').textContent = 'Opening a peer-to-peer channel…';
  $('#btnLobbyStart').disabled = true;
  $('#playerChips').innerHTML = '';
  $('#playerCount').textContent = '0';
  $('#qrBox').innerHTML = '';
  $('#answerAvatars').innerHTML = '';
  $('#revealAvatars').innerHTML = '';

  let net;
  try {
    net = await startHost({
      // The host owns the cast list: it hands every player a free character
      // and settles it when two phones reach for the same one.
      resolveChar: (p, wanted) => pickFree(
        config.pack,
        net ? net.takenChars(p.id) : [],
        config.letPick === false ? '' : wanted
      ),
      // Sent with the welcome, so a player renders the pack the teacher
      // chose even if their copy of the app has never heard of it.
      greeting: () => ({
        pack: packPayload(config.pack),
        letPick: config.letPick !== false,
        anims: config.anims !== false,
      }),
      onChar: (p) => { updateChip(p); announceTaken(); },
      onJoin: (p) => { addChip(p); announceTaken(); sound.join(); refreshLobby(); },
      onLeave: (p) => { removeChip(p); announceTaken(); sound.leave(); refreshLobby(); },
      onAnswer: (p, msg) => handleAnswer(p, msg),
      onStatus: (s) => {
        if (s === 'reconnecting') UI.toast('Reconnecting to the matchmaking service…');
        else if (s.startsWith('error:')) UI.toast('Network hiccup — players may need to rejoin.');
      },
    });
  } catch (err) {
    UI.toast(err.message, 6000);
    onExit();
    return null;
  }

  /* ── lobby ── */

  const joinUrl = location.origin + location.pathname + '#join=' + net.pin;
  $('#lobbyPin').textContent = net.pin;
  $('#joinHost').textContent = location.host + location.pathname.replace(/index\.html$/, '');
  renderQr(joinUrl);
  sound.startLobby();

  function refreshLobby() {
    const n = net.players.length;
    $('#playerCount').textContent = String(n);
    $('#btnLobbyStart').disabled = n === 0;
    $('#btnLobbyStart').textContent = n ? `Start (${n})` : 'Start';
    $('#lobbyHint').textContent = n
      ? 'Press Start when everyone has joined.'
      : `Players open ${location.host}${location.pathname.replace(/index\.html$/, '')} and enter PIN ${net.pin}`;
  }
  refreshLobby();

  function chipOf(pid) { return $(`.pchip[data-pid="${CSS.escape(pid)}"]`); }

  function paintChip(el, p) {
    el.innerHTML = avatarHTML(config.pack, p.char, { size: 'sm', label: p.name });
    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = p.name;
    el.appendChild(name);
  }

  function addChip(p) {
    const el = document.createElement('div');
    el.className = 'pchip';
    el.dataset.pid = p.id;
    paintChip(el, p);
    el.title = 'Click to remove ' + p.name;
    el.onclick = () => { if (confirm(`Remove ${p.name} from the game?`)) net.kick(p.id, 'Removed by the host'); };
    $('#playerChips').appendChild(el);
  }
  function updateChip(p) {
    const el = chipOf(p.id);
    if (el) paintChip(el, p);
  }
  function removeChip(p) {
    const el = chipOf(p.id);
    if (!el) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  }

  /** Keep every open character picker honest about what is still free. */
  function announceTaken() {
    if (!net) return;
    net.broadcast({ t: 'taken', ids: net.takenChars() });
  }

  /**
   * The class as a row of characters. During a question they wake up one
   * by one as answers land; on the reveal they cheer or slump.
   */
  function paintStrip(box, moodOf, size) {
    const rows = net.players.map((p) => {
      const mood = moodOf(p);
      return { id: p.id, name: p.name, char: p.char, mood, dim: mood === 'still' };
    });
    // A big class trades names, then size, for staying on the screen.
    renderStrip(box, config.pack, rows, {
      size: rows.length > 24 ? 'sm' : size,
      names: rows.length <= 18,
    });
  }

  function renderQr(url) {
    const box = $('#qrBox');
    try {
      if (typeof window.qrcode !== 'function') throw new Error('no qr');
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
      const svg = box.querySelector('svg');
      if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR code to join the game'); }
    } catch (_) {
      box.innerHTML = '<span style="font-size:11px;color:#888;font-weight:800;text-align:center;padding:8px">Scan code unavailable</span>';
    }
  }

  $('#btnCopyLink').onclick = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      UI.toast('Invite link copied');
    } catch (_) {
      UI.toast(joinUrl, 6000);
    }
  };

  /* ── game state ── */

  const quiz = buildQuiz(config);
  if (!quiz.length) {
    UI.toast('No questions match those settings.', 5000);
    net.destroy();
    onExit();
    return null;
  }

  let idx = -1;
  let phase = 'lobby';          // lobby | asking | revealed | board | over
  let timer = null;
  let round = null;             // { q, answers:Map, counts:[4] }
  let autoTimer = null;
  let ended = false;

  /* ── question ── */

  async function ask(i) {
    if (ended || i >= quiz.length) return;
    idx = i;
    phase = 'asking';
    const q = quiz[i];
    round = { q, answers: new Map(), counts: [0, 0, 0, 0] };

    await UI.getReady(q.topic, () => sound.countdown());
    if (ended) return;
    sound.go();

    net.broadcast({
      t: 'question',
      n: i, total: quiz.length,
      question: q.question, code: q.code, options: q.options,
      topic: q.topic, difficulty: q.difficulty, time: q.time,
      hideText: !!config.projector,
    });

    UI.renderQuestion(q, { role: 'host', index: i, total: quiz.length, interactive: false });
    UI.setAnsweredCount(0);
    paintStrip($('#answerAvatars'), () => 'still', 'md');

    timer = UI.startTimer(q.time, { onEnd: () => lock('time') });
    sound.startTicks(() => timer.remaining());
  }

  function handleAnswer(p, msg) {
    if (phase !== 'asking' || !round) return;
    if (msg.n !== idx) return;                       // stale answer from a previous question
    if (round.answers.has(p.id)) return;             // one shot only
    const choice = Number(msg.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;

    const limitMs = round.q.time * 1000;
    // Trust but clamp the client's reported reaction time, and never let it
    // beat the host's own clock.
    const hostElapsed = limitMs - Math.round(timer ? timer.remaining() * 1000 : 0);
    const elapsedMs = Math.min(limitMs, Math.max(0, Math.min(Number(msg.elapsed) || 0, hostElapsed)));

    const correct = choice === round.q.answer;
    const streak = correct ? p.streak + 1 : 0;
    const { total } = scoreAnswer({
      correct, elapsedMs, limitMs, streak, useStreak: config.streak,
    });

    p.score += total;
    p.streak = streak;
    p.bestStreak = Math.max(p.bestStreak, streak);
    if (correct) p.correct++;
    p.answers.push({ n: idx, choice, correct, points: total });

    round.answers.set(p.id, { choice, correct, points: total, elapsedMs });
    round.counts[choice]++;

    net.send(p.id, { t: 'ack', n: idx });
    UI.setAnsweredCount(round.answers.size);

    // A jump, not a verdict — showing right from wrong here would give the
    // answer away to anyone watching the projector.
    const item = stripItem($('#answerAvatars'), p.id);
    if (item) {
      item.classList.remove('is-dim');
      const av = item.querySelector('.avatar');
      setMood(av, 'idle');
      poke(av);
    }

    if (round.answers.size >= net.players.length && net.players.length > 0) {
      setTimeout(() => { if (phase === 'asking') lock('all'); }, 350);
    }
  }

  function lock(reason) {
    if (phase !== 'asking') return;
    phase = 'revealed';
    sound.stopTicks();
    if (timer) timer.stop();
    UI.lockAnswers();
    if (reason === 'time') sound.timeup();

    const q = round.q;
    const ranked = rankPlayers(net.players);
    const rankOf = new Map(ranked.map((r) => [r.id, r.rank]));
    const correctText = `${q.options[q.answer]}`;

    net.broadcastEach((p) => {
      const a = round.answers.get(p.id);
      return {
        t: 'reveal',
        n: idx,
        correct: q.answer,
        choice: a ? a.choice : null,
        gotIt: !!(a && a.correct),
        points: a ? a.points : 0,
        score: p.score,
        streak: p.streak,
        rank: rankOf.get(p.id) || ranked.length,
        of: ranked.length,
        explanation: config.explain ? q.explanation : '',
        correctText,
        options: q.options,
      };
    });

    UI.revealOnTiles(q.answer);

    setTimeout(() => {
      if (phase !== 'revealed') return;
      paintStrip($('#revealAvatars'), (p) => {
        const a = round.answers.get(p.id);
        return a && a.correct ? 'happy' : 'sad';
      }, 'md');
      UI.renderReveal({
        isHost: true,
        gotIt: true,
        counts: round.counts,
        correctIdx: q.answer,
        correctText,
        explanation: q.explanation,
        showExplain: config.explain,
      });
      if (config.autoNext) autoTimer = setTimeout(toBoard, REVEAL_PAUSE);
    }, 1400);
  }

  function toBoard() {
    if (phase !== 'revealed') return;          // idempotent: ignore repeat clicks
    clearTimeout(autoTimer);
    phase = 'board';

    const ranked = rankPlayers(net.players).map((p) => ({
      ...p,
      delta: (round && round.answers.get(p.id) ? round.answers.get(p.id).points : 0),
    }));

    const last = idx >= quiz.length - 1;

    net.broadcastEach((p) => {
      const me = ranked.find((r) => r.id === p.id);
      return {
        t: 'board',
        rows: ranked.slice(0, 8).map((r) => ({ id: r.id, name: r.name, char: r.char, score: r.score, rank: r.rank, delta: r.delta })),
        you: me ? { rank: me.rank, score: me.score, delta: me.delta, of: ranked.length } : null,
        last,
      };
    });

    UI.renderScoreboard(ranked, null,
      ranked.length ? `Leader: ${ranked[0].name}` : 'No players connected');

    $('#btnBoardNext').textContent = last ? 'Show results' : 'Next question';
    if (config.autoNext) autoTimer = setTimeout(advance, BOARD_PAUSE);
  }

  function advance() {
    if (phase !== 'board') return;             // idempotent: ignore repeat clicks
    clearTimeout(autoTimer);
    if (idx >= quiz.length - 1) finish();
    else ask(idx + 1);
  }

  function finish() {
    phase = 'over';
    ended = true;
    const ranked = rankPlayers(net.players);

    net.broadcastEach((p) => {
      const me = ranked.find((r) => r.id === p.id);
      return {
        t: 'over',
        rows: ranked.slice(0, 5).map((r) => ({ id: r.id, name: r.name, char: r.char, score: r.score, rank: r.rank })),
        you: me ? { rank: me.rank, score: me.score, correct: me.correct, total: quiz.length, best: me.bestStreak } : null,
      };
    });

    sound.fanfare();
    UI.renderPodium(ranked, null,
      ranked.length
        ? `${quiz.length} questions · ${ranked.length} player${ranked.length === 1 ? '' : 's'}`
        : 'No players connected');
    burst($('#confetti'));
    window.__snuReview = quiz.map((q) => ({
      topic: q.topic, difficulty: q.difficulty, question: q.question, code: q.code,
      options: q.options, answer: q.answer, choice: null, explanation: q.explanation,
    }));
    $('#btnReview').hidden = false;
    $('#btnReview').textContent = 'Review questions';
  }

  /* ── wiring ── */

  $('#btnLobbyStart').onclick = () => {
    if (phase !== 'lobby') return;
    if (!net.players.length) { UI.toast('Wait for at least one player'); return; }
    sound.stopLobby();
    net.setAcceptingJoins(false);
    net.broadcast({ t: 'start', total: quiz.length });
    ask(0);
  };

  $('#btnSkip').onclick = () => lock('skip');
  $('#btnNext').hidden = false;
  $('#btnNext').textContent = 'Next';
  $('#btnNext').onclick = toBoard;
  $('#btnBoardNext').onclick = advance;

  return {
    quiz,
    destroy() {
      ended = true;
      phase = 'over';
      clearTimeout(autoTimer);
      UI.cancelReady();
      UI.stopTimer();
      $('#answerAvatars').innerHTML = '';
      $('#revealAvatars').innerHTML = '';
      stopConfetti();
      sound.stopLobby();
      sound.stopTicks();
      try { net.destroy(); } catch (_) {}
    },
  };
}
