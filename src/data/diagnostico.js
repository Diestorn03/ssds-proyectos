// Diagnóstico rápido: preguntas y reglas puras (sin DOM). Usado por components/home/Diagnostico.astro y
// scripts/diagnostico.js. Autoprueba: node src/data/diagnostico.check.mjs
// Todo lo que se afirma sale de docs/BRIEF.md; la pista de tensión es explícitamente orientativa.
import { services } from './site.js';

/** Las 4 preguntas. `t` es la etiqueta visible y la que viaja en el mensaje de WhatsApp (con `d` entre paréntesis); `s` es la versión corta del resumen. */
export const questions = [
  {
    id: 'lugar', type: 'radio', step: 'Instalación', legend: '¿Dónde está la instalación?', help: 'Elige una opción.',
    options: [
      { v: 'residencial', t: 'Residencial', icon: 'home' },
      { v: 'comercial', t: 'Comercial', icon: 'building' },
      { v: 'industrial', t: 'Industrial', icon: 'factory' },
    ],
  },
  {
    id: 'necesidad', type: 'checkbox', step: 'Necesidad', legend: '¿Qué necesitas resolver?', help: 'Puedes marcar varias.',
    options: [
      { v: 'respaldo', t: 'Respaldo ante cortes', d: 'planta eléctrica / ATS', icon: 'generator' },
      { v: 'red', t: 'Red eléctrica o transformador', d: 'media / baja tensión', icon: 'transformer' },
      { v: 'clima', t: 'Aire acondicionado, chillers o unidades de precisión', icon: 'snowflake' },
      { v: 'mantenimiento', t: 'Mantenimiento o consumibles de planta eléctrica', icon: 'wrench' },
      { v: 'inspeccion', t: 'Inspección / no estoy seguro', icon: 'gauge' },
    ],
  },
  {
    id: 'planta', type: 'radio', step: 'Planta', legend: '¿Tienes planta eléctrica?', help: 'Elige una opción.',
    options: [
      { v: 'no', t: 'No', s: 'Sin planta eléctrica', icon: 'plug' },
      { v: 'manual', t: 'Sí, con transferencia manual', s: 'Transferencia manual', icon: 'switch' },
      { v: 'ats', t: 'Sí, con transferencia automática (ATS)', s: 'Transferencia automática (ATS)', icon: 'ats' },
      { v: 'nose', t: 'No lo sé', s: 'Planta: no lo sé', icon: 'question' },
    ],
  },
  {
    id: 'tamano', type: 'radio', step: 'Tamaño', legend: '¿Qué tamaño tiene tu operación?', help: 'Elige una opción.',
    options: [
      { v: 'residencia', t: 'Residencia o local', icon: 'home' },
      { v: 'comercio', t: 'Comercio, oficinas o sala de cómputo', icon: 'building' },
      { v: 'industria', t: 'Planta industrial o centro comercial', icon: 'factory' },
    ],
  },
];

/** Zonas del medidor (prioridad sugerida, 0..100). */
export const zones = [
  { from: 0, to: 40, label: 'Programable' },
  { from: 40, to: 70, label: 'Recomendado' },
  { from: 70, to: 101, label: 'Prioritario' },
];
export const zoneOf = (p) => zones.find((z) => p >= z.from && p < z.to).label;

const P = 'potencia-electrica', R = 'respaldo-energetico', C = 'climatizacion';

const REASON = {
  respaldo: {
    no: 'Para no quedarte sin energía en un corte: instalación de planta eléctrica y un tablero de transferencia automática (ATS) a la carga exacta de tu operación.',
    manual: 'Tu transferencia es manual: depender de un operador durante una falla cuesta minutos valiosos. Un tablero ATS a tu medida hace el cambio de fuente de forma inmediata y segura.',
    ats: 'Ya tienes ATS: mantenimiento preventivo, pruebas de banco de carga y revisión de la transferencia para que responda en el próximo corte.',
    nose: 'Revisamos tu planta y su tablero para saber si te conviene una transferencia automática (ATS).',
    any: 'Plantas eléctricas y tableros de transferencia automática (ATS) a la medida de tu carga.',
  },
  red: 'Ingeniería en media y baja tensión, montaje de transformadores y mantenimiento de redes bajo normativa.',
  clima: 'Instalación, reparación y mantenimiento preventivo de aire acondicionado central, chillers y unidades de precisión.',
  mantenimiento: 'Mantenimiento preventivo y correctivo con banco de carga, calibración de parámetros y consumibles originales (filtros, lubricantes, repuestos).',
  inspeccion: 'Inspección de red eléctrica: evaluamos tus instalaciones para detectar riesgos antes de que se conviertan en paradas.',
};

