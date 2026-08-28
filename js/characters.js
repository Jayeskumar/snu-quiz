/* ============================================================
   characters.js — the drawn characters

   Every character is an inline SVG built over one shared
   skeleton, so a single set of CSS keyframes animates all of
   them: ears flop, tails swish, arms swing, legs kick, eyes
   blink, heads nod. No sprite sheets, no animation library,
   no image files, no requests.

   The skeleton lives in a 100 x 100 box:

       ears        (43,26) (57,26)     pivot where they meet the head
       head         (50,36) r20        pivot at the neck, (50,57)
       shoulders   (33,61) (67,61)
       body         (50,71)            pivot at the feet, (50,95)
       hips        (43,80) (57,80)
       tail         (68,76)
       ground       y = 96

   A template paints a skin over those anchors. Every moving
   piece is a <g class="p-…"> carrying its own transform-origin,
   which is what lets one keyframe rotate a rabbit's ear and a
   penguin's wing alike.

   Adding art for a character is one line in SPECS keyed by the
   character id in js/avatars.js. A character with no entry
   simply falls back to its emoji, so a pack that arrives from
   another host still renders.
   ============================================================ */

/* ─────────── drawing helpers ─────────── */

const ATTR = (o) => Object.entries(o)
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `${k}="${v}"`)
  .join(' ');

const cir = (cx, cy, r, fill, more = {}) => `<circle ${ATTR({ cx, cy, r, fill, ...more })}/>`;
const ell = (cx, cy, rx, ry, fill, more = {}) => `<ellipse ${ATTR({ cx, cy, rx, ry, fill, ...more })}/>`;
const rct = (x, y, w, h, rx, fill, more = {}) => `<rect ${ATTR({ x, y, width: w, height: h, rx, fill, ...more })}/>`;
const pth = (d, fill, more = {}) => `<path ${ATTR({ d, fill: fill || 'none', ...more })}/>`;
const stroke = (d, color, w, more = {}) =>
  pth(d, 'none', { stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...more });

/** A moving piece. (ox, oy) is where it pivots, in box units. */
const part = (cls, ox, oy, kids) =>
  `<g class="${cls}" style="transform-origin:${ox}px ${oy}px">${kids}</g>`;

/** Lighten (positive) or darken (negative) a #rrggbb by a percentage. */
export function shade(hex, pct) {
  const n = parseInt(String(hex).slice(1), 16);
  const target = pct < 0 ? 0 : 255;
  const mix = Math.abs(pct) / 100;
  const chan = (sh) => {
    const v = (n >> sh) & 255;
    return Math.round((target - v) * mix + v);
  };
  return '#' + [16, 8, 0].map((sh) => chan(sh).toString(16).padStart(2, '0')).join('');
}

const INK = '#37304a';

/** Two eyes that can blink together — the group scales flat on the eye line. */
function eyes(y, spread, r, ink = INK) {
  const l = 50 - spread;
  const r2 = 50 + spread;
  return part('p-eyes', 50, y,
    cir(l, y, r, ink) + cir(r2, y, r, ink) +
    cir(l + r * 0.36, y - r * 0.42, r * 0.36, '#fff') +
    cir(r2 + r * 0.36, y - r * 0.42, r * 0.36, '#fff'));
}

const smile = (y, w, ink = INK, sw = 2.2) =>
  stroke(`M${50 - w} ${y}q${w} ${w * 0.85} ${w * 2} 0`, ink, sw);

/* ─────────── ears ─────────── */

