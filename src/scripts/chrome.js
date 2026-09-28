/*
  Chrome behaviour: header (glass, hide on scroll down, theme of the section below), mobile menu <dialog>,
  floating WhatsApp + mobile action bar, La Línea, "El Arco" transition origin, footer thread / giant wordmark.
  Imported once by Header.astro. Page-level parts register through the engine's onPage (re-run on every
  astro:page-load, cleaned up before the next swap); document-level listeners are bound once here.
*/
import { onPage, getLenis } from './engine.js';

const root = document.documentElement;
const raf = (fn) => { let id = 0; const run = () => { id = 0; fn(); }; const req = () => { if (!id) id = requestAnimationFrame(run); }; req.cancel = () => cancelAnimationFrame(id); return req; };

/* ---------- El Arco: circle origin at the click point (html attributes are replaced on swap, so re-apply) ---------- */
let origin = null;
const isInternal = (a) => a instanceof HTMLAnchorElement && a.origin === location.origin && !a.target && !a.hasAttribute('download') && !(a.pathname === location.pathname && a.hash);
const setOrigin = (x, y) => { origin = { x, y, t: Date.now() }; applyOrigin(); };
function applyOrigin() {
  if (!origin || Date.now() - origin.t > 5000) return;
  root.style.setProperty('--vt-x', `${Math.round(origin.x)}px`);
  root.style.setProperty('--vt-y', `${Math.round(origin.y)}px`);
}
document.addEventListener('pointerdown', (e) => { const a = e.target.closest?.('a[href]'); if (isInternal(a)) setOrigin(e.clientX, e.clientY); }, { capture: true, passive: true });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const a = e.target.closest?.('a[href]');
  if (!isInternal(a)) return;
  const r = a.getBoundingClientRect();
  setOrigin(r.left + r.width / 2, r.top + r.height / 2);
}, true);
document.addEventListener('astro:after-swap', () => {
  root.classList.add('js');
  applyOrigin();
  origin = null;
  closeMenu(true);
});

/* ---------- Mobile menu (lives in the persisted header: bound once per header element) ---------- */
let menu = null;
const menuOpen = () => !!menu?.open;
function openMenu(btn) {
  menu = document.getElementById('ssds-menu');
  if (!menu || menu.open) return;
  const r = btn.getBoundingClientRect();
  menu.style.setProperty('--mx', `${r.left + r.width / 2}px`);
  menu.style.setProperty('--my', `${r.top + r.height / 2}px`);
  menu.showModal();
  root.classList.add('menu-open');
  getLenis()?.stop();
  btn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  document.dispatchEvent(new CustomEvent('ssds:menu', { detail: { open: true } }));
}
function closeMenu(now = false) {
  if (!menu?.open) return;
  const dlg = menu;
  dlg.classList.remove('is-open');
  const finish = () => {
    if (!dlg.open) return;
    dlg.close();
    root.classList.remove('menu-open');
    getLenis()?.start();
    document.querySelector('[data-menu-open]')?.setAttribute('aria-expanded', 'false');
    document.dispatchEvent(new CustomEvent('ssds:menu', { detail: { open: false } }));
  };
  if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 420);
}
function bindHeader(hdr) {
  if (hdr.dataset.bound) return;
  hdr.dataset.bound = '1';
  hdr.querySelector('[data-menu-open]')?.addEventListener('click', (e) => openMenu(e.currentTarget));
  const dlg = hdr.querySelector('#ssds-menu');
  if (!dlg) return;
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeMenu(); });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu-close]')) closeMenu();
    const a = e.target.closest('a[href]');
    // links to the page we are on just close the menu; in-page anchors close it and let the engine scroll
    if (a && isInternal(a) && a.pathname === location.pathname && !a.hash) { e.preventDefault(); closeMenu(); }
    else if (a && a.hash && a.pathname === location.pathname) closeMenu();
  });
  matchMedia('(min-width: 900px)').addEventListener('change', (m) => { if (m.matches) closeMenu(true); });
}

