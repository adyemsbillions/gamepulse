// In-phone UI: status bar, tab bar, Reels overlay, Discover, Camera, Post, Alerts — plus the
// illustrated "video" clips that play inside the Reels. All coordinates are screen-local.
import {
  C, clamp, lerp, prog, eOut, eIn, eInOut, eOutExpo, eOutBack, spring, rng, hexA,
  rr, circle, font, textW, icon, drawBall, drawArcs, drawPulseIcon, strokePoly, PHONE,
} from './lib.mjs';

export const TAB_H = 112;
const TABS = [['house', 'Reels'], ['compass', 'Discover'], ['plus', 'Create'], ['bell', 'Alerts'], ['user-round', 'Profile']];

export const fmtK = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n);
export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------- chrome
export function statusBar(ctx, sw, dark) {
  const col = dark ? C.ice : C.text;
  ctx.save();
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  font(ctx, 'SB', 24);
  ctx.textAlign = 'left';
  ctx.fillText('9:41', 54, 47);
  const x0 = sw - 156;
  for (let i = 0; i < 4; i++) { rr(ctx, x0 + i * 9, 42 - (7 + i * 4), 6, 7 + i * 4, 1.5); ctx.fill(); }
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  const wx = sw - 101, wy = 44;
  for (const r of [4, 10, 16]) { ctx.beginPath(); ctx.arc(wx, wy, r, -Math.PI * 0.76, -Math.PI * 0.24); ctx.stroke(); }
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  rr(ctx, sw - 78, 29, 38, 19, 6); ctx.stroke();
  ctx.globalAlpha = 1;
  rr(ctx, sw - 75, 32, 28, 13, 3.5); ctx.fill();
  rr(ctx, sw - 38, 35, 3, 7, 1.5); ctx.fill();
  ctx.restore();
}

export function tabBar(ctx, sw, sh, active, dark, { badge = 0, tapT = -1 } = {}) {
  const y0 = sh - TAB_H;
  ctx.save();
  if (dark) {
    const g = ctx.createLinearGradient(0, y0 - 30, 0, sh);
    g.addColorStop(0, 'rgba(4,11,32,0)');
    g.addColorStop(0.35, 'rgba(4,11,32,0.78)');
    g.addColorStop(1, 'rgba(4,11,32,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0 - 30, sw, TAB_H + 30);
  } else {
    ctx.fillStyle = C.white;
    ctx.fillRect(0, y0, sw, TAB_H);
    ctx.fillStyle = C.border;
    ctx.fillRect(0, y0, sw, 1.5);
  }
  TABS.forEach(([name, label], i) => {
    const x = (sw * (i + 0.5)) / 5;
    const on = i === active;
    const idle = dark ? 'rgba(244,254,255,0.78)' : C.text2;
    const col = on ? (dark ? C.volt : C.royal) : idle;
    if (i === 2) {
      ctx.fillStyle = dark ? C.ice : C.royal;
      rr(ctx, x - 33, y0 + 14, 66, 42, 15); ctx.fill();
      icon(ctx, 'plus', x, y0 + 35, 28, dark ? C.royal : C.ice, 2.8);
    } else {
      icon(ctx, name, x, y0 + 35, 30, col, on ? 2.4 : 1.9);
    }
    font(ctx, on ? 'SB' : 'M', 15);
    ctx.fillStyle = i === 2 ? idle : col;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y0 + 80);
    if (i === 3 && badge > 0) {
      ctx.fillStyle = C.hot;
      circle(ctx, x + 14, y0 + 20, 11 * badge); ctx.fill();
      if (badge > 0.6) {
        font(ctx, 'B', 13);
        ctx.fillStyle = C.white;
        ctx.fillText('6', x + 14, y0 + 25);
      }
    }
  });
  ctx.fillStyle = dark ? 'rgba(244,254,255,0.85)' : 'rgba(11,27,63,0.85)';
  rr(ctx, sw / 2 - 70, sh - 13, 140, 5, 3); ctx.fill();
  ctx.restore();
}

