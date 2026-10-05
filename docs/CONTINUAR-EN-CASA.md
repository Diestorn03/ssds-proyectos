# Continuar en casa: auditoría profunda del sitio SSD&S

Este archivo es el contexto completo para el Claude de la PC de casa. Léelo entero antes de empezar.

## Qué es el proyecto

- Sitio de **SSD&S C.A.** (Maracay, Venezuela; potencia e ingeniería industrial). Repo `Diestorn03/ssds-proyectos`.
- Stack: Astro 7 + GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG, MotionPath) + Lenis. Todo en español.
- Demo publicada: https://diestorn03.github.io/ssds-proyectos/ (cada push a `main` despliega con `.github/workflows/deploy.yml`).
- Documentos clave:
  - `docs/BRIEF.md`: única fuente de datos. No inventar cifras, años, clientes ni certificaciones. Todo número simulado lleva "Simulación ilustrativa".
  - `docs/CONCEPTO.md`: concepto "Corriente Viva", escenas, gates y contratos técnicos.
  - `src/scripts/engine.js`: motor (`onPage`, `env.desktop` / `env.reduced` / `env.lite`, helpers `data-*`).
  - Referencia de calidad que eligió el usuario: su proyecto "Rediseño RenewWater" (mismo stack; no está en este repo).

## Qué quiere el usuario

Que el sitio quede **"completamente funcional, optimizado y hermosamente fluido"** en todos los dispositivos (320 → 2560 px) y en todas las computadoras, incluidas laptops modestas, sin perder las animaciones premium. Pidió hacerlo con **10 agentes en 3 fases**: auditar, corregir y verificar, más un pase final de regresión.

## Estado al salir de la oficina (28-09-2026, 17:00)

Ya hecho y publicado:

| Mejora | Antes | Después |
|---|---|---|
| CLS del home en desktop | 7.6 | 0 |
| LCP del home | 3.3 s | 1.6 s desktop, 1.2 s móvil |
| Peor frame del Tablero | 164 ms | ~60 ms |

- CLS: Tablero y Recorrido se fijan con `pinType: 'transform'`. **No fijar `.tb__stage`**: pierde su centrado automático.
- LCP: el hero conserva su SplitText después de la intro. Revertirlo recreaba el H1 y retrasaba el pintado.
- Las líneas de tiempo del Tablero, la Transferencia y la Cobertura se precalientan al cargar con `tl.progress(1, true).progress(0, true)`.
- Existen variantes livianas `public/ig/<code>-320.webp` para miniaturas. Todavía no se usan en `srcset`.

Hecho en el último commit, **sin verificar visualmente**:

- **Loader reescrito** (`src/components/chrome/Loader.astro`). El usuario vio que la pantalla de carga "se traba" y la necesita fluida para grabar un video de presentación. Causa: animaba trazos SVG, `clip-path` y `letter-spacing`, que corren en el hilo principal y se congelan mientras la página arranca. Ahora solo usa `transform` y `opacity`, que corren en la GPU.
- **El motor ya no arranca las escenas hasta que termina el loader** (`start()` en `engine.js`).
- **Primera tarea en casa:** verificar el loader con `node tools/qa/shoot.mjs --port=9771 desktop --intro --wait=2500 http://127.0.0.1:4321/`. Revisar los cuadros `intro-250ms` … `intro-2400ms` y pulirlo si hace falta. Ojo: en la oficina, una corrida con perfil reutilizado no mostró el loader, aunque con perfil nuevo sí aparecía. Si pasa, borra la carpeta `profile-<puerto>` del directorio de capturas.

No terminado:

- La auditoría profunda de 10 agentes se lanzó a las 16:05 y se detuvo a las 16:57 **sin que ningún auditor entregara su informe**. Sus notas parciales, extraídas de sus transcripciones, están en `docs/auditoria/notas-parciales.md`. Úsalas como pistas, no como resultados.
- Faltan las 4 fases completas: auditoría, corrección, verificación y regresión.

