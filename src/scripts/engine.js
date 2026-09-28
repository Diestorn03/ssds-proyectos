/*
  Motion engine — GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG, MotionPath) + Lenis, View Transitions aware.

  Built-ins (declarative, any page):
    [data-reveal="up|down|left|right|scale|blur|clip|drop|iris"] [data-delay] [data-start]
    [data-stagger="0.08"]                      children enter in sequence
    [data-split="chars|words|lines"] [data-delay] SplitText entrance (after fonts are ready)
    [data-lit]                                 word-by-word scroll lighting
    [data-parallax="0.2"]  [data-depth="0..5"] scrubbed drift (desktop gate only)
    [data-count="500"] [data-prefix] [data-suffix] [data-decimals]  count-up once in view
    [data-draw] / [data-draw="scrub"]          DrawSVG every stroke inside, once in view / scrubbed
    [data-magnetic] [data-tilt] [data-glow]    pointer effects (desktop gate only; data-glow sets --gx/--gy in px)
    .marquee > .marquee__track                 scroll-speed reactive marquee (children cloned once; data-speed px/frame, data-direction)
    .stack-card                                cascading card stack (desktop gate only)

  Sections with their own logic register once, at module level, from their component <script>:
    import { onPage } from '../../scripts/engine.js';
    onPage(({ gsap, ScrollTrigger, SplitText, env, lenis, scrollTo, introGate, emit, onRefresh }) => {
      const root = document.querySelector('#tablero'); if (!root) return;   // runs on every page: bail out when absent
      ...tweens / ScrollTriggers (auto-reverted on navigation: they live in the engine's gsap.context)...
      return () => { ...remove listeners, cancel rAF, lose WebGL context... };
    });

  Gates:  env.desktop = (min-width:768px) and (pointer:fine) and (prefers-reduced-motion:no-preference) → html.is-desktop-fx
          env.reduced = prefers-reduced-motion: reduce      env.coarse = pointer: coarse      env.mobile = !desktop
          env.lite    = low-power machine (≤4 cores / ≤4 GB / Save-Data, or a scene called markLite()) → html.is-lite
                        WebGL and heavy canvas only when env.desktop && !env.lite.
  Pins, scrubs, WebGL, Lenis, tilt, magnetic and cursor effects only run when env.desktop is true.
  introGate() resolves when the loader has finished ('ssds:loader-done') or right away when there is no loader.
*/
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin);

export const DESKTOP_QUERY = '(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
const mqDesktop = window.matchMedia(DESKTOP_QUERY);
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = window.matchMedia('(pointer: coarse)');
// Low-power machines: keep pins/scrubs (cheap) but skip WebGL, heavy canvas particle counts and backdrop blurs.
// Static guess = ≤2 threads, ≤2 GB, both ≤4 threads AND ≤4 GB, or Save-Data. Everything else is decided at runtime:
// a scene that measures sustained slow frames calls markLite() (remembered for the session).
const nav = typeof navigator !== 'undefined' ? navigator : {};
const cores = nav.hardwareConcurrency || 8, mem = nav.deviceMemory || 8;
let lite = cores <= 2 || mem <= 2 || (cores <= 4 && mem <= 4) || !!nav.connection?.saveData;
try { if (sessionStorage.getItem('ssds-lite') === '1') lite = true; } catch (e) { /* storage blocked */ }
export function markLite() {
  if (lite) return;
  lite = true;
  document.documentElement.classList.add('is-lite');
  try { sessionStorage.setItem('ssds-lite', '1'); } catch (e) { /* storage blocked */ }
  emit('ssds:lite');
}
export const env = {
  get desktop() { return mqDesktop.matches; },
  get reduced() { return mqReduced.matches; },
  get coarse() { return mqCoarse.matches; },
  get mobile() { return !mqDesktop.matches; },
  get lite() { return lite; },
};

// Pinned scenes must not initialise mid-scroll after a reload.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let lenis = null;
let ctx = null;
let booted = false;
const registry = [];
const cleanups = [];
const pageHooks = [];

