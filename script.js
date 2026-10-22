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
    b.innerHTML = `<span class="lab">${f.label}</span><span class="bar"><span class="fill"></span></span>`;
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
    glow: tok('--glow'), rim: tok('--glow-rim'), accent: tok('--accent'),
  };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ok = (c, a = 1) => `oklch(${c[0].toFixed(4)} ${c[1].toFixed(4)} ${c[2].toFixed(2)} / ${a.toFixed(3)})`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- The stripes and the animal ----------
     Frame 1 is a row of plain, even, vertical stripes. Scrolling on, each stripe moves to its own column of
     the animal and takes the spans the silhouette covers there, so the stripes become the animal. Then it runs.
     The silhouette comes from thylacine.js: a parametric skeleton, sampled column by column. */

  const T = window.Thylacine;
  const SPAN = T.BOX.x1 - T.BOX.x0;
  const TOP = 75; // ear tip plus bob, in model units

  // Per frame: where the animal stands (fraction of width), how bright the light is, how fast it runs.
  const keysWide = [
    { x: 0.62, light: 0.7, run: 0 },
    { x: 0.64, light: 0.6, run: 0 },
    { x: 0.62, light: 0.66, run: 1 },
    { x: 0.6, light: 0.38, run: 1 },
    { x: 0.66, light: 1, run: 0 },
  ];
  const keysTall = keysWide.map((k) => ({ ...k, x: 0.5 }));

  let W = 0, H = 0, dpr = 1, keys = keysWide, boxes = [], N = 80, xs = [], amberK = 0;
  let ground = 0, scales = [];
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
    if (n !== N || !xs.length) {
      N = n;
      xs = [];
      for (let k = 0; k < N; k++) xs.push(T.BOX.x0 + ((k + 0.5) * SPAN) / N);
      // The amber stripe in the opening row is a column of the amber band on the rump.
      const lit = [];
      for (let k = 0; k < N; k++) if (T.bandAt(xs[k]).amber) lit.push(k);
      amberK = lit[Math.floor(lit.length / 2)] || 0;
      E = new Float32Array(N); X = new Float32Array(N); CN = new Uint8Array(N);
      TOPS = new Float32Array(N * T.MAX); BOTS = new Float32Array(N * T.MAX);
      cache.clear();
    }
  };

  // Spans for a pose, cached on a grid of phase and stride so no frame rebuilds geometry it has seen.
  const PH = 40, AM = 6;
  const spansFor = (phase, amp) => {
    const pi = ((Math.round(phase * PH) % PH) + PH) % PH;
    const ai = Math.round(clamp(amp, 0, 1) * (AM - 1));
    const key = ai * PH + (ai ? pi : 0);
    let hit = cache.get(key);
    if (!hit) {
      hit = { out: new Float32Array(N * T.MAX * 2), counts: new Uint8Array(N) };
      T.spans(T.pose(ai ? pi / PH : 0, ai / (AM - 1)), xs, hit.out, hit.counts);
      cache.set(key, hit);
    }
    return hit;
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

  let phase = 0, travel = 0, runNow = 0;

  const frameAt = (p) => {
    const a = Math.min(Math.floor(p), last - 1);
    const t = smooth(clamp(p - a, 0, 1));
    return { a, t, A: keys[a], B: keys[a + 1] };
  };

  const draw = (p, rise) => {
    const { a, t, A, B } = frameAt(p);
    const light = lerp(A.light, B.light, t) * rise;
    const s = a === 0 ? scales[1] : lerp(scales[a], scales[a + 1], t);
    const cx = lerp(A.x, B.x, t) * W;
    const ax = cx - (SPAN * s) / 2 - T.BOX.x0 * s; // screen x of model x = 0

    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    paintSky(light, cx);
    g.drawImage(sky, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ground marks: rows of short dashes, nearer rows faster, so running reads as travel.
    for (let r = 0; r < 4; r++) {
      const y = ground + 7 + r * 7 + r * r * 4;
      const gap = 42 + r * 22, len = 8 + r * 6;
      const off = (((travel * (0.6 + r * 0.45)) % gap) + gap) % gap;
      g.fillStyle = ok(C.rim, (0.16 + r * 0.05) * light);
      for (let x = -off; x < W; x += gap) g.fillRect(x, y, len, 1);
    }

    // Morph: 0 is the plain row, 1 is the animal. Done by the end of the first scroll stretch.
    const m = smooth(clamp(p / 0.85, 0, 1));
    const sp = spansFor(phase, runNow);
    const pitchA = (SPAN / N) * s;
    const fieldL = W / H < 0.9 ? 16 : Math.max(16, W * 0.05);
    const fieldR = W - fieldL;
    const pitch0 = (fieldR - fieldL) / N;
    const top0 = clamp(boxes[0] + H * 0.06, H * 0.42, ground - 40);

    // Pass 1: where each stripe is and the spans it covers, morphed. A column with no span shrinks into the ground.
    const MX = T.MAX;
    for (let k = 0; k < N; k++) {
      // Tail end leads, head follows, so the animal assembles from the back like a wave.
      const e = smooth(clamp(m * 1.5 - (k / N) * 0.5, 0, 1));
      const grow = smooth(clamp(rise * 2 - (k / N) * 0.8, 0, 1));
      const t0 = lerp(ground, top0, grow);
      const n = sp.counts[k];
      E[k] = e;
      X[k] = lerp(fieldL + (k + 0.5) * pitch0, ax + xs[k] * s, e);
      CN[k] = n;
      if (!n) { TOPS[k * MX] = lerp(t0, ground, e); BOTS[k * MX] = ground; }
      for (let j = 0; j < n; j++) {
        TOPS[k * MX + j] = lerp(t0, ground + sp.out[(k * MX + j) * 2] * s, e);
        BOTS[k * MX + j] = lerp(ground, ground + sp.out[(k * MX + j) * 2 + 1] * s, e);
      }
    }
    // Once formed, each span's ends meet the matching span next door, so outlines run smooth instead of stepping.
    const jump = 6 * s;
    const meet = (arr, k, j, d) => {
      const o = k + d, v = arr[k * MX + j];
      if (o < 0 || o >= N || !CN[o] || !CN[k]) return v;
      for (let i = 0; i < CN[o]; i++) {
        const u = arr[o * MX + i];
        if (Math.abs(u - v) < jump && BOTS[o * MX + i] > TOPS[k * MX + j] && TOPS[o * MX + i] < BOTS[k * MX + j]) return lerp(v, (u + v) / 2, E[k]);
      }
      return v;
    };
    // Pass 2: draw.
    for (let k = 0; k < N; k++) {
      const e = E[k], x = X[k], amber = k === amberK;
      const rearT = clamp((112 - xs[k]) / 26, 0, 1) * clamp((xs[k] - 16) / 10, 0, 1);
      const w = lerp(pitch0 * 0.6, pitchA + 0.6, e);
      const l = x - w / 2, r = x + w / 2;
      g.fillStyle = ok(mix(amber ? C.accent : C.stripeHi, mix(C.fur, C.furHi, rearT), e));
      for (let j = 0; j < Math.max(1, CN[k]); j++) {
        if (BOTS[k * MX + j] - TOPS[k * MX + j] <= 0.5) continue;
        g.beginPath();
        g.moveTo(l, meet(TOPS, k, j, -1));
        g.lineTo(r, meet(TOPS, k, j, 1));
        g.lineTo(r, meet(BOTS, k, j, 1));
        g.lineTo(l, meet(BOTS, k, j, -1));
        g.fill();
      }
      const band = T.bandAt(xs[k]);
      if (band.depth && CN[k] && e > 0.01) {
        // Dark bands from the spine down the flank: on the body a fixed length, on the tail most of its depth.
        const span = BOTS[k * MX] - TOPS[k * MX];
        const depth = xs[k] < 46 ? span * band.depth : Math.min(span, 25 * s * band.depth);
        const d = amber ? Math.max(depth, span * (1 - e)) : depth * e;
        const tl = meet(TOPS, k, 0, -1), tr = meet(TOPS, k, 0, 1);
        // One band is the survivor: amber instead of dark.
        g.fillStyle = band.amber ? (amber ? col.amber : ok(C.accent, e)) : ok(C.band, e);
        g.beginPath();
        g.moveTo(l, tl); g.lineTo(r, tr); g.lineTo(r, tr + d); g.lineTo(l, tl + d);
        g.fill();
      }
    }
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

  /* ---------- Scroll to timeline ---------- */

  const span = () => film.offsetHeight - innerHeight;
  const go = (i, smoothly = true) => {
    scrollTo({ top: film.offsetTop + (i / last) * span(), behavior: smoothly ? 'smooth' : 'auto' });
  };

  let target = 0, shown = 0, running = false, rise = 0;
  const t0 = performance.now();
  const RISE_MS = 1600;

  let prevT = 0;
  const runAt = (p) => {
    const { t, A, B } = frameAt(p);
    return lerp(A.run, B.run, t);
  };
  const tick = (now) => {
    const dt = prevT ? Math.min((now - prevT) / 1000, 0.05) : 0;
    prevT = now;
    const before = shown;
    shown += (target - shown) * 0.09;
    if (Math.abs(target - shown) < 0.0005) shown = target;
    const r = clamp((now - t0) / RISE_MS, 0, 1);
    rise = 1 - Math.pow(1 - r, 3);
    // The gait runs on time, so the animal keeps moving when scrolling stops; scrolling adds a push.
    runNow = runAt(shown);
    const push = Math.abs(shown - before) * 1.5;
    phase = (phase + (dt * 1.5 + push) * runNow) % 1;
    travel += (dt * 1.5 + push) * runNow * 25 * (scales[2] || 1);
    draw(shown, rise);
    paintType(shown, rise);
    if (shown !== target || r < 1 || runNow > 0.01) requestAnimationFrame(tick);
    else { running = false; prevT = 0; }
  };
  const kick = () => {
    if (!running) { running = true; requestAnimationFrame(tick); }
  };
  const read = () => {
    const s = span();
    // Each frame holds for the last 30% of its stretch of scroll, so a scene lands and stays.
    const x = s > 0 ? clamp((scrollY - film.offsetTop) / s, 0, 1) * last : 0;
    const i = Math.min(Math.floor(x), last);
    target = i + clamp((x - i - 0.15) / 0.7, 0, 1);
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
  shown = target;
  kick();
  if (document.fonts) document.fonts.ready.then(() => { size(); draw(shown, rise); });
})();
