// Post-build de la app /app/ (se corre después de `astro build`: npm run build). Sin dependencias: solo node:fs, node:crypto y node:path.
// Escribe en dist/app/: sw.js (service worker con la lista de precaché y la versión), manifest.webmanifest y version.json.
// La lista de precaché sale de lo que /app/ realmente carga: el HTML, sus JS/CSS con hash (y los que esos importan, también los import() dinámicos:
// jsPDF viene en trozos), las fuentes, las rutas /_astro/… que el código guarda como texto (las 4 TTF del PDF) y las fotos de public/equipos.
// Falla el build (exit 1) si algo de la lista no existe, y la versión es un hash del contenido: sw.js solo cambia cuando cambia algo de la app.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const base = (process.env.PAGES_BASE || '').replace(/\/+$/, '');   // '' o '/<repo>' (GitHub Pages de proyecto)
const HOME = `${base}/app/`;
const fail = (m) => { console.error(`app-pwa: ${m}`); process.exit(1); };

if (!existsSync(join(DIST, 'app', 'index.html'))) fail('no existe dist/app/index.html: corre `astro build` primero.');
const abs = (p) => join(DIST, p.slice(base.length).replace(/^\//, ''));   // '/_astro/x.js' → dist/_astro/x.js
const exists = (p) => existsSync(abs(p)) && statSync(abs(p)).isFile();

const lista = new Set([HOME]);
const pendientes = [];
const EXT = '(?:js|mjs|css|woff2|woff|ttf|webp|jpg|jpeg|png|svg|json|webmanifest|ico)';
const RUTA = new RegExp(`(?<![\\w/.-])((?:${base.replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&')})?/(?:_astro|equipos|app/icons)/[A-Za-z0-9_.@%-]+\\.${EXT})(?![\\w.-])`, 'g');
const REL = /(?:from|import)\s*\(?\s*["'`](\.\/[A-Za-z0-9_.@%-]+\.(?:js|mjs|css))["'`]/g;   // import … from "./x.js" · import(`./x.js`) · import "./x.js"
const DEPS = /["']((?:_astro)\/[A-Za-z0-9_.@%-]+\.(?:js|mjs|css))["']/g;                                   // lista de precarga de Vite: "_astro/x.js"

// solo los subconjuntos latin y latin-ext de las fuentes: cirílico, griego y vietnamita no se piden nunca en español (ahorra ~1 MB)
const fuenteInutil = (p) => /\.woff2?$/.test(p) && !/-latin(?:-ext)?-/.test(p);
function agrega(p) {
  if (fuenteInutil(p) || lista.has(p)) return;
  lista.add(p); pendientes.push(p);
}
function lee(p) {
  if (!exists(p)) fail(`la lista pide ${p} y no existe en dist/.`);
  const t = readFileSync(abs(p), 'utf8');
  for (const m of t.matchAll(RUTA)) agrega(m[1].startsWith(base) ? m[1] : base + m[1]);
  if (/\.(js|mjs)$/.test(p)) {
    for (const m of t.matchAll(REL)) agrega(posix.join(posix.dirname(p), m[1]));
    for (const m of t.matchAll(DEPS)) agrega(`${base}/${m[1]}`);
  }
}

// 1 · la página y todo lo que arrastra
const html = readFileSync(join(DIST, 'app', 'index.html'), 'utf8');
for (const m of html.matchAll(RUTA)) agrega(m[1].startsWith(base) ? m[1] : base + m[1]);
for (const m of html.matchAll(/(?:href|src)="([^"#?]+)"/g)) if (m[1].startsWith(`${base}/`) && !m[1].startsWith(HOME) && !m[1].startsWith(`${base}/_astro/`) && !m[1].startsWith(`${base}/app/icons/`)) agrega(m[1]);   // favicon.svg y similares
agrega(`${base}/app/manifest.webmanifest`);
agrega(`${base}/app/version.json`);
lista.add(`${base}/app/manifest.webmanifest`); lista.add(`${base}/app/version.json`);
while (pendientes.length) {
  const p = pendientes.pop();
  if (/\.(js|mjs|css)$/.test(p)) lee(p);
}

// 2 · las fotos de los equipos (el PDF pide .jpg y la pantalla .webp) y los íconos de la app
const lsDir = (d, re) => (existsSync(join(DIST, d)) ? readdirSync(join(DIST, d)).filter((f) => re.test(f)).sort().map((f) => `${base}/${d}/${f}`) : []);
for (const p of [...lsDir('equipos', /\.(jpg|webp)$/), ...lsDir('app/icons', /\.png$/)]) lista.add(p);

// 3 · manifest (se escribe antes de hashear: es parte de la app) y comprobación de que todo existe
const manifest = {
  id: HOME, name: 'SSD&S Cotizador', short_name: 'Cotizador', description: 'Cotizador de respaldo con inversor y baterías de SSD&S C.A.', lang: 'es', dir: 'ltr',
  start_url: HOME, scope: HOME, display: 'standalone', orientation: 'portrait', background_color: '#0b1a3a', theme_color: '#0b1a3a',
  icons: [
    { src: `${base}/app/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/app/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}/app/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(DIST, 'app', 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const i of manifest.icons) if (!exists(i.src)) fail(`falta ${i.src}: corre \`npm run icons\` y versiona public/app/icons.`);

const hashable = [...lista].filter((p) => p !== `${base}/app/version.json`).sort();
const sha = createHash('sha256');
let total = 0;
for (const p of [...lista].sort()) {
  if (p === HOME) continue;
  if (!exists(p) && p !== `${base}/app/version.json`) fail(`falta ${p} en dist/.`);
}
for (const p of hashable) {
  const f = p === HOME ? join(DIST, 'app', 'index.html') : abs(p);
  const b = readFileSync(f);
  sha.update(p).update(b); total += b.length;
}
const version = sha.digest('hex').slice(0, 10);
const hoy = new Date(), fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;   // fecha local de quien compila
writeFileSync(join(DIST, 'app', 'version.json'), `${JSON.stringify({ version, fecha })}\n`);
total += readFileSync(join(DIST, 'app', 'version.json')).length;

// 4 · el service worker: la plantilla con la versión, la página y la lista (ordenada: mismo contenido, mismos bytes)
const precache = [...lista].sort();
const sw = readFileSync(new URL('./app-sw.template.js', import.meta.url), 'utf8')
  .replace('__VERSION__', version).replace('__HOME__', HOME).replace('__PRECACHE__', JSON.stringify(precache, null, 2));
if (/__[A-Z]+__/.test(sw.replace(/'__VERSION__'/g, ''))) fail('quedó un marcador sin reemplazar en sw.js.');
writeFileSync(join(DIST, 'app', 'sw.js'), sw);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`app-pwa: versión ${version} · ${precache.length} archivos · ${kb(total)} en precaché${total > 3 * 1024 * 1024 ? ' (¡pasa de 3 MB!)' : ''}`);
if (total > 6 * 1024 * 1024) fail('el precaché pasa de 6 MB: algo se coló en la lista.');
