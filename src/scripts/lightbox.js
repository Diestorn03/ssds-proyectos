/*
  Post lightbox (markup + styles: components/ui/Lightbox.astro). Started from a scene's onPage() init:
    const destroy = initLightbox(dialog, links, { gsap, env, getLenis });
  `links` are <a data-lightbox href="…instagram…" data-title data-date data-datetime data-text [data-reel]> holding
  the thumbnail <img>. A plain click opens the dialog (ctrl/cmd/middle click still go to Instagram; no JS = link).
  Native modal <dialog>: focus trap, Esc, focus back to the thumbnail. Open/close = FLIP morph (transform only)
  from the thumbnail when it is on screen; between posts a short crossfade; swipe on touch; ←/→/Home/End keys.
  Reduced motion: no morph, no crossfade.
*/
export function initLightbox(dlg, links, { gsap, env, getLenis }) {
  if (!dlg || !links.length) return () => {};
  const q = (s) => dlg.querySelector(s);
  const frame = q('.lb__frame'), img = q('.lb__img'), scrim = q('.lb__scrim'), figure = q('.lb__figure');
  const title = q('.lb__title'), time = q('.lb__date time'), text = q('.lb__text'), reel = q('.lb__reel');
  const cta = q('.lb__cta'), ctaLabel = q('.lb__cta-label'), live = q('[data-lb-live]'), index = q('[data-lb-index]');
  const panel = q('.lb__panel');
  const fades = [...dlg.querySelectorAll('[data-lb-fade]')];
  const n = links.length;
  const pad = (v) => String(v).padStart(2, '0');
  q('[data-lb-total]').textContent = pad(n);
  q('.lb__meter').innerHTML = '<i></i>'.repeat(n);
  const cells = [...dlg.querySelectorAll('.lb__meter i')];
  dlg.classList.toggle('lb--single', n < 2);

  const ac = new AbortController();
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { ...o, signal: ac.signal });
  const root = document.documentElement;
  let i = 0, opener = null, isOpen = false, closing = false, tl = null, nav = null;

  const thumb = (k) => links[k].querySelector('img');
  const onScreen = (el) => {
    if (!el || !el.offsetParent) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const lock = (yes) => {
    root.classList.toggle('lb-lock', yes);
    const lenis = getLenis?.();
    if (yes) lenis?.stop(); else lenis?.start();
  };
  // transform that maps the dialog frame onto the thumbnail (both are 640:811, so the scale is uniform)
  const flipFrom = (el) => {
    gsap.set(frame, { clearProps: 'transform' });
    const a = el.getBoundingClientRect(), b = frame.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0' };
  };

  function fill(k) {
    i = (k + n) % n;
    const a = links[i], d = a.dataset, t = thumb(i);
    // the thumbnail's cached file first (the morph starts at once), then the full file (the src attribute, 640w;
    // the grid may show the 320w one from its srcset) swapped in once decoded, so it never flashes blank
    const full = t?.src || '', cur = t?.currentSrc || full;
    img.src = cur;
    img.loading = 'eager'; // the markup's placeholder is lazy so that the closed dialog fetches nothing
    if (full && full !== cur) {
      const hi = new Image();
      hi.src = full;
      hi.decode().then(() => { if (links[i] === a) img.src = full; }, () => {});
    }
    img.alt = `Publicación de Instagram: ${d.title}`;
    title.textContent = d.title;
    time.textContent = d.date;
    time.dateTime = d.datetime || '';
    text.textContent = d.text || '';
    reel.hidden = !('reel' in d);
    cta.href = a.href;
    ctaLabel.textContent = 'reel' in d ? 'Ver el reel en Instagram' : 'Ver en Instagram';
    index.textContent = pad(i + 1);
    cells.forEach((c, j) => { c.classList.toggle('is-on', j < i); c.classList.toggle('is-cur', j === i); });
    // warm the neighbours (lazy thumbnails that were never on screen)
    [1, -1].forEach((s) => { const nb = thumb((i + s + n) % n); if (nb?.src) new Image().src = nb.src; });
  }

  function open(k, from) {
    if (isOpen) return;
    isOpen = true; closing = false; opener = from;
    fill(k);
    lock(true);
    dlg.showModal();
    q('.lb__close').focus({ preventScroll: true });
    tl?.kill();
    if (env.reduced) return;
    const t = thumb(i);
    tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: () => links[i].classList.remove('is-lifted') });
    tl.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0);
    if (onScreen(t)) {
      links[i].classList.add('is-lifted');
      tl.fromTo(frame, flipFrom(t), { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.85 }, 0);
    } else {
      tl.fromTo(frame, { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 }, 0.05);
    }
    tl.fromTo(fades, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05 }, 0.28);
    tl.fromTo(q('.lb__glint'), { xPercent: -100 }, { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 0.2);
  }

  function close() {
    if (!isOpen || closing) return;
    closing = true;
    tl?.kill(); nav?.kill();
    dlg.querySelectorAll('.lb__ghost').forEach((g) => g.remove());
    gsap.set(img, { x: 0, opacity: 1 });
    if (env.reduced) { dlg.close(); return; }
    const t = thumb(i);
    tl = gsap.timeline({ onComplete: () => dlg.close() });
    tl.to(fades, { opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' }, 0)
      .to(scrim, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.08);
    if (onScreen(t)) {
      links[i].classList.add('is-lifted');
      tl.fromTo(frame, { x: 0, y: 0, scaleX: 1, scaleY: 1 }, { ...flipFrom(t), duration: 0.6, ease: 'expo.inOut' }, 0);
    } else {
      tl.to(frame, { opacity: 0, scale: 0.94, duration: 0.3, ease: 'power2.in' }, 0);
    }
  }

  // every way of closing ends here (our animated close, or a close request we could not cancel)
  function finish() {
    tl?.kill(); nav?.kill();
    isOpen = false; closing = false;
    dlg.querySelectorAll('.lb__ghost').forEach((g) => g.remove());
    gsap.set([frame, scrim, img, ...fades], { clearProps: 'all' });
    links.forEach((l) => l.classList.remove('is-lifted'));
    lock(false);
    const back = links[i].offsetParent ? links[i] : opener;
    back?.focus({ preventScroll: true });
  }

  function go(d) {
    if (!isOpen || closing || n < 2 || !d) return;
    const s = Math.sign(d) * 60; // Home/End jump far, but the slide is always one step long
    nav?.kill();
    dlg.querySelectorAll('.lb__ghost').forEach((g) => g.remove());
    let ghost = null;
    if (!env.reduced) {
      ghost = img.cloneNode();
      ghost.className = 'lb__ghost';
      ghost.alt = '';
      ghost.style.transform = img.style.transform;
      frame.insertBefore(ghost, img.nextSibling);
    }
    fill(i + d);
    live.textContent = `${i + 1} de ${n}: ${links[i].dataset.title}`;
    if (env.reduced) return;
    nav = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: () => ghost.remove() });
    nav.to(ghost, { x: -s, opacity: 0, duration: 0.4, ease: 'power2.out' }, 0)
      .fromTo(img, { x: s, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55 }, 0)
      .fromTo(panel.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.035, clearProps: 'transform' }, 0.05);
  }

  links.forEach((a, k) => {
    a.setAttribute('aria-haspopup', 'dialog');
    on(a, 'click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(k, a);
    });
  });
  on(dlg, 'click', (e) => {
    const t = e.target;
    if (t.closest('[data-lb-prev]')) go(-1);
    else if (t.closest('[data-lb-next]')) go(1);
    else if (t.closest('[data-lb-close]') || t === dlg || t.classList.contains('lb__stage') || t === figure) close();
  });
  on(dlg, 'keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); go(step); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go((e.key === 'Home' ? 0 : n - 1) - i); }
  });
  on(dlg, 'cancel', (e) => { e.preventDefault(); close(); });
  on(dlg, 'close', finish);

  // swipe (touch / pen): the photo follows the finger, a flick of 50px changes post
  let sx = 0, sy = 0, pid = null;
  on(figure, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !isOpen) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY;
    try { figure.setPointerCapture(pid); } catch (err) { /* pointer already gone */ }
  });
  on(figure, 'pointermove', (e) => {
    if (e.pointerId !== pid || env.reduced) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > Math.abs(e.clientY - sy)) gsap.set(img, { x: dx * 0.55, opacity: 1 - Math.min(0.5, Math.abs(dx) / 500) });
  });
  const release = (e, cancel) => {
    if (e.pointerId !== pid) return;
    pid = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!cancel && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
    else if (!env.reduced) gsap.to(img, { x: 0, opacity: 1, duration: 0.45, ease: 'expo.out' });
  };
  on(figure, 'pointerup', (e) => release(e, false));
  on(figure, 'pointercancel', (e) => release(e, true));

  return () => {
    ac.abort();
    tl?.kill(); nav?.kill();
    if (dlg.open) dlg.close();
    isOpen = false;
    root.classList.remove('lb-lock');
    links.forEach((l) => { l.removeAttribute('aria-haspopup'); l.classList.remove('is-lifted'); });
  };
}
