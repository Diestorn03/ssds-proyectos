# Preguntas para David: Dimensiona tu respaldo

Contexto: armamos una página donde el cliente marca sus equipos y las horas de corte, y el sitio calcula inversor y baterías con tus precios de venta de los presupuestos; también baja un presupuesto en PDF. Para publicarla necesito que me confirmes lo siguiente. Donde dice "Asumí" es lo que estaba puesto cuando se hizo la pregunta: las respondidas (5 oct 2026) están abajo, en "Respondidas", y mandan sobre su "Asumí".

## Respondidas (5 oct 2026, audios de David vía Diego)

Los números de abajo (1 a 12) son los de la lista corta que Diego le mandó por WhatsApp, no los Q del resto de este documento. Los audios son transcripciones automáticas de WhatsApp: lo dudoso está marcado.

- **Q20 y Q3 (mostrar precios, marcas, potencias):** se puede mostrar todo. El rótulo "Precios de prueba · por confirmar" (`pricing.provisional`) se queda hasta cerrar lo pendiente de abajo.
- **Q30 (pago):** "Zelle, efectivo o Binance; en bolívares a tasa Binance" (confirmó Diego).
- **El 25 %:** es la ganancia de David sobre el costo de los equipos y ya está en su lista de precios de venta; no es un recargo de instalación (`installMode: 'factor'` no aplica).
- **1 · Instalación (Q1, Q2b):** mano de obra de 350 a 600 US$, la más alta en los 8 kW; "más o menos las mismas" que ya estaban. Los kits valen lo mismo en las tres opciones: cambiar de batería no implica más herraje ni más montaje. Aprobó kit + mano de obra por tramo (800, 900, 850 a 1.000 y 1.000 a 1.200): `installConfirmed: true`. El "excesiva" de su primer audio era "accesible" (error de la transcripción). Parte del audio quedó cortada ("ya que una sola...").
- **2 · Garantías (Q27):** "OK" (batería 2 años, inversor 1 año, tablero 3 meses, instalación 3 meses): ya no llevan "POR CONFIRMAR" en el PDF.
- **3 · Horas (Q31, Q7):** "está OK" (horas nominales con la aclaración de las pérdidas).
- **4 · Validez (Q28):** "tres días de validez"; Diego escuchó el audio y lo confirmó. `pricing.validityDays: 3`; sale en el PDF ("Oferta válida por 3 días", bajo la fecha) y en la nota del resultado.
- **5 · Paneles (Q5):** sí los vende, pero se cotizan aparte (según Diego); más adelante habrá un módulo para esa cotización. La página sigue sugiriendo la cantidad sin sumarla. Falta saber de cuántos vatios son (hoy 580 W).
- **Solo mano de obra (Q2):** se cotiza en el sitio (decisión de Diego): la opción se queda y dice "se confirma en la visita"; `pricing.laborOnly` queda en null.
- **6 · Zona (Q15):** la visita técnica es gratis en Aragua; en cada otro estado tiene un costo específico que aún no estiman. Puesto en la nota del resultado.
- **7 · Fotos (Q32):** mandó fotos de un Roccia instalado con una batería Felicity, otra del Roccia sobre su caja, y las etiquetas de varias cajas. Por audio aclaró que el Roccia de 6 kW "va en la pared y el ventilador lateralmente": es el de pared con pantalla negra. Su foto está en `public/equipos/roccia-6k-120-220.(webp|jpg)` (recorte de la foto que mandó) y sale en la página y en el PDF. La FLA12171-EU usa provisionalmente la foto de la FLA12280 (`fla12171-eu.*`): reemplazar cuando haya una propia.
- **8 · Inversores de 12 y 24 V (Q22):** los sigue vendiendo mientras estén disponibles (para clientes de presupuesto corto: "hay gente que me dice solamente tengo mil cien"). La caja del de 24 V dice IVCM2024-LV (2000 VA / 2000 W) y David confirmó por audio que es el "IVCM 2024 LV" (2 kW, 24 V) y Diego decidió que se imprime el nombre de la caja: el modelo pasó de IVEM2024-LV a IVCM2024-LV. El de 12 V sigue como IVEM1612-LV (no se vio su caja).
- **9 · Baterías de 12 V (Q25):** sus únicos dos modelos son la FLA12171-EU (2,2 kWh, 12,8 V, 171 Ah) y la FLA12280-EU (3,6 kWh, 12,8 V, 280 Ah); el 2,56 kWh de sus presupuestos es la batería de 24 V (la caja dice FLA24100PG2, 25,6 V; Diego decidió imprimir ese nombre, antes FLA24100-EU). La 12280 ya estaba bien (3,58 kWh). La FLA12171-EU ya está en el catálogo a 650 US$: David dijo por audio que "vale 130 dólares menos que la otra" (780 - 130, derivado). Su corriente continua no está publicada: se usa 100 A, conservador (la FLA48171, de las mismas celdas, da 120 A); confirmar con la ficha.
- **10 · Dos baterías (Q1, precios que se mueven):** el 3.060 c/u fue un descuento a un cliente específico, "un error mío"; "en todo caso vendemos el precio de presupuestos más caros". Queda 3.315 (FLA48314). Diego confirmó que la regla aplica también al Roccia (990 en vez de 954) y a la FLA48230 (2.150 en vez de 2.100): puestos. Con eso la Recomendada de ejemplo (Roccia + FLA48230) pasa de 3.054 a 3.140.
- **11 · Consumos (Q8):** nevera y freezer a 230 W todo el tiempo (puesto, `duty` 1): "la nevera no apaga nunca, simplemente pasa a consumir menos" y "hay que estandarizarlas a 230 vatios porque las he visto consumir hasta menos, pero hay que tener un poquito más"; el freezer es igual que la nevera (Diego). Aire de 12.000 BTU a 1.200 W bien. 1 HP = 746 W (bomba de 1 HP e hidroneumático, puestos); ½ HP = 373 W (puesto). Dijo que hay que aclarar si la bomba es de 110 o de 220 V: la bomba y el hidroneumático ahora preguntan "¿es de 220 V?" como los aires grandes (un equipo de 220 V obliga a un inversor 120/240 V). El microondas no lo mencionó. Por el cambio de la nevera, algunos casos cambian (por ejemplo "Lo esencial" a 8 h pasa a un 3 kW con una FLA48100, y "Casa con un aire" ya no tiene opción Básica).
- **12 · Roccia (Q24):** mandó la etiqueta: PV3300 TLV (MD PV33-6048 TLV), 6000 W, AC 120/240 V 25 A, cargador solar 80 A, MPPT 60 a 230 V, Voc máx. 245 V, carga desde la red: entrada 240 V 36 A, salida 48 V 40 A. Coincide con lo supuesto. Con el cargador solar de 80 A (3.840 W a 48 V) el máximo de paneles sugeridos del Roccia bajó de 8 a 6 de 580 W. Sigue sin etiqueta: el arranque (2,5×) y el consumo en vacío (60 W).

