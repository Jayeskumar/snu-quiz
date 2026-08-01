/* ============================================================
   engine.js — question bank loading, quiz building, scoring
   ============================================================ */

export const MAX_POINTS = 1000;
export const STREAK_STEP = 100;
export const STREAK_CAP = 500;

let BANKS = [];

/** Load data/index.json and every bank it lists. */
export async function loadBanks() {
  const res = await fetch('data/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load data/index.json (HTTP ' + res.status + ')');
  const index = await res.json();

  const loaded = await Promise.all(
    index.banks.map(async (meta) => {
      const r = await fetch('data/' + meta.file, { cache: 'no-cache' });
      if (!r.ok) throw new Error('Could not load data/' + meta.file);
      const bank = await r.json();
      const questions = (bank.questions || []).filter(validQuestion).map((q) => ({
        ...q,
        bank: meta.key,
        topic: q.topic || bank.label || meta.label,
      }));
      return { key: meta.key, label: meta.label, icon: meta.icon || '', questions };
    })
  );

  BANKS = loaded.filter((b) => b.questions.length);
  if (!BANKS.length) throw new Error('The question bank is empty.');
  return BANKS;
}

function validQuestion(q) {
  return (
    q &&
    typeof q.question === 'string' && q.question.trim() &&
    Array.isArray(q.options) && q.options.length === 4 &&
    q.options.every((o) => typeof o === 'string' && o.trim()) &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
  );
}

export function banks() { return BANKS; }

export function allQuestions() {
  return BANKS.flatMap((b) => b.questions);
}

export function countFor(topicKeys, difficulty) {
  return BANKS
    .filter((b) => topicKeys.includes(b.key))
    .reduce((n, b) => n + b.questions.filter((q) => diffOk(q, difficulty)).length, 0);
}

function diffOk(q, difficulty) {
  return difficulty === 'all' || (q.difficulty || 'medium') === difficulty;
}

export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build the question list for a game.
 * Draws evenly across the chosen topics so one big bank cannot dominate.
 */
export function buildQuiz(config) {
  const chosen = BANKS.filter((b) => config.topics.includes(b.key));
  const pools = chosen
    .map((b) => shuffled(b.questions.filter((q) => diffOk(q, config.difficulty))))
    .filter((p) => p.length);

  if (!pools.length) return [];

  const picked = [];
  let round = 0;
  while (picked.length < config.count) {
    let addedThisRound = 0;
    for (const pool of pools) {
      if (picked.length >= config.count) break;
      if (round < pool.length) { picked.push(pool[round]); addedThisRound++; }
    }
    if (!addedThisRound) break;          // every pool exhausted
    round++;
  }

  return shuffled(picked).map((q, i) => prepare(q, i, config));
}

/** Freeze a question into the exact form both host and players will see. */
function prepare(q, i, config) {
  let options = q.options.slice();
  let answer = q.answer;

  if (config.shuffle) {
    const order = shuffled(options.map((_, k) => k));
    options = order.map((k) => q.options[k]);
    answer = order.indexOf(q.answer);
  }

  return {
    n: i,
    id: q.id,
    topic: q.topic,
    difficulty: q.difficulty || 'medium',
    question: q.question,
    code: q.code || '',
    options,
    answer,
    explanation: q.explanation || '',
    time: config.time,
  };
}

/**
 * Kahoot-style scoring.
 * A correct answer at t=0 is worth the full 1000; at the buzzer it is
 * worth half. Wrong answers and time-outs score nothing.
 */
export function scoreAnswer({ correct, elapsedMs, limitMs, streak, useStreak }) {
  if (!correct) return { base: 0, bonus: 0, total: 0 };
  const frac = Math.min(1, Math.max(0, elapsedMs / Math.max(1, limitMs)));
  const base = Math.round((1 - frac / 2) * MAX_POINTS);
  const bonus = useStreak ? Math.min(STREAK_CAP, Math.max(0, streak - 1) * STREAK_STEP) : 0;
  return { base, bonus, total: base + bonus };
}

/** Sort players into ranked order: score desc, then correct desc, then name. */
export function rankPlayers(players) {
  return players
    .slice()
    .sort((a, b) =>
      b.score - a.score ||
      b.correct - a.correct ||
      a.name.localeCompare(b.name)
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
