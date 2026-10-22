// Generator for the thylacine. Uses the same model as the page (../thylacine.js).
//
//   node tools/thylacine.mjs fallback          write the static standing animal into index.html
//   node tools/thylacine.mjs preview out.svg   poses across the gait cycle and the gape, for checking
//
// No dependencies.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const T = createRequire(import.meta.url)('../thylacine.js');

const f = (v) => +v.toFixed(2);
const d = (poly, close = true) => 'M' + poly.map((q) => `${f(q[0])} ${f(q[1])}`).join('L') + (close ? 'Z' : '');

// The animal as layered vector paths. cls: CSS classes for the page; otherwise flat preview colours.
export function animal(phase, amp, gape = 0, cls = true, id = 'a') {
  const geo = T.pose(phase, amp, gape);
  const paint = (c, col) => (cls ? `class="${c}"` : `fill="${col}"`);
  const coat = cls ? `fill="url(#${id}-coat)"` : `fill="url(#${id}-coat)"`;
  const stop = (o, c, col) => `<stop offset="${o}" ${cls ? `class="${c}"` : `stop-color="${col}"`}/>`;
  const { x0, x1, top } = T.BOX;
  let s = `<defs><linearGradient id="${id}-coat" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x1}" y2="0">`;
  for (let x = x0; x <= x1; x += 10) {
    const r = T.rear(x), o = f((x - x0) / (x1 - x0));
    if (cls) s += `<stop offset="${o}" style="stop-color: color-mix(in oklch, var(--fur-hi) ${Math.round(r * 100)}%, var(--fur))"/>`;
    else s += `<stop offset="${o}" stop-color="rgb(${[[156, 201], [133, 174], [102, 132]].map(([a, b]) => Math.round(a + (b - a) * r)).join(',')})"/>`;
  }
  s += `</linearGradient><linearGradient id="${id}-belly" gradientUnits="userSpaceOnUse" x1="0" y1="-36" x2="0" y2="-22">`;
  s += stop(0, 't-s-clear', 'rgba(0,0,0,0)') + stop(1, 't-s-belly', '#e3cfa6');
  // Bars as on the page: the same column layout, cut by the outline.
  const L = T.layout(112);
  const n = L.xs.length, out = new Float32Array(n * T.MAX * 2), counts = new Uint8Array(n);
  T.spans(geo.polys, L.xs, out, counts);
  const bars = (kd) => L.xs.map((x, k) => (kd.includes(L.kind[k]) ? `M${f(x - L.ws[k] / 2)} ${top - 4}h${f(L.ws[k])}v${-top + 4}h${f(-L.ws[k])}Z` : '')).join('');
  s += `</linearGradient><clipPath id="${id}-cfar"><path d="${geo.far.map((p) => d(p)).join('')}"/></clipPath>`;
  s += `<clipPath id="${id}-ccoat"><path d="${geo.coat.map((p) => d(p)).join('')}"/></clipPath>`;
  s += `<clipPath id="${id}-cbody"><path d="${d(geo.body)}"/></clipPath>`;
  s += `<clipPath id="${id}-cjaw"><path d="${d(geo.jaw.rest)}"/></clipPath></defs>`;
  s += `<path clip-path="url(#${id}-cfar)" ${paint('t-far', '#7d6a52')} d="${bars([0, 1, 2, 3])}"/>`;
  if (geo.mouth) s += `<path ${paint('t-mouth', '#3a1d18')} d="${d(geo.mouth)}"/>`;
  const [hx, hy] = geo.jaw.hinge;
  s += `<g transform="rotate(${f((geo.jaw.angle * 180) / Math.PI)} ${f(hx)} ${f(hy)})"><path clip-path="url(#${id}-cjaw)" ${coat} d="${bars([0, 1])}"/></g>`;
  s += `<g clip-path="url(#${id}-ccoat)">`;
  s += `<path ${coat} d="${bars([0, 1])}"/>`;
  s += `<path ${paint('t-light', '#d9c49c')} d="${bars([2])}"/>`;
  s += `<path ${paint('t-amber', '#e9a640')} d="${bars([3])}"/>`;
  s += `<path clip-path="url(#${id}-cbody)" fill="url(#${id}-belly)" opacity="0.55" d="${bars([0, 1, 2])}"/>`;
  let dark = '';
  L.xs.forEach((x, k) => {
    if (L.kind[k] !== 1 || !counts[k]) return;
    const t = out[k * T.MAX * 2];
    dark += `M${f(x - L.ws[k] / 2)} ${f(t - 1)}h${f(L.ws[k])}v${f(L.depth[k] + 1)}h${f(-L.ws[k])}Z`;
  });
  s += `<path ${paint('t-band', '#2a2018')} d="${dark}"/></g>`;
  const D = geo.detail;
  s += `<path ${paint('t-band', '#2a2018')} d="${D.innerEars.map((e) => d(e)).join('')}"/>`;
  for (const t of D.teeth) s += `<path ${paint('t-tooth', '#efe6d0')} d="${d(t)}"/>`;
  for (const c of D.claws) s += `<path ${paint('t-band', '#2a2018')} d="${d(c.pts)}"/>`;
  s += `<ellipse ${paint('t-eye', '#140d08')} cx="${f(D.eye.x)}" cy="${f(D.eye.y)}" rx="${D.eye.rx}" ry="${D.eye.ry}" transform="rotate(${f((D.eye.a * 180) / Math.PI)} ${f(D.eye.x)} ${f(D.eye.y)})"/>`;
  s += `<path ${paint('t-eye', '#140d08')} d="${d(D.nose)}"/>`;
  const line = (pts, w) => `<path ${cls ? 'class="t-line"' : 'stroke="#2a2018"'} fill="none" stroke-width="${w}" stroke-linecap="round" d="${d(pts, false)}"/>`;
  s += line(D.brow, 0.5);
  if (D.lip) s += line(D.lip, 0.45);
  return s;
}

