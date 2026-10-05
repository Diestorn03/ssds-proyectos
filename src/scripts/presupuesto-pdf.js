// Presupuesto en PDF del Dimensionador (documento NO fiscal). Se carga con import() solo al tocar "Descargar presupuesto":
// jsPDF (~340 KB) y las 4 fuentes (~70 KB) no pesan en la carga de la página. Todo en el navegador: el nombre del cliente
// nunca se envía a ningún servidor. Los datos salen de quote() (src/data/dimensionar.js): este módulo solo los dibuja.
// Vectores y texto real (nada de html2canvas ni capturas): se puede seleccionar, buscar e imprimir nítido.
// Tipografía: Sora (títulos) e Inter (texto), OFL 1.1, TTF estático generado por tools/pdf-fonts.py. Si no cargan, Helvetica.
import { quote } from '../data/dimensionar.js';
import { brand, contact } from '../data/site.js';
import soraBold from '../assets/pdf-fonts/Sora-Bold.ttf?url';
import soraXBold from '../assets/pdf-fonts/Sora-ExtraBold.ttf?url';
import interReg from '../assets/pdf-fonts/Inter-Regular.ttf?url';
import interSemi from '../assets/pdf-fonts/Inter-SemiBold.ttf?url';

const FUENTES = [[soraBold, 'Sora', 'bold'], [soraXBold, 'Sora', 'extrabold'], [interReg, 'Inter', 'normal'], [interSemi, 'Inter', 'semibold']];

// colores de src/styles/base.css
const C = {
  navy: [11, 26, 58], orange: [242, 106, 27], orangeInk: [184, 68, 10], amber: [255, 156, 92], gold: [255, 215, 154],
  ink2: [58, 74, 107], line: [214, 220, 232], paper: [244, 246, 251], zebra: [249, 250, 253], tint: [255, 244, 236], white: [255, 255, 255], onNavy: [201, 211, 230],
};

