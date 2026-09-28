# "Corriente Viva" — concepto de experiencia para SSD&S C.A.

El motivo de marca de SSD&S es el **rayo de luz diagonal** (naranja → dorado) que atraviesa todas sus piezas de Instagram. La experiencia lo convierte en **una corriente que recorre la página**: entra con el loader, vive en el hero, baja por el margen izquierdo como una línea que se dibuja con el scroll, alimenta cada escena (tablero, transferencia, red nacional, recorrido) y termina en el pie iluminando el logo.

Referencia de nivel: `Rediseño RenewWater` (misma base Astro 7 + GSAP 3.15 + Lenis). Se reutilizan sus **patrones** (gates por dispositivo, escenas fijadas con scrub, loader CSS, hilo, transiciones circulares, marquesinas reactivas, pausa de animaciones fuera de pantalla), nunca su tema ni sus textos.

Todo el contenido sigue saliendo de `src/data/site.js` y `docs/BRIEF.md`. **No se inventan cifras**: sin años de experiencia, sin número de clientes, sin certificaciones. Los únicos números son hechos verificables (23 estados, 3 líneas, 4 etapas, 14 posts) o valores de una simulación marcada como ilustrativa.

## Gates (obligatorios en cada escena)

| Entorno | Qué corre |
|---|---|
| `env.desktop` = `(min-width:768px) and (pointer:fine) and (prefers-reduced-motion:no-preference)` | Pins, scrubs, WebGL/canvas, Lenis, tilt/magnético, lente, cursor. `html.is-desktop-fx` está puesto. |
| Táctil o < 768px | Sin pins, sin WebGL, sin scroll suave. Escenas con `position: sticky` + IntersectionObserver, filas con `scroll-snap`, animaciones "una vez al entrar". Áreas táctiles ≥ 44 px. |
| `prefers-reduced-motion: reduce` | Estado final estático. Sin loader, sin marquesinas, sin scrub. El contenido sigue completo y accesible. |
| Sin JS | Todo visible (los pre-hide sólo aplican con `html.js`). |

Cada canvas/SVG decorativo tiene su equivalente en texto (`sr-only` o lista visible).

## Chrome (compartido, ya construido por el lead)

- **Loader "El Arranque"** (`components/chrome/Loader.astro`): primera visita por sesión. El isotipo hexagonal se dibuja, una chispa recorre el contorno, el wordmark barre, el rayo cruza y el telón sube. ~1.2 s, botón "Saltar", `Esc`. Emite `ssds:loader-done` `{x, y}`. `introGate()` del engine espera a este evento (o resuelve al instante si no hay loader).
- **Header** (`components/chrome/Header.astro` + `scripts/chrome.js`): fijo, cristal al hacer scroll, se esconde bajando y aparece subiendo (a partir de 400 px). **Toma el tema de la sección que tiene debajo** (`data-theme="dark|light"` en cada `<section>`): sobre secciones claras los textos pasan a tinta. Menú móvil como `<dialog>` que se abre en círculo desde el botón. Persiste entre navegaciones (`transition:persist`).
- **La Línea** (`components/chrome/Linea.astro`): un hilo naranja → dorado por el margen izquierdo de `<main>` (≥ 1024 px, puntero fino) que se dibuja con el scroll; en la punta viaja un "electrón" luminoso. Decorativa.
- **"El Arco"** (`styles/transitions.css`): la página nueva se abre en círculo desde el punto del clic (View Transitions). Reduced motion: fundido de 150 ms.
- **WhatsApp**: FAB que aparece después del hero y se esconde sobre la sección de contacto/CTA. En móvil, barra inferior "Llamar · WhatsApp".
- **Motor** (`scripts/engine.js`): helpers declarativos (`data-reveal`, `data-stagger`, `data-split`, `data-lit`, `data-parallax`, `data-depth`, `data-count`, `data-draw`, `data-magnetic`, `data-tilt`, `data-glow`, `.marquee`, `.stack-card`) y `onPage()` para escenas con lógica propia. Pausa animaciones CSS de secciones a más de una pantalla (`[data-offscreen]`).

