// Self-check for the Dimensionador (reglas, precios del dueño, presupuesto en PDF). Run: node src/data/dimensionar.check.mjs
// (add --table to print the 19 real quotes next to Recomendada / Básica / Holgada). Los [NN] son números de la carpeta de análisis
// de presupuestos reales: nunca nombres de clientes ni costos de distribuidor; aquí solo precios de venta.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { K, OPENING, loads, presets, inverters, batteries, panel, pricing, size, clean, pickBatteries, encodeState, decodeState, fmtUSD, fmtUSD2, quote, validezTxt } from './dimensionar.js';

const inv = (m) => inverters.find((i) => i.model === m);
const bat = (m) => batteries.find((b) => b.model === m);
const rec = (r) => r.options.find((o) => o.tier === 'recomendado');
const opt = (r, t) => r.options.find((o) => o.tier === t);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const noNaN = (v, path = 'r') => {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), `${path} = ${v}`);
  else if (typeof v === 'string') assert.ok(!/NaN|undefined|\[object|null/.test(v), `${path} = ${v}`);
  else if (Array.isArray(v)) v.forEach((x, i) => noNaN(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'inverter' && k !== 'precio' && k !== 'total' && noNaN(x, `${path}.${k}`));
};
const seen = [];
const run = (a) => {
  const r = size(a); noNaN({ ...r, outOfScope: r.outOfScope && { ...r.outOfScope } }); seen.push(r); r.__a = a;
  assert.ok(r.message.startsWith(OPENING.slice(0, -1)), r.message.slice(0, 60)); assert.ok(r.message.length < 1200, `message ${r.message.length}`); assert.ok(r.message.isWellFormed());
  return r;
};
const withPricing = (patch, fn) => { const old = { ...pricing }; Object.assign(pricing, patch); try { return fn(); } finally { Object.assign(pricing, old); } };
const withK = (patch, fn) => { const old = { ...K }; Object.assign(K, patch); try { return fn(); } finally { Object.assign(K, old); } };
const energyH = (r, o) => (r.whResp + o.inverter.idleW * (r.whResp / r.avgW)) / (K.eta * K.chargeEta) / (o.inverter.busV * Math.min(o.inverter.gridChargeA, o.batteries.n * bat(o.batteries.model).iCont));
const REAL = () => K.dod * K.eta;
const NEV = loads.find((l) => l.id === 'nevera').w;   // 230 W desde el 5 oct 2026 (David: "como mínimo en 230"); los números de abajo se derivan de él, no de un 150 fijo
const NEVD = loads.find((l) => l.id === 'nevera').duty;   // 1: la nevera cuenta todo el tiempo (David)
const BOMBA05 = loads.find((l) => l.id === 'bomba05').w;   // ½ HP = 373 W
const BOMBA1 = loads.find((l) => l.id === 'bomba1').w;   // 1 HP = 746 W

// ── catálogo: precios de venta del dueño ──
for (const i of inverters) assert.ok(i.priceEq > 0 && i.kSurge > 0 && i.gridChargeA > 0 && i.idleW > 0 && i.pv.maxPanels >= i.pv.minSeries, i.model);
assert.deepEqual(inverters.filter((i) => i.available).map((i) => [i.model, i.priceEq]), [['IVEM1612-LV', 400], ['IVCM2024-LV', 400], ['IVEM3048-LV', 495], ['ROCCIA-6K-120/220', 990], ['IVGM8KLP2G1', 1950]]);
assert.equal(inv('IVEM5048-LV').available, false, 'el dueño nunca lo cotizó (0 de 22)');
assert.deepEqual(inverters.filter((i) => i.ac.includes('240')).map((i) => i.model), ['ROCCIA-6K-120/220', 'IVGM8KLP2G1']);
assert.equal(inv('ROCCIA-6K-120/220').kw, 6); assert.equal(inv('ROCCIA-6K-120/220').busV, 48);
for (const b of batteries) { assert.ok(b.maxParallel === 15 && b.iCont > 0 && b.ah > 0, b.model); if (b.available) assert.ok(b.priceEq > 0 && b.i15s >= b.iCont && ['ficha', 'supuesto'].includes(b.i15sSource) || b.model === 'FLA48230-EU', b.model); }
assert.deepEqual(batteries.filter((b) => b.available).map((b) => [b.model, b.priceEq, b.kwh]), [['FLA12280-EU', 780, 3.58], ['FLA12171-EU', 650, 2.19], ['FLA24100PG2', 700, 2.56], ['FLA48100-EU', 1200, 5.12], ['FLA48230-EU', 2150, 11.78], ['FLA48314-EU', 3315, 16.08], ['FLA48460TG2-EU', 4950, 23.55]]);
assert.deepEqual(bat('FLA48230-EU').onlyWith, ['roccia'], '6 de 6 ventas de la FLA48230 van con el Roccia');
assert.equal(bat('FLA12280-EU').kwh, 3.58, 'V × Ah reales, no los 2,56 kWh de la plantilla del dueño');
for (const b of batteries) assert.ok(Math.abs(b.kwh - (b.busV * (16 / 15) * b.ah) / 1000) < 0.06, `${b.model}: kWh = V nominal LiFePO4 (12,8 / 25,6 / 51,2) × Ah`);
for (const m of ['FLA24230-EU', 'FLA12100', 'FLA48171-EU', 'FLA48280-EU', 'FLA48100UG1']) assert.equal(bat(m).available, false, m);
assert.equal(panel.price, null); assert.equal(panel.available, false); assert.equal(pricing.panelUsd, null);
assert.deepEqual([K.dod, K.eta, K.margin, K.recMargin, K.quoteFactor, K.quoteSlack, K.psh, K.panelW], [0.9, 0.9, 1.25, 1.75, 1.0, 0.98, 4.8, 580]);
assert.ok(inv('IVGM8KLP2G1').gridChargeA * 51.2 <= 8800, 'IVGM8K: la red entrega 8.800 W, no 190 A × 51,2 V');
assert.equal(inv('IVGM8KLP2G1').pv.minSeries, 6); assert.equal(inv('IVEM3048-LV').pv.minSeries, 3);
assert.ok(loads.length >= 20 && loads.find((l) => l.id === 'otro'));
assert.ok(new Set(loads.map((l) => l.id)).size === loads.length, 'ids únicos');
for (const l of loads) assert.ok(l.w > 0 && l.surge >= 1 && l.duty > 0 && l.duty <= 1 && l.hUse > 0 && [false, 'ask', true].includes(l.v220) && l.s && l.icon, l.id);
for (const l of loads.filter((x) => x.engineer)) assert.ok(l.reason, l.id);
for (const id of ['aa18c', 'aa24c']) assert.ok(loads.find((l) => l.id === id).softStart && loads.find((l) => l.id === id).surge >= 5, id);
for (const p of presets) for (const id of Object.keys(p.items)) assert.ok(loads.find((l) => l.id === id), `${p.id}.${id}`);
assert.equal(OPENING, 'Hola SSD&S, dimensioné mi respaldo en su web.');
// pricing: instalación por tramo (kit + mano de obra), una vez por sistema; todo provisional
assert.equal(pricing.provisional, true); assert.equal(pricing.installMode, 'tier'); assert.equal(pricing.installConfirmed, true); assert.equal(pricing.showModel, true);
assert.deepEqual(Object.fromEntries(Object.entries(pricing.install).map(([k, t]) => [k, [t.kit, t.mo, t.kitType, t.range]])), {
  ivcm: [450, 350, 'transferencia', [800, 800]], ivem3: [450, 450, 'transferencia', [900, 900]], roccia: [500, 350, 'cargas', [850, 1000]], ivgm8: [500, 500, 'cargas', [1000, 1200]] });
for (const [k, t] of Object.entries(pricing.install)) { assert.ok(t.kit + t.mo >= t.range[0] && t.kit + t.mo <= t.range[1], `${k}: el valor por defecto cae dentro del rango`); assert.ok(pricing.kitDesc[t.kitType] && pricing.laborDesc[t.kitType], k); }
for (const i of inverters.filter((x) => x.available)) assert.ok(pricing.install[i.tier], `todo inversor vendido tiene tramo de instalación: ${i.model}`);
assert.deepEqual([pricing.basicKitM, pricing.cablePerM, pricing.laborOnly, pricing.transferKit, pricing.validityDays], [2, null, null, null, 3]);
assert.equal(pricing.company.name, 'SERVICIOS Y SUMINISTROS D&S, C.A.'); assert.equal(pricing.company.rif, 'J-40625203-4');
assert.equal(pricing.warranty.length, 4); assert.ok(pricing.warranty.every((w) => /^Garantía /.test(w)));
assert.match(pricing.payment, /^Pagos a realizar por Zelle, efectivo o Binance/);

// ── answers vacíos / parciales / sucios: sin NaN, sin throw, sin opciones, mensaje útil ──
for (const a of [undefined, null, {}, { items: { nevera: 'x', foo: 3, led: -5 }, hours: 'abc', custom: 'nope', v220: null }, { hours: 99, place: 'nave', install: 'gratis' },
  { items: { constructor: 1, toString: 1, __proto__: 1 }, place: 'constructor', transfer: 'valueOf', install: 'constructor' }, { items: { otro: 3 }, hours: 4 }, { items: [1, 2], custom: [null, 5, 'x'], v220: [true] }]) {
  const r = run(a);
  assert.deepEqual(r.options, []); assert.equal(r.contW, 0); assert.equal(r.outOfScope, null); assert.equal(r.plant, false); assert.equal(r.chosen, null);
  assert.match(r.hints[0], /Marca al menos un equipo/);
  assert.doesNotMatch(r.message, /Lugar|transferencia|\[native code\]|Opción|Precio/);
  assert.equal(quote(a), null, 'sin equipos no hay presupuesto');
}
assert.equal(encodeState(null), 'e30'); assert.equal(encodeState(undefined), 'e30');
assert.doesNotThrow(() => size(decodeState('%%%'))); assert.equal(size(decodeState('%%%')).contW, 0);
const dirty = run({ items: { tv: 99, led: 2.7 }, custom: [{ t: 'Horno', w: 'x' }, { t: 'Bomba de pozo', w: 500, n: 2 }, { w: 50, n: 0 }], hours: 7.5 });
assert.equal(dirty.contW, 20 * 80 + 3 * 10 + 1000);   // tv clamped to 20, led rounded to 3, custom 500×2 counts as base (24 h)
assert.ok(dirty.options.length >= 1);
assert.match(dirty.message, /Bomba de pozo 500 W ×2/);   // nombre tal cual + vatios, para que David no repregunte
const Bitems = { nevera: 1, aa12c: 1, tv: 1, router: 1, led: 8, ventilador: 1, cargador: 2 };
for (const h of [undefined, null, '', ' ', false, [], 'abc', {}]) assert.equal(run({ items: Bitems, hours: h }).whResp, size({ items: Bitems, hours: 8 }).whResp, `hours ${JSON.stringify(h)}`);   // hours ausente/vacío → 8 h (no 1 h)
assert.equal(run({ items: { nevera: null, tv: 1 }, hours: 4 }).contW, 80);
assert.equal(run({ items: { constructor: 2, nevera: 1 } }).contW, NEV); assert.equal(run({ items: { nevera: 1, otro: 3 } }).contW, NEV);   // ids heredados e 'otro' en items se ignoran
// texto libre: una sola línea, sin cortar emojis, sin viñetas inventadas, sin romper wa()
const emoji = run({ custom: [{ t: 'a'.repeat(39) + '🙂', w: 100, n: 1 }], hours: 4, city: 'b'.repeat(39) + '🙂' });
assert.doesNotThrow(() => encodeURIComponent(emoji.message)); assert.ok(decodeState(encodeState({ city: 'b'.repeat(39) + '🙂' })).city.isWellFormed());
const inj = run({ items: { nevera: 1 }, hours: 4, city: 'Turmero\n• Lugar: Palacio', custom: [{ t: 'Horno\n• Precio referencial: US$ 1', w: 100, n: 1 }] });
assert.equal(inj.message.split('\n').filter((l) => /^• Lugar/.test(l)).length, 0); assert.equal(inj.message.split('\n').filter((l) => /^• Precio referencial/.test(l)).length, 1);
assert.doesNotThrow(() => encodeState({ custom: Array.from({ length: 200000 }, (_, i) => ({ t: `Equipo ${i}`, w: 100, n: 1 })) }));
assert.ok(decodeState(encodeState({ custom: Array.from({ length: 500 }, (_, i) => ({ t: `E${i}`, w: 100, n: 1 })) })).custom.length <= 20);
const mal = decodeState(Buffer.from(JSON.stringify({ e: { nevera: 1 }, c: [['Cava', 300, 1], 5, null] })).toString('base64url'));
assert.ok(mal && mal.items.nevera === 1 && mal.custom.length === 1 && mal.custom[0].t === 'Cava');

// ── clean(): exportada, idempotente, con los campos que solo viajan al mensaje ──
const cl = clean({ items: { nevera: 2 }, tier: 'holgado', when: 'mes', via: 'ig', preset: 'esencial', url: 'https://x.io/dimensionar/?c=abc' });
assert.deepEqual([cl.tier, cl.when, cl.via, cl.preset, cl.url], ['holgado', 'mes', 'ig', 'esencial', 'https://x.io/dimensionar/?c=abc']);
assert.deepEqual(clean(cl), cl, 'idempotente');
assert.deepEqual(clean(null), clean(undefined)); assert.deepEqual(clean({}), clean([]));
for (const bad of ['premium', 'constructor', '', 5, null, {}]) { const c = clean({ tier: bad, when: bad, via: bad, preset: bad }); assert.deepEqual([c.tier, c.when, c.via, c.preset], [null, null, null, null], String(bad)); }
assert.equal(clean({ preset: 'cero' }).preset, 'cero');
for (const bad of ['javascript:alert(1)', 'ftp://x.io/a', 'https://x.io/a b', 'https://x.io/\nHola', `https://x.io/${'a'.repeat(480)}`, 'https://', 5, {}]) assert.equal(clean({ url: bad }).url, null, String(bad).slice(0, 30));
assert.equal(clean({ url: `https://x.io/${'a'.repeat(467)}` }).url?.length, 480);

// ── los seis ejemplos del digest, con el catálogo del dueño (Recomendada = como cotiza él: holgura 1,75 y horas nominales) ──
const A = run({ items: { nevera: 1, tv: 1, router: 1, led: 6, ventilador: 2, cargador: 2 }, hours: 2 });
assert.equal(A.contW, 295 + NEV); assert.equal(A.peakW, 295 + NEV + NEV * 4); near(A.whResp, 695 - 150 * 0.35 * 2 + NEV * NEVD * 2, 0.5, 'A whResp');   // digest: 425 / 1.025 / 655 con un TV de 60 W; el nuestro es de 80 W
assert.equal(rec(A).inverter.model, 'IVCM2024-LV');   // 445 W × 1,75 = 779 W: el 2 kW de 24 V es el más barato con holgura (400 + 700)
assert.deepEqual([rec(A).batteries.model, rec(A).batteries.n, rec(A).totals.equipo], ['FLA24100PG2', 1, 1100]);
near(rec(A).rechargeH, energyH(A, rec(A)), 0.06, 'A recarga'); assert.equal(rec(A).checks.chargeOk, true);
assert.deepEqual([opt(A, 'holgado').upgraded, opt(A, 'holgado').inverter.model, opt(A, 'holgado').totals.equipo], ['inverter', 'IVEM3048-LV', 495 + 1200]);   // la Recomendada ya cubre con pérdidas → más potencia
assert.equal(opt(A, 'basico'), undefined, 'nada más barato que 1.100: se omite');

const B = run({ items: Bitems, hours: 8 });
assert.equal(B.contW, 1455 + NEV); assert.equal(B.peakW, 1455 + NEV + 1200 * 3 + NEV * 4);   // todo de uso largo → Σ + los dos arranques mayores (aire + nevera)
near(B.whResp, 7720 - 150 * 0.35 * 8 + NEV * NEVD * 8, 1, 'B whResp');   // tv 5 h, cargador 3 h, led 6 h: menos que los 8060 del digest (que usaba h_resp para todo)
assert.equal(rec(B).inverter.model, 'ROCCIA-6K-120/220');   // aire 12k convencional: minKw 5 (nunca "arranca con 3 kW"); el dueño vende el 6 kW
assert.deepEqual([rec(B).batteries.model, rec(B).batteries.n, rec(B).totals.equipo], ['FLA48230-EU', 1, 990 + 2150]);   // la FLA48230 solo viaja con el Roccia
near(rec(B).autonomyH, 9.8, 0.3, 'B autonomía nominal'); near(rec(B).realH, 7.5, 0.3, 'B autonomía real'); assert.ok(rec(B).realH < rec(B).autonomyH);
assert.equal(rec(B).badge, 'Recomendada');
assert.equal(opt(B, 'basico'), undefined, 'con la nevera a 230 W la FLA48100 (5,12 kWh) ya no llega al 65 %: no hay escalón más barato');   // antes (150 W): Roccia + FLA48100
assert.deepEqual([opt(B, 'holgado').upgraded, opt(B, 'holgado').inverter.model, opt(B, 'holgado').batteries.model], ['battery', 'ROCCIA-6K-120/220', 'FLA48314-EU']);   // la Recomendada no cubre con pérdidas (7,5 h < 8 h): la Holgada suma banco
const B7 = run({ items: Bitems, hours: 7 });
assert.deepEqual([opt(B7, 'holgado').upgraded, opt(B7, 'holgado').inverter.model, opt(B7, 'holgado').batteries.model], ['inverter', 'IVGM8KLP2G1', 'FLA48314-EU']);   // a 7 h la Recomendada ya cubre con pérdidas (7,5 h): sube de inversor, nunca con menos banco

const C = run({ items: { vitrina: 2, enfriador: 1, pos: 1, camaras: 1, led: 10, router: 1, tv: 1, ventilador: 1 }, hours: 12 });
assert.equal(C.contW, 2295); assert.equal(C.peakW, 2295 + 700 * 3 + 600 * 3);   // digest: con varios compresores se suman los dos mayores arranques
assert.deepEqual([rec(C).inverter.model, rec(C).batteries.model, rec(C).batteries.n], ['ROCCIA-6K-120/220', 'FLA48314-EU', 1]);
assert.ok(rec(C).coverage >= 1 && rec(C).coverageReal < 1, 'nominal alcanza (1,05); con pérdidas no (0,81): lo dice realH');
assert.deepEqual([opt(C, 'basico').batteries.model, opt(C, 'basico').batteries.n], ['FLA48230-EU', 1]);
assert.deepEqual([opt(C, 'holgado').upgraded, opt(C, 'holgado').inverter.model, opt(C, 'holgado').batteries.model, opt(C, 'holgado').batteries.n], ['battery', 'ROCCIA-6K-120/220', 'FLA48230-EU', 2]);   // faltan horas reales → las baterías que cubren con pérdidas
assert.ok(opt(C, 'holgado').coverageReal >= 1);

const D = run({ items: { nevera: 1, bomba1: 1, tv: 1, router: 1, led: 8, ventilador: 2, laptop: 1, cargador: 2, licuadora: 1, microondas: 1 }, hours: 6 });
assert.equal(D.contW, 375 + NEV + 1300);   // base + UN aparato corto (el mayor: microondas), no Σ de todo (3.205 W en el digest)
assert.equal(D.peakW, 375 + NEV + BOMBA1 * 3.5);   // …pero el arranque de la bomba sigue contando contra la base
assert.equal(rec(D).inverter.model, 'ROCCIA-6K-120/220'); assert.equal(opt(D, 'basico').inverter.model, 'IVEM3048-LV');   // 1,75 × 1.825 = 3,2 kW → 6 kW; el 3 kW es la Básica

const E = run({ items: { pc: 6, aa12i: 2, router: 1, led: 10, camaras: 1 }, hours: 8 });
assert.equal(E.contW, 3355); assert.equal(rec(E).inverter.model, 'ROCCIA-6K-120/220');   // 1,75 × 3.355 = 5.871 ≤ 6.000
assert.deepEqual([rec(E).batteries.model, rec(E).batteries.n], ['FLA48230-EU', 2]);
assert.equal(E.plant, false);

const F = run({ items: { aa24c: 1, nevera: 1, tv: 1, router: 1, led: 10, ventilador: 2, bomba05: 1, cargador: 2 }, hours: 8, v220: { aa24c: true } });
assert.equal(F.needs220, true); assert.equal(F.contW, 2735 + NEV + BOMBA05); assert.equal(F.peakW, 2735 + NEV + BOMBA05 + 2400 * 4 + NEV * 4);
assert.equal(rec(F).inverter.model, 'ROCCIA-6K-120/220'); assert.ok(rec(F).inverter.ac.includes('240'));
assert.equal(rec(F).checks.surgeOk, true); assert.equal(rec(F).checks.surgeTight, true, 'arranca, pero a más del 80 % del tope: ámbar');
assert.match(rec(F).review, /revisión/);   // aire convencional ≥ 18k: soft-starter o equipo inverter
assert.ok(F.hints.some((h) => /soft-starter o equipo inverter; lo confirmamos en la visita/.test(h)));
assert.match(F.message, /soft-starter o equipo inverter/); assert.match(F.message, /aire 24k \(220 V\) ×1/);
assert.match(F.message, /• Ojo: el arranque de mi aire 24k puede superar el inversor; me indican soft-starter o equipo inverter/);
assert.deepEqual([rec(F).batteries.model, rec(F).batteries.n], ['FLA48100-EU', 4]);
assert.equal(rec(F).totals.equipo, 990 + 4 * 1200);
for (const o of F.options) assert.ok(o.inverter.ac.includes('240'), 'con un equipo de 220 V solo hay 120/240');

// ── C-rate: una batería que guarda la energía pero no la corriente trae una hermana ──
const g8 = inv('IVGM8KLP2G1');
assert.equal(pickBatteries(g8, { whResp: 2000, contW: 4800, peakW: 4800 }).n, 2);   // 4.800 / (48 × 0,9) = 111 A > 100 A
assert.equal(pickBatteries(g8, { whResp: 2000, contW: 3000, peakW: 3000 }).n, 1);
const cr = run({ items: { nevera: 1 }, custom: [{ t: 'Compresor', w: 2000, n: 1, m: true }], hours: 2 });   // la energía cabe en 1 × 5,12 kWh; el arranque (165 A), no
assert.equal(rec(cr).checks.cRatePeakOk, true); assert.ok(rec(cr).checks.cRateOk);
assert.ok(pickBatteries(g8, { whResp: 14380, contW: 3485, peakW: 10685 }, { floor: true }).price <= pickBatteries(g8, { whResp: 14380, contW: 3485, peakW: 9600 }, { floor: true }).price);
// la FLA48230 es solo del Roccia: con un Felicity nunca sale
assert.ok(pickBatteries(inv('IVEM3048-LV'), { whResp: 11000, contW: 1000, peakW: 1000 }).bat.model !== 'FLA48230-EU');
assert.equal(pickBatteries(inv('ROCCIA-6K-120/220'), { whResp: 11000, contW: 1000, peakW: 1000 }).bat.model, 'FLA48230-EU');
// factor / slack: el default son las horas nominales; con pérdidas hace falta más banco
const dd = { whResp: 5000, contW: 800, peakW: 800 };
assert.equal(pickBatteries(inv('IVEM3048-LV'), dd).n, 1); assert.equal(pickBatteries(inv('IVEM3048-LV'), dd, { factor: REAL() }).n, 2);
assert.equal(pickBatteries(inv('IVEM3048-LV'), { ...dd, whResp: 5200 }).n, 2); assert.equal(pickBatteries(inv('IVEM3048-LV'), { ...dd, whResp: 5200 }, { slack: K.quoteSlack }).n, 1, 'el dueño redondea: 98 % cuenta como cubierto');

// ── fuera de alcance: sin opciones, con `remove` (qué quitar para volver) y un mensaje de lead igual de útil ──
const cocina = run({ items: { cocina220: 1, nevera: 1 }, hours: 4, city: 'Cagua', via: 'dx', url: 'https://x.io/dimensionar/?c=abc&via=dx', tier: 'holgado', when: 'mes', preset: 'esencial' });
assert.ok(cocina.outOfScope && /cocina eléctrica 220 v/i.test(cocina.outOfScope.reason)); assert.deepEqual(cocina.options, []); assert.equal(cocina.chosen, null);
assert.deepEqual(cocina.outOfScope.remove, ['cocina220']); assert.equal(quote(cocina.__a), null);
assert.equal(cocina.message, [
  'Hola SSD&S, dimensioné mi respaldo en su web y requiere cotización con ingeniero.',
  '• Equipos: cocina 220 V ×1, nevera ×1',
  '• Corte a cubrir: 4 h · Cagua',
  `• Motivo: ${cocina.outOfScope.reason}`,
  '• Carga continua ≈ 5.230 W · arranque ≈ 6.150 W · energía ≈ 4,7 kWh',
  '• Vía: Diagnóstico',
  'Mi configuración: https://x.io/dimensionar/?c=abc&via=dx',
  '¿Me pueden orientar y coordinamos la visita técnica?',
].join('\n'));
const big = run({ items: { pc: 20, aa24i: 2 }, hours: 4 });   // 4.600 + 3.800 W × 1,25 > el mayor inversor (8 kW)
assert.ok(big.outOfScope && /superan un solo inversor de 8 kW/.test(big.outOfScope.reason)); assert.deepEqual(big.outOfScope.remove, ['pc']); assert.match(big.message, /• Motivo: ≈ 8,4 kW continuos/);
const big220 = run({ items: { aa24c: 3, nevera: 2 }, hours: 4, v220: { aa24c: true } });   // 7.500 × 1,25 > 8 kW
assert.ok(big220.outOfScope && /un solo inversor de 8 kW/.test(big220.outOfScope.reason)); assert.deepEqual(big220.outOfScope.remove, ['aa24c']);
const tri = run({ items: { trifasico: 1, soldadora: 1, nevera: 1 } });
assert.match(tri.outOfScope.reason, /trifásico o variador/); assert.deepEqual(tri.outOfScope.remove, ['trifasico', 'soldadora']);
assert.match(run({ items: { soldadora: 1 } }).outOfScope.reason, /soldadora|soldar/i);
assert.doesNotMatch(tri.outOfScope.reason, /baterías de este tamaño/);
const oosCustom = run({ items: { nevera: 1 }, custom: [{ t: 'Horno industrial', w: 9000, n: 1 }], hours: 4 });
assert.deepEqual(oosCustom.outOfScope.remove, ['otro0']); assert.match(oosCustom.message, /Horno industrial 9\.000 W ×1/);
for (const r of [cocina, big, big220, tri, oosCustom]) { assert.ok(r.outOfScope.remove.length >= 1); assert.match(r.message, /\?$/); assert.doesNotMatch(r.message, /Opción|Precio|US\$/); assert.equal(quote(r.__a), null); }

// ── 220 V, aires convencionales y la serie de 12/24 V ──
assert.equal(rec(run({ items: { aa18i: 1, nevera: 1 }, hours: 8 })).inverter.ac, '110');   // 'ask' sin respuesta se calcula a 110 V
assert.ok(rec(run({ items: { aa18i: 1, nevera: 1 }, hours: 8, v220: { aa18i: true } })).inverter.ac.includes('240'));
assert.equal(rec(run({ items: { aa18i: 1, nevera: 1 }, hours: 8, v220: { aa18i: false } })).inverter.ac, '110');
assert.equal(rec(run({ items: { nevera: 1 }, hours: 8, v220: { nevera: true } })).inverter.ac, '110');   // v220 solo cuenta para las 'ask'
// un 120/240 V también alimenta cargas de 120 V (el dueño vende el Roccia y el 8 kW a 120 V): la Recomendada del aire 12k es un Roccia, no 220 V
assert.ok(rec(B).inverter.ac.includes('240') && B.needs220 === false);
assert.ok(run({ items: { aa18c: 1 }, hours: 8 }).hints.some((h) => /Revisa en la placa/.test(h)));
assert.ok(run({ items: { aa18c: 1, nevera: 1 }, hours: 8, v220: { aa18c: false } }).hints.every((h) => !/Revisa en la placa/.test(h)), 'ya respondió que no es de 220');
assert.match(run({ items: { aa18c: 1, aa24i: 1, nevera: 1 }, hours: 8 }).hints.find((h) => /Revisa en la placa/.test(h)), /tu aire 18k y tu aire 24k inv son de 220 V/);
assert.match(run({ items: { aa18c: 1, nevera: 1 }, hours: 8 }).message, /\n• Confirmar: ¿mi aire 18k es de 220 V\?\n/);
assert.match(run({ items: { aa18c: 1, aa24i: 1, nevera: 1 }, hours: 8 }).message, /\n• Confirmar: ¿mi aire 18k y mi aire 24k inv son de 220 V\?\n/);
for (const v of [false, true]) assert.doesNotMatch(run({ items: { aa18c: 1, nevera: 1 }, hours: 8, v220: { aa18c: v } }).message, /Confirmar/, `respondió ${v}`);
assert.doesNotMatch(run({ items: { aa12c: 1, nevera: 1 }, hours: 8 }).message, /Confirmar/);
for (const id of ['aa24c', 'aa18c']) {   // un aire convencional ≥ 18k nunca se promete: revisión + soft-starter o equipo inverter
  const r = run({ items: { [id]: 1, nevera: 1 }, hours: 8 });
  assert.match(rec(r).review, /revisión/, id); assert.ok(r.hints.some((h) => /soft-starter o equipo inverter; lo confirmamos en la visita/.test(h)), id);
  assert.match(r.message, /Ojo: .*soft-starter o equipo inverter/, id);
}
assert.equal(rec(run({ items: { aa12i: 1, nevera: 1 }, hours: 8 })).review, null);   // inverter: sin revisión
for (const items of [{ nevera: 1, bomba1: 1 }, { nevera: 1, aa9i: 1 }, { nevera: 1, bomba05: 1 }, { nevera: 1, microondas: 1, bomba05: 1 }, { nevera: 1, microondas: 1, licuadora: 1 }]) {
  for (const o of run({ items, hours: 4 }).options) assert.notEqual(o.inverter.tier, 'ivcm', `${JSON.stringify(items)}: la serie de 12/24 V no publica pico: nunca con bomba, aire ni dos arranques grandes`);
}
assert.equal(rec(run({ items: { led: 20, router: 1, ventilador: 2 }, hours: 4 })).inverter.tier, 'ivcm', 'una carga chica va a la serie de 12/24 V, como vende el dueño');
const lp = rec(run({ items: { led: 2 }, hours: 2, solar: true }));
assert.equal(lp.panels.n, lp.inverter.pv.minSeries);   // acotado al minSeries del inversor (con la FLA12171 de 650 la más barata es la IVEM1612-LV: 1 panel)
const led24 = rec(run({ items: { led: 2, router: 1 }, hours: 24 }));   // el inversor gasta ≈ 18 W en vacío: 35 W de carga no son 146 h
assert.ok(led24.realH <= (led24.batteries.kwh * 1000 * K.dod * K.eta) / (35 + led24.inverter.idleW) + 0.1);
const ese = run({ items: presets.find((p) => p.id === 'esencial').items, hours: 8 });
assert.equal(rec(ese).checks.chargeOk, true);
// la 12 V del dueño (IVEM1612: 10 A de carga) tarda ≈ 36 h en reponer 3,6 kWh: la Recomendada sigue siendo la suya, pero lo dice (checks.chargeOk + pista), y los kW usan coma
const r12 = run({ custom: [{ t: 'Carga', w: 600, n: 1 }], hours: 6 });
assert.equal(rec(r12).inverter.model, 'IVEM1612-LV'); assert.equal(rec(r12).checks.chargeOk, false); assert.ok(r12.hints.some((h) => /no alcanza a recargarse de la red .* o pasar a un equipo de 48 V/.test(h)));
assert.match(rec(r12).why[0], /^Inversor de 1,6 kW: cubre/); assert.match(r12.message, /inversor híbrido 1,6 kW \(110 V\) IVEM1612-LV/);
// custom con motor: arranca 3,5× y trabaja ≈ 1 h; sin motor es continua 24 h
const pozo = run({ items: { nevera: 1 }, custom: [{ t: 'Bomba de pozo 1 HP', w: 1000, n: 1, m: true }], hours: 4 });
assert.ok(['IVEM3048-LV', 'ROCCIA-6K-120/220'].includes(rec(pozo).inverter.model)); assert.ok(pozo.peakW >= 3500 && pozo.whResp < 1000 * 4); assert.match(pozo.message, /Bomba de pozo 1 HP 1\.000 W \(motor\) ×1/);
assert.ok(run({ items: { nevera: 1 }, custom: [{ t: 'Bomba de pozo 1 HP', w: 1000, n: 1, m: true, h: 0.5 }], hours: 4 }).whResp < pozo.whResp);
assert.equal(run({ items: { nevera: 1 }, custom: [{ t: 'Lámpara', w: 100, n: 1 }], hours: 4 }).whResp, NEV * NEVD * 4 + 100 * 4);

// ── autonomía nominal (la que se muestra y va al PDF) y real (con pérdidas) ──
const aa24 = rec(run({ items: { aa12i: 1 }, hours: 24 }));
assert.ok(aa24.realH <= (aa24.batteries.kwh * 1000 * K.dod * K.eta) / (900 * 0.55) + 0.5);   // con el aire encendido, no diluida en 24 h
assert.ok(aa24.autonomyH >= aa24.realH);
assert.ok(rec(run({ items: Bitems, hours: 24 })).realH <= 24 * 1.2);
assert.doesNotMatch(run({ items: { aa12i: 1 }, hours: 24 }).summary.sayWhatRuns, /Mantiene/);
const tiny = rec(run({ items: { led: 1 }, hours: 1 }));
assert.equal(tiny.autonomyH, K.maxAutonomyH); assert.equal(tiny.autonomyCapped, true);   // "más de 72 h", no 291,6 h
assert.match(run({ items: { led: 1 }, hours: 1 }).message, /→ más de 72 h · se recarga en menos de 1 h/);
for (const r of seen) for (const o of r.options) assert.ok(o.realH <= o.autonomyH + 1e-9, 'real (con pérdidas) nunca supera a nominal');
// el modo conservador cuesta una línea: quoteFactor = dod × eta (y sin holgura de redondeo) → las horas nominales pasan a ser las reales
const nom = rec(run({ items: Bitems, hours: 8 }));
withK({ quoteFactor: K.dod * K.eta, quoteSlack: 1 }, () => { const c = rec(size({ items: Bitems, hours: 8 })); near(c.autonomyH, c.realH, 0.08 * c.autonomyH, 'conservador: nominal ≈ real (solo difiere el consumo propio del inversor)'); assert.ok(c.coverage >= 1 && c.coverageReal >= 0.95); assert.ok(c.totals.equipo >= nom.totals.equipo); });
const g1 = rec(run({ items: { aa18i: 1 }, hours: 2, v220: { aa18i: true } }));   // 8 kW o Roccia con 1 batería: manda el BMS
near(g1.rechargeH, energyH(run({ items: { aa18i: 1 }, hours: 2, v220: { aa18i: true } }), g1), 0.06, 'recarga'); assert.ok(g1.fullRechargeH >= 1);
assert.match(run({ items: { nevera: 1, aa12c: 1 }, hours: 24 }).hints.find((h) => /24 h/.test(h)), /solo se repone con paneles o planta/);
assert.ok(run({ items: { nevera: 1, aa12c: 1 }, hours: 24 }).hints.every((h) => !/≈ \d,?\d* h\)/.test(h)));
assert.match(run({ items: { nevera: 1, aa12c: 1 }, hours: 24 }).message, /→ ≈ [\d,]+ h · se repone solo con paneles o planta/);

