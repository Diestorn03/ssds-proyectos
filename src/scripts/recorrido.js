/*
  #recorrido · El Recorrido (components/home/Recorrido.astro).
  Desktop gate: the stage is a CSS sticky pin (height set from --d); one linear scrubbed tween slides the track
  over the first D px of that range, the last HOLD viewport heights are a dwell on "Circuito completo" so the
  hand-off to #valores never starts while the track is still sliding. Everything hangs off the tween's progress p:
    · cable: a sliding mask (transform only) whose tip leads at LEAD of the viewport and plugs into the last card
    · branches: scaleY fills as the tip reaches each card's junction → the card gets .is-on ("se conecta":
      CSS flickers the ring, lights the LED, charges the number, sweeps the brand ray over the photo)
    · HUD "Etapa 0X / 04" = stations connected so far; .is-complete when "tu proyecto" lights up
    · photos: inner xPercent parallax, stations swing in from the right (both containerAnimation)
  Touch / narrow: native scroll-snap row; a card connects once when half of it is in view (IntersectionObserver).
  Reduced motion / no JS: nothing runs, the CSS default is the connected final state.
*/
import { onPage } from './engine.js';

const LEAD = 0.62; // tip position in the viewport at p = 0 (drifts right as p grows)
const FILL = 70;   // px of tip travel for a branch to fill, ending at the junction
const HOLD = 0.6;  // end dwell, in viewport heights of scroll ("Circuito completo" reads before the hand-off)

