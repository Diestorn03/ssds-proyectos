export const meta = {
  name: 'ssds-deep-audit',
  description: 'Deep audit of the SSD&S site: 10 auditors → 9 fixers → 9 independent verifiers → whole-site regression pass',
  phases: [
    { title: 'Audit', detail: '9 area auditors + 1 cross-cutting auditor (responsive, motion, perf, a11y, SEO, function)' },
    { title: 'Fix', detail: 'one fixer per area applies its findings (incl. the ones routed from the cross-cutting audit)' },
    { title: 'Verify', detail: 'independent verifier per area re-measures, fixes small leftovers, reports' },
    { title: 'Regression', detail: 'final whole-site pass after all fixes' },
  ],
}

const ROOT = 'C:/Users/diegoa.cardozo/Desktop/ssds-proyectos'
const SH = ROOT + '/tools/qa' // QA tools live in the repo; outputs go to %TEMP%/ssds-shots (or SHOTS_DIR)
const CLS = `js:(async()=>{ let T=0; const S={}; new PerformanceObserver(l=>{for(const e of l.getEntries()){ T+=e.value; for(const s of e.sources||[]){ const k=String(s.node?.className?.baseVal ?? s.node?.className ?? '?').split(' ')[0]; S[k]=(S[k]||0)+e.value; } }}).observe({type:'layout-shift',buffered:false}); const h=document.documentElement.scrollHeight; const f=()=>new Promise(r=>requestAnimationFrame(r)); for(let y=0;y<h;y+=60){ scrollTo(0,y); await f(); await f(); } await new Promise(r=>setTimeout(r,500)); return 'CLS '+T.toFixed(3)+' '+JSON.stringify(S); })()`

const COMMON = `
Project: SSD&S C.A. website (Venezuelan electrical engineering company), ${ROOT}. Astro 7 + GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG, MotionPath) + Lenis. Spanish copy. Use absolute paths.
Read first: ${ROOT}/docs/CONCEPTO.md (experience concept, gates, scene contracts), ${ROOT}/docs/BRIEF.md (the ONLY source of facts — never invent numbers, years, clients, certifications; simulated numbers need a visible "Simulación ilustrativa"), ${ROOT}/src/scripts/engine.js (onPage, env.desktop / env.reduced / env.lite gates, markLite, data-* helpers), ${ROOT}/src/styles/base.css (tokens, data-theme="dark|light").
The user's goal: the site must be "completamente funcional, optimizado y hermosamente fluido" on every device and every computer (incl. modest laptops), fully responsive 320→2560, with the premium motion kept (do not strip effects to gain fps unless there is no smarter technique; prefer better technique).

Environment (shared by several agents working at the same time on DIFFERENT files):
- Dev server with HMR: http://127.0.0.1:4321/ (base "/"). Do NOT start another server, do NOT run "npm run build" or "astro build" (dist/ is shared), do NOT run git, do NOT npm install.
- Screenshots / console errors: node ${SH}/shoot.mjs --port=<YOUR PORT> <desktop|mobile> <url> [targets...] [--w=W --h=H] [--reduced] [--lite] [--wait=ms]
  targets: "#id" (top), "#id!" (bottom aligned), "#id@6" (6 frames across a pinned scene's whole scroll range), "js:<expr>" (run JS, prints result). Prints PNG paths + console errors. Look at PNGs with the Read tool. "mobile" = touch + mobile UA (390x844 default). Chrome uses this machine's real GPU (integrated AMD Radeon) — a good "modest laptop" reference.
- Frame cost of one section while scrolling: node ${SH}/perf-section.mjs <port> <url> <selector> [--w=1366 --h=768 --cpu=4] → fps, worst frame, ms spent in FunctionCall/UpdateLayoutTree/Layout/Paint/Layerize, top painted nodes, top JS. Numbers are noisy (other agents run too): measure 2–3 times, compare before/after on the dev server.
- Layout-shift check (must stay 0.000 on every page): node ${SH}/shoot.mjs --port=<P> desktop --w=1366 --h=768 <url> "${CLS}"
- Batch responsive audit (overflow, tap targets <40px, text <12px, stuck reveals, broken images, LCP/CLS, fps, console errors) over viewports tiny-320, android-360, iphone-se, iphone-14, iphone-pro-max, tablet-768, ipad-pro-1024, laptop-1280, laptop-1366, desktop-1536, desktop-1920, ultrawide-2560:
  MSYS_NO_PATHCONV=1 node ${SH}/audit.mjs http://127.0.0.1:4321 <out.json> --port=<P> --vp=<names,comma> <page paths...>   (LCP there is inflated by its scroll-through; judge LCP with a plain load)
- In Git Bash, prefix commands that pass "/paths" with MSYS_NO_PATHCONV=1.
Performance rules: animate transform/opacity/clip-path/stroke-dashoffset only; never write CSS custom properties on a big container every frame (whole-subtree style recalc) — write on leaves; limit composited layers (will-change only while moving); no filter/box-shadow/backdrop-filter animation on large areas; canvas DPR caps; pause loops off screen / hidden tab; no layout reads in scroll handlers (measure in onRefresh); pinned scenes must keep CLS 0 — the Tablero (pin: true + pinType:'transform') and Recorrido (pin on .rc__stage + pinType:'transform') were just fixed that way: keep it (pinning the centered .tb__stage broke its centering). Target on this machine at 1366x768: ~60 fps in every section, no frame > 50 ms after the first second, main thread < 10 ms per frame.
Responsive/a11y rules: no horizontal overflow, headings fit at 320px, tap targets ≥ 44px on touch, text ≥ 12px, visible focus, keyboard reachable, aria-live where results change, reduced motion = static readable final state, touch/narrow = no pins, lite = no WebGL.
`