const EAR = {
  none: () => '',
  round: (side, main, alt) => {
    const x = 50 + side * 15;
    return cir(x, 22, 8.5, main) + cir(x, 22.5, 4.6, alt);
  },
  wide: (side, main, alt) => {
    const x = 50 + side * 19;
    return cir(x, 27, 11, main) + cir(x, 27.5, 6, alt);
  },
  point: (side, main, alt) => {
    const x = 50 + side * 13;
    return pth(`M${x - 8} 30L${x + side * 2} 9L${x + 8} 30Z`, main) +
           pth(`M${x - 4} 28L${x + side * 1} 16L${x + 4} 28Z`, alt);
  },
  long: (side, main, alt) => {
    const x = 50 + side * 10;
    return ell(x, 14, 6.2, 16, main, { transform: `rotate(${side * 9} ${x} 26)` }) +
           ell(x, 15, 3, 11, alt, { transform: `rotate(${side * 9} ${x} 26)` });
  },
  flop: (side, main, alt) => {
    const x = 50 + side * 18;
    return ell(x, 38, 7.5, 13, shade(main, -16), { transform: `rotate(${side * 18} ${x} 27)` }) +
           ell(x, 38, 3.6, 8, alt, { transform: `rotate(${side * 18} ${x} 27)` });
  },
  tiny: (side, main) => cir(50 + side * 13, 24, 5.5, main),
  tuft: (side, main) => pth(`M${50 + side * 8} 22L${50 + side * 17} 10L${50 + side * 18} 25Z`, main),
  horn: (side, main, alt) => {
    const x = 50 + side * 14;
    return cir(x, 24, 7.5, main) + cir(x, 24.5, 4, alt) +
           pth(`M${x + side * 3} 18q${side * 9} -3 ${side * 8} 6q${side * -5} -3 ${side * 8} -1Z`, '#f4e3c2');
  },
};

/* ─────────── tails ─────────── */

const TAIL = {
  none: () => '',
  puff: (main, alt) => cir(71, 78, 8.5, alt || shade(main, 60)),
  bush: (main) => ell(72, 71, 9.5, 13, shade(main, -8), { transform: 'rotate(24 68 78)' }) +
                  ell(75, 63, 6, 7, '#fff'),
  thin: (main) => stroke('M67 76q14 -2 12 -16', shade(main, -10), 5.5),
  long: (main) => stroke('M67 78q16 0 14 -18', shade(main, -12), 6) + cir(80, 58, 4.2, shade(main, -22)),
  curl: (main) => stroke('M67 74q10 -3 7 -8q-4 -5 -8 1', shade(main, -12), 4),
  spike: (main) => pth('M66 80q16 -2 20 -14q-3 14 -18 20Z', shade(main, -12)),
  fin: (main) => pth('M64 82q14 4 20 -6q0 14 -18 14Z', shade(main, -10)),
};

/* ─────────── templates ─────────── */

/** Four-limbed animal: the workhorse. */
function critter(s) {
  const main = s.main;
  const alt = s.alt || shade(main, 58);
  const dark = shade(main, -14);
  const ear = EAR[s.ear] || EAR.round;
  const tail = TAIL[s.tail] || TAIL.none;

  return (
    part('p-tail', 68, 76, tail(main, s.tailAlt)) +
    (s.wings
      ? part('p-armL', 34, 58, pth('M34 58q-26 -14 -28 4q16 -2 26 14Z', s.wings)) +
        part('p-armR', 66, 58, pth('M66 58q26 -14 28 4q-16 -2 -26 14Z', s.wings))
      : '') +
    part('p-legL', 43, 80, ell(41, 89, 8, 8.5, dark)) +
    part('p-legR', 57, 80, ell(59, 89, 8, 8.5, dark)) +
    part('p-body', 50, 95,
      ell(50, 71, 21, 20, main) +
      ell(50, 75, 12.5, 13, alt) +
      (s.marks === 'spots' ? cir(40, 66, 5, s.spot || '#fff') + cir(61, 78, 3.8, s.spot || '#fff') : '') +
      (s.marks === 'stripes' ? stroke('M34 64q8 4 0 9', INK, 2.6) + stroke('M66 64q-8 4 0 9', INK, 2.6) : '')) +
    part('p-armL', 33, 61, ell(30, 69, 6.5, 11, dark)) +
    part('p-armR', 67, 61, ell(70, 69, 6.5, 11, dark)) +
    part('p-head', 50, 57,
      part('p-earL', 43, 26, ear(-1, s.earMain || main, s.earAlt || alt)) +
      part('p-earR', 57, 26, ear(1, s.earMain || main, s.earAlt || alt)) +
      (s.quills ? pth('M50 4l6 14l10 -11l1 15l14 -5l-6 14l14 4l-12 9l10 12l-15 -1l3 15l-13 -8l-6 14l-6 -14l-13 8l3 -15l-15 1l10 -12l-12 -9l14 -4l-6 -14l14 5l1 -15l10 11Z', s.quillColor || shade(main, -30)) : '') +
      (s.mane ? cir(50, 36, 26, s.mane) : '') +
      cir(50, 36, 20, main) +
      (s.facePatch ? ell(50, 40, 14.5, 13, alt) : '') +
      (s.horns ? pth('M32 26q-9 -6 -11 1q7 1 9 6Z M68 26q9 -6 11 1q-7 1 -9 6Z', '#f4e3c2') : '') +
      (s.mask ? pth('M32 32a20 20 0 0 1 36 0Z', shade(main, -30)) : '') +
      (s.snout === false ? '' : ell(50, 43, 11, 8, alt)) +
      (s.trunk ? stroke('M50 44q2 16 -6 22', main, 8) : '') +
      eyes(33, 8, 3.3, s.ink) +
      (s.snout === false ? '' : ell(50, 40.5, 3.4, 2.5, s.nose || INK)) +
      smile(45.5, 4.5, s.ink) +
      (s.horn ? pth('M50 17l4 -13l4 13Z', '#ffd76a') : '') +
      (s.spikes ? pth('M34 22l4 -9l4 9Z M46 17l4 -10l4 10Z M58 21l4 -9l4 9Z', shade(main, -26)) : ''))
  );
}

