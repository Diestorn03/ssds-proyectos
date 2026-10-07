// Single source of truth for everything the site says about SSD&S.
// Every fact here comes from the company's Instagram (@tusolucionindustrial), see docs/BRIEF.md.
// Items marked `confirm: true` are not on Instagram and must be checked with the client before going live.

export const brand = {
  name: 'SSD&S C.A.',
  shortName: 'SSD&S',
  legalName: 'SSD&S PROYECTOS C.A.',
  razonSocial: 'SERVICIOS Y SUMINISTROS D&S, C.A.', // misma empresa que SSD&S C.A.; va en el presupuesto en PDF
  rif: 'J-40625203-4',
  tagline: 'Potencia e Ingeniería Industrial',
  claim: 'Energía confiable para tu negocio.',
  description:
    'Ingeniería eléctrica en media y baja tensión, montaje de transformadores, plantas eléctricas, tableros de transferencia automática (ATS) y climatización industrial. Desde Maracay para toda Venezuela.',
  city: 'Maracay',
  region: 'Aragua',
  country: 'Venezuela',
  founded: null, // confirm with client
};

export const contact = {
  phoneDisplay: '+58 424-376 7264',
  phoneE164: '+584243767264',
  whatsapp: '584243767264',
  email: 'ssdsproyectos@gmail.com',
  instagram: 'tusolucionindustrial',
  instagramAlt: 'tusoluciondinamica',
  address: 'Maracay, Estado Aragua, Venezuela', // exact street address: confirm with client
  hours: 'Lunes a viernes · atención de emergencias todo el año', // confirm with client
};

/** WhatsApp deep link with a prefilled message (UTF-8 safe). */
export const wa = (text = 'Hola SSD&S, quiero cotizar un servicio.') =>
  `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(text)}`;

/** WhatsApp a un número cualquiera (dígitos con código de país, p. ej. 584121234567); sin número abre el selector de contacto. Lo usa la app /app/. */
export const waTo = (telefono, text) => `https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(text)}`;

export const social = {
  instagram: `https://www.instagram.com/${contact.instagram}/`,
  instagramAlt: `https://www.instagram.com/${contact.instagramAlt}/`,
};

export const nav = [
  { href: '/servicios/', label: 'Servicios' },
  { href: '/nosotros/', label: 'Nosotros' },
  { href: '/contacto/', label: 'Contacto' },
];