/** Finger-tap ripple at (x, y) that started at `t0`. */
export function tapRipple(ctx, x, y, t, t0, color = 'rgba(255,255,255,0.9)') {
  const u = prog(t, t0, 0.45);
  if (u <= 0 || u >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  circle(ctx, x, y, 26 * (0.6 + 0.4 * eOut(u))); ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  circle(ctx, x, y, 26 + 46 * eOut(u)); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- people (silhouettes)
function figure(ctx, x, footY, h, { kit = '#1A2A5A', shorts = '#0B1022', skin = '#5A3B28', arms = 0, rot = 0, lift = 0 } = {}) {
  ctx.save();
  ctx.translate(x, footY - lift);
  ctx.rotate(rot);
  ctx.lineCap = 'round';
  ctx.fillStyle = shorts;
  rr(ctx, -0.12 * h, -0.46 * h, 0.1 * h, 0.46 * h, 0.04 * h); ctx.fill();
  rr(ctx, 0.02 * h, -0.46 * h, 0.1 * h, 0.46 * h, 0.04 * h); ctx.fill();
  rr(ctx, -0.15 * h, -0.56 * h, 0.3 * h, 0.14 * h, 0.03 * h); ctx.fill();
  ctx.fillStyle = kit;
  rr(ctx, -0.16 * h, -0.83 * h, 0.32 * h, 0.3 * h, 0.07 * h); ctx.fill();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 0.075 * h;
  const ay = -0.78 * h;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.15 * h, ay);
    const hx = s * lerp(0.2, 0.34, arms) * h, hy = lerp(-0.5, -1.02, arms) * h;
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }
  ctx.fillStyle = skin;
  circle(ctx, 0, -0.93 * h, 0.085 * h); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- video: night free-kick
const NIGHT = { kick: 1.1, hit: 1.62 };
export function videoNight(ctx, sw, sh, lt) {
  const sinceHit = lt - NIGHT.hit;
  ctx.save();
  const z = 1.02 + 0.05 * clamp(lt / 3);
  let shx = 0, shy = 0;
  if (sinceHit > 0) {
    const a = 9 * Math.exp(-sinceHit * 5);
    shx = Math.sin(lt * 70) * a;
    shy = Math.cos(lt * 83) * a;
  }
  ctx.translate(sw / 2 + shx, sh * 0.45 + shy);
  ctx.scale(z, z);
  ctx.translate(-sw / 2, -sh * 0.45);

  const yp = sh * 0.4;
  let g = ctx.createLinearGradient(0, 0, 0, yp);
  g.addColorStop(0, '#020816');
  g.addColorStop(1, '#0B1E4A');
  ctx.fillStyle = g;
  ctx.fillRect(-60, -60, sw + 120, yp + 60);

  // floodlights (kept below the status bar / top tabs)
  for (const fx of [26, sw - 26]) {
    const fy = 168;
    const rg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 320);
    rg.addColorStop(0, 'rgba(240,248,255,0.95)');
    rg.addColorStop(0.07, 'rgba(200,225,255,0.55)');
    rg.addColorStop(0.4, 'rgba(120,160,255,0.12)');
    rg.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(fx - 320, fy - 320, 640, 640);
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { rr(ctx, fx - 31 + j * 16, fy - 12 + i * 14, 12, 10, 2); ctx.fill(); }
  }

  // stands + crowd
  const st = sh * 0.17, sb = sh * 0.365;
  g = ctx.createLinearGradient(0, st, 0, sb);
  g.addColorStop(0, '#081230');
  g.addColorStop(1, '#16254E');
  ctx.fillStyle = g;
  ctx.fillRect(-60, st, sw + 120, sb - st);
  const cr = rng(11);
  const flashP = 0.012 + (sinceHit > 0 ? 0.09 * Math.exp(-sinceHit * 1.2) : 0);
  const frameBin = Math.floor(lt * 14);
  for (let i = 0; i < 380; i++) {
    const x = cr() * (sw + 80) - 40, y = st + 8 + cr() * (sb - st - 14);
    const hue = cr(), base = 0.18 + cr() * 0.3, r = 2 + cr() * 2.4;
    const col = hue < 0.2 ? '198,255,61' : hue < 0.6 ? '169,192,224' : '244,254,255';
    const bob = sinceHit > 0 ? Math.sin(lt * 14 + i) * 2.5 * Math.exp(-sinceHit * 0.7) : 0;
    ctx.fillStyle = `rgba(${col},${base})`;
    circle(ctx, x, y + bob, r); ctx.fill();
    const h = rng(i * 7919 + frameBin * 104729)();
    if (h < flashP) {
      const fg = ctx.createRadialGradient(x, y, 0, x, y, 16);
      fg.addColorStop(0, 'rgba(255,255,255,0.95)');
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fg;
      circle(ctx, x, y, 16); ctx.fill();
    }
  }

  // LED boards
  const lb = sb, le = yp + 2;
  ctx.fillStyle = '#051029';
  ctx.fillRect(-60, lb, sw + 120, le - lb);
  ctx.save();
  ctx.beginPath(); ctx.rect(-60, lb, sw + 120, le - lb); ctx.clip();
  font(ctx, 'XB', 22);
  const msg = 'GAMEPULSE      FEEL EVERY MOMENT      ';
  const mw = textW(ctx, msg);
  ctx.fillStyle = C.volt;
  ctx.textAlign = 'left';
  for (let x = -((lt * 110) % mw) - 60; x < sw + 60; x += mw) ctx.fillText(msg, x, lb + (le - lb) / 2 + 8);
  ctx.restore();

  // pitch
  g = ctx.createLinearGradient(0, yp, 0, sh);
  g.addColorStop(0, '#17602F');
  g.addColorStop(1, '#2E9C4E');
  ctx.fillStyle = g;
  ctx.fillRect(-60, yp, sw + 120, sh - yp + 60);
  for (let i = 0; i < 10; i++) {
    if (i % 2) continue;
    const a = yp + (sh - yp) * Math.pow(i / 10, 1.6), b = yp + (sh - yp) * Math.pow((i + 1) / 10, 1.6);
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.fillRect(-60, a, sw + 120, b - a);
  }
  const k = sw * 0.6;
  const P = (u, v) => [sw / 2 + u * k * (1 + v * 1.9), yp + 8 + (sh - yp) * Math.pow(v, 1.25)];
  const line = (pts) => strokePoly(ctx, pts);
  const seg = (u0, v0, u1, v1) => Array.from({ length: 12 }, (_, i) => P(lerp(u0, u1, i / 11), lerp(v0, v1, i / 11)));
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  line(seg(-1.4, 0, 1.4, 0));
  line(seg(-0.85, 0, -0.85, 0.42)); line(seg(0.85, 0, 0.85, 0.42)); line(seg(-0.85, 0.42, 0.85, 0.42));
  line(seg(-0.36, 0, -0.36, 0.14)); line(seg(0.36, 0, 0.36, 0.14)); line(seg(-0.36, 0.14, 0.36, 0.14));
  line(Array.from({ length: 20 }, (_, i) => { const a = (i / 19) * Math.PI; return P(0.26 * Math.cos(a), 0.42 + 0.07 * Math.sin(a)); }));
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const sp = P(0, 0.3); circle(ctx, sp[0], sp[1], 4); ctx.fill();

  // goal: net (behind), ball-in-net, frame
  const gl = yp + 8, gx0 = sw / 2 - 98, gx1 = sw / 2 + 98, gTop = gl - 84;
  const hx = gx1 - 22, hy = gTop + 14;
  const amp = sinceHit > 0 ? 9 * Math.exp(-sinceHit * 3) * Math.cos(sinceHit * 16) : 0;
  const disp = (x, y) => {
    if (!amp) return [x, y];
    const dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy) || 1;
    const f = amp * Math.exp(-(d * d) / (45 * 45));
    return [x + (dx / d) * f, y + (dy / d) * f - f * 0.3];
  };
  ctx.fillStyle = 'rgba(4,14,40,0.55)';
  ctx.fillRect(gx0, gTop, gx1 - gx0, gl - gTop);
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 1.2;
  for (let x = gx0; x <= gx1; x += 9) line(Array.from({ length: 10 }, (_, i) => disp(x, lerp(gTop, gl, i / 9))));
  for (let y = gTop; y <= gl; y += 9) line(Array.from({ length: 24 }, (_, i) => disp(lerp(gx0, gx1, i / 23), y)));

  // keeper
  const dive = eOut(prog(lt, 1.34, 0.36));
  figure(ctx, sw / 2 - 6 - 46 * dive, gl - 2, 74, {
    kit: '#E0612A', shorts: '#15131F', arms: 0.35 + 0.6 * dive, rot: -1.15 * dive, lift: 22 * Math.sin(Math.PI * clamp(dive * 1.1)),
  });

  const ballAt = (u) => {
    const P0 = [sw * 0.44, sh * 0.86], P1 = [sw * 1.06, sh * 0.44], P2 = [hx, hy];
    const m = 1 - u;
    return [m * m * P0[0] + 2 * m * u * P1[0] + u * u * P2[0], m * m * P0[1] + 2 * m * u * P1[1] + u * u * P2[1], lerp(40, 9, Math.sqrt(u))];
  };
  const flight = (x) => 1 - Math.pow(1 - x, 1.35);
  const u = flight(prog(lt, NIGHT.kick, NIGHT.hit - NIGHT.kick));

  if (sinceHit > 0) {
    const d = prog(lt, NIGHT.hit, 0.4);
    const bounce = Math.abs(Math.sin(Math.PI * 2.2 * clamp((lt - NIGHT.hit - 0.4) / 0.6))) * 8 * (1 - prog(lt, NIGHT.hit + 0.4, 0.6));
    drawBall(ctx, hx - 10 * d, lerp(hy, gl - 9, eIn(d)) - bounce, 9, lt * 4);
  }
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 7;
  ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(gx0, gl); ctx.lineTo(gx0, gTop); ctx.lineTo(gx1, gTop); ctx.lineTo(gx1, gl); ctx.stroke();

  // defensive wall
  const wv = 0.3, jump = Math.sin(Math.PI * prog(lt, 1.14, 0.42));
  for (let i = 0; i < 4; i++) {
    const [fx, fy] = P(-0.34 + i * 0.13, wv);
    figure(ctx, fx, fy, 128, { kit: '#F4FEFF', shorts: '#0E2F76', arms: 0.05, lift: jump * (26 + i * 4) });
  }

  // the ball in flight / at rest
  if (sinceHit <= 0) {
    const [bx, by, br] = ballAt(u);
    if (u === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(bx, by + br * 0.92, br * 1.05, br * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (u > 0) {
      for (let k2 = 9; k2 >= 1; k2--) {
        const uu = flight(prog(lt - k2 * 0.018, NIGHT.kick, NIGHT.hit - NIGHT.kick));
        if (uu <= 0) continue;
        const [tx, ty, trr] = ballAt(uu);
        ctx.fillStyle = hexA(k2 < 4 ? C.ice : C.volt, 0.5 * (1 - k2 / 10));
        circle(ctx, tx, ty, trr * (1 - k2 * 0.05)); ctx.fill();
      }
    }
    drawBall(ctx, bx, by, br, lt * 9 * (u > 0 ? 1 : 0.05));
  }

  // kick dust + goal flash
  const kd = prog(lt, NIGHT.kick, 0.5);
  if (kd > 0 && kd < 1) {
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + r() * Math.PI, sp2 = 40 + r() * 90;
      ctx.fillStyle = `rgba(210,255,190,${0.5 * (1 - kd)})`;
      circle(ctx, sw * 0.44 + Math.cos(a) * sp2 * eOut(kd), sh * 0.86 + 30 + Math.sin(a) * sp2 * 0.5 * eOut(kd), 3 + r() * 3); ctx.fill();
    }
  }
  ctx.restore();
  if (sinceHit > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.32 * Math.exp(-sinceHit * 6)})`;
    ctx.fillRect(0, 0, sw, sh);
  }
}

// ---------------------------------------------------------------- video: sunset Sunday league
export function videoSunset(ctx, sw, sh, t) {
  const yh = sh * 0.47;
  ctx.save();
  const z = 1.04 + 0.02 * Math.sin(t * 0.4);
  ctx.translate(sw / 2, sh / 2); ctx.scale(z, z); ctx.translate(-sw / 2, -sh / 2);
  let g = ctx.createLinearGradient(0, 0, 0, yh);
  g.addColorStop(0, '#2E1257');
  g.addColorStop(0.45, '#A8346F');
  g.addColorStop(0.8, '#FF7A45');
  g.addColorStop(1, '#FFB55A');
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, sw + 80, yh + 40);
  const sx = sw * 0.68, sy = sh * 0.425;
  let rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 330);
  rg.addColorStop(0, 'rgba(255,225,160,0.85)');
  rg.addColorStop(0.25, 'rgba(255,170,110,0.35)');
  rg.addColorStop(1, 'rgba(255,140,90,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(sx - 330, sy - 330, 660, 660);
  // rays
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t * 0.05);
  ctx.fillStyle = 'rgba(255,230,180,0.06)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(700, -40); ctx.lineTo(700, 40); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#FFE6AE';
  circle(ctx, sx, sy, 60); ctx.fill();
  // clouds
  ctx.fillStyle = 'rgba(255,190,200,0.22)';
  for (const [cx, cy, w] of [[80, 220, 220], [380, 150, 260], [250, 330, 180]]) {
    const x = ((cx + t * 12) % (sw + 300)) - 150;
    rr(ctx, x, cy, w, 14, 7); ctx.fill();
    rr(ctx, x + 40, cy - 12, w * 0.5, 12, 6); ctx.fill();
  }
  // skyline + trees
  const r = rng(21);
  ctx.fillStyle = '#2A1034';
  for (let x = -30; x < sw + 30;) {
    const w = 26 + r() * 50, h = 16 + r() * 52;
    if (r() < 0.35) {
      const tr = 16 + r() * 20;
      circle(ctx, x + w / 2, yh - h * 0.6, tr); ctx.fill();
      circle(ctx, x + w / 2 + tr * 0.7, yh - h * 0.45, tr * 0.8); ctx.fill();
      ctx.fillRect(x + w / 2 - 3, yh - h * 0.5, 6, h * 0.5);
    } else {
      ctx.fillRect(x, yh - h, w, h + 2);
    }
    x += w - 2;
  }
  ctx.fillRect(sw * 0.86, yh - 150, 5, 150);
  rr(ctx, sw * 0.86 - 16, yh - 158, 38, 14, 3); ctx.fill();
  // ground
  g = ctx.createLinearGradient(0, yh, 0, sh);
  g.addColorStop(0, '#D98C55');
  g.addColorStop(0.45, '#A05A32');
  g.addColorStop(1, '#5A2E1B');
  ctx.fillStyle = g;
  ctx.fillRect(-40, yh, sw + 80, sh - yh + 40);
  // warm haze at horizon
  g = ctx.createLinearGradient(0, yh - 30, 0, yh + 90);
  g.addColorStop(0, 'rgba(255,190,120,0)');
  g.addColorStop(0.4, 'rgba(255,190,120,0.35)');
  g.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-40, yh - 30, sw + 80, 120);
  // faint lines
  ctx.strokeStyle = 'rgba(255,238,215,0.3)';
  ctx.lineWidth = 3;
  const vp = [sw * 0.42, yh - 60];
  for (const bx of [-200, sw + 240]) { ctx.beginPath(); ctx.moveTo(lerp(vp[0], bx, 0.1), lerp(vp[1], sh, 0.1)); ctx.lineTo(bx, sh); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-40, yh + 64); ctx.lineTo(sw + 40, yh + 70); ctx.stroke();
  // distant goal + players
  ctx.strokeStyle = '#2A1034'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sw * 0.1, yh + 18); ctx.lineTo(sw * 0.1, yh - 26); ctx.lineTo(sw * 0.34, yh - 26); ctx.lineTo(sw * 0.34, yh + 18); ctx.stroke();
  for (const [fx, fy, h, a] of [[sw * 0.52, yh + 40, 58, 0.2], [sw * 0.7, yh + 26, 44, 0.9], [sw * 0.24, yh + 30, 48, 0.1], [sw * 0.88, yh + 54, 66, 0.3]]) {
    figure(ctx, fx + Math.sin(t * 1.3 + fx) * 6, fy, h, { kit: '#3A1636', shorts: '#2A1034', skin: '#2A1034', arms: a });
  }
  // grass tufts
  const gr = rng(5);
  ctx.strokeStyle = 'rgba(70,90,40,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const x = gr() * sw, y = yh + 40 + gr() * (sh - yh - 40), s2 = 4 + (y - yh) * 0.03;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s2 * 0.4, y - s2); ctx.moveTo(x, y); ctx.lineTo(x + s2 * 0.3, y - s2 * 1.1); ctx.stroke();
  }
  // bouncing ball on the beat
  const gy = sh * 0.68, bx = sw * 0.47, R = 44;
  const ph = (((t - 10) % 0.5) + 0.5) % 0.5 / 0.5;
  const hgt = 4 * ph * (1 - ph);
  const by = gy - R - hgt * 230;
  ctx.fillStyle = `rgba(40,12,20,${0.4 * (1 - 0.6 * hgt)})`;
  ctx.beginPath(); ctx.ellipse(bx + 20, gy, R * (1.2 - 0.5 * hgt), R * 0.26 * (1 - 0.5 * hgt), 0, 0, Math.PI * 2); ctx.fill();
  // dust at the last two contacts
  for (let kk = 0; kk < 2; kk++) {
    const tc = Math.floor((t - 10) / 0.5 - kk) * 0.5 + 10;
    const d = prog(t, tc, 0.7);
    if (d <= 0 || d >= 1) continue;
    const dr = rng(Math.round(tc * 100));
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + dr() * Math.PI, s2 = 30 + dr() * 80;
      ctx.fillStyle = `rgba(240,190,140,${0.45 * (1 - d)})`;
      circle(ctx, bx + Math.cos(a) * s2 * eOut(d), gy - 4 + Math.sin(a) * s2 * 0.35 * eOut(d), (4 + dr() * 6) * (0.6 + d)); ctx.fill();
    }
  }
  const squash = ph < 0.06 || ph > 0.94 ? 0.9 : 1;
  ctx.save();
  ctx.translate(bx, by + R);
  ctx.scale(1 / squash, squash);
  drawBall(ctx, 0, -R, R, t * 5);
  ctx.restore();
  ctx.save();
  circle(ctx, bx, by, R); ctx.clip();
  rg = ctx.createRadialGradient(bx + R * 0.6, by - R * 0.4, 0, bx + R * 0.6, by - R * 0.4, R * 1.4);
  rg.addColorStop(0, 'rgba(255,180,100,0.5)');
  rg.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = rg; ctx.fillRect(bx - R, by - R, R * 2, R * 2);
  rg = ctx.createRadialGradient(bx - R * 0.7, by + R * 0.6, 0, bx - R * 0.7, by + R * 0.6, R * 1.3);
  rg.addColorStop(0, 'rgba(50,10,50,0.45)');
  rg.addColorStop(1, 'rgba(50,10,50,0)');
  ctx.fillStyle = rg; ctx.fillRect(bx - R, by - R, R * 2, R * 2);
  ctx.restore();
  // lens flare
  for (const [f, rad, a] of [[0.35, 30, 0.12], [0.6, 14, 0.18], [0.85, 46, 0.07]]) {
    ctx.fillStyle = `rgba(255,220,170,${a})`;
    circle(ctx, lerp(sx, sw * 0.2, f), lerp(sy, sh * 0.75, f), rad); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- video: daytime training (camera)
export function videoDay(ctx, sw, sh, lc, flick = -1) {
  ctx.save();
  ctx.translate(sw / 2 + Math.sin(lc * 1.3) * 6, sh / 2 + Math.cos(lc * 1.1) * 5);
  ctx.scale(1.05, 1.05);
  ctx.translate(-sw / 2, -sh / 2);
  const yh = sh * 0.38;
  let g = ctx.createLinearGradient(0, 0, 0, yh);
  g.addColorStop(0, '#4FA8E8');
  g.addColorStop(1, '#C9ECFF');
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, sw + 80, yh + 40);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, s] of [[120, 200, 1], [420, 140, 0.8], [300, 300, 0.6]]) {
    const x = cx + lc * 8;
    for (const [dx, dy, r] of [[0, 0, 34], [30, -14, 30], [60, 0, 28], [28, 8, 30]]) { circle(ctx, x + dx * s, cy + dy * s, r * s); ctx.fill(); }
  }
  const tr = rng(8);
  ctx.fillStyle = '#2F6B3A';
  for (let x = -30; x < sw + 30; x += 30) { circle(ctx, x, yh - 8 - tr() * 20, 26 + tr() * 16); ctx.fill(); }
  ctx.fillStyle = '#285E33';
  ctx.fillRect(-40, yh - 10, sw + 80, 24);
  g = ctx.createLinearGradient(0, yh, 0, sh);
  g.addColorStop(0, '#5CC274');
  g.addColorStop(1, '#2F9148');
  ctx.fillStyle = g;
  ctx.fillRect(-40, yh + 10, sw + 80, sh);
  for (let i = 0; i < 10; i += 2) {
    const a = yh + 10 + (sh - yh) * Math.pow(i / 10, 1.5), b = yh + 10 + (sh - yh) * Math.pow((i + 1) / 10, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(-40, a, sw + 80, b - a);
  }
  // goal
  const gx = sw * 0.62, gy = yh + 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
  for (let x = gx - 80; x <= gx + 80; x += 8) { ctx.beginPath(); ctx.moveTo(x, gy - 64); ctx.lineTo(x, gy); ctx.stroke(); }
  for (let y = gy - 64; y <= gy; y += 8) { ctx.beginPath(); ctx.moveTo(gx - 80, y); ctx.lineTo(gx + 80, y); ctx.stroke(); }
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(gx - 80, gy); ctx.lineTo(gx - 80, gy - 64); ctx.lineTo(gx + 80, gy - 64); ctx.lineTo(gx + 80, gy); ctx.stroke();
  // cones
  for (const [cx, cy, s] of [[sw * 0.18, sh * 0.6, 1], [sw * 0.84, sh * 0.64, 1.1], [sw * 0.33, sh * 0.52, 0.7]]) {
    ctx.fillStyle = C.hot;
    ctx.beginPath(); ctx.moveTo(cx, cy - 34 * s); ctx.lineTo(cx + 16 * s, cy); ctx.lineTo(cx - 16 * s, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 9 * s, cy - 18 * s, 18 * s, 5 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx + 6 * s, cy + 2, 20 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // ball (optionally flicked up)
  const R = 60, bx0 = sw * 0.5, by0 = sh * 0.74;
  const u = flick >= 0 ? prog(lc, flick, 0.9) : 0;
  const up = Math.sin(Math.PI * u);
  const bx = bx0 + 50 * u, by = by0 - up * 430, br = R * (1 - 0.22 * up);
  ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - 0.6 * up)})`;
  ctx.beginPath(); ctx.ellipse(bx + 14, by0 + R * 0.9, R * (1.1 - 0.5 * up), R * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  drawBall(ctx, bx, by, br, u * 9 + lc * 0.2);
  ctx.restore();
}

