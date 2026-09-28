/*
  #transferencia controller (docs/CONCEPTO.md, scene 3). One init per page load; bails out when the section is absent.
  One master timeline (END seconds) holds the whole story. Discrete states are a pure function of its playhead
  (PHASES → data-* on the live figure; CSS does the looks, the transitions and the time-based one-shots: sparks,
  brownout, rewind sweep), continuous ones are tweens inside it (camera, switch arm, operator walk, clock proxy, bleed drift).
    desktop gate + mode=pin : pin +200 %, scrub drives the playhead: normal → falla → manual → rebobinado → ATS
    touch / <768 + mode=pin : the full story plays once at 50 % visible; the control plays one scenario; "Repetir"
    static / reduced motion : nothing to do (the server-rendered figures are the two final states)
*/
import { onPage } from './engine.js';

const END = 13.5;
const ARM = 58.8;      // relative swing of the arm: 0 = contact RED (the resting transform), -ARM = contact GEN
const SPEED = 1.9;     // touch playback: the full story lasts END / SPEED ≈ 7 s
const WALK = [2.6, 5.4];
const SCENES = { manual: [0, 7.4], auto: [9.4, END] };  // touch: what each segment plays
const LABELS = { manual: 1.0, auto: 9.4 };              // desktop: where each segment scrolls to

// [time, changes]; each phase inherits the previous one. Holds are sized so every beat gets ≥ ~100 px of scroll
const RAW = [
  [0, { sc: 'manual', step: 0, grid: 'on', gen: 'off', load: 'on', ats: 'ok', actor: 'idle', rw: 'off' }],
  [1.2, { step: 1, grid: 'fault', load: 'off', ats: 'nored' }],
  [2.2, { grid: 'off' }],
  [2.6, { step: 2, actor: 'walk' }],
  [5.4, { actor: 'operate', ats: 'manual' }],
  [5.6, { gen: 'crank' }],
  [6.1, { gen: 'on' }],
  [6.7, { load: 'on', actor: 'mdone', ats: 'gen' }],
  [7.5, { rw: 'on' }],                                   // rewind band (≈ 200 px at 1280 × 720): the label stays up
  [8.4, { sc: 'auto', step: 3, grid: 'on', gen: 'off', load: 'on', ats: 'ok', actor: 'watch' }],
  [9.4, { rw: 'off' }],
  [9.9, { grid: 'fault', load: 'off', ats: 'detect', actor: 'detect' }],
  [10.3, { grid: 'off', gen: 'crank' }],
  [10.75, { gen: 'on', actor: 'switch' }],
  [11.15, { load: 'on', ats: 'gen', actor: 'adone' }],
];
let acc = {};
const PHASES = RAW.map(([t, s]) => ({ t, ...(acc = { ...acc, ...s }) }));
const ATTRS = ['sc', 'grid', 'gen', 'load', 'ats', 'actor', 'rw'];
const LCD = { ok: 'RED OK', nored: 'SIN RED', manual: 'MANUAL', detect: 'ARRANQUE', gen: 'GEN OK' };
const ACTOR = {
  idle: 'Manual · en espera', walk: 'Operador en camino…', operate: 'Operador en el tablero', mdone: 'Cambio manual hecho',
  watch: 'ATS vigilando la red', detect: 'ATS detecta la falla', switch: 'ATS conmuta a la planta', adone: 'ATS · sin operador',
};
const source = (p) => (p.load === 'off' ? 'Sin energía' : p.gen === 'on' ? 'Planta eléctrica' : 'Red eléctrica');
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

