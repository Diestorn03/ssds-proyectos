// Dimensionador de respaldo (inversor híbrido + baterías de litio): catálogo, constantes, reglas puras, mensaje de
// WhatsApp y presupuesto (quote). Sin DOM ni APIs de Node: lo importan el componente Astro, el controlador, el generador
// del PDF y la autoprueba (node src/data/dimensionar.check.mjs). Todo número que ve el cliente es orientativo: la visita
// técnica lo confirma.
//
// Precios = PRECIOS DE VENTA de los presupuestos reales del dueño ("// FUENTE: presupuestos [NN]"; los [NN] son los números
// de la carpeta de análisis, nunca nombres de clientes). Aquí solo hay lo que se cobra al cliente.
// Instalación (pricing.installMode 'tier'): kit + mano de obra por tramo de inversor, UNA vez por sistema. Kit de
// transferencia, metros extra y "solo mano de obra" van aparte (null = "se confirma en la visita"): no ocultan el total,
// viajan en totals.pending.
//
// Cómo cotiza el dueño y qué hace cada opción: la Recomendada reproduce al dueño (inversor con holgura K.recMargin y banco
// dimensionado con horas NOMINALES = kWh ÷ kW promedio, K.quoteFactor); la Holgada cubre las horas pedidas aun con las
// pérdidas normales (K.dod × K.eta) o sube de inversor si ya las cubre; la Básica es un escalón más barato. Cada opción
// expone autonomyH (nominal, la que se muestra y va al PDF) y realH (con pérdidas).
//
// Todo lo provisional lleva el comentario `// POR CONFIRMAR Qn` (n = número en docs/PREGUNTAS-DAVID.md): grep "POR CONFIRMAR".

export const K = {
  dod: 0.9,         // ponytail: la ficha da ≥ 95 % de descarga; 90 % deja margen al corte del BMS y alarga los ciclos
  eta: 0.9,         // ponytail: eficiencia pico de ficha 90–93 %; a carga parcial baja, 0,90 es el valor de diseño
  margin: 1.25,     // ponytail: regla del 125 % para carga continua (NEC 210.20 / 690.8): el inversor nunca al 100 %. // POR CONFIRMAR Q11 (un solo inversor; más es "con ingeniero")
  psh: 4.8,         // ponytail: horas de sol pico del mes más nublado de Maracay (nov., NASA POWER 2001–2020); anual 5,4
  pvDerate: 0.75,   // ponytail: off-grid con batería: cableado, celda a 60–70 °C sobre zinc, suciedad, MPPT
  chargeEta: 0.95,  // ponytail: eficiencia de carga LiFePO4; no entra en el banco, sí en cuánta energía hay que reponer (recarga y paneles)
  panelW: 580,      // panel del catálogo (sin precio ni disponibilidad: solo se sugiere la cantidad)
  simult: 'base+mayor', // ponytail: P_cont = lo que queda encendido (≥ 2 h) + el aparato grande de uso corto; nunca "todo a la vez". // POR CONFIRMAR Q7
  hotDuty: 1.3,     // ponytail: clima caluroso (> 32 °C, sol directo): los aires ciclan más (la nevera ya va al 100 %: tope Math.min(1, …)). // POR CONFIRMAR Q17
  plant: { wh: 20000, w: 8000, hAc: 12 }, // ponytail: umbrales para sugerir planta eléctrica (energía, potencia, horas con aire). // POR CONFIRMAR Q12
  quoteFactor: 1.0, // ponytail: fracción de los kWh de placa con la que se cuentan las horas NOMINALES (kWh ÷ kW promedio, como las imprime el dueño: 5,12 kWh a 1 kW = 5,12 h). La Recomendada y la Básica dimensionan el banco con esto; dod × eta (0,81) son las horas reales con pérdidas (realH) y dimensionan la Holgada. Modo conservador en una línea: quoteFactor = dod * eta. // FUENTE: presupuestos [03][05][06][10][11] (horas = kWh ÷ kW). David lo dio por bueno (5 oct 2026).
  maxAutonomyH: 72, // ponytail: tope de la autonomía publicada ("más de 72 h"): cifras de cientos de horas no son creíbles
  i15sDefault: 1.33, // ponytail: pico 15 s ≈ 1,33× la continua cuando la ficha no lo publica (único punto conocido: 150 A / 200 A); por confirmar con el manual
  tightShare: 0.8,  // ponytail: "justo" = el inversor trabaja a más del 80 % de lo que cubre la ficha (continuo con margen o pico); también marca checks.surgeTight
  quoteSlack: 0.98, // ponytail: el dueño redondea las horas: un banco que cubre ≥ 98 % de lo pedido cuenta como "6 h" ([00]: 23,6 kWh para 6 h a 4 kW = 5,9 h). Solo la Recomendada y la Básica; la Holgada exige 100 % con pérdidas. // FUENTE: presupuestos [00][02][14][15].
  recMargin: 1.75,  // ponytail: holgura COMERCIAL de la Recomendada: el inversor trabaja a <= 57 % de su potencia (asi vende David: 30-57 % en las notas con carga declarada; [04] 1,8 kW -> 6 kW, [00] 4 kW -> 8 kW). La tecnica sigue siendo K.margin (1,25): la Basica la usa. // POR CONFIRMAR Q21
  upgradeMaxPct: 0.1, // ponytail: si el inversor justo tiene un hermano mayor por ≤ 10 % más de precio, el mayor pasa a Recomendada
};

/** Primera línea del mensaje: David etiqueta en WhatsApp Business los chats que empiezan así. */
export const OPENING = 'Hola SSD&S, dimensioné mi respaldo en su web.'; // POR CONFIRMAR Q19 (no se le preguntó a David)

/**
 * Cargas curadas para Venezuela, en orden de prioridad (lo que la gente quiere mantener encendido).
 * t = nombre visible; s = corto para WhatsApp; w = vatios de placa (eléctricos, no mecánicos); surge = factor de
 * arranque POR EQUIPO (motores/compresores 3,5–5, inverter 1,3, resistivos 1); duty = ciclo de trabajo;
 * hUse = horas típicas de uso dentro de un corte (≥ 2 h cuenta como carga continua); v220 = false | 'ask' | true
 * ('ask' muestra el chip "¿es de 220?"); cold = sube con clima caluroso; btu = es aire acondicionado;
 * hp = bomba/motor; minKw = inversor mínimo (LRA real 4–6×: nunca prometer "arranca con 3 kW");
 * softStart = aire convencional ≥ 18k: siempre "sujeto a revisión" (soft-starter o equipo inverter);
 * engineer = fuera del cotizador ("requiere cotización con ingeniero"), con su `reason`.
 * Potencias, ciclos (duty) y arranques son típicos, no medidos en campo. David (5 oct 2026): neveras y freezer a 230 W todo el tiempo (duty 1: "las neveras inverter
 * no se apagan nunca, solo consumen menos"), aire de 12k a 1.200 W bien, 1 HP = 746 W (bomba 1 HP e hidroneumático; ½ HP = 373 W). Negocio (vitrinas, enfriador, freezer comercial) sin tocar.
 * v220 = 'ask' en los aires de 18k y 24k y en las bombas (David: "hay que aclarar si es de 110 o de 220"): ¿de 220 V o de 120 V?
 */
