/* ============================================================
   avatars.js — character packs ("templates") and their motion

   A pack is a named set of characters a class plays as. The
   teacher picks one pack on the setup screen; each player is
   handed a free character from it and — unless the teacher turns
   that off — may swap to any other character nobody has taken.

   Adding a pack is a data edit. Drop another entry in PACKS and
   it appears in the teacher's picker, in every player's chooser,
   in the lobby, on the scoreboard and on the podium with no
   other change:

     {
       key: 'space',                 // unique; saved in the host's config
       label: 'Space crew',          // shown to the teacher
       icon: '\u{1F680}',            // one glyph for the pack card
       blurb: 'One line under the pack name.',
       characters: [
         { id: 'rocket', name: 'Rocket', glyph: '\u{1F680}', anim: 'zoom' },
         ...                         // 16+ keeps a whole class from clashing
       ],
     }

   `anim` names a loop defined in css/style.css as `.anim-<name>`.
   The names currently drawn there are listed in ANIMS; anything
   else falls back to a gentle bounce, so a pack that arrives from
   a host running a newer build still renders and still moves.
   ============================================================ */

/** Motion loops that css/style.css knows how to draw. */
export const ANIMS = [
  'jump', 'hop', 'bounce', 'waddle', 'float',
  'wiggle', 'spin', 'zoom', 'sway', 'stomp',
];

const FALLBACK_ANIM = 'bounce';

