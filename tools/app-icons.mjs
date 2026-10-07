// Íconos de la app /app/ (PWA del cotizador) a partir de public/favicon.svg. Se corre a mano y los PNG se versionan: npm run icons
// iOS exige el apple-touch-icon opaco (sin esquinas transparentes) y le pone él mismo el redondeo; el maskable lleva margen para el recorte de Android.
import { readFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const square = svg.replace('rx="20"', 'rx="0"');                                  // fondo azul a sangre, sin esquinas
const padded = square.replace('viewBox="0 0 100 100"', 'viewBox="-8 -8 116 116"'); // el rayo y el hexágono a ~86 %: dentro de la zona segura del maskable
const out = new URL('../public/app/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [file, src, px] of [['apple-touch-icon-180.png', square, 180], ['icon-192.png', square, 192], ['icon-512.png', square, 512], ['icon-maskable-512.png', padded, 512]]) {
  await sharp(Buffer.from(src), { density: 384 }).resize(px, px).flatten({ background: '#0b1a3a' }).png({ compressionLevel: 9 }).toFile(new URL(file, out).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  console.log('listo', file);
}
