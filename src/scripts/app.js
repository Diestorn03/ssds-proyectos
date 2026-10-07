// Arranque de la app del dueño (/app/): el cotizador (src/scripts/dimensionar.js, modo app) sin el motor de animación del sitio, más lo propio de una PWA:
// service worker (SOLO aquí: el sitio público no registra nada), aviso de versión nueva, aviso de «lista sin internet», guía de instalación en iPhone
// e indicador de conexión. El service worker vive en /app/sw.js con alcance /app/ (lo escribe tools/app-pwa.mjs en el build).
import { initDimensionador } from './dimensionar.js';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const $ = (s) => document.querySelector(s);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

/* ---------- el cotizador, sin engine.js: el mismo contrato { env, scrollTo } ---------- */
const mq = (q) => matchMedia(q).matches;
document.documentElement.classList.add('fx-booted');
initDimensionador({
  env: { reduced: mq('(prefers-reduced-motion: reduce)'), get coarse() { return mq('(pointer: coarse)'); } },
  scrollTo: (y, o = {}) => window.scrollTo({ top: typeof y === 'number' ? y : 0, behavior: o.immediate || mq('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth' }),
});

/* ---------- avisos fijos arriba (no mueven el contenido) ---------- */
const box = $('[data-app-toasts]');
const cola = [];   // un solo aviso a la vez: los demás esperan a que se cierre el actual
const quitar = (el) => { el.remove(); if (!box.children.length && cola.length) toast(...cola.shift()); };
function toast(id, text, actions = [], ms = 0) {
  box.querySelector(`[data-toast="${id}"]`)?.remove();
  if (box.children.length) { cola.push([id, text, actions, ms]); return; }
  const el = Object.assign(document.createElement('div'), { className: 'app-toast' });
  el.dataset.toast = id;
  el.append(Object.assign(document.createElement('p'), { textContent: text }));
  actions.forEach(([label, run, primary]) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: `btn ${primary ? 'btn--primary' : 'btn--text'}`, textContent: label });
    b.addEventListener('click', () => { quitar(el); run?.(); });
    el.append(b);
  });
  box.append(el);
  if (ms) setTimeout(() => quitar(el), ms);
}

/* ---------- conexión ---------- */
const net = $('[data-app-net]');
const paintNet = () => { net.hidden = navigator.onLine; };
addEventListener('online', paintNet); addEventListener('offline', paintNet); paintNet();

/* ---------- instalar en el iPhone (iOS no tiene botón de instalar: se explica el camino) ---------- */
const standalone = navigator.standalone === true || mq('(display-mode: standalone)');
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (ios && !standalone && !store.get('ssds-app-tip')) {
  const dentro = /Instagram|FBAN|FBAV|WhatsApp|Line\//.test(navigator.userAgent);
  toast('install', dentro ? 'Para instalarla, abre esta página en Safari: toca ⋯ y elige Abrir en el navegador.' : 'Para tenerla en tu pantalla de inicio: toca Compartir y elige Añadir a pantalla de inicio. Ábrela una vez con internet.', [['Entendido', () => store.set('ssds-app-tip', '1'), true]]);
}

/* ---------- service worker ---------- */
async function servicio() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;   // en desarrollo no hay /app/sw.js
  const sw = navigator.serviceWorker;
  let reg, pidio = false;
  version(!!sw.controller);   // sin controlador aún no funciona sin internet: el pie lo dice hasta que el service worker esté listo
  try { reg = await sw.register(`${BASE}/app/sw.js`, { scope: `${BASE}/app/` }); } catch (e) { console.warn('Service worker', e); return; }

  // versión nueva: no se cambia a mitad de un presupuesto; queda en espera hasta que David toque «Actualizar»
  const ofrecer = () => {
    if (!reg.waiting || !sw.controller) return;
    toast('update', 'Hay una versión nueva del cotizador. Al actualizar se reinicia la pantalla.', [['Actualizar', () => { pidio = true; reg.waiting?.postMessage('SKIP_WAITING'); }, true]]);
  };
  ofrecer();
  const vigilar = (w) => {   // si el precaché falla (corte de red, poco espacio) el service worker queda «redundant» sin llegar a instalarse: se avisa
    if (!w) return;
    let llego = false;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') { llego = true; ofrecer(); }
      else if (w.state === 'redundant' && !llego) {
        toast('fail', sw.controller ? 'No se pudo bajar la versión nueva. Sigues con la anterior.' : 'No se pudo preparar para usar sin internet. Ábrela con buena señal e inténtalo de nuevo.', [['Reintentar', () => reg.update().catch(() => {}), true]]);
      }
    });
  };
  vigilar(reg.installing);
  reg.addEventListener('updatefound', () => vigilar(reg.installing));
  let recargando = false;
  sw.addEventListener('controllerchange', () => { if (!pidio || recargando) return; recargando = true; location.reload(); });   // solo tras tocar «Actualizar»: la primera instalación toma el control sin recargar

  const revisar = () => { if (navigator.onLine) reg.update().catch(() => {}); };   // iOS casi no revisa solo: al abrir y al volver a primer plano
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
  revisar();

  const lista = await sw.ready;
  if (navigator.onLine) lista.active?.postMessage('VERIFY');   // si iOS borró algo de la caché, se vuelve a bajar mientras hay red
  if (!store.get('ssds-app-ready')) {
    store.set('ssds-app-ready', '1');
    toast('ready', 'Listo: el cotizador ya funciona sin internet.', [['Entendido', null, true]], 12000);
  }
  version(true);
}

/* ---------- versión visible: con qué precios se está cotizando ---------- */
let verN = 0;
async function version(offline = false) {
  const n = ++verN;   // si hay dos llamadas en vuelo, solo escribe la última
  try {
    const v = await (await fetch(`${BASE}/app/version.json`)).json();
    if (n !== verN) return;
    const f = new Date(`${v.fecha}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
    $('[data-app-ver]').textContent = `${offline ? 'Funciona sin internet' : 'Aún no funciona sin internet'} · Versión ${v.version} · ${f}`;
  } catch { /* sin versión: no se muestra nada */ }
}

if (document.readyState === 'complete') servicio(); else addEventListener('load', servicio);