const TENSION = {
  residencia: 'Orientativo: una residencia o un local suele trabajar en baja tensión; lo confirmamos con una inspección.',
  comercio: 'Orientativo: según tu demanda puede bastar la baja tensión o hacer falta media tensión; lo confirmamos con una inspección y el dimensionamiento de tu carga.',
  industria: 'Orientativo: por el tamaño de tu operación, evalúa media tensión (transformador o subestación); lo confirmamos con una inspección.',
};

// ponytail: hand-tuned weights for an illustrative needle, not a technical score. Tune here.
const WEIGHT = {
  lugar: { residencial: 10, comercial: 18, industrial: 26 },
  necesidad: { respaldo: 18, red: 16, clima: 10, mantenimiento: 10, inspeccion: 8 },
  planta: { no: 4, manual: 20, ats: 2, nose: 10 },
  tamano: { residencia: 4, comercio: 10, industria: 18 },
};

const label = (qid, v) => {
  const o = questions.find((q) => q.id === qid).options.find((x) => x.v === v);
  return o ? (o.d ? `${o.t} (${o.d})` : o.t) : '';
};
const list = (items) => new Intl.ListFormat('es', { type: 'conjunction' }).format(items);

/**
 * answers = { lugar, necesidad: [], planta, tamano } (cualquiera puede faltar mientras se responde).
 * → { services: [{ slug, reason }], hints: [string], priority: 0..100, ats: boolean, message }
 */
export function recommend(answers = {}) {
  const { lugar, planta, tamano } = answers;
  const needs = answers.necesidad || [];
  const has = (v) => needs.includes(v);
  const picked = new Map();
  const add = (slug, reason) => picked.set(slug, [...(picked.get(slug) || []), reason]);

  if (has('respaldo')) add(R, REASON.respaldo[planta] || REASON.respaldo.any);
  if (has('red')) add(P, REASON.red);
  if (has('clima')) add(C, REASON.clima);
  if (has('mantenimiento')) add(R, REASON.mantenimiento);
  if (has('inspeccion')) add(P, REASON.inspeccion);
  if (planta === 'manual' && !has('respaldo')) add(R, REASON.respaldo.manual);   // a manual transfer is always worth flagging

  const ats = planta === 'manual' || (planta === 'no' && has('respaldo'));
  const hints = [];
  if (TENSION[tamano]) hints.push(TENSION[tamano]);
  if (has('mantenimiento')) hints.push('Ten a mano el modelo de tu planta: así te cotizamos los consumibles correctos.');
  if (planta === 'nose') hints.push('Si no sabes qué transferencia tiene tu planta, la revisamos en la visita técnica.');

  let priority = (WEIGHT.lugar[lugar] || 0) + (WEIGHT.planta[planta] || 0) + (WEIGHT.tamano[tamano] || 0)
    + needs.reduce((s, n) => s + (WEIGHT.necesidad[n] || 0), 0);
  if (planta === 'no' && has('respaldo')) priority += 12;   // wants backup and has none
  priority = Math.max(0, Math.min(100, priority));

  const out = [...picked].map(([slug, reasons]) => ({ slug, reason: reasons.join(' ') }));
  const names = out.map((s) => services.find((x) => x.slug === s.slug).short);
  const message = [
    'Hola SSD&S, hice el diagnóstico rápido en su web.',
    lugar && `• Instalación: ${label('lugar', lugar)}`,
    needs.length && `• Necesito: ${needs.map((n) => label('necesidad', n)).join('; ')}`,
    planta && `• Planta eléctrica: ${label('planta', planta)}`,
    tamano && `• Tamaño de la operación: ${label('tamano', tamano)}`,
    names.length && `Servicios sugeridos: ${list(names)}.`,
    ats && 'Me interesa evaluar un tablero de transferencia automática (ATS).',
    'Quiero coordinar una evaluación técnica.',
  ].filter(Boolean).join('\n');

  return { services: out, hints, priority, ats, message };
}
