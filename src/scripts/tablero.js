/*
  #tablero controller (docs/CONCEPTO.md, scene 2). Registered once from Tablero.astro via onPage(initTablero).
    desktop gate + mode=pin : pin +220 %, scrub. Door, traces (DrawSVG), sparks (MotionPath) and the meter needle are
                              timeline tweens; breaker / card / final states are classes toggled once per threshold so
                              the lever "clack", the card landing and the LEDs run as CSS transitions (compositor only).
                              Trace geometry is measured once per refresh (never inside the scroll handler).
    touch / <768 + mode=pin : sticky compact board; an IntersectionObserver flips each breaker as its card crosses the middle.
    static / reduced motion : the CSS final state (all ON); a breaker scrolls to its card and flashes it.
*/
const A = [0.16, 0.4, 0.64]; // stage i: breaker i flips at A[i]
const RUN = 0.12;            // trace draw + spark ride after the flip
const ON_AT = 0.9;           // "Sistema energizado"
const LABELS = { intro: 0, s1: A[0] + 0.15, s2: A[1] + 0.15, s3: A[2] + 0.15, on: 0.96 };
const LOAD = [0, 0.3, 0.58, 0.84]; // illustrative load after n circuits (the UI says "Simulación ilustrativa")
const deg = (f) => -45 + 90 * f;  // meter scale: -45° … 45°