---

De aquí hacia abajo está la lista original, tal como se planteó; si una pregunta ya está arriba en "Respondidas", vale lo de arriba (por ejemplo Q3, Q8, Q20, Q22, Q25, Q27, Q28, Q30 y Q31).

## Primero: lo que bloquea publicar

**Q20. ¿Podemos mostrar tus precios de venta en la página de demostración?** Los precios usados: 495, 954, 1.200, 2.100, 3.315, 4.950, 1.950, 780, 700. Cada vez que se sube a la rama principal, la demo queda pública para cualquiera. Asumí: no se publica; la página queda aparte y dice "Precios de prueba · por confirmar".

**Q3. ¿El sitio y el PDF pueden mostrar marca y modelo (Felicity, Roccia, IVEM3048, FLA48100...)?** En tus presupuestos reales siempre salen. Asumí: sí, igual que tus presupuestos.

**Q1. ¿Cómo calculas la instalación?** Asumí: kit + mano de obra por tramo de inversor, con el tablero dentro del kit, hasta 2 m de cable: 1,6 a 2 kW 800; 3 kW 900; Roccia 6 kW 850 a 1.000; 8 kW 1.000 a 1.200. El número de baterías no cambia la instalación. Antes se pensó "equipo × 1,25"; ¿a qué se refería ese 1,25? Tus presupuestos no encajan con un porcentaje.

**Q2. Instalación, casos especiales.** ¿Cuánto cobras por metro extra de cable más allá de 2 m? ¿Y por "solo mano de obra" cuando el cliente ya tiene el tablero? ¿Y por el kit de transferencia? Asumí: no se suman al total y se muestran como "se confirma en la visita".

**Q2b. ¿Qué mueve la mano de obra del Roccia 6 kW entre 350, 400 y 500 con el mismo equipo?** (distancia, 220 V, piso, cliente). Asumí: 350 de mano de obra + 500 de kit; el rango se muestra como referencia.

