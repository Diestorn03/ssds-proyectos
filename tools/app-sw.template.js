// Service worker de la app del dueño (/app/). NO se publica tal cual: tools/app-pwa.mjs lo copia a dist/app/sw.js cambiando las 3 constantes de abajo.
// Vive en /app/ y su alcance es /app/: no puede controlar el sitio público (ni / ni /dimensionar/). Solo atiende lo que está en la lista PRECACHE;
// cualquier otra petición (WhatsApp, enlaces, analítica) pasa sin tocarse.
const VERSION = '__VERSION__';
const HOME = '__HOME__';            // '/app/' con el prefijo de PAGES_BASE: la URL canónica con barra (nunca '/app' ni '/app/index.html': un 308 rompe la navegación en Safari)
const PRECACHE = __PRECACHE__;      // rutas absolutas: la página, JS/CSS con hash, fuentes, fotos de equipos, íconos, manifest, version.json

const CACHE = `ssds-app-${VERSION}`;
const LISTA = new Set(PRECACHE);

// Una respuesta con redirected = true hace que Safari muestre una página en blanco: nunca se guarda ni se sirve así.
async function traer(url) {
  const r = await fetch(new Request(url, { cache: 'reload' }));   // 'reload': ni la caché HTTP ni un proxy dejan una copia vieja dentro de la versión nueva
  if (!r.ok || r.redirected) throw new Error(`precache ${url}: ${r.status}${r.redirected ? ' (redirigida)' : ''}`);
  return r;
}

self.addEventListener('install', (e) => {
  // todo o nada: si algo falla, esta versión no se instala y la anterior (si hay) sigue sirviendo. NO hay skipWaiting automático:
  // la página avisa «Hay una versión nueva» y pide SKIP_WAITING, para no cambiar los precios a mitad de un presupuesto.
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (u) => c.put(u, await traer(u))));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ssds-app-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();   // solo toma /app/: es su alcance. Así la primera visita ya queda lista sin internet.
  })());
});

// iOS puede vaciar la caché si falta espacio: al abrir la app con red, lo que falte se vuelve a bajar.
async function reparar() {
  const c = await caches.open(CACHE);
  for (const u of PRECACHE) if (!(await c.match(u))) { try { await c.put(u, await traer(u)); } catch { /* sin red: otra vez en la próxima apertura */ } }
}

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  else if (e.data === 'VERIFY') e.waitUntil(reparar());
});

const delCache = (u) => caches.open(CACHE).then((c) => c.match(u, { ignoreVary: true }));   // solo la caché de ESTA versión: nunca mezcla archivos de dos versiones

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // la página: siempre la entrada canónica (con ?c=…, ?via=… o #hash también); sin ella en caché, la red
  if (req.mode === 'navigate') {
    if (url.pathname !== HOME) return;
    e.respondWith(delCache(HOME).then((r) => r || fetch(req)));
    return;
  }
  if (!LISTA.has(url.pathname)) return;
  e.respondWith(delCache(url.pathname).then((r) => r || fetch(req)));
});
