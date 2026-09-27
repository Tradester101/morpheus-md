/* Extras (vista previa de la versión 2.0): valoración preanestésica y récipe.
   Datos clínicos, catálogo de conciliación de medicación y generación de los PDF con membrete del médico. */
window.Extras = (function () {
  'use strict';
  const num = (v) => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); };
  const t = (v) => (v == null ? '' : String(v));
  const r1 = (x, d = 1) => (isFinite(x) ? String(Math.round(x * 10 ** d) / 10 ** d) : '');

  /* ---------- Antecedentes (mismo orden de la hoja) ---------- */
  const ANT = [
    ['hta', 'HTA'], ['dm', 'DM'], ['asma', 'ASMA'], ['gastritis', 'GASTRITIS'], ['convulsiones', 'CONVULSIONES'], ['artritis', 'ARTRITIS'],
    ['arritmias', 'ARRITMIAS'], ['hipotiroidismo', 'HIPOTIROIDISMO'], ['epoc', 'EPOC'], ['ulcera', 'ÚLCERA'], ['sincope', 'SÍNCOPE'], ['lupus', 'LUPUS'],
    ['im', 'IM'], ['hipertiroidismo', 'HIPERTIROIDISMO'], ['enfisema', 'ENFISEMA'], ['hepatitis', 'HEPATITIS'], ['anemia', 'ANEMIA'], ['irc', 'INSUF RENAL'],
    ['ecv', 'ECV'], ['tiroiditis', 'TIROIDITIS'], ['covid', 'COVID-19'], ['cirrosis', 'CIRROSIS'], ['transfusiones', 'TRANSFUSIONES'], ['dialisis', 'DIÁLISIS'],
  ];
  // agregados: lo que más cambia la conducta anestésica y no estaba en la hoja
  // [clave, etiqueta en la app, etiqueta corta en la hoja (misma cuadrícula de columnas)]
  const ANT_EXTRA = [['saos', 'SAOS / ronquido', 'SAOS'], ['icc', 'INSUF. CARDÍACA', 'INSUF. CARDÍACA'], ['coagulopatia', 'COAGULOPATÍA', 'COAGULOPATÍA'],
    ['nvpo', 'NVPO PREVIAS', 'NVPO PREVIA'], ['hm', 'HIPERTERMIA MALIGNA (familiar)', 'HIPERTERMIA M.'], ['erge', 'ERGE', 'ERGE']];

  /* ---------- Conciliación de medicación preoperatoria ----------
     Resumen del "Calendario maestro" de la Guía de Manejo de Medicación Preoperatoria 2026 (cirugía electiva SIN neuroeje).
     acc: C continuar · S suspender · A ajustar · I individualizar. dias: días completos sin dosis antes del día 0. */
  const MEDS = [
    { n: 'Warfarina', g: 'Anticoagulante', acc: 'S', dias: 5, txt: 'INR el día previo; si > 1,5: vitamina K 1–2,5 mg VO. Reinicio 12–24 h.' },
    { n: 'Acenocumarol', g: 'Anticoagulante', acc: 'S', dias: 3, txt: 'INR preoperatorio (meta ≤ 1,5).' },
    { n: 'Apixabán', g: 'ACOD', acc: 'S', dias: { bajo: 1, alto: 2 }, txt: 'Sin terapia puente. Con neuroeje: ≥ 72 h (ASRA 2025).' },
    { n: 'Rivaroxabán', g: 'ACOD', acc: 'S', dias: { bajo: 1, alto: 2 }, txt: 'Sin terapia puente. Con neuroeje: ≥ 72 h (ASRA 2025).' },
    { n: 'Edoxabán', g: 'ACOD', acc: 'S', dias: { bajo: 1, alto: 2 }, txt: 'Sin terapia puente. Con neuroeje: ≥ 72 h (ASRA 2025).' },
    { n: 'Dabigatrán', g: 'ACOD', acc: 'S', dias: { bajo: 1, alto: 2, bajoIR: 2, altoIR: 4 }, txt: 'Depende del ClCr (30–49 mL/min: más días).' },
    { n: 'Clopidogrel', g: 'Antiagregante', acc: 'S', dias: 5, txt: 'Con stent reciente: decidir con cardiología.' },
    { n: 'Ticagrelor', g: 'Antiagregante', acc: 'S', dias: 5, txt: 'Algunas guías aceptan 3 días. Stent reciente: cardiología.' },
    { n: 'Prasugrel', g: 'Antiagregante', acc: 'S', dias: 7, txt: 'Stent reciente: decidir con cardiología.' },
    { n: 'Aspirina (prevención secundaria)', g: 'Antiagregante', acc: 'C', txt: 'Continuar, salvo cirugía de cavidad cerrada (5–7 días).' },
    { n: 'Cilostazol', g: 'Antiagregante', acc: 'S', dias: 2 },
    { n: 'Enoxaparina dosis plena', g: 'Heparina', acc: 'A', txt: 'Última dosis 24 h antes, a la mitad de la dosis diaria.' },
    { n: 'Enoxaparina profiláctica', g: 'Heparina', acc: 'A', txt: 'Última dosis 12 h antes.' },
    { n: 'IECA / ARA-II (HTA)', g: 'Cardiovascular', acc: 'S', dias: 1, txt: 'Omitir 24 h antes.' },
    { n: 'Betabloqueante', g: 'Cardiovascular', acc: 'C', txt: 'No suspender. Tomar la mañana de la cirugía.' },
    { n: 'Calcioantagonista', g: 'Cardiovascular', acc: 'C', txt: 'Tomar la mañana de la cirugía.' },
    { n: 'Estatina', g: 'Cardiovascular', acc: 'C', txt: 'Tomar la mañana de la cirugía.' },
    { n: 'Diurético / espironolactona', g: 'Cardiovascular', acc: 'A', txt: 'Omitir la mañana de la cirugía.' },
    { n: 'Metformina', g: 'Diabetes', acc: 'A', txt: 'Omitir la mañana de la cirugía.' },
    { n: 'Sulfonilurea / glinida', g: 'Diabetes', acc: 'A', txt: 'Omitir la mañana de la cirugía.' },
    { n: 'iDPP-4 / pioglitazona', g: 'Diabetes', acc: 'A', txt: 'Omitir la mañana de la cirugía (según protocolo).' },
    { n: 'Empagliflozina / dapagliflozina / canagliflozina', g: 'Diabetes', acc: 'S', dias: 3, txt: 'Riesgo de cetoacidosis euglucémica.' },
    { n: 'Ertugliflozina', g: 'Diabetes', acc: 'S', dias: 4 },
    { n: 'Agonista GLP-1 (semaglutida, tirzepatida…)', g: 'Diabetes', acc: 'I', txt: 'Continuar. Dieta líquida 24 h si dosis alta o escalada; con síntomas GI, diferir.' },
    { n: 'Insulina basal (glargina, detemir…)', g: 'Diabetes', acc: 'A', txt: 'Noche previa: 75–80 % de la dosis.' },
    { n: 'Insulina NPH', g: 'Diabetes', acc: 'A', txt: 'Mañana de la cirugía: 50 % de la dosis.' },
    { n: 'Insulina rápida / prandial', g: 'Diabetes', acc: 'A', txt: 'Omitir la mañana de la cirugía.' },
    { n: 'Levotiroxina', g: 'Endocrino', acc: 'C' },
    { n: 'Corticoide crónico', g: 'Endocrino', acc: 'C', txt: 'No suspender; valorar dosis de estrés.' },
    { n: 'Anticonceptivo / THS', g: 'Hormonal', acc: 'I', txt: 'Valorar suspender 4–6 semanas en cirugía de alto riesgo de TEV.' },
    { n: 'Antiepiléptico', g: 'SNC', acc: 'C', txt: 'No suspender.' },
    { n: 'Levodopa', g: 'SNC', acc: 'C', txt: 'No suspender.' },
    { n: 'ISRS / antidepresivo', g: 'SNC', acc: 'C' },
    { n: 'Litio', g: 'SNC', acc: 'S', dias: 3, txt: 'Cirugía mayor: 72 h.' },
    { n: 'IMAO irreversible', g: 'SNC', acc: 'I', txt: '2 semanas solo si no se garantiza una anestesia segura para IMAO.' },
    { n: 'Estimulante para TDAH', g: 'SNC', acc: 'A', txt: 'Omitir la mañana de la cirugía.' },
    { n: 'Buprenorfina / metadona', g: 'Opioides', acc: 'C', txt: 'No suspender.' },
    { n: 'Naltrexona oral', g: 'Opioides', acc: 'S', dias: 3 },
    { n: 'AINE (vida media corta)', g: 'Analgésico', acc: 'S', dias: 1, txt: '1–2 días (ibuprofeno, diclofenac…).' },
    { n: 'AINE (vida media intermedia)', g: 'Analgésico', acc: 'S', dias: 3, txt: '3–4 días (naproxeno…).' },
    { n: 'Sildenafilo / vardenafilo', g: 'Urológico', acc: 'S', dias: 1, txt: 'Si es por hipertensión pulmonar: no suspender.' },
    { n: 'Tadalafilo', g: 'Urológico', acc: 'S', dias: 2, txt: 'Si es por hipertensión pulmonar: no suspender.' },
    { n: 'Inhalador (asma / EPOC)', g: 'Respiratorio', acc: 'C', txt: 'Traer el inhalador el día de la cirugía.' },
    { n: 'Teofilina', g: 'Respiratorio', acc: 'A', txt: 'Omitir la noche previa.' },
    { n: 'IBP (omeprazol…)', g: 'Digestivo', acc: 'C' },
    { n: 'Inhibidor de JAK', g: 'Reumatología', acc: 'S', dias: 3 },
    { n: 'Fentermina', g: 'Otros', acc: 'S', dias: 7, txt: 'Mínimo 4 días.' },
    { n: 'Suplementos herbales / hierba de San Juan', g: 'Otros', acc: 'S', dias: 14, txt: '1–2 semanas.' },
  ];
  const ACC = { C: 'Continuar', S: 'Suspender', A: 'Ajustar', I: 'Individualizar' };

  function fechaTxt(iso) { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  // "Suspender N días antes": N días completos sin dosis antes del día 0 → última dosis el día −(N+1)
  function ultimaDosis(fechaCx, dias) {
    if (!fechaCx || !isFinite(dias)) return '';
    const f = new Date(fechaCx + 'T12:00:00'); f.setDate(f.getDate() - dias - 1);
    return DIAS[f.getDay()] + ' ' + String(f.getDate()).padStart(2, '0') + '/' + String(f.getMonth() + 1).padStart(2, '0');
  }
  function diasDe(m, v) {
    if (!m || typeof m.dias !== 'object') return m ? m.dias : NaN;
    const alto = v.p.riesgoHem === 'alto', ir = isFinite(v._clcr) && v._clcr < 50;
    return ir && m.dias.bajoIR ? (alto ? m.dias.altoIR : m.dias.bajoIR) : (alto ? m.dias.alto : m.dias.bajo);
  }
  // Texto de la indicación de cada fármaco de la conciliación
  function indicacion(item, v) {
    const m = MEDS.find((x) => x.n === item.ref);
    const acc = item.acc || (m && m.acc) || '';
    let s = ACC[acc] || '';
    if (acc === 'S') {
      const d = isFinite(num(item.dias)) ? num(item.dias) : diasDe(m, v);
      if (isFinite(d)) { s += ` ${d} día${d === 1 ? '' : 's'} antes`; const u = ultimaDosis(v.p.fechaCx, d); if (u) s += ` (última dosis: ${u})`; }
    }
    const nota = t(item.nota) || (m && m.txt) || '';
    return s + (nota ? (s ? '. ' : '') + nota : '');
  }

  /* ---------- Escalas ---------- */
  function calcular(v) {
    const p = v.p, peso = num(p.peso), talla = num(p.talla), edad = num(p.edad);
    const tm = talla > 3 ? talla / 100 : talla;
    v._imc = peso > 0 && tm > 0 ? peso / (tm * tm) : NaN;
    // Cockcroft-Gault con la creatinina más reciente
    const crea = (v.lab || []).map((l) => num(l.crea)).filter((x) => x > 0).pop();
    v._clcr = crea && peso && edad ? ((140 - edad) * peso) / (72 * crea) * (p.sexo === 'F' ? 0.85 : 1) : NaN;
    // STOP-BANG (0–8): los datos objetivos se completan solos
    const sb = v.sb || {}; const auto = { b: v._imc > 35, a: edad > 50, g: p.sexo === 'M', n: num(v.ef && v.ef.cc) > 40 };
    v._sb = ['s', 't', 'o', 'p'].filter((k) => sb[k]).length + ['b', 'a', 'n', 'g'].filter((k) => (sb[k] !== undefined ? sb[k] : auto[k])).length;
    v._sbAuto = auto;
    // Índice de riesgo cardíaco revisado (Lee / RCRI)
    const rc = v.rcri || {}; v._rcri = ['alto', 'ci', 'icc', 'ecv', 'insulina', 'crea'].filter((k) => rc[k]).length;
    // Langeron (ventilación con mascarilla difícil): O B E S E, ≥ 2 sugiere dificultad
    const ob = (v.ef && v.ef.obese) || {}; const autoOb = { o: v._imc > 26, e2: edad > 55 };
    v._obese = { o: ob.o !== undefined ? ob.o : autoOb.o, b: !!ob.b, e: !!ob.e, s: ob.s !== undefined ? ob.s : !!(sb.s), e2: ob.e2 !== undefined ? ob.e2 : autoOb.e2 };
    v._langeron = Object.values(v._obese).filter(Boolean).length;
    return v;
  }
  const RCRI = [['alto', 'Cirugía de alto riesgo (intraperitoneal, intratorácica o vascular suprainguinal)'], ['ci', 'Cardiopatía isquémica'], ['icc', 'Insuficiencia cardíaca'],
    ['ecv', 'Enfermedad cerebrovascular'], ['insulina', 'Diabetes con insulina'], ['crea', 'Creatinina > 2 mg/dL']];
  const RCRI_RIESGO = ['3,9 %', '6,0 %', '10,1 %', '15 %']; // eventos cardíacos mayores a 30 días (Duceppe, CCS 2017)
  const SB = [['s', 'Ronca fuerte'], ['t', 'Cansancio / somnolencia diurna'], ['o', 'Apneas observadas'], ['p', 'Presión arterial alta (HTA)'],
    ['b', 'IMC > 35'], ['a', 'Edad > 50'], ['n', 'Cuello > 40 cm'], ['g', 'Sexo masculino']];

  /* ---------- Frases de sugerencias ---------- */
  const SUGERENCIAS = [
    'Ayuno: sólidos 8 h, comida ligera 6 h, líquidos claros hasta 2 h antes.',
    'Tomar su medicación habitual la mañana de la cirugía con un sorbo de agua, salvo lo indicado.',
    'Traer exámenes, informes y medicamentos habituales el día de la cirugía.',
    'Acudir con acompañante adulto. No conducir en las 24 h posteriores.',
    'Retirar prótesis dentales, lentes de contacto, joyas y esmalte de uñas.',
    'Suspender el cigarrillo lo antes posible antes de la cirugía.',
    'Reserva de hemoderivados según tipo de cirugía.',
    'Glucemia capilar al ingreso.',
  ];

  /* ============================== PDF ============================== */
  let d;
  function fuentes() {
    if (!window.FUENTES) return false;
    d.addFileToVFS('M4.ttf', FUENTES.normal); d.addFont('M4.ttf', 'M', 'normal');
    d.addFileToVFS('M6.ttf', FUENTES.semi); d.addFont('M6.ttf', 'MS', 'normal');
    d.addFileToVFS('M8.ttf', FUENTES.bold); d.addFont('M8.ttf', 'MB', 'normal');
    return true;
  }
  let conM = false;
  const F = (peso) => { if (conM) d.setFont(peso === 'b' ? 'MB' : peso === 's' ? 'MS' : 'M', 'normal'); else d.setFont('helvetica', peso === 'b' || peso === 's' ? 'bold' : 'normal'); };
  const AZUL = [13, 42, 107];
  function txt(s, x, y, o = {}) {
    s = t(s); if (!s) return 0;
    F(o.w); let sz = o.size || 8; d.setFontSize(sz); d.setTextColor(...(o.c || [0, 0, 0]));
    if (o.maxw) { while (sz > 4.5 && d.getTextWidth(s) > o.maxw) { sz -= 0.25; d.setFontSize(sz); } }
    d.text(s, x, y, { align: o.align || 'left', baseline: 'alphabetic', charSpace: o.cs || 0 });
    return d.getTextWidth(s);
  }
  const dato = (s, x, y, o = {}) => txt(s, x, y, Object.assign({ c: AZUL, size: 8.5 }, o));
  function linea(x1, y1, x2, y2, w = 0.5, c = [0, 0, 0]) { d.setDrawColor(...c); d.setLineWidth(w); d.line(x1, y1, x2, y2); }
  // etiqueta + línea para escribir + valor
  function campo(etq, v, x, y, x2, o = {}) {
    const w = txt(etq, x, y, { size: o.size || 8, w: o.w });
    linea(x + w + 2, y + 1.5, x2, y + 1.5, 0.4);
    if (t(v)) dato(v, x + w + 4, y, { maxw: x2 - x - w - 6, size: o.vsize || 8.5 });
    return x + w;
  }
  function circulo(x, y, on, r = 2.6) {
    d.setDrawColor(0); d.setLineWidth(0.6); d.circle(x, y - r + 0.6, r, 'S');
    if (on) { d.setFillColor(...AZUL); d.circle(x, y - r + 0.6, r * 0.55, 'F'); }
  }
  function caja(x, y, on, s = 6) { d.setDrawColor(0); d.setLineWidth(0.6); d.rect(x, y - s + 0.8, s, s); if (on) { linea(x + 1, y - s + 1.8, x + s - 1, y - 0.2, 0.9, AZUL); linea(x + s - 1, y - s + 1.8, x + 1, y - 0.2, 0.9, AZUL); } }
  function opc(x, y, etq, on, o = {}) { (o.caja ? caja : circulo)(o.caja ? x - 3 : x, y, on); return txt(etq, x + 4.5, y, { size: o.size || 7.5 }) + 6; }
  function titulo(s, x1, x2, y) { // ________ TÍTULO ________
    F('s'); d.setFontSize(9); const w = d.getTextWidth(s), cx = (x1 + x2) / 2;
    linea(x1, y + 1.5, cx - w / 2 - 4, y + 1.5, 0.9); linea(cx + w / 2 + 4, y + 1.5, x2, y + 1.5, 0.9);
    txt(s, cx, y, { size: 9, w: 's', align: 'center' });
  }
  function parrafo(s, x1, y1, x2, y2, o = {}) {
    s = t(s).trim(); if (!s) return y1;
    let sz = o.size || 8; F(o.w); let ls;
    for (;;) { d.setFontSize(sz); ls = d.splitTextToSize(s, x2 - x1); if (ls.length * sz * 1.18 <= y2 - y1 || sz <= 5) break; sz -= 0.25; }
    d.setTextColor(...(o.c || AZUL)); d.text(ls, x1, y1 + sz * 0.9, { lineHeightFactor: 1.18 });
    return y1 + ls.length * sz * 1.18;
  }
  /* Texto sobre renglones fijos: el primero empieza en xPrimero (tras la etiqueta), los demás en x1. Achica la letra si no cabe. */
  function renglones(s, x1, xPrimero, yBase, x2, n, paso, size) {
    s = t(s).trim(); if (!s) return;
    let sz = size, ls;
    const partir = () => {
      F(); d.setFontSize(sz); const out = []; let ancho = x2 - xPrimero;
      s.split('\n').forEach((par) => {
        let cur = '';
        par.split(/\s+/).forEach((w) => { const prueba = cur ? cur + ' ' + w : w; if (d.getTextWidth(prueba) > ancho && cur) { out.push(cur); cur = w; ancho = x2 - x1; } else cur = prueba; });
        out.push(cur); ancho = x2 - x1;
      });
      return out;
    };
    for (;;) { ls = partir(); if (ls.length <= n || sz <= 5.5) break; sz -= 0.3; }
    d.setTextColor(...AZUL);
    ls.slice(0, n).forEach((l, i) => d.text(l, i ? x1 + 1 : xPrimero, yBase + i * paso));
  }
  function imagen(data, x, y, w, h, alinear = 'center') {
    if (!data) return;
    try { const p = d.getImageProperties(data); const k = Math.min(w / p.width, h / p.height); const iw = p.width * k, ih = p.height * k;
      const ix = alinear === 'left' ? x : x + (w - iw) / 2;
      d.addImage(data, p.fileType || 'PNG', ix, y + (h - ih) / 2, iw, ih, undefined, 'FAST'); } catch (e) { console.warn(e); }
  }
  function whatsapp(x, y, s = 4.2) { // burbuja con auricular, a la izquierda del número
    d.setDrawColor(0); d.setLineWidth(0.7); d.circle(x, y, s, 'S');
    d.setFillColor(255, 255, 255); d.triangle(x - s * 0.95, y + s * 1.25, x - s * 0.55, y + s * 0.55, x - s * 0.05, y + s * 0.95, 'F');
    linea(x - s * 0.95, y + s * 1.25, x - s * 0.62, y + s * 0.5, 0.7); linea(x - s * 0.95, y + s * 1.25, x - s * 0.15, y + s * 0.95, 0.7);
    d.setLineWidth(1.1); d.setLineCap('round');
    d.lines([[s * 0.2, s * 0.9, s * 0.8, s * 1.35, s * 1.15, s * 1.1]], x - s * 0.55, y - s * 0.5, [1, 1], 'S');
    d.setLineCap('butt');
  }
  /* Membrete: logo + nombre + especialidad + registros + teléfono (todo sale del perfil del médico) */
  function membrete(pf, x, y, w, o = {}) {
    const k = o.k || 1, logo = pf.marcaNegra || (window.IMGS && IMGS.marcaNegra);
    const lw = 62 * k; imagen(logo, x, y, lw, lw, 'left');
    const cx = x + lw + (w - lw) / 2 - 6 * k;
    const nom = t(pf.nombre || 'Dr. Nombre Apellido').toUpperCase();
    txt(nom, cx, y + 20 * k, { size: 19 * k, w: 'b', align: 'center', maxw: w - lw - 6 });
    txt(t(pf.especialidad || 'Anestesiología').toUpperCase(), cx, y + 36 * k, { size: 13 * k, w: 'b', align: 'center', maxw: w - lw - 6 });
    const reg = [pf.mpps ? ['MPPS: ', pf.mpps] : null, pf.colegio ? [(pf.colegioSigla || 'C.M.') + ': ', pf.colegio] : null, pf.rif ? ['RIF: ', pf.rif] : null].filter(Boolean);
    if (reg.length) { // etiquetas normales, números en negrita
      const piezas = []; reg.forEach((r, i) => { if (i) piezas.push([' - ', '']); piezas.push([r[0], '']); piezas.push([r[1], 'b']); });
      let tw = 0; piezas.forEach(([s, w]) => { F(w); d.setFontSize(7.6 * k); tw += d.getTextWidth(s); });
      let xx = cx - tw / 2; piezas.forEach(([s, w]) => { xx += txt(s, xx, y + 47 * k, { size: 7.6 * k, w }); });
    }
    if (pf.telefono) { F('b'); d.setFontSize(9.5 * k); const tw = d.getTextWidth(pf.telefono); whatsapp(cx - tw / 2 - 8 * k, y + 55.2 * k, 4 * k); txt(pf.telefono, cx - tw / 2 + 1, y + 58.5 * k, { size: 9.5 * k, w: 'b' }); }
    if (pf.direccion && o.dir !== false) txt(pf.direccion, cx, y + 67.5 * k, { size: 6.8 * k, align: 'center', maxw: w - lw - 6, c: [60, 60, 60] });
  }
  function firma(pf, v, x, y, w, h) {
    const fs = v.firmaSello || (pf.usarEscaneo !== false ? pf.firmaSello : ''), fd = v.firma || pf.firma;
    if (fs) imagen(fs, x + 4, y + 2, w - 8, h - 6);
    if (fd) imagen(fd, x + w * 0.25, y + h * 0.15, w * 0.6, h * 0.6);
  }

  /* ---------- Valoración preanestésica (carta vertical) ---------- */
  function pdfValoracion(v, pf) {
    calcular(v);
    d = new jspdf.jsPDF({ unit: 'pt', format: 'letter' }); conM = fuentes();
    const X1 = 40, X2 = 572, p = v.p || {}, e = v.ef || {};
    membrete(pf, X1 + 6, 22, X2 - X1 - 90, { dir: true });
    txt('VALORACIÓN PREANESTÉSICA', X2, 30, { size: 7, w: 's', align: 'right', c: [90, 90, 90] });
    const fch = fechaTxt(v.fecha).split('/');
    txt('Fecha:', X2 - 92, 96, { size: 8.5 });
    linea(X2 - 64, 97.5, X2, 97.5, 0.4); if (v.fecha) dato(fch.join(' / '), X2 - 32, 96, { align: 'center', size: 8 }); else txt('/       /', X2 - 32, 96, { align: 'center', size: 8 });
    let y = 112;
    campo('Nombre y Apellido:', p.nombre, X1, y, 410); campo('CI:', p.ci, 418, y, X2); y += 13;
    // Sexo · Edad · Peso · Talla · IMC · Ocupación
    txt('Sexo:', X1, y, {}); caja(X1 + 25, y, p.sexo === 'M'); txt('M', X1 + 33, y); caja(X1 + 43, y, p.sexo === 'F'); txt('F.', X1 + 51, y);
    campo('Edad:', p.edad, X1 + 62, y, X1 + 110); txt('años', X1 + 112, y);
    campo('Peso:', p.peso, X1 + 134, y, X1 + 178); txt('Kg', X1 + 180, y);
    campo('Talla:', p.talla, X1 + 195, y, X1 + 240); txt('m', X1 + 242, y);
    campo('IMC:', isFinite(v._imc) ? r1(v._imc) : '', X1 + 254, y, X1 + 296); txt('Kg/m2', X1 + 298, y);
    campo('Ocupación:', p.ocup, X1 + 330, y, X2); y += 13;
    campo('Diagnóstico:', p.dx, X1, y, X2); y += 13;
    campo('Procedimiento a realizar:', p.proc, X1, y, 400); campo('Médico tratante:', p.tratante, 406, y, X2); y += 13;
    // Nuevo: fecha de la cirugía, carácter y riesgo hemorrágico
    campo('Fecha de cirugía:', fechaTxt(p.fechaCx), X1, y, 170);
    let xx = X1 + 178; xx += txt('Cirugía:', xx, y) + 6; xx += opc(xx, y, 'Electiva', p.urg === 'no') + 3; xx += opc(xx, y, 'Urgencia', p.urg === 'si') + 12;
    xx += txt('Riesgo hemorrágico:', xx, y) + 6; [['minimo', 'Mínimo'], ['bajo', 'Bajo-moderado'], ['alto', 'Alto']].forEach(([k, s]) => { xx += opc(xx, y, s, p.riesgoHem === k) + 3; });
    y += 14;
    titulo('ANTECEDENTES PERSONALES', X1, X2, y); y += 10;
    const ant = v.ant || {}, cols = [X1 + 2, X1 + 76, X1 + 162, X1 + 228, X1 + 296, X1 + 376, X1 + 454];
    ANT.forEach(([k, s], i) => { const c = i % 6, f = Math.floor(i / 6); opc(cols[c], y + f * 9, s, !!ant[k], { size: 6.6 }); });
    txt('OTROS:', cols[6] + 6, y, { size: 6.6 });
    const otros = (v.antOtros || '').split('\n');
    // agregados: 5.ª fila en las mismas columnas, para que los círculos queden alineados
    ANT_EXTRA.forEach(([k, , corto], c) => opc(cols[c], y + 36, corto, !!ant[k], { size: 6.6 }));
    [0, 1, 2, 3, 4].forEach((f) => { if (f) circulo(cols[6], y + f * 9, !!otros[f - 1]); linea(cols[6] + (f ? 6 : 34), y + f * 9 + 1.2, X2, y + f * 9 + 1.2, 0.4); });
    otros.slice(0, 4).forEach((s, i) => dato(s, cols[6] + 8, y + (i + 1) * 9, { size: 6.8, maxw: X2 - cols[6] - 10 }));
    y += 48;
    campo('Quirúrgicos:', '', X1, y, X2); parrafo(v.quir, X1 + 52, y - 8, X2, y + 2, { size: 8 }); y += 12;
    campo('Anestésicos:', '', X1, y, X2); parrafo(v.anest, X1 + 54, y - 8, X2, y + 2, { size: 8 }); y += 12;
    xx = X1 + txt('Complicaciones:', X1, y) + 5; xx += opc(xx, y, 'Sí', v.compl === 'si') + 4; xx += opc(xx, y, 'No', v.compl === 'no') + 6;
    campo('Cual:', v.complCual, xx, y, X2); y += 12;
    campo('Alergias:', v.alergias, X1, y, X2); y += 12;
    const h = v.hpb || {};
    xx = X1 + txt('HPB:', X1, y) + 5; xx += opc(xx, y, 'Tabáquico', !!h.tab) + 4; const xi = xx; xx = campo('IPA:', h.ipa, xx, y, xx + 48); xx = xi + 54;
    [['etil', 'Etílico', 88], ['chim', 'Chimóico', 90], ['caf', 'Caféico', 72]].forEach(([k, s, ancho]) => { const x0 = xx; xx += opc(xx, y, s, !!h[k]); linea(xx, y + 1.5, x0 + ancho, y + 1.5, 0.4); if (h[k + 'Txt']) dato(h[k + 'Txt'], xx + 2, y, { size: 7.5, maxw: x0 + ancho - xx - 3 }); xx = x0 + ancho + 4; });
    xx += opc(xx, y, 'Otro:', !!h.otro); linea(xx, y + 1.5, X2, y + 1.5, 0.4); if (h.otroTxt) dato(h.otroTxt, xx + 2, y, { size: 7.5, maxw: X2 - xx - 3 }); y += 13;
    // Tratamiento actual con conciliación preoperatoria
    const meds = (v.meds || []).filter((m) => t(m.n).trim());
    const wT = txt('Tratamiento Actual:', X1, y); txt(meds.length ? 'conducta preoperatoria (cirugía sin neuroeje; con neuroeje aplicar ASRA 2025)' : '', X1 + wT + 5, y, { size: 6.5, c: [90, 90, 90] });
    y += 3;
    if (meds.length) {
      meds.slice(0, 8).forEach((m) => {
        y += 9.6; txt('•', X1 + 2, y, { size: 8 }); dato(t(m.n) + (m.dosis ? ' ' + m.dosis : ''), X1 + 8, y, { size: 7.6, maxw: 172, w: 's' });
        dato(indicacion(m, v), X1 + 186, y, { size: 7.2, maxw: X2 - X1 - 186 }); linea(X1, y + 2, X2, y + 2, 0.2, [180, 180, 180]);
      });
      y += 5;
    } else { linea(X1 + wT + 3, y - 1.5, X2, y - 1.5, 0.4); y += 10; linea(X1, y, X2, y, 0.4); renglones(v.trat, X1, X1 + wT + 5, y - 13, X2, 2, 10, 8); y += 3; }
    // Riesgo (nuevo)
    y += 9;
    const rie = [];
    rie.push(['Cap. funcional:', v.mets === 'mas' ? '≥ 4 METs' : v.mets === 'menos' ? '< 4 METs' : '']);
    const hayP = t(p.edad) || t(p.peso) || t(p.sexo);
    const haySB = hayP || Object.keys(v.sb || {}).length, hayRC = Object.keys(v.rcri || {}).length || v.rcriEval;
    rie.push(['STOP-BANG:', haySB ? v._sb + '/8' + (v._sb >= 5 ? ' alto' : v._sb >= 3 ? ' interm.' : ' bajo') : '']);
    rie.push(['RCRI (Lee):', hayRC || hayP ? v._rcri + ' · ' + RCRI_RIESGO[Math.min(v._rcri, 3)] : '']);
    rie.push(['ClCr:', isFinite(v._clcr) ? Math.round(v._clcr) + ' mL/min' : '']);
    if (p.sexo === 'F') rie.push(['FUM:', fechaTxt(v.fum) || t(v.fumTxt)]);
    xx = X1; rie.forEach(([a, b]) => { xx += txt(a, xx, y, { size: 7.6, w: 's' }) + 2; xx += (b ? dato(b.replace('≥', '>='), xx, y, { size: 7.6 }) : (linea(xx, y + 1.5, xx + 30, y + 1.5, 0.4), 30)) + 10; });
    y += 14;
    titulo('EXAMEN FÍSICO', X1, X2, y); y += 5;
    // Mallampati con imágenes
    const mall = ['I', 'II', 'III', 'IV'];
    mall.forEach((m, i) => { const x0 = X1 + i * 36; imagen(IMGS['mall' + (i + 1)], x0 + 7, y + 3, 26, 32); txt(m, x0 + 1, y + 8, { size: 6.5, w: 's' }); if (e.mallampati === m) { d.setDrawColor(...AZUL); d.setLineWidth(1.2); d.roundedRect(x0 + 4, y + 1, 32, 36, 3, 3, 'S'); } });
    // Tabla vía aérea
    const vx = X1 + 150, vc = ['DII', 'DTM', 'DEM', 'PM', 'BHD', 'CC'], vk = ['dii', 'dtm', 'dem', 'pm', 'bhd', 'cc'], cw = 23;
    d.setFillColor(0); d.rect(vx, y + 4, cw * 6, 11, 'F');
    vc.forEach((s, i) => { txt(s, vx + i * cw + cw / 2, y + 12, { size: 6.2, w: 'b', c: [255, 255, 255], align: 'center' }); d.setDrawColor(0); d.setLineWidth(0.6); d.rect(vx + i * cw, y + 15, cw, 14); dato(e[vk[i]], vx + i * cw + cw / 2, y + 25, { size: 7.5, align: 'center', maxw: cw - 2 }); });
    const ox = vx + cw * 6 + 12, ow = 17, ob = v._obese;
    d.setFillColor(0); d.rect(ox, y + 4, ow * 5, 11, 'F');
    [['o', 'O'], ['b', 'B'], ['e', 'E'], ['s', 'S'], ['e2', 'E']].forEach(([k, s], i) => { txt(s, ox + i * ow + ow / 2, y + 12, { size: 6.5, w: 'b', c: [255, 255, 255], align: 'center' }); d.rect(ox + i * ow, y + 15, ow, 14); if (ob[k]) dato('X', ox + i * ow + ow / 2, y + 25, { size: 8, align: 'center', w: 'b' }); });
    const lx = ox + ow * 5 + 10;
    d.setDrawColor(0); d.setLineWidth(0.8); d.rect(lx, y + 4, 58, 26); txt('LANGERON:', lx + 29, y + 13, { size: 7, align: 'center' }); if (hayP || Object.keys(e.obese || {}).length) dato(v._langeron + ' / V', lx + 29, y + 25, { size: 9, align: 'center', w: 's' }); else txt('/ V', lx + 29, y + 25, { size: 8, align: 'center' });
    const vadx = lx + 64; d.rect(vadx, y + 4, X2 - vadx, 26); txt('PROBABLE VAD:', vadx + (X2 - vadx) / 2, y + 13, { size: 6.8, align: 'center' });
    circulo(vadx + 12, y + 25, e.vad === 'si'); txt('SI', vadx + 17, y + 25, { size: 7 }); circulo(vadx + 38, y + 25, e.vad === 'no'); txt('NO', vadx + 43, y + 25, { size: 7 });
    y += 48;
    // Signos vitales
    xx = X1; xx += txt('SIGNOS VITALES:', xx, y, { size: 8.5, w: 'b' }) + 8;
    const sv = (etq, val, ancho, u) => { xx += txt(etq, xx, y, { size: 8.5, w: 'b' }); linea(xx + 1, y + 1.5, xx + ancho, y + 1.5, 0.4); if (val) dato(val, xx + ancho / 2, y, { align: 'center', size: 8.5 }); xx += ancho + 2; if (u) xx += txt(u, xx, y, { size: 8 }) + 12; };
    sv('TA:', e.ta, 58, 'mmHg'); sv('FC:', e.fc, 26, 'lpm.'); sv('FR:', e.fr, 22, 'rpm.'); sv('SpO2:', e.spo2, 22, '%');
    y += 12;
    campo('Condiciones:', e.cond, X1, y, X2); y += 11.5;
    campo('Cabeza y cuello:', e.cabeza, X1, y, X2); y += 11.5;
    campo('ORL:', e.orl, X1, y, 320);
    xx = 326; xx += txt('Piezas Dentarias:', xx, y) + 3; xx += opc(xx, y, 'Normal.', e.dientes === 'normal') + 2; xx += txt('Ausencia:', xx, y) + 3;
    xx += opc(xx, y, 'Parcial', e.dientes === 'parcial') + 2; xx += opc(xx, y, 'Total', e.dientes === 'total') + 2; opc(xx, y, 'Prótesis', !!e.protesis); y += 11.5;
    campo('Tórax:', e.torax, X1, y, X2); y += 11.5;
    campo('Abdomen:', e.abd, X1, y, X2); y += 11.5;
    xx = X1 + txt('Columna Vertebral: Tipo de Espalda:', X1, y) + 6; ['1', '2', '3'].forEach((n) => { xx += opc(xx, y, n, e.espalda === n) + 4; }); campo('', e.columna, xx + 4, y, X2); y += 11.5;
    campo('Extremidades:', e.ext, X1, y, X2); y += 11.5;
    campo('Neurológico:', e.neuro, X1, y, X2); y += 13;
    titulo('LABORATORIOS', X1, X2, y); y += 5;
    const LC = [['fecha', 'FECHA'], ['hgb', 'HGB'], ['hct', 'HCT'], ['pla', 'PLA'], ['gb', 'GB'], ['neu', 'NEU'], ['glic', 'GLIC'], ['urea', 'UREA'], ['crea', 'CREA'], ['tp', 'TP'], ['tpt', 'TPT'], ['inr', 'INR'], ['hiv', 'HIV'], ['vdrl', 'VDRL'], ['otros', 'OTROS']];
    const lw = (X2 - X1) / LC.length, labs = (v.lab || []).filter((l) => Object.values(l).some((x) => t(x).trim()));
    const nf = Math.max(1, Math.min(3, labs.length));
    d.setFillColor(0); d.rect(X1, y, X2 - X1, 10, 'F');
    LC.forEach(([k, s], i) => { txt(s, X1 + i * lw + lw / 2, y + 7, { size: 5.8, w: 'b', c: [255, 255, 255], align: 'center' }); });
    for (let f = 0; f < nf; f++) LC.forEach(([k], i) => { d.setDrawColor(0); d.setLineWidth(0.5); d.rect(X1 + i * lw, y + 10 + f * 11, lw, 11); const l = labs[f]; if (l && t(l[k])) dato(k === 'fecha' ? fechaTxt(l[k]).slice(0, 5) : l[k], X1 + i * lw + lw / 2, y + 18 + f * 11, { size: 6.8, align: 'center', maxw: lw - 2 }); });
    y += 10 + nf * 11 + 11;
    const cv = v.cv || {};
    xx = X1; xx += txt('Val. CV:[', xx, y); dato(fechaTxt(cv.fecha) || '     /     /     ', xx + 1, y, { size: 7.5 }); xx += 44; xx += txt(']', xx, y) + 2;
    xx = campo('ASA:', cv.asa, xx, y, xx + 44) + 30; xx = campo('GOLDMAN:', cv.goldman, xx + 4, y, xx + 78) + 34; xx = campo('Riesgo TEP:', cv.tep, xx + 8, y, xx + 88) + 34; campo('EKG:', cv.ekg, xx + 12, y, X2); y += 11;
    campo('Rx Tórax:', v.rx, X1, y, X2); y += 11;
    campo('Sugerencias:', v.sug, X1, y, X2); y += 11;
    campo('EcoTT:', v.eco, X1, y, X2); y += 11;
    campo('Val. Neumo/Endocrino:', v.neumo, X1, y, X2); y += 11;
    campo('Otros:', v.otros, X1, y, X2); y += 12;
    const wS = txt('Sugerencias/Indicaciones:', X1, y);
    const ind = [t(v.indic).trim()].concat((v.indicSel || []).map((i) => SUGERENCIAS[i]).filter(Boolean)).filter(Boolean).join('\n');
    for (let f = 0; f < 4; f++) linea(f ? X1 : X1 + wS + 3, y + 1.5 + f * 10, X2, y + 1.5 + f * 10, 0.4);
    renglones(ind, X1, X1 + wS + 5, y, X2, 4, 10, 7.8);
    y += 44;
    xx = campo('ASA:', v.asa, X1, y, X1 + 60, { w: 'b' }); xx = campo('Plan Anestésico:', v.plan, X1 + 66, y, 420, { w: 'b' });
    xx = 426 + txt('Plan Analgésico:', 426, y, { w: 'b' }) + 5; const an = v.analg || {};
    xx += opc(xx, y, 'EV', !!an.ev) + 2; xx += opc(xx, y, 'Peri', !!an.peri) + 2; opc(xx, y, 'Reg', !!an.reg);
    y += 11;
    const wC = txt('Consentimiento Informado:', X1, y, { size: 6.8, w: 'b' }); txt('El Plan Anestésico, opciones, riesgos y beneficios asociados, me han sido explicados y los entiendo.', X1 + wC + 3, y, { size: 6.8, maxw: X2 - X1 - wC - 3 });
    // Firmas
    const yf = y + 32;
    [[X1 + 20, 'PACIENTE'], [X1 + 150, 'TESTIGO']].forEach(([x0, s]) => { linea(x0, yf, x0 + 112, yf, 0.5); txt('Firma y C.I ', x0, yf + 8, { size: 6.2 }); txt(s, x0 + 36, yf + 8, { size: 6.2, w: 'b' }); });
    linea(X1 + 60, yf + 30, X1 + 240, yf + 30, 0.5); txt('Firma y C.I ', X1 + 60, yf + 38, { size: 6.2 }); txt('REPRESENTANTE LEGAL', X1 + 96, yf + 38, { size: 6.2, w: 'b' });
    const bx = 392, by = y + 6, bw = X2 - bx - 12, bh = 792 - 30 - by - 12;
    d.setDrawColor(0); d.setLineWidth(0.7); d.rect(bx, by, bw, bh);
    firma(pf, v, bx, by, bw, bh);
    txt((pf.especialidad ? t(pf.especialidad) : 'Anestesiólogo').toUpperCase(), bx + bw / 2, by + bh + 9, { size: 7, w: 'b', align: 'center' });
    return d;
  }

  /* ---------- Récipe: media carta apaisada (8,5 × 5,5 in) · Rp a la izquierda, indicaciones a la derecha ---------- */
  function pdfRecipe(r, pf) {
    d = new jspdf.jsPDF({ unit: 'pt', format: [612, 396], orientation: 'landscape' }); conM = fuentes();
    const W = 612, H = 396, M = 18;
    const items = (r.items || []).filter((i) => t(i.med).trim());
    const logo = pf.marcaNegra || (window.IMGS && IMGS.marcaNegra);
    [0, 1].forEach((lado) => {
      const x0 = lado * W / 2 + M, x1 = (lado + 1) * W / 2 - M, w = x1 - x0;
      if (logo && d.GState) { // marca de agua muy tenue
        try { d.saveGraphicsState(); d.setGState(new d.GState({ opacity: 0.05 })); imagen(logo, x0 + w / 2 - 80, 150, 160, 160); d.restoreGraphicsState(); } catch (e) { /* sin transparencia */ }
      }
      membrete(pf, x0, M - 2, w, { k: 0.62, dir: true });
      linea(x0, M + 48, x1, M + 48, 0.8);
      let y = M + 61;
      campo('Paciente:', r.p && r.p.nombre, x0, y, x1 - 88, { size: 7.5, vsize: 8 }); campo('Fecha:', fechaTxt(r.fecha), x1 - 84, y, x1, { size: 7.5, vsize: 8 }); y += 12;
      campo('CI:', r.p && r.p.ci, x0, y, x0 + 110, { size: 7.5, vsize: 8 }); campo('Edad:', r.p && r.p.edad ? r.p.edad + ' años' : '', x0 + 116, y, x0 + 180, { size: 7.5, vsize: 8 });
      campo('Peso:', r.p && r.p.peso ? r.p.peso + ' kg' : '', x0 + 186, y, x1, { size: 7.5, vsize: 8 });
      y += 16;
      if (lado === 0) { // Rp/
        // ℞: R con el trazo cruzado en la pierna
        F('b'); d.setFontSize(24); d.setTextColor(0); d.text('R', x0, y + 12);
        const rw = d.getTextWidth('R'); linea(x0 + rw * 0.55, y + 16, x0 + rw * 1.2, y + 6, 1.8);
        txt('p/', x0 + rw + 5, y + 12, { size: 13, w: 'b' });
        y += 28;
        items.forEach((it, i) => {
          dato((i + 1) + '. ' + t(it.med), x0 + 6, y, { size: 9, w: 's', maxw: w - 70 });
          if (it.cant) dato(t(it.cant), x1, y, { size: 8.5, align: 'right' });
          y += 16;
        });
      } else {
        txt('INDICACIONES', x0 + w / 2, y + 6, { size: 10.5, w: 'b', align: 'center', cs: 1.2 });
        y += 20;
        items.forEach((it, i) => {
          if (!t(it.ind).trim()) return;
          y = parrafo((i + 1) + '. ' + t(it.med).split(/\s+\d/)[0] + ': ' + t(it.ind), x0 + 4, y - 7, x1, y + 30, { size: 8.3 }) + 9;
        });
        if (t(r.gen).trim()) { y = parrafo(r.gen, x0 + 4, y - 3, x1, H - 92, { size: 8.3 }) + 4; }
        if (r.control) dato('Próximo control: ' + r.control, x0 + 4, Math.min(y + 8, H - 84), { size: 8.3, w: 's' });
      }
      // firma y sello
      const fy = H - 78; firma(pf, r, x1 - 150, fy - 6, 150, 56);
      linea(x1 - 140, fy + 50, x1 - 10, fy + 50, 0.5); txt('Firma y sello', x1 - 75, fy + 58, { size: 6.5, align: 'center' });
      if (pf.direccion) txt(pf.direccion, x0, H - 12, { size: 6, c: [90, 90, 90], maxw: w - 4 });
      if (lado === 0 && r.valido) txt('Válido por ' + r.valido + ' a partir de la fecha de emisión', x0, H - 24, { size: 6.5, w: 's', c: [60, 60, 60] });
    });
    d.setLineDashPattern([3, 3], 0); linea(W / 2, 8, W / 2, H - 8, 0.4, [150, 150, 150]); d.setLineDashPattern([], 0);
    return d;
  }

  return { ANT, ANT_EXTRA, MEDS, ACC, RCRI, RCRI_RIESGO, SB, SUGERENCIAS, calcular, indicacion, ultimaDosis, fechaTxt, pdfValoracion, pdfRecipe };
})();