export const loads = [
  // esencial
  { id: 'nevera', t: 'Nevera', s: 'nevera', cat: 'esencial', w: 230, surge: 5, duty: 1, hUse: 24, v220: false, essential: true, icon: 'fridge', cold: true, note: 'Se cuenta a 230 W todo el tiempo (valor estándar de David: las neveras inverter nunca se apagan, solo bajan el consumo); el compresor arranca 5× por menos de un segundo.' },
  { id: 'freezer', t: 'Freezer / congelador', s: 'freezer', cat: 'esencial', w: 230, surge: 5, duty: 1, hUse: 24, v220: false, essential: true, icon: 'snowflake', cold: true },
  { id: 'router', t: 'Router / módem wifi', s: 'router', cat: 'esencial', w: 15, surge: 1, duty: 1, hUse: 24, v220: false, essential: true, icon: 'router' },
  { id: 'starlink', t: 'Starlink', s: 'Starlink', cat: 'esencial', w: 90, surge: 1, duty: 1, hUse: 24, v220: false, essential: true, icon: 'dish', note: 'Antena estándar 75–100 W; la Mini consume 20–30 W.' },
  { id: 'led', t: 'Bombillo LED', s: 'LED', cat: 'esencial', w: 10, surge: 1, duty: 1, hUse: 6, v220: false, essential: true, icon: 'bulb' },
  { id: 'cargador', t: 'Cargador de celular / tablet', s: 'cargador', cat: 'esencial', w: 10, surge: 1, duty: 1, hUse: 3, v220: false, essential: true, icon: 'phone' },
  { id: 'ventilador', t: 'Ventilador', s: 'ventilador', cat: 'esencial', w: 60, surge: 1.5, duty: 1, hUse: 10, v220: false, essential: true, icon: 'fan' },
  { id: 'tv', t: 'TV LED 40–55"', s: 'TV', cat: 'esencial', w: 80, surge: 1, duty: 1, hUse: 5, v220: false, essential: true, icon: 'tv' },
  { id: 'camaras', t: 'Cámaras de seguridad + DVR', s: 'cámaras', cat: 'esencial', w: 60, surge: 1, duty: 1, hUse: 24, v220: false, essential: true, icon: 'camera' },
  { id: 'porton', t: 'Portón eléctrico', s: 'portón', cat: 'esencial', w: 500, surge: 3, duty: 1, hUse: 0.1, v220: false, essential: true, icon: 'gate', note: 'Trabaja 20–30 s por ciclo: casi no gasta batería, pero su arranque cuenta.' },
  // agua
  { id: 'bomba05', t: 'Bomba de agua ½ HP', s: 'bomba ½ HP', cat: 'agua', w: 373, surge: 3.5, duty: 1, hUse: 0.5, v220: 'ask', essential: true, icon: 'pump', hp: 0.5, note: '½ HP son 373 W (la mitad de 746).' },
  { id: 'bomba1', t: 'Bomba de agua 1 HP', s: 'bomba 1 HP', cat: 'agua', w: 746, surge: 3.5, duty: 1, hUse: 0.5, v220: 'ask', essential: true, icon: 'pump', hp: 1, note: '1 HP son 746 W, a 120 o a 220 V; a 220 V la corriente es la mitad.' },
  { id: 'hidro', t: 'Hidroneumático 1 HP', s: 'hidroneumático', cat: 'agua', w: 746, surge: 3.5, duty: 0.4, hUse: 2, v220: 'ask', essential: true, icon: 'drop', hp: 1, note: 'Arranca cada vez que cae la presión: cuenta como carga continua.' },
  // clima
  { id: 'aa9c', t: 'Aire 9.000 BTU convencional', s: 'aire 9k', cat: 'clima', w: 900, surge: 4, duty: 0.6, hUse: 8, v220: false, essential: false, icon: 'ac', btu: 9000, cold: true },
  { id: 'aa9i', t: 'Aire 9.000 BTU inverter', s: 'aire 9k inv', cat: 'clima', w: 700, surge: 1.3, duty: 0.55, hUse: 8, v220: false, essential: false, icon: 'ac', btu: 9000, cold: true },
  { id: 'aa12c', t: 'Aire 12.000 BTU convencional', s: 'aire 12k', cat: 'clima', w: 1200, surge: 4, duty: 0.6, hUse: 8, v220: false, essential: false, icon: 'ac', btu: 12000, cold: true, minKw: 5 },
  { id: 'aa12i', t: 'Aire 12.000 BTU inverter', s: 'aire 12k inv', cat: 'clima', w: 900, surge: 1.3, duty: 0.55, hUse: 8, v220: false, essential: false, icon: 'ac', btu: 12000, cold: true },
  { id: 'aa18c', t: 'Aire 18.000 BTU convencional', s: 'aire 18k', cat: 'clima', w: 1800, surge: 5, duty: 0.6, hUse: 8, v220: 'ask', essential: false, icon: 'ac', btu: 18000, cold: true, minKw: 5, softStart: true },
  { id: 'aa18i', t: 'Aire 18.000 BTU inverter', s: 'aire 18k inv', cat: 'clima', w: 1400, surge: 1.3, duty: 0.55, hUse: 8, v220: 'ask', essential: false, icon: 'ac', btu: 18000, cold: true },
  { id: 'aa24c', t: 'Aire 24.000 BTU convencional', s: 'aire 24k', cat: 'clima', w: 2400, surge: 5, duty: 0.6, hUse: 8, v220: 'ask', essential: false, icon: 'ac', btu: 24000, cold: true, minKw: 5, softStart: true },
  { id: 'aa24i', t: 'Aire 24.000 BTU inverter', s: 'aire 24k inv', cat: 'clima', w: 1900, surge: 1.3, duty: 0.55, hUse: 8, v220: 'ask', essential: false, icon: 'ac', btu: 24000, cold: true },
  // trabajo
  { id: 'laptop', t: 'Laptop', s: 'laptop', cat: 'trabajo', w: 60, surge: 1, duty: 1, hUse: 6, v220: false, essential: true, icon: 'laptop' },
  { id: 'pc', t: 'PC de escritorio + monitor', s: 'PC', cat: 'trabajo', w: 230, surge: 1.2, duty: 1, hUse: 6, v220: false, essential: false, icon: 'pc' },
  // cocina y lavado
  { id: 'lavadora', t: 'Lavadora', s: 'lavadora', cat: 'cocina', w: 500, surge: 3, duty: 0.7, hUse: 1, v220: false, essential: false, icon: 'washer' },
  { id: 'microondas', t: 'Microondas', s: 'microondas', cat: 'cocina', w: 1300, surge: 1.3, duty: 1, hUse: 0.25, v220: false, essential: false, icon: 'microwave', note: 'De la red toma ≈ 1,3× la potencia de cocción de la placa.' },
  { id: 'licuadora', t: 'Licuadora', s: 'licuadora', cat: 'cocina', w: 400, surge: 2.5, duty: 1, hUse: 0.1, v220: false, essential: false, icon: 'blender' },
  // negocio
  { id: 'vitrina', t: 'Vitrina refrigerada', s: 'vitrina', cat: 'negocio', w: 600, surge: 4, duty: 0.5, hUse: 24, v220: false, essential: true, icon: 'showcase', cold: true },
  { id: 'enfriador', t: 'Enfriador de bebidas', s: 'enfriador', cat: 'negocio', w: 700, surge: 4, duty: 0.55, hUse: 24, v220: false, essential: true, icon: 'bottle', cold: true },
  { id: 'freezerCom', t: 'Freezer comercial / de helados', s: 'freezer comercial', cat: 'negocio', w: 350, surge: 4, duty: 0.45, hUse: 24, v220: false, essential: true, icon: 'icecream', cold: true },
  { id: 'pos', t: 'Punto de venta + impresora', s: 'POS', cat: 'negocio', w: 80, surge: 1, duty: 1, hUse: 12, v220: false, essential: true, icon: 'pos' },
  { id: 'pcCaja', t: 'PC de caja + monitor', s: 'PC de caja', cat: 'negocio', w: 200, surge: 1, duty: 1, hUse: 12, v220: false, essential: true, icon: 'register' },
  // otro (plantilla: la UI manda nombre, vatios y, si tiene motor, m/h en answers.custom; items.otro se ignora)
  { id: 'otro', t: 'Otro equipo', s: 'otro', cat: 'esencial', w: 100, surge: 1, duty: 1, hUse: 24, v220: false, essential: false, icon: 'plug', editable: true, note: 'Escribe los vatios que dice la placa. Si es un motor (bomba, compresor), márcalo para contar su arranque.' },
  // fuera del cotizador: chip "requiere cotización con ingeniero", sin cifra
  { id: 'cocina220', t: 'Cocina eléctrica 220 V', s: 'cocina 220 V', cat: 'cocina', w: 5000, surge: 1, duty: 0.5, hUse: 1.5, v220: true, essential: false, icon: 'stove', engineer: true, reason: 'una hora de cocina consume ≈ 2,5 kWh: no conviene respaldarla con baterías' },
  { id: 'secadora220', t: 'Secadora de ropa 220 V', s: 'secadora 220 V', cat: 'cocina', w: 5000, surge: 1.5, duty: 0.8, hUse: 1, v220: true, essential: false, icon: 'dryer', engineer: true, reason: 'cada carga consume ≈ 4 kWh: no conviene respaldarla con baterías' },
  { id: 'soldadora', t: 'Máquina de soldar', s: 'soldadora', cat: 'negocio', w: 4000, surge: 1.5, duty: 0.3, hUse: 1, v220: true, essential: false, icon: 'weld', engineer: true, reason: 'pide picos de corriente que exigen un estudio aparte' },
  { id: 'trifasico', t: 'Motor trifásico', s: 'motor trifásico', cat: 'negocio', w: 1500, surge: 6, duty: 0.8, hUse: 4, v220: true, essential: false, icon: 'motor', engineer: true, reason: 'necesita inversor trifásico o variador' },
];

/** Presets que precargan chips editables (el cliente quita o suma). `cero` ("Desde cero") no es un preset: la UI lo ofrece y el motor lo acepta en answers.preset. */
export const presets = [   // POR CONFIRMAR Q16 (negocio y oficina desde la primera versión; no se le preguntó a David)
  { id: 'esencial', t: 'Lo esencial', d: 'Nevera, wifi, luces, TV, ventiladores y celulares', items: { nevera: 1, router: 1, led: 6, tv: 1, ventilador: 2, cargador: 2 } },
  { id: 'aire', t: 'Casa con un aire', d: 'Lo esencial más un aire de 12.000 BTU', items: { nevera: 1, router: 1, led: 8, tv: 1, ventilador: 1, cargador: 2, aa12c: 1 } },
  { id: 'completa', t: 'Casa completa', d: 'Dos aires inverter, bomba, lavadora y microondas', items: { nevera: 1, router: 1, led: 10, tv: 2, ventilador: 2, cargador: 4, aa12i: 2, bomba1: 1, laptop: 1, lavadora: 1, microondas: 1 } },
  { id: 'negocio', t: 'Negocio pequeño', d: 'Vitrinas, enfriador, punto de venta, caja y cámaras', items: { vitrina: 2, enfriador: 1, pos: 1, pcCaja: 1, camaras: 1, led: 10, router: 1, ventilador: 2 } },
  { id: 'oficina', t: 'Oficina', d: 'Seis PCs, dos aires inverter, wifi y cámaras', items: { pc: 6, laptop: 2, router: 1, led: 10, camaras: 1, aa12i: 2, cargador: 4 } },
];

/**
 * Inversores (fichas oficiales verificadas). kSurge: IVCM 1,5 (casilla "Surge" vacía), IVEM 2× por 5 s, IVGM8K 1,2 (solo publica 40 A).
 * gridChargeA = corriente de carga desde la red; IVGM8K: 190 A es el máximo de batería, pero la entrada AC es 8.800 W → ≈ 170 A a 51,2 V.
 * idleW = consumo propio en vacío: ponytail, orden de magnitud típico de inversores de alta frecuencia; NO está en las fichas
 * descargadas, confirmar con el manual (entra en la autonomía, la energía a cubrir y la recarga).
 * disp = nombre comercial si difiere de model (el Roccia se vende como "PV3300"). Marca y modelo en el sitio y en el PDF: pricing.showModel (David: se puede mostrar todo).
 * La serie de 12/24 V (tier 'ivcm'): se imprime el nombre de la caja de David, IVCM2024-LV (la IVEM1612-LV queda con el nombre de sus presupuestos: no se vio su caja); se recarga de la red en 15 a 28 h.
 * POR CONFIRMAR Q10: kSurge del IVGM8K (1,2) → un aire convencional de 24k sale "sujeto a revisión".
 * pv.minSeries: IVGM8K 6 (MPPT 120–425 V y plena carga 230–425 V: 6 × 42,6 = 256 V); IVEM 3 (MPPT 90–500 V).
 */