onPage(({ gsap, ScrollTrigger, env, scrollTo }) => {
  const root = document.getElementById('transferencia');
  if (!root || root.dataset.mode !== 'pin' || env.reduced) return;

  const $ = (s, el = root) => el.querySelector(s);
  const fig = $('.tr__fig--manual');
  const stage = $('.tr__stage');
  const cam = $('.tr__cam', fig);
  const arm = $('.arm', fig);
  const op = $('.op', fig);
  const opRest = $('.op-rest', fig);
  const route = $('.op-route', fig);
  const lcd = $('[data-tr-lcd]', fig);
  const srcEl = $('[data-tr-src]', fig);
  const actorEl = $('[data-tr-actor]', fig);
  const clockEl = $('[data-tr-clock]', fig);
  const walkEl = $('.tr__walk', fig);
  const prog = $('.tr__prog');
  const live = $('[data-tr-live]');
  const segs = [...root.querySelectorAll('.tr__seg-btn')];
  const steps = [...root.querySelectorAll('.tr__step')];
  const titles = steps.map((li) => li.querySelector('.tr__step-t').textContent);

  // server-rendered static state, restored on teardown (breakpoint change → the engine reboots into another path)
  const saved = { data: { ...fig.dataset }, root: { ...root.dataset }, op: opRest.getAttribute('transform'), texts: [lcd, srcEl, actorEl, clockEl].map((el) => el.textContent) };
  const off = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); off.push(() => el.removeEventListener(type, fn, opts)); };

  /* ---------- the master timeline ---------- */
  const clk = { s: 0 };
  opRest.setAttribute('transform', ''); // the operator walks in svg coordinates (motionPath x/y)
  const start = route.getPointAtLength(0);
  gsap.set(op, { x: start.x, y: start.y, opacity: 0 });
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: render });
  tl.to({}, { duration: END }, 0);
  Object.entries(LABELS).forEach(([k, t]) => tl.addLabel(k, t));
  // camera: zoom s around the point (fx %, fy %) of the diagram — transform only
  const shot = (t, s, fx, fy, d) => tl.to(cam, { scale: s, xPercent: (1 - s) * (fx - 50), yPercent: (1 - s) * (fy - 50), duration: d, ease: 'power2.inOut' }, t);
  shot(0.6, 1.14, 16, 36, 0.6);   // onto the pylon, the fault lands at 1.2
  shot(2.4, 1.1, 30, 62, 0.9);    // follow the operator's route
  shot(4.6, 1.14, 42, 52, 0.8);   // onto the board as he gets there
  shot(6.4, 1, 50, 50, 0.9);      // pull out: the building lights up again
  shot(9.4, 1.1, 26, 40, 0.5);    // same cut, now with ATS
  shot(10.2, 1.14, 50, 46, 0.45); // the board switches by itself
  shot(11.3, 1, 50, 50, 0.9);     // pull out for the verdict
  // manual: the clock runs until the load is back; the operator walks to the board, opens RED, the plant starts, closes on GEN
  tl.to(clk, { s: 900, duration: 6.7 - 1.2 }, 1.2);
  tl.to(op, { opacity: 1, duration: 0.25 }, WALK[0]);
  tl.to(op, { motionPath: { path: route }, duration: WALK[1] - WALK[0], ease: 'power1.inOut' }, WALK[0]);
  tl.to(arm, { rotation: -ARM / 2, svgOrigin: '452 241', duration: 0.4, ease: 'power2.inOut' }, 5.45);
  tl.to(arm, { rotation: -ARM, svgOrigin: '452 241', duration: 0.45, ease: 'power2.in' }, 6.2);
  // rewind (under the data-rw overlay): the clock spins back, the operator leaves, the arm returns to RED
  tl.to(clk, { s: 0, duration: 0.7, ease: 'power2.in' }, 7.7);
  tl.to(op, { opacity: 0, duration: 0.2 }, 7.8);
  tl.to(arm, { rotation: 0, svgOrigin: '452 241', duration: 0.3, ease: 'power2.out' }, 8.05);
  // ATS: detection, the plant starts, the arm snaps over
  tl.to(clk, { s: 6, duration: 11.15 - 9.9 }, 9.9);
  tl.to(arm, { rotation: -ARM, svgOrigin: '452 241', duration: 0.25, ease: 'power3.in' }, 10.85);
  if (env.desktop) tl.fromTo($('.tr__bleed'), { xPercent: 4 }, { xPercent: -8, duration: END, immediateRender: false }, 0);

  /* ---------- render: discrete state from the playhead, written only on change ---------- */
  let cur = null, lastS = -1, lastW = -1, lastP = -1;
  function apply(ph) {
    const prev = cur;
    cur = ph;
    ATTRS.forEach((k) => { if (fig.dataset[k] !== ph[k]) fig.dataset[k] = ph[k]; });
    root.dataset.sc = ph.sc;
    root.dataset.load = ph.load;
    lcd.textContent = LCD[ph.ats];
    srcEl.textContent = source(ph);
    actorEl.textContent = ACTOR[ph.actor];
    segs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sc === ph.sc)));
    if (!prev || prev.step !== ph.step) {
      root.dataset.step = ph.step;
      steps.forEach((li, i) => li.classList.toggle('is-active', i === ph.step));
      if (prev && live) live.textContent = titles[ph.step];
    }
  }
  function render() {
    const t = tl.time();
    let ph = PHASES[0];
    for (const p of PHASES) if (t >= p.t) ph = p;
    if (ph !== cur) apply(ph);
    const s = Math.round(clk.s);
    if (s !== lastS) { lastS = s; clockEl.textContent = mmss(s); }
    const w = Math.round(clamp01((t - WALK[0]) / (WALK[1] - WALK[0])) * 100);
    if (w !== lastW) { lastW = w; walkEl.style.setProperty('--walk', w / 100); }
    const p = Math.round((t / END) * 400);
    if (p !== lastP && prog) { lastP = p; prog.style.setProperty('--p', p / 400); }
  }
  tl.time(0);
  render();

  // boot: the blueprint draws itself, then the power comes on (removing .is-boot lets the CSS transitions cascade)
  fig.classList.add('is-boot');
  const outline = fig.querySelectorAll('.tower path, .w-base, .ats__box, .ats__plate, .gen__stack, .gen__case, .gen__grille, .gen__skid, .bld__mast, .bld__body, .bld__parapet, .bld__ground, .contact, .pivot');
  const fills = fig.querySelectorAll('.ats__box, .gen__case, .bld__body, .ats__plate');
  const boot = gsap.timeline({ paused: true, onComplete: () => fig.classList.remove('is-boot') })
    .fromTo(outline, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power2.inOut', stagger: { each: 0.01 }, clearProps: 'strokeDasharray,strokeDashoffset' }, 0)
    .fromTo(fills, { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.5, clearProps: 'fillOpacity' }, 0.35)
    .fromTo(fig.querySelectorAll('.win, .arm, .gen__fan, .gen__louver, .tr__lcd, .tr__name, .tr__pole, .led, .beacon'), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: { amount: 0.4, from: 'random' }, clearProps: 'opacity' }, 0.4)
    .fromTo(fig.querySelectorAll('.tr__tag'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, clearProps: 'opacity,transform' }, 0.5);
  const BOOT = boot.duration();

  // pause the CSS loops (current, fan, puffs, LEDs) whenever the scene is off screen
  const vis = new IntersectionObserver(([e]) => root.classList.toggle('is-off', !e.isIntersecting));
  vis.observe(root);

  let player = null, auto = null;
  if (env.desktop) {
    /* ---------- desktop: pinned scrub (a short scrub lag so a flick still shows the states it crosses) ---------- */
    const st = ScrollTrigger.create({ trigger: stage, start: 'top top', end: '+=200%', pin: true, scrub: 0.4, anticipatePin: 1, invalidateOnRefresh: true, animation: tl });
    ScrollTrigger.create({ trigger: stage, start: 'top 75%', once: true, onEnter: () => boot.play() });
    segs.forEach((b) => on(b, 'click', () => scrollTo(st.labelToScroll(b.dataset.sc), { offset: 0 })));
  } else {
    /* ---------- touch / narrow: play once in view, the control replays a scenario ---------- */
    const play = (a, b, delay = 0) => {
      auto?.disconnect();
      player?.kill();
      if (boot.progress() < 1) { boot.play(); delay = Math.max(delay, BOOT - boot.time()); }
      player = tl.tweenFromTo(a, b, { duration: (b - a) / SPEED, ease: 'none', delay });
    };
    auto = new IntersectionObserver(([e]) => { if (e.isIntersecting) play(0, END, 0.2); }, { threshold: 0.5 });
    auto.observe($('.tr__frame', fig));
    segs.forEach((b) => on(b, 'click', () => { play(...SCENES[b.dataset.sc]); if (live) live.textContent = `${b.textContent.trim()}: ${titles[b.dataset.sc === 'auto' ? 3 : 2]}`; }));
    const replay = $('.tr__replay');
    if (replay) on(replay, 'click', () => play(0, END));
  }

  return () => {
    player?.kill();
    auto?.disconnect();
    vis.disconnect();
    off.forEach((f) => f());
    ATTRS.forEach((k) => { if (k in saved.data) fig.dataset[k] = saved.data[k]; else delete fig.dataset[k]; });
    Object.assign(root.dataset, saved.root);
    delete root.dataset.load;
    root.classList.remove('is-off');
    fig.classList.remove('is-boot');
    opRest.setAttribute('transform', saved.op);
    [lcd, srcEl, actorEl, clockEl].forEach((el, i) => { el.textContent = saved.texts[i]; });
    walkEl.style.removeProperty('--walk');
    prog?.style.removeProperty('--p');
    steps.forEach((li, i) => li.classList.toggle('is-active', i === 2));
  };
});