const nf = (n, d = 2) => Number(n).toLocaleString('es-VE', { maximumFractionDigits: d, useGrouping: 'always' });
const usd = (n) => `US$ ${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })}`;
// solo se imprime lo que las fuentes traen (ASCII, latín-1 y puntuación común); lo demás pierde el acento o pasa a "?"
const OK = /[\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u2212\u20ac]/;
const limpia = (s) => [...String(s ?? '').normalize('NFC')].map((c) => { const b = c.normalize('NFD')[0]; return OK.test(c) ? c : OK.test(b) ? b : '?'; }).join('');
// "Inversor X · 3.000 W · 120 V" → título y detalle (los renglones pendientes dicen "· Se confirma en la visita")
const partes = (d) => { const [t, ...r] = String(d).split(' · '); return [t, r.join(' · ')]; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
async function cargarFuentes() {
  return Promise.all(FUENTES.map(async ([url, family, style]) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fuente ${family} ${style}: HTTP ${r.status}`);
    return { file: `${family}-${style}.ttf`, family, style, b64: b64(new Uint8Array(await r.arrayBuffer())) };
  }));
}

// Foto JPG del equipo (public/equipos/<modelo>.jpg, fondo blanco) → { data, w, h } o null. Se pide solo al generar el PDF; si falta (p. ej. el Roccia) o falla, no hay miniatura.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
async function cargarFoto(model) {
  try {
    const r = await fetch(`${BASE}/equipos/${String(model).toLowerCase()}.jpg`);
    if (!r.ok || !/image\/jpe?g/.test(r.headers.get('content-type') || '')) return null;
    const data = `data:image/jpeg;base64,${b64(new Uint8Array(await r.arrayBuffer()))}`;
    const img = new Image(); img.src = data; await img.decode();
    return { data, w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

/**
 * Dibuja el presupuesto q (salida de quote()) y devuelve el jsPDF. `fuentes` = [{ file, family, style, b64 }] o null (Helvetica).
 * `fotos` = [fotoInversor, fotoBatería] ({ data, w, h } o null): miniatura junto a los renglones 1 y 2.
 * Carta, márgenes de 16 mm; si no cabe, sigue en otra hoja con encabezado compacto y la fila de la tabla nunca se corta.
 */
export function armarPresupuesto(JsPDF, fuentes, q, fotos = []) {
  const doc = new JsPDF({ unit: 'mm', format: 'letter', compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16, CW = W - 2 * M, R = W - M;
  fuentes?.forEach((f) => { doc.addFileToVFS(f.file, f.b64); doc.addFont(f.file, f.family, f.style); });
  const FN = fuentes
    ? { logo: ['Sora', 'extrabold'], h: ['Sora', 'bold'], b: ['Inter', 'semibold'], r: ['Inter', 'normal'] }
    : { logo: ['helvetica', 'bold'], h: ['helvetica', 'bold'], b: ['helvetica', 'bold'], r: ['helvetica', 'normal'] };
  const PT = 25.4 / 72;   // mm por punto

  /* ---------- pincel y primitivas ---------- */
  // tracking en em; jsPDF lo escribe en unidades del documento (mm) pero lo mide en puntos: se alinea y se mide a mano
  let CS = 0;
  const use = (f, size, color = C.navy, em = 0) => { doc.setFont(...FN[f]); doc.setFontSize(size); doc.setTextColor(...color); CS = em * size * PT; doc.setCharSpace(CS); };
  const width = (s) => { const t = limpia(s); doc.setCharSpace(0); const w = doc.getTextWidth(t); doc.setCharSpace(CS); return w + CS * [...t].length; };   // con el espacio final
  const put = (s, x, y, o = {}) => {
    const t = limpia(s), vis = width(t) - CS;
    doc.text(t, o.align === 'right' ? x - vis : o.align === 'center' ? x - vis / 2 : x, y);
  };
  const wrap = (s, w) => doc.splitTextToSize(limpia(s), w);
  // mismas líneas que wrap() pero parejas: sin una palabra huérfana en la última
  const wrapEq = (s, w) => {
    const n = wrap(s, w).length;
    if (n < 2) return wrap(s, w);
    let lo = w / 2, hi = w;
    while (hi - lo > 0.5) { const mid = (lo + hi) / 2; if (wrap(s, mid).length <= n) hi = mid; else lo = mid; }
    return wrap(s, hi);
  };
  const fillC = (c) => doc.setFillColor(...c), lineC = (c) => doc.setDrawColor(...c);
  const rect = (x, y, w, h, c, r = 0) => { fillC(c); if (r) doc.roundedRect(x, y, w, h, r, r, 'F'); else doc.rect(x, y, w, h, 'F'); };
  const hair = (x0, y0, x1, y1, c = C.line, w = 0.2) => { lineC(c); doc.setLineWidth(w); doc.line(x0, y0, x1, y1); };
  // relleno con degradado axial de un polígono: el rayo de la marca, naranja → dorado
  let gid = 0;
  const grad = (poly, [x0, y0, x1, y1], stops, opacity = 1) => doc.advancedAPI((d) => {
    const key = `g${++gid}`;
    d.addShadingPattern(key, new d.ShadingPattern('axial', [x0, y0, x1, y1], stops.map(([offset, color]) => ({ offset, color })), opacity < 1 ? new d.GState({ opacity }) : undefined));
    d.moveTo(...poly[0]);
    poly.slice(1).forEach((p) => d.lineTo(...p));
    d.close();
    d.fill({ key, matrix: d.unitMatrix });
  });
  const BRAND = [[0, C.orange], [0.5, C.amber], [1, C.gold]];
  // el rayo: una franja de th mm centrada en la recta (x0,y0)-(x1,y1), con resplandor a ambos lados que se funde con el fondo
  const ray = (x0, y0, x1, y1, th = 1.1, glow = 6) => {
    const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;   // normal hacia abajo
    const band = (up, down) => [[x0, y0 - up], [x1, y1 - up], [x1, y1 + down], [x0, y0 + down]];
    grad(band(glow * 0.8, 0), [x0, y0, x0 - nx * glow * 0.8, y0 - ny * glow * 0.8], [[0, C.orange], [1, C.navy]], 0.8);   // sobre el azul
    grad(band(0, glow), [x0, y0, x0 + nx * glow, y0 + ny * glow], [[0, C.amber], [1, C.white]], 0.6);                    // sobre el papel
    grad(band(th / 2, th / 2), [x0, y0, x1, y1], BRAND);
  };

  // hexágono de la marca (Logo.astro): mitad superior en `a`, inferior en `b`; la S interior con los mismos colores
  const mark = (x, y, s, a, b) => {
    const k = s / 100, P = (v) => v.map((n, i) => (i % 2 ? y : x) + n * k);
    doc.setLineWidth(10 * k); doc.setLineCap('round'); doc.setLineJoin('round');
    const path = (c, segs) => {
      lineC(c);
      const [m, ...rest] = segs;
      doc.moveTo(...P(m));
      rest.forEach((p) => (p.length === 2 ? doc.lineTo(...P(p)) : doc.curveTo(...P(p))));
      doc.stroke();
    };
    path(a, [[14, 71], [14, 29], [50, 8], [86, 29]]);
    path(b, [[86, 29], [86, 71], [50, 92], [14, 71]]);
    path(a, [[66, 32], [38, 32], [34.686, 32, 32, 34.686, 32, 38], [32, 44], [32, 47.314, 34.686, 50, 38, 50], [50, 50]]);
    path(b, [[50, 50], [62, 50], [65.314, 50, 68, 52.686, 68, 56], [68, 62], [68, 65.314, 65.314, 68, 62, 68], [34, 68]]);
  };
  const wordmark = (x, y, size) => {   // SSD&S con el "&" naranja (Logo.astro)
    use('logo', size, C.white); doc.text('SSD', x, y);
    const a = width('SSD'), b = width('&');
    use('logo', size, C.orange); doc.text('&', x + a, y);
    use('logo', size, C.white); doc.text('S', x + a + b, y);
  };

  /* ---------- hojas ---------- */
  const FOOT = 16;                 // alto reservado al pie en cada hoja
  const LIM = () => H - FOOT - 2;  // hasta dónde llega el contenido
  let y = 0;

  function encabezado() {
    const hL = 38, hR = 25;   // la banda se corta en diagonal: el rayo corre por su borde
    fillC(C.navy);
    doc.lines([[W, 0], [0, hR], [-W, hL - hR]], 0, 0, [1, 1], 'F', true);
    ray(0, hL, W, hR);
    mark(M, 8.2, 16, C.orange, C.white);
    const x0 = M + 16 + 4.5;
    wordmark(x0, 17.4, 25);
    use('b', 5.6, C.gold, 0.2); put(brand.tagline.toUpperCase(), x0, 22.2);
    use('h', 9.2, C.white); put(q.empresa.name, R, 9.4, { align: 'right' });
    use('b', 8, C.gold, 0.03); put(`RIF ${q.empresa.rif}`, R, 14, { align: 'right' });
    use('r', 7.6, C.onNavy); put(`${contact.phoneDisplay}  ·  ${contact.email}`, R, 18.3, { align: 'right' });
    put(`Instagram @${contact.instagram}  ·  ${brand.city}, ${brand.region}`, R, 22.2, { align: 'right' });
    return hL;
  }
  function encabezadoCompacto() {
    const hL = 16, hR = 11.5;
    fillC(C.navy);
    doc.lines([[W, 0], [0, hR], [-W, hL - hR]], 0, 0, [1, 1], 'F', true);
    ray(0, hL, W, hR, 0.8, 4);
    mark(M, 3, 8.4, C.orange, C.white);
    wordmark(M + 11.5, 9.2, 13);
    use('b', 8, C.onNavy, 0.04); put(`PRESUPUESTO ${q.numero}  ·  continuación`, R, 8.6, { align: 'right' });
    return hL;
  }
  function pie(p, n) {
    doc.setPage(p);
    const y0 = H - FOOT + 1.4;
    hair(M, y0, R, y0);
    use('r', 6.7, C.ink2);
    put('Presupuesto referencial en USD, sujeto a disponibilidad y a visita técnica. Documento no fiscal.', M, y0 + 4);
    let x = M;
    if (q.provisional) {
      const t = 'Precios de prueba · por confirmar';
      use('b', 6.7, C.orangeInk); put(t, x, y0 + 7.8); x += width(t) + 3;
      if (q.url) { use('r', 6.7, C.ink2); put('·', x, y0 + 7.8); x += 3; }
    }
    if (q.url) {
      const t = 'Abrir esta configuración en el sitio';
      use('b', 6.7, C.orangeInk); doc.textWithLink(limpia(t), x, y0 + 7.8, { url: q.url });
      hair(x, y0 + 8.5, x + width(t), y0 + 8.5, C.orangeInk, 0.12);
    }
    use('r', 6.7, C.ink2); put('Generado en el sitio de SSD&S', R, y0 + 4, { align: 'right' });
    use('b', 6.7, C.navy); put(`${p}/${n}`, R, y0 + 7.8, { align: 'right' });
  }
  function hojaNueva() {
    doc.addPage();
    y = encabezadoCompacto() + 8;
  }

  /* ---------- título, cliente y sistema ---------- */
  y = encabezado() + 13;
  use('logo', 22, C.navy); put(q.titulo, M, y);
  const wT = width(q.titulo);
  grad([[M, y + 2.8], [M + 30, y + 2.8], [M + 30, y + 3.9], [M, y + 3.9]], [M, 0, M + 30, 0], BRAND);
  if (q.provisional) {   // mientras los precios sean de prueba, que se vea arriba y no solo en el pie
    const t = 'PRECIOS DE PRUEBA · POR CONFIRMAR';
    use('b', 5.8, C.orangeInk, 0.14);
    const w = width(t) + 7, x0 = M + wT + 8;
    rect(x0, y - 5.4, w, 5.6, C.tint, 2.8);
    put(t, x0 + 3.5, y - 1.6);
  }
  use('b', 6.2, C.orangeInk, 0.16); put('N.º DE PRESUPUESTO', R, y - 7.4, { align: 'right' });
  use('h', 12, C.navy); put(q.numero, R, y - 1.8, { align: 'right' });
  use('r', 8.6, C.ink2); put(q.fechaTexto, R, y + 3.4, { align: 'right' });
  y += 10;

  const s = q.sistema, kwhUno = s.kwh / s.baterias;
  const sistema = cap(`${/^inversor/i.test(s.inversor) ? s.inversor : `inversor ${s.inversor}`} (${nf(s.kw, 1)} kW) + ${s.baterias} ${s.baterias === 1 ? 'batería' : 'baterías'} de ${nf(kwhUno)} kWh${s.baterias > 1 ? ` (${nf(s.kwh)} kWh en total)` : ''}`);
  const colR = M + 88, padB = 5, xT = M + padB + 1;
  use('h', 10.5, C.navy); const nombre = wrapEq(`Sr(s). ${q.cliente}`, colR - xT - 6);
  use('r', 8.6, C.navy); const sis = wrapEq(sistema, R - colR - padB);
  const hCli = Math.max(padB + 8 + (q.cliente ? nombre.length * 4.6 : 4.6) + 4.2 + 2.2, padB + 8 + sis.length * 4.1 + 1.6);
  rect(M, y, CW, hCli, C.paper, 2.2);
  rect(M, y + 3, 1.1, hCli - 6, C.orange);
  use('b', 6.2, C.orangeInk, 0.16); put('CLIENTE', xT, y + padB + 1.4); put('SISTEMA', colR, y + padB + 1.4);
  const yc = y + padB + 1.4 + 5.6;
  use('h', 10.5, C.navy);
  if (q.cliente) nombre.forEach((l, i) => put(l, xT, yc + i * 4.6));
  else { put('Sr(s).', xT, yc); hair(xT + width('Sr(s). '), yc + 0.6, colR - 8, yc + 0.6, C.ink2, 0.25); }
  use('r', 8, C.ink2); put('Presente.', xT, yc + (q.cliente ? (nombre.length - 1) * 4.6 : 0) + 4.8);
  use('r', 8.6, C.navy); sis.forEach((l, i) => put(l, colR, yc - 0.6 + i * 4.1));
  y += hCli + 7;

  /* ---------- tabla ---------- */
  const dW = CW - 90, pad = 3, LH1 = 4.3, LH2 = 3.75, PADY = 2.5;
  const cx = { item: M, desc: M + 11, und: M + 11 + dW, cant: M + 23 + dW, pre: M + 35 + dW };   // columnas: 11 · resto · 12 · 12 · 27 · 28
  function cabeceraTabla() {
    rect(M, y, CW, 7.4, C.navy, 1.6);
    use('b', 6.6, C.white, 0.12);
    const ty = y + 4.75;
    put('ÍTEM', cx.item + 5.5, ty, { align: 'center' }); put('DESCRIPCIÓN', cx.desc + pad, ty);
    put('UND', cx.und + 6, ty, { align: 'center' }); put('CANT', cx.cant + 6, ty, { align: 'center' });
    put('PRECIO', cx.pre + 27 - pad, ty, { align: 'right' }); put('TOTAL', R - pad, ty, { align: 'right' });
    y += 7.4;
  }
  cabeceraTabla();
  const cuerpo = [];   // { h, dibuja(y0) }: se mide antes de dibujar para no cortar una fila entre hojas
  q.lines.forEach((l, i) => {
    const [titulo, detalle] = partes(l.desc), pend = l.precio == null, foto = fotos[i] || (i === 0 && fotos[1] ? { icono: true } : null), TH = foto ? 16 : 0, tx0 = cx.desc + pad + (foto ? TH + 3 : 0);
    use('b', 8.8); const tl = wrap(titulo, dW - 2 * pad - (foto ? TH + 3 : 0));
    use('r', 7.9); const dl = detalle ? wrap(detalle, dW - 2 * pad - (foto ? TH + 3 : 0)) : [];
    const hT = PADY * 2 + tl.length * LH1 + dl.length * LH2 + (dl.length ? 0.5 : 0), h = Math.max(hT, foto ? TH + 2 * PADY : 0);
    cuerpo.push({ h, zebra: i % 2 === 1, dibuja(y0) {
      const by = y0 + PADY + 3.1 + (h - hT) / 2;
      use('h', 9, C.orange); put(String(l.n), cx.item + 5.5, by, { align: 'center' });
      if (foto) {   // tarjeta blanca con la foto centrada y en proporción
        const fy = y0 + (h - TH) / 2, k = Math.min((TH - 2) / foto.w, (TH - 2) / foto.h), iw = foto.w * k, ih = foto.h * k;
        rect(cx.desc + pad, fy, TH, TH, C.white, 1.6); lineC(C.line); doc.setLineWidth(0.2); doc.roundedRect(cx.desc + pad, fy, TH, TH, 1.6, 1.6, 'S');
        if (foto.icono) {   // sin foto (p. ej. Roccia): silueta sobria de inversor de pared con pantalla, para que la columna no quede coja
          const bx = cx.desc + pad + (TH - 7.6) / 2, by0 = fy + 1.6;
          rect(bx, by0, 7.6, 12.8, C.paper, 1.2); lineC(C.ink2); doc.setLineWidth(0.25); doc.roundedRect(bx, by0, 7.6, 12.8, 1.2, 1.2, 'S');
          rect(bx + 1.3, by0 + 1.6, 5, 3.4, C.navy, 0.5); rect(bx + 1.3, by0 + 6.4, 5, 0.5, C.orange); rect(bx + 1.3, by0 + 7.6, 3, 0.5, C.line);
          fillC(C.orange); doc.circle(bx + 3.8, by0 + 10.7, 0.6, 'F');
        } else doc.addImage(foto.data, 'JPEG', cx.desc + pad + (TH - iw) / 2, fy + (TH - ih) / 2, iw, ih);
      }
      use('b', 8.8); tl.forEach((t, k) => put(t, tx0, by + k * LH1));
      use('r', 7.9, pend ? C.orangeInk : C.ink2); dl.forEach((t, k) => put(t, tx0, by + tl.length * LH1 - 0.2 + k * LH2));
      use('b', 7.6, C.ink2, 0.06); put(l.und, cx.und + 6, by, { align: 'center' });
      use('r', 8.8); put(String(l.cant), cx.cant + 6, by, { align: 'center' });
      if (pend) { use('r', 7.2, C.orangeInk); put('Por confirmar', R - pad, by, { align: 'right' }); }
      else { use('r', 8.8); put(usd(l.precio), cx.pre + 27 - pad, by, { align: 'right' }); use('b', 8.8); put(usd(l.total), R - pad, by, { align: 'right' }); }
    } });
  });
  // notas dentro de la tabla: la de autonomía en negrita, centrada y sobre fondo cálido, como el original; luego equipos y el resto
  const [aut, ...resto] = q.notas, eq = resto.find((n) => /^Equipos considerados/.test(n)), otras = resto.filter((n) => n !== eq);
  const nota = (texto, f, size, color, bg) => {
    use(f, size, color); const ls = wrapEq(texto, CW - 24), lh = size * PT * 1.42, h = 2 * 2.1 + ls.length * lh;
    cuerpo.push({ h, bg, dibuja(y0) {
      use(f, size, color);
      ls.forEach((t, k) => put(t, M + CW / 2, y0 + 2.1 + size * PT * 0.84 + k * lh, { align: 'center' }));
    } });
  };
  if (aut) nota(`Nota: ${aut}`, 'b', 8.8, C.navy, C.tint);
  if (eq) nota(eq.replace(/^([^:]+: )(.*)$/, (_, a, b) => a + b.split(', ').map((x) => x.replace(/ /g, '\u00a0')).join(', ')), 'r', 8, C.ink2);
  otras.forEach((t) => nota(t, 'r', 7.8, C.ink2));

  cuerpo.forEach((r) => {
    if (y + r.h > LIM()) { hojaNueva(); cabeceraTabla(); }
    if (r.bg) rect(M, y, CW, r.h, r.bg); else if (r.zebra) rect(M, y, CW, r.h, C.zebra);
    r.dibuja(y);
    hair(M, y + r.h, R, y + r.h);
    y += r.h;
  });
  hair(M, y, R, y, C.navy, 0.45);
  y += 6;

  /* ---------- cierre: garantías y forma de pago a la izquierda, totales a la derecha ---------- */
  const tarjeta = (x0, y0, w, h) => { rect(x0, y0, w, h, C.white, 2.2); lineC(C.line); doc.setLineWidth(0.25); doc.roundedRect(x0, y0, w, h, 2.2, 2.2, 'S'); rect(x0, y0 + 3, 1.1, h - 6, C.orange); };
  const TW = 78, LW = CW - TW - 6, G = q.garantias;
  use('r', 8.4); const pago = wrap(q.pagos, LW - 12);
  const hG = 5.4 + 2.4 + G.length * 4.5 + 1.8, hP = 5.4 + 2.2 + pago.length * 4.2 + 2.6, hLeft = hG + 3.5 + hP, hClose = Math.max(hLeft, 38);
  if (y + hClose > LIM()) hojaNueva();
  tarjeta(M, y, LW, hG);
  use('b', 6.2, C.orangeInk, 0.16); put('GARANTÍAS', M + 6, y + 5.4);
  if (q.provisional) { const x = M + 6 + width('GARANTÍAS') + 3; use('r', 6.2, C.ink2, 0.1); put('POR CONFIRMAR', x, y + 5.4); }
  use('r', 8.4, C.navy);
  G.forEach((g, i) => { const gy = y + 5.4 + 5.6 + i * 4.5; fillC(C.orange); doc.circle(M + 6.7, gy - 1, 0.7, 'F'); put(g, M + 9.6, gy); });
  const yP = y + hG + 3.5;
  tarjeta(M, yP, LW, hP);
  use('b', 6.2, C.orangeInk, 0.16); put('FORMAS DE PAGO', M + 6, yP + 5.4);
  use('r', 8.4, C.navy); pago.forEach((t, k) => put(t, M + 6, yP + 5.4 + 5.4 + k * 4.2));
  // totales: el TOTAL en naranja grande sobre azul
  const tx = R - TW, nIncompleto = q.incompleto ? 6.5 : 0, hB = hClose - 22 - nIncompleto;
  use('b', 6.6, C.ink2, 0.16); put('SUBTOTAL', tx + 4, y + 6.8); put('ABONO', tx + 4, y + 16.2);
  use('b', 9.5, C.navy); put(usd(q.subtotal), R - 4, y + 6.8, { align: 'right' });
  use('b', 9.5, C.ink2); put(q.abono ? usd(q.abono) : '–', R - 4, y + 16.2, { align: 'right' });
  hair(tx, y + 10.6, R, y + 10.6); hair(tx, y + 20, R, y + 20);
  rect(tx, y + 22, TW, hB, C.navy, 2.2);
  grad([[tx + 5, y + 22], [R - 5, y + 22], [R - 5, y + 22.7], [tx + 5, y + 22.7]], [tx, 0, R, 0], BRAND);
  const ty = y + 22 + hB / 2 + 2.3;
  use('b', 7, C.white, 0.22); put('TOTAL', tx + 5, ty - 0.6);
  use('logo', 17, C.orange); put(usd(q.total), R - 5, ty + 0.6, { align: 'right' });
  if (q.incompleto) { use('r', 7, C.orangeInk); put('El total no incluye los renglones por confirmar en la visita.', R, y + 22 + hB + 4.6, { align: 'right' }); }
  y += hClose;

  /* ---------- pies, metadatos ---------- */
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) pie(p, n);
  doc.setPage(1);
  doc.setProperties({ title: `Presupuesto ${q.numero}`, subject: 'Presupuesto referencial de respaldo con inversor y baterias', author: q.empresa.name, creator: 'Sitio de SSD&S' });
  doc.setLanguage('es');
  doc.viewerPreferences({ DisplayDocTitle: true });
  return doc;
}

/**
 * Arma el presupuesto de la opción elegida y lo descarga como "Presupuesto-SSDS-<numero>.pdf".
 * state = lo que devuelve document.getElementById('dimensionar').dzState(); cliente = nombre opcional (una línea, máx. 60).
 */
export async function descargarPresupuesto(state, { cliente = '' } = {}) {
  const q = quote(state.answers, { tier: state.tier, cliente, url: state.url });
  if (!q) throw new Error('No hay una opción para presupuestar.');
  const fuentes = cargarFuentes().catch((e) => { console.warn('Presupuesto PDF: sin fuentes de marca, se usa Helvetica.', e); return null; });
  const fotos = Promise.all([state.option?.inverter?.model, state.option?.batteries?.model].map((m) => (m ? cargarFoto(m) : null)));
  const [{ jsPDF }, f, ph] = await Promise.all([import('jspdf'), fuentes, fotos]);
  armarPresupuesto(jsPDF, f, q, ph).save(`Presupuesto-SSDS-${q.numero}.pdf`);
  return q;
}