export const inverters = [
  // Serie de 12/24 V del dueño. David (5 oct 2026): los sigue vendiendo mientras haya. La caja del de 24 V dice IVCM2024-LV
  // (2000 VA / 2000 W, MPPT 1600 W, FV máx. 145 V); David lo confirmó por audio: es el "IVCM 2024 LV". kSurge/idleW son los de la IVCM.
  { model: 'IVEM1612-LV', brand: 'Felicity Solar', kw: 1.6, busV: 12, ac: '110', kSurge: 1.5, gridChargeA: 10, idleW: 18, pv: { maxW: 800, minSeries: 1, maxPanels: 1 }, parallel: false, priceEq: 400, priceInst: null, available: true, tier: 'ivcm' },   // 400 en [02], 380 en [14]
  { model: 'IVCM2024-LV', brand: 'Felicity Solar', kw: 2, busV: 24, ac: '110', kSurge: 1.5, gridChargeA: 15, idleW: 25, pv: { maxW: 1600, minSeries: 2, maxPanels: 2 }, parallel: false, priceEq: 400, priceInst: null, available: true, tier: 'ivcm' },   // 1 presupuesto ([15], donde dice IVEM2024-LV). La caja de David dice IVCM2024-LV y ese nombre se imprime (decisión de Diego, 5 oct 2026).
  { model: 'IVEM3048-LV', brand: 'Felicity Solar', kw: 3, busV: 48, ac: '110', kSurge: 2, gridChargeA: 60, idleW: 35, pv: { maxW: 4000, minSeries: 3, maxPanels: 7 }, parallel: false, priceEq: 495, priceInst: null, available: true, tier: 'ivem3' },   // 495 en 8 de 8 presupuestos (precio ancla)
  // El dueño nunca lo cotizo (0 de 22): apagado hasta que confirme si lo vende; el 6 kW Roccia ocupa su lugar. // POR CONFIRMAR Q23
  { model: 'IVEM5048-LV', brand: 'Felicity Solar', kw: 5, busV: 48, ac: '110', kSurge: 2, gridChargeA: 100, idleW: 45, pv: { maxW: 6000, minSeries: 3, maxPanels: 9 }, parallel: 6, priceEq: 570, priceInst: null, available: false, tier: 'ivem5' },
  // Roccia 6 kW "PV3300": etiqueta fotografiada por David (5 oct 2026): PV3300 TLV · MD PV33-6048 TLV · 6000 W · 48 V · AC 120/240 V 25 A · carga AC 36 A de entrada, 40 A de salida DC ·
  // cargador solar 80 A · MPPT 60-230 V · Voc máx. 245 V (confirma que es el Must PV33-6048 TLV reetiquetado). NO está en la etiqueta: surge (18 kVA según Must; otro vendedor 15 kW/5 ms
  // -> se toma el menor, 2,5x), FV máx. (la ficha de Must dice 5.000 W; se usa 80 A × 48 V = 3.840 W, el tope de carga de la etiqueta: 6 paneles de 580 W) ni idleW 60 (SUPUESTO, transformador de baja frecuencia). // POR CONFIRMAR Q24 (manual)
  { model: 'ROCCIA-6K-120/220', brand: 'Roccia', kw: 6, busV: 48, ac: '120/240', kSurge: 2.5, gridChargeA: 40, idleW: 60, pv: { maxW: 3840, minSeries: 2, maxPanels: 6 }, parallel: false, priceEq: 990, priceInst: null, available: true, tier: 'roccia', disp: 'PV3300' },   // 954 en 6 presupuestos, 990 en [01] y [16]: se vende el más caro (David, 5 oct 2026: "vendemos el precio de presupuestos más caros"; Diego confirmó que aplica)
  { model: 'IVGM8KLP2G1', brand: 'Felicity Solar', kw: 8, busV: 48, ac: '120/240', kSurge: 1.2, gridChargeA: 170, idleW: 70, pv: { maxW: 12000, minSeries: 6, maxPanels: 20 }, parallel: 6, priceEq: 1950, priceInst: null, available: true, tier: 'ivgm8' },   // 1.950 en 3 de 3 presupuestos. POR CONFIRMAR Q10 (kSurge 1,2)
];

/**
 * Baterías LiFePO4. iCont = corriente continua recomendada (A), también tope de carga; i15s = pico 15 s.
 * Solo la FLA48100 publica i15s en ficha (150 A); las demás usan K.i15sDefault × iCont, marcado en i15sSource.
 * POR CONFIRMAR Q6: qué baterías se venden (FLA48100, FLA48314, FLA48460 sí; rack FLA48100UG1 no hasta confirmar compatibilidad).
 * Las de 12/24 V solo las usa la serie IVEM1612/IVCM2024 (tier 'ivcm').
 */
export const batteries = [
  // priceEq = precio de venta de los presupuestos del dueño (el mas repetido); kWh = V x Ah reales; sus descripciones de renglón las arma quote().
  { model: 'FLA12280-EU', brand: 'Felicity Solar', kwh: 3.58, busV: 12, ah: 280, iCont: 150, i15s: 200, i15sSource: 'supuesto', priceEq: 780, priceInst: null, maxParallel: 15, available: true },   // sus presupuestos imprimen 2,56 kWh: error de plantilla. CONFIRMADO por David con la caja (5 oct 2026): 3,6 kWh · 12,8 V · 280 Ah. Con la FLA12171-EU (2,2 kWh · 171 Ah) son sus únicos dos modelos de 12 V; la 12171 falta (sin precio).
  // FLA12171-EU (2,2 kWh · 12,8 V · 171 Ah): David la vende; "vale 130 dólares menos que la otra" de 12 V (780) → 650 (derivado, audio 5 oct 2026). Corriente y foto SUPUESTAS: iCont 100 A conservador (la FLA48171 de las mismas celdas da 120 A), foto = la de la FLA12280. // POR CONFIRMAR (ficha)
  { model: 'FLA12171-EU', brand: 'Felicity Solar', kwh: 2.19, busV: 12, ah: 171, iCont: 100, i15s: 133, i15sSource: 'supuesto', priceEq: 650, priceInst: null, maxParallel: 15, available: true },
  { model: 'FLA24100PG2', brand: 'Felicity Solar', kwh: 2.56, busV: 24, ah: 100, iCont: 100, i15s: 150, i15sSource: 'ficha', priceEq: 700, priceInst: null, maxParallel: 15, available: true },   // [15], donde dice FLA24100-EU. La caja de David dice FLA24100PG2 (2,56 kWh · 25,6 V) y ese nombre se imprime (decisión de Diego, 5 oct 2026).
  { model: 'FLA48100-EU', brand: 'Felicity Solar', kwh: 5.12, busV: 48, ah: 100, iCont: 100, i15s: 150, i15sSource: 'ficha', priceEq: 1200, priceInst: null, maxParallel: 15, available: true },   // 1.200 en 8 de 8
  // 6 de 6 ventas van con el Roccia y ninguna con un Felicity: onlyWith lo reproduce. // POR CONFIRMAR Q26
  { model: 'FLA48230-EU', brand: 'Felicity Solar', kwh: 11.78, busV: 48, ah: 230, iCont: 120, i15s: null, priceEq: 2150, priceInst: null, maxParallel: 15, available: true, onlyWith: ['roccia'] },   // 2.100 en 5, 2.150 en [01]: se vende el más caro (David, 5 oct 2026; Diego confirmó que aplica)
  { model: 'FLA48314-EU', brand: 'Felicity Solar', kwh: 16.08, busV: 48, ah: 314, iCont: 160, i15s: 213, i15sSource: 'supuesto', priceEq: 3315, priceInst: null, maxParallel: 15, available: true },   // 3.315 en [08],[21]; 3.060 c/u en [13]
  { model: 'FLA48460TG2-EU', brand: 'Felicity Solar', kwh: 23.55, busV: 48, ah: 460, iCont: 200, i15s: 266, i15sSource: 'supuesto', priceEq: 4950, priceInst: null, maxParallel: 15, available: true },   // 4.950 en [00], 4.940 en [08]
  // el dueño no las vende / sin precio: apagadas
  { model: 'FLA24230-EU', brand: 'Felicity Solar', kwh: 5.85, busV: 24, ah: 230, iCont: 150, i15s: 200, i15sSource: 'supuesto', priceEq: null, priceInst: null, maxParallel: 15, available: false },
  { model: 'FLA12100', brand: 'Felicity Solar', kwh: 1.28, busV: 12, ah: 100, iCont: 100, i15s: null, priceEq: null, priceInst: null, maxParallel: 15, available: false },
  { model: 'FLA48171-EU', brand: 'Felicity Solar', kwh: 8.75, busV: 48, ah: 171, iCont: 120, i15s: null, priceEq: null, priceInst: null, maxParallel: 15, available: false },
  { model: 'FLA48280-EU', brand: 'Felicity Solar', kwh: 14.3, busV: 48, ah: 280, iCont: 150, i15s: null, priceEq: null, priceInst: null, maxParallel: 15, available: false },
  { model: 'FLA48100UG1', brand: 'Felicity Solar', kwh: 5.12, busV: 48, ah: 100, iCont: 50, i15s: null, priceEq: 990, priceInst: null, maxParallel: 15, available: false },   // POR CONFIRMAR Q6
];

/** Panel de 580 W del catálogo, solo para sugerir la cantidad. David (5 oct 2026): sí vende paneles, pero se cotizan aparte (futuro módulo de cotización): sin precio, no suman al total. POR CONFIRMAR: de cuántos vatios son los que vende. */
export const panel = { model: '580W', w: 580, voc: 51.47, vmp: 42.59, isc: 14.37, price: null, available: false };

