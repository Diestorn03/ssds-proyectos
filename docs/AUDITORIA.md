# Auditoría final del sitio SSD&S (29-09-2026)

Pase final de regresión, después de la auditoría, las correcciones y la verificación por áreas. Objetivo del usuario: que el sitio sea "completamente funcional, optimizado y hermosamente fluido" de 320 a 2560 px y en laptops modestas, sin quitar las animaciones.

## Método

- **Entorno:** servidor de desarrollo (`127.0.0.1:4321`, sin minificar) y Chrome headless con la GPU real de esta máquina (AMD Radeon integrada), que sirve de referencia de "laptop modesta". Un build de producción debería rendir igual o mejor.
- **Herramientas** (`tools/qa/`):
  - `audit.mjs`: desbordes, áreas táctiles, textos pequeños, reveals trabados, imágenes rotas o sobredimensionadas, LCP, CLS, fps y errores.
  - `shoot.mjs`: capturas, errores de consola, CLS con scroll completo (pasos de 60 px), navegación por enlaces y modos `--reduced` y `--lite`.
  - `perf-section.mjs`: fps y costo por frame de cada sección durante el scroll.
  - Una sonda propia de **reposo**: traza 2 s con la página quieta y cuenta Layerize, Paint, Style y JS. Con ella se encontraron los problemas corregidos en este pase.
- **Páginas (10):** `/`, `/servicios/`, `/servicios/climatizacion/`, `/servicios/potencia-electrica/`, `/servicios/respaldo-energetico/`, `/nosotros/`, `/contacto/`, `/diagnostico/`, `/dimensionar/` (nueva, pendiente de auditar con `audit.mjs`) y 404.
- **Viewports:**
  - `audit.mjs`: tiny-320, iphone-14, tablet-768, laptop-1280, laptop-1366, desktop-1920 y ultrawide-2560 (63 corridas).
  - Ventanas reales de laptop: 1266×606, 1366×657 y 1536×730.
- **Modos:** desktop (puntero fino), táctil (UA móvil más touch), `prefers-reduced-motion` y lite (sin WebGL).

## Resultados

### Home por sección (1366×768, `perf-section.mjs`, 2 corridas después de las correcciones)

| Sección | fps | Peor frame | Antes de este pase (corrida tranquila) | Traspaso (28-09) |
|---|---|---|---|---|
| Hero `#inicio` | 78 / 81 | 38 / 34 ms | 85 fps, 30 ms | 39 fps, ~200 ms |
| Tablero `#tablero` | 83 / 83 | 26 / 25 ms | 63 fps, 78 ms | 48–55 fps, 60–160 ms |
| Transferencia | 83 / 82 | 30 / 28 ms | 75 fps, 30 ms | 55–59 fps, 30–117 ms |
| Diagnóstico | 80 / 85 | 21 / 22 ms | 60 fps, 50 ms | 44 fps, 172 ms |
| Cobertura | 78 / 76 | 27 / 34 ms | 67 fps, 38 ms | 49–53 fps, 88–121 ms |
| Recorrido | 85 / 91 | 27 / 24 ms | 80 fps, 26 ms | 57–59 fps, ~39 ms |
| Valores | 75 / 76 | 23 / 27 ms | 65 fps, 30 ms | 60 fps |
| FAQ | 101 / 101 | 14 / 14 ms | 95 fps, 18 ms | 60 fps |
| Instagram | 72 / 74 | 23 / 24 ms | 63 fps, 30 ms | 60 fps |
| CTA `#contacto` | 101 / 100 | 16 / 15 ms | 83 fps, 16 ms | 60 fps |

- La meta (unos 60 fps y ningún frame de más de 50 ms) se cumple en todas las secciones.
- Estas cifras vienen de un bucle de scroll de 30 px por frame, así que pueden pasar de 60 fps.
- La primera corrida de la mañana dio cifras peores (hero 46 fps, Tablero 38 fps, peores frames de 209 y 295 ms). Coincidió con recargas en caliente del servidor de desarrollo, así que no se usa como línea base.
- **Con la CPU frenada ×4** (simula un equipo más lento): ver la última sección de este informe.

### Costo en reposo (página quieta, 2 s, 1366×768)

| Punto | Antes | Después |
|---|---|---|
| Home arriba (hero) | Layerize 600 ms + estilo 150 ms + JS 200 ms, **~48 % del hilo principal** | Layerize 7–10 ms + estilo 80 ms + JS 30 ms, **~6 %** |
| Home justo al inicio del Tablero (donde aterriza "Ver servicios") | Layerize 511 ms | Layerize 1 ms |
| Páginas interiores (arriba y a 1500 px) | – | Layerize 0–55 ms, JS 9–18 ms |