export const getLenis = () => lenis;
export const onRefresh = (fn) => { ScrollTrigger.addEventListener('refresh', fn); pageHooks.push(fn); };
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
export function scrollTo(target, opts = {}) {
  const offset = opts.offset ?? -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72);
  if (lenis) return lenis.scrollTo(target, { offset, ...opts });
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const y = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + window.scrollY + offset : 0;
  window.scrollTo({ top: y, behavior: env.reduced || opts.immediate ? 'auto' : 'smooth' });
}
export function introGate() {
  const loader = document.getElementById('loader');
  if (!loader || loader.classList.contains('is-done')) return Promise.resolve();
  return Promise.race([
    new Promise((r) => document.addEventListener('ssds:loader-done', r, { once: true })),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
}
const fontsReady = () => Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);
const api = () => ({ gsap, ScrollTrigger, SplitText, env, lenis, scrollTo, introGate, emit, onRefresh, getLenis, markLite });

/** Register a per-page initialiser (see header). Called on every page load; return an optional cleanup. */
export function onPage(fn) {
  registry.push(fn);
  if (booted && ctx) runInit(fn); // module loaded after this page booted (client-side navigation)
}
function runInit(fn) {
  try {
    let cleanup;
    ctx.add(() => { cleanup = fn(api()); });
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  } catch (e) { console.error('[engine] section init failed', e); }
  queueRefresh();
}
let refreshQueued = false;
function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; ScrollTrigger.sort(); ScrollTrigger.refresh(); });
}

/* ---------------- Lenis (desktop gate only) ---------------- */
const lenisRaf = (t) => lenis?.raf(t * 1000);
function syncLenis() {
  if (env.desktop && !lenis) {
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
  } else if (!env.desktop && lenis) {
    gsap.ticker.remove(lenisRaf);
    lenis.destroy();
    lenis = null;
  }
}
// in-page anchors go through Lenis / smooth scroll with the header offset
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
  const url = new URL(a.href, location.href);
  if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
  const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!el) return;
  e.preventDefault();
  scrollTo(el);
  history.replaceState(history.state, '', url.hash);
});

/* ---------------- Reveals ---------------- */
const REVEALS = {
  up: { y: 56, opacity: 0 }, down: { y: -56, opacity: 0 }, left: { x: -72, opacity: 0 }, right: { x: 72, opacity: 0 },
  scale: { scale: 0.88, opacity: 0 }, blur: { y: 30, opacity: 0, filter: 'blur(10px)' },
  clip: { clipPath: 'inset(0 100% 0 0)', opacity: 1 }, drop: { clipPath: 'inset(0 0 100% 0)', opacity: 1 }, iris: { clipPath: 'circle(0% at 50% 50%)', opacity: 1 },
};
function initReveals() {
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    if (env.reduced) { gsap.set(el, { opacity: 1 }); return; }
    const type = el.dataset.reveal || 'up';
    const from = REVEALS[type] || REVEALS.up;
    const clip = ['clip', 'drop', 'iris'].includes(type);
    const to = { x: 0, y: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: clip ? 1.2 : 0.95, ease: 'expo.out', delay: +(el.dataset.delay || 0), clearProps: 'filter,transform' };
    if (type === 'clip') to.clipPath = 'inset(0 0% 0 0)';
    if (type === 'drop') to.clipPath = 'inset(0 0 0% 0)';
    if (type === 'iris') to.clipPath = 'circle(75% at 50% 50%)';
    gsap.fromTo(el, from, { ...to, scrollTrigger: { trigger: el, start: el.dataset.start || 'top 88%', once: true, onEnter: () => el.classList.add('is-inview') } });
  });
  gsap.utils.toArray('[data-stagger]').forEach((group) => {
    const kids = [...group.children];
    if (env.reduced || !kids.length) { gsap.set(kids, { opacity: 1 }); return; }
    gsap.fromTo(kids, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: +(group.dataset.stagger || 0.08), clearProps: 'transform', scrollTrigger: { trigger: group, start: group.dataset.start || 'top 85%', once: true } });
  });
}

/* ---------------- Text ---------------- */
function initSplits() {
  gsap.utils.toArray('[data-split]').forEach((el) => {
    el.style.visibility = 'visible';
    if (env.reduced) return;
    const mode = env.coarse && el.dataset.split === 'chars' ? 'words' : el.dataset.split || 'lines';
    const split = new SplitText(el, { type: mode === 'chars' ? 'chars,words' : mode === 'words' ? 'words' : 'lines', mask: mode === 'lines' ? 'lines' : undefined, linesClass: 'split-line', wordsClass: 'split-word', charsClass: 'split-char' });
    const targets = mode === 'chars' ? split.chars : mode === 'words' ? split.words : split.lines;
    const trig = { trigger: el, start: el.dataset.start || 'top 88%', once: true, onEnter: () => el.classList.add('is-inview') };
    const delay = +(el.dataset.delay || 0);
    if (mode === 'chars') gsap.from(targets, { yPercent: 110, opacity: 0, filter: 'blur(8px)', duration: 0.9, ease: 'expo.out', stagger: 0.02, delay, clearProps: 'filter', scrollTrigger: trig });
    else if (mode === 'words') gsap.from(targets, { yPercent: 100, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay, scrollTrigger: trig });
    else gsap.from(targets, { yPercent: 110, duration: 0.95, ease: 'expo.out', stagger: 0.1, delay, scrollTrigger: trig });
  });
}
function initLit() {
  gsap.utils.toArray('[data-lit]').forEach((el) => {
    el.style.visibility = 'visible';
    if (env.reduced) return;
    const split = new SplitText(el, { type: 'words', wordsClass: 'lit-word' });
    gsap.fromTo(split.words, { opacity: 0.22 }, { opacity: 1, stagger: 0.02, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: true } });
  });
}

