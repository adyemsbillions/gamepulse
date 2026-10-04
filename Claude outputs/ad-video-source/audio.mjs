// Procedural 120 BPM soundtrack for the GamePulse ad, hit-synced to the visuals.
// Writes out/music.wav (48 kHz, 16-bit stereo).
import { Buffer } from 'buffer';
import fs from 'fs';
import { rng } from './lib.mjs';
import { HEARTBEATS, CHEER_TIMES, LOGO_T0 } from './scenes.mjs';
import { CAM, POST, ALERT_T } from './screens.mjs';

const SR = 48000, DUR = 30, N = SR * DUR, BEAT = 0.5;
const mk = () => [new Float32Array(N), new Float32Array(N)];
const drums = mk(), music = mk(), fx = mk(), send = mk();
const R = rng(1234);
const noise = () => R() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- mixing
function put(bus, t, sig, gain = 1, pan = 0, sendAmt = 0) {
  const i0 = Math.round(t * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * gain;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2 * gain;
  const [L, Rr] = Array.isArray(sig) ? sig : [sig, sig];
  for (let i = 0; i < L.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= N) continue;
    const l = L[i] * gl, r = Rr[i] * gr;
    bus[0][j] += l; bus[1][j] += r;
    if (sendAmt) { send[0][j] += l * sendAmt; send[1][j] += r * sendAmt; }
  }
}
const buf = (sec) => new Float32Array(Math.round(sec * SR));

// ---------------------------------------------------------------- filters
function biquad(type, f, Q = 0.707) {
  const w = (TAU * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // bandpass (0 dB peak)
  a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function filt(x, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
/** Time-varying state-variable filter (TPT). fc(i) in Hz. */
function svf(x, fc, Q, mode = 'lp') {
  let ic1 = 0, ic2 = 0;
  const k = 1 / Q;
  for (let i = 0; i < x.length; i++) {
    const g = Math.tan((Math.PI * Math.min(fc(i), SR * 0.45)) / SR);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    x[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 : x[i] - k * v1 - v2;
  }
  return x;
}
const blep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};

// ---------------------------------------------------------------- drums
function kick(t, g = 1) {
  const x = buf(0.45);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    ph += (TAU * (46 + 115 * Math.exp(-tt * 32))) / SR;
    let s = Math.sin(ph) * Math.exp(-tt * 7);
    if (tt < 0.004) s += noise() * 0.35 * (1 - tt / 0.004);
    x[i] = Math.tanh(s * 1.6) * 0.8;
  }
  put(drums, t, x, g);
}
function heartbeat(t, g = 1, pitch = 1) {
  const x = buf(0.5);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    ph += (TAU * pitch * (40 + 55 * Math.exp(-tt * 24))) / SR;
    x[i] = Math.sin(ph) * (1 - Math.exp(-tt * 300)) * Math.exp(-tt * 8.5);
  }
  filt(x, biquad('lp', 400));
  put(fx, t, x, g);
}
function lubdub(t, g = 1) { heartbeat(t, g); heartbeat(t + 0.2, g * 0.7, 1.12); }
function clap(t, g = 1) {
  const x = buf(0.4);
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    let e = 0;
    for (const o of [0, 0.011, 0.022]) if (tt >= o) e += Math.exp(-(tt - o) * 380);
    if (tt > 0.022) e += 0.55 * Math.exp(-(tt - 0.022) * 16);
    x[i] = noise() * e;
  }
  filt(x, biquad('bp', 1300, 0.9));
  filt(x, biquad('hp', 500));
  put(drums, t, x, g * 0.9, 0, 0.22);
}
function snare(t, g = 1) {
  const x = buf(0.25);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    ph += (TAU * (185 + 40 * Math.exp(-tt * 40))) / SR;
    x[i] = noise() * 0.7 * Math.exp(-tt * 20) + Math.sin(ph) * 0.5 * Math.exp(-tt * 30);
  }
  filt(x, biquad('hp', 220));
  put(drums, t, x, g, 0, 0.15);
}
function hat(t, g = 1, open = false, pan = 0.2) {
  const x = buf(open ? 0.3 : 0.06);
  for (let i = 0; i < x.length; i++) x[i] = noise() * Math.exp(-(i / SR) * (open ? 11 : 70));
  filt(x, biquad('hp', 7500));
  filt(x, biquad('hp', 7500));
  put(drums, t, x, g, pan);
}
function crash(t, g = 1) {
  const L = buf(2.6), Rr = buf(2.6);
  for (let i = 0; i < L.length; i++) {
    const e = Math.exp(-(i / SR) * 1.5);
    L[i] = noise() * e; Rr[i] = noise() * e;
  }
  filt(L, biquad('hp', 4200)); filt(Rr, biquad('hp', 4200));
  put(drums, t, [L, Rr], g * 0.55, 0, 0.3);
}