const TRACKS = [
  { key: 'hero', files: 'src/components/home/Hero.astro, src/scripts/hero/*', pages: '/', port: 0,
    base: 'Measured: scrolling through the hero pin at 1366x768 = 39 fps, worst frame ~200 ms (Layerize ~2.6 ms/frame: the 3-column 3D Instagram wall has many composited layers + mask-image; FunctionCall ~3.6 ms/frame). LCP after intro fix = 1.6 s desktop / 1.2 s mobile (keep the split un-reverted). At 320px the touch lens ring was still sitting over "Energía confiable" in a screenshot taken 4.5 s after load. Thumbnails in the wall load 640px images shown at ~180px: 320px variants now exist at public/ig/<code>-320.webp (use srcset/sizes).' },
  { key: 'tablero', files: 'src/components/home/Tablero.astro, src/scripts/tablero.js', pages: '/ and /servicios/ (mode="static")', port: 1,
    base: 'Measured: 48 fps, worst 158 ms through the pin (transform pin). FunctionCall ~4 ms/frame, UpdateLayoutTree ~2 ms, Layerize ~1.7 ms. Timeline is pre-warmed (tl.progress(1,true).progress(0,true)) — keep. CLS now 0 and title aligned at x=40 — keep.' },
  { key: 'transferencia', files: 'src/components/home/Transferencia.astro, src/scripts/transferencia.js', pages: '/ and /servicios/respaldo-energetico/ (mode="static")', port: 2,
    base: 'Measured: 55–59 fps, worst 30–117 ms; UpdateLayoutTree ~2.6 ms/frame, Layout ~1 ms/frame (layout during scrub is suspicious), Layerize ~2.2 ms. Pre-warmed timeline — keep.' },
  { key: 'diagnostico', files: 'src/components/home/Diagnostico.astro, src/scripts/diagnostico.js, src/data/diagnostico.js, src/data/diagnostico.check.mjs, src/pages/diagnostico.astro', pages: '/ and /diagnostico/', port: 3,
    base: 'Measured: 44 fps worst 172 ms while scrolling past it. Functionally untested by an independent reviewer: test every path of the 4-step flow (keyboard only too), Back/Next, restart, the WhatsApp href text, aria-live, the gauge. node src/data/diagnostico.check.mjs must pass.' },
  { key: 'cobertura', files: 'src/components/home/Cobertura.astro, src/scripts/cobertura.js, src/data/venezuela.js, tools/venezuela-map.mjs', pages: '/', port: 4,
    base: 'Measured: 49–53 fps, worst 88–121 ms; Layout ~1.4 ms/frame and Paint ~1.8 ms/frame during the scrub (svg.cob__fx and .cob__stage repaint every frame) — find why (filters on SVG? animated attributes causing layout?).' },
  { key: 'recorrido-valores', files: 'src/components/home/Recorrido.astro, src/scripts/recorrido.js, src/components/home/Valores.astro', pages: '/', port: 5,
    base: 'Measured: Recorrido 57–59 fps, Valores 60 fps. Recorrido CLS fixed with pinType transform — keep. Check the horizontal track on 1280x720 / 2560x1440, touch swipe row, reduced grid; Valores stack cards and POTENCIA fill on all gates.' },
  { key: 'instagram', files: 'src/components/home/Instagram.astro, src/components/ui/Lightbox.astro, src/scripts/lightbox.js', pages: '/ and /nosotros/ (limit 4)', port: 6,
    base: 'Audit: grid thumbnails load 640px sources shown at 122–284px → use public/ig/<code>-320.webp (now exists) with srcset/sizes; an <img> with no src is in the DOM on / and /nosotros/ (probably the lightbox placeholder) → avoid (set src when opened, or hidden). Test lightbox: open, prev/next, keys, Esc/focus return, swipe, reduced.' },
  { key: 'chrome', files: 'src/layouts/Base.astro, src/components/chrome/*, src/scripts/chrome.js, src/scripts/engine.js, src/styles/base.css, src/styles/transitions.css, src/components/ui/Cta.astro, src/components/ui/Icon.astro, src/pages/index.astro (FAQ block only), src/data/site.js, astro.config.mjs, src/pages/robots.txt.ts, public/ (except public/ig)', pages: 'all pages (header, mobile menu, footer, loader, La Línea, FAB + mobile bar, page transitions, FAQ, CTA)', port: 7,
    base: 'Audit: footer logo tagline 8px and "C.A." ~10px (logo), footer demo note 11.5px; footer/nav links 36px tall, CTA mail link 23px tall on touch; CTA h2 "¿Tu infraestructura eléctrica necesita atención?" — the word "infraestructura" touches the right edge at 320px. Global per-frame JS baseline ~6 ms even in quiet sections (engine + ScrollTrigger + Lenis + marquees + La Línea + header) — look for waste (e.g. per-frame work while nothing moves, marquee ticker running when off screen, La Línea getPointAtLength per frame). Test: loader (first visit per session; sessionStorage key ssds-intro — shoot.mjs pre-sets it, remove it via js: to test), menu dialog (open/close, Esc, focus trap, links), header theme switching over light/dark sections, view transitions between pages, skip link, reduced + lite.' },
  { key: 'interiores', files: 'src/pages/servicios/index.astro, src/pages/servicios/[slug].astro, src/pages/nosotros.astro, src/pages/contacto.astro, src/pages/404.astro, src/components/pages/*', pages: '/servicios/, /servicios/potencia-electrica/, /servicios/respaldo-energetico/, /servicios/climatizacion/, /nosotros/, /contacto/, /no-existe/', port: 8,
    base: 'Audit: no overflow found by the batch audit; layouts never reviewed by eye at every size. Check each page top to bottom at 320, 390, 768, 1280x720, 1920, 2560, reduced; the contact form (validation, WhatsApp/mail composition) on touch and keyboard; 404 breaker.' },
]
const XCUT = { key: 'cross', port: 9 }

