# App del cotizador para el iPhone de David (/app/)

El cotizador como app instalable (PWA): abre directo en el paso 1, funciona **sin internet** después de abrirla una vez con conexión y comparte el PDF con la hoja de iPhone. Sin App Store, sin Mac, sin cable.

- Ruta: `/app/` (producción: `https://ssdsproyectos.com/app/`). Solo lleva el cotizador, no el resto del sitio.
- El sitio público y `/dimensionar/` no cambian. El service worker vive en `/app/sw.js` con alcance `/app/`: no controla ninguna otra página.
- `/app/` lleva `noindex`, no sale en el sitemap y `robots.txt` la excluye.

## Instalar en el iPhone (probar con el 14, luego el de David)

1. Abre la dirección en **Safari** (no dentro de WhatsApp ni Instagram). Para probar antes de publicar: `https://app-cotizador.ssds-proyectos.pages.dev/app/` (el subdominio exacto sale en el log del paso «Publicar» del workflow).
2. Espera el aviso **«Listo: el cotizador ya funciona sin internet»**.
3. Toca Compartir, **Añadir a pantalla de inicio**, con «Abrir como app web» activo.
4. Abre el ícono **una vez con internet** y espera otra vez el aviso «Listo»: en iOS la app instalada guarda sus datos aparte de Safari y arma su propia copia sin conexión.
5. Prueba: modo avión, cierra la app deslizando, ábrela de nuevo, arma un presupuesto, escribe un nombre con tilde y ñ y toca **Compartir PDF** (WhatsApp, Archivos, Correo, AirDrop e Imprimir deben aparecer en la hoja).

Una app instalada desde la vista previa (`*.pages.dev`) es otra app distinta: David debe instalar la de `ssdsproyectos.com/app/` cuando esté publicada.

## Cosas a verificar en un iPhone real (no se pueden probar desde el PC)

- La hoja de compartir: el botón dice «Compartir PDF» cuando el archivo ya está listo; si iOS rechaza el gesto aparece «Compartir de nuevo».
- Notch, Dynamic Island y barra inferior (el diseño usa `env(safe-area-inset-*)`).
- Que el botón verde abra WhatsApp (con el chat del cliente si se escribió el teléfono) y se pueda volver a la app.
- Actualización: publicar una versión nueva, abrir la app con internet y ver «Hay una versión nueva» con el botón **Actualizar**. Al pie de la pantalla se lee la versión y la fecha con las que se está cotizando.

## Cómo funciona (para quien mantenga esto)

- `npm run build` = `astro build` + `tools/app-pwa.mjs`, que escribe en `dist/app/`: `sw.js`, `manifest.webmanifest` y `version.json`. La lista de precaché sale de lo que `/app/` realmente carga (JS/CSS con hash, trozos de jsPDF, fuentes del PDF, fotos de `public/equipos`, íconos). Si falta un archivo, el build falla. La versión es un hash del contenido.
- El service worker no hace `skipWaiting` solo: la versión nueva espera hasta que David toque «Actualizar», para no cambiar precios a mitad de un presupuesto. Los precios van dentro de la app: se actualizan solo cuando la app recibe versión nueva.
- Recientes: `localStorage` (`ssds-app-recientes`), 20 como máximo, solo en ese teléfono. Borrar la app borra el historial.
- Íconos: `npm run icons` (desde `public/favicon.svg`; los PNG de `public/app/icons` se versionan).
- Prueba automática en el PC: `npm run build` y luego `node tools/qa/app-offline.mjs --chrome-port=9611 --web-port=4613 [--w=430 --h=932 --tag=iphone16promax]`. Apaga el servidor de verdad para probar sin red, recorre el flujo, genera el PDF y mide CLS y táctiles.
- Decisiones por confirmar con David: que el PDF lleve el teléfono del cliente y que WhatsApp abra el chat directo cuando se escribe; y el texto de `mensajeCliente()` en `src/data/dimensionar.js`.