/** Upright bird: penguin, owl, chick, duck. */
function bird(s) {
  const main = s.main;
  const alt = s.alt || '#fffaf0';
  const beak = s.beak || '#f5a623';
  const ear = EAR[s.ear] || EAR.none;

  return (
    part('p-legL', 44, 88, ell(44, 93, 6.5, 4, beak)) +
    part('p-legR', 56, 88, ell(56, 93, 6.5, 4, beak)) +
    part('p-body', 50, 95,
      ell(50, 60, 21, 30, main) +
      ell(50, 66, 13.5, 22, alt)) +
    part('p-armL', 32, 52, ell(28, 62, 6, 16, shade(main, -12), { transform: 'rotate(-6 32 52)' })) +
    part('p-armR', 68, 52, ell(72, 62, 6, 16, shade(main, -12), { transform: 'rotate(6 68 52)' })) +
    part('p-head', 50, 48,
      part('p-earL', 43, 26, ear(-1, main, alt)) +
      part('p-earR', 57, 26, ear(1, main, alt)) +
      cir(50, 32, 17, main) +
      (s.face ? ell(50, 34, 13, 12, alt) : '') +
      eyes(30, 7, 3.2, s.ink) +
      (s.bill
        ? ell(50, 41, 8, 4.5, beak)
        : pth('M45 38L55 38L50 45Z', beak)))
  );
}

/** Low-slung creatures: frog, turtle, crab, snail, dolphin, octopus. */
function swim(s) {
  const main = s.main;
  const alt = s.alt || shade(main, 55);
  const dark = shade(main, -14);
  const eyeY = s.eyeY || 58;

  // A shell is painted over the body, and the head pokes out in front of
  // it — the other way round and the animal disappears inside its own back.
  const shell = s.shell === 'side'
    ? cir(64, 62, 19, s.shellColor) +
      stroke('M64 62m-11 0a11 11 0 1 0 22 0a8 8 0 1 0 -16 0a5 5 0 1 0 10 0', shade(s.shellColor, -24), 2.6)
    : s.shell
      ? pth('M20 82a30 27 0 0 1 60 0Z', s.shellColor) +
        stroke('M30 82q20 -17 40 0 M50 56v26', shade(s.shellColor, -24), 2.6)
      : '';

  const arms = s.claws
    ? part('p-armL', 28, 68, ell(21, 70, 9.5, 7.5, main) + pth('M11 66l10 2l-10 5Z', main)) +
      part('p-armR', 72, 68, ell(79, 70, 9.5, 7.5, main) + pth('M89 66l-10 2l10 5Z', main))
    : s.tentacle
      ? part('p-armL', 32, 70, stroke('M34 70q-16 6 -14 22', main, 7) + stroke('M40 76q-10 8 -9 18', main, 6)) +
        part('p-armR', 68, 70, stroke('M66 70q16 6 14 22', main, 7) + stroke('M60 76q10 8 9 18', main, 6))
      : part('p-armL', 30, 66, ell(27, 73, 7, 9.5, dark)) +
        part('p-armR', 70, 66, ell(73, 73, 7, 9.5, dark));

  return (
    part('p-tail', 68, 76, (TAIL[s.tail] || TAIL.none)(main)) +
    (s.legs === false ? '' :
      part('p-legL', 40, 82, ell(34, 89, 11, 6.5, dark)) +
      part('p-legR', 60, 82, ell(66, 89, 11, 6.5, dark))) +
    part('p-body', 50, 95,
      ell(50, s.shell === true ? 82 : 68, s.wide || 24, s.tall || 22, main) +
      (s.shell ? '' : ell(50, 74, 15, 14, alt)) +
      shell) +
    arms +
    part('p-head', 50, 74,
      (s.shell ? cir(s.shell === 'side' ? 34 : 50, s.shell === 'side' ? 68 : 56, 14, main) : '') +
      (s.snout ? ell(50, 62, 15, 9, alt) : '') +
      (s.bulge
        ? cir(41, 48, 9, main) + cir(59, 48, 9, main) +
          cir(41, 48, 5, '#fff') + cir(59, 48, 5, '#fff') +
          part('p-eyes', 50, 48, cir(41, 48, 3, INK) + cir(59, 48, 3, INK))
        : eyes(eyeY, s.spread || 8, 3.3, s.ink)) +
      smile(eyeY + (s.bulge ? 16 : 11), s.wide ? 7 : 6, s.ink) +
      (s.antennae
        ? stroke(`M${s.eyeX || 44} ${eyeY - 8}q-3 -11 -8 -14 M${(s.eyeX || 44) + 12} ${eyeY - 8}q3 -11 8 -14`, dark, 2.6)
        : ''))
  );
}