/** Todo editable. null = "se confirma en la visita" (la UI no inventa cifras). */
export const pricing = {
  provisional: true,       // mientras sea true la UI muestra "Precios de prueba · por confirmar". // POR CONFIRMAR Q20 (merge a main = demo pública)
  installMode: 'tier',     // 'tier' = kit + mano de obra por tramo de inversor (datos de 19 presupuestos) | 'factor' = equipo × installFactor (los datos lo contradicen: error de ±400 US$)
  installFactor: 1.25,     // solo modo 'factor' (alterno, de pruebas): instalación = 25 % del equipo. David lo descartó: el 25 % es SU ganancia sobre el equipo, ya incluida en su lista, no un recargo de instalación.
  // kit + mano de obra por tramo; el texto del kit es el que imprime David (kitDesc). El tablero va DENTRO del kit; el numero de baterias no cambia la instalacion; > 1 inversor = ingenieria.
  install: {
    ivcm:   { kit: 450, mo: 350, kitType: 'transferencia', range: [800, 800] },     // [02] [14] [15]: 3 de 3
    ivem3:  { kit: 450, mo: 450, kitType: 'transferencia', range: [900, 900] },     // 8 de 8
    roccia: { kit: 500, mo: 350, kitType: 'cargas',        range: [850, 1000] },    // [04] [19] 850 · [20] 900 · [09] 1.000. David: mano de obra de 350 a 600, la más alta en el 8 kW.
    ivgm8:  { kit: 500, mo: 500, kitType: 'cargas',        range: [1000, 1200] },   // [08] [21] 1.000 · [00] 1.200 (kit 700 con 1×23,6 kWh)
  },
  kitDesc: {   // FUENTE: presupuestos [02]-[21] (el texto del dueño, redactado en mayúscula inicial)
    transferencia: 'Kit básico de instalación con tablero automático de transferencia, hasta 2 m de cableado',
    cargas: 'Kit básico de instalación con tablero de cargas preferencial automático, hasta 2 m de cableado',
  },
  laborDesc: { transferencia: 'Mano de obra de instalación completa', cargas: 'Mano de obra de instalación completa' },   // FUENTE: presupuestos [02]-[21]
  warranty: ['Garantía de la batería: 2 años', 'Garantía del inversor: 1 año', 'Garantía del tablero eléctrico: 3 meses', 'Garantía de la instalación: 3 meses'],   // FUENTE: presupuestos [03][05][06][10][11] (solo 5 de 22 las imprimen). David: "OK" (5 oct 2026).
  payment: 'Pagos a realizar por Zelle, efectivo o Binance; para pagos en bolívares se usa la tasa Binance.',   // FUENTE: 21 de 22 presupuestos; Diego lo confirmó (5 oct 2026)
  company: { name: 'SERVICIOS Y SUMINISTROS D&S, C.A.', rif: 'J-40625203-4' },   // razón social y RIF de la empresa (la misma que SSD&S C.A.): van en el PDF. // FUENTE: decisión del dueño
  batteryTail: 'BMS inteligente con breaker y fusible · 6.000 ciclos profundos',   // FUENTE: presupuestos (todas las descripciones de batería)
  validityDays: 3,         // David (5 oct 2026, audio): "tres días de validez"; Diego lo escuchó y lo confirmó. Ningún presupuesto trae IVA.
  installConfirmed: true,  // David (5 oct 2026): kit + mano de obra por tramo "estaría bien"; sus cifras: mano de obra 350 a 600, la más alta en el 8 kW. false → "por confirmar" en todo precio instalado.
  basicKitM: 2,            // el kit básico cubre hasta 2 m del tablero. // POR CONFIRMAR Q2
  cablePerM: null,         // US$ por metro adicional (ida y vuelta). // POR CONFIRMAR Q2
  laborOnly: null,         // solo mano de obra (el cliente ya tiene el kit): se cotiza en el sitio, por eso null (Diego, 5 oct 2026).
  transferKit: null,       // kit de transferencia. // POR CONFIRMAR Q2
  panelUsd: null,          // precio por panel; null a propósito: David los cotiza aparte (5 oct 2026), un módulo futuro. Mientras sea null los paneles no suman al total.
  showModel: true,         // marca y modelo en el sitio, el mensaje y el PDF: los presupuestos reales SIEMPRE los muestran (David: se puede mostrar todo). false = descripciones genéricas.
};

// ───────────────────────────── helpers ─────────────────────────────
const byId = Object.fromEntries(loads.map((l) => [l.id, l]));
const has = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);   // ids como 'constructor' o 'toString' no existen
const num = (v, lo, hi, dflt) => {
  if (v == null || typeof v === 'boolean' || typeof v === 'object' || (typeof v === 'string' && !v.trim())) return dflt;   // null/''/false/[] → default, no 0
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const txt = (s, max) => {   // una sola línea, recortada por puntos de código (nunca a mitad de un emoji) y bien formada
  const t = [...String(s ?? '').replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim()].slice(0, max).join('');
  return t.toWellFormed ? t.toWellFormed() : t;
};
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const fmtNum = (n, d = 1) => Number(n).toLocaleString('es-VE', { maximumFractionDigits: d, useGrouping: 'always' });
const fmtKW = (w) => `${fmtNum(w / 1000, 1)} kW`;
const fmtKWh = (kwh) => `${fmtNum(kwh, 2)} kWh`;
const fmtRe = (h) => (h < 1 ? 'menos de 1 h' : `≈ ${fmtNum(h)} h`);   // recargas de minutos: nunca "≈ 0 h"
const fmtH = (o) => (o.autonomyCapped ? `más de ${K.maxAutonomyH} h` : `≈ ${fmtNum(o.autonomyH)} h`);
const list = (xs) => new Intl.ListFormat('es', { type: 'conjunction' }).format(xs);
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);   // 'Aire 24.000 BTU' → 'aire 24.000 BTU' (no toca las siglas)
const PLACE = { apto: 'Apartamento', casa: 'Casa', negocio: 'Negocio' };
const TRANSFER = { quiero: 'la quiero', tengo: 'ya tengo', no: '' };
const TIERS = ['basico', 'recomendado', 'holgado'], TIER_ADJ = { basico: 'básica', recomendado: 'recomendada', holgado: 'holgada' };
const TIER_LABEL = { basico: 'Básica', recomendado: 'Recomendada', holgado: 'Holgada' };
const WHEN = { sem: 'esta semana', mes: 'este mes', exp: 'explorando' }, VIA = { ig: 'Instagram', dx: 'Diagnóstico' };
const MAX_URL = 480;   // ponytail: una URL más larga no cabe con el resto del mensaje en 1.200 caracteres (peor caso medido en el check); se descarta entera, cortarla la rompería. Cubre ≈ 20 equipos en un enlace de github.io

/** 'US$ 1.400' (sin decimales; useGrouping 'always' fuerza el punto de miles también en 4 cifras). */
export const fmtUSD = (n) => `US$ ${Math.round(n).toLocaleString('es-VE', { maximumFractionDigits: 0, useGrouping: 'always' })}`;
/** 'US$ 1.200,00' (el formato del presupuesto en PDF). */
export const fmtUSD2 = (n) => `US$ ${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })}`;

/**
 * Sanea answers: cualquier campo puede faltar o venir sucio (incluso null). Cantidades 0..20, horas 1..24 (default 8).
 * Devuelve la forma canónica (también la que usa el controlador): items, custom, hours, v220, place, hot, solar, install,
 * transfer, extraM, city, preset ('cero' | id de presets), tier, when, via, url (null si no vale). Idempotente.
 */
export function clean(a) {
  a = a && typeof a === 'object' ? a : {};
  const items = {};
  for (const [id, n] of Object.entries(a.items && typeof a.items === 'object' ? a.items : {})) {
    const q = Math.round(num(n, 0, 20, 0));
    if (has(byId, id) && !byId[id].editable && q > 0) items[id] = q;   // 'otro' solo entra por custom (con sus vatios)
  }
  const custom = (Array.isArray(a.custom) ? a.custom.slice(0, 20) : []).map((c) => {
    const h = num(c?.h, 0.1, 24, null);
    return { t: txt(c?.t, 40) || 'Otro equipo', w: Math.round(num(c?.w, 0, 20000, 0)), n: Math.round(num(c?.n, 0, 20, 1)), ...(c?.m === true || c?.m === 1 ? { m: true } : {}), ...(h != null ? { h } : {}) };
  }).filter((c) => c.w > 0 && c.n > 0);
  const v220 = {};
  for (const [id, yes] of Object.entries(a.v220 && typeof a.v220 === 'object' ? a.v220 : {})) {
    if (has(byId, id) && byId[id].v220 === 'ask' && typeof yes === 'boolean') v220[id] = yes;   // true y false se guardan: "no es de 220" también es respuesta
  }
  return {
    items, custom, hours: num(a.hours, 1, 24, 8), v220,
    place: has(PLACE, a.place) ? a.place : null,
    hot: a.hot === true, solar: a.solar === true,
    install: ['equipo', 'instalado', 'manoObra'].includes(a.install) ? a.install : 'equipo',
    transfer: has(TRANSFER, a.transfer) ? a.transfer : 'no',
    extraM: Math.round(num(a.extraM, 0, 100, 0)),
    city: txt(a.city, 40),
    preset: a.preset === 'cero' || presets.some((p) => p.id === a.preset) ? a.preset : null,
    tier: TIERS.includes(a.tier) ? a.tier : null,
    when: has(WHEN, a.when) ? a.when : null,
    via: has(VIA, a.via) ? a.via : null,
    url: typeof a.url === 'string' && a.url.length <= MAX_URL && /^https?:\/\/\S+$/.test(a.url) ? a.url : null,   // solo http(s) en una línea; WhatsApp la vuelve enlace
  };
}

/** Filas de carga con cantidad, duty ajustado por calor y voltaje efectivo. */
function rowsOf(a) {
  const rows = Object.entries(a.items).map(([id, n]) => ({ ...byId[id], n }));
  a.custom.forEach((c, i) => rows.push({
    ...byId.otro, id: `otro${i}`, t: c.t, s: `${c.t} ${fmtNum(c.w, 0)} W${c.m ? ' (motor)' : ''}`, w: c.w, n: c.n,
    ...(c.m ? { surge: 3.5, hUse: c.h ?? 1, hp: c.w / 1000 } : { surge: 1, hUse: c.h ?? 24 }),   // ponytail: un motor escrito a mano arranca 3,5× y trabaja ≈ 1 h salvo que diga otra cosa
  }));
  return rows.map((r) => ({
    ...r,
    duty: a.hot && r.cold ? Math.min(1, r.duty * K.hotDuty) : r.duty,
    is220: r.v220 === true || (r.v220 === 'ask' && a.v220[r.id] === true),
  }));
}

/**
 * Demanda. ponytail: P_cont = Σ cargas de uso largo (hUse ≥ 2 h) + UN aparato grande de uso corto (el de más W);
 * el pico es el peor de dos escenarios: arrancan los dos motores/compresores más duros de la base con todo encendido
 * (sin secuenciar, como pide el digest para locales con varios compresores), o arranca el aparato corto de peor
 * arranque sobre la base (así la bomba cuenta aunque el microondas sea "el grande").
 */
