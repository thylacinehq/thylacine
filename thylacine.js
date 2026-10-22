/* Thylacine silhouette generator.
   A parametric skeleton: body, head and lower jaw as smooth outlines, tail and four legs as tapered
   capsules on joints, broad toed paws, driven by a gait function of phase. Output is a set of polygons
   (for the page's stripe columns and for the clip that keeps their edges smooth), the layers to paint,
   the dark bands, and the small details (eye, nose, ears, teeth, claws).
   Proportions fitted by overlay to a side-view natural-history illustration and the 1928 Hobart Zoo
   photograph. Units: shoulder height is about 60, ground is y = 0, up is negative y, the animal faces +x.
   Used by script.js in the browser and by tools/thylacine.mjs in Node. No dependencies. */
(function (root) {
  'use strict';

  const BOX = { x0: -14, x1: 172, top: -80 };
  // Full gape, set by eye. The often-quoted figure is 120 degrees; the Wikipedia article (citing two papers)
  // gives up to 80. With the jaw drawn as its own bars, 80 turns them nearly flat and the jaw reads as a hanging
  // plank; 55 keeps a long open triangle with the bars still leaning. pose() takes 0..1 of it.
  const GAPE_DEG = 55;
  const GAPE_MAX = (GAPE_DEG * Math.PI) / 180;

  // Body and neck, clockwise from the tail root. The back is highest over the hips, dips behind the withers.
  const BODY = [
    [43, -52], [47, -56.6], [53, -60], [60, -62.2], [68, -63.2], [77, -63], [86, -62], [95, -60.9],
    [103, -60.5], [110, -61], [117, -62], [124, -63.2], [130, -63.8],
    [134, -58], [134.6, -51], [131.6, -45], [127.6, -38.6], [124.6, -32], [121.4, -26.4], [116, -22.4],
    [110, -21.8], [103, -23], [96, -25.2], [89, -27.4], [82, -29.4], [76, -30.6], [70, -31], [64, -30.6],
    [58, -31.6], [51, -34.6], [46, -39.4], [43, -46],
  ];
  const BACK_N = 13; // the first 13 points are the topline

  // Head, fitted by overlay to the reference: a long level wedge, about one and a half times as long as it is
  // deep. Nearly flat skull, a gentle stop, a long straight muzzle ending blunt. Upper part: skull, muzzle and
  // upper lip back to the mouth corner, the full cheek, the throat.
  const HEAD = [
    [130.6, -64.2], [134.4, -65], [138, -65.4], [143.5, -65.2], [147.6, -63.8], [150.4, -61.2], [153.2, -57.6],
    [156.4, -52.8], [158.8, -49.6], [160.2, -48.5], [160.5, -46.8], [159.4, -45.9], [155, -46.2], [150.5, -47.1],
    [146.5, -48.2], [144.6, -47.8], [141.4, -46.8], [138, -46.4], [134.4, -46.6], [131.4, -48.8], [130, -53.4],
    [129.8, -58.6],
  ];
  // Upper jaw edge (mouth line) from the nose back to the corner: the roof of the open mouth.
  const LIP = [[159.4, -45.9], [155, -46.2], [150.5, -47.1], [146.5, -48.2]];
  // One hinge, behind the mouth corner under the back of the eye.
  const HINGE = [143.6, -49.4];
  // Lower jaw, closed: a long slim wedge. Top edge along the mouth line, chin, underside back to the jaw angle.
  const JAW = [
    [146.5, -48.2], [150.5, -47.1], [155, -46.2], [158.8, -45.8], [158.8, -44.9], [156.4, -44.1], [151, -44.2],
    [147, -45], [143.6, -46.4], [141.2, -47.6], [142, -49.2],
  ];
  const JAW_TOP = 4; // the first four points are the top edge
  const TEETH_UP = [[154.4, 1.9, 1.1], [149.6, 0.9, 1]]; // x, length, base: one fang and one cheek tooth
  const TEETH_LO = [[152.8, 1.7, 1.1]];
  // Ears: medium, upright, taller than wide, rounded at a slight point, set back on the skull.
  const NEAR_EAR = [[137.4, -65], [137.3, -67.8], [138.2, -70.2], [139.9, -71.6], [141.5, -70.3], [142.5, -67.9], [142.5, -65.3]];
  const FAR_EAR = [[144, -65.3], [144.4, -68], [145.6, -70.2], [147.1, -71], [148.2, -69.2], [148.5, -66.7], [147.6, -64.9]];
  const INNER_EARS = [
    [[145.1, -66.2], [145.4, -68.2], [146.6, -69.4], [147.6, -68.5], [147.6, -66.6]],
    [[138.6, -66], [138.6, -68.2], [139.7, -69.7], [140.9, -69], [141.4, -66.4]],
  ];
  // Eye: small and almond, set high, a third of the way back from the nose, under a slight brow.
  const EYE = { x: 149.4, y: -57.3, rx: 1.6, ry: 0.65, tilt: 0.2 };
  const BROW = [[146.8, -59.2], [149.4, -59.9], [151.8, -59.1]];
  const NOSE = [[159, -49], [160.2, -48.5], [160.8, -47.3], [160.5, -46.2], [159.4, -45.9], [158.7, -47.1]];
  const NECK = [131, -55];
  const HEAD_PITCH = 0.6;
  const BODY_PIVOT = [88, -45];

  // Legs: root joint, two bones to the wrist or hock, then the foot to the ball of the paw.
  // Front: elbow behind, straight sturdy forearm. Hind: knee forward, raised heel (hock) on a long foot.
  const FRONT = { root: [116, -42], a: 18.5, b: 18.1, toe: 119.5, foot: [4.2, 4.6], r: [10.5, 7.4, 4.7, 3.6], bend: 1, paw: 1.3 };
  const HIND = { root: [56, -47], a: 20.2, b: 20.7, toe: 64.5, foot: [8, 10.4], r: [14.5, 8.4, 4.5, 3.4], bend: -1, paw: 1.32, heel: true };
  // Tail: thick at the root, tapering; hangs at about 45 degrees standing, lifts toward level when running.
  const TAIL = {
    base: [46, -51],
    pts: [[47, -52], [41, -43.5], [35.6, -34.5], [30.6, -25.5], [26.2, -16.5], [22.6, -9], [20.6, -5.2]],
    r: [5.8, 5.3, 4.7, 4, 3.2, 2.3, 1.3],
  };
  // A broad paw: heel pad and four toes as discs, claws at the toe fronts. Paw frame: x forward, y down.
  const TOES = [[4.9, -1.2, 1.15], [3.6, -1.25, 1.2], [2.3, -1.3, 1.25], [1, -1.35, 1.25]];
  const PAD = [-0.4, -2.1, 2.1];
  const INSTEP = [2, -2.4, 2];

  // Trot, as in the 1933 footage: diagonal pairs, the far legs a touch late.
  const LEGS = [
    { def: HIND, off: 0, far: false },
    { def: FRONT, off: 0.04, far: true },
    { def: HIND, off: 0.5, far: true },
    { def: FRONT, off: 0.54, far: false },
  ];

  /* Dark bands: 15, from just behind the shoulder to the tail base, drawn as bars: a broad dark bar at each band,
     a narrow light bar between. Longest mid-back, shorter at the ends. One band is the amber bar. */
  const BANDS = { n: 15, from: 103, to: 39, amber: 9 };
  const BAND_LEN = [9, 11, 12.6, 14, 15, 15.6, 16, 16, 15.6, 15, 14, 12.4, 10.6, 9, 8];

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

  // All polygons share one winding (clockwise on screen), so a nonzero fill or clip is their union.
  function wind(poly) {
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    if (a < 0) poly.reverse();
    return poly;
  }

  function disc(c, r, n = 12) {
    const p = [];
    for (let j = 0; j < n; j++) p.push([c[0] + Math.cos((j / n) * TAU) * r, c[1] + Math.sin((j / n) * TAU) * r]);
    return wind(p);
  }

  // A tapered capsule along joints: one polygon per bone, each with round ends.
  function capsules(pts, rs, out) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], r0 = rs[i], r1 = rs[i + 1];
      const a = Math.atan2(y1 - y0, x1 - x0), poly = [];
      for (let j = 0; j <= 8; j++) {
        const t = a + Math.PI / 2 + (j / 8) * Math.PI;
        poly.push([x0 + Math.cos(t) * r0, y0 + Math.sin(t) * r0]);
      }
      for (let j = 0; j <= 8; j++) {
        const t = a - Math.PI / 2 + (j / 8) * Math.PI;
        poly.push([x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1]);
      }
      out.push(wind(poly));
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

  // Ball of the paw over one cycle: planted and sliding back, then lifted and swung forward.
  const STANCE = 0.58, STRIDE = 36, LIFT = 9;
  function toe(u, neutral, amp) {
    const S = STRIDE * amp, lift = LIFT * amp;
    u = ((u % 1) + 1) % 1;
    if (u < STANCE) return [neutral + S * (0.5 - u / STANCE), 0, 0];
    const s = ease((u - STANCE) / (1 - STANCE));
    return [neutral + S * (-0.5 + s), -lift * Math.sin(Math.PI * s), Math.sin(Math.PI * s)];
  }

  // Height of the topline at body x, for hanging the bands from the back.
  function backY(x) {
    for (let i = 0; i < BACK_N - 1; i++) {
      const [x0, y0] = BODY[i], [x1, y1] = BODY[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return x < BODY[0][0] ? BODY[0][1] : BODY[BACK_N - 1][1];
  }

  /* pose(phase 0..1, amp 0..1, gape 0..1) -> { polys, layers, bands, detail }. amp 0 is standing. */
  function pose(phase, amp, gape = 0) {
    const g = gape * GAPE_MAX;
    // Running, the body drops and stretches long, the head reaches and bobs, the tail lifts.
    const bob = amp * 3 - amp * 2.2 * (0.5 + 0.5 * Math.cos(2 * TAU * phase));
    const pitch = amp * 0.03 * Math.sin(TAU * phase);
    const stretch = 1 + amp * 0.05;
    const nod = amp * (0.07 + 0.05 * Math.sin(2 * TAU * phase + 0.6)) - g * 0.1;
    const place = (p) => {
      const q = rot([BODY_PIVOT[0] + (p[0] - BODY_PIVOT[0]) * stretch, p[1]], BODY_PIVOT, pitch);
      return [q[0], q[1] + bob];
    };
    const neck = place(NECK);
    const head = (p) => rot(place(p), neck, nod);
    const hinge = head(HINGE);
    const jaw = (p) => rot(head(p), hinge, g);

    const L = { farEar: null, far: [], tail: [], body: null, near: [], head: null, jaw: null, nearEar: null, mouth: null, cheek: null };
    const D = { claws: [], creases: [], teeth: [], tongue: null };

    L.body = wind(spline(BODY.map(place), 5));
    L.head = wind(spline(HEAD.map(head), 4));
    L.jaw = wind(spline(JAW.map(jaw), 4));
    L.nearEar = wind(spline(NEAR_EAR.map(head), 3));
    L.farEar = wind(spline(FAR_EAR.map(head), 3));

    if (g > 0.02) {
      // The open mouth: from the corner along the roof to the nose, back along the lower jaw to the corner.
      const roof = LIP.map(head), floor = JAW.slice(0, JAW_TOP).map(jaw);
      L.mouth = wind([hinge, ...roof.slice().reverse(), ...floor.slice().reverse()]);
      // Skin from the cheek to the lower jaw, so the jaw stays attached as it drops.
      L.cheek = wind(spline([head([HINGE[0] + 1, HINGE[1] - 0.8]), jaw([149, -46.4]), jaw([145, -45.6]), jaw([141.6, -47.2]), head([137, -45.8]), head([138, -49])], 3));
      // Tongue: a lighter shape lying on the floor of the mouth.
      const tg = [[145.4, -48], [150.6, -47.1], [155.6, -46.6], [157, -47.6], [153.4, -49], [148, -49.6], [145.4, -49.2]];
      D.tongue = wind(spline(tg.map(jaw), 3));
      const tooth = (base, dir, x, len, w, tf) => {
        const a = tf([x - w / 2, base(x)]), b = tf([x + w / 2, base(x)]), c = tf([x, base(x) + dir * len]);
        D.teeth.push([a, b, c]);
      };
      const lipY = (x) => {
        for (let i = 0; i < LIP.length - 1; i++) {
          const [x0, y0] = LIP[i], [x1, y1] = LIP[i + 1];
          if (x <= x0 && x >= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
        }
        return LIP[LIP.length - 1][1];
      };
      // Teeth only once the mouth is well open; a sliver of gape with teeth in it reads as whiskers.
      if (gape > 0.35) {
        TEETH_UP.forEach(([x, len, w]) => tooth(lipY, 1, x, len, w, head));
        TEETH_LO.forEach(([x, len, w]) => tooth(lipY, -1, x, len, w, jaw));
      }
    }

    const sway = amp * (0.8 + 0.05 * Math.sin(TAU * phase + 2));
    const base = place(TAIL.base);
    const tail = TAIL.pts.map((p, i) => rot(rot(place(p), base, sway), base, i * amp * 0.02 * Math.sin(TAU * phase + 1)));
    capsules(tail, TAIL.r, L.tail);

    for (const leg of LEGS) {
      const d = leg.def, k = leg.far ? 0.9 : 1, front = d === FRONT;
      const spread = (leg.far ? (front ? -5 : 10) * (1 - amp) : 0) + amp * (front ? 8 : -8);
      const r0 = place(d.root);
      const [tx, ty, sw] = toe(phase + leg.off, d.toe + spread, amp);
      // Mid-swing the foot folds under and the toes curl; planted, the paw lies flat.
      const fx = d.foot[0] * (1 - 1.6 * sw), fy = d.foot[1] * (1 - 0.12 * sw);
      const ankle = [tx - fx, ty - fy];
      const knee = ik(r0, ankle, d.a, d.b, d.bend);
      const out = leg.far ? L.far : L.near;
      capsules([r0, knee, ankle, [tx, ty]], d.r.map((r) => r * k), out);
      if (d.heel) out.push(disc([ankle[0] - 1.8, ankle[1] + 0.6], 3.6 * k, 10));
      if (!front) out.push(disc([knee[0] + 1, knee[1] + 1], 7.6 * k, 14));
      // The paw.
      const curl = sw * 0.9, ps = d.paw * k;
      const pf = (p) => rot([tx + p[0] * ps, ty + p[1] * ps], [tx, ty], curl);
      out.push(disc(pf(PAD), PAD[2] * ps, 12));
      out.push(disc(pf(INSTEP), INSTEP[2] * ps, 12));
      for (const t of TOES) {
        out.push(disc(pf(t), t[2] * ps, 10));
        D.claws.push({ far: leg.far, pts: [pf([t[0] + t[2] * 0.6, t[1] - 0.5]), pf([t[0] + t[2] * 0.85, t[1] + 0.45]), pf([t[0] + t[2] * 1.45, t[1] + 1.05])] });
      }
      if (!leg.far) {
        // Elbow point and hock: short creases where the joint folds.
        if (front) D.creases.push([[knee[0] - 3.4, knee[1] - 3], [knee[0] - 4.4, knee[1] + 0.6], [knee[0] - 2.2, knee[1] + 4]]);
        else D.creases.push([[ankle[0] - 2.6, ankle[1] - 4], [ankle[0] - 4.2, ankle[1] + 0.2], [ankle[0] - 2.6, ankle[1] + 2.8]]);
      }
    }

    const e = head([EYE.x, EYE.y]);
    D.eye = { x: e[0], y: e[1], rx: EYE.rx, ry: EYE.ry, a: nod + EYE.tilt };
    D.brow = BROW.map(head);
    D.nose = wind(spline(NOSE.map(head), 3));
    D.innerEars = INNER_EARS.map((ear) => wind(spline(ear.map(head), 3)));
    D.lip = g > 0.02 ? null : LIP.map(head);

    // Everything is barred: far ear and far legs in shadow; tail, body, near legs, head, near ear and cheek in
    // the coat; the lower jaw as its own group. The open mouth is a dark wedge behind the bars.
    // The lower jaw at rest, in the head's frame: the page paints its bars there and turns them about the
    // hinge by the gape, so the jaw keeps its own straight bars as it drops.
    const jawRest = wind(spline(JAW.map(head), 4));
    const polys = [L.farEar, ...L.far, ...L.tail, L.body, ...L.near, L.head, L.jaw, L.nearEar];
    if (L.mouth) polys.push(L.mouth, L.cheek);
    const coat = [...L.tail, L.body, ...L.near, L.head, L.nearEar];
    if (L.cheek) coat.push(L.cheek);
    return {
      polys, far: [L.farEar, ...L.far], coat, mouth: L.mouth, jaw: { rest: jawRest, hinge, angle: g }, detail: D, body: L.body,
    };
  }

  /* Spans each column covers. xs: column x positions. out: Float32Array(xs.length * MAX * 2), counts: Uint8Array. */
  const MAX = 4;
  const ys = new Float64Array(64);
  const iv = new Float64Array(256);
  function spans(polys, xs, out, counts) {
    for (let c = 0; c < xs.length; c++) {
      const x = xs[c];
      let ni = 0;
      for (const poly of polys) {
        let n = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
          if ((xi > x) !== (xj > x) && n < 64) ys[n++] = yi + ((x - xi) / (xj - xi)) * (yj - yi);
        }
        if (n < 2) continue;
        const sorted = Array.prototype.slice.call(ys, 0, n).sort((p, q) => p - q);
        for (let i = 0; i + 1 < n && ni < 254; i += 2) { iv[ni++] = sorted[i]; iv[ni++] = sorted[i + 1]; }
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

  /* Column layout for n bars across the box. Plain, even bars in front of and behind the banded stretch; in it,
     two bars per band: a broad one on the band (dark, or the amber one) and a narrow light one between.
     Returns { xs, ws, kind, depth }: centre and width in model units, kind 0 plain, 1 dark, 2 light, 3 amber,
     and for a dark bar how far down from the back its dark part reaches. */
  function layout(n) {
    const per = (BANDS.from - BANDS.to) / (BANDS.n - 1);
    const zA = BANDS.to - per / 2, zB = BANDS.from + per / 2;
    const rest = n - BANDS.n * 2, lenL = zA - BOX.x0, lenR = BOX.x1 - zB;
    const nL = Math.round((rest * lenL) / (lenL + lenR)), nR = rest - nL;
    const xs = [], ws = [], kind = [], depth = [];
    const push = (x, w, k, d) => { xs.push(x); ws.push(w); kind.push(k); depth.push(d); };
    for (let i = 0; i < nL; i++) push(BOX.x0 + ((i + 0.5) * lenL) / nL, (lenL / nL) * 0.66, 0, 0);
    for (let i = BANDS.n - 1; i >= 0; i--) {
      const x = BANDS.from - i * per;
      // Broad dark-topped bar, narrow light bar, and a gap of 0.16 of the band after each: the same bar to
      // gap ratio as the plain bars (about 2 to 1), so the legs under the bands stay clearly barred.
      push(x, per * 0.44, i === BANDS.amber ? 3 : 1, BAND_LEN[i]);
      push(x + per / 2, per * 0.24, 2, 0);
    }
    // In front of the bands the pitch holds through the shoulder, then narrows over the neck to HEAD_PITCH of
    // itself across the head, so the muzzle and ears keep enough bars to read. Same bar to gap ratio throughout.
    const pR = lenR / nR;
    const pitch = (x) => pR * (1 - (1 - HEAD_PITCH) * Math.min(1, Math.max(0, (x - 118) / 14)));
    for (let x = zB + pR / 2; x < BOX.x1; x += pitch(x + pitch(x) / 2)) push(x, pitch(x) * 0.66, 0, 0);
    return { xs, ws, kind, depth };
  }

  // Coat tone along the body: 0 at the shoulders and tail tip, 1 over the rump and lower back.
  const rear = (x) => Math.min(1, Math.max(0, (112 - x) / 26)) * Math.min(1, Math.max(0, (x - 10) / 14));

  const api = { BOX, MAX, GAPE_MAX, GAPE_DEG, BANDS, STRIDE, STANCE, pose, spans, layout, rear };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Thylacine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
