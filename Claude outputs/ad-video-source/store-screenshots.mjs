// Google Play listing art for GamePulse, drawn with the same screens and brand pieces as the ad.
//   node store-screenshots.mjs           → ../play-store/
// Phone 1080×1920, 7" tablet 1200×1920, 10" tablet 1600×2560 (all 9:16-ish, inside Play's
// 16:9…9:16 rule), feature graphic 1024×500, icon 512×512.
import fs from 'node:fs';
import path from 'node:path';

import { createCanvas, loadImage } from '@napi-rs/canvas';

import { C, ROOT, PHONE, font, rr, circle, drawPhone, drawPulseIcon, hexA, textW, fillTracked } from './lib.mjs';
import * as S from './screens.mjs';

const OUT = path.resolve(ROOT, 'Claude outputs/play-store');
const PSW = PHONE.sw;
const PSH = PHONE.sh;

// ---------------------------------------------------------------- the six shots

/** Each: headline (accent word in volt), a line of detail, and what the phone shows. */
const SHOTS = [
  {
    file: '01-feel-every-moment',
    head: ['Feel every', 'Moment'],
    sub: 'Skills, goals and saves from fans like you.',
    screen: (c) => {
      S.videoSunset(c, PSW, PSH, 12);
      S.reelUI(c, PSW, PSH, S.REELS.b, { cheered: 1, cheerCount: 34990, pop: 0.6, progress: 0.45, t: 12.6 });
      S.cheerBurst(c, PSW * 0.48, PSH * 0.42, 12.62, 12.3, 4);
    },
  },
  {
    file: '02-cheer-gamemakers',
    head: ['Cheer the', 'GameMakers'],
    sub: 'Double-tap to Cheer. Support the players you rate.',
    screen: (c) => {
      S.videoNight(c, PSW, PSH, 2.2);
      S.reelUI(c, PSW, PSH, S.REELS.a, { progress: 0.7, t: 10 });
    },
  },
  {
    file: '03-find-whats-hot',
    head: ["Find what's", 'hot'],
    sub: 'Trending hashtags, clubs and the best Moments of the week.',
    screen: (c) => S.discoverScreen(c, PSW, PSH, 4),
  },
  {
    file: '04-post-in-seconds',
    head: ['Post your skills in', 'seconds'],
    sub: 'Record or upload up to 3 minutes. Add #hashtags and go live.',
    screen: (c) => S.cameraScreen(c, PSW, PSH, 20.4),
  },
  {
    file: '05-club-wars',
    head: ['Rep your club in', 'Club Wars'],
    sub: 'Earn Pulse, keep your streak, and push your club up the table.',
    screen: (c) => clubWarsScreen(c, PSW, PSH),
  },
  {
    file: '06-live-alerts',
    head: ['Cheers & comments,', 'live'],
    sub: 'Get a push the moment fans react to your Moment.',
    screen: (c) => S.alertsScreen(c, PSW, PSH, 26),
  },
];

// ---------------------------------------------------------------- a Club Wars screen (new)

function clubWarsScreen(c, sw, sh) {
  const bg = c.createLinearGradient(0, 0, 0, sh);
  bg.addColorStop(0, C.ice);
  bg.addColorStop(1, '#E6EEF8');
  c.fillStyle = bg;
  c.fillRect(0, 0, sw, sh);
  S.statusBar(c, sw, false);

  c.textAlign = 'left';
  c.fillStyle = C.text ?? '#0B1B3F';
  font(c, 'B', 40);
  c.fillText('This week', 40, 150);
  font(c, 'M', 22);
  c.fillStyle = '#5B6B8A';
  c.fillText('Tables reset in 2d 14h', 40, 190);

  // Your club banner
  c.fillStyle = C.deep;
  rr(c, 32, 222, sw - 64, 150, 32);
  c.fill();
  c.fillStyle = C.powder;
  font(c, 'SB', 20);
  c.fillText('YOUR CLUB', 64, 270);
  c.fillStyle = C.ice;
  font(c, 'B', 38);
  c.fillText('Enyimba · 2nd', 64, 318);
  c.fillStyle = C.powder;
  font(c, 'R', 22);
  c.fillText('18,420 Pulse from 1,204 fans', 64, 352);
  c.fillStyle = C.volt;
  rr(c, sw - 196, 270, 132, 54, 27);
  c.fill();
  c.fillStyle = C.deep;
  font(c, 'B', 22);
  c.textAlign = 'center';
  c.fillText('Share', sw - 130, 305);

  const rows = [
    ['Arsenal', '21,905', '1,880'],
    ['Enyimba', '18,420', '1,204'],
    ['Barca', '16,077', '1,566'],
    ['Kano Pillars', '12,310', '903'],
    ['Man United', '11,742', '1,412'],
    ['Rangers Intl', '8,960', '610'],
    ['Real Madrid', '8,512', '1,005'],
  ];
  let y = 430;
  rows.forEach(([club, pts, fans], i) => {
    const mine = club === 'Enyimba';
    if (mine) {
      c.fillStyle = '#E6EEF8';
      c.fillRect(0, y - 8, sw, 104);
    }
    // position
    c.fillStyle = i < 3 ? C.volt : 'transparent';
    circle(c, 66, y + 44, 24);
    c.fill();
    c.fillStyle = i < 3 ? C.deep : '#5B6B8A';
    font(c, 'B', 24);
    c.textAlign = 'center';
    c.fillText(String(i + 1), 66, y + 53);
    // badge
    c.fillStyle = C.royal;
    circle(c, 140, y + 44, 34);
    c.fill();
    c.strokeStyle = C.powder;
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = C.ice;
    font(c, 'XB', 30);
    c.fillText(club[0], 140, y + 55);
    // name + fans
    c.textAlign = 'left';
    c.fillStyle = '#0B1B3F';
    font(c, 'B', 28);
    c.fillText(club, 196, y + 40);
    c.fillStyle = '#5B6B8A';
    font(c, 'R', 20);
    c.fillText(`${fans} fans`, 196, y + 72);
    // points
    c.textAlign = 'right';
    c.fillStyle = C.royal;
    font(c, 'B', 28);
    c.fillText(pts, sw - 40, y + 40);
    c.fillStyle = '#5B6B8A';
    font(c, 'R', 18);
    c.fillText('Pulse', sw - 40, y + 70);
    y += 104;
  });
  c.textAlign = 'left';
  S.tabBar(c, sw, sh, 1, false);
}