function demand(rows, hours) {
  const base = rows.filter((r) => r.hUse >= 2), short = rows.filter((r) => r.hUse < 2);
  const B = base.reduce((s, r) => s + r.w * r.n, 0);
  const big = short.reduce((m, r) => (!m || r.w > m.w ? r : m), null);
  const contW = B + (big ? big.w : 0);
  const top = (xs, f) => xs.reduce((m, r) => (f(r) > (m ? f(m) : 0) ? r : m), null);
  const starts = base.flatMap((r) => Array(r.n).fill(r)).filter((r) => r.surge > 1).sort((x, y) => y.w * (y.surge - 1) - x.w * (x.surge - 1));
  const [s1, s2] = starts, ss = top(short, (r) => r.w * r.surge);
  const peakBase = contW + (s1 ? s1.w * (s1.surge - 1) : 0) + (s2 && s2.surge >= 3 ? s2.w * (s2.surge - 1) : 0);
  const peakShort = B + (ss ? ss.w * ss.surge : 0);
  const peakW = Math.max(peakBase, peakShort);
  return {
    contW, peakW,
    starter: peakW === peakBase ? s1 : ss,                       // quién manda en el pico (para los textos)
    soft: top(rows.filter((r) => r.softStart), (r) => r.w * r.n), // aire convencional ≥ 18k: soft-starter o equipo inverter
    whResp: rows.reduce((s, r) => s + r.w * r.n * r.duty * Math.min(hours, r.hUse), 0),
    whDay: rows.reduce((s, r) => s + r.w * r.n * r.duty * r.hUse, 0),
    // "cuánto dura": lo de uso largo encendido a la vez, después de reservar la energía de lo de uso corto (bomba, microondas…)
    pBase: base.reduce((s, r) => s + r.w * r.n * r.duty, 0),
    eShort: short.reduce((s, r) => s + r.w * r.n * r.duty * Math.min(hours, r.hUse), 0),
  };
}

/** Inversores que cumplen el continuo (con margen) y las reglas de línea, de menor a mayor. [] → fuera de alcance. */
function fitInverters(d, rows, needs220) {
  const noIvcm = rows.some((r) => r.btu || r.hp) || d.contW > 1600
    || rows.filter((r) => r.hUse < 2 && r.w * r.surge >= 1000).length >= 2;   // ponytail: IVCM no publica pico; solo cargas chicas, sin aires, bombas ni dos arranques grandes
  const minKw = rows.reduce((m, r) => Math.max(m, r.minKw || 0), 0);
  return inverters
    .filter((i) => i.available && i.priceEq > 0 && (!needs220 || i.ac.includes('240')) && !(noIvcm && i.tier === 'ivcm'))   // un 120/240 tambien alimenta cargas de 120 V (David vende el Roccia y el 8 kW a 120 V). // POR CONFIRMAR Q29: tope por pierna
    .filter((i) => i.kw >= minKw && i.kw * 1000 >= K.margin * d.contW)
    .sort((x, y) => x.kw - y.kw);
}

/**
 * Banco de baterías del bus del inversor: la combinación (un solo modelo, n ≤ maxParallel) más barata que cubre los
 * kWh y las corrientes continua y de pico (el pico nunca es mayor que lo que el inversor deja pasar). `factor` = fracción
 * de los kWh de placa que cuenta como útil (default K.quoteFactor = horas nominales; K.dod × K.eta = con pérdidas).
 * `slack` = fracción de esa energía que basta (K.quoteSlack en las opciones nominales; 1 = exacto).
 * `floor` = redondear hacia abajo si aún cubre ≥ 65 % de la energía (mín. 1).
 */
export function pickBatteries(inv, d, { floor = false, factor = K.quoteFactor, slack = 1 } = {}) {
  const needKwh = (slack * d.whResp) / factor / 1000;
  const peak = Math.min(d.peakW, inv.kw * 1000 * inv.kSurge);
  const iCont = d.contW / (inv.busV * K.eta), iPeak = peak / (inv.busV * K.eta);
  const combos = batteries
    .filter((b) => b.available && b.priceEq > 0 && b.busV === inv.busV && (!b.onlyWith || b.onlyWith.includes(inv.tier)))
    .map((b) => {
      const byI = Math.max(Math.ceil(iCont / b.iCont), Math.ceil(iPeak / (b.i15s || K.i15sDefault * b.iCont)));
      let n = Math.max(1, Math.ceil(needKwh / b.kwh), byI);
      if (floor) { const f = Math.max(1, Math.floor(needKwh / b.kwh), byI); if (f * b.kwh >= (0.65 * needKwh) / slack) n = f; }
      return n <= b.maxParallel ? { model: b.model, n, kwh: n * b.kwh, bat: b, price: n * b.priceEq } : null;
    })
    .filter(Boolean)
    .sort((x, y) => x.price - y.price || y.kwh - x.kwh || x.n - y.n);
  return combos[0] || null;
}

const grow = (b) => (b.n < b.bat.maxParallel ? { ...b, n: b.n + 1, kwh: b.kwh + b.bat.kwh, price: b.price + b.bat.priceEq } : null);

/** Energía a cubrir con el consumo propio del inversor durante el corte: lo usan las horas REALES (Holgada, recarga, paneles); las nominales no lo cuentan, como el dueño. */
const withIdle = (d, inv, hours) => ({ ...d, whResp: d.whResp + inv.idleW * hours });

/** Paneles sugeridos: reponer lo consumido (con pérdidas de conversión y carga) con el mes más nublado; tope por ficha del inversor. */
function panelsFor(inv, whResp) {
  const cap = Math.min(inv.pv.maxPanels, Math.floor(inv.pv.maxW / K.panelW));
  const raw = Math.ceil(whResp / (K.eta * K.chargeEta) / (K.psh * K.panelW * K.pvDerate));
  const n = Math.min(cap, Math.max(inv.pv.minSeries, raw));
  return { n, note: raw > cap ? `el inversor admite hasta ${cap}; se cotizan aparte` : 'se cotizan aparte' };
}

/**
 * Totales de una opción. Instalación una sola vez por sistema (no por batería). `pending` = lo que el total NO incluye y se
 * confirma en la visita (la UI dice "no incluye: …"); nunca oculta el total. confirmed es false mientras
 * pricing.installConfirmed sea false o falte algo por cotizar. Regla 'factor' siempre da número; 'tier' puede dar null.
 * → { equipo, instalacion, total, confirmed, pending: ['transferencia', '+N m de cable', 'mano de obra'] }
 */
function totalsFor(inv, bats, panels, a) {
  const panelUsd = panels && Number.isFinite(pricing.panelUsd) ? panels.n * pricing.panelUsd : 0;
  const equipo = inv.priceEq + bats.price + panelUsd;
  const pending = []; let extras = 0;
  if (a.transfer === 'quiero') { if (Number.isFinite(pricing.transferKit)) extras += pricing.transferKit; else pending.push('transferencia'); }
  if (a.install !== 'equipo' && a.extraM > 0) { if (Number.isFinite(pricing.cablePerM)) extras += a.extraM * pricing.cablePerM; else pending.push(`+${a.extraM} m de cable`); }
  let inst = null;
  if (a.install === 'manoObra') { if (Number.isFinite(pricing.laborOnly)) inst = pricing.laborOnly; else pending.push('mano de obra'); }
  else if (a.install === 'instalado') {
    const t = pricing.install?.[inv.tier];
    inst = pricing.installMode === 'tier' ? (t ? t.kit + t.mo : null) : Math.round(equipo * (pricing.installFactor - 1));   // ponytail: kit + MO por tramo; el factor queda solo como modo alterno
    if (!Number.isFinite(inst)) inst = null;
  }
  const total = a.install === 'equipo' ? equipo + extras : inst == null ? null : equipo + inst + extras;
  const tt = pricing.install?.[inv.tier];
  const detalle = a.install === 'instalado' && pricing.installMode === 'tier' && tt ? { kit: tt.kit, mo: tt.mo, kitType: tt.kitType, range: tt.range } : null;   // para el PDF: dos renglones, como los escribe David
  return { equipo, instalacion: a.install === 'equipo' ? null : inst, detalle, total, confirmed: total != null && pending.length === 0 && pricing.installConfirmed === true, pending };
}

/**
 * Una opción completa. `d` ya incluye el consumo propio del inversor en whResp. Horas: autonomyH = NOMINALES (kWh × K.quoteFactor,
 * como las imprime el dueño; la que se muestra y va al PDF) y realH = con pérdidas normales (kWh × K.dod × K.eta). coverage /
 * coversH miden lo nominal; coverageReal / coversRealH, lo real.
 */
function option(tier, label, inv, bats, d, a, extra = {}) {
  const usableNom = bats.kwh * 1000 * K.quoteFactor, usableReal = bats.kwh * 1000 * K.dod * K.eta;
  const dI = withIdle(d, inv, a.hours);
  const hoursOf = (u, p) => (p > 0 ? Math.max(u - d.eShort, 0.1 * u) / p : 0);
  const rawH = hoursOf(usableNom, d.pBase || inv.idleW), rawReal = hoursOf(usableReal, d.pBase + inv.idleW);
  const iCh = Math.min(inv.gridChargeA, bats.n * bats.bat.iCont);   // la red empuja gridChargeA, pero el BMS acepta lo que acepta
  const rechargeH = dI.whResp / (K.eta * K.chargeEta) / (inv.busV * iCh);   // reponer lo CONSUMIDO, no llenar desde cero
  const coverage = usableNom / d.whResp, coverageReal = usableReal / dI.whResp;
  const peakCap = Math.min(d.peakW, inv.kw * 1000 * inv.kSurge);
  const checks = {
    inverterOk: inv.kw * 1000 >= K.margin * d.contW,
    surgeOk: inv.kw * 1000 * inv.kSurge >= d.peakW,
    cRateOk: bats.n * bats.bat.iCont >= d.contW / (inv.busV * K.eta),
    surgeTight: d.peakW <= inv.kw * 1000 * inv.kSurge && d.peakW > K.tightShare * inv.kw * 1000 * inv.kSurge,   // arranca, pero con menos de 20 % de margen: semáforo ámbar
    cRatePeakOk: bats.n * (bats.bat.i15s || K.i15sDefault * bats.bat.iCont) >= peakCap / (inv.busV * K.eta),
    chargeOk: a.hours >= 24 || rechargeH <= 24 - a.hours,   // con 24 h de corte no hay red: la recarga depende de paneles o planta
  };
  const panels = a.solar ? panelsFor(inv, dI.whResp) : null;
  return {
    tier, label, inverter: inv,
    batteries: { model: bats.model, n: bats.n, kwh: round(bats.kwh, 2) },
    panels,
    autonomyH: round(Math.min(K.maxAutonomyH, rawH)), autonomyCapped: rawH >= K.maxAutonomyH,   // nominal, con lo de uso largo encendido a la vez
    realH: round(Math.min(K.maxAutonomyH, rawReal)),                                            // con pérdidas normales del sistema
    coverage: round(coverage, 2), coversH: round(Math.min(a.hours, a.hours * coverage)),        // horas del corte pedido que cubre (nominal)
    coverageReal: round(coverageReal, 2), coversRealH: round(Math.min(a.hours, a.hours * coverageReal)),
    rechargeH: Math.max(0.1, round(rechargeH)), fullRechargeH: round(bats.n * bats.bat.ah / iCh),   // reponer lo consumido / llenar desde cero
    checks,
    totals: totalsFor(inv, bats, panels, a),
    why: [],
    review: !checks.surgeOk ? 'Sujeta a revisión: el arranque supera lo que publica la ficha del inversor'
      : d.soft ? 'Sujeta a revisión: el aire convencional de ≥ 18.000 BTU necesita soft-starter o equipo inverter' : null,
    ...extra,
  };
}

