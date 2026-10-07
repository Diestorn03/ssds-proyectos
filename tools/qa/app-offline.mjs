// QA de la app /app/ con Chrome headless (CDP): service worker, modo SIN INTERNET de verdad (se apaga el servidor), flujo completo, PDF, Recientes,
// CLS, táctiles y capturas. Uso (después de `npm run build`):
//   node tools/qa/app-offline.mjs --chrome-port=9611 --web-port=4613 [--w=390 --h=844] [--tag=iphone14] [--no-offline]
// Levanta `astro preview` con dist/ en --web-port, abre /app/, espera el service worker, apaga el servidor y repite todo sin red.
// Capturas: $SHOTS_DIR/app-<tag>/ (por defecto la carpeta temporal). Sale con código 1 si algo falla.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);
const flag = (k, d) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : d; };
const CP = +flag('chrome-port', 9611), WP = +flag('web-port', 4613), W = +flag('w', 390), H = +flag('h', 844), TAG = flag('tag', `${W}x${H}`);
const OUT = `${(process.env.SHOTS_DIR || `${tmpdir()}/ssds-shots`).replaceAll('\\', '/')}/app-${TAG}/`;
mkdirSync(OUT, { recursive: true });
const ORIGIN = `http://127.0.0.1:${WP}`, URL_APP = `${ORIGIN}/app/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [], notes = [];
const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`); if (!ok) fails.push(msg); };

// ---- servidor (astro preview sobre dist/) ----
const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
try { execSync('npx astro preview stop', { cwd: ROOT, stdio: 'ignore' }); } catch { /* no había ninguno */ }   // astro 7 solo deja un servidor de vista previa por proyecto
const web = spawn(`npx astro preview --host 127.0.0.1 --port ${WP}`, { shell: true, stdio: 'ignore', cwd: ROOT });
const killWeb = () => { try { execSync(`taskkill /PID ${web.pid} /T /F`, { stdio: 'ignore' }); } catch { /* ya cerrado */ } };
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${ORIGIN}/app/`)).ok) break; } catch { /* aún no */ } await sleep(250); }

// ---- Chrome ----
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--enable-unsafe-swiftshader', '--hide-scrollbars', `--remote-debugging-port=${CP}`, `--window-size=${W},${H}`, `--user-data-dir=${tmpdir().replaceAll(String.fromCharCode(92), "/")}/ssds-qa-${CP}`, 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(250); try { wsUrl = (await (await fetch(`http://127.0.0.1:${CP}/json`)).json()).find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch { /* aún no */ } }
if (!wsUrl) { console.error('Chrome no arrancó'); killWeb(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const consoleLog = [], failed = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Target.attachedToTarget') { for (const d of ['Runtime.enable', 'Log.enable', 'Network.enable']) ws.send(JSON.stringify({ id: ++id, method: d, sessionId: m.params.sessionId })); }   // consola y red del service worker
  if (m.method === 'Log.entryAdded' && m.params.entry.level !== 'info') consoleLog.push(`LOG ${m.params.entry.text} ${m.params.entry.url || ''}`.slice(0, 300));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') consoleLog.push(`EXCEPTION ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`.slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push(`${m.params.type.toUpperCase()} ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 300));
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) failed.push(`${m.params.errorText} ${m.params.requestId}`);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) failed.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}${name}.png`, Buffer.from(r.data, 'base64')); console.log('     captura', `${OUT}${name}.png`); };
const waitFor = async (expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch { /* la página aún navega */ } await sleep(150); } return false; };
const goto = async (url) => { await send('Page.navigate', { url }); await sleep(300); await waitFor('document.readyState === "complete"', 20000); await sleep(400); };
// toque real (CDP Input): CLS ignora los cambios que siguen a un toque, como en el teléfono; si algo tapa el elemento, click() programático
const click = async (sel) => {
  const pt = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t) || t.contains(e)) ? { x, y } : (e.click(), null); })()`);
  if (pt === null) return ev(`!!document.querySelector(${JSON.stringify(sel)})`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return true;
};

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
if (!flag('no-touch')) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
if (!flag('no-safe')) await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } }).catch(() => {});   // Dynamic Island + barra inferior del iPhone
// Web Share de archivos no existe en Chrome headless: se simula el contrato de iOS (canShare + share con File) y se registra lo compartido
if (!flag('no-init')) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__shares = []; window.__failFirst = false;
  Object.defineProperty(navigator, 'canShare', { value: (d) => !!(d && d.files && d.files.length), configurable: true });
  Object.defineProperty(navigator, 'share', { value: async (d) => {
    if (window.__failFirst) { window.__failFirst = false; throw Object.assign(new Error('gesto vencido'), { name: 'NotAllowedError' }); }
    const f = d.files[0]; const b = new Uint8Array(await f.arrayBuffer());
    window.__lastPdf = (() => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); })();
    window.__shares.push({ name: f.name, size: f.size, type: f.type, head: new TextDecoder().decode(b.slice(0, 5)), });
  }, configurable: true });
  try { window.__cls = 0; window.__clsLog = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsLog.push(e.value.toFixed(5) + ' ' + (e.sources || []).map((x) => x.node && (x.node.className || x.node.nodeName)).join(',')); } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