// ---------------------------------------------------------------- layout

function background(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, C.royal);
  g.addColorStop(1, C.night ?? '#040B20');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soft volt glow behind the phone + faint pitch lines
  const glow = ctx.createRadialGradient(w / 2, h * 0.66, 0, w / 2, h * 0.66, w * 0.75);
  glow.addColorStop(0, hexA(C.volt, 0.18));
  glow.addColorStop(1, hexA(C.volt, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(169,192,224,0.07)';
  ctx.lineWidth = Math.max(2, w * 0.003);
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.66, w * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, h * 0.66);
  ctx.lineTo(w, h * 0.66);
  ctx.stroke();
}

/** Headline on two lines: first line ice, second (the accent) volt, wrapped to fit. */
function headline(ctx, w, h, [a, b], sub) {
  const size = Math.round(w * 0.078);
  const top = h * 0.085;
  ctx.textAlign = 'center';
  font(ctx, 'XB', size);
  ctx.fillStyle = C.ice;
  ctx.fillText(a, w / 2, top + size);
  ctx.fillStyle = C.volt;
  ctx.fillText(b, w / 2, top + size * 2.08);
  font(ctx, 'M', Math.round(w * 0.032));
  ctx.fillStyle = C.powder;
  wrap(ctx, sub, w / 2, top + size * 2.08 + w * 0.075, w * 0.8, w * 0.044);
}

function wrap(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, y);
}

function shot(w, h, s) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  background(ctx, w, h);
  headline(ctx, w, h, s.head, s.sub);
  // Phone in the lower ~62% of the frame, whole (with room below for its shadow).
  const scale = Math.min((h * 0.62) / PHONE.h, (w * 0.7) / PHONE.w);
  drawPhone(ctx, w / 2, h * 0.655, scale, 0, s.screen, { glow: 0.8 });
  return canvas;
}

// ---------------------------------------------------------------- feature graphic + icon

function featureGraphic() {
  const w = 1024;
  const h = 500;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  background(ctx, w, h);
  // Brand block on the left two-thirds, phone on the right third: they never overlap.
  drawPulseIcon(ctx, 118, 214, 54, 0);
  ctx.textAlign = 'left';
  font(ctx, 'XB', 58);
  ctx.fillStyle = C.ice;
  fillTracked(ctx, 'GAME', 196, 236, 5, 'left');
  const gw = textW(ctx, 'GAME', 5);
  ctx.fillStyle = C.volt;
  fillTracked(ctx, 'PULSE', 196 + gw + 5, 236, 5, 'left');
  font(ctx, 'SB', 22);
  ctx.fillStyle = C.powder;
  fillTracked(ctx, 'FEEL EVERY MOMENT', 199, 280, 5, 'left');
  font(ctx, 'M', 21);
  ctx.fillStyle = C.ice;
  ctx.fillText('Football Moments · Club Wars · Challenges', 66, 360);
  // tilted phone on the right, cropped by the frame
  drawPhone(ctx, 885, 300, 0.4, 0.12, SHOTS[0].screen, { glow: 0.6 });
  return canvas;
}

async function icon512() {
  const src = await loadImage(path.resolve(ROOT, 'assets/images/icon.png'));
  const canvas = createCanvas(512, 512);
  canvas.getContext('2d').drawImage(src, 0, 0, 512, 512);
  return canvas;
}

// ---------------------------------------------------------------- write everything

const SIZES = [
  ['phone', 1080, 1920],
  ['tablet-7in', 1200, 1920],
  ['tablet-10in', 1600, 2560],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [dir, w, h] of SIZES) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const s of SHOTS) {
    const file = path.join(OUT, dir, `${s.file}.png`);
    fs.writeFileSync(file, shot(w, h, s).toBuffer('image/png'));
    console.log('wrote', path.relative(OUT, file));
  }
}
fs.writeFileSync(path.join(OUT, 'feature-graphic-1024x500.png'), featureGraphic().toBuffer('image/png'));
fs.writeFileSync(path.join(OUT, 'app-icon-512.png'), (await icon512()).toBuffer('image/png'));
console.log('wrote feature graphic + icon');