## Escenas del home (orden) y propietario

| # | id | Tema | Escena | Archivo(s) |
|---|---|---|---|---|
| 1 | `#inicio` | dark | **Hero "Alta Tensión"**. Fondo WebGL "campo eléctrico" (filamentos de energía naranja/dorado sobre azul marino, con warp y rayos diagonales; el puntero curva los filamentos; chispas blancas raras; auto-degrada al póster CSS si va lento). Póster CSS (gradientes + rayos SVG) para móvil y como primer frame. Título con **lente-medidor** que sigue al puntero y revela el título relleno de gradiente (móvil: un barrido guionado). Intro por letras tras el loader. Muro de las 14 piezas de Instagram en 3 columnas 3D (existente). **Pin +100 %** en desktop: el muro se aplana y sube, el título se difumina, los CTAs salen y aparece palabra a palabra la línea puente "¿Tu energía está protegida?". Marquesina de frases. | `components/home/Hero.astro`, `scripts/hero/campo.js` |
| 2 | `#tablero` | light | **El Tablero (servicios)**. Un tablero eléctrico dibujado en SVG/CSS con 3 breakers grandes (01 Potencia, 02 Respaldo, 03 Climatización). Desktop: pin +200 %, scrub; cada breaker **baja a ON** con un "clack", su LED pasa a verde, su circuito se dibuja (DrawSVG) hasta la tarjeta del servicio que aparece en fundido; medidor de carga que sube. Click en un breaker salta a su etapa (`labelToScroll`). Táctil: tablero sticky + 3 tarjetas apiladas (IO pone `data-step`). Reduced: tablero todo ON + 3 tarjetas. Links a `/servicios/<slug>/`. | `components/home/Tablero.astro`, `scripts/tablero.js` |
| 3 | `#transferencia` | dark | **La Transferencia (ATS)**. Esquema animado: RED ELÉCTRICA → tu PLANTA ← GENERADOR, con el ATS en el centro. Línea de tiempo: (1) la red alimenta (corriente animada por el conductor), (2) **falla** (parpadeo rojo "FALLA EN LA RED"), (3) modo manual: alguien debe ir al tablero, un contador sube en minutos y la planta queda a oscuras, (4) modo automático: el ATS conmuta en milisegundos, el generador enciende, la planta sigue iluminada, contador "0 min de parada". Desktop: scrub con pin +150 %. Táctil: se reproduce sola al entrar, con botón "Repetir". Reduced: dos estados estáticos (manual vs automática). Debajo, comparación manual vs automática y CTA "Cotiza tu tablero ATS". Marcar "simulación ilustrativa". | `components/home/Transferencia.astro`, `scripts/transferencia.js` |
| 4 | `#diagnostico` | light | **Diagnóstico rápido**. Cuestionario de 4 pasos con chips (tipo de instalación; ¿tienes planta eléctrica? con/sin ATS; qué te preocupa; tamaño aproximado). Un **medidor analógico** (aguja SVG) se mueve con cada respuesta. Resultado: servicio(s) recomendado(s), pista orientativa baja/media tensión y mensaje de WhatsApp ya redactado (`wa(text)`). Reglas en `src/data/diagnostico.js`. `aria-live` para el resultado. Funciona igual en todos los entornos (es un formulario, no una animación). También como landing `/diagnostico/` para el link en bio. | `components/home/Diagnostico.astro`, `scripts/diagnostico.js`, `data/diagnostico.js`, `pages/diagnostico.astro` |
| 5 | `#cobertura` | dark | **Red nacional**. Mapa de Venezuela (silueta real, Natural Earth vía `world-atlas` → path SVG generado por `tools/venezuela-map.mjs`, guardado en `src/data/venezuela.js`). Maracay es el origen: con el scroll salen **líneas de energía** (DrawSVG) hacia ~8 ciudades con pings; la foto de Aragua (post real) como tarjeta; contadores 23 estados / 3 líneas / 4 etapas; sectores. Táctil: la animación corre una vez al entrar. | `components/home/Cobertura.astro`, `tools/venezuela-map.mjs`, `data/venezuela.js` |
| 6 | `#recorrido` | light | **El Recorrido (proceso)**. Desktop: pin y desplazamiento horizontal de 4 estaciones (Evaluación, Diseño, Montaje, Mantenimiento) con las piezas reales de Instagram como visual de cada una; un **cable** naranja se llena por delante del lector con una punta luminosa y cada estación "se conecta" al pasar. Táctil: fila con `scroll-snap`. Reduced: rejilla. | `components/home/Recorrido.astro`, `scripts/recorrido.js` |
| 7 | `#valores` | dark | **Por qué SSD&S**. Palabra sangrante "POTENCIA" en contorno que se rellena con el gradiente al hacer scroll; los 4 valores como **pila de tarjetas** (`.stack-card`) junto al titular pegado; cita con `data-lit`. | `components/home/Valores.astro` |
| 8 | `#faq` | light | Acordeón nativo `<details name>` (existente), afinado al nuevo sistema. | en `pages/index.astro` |
| 9 | `#instagram` | dark | Las 14 piezas (grilla 8 + "ver todas") con **lightbox** (imagen grande, título, fecha, botón "Ver en Instagram", teclado, morph desde la miniatura), insignia Reel. | `components/home/Instagram.astro`, `components/ui/Lightbox.astro`, `scripts/lightbox.js` |
| 10 | `#contacto` | dark | CTA con rayos (existente) + **pie**: La Línea entra en el isotipo, que se dibuja al llegar; wordmark gigante "SSD&S" que se rellena con el gradiente al hacer scroll. | `components/ui/Cta.astro`, `components/chrome/Footer.astro` |

