// Pulls the Lucide icon paths the app uses (from the app's node_modules) into icons.json.
import fs from 'fs';
import { fileURLToPath } from 'url';
const dir = fileURLToPath(new URL('../../node_modules/lucide-react-native/dist/esm/icons/', import.meta.url));
const names = ['house','compass','plus','bell','user-round','message-circle','send','flame','search','badge-check','music','play','x','zap','timer','refresh-ccw','images','sparkles','share-2','users-round','trending-up','check','ellipsis','camera','upload'];
const out = {};
for (const n of names) {
  const f = dir + n + '.mjs';
  if (!fs.existsSync(f)) { console.log('missing', n); continue; }
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/const __iconData = (\{[\s\S]*?\n\});/);
  const data = Function('return ' + m[1])();
  const d = data.node.map(([tag, a]) => {
    switch (tag) {
      case 'path': return a.d;
      case 'circle': return `M${+a.cx - +a.r} ${a.cy}a${a.r} ${a.r} 0 1 0 ${2 * a.r} 0a${a.r} ${a.r} 0 1 0 ${-2 * a.r} 0`;
      case 'line': return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
      case 'polyline': return 'M' + a.points.trim().split(/[\s,]+/).reduce((s, v, i) => s + (i % 2 ? ' ' + v : (i ? 'L' : '') + v), '');
      case 'polygon': return 'M' + a.points.trim().split(/[\s,]+/).reduce((s, v, i) => s + (i % 2 ? ' ' + v : (i ? 'L' : '') + v), '') + 'Z';
      case 'rect': { const x=+a.x,y=+a.y,w=+a.width,h=+a.height,r=+(a.rx||0); return r ? `M${x+r} ${y}h${w-2*r}a${r} ${r} 0 0 1 ${r} ${r}v${h-2*r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w-2*r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h-2*r)}a${r} ${r} 0 0 1 ${r} ${-r}z` : `M${x} ${y}h${w}v${h}h${-w}z`; }
      default: console.log('unhandled', n, tag); return '';
    }
  });
  out[n] = d;
}
fs.writeFileSync('icons.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'icons');