// ---------------------------------------------------------------- video: indoor futsal (thumbnails)
export function videoIndoor(ctx, sw, sh) {
  const g = ctx.createLinearGradient(0, 0, 0, sh);
  g.addColorStop(0, '#12183A');
  g.addColorStop(0.35, '#23307A');
  g.addColorStop(1, '#3547A8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sw, sh);
  ctx.fillStyle = 'rgba(198,255,61,0.18)';
  for (let i = 0; i < 6; i++) { circle(ctx, 60 + i * 90, 120, 30); ctx.fill(); }
  ctx.strokeStyle = 'rgba(198,255,61,0.8)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-20, sh * 0.42); ctx.lineTo(sw + 20, sh * 0.42); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sw / 2, sh * 0.62, 180, 60, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sw / 2, sh * 0.42); ctx.lineTo(sw / 2, sh); ctx.stroke();
  figure(ctx, sw * 0.35, sh * 0.7, 260, { kit: C.volt, shorts: C.deep, arms: 0.3 });
  figure(ctx, sw * 0.7, sh * 0.62, 200, { kit: '#FF6B2C', shorts: '#15131F', arms: 0.6 });
  drawBall(ctx, sw * 0.5, sh * 0.72, 40, 0.4);
}

// ---------------------------------------------------------------- Reels overlay
export const REELS = {
  a: { user: 'skillzone', init: 'SZ', av: ['#FF6B2C', '#C6315B'], caption: ['Rainbow flick into top bins.', 'Who does it better?'], tags: '#skills  #golazo  #freekick', cheers: 128400, comments: 2311, shares: 9870 },
  b: { user: 'naija_ballers', init: 'NB', av: ['#1FAF5B', '#0E6B3A'], caption: ['Sunday league in Kano hits', 'different. Tag your squad!'], tags: '#naijafootball  #grassroots', cheers: 34120, comments: 802, shares: 2450 },
};

function avatar(ctx, x, y, r, init, cols) {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, cols[0]);
  g.addColorStop(1, cols[1]);
  ctx.fillStyle = g;
  circle(ctx, x, y, r); ctx.fill();
  font(ctx, 'B', r * 0.72);
  ctx.fillStyle = C.ice;
  ctx.textAlign = 'center';
  ctx.fillText(init, x, y + r * 0.26);
}