export const PACKS = [
  {
    key: 'animals',
    label: 'Animals',
    icon: '\u{1F430}',
    blurb: 'Jumping, hopping, waddling creatures.',
    characters: [
      { id: 'rabbit',    name: 'Rabbit',    glyph: '\u{1F430}', anim: 'jump' },
      { id: 'frog',      name: 'Frog',      glyph: '\u{1F438}', anim: 'hop' },
      { id: 'kangaroo',  name: 'Kangaroo',  glyph: '\u{1F998}', anim: 'jump' },
      { id: 'cat',       name: 'Cat',       glyph: '\u{1F431}', anim: 'wiggle' },
      { id: 'dog',       name: 'Dog',       glyph: '\u{1F436}', anim: 'bounce' },
      { id: 'fox',       name: 'Fox',       glyph: '\u{1F98A}', anim: 'hop' },
      { id: 'panda',     name: 'Panda',     glyph: '\u{1F43C}', anim: 'sway' },
      { id: 'koala',     name: 'Koala',     glyph: '\u{1F428}', anim: 'sway' },
      { id: 'lion',      name: 'Lion',      glyph: '\u{1F981}', anim: 'stomp' },
      { id: 'tiger',     name: 'Tiger',     glyph: '\u{1F42F}', anim: 'jump' },
      { id: 'monkey',    name: 'Monkey',    glyph: '\u{1F435}', anim: 'jump' },
      { id: 'penguin',   name: 'Penguin',   glyph: '\u{1F427}', anim: 'waddle' },
      { id: 'turtle',    name: 'Turtle',    glyph: '\u{1F422}', anim: 'sway' },
      { id: 'owl',       name: 'Owl',       glyph: '\u{1F989}', anim: 'float' },
      { id: 'bear',      name: 'Bear',      glyph: '\u{1F43B}', anim: 'waddle' },
      { id: 'pig',       name: 'Pig',       glyph: '\u{1F437}', anim: 'bounce' },
      { id: 'cow',       name: 'Cow',       glyph: '\u{1F42E}', anim: 'stomp' },
      { id: 'horse',     name: 'Horse',     glyph: '\u{1F434}', anim: 'hop' },
      { id: 'chick',     name: 'Chick',     glyph: '\u{1F423}', anim: 'hop' },
      { id: 'duck',      name: 'Duck',      glyph: '\u{1F986}', anim: 'waddle' },
      { id: 'dolphin',   name: 'Dolphin',   glyph: '\u{1F42C}', anim: 'float' },
      { id: 'octopus',   name: 'Octopus',   glyph: '\u{1F419}', anim: 'wiggle' },
      { id: 'bee',       name: 'Bee',       glyph: '\u{1F41D}', anim: 'zoom' },
      { id: 'butterfly', name: 'Butterfly', glyph: '\u{1F98B}', anim: 'float' },
      { id: 'hedgehog',  name: 'Hedgehog',  glyph: '\u{1F994}', anim: 'spin' },
      { id: 'elephant',  name: 'Elephant',  glyph: '\u{1F418}', anim: 'stomp' },
      { id: 'crab',      name: 'Crab',      glyph: '\u{1F980}', anim: 'waddle' },
      { id: 'snail',     name: 'Snail',     glyph: '\u{1F40C}', anim: 'sway' },
    ],
  },
  {
    key: 'cartoon',
    label: 'Cartoon crew',
    icon: '\u{1F916}',
    blurb: 'Robots, wizards, heroes and other troublemakers.',
    characters: [
      { id: 'robot',     name: 'Robot',      glyph: '\u{1F916}', anim: 'stomp' },
      { id: 'alien',     name: 'Alien',      glyph: '\u{1F47E}', anim: 'zoom' },
      { id: 'ghost',     name: 'Ghost',      glyph: '\u{1F47B}', anim: 'float' },
      { id: 'unicorn',   name: 'Unicorn',    glyph: '\u{1F984}', anim: 'hop' },
      { id: 'dragon',    name: 'Dragon',     glyph: '\u{1F432}', anim: 'float' },
      { id: 'wizard',    name: 'Wizard',     glyph: '\u{1F9D9}', anim: 'sway' },
      { id: 'hero',      name: 'Superhero',  glyph: '\u{1F9B8}', anim: 'zoom' },
      { id: 'villain',   name: 'Supervillain', glyph: '\u{1F9B9}', anim: 'wiggle' },
      { id: 'ninja',     name: 'Ninja',      glyph: '\u{1F977}', anim: 'wiggle' },
      { id: 'astronaut', name: 'Astronaut',  glyph: '\u{1F9D1}\u{200D}\u{1F680}', anim: 'float' },
      { id: 'cowboy',    name: 'Cowboy',     glyph: '\u{1F920}', anim: 'hop' },
      { id: 'clown',     name: 'Clown',      glyph: '\u{1F921}', anim: 'bounce' },
      { id: 'mermaid',   name: 'Merperson',  glyph: '\u{1F9DC}', anim: 'sway' },
      { id: 'fairy',     name: 'Fairy',      glyph: '\u{1F9DA}', anim: 'float' },
      { id: 'vampire',   name: 'Vampire',    glyph: '\u{1F9DB}', anim: 'jump' },
      { id: 'zombie',    name: 'Zombie',     glyph: '\u{1F9DF}', anim: 'waddle' },
      { id: 'genie',     name: 'Genie',      glyph: '\u{1F9DE}', anim: 'float' },
      { id: 'elf',       name: 'Elf',        glyph: '\u{1F9DD}', anim: 'hop' },
      { id: 'snowman',   name: 'Snowman',    glyph: '\u{26C4}',  anim: 'bounce' },
      { id: 'dino',      name: 'Dinosaur',   glyph: '\u{1F996}', anim: 'stomp' },
      { id: 'rocket',    name: 'Rocket',     glyph: '\u{1F680}', anim: 'zoom' },
      { id: 'ufo',       name: 'Flying saucer', glyph: '\u{1F6F8}', anim: 'float' },
      { id: 'star',      name: 'Star',       glyph: '\u{2B50}',  anim: 'spin' },
      { id: 'sun',       name: 'Sunshine',   glyph: '\u{1F31E}', anim: 'spin' },
      { id: 'pumpkin',   name: 'Pumpkin',    glyph: '\u{1F383}', anim: 'bounce' },
      { id: 'detective', name: 'Detective',  glyph: '\u{1F575}', anim: 'sway' },
      { id: 'juggler',   name: 'Juggler',    glyph: '\u{1F939}', anim: 'jump' },
      { id: 'artist',    name: 'Artist',     glyph: '\u{1F9D1}\u{200D}\u{1F3A8}', anim: 'wiggle' },
    ],
  },
];

export const DEFAULT_PACK = PACKS[0].key;

/**
 * Packs handed to us at runtime by a host (see registerPack). They are
 * kept apart from PACKS so a host's pack never shows up in this browser's
 * own teacher picker — it only has to render.
 */
const RECEIVED = new Map();

const escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => escMap[c]);

/** Packs the teacher can choose between. */
export function packs() { return PACKS; }

export function getPack(key) {
  return PACKS.find((p) => p.key === key) ||
         RECEIVED.get(key) ||
         PACKS[0];
}

export function packChars(key) { return getPack(key).characters; }

/** An id is only ever `[a-z0-9_-]`, so it is safe in a selector and in HTML. */
export function cleanCharId(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

/**
 * Adopt a pack definition sent by the host. Lets a player on an older
 * build render a pack that build has never heard of, characters, motion
 * and all.
 */
export function registerPack(def) {
  if (!def || typeof def.key !== 'string' || !Array.isArray(def.characters)) return null;
  const characters = def.characters
    .map((c) => ({
      id: cleanCharId(c && c.id),
      name: String((c && c.name) || '').slice(0, 32) || 'Player',
      glyph: String((c && c.glyph) || '').slice(0, 16) || '\u{1F642}',
      anim: ANIMS.includes(c && c.anim) ? c.anim : FALLBACK_ANIM,
    }))
    .filter((c) => c.id);
  if (!characters.length) return null;

  const pack = {
    key: cleanCharId(def.key) || 'pack',
    label: String(def.label || 'Characters').slice(0, 40),
    icon: String(def.icon || characters[0].glyph).slice(0, 16),
    blurb: String(def.blurb || '').slice(0, 120),
    characters,
  };
  RECEIVED.set(pack.key, pack);
  return pack;
}

/** The trimmed shape sent over the wire — no bigger than it has to be. */
export function packPayload(key) {
  const p = getPack(key);
  return {
    key: p.key,
    label: p.label,
    icon: p.icon,
    blurb: p.blurb,
    characters: p.characters.map((c) => ({ id: c.id, name: c.name, glyph: c.glyph, anim: c.anim })),
  };
}

/** Always returns a character: an unknown id falls back to a stable pick. */
export function charOf(packKey, charId) {
  const list = packChars(packKey);
  const hit = list.find((c) => c.id === charId);
  if (hit) return hit;
  return list[hashCode(String(charId || '')) % list.length];
}

/**
 * Choose a character nobody else is using. Honours `preferred` when it is
 * free, and once a pack runs out (more players than characters) it hands
 * out the least-crowded character rather than refusing to seat anyone.
 */
export function pickFree(packKey, taken = [], preferred = '') {
  const list = packChars(packKey);
  const want = cleanCharId(preferred);
  const used = new Map();
  for (const id of taken) used.set(id, (used.get(id) || 0) + 1);

  if (want && list.some((c) => c.id === want) && !used.has(want)) return want;

  const free = list.filter((c) => !used.has(c.id));
  if (free.length) return free[Math.floor(Math.random() * free.length)].id;

  let best = list[0];
  let bestN = Infinity;
  for (const c of list) {
    const n = used.get(c.id) || 0;
    if (n < bestN) { best = c; bestN = n; }
  }
  return best.id;
}

/* ─────────── remembering a choice ───────────
   A student who picked the fox last lesson gets the fox again, per pack,
   plus whichever they used most recently so the very first join already
   carries a request.                                                     */

const CHAR_KEY = 'snuq.chars';

function readChars() {
  try { return JSON.parse(localStorage.getItem(CHAR_KEY) || '{}') || {}; } catch (_) { return {}; }
}

export function recallChar(packKey) {
  const saved = readChars();
  return cleanCharId(packKey ? saved[packKey] : saved.last);
}

export function rememberChar(packKey, charId) {
  const id = cleanCharId(charId);
  if (!id) return;
  const saved = readChars();
  if (packKey) saved[packKey] = id;
  saved.last = id;
  try { localStorage.setItem(CHAR_KEY, JSON.stringify(saved)); } catch (_) {}
}

/* ─────────── rendering ─────────── */

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const MOODS = ['idle', 'happy', 'sad', 'still'];

/**
 * One avatar as HTML.
 * opts: { size, mood, delay (ms), pid, label (extra a11y text), plain }
 */
export function avatarHTML(packKey, charId, opts = {}) {
  const c = charOf(packKey, charId);
  const size = SIZES.includes(opts.size) ? opts.size : 'md';
  const mood = MOODS.includes(opts.mood) ? opts.mood : 'idle';
  const anim = ANIMS.includes(c.anim) ? c.anim : FALLBACK_ANIM;
  const delay = Number.isFinite(opts.delay) ? opts.delay : hashCode(c.id) % 900;
  const pid = opts.pid ? ` data-pid="${esc(opts.pid)}"` : '';
  const label = opts.label ? `${opts.label} (${c.name})` : c.name;
  return `<span class="avatar av-${size} anim-${anim} is-${mood}"${pid}` +
         ` style="--d:${delay}ms" role="img" aria-label="${esc(label)}" title="${esc(c.name)}">` +
         `<span class="face">${esc(c.glyph)}</span></span>`;
}

/** Same thing as a live element, for code that would rather not touch innerHTML. */
export function avatarNode(packKey, charId, opts = {}) {
  const holder = document.createElement('span');
  holder.innerHTML = avatarHTML(packKey, charId, opts);
  return holder.firstElementChild;
}

export function setMood(el, mood) {
  if (!el) return;
  MOODS.forEach((m) => el.classList.toggle('is-' + m, m === mood));
}

/** Replay whatever the avatar is doing — used when a player answers. */
export function poke(el) {
  if (!el) return;
  const face = el.querySelector('.face');
  if (!face) return;
  el.classList.add('is-poked');
  face.style.animation = 'none';
  void face.offsetWidth;                 // force a reflow so the loop restarts
  face.style.animation = '';
  setTimeout(() => el.classList.remove('is-poked'), 700);
}

/**
 * The grid a player (or a solo practiser) picks from.
 * opts: { selected, taken:[ids], onPick(id), disabled }
 */
export function renderPicker(box, packKey, opts = {}) {
  if (!box) return;
  const taken = new Set((opts.taken || []).filter((id) => id !== opts.selected));
  const pack = getPack(packKey);

  box.innerHTML = pack.characters.map((c, i) => {
    const isMine = c.id === opts.selected;
    const isGone = taken.has(c.id);
    return `<button type="button" class="char-pick${isMine ? ' is-on' : ''}${isGone ? ' is-taken' : ''}"
      data-id="${esc(c.id)}" ${isGone || opts.disabled ? 'disabled' : ''}
      aria-pressed="${isMine}" title="${esc(c.name)}${isGone ? ' — taken' : ''}">
      ${avatarHTML(pack.key, c.id, { size: 'sm', delay: (i % 8) * 110, mood: isMine ? 'idle' : 'still' })}
      <span class="char-name">${esc(c.name)}</span>
    </button>`;
  }).join('');

  if (opts.onPick) {
    box.querySelectorAll('.char-pick').forEach((btn) => {
      btn.onclick = () => opts.onPick(btn.dataset.id);
    });
  }

  // The grid scrolls, and a character near the bottom would otherwise look
  // as though nothing was selected. Move the box, never the page.
  const mine = opts.selected && box.querySelector('.char-pick.is-on');
  if (mine) {
    const to = mine.offsetTop - (box.clientHeight - mine.offsetHeight) / 2;
    box.scrollTop = Math.max(0, Math.min(to, box.scrollHeight - box.clientHeight));
  }
}

/**
 * A row of avatars, one per player.
 * rows: [{ id, name, char, mood }]
 */
export function renderStrip(box, packKey, rows, opts = {}) {
  if (!box) return;
  const size = opts.size || 'sm';
  const named = opts.names !== false;
  // Without names the items no longer need a fixed column width, which is
  // what keeps a whole class on one or two rows of a projector.
  box.classList.toggle('is-compact', !named);
  box.innerHTML = rows.map((r, i) => `
    <span class="strip-item${r.dim ? ' is-dim' : ''}" data-pid="${esc(r.id)}">
      ${avatarHTML(packKey, r.char, { size, mood: r.mood || 'idle', delay: (i % 10) * 90, label: r.name })}
      ${named ? `<span class="strip-name">${esc(r.name)}</span>` : ''}
    </span>`).join('');
}

export function stripItem(box, pid) {
  if (!box || !pid) return null;
  return box.querySelector(`.strip-item[data-pid="${CSS.escape(pid)}"]`);
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
