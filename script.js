(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.stage');
  const main = document.querySelector('main');
  const bars = stage ? [...stage.querySelectorAll('.field i')] : [];
  if (!stage || !main || reduce.matches || !bars.length) return;

  const intro = stage.querySelector('.copy');
  const scenes = [intro, ...main.querySelectorAll('section')];
  const labels = ['Intro', 'Build', 'Projects', 'Contact'];
  const last = scenes.length - 1;

  // Bar heights per scene, as a fraction of the field. Index 6 is the amber bar.
  const shapes = [
    [.34, .52, .41, .68, .57, .82, 1, .76, .63, .71, .48, .39, .27],
    [.20, .30, .24, .36, .28, .33, .50, .33, .42, .36, .44, .38, .46],
    [.06, .08, .05, .09, .06, .07, .55, .07, .05, .08, .06, .09, .05],
    [.28, .36, .32, .44, .38, .50, .58, .50, .38, .44, .32, .36, .28],
  ];

  const film = document.createElement('div');
  film.className = 'film';
  film.style.setProperty('--n', scenes.length);
  stage.before(film);
  film.append(stage);
  stage.append(main);
  document.documentElement.classList.add('film-on');

  const rail = document.createElement('div');
  rail.className = 'rail';
  rail.setAttribute('role', 'group');
  rail.setAttribute('aria-label', 'Scenes');
  const fills = labels.map((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="lab">${name}</span><span class="bar"><span class="fill"></span></span>`;
    b.addEventListener('click', () => go(i));
    rail.append(b);
    return b;
  });
  stage.append(rail);

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const span = () => film.offsetHeight - innerHeight;
  const go = (i, smooth = true) => {
    const y = film.offsetTop + (i / last) * span();
    scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  };

  let target = 0;
  let shown = 0;
  let running = false;

  const paint = (p) => {
    scenes.forEach((el, i) => {
      const o = clamp(1 - Math.abs(p - i) * 2.2, 0, 1);
      el.style.setProperty('--o', o.toFixed(3));
      el.style.setProperty('--y', `${((i - p) * 2).toFixed(3)}rem`);
      el.classList.toggle('on', o > 0.02);
      el.inert = o < 0.5;
    });
    const a = Math.min(Math.floor(p), last - 1);
    const t = p - a;
    const k = t * t * (3 - 2 * t);
    // The headline is wider than the clear space below 1024px, so keep the intro bars low there.
    const scale = (i) => (i === 0 && innerWidth < 1024 ? 0.5 : 1);
    bars.forEach((bar, n) => {
      const from = shapes[a][n] * scale(a);
      const h = from + (shapes[a + 1][n] * scale(a + 1) - from) * k;
      bar.style.setProperty('--h', `${(h * 100).toFixed(2)}%`);
    });
    fills.forEach((b, i) => {
      b.firstElementChild.nextElementSibling.firstElementChild.style.transform =
        `scaleX(${clamp(p - i + 1, 0, 1).toFixed(3)})`;
      b.toggleAttribute('aria-current', Math.round(p) === i);
    });
  };

  const tick = () => {
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.0008) shown = target;
    paint(shown);
    if (shown !== target) requestAnimationFrame(tick);
    else running = false;
  };
  const kick = () => {
    if (!running) { running = true; requestAnimationFrame(tick); }
  };
  const read = () => {
    const s = span();
    target = s > 0 ? clamp((scrollY - film.offsetTop) / s, 0, 1) * last : 0;
    kick();
  };

  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', read);

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const i = id === 'top' ? 0 : scenes.findIndex((s) => s.id === id);
      if (i < 0) return;
      e.preventDefault();
      go(i);
    });
  });

  reduce.addEventListener('change', () => location.reload());

  const start = scenes.findIndex((s) => s.id && s.id === location.hash.slice(1));
  if (start > 0) go(start, false);
  read();
  shown = target;
  paint(shown);
})();