// ---------------------------------------------------------------- synths
function saw(f, n, detuneCents = 0, phase0 = 0) {
  const x = new Float32Array(n);
  const ff = f * Math.pow(2, detuneCents / 1200), dt = ff / SR;
  let ph = phase0;
  for (let i = 0; i < n; i++) {
    x[i] = 2 * ph - 1 - blep(ph, dt);
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return x;
}
function bass(t, dur, midi, g = 1) {
  const n = Math.round((dur + 0.05) * SR);
  const a = saw(mtof(midi), n, -6), b = saw(mtof(midi), n, 6, 0.3);
  const x = new Float32Array(n);
  let sph = 0;
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    sph += (TAU * mtof(midi - 12)) / SR;
    const env = Math.min(1, tt / 0.004) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.05) : 1);
    x[i] = ((a[i] + b[i]) * 0.35 + Math.sin(sph) * 0.7) * env;
  }
  svf(x, (i) => 260 + 1400 * Math.exp(-(i / SR) * 14), 1.1);
  put(music, t, x, g);
}
function pluck(t, midi, g = 1, pan = 0) {
  const n = Math.round(0.4 * SR);
  const a = saw(mtof(midi), n, -8), b = saw(mtof(midi), n, 8, 0.5);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (a[i] + b[i]) * 0.5 * Math.exp(-(i / SR) * 9) * Math.min(1, i / 60);
  svf(x, (i) => 900 + 4200 * Math.exp(-(i / SR) * 22), 1.4);
  put(music, t, x, g, pan, 0.3);
}
function supersaw(midis, n, voices = 5, spread = 14) {
  const L = new Float32Array(n), Rr = new Float32Array(n);
  for (const m of midis) {
    for (let v = 0; v < voices; v++) {
      const det = voices === 1 ? 0 : ((v / (voices - 1)) * 2 - 1) * spread;
      const s = saw(mtof(m), n, det, R());
      const pan = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;
      const gl = Math.cos(((pan * 0.8 + 1) * Math.PI) / 4), gr = Math.sin(((pan * 0.8 + 1) * Math.PI) / 4);
      for (let i = 0; i < n; i++) { L[i] += s[i] * gl; Rr[i] += s[i] * gr; }
    }
  }
  const norm = 1 / (midis.length * voices * 0.6);
  for (let i = 0; i < n; i++) { L[i] *= norm; Rr[i] *= norm; }
  return [L, Rr];
}
function stab(t, midis, g = 1) {
  const n = Math.round(0.7 * SR);
  const [L, Rr] = supersaw(midis, n, 3, 10);
  for (const x of [L, Rr]) {
    for (let i = 0; i < n; i++) x[i] *= Math.exp(-(i / SR) * 5) * Math.min(1, i / 100);
    svf(x, (i) => 1200 + 5000 * Math.exp(-(i / SR) * 10), 0.9);
  }
  put(music, t, [L, Rr], g, 0, 0.35);
}
function pad(t0, t1, midis, g = 1, cutoff = 1100, atk = 0.8, rel = 1.0) {
  const n = Math.round((t1 - t0 + rel) * SR);
  const [L, Rr] = supersaw(midis, n, 5, 13);
  for (const x of [L, Rr]) {
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      x[i] *= Math.min(1, tt / atk) * (tt > t1 - t0 ? Math.max(0, 1 - (tt - (t1 - t0)) / rel) : 1);
    }
    svf(x, () => cutoff, 0.8);
  }
  put(music, t0, [L, Rr], g, 0, 0.5);
}