export const services = [
  {
    slug: 'potencia-electrica',
    code: '01',
    name: 'Servicios Eléctricos de Potencia',
    short: 'Potencia eléctrica',
    kicker: 'Media y baja tensión',
    summary:
      'Ingeniería en media y baja tensión, montaje de transformadores y mantenimiento de redes eléctricas bajo normativa.',
    headline: 'Precisión en redes de media y baja tensión.',
    intro:
      'Trabajar con media y baja tensión exige precisión, protocolos de seguridad estrictos y conocimiento técnico avanzado. Confía la columna vertebral de tu infraestructura eléctrica a técnicos capacitados.',
    items: [
      { t: 'Asesoría y diseño del proyecto', d: 'Dimensionamos la infraestructura eléctrica de industrias, comercios y centros comerciales para optimizar costos de energía y prevenir sobrecargas.' },
      { t: 'Montaje e instalación de transformadores', d: 'Montaje, conexión y puesta en servicio en media y baja tensión, con protocolos de seguridad en cada maniobra.' },
      { t: 'Subestaciones y redes eléctricas', d: 'Instalación, diagnóstico y mantenimiento de redes industriales bajo normativa.' },
      { t: 'Inspección de red eléctrica', d: 'Evaluación técnica de tus instalaciones para detectar riesgos antes de que se conviertan en paradas.' },
    ],
    cta: 'Solicita tu inspección de red eléctrica',
    waText: 'Hola SSD&S, quiero solicitar una inspección de red eléctrica (media/baja tensión).',
    tags: ['Media tensión', 'Baja tensión', 'Transformadores', 'Subestaciones', 'Redes industriales'],
  },
  {
    slug: 'respaldo-energetico',
    tool: { href: '/dimensionar/', label: 'Dimensiona tu respaldo' },
    code: '02',
    name: 'Respaldo Energético',
    short: 'Respaldo energético',
    kicker: 'Plantas eléctricas y ATS',
    summary:
      'Mantenimiento, instalación y consumibles para plantas eléctricas, más fabricación de tableros de transferencia automática (ATS) a medida.',
    headline: 'Que la energía de tu planta nunca se detenga.',
    intro:
      'Tu planta o generador eléctrico es el corazón de tu respaldo energético. Un fallo en la transferencia durante un corte se traduce en horas de parada y pérdidas económicas.',
    items: [
      { t: 'Tableros de transferencia automática (ATS)', d: 'Fabricamos e instalamos transferencias automatizadas adaptadas a la carga exacta de tu empresa: cambio de fuente inmediato y seguro, sin depender de un operador.' },
      { t: 'Mantenimiento preventivo y correctivo', d: 'Pruebas de banco de carga, calibración de parámetros y servicio técnico bajo estrictas normas de seguridad para generadores de cualquier capacidad.' },
      { t: 'Consumibles y repuestos originales', d: 'Filtros, lubricantes y repuestos garantizados. Usar consumibles genéricos o postergar el cambio reduce la vida útil del motor.' },
      { t: 'Instalación de plantas eléctricas', d: 'Instalación y puesta en marcha de grupos electrógenos para respaldo residencial, comercial e industrial.' },
      { t: 'Sistemas de respaldo con inversor híbrido y baterías de litio', d: 'Dimensionamos el inversor y el banco de baterías a los equipos que quieres mantener encendidos y las horas de corte, y los instalamos.' },
    ],
    cta: 'Agenda la revisión de tu planta',
    waText: 'Hola SSD&S, quiero agendar mantenimiento / cotizar un tablero ATS para mi planta eléctrica.',
    tags: ['Plantas eléctricas', 'Generadores', 'ATS', 'Banco de carga', 'Consumibles', 'Inversores', 'Baterías de litio'],
  },
  {
    slug: 'climatizacion',
    code: '03',
    name: 'Climatización Industrial y Comercial',
    short: 'Climatización',
    kicker: 'HVAC',
    summary:
      'Diseño, instalación, reparación y planes de mantenimiento preventivo para aire acondicionado central, chillers y unidades de precisión.',
    headline: 'Rendimiento térmico estable y continuo.',
    intro:
      'El rendimiento de tus equipos de cómputo, tus procesos de manufactura y el confort de tus clientes depende de una climatización estable y continua.',
    items: [
      { t: 'Aire acondicionado central', d: 'Diseño e instalación de sistemas centrales para comercios, oficinas e industria.' },
      { t: 'Chillers y unidades de precisión', d: 'Instalación y servicio de equipos de precisión para salas de cómputo y procesos sensibles.' },
      { t: 'Planes de mantenimiento preventivo', d: 'Rutinas programadas que evitan la falla y alargan la vida útil del sistema HVAC.' },
      { t: 'Reparación y diagnóstico', d: 'Atención técnica para recuperar la operatividad con respuesta oportuna.' },
    ],
    cta: 'Coordina una visita técnica',
    waText: 'Hola SSD&S, quiero coordinar una visita técnica de climatización (HVAC).',
    tags: ['AC central', 'Chillers', 'Unidades de precisión', 'Mantenimiento HVAC'],
  },
];

export const process = [
  { n: '01', t: 'Evaluación', d: 'Inspección técnica de tus instalaciones y diagnóstico de la red, la planta o el sistema HVAC.' },
  { n: '02', t: 'Diseño', d: 'Dimensionamos la solución a la carga exacta de tu operación y te enseñamos a identificar el esquema correcto.' },
  { n: '03', t: 'Montaje', d: 'Ejecución segura bajo protocolos estrictos: transformadores, tableros ATS, plantas y equipos de clima.' },
  { n: '04', t: 'Mantenimiento', d: 'Planes preventivos y correctivos para que la energía y el clima de tu empresa nunca fallen.' },
];

export const values = [
  { t: 'Rigor técnico', d: 'Conocimiento avanzado y ejecución precisa en cada maniobra de media y baja tensión.' },
  { t: 'Respuesta oportuna', d: 'La respuesta rápida es clave para evitar paradas críticas. Atendemos proyectos y emergencias técnicas.' },
  { t: 'Máxima seguridad', d: 'Protocolos estrictos y normas de seguridad en cada proyecto, desde la evaluación hasta el montaje.' },
  { t: 'Cobertura nacional', d: 'Operamos desde Maracay y desplegamos cuadrillas especializadas a cualquier estado del país.' },
];

export const sectors = [
  { t: 'Industrial', d: 'Plantas de manufactura, procesos continuos y subestaciones.' },
  { t: 'Comercial', d: 'Centros comerciales, comercios, oficinas y salas de cómputo.' },
  { t: 'Residencial', d: 'Respaldo eléctrico y climatización para residencias.' },
];

