// Full-frame scenes + the timeline compositor for the 30 s GamePulse ad (120 BPM, 1 beat = 0.5 s).
//
//  0.0 – 4.0   Heartbeat intro      "EVERY GAME / HAS A PULSE."
//  4.0 – 8.0   Kinetic type         THE SKILLS. / THE GOALS. / THE SCENES. / ALL IN ONE APP.
//  8.0 – 12.0  Phone: Reels feed    SWIPE THROUGH / TOP MOMENTS
// 12.0 – 15.0  Phone: Cheers        DOUBLE-TAP TO / CHEER
// 15.0 – 19.0  Phone: Discover      FIND WHAT'S / HOT NOW
// 19.0 – 23.0  Phone: Create+Post   RECORD & POST / YOUR MOMENTS
// 23.0 – 26.0  Phone: Alerts        GET CHEERED. / GET FANS.
// 26.0 – 30.0  Logo reveal + CTA    FEEL EVERY MOMENT · DOWNLOAD NOW
import {
  W, H, C, clamp, lerp, prog, eOut, eIn, eInOut, eOutExpo, eInExpo, eOutQuad, spring, beatPump, rng, hexA,
  rr, circle, font, fillTracked, textW, lettersAnim, fitSize, strokePoly, icon,
  drawBall, drawArcs, drawPulseIcon, LOCKUP, PHONE, drawPhone, phoneToCanvas,
} from './lib.mjs';
import * as S from './screens.mjs';

// ---------------------------------------------------------------- shared backdrops
function royalBg(ctx, cx = 540, cy = 900, r = 1500) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, C.bright);
  g.addColorStop(0.55, C.royal);
  g.addColorStop(1, C.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

const PARTS = (() => {
  const r = rng(42);
  return Array.from({ length: 50 }, () => ({ x: r() * W, y: r() * H, s: 2 + r() * 5, v: 25 + r() * 70, ph: r() * 6.28, volt: r() < 0.55 }));
})();
function particles(ctx, t, alpha = 1) {
  for (const p of PARTS) {
    const y = (((p.y - t * p.v) % (H + 60)) + H + 60) % (H + 60) - 30;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.ph));
    ctx.fillStyle = hexA(p.volt ? C.volt : C.ice, 0.55 * tw * alpha);
    circle(ctx, p.x + Math.sin(t * 0.7 + p.ph) * 14, y, p.s * 0.6);
    ctx.fill();
  }
}

function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1250);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,8,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Slanted volt band that covers the frame at `tc` and uncovers after. */
function wipe(ctx, t, tc, d = 0.5) {
  const u = prog(t, tc - d / 2, d);
  if (u <= 0 || u >= 1) return;
  const S = 300;
  const lead = u < 0.5 ? lerp(H + S, -S, eIn(u * 2)) : -S;
  const trail = u < 0.5 ? H + S : lerp(H + S, -S, eOut((u - 0.5) * 2));
  const band = (a, b, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, a + S / 2); ctx.lineTo(W, a - S / 2); ctx.lineTo(W, b - S / 2); ctx.lineTo(0, b + S / 2);
    ctx.closePath(); ctx.fill();
  };
  band(lead, trail, C.volt);
  band(lead - 0, Math.min(trail, lead + 26), C.ice);
}

// ---------------------------------------------------------------- 1. heartbeat intro
const ECG = (() => {
  const k = 16, tr = LOCKUP.trace, cx = (tr[1][0] + tr[6][0]) / 2;
  const pts = [[-40, 960]];
  for (let i = 1; i <= 6; i++) pts.push([540 + (tr[i][0] - cx) * k, 960 + tr[i][1] * k]);
  pts.push([1120, 960]);
  return pts;
})();
const SPIKE = ECG[4]; // ≈ (584, 537)
function ecgUpTo(x) {
  const out = [ECG[0]];
  for (let i = 1; i < ECG.length; i++) {
    const [ax, ay] = ECG[i - 1], [bx, by] = ECG[i];
    if (bx <= x) { out.push(ECG[i]); continue; }
    if (ax < x) out.push([x, lerp(ay, by, (x - ax) / (bx - ax))]);
    break;
  }
  return out;
}
export const HEARTBEATS = [0.8, 2.0, 3.0, 3.5, 3.75];

