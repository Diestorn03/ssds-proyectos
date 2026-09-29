// #diagnostico controller: 4-step questionnaire → analog meter → result card with a prefilled WhatsApp message.
// Registered from components/home/Diagnostico.astro via onPage(initDiagnostico). Rules: src/data/diagnostico.js.
import { recommend, zoneOf, questions } from '../data/diagnostico.js';
import { services, wa } from '../data/site.js';

const PIVOT = '200 206';   // gauge pivot in the SVG viewBox (see Diagnostico.astro)
const PIVOT_Y = 206 / 232; // pivot height as a fraction of the face
const ZONE_KEY = { Programable: 'lo', Recomendado: 'mid', Prioritario: 'hi' };
const list = (items) => new Intl.ListFormat('es', { type: 'conjunction' }).format(items);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function initDiagnostico({ gsap, ScrollTrigger, env, scrollTo }) {
  const root = document.getElementById('diagnostico');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const form = $('[data-dg-form]'), steps = $$('[data-dg-step]'), next = $('[data-dg-next]'), back = $('[data-dg-back]');
  const nextLbl = $('[data-dg-next-lbl]'), track = $('[data-dg-track]'), nodes = $$('[data-dg-node]');
  const countN = $('[data-dg-n]'), stepLbl = $('[data-dg-steplbl]');
  const card = $('[data-dg-card]'), res = $('[data-dg-res]'), scan = $('[data-dg-scan]'), live = $('[data-dg-live]');
  const meter = $('[data-dg-meter]'), face = $('[data-dg-face]'), flash = $('[data-dg-flash]'), plate = $('[data-dg-plate]');
  const needle = $('[data-dg-needle]'), arcs = $$('[data-dg-arc]'), val = $('[data-dg-val]'), zoneEl = $('[data-dg-zone]');
  const zoneArcs = $$('[data-dg-z]'), leds = $$('[data-dg-led]');
  const reduced = env.reduced;
  const narrow = matchMedia('(max-width: 959px)'), stacked = matchMedia('(min-width: 560px)');
  // tweens created in event handlers live outside the engine's gsap.context: track them for cleanup, drop finished ones
  const tweens = new Set();
  const keep = (t) => { tweens.forEach((x) => { if (x.progress() === 1 && !x.isActive()) tweens.delete(x); }); tweens.add(t); return t; };
  const last = steps.length - 1;
  let cur = 0, done = false, needleTw = null, stepTl = null;
  const m = { v: 0 };   // needle value, 0..100 (may overshoot while springing)
  let shown = -1;       // number on the LCD: rewritten only when the rounded value changes (each write is a text layout)

  /* ---------- meter ---------- */
  function renderMeter() {
    const v = clamp(m.v, -1.5, 101.5);   // the stop pins
    needle.setAttribute('transform', `rotate(${(v - 50).toFixed(2)} ${PIVOT})`);
    const off = String(100 - clamp(m.v, 0, 100));
    arcs.forEach((a) => { a.style.strokeDashoffset = off; });
    const n = Math.round(clamp(m.v, 0, 100));
    if (n !== shown) { shown = n; val.textContent = n; }
  }
  function setMeter(p, { sweep = false } = {}) {
    needleTw?.kill();
    if (reduced) { m.v = p; renderMeter(); return; }
    needleTw = keep(sweep
      ? gsap.timeline()
        .to(m, { v: 100, duration: 0.5, ease: 'power2.in', onUpdate: renderMeter })
        .to(m, { v: p, duration: 1.8, ease: 'elastic.out(1, 0.32)', onUpdate: renderMeter })
      : gsap.to(m, { v: p, duration: 1.4, ease: 'elastic.out(1, 0.38)', onUpdate: renderMeter }));
  }
  function charge(p) { root.style.setProperty('--charge', (p / 100).toFixed(3)); }

  const answers = () => ({
    lugar: form.elements.lugar.value,
    necesidad: $$('input[name="necesidad"]:checked').map((i) => i.value),
    planta: form.elements.planta.value,
    tamano: form.elements.tamano.value,
  });
  const anyAnswer = () => !!form.querySelector('input:checked');

  // needle, zone, LEDs and the background ray follow the answers given so far
  function apply({ sweep = false } = {}) {
    const r = recommend(answers());
    const on = anyAnswer();
    const zone = on ? zoneOf(r.priority) : '';
    meter.dataset.zone = ZONE_KEY[zone] || '';
    const zoneTxt = zone || 'En espera';
    if (zoneEl.textContent !== zoneTxt) zoneEl.textContent = zoneTxt;   // its <p> is aria-live: speak only real changes
    zoneArcs.forEach((z) => z.classList.toggle('is-on', z.dataset.dgZ === ZONE_KEY[zone]));
    const slugs = new Set(r.services.map((s) => s.slug));
    leds.forEach((l) => l.classList.toggle('is-on', slugs.has(l.dataset.dgLed)));
    charge(r.priority);
    setMeter(r.priority, { sweep });
    return r;
  }
  function hit() {
    if (reduced) return;
    keep(gsap.fromTo(flash, { opacity: 1, scale: 0.5 }, { opacity: 0, scale: 1.3, duration: 0.7, ease: 'power2.out' }));
  }

  /* ---------- chip feedback: pop, spark, and a charge that flies to the meter ---------- */
  function pop(chip) {
    if (reduced) return;
    keep(gsap.fromTo(chip, { scale: 0.965 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.45)', clearProps: 'transform' }));
    const rays = chip.querySelectorAll('.dg-spark line');
    keep(gsap.fromTo(rays, { drawSVG: '0% 0%', opacity: 1 }, { drawSVG: '55% 100%', opacity: 0, duration: 0.55, ease: 'power2.out', stagger: 0.012 }));
  }
  const flying = new Set();
  function fly(chip, land) {
    const fr = face.getBoundingClientRect();
    if (reduced || fr.bottom < 0 || fr.top > innerHeight) { land(); return; }
    const a = chip.querySelector('.dg-brk').getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = fr.left + fr.width / 2, y1 = fr.top + fr.height * PIVOT_Y;
    const cx = (x0 + x1) / 2 + (y1 < y0 ? (x1 - x0) * 0.1 : 0), cy = Math.min(y0, y1) - Math.max(60, Math.abs(x1 - x0) * 0.25);
    const dots = [0, 1, 2, 3].map((i) => {
      const d = document.createElement('span');
      d.className = `dg-fly${i ? ' dg-fly--tail' : ''}`;
      d.setAttribute('aria-hidden', 'true');
      d.style.setProperty('--s', String(1 - i * 0.2));
      document.body.appendChild(d);
      flying.add(d);
      return d;
    });
    dots.forEach((d, i) => {
      const o = { t: 0 };
      keep(gsap.to(o, {
        t: 1, duration: 0.55, delay: i * 0.035, ease: 'power1.inOut',
        onUpdate() {
          const t = o.t, u = 1 - t;
          d.style.transform = `translate3d(${u * u * x0 + 2 * u * t * cx + t * t * x1}px,${u * u * y0 + 2 * u * t * cy + t * t * y1}px,0) scale(${1 - 0.4 * t})`;
        },
        onComplete() { d.remove(); flying.delete(d); if (i === 0) land(); },
      }));
    });
  }

  function onChange(e) {
    const input = e.target;
    if (done || !input.matches('input')) return;
    syncNav();
    const chip = input.closest('.dg-opt');
    if (input.checked) { pop(chip); fly(chip, () => { apply(); hit(); if (env.coarse) navigator.vibrate?.(8); }); } else apply();
  }

  /* ---------- steps ---------- */
  const answered = (i) => !!steps[i].querySelector('input:checked');
  function syncNav() {
    next.disabled = !answered(cur);
    back.disabled = cur === 0;
    nextLbl.textContent = cur === last ? 'Ver mi diagnóstico' : 'Siguiente';
  }
  function syncTrack() {
    track.style.setProperty('--p', String(cur / last));
    nodes.forEach((n, i) => { n.classList.toggle('is-done', i < cur); n.classList.toggle('is-current', i === cur); });
    countN.textContent = cur + 1;
    stepLbl.textContent = questions[cur].step;
  }
  const focusStep = (el) => (el.querySelector('input:checked') || el.querySelector('input'))?.focus({ preventScroll: true });
  function setStep(to) {
    steps.forEach((s, i) => { s.classList.toggle('is-active', i === to); s.inert = i !== to; s.classList.remove('is-leaving'); });
  }
  function go(to) {
    if (to === cur || to < 0 || to > last) return;
    const dir = to > cur ? 1 : -1, from = steps[cur], nx = steps[to];
    cur = to;
    syncTrack(); syncNav();
    if (dir > 0 && !reduced) keep(gsap.fromTo(nodes[to - 1].querySelector('.dg-node__dot'), { scale: 0.6 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.45)', clearProps: 'transform' }));
    stepTl?.progress(1);
    setStep(to);
    focusStep(nx);
    if (narrow.matches) reveal(card);   // under the sticky strip: bring the new question into view
    if (reduced) return;
    if (!stacked.matches) {   // < 560px: steps are not stacked, the old one just goes away
      stepTl = keep(gsap.timeline()
        .fromTo(nx, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out', clearProps: 'transform,opacity' })
        .fromTo(nx.querySelectorAll('.dg-opt'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.8)', stagger: 0.05, clearProps: 'transform,opacity' }, 0.06));
      return;
    }
    from.classList.add('is-leaving');
    stepTl = keep(gsap.timeline()
      .to(from, { x: -36 * dir, opacity: 0, duration: 0.26, ease: 'power2.in' })
      .add(() => { from.classList.remove('is-leaving'); gsap.set(from, { clearProps: 'transform,opacity' }); })
      .fromTo(nx, { x: 56 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.14)
      .fromTo(nx.querySelectorAll('.dg-opt'), { y: 18, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.8)', stagger: 0.05, clearProps: 'transform,opacity' }, 0.2));
  }
  function onSubmit(e) {
    e.preventDefault();
    if (done || !answered(cur)) return;
    if (cur < last) go(cur + 1); else finish();
  }
  // Enter on a radio / checkbox moves on (native forms only do that for text fields)
  function onKey(e) {
    if (e.key !== 'Enter' || !e.target.matches('input')) return;
    e.preventDefault();
    if (!next.disabled) form.requestSubmit();
  }
  const onBack = () => go(cur - 1);

  /* ---------- result ---------- */
  const say = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };
  // where content starts below the header (and, under 960px, below the stuck meter strip)
  const stickyTop = () => {
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    return narrow.matches ? h + 8 + meter.offsetHeight : h;
  };
  function reveal(el) {
    const r = el.getBoundingClientRect(), top = stickyTop();
    if (r.top < top || r.top > innerHeight * 0.7) scrollTo(el, { offset: -top - 12, immediate: reduced });
  }
  function fill(r) {
    const a = answers();
    const opt = (qi, v) => { const o = questions[qi].options.find((x) => x.v === v); return o?.s || o?.t || ''; };
    const svcList = $('[data-dg-svcs]');
    r.services.forEach((s) => {
      const li = svcList.querySelector(`[data-dg-svc="${s.slug}"]`);
      li.hidden = false;
      li.querySelector('[data-dg-why]').textContent = s.reason;
      svcList.appendChild(li);   // keep the rules' order
    });
    svcList.querySelectorAll('[data-dg-svc]').forEach((li) => { if (!r.services.some((s) => s.slug === li.dataset.dgSvc)) li.hidden = true; });
    $('[data-dg-sum]').textContent = [opt(0, a.lugar), opt(3, a.tamano), opt(2, a.planta)].join(' · ');
    $('[data-dg-rzone]').textContent = zoneOf(r.priority);
    res.dataset.zone = ZONE_KEY[zoneOf(r.priority)];
    const hints = $('[data-dg-hints]');
    hints.replaceChildren(...r.hints.map((h) => Object.assign(document.createElement('li'), { textContent: h })));
    $('[data-dg-hintsbox]').hidden = !r.hints.length;
    $('[data-dg-msg]').textContent = r.message;
    $('[data-dg-wa]').href = wa(r.message);
  }
  function finish() {
    done = true;
    const r = apply({ sweep: true });
    fill(r);
    nodes.forEach((n) => { n.classList.add('is-done'); n.classList.remove('is-current'); });
    track.style.setProperty('--p', '1');
    plate.textContent = 'Diagnóstico listo';
    const names = r.services.map((s) => services.find((x) => x.slug === s.slug).name);
    say(`Diagnóstico listo. Te sugerimos ${list(names)}. Nivel sugerido: ${zoneOf(r.priority).toLowerCase()}.`);
    const lit = leds.filter((l) => l.classList.contains('is-on')).map((l) => l.querySelector('.dg-led'));
    const swap = () => { card.hidden = true; res.hidden = false; res.focus({ preventScroll: true }); reveal(res); };
    if (reduced) { swap(); return; }
    if (lit.length) keep(gsap.to(lit, { keyframes: { opacity: [1, 0.15, 1, 0.15, 1, 0.15, 1] }, duration: 0.6, ease: 'none', stagger: 0.12, delay: 0.5, clearProps: 'opacity' }));
    keep(gsap.timeline()
      .to(card, { scaleY: 0.012, scaleX: 0.96, opacity: 0.5, duration: 0.34, ease: 'power3.in' })
      .fromTo(scan, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.22, ease: 'power2.out' }, '-=0.08')
      .add(() => { gsap.set(card, { clearProps: 'transform', opacity: 1 }); swap(); })   // opacity stays inline: the card is a [data-reveal] (pre-hidden by CSS)
      .fromTo(res, { clipPath: 'inset(49.5% 0% 49.5% 0% round 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 0.8, ease: 'expo.inOut', clearProps: 'clipPath' })
      .to(scan, { opacity: 0, duration: 0.5, ease: 'power1.out' }, '<0.1')
      .fromTo(res.querySelectorAll('[data-dg-anim]'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.07, clearProps: 'transform,opacity' }, '-=0.45')
      .fromTo(res.querySelectorAll('.dg-svc:not([hidden])'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: 0.1, clearProps: 'transform,opacity' }, '<0.1')
      .fromTo(res.querySelectorAll('.dg-svc:not([hidden]) .dg-svc__ic'), { scale: 0.4, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)', stagger: 0.1, clearProps: 'transform' }, '<0.1'));
  }
  function restart() {
    done = false;
    stepTl?.progress(1);
    form.reset();
    cur = 0;
    setStep(0); syncTrack(); syncNav();
    plate.textContent = 'Prioridad sugerida';
    res.hidden = true; card.hidden = false;
    apply();
    reveal(card);
    focusStep(steps[0]);
    if (!reduced) keep(gsap.fromTo(card, { clipPath: 'inset(49.5% 0% 49.5% 0% round 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 0.7, ease: 'expo.inOut', clearProps: 'clipPath' }));
  }
  const onRestart = () => restart();

  /* ---------- wiring ---------- */
  // the engine pauses CSS loops more than a viewport away; this also pauses them (hum, glint, ring, flow, REC)
  // while the section is merely off screen next door, so neighbouring scenes get the whole frame
  const awayIO = new IntersectionObserver(([e]) => root.classList.toggle('is-away', !e.isIntersecting));
  awayIO.observe(root);
  form.addEventListener('change', onChange);
  form.addEventListener('submit', onSubmit);
  form.addEventListener('keydown', onKey);
  back.addEventListener('click', onBack);
  const restartBtn = $('[data-dg-restart]');
  restartBtn.addEventListener('click', onRestart);

  // restored answers (bfcache / breakpoint re-init): land on the first unanswered step
  const firstOpen = steps.findIndex((s, i) => !answered(i));
  cur = firstOpen === -1 ? last : firstOpen;
  setStep(cur); syncTrack(); syncNav();
  const r0 = recommend(answers());
  m.v = 0; renderMeter();

  // power-on self test the first time the meter comes into view: scale draws in, needle sweeps, LEDs blink
  if (reduced) apply();
  else {
    const ticks = root.querySelectorAll('.dg-g-tick'), zones = root.querySelectorAll('.dg-g-zone'), nums = root.querySelectorAll('.dg-g-num');
    const intro = keep(gsap.timeline({ paused: true })
      .from(zones, { drawSVG: '0%', duration: 0.9, ease: 'power2.inOut', stagger: 0.18 }, 0)
      .from(ticks, { drawSVG: '0%', duration: 0.25, ease: 'power1.out', stagger: 0.012 }, 0.1)
      .from(nums, { opacity: 0, y: 6, duration: 0.4, stagger: 0.06 }, 0.35)
      .add(() => apply({ sweep: true }), 0.45)
      .add(() => { meter.classList.add('is-test'); }, 0.5)
      .add(() => { meter.classList.remove('is-test'); }, 1.6));
    ScrollTrigger.create({ trigger: meter, start: 'top 80%', once: true, onEnter: () => intro.play() });   // killed by the engine's teardown
    charge(r0.priority);
  }

  return () => {
    tweens.forEach((t) => t.kill());
    flying.forEach((d) => d.remove());
    form.removeEventListener('change', onChange);
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('keydown', onKey);
    back.removeEventListener('click', onBack);
    restartBtn.removeEventListener('click', onRestart);
    awayIO.disconnect();
    root.classList.remove('is-away');
  };
}