// ── clima caluroso, planta, presets ──
const cool = run({ items: { nevera: 1, tv: 1 }, hours: 8 }), hot = run({ items: { nevera: 1, tv: 1 }, hours: 8, hot: true });
near(hot.whResp - cool.whResp, 0, 0.5, 'la nevera ya va al 100 % (230 W todo el tiempo): el clima caluroso no la sube');
const ac = loads.find((l) => l.id === 'aa12i'), coolA = run({ items: { aa12i: 1 }, hours: 8 }), hotA = run({ items: { aa12i: 1 }, hours: 8, hot: true });
near(hotA.whResp - coolA.whResp, ac.w * (Math.min(1, ac.duty * K.hotDuty) - ac.duty) * 8, 1, 'hot sube el ciclo del aire (tope 100 %)');
assert.match(hot.message, /• Corte a cubrir: 8 h · clima caluroso\n/); assert.doesNotMatch(cool.message, /clima caluroso/);
assert.equal(run({ items: { nevera: 1, aa12i: 1 }, hours: 12 }).plant, true);   // ≥ 12 h con un aire
assert.equal(run({ items: { nevera: 1, aa12i: 1 }, hours: 8 }).plant, false);
assert.equal(run({ items: { pc: 6, aa12i: 2 }, hours: 24 }).plant, true);   // > 20 kWh
for (const p of presets) {
  const r = run({ items: p.items, hours: 8 });
  assert.equal(r.outOfScope, null, p.id); assert.ok(r.options.length >= 1 && r.options.length <= 3, p.id);
  assert.ok(rec(r) && rec(r).badge === 'Recomendada' && !/elegida|popular/i.test(rec(r).badge), p.id);
  assert.deepEqual(r.options.map((o) => o.label), r.options.map((o) => ({ basico: 'Básica', recomendado: 'Recomendada', holgado: 'Holgada' })[o.tier]), p.id);
  assert.ok(quote({ items: p.items, hours: 8 }), p.id);
}

