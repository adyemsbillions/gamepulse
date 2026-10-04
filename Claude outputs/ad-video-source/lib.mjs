// Shared drawing kit for the GamePulse ad: brand tokens, fonts, easing, geometry, icons.
// eslint-disable-next-line import/no-unresolved -- installed by this folder's own package.json
import { GlobalFonts, Path2D } from '@napi-rs/canvas';
import process from 'process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.GP_ROOT || path.resolve(HERE, '../..');

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const DUR = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;

// Brand tokens — mirror src/constants/theme.ts
export const C = {
  ice: '#F4FEFF',
  powder: '#A9C0E0',
  royal: '#0E2F76',
  deep: '#081D4D',
  bright: '#1B4AA8',
  night: '#040B20',
  volt: '#C6FF3D',
  hot: '#FF6B2C',
  text: '#0B1B3F',
  text2: '#5B6B8A',
  muted: '#E6EEF8',
  border: '#D3DFEE',
  white: '#FFFFFF',
  rec: '#FF3B4A',
};

// ---------- fonts ----------
const FD = `${ROOT}/node_modules/@expo-google-fonts/poppins/`;
const FONTS = {
  R: '400Regular', M: '500Medium', SB: '600SemiBold', B: '700Bold',
  XB: '800ExtraBold', BK: '900Black', XBI: '800ExtraBold_Italic', BKI: '900Black_Italic',
};
for (const [k, v] of Object.entries(FONTS)) GlobalFonts.registerFromPath(`${FD}${v}/Poppins_${v}.ttf`, 'P' + k);
export const font = (ctx, w, size) => { ctx.font = `${size}px P${w}`; };

// ---------- math / easing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, s, d) => clamp((t - s) / d);
export const eOut = (x) => 1 - Math.pow(1 - x, 3);
export const eIn = (x) => x * x * x;
export const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const eInExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
export const eOutBack = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const eOutQuad = (x) => 1 - (1 - x) * (1 - x);
/** Damped spring from 0 → 1, `t` in seconds since release. */
export const spring = (t, f = 3.2, z = 0.42) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * f;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};
/** Kick-drum pump: 1 on the beat, decays fast. Only inside [from, to). */
export const beatPump = (t, from = 4, to = 25.5, k = 7) => {
  if (t < from || t >= to) return 0;
  const ph = (t - from) % BEAT;
  return Math.exp(-ph * k);
};

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---------- shapes ----------
export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

// ---------- text ----------
export function textW(ctx, s, track = 0) {
  let w = 0;
  for (const ch of s) w += ctx.measureText(ch).width + track;
  return w - track;
}
/** Draw text with manual letter-spacing. Returns total width. */
export function fillTracked(ctx, s, x, y, track = 0, align = 'center') {
  const w = textW(ctx, s, track);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  ctx.textAlign = prev;
  return w;
}
/** Per-letter animation: fn(i, n) → { dy, alpha, scale, rot }. Baseline at y. */
export function lettersAnim(ctx, s, x, y, track, align, fn, mode = 'fill') {
  const chars = [...s];
  const ws = chars.map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'center';
  const baseAlpha = ctx.globalAlpha;
  chars.forEach((ch, i) => {
    const { dy = 0, alpha = 1, scale = 1, rot = 0, dx = 0 } = fn(i, chars.length) || {};
    if (alpha > 0.001 && scale > 0.001) {
      ctx.save();
      ctx.globalAlpha = baseAlpha * clamp(alpha);
      ctx.translate(cx + ws[i] / 2 + dx, y + dy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      if (mode === 'stroke') ctx.strokeText(ch, 0, 0);
      else ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    cx += ws[i] + track;
  });
  ctx.textAlign = prev;
  return total;
}
/** Largest font size (≤ max) for which `s` fits in `maxW`. */
export function fitSize(ctx, w, s, maxW, max, track = 0) {
  font(ctx, w, max);
  const tw = textW(ctx, s, track * max);
  return tw <= maxW ? max : Math.floor((max * maxW) / tw);
}

// ---------- polyline helpers ----------
export function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
/** Truncate polyline at fraction f of its length. Returns { pts, head }. */
export function polyPartial(pts, f) {
  const L = polyLen(pts) * clamp(f);
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= L) {
      const k = seg ? (L - acc) / seg : 0;
      const hp = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
      out.push(hp);
      return { pts: out, head: hp };
    }
    acc += seg;
    out.push(pts[i]);
  }
  return { pts: out, head: pts[pts.length - 1] };
}
export function strokePoly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

// ---------- brand geometry (mirrors src/components/brand/geometry.ts) ----------
const pentagon = (cx, cy, r, rotDeg) =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rotDeg + 72 * k) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

export const BALL = (() => {
  const c = 50, r = 50;
  const center = pentagon(c, c, r * 0.37, -90);
  const patches = [], seams = [];
  for (let k = 0; k < 5; k++) {
    const ang = -90 + 72 * k;
    const a = (ang * Math.PI) / 180;
    const patch = pentagon(c + r * 0.97 * Math.cos(a), c + r * 0.97 * Math.sin(a), r * 0.27, ang + 180);
    patches.push(patch);
    seams.push([center[k], patch[0]]);
  }
  return { center, patches, seams, seam: r * 0.075 };
})();