/* ---------------- Parallax ---------------- */
function initParallax() {
  if (!env.desktop) return;
  gsap.utils.toArray('[data-parallax]').forEach((el) => {
    const amt = parseFloat(el.dataset.parallax || '0.2');
    gsap.fromTo(el, { yPercent: amt * 40 }, { yPercent: -amt * 40, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  const factors = { 0: 0.1, 1: 0.25, 2: 0.5, 3: 0.8, 4: 1, 5: 1.2 };
  gsap.utils.toArray('[data-depth]').forEach((el) => {
    const f = factors[el.dataset.depth] ?? 1;
    if (f === 1) return;
    gsap.to(el, { yPercent: -36 * (1 - f), ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ---------------- Counters ---------------- */
function initCounters() {
  gsap.utils.toArray('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const dec = +(el.dataset.decimals || 0);
    const fmt = (v) => `${el.dataset.prefix || ''}${v.toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${el.dataset.suffix || ''}`;
    if (env.reduced) { el.textContent = fmt(target); return; }
    el.textContent = fmt(0);
    const obj = { v: 0 };
    gsap.to(obj, { v: target, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => { el.textContent = fmt(obj.v); } });
  });
}

/* ---------------- SVG drawing ---------------- */
function initDraw() {
  gsap.utils.toArray('[data-draw]').forEach((svg) => {
    const paths = svg.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse');
    if (!paths.length || env.reduced) return;
    if (svg.dataset.draw === 'scrub') {
      gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', stagger: 0.05, scrollTrigger: { trigger: svg, start: 'top 80%', end: 'bottom 60%', scrub: true } });
    } else {
      gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, ease: 'power2.inOut', stagger: 0.08, delay: +(svg.dataset.delay || 0), scrollTrigger: { trigger: svg, start: 'top 88%', once: true } });
    }
  });
}

/* ---------------- Card stack (desktop gate only) ---------------- */
function initStack() {
  const cards = gsap.utils.toArray('.stack-card');
  if (!cards.length || !env.desktop) return;
  cards.forEach((card, i) => {
    if (i === cards.length - 1) return;
    const st = { trigger: cards[i + 1], start: 'top 85%', end: 'top 15%', scrub: true };
    gsap.to(card, { scale: 0.94 - (cards.length - 2 - i) * 0.02, rotate: i % 2 ? 1.5 : -1.5, ease: 'none', scrollTrigger: st });
    gsap.to(card.children, { opacity: 0.35, ease: 'none', scrollTrigger: { ...st } });
  });
}

/* ---------------- Marquee (scroll-speed reactive, one ticker per page) ---------------- */
let marqueeTick;
function initMarquee() {
  if (marqueeTick) gsap.ticker.remove(marqueeTick);
  marqueeTick = null;
  const items = gsap.utils.toArray('.marquee').map((m) => {
    const track = m.querySelector('.marquee__track');
    if (!track) return null;
    if (!track.dataset.cloned) {
      [...track.children].forEach((c) => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); k.querySelectorAll('a, button').forEach((f) => f.setAttribute('tabindex', '-1')); track.appendChild(k); });
      track.dataset.cloned = '1';
    }
    const dir = m.dataset.direction === 'right' ? -1 : 1;
    const it = { track, x: 0, half: track.scrollWidth / 2, visible: false, dir, speed: +(m.dataset.speed || 0.6) };
    new IntersectionObserver(([e]) => { it.visible = e.isIntersecting; }).observe(m);
    if (dir < 0) it.x = -it.half;
    return it;
  }).filter(Boolean);
  if (!items.length || env.reduced) return;
  onRefresh(() => items.forEach((it) => { it.half = it.track.scrollWidth / 2; }));
  let vel = 0, last = window.scrollY;
  marqueeTick = () => {
    const dy = window.scrollY - last; last = window.scrollY;
    vel = Math.min(14, Math.abs(dy) * 0.3 + vel * 0.9);
    items.forEach((it) => {
      if (!it.visible) return;
      it.x -= (it.speed + vel) * it.dir;
      if (-it.x >= it.half) it.x += it.half;
      if (it.x > 0) it.x -= it.half;
      it.track.style.transform = `translate3d(${it.x}px,0,0)`;
    });
  };
  gsap.ticker.add(marqueeTick);
}

/* ---------------- Pointer effects (desktop gate only; listeners dropped on teardown) ---------------- */
let fxAbort = null;
function initPointerFx() {
  fxAbort?.abort(); fxAbort = new AbortController();
  const signal = fxAbort.signal;
  if (!env.desktop) return;
  gsap.utils.toArray('[data-tilt]').forEach((card) => {
    const max = +(card.dataset.tilt || 6);
    const setX = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
    const setY = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
    gsap.set(card, { transformPerspective: 1000 });
    card.addEventListener('pointermove', (e) => { const r = card.getBoundingClientRect(); setX(((e.clientX - r.left) / r.width - 0.5) * max * 2); setY(-((e.clientY - r.top) / r.height - 0.5) * max * 2); }, { signal });
    card.addEventListener('pointerleave', () => { setX(0); setY(0); }, { signal });
  });
  gsap.utils.toArray('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '0.25');
    const mx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
    const my = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); mx(gsap.utils.clamp(-8, 8, (e.clientX - r.left - r.width / 2) * strength)); my(gsap.utils.clamp(-8, 8, (e.clientY - r.top - r.height / 2) * strength)); }, { signal });
    el.addEventListener('pointerleave', () => { mx(0); my(0); }, { signal });
  });
  gsap.utils.toArray('[data-glow]').forEach((el) => {
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--gx', `${e.clientX - r.left}px`); el.style.setProperty('--gy', `${e.clientY - r.top}px`); }, { signal });
  });
}