// ── opciones: forma, orden, totales, disponibilidad (casos vistos + barrido reproducible) ──
const sweep = (n) => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pool = ['nevera', 'freezer', 'router', 'led', 'ventilador', 'tv', 'laptop', 'camaras', 'pc', 'cargador', 'starlink', 'bomba05', 'microondas', 'licuadora', 'porton', 'aa9i', 'aa12i', 'aa12c', 'vitrina', 'enfriador'];
  for (let i = 0; i < n; i++) {
    const items = {}; for (const id of pool) if (rnd() < 0.35) items[id] = 1 + Math.floor(rnd() * 5);
    run({
      items, hours: [2, 4, 8, 12, 24][i % 5], hot: i % 7 === 0, solar: i % 3 === 0,
      install: ['equipo', 'instalado', 'manoObra'][i % 3], transfer: ['no', 'quiero', 'tengo', 'quiero'][i % 4], extraM: i % 5 === 0 ? 4 : 0,
      tier: [undefined, 'basico', 'recomendado', 'holgado', 'nada'][i % 5], when: [undefined, 'sem', 'mes', 'exp'][i % 4], via: [undefined, 'ig', 'dx'][i % 3],
    });
  }
};
function invariants(list) {
  for (const r of list) {
    const tiers = r.options.map((o) => o.tier), a = r.__a;
    assert.deepEqual(tiers, ['basico', 'recomendado', 'holgado'].filter((t) => tiers.includes(t)), 'order');
    if (r.options.length) {   // la elegida: la pedida; si no existe (o no pidió), la recomendada
      const want = ['basico', 'recomendado', 'holgado'].includes(a.tier) && tiers.includes(a.tier) ? a.tier : 'recomendado';
      assert.equal(r.chosen, want); assert.match(r.message, new RegExp(`• Opción ${{ basico: 'básica', recomendado: 'recomendada', holgado: 'holgada' }[want]}: `));
    }
    for (const o of r.options) {
      assert.ok(o.inverter.available && o.inverter.priceEq > 0, o.inverter.model);   // ningún modelo devuelto sin available && priceEq > 0
      const b = bat(o.batteries.model);
      assert.ok(b.available && b.priceEq > 0 && o.batteries.n >= 1 && o.batteries.n <= b.maxParallel, o.batteries.model);
      assert.ok(!b.onlyWith || b.onlyWith.includes(o.inverter.tier), `${b.model} solo con ${b.onlyWith}`);
      assert.equal(o.inverter.busV, b.busV);
      assert.equal(o.totals.equipo, o.inverter.priceEq + o.batteries.n * b.priceEq, 'paneles no suman: panelUsd es null');
      assert.ok(o.why.length >= 1 && o.why.length <= 3);
      assert.ok(o.autonomyH > 0 && o.autonomyH <= K.maxAutonomyH && o.realH > 0 && o.realH <= o.autonomyH + 1e-9 && o.rechargeH > 0 && o.coverage > 0 && o.coverageReal > 0 && o.coverageReal <= o.coverage + 1e-9);
      assert.equal(typeof o.checks.surgeOk, 'boolean'); assert.equal(typeof o.checks.surgeTight, 'boolean');
      const cap = o.inverter.kw * 1000 * o.inverter.kSurge;   // surgeTight = arranca, pero a más del 80 % del tope
      if (Math.abs(r.peakW - K.tightShare * cap) > 1) assert.equal(o.checks.surgeTight, r.peakW <= cap && r.peakW > K.tightShare * cap, `surgeTight ${r.peakW}/${cap}`);
      if (o.checks.surgeTight) assert.ok(o.checks.surgeOk);
      assert.ok(o.checks.cRateOk && o.checks.cRatePeakOk, 'el banco siempre aguanta las corrientes');
      assert.ok(!r.needs220 || o.inverter.ac.includes('240'), 'con 220 V solo 120/240');
      const R = rec(r);
      if (o.tier === 'basico') {   // Básica: nunca más cara, ≥ 65 % de las horas nominales
        assert.ok(o.totals.equipo < R.totals.equipo && o.coverage >= 0.65 * K.quoteSlack - 0.01, 'basico');
        assert.ok(o.totals.total == null || R.totals.total == null || o.totals.total <= R.totals.total, 'básica nunca más cara (instalada)');
      }
      if (o.tier === 'recomendado') assert.ok(o.coverage >= K.quoteSlack - 1e-9, 'la recomendada cubre el corte pedido (horas nominales)');
      if (o.tier === 'holgado') {   // Holgada: nunca más barata; cubre las horas pedidas aun con pérdidas
        assert.ok(o.totals.equipo > R.totals.equipo, 'holgada cuesta más');
        assert.ok(o.totals.total == null || R.totals.total == null || o.totals.total >= R.totals.total, 'holgada nunca más barata (instalada)');
        assert.ok(['battery', 'inverter'].includes(o.upgraded) && o.coverageReal >= 1 - 1e-9, 'holgada cubre con pérdidas');
        if (o.upgraded === 'battery') assert.ok(o.batteries.n * b.kwh >= R.batteries.kwh - 1e-9 && o.inverter === R.inverter && o.autonomyH >= R.autonomyH, 'holgada = más baterías');
        else assert.ok(o.inverter.kw > R.inverter.kw && o.batteries.kwh >= R.batteries.kwh - 1e-9, 'holgada = siguiente inversor, sin menos banco');
      }
      if (o.tier !== 'basico') assert.ok(o.totals.equipo >= R.totals.equipo, 'ninguna opción (salvo la básica) cuesta menos que la recomendada');
      for (const t of [o.review, ...o.why].filter(Boolean)) assert.doesNotMatch(t, /garantiz|aguanta|Más elegida/);
      // totales: instalación por tramo (kit + mano de obra), UNA vez por sistema, no por batería; confirmed solo si no queda nada por cotizar (David confirmó la instalación el 5 oct 2026)
      const t = o.totals, tr = pricing.install[o.inverter.tier];
      assert.equal(t.confirmed, t.total != null && t.pending.length === 0); assert.ok(t.equipo > 0 && Array.isArray(t.pending));
      if (a.install === 'instalado') {
        assert.equal(t.instalacion, tr.kit + tr.mo); assert.equal(t.total, t.equipo + tr.kit + tr.mo);
        assert.deepEqual(t.detalle, { kit: tr.kit, mo: tr.mo, kitType: tr.kitType, range: tr.range });
      } else assert.equal(t.detalle, null);
      if (a.install === 'equipo') { assert.equal(t.total, t.equipo); assert.equal(t.instalacion, null); }
      if (a.install === 'manoObra') { assert.equal(t.total, null); assert.equal(t.instalacion, null); assert.ok(t.pending.includes('mano de obra')); }
      assert.equal(t.pending.includes('transferencia'), a.transfer === 'quiero');
      assert.equal(t.pending.includes(`+${a.extraM} m de cable`), a.install !== 'equipo' && a.extraM > 0);
    }
    for (const h of r.hints) assert.doesNotMatch(h, /garantiz|aguanta/);
    // quote(): coherente con la opción elegida en cualquier combinación
    if (r.options.length) quoteInvariants(r, a);
  }
}
function quoteInvariants(r, a) {
  const q = quote(a, { tier: a.tier, cliente: 'Cliente de prueba', fecha: '2026-10-04' }), sel = r.options.find((o) => o.tier === r.chosen);
  noNaN({ ...q, lines: q.lines.map(({ precio, total, ...l }) => l) });
  assert.deepEqual(q.lines.map((l) => l.n), q.lines.map((_, i) => i + 1), 'numeración corrida');
  const sum = q.lines.reduce((s, l) => s + (l.total ?? 0), 0);
  assert.equal(q.subtotal, sum); assert.equal(q.total, sum); assert.equal(q.abono, 0);
  for (const l of q.lines) { assert.ok(['PZA', 'KIT', 'ACT'].includes(l.und)); assert.ok(l.cant >= 1 && l.desc.length > 5); assert.equal(l.total, l.precio == null ? null : l.precio * l.cant); if (l.precio == null) assert.match(l.desc, /Se confirma en la visita/); }
  assert.equal(q.lines[0].total, sel.inverter.priceEq); assert.equal(q.lines[1].cant, sel.batteries.n);
  assert.equal(q.lines[0].total + q.lines[1].total, sel.totals.equipo);
  if (sel.totals.total != null) assert.equal(q.total, sel.totals.total, 'el total del PDF = el de la tarjeta');
  assert.equal(q.incompleto, q.lines.some((l) => l.precio == null));
  assert.equal(q.lines.some((l) => l.und === 'KIT' && /instalación/i.test(l.desc)), a.install === 'instalado' && !!sel.totals.detalle);
}
sweep(1500); invariants(seen);
assert.ok(seen.length > 1500 && seen.filter((r) => r.options.some((o) => o.tier === 'holgado')).length > 300, 'el barrido ejercitó holgadas');
assert.ok(seen.some((r) => r.options.some((o) => o.upgraded === 'inverter')) && seen.some((r) => r.options.some((o) => o.upgraded === 'battery')), 'el barrido ejercitó las dos holgadas');
assert.ok(seen.some((r) => r.options.some((o) => o.tier === 'basico')), 'el barrido ejercitó la básica');
assert.ok(seen.some((r) => r.options.some((o) => o.checks.surgeTight)) && seen.some((r) => r.options.some((o) => o.checks.surgeOk && !o.checks.surgeTight)), 'el barrido ejercitó surgeTight');
assert.ok(seen.some((r) => r.options.some((o) => o.inverter.tier === 'ivcm')) && seen.some((r) => r.options.some((o) => o.inverter.tier === 'roccia')) && seen.some((r) => r.options.some((o) => o.inverter.tier === 'ivgm8')), 'el barrido ejercitó todas las líneas');

