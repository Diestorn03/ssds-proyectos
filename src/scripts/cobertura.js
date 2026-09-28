/*
  #cobertura · Red nacional (see the header of components/home/Cobertura.astro).
  One timeline builds the network; it is scrubbed (desktop sticky layout, ≥1024 px) or played once (touch / narrow):
    ray scan reveals the country → Maracay hub powers up → 11 routes drawn in sequence (DrawSVG) with a spark riding
    each one (MotionPath) → city pings + label → the "reach" spreads over the dot matrix → state capitals light up.
  gsap.matchMedia rebuilds the right mode when a desktop window crosses 1024 px.
  Reduced motion / no JS: nothing runs, the markup is the final state. The state picker works everywhere.
  Only transform / opacity / stroke-dashoffset / clip-path / one CSS var (--sweep) are animated.
  SVG elements that GSAP scales/rotates must NOT carry CSS transform-box/transform-origin (GSAP bakes the origin in).
*/
import { onPage } from './engine.js';
import { wa } from '../data/site.js';

const T0 = 1.9;    // first route starts
const STEP = 0.52; // gap between routes
const DRAW = 0.85; // one route's draw (the spark rides its head)

onPage(({ gsap, ScrollTrigger, env, onRefresh }) => {
  const root = document.getElementById('cobertura');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const ac = new AbortController();
  const { signal } = ac;
  const reduced = env.reduced;
  const TO = { transformOrigin: '50% 50%' };

  const fig = $('.cob__map');
  const W = +fig.dataset.w, H = +fig.dataset.h;
  const proj = JSON.parse(fig.dataset.proj);
  const routes = $$('.cob__route:not(.cob__route--pick)');
  const N = routes.length;
  const lines = routes.map((r) => r.querySelector('.cob__route-line'));
  const labels = $$('.cob__label:not(.cob__label--pick)');
  const nodes = $$('.cob__node');
  const count = $('.cob__count');
  const freeSpark = $('.cob__spark--free');
  const freePing = $('.cob__ping--free');

  // static final state (a previous boot may have been torn down mid-animation)
  const resetStatic = () => {
    root.classList.remove('is-live', 'is-charging', 'is-probing');
    count.textContent = String(N).padStart(2, '0');
  };
  resetStatic();

  let live = false; // map on screen
  let tl = null;    // the network timeline of the active mode
  let relay = null, relayTl = null, pickTl = null, pickLoop = null;
  let finishIntro = null; // play-once mode: a pick completes the intro first

  // one spare ring, moved onto whichever point needs a ping (picker, idle relays)
  const ping = (x, y, to = 4) => gsap.timeline()
    .set(freePing, { attr: { cx: x, cy: y } })
    .fromTo(freePing, { scale: 0.6, opacity: 1, svgOrigin: `${x} ${y}` }, { scale: to, opacity: 0, duration: 0.85, ease: 'power2.out', immediateRender: false });

  /* ---------------- state picker (every environment) ---------------- */
  const sel = $('#cob-state');
  const liveText = $('.cob__live');
  const cta = $('.cob__wa');
  const ctaText = $('.cob__wa-t');
  const pick = $('.cob__route--pick');
  const pickParts = [...pick.children];
  const target = $('.cob__target');
  const dest = $('.cob__dest');
  const pickLabel = $('.cob__label--pick');
  const defaults = { href: cta.href, text: ctaText.textContent, live: liveText.textContent };

  const onPick = () => {
    const o = sel.selectedOptions[0];
    pickTl?.kill(); pickLoop?.kill(); pickLoop = null;
    relayTl?.progress(1);
    finishIntro?.();
    $$('.cob__state.is-picked').forEach((s) => s.classList.remove('is-picked'));
    labels.forEach((l) => l.classList.remove('is-dest'));
    pickLabel.hidden = true;
    if (!o || !o.value) {
      cta.href = defaults.href; ctaText.textContent = defaults.text; liveText.textContent = defaults.live;
      pick.classList.remove('is-on'); target.classList.remove('is-on'); dest.hidden = true;
      root.classList.remove('is-picked');
      return;
    }
    const state = o.value;
    const { capital, d } = o.dataset;
    const x = +o.dataset.x, y = +o.dataset.y;
    const dc = state === 'Distrito Capital';
    const home = state === 'Aragua';
    cta.href = wa(`Hola SSD&S, quiero cotizar un proyecto en ${dc ? 'Caracas (Distrito Capital)' : `el estado ${state}`}.`);
    ctaText.textContent = dc ? 'Cotiza tu proyecto en Caracas' : `Cotiza tu proyecto en ${state}`;
    liveText.innerHTML = home
      ? 'Estás en casa: nuestra <b>oficina principal</b> está en Maracay, Aragua.'
      : `Ruta ilustrativa: <b>Maracay → ${capital}</b>. Tu mensaje de WhatsApp ya menciona ${dc ? 'Caracas' : `el estado ${state}`}.`;

    // the HUD names the destination; the map dims the network and marks the destination with a target, a label and its own route
    root.classList.add('is-picked');
    dest.hidden = false;
    dest.lastElementChild.textContent = dc ? 'Caracas' : `${capital} (${state})`;
    root.querySelector(`.cob__state[data-state="${CSS.escape(state)}"]`)?.classList.add('is-picked');
    target.setAttribute('transform', `translate(${x} ${y})`);
    target.classList.add('is-on');
    const cityLabel = labels.find((l) => l.dataset.state === state);
    if (cityLabel) cityLabel.classList.add('is-dest');
    else if (!home) {
      pickLabel.firstElementChild.textContent = capital;
      pickLabel.dataset.side = x / W > 0.78 ? 'l' : 'r';
      pickLabel.style.setProperty('--x', `${((x / W) * 100).toFixed(2)}%`);
      pickLabel.style.setProperty('--y', `${((y / H) * 100).toFixed(2)}%`);
      pickLabel.hidden = false;
    }

    if (home) {
      pick.classList.remove('is-on');
      gsap.set([target, dest, pickLabel], { opacity: 1 }); // a killed pick may have left them mid-fade
      if (!reduced) pickTl = ping(x, y, 5);
      return;
    }
    pickParts.forEach((p) => p.setAttribute('d', d));
    pick.classList.add('is-on');
    if (reduced) return;
    pickTl = gsap.timeline({ onComplete: packets })
      .fromTo(pickParts.slice(0, 2), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power2.inOut' }, 0)
      .fromTo(pickParts[2], { opacity: 0 }, { opacity: 0.8, duration: 0.3 }, 0.85)
      .fromTo([target, pickLabel], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8)
      .set(freeSpark, { opacity: 1 }, 0)
      .to(freeSpark, { motionPath: { path: pickParts[1], start: 0, end: 1 }, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(freeSpark, { opacity: 0, duration: 0.15 }, 0.85)
      .add(ping(x, y), 0.82)
      .fromTo(dest, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.1);
    // while the pick stands, an energy packet keeps travelling the picked route (paused off screen)
    function packets() {
      pickLoop = gsap.timeline({ repeat: -1, repeatDelay: 0.7, paused: !live })
        .set(freeSpark, { opacity: 1 })
        .to(freeSpark, { motionPath: { path: pickParts[1], start: 0, end: 1 }, duration: 1.3, ease: 'power1.inOut' })
        .to(freeSpark, { opacity: 0, duration: 0.2 }, 1.15)
        .add(ping(x, y, 3), 1.2);
    }
  };
  sel.addEventListener('change', onPick, { signal });

  const killPick = () => { pickTl?.kill(); pickLoop?.kill(); };
  if (reduced) {
    if (sel.value) onPick(); // a restored form value
    return () => { ac.abort(); killPick(); };
  }

  /* ---------------- the network timeline ---------------- */
  const base = $('.cob__base');
  const ray = $('.cob__ray');
  const states = $$('.cob__state');
  const glows = routes.map((r) => r.querySelector('.cob__route-glow'));
  const flows = routes.map((r) => r.querySelector('.cob__route-flow'));
  const sparks = $$('.cob__spark:not(.cob__spark--free)');
  const pings = nodes.map((n) => n.querySelector('.cob__ping'));
  const dots = nodes.map((n) => n.querySelector('.cob__dot'));
  const labelInner = labels.map((l) => l.firstElementChild);
  const arrive = routes.map((_, i) => T0 + i * STEP + DRAW);

  const build = () => {
    const t = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    // 1 · the ray scans the country in: the base map is clipped along the ray's diagonal, the ray rides that same edge.
    // Tweened on the elements themselves, so every render (also suppressed ones on refresh / revert) writes them.
    t.fromTo(base, { '--sweep': -30 }, { '--sweep': 105, duration: 1.5, ease: 'power1.inOut' }, 0)
      .fromTo(ray, { xPercent: -30 }, { xPercent: 105, duration: 1.5, ease: 'power1.inOut' }, 0)
      .fromTo(ray, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
      .to(ray, { opacity: 0, duration: 0.3 }, 1.25)
      .fromTo(states, { opacity: 0, scale: 0.3, ...TO }, { opacity: 0.5, scale: 0.7, duration: 0.5, stagger: 0.015 }, 1.2)
    // 2 · Maracay powers up
      .fromTo($('.cob__hub'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, 1.15)
      .fromTo($('.cob__hex'), { scale: 0, rotation: -90, ...TO }, { scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)' }, 1.15)
      .fromTo($('.cob__core'), { scale: 0, ...TO }, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, 1.35)
      .fromTo($('.cob__callout'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' }, 1.35)
      .fromTo($('.cob__reach'), { attr: { r: 0 } }, { attr: { r: 1100 }, duration: arrive[N - 1] - T0 + 0.4, ease: 'power1.in' }, T0);
    // 3 · routes, one after the other; the spark rides the drawing head
    routes.forEach((_, i) => {
      const s = T0 + i * STEP;
      t.fromTo([glows[i], lines[i]], { drawSVG: '0%' }, { drawSVG: '100%', duration: DRAW, ease: 'power2.inOut' }, s)
        .to(sparks[i], { motionPath: { path: lines[i], start: 0, end: 1 }, duration: DRAW, ease: 'power2.inOut' }, s)
        .fromTo(sparks[i], { opacity: 0 }, { opacity: 1, duration: 0.06 }, s)
        .to(sparks[i], { opacity: 0, duration: 0.14 }, s + DRAW - 0.04)
        .fromTo(pings[i], { scale: 0.5, opacity: 0, ...TO }, { scale: 0.5, opacity: 1, duration: 0.02 }, s + DRAW - 0.06)
        .to(pings[i], { scale: 3.6, opacity: 0, duration: 0.7, ease: 'power2.out' }, s + DRAW - 0.04)
        .fromTo(dots[i], { scale: 0, ...TO }, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, s + DRAW - 0.08)
        .fromTo(labelInner[i], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, s + DRAW - 0.04)
        .fromTo(flows[i], { opacity: 0 }, { opacity: 0.75, duration: 0.3 }, s + DRAW);
    });
    // 4 · every state capital lights up, from Maracay outwards (the markup orders them by distance)
    t.to(states, { opacity: 0.95, scale: 1, duration: 0.4, stagger: 0.035, ease: 'back.out(2)' }, arrive[N - 1] - 0.2)
      .to({}, { duration: 0.9 }); // hold the finished network for the last stretch of the scroll
    t.eventCallback('onUpdate', status);
    return t;
  };

  // status read-out: routes energised so far (also re-read after every refresh: those renders suppress onUpdate)
  let shown = -1;
  function status() {
    if (!tl) return;
    const n = arrive.filter((a) => tl.time() >= a - 0.02).length;
    if (n === shown) return;
    shown = n;
    count.textContent = String(n).padStart(2, '0');
    root.classList.toggle('is-charging', n < N);
  }
  onRefresh(() => { shown = -1; status(); });

  /* ---------------- drive it: scrub (desktop sticky layout) or play once ---------------- */
  // the CSS makes the map sticky from 1024 px; only a fine pointer scrubs it (touch tablets play once)
  const mm = gsap.matchMedia();
  const WIDE = '(min-width: 1024px)';
  mm.add(env.desktop ? { wide: WIDE, narrow: '(max-width: 1023.98px)' } : { wide: 'not all', narrow: 'all' }, (c) => {
    tl = build();
    shown = -1; status();
    if (c.conditions.wide) {
      // pre-warm: initialise every tween now (DrawSVG lengths, MotionPath caches) instead of on the first scroll into each stage
      tl.progress(1, true).progress(0, true);
      ScrollTrigger.create({ trigger: $('.cob__grid'), start: 'top 72%', end: 'bottom bottom', scrub: 0.9, animation: tl, invalidateOnRefresh: true });
      const off = tilt();
      return () => { off(); tl.eventCallback('onUpdate', null); };
    }
    // play once, when most of the map is on screen (or most of the viewport, for a map taller than it)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const need = 0.6 * Math.min(e.boundingClientRect.height, e.rootBounds?.height || innerHeight);
      if (e.intersectionRect.height < need) return;
      io.disconnect();
      gsap.delayedCall(0.15, () => tl.timeScale(1.8).play());
    }, { threshold: Array.from({ length: 11 }, (_, i) => i / 10) });
    io.observe(fig);
    finishIntro = () => { io.disconnect(); tl.progress(1); };
    return () => { io.disconnect(); finishIntro = null; tl.eventCallback('onUpdate', null); };
  });

  // CSS loops (flow dashes, hub rings), idle relays and the pick packets only while the map is on screen
  const liveIO = new IntersectionObserver(([e]) => {
    live = e.isIntersecting;
    root.classList.toggle('is-live', live);
    pickLoop?.paused(!live);
  });
  liveIO.observe(fig);

  /* ---------------- idle relays: once complete, a spark re-runs a random route now and then ---------------- */
  let lastRoute = -1;
  const relayOnce = () => {
    const ready = live && !document.hidden && tl && tl.progress() > 0.9 && !pickTl?.isActive() && !root.classList.contains('is-picked');
    if (!ready) { relay = gsap.delayedCall(1.2, relayOnce); return; }
    let i = gsap.utils.random(0, N - 1, 1);
    if (i === lastRoute) i = (i + 1) % N;
    lastRoute = i;
    relayTl = gsap.timeline({ onComplete: () => { relay = gsap.delayedCall(gsap.utils.random(0.8, 2.2), relayOnce); } })
      .set(freeSpark, { opacity: 1 })
      .to(freeSpark, { motionPath: { path: lines[i], start: 0, end: 1 }, duration: 1.1, ease: 'power1.inOut' }, 0)
      .to(freeSpark, { opacity: 0, duration: 0.15 }, 1)
      .add(ping(nodes[i].dataset.x, nodes[i].dataset.y, 3.4), 1)
      .fromTo(labelInner[i], { color: '#ffd79a' }, { color: '#f4f6fb', duration: 0.9 }, 1);
  };
  if (!env.lite) relay = gsap.delayedCall(1.5, relayOnce);

  /* ---------------- pointer: tilt + coordinate probe (desktop sticky layout only) ---------------- */
  function tilt() {
    const pac = new AbortController();
    const o = { signal: pac.signal };
    const plane = $('.cob__plane');
    const probe = $('.cob__probe');
    const cx = $('.cob__cross-x'), cy = $('.cob__cross-y');
    const rotX = gsap.quickTo(plane, 'rotationX', { duration: 0.9, ease: 'power3' });
    const rotY = gsap.quickTo(plane, 'rotationY', { duration: 0.9, ease: 'power3' });
    gsap.set(plane, { transformPerspective: 1400 });
    let raf = 0, px = 0, py = 0;
    // measured per painted frame (pointer-driven, never in a scroll handler): the page may scroll under a still pointer
    const paint = () => {
      raf = 0;
      const r = fig.getBoundingClientRect();
      const w = plane.offsetWidth, h = plane.offsetHeight;
      const u = gsap.utils.clamp(0, 1, (px - r.left - plane.offsetLeft) / w);
      const v = gsap.utils.clamp(0, 1, (py - r.top - plane.offsetTop) / h);
      rotY((u - 0.5) * 7);
      rotX(-(v - 0.5) * 6);
      cx.style.transform = `translate3d(${(u * w).toFixed(1)}px,0,0)`;
      cy.style.transform = `translate3d(0,${(v * h).toFixed(1)}px,0)`;
      const lat = proj.lat0 - (v * H) / proj.k, lon = proj.lon0 + (u * W) / (proj.k * proj.cos);
      probe.textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(2)}°W`;
    };
    const reset = () => {
      cancelAnimationFrame(raf); raf = 0;
      root.classList.remove('is-probing');
      probe.textContent = probe.dataset.home;
    };
    const leave = () => { reset(); rotX(0); rotY(0); };
    fig.addEventListener('pointerenter', () => root.classList.add('is-probing'), o);
    fig.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(paint); }, o);
    fig.addEventListener('pointerleave', leave, o);
    return () => { pac.abort(); reset(); cx.style.transform = cy.style.transform = ''; }; // the plane's tilt tweens revert with the branch
  }

  if (sel.value) onPick(); // a restored form value

  return () => {
    ac.abort();
    killPick();
    liveIO.disconnect();
    relay?.kill();
    relayTl?.kill();
    mm.revert();
    tl = null;
    resetStatic();
    root.classList.remove('is-picked');
  };
});