export function reelUI(ctx, sw, sh, reel, { cheered = 0, cheerCount, pop = 0, progress = 0, t = 0 } = {}) {
  const y0 = sh - TAB_H;
  ctx.save();
  let g = ctx.createLinearGradient(0, 0, 0, 210);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, sw, 210);
  g = ctx.createLinearGradient(0, y0 - 470, 0, sh);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g; ctx.fillRect(0, y0 - 470, sw, sh);

  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  // The app's own feed switcher: Hot Now (active) and Supporting, with the sound button.
  font(ctx, 'B', 23);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ice;
  ctx.fillText('Hot Now', sw / 2 - 74, 112);
  font(ctx, 'SB', 23);
  ctx.fillStyle = 'rgba(169,192,224,0.9)';
  ctx.fillText('Supporting', sw / 2 + 74, 112);
  ctx.shadowBlur = 0;
  ctx.fillStyle = C.ice;
  rr(ctx, sw / 2 - 74 - 40, 124, 80, 4, 2); ctx.fill();
  // sound button: dark disc with a speaker and two waves
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  circle(ctx, sw - 52, 104, 26); ctx.fill();
  ctx.fillStyle = C.ice;
  ctx.beginPath();
  ctx.moveTo(sw - 66, 98); ctx.lineTo(sw - 59, 98); ctx.lineTo(sw - 50, 90);
  ctx.lineTo(sw - 50, 118); ctx.lineTo(sw - 59, 110); ctx.lineTo(sw - 66, 110); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.ice; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (const r of [7, 13]) { ctx.beginPath(); ctx.arc(sw - 48, 104, r, -Math.PI / 4, Math.PI / 4); ctx.stroke(); }

  // right rail
  const rx = sw - 50;
  const ay = y0 - 452;
  ctx.strokeStyle = C.ice; ctx.lineWidth = 3;
  avatar(ctx, rx, ay, 31, reel.init, reel.av);
  circle(ctx, rx, ay, 31); ctx.stroke();
  ctx.fillStyle = C.volt; circle(ctx, rx, ay + 32, 12); ctx.fill();
  icon(ctx, 'plus', rx, ay + 32, 16, C.royal, 3.4);

  const cy = y0 - 346;
  const s = 1 + pop * 0.45;
  if (cheered > 0) {
    ctx.save();
    ctx.shadowColor = C.volt;
    ctx.shadowBlur = 26 * cheered;
    drawArcs(ctx, rx - 4, cy, 20 * s, C.volt);
    ctx.restore();
  }
  drawArcs(ctx, rx - 4, cy, 20 * s, cheered > 0.5 ? C.volt : C.ice);
  drawBall(ctx, rx - 4, cy, 20 * s, t * 0.8);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  font(ctx, 'B', 18);
  ctx.fillStyle = cheered > 0.5 ? C.volt : C.ice;
  ctx.textAlign = 'center';
  ctx.fillText(fmtK(cheerCount ?? reel.cheers), rx, cy + 50);
  ctx.shadowBlur = 0;

  const my = y0 - 238;
  icon(ctx, 'message-circle', rx, my, 42, C.ice, 2.1, { fill: 'rgba(255,255,255,0.12)' });
  ctx.shadowBlur = 6;
  ctx.fillStyle = C.ice;
  ctx.fillText(fmtK(reel.comments), rx, my + 48);
  ctx.shadowBlur = 0;
  const sy = y0 - 136;
  icon(ctx, 'send', rx, sy, 38, C.ice, 2.1);
  ctx.shadowBlur = 6;
  ctx.fillText(fmtK(reel.shares), rx, sy + 46);
  ctx.shadowBlur = 0;

  // caption block
  const lx = 28;
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  font(ctx, 'B', 24);
  ctx.fillStyle = C.ice;
  const un = '@' + reel.user;
  ctx.fillText(un, lx, y0 - 196);
  const uw = ctx.measureText(un).width;
  ctx.shadowBlur = 0;
  icon(ctx, 'badge-check', lx + uw + 20, y0 - 204, 24, C.ice, 2, { fill: C.bright });
  ctx.strokeStyle = 'rgba(244,254,255,0.85)'; ctx.lineWidth = 2;
  rr(ctx, lx + uw + 42, y0 - 226, 96, 36, 18); ctx.stroke();
  font(ctx, 'SB', 17);
  ctx.fillStyle = C.ice;
  ctx.textAlign = 'center';
  ctx.fillText('Support', lx + uw + 90, y0 - 202);
  ctx.textAlign = 'left';
  ctx.shadowBlur = 6;
  font(ctx, 'R', 21);
  ctx.fillText(reel.caption[0], lx, y0 - 154);
  ctx.fillText(reel.caption[1], lx, y0 - 124);
  font(ctx, 'B', 20);
  ctx.fillStyle = C.volt;
  ctx.fillText(reel.tags, lx, y0 - 90);
  ctx.shadowBlur = 0;
  icon(ctx, 'music', lx + 10, y0 - 50, 20, C.ice, 2);
  font(ctx, 'M', 18);
  ctx.fillStyle = 'rgba(244,254,255,0.88)';
  ctx.fillText('original sound  ·  ' + reel.user, lx + 30, y0 - 43);
  // spinning disc
  ctx.save();
  ctx.translate(rx, y0 - 48);
  ctx.rotate(t * 2);
  ctx.fillStyle = '#111';
  circle(ctx, 0, 0, 24); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 6; circle(ctx, 0, 0, 16); ctx.stroke();
  avatar(ctx, 0, 0, 10, '', reel.av);
  ctx.restore();

  // progress
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, y0 - 10, sw, 4);
  ctx.fillStyle = C.volt;
  ctx.fillRect(0, y0 - 10, sw * clamp(progress), 4);
  ctx.restore();
}