const FINDINGS = {
  type: 'object',
  properties: {
    track: { type: 'string' },
    summary: { type: 'string' },
    metrics: { type: 'string', description: 'measured numbers (fps/worst frame/CLS/LCP/overflow) with viewport' },
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      area: { type: 'string', description: 'function | responsive | motion | perf | a11y | seo | visual | copy' },
      owner: { type: 'string', description: 'track key that owns the file to change: hero|tablero|transferencia|diagnostico|cobertura|recorrido-valores|instagram|chrome|interiores' },
      where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' }, evidence: { type: 'string' },
    }, required: ['severity', 'area', 'owner', 'problem', 'fix'] } },
  },
  required: ['track', 'summary', 'findings'],
}
const FIXED = {
  type: 'object',
  properties: {
    track: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' } },
    notFixed: { type: 'array', items: { type: 'string' }, description: 'finding + reason (not real / needs another owner / trade-off)' },
    verification: { type: 'string' },
    metrics: { type: 'string', description: 'before → after numbers' },
  },
  required: ['track', 'fixed', 'notFixed', 'verification'],
}
const VERIFIED = {
  type: 'object',
  properties: {
    track: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'issues'] },
    metrics: { type: 'string' },
    fixedInVerify: { type: 'array', items: { type: 'string' } },
    stillBroken: { type: 'array', items: { type: 'string' } },
  },
  required: ['track', 'verdict', 'stillBroken'],
}