` });

// ================= 1 · en línea: la página, el service worker y la caché =================
console.log(`\n== ${TAG} (${W}x${H}) · ${URL_APP}`);
await goto(URL_APP);
if (flag('debug')) { for (let i = 0; i < 12; i++) { await sleep(1000); console.log(i, failed.slice(0, 4), await ev('navigator.serviceWorker.getRegistrations().then((r) => r.map((x) => x.scope + " " + (x.active ? "A" : "") + (x.installing ? "I" : "") + (x.waiting ? "W" : "")))')); } console.log('DEBUG', await ev('document.readyState + " " + location.href + " " + document.title'), await ev('navigator.serviceWorker.getRegistrations().then((r) => r.map((x) => x.scope))'), await ev('navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).then((r) => "ok", (e) => "err " + e)'), consoleLog, await ev('document.documentElement.className + " | " + document.querySelector("[data-app-toasts]").innerHTML.length + " | " + document.querySelector("[data-dz-count]").textContent + " | ready=" + (typeof initDimensionador)'), await ev('performance.getEntriesByType("resource").map((r) => r.name.split("/").pop()).join(",")')); }
check(await ev('!!document.querySelector("[data-dz-form]")'), '/app/ carga el cotizador');
check(await ev('document.querySelector("meta[name=viewport]").content.includes("viewport-fit=cover")'), 'viewport-fit=cover');
check(await ev('document.querySelector("meta[name=robots]").content.includes("noindex")'), 'noindex en /app/');
check(await ev('!!document.querySelector("link[rel=manifest]") && !!document.querySelector("link[rel=apple-touch-icon]") && document.querySelector("meta[name=apple-mobile-web-app-capable]").content === "yes"'), 'manifest, apple-touch-icon y metas de iOS');
check(!(await ev('!!document.querySelector("[data-reveal], [data-magnetic], .dz-sum[data-reveal]")')), 'sin data-reveal/magnetic (no hay motor que los muestre)');
check(!(await ev('Array.from(document.scripts).some((s) => /engine|gsap|lenis/i.test(s.src))')), 'no carga el motor de animación del sitio');
check(await waitFor('navigator.serviceWorker.getRegistration("/app/").then((r) => !!(r && r.active))', 20000), 'service worker activo en /app/');
if (consoleLog.length) console.log('  consola:', consoleLog.join(' | '));
const sw = await ev('(async () => { const r = await navigator.serviceWorker.getRegistration("/app/"); return { scope: r.scope, script: r.active.scriptURL, ctrl: !!navigator.serviceWorker.controller }; })()');
check(sw.scope === `${ORIGIN}/app/` && sw.script === `${ORIGIN}/app/sw.js`, `alcance ${sw.scope} · script ${sw.script}`);
await sleep(800);
const swText = await (await fetch(`${ORIGIN}/app/sw.js`)).text();
const precache = JSON.parse(swText.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const ver = swText.match(/const VERSION = '([^']+)'/)[1];
const cached = await ev(`(async () => { const ks = await caches.keys(); const c = await caches.open('ssds-app-${ver}'); return { ks, urls: (await c.keys()).map((r) => new URL(r.url).pathname) }; })()`);
check(cached.ks.length === 1 && cached.ks[0] === `ssds-app-${ver}`, `una sola caché: ${cached.ks.join(', ')}`);
const falta = precache.filter((u) => !cached.urls.includes(u)), sobra = cached.urls.filter((u) => !precache.includes(u));
check(!falta.length && !sobra.length, `caché == lista de precaché (${precache.length} archivos)${falta.length ? ` · faltan ${falta.join(' ')}` : ''}${sobra.length ? ` · sobran ${sobra.join(' ')}` : ''}`);
check(precache.some((u) => /Sora-Bold.*\.ttf$/.test(u)) && precache.some((u) => /jspdf/.test(u)) && precache.some((u) => /equipos\/.*\.jpg$/.test(u)) && precache.includes('/app/') && precache.includes('/app/version.json'), 'la lista incluye fuentes del PDF, jsPDF, fotos .jpg, /app/ y version.json');
check(await ev('(async () => { const r = await fetch("/app/version.json"); return r.ok && (await r.json()).version === ' + JSON.stringify(ver) + '; })()'), 'version.json coincide con la versión del service worker');
await ev('location.reload()'); await sleep(1500); await waitFor('document.readyState === "complete"');
check(await ev('!!navigator.serviceWorker.controller'), 'tras recargar, /app/ está controlada por el service worker');
await shot(`${TAG}-01-paso1`);

// ================= 2 · el sitio público no tiene service worker =================
for (const p of ['/', '/dimensionar/']) {
  await goto(`${ORIGIN}${p}`);
  const r = await ev('(async () => ({ ctrl: !!navigator.serviceWorker.controller, regs: (await navigator.serviceWorker.getRegistrations()).map((x) => x.scope) }))()');
  check(!r.ctrl && r.regs.every((s) => s === `${ORIGIN}/app/`), `${p}: sin controller; registros: ${r.regs.join(', ') || 'ninguno'}`);
}
check(await ev('!!document.querySelector("[data-dz-wa]") && !document.querySelector("[data-dz-wa-client]") && document.querySelector("[data-dz-mode]").dataset.dzMode === "site"'), '/dimensionar/ conserva su WhatsApp a SSD&S (modo site)');

// ================= 3 · SIN INTERNET: se apaga el servidor =================
if (!flag('no-offline')) {
  killWeb(); await sleep(1200);
  let down = false; try { await fetch(`${ORIGIN}/app/`, { signal: AbortSignal.timeout(2000) }); } catch { down = true; }
  check(down, 'servidor apagado: ya no hay red hacia el sitio');
}
failed.length = 0;
await goto(URL_APP);
check(await ev('document.title.includes("Cotizador") && !!document.querySelector("[data-dz-form]")'), 'SIN RED: /app/ carga');
check(await ev('!!navigator.serviceWorker.controller'), 'SIN RED: la sirve el service worker');

// ================= 4 · el flujo completo sin red =================
const presetId = await ev('document.querySelector("input[name=preset][value=completa]") ? "completa" : document.querySelector("input[name=preset]").value');
await click(`input[name=preset][value="${presetId}"]`); await sleep(500);
await shot(`${TAG}-02-preset`);
await sleep(700);   // tocar un punto de partida avanza solo al paso 2 (como en el sitio)
check(await ev('document.querySelector("[data-dz-count]").textContent === "2"'), 'paso 2 (equipos)');
await shot(`${TAG}-03-equipos`);
await click('[data-dz-next]'); await sleep(600);
check(await ev('document.querySelector("[data-dz-count]").textContent === "3"'), 'paso 3 (horas)');
await click('input[name=hours][value="8"]'); await click('input[name=place][value="casa"]'); await sleep(300);
await shot(`${TAG}-04-horas`);
await click('[data-dz-next]'); await sleep(900);
check(await ev('!document.querySelector("[data-dz-res]").hidden'), 'resultado visible');
check(await ev('!!document.querySelector("[data-dz-pdf-name]") && document.querySelector("[data-dz-pdf-name]").offsetParent !== null'), 'campo «Nombre del cliente» visible en el resultado');
check(await ev('getComputedStyle(document.querySelector("[data-dz-pdf-name]")).fontSize === "16px" && getComputedStyle(document.querySelector("[data-dz-pdf-tel]")).fontSize === "16px"'), 'inputs del cliente a 16 px (iOS no hace zoom)');
await shot(`${TAG}-05-resultado`);
// nombre y teléfono (con tilde y ñ: la prueba del PDF)
await ev(`(() => { const n = document.querySelector('[data-dz-pdf-name]'), t = document.querySelector('[data-dz-pdf-tel]'); n.value = 'María Núñez'; n.dispatchEvent(new Event('input', { bubbles: true })); t.value = '0412-1234567'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
check(await waitFor('document.querySelector("[data-dz-pdf-lbl]").textContent === "Compartir PDF"', 20000), 'el PDF se prepara solo y el botón dice «Compartir PDF»');
const wa = await ev('document.querySelector("[data-dz-wa-client]").href');
check(wa.startsWith('https://wa.me/584121234567?text=') && decodeURIComponent(wa).includes('María Núñez') && /US\$/.test(decodeURIComponent(wa)), `WhatsApp al cliente: ${wa.slice(0, 70)}…`);
await ev(`(() => { const t = document.querySelector('[data-dz-pdf-tel]'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(100);
check((await ev('document.querySelector("[data-dz-wa-client]").href')).startsWith('https://wa.me/?text='), 'sin teléfono: https://wa.me/?text=');
await ev(`(() => { const t = document.querySelector('[data-dz-pdf-tel]'); t.value = '0412-1234567'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await waitFor('document.querySelector("[data-dz-pdf-lbl]").textContent === "Compartir PDF"', 20000);
// compartir: el File ya está listo, navigator.share se llama dentro del toque
await ev('window.__failFirst = true');
await click('[data-dz-pdf-btn]'); await sleep(500);
check(await ev('document.querySelector("[data-dz-pdf-lbl]").textContent') === 'Compartir de nuevo', 'gesto vencido (NotAllowedError): el botón pasa a «Compartir de nuevo»');
await click('[data-dz-pdf-btn]'); await waitFor('window.__shares.length > 0', 8000);
const sh = await ev('window.__shares[0]');
check(sh && sh.head === '%PDF-' && sh.size > 20000 && sh.type === 'application/pdf', `SIN RED: PDF compartido ${sh?.name} · ${sh?.size} bytes · ${sh?.head}`);
check(sh && /^Presupuesto-SSDS-P-\d{6}-[0-9A-Z]{4}-Maria-Nunez\.pdf$/.test(sh.name), `nombre de archivo sin acentos: ${sh?.name}`);
check(!consoleLog.some((l) => /sin fuentes de marca/.test(l)), 'el PDF lleva las fuentes de marca (sin red)');
// el PDF compartido se guarda para revisarlo a ojo
const pdf64 = await ev('window.__lastPdf');
if (pdf64) writeFileSync(`${OUT}${sh.name}`, Buffer.from(pdf64, 'base64'));
await shot(`${TAG}-06-resultado-final`);
await ev('document.querySelector("[data-dz-pdf-name]").scrollIntoView({ block: "center" })'); await sleep(300);
await shot(`${TAG}-07-cliente`);

// ================= 5 · Recientes, sin red =================
const rec1 = await ev('JSON.parse(localStorage.getItem("ssds-app-recientes") || "[]")');
check(rec1.length === 1 && rec1[0].cliente === 'María Núñez' && rec1[0].tel === '0412-1234567' && rec1[0].total > 0, `un reciente guardado: ${JSON.stringify(rec1[0] || {}).slice(0, 120)}`);
await goto(URL_APP);   // recarga sin ?c= : vuelve al paso 1, con la lista
check(await ev('document.querySelectorAll("[data-dz-recent]").length === 1'), 'SIN RED: «Recientes» lista el presupuesto tras reabrir la app');
await ev('document.querySelector("[data-dz-recents]").scrollIntoView({ block: "center" })'); await sleep(300);
await shot(`${TAG}-08-recientes`);
await click('[data-dz-recent]'); await sleep(900);
check(await ev('!document.querySelector("[data-dz-res]").hidden && document.querySelector("[data-dz-pdf-name]").value === "María Núñez" && document.querySelector("[data-dz-pdf-tel]").value === "0412-1234567"'), 'tocar un reciente reabre la configuración con nombre y teléfono');
check(await waitFor('document.querySelector("[data-dz-pdf-lbl]").textContent === "Compartir PDF"', 20000), 'el reciente vuelve a dejar el PDF listo');
check((await ev('JSON.parse(localStorage.getItem("ssds-app-recientes")).length')) === 1, 'reabrir no duplica el reciente');
// recarga en el resultado (?c=): la app recuperada por iOS conserva nombre y teléfono
const urlNow = await ev('location.href');
await goto(urlNow);
check(await ev('!document.querySelector("[data-dz-res]").hidden && document.querySelector("[data-dz-pdf-name]").value === "María Núñez"'), 'SIN RED: recargar /app/?c=… vuelve al resultado con el nombre');
// otro presupuesto + borrar uno (dos toques)
await click('[data-dz-restart]'); await sleep(500);
check(await ev('document.querySelector("[data-dz-pdf-name]").value === ""'), 'Nuevo presupuesto limpia el nombre');
await click('input[name=preset][value="esencial"]'); await sleep(900); await click('[data-dz-next]'); await sleep(500); await click('[data-dz-next]'); await sleep(900);
check((await ev('JSON.parse(localStorage.getItem("ssds-app-recientes")).length')) === 1, 'un presupuesto sin nombre ni teléfono no entra en Recientes');
await ev(`(() => { const n = document.querySelector('[data-dz-pdf-name]'); n.value = 'Pedro Prueba'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(1300);
check((await ev('JSON.parse(localStorage.getItem("ssds-app-recientes")).length')) === 2, 'segundo presupuesto: 2 recientes');
await click('[data-dz-restart]'); await sleep(500);
await click('[data-dz-recent-del]'); await sleep(200);
check((await ev('document.querySelector("[data-dz-recent-del]").textContent')) === '¿Seguro?', 'borrar pide confirmación en la propia fila');
await click('[data-dz-recent-del]'); await sleep(300);
check((await ev('document.querySelectorAll("[data-dz-recent]").length')) === 1, 'segundo toque borra un reciente');
check(!failed.length, `SIN RED: cero peticiones fallidas (${failed.length}${failed.length ? ': ' + failed.slice(0, 3).join(' | ') : ''})`);

// ================= 6 · CLS y táctiles =================
check((await ev('window.__cls')) < 0.001, `CLS = ${Number(await ev('window.__cls')).toFixed(4)} en la sesión ${JSON.stringify(await ev('window.__clsLog'))}`);
await goto(URL_APP); await sleep(500);
const targets = async () => ev(`(() => { const out = []; document.querySelectorAll('button, a[href], input:not([type=hidden]), summary, [role=tab]').forEach((e) => {
  if (e.closest('[hidden], [inert]') || e.closest('.sr-only, .skip-link') || getComputedStyle(e).visibility === 'hidden') return;
  const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
  let w = r.width, h = r.height; const l = e.closest('label'); if (l && e.matches('input')) { const q = l.getBoundingClientRect(); w = Math.max(w, q.width); h = Math.max(h, q.height); }
  const ps = getComputedStyle(e, '::after'); if (ps.content !== 'none' && ps.position === 'absolute') { w += 8; h += 8; }
  if (w < 43.5 || h < 43.5) out.push((e.dataset && Object.keys(e.dataset)[0] || e.className || e.tagName) + ' ' + Math.round(w) + 'x' + Math.round(h)); }); return out; })()`);
const small1 = await targets();
check(!small1.length, `táctiles ≥ 44 px en el paso 1${small1.length ? ': ' + small1.join(', ') : ''}`);
await click('input[name=preset][value="completa"]'); await sleep(900);
const small2 = await targets();
check(!small2.length, `táctiles ≥ 44 px en el paso 2${small2.length ? ': ' + small2.join(', ') : ''}`);
await click('[data-dz-next]'); await sleep(400); await click('[data-dz-next]'); await sleep(900);
await ev('window.scrollTo(0, 0)'); await sleep(200);
const small3 = await targets();
check(!small3.length, `táctiles ≥ 44 px en el resultado${small3.length ? ': ' + small3.join(', ') : ''}`);
await ev('window.scrollTo(0, document.body.scrollHeight)'); await sleep(300);
await shot(`${TAG}-09-resultado-fondo`);
check((await ev('window.__cls')) < 0.001, `CLS = ${Number(await ev('window.__cls')).toFixed(4)} tras recargar y recorrer ${JSON.stringify(await ev('window.__clsLog'))}`);
const ov = await ev('document.documentElement.scrollWidth <= innerWidth + 1');
check(ov, 'sin desborde horizontal');

console.log('\nConsola:', consoleLog.length ? consoleLog.slice(0, 8).join('\n  ') : 'sin errores');
writeFileSync(`${OUT}resultado.json`, JSON.stringify({ tag: TAG, fails, consoleLog }, null, 2));
chrome.kill(); killWeb();
console.log(fails.length ? `\n${fails.length} FALLA(S)` : '\nTODO OK');
process.exit(fails.length ? 1 : 0);