// ---------------------------------------------------------------- cheer burst (double-tap)
export function cheerBurst(ctx, x, y, t, t0, seed = 1) {
  const lt = t - t0;
  if (lt < 0 || lt > 1.1) return;
  const r = rng(seed);
  ctx.save();
  // ring
  const ru = prog(lt, 0, 0.5);
  if (ru < 1) {
    ctx.strokeStyle = hexA(C.volt, 0.9 * (1 - ru));
    ctx.lineWidth = 6 * (1 - ru) + 1;
    circle(ctx, x, y, 30 + 110 * eOut(ru)); ctx.stroke();
  }
  // sparks
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.4, d = (70 + r() * 70) * eOut(prog(lt, 0, 0.5));
    const al = 1 - prog(lt, 0.1, 0.45);
    if (al <= 0) continue;
    ctx.fillStyle = hexA(i % 2 ? C.volt : C.ice, al);
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 5 * al + 1); ctx.fill();
  }
  // the pulse ball
  const sc = spring(lt, 3.4, 0.38);
  const rise = eIn(prog(lt, 0.45, 0.6)) * 190;
  const al = 1 - prog(lt, 0.7, 0.4);
  const rot = lerp(-0.4, 0.2, eOut(prog(lt, 0, 0.6))) + (r() - 0.5) * 0.4;
  ctx.globalAlpha = al;
  ctx.shadowColor = hexA(C.volt, 0.8);
  ctx.shadowBlur = 30;
  drawArcs(ctx, x, y - rise, 58 * sc, C.volt);
  ctx.shadowBlur = 0;
  drawBall(ctx, x, y - rise, 58 * sc, rot * 3);
  ctx.restore();
}