/** Winged insects: bee, butterfly. */
function bug(s) {
  const main = s.main;
  const alt = s.alt || '#ffffff';
  return (
    part('p-armL', 42, 58, ell(26, 50, 16, 12, alt, { opacity: .85, transform: 'rotate(-18 42 58)' })) +
    part('p-armR', 58, 58, ell(74, 50, 16, 12, alt, { opacity: .85, transform: 'rotate(18 58 58)' })) +
    part('p-legL', 44, 82, stroke('M44 82q-6 8 -10 10', shade(main, -30), 2.4)) +
    part('p-legR', 56, 82, stroke('M56 82q6 8 10 10', shade(main, -30), 2.4)) +
    part('p-body', 50, 95,
      ell(50, 68, 15, 20, main) +
      (s.bands ? stroke('M36 62h28 M37 71h26 M40 79h20', shade(main, -55), 4) : '') +
      (s.marks === 'wing' ? '' : '')) +
    part('p-head', 50, 54,
      part('p-earL', 45, 40, stroke('M45 40q-5 -10 -10 -12', shade(main, -40), 2.4) + cir(35, 27, 3, shade(main, -40))) +
      part('p-earR', 55, 40, stroke('M55 40q5 -10 10 -12', shade(main, -40), 2.4) + cir(65, 27, 3, shade(main, -40))) +
      cir(50, 42, 13, shade(main, -25)) +
      eyes(40, 5.5, 3, '#fff') +
      smile(48, 3.5, '#fff', 1.8))
  );
}

