/*
  Motion engine — GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG) + Lenis, View Transitions aware.

  Declarative helpers (any component, no JS):
    [data-reveal="up|down|left|right|scale|blur|clip|drop|iris"] [data-delay] [data-start]
    [data-stagger="0.08"]                      children enter in sequence
    [data-split="chars|words|lines"] [data-delay] SplitText entrance (after fonts are ready)
    [data-lit]                                 word-by-word scroll lighting
    [data-parallax="0.2"]  [data-depth="0..5"] scrubbed drift (desktop only)
    [data-count="500"] [data-prefix] [data-suffix] [data-decimals]  count-up once in view
    [data-draw] / [data-draw="scrub"]          DrawSVG every stroke inside, once in view / scrubbed
    [data-magnetic] [data-tilt] [data-glow]    pointer effects (desktop only; data-glow sets --gx/--gy)
    .marquee > .marquee__track                 scroll-speed reactive marquee (content duplicated automatically)

  Sections with their own logic register once, at module level, from their component <script>:
    import { onPage } from '../../scripts/engine.js';
    onPage(({ gsap, ScrollTrigger, env, scrollTo }) => {
      const root = document.querySelector('#hero'); if (!root) return;   // runs on every page: bail out when absent
      ...tweens / ScrollTriggers (auto-reverted on navigation: they live in a gsap.context)...
      return () => { ...remove listeners, cancel rAF... };
    });

  Gates: env.desktop = (min-width:768px) and (pointer:fine) and not reduced motion.
         env.reduced = prefers-reduced-motion: reduce. Pins, scrubs, canvas, Lenis, tilt/magnetic only when env.desktop.
*/
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

const mqDesktop = window.matchMedia('(min-width: 768px) and (pointer: fine)');
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = window.matchMedia('(pointer: coarse)');
export const env = {
  get desktop() { return mqDesktop.matches && !mqReduced.matches; },
  get reduced() { return mqReduced.matches; },
  get coarse() { return mqCoarse.matches; },
};

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let lenis = null;
let ctx = null;
let booted = false;
const registry = [];
let cleanups = [];

export const getLenis = () => lenis;
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
export function scrollTo(target, opts = {}) {
  const offset = opts.offset ?? -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72);
  if (lenis) return lenis.scrollTo(target, { offset, ...opts });
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const y = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + window.scrollY + offset : 0;
  window.scrollTo({ top: y, behavior: env.reduced || opts.immediate ? 'auto' : 'smooth' });
}
const fontsReady = () => Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);
const api = () => ({ gsap, ScrollTrigger, SplitText, env, lenis, scrollTo, emit, getLenis });

/** Register a per-page initialiser. Called on every page load; return an optional cleanup. */
export function onPage(fn) {
  registry.push(fn);
  if (booted && ctx) runInit(fn);
}
function runInit(fn) {
  try {
    let cleanup;
    const run = () => { cleanup = fn(api()); };
    ctx ? ctx.add(run) : run(); // during boot we are already inside the context callback (ctx not yet assigned)
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

/* ---------------- Lenis (desktop only) ---------------- */
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

/* ---------------- Pointer effects (desktop only) ---------------- */
function initPointer() {
  if (!env.desktop) return;
  gsap.utils.toArray('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '0.35');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e) => { const r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * strength); yTo((e.clientY - r.top - r.height / 2) * strength); };
    const leave = () => { xTo(0); yTo(0); };
    el.addEventListener('mousemove', move); el.addEventListener('mouseleave', leave);
    cleanups.push(() => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); });
  });
  gsap.utils.toArray('[data-tilt]').forEach((el) => {
    const max = parseFloat(el.dataset.tilt || '6');
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const move = (e) => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5; rx(-py * max * 2); ry(px * max * 2); };
    const leave = () => { rx(0); ry(0); };
    el.addEventListener('mousemove', move); el.addEventListener('mouseleave', leave);
    cleanups.push(() => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); });
  });
  gsap.utils.toArray('[data-glow]').forEach((el) => {
    const move = (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`); el.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`); };
    el.addEventListener('mousemove', move);
    cleanups.push(() => el.removeEventListener('mousemove', move));
  });
}

/* ---------------- Marquee ---------------- */
function initMarquees() {
  gsap.utils.toArray('.marquee').forEach((m) => {
    const track = m.querySelector('.marquee__track');
    if (!track || track.dataset.ready) return;
    track.dataset.ready = '1';
    track.innerHTML += track.innerHTML; // second copy for a seamless loop
    if (env.reduced) return;
    const dir = m.dataset.direction === 'right' ? 1 : -1;
    const speed = parseFloat(m.dataset.speed || '30'); // seconds per loop
    const tween = gsap.to(track, { xPercent: dir * -50, ease: 'none', duration: speed, repeat: -1 });
    if (dir === 1) gsap.set(track, { xPercent: -50 }), tween.vars.xPercent = 0;
    let tsTo = gsap.quickTo(tween, 'timeScale', { duration: 0.6 });
    ScrollTrigger.create({ onUpdate: (self) => { const v = Math.abs(self.getVelocity()) / 800; tsTo(1 + Math.min(v, 3)); } });
  });
}

/* ---------------- Header state ---------------- */
function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  ScrollTrigger.create({ start: 'top -40', onUpdate: (s) => header.classList.toggle('is-scrolled', s.scroll() > 40), onToggle: (s) => header.classList.toggle('is-scrolled', s.isActive) });
}

/* ---------------- Boot / teardown ---------------- */
async function boot() {
  syncLenis();
  ctx = gsap.context(() => {
    initHeader();
    initReveals();
    initParallax();
    initCounters();
    initDraw();
    initPointer();
    initMarquees();
    registry.forEach((fn) => runInit(fn));
  });
  booted = true;
  await fontsReady();
  ctx.add(() => { initSplits(); initLit(); });
  queueRefresh();
  emit('ssds:ready');
}
function teardown() {
  cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
  cleanups = [];
  ctx?.revert();
  ctx = null;
  booted = false;
  ScrollTrigger.getAll().forEach((t) => t.kill());
}
document.addEventListener('astro:page-load', () => { if (booted) teardown(); boot(); });
document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:after-swap', () => { window.scrollTo(0, 0); });
mqDesktop.addEventListener('change', () => { syncLenis(); queueRefresh(); });