// ---------------------------------------------------------------- Discover
export const HOT = [['#golazo', '184K'], ['#skills', '312K'], ['#naijafootball', '64.5K'], ['#nutmeg', '41.2K'], ['#freekick', '12.4K']];
const CARDS = [
  { kind: 'night', t: 1.9, views: '1.9M', hot: true },
  { kind: 'sunset', t: 10.2, views: '310K' },
  { kind: 'indoor', views: '88.4K' },
  { kind: 'day', t: 0.3, views: '41K' },
  { kind: 'sunset', t: 11.37, views: '256K' },
  { kind: 'night', t: 0.4, views: '97K' },
];

function thumb(ctx, kind, tt, x, y, w, h, sw, sh) {
  ctx.save();
  rr(ctx, x, y, w, h, 20);
  ctx.clip();
  ctx.translate(x, y);
  const s = Math.max(w / sw, h / sh);
  ctx.translate((w - sw * s) / 2, (h - sh * s) / 2);
  ctx.scale(s, s);
  if (kind === 'night') videoNight(ctx, sw, sh, tt);
  else if (kind === 'sunset') videoSunset(ctx, sw, sh, tt);
  else if (kind === 'day') videoDay(ctx, sw, sh, tt);
  else videoIndoor(ctx, sw, sh);
  ctx.restore();
}

export function discoverScreen(ctx, sw, sh, ld, { tapT = -1 } = {}) {
  ctx.save();
  ctx.fillStyle = C.ice;
  ctx.fillRect(0, 0, sw, sh);
  const scroll = 170 * eInOut(prog(ld, 2.1, 1.1));
  ctx.save();
  ctx.translate(0, -scroll);
  font(ctx, 'XB', 42);
  ctx.fillStyle = C.text;
  ctx.textAlign = 'left';
  ctx.fillText('Discover', 28, 130);
  ctx.fillStyle = C.muted;
  rr(ctx, 24, 154, sw - 48, 60, 30); ctx.fill();
  icon(ctx, 'search', 60, 184, 26, C.text2, 2.2);
  font(ctx, 'M', 19);
  ctx.fillStyle = C.text2;
  ctx.fillText('Search Moments, clubs, GameMakers', 86, 191);

  icon(ctx, 'flame', 42, 262, 26, C.hot, 2.3, { fill: hexA(C.hot, 0.25) });
  font(ctx, 'B', 25);
  ctx.fillStyle = C.text;
  ctx.fillText('Hot Now', 64, 271);
  let cx = 24;
  HOT.forEach(([tag, n], i) => {
    font(ctx, 'B', 20);
    const tw = ctx.measureText(tag).width;
    font(ctx, 'M', 15);
    const nw = ctx.measureText(n).width;
    const w = tw + nw + 48;
    const a = eOutExpo(prog(ld, 0.25 + i * 0.07, 0.5));
    const ox = (1 - a) * 260;
    ctx.globalAlpha = a;
    ctx.fillStyle = i === 0 ? C.royal : C.white;
    rr(ctx, cx + ox, 294, w, 56, 28); ctx.fill();
    if (i) { ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke(); }
    font(ctx, 'B', 20);
    ctx.fillStyle = i === 0 ? C.ice : C.royal;
    ctx.fillText(tag, cx + ox + 20, 329);
    font(ctx, 'M', 15);
    ctx.fillStyle = i === 0 ? C.powder : C.text2;
    ctx.fillText(n, cx + ox + 28 + tw, 329);
    ctx.globalAlpha = 1;
    cx += w + 12;
  });

  font(ctx, 'B', 25);
  ctx.fillStyle = C.text;
  ctx.fillText('Trending Moments', 28, 410);
  const cw = (sw - 48 - 14) / 2, ch = 330;
  CARDS.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 24 + col * (cw + 14), y = 432 + row * (ch + 14);
    const a = eOutBack(prog(ld, 0.45 + i * 0.07, 0.45), 1.4);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.translate(x + cw / 2, y + ch / 2);
    ctx.scale(0.85 + 0.15 * a, 0.85 + 0.15 * a);
    ctx.translate(-cw / 2, -ch / 2);
    thumb(ctx, c.kind, c.t ?? 0, 0, 0, cw, ch, PHONE.sw, PHONE.sh);
    const g = ctx.createLinearGradient(0, ch * 0.6, 0, ch);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    rr(ctx, 0, 0, cw, ch, 20); ctx.fill();
    icon(ctx, 'play', 26, ch - 26, 20, C.ice, 2.2, { fill: C.ice });
    font(ctx, 'B', 19);
    ctx.fillStyle = C.ice;
    ctx.textAlign = 'left';
    ctx.fillText(c.views, 44, ch - 19);
    if (c.hot) {
      ctx.fillStyle = C.hot;
      rr(ctx, 14, 14, 86, 34, 17); ctx.fill();
      icon(ctx, 'flame', 34, 31, 18, C.white, 2.4);
      font(ctx, 'XB', 15);
      ctx.fillStyle = C.white;
      ctx.fillText('HOT', 48, 37);
    }
    ctx.restore();
  });
  ctx.restore();
  statusBarBacking(ctx, sw, C.ice);
  statusBar(ctx, sw, false);
  tabBar(ctx, sw, sh, 1, false);
  ctx.restore();
}

function statusBarBacking(ctx, sw, col) {
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, sw, 70);
}

