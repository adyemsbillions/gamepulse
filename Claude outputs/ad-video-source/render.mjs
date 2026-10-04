// Usage:
//   node render.mjs --still 1.0 5.2 9.5     → stills/f_<t>.png
//   node render.mjs out/video-silent.mp4     → full 30 s render piped to ffmpeg
// eslint-disable-next-line import/no-unresolved -- installed by this folder's own package.json
import { createCanvas } from '@napi-rs/canvas';
import { Buffer } from 'buffer';
import process from 'process';
import { spawn } from 'child_process';
import { once } from 'events';
import fs from 'fs';
import { W, H, FPS, DUR } from './lib.mjs';
import { renderFrame } from './scenes.mjs';

const args = process.argv.slice(2);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

if (args[0] === '--still') {
  fs.mkdirSync('stills', { recursive: true });
  for (const s of args.slice(1)) {
    const t0 = Date.now();
    renderFrame(ctx, +s);
    fs.writeFileSync(`stills/f_${s}.png`, canvas.toBuffer('image/png'));
    console.log(`t=${s} (${Date.now() - t0} ms)`);
  }
} else {
  const out = args[0] || 'out/video-silent.mp4';
  fs.mkdirSync('out', { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = FPS * DUR;
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    renderFrame(ctx, f / FPS);
    if (!ff.stdin.write(Buffer.from(canvas.data()))) await once(ff.stdin, 'drain');
    if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  ff.stdin.end();
  await once(ff, 'close');
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
