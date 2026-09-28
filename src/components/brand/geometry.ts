/**
 * GamePulse brand geometry — the single source of truth for the pulse-ball mark.
 * The static PNG assets in `assets/images` are rendered from the same numbers
 * (see `scripts/brand/generate.py`), so in-app and native splash frames line up.
 */

type Pt = readonly [number, number];

const pentagon = (cx: number, cy: number, r: number, rotDeg: number): Pt[] =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rotDeg + 72 * k) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });

const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/** Football drawn in a 100×100 box: centre pentagon, five seams, five rim patches. */
export const BALL = (() => {
  const c = 50;
  const r = 50;
  const center = pentagon(c, c, r * 0.37, -90);
  const patches: string[] = [];
  const seams: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let k = 0; k < 5; k++) {
    const ang = -90 + 72 * k;
    const a = (ang * Math.PI) / 180;
    const patch = pentagon(c + r * 0.97 * Math.cos(a), c + r * 0.97 * Math.sin(a), r * 0.27, ang + 180);
    patches.push(pts(patch));
    seams.push({ x1: center[k][0], y1: center[k][1], x2: patch[0][0], y2: patch[0][1] });
  }

  return { box: 100, radius: r, seam: r * 0.075, center: pts(center), patches, seams };
})();

/**
 * Lockup: an ECG trace that runs into the ball, with pulse arcs radiating off it.
 * Units: lockup "size" = 100, baseline at y = 0.
 */
export const LOCKUP = (() => {
  const s = 100;
  const r = s * 0.23;
  const traceLen = s * 0.5;
  const ballX = traceLen + r;
  const stroke = s * 0.05;
  const traceEnd = ballX - r * 0.98;
  const h = r * 1.15;
  const w = traceEnd;

  const trace: Pt[] = [
    [0, 0],
    [w * 0.26, 0],
    [w * 0.36, -h * 0.3],
    [w * 0.46, h * 0.26],
    [w * 0.58, -h],
    [w * 0.7, h * 0.55],
    [w * 0.79, 0],
    [traceEnd, 0],
  ];
  const tracePath = 'M' + trace.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L');

  const arcs = [
    { radius: r * 1.3, spanDeg: 38, width: stroke * 0.8 },
    { radius: r * 1.62, spanDeg: 30, width: stroke * 0.5 },
  ].map(({ radius, spanDeg, width }) => {
    const span = (spanDeg * Math.PI) / 180;
    const x1 = ballX + radius * Math.cos(-span);
    const y1 = radius * Math.sin(-span);
    const x2 = ballX + radius * Math.cos(span);
    const y2 = radius * Math.sin(span);
    return {
      d: `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      width,
    };
  });

  // Padded view box so round caps and the outer arc are never clipped.
  const pad = stroke;
  const minX = -pad;
  const maxX = ballX + r * 1.62 + pad; // outer arc crosses the baseline at its furthest point
  const halfH = h + pad;
  return {
    ballX,
    ballR: r,
    stroke,
    tracePath,
    traceEnd,
    arcs,
    viewBox: { x: minX, y: -halfH, w: maxX - minX, h: halfH * 2 },
  };
})();