function intro(ctx, t) {
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, H);
  const gl = 0.3 + 0.45 * prog(t, 0.6, 3);
  const g = ctx.createRadialGradient(540, 960, 0, 540, 960, 1000);
  g.addColorStop(0, hexA(C.bright, gl));
  g.addColorStop(1, hexA(C.royal, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  let shake = 0;
  if (t >= 1) shake += 9 * Math.exp(-(t - 1) * 9);
  if (t >= 2) shake += 24 * Math.exp(-(t - 2) * 7);
  let pulse = 0;
  for (const h of HEARTBEATS) if (t >= h) pulse += Math.exp(-(t - h) * 5);
  const z = (1 + 0.07 * eInOut(prog(t, 2.2, 1.5))) * (1 + 7 * eInExpo(prog(t, 3.45, 0.55)));
  ctx.save();
  ctx.translate(SPIKE[0] + Math.sin(t * 93) * shake, SPIKE[1] + Math.cos(t * 71) * shake);
  ctx.scale(z, z);
  ctx.translate(-SPIKE[0], -SPIKE[1]);

  // monitor grid
  ctx.strokeStyle = hexA(C.powder, 0.07 * prog(t, 0, 0.8));
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 90) { ctx.beginPath(); ctx.moveTo(x, -400); ctx.lineTo(x, H + 400); ctx.stroke(); }
  for (let y = -360; y <= H + 360; y += 90) { ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(W + 400, y); ctx.stroke(); }

  // ECG trace
  const headX = lerp(-40, 1120, prog(t, 0.1, 1.3));
  const pts = ecgUpTo(headX);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (pts.length > 1) {
    ctx.save();
    ctx.shadowColor = C.volt;
    ctx.shadowBlur = 30 + 50 * pulse;
    ctx.strokeStyle = C.volt;
    ctx.lineWidth = 13 + 7 * pulse;
    strokePoly(ctx, pts);
    ctx.restore();
    ctx.strokeStyle = '#F4FFDC';
    ctx.lineWidth = 4;
    strokePoly(ctx, pts);
    if (headX < 1120) {
      const [hx, hy] = pts[pts.length - 1];
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 90);
      hg.addColorStop(0, 'rgba(255,255,255,1)');
      hg.addColorStop(0.15, hexA(C.volt, 0.8));
      hg.addColorStop(1, hexA(C.volt, 0));
      ctx.fillStyle = hg;
      circle(ctx, hx, hy, 90); ctx.fill();
    }
  }

  // "EVERY GAME"
  ctx.fillStyle = C.ice;
  const s1 = fitSize(ctx, 'XB', 'EVERY GAME', 960, 150, 0.02);
  font(ctx, 'XB', s1);
  lettersAnim(ctx, 'EVERY GAME', 540, 430, s1 * 0.02, 'center', (i) => {
    const lp = eOutExpo(prog(t, 1.0 + i * 0.03, 0.5));
    return { dy: (1 - lp) * 90, alpha: lp };
  });
  // "HAS A"
  font(ctx, 'SB', 60);
  ctx.fillStyle = C.powder;
  lettersAnim(ctx, 'HAS A', 540, 1340, 22, 'center', (i) => {
    const lp = eOutExpo(prog(t, 2.0 + i * 0.03, 0.45));
    return { dy: (1 - lp) * 50, alpha: lp };
  });
  // "PULSE."
  const s2 = fitSize(ctx, 'XB', 'PULSE.', 980, 260);
  let sc = lerp(2.6, 1, eOutExpo(prog(t, 2.0, 0.32)));
  for (const h of [3.0, 3.5, 3.75]) if (t >= h) sc += 0.06 * Math.exp(-(t - h) * 8);
  const al = prog(t, 2.0, 0.06);
  if (al > 0) {
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(540, 1560 - s2 * 0.36);
    ctx.scale(sc, sc);
    font(ctx, 'XB', s2);
    ctx.textAlign = 'center';
    ctx.shadowColor = C.volt;
    ctx.shadowBlur = 40 + 40 * pulse;
    ctx.fillStyle = C.volt;
    ctx.fillText('PULSE.', 0, s2 * 0.36);
    ctx.restore();
  }
  ctx.restore();
  particles(ctx, t, prog(t, 1, 1) * 0.6);
  const fl = eIn(prog(t, 3.7, 0.3));
  if (fl > 0) { ctx.fillStyle = `rgba(244,254,255,${fl})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- 2. kinetic type
const WORDS = [
  { t: 4, top: 'THE', word: 'SKILLS.', bg: 'royal', fg: C.volt, sub: C.ice },
  { t: 5, top: 'THE', word: 'GOALS.', bg: C.volt, fg: C.royal, sub: C.royal },
  { t: 6, top: 'THE', word: 'SCENES.', bg: C.deep, fg: C.ice, sub: C.volt },
  { t: 7, top: 'ALL IN', word: 'ONE APP.', bg: 'royal', fg: C.volt, sub: C.ice },
];

function flyBall(ctx, lt, from, to, t0, d, R, trailCol) {
  const u = prog(lt, t0, d);
  if (u <= 0 || u >= 1) return;
  const pos = (uu) => [lerp(from[0], to[0], uu), lerp(from[1], to[1], uu) - Math.sin(Math.PI * uu) * 160];
  for (let k = 6; k >= 1; k--) {
    const uu = clamp(u - k * 0.03);
    const [x, y] = pos(uu);
    ctx.fillStyle = hexA(trailCol, 0.22 * (1 - k / 7));
    circle(ctx, x, y, R * (1 - k * 0.06)); ctx.fill();
  }
  const [x, y] = pos(u);
  drawBall(ctx, x, y, R, u * 14);
}

function kinetic(ctx, t) {
  const i = clamp(Math.floor(t - 4), 0, 3);
  const w = WORDS[i];
  const lt = t - w.t;
  if (w.bg === 'royal') royalBg(ctx, 540, 1000, 1300);
  else { ctx.fillStyle = w.bg; ctx.fillRect(0, 0, W, H); }

  const shake = (1 - prog(lt, 0, 0.25)) * 16;
  ctx.save();
  ctx.translate(Math.sin(lt * 120) * shake, Math.cos(lt * 97) * shake);

  // sunburst
  ctx.save();
  ctx.translate(540, 1000);
  ctx.rotate(t * 0.25 + i);
  ctx.fillStyle = hexA(w.fg, 0.07);
  for (let k = 0; k < 16; k++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1600, -150); ctx.lineTo(1600, 150); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // marquee rows of outline text
  font(ctx, 'XBI', 190);
  ctx.strokeStyle = hexA(w.fg, 0.16);
  ctx.lineWidth = 3;
  const base = w.word.replace('.', '') + '   ';
  const mw = textW(ctx, base);
  for (let r = 0; r < 5; r++) {
    const y = 200 + r * 400;
    const dir = r % 2 ? 1 : -1;
    const off = (((dir * t * 420 + r * 300) % mw) + mw) % mw;
    for (let x = -mw + off - mw; x < W + mw; x += mw) ctx.strokeText(base, x, y);
  }

  // sporty diagonal stripes
  const sp = eOutExpo(prog(lt, 0, 0.5));
  ctx.save();
  ctx.translate(540, 1000);
  ctx.rotate(-0.35);
  ctx.fillStyle = hexA(w.sub, 0.9);
  ctx.fillRect(-900 + (1 - sp) * -1200, 330, 1800, 14);
  ctx.fillRect(-900 + (1 - sp) * 1200, 362, 1800, 6);
  ctx.fillRect(-900 + (1 - sp) * 1200, -420, 1800, 10);
  ctx.restore();

  // per-word flourishes
  if (i === 0) flyBall(ctx, lt, [-160, 1600], [1260, 420], 0.05, 0.55, 110, C.ice);
  if (i === 1) flyBall(ctx, lt, [1260, 1580], [-200, 640], 0.08, 0.55, 120, C.royal);
  if (i === 2) {
    const r = rng(9);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + r() * 0.3, d = (380 + r() * 420) * eOutExpo(prog(lt, 0.02, 0.7));
      const al = 1 - prog(lt, 0.55, 0.4);
      drawPulseIcon(ctx, 540 + Math.cos(a) * d, 1000 + Math.sin(a) * d * 1.3, 34 + r() * 30, lt * 4 + k, { alpha: al });
    }
  }
  if (i === 3) {
    const u = eOutExpo(prog(lt, 0.25, 0.6));
    const py = lerp(H + 120, 1480, u);
    ctx.save();
    ctx.strokeStyle = hexA(C.volt, 0.9);
    ctx.lineWidth = 8;
    ctx.shadowColor = C.volt; ctx.shadowBlur = 30;
    rr(ctx, 540 - 230, py, 460, 960, 70); ctx.stroke();
    ctx.restore();
    drawPulseIcon(ctx, 540, py + 220, 70 * u, lt * 2);
  }

  // main word with echo outlines
  const size = fitSize(ctx, 'XBI', w.word, 960, 260);
  let sc = lerp(1.6, 1, eOutExpo(prog(lt, 0, 0.28)));
  if (lt > 0.5) sc += 0.05 * Math.exp(-(lt - 0.5) * 9);
  const cy = 1000;
  font(ctx, 'XBI', size);
  ctx.textAlign = 'center';
  for (let k = 3; k >= 1; k--) {
    const a = 0.55 * (1 - k * 0.25) * (1 - prog(lt, 0.05, 0.7));
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(540, cy);
    const s2 = sc * (1 + k * 0.1 * eOut(prog(lt, 0.02, 0.5)));
    ctx.scale(s2, s2);
    ctx.strokeStyle = w.fg;
    ctx.lineWidth = 3;
    ctx.strokeText(w.word, 0, size * 0.36);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(540, cy);
  ctx.scale(sc, sc);
  if (w.fg === C.volt) { ctx.shadowColor = hexA(C.volt, 0.6); ctx.shadowBlur = 40; }
  ctx.fillStyle = w.fg;
  ctx.globalAlpha = prog(lt, 0, 0.04);
  ctx.fillText(w.word, 0, size * 0.36);
  ctx.restore();

  // top word
  const ta = eOutExpo(prog(lt, 0.04, 0.4));
  ctx.save();
  ctx.globalAlpha = ta;
  font(ctx, 'B', 66);
  ctx.fillStyle = w.sub;
  fillTracked(ctx, w.top, 540 - (1 - ta) * 180, cy - size * 0.5 - 40, 24, 'center');
  ctx.restore();
  // underline
  const ul = eOutExpo(prog(lt, 0.1, 0.4));
  ctx.fillStyle = w.sub;
  rr(ctx, 540 - 170 * ul, cy + size * 0.36 + 60, 340 * ul, 12, 6); ctx.fill();
  ctx.restore();

  const fl = 1 - prog(lt, 0, 0.09);
  if (fl > 0 && t > 4.05) { ctx.fillStyle = hexA(C.ice, 0.4 * fl); ctx.fillRect(0, 0, W, H); }
  if (t < 4.3) { ctx.fillStyle = `rgba(244,254,255,${1 - eOut(prog(t, 4, 0.3))})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- 3. phone scenes
const PSW = PHONE.sw, PSH = PHONE.sh;
const CHEERS = [
  { t: 12.5, x: 0.42, y: 0.42 }, { t: 13.0, x: 0.62, y: 0.35 }, { t: 13.5, x: 0.36, y: 0.56 },
  { t: 13.75, x: 0.64, y: 0.5 }, { t: 14.0, x: 0.5, y: 0.3 }, { t: 14.25, x: 0.44, y: 0.62 },
];
export const CHEER_TIMES = CHEERS.map((c) => c.t);

function reels(c, t) {
  const u = eInOut(prog(t, 10.3, 0.4));
  if (u < 1) {
    c.save();
    c.translate(0, -u * PSH);
    S.videoNight(c, PSW, PSH, t - 8);
    S.reelUI(c, PSW, PSH, S.REELS.a, { progress: (t - 8) / 3, t });
    c.restore();
  }
  if (u > 0) {
    c.save();
    c.translate(0, (1 - u) * PSH);
    S.videoSunset(c, PSW, PSH, t);
    const n = CHEERS.filter((x) => t >= x.t).length;
    let pop = 0;
    for (const x of CHEERS) if (t >= x.t) pop += Math.exp(-(t - x.t) * 9);
    const count = 34120 + Math.floor(870 * eOut(prog(t, 12.5, 2.4)));
    S.reelUI(c, PSW, PSH, S.REELS.b, { cheered: n ? 1 : 0, cheerCount: count, pop: Math.min(pop, 1.2), progress: (t - 10.3) / 4.8, t });
    CHEERS.forEach((x, k) => {
      const px = x.x * PSW, py = x.y * PSH;
      S.tapRipple(c, px, py, t, x.t - 0.14);
      S.tapRipple(c, px, py, t, x.t - 0.02);
      S.cheerBurst(c, px, py, t, x.t, k + 3);
    });
    c.restore();
  }
  S.statusBar(c, PSW, true);
  S.tabBar(c, PSW, PSH, 0, true);
  // swipe-up gesture
  const sg = prog(t, 10.05, 0.5);
  if (sg > 0 && sg < 1) {
    c.fillStyle = `rgba(255,255,255,${0.55 * Math.sin(Math.PI * sg)})`;
    circle(c, PSW * 0.55, lerp(PSH * 0.72, PSH * 0.3, eInOut(sg)), 34); c.fill();
  }
  S.tapRipple(c, (PSW * 1.5) / 5, PSH - S.TAB_H + 35, t, 14.78);
}

const SEGS = [
  { from: 8, to: 15.4, enter: null, draw: reels },
  { from: 14.95, to: 19.45, enter: 'x', draw: (c, t) => {
    S.discoverScreen(c, PSW, PSH, t - 14.95);
    S.tapRipple(c, (PSW * 2.5) / 5, PSH - S.TAB_H + 35, t, 18.78);
  } },
  { from: 19.0, to: 21.4, enter: 'up', draw: (c, t) => {
    S.cameraScreen(c, PSW, PSH, t);
    S.tapRipple(c, PSW / 2, PSH - 150, t, S.CAM.tapRec);
    S.tapRipple(c, PSW / 2, PSH - 150, t, S.CAM.recEnd);
  } },
  { from: 21.0, to: 23.4, enter: 'x', draw: (c, t) => {
    S.postScreen(c, PSW, PSH, t);
    S.tapRipple(c, PSW / 2, PSH - 154, t, S.POST.tap - 0.04, hexA(C.volt, 0.9));
  } },
  { from: 23.0, to: 26.2, enter: 'x', draw: (c, t) => S.alertsScreen(c, PSW, PSH, t) },
];

function screenContent(c, t) {
  for (const seg of SEGS) {
    if (t < seg.from || t >= seg.to) continue;
    const u = eOutExpo(prog(t, seg.from, 0.42));
    c.save();
    if (seg.enter === 'x' && u < 1) {
      c.translate((1 - u) * PSW, 0);
      c.shadowColor = 'rgba(0,0,0,0.4)';
      c.shadowBlur = 40;
      c.fillStyle = '#000';
      c.fillRect(0, 0, PSW, PSH);
      c.shadowBlur = 0;
    } else if (seg.enter === 'up' && u < 1) {
      c.translate(0, (1 - u) * PSH);
    }
    seg.draw(c, t);
    c.restore();
  }
  // dissolve into the logo backdrop as the camera dives into the screen
  const d = eIn(prog(t, 25.5, 0.45));
  if (d > 0) {
    const g = c.createRadialGradient(PSW / 2, PSH / 2, 0, PSW / 2, PSH / 2, PSH * 0.6);
    g.addColorStop(0, hexA(C.bright, d));
    g.addColorStop(1, hexA(C.royal, d));
    c.fillStyle = g;
    c.fillRect(0, 0, PSW, PSH);
  }
}

const HEADS = [
  { from: 8.3, to: 11.95, top: 'SWIPE THROUGH', big: 'TOP MOMENTS' },
  { from: 12.0, to: 14.95, top: 'DOUBLE-TAP TO', big: 'CHEER' },
  { from: 15.0, to: 18.95, top: "FIND WHAT'S", big: 'HOT NOW' },
  { from: 19.0, to: 22.95, top: 'RECORD & POST', big: 'YOUR MOMENTS' },
  { from: 23.0, to: 25.45, top: 'GET CHEERED.', big: 'GET FANS.' },
];
function headline(ctx, t) {
  for (const h of HEADS) {
    if (t < h.from || t > h.to) continue;
    const inA = eOutExpo(prog(t, h.from, 0.45));
    const outA = eIn(prog(t, h.to - 0.22, 0.22));
    ctx.save();
    ctx.globalAlpha = inA * (1 - outA);
    font(ctx, 'SB', 42);
    ctx.fillStyle = C.ice;
    fillTracked(ctx, h.top, 540, 322 + (1 - inA) * 40 - outA * 40, 9, 'center');
    ctx.restore();
    const size = fitSize(ctx, 'XB', h.big, 990, 132, 0.01);
    font(ctx, 'XB', size);
    ctx.save();
    ctx.fillStyle = C.volt;
    ctx.shadowColor = hexA(C.volt, 0.45);
    ctx.shadowBlur = 30;
    lettersAnim(ctx, h.big, 540, 470, size * 0.01, 'center', (i) => {
      const lp = eOutExpo(prog(t, h.from + 0.05 + i * 0.025, 0.45));
      return { dy: (1 - lp) * 80 - outA * 60, alpha: lp * (1 - outA), scale: 0.9 + 0.1 * lp };
    });
    ctx.restore();
  }
}

function miniLogo(ctx, x, y, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  font(ctx, 'XB', 34);
  const tr = 5;
  const wG = textW(ctx, 'GAME', tr), wP = textW(ctx, 'PULSE', tr);
  const R = 24, gap = 26;
  const total = R * 2 + 30 + gap + wG + tr + wP;
  let x0 = x - total / 2;
  drawArcs(ctx, x0 + R, y, R, C.volt);
  drawBall(ctx, x0 + R, y, R, 0);
  x0 += R * 2 + 30 + gap;
  ctx.fillStyle = C.ice;
  fillTracked(ctx, 'GAME', x0, y + 12, tr, 'left');
  ctx.fillStyle = C.volt;
  fillTracked(ctx, 'PULSE', x0 + wG + tr, y + 12, tr, 'left');
  ctx.restore();
}

const ECG_BG = (() => {
  const k = 9, tr = LOCKUP.trace;
  return tr.slice(1, 7).map(([x, y]) => [(x - tr[1][0]) * k, y * k]);
})();
function ecgBand(ctx, t, y, alpha) {
  const unit = ECG_BG[ECG_BG.length - 1][0];
  const period = unit + 340;
  const off = -((t * 260) % period);
  const pts = [];
  for (let x0 = off - period; x0 < W + period; x0 += period) {
    pts.push([x0, y]);
    for (const [px, py] of ECG_BG) pts.push([x0 + 170 + px, y + py]);
    pts.push([x0 + period, y]);
  }
  ctx.save();
  ctx.strokeStyle = hexA(C.volt, alpha);
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.shadowColor = hexA(C.volt, alpha);
  ctx.shadowBlur = 24;
  strokePoly(ctx, pts);
  ctx.restore();
}

/** Floating chip: pill with optional leading glyph. Scales in with a spring from `t0`. */
function chip(ctx, t, t0, t1, x, y, { text, sub, glyph, dark = false, size = 34, fromX, fromY }) {
  if (t < t0 || t > t1 + 0.3) return;
  const sp = spring(t - t0, 2.4, 0.5);
  const out = eIn(prog(t, t1, 0.25));
  const s = sp * (1 - out);
  if (s <= 0.01) return;
  const bob = Math.sin(t * 2.4 + x * 0.01) * 8;
  const px = fromX != null ? lerp(fromX, x, clamp(sp)) : x;
  const py = (fromY != null ? lerp(fromY, y, clamp(sp)) : y) + bob;
  font(ctx, 'B', size);
  const tw = ctx.measureText(text).width;
  font(ctx, 'M', size * 0.62);
  const sw2 = sub ? ctx.measureText(sub).width + 14 : 0;
  const gw = glyph ? size * 1.5 : 0;
  const w = tw + sw2 + gw + size * 1.2, h = size * 2.1;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 1.7 + x) * 0.03);
  ctx.shadowColor = 'rgba(0,0,20,0.35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = dark ? C.royal : C.ice;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (dark) { ctx.strokeStyle = hexA(C.volt, 0.8); ctx.lineWidth = 3; ctx.stroke(); }
  let cx = -w / 2 + size * 0.6;
  if (glyph) { glyph(ctx, cx + size * 0.6, 0, size * 0.62); cx += gw; }
  font(ctx, 'B', size);
  ctx.fillStyle = dark ? C.ice : C.royal;
  ctx.textAlign = 'left';
  ctx.fillText(text, cx, size * 0.36);
  if (sub) {
    font(ctx, 'M', size * 0.62);
    ctx.fillStyle = dark ? C.powder : C.text2;
    ctx.fillText(sub, cx + tw + 14, size * 0.3);
  }
  ctx.restore();
}
const gPulse = (ctx, x, y, r) => drawPulseIcon(ctx, x - r * 0.15, y, r * 0.75, 0.3);
const gFlame = (ctx, x, y, r) => icon(ctx, 'flame', x, y, r * 1.7, C.hot, 2.4, { fill: hexA(C.hot, 0.3) });
const gPlay = (ctx, x, y, r) => { ctx.fillStyle = C.royal; circle(ctx, x, y, r); ctx.fill(); icon(ctx, 'play', x + 2, y, r * 1.1, C.ice, 2.4, { fill: C.ice }); };
const gRec = (ctx, x, y, r) => { ctx.fillStyle = C.rec; circle(ctx, x, y, r * 0.55); ctx.fill(); };
const gFans = (ctx, x, y, r) => { ctx.fillStyle = C.volt; circle(ctx, x, y, r); ctx.fill(); icon(ctx, 'users-round', x, y, r * 1.2, C.royal, 2.6); };

