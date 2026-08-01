/* Tiny WebAudio sound engine — no audio files, nothing to download. */

let ctx = null;
let muted = localStorage.getItem('snuq.muted') === '1';
let lobbyTimer = null;
let tickTimer = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** A single shaped oscillator note. */
function note(freq, start, dur, { type = 'square', gain = 0.07, slideTo = null } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function seq(notes, opts) {
  notes.forEach(([f, at, d]) => note(f, at, d, opts));
}

export const sound = {
  get muted() { return muted; },

  toggle() {
    muted = !muted;
    localStorage.setItem('snuq.muted', muted ? '1' : '0');
    document.body.classList.toggle('muted', muted);
    if (muted) { this.stopLobby(); this.stopTicks(); }
    else { this.click(); }
    return muted;
  },

  init() {
    document.body.classList.toggle('muted', muted);
    // Browsers require a gesture before audio starts.
    const unlock = () => ac();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  },

  click()   { note(660, 0, 0.05, { type: 'triangle', gain: 0.05 }); },
  join()    { seq([[523, 0, 0.09], [784, 0.08, 0.12]], { type: 'triangle', gain: 0.06 }); },
  leave()   { seq([[440, 0, 0.09], [294, 0.08, 0.13]], { type: 'triangle', gain: 0.05 }); },
  select()  { note(880, 0, 0.08, { type: 'square', gain: 0.06 }); },

  countdown() { note(700, 0, 0.11, { type: 'square', gain: 0.07 }); },
  go()        { seq([[523, 0, 0.1], [659, 0.09, 0.1], [1046, 0.18, 0.24]], { type: 'square', gain: 0.07 }); },

  correct() {
    seq([[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1046, 0.27, 0.3]],
        { type: 'square', gain: 0.075 });
  },
  wrong() {
    seq([[311, 0, 0.16], [233, 0.15, 0.32]], { type: 'sawtooth', gain: 0.055 });
  },
  timeup() {
    seq([[392, 0, 0.12], [330, 0.11, 0.12], [262, 0.22, 0.3]], { type: 'sawtooth', gain: 0.05 });
  },
  fanfare() {
    seq([
      [523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1046, 0.33, 0.18],
      [880, 0.52, 0.12], [1046, 0.63, 0.5],
    ], { type: 'square', gain: 0.08 });
  },

  /** Soft two-note loop while players trickle into the lobby. */
  startLobby() {
    if (muted || lobbyTimer) return;
    let i = 0;
    const bass = [196, 220, 247, 220];
    lobbyTimer = setInterval(() => {
      if (muted) return;
      note(bass[i % bass.length], 0, 0.42, { type: 'sine', gain: 0.028 });
      note(bass[i % bass.length] * 2, 0.2, 0.2, { type: 'sine', gain: 0.016 });
      i++;
    }, 620);
  },
  stopLobby() { clearInterval(lobbyTimer); lobbyTimer = null; },

  /** Accelerating tick under the question timer. */
  startTicks(getRemaining) {
    this.stopTicks();
    if (muted) return;
    const beat = () => {
      const left = getRemaining();
      if (left <= 0) return;
      const urgent = left <= 5;
      note(urgent ? 1100 : 760, 0, urgent ? 0.05 : 0.035,
           { type: 'square', gain: urgent ? 0.05 : 0.022 });
      tickTimer = setTimeout(beat, urgent ? 380 : 900);
    };
    tickTimer = setTimeout(beat, 500);
  },
  stopTicks() { clearTimeout(tickTimer); tickTimer = null; },
};