const port = (phase, t) => 9800 + phase * 100 + t * 10

phase('Audit')
const audits = await parallel([
  ...TRACKS.map((t) => () => agent(`${COMMON}
ROLE: AUDITOR (read-only — do NOT edit any file) for area "${t.key}". Files: ${t.files}. Pages: ${t.pages}. Your ports: ${port(0, t.port)}–${port(0, t.port) + 9}.
Baseline already measured by the lead: ${t.base}
Audit deeply and skeptically:
1. Read every file of the area; find bugs, gate mistakes (pins/WebGL on touch or lite, missing reduced path), missing cleanup, per-frame waste, layout reads in scroll paths, a11y gaps, invented facts.
2. Screenshots at 320x640, 360x780, 390x844, 430x932 (mobile), 768x1024 and 1024x1366 (mobile = touch tablets), 1280x720, 1366x768, 1920x1080, 2560x1440 (desktop; "#id@5" frames for pinned scenes), plus --reduced (desktop + mobile) and --lite. LOOK at each PNG critically: overflow, clipped/overlapping text, empty frames, broken pins, ugly states, contrast.
3. Measure perf with perf-section.mjs (2–3 runs; also one run with --cpu=4 to simulate a slow CPU) and CLS.
4. Exercise every interaction (clicks, keyboard, toggles) via js: targets.
Report every real issue with a concrete fix, owner = "${t.key}" unless the file belongs to another area.`, { label: `audit:${t.key}`, phase: 'Audit', schema: FINDINGS })),
  () => agent(`${COMMON}
ROLE: CROSS-CUTTING AUDITOR (read-only — do NOT edit any file). Your ports: ${port(0, XCUT.port)}–${port(0, XCUT.port) + 9}.
Audit the WHOLE site as a user and as Lighthouse would, across areas owned by others:
- Run audit.mjs on the dev server for all pages (/, /servicios/, /servicios/potencia-electrica/, /servicios/respaldo-energetico/, /servicios/climatizacion/, /nosotros/, /contacto/, /diagnostico/, /no-existe/) on tiny-320, iphone-14, tablet-768, laptop-1280, desktop-1920 and summarise.
- Navigation flows: header links, mobile menu, footer links, CTA/WhatsApp hrefs (valid wa.me with encoded text), view transitions between pages (no stuck states after navigating back and forth 3 times — scenes must re-init cleanly), anchor links (#tablero etc.) with the header offset.
- SEO: titles/descriptions per page, canonical, OG/Twitter tags, JSON-LD validity, sitemap, robots (demo noindex), heading order (one h1), alt texts, lang.
- Accessibility: keyboard-only walkthrough of the home (tab order, focus visible, skip link, focus not lost inside pinned scenes), contrast of small text on both themes, aria on canvases/SVG.
- Motion consistency across scenes (duplicated effects, jarring transitions between a dark and a light scene), total JS/CSS weight per page (check network sizes via js: performance.getEntriesByType('resource')), fonts, images.
For each finding set owner to the track whose files must change: hero|tablero|transferencia|diagnostico|cobertura|recorrido-valores|instagram|chrome|interiores (see which file is responsible; chrome owns layouts/Base, chrome components, engine.js, chrome.js, styles, Cta, Icon, site.js, astro config, robots, index.astro FAQ).`, { label: 'audit:cross', phase: 'Audit', schema: FINDINGS }),
])

const all = audits.filter(Boolean)
const cross = all.find((a) => a.track === 'cross' || a.track === 'cross-cutting') || audits[audits.length - 1]
const byTrack = Object.fromEntries(TRACKS.map((t) => [t.key, []]))
all.forEach((a) => (a.findings || []).forEach((f) => { const k = byTrack[f.owner] ? f.owner : (byTrack[a.track] ? a.track : 'chrome'); byTrack[k].push({ ...f, from: a.track }) }))
log(`Audit done: ${all.length}/10 auditors, ${Object.values(byTrack).reduce((n, l) => n + l.length, 0)} findings routed → ` + TRACKS.map((t) => `${t.key}:${byTrack[t.key].length}`).join(' '))

