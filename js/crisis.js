/* Morpheus MD — Modo crisis: algoritmos interactivos con reloj, contadores, dosis por peso y resumen para copiar.
   El contenido clínico (dosis, pasos, criterios) sale de las guías citadas en cada algoritmo; el diseño es propio.
   Nada se escribe en la historia: al terminar se genera un resumen con horas para copiar o compartir. */
window.Crisis = (function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => parseFloat(String(v == null ? '' : v).replace(',', '.'));
  const f = (x, d = 1) => (isFinite(x) ? String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',') : '—');
  const hora = (ms) => new Date(ms).toTimeString().slice(0, 8);
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------- Presentaciones (editables en "Presentaciones de tu hospital" y en Mi farmacia) ---------- */
  const PRES_OPC = {
    lido: { t: 'Lidocaína', u: 'mg/mL', ops: [[10, '1 % (10 mg/mL)'], [20, '2 % (20 mg/mL)']], def: 20 },
    atro: { t: 'Atropina', u: 'mg/mL', ops: [[0.5, '0,5 mg/mL'], [1, '1 mg/mL']], def: 0.5 },
    mg: { t: 'Sulfato de magnesio', u: 'mg/mL', ops: [[100, '10 % (100 mg/mL)'], [200, '20 % (200 mg/mL)'], [500, '50 % (500 mg/mL)']], def: 200 },
  };
  let C = {}; // cfg de la app (se asigna en render)
  const pres = (k) => { const p = (C.pres || {})[k]; return p != null ? p : PRES_OPC[k].def; };

  /* ---------- Textos de dosis ---------- */
  const D = {
    adr: (mg) => `${f(mg, 2)} mg = ${f(mg, 2)} mL de la ampolla de 1 mg/mL`,
    adrDil: (mg) => `${f(mg, 3)} mg = ${f(mg * 10, 1)} mL de adrenalina diluida a 0,1 mg/mL (1 ampolla de 1 mg + 9 mL de SF)`,
    adrMcg: (mcg) => `${f(mcg, 0)} mcg = ${f(mcg / 10, 1)} mL de adrenalina a 10 mcg/mL (1 mg en 100 mL de SF)`,
    amio: (mg) => `${f(mg, 0)} mg = ${f(mg / 50, 1)} mL (ampolla de 150 mg/3 mL = 50 mg/mL)`,
    lido: (mg) => `${f(mg, 0)} mg = ${f(mg / pres('lido'), 1)} mL de lidocaína ${pres('lido') === 10 ? '1 %' : '2 %'}`,
    atro: (mg) => `${f(mg, 2)} mg = ${f(mg / pres('atro'), 1)} mL (ampolla de ${f(pres('atro'), 1)} mg/mL)`,
    adeno: (mg) => `${f(mg, 1)} mg = ${f(mg / 3, 1)} mL (ampolla de 6 mg/2 mL), en bolo rápido + 20 mL de SF`,
    mgso4: (g) => `${f(g, 1)} g = ${f((g * 1000) / pres('mg'), 1)} mL de sulfato de magnesio ${{ 100: '10 %', 200: '20 %', 500: '50 %' }[pres('mg')]}`,
  };
  const P = () => S.peso; // peso del paciente en crisis
  const faltaPeso = '<i>Escribe el peso arriba para calcular.</i>';

  /* ---------- Estado de la crisis ---------- */
  let S = null;
  const GUARDA = 'morpheus-crisis';
  function guardar() { try { if (S) localStorage.setItem(GUARDA, JSON.stringify(S)); else localStorage.removeItem(GUARDA); } catch (e) {} }
  function recuperar() { try { const x = JSON.parse(localStorage.getItem(GUARDA) || 'null'); if (x && x.algo && ALG[x.algo] && !x.fin) S = x; } catch (e) {} }
  function evento(txt, extra) { const e = Object.assign({ ms: Date.now(), txt }, extra || {}); S.ev.push(e); guardar(); return e; }
  function nuevoCiclo() { S.ciclo = Date.now(); S.avisoCiclo = false; }

  /* ---------- Energías ---------- */
  function energiaAdulto() {
    if ((C.desfib || 'bif') === 'mono') return 'Monofásico: 360 J';
    const j = C.biJ || 200;
    return `Bifásico: ${j === 'max' ? 'energía máxima del equipo' : j + ' J'} (según el fabricante, habitual 120–200 J; si no se sabe, la máxima). Las siguientes iguales o mayores.`;
  }
  function energiaPed(n) {
    const w = P(); if (!(w > 0)) return 'Primera 2 J/kg · segunda 4 J/kg · siguientes ≥4 J/kg (máx. 10 J/kg o dosis de adulto). ' + faltaPeso;
    if (n <= 2) { const jkg = n <= 1 ? 2 : 4; return `Descarga ${n}: ${jkg} J/kg = <b>${f(jkg * w, 0)} J</b>. Esquema: 2 → 4 → ≥4 J/kg, máx. 10 J/kg o la dosis de adulto.`; }
    return `Descarga ${n}: ≥ 4 J/kg = <b>${f(4 * w, 0)} J</b> o más, hasta 10 J/kg = ${f(Math.min(10 * w, 360), 0)} J (sin pasar la dosis de adulto).`;
  }

  /* ---------- Bloques reutilizables ---------- */
  const HT = ['Hipovolemia', 'Hipoxia', 'Hidrogeniones (acidosis)', 'Hipo/hiperpotasemia', 'Hipotermia', 'Neumotórax a tensión', 'Taponamiento cardíaco', 'Tóxicos', 'Trombosis pulmonar', 'Trombosis coronaria'];
  const QX = ['Anafilaxia', 'Toxicidad por anestésicos locales (LAST)', 'Bloqueo neuroaxial alto o total', 'Sobredosis de anestésico o de opioide', 'Hemorragia quirúrgica oculta', 'Auto-PEEP o hiperinsuflación', 'Embolia gaseosa o grasa', 'Reflejo vagal intenso (tracción, neumoperitoneo)', 'Hiperpotasemia por succinilcolina (miopatías)'];
  const RCP_ADULTO = ['Comprime fuerte (5–6 cm) y rápido (100–120/min); deja reexpandir el tórax.', 'Minimiza las interrupciones; cambia de compresor cada 2 min.', 'Sin vía aérea avanzada: 30:2. Con vía aérea avanzada: 1 ventilación cada 6 s (10/min) sin pausar las compresiones.', 'Evita la hiperventilación.', 'Capnografía continua: si el EtCO₂ es bajo o cae, mejora la calidad de la RCP.'];
  const RCP_PED = ['Comprime ≥1/3 del diámetro del tórax, 100–120/min; deja reexpandir.', 'Sin vía aérea avanzada: 15:2 con 2 reanimadores (antes de la pubertad); 30:2 con 1 reanimador o después de la pubertad.', 'Con vía aérea avanzada: 1 ventilación cada 2–3 s sin pausar las compresiones.', 'Cambia de compresor cada 2 min. Vigila EtCO₂ y, si hay línea arterial, la presión diastólica.'];

  /* ---------- Algoritmos ---------- */
  const OFICIAL_AHA = 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/algorithms';
  function pcr(opc) {
    const ped = !!opc.ped, emb = !!opc.emb;
    const adrTxt = () => (ped ? (P() > 0 ? `Adrenalina ${D.adrDil(Math.min(0.01 * P(), 1))} (0,01 mg/kg, máx. 1 mg), cada 3–5 min.` : 'Adrenalina 0,01 mg/kg (máx. 1 mg) cada 3–5 min. ' + faltaPeso) : `Adrenalina ${D.adr(1)}, cada 3–5 min.`);
    const antiTxt = () => {
      if (ped) return P() > 0 ? `Amiodarona ${D.amio(Math.min(5 * P(), S.nAmio ? 150 : 300))} (5 mg/kg; hasta 3 dosis, máx. 300 mg la primera y 150 mg las siguientes) <b>o</b> lidocaína ${D.lido(1 * P())} (1 mg/kg).` : 'Amiodarona 5 mg/kg (máx. 300 mg) o lidocaína 1 mg/kg. ' + faltaPeso;
      const am = S.nAmio ? 150 : 300;
      const lr = (a, b) => `${f(a, 2).replace(/,?0+$/, '')}–${f(b, 2)} mg/kg = ${f(a * P(), 0)}–${f(b * P(), 0)} mg (${f((a * P()) / pres('lido'), 1)}–${f((b * P()) / pres('lido'), 1)} mL de lidocaína ${pres('lido') === 10 ? '1 %' : '2 %'})`;
      return `Amiodarona ${S.nAmio ? '2.ª dosis' : '1.ª dosis'}: ${D.amio(am)} <b>o</b> lidocaína ${P() > 0 ? (S.nLido ? lr(0.5, 0.75) : lr(1, 1.5)) : '1–1,5 mg/kg (luego 0,5–0,75). ' + faltaPeso}.`;
    };
    const embItems = () => (emb ? [
      '<b>Desplazamiento manual del útero a la izquierda</b> continuo si el fondo uterino está a la altura del ombligo o por encima.',
      '<b>Prepara la cesárea perimortem</b> (histerotomía): objetivo nacimiento a los 5 min del paro si no hay RCE.',
      'Vía aérea temprana por el más experto (vía aérea difícil frecuente). Vía IV por encima del diafragma.',
      'Si recibía sulfato de magnesio: suspéndelo y da calcio (gluconato de calcio 10 %).',
      'Retira los monitores fetales. Si sospechas embolia de líquido amniótico: activa la transfusión masiva.',
      'Causas A–H: Anestesia (complicaciones), Bleeding (sangrado), Cardiovascular, Drogas, Embolia (amniótica o pulmonar), Fiebre, Generales (H y T), Hipertensión (preeclampsia).',
    ] : []);
    const rcpBase = ped ? RCP_PED : RCP_ADULTO;
    const causas = ped ? HT.slice(0, 4).concat(['Hipoglucemia'], HT.slice(4)) : HT;
    const energia = (n) => (ped ? energiaPed(n) : energiaAdulto());
    return {
      titulo: emb ? 'Paro cardíaco en la embarazada' : ped ? 'Paro cardíaco pediátrico (PALS)' : 'Paro cardíaco del adulto',
      sub: emb ? 'AHA 2025 · desplazamiento uterino y cesárea perimortem a los 5 min' : ped ? 'AHA/AAP 2025 · dosis por peso' : 'AHA 2025 · FV/TVSP y asistolia/AESP',
      fuente: emb ? 'AHA 2025: Cardiac Arrest in Pregnancy Algorithm y Adult Cardiac Arrest Algorithm.' : ped ? 'AHA/AAP 2025: Pediatric Cardiac Arrest Algorithm.' : 'AHA 2025: Adult Cardiac Arrest Algorithm y Adult Post–Cardiac Arrest Care Algorithm.',
      url: OFICIAL_AHA, rcp: true, ped, emb, pideEdad: ped,
      rapidos: ['desc', 'adr', 'amio', 'lido', 'via', 'ciclo', 'rce', ...(emb ? ['cesarea'] : []), 'nota'],
      ref: [
        { t: 'RCP de alta calidad', items: rcpBase },
        { t: 'Energía de desfibrilación', items: ped ? ['Primera 2 J/kg, segunda 4 J/kg, siguientes ≥4 J/kg (máx. 10 J/kg o la dosis de adulto).'] : ['Bifásico: la recomendada por el fabricante (p. ej. 120–200 J); si no se sabe, la máxima. Las siguientes iguales o mayores.', 'Monofásico: 360 J.'] },
        { t: 'Causas reversibles (H y T)', items: causas },
        { t: 'En quirófano, piensa también en', items: QX, nota: 'Lista práctica de causas perioperatorias (no forma parte del algoritmo AHA).' },
        ...(emb ? [{ t: 'Embarazo: optimiza la reanimación', items: embItems() }] : []),
      ],
      inicio: 'inicio',
      pasos: {
        inicio: { t: 'Inicia la RCP', items: () => [
          ...(emb ? [embItems()[0], 'Activa el equipo de paro obstétrico (anestesia, obstetricia, neonatología, enfermería).'] : []),
          'Comienza compresiones de alta calidad; ventila con bolsa-mascarilla y oxígeno.', 'Conecta el monitor/desfibrilador.',
          'En quirófano: FiO₂ 100 %, suspende halogenados e infusiones anestésicas o vasodilatadoras, avisa al cirujano y pide el carro de paro.'],
          bot: [{ t: '▶ RCP iniciada — arrancar el reloj', ir: 'ritmo', ev: 'Inicio de RCP', ciclo: true, cls: 'primario' }] },
        ritmo: { t: 'Análisis del ritmo (pausa < 10 s)', items: () => ['¿Ritmo desfibrilable?', ...(S.rce ? [] : ['Si hay un ritmo organizado, palpa el pulso.'])],
          bot: [{ t: '⚡ FV / TV sin pulso', ir: 'desf', ev: 'Ritmo: FV/TV sin pulso', cls: 'peligro' }, { t: 'Asistolia / AESP', ir: 'nodesf', ev: 'Ritmo: asistolia/AESP', cls: 'secundario' }, { t: '✔ Pulso presente (RCE)', ir: 'rce', ev: 'RCE: retorno de la circulación espontánea', cls: 'ok' }] },
        desf: { t: () => `Descarga ${S.nDesc + 1}`, items: () => [energia(S.nDesc + 1), 'Todos fuera; oxígeno retirado del tórax. Descarga y <b>reanuda las compresiones de inmediato</b> por 2 min, sin revisar el pulso.'],
          bot: [{ t: '⚡ Descarga dada — RCP 2 min', ir: 'cicloDesf', rapido: 'desc', cls: 'peligro' }] },
        cicloDesf: { t: 'RCP 2 min (ritmo desfibrilable)', items: () => {
          const n = S.nDesc, l = [];
          if (n <= 1) l.push('Acceso IV/IO.');
          if (n >= 2) l.push((S.adrUlt ? 'Continúa: ' : '<b>Ahora:</b> ') + adrTxt());
          if (n >= 2) l.push('Considera vía aérea avanzada y capnografía.');
          if (n >= 3) l.push('<b>Antiarrítmico:</b> ' + antiTxt());
          if (n >= 3) l.push('Trata las causas reversibles.');
          l.push('Al terminar el ciclo: revisa el ritmo.');
          return l; },
          bot: [{ t: '↻ Fin del ciclo — revisar ritmo', ir: 'ritmo', cls: 'primario' }] },
        nodesf: { t: 'Asistolia / AESP', items: () => [
          (S.adrUlt ? 'Continúa: ' : '<b>Lo antes posible:</b> ') + adrTxt(),
          'RCP 2 min. Acceso IV/IO si aún no hay.', 'Considera vía aérea avanzada y capnografía.', 'Busca y trata las causas reversibles (H y T).',
          ...(ped ? [] : ['Considera si corresponde continuar la reanimación.']), 'Al terminar el ciclo: revisa el ritmo.'],
          bot: [{ t: '↻ Fin del ciclo — revisar ritmo', ir: 'ritmo', cls: 'primario' }] },
        rce: { t: 'Cuidados posparo (RCE)', items: () => ped ? [
          'Vía aérea y ventilación: oxigenación normal (SpO₂ 94–99 %) y normocapnia; evita la hipotensión.', 'ECG, gases, glucemia, electrolitos; trata la causa.', 'Control de temperatura: evita la fiebre.', 'Traslado a UCI pediátrica.'] : [
          '<b>Vía aérea:</b> coloca o cambia a vía aérea avanzada si hace falta; confirma con capnografía.',
          '<b>Oxigenación y ventilación:</b> FiO₂ 100 % hasta poder medir la SpO₂; luego SpO₂ 90–98 % (PaO₂ 60–105 mmHg) y PaCO₂ 35–45 mmHg.',
          '<b>Hemodinamia:</b> PAM ≥65 mmHg con vasopresores y/o volumen.',
          '<b>Estudios:</b> ECG de 12 derivaciones; considera TC y ecografía para buscar la causa.',
          'Coronariografía urgente si hay elevación del ST persistente, shock cardiogénico, arritmias ventriculares recurrentes o isquemia grave.',
          '<b>¿Obedece órdenes?</b> Si no (sin sedación ni relajante): estrategia deliberada de control de temperatura 32–37,5 °C, EEG y pronóstico multimodal diferido (≥72 h).',
          'Glucemia entre 70 y 180 mg/dL. Considera antibióticos.'],
          bot: [{ t: '✖ Vuelve a perder el pulso', ir: 'ritmo', ev: 'Pérdida del pulso', ciclo: true, cls: 'peligro' }] },
      },
    };
  }

  const ALG = {
    pcr: pcr({}),
    'pcr-emb': pcr({ emb: true }),
    pals: pcr({ ped: true }),
    bradi: {
      titulo: 'Bradicardia con pulso (adulto)', sub: 'AHA 2025 · FC habitualmente < 50/min', fuente: 'AHA 2025: Adult Bradycardia With a Pulse Algorithm.', url: OFICIAL_AHA,
      rapidos: ['atro', 'mp', 'infDopa', 'infAdr', 'nota'],
      ref: [{ t: 'Causas posibles', items: ['Isquemia o infarto de miocardio', 'Fármacos o tóxicos: calcioantagonistas, betabloqueantes, digoxina', 'Hipoxia', 'Electrolitos (p. ej., hiperpotasemia)'] },
        { t: 'En quirófano', items: ['Reflejo vagal: tracción peritoneal u ocular, laringoscopia, neumoperitoneo → detén el estímulo.', 'Bloqueo neuroaxial alto.', 'Opioides, dexmedetomidina, neostigmina, succinilcolina (dosis repetidas).', 'Hipoxia en curso.'], nota: 'Lista práctica (no forma parte del algoritmo AHA).' }],
      inicio: 'b0',
      pasos: {
        b0: { t: 'Evalúa y da soporte', items: ['¿La FC es inadecuada para la situación clínica? (habitualmente < 50/min)', 'Vía aérea permeable, oxígeno y ventilación con presión positiva si hace falta.', 'Monitor, presión arterial, oximetría, acceso IV, ECG de 12 derivaciones.', '<b>¿Compromiso cardiopulmonar?</b> Hipotensión, alteración aguda de la conciencia, signos de shock, dolor torácico isquémico o insuficiencia cardíaca aguda.'],
          bot: [{ t: 'Sí, hay compromiso', ir: 'b1', ev: 'Bradicardia con compromiso', cls: 'peligro' }, { t: 'No', ir: 'bObs', ev: 'Bradicardia sin compromiso', cls: 'secundario' }] },
        bObs: { t: 'Sin compromiso: observa', items: ['Identifica y trata la causa; sostén el ABC; considera oxígeno; ECG de 12 derivaciones.', 'Vigila: si aparece compromiso, vuelve atrás.'], bot: [{ t: 'Aparece compromiso', ir: 'b1', ev: 'Aparece compromiso', cls: 'peligro' }] },
        b1: { t: 'Atropina', items: () => [`Atropina ${D.atro(1)} en bolo. Repite cada 3–5 min, <b>máximo 3 mg</b> en total.`, `Dada hasta ahora: ${f(S.atroMg || 0, 1)} mg.`, '<b>¿Persiste la bradicardia con compromiso?</b>'],
          bot: [{ t: 'Sí, persiste', ir: 'b2', ev: 'Persiste tras atropina', cls: 'peligro' }, { t: 'No, mejoró', ir: 'bObs', ev: 'Mejora con atropina', cls: 'ok' }] },
        b2: { t: 'Atropina ineficaz', items: ['<b>Marcapaso transcutáneo</b> y/o infusión de:', 'Dopamina 5–20 mcg/kg/min; titula según la respuesta y retírala lentamente.', 'Adrenalina 2–10 mcg/min; titula según la respuesta.', 'Considera consulta con el experto y marcapaso transvenoso.', 'Usa los botones de abajo para abrir la calculadora con el fármaco.'],
          bot: [{ t: '✖ Pierde el pulso → paro', algo: 'pcr', ev: 'Pierde el pulso', cls: 'peligro' }] },
      },
    },
    taqui: {
      titulo: 'Taquicardia con pulso (adulto)', sub: 'AHA 2025 · FC habitualmente ≥ 150/min', fuente: 'AHA 2025: Adult Tachyarrhythmia With a Pulse Algorithm y Electrical Cardioversion Algorithm.', url: OFICIAL_AHA,
      rapidos: ['cv', 'adeno', 'amio', 'nota'],
      ref: [{ t: 'Cardioversión sincronizada (energía inicial)', items: ['Fibrilación auricular: 200 J', 'Flutter auricular: 200 J', 'Taquicardia de QRS estrecho: 100 J', 'TV monomórfica: 100 J', 'TV polimórfica: descarga NO sincronizada de alta energía (desfibrilación)', 'Usa la energía que recomienda tu equipo; si no se sabe, la máxima. Puede hacer falta resincronizar tras cada descarga.'] },
        { t: 'Antiarrítmicos (QRS ancho estable)', items: ['Procainamida 20–50 mg/min hasta que cede, aparece hipotensión, el QRS se ensancha >50 % o se llega a 17 mg/kg; mantenimiento 1–4 mg/min. Evitar con QT largo o insuficiencia cardíaca.', 'Amiodarona 150 mg en 10 min (repetir si recurre); luego 1 mg/min por 6 h.'] }],
      inicio: 't0',
      pasos: {
        t0: { t: 'Evalúa y da soporte', items: ['¿La FC es inadecuada para la situación clínica? (habitualmente ≥150/min)', 'Vía aérea; oxígeno si hay hipoxemia; monitor, PA, oximetría; acceso IV; ECG de 12 derivaciones.', '<b>¿La taquiarritmia causa</b> hipotensión, alteración aguda de la conciencia, signos de shock, dolor torácico isquémico o insuficiencia cardíaca aguda?'],
          bot: [{ t: 'Sí: inestable', ir: 'tCV', ev: 'Taquicardia inestable', cls: 'peligro' }, { t: 'No: estable', ir: 'tQRS', ev: 'Taquicardia estable', cls: 'secundario' }] },
        tCV: { t: 'Cardioversión sincronizada', items: () => ['Seda siempre que sea posible (sin retrasar la cardioversión si está muy inestable). Ten a mano aspiración, O₂, vía IV y material de intubación.', 'Si es de QRS estrecho y regular, considera adenosina mientras preparas: ' + D.adeno(6) + '.', 'Energía inicial: FA 200 J · flutter 200 J · QRS estrecho 100 J · TV monomórfica 100 J · TV polimórfica: desfibrilación.', 'Si es refractaria: busca la causa, sube la energía, agrega un antiarrítmico, consulta al experto.'],
          bot: [{ t: '⚡ Cardioversión dada', rapido: 'cv', cls: 'peligro' }, { t: '✖ Pierde el pulso → paro', algo: 'pcr', ev: 'Pierde el pulso', cls: 'peligro' }] },
        tQRS: { t: '¿QRS ancho (≥ 0,12 s)?', items: ['Mide el QRS en el ECG.'], bot: [{ t: 'Estrecho (< 0,12 s)', ir: 'tEst', ev: 'QRS estrecho', cls: 'secundario' }, { t: 'Ancho (≥ 0,12 s)', ir: 'tAnc', ev: 'QRS ancho', cls: 'secundario' }] },
        tEst: { t: 'QRS estrecho, estable', items: () => ['Maniobras vagales (si es regular).', `Adenosina (si es regular): 1.ª ${D.adeno(6)}; 2.ª ${D.adeno(12)} si hace falta.`, 'Betabloqueante o calcioantagonista.', 'Considera consulta con el experto.'],
          bot: [{ t: 'Se vuelve inestable', ir: 'tCV', ev: 'Se vuelve inestable', cls: 'peligro' }] },
        tAnc: { t: 'QRS ancho, estable', items: () => ['Adenosina <b>solo</b> si es regular y monomórfica: ' + D.adeno(6) + '.', 'Infusión de antiarrítmico: procainamida 20–50 mg/min (máx. 17 mg/kg) o amiodarona ' + D.amio(150) + ' en 10 min, luego 1 mg/min por 6 h.', 'Consulta con el experto.'],
          bot: [{ t: 'Se vuelve inestable', ir: 'tCV', ev: 'Se vuelve inestable', cls: 'peligro' }] },
      },
    },
    'bradi-ped': {
      titulo: 'Bradicardia con pulso (pediátrica)', sub: 'AHA/AAP 2025', fuente: 'AHA/AAP 2025: Pediatric Bradycardia With a Pulse Algorithm.', url: OFICIAL_AHA, pideEdad: true,
      rapidos: ['adrPed', 'atroPed', 'nota'],
      ref: [{ t: 'Causas posibles', items: ['Hipotermia', 'Hipoxia', 'Tóxicos o medicamentos', 'Hipertensión intracraneal', 'Aumento del tono vagal', 'Bloqueo cardíaco', 'Fisiológica o adecuada'] }],
      inicio: 'p0',
      pasos: {
        p0: { t: 'Evalúa y da soporte', items: ['Vía aérea permeable, oxígeno, ventilación con presión positiva si hace falta; monitor; pulso.', '<b>¿Compromiso cardiopulmonar?</b> Alteración aguda de la conciencia, signos de shock o hipotensión.'],
          bot: [{ t: 'Sí', ir: 'p1', ev: 'Bradicardia con compromiso', cls: 'peligro' }, { t: 'No', ir: 'pObs', ev: 'Sin compromiso', cls: 'secundario' }] },
        pObs: { t: 'Sin compromiso', items: ['Identifica y trata la causa; sostén el ABC; considera oxígeno y ECG de 12 derivaciones; observa.'], bot: [{ t: 'Aparece compromiso', ir: 'p1', cls: 'peligro' }] },
        p1: { t: '¿Persiste con compromiso pese a oxigenar y ventilar?', items: ['Si la FC es < 60/min con mala perfusión pese a oxigenación y ventilación: <b>inicia RCP</b>.'],
          bot: [{ t: 'Sí: FC < 60 con mala perfusión', ir: 'p2', ev: 'FC < 60: inicia RCP', ciclo: true, cls: 'peligro' }, { t: 'No', ir: 'pObs', cls: 'secundario' }] },
        p2: { t: 'RCP + fármacos', items: () => ['Acceso IV/IO.', P() > 0 ? `Adrenalina ${D.adrDil(Math.min(0.01 * P(), 1))} (0,01 mg/kg, máx. 1 mg), cada 3–5 min.` : 'Adrenalina 0,01 mg/kg (máx. 1 mg). ' + faltaPeso,
          P() > 0 ? `Atropina (si hay tono vagal aumentado o bloqueo AV primario): ${D.atro(Math.min(0.5, Math.max(0.1, 0.02 * P())))} (0,02 mg/kg; mín. 0,1 mg, máx. 0,5 mg por dosis); puede repetirse una vez.` : 'Atropina 0,02 mg/kg (mín. 0,1 mg, máx. 0,5 mg). ' + faltaPeso,
          'Identifica y trata la causa; considera marcapaso transtorácico o transvenoso.', 'Revisa el pulso cada 2 min.'],
          bot: [{ t: '✖ Sin pulso → paro pediátrico', algo: 'pals', ev: 'Sin pulso', cls: 'peligro' }] },
      },
    },
    'taqui-ped': {
      titulo: 'Taquicardia con pulso (pediátrica)', sub: 'AHA/AAP 2025', fuente: 'AHA/AAP 2025: Pediatric Tachyarrhythmia With a Pulse Algorithm.', url: OFICIAL_AHA, pideEdad: true,
      rapidos: ['adenoPed', 'cv', 'nota'],
      ref: [{ t: 'Sinusal probable vs. TSV probable', items: ['Sinusal: ondas P presentes y normales, RR variable; lactante < 220/min, niño < 180/min.', 'TSV: P ausentes o anormales, RR fijo; lactante ≥ 220/min, niño ≥ 180/min; inicio brusco.'] }],
      inicio: 'q0',
      pasos: {
        q0: { t: 'Evalúa y da soporte', items: ['Vía aérea; ventilación con presión positiva y O₂ si hace falta; monitor; acceso IV/IO; ECG de 12 derivaciones.', '<b>¿Compromiso cardiopulmonar?</b> Alteración aguda de la conciencia, signos de shock o hipotensión.'],
          bot: [{ t: 'Sí', ir: 'q1', ev: 'Taquicardia con compromiso', cls: 'peligro' }, { t: 'No', ir: 'q2', ev: 'Taquicardia sin compromiso', cls: 'secundario' }] },
        q1: { t: 'Con compromiso', items: () => ['<b>QRS estrecho (≤ 0,09 s), TSV probable:</b> adenosina si ya hay acceso IV/IO, <b>o</b> cardioversión sincronizada.', '<b>QRS ancho (> 0,09 s), posible TV:</b> cardioversión sincronizada; consulta al experto antes de más fármacos.', adenoPedTxt(), cvPedTxt()],
          bot: [{ t: '⚡ Cardioversión dada', rapido: 'cv', cls: 'peligro' }] },
        q2: { t: 'Sin compromiso', items: () => ['<b>QRS estrecho:</b> considera maniobras vagales y da adenosina IV/IO.', '<b>QRS ancho:</b> si es regular y monomórfico, considera adenosina; consulta al experto.', adenoPedTxt(), 'Busca y trata la causa.'],
          bot: [{ t: 'Aparece compromiso', ir: 'q1', cls: 'peligro' }] },
      },
    },
    neonatal: {
      titulo: 'Reanimación neonatal', sub: 'AHA/AAP 2025 · reloj desde el nacimiento', fuente: 'AHA/AAP 2025: Neonatal Resuscitation Algorithm. Dosis de adrenalina y volumen: Programa de Reanimación Neonatal (AHA/AAP 2020).', url: OFICIAL_AHA, reloj: 'nac', pideEdad: false,
      rapidos: ['vpp', 'compr', 'adrNeo', 'vol', 'nota'],
      ref: [{ t: 'SpO₂ preductal objetivo', tabla: [['1 min', '60–65 %'], ['2 min', '65–70 %'], ['3 min', '70–75 %'], ['4 min', '75–80 %'], ['5 min', '80–85 %'], ['10 min', '85–95 %']], nota: 'El algoritmo 2025 muestra de 2 a 10 min; el valor de 1 min viene de la tabla clásica del NRP.' },
        { t: 'Antes del nacimiento', items: ['Consejería prenatal, briefing del equipo y revisión del equipo.', 'Plan de manejo del cordón.'] }],
      inicio: 'n0',
      pasos: {
        n0: { t: 'Nacimiento', items: ['¿Término? ¿Buen tono? ¿Respira o llora?'], bot: [{ t: 'Sí a todo', ir: 'nRut', ev: 'Nacimiento: vigoroso', nac: true, cls: 'ok' }, { t: 'No', ir: 'n1', ev: 'Nacimiento: requiere pasos iniciales', nac: true, cls: 'peligro' }] },
        nRut: { t: 'Cuidados de rutina', items: ['Piel con piel con la madre; mantener la temperatura normal; evaluación continua.'], bot: [{ t: 'Se deteriora', ir: 'n1', cls: 'peligro' }] },
        n1: { t: 'Pasos iniciales (1.er minuto)', items: ['Calentar y mantener la temperatura; secar; posicionar; estimular; despejar la vía aérea si hace falta.', '<b>¿Apnea o boqueo? ¿FC < 100/min?</b>'],
          bot: [{ t: 'Sí', ir: 'n2', ev: 'Apnea/boqueo o FC < 100', cls: 'peligro' }, { t: 'No', ir: 'nResp', cls: 'secundario' }] },
        nResp: { t: '¿Dificultad respiratoria o cianosis persistente?', items: ['Si sí: oxímetro de pulso, oxígeno si hace falta, considera CPAP.', 'Si no: cuidados posreanimación / rutina.'], bot: [{ t: 'Aparece apnea o FC < 100', ir: 'n2', cls: 'peligro' }] },
        n2: { t: 'Ventilación con presión positiva', items: ['VPP; oxímetro de pulso; considera monitor cardíaco.', '<b>¿FC < 100/min?</b>'],
          bot: [{ t: 'Sí', ir: 'n3', ev: 'FC < 100 con VPP', cls: 'peligro' }, { t: 'No, mejora', ir: 'nPost', ev: 'Mejora con VPP', cls: 'ok' }] },
        n3: { t: 'Pasos correctivos de la ventilación', items: ['Revisa la ventilación: mascarilla, posición, aspiración, boca abierta, presión, vía aérea alternativa.', 'Considera intubación o máscara laríngea; monitor cardíaco.', '<b>¿FC < 60/min?</b>'],
          bot: [{ t: 'Sí', ir: 'n4', ev: 'FC < 60: compresiones', cls: 'peligro' }, { t: 'No', ir: 'n2', cls: 'secundario' }] },
        n4: { t: 'Compresiones', items: ['Intuba o coloca máscara laríngea.', 'Compresiones coordinadas 3:1 con la ventilación; O₂ al 100 %.', 'Catéter venoso umbilical o intraóseo.', '<b>¿FC < 60/min?</b>'],
          bot: [{ t: 'Sí, sigue < 60', ir: 'n5', ev: 'FC sigue < 60', cls: 'peligro' }, { t: 'No, ≥ 60', ir: 'n3', ev: 'FC ≥ 60', cls: 'ok' }] },
        n5: { t: 'Adrenalina', items: () => [P() > 0 ? `Adrenalina IV/IO (umbilical): ${f(0.01 * P(), 3)}–${f(0.03 * P(), 3)} mg = <b>${f(0.1 * P(), 2)}–${f(0.3 * P(), 2)} mL</b> de la dilución 0,1 mg/mL (0,01–0,03 mg/kg), cada 3–5 min.` : 'Adrenalina IV/IO 0,01–0,03 mg/kg (0,1–0,3 mL/kg de la dilución 0,1 mg/mL) cada 3–5 min. Escribe el peso.',
          P() > 0 ? `Endotraqueal mientras se obtiene acceso: ${f(0.05 * P(), 3)}–${f(0.1 * P(), 2)} mg = ${f(0.5 * P(), 1)}–${f(1 * P(), 1)} mL de la dilución 0,1 mg/mL (0,05–0,1 mg/kg).` : 'Endotraqueal 0,05–0,1 mg/kg mientras se obtiene acceso.',
          'Si la FC sigue < 60/min: considera <b>hipovolemia</b> (' + (P() > 0 ? `expansor 10 mL/kg = ${f(10 * P(), 0)} mL de SF en 5–10 min` : 'expansor 10 mL/kg de SF') + ') y <b>neumotórax</b>.'],
          bot: [{ t: 'FC ≥ 60', ir: 'n3', ev: 'FC ≥ 60', cls: 'ok' }] },
        nPost: { t: 'Cuidados posreanimación', items: ['Cuidados posreanimación; comunicación con la familia; debriefing del equipo.'], bot: [] },
      },
    },
    anafilaxia: {
      titulo: 'Anafilaxia perioperatoria', sub: 'SFAR/SFA 2025 · ANZAAG/ANZCA 2022 · por grado', fuente: 'SFAR/SFA 2025 (J Allergy Hypersensitivity Dis 2026;10:100068, fig. 5) y ANZAAG/ANZCA 2022 (Anaesth Intensive Care 2024;52:147).', url: 'https://doi.org/10.1016/j.jahd.2026.100068', pideEdad: true,
      rapidos: ['adrIV', 'adrIM', 'bolo', 'infAdr', 'triptasa', 'nota'],
      ref: [{ t: 'Grados (SFAR)', items: ['I: solo signos cutáneos difusos.', 'II: cambios moderados de PA, FC o SpO₂.', 'III: cambios intensos de PA, FC o SpO₂; EtCO₂ bajo.', 'IV: paro circulatorio.'] },
        { t: 'Broncoespasmo', items: ['La adrenalina es el primer tratamiento del broncoespasmo en la anafilaxia.', 'Si persiste: broncodilatador inhalado o IV, magnesio IV lento (puede dar hipotensión), halogenados, ketamina (ANZAAG).', 'Broncoespasmo refractario: descarta intubación esofágica (capnografía plana).'] },
        { t: 'Refractaria (según disponibilidad)', items: ['Ecocardiografía (TTE/TEE) o monitoreo invasivo para optimizar el volumen y ver la función miocárdica.', 'Otros vasopresores: noradrenalina, azul de metileno, vasopresina (SFAR); metaraminol o fenilefrina donde falten alternativas (ANZAAG).', 'Soporte vital extracorpóreo (ECMO).', 'Suspende otros desencadenantes posibles: coloides, clorhexidina, colorantes.'] }],
      inicio: 'a0',
      pasos: {
        a0: { t: 'Reflejos inmediatos', items: ['Pide ayuda y asigna roles (líder, lector de la tarjeta, quien prepara la adrenalina).', 'Retira el alérgeno sospechado (antibiótico, relajante, clorhexidina, coloide, látex).', 'Monitoreo completo: FC, ECG, PA, SpO₂, EtCO₂. FiO₂ 100 %.', 'Embarazada: desplazamiento manual del útero a la izquierda.', '<b>¿Qué grado?</b>'],
          bot: [{ t: 'I: solo piel', ir: 'aI', ev: 'Grado I', cls: 'secundario' }, { t: 'II: moderada', ir: 'aII', ev: 'Grado II', cls: 'primario' }, { t: 'III: grave', ir: 'aIII', ev: 'Grado III', cls: 'peligro' }, { t: 'IV: paro', ir: 'aIV', ev: 'Grado IV: paro', ciclo: true, cls: 'peligro' }] },
        aI: { t: 'Grado I', items: ['Sin tratamiento específico (SFAR); continuar la cirugía.', 'Vigila la progresión; recuperación habitual.'], bot: [{ t: 'Empeora → grado II', ir: 'aII', ev: 'Progresa a grado II', cls: 'primario' }, { t: 'Estable → después', ir: 'aPost', cls: 'secundario' }] },
        aII: { t: 'Grado II', items: () => [
          `<b>Adrenalina IV:</b> ${adultoAna() ? D.adrMcg(10) + ' a ' + D.adrMcg(20) : P() > 0 ? D.adrMcg(Math.min(10, P())) + ' (1 mcg/kg, máx. 10 mcg)' : '1 mcg/kg (máx. 10 mcg). ' + faltaPeso}, cada 2 min.`,
          ...(adultoAna() ? ['Si no responde, ANZAAG sugiere subir a 50 mcg.'] : []),
          `<b>Cristaloides:</b> 10 mL/kg en 30 min${P() > 0 ? ' = ' + f(10 * P(), 0) + ' mL' : ''}.`,
          `Sin vía IV o sin monitoreo: <b>adrenalina IM</b> en la cara anterolateral del muslo, 10 mcg/kg (máx. 500 mcg)${P() > 0 ? ' = ' + f(Math.min(10 * P(), 500), 0) + ' mcg = ' + f(Math.min(10 * P(), 500) / 1000, 2) + ' mL de la ampolla de 1 mg/mL' : ''}; repetir una vez si no hay efecto.`,
          'Puede continuarse la cirugía. Recuperación prolongada o UCI.'],
          bot: [{ t: 'Empeora → grado III', ir: 'aIII', ev: 'Progresa a grado III', cls: 'peligro' }, { t: 'Estable → después', ir: 'aPost', ev: 'Estabilizado', cls: 'ok' }] },
        aIII: { t: 'Grado III', items: () => [
          `<b>Adrenalina IV:</b> ${adultoAna() ? D.adrMcg(100) + ' a ' + D.adrMcg(200) : P() > 0 ? D.adrMcg(P()) + ' (1 mcg/kg; hasta 5–10 mcg/kg según respuesta)' : '1 mcg/kg (hasta 5–10 mcg/kg). ' + faltaPeso}, cada 2 min. Bolos dados: ${S.nAdr || 0}.`,
          (S.nAdr || 0) >= 3 ? '<b>Ya van 3 bolos: inicia la infusión de adrenalina</b> 0,05–0,1 mcg/kg/min y ajusta.' : 'Si persiste la inestabilidad tras 3 bolos: <b>infusión</b> 0,05–0,1 mcg/kg/min.',
          `<b>Cristaloides:</b> 20 mL/kg en 30 min${P() > 0 ? ' = ' + f(20 * P(), 0) + ' mL' : ''}; coloides como segunda línea si persiste la hipovolemia (SFAR).${adultoAna() ? ' ANZAAG: 1000 mL de entrada en el adulto.' : ''}`,
          'Anestesiado con PAS < 50 mmHg: inicia compresiones (ANZAAG).',
          'Cirugía: continuar según la estabilización, o diferir. UCI.'],
          bot: [{ t: 'PAS < 50 o paro → grado IV', ir: 'aIV', ev: 'Progresa a grado IV', ciclo: true, cls: 'peligro' }, { t: 'Estable → después', ir: 'aPost', ev: 'Estabilizado', cls: 'ok' }] },
        aIV: { t: 'Grado IV: paro', items: () => ['RCP y algoritmo de paro.', adultoAna() ? `Adrenalina ${D.adr(1)} cada 3–5 min.` : P() > 0 ? `Adrenalina 10 mcg/kg = ${D.adrDil(0.01 * P())} cada 3–5 min.` : 'Niños: adrenalina 10 mcg/kg cada 3–5 min. ' + faltaPeso,
          `Volumen rápido: 20 mL/kg${P() > 0 ? ' = ' + f(20 * P(), 0) + ' mL' : ''}${adultoAna() ? ' (ANZAAG: 2000 mL de entrada en el adulto)' : ''}.`, 'Considera ECMO. Posponer la cirugía salvo indicación vital.'],
          bot: [{ t: 'Abrir el algoritmo de paro', algo: () => (adultoAna() ? 'pcr' : 'pals'), cls: 'peligro' }, { t: 'RCE → después', ir: 'aPost', ev: 'RCE', cls: 'ok' }] },
        aPost: { t: 'Después de la crisis', items: ['<b>Triptasa:</b> entre 30 min y 2 h del inicio y una basal > 24 h después (SFAR); ANZAAG: lo antes posible, a la 1 h, a las 4 h y > 24 h.', 'Corticoide cuando esté estable (reacciones prolongadas o bifásicas); antihistamínico no sedante después.', 'Grado II: recuperación prolongada o UCI; grados III–IV: UCI.', 'Consulta de alergia a las 4 semanas (pruebas cutáneas desde el día 4 solo valen si son positivas).', 'Informa al paciente por escrito: fármacos sospechados y todo lo que recibió.'], bot: [] },
      },
    },
    hm: {
      titulo: 'Hipertermia maligna', sub: 'JSA 2025 · EMHG 2020', fuente: 'JSA 2025 (J Anesth, doi 10.1007/s00540-025-03647-y) y EMHG (Glahn, Br J Anaesth 2020).', url: 'https://doi.org/10.1007/s00540-025-03647-y',
      rapidos: ['dantro', 'enfriar', 'nota'],
      ref: [{ t: 'Signos', items: ['Precoces: EtCO₂ > 55 mmHg que no baja pese a subir la ventilación, taquicardia inexplicada, rigidez (masetero).', 'Luego: T° que sube ≥ 0,5 °C en 15 min o ≥ 38,8 °C, acidosis (BE ≤ −8), K⁺ alto, orina color cola, arritmias.'] },
        { t: 'Laboratorio', items: ['Gases arteriales, glucemia, electrolitos, lactato, CK, mioglobina en sangre y orina, función renal y hepática, coagulación (CID).'] }],
      inicio: 'h0',
      pasos: {
        h0: { t: 'Declara la crisis', items: ['<b>Suspende halogenados y succinilcolina.</b> Pide ayuda y el dantroleno; que el cirujano termine lo antes posible.', 'O₂ al 100 % a ≥ 10 L/min e hiperventila (≥ 2 veces el volumen minuto). Pasa a TIVA. Filtros de carbón activado si los hay.'],
          bot: [{ t: 'Siguiente: dantroleno', ir: 'h1', ev: 'Crisis de HM declarada', cls: 'peligro' }] },
        h1: { t: 'Dantroleno', items: () => [
          P() > 0 ? `Dosis inicial 2 mg/kg = <b>${f(2 * P(), 0)} mg = ${Math.ceil((2 * P()) / 20)} frascos</b> de 20 mg, cada uno en 60 mL de agua destilada (EMHG: 2–2,5 mg/kg). Por vía venosa gruesa exclusiva, en ~10 min.` : 'Dosis inicial 2 mg/kg (EMHG 2–2,5 mg/kg); frascos de 20 mg en 60 mL de agua destilada. ' + faltaPeso,
          'Repite cada 10 min hasta que bajen el EtCO₂ y la T° y ceda la rigidez; se aceptan > 10 mg/kg si sigue siendo eficaz.',
          `Dado: ${f(S.dantroMg || 0, 0)} mg${P() > 0 ? ' (' + f((S.dantroMg || 0) / P(), 1) + ' mg/kg)' : ''}.`,
          '<b>Si no hay dantroleno en el hospital:</b> pídelo de inmediato a un centro que lo tenga (ten el contacto anotado de antemano) y, mientras llega, soporte máximo: enfriamiento agresivo, hiperventilación, corrección de la hiperpotasemia y la acidosis, y tratamiento de las arritmias.'],
          bot: [{ t: 'Siguiente: soporte', ir: 'h2', cls: 'primario' }] },
        h2: { t: 'Soporte', items: ['<b>Enfriar:</b> SF frío IV (máx. 50–60 mL/kg), bajar la temperatura de la sala, ventilar la piel; suspender el enfriamiento con T° central < 38 °C.', '<b>Hiperpotasemia:</b> glucosa-insulina, gluconato de calcio, bicarbonato; diuresis ≥ 1 mL/kg/h (furosemida).', '<b>Arritmias:</b> amiodarona o betabloqueante. <b>Nunca calcioantagonistas</b> con dantroleno.', 'Laboratorio seriado. UCI ≥ 24 h: recrudescencia en ~20 %, en promedio a las 13 h.'], bot: [] },
      },
    },
    last: {
      titulo: 'Toxicidad por anestésicos locales (LAST)', sub: 'ASRA 2020 · emulsión lipídica 20 %', fuente: 'ASRA Local Anesthetic Systemic Toxicity Checklist 2020 v1.1; NYSORA; Shalaby, Clin Exp Emerg Med 2024;11:121.', url: 'https://www.asra.com/news-publications/asra-updates/blog-landing/legacy-b-blog-posts/2020/11/01/checklist-for-treatment-of-local-anesthetic-systemic-toxicity-(last)', pideEdad: false,
      rapidos: ['lipBolo', 'lipInf', 'benzo', 'adrLast', 'nota'],
      ref: [{ t: 'Escalera de signos (a más concentración, más grave)', escalera: ['Adormecimiento de la lengua y la boca', 'Alteraciones sensoriales y de la conducta (acúfenos, sabor metálico, agitación)', 'Contracciones musculares', 'Inconsciencia', 'Convulsiones generalizadas', 'Falla respiratoria', 'Toxicidad cardiovascular (arritmias, hipotensión)', 'Paro cardíaco'], nota: 'Hasta la mitad de los casos son atípicos (solo cardiovasculares o síntomas leves) y pueden aparecer > 5 min y hasta 1 h después de la inyección.' },
        { t: 'Si no hay Intralipid 20 %', si: 'sinLipido', items: ['Intralipid es la emulsión más estudiada. Otras emulsiones lipídicas al 20 % de nutrición parenteral se han usado en reportes de casos: consulta con farmacia qué hay disponible y tenla en el kit de LAST.', 'El propofol NO sustituye a la emulsión lipídica: tiene solo 10 % de lípidos y deprime el miocardio.'], nota: 'Nota práctica para centros sin Intralipid; verifica con tu farmacia.' },
        { t: 'Prevención', items: ['Monitoreo cardiorrespiratorio antes de inyectar; aspirar, dosis fraccionadas, ecografía.', 'Vigila al menos 30 min después de la inyección.', 'Usa la calculadora de dosis máxima de anestésico local de la app.'] }],
      inicio: 'l0',
      pasos: {
        l0: { t: 'Detén la inyección', items: ['<b>Para de inyectar el anestésico local.</b>', 'Pide ayuda y el kit de LAST (emulsión lipídica 20 %). Considera avisar al equipo de circulación extracorpórea o ECMO.', 'Vía aérea: O₂ al 100 %, evita la hiperventilación, vía aérea avanzada si hace falta (la hipoxia y la acidosis empeoran la toxicidad).', 'Considera la <b>emulsión lipídica precozmente</b>.'],
          bot: [{ t: 'Convulsiones', ir: 'lConv', ev: 'Convulsiones', cls: 'peligro' }, { t: 'Arritmia o hipotensión', ir: 'lLip', ev: 'Arritmia/hipotensión', cls: 'peligro' }, { t: 'Paro cardíaco', ir: 'lParo', ev: 'Paro cardíaco', ciclo: true, cls: 'peligro' }, { t: 'Emulsión lipídica', ir: 'lLip', cls: 'primario' }] },
        lConv: { t: 'Convulsiones', items: ['Asegura la vía aérea.', '<b>Benzodiacepina de preferencia.</b>', 'Si solo hay propofol: dosis bajas (p. ej., 20 mg en incrementos); evita dosis grandes.', 'Considera la emulsión lipídica.'],
          bot: [{ t: 'Emulsión lipídica', ir: 'lLip', cls: 'primario' }, { t: 'Arritmia o hipotensión', ir: 'lLip', ev: 'Arritmia/hipotensión', cls: 'peligro' }] },
        lLip: { t: 'Emulsión lipídica 20 %', items: () => lipTxt(), bot: [{ t: 'Sigue inestable', ir: 'lLip2', ev: 'Sigue inestable', cls: 'peligro' }, { t: 'Estable', ir: 'lObs', ev: 'Estable', cls: 'ok' }, { t: 'Paro cardíaco', ir: 'lParo', ev: 'Paro cardíaco', ciclo: true, cls: 'peligro' }] },
        lLip2: { t: 'Sigue inestable', items: () => ['<b>Repite el bolo</b> (una o dos veces) y <b>duplica la infusión</b>.', ...lipTxt().slice(0, 2), '<b>Tope: 12 mL/kg</b>' + (P() > 0 ? ` = ${f(12 * P(), 0)} mL` : '') + '. En reanimaciones prolongadas (> 30 min) el total puede acercarse a 1 L.', 'Considera circulación extracorpórea o ECMO.'],
          bot: [{ t: 'Estable', ir: 'lObs', ev: 'Estable', cls: 'ok' }, { t: 'Paro cardíaco', ir: 'lParo', ev: 'Paro cardíaco', ciclo: true, cls: 'peligro' }] },
        lParo: { t: 'Paro por LAST: la RCP es DIFERENTE', items: () => ['RCP de alta calidad y emulsión lipídica.', `<b>Adrenalina en dosis menores:</b> empieza con < 1 mcg/kg${P() > 0 ? ' (< ' + f(P(), 0) + ' mcg)' : ''}, no 1 mg.`, '<b>EVITA:</b> otros anestésicos locales (no uses lidocaína como antiarrítmico), betabloqueantes, calcioantagonistas y vasopresina.', 'Oxigenación y ventilación primero (evita hipoxia, hipercapnia y acidosis).', 'La reanimación puede ser prolongada: considera ECMO o circulación extracorpórea.'],
          bot: [{ t: 'RCE', ir: 'lObs', ev: 'RCE', cls: 'ok' }] },
        lObs: { t: 'Estable: observa', items: ['Continúa la emulsión lipídica al menos 15 min después de lograr la estabilidad hemodinámica.', 'Observa: 2 h tras una convulsión aislada; 4–6 h tras inestabilidad cardiovascular; lo que corresponda tras un paro.', 'Tope total: 12 mL/kg.'], bot: [] },
      },
    },
    nino: {
      titulo: '"No intubo, no oxigeno"', sub: 'DAS 2025 · planes A → B → C → D', fuente: 'Difficult Airway Society 2025 (Ahmad, Br J Anaesth 2025, doi 10.1016/j.bja.2025.10.006).', url: 'https://doi.org/10.1016/j.bja.2025.10.006',
      rapidos: ['intento', 'dsg', 'nino', 'fona', 'nota'],
      ref: [{ t: 'Material del plan D (bisturí–bougie–tubo)', items: ['Bisturí hoja n.º 10', 'Bougie', 'Tubo endotraqueal con balón n.º 6,0', 'Aspiración'] }],
      inicio: 'd0',
      pasos: {
        d0: { t: 'Plan A fallido', items: ['Máximo <b>3 intentos de intubación + 1</b> de un colega más experto, cada uno con un cambio (posición, dispositivo, hoja, introductor, relajación).', 'Oxigena con mascarilla entre intentos. Si la SpO₂ cae, abandona el intento y oxigena.', 'Declara "<b>intubación fallida</b>" y ten abierto el kit de acceso frontal del cuello.'],
          bot: [{ t: 'Pasar al plan B', ir: 'd1', ev: 'Intubación fallida (plan A)', cls: 'peligro' }] },
        d1: { t: 'Plan B: dispositivo supraglótico', items: ['Dispositivo supraglótico de 2.ª generación; <b>máximo 3 intentos</b>, cada uno con un cambio.', '<b>¿Oxigena?</b> (capnografía + SpO₂)'],
          bot: [{ t: 'Sí oxigena', ir: 'd1ok', ev: 'Oxigena por supraglótico', cls: 'ok' }, { t: 'No oxigena', ir: 'd2', ev: 'Falla el supraglótico (plan B)', cls: 'peligro' }] },
        d1ok: { t: 'Para y piensa', items: ['Por defecto: <b>despertar al paciente</b>, salvo que continuar sea esencial.', 'Si la intubación es esencial: un intento por el supraglótico con fibrobroncoscopio, o acceso frontal del cuello (traqueostomía o cricotiroidotomía).', 'Continuar con el supraglótico solo si es imprescindible (riesgo de desplazamiento, regurgitación, edema).'], bot: [{ t: 'Deja de oxigenar', ir: 'd2', ev: 'Deja de oxigenar', cls: 'peligro' }] },
        d2: { t: 'Plan C: último intento con mascarilla', items: ['Bloqueo neuromuscular completo; posición óptima; cánula oro o nasofaríngea; técnica a cuatro manos (dos personas); anestesia profunda.', '<b>¿Oxigena?</b> (capnografía + SpO₂)'],
          bot: [{ t: 'Sí oxigena', ir: 'd2ok', ev: 'Oxigena con mascarilla (plan C)', cls: 'ok' }, { t: 'No: NINO', ir: 'd3', ev: 'Declarado "no intubo, no oxigeno"', cls: 'peligro' }] },
        d2ok: { t: 'Para, piensa y comunica', items: ['Si se decide despertar: reversión completa del bloqueo y despertar cuidadoso (puede empeorar la obstrucción).', 'Aun oxigenando, puede estar indicado el acceso frontal del cuello.'], bot: [{ t: 'Deja de oxigenar: NINO', ir: 'd3', ev: 'Declarado "no intubo, no oxigeno"', cls: 'peligro' }] },
        d3: { t: 'Plan D: acceso frontal del cuello', items: ['Declara NINO en voz alta; pide ayuda; asigna roles (operador, ayudante, quien oxigena por arriba).', '<b>Bloqueo neuromuscular completo</b> (si ya se dio sugammadex, usa un relajante distinto de rocuronio o vecuronio).', '<b>Extensión máxima del cuello</b> (almohada bajo los hombros). Sigue dando O₂ por la vía aérea superior.',
          'Técnica bisturí–bougie–tubo (incisión vertical por defecto):', '1) Diestro: de pie del lado izquierdo del paciente. Identifica la línea media y estabiliza la laringe con la mano no dominante.', '2) Incisión cutánea vertical en la línea media de hasta 8 cm, de caudal a cefálico; disección roma con los dedos.', '3) Localiza la membrana cricotiroidea con el índice; incisión transversal a través de ella con el filo hacia ti.', '4) Gira el bisturí 90° (filo hacia los pies), cámbialo a la mano no dominante y tracciona suavemente hacia ti.', '5) Desliza la punta del bougie junto a la hoja hacia la tráquea y avanza 10–15 cm; retira el bisturí.', '6) Pasa el tubo 6,0 con balón sobre el bougie rotándolo; retira el bougie; infla el balón; ventila con O₂ 100 % y <b>confirma con capnografía</b>; fija el tubo.'],
          bot: [{ t: '✔ Acceso logrado', ir: 'd4', ev: 'Acceso frontal del cuello logrado', cls: 'ok' }] },
        d4: { t: 'Después', items: ['Descarta intubación bronquial y neumotórax.', 'Valoración por cirugía para el siguiente paso de la vía aérea.', 'Documenta, informa al paciente y haz un debriefing; ofrece apoyo psicológico al equipo.'], bot: [] },
      },
    },
  };
  function adultoAna() { const e = num(S.edad); if (isFinite(e)) return e >= 12; return !(P() > 0 && P() < 40); }
  function adenoPedTxt() { return P() > 0 ? `Adenosina: ${D.adeno(Math.min(6, 0.1 * P()))} (0,1 mg/kg, máx. 6 mg); si no cede, ${D.adeno(Math.min(12, 0.2 * P()))} (0,2 mg/kg, máx. 12 mg).` : 'Adenosina 0,1 mg/kg (máx. 6 mg), luego 0,2 mg/kg (máx. 12 mg). ' + faltaPeso; }
  function cvPedTxt() { return P() > 0 ? `Cardioversión sincronizada: empieza con 0,5–1 J/kg = <b>${f(0.5 * P(), 0)}–${f(P(), 0)} J</b>; si no funciona, 2 J/kg = ${f(2 * P(), 0)} J. Seda si hace falta, sin retrasarla.` : 'Cardioversión sincronizada 0,5–1 J/kg, luego 2 J/kg. ' + faltaPeso; }
  function lipTxt() {
    const w = P();
    if (!(w > 0)) return ['Más de 70 kg: bolo ~100 mL en 2–3 min + infusión 200–250 mL en 15–20 min.', 'Menos de 70 kg: bolo 1,5 mL/kg en 2–3 min + infusión 0,25 mL/kg/min.', faltaPeso];
    if (w > 70) return [`<b>Bolo ~100 mL</b> en 2–3 min.`, `<b>Infusión 200–250 mL en 15–20 min</b> (≈ 600–1000 mL/h).`, `Tope 12 mL/kg = ${f(12 * w, 0)} mL. El orden (bolo o infusión) y el método (manual, llave o bomba) no son críticos.`];
    return [`<b>Bolo 1,5 mL/kg = ${f(1.5 * w, 0)} mL</b> en 2–3 min.`, `<b>Infusión 0,25 mL/kg/min = ${f(0.25 * w, 1)} mL/min (${f(0.25 * w * 60, 0)} mL/h)</b>${w < 40 ? '; usa bomba (< 40 kg)' : ''}. NYSORA calcula la infusión con el peso ideal.`, `Tope 12 mL/kg = ${f(12 * w, 0)} mL. El orden y el método de infusión no son críticos.`];
  }

  /* ---------- Eventos rápidos (botones de abajo) ---------- */
  const RAP = {
    desc: { t: '⚡ Descarga', f: () => { S.nDesc++; const txt = S.ped ? `Descarga ${S.nDesc}` : `Descarga ${S.nDesc} · ${(C.desfib || 'bif') === 'mono' ? '360 J monofásico' : (C.biJ === 'max' ? 'máx.' : (C.biJ || 200) + ' J') + ' bifásico'}`; nuevoCiclo(); return txt; } },
    adr: { t: '💉 Adrenalina', f: () => { S.nAdr++; S.adrUlt = Date.now(); const mg = S.ped ? (P() > 0 ? Math.min(0.01 * P(), 1) : null) : 1; if (mg) S.adrMg = (S.adrMg || 0) + mg; return `Adrenalina ${mg ? f(mg, 2) + ' mg' : '0,01 mg/kg'} (dosis ${S.nAdr})`; } },
    amio: { t: '💉 Amiodarona', f: () => { const mg = S.ped ? (P() > 0 ? Math.min(5 * P(), S.nAmio ? 150 : 300) : null) : S.alg === 'taqui' ? 150 : S.nAmio ? 150 : 300; S.nAmio++; return `Amiodarona ${mg ? f(mg, 0) + ' mg' : '5 mg/kg'}`; } },
    lido: { t: '💉 Lidocaína', f: () => { S.nLido = (S.nLido || 0) + 1; return `Lidocaína ${P() > 0 ? f((S.ped ? 1 : S.nLido > 1 ? 0.5 : 1) * P(), 0) + ' mg' : ''} (dosis ${S.nLido})`; } },
    via: { t: '🫁 Vía aérea avanzada', f: () => 'Vía aérea avanzada colocada (confirmada con capnografía)' },
    ciclo: { t: '↻ Nuevo ciclo', f: () => { nuevoCiclo(); return null; } },
    rce: { t: '✔ RCE', f: () => { S.rce = true; S.paso = 'rce'; return 'RCE: retorno de la circulación espontánea'; } },
    cesarea: { t: '👶 Histerotomía / nacimiento', f: () => 'Histerotomía / nacimiento' },
    atro: { t: '💉 Atropina', f: () => { S.atroMg = (S.atroMg || 0) + 1; return `Atropina 1 mg (total ${f(S.atroMg, 1)} mg${S.atroMg >= 3 ? ' — máximo alcanzado' : ''})`; } },
    mp: { t: '⚡ Marcapaso', f: () => 'Marcapaso transcutáneo iniciado' },
    infDopa: { t: '🧮 Dopamina', calc: 'Dopamina' },
    infAdr: { t: '🧮 Adrenalina (infusión)', calc: 'Adrenalina' },
    cv: { t: '⚡ Cardioversión', f: () => { S.nCV = (S.nCV || 0) + 1; return `Cardioversión sincronizada ${S.nCV}`; } },
    adeno: { t: '💉 Adenosina', f: () => { S.nAdeno = (S.nAdeno || 0) + 1; return `Adenosina ${S.nAdeno === 1 ? '6' : '12'} mg`; } },
    adrPed: { t: '💉 Adrenalina', f: () => { S.nAdr++; S.adrUlt = Date.now(); return `Adrenalina ${P() > 0 ? f(Math.min(0.01 * P(), 1), 3) + ' mg' : '0,01 mg/kg'}`; } },
    atroPed: { t: '💉 Atropina', f: () => `Atropina ${P() > 0 ? f(Math.min(0.5, Math.max(0.1, 0.02 * P())), 2) + ' mg' : '0,02 mg/kg'}` },
    adenoPed: { t: '💉 Adenosina', f: () => { S.nAdeno = (S.nAdeno || 0) + 1; const mg = P() > 0 ? Math.min(S.nAdeno === 1 ? 6 : 12, (S.nAdeno === 1 ? 0.1 : 0.2) * P()) : null; return `Adenosina ${mg ? f(mg, 1) + ' mg' : (S.nAdeno === 1 ? '0,1' : '0,2') + ' mg/kg'}`; } },
    vpp: { t: '🫁 VPP', f: () => 'Inicio de ventilación con presión positiva' },
    compr: { t: '✋ Compresiones', f: () => { nuevoCiclo(); return 'Inicio de compresiones 3:1'; } },
    adrNeo: { t: '💉 Adrenalina', f: () => { S.nAdr++; S.adrUlt = Date.now(); return `Adrenalina IV/IO ${P() > 0 ? f(0.02 * P(), 3) + ' mg aprox.' : ''} (dosis ${S.nAdr})`; } },
    vol: { t: '💧 Expansor', f: () => `Expansor de volumen ${P() > 0 ? f(10 * P(), 0) + ' mL' : '10 mL/kg'}` },
    adrIV: { t: '💉 Adrenalina IV', f: () => { S.nAdr++; S.adrUlt = Date.now(); return `Adrenalina IV bolo ${S.nAdr}`; } },
    adrIM: { t: '💉 Adrenalina IM', f: () => `Adrenalina IM ${P() > 0 ? f(Math.min(10 * P(), 500), 0) + ' mcg' : '10 mcg/kg'}` },
    bolo: { t: '💧 Cristaloide', f: () => 'Bolo de cristaloide' },
    triptasa: { t: '🧪 Triptasa', f: () => 'Muestra de triptasa extraída' },
    dantro: { t: '💉 Dantroleno', f: () => { const mg = P() > 0 ? Math.round(2 * P()) : 0; S.dantroMg = (S.dantroMg || 0) + mg; return `Dantroleno ${mg ? mg + ' mg (2 mg/kg)' : '2 mg/kg'} · total ${S.dantroMg ? S.dantroMg + ' mg' : '—'}`; } },
    enfriar: { t: '❄ Enfriamiento', f: () => 'Inicio de enfriamiento' },
    lipBolo: { t: '💧 Bolo lipídico', f: () => { S.nLip = (S.nLip || 0) + 1; return `Bolo de emulsión lipídica 20 % ${P() > 0 ? (P() > 70 ? '100 mL' : f(1.5 * P(), 0) + ' mL') : ''} (${S.nLip})`; } },
    lipInf: { t: '💧 Infusión lipídica', f: () => 'Inicio o aumento de la infusión de emulsión lipídica' },
    benzo: { t: '💉 Benzodiacepina', f: () => 'Benzodiacepina' },
    adrLast: { t: '💉 Adrenalina < 1 mcg/kg', f: () => { S.nAdr++; S.adrUlt = Date.now(); return `Adrenalina dosis baja (${P() > 0 ? '< ' + f(P(), 0) + ' mcg' : '< 1 mcg/kg'})`; } },
    intento: { t: '↺ Intento de IOT', f: () => { S.nIOT = (S.nIOT || 0) + 1; return `Intento de intubación ${S.nIOT}`; } },
    dsg: { t: '↺ Supraglótico', f: () => { S.nDSG = (S.nDSG || 0) + 1; return `Intento de supraglótico ${S.nDSG}`; } },
    nino: { t: '⚠ NINO', f: () => { S.paso = 'd3'; return 'Declarado "no intubo, no oxigeno"'; } },
    fona: { t: '🔪 eFONA', f: () => 'Acceso frontal del cuello (bisturí–bougie–tubo)' },
    nota: { t: '✎ Nota', f: () => { const x = prompt('Nota para el registro:'); return x ? 'Nota: ' + x : null; } },
  };

  /* ---------- Sonido y vibración ---------- */
  let audio = null;
  function pitido(n = 3, frec = 880) {
    try { if (navigator.vibrate) navigator.vibrate(n > 1 ? [300, 150, 300, 150, 300] : [200]); } catch (e) {}
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < n; i++) { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = frec; o.connect(g); g.connect(audio.destination); const t = audio.currentTime + i * 0.35; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.start(t); o.stop(t + 0.3); }
    } catch (e) {}
  }
  let wake = null;
  function pantalla(on) {
    try { if (window.Nativo && Nativo.pantallaEncendida) Nativo.pantallaEncendida(!!on); } catch (e) {}
    try { if (on && navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then((w) => (wake = w)).catch(() => {}); if (!on && wake) { wake.release(); wake = null; } } catch (e) {}
  }

  /* ---------- Reloj ---------- */
  let tic = null;
  function actualizar() {
    const el = document.getElementById('crTot'); if (!el || !S) { if (tic && !document.getElementById('crTot')) { clearInterval(tic); tic = null; } return; }
    const now = Date.now(), A = ALG[S.algo];
    el.textContent = mmss(now - S.inicio);
    const c = document.getElementById('crCiclo');
    if (c) {
      if (S.ciclo) {
        const t = now - S.ciclo, rest = 120000 - t;
        c.textContent = rest > 0 ? mmss(rest) : '+' + mmss(-rest);
        const barra = document.getElementById('crBarra'); if (barra) barra.style.width = Math.min(100, (t / 120000) * 100) + '%';
        const caja = document.getElementById('crCicloCaja'); if (caja) caja.classList.toggle('alerta', rest <= 0);
        if (rest <= 10000 && rest > 9000 && !S.aviso10) { S.aviso10 = true; pitido(1, 660); }
        if (rest <= 0 && !S.avisoCiclo) { S.avisoCiclo = true; S.aviso10 = false; pitido(3); }
      } else c.textContent = '—';
    }
    const a = document.getElementById('crAdr');
    if (a) {
      if (S.adrUlt) { const t = now - S.adrUlt; a.textContent = mmss(t); const caja = document.getElementById('crAdrCaja'); caja.classList.toggle('aviso', t >= 180000 && t < 300000); caja.classList.toggle('alerta', t >= 300000);
        if (t >= 180000 && !S.avisoAdr) { S.avisoAdr = true; pitido(2, 520); } }
      else a.textContent = '—';
    }
    const cs = document.getElementById('crCes');
    if (cs) { const t = now - S.inicio; cs.textContent = t < 300000 ? mmss(300000 - t) : 'pasó'; cs.parentElement.classList.toggle('alerta', t >= 240000); }
  }

  /* ---------- Pantallas ---------- */
  const LISTA = [['Reanimación', ['pcr', 'pcr-emb', 'pals', 'neonatal']], ['Arritmias con pulso', ['bradi', 'taqui', 'bradi-ped', 'taqui-ped']], ['Crisis en quirófano', ['anafilaxia', 'last', 'hm', 'nino']]];
  function menuHtml() {
    recuperar();
    return (S ? `<section class="tarjeta cr-activa"><h2>Crisis en curso</h2><p style="margin:0 0 10px"><b>${esc(ALG[S.algo].titulo)}</b> · desde las ${hora(S.inicio)}</p><div class="fila-btn" style="margin:0"><button class="peligro" data-acc="crisisSeguir">Volver a la crisis</button></div></section>` : '') +
      LISTA.map(([g, ids]) => `<section class="tarjeta"><h2>${g}</h2><ul class="lista">${ids.map((id) => `<li class="item" data-acc="crisisAbrir" data-id="${id}"><div class="txt"><b>${esc(ALG[id].titulo)}</b><small>${esc(ALG[id].sub)}</small></div><span class="flecha">›</span></li>`).join('')}</ul></section>`).join('');
  }
  function iniciar(id, datos) {
    recuperar();
    const prev = S && !S.fin ? S : null;
    S = { algo: id, paso: ALG[id].inicio, inicio: Date.now(), ev: [], nDesc: 0, nAdr: 0, nAmio: 0, ciclo: null, adrUlt: null,
      peso: prev ? prev.peso : datos.peso || '', edad: prev ? prev.edad : datos.edad || '', ped: !!ALG[id].pasos && (id === 'pals'), previo: prev ? prev.algo : null };
    if (prev) { S.inicio = prev.inicio; S.ev = prev.ev.slice(); S.nAdr = prev.nAdr; S.adrUlt = prev.adrUlt; S.adrMg = prev.adrMg; }
    evento(prev ? `Cambio a: ${ALG[id].titulo}` : `Inicio: ${ALG[id].titulo}`);
    pantalla(true);
  }
  function render(v, ctx) {
    C = ctx.cfg; recuperar(); if (!S) { renderMenu(v, ctx); return; }
    const A = ALG[S.algo], paso = A.pasos[S.paso] || A.pasos[A.inicio];
    S.peso = S.peso === undefined ? '' : S.peso; S.ped = S.algo === 'pals' || S.algo === 'bradi-ped' || S.algo === 'taqui-ped';
    const val = (x) => (typeof x === 'function' ? x() : x);
    const rel = A.rcp || S.ciclo;
    let h = `<section class="cr-cab"><div class="cr-tit"><b>${esc(A.titulo)}</b><small>${esc(A.sub)}</small></div>
      <div class="cr-relojes">
        <div class="cr-r"><small>${A.reloj === 'nac' ? 'Desde el nacimiento' : 'Total'}</small><b id="crTot">00:00</b></div>
        ${rel ? `<div class="cr-r" id="crCicloCaja"><small>Ciclo de 2 min</small><b id="crCiclo">—</b><div class="cr-barra"><i id="crBarra"></i></div></div>` : ''}
        ${A.rcp || S.algo === 'anafilaxia' || S.adrUlt ? `<div class="cr-r" id="crAdrCaja"><small>Última adrenalina</small><b id="crAdr">—</b></div>` : ''}
        ${A.emb ? `<div class="cr-r"><small>Nacimiento a los 5 min</small><b id="crCes">05:00</b></div>` : ''}
      </div></section>`;
    h += `<section class="tarjeta cr-pac"><div class="rejilla"><label class="campo"><span>Peso</span><div class="con-unidad"><input id="crPeso" inputmode="decimal" value="${esc(S.peso)}"><em>kg</em></div></label>
      ${A.pideEdad ? `<label class="campo"><span>Edad</span><div class="con-unidad"><input id="crEdad" inputmode="decimal" value="${esc(S.edad)}"><em>años</em></div></label>` : ''}</div>
      ${A.rcp && !S.ped ? `<div class="grupo" style="margin-top:8px"><div class="etq">Desfibrilador</div><div class="segmento">${[['bif', 'Bifásico'], ['mono', 'Monofásico']].map(([k, t]) => `<button type="button" class="${(C.desfib || 'bif') === k ? 'sel' : ''}" data-crd="${k}">${t}</button>`).join('')}</div>
        ${(C.desfib || 'bif') === 'bif' ? `<div class="opciones" style="margin-top:6px">${[120, 150, 200, 'max'].map((j) => `<button type="button" class="opcion${String(C.biJ || 200) === String(j) ? ' sel' : ''}" data-crj="${j}">${j === 'max' ? 'Máxima' : j + ' J'}</button>`).join('')}</div>` : ''}</div>` : ''}</section>`;
    h += `<section class="tarjeta cr-paso"><h2>${val(paso.t)}</h2><ul class="cr-items">${val(paso.items).map((i) => `<li>${i}</li>`).join('')}</ul>
      <div class="cr-bot">${(paso.bot || []).map((b, i) => `<button class="${b.cls || 'secundario'}" data-crb="${i}">${b.t}</button>`).join('')}</div></section>`;
    h += `<section class="tarjeta"><div class="cr-rap">${A.rapidos.map((k) => `<button class="secundario" data-crr="${k}">${RAP[k].t}${k === 'desc' && S.nDesc ? ` <em>${S.nDesc}</em>` : k === 'adr' && S.nAdr ? ` <em>${S.nAdr}</em>` : ''}</button>`).join('')}</div></section>`;
    h += A.ref.filter((r) => !r.si || (r.si === 'sinLipido' && !((C.farmacia || {}).lipido))).map((r) => `<details class="tarjeta cr-ref"><summary>${esc(r.t)}</summary>${r.items ? `<ul class="cr-items">${r.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}${r.tabla ? `<table class="tabla">${r.tabla.map((x) => `<tr><td class="etq">${esc(x[0])}</td><td><b>${esc(x[1])}</b></td></tr>`).join('')}</table>` : ''}${r.escalera ? `<ol class="cr-escalera">${r.escalera.map((x, i) => `<li style="--n:${i}">${esc(x)}</li>`).join('')}</ol>` : ''}${r.nota ? `<p class="nota">${esc(r.nota)}</p>` : ''}</details>`).join('');
    h += `<section class="tarjeta"><h2>Registro</h2>${S.ev.length ? `<ul class="cr-log">${S.ev.slice().reverse().map((e) => `<li><b>${hora(e.ms)}</b> ${esc(e.txt)}</li>`).join('')}</ul>` : '<p class="nota">Aún sin eventos.</p>'}
      <div class="fila-btn"><button class="primario" id="crFin">Terminar y ver resumen</button><button class="secundario" id="crOtro">Otro algoritmo</button></div>
      <p class="nota">Fuente: ${esc(A.fuente)} ${ctx.enlace(A.url, 'Ver algoritmo oficial')} · Diseño propio de Morpheus MD; no sustituye la guía ni el juicio clínico.</p></section>`;
    v.innerHTML = h;
    try { const bb = document.getElementById('barra'); if (bb) document.documentElement.style.setProperty('--barra-h', bb.offsetHeight + 'px'); } catch (e) {}
    // Eventos
    const $ = (s) => v.querySelector(s);
    const peso = $('#crPeso'); peso.oninput = () => { S.peso = num(peso.value) > 0 ? num(peso.value) : ''; guardar(); refrescarPaso(v, ctx); };
    if ($('#crEdad')) $('#crEdad').oninput = (e) => { S.edad = e.target.value; guardar(); refrescarPaso(v, ctx); };
    v.querySelectorAll('[data-crd]').forEach((b) => (b.onclick = () => { C.desfib = b.dataset.crd; ctx.guardarCfg(); render(v, ctx); }));
    v.querySelectorAll('[data-crj]').forEach((b) => (b.onclick = () => { C.biJ = b.dataset.crj === 'max' ? 'max' : +b.dataset.crj; ctx.guardarCfg(); render(v, ctx); }));
    v.querySelectorAll('[data-crb]').forEach((b) => (b.onclick = () => {
      const x = (paso.bot || [])[+b.dataset.crb]; if (!x) return;
      if (x.rapido) { const t = RAP[x.rapido].f(); if (t) evento(t); }
      if (x.ev) evento(x.ev);
      if (x.ciclo) nuevoCiclo();
      if (x.nac) S.inicio = Date.now();
      if (x.algo) { const id = typeof x.algo === 'function' ? x.algo() : x.algo; iniciar(id, {}); render(v, ctx); window.scrollTo(0, 0); return; }
      if (x.ir) S.paso = x.ir;
      guardar(); render(v, ctx); window.scrollTo(0, 0);
    }));
    v.querySelectorAll('[data-crr]').forEach((b) => (b.onclick = () => {
      const r = RAP[b.dataset.crr];
      if (r.calc) { ctx.irCalc(r.calc, S.peso); return; }
      const t = r.f(); if (t) { evento(t); ctx.aviso(t); } guardar(); render(v, ctx);
    }));
    $('#crFin').onclick = () => { if (!confirm('¿Terminar la crisis y ver el resumen?')) return; evento('Fin'); S.fin = Date.now(); const txt = resumen(); guardar(); const copia = S; S = null; guardar(); pantalla(false); mostrarResumen(v, ctx, txt, copia); };
    $('#crOtro').onclick = () => { ctx.menuAlgos(); };
    if (!tic) tic = setInterval(actualizar, 1000);
    actualizar();
  }
  function refrescarPaso(v, ctx) {
    const A = ALG[S.algo], paso = A.pasos[S.paso]; const val = (x) => (typeof x === 'function' ? x() : x);
    const ul = v.querySelector('.cr-paso .cr-items'); if (ul) ul.innerHTML = val(paso.items).map((i) => `<li>${i}</li>`).join('');
  }
  function resumen(x) {
    x = x || S; const A = ALG[x.algo];
    const l = [`MORPHEUS MD · REGISTRO DE CRISIS`, `${A.titulo}`, `Fecha: ${new Date(x.inicio).toLocaleDateString('es-VE')} · Inicio ${hora(x.inicio)} · Duración ${mmss((x.fin || Date.now()) - x.inicio)}`];
    if (x.peso) l.push(`Peso: ${f(x.peso, 1)} kg${x.edad ? ' · Edad: ' + x.edad + ' años' : ''}`);
    l.push('');
    x.ev.forEach((e) => l.push(`${hora(e.ms)}  ${e.txt}`));
    const tot = [];
    if (x.nDesc) tot.push(`${x.nDesc} descarga(s)`);
    if (x.nAdr) tot.push(`adrenalina: ${x.nAdr} dosis${x.adrMg ? ' (' + f(x.adrMg, 2) + ' mg)' : ''}`);
    if (x.nAmio) tot.push(`amiodarona: ${x.nAmio} dosis`);
    if (x.nLido) tot.push(`lidocaína: ${x.nLido} dosis`);
    if (x.atroMg) tot.push(`atropina ${f(x.atroMg, 1)} mg`);
    if (x.dantroMg) tot.push(`dantroleno ${x.dantroMg} mg`);
    if (x.nLip) tot.push(`${x.nLip} bolo(s) de emulsión lipídica`);
    if (tot.length) l.push('', 'Totales: ' + tot.join(' · '));
    l.push('', `Guía: ${A.fuente}`);
    return l.join('\n');
  }
  function mostrarResumen(v, ctx, txt) {
    v.innerHTML = `<section class="tarjeta"><h2>Resumen de la crisis</h2><p class="nota" style="margin-top:0">No se guarda en la historia: cópialo o compártelo para pegarlo donde lo necesites.</p>
      <textarea id="crTxt" readonly style="width:100%;min-height:320px;font-family:monospace;font-size:13px">${esc(txt)}</textarea>
      <div class="fila-btn"><button class="primario" id="crCopiar">📋 Copiar</button><button class="secundario" id="crCompartir">↗ Compartir</button><button class="secundario" id="crListo">Listo</button></div></section>`;
    v.querySelector('#crCopiar').onclick = () => copiar(txt, ctx);
    v.querySelector('#crCompartir').onclick = () => compartir(txt, ctx);
    v.querySelector('#crListo').onclick = () => ctx.menuAlgos();
  }
  function copiar(txt, ctx) {
    if (window.Nativo && Nativo.copiarTexto) { Nativo.copiarTexto(txt); return; }
    const ok = () => ctx.aviso('Copiado');
    const viejo = () => { const t = document.getElementById('crTxt'); if (t) { t.removeAttribute('readonly'); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { ctx.aviso('Selecciona el texto y cópialo'); } t.setAttribute('readonly', ''); } };
    try { navigator.clipboard.writeText(txt).then(ok, viejo); } catch (e) { viejo(); }
  }
  function compartir(txt, ctx) {
    if (window.Nativo && Nativo.compartirTexto) { Nativo.compartirTexto(txt); return; }
    if (navigator.share) navigator.share({ title: 'Registro de crisis', text: txt }).catch(() => {});
    else copiar(txt, ctx);
  }
  function renderMenu(v, ctx) {
    C = ctx.cfg; const pr = (C.pres = C.pres || {});
    v.innerHTML = `<section class="tarjeta"><p class="nota" style="margin:0">Algoritmos paso a paso con reloj de ciclos, contador de adrenalina y dosis calculadas con el peso. Al terminar obtienes un resumen con horas para copiar o compartir; no se escribe nada en la historia. La pantalla se mantiene encendida mientras la crisis está activa.</p></section>` + menuHtml() +
      `<details class="tarjeta cr-ref"><summary>Presentaciones de tu hospital</summary><p class="nota">Los mL de cada dosis se calculan con estas presentaciones. Adrenalina 1 mg/mL, amiodarona 150 mg/3 mL y adenosina 6 mg/2 mL son fijas.</p>
      ${Object.entries(PRES_OPC).map(([k, o]) => `<div class="grupo"><div class="etq">${o.t}</div><div class="opciones">${o.ops.map(([val, t]) => `<button type="button" class="opcion${pres(k) === val ? ' sel' : ''}" data-crp="${k}" data-v="${val}">${t}</button>`).join('')}</div></div>`).join('')}</details>`;
    v.querySelectorAll('[data-crp]').forEach((b) => (b.onclick = () => { pr[b.dataset.crp] = +b.dataset.v; ctx.guardarCfg(); renderMenu(v, ctx); }));
  }
  function activa() { recuperar(); return !!S; }
  return { ALG, LISTA, RAP, PRES_OPC, menuHtml, renderMenu, iniciar, render, activa, resumen, _estado: () => S, _set: (x) => { S = x; guardar(); } };
})();