Esto era lo que más pesaba en una laptop modesta: la página gastaba casi la mitad del hilo principal aun sin moverse. Ver "Qué se corrigió en este pase".

### CLS (scroll completo en pasos de 60 px; meta 0.000)

| Página | Viewport | CLS |
|---|---|---|
| `/` | 1366×768, 1266×606, 1366×657, 1536×730, 1920×1080, móvil 390×844, móvil 320×640 | **0.000** en todos |
| `/servicios/` | 1366×768, móvil 390 | **0.000** |
| `/servicios/respaldo-energetico/` | 1366×768 | **0.000** |
| `/servicios/potencia-electrica/`, `/servicios/climatizacion/` | 1366×768 | **0.000** |
| `/nosotros/` | 1366×768, móvil 390 | **0.000** |
| `/contacto/`, `/diagnostico/` | 1366×768; `/diagnostico/` también en móvil | **0.000** |

Se volvió a medir después de todas las correcciones de este pase y seguía en 0.000. El CLS móvil del home, que el auditor transversal midió en 0.084, ahora está en 0.000.

### LCP (carga simple, sin el scroll de `audit.mjs`)

| Página | Desktop 1366×768 | Móvil 390×844 |
|---|---|---|
| `/` | 1.62 s (`p.lead`, después de la intro) | 1.19 s |
| `/servicios/` | 0.35 s | – |
| `/servicios/potencia-electrica/` | 0.30 s | – |
| `/servicios/respaldo-energetico/` | 0.30 s | 1.57 s |
| `/nosotros/` | 0.28 s | – |

Los LCP de 3–11 s que muestra `audit.mjs` vienen de su propio scroll, no de la carga.

### Auditoría responsive (`audit.mjs`, 63 corridas)

- **Desbordes y errores:** ninguna corrida tiene desborde horizontal ni errores de consola o de red. La única falla de red es el 404 esperado de `/no-existe/`.
- **Reveals y áreas táctiles:** 0 reveals trabados y 0 áreas táctiles bajo 44 px en táctil (320, 390 y 768 px).
- **Enlaces de 36 px en desktop:** en puntero fino se marcan los 9 enlaces del pie, que miden 36 px de alto. En táctil ya miden 44 px o más.
- **CLS de carga:**
  - `/servicios/` a 1280, 1366, 1920 y 2560 px da 0.006–0.009, y hay un 0.024 aislado en `/servicios/potencia-electrica/` a 1280. Es un desplazamiento en la carga, no en el scroll (ver "Lo que queda").
  - El resto da 0.
- **Imágenes sobredimensionadas:** la miniatura de Cobertura, las vistas previas de `/servicios/` y las tiras de publicaciones cargaban la imagen de 640 px para mostrarla a 96–280 px. Se corrigió en este pase y la reauditoría ya no las marca.
- **Home en táctil:** el hero en móvil da peores frames de 150–230 ms mientras corre la intro; después baja.
- **Reauditoría de `/nosotros/` a 320 px:** marcó 15 reveals trabados porque una recarga en caliente del servidor coincidió con la medición. Se volvió a medir aparte (ver el anexo al final).

### Navegación con View Transitions

Por enlaces reales (clic por JS): home → servicios → respaldo-energético → atrás → nosotros → home, dos veces.

- **Re-init:** las escenas se reinician siempre, con 3 pin-spacers en el home (hero, Tablero y Transferencia; el Recorrido ahora es sticky por CSS).
- **Estado de la página:** 0 reveals ocultos en pantalla y el H1 correcto.
- **Marquesinas:** corren en la página nueva (la de Instagram queda en pausa mientras está fuera de pantalla).
- **Consola:** sin errores.
- **Capturas al volver:** el Tablero y el Recorrido se ven completos y correctos.

### Movimiento reducido y lite (home, 1366×768)

- **Reducido:**
  - Sin pines, sin Lenis y sin WebGL.
  - Todas las secciones se ven en su estado final y legibles.
  - La única advertencia es la esperada de View Transitions con movimiento reducido.
- **Lite:**
  - Pines y Lenis activos, WebGL apagado (canvas con opacidad 0) y el póster CSS visible.
  - Sin errores.

### Otros