export const LOCKUP = (() => {
  const s = 100, r = s * 0.23, traceLen = s * 0.5, ballX = traceLen + r, stroke = s * 0.05;
  const traceEnd = ballX - r * 0.98, h = r * 1.15, w = traceEnd;
  const trace = [[0, 0], [w * 0.26, 0], [w * 0.36, -h * 0.3], [w * 0.46, h * 0.26], [w * 0.58, -h], [w * 0.7, h * 0.55], [w * 0.79, 0], [traceEnd, 0]];
  const arcs = [
    { radius: r * 1.3, span: (38 * Math.PI) / 180, width: stroke * 0.8 },
    { radius: r * 1.62, span: (30 * Math.PI) / 180, width: stroke * 0.5 },
  ];
  const pad = stroke;
  const minX = -pad, maxX = ballX + r * 1.62 + pad, halfH = h + pad;
  return { ballX, ballR: r, stroke, trace, traceEnd, arcs, h, vb: { x: minX, y: -halfH, w: maxX - minX, h: halfH * 2 } };
})();

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** The GamePulse football. (x, y) centre, R radius, rot radians. */
export function drawBall(ctx, x, y, R, rot = 0, { patch = C.royal, face = C.ice } = {}) {
  if (R <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const s = R / 50;
  ctx.scale(s, s);
  ctx.translate(-50, -50);
  ctx.fillStyle = face;
  circle(ctx, 50, 50, 50);
  ctx.fill();
  // a caller's drop shadow belongs to the silhouette only, never to the patches
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.save();
  circle(ctx, 50, 50, 46.25);
  ctx.clip();
  ctx.fillStyle = patch;
  ctx.strokeStyle = patch;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  polyPath(ctx, BALL.center); ctx.fill(); ctx.stroke();
  for (const p of BALL.patches) { polyPath(ctx, p); ctx.fill(); ctx.stroke(); }
  ctx.lineWidth = BALL.seam;
  ctx.lineCap = 'round';
  for (const [a, b] of BALL.seams) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

/** Pulse arcs radiating off a ball at (bx, by) with ball radius R (lockup proportions). */
export function drawArcs(ctx, bx, by, R, color = C.volt, alpha = 1, which = [0, 1]) {
  const u = R / LOCKUP.ballR;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (const i of which) {
    const a = LOCKUP.arcs[i];
    ctx.lineWidth = a.width * u;
    ctx.beginPath();
    ctx.arc(bx, by, a.radius * u, -a.span, a.span);
    ctx.stroke();
  }
  ctx.restore();
}

/** Small "cheer" pulse-ball icon (ball + arcs), centred on the ball. */
export function drawPulseIcon(ctx, x, y, R, rot = 0, { arcs = C.volt, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawArcs(ctx, x, y, R, arcs);
  drawBall(ctx, x, y, R, rot);
  ctx.restore();
}

// ---------- icons (Lucide paths, 24-unit grid) ----------
const ICONS = JSON.parse(fs.readFileSync(path.join(HERE, 'icons.json'), 'utf8'));
const iconCache = {};
export function icon(ctx, name, x, y, size, color, lw = 2, { fill = null } = {}) {
  const paths = iconCache[name] || (iconCache[name] = ICONS[name].map((d) => new Path2D(d)));
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  for (const p of paths) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
    ctx.stroke(p);
  }
  ctx.restore();
}

// ---------- phone mockup ----------
export const PHONE = { w: 572, h: 1196, bezel: 15, r: 84 };
PHONE.sw = PHONE.w - PHONE.bezel * 2;
PHONE.sh = PHONE.h - PHONE.bezel * 2;
PHONE.sr = PHONE.r - PHONE.bezel;

/** Draws the phone centred at (cx, cy); `screen(ctx)` renders into a 0..sw × 0..sh clip. */
export function drawPhone(ctx, cx, cy, scale, rot, screen, { glow = 1 } = {}) {
  const { w, h, bezel, r, sw, sh, sr } = PHONE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);

  // volt halo + drop shadow
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = hexA(C.volt, 0.35 * glow);
    ctx.shadowBlur = 120;
    ctx.fillStyle = C.deep;
    rr(ctx, 0, 0, w, h, r); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 40;
  ctx.fillStyle = '#0A0F1C';
  rr(ctx, 0, 0, w, h, r); ctx.fill();
  ctx.restore();

  // frame rim
  const rim = ctx.createLinearGradient(0, 0, w, h);
  rim.addColorStop(0, '#5C6B8C');
  rim.addColorStop(0.3, '#1A2338');
  rim.addColorStop(0.7, '#111827');
  rim.addColorStop(1, '#4A5878');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 5;
  rr(ctx, 2.5, 2.5, w - 5, h - 5, r - 2); ctx.stroke();
  // side buttons
  ctx.fillStyle = '#1A2338';
  rr(ctx, -5, 250, 7, 90, 3); ctx.fill();
  rr(ctx, -5, 360, 7, 90, 3); ctx.fill();
  rr(ctx, w - 2, 300, 7, 140, 3); ctx.fill();

  // screen
  ctx.save();
  ctx.translate(bezel, bezel);
  rr(ctx, 0, 0, sw, sh, sr);
  ctx.clip();
  screen(ctx);
  // dynamic island
  ctx.fillStyle = '#000';
  rr(ctx, sw / 2 - 64, 16, 128, 38, 19); ctx.fill();
  // glass sheen
  const sheen = ctx.createLinearGradient(0, 0, sw, sh * 0.6);
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();
  ctx.restore();
}

/** Converts a point in screen-local coordinates to canvas coordinates for a phone transform. */
export function phoneToCanvas(px, py, cx, cy, scale, rot) {
  const { w, h, bezel } = PHONE;
  let x = (px + bezel - w / 2) * scale;
  let y = (py + bezel - h / 2) * scale;
  const c = Math.cos(rot), s = Math.sin(rot);
  return [cx + x * c - y * s, cy + x * s + y * c];
}
