/* ============================================================
   ui.js — DOM helpers and shared screen rendering
   ============================================================ */

import { DIFF_LABEL } from './engine.js';

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const SHAPES = ['tri', 'dia', 'cir', 'sqr'];
export const SHAPE_NAME = ['Triangle', 'Diamond', 'Circle', 'Square'];

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ─────────── screens ─────────── */

let current = 'boot';

export function show(name) {
  $$('.screen').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === name));
  document.body.dataset.screen = name;
  document.body.className = document.body.className
    .replace(/\bscreen-[\w-]+\b/g, '').trim() + ' screen-' + name;
  current = name;
  const active = $('.screen.is-active');
  if (active) active.scrollTop = 0;
}

export function currentScreen() { return current; }

export function setRole(role) { document.body.dataset.role = role; }

/* ─────────── toast ─────────── */

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ─────────── countdown before a question ─────────── */

let readyIv = null;

/** Cancel an in-flight countdown so two rounds can never tick at once. */
export function cancelReady() {
  if (readyIv) clearInterval(readyIv);
  readyIv = null;
}

export function getReady(topic, onTick) {
  cancelReady();
  return new Promise((resolve) => {
    $('#readyTopic').textContent = topic || '';
    $('#readyText').textContent = 'Get ready';
    show('ready');
    let n = 3;
    const num = $('#readyNum');
    const mine = {};
    const step = () => {
      if (readyIv !== mine.iv) return;          // a newer countdown took over
      num.textContent = n;
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = '';
      onTick && onTick(n);
      n--;
      if (n < 0) { cancelReady(); resolve(); }
    };
    mine.iv = readyIv = setInterval(step, 900);
    step();
  });
}

/* ─────────── question ─────────── */

const CIRC = 2 * Math.PI * 45;

export function renderQuestion(q, { role, index, total, interactive, onPick }) {
  $('#qProgress').textContent = `${index + 1} of ${total}`;
  $('#qTopic').textContent = q.topic || '';
  $('#qDiff').textContent = DIFF_LABEL[q.difficulty] || '';
  $('#qText').textContent = q.question;

  const code = $('#qCode');
  if (q.code && q.code.trim()) { code.textContent = q.code; code.hidden = false; }
  else { code.textContent = ''; code.hidden = true; }

  const wrap = $('#answers');
  wrap.classList.remove('locked', 'revealed');
  $('#lockedNote').hidden = true;
  $('#answeredNum').textContent = '0';

  // Most questions carry four options, but a true/false question carries two,
  // so any tile past the end of the list is taken out of play entirely.
  $$('.ans', wrap).forEach((btn, i) => {
    const label = btn.querySelector('span');
    const used = i < q.options.length;
    btn.hidden = !used;
    label.textContent = used ? q.options[i] : '';
    btn.classList.remove('picked', 'correct');
    btn.disabled = !interactive || !used;
    btn.setAttribute('aria-label', used ? `${SHAPE_NAME[i]}: ${q.options[i]}` : '');
    btn.onclick = interactive && used ? () => onPick(i) : null;
  });

  // On a player's phone during a hosted game the big screen carries the
  // question, so the phone shows only the coloured tiles — same as Kahoot.
  document.body.classList.toggle('compact', role === 'player' && !!q.hideText);

  setTimerDisplay(q.time, q.time);
  show('question');
}

export function markPicked(i) {
  const wrap = $('#answers');
  wrap.classList.add('locked');
  $$('.ans', wrap).forEach((b, k) => {
    b.classList.toggle('picked', k === i);
    b.disabled = true;
  });
  $('#lockedNote').hidden = false;
}

export function lockAnswers() {
  const wrap = $('#answers');
  wrap.classList.add('locked');
  $$('.ans', wrap).forEach((b) => { b.disabled = true; });
}

export function revealOnTiles(correctIdx) {
  const wrap = $('#answers');
  wrap.classList.add('revealed');
  $$('.ans', wrap).forEach((b, k) => b.classList.toggle('correct', k === correctIdx));
}

export function setAnsweredCount(n) { $('#answeredNum').textContent = String(n); }

/* ─────────── timer ─────────── */

let rafId = null;

function setTimerDisplay(left, total) {
  const arc = $('#timerArc');
  const box = $('#qTimer');
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  arc.style.strokeDasharray = CIRC;
  arc.style.strokeDashoffset = String(CIRC * (1 - frac));
  $('#timerNum').textContent = String(Math.max(0, Math.ceil(left)));
  box.classList.toggle('warn', left <= total * 0.4 && left > 5);
  box.classList.toggle('danger', left <= 5);
}