/* ---------- Header: active link, glass, hide on scroll down, theme of the section below ---------- */
onPage(() => {
  const hdr = document.querySelector('.hdr');
  if (!hdr) return;
  bindHeader(hdr);
  menu = document.getElementById('ssds-menu');

  const here = location.pathname.replace(/\/?$/, '/');
  hdr.querySelectorAll('a[data-nav]').forEach((a) => {
    const p = a.pathname.replace(/\/?$/, '/');
    const on = a.dataset.nav === 'home' ? p === here : here.startsWith(p);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  let lastY = window.scrollY;
  const update = raf(() => {
    const y = window.scrollY;
    hdr.classList.toggle('is-scrolled', y > 40);
    if (y < 400) { hdr.classList.remove('is-hidden'); lastY = y; return; }
    const d = y - lastY;
    if (Math.abs(d) < 8) return;
    hdr.classList.toggle('is-hidden', d > 0 && !menuOpen());
    lastY = y;
  });
  hdr.classList.remove('is-hidden');
  update();
  window.addEventListener('scroll', update, { passive: true });

  const themeOf = (z) => z.dataset.theme || (z.classList.contains('on-light') ? 'light' : 'dark');
  const zones = [...document.querySelectorAll('main section, main > div > section, footer')].filter((z) => z.dataset.theme || z.classList.contains('on-light') || z.classList.contains('section') || z.tagName === 'FOOTER');
  const under = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? under.add(e.target) : under.delete(e.target)));
    const cur = zones.filter((z) => under.has(z)).pop(); // innermost / last in document order
    if (cur) hdr.dataset.theme = themeOf(cur);
  }, { rootMargin: '0px 0px -95% 0px' });
  zones.forEach((z) => io.observe(z));

  return () => { window.removeEventListener('scroll', update); update.cancel(); io.disconnect(); };
});

/* ---------- Floating WhatsApp + mobile action bar ---------- */
onPage(() => {
  const fab = document.querySelector('.fab');
  const bar = document.querySelector('.abar');
  if (!fab && !bar) return;
  const hero = document.getElementById('inicio');
  const blocking = new Set();
  let menuIsOpen = menuOpen();

  const pastHero = () => {
    if (!hero) return window.scrollY > 200;
    const spacer = hero.parentElement?.classList.contains('pin-spacer') ? hero.parentElement : null;
    // pinned hero: show at ~75% of the pin, when its CTAs have faded; otherwise once most of the hero has gone
    return (spacer || hero).getBoundingClientRect().bottom < window.innerHeight * (spacer ? 1.25 : 0.75);
  };
  const update = raf(() => {
    const show = pastHero() && !blocking.size && !menuIsOpen;
    fab?.classList.toggle('is-shown', show);
    bar?.classList.toggle('is-shown', show);
  });
  // hidden over blocks that carry their own WhatsApp buttons ([data-fab-hide])
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? blocking.add(e.target) : blocking.delete(e.target)));
    update();
  }, { rootMargin: '-15% 0px -15% 0px' });
  document.querySelectorAll('[data-fab-hide]').forEach((el) => io.observe(el));

  const onMenu = (e) => { menuIsOpen = e.detail.open; update(); };
  document.addEventListener('ssds:menu', onMenu);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  return () => {
    io.disconnect(); update.cancel();
    document.removeEventListener('ssds:menu', onMenu);
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
});