/** Pulse balls that burst out of the phone and past its edges. */
function frameBreakers(ctx, t, bursts, phone) {
  for (const b of bursts) {
    const lt = t - b.t;
    if (lt < 0 || lt > 1.4) continue;
    const [ox, oy] = phoneToCanvas(b.x, b.y, ...phone);
    const r = rng(Math.round(b.t * 1000));
    for (let k = 0; k < b.n; k++) {
      const vx = (r() - 0.5) * 1300, vy = -650 - r() * 700, R = 26 + r() * 30;
      const x = ox + vx * lt, y = oy + vy * lt + 0.5 * 1900 * lt * lt;
      const al = 1 - prog(lt, 0.8, 0.6);
      drawPulseIcon(ctx, x, y, R * spring(lt, 3, 0.5), lt * (vx > 0 ? 6 : -6), { alpha: al });
    }
  }
}

function phoneScene(ctx, t) {
  royalBg(ctx, 540, 1000, 1500);
  ctx.save();
  ctx.globalAlpha = 0.05;
  drawBall(ctx, 980, 430, 360, t * 0.15);
  drawBall(ctx, 60, 1760, 300, -t * 0.12);
  ctx.restore();
  ecgBand(ctx, t, 1230, 0.16);
  particles(ctx, t);
  ctx.fillStyle = hexA(C.volt, 0.04 * beatPump(t));
  ctx.fillRect(0, 0, W, H);

  // phone transform
  const ent = spring(t - 8.05, 1.5, 0.6);
  let cy = 1212 + (1 - ent) * 1500 + Math.sin(t * 1.4) * 6;
  let rot = (1 - ent) * 0.35 + Math.sin(t * 0.9) * 0.012;
  let scale = (0.85 + 0.15 * ent) * (1 + beatPump(t) * 0.006);
  const zEnd = eInExpo(prog(t, 25.45, 0.55));
  cy = lerp(cy, 960, zEnd);
  scale = lerp(scale, 3.6, zEnd);
  rot = lerp(rot, 0, zEnd);
  const phone = [540, cy, scale, rot];

  const uiA = 1 - eIn(prog(t, 25.35, 0.3));
  ctx.save();
  ctx.globalAlpha = uiA;
  miniLogo(ctx, 540, 150, eOut(prog(t, 8.4, 0.5)));
  headline(ctx, t);
  ctx.restore();

  drawPhone(ctx, ...phone, (c) => screenContent(c, t), { glow: 1 - zEnd });

  // front-layer motion graphics
  if (uiA > 0) {
    ctx.save();
    ctx.globalAlpha = uiA;
    // feed callouts
    chip(ctx, t, 9.0, 11.7, 215, 880, { text: '1.9M', sub: 'views', glyph: gPlay });
    chip(ctx, t, 9.62, 11.75, 865, 1180, { text: '+128K', sub: 'cheers', glyph: gPulse, dark: true });
    chip(ctx, t, 10.9, 11.8, 230, 1500, { text: '#golazo', glyph: gFlame });
    // cheers
    frameBreakers(ctx, t, CHEERS.map((c) => ({ t: c.t + 0.05, x: c.x * PSW, y: c.y * PSH, n: 2 })), phone);
    if (t > 12.3 && t < 15.2) {
      const n = 34120 + Math.floor(870 * eOut(prog(t, 12.5, 2.4)));
      let bump = 0;
      for (const x of CHEERS) if (t >= x.t) bump += Math.exp(-(t - x.t) * 10) * 0.08;
      ctx.save();
      ctx.translate(250, 1600);
      ctx.scale(1 + bump, 1 + bump);
      chip(ctx, t, 12.35, 14.85, 0, 0, { text: S.fmtInt(n), sub: 'cheers', glyph: gPulse, dark: true, size: 40 });
      ctx.restore();
    }
    // hot hashtags fly out of the phone
    const [hx, hy] = phoneToCanvas(PSW * 0.3, 320, ...phone);
    const HOTPOS = [[215, 780], [870, 900], [230, 1290], [880, 1430], [215, 1700]];
    S.HOT.forEach(([tag, n], k) => {
      chip(ctx, t, 15.35 + k * 0.12, 18.75, HOTPOS[k][0], HOTPOS[k][1], {
        text: tag, sub: n, glyph: k === 0 ? gFlame : null, dark: k % 2 === 1, size: 32, fromX: hx, fromY: hy,
      });
    });
    // record + posted
    if (t >= S.CAM.recStart && t < S.CAM.recEnd + 0.3) {
      const sec = Math.floor(prog(t, S.CAM.recStart, S.CAM.recEnd - S.CAM.recStart) * 15);
      chip(ctx, t, S.CAM.recStart, S.CAM.recEnd, 880, 820, { text: 'REC', sub: `00:${String(sec).padStart(2, '0')}`, glyph: gRec, dark: true, size: 34 });
    }
    frameBreakers(ctx, t, [{ t: S.POST.done, x: PSW / 2, y: PSH * 0.42, n: 12 }], phone);
    // alerts
    const fans = Math.floor(12480 * eOut(prog(t, 23.35, 2.0)));
    chip(ctx, t, 23.3, 25.3, 855, 1560, { text: S.fmtInt(fans), sub: 'fans', glyph: gFans, size: 42 });
    chip(ctx, t, 24.32, 25.3, 225, 860, { text: 'Trending', sub: '#golazo', glyph: gFlame, size: 32 });
    chip(ctx, t, 25.0, 25.35, 215, 1250, { text: '+1,204', sub: 'cheers', glyph: gPulse, dark: true, size: 34 });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- 4. logo reveal (mirrors AnimatedSplash)
export const LOGO_T0 = 26.0;
function logoScene(ctx, t) {
  const lt = t - LOGO_T0;
  royalBg(ctx, 540, 820, 1500);
  ctx.save();
  ctx.translate(540, 780);
  ctx.rotate(t * 0.06);
  ctx.fillStyle = hexA(C.volt, 0.035);
  for (let k = 0; k < 18; k++) {
    ctx.rotate((Math.PI * 2) / 18);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1800, -120); ctx.lineTo(1800, 120); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  particles(ctx, t);

  const vb = LOCKUP.vb;
  const LW = 860, u = LW / vb.w, cx = 540, cy = 780;
  const X = (x) => cx + (x - (vb.x + vb.w / 2)) * u;
  const Y = (y) => cy + y * u;
  const R = LOCKUP.ballR * u;
  const ballX = X(LOCKUP.ballX);
  const startDX = cx - ballX;
  const s0 = 1.3;
  // lub-dub, then kick-roll
  let sc;
  if (lt < 0.11) sc = lerp(s0, s0 * 1.14, eOut(prog(lt, 0, 0.11)));
  else if (lt < 0.21) sc = lerp(s0 * 1.14, s0 * 0.95, prog(lt, 0.11, 0.1));
  else if (lt < 0.31) sc = lerp(s0 * 0.95, s0 * 1.08, eOut(prog(lt, 0.21, 0.1)));
  else if (lt < 0.46) sc = lerp(s0 * 1.08, s0, prog(lt, 0.31, 0.15));
  else sc = lerp(s0, 1, eOut(prog(lt, 0.48, 0.54)));
  for (const hb of [2.0, 3.0]) if (lt >= hb) sc *= 1 + 0.05 * Math.exp(-(lt - hb) * 8) * Math.sin(Math.min(Math.PI, (lt - hb) * 20));
  const roll = eOut(prog(lt, 0.48, 0.54));
  const bx = ballX + startDX * (1 - roll);
  const rot = (-startDX * roll) / R;

  // trace (revealed behind the rolling ball)
  const revealW = (LOCKUP.traceEnd - vb.x) * u + LOCKUP.stroke * u;
  if (roll > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(vb.x), 0, revealW * roll, H);
    ctx.clip();
    const pts = LOCKUP.trace.map(([x, y]) => [X(x), Y(y)]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.volt;
    ctx.lineWidth = LOCKUP.stroke * u;
    ctx.save();
    ctx.shadowColor = hexA(C.volt, 0.7);
    ctx.shadowBlur = 40;
    strokePoly(ctx, pts);
    ctx.restore();
    strokePoly(ctx, pts);
    ctx.restore();
  }
  // arcs + echo
  const ar = spring(lt - 0.96, 2.9, 0.35);
  if (ar > 0) {
    ctx.save();
    ctx.translate(ballX, cy);
    const as = 0.7 + 0.3 * ar;
    ctx.scale(as, as);
    let glow = 0;
    for (const hb of [2.0, 3.0]) if (lt >= hb) glow += Math.exp(-(lt - hb) * 5);
    ctx.shadowColor = C.volt;
    ctx.shadowBlur = 20 + 40 * glow;
    drawArcs(ctx, 0, 0, R, C.volt, clamp(ar));
    ctx.restore();
  }
  for (const [e0, d] of [[0.96, 0.7], [2.0, 0.8], [3.0, 0.8]]) {
    const e = eOutQuad(prog(lt, e0, d));
    if (e <= 0 || e >= 1) continue;
    ctx.strokeStyle = hexA(C.ice, (1 - e) * 0.7);
    ctx.lineWidth = 6;
    circle(ctx, ballX, cy, R * (1 + e * 1.6)); ctx.stroke();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,20,0.4)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  drawBall(ctx, bx, cy, R * sc, rot);
  ctx.restore();

  // wordmark + tagline
  const wa = eOut(prog(lt, 1.06, 0.38));
  if (wa > 0) {
    ctx.save();
    ctx.globalAlpha = wa;
    font(ctx, 'XB', 106);
    const tr = 106 * 0.14;
    const wG = textW(ctx, 'GAME', tr), wP = textW(ctx, 'PULSE', tr);
    const x0 = 540 - (wG + tr + wP) / 2;
    const y = cy + (vb.h / 2) * u + 125 + (1 - wa) * 20;
    ctx.fillStyle = C.ice;
    fillTracked(ctx, 'GAME', x0, y, tr, 'left');
    ctx.fillStyle = C.volt;
    fillTracked(ctx, 'PULSE', x0 + wG + tr, y, tr, 'left');
    ctx.restore();
  }
  const ta = eOut(prog(lt, 1.22, 0.38));
  if (ta > 0) {
    ctx.save();
    ctx.globalAlpha = ta;
    font(ctx, 'SB', 34);
    ctx.fillStyle = C.powder;
    fillTracked(ctx, 'FEEL EVERY MOMENT', 540, cy + (vb.h / 2) * u + 205 + (1 - ta) * 14, 14, 'center');
    ctx.restore();
  }
  // CTA
  const ca = spring(lt - 1.75, 2.6, 0.45);
  if (ca > 0) {
    ctx.save();
    ctx.translate(540, 1450);
    ctx.scale(0.6 + 0.4 * ca, 0.6 + 0.4 * ca);
    ctx.globalAlpha = clamp(ca * 1.5);
    const bw = 620, bh = 128;
    ctx.shadowColor = hexA(C.volt, 0.55);
    ctx.shadowBlur = 50;
    ctx.fillStyle = C.volt;
    rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.shadowBlur = 0;
    const sh = prog(lt, 2.4, 0.6);
    if (sh > 0 && sh < 1) {
      ctx.save();
      rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.clip();
      ctx.translate(lerp(-bw, bw, eInOut(sh)), 0);
      ctx.rotate(0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-40, -200, 80, 400);
      ctx.restore();
    }
    font(ctx, 'XB', 46);
    ctx.fillStyle = C.royal;
    fillTracked(ctx, 'DOWNLOAD NOW', 0, 16, 3, 'center');
    ctx.restore();
  }
  const sa = eOut(prog(lt, 2.0, 0.4));
  if (sa > 0) {
    ctx.save();
    ctx.globalAlpha = sa;
    font(ctx, 'M', 30);
    ctx.fillStyle = C.powder;
    ctx.textAlign = 'center';
    ctx.fillText('Now on iOS & Android', 540, 1600 + (1 - sa) * 12);
    ctx.restore();
  }
  const fl = Math.exp(-lt * 6);
  ctx.fillStyle = `rgba(244,254,255,${0.55 * fl})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- compositor
export function renderFrame(ctx, t) {
  ctx.save();
  if (t < 4) intro(ctx, t);
  else if (t < 8) kinetic(ctx, t);
  else if (t < LOGO_T0) phoneScene(ctx, t);
  else logoScene(ctx, t);
  wipe(ctx, t, 8.0, 0.5);
  vignette(ctx);
  ctx.restore();
}