// ---------------------------------------------------------------- fx
function riser(t0, t1, g = 1) {
  const n = Math.round((t1 - t0) * SR);
  const L = new Float32Array(n), Rr = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = Math.pow(i / n, 2.2); L[i] = noise() * e; Rr[i] = noise() * e; }
  const fc = (i) => 350 * Math.pow(9000 / 350, i / n);
  svf(L, fc, 2.5, 'bp'); svf(Rr, fc, 2.5, 'bp');
  const tone = saw(1, n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += (180 * Math.pow(8, i / n)) / SR; if (ph >= 1) ph -= 1;
    tone[i] = (2 * ph - 1) * Math.pow(i / n, 2) * 0.18;
  }
  svf(tone, () => 2500, 0.7);
  for (let i = 0; i < n; i++) { L[i] += tone[i]; Rr[i] += tone[i]; }
  put(fx, t0, [L, Rr], g, 0, 0.25);
}
function whoosh(t, dur = 0.5, g = 1, p0 = -0.6, p1 = 0.6) {
  const n = Math.round(dur * SR);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] = noise() * Math.pow(Math.sin(Math.PI * u), 2); }
  svf(x, (i) => { const u = i / n; return 300 + 3200 * Math.sin(Math.PI * Math.pow(u, 0.8)); }, 1.6, 'bp');
  const L = new Float32Array(n), Rr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = p0 + (p1 - p0) * (i / n);
    L[i] = x[i] * Math.cos(((p + 1) * Math.PI) / 4); Rr[i] = x[i] * Math.sin(((p + 1) * Math.PI) / 4);
  }
  put(fx, t - dur * 0.5, [L, Rr], g, 0, 0.2);
}
function impact(t, g = 1) {
  const n = Math.round(2.2 * SR);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    ph += (TAU * (32 + 40 * Math.exp(-tt * 6))) / SR;
    x[i] = Math.tanh(Math.sin(ph) * Math.exp(-tt * 2.2) * 1.4) * 0.9;
  }
  const nz = buf(0.6);
  for (let i = 0; i < nz.length; i++) nz[i] = noise() * Math.exp(-(i / SR) * 9);
  filt(nz, biquad('lp', 1800));
  for (let i = 0; i < nz.length; i++) x[i] += nz[i] * 0.6;
  put(fx, t, x, g, 0, 0.4);
}
function thud(t, g = 1) {
  const x = buf(0.25);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    ph += (TAU * (90 + 140 * Math.exp(-tt * 50))) / SR;
    x[i] = Math.sin(ph) * Math.exp(-tt * 18) + (tt < 0.006 ? noise() * 0.5 * (1 - tt / 0.006) : 0);
  }
  put(fx, t, x, g);
}
function pop(t, midi, g = 1, pan = 0) {
  const x = buf(0.18);
  let ph = 0;
  const f0 = mtof(midi);
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    ph += (TAU * f0 * (0.55 + 0.6 * (1 - Math.exp(-tt * 45)))) / SR;
    x[i] = Math.sin(ph) * Math.exp(-tt * 24) * Math.min(1, tt * 2000);
  }
  put(fx, t, x, g, pan, 0.2);
}
function bell(t, midi, g = 1, pan = 0) {
  const x = buf(1.6);
  const f = mtof(midi);
  const parts = [[1, 1, 3.2], [2.0, 0.35, 5], [3.01, 0.22, 8], [4.2, 0.1, 13]];
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    let s = 0;
    for (const [r, a, d] of parts) s += a * Math.sin(TAU * f * r * tt) * Math.exp(-tt * d);
    x[i] = s * Math.min(1, tt * 600);
  }
  put(fx, t, x, g, pan, 0.35);
}
function beep(t, f = 880, g = 1, dur = 0.11) {
  const x = buf(dur + 0.02);
  for (let i = 0; i < x.length; i++) {
    const tt = i / SR;
    x[i] = Math.sin(TAU * f * tt) * Math.min(1, tt / 0.004) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.02) : 1);
  }
  put(fx, t, x, g, 0, 0.25);
}
function click(t, g = 1, pan = 0) {
  const x = buf(0.012);
  for (let i = 0; i < x.length; i++) x[i] = noise() * Math.exp(-(i / SR) * 700);
  filt(x, biquad('bp', 3200, 1.2));
  put(fx, t, x, g, pan);
}
function crowd(t0, t1, g, swells = []) {
  const n = Math.round((t1 - t0) * SR);
  const L = new Float32Array(n), Rr = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = noise(); Rr[i] = noise(); }
  for (const x of [L, Rr]) { filt(x, biquad('lp', 1700)); filt(x, biquad('hp', 280)); filt(x, biquad('bp', 900, 0.5)); }
  for (let i = 0; i < n; i++) {
    const tt = t0 + i / SR, u = i / n;
    let e = 0.55 + 0.25 * Math.sin(tt * 1.7) * Math.sin(tt * 0.63 + 1);
    for (const [ts, a, d] of swells) if (tt >= ts) e += a * (1 - Math.exp(-(tt - ts) * 9)) * Math.exp(-(tt - ts) / d);
    e *= Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.15);
    L[i] *= e; Rr[i] *= e;
  }
  put(fx, t0, [L, Rr], g, 0, 0.3);
}