/** Hasta 3 razones en lenguaje de cliente. */
function explain(o, d, a, rec) {
  const inv = o.inverter, st = d.starter, w = [];
  if (o.review) w.push(`Inversor de ${fmtNum(inv.kw)} kW: sujeto a revisión por el arranque de ${(d.soft || st).s} (≈ ${fmtKW(d.peakW)})`);
  else if (o.upgraded === 'inverter') w.push(`Inversor de ${fmtNum(inv.kw)} kW en vez de ${fmtNum(rec.inverter.kw)}: más potencia para sumar equipos${rec.checks.chargeOk ? '' : ' y recarga más rápida'}`);
  else w.push(`Inversor de ${fmtNum(inv.kw)} kW: cubre ≈ ${fmtKW(d.contW)} continuos${st && st.surge > 1 ? ` y el arranque de ${st.s} (≈ ${fmtKW(d.peakW)})` : ''}`);
  const bat = `${o.batteries.n} batería${o.batteries.n > 1 ? 's' : ''} de ${fmtKWh(o.batteries.kwh / o.batteries.n)}`;
  if (o.tier === 'basico') w.push(`${bat}: cubre ≈ ${fmtNum(o.coversH)} h de las ${fmtNum(a.hours)} que pediste; la opción más económica`);
  else if (o.upgraded === 'battery') w.push(`${bat}: cubre tus ${fmtNum(a.hours)} h incluso con las pérdidas normales del sistema (≈ ${fmtNum(o.realH)} h reales; la Recomendada, ${fmtNum(rec.realH)} h)`);
  else w.push(`${bat}: cubre tu corte de ${fmtNum(a.hours)} h (${fmtH(o)} con todo encendido)`);
  w.push(a.hours >= 24 ? 'En cortes de 24 h la batería solo se repone con paneles o planta'
    : o.checks.chargeOk ? `Se repone de la red en ${fmtRe(o.rechargeH)} cuando vuelve la luz`
      : `Con cortes diarios no alcanza a recargarse de la red (≈ ${fmtNum(o.rechargeH)} h): conviene paneles`);
  return w;
}

const invName = (inv) => `inversor híbrido ${fmtNum(inv.kw)} kW (${inv.ac} V)${pricing.showModel ? ` ${inv.disp || inv.model}` : ''}`;
const batName = (o) => {
  const b = batteries.find((x) => x.model === o.batteries.model);
  return `${o.batteries.n} batería${o.batteries.n > 1 ? 's' : ''} de litio de ${fmtKWh(b.kwh)}${pricing.showModel ? ` ${b.model}` : ''}${o.batteries.n > 1 ? ` (${fmtKWh(o.batteries.kwh)})` : ''}`;
};

/** La opción elegida por el cliente (a.tier); si no pidió ninguna → recomendada; si ese tier no existe → la más cercana en la escala básica < recomendada < holgada. */
function chosenOf(options, tier) {
  if (!options.length) return null;
  const want = TIERS.indexOf(tier || 'recomendado');
  return options.reduce((m, o) => (Math.abs(TIERS.indexOf(o.tier) - want) < Math.abs(TIERS.indexOf(m.tier) - want) ? o : m));
}

/** Los equipos de mayor consumo, hasta `max`, y "N más". */
function eqNames(rows, max) {
  const top = [...rows].sort((x, y) => y.w * y.n - x.w * x.n);
  const names = top.slice(0, max).map((r) => (r.n > 1 ? `${r.s} ×${r.n}` : r.s));
  if (top.length > max) names.push(`${top.length - max} más`);
  return names;
}

function whatRuns(rows, sel, a) {
  const names = eqNames(rows, 6);
  if (!names.length) return '';
  return sel ? `${sel.coverage >= 1 ? `Cubre tu corte de ${fmtNum(a.hours)} h` : `Cubre ≈ ${fmtNum(sel.coversH)} h de tu corte de ${fmtNum(a.hours)} h`} con ${list(names)}.` : `Equipos: ${list(names)}.`;
}

/**
 * Mensaje de WhatsApp (< 1200 caracteres CONTANDO la URL). Lo arma SOLO el motor; la UI no lo parte ni lo reescribe.
 * Orden fijo: apertura · Punto de partida · Equipos · Corte · Opción · Precio · Instalación · Paneles · Ojo · Confirmar ·
 * Para cuándo · Vía · Mi configuración · pregunta final. Solo la opción elegida (`sel`); si no cabe, se recorta la lista de equipos.
 */
function message(a, rows, sel, oos, d, ask) {
  const build = (max, lvl = 0) => {
    const eq = rows.map((r) => `${r.s}${r.v220 === 'ask' && a.v220[r.id] === true ? ' (220 V)' : ''} ×${r.n}`);
    const shown = max >= eq.length ? eq : max === 0 ? [`${eq.length} equipos`] : [...eq.slice(0, max), `y ${eq.length - max} más`];
    const corte = `• Corte a cubrir: ${[`${fmtNum(a.hours)} h`, PLACE[a.place], a.city, a.hot && 'clima caluroso'].filter(Boolean).join(' · ')}`;
    const tail = [a.via && `• Vía: ${VIA[a.via]}`, a.url && `Mi configuración: ${a.url}`];
    if (oos) {
      return [
        `${OPENING.slice(0, -1)} y requiere cotización con ingeniero.`,
        shown.length && `• Equipos: ${shown.join(', ')}`, corte,
        `• Motivo: ${oos.reason}`,
        `• Carga continua ≈ ${fmtNum(d.contW, 0)} W · arranque ≈ ${fmtNum(d.peakW, 0)} W · energía ≈ ${fmtNum(d.whResp / 1000, 1)} kWh`,
        ...tail, '¿Me pueden orientar y coordinamos la visita técnica?',
      ].filter(Boolean).join('\n');
    }
    let price, inst = [];
    if (sel) {
      const t = sel.totals, eqS = `${fmtUSD(t.equipo)} solo equipo`, flag = t.confirmed ? 'sujeto a visita' : 'estimado, por confirmar', desde = t.detalle && t.detalle.range[1] > t.detalle.range[0] ? 'desde ' : '';   // el Roccia y el 8 kW tienen rango de instalación: como en la página, "desde"
      price = a.install === 'equipo' ? eqS
        : a.install === 'manoObra' ? (t.total != null ? `${eqS} · ≈ ${fmtUSD(t.total)} con mano de obra (${flag})` : eqS)
          : t.total != null ? `${eqS} · ≈ ${desde}${fmtUSD(t.total)} instalado (${flag})` : `${eqS} · instalación: se confirma en la visita`;
      if (a.install === 'instalado') inst.push(`kit básico hasta ${pricing.basicKitM} m del tablero`);
      if (a.install === 'manoObra') inst.push('solo mano de obra');
      if (TRANSFER[a.transfer]) inst.push(`transferencia: ${TRANSFER[a.transfer]}`);
      if (a.install !== 'equipo' && a.extraM > 0) inst.push(`+${a.extraM} m de cable`);
    }
    const st = d.soft || d.starter;
    const recharge = !sel ? '' : a.hours >= 24 ? 'se repone solo con paneles o planta' : sel.checks.chargeOk ? `se recarga en ${fmtRe(sel.rechargeH)}` : `≈ ${fmtNum(sel.rechargeH)} h para recargar (con cortes diarios no alcanza)`;
    return [
      OPENING,
      a.preset && lvl < 1 && `• Punto de partida: ${a.preset === 'cero' ? 'Desde cero' : presets.find((p) => p.id === a.preset).t}`,
      shown.length && `• Equipos: ${shown.join(', ')}`, corte,
      sel && `• Opción ${TIER_ADJ[sel.tier]}: ${invName(sel.inverter)} + ${batName(sel)} → ${fmtH(sel)}${sel.coverage < 1 ? ` · cubre ≈ ${fmtNum(sel.coversH)} de tus ${fmtNum(a.hours)} h` : ''} · ${recharge}`,
      sel && `• Precio referencial: ${price}`,
      inst.length && lvl < 3 && `• Instalación: ${inst.join(' · ')} (${inst.length > 1 ? 'se confirman' : 'se confirma'} en la visita)`,
      sel && sel.panels && lvl < 2 && `• Paneles: ${sel.panels.n} ${sel.panels.n === 1 ? 'sugerido' : 'sugeridos'} (${sel.panels.note})`,
      sel && sel.review && st && `• Ojo: el arranque de mi ${st.s} ${sel.checks.surgeOk ? 'puede superar' : 'supera'} el inversor; me indican soft-starter o equipo inverter`,
      sel && ask.length && `• Confirmar: ¿${ask.length > 1 ? `${list(ask.map((r) => `mi ${r.s}`))} son` : `mi ${ask[0].s} es`} de 220 V?`,
      a.when && `• Para cuándo: ${WHEN[a.when]}`,
      ...tail, '¿Me confirman disponibilidad y coordinamos la visita técnica?',
    ].filter(Boolean).join('\n');
  };
  let m = build(40);
  // ponytail: primero recorta la lista de equipos; si aun así no cabe, suelta líneas que ya viajan dentro del enlace (punto de partida, paneles, instalación). MAX_URL deja siempre espacio para el resto
  for (const [max, lvl] of [[20, 0], [10, 0], [5, 0], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3]]) if (m.length >= 1200) m = build(max, lvl);
  return m;
}