**Q31 y Q7. Horas nominales o reales.** Tus presupuestos calculan horas = kWh de baterías ÷ kW promedio (5,12 kWh a 1 kW = 5,12 h). Con pérdidas normales (profundidad de descarga y eficiencia) esas horas son cerca de un 19 % menos. Asumí: la Recomendada usa tu cuenta ("≈ N h estimadas") y la página aclara en pequeño las horas con pérdidas; la Holgada cubre las horas pedidas aun con pérdidas. ¿Te parece bien? ¿Descuentas algo? ¿Qué carga en vatios usas para un aire, cuenta al 100 %? Para "a la vez" asumí: lo que queda encendido más el aparato grande de uso corto.

**Q27. Garantías en el PDF.** Solo 5 de 22 presupuestos las imprimen. Asumí: batería 2 años, inversor 1 año, tablero 3 meses, instalación 3 meses, en todos los PDF. ¿Valen para todos? ¿Las imprimimos siempre?

**Q28. ¿El PDF lleva validez del precio, IVA, número de documento, dirección o firma?** Ninguno de tus presupuestos los trae. Asumí: no; solo dice "Presupuesto" (no es factura) con razón social y RIF. Si quieres validez, ¿cuántos días?

**Q30. Forma de pago y tasa.** Asumí: "Pagos por Zelle, efectivo o Binance; en bolívares a tasa Binance", como 21 de tus 22 presupuestos. ¿Sigue así? ¿Quieres otra frase, o incluir Pago Móvil?

## Precios e instalación

**Q21. ¿Cuándo eliges 3, 6 u 8 kW?** Asumí: el inversor trabaja a 57 % o menos de su potencia (4 kW de carga va a 8 kW; 1,8 kW va a 6 kW). ¿Por qué 2 inversores de 6 kW en un caso y no uno de 8 kW? Asumí: más de un inversor es "con ingeniero".

**Q11.** ¿Cuánto cobras por un segundo inversor (kit + mano de obra)? Asumí: un solo inversor; más es cotización caso por caso.

**Q1 (precios que se mueven).** ¿Por qué el IVEM3048 se queda en 495 siempre? ¿Por qué la FLA48230 y las 2×FLA48314 de un caso van a otro nivel de precio: descuento por cliente o por volumen? ¿Por qué el kit del 8 kW es 700 en un caso y 500 en otro? ¿8 kW: 1.000, 1.100 o 1.200? Asumí: el precio más repetido en tus presupuestos.

**Q5. ¿Vendes paneles solares?** ¿Precio por panel? Asumí: no; la página sugiere cuántos y dice "se cotizan aparte", sin sumar.

## Productos y marca

**Q22. ¿Los IVEM1612-LV e IVEM2024-LV (12 y 24 V) son los mismos IVCM con otro nombre?** Asumí: sí, los ofreces para cargas chicas. Si ya no los vendes, se apagan.

**Q23. ¿Vendes el IVEM5048 de 5 kW?** Asumí: no; el Roccia de 6 kW ocupa su lugar.

**Q24. Roccia 6 kW "PV3300": ¿ficha técnica o manual?** No hallé la oficial. Asumí: es 120/240 V, arranca 2,5 veces su potencia y consume 60 W en reposo. ¿Por qué 990 en dos casos y 954 en el resto?

**Q25. Batería de 12 V.** Tus presupuestos imprimen 2,56 kWh, pero 12 V × 280 Ah son 3,58 kWh. ¿Cuál se entrega? Asumí: 3,58 kWh (el número impreso sería un error de plantilla).

**Q26. ¿La FLA48230 va solo con el Roccia?** (6 de 6 ventas.) ¿Es por técnica o costumbre? Asumí: solo con el Roccia.

**Q6. ¿Qué baterías ofreces?** Asumí: FLA48100, FLA48230, FLA48314 y FLA48460 sí; la de rack FLA48100UG1 no, hasta confirmar que sirve con tus inversores.

**Q32. Fotos de los equipos.** La página y el PDF muestran la foto del inversor y la batería recomendados, tomadas del catálogo Felicity. ¿Me mandas una foto real del Roccia 6 kW que instalas? (hoy sale un dibujo). ¿Prefieres fotos de tus propias instalaciones? Asumí: catálogo para Felicity y dibujo para el Roccia. Ojo: la foto de la batería de 12 V del catálogo dice "200 Ah" aunque el modelo es de 280 Ah.