Páginas interiores (`/servicios/`, `/servicios/[slug]/`, `/nosotros/`, `/contacto/`, `/404/`) adoptan `data-theme` por sección, el loader no corre en ellas (ya corrió en la sesión) y reutilizan escenas en modo estático: `<Tablero mode="static" />` en `/servicios/`, `<Transferencia mode="static" />` en `/servicios/respaldo-energetico/`, `<Diagnostico />` en `/diagnostico/`.

## Contratos técnicos

- Una escena = un componente `.astro` con su `<style>` (scoped) y `<script>` que hace `import { onPage } from '../../scripts/engine.js'` y registra **una** función. Debe salir (`return`) si su raíz no está en la página. Devuelve una función de limpieza que quita listeners, cancela rAF, libera WebGL.
- Los tweens y ScrollTriggers se crean dentro de esa función (viven en el `gsap.context` del engine y se revierten al navegar).
- Pins: `anticipatePin: 1`, `invalidateOnRefresh: true`; medir en `onRefreshInit`. Nunca animar `top/left/width/height`: sólo `transform`, `opacity`, `clip-path` y variables CSS.
- Canvas: `devicePixelRatio` limitado a 1.5 (2D) o 1 y media resolución (WebGL); parar cuando la sección no está en pantalla (`IntersectionObserver`) o la pestaña está oculta.
- Cada `<section>` lleva `id`, `data-theme`, `aria-labelledby` y usa `.section` + `.container`.
- Tokens en `src/styles/base.css`. Colores: `--navy-900 #0b1a3a`, `--orange-500 #f26a1b`, `--glow #ffd79a`, gradiente `--grad-brand`. Tipos: Sora (display), Inter (texto), JetBrains Mono (etiquetas). Sin fotos de stock: sólo SVG/CSS/canvas y las 14 piezas reales de `public/ig/`.
- Verificación: `npm run build` sin errores; capturas con `node <shots>/shoot.mjs --port=<único> desktop "#id" ...` y `mobile`; sin errores en consola; `docs/AUDITORIA.md` recoge los hallazgos.