/** Humanoid: wizards, heroes, ninjas — most of the cartoon pack. */
function person(s) {
  const skin = s.skin || '#f6c9a0';
  const suit = s.main;
  const alt = s.alt || shade(suit, 22);
  const hair = s.hair || '#3b2f2a';

  return (
    (s.cape ? part('p-tail', 50, 58, pth('M34 58q16 34 32 0q4 32 -16 36q-20 -4 -16 -36Z', s.cape)) : '') +
    (s.legless
      ? part('p-tail', 50, 74, pth('M38 74q12 24 24 0q6 18 -12 22q-18 -4 -12 -22Z', shade(suit, -18), { opacity: .75 }))
      : part('p-legL', 44, 78, rct(38, 76, 11, 19, 5, alt)) +
        part('p-legR', 56, 78, rct(51, 76, 11, 19, 5, alt))) +
    part('p-body', 50, 95,
      (s.robe
        ? pth('M32 92q2 -34 18 -36q16 2 18 36Z', suit)
        : rct(33, 54, 34, 32, 12, suit)) +
      (s.belt ? rct(33, 74, 34, 6, 3, shade(suit, -35)) : '') +
      (s.emblem ? pth('M50 62l4 8h-8Z', s.emblem) + cir(50, 68, 4, s.emblem) : '')) +
    part('p-armL', 33, 58, rct(23, 56, 10, 24, 5, suit) + cir(28, 80, 5.4, skin)) +
    part('p-armR', 67, 58, rct(67, 56, 10, 24, 5, suit) + cir(72, 80, 5.4, skin)) +
    part('p-head', 50, 52,
      part('p-earL', 43, 26, (EAR[s.ear] || EAR.none)(-1, skin, shade(skin, -18))) +
      part('p-earR', 57, 26, (EAR[s.ear] || EAR.none)(1, skin, shade(skin, -18))) +
      cir(50, 34, 16, skin) +
      (s.hat === 'hair' ? pth('M34 32a16 16 0 0 1 32 0q-16 -9 -32 0Z', hair) : '') +
      (s.hat === 'puff' ? cir(35, 28, 8, hair) + cir(65, 28, 8, hair) : '') +
      (s.hat === 'pointy' ? pth('M31 26L50 -2L69 26Z', s.hatColor || suit) + rct(28, 24, 44, 7, 3, shade(s.hatColor || suit, -20)) : '') +
      (s.hat === 'brim' ? rct(26, 22, 48, 6, 3, s.hatColor || suit) + rct(37, 8, 26, 16, 6, s.hatColor || suit) : '') +
      (s.hat === 'cap' ? pth('M34 24a16 16 0 0 1 32 0Z', s.hatColor || suit) + rct(60, 22, 16, 5, 2, shade(s.hatColor || suit, -18)) : '') +
      (s.hat === 'beret' ? pth('M33 26a17 12 0 0 1 34 0Z', s.hatColor || '#c0392b') + cir(62, 16, 3.4, s.hatColor || '#c0392b') : '') +
      (s.helmet ? cir(50, 33, 19, '#dfe7f2', { opacity: .55 }) + pth('M36 26a17 15 0 0 1 30 4Z', '#ffffff', { opacity: .5 }) : '') +
      (s.maskBand ? rct(32, 30, 36, 9, 4, shade(suit, -30)) : '') +
      eyes(33, 7, 3.2, s.ink) +
      (s.fangs ? pth('M46 44l2 5l2 -5Z M52 44l2 5l2 -5Z', '#fff') : '') +
      smile(42, 5, s.ink) +
      (s.beard ? pth('M36 40q14 26 28 0q2 22 -14 24q-16 -2 -14 -24Z', s.beardColor || '#eceff4') : ''))
  );
}

/** Boxy machines: robot, rocket, saucer. */
function bot(s) {
  const main = s.main;
  const alt = s.alt || shade(main, -22);
  const glow = s.glow || '#7ff0e0';

  return (
    part('p-legL', 44, 80, rct(38, 80, 10, 15, 4, alt)) +
    part('p-legR', 56, 80, rct(52, 80, 10, 15, 4, alt)) +
    part('p-body', 50, 95,
      rct(32, 52, 36, 30, 9, main) +
      rct(39, 60, 22, 14, 5, shade(main, -32)) +
      cir(46, 67, 2.8, glow) + cir(54, 67, 2.8, glow)) +
    part('p-armL', 33, 57, rct(22, 55, 9, 22, 4.5, alt) + cir(26.5, 78, 5, main)) +
    part('p-armR', 67, 57, rct(69, 55, 9, 22, 4.5, alt) + cir(73.5, 78, 5, main)) +
    part('p-head', 50, 52,
      part('p-earL', 43, 22, stroke('M43 26v-10', alt, 3) + cir(43, 13, 4, glow)) +
      part('p-earR', 57, 22, s.oneAntenna ? '' : stroke('M57 26v-10', alt, 3) + cir(57, 13, 4, glow)) +
      rct(31, 20, 38, 30, 10, main) +
      rct(36, 28, 28, 14, 6, shade(main, -40)) +
      part('p-eyes', 50, 35, cir(43, 35, 3.6, glow) + cir(57, 35, 3.6, glow)) +
      stroke('M44 45h12', shade(main, -40), 2.6))
  );
}