## Técnicas

**Q8. Potencias típicas.** Asumí: nevera 150 W al 35 % de uso, aire 12k convencional 1.200 W al 60 %, microondas 1.300 W, bomba de 1 HP 1.000 W, etc. ¿Las corriges según lo que ves en campo?

**Q9.** ¿Los aires de 18.000 y 24.000 BTU de tus clientes son de 220 V o también hay de 120 V? Asumí: la página pregunta "¿es de 220 V?".

**Q10.** Un aire convencional de 24.000 BTU arranca con más fuerza de la que garantiza el inversor de 8 kW. ¿Instalas arrancador suave (precio) o recomiendas aire inverter? Asumí: sale "sujeto a revisión".

**Q29.** Un equipo 120/240 V (Roccia, 8 kW) alimentando cargas de 120 V: ¿tiene un tope de corriente por cada lado? Asumí: no se limita hoy.

**Q12.** ¿Desde qué consumo mandas al cliente a planta eléctrica? Asumí: más de 20 kWh de respaldo, más de 8 kW, o 12 horas o más con aire.

**Q17.** Clima caluroso: asumí que la nevera y los aires trabajan 30 % más. ¿Razonable?

## Página y PDF

**Q16.** ¿Sirven los modelos de ejemplo "Negocio" (vitrinas, enfriador, punto de venta, cámaras) y "Oficina" desde la primera versión? Asumí: sí.

**Q15.** ¿Atiendes solo Maracay y Aragua o todo el país, y la visita técnica es gratis? Asumí: el formulario pregunta la zona (Maracay, Turmero, Cagua, La Victoria, Otra) sin prometer visita gratis ni horario.

**Q18.** ¿Quieres "Dimensiona tu respaldo" también en el menú de escritorio? Asumí: no; está en el menú móvil, el pie y un botón en Respaldo Energético.

**Q19.** El mensaje de WhatsApp empieza con "Hola SSD&S, dimensioné mi respaldo en su web." ¿Te sirve para etiquetar esos chats? Asumí: sí, sin analítica extra.

Números cerrados: Q4 (línea de 12/24 V) se responde en Q22; Q13 (garantías, entrega, validez) en Q27 y Q28; Q14 (pagos) es ahora Q30.

## Dónde se cambia

| Pregunta | Archivo | Constante |
|---|---|---|
| Q1, Q2, Q2b, Q11 | `src/data/dimensionar.js` | `pricing.install`, `pricing.installMode`, `pricing.installFactor`, `pricing.cablePerM`, `pricing.laborOnly`, `pricing.transferKit` |
| Q3 | `src/data/dimensionar.js` | `pricing.showModel` |
| Q5 | `src/data/dimensionar.js` | `panel`, `pricing.panelUsd` |
| Q6, Q25, Q26 | `src/data/dimensionar.js` | `batteries[]` (`available`, `kwh`, `onlyWith`) |
| Q7 | `src/data/dimensionar.js` | `K.simult` |
| Q8, Q9, Q16 | `src/data/dimensionar.js` | `loads[]`, `presets[]` |
| Q10, Q29 | `src/data/dimensionar.js` | `inverters[].kSurge`, filtro de inversores |
| Q12 | `src/data/dimensionar.js` | `K.plant` |
| Q15 | `src/components/pages/Dimensionador.astro` | `cities` |
| Q17 | `src/data/dimensionar.js` | `K.hotDuty` |
| Q18 | `Header.astro`, `Footer.astro`, `src/pages/servicios/[slug].astro` | enlaces a `/dimensionar/` y `services[1].tool` en `site.js` |
| Q19 | `src/data/dimensionar.js` | `OPENING` |
| Q20 | `src/data/dimensionar.js` | `pricing.provisional` |
| Q21 | `src/data/dimensionar.js` | `K.recMargin`, `K.margin` |
| Q22, Q23, Q24 | `src/data/dimensionar.js` | `inverters[]` |
| Q27 | `src/data/dimensionar.js` | `pricing.warranty` |
| Q28 | `src/data/dimensionar.js` | `pricing.validityDays` |
| Q30 | `src/data/dimensionar.js` | `pricing.payment` |
| Q31 | `src/data/dimensionar.js` | `K.quoteFactor`, `K.quoteSlack` |
| Q32 | `public/equipos/` | `<modelo>.webp` (página) y `<modelo>.jpg` (PDF) |