// ---------------------------------------------------------------- Camera (Create)
export const CAM = { tapRec: 19.55, recStart: 19.62, recEnd: 20.92, flick: 19.95 };
export function cameraScreen(ctx, sw, sh, t) {
  const lc = t - 19;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, sw, sh);
  videoDay(ctx, sw, sh, lc, CAM.flick - 19);
  let g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, sw, 200);
  g = ctx.createLinearGradient(0, sh - 380, 0, sh);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, sh - 380, sw, 380);
  statusBar(ctx, sw, true);
  icon(ctx, 'x', 46, 106, 34, C.ice, 2.6);
  const tools = ['refresh-ccw', 'zap', 'timer', 'sparkles'];
  tools.forEach((n, i) => icon(ctx, n, sw - 46, 110 + i * 78, 32, C.ice, 2.2));

  const rec = t >= CAM.recStart && t < CAM.recEnd + 0.05;
  const p = prog(t, CAM.recStart, CAM.recEnd - CAM.recStart);
  if (rec) {
    font(ctx, 'B', 20);
    const label = `REC  00:${String(Math.floor(p * 15)).padStart(2, '0')}`;
    const w = ctx.measureText(label).width + 56;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(ctx, sw / 2 - w / 2, 82, w, 44, 22); ctx.fill();
    ctx.fillStyle = C.rec;
    if (Math.floor(t * 4) % 2 === 0) { circle(ctx, sw / 2 - w / 2 + 24, 104, 8); ctx.fill(); }
    ctx.fillStyle = C.ice;
    ctx.textAlign = 'left';
    ctx.fillText(label, sw / 2 - w / 2 + 40, 111);
  }
  // duration selector
  font(ctx, 'SB', 21);
  ctx.textAlign = 'center';
  [['30s', -90], ['1m', 0], ['3m', 90]].forEach(([s, dx]) => {
    ctx.fillStyle = dx === 0 ? C.ice : 'rgba(244,254,255,0.6)';
    ctx.fillText(s, sw / 2 + dx, sh - 262);
  });
  ctx.fillStyle = C.volt;
  circle(ctx, sw / 2, sh - 246, 4); ctx.fill();

  // record button
  const bx = sw / 2, by = sh - 150;
  const press = Math.exp(-Math.max(0, t - CAM.tapRec) * 10) * (t >= CAM.tapRec ? 1 : 0) + Math.exp(-Math.max(0, t - CAM.recEnd) * 10) * (t >= CAM.recEnd ? 1 : 0);
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(1 - press * 0.1, 1 - press * 0.1);
  ctx.strokeStyle = 'rgba(244,254,255,0.9)';
  ctx.lineWidth = 8;
  circle(ctx, 0, 0, 58); ctx.stroke();
  if (p > 0) {
    ctx.strokeStyle = C.volt;
    ctx.lineCap = 'round';
    ctx.shadowColor = C.volt; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  const m = eOut(prog(t, CAM.recStart, 0.2)) * (1 - eOut(prog(t, CAM.recEnd, 0.2)));
  ctx.fillStyle = m > 0.5 ? C.rec : C.volt;
  const s = lerp(46, 24, m), rad = lerp(46, 9, m);
  rr(ctx, -s, -s, s * 2, s * 2, rad); ctx.fill();
  ctx.restore();
  // gallery + effects
  ctx.save();
  rr(ctx, bx - 176, by - 28, 56, 56, 14); ctx.clip();
  ctx.translate(bx - 176, by - 28);
  ctx.scale(0.1, 0.1);
  videoSunset(ctx, 560, 560, 11);
  ctx.restore();
  ctx.strokeStyle = C.ice; ctx.lineWidth = 3;
  rr(ctx, bx - 176, by - 28, 56, 56, 14); ctx.stroke();
  icon(ctx, 'sparkles', bx + 148, by, 40, C.ice, 2.2);
  ctx.restore();
}