- **Test del diagnóstico:** `node src/data/diagnostico.check.mjs` pasa (`ok`).
- **Foco en el índice de Valores:** los 4 enlaces del índice, enfocados justo después del Recorrido, quedan en pantalla y con opacidad 1.
- **Foco en el header escondido:** al enfocar un enlace del header mientras está escondido, el header vuelve a verse (se corrigió en este pase).
- **Visual en móvil a 320 px:** el hero, el titular del CTA (ya no toca el borde), la marquesina de Instagram y la barra "Llamar · WhatsApp" se ven bien.

## Qué se corrigió

### Por área (fase de correcciones, confirmado por sus verificadores)

- **Hero:**
  - Muro de Instagram refactorizado a una sola máscara plana dentro del rig 3D.
  - Cruce del título a una copia pre-difuminada (solo cambia opacidad).
  - Lente con máscara y anillo por transform.
  - Miniaturas con `srcset` de 320 px: el móvil ya no descarga las de 640.
  - En ventanas bajas ya no hay solapes; la señal de scroll cabe.
  - En monitores grandes y en tablet vertical el diseño se adapta, sin pin en tablet.
- **Tablero:**
  - Geometría de los breakers pequeños medida en 5 alturas de ventana.
  - Placa de estado de ancho fijo.
  - `aria-pressed` reemplazado por `data-on`.
  - `will-change` solo durante el pin.
  - Las animaciones `tb-flow` se detienen fuera de pantalla.
  - Recorrido con teclado completo: el foco se conserva a través de un refresh.
  - `pointer-events` del mazo de tarjetas fijado.
- **Transferencia:**
  - CLS 0.0004 a 1280×720 corregido.
  - Pin en `.tr__stage`.
  - 57–61 fps en su momento con la máquina cargada; hoy 82–83 fps.
- **Recorrido:**
  - Ahora es un pin sticky por CSS.
  - Tarjetas centradas en ventanas bajas: el bug del video, a 1266×606, está resuelto.
- **Transversal:**
  - CLS móvil del home 0.084 → 0.
  - Áreas táctiles del pie, del menú y del correo del CTA a 44 px o más.
  - Titular del CTA a 320 px.
  - `<img>` del visor con un `src` real.
  - Canvas del hero con `aria-hidden`.
  - FAB y barra ocultos con `visibility: hidden`, así que no se pueden enfocar.

### En este pase final

1. **Pulso del botón de WhatsApp** (`src/components/chrome/WhatsAppFab.astro`):
   - **Problema:** la animación del anillo corría aunque el botón estuviera oculto (`visibility: hidden`). Así no puede ir en el compositor, y obligaba a Chrome a re-layerizar la página entera en cada frame. Eran unos 3 ms por frame en todas las páginas, incluso en reposo.
   - **Arreglo:** ahora solo anima con `.fab.is-shown`, y el pulso se sigue viendo igual cuando el botón está visible.
2. **Marquesinas** (`src/scripts/engine.js`, `initMarquee`):
   - **Problema:** un ticker de JS escribía `style.transform` en cada frame, lo que también forzaba una re-layerización completa (unos 3 ms por frame con el hero en pantalla).
   - **Arreglo:** ahora cada marquesina es una Web Animation, que corre en el compositor. El scroll solo sube su `playbackRate` con la misma fórmula de antes (hasta unas 24×) y vuelve a 1 al detenerse. El ticker se quita solo cuando la página está quieta.
   - **Sin cambios visibles:** misma velocidad (`data-speed` sigue siendo px por frame a 60 fps), misma reacción al scroll, pausa fuera de pantalla y estática con movimiento reducido.
3. **Hero fuera de pantalla** (`src/components/home/Hero.astro`):
   - **Problema:** al aterrizar justo al inicio del Tablero, que es donde llevan "Ver servicios" y los anclajes, el borde inferior del hero "tocaba" el viewport. El IntersectionObserver lo daba por visible, así que sus loops y el WebGL seguían corriendo sin verse.
   - **Arreglo:** `rootMargin: '-1px 0px 0px 0px'`. Layerize en reposo bajó de 511 ms a 1 ms cada 2 s.
4. **Header escondido y teclado** (`src/components/chrome/Header.astro`): `.hdr.is-hidden:focus-within { transform: none; }`. El foco ya no cae en enlaces fuera de pantalla.
5. **Miniaturas sobredimensionadas:**
   - Se agregó `srcset` con la variante `-320` y `sizes` en `Cobertura.astro`, `servicios/index.astro` y `PostStrip.astro`.
   - El visor (`lightbox.js`) ya manejaba `currentSrc` y `src`, así que el ampliado sigue en 640 px.
6. **404** (`src/layouts/Base.astro` y `src/pages/404.astro`): nueva prop `noindex`. La página de error sale con `robots noindex` y sin canonical.

## Lo que queda (honesto)

