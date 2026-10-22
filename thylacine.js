/* Thylacine silhouette generator.
   A parametric skeleton: body and head as one smooth outline, tail and four legs as tapered
   capsules on joints, driven by a gait function of phase. Output is a set of polygons, and the
   column spans those polygons cover, which is what the page draws as stripes.
   Proportions taken from the 1928 Hobart Zoo photograph (public domain). Units: shoulder height
   is 60, ground is y = 0, up is negative y, the animal faces +x.
   Used by script.js in the browser and by tools/thylacine.mjs in Node. No dependencies. */
(function (root) {
  'use strict';

  const BOX = { x0: -10, x1: 160, top: -75 };

  // Outline of body, neck and head, clockwise from the rump. Head points are flagged so the head can nod.
  const OUTLINE = [
    [56, -59.6], [70, -60.2], [84, -60.4], [99, -61], [113, -61.8], [121, -61.6],
    [128, -64.4, 1], [134, -65.8, 1], [140, -65.2, 1], [149, -62.4, 1], [155, -60.4, 1], [158.4, -59.2, 1],
    [158.8, -55.6, 1], [153.5, -53.4, 1], [146, -52, 1], [139.5, -49.4, 1], [133, -47.6, 1],
    [126, -46], [119, -39.5], [110, -33.4], [101, -29.4], [91, -29.6], [81, -32.2], [72, -35.6], [64, -37.2],
    [56, -35.4], [49.5, -37.4], [45.4, -42.4], [44.4, -49], [45.6, -54.6], [49.6, -58.2],
  ];
  const EAR = [[128.8, -64.4], [128.3, -69], [129.8, -72.9], [132.8, -74.3], [135.7, -72.8], [136.9, -68.8], [136.6, -64.8]];
  const NECK = [124, -52];
  const BODY_PIVOT = [86, -46];

  // Legs: root joint, two bones, and a foot. Rest positions from the reference pose.
  const FRONT = { root: [106, -43], a: 16.5, b: 21, toe: 106, foot: [5.4, 5.6], r: [7.6, 5.4, 3.7, 2.9], bend: 1 };
  const HIND = { root: [56, -49], a: 21.5, b: 17.5, toe: 72, foot: [9, 11.5], r: [12.5, 6.6, 3.9, 2.9], bend: -1 };
  const TAIL = { base: [46, -52], pts: [[47, -52.5], [34, -46], [20, -39.6], [6, -33.8], [-8, -29]], r: [6.6, 5.2, 3.8, 2.5, 1.2] };

  // Trot, as in the 1933 footage: diagonal pairs, the far legs a touch late.
  const LEGS = [
    { def: HIND, off: 0, far: false },
    { def: FRONT, off: 0.04, far: true },
    { def: HIND, off: 0.5, far: true },
    { def: FRONT, off: 0.54, far: false },
  ];

  const TAU = Math.PI * 2;
  const ease = (t) => t * t * (3 - 2 * t);
  const rot = (p, c, a) => {
    const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1];
    return [c[0] + x * k - y * s, c[1] + x * s + y * k];
  };

  // Closed Catmull-Rom through points, sampled.
  function spline(pts, n) {
    const out = [], m = pts.length;
    for (let i = 0; i < m; i++) {
      const p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    return out;
  }

  // A tapered capsule along joints: one polygon per bone, each with round ends, unioned by the span pass.
  function capsules(pts, rs, out) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], r0 = rs[i], r1 = rs[i + 1];
      const a = Math.atan2(y1 - y0, x1 - x0), poly = [];
      for (let j = 0; j <= 6; j++) {
        const t = a + Math.PI / 2 + (j / 6) * Math.PI;
        poly.push([x0 + Math.cos(t) * r0, y0 + Math.sin(t) * r0]);
      }
      for (let j = 0; j <= 6; j++) {
        const t = a - Math.PI / 2 + (j / 6) * Math.PI;
        poly.push([x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1]);
      }
      out.push(poly);
    }
  }

  function ik(root, target, a, b, bend) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
    const th = Math.atan2(dy, dx);
    const al = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    const j = th + bend * al;
    return [root[0] + Math.cos(j) * a, root[1] + Math.sin(j) * a];
  }

  // Toe path over one cycle: planted and sliding back, then lifted and swung forward.
  function toe(u, neutral, amp) {
    const stance = 0.58, S = 30 * amp, lift = 8 * amp;
    u = ((u % 1) + 1) % 1;
    if (u < stance) return [neutral + S * (0.5 - u / stance), 0, 0];
    const s = ease((u - stance) / (1 - stance));
    return [neutral + S * (-0.5 + s), -lift * Math.sin(Math.PI * s), Math.sin(Math.PI * s)];
  }

  /* pose(phase 0..1, amp 0..1) -> polygons. amp 0 is standing. */
  function pose(phase, amp) {
    const polys = [];
    // Running, the body drops and stretches: low and long, head forward, tail out level with the spine.
    const bob = amp * 3.2 - amp * 2.2 * (0.5 + 0.5 * Math.cos(2 * TAU * phase));
    const pitch = amp * 0.03 * Math.sin(TAU * phase);
    const nod = 0.1 + amp * (0.05 + 0.04 * Math.sin(TAU * phase + 1.2));
    const place = (p) => { const q = rot(p, BODY_PIVOT, pitch); return [q[0], q[1] + bob]; };

    const outline = OUTLINE.map((p) => place(p[2] ? rot(p, NECK, nod) : p));
    polys.push(spline(outline, 5));
    polys.push(spline(EAR.map((p) => place(rot(p, NECK, nod))), 3));

    const sway = amp * (0.3 + 0.04 * Math.sin(TAU * phase + 2));
    capsules(TAIL.pts.map((p) => place(rot(p, TAIL.base, sway))), TAIL.r, polys);

    for (const leg of LEGS) {
      const d = leg.def, k = leg.far ? 0.88 : 1;
      const spread = (leg.far ? (d === FRONT ? 4.5 : -4.5) : 0) + amp * (d === FRONT ? 6 : -6);
      const r0 = place(d.root);
      const [tx, ty, sw] = toe(phase + leg.off, d.toe + spread, amp);
      // Mid-swing the foot curls under; planted it points forward.
      const fx = d.foot[0] * (1 - 1.5 * sw), fy = d.foot[1] * (1 - 0.15 * sw);
      const ankle = [tx - fx, ty - fy];
      const knee = ik(r0, ankle, d.a, d.b, d.bend);
      capsules([r0, knee, ankle, [tx, ty]], d.r.map((r) => r * k), polys);
    }
    return polys;
  }

  /* Spans each column covers. xs: column x positions. out: Float32Array(xs.length * MAX * 2), counts: Uint8Array. */
  const MAX = 4;
  const ys = new Float64Array(64);
  const iv = new Float64Array(128);
  function spans(polys, xs, out, counts) {
    for (let c = 0; c < xs.length; c++) {
      const x = xs[c];
      let ni = 0;
      for (const poly of polys) {
        let n = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((xi > x) !== (xj > x) && n < 64) ys[n++] = yi + ((x - xi) / (xj - xi)) * (yj - yi);
        }
        if (n < 2) continue;
        const sorted = Array.prototype.slice.call(ys, 0, n).sort((p, q) => p - q);
        for (let i = 0; i + 1 < n && ni < 126; i += 2) { iv[ni++] = sorted[i]; iv[ni++] = sorted[i + 1]; }
      }
      // Union the intervals, top to bottom.
      const pairs = [];
      for (let i = 0; i < ni; i += 2) pairs.push([iv[i], iv[i + 1]]);
      pairs.sort((p, q) => p[0] - q[0]);
      let m = 0;
      for (const [a, b] of pairs) {
        if (m && a <= out[(c * MAX + m - 1) * 2 + 1] + 0.6) {
          const k = (c * MAX + m - 1) * 2 + 1;
          if (b > out[k]) out[k] = b;
        } else if (m < MAX) {
          out[(c * MAX + m) * 2] = a;
          out[(c * MAX + m) * 2 + 1] = b;
          m++;
        }
      }
      counts[c] = m;
    }
  }

  /* The dark bands: 16 across the lower back, rump and the first third of the tail. Fixed in body space.
     bandAt(x) -> how far down the flank the band at x reaches (0..1 of the body depth there), or 0. */
  const BANDS = { n: 16, from: 97, to: 27, dark: 0.6, amber: 8 };
  const period = (BANDS.from - BANDS.to) / BANDS.n;
  function bandAt(x) {
    const i = Math.floor((BANDS.from - x) / period);
    if (i < 0 || i >= BANDS.n) return { depth: 0, amber: false };
    const c = BANDS.from - (i + 0.5) * period, half = (period * BANDS.dark) / 2, dx = Math.abs(x - c);
    if (dx > half) return { depth: 0, amber: false };
    // Long on the rump and tail, short toward the shoulders; each band tapers toward its edges.
    const reach = x < 46 ? 0.95 : x < 70 ? 0.78 : 0.78 - (x - 70) * 0.016;
    return { depth: reach * (0.45 + 0.55 * (1 - (dx / half) ** 2)), amber: i === BANDS.amber };
  }

  const api = { BOX, MAX, pose, spans, bandAt };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Thylacine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
