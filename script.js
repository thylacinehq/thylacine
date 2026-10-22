(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.stage');
  const main = document.querySelector('main');
  if (!stage || !main || reduce.matches) return;
  if (!document.createElement('canvas').getContext) return;

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

  // Three planes of the same back: far, main, near. Each is its own canvas so focus can be pulled with CSS blur.
  const planes = ['far', 'main', 'near'].map((name) => {
    const c = document.createElement('canvas');
    c.className = `world world-${name}`;
    c.setAttribute('aria-hidden', 'true');
    return { c, g: c.getContext('2d') };
  });
  stage.prepend(...planes.map((p) => p.c));
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
    stripe: tok('--stripe'), lit: tok('--stripe-lit'), glow: tok('--glow'),
    rim: tok('--glow-rim'), accent: tok('--accent'),
  };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const ok = (c, a = 1) => `oklch(${c[0].toFixed(4)} ${c[1].toFixed(4)} ${c[2].toFixed(2)} / ${a.toFixed(3)})`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  // Small fixed jitter per stripe, so the pattern looks grown, not printed.
  const jit = (i, k) => {
    const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ---------- The back ----------
     A curved spine with even, tapering stripes hanging from it. The survivor is stripe 0.
     Keyframes, one per frame. Units: x is a fraction of width; R, sp, len are fractions of U (see size()).
     rot: which stripe sits on the crest. lit, litW: where along the back the light falls, and how wide.
     dim: light on the unlit stripes. glow: overall light. focus: 0 far, 1 main, 2 near.
     drop: extra room between the text and the crest, as a fraction of height. */
  const keysWide = [
    { x: 0.6, R: 1.05, sp: 0.03, len: 0.24, rot: -10, lit: 0, litW: 5, dim: 0.32, glow: 0.7, focus: 1, drop: 0.07, fade: 1 },
    { x: 0.66, R: 0.8, sp: 0.042, len: 0.3, rot: -7, lit: -6, litW: 4, dim: 0.22, glow: 0.55, focus: 2, drop: 0.07, fade: 1 },
    { x: 0.56, R: 2.2, sp: 0.022, len: 0.2, rot: -4.5, lit: 7, litW: 6, dim: 0.22, glow: 0.6, focus: 0, drop: 0.08, fade: 1 },
    { x: 0.62, R: 1.2, sp: 0.032, len: 0.26, rot: -2.5, lit: 0, litW: 0.2, dim: 0.03, glow: 0.3, focus: 1, drop: 0.1, fade: 0.14 },
    { x: 0.7, R: 0.62, sp: 0.07, len: 0.42, rot: 0, lit: 0, litW: 7, dim: 0.28, glow: 1, focus: 1, drop: 0.07, fade: 1 },
  ];
  const keysTall = [
    { x: 0.58, R: 1.7, sp: 0.06, len: 0.42, rot: -4, lit: 0, litW: 3, dim: 0.32, glow: 0.7, focus: 1, drop: 0.06, fade: 1 },
    { x: 0.7, R: 1.3, sp: 0.08, len: 0.5, rot: -3, lit: -3, litW: 2.5, dim: 0.22, glow: 0.55, focus: 2, drop: 0.06, fade: 1 },
    { x: 0.5, R: 3.2, sp: 0.045, len: 0.36, rot: -2, lit: 3, litW: 3, dim: 0.22, glow: 0.6, focus: 0, drop: 0.07, fade: 1 },
    { x: 0.55, R: 1.9, sp: 0.06, len: 0.45, rot: -1.2, lit: 0, litW: 0.2, dim: 0.03, glow: 0.3, focus: 1, drop: 0.1, fade: 0.14 },
    { x: 0.62, R: 1.1, sp: 0.12, len: 0.7, rot: 0, lit: 0, litW: 4, dim: 0.28, glow: 1, focus: 1, drop: 0.06, fade: 1 },
  ];

  let W = 0, H = 0, U = 0, dpr = 1, keys = keysWide, boxes = [];

  const size = () => {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    U = Math.min(W, H * 1.5);
    dpr = Math.min(devicePixelRatio || 1, 2);
    planes.forEach(({ c }) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    keys = W / H < 0.9 ? keysTall : keysWide;
    // The crest sits under each frame's text. Boxes come from the words themselves, so ragged lines count.
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
  };

  const camAt = (p) => {
    const a = Math.min(Math.floor(p), last - 1);
    const t = smooth(clamp(p - a, 0, 1));
    const A = keys[a], B = keys[a + 1];
    const c = {};
    for (const k in A) c[k] = lerp(A[k], B[k], t);
    // Crest height: below whichever text is on screen. Uses the larger of the two during a cut.
    const crestOf = (i) => clamp(boxes[i] + keys[i].drop * H, 0.5 * H, 0.82 * H);
    c.y = lerp(crestOf(a), crestOf(a + 1), t);
    return c;
  };

  // Draw one back. o: crest x, y, radius, spacing, length, rotation, light, and which plane.
  const back = (g, o) => {
    const { x, y, R, sp, len, rot, light, dim, lit, litW, rise, survivor, alpha, fade = 1 } = o;
    const cy = y + R;
    const step = sp / R;
    const reach = Math.min(Math.PI * 0.62, Math.asin(Math.min(1, (Math.max(x, W - x) + sp * 2) / R)) + step * 2);

    // Body under the spine, so planes behind are hidden by it.
    const body = g.createLinearGradient(0, y, 0, Math.min(cy, y + H));
    body.addColorStop(0, ok(mix(C.body, C.sky, 0.25 * light), alpha));
    body.addColorStop(0.5, ok(C.body, alpha));
    body.addColorStop(1, ok(C.deep, alpha));
    g.fillStyle = body;
    g.beginPath();
    g.arc(x, cy, R, 0, Math.PI * 2);
    g.fill();

    // Stripes: even spacing along the spine, hanging inward, tapering to a point.
    const i0 = Math.floor(rot - reach / step), i1 = Math.ceil(rot + reach / step);
    for (let i = i0; i <= i1; i++) {
      const a = (i - rot) * step;
      if (Math.abs(a) > reach) continue;
      const sa = Math.sin(a), ca = Math.cos(a);
      const px = x + R * sa, py = cy - R * ca;
      if (py > H + 40) continue;
      const tx = ca, ty = sa;        // along the spine
      const nx = -sa, ny = ca;       // into the body
      const grow = smooth(clamp(rise * 2.2 - Math.abs(i - rot) * 0.04, 0, 1));
      const l = len * (0.94 + 0.12 * jit(i, 1)) * grow;
      if (l < 1) continue;
      const w0 = sp * (0.4 + 0.08 * jit(i, 2));
      const sx = px + nx * w0 * 0.3, sy = py + ny * w0 * 0.3;
      const curl = l * (0.06 + 0.04 * jit(i, 3));
      const ex = sx + nx * l - tx * curl, ey = sy + ny * l - ty * curl;
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const isAmber = survivor && i === 0;
      const L = isAmber ? 1 : dim + (1 - dim) * Math.exp(-(((i - rot - lit) / Math.max(litW, 0.01)) ** 2));
      const col = isAmber ? C.accent : mix(C.stripe, C.lit, clamp(L * light, 0, 1));
      const a0 = isAmber ? alpha : alpha * fade;
      const grad = g.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, ok(col, a0));
      grad.addColorStop(0.55, ok(col, a0 * (isAmber ? 1 : 0.85)));
      grad.addColorStop(1, ok(col, isAmber ? alpha * 0.5 : 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(sx - tx * w0 / 2, sy - ty * w0 / 2);
      g.quadraticCurveTo(mx - tx * w0 * 0.42, my - ty * w0 * 0.42, ex, ey);
      g.quadraticCurveTo(mx + tx * w0 * 0.42, my + ty * w0 * 0.42, sx + tx * w0 / 2, sy + ty * w0 / 2);
      g.closePath();
      g.fill();
      if (isAmber) {
        // A soft light around the survivor, held to its own column.
        const rr = Math.max(w0 * 2.2, 18);
        g.save();
        g.translate(mx, my);
        g.rotate(Math.atan2(ey - sy, ex - sx));
        g.scale((l * 0.62) / rr, 1);
        const halo = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        halo.addColorStop(0, ok(C.accent, 0.22 * alpha));
        halo.addColorStop(1, ok(C.accent, 0));
        g.fillStyle = halo;
        g.fillRect(-rr, -rr, rr * 2, rr * 2);
        g.restore();
      }
    }

    // The spine, lit from behind.
    g.lineCap = 'round';
    g.strokeStyle = ok(C.rim, 0.12 * light * alpha);
    g.lineWidth = 10;
    g.beginPath();
    g.arc(x, cy, R, -Math.PI / 2 - reach, -Math.PI / 2 + reach);
    g.stroke();
    g.strokeStyle = ok(C.rim, 0.85 * light * alpha);
    g.lineWidth = 1.25;
    g.stroke();
  };

  const draw = (p, rise) => {
    const k = camAt(p);
    const light = k.glow * rise;
    const R = k.R * U, sp = k.sp * U, len = k.len * U;
    const X = k.x * W;
    const [far, mainP, near] = planes.map((pl) => {
      pl.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      pl.g.clearRect(0, 0, W, H);
      return pl.g;
    });

    // Sky on the far plane: dark overhead, warm low light behind the crest.
    const sky = far.createLinearGradient(0, 0, 0, k.y);
    sky.addColorStop(0, ok(C.deep));
    sky.addColorStop(0.6, ok(C.deep));
    sky.addColorStop(1, ok(mix(C.deep, C.sky, 0.25 + 0.6 * light)));
    far.fillStyle = sky;
    far.fillRect(0, 0, W, H);
    far.save();
    far.translate(X, k.y);
    far.scale(1, 0.32);
    const rad = Math.max(W, H) * 0.7;
    const gl = far.createRadialGradient(0, 0, 0, 0, 0, rad);
    gl.addColorStop(0, ok(C.glow, 0.5 * light));
    gl.addColorStop(0.4, ok(C.glow, 0.12 * light));
    gl.addColorStop(1, ok(C.glow, 0));
    far.fillStyle = gl;
    far.fillRect(-rad, -rad, rad * 2, rad * 2);
    far.restore();

    // Far: a second back behind, flatter and finer, sliding slower.
    back(far, {
      x: X - W * 0.18 + k.rot * sp * 0.15, y: k.y - H * 0.035, R: R * 1.5, sp: sp * 0.62, len: len * 0.55,
      rot: k.rot * 0.6 + 3.5, light: light * 0.55, dim: k.dim, lit: k.lit * 0.6, litW: Math.max(k.litW, 4),
      rise, survivor: false, alpha: 0.9, fade: k.fade,
    });
    // Main: the back the story follows, carrying the survivor.
    back(mainP, { x: X, y: k.y, R, sp, len, rot: k.rot, light, dim: k.dim, lit: k.lit, litW: k.litW, rise, survivor: true, alpha: 1, fade: k.fade });
    // Near: a shoulder at the bottom edge, large and soft, moving fastest.
    back(near, {
      x: W * 0.08 - k.rot * sp * 0.9, y: H * 0.93, R: R * 0.7, sp: sp * 2.4, len: len * 1.6,
      rot: k.rot * 1.6, light: light * 0.4, dim: 0.5, lit: 0, litW: 30, rise, survivor: false, alpha: 1, fade: k.fade,
    });

    // Focus pull: the plane at `focus` is sharp, the others fall off with distance from it.
    const b = (n) => Math.abs(n - k.focus);
    planes[0].c.style.filter = `blur(${(b(0) * 3.5).toFixed(2)}px)`;
    planes[1].c.style.filter = b(1) > 0.02 ? `blur(${(b(1) * 4).toFixed(2)}px)` : 'none';
    planes[2].c.style.filter = `blur(${(3 + b(2) * 5).toFixed(2)}px)`;
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

  const tick = (now) => {
    shown += (target - shown) * 0.09;
    if (Math.abs(target - shown) < 0.0005) shown = target;
    const r = clamp((now - t0) / RISE_MS, 0, 1);
    rise = 1 - Math.pow(1 - r, 3);
    draw(shown, rise);
    paintType(shown, rise);
    if (shown !== target || r < 1) requestAnimationFrame(tick);
    else running = false;
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
