(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.stage');
  const main = document.querySelector('main');
  if (!stage || !main || reduce.matches) return;
  if (!document.createElement('canvas').getContext || !window.Thylacine) return;

  /* ---------- Frames: one screen per idea ---------- */

  const intro = stage.querySelector('.copy');
  const build = main.querySelector('#scene-build');
  const [rowOwn, rowClient] = build.querySelectorAll('.row');
  const projects = main.querySelector('#scene-projects');
  const contact = main.querySelector('#scene-contact');

  // Each frame: the scene that owns it, the parts that move, and its rail label.
  const frames = [
    { scene: intro, parts: [intro], label: 'Thylacine' },
    { scene: build, parts: [rowOwn], label: 'Products' },
    { scene: build, parts: [rowClient], label: 'Clients' },
    { scene: projects, parts: [projects.querySelector('.body')], label: 'Projects' },
    { scene: contact, parts: [contact.querySelector('.body')], label: 'Contact' },
  ];
  const last = frames.length - 1;
  const heads = new Map([[build, build.querySelector('h2')], [projects, projects.querySelector('h2')], [contact, contact.querySelector('h2')]]);

  // Split headings into words so the type can move as a crowd, not a slab.
  const split = (el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      el.append(s);
      if (i < words.length - 1) el.append(' ');
    });
  };
  [intro.querySelector('h1'), rowOwn.querySelector('h3'), rowClient.querySelector('h3'), projects.querySelector('.empty')].forEach(split);

  // Movers inside each frame, in reading order. Each gets its own lag.
  frames.forEach((f) => {
    f.movers = [];
    f.parts.forEach((p) => p.querySelectorAll('.eyebrow, .w, li').forEach((m) => f.movers.push(m)));
  });

  /* ---------- Build the film ---------- */

  const film = document.createElement('div');
  film.className = 'film';
  film.style.setProperty('--n', frames.length);
  stage.before(film);
  film.append(stage);
  stage.append(main);

  const canvas = document.createElement('canvas');
  canvas.className = 'world';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  stage.prepend(canvas);
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.setAttribute('aria-hidden', 'true');
  stage.append(scrim);
  const grain = document.createElement('div');
  grain.className = 'grain';
  grain.setAttribute('aria-hidden', 'true');
  stage.append(grain);
  document.documentElement.classList.add('film-on');

  const rail = document.createElement('div');
  rail.className = 'rail';
  rail.setAttribute('role', 'group');
  rail.setAttribute('aria-label', 'Scenes');
  const fills = frames.map((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="lab" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="bar"><span class="fill"></span></span>`;
    b.setAttribute('aria-label', f.label);
    b.addEventListener('click', () => go(i));
    rail.append(b);
    return b;
  });
  stage.append(rail);

  /* ---------- Tokens: read OKLCH from CSS, mix in OKLCH ---------- */

  const css = getComputedStyle(document.documentElement);
  const tok = (name) => {
    const m = css.getPropertyValue(name).match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    return m ? [+m[1], +m[2], +m[3]] : [0.5, 0, 0];
  };
  const C = {
    deep: tok('--bg-deep'), sky: tok('--sky'), body: tok('--body'),
    stripeHi: tok('--stripe-hi'), fur: tok('--fur'), furHi: tok('--fur-hi'), band: tok('--band'),
    glow: tok('--glow'), rim: tok('--glow-rim'), accent: tok('--accent'), tongue: tok('--tongue'), light: tok('--fur-light'),
    shade: tok('--fur-shade'), belly: tok('--belly'), mouth: tok('--mouth'), tooth: tok('--tooth'), eye: tok('--eye'),
  };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ok = (c, a = 1) => `oklch(${c[0].toFixed(4)} ${c[1].toFixed(4)} ${c[2].toFixed(2)} / ${a.toFixed(3)})`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- The stripes and the animal ----------
     Frame 1 is a row of plain, even, vertical stripes, one amber. Scrolling on, each stripe moves to its own
     column of the animal and takes the spans the silhouette covers there, so the stripes become the animal's
     bars. Then it walks. The silhouette comes from thylacine.js: a parametric skeleton, sampled column by column.
     The body stays built of bars with gaps between them; the smooth outline clips their ends so no edge steps.
     The head and jaws are bars on the same grid, finer over the head; the lower jaw turns about one hinge. */

  const T = window.Thylacine;
  const SPAN = T.BOX.x1 - T.BOX.x0;
  const TOP = 80; // ear tip plus bob and the raised head of the gape, in model units

  // Per frame: where the animal stands (fraction of width), how bright the light is, how fast it runs.
  const keysWide = [
    { x: 0.62, light: 0.7, run: 0 },
    { x: 0.64, light: 0.6, run: 0 },
    { x: 0.62, light: 0.66, run: 1 },
    { x: 0.6, light: 0.38, run: 1 },
    { x: 0.66, light: 1, run: 0 },
  ];
  const keysTall = keysWide.map((k) => ({ ...k, x: 0.5 }));

  let W = 0, H = 0, dpr = 1, keys = keysWide, boxes = [], N = 80, nBase = 0, xs = [], ws = [], kinds = [], amberK = 0, barPaths = null;
  let ground = 0, scales = [], barDepth = [];
  let E = new Float32Array(0), X = E, TOPS = E, BOTS = E, CN = new Uint8Array(0);
  const cache = new Map();

  const size = () => {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    keys = W / H < 0.9 ? keysTall : keysWide;
    // Text boxes come from the words themselves, so ragged lines count.
    boxes = frames.map((f) => {
      let bottom = 0;
      f.parts.forEach((p) => {
        const prev = p.style.transform;
        p.style.transform = 'none';
        const ms = [...p.querySelectorAll('.eyebrow, .w, li, a')];
        const saved = ms.map((m) => m.style.transform);
        ms.forEach((m) => { m.style.transform = ''; });
        ms.forEach((m) => {
          const range = document.createRange();
          range.selectNodeContents(m);
          bottom = Math.max(bottom, range.getBoundingClientRect().bottom - r.top);
        });
        ms.forEach((m, n) => { m.style.transform = saved[n]; });
        p.style.transform = prev;
      });
      return bottom;
    });
    // Feet stand on a line above the rail and CTA. The animal fits between that line and the text.
    ground = H - clamp(H * 0.15, 96, 150);
    const maxW = W / H < 0.9 ? W * 0.94 : Math.min(W * 0.58, 820);
    scales = boxes.map((b) => Math.max(0.5, Math.min(maxW / SPAN, (ground - b - H * 0.05) / TOP)));
    const n = clamp(Math.round(maxW / 5), 72, 112);
    if (n !== nBase || !xs.length) {
      nBase = n;
      // The animal's bars: even in front and behind, a broad and a narrow bar per band over the back, finer
      // over the head.
      const lay = T.layout(n);
      N = lay.xs.length;
      xs = lay.xs; ws = lay.ws; kinds = lay.kind;
      // The amber stripe in the opening row becomes the amber bar on the rump.
      amberK = kinds.indexOf(3);
      barPaths = null;
      barDepth = lay.depth;
      E = new Float32Array(N); X = new Float32Array(N); CN = new Uint8Array(N);
      TOPS = new Float32Array(N * T.MAX); BOTS = new Float32Array(N * T.MAX);
      cache.clear();
    }
    gaitTable();
  };

  // A pose, cached on a grid of phase, stride and gape so no frame rebuilds geometry it has seen:
  // the spans each column covers, the outline as one path for the clip, and the painted layers.
  const PH = 48, AM = 6, GP = 24;
  const toPath = (polys) => {
    const path = new Path2D();
    for (const poly of polys) {
      path.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) path.lineTo(poly[i][0], poly[i][1]);
      path.closePath();
    }
    return path;
  };
  const spansFor = (phase, amp, gape) => {
    const pi = ((Math.round(phase * PH) % PH) + PH) % PH;
    const ai = Math.round(clamp(amp, 0, 1) * (AM - 1));
    const gi = ai ? 0 : Math.round(clamp(gape, 0, 1) * GP);
    const key = (ai * PH + (ai ? pi : 0)) * (GP + 1) + gi;
    let hit = cache.get(key);
    if (!hit) {
      const geo = T.pose(ai ? pi / PH : 0, ai / (AM - 1), gi / GP);
      hit = { key, out: new Float32Array(N * T.MAX * 2), counts: new Uint8Array(N), geo };
      T.spans(geo.polys, xs, hit.out, hit.counts);
      hit.path = toPath(geo.polys);
      hit.body = toPath([geo.body]);
      hit.far = toPath(geo.far);
      hit.coat = toPath(geo.coat);
      hit.jaw = toPath([geo.jaw.rest]);
      if (geo.mouth) hit.mouth = toPath([geo.mouth]);
      const D = geo.detail;
      hit.ear = toPath(D.innerEars);
      hit.nose = toPath([D.nose]);
      hit.teeth = toPath(D.teeth);
      hit.claws = toPath(D.claws.map((c) => c.pts));
      if (D.tongue) hit.tongue = toPath([D.tongue]);
      cache.set(key, hit);
    }
    return hit;
  };

  // Paints that live in model space, so they follow the animal at any size. Made once.
  let paints = null;
  const makePaints = () => {
    const { x0, x1 } = T.BOX;
    const coat = ctx.createLinearGradient(x0, 0, x1, 0);
    for (let x = x0; x <= x1; x += 6) coat.addColorStop((x - x0) / (x1 - x0), ok(mix(C.fur, C.furHi, T.rear(x))));
    const belly = ctx.createLinearGradient(0, -37, 0, -22);
    belly.addColorStop(0, ok(C.belly, 0));
    belly.addColorStop(1, ok(C.belly, 0.4));
    const shade = (x, y, r, c, a) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, ok(c, a));
      gr.addColorStop(1, ok(c, 0));
      return [gr, x, y, r];
    };
    paints = {
      coat, belly, light: ok(C.light), mouth: ok(C.mouth), tooth: ok(C.tooth), tongue: ok(C.tongue), eye: ok(C.eye), band: ok(C.band), farShade: ok(C.shade, 0.1),
      // Shoulder and chest fall into shadow under the light; the haunch catches it on top.
      shades: [shade(113, -26, 14, C.band, 0.22), shade(58, -52, 15, C.furHi, 0.25)],
    };
  };

  // Colours, mixed once per frame from the tokens.
  const col = { amber: ok(C.accent) };

  // Sky and light are redrawn only when they change.
  const sky = document.createElement('canvas');
  const sg = sky.getContext('2d');
  let skyKey = '';
  const paintSky = (light, gx) => {
    const key = `${W}|${H}|${Math.round(ground)}|${light.toFixed(2)}|${Math.round(gx / 8)}`;
    if (key === skyKey) return;
    skyKey = key;
    sky.width = canvas.width; sky.height = canvas.height;
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = sg.createLinearGradient(0, 0, 0, ground);
    g.addColorStop(0, ok(C.deep));
    g.addColorStop(0.55, ok(C.deep));
    g.addColorStop(1, ok(mix(C.deep, C.sky, 0.2 + 0.55 * light)));
    sg.fillStyle = g;
    sg.fillRect(0, 0, W, ground);
    const gr = sg.createLinearGradient(0, ground, 0, H);
    gr.addColorStop(0, ok(mix(C.body, C.sky, 0.25 * light)));
    gr.addColorStop(0.5, ok(C.deep));
    sg.fillStyle = gr;
    sg.fillRect(0, ground, W, H - ground);
    sg.save();
    sg.translate(gx, ground);
    sg.scale(1, 0.3);
    const rad = Math.max(W, H) * 0.6;
    const gl = sg.createRadialGradient(0, 0, 0, 0, 0, rad);
    gl.addColorStop(0, ok(C.glow, 0.5 * light));
    gl.addColorStop(0.45, ok(C.glow, 0.1 * light));
    gl.addColorStop(1, ok(C.glow, 0));
    sg.fillStyle = gl;
    sg.fillRect(-rad, -rad, rad * 2, rad * 2);
    sg.restore();
    const rim = sg.createLinearGradient(0, 0, W, 0);
    rim.addColorStop(0, ok(C.rim, 0));
    rim.addColorStop(clamp(gx / W, 0.1, 0.9), ok(C.rim, 0.8 * light));
    rim.addColorStop(1, ok(C.rim, 0));
    sg.fillStyle = rim;
    sg.fillRect(0, ground, W, 1);
  };

  let phase = 0, travel = 0, runNow = 0, sNow = 1;

  const frameAt = (p) => {
    const a = Math.min(Math.floor(p), last - 1);
    const t = smooth(clamp(p - a, 0, 1));
    return { a, t, A: keys[a], B: keys[a + 1] };
  };

  const draw = (p, rise) => {
    const { a, t, A, B } = frameAt(p);
    const light = lerp(A.light, B.light, t) * rise;
    const s = a === 0 ? scales[1] : lerp(scales[a], scales[a + 1], t);
    sNow = s;
    const cx = lerp(A.x, B.x, t) * W;
    const ax = cx - (SPAN * s) / 2 - T.BOX.x0 * s; // screen x of model x = 0
    // m: the stripes become the animal's bars. f: the bars take their final paint.
    const m = smooth(clamp(p / 0.85, 0, 1));
    const f = smooth(clamp((m - 0.9) / 0.1, 0, 1));

    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    paintSky(light, cx);
    g.drawImage(sky, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ground marks: rows of short dashes. The top row moves with the planted feet; nearer rows faster.
    for (let r = 0; r < 4; r++) {
      const y = ground + 7 + r * 7 + r * r * 4;
      const gap = 42 + r * 22, len = 8 + r * 6;
      const off = (((travel * [1, 1.25, 1.6, 2.1][r]) % gap) + gap) % gap;
      g.fillStyle = ok(C.rim, (0.16 + r * 0.05) * light);
      for (let x = -off; x < W; x += gap) g.fillRect(x, y, len, 1);
    }

    const hit = spansFor(phase, runNow, gapeNow);
    const MX = T.MAX;
    if (!paints) makePaints();
    const P = paints;

    if (f < 0.999) {
      const fieldL = W / H < 0.9 ? 16 : Math.max(16, W * 0.05);
      const pitch0 = (W - 2 * fieldL) / N;
      const top0 = clamp(boxes[0] + H * 0.06, H * 0.42, ground - 40);
      // Pass 1: each stripe moves from its place in the row to its column of the animal and takes the spans
      // the silhouette covers there. A column with no span sinks into the ground.
      for (let k = 0; k < N; k++) {
        // Tail end leads, head follows, so the animal assembles from the back like a wave.
        const e = smooth(clamp(m * 1.5 - (k / N) * 0.5, 0, 1));
        const grow = smooth(clamp(rise * 2 - (k / N) * 0.8, 0, 1));
        const t0 = lerp(ground, top0, grow);
        const n = hit.counts[k];
        E[k] = e;
        X[k] = lerp(fieldL + (k + 0.5) * pitch0, ax + xs[k] * s, e);
        CN[k] = n;
        if (!n) { TOPS[k * MX] = lerp(t0, ground, e); BOTS[k * MX] = ground; }
        for (let j = 0; j < n; j++) {
          TOPS[k * MX + j] = lerp(t0, ground + hit.out[(k * MX + j) * 2] * s, e);
          BOTS[k * MX + j] = lerp(ground, ground + hit.out[(k * MX + j) * 2 + 1] * s, e);
        }
      }
      const width = (k) => lerp(pitch0 * 0.6, ws[k] * s, E[k]);
      // A stripe in flight is a plain bar. Once it has all but landed, it takes its column of the finished
      // animal (bars cut by the smooth outline), copied from the standing render.
      const img = stillFor(hit, s);
      const ox = ax + T.BOX.x0 * s, oy = ground - TOP * s;
      for (let k = 0; k < N; k++) {
        const e = E[k];
        if (e >= 0.98) {
          const l = k ? (xs[k - 1] + xs[k]) / 2 : T.BOX.x0, r = k < N - 1 ? (xs[k] + xs[k + 1]) / 2 : T.BOX.x1;
          const sx = Math.max(0, Math.floor((l - T.BOX.x0) * s * dpr)), sw = Math.min(img.width - sx, Math.ceil((r - l) * s * dpr) + 1);
          const dx = X[k] - (ax + xs[k] * s);
          if (sw > 0) g.drawImage(img, sx, 0, sw, img.height, ox + dx + sx / dpr, oy, sw / dpr, img.height / dpr);
          continue;
        }
        const w = width(k);
        const to = kinds[k] === 3 ? C.accent : kinds[k] === 2 ? C.light : mix(C.fur, C.furHi, T.rear(xs[k]));
        g.fillStyle = ok(mix(kinds[k] === 3 ? C.accent : C.stripeHi, to, e));
        for (let j = 0; j < Math.max(1, CN[k]); j++) {
          const tt = TOPS[k * MX + j], bb = BOTS[k * MX + j];
          if (bb - tt > 0.5) g.fillRect(X[k] - w / 2, tt, w, bb - tt);
        }
      }
    }

    if (f >= 0.999) {
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ax, dpr * ground);
      drawFormed(g, hit, s, dpr * ax);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  /* Full-height bars, one path per kind, in model units but with both edges on whole device pixels for the
     current scale and position, so every bar and every gap stays crisp at any size (a gap is never under one
     device pixel). ox: device x of model x = 0. Rebuilt only when the scale or the pixel phase changes. */
  let barKey = '';
  const barsAt = (s, ox) => {
    const kk = s * dpr, base = Math.floor(ox), frac = ox - base;
    const key = `${kk.toFixed(4)}|${frac.toFixed(3)}|${N}`;
    if (key === barKey && barPaths) return barPaths;
    barKey = key;
    const top = T.BOX.top - 4, h = -T.BOX.top + 4.5;
    const paths = [0, 1, 2, 3].map(() => new Path2D());
    const L = new Float32Array(N), R = new Float32Array(N);
    let prev = -Infinity;
    for (let k = 0; k < N; k++) {
      let l = Math.round(frac + (xs[k] - ws[k] / 2) * kk), r = Math.round(frac + (xs[k] + ws[k] / 2) * kk);
      if (l < prev + 1) l = prev + 1;
      if (r < l + 1) r = l + 1;
      prev = r;
      L[k] = (l - frac) / kk; R[k] = (r - frac) / kk;
      paths[kinds[k]].rect(L[k], top, R[k] - L[k], h);
    }
    barPaths = paths;
    paths.all = new Path2D();
    paths.forEach((path) => paths.all.addPath(path));
    paths.coat = new Path2D();
    paths.coat.addPath(paths[0]);
    paths.coat.addPath(paths[1]);
    paths.L = L; paths.R = R;
    return paths;
  };

  /* The formed animal, in model space: bars with gaps, cut by the smooth outline. Far legs in shade, then tail,
     body and near legs in the coat, the light bars between bands, the dark band tops, the amber bar, light and
     shade on the bars only. The head and ears are bars on the same grid, finer over the head; the lower jaw is
     its own group of bars that turns about the hinge. Then the detail as small solid marks. */
  const drawFormed = (g, hit, s, ox) => {
    const P = paints, D = hit.geo.detail, px = 1 / s, J = hit.geo.jaw;
    const barPaths = barsAt(s, ox);
    // The dark part of each band bar: from the back down its band's length.
    const dark = new Path2D();
    for (let k = 0; k < N; k++) {
      if (kinds[k] !== 1 || !hit.counts[k]) continue;
      dark.rect(barPaths.L[k], hit.out[k * T.MAX * 2] - 1, barPaths.R[k] - barPaths.L[k], barDepth[k] + 1);
    }
    // Far legs and far ear: the coat's own bars, opaque, a step darker for depth.
    g.save();
    g.clip(hit.far);
    g.fillStyle = P.coat;
    g.fill(barPaths.coat);
    g.fillStyle = P.light;
    g.fill(barPaths[2]);
    g.fillStyle = col.amber;
    g.fill(barPaths[3]);
    g.fillStyle = P.farShade;
    g.fill(barPaths.all);
    g.restore();
    // The open mouth: a dark wedge behind the bars, with the tongue on its floor.
    if (hit.mouth) {
      g.fillStyle = P.mouth;
      g.fill(hit.mouth);
      if (hit.tongue) {
        g.save();
        g.clip(hit.mouth);
        g.fillStyle = P.tongue;
        g.fill(hit.tongue);
        g.restore();
      }
    }
    // The lower jaw: its own bars, laid out at rest and turned about the hinge.
    g.save();
    g.translate(J.hinge[0], J.hinge[1]);
    g.rotate(J.angle);
    g.translate(-J.hinge[0], -J.hinge[1]);
    g.clip(hit.jaw);
    g.fillStyle = P.coat;
    g.fill(barPaths.coat);
    g.restore();
    g.save();
    g.clip(hit.coat);
    g.fillStyle = P.coat;
    g.fill(barPaths.coat);
    g.fillStyle = P.light;
    g.fill(barPaths[2]);
    g.fillStyle = col.amber;
    g.fill(barPaths[3]);
    for (const [gr] of P.shades) { g.fillStyle = gr; g.fill(barPaths.all); }
    g.save();
    g.clip(hit.body);
    g.fillStyle = P.belly;
    g.fill(barPaths.all);
    g.restore();
    g.fillStyle = P.band;
    g.fill(dark);
    g.restore();
    // Detail: small solid marks on the bars, scaled with the animal; the finest drop out at small sizes.
    g.fillStyle = P.band;
    g.fill(hit.ear);
    if (s >= 2.2) g.fill(hit.claws);
    if (s >= 3.2 && D.teeth.length) { g.fillStyle = P.tooth; g.fill(hit.teeth); }
    g.fillStyle = P.eye;
    g.beginPath();
    g.ellipse(D.eye.x, D.eye.y, Math.max(D.eye.rx, 1.3 * px), Math.max(D.eye.ry, 1 * px), D.eye.a, 0, Math.PI * 2);
    g.fill();
    g.fill(hit.nose);
    g.strokeStyle = P.band;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(0.45, 1.1 * px);
    const line = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
    // Closed, the two jaws meet along one dark mouth line.
    if (D.lip) line(D.lip);
    if (s >= 2.4) line(D.brow);
  };

  // The standing animal, rendered once per size, which the landing stripes copy their final look from.
  const still = document.createElement('canvas');
  const stg = still.getContext('2d');
  let stillKey = '';
  const stillFor = (hit, s) => {
    const key = `${s.toFixed(3)}|${dpr}|${N}|${hit.key}`;
    if (key !== stillKey) {
      stillKey = key;
      still.width = Math.ceil(SPAN * s * dpr);
      still.height = Math.ceil((TOP + 4) * s * dpr);
      stg.setTransform(dpr * s, 0, 0, dpr * s, -T.BOX.x0 * s * dpr, TOP * s * dpr);
      drawFormed(stg, hit, s, -T.BOX.x0 * s * dpr);
    }
    return still;
  };

  /* ---------- Type choreography ---------- */

  const paintType = (p, rise) => {
    const seen = new Map();
    frames.forEach((f, i) => {
      const d = p - i; // < 0 arriving, > 0 leaving
      const o = clamp(1 - Math.abs(d) * 2.2, 0, 1) * (i === 0 ? rise : 1);
      seen.set(f.scene, Math.max(seen.get(f.scene) || 0, o));
      f.parts.forEach((part) => {
        part.style.opacity = o.toFixed(3);
        part.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        part.inert = o < 0.5;
        // Leaving: the block drifts up and toward the lens.
        const lift = d > 0 ? d : 0;
        part.style.transform = `translate3d(0, ${(-lift * 4).toFixed(2)}rem, 0) scale(${(1 + lift * 0.12).toFixed(4)})`;
        part.style.filter = Math.abs(d) > 0.02 ? `blur(${(Math.abs(d) * 14).toFixed(1)}px)` : 'none';
      });
      // Words arrive from below on a stagger, so a heading assembles as you scroll.
      const intro0 = i === 0 ? 1 - rise : 0;
      f.movers.forEach((m, n) => {
        const lag = 1 + n * 0.22;
        const y = d < 0 ? -d * 9 * lag : 0;
        const yy = y + intro0 * (3 + n * 0.6);
        m.style.transform = yy > 0.01 ? `translate3d(0, ${yy.toFixed(2)}rem, 0)` : '';
      });
    });
    for (const [scene, o] of seen) {
      scene.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      const h = heads.get(scene);
      if (h) {
        h.style.opacity = o.toFixed(3);
        h.inert = o < 0.5;
      }
    }
    fills.forEach((b, i) => {
      b.querySelector('.fill').style.transform = `scaleX(${clamp(p - i + 1, 0, 1).toFixed(3)})`;
      b.toggleAttribute('aria-current', Math.round(p) === i);
    });
  };

  /* ---------- Scroll to timeline ----------
     Scroll is the timeline, gait included: the legs move only as far as the page moves, backwards when
     scrolling back, and stop when it stops. One gait cycle takes STRIDE_VH of the viewport in scroll. */

  const span = () => film.offsetHeight - innerHeight;
  const go = (i, smoothly = true) => {
    scrollTo({ top: film.offsetTop + (i / last) * span(), behavior: smoothly ? 'smooth' : 'auto' });
  };
  // Each frame holds for the last 30% of its stretch of scroll, so a scene lands and stays.
  const held = (x) => {
    const i = Math.min(Math.floor(x), last);
    return i + clamp((x - i - 0.15) / 0.7, 0, 1);
  };
  const runAt = (p) => {
    const { t, A, B } = frameAt(p);
    return lerp(A.run, B.run, t);
  };

  // Gait distance: scroll pixels weighted by how hard the animal runs there, tabulated per size.
  const STRIDE_VH = 0.34, STEP = 2;
  let gaitTab = new Float32Array(1), spanPx = 1, stridePx = 1;
  const gaitTable = () => {
    spanPx = Math.max(1, span());
    stridePx = innerHeight * STRIDE_VH;
    const n = Math.ceil(spanPx / STEP) + 1;
    gaitTab = new Float32Array(n + 1);
    for (let j = 1; j <= n; j++) {
      const x = clamp(((j - 0.5) * STEP) / spanPx, 0, 1) * last;
      gaitTab[j] = gaitTab[j - 1] + runAt(held(x)) * STEP;
    }
  };
  const gaitAt = (px) => {
    const u = clamp(px, 0, spanPx) / STEP, j = Math.floor(u);
    return lerp(gaitTab[j], gaitTab[Math.min(j + 1, gaitTab.length - 1)], u - j) / stridePx;
  };

  let pxTarget = 0, pxShown = 0, shown = 0, running = false, rise = 0, cycles = 0, gapeNow = 0;
  const t0 = performance.now();
  const RISE_MS = 1600;

  const tick = (now) => {
    // Ease the scroll position, then derive everything from it, so a flick never jumps a frame.
    pxShown += (pxTarget - pxShown) * 0.09;
    if (Math.abs(pxTarget - pxShown) < 0.3) pxShown = pxTarget;
    const r = clamp((now - t0) / RISE_MS, 0, 1);
    rise = 1 - Math.pow(1 - r, 3);
    shown = held((pxShown / spanPx) * last);
    runNow = runAt(shown);
    // Gait follows scroll distance; at most 0.45 of a stride per frame, so legs never strobe backward.
    const want = gaitAt(pxShown);
    const dc = clamp(want - cycles, -0.45, 0.45);
    cycles += dc;
    if (Math.abs(want - cycles) < 1e-4) cycles = want;
    phase = ((cycles % 1) + 1) % 1;
    // The ground moves exactly as far as a planted paw slides back, so the feet stay put on it.
    travel += dc * (T.STRIDE / T.STANCE) * runNow * sNow;
    // At the end it has stopped, and opens its jaws wide, slowly. Scroll back and it closes them.
    const gapeTo = smooth(clamp((shown - (last - 0.2)) / 0.2, 0, 1)) * (1 - runNow);
    gapeNow += (gapeTo - gapeNow) * 0.05;
    if (Math.abs(gapeTo - gapeNow) < 0.002) gapeNow = gapeTo;
    draw(shown, rise);
    paintType(shown, rise);
    if (pxShown !== pxTarget || cycles !== want || gapeNow !== gapeTo || r < 1) requestAnimationFrame(tick);
    else running = false;
  };
  const kick = () => {
    if (!running) { running = true; requestAnimationFrame(tick); }
  };
  const read = () => {
    pxTarget = clamp(scrollY - film.offsetTop, 0, spanPx);
    kick();
  };

  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', () => { size(); read(); draw(shown, rise); paintType(shown, rise); });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const i = id === 'top' ? 0 : frames.findIndex((f) => f.scene.id === id);
      if (i < 0) return;
      e.preventDefault();
      go(i);
    });
  });

  reduce.addEventListener('change', () => location.reload());

  // Film grain, made once.
  const gc = document.createElement('canvas');
  gc.width = gc.height = 160;
  const gg = gc.getContext('2d');
  const img = gg.createImageData(160, 160);
  for (let n = 0; n < img.data.length; n += 4) {
    const v = Math.random() * 255;
    img.data[n] = img.data[n + 1] = img.data[n + 2] = v;
    img.data[n + 3] = 255;
  }
  gg.putImageData(img, 0, 0);
  grain.style.backgroundImage = `url(${gc.toDataURL()})`;

  size();
  const start = frames.findIndex((f) => f.scene.id && f.scene.id === location.hash.slice(1));
  if (start > 0) go(start, false);
  read();
  pxShown = pxTarget;
  cycles = gaitAt(pxShown);
  kick();
  if (document.fonts) document.fonts.ready.then(() => { size(); draw(shown, rise); });
  // Build the running poses ahead of time, a few per idle slice, so scrubbing never waits on geometry.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 50));
  let warm = 0;
  const warmUp = (dl) => {
    while (warm < (AM - 1) * PH && dl.timeRemaining() > 2) {
      spansFor((warm % PH) / PH, (1 + Math.floor(warm / PH)) / (AM - 1), 0);
      warm++;
    }
    if (warm < (AM - 1) * PH) idle(warmUp);
  };
  idle(warmUp);
})();
