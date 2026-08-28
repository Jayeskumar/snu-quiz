/* ============================================================
   player.js — a joined player's client. Purely reactive:
   the host decides everything, this just renders and answers.
   ============================================================ */

import * as UI from './ui.js';
import { $ } from './ui.js';
import { joinGame } from './net.js';
import { sound } from './sound.js';
import { burst, stop as stopConfetti } from './confetti.js';
import {
  registerPack, renderPicker, avatarHTML, charOf,
  recallChar, rememberChar, DEFAULT_PACK,
} from './avatars.js';

export async function playerGame(pin, nick, onExit) {
  UI.setRole('player');

  const conn = await joinGame(pin, nick, {
    // Only a request: the host decides, and says so in its welcome.
    char: recallChar(''),
    onMessage: (msg) => handle(msg),
    onClose: (reason) => {
      UI.toast(reason || 'Disconnected', 5000);
      cleanup();
      onExit();
    },
    onStatus: (s) => { if (s === 'reconnecting') UI.toast('Reconnecting…'); },
  });

  /* ── which character am I? ── */

  // A host running a newer build may send a pack this copy of the app has
  // never seen, so adopt whatever definition arrives before rendering it.
  const packKey = (registerPack(conn.pack) || { key: DEFAULT_PACK }).key;
  let myChar = conn.char || '';
  let letPick = conn.letPick;
  let taken = [];
  let wanted = '';
  let note = '';

  UI.setPack(packKey);
  UI.setMotion(conn.anims);
  $('#waitNick').textContent = conn.name;
  paintMe();
  paintPicker();

  // Same character as last lesson, if it is still going spare.
  const remembered = recallChar(packKey);
  if (letPick && remembered && remembered !== myChar) askFor(remembered);

  UI.show('waiting');
  sound.join();

  function paintMe() {
    $('#waitAvatar').innerHTML = avatarHTML(packKey, myChar, { size: 'xl', mood: 'dance', delay: 0 });
  }

  /**
   * `next` undefined leaves the note alone — the host's roster updates
   * arrive right behind its reply, and they must not wipe out a "someone
   * got there first" message the player has not read yet.
   */
  function paintPicker(next) {
    if (next !== undefined) note = next;
    const card = $('#charCard');
    card.hidden = !letPick;
    if (!letPick) return;
    renderPicker($('#charGrid'), packKey, {
      selected: myChar,
      taken,
      onPick: (id) => { if (id !== myChar) { sound.select(); askFor(id); } },
    });
    $('#charNote').textContent = note ||
      `You are the ${charOf(packKey, myChar).name}. Faded ones are taken.`;
  }

  function askFor(id) {
    wanted = id;
    conn.send({ t: 'char', id });
  }

  let q = null;
  let shownAt = 0;
  let answered = false;
  let total = 0;
  const review = [];

  function cleanup() {
    UI.stopTimer();
    sound.stopTicks();
    stopConfetti();
  }

  function handle(msg) {
    switch (msg.t) {
      case 'start':
        total = msg.total;
        letPick = false;                            // the cast is set once we begin
        $('#charCard').hidden = true;
        break;

      case 'char': {
        // The host has the final say — a character someone else grabbed
        // first comes back as whatever it gave us instead.
        const asked = wanted;
        wanted = '';
        myChar = msg.id || myChar;
        rememberChar(packKey, myChar);
        paintMe();
        paintPicker(asked && msg.id !== asked
          ? `${charOf(packKey, asked).name} was taken — you are the ${charOf(packKey, myChar).name}.`
          : '');
        break;
      }

      case 'taken':
        taken = Array.isArray(msg.ids) ? msg.ids : [];
        paintPicker();
        break;

      case 'question': {
        q = msg;
        answered = false;
        total = msg.total || total;
        UI.getReady(msg.topic, () => sound.countdown()).then(() => {
          if (!q || q.n !== msg.n) return;         // a newer question already arrived
          sound.go();
          shownAt = performance.now();
          UI.renderQuestion(
            {
              topic: msg.topic, difficulty: msg.difficulty,
              question: msg.question, code: msg.code, options: msg.options,
              time: msg.time, hideText: msg.hideText,
            },
            {
              role: 'player', index: msg.n, total: msg.total, interactive: true,
              onPick: (i) => pick(i),
            }
          );
          UI.startTimer(msg.time, {
            onEnd: () => { if (!answered) { UI.lockAnswers(); sound.timeup(); } },
          });
          sound.startTicks(() => Math.max(0, msg.time - (performance.now() - shownAt) / 1000));
        });
        break;
      }

      case 'ack':
        break;

      case 'reveal': {
        UI.stopTimer();
        sound.stopTicks();
        if (msg.gotIt) sound.correct(); else sound.wrong();

        if (q && q.n === msg.n) {
          review.push({
            topic: q.topic, difficulty: q.difficulty, question: q.question, code: q.code,
            options: msg.options || q.options, answer: msg.correct, choice: msg.choice,
            explanation: msg.explanation || '',
          });
        }

        UI.revealOnTiles(msg.correct);
        setTimeout(() => {
          UI.renderReveal({
            isHost: false,
            gotIt: msg.gotIt,
            answered: msg.choice !== null && msg.choice !== undefined,
            points: msg.points,
            streak: msg.streak,
            rankText: msg.of > 1 ? `${ordinal(msg.rank)} of ${msg.of} · ${msg.score} pts` : `${msg.score} pts`,
            correctIdx: msg.correct,
            correctText: msg.correctText,
            explanation: msg.explanation,
            showExplain: !!msg.explanation,
            char: myChar,
          });
        }, 900);
        break;
      }

      case 'board':
        UI.renderScoreboard(
          msg.rows,
          conn.pid,
          msg.you ? `You: ${ordinal(msg.you.rank)} of ${msg.you.of} · ${msg.you.score} pts` : ''
        );
        break;

      case 'over': {
        cleanup();
        sound.fanfare();
        const you = msg.you;
        UI.renderPodium(
          msg.rows,
          conn.pid,
          you ? `You finished ${ordinal(you.rank)} · ${you.correct}/${you.total} correct · ${you.score} pts` : ''
        );
        burst($('#confetti'));
        $('#btnReview').hidden = review.length === 0;
        $('#btnReview').textContent = 'Review answers';
        window.__snuReview = review;
        break;
      }

      case 'kick':
        UI.toast(msg.msg || 'Removed from the game', 5000);
        cleanup();
        onExit();
        break;
    }
  }

  function pick(i) {
    if (answered || !q) return;
    answered = true;
    const elapsed = Math.round(performance.now() - shownAt);
    conn.send({ t: 'answer', n: q.n, choice: i, elapsed });
    UI.markPicked(i);
    sound.select();
    sound.stopTicks();
  }

  return {
    review,
    destroy() {
      cleanup();
      try { conn.leave(); } catch (_) {}
    },
  };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