## Bug visto en el video de presentación (prioridad alta)

- **Recorrido horizontal (`#recorrido`) en pantallas bajas.** En la grabación del usuario el área visible del navegador medía unos 1266×606 px: laptop de 1280×720 menos las pestañas de Chrome y la barra de tareas de Windows. Las tarjetas quedaron empujadas al fondo, con un gran espacio vacío arriba, y la transición hacia "POTENCIA" se vio cruzada. Hubo que recortar ese tramo del video.
- **Cómo reproducirlo:** `node tools/qa/shoot.mjs --port=9790 desktop --w=1266 --h=606 http://127.0.0.1:4321/ "#recorrido@6"`.
- **Qué revisar:** las alturas en `vh` de `--tall`, `--under` y `--branch` en `Recorrido.astro`. Las tarjetas deben quedar centradas y completas en alturas de 560 a 700 px. Prueba también 1366×657 y 1536×730, que son altos típicos de ventana con barra de tareas.

## Hallazgos ya medidos (úsalos como punto de partida)

| Sección | fps a 1366×768 | Peor frame | Nota |
|---|---|---|---|
| Hero `#inicio` | 39 | ~200 ms | muchas capas compuestas en el muro 3D de Instagram con `mask-image` |
| Tablero `#tablero` | 48–55 | 60–160 ms | pin por transform; unos 4 ms de JS por frame |
| Transferencia | 55–59 | 30–117 ms | hay layout durante el scrub, es sospechoso |
| Diagnóstico | 44 | 172 ms | flujo de 4 pasos sin revisión independiente |
| Cobertura | 49–53 | 88–121 ms | `svg.cob__fx` y `.cob__stage` se repintan cada frame |
| Recorrido | 57–59 | ~39 ms | CLS corregido; mantener `pinType: 'transform'` |
| Valores, FAQ, Instagram, CTA | 60 | < 36 ms | referencia de "bien" |

- La base global de JS es de unos 6 ms por frame, incluso en secciones quietas. Revisar el ticker de las marquesinas, La Línea (`getPointAtLength` en cada frame) y el header.
- **Textos pequeños:** el lema del logo en el pie mide 8 px, "C.A." unos 10 px y la nota "demo" del pie 11.5 px.
- **Áreas táctiles:** los enlaces del pie y del menú miden 36 px de alto y el correo del CTA 23 px en móvil.
- **Titular del CTA a 320 px:** la palabra "infraestructura" toca el borde derecho.
- **Imagen sin `src`:** hay un `<img>` sin `src` en `/` y `/nosotros/`, probablemente el visor de Instagram.
- **Miniaturas pesadas:** cargan la imagen de 640 px para mostrarla a 122–284 px; usar las variantes `-320` con `srcset`.
- **Sin problemas:** no hay desbordes horizontales, errores de consola ni reveals trabados en 108 corridas (12 tamaños × 9 páginas).

## Cómo preparar la PC de casa

```bash
git pull
npm ci
npm run dev -- --host 127.0.0.1 --port 4321
```

- Requiere Google Chrome en `C:/Program Files/Google/Chrome/Application/chrome.exe`. Si está en otra ruta, ajusta la línea `spawn(...)` en `tools/qa/*.mjs`.
- En Git Bash, antepone `MSYS_NO_PATHCONV=1` a todo comando que pase rutas como `/servicios/` o `PAGES_BASE=/ssds-proyectos`. Si no, Git Bash las convierte en rutas de Windows y rompe la build.
- **Build de producción para GitHub Pages:**
  ```bash
  MSYS_NO_PATHCONV=1 PAGES_BASE=/ssds-proyectos SITE_URL=https://diestorn03.github.io PUBLIC_DEMO=1 npm run build
  ```
  Después confirma que `dist/index.html` tenga `href="/ssds-proyectos/...`.