/**
 * answers = { items: { [id]: n }, custom?: [{ t, w, n, m?, h? }], hours, v220: { [id]: bool }, place, hot, solar, install, transfer, extraM, city,
 *             preset?, tier?, when?, via?, url? }   (los 5 últimos no dimensionan: solo viajan al mensaje)
 * → { contW, peakW, avgW, whResp, whDay, needs220, outOfScope, plant, options: [basico?, recomendado, holgado?], chosen, hints, message, summary }
 * opción = { tier, label, badge?, inverter, batteries: { model, n, kwh }, panels, autonomyH (nominal) + autonomyCapped, realH (con pérdidas), coverage /
 *   coversH (nominal), coverageReal / coversRealH, rechargeH, fullRechargeH, checks, totals: { equipo, instalacion, detalle: { kit, mo, kitType, range } | null,
 *   total, confirmed, pending }, why, review, upgraded?: 'battery' | 'inverter' (solo la Holgada) }
 */
export function size(answers) {
  const a = clean(answers);
  const rows = rowsOf(a);
  const d = demand(rows, a.hours);
  const needs220 = rows.some((r) => r.is220);
  const hasAC = rows.some((r) => r.btu);
  const plant = d.whResp > K.plant.wh || d.contW > K.plant.w || (a.hours >= K.plant.hAc && hasAC);
  const ask = rows.filter((r) => r.v220 === 'ask' && a.v220[r.id] === undefined);   // ¿es de 220 V? sin responder: se calcula a 110 V y se pregunta
  const out = {
    contW: Math.round(d.contW), peakW: Math.round(d.peakW), avgW: Math.round(d.whResp / a.hours),
    whResp: Math.round(d.whResp), whDay: Math.round(d.whDay), needs220, outOfScope: null, plant, options: [], chosen: null, hints: [],
  };
  const done = () => {
    const sel = chosenOf(out.options, a.tier);
    return { ...out, chosen: sel ? sel.tier : null, message: message(a, rows, sel, out.outOfScope, d, ask), summary: { sayWhatRuns: whatRuns(rows, sel, a) } };
  };

  if (!rows.length) { out.hints.push('Marca al menos un equipo para dimensionar.'); return done(); }

  // fuera del cotizador. `remove` = qué quitar para volver al cotizador: los de ingeniero o, por potencia / energía, la carga que más pesa
  const biggest = (f) => rows.reduce((m, r) => (f(r) > f(m) ? r : m)).id;
  const eng = rows.filter((r) => r.engineer);
  if (eng.length) out.outOfScope = { reason: list(eng.map((r) => `${lc(r.t)}: ${r.reason}`)), remove: eng.map((r) => r.id) };
  const fits = out.outOfScope ? [] : fitInverters(d, rows, needs220);
  if (!out.outOfScope && !fits.length) out.outOfScope = { reason: `≈ ${fmtKW(d.contW)} continuos (${fmtKW(K.margin * d.contW)} con margen) superan un solo inversor de ${fmtNum(Math.max(...inverters.filter((i) => i.available && i.priceEq > 0 && (!needs220 || i.ac.includes('240'))).map((i) => i.kw)), 0)} kW`, remove: [biggest((r) => r.w * r.n)] };
  // un sistema por inversor posible: la Recomendada es la más barata que cumple, no "el inversor más chico"
  const mk = (inv, bats, tier = 'recomendado', label = TIER_LABEL.recomendado, extra) => option(tier, label, inv, bats, d, a, extra);
  const cands = fits.map((inv) => { const b = pickBatteries(inv, d, { slack: K.quoteSlack }); return b && { inv, o: mk(inv, b), bats: b }; })
    .filter(Boolean).sort((x, y) => x.o.totals.equipo - y.o.totals.equipo || y.bats.kwh - x.bats.kwh || y.inv.kw - x.inv.kw);
  if (!out.outOfScope && !cands.length) out.outOfScope = { reason: 'el banco de baterías supera lo que admite un solo inversor', remove: [biggest((r) => r.w * r.n * r.duty * Math.min(a.hours, r.hUse))] };
  if (out.outOfScope) {
    if (plant) out.hints.push('Por el consumo que marcaste conviene comparar con una planta eléctrica (o combinarla con el inversor).');
    return done();
  }

  // Recomendada = como cotiza el dueño: la más barata que arranca (si ninguna arranca: la mayor, "sujeta a revisión") con holgura
  // comercial K.recMargin. Su banco se dimensiona con horas NOMINALES (K.quoteFactor).
  const topKw = (cs) => cs.reduce((m, c) => (c.inv.kw > m.inv.kw ? c : m));
  const surgeOk = cands.filter((c) => c.o.checks.surgeOk);
  const pool = surgeOk.length ? surgeOk : [topKw(cands)];
  const roomy = (c) => c.inv.kw * 1000 >= K.recMargin * d.contW;   // holgura comercial de David
  const recPool = pool.some(roomy) ? pool.filter(roomy) : [topKw(pool)];   // si ninguno la cumple: el mayor, que es el que más holgura da
  let pick = recPool[0];   // la más barata con holgura, como el dueño; si no recarga entre cortes (12/24 V) lo dicen checks.chargeOk y las pistas
  const tight = (c) => K.margin * d.contW > K.tightShare * c.inv.kw * 1000 || d.peakW > K.tightShare * c.inv.kw * 1000 * c.inv.kSurge;
  if (tight(pick)) {   // va justa: si la hermana mayor cuesta ≤ 10 % más, esa es la recomendada
    const up = recPool.find((c) => c.inv.kw > pick.inv.kw && c.inv.ac === pick.inv.ac && c.o.totals.equipo <= (1 + K.upgradeMaxPct) * pick.o.totals.equipo && (c.o.checks.chargeOk || !pick.o.checks.chargeOk));
    if (up) pick = up;
  }
  const rec = { ...pick.o, badge: TIER_LABEL.recomendado };
  const sameOrMore = (o) => o.totals.total == null || rec.totals.total == null || o.totals.total >= rec.totals.total;   // con instalación incluida tampoco baja

  // Básica: un escalón más barato. De los inversores que arrancan con el margen técnico (K.margin), el sistema más barato (banco nominal, o con
  // menos baterías si aún cubre ≥ 65 % de las horas nominales). Se omite si ninguno sale más barato que la Recomendada.
  const basic = pool.flatMap((c) => [c.bats, pickBatteries(c.inv, d, { floor: true, slack: K.quoteSlack })].filter(Boolean).map((b) => mk(c.inv, b, 'basico', TIER_LABEL.basico)))
    .filter((o) => o.totals.equipo < rec.totals.equipo && (o.totals.total == null || rec.totals.total == null || o.totals.total <= rec.totals.total))
    .sort((x, y) => x.totals.equipo - y.totals.equipo || y.batteries.kwh - x.batteries.kwh)[0] || null;

  // Holgada: cubre las horas pedidas aun con las pérdidas normales (K.dod × K.eta). Si la Recomendada YA las cubre con pérdidas, lo que falta
  // es potencia → el siguiente inversor (con su banco honesto); si no, lo que faltan son baterías (las que cubren con pérdidas). Nunca cuesta menos.
  const real = K.dod * K.eta, recBats = cands.find((c) => c.inv === rec.inverter).bats;
  const honest = (inv, minKwh = 0) => { const di = withIdle(d, inv, a.hours); return pickBatteries(inv, { ...di, whResp: Math.max(di.whResp, minKwh * 1000 * real) }, { factor: real }); };   // minKwh: nunca menos banco que la Recomendada
  const covered = rec.coverageReal >= 1;
  let roomier = null;
  if (covered) {
    for (const c of cands.filter((x) => x.inv.kw > rec.inverter.kw).sort((x, y) => x.inv.kw - y.inv.kw)) {
      const hb = honest(c.inv, recBats.kwh), o = hb && mk(c.inv, hb, 'holgado', TIER_LABEL.holgado, { upgraded: 'inverter' });
      if (o && o.totals.equipo > rec.totals.equipo && sameOrMore(o)) { roomier = o; break; }
    }
  }
  if (!roomier) {
    let hb = covered ? recBats : honest(rec.inverter);
    if (hb && hb.price <= recBats.price) hb = grow(hb);
    roomier = hb && mk(rec.inverter, hb, 'holgado', TIER_LABEL.holgado, { upgraded: 'battery' });
  }

  out.options = [basic, rec, roomier].filter(Boolean);
  for (const o of out.options) o.why = explain(o, d, a, rec);

  // pistas
  const st = d.soft || d.starter, cap = rec.inverter.kw * 1000 * rec.inverter.kSurge;
  if (rec.review) {
    out.hints.push(rec.checks.surgeOk
      ? `Tu ${lc(st.t)} arranca con ≈ ${fmtKW(st.w * st.n * st.surge)}; un aire convencional de ese tamaño puede pedir 4–6× al arrancar: necesita soft-starter o equipo inverter; lo confirmamos en la visita.`
      : `Tu ${lc(st.t)} arranca con ≈ ${fmtKW(d.peakW)} y el inversor de ${fmtNum(rec.inverter.kw)} kW admite según ficha ≈ ${fmtKW(cap)}: necesita soft-starter o equipo inverter; lo confirmamos en la visita.`);
  }
  if (a.hours >= 24) out.hints.push('Con cortes de 24 h no hay red para recargar: la batería solo se repone con paneles o planta.');
  else if (!rec.checks.chargeOk) out.hints.push(`Con cortes diarios de ${fmtNum(a.hours)} h la batería no alcanza a recargarse de la red (≈ ${fmtNum(rec.rechargeH)} h): conviene paneles${rec.inverter.busV < 48 ? ' o pasar a un equipo de 48 V' : ''}.`);
  const v220Rows = rows.filter((r) => r.is220);
  if (v220Rows.length) out.hints.push(`${list(v220Rows.map((r) => r.t))}: por ser de 220 V el inversor es el de 120/240 V.`);
  if (ask.length) out.hints.push(`Revisa en la placa si ${list(ask.map((r) => `tu ${r.s}`))} ${ask.length > 1 ? 'son' : 'es'} de 220 V: cambiaría el inversor.`);
  if (a.place === 'apto' && a.solar) out.hints.push('En un apartamento los paneles necesitan techo o azotea con acceso: lo vemos en la visita.');
  if (plant) out.hints.push('Por el consumo que marcaste conviene comparar con una planta eléctrica (o combinarla con el inversor para cortes largos).');
  return done();
}