export const faqs = [
  {
    q: '¿Transferencia manual o automática?',
    a: 'Depender de un operador para cambiar el interruptor durante una falla puede significar minutos valiosos de pérdida o daños en maquinaria sensible. Un tablero ATS fabricado a la carga exacta de tu empresa hace el cambio de fuente de forma inmediata y segura.',
  },
  {
    q: '¿Mi empresa necesita baja o media tensión?',
    a: 'Elegir el esquema equivocado cuesta dinero y paradas de producción. Dimensionamos la infraestructura según tu demanda y te enseñamos a identificar qué tipo de subestación o red requiere tu operación.',
  },
  {
    q: '¿Cada cuánto debo hacer mantenimiento a mi planta eléctrica?',
    a: 'El mantenimiento exige más que cambiar el aceite: pruebas de banco de carga, calibración de parámetros y consumibles originales. Programamos revisiones periódicas para que el equipo responda cuando más lo necesitas.',
  },
  {
    q: '¿Atienden fuera de Maracay?',
    a: 'Sí. Operamos desde Maracay, estado Aragua, y desplegamos cuadrillas especializadas para instalación, mantenimiento y diagnóstico en cualquier estado de Venezuela.',
  },
];

/** Brand phrases seen on Instagram, used in marquees. */
export const claims = [
  'Energía confiable para tu negocio',
  'Soluciones dinámicas en electricidad y potencia',
  'Precisión en redes de media tensión',
  'Ingeniería integral para mantener tu empresa en movimiento',
  'Cobertura en todo el territorio nacional',
  'Rigor técnico · Respuesta oportuna · Máxima seguridad',
];

/** Real Instagram posts (newest first), all 14 of them. Images live in /public/ig/<code>.webp (640×811). `reel: true` = video post (cover frame). */
export const posts = [
  { code: 'DdwubTgvotH', date: '2026-09-26', title: 'Climatización estable y continua', text: 'Diseño, instalación y mantenimiento preventivo para aire acondicionado central, chillers y unidades de precisión.' },
  { code: 'Ddt6o2VkdoJ', date: '2026-09-25', title: 'Protege la inversión de tu planta', text: 'El rendimiento de una planta eléctrica depende directamente de la calidad de sus consumibles.' },
  { code: 'DdmM5JnRQUK', date: '2026-09-22', title: 'Precisión en redes de media tensión', text: 'Montaje, conexión y mantenimiento preventivo para asegurar estabilidad en tu instalación industrial.' },
  { code: 'DdeXN0Ckbm8', date: '2026-09-19', title: 'Transferencia manual o automática', text: '¿Cuál es la correcta para tu negocio? Las ATS de SSD&S garantizan un cambio de fuente inmediato y seguro.' },
  { code: 'DdaPUa2RhWr', date: '2026-09-17', title: '¿Tu planta responderá cuando la necesites?', text: 'El peor momento para descubrir que una planta no funciona es durante un corte. Banco de carga, calibración y consumibles originales.', reel: true },
  { code: 'DdXQ8czuyU9', date: '2026-09-16', title: 'Sin fronteras dentro de Venezuela', text: 'Cuadrillas especializadas para redes, transformadores y plantas eléctricas en cualquier estado del país.' },
  { code: 'DdMYUkREepK', date: '2026-09-12', title: '¿Baja o media tensión?', text: 'Elegir el esquema equivocado te cuesta dinero y paradas de producción. Te enseñamos a identificar el tuyo.' },
  { code: 'DdE0DxZxTWX', date: '2026-09-09', title: 'Cuatro consumibles esenciales', text: 'Los consumibles que alargan la vida de tu planta eléctrica.' },
  { code: 'DdCgdr8vwtx', date: '2026-09-08', title: '¿Tu tablero ATS necesita revisión?', text: 'Un fallo en la transferencia automática durante un corte se traduce en horas de parada y pérdidas económicas.', reel: true },
  { code: 'Dc6O1Six9md', date: '2026-09-05', title: 'Ingeniería integral', text: 'Un portafolio especializado para mantener tu empresa en movimiento.' },
  { code: 'Dc1GSfqRgiC', date: '2026-09-03', title: 'Soluciones integrales de ingeniería', text: 'Alta ingeniería, energía y clima para el sector comercial e industrial.', reel: true },
  { code: 'DcvrYafR3sN', date: '2026-09-01', title: 'Soluciones dinámicas', text: 'La ingeniería no es solo suministrar energía; es saber distribuirla, automatizarla y protegerla.' },
  { code: 'Dcvr-LNRMDe', date: '2026-09-01', title: 'Bienvenidos a SSD&S', text: 'Potencia e ingeniería industrial: rigor técnico con ejecución segura.' },
  { code: 'DcvqQuZRWqb', date: '2026-09-01', title: 'Conecta con nuestro equipo técnico', text: 'Datos de contacto directos ante cualquier proyecto o emergencia técnica.' },
];

export const postUrl = (code) => `https://www.instagram.com/p/${code}/`;