/** Round things: ghosts, stars, suns, pumpkins, snowmen, saucers. */
function orb(s) {
  const main = s.main;
  const alt = s.alt || shade(main, -18);

  const shapes = {
    ghost: pth('M26 88V56a24 24 0 0 1 48 0v32l-8 -7l-8 7l-8 -7l-8 7l-8 -7Z', main),
    star: pth('M50 20l9 22l24 2l-18 15l6 23l-21 -13l-21 13l6 -23l-18 -15l24 -2Z', main),
    sun: cir(50, 58, 24, main) +
      stroke('M50 26v-10 M50 90v10 M18 58H8 M92 58h10 M27 35l-7 -7 M73 35l7 -7 M27 81l-7 7 M73 81l7 7', main, 5),
    pumpkin: ell(50, 64, 27, 24, main) +
      stroke('M34 46q-6 18 0 36 M66 46q6 18 0 36', shade(main, -22), 2.6) +
      stroke('M50 40v-10q8 -2 10 -8', '#4f8a3d', 4),
    snow: cir(50, 74, 20, main) + cir(50, 44, 15, main) +
      cir(50, 70, 2.6, INK) + cir(50, 79, 2.6, INK) +
      rct(32, 28, 36, 5, 2, '#c0392b') + rct(38, 12, 24, 17, 4, '#c0392b'),
    saucer: ell(50, 62, 34, 11, main) + ell(50, 62, 34, 11, main, { opacity: .4 }) +
      pth('M32 58a18 14 0 0 1 36 0Z', '#a8e6ff', { opacity: .8 }) +
      cir(30, 64, 3, '#fff') + cir(50, 67, 3, '#fff') + cir(70, 64, 3, '#fff'),
  };

  const head = s.shape === 'snow' ? 44 : (s.shape === 'saucer' ? 58 : 54);
  return (
    part('p-armL', 30, 62, s.arms === false ? '' : stroke('M32 62q-12 6 -10 18', alt, 5)) +
    part('p-armR', 70, 62, s.arms === false ? '' : stroke('M68 62q12 6 10 18', alt, 5)) +
    part('p-body', 50, 95, shapes[s.shape] || shapes.ghost) +
    part('p-head', 50, 70,
      eyes(head, s.shape === 'saucer' ? 0 : 8, s.shape === 'saucer' ? 0 : 3.6, s.ink) +
      (s.shape === 'saucer' ? '' : smile(head + 12, 6, s.ink, 2.4)))
  );
}

const TEMPLATES = { critter, bird, swim, bug, person, bot, orb };

/**
 * Not every silhouette fills the box — a dolphin is long and low where a
 * rabbit is tall — so each one is scaled to sit at about the same visual
 * weight. The scale rides on the <svg> element itself, well clear of the
 * groups inside, so no part's pivot moves.
 */
const FIT = { critter: 1, person: 1, bird: 1.12, bot: 1.07, bug: 1.08, swim: 1.5, orb: 1.4 };

/* ─────────── the cast ───────────
   One line each: which template to draw, the colours, and the two or
   three features that make it recognisable. Keys match the character
   ids in js/avatars.js.                                              */