// ---------------------------------------------------------------- arrangement
const CH = [
  { root: 45, notes: [57, 60, 64] }, // Am
  { root: 41, notes: [57, 60, 65] }, // F
  { root: 48, notes: [55, 60, 64] }, // C
  { root: 43, notes: [55, 59, 62] }, // G
];
const chordAt = (t) => CH[Math.floor((t - 4) / 2) % 4];

// intro (0–4)
pad(0, 4.1, [45, 57, 60, 64], 0.5, 700, 1.4, 0.4);
crowd(0, 4.2, 0.22, [[2.0, 0.8, 1.2]]);
HEARTBEATS.forEach((h, i) => (i < 2 ? lubdub(h, 1.0) : heartbeat(h, 0.9 + i * 0.05)));
beep(0.8, 880, 0.18);
beep(2.0, 880, 0.2);
impact(1.0, 0.35);
impact(2.0, 0.8);
whoosh(1.15, 0.5, 0.25);
riser(2.0, 4.0, 0.55);
for (let t = 3.0; t < 3.5; t += 0.25) snare(t, 0.25 + (t - 3) * 0.3);
for (let t = 3.5; t < 3.75; t += 0.125) snare(t, 0.45);
for (let t = 3.75; t < 4.0; t += 0.0625) snare(t, 0.55 + (t - 3.75) * 1.4);

// drop
impact(4.0, 1.0);
crash(4.0, 1.0);
const kicks = [];
for (let t = 4.0; t < 25.5; t += BEAT) { kick(t, 1); kicks.push(t); }
kick(LOGO_T0, 1.1); kicks.push(LOGO_T0);
for (let t = 4.5; t < 25.5; t += 1.0) clap(t, 0.7);
for (let t = 4.0; t < 25.5; t += 0.125) {
  const off = Math.abs(((t - 4) % 0.5) - 0.25) < 1e-6;
  const step = Math.round((t - 4) / 0.125) % 4;
  if (off) hat(t, 0.32, true, 0.25);
  else hat(t, step === 0 ? 0.12 : 0.2, false, step % 2 ? -0.25 : 0.25);
}
// bass on the off-beats, octave pop on the last of each bar
for (let t = 4.0; t < 25.5; t += BEAT) {
  const c = chordAt(t);
  const last = Math.abs(((t - 4) % 2) - 1.5) < 1e-6;
  bass(t + 0.25, 0.2, c.root + (last ? 12 : 0), 0.55);
}
// word stabs
[4, 5, 6, 7].forEach((t) => stab(t, chordAt(t).notes.map((m) => m + 12), 0.5));
whoosh(8.0, 0.55, 0.5);
riser(7.0, 8.0, 0.25);
crash(8.0, 0.7);