- **Preview de producción:** `npx astro preview --host 127.0.0.1 --port 4322`, con las mismas variables `PAGES_BASE` y `SITE_URL`. En PowerShell se definen con `$env:`.

## Herramientas de QA (en `tools/qa/`)

Guardan sus salidas en `%TEMP%/ssds-shots`, o en la carpeta que indiques con `SHOTS_DIR`.

- **`shoot.mjs`: capturas y errores de consola.**
  ```
  node tools/qa/shoot.mjs --port=94xx <desktop|mobile> <url> [targets] [--w= --h=] [--reduced] [--lite] [--intro] [--wait=ms]
  ```
  - `#id`: captura con la sección arriba.
  - `#id!`: captura con la sección alineada abajo.
  - `#id@6`: 6 cuadros a lo largo de una escena fijada.
  - `js:<expr>`: ejecuta JS en la página e imprime el resultado.
  - `--intro`: no salta el loader.
- **`perf-section.mjs`: costo por frame de una sección durante el scroll.**
  ```
  node tools/qa/perf-section.mjs <port> <url> <selector> [--w=1366 --h=768 --cpu=4]
  ```
  Devuelve fps, peor frame, ms por fase y los nodos que más repintan.
- **`audit.mjs`: auditoría responsive por lotes.**
  ```
  MSYS_NO_PATHCONV=1 node tools/qa/audit.mjs http://127.0.0.1:4321 out.json --port=N --vp=tiny-320,iphone-14,... / /servicios/ ...
  ```
  Revisa desbordes, áreas táctiles, textos pequeños, reveals trabados, LCP/CLS, fps y errores. El LCP que reporta está inflado por su propio scroll; mídelo con una carga simple.
- **Chequeo de CLS (debe dar 0.000):** el fragmento `CLS` de `tools/qa/deep-audit.workflow.js`, pasado como target `js:` a `shoot.mjs`.
- **Test del diagnóstico:** `node src/data/diagnostico.check.mjs`.
- **Test del dimensionador:** `node src/data/dimensionar.check.mjs` (motor, precios, enlace `?c=`).
- **Probar el PDF:** abre `/dimensionar/`, marca equipos, elige "Instalado" y pulsa "Descargar presupuesto" (el nombre del cliente es opcional). Revisa que diga "Presupuesto" (nunca factura), razón social y RIF. Para verlo como imagen: `python -c "import pymupdf; pymupdf.open('x.pdf')[0].get_pixmap(dpi=110).save('x.png')"`. Las fuentes del PDF se regeneran con `python tools/pdf-fonts.py`.
- **Preguntas pendientes para David:** `docs/PREGUNTAS-DAVID.md` (listas para pegar en WhatsApp; cada `POR CONFIRMAR Qn` del código apunta ahí).

## Cómo terminar (pedido del usuario)

1. Verifica y pule el loader (ver arriba). Es lo más urgente porque el usuario grabará un video.
2. Corre el workflow `tools/qa/deep-audit.workflow.js` con la herramienta Workflow (`scriptPath`). Es el mismo flujo de 10 auditores, 9 correctores, 9 verificadores y regresión final que se cortó. Ya apunta a las herramientas de `tools/qa/` y a la ruta del repo. Si la ruta del proyecto en casa es otra, cambia `ROOT` al inicio del script.
3. Al terminar: build de producción, revisar hrefs, `git add -A`, commit y `git push origin main`. Después confirma que el deploy de GitHub Pages quede en verde. La auditoría escribe su informe en `docs/AUDITORIA.md`.
4. Comprueba que `docs/AUDITORIA.md` exista y reporta al usuario, en español, qué se corrigió y qué queda.

Reglas que valen para cualquier cambio: mantener los gates (pines y WebGL solo en desktop, sin pines en táctil, estado final estático con movimiento reducido, sin WebGL en modo liviano), CLS 0, sin desbordes de 320 a 2560 px, áreas táctiles de 44 px o más, y ningún dato inventado.