// ── Holgada: si la Recomendada ya cubre con pérdidas → más potencia (siguiente inversor); si no → las baterías que faltan ──
const sobra = run({ items: { nevera: 1, router: 1 }, hours: 2 });
assert.equal(opt(sobra, 'holgado').upgraded, 'inverter'); assert.ok(opt(sobra, 'holgado').inverter.kw > rec(sobra).inverter.kw);
assert.match(opt(sobra, 'holgado').why[0], /Inversor de [\d,]+ kW en vez de [\d,]+: más potencia/);
assert.equal(opt(run({ items: { vitrina: 2, enfriador: 1, pos: 1, camaras: 1, led: 10, router: 1, tv: 1, ventilador: 1 }, hours: 12 }), 'holgado').upgraded, 'battery');   // 0,81 < 1
assert.match(opt(C, 'holgado').why[1], /incluso con las pérdidas normales del sistema \(≈ [\d,]+ h reales/);
const comp = run({ items: presets.find((p) => p.id === 'completa').items, hours: 8 });   // la Recomendada ya es el 8 kW: no hay inversor mayor → baterías
assert.equal(rec(comp).inverter.model, 'IVGM8KLP2G1'); assert.equal(opt(comp, 'holgado').upgraded, 'battery'); assert.equal(opt(comp, 'holgado').inverter, rec(comp).inverter);

// ── surgeTight: arranca (verde), pero entre 80 % y 100 % del tope del inversor (ámbar) ──
assert.equal(rec(F).checks.surgeTight, true); assert.equal(rec(B).checks.surgeTight, false);   // B: 6.205 W de 15.000 W
const tg = run({ items: { aa12c: 2, nevera: 1 }, hours: 4 });   // pico 9.830 W
assert.equal(tg.peakW, 9830); assert.equal(rec(tg).checks.surgeOk, true);

// ── instalación por tramo: kit + mano de obra, una vez por sistema, con desglose para el PDF ──
const Bi = run({ items: Bitems, hours: 8, install: 'instalado' });
assert.deepEqual(rec(Bi).totals, { equipo: 3140, instalacion: 850, detalle: { kit: 500, mo: 350, kitType: 'cargas', range: [850, 1000] }, total: 3990, confirmed: true, pending: [] });
const Bi7 = run({ items: Bitems, hours: 7, install: 'instalado' });   // a 7 h la Holgada es el 8 kW
assert.deepEqual(opt(Bi7, 'holgado').totals, { equipo: 5265, instalacion: 1000, detalle: { kit: 500, mo: 500, kitType: 'cargas', range: [1000, 1200] }, total: 6265, confirmed: true, pending: [] });
const Ci = run({ items: C.__a.items, hours: 12, install: 'instalado' });
assert.deepEqual([rec(Ci).batteries.n, opt(Ci, 'holgado').batteries.n], [1, 2]); assert.equal(rec(Ci).totals.instalacion, opt(Ci, 'holgado').totals.instalacion, 'más baterías no cambian la instalación');
assert.match(Bi.message, /Precio referencial: US\$ 3\.140 solo equipo · ≈ desde US\$ 3\.990 instalado \(sujeto a visita\)\n• Instalación: kit básico hasta 2 m del tablero \(se confirma en la visita\)\n/);
assert.deepEqual(rec(B).totals, { equipo: 3140, instalacion: null, detalle: null, total: 3140, confirmed: true, pending: [] });
assert.match(B.message, /• Precio referencial: US\$ 3\.140 solo equipo\n/); assert.doesNotMatch(B.message, /Instalación|instalado/);
for (const r of seen) for (const o of r.options) assert.ok(o.totals.equipo > 0 && (o.totals.total == null || o.totals.total >= o.totals.equipo));
// el modo 'factor' (equipo × 1,25) sigue a una línea de distancia; null donde no hay cifra
withPricing({ installMode: 'factor' }, () => { const t = rec(size({ items: Bitems, hours: 8, install: 'instalado' })).totals; assert.equal(t.total, Math.round(t.equipo * 1.25)); assert.equal(t.detalle, null); });
withPricing({ install: {} }, () => { const t = rec(size({ items: Bitems, hours: 8, install: 'instalado' })).totals; assert.equal(t.total, null); assert.equal(t.instalacion, null); assert.match(size({ items: Bitems, hours: 8, install: 'instalado' }).message, /instalación: se confirma en la visita/); });
// 'solo mano de obra', kit de transferencia y metros extra: aparte, con su constante (null → visita), y NO ocultan el total
const mo = rec(run({ items: { nevera: 1 }, hours: 4, install: 'manoObra' })).totals;
assert.equal(mo.instalacion, null); assert.equal(mo.total, null); assert.equal(mo.confirmed, false); assert.deepEqual(mo.pending, ['mano de obra']);
assert.match(run({ items: { nevera: 1 }, hours: 4, install: 'manoObra' }).message, /• Instalación: solo mano de obra \(se confirma en la visita\)/);
withPricing({ laborOnly: 100, installConfirmed: false }, () => { const t = rec(size({ items: { nevera: 1 }, hours: 4, install: 'manoObra' })).totals; assert.equal(t.total, t.equipo + 100); assert.equal(t.confirmed, false, 'con installConfirmed en false nada queda confirmado'); assert.deepEqual(t.pending, []); });
withPricing({ laborOnly: 100, installConfirmed: true }, () => { const t = rec(size({ items: { nevera: 1 }, hours: 4, install: 'manoObra' })).totals; assert.equal(t.confirmed, true); });
const tk = run({ items: { nevera: 1, aa12c: 1 }, hours: 4, install: 'instalado', transfer: 'quiero', extraM: 5 });
assert.equal(rec(tk).totals.total, rec(tk).totals.equipo + 850); assert.deepEqual(rec(tk).totals.pending, ['transferencia', '+5 m de cable']);
assert.match(tk.message, /• Instalación: kit básico hasta 2 m del tablero · transferencia: la quiero · \+5 m de cable \(se confirman en la visita\)/);
assert.match(run({ items: { nevera: 1, aa12c: 1 }, hours: 4, install: 'instalado', transfer: 'tengo' }).message, /transferencia: ya tengo/);
withPricing({ transferKit: 120, cablePerM: 15, installConfirmed: true }, () => {
  const t = size({ items: { nevera: 1, aa12c: 1 }, hours: 4, install: 'instalado', transfer: 'quiero', extraM: 5 });
  assert.equal(rec(t).totals.total, rec(t).totals.equipo + 850 + 120 + 75); assert.equal(rec(t).totals.confirmed, true); assert.deepEqual(rec(t).totals.pending, []);
  assert.match(t.message, /instalado \(sujeto a visita\)/);
  const q = quote(t.__a ?? { items: { nevera: 1, aa12c: 1 }, hours: 4, install: 'instalado', transfer: 'quiero', extraM: 5 });
  assert.equal(q.total, rec(t).totals.total); assert.equal(q.incompleto, false);   // los renglones con cifra suman igual que la tarjeta
});
const eqk = run({ items: { nevera: 1, aa12c: 1 }, hours: 4, install: 'equipo', transfer: 'quiero' });   // el kit se marca aunque compre "solo equipo"
assert.match(eqk.message, /• Instalación: transferencia: la quiero \(se confirma en la visita\)/); assert.deepEqual(rec(eqk).totals.pending, ['transferencia']);
withPricing({ transferKit: 120 }, () => { const t = rec(size({ items: { nevera: 1, aa12c: 1 }, hours: 4, install: 'equipo', transfer: 'quiero' })).totals; assert.equal(t.total, t.equipo + 120); });
withPricing({ installMode: 'factor', installFactor: 'x' }, () => assert.equal(rec(size({ items: { nevera: 1 }, hours: 4, install: 'instalado' })).totals.total, null));

// ── paneles: se sugieren, nunca se cobran mientras panelUsd sea null; pista de apartamento ──
const sol = run({ items: Bitems, hours: 8, solar: true, place: 'apto' });
assert.equal(rec(sol).totals.equipo, rec(B).totals.equipo); assert.equal(rec(sol).totals.total, rec(B).totals.total);
for (const inst of ['equipo', 'instalado']) assert.deepEqual(rec(size({ items: Bitems, hours: 8, solar: true, install: inst })).totals, rec(size({ items: Bitems, hours: 8, solar: false, install: inst })).totals, `con panelUsd null el total no cambia al activar solar (${inst})`);
const idleB = rec(B).inverter.idleW * 8;
assert.equal(rec(sol).panels.n, Math.max(rec(B).inverter.pv.minSeries, Math.ceil((B.whResp + idleB) / (K.eta * K.chargeEta) / (K.psh * K.panelW * K.pvDerate))));   // con pérdidas de conversión y de carga
assert.match(rec(sol).panels.note, /aparte/); assert.equal(rec(B).panels, null);
assert.ok(sol.hints.some((h) => /apartamento.*techo/i.test(h)));
assert.match(sol.message, /• Paneles: \d+ sugeridos \(se cotizan aparte\)/);
assert.match(run({ items: { led: 1 }, hours: 2, solar: true }).message, /• Paneles: 1 sugerido \(se cotizan aparte\)/);   // la más barata es la IVEM1612-LV (minSeries 1)
const solBig = run({ items: { vitrina: 4 }, hours: 24, solar: true });   // 28,8 kWh → muchos más paneles de los que admite el inversor
for (const o of solBig.options) { const cap = Math.min(o.inverter.pv.maxPanels, Math.floor(o.inverter.pv.maxW / K.panelW)); assert.equal(o.panels.n, cap); assert.match(o.panels.note, new RegExp(`admite hasta ${cap}`)); }
const gp = rec(run({ items: { aa18i: 1 }, hours: 2, v220: { aa18i: true }, solar: true })).panels.n;
assert.ok(gp >= rec(run({ items: { aa18i: 1 }, hours: 2, v220: { aa18i: true } })).inverter.pv.minSeries, 'al menos la serie mínima del inversor');
withPricing({ panelUsd: 400 }, () => { const t = rec(size({ items: Bitems, hours: 8, solar: true })).totals; assert.equal(t.equipo, 3140 + rec(sol).panels.n * 400); });   // cuando haya precio, suma

// ── message: orden fijo, una opción, marca y modelo según pricing.showModel, termina con una pregunta ──
const URL = 'https://diestorn03.github.io/ssds-proyectos/dimensionar/?c=eyJlIjp7Im5ldmVyYSI6MX19&o=r&w=mes&via=ig';
const full = run({ items: presets.find((p) => p.id === 'esencial').items, hours: 8, place: 'casa', city: 'Maracay', install: 'instalado', transfer: 'quiero', extraM: 4, preset: 'esencial', when: 'mes', via: 'ig', url: URL });
assert.equal(full.message, [
  'Hola SSD&S, dimensioné mi respaldo en su web.',
  '• Punto de partida: Lo esencial',
  '• Equipos: nevera ×1, router ×1, LED ×6, TV ×1, ventilador ×2, cargador ×2',
  '• Corte a cubrir: 8 h · Casa · Maracay',
  '• Opción recomendada: inversor híbrido 3 kW (110 V) IVEM3048-LV + 1 batería de litio de 5,12 kWh FLA48100-EU → ≈ 9,8 h · se recarga en ≈ 1,6 h',
  '• Precio referencial: US$ 1.695 solo equipo · ≈ US$ 2.595 instalado (estimado, por confirmar)',
  '• Instalación: kit básico hasta 2 m del tablero · transferencia: la quiero · +4 m de cable (se confirman en la visita)',
  '• Para cuándo: este mes',
  '• Vía: Instagram',
  `Mi configuración: ${URL}`,
  '¿Me confirman disponibilidad y coordinamos la visita técnica?',
].join('\n'));
const order = ['Hola SSD', '• Punto de partida', '• Equipos', '• Corte a cubrir', '• Opción', '• Precio referencial', '• Instalación', '• Paneles', '• Ojo', '• Confirmar', '• Para cuándo', '• Vía', 'Mi configuración', '¿Me confirman'];
const ful2 = run({ items: { aa18c: 1, nevera: 1, tv: 1 }, hours: 8, solar: true, install: 'instalado', transfer: 'quiero', extraM: 3, preset: 'aire', when: 'sem', via: 'dx', url: URL }).message.split('\n');
const idx = order.map((p) => ful2.findIndex((l) => l.startsWith(p)));
assert.ok(idx.every((i) => i >= 0), `faltan líneas: ${idx}`); assert.deepEqual(idx, [...idx].sort((x, y) => x - y)); assert.equal(idx[0], 0); assert.equal(ful2.at(-1), '¿Me confirman disponibilidad y coordinamos la visita técnica?');
// la opción elegida manda: tier en el mensaje, con SU inversor, baterías y precio
const hol = run({ items: presets.find((p) => p.id === 'esencial').items, hours: 8, install: 'instalado', tier: 'holgado' });
assert.equal(hol.chosen, 'holgado'); assert.match(hol.message, /• Opción holgada: inversor híbrido 6 kW \(120\/240 V\) PV3300 \+ 1 batería de litio de 11,78 kWh FLA48230-EU → ≈ 22,4 h · se recarga en ≈ 2,6 h/);
assert.match(hol.message, /US\$ 3\.140 solo equipo · ≈ desde US\$ 3\.990 instalado/); assert.doesNotMatch(hol.message, /recomendada/);
const bas = run({ items: C.__a.items, hours: 12, tier: 'basico' });
assert.equal(bas.chosen, 'basico'); assert.match(bas.message, /• Opción básica: .* → ≈ 8,5 h · cubre ≈ [\d,]+ de tus 12 h · se recarga/);   // la Básica nunca se presenta como si cubriera todo
const sinBasica = run({ items: presets.find((p) => p.id === 'aire').items, hours: 8, tier: 'basico' });   // con la nevera a 230 W seguidos, 'Casa con un aire' ya no tiene escalón más barato
assert.equal(opt(sinBasica, 'basico'), undefined); assert.equal(sinBasica.chosen, 'recomendado'); assert.match(sinBasica.message, /• Opción recomendada:/);   // el tier pedido no existe → la más cercana
assert.equal(run({ items: { nevera: 1 }, tier: 'holgado' }).chosen, 'holgado'); assert.equal(run({ items: { nevera: 1 }, tier: 'cualquiera' }).chosen, 'recomendado');
assert.equal(size({ items: Bitems, hours: 8 }).summary.sayWhatRuns, size({ items: Bitems, hours: 8, tier: 'recomendado' }).summary.sayWhatRuns);
assert.doesNotMatch(B.message, /Punto de partida|Para cuándo|Vía|Mi configuración/);   // sin preset / when / via / url no aparecen sus líneas
assert.match(run({ items: { nevera: 1 }, preset: 'cero' }).message, /• Punto de partida: Desde cero/);
for (const [w, t] of [['sem', 'esta semana'], ['mes', 'este mes'], ['exp', 'explorando']]) assert.match(run({ items: { nevera: 1 }, when: w }).message, new RegExp(`• Para cuándo: ${t}\\n`));
// recorte contando la URL: peor caso (lista enorme, textos largos, URL de 480, todas las líneas opcionales) < 1200 y con el enlace entero
const URL700 = `https://diestorn03.github.io/ssds-proyectos/dimensionar/?c=${'A'.repeat(421)}`; assert.equal(URL700.length, 480);   // el máximo que acepta clean()
const worst = run({
  items: { led: 20, router: 20, cargador: 20, ventilador: 3, tv: 2, camaras: 2, laptop: 2, starlink: 1, aa18c: 1, nevera: 1 },
  custom: Array.from({ length: 20 }, (_, i) => ({ t: `Equipo número ${i + 1} con nombre largo de prueba!`, w: 10, n: 1 })),
  hours: 12, hot: true, solar: true, place: 'negocio', city: 'Maracay, La Floresta, calle 5, casa 12', install: 'instalado', transfer: 'quiero', extraM: 100,
  preset: 'completa', tier: 'holgado', when: 'sem', via: 'dx', url: URL700,
});
assert.ok(worst.message.length < 1200, `peor caso ${worst.message.length}`); assert.ok(worst.message.includes(`Mi configuración: ${URL700}`)); assert.match(worst.message, /• Equipos: .*(y \d+ más|\d+ equipos)/); assert.match(worst.message, /• Vía: Diagnóstico/);
assert.ok(worst.outOfScope === null && worst.options.length >= 1, 'el peor caso es un resultado real, no fuera de alcance');
const nourl = run({ items: { nevera: 1 }, url: `https://x.io/${'a'.repeat(468)}` }); assert.doesNotMatch(nourl.message, /Mi configuración/);   // una URL que no cabe se descarta entera
const all = run({ items: Object.fromEntries(loads.map((l) => [l.id, 20])), custom: [{ t: 'Equipo con un nombre bastante largo para probar', w: 900, n: 3 }], hours: 24, city: 'Maracay, La Floresta', place: 'negocio', url: URL700, via: 'ig' });
assert.ok(all.outOfScope); assert.ok(all.message.length < 1200); assert.match(all.message, /Equipo con un nombre bastante largo para 900 W ×3|\d+ equipos|y \d+ más/); assert.ok(all.message.includes(URL700));
const long = run({ custom: Array.from({ length: 25 }, (_, i) => ({ t: `Equipo número ${i + 1} con nombre largo de prueba`, w: 100, n: 1 })), hours: 8, city: 'Maracay, La Floresta', place: 'negocio', url: URL });
assert.ok(long.message.length < 1200, `long ${long.message.length}`); assert.match(long.message, /y \d+ más/);   // lista recortada, el resto intacto
assert.match(long.message, /Opción recomendada/); assert.match(long.message, /\?$/); assert.ok(long.message.includes(URL));
// marca y modelo (pricing.showModel, POR CONFIRMAR Q3): true por defecto; false → nombres genéricos
assert.match(B.message, /Opción recomendada: inversor híbrido 6 kW \(120\/240 V\) PV3300 \+ 1 batería de litio de 11,78 kWh FLA48230-EU → ≈ 9,8 h · se recarga en ≈ 5,9 h/);
withPricing({ showModel: false }, () => { const m = size({ items: Bitems, hours: 8 }).message; assert.match(m, /Opción recomendada: inversor híbrido 6 kW \(120\/240 V\) \+ 1 batería de litio de 11,78 kWh →/); assert.doesNotMatch(m, /IVEM|FLA|PV3300|Roccia|Más elegida/); });
assert.match(B.message, /• Equipos: nevera ×1, aire 12k ×1, TV ×1, router ×1, LED ×8/);
assert.match(B.message, /• Corte a cubrir: 8 h\n/); assert.match(B.message, /Precio referencial: US\$ 3\.140 solo equipo/); assert.match(B.message, /\?$/);
assert.doesNotMatch(B.message, /Holgad|Básic/);
assert.match(run({ items: { nevera: 1 }, hours: 4, city: 'Turmero', place: 'casa' }).message, /• Corte a cubrir: 4 h · Casa · Turmero\n/);
assert.match(rec(B).why[0], /Inversor de 6 kW: cubre ≈ 1,7 kW continuos y el arranque de aire 12k/);
assert.match(B.summary.sayWhatRuns, /^Cubre tu corte de 8 h con aire 12k, nevera, TV, LED ×8.*\.$/);
assert.ok(F.hints.some((h) => /^Tu aire 24\.000 BTU convencional arranca/.test(h)), 'siglas intactas');
const otro = run({ items: { nevera: 1 }, custom: [{ t: 'Horno', w: 1500, n: 1 }, { t: 'Starlink Mini', w: 30, n: 1 }], hours: 4 });
assert.match(otro.message, /• Equipos: nevera ×1, Horno 1\.500 W ×1, Starlink Mini 30 W ×1/);
for (const r of seen) assert.doesNotMatch(r.message + r.hints.join(' ') + r.options.map((o) => [o.review, ...o.why].join(' ')).join(' '), /Más elegida|6-8 h|horario laboral|garantía|Zelle|Binance|Bs\./i);   // prohibidos en cualquier texto (docs/CONCEPTO.md)

// ── estado compartible: el preset viaja en el enlace (r); tier / when / via / url NO ──
const st = { items: { nevera: 1, aa18c: 1, aa24i: 1, led: 8 }, custom: [{ t: 'Cava', w: 350, n: 1, m: true, h: 3 }, { t: 'Lámpara', w: 100, n: 2 }], hours: 12, v220: { aa18c: true, aa24i: false }, place: 'casa', hot: true, solar: true, install: 'instalado', transfer: 'quiero', extraM: 4, city: 'Cagua', preset: 'aire' };
const enc = encodeState(st);
assert.match(enc, /^[A-Za-z0-9_-]+$/); assert.ok(enc.length < 340, `state ${enc.length}`);
const dec = decodeState(enc);
assert.deepEqual(dec.items, st.items); assert.deepEqual(dec.custom, st.custom); assert.deepEqual(dec.v220, st.v220);   // el "no es de 220" también viaja
assert.deepEqual([dec.hours, dec.place, dec.hot, dec.solar, dec.install, dec.transfer, dec.extraM, dec.city, dec.preset], [12, 'casa', true, true, 'instalado', 'quiero', 4, 'Cagua', 'aire']);
assert.deepEqual([dec.tier, dec.when, dec.via, dec.url], [null, null, null, null]);
assert.deepEqual(size(dec), size(st));
assert.equal(encodeState({ ...st, tier: 'holgado', when: 'mes', via: 'ig', url: 'https://x.io/a' }), enc, 'tier / when / via / url no entran al enlace');
assert.equal(decodeState(encodeState({ items: { nevera: 1 }, preset: 'cero' })).preset, 'cero'); assert.equal(decodeState(encodeState({ items: { nevera: 1 }, preset: 'nada' })).preset, null);
assert.notEqual(encodeState({ items: { nevera: 1 }, preset: 'esencial' }), encodeState({ items: { nevera: 1 } }));
assert.equal(decodeState(encodeState()).hours, 8);
assert.equal(decodeState('%%%'), null); assert.equal(decodeState(''), null); assert.equal(decodeState(undefined), null);
assert.equal(decodeState(encodeState({ items: { nevera: 1 } })).items.nevera, 1);
assert.match(decodeState(encodeState({ city: 'Güigüe' })).city, /Güigüe/);
const junk = decodeState(encodeState({ items: { nevera: 1 }, place: 'constructor', transfer: 'valueOf' }));
assert.deepEqual([junk.place, junk.transfer], [null, 'no']);
for (const a of [st, { items: Bitems, hours: 8 }, { items: C.__a.items, hours: 12, install: 'instalado', preset: 'negocio' }]) assert.deepEqual(decodeState(encodeState(decodeState(encodeState(a)))), decodeState(encodeState(a)), 'encode/decode ida y vuelta');

// ── formato ──
assert.equal(fmtUSD(1400), 'US$ 1.400'); assert.equal(fmtUSD(570), 'US$ 570'); assert.equal(fmtUSD(2669.6), 'US$ 2.670'); assert.equal(fmtUSD(0), 'US$ 0');
assert.equal(fmtUSD2(1200), 'US$ 1.200,00'); assert.equal(fmtUSD2(954), 'US$ 954,00'); assert.equal(fmtUSD2(1234567.5), 'US$ 1.234.567,50'); assert.equal(fmtUSD2(0.5), 'US$ 0,50'); assert.equal(fmtUSD2(1000), 'US$ 1.000,00');

// ── los 19 presupuestos reales con instalación ([NN]) frente al motor ──
// w × h = la carga que declara su nota (decl) o, "circular", la que sale de las horas que él imprime (kWh nominales ÷ h): ahí el acierto
// es en parte por construcción, pero comprueba precios, tramos de instalación y reglas del dueño. kw = su inversor (13: 2 × 6 kW),
// kwh = su banco nominal, total = lo que cobró (equipo + kit + mano de obra). 220 V no se marca: solo el 120/240 llega a esas potencias.
const SCENARIOS = [
  { id: '00', w: 4000, h: 6, kw: 8, kwh: 23.6, total: 8100, decl: true }, { id: '02', w: 600, h: 6, kw: 1.6, kwh: 3.58, total: 1980 },
  { id: '03', w: 1460, h: 7, kw: 3, kwh: 10.24, total: 3795 }, { id: '04', w: 1800, h: 6, kw: 6, kwh: 11.8, total: 3904, decl: true },
  { id: '05', w: 1710, h: 6, kw: 3, kwh: 10.24, total: 3795 }, { id: '06', w: 1710, h: 6, kw: 3, kwh: 10.24, total: 3795 },
  { id: '08', w: 4000, h: 6, kw: 8, kwh: 39.6, total: 11205, decl: true }, { id: '09', w: 1800, h: 6, kw: 6, kwh: 11.8, total: 4054, decl: true },
  { id: '10', w: 1710, h: 6, kw: 3, kwh: 10.24, total: 3795 }, { id: '11', w: 1460, h: 7, kw: 3, kwh: 10.24, total: 3795 },
  { id: '12', w: 850, h: 6, kw: 3, kwh: 5.12, total: 2595 }, { id: '13', w: 5330, h: 6, kw: 12, kwh: 32, total: 9778 },
  { id: '14', w: 600, h: 6, kw: 1.6, kwh: 3.58, total: 1960 }, { id: '15', w: 430, h: 6, kw: 2, kwh: 2.56, total: 1900 },
  { id: '17', w: 1280, h: 4, kw: 3, kwh: 5.12, total: 2595 }, { id: '18', w: 850, h: 6, kw: 3, kwh: 5.12, total: 2595 },
  { id: '19', w: 1800, h: 6, kw: 6, kwh: 11.8, total: 3904, decl: true }, { id: '20', w: 1800, h: 6, kw: 6, kwh: 11.8, total: 3954, decl: true },
  { id: '21', w: 2500, h: 6.5, kw: 8, kwh: 16, total: 6265, decl: true },
];
assert.equal(SCENARIOS.length, 19);
// Excepciones documentadas (no calibrar con ellas): [08] cobra dos baterías (39,6 kWh) para 4 kW y trae dos notas; [13] son DOS inversores de 6 kW con la carga inferida
// ("con ingeniería", un solo dato); [21] declara 2,5 kW con 220 V supuesto y él puso el 8 kW, mientras el Roccia de 6 kW ya da 2,4× de holgura.
const EXC = new Set(['08', '13', '21']);
let sameInv = 0;
for (const s of SCENARIOS) {
  const r = run({ custom: [{ t: 'Carga', w: s.w, n: 1 }], hours: s.h, install: 'instalado' }), R = rec(r), Bs = opt(r, 'basico'), H = opt(r, 'holgado');
  const pct = (R.totals.total - s.total) / s.total;
  assert.equal(r.outOfScope, null, s.id);
  if (R.inverter.kw === s.kw) sameInv++;
  if (!EXC.has(s.id)) { assert.equal(R.inverter.kw, s.kw, `[${s.id}] la Recomendada reproduce el inversor del dueño`); assert.ok(Math.abs(pct) <= 0.1, `[${s.id}] total ${R.totals.total} vs ${s.total} (${(pct * 100).toFixed(1)} %)`); near(R.batteries.kwh, s.kwh, s.kwh * 0.2, `[${s.id}] banco`); }
  if (s.id === '08') { assert.equal(R.inverter.kw, 8); assert.ok(pct < -0.1, '[08] cobró de más: dos baterías'); }
  if (s.id === '13') { assert.equal(R.inverter.kw, 8); assert.ok(Math.abs(pct) <= 0.15, '[13] un 8 kW cuesta lo mismo que sus dos 6 kW'); }
  if (s.id === '21') { assert.equal(R.inverter.model, 'ROCCIA-6K-120/220'); assert.ok(pct > -0.2 && pct < 0); }
  // Recomendada: horas nominales ≈ las que pidió; las reales (con pérdidas) quedan por debajo
  assert.ok(R.coverage >= K.quoteSlack && R.realH < R.autonomyH, `[${s.id}]`);
  // Básica nunca más cara; Holgada nunca más barata; ningún modelo sin available && priceEq > 0
  if (Bs) { assert.ok(Bs.totals.equipo < R.totals.equipo && Bs.totals.total <= R.totals.total, `[${s.id}] Básica`); assert.ok(Bs.coverage >= 0.65 * K.quoteSlack - 0.01); }
  if (H) { assert.ok(H.totals.equipo > R.totals.equipo && H.totals.total >= R.totals.total && H.coverageReal >= 1, `[${s.id}] Holgada`); }
  for (const o of r.options) { assert.ok(o.inverter.available && o.inverter.priceEq > 0 && bat(o.batteries.model).available && bat(o.batteries.model).priceEq > 0); assert.equal(o.totals.instalacion, pricing.install[o.inverter.tier].kit + pricing.install[o.inverter.tier].mo, 'instalación por tramo, una sola vez'); }
  // el PDF de la Recomendada cuadra con la tarjeta
  const q = quote({ custom: [{ t: 'Carga', w: s.w, n: 1 }], hours: s.h, install: 'instalado' }, { fecha: '2026-10-04' });
  assert.equal(q.total, R.totals.total); assert.deepEqual(q.lines.map((l) => l.n), [1, 2, 3, 4]);
}
assert.equal(sameInv, 17, 'Recomendada = inversor del dueño en 17 de 19 (salvo [13] y [21])');
assert.ok(SCENARIOS.filter((s) => !EXC.has(s.id)).length === 16);

// ── quote(): presupuesto del PDF ──
const QA = { items: Bitems, hours: 8, install: 'instalado' };
const q1 = quote(QA, { cliente: 'María Pérez', fecha: '2026-10-04', url: URL });
assert.equal(q1.titulo, 'PRESUPUESTO'); assert.equal(q1.fechaTexto, 'Maracay, 4 de octubre de 2026'); assert.equal(q1.cliente, 'María Pérez'); assert.equal(q1.url, URL);
assert.deepEqual(q1.empresa, { name: 'SERVICIOS Y SUMINISTROS D&S, C.A.', rif: 'J-40625203-4' }); assert.equal(q1.provisional, true); assert.equal(q1.abono, 0);
assert.match(q1.numero, /^P-261004-[0-9A-Z]{4}$/);
assert.equal(q1.lines.length, 4);   // 1 inversor, 2 baterías, 3 kit, 4 mano de obra
assert.deepEqual(q1.lines.map((l) => [l.n, l.und, l.cant, l.precio, l.total]), [[1, 'PZA', 1, 990, 990], [2, 'PZA', 1, 2150, 2150], [3, 'KIT', 1, 500, 500], [4, 'ACT', 1, 350, 350]]);
assert.equal(q1.lines[0].desc, 'Inversor híbrido Roccia PV3300 · 6.000 W · 120/240 V');
assert.equal(q1.lines[1].desc, 'Batería de litio Felicity Solar FLA48230-EU · 11,78 kWh · 48 V · BMS inteligente con breaker y fusible · 6.000 ciclos profundos');
assert.equal(q1.lines[2].desc, pricing.kitDesc.cargas); assert.equal(q1.lines[3].desc, pricing.laborDesc.cargas);
assert.deepEqual([q1.subtotal, q1.total], [3990, 3990]); assert.equal(q1.total, rec(Bi).totals.total); assert.equal(q1.incompleto, false);
assert.deepEqual(q1.sistema, { inversor: 'Roccia PV3300', baterias: 1, kwh: 11.78, kw: 6 });
assert.equal(q1.notas[0], 'Esta capacidad cubre una necesidad estimada de 8 horas continuas en 120 V acorde a la solicitud del cliente.');
assert.match(q1.notas[1], /^Equipos considerados: aire 12k, nevera, TV, LED ×8/);
assert.ok(q1.notas.includes('Sugerencia: aire acondicionado tipo inverter de 12.000 BTU.'), 'aire convencional → sugerencia de inverter');
assert.ok(q1.notas.some((n) => /precio referencial: según el recorrido va de US\$ 850 a US\$ 1\.000/.test(n)), 'el Roccia tiene rango de instalación');
assert.deepEqual(q1.garantias, pricing.warranty); assert.equal(q1.pagos, pricing.payment);
assert.doesNotMatch(q1.pagos + q1.garantias.join(' '), /[A-Z]{6,}/, 'bien redactado, no todo en mayúsculas'); assert.doesNotMatch(q1.lines.map((l) => l.desc).join(' '), /[A-Z]{8,}/);
assert.doesNotMatch(JSON.stringify(q1), /factura/i, 'presupuesto, nunca factura');
// determinista y sensible a lo que cambia el sistema
assert.equal(quote(QA, { fecha: '2026-10-04' }).numero, q1.numero, 'mismo trabajo, mismo número'); assert.equal(quote(QA, { cliente: 'Otro', fecha: '2026-10-04', url: 'https://x.io/' }).numero, q1.numero, 'cliente y url no cambian el número');
assert.equal(quote({ ...QA, tier: 'recomendado' }, { fecha: new Date(2026, 9, 4, 18, 30) }).numero, q1.numero, 'la fecha puede ser Date; tier por defecto = recomendada');
assert.notEqual(quote(QA, { tier: 'holgado', fecha: '2026-10-04' }).numero, q1.numero); assert.notEqual(quote({ ...QA, hours: 6 }, { fecha: '2026-10-04' }).numero, q1.numero);
assert.match(quote(QA, { fecha: '2027-01-09' }).numero, /^P-270109-/); assert.equal(quote(QA, { fecha: '2027-01-09' }).fechaTexto, 'Maracay, 9 de enero de 2027');
assert.match(quote(QA).numero, /^P-\d{6}-[0-9A-Z]{4}$/); assert.match(quote(QA).fechaTexto, /^Maracay, \d{1,2} de [a-z]+ de \d{4}$/);
// cliente saneado: una línea, ≤ 60 caracteres, sin control ni emojis cortados; opcional
assert.equal(quote(QA, { cliente: '  Juan\n\t Pérez\u0000  ' }).cliente, 'Juan Pérez'); assert.equal(quote(QA).cliente, ''); assert.equal(quote(QA, { cliente: null }).cliente, ''); assert.equal(quote(QA, { cliente: 5 }).cliente, '5');
const nl = quote(QA, { cliente: 'N'.repeat(59) + '🙂🙂' }).cliente; assert.equal([...nl].length, 60); assert.ok(nl.isWellFormed());
assert.equal(quote(QA, { cliente: '<b>Ana</b>' }).cliente, '<b>Ana</b>', 'texto tal cual: el PDF lo dibuja, no lo interpreta');
assert.equal(quote(QA, { url: 'javascript:alert(1)' }).url, null); assert.equal(quote(QA).url, null);
// solo equipo: sin kit ni mano de obra
const q2 = quote({ items: Bitems, hours: 8, install: 'equipo' }, { fecha: '2026-10-04' });
assert.equal(q2.lines.length, 2); assert.ok(q2.lines.every((l) => l.und === 'PZA')); assert.equal(q2.total, 3140); assert.doesNotMatch(q2.lines.map((l) => l.desc).join('|'), /Kit|Mano de obra/); assert.equal(q2.incompleto, false);
assert.equal(q2.total, q1.total - 850, 'solo equipo = instalado − kit − mano de obra');
// 'solo mano de obra' y pendientes sin cifra: renglón con la leyenda y sin importe
const q3 = quote({ items: Bitems, hours: 8, install: 'manoObra', transfer: 'quiero', extraM: 3 }, { fecha: '2026-10-04' });
assert.deepEqual(q3.lines.map((l) => [l.n, l.und, l.precio]), [[1, 'PZA', 990], [2, 'PZA', 2150], [3, 'ACT', null], [4, 'KIT', null], [5, 'ACT', null]]);
assert.ok(q3.lines.slice(2).every((l) => /Se confirma en la visita$/.test(l.desc) && l.total === null)); assert.equal(q3.total, 3140); assert.equal(q3.subtotal, 3140); assert.equal(q3.incompleto, true);
assert.match(q3.lines[4].desc, /\+3 m/);
// descripciones genéricas con showModel false
withPricing({ showModel: false }, () => {
  const q = quote({ items: { nevera: 1, router: 1, led: 6, tv: 1 }, hours: 6, install: 'instalado' }, { fecha: '2026-10-04' });
  assert.equal(q.lines[0].desc, `Inversor híbrido ${String(q.sistema.kw).replace('.', ',')} kW · ${q.lines[0].desc.match(/· (\d+) V/)[1]} V · 120 V`); assert.doesNotMatch(q.lines[0].desc + q.lines[1].desc + q.sistema.inversor, /Felicity|Roccia|IVEM|FLA|PV3300/);
  assert.match(q.lines[1].desc, /^Batería de litio [\d,]+ kWh · \d+ V · BMS/);
});
// con 220 V: "120/240 V" en la nota; Básica y Holgada: lo que cubre de verdad
assert.match(quote({ items: { aa18i: 1, nevera: 1 }, hours: 8, v220: { aa18i: true } }).notas[0], /en 120\/240 V acorde/);
const qb = quote({ items: Bitems, hours: 6, tier: 'basico' });   // la Básica cubre 4,3 de las 6 h: el documento dice 4 (medias horas hacia abajo), nunca las 6 (a 7 h o más, con la nevera a 230 W seguidos, ya no hay Básica)
assert.match(qb.notas[0], /estimada de 4 horas continuas/); assert.equal(qb.total, 990 + 1200); assert.equal(qb.lines[1].desc.includes('FLA48100-EU'), true);
const qh = quote({ items: Bitems, hours: 7, tier: 'holgado', install: 'instalado' }); assert.equal(qh.total, 6265); assert.equal(qh.lines[2].precio, 500); assert.equal(qh.lines[3].precio, 500);   // el 8 kW: kit 500 + MO 500
// una hora cubierta se escribe en singular y las medias horas con coma
assert.match(quote({ items: { led: 1 }, hours: 1 }).notas[0], /de 1 hora continua en 120 V/); assert.match(quote({ items: { nevera: 1, tv: 1 }, hours: 6.5 }).notas[0], /de 6,5 horas continuas/);

if (process.argv.includes('--table')) {   // los 19 presupuestos reales frente a Recomendada / Básica / Holgada (ver SCENARIOS más abajo)
  const f = (n) => Math.round(n).toLocaleString('es-VE');
  const cell = (o) => (o ? `${o.inverter.kw} kW + ${o.batteries.n}×${o.batteries.model.replace(/-EU$|TG2-EU$/, '')} (${o.batteries.kwh} kWh) · ${o.autonomyH} h nom / ${o.realH} h real · US$ ${f(o.totals.total)}` : '—');
  console.log('| [NN] | Dueño | Recomendada | Básica | Holgada |\n|---|---|---|---|---|');
  for (const s of SCENARIOS) {
    const r = size({ custom: [{ t: 'Carga', w: s.w, n: 1 }], hours: s.h, install: 'instalado' });
    console.log(`| [${s.id}] ${s.w / 1000} kW × ${s.h} h | ${s.kw} kW + ${s.kwh} kWh · US$ ${f(s.total)} | ${cell(opt(r, 'recomendado'))} | ${cell(opt(r, 'basico'))} | ${cell(opt(r, 'holgado'))} |`);
  }
}

// ── 5 oct 2026 (David): validez, bombas con pregunta de 220 V, fotos presentes para todo lo que se ofrece ──
const qv = quote({ items: Bitems, hours: 8 });
assert.equal(qv.validez, '3 días'); assert.ok(qv.notas.every((n) => !/Validez/.test(n)), 'la validez va en el encabezado del PDF, no como renglón de notas (empujaba presupuestos a una 2.ª hoja)');
withPricing({ validityDays: 1 }, () => assert.equal(validezTxt(), '1 día')); withPricing({ validityDays: null }, () => assert.equal(validezTxt(), null));
assert.ok(loads.filter((l) => l.hp).every((l) => l.v220 === 'ask'), 'bombas e hidroneumático preguntan si son de 220 V');
assert.ok(rec(run({ items: { nevera: 1, bomba1: 1 }, hours: 4, v220: { bomba1: true } })).inverter.ac.includes('240'), 'una bomba de 220 V obliga a un inversor 120/240 V');
assert.equal(loads.find((l) => l.id === 'nevera').duty, 1); assert.equal(loads.find((l) => l.id === 'freezer').w, NEV);   // neveras y freezer: 230 W todo el tiempo
for (const x of [...inverters, ...batteries].filter((e) => e.available)) {   // el slug de la foto: modelo en minúsculas y "/" → "-" (lo usan la página y el PDF)
  const slug = x.model.toLowerCase().replaceAll('/', '-');
  for (const ext of ['webp', 'jpg']) assert.ok(existsSync(new globalThis.URL(`../../public/equipos/${slug}.${ext}`, import.meta.url)), `falta public/equipos/${slug}.${ext}`);
}

console.log('dimensionar.check: ok');