/* ---------------- Header state (class only; chrome.js does the rest) ---------------- */
function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  ScrollTrigger.create({ start: 'top -40', onUpdate: (s) => header.classList.toggle('is-scrolled', s.scroll() > 40), onToggle: (s) => header.classList.toggle('is-scrolled', s.isActive) });
}

/* ---------------- Offscreen sections: pause their CSS animations ---------------- */
// Infinite CSS animations keep invalidating style every frame even when far off screen, which makes every
// ScrollTrigger / Lenis read force a style recalc. Sections more than one viewport away get [data-offscreen].
let offIO = null;
function initOffscreen() {
  offIO?.disconnect();
  offIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) e.target.removeAttribute('data-offscreen'); else e.target.setAttribute('data-offscreen', '');
  }), { rootMargin: '100% 0px' });
  document.querySelectorAll('main > section, main > * > section, body > footer').forEach((s) => offIO.observe(s));
}

/* ---------------- Boot / teardown (View Transitions aware) ---------------- */
function teardown() {
  fxAbort?.abort();
  offIO?.disconnect();
  cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  ctx?.revert(); ctx = null;
  pageHooks.splice(0).forEach((fn) => ScrollTrigger.removeEventListener('refresh', fn));
  ScrollTrigger.getAll().forEach((t) => t.kill());
  booted = false;
}
function boot() {
  teardown();
  syncLenis();
  document.documentElement.classList.toggle('is-desktop-fx', env.desktop);
  document.documentElement.classList.toggle('is-lite', env.lite);
  ctx = gsap.context(() => {});
  // section modules first (they create the pins), then the declarative built-ins; sort() fixes creation order
  registry.forEach(runInit);
  ctx.add(() => { initHeader(); initReveals(); initParallax(); initCounters(); initDraw(); initStack(); initMarquee(); initPointerFx(); });
  initOffscreen();
  fontsReady().then(() => { if (!ctx) return; ctx.add(() => { initSplits(); initLit(); }); queueRefresh(); });
  booted = true;
  queueRefresh();
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  emit('ssds:ready');
}

document.addEventListener('astro:page-load', boot);
document.addEventListener('astro:before-swap', teardown);
// ClientRouter swaps <html> attributes: restore the `js` class the head script set on the first load
document.addEventListener('astro:after-swap', () => { document.documentElement.classList.add('js'); window.scrollTo(0, 0); lenis?.scrollTo(0, { immediate: true }); });
let bpTimer;
const rebootOnChange = () => { clearTimeout(bpTimer); bpTimer = setTimeout(() => { window.scrollTo(0, 0); boot(); }, 150); };
mqDesktop.addEventListener('change', rebootOnChange);