// ---------------------------------------------------------------- Post (new Moment)
export const POST = { typeStart: 21.12, typeEnd: 21.72, tap: 21.86, upStart: 21.92, upEnd: 22.34, done: 22.36 };
export function postScreen(ctx, sw, sh, t) {
  ctx.save();
  ctx.fillStyle = C.ice;
  ctx.fillRect(0, 0, sw, sh);
  statusBar(ctx, sw, false);
  icon(ctx, 'x', 44, 110, 30, C.text, 2.4);
  font(ctx, 'B', 27);
  ctx.fillStyle = C.text;
  ctx.textAlign = 'center';
  ctx.fillText('New Moment', sw / 2, 120);

  // clip preview
  const px = 24, py = 160, pw = 206, ph = 366;
  ctx.save();
  rr(ctx, px, py, pw, ph, 22); ctx.clip();
  ctx.translate(px, py);
  const s = Math.max(pw / sw, ph / sh);
  ctx.translate((pw - sw * s) / 2, (ph - sh * s) / 2);
  ctx.scale(s, s);
  videoDay(ctx, sw, sh, 0.9, 0.5);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, px + pw - 74, py + ph - 44, 60, 30, 15); ctx.fill();
  font(ctx, 'SB', 15);
  ctx.fillStyle = C.ice;
  ctx.fillText('0:15', px + pw - 44, py + ph - 24);

  // caption field
  const fx = px + pw + 16, fw = sw - fx - 24;
  ctx.fillStyle = C.white;
  rr(ctx, fx, py, fw, ph, 22); ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();
  const full = ['Rainbow flick at', 'training today.', '#skills #golazo'];
  const total = full.join('').length;
  let n = Math.floor(total * prog(t, POST.typeStart, POST.typeEnd - POST.typeStart));
  ctx.textAlign = 'left';
  let lastX = fx + 20, lastY = py + 46;
  full.forEach((ln, i) => {
    const part = ln.slice(0, Math.max(0, n));
    n -= ln.length;
    font(ctx, i === 2 ? 'B' : 'M', 21);
    ctx.fillStyle = i === 2 ? C.royal : C.text;
    const y = py + 46 + i * 32;
    ctx.fillText(part, fx + 20, y);
    if (part.length) { lastX = fx + 20 + ctx.measureText(part).width; lastY = y; }
  });
  if (t < POST.tap && Math.floor(t * 5) % 2 === 0) {
    ctx.fillStyle = C.royal;
    ctx.fillRect(lastX + 3, lastY - 22, 3, 28);
  }
  // options
  const opts = [['users-round', 'Tag your club'], ['compass', 'Add location'], ['user-round', 'Who can watch · Everyone']];
  opts.forEach(([ic, label], i) => {
    const y = 580 + i * 84;
    ctx.fillStyle = C.white;
    rr(ctx, 24, y, sw - 48, 70, 18); ctx.fill();
    icon(ctx, ic, 62, y + 35, 26, C.royal, 2.2);
    font(ctx, 'M', 20);
    ctx.fillStyle = C.text;
    ctx.fillText(label, 92, y + 42);
  });

  // post button → upload bar
  const by = sh - 196, bw = sw - 48;
  const press = t >= POST.tap ? Math.exp(-(t - POST.tap) * 12) : 0;
  const up = prog(t, POST.upStart, POST.upEnd - POST.upStart);
  ctx.save();
  ctx.translate(sw / 2, by + 42);
  ctx.scale(1 - press * 0.06, 1 - press * 0.06);
  ctx.fillStyle = C.royal;
  rr(ctx, -bw / 2, -42, bw, 84, 42); ctx.fill();
  if (up > 0) {
    ctx.save();
    rr(ctx, -bw / 2, -42, bw, 84, 42); ctx.clip();
    ctx.fillStyle = C.volt;
    ctx.fillRect(-bw / 2, -42, bw * eInOut(up), 84);
    ctx.restore();
  }
  font(ctx, 'XB', 26);
  ctx.textAlign = 'center';
  ctx.fillStyle = up > 0.5 ? C.royal : C.ice;
  ctx.fillText(up > 0 ? `Posting…  ${Math.round(eInOut(up) * 100)}%` : 'Post Moment', 0, 10);
  ctx.restore();

  // success overlay
  const d = prog(t, POST.done, 0.3);
  if (d > 0) {
    ctx.fillStyle = `rgba(8,29,77,${0.82 * eOut(d)})`;
    ctx.fillRect(0, 0, sw, sh);
    const sc = spring(t - POST.done, 3, 0.4);
    ctx.save();
    ctx.translate(sw / 2, sh * 0.42);
    ctx.scale(sc, sc);
    ctx.shadowColor = C.volt; ctx.shadowBlur = 50;
    ctx.fillStyle = C.volt;
    circle(ctx, 0, 0, 84); ctx.fill();
    ctx.shadowBlur = 0;
    icon(ctx, 'check', 0, 0, 96, C.royal, 3.6);
    ctx.restore();
    ctx.globalAlpha = eOut(prog(t, POST.done + 0.12, 0.3));
    font(ctx, 'XB', 36);
    ctx.fillStyle = C.ice;
    ctx.textAlign = 'center';
    ctx.fillText('Moment posted!', sw / 2, sh * 0.42 + 150);
    font(ctx, 'M', 20);
    ctx.fillStyle = C.powder;
    ctx.fillText('Your fans are being notified', sw / 2, sh * 0.42 + 190);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Alerts
export const ALERT_T = [23.3, 23.64, 23.98, 24.32, 24.66, 25.0];
const ALERTS = [
  { kind: 'cheer', init: 'SZ', av: ['#FF6B2C', '#C6315B'], name: 'skillzone', text: 'cheered your Moment', time: 'now' },
  { kind: 'fan', init: 'NB', av: ['#1FAF5B', '#0E6B3A'], name: 'naija_ballers', text: 'started supporting you', time: 'now' },
  { kind: 'comment', init: 'TB', av: ['#7B5CFF', '#3B2A9E'], name: 'tacticsboard', text: '“Clean finish, what a strike!”', time: '1m' },
  { kind: 'hot', name: 'Trending', text: 'Your Moment is hot in #golazo', time: '2m' },
  { kind: 'burst', name: '+1,204 cheers', text: 'on your Moment in the last hour', time: '3m' },
  { kind: 'fan', init: 'GK', av: ['#18B7C9', '#0B6E8A'], name: 'goalkeeperdiaries', text: 'started supporting you', time: '4m' },
];

export function alertsScreen(ctx, sw, sh, t) {
  ctx.save();
  ctx.fillStyle = C.ice;
  ctx.fillRect(0, 0, sw, sh);
  statusBar(ctx, sw, false);
  font(ctx, 'XB', 42);
  ctx.fillStyle = C.text;
  ctx.textAlign = 'left';
  ctx.fillText('Alerts', 28, 130);
  let x = 24;
  ['All', 'Cheers', 'Fans', 'Comments'].forEach((s, i) => {
    font(ctx, 'SB', 18);
    const w = ctx.measureText(s).width + 36;
    ctx.fillStyle = i === 0 ? C.royal : C.muted;
    rr(ctx, x, 156, w, 46, 23); ctx.fill();
    ctx.fillStyle = i === 0 ? C.ice : C.text2;
    ctx.fillText(s, x + 18, 186);
    x += w + 10;
  });
  const top = 226, rowH = 112;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, sw, sh - TAB_H - top); ctx.clip();
  ALERTS.forEach((a, j) => {
    const arrive = ALERT_T[j];
    if (t < arrive) return;
    let idx = 0;
    for (let k = j + 1; k < ALERTS.length; k++) idx += eOut(prog(t, ALERT_T[k], 0.28));
    const ap = eOutExpo(prog(t, arrive, 0.35));
    const y = top + idx * rowH - (1 - ap) * 50;
    ctx.globalAlpha = ap;
    const hl = 1 - prog(t, arrive + 0.2, 0.9);
    ctx.fillStyle = hl > 0 ? `rgba(198,255,61,${0.28 * hl})` : 'rgba(0,0,0,0)';
    ctx.fillRect(0, y, sw, rowH);
    const ax = 62, ay = y + rowH / 2;
    if (a.kind === 'hot') {
      ctx.fillStyle = hexA(C.hot, 0.15); circle(ctx, ax, ay, 32); ctx.fill();
      icon(ctx, 'flame', ax, ay, 32, C.hot, 2.4, { fill: hexA(C.hot, 0.3) });
    } else if (a.kind === 'burst') {
      ctx.fillStyle = C.royal; circle(ctx, ax, ay, 32); ctx.fill();
      drawPulseIcon(ctx, ax - 3, ay, 13, 0.3);
    } else {
      avatar(ctx, ax, ay, 32, a.init, a.av);
      const bx = ax + 23, byy = ay + 22;
      ctx.fillStyle = C.ice; circle(ctx, bx, byy, 15); ctx.fill();
      if (a.kind === 'cheer') { ctx.fillStyle = C.royal; circle(ctx, bx, byy, 12); ctx.fill(); drawBall(ctx, bx, byy, 8, 0.2); }
      else if (a.kind === 'fan') { ctx.fillStyle = C.volt; circle(ctx, bx, byy, 12); ctx.fill(); icon(ctx, 'users-round', bx, byy, 15, C.royal, 2.6); }
      else { ctx.fillStyle = C.bright; circle(ctx, bx, byy, 12); ctx.fill(); icon(ctx, 'message-circle', bx, byy, 14, C.ice, 2.6); }
    }
    ctx.textAlign = 'left';
    font(ctx, 'B', 21);
    ctx.fillStyle = C.text;
    ctx.fillText(a.name, 112, ay - 6);
    font(ctx, 'R', 19);
    ctx.fillStyle = C.text2;
    ctx.fillText(a.text, 112, ay + 24);
    font(ctx, 'M', 16);
    ctx.textAlign = 'right';
    ctx.fillText(a.time, sw - 44, ay - 6);
    ctx.fillStyle = C.royal;
    circle(ctx, sw - 32, ay + 16, 6); ctx.fill();
    ctx.fillStyle = C.border;
    ctx.fillRect(112, y + rowH - 1, sw - 136, 1.5);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
  const badge = spring(t - ALERT_T[0], 3, 0.4);
  tabBar(ctx, sw, sh, 3, false, { badge });
  ctx.restore();
}
