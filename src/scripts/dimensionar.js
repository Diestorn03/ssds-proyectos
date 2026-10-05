// #dimensionar controller: 3 steps (punto de partida → equipos → horas) + resumen fijo "Tu sistema" → result with Básica / Recomendada / Holgada → WhatsApp.
// Registered from components/pages/Dimensionador.astro via onPage(initDimensionador). Rules, prices and the WhatsApp message: src/data/dimensionar.js
// (the controller NEVER builds or edits message lines). State lives in the DOM (the form) and in the URL (?c=&o=&w=&via=).
// For the PDF module: root.dzState() → { answers, tier, result, option, url, done } and a 'dz:state' CustomEvent on #dimensionar after each fill.
// No GSAP here: the only motion is one opacity+translate entrance per step / result (and a transform on the load bar), gated by env.reduced.
import { K, loads, presets, size, clean, encodeState, decodeState, fmtUSD, pricing, batteries } from '../data/dimensionar.js';
import { wa } from '../data/site.js';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const HOURS = [2, 4, 8, 12, 24];
const TIERS = ['basico', 'recomendado', 'holgado'];
const STEP_NAMES = ['Punto de partida', 'Equipos', 'Horas'];
const T2O = { basico: 'b', recomendado: 'r', holgado: 'h' }, O2T = { b: 'basico', r: 'recomendado', h: 'holgado' };
const byId = Object.fromEntries(loads.map((l) => [l.id, l]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 1) => Number(n).toLocaleString('es-VE', { maximumFractionDigits: d });
const kwTxt = (w) => `${fmt(w / 1000)} kW`;
const list = (xs) => new Intl.ListFormat('es', { type: 'conjunction' }).format(xs);
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const acTxt = (inv) => (inv.ac === '110' ? '110 V' : '120/240 V');
const svg = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const LIGHT_ICON = { ok: svg('<path d="m5 12 4 4L19 6"/>'), warn: svg('<path d="M12 4v9M12 18h.01"/>'), bad: svg('<path d="M6 6l12 12M18 6 6 18"/>') };
const hasItems = (a) => Object.keys(a.items).length > 0 || a.custom.length > 0;

// Fotos en public/equipos/<modelo en minúsculas>.webp (tamaño natural, para width/height y CLS 0). El Roccia no tiene foto: ilustración propia.
const EQ_IMG = {
  'ivem1612-lv': [301, 420], 'ivem2024-lv': [351, 420], 'ivem3048-lv': [280, 399], 'ivem5048-lv': [280, 399], ivgm8klp2g1: [244, 420],
  'fla12280-eu': [289, 240], 'fla24100-eu': [224, 252], 'fla48100-eu': [159, 288], 'fla48230-eu': [159, 272], 'fla48314-eu': [147, 279], 'fla48460tg2-eu': [191, 350],
};
const rocciaSvg = (alt) => `<svg width="140" height="196" viewBox="0 0 140 196" role="img" aria-label="${esc(alt)}"><rect x="50" y="0" width="40" height="7" rx="2" fill="#25488a"/><rect x="10" y="5" width="120" height="171" rx="14" fill="#1a3468"/><rect x="18" y="13" width="104" height="155" rx="9" fill="#10244f"/><rect x="30" y="26" width="80" height="46" rx="5" fill="#060d1f"/><rect x="38" y="38" width="40" height="5" rx="2.5" fill="#f26a1b"/><rect x="38" y="49" width="56" height="4" rx="2" fill="#ffd79a" opacity=".85"/><rect x="38" y="58" width="28" height="4" rx="2" fill="#a9b6cf"/><circle cx="44" cy="92" r="3.5" fill="#f26a1b"/><circle cx="58" cy="92" r="3.5" fill="#ffb454"/><circle cx="72" cy="92" r="3.5" fill="#a9b6cf"/><rect x="30" y="106" width="80" height="3" rx="1.5" fill="#f26a1b"/><path d="M32 124h76M32 133h76M32 142h76" stroke="#25488a" stroke-width="2.5" stroke-linecap="round"/><rect x="28" y="176" width="14" height="12" rx="2" fill="#0b1a3a"/><rect x="50" y="176" width="14" height="12" rx="2" fill="#0b1a3a"/><rect x="76" y="176" width="14" height="12" rx="2" fill="#0b1a3a"/><rect x="98" y="176" width="14" height="12" rx="2" fill="#0b1a3a"/></svg>`;

export function initDimensionador({ env, scrollTo }) {
  const root = document.getElementById('dimensionar');
  if (!root) return;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const form = $('[data-dz-form]'), grid = $('[data-dz-grid]'), steps = $$('[data-dz-step]'), next = $('[data-dz-next]'), back = $('[data-dz-back]');
  const nextLbl = $('[data-dz-next-lbl]'), segs = $$('[data-dz-seg]'), countN = $('[data-dz-count]'), stepLbl = $('[data-dz-steplbl]');
  const barPrice = $('[data-dz-bar-price]'), barSub = $('[data-dz-bar-sub]');
  const card = $('[data-dz-card]'), res = $('[data-dz-res]'), live = $('[data-dz-live]');
  const sumEl = $('[data-dz-sum]'), sumEmpty = $('[data-dz-sum-empty]'), sumFull = $('[data-dz-sum-full]'), sumProd = $('[data-dz-sum-prod]'), sumLoad = $('[data-dz-sum-load]');
  const sumPrice = $('[data-dz-sum-price]'), sumPl = $('[data-dz-sum-pl]'), sumCover = $('[data-dz-sum-cover]'), sumN = $('[data-dz-sum-n]'), sumBar = $('[data-dz-sum-bar]'), sumLoadTxt = $('[data-dz-sum-loadtxt]');
  const sumInv = $('[data-dz-sum-inv]'), sumInvS = $('[data-dz-sum-invs]'), sumBat = $('[data-dz-sum-bat]'), sumBatS = $('[data-dz-sum-bats]');
  const rows = $$('[data-dz-row]'), rowById = new Map(rows.map((r) => [r.dataset.dzRow, r]));
  const tabs = $$('[data-dz-tab]'), tabsBox = $('[data-dz-tabs]'), groups = $$('[data-dz-group]'), customRows = $$('[data-dz-crow]');
  const fromRow = $('[data-dz-fromrow]'), fromEl = $('[data-dz-from]');
  const okBox = $('[data-dz-ok]'), oosBox = $('[data-dz-oos]'), tiersBox = $('[data-dz-tiers]');
  const tierEl = Object.fromEntries(TIERS.map((t) => [t, $(`[data-dz-tier="${t}"]`)]));
  const statusEl = $('[data-dz-status]'), statusIc = $('.dz-status__ic', statusEl), statusT = $('[data-dz-status-t]');
  const resume = $('[data-dz-resume]'), igTip = $('[data-dz-igtip]'), msgBox = $('.dz-res__msg');
  const reduced = env.reduced;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const last = steps.length - 1;
  let cur = 0, done = false, pointer = false, via = null, raf = 0;
  let S = { a: clean({}), R: size({}), o: null };   // last computed state

  /* ---------- form → answers ---------- */
  const qtyOf = (row) => parseInt($('[data-dz-qty]', row).value, 10) || 0;
  function setQty(row, n) {
    n = clamp(n, 0, 20);
    $('[data-dz-qty]', row).value = String(n);
    paintRow(row, n);
  }
  function paintRow(row, n) {
    row.classList.toggle('is-on', n > 0);
    $('[data-dz-hit]', row).setAttribute('aria-pressed', String(n > 0));
    const ask = $('[data-dz-ask]', row);
    if (ask) ask.hidden = n === 0;
  }
  function readAnswers() {
    const fd = new FormData(form), get = (k) => fd.get(k);
    const items = {};
    rows.forEach((r) => { const n = qtyOf(r); if (n) items[r.dataset.dzRow] = n; });
    const custom = customRows.map((_, i) => ({ t: get(`ct${i}`), w: get(`cw${i}`), n: get(`cn${i}`), m: get(`cm${i}`) === '1' }));
    const v220 = {};
    rows.forEach((r) => {
      if (!$('[data-dz-ask]', r)) return;
      const v = get(`v220-${r.dataset.dzRow}`);
      if (v === '1') v220[r.dataset.dzRow] = true; else if (v === '0') v220[r.dataset.dzRow] = false;   // '?' (no sé) = unanswered: the engine keeps asking
    });
    return clean({
      items, custom, v220, hours: get('hours'), place: get('place'), hot: get('hot') === '1', solar: get('solar') === '1',
      install: get('install'), transfer: get('install') === 'equipo' ? 'no' : get('transfer'), extraM: get('install') === 'equipo' ? 0 : get('extraM'), city: get('city'), preset: get('preset'), tier: get('tier'), when: get('when'), via,
    });
  }
  const compute = () => { const a = readAnswers(), R = size(a); S = { a, R, o: R.options.find((x) => x.tier === R.chosen) || null }; return S; };
  const units = (a) => Object.values(a.items).reduce((s, n) => s + n, 0) + a.custom.reduce((s, c) => s + c.n, 0);
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

  /* ---------- price views ---------- */
  function priceView(o, a, RI) {
    const t = o.totals, eq = t.equipo, d = t.detalle, spread = d && d.range[1] > d.range[0] ? d.range[1] - d.range[0] : 0;
    if (a.install === 'instalado') {
      if (t.total == null) return { main: fmtUSD(eq), raw: eq, pl: 'solo equipo', sub: 'Instalación: se confirma en la visita' };
      return { main: fmtUSD(t.total), raw: t.total, from: spread > 0, pl: 'instalado', sub: `Solo equipo ${fmtUSD(eq)}` };
    }
    if (a.install === 'manoObra') {
      if (t.total == null) return { main: fmtUSD(eq), raw: eq, pl: 'solo equipo', sub: '+ mano de obra: se confirma en la visita' };
      return { main: fmtUSD(t.total), raw: t.total, pl: 'con mano de obra', sub: `Solo equipo ${fmtUSD(eq)}` };
    }
    const ri = RI?.options.find((x) => x.tier === o.tier)?.totals;
    const sp = ri?.detalle && ri.detalle.range[1] > ri.detalle.range[0];
    return { main: fmtUSD(eq), raw: eq, pl: 'solo equipo', sub: ri?.total != null ? `Instalado ${sp ? 'desde ' : ''}${fmtUSD(ri.total)}` : '' };
  }
  const priceText = (o, a) => { const p = priceView(o, a, null); return `≈ ${p.main} ${p.pl}`; };
  const batText = (o) => `${o.batteries.n} batería${o.batteries.n > 1 ? 's' : ''} de litio de ${fmt(o.batteries.kwh / o.batteries.n, 2)} kWh`;
  const hTxt = (h, capped) => (capped ? `más de ${K.maxAutonomyH} h` : `≈ ${fmt(h)} h`);
  const rechTxt = (o) => (o.rechargeH < 1 ? 'menos de 1 h' : `≈ ${fmt(o.rechargeH)} h`);
  const batOf = (o) => batteries.find((b) => b.model === o.batteries.model);

  /* ---------- equipment photos: inverter + battery of the option on screen ---------- */
  function setPic(slot, kind, item, n = 1) {
    const slug = String(item.model).toLowerCase(), key = `${slug}|${n}`;
    if (slot.dataset.k === key) return;
    slot.dataset.k = key;
    const alt = kind === 'inv' ? `Inversor híbrido ${fmt(item.kw)} kW` : n > 1 ? `${n} baterías de litio de ${fmt(item.kwh, 2)} kWh` : `Batería de litio ${fmt(item.kwh, 2)} kWh`;
    const d = EQ_IMG[slug];
    slot.innerHTML = (d ? `<img src="${BASE}/equipos/${slug}.webp" alt="${esc(alt)}" width="${d[0]}" height="${d[1]}" loading="lazy" decoding="async">` : rocciaSvg(alt)) + (n > 1 ? `<b class="dz-pic__n" aria-hidden="true">×${n}</b>` : '');
  }
  function paintPics(scope, o) {
    setPic($('[data-dz-pic="inv"]', scope), 'inv', o.inverter);
    setPic($('[data-dz-pic="bat"]', scope), 'bat', batOf(o), o.batteries.n);
  }

  /* ---------- "Tu sistema" (desktop) and the price in the bottom bar (phones): text and one transform, safe on every input event ---------- */
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  function paintSummary() {
    const { a, R, o } = S, on = hasItems(a), oos = !!R.outOfScope, n = units(a), full = on && !oos && !!o;
    sumEl.dataset.state = !on ? 'empty' : oos ? 'oos' : 'ok';
    sumEmpty.hidden = on; sumFull.hidden = !on; sumProd.hidden = !full; sumLoad.hidden = !full;
    let price = '', pl = '', cover = '', pct = 0, bar = cur === 0 ? 'Elige un punto de partida' : 'Marca al menos un equipo', warn = false, tight = false;
    if (full) {
      const p = priceView(o, a, null), H = fmt(a.hours, 0), ok = o.coverage >= K.quoteSlack, inv = o.inverter, b = batOf(o), per = o.batteries.kwh / o.batteries.n;
      price = p.main; pl = `${p.pl} · precio referencial`; warn = !ok;
      cover = ok ? `Cubre tus ${H} h` : `Cubre ≈ ${fmt(o.coversH)} de tus ${H} h`;
      pct = clamp(R.contW / (inv.kw * 1000), 0, 1); tight = pct > K.tightShare;
      setText(sumInv, `Inversor ${fmt(inv.kw)} kW`); setText(sumInvS, acTxt(inv));
      setText(sumBat, `${plural(o.batteries.n, 'batería')} de ${fmt(per, 2)} kWh`);
      setText(sumBatS, o.batteries.n > 1 ? `${fmt(o.batteries.kwh, 2)} kWh en total · ${b.busV} V` : `Litio · ${b.busV} V`);
      paintPics(sumProd, o);
      setText(sumLoadTxt, `Carga: ${kwTxt(R.contW)} de ${fmt(inv.kw)} kW`);
      bar = plural(n, 'equipo');
    } else if (oos) { price = 'Con ingeniero'; pl = 'Este caso se cotiza aparte'; cover = 'Lo verás en el resultado'; bar = 'Se cotiza aparte'; }
    setText(sumPrice, price); setText(sumPl, pl); setText(sumCover, cover); sumCover.classList.toggle('is-warn', warn);
    setText(sumN, on ? plural(n, 'equipo') : '');
    sumBar.style.transform = `scaleX(${pct.toFixed(3)})`; sumBar.classList.toggle('is-tight', tight);
    setText(barPrice, price); setText(barSub, bar);
  }

  /* ---------- steps ---------- */
  const answered = (i) => (i === 0 ? !!$('input[name="preset"]:checked') : i === 1 ? hasItems(readAnswers()) : true);
  function showTab(id, focus = false) {
    tabs.forEach((t) => { const on = t.dataset.dzTab === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    groups.forEach((p) => { p.hidden = p.dataset.dzGroup !== id; });
    const t = tabs.find((x) => x.dataset.dzTab === id);   // phones: the strip scrolls sideways; keep the active tab in view without moving the page
    if (t && tabsBox.scrollWidth > tabsBox.clientWidth) tabsBox.scrollLeft = Math.max(0, t.offsetLeft - (tabsBox.clientWidth - t.offsetWidth) / 2);
  }
  const firstTab = () => groups.find((g) => $$('[data-dz-row]', g).some((r) => qtyOf(r) > 0))?.dataset.dzGroup || 'esencial';
  function paintCounts() {
    const a = S.a;
    groups.forEach((g) => {
      const id = g.dataset.dzGroup, tab = $(`[data-dz-tab="${id}"] [data-dz-gn]`);
      const n = id === 'otro' ? a.custom.reduce((s, c) => s + c.n, 0) : $$('[data-dz-row]', g).reduce((s, r) => s + qtyOf(r), 0);
      tab.textContent = n ? String(n) : ''; tab.hidden = !n;
      if (id === 'clima') $('[data-dz-hotnote]').hidden = n === 0;
    });
  }
  function syncNav() {
    next.disabled = done || !answered(cur);
    back.disabled = cur === 0;
    nextLbl.innerHTML = cur === last ? 'Ver <span class="dz-xs-hide">mi </span>precio' : 'Siguiente';
    card.dataset.step = String(cur);
  }
  function syncTrack() {
    segs.forEach((s, i) => { s.classList.toggle('is-done', done || i < cur); s.classList.toggle('is-current', !done && i === cur); });
    countN.textContent = String(Math.min(cur + 1, last + 1));
    stepLbl.textContent = STEP_NAMES[Math.min(cur, last)];
  }
  function sync() {   // everything that can follow every input event
    compute(); paintSummary(); paintCounts(); syncNav();
    if (cur === last) paintLive();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); }); };

  function hourCover() {   // each duration that the current system would NOT cover fully says so (5 size() calls, only on change)
    const a = readAnswers();
    HOURS.forEach((h) => {
      const r = size({ ...a, hours: h, install: 'equipo', tier: null, url: null }), o = r.options.find((x) => x.tier === r.chosen);
      $(`[data-dz-hp="${h}"]`).textContent = o && o.coverage < K.quoteSlack ? `Solo cubre ≈ ${fmt(o.coversH)} h` : '';
    });
  }
  function paintLive() {
    const { a, R, o } = S;
    $('[data-dz-liveline]').textContent = o && !R.outOfScope ? `Para cubrir ${fmt(a.hours, 0)} h necesitas ${batText(o)}.` : R.outOfScope ? 'Con estos equipos hace falta un ingeniero: lo verás en el resultado.' : '';
    $('[data-dz-plant]').hidden = !(o && R.plant);
  }

  const focusStep = (el) => {
    const t = el.matches('.dz-step--items') ? el.querySelector('[role="tab"][aria-selected="true"]') : el.querySelector('input:checked') || el.querySelector('input');
    t?.focus({ preventScroll: true });
  };
  function setStep(to) { steps.forEach((s, i) => { s.classList.toggle('is-active', i === to); s.inert = i !== to; }); }
  const enter = (el) => { if (!reduced) el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' }); };
  const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  function toCardTop(el = card) {   // the question always lands in view after Siguiente / Atrás / Editar / Volver a empezar
    const top = headerH() + 12, r = el.getBoundingClientRect();
    // absolute y + immediate: the step swap changes the page height, and a smooth Lenis tween started from a stale
    // position (or throttled rAF in a background tab) could leave the question off screen
    if (r.top < top - 4 || r.top > top + (innerWidth < 960 ? 24 : 160)) scrollTo(Math.max(0, window.scrollY + r.top - top), { offset: 0, immediate: true });
  }
  function go(to) {
    if (to === cur || to < 0 || to > last) return;
    cur = to;
    sync(); syncTrack();
    if (to === 2) { hourCover(); paintLive(); }
    setStep(to); focusStep(steps[to]);
    toCardTop();
    enter(steps[to]);
  }
  function onSubmit(e) {
    e.preventDefault();
    if (done || !answered(cur)) return;
    if (cur < last) go(cur + 1); else finish();
  }
  // Enter on a radio / checkbox moves on (native forms only do that for text fields); arrows move between the equipment tabs
  function onKey(e) {
    pointer = false;
    if (e.key === 'Enter' && e.target.matches('[data-dz-pdf-name]')) { e.preventDefault(); downloadPdf(); return; }   // "Ir" del teclado del celular
    if (e.target.matches('[role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const i = tabs.indexOf(e.target), j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      showTab(tabs[j].dataset.dzTab, true);
      return;
    }
    if (e.key !== 'Enter' || done || !e.target.matches('input[type="radio"], input[type="checkbox"]')) return;
    e.preventDefault();
    if (!next.disabled) form.requestSubmit();
  }

  /* ---------- announcements ---------- */
  const say = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };
  const priceSay = () => (S.o ? priceText(S.o, S.a) : 'sin precio todavía');

  /* ---------- preset / quantities ---------- */
  function applyPreset(id) {
    rows.forEach((r) => setQty(r, 0));
    customRows.forEach((r) => { $$('input', r).forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }); });
    $$('input[name^="v220-"]').forEach((i) => { i.checked = false; });
    const p = presets.find((x) => x.id === id);
    if (p) Object.entries(p.items).forEach(([k, n]) => { const r = rowById.get(k); if (r) setQty(r, n); });
    if (id !== 'cero') { const place = $(`input[name="place"][value="${id === 'negocio' || id === 'oficina' ? 'negocio' : 'casa'}"]`); if (place) place.checked = true; }
    fromEl.textContent = p ? p.t : 'Desde cero';
    fromRow.hidden = false;
    showTab(firstTab());
  }
  function bump(row, delta, ev) {
    const before = qtyOf(row), after = clamp(delta === 'toggle' ? (before ? 0 : 1) : before + delta, 0, 20);
    if (after === before) return;
    setQty(row, after);
    if (after === 0) $('[data-dz-hit]', row).focus({ preventScroll: true });   // el − queda oculto en 0: el foco pasa a la fila, no a <body>
    sync();
    if (after > before && env.coarse && ev.detail > 0) navigator.vibrate?.(8);
    say(`${after > before ? 'Agregado' : 'Quitado'}: ${lc(byId[row.dataset.dzRow].t)} ×${after} · ${priceSay()}`);
  }

  function onInput(e) {
    const t = e.target;
    if (t.matches('[data-dz-extra]')) { t.value = t.value.replace(/\D/g, ''); return; }
    if (done) return;
    if (t.matches('[data-dz-qty], [name^="cw"], [name^="cn"]')) {
      const clean0 = t.value.replace(/\D/g, '');
      if (clean0 !== t.value) t.value = clean0;
      if (t.matches('[data-dz-qty]')) paintRow(t.closest('[data-dz-row]'), parseInt(clean0, 10) || 0);
    }
    schedule();
  }
  function onChange(e) {
    const t = e.target;
    if (!t.matches('input') || t.matches('[data-dz-pdf-name]')) return;   // el nombre del PDF no dimensiona: no refresca el resultado
    if (t.matches('[data-dz-extra]')) t.value = String(clamp(parseInt(t.value, 10) || 0, 0, 30));
    if (done) { refresh(); return; }
    if (t.matches('[data-dz-qty]')) { const row = t.closest('[data-dz-row]'); setQty(row, parseInt(t.value, 10) || 0); }
    sync();
    if (t.name === 'preset') {
      applyPreset(t.value); sync();
      say(`${t.closest('.dz-card-opt').querySelector('.dz-opt__t').textContent}: ${units(S.a)} equipos, ${priceSay()}`);
      if (env.coarse) navigator.vibrate?.(8);
      if (pointer) later(() => { if (!done && cur === 0 && answered(0)) go(1); }, 380);   // mouse / touch: long enough to see the choice; keyboard: Enter / Siguiente
      return;
    }
    if (t.name === 'hours' || t.name === 'place') { hourCover(); paintLive(); if (t.name === 'hours') say(`${t.value} h: ${priceSay()}`); }
  }
  function onClick(e) {
    const t = e.target;
    const row = t.closest('[data-dz-row]');
    if (row && t.closest('[data-dz-hit]')) return bump(row, 'toggle', e);
    if (row && t.closest('[data-dz-dec]')) return bump(row, -1, e);
    if (row && t.closest('[data-dz-inc]')) return bump(row, 1, e);
    const tab = t.closest('[data-dz-tab]');
    if (tab) return showTab(tab.dataset.dzTab);
    if (t.closest('[data-dz-extra-dec], [data-dz-extra-inc]')) {
      const inp = $('[data-dz-extra]');
      inp.value = String(clamp((parseInt(inp.value, 10) || 0) + (t.closest('[data-dz-extra-inc]') ? 1 : -1), 0, 30));
      return refresh();
    }
    if (t.closest('[data-dz-adjust]')) { const d = $('[data-dz-acc-adjust]'); d.open = true; $('summary', d).focus({ preventScroll: true }); return toCardTop(d); }
    if (t.closest('[data-dz-back]')) return go(cur - 1);   // go() moves focus to the step, so a disabled Atrás never keeps it
    if (t.closest('[data-dz-change]')) return go(0);
    if (t.closest('[data-dz-edit]')) return reopen(1);
    if (t.closest('[data-dz-restart]')) return restart();
    if (t.closest('[data-dz-remove]')) return removeAndEdit();
    if (t.closest('[data-dz-pdf-btn]')) return downloadPdf();
    const cp = t.closest('[data-dz-copy]');
    if (cp) return copy(cp.dataset.dzCopy, cp);
    if (t.closest('[data-dz-wa]')) say('Se abrió WhatsApp con tu mensaje');
  }

  /* ---------- result ---------- */
  const swap = (el, text) => {
    if (el.textContent === text) return;
    el.textContent = text;
    if (!reduced && !res.hidden) el.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  };
  function buildUrl(a, tier) {
    const q = [];
    if (hasItems(a)) q.push(`c=${encodeState(a)}`);
    if (tier) q.push(`o=${T2O[tier]}`);
    if (a.when) q.push(`w=${a.when}`);
    if (a.via) q.push(`via=${a.via}`);
    return location.origin + location.pathname + (q.length ? `?${q.join('&')}` : '');
  }
  function writeUrl(url) {
    try { const u = new URL(url); history.replaceState(history.state, '', u.pathname + u.search); } catch (e) { /* sandboxed frame */ }
  }
  const unanswered = (a) => rows.filter((r) => $('[data-dz-ask]', r) && a.items[r.dataset.dzRow] && a.v220[r.dataset.dzRow] === undefined).map((r) => byId[r.dataset.dzRow].s);

  function fillTier(el, o, a, RI, R) {
    const t = (k) => $(`[data-dz-t="${k}"]`, el);
    const pv = priceView(o, a, RI), inv = o.inverter, H = fmt(a.hours, 0);
    t('lbl').textContent = o.label;
    t('rev').hidden = !o.review;
    t('from').hidden = !pv.from;
    swap(t('price'), pv.main);
    el.dataset.raw = String(pv.raw);
    t('pl').textContent = pv.pl;
    swap(t('sub'), pv.sub);
    const full = o.coverage >= K.quoteSlack;
    t('line').textContent = full ? `Cubre tus ${H} h` : `Cubre ≈ ${fmt(o.coversH)} de tus ${H} h`;
    t('line').classList.toggle('is-warn', !full);
    t('h').textContent = !o.autonomyCapped && o.autonomyH < a.hours ? `Con todo encendido a la vez: ${hTxt(o.autonomyH, false)}` : `Autonomía ${hTxt(o.autonomyH, o.autonomyCapped)}`;   // el motor mide las horas por energía (lo que se enciende a ratos no cuenta entero); esta línea es el peor caso
    t('inv').textContent = `${fmt(inv.kw)} kW · ${acTxt(inv)}`;
    t('bat').textContent = `${o.batteries.n} × ${fmt(o.batteries.kwh / o.batteries.n, 2)} kWh`;
    const rec = R.options.find((x) => x.tier === 'recomendado'), d = rec ? o.totals.equipo - rec.totals.equipo : 0;
    t('delta').textContent = o.tier === 'recomendado' || !rec ? (rec ? 'Opción base' : '') : `${fmtUSD(Math.abs(d))} ${d < 0 ? 'menos' : 'más'} que la Recomendada`;
    paintPics(el, o);
  }

  function setLight(k, state, text) {
    const li = $(`[data-dz-light="${k}"]`);
    li.dataset.state = state;
    $('.dz-light__ic', li).innerHTML = LIGHT_ICON[state];
    $('.dz-light__t', li).textContent = text;
  }
  function fillDetail(o, a, R) {
    const inv = o.inverter, c = o.checks, H = fmt(a.hours, 0), cap = inv.kw * 1000 * inv.kSurge;
    $('[data-dz-runs]').textContent = R.summary.sayWhatRuns;
    // 1 · arranque
    if (!c.surgeOk || o.review) setLight('start', 'bad', 'Arranque sujeto a revisión: soft-starter o equipo inverter; lo confirmamos en la visita.');
    else if (c.surgeTight) setLight('start', 'warn', o.tier === 'holgado' ? 'Arranca, con poco margen: lo confirmamos en la visita.' : 'Arranca, con poco margen: la opción Holgada te da aire.');
    else setLight('start', 'ok', `Arranca tus equipos: pico ≈ ${fmt(R.peakW, 0)} W dentro de ≈ ${fmt(cap, 0)} W que da el inversor por unos segundos.`);
    // 2 · horas
    const real = `${hTxt(o.realH, o.realH >= K.maxAutonomyH)} con pérdidas normales`;
    if (o.coverage >= K.quoteSlack) setLight('hours', 'ok', `Cubre tus ${H} h: ${hTxt(o.autonomyH, o.autonomyCapped)} con todo encendido y ${real}${o.tier !== 'holgado' && o.coverageReal < 1 ? '; la Holgada las cubre completas' : ''}.`);
    else setLight('hours', 'warn', `Cubre ≈ ${fmt(o.coversH)} de las ${H} h que pediste${o.tier === 'basico' ? '; la Recomendada cubre las ' + H : ''} (${real}).`);
    // 3 · recarga
    if (a.hours >= 24) setLight('charge', 'warn', 'Con cortes de 24 h no hay red para recargar: la batería solo se repone con paneles o planta.');
    else if (c.chargeOk) setLight('charge', 'ok', `Se recarga de la red en ${rechTxt(o)} cuando vuelve la luz.`);
    else setLight('charge', 'bad', `≈ ${fmt(o.rechargeH)} h para recargar: con cortes diarios no alcanza; conviene paneles${inv.busV < 48 ? ' o pasar a un equipo de 48 V' : ' o más inversor'}.`);
    // 4 · 220 V
    const ask = unanswered(a);
    if (ask.length) setLight('v220', 'warn', `Confirma en la placa si tu ${list(ask)} ${ask.length > 1 ? 'son' : 'es'} de 220 V: cambia el inversor.`);
    else if (R.needs220) setLight('v220', 'ok', 'Tu equipo de 220 V pide el inversor de 120/240 V.');
    else setLight('v220', 'ok', inv.ac === '110' ? 'Todo a 110 V.' : 'Todo a 110 V; este inversor es de 120/240 V y también lo atiende.');
    // one status line: all good, or the first warning (the rest is under Detalles)
    const st = ['start', 'hours', 'charge', 'v220'].map((k) => $(`[data-dz-light="${k}"]`)), bad = st.find((l) => l.dataset.state === 'bad') || st.find((l) => l.dataset.state === 'warn');
    statusEl.dataset.state = bad ? bad.dataset.state : 'ok';
    statusIc.innerHTML = LIGHT_ICON[statusEl.dataset.state];
    statusT.textContent = bad ? $('.dz-light__t', bad).textContent : 'Todo lo que marcaste arranca y se respalda.';
    $('[data-dz-whys]').replaceChildren(...o.why.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
    $('[data-dz-model]').textContent = pricing.showModel ? `${inv.brand} ${inv.disp || inv.model} · batería ${o.batteries.model} · con pérdidas normales ≈ ${hTxt(o.realH, o.realH >= K.maxAutonomyH)}` : '';
    $('[data-dz-sel]').textContent = `Tu opción: ${o.label} · ${priceText(o, a)}`;
  }
  function fillHints(hints) {
    const ul = $('[data-dz-hints]');
    ul.replaceChildren(...hints.map((h) => {
      const li = document.createElement('li');
      li.textContent = h;
      if (/planta eléctrica/.test(h)) {
        const link = Object.assign(document.createElement('a'), { className: 'btn btn--text', textContent: 'Ver Respaldo Energético', href: $('[data-dz-plant] a').getAttribute('href') });
        li.append(' ', link);
      }
      return li;
    }));
    $('[data-dz-hintsbox]').hidden = !hints.length;
  }
  function fillCalc(o, a, R) {
    const inv = o.inverter, b = batOf(o), real = K.dod * K.eta;
    const mult = o.tier === 'basico' ? K.margin : K.recMargin, rows2 = [];
    const idle = inv.idleW * a.hours, whI = R.whResp + idle;
    rows2.push(o.tier === 'holgado'
      ? `<b>Energía:</b> ${fmt(whI, 0)} Wh (con el consumo propio del inversor) ÷ (${Math.round(K.dod * 100)} % de descarga × ${Math.round(K.eta * 100)} % de eficiencia) = ${fmt(whI / real / 1000, 2)} kWh → ${o.batteries.n} × ${fmt(b.kwh, 2)} kWh. La ficha permite 95 % de descarga; calculamos con ${Math.round(K.dod * 100)} % para alargar la vida.`
      : `<b>Energía:</b> ${fmt(R.whResp, 0)} Wh a cubrir en ${fmt(a.hours, 0)} h ≈ ${fmt(R.whResp / 1000, 2)} kWh → ${o.batteries.n} × ${fmt(b.kwh, 2)} kWh = ${fmt(o.batteries.kwh, 2)} kWh. Contamos los kWh de la ficha, como cotizamos; con pérdidas normales (${Math.round(K.dod * 100)} % de descarga × ${Math.round(K.eta * 100)} % de eficiencia = ${Math.round(real * 100)} %) rinden ≈ ${fmt(o.realH)} h. La ficha permite 95 % de descarga; calculamos con ${Math.round(K.dod * 100)} % para alargar la vida.`);
    rows2.push(`<b>Potencia:</b> ≈ ${fmt(R.contW, 0)} W continuos × ${fmt(mult, 2)} de margen = ${fmt(R.contW * mult, 0)} W → inversor de ${fmt(inv.kw)} kW (trabaja al ${Math.round((R.contW / (inv.kw * 1000)) * 100)} % de su potencia). Contamos lo que queda encendido más el aparato grande que uses un rato; si vas a encender todo a la vez, dínoslo en el mensaje.`);
    rows2.push(`<b>Arranque:</b> ≈ ${fmt(R.peakW, 0)} W ${o.checks.surgeOk ? '≤' : '>'} ${fmt(inv.kw * 1000 * inv.kSurge, 0)} W (el inversor da ${fmt(inv.kSurge)}× por unos segundos).`);
    const amps = Math.min(inv.gridChargeA, o.batteries.n * b.iCont);
    rows2.push(`<b>Recarga:</b> reponer ≈ ${fmt(whI / 1000, 2)} kWh con hasta ${fmt(amps, 0)} A de la red a ${inv.busV} V ≈ ${fmt(o.rechargeH)} h.`);
    if (o.panels) rows2.push(`<b>Sol:</b> ${fmt(K.psh)} h de sol pico, el mes más nublado de Maracay, con paneles de ${K.panelW} W al ${Math.round(K.pvDerate * 100)} % de rendimiento → ${o.panels.n} sugeridos.`);
    rows2.push(`<b>Instalación:</b> kit y mano de obra por tramo de inversor, una sola vez por sistema; precio referencial, se confirma en la visita.`);
    $('[data-dz-calc]').innerHTML = rows2.map((r) => `<li>${r}</li>`).join('');
  }
  function fillBreak(o, a) {
    const inv = o.inverter, b = batOf(o), t = o.totals, out = [];
    const model = (x) => (pricing.showModel ? ` ${x.disp || x.model}` : '');
    const li = (name, v, cls = '') => `<li><span>${esc(name)}</span><span class="dz-break__v ${cls}">${v}</span></li>`;
    out.push(li(`Inversor híbrido ${fmt(inv.kw)} kW · ${acTxt(inv)}${model(inv)}`, fmtUSD(inv.priceEq)));
    out.push(li(`Batería de litio ${fmt(b.kwh, 2)} kWh${pricing.showModel ? ' ' + b.model : ''} ×${o.batteries.n}`, fmtUSD(b.priceEq * o.batteries.n)));
    if (a.install === 'instalado') {
      if (t.detalle) {
        out.push(li(pricing.kitDesc[t.detalle.kitType], fmtUSD(t.detalle.kit)));
        out.push(li(pricing.laborDesc[t.detalle.kitType], fmtUSD(t.detalle.mo)));
        if (t.detalle.range[1] > t.detalle.range[0]) out.push(li(`Según el recorrido la instalación va de ${fmtUSD(t.detalle.range[0])} a ${fmtUSD(t.detalle.range[1])}`, 'por confirmar', 'dz-break__pend'));
      } else out.push(li('Instalación', t.instalacion == null ? 'se confirma en la visita' : fmtUSD(t.instalacion), 'dz-break__pend'));
    }
    if (a.install === 'manoObra') out.push(li('Mano de obra de instalación', Number.isFinite(pricing.laborOnly) ? fmtUSD(pricing.laborOnly) : 'se confirma en la visita', 'dz-break__pend'));
    t.pending.filter((p) => p !== 'mano de obra').forEach((p) => out.push(li(p === 'transferencia' ? 'Kit de transferencia' : `Cable adicional (${p.replace('de cable', '').trim()})`, 'se confirma en la visita', 'dz-break__pend')));
    if (o.panels) out.push(li(`Paneles de ${K.panelW} W: ${o.panels.n} sugeridos · se cotizan aparte (no suman)`, '—', 'dz-break__pend'));
    out.push(li(t.total != null && a.install !== 'equipo' ? 'Total estimado (por confirmar)' : 'Total solo equipo', fmtUSD(a.install === 'equipo' || t.total == null ? t.equipo : t.total)));
    $('[data-dz-break]').innerHTML = out.join('');
  }

  function fillOos(a, R) {
    $('[data-dz-reason]').textContent = R.outOfScope.reason;
    const li = (txt) => Object.assign(document.createElement('li'), { textContent: txt });
    $('[data-dz-list]').replaceChildren(...rows.filter((r) => a.items[r.dataset.dzRow]).map((r) => li(`${byId[r.dataset.dzRow].t} ×${a.items[r.dataset.dzRow]}`)), ...a.custom.map((c) => li(`${c.t} ×${c.n}`)));
    $('[data-dz-figs]').innerHTML = `<li><span class="dz-kpi__k">Carga continua</span><b class="dz-kpi__v">≈ ${fmt(R.contW, 0)} W</b></li><li><span class="dz-kpi__k">Arranque</span><b class="dz-kpi__v">≈ ${fmt(R.peakW, 0)} W</b></li><li><span class="dz-kpi__k">Energía</span><b class="dz-kpi__v">≈ ${fmt(R.whResp / 1000)} kWh</b></li>`;
    const ids = R.outOfScope.remove || [], names = ids.map((id) => (/^otro\d+$/.test(id) ? a.custom[+id.slice(4)]?.t : byId[id]?.t)).filter(Boolean).map(lc);
    const btn = $('[data-dz-remove]'), tip = $('[data-dz-tip]');
    const rest = clean({ ...a, items: Object.fromEntries(Object.entries(a.items).filter(([k]) => !ids.includes(k))), custom: a.custom.filter((_, i) => !ids.includes(`otro${i}`)) });
    const ok = names.length > 0 && hasItems(rest) && size(rest).options.length > 0;
    btn.hidden = !names.length; tip.hidden = !ok;
    if (names.length) btn.textContent = `Quitar ${list(names)} y ver opciones`;
    if (ok) tip.textContent = `Si quitas ${list(names)}, el resto sí se puede respaldar con inversor y baterías.`;
  }

  // the whole result, from the form: two size() passes (the first fixes the chosen tier so the URL and the message agree)
  function fill() {
    const a0 = readAnswers(), R0 = size(a0), chosen = R0.chosen;
    const url = buildUrl(a0, chosen);
    const a = clean({ ...a0, tier: chosen, url }), R = size(a), o = R.options.find((x) => x.tier === R.chosen) || null;
    S = { a, R, o };
    const oos = !!R.outOfScope || !o;
    res.classList.toggle('dz-res--oos', oos);
    okBox.hidden = oos; oosBox.hidden = !oos;
    $$('[data-dz-okonly]').forEach((d) => { d.hidden = oos; });
    $('[data-dz-sel]').hidden = oos;
    $('[data-dz-rtitle]').textContent = oos ? 'Tu respaldo' : `Tu respaldo para ${fmt(a.hours, 0)} h`;
    $('[data-dz-rsub]').textContent = oos ? 'Requiere cotización con ingeniero.' : 'Precio referencial en USD. Se confirma en la visita técnica.';
    $('[data-dz-prov]') && ($('[data-dz-prov]').hidden = oos);
    const inst = a.install;
    $('[data-dz-instopts]').hidden = inst === 'equipo';
    $('[data-dz-adjline]').hidden = oos || inst === 'equipo';
    const RI = inst === 'equipo' && !oos ? size({ ...a, install: 'instalado' }) : null;
    let n = 0;
    TIERS.forEach((t) => {
      const opt = R.options.find((x) => x.tier === t), el = tierEl[t];
      el.hidden = !opt || oos;
      if (el.hidden) return;
      n++;
      fillTier(el, opt, a, RI, R);
    });
    tiersBox.style.setProperty('--cols', String(Math.max(n, 1)));
    const note = $('[data-dz-cmpnote]'), miss = [];
    if (!oos && !R.options.some((x) => x.tier === 'basico')) miss.push('Para tu lista no hay una opción más económica que la Recomendada.');
    if (!oos && !R.options.some((x) => x.tier === 'holgado')) miss.push('Para tu lista la Recomendada ya es la opción con más margen.');
    note.textContent = miss.join(' '); note.hidden = !miss.length;
    if (!oos) {
      tierEl[R.chosen].querySelector('input').checked = true;
      fillDetail(o, a, R); fillHints(R.hints); fillCalc(o, a, R); fillBreak(o, a);
    } else fillOos(a, R);
    $('[data-dz-msg]').textContent = R.message;
    $('[data-dz-wa]').href = wa(R.message);
    igTip.hidden = via !== 'ig';
    root.dispatchEvent(new CustomEvent('dz:state', { detail: state() }));
    return url;
  }
  function refresh() {   // any change inside the result: refill everything, keep the URL in sync
    const url = fill();
    writeUrl(url);
  }

  function finish({ immediate = false } = {}) {
    done = true;
    const url = fill();
    writeUrl(url);
    syncTrack(); syncNav();
    grid.dataset.done = '';
    const R = S.R, o = S.o;
    say(R.outOfScope || !o ? 'Esto se dimensiona con un ingeniero. Tu lista ya está en el mensaje.' : `Precio listo. Opción ${o.label.toLowerCase()}: inversor ${fmt(o.inverter.kw)} kW y ${o.batteries.n} batería${o.batteries.n > 1 ? 's' : ''}, ${priceText(o, S.a)}.`);
    card.hidden = true; res.hidden = false;
    if (!immediate) { res.focus({ preventScroll: true }); toCardTop(res); enter(res); }
  }

  function reopen(to = 1) {   // result → back to a step (editar equipos)
    if (!done) return;
    done = false;
    delete grid.dataset.done;
    res.hidden = true; card.hidden = false; resume.hidden = true;
    cur = to;
    setStep(to); sync(); syncTrack();
    if (to === 2) { hourCover(); paintLive(); }
    history.replaceState(history.state, '', location.pathname + (via ? `?via=${via}` : ''));
    focusStep(steps[to]);
    toCardTop();
    enter(card);
  }
  function removeAndEdit() {
    const ids = S.R.outOfScope?.remove || [];
    const raw = customRows.map((r, i) => ({ i, w: parseInt($(`[name="cw${i}"]`, r).value, 10) || 0, n: $(`[name="cn${i}"]`, r).value })).filter((c) => c.w > 0 && c.n !== '0');
    let focusRow = null;
    ids.forEach((id) => {
      if (/^otro\d+$/.test(id)) { const c = raw[+id.slice(4)]; if (c) { $$('input', customRows[c.i]).forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }); focusRow ||= customRows[c.i]; } }
      else if (rowById.has(id)) { setQty(rowById.get(id), 0); focusRow ||= rowById.get(id); }
    });
    reopen(1);
    const g = focusRow?.closest('[data-dz-group]'); if (g) showTab(g.dataset.dzGroup);
    (focusRow && ($('[data-dz-hit]', focusRow) || $('input', focusRow)))?.focus({ preventScroll: true });
    sync();
  }
  function restart() {
    done = false;
    delete grid.dataset.done;
    form.reset();
    rows.forEach((r) => paintRow(r, qtyOf(r)));
    showTab('esencial');
    fromRow.hidden = true; resume.hidden = true;
    cur = 0;
    res.hidden = true; card.hidden = false;
    setStep(0); sync(); syncTrack();
    history.replaceState(history.state, '', location.pathname + (via ? `?via=${via}` : ''));
    focusStep(steps[0]);
    toCardTop();
    enter(card);
    root.dispatchEvent(new CustomEvent('dz:state', { detail: state() }));
  }

  /* ---------- copy ---------- */
  async function copy(kind, btn) {
    const text = kind === 'url' ? S.a.url : S.R.message;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try {   // fallback for webviews (Instagram, old Safari): a temporary textarea
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (e2) { ok = false; }
    }
    if (ok) {
      const s = btn.querySelector('span'), old = s.textContent;
      s.textContent = 'Copiado';
      later(() => { s.textContent = old; }, 1500);
      say(kind === 'url' ? 'Enlace copiado' : 'Mensaje copiado');
    } else {   // last resort: show the text so it can be copied by hand
      msgBox.open = true;
      const p = $('[data-dz-msg]'), r = document.createRange();
      r.selectNodeContents(p); getSelection()?.removeAllRanges(); getSelection()?.addRange(r);
      say('No se pudo copiar solo: el mensaje quedó seleccionado para copiarlo a mano.');
    }
  }

  /* ---------- state for other modules (PDF) ---------- */
  function state() { return { answers: S.a, tier: S.R.chosen, result: S.R, option: S.o, url: S.a.url, done }; }
  root.dzState = state;

  /* ---------- presupuesto en PDF: el módulo (y jsPDF con él) se carga recién al tocar el botón ---------- */
  const pdfBtn = $('[data-dz-pdf-btn]'), pdfLbl = $('[data-dz-pdf-lbl]'), pdfName = $('[data-dz-pdf-name]'), pdfErr = $('[data-dz-pdf-err]');
  const PDF_LBL = pdfLbl.innerHTML;
  $('[data-dz-pdf-ig]').hidden = !/Instagram|FBAN|FBAV/.test(navigator.userAgent);   // su navegador interno suele bloquear las descargas: se avisa antes y se deja intentar igual
  let pdfBusy = false;
  async function downloadPdf() {
    if (pdfBusy || !done || !S.o) return;
    pdfBusy = true; pdfErr.hidden = true;
    pdfBtn.setAttribute('aria-busy', 'true'); pdfLbl.textContent = 'Generando…';
    let ok = false;
    try {
      const { descargarPresupuesto } = await import('./presupuesto-pdf.js');
      const q = await descargarPresupuesto(state(), { cliente: pdfName.value });
      ok = true;
      say(`Presupuesto descargado: Presupuesto-SSDS-${q.numero}.pdf`);
    } catch (e) {
      console.error('Presupuesto PDF', e);
      pdfErr.textContent = 'No se pudo generar el PDF. Revisa tu conexión y vuelve a intentarlo; si sigue fallando, envíanos tu configuración por WhatsApp y te preparamos el presupuesto.';
      pdfErr.hidden = false;
      say('No se pudo generar el PDF');
    }
    pdfBusy = false;
    pdfBtn.removeAttribute('aria-busy');
    if (ok) pdfLbl.textContent = 'Descargado'; else pdfLbl.innerHTML = PDF_LBL;
    if (ok) later(() => { pdfLbl.innerHTML = PDF_LBL; }, 2200);
  }

  /* ---------- resume from ?c= ---------- */
  const setRadio = (name, v) => $$(`input[name="${name}"]`).forEach((i) => { i.checked = v != null && i.value === String(v); });
  function fillForm(st, sp) {
    rows.forEach((r) => setQty(r, st.items[r.dataset.dzRow] || 0));
    customRows.forEach((r, i) => {
      const c = st.custom[i];
      $(`[name="ct${i}"]`, r).value = c ? c.t : ''; $(`[name="cw${i}"]`, r).value = c ? String(c.w) : ''; $(`[name="cn${i}"]`, r).value = c ? String(c.n) : '';
      $(`[name="cm${i}"]`, r).checked = !!c?.m;
    });
    rows.forEach((r) => { const id = r.dataset.dzRow; if ($('[data-dz-ask]', r)) setRadio(`v220-${id}`, id in st.v220 ? (st.v220[id] ? '1' : '0') : null); });
    setRadio('hours', HOURS.reduce((b, h) => (Math.abs(h - st.hours) < Math.abs(b - st.hours) ? h : b), 8));
    setRadio('place', st.place); setRadio('install', st.install); setRadio('transfer', st.transfer); setRadio('city', st.city || null);
    setRadio('preset', st.preset); setRadio('when', sp.get('w')); setRadio('tier', O2T[sp.get('o')] || null);
    $('input[name="hot"]').checked = st.hot; $('input[name="solar"]').checked = st.solar;
    $('[data-dz-extra]').value = String(clamp(st.extraM, 0, 30));
    const p = presets.find((x) => x.id === st.preset);
    if (st.preset) { fromEl.textContent = p ? p.t : 'Desde cero'; fromRow.hidden = false; }
    showTab(firstTab());
  }

  /* ---------- wiring ---------- */
  const onPointer = () => { pointer = true; };
  form.addEventListener('pointerdown', onPointer, { capture: true });
  form.addEventListener('input', onInput);
  form.addEventListener('change', onChange);
  form.addEventListener('submit', onSubmit);
  form.addEventListener('keydown', onKey);
  form.addEventListener('click', onClick);

  // start: ?via=, then ?c= (straight to the result), else restored answers (bfcache / breakpoint re-init) → first unanswered step
  const sp = new URLSearchParams(location.search), v = sp.get('via');
  via = v === 'ig' || v === 'dx' ? v : /Instagram|FBAN|FBAV/.test(navigator.userAgent) ? 'ig' : null;
  const st = sp.get('c') ? decodeState(sp.get('c')) : null;
  if (st && hasItems(st)) {
    fillForm(st, sp);
    sync();
    cur = last;
    setStep(last);
    finish({ immediate: true });
    resume.hidden = false;
  } else {
    const firstOpen = steps.findIndex((_, i) => !answered(i)), prev = parseInt(card.dataset.step, 10) || 0;
    cur = Math.min(clamp(prev, 0, last), firstOpen === -1 ? last : firstOpen);   // same step after a re-init, never past the first unanswered
    rows.forEach((r) => paintRow(r, qtyOf(r)));
    showTab(firstTab());
    setStep(cur); sync(); syncTrack();
    if (cur === last) { hourCover(); paintLive(); }
  }

  return () => {
    timers.forEach((id) => clearTimeout(id));
    cancelAnimationFrame(raf);
    form.removeEventListener('pointerdown', onPointer, { capture: true });
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onChange);
    form.removeEventListener('submit', onSubmit);
    form.removeEventListener('keydown', onKey);
    form.removeEventListener('click', onClick);
    delete root.dzState;
  };
}
