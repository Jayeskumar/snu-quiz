/* ============================================================
   app.js — bootstrap, navigation and setup screens
   ============================================================ */

import * as UI from './ui.js';
import { $, $$, esc } from './ui.js';
import { loadBanks, banks, countFor, allQuestions, DIFF_LABEL } from './engine.js';
import { cleanName } from './net.js';
import { sound } from './sound.js';
import { hostGame } from './host.js';
import { playerGame } from './player.js';
import { soloGame } from './solo.js';
import { stop as stopConfetti } from './confetti.js';

const CFG_KEY = 'snuq.cfg';
const NICK_KEY = 'snuq.nick';

let game = null;        // the live host/player/solo controller
let mode = 'host';      // which flavour the setup screen is configuring

const config = {
  topics: [],
  count: 15,
  time: 20,
  difficulty: 'all',
  shuffle: true,
  streak: true,
  explain: true,
  autoNext: false,
  projector: false,
};

/* ══════════════════ boot ══════════════════ */

(async function boot() {
  sound.init();
  UI.setRole('host');
  UI.show('boot');

  try {
    await loadBanks();
  } catch (err) {
    $('#bootMsg').textContent = err.message +
      '  —  if you opened this file directly, serve it over HTTP instead (see the README).';
    return;
  }

  restoreConfig();
  buildTopics();
  wire();
  route();
})();

/* ══════════════════ config ══════════════════ */

function restoreConfig() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (_) {}
  const keys = banks().map((b) => b.key);
  if (saved && Array.isArray(saved.topics)) {
    Object.assign(config, saved);
    config.topics = config.topics.filter((t) => keys.includes(t));
  }
  if (!config.topics.length) config.topics = keys.slice();
}

function saveConfig() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(config)); } catch (_) {}
}

/* ══════════════════ setup screen ══════════════════ */

function buildTopics() {
  $('#topicList').innerHTML = banks().map((b) => `
    <button class="chip ${config.topics.includes(b.key) ? 'is-on' : ''}" data-key="${esc(b.key)}">
      <span class="tick">&#10003;</span>
      <span>${b.icon ? `<span class="ico">${b.icon}</span> ` : ''}${esc(b.label)}</span>
      <span class="cnt">${b.questions.length}</span>
    </button>`).join('');

  $$('#topicList .chip').forEach((el) => {
    el.onclick = () => {
      const k = el.dataset.key;
      const i = config.topics.indexOf(k);
      if (i >= 0) {
        if (config.topics.length === 1) { UI.toast('Pick at least one topic'); return; }
        config.topics.splice(i, 1);
      } else config.topics.push(k);
      el.classList.toggle('is-on');
      sound.click();
      syncSetup();
    };
  });
}

