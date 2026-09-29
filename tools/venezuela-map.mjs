// Generates src/data/venezuela.js: Venezuela's silhouette (Natural Earth 1:50m via world-atlas) as one SVG path,
// plus projected points for the illustrative routes (from Maracay) and every state capital.
// Run once: node tools/venezuela-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const root = new URL('../', import.meta.url);
const topo = JSON.parse(readFileSync(new URL('node_modules/world-atlas/countries-50m.json', root), 'utf8'));
const ve = feature(topo, topo.objects.countries.geometries.find((g) => g.id === '862'));

// equirectangular, x shrunk by cos(7°) (the country's mid latitude)
const COS = Math.cos((7 * Math.PI) / 180);
const LON0 = -73.6, LAT0 = 12.9, K = 72; // px per degree of latitude
const PAD_B = 16;
const px = (lon) => (lon - LON0) * COS * K;
const py = (lat) => (LAT0 - lat) * K;
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (lat, lon) => ({ x: r1(px(lon)), y: r1(py(lat)) });
const ringD = (ring) => 'M' + ring.map(([lon, lat]) => `${r1(px(lon))} ${r1(py(lat))}`).join('L') + 'Z';

// Zona en Reclamación (Guayana Esequiba): the territory west of the Esequibo river, drawn hatched as Venezuelan
// cartography requires. Natural Earth has no rivers here, so the course is hand-traced from reference points
// (estuary, Bartica, Rockstone, Kurupukari, Apoteri, Gunn's, source at the Brazil border): approximate, ±0.15°.
// The page clips Guyana's silhouette with it (SVG clipPath), so no polygon maths here.
const ESEQUIBO = [ // [lat, lon], mouth → source
  [6.95, -58.47], [6.85, -58.5], [6.7, -58.57], [6.5, -58.61], [6.4, -58.62], [6.2, -58.6], [5.98, -58.55], [5.6, -58.5],
  [5.2, -58.55], [4.9, -58.62], [4.67, -58.67], [4.35, -58.64], [4.03, -58.58], [3.6, -58.36], [3.1, -58.22], [2.6, -58.18],
  [2.3, -58.25], [2.0, -58.4], [1.65, -58.6], [1.35, -58.72], [1.2, -58.8],
];
const river = ESEQUIBO.map(([lat, lon]) => [lon, lat]);
const gy = feature(topo, topo.objects.countries.geometries.find((g) => g.id === '328')).geometry;
const zone = {
  path: (gy.type === 'Polygon' ? [gy.coordinates] : gy.coordinates).map((p) => ringD(p[0])).join(''),
  // the river, extended north into the sea and south past the border, closed far to the west
  clip: ringD([[-58.47, 9.4], ...river, [-58.8, 0.6], [-63, 0.6], [-63, 9.4]]),
  river: ringD(river).slice(0, -1),
  label: pt(5.5, -59.7),
};

// polygons: drop far offshore islets (Isla de Aves, 15.7°N) so the frame stays on the mainland
const polys = ve.geometry.coordinates.filter((poly) => poly[0].every(([, lat]) => lat < 12.6));

let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
const rings = [];
for (const poly of polys) {
  // 1:50m is already light (~570 points): no simplification needed
  const ring = poly[0].map(([lon, lat]) => [px(lon), py(lat)]);
  rings.push(ring);
  for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
}
const W = Math.ceil(Math.max(maxX, ...river.map(([lon]) => px(lon))) + 14), H = Math.ceil(maxY + PAD_B);
const path = rings
  .map((ring) => 'M' + ring.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z')
  .join('');

// a gentle arc from Maracay to (x, y): control point pushed perpendicular (to the north side) by 18% of the length
const O = { lat: 10.2469, lon: -67.5958 };
const ox = px(O.lon), oy = py(O.lat);
const arc = (x, y) => {
  const dx = x - ox, dy = y - oy, len = Math.hypot(dx, dy);
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; } // always bow northwards (towards the Caribbean)
  const k = Math.min(0.22, 0.12 + 40 / len) * len;
  const cx = ox + dx / 2 + nx * k, cy = oy + dy / 2 + ny * k;
  return `M${r1(ox)} ${r1(oy)}Q${r1(cx)} ${r1(cy)} ${r1(x)} ${r1(y)}`;
};