export function initTablero({ gsap, ScrollTrigger, env, scrollTo, onRefresh }) {
  const root = document.getElementById('tablero');
  if (!root) return;
  const $$ = (s) => [...root.querySelectorAll(s)];
  const brks = $$('.tb-brk');
  const cards = $$('.tb-card');
  const bars = $$('.tb-prog__bars i');
  const wires = $$('.tb-wire');
  const needle = root.querySelector('.tb-meter__needle');
  const off = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); off.push(() => el.removeEventListener(type, fn, opts)); };

  // a breaker and its card light up together on hover
  const pick = (e) => { const el = e.target.closest?.('.tb-brk, .tb-card'); return el ? +el.dataset.i - 1 : -1; };
  const hover = (i, v) => { brks[i]?.classList.toggle('is-hover', v); cards[i]?.classList.toggle('is-hover', v); };
  on(root, 'pointerover', (e) => { const i = pick(e); if (i >= 0) hover(i, true); });
  on(root, 'pointerout', (e) => { const i = pick(e); if (i >= 0) hover(i, false); });

  let flashT = 0;
  const flash = (i) => {
    clearTimeout(flashT);
    cards.forEach((c, k) => c.classList.toggle('is-flash', k === i));
    flashT = setTimeout(() => cards[i].classList.remove('is-flash'), 1600);
  };

  if (root.dataset.mode !== 'pin' || env.reduced) {
    brks.forEach((b, i) => on(b, 'click', () => { scrollTo(cards[i]); flash(i); }));
    return () => { clearTimeout(flashT); off.forEach((f) => f()); };
  }

  /* ---------- shared state (n circuits closed, c = card on top, fin = system energized) ---------- */
  const cur = { n: -1, c: -1, fin: null };
  function state(n, c, fin) {
    if (n !== cur.n) {
      brks.forEach((b, i) => { b.dataset.on = String(i < n); }); // visual only: a breaker is a link to its stage/card, not a toggle
      root.classList.toggle('is-live', n > 0);
      root.style.setProperty('--load', LOAD[n]);
    }
    if (c !== cur.c) {
      root.dataset.step = c;
      cards.forEach((el, i) => {
        el.classList.toggle('is-active', i === c - 1);
        el.classList.toggle('is-past', i < c - 1);
        el.style.setProperty('--depth', Math.max(0, c - 1 - i));
      });
      wires.forEach((w, i) => w.classList.toggle('is-live', i < c));
      bars.forEach((b, i) => b.classList.toggle('is-on', i < c));
    }
    if (fin !== cur.fin) root.classList.toggle('is-on', fin);
    cur.n = n; cur.c = c; cur.fin = fin;
  }
  const reset = () => {
    clearTimeout(flashT);
    off.forEach((f) => f());
    brks.forEach((b) => { b.dataset.on = 'true'; b.classList.remove('is-hover'); });
    cards.forEach((el) => { el.classList.remove('is-active', 'is-past', 'is-hover', 'is-flash'); el.style.removeProperty('--depth'); });
    wires.forEach((w) => w.classList.remove('is-live'));
    bars.forEach((b) => b.classList.remove('is-on'));
    root.classList.remove('is-live', 'is-on');
    root.style.removeProperty('--load');
    root.dataset.step = 3;
  };

  /* ---------- touch / narrow: sticky board + cards ---------- */
  if (!env.desktop) {
    const foot = root.querySelector('.tb__foot');
    const panel = root.querySelector('.tb__panelcol');
    const setNeedle = (n) => needle && gsap.to(needle, { rotation: deg(LOAD[n]), svgOrigin: '50 72', duration: 0.9, ease: 'back.out(2.2)', overwrite: true });
    const go = (n, fin) => { if (n !== cur.n) setNeedle(n); state(n, n, fin); };
    // a card energizes as it crosses the middle band; scrolling back above card 1 opens everything again
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = cards.indexOf(e.target) + 1;
        if (e.isIntersecting) go(i, cur.fin);
        else if (i === 1 && e.boundingClientRect.top > 0) go(0, false);
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    cards.forEach((el) => io.observe(el));
    // "Sistema energizado" as soon as the closing block rises into the lower part of the screen
    const ioFin = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) go(3, true);
      else if (e.boundingClientRect.top > 0 && cur.fin) go(3, false);
    }, { rootMargin: '0px 0px -18% 0px' });
    ioFin.observe(foot);
    gsap.set(needle, { rotation: deg(0), svgOrigin: '50 72' });
    state(0, 0, false);
    // a breaker brings its card just under the sticky board. The column's padding-top is the header's room: scrolling
    // down hides the header and the board follows it up (CSS), so the board ends that much higher (read at click time)
    brks.forEach((b, i) => on(b, 'click', () => {
      const h = panel.offsetHeight, hdr = parseFloat(getComputedStyle(panel).paddingTop) || 0;
      const down = cards[i].getBoundingClientRect().top > h - hdr + 12;
      scrollTo(cards[i], { offset: -(h - (down ? hdr : 0) + 12) });
      flash(i);
    }));
    return () => { io.disconnect(); ioFin.disconnect(); reset(); };
  }

  /* ---------- desktop: pinned scrub ---------- */
  const stage = root.querySelector('.tb__stage');
  const svg = root.querySelector('.tb__wires');
  const panel = root.querySelector('.tb-panel');
  const cab = root.querySelector('.tb-cab');
  const duct = root.querySelector('.tb-duct');
  const deck = root.querySelector('.tb__deck');
  const door = root.querySelector('.tb-door');
  const light = root.querySelector('.tb-cab__light');
  const dormant = root.querySelector('.tb-wires__dormant');
  const gland = root.querySelector('.tb-gland');
  const base = $$('.tb-wire__base');
  const starts = brks.map((b) => b.querySelector('.tb-brk__term'));
  const part = (cls) => wires.map((w) => w.querySelector(cls));
  const [halo, live, flow, comet, term, spark] = ['.tb-wire__halo', '.tb-wire__live', '.tb-wire__flow', '.tb-wire__comet', '.tb-wire__term', '.tb-spark'].map(part);

  // circuits: breaker top terminal → up into the duct (breaker 1 takes the top lane so nothing crosses) → out of the
  // cabinet → 45° fan-out (the brand's diagonal ray) → the deck's terminal strip. Stage coordinates, 1 unit = 1 px.
  // Measured with the board's entrance transform neutralised (one forced layout per refresh, never while scrolling).
  let geo = '';
  function measure() {
    const prev = panel.style.transform;
    panel.style.transform = 'none';
    const s = stage.getBoundingClientRect();
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, w: r.width, h: r.height }; };
    const d = R(duct), c = R(cab), k = R(deck);
    const p = starts.map(R);
    panel.style.transform = prev;
    const x0 = c.r + 14, xt = k.l - 2;
    const S = Math.max(10, Math.min(40, (xt - x0) / 2.6));
    const mid = d.t + d.h / 2;
    const lanes = [-1, 0, 1].map((j) => mid + j * d.h * 0.26);
    const ys = [-1, 0, 1].map((j) => mid + j * S);
    const f = (v) => Math.round(v * 10) / 10;
    const ds = p.map((q, i) => {
      const x = f(q.l + q.w / 2), y = f(q.t + q.h / 2), L = f(lanes[i]), r = Math.min(9, (y - L) / 2);
      return `M${x} ${y}V${f(L + r)}Q${x} ${L} ${f(x + r)} ${L}H${f(x0)}L${f(x0 + Math.abs(ys[i] - L))} ${f(ys[i])}H${f(xt)}`;
    });
    const key = `${f(s.width)}x${f(s.height)}|${ds.join('|')}`;
    if (key === geo) return false;
    geo = key;
    svg.setAttribute('viewBox', `0 0 ${f(s.width)} ${f(s.height)}`);
    ds.forEach((dd, i) => [base[i], halo[i], live[i], flow[i], comet[i]].forEach((el) => el.setAttribute('d', dd)));
    term.forEach((t, i) => { t.setAttribute('cx', f(xt)); t.setAttribute('cy', f(ys[i])); });
    gland.setAttribute('x', f(c.r - 7)); gland.setAttribute('y', f(mid - 15));
    return true;
  }
  measure();

  // the transform pin rewrites the section's translate every scroll frame: on its own compositor layer that is a
  // compositor-only update, otherwise the whole viewport-sized section is repainted into the page layer each frame.
  // Promoted from the entrance (so the layer is rastered before the pin starts) to the end of the pin, never elsewhere.
  const lift = { in: false, pin: false };
  const promote = (k, v) => { lift[k] = v; root.style.willChange = lift.in || lift.pin ? 'transform' : ''; };

  // entrance (before the pin): the board rises and settles back from a slight tilt
  gsap.fromTo(panel, { y: 70, rotateX: 12, transformPerspective: 1400, transformOrigin: '50% 100%' }, {
    y: 0, rotateX: 0, ease: 'power2.out',
    scrollTrigger: { trigger: root, start: 'top bottom', end: 'top top', scrub: true, onToggle: (st) => promote('in', st.isActive) },
  });

  let tl = null;
  const sync = () => {
    if (!tl) return; // ScrollTrigger may render while the timeline is still being built
    const p = tl.progress();
    const n = A.filter((a) => p >= a).length;
    const c = A.filter((a) => p >= a + RUN - 0.012).length;
    state(n, c, p >= ON_AT);
  };
  tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: root, start: 'top top', end: '+=220%', pin: true, pinType: 'transform', scrub: true, anticipatePin: 1, invalidateOnRefresh: true, onToggle: (st) => promote('pin', st.isActive) },
    onUpdate: sync,
  });
  Object.entries(LABELS).forEach(([k, v]) => tl.addLabel(k, v));
  tl.to({}, { duration: 1 }, 0); // 0..1 timeline; every position below is a fraction of the pin
  // intro: the door swings open, the cabinet light comes on, the dormant circuits appear
  tl.fromTo(door, { rotateY: 0 }, { rotateY: -100, duration: 0.13, ease: 'power2.inOut' }, 0.01);
  tl.fromTo(light, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.08);
  tl.fromTo(dormant, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.1);
  tl.fromTo(term, { opacity: 0, scale: 0, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.04, stagger: 0.01, ease: 'back.out(3)' }, 0.11);
  // explicit from→to everywhere (only the first tween per target renders immediately): a refresh invalidates the
  // timeline and must not re-record a start value from the current, mid-scroll state
  A.forEach((a, i) => {
    const t0 = a + 0.012;
    tl.fromTo([halo[i], live[i]], { drawSVG: '0%' }, { drawSVG: '100%', duration: RUN, ease: 'power1.in' }, t0);
    tl.fromTo(comet[i], { drawSVG: '0% 0%' }, { drawSVG: '92% 100%', duration: RUN, ease: 'power1.in' }, t0);
    tl.fromTo([spark[i], comet[i]], { opacity: 0 }, { opacity: 1, duration: 0.008 }, t0);
    tl.to(spark[i], { motionPath: { path: live[i], align: live[i], alignOrigin: [0.5, 0.5] }, duration: RUN, ease: 'power1.in' }, t0);
    tl.fromTo([spark[i], comet[i]], { opacity: 1 }, { opacity: 0, duration: 0.014, immediateRender: false }, t0 + RUN - 0.004);
    tl.fromTo(needle, { rotation: deg(LOAD[i]), svgOrigin: '50 72' }, { rotation: deg(LOAD[i + 1]), svgOrigin: '50 72', duration: RUN * 0.9, ease: 'back.out(2.4)', immediateRender: i === 0 }, t0 + 0.01);
  });
  // pre-warm: initialise every tween now (DrawSVG lengths, MotionPath caches) instead of on the first scroll into each stage
  tl.progress(1, true).progress(0, true);
  sync();

  // after every refresh (ScrollTrigger rewinds and restores the timeline with events suppressed): re-measure; new paths
  // → DrawSVG / MotionPath must re-read them (render through 0 so every tween re-initialises); then re-sync the classes
  // a refresh also swaps the pinned section out of / back into its pin-spacer (DOM re-parenting), which drops keyboard
  // focus inside it (resize while a breaker or card link is focused): remember it and put it back
  let held = null;
  const hold = () => { held = root.contains(document.activeElement) ? document.activeElement : null; };
  ScrollTrigger.addEventListener('refreshInit', hold);
  off.push(() => ScrollTrigger.removeEventListener('refreshInit', hold));
  onRefresh(() => {
    if (measure()) { const p = tl.progress(); tl.invalidate(); tl.progress(0, true); tl.progress(p, true); }
    sync();
    if (held && held.isConnected && document.activeElement !== held) held.focus({ preventScroll: true });
    held = null;
  });

  // breakers jump to their stage; focusing a breaker behind the closed door, a card that is not on top (or the final
  // CTA) brings it into view
  const jump = (label, immediate) => tl.scrollTrigger && scrollTo(tl.scrollTrigger.labelToScroll(label), { offset: 0, immediate });
  brks.forEach((b, i) => on(b, 'click', () => jump(`s${i + 1}`)));
  // keyboard focus only (:focus-visible): a mouse click focuses the button too, and its jump must stay a smooth scrub
  brks.forEach((b, i) => on(b, 'focusin', () => { if (cur.c < i + 1 && b.matches(':focus-visible')) jump(`s${i + 1}`, true); }));
  on(deck, 'focusin', (e) => { const i = cards.indexOf(e.target.closest('.tb-card')); if (i >= 0 && cur.c !== i + 1) jump(`s${i + 1}`, true); });
  on(root.querySelector('.tb-final'), 'focusin', () => { if (!cur.fin) jump('on', true); });
  on(root.querySelector('.tb__intro'), 'focusin', () => { if (cur.c !== 0) jump('intro', true); });

  return () => { reset(); root.style.willChange = ''; };
}
