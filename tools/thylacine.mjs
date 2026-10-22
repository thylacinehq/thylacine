// Generator for the striped silhouette. Uses the same model as the page (../thylacine.js).
//
//   node tools/thylacine.mjs fallback          write the static standing animal into index.html
//   node tools/thylacine.mjs preview out.svg   poses across the gait cycle, solid and striped, for checking
//
// No dependencies.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const T = createRequire(import.meta.url)('../thylacine.js');

// Column layout shared with the page: N columns across the box, rear stripes on alternate columns.
export const columns = (n) => {
  const xs = [];
  for (let k = 0; k < n; k++) xs.push(T.BOX.x0 + ((k + 0.5) * (T.BOX.x1 - T.BOX.x0)) / n);
  return xs;
};

const f = (v) => +v.toFixed(2);

// Same drawing rules as the page: the columns close up into a plain coat, lighter at the rear,
// and the dark bands run from the spine down the flank, one band amber.
function stripes(phase, amp, n, cls = true) {
  const xs = columns(n);
  const out = new Float32Array(n * T.MAX * 2), counts = new Uint8Array(n);
  T.spans(T.pose(phase, amp), xs, out, counts);
  const pitch = (T.BOX.x1 - T.BOX.x0) / n;
  const paint = (k, c) => (cls ? `class="${k}"` : `fill="${c}"`);
  let s = '';
  for (let c = 0; c < n; c++) {
    const x = xs[c];
    const rearT = Math.min(1, Math.max(0, (112 - x) / 26)) * Math.min(1, Math.max(0, (x - 16) / 10));
    const w = pitch * 1.04;
    for (let j = 0; j < counts[c]; j++) {
      const top = out[(c * T.MAX + j) * 2], bot = out[(c * T.MAX + j) * 2 + 1];
      s += `<rect ${paint(rearT > 0.5 ? 't-fur-hi' : 't-fur', rearT > 0.5 ? '#c9ae84' : '#9c8566')} x="${f(x - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(bot - top)}"/>`;
    }
    const b = T.bandAt(x);
    if (b.depth && counts[c]) {
      const top = out[c * T.MAX * 2], bot = out[c * T.MAX * 2 + 1];
      s += `<rect ${paint(b.amber ? 't-amber' : 't-band', b.amber ? '#e9a640' : '#2a2018')} x="${f(x - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(x < 46 ? (bot - top) * b.depth : Math.min(bot - top, 25 * b.depth))}"/>`;
    }
  }
  return s;
}

const solid = (phase, amp) =>
  T.pose(phase, amp).map((p) => `<path d="M${p.map((q) => `${f(q[0])} ${f(q[1])}`).join('L')}Z"/>`).join('');

const [cmd, arg] = process.argv.slice(2);

if (cmd === 'preview') {
  const phases = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  let body = '';
  phases.forEach((ph, i) => {
    const x = (i % 4) * 170, y = Math.floor(i / 4) * 170;
    body += `<g transform="translate(${x + 6} ${y + 80})" fill="#c9b48f">${solid(ph, 1)}</g>`;
    body += `<g transform="translate(${x + 6} ${y + 160})">${stripes(ph, 1, 112, false)}</g>`;
  });
  body += `<g transform="translate(6 420)" fill="#c9b48f">${solid(0, 0)}</g>`;
  body += `<g transform="translate(176 420)">${stripes(0, 0, 112, false)}</g>`;
  body += `<g transform="translate(346 420)">${stripes(0, 0, 72, false)}</g>`;
  writeFileSync(arg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 690 440" style="background:#111">${body}</svg>`);
  console.log('wrote', arg);
} else if (cmd === 'fallback') {
  const file = join(here, '..', 'index.html');
  const html = readFileSync(file, 'utf8');
  const { x0, x1, top } = T.BOX;
  const svg = `<svg class="back" viewBox="${x0 - 4} ${top - 4} ${x1 - x0 + 8} ${-top + 10}" aria-hidden="true">
    <line class="t-ground" x1="${x0 - 4}" y1="0.5" x2="${x1 + 4}" y2="0.5"/>
    ${stripes(0, 0, 112)}
  </svg>`;
  const next = html.replace(/<!-- thylacine:start -->[\s\S]*?<!-- thylacine:end -->/, `<!-- thylacine:start -->\n  ${svg}\n  <!-- thylacine:end -->`);
  if (next === html) throw new Error('markers not found in index.html');
  writeFileSync(file, next);
  console.log('updated index.html fallback silhouette');
} else {
  console.log('usage: node tools/thylacine.mjs fallback | preview out.svg');
}