// illustrative route targets (label side: r | l | t | b), in the order the routes light up
const routeCities = [
  ['Valencia', 'Carabobo', 10.162, -68.0077, 'b'],
  ['Caracas', 'Distrito Capital', 10.4806, -66.9036, 't'],
  ['Barquisimeto', 'Lara', 10.0678, -69.3474, 'l'],
  ['San Fernando de Apure', 'Apure', 7.8878, -67.4724, 'r'],
  ['Barcelona', 'Anzoátegui', 10.1667, -64.6667, 'b'],
  ['Maracaibo', 'Zulia', 10.6545, -71.6406, 't'],
  ['Porlamar', 'Nueva Esparta', 10.9577, -63.8697, 'r'],
  ['Maturín', 'Monagas', 9.7457, -63.1832, 'r'],
  ['San Cristóbal', 'Táchira', 7.7669, -72.225, 'r'],
  ['Ciudad Guayana', 'Bolívar', 8.3, -62.7, 'r'], // 'r': a label below ran into San Fernando de Apure's
  ['Puerto Ayacucho', 'Amazonas', 5.6639, -67.6236, 'r'],
];
const cities = [
  { name: 'Maracay', state: 'Aragua', ...pt(O.lat, O.lon), origin: true },
  ...routeCities.map(([name, state, lat, lon, label]) => { const p = pt(lat, lon); return { name, state, ...p, label, d: arc(p.x, p.y) }; }),
];

// the 23 states + Distrito Capital, each with its capital (the "23 estados" network and the state picker)
const stateCapitals = [
  ['Amazonas', 'Puerto Ayacucho', 5.6639, -67.6236],
  ['Anzoátegui', 'Barcelona', 10.1333, -64.6833],
  ['Apure', 'San Fernando de Apure', 7.8878, -67.4724],
  ['Aragua', 'Maracay', 10.2469, -67.5958],
  ['Barinas', 'Barinas', 8.6226, -70.2075],
  ['Bolívar', 'Ciudad Bolívar', 8.1222, -63.5497],
  ['Carabobo', 'Valencia', 10.162, -68.0077],
  ['Cojedes', 'San Carlos', 9.6617, -68.5825],
  ['Delta Amacuro', 'Tucupita', 9.0581, -62.0497],
  ['Falcón', 'Coro', 11.4045, -69.6734],
  ['Guárico', 'San Juan de los Morros', 9.9115, -67.3538],
  ['La Guaira', 'La Guaira', 10.6003, -66.9331],
  ['Lara', 'Barquisimeto', 10.0678, -69.3474],
  ['Mérida', 'Mérida', 8.5897, -71.1561],
  ['Miranda', 'Los Teques', 10.3441, -67.0433],
  ['Monagas', 'Maturín', 9.7457, -63.1832],
  ['Nueva Esparta', 'La Asunción', 11.0333, -63.8628],
  ['Portuguesa', 'Guanare', 9.0418, -69.7421],
  ['Sucre', 'Cumaná', 10.4564, -64.1675],
  ['Táchira', 'San Cristóbal', 7.7669, -72.225],
  ['Trujillo', 'Trujillo', 9.3667, -70.4333],
  ['Yaracuy', 'San Felipe', 10.3399, -68.7425],
  ['Zulia', 'Maracaibo', 10.6545, -71.6406],
  ['Distrito Capital', 'Caracas', 10.4806, -66.9036],
];
const states = stateCapitals.map(([state, capital, lat, lon]) => {
  const p = pt(lat, lon);
  return { state, capital, ...p, d: state === 'Aragua' ? '' : arc(p.x, p.y) };
});

// faint graticule every 2°
const lats = [2, 4, 6, 8, 10, 12].map((v) => ({ v, y: r1(py(v)) }));
const lons = [-72, -70, -68, -66, -64, -62, -60, -58].map((v) => ({ v, x: r1(px(v)) })).filter((l) => l.x > 0 && l.x < W);

const out = `// GENERATED by tools/venezuela-map.mjs from Natural Earth 1:50m (world-atlas). Do not edit by hand.
// Equirectangular projection, x scaled by cos(7°). Units: SVG px in viewBox.
export const viewBox = '0 0 ${W} ${H}';
export const width = ${W};
export const height = ${H};
export const path = '${path}';
export const cities = ${JSON.stringify(cities)};
export const states = ${JSON.stringify(states)};
// Zona en Reclamación: Guyana's silhouette (path) clipped west of the Esequibo (clip), the river as the boundary line
export const zone = ${JSON.stringify(zone)};
export const graticule =${JSON.stringify({ lats, lons })};
// inverse projection for the pointer read-out: lon = lon0 + x / (k * cos), lat = lat0 - y / k
export const projection = ${JSON.stringify({ lon0: LON0, lat0: LAT0, k: K, cos: +COS.toFixed(6) })};
`;
writeFileSync(new URL('src/data/venezuela.js', root), out);
console.log(`venezuela.js: ${(out.length / 1024).toFixed(1)} KB, viewBox 0 0 ${W} ${H}, ${rings.length} rings, ${rings.reduce((a, r) => a + r.length, 0)} points`);