/** Deadline-based so it stays accurate when the tab is throttled. */
export function startTimer(seconds, { onEnd, onSecond } = {}) {
  stopTimer();
  const total = seconds;
  const end = performance.now() + seconds * 1000;
  let lastWhole = Math.ceil(seconds);

  const frame = () => {
    const left = Math.max(0, (end - performance.now()) / 1000);
    setTimerDisplay(left, total);
    const whole = Math.ceil(left);
    if (whole !== lastWhole) { lastWhole = whole; onSecond && onSecond(whole); }
    if (left <= 0) { rafId = null; onEnd && onEnd(); return; }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  return {
    remaining: () => Math.max(0, (end - performance.now()) / 1000),
    elapsedMs: () => Math.min(seconds * 1000, Math.max(0, seconds * 1000 - (end - performance.now()))),
    stop: stopTimer,
  };
}

export function stopTimer() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

/* ─────────── reveal ─────────── */

export function renderReveal({
  correct, gotIt, answered, points, streak, rankText, counts, correctIdx,
  explanation, correctText, showExplain, isHost,
}) {
  const v = $('#verdict');
  v.classList.toggle('is-bad', !gotIt);

  if (isHost) {
    $('#verdictIcon').textContent = '✓';
    $('#verdictText').textContent = 'Correct answer';
    v.classList.remove('is-bad');
    $('#verdictPoints').textContent = correctText;
    $('#verdictPoints').style.fontSize = '17px';
    $('#verdictRank').textContent = '';
    $('#verdictStreak').hidden = true;
  } else {
    $('#verdictPoints').style.fontSize = '';
    $('#verdictIcon').textContent = gotIt ? '✓' : (answered ? '✕' : '⏱');
    $('#verdictText').textContent = gotIt ? 'Correct!' : (answered ? 'Incorrect' : "Time's up");
    $('#verdictPoints').textContent = (points > 0 ? '+' : '') + points;
    $('#verdictRank').textContent = rankText || '';
    const st = $('#verdictStreak');
    if (gotIt && streak >= 2) { st.hidden = false; st.textContent = `\u{1F525} ${streak} in a row`; }
    else st.hidden = true;
  }

  // answer distribution bars (host view)
  if (counts) {
    const max = Math.max(1, ...counts);
    counts.forEach((c, i) => {
      const bar = $('#bars .b' + i);
      bar.style.height = Math.max(6, Math.round((c / max) * 100)) + '%';
      bar.querySelector('span').textContent = String(c);
      bar.classList.toggle('is-correct', i === correctIdx);
    });
  }

  const box = $('#explainBox');
  if (showExplain && explanation) {
    box.hidden = false;
    box.classList.toggle('is-bad', !gotIt && !isHost);
    $('#explainAnswer').textContent = correctText;
    $('#explainText').textContent = explanation;
  } else if (showExplain && isHost) {
    box.hidden = false;
    box.classList.remove('is-bad');
    $('#explainAnswer').textContent = correctText;
    $('#explainText').textContent = '';
  } else {
    box.hidden = true;
  }

  show('reveal');
}

/* ─────────── scoreboard ─────────── */

export function renderScoreboard(rows, youId, note) {
  const list = $('#boardList');
  list.innerHTML = rows.slice(0, 8).map((p, i) => `
    <li class="${p.id === youId ? 'is-you' : ''}" style="animation-delay:${i * 55}ms">
      <span class="rk">${p.rank}</span>
      <span class="nm">${esc(p.name)}</span>
      ${p.delta > 0 ? `<span class="dl">+${p.delta}</span>` : ''}
      <span class="sc">${p.score}</span>
    </li>`).join('');
  $('#boardYou').textContent = note || '';
  show('scoreboard');
}

/* ─────────── podium ─────────── */

export function renderPodium(rows, youId, note) {
  const top = rows.slice(0, 3);
  const board = $('#podium');

  // A one-player game (solo practice) gets a single trophy card, not a
  // three-column podium with two empty slots.
  board.classList.toggle('solo', rows.length <= 1);
  if (rows.length <= 1) {
    const p = rows[0];
    board.innerHTML = p
      ? `<div class="pod pod-1">
           <span class="who">${esc(p.name)}</span>
           <span class="pts">${p.score}</span>
           <div class="col">&#127942;</div>
         </div>`
      : '';
    $('#restList').innerHTML = '';
    $('#podiumYou').textContent = note || '';
    show('podium');
    return;
  }

  // Two players get two columns, not two columns and a gap.
  const two = top.length === 2;
  board.classList.toggle('two', two);
  const order = two ? [top[1], top[0]] : [top[1], top[0], top[2]];
  const place = two ? [2, 1] : [2, 1, 3];

  board.innerHTML = order.map((p, i) => {
    if (!p) return '<div></div>';
    return `<div class="pod pod-${place[i]}">
      <span class="who">${esc(p.name)}</span>
      <span class="pts">${p.score}</span>
      <div class="col">${place[i]}</div>
    </div>`;
  }).join('');

  const rest = rows.slice(3, 12);
  $('#restList').innerHTML = rest.map((p) => `
    <li class="${p.id === youId ? 'is-you' : ''}">
      <span class="rk">${p.rank}</span>
      <span class="nm">${esc(p.name)}</span>
      <span class="sc">${p.score}</span>
    </li>`).join('');

  $('#podiumYou').textContent = note || '';
  show('podium');
}

/* ─────────── review ─────────── */

export function renderReview(items) {
  $('#reviewBody').innerHTML = items.map((it, i) => {
    const opts = it.options.map((o, k) => {
      const good = k === it.answer;
      const chosen = k === it.choice;
      const cls = good ? 'good' : (chosen ? 'bad' : '');
      const tag = good ? 'CORRECT' : (chosen ? 'YOUR PICK' : '');
      return `<div class="rev-opt ${cls}">
        <span>${esc(o)}</span>${tag ? `<span class="tag">${tag}</span>` : ''}
      </div>`;
    }).join('');

    return `<div class="rev">
      <div class="rev-meta">Q${i + 1} &middot; ${esc(it.topic)} &middot; ${esc(DIFF_LABEL[it.difficulty] || '')}</div>
      <p class="rev-q">${esc(it.question)}</p>
      ${it.code ? `<pre class="rev-code">${esc(it.code)}</pre>` : ''}
      ${opts}
      ${it.explanation ? `<p class="rev-ex">${esc(it.explanation)}</p>` : ''}
    </div>`;
  }).join('') || '<p class="rev-ex">Nothing to review yet.</p>';
  show('review');
}
