// Self-check for the Diagnóstico rules. Run: node src/data/diagnostico.check.mjs
import assert from 'node:assert/strict';
import { recommend, questions, zoneOf } from './diagnostico.js';
import { services } from './site.js';

const slugs = (r) => r.services.map((s) => s.slug);
const reasonOf = (r, slug) => r.services.find((s) => s.slug === slug)?.reason || '';
const valid = new Set(services.map((s) => s.slug));

// empty / partial answers: no crash, no services, needle at 0
const empty = recommend();
assert.deepEqual(empty.services, []);
assert.equal(empty.priority, 0);
assert.equal(empty.ats, false);

// residential backup without a plant → Respaldo with plant + ATS, baja tensión hint
const a = recommend({ lugar: 'residencial', necesidad: ['respaldo'], planta: 'no', tamano: 'residencia' });
assert.deepEqual(slugs(a), ['respaldo-energetico']);
assert.match(reasonOf(a, 'respaldo-energetico'), /ATS/);
assert.equal(a.ats, true);
assert.match(a.hints[0], /^Orientativo: .*baja tensión.*inspección/);

// manual transfer always flags the ATS, even when the need is something else
const b = recommend({ lugar: 'comercial', necesidad: ['clima'], planta: 'manual', tamano: 'comercio' });
assert.deepEqual(slugs(b), ['climatizacion', 'respaldo-energetico']);
assert.match(reasonOf(b, 'respaldo-energetico'), /manual.*ATS/s);
assert.equal(b.ats, true);
assert.match(b.hints[0], /^Orientativo: .*media tensión/);

// plant already on ATS + maintenance → one Respaldo entry (reasons merged), no ATS sale, consumables hint
const c = recommend({ lugar: 'industrial', necesidad: ['respaldo', 'mantenimiento'], planta: 'ats', tamano: 'industria' });
assert.deepEqual(slugs(c), ['respaldo-energetico']);
assert.match(reasonOf(c, 'respaldo-energetico'), /banco de carga/);
assert.equal(c.ats, false);
assert.ok(c.hints.some((h) => /^Orientativo: .*evalúa media tensión/.test(h)));
assert.ok(c.hints.some((h) => /modelo de tu planta/.test(h)));

// red + inspección → Potencia only once; "no lo sé" adds its hint
const d = recommend({ lugar: 'industrial', necesidad: ['red', 'inspeccion'], planta: 'nose', tamano: 'industria' });
assert.deepEqual(slugs(d), ['potencia-electrica']);
assert.match(reasonOf(d, 'potencia-electrica'), /media y baja tensión.*Inspección/s);
assert.ok(d.hints.some((h) => /no sabes qué transferencia/.test(h)));

// every need maps to a real service slug; every tension hint is explicitly orientative
for (const o of questions[1].options) {
  const r = recommend({ necesidad: [o.v] });
  assert.ok(r.services.length > 0, `need ${o.v} → a service`);
  r.services.forEach((s) => assert.ok(valid.has(s.slug), s.slug));
}
for (const o of questions[3].options) assert.match(recommend({ tamano: o.v }).hints[0], /^Orientativo: .*lo confirmamos con una inspección/);

// priority: bounded, monotonic-ish across the extremes, zones
const low = recommend({ lugar: 'residencial', necesidad: ['clima'], planta: 'ats', tamano: 'residencia' }).priority;
const all = recommend({ lugar: 'industrial', necesidad: questions[1].options.map((o) => o.v), planta: 'manual', tamano: 'industria' });
assert.ok(low < 40, `low ${low}`);
assert.equal(all.priority, 100);
assert.equal(zoneOf(low), 'Programable');
assert.equal(zoneOf(55), 'Recomendado');
assert.equal(zoneOf(100), 'Prioritario');

// message carries every answer (labels as shown), the suggested services and the ATS line
for (const r of [a, b, c, d]) assert.match(r.message, /^Hola SSD&S/);
assert.match(b.message, /Instalación: Comercial/);
assert.match(b.message, /Necesito: Aire acondicionado, chillers o unidades de precisión/);
assert.match(b.message, /Planta eléctrica: Sí, con transferencia manual/);
assert.match(b.message, /Tamaño de la operación: Comercio, oficinas o sala de cómputo/);
assert.match(b.message, /Servicios sugeridos: Climatización y Respaldo energético\./);
assert.match(b.message, /tablero de transferencia automática \(ATS\)/);
assert.match(all.message, /Respaldo ante cortes \(planta eléctrica \/ ATS\); Red eléctrica o transformador \(media \/ baja tensión\)/);
assert.doesNotMatch(c.message, /Me interesa evaluar un tablero/);

console.log('diagnostico.check: ok');