const SPECS = {
  /* animals */
  rabbit:    { tpl: 'critter', main: '#f0f0f4', alt: '#ffd9e2', ear: 'long',  tail: 'puff', nose: '#e88aa4' },
  frog:      { tpl: 'swim',    main: '#5ec15e', alt: '#d6f5c8', bulge: true,  wide: 25, tall: 19, eyeY: 48 },
  kangaroo:  { tpl: 'critter', main: '#c98a52', alt: '#f0d6b6', ear: 'long',  tail: 'long' },
  cat:       { tpl: 'critter', main: '#9aa3ad', alt: '#f2f4f7', ear: 'point', tail: 'thin', nose: '#e88aa4' },
  dog:       { tpl: 'critter', main: '#d8a45e', alt: '#f7e3c4', ear: 'flop',  tail: 'bush' },
  fox:       { tpl: 'critter', main: '#f07c2e', alt: '#fff1e0', ear: 'point', tail: 'bush' },
  panda:     { tpl: 'critter', main: '#f4f4f6', alt: '#ffffff', ear: 'round', earMain: '#2f2b33', earAlt: '#4a444f', mask: true, tail: 'none' },
  koala:     { tpl: 'critter', main: '#a9b2bb', alt: '#e6ebef', ear: 'wide',  tail: 'none', nose: '#3a3540' },
  lion:      { tpl: 'critter', main: '#e8ae3c', alt: '#fbe6b8', ear: 'round', tail: 'long', mane: '#c8792a' },
  tiger:     { tpl: 'critter', main: '#f39321', alt: '#fff0d8', ear: 'round', tail: 'long', marks: 'stripes' },
  monkey:    { tpl: 'critter', main: '#9c6b43', alt: '#e8c49a', ear: 'wide',  tail: 'curl', facePatch: true, snout: false },
  penguin:   { tpl: 'bird',    main: '#2f3140', alt: '#ffffff', beak: '#f5a623' },
  turtle:    { tpl: 'swim',    main: '#8ecf62', alt: '#dff2c8', shell: true,  shellColor: '#3f8f3f', eyeY: 56, spread: 6, fit: 1.4 },
  owl:       { tpl: 'bird',    main: '#a9743f', alt: '#f0dcc0', ear: 'tuft',  face: true, ink: '#2f2b33' },
  bear:      { tpl: 'critter', main: '#8a5a38', alt: '#d9b18a', ear: 'round', tail: 'none', nose: '#3a3540' },
  pig:       { tpl: 'critter', main: '#f2a1b8', alt: '#ffd6e2', ear: 'point', tail: 'curl', nose: '#d4708f' },
  cow:       { tpl: 'critter', main: '#f4f4f6', alt: '#ffd9e2', ear: 'wide',  tail: 'long', marks: 'spots', spot: '#3a3540', horns: true, nose: '#e88aa4' },
  horse:     { tpl: 'critter', main: '#b8763f', alt: '#e8cba8', ear: 'point', tail: 'long', mane: '#40291a' },
  chick:     { tpl: 'bird',    main: '#ffd85e', alt: '#fff3c4', beak: '#f5893a' },
  duck:      { tpl: 'bird',    main: '#f7f7fa', alt: '#ffffff', beak: '#f5a623', bill: true },
  dolphin:   { tpl: 'swim',    main: '#5aa9e6', alt: '#dff0ff', tail: 'fin',  legs: false, snout: true, eyeY: 54, wide: 26, tall: 19, fit: 1.45 },
  octopus:   { tpl: 'swim',    main: '#c060b8', alt: '#f2cdee', tentacle: true, legs: false, eyeY: 56 },
  bee:       { tpl: 'bug',     main: '#f5c518', bands: true, fit: 1.05 },
  butterfly: { tpl: 'bug',     main: '#8b6bd8', alt: '#ffb3d9' },
  hedgehog:  { tpl: 'critter', main: '#c9a173', alt: '#eeddc2', ear: 'tiny',  tail: 'none', quills: true, quillColor: '#6b4a2f' },
  elephant:  { tpl: 'critter', main: '#9aa5b1', alt: '#cfd8e0', ear: 'wide',  tail: 'thin', trunk: true, snout: false },
  crab:      { tpl: 'swim',    main: '#e8503a', alt: '#ffc9be', claws: true,  eyeY: 60, wide: 25, tall: 16, antennae: true, fit: 1.28 },
  snail:     { tpl: 'swim',    main: '#e8cba0', alt: '#f5e4c8', shell: 'side', shellColor: '#d4762f', legs: false, eyeY: 66, eyeX: 30, spread: 6, antennae: true },

  /* cartoon crew */
  robot:     { tpl: 'bot',     main: '#8fa3b8', alt: '#5f7186', glow: '#7ff0e0' },
  alien:     { tpl: 'person',  main: '#5fbf6a', alt: '#3f9a4c', skin: '#8fe07a', ear: 'point', ink: '#1d2a1f' },
  ghost:     { tpl: 'orb',     main: '#f2f2f8', shape: 'ghost', arms: false, fit: 1.6 },
  unicorn:   { tpl: 'critter', main: '#fdf2f7', alt: '#ffe0ef', ear: 'point', tail: 'bush', mane: '#c9a4ff', horn: true },
  dragon:    { tpl: 'critter', main: '#4bbf7a', alt: '#d5f5df', ear: 'none',  tail: 'spike', spikes: true, wings: '#2f8f5a', horn: true },
  wizard:    { tpl: 'person',  main: '#5b46b8', hat: 'pointy', hatColor: '#4534a0', beard: true, robe: true },
  hero:      { tpl: 'person',  main: '#2f6fd0', cape: '#e03a52', emblem: '#ffd400', belt: true, hat: 'hair' },
  villain:   { tpl: 'person',  main: '#3b3550', cape: '#7a2fd6', maskBand: true, belt: true },
  ninja:     { tpl: 'person',  main: '#2f3140', maskBand: true, belt: true, ink: '#f2f2f8', skin: '#2f3140' },
  astronaut: { tpl: 'person',  main: '#eef2f7', alt: '#c8d2df', helmet: true, belt: true },
  cowboy:    { tpl: 'person',  main: '#c98a52', hat: 'brim', hatColor: '#8a5a38', belt: true },
  clown:     { tpl: 'person',  main: '#e8503a', hat: 'puff', hair: '#f5a623', nose: '#e8503a', belt: true },
  mermaid:   { tpl: 'person',  main: '#3fc9c0', alt: '#2aa39c', hat: 'hair', hair: '#e8503a', robe: true },
  fairy:     { tpl: 'person',  main: '#f2a1d8', cape: '#dff5ff', hat: 'hair', hair: '#ffd85e', robe: true },
  vampire:   { tpl: 'person',  main: '#2f2b3d', cape: '#a01f38', hat: 'hair', hair: '#141220', fangs: true, skin: '#e6d9e0' },
  zombie:    { tpl: 'person',  main: '#5e6b4a', skin: '#9dbd7a', hat: 'hair', hair: '#3c4a2e', ink: '#26301c' },
  genie:     { tpl: 'person',  main: '#7a4fd6', alt: '#5b39a8', skin: '#8fd6f0', robe: true, legless: true, hat: 'cap', hatColor: '#ffd400', beard: true, beardColor: '#2f2b3d' },
  elf:       { tpl: 'person',  main: '#3f9a4c', hat: 'pointy', hatColor: '#2f7a3a', ear: 'point', belt: true },
  snowman:   { tpl: 'orb',     main: '#f4f8fc', shape: 'snow', fit: 1.1 },
  dino:      { tpl: 'critter', main: '#7ac943', alt: '#e2f7cc', ear: 'none',  tail: 'spike', spikes: true, marks: 'spots', spot: '#4f8f2a' },
  rocket:    { tpl: 'bot',     main: '#e8503a', alt: '#c53a26', glow: '#a8e6ff', oneAntenna: true },
  ufo:       { tpl: 'orb',     main: '#9aa5b1', shape: 'saucer', arms: false, fit: 1.45 },
  star:      { tpl: 'orb',     main: '#ffd400', shape: 'star', arms: false, fit: 1.45 },
  sun:       { tpl: 'orb',     main: '#ffb02e', shape: 'sun', arms: false, fit: 1.05 },
  pumpkin:   { tpl: 'orb',     main: '#f2801e', shape: 'pumpkin', arms: false, fit: 1.35 },
  detective: { tpl: 'person',  main: '#8a7a5e', hat: 'brim', hatColor: '#6b5c44', belt: true },
  juggler:   { tpl: 'person',  main: '#e8503a', alt: '#ffd400', hat: 'hair', hair: '#3b2f2a', belt: true },
  artist:    { tpl: 'person',  main: '#4a7fd0', hat: 'beret', hatColor: '#c0392b', belt: true },
};

/* ─────────── public ─────────── */

/** Ids this build has artwork for. */
export function hasFigure(id) { return Object.prototype.hasOwnProperty.call(SPECS, id); }

/**
 * The drawn character as inline SVG, or '' when there is no artwork —
 * the caller then falls back to the emoji.
 */
export function figureSVG(id) {
  const spec = SPECS[id];
  if (!spec) return '';
  const draw = TEMPLATES[spec.tpl] || critter;
  const fit = spec.fit || FIT[spec.tpl] || 1;
  return `<svg class="fig" viewBox="0 0 100 100" style="--fit:${fit}" aria-hidden="true" focusable="false">` +
         `<g class="face p-all">${draw(spec)}</g></svg>`;
}
