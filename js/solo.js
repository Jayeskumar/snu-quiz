/* ============================================================
   solo.js — single-player practice. Same screens, same scoring,
   no network at all.
   ============================================================ */

import * as UI from './ui.js';
import { $ } from './ui.js';
import { buildQuiz, scoreAnswer } from './engine.js';
import { sound } from './sound.js';
import { burst, stop as stopConfetti } from './confetti.js';
import { pickFree } from './avatars.js';

const BEST_KEY = 'snuq.best';

export function soloGame(config, onExit) {
  UI.setRole('solo');
  UI.setPack(config.pack);
  UI.setMotion(config.anims !== false);

  // Practising alone still gets you a character — the same one you play as
  // in a live game, unless nothing was ever chosen.
  const myChar = config.char || pickFree(config.pack, []);

  const quiz = buildQuiz(config);
  if (!quiz.length) {
    UI.toast('No questions match those settings.', 5000);
    onExit();
    return null;
  }

  let idx = -1;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let correctCount = 0;
  let answered = false;
  let shownAt = 0;
  let dead = false;
  let advancing = false;
  const review = [];

  function cleanup() {
    dead = true;
    UI.cancelReady();
    UI.stopTimer();
    sound.stopTicks();
    stopConfetti();
  }

  function ask(i) {
    if (dead || i >= quiz.length) return;
    idx = i;
    answered = false;
    advancing = false;
    const q = quiz[i];

    UI.getReady(q.topic, () => sound.countdown()).then(() => {
      if (dead || idx !== i) return;
      sound.go();
      shownAt = performance.now();
      UI.renderQuestion(q, {
        role: 'solo', index: i, total: quiz.length, interactive: true,
        onPick: (choice) => resolve(choice),
      });
      UI.startTimer(q.time, { onEnd: () => { if (!answered) resolve(null); } });
      sound.startTicks(() => Math.max(0, q.time - (performance.now() - shownAt) / 1000));
    });
  }

  function resolve(choice) {
    if (answered) return;
    answered = true;
    UI.stopTimer();
    sound.stopTicks();

    const q = quiz[idx];
    const limitMs = q.time * 1000;
    const elapsedMs = choice === null ? limitMs : Math.min(limitMs, performance.now() - shownAt);
    const gotIt = choice === q.answer;

    streak = gotIt ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (gotIt) correctCount++;

    const { total } = scoreAnswer({
      correct: gotIt, elapsedMs, limitMs, streak, useStreak: config.streak,
    });
    score += total;

    review.push({
      topic: q.topic, difficulty: q.difficulty, question: q.question, code: q.code,
      options: q.options, answer: q.answer, choice, explanation: q.explanation,
    });

    if (choice !== null) UI.markPicked(choice);
    UI.revealOnTiles(q.answer);
    if (gotIt) sound.correct(); else if (choice === null) sound.timeup(); else sound.wrong();

    setTimeout(() => {
      if (dead) return;
      UI.renderReveal({
        isHost: false,
        gotIt,
        answered: choice !== null,
        points: total,
        streak,
        rankText: `${score} pts · ${correctCount}/${idx + 1} correct`,
        correctIdx: q.answer,
        correctText: q.options[q.answer],
        explanation: q.explanation,
        showExplain: config.explain,
        char: myChar,
      });
      const btn = $('#btnNext');
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = idx >= quiz.length - 1 ? 'See results' : 'Next';
      btn.onclick = () => {
        if (advancing) return;                 // ignore double clicks / held Enter
        advancing = true;
        btn.disabled = true;
        if (idx >= quiz.length - 1) finish(); else ask(idx + 1);
      };
    }, 900);
  }

  function finish() {
    cleanup();
    const max = quiz.length * 1000;
    const pct = Math.round((correctCount / quiz.length) * 100);

    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    const isBest = score > best;
    if (isBest) localStorage.setItem(BEST_KEY, String(score));

    sound.fanfare();
    UI.renderPodium(
      [{ id: 'you', name: 'You', char: myChar, score, rank: 1 }],
      'you',
      `${correctCount}/${quiz.length} correct (${pct}%) · best streak ${bestStreak}` +
        (isBest ? ' · new personal best!' : best ? ` · personal best ${best}` : '') +
        ` · ${score} of ${max} possible`
    );
    burst($('#confetti'));
    $('#btnReview').hidden = false;
    window.__snuReview = review;
  }

  // Solo has no scoreboard; the reveal screen's Next button drives the round.
  $('#btnNext').hidden = false;
  $('#btnSkip').onclick = () => { if (!answered) resolve(null); };
  ask(0);

  return {
    review,
    destroy: cleanup,
  };
}