// main groove: 16th-note plucks + soft pad bed
const ARP = [0, 1, 2, 1, 3, 2, 1, 2];
for (let t = 8.0; t < 25.5; t += 0.125) {
  const c = chordAt(t);
  const notes = [...c.notes, c.notes[0] + 12].map((m) => m + 12);
  const k = Math.round((t - 8) / 0.125);
  pluck(t, notes[ARP[k % 8]], 0.16 + (k % 4 === 0 ? 0.05 : 0), k % 2 ? 0.35 : -0.35);
}
for (let t = 8.0; t < 26; t += 2) pad(t, t + 2, chordAt(t).notes, 0.16, 1400, 0.3, 0.3);

// feed: free kick + goal
thud(9.1, 0.6);
whoosh(9.36, 0.5, 0.35, -0.3, 0.4);
crowd(8.0, 12.0, 0.18, [[9.62, 2.2, 1.6]]);
crash(9.62, 0.6);
whoosh(10.5, 0.45, 0.4, 0.2, -0.2);
crash(12.0, 0.45);

// cheers
const POPS = [76, 79, 81, 84, 86, 88];
CHEER_TIMES.forEach((t, i) => {
  click(t - 0.14, 0.25); click(t - 0.02, 0.25);
  pop(t, POPS[i], 0.45, (i % 2 ? 0.3 : -0.3));
  bell(t + 0.02, POPS[i] + 12, 0.08, (i % 2 ? 0.4 : -0.4));
});

// discover
click(14.78, 0.3);
whoosh(15.1, 0.45, 0.4, 0.6, -0.4);
[76, 79, 81, 84, 88].forEach((m, k) => pop(15.35 + k * 0.12, m, 0.22, k % 2 ? 0.5 : -0.5));
crash(16.0, 0.35);

// create + post
click(18.78, 0.3);
whoosh(19.15, 0.45, 0.4, 0, 0);
click(CAM.tapRec, 0.4); beep(CAM.recStart, 1320, 0.1, 0.07);
click(CAM.recEnd, 0.4); beep(CAM.recEnd + 0.02, 990, 0.1, 0.07);
whoosh(21.12, 0.45, 0.35, 0.6, -0.4);
for (let t = POST.typeStart; t < POST.typeEnd; t += 0.036) click(t, 0.12 + R() * 0.06, (R() - 0.5) * 0.4);
click(POST.tap, 0.4);
riser(POST.upStart, POST.upEnd, 0.18);
[84, 88, 93].forEach((m, k) => bell(POST.done + k * 0.07, m, 0.18, (k - 1) * 0.4));
pop(POST.done, 72, 0.35);

// alerts
whoosh(23.12, 0.45, 0.35, 0.6, -0.4);
ALERT_T.forEach((t, i) => bell(t, i % 2 ? 84 : 88, 0.14, i % 2 ? 0.35 : -0.35));

// build + logo
riser(24.5, 26.0, 0.6);
for (let t = 25.0; t < 25.5; t += 0.125) snare(t, 0.3 + (t - 25) * 0.4);
for (let t = 25.5; t < 26.0; t += 0.0625) snare(t, 0.45 + (t - 25.5) * 0.6);
whoosh(25.75, 0.6, 0.5);
impact(LOGO_T0, 1.0);
crash(LOGO_T0, 1.0);
lubdub(LOGO_T0, 1.0);
whoosh(LOGO_T0 + 0.75, 0.6, 0.35, -0.6, 0.6);
[81, 88, 93, 100].forEach((m, k) => bell(LOGO_T0 + 0.96 + k * 0.05, m, 0.1, (k - 1.5) * 0.3));
thud(LOGO_T0 + 1.06, 0.4);
pop(LOGO_T0 + 1.75, 79, 0.3);
heartbeat(LOGO_T0 + 2.0, 0.7);
heartbeat(LOGO_T0 + 3.0, 0.6);
pad(LOGO_T0, 30.2, [45, 57, 60, 64, 71], 0.8, 1700, 0.05, 1.2);
bass(LOGO_T0, 3.9, 45, 0.35);
for (let k = 0; k < 12; k++) {
  const t = LOGO_T0 + 0.5 + k * 0.25;
  pluck(t, [69, 72, 76, 79][k % 4] + 12, 0.07 * (1 - k / 14), k % 2 ? 0.5 : -0.5);
}