const results = await pipeline(
  TRACKS,
  (t) => {
    const own = all.find((a) => a.track === t.key)
    return agent(`${COMMON}
ROLE: FIXER for area "${t.key}". You may edit ONLY: ${t.files}. Pages: ${t.pages}. Your ports: ${port(1, t.port)}–${port(1, t.port) + 9}.
Baseline: ${t.base}
Auditor metrics: ${own?.metrics || 'n/a'}
Findings to address (from the area auditor and the cross-cutting auditor):
${JSON.stringify(byTrack[t.key]).slice(0, 14000)}
Fix ALL high and medium findings and the low ones that are cheap. Keep the visual design and motion premium (improve technique rather than delete effects). If a finding is wrong, prove it and list it in notFixed with the reason; if it needs a file you do not own, list it in notFixed with "owner: <track>".
After fixing: re-verify every fix in the viewport/mode where it was found, re-measure perf (before → after, 2–3 runs each) and CLS for the pages you touch, and make sure there are no console errors.`, { label: `fix:${t.key}`, phase: 'Fix', schema: FIXED })
  },
  (fixed, t) => agent(`${COMMON}
ROLE: INDEPENDENT VERIFIER for area "${t.key}" (you did not write these fixes). You may edit ONLY: ${t.files} — only for small leftover fixes; anything big goes to stillBroken. Pages: ${t.pages}. Your ports: ${port(2, t.port)}–${port(2, t.port) + 9}.
Findings that were given to the fixer: ${JSON.stringify(byTrack[t.key]).slice(0, 8000)}
Fixer report: ${JSON.stringify(fixed ?? { note: 'fixer returned nothing' }).slice(0, 6000)}
Verify skeptically on disk and in the browser: every claimed fix really works (screenshots at the original viewport/mode), nothing regressed at 320 / 390 / 768 / 1280x720 / 1366x768 / 1920 / 2560, --reduced, --lite, keyboard; perf-section numbers (2–3 runs) and CLS 0 on the pages; no console errors. verdict "pass" only if nothing high/medium remains.`, { label: `verify:${t.key}`, phase: 'Verify', schema: VERIFIED }).then((v) => ({ track: t.key, fixed, verified: v })),
)

phase('Regression')
const regression = await agent(`${COMMON}
ROLE: FINAL REGRESSION QA. All other agents have finished — you may now edit ANY file in src/ to fix regressions you find (keep fixes minimal and verified). Your ports: ${port(3, 0)}–${port(3, 0) + 9}.
Area results: ${JSON.stringify(results.map((r) => ({ track: r?.track, verdict: r?.verified?.verdict, stillBroken: r?.verified?.stillBroken, metrics: r?.verified?.metrics || r?.fixed?.metrics }))).slice(0, 9000)}
Cross-cutting audit summary: ${JSON.stringify({ summary: cross?.summary, metrics: cross?.metrics }).slice(0, 3000)}
Do: (1) audit.mjs over all 9 pages on tiny-320, iphone-14, tablet-768, laptop-1280, laptop-1366, desktop-1920, ultrawide-2560; (2) CLS snippet on /, /servicios/, /servicios/respaldo-energetico/, /nosotros/ = 0.000; (3) perf-section.mjs on every home section (#inicio #tablero #transferencia #diagnostico #cobertura #recorrido #valores #faq #instagram #contacto) at 1366x768, 2 runs each, report a table; (4) navigate home→servicios→detalle→back→nosotros→home through links (js: click) and confirm scenes re-init with no console errors; (5) --reduced and --lite passes of the home; (6) fix what is broken; (7) write ${ROOT}/docs/AUDITORIA.md in Spanish: method (tools, viewports, modes), results table per section (fps, worst frame, CLS, LCP), what was fixed per area, and what remains (honest). Return a concise summary.`, { label: 'regression', phase: 'Regression' })

return {
  audit: { routed: Object.fromEntries(TRACKS.map((t) => [t.key, byTrack[t.key].length])), cross: cross?.summary },
  areas: results.map((r) => ({ track: r?.track, fixed: r?.fixed?.fixed?.length, notFixed: r?.fixed?.notFixed, verdict: r?.verified?.verdict, stillBroken: r?.verified?.stillBroken, metrics: r?.verified?.metrics || r?.fixed?.metrics })),
  regression,
}