- **Contraste (AA):**
  - El texto blanco sobre los botones naranja (`#f26a1b`) da 3.06:1; AA pide 4.5:1 para ese tamaño.
  - Los eyebrows naranja sobre fondo claro dan 3.6–3.9:1.
  - No se cambió porque es una decisión de marca: las piezas reales usan blanco sobre naranja. Si se quiere cumplir AA, un fondo `#c94f0c` da 4.56:1 con blanco.
- **Layerize durante el scroll:**
  - Mientras corren los scrubs de GSAP, Chrome re-layeriza la página en cada frame: cualquier transform escrito desde JS lo hace, aunque tenga `will-change`, y se comprobó con un div de prueba.
  - Cuesta 3–6 ms por frame a 1366×768 y crece con el número de capas.
  - Hoy los frames caben de sobra (72–101 fps, peor frame de 38 ms o menos). En una CPU mucho más débil el margen se achica: ver la medición con la CPU ×4 al final.
  - Seguir reduciendo capas (hero, Tablero y chrome) es la próxima palanca.
- **CLS de carga en páginas interiores:**
  - En la primera carga sin fuentes en caché, `/servicios/` registra 0.008 a los ~330 ms. Viene de los adornos de `HeroFx` (`hfx__glow`, `hfx__ray`, `hfx__beam`), que se mueven unos 8 px cuando el hero cambia de alto, probablemente al cambiar la fuente.
  - Está muy por debajo de 0.1 (umbral "bueno") y el CLS con scroll da 0.000. Se podría eliminar con métricas de fuente de respaldo (`size-adjust`) o con adornos que no dependan del alto.
- **Ventanas bajas:** a 1366×657 quedan solo 8 px entre la fila de datos del hero y la marquesina. No se solapan, pero está justo.
- **Saludo de la lente en táctil:** se salta si la intro termina más de 6 s después de la navegación. Es a propósito, pero en un teléfono lento la primera visita puede no mostrarlo.
- **`/servicios/` estático o con movimiento reducido:** un clic en el breaker 02 deja la tarjeta a 212 px del borde superior, no justo bajo el header. Es un detalle menor.
- **Pie en desktop:** los enlaces del pie miden 36 px de alto con puntero fino. En táctil miden 44 px o más.
- **No cubierto en este pase:**
  - Build de producción: no se corrió, por regla compartida de este pase.
  - Dispositivos reales (iPhone, Android), Safari y Firefox.
  - Lector de pantalla real.
- **Herramienta:** si `audit.mjs` corre un viewport móvil y luego uno de desktop en el mismo Chrome, `pointer: coarse` queda pegado (en la reauditoría se midió `coarse: true` en 1366 y 1920). Para medir desktop hay que correr los viewports de desktop en un proceso aparte, como se hizo en la auditoría principal.

## Pendiente para cerrar (del traspaso)

1. `npm run build` y revisión de los enlaces.
2. `git add -A`, commit y `git push origin main`.
3. Confirmar que el deploy de GitHub Pages quede en verde.

## Anexo: mediciones finales

- **`/nosotros/` a 320 px (reauditoría aislada):** 0 reveals trabados, sin desborde, 0 áreas táctiles bajo 44 px, CLS 0 y sin errores. Los 15 "trabados" anteriores venían de la recarga en caliente.
- **CPU frenada ×4** (`perf-section.mjs --cpu=4`, 1366×768), que simula un equipo bastante más lento que el de referencia:

| Sección | fps | Peor frame | Layerize | JS |
|---|---|---|---|---|
| Hero | 21 | 72 ms | 868 ms / 41 frames | 680 ms |
| Tablero | 21 | 86 ms | 1475 ms / 88 frames | 1657 ms |
| Transferencia | 21 | 114 ms | 1289 ms / 115 frames | 2334 ms |
| Recorrido | 24 | 90 ms | 1165 ms / 143 frames | 2538 ms |

- **Lectura de la tabla:**
  - En un equipo 4 veces más lento, el scroll por las escenas fijadas baja a unos 21–24 fps.
  - El tiempo se reparte entre Layerize (25–30 %), JS de GSAP, ScrollTrigger y Lenis, y el recálculo de estilos.
  - El hero ya pasa solo al modo lite (sin WebGL) cuando mide menos de 22 fps sostenidos.
- **Próximo paso, si hace falta más margen:** aplicar ese mismo criterio a todas las escenas, por ejemplo con scrub más corto o menos capas simultáneas cuando se activa lite.
- **Cómo se midió:** esta prueba recorre la sección a 30 px por frame, así que es más exigente que un scroll normal.