// ---------------------------------------------------------------- reverb (Freeverb)
function freeverb(inL, inR, room = 0.84, damp = 0.35) {
  const sc = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const fb = room * 0.28 + 0.7, d = damp * 0.4;
  const run = (x, spread) => {
    const out = new Float32Array(N);
    for (const c of combs) {
      const len = Math.round((c + spread) * sc), b = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < N; i++) {
        const y = b[idx];
        store = y * (1 - d) + store * d;
        b[idx] = x[i] * 0.015 + store * fb;
        out[i] += y;
        if (++idx >= len) idx = 0;
      }
    }
    for (const a of aps) {
      const len = Math.round((a + spread) * sc), b = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < N; i++) {
        const bo = b[idx];
        const y = -out[i] + bo;
        b[idx] = out[i] + bo * 0.5;
        out[i] = y;
        if (++idx >= len) idx = 0;
      }
    }
    return out;
  };
  return [run(inL, 0), run(inR, 23)];
}
const [wetL, wetR] = freeverb(send[0], send[1]);

// ---------------------------------------------------------------- master
const duck = new Float32Array(N).fill(1);
for (const k of kicks) {
  const i0 = Math.round(k * SR);
  for (let i = 0; i < SR * 0.4 && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - 0.6 * Math.exp(-(i / SR) / 0.09));
}
const out = mk();
const absPeak = new Float32Array(N);
for (let i = 0; i < N; i++) {
  for (let c = 0; c < 2; c++) {
    out[c][i] = drums[c][i] * 0.9 + music[c][i] * duck[i] + fx[c][i] + (c ? wetR : wetL)[i] * 2.4;
  }
  absPeak[i] = Math.max(Math.abs(out[0][i]), Math.abs(out[1][i]));
}
// pre-gain from the groove's typical peaks (not the one-off impacts), then a look-ahead limiter
const sorted = Float32Array.from(absPeak).sort();
const peak = sorted[Math.floor(N * 0.998)];
const pre = 0.9 / peak;
const ceil = 0.89, look = Math.round(0.005 * SR), rel = 1 - Math.exp(-1 / (0.09 * SR));
const req = new Float32Array(N);
for (let i = 0; i < N; i++) req[i] = Math.min(1, ceil / Math.max(1e-9, absPeak[i] * pre));
// sliding-window minimum over [i, i + look]
const gmin = new Float32Array(N);
const dq = new Int32Array(N);
let head = 0, tail = 0;
for (let j = N - 1; j >= 0; j--) {
  while (tail > head && req[dq[tail - 1]] >= req[j]) tail--;
  dq[tail++] = j;
  while (dq[head] > j + look) head++;
  gmin[j] = req[dq[head]];
}
let gl = 1;
const fadeIn = Math.round(0.02 * SR), fadeOut = Math.round(0.7 * SR);
for (let i = 0; i < N; i++) {
  gl = gmin[i] < gl ? gmin[i] : gl + (gmin[i] - gl) * rel;
  let f = 1;
  if (i < fadeIn) f = i / fadeIn;
  if (i > N - fadeOut) f = (N - i) / fadeOut;
  for (let c = 0; c < 2; c++) {
    const x = out[c][i] * pre * gl;
    out[c][i] = Math.tanh(x * 1.05) * f;
  }
}

// ---------------------------------------------------------------- wav
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[0][i])) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[1][i])) * 32767), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/music.wav', Buffer.concat([hdr, data]));
console.log('wrote out/music.wav  p99.8 peak =', peak.toFixed(2), ' max =', sorted[N - 1].toFixed(2));