// ───────────────────── medidor de carga del inversor ─────────────────────
/**
 * Lo que marca la aguja del medidor del resultado: la carga continua de tus equipos sobre la potencia del inversor de la opción elegida (0 a 100 %).
 * Zonas: 'lo' holgado hasta 1 / K.recMargin (57 %: la holgura con la que vende David), 'mid' justo hasta K.tightShare (80 %), 'hi' al límite.
 * `loEnd` y `midEnd` (en % del dial) son los mismos números con los que el componente dibuja los tres arcos. null si no hay opción.
 */
export function loadMeter(R, o) {
  if (!R || !o) return null;
  const ratedW = o.inverter.kw * 1000, usedW = R.contW, ratio = usedW / ratedW;
  return {
    pct: Math.round(Math.min(100, Math.max(0, ratio * 100))), usedW, ratedW,
    zone: ratio <= 1 / K.recMargin ? 'lo' : ratio <= K.tightShare ? 'mid' : 'hi',
    loEnd: Math.round(100 / K.recMargin), midEnd: Math.round(K.tightShare * 100),
  };
}

// ───────────────────── presupuesto (PDF) ─────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CONFIRMA = 'Se confirma en la visita';
/** "3 días" (o "1 día"); null si no hay validez. Lo usan el PDF (encabezado) y la nota del resultado. */
export const validezTxt = () => (pricing.validityDays ? `${pricing.validityDays} ${pricing.validityDays === 1 ? 'día' : 'días'}` : null);
const acV = (inv) => (inv.ac.includes('240') ? '120/240 V' : '120 V');   // el sitio habla de 110 V; el presupuesto, como el dueño, de 120 V
const invLine = (inv) => (pricing.showModel
  ? `Inversor híbrido ${inv.brand} ${inv.disp || inv.model} · ${fmtNum(inv.kw * 1000, 0)} W · ${acV(inv)}`
  : `Inversor híbrido ${fmtNum(inv.kw, 1)} kW · ${inv.busV} V · ${acV(inv)}`);
const batLine = (b) => `Batería de litio ${pricing.showModel ? `${b.brand} ${b.model} · ` : ''}${fmtNum(b.kwh, 2)} kWh · ${b.busV} V · ${pricing.batteryTail}`;
const fnv = (str) => { let h = 0x811c9dc5; for (const b of new TextEncoder().encode(str)) { h ^= b; h = Math.imul(h, 0x01000193); } return h >>> 0; };
const dateParts = (f) => {   // Date | 'AAAA-MM-DD' | nada (hoy)
  const m = typeof f === 'string' && f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  const t = f instanceof Date && !Number.isNaN(+f) ? f : new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
};

/**
 * Presupuesto en PDF de la opción elegida (sin DOM): { numero, fechaTexto, empresa, cliente, titulo: 'PRESUPUESTO', lines, notas, garantias,
 * pagos, aviso, subtotal, abono: 0, total, incompleto, provisional (= pricing.provisional), validez ("3 días" o null), sistema, url } o null si no hay opción (vacío o fuera de alcance).
 * lines = [{ n, desc, und: 'PZA' | 'KIT' | 'ACT', cant, precio, total }] numeradas de corrido: 1 inversor, 2 baterías, 3 kit, 4 mano de obra
 * (solo con install 'instalado'); lo que no tiene cifra (mano de obra sola, transferencia, metros extra) va con precio null y la leyenda
 * "Se confirma en la visita", y no suma. subtotal = total = Σ de los renglones con precio (incompleto = hay renglones sin cifra).
 * numero = 'P-AAMMDD-XXXX', determinista (hash de encodeState + opción). `tier` pisa a answers.tier; `fecha`: Date o 'AAAA-MM-DD'.
 */
export function quote(answers, { tier, cliente, fecha, url } = {}) {
  const base = clean(answers), a = clean({ ...base, ...(tier ? { tier } : {}) });
  const r = size(a), sel = r.options.find((o) => o.tier === r.chosen);
  if (!sel) return null;
  const inv = sel.inverter, bat = batteries.find((b) => b.model === sel.batteries.model), t = sel.totals, rows = rowsOf(a), lines = [];
  const add = (desc, und, cant, precio) => lines.push({ n: lines.length + 1, desc, und, cant, precio, total: precio == null ? null : round(precio * cant, 2) });
  add(invLine(inv), 'PZA', 1, inv.priceEq);
  add(batLine(bat), 'PZA', sel.batteries.n, bat.priceEq);
  if (a.install === 'instalado') {
    if (t.detalle) { add(pricing.kitDesc[t.detalle.kitType], 'KIT', 1, t.detalle.kit); add(pricing.laborDesc[t.detalle.kitType], 'ACT', 1, t.detalle.mo); }
    else add(t.instalacion == null ? `Instalación completa · ${CONFIRMA}` : 'Instalación completa', 'ACT', 1, t.instalacion);
  }
  if (a.install === 'manoObra') add(Number.isFinite(pricing.laborOnly) ? 'Mano de obra de instalación' : `Mano de obra de instalación · ${CONFIRMA}`, 'ACT', 1, Number.isFinite(pricing.laborOnly) ? pricing.laborOnly : null);
  if (a.transfer === 'quiero') add(Number.isFinite(pricing.transferKit) ? 'Kit de transferencia' : `Kit de transferencia · ${CONFIRMA}`, 'KIT', 1, Number.isFinite(pricing.transferKit) ? pricing.transferKit : null);
  if (a.install !== 'equipo' && a.extraM > 0) {
    if (Number.isFinite(pricing.cablePerM)) add(`Cable adicional (${a.extraM} m)`, 'ACT', a.extraM, pricing.cablePerM);
    else add(`Cable adicional, +${a.extraM} m · ${CONFIRMA}`, 'ACT', 1, null);
  }
  const subtotal = round(lines.reduce((s, l) => s + (l.total ?? 0), 0), 2);
  const hN = sel.coverage >= K.quoteSlack ? a.hours : Math.floor(sel.coversH * 2) / 2;   // lo que cubre de verdad, nunca más de lo pedido
  const btu = rows.filter((x) => x.btu && x.surge > 2).reduce((m, x) => Math.max(m, x.btu), 0);   // aire convencional
  const notas = [
    `Esta capacidad cubre una necesidad estimada de ${fmtNum(hN)} ${hN === 1 ? 'hora continua' : 'horas continuas'} en ${r.needs220 ? '120/240 V' : '120 V'} acorde a la solicitud del cliente.`,
    `Equipos considerados: ${eqNames(rows, 8).join(', ')}.`,
    btu && `Sugerencia: aire acondicionado tipo inverter de ${fmtNum(btu, 0)} BTU.`,
    sel.review && `${sel.review}.`,
    t.detalle && t.detalle.range[0] !== t.detalle.range[1] && `La instalación es un precio referencial: según el recorrido va de ${fmtUSD(t.detalle.range[0])} a ${fmtUSD(t.detalle.range[1])}; se confirma en la visita.`,
  ].filter(Boolean);
  const f = dateParts(fecha), pad = (n) => String(n).padStart(2, '0');
  return {
    numero: `P-${pad(f.y % 100)}${pad(f.m)}${pad(f.d)}-${(fnv(`${encodeState(a)}|${sel.tier}`) % 36 ** 4).toString(36).toUpperCase().padStart(4, '0')}`,
    fechaTexto: `Maracay, ${f.d} de ${MESES[f.m - 1]} de ${f.y}`, empresa: { ...pricing.company }, cliente: txt(cliente, 60), titulo: 'PRESUPUESTO',
    lines, notas, garantias: [...pricing.warranty], pagos: pricing.payment,
    aviso: 'Documento no fiscal. Precios referenciales en dólares (US$), sujetos a la visita técnica.',
    subtotal, abono: 0, total: subtotal, incompleto: lines.some((l) => l.precio == null), provisional: pricing.provisional, validez: validezTxt(),
    sistema: { inversor: pricing.showModel ? `${inv.brand} ${inv.disp || inv.model}` : `Inversor híbrido ${fmtNum(inv.kw, 1)} kW`, baterias: sel.batteries.n, kwh: sel.batteries.kwh, kw: inv.kw },
    url: clean({ url }).url,
  };
}

// ───────────────────── estado compartible (?c=) ─────────────────────
const b64 = {
  enc: (s) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

/** base64url de un JSON mínimo (solo lo que difiere del default). */
export function encodeState(answers) {
  const a = clean(answers), o = {};
  if (Object.keys(a.items).length) o.e = a.items;
  if (a.custom.length) o.c = a.custom.map((c) => [c.t, c.w, c.n, c.m ? 1 : 0, c.h ?? null]);
  if (a.hours !== 8) o.h = a.hours;
  if (Object.keys(a.v220).length) o.v = Object.fromEntries(Object.entries(a.v220).map(([id, y]) => [id, y ? 1 : 0]));
  if (a.place) o.p = a.place;
  if (a.hot) o.t = 1;
  if (a.solar) o.s = 1;
  if (a.install !== 'equipo') o.i = a.install;
  if (a.transfer !== 'no') o.x = a.transfer;
  if (a.extraM) o.m = a.extraM;
  if (a.city) o.y = a.city;
  if (a.preset) o.r = a.preset;   // el punto de partida viaja en el enlace; tier / when / via / url NO (van fuera: ?o= ?w= ?via=)
  return b64.enc(JSON.stringify(o));
}

/** Inverso de encodeState → answers saneadas, o null si el string no sirve. */
export function decodeState(str) {
  try {
    const o = JSON.parse(b64.dec(String(str)));
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const v = o.v && typeof o.v === 'object' && !Array.isArray(o.v) ? o.v : {};
    return clean({
      items: o.e, hours: o.h ?? 8,
      custom: (Array.isArray(o.c) ? o.c : []).filter(Array.isArray).map(([t, w, n, m, h]) => ({ t, w, n, m, h })),
      v220: Object.fromEntries(Object.entries(v).map(([id, y]) => [id, y === 1])),
      place: o.p, hot: o.t === 1, solar: o.s === 1, install: o.i, transfer: o.x, extraM: o.m, city: o.y, preset: o.r,
    });
  } catch { return null; }
}
