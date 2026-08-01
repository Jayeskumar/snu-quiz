/* Lightweight canvas confetti for the podium. No dependencies. */

const COLORS = ['#e21b3c', '#1368ce', '#ffd400', '#26890c', '#ffffff', '#ff7ab0'];

let raf = null;

export function burst(canvas, { count = 140, duration = 5200 } = {}) {
  stop();
  if (!canvas || !canvas.getContext) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  const size = () => {
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  };
  size();
  window.addEventListener('resize', size);

  const W = () => canvas.width;
  const H = () => canvas.height;

  const bits = Array.from({ length: count }, () => ({
    x: Math.random() * W(),
    y: -Math.random() * H() * 0.6,
    w: (6 + Math.random() * 7) * dpr,
    h: (9 + Math.random() * 11) * dpr,
    vy: (1.4 + Math.random() * 2.6) * dpr,
    vx: (Math.random() - 0.5) * 1.6 * dpr,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.22,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    sway: Math.random() * Math.PI * 2,
  }));

  const started = performance.now();

  const frame = (now) => {
    const t = now - started;
    ctx.clearRect(0, 0, W(), H());
    const fade = t > duration - 900 ? Math.max(0, (duration - t) / 900) : 1;

    for (const b of bits) {
      b.sway += 0.05;
      b.y += b.vy;
      b.x += b.vx + Math.sin(b.sway) * 0.8 * dpr;
      b.rot += b.vr;
      if (b.y > H() + 40 * dpr) { b.y = -20 * dpr; b.x = Math.random() * W(); }

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }

    if (t < duration) raf = requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W(), H()); raf = null; window.removeEventListener('resize', size); }
  };

  raf = requestAnimationFrame(frame);
}

export function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}