// Stripe-column version, as the page shows mid-morph: for checking the span sampling.
export function columns(phase, amp, n) {
  const xs = [];
  for (let k = 0; k < n; k++) xs.push(T.BOX.x0 + ((k + 0.5) * (T.BOX.x1 - T.BOX.x0)) / n);
  const out = new Float32Array(n * T.MAX * 2), counts = new Uint8Array(n);
  T.spans(T.pose(phase, amp).polys, xs, out, counts);
  const w = ((T.BOX.x1 - T.BOX.x0) / n) * 0.6;
  let s = '';
  for (let c = 0; c < n; c++)
    for (let j = 0; j < counts[c]; j++) {
      const top = out[(c * T.MAX + j) * 2], bot = out[(c * T.MAX + j) * 2 + 1];
      s += `<rect fill="#9c8566" x="${f(xs[c] - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(bot - top)}"/>`;
    }
  return s;
}

const [cmd, arg] = process.argv[1] === fileURLToPath(import.meta.url) ? process.argv.slice(2) : [];
const { x0, x1, top } = T.BOX;
const VW = x1 - x0 + 8, VH = -top + 10;

if (cmd === 'preview') {
  const cells = [];
  [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].forEach((ph) => cells.push([ph, 1, 0]));
  cells.push([0, 0, 0], [0, 0, 0.5], [0, 0, 1], ['cols', 0, 0]);
  let body = '';
  cells.forEach(([ph, amp, gp], i) => {
    const x = (i % 4) * VW, y = Math.floor(i / 4) * VH;
    const inner = ph === 'cols' ? columns(0, 0, 112) : animal(ph, amp, gp, false, `c${i}`);
    body += `<g transform="translate(${x - x0 + 4} ${y - top + 4})">${inner}</g>`;
  });
  writeFileSync(arg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW * 4} ${VH * 3}" style="background:#111">${body}</svg>`);
  console.log('wrote', arg);
} else if (cmd === 'fallback') {
  const file = join(here, '..', 'index.html');
  const html = readFileSync(file, 'utf8');
  const svg = `<svg class="back" viewBox="${x0 - 4} ${top - 4} ${VW} ${VH}" aria-hidden="true">
    <line class="t-ground" x1="${x0 - 4}" y1="0.5" x2="${x1 + 4}" y2="0.5"/>
    ${animal(0, 0, 0, true, 'still')}
  </svg>`;
  const next = html.replace(/<!-- thylacine:start -->[\s\S]*?<!-- thylacine:end -->/, `<!-- thylacine:start -->\n  ${svg}\n  <!-- thylacine:end -->`);
  if (next === html) throw new Error('markers not found in index.html');
  writeFileSync(file, next);
  console.log('updated index.html fallback silhouette');
} else if (cmd !== undefined || process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('usage: node tools/thylacine.mjs fallback | preview out.svg');
}