onPage(({ gsap, ScrollTrigger, env, scrollTo }) => {
  const root = document.getElementById('recorrido');
  if (!root || env.reduced) return;

  const cards = [...root.querySelectorAll('.rc__card')];
  const last = cards.length - 1; // "tu proyecto es el siguiente"
  const hud = root.querySelector('.rc__hud');
  const rail = root.querySelector('.rc__rail');
  let shown = '';
  const setHud = (lit, current, complete) => {
    const key = `${lit}|${current}|${complete}`;
    if (key === shown) return;
    shown = key;
    hud.dataset.on = lit; // not data-lit: that is the engine's word-lighting hook
    hud.style.setProperty('--s', Math.max(0, current - 1));
    root.classList.toggle('is-complete', complete);
  };
  const reset = () => {
    root.classList.remove('rc--live', 'rc--pin', 'is-flowing', 'is-complete', 'is-swiped');
    root.style.removeProperty('--d');
    cards.forEach((c) => c.classList.remove('is-on'));
    hud.removeAttribute('style');
    delete hud.dataset.on;
  };
  root.classList.add('rc--live');

  /* ---------- touch / narrow: connect once in view ---------- */
  if (!env.desktop) {
    const lit = new Set();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = cards.indexOf(e.target);
      // the current reached card i through every card before it (a fast fling may skip one)
      for (let j = 0; j <= i; j++) { cards[j].classList.add('is-on'); if (j < last) lit.add(j); }
      setHud(lit.size, Math.min(i + 1, last), i === last);
    }), { threshold: 0.55 });
    cards.forEach((c) => io.observe(c));
    setHud(0, 1, false);
    const onSwipe = () => { root.classList.add('is-swiped'); rail.removeEventListener('scroll', onSwipe); };
    rail.addEventListener('scroll', onSwipe, { passive: true });
    // the row slides in from the right once
    gsap.from(root.querySelectorAll('.rc__station, .rc__next'), { x: 70, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: rail, start: 'top 85%', once: true } });
    return () => { io.disconnect(); rail.removeEventListener('scroll', onSwipe); reset(); };
  }

  /* ---------- desktop: pinned horizontal recorrido ---------- */
  root.classList.add('rc--pin');
  const stage = root.querySelector('.rc__stage');
  const track = root.querySelector('.rc__track');
  const intro = root.querySelector('.rc__intro');
  const bleed = root.querySelector('.rc__bleed');
  const cable = root.querySelector('.rc__cable');
  const reveal = root.querySelector('.rc__reveal');
  const fill = root.querySelector('.rc__fill');
  const tip = root.querySelector('.rc__tip');
  const src = root.querySelector('.rc__src');
  const branches = cards.map((c) => c.querySelector('.rc__branch'));

  // layout is read here only (refresh), never while scrolling. VW = clientWidth: innerWidth counts the classic
  // 17px Windows scrollbar, which would park the last card under it
  let W = 0, D = 0, END = 0, VW = 0, centres = [], ks = [];
  const measure = () => {
    VW = document.documentElement.clientWidth;
    W = track.scrollWidth;
    D = Math.max(0, W - VW);
    root.style.setProperty('--d', `${Math.round(D + innerHeight * HOLD)}px`); // sticky range = travel + dwell
    centres = cards.map((c) => c.offsetLeft + c.offsetWidth / 2); // track coordinates, untransformed
    END = centres[last];
    src.style.left = `${intro.offsetLeft - src.offsetWidth / 2}px`; // the source sits on the intro's left edge
    const x0 = src.offsetLeft + src.offsetWidth / 2; // the cable is born at the source hexagon
    cable.style.left = `${x0}px`;
    cable.style.right = 'auto';
    cable.style.width = `${END - x0}px`;
    ks = cards.map(() => -1);
  };
  const render = (p) => {
    const tipX = Math.min(END, p * D + VW * (LEAD + (1 - LEAD) * p));
    const s = Math.max(0, END - tipX); // unlit length at the right end of the cable
    reveal.style.transform = `translate3d(${-s}px,0,0)`;
    fill.style.transform = `translate3d(${s}px,0,0)`;
    tip.style.transform = `translate3d(${tipX}px,0,0)`;
    let lit = 0;
    cards.forEach((card, i) => {
      const k = Math.round(gsap.utils.clamp(0, 1, (tipX - centres[i] + FILL) / FILL) * 100) / 100;
      if (k !== ks[i]) {
        branches[i].style.transform = `scaleY(${k})`;
        card.classList.toggle('is-on', k >= 1);
        ks[i] = k;
      }
      if (k >= 1 && i < last) lit++;
    });
    bleed.style.transform = `translate3d(${-p * D * 0.24}px,0,0)`;
    setHud(lit, Math.max(1, lit), ks[last] >= 1);
  };

  measure();
  let street = null;
  // past either end of the travel the scrub's catch-up runs 4× faster: after a fast fling the track lands
  // (in ~0.15 s) during the dwell, never while the stage is already scrolling away into #valores / the Tablero
  const catchUp = (k) => () => street?.scrollTrigger?.getTween()?.timeScale(k);
  street = gsap.to([track, intro], {
    x: (i) => (i ? -D * 1.12 : -D), // the intro leaves a touch faster: depth
    ease: 'none',
    scrollTrigger: {
      trigger: root,
      start: 'top top',
      end: () => `+=${D}`, // the sticky range is D + dwell: the track lands before the stage lets go
      scrub: 0.6,
      invalidateOnRefresh: true,
      onRefreshInit: measure,
      onRefresh: () => render(street ? street.progress() : 0),
      onEnter: catchUp(1),
      onEnterBack: catchUp(1),
      onLeave: catchUp(4),
      onLeaveBack: catchUp(4),
    },
    onUpdate() { render(this.progress()); },
  });
  // idle loops (tip crackle, current, waves) only while the stage is stuck on screen, dwell included
  const flow = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onToggle: (s) => root.classList.toggle('is-flowing', s.isActive) });
  render(0);

  cards.forEach((card) => {
    const img = card.querySelector('.rc__frame img');
    if (img) {
      gsap.fromTo(img, { xPercent: -4 }, {
        xPercent: 4, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: street, start: 'left right', end: 'right left', scrub: true },
      });
    }
    // stations swing up from the right edge and settle before the cable reaches them
    const panel = card.querySelector('.rc__station, .rc__next');
    gsap.fromTo(panel, { y: 90, rotation: 3.5, transformOrigin: '0% 100%' }, {
      y: 0, rotation: 0, ease: 'power2.out',
      scrollTrigger: { trigger: card, containerAnimation: street, start: 'left 104%', end: 'left 58%', scrub: true },
    });
    const kids = card.querySelectorAll('.rc__body > *, .rc__next > :not(.rc__next-ray)');
    gsap.fromTo(kids, { y: 28, opacity: 0 }, {
      y: 0, opacity: 1, ease: 'power2.out', stagger: 0.12,
      scrollTrigger: { trigger: card, containerAnimation: street, start: 'left 96%', end: 'left 60%', scrub: true },
    });
  });

  // keyboard: a focused card must not scroll the clipped stage sideways; move the page to where it is in view instead.
  // Next frame: the browser's own focus scroll-into-view runs after focusin and would undo a scroll made here.
  // immediate: a running Lenis animation would in turn override the native scroll-into-view of the next tab stops
  const onFocus = (e) => {
    const i = cards.indexOf(e.target.closest('.rc__card'));
    if (i < 0 || !e.target.matches(':focus-visible')) return; // a mouse click must not move the page
    const unscroll = () => { stage.scrollLeft = 0; };
    unscroll();
    requestAnimationFrame(() => {
      unscroll();
      const p = gsap.utils.clamp(0, 1, (centres[i] - VW / 2) / (D || 1));
      scrollTo(street.scrollTrigger.start + p * D, { offset: 0, immediate: true });
    });
  };
  root.addEventListener('focusin', onFocus);

  return () => {
    root.removeEventListener('focusin', onFocus);
    flow.kill();
    reset();
    [reveal, fill, tip, bleed, cable, src, ...branches].forEach((el) => el.removeAttribute('style'));
  };
});