function syncSetup() {
  const pool = countFor(config.topics, config.difficulty);
  const slider = $('#qCount');

  slider.max = String(Math.max(5, Math.min(60, pool)));
  if (config.count > Number(slider.max)) config.count = Number(slider.max);
  slider.value = String(config.count);

  $('#qCountOut').textContent = String(config.count);
  $('#qPool').textContent = `(${pool} available)`;
  $('#qTime').value = String(config.time);
  $('#qTimeOut').textContent = String(config.time);

  $$('#diffSeg .seg-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.diff === config.difficulty));
  $('#optShuffle').checked = config.shuffle;
  $('#optStreak').checked = config.streak;
  $('#optExplain').checked = config.explain;
  $('#optAutoNext').checked = config.autoNext;
  $('#optProjector').checked = config.projector;

  $('#btnStartGame').disabled = pool === 0;
  $('#btnStartGame').textContent = mode === 'solo'
    ? `Start practice (${Math.min(config.count, pool)} questions)`
    : `Open lobby (${Math.min(config.count, pool)} questions)`;

  saveConfig();
}

function openSetup(which) {
  mode = which;
  document.body.dataset.role = which === 'solo' ? 'solo' : 'host';
  $('#setupTitle').textContent = which === 'solo' ? 'Solo practice' : 'Host a live game';
  syncSetup();
  UI.show('setup');
}

/* ══════════════════ navigation ══════════════════ */

function endGame() {
  if (game && game.destroy) { try { game.destroy(); } catch (_) {} }
  game = null;
  UI.cancelReady();
  UI.stopTimer();
  stopConfetti();
  sound.stopLobby();
  sound.stopTicks();
  document.body.classList.remove('compact');
  // Shared buttons are re-wired by whichever controller starts next.
  ['#btnNext', '#btnSkip', '#btnBoardNext', '#btnLobbyStart'].forEach((s) => { $(s).onclick = null; });
}

function goHome() {
  endGame();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  UI.setRole('host');
  UI.show('home');
}

function route() {
  const m = /^#join=(\d{6})$/.exec(location.hash || '');
  if (m) {
    $('#joinPin').value = m[1];
    $('#joinNick').value = localStorage.getItem(NICK_KEY) || '';
    $('#joinError').textContent = '';
    UI.setRole('player');
    UI.show('join');
    setTimeout(() => $('#joinNick').focus(), 120);
  } else {
    UI.show('home');
  }
}

/* ══════════════════ wiring ══════════════════ */

function wire() {
  $('#btnSound').onclick = () => sound.toggle();

  $$('[data-nav]').forEach((el) => {
    el.onclick = () => {
      const to = el.dataset.nav;
      if (to === 'home') goHome();
      else UI.show(to);
      sound.click();
    };
  });

  /* home */
  $('#btnHost').onclick = () => { sound.click(); openSetup('host'); };
  $('#btnSolo').onclick = () => { sound.click(); openSetup('solo'); };
  $('#btnBrowse').onclick = () => { sound.click(); openBrowse(); };

  const goJoin = () => {
    const pin = ($('#homePin').value || '').replace(/\D/g, '');
    if (pin.length !== 6) { UI.toast('A game PIN is 6 digits'); return; }
    $('#joinPin').value = pin;
    $('#joinNick').value = localStorage.getItem(NICK_KEY) || '';
    $('#joinError').textContent = '';
    UI.setRole('player');
    UI.show('join');
    setTimeout(() => $('#joinNick').focus(), 120);
  };
  $('#btnHomeJoin').onclick = goJoin;
  $('#homePin').onkeydown = (e) => { if (e.key === 'Enter') goJoin(); };

  /* setup */
  $('#qCount').oninput = (e) => { config.count = Number(e.target.value); $('#qCountOut').textContent = e.target.value; syncSetup(); };
  $('#qTime').oninput  = (e) => { config.time  = Number(e.target.value); $('#qTimeOut').textContent  = e.target.value; saveConfig(); };

  $$('#diffSeg .seg-btn').forEach((b) => {
    b.onclick = () => { config.difficulty = b.dataset.diff; sound.click(); syncSetup(); };
  });

  $$('.topic-quick .chip-btn').forEach((b) => {
    b.onclick = () => {
      config.topics = b.dataset.topics === 'all' ? banks().map((x) => x.key) : [banks()[0].key];
      $$('#topicList .chip').forEach((c) => c.classList.toggle('is-on', config.topics.includes(c.dataset.key)));
      sound.click();
      syncSetup();
    };
  });

  const bindSwitch = (sel, key) => { $(sel).onchange = (e) => { config[key] = e.target.checked; saveConfig(); }; };
  bindSwitch('#optShuffle', 'shuffle');
  bindSwitch('#optStreak', 'streak');
  bindSwitch('#optExplain', 'explain');
  bindSwitch('#optAutoNext', 'autoNext');
  bindSwitch('#optProjector', 'projector');

  $('#btnStartGame').onclick = async () => {
    endGame();
    sound.click();
    if (mode === 'solo') game = soloGame({ ...config }, goHome);
    else game = await hostGame({ ...config }, goHome);
  };

  /* join */
  const doJoin = async () => {
    const pin = ($('#joinPin').value || '').replace(/\D/g, '');
    const nick = cleanName($('#joinNick').value);
    const err = $('#joinError');

    if (pin.length !== 6) { err.textContent = 'Enter the 6-digit game PIN'; return; }
    if (!nick) { err.textContent = 'Pick a nickname'; return; }

    localStorage.setItem(NICK_KEY, nick);
    err.textContent = '';
    const btn = $('#btnJoinGo');
    btn.disabled = true;
    btn.textContent = 'Connecting…';

    try {
      endGame();
      game = await playerGame(pin, nick, goHome);
    } catch (e) {
      err.textContent = e.message;
      UI.show('join');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enter';
    }
  };
  $('#btnJoinGo').onclick = doJoin;
  $('#joinNick').onkeydown = (e) => { if (e.key === 'Enter') doJoin(); };
  $('#joinPin').onkeydown = (e) => { if (e.key === 'Enter') $('#joinNick').focus(); };

  /* podium */
  $('#btnReview').onclick = () => { sound.click(); UI.renderReview(window.__snuReview || []); };
  $('#btnAgain').onclick = () => {
    sound.click();
    const again = document.body.dataset.role === 'solo' ? 'solo' : 'host';
    endGame();
    if (again === 'solo') game = soloGame({ ...config }, goHome);
    else openSetup('host');
  };

  /* browse */
  $('#browseSearch').oninput = (e) => renderBrowse(e.target.value);

  /* keyboard: 1-4 answer, Enter/Space advance */
  window.addEventListener('keydown', (e) => {
    const screen = UI.currentScreen();
    if (screen === 'question' && e.key >= '1' && e.key <= '4') {
      const btn = $(`.ans[data-i="${Number(e.key) - 1}"]`);
      if (btn && !btn.disabled) { btn.click(); e.preventDefault(); }
    } else if ((screen === 'reveal' || screen === 'scoreboard') && (e.key === 'Enter' || e.key === ' ')) {
      const btn = screen === 'reveal' ? $('#btnNext') : $('#btnBoardNext');
      if (btn && btn.offsetParent !== null) { btn.click(); e.preventDefault(); }
    } else if (screen === 'lobby' && e.key === 'Enter') {
      const btn = $('#btnLobbyStart');
      if (btn && !btn.disabled) btn.click();
    }
  });

  window.addEventListener('hashchange', route);

  // Leaving the page mid-game should tell the other side, not just vanish.
  window.addEventListener('pagehide', () => { if (game && game.destroy) game.destroy(); });
}

/* ══════════════════ browse ══════════════════ */

function openBrowse() {
  $('#browseSearch').value = '';
  renderBrowse('');
  UI.show('browse');
}

function renderBrowse(query) {
  const q = query.trim().toLowerCase();
  const all = allQuestions();
  const hits = q
    ? all.filter((x) =>
        x.question.toLowerCase().includes(q) ||
        x.topic.toLowerCase().includes(q) ||
        x.options.some((o) => o.toLowerCase().includes(q)) ||
        (x.explanation || '').toLowerCase().includes(q))
    : all;

  $('#browseStats').textContent = q
    ? `${hits.length} of ${all.length} questions`
    : `${all.length} questions across ${banks().length} topics`;

  const byBank = new Map();
  for (const x of hits) {
    if (!byBank.has(x.bank)) byBank.set(x.bank, []);
    byBank.get(x.bank).push(x);
  }

  $('#browseBody').innerHTML = banks()
    .filter((b) => byBank.has(b.key))
    .map((b) => `
      <div class="browse-group">
        <h3>${b.icon ? b.icon + ' ' : ''}${esc(b.label)} &middot; ${byBank.get(b.key).length}</h3>
        ${byBank.get(b.key).map((x) => `
          <div class="rev">
            <div class="rev-meta">${esc(x.id)} &middot; ${esc(DIFF_LABEL[x.difficulty] || '')}</div>
            <p class="rev-q">${esc(x.question)}</p>
            ${x.code ? `<pre class="rev-code">${esc(x.code)}</pre>` : ''}
            ${x.options.map((o, k) => `
              <div class="rev-opt ${k === x.answer ? 'good' : ''}">
                <span>${esc(o)}</span>${k === x.answer ? '<span class="tag">CORRECT</span>' : ''}
              </div>`).join('')}
            ${x.explanation ? `<p class="rev-ex">${esc(x.explanation)}</p>` : ''}
          </div>`).join('')}
      </div>`).join('') || '<p class="rev-ex">No questions match that search.</p>';
}