/* ---------- La Línea: one current down the left margin of <main> ---------- */
const lineaOn = (env) => matchMedia('(min-width: 1024px)').matches && (env.desktop || env.reduced);
onPage(({ gsap, env }) => {
  const linea = document.querySelector('.linea');
  if (!linea) return;
  const on = lineaOn(env);
  linea.classList.toggle('is-on', on);
  if (!on) return;
  const main = linea.parentElement;
  const svg = linea.querySelector('svg');
  const line = linea.querySelector('.linea__line');
  const ghost = linea.querySelector('.linea__ghost');
  const grad = linea.querySelector('.linea__grad');
  const tip = linea.querySelector('.linea__tip');
  let total = 1, height = 0, top = 0;
  const state = { p: env.reduced ? 1 : 0 };

  const draw = () => {
    line.style.strokeDashoffset = `${1 - state.p}`;
    const pt = line.getPointAtLength(state.p * total);
    tip.setAttribute('transform', `translate(${(pt.x - 24).toFixed(1)} ${pt.y.toFixed(1)})`);
    linea.classList.toggle('is-drawing', state.p > 0.002 && state.p < 0.998);
  };
  // the drawn tip sits at 70% of the viewport; progress comes straight from the scroll position, so pins and
  // late-loading images inside <main> never leave it out of sync (main's size is watched below)
  const target = () => Math.min(1, Math.max(0, (window.scrollY + window.innerHeight * 0.7 - top) / height));
  const follow = env.reduced ? null : gsap.quickTo(state, 'p', { duration: 0.6, ease: 'power3', onUpdate: draw });
  const onScroll = () => follow?.(target());
  const build = () => {
    top = main.getBoundingClientRect().top + window.scrollY;
    const H = Math.max(1, Math.round(main.offsetHeight));
    if (H !== height) {
      height = H;
      // gentle S-curves every ~820px; the tangent keeps its sign so the joins are smooth
      const n = Math.max(1, Math.round(H / 820)), L = H / n;
      let d = 'M24 0';
      for (let i = 0; i < n; i++) {
        const y = i * L, a = 7 + 3 * Math.sin(i * 1.7);
        d += `C${(24 + a).toFixed(1)} ${(y + L * 0.35).toFixed(1)} ${(24 - a).toFixed(1)} ${(y + L * 0.65).toFixed(1)} 24 ${(y + L).toFixed(1)}`;
      }
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 48 ${H}`);
      grad.setAttribute('y2', H);
      line.setAttribute('d', d);
      ghost.setAttribute('d', d);
      total = line.getTotalLength();
    }
    if (follow) { state.p = target(); follow(state.p); }
    draw();
  };
  const rebuild = raf(build);
  const ro = new ResizeObserver(rebuild);
  ro.observe(main);
  build();
  if (follow) window.addEventListener('scroll', onScroll, { passive: true });
  return () => { ro.disconnect(); rebuild.cancel(); window.removeEventListener('scroll', onScroll); };
});

/* ---------- Footer: the current enters the mark, the mark draws, the giant wordmark fills ---------- */
onPage(({ gsap, env, onRefresh }) => {
  const f = document.querySelector('.ftr');
  if (!f) return;
  const mark = f.querySelector('.ftr__mark');
  const fill = f.querySelector('.ftr__fill');
  if (env.reduced) { mark?.classList.add('is-drawn'); return; }

  const thread = f.querySelector('.ftr__thread');
  const withThread = thread && mark && lineaOn(env) && env.desktop;
  let io;
  if (withThread) {
    // from La Línea's x (24px) at the footer's top edge into the mark's top-left vertex
    const path = thread.querySelector('path');
    const stop = thread.querySelector('linearGradient');
    const build = () => {
      const fr = f.getBoundingClientRect(), mr = mark.getBoundingClientRect();
      const x = mr.left - fr.left + mr.width * 0.14, y = mr.top - fr.top + mr.height * 0.29;
      path.setAttribute('d', `M24 0C24 ${(y * 0.62).toFixed(1)} ${(24 + (x - 24) * 0.25).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`);
      thread.setAttribute('width', Math.ceil(x + 4)); thread.setAttribute('height', Math.ceil(y + 4));
      stop?.setAttribute('y2', y.toFixed(1)); stop?.setAttribute('x2', x.toFixed(1));
    };
    thread.classList.add('is-on');
    build();
    onRefresh(build);
    gsap.fromTo(path, { strokeDashoffset: 1 }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: f, start: 'top bottom', end: 'top 45%', scrub: 0.6, onUpdate: (st) => mark.classList.toggle('is-drawn', st.progress > 0.97) },
    });
  } else if (mark) {
    io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { mark.classList.add('is-drawn'); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(mark);
  }

  if (fill) {
    const w = +(fill.dataset.travel || 1160);
    if (env.desktop) gsap.fromTo(fill, { x: 0 }, { x: w, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } });
    else gsap.fromTo(fill, { x: 0 }, { x: w, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: fill.closest('svg'), start: 'top 92%', once: true } });
  }
  return () => io?.disconnect();
});
