/* Historia de Anestesia digital — lógica de la interfaz */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const ahoraHM = (redondeo) => {
    const d = new Date(); let m = d.getHours() * 60 + d.getMinutes();
    if (redondeo) m = Math.floor(m / redondeo) * redondeo;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  const num = (v) => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); };
  const fmt = (n, d = 0) => (isFinite(n) ? (Math.round(n * 10 ** d) / 10 ** d).toString() : '');

  function getP(o, path) { return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
  function setP(o, path, v) {
    const ks = path.split('.'); let a = o;
    for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[ks[i]]; }
    a[ks[ks.length - 1]] = v;
  }

  /* ---------- Configuración ---------- */
  const FILAS_BASE = ['O2 % L/min', 'N2O / Aire', 'Inhalatorio', 'Opioide', 'Relaj. musc.', 'Droga', 'Droga',
    'VC # YI SC D/I', 'VP # M Sup/Inf D/I', 'VP # M Sup/Inf D/I', 'Otro'];
  const EKG = ['RS', 'AS', 'RNS', 'TS', 'BS'];
  const VOLEMIA = [
    ['70', 'Adulto hombre (70 ml/kg)'], ['65', 'Adulta mujer (65 ml/kg)'], ['60', 'Adulto mayor (60 ml/kg)'],
    ['50', 'Obeso (50 ml/kg)'], ['75', 'Niño 1–12 años (75 ml/kg)'], ['80', 'Lactante (80 ml/kg)'],
    ['85', 'Recién nacido a término (85 ml/kg)'], ['95', 'Prematuro (95 ml/kg)'],
  ];
  let cfg = Store.config();
  if (!cfg) {
    cfg = {
      sedes: [{ id: 'hcuamp', nombre: 'HOSPITAL CENTRAL UNIVERSITARIO DR. ANTONIO MARÍA PINEDA', sub: 'BARQUISIMETO, EDO. LARA', logo: '' }],
      sedeActual: 'hcuamp',
      perfil: { nombre: '', sello: '', firma: '' },
    };
    Store.guardarConfig(cfg);
  }
  // Lugares de trabajo de Antonio (se agregan una sola vez; se pueden editar o borrar en "Lugares de trabajo")
  const SEDES_PRE = [
    ['llanosalud', 'LLANOSALUD A.P.S. C.A.', 'CABUDARE, EDO. LARA'],
    ['ieq', 'INSTITUTO DE ESPECIALIDADES QUIRÚRGICAS CENTRO DEL ESTE (IEQ)', 'AV. LARA, BARQUISIMETO, EDO. LARA'],
    ['idb-centro', 'INSTITUTO DIAGNÓSTICO BARQUISIMETO · IDB CENTRO', 'BARQUISIMETO, EDO. LARA'],
    ['idb-cabudare', 'INSTITUTO DIAGNÓSTICO BARQUISIMETO · IDB CABUDARE', 'CABUDARE, EDO. LARA'],
    ['idb-sanfelipe', 'INSTITUTO DIAGNÓSTICO BARQUISIMETO · IDB SAN FELIPE', 'SAN FELIPE, EDO. YARACUY'],
    ['cemedproca', 'CENTRO MÉDICO LOS PRÓCERES (CEMEDPROCA)', 'GUANARE, EDO. PORTUGUESA'],
    ['buenavida', 'CENTRO MÉDICO BUENA VIDA', 'BARQUISIMETO, EDO. LARA'],
  ];
  if (!cfg.sedesV2) {
    SEDES_PRE.forEach(([id, nombre, sub]) => { if (!cfg.sedes.some((x) => x.id === id)) cfg.sedes.push({ id, nombre, sub, logo: '' }); });
    cfg.sedesV2 = true; Store.guardarConfig(cfg);
  }
  // El símbolo que venía en la hoja es la marca personal de Antonio, no el logo del hospital:
  // se quita de los lugares de trabajo y pasa al perfil como marca de agua.
  if (cfg.sedes.some((s) => s.logo === IMGS.logoHC)) { cfg.sedes.forEach((s) => { if (s.logo === IMGS.logoHC) s.logo = ''; }); Store.guardarConfig(cfg); }
  const sede = (id) => cfg.sedes.find((s) => s.id === id) || cfg.sedes[0] || { nombre: '', sub: '', logo: '' };

  function nuevaHistoria() {
    return {
      id: uid(), creado: Date.now(), modificado: Date.now(), sedeId: cfg.sedeActual || (cfg.sedes[0] && cfg.sedes[0].id),
      p: { fecha: hoyISO(), tipoVol: '70' },
      anest: cfg.perfil.nombre || '',
      gcs: {}, chk: {}, coad: {}, ind: { meds: ['', '', '', '', '', ''] }, tec: {}, ga: {},
      va: { asist: {}, razon: {} }, reg: {}, cond: {},
      bal: { cris: [], colo: [], hemo: [], pins: [], sang: [], diur: [], cols: ['1ª h', '2ª h', '3ª h', '4ª h'] },
      ab: { horas: [], ph: [], pco2: [], hco3: [], po2: [], nak: [], lact: [] },
      rev: {}, sap: {}, tras: {}, inf: [],
      firma: cfg.perfil.usarEscaneo !== false && cfg.perfil.firmaSello ? '' : (cfg.perfil.firma || ''),
      firmaSello: cfg.perfil.usarEscaneo !== false ? (cfg.perfil.firmaSello || '') : '',
      sello: cfg.perfil.sello || (cfg.perfil.datosBajoFirma !== false ? Cuenta.componerSello(cfg.perfil) : ''),
      to: { inicio: '', t: {}, base: {}, filas: FILAS_BASE.map(() => ''), regs: [], pistas: Pistas.asegurar({ to: {} }) },
    };
  }

  /* ---------- Estado ---------- */
  let H = null;            // historia abierta
  let pantalla = 'inicio';
  const VERSION = '1.9.11';
  let seccion = 0;
  let timerGuardar = null;

  function aviso(t, ms = 2200) {
    const a = $('#aviso'); a.textContent = t; a.hidden = false;
    clearTimeout(aviso._t); aviso._t = setTimeout(() => (a.hidden = true), ms);
  }
  function guardarPronto() {
    $('#estadoGuardado').textContent = 'Guardando…';
    clearTimeout(timerGuardar);
    timerGuardar = setTimeout(guardarYa, 500);
  }
  function guardarYa() {
    clearTimeout(timerGuardar); timerGuardar = null;
    if (!H) return;
    const ok = Store.guardar(H);
    const e = $('#estadoGuardado');
    if (e) e.textContent = ok ? 'Guardado ' + new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '⚠ No se pudo guardar';
  }

  /* ---------- Componentes de formulario (HTML) ---------- */
  let D = null; // documento de Extras abierto (valoración o récipe)
  const obj = () => (pantalla === 'doc' ? D : H);
  const val = (k) => { const v = getP(obj(), k); return v == null ? '' : v; };
  function T(k, etq, o = {}) {
    const tipo = o.tipo || 'text';
    const im = o.num ? ' inputmode="decimal"' : '';
    const inp = `<input type="${tipo}" data-k="${k}" value="${esc(val(k))}"${im}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
    return `<label class="campo${o.full ? ' completo' : ''}${o.calc ? ' calc' : ''}"><span>${etq}</span>${o.u ? `<div class="con-unidad">${inp}<em>${o.u}</em></div>` : inp}</label>`;
  }
  const Nm = (k, etq, u, o = {}) => T(k, etq, Object.assign({ num: true, u }, o));
  function TA(k, etq, o = {}) {
    return `<label class="campo completo"><span>${etq}</span><textarea data-k="${k}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} style="${o.alto ? 'min-height:' + o.alto + 'px' : ''}">${esc(val(k))}</textarea></label>`;
  }
  function SEL(k, etq, ops, o = {}) {
    return `<label class="campo${o.full ? ' completo' : ''}"><span>${etq}</span><select data-k="${k}">${ops.map(([v, t]) => `<option value="${esc(v)}"${String(val(k)) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  }
  function R(k, etq, ops, imgs) {
    const cur = val(k);
    return `<div class="grupo">${etq ? `<div class="etq">${etq}</div>` : ''}<div class="opciones">${ops.map((op, i) => {
      const [v, t] = Array.isArray(op) ? op : [op, op];
      const im = imgs ? `<img src="${imgs[i]}" alt="">` : '';
      return `<button type="button" class="opcion${imgs ? ' img' : ''}${cur === v ? ' sel' : ''}" data-r="${k}" data-v="${esc(v)}">${im}${esc(t)}</button>`;
    }).join('')}</div></div>`;
  }
  function C(k, etq, det) {
    const d = det ? `<span class="det"><input type="text" data-k="${det.k}" value="${esc(val(det.k))}" placeholder="${esc(det.ph || '')}"${det.num ? ' inputmode="decimal"' : ''}>${det.u ? `<em>${det.u}</em>` : ''}</span>` : '';
    return `<div class="check"><input type="checkbox" id="c_${k}" data-k="${k}"${val(k) ? ' checked' : ''}><label for="c_${k}">${etq}</label>${d}</div>`;
  }
  const card = (tit, cuerpo) => `<section class="tarjeta"><h2>${tit}</h2>${cuerpo}</section>`;
  const rej = (x, ancha) => `<div class="rejilla${ancha ? ' ancha' : ''}">${x}</div>`;

  /* ---------- Fórmulas de pérdidas máximas permisibles ---------- */
  const FORM_PMP = {
    rapida: { t: 'Rápida (× 3 ÷ 100)', corto: 'rápida', eq: 'PMP = Volemia × 3 × (Hto − Hto mín.) ÷ 100',
      f: (v, hi, hf) => (v * 3 * (hi - hf)) / 100, num: (v, hi, hf) => `${v} × 3 × (${hi} − ${hf}) ÷ 100` },
    clasica: { t: 'Clásica', corto: 'clásica', eq: 'PMP = Volemia × (Hto − Hto mín.) ÷ Hto',
      f: (v, hi, hf) => (v * (hi - hf)) / hi, num: (v, hi, hf) => `${v} × (${hi} − ${hf}) ÷ ${hi}` },
    gross: { t: 'Gross (Hto promedio)', corto: 'Gross', eq: 'PMP = Volemia × (Hto − Hto mín.) ÷ [(Hto + Hto mín.) ÷ 2]',
      f: (v, hi, hf) => (v * (hi - hf)) / ((hi + hf) / 2), num: (v, hi, hf) => `${v} × (${hi} − ${hf}) ÷ [(${hi} + ${hf}) ÷ 2]` },
    log: { t: 'Logarítmica', corto: 'logarítmica', eq: 'PMP = Volemia × ln(Hto ÷ Hto mín.)',
      f: (v, hi, hf) => v * Math.log(hi / hf), num: (v, hi, hf) => `${v} × ln(${hi} ÷ ${hf})` },
  };
  /* ---------- Cálculos ---------- */
  function calcular() {
    const p = H.p;
    const peso = num(p.peso), talla = num(p.talla), hto = num(p.hto), f = num(p.tipoVol);
    const htoMin = isFinite(num(p.htoMin)) ? num(p.htoMin) : num(cfg.perfil.htoMin) || 30; // Hto mínimo (perfil o 30 %)
    if (!p.formPmp) p.formPmp = cfg.perfil.formPmp || 'rapida';
    const volCalc = peso * f, volManual = num(p.volemia);
    const vol = isFinite(volManual) ? volManual : volCalc;
    p._imc = isFinite(peso) && isFinite(talla) && talla > 0 ? fmt(peso / Math.pow(talla / 100, 2), 1) : '';
    p._volemia = isFinite(volCalc) ? fmt(volCalc) : '';
    p._volEq = isFinite(volManual) ? `Volemia = ${fmt(volManual)} ml (valor escrito a mano)` :
      `Volemia = peso × ml/kg = ${isFinite(peso) ? fmt(peso, 1) : '?'} kg × ${isFinite(f) ? f : '?'} ml/kg${isFinite(volCalc) ? ' = ' + fmt(volCalc) + ' ml' : ''}`;
    const PMPF = FORM_PMP[p.formPmp] || FORM_PMP.rapida;
    let pmp = NaN;
    const V = isFinite(vol) ? fmt(vol) : 'Volemia', Hi = isFinite(hto) ? fmt(hto, 1) : 'Hto', Hf = fmt(htoMin, 1);
    if (isFinite(vol) && isFinite(hto) && hto > 0) pmp = hto <= htoMin ? 0 : PMPF.f(vol, hto, htoMin);
    p._pmpEq = PMPF.eq + '\n' + 'PMP = ' + PMPF.num(V, Hi, Hf) + (isFinite(pmp) ? ' = ' + fmt(pmp) + ' ml' : '') +
      (isFinite(hto) && hto <= htoMin ? '\n(El Hto ya está en el mínimo o por debajo: no hay margen de pérdida.)' : '');
    p._pmp = isFinite(pmp) ? fmt(pmp) : '';
    p._htoMin = htoMin;
    const g = H.gcs; const s = num(g.ro) + num(g.rv) + num(g.rm);
    g._total = isFinite(s) ? String(s) : '';
    // Balance
    const b = H.bal; const tot = [];
    let acum = 0;
    for (let c = 0; c < 4; c++) {
      const v = (r) => { const n = num((b[r] || [])[c]); return isFinite(n) ? n : 0; };
      const hay = (r) => isFinite(num((b[r] || [])[c]));
      const ing = v('cris') + v('colo') + v('hemo'), egr = v('pins') + v('sang') + v('diur');
      const alguno = ['cris', 'colo', 'hemo', 'pins', 'sang', 'diur'].some(hay);
      acum += ing - egr;
      tot.push(alguno ? { ing, egr, bal: ing - egr, acum } : null);
    }
    b._tot = tot;
    b._hay = tot.some(Boolean);
    b._ti = tot.reduce((a, x) => a + (x ? x.ing : 0), 0);
    b._te = tot.reduce((a, x) => a + (x ? x.egr : 0), 0);
    b._bal = b._ti - b._te;
  }
  function refrescarCalculos() {
    calcular();
    $$('[data-calc]').forEach((el) => {
      const v = getP(H, el.dataset.calc);
      if (el.tagName === 'INPUT') el.value = v == null ? '' : v; else el.textContent = v == null ? '' : v;
    });
    const tb = $('#tablaBalance'); if (tb) pintarTotalesBalance();
  }

  /* ---------- Secciones ---------- */
  const SECCIONES = [
    { id: 'pac', t: 'Paciente', r: secPaciente },
    { id: 'val', t: 'Valoración', r: secValoracion },
    { id: 'pre', t: 'Preparación', r: secPreparacion },
    { id: 'ind', t: 'Inducción y técnica', r: secInduccion },
    { id: 'va', t: 'Vía aérea', r: secViaAerea },
    { id: 'reg', t: 'Regional', r: secRegional },
    { id: 'to', t: 'Transoperatorio', r: secTransop },
    { id: 'bal', t: 'Balance y gases', r: secBalance },
    { id: 'sal', t: 'Salida', r: secSalida },
    { id: 'fir', t: 'Notas y firma', r: secFirma },
  ];

  function secPaciente() {
    const sedes = cfg.sedes.map((s) => [s.id, s.nombre || '(sin nombre)']);
    return card('Lugar de trabajo', SEL('sedeId', 'Hospital / clínica (encabezado del PDF)', sedes, { full: true }) +
      '<p class="nota">Puedes agregar o editar lugares desde el menú ⋮ → Lugares de trabajo.</p>') +
      card('Identificación', rej(
        T('p.nombre', 'Nombre y apellido', { full: true }) + T('p.ci', 'CI', { num: true }) + T('p.nhist', 'N° de historia') +
        T('p.tel', 'Teléfono', { tipo: 'tel' }) + T('p.fecha', 'Fecha', { tipo: 'date' }) +
        Nm('p.edad', 'Edad', 'años') + SEL('p.sexo', 'Sexo', [['', '—'], ['M', 'Masculino'], ['F', 'Femenino']]) + Nm('p.peso', 'Peso', 'kg') + Nm('p.talla', 'Talla', 'cm') +
        `<label class="campo calc"><span>IMC</span><div class="con-unidad"><input readonly data-calc="p._imc" value="${esc(H.p._imc || '')}"><em>kg/m²</em></div></label>`)) +
      card('Laboratorio', rej(
        Nm('p.hb', 'Hb', 'g/dl') + Nm('p.hto', 'Hto', '%') + T('p.plaq', 'Plaquetas', { num: true }) +
        Nm('p.glic', 'Glicemia', 'mg/dl') + Nm('p.urea', 'Urea', 'mg/dl') + Nm('p.creat', 'Creatinina', 'mg/dl') +
        T('p.tp', 'TP', { ph: 'seg / control' }) + T('p.tpt', 'TPT', { ph: 'seg / control' })) +
        '<h3>Volemia y pérdidas máximas permisibles</h3>' + rej(
          SEL('p.tipoVol', 'Tipo de paciente', VOLEMIA, { full: true }) +
          Nm('p.htoMin', 'Hto mínimo aceptable', '%', { ph: '30' }) +

          `<label class="campo calc"><span>Volemia estimada</span><div class="con-unidad"><input readonly data-calc="p._volemia" value="${esc(H.p._volemia || '')}"><em>ml</em></div></label>` +
          `<label class="campo calc"><span>Pérd. máx. permisibles</span><div class="con-unidad"><input readonly data-calc="p._pmp" value="${esc(H.p._pmp || '')}"><em>ml</em></div></label>` +
          Nm('p.volemia', 'Volemia (escribir para reemplazar)', 'ml') + Nm('p.pmp', 'PMP (escribir para reemplazar)', 'ml')) +
        R('p.formPmp', 'Fórmula de PMP', Object.entries(FORM_PMP).map(([k, x]) => [k, x.t])) +
        `<div class="formula"><div data-calc="p._volEq">${esc(H.p._volEq || '')}</div><div data-calc="p._pmpEq" style="margin-top:6px">${esc(H.p._pmpEq || '')}</div></div>` +
        '<p class="nota">Elige la fórmula con la que trabajas; la ecuación de arriba muestra el cálculo con los datos del paciente. Tu fórmula preferida y tu Hto mínimo se configuran en ⋮ → Mi perfil y firma. Si escribes un valor propio de volemia o PMP, se usa el tuyo.</p>') +
      card('Equipo quirúrgico', rej(
        T('alergias', 'Alergias', { full: true, ph: 'Niega / …' }) + T('premed', 'Premedicación', { full: true }) +
        T('anest', 'Anestesiólogo(s)', { full: true }) + nombresRol('anest') + T('asist', 'Asistente de anestesia', { full: true }) + nombresRol('asist') +
        T('ciruj', 'Cirujanos', { full: true }) + nombresRol('ciruj') + T('instr', 'Instrumentista', { full: true }) + nombresRol('instr') +
        '<p class="nota completo" style="grid-column:1/-1;margin-top:0">Los nombres que escribas quedan guardados como botones: tócalos para ponerlos o quitarlos (varios se separan con coma). ✎ permite borrar nombres de la lista.</p>', true)) +
      card('Cirugía', rej(T('dx', 'Dx quirúrgico', { full: true }) + T('intervencion', 'Intervención Qx', { full: true }), true));
  }

  function secValoracion() {
    const ro = [['', '—'], ['1', '1 · No abre'], ['2', '2 · Al dolor'], ['3', '3 · A la voz'], ['4', '4 · Espontánea']];
    const rv = [['', '—'], ['1', '1 · No responde'], ['2', '2 · Sonidos'], ['3', '3 · Palabras'], ['4', '4 · Confuso'], ['5', '5 · Orientado']];
    const rm = [['', '—'], ['1', '1 · Ninguna'], ['2', '2 · Extensión'], ['3', '3 · Flexión anormal'], ['4', '4 · Retira'], ['5', '5 · Localiza'], ['6', '6 · Obedece']];
    return card('Mallampati', R('mallampati', '', ['I', 'II', 'III', 'IV'], [IMGS.mall1, IMGS.mall2, IMGS.mall3, IMGS.mall4])) +
      card('ASA', R('asa', '', ['I', 'II', 'III', 'IV', 'V']) + C('asaE', 'E — Emergencia') + rej(T('asaRazon', 'Razón', { full: true }), true)) +
      card('Glasgow', rej(SEL('gcs.ro', 'Respuesta ocular (RO)', ro) + SEL('gcs.rv', 'Respuesta verbal (RV)', rv) + SEL('gcs.rm', 'Respuesta motora (RM)', rm) +
        `<label class="campo calc"><span>Total</span><div class="con-unidad"><input readonly data-calc="gcs._total" value="${esc(H.gcs._total || '')}"><em>/15</em></div></label>`));
  }

  const CHECKLIST = [['maq', 'Máquina de anestesia operativa'], ['mon', 'Monitores de signos operativos'], ['asp', 'Aspiración operativa'],
    ['sum', 'Suministros anestésicos necesarios'], ['med', 'Medicamentos anestésicos necesarios'], ['hem', 'Verificación de hemoderivados'],
    ['den', 'Verificar estado de piezas dentales'], ['ocu', 'Oclusión de globos oculares'], ['pre', 'Cuidado de puntos de presión']];
  const COAD = [['ansio', 'Ansiólisis', 'mg'], ['gast', 'Protección gástrica', 'mg'], ['emet', 'Antieméticos', 'mg'], ['analg', 'Analgésicos', 'mg'],
    ['atb', 'Antibióticos', 'mg / g'], ['ester', 'Esteroides', 'mg'], ['nebu', 'Nebulización', 'gts/puff'], ['otros', 'Otros', 'mg / g']];

  // Fármacos rápidos por ítem [nombre, dosis, unidad] (dosis de adulto orientativas; se editan en cada historia)
  const COAD_RAP = {
    ansio: [['Midazolam', '2', 'mg'], ['Midazolam', '1', 'mg'], ['Diazepam', '5', 'mg']],
    gast: [['Omeprazol', '40', 'mg'], ['Esomeprazol', '40', 'mg'], ['Pantoprazol', '40', 'mg'], ['Famotidina', '20', 'mg']],
    emet: [['Ondansetrón', '8', 'mg'], ['Ondansetrón', '4', 'mg'], ['Metoclopramida', '10', 'mg'], ['Granisetrón', '1', 'mg'], ['Droperidol', '0.625', 'mg']],
    analg: [['Ketorolac', '30', 'mg'], ['Paracetamol', '1', 'g'], ['Metamizol', '1', 'g'], ['Diclofenac', '75', 'mg'], ['Dexketoprofeno', '50', 'mg'], ['Tramadol', '100', 'mg'], ['Morfina', '4', 'mg']],
    atb: [['Cefazolina', '2', 'g'], ['Cefazolina', '1', 'g'], ['Unasyn', '1.5', 'g'], ['Unasyn', '3', 'g'], ['Ceftriaxona', '1', 'g'], ['Clindamicina', '600', 'mg'], ['Vancomicina', '1', 'g'], ['Metronidazol', '500', 'mg'], ['Ciprofloxacina', '400', 'mg']],
    ester: [['Dexametasona', '8', 'mg'], ['Dexametasona', '4', 'mg'], ['Hidrocortisona', '100', 'mg'], ['Metilprednisolona', '40', 'mg']],
    nebu: [['Salbutamol', '10', 'gts'], ['Bromuro de ipratropio', '20', 'gts'], ['Salbutamol', '2', 'puff']],
    otros: [['Ácido tranexámico', '1', 'g'], ['Sulfato de magnesio', '2', 'g'], ['Atropina', '0.5', 'mg'], ['Lidocaína', '60', 'mg']],
  };
  const UNIDADES = ['mg', 'g', 'mcg', 'UI', 'mL', 'gts', 'puff'];
  function coadItem(k, t) {
    const c = (H.coad || {})[k] || {}, meds = c.meds || [];
    const usados = ((cfg.coadUsados || {})[k] || []).filter((u) => !COAD_RAP[k].some((r) => r[0] === u[0] && r[1] === u[1] && r[2] === u[2]));
    const chip = ([n, d, u]) => `<button type="button" class="opcion chico" data-acc="coadAgregar" data-c="${k}" data-n="${esc(n)}" data-d="${esc(d)}" data-u="${esc(u)}">${esc(n.replace(/ \(.*\)/, ''))} ${esc(d)} ${esc(u)}</button>`;
    return `<div class="coad"><div class="check"><input type="checkbox" id="c_coad_${k}" data-k="coad.${k}.on"${c.on ? ' checked' : ''}><label for="c_coad_${k}">${t}</label></div>
      ${meds.map((m, i) => `<div class="coad-med"><input data-k="coad.${k}.meds.${i}.n" value="${esc(m.n || '')}" placeholder="Fármaco" data-coadmed="${k}">
        <input class="dosis" data-k="coad.${k}.meds.${i}.d" value="${esc(m.d || '')}" placeholder="Dosis" inputmode="decimal" data-coadmed="${k}">
        <select data-k="coad.${k}.meds.${i}.u" data-coadmed="${k}">${UNIDADES.concat(UNIDADES.includes(m.u) || !m.u ? [] : [m.u]).map((u) => `<option${(m.u || 'mg') === u ? ' selected' : ''}>${u}</option>`).join('')}</select>
        <button type="button" class="icono quitar" data-acc="coadQuitar" data-c="${k}" data-i="${i}" aria-label="Quitar">×</button></div>`).join('')}
      ${c.det || c._nota ? `<label class="campo completo" style="margin:6px 0"><span>Nota libre</span><input data-k="coad.${k}.det" value="${esc(c.det || '')}" placeholder="Texto libre"></label>` : ''}
      <div class="opciones coad-chips">${usados.map(chip).join('')}${COAD_RAP[k].map(chip).join('')}
        <button type="button" class="opcion chico" data-acc="coadAgregar" data-c="${k}" data-n="" data-d="" data-u="${k === 'nebu' ? 'gts' : 'mg'}">+ Otro</button>
        ${c.det || c._nota ? '' : `<button type="button" class="opcion chico" data-acc="coadNota" data-c="${k}">✎ Nota</button>`}</div></div>`;
  }
  // Guarda los fármacos escritos a mano para ofrecerlos como botón la próxima vez
  function recordarCoad(k) {
    const meds = ((H.coad || {})[k] || {}).meds || []; const U = (cfg.coadUsados = cfg.coadUsados || {}); const l = (U[k] = U[k] || []);
    meds.forEach((m) => { const n = String(m.n || '').trim(); if (!n || !String(m.d || '').trim()) return;
      const r = [n, String(m.d).trim(), m.u || 'mg']; const j = l.findIndex((x) => x[0] === r[0] && x[1] === r[1] && x[2] === r[2]); if (j >= 0) l.splice(j, 1); l.unshift(r); });
    U[k] = l.slice(0, 8); Store.guardarConfig(cfg);
  }

  /* Equipo quirúrgico: nombres guardados para elegir rápido */
  let editRol = '';
  const partirNombres = (v) => String(v || '').split(/\s*[,;\n]\s*|\s+y\s+/i).map((x) => x.trim()).filter(Boolean);
  function nombresRol(rol) {
    const l = (cfg.equipo || {})[rol] || [], act = partirNombres(H[rol]).map((x) => x.toLowerCase());
    if (!l.length) return '';
    const ed = editRol === rol;
    return `<div class="nombres" style="grid-column:1/-1">${l.map((n) => `<button type="button" class="opcion${!ed && act.includes(n.toLowerCase()) ? ' sel' : ''}" data-acc="${ed ? 'nomBorrar' : 'nomTog'}" data-rol="${rol}" data-n="${esc(n)}">${ed ? '× ' : ''}${esc(n)}</button>`).join('')}
      <button type="button" class="opcion editar" data-acc="nomEditar" data-rol="${rol}">${ed ? 'Listo' : '✎'}</button></div>`;
  }
  function refrescarNombres(rol) {
    const inp = $(`[data-k="${rol}"]`); if (!inp) return; const lab = inp.closest('.campo'); const sig = lab.nextElementSibling;
    const html = nombresRol(rol); if (sig && sig.classList.contains('nombres')) { if (html) sig.outerHTML = html; else sig.remove(); } else if (html) lab.insertAdjacentHTML('afterend', html);
  }
  function recordarNombres(rol) {
    const E = (cfg.equipo = cfg.equipo || {}); const l = (E[rol] = E[rol] || []);
    partirNombres(H[rol]).reverse().forEach((n) => { const j = l.findIndex((x) => x.toLowerCase() === n.toLowerCase()); if (j >= 0) l.splice(j, 1); l.unshift(n); });
    E[rol] = l.slice(0, 24); Store.guardarConfig(cfg);
  }

  function secPreparacion() {
    return card('Verificación preanestésica', CHECKLIST.map(([k, t]) => C('chk.' + k, t)).join('') +
      '<div class="fila-btn"><button class="secundario chico" data-acc="marcarTodo">Marcar todo</button></div>') +
      card('Medicación coadyuvante', COAD.map(([k, t]) => coadItem(k, t)).join('') +
        '<p class="nota">Toca un fármaco para agregarlo con su dosis habitual y ajusta dosis y unidad. Puedes poner varios en el mismo ítem: en la hoja cada uno va en su línea y el espacio del recuadro se reparte solo. Los fármacos que escribas se guardan para la próxima vez.</p>');
  }

  /* ---------- Dosis por peso (inducción y reversión) ---------- */
  const pesoKg = () => { const w = num((H && H.p || {}).peso); return w > 0 ? w : 0; };
  const fmtN = (x) => String(x).replace('.', ',');
  // Redondeo práctico: mcg y ≥20 mg sin decimales; 1–20 con 1 decimal; <1 con 2
  const redondear = (x) => (x >= 20 ? Math.round(x) : x >= 1 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100);
  const sinTilde = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // Inducción: rango por kg [mín, máx, unidad], dosis de los botones (por kg) y nota
  const IND_FARM = {
    'Propofol': { r: [1.5, 2.5, 'mg/kg'], s: [2] },
    'Etomidato': { r: [0.2, 0.3, 'mg/kg'], s: [0.3] },
    'Ketamina': { r: [1, 2, 'mg/kg'], s: [1], nota: 'Analgésica / subanestésica: 0,15–0,5 mg/kg.' },
    'Tiopental': { r: [3, 5, 'mg/kg'], s: [4] },
    'Midazolam': { r: [0.02, 0.05, 'mg/kg'], s: [0.03], nota: 'Coinducción; hasta 0,1–0,2 mg/kg como inductor único.' },
    'Fentanilo': { r: [1, 3, 'mcg/kg'], s: [2] },
    'Remifentanilo': { r: [0.5, 1, 'mcg/kg'], s: [1] },
    'Lidocaína': { r: [1, 1.5, 'mg/kg'], s: [1] },
    'Rocuronio': { r: [0.6, 1.2, 'mg/kg'], s: [0.6, 1.2], nota: '1,2 mg/kg en secuencia rápida (reversible con sugammadex 16 mg/kg).' },
    'Vecuronio': { r: [0.08, 0.1, 'mg/kg'], s: [0.1] },
    'Cisatracurio': { r: [0.15, 0.2, 'mg/kg'], s: [0.15] },
    'Atracurio': { r: [0.4, 0.5, 'mg/kg'], s: [0.5] },
    'Succinilcolina': { r: [1, 1.5, 'mg/kg'], s: [1] },
    'Sevoflurano': { fijo: ['8', '%'], nota: 'Inducción inhalatoria: 6–8 % con flujo alto; luego bajar a mantenimiento.' },
  };
  const UNI_IND = ['mg', 'mcg', 'g', '%', 'mL', 'UI'];
  const buscarFarm = (tabla, n) => { const s = sinTilde(n); if (!s) return ''; return Object.keys(tabla).find((k) => { const t = sinTilde(k); return s === t || s.startsWith(t) || (s.length >= 4 && t.startsWith(s)); }) || ''; };
  // Texto de guía: rango por kg, lo que da con el peso y cuánto es la dosis escrita por kg
  function guiaDosis(tabla, n, d, u) {
    const k = buscarFarm(tabla, n); if (!k) return '';
    const f = tabla[k], w = pesoKg(); let t = '';
    if (f.r) {
      const [a, b, ur] = f.r, ub = ur.replace('/kg', '');
      const cap = (x) => (f.tope && x > f.tope ? f.tope : x);
      t = f.pasos
        ? (w ? '' : 'Escribe el peso para calcular.')
        : `${k}: ${fmtN(a)}${a !== b ? '–' + fmtN(b) : ''} ${ur}` + (w ? ` = <b>${fmtN(redondear(cap(a * w)))}${a !== b ? '–' + fmtN(redondear(cap(b * w))) : ''} ${ub}</b> (${fmtN(w)} kg)` : ' · escribe el peso para calcular');
      if (f.max) t += ` · máx. ${f.max}`;
      if (!t) t = k;
      const d0 = num(d), uu = u || ub;
      const dd = uu === ub ? d0 : uu === 'mcg' && ub === 'mg' ? d0 / 1000 : uu === 'mg' && ub === 'mcg' ? d0 * 1000 : NaN;
      if (w && dd > 0) { const pk = dd / w, fuera = pk > b * 1.03 || pk < a * 0.97; t += ` · dada: <b${fuera ? ' style="color:#b3261e"' : ''}>${fmtN(Math.round(pk * 1000) / 1000)} ${ur}</b>${fuera ? ' (fuera del rango)' : ''}`; }
      if (f.tope && dd > f.tope) t += ` · <b style="color:#b3261e">supera ${fmtN(f.tope)} ${ub} en total</b>`;
      if (f.ml && dd > 0 && ub === f.ml[1]) t += ` · <b>${fmtN(Math.round((dd / f.ml[0]) * 100) / 100)} mL</b> de ${f.ml[2]}`;
    }
    if (f.nota) t += `<details><summary>▸ Guía</summary>${esc(f.nota)}</details>`;
    return t;
  }

  // Inducción: filas {n, d, u} (A–F); ind.meds (texto) se mantiene para la hoja y versiones anteriores
  function indLista() {
    const I = (H.ind = H.ind || {});
    if (!Array.isArray(I.lista) || (!I.lista.length && (I.meds || []).some((x) => String(x || '').trim()))) {
      I.lista = (I.meds || []).filter((x) => String(x || '').trim()).map((x) => {
        const m = String(x).trim().match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Zµ%]+)?\.?$/);
        return m ? { n: m[1], d: m[2], u: m[3] || 'mg' } : { n: String(x).trim(), d: '', u: 'mg' };
      });
    }
    return I.lista;
  }
  function indSincronizar() {
    const l = H.ind.lista || [];
    H.ind.meds = [0, 1, 2, 3, 4, 5].map((i) => { const m = l[i]; if (!m) return ''; return [m.n, m.d ? m.d + ' ' + (m.u || '') : ''].map((x) => String(x || '').trim()).filter(Boolean).join(' '); });
  }
  function indBotones() {
    const w = pesoKg(), usados = (cfg.indUsados || []);
    const chip = (n, d, u, et) => `<button type="button" class="opcion chico dos" data-acc="indAgregar" data-n="${esc(n)}" data-d="${esc(d)}" data-u="${esc(u)}">${esc(n)} ${et}</button>`;
    let h = usados.map(([n, d, u]) => chip(n, d, u, `${esc(d)} ${esc(u)}`)).join('');
    Object.entries(IND_FARM).forEach(([n, f]) => {
      if (f.fijo) { h += chip(n, f.fijo[0], f.fijo[1], `${f.fijo[0]} ${f.fijo[1]}`); return; }
      const ub = f.r[2].replace('/kg', '');
      f.s.forEach((x) => { const d = w ? String(redondear(x * w)) : ''; h += chip(n, d, ub, `${w ? fmtN(d) + ' ' + ub : ''}<small>${fmtN(x)} ${f.r[2]}</small>`); });
    });
    return h;
  }
  function recordarInd() {
    const l = (cfg.indUsados = cfg.indUsados || []);
    indLista().forEach((m) => { const n = String(m.n || '').trim(); if (!n || !String(m.d || '').trim() || buscarFarm(IND_FARM, n)) return;
      const r = [n, String(m.d).trim(), m.u || 'mg']; const j = l.findIndex((x) => x[0] === r[0] && x[1] === r[1] && x[2] === r[2]); if (j >= 0) l.splice(j, 1); l.unshift(r); });
    cfg.indUsados = l.slice(0, 8); Store.guardarConfig(cfg);
  }
  function secIndMeds() {
    const l = indLista();
    return `<div class="grupo"><div class="etq">Medicamentos de inducción</div>
      ${l.map((m, i) => `<div class="coad-med ind-med"><b class="letra">${'ABCDEF'[i]}.</b><input data-k="ind.lista.${i}.n" value="${esc(m.n || '')}" placeholder="Fármaco" data-indmed="${i}">
        <input class="dosis" data-k="ind.lista.${i}.d" value="${esc(m.d || '')}" placeholder="Dosis" inputmode="decimal" data-indmed="${i}">
        <select data-k="ind.lista.${i}.u" data-indmed="${i}">${UNI_IND.concat(UNI_IND.includes(m.u) || !m.u ? [] : [m.u]).map((u) => `<option${(m.u || 'mg') === u ? ' selected' : ''}>${u}</option>`).join('')}</select>
        <button type="button" class="icono quitar" data-acc="indQuitar" data-i="${i}" aria-label="Quitar">×</button></div>
        <div class="nota guia-dosis" id="indG${i}">${guiaDosis(IND_FARM, m.n, m.d, m.u)}</div>`).join('')}
      ${l.length >= 6 ? '<p class="nota">La hoja tiene 6 renglones (A–F).</p>' : `<div class="opciones coad-chips ind-chips">${indBotones()}
        <button type="button" class="opcion chico" data-acc="indAgregar" data-n="" data-d="" data-u="mg">+ Otro</button></div>`}
      <p class="nota">${pesoKg() ? `Dosis calculadas con ${fmtN(pesoKg())} kg (peso en Paciente).` : 'Escribe el peso del paciente para que los botones traigan la dosis calculada.'} Son orientativas: ajústalas a tu paciente. Los fármacos que escribas se guardan para la próxima vez.</p></div>`;
  }

  function secInduccion() {
    const mas = [['local', 'Local'], ['regional', 'Regional'], ['conductiva', 'Conductiva'], ['ninguna', 'Ninguna otra']];
    return card('Inducción', R('ind.tipo', 'Tipo', [['iv', 'Intravenosa'], ['inh', 'Inhalatoria'], ['mixta', 'Mixta']]) + secIndMeds()) +
      card('Técnica', C('tec.sed', '<b>SEDACIÓN</b>') + '<div class="subbloque">' +
        R('tec.sedVia', '', [['inh', 'Inhalatoria'], ['iv', 'Intravenosa']]) + R('tec.sedMas', '+', mas) + '</div>' +
        C('tec.gen', '<b>GENERAL</b>') + '<div class="subbloque">' +
        R('tec.genVia', '', [['inh', 'Inhalatoria'], ['iv', 'Intravenosa'], ['bal', 'Balanceada']]) + R('tec.genMas', '+', mas) + '</div>') +
      card('Sedación', R('sedNivel', 'Nivel', [['ansio', 'Ansiólisis'], ['consc', 'Consciente'], ['prof', 'Profunda']])) +
      card('General — manejo de vía aérea', C('ga.oral', 'Intubación oral') + C('ga.nasal', 'Intubación nasal') +
        C('ga.supra', 'Disp. supraglótico', { k: 'ga.supraTipo', ph: 'Tipo / N°' }) + C('ga.otro', 'Otro', { k: 'ga.otroTxt', ph: '¿Cuál?' }));
  }

  function secViaAerea() {
    return card('Cormack-Lehane', R('va.cl', '', ['I', 'II', 'III', 'IV'], [IMGS.cl1, IMGS.cl2, IMGS.cl3, IMGS.cl4]) +
      R('va.hoja', 'Hoja', [['recta', 'Recta'], ['curva', 'Curva'], ['hiper', 'Hiperangulada']]) + rej(T('va.hojaN', 'N° de hoja', { num: true }))) +
      card('Tubo', rej(T('va.tuboN', 'Tubo N°', { num: true }) + Nm('va.aire', 'Aire', 'cc') + Nm('va.long', 'Long. (fijación)', 'cm')) +
        R('va.tubo', 'Tipo', [['simple', 'Simple'], ['armado', 'Armado'], ['preformado', 'Preformado'], ['selectivo', 'Selectivo']]) +
        R('va.lado', 'Selectivo lado', [['D', 'Derecho'], ['I', 'Izquierdo']]) +
        R('va.manguito', 'Manguito', [['con', 'Con manguito'], ['sin', 'Sin manguito']]) +
        C('va.ruidos', 'Ruidos respiratorios simétricos') + C('va.etco2', 'EtCO2 +')) +
      card('Intubación asistida con', C('va.asist.video', 'Videolaringoscopio') + C('va.asist.fibro', 'Fibroscopio flexible') +
        C('va.asist.airtraq', 'AirTraq') + C('va.asist.glide', 'Glidescope') + C('va.asist.fast', 'FastTrach') +
        C('va.asist.otro', 'Otro', { k: 'va.asist.otroTxt', ph: '¿Cuál?' }) +
        '<h3>Razón</h3>' + C('va.razon.entren', 'Entrenamiento') + C('va.razon.dificil', 'Vía aérea difícil') +
        '<h3>POGO</h3>' + C('va.pogoOn', 'POGO', { k: 'va.pogo', ph: 'Valor', u: '%', num: true }) +
        R('va.pogoCat', '', [['0', '0%'], ['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']], [IMGS.pogo0, IMGS.pogo25, IMGS.pogo50, IMGS.pogo75, IMGS.pogo100]));
  }

  function secRegional() {
    return card('Regional', C('reg.iv', 'Intravenosa') + C('reg.bloqueo', 'Bloqueo', { k: 'reg.bloqueoTxt', ph: 'Tipo de bloqueo' }) +
      '<div class="subbloque">' + C('reg.neuro', 'Guiado por neuroestimulador') + C('reg.us', 'Guiado por ultrasonografía') + '</div>') +
      card('Conductiva', R('cond.tec', 'Técnica', [['sub', 'Subaracnoidea'], ['epi', 'Epidural'], ['comb', 'Combinada']]) +
        R('cond.aguja', 'Tipo de aguja', [['quincke', 'Quincke'], ['whitacre', 'Whitacre'], ['tuohy', 'Tuohy']]) +
        rej(T('cond.agujaN', 'Aguja N°', { num: true }) + T('cond.cateterN', 'Catéter N°', { num: true }) + T('cond.nivelPL', 'Nivel PL', { ph: 'L3-L4' }) + T('cond.nivelBloq', 'Nivel de bloqueo', { ph: 'T10' })) +
        R('cond.pos', 'Posición', [['sentado', 'Sentado'], ['decubito', 'Decúbito lateral']]) +
        R('cond.bisel', 'Bisel', [['cef', 'Cefálico'], ['cau', 'Caudal'], ['ind', 'Indiferente']]) +
        R('cond.limpieza', 'Limpieza', [['asepsia', 'Asepsia'], ['antisepsia', 'Antisepsia']]) + rej(T('cond.con', 'Con', { full: true, ph: 'Clorhexidina, yodopovidona…' }), true) +
        '<h3>Complicaciones</h3>' + C('cond.punc', 'Punción accidental de duramadre') + C('cond.otras', 'Otras', { k: 'cond.otrasTxt', ph: '¿Cuál?' }) +
        rej(TA('cond.conducta', 'Conducta', { alto: 60 }), true));
  }

  /* ---------- Transoperatorio ---------- */
  function minDe(hm) { if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return NaN; const [h, m] = hm.split(':').map(Number); return h * 60 + m; }
  function offset(hm) { const a = minDe(H.to.inicio), b = minDe(hm); if (!isFinite(a) || !isFinite(b)) return NaN; let d = b - a; if (d < -60) d += 1440; return d; }
  function ordenarRegs() { H.to.regs.sort((x, y) => (offset(x.hora) || 0) - (offset(y.hora) || 0)); }
  const TIEMPOS = [['ia', 'Inicio anestesia'], ['ic', 'Inicio cirugía'], ['fc', 'Fin cirugía'], ['fa', 'Fin anestesia']];

  function secTransop() {
    const to = H.to; ordenarRegs();
    if (!to.cierre) to.cierre = cfg.cierre || 'recta';
    const tiempos = TIEMPOS.map(([k, t]) => `<label class="campo"><span>${t}</span><div class="con-unidad"><input type="time" data-k="to.t.${k}" value="${esc(val('to.t.' + k))}"><button class="secundario chico" data-acc="ahora" data-p="to.t.${k}">Ahora</button></div></label>`).join('');
    const regs = to.regs.length ? to.regs.map((r, i) => `<div class="registro"><span class="hora">${esc(r.hora)}</span><span class="datos">${resumenReg(r)}</span>
      <button class="secundario chico" data-acc="editarReg" data-i="${i}">Editar</button></div>`).join('') :
      '<p class="nota">Aún no hay registros. Toca “Registrar ahora” cada 5–15 minutos o cuando haya un cambio.</p>';
    return card('Inicio del registro', `<div class="rejilla tiempos">` + (
      `<label class="campo"><span>Hora de inicio de la grilla</span><div class="con-unidad"><input type="time" data-k="to.inicio" value="${esc(to.inicio || '')}"><button class="secundario chico" data-acc="ahora" data-p="to.inicio" data-red="5">Ahora</button></div></label>` +
      T('to.posicion', 'Posición del paciente', { ph: 'Decúbito supino…' })) + '</div>' +
      '<p class="nota">Cada hoja cubre 5 h 30 min (11 columnas de 30 min, divididas en 5 min). Si la cirugía dura más, el PDF agrega hojas de continuación.</p>') +
      card('Tiempos', `<div class="rejilla tiempos">${tiempos}</div>` +
        R('to.cierre', 'Cierre de la grilla en el fin de anestesia', [['recta', 'Línea recta'], ['zigzag', 'Zigzag'], ['no', 'No marcar']]) +
        '<p class="nota">En el PDF se traza una línea gruesa a la hora del fin de anestesia y el espacio que queda a la derecha se raya en diagonal, para que no se agregue nada después.</p>') +
      card('Signos vitales de inicio', rej(Nm('to.base.tas', 'TA sistólica', 'mmHg') + Nm('to.base.tad', 'TA diastólica', 'mmHg') +
        Nm('to.base.fc', 'FC', 'lpm') + Nm('to.base.fr', 'FR', 'rpm') + Nm('to.base.sat', 'SatO2', '%'))) +
      card('Registro de signos, fármacos y ventilación',
        `<svg class="grafica" id="grafica" viewBox="0 0 360 170"></svg><div class="leyenda"><span><i style="color:#c62828">∨</i> TA sistólica</span><span><i style="color:#c62828">∧</i> TA diastólica</span><span><i style="color:#1565c0">●</i> FC</span><span><i style="color:#2e7d32">○</i> FR</span></div>` +
        '<div class="fila-btn"><button class="primario" data-acc="nuevoReg">+ Registrar ahora</button></div><div style="margin-top:12px">' + regs + '</div>') +
      secPistas() + secInfusiones() +
      card('Vías venosas (filas VC / VP)', '<p class="nota" style="margin:0 0 10px">Ej. VP #18 MSD, VC #7 YI D.</p>' + rej([7, 8, 9].map((i) => T('to.filas.' + i, `Fila ${i + 1}`, { ph: FILAS_BASE[i] })).join(''), true));
  }
  const INFUS = [
    ['Remifentanilo', 'Ej. 2 mg en 40 cc (50 mcg/ml)', 'Ej. 0.1 mcg/kg/min'],
    ['Dexmedetomidina', 'Ej. 200 mcg en 50 cc (4 mcg/ml)', 'Ej. 0.5 mcg/kg/h'],
    ['Lidocaína', 'Ej. 1 g en 250 cc (4 mg/ml)', 'Ej. 1.5 mg/kg/h'],
    ['Sulfato de Magnesio', 'Ej. 2 g en 100 cc (20 mg/ml)', 'Ej. 10 mg/kg/h'],
    ['Ketamina', 'Ej. 50 mg en 50 cc (1 mg/ml)', 'Ej. 0.2 mg/kg/h'],
    ['Propofol', 'Ej. 1% sin diluir (10 mg/ml)', 'Ej. 100 mcg/kg/min · TCI Ce 3 mcg/ml'],
    ['Norepinefrina', 'Regla del 6: 0.6 × peso mg en 100 cc', 'Ej. 0.05 mcg/kg/min'],
    ['Adrenalina', 'Regla del 6: 0.6 × peso mg en 100 cc', 'Ej. 0.05 mcg/kg/min'],
    ['Fenilefrina', 'Ej. 10 mg en 100 cc (100 mcg/ml)', 'Ej. 0.5 mcg/kg/min'],
    ['Dopamina', 'Regla del 6: 6 × peso mg en 100 cc', 'Ej. 5 mcg/kg/min'],
    ['Dobutamina', 'Regla del 6: 6 × peso mg en 100 cc', 'Ej. 5 mcg/kg/min'],
    ['Efedrina', 'Bolos: 50 mg en 10 cc (5 mg/ml)', 'Ej. 5–10 mg'],
    ['Mezcla bloqueo periférico', 'Ej. Bupivacaína 0.25% 20 ml + Dexametasona 4 mg', 'Volumen total / técnica'],
    ['Mezcla neuroaxial', 'Ej. Bupivacaína pesada 0.5% 12 mg + Fentanilo 25 mcg', 'Volumen / velocidad epidural'],
    ['Otra', 'Dilución / concentración', 'Dosis / velocidad'],
  ];
  function secInfusiones() {
    const lista = (H.inf || []).map((f, i) => {
      const ref = INFUS.find((x) => x[0] === f.farm) || INFUS[INFUS.length - 1];
      return `<div class="subbloque" style="margin-bottom:14px"><div class="rejilla ancha">
        ${T('inf.' + i + '.farm', 'Fármaco / mezcla', { full: true })}
        ${T('inf.' + i + '.conc', 'Dilución / concentración', { full: true, ph: ref[1] })}
        ${T('inf.' + i + '.dosis', 'Dosis / velocidad', { full: true, ph: ref[2] })}</div>
        <div class="rejilla tiempos" style="margin-top:10px">
        <label class="campo"><span>Inicio</span><div class="con-unidad"><input type="time" data-k="inf.${i}.ini" value="${esc(val('inf.' + i + '.ini'))}"><button class="secundario chico" data-acc="ahora" data-p="inf.${i}.ini">Ahora</button></div></label>
        <label class="campo"><span>Fin</span><div class="con-unidad"><input type="time" data-k="inf.${i}.fin" value="${esc(val('inf.' + i + '.fin'))}"><button class="secundario chico" data-acc="ahora" data-p="inf.${i}.fin">Ahora</button></div></label></div>
        <div class="fila-btn"><button class="primario chico" data-acc="calcInf" data-i="${i}">🧮 Calculadora</button><button class="peligro chico" data-acc="quitarInf" data-i="${i}">Quitar</button></div></div>`;
    }).join('');
    return card('Mezcla / Infusión Mantenimiento',
      (lista || '<p class="nota" style="margin-top:0">Agrega las infusiones de mantenimiento (TIVA) o la mezcla del bloqueo.</p>') +
      '<div class="grupo"><div class="etq">Agregar</div><div class="opciones">' +
      INFUS.map((x) => `<button type="button" class="opcion" data-acc="agregarInf" data-farm="${esc(x[0])}">+ ${esc(x[0])}</button>`).join('') + '</div></div>' +
      rej(TA('mezcla', 'Notas adicionales', { alto: 70 }), true));
  }

  /* ---------- Calculadora de infusiones (BIC, Roberts, TCI manual, anestésicos locales) ---------- */
  function abrirCalculadora(i) {
    const C = window.CalcInf, f = H.inf[i];
    const esLA = /^Mezcla (bloqueo|neuroaxial)/.test(f.farm || '');
    const farmIni = C.FARMACOS[f.farm] ? f.farm : 'Otra';
    const st = Object.assign({
      farm: farmIni, modo: esLA ? 'la' : 'bic', peso: H.p.peso || '', edad: H.p.edad || '', talla: H.p.talla || '',
      sexo: H.p.sexo || (H.p.tipoVol === '65' ? 'F' : 'M'), cant: '', uCant: '', vol: '', dosis: '', uDosis: '', mlh: '', bolo: '',
      modelo: '', ct: '', local: 'Bupivacaína', pct: '0.25', volLA: '', epi: false,
    }, f.calc || {});
    const F = () => C.FARMACOS[st.farm];
    const fijarFarmaco = () => {
      const d = F(); st.uDosis = d.uDosis; st.uCant = d.masa;
      if (d.preps[0]) { st.cant = d.preps[0][0]; st.vol = d.preps[0][1]; st.uCant = d.masa; }
      st.bolo = d.bolo && d.bolo.prellenar ? d.bolo.def : ''; st.tCarga = d.bolo && d.bolo.carga ? d.bolo.carga : ''; st.modelo = d.modelos ? d.modelos[0] : ''; st.ct = d.ct ? d.ct.def : ''; st.dosis = d.dosisDef || '';
      st.obj = st.modelo === 'marsh' || !st.modelo ? 'cp' : (C.MODELOS[st.modelo].fn({ peso: 70, talla: 170, edad: 40, sexo: 'M' }).ke0 ? 'ce' : 'cp');
      if (st.modo === 'roberts' && !d.roberts) st.modo = 'bic'; if (st.modo === 'tci' && !d.modelos) st.modo = 'bic';
    };
    if (!f.calc) fijarFarmaco();
    const n = C.num, R = C.r;
    const conc = () => { const d = F(); const c = n(st.cant), v = n(st.vol); if (!(c > 0 && v > 0)) return NaN;
      const aMasa = ({ g: 1000, mg: 1, mcg: 0.001 }[st.uCant || d.masa]) / ({ mg: 1, mcg: 0.001 }[d.masa]); return (c * aMasa) / v; };
    const campo = (k, t, u, o = {}) => `<label class="campo"><span>${t}</span><div class="con-unidad"><input data-ck="${k}" inputmode="decimal" value="${esc(st[k])}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${u ? `<em>${u}</em>` : ''}</div></label>`;
    const chips = (k, ops) => `<div class="opciones">${ops.map(([v, t]) => `<button type="button" class="opcion${String(st[k]) === String(v) ? ' sel' : ''}" data-cc="${k}" data-v="${esc(v)}">${t}</button>`).join('')}</div>`;

    function pintar() {
      const d = F();
      const modos = [['bic', 'BIC (mL/h)']];
      if (d.roberts) modos.push(['roberts', 'Esquema Roberts']);
      if (d.modelos) modos.push(['tci', 'TCI (modelo)']);
      modos.push(['la', 'Anestésico local']);
      let html = `<h2>Calculadora</h2>
        <div class="grupo"><div class="etq">Fármaco</div>${chips('farm', Object.keys(C.FARMACOS).map((k) => [k, k]))}</div>
        <div class="grupo"><div class="etq">Modo</div>${chips('modo', modos)}</div>
        <div class="rejilla">${campo('peso', 'Peso', 'kg')}${st.modo === 'tci' ? campo('edad', 'Edad', 'años') + campo('talla', 'Talla', 'cm') +
          `<label class="campo"><span>Sexo</span><select data-ck="sexo"><option value="M"${st.sexo === 'M' ? ' selected' : ''}>Masculino</option><option value="F"${st.sexo === 'F' ? ' selected' : ''}>Femenino</option></select></label>` : ''}</div>`;
      if (st.modo !== 'la') {
        html += `<h3>Preparación</h3>${d.preps.length ? chips('prep', d.preps.map((p, j) => [j, Array.isArray(p) ? p[2] : p.label])) : ''}
          <div class="rejilla" style="margin-top:8px"><label class="campo"><span>Cantidad</span><div class="con-unidad"><input data-ck="cant" inputmode="decimal" value="${esc(st.cant)}">
            <select data-ck="uCant" style="width:auto">${['g', 'mg', 'mcg'].map((u) => `<option${(st.uCant || d.masa) === u ? ' selected' : ''}>${u}</option>`).join('')}</select></div></label>
          ${campo('vol', 'Volumen total', 'mL')}<label class="campo calc"><span>Concentración</span><input readonly id="cConc"></label></div>`;
      }
      if (st.modo === 'bic') {
        const carga = d.bolo && d.bolo.carga;
        const bloqueCarga = d.bolo ? `<h3>${carga ? '1. ' + d.bolo.nombre : 'Bolo'}</h3><p class="nota" style="margin-top:0">${esc(d.bolo.rango)}</p>
          ${carga && d.bolo.tiempos ? `<div class="grupo"><div class="etq">Pasar en</div>${chips('tCarga', d.bolo.tiempos.map((t) => [t, t + ' min']))}</div>` : ''}
          <div class="rejilla">${campo('bolo', 'Dosis', d.bolo.u, { ph: 'Ej. ' + d.bolo.def })}${carga ? campo('tCarga', 'Pasar en', 'min') : ''}
          <label class="campo calc"><span>Total</span><input readonly id="cBolo"></label>${carga ? '<label class="campo calc"><span>Bomba durante la carga</span><input readonly id="cCargaVel"></label>' : ''}</div><p class="nota" id="cCargaAviso" style="color:var(--peligro)"></p>` : '';
        if (carga) html += bloqueCarga;
        html += `<h3>${carga ? '2. Mantenimiento' : 'Infusión continua'}</h3><p class="nota" style="margin-top:0">${esc(d.rango || '')}</p>
          <div class="rejilla">${campo('dosis', 'Dosis', '')}<label class="campo"><span>Unidad</span><select data-ck="uDosis">${d.unidades.map((u) => `<option${st.uDosis === u ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
          <label class="campo calc"><span>Velocidad</span><input readonly id="cVel"></label></div>
          <h3>De mL/h a dosis</h3><div class="rejilla">${campo('mlh', 'Velocidad de la bomba', 'mL/h')}<label class="campo calc"><span>Equivale a</span><input readonly id="cDos"></label></div>
          ${carga ? '' : bloqueCarga}`;
      } else if (st.modo === 'roberts') {
        html += `<h3>Esquema de Roberts (10–8–6)</h3><p class="nota" style="margin-top:0">Bolo 1 mg/kg y luego 10, 8 y 6 mg/kg/h, cambiando a los 10 y 20 min. Busca ≈ 3 mcg/mL en plasma.</p><div id="cTabla"></div>`;
      } else if (st.modo === 'tci') {
        html += `<h3>Modelo</h3>${chips('modelo', d.modelos.map((m) => [m, C.MODELOS[m].nombre]))}
          ${C.MODELOS[st.modelo].fn({ peso: 70, talla: 170, edad: 40, sexo: 'M' }).ke0 ? `<div class="grupo" style="margin-top:8px"><div class="etq">Objetivo</div>${chips('obj', [['ce', 'Sitio efecto (Ce)'], ['cp', 'Plasma (Cp)']])}</div>` : ''}
          <div class="rejilla" style="margin-top:8px">${campo('ct', 'Concentración objetivo', d.ct.u)}</div><p class="nota">${esc(d.ct.rango)}</p>
          <div id="cTabla"></div>`;
      } else {
        html += `<h3>Anestésico local</h3>${chips('local', Object.keys(C.LOCALES).map((k) => [k, k]))}
          <div class="rejilla" style="margin-top:8px">${campo('pct', 'Concentración', '%')}${campo('volLA', 'Volumen', 'mL')}</div>
          <div class="check"><input type="checkbox" id="cEpi"${st.epi ? ' checked' : ''}><label for="cEpi" style="flex:1">Con epinefrina</label></div><div id="cTabla"></div>`;
      }
      html += `<p class="nota">Cálculos de referencia. Verifica siempre con la bomba, la etiqueta de la jeringa y tu criterio clínico.</p>
        <div class="acciones"><button class="secundario" id="cCerrar">Cerrar</button><button class="primario" id="cUsar">Usar en la infusión</button></div>`;
      abrirHoja(html);
      $$('#capa [data-ck]').forEach((e) => { e.oninput = e.onchange = () => { st[e.dataset.ck] = e.value; calcular(); }; });
      $$('#capa [data-cc]').forEach((b) => (b.onclick = () => {
        const k = b.dataset.cc, v = b.dataset.v;
        if (k === 'prep') { const p = F().preps[+v];
          if (Array.isArray(p)) { st.cant = p[0]; st.vol = p[1]; st.uCant = F().masa; }
          else { const w = n(st.peso); if (!(w > 0)) { aviso('Escribe el peso para la regla de los 6'); return; } st.cant = R(p.porKg * w, 2); st.vol = p.vol; st.uCant = 'mg'; st._regla = p.label; } }
        else { st[k] = v; if (k === 'farm') fijarFarmaco();
          if (k === 'modelo') st.obj = v === 'marsh' ? 'cp' : (C.MODELOS[v].fn({ peso: 70, talla: 170, edad: 40, sexo: 'M' }).ke0 ? 'ce' : 'cp'); }
        pintar();
      }));
      if ($('#cEpi')) $('#cEpi').onchange = (e) => { st.epi = e.target.checked; calcular(); };
      $('#cCerrar').onclick = cerrarHoja;
      $('#cUsar').onclick = usar;
      calcular();
    }

    let resumen = { conc: '', dosis: '' };
    function calcular() {
      const d = F(), peso = n(st.peso), c = conc(), mu = d.masa;
      const cTxt = isFinite(c) ? `${R(c, c < 1 ? 3 : 2)} ${mu}/mL` : '';
      if ($('#cConc')) $('#cConc').value = cTxt;
      const regla = st._regla && (d.preps || []).some((p) => !Array.isArray(p) && p.label === st._regla && Math.abs(p.porKg * n(st.peso) - n(st.cant)) < 0.01) ? ' · ' + st._regla.split(':')[0] : '';
      const prepSel = (d.preps || []).find((p) => Array.isArray(p) && +p[0] === +st.cant && +p[1] === +st.vol && (st.uCant || mu) === mu);
      let cantTxt = `${st.cant} ${st.uCant || mu}`; if ((st.uCant || mu) === 'mcg' && n(st.cant) >= 1000) cantTxt = `${R(n(st.cant) / 1000, 2)} mg`; if ((st.uCant || mu) === 'mg' && n(st.cant) >= 1000) cantTxt = `${R(n(st.cant) / 1000, 2)} g`;
      const prepTxt = !isFinite(c) ? '' : prepSel ? prepSel[2] : `${cantTxt} en ${st.vol} mL (${cTxt})${regla}`;
      resumen = { conc: prepTxt, dosis: '' };
      if (st.modo === 'bic') {
        const v = C.velocidad(st.dosis, st.uDosis, peso, c, mu);
        $('#cVel').value = isFinite(v) ? `${R(v, 1)} mL/h` : '';
        const dd = C.dosisDesde(st.mlh, st.uDosis, peso, c, mu);
        $('#cDos').value = isFinite(dd) ? `${R(dd, 3)} ${st.uDosis}` : '';
        let bTxt = '';
        if (d.bolo && $('#cBolo')) {
          const tot = n(st.bolo) * (/\/kg/.test(d.bolo.u) ? peso : 1) * (d.bolo.u.startsWith('mcg') && mu === 'mg' ? 0.001 : d.bolo.u.startsWith('mg') && mu === 'mcg' ? 1000 : 1);
          const ml = tot / c;
          const tc = n(st.tCarga) || d.bolo.carga;
          const ok = isFinite(tot) && tot > 0 && isFinite(ml);
          $('#cBolo').value = ok ? `${R(tot, 1)} ${mu} = ${R(ml, 1)} mL` : '';
          if ($('#cCargaVel')) $('#cCargaVel').value = ok && tc > 0 ? `${R(ml * 60 / tc, 1)} mL/h` : '';
          $$('#capa [data-cc="tCarga"]').forEach((b) => b.classList.toggle('sel', +b.dataset.v === tc));
          if ($('#cCargaAviso')) $('#cCargaAviso').textContent = d.bolo.tMin && tc > 0 && tc < d.bolo.tMin ? `⚠ ${d.bolo.nombre} en menos de ${d.bolo.tMin} min es demasiado rápida: pásala en ${d.bolo.tiempos.join(' o ')} min.` : '';
          if (ok) bTxt = d.bolo.carga ? `${d.bolo.nombre} ${st.bolo} ${d.bolo.u} = ${R(tot, 1)} ${mu} (${R(ml, 1)} mL) en ${tc} min = ${R(ml * 60 / tc, 1)} mL/h`
            : `bolo ${st.bolo} ${d.bolo.u} = ${R(tot, 1)} ${mu} (${R(ml, 1)} mL)`;
        }
        const mant = isFinite(v) ? `${d.bolo && d.bolo.carga ? 'mantenimiento' : 'BIC'} ${st.dosis} ${st.uDosis} = ${R(v, 1)} mL/h` : '';
        if (d.bolo && d.bolo.carga && bTxt) resumen.dosis = bTxt + (mant ? `; luego ${mant}` : '') + ` (${peso} kg)`;
        else if (mant) resumen.dosis = mant + ` (${peso} kg)` + (bTxt ? ` · ${bTxt}` : '');
        else if (bTxt) resumen.dosis = bTxt + ` (${peso} kg)`;
      } else if (st.modo === 'roberts') {
        const t = isFinite(c) && peso > 0 ? C.roberts(peso, c) : null;
        $('#cTabla').innerHTML = t ? `<table class="tabla" style="margin-top:6px"><tr><th>Etapa</th><th>Dosis</th><th>Bomba</th></tr>
          ${t.map((x) => `<tr><td class="etq">${x.etapa}</td><td>${x.mgkg ? '1 mg/kg = ' + R(x.mg, 0) + ' mg' : x.mgkgh + ' mg/kg/h'}</td><td><b>${x.ml != null ? R(x.ml, 1) + ' mL' : R(x.mlh, 1) + ' mL/h'}</b></td></tr>`).join('')}</table>` : '<p class="nota">Falta peso o preparación.</p>';
        if (t) resumen.dosis = `Roberts: bolo ${R(t[0].mg, 0)} mg (${R(t[0].ml, 1)} mL) · 10 mg/kg/h = ${R(t[1].mlh, 1)} mL/h ×10 min · 8 mg/kg/h = ${R(t[2].mlh, 1)} mL/h ×10 min · luego 6 mg/kg/h = ${R(t[3].mlh, 1)} mL/h`;
      } else if (st.modo === 'tci') {
        const M = C.MODELOS[st.modelo], pac = { peso, edad: n(st.edad), talla: n(st.talla), sexo: st.sexo }, ct = n(st.ct);
        const falta = M.req.filter((k) => k !== 'sexo' && !(pac[k] > 0));
        if (falta.length || !(ct > 0) || !isFinite(c)) { $('#cTabla').innerHTML = `<p class="nota">Falta: ${[...falta, !(ct > 0) ? 'objetivo' : '', !isFinite(c) ? 'preparación' : ''].filter(Boolean).join(', ')}.</p>`; return; }
        const usarCe = st.obj === 'ce' && M.fn(pac).ke0;
        const T = usarCe ? C.tciCe(st.modelo, pac, ct) : C.tci(st.modelo, pac, ct), k = T.k;
        const rot = (x) => (x.desde != null && x.desde > x.a ? `${R(x.desde, 1)}–${x.b}` : `${x.a}–${x.b}`);
        // masa del modelo: propofol mcg/mL × L = mg; remi/dex ng/mL × L = mcg → coincide con la masa del fármaco
        const mlh = (masaMin) => (masaMin * 60) / c;
        const porKg = (masaMin) => (st.farm === 'Remifentanilo' ? `${R(masaMin / peso, 3)} mcg/kg/min` : st.farm === 'Dexmedetomidina' ? `${R(masaMin * 60 / peso, 2)} mcg/kg/h` : `${R(masaMin * 60 / peso, 1)} mg/kg/h`);
        const avisoLbm = k.lbm != null && (k.lbm < 0.4 * peso || k.lbm > peso) ? '<p class="nota" style="color:var(--peligro)">La masa magra calculada es poco fiable para este peso y talla (obesidad): el modelo puede fallar.</p>' : '';
        $('#cTabla').innerHTML = avisoLbm + `<table class="tabla" style="margin-top:6px"><tr><th>Tramo</th><th>Dosis</th><th>Bomba</th></tr>
          <tr><td class="etq">Bolo inicial</td><td>${R(T.bolo, 1)} ${mu}</td><td><b>${R(T.bolo / c, 1)} mL</b></td></tr>
          ${usarCe ? `<tr><td class="etq" colspan="3">Pausa sin infusión hasta el pico del efecto (${R(T.tpico, 1)} min)</td></tr>` : ''}
          ${T.tramos.map((x) => `<tr><td class="etq">${rot(x)} min</td><td>${porKg(x.masaMin)}</td><td><b>${R(mlh(x.masaMin), 1)} mL/h</b></td></tr>`).join('')}
          <tr><td class="etq">Estable (&gt;4 h)</td><td>${porKg(T.estable)}</td><td><b>${R(mlh(T.estable), 1)} mL/h</b></td></tr></table>
          <p class="nota">${esc(M.nombre)} · V1 ${R(k.V1, 2)} L · k10 ${R(k.k10, 4)} · k12 ${R(k.k12, 4)} · k13 ${R(k.k13, 4)} · k21 ${R(k.k21, 4)} · k31 ${R(k.k31, 4)}${k.ke0 ? ' · ke0 ' + R(k.ke0, 3) : ''}${k.lbm ? ' · masa magra ' + R(k.lbm, 1) + ' kg' : ''}. ${esc(M.nota)}
          ${usarCe ? 'Objetivo en sitio efecto: bolo calculado para que el pico de Ce llegue al objetivo sin pasarlo; luego se mantiene Cp = Ce.' : 'Objetivo plasmático (método BET: bolo–eliminación–transferencia).'}
          Esquema para bomba sin TCI; si tu bomba tiene TCI, programa el modelo y el objetivo directamente.</p>`;
        resumen.dosis = `TCI manual ${M.nombre.split(' (')[0]} ${usarCe ? 'Ce' : 'Cp'} ${ct} ${F().ct.u}: bolo ${R(T.bolo, 1)} ${mu} (${R(T.bolo / c, 1)} mL)` + (usarCe ? `, pausa ${R(T.tpico, 1)}'` : '') + ' · ' +
          T.tramos.slice(0, 7).map((x) => `${rot(x)}' ${R(mlh(x.masaMin), 1)}`).join(' · ') + ` mL/h · estable ${R(mlh(T.estable), 1)} mL/h`;
      } else {
        const L = C.LOCALES[st.local], pct = n(st.pct), vol = n(st.volLA), mgml = pct * 10, mg = mgml * vol;
        const [mgkg, tope] = st.epi ? L.con : L.sin; const max = Math.min(mgkg * peso, tope);
        $('#cTabla').innerHTML = isFinite(mg) && peso > 0 ? `<table class="tabla" style="margin-top:6px">
          <tr><td class="etq">Concentración</td><td><b>${R(mgml, 2)} mg/mL</b></td></tr>
          <tr><td class="etq">Dosis total</td><td><b>${R(mg, 1)} mg</b> (${R(mg / peso, 2)} mg/kg)</td></tr>
          <tr><td class="etq">Máximo orientativo</td><td>${mgkg} mg/kg, tope ${tope} mg → <b>${R(max, 0)} mg</b> (${R(max / mgml, 1)} mL a ${pct} %)</td></tr>
          <tr><td class="etq">Uso</td><td><b style="color:${mg > max ? 'var(--peligro)' : 'var(--ok)'}">${R(100 * mg / max, 0)} % del máximo</b></td></tr></table>
          <p class="nota">Máximos orientativos; ajusta según sitio de bloqueo, edad, embarazo, función hepática/cardíaca y tu protocolo.</p>` : '<p class="nota">Falta peso, concentración o volumen.</p>';
        if (isFinite(mg) && peso > 0) { resumen.conc = `${st.local} ${pct} %${st.epi ? ' con epinefrina' : ''}`; resumen.dosis = `${vol} mL = ${R(mg, 1)} mg (${R(mg / peso, 2)} mg/kg; ${R(100 * mg / max, 0)} % del máx.)`; }
      }
    }
    function usar() {
      calcular();
      if (!resumen.dosis) { aviso('Completa los datos del cálculo'); return; }
      if (st.modo !== 'la') f.farm = st.farm === 'Otra' ? (f.farm || '') : st.farm;
      f.conc = resumen.conc || f.conc; f.dosis = resumen.dosis; f.calc = JSON.parse(JSON.stringify(st));
      if (!H.p.peso && st.peso) H.p.peso = st.peso;
      guardarPronto(); cerrarHoja(); render(); aviso('Cálculo agregado a la infusión');
    }
    pintar();
  }

  /* ---------- Modo crisis (js/crisis.js) ---------- */
  let crisisDesde = 'inicio', crisisMenu = false;
  function ctxCrisis() {
    return { cfg, guardarCfg: () => Store.guardarConfig(cfg), aviso, enlace: (u, t) => enlace(u, t),
      menuAlgos: () => { crisisMenu = true; render(); window.scrollTo(0, 0); },
      irCalc: (farm, peso) => { CT = null; calcIniciar(); CT.tab = 'bic'; calcFarmaco(farm); if (peso) CT.peso = peso; calcDesde = 'crisis'; pantalla = 'calc'; render(); window.scrollTo(0, 0); } };
  }
  function renderCrisis(v) {
    const act = Crisis.activa();
    $('#titulo').textContent = act && !crisisMenu ? 'CRISIS' : 'Crisis: algoritmos';
    if (act && !crisisMenu) Crisis.render(v, ctxCrisis()); else Crisis.renderMenu(v, ctxCrisis());
  }
  function irCrisis() { if (pantalla !== 'crisis') crisisDesde = pantalla; crisisMenu = false; pantalla = 'crisis'; render(); window.scrollTo(0, 0); }
  function crisisAbrir(id) {
    const p = (H && H.p) || {};
    Crisis.iniciar(id, { peso: C_num(p.peso), edad: p.edad || '' });
    if (pantalla !== 'crisis') crisisDesde = pantalla; crisisMenu = false; pantalla = 'crisis'; render(); window.scrollTo(0, 0);
  }
  const C_num = (x) => { const n = parseFloat(String(x || '').replace(',', '.')); return n > 0 ? n : ''; };

  /* ---------- Calculadora TIVA · TCI · BIC (pantalla propia) ---------- */
  let calcDesde = 'inicio', CT = null;
  const PESOS = [['real', 'Real'], ['ideal', 'Ideal'], ['magra', 'Magra'], ['ajustado', 'Ajustado']];
  function calcIniciar() {
    const C = window.CalcInf, p = (H && H.p) || {};
    CT = { tab: 'tiva', peso: p.peso || '', talla: p.talla || '', edad: p.edad || '', sexo: p.sexo || (p.tipoVol === '65' ? 'F' : 'M'), pesoDosis: 'real', esquema: 'roberts', farm: 'Propofol' };
    calcFarmaco(CT.farm);
    return C;
  }
  function calcFarmaco(nombre) {
    const C = window.CalcInf, d = C.FARMACOS[nombre]; CT.farm = nombre;
    CT.uDosis = d.uDosis; CT.uCant = d.masa; CT.cant = d.preps[0] && Array.isArray(d.preps[0]) ? d.preps[0][0] : ''; CT.vol = d.preps[0] && Array.isArray(d.preps[0]) ? d.preps[0][1] : '';
    CT.dosis = d.dosisDef || ''; CT.bolo = d.bolo && d.bolo.prellenar ? d.bolo.def : ''; CT.tCarga = d.bolo && d.bolo.carga ? d.bolo.carga : ''; CT.mlh = '';
    CT.modelo = d.modelos ? d.modelos[0] : ''; CT.ct = d.ct ? d.ct.def : ''; CT.pesoDosis = d.pesoSug || 'real'; CT._regla = '';
    CT.obj = CT.modelo && CT.modelo !== 'marsh' && C.MODELOS[CT.modelo].fn({ peso: 70, talla: 170, edad: 40, sexo: 'M' }).ke0 ? 'ce' : 'cp';
    if (nombre !== 'Propofol') CT.esquema = 'manual';
  }
  function calcLista() {
    const F = window.CalcInf.FARMACOS;
    if (CT.tab === 'tiva') return Object.keys(F).filter((k) => F[k].tiva);
    if (CT.tab === 'tci') return Object.keys(F).filter((k) => F[k].modelos);
    return Object.keys(F);
  }
  function renderCalc(v) {
    const C = window.CalcInf; if (!CT) calcIniciar();
    $('#titulo').textContent = 'TIVA · TCI · BIC';
    const B = (cfg.bomba = cfg.bomba || { u: 'mlh', res: 0.1, gtt: 20 });
    if (!calcLista().includes(CT.farm)) calcFarmaco(calcLista()[0]);
    const d = C.FARMACOS[CT.farm];
    const inp = (k, t, u, o = {}) => `<label class="campo"><span>${t}</span><div class="con-unidad"><input data-ct="${k}" inputmode="decimal" value="${esc(CT[k] == null ? '' : CT[k])}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${u ? `<em>${u}</em>` : ''}</div></label>`;
    const chips = (k, ops, extra = '') => `<div class="opciones"${extra}>${ops.map(([val, t, dis]) => `<button type="button" class="opcion${String(CT[k]) === String(val) ? ' sel' : ''}" data-cc="${k}" data-v="${esc(val)}"${dis ? ' disabled' : ''}>${t}</button>`).join('')}</div>`;
    const seg = (k, ops, obj = CT) => `<div class="segmento">${ops.map(([val, t]) => `<button type="button" class="${String(obj[k]) === String(val) ? 'sel' : ''}" data-cs="${k}" data-v="${val}">${t}</button>`).join('')}</div>`;
    const bio = C.biometria(CT.peso, CT.talla, CT.sexo);
    const fx = (x, dd = 1) => (isFinite(x) ? String(C.r(x, dd)).replace('.', ',') : '—');
    let h = `<section class="tarjeta"><div class="segmento calc-tabs">${[['tiva', 'TIVA'], ['tci', 'TCI'], ['bic', 'BIC']].map(([k, t]) => `<button type="button" class="${CT.tab === k ? 'sel' : ''}" data-cs="tab" data-v="${k}">${t}</button>`).join('')}</div>
      <p class="nota" style="margin:8px 0 0">${CT.tab === 'tiva' ? 'Anestesia total intravenosa con esquemas manuales: propofol (Roberts 10–8–6 o dosis por peso), remifentanilo y coadyuvantes.' : CT.tab === 'tci' ? 'Infusión controlada por objetivo: el modelo farmacocinético calcula el bolo y las velocidades para alcanzar y mantener la concentración elegida. Sirve para programar a mano una bomba sin TCI.' : 'Bomba de infusión continua: convierte cualquier dosis en velocidad (y al revés), con bolo o carga.'}</p></section>`;
    // Paciente
    h += card('Paciente', `<div class="rejilla">${inp('peso', 'Peso', 'kg')}${inp('talla', 'Talla', 'cm')}${inp('edad', 'Edad', 'años')}
        <label class="campo"><span>Sexo</span><select data-ct="sexo"><option value="M"${CT.sexo === 'M' ? ' selected' : ''}>Masculino</option><option value="F"${CT.sexo === 'F' ? ' selected' : ''}>Femenino</option></select></label></div>
      <div class="bio" id="ctBio">${calcBioHtml(bio, fx)}</div>
      ${CT.tab !== 'tci' ? `<div class="grupo" style="margin-top:10px"><div class="etq">Peso para dosificar</div>${chips('pesoDosis', PESOS.map(([k, t]) => [k, t, k !== 'real' && !isFinite(bio[k])]))}</div>
      <p class="nota" id="ctPesoNota" style="margin-top:4px">${calcPesoNota(bio, d)}</p>` : '<p class="nota" style="margin-top:8px">Los modelos usan sus propias covariables (peso real, talla, edad, sexo).</p>'}`);
    // Bomba
    h += card('Bomba', `<div class="grupo"><div class="etq">¿En qué unidad programa tu bomba?</div>${seg('u', [['mlh', 'mL/h'], ['mlmin', 'mL/min'], ['gtt', 'gotas/min']], B).replace(/data-cs=/g, 'data-cb=')}</div>
      ${B.u === 'mlh' ? `<div class="grupo"><div class="etq">Resolución de la bomba</div>${seg('res', [['0.1', '0,1 mL/h'], ['1', '1 mL/h']], { res: String(B.res) }).replace(/data-cs=/g, 'data-cb=')}</div>` : ''}
      ${B.u === 'gtt' ? `<div class="grupo"><div class="etq">Equipo de venoclisis</div>${seg('gtt', [['20', 'Macrogotero 20 gotas/mL'], ['60', 'Microgotero 60 gotas/mL']], { gtt: String(B.gtt) }).replace(/data-cs=/g, 'data-cb=')}</div>` : ''}
      <p class="nota" style="margin:4px 0 0">La mayoría de las bombas de jeringa y volumétricas usan mL/h. Se recuerda para la próxima vez.</p>`);
    // Fármaco y concentración
    h += card('Fármaco y concentración', `${chips('farm', calcLista().map((k) => [k, k]))}
      ${d.preps.length ? `<div class="grupo" style="margin-top:10px"><div class="etq">Preparación</div>${chips('prep', d.preps.map((p, j) => [j, Array.isArray(p) ? p[2] : p.label]))}</div>` : ''}
      <div class="rejilla" style="margin-top:8px"><label class="campo"><span>Cantidad de fármaco</span><div class="con-unidad"><input data-ct="cant" inputmode="decimal" value="${esc(CT.cant)}">
        <select data-ct="uCant" style="width:auto">${['g', 'mg', 'mcg'].map((u) => `<option${(CT.uCant || d.masa) === u ? ' selected' : ''}>${u}</option>`).join('')}</select></div></label>
        ${inp('vol', 'Volumen total', 'mL')}<label class="campo calc"><span>Concentración [ ]</span><input readonly id="ctConc"></label></div>`);
    // Dosis
    if (CT.tab === 'tci') {
      h += card('Modelo y objetivo', `${chips('modelo', d.modelos.map((m) => [m, C.MODELOS[m].nombre]))}
        ${C.MODELOS[CT.modelo].fn({ peso: 70, talla: 170, edad: 40, sexo: 'M' }).ke0 ? `<div class="grupo" style="margin-top:8px"><div class="etq">Objetivo</div>${seg('obj', [['ce', 'Sitio efecto (Ce)'], ['cp', 'Plasma (Cp)']])}</div>` : ''}
        <div class="rejilla" style="margin-top:8px">${inp('ct', 'Concentración objetivo', d.ct.u)}</div>
        ${d.ct.rapidos ? chips('ct', d.ct.rapidos.map((x) => [x, String(x).replace('.', ',')])) : ''}<p class="nota">${esc(d.ct.rango)}</p><div id="ctRes"></div>`);
    } else {
      const roberts = CT.tab === 'tiva' && d.roberts;
      if (roberts) h += `<section class="tarjeta"><h2>Esquema</h2>${seg('esquema', [['roberts', 'Roberts 10–8–6'], ['manual', 'Dosis por peso']])}</section>`;
      if (roberts && CT.esquema === 'roberts') {
        h += card('Esquema de Roberts', `<p class="nota" style="margin-top:0">Bolo 1 mg/kg y luego 10, 8 y 6 mg/kg/h, cambiando a los 10 y 20 min. Busca ≈ 3 mcg/mL en plasma (con opioide). Reduce en ancianos o ASA III–IV.</p><div id="ctRes"></div>`);
      } else {
        const carga = d.bolo && d.bolo.carga;
        const bloqueBolo = d.bolo ? `<h3 style="margin-top:0">${carga ? '1. ' + d.bolo.nombre : 'Bolo'}</h3><p class="nota" style="margin-top:0">${esc(d.bolo.rango)}</p>
          ${carga && d.bolo.tiempos ? `<div class="grupo"><div class="etq">Pasar en</div>${chips('tCarga', d.bolo.tiempos.map((t) => [t, t + ' min']))}</div>` : ''}
          <div class="rejilla">${inp('bolo', 'Dosis', d.bolo.u, { ph: 'Ej. ' + d.bolo.def })}${carga ? inp('tCarga', 'Pasar en', 'min') : ''}
          <label class="campo calc"><span>Total</span><input readonly id="ctBolo"></label>${carga ? '<label class="campo calc"><span>Bomba durante la carga</span><input readonly id="ctCarga"></label>' : ''}</div><p class="nota" id="ctBoloAviso" style="color:var(--peligro)"></p>` : '';
        h += card('Dosis y velocidad', `${carga ? bloqueBolo + '<h3>2. Mantenimiento</h3>' : ''}<p class="nota" style="margin-top:0">${esc(d.rango || '')}</p>
          <div class="rejilla">${inp('dosis', 'Dosis', '')}<label class="campo"><span>Unidad</span><select data-ct="uDosis">${d.unidades.map((u) => `<option${CT.uDosis === u ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
          <label class="campo calc"><span>Velocidad</span><input readonly id="ctVel" class="grande"></label></div>
          <p class="nota" id="ctDura" style="margin:2px 0 6px"></p>
          ${d.rapidas && CT.uDosis === d.uDosis ? chips('dosis', d.rapidas.map((x) => [x, String(x).replace('.', ',') + ' ' + d.uDosis])) : ''}
          <h3>De la bomba a la dosis</h3><div class="rejilla">${inp('mlh', 'Velocidad actual', B.u === 'mlmin' ? 'mL/min' : B.u === 'gtt' ? 'gotas/min' : 'mL/h')}<label class="campo calc"><span>Equivale a</span><input readonly id="ctDos"></label></div>
          ${carga ? '' : bloqueBolo ? '<div style="margin-top:12px">' + bloqueBolo + '</div>' : ''}`);
      }
    }
    h += `<section class="tarjeta"><div id="ctResumen" class="calc-resumen"></div>
      <div class="fila-btn" style="margin-bottom:0">${H && calcDesde === 'editor' ? '<button class="primario" id="ctUsar">Agregar a la historia</button>' : ''}<button class="secundario" id="ctLimpiar">Limpiar</button></div>
      <p class="nota">Cálculos de referencia. Verifica siempre con la bomba, la etiqueta de la jeringa y tu criterio clínico; titula según la respuesta y la monitorización (BIS/EEG, hemodinamia).</p></section>`;
    v.innerHTML = h;
    // Eventos
    $$('#vista [data-ct]').forEach((e) => { e.oninput = e.onchange = () => { CT[e.dataset.ct] = e.value; if (e.dataset.ct === 'uDosis' || e.dataset.ct === 'sexo') { render(); return; } calcCalcular(); }; });
    $$('#vista [data-cc]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.cc, val = b.dataset.v, dd = C.FARMACOS[CT.farm];
      if (k === 'farm') calcFarmaco(val);
      else if (k === 'prep') { const p = dd.preps[+val];
        if (Array.isArray(p)) { CT.cant = p[0]; CT.vol = p[1]; CT.uCant = dd.masa; CT._regla = ''; }
        else { const w = C.num(CT.peso); if (!(w > 0)) { aviso('Escribe el peso para la regla de los 6'); return; } CT.cant = C.r(p.porKg * w, 2); CT.vol = p.vol; CT.uCant = 'mg'; CT._regla = p.label; } }
      else if (k === 'modelo') { CT.modelo = val; CT.obj = val !== 'marsh' && C.MODELOS[val].fn({ peso: 70, talla: 170, edad: 40, sexo: 'M' }).ke0 ? 'ce' : 'cp'; }
      else CT[k] = val;
      render();
    }));
    $$('#vista [data-cs]').forEach((b) => (b.onclick = () => { CT[b.dataset.cs] = b.dataset.v; render(); }));
    $$('#vista [data-cb]').forEach((b) => (b.onclick = () => { const k = b.dataset.cb; B[k] = k === 'u' ? b.dataset.v : +b.dataset.v; CT.mlh = ''; Store.guardarConfig(cfg); render(); }));
    $('#ctLimpiar').onclick = () => { CT = null; render(); };
    if ($('#ctUsar')) $('#ctUsar').onclick = calcUsar;
    calcCalcular();
  }
  function calcBioHtml(b, fx) {
    if (!isFinite(b.real)) return '<p class="nota" style="margin:6px 0 0">Escribe el peso y la talla para ver IMC, peso ideal, masa magra y peso ajustado.</p>';
    if (!isFinite(b.imc)) return '<p class="nota" style="margin:6px 0 0">Agrega la talla para calcular IMC, peso ideal, masa magra y peso ajustado.</p>';
    const t = (et, val, u, sub) => `<div class="bio-t"><small>${et}</small><b>${val}${u ? ' <em>' + u + '</em>' : ''}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return t('IMC', fx(b.imc), 'kg/m²', b.cat) + t('Peso ideal', fx(b.ideal), 'kg', 'Devine') + t('Masa magra', fx(b.magra), 'kg', 'Janmahasatian') + t('Peso ajustado', fx(b.ajustado), 'kg', 'Ideal + 40 % del exceso') + t('Sup. corporal', fx(b.sc, 2), 'm²', 'Mosteller');
  }
  function calcPesoNota(b, d) {
    const w = b[CT.pesoDosis];
    let n = isFinite(w) ? `Dosis por kg calculadas con <b>${String(window.CalcInf.r(w, 1)).replace('.', ',')} kg</b> (peso ${PESOS.find((x) => x[0] === CT.pesoDosis)[1].toLowerCase()}).` : '';
    if (d.pesoSug === 'ideal') n += ' Para lidocaína se usa el peso ideal.';
    if (b.imc >= 30) n += ' En obesidad se suele dosificar por masa magra o peso ajustado (relajantes no despolarizantes: masa magra; succinilcolina: peso real; sugammadex: ideal + 40 %, SOBA 2025). Titula con monitorización.';
    return n;
  }
  let calcRes = { conc: '', dosis: '' };
  function calcConc() {
    const d = window.CalcInf.FARMACOS[CT.farm], c = window.CalcInf.num(CT.cant), vv = window.CalcInf.num(CT.vol);
    if (!(c > 0 && vv > 0)) return NaN;
    return (c * ({ g: 1000, mg: 1, mcg: 0.001 }[CT.uCant || d.masa]) / ({ mg: 1, mcg: 0.001 }[d.masa])) / vv;
  }
  function calcCalcular() {
    const C = window.CalcInf, d = C.FARMACOS[CT.farm], mu = d.masa, B = cfg.bomba, n = C.num, R = C.r;
    const bio = C.biometria(CT.peso, CT.talla, CT.sexo);
    if ($('#ctBio')) $('#ctBio').innerHTML = calcBioHtml(bio, (x, dd = 1) => (isFinite(x) ? String(R(x, dd)).replace('.', ',') : '—'));
    if ($('#ctPesoNota')) $('#ctPesoNota').innerHTML = calcPesoNota(bio, d);
    $$('#vista [data-cc="pesoDosis"]').forEach((b) => { b.disabled = b.dataset.v !== 'real' && !isFinite(bio[b.dataset.v]); });
    const peso = CT.tab === 'tci' ? n(CT.peso) : bio[CT.pesoDosis] || (CT.pesoDosis === 'real' ? n(CT.peso) : NaN);
    const c = calcConc(), cTxt = isFinite(c) ? `${String(R(c, c < 1 ? 3 : 2)).replace('.', ',')} ${mu}/mL` : '';
    $('#ctConc').value = cTxt;
    const bomba = (mlh) => C.enBomba(mlh, B);
    const aMlh = (x) => { const y = n(x); return B.u === 'mlmin' ? y * 60 : B.u === 'gtt' ? (y * 60) / (B.gtt || 20) : y; };
    let prepTxt = ''; if (isFinite(c)) { const ps = (d.preps || []).find((p) => Array.isArray(p) && +p[0] === +CT.cant && +p[1] === +CT.vol && (CT.uCant || mu) === mu); prepTxt = ps ? ps[2] : `${CT.cant} ${CT.uCant || mu} en ${CT.vol} mL (${cTxt})`; }
    calcRes = { conc: prepTxt, dosis: '' };
    const pTxt = isFinite(peso) ? ` (${String(R(peso, 1)).replace('.', ',')} kg${CT.tab !== 'tci' && CT.pesoDosis !== 'real' ? ' ' + CT.pesoDosis : ''})` : '';
    let res = '';
    if (CT.tab === 'tci') {
      const M = C.MODELOS[CT.modelo], pac = { peso: n(CT.peso), edad: n(CT.edad), talla: n(CT.talla), sexo: CT.sexo }, ct = n(CT.ct);
      const falta = M.req.filter((k) => k !== 'sexo' && !(pac[k] > 0));
      if (falta.length || !(ct > 0) || !isFinite(c)) { $('#ctRes').innerHTML = `<p class="nota">Falta: ${[...falta, !(ct > 0) ? 'objetivo' : '', !isFinite(c) ? 'preparación' : ''].filter(Boolean).join(', ')}.</p>`; $('#ctResumen').innerHTML = ''; return; }
      const usarCe = CT.obj === 'ce' && M.fn(pac).ke0;
      const T = usarCe ? C.tciCe(CT.modelo, pac, ct) : C.tci(CT.modelo, pac, ct), k = T.k;
      const rot = (x) => (x.desde != null && x.desde > x.a ? `${String(R(x.desde, 1)).replace('.', ',')}–${x.b}` : `${x.a}–${x.b}`);
      const mlh = (m) => (m * 60) / c, w = pac.peso;
      const porKg = (m) => (CT.farm === 'Remifentanilo' ? `${R(m / w, 3)} mcg/kg/min` : CT.farm === 'Dexmedetomidina' ? `${R(m * 60 / w, 2)} mcg/kg/h` : `${R(m * 60 / w, 1)} mg/kg/h`).replace('.', ',');
      const avisos = [];
      if (k.lbm != null && (k.lbm < 0.4 * w || k.lbm > w)) avisos.push('La masa magra de James es poco fiable con este peso y talla (obesidad): el modelo puede fallar.');
      else if (bio.imc >= 35) avisos.push(`IMC ${String(R(bio.imc, 1)).replace('.', ',')}: ${CT.modelo === 'marsh' ? 'Marsh usa el peso real y tiende a sobredosificar en obesos (muchos usan el peso ajustado).' : 'los modelos clásicos se validaron en no obesos; titula con monitorización.'}`);
      if (pac.edad > 0 && pac.edad < 16) avisos.push('Modelo de adultos: no validado en menores de 16 años.');
      if (pac.edad >= 65 && CT.farm === 'Propofol') avisos.push('Adulto mayor: objetivos más bajos y cambios de 0,5 en 0,5, guiados por EEG.');
      res = avisos.map((a) => `<p class="nota" style="color:var(--peligro)">⚠ ${esc(a)}</p>`).join('') + `<div class="desplaza"><table class="tabla" style="margin-top:6px"><tr><th>Tramo</th><th>Dosis</th><th>Bomba</th></tr>
        <tr><td class="etq">Bolo inicial</td><td>${String(R(T.bolo, 1)).replace('.', ',')} ${mu}</td><td><b>${String(R(T.bolo / c, 1)).replace('.', ',')} mL</b></td></tr>
        ${usarCe ? `<tr><td class="etq" colspan="3">Pausa sin infusión hasta el pico del efecto (${String(R(T.tpico, 1)).replace('.', ',')} min)</td></tr>` : ''}
        ${T.tramos.map((x) => `<tr><td class="etq">${rot(x)} min</td><td>${porKg(x.masaMin)}</td><td><b>${bomba(mlh(x.masaMin))}</b></td></tr>`).join('')}
        <tr><td class="etq">Estable (&gt;4 h)</td><td>${porKg(T.estable)}</td><td><b>${bomba(mlh(T.estable))}</b></td></tr></table></div>
        <p class="nota">${esc(M.nombre)} · V1 ${R(k.V1, 2)} L · k10 ${R(k.k10, 4)} · k12 ${R(k.k12, 4)} · k13 ${R(k.k13, 4)} · k21 ${R(k.k21, 4)} · k31 ${R(k.k31, 4)}${k.ke0 ? ' · ke0 ' + R(k.ke0, 3) : ''}${k.lbm ? ' · masa magra (James) ' + R(k.lbm, 1) + ' kg' : ''}. ${esc(M.nota)}
        ${usarCe ? 'Sitio efecto: el bolo lleva el pico de Ce justo al objetivo, sin pasarlo; luego se mantiene Cp = Ce.' : 'Objetivo plasmático (método BET: bolo, eliminación y transferencia).'} Si tu bomba tiene TCI, programa el modelo y el objetivo directamente.</p>`;
      $('#ctRes').innerHTML = res;
      calcRes.dosis = `TCI manual ${M.nombre.split(' (')[0]} ${usarCe ? 'Ce' : 'Cp'} ${ct} ${d.ct.u}: bolo ${R(T.bolo, 1)} ${mu} (${R(T.bolo / c, 1)} mL)` + (usarCe ? `, pausa ${R(T.tpico, 1)}'` : '') + ' · ' +
        T.tramos.slice(0, 7).map((x) => `${rot(x)}' ${bomba(mlh(x.masaMin))}`).join(' · ') + ` · estable ${bomba(mlh(T.estable))}`;
    } else if (CT.tab === 'tiva' && d.roberts && CT.esquema === 'roberts') {
      const t = isFinite(c) && peso > 0 ? C.roberts(peso, c) : null;
      $('#ctRes').innerHTML = t ? `<table class="tabla" style="margin-top:6px"><tr><th>Etapa</th><th>Dosis</th><th>Bomba</th></tr>
        ${t.map((x) => `<tr><td class="etq">${x.etapa}</td><td>${x.mgkg ? '1 mg/kg = ' + R(x.mg, 0) + ' mg' : x.mgkgh + ' mg/kg/h'}</td><td><b>${x.ml != null ? String(R(x.ml, 1)).replace('.', ',') + ' mL' : bomba(x.mlh)}</b></td></tr>`).join('')}</table>` : '<p class="nota">Falta peso o preparación.</p>';
      if (t) calcRes.dosis = `Roberts${pTxt}: bolo ${R(t[0].mg, 0)} mg (${R(t[0].ml, 1)} mL) · 10 mg/kg/h = ${bomba(t[1].mlh)} ×10 min · 8 mg/kg/h = ${bomba(t[2].mlh)} ×10 min · luego 6 mg/kg/h = ${bomba(t[3].mlh)}`;
    } else {
      const vel = C.velocidad(CT.dosis, CT.uDosis, peso, c, mu);
      $('#ctVel').value = isFinite(vel) ? bomba(vel) : '';
      const dd = C.dosisDesde(aMlh(CT.mlh), CT.uDosis, peso, c, mu);
      $('#ctDos').value = isFinite(dd) && n(CT.mlh) > 0 ? `${String(R(dd, 3)).replace('.', ',')} ${CT.uDosis}` : '';
      let bTxt = '';
      if (d.bolo && $('#ctBolo')) {
        const tot = n(CT.bolo) * (/\/kg/.test(d.bolo.u) ? peso : 1) * (d.bolo.u.startsWith('mcg') && mu === 'mg' ? 0.001 : d.bolo.u.startsWith('mg') && mu === 'mcg' ? 1000 : 1);
        const ml = tot / c, tc = n(CT.tCarga) || d.bolo.carga, ok = isFinite(tot) && tot > 0 && isFinite(ml);
        $('#ctBolo').value = ok ? `${String(R(tot, 1)).replace('.', ',')} ${mu} = ${String(R(ml, 1)).replace('.', ',')} mL` : '';
        if ($('#ctCarga')) $('#ctCarga').value = ok && tc > 0 ? bomba((ml * 60) / tc) : '';
        const vPrep = n(CT.vol), avB = $('#ctBoloAviso');
        $$('#vista [data-cc="tCarga"]').forEach((b) => b.classList.toggle('sel', +b.dataset.v === n(CT.tCarga)));
        if (avB && d.bolo.tMin && n(CT.tCarga) > 0 && n(CT.tCarga) < d.bolo.tMin) avB.textContent = `⚠ ${d.bolo.nombre} en menos de ${d.bolo.tMin} min es demasiado rápida: pásala en ${d.bolo.tiempos.join(' o ')} min.`;
        else if (avB) avB.textContent = ok && vPrep > 0 && ml > vPrep ? `⚠ El ${d.bolo.carga ? 'volumen de la carga' : 'bolo'} (${String(R(ml, 1)).replace('.', ',')} mL) supera el volumen de la preparación (${vPrep} mL): usa una preparación más concentrada o prepara aparte.` : '';
        if (ok) bTxt = d.bolo.carga ? `${d.bolo.nombre} ${CT.bolo} ${d.bolo.u} = ${R(tot, 1)} ${mu} (${R(ml, 1)} mL) en ${tc} min = ${bomba((ml * 60) / tc)}` : `bolo ${CT.bolo} ${d.bolo.u} = ${R(tot, 1)} ${mu} (${R(ml, 1)} mL)`;
      }
      const vp = n(CT.vol), durH = isFinite(vel) && vel > 0 && vp > 0 ? vp / vel : NaN;
      const durTxt = isFinite(durH) ? (durH >= 1 ? `${Math.floor(durH)} h ${Math.round((durH % 1) * 60)} min` : `${Math.round(durH * 60)} min`) : '';
      if ($('#ctDura')) $('#ctDura').textContent = durTxt ? `A esta velocidad, la preparación de ${vp} mL dura ≈ ${durTxt}.` : '';
      const mant = isFinite(vel) ? `${CT.dosis} ${CT.uDosis} = ${bomba(vel)}` : '';
      calcRes.dosis = [bTxt, mant && (bTxt && d.bolo.carga ? 'luego ' : '') + mant].filter(Boolean).join(d.bolo && d.bolo.carga ? '; ' : ' · ') + (bTxt || mant ? pTxt : '');
    }
    calcRes.dosis = calcRes.dosis.replace(/(\d)\.(\d)/g, '$1,$2'); calcRes.conc = calcRes.conc.replace(/(\d)\.(\d)/g, '$1,$2');
    $('#ctResumen').innerHTML = calcRes.dosis ? `<div class="etq">Resumen</div><p style="margin:4px 0 0"><b>${esc(CT.farm)}</b>${calcRes.conc ? ' · ' + esc(calcRes.conc) : ''}</p><p style="margin:4px 0 0">${esc(calcRes.dosis)}</p>` : '<p class="nota" style="margin:0">Completa los datos para ver el resumen.</p>';
  }
  function calcUsar() {
    calcCalcular();
    if (!calcRes.dosis) { aviso('Completa los datos del cálculo'); return; }
    H.inf = H.inf || []; H.inf.push({ farm: CT.farm === 'Otra' ? '' : CT.farm, conc: calcRes.conc, dosis: calcRes.dosis });
    if (!H.p.peso && CT.peso) H.p.peso = CT.peso; if (!H.p.talla && CT.talla) H.p.talla = CT.talla;
    guardarPronto(); aviso('Agregado a Mezcla / Infusión de la historia');
  }

  /* ---------- Pistas: gases, inhalatorio, opioide, relajante y drogas ---------- */
  function txtEvento(dd, e) {
    if (dd.tipo === 'gas') {
      if (e.tipo === 'stop') return 'Cierra flujo';
      if (dd.id !== 'aire') return `${esc(e.v)} L/min`;
      const g = Pistas.gasDe(H.to.pistas.aire, e);
      return `<b style="color:${Pistas.GAS[g]}">${g === 'N2O' ? 'N₂O' : 'Aire'}</b> ${esc(e.v)} L/min`;
    }
    if (dd.tipo === 'inh') return e.tipo === 'stop' ? 'Cierra vaporizador' : `${esc(e.v)} %` + (e.fgf ? ` · FGF ${esc(e.fgf)} L/min` : '');
    if (dd.tipo === 'sol') { const info = Pistas.SOL[e.v]; return `<b>${esc(e.v === 'Otro' ? (e.txt || '?') : e.v)}</b>` + (info ? ' — ' + esc(info.nombre) : e.v === 'Otro' && e.txtLargo ? ' — ' + esc(e.txtLargo) : ''); }
    return e.tipo === 'stop' ? 'Suspende infusión' : (e.tipo === 'inf' ? 'Infusión ' : 'Bolo ') + `${esc(e.v)} ${esc(e.u || '')}`;
  }
  /* Vía / catéter por botones: VP 1-2, calibre, miembro superior/inferior y lado; VC con sitio y lado */
  function viaDe(fila) {
    const V = (H.to.vias = H.to.vias || {});
    return (V[fila] = V[fila] || (fila === 7 ? { t: 'VC' } : { t: 'VP', n: fila === 9 ? '2' : '1' }));
  }
  function viaTexto(v) {
    if (v.t === 'VC') return ['VC', v.cal ? '#' + v.cal : '', v.sit || '', v.l || ''].filter(Boolean).join(' ');
    return [('VP' + (v.n || '')), v.cal ? '#' + v.cal : '', v.m || v.l ? 'M' + (v.m || '') + (v.l || '') : ''].filter(Boolean).join(' ');
  }
  function viaHtml(fila) {
    const v = viaDe(fila);
    const b = (c, val, txt) => `<button type="button" class="${String(v[c] || '') === val ? 'sel' : ''}" data-acc="via" data-f="${fila}" data-c="${c}" data-v="${val}">${txt}</button>`;
    const fila1 = `<div class="via-fila"><span>Vía</span><div class="segmento">${b('t', 'VP', 'Periférica')}${b('t', 'VC', 'Central')}</div>
      ${v.t === 'VP' ? `<div class="segmento">${b('n', '1', 'VP 1')}${b('n', '2', 'VP 2')}</div>` : ''}</div>`;
    const cals = v.t === 'VC' ? ['4', '5', '7', '8'] : ['14', '16', '18', '20', '22', '24'];
    const fila2 = `<div class="via-fila"><span>${v.t === 'VC' ? 'Calibre (Fr)' : 'Calibre #'}</span><div class="segmento">${cals.map((c) => b('cal', c, c)).join('')}</div></div>`;
    const fila3 = v.t === 'VC'
      ? `<div class="via-fila"><span>Sitio</span><div class="segmento">${b('sit', 'YI', 'Yugular int.')}${b('sit', 'SC', 'Subclavia')}${b('sit', 'F', 'Femoral')}</div><div class="segmento">${b('l', 'D', 'Der')}${b('l', 'I', 'Izq')}</div></div>`
      : `<div class="via-fila"><span>Miembro</span><div class="segmento">${b('m', 'S', 'Superior')}${b('m', 'I', 'Inferior')}</div><div class="segmento">${b('l', 'D', 'Der')}${b('l', 'I', 'Izq')}</div></div>`;
    return `<div class="via">${fila1}${fila2}${fila3}</div>`;
  }
  function secPistas() {
    const P = Pistas, ps = H.to.pistas, peso = H.p.peso;
    const bloques = P.DEF.map((dd) => {
      const p = ps[dd.id]; const color = P.colorDe(dd.id, p);
      let sel = '';
      if (dd.id === 'aire') sel = '<p class="nota" style="margin-top:0">En cada registro eliges Aire (amarillo) o N₂O (azul); la línea cambia de color cuando cambias de gas.</p>';
      else if (dd.tipo === 'sol') sel = viaHtml(dd.fila) + `<label class="campo" style="margin-top:8px"><span>Así sale en la hoja (puedes editarlo)</span><input data-k="to.filas.${dd.fila}" value="${esc((H.to.filas || [])[dd.fila] || '')}" placeholder="${dd.fila === 7 ? 'Ej. VC #7 YI D' : 'Ej. VP1 #18 MSD'}"></label>
        <p class="nota" style="margin:6px 0 0">Cada solución se marca con la bolsa invertida a su hora de inicio; al poner la hora de fin, la línea negra termina en una rayita vertical.</p>`;
      else if (dd.tipo === 'inh') sel = `<div class="opciones">${Object.entries(P.INH).map(([n, x]) => `<button type="button" class="opcion${p.agente === n ? ' sel' : ''}" data-acc="pAg" data-p="inh" data-v="${n}"><span class="punto" style="background:${x.color}"></span>${n}</button>`).join('')}</div>`;
      else if (dd.tipo === 'farm') {
        const lista = P.LISTAS[dd.lista]; const otro = p.agente && !lista.includes(p.agente);
        sel = `<select data-pagsel="${dd.id}" class="selpista"><option value="">— Elegir ${dd.lista === 'opi' ? 'opioide' : dd.lista === 'rel' ? 'relajante' : 'medicamento'} —</option>${lista.map((n) => `<option${p.agente === n ? ' selected' : ''}>${n}</option>`).join('')}<option value="__otro"${otro ? ' selected' : ''}>Otro…</option></select>` +
          (otro || p._otro ? `<label class="campo" style="margin-top:6px"><span>Nombre</span><input data-k="to.pistas.${dd.id}.agente" value="${esc(p.agente || '')}"></label>` : '');
      }
      let infoTxt = '';
      if (dd.tipo === 'inh' && p.agente) {
        const cam = P.camEdad(p.agente, H.p.edad);
        infoTxt = `CAM ${esc(p.agente)} ajustada a ${H.p.edad ? esc(H.p.edad) + ' años' : '40 años (sin edad)'}: <b>${P.r1(cam, 2)} %</b>`;
        const c = P.consumo(H);
        if (c) infoTxt += `<br>Consumo estimado: <b>${P.r1(c.ml, 1)} mL</b> de líquido (${c.min} min, FGF prom. ${P.r1(c.fgfProm, 1)} L/min)${c.sinFgf ? ` · ${c.sinFgf} min sin flujo de O₂/aire registrado` : ''}`;
      } else if (dd.tipo === 'farm' && P.FARM[p.agente]) {
        infoTxt = P.guia(p.agente, peso).map((g) => esc(g.txt)).join('<br>') + (P.FARM[p.agente].nota ? '<br>' + esc(P.FARM[p.agente].nota) : '') + (peso ? '' : '<br><i>Escribe el peso para calcular las dosis.</i>');
      }
      const ev = (p.ev || []).map((e, i) => ({ e, i })).sort((a, b) => (Pistas.off(H.to, a.e.hora) || 0) - (Pistas.off(H.to, b.e.hora) || 0));
      const lista = ev.length ? ev.map(({ e, i }) => `<div class="evento"><b>${esc(e.hora)}${dd.tipo === 'sol' && e.fin ? '–' + esc(e.fin) : ''}</b><span>${txtEvento(dd, e)}</span>
        ${dd.tipo === 'sol' && !e.fin ? `<button class="secundario chico" data-acc="solFin" data-p="${dd.id}" data-i="${i}">Terminó ahora</button>` : ''}
        <button class="icono chico" data-acc="pEv" data-p="${dd.id}" data-i="${i}" aria-label="Editar">✎</button></div>`).join('') : '';
      let btns = '';
      if (dd.tipo === 'gas') btns = `<button class="secundario chico" data-acc="pEv" data-p="${dd.id}" data-t="valor">+ Flujo / cambio</button><button class="secundario chico" data-acc="pEv" data-p="${dd.id}" data-t="stop">Cerrar</button>`;
      else if (dd.tipo === 'sol') btns = `<button class="secundario chico" data-acc="pEv" data-p="${dd.id}" data-t="valor">+ Solución</button>`;
      else if (dd.tipo === 'inh') btns = `<button class="secundario chico" data-acc="pEv" data-p="inh" data-t="valor">+ % vaporizador</button><button class="secundario chico" data-acc="pEv" data-p="inh" data-t="stop">Cerrar vaporizador</button>`;
      else btns = `<button class="secundario chico" data-acc="pEv" data-p="${dd.id}" data-t="bolo">+ Bolo</button><button class="secundario chico" data-acc="pEv" data-p="${dd.id}" data-t="inf">+ Infusión / cambio</button><button class="secundario chico" data-acc="pEv" data-p="${dd.id}" data-t="stop">Suspender</button>`;
      return `<div class="pista" style="border-left-color:${dd.id === 'aire' ? P.GAS[P.gasDe(p, (p.ev || []).slice(-1)[0])] : color}"><div class="pista-t"><span>${dd.id === 'aire' ? `<span class="punto" style="background:${P.GAS.Aire}"></span> Aire / <span class="punto" style="background:${P.GAS.N2O}"></span> N₂O` : (dd.tipo === 'gas' ? `<span class="punto" style="background:${color}"></span> ` : '') + esc(dd.nombre)}</span>${p.agente && dd.tipo !== 'gas' && dd.tipo !== 'sol' ? `<b style="color:${color}">${esc(p.agente)}</b>` : ''}</div>
        ${sel}${infoTxt ? `<p class="nota">${infoTxt}</p>` : ''}${lista}<div class="fila-btn">${btns}</div></div>`;
    }).join('');
    return card('Fármacos y gases (grilla)', '<p class="nota" style="margin:0 0 10px">Cada registro queda en la hora exacta. Los bolos se marcan con ▼ y la dosis; los gases (O₂ verde, aire amarillo, N₂O azul), el inhalatorio y las infusiones con una línea de su color que se corta en cada cambio.</p>' + bloques);
  }
  function abrirEvento(id, idx, tipoPre) {
    const P = Pistas, dd = P.info(id), p = H.to.pistas[id]; const nuevo = idx == null;
    const e = nuevo ? { hora: ahoraHM(), tipo: tipoPre === 'valor' ? undefined : tipoPre } : JSON.parse(JSON.stringify(p.ev[idx]));
    const tipo = e.tipo || (dd.tipo === 'farm' ? 'bolo' : 'valor');
    if (!H.to.inicio) { const m = minDe(e.hora); const nm = Math.floor(m / 5) * 5; H.to.inicio = String(Math.floor(nm / 60)).padStart(2, '0') + ':' + String(nm % 60).padStart(2, '0'); }
    const f = P.FARM[p.agente]; const g = f ? P.guia(p.agente, H.p.peso) : [];
    let cuerpo = dd.tipo === 'sol'
      ? `<div class="rejilla"><label class="campo"><span>Inicio</span><div class="con-unidad"><input type="time" id="evHora" value="${esc(e.hora)}"><button type="button" class="secundario chico" data-ahora="evHora">Ahora</button></div></label>
        <label class="campo"><span>Fin (si ya terminó)</span><div class="con-unidad"><input type="time" id="evFin" value="${esc(e.fin || '')}"><button type="button" class="secundario chico" data-ahora="evFin">Ahora</button></div></label>`
      : `<div class="rejilla"><label class="campo"><span>Hora</span><input type="time" id="evHora" value="${esc(e.hora)}"></label>`;
    let chipsHtml = '';
    if (tipo === 'stop') cuerpo += '</div>';
    else if (dd.tipo === 'gas') {
      cuerpo += `<label class="campo"><span>Flujo</span><div class="con-unidad"><input id="evV" inputmode="decimal" value="${esc(e.v || '')}"><em>L/min</em></div></label></div>`;
      if (id === 'aire') {
        const prev = nuevo ? P.ordenados(H.to, p).filter((x) => x.tipo !== 'stop').slice(-1)[0] : e;
        const gSel = P.gasDe(p, prev);
        cuerpo += `<div class="segmento" id="evGas" style="margin-top:10px">${['Aire', 'N2O'].map((gn) => `<button type="button" data-g="${gn}" class="${gSel === gn ? 'sel' : ''}"><span class="punto" style="background:${P.GAS[gn]}"></span> ${gn === 'N2O' ? 'N₂O' : 'Aire'}</button>`).join('')}</div>`;
      }
      chipsHtml = [0.5, 1, 1.5, 2, 3, 4, 5, 6].map((v) => `<button type="button" class="opcion" data-evv="${v}">${v}</button>`).join('');
    } else if (dd.tipo === 'inh') {
      cuerpo += `<label class="campo"><span>Vaporizador</span><div class="con-unidad"><input id="evV" inputmode="decimal" value="${esc(e.v || '')}"><em>%</em></div></label>
        <label class="campo"><span>FGF (opcional)</span><div class="con-unidad"><input id="evF" inputmode="decimal" value="${esc(e.fgf || '')}" placeholder="O₂ + aire"><em>L/min</em></div></label></div>`;
      const I = P.INH[p.agente]; if (I) chipsHtml = I.pasos.map((v) => `<button type="button" class="opcion" data-evv="${v}">${v} %</button>`).join('');
    } else if (dd.tipo === 'sol') {
      cuerpo += '</div>';
      const solSel = e.v || 'SF';
      cuerpo += `<div class="opciones" id="evSol" style="margin-top:10px">${Object.keys(P.SOL).concat('Otro').map((k) => `<button type="button" data-v="${k}" class="opcion${solSel === k ? ' sel' : ''}">${k}</button>`).join('')}</div>
        <p class="nota">${Object.entries(P.SOL).map(([k, x]) => `<b>${k}</b> ${esc(x.nombre)}`).join(' · ')}</p>
        <div id="evSolOtro" ${solSel === 'Otro' ? '' : 'hidden'}><div class="rejilla"><label class="campo"><span>Iniciales (2–4 letras, van en el símbolo)</span><input id="evSolTxt" maxlength="4" value="${esc(e.txt || '')}"></label>
          <label class="campo"><span>Nombre (opcional)</span><input id="evSolNom" value="${esc(e.txtLargo || '')}"></label></div></div>`;
    } else {
      const unidades = tipo === 'inf' ? ['mcg/kg/min', 'mcg/kg/h', 'mg/kg/h', 'mg/kg/min', 'mcg/min', 'mg/h', 'mL/h'] : ['mcg', 'mg', 'g', 'UI'];
      const uDef = e.u || (tipo === 'inf' ? (f && f.inf ? f.inf[2] : 'mcg/kg/min') : (f ? f.uB : 'mg'));
      cuerpo += `<label class="campo"><span>${tipo === 'inf' ? 'Velocidad / dosis' : 'Dosis'}</span><input id="evV" inputmode="decimal" value="${esc(e.v || '')}"></label>
        <label class="campo"><span>Unidad</span><select id="evU">${unidades.map((u) => `<option${u === uDef ? ' selected' : ''}>${u}</option>`).join('')}</select></label></div>`;
      g.filter((x) => (tipo === 'inf' ? x.tipo === 'inf' : x.tipo === 'bolo')).forEach((x) => {
        if (tipo === 'inf') chipsHtml += [x.a, P.r1((num(f.inf[0]) + num(f.inf[1])) / 2, 3), x.b].filter((v, i, a) => isFinite(v) && a.indexOf(v) === i).map((v) => `<button type="button" class="opcion" data-evv="${v}">${v} ${esc(x.uInf)}</button>`).join('');
        else if (isFinite(x.a)) { const et = x.txt.split(':')[0].split(' ')[0]; chipsHtml += [x.a, x.b].filter((v, i, a) => a.indexOf(v) === i).map((v) => `<button type="button" class="opcion" data-evv="${v}"><small style="opacity:.7">${esc(et)}</small> ${v} ${esc(x.u)}</button>`).join(''); }
      });
    }
    const titulo = tipo === 'stop' ? (dd.tipo === 'inh' ? 'Cerrar vaporizador' : dd.tipo === 'gas' ? `Cerrar ${id === 'o2' ? 'O₂' : 'Aire / N₂O'}` : 'Suspender infusión') : dd.tipo === 'gas' ? `${id === 'o2' ? 'O₂' : 'Aire / N₂O'}: flujo` : dd.tipo === 'inh' ? `${p.agente || 'Inhalatorio'}: % del vaporizador` : dd.tipo === 'sol' ? 'Solución administrada' : `${p.agente || dd.nombre}: ${tipo === 'inf' ? 'infusión (inicio o cambio)' : 'bolo'}`;
    abrirHoja(`<h2>${esc(titulo)}</h2>${cuerpo}${chipsHtml ? `<div class="opciones" style="margin-top:10px">${chipsHtml}</div>` : ''}
      ${g.length && tipo !== 'stop' ? `<p class="nota">${g.map((x) => esc(x.txt)).join('<br>')}</p>` : ''}
      ${tipo === 'inf' && CalcInf.FARMACOS[p.agente] ? '<div class="fila-btn"><button class="secundario chico" id="evCalc">🧮 Calculadora mL/h (bomba)</button></div>' : ''}
      <div class="acciones">${nuevo ? '' : '<button class="peligro" id="evBorrar">Eliminar</button>'}<button class="secundario" id="evCancelar">Cancelar</button><button class="primario" id="evOk">Guardar</button></div>`);
    $$('#capa [data-evv]').forEach((b) => (b.onclick = () => { $('#evV').value = b.dataset.evv; }));
    $$('#capa [data-ahora]').forEach((b) => (b.onclick = () => { $('#' + b.dataset.ahora).value = ahoraHM(); }));
    $$('#evGas [data-g]').forEach((b) => (b.onclick = () => { $$('#evGas [data-g]').forEach((x) => x.classList.toggle('sel', x === b)); }));
    $$('#evSol [data-v]').forEach((b) => (b.onclick = () => { $$('#evSol [data-v]').forEach((x) => x.classList.toggle('sel', x === b)); if ($('#evSolOtro')) $('#evSolOtro').hidden = b.dataset.v !== 'Otro'; }));
    $('#evCancelar').onclick = cerrarHoja;
    if ($('#evCalc')) $('#evCalc').onclick = () => { H.inf = H.inf || []; let i = H.inf.findIndex((x) => x.farm === p.agente);
      if (i < 0) { H.inf.push({ farm: p.agente }); i = H.inf.length - 1; } cerrarHoja(); guardarPronto(); abrirCalculadora(i); };
    if ($('#evBorrar')) $('#evBorrar').onclick = () => { p.ev.splice(idx, 1); cerrarHoja(); guardarPronto(); render(); };
    $('#evOk').onclick = () => {
      const o = { hora: $('#evHora').value };
      if (!o.hora) { aviso('Falta la hora'); return; }
      if (tipo !== 'valor' && tipo) o.tipo = tipo;
      if (dd.tipo === 'sol') {
        const sb = $('#evSol .sel'); o.v = sb ? sb.dataset.v : 'SF';
        const fn = $('#evFin').value; if (fn) { if (fn === o.hora) { aviso('El fin debe ser después del inicio'); return; } o.fin = fn; }
        if (o.v === 'Otro') { o.txt = ($('#evSolTxt').value || '').trim().toUpperCase(); if (!o.txt) { aviso('Escribe las iniciales'); return; } const nm = $('#evSolNom').value.trim(); if (nm) o.txtLargo = nm; }
      } else if (tipo !== 'stop') { o.v = ($('#evV').value || '').trim(); if (!o.v) { aviso('Falta el valor'); return; } }
      if ($('#evU')) o.u = $('#evU').value;
      if ($('#evGas') && tipo !== 'stop') { const gb = $('#evGas .sel'); o.g = gb ? gb.dataset.g : 'Aire'; p.agente = o.g; }
      if ($('#evF') && $('#evF').value.trim()) o.fgf = $('#evF').value.trim();
      if (Pistas.off(H.to, o.hora) < 0) { const m = minDe(o.hora); const nm = Math.floor(m / 5) * 5; H.to.inicio = String(Math.floor(nm / 60)).padStart(2, '0') + ':' + String(nm % 60).padStart(2, '0'); }
      if (nuevo) p.ev.push(o); else p.ev[idx] = o;
      cerrarHoja(); guardarPronto(); render();
    };
  }

  function resumenReg(r) {
    const p = [];
    if (r.tas || r.tad) p.push(`TA ${esc(r.tas || '–')}/${esc(r.tad || '–')}`);
    if (r.fc) p.push('FC ' + esc(r.fc)); if (r.fr) p.push('FR ' + esc(r.fr));
    if (r.sat) p.push('Sat ' + esc(r.sat) + '%'); if (r.etco2) p.push('EtCO2 ' + esc(r.etco2));
    if (r.ekg) p.push('EKG ' + esc(r.ekg));
    if (r.vent) p.push({ E: 'Espont.', A: 'Asist.', C: 'Contr.' }[r.vent]);
    const f = Object.keys(r.f || {}).filter((k) => r.f[k] !== '' && r.f[k] != null).map((k) => `${esc(nombreFila(+k))}: ${esc(r.f[k])}`);
    if (f.length) p.push(f.join(', '));
    const v = [['vc', 'VC'], ['vfr', 'FRv'], ['ppico', 'Ppico'], ['peep', 'PEEP'], ['pvc', 'PVC'], ['pap', 'PAP'], ['gc', 'GC'], ['cuna', 'Cuña'], ['temp', 'T°'], ['entrop', 'Entrop']]
      .filter(([k]) => r[k]).map(([k, t]) => t + ' ' + esc(r[k]));
    if (v.length) p.push(v.join(' '));
    return p.join(' · ') || '<i>Sin datos</i>';
  }
  function nombreFila(i) { return i < 2 ? FILAS_BASE[i] : (H.to.filas[i] || FILAS_BASE[i]); }

  function pintarGrafica() {
    const svg = $('#grafica'); if (!svg) return;
    const regs = H.to.regs.filter((r) => isFinite(offset(r.hora)));
    const W = 360, Hh = 170, x0 = 28, x1 = W - 6, y0 = 8, y1 = Hh - 16;
    const maxMin = Math.max(120, ...regs.map((r) => offset(r.hora) + 5));
    const X = (m) => x0 + (m / maxMin) * (x1 - x0), Y = (v) => y1 - ((Math.max(10, Math.min(230, v)) - 20) / 200) * (y1 - y0);
    let s = '';
    for (let v = 20; v <= 220; v += 20) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3eaec"/><text x="${x0 - 4}" y="${Y(v) + 3}" font-size="8" text-anchor="end" fill="#5f6f74">${v}</text>`;
    for (let m = 0; m <= maxMin; m += 15) {
      s += `<line x1="${X(m)}" x2="${X(m)}" y1="${y0}" y2="${y1}" stroke="${m % 60 ? '#eef2f3' : '#cfd8dc'}"/>`;
      if (m % 30 === 0 && H.to.inicio) s += `<text x="${X(m)}" y="${Hh - 4}" font-size="8" text-anchor="middle" fill="#5f6f74">${hmMas(H.to.inicio, m)}</text>`;
    }
    const serie = (k, col, sim) => {
      const pts = regs.filter((r) => isFinite(num(r[k]))).map((r) => [X(offset(r.hora)), Y(num(r[k]))]);
      if (!pts.length) return '';
      let o = `<polyline fill="none" stroke="${col}" stroke-width="1" stroke-opacity=".5" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
      pts.forEach(([x, y]) => {
        if (sim === 'v') o += `<path d="M${x - 3.5},${y - 5} L${x},${y} L${x + 3.5},${y - 5}" fill="none" stroke="${col}" stroke-width="1.6"/>`;
        else if (sim === '^') o += `<path d="M${x - 3.5},${y + 5} L${x},${y} L${x + 3.5},${y + 5}" fill="none" stroke="${col}" stroke-width="1.6"/>`;
        else if (sim === 'o') o += `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="${col}" stroke-width="1.3"/>`;
        else o += `<circle cx="${x}" cy="${y}" r="2.6" fill="${col}"/>`;
      });
      return o;
    };
    s += serie('tas', '#c62828', 'v') + serie('tad', '#c62828', '^') + serie('fc', '#1565c0', '.') + serie('fr', '#2e7d32', 'o');
    if (!regs.length) s += `<text x="${W / 2}" y="${Hh / 2}" font-size="11" text-anchor="middle" fill="#90a4ae">${H.to.inicio ? 'Sin registros todavía' : 'Define la hora de inicio'}</text>`;
    svg.innerHTML = s;
  }
  function hmMas(hm, m) { const t = (minDe(hm) + m + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }

  function abrirRegistro(i) {
    const nuevo = i == null;
    if (!H.to.inicio) { H.to.inicio = ahoraHM(5); guardarPronto(); }
    const ult = H.to.regs[H.to.regs.length - 1];
    const ultEkg = [...H.to.regs].reverse().find((x) => x.ekg);
    const r = nuevo ? { hora: ahoraHM(), f: {}, vent: ult ? ult.vent || '' : '', ekg: ultEkg ? ultEkg.ekg : '' } : JSON.parse(JSON.stringify(H.to.regs[i]));
    r.f = r.f || {};
    const n = (k, t, u) => `<label class="campo"><span>${t}</span><div class="con-unidad"><input inputmode="decimal" data-rk="${k}" value="${esc(r[k] || '')}">${u ? `<em>${u}</em>` : ''}</div></label>`;
    const filas = [7, 8, 9].filter((j) => H.to.filas[j]).map((j) =>
      `<label class="campo"><span>${esc(nombreFila(j))}</span><input data-rf="${j}" value="${esc(r.f[j] || '')}"></label>`).join('');
    abrirHoja(`<h2>${nuevo ? 'Nuevo registro' : 'Editar registro'}</h2>
      <div class="rejilla"><label class="campo"><span>Hora</span><input type="time" data-rk="hora" value="${esc(r.hora)}"></label>
      ${n('tas', 'TA sistólica', 'mmHg')}${n('tad', 'TA diastólica', 'mmHg')}${n('fc', 'FC', 'lpm')}${n('fr', 'FR', 'rpm')}${n('sat', 'SatO2', '%')}${n('etco2', 'EtCO2', 'mmHg')}</div>
      <div class="grupo" style="margin-top:12px"><div class="etq">EKG (ritmo)</div><div class="segmento" id="segEkg">
        ${EKG.map((v) => `<button type="button" data-v="${v}" class="${r.ekg === v ? 'sel' : ''}">${v}</button>`).join('')}</div>
        <label class="campo" style="margin-top:8px"><input data-rk="ekg" id="ekgTxt" value="${esc(r.ekg || '')}" placeholder="Otro ritmo o cambio (ej. FA, ESV, TV…)"></label></div>
      <div class="grupo" style="margin-top:12px"><div class="etq">Ventilación</div><div class="segmento" id="segVent">
        ${[['E', 'Espontánea'], ['A', 'Asistida'], ['C', 'Controlada']].map(([v, t]) => `<button type="button" data-v="${v}" class="${r.vent === v ? 'sel' : ''}">${t}</button>`).join('')}</div></div>
      ${filas ? `<h3>Vías (VC / VP)</h3><div class="rejilla">${filas}</div>` : ''}
      <p class="nota">Los gases, el inhalatorio, los opioides, relajantes y demás drogas se registran en “Fármacos y gases”, debajo de la gráfica.</p>
      <details style="margin-top:10px"><summary style="font-weight:600;color:var(--pri);padding:8px 0">Parámetros del ventilador y monitoreo avanzado</summary>
      <div class="rejilla">${n('vc', 'VC', 'ml')}${n('vfr', 'FR vent.', 'rpm')}${n('ppico', 'P pico', 'cmH2O')}${n('peep', 'PEEP', 'cmH2O')}${n('pvc', 'PVC', 'mmHg')}${n('pap', 'PAP', 'mmHg')}${n('gc', 'GC', 'L/min')}${n('cuna', 'P. cuña', 'mmHg')}${n('temp', 'Temp.', '°C')}${n('entrop', 'Entropía', '')}</div></details>
      <div class="acciones">${nuevo ? (ult ? '<button class="secundario" id="rCopiar">Copiar anterior</button>' : '') : '<button class="peligro" id="rBorrar">Eliminar</button>'}
      <button class="secundario" id="rCancelar">Cancelar</button><button class="primario" id="rGuardar">Guardar</button></div>`);
    let vent = r.vent || '';
    $$('#segVent button').forEach((b) => b.onclick = () => { vent = vent === b.dataset.v ? '' : b.dataset.v; $$('#segVent button').forEach((x) => x.classList.toggle('sel', x.dataset.v === vent)); });
    const marcarEkg = () => $$('#segEkg button').forEach((x) => x.classList.toggle('sel', x.dataset.v === $('#ekgTxt').value.trim()));
    $$('#segEkg button').forEach((b) => b.onclick = () => { const e = $('#ekgTxt'); e.value = e.value.trim() === b.dataset.v ? '' : b.dataset.v; marcarEkg(); });
    $('#ekgTxt').oninput = marcarEkg;
    $('#rCancelar').onclick = cerrarHoja;
    if ($('#rCopiar')) $('#rCopiar').onclick = () => {
      ['tas', 'tad', 'fc', 'fr', 'sat', 'etco2', 'ekg', 'vc', 'vfr', 'ppico', 'peep', 'pvc', 'pap', 'gc', 'cuna', 'temp', 'entrop'].forEach((k) => { const e = $(`[data-rk="${k}"]`); if (e && ult[k]) e.value = ult[k]; });
    };
    if ($('#rBorrar')) $('#rBorrar').onclick = () => { if (confirm('¿Eliminar este registro?')) { H.to.regs.splice(i, 1); cerrarHoja(); guardarPronto(); render(); } };
    $('#rGuardar').onclick = () => {
      const o = { f: {} };
      $$('[data-rk]').forEach((e) => { if (e.value.trim() !== '') o[e.dataset.rk] = e.value.trim(); });
      $$('[data-rf]').forEach((e) => { if (e.value.trim() !== '') o.f[e.dataset.rf] = e.value.trim(); });
      if (vent) o.vent = vent;
      if (!o.hora) { aviso('Falta la hora'); return; }
      if (!isFinite(offset(o.hora))) { aviso('Define primero la hora de inicio'); return; }
      if (offset(o.hora) < 0) {
        const m = minDe(o.hora); const nm = Math.floor(m / 5) * 5;
        H.to.inicio = String(Math.floor(nm / 60)).padStart(2, '0') + ':' + String(nm % 60).padStart(2, '0');
        aviso('La hora de inicio de la grilla se movió a ' + H.to.inicio);
      }
      if (nuevo) H.to.regs.push(o); else H.to.regs[i] = o;
      ordenarRegs(); cerrarHoja(); guardarPronto(); render();
    };
  }

  /* ---------- Balance y gases ---------- */
  function secBalance() {
    const fila = (k, t) => `<tr><td class="etq">${t}</td>${[0, 1, 2, 3].map((c) => `<td><input inputmode="decimal" data-k="bal.${k}.${c}" value="${esc(val('bal.' + k + '.' + c))}"></td>`).join('')}</tr>`;
    const cab = `<tr><th>ml</th>${[0, 1, 2, 3].map((c) => `<th><input style="font-weight:600;font-size:12.5px;padding:4px" data-k="bal.cols.${c}" value="${esc(val('bal.cols.' + c))}"></th>`).join('')}</tr>`;
    const abF = (k, t) => `<tr><td class="etq">${t}</td>${[0, 1, 2, 3, 4, 5].map((c) => `<td><input inputmode="decimal" data-k="ab.${k}.${c}" value="${esc(val('ab.' + k + '.' + c))}"></td>`).join('')}</tr>`;
    return card('Balance hídrico', `<div class="desplaza"><table class="tabla" id="tablaBalance"><colgroup><col style="width:36%"><col><col><col><col></colgroup>${cab}
      <tr class="sub"><td class="etq" colspan="5" style="background:#e8f4f6;color:var(--pri)">INGRESOS</td></tr>
      ${fila('cris', 'Cristaloides')}${fila('colo', 'Coloides')}${fila('hemo', 'Hemoderivados')}<tr class="sub" id="bIng"></tr><tr class="sub" id="bTi"></tr>
      <tr class="sub"><td class="etq" colspan="5" style="background:#e8f4f6;color:var(--pri)">EGRESOS</td></tr>
      ${fila('pins', 'P. ins / Mant / Ayuno')}${fila('sang', 'Sangramiento / P. exp')}${fila('diur', 'Diuresis')}<tr class="sub" id="bEgr"></tr><tr class="sub" id="bTe"></tr>
      <tr class="total" id="bTot"></tr></table></div><p class="nota">Subtotales, totales y balance se calculan solos. Puedes renombrar las columnas.</p>`) +
      card('Ácido-base', `<div class="desplaza"><table class="tabla ab"><colgroup><col style="width:84px"><col><col><col><col><col><col></colgroup><tr><th>Hora</th>${[0, 1, 2, 3, 4, 5].map((c) => `<th><input type="time" style="font-size:12.5px;padding:4px;min-width:74px" data-k="ab.horas.${c}" value="${esc(val('ab.horas.' + c))}"></th>`).join('')}</tr>
      ${abF('ph', 'pH')}${abF('pco2', 'pCO2')}${abF('hco3', 'HCO3 / EB')}${abF('po2', 'pO2')}${abF('nak', 'Na+ / K+')}${abF('lact', 'Lactato')}</table></div>`);
  }
  function pintarTotalesBalance() {
    const t = H.bal._tot || [];
    const cel = (f) => [0, 1, 2, 3].map((c) => `<td>${t[c] ? f(t[c]) : ''}</td>`).join('');
    const sg = (n) => (n > 0 ? '+' : '') + fmt(n, 1);
    $('#bIng').innerHTML = '<td class="etq">Subtotal ingresos</td>' + cel((x) => fmt(x.ing, 1));
    $('#bEgr').innerHTML = '<td class="etq">Subtotal egresos</td>' + cel((x) => fmt(x.egr, 1));
    const b = H.bal, ml = (n) => (b._hay ? fmt(n, 1) + ' ml' : '');
    $('#bTi').innerHTML = `<td class="etq">TOTAL INGRESOS</td><td colspan="4">${ml(b._ti)}</td>`;
    $('#bTe').innerHTML = `<td class="etq">TOTAL EGRESOS</td><td colspan="4">${ml(b._te)}</td>`;
    const est = !b._hay ? '' : b._bal > 0 ? 'POSITIVO' : b._bal < 0 ? 'NEGATIVO' : 'NEUTRO';
    $('#bTot').innerHTML = `<td class="etq" style="background:var(--pri);color:#fff">BALANCE</td><td colspan="4">${b._hay ? sg(b._bal) + ' ml · ' + est : ''}</td>`;
  }

  /* ---------- Salida ---------- */
  // Reversión: dosis por kg; botones [dosis/kg, etiqueta]; ml = [concentración, unidad, presentación]
  const REV_FARM = {
    'Neostigmina': { k: 'neo', u: 'mg', r: [0.04, 0.07, 'mg/kg'], s: [[0.04], [0.05], [0.07]], tope: 5, max: '0,08 mg/kg',
      nota: 'Solo con recuperación espontánea (TOF con 2 o más respuestas). Siempre con atropina antes o junto (jeringa aparte); si hay bradicardia, la atropina primero. Ficha técnica: hasta 0,07 mg/kg o 5 mg en total, lo que sea menor.' },
    'Atropina': { k: 'atro', u: 'mg', r: [0.02, 0.04, 'mg/kg'], s: [[0.02], [0.04]], nota: 'Junto con la neostigmina.' },
    'Sugammadex': { k: 'sug', u: 'mg', r: [2, 16, 'mg/kg'], pasos: [[2, 'TOF 2'], [4, 'PTC 1–2'], [16, 'inmediata']], s: [[2, 'TOF 2'], [4, 'PTC 1–2'], [16, 'inmediata']], ml: [100, 'mg', 'vial 100 mg/mL'],
      nota: 'Peso real. 2 mg/kg: reaparece la 2.ª respuesta del TOF. 4 mg/kg: bloqueo profundo (TOF 0 y 1–2 respuestas postetánicas). 16 mg/kg: reversión inmediata tras rocuronio 1,2 mg/kg (no estudiada con vecuronio). Solo revierte rocuronio y vecuronio. Viales de 200 mg/2 mL y 500 mg/5 mL. Niños desde 2 años: 2 y 4 mg/kg; se puede diluir a 10 mg/mL.' },
    'Naloxona': { k: 'nalo', u: 'mcg', r: [1, 2, 'mcg/kg'], s: [[1], [2]], ml: [400, 'mcg', 'ampolla 0,4 mg/mL'],
      nota: 'Por dosis, según Aldrete y respuesta; repetir cada 2–3 min. Ampolla de 0,4 mg/mL (400 mcg/mL); diluida 1 mL + 9 mL queda a 40 mcg/mL.' },
    'Flumazenil': { k: 'flum', u: 'mg', r: [0.003, 0.006, 'mg/kg'], s: [[0.006, 'inicial'], [0.003, 'siguientes']], ml: [0.1, 'mg', 'ampolla 0,1 mg/mL'],
      nota: 'Según Aldrete: 0,006 mg/kg (6 mcg/kg) la dosis inicial y 0,003 mg/kg (3 mcg/kg) las siguientes. Ampolla de 0,1 mg/mL: 5 mL = 0,5 mg; 10 mL = 1 mg.' },
  };
  const revNombre = (k) => Object.keys(REV_FARM).find((n) => REV_FARM[n].k === k);
  function revItem(nombre) {
    const f = REV_FARM[nombre], k = f.k, rv = H.rev || {}, w = pesoKg(), ub = f.r[2].replace('/kg', '');
    const u = rv[k + 'U'] || f.u, unis = ub === 'mcg' ? ['mcg', 'mg'] : ['mg', 'mcg'];
    const chips = f.s.map(([x, et]) => { let d = w ? redondear(x * w) : ''; const tope = f.tope && d > f.tope; if (tope) d = f.tope;
      return `<button type="button" class="opcion chico dos" data-acc="revDosis" data-c="${k}" data-d="${d}" data-u="${ub}"${w ? '' : ' disabled'}>${w ? `${fmtN(d)} ${ub}${tope ? ' (tope)' : ''}` : fmtN(x) + ' ' + f.r[2]}<small>${w ? fmtN(x) + ' ' + f.r[2] : ''}${w && et ? ' · ' : ''}${et || ''}</small></button>`; }).join('');
    return `<div class="coad rev"><div class="check"><input type="checkbox" id="c_rev.${k}" data-k="rev.${k}"${rv[k] ? ' checked' : ''}><label for="c_rev.${k}">${nombre}</label></div>
      <div class="coad-med rev-med"><input class="dosis" data-k="rev.${k}D" value="${esc(rv[k + 'D'] || '')}" placeholder="Dosis" inputmode="decimal" data-revmed="${k}">
        <select data-k="rev.${k}U" data-revmed="${k}">${unis.map((x) => `<option${u === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="opciones coad-chips">${chips}</div>
      <div class="nota guia-dosis" id="revG_${k}">${guiaDosis(REV_FARM, nombre, rv[k + 'D'], u)}</div></div>`;
  }

  function secSalida() {
    return card('Reversión', '<h3 style="margin-top:0">Relajante muscular</h3>' + revItem('Neostigmina') + revItem('Atropina') + revItem('Sugammadex') +
      '<h3>Opioides</h3>' + revItem('Naloxona') + '<h3>Benzodiacepinas</h3>' + revItem('Flumazenil') +
      `<p class="nota">${pesoKg() ? `Dosis calculadas con ${fmtN(pesoKg())} kg.` : 'Escribe el peso del paciente para calcular las dosis.'} Toca un botón para poner la dosis; son orientativas y se ajustan a la respuesta del paciente.</p>`) +
      card('SAP (analgesia postoperatoria)', C('sap.iv', 'Intravenoso') + C('sap.epi', 'Epidural') + C('sap.no', 'No lleva SAP', { k: 'sap.razon', ph: 'Razón' })) +
      card('Traslado', R('tras.dest', 'Destino', [['ucpa', 'Ingreso a UCPA'], ['uci', 'Ingreso a UCI']]) +
        `<div class="rejilla tiempos"><label class="campo"><span>Hora</span><div class="con-unidad"><input type="time" data-k="tras.hora" value="${esc(val('tras.hora'))}"><button class="secundario chico" data-acc="ahora" data-p="tras.hora">Ahora</button></div></label></div>` +
        C('tras.monitor', 'Monitor de traslado') + C('tras.o2', 'Oxígeno suplementario') + C('tras.intub', 'Con intubación') +
        '<h3>Signos vitales al traslado</h3>' + rej(T('tras.ta', 'TA', { ph: '120/80' }) + Nm('tras.fc', 'FC', 'lpm') + Nm('tras.spo2', 'SpO2', '%')) +
        rej(T('tras.recibe', 'Recibe Dr(a).', { full: true }), true));
  }

  /* ---------- Observaciones / Nota (con pestañas de opciones) ---------- */
  let obsTab = 'auto';
  const OBS_TABS = [['auto', 'Tiempos y consumo'], ['esc', 'Escalas'], ['fr', 'Frases'], ['libre', 'Texto libre']];
  function obsPrevia() { const x = Obs.texto(H); return x ? esc(x) : '<span style="color:var(--suave)">(vacío)</span>'; }
  function secObs() {
    const o = Obs.opc(H); let cuerpo = '';
    if (obsTab === 'auto') {
      const tt = (H.to || {}).t || {}; const c = Pistas.consumo(H);
      cuerpo = `<div class="check"><input type="checkbox" id="obT" data-k="obsOpc.tiempos"${o.tiempos !== false ? ' checked' : ''}><label for="obT" style="flex:1">Hora de inicio y fin de anestesia y cirugía (resumido)</label></div>
        ${!(tt.ia || tt.fa || tt.ic || tt.fc) ? '<p class="nota" style="margin:0 0 6px">Aún no hay tiempos en Transoperatorio.</p>' : ''}
        <div class="check"><input type="checkbox" id="obC" data-k="obsOpc.consumo"${o.consumo !== false ? ' checked' : ''}><label for="obC" style="flex:1">Consumo de halogenado${c ? ' (' + esc(c.agente) + ')' : ''}</label></div>
        ${!c ? '<p class="nota" style="margin:0">Sin inhalatorio registrado en la grilla.</p>' : ''}`;
    } else if (obsTab === 'esc') {
      cuerpo = `<p class="nota" style="margin-top:0">Cómo sale el paciente. Deja en blanco las que no uses.</p><div class="rejilla ancha">` +
        Obs.ESCALAS.map((e) => `<label class="campo"><span>${e.t}</span><select data-k="obsOpc.esc.${e.k}"><option value="">—</option>${e.ops.map(([v, tx]) => `<option value="${esc(v)}"${o.esc[e.k] === v ? ' selected' : ''}>${esc(tx)}</option>`).join('')}</select></label>`).join('') + '</div>';
    } else if (obsTab === 'fr') {
      cuerpo = Obs.GRUPOS.map((g) => `<div class="grupo"><div class="etq">${g.t}</div><div class="opciones">${g.ops.map(([k, tx]) => {
        const sel = g.uno ? o.fr[g.k] === k : (o.fr[g.k] || []).includes(k);
        return `<button type="button" class="opcion${sel ? ' sel' : ''}" data-acc="obsFr" data-g="${g.k}" data-v="${k}">${esc(tx)}</button>`; }).join('')}</div></div>`).join('') +
        '<p class="nota">Toca de nuevo una opción para quitarla. "Extubado/a" se ajusta al sexo del paciente.</p>';
    } else cuerpo = rej(TA('obs', 'Texto libre (va al final)', { alto: 120 }), true);
    return card('Observaciones / Nota', `<div class="segmento" style="margin-bottom:12px">${OBS_TABS.map(([k, t]) => `<button type="button" class="${obsTab === k ? 'sel' : ''}" data-acc="obsTab" data-v="${k}">${t}</button>`).join('')}</div>
      ${cuerpo}<div class="etq nota" style="margin:14px 0 4px">Así saldrá en la hoja</div><div class="formula" id="obsPrev" style="font-family:inherit">${obsPrevia()}</div>`);
  }

  /* ---------- Firma ---------- */
  function secFirma() {
    const fondo = 'background:#fff;background-image:linear-gradient(45deg,#f1f4f5 25%,transparent 25%,transparent 75%,#f1f4f5 75%),linear-gradient(45deg,#f1f4f5 25%,transparent 25%,transparent 75%,#f1f4f5 75%);background-size:14px 14px;background-position:0 0,7px 7px';
    return secObs() +
      card('Firma y sello',
        (H.firmaSello ? `<div class="etq nota" style="margin:0 0 4px">Firma y sello escaneados</div><img class="firma-img" style="${fondo}" src="${H.firmaSello}" alt="Firma y sello">` : '') +
        (H.firma ? `<div class="etq nota" style="margin:8px 0 4px">Firma dibujada</div><img class="firma-img" src="${H.firma}" alt="Firma">` : '') +
        (!H.firma && !H.firmaSello ? '<p class="nota">Sin firma.</p>' : '') +
        `<div class="fila-btn"><button class="secundario" data-acc="firmar">${H.firma ? 'Firmar de nuevo' : 'Firmar con el dedo'}</button>
        ${cfg.perfil.firmaSello && !H.firmaSello ? '<button class="secundario" data-acc="usarEscaneo">Usar mi firma y sello escaneados</button>' : ''}
        ${cfg.perfil.firma && !H.firma ? '<button class="secundario" data-acc="firmaPerfil">Usar mi firma dibujada</button>' : ''}
        ${H.firma || H.firmaSello ? '<button class="peligro" data-acc="quitarFirma">Quitar firmas</button>' : ''}</div>` +
        rej(TA('sello', 'Texto bajo la firma (nombre, especialidad, C.M., MPPS…)', { alto: 70, ph: 'Dr. Nombre Apellido\nAnestesiología\nC.M. 0000 · MPPS 00000' }), true));
  }

  function padFirma(titulo, alListo) {
    abrirHoja(`<h2>${titulo}</h2><canvas class="firma" id="lienzo"></canvas><p class="nota">Firma con el dedo dentro del recuadro.</p>
      <div class="acciones"><button class="secundario" id="fLimpiar">Limpiar</button><button class="secundario" id="fCancelar">Cancelar</button><button class="primario" id="fOk">Listo</button></div>`);
    const cv = $('#lienzo'); const dpr = window.devicePixelRatio || 1;
    const rc = cv.getBoundingClientRect(); cv.width = rc.width * dpr; cv.height = rc.height * dpr;
    const cx = cv.getContext('2d'); cx.scale(dpr, dpr); cx.lineWidth = 2.4; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#0d2a6b';
    let dib = false, ult = null, hay = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { dib = true; ult = pos(e); cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.arc(ult[0], ult[1], 1.1, 0, 7); cx.fill(); hay = true; });
    cv.addEventListener('pointermove', (e) => { if (!dib) return; const p = pos(e); cx.beginPath(); cx.moveTo(ult[0], ult[1]); cx.lineTo(p[0], p[1]); cx.stroke(); ult = p; hay = true; });
    const fin = () => { dib = false; }; cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
    $('#fLimpiar').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); hay = false; };
    $('#fCancelar').onclick = cerrarHoja;
    $('#fOk').onclick = () => { if (!hay) { aviso('Firma vacía'); return; } alListo(recortar(cv)); cerrarHoja(); };
  }
  function recortar(cv) {
    const cx = cv.getContext('2d'); const { width: w, height: h } = cv; const d = cx.getImageData(0, 0, w, h).data;
    let a = w, b = h, c = 0, e = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > e) e = y; }
    const pad = 6; a = Math.max(0, a - pad); b = Math.max(0, b - pad); c = Math.min(w, c + pad); e = Math.min(h, e + pad);
    const o = document.createElement('canvas'); o.width = c - a; o.height = e - b;
    o.getContext('2d').drawImage(cv, a, b, c - a, e - b, 0, 0, c - a, e - b);
    return o.toDataURL('image/png');
  }

  /* ---------- Hojas y menús ---------- */
  function abrirHoja(html) { const c = $('#capa'); c.innerHTML = `<div class="hoja">${html}</div>`; c.hidden = false; }
  function cerrarHoja() { const c = $('#capa'); c.hidden = true; c.innerHTML = ''; }
  $('#capa').addEventListener('click', (e) => { if (e.target.id === 'capa') cerrarHoja(); });

  function menu(ops) {
    abrirHoja(`<div class="menu">${ops.map((o, i) => `<button data-i="${i}" style="${o.peligro ? 'color:var(--peligro)' : ''}">${o.t}</button>`).join('')}</div>`);
    $$('.menu button').forEach((b) => (b.onclick = () => { cerrarHoja(); ops[+b.dataset.i].f(); }));
  }

  /* ---------- Pantallas ---------- */
  function render() {
    const v = $('#vista');
    $('#btnAtras').hidden = pantalla === 'inicio';
    $('#secciones').hidden = pantalla !== 'editor';
    $('#pie').hidden = pantalla !== 'editor' && pantalla !== 'doc';
    $('#btnMenu').hidden = pantalla === 'login';
    $('#btnSOS').hidden = ['login', 'bienvenida', 'registro', 'importar'].includes(pantalla) || pantalla === 'crisis';
    $('#btnSOS').classList.toggle('activa', !!(window.Crisis && Crisis.activa()));
    $('#barra').hidden = pantalla === 'bienvenida';
    bordeABorde(pantalla === 'bienvenida');
    if (pantalla === 'bienvenida') return renderBienvenida(v);
    $('.fab') && $('.fab').remove();
    if (pantalla === 'inicio') return renderInicio(v);
    if (pantalla === 'sedes') return renderSedes(v);
    if (pantalla === 'perfil') return renderPerfil(v);
    if (pantalla === 'registro') { $('#btnAtras').hidden = false; return renderRegistro(v); }
    if (pantalla === 'login') { $('#btnAtras').hidden = true; return renderLogin(v); }
    if (pantalla === 'importar') { $('#btnAtras').hidden = false; return renderImportar(v); }
    if (pantalla === 'extras') return renderExtras(v);
    if (pantalla === 'guias') return renderGuias(v);
    if (pantalla === 'calc') return renderCalc(v);
    if (pantalla === 'crisis') return renderCrisis(v);
    if (pantalla === 'guia') return renderGuia(v);
    if (pantalla === 'bloqueos') return renderBloqueos(v);
    if (pantalla === 'bloqueo') return renderBloqueo(v);
    if (pantalla === 'doc') return D.tipo === 'val' ? renderVal(v) : renderRx(v);
    if (pantalla === 'editor') {
      calcular();
      $('#titulo').textContent = H.p.nombre || 'Historia nueva';
      $('#secciones').innerHTML = SECCIONES.map((s, i) => `<button data-s="${i}" class="${i === seccion ? 'activo' : ''}">${s.t}</button>`).join('');
      v.innerHTML = SECCIONES[seccion].r() + `<div class="fila-btn" style="justify-content:space-between">
        ${seccion > 0 ? `<button class="secundario" data-s="${seccion - 1}">← ${SECCIONES[seccion - 1].t}</button>` : '<span></span>'}
        ${seccion < SECCIONES.length - 1 ? `<button class="primario" data-s="${seccion + 1}">${SECCIONES[seccion + 1].t} →</button>` : '<button class="primario" data-acc="pdf">Vista previa / PDF</button>'}</div>`;
      const act = $('#secciones .activo'); if (act) act.scrollIntoView({ inline: 'center', block: 'nearest' });
      if (SECCIONES[seccion].id === 'to') pintarGrafica();
      if (SECCIONES[seccion].id === 'bal') pintarTotalesBalance();
    }
  }

  function renderInicio(v) {
    $('#titulo').textContent = 'Historias de Anestesia';
    const idx = Store.indice().sort((a, b) => b.modificado - a.modificado);
    const q = (renderInicio.q || '').toLowerCase();
    const f = idx.filter((x) => !q || [x.nombre, x.ci, x.interv, x.fecha].join(' ').toLowerCase().includes(q));
    const fechaTxt = (s) => (s ? s.split('-').reverse().join('/') : '');
    v.innerHTML = `<button class="ex-banner" data-acc="irExtras"><span><b>✦ Extras</b><small>Valoración preanestésica · Récipe</small></span><em>Vista previa 2.0 ›</em></button>` +
      `<input class="buscar" id="buscar" type="search" placeholder="Buscar por nombre, CI, cirugía o fecha" value="${esc(renderInicio.q || '')}">` +
      (f.length ? `<ul class="lista">${f.map((x) => `<li class="item" data-abrir="${x.id}"><div class="txt"><b>${esc(x.nombre || 'Sin nombre')}</b>
        <small>${[x.ci && 'CI ' + x.ci, fechaTxt(x.fecha)].filter(Boolean).map(esc).join(' · ')}</small><small>${esc(x.interv || '')}</small>
        <span class="chipsede">${esc(abrev(sede(x.sede).nombre))}</span></div><button class="icono" style="color:var(--suave)" data-mas="${x.id}" aria-label="Opciones">&#8942;</button></li>`).join('')}</ul>` :
        `<div class="vacio"><b>${idx.length ? 'Sin resultados' : 'Aún no hay historias'}</b>${idx.length ? '' : 'Toca “Nueva historia” para empezar.'}</div>`);
    const fab = document.createElement('button'); fab.className = 'fab'; fab.textContent = '+ Nueva historia'; fab.onclick = crear; document.body.appendChild(fab);
    const b = $('#buscar'); b.oninput = () => { renderInicio.q = b.value; const pos = b.selectionStart; render(); const nb = $('#buscar'); nb.focus(); nb.setSelectionRange(pos, pos); };
  }
  function abrev(n) { n = n || ''; return n.length > 42 ? n.slice(0, 40) + '…' : n; }

  function crear() {
    const go = (sid) => { H = nuevaHistoria(); if (sid) H.sedeId = sid; Store.guardar(H); pantalla = 'editor'; seccion = 0; render(); window.scrollTo(0, 0); };
    if (cfg.sedes.length > 1) menu(cfg.sedes.map((s) => ({ t: '🏥 ' + esc(s.nombre), f: () => { cfg.sedeActual = s.id; Store.guardarConfig(cfg); go(s.id); } })));
    else go();
  }
  function abrir(id) { const h = Store.cargar(id); if (!h) { aviso('No se pudo abrir'); return; } H = migrar(h); pantalla = 'editor'; seccion = 0; render(); window.scrollTo(0, 0); }
  function migrar(h) {
    const base = nuevaHistoria();
    const tenia = !!(h.to && h.to.pistas); if (!tenia && base.to) delete base.to.pistas;
    const fusion = (a, b) => { for (const k in b) { if (a[k] == null) a[k] = b[k]; else if (typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof a[k] === 'object') fusion(a[k], b[k]); } return a; };
    const r = fusion(h, base); Pistas.asegurar(r); return r;
  }
  function duplicar(id, conPaciente) {
    const h = migrar(Store.cargar(id)); const n = nuevaHistoria();
    const copia = JSON.parse(JSON.stringify(h));
    copia.id = n.id; copia.creado = Date.now();
    if (!conPaciente) {
      copia.p = { fecha: hoyISO(), tipoVol: h.p.tipoVol };
      ['alergias', 'premed', 'dx', 'intervencion', 'asaRazon', 'obs', 'obsOpc', 'mallampati', 'asa'].forEach((k) => (copia[k] = ''));
      copia.asaE = false; copia.gcs = {}; copia.bal = n.bal; copia.ab = n.ab; copia.tras = {};
      copia.to.regs = []; copia.to.inicio = ''; copia.to.t = {}; copia.to.base = {};
      copia.va.cl = ''; copia.va.pogo = ''; copia.va.pogoCat = ''; copia.va.pogoOn = false;
      copia.cond.conducta = ''; copia.cond.punc = false; copia.cond.otras = false; copia.cond.otrasTxt = '';
    } else copia.p.fecha = hoyISO();
    H = copia; Store.guardar(H); pantalla = 'editor'; seccion = 0; render(); aviso('Copia creada');
  }
  function opcionesHistoria(id) {
    menu([
      { t: 'Abrir', f: () => abrir(id) },
      { t: 'Ver / PDF', f: () => { H = migrar(Store.cargar(id)); accionesPdf(); } },
      { t: 'Nueva historia usando esta como plantilla (sin datos del paciente)', f: () => duplicar(id, false) },
      { t: 'Duplicar completa', f: () => duplicar(id, true) },
      { t: 'Eliminar', peligro: true, f: () => { if (confirm('¿Eliminar esta historia? No se puede deshacer.')) { Store.borrar(id); render(); aviso('Historia eliminada'); } } },
    ]);
  }

  function renderSedes(v) {
    $('#titulo').textContent = 'Lugares de trabajo';
    v.innerHTML = '<p class="nota" style="margin:0 0 12px">El lugar elegido en cada historia define el encabezado y el logo del PDF.</p>' +
      cfg.sedes.map((s, i) => `<section class="tarjeta"><div class="rejilla ancha">
        <label class="campo completo"><span>Nombre (línea 1)</span><input data-sede="${i}" data-c="nombre" value="${esc(s.nombre)}"></label>
        <label class="campo completo"><span>Ciudad / subtítulo (línea 2)</span><input data-sede="${i}" data-c="sub" value="${esc(s.sub)}"></label></div>
        <div class="fila-btn" style="align-items:center">${s.logo ? `<img class="logo-prev" src="${s.logo}" alt="logo">` : '<span class="nota">Sin logo</span>'}
        <label class="secundario chico" style="display:inline-block">Cambiar logo<input type="file" accept="image/*" data-logo="${i}" hidden></label>
        ${s.logo ? `<button class="secundario chico" data-quitalogo="${i}">Quitar logo</button>` : ''}
        ${cfg.sedes.length > 1 ? `<button class="peligro chico" data-borrasede="${i}">Eliminar lugar</button>` : ''}</div></section>`).join('') +
      '<button class="primario" id="agregarSede" style="width:100%">+ Agregar lugar de trabajo</button>';
    $$('[data-sede]').forEach((e) => (e.oninput = () => { cfg.sedes[+e.dataset.sede][e.dataset.c] = e.value; Store.guardarConfig(cfg); }));
    $$('[data-logo]').forEach((e) => (e.onchange = () => {
      const f = e.files[0]; if (!f) return;
      leerImagen(f, 400).then((d) => { cfg.sedes[+e.dataset.logo].logo = d; Store.guardarConfig(cfg); render(); });
    }));
    $$('[data-quitalogo]').forEach((e) => (e.onclick = () => { cfg.sedes[+e.dataset.quitalogo].logo = ''; Store.guardarConfig(cfg); render(); }));
    $$('[data-borrasede]').forEach((e) => (e.onclick = () => { if (confirm('¿Eliminar este lugar?')) { cfg.sedes.splice(+e.dataset.borrasede, 1); Store.guardarConfig(cfg); render(); } }));
    $('#agregarSede').onclick = () => { cfg.sedes.push({ id: uid(), nombre: '', sub: '', logo: '' }); Store.guardarConfig(cfg); render(); window.scrollTo(0, document.body.scrollHeight); };
  }
  // Convierte un logo en dos versiones sin fondo (blanca y negra) usando su transparencia o, si no tiene, el contraste con el fondo.
  function prepararMarca(f) {
    return new Promise((ok, mal) => {
      const r = new FileReader(); r.onerror = mal;
      r.onload = () => { const im = new Image(); im.onerror = mal; im.onload = () => {
        const k = Math.min(1, 800 / Math.max(im.width, im.height)); const W = Math.round(im.width * k), Hh = Math.round(im.height * k);
        const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, Hh);
        const px = x.getImageData(0, 0, W, Hh).data; const n = W * Hh; const m = new Uint8ClampedArray(n);
        let transp = 0; for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 240) transp++;
        const lum = (i) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
        let borde = 0, nb = 0; for (let i = 0; i < W; i++) { borde += lum(i) + lum((Hh - 1) * W + i); nb += 2; }
        const fondoOscuro = borde / nb < 128;
        for (let i = 0; i < n; i++) m[i] = transp > n * 0.05 ? px[i * 4 + 3] : Math.max(0, Math.min(255, (fondoOscuro ? lum(i) : 255 - lum(i)) * 1.15));
        let a = W, b = Hh, cc = 0, e = 0; for (let y = 0; y < Hh; y++) for (let xx = 0; xx < W; xx++) if (m[y * W + xx] > 25) { if (xx < a) a = xx; if (xx > cc) cc = xx; if (y < b) b = y; if (y > e) e = y; }
        if (cc <= a || e <= b) { mal(new Error('vacía')); return; }
        const hacer = (rgb) => { const w = cc - a + 1, h = e - b + 1, o = document.createElement('canvas'); o.width = w; o.height = h;
          const ox = o.getContext('2d'), id = ox.createImageData(w, h);
          for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const j = (y * w + xx) * 4; id.data[j] = rgb; id.data[j + 1] = rgb; id.data[j + 2] = rgb; id.data[j + 3] = m[(y + b) * W + xx + a]; }
          ox.putImageData(id, 0, 0);
          const s2 = document.createElement('canvas'), kk = Math.min(1, 360 / Math.max(w, h)); s2.width = Math.round(w * kk); s2.height = Math.round(h * kk);
          s2.getContext('2d').drawImage(o, 0, 0, s2.width, s2.height); return s2.toDataURL('image/png'); };
        ok({ blanca: hacer(255), negra: hacer(0) });
      }; im.src = r.result; };
      r.readAsDataURL(f);
    });
  }
  function leerImagen(f, max, tipo) {
    return new Promise((ok, mal) => {
      const r = new FileReader(); r.onerror = mal;
      r.onload = () => { const im = new Image(); im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        ok(tipo === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png'));
      }; im.onerror = mal; im.src = r.result; };
      r.readAsDataURL(f);
    });
  }

  /* ---------- Cuenta del médico ---------- */
  const CAMPOS_MED = [['nombre', 'Nombre y apellido', 'Dr. Nombre Apellido'], ['especialidad', 'Especialidad', 'Anestesiología'], ['ci', 'Cédula de identidad', 'V-00000000'],
    ['colegioSigla', 'Siglas del Colegio de Médicos', 'Ej. CML, C.M.'], ['colegio', 'N° Colegio de Médicos', 'Ej. 12345'], ['mpps', 'N° MPPS', 'Ej. 123456'], ['rif', 'RIF', 'V-00000000-0'],
    ['telefono', 'Teléfono / WhatsApp', '0414-0000000'], ['correo', 'Correo (Gmail)', 'nombre@gmail.com'], ['direccion', 'Consultorio / dirección (membrete)', 'Ej. Centro Médico…, consultorio 12']];
  function camposMedico(p) {
    return `<div class="rejilla ancha">${CAMPOS_MED.map(([k, t, ph]) => `<label class="campo"><span>${t}</span><input data-md="${k}" value="${esc(p[k] || (k === 'especialidad' && !p.nombre ? '' : ''))}" placeholder="${esc(ph)}"${k === 'correo' ? ' type="email" autocomplete="email"' : ''}></label>`).join('')}</div>`;
  }
  function enlazarMedico(p) { $$('[data-md]').forEach((e) => (e.oninput = () => { p[e.dataset.md] = e.value.trim(); Store.guardarConfig(cfg); })); }
  function cajaFirmaSello(p) {
    const fondo = 'background-color:#fff;background-image:linear-gradient(45deg,#eef2f3 25%,transparent 25%,transparent 75%,#eef2f3 75%),linear-gradient(45deg,#eef2f3 25%,transparent 25%,transparent 75%,#eef2f3 75%);background-size:14px 14px;background-position:0 0,7px 7px';
    return (p.firmaSello ? `<img class="firma-img" style="${fondo};max-height:160px" src="${p.firmaSello}" alt="Firma y sello">` : '<p class="nota" style="margin-top:0">Sube una foto o escaneo de tu firma y sello sobre papel blanco. La app le quita el fondo.</p>') +
      `<div class="fila-btn"><label class="primario chico" style="display:inline-block">${p.firmaSello ? 'Cambiar imagen' : 'Subir firma y sello'}<input type="file" accept="image/*" id="fsFile" hidden></label>
      ${p.firmaSello ? '<button class="peligro chico" id="fsQuitar">Quitar</button>' : ''}</div>`;
  }
  function enlazarFirmaSello(p, alTerminar) {
    $('#fsFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; aviso('Procesando imagen…');
      Cuenta.procesarFirma(f).then((d) => { p.firmaSello = d; Store.guardarConfig(cfg); aviso('Firma y sello listos'); (alTerminar || render)(); })
        .catch((er) => aviso(er.message || 'No se pudo leer la imagen')); };
    if ($('#fsQuitar')) $('#fsQuitar').onclick = () => { p.firmaSello = ''; Store.guardarConfig(cfg); (alTerminar || render)(); };
  }
  function mostrarCodigo(cod, alCerrar) {
    abrirHoja(`<h2>Guarda tu código de recuperación</h2><p>Si olvidas la contraseña, este código te permite crear una nueva:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:3px;text-align:center;color:var(--pri);margin:14px 0">${esc(cod)}</p>
      <p class="nota">Anótalo en un lugar seguro (o tómale una captura). No se vuelve a mostrar.</p>
      <div class="acciones"><button class="primario" id="codOk">Ya lo guardé</button></div>`);
    $('#codOk').onclick = () => { cerrarHoja(); if (alCerrar) alCerrar(); };
  }
  function cambiarClaveUI(conCodigo) {
    abrirHoja(`<h2>${conCodigo ? 'Recuperar acceso' : 'Cambiar contraseña'}</h2><div class="rejilla ancha">
      ${conCodigo ? '<label class="campo completo"><span>Código de recuperación</span><input id="ccCod" autocapitalize="characters" placeholder="XXXXX-XXXXX"></label>' : '<label class="campo completo"><span>Contraseña actual</span><input id="ccAct" type="password"></label>'}
      <label class="campo"><span>Nueva contraseña</span><input id="ccN1" type="password"></label><label class="campo"><span>Repetir</span><input id="ccN2" type="password"></label></div>
      <div class="acciones"><button class="secundario" id="ccNo">Cancelar</button><button class="primario" id="ccSi">Guardar</button></div>`);
    $('#ccNo').onclick = cerrarHoja;
    $('#ccSi').onclick = () => {
      const c = cfg.cuenta;
      if (conCodigo ? !Cuenta.verificarCodigo(c, $('#ccCod').value) : !Cuenta.verificar(c, c.usuario, $('#ccAct').value)) { aviso(conCodigo ? 'Código incorrecto' : 'Contraseña actual incorrecta'); return; }
      const n1 = $('#ccN1').value; if (n1.length < 4) { aviso('Mínimo 4 caracteres'); return; } if (n1 !== $('#ccN2').value) { aviso('Las contraseñas no coinciden'); return; }
      const cod = Cuenta.cambiarClave(c, n1); Store.guardarConfig(cfg); cerrarHoja();
      mostrarCodigo(cod, () => { if (conCodigo) { iniciarSesion(true); pantalla = 'inicio'; render(); } });
    };
  }
  let sesion = false;
  /* Sesión recordada: cuánto dura sin volver a pedir la contraseña en este equipo. */
  const RECORDAR = [['siempre', 'Cada vez que abro la app'], ['1', 'Una vez al día'], ['7', 'Cada 7 días'], ['30', 'Cada 30 días'], ['nunca', 'Nunca en este equipo']];
  function recordarDe(c) { return !c ? '30' : c.pedirClave === false ? 'nunca' : (c.recordar || '30'); }
  function sesionValida() {
    const c = cfg.cuenta; if (!c) return true;
    const r = recordarDe(c); if (r === 'nunca') return true; if (r === 'siempre') return false;
    return !!(cfg.sesion && cfg.sesion.hasta > Date.now());
  }
  function iniciarSesion(mantener) {
    sesion = true; const r = recordarDe(cfg.cuenta);
    if (mantener && r !== 'siempre' && r !== 'nunca') cfg.sesion = { hasta: Date.now() + Number(r) * 864e5 };
    else if (!mantener) delete cfg.sesion;
    Store.guardarConfig(cfg);
  }
  function cerrarSesion() { sesion = false; delete cfg.sesion; Store.guardarConfig(cfg); pantalla = 'login'; render(); }
  /* ---------- Bienvenida ---------- */
  let bab = null;
  function bordeABorde(on) { // la portada ocupa toda la pantalla, también bajo las barras del sistema
    if (bab === on || !window.Nativo || !Nativo.bordeABorde) return; bab = on;
    const fijar = () => {
      try {
        const [a, b] = String(Nativo.bordeABorde(on)).split(',').map(Number), r = window.devicePixelRatio || 1;
        document.documentElement.style.setProperty('--sa-top', on ? (a / r) + 'px' : '0px');
        document.documentElement.style.setProperty('--sa-bottom', on ? (b / r) + 'px' : '0px');
      } catch (e) { console.error(e); }
    };
    fijar(); if (on) setTimeout(() => { if (bab) fijar(); }, 600); // al arrancar, las barras pueden medirse un poco después
  }
  function destinoInicial() {
    if (cfg.cuenta && !sesion && !sesionValida()) return 'login';
    if (!cfg.cuenta && !cfg.omitirRegistro) return 'registro';
    return 'inicio';
  }
  function verLegal(k) {
    const x = LEGAL.TEXTOS[k]; if (!x) return;
    abrirHoja(`<h2>${x.t}</h2>${x.h}<div class="acciones"><button class="primario" id="lgCerrar">Entendido</button></div>`);
    $('#capa .hoja').classList.add('legal'); $('#lgCerrar').onclick = cerrarHoja;
  }
  function renderBienvenida(v) {
    const dest = destinoInicial(), p = cfg.perfil || {};
    // Sin cuenta en este dispositivo: Iniciar sesión · Crear cuenta · Importar cuenta (desde la app o la web).
    const sinCuenta = !cfg.cuenta, nuevo = sinCuenta && !cfg.omitirRegistro;
    const etq = dest === 'login' || nuevo ? 'Iniciar sesión' : 'Entrar';
    const botones = nuevo
      ? `<div class="bv-fila"><button class="bv-borde" id="bvCrear">Crear cuenta</button><button class="bv-borde" id="bvImportar">Importar cuenta</button></div>
         <p class="bv-ayuda">¿Ya usas Morpheus MD en la app o en otro navegador? Importa tu cuenta.</p><button class="bv-sec" id="bvSin">Continuar sin cuenta</button>`
      : sinCuenta ? `<div class="bv-links2"><button id="bvLogin">Iniciar sesión</button><button id="bvCrear">Crear cuenta</button><button id="bvImportar">Importar cuenta</button></div>`
      : dest === 'login' ? `<div class="bv-links2"><button id="bvOlvido">Olvidé mi contraseña</button><button id="bvImportar">Importar otra cuenta</button><button id="bvOtra">Crear otra cuenta</button></div>`
      : `<p class="bv-ayuda">Sesión iniciada como <b>${esc(cfg.cuenta.usuario)}</b></p><div class="bv-links2"><button id="bvSalir">Cerrar sesión</button><button id="bvImportar">Importar otra cuenta</button><button id="bvOtra">Crear otra cuenta</button></div>`;
    const titular = p.nombre ? esc(p.nombre) : 'Morpheus MD';
    v.innerHTML = `<div id="bienvenida">
      <div class="bv-foto"><img src="${p.portada || 'img/portada.jpg'}" alt="" onerror="this.remove()"></div>
      <div class="bv-top"><img src="${p.marcaBlanca || IMGS.marcaBlanca}" alt=""><span>Anestesiología</span></div>
      <div class="bv-centro">
        <div class="bv-kicker">Registro anestésico digital</div>
        <h1 class="bv-titulo">Morpheus<br><i>MD</i></h1>
        <p class="bv-lema">Cada paciente, cada minuto, documentado con precisión.</p>
        <div class="bv-rasgos"><div><b>5 min</b>Grilla transoperatoria</div><div><b>TCI · BIC</b>Calculadora</div><div><b>PDF</b>Listo para imprimir</div></div>
        <div><button class="bv-entrar" id="bvEntrar">${etq}<span>→</span></button>${botones}</div>
      </div>
      <footer class="bv-pie">
        <nav class="bv-links"><button data-legal="privacidad">Privacidad</button><button data-legal="terminos">Términos de uso</button><button data-legal="aviso">Aviso médico</button><button data-legal="licencias">Licencias</button></nav>
        <div class="bv-copy">© ${LEGAL.ANIO} ${titular} · Todos los derechos reservados · v${VERSION}</div>
      </footer></div>`;
    $('#bvEntrar').onclick = () => { if (nuevo) { pantalla = 'login'; render(); window.scrollTo(0, 0); return; }
      if (dest === 'inicio' && cfg.cuenta && !sesion && cfg.sesion) iniciarSesion(true); pantalla = dest === 'registro' ? 'inicio' : dest; render(); window.scrollTo(0, 0); };
    if ($('#bvLogin')) $('#bvLogin').onclick = () => { pantalla = 'login'; render(); window.scrollTo(0, 0); };
    if ($('#bvCrear')) $('#bvCrear').onclick = () => { pantalla = 'registro'; render(); window.scrollTo(0, 0); };
    if ($('#bvImportar')) $('#bvImportar').onclick = () => irImportar('bienvenida');
    if ($('#bvSalir')) $('#bvSalir').onclick = cerrarSesion;
    if ($('#bvOtra')) $('#bvOtra').onclick = () => { if (!confirm('Este dispositivo ya tiene la cuenta “' + cfg.cuenta.usuario + '”. Si creas otra, la reemplaza aquí (tus historias se conservan). ¿Continuar?')) return; pantalla = 'registro'; render(); window.scrollTo(0, 0); };
    if ($('#bvSin')) $('#bvSin').onclick = () => { cfg.omitirRegistro = true; Store.guardarConfig(cfg); pantalla = 'inicio'; render(); };
    if ($('#bvOlvido')) $('#bvOlvido').onclick = () => cambiarClaveUI(true);
    $$('[data-legal]').forEach((b) => (b.onclick = () => verLegal(b.dataset.legal)));
  }
  function renderRegistro(v) {
    $('#titulo').textContent = 'Registro del médico';
    const p = cfg.perfil;
    if (!p.especialidad) p.especialidad = 'Anestesiología';
    v.innerHTML = `<section class="tarjeta"><h2>Bienvenido</h2><p class="nota" style="margin-top:0">Registra tus datos una sola vez. Se usan en el recuadro de firma y sello de cada historia.</p></section>` +
      card('Datos profesionales', camposMedico(p)) +
      card('Firma y sello', cajaFirmaSello(p)) +
      card('Usuario y contraseña', `<div class="rejilla ancha"><label class="campo completo"><span>Usuario</span><input id="rgUser" value="${esc(p.correo || '')}" placeholder="Tu correo o un nombre de usuario" autocapitalize="none"></label>
        <label class="campo"><span>Contraseña</span><input id="rgC1" type="password"></label><label class="campo"><span>Repetir contraseña</span><input id="rgC2" type="password"></label></div>
        <label class="campo completo" style="margin-top:6px"><span>Pedir la contraseña</span><select id="rgRec">${RECORDAR.map(([k, t]) => `<option value="${k}"${k === '30' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <p class="nota">La cuenta queda guardada en este teléfono. El inicio con Google necesita configurar un proyecto de Google; se puede agregar después.</p>`) +
      `<div class="fila-btn" style="justify-content:space-between"><button class="secundario" id="rgLuego">Ahora no</button><button class="primario" id="rgOk">Crear mi cuenta</button></div>`;
    enlazarMedico(p); enlazarFirmaSello(p);
    $$('[data-md="correo"]').forEach((e) => e.addEventListener('input', () => { const u = $('#rgUser'); if (u && (!u.value || u.dataset.auto)) { u.value = e.value.trim(); u.dataset.auto = '1'; } }));
    $('#rgLuego').onclick = () => { cfg.omitirRegistro = true; Store.guardarConfig(cfg); pantalla = 'inicio'; render(); };
    $('#rgOk').onclick = () => {
      if (!p.nombre) { aviso('Escribe tu nombre'); return; }
      const u = $('#rgUser').value.trim(), c1 = $('#rgC1').value;
      if (!u) { aviso('Escribe un usuario'); return; } if (c1.length < 4) { aviso('La contraseña debe tener al menos 4 caracteres'); return; }
      if (c1 !== $('#rgC2').value) { aviso('Las contraseñas no coinciden'); return; }
      const r = Cuenta.crear(u, c1); r.cuenta.recordar = $('#rgRec').value; r.cuenta.pedirClave = r.cuenta.recordar !== 'nunca'; cfg.cuenta = r.cuenta; cfg.omitirRegistro = false;
      iniciarSesion(true);
      mostrarCodigo(r.codigo, () => { pantalla = 'inicio'; render(); aviso('Cuenta creada'); });
    };
  }
  function renderLogin(v) {
    $('#titulo').textContent = 'Morpheus MD';
    $('#btnMenu').hidden = true;
    if (!cfg.cuenta) {
      $('#btnAtras').hidden = false;
      v.innerHTML = `<section class="tarjeta" style="margin-top:30px"><h2>Iniciar sesión</h2>
        <p style="margin-top:0">En este dispositivo todavía no hay ninguna cuenta.</p>
        <p class="nota">Tu cuenta vive en el teléfono o navegador donde la creaste. Para entrar con ella aquí, impórtala: en ese dispositivo exporta tu cuenta y abre el archivo en este.</p>
        <div class="fila-btn" style="justify-content:space-between"><button class="secundario" id="lgCrear">Crear una cuenta nueva</button><button class="primario" id="lgImportar">Importar mi cuenta</button></div></section>`;
      $('#lgImportar').onclick = () => irImportar('login');
      $('#lgCrear').onclick = () => { pantalla = 'registro'; render(); window.scrollTo(0, 0); };
      return;
    }
    v.innerHTML = `<section class="tarjeta" style="margin-top:30px"><h2>Iniciar sesión</h2>
      ${cfg.perfil.nombre ? `<p style="margin:0 0 12px">${esc(cfg.perfil.nombre)}</p>` : ''}
      <div class="rejilla ancha"><label class="campo completo"><span>Usuario</span><input id="lgUser" value="${esc(cfg.cuenta.usuario)}" autocapitalize="none"></label>
      <label class="campo completo"><span>Contraseña</span><input id="lgClave" type="password" autofocus></label></div>
      ${recordarDe(cfg.cuenta) !== 'siempre' ? `<div class="check"><input type="checkbox" id="lgMant" checked><label for="lgMant" style="flex:1">Mantener la sesión iniciada en este equipo (volverá a pedirla ${RECORDAR.find((x) => x[0] === recordarDe(cfg.cuenta))[1].toLowerCase()})</label></div>
      <p class="nota" style="margin-top:4px">Desmárcalo si usas un computador compartido.</p>` : ''}
      <div class="fila-btn" style="justify-content:space-between"><button class="secundario chico" id="lgOlvido">Olvidé mi contraseña</button><button class="primario" id="lgOk">Entrar</button></div>
      <p class="nota" style="margin-top:14px">¿Es otra cuenta? <button class="enlace" id="lgOtra">Importar otra cuenta</button></p></section>`;
    const entrar = () => {
      if (Cuenta.verificar(cfg.cuenta, $('#lgUser').value, $('#lgClave').value)) { iniciarSesion(!$('#lgMant') || $('#lgMant').checked); $('#btnMenu').hidden = false; pantalla = 'inicio'; render(); }
      else aviso('Usuario o contraseña incorrectos');
    };
    $('#lgOk').onclick = entrar; $('#lgClave').onkeydown = (e) => { if (e.key === 'Enter') entrar(); };
    $('#lgOlvido').onclick = () => cambiarClaveUI(true);
    $('#lgOtra').onclick = () => irImportar('login');
  }

  /* ---------- Importar / exportar la cuenta (pasarla de la app a la web o a otro teléfono) ---------- */
  let impDesde = 'bienvenida', impDatos = null;
  function irImportar(desde) { impDesde = desde; impDatos = null; pantalla = 'importar'; render(); window.scrollTo(0, 0); }
  function datosCuenta(obj) {
    if (!obj || obj.app !== 'historia-anestesia') throw new Error('Este archivo no es de Morpheus MD.');
    const c = obj.config && obj.config.cuenta;
    if (!c || !c.hash) throw new Error('Este archivo no trae ninguna cuenta (se exportó sin cuenta creada).');
    return obj;
  }
  function exportarCuenta() {
    const pack = (conHist) => {
      const r = Store.respaldo(), conf = JSON.parse(JSON.stringify(r.config || cfg)); delete conf.sesion; delete conf.omitirRegistro;
      return { app: 'historia-anestesia', tipo: 'cuenta', version: 1, fecha: new Date().toISOString(), config: conf, historias: conHist ? r.historias : [], docs: conHist ? r.docs : [] };
    };
    const salir = (conHist) => {
      const d = JSON.stringify(pack(conHist)), u = (cfg.cuenta.usuario || 'cuenta').replace(/[^a-z0-9._-]+/gi, '_');
      const n = `morpheus-cuenta_${u}${conHist ? '_con-historias' : ''}_${hoyISO()}.json`;
      if (window.Nativo) Nativo.exportarTexto(d, n); else descargar(new Blob([d], { type: 'application/json' }), n);
      aviso('Archivo de cuenta listo');
    };
    const nh = Store.indice().length;
    abrirHoja(`<h2>Exportar mi cuenta</h2>
      <p>Crea un archivo con tu usuario, tu perfil, tu firma y sello y tus preferencias, para abrir tu cuenta en la web, en la app o en otro teléfono (en ese dispositivo: Inicio → <b>Importar cuenta</b>).</p>
      <p class="nota">La contraseña va cifrada y se pide al importar. Si incluyes las historias, el archivo lleva datos de pacientes: compártelo solo contigo (no en grupos).</p>
      <div class="acciones" style="flex-wrap:wrap"><button class="secundario" id="exSolo">Solo la cuenta</button><button class="primario" id="exTodo">Cuenta + historias (${nh})</button></div>`);
    $('#exSolo').onclick = () => { cerrarHoja(); salir(false); };
    $('#exTodo').onclick = () => { cerrarHoja(); salir(true); };
  }
  function renderImportar(v) {
    $('#titulo').textContent = 'Importar mi cuenta';
    $('#btnMenu').hidden = !cfg.cuenta || !sesion;
    const d = impDatos, c = d && d.config.cuenta, p = (d && d.config.perfil) || {};
    const nh = d ? (d.historias || []).length : 0;
    const otra = !!(d && cfg.cuenta && cfg.cuenta.usuario !== c.usuario);
    v.innerHTML = card('Cómo traer tu cuenta', `<ol class="pasos">
        <li>En el dispositivo donde ya tienes tu cuenta (app o web) abre <b>⋮ → Mi perfil y firma → Mi cuenta → Exportar mi cuenta</b>.</li>
        <li>Envíate el archivo (WhatsApp, correo o Drive) y descárgalo en este dispositivo.</li>
        <li>Elígelo aquí y confirma con tu contraseña.</li></ol>
        <p class="nota">También sirve un respaldo completo (⋮ → Respaldo → Exportar) hecho después de crear la cuenta.</p>`) +
      card('Archivo de la cuenta', d
        ? `<p style="margin:0 0 4px"><b>${esc(p.nombre || c.usuario)}</b></p><p class="nota" style="margin:0">Usuario: ${esc(c.usuario)} · ${nh ? nh + (nh === 1 ? ' historia' : ' historias') : 'sin historias'}${d.fecha && !isNaN(new Date(d.fecha)) ? ' · exportado el ' + new Date(d.fecha).toLocaleDateString('es-VE') : ''}</p>
           <div class="fila-btn"><label class="secundario chico" style="display:inline-block">Elegir otro archivo<input type="file" id="imFile" accept="application/json,.json,*/*" hidden></label></div>`
        : `<div class="fila-btn"><label class="primario" style="display:inline-block">Elegir archivo<input type="file" id="imFile" accept="application/json,.json,*/*" hidden></label></div>`) +
      (d ? card('Confirma que es tu cuenta', `<div class="rejilla ancha"><label class="campo completo"><span>Usuario</span><input id="imUser" value="${esc(c.usuario)}" autocapitalize="none"></label>
          <label class="campo completo"><span>Contraseña</span><input id="imClave" type="password"></label></div>
          ${nh ? `<div class="check"><input type="checkbox" id="imHist" checked><label for="imHist" style="flex:1">Traer también ${nh === 1 ? 'la historia' : 'las ' + nh + ' historias'} (se suman a las de este dispositivo)</label></div>` : ''}
          ${otra ? `<p class="nota" style="color:#b3261e">Este dispositivo ya tiene otra cuenta (${esc(cfg.cuenta.usuario)}). Se reemplazará por la importada; las historias guardadas aquí se conservan.</p>` : ''}
          <p class="nota">¿No recuerdas la contraseña? Recupérala primero en el dispositivo original con tu código de recuperación y vuelve a exportar.</p>
          <div class="fila-btn" style="justify-content:flex-end"><button class="primario" id="imOk">Importar y entrar</button></div>`) : '');
    $('#imFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { impDatos = datosCuenta(JSON.parse(r.result)); render(); setTimeout(() => $('#imClave') && $('#imClave').focus(), 50); } catch (er) { impDatos = null; alert('No se pudo leer: ' + (er.message || er)); render(); } };
      r.readAsText(f); };
    if (!d) return;
    const ok = () => {
      if (!Cuenta.verificar(c, $('#imUser').value, $('#imClave').value)) { aviso('Usuario o contraseña incorrectos'); return; }
      if (otra && !confirm('¿Reemplazar la cuenta ' + cfg.cuenta.usuario + ' de este dispositivo por ' + c.usuario + '?')) return;
      const conHist = !!($('#imHist') && $('#imHist').checked);
      let n = 0;
      try { n = Store.restaurar({ app: d.app, config: d.config, historias: conHist ? d.historias : [], docs: conHist ? d.docs : [] }, false); }
      catch (er) { alert('No se pudo importar: ' + er.message); return; }
      cfg = Store.config() || cfg;
      const src = d.config;
      Object.keys(src).forEach((k) => { if (['sesion', 'omitirRegistro', 'sedes'].includes(k)) return;
        if (k === 'cuenta' || k === 'perfil' || cfg[k] === undefined) cfg[k] = JSON.parse(JSON.stringify(src[k])); });
      cfg.omitirRegistro = false; impDatos = null;
      iniciarSesion(true); $('#btnMenu').hidden = false; pantalla = 'inicio'; render(); window.scrollTo(0, 0);
      aviso('Cuenta importada' + (n ? ' · ' + n + ' historias' : ''));
    };
    $('#imOk').onclick = ok; $('#imClave').onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  }

  function renderPerfil(v) {
    $('#titulo').textContent = 'Mi perfil y firma';
    const p = cfg.perfil;
    const c = cfg.cuenta;
    v.innerHTML = card('Mis datos profesionales', camposMedico(p) +
        `<label class="campo completo" style="margin-top:10px"><span>Texto bajo la firma (vacío = se arma solo con tus datos)</span><textarea id="pfSello" placeholder="${esc(Cuenta.componerSello(p) || 'Dr. Nombre Apellido')}">${esc(p.sello)}</textarea></label>
        <div class="check"><input type="checkbox" id="pfBajo"${p.datosBajoFirma !== false ? ' checked' : ''}><label for="pfBajo" style="flex:1">Imprimir mis datos bajo la firma</label></div>
        <p class="nota">Se copian en cada historia nueva (Anestesiólogo y texto del sello).</p>`) +
      card('Firma y sello escaneados', cajaFirmaSello(p) +
        `<div class="check"><input type="checkbox" id="pfUsarEsc"${p.usarEscaneo !== false ? ' checked' : ''}><label for="pfUsarEsc" style="flex:1">Colocarlos solos en las historias nuevas</label></div>`) +
      card('Mi cuenta', c ? `<p style="margin:0 0 8px">Usuario: <b>${esc(c.usuario)}</b></p>
          <label class="campo completo"><span>Pedir la contraseña</span><select id="ctRec">${RECORDAR.map(([k, t]) => `<option value="${k}"${recordarDe(c) === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
          <p class="nota">Mientras la sesión esté iniciada, la app abre sin pedir la contraseña. En un computador compartido elige “Cada vez que abro la app” o cierra sesión al terminar.</p>
          <div class="fila-btn"><button class="secundario" id="ctClave">Cambiar contraseña</button><button class="secundario" id="ctSalir">Cerrar sesión</button></div>
          <div class="fila-btn"><button class="primario" id="ctExportar">Exportar mi cuenta</button></div>
          <p class="nota">Para abrir tu cuenta en la web, en la app o en otro teléfono: exporta aquí y en el otro dispositivo toca “Importar cuenta”.</p>`
        : `<p class="nota" style="margin-top:0">Aún no tienes cuenta en este dispositivo. Crea una para proteger la app con usuario y contraseña, o importa la que ya usas en la app o en la web.</p><div class="fila-btn"><button class="secundario" id="ctImportar">Importar mi cuenta</button><button class="primario" id="ctCrear">Crear mi cuenta</button></div>`) +
      card('Mis preferencias de cálculo', `<div class="rejilla ancha">
        <label class="campo"><span>Fórmula de PMP por defecto</span><select id="pfForm">${Object.entries(FORM_PMP).map(([k, x]) => `<option value="${k}"${(p.formPmp || 'rapida') === k ? ' selected' : ''}>${x.t}</option>`).join('')}</select></label>
        <label class="campo"><span>Hto mínimo aceptable por defecto</span><div class="con-unidad"><input id="pfHto" inputmode="decimal" value="${esc(p.htoMin || '')}" placeholder="30"><em>%</em></div></label></div>
        <p class="nota">Se aplican a las historias nuevas; en cada historia puedes cambiarlas.</p>`) +
      card('Firma guardada', (p.firma ? `<img class="firma-img" src="${p.firma}" alt="Firma">` : '<p class="nota">Aún no has guardado tu firma.</p>') +
        `<div class="fila-btn"><button class="primario" id="pfFirmar">${p.firma ? 'Cambiar firma' : 'Dibujar firma'}</button>${p.firma ? '<button class="peligro" id="pfQuitar">Quitar</button>' : ''}</div>
        <p class="nota">La firma guardada se coloca sola en las historias nuevas. Puedes cambiarla en cada historia.</p>`) +
      card('Imagen de portada', `<div style="display:flex;gap:12px;align-items:center">
        <img src="${p.portada || 'img/portada.jpg'}" alt="portada" style="width:64px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--borde)">
        <div style="flex:1"><p class="nota" style="margin-top:0">La foto de la pantalla de inicio. Puedes usar una tuya (vertical se ve mejor).</p>
        <div class="fila-btn"><label class="secundario chico" style="display:inline-block">Cambiar foto<input type="file" accept="image/*" id="ptFile" hidden></label>
        ${p.portada ? '<button class="secundario chico" id="ptReset">Volver a la original</button>' : ''}</div></div></div>`) +
      card('Mi marca personal (marca de agua)', `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="background:#000;border-radius:10px;padding:10px;width:96px;height:96px;display:flex;align-items:center;justify-content:center">
          <img src="${p.marcaBlanca || IMGS.marcaBlanca}" style="max-width:76px;max-height:76px;opacity:${p.marcaOpacidad || 0.55}" alt="marca"></div>
        <div style="flex:1;min-width:180px">${''}
          <div class="check"><input type="checkbox" id="mcOn"${p.marcaOn !== false ? ' checked' : ''}><label for="mcOn" style="flex:1;min-width:0">Mostrar en el encabezado del PDF</label></div>
          <div class="check"><input type="checkbox" id="mcCentro"${p.marcaCentro ? ' checked' : ''}><label for="mcCentro" style="flex:1;min-width:0">También grande y muy tenue en el centro de la hoja</label></div>
        </div></div>
        <div class="grupo" style="margin-top:10px"><div class="etq">Transparencia en el encabezado</div><div class="opciones">
          ${[['0.35', 'Suave'], ['0.55', 'Media'], ['0.8', 'Fuerte'], ['1', 'Sólida']].map(([v, t]) => `<button type="button" class="opcion${String(p.marcaOpacidad || '0.55') === v ? ' sel' : ''}" data-mcop="${v}">${t}</button>`).join('')}</div></div>
        <div class="fila-btn"><label class="secundario chico" style="display:inline-block">Cambiar imagen<input type="file" accept="image/*" id="mcFile" hidden></label>
          ${p.marcaBlanca ? '<button class="secundario chico" id="mcReset">Volver a la original</button>' : ''}</div>
        <p class="nota">Sube tu logo sin fondo (PNG transparente) o sobre fondo liso; la app le quita el fondo sola. También es el logo del membrete de la valoración preanestésica y del récipe.</p>`);
    $('#ptFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return;
      leerImagen(f, 1400, 'image/jpeg').then((d) => { p.portada = d; Store.guardarConfig(cfg); render(); aviso('Portada actualizada'); }).catch(() => aviso('No se pudo leer la imagen')); };
    if ($('#ptReset')) $('#ptReset').onclick = () => { delete p.portada; Store.guardarConfig(cfg); render(); };
    $('#mcOn').onchange = (e) => { p.marcaOn = e.target.checked; Store.guardarConfig(cfg); };
    $('#mcCentro').onchange = (e) => { p.marcaCentro = e.target.checked; Store.guardarConfig(cfg); };
    $$('[data-mcop]').forEach((b) => (b.onclick = () => { p.marcaOpacidad = b.dataset.mcop; Store.guardarConfig(cfg); render(); }));
    $('#mcFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return;
      prepararMarca(f).then((m) => { p.marcaBlanca = m.blanca; p.marcaNegra = m.negra; Store.guardarConfig(cfg); render(); aviso('Marca actualizada'); })
        .catch(() => aviso('No se pudo leer la imagen')); };
    if ($('#mcReset')) $('#mcReset').onclick = () => { delete p.marcaBlanca; delete p.marcaNegra; Store.guardarConfig(cfg); render(); };
    enlazarMedico(p); enlazarFirmaSello(p);
    $('#pfSello').oninput = (e) => { p.sello = e.target.value; Store.guardarConfig(cfg); };
    $('#pfBajo').onchange = (e) => { p.datosBajoFirma = e.target.checked; Store.guardarConfig(cfg); };
    $('#pfUsarEsc').onchange = (e) => { p.usarEscaneo = e.target.checked; Store.guardarConfig(cfg); };
    if ($('#ctRec')) $('#ctRec').onchange = (e) => { cfg.cuenta.recordar = e.target.value; cfg.cuenta.pedirClave = e.target.value !== 'nunca'; iniciarSesion(true); aviso('Guardado'); };
    if ($('#ctSalir')) $('#ctSalir').onclick = cerrarSesion;
    if ($('#ctCrear')) $('#ctCrear').onclick = () => { pantalla = 'registro'; render(); };
    if ($('#ctImportar')) $('#ctImportar').onclick = () => irImportar('perfil');
    if ($('#ctExportar')) $('#ctExportar').onclick = exportarCuenta;
    if ($('#ctClave')) $('#ctClave').onclick = () => cambiarClaveUI(false);
    $('#pfForm').onchange = (e) => { p.formPmp = e.target.value; Store.guardarConfig(cfg); };
    $('#pfHto').oninput = (e) => { p.htoMin = e.target.value; Store.guardarConfig(cfg); };
    $('#pfFirmar').onclick = () => padFirma('Tu firma', (d) => { p.firma = d; Store.guardarConfig(cfg); render(); });
    if ($('#pfQuitar')) $('#pfQuitar').onclick = () => { p.firma = ''; Store.guardarConfig(cfg); render(); };
  }

  function respaldo() {
    menu([
      { t: '⬆ Exportar respaldo (todas las historias)', f: () => {
        const d = JSON.stringify(Store.respaldo()); const n = 'respaldo_anestesia_' + hoyISO() + '.json';
        if (window.Nativo) Nativo.exportarTexto(d, n); else descargar(new Blob([d], { type: 'application/json' }), n);
      } },
      { t: '⬇ Importar respaldo', f: () => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json,*/*';
        i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader();
          r.onload = () => { try { const n = Store.restaurar(JSON.parse(r.result)); cfg = Store.config(); render(); aviso(n + ' historias importadas'); } catch (e) { alert('No se pudo importar: ' + e.message); } };
          r.readAsText(f); };
        i.click();
      } },
    ]);
  }

  /* ---------- PDF ---------- */
  function descargar(blob, nombre) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); }
  function nombrePdf() {
    const n = (H.p.nombre || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `Anestesia_${n}_${H.p.fecha || hoyISO()}.pdf`;
  }
  function b64aBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function accionPdf(acc, b64, blob, nombre) {
    try {
      if (window.Nativo) { Nativo.pdf(b64, nombre, acc); return; }
      // Versión web (PC, tablet, iPhone): compartir, imprimir o descargar con lo que ofrezca el navegador
      if (acc === 'compartir') {
        const f = new File([blob], nombre, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: nombre }).catch(() => {}); return; }
        descargar(blob, nombre); aviso('Tu navegador no comparte archivos: se descargó el PDF'); return;
      }
      if (acc === 'imprimir') {
        const url = URL.createObjectURL(blob), ifr = document.createElement('iframe');
        ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        ifr.onload = () => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) { window.open(url, '_blank'); } setTimeout(() => ifr.remove(), 60000); };
        ifr.src = url; document.body.appendChild(ifr); return;
      }
      if (acc === 'externo') { window.open(URL.createObjectURL(blob), '_blank'); return; }
      descargar(blob, nombre);
    } catch (e) { console.error(e); alert('Error: ' + e.message); }
  }
  /* Vista previa dentro de la app; el PDF se comparte / guarda / imprime desde el visor. */
  const botonesPdf = (b64, blob, nombre) => [
    { t: '<i>📤</i>Compartir', f: () => accionPdf('compartir', b64, blob, nombre) },
    { t: '<i>💾</i>Guardar PDF', f: () => { accionPdf('descargas', b64, blob, nombre); } },
    { t: '<i>🖨</i>Imprimir', f: () => accionPdf('imprimir', b64, blob, nombre) },
    { t: '<i>↗</i>Otra app', f: () => accionPdf(window.Nativo ? 'ver' : 'externo', b64, blob, nombre) },
  ];
  function accionesPdf() {
    if (pantalla === 'doc') return pdfDoc();
    guardarYa();
    aviso('Preparando vista previa…', 1200);
    setTimeout(() => {
      try {
        calcular();
        const doc = PDFHistoria.generar(H, sede(H.sedeId), cfg.perfil);
        const nombre = nombrePdf();
        const b64 = doc.output('datauristring').split(',')[1];
        const blob = doc.output('blob');
        Visor.abrir({
          bytes: b64aBytes(b64), titulo: (H.p.nombre || 'Historia') + ' — vista previa',
          acciones: botonesPdf(b64, blob, nombre),
        });
      } catch (e) { console.error(e); alert('Error al generar el PDF: ' + e.message); }
    }, 30);
  }


  /* ================= Extras (vista previa 2.0): valoración preanestésica y récipe ================= */
  let docTimer = null;
  function guardarDocPronto() { const e = $('#estadoGuardado'); if (e) e.textContent = 'Guardando…'; clearTimeout(docTimer); docTimer = setTimeout(guardarDocYa, 500); }
  function guardarDocYa() {
    clearTimeout(docTimer); docTimer = null; if (!D) return;
    const ok = Store.guardarDoc(D); const e = $('#estadoGuardado');
    if (e) e.textContent = ok ? 'Guardado ' + new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '⚠ No se pudo guardar';
  }
  function nuevoDoc(tipo) {
    const b = { id: uid(), tipo, creado: Date.now(), fecha: hoyISO(), p: {} };
    if (tipo === 'val') Object.assign(b, { ant: {}, hpb: {}, meds: [], sb: {}, rcri: {}, ef: { obese: {} }, lab: [{}], cv: {}, analg: {}, indicSel: [0, 1] });
    else Object.assign(b, { items: [{}], gen: '', control: '' });
    return b;
  }
  function migrarDoc(x) {
    const base = nuevoDoc(x.tipo);
    const fusion = (a, b) => { for (const k in b) { if (a[k] == null) a[k] = b[k]; else if (typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof a[k] === 'object') fusion(a[k], b[k]); } return a; };
    return fusion(x, base);
  }
  function abrirDoc(x) { D = x; pantalla = 'doc'; render(); window.scrollTo(0, 0); }
  function docCambio(k) {
    guardarDocPronto();
    const m = /^meds\.(\d+)\.ref$/.exec(k);
    if (m) { const it = D.meds[+m[1]]; if (it.ref && it.ref !== '__otro' && !t2(it.n)) it.n = it.ref; render(); return; }
    if (/^(p\.sexo|compl)$/.test(k)) { render(); return; }
    if (D.tipo === 'val') pintarCalcVal();
    else if (k === 'p.nombre') $('#titulo').textContent = D.p.nombre || 'Récipe';
  }
  const t2 = (x) => (x == null ? '' : String(x).trim());

  function renderExtras(v) {
    $('#titulo').textContent = 'Extras';
    const docs = Store.docs().sort((a, b) => b.modificado - a.modificado);
    const lista = (tipo) => { const l = docs.filter((x) => x.tipo === tipo); return l.length ? `<ul class="lista">${l.map((x) => `<li class="item" data-acc="docAbrir" data-id="${x.id}"><div class="txt"><b>${esc(x.nombre || 'Sin nombre')}</b>
      <small>${[x.ci && 'CI ' + x.ci, Extras.fechaTxt(x.fecha)].filter(Boolean).map(esc).join(' · ')}</small><small>${esc(x.det || '')}</small></div>
      <button class="icono" style="color:var(--suave)" data-acc="docMas" data-id="${x.id}" aria-label="Opciones">&#8942;</button></li>`).join('')}</ul>` : '<p class="nota" style="margin:0">Aún no hay documentos.</p>'; };
    v.innerHTML = `<section class="tarjeta ex-intro"><div class="ex-marca">Vista previa · versión 2.0</div><h2>Extras</h2>
        <p class="nota" style="margin:0">Documentos con tu membrete (logo, nombre, registros y teléfono de "Mi perfil"), tu firma y tu sello. Se guardan en este teléfono.</p></section>` +
      card('Valoración preanestésica', `<div class="fila-btn" style="margin:0 0 12px"><button class="primario" data-acc="docNuevo" data-t="val">+ Nueva valoración</button></div>` + lista('val')) +
      card('Récipe (media carta)', `<div class="fila-btn" style="margin:0 0 12px"><button class="primario" data-acc="docNuevo" data-t="rx">+ Nuevo récipe</button></div>` + lista('rx')) +
      card('Calculadora TIVA · TCI · BIC', `<p class="nota" style="margin:0 0 10px">Propofol (Roberts o modelos Marsh/Schnider), remifentanilo (Minto), dexmedetomidina y coadyuvantes: IMC, pesos para dosificar, concentración y velocidad en la unidad de tu bomba.</p><div class="fila-btn" style="margin:0"><button class="secundario" data-acc="irCalc">🧮 Abrir la calculadora</button></div>`) +
      card('Guías de consulta', `<p class="nota" style="margin:0 0 10px">Tres pestañas: Consulta (fichas de la valoración preanestésica), Crisis (reanimación y crisis en quirófano) y Técnicas. Con fuente y año, sin internet.</p><div class="fila-btn" style="margin:0"><button class="secundario" data-acc="irGuias">📖 Abrir las guías (${GG().fichas.length})</button></div>`) +
      card('Bloqueos regionales', `<p class="nota" style="margin:0 0 10px">${BQ().fichas.length} bloqueos: indicaciones, nervios, territorio sensitivo y motor, técnica ecoguiada, volúmenes, mezclas con los fármacos del HCUAMP, imágenes con licencia abierta y calculadora de dosis máxima.</p><div class="fila-btn" style="margin:0"><button class="secundario" data-acc="irBloqueos">💉 Abrir bloqueos</button></div>`) +
      card('Próximamente en la 2.0', '<ul class="nota" style="margin:0;padding-left:18px;line-height:1.7"><li>Guía de medicación preoperatoria para consultar por fármaco.</li><li>Constancia de reposo e informe médico.</li><li>Más formatos con tu membrete.</li></ul>');
  }

  /* ---- Guías de consulta (fichas en js/guias-datos.js) ---- */
  let guiaId = '', guiaBusca = '', guiaDesde = 'inicio', guiaTab = 'consulta';
  const GG = () => window.GUIAS || { orden: [], pestanas: [], fichas: [], pendientes: [] };
  // En la app Android el enlace se abre en el navegador del teléfono (MainActivity.shouldOverrideUrlLoading).
  const enlace = (u, t) => `<a href="${esc(u)}"${window.Nativo ? '' : ' target="_blank" rel="noopener"'}>${esc(t)}</a>`;
  function textoFicha(f) { return sinTilde([f.titulo, f.resumen, ...(f.secciones || []).map((s) => [s.t, ...(s.items || []), ...((s.tabla || {}).filas || []).flat()].join(' ')), ...(f.alertas || [])].join(' ')); }
  function renderGuias(v) {
    $('#titulo').textContent = 'Guías de consulta';
    const G = GG(), q = sinTilde(guiaBusca), tabs = G.pestanas || [];
    const enTab = (f) => (f.pestanas || ['consulta']).includes(guiaTab);
    const lista = G.fichas.filter((f) => (q ? textoFicha(f).includes(q) : enTab(f)));
    const grupos = G.orden.map((c) => [c, lista.filter((f) => f.categoria === c)]).filter(([, l]) => l.length);
    const tabInfo = tabs.find((t) => t[0] === guiaTab) || ['', '', ''];
    const pend = G.pendientes.filter((p) => (p[3] || 'consulta') === guiaTab);
    const bqCard = guiaTab === 'tecnicas' && !q && window.BLOQUEOS ? `<section class="tarjeta"><h2>Bloqueos regionales</h2><p class="nota" style="margin:0 0 8px">${BQ().fichas.length} bloqueos por región, con técnica, volúmenes, mezclas, imágenes y calculadora de dosis máxima.</p><div class="fila-btn" style="margin:0"><button class="secundario" data-acc="irBloqueos">💉 Abrir bloqueos regionales</button></div></section>` : '';
    const algos = guiaTab === 'crisis' && !q && window.Crisis ? `<section class="tarjeta"><h2>Algoritmos interactivos</h2><p class="nota" style="margin:0 0 8px">Paso a paso, con reloj, contador de adrenalina, dosis por peso y resumen para copiar. También con el botón SOS de arriba.</p><ul class="lista">${Crisis.LISTA.map(([, ids]) => ids).flat().map((id) => `<li class="item" data-acc="crisisAbrir" data-id="${id}"><div class="txt"><b>${esc(Crisis.ALG[id].titulo)}</b><small>${esc(Crisis.ALG[id].sub)}</small></div><span class="flecha">›</span></li>`).join('')}</ul></section>` : '';
    v.innerHTML = `<section class="tarjeta"><div class="segmento calc-tabs" style="margin-bottom:12px">${tabs.map(([k, t]) => `<button type="button" class="${guiaTab === k ? 'sel' : ''}" data-gtab="${k}">${t}</button>`).join('')}</div>
      <label class="campo completo" style="margin:0"><span>Buscar en todas las guías</span><input id="guiaQ" type="search" value="${esc(guiaBusca)}" placeholder="Ej. GLP-1, dantroleno, 180/120"></label>
      <p class="nota">${q ? `Resultados en todas las pestañas (${lista.length}).` : esc(tabInfo[2]) + ' Funcionan sin internet.'}</p></section>` + algos + bqCard +
      (grupos.length ? grupos.map(([c, l]) => card(c, `<ul class="lista">${l.map((f) => `<li class="item" data-acc="guiaAbrir" data-id="${f.id}"><div class="txt"><b>${esc(f.titulo)}</b><small>${esc(f.resumen.length > 150 ? f.resumen.slice(0, 147) + '…' : f.resumen)}</small>
        <small>${esc((f.fuentes || []).slice(0, 2).map((x) => (x.cita.split('.')[0].split(',')[0] + ' ' + (x.anio || '')).trim()).join(' · '))}</small></div><span class="flecha">›</span></li>`).join('')}</ul>`)).join('')
        : card(q ? 'Sin resultados' : 'Aún sin fichas', `<p class="nota" style="margin:0">${q ? 'Ninguna ficha contiene ese texto.' : 'Esta pestaña se irá llenando en las próximas versiones.'}</p>`)) +
      (!q && pend.length ? card('En preparación', `<ul class="nota" style="margin:0;padding-left:18px;line-height:1.7">${pend.map((p) => `<li>${esc(p[1])}</li>`).join('')}</ul>`) : '') +
      '<p class="nota" style="padding:0 6px 20px">Material de consulta rápida: no sustituye el juicio clínico, la ficha técnica ni los protocolos de tu institución.</p>';
    $$('#vista [data-gtab]').forEach((b) => (b.onclick = () => { guiaTab = b.dataset.gtab; guiaBusca = ''; renderGuias(v); window.scrollTo(0, 0); }));
    const inp = $('#guiaQ'); inp.oninput = () => { guiaBusca = inp.value; const pos = inp.selectionStart; renderGuias(v); const n = $('#guiaQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
  }
  function renderGuia(v) {
    const f = GG().fichas.find((x) => x.id === guiaId); if (!f) { pantalla = 'guias'; return renderGuias(v); }
    $('#titulo').textContent = f.titulo;
    const sec = (s) => card(esc(s.t), (s.items ? `<ul class="guia-items">${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '') +
      (s.tabla ? `<div class="desplaza"><table class="tabla guia-tabla${s.tabla.cols.length > 3 ? ' ancha' : ''}"><tr>${s.tabla.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${s.tabla.filas.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : ''));
    v.innerHTML = `<section class="tarjeta guia-cab"><div class="ex-marca">${esc(f.categoria)}</div><h2>${esc(f.titulo)}</h2><p class="guia-resumen">${esc(f.resumen)}</p></section>` +
      f.secciones.map(sec).join('') +
      (f.alertas && f.alertas.length ? `<section class="tarjeta guia-alerta"><h2>⚠ Alertas</h2><ul class="guia-items">${f.alertas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : '') +
      card('Fuentes', `<ol class="guia-fuentes">${f.fuentes.map((x) => `<li>${esc(x.cita)}${x.doi ? ' ' + enlace('https://doi.org/' + x.doi, 'doi:' + x.doi) : x.url ? ' ' + enlace(x.url, x.url.replace(/^https?:\/\//, '')) : ''}</li>`).join('')}</ol>
        <p class="nota">Revisado: ${esc(f.revisado || '')}. Resumen de consulta: no sustituye el juicio clínico ni los protocolos de tu institución.</p>`);
  }

  /* ---- Bloqueos regionales (fichas en js/bloqueos-datos.js) ---- */
  let bqId = '', bqBusca = '', bqDesde = 'inicio', bqTab = 'superior';
  const BQ = () => window.BLOQUEOS || { regiones: [], fichas: [], generales: [], hadzic: '' };
  const BQ_NIVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
  const bqRegion = (k) => ((BQ().regiones.find((r) => r[0] === k) || [])[1] || k);
  const bqTodas = () => BQ().fichas.concat(BQ().generales);
  function bqTexto(f) {
    const pl = (x) => (x == null ? '' : typeof x === 'string' ? x : Array.isArray(x) ? x.map(pl).join(' ') : typeof x === 'object' ? Object.values(x).map(pl).join(' ') : String(x));
    return sinTilde(pl([f.nombre, f.titulo, f.nombre_en, f.alias, f.resumen, f.indicaciones, f.nervios, f.sensitivo, f.motor, f.respeta, f.tecnica, f.mezclas, f.complicaciones, f.consejos, f.secciones, f.alertas]));
  }
  function irBloqueos(tab, id) {
    if (pantalla !== 'bloqueos' && pantalla !== 'bloqueo') bqDesde = pantalla;
    if (tab) bqTab = tab; bqBusca = '';
    if (id) { bqId = id; pantalla = 'bloqueo'; } else pantalla = 'bloqueos';
    render(); window.scrollTo(0, 0);
  }
  function renderBloqueos(v) {
    $('#titulo').textContent = 'Bloqueos regionales';
    const G = BQ(), q = sinTilde(bqBusca);
    const fila = (f) => `<li class="item bq-item" data-acc="bqAbrir" data-id="${f.id}"><div class="txt"><b>${esc(f.nombre || f.titulo)}</b>
      ${f.nombre_en ? `<small>${esc(f.nombre_en + (f.nivel ? ' · ' + BQ_NIVEL[f.nivel] : ''))}</small>` : ''}<small class="bq-res1">${esc(f.resumen)}</small></div>
      ${(f.imagenes || []).length ? '<span class="bq-ico" aria-label="Con imagen">▣</span>' : ''}<span class="flecha">›</span></li>`;
    let cuerpo;
    if (q) {
      const l = bqTodas().filter((f) => bqTexto(f).includes(q));
      cuerpo = l.length ? card(`Resultados (${l.length})`, `<ul class="lista">${l.map(fila).join('')}</ul>`) : card('Sin resultados', '<p class="nota" style="margin:0">Ningún bloqueo contiene ese texto.</p>');
    } else if (bqTab === 'generales') {
      cuerpo = card('Calculadora: dosis máxima y mezclas', bqCalcUI()) +
        card('Fichas generales', `<ul class="lista">${G.generales.map(fila).join('')}</ul>`) +
        card('Fuentes, imágenes y descargo', `<ul class="lista"><li class="item" data-acc="bqAbrir" data-id="_creditos"><div class="txt"><b>Fuentes, créditos de imágenes y descargo de responsabilidad</b><small>Origen y licencia de cada imagen; libros y guías consultados.</small></div><span class="flecha">›</span></li></ul>`);
    } else {
      const l = G.fichas.filter((f) => f.region === bqTab);
      cuerpo = card(esc(bqRegion(bqTab)) + ` (${l.length})`, `<ul class="lista">${l.map(fila).join('')}</ul>`);
    }
    v.innerHTML = `<section class="tarjeta"><div class="bq-tabs" role="tablist">${G.regiones.map(([k, t]) => `<button type="button" class="opcion${bqTab === k && !q ? ' sel' : ''}" data-bqtab="${k}">${esc(t)}</button>`).join('')}</div>
      <label class="campo completo" style="margin:10px 0 0"><span>Buscar en todos los bloqueos</span><input id="bqQ" type="search" value="${esc(bqBusca)}" placeholder="Ej. frénico, cadera, cesárea, dexametasona"></label>
      <p class="nota">${G.fichas.length} bloqueos con indicaciones, nervios, territorio, técnica ecoguiada, volúmenes y mezclas con los fármacos del HCUAMP. Funcionan sin internet.</p></section>` + cuerpo +
      '<p class="nota" style="padding:0 6px 20px">Material de consulta y docencia: no sustituye la formación práctica, el juicio clínico ni los protocolos de tu institución.</p>';
    $$('#vista [data-bqtab]').forEach((b) => (b.onclick = () => { bqTab = b.dataset.bqtab; bqBusca = ''; renderBloqueos(v); window.scrollTo(0, 0); }));
    const inp = $('#bqQ'); inp.oninput = () => { bqBusca = inp.value; const pos = inp.selectionStart; renderBloqueos(v); const n = $('#bqQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
    if (!q && bqTab === 'generales') bqCalcEnlazar();
  }
  const bqLista = (l, ord) => (l && l.length ? `<${ord ? 'ol' : 'ul'} class="guia-items">${l.map((i) => `<li>${esc(i)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>` : '');
  const bqDef = (pares) => `<dl class="bq-dl">${pares.filter(([, x]) => x).map(([t, x]) => `<dt>${esc(t)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>`;
  const bqFuentes = (f) => `<ol class="guia-fuentes">${(f.fuentes || []).map((x) => `<li>${esc(x.cita)}${x.doi ? ' ' + enlace('https://doi.org/' + x.doi, 'doi:' + x.doi) : x.url ? ' ' + enlace(x.url, x.url.replace(/^https?:\/\//, '').slice(0, 60)) : ''}</li>`).join('')}</ol>`;
  const bqLibro = (f) => (f.libro ? card('Para ver figuras en tu libro', `<p style="margin:0">${esc(f.libro)}</p><p class="nota">${esc(BQ().hadzic)} Las figuras de los libros no se reproducen en la app por derechos de autor.</p>`) : '');
  function renderBloqueo(v) {
    if (bqId === '_creditos') return renderBqCreditos(v);
    const f = bqTodas().find((x) => x.id === bqId); if (!f) { pantalla = 'bloqueos'; return renderBloqueos(v); }
    if (f.secciones) { // ficha general
      $('#titulo').textContent = f.titulo;
      const sec = (s) => card(esc(s.t), bqLista(s.items) + (s.tabla ? `<div class="desplaza"><table class="tabla guia-tabla${s.tabla.cols.length > 3 ? ' ancha' : ''}"><tr>${s.tabla.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${s.tabla.filas.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : ''));
      v.innerHTML = `<section class="tarjeta guia-cab"><div class="ex-marca">Bloqueos · Generales</div><h2>${esc(f.titulo)}</h2><p class="guia-resumen">${esc(f.resumen)}</p>
        ${f.calc ? '<div class="fila-btn" style="margin:10px 0 0"><button class="secundario" data-acc="bqIrCalc">🧮 Abrir la calculadora</button></div>' : ''}</section>` +
        (f.alertas && f.alertas.length ? `<section class="tarjeta guia-alerta"><h2>⚠ Alertas</h2>${bqLista(f.alertas)}</section>` : '') +
        f.secciones.map(sec).join('') + bqLibro(f) +
        card('Fuentes', bqFuentes(f) + `<p class="nota">Revisado: ${esc(f.revisado || '')}. Resumen de consulta: no sustituye el juicio clínico ni los protocolos de tu institución.</p>`);
      return;
    }
    $('#titulo').textContent = f.nombre;
    const P = f.posicion || {}, V = f.volumen || {};
    const imgs = (f.imagenes || []).map((im, i) => `<figure class="bq-fig"><img src="img/bloqueos/${esc(im.archivo)}" alt="${esc(f.nombre)}, figura ${i + 1}" loading="lazy" data-acc="bqZoom" data-src="img/bloqueos/${esc(im.archivo)}">
      <figcaption>${esc(im.pie)}<small>Fuente: ${esc(im.credito)} Licencia ${esc(im.licencia)}. ${enlace(im.url, 'Ver artículo')}</small></figcaption></figure>`).join('');
    v.innerHTML = `<section class="tarjeta guia-cab"><div class="ex-marca">${esc(bqRegion(f.region))}${f.nivel ? ' · ' + BQ_NIVEL[f.nivel] : ''}</div><h2>${esc(f.nombre)}</h2>
        <p class="nota" style="margin:0 0 8px">${esc([f.nombre_en, (f.alias || []).join(', ')].filter(Boolean).join(' · '))}</p><p class="guia-resumen">${esc(f.resumen)}</p>
        <div class="fila-btn" style="margin:10px 0 0">${f.nysora ? `<a class="boton secundario" href="${esc(f.nysora)}"${window.Nativo ? '' : ' target="_blank" rel="noopener"'}>Ver en NYSORA ↗</a>` : ''}<button class="secundario" data-acc="bqIrCalc">🧮 Dosis máxima</button></div></section>` +
      (imgs ? card('Imágenes', imgs + '<p class="nota">Toca una imagen para ampliarla. Imágenes de artículos con licencia abierta (Creative Commons), usadas con atribución.</p>') : '') +
      card('Indicaciones', bqLista(f.indicaciones)) +
      (f.contraindicaciones && f.contraindicaciones.length ? card('Contraindicaciones y precauciones', bqLista(f.contraindicaciones)) : '') +
      card('Nervios que se bloquean', bqLista(f.nervios)) +
      card('Territorio', bqDef([['Sensitivo', f.sensitivo], ['Motor', f.motor], ['No cubre', f.respeta]])) +
      card('Anatomía clave', bqLista(f.anatomia)) +
      card('Posición y sonda', bqDef([['Paciente', P.paciente], ['Sonda', P.sonda], ['Profundidad', P.profundidad]])) +
      card('Sonoanatomía', bqLista(f.sonoanatomia)) +
      card('Técnica', bqLista(f.tecnica, true)) +
      card('Aguja, volumen y mezclas', bqDef([['Aguja', f.aguja], ['Volumen adulto', V.adulto], ['Volumen niño', V.nino]]) + '<h3>Mezclas con los fármacos del HCUAMP</h3>' + bqLista(f.mezclas) +
        (f.duracion ? bqDef([['Duración', f.duracion]]) : '') + '<p class="nota">Antes de cargar: calcula el tope con el peso del paciente (botón “Dosis máxima”). En bloqueos bilaterales suma ambos lados.</p>') +
      card('Complicaciones', bqLista(f.complicaciones)) +
      (f.consejos && f.consejos.length ? card('Consejos', bqLista(f.consejos)) : '') +
      (f.evidencia && f.evidencia.length ? card('Evidencia y guías', bqLista(f.evidencia)) : '') +
      bqLibro(f) +
      card('Fuentes', bqFuentes(f) + `<p class="nota">Revisado: ${esc(f.revisado || '')}. Texto redactado a partir de las fuentes citadas; no reemplaza la formación práctica supervisada.</p>`);
  }
  function renderBqCreditos(v) {
    $('#titulo').textContent = 'Fuentes y créditos';
    const G = BQ(), porUrl = {};
    G.fichas.forEach((f) => (f.imagenes || []).forEach((im) => { const k = im.url; (porUrl[k] = porUrl[k] || { cred: im.credito.replace(/\s*Figura\s*[\w.,\s y]+\.?$/i, '').trim(), lic: im.licencia, url: im.url, usos: [] }).usos.push(f.nombre + ' (' + im.archivo + ')'); }));
    v.innerHTML = card('Descargo de responsabilidad', `<ul class="guia-items">
        <li>Esta sección es material de consulta y docencia para anestesiólogos. No sustituye la formación práctica supervisada, el juicio clínico, la ficha técnica de cada fármaco ni los protocolos del HCUAMP.</li>
        <li>Los textos están redactados con palabras propias a partir de guías, artículos, NYSORA y libros de referencia, que se citan en cada ficha. No se copian textos literales.</li>
        <li>Morpheus MD no reclama la propiedad de ninguna imagen. Todas las imágenes pertenecen a sus autores y editoriales, provienen de artículos publicados con licencia Creative Commons Atribución (CC BY 4.0), que permite compartirlas y adaptarlas citando la fuente, y se muestran con su crédito completo y un enlace al artículo original.</li>
        <li>Las figuras de libros (Miller, Hadzic, Tornero y otros), de NYSORA y de otros sitios web están protegidas por derechos de autor y no se reproducen: cada ficha indica dónde verlas (botón “Ver en NYSORA” y capítulo del libro).</li>
        <li>Si eres autor o titular de alguna imagen y quieres que se retire o se corrija su atribución, escríbenos y se hará en la siguiente versión.</li></ul>`) +
      card('Libros y guías de referencia', `<ul class="guia-items"><li>${esc(G.hadzic)}</li>
        <li>El-Boghdadly K, Albrecht E, Wolmarans M, et al. Standardizing nomenclature in regional anesthesia: an ASRA-ESRA Delphi consensus study of upper and lower limb nerve blocks. Reg Anesth Pain Med 2024;49:782–792. ${enlace('https://doi.org/10.1136/rapm-2023-104884', 'doi:10.1136/rapm-2023-104884')}</li>
        <li>El-Boghdadly K, Wolmarans M, Stengel AD, et al. Standardizing nomenclature in regional anesthesia: an ASRA-ESRA Delphi consensus study of abdominal wall, paraspinal, and chest wall blocks. Reg Anesth Pain Med 2021;46:571–580. ${enlace('https://doi.org/10.1136/rapm-2020-102451', 'doi:10.1136/rapm-2020-102451')}</li>
        <li>NYSORA, The New York School of Regional Anesthesia (nysora.com): páginas de técnica consultadas en septiembre de 2026.</li>
        <li>BJA Education (Elsevier, CC BY) y guías PROSPECT (ESRA), citadas en cada ficha.</li></ul>`) +
      card(`Imágenes (${Object.keys(porUrl).length} artículos)`, `<ol class="guia-fuentes">${Object.values(porUrl).map((x) => `<li>${esc(x.cred)} Licencia ${esc(x.lic)}. ${enlace(x.url, x.url.replace('https://doi.org/', 'doi:'))}<br><small>Usada en: ${esc(x.usos.join('; '))}</small></li>`).join('')}</ol>
        <p class="nota">Las imágenes se recortaron o redimensionaron para verlas en el teléfono; el contenido no se modificó. Pies de figura traducidos y redactados en español.</p>`);
  }
  function bqZoom(src) {
    abrirHoja(`<div class="bq-zoom"><img src="${esc(src)}" alt="Imagen ampliada" id="bqZimg"></div><p class="nota">Toca la imagen para acercar o alejar; desliza para moverte.</p><div class="acciones"><button class="primario" id="bqZcerrar">Cerrar</button></div>`);
    $('#bqZcerrar').onclick = cerrarHoja; const im = $('#bqZimg'); im.onclick = () => im.classList.toggle('grande');
  }

  /* Calculadora de dosis máxima de AL y mezclas (regla de fracciones aditivas). Topes: ficha general "dosis-maximas". */
  const BQ_PRES = [['bupi05', 'Bupivacaína 0,5 %', { b: 5 }], ['bupi0375', 'Bupivacaína 0,375 %', { b: 3.75 }], ['bupi025', 'Bupivacaína 0,25 %', { b: 2.5 }], ['bupi0125', 'Bupivacaína 0,125 %', { b: 1.25 }],
    ['lido2', 'Lidocaína 2 %', { l: 20 }], ['lido1', 'Lidocaína 1 %', { l: 10 }], ['mezcla', 'Mezcla 1:1 bupi 0,5 % + lido 2 %', { b: 2.5, l: 10 }]];
  const BQ_GRUPOS = [['adulto', 'Adulto'], ['mayor', 'Adulto mayor'], ['nino', 'Niño (≥ 4 meses)'], ['lactante', 'Lactante 1–4 meses'], ['neonato', 'Neonato (< 1 mes)']];
  const BQ_FACT = [['emb', 'Embarazo'], ['ic', 'Insuficiencia cardíaca grave'], ['hep', 'Hepatopatía con bolos repetidos o infusión'], ['ure', 'Uremia con acidosis metabólica'], ['rep', 'Dosis repetidas o infusión']];
  const bqC = { peso: '', grupo: 'adulto', fact: {}, manual: '', filas: [{ p: 'bupi05', epi: false, ml: '' }] };
  function bqTopes() { // mg máximos por fármaco y epinefrina, con la reducción aplicada
    const d = (BQ().generales.find((g) => g.id === 'dosis-maximas') || {}).calc; const peso = num(bqC.peso);
    if (!d || !(peso > 0)) return null;
    const ped = ['nino', 'lactante', 'neonato'].includes(bqC.grupo);
    const avisos = []; let red = 0;
    if (bqC.grupo === 'mayor') { red = 20; avisos.push('Adulto mayor: se aplicó −20 % (las fuentes dicen reducir 10–20 %, sobre todo con dosis repetidas; El-Boghdadly 2018).'); }
    if (bqC.grupo === 'lactante') { red = 15; avisos.push('Menor de 4 meses: se aplicó −15 % sobre el tope pediátrico (El-Boghdadly 2018).'); }
    if (bqC.grupo === 'neonato') { red = 50; avisos.push('Neonato: se aplicó −50 % sobre el tope pediátrico (NYSORA: usar la mitad; se elige la reducción mayor).'); }
    const fs = BQ_FACT.filter(([k]) => bqC.fact[k]);
    if (fs.length) { red = Math.max(red, 20); avisos.push(`${fs.map((x) => x[1]).join(', ')}: las fuentes indican reducir pero no dan un porcentaje; la app aplica −20 % por prudencia. Ajusta la reducción si lo crees necesario.`); }
    if (bqC.manual !== '') { red = num(bqC.manual); avisos.push(`Reducción fijada a mano: −${red} %.`); }
    const k = 1 - Math.min(Math.max(red, 0), 90) / 100;
    const tope = (mgkg, techo) => Math.min(mgkg * peso, techo) * k;
    const t = ped ? { l0: tope(5, d.lidocaina.sin_epi_max_mg), l1: tope(5, d.lidocaina.con_epi_max_mg), b0: tope(2.5, d.bupivacaina.sin_epi_max_mg), b1: tope(2.5, d.bupivacaina.con_epi_max_mg) }
      : { l0: tope(d.lidocaina.sin_epi_mgkg, d.lidocaina.sin_epi_max_mg), l1: tope(d.lidocaina.con_epi_mgkg, d.lidocaina.con_epi_max_mg), b0: tope(d.bupivacaina.sin_epi_mgkg, d.bupivacaina.sin_epi_max_mg), b1: tope(d.bupivacaina.con_epi_mgkg, d.bupivacaina.con_epi_max_mg) };
    if (ped) avisos.push('Niños: tope por dosis única de NYSORA (lidocaína 5 mg/kg, bupivacaína 2,5 mg/kg), sin distinguir epinefrina.');
    return { t, red, avisos, ped };
  }
  function bqCalcUI() {
    const opt = (l, sel) => l.map(([k, t]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
    return `<p class="nota" style="margin-top:0">Tope de lidocaína y bupivacaína por peso y suma de fracciones cuando se mezclan (la toxicidad es aditiva: la suma debe quedar ≤ 100 %).</p>
      <div class="rejilla"><label class="campo"><span>Peso</span><div class="con-unidad"><input id="bqPeso" inputmode="decimal" value="${esc(bqC.peso)}" placeholder="70"><em>kg</em></div></label>
      <label class="campo"><span>Paciente</span><select id="bqGrupo">${opt(BQ_GRUPOS, bqC.grupo)}</select></label></div>
      <div class="opciones" style="margin:10px 0">${BQ_FACT.map(([k, t]) => `<button type="button" class="opcion${bqC.fact[k] ? ' sel' : ''}" data-bqfact="${k}">${esc(t)}</button>`).join('')}</div>
      <label class="campo" style="max-width:240px"><span>Reducción a mano (opcional)</span><select id="bqManual"><option value="">Automática</option>${[0, 10, 15, 20, 25, 30, 40, 50].map((x) => `<option value="${x}"${String(x) === String(bqC.manual) ? ' selected' : ''}>−${x} %</option>`).join('')}</select></label>
      <h3>Lo que vas a inyectar</h3>
      ${bqC.filas.map((r, i) => `<div class="med"><div class="rejilla"><label class="campo"><span>Solución ${i + 1}</span><select data-bqf="${i}" data-c="p">${opt(BQ_PRES, r.p)}</select></label>
        <label class="campo"><span>Volumen</span><div class="con-unidad"><input data-bqf="${i}" data-c="ml" inputmode="decimal" value="${esc(r.ml)}" placeholder="0"><em>mL</em></div></label></div>
        <div class="fila-btn" style="justify-content:space-between;margin-top:6px"><div class="check" style="margin:0"><input type="checkbox" id="bqEpi${i}" data-bqf="${i}" data-c="epi"${r.epi ? ' checked' : ''}><label for="bqEpi${i}">Con epinefrina 1:200 000</label></div>
        ${bqC.filas.length > 1 ? `<button class="peligro chico" data-acc="bqQuitar" data-i="${i}">Quitar</button>` : ''}</div></div>`).join('')}
      ${bqC.filas.length < 4 ? '<div class="fila-btn"><button class="secundario chico" data-acc="bqMas">+ Otra solución</button></div>' : ''}
      <div id="bqRes" class="bq-res"></div>`;
  }
  function bqCalcPintar() {
    const e = $('#bqRes'); if (!e) return; const T = bqTopes();
    if (!T) { e.innerHTML = '<p class="nota">Escribe el peso para ver los topes.</p>'; return; }
    const { t } = T, f1 = (x) => (Math.round(x * 10) / 10).toLocaleString('es-VE');
    let frac = 0; const det = [];
    bqC.filas.forEach((r) => {
      const pr = BQ_PRES.find((x) => x[0] === r.p), ml = num(r.ml); if (!(ml > 0)) return;
      const epi = r.epi && r.p !== 'mezcla', c = pr[2], mgB = (c.b || 0) * ml, mgL = (c.l || 0) * ml;
      const fr = mgB / (epi ? t.b1 : t.b0) + mgL / (epi ? t.l1 : t.l0); frac += fr;
      det.push(`${f1(ml)} mL ${pr[1]}${r.epi ? ' con epi' : ''}: ${[mgB && f1(mgB) + ' mg bupi', mgL && f1(mgL) + ' mg lido'].filter(Boolean).join(' + ')} = ${Math.round(fr * 100)} % del tope`);
    });
    const pct = Math.round(frac * 100), cls = frac > 1 ? 'mal' : frac > 0.8 ? 'ojo' : 'bien', resto = Math.max(0, 1 - frac);
    const queda = BQ_PRES.map(([, n, c]) => [n, c]).flatMap(([n, c]) => (c.b && c.l ? [[n, resto / (c.b / t.b0 + c.l / t.l0)]] : c.b ? [[n, resto * t.b0 / c.b], [n + ' con epi', resto * t.b1 / c.b]] : [[n, resto * t.l0 / c.l], [n + ' con epi', resto * t.l1 / c.l]]));
    e.innerHTML = `<div class="desplaza"><table class="tabla guia-tabla"><tr><th>Tope para este paciente</th><th>Sin epinefrina</th><th>Con epinefrina</th></tr>
        <tr><td>Lidocaína</td><td>${f1(t.l0)} mg</td><td>${f1(t.l1)} mg</td></tr><tr><td>Bupivacaína</td><td>${f1(t.b0)} mg</td><td>${f1(t.b1)} mg</td></tr></table></div>` +
      (det.length ? `<div class="bq-barra ${cls}"><div style="width:${Math.min(pct, 100)}%"></div></div><p class="bq-total ${cls}">Usado: <b>${pct} %</b> del tope${frac > 1 ? ' · SE PASA DEL TOPE: reduce volumen o concentración' : frac > 0.8 ? ' · cerca del tope' : ''}</p><ul class="guia-items">${det.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
      (resto > 0 ? `<h3>${det.length ? 'Todavía puedes agregar (una sola de estas)' : 'Volumen máximo de cada solución (usada sola)'}</h3><div class="desplaza"><table class="tabla guia-tabla">${queda.map(([n, ml]) => `<tr><td style="text-align:left">${esc(n)}</td><td><b>${f1(Math.floor(ml * 10) / 10)} mL</b></td></tr>`).join('')}</table></div>` : '') +
      `<ul class="guia-items bq-avisos">${T.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}
        <li>La mezcla 1:1 con epinefrina se calcula con los topes sin epinefrina (por prudencia, ficha Dosis máximas).</li>
        <li>El tope no protege de una inyección intravascular: aspirar, fraccionar e inyectar despacio. Absorción alta en intercostal, paravertebral, caudal y planos fasciales bilaterales.</li>
        <li>En obesos considera el peso magro (calculadora TIVA). Sin Intralipid en el HCUAMP: repasa Crisis › LAST.</li></ul>`;
  }
  function bqCalcEnlazar() {
    const p = $('#bqPeso'); if (!p) return;
    p.oninput = () => { bqC.peso = p.value; bqCalcPintar(); };
    $('#bqGrupo').onchange = (ev) => { bqC.grupo = ev.target.value; bqCalcPintar(); };
    $('#bqManual').onchange = (ev) => { bqC.manual = ev.target.value; bqCalcPintar(); };
    $$('#vista [data-bqfact]').forEach((b) => (b.onclick = () => { const k = b.dataset.bqfact; bqC.fact[k] = !bqC.fact[k]; b.classList.toggle('sel', bqC.fact[k]); bqCalcPintar(); }));
    $$('#vista [data-bqf]').forEach((el) => { const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'onchange' : 'oninput';
      el[ev] = () => { const r = bqC.filas[+el.dataset.bqf]; r[el.dataset.c] = el.type === 'checkbox' ? el.checked : el.value; bqCalcPintar(); }; });
    bqCalcPintar();
  }

  /* ---- Valoración preanestésica ---- */
  function chipsDoc(pref, lista) {
    return `<div class="opciones">${lista.map(([k, tx]) => `<button type="button" class="opcion${getP(D, pref + k) ? ' sel' : ''}" data-acc="dTog" data-k="${pref}${k}">${esc(tx)}</button>`).join('')}</div>`;
  }
  function chkAuto(k, etq, auto) { // casilla que se marca sola con los datos del paciente, pero se puede cambiar
    const v = getP(D, k); const on = v !== undefined && v !== '' ? !!v : !!auto;
    return `<div class="check"><input type="checkbox" id="c_${k}" data-k="${k}"${on ? ' checked' : ''}><label for="c_${k}" style="flex:1">${etq}${v === undefined && auto !== undefined ? ' <small style="color:var(--suave)">(automático)</small>' : ''}</label></div>`;
  }
  function medsUI() {
    const X = Extras, grupos = [...new Set(X.MEDS.map((m) => m.g))];
    const opts = (sel) => '<option value="">— Tipo de fármaco (regla de la guía) —</option>' + grupos.map((g) => `<optgroup label="${g}">${X.MEDS.filter((m) => m.g === g).map((m) => `<option${m.n === sel ? ' selected' : ''}>${esc(m.n)}</option>`).join('')}</optgroup>`).join('') + `<option value="__otro"${sel === '__otro' ? ' selected' : ''}>Otro / sin regla</option>`;
    const filas = (D.meds || []).map((m, i) => `<div class="med"><div class="rejilla ancha">
      <label class="campo completo"><span>Tipo de fármaco</span><select data-k="meds.${i}.ref">${opts(m.ref)}</select></label>
      <label class="campo"><span>Fármaco</span><input data-k="meds.${i}.n" value="${esc(m.n || '')}" placeholder="Ej. Losartán"></label>
      <label class="campo"><span>Dosis</span><input data-k="meds.${i}.dosis" value="${esc(m.dosis || '')}" placeholder="50 mg c/12 h"></label>
      <label class="campo"><span>Conducta</span><select data-k="meds.${i}.acc"><option value="">Según la guía</option>${Object.entries(X.ACC).map(([k, tx]) => `<option value="${k}"${m.acc === k ? ' selected' : ''}>${tx}</option>`).join('')}</select></label>
      <label class="campo"><span>Días antes (si se suspende)</span><input data-k="meds.${i}.dias" inputmode="decimal" value="${esc(m.dias || '')}" placeholder="automático"></label>
      <label class="campo completo"><span>Nota (opcional)</span><input data-k="meds.${i}.nota" value="${esc(m.nota || '')}" placeholder="Reemplaza la nota de la guía"></label></div>
      <div class="formula" id="ind_${i}" style="font-family:inherit;margin:8px 0 0"></div>
      <div class="fila-btn" style="justify-content:flex-end;margin-top:6px"><button class="peligro chico" data-acc="medQuitar" data-i="${i}">Quitar</button></div></div>`).join('');
    return '<p class="nota" style="margin-top:0">Anota cada fármaco y elige su tipo. La app propone la conducta y la fecha de la última dosis según la Guía de Medicación Preoperatoria 2026 (cirugía sin neuroeje); puedes cambiarla.</p>' +
      filas + '<div class="fila-btn"><button class="secundario" data-acc="medMas">+ Agregar fármaco</button></div>' +
      ((D.meds || []).length ? '' : rej(TA('trat', 'O escribe el tratamiento como texto', { alto: 56 }), true));
  }
  const LABS = [['fecha', 'Fecha'], ['hgb', 'HGB'], ['hct', 'HCT'], ['pla', 'PLA'], ['gb', 'GB'], ['neu', 'NEU'], ['glic', 'GLIC'], ['urea', 'UREA'], ['crea', 'CREA'], ['tp', 'TP'], ['tpt', 'TPT'], ['inr', 'INR'], ['hiv', 'HIV'], ['vdrl', 'VDRL'], ['otros', 'Otros']];
  function labsUI() {
    if (!D.lab || !D.lab.length) D.lab = [{}];
    return D.lab.map((l, i) => `${D.lab.length > 1 ? `<h3>Fecha ${i + 1}</h3>` : ''}<div class="rejilla labs">${LABS.map(([k, tx]) => `<label class="campo${k === 'fecha' ? ' doble' : ''}"><span>${tx}</span><input data-k="lab.${i}.${k}"${k === 'fecha' ? ' type="date"' : ['otros', 'hiv', 'vdrl'].includes(k) ? '' : ' inputmode="decimal"'} value="${esc(l[k] || '')}"></label>`).join('')}</div>`).join('') +
      (D.lab.length < 3 ? '<div class="fila-btn"><button class="secundario chico" data-acc="labMas">+ Otra fecha</button></div>' : '');
  }
  function renderVal(v) {
    const X = Extras; X.calcular(D); const p = D.p, au = D._sbAuto || {};
    $('#titulo').textContent = p.nombre || 'Valoración preanestésica';
    v.innerHTML =
      card('Paciente', rej(T('fecha', 'Fecha de la valoración', { tipo: 'date' }) + T('p.nombre', 'Nombre y apellido', { full: true }) + T('p.ci', 'CI') +
        SEL('p.sexo', 'Sexo', [['', '—'], ['M', 'Masculino'], ['F', 'Femenino']]) + Nm('p.edad', 'Edad', 'años') + Nm('p.peso', 'Peso', 'kg') + Nm('p.talla', 'Talla', 'm', { ph: '1.65' }) +
        '<label class="campo calc"><span>IMC</span><div class="con-unidad"><input id="vIMC" readonly><em>kg/m²</em></div></label>' + T('p.ocup', 'Ocupación')) +
        rej(T('p.dx', 'Diagnóstico', { full: true }) + T('p.proc', 'Procedimiento a realizar', { full: true }) + T('p.tratante', 'Médico tratante') + T('p.fechaCx', 'Fecha de la cirugía', { tipo: 'date' }), true) +
        R('p.urg', 'Cirugía', [['no', 'Electiva'], ['si', 'Urgencia']]) + R('p.riesgoHem', 'Riesgo hemorrágico de la cirugía', [['minimo', 'Mínimo'], ['bajo', 'Bajo-moderado'], ['alto', 'Alto']]) +
        '<p class="nota">La fecha de la cirugía y el riesgo hemorrágico se usan para calcular la última dosis de cada fármaco.</p><div class="fila-btn"><button class="secundario chico" data-acc="docDeHistoria">Tomar datos de una historia</button></div>') +
      card('Antecedentes personales', chipsDoc('ant.', X.ANT.concat(X.ANT_EXTRA)) +
        rej(TA('antOtros', 'Otros (uno por línea)', { alto: 54 }) + TA('quir', 'Quirúrgicos', { alto: 48 }) + TA('anest', 'Anestésicos', { alto: 48 }), true) +
        R('compl', 'Complicaciones anestésicas', [['si', 'Sí'], ['no', 'No']]) + (D.compl === 'si' ? rej(T('complCual', '¿Cuál?', { full: true }), true) : '') +
        rej(T('alergias', 'Alergias', { full: true, ph: 'Niega / …' }), true) +
        '<h3>Hábitos (HPB)</h3>' + C('hpb.tab', 'Tabáquico', { k: 'hpb.ipa', ph: 'IPA', num: true }) + C('hpb.etil', 'Etílico', { k: 'hpb.etilTxt' }) + C('hpb.chim', 'Chimóico', { k: 'hpb.chimTxt' }) + C('hpb.caf', 'Caféico', { k: 'hpb.cafTxt' }) + C('hpb.otro', 'Otro', { k: 'hpb.otroTxt' })) +
      card('Tratamiento actual y conducta preoperatoria', medsUI()) +
      card('Riesgo', R('mets', 'Capacidad funcional', [['mas', '≥ 4 METs (sube 2 pisos)'], ['menos', '< 4 METs']]) +
        '<h3>STOP-BANG (apnea del sueño)</h3>' + X.SB.map(([k, tx]) => (['b', 'a', 'n', 'g'].includes(k) ? chkAuto('sb.' + k, tx, au[k]) : C('sb.' + k, tx))).join('') + '<p class="nota" id="vSB"></p>' +
        '<h3>Índice de riesgo cardíaco revisado (Lee)</h3>' + X.RCRI.map(([k, tx]) => C('rcri.' + k, tx)).join('') + '<p class="nota" id="vRCRI"></p><p class="nota" id="vClcr"></p>' +
        (p.sexo === 'F' ? rej(T('fum', 'Fecha de última menstruación (FUM)', { tipo: 'date' })) : '')) +
      card('Examen físico', R('ef.mallampati', 'Mallampati', ['I', 'II', 'III', 'IV'], [IMGS.mall1, IMGS.mall2, IMGS.mall3, IMGS.mall4]) +
        rej(Nm('ef.dii', 'DII (interincisivos)', 'cm') + Nm('ef.dtm', 'DTM (tiromentoniana)', 'cm') + Nm('ef.dem', 'DEM (esternomentoniana)', 'cm') + T('ef.pm', 'PM (protrusión mandibular)', { ph: 'A / B / C' }) + T('ef.bhd', 'BHD (Bellhouse-Doré)', { ph: 'I – IV' }) + Nm('ef.cc', 'CC (circunferencia cervical)', 'cm')) +
        '<h3>OBESE · Langeron (ventilación con mascarilla)</h3>' + chkAuto('ef.obese.o', 'O · Obesidad (IMC > 26)', D._imc > 26) + C('ef.obese.b', 'B · Barba') + C('ef.obese.e', 'E · Edéntulo') + chkAuto('ef.obese.s', 'S · Ronquido (SAOS)', !!(D.sb || {}).s) + chkAuto('ef.obese.e2', 'E · Edad > 55', num(p.edad) > 55) +
        '<p class="nota" id="vLang"></p>' + R('ef.vad', 'Probable VAD', [['si', 'Sí'], ['no', 'No']]) +
        '<h3>Signos vitales</h3>' + rej(T('ef.ta', 'TA', { ph: '120/80', u: 'mmHg' }) + Nm('ef.fc', 'FC', 'lpm') + Nm('ef.fr', 'FR', 'rpm') + Nm('ef.spo2', 'SpO2', '%')) +
        rej(T('ef.cond', 'Condiciones', { full: true }) + T('ef.cabeza', 'Cabeza y cuello', { full: true }) + T('ef.orl', 'ORL', { full: true }), true) +
        R('ef.dientes', 'Piezas dentarias', [['normal', 'Normal'], ['parcial', 'Ausencia parcial'], ['total', 'Ausencia total']]) + C('ef.protesis', 'Prótesis dental') +
        rej(T('ef.torax', 'Tórax', { full: true }) + T('ef.abd', 'Abdomen', { full: true }), true) + R('ef.espalda', 'Columna: tipo de espalda', ['1', '2', '3']) +
        rej(T('ef.columna', 'Columna (detalle)', { full: true }) + T('ef.ext', 'Extremidades', { full: true }) + T('ef.neuro', 'Neurológico', { full: true }), true)) +
      card('Laboratorios', labsUI()) +
      card('Valoraciones y estudios', rej(T('cv.fecha', 'Valoración CV (fecha)', { tipo: 'date' }) + T('cv.asa', 'ASA (CV)') + T('cv.goldman', 'Goldman') + T('cv.tep', 'Riesgo TEP') +
        T('cv.ekg', 'EKG', { full: true }) + T('rx', 'Rx de tórax', { full: true }) + T('sug', 'Sugerencias', { full: true }) + T('eco', 'EcoTT', { full: true }) + T('neumo', 'Val. Neumo/Endocrino', { full: true }) + T('otros', 'Otros', { full: true }), true)) +
      card('Plan', '<h3>Sugerencias / indicaciones</h3>' + `<div class="opciones">${X.SUGERENCIAS.map((s, i) => `<button type="button" class="opcion${(D.indicSel || []).includes(i) ? ' sel' : ''}" data-acc="dSug" data-i="${i}" style="text-align:left">${esc(s)}</button>`).join('')}</div>` +
        rej(TA('indic', 'Otras indicaciones', { alto: 64 }), true) + R('asa', 'ASA', ['I', 'II', 'III', 'IV', 'V', 'I E', 'II E', 'III E', 'IV E', 'V E']) + rej(T('plan', 'Plan anestésico', { full: true }), true) +
        `<div class="opciones">${['Anestesia general balanceada', 'TIVA', 'Anestesia raquídea', 'Anestesia epidural', 'Combinada raquídea-epidural', 'Bloqueo de nervio periférico', 'Sedación'].map((s) => `<button type="button" class="opcion" data-acc="dPlan" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` +
        '<h3>Plan analgésico</h3>' + C('analg.ev', 'EV') + C('analg.peri', 'Peridural') + C('analg.reg', 'Regional')) +
      '<p class="nota" style="margin:0 4px 12px">La firma y el sello salen de "Mi perfil". Las conductas de medicación son una referencia (Guía de Manejo de Medicación Preoperatoria 2026) y no sustituyen el juicio clínico.</p>';
    pintarCalcVal();
  }
  function pintarCalcVal() {
    if (!D || D.tipo !== 'val') return; const X = Extras; X.calcular(D);
    const set = (id, h) => { const e = $('#' + id); if (e) { if (e.tagName === 'INPUT') e.value = h; else e.innerHTML = h; } };
    set('vIMC', isFinite(D._imc) ? D._imc.toFixed(1) : '');
    set('vSB', `Puntaje: <b>${D._sb}/8</b> · ${D._sb >= 5 ? 'riesgo alto de SAOS' : D._sb >= 3 ? 'riesgo intermedio' : 'riesgo bajo'}`);
    set('vRCRI', `RCRI: <b>${D._rcri}</b> · riesgo de evento cardíaco mayor a 30 días ≈ ${X.RCRI_RIESGO[Math.min(D._rcri, 3)]}`);
    set('vClcr', isFinite(D._clcr) ? `Aclaramiento de creatinina (Cockcroft-Gault): <b>${Math.round(D._clcr)} mL/min</b>` : 'ClCr: anota edad, peso, sexo y creatinina.');
    const ef = D.ef || {}; const vad = D._langeron >= 2 || ['III', 'IV'].includes(ef.mallampati) || num(ef.dtm) < 6.5 || num(ef.dii) < 3;
    set('vLang', `Langeron: <b>${D._langeron}/5</b>${D._langeron >= 2 ? ' · sugiere ventilación con mascarilla difícil' : ''}${vad ? ' · <b>considera VAD probable</b>' : ''}`);
    (D.meds || []).forEach((m, i) => set('ind_' + i, esc(X.indicacion(m, D)) || '<span style="color:var(--suave)">Elige el tipo de fármaco o la conducta.</span>'));
  }

  /* ---- Récipe ---- */
  const RX_RAPIDOS = [
    ['Ketoprofeno 100 mg tabletas', '#10 (diez)', 'Tomar 1 tableta VO cada 12 h por 5 días, después de comer.'],
    ['Paracetamol 500 mg tabletas', '#20 (veinte)', 'Tomar 2 tabletas (1 g) VO cada 8 h por 5 días. No exceder 4 g al día.'],
    ['Diclofenac potásico 50 mg tabletas', '#10 (diez)', 'Tomar 1 tableta VO cada 8 h por 3 días, después de comer.'],
    ['Ibuprofeno 400 mg tabletas', '#15 (quince)', 'Tomar 1 tableta VO cada 8 h por 5 días, después de comer.'],
    ['Tramadol 50 mg cápsulas', '#10 (diez)', 'Tomar 1 cápsula VO cada 8 h si el dolor es intenso. Puede causar náuseas o somnolencia.'],
    ['Omeprazol 20 mg cápsulas', '#10 (diez)', 'Tomar 1 cápsula VO en ayunas, 30 min antes del desayuno, por 10 días.'],
    ['Ondansetrón 8 mg tabletas', '#6 (seis)', 'Tomar 1 tableta VO o sublingual cada 8 h si presenta náuseas o vómitos.'],
    ['Metoclopramida 10 mg tabletas', '#9 (nueve)', 'Tomar 1 tableta VO cada 8 h, antes de las comidas, si presenta náuseas.'],
  ];
  function renderRx(v) {
    $('#titulo').textContent = D.p.nombre || 'Récipe';
    const pl = cfg.rxPlantillas || [];
    if (!D.items || !D.items.length) D.items = [{}];
    v.innerHTML = card('Paciente', rej(T('fecha', 'Fecha', { tipo: 'date' }) + T('p.nombre', 'Nombre y apellido', { full: true }) + T('p.ci', 'CI') + Nm('p.edad', 'Edad', 'años') + Nm('p.peso', 'Peso', 'kg')) +
        '<div class="fila-btn"><button class="secundario chico" data-acc="docDeHistoria">Tomar datos de una historia</button></div>') +
      card('Rp / medicamentos', D.items.map((it, i) => `<div class="med"><div class="rejilla ancha"><label class="campo completo"><span>Medicamento y presentación</span><input data-k="items.${i}.med" value="${esc(it.med || '')}" placeholder="Ej. Ketoprofeno 100 mg tabletas"></label>
          <label class="campo"><span>Cantidad</span><input data-k="items.${i}.cant" value="${esc(it.cant || '')}" placeholder="#10 (diez)"></label></div>
          ${rej(TA(`items.${i}.ind`, 'Indicación (sale en la mitad derecha)', { alto: 52 }), true)}
          <div class="fila-btn" style="justify-content:flex-end;margin-top:4px"><button class="peligro chico" data-acc="rxQuitar" data-i="${i}">Quitar</button></div></div>`).join('') +
        `<div class="fila-btn"><button class="secundario" data-acc="rxMas">+ Agregar medicamento</button></div><h3>Agregar rápido</h3><div class="opciones">${RX_RAPIDOS.map((r, i) => `<button type="button" class="opcion" data-acc="rxRapido" data-i="${i}">+ ${esc(r[0])}</button>`).join('')}</div>`) +
      card('Indicaciones generales', rej(TA('gen', 'Indicaciones generales', { alto: 80, ph: 'Dieta, reposo, signos de alarma…' }) + T('control', 'Próximo control', { full: true, ph: 'Ej. 7 días con su cirujano' }) +
        SEL('valido', 'Validez del récipe', [['', '— No indicar —'], ['30 días', '30 días (medicamentos comunes)'], ['10 días', '10 días (antibióticos)'], ['7 días', '7 días']]), true)) +
      card('Mis plantillas', (pl.length ? `<div class="opciones">${pl.map((x, i) => `<button type="button" class="opcion" data-acc="rxPlant" data-i="${i}">${esc(x.nombre)}</button>`).join('')}</div>` : '<p class="nota" style="margin-top:0">Guarda un récipe que uses a menudo y aplícalo con un toque.</p>') +
        `<div class="fila-btn"><button class="secundario chico" data-acc="rxGuardarPl">Guardar este récipe como plantilla</button>${pl.length ? '<button class="peligro chico" data-acc="rxBorrarPl">Borrar una plantilla</button>' : ''}</div>`);
  }
  function docDeHistoria() {
    const idx = Store.indice().sort((a, b) => b.modificado - a.modificado).slice(0, 25);
    if (!idx.length) { aviso('No hay historias guardadas'); return; }
    menu(idx.map((x) => ({ t: esc(x.nombre || 'Sin nombre') + (x.ci ? ' · CI ' + esc(x.ci) : ''), f: () => {
      const h = Store.cargar(x.id); if (!h) return; const hp = h.p || {};
      ['nombre', 'ci', 'edad', 'peso'].forEach((k) => { if (hp[k]) D.p[k] = hp[k]; });
      if (D.tipo === 'val') { ['sexo', 'talla'].forEach((k) => { if (hp[k]) D.p[k] = hp[k]; }); if (h.dx) D.p.dx = h.dx; if (h.intervencion) D.p.proc = h.intervencion; if (h.alergias) D.alergias = h.alergias; }
      guardarDocYa(); render(); aviso('Datos copiados');
    } })));
  }
  function historiaDeValoracion() {
    guardarDocYa(); const x = D; H = nuevaHistoria();
    Object.assign(H.p, { nombre: x.p.nombre || '', ci: x.p.ci || '', sexo: x.p.sexo || '', edad: x.p.edad || '', peso: x.p.peso || '', talla: x.p.talla || '' });
    H.dx = x.p.dx || ''; H.intervencion = x.p.proc || ''; H.alergias = x.alergias || '';
    const asa = String(x.asa || '').split(' '); if (asa[0]) H.asa = asa[0]; if (asa[1] === 'E') H.asaE = true;
    if (x.ef && x.ef.mallampati) H.mallampati = x.ef.mallampati;
    Store.guardar(H); D = null; pantalla = 'editor'; seccion = 0; render(); window.scrollTo(0, 0); aviso('Historia creada con los datos de la valoración');
  }
  function pdfDoc() {
    guardarDocYa(); aviso('Preparando vista previa…', 1200);
    setTimeout(() => {
      try {
        const pf = cfg.perfil || {}; const copia = JSON.parse(JSON.stringify(D));
        const doc = D.tipo === 'val' ? Extras.pdfValoracion(copia, pf) : Extras.pdfRecipe(copia, pf);
        const n = (D.p.nombre || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const nombre = (D.tipo === 'val' ? 'Valoracion_' : 'Recipe_') + n + '_' + (D.fecha || hoyISO()) + '.pdf';
        const b64 = doc.output('datauristring').split(',')[1], blob = doc.output('blob');
        Visor.abrir({ bytes: b64aBytes(b64), titulo: (D.p.nombre || (D.tipo === 'val' ? 'Valoración' : 'Récipe')) + ' — vista previa', acciones: botonesPdf(b64, blob, nombre) });
      } catch (e) { console.error(e); alert('Error al generar el PDF: ' + e.message); }
    }, 30);
  }

  /* ---------- Eventos ---------- */
  const vista = $('#vista');
  function alCambiar(e) {
    const el = e.target; const k = el.dataset && el.dataset.k; const o = obj(); if (!k || !o) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    setP(o, k, v);
    // Marcar la casilla al escribir su detalle
    const chk = el.closest('.check') && el.closest('.check').querySelector('input[type=checkbox]');
    if (chk && el.type !== 'checkbox' && v && !chk.checked) { chk.checked = true; setP(o, chk.dataset.k, true); }
    if (o === D) { docCambio(k, el); return; }
    if (k === 'p.nombre') $('#titulo').textContent = v || 'Historia nueva';
    if (el.dataset.indmed != null) { const i = +el.dataset.indmed, m = indLista()[i]; indSincronizar(); const g = $('#indG' + i); if (g && m) g.innerHTML = guiaDosis(IND_FARM, m.n, m.d, m.u); }
    if (el.dataset.revmed) { const rk = el.dataset.revmed, rv = H.rev; if (v && !rv[rk]) { rv[rk] = true; const cb = $(`[data-k="rev.${rk}"]`); if (cb) cb.checked = true; }
      const g = $('#revG_' + rk); if (g) g.innerHTML = guiaDosis(REV_FARM, revNombre(rk), rv[rk + 'D'], rv[rk + 'U'] || REV_FARM[revNombre(rk)].u); }
    refrescarCalculos(); guardarPronto();
    if ((k === 'obs' || k.startsWith('obsOpc') || k.startsWith('p.sexo')) && $('#obsPrev')) $('#obsPrev').innerHTML = obsPrevia();
  }
  vista.addEventListener('change', (e) => {
    const s = e.target.closest && e.target.closest('[data-pagsel]'); if (!s || !H) return;
    const p = H.to.pistas[s.dataset.pagsel];
    if (s.value === '__otro') { p._otro = true; if (Pistas.LISTAS[Pistas.info(s.dataset.pagsel).lista].includes(p.agente)) p.agente = ''; }
    else { p._otro = false; p.agente = s.value; }
    guardarPronto(); render();
  });
  vista.addEventListener('input', alCambiar);
  vista.addEventListener('change', alCambiar);
  vista.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.k; if (H && pantalla === 'editor' && ['anest', 'asist', 'ciruj', 'instr'].includes(k)) { recordarNombres(k); refrescarNombres(k); } });
  vista.addEventListener('change', (e) => { if (H && e.target.dataset && e.target.dataset.indmed != null) recordarInd(); });
  vista.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.coadmed; if (k && H) { if (!H.coad[k].on) { H.coad[k].on = true; const cb = $('#c_coad_' + k); if (cb) cb.checked = true; } recordarCoad(k); } });
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-r]');
    if (r && obj()) {
      const o = obj(), k = r.dataset.r; const nuevo = getP(o, k) === r.dataset.v && k !== 'p.formPmp' && k !== 'to.cierre' ? '' : r.dataset.v; setP(o, k, nuevo);
      if (k === 'to.cierre') { cfg.cierre = nuevo; Store.guardarConfig(cfg); }
      $$(`[data-r="${k}"]`).forEach((b) => b.classList.toggle('sel', b.dataset.v === nuevo));
      if (o === D) docCambio(k); else { refrescarCalculos(); guardarPronto(); } return;
    }
    const s = e.target.closest('[data-s]');
    if (s) { guardarYa(); seccion = +s.dataset.s; render(); window.scrollTo(0, 0); return; }
    const ab = e.target.closest('[data-abrir]');
    const mas = e.target.closest('[data-mas]');
    if (mas) { opcionesHistoria(mas.dataset.mas); return; }
    if (ab) { abrir(ab.dataset.abrir); return; }
    const a = e.target.closest('[data-acc]'); if (!a) return;
    const acc = a.dataset.acc;
    if (acc === 'ahora') { setP(H, a.dataset.p, ahoraHM(+a.dataset.red || 0)); guardarPronto(); render(); }
    else if (acc === 'via') { const f = +a.dataset.f, v = viaDe(f), c = a.dataset.c;
      if (c === 't') { if (v.t !== a.dataset.v) { H.to.vias[f] = a.dataset.v === 'VC' ? { t: 'VC' } : { t: 'VP', n: f === 9 ? '2' : '1' }; } }
      else v[c] = v[c] === a.dataset.v && c !== 'n' ? '' : a.dataset.v;
      H.to.filas = H.to.filas || []; H.to.filas[f] = viaTexto(H.to.vias[f]); guardarPronto(); render(); }
    else if (acc === 'solFin') { const e = H.to.pistas[a.dataset.p].ev[+a.dataset.i]; e.fin = ahoraHM(); guardarPronto(); render(); aviso('Fin marcado ' + e.fin); }
    else if (acc === 'nomTog') { const rol = a.dataset.rol, n = a.dataset.n, l = partirNombres(H[rol]); const j = l.findIndex((x) => x.toLowerCase() === n.toLowerCase());
      if (j >= 0) l.splice(j, 1); else l.push(n); H[rol] = l.join(', '); const inp = $(`[data-k="${rol}"]`); if (inp) inp.value = H[rol]; guardarPronto(); refrescarNombres(rol); }
    else if (acc === 'nomEditar') { const r0 = editRol; editRol = editRol === a.dataset.rol ? '' : a.dataset.rol; if (r0 && r0 !== editRol) refrescarNombres(r0); refrescarNombres(a.dataset.rol); }
    else if (acc === 'nomBorrar') { const l = cfg.equipo[a.dataset.rol]; const j = l.indexOf(a.dataset.n); if (j >= 0) l.splice(j, 1); if (!l.length) editRol = ''; Store.guardarConfig(cfg); refrescarNombres(a.dataset.rol); }
    else if (acc === 'coadAgregar') { const c = (H.coad[a.dataset.c] = H.coad[a.dataset.c] || {}); c.meds = c.meds || []; c.meds.push({ n: a.dataset.n, d: a.dataset.d, u: a.dataset.u }); c.on = true; guardarPronto(); render(); if (!a.dataset.n) { const ins = $$(`[data-coadmed="${a.dataset.c}"]`); const f = ins[ins.length - 3]; if (f) f.focus(); } }
    else if (acc === 'coadQuitar') { const c = H.coad[a.dataset.c]; c.meds.splice(+a.dataset.i, 1); if (!c.meds.length && !c.det) c.on = false; guardarPronto(); render(); }
    else if (acc === 'indAgregar') { const l = indLista(); if (l.length >= 6) return; l.push({ n: a.dataset.n, d: a.dataset.d, u: a.dataset.u }); indSincronizar(); guardarPronto(); render();
      const ins = $$('[data-indmed]'); const f = !a.dataset.n ? ins[ins.length - 3] : !a.dataset.d ? ins[ins.length - 2] : null; if (f) f.focus(); }
    else if (acc === 'indQuitar') { indLista().splice(+a.dataset.i, 1); indSincronizar(); guardarPronto(); render(); }
    else if (acc === 'revDosis') { const rv = (H.rev = H.rev || {}), k = a.dataset.c; rv[k] = true; rv[k + 'D'] = a.dataset.d; rv[k + 'U'] = a.dataset.u; guardarPronto(); render(); }
    else if (acc === 'coadNota') { const c = (H.coad[a.dataset.c] = H.coad[a.dataset.c] || {}); c._nota = true; render(); }
    else if (acc === 'marcarTodo') { CHECKLIST.forEach(([k]) => (H.chk[k] = true)); guardarPronto(); render(); }
    else if (acc === 'nuevoReg') abrirRegistro(null);
    else if (acc === 'agregarInf') { H.inf = H.inf || []; H.inf.push({ farm: a.dataset.farm === 'Otra' ? '' : a.dataset.farm }); guardarPronto(); render(); abrirCalculadora(H.inf.length - 1); }
    else if (acc === 'calcInf') abrirCalculadora(+a.dataset.i);
    else if (acc === 'pAg') { const p = H.to.pistas[a.dataset.p]; p.agente = p.agente === a.dataset.v && a.dataset.p === 'inh' ? '' : a.dataset.v; guardarPronto(); render(); }
    else if (acc === 'irExtras') { pantalla = 'extras'; render(); window.scrollTo(0, 0); }
    else if (acc === 'crisisAbrir') crisisAbrir(a.dataset.id);
    else if (acc === 'crisisSeguir') { crisisMenu = false; render(); window.scrollTo(0, 0); }
    else if (acc === 'irCalc') { calcDesde = pantalla; pantalla = 'calc'; render(); window.scrollTo(0, 0); }
    else if (acc === 'irGuias') { guiaDesde = pantalla; pantalla = 'guias'; render(); window.scrollTo(0, 0); }
    else if (acc === 'irBloqueos') irBloqueos(a.dataset.tab);
    else if (acc === 'bqAbrir') { bqId = a.dataset.id; pantalla = 'bloqueo'; render(); window.scrollTo(0, 0); }
    else if (acc === 'bqIrCalc') { bqTab = 'generales'; bqBusca = ''; pantalla = 'bloqueos'; render(); const c = $('#bqPeso'); if (c) { c.scrollIntoView({ block: 'center' }); if (!bqC.peso) c.focus(); } }
    else if (acc === 'bqZoom') bqZoom(a.dataset.src);
    else if (acc === 'bqMas') { bqC.filas.push({ p: 'lido2', epi: false, ml: '' }); render(); const r = $('#bqRes'); if (r) r.scrollIntoView({ block: 'end' }); }
    else if (acc === 'bqQuitar') { bqC.filas.splice(+a.dataset.i, 1); render(); }
    else if (acc === 'guiaAbrir') { guiaId = a.dataset.id; pantalla = 'guia'; render(); window.scrollTo(0, 0); }
    else if (acc === 'docNuevo') { const x = nuevoDoc(a.dataset.t); Store.guardarDoc(x); abrirDoc(x); }
    else if (acc === 'docAbrir') { const x = Store.cargarDoc(a.dataset.id); if (x) abrirDoc(migrarDoc(x)); else aviso('No se pudo abrir'); }
    else if (acc === 'docMas') { const id = a.dataset.id; menu([
        { t: 'Abrir', f: () => { const x = Store.cargarDoc(id); if (x) abrirDoc(migrarDoc(x)); } },
        { t: 'Duplicar', f: () => { const x = Store.cargarDoc(id); if (!x) return; x.id = uid(); x.creado = Date.now(); x.fecha = hoyISO(); Store.guardarDoc(x); render(); aviso('Copia creada'); } },
        { t: 'Eliminar', peligro: true, f: () => { if (confirm('¿Eliminar este documento?')) { Store.borrarDoc(id); render(); } } }]); }
    else if (acc === 'dTog') { const k = a.dataset.k; setP(D, k, !getP(D, k)); a.classList.toggle('sel', !!getP(D, k)); docCambio(k); }
    else if (acc === 'dSug') { const i = +a.dataset.i, l = D.indicSel = D.indicSel || []; const j = l.indexOf(i); if (j >= 0) l.splice(j, 1); else l.push(i); a.classList.toggle('sel', j < 0); guardarDocPronto(); }
    else if (acc === 'dPlan') { D.plan = D.plan && !D.plan.includes(a.dataset.v) ? D.plan + ' + ' + a.dataset.v : a.dataset.v; const e = $('[data-k="plan"]'); if (e) e.value = D.plan; guardarDocPronto(); }
    else if (acc === 'medMas') { D.meds = D.meds || []; D.meds.push({}); guardarDocPronto(); render(); }
    else if (acc === 'medQuitar') { D.meds.splice(+a.dataset.i, 1); guardarDocPronto(); render(); }
    else if (acc === 'labMas') { D.lab.push({}); guardarDocPronto(); render(); }
    else if (acc === 'docDeHistoria') docDeHistoria();
    else if (acc === 'rxMas') { D.items.push({}); guardarDocPronto(); render(); }
    else if (acc === 'rxQuitar') { D.items.splice(+a.dataset.i, 1); guardarDocPronto(); render(); }
    else if (acc === 'rxRapido') { const r = RX_RAPIDOS[+a.dataset.i], it = { med: r[0], cant: r[1], ind: r[2] }; const vacio = D.items.findIndex((x) => !t2(x.med) && !t2(x.ind)); if (vacio >= 0) D.items[vacio] = it; else D.items.push(it); guardarDocPronto(); render(); aviso('Agregado: ' + r[0]); }
    else if (acc === 'rxPlant') { const x = (cfg.rxPlantillas || [])[+a.dataset.i]; if (!x) return; D.items = JSON.parse(JSON.stringify(x.items)); D.gen = x.gen || ''; D.control = x.control || ''; guardarDocPronto(); render(); aviso('Plantilla aplicada'); }
    else if (acc === 'rxGuardarPl') { const nm = prompt('Nombre de la plantilla', D.items.map((i) => t2(i.med).split(' ')[0]).filter(Boolean).join(' + ') || 'Mi récipe'); if (!nm) return;
      cfg.rxPlantillas = (cfg.rxPlantillas || []).concat([{ nombre: nm, items: JSON.parse(JSON.stringify(D.items.filter((i) => t2(i.med)))), gen: D.gen || '', control: D.control || '' }]); Store.guardarConfig(cfg); render(); aviso('Plantilla guardada'); }
    else if (acc === 'rxBorrarPl') menu((cfg.rxPlantillas || []).map((x, i) => ({ t: '🗑 ' + esc(x.nombre), f: () => { cfg.rxPlantillas.splice(i, 1); Store.guardarConfig(cfg); render(); } })));
    else if (acc === 'obsTab') { obsTab = a.dataset.v; render(); }
    else if (acc === 'obsFr') {
      const o = Obs.opc(H), g = Obs.GRUPOS.find((x) => x.k === a.dataset.g), v = a.dataset.v;
      if (g.uno) o.fr[g.k] = o.fr[g.k] === v ? '' : v;
      else { const l = o.fr[g.k] = o.fr[g.k] || []; const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); }
      guardarPronto(); render();
    }
    else if (acc === 'pEv') { const p = H.to.pistas[a.dataset.p];
      const tp = Pistas.info(a.dataset.p).tipo;
      if (a.dataset.i == null && tp !== 'gas' && tp !== 'sol' && !p.agente && a.dataset.p !== 'aire') { aviso('Primero elige el ' + (a.dataset.p === 'inh' ? 'anestésico' : 'medicamento')); return; }
      abrirEvento(a.dataset.p, a.dataset.i == null ? null : +a.dataset.i, a.dataset.t); }
    else if (acc === 'quitarInf') { if (confirm('¿Quitar esta infusión?')) { H.inf.splice(+a.dataset.i, 1); guardarPronto(); render(); } }
    else if (acc === 'editarReg') abrirRegistro(+a.dataset.i);
    else if (acc === 'firmar') padFirma('Firma', (d) => { H.firma = d; guardarPronto(); render(); });
    else if (acc === 'firmaPerfil') { H.firma = cfg.perfil.firma; if (!H.sello) H.sello = cfg.perfil.sello; guardarPronto(); render(); }
    else if (acc === 'quitarFirma') { H.firma = ''; H.firmaSello = ''; guardarPronto(); render(); }
    else if (acc === 'usarEscaneo') { H.firmaSello = cfg.perfil.firmaSello; if (!H.sello) H.sello = cfg.perfil.sello || Cuenta.componerSello(cfg.perfil); guardarPronto(); render(); }
    else if (acc === 'pdf') accionesPdf();
  });
  $('#btnPdf').onclick = accionesPdf;
  $('#btnAtras').onclick = () => atras();
  $('#btnSOS').onclick = () => { if (pantalla === 'editor') guardarYa(); irCrisis(); };
  $('#btnMenu').onclick = () => {
    if (pantalla === 'doc') {
      menu([
        { t: 'Ver / PDF', f: pdfDoc },
        ...(D.tipo === 'val' ? [{ t: 'Crear historia de anestesia con estos datos', f: historiaDeValoracion }] : []),
        { t: 'Duplicar', f: () => { guardarDocYa(); const c = JSON.parse(JSON.stringify(D)); c.id = uid(); c.creado = Date.now(); c.fecha = hoyISO(); Store.guardarDoc(c); abrirDoc(c); aviso('Copia creada'); } },
        { t: 'Mi perfil y membrete', f: () => { guardarDocYa(); D = null; pantalla = 'perfil'; render(); } },
        { t: 'Eliminar', peligro: true, f: () => { if (confirm('¿Eliminar este documento?')) { Store.borrarDoc(D.id); D = null; pantalla = 'extras'; render(); } } },
      ]);
      return;
    }
    if (pantalla === 'editor') {
      menu([
        { t: 'Ver / PDF', f: accionesPdf },
        { t: '🆘 Crisis: algoritmos de emergencia', f: () => { guardarYa(); irCrisis(); } },
        { t: '🧮 Calculadora TIVA · TCI · BIC', f: () => { guardarYa(); CT = null; calcDesde = 'editor'; pantalla = 'calc'; render(); window.scrollTo(0, 0); } },
        { t: 'Nueva historia usando esta como plantilla', f: () => { guardarYa(); duplicar(H.id, false); } },
        { t: 'Mi perfil y firma', f: () => { guardarYa(); pantalla = 'perfil'; render(); } },
        { t: 'Lugares de trabajo', f: () => { guardarYa(); pantalla = 'sedes'; render(); } },
        { t: 'Eliminar esta historia', peligro: true, f: () => { if (confirm('¿Eliminar esta historia? No se puede deshacer.')) { Store.borrar(H.id); H = null; pantalla = 'inicio'; render(); } } },
      ]);
    } else {
      menu([
        { t: '✦ Extras: valoración y récipe', f: () => { pantalla = 'extras'; render(); } },
        { t: '🆘 Crisis: algoritmos de emergencia', f: irCrisis },
        { t: '🧮 Calculadora TIVA · TCI · BIC', f: () => { if (calcDesde === 'editor') CT = null; calcDesde = pantalla === 'calc' ? calcDesde : pantalla; pantalla = 'calc'; render(); window.scrollTo(0, 0); } },
        { t: '📖 Guías de consulta', f: () => { guiaDesde = pantalla; pantalla = 'guias'; render(); window.scrollTo(0, 0); } },
        { t: '💉 Bloqueos regionales', f: () => irBloqueos() },
        { t: '🏥 Lugares de trabajo', f: () => { pantalla = 'sedes'; render(); } },
        { t: '✍ Mi perfil y firma', f: () => { pantalla = 'perfil'; render(); } },
        { t: '🗂 Respaldo (exportar / importar)', f: respaldo },
        ...(cfg.cuenta ? [{ t: '🔒 Cerrar sesión', f: cerrarSesion }] : []),
        { t: 'ℹ Acerca de', f: () => { abrirHoja(`<h2>Morpheus MD</h2><p>Versión ${VERSION} · Registro anestésico digital</p><p class="nota">${window.Nativo ? 'Todo se guarda solo en este teléfono; la app no tiene acceso a Internet.' : 'Todo se guarda solo en este navegador, en este equipo; tus historias no se envían a ningún servidor.'} Usa “Respaldo” de vez en cuando para no perder tus historias si cambias o pierdes el teléfono.</p>
          <div class="fila-btn">${Object.entries(LEGAL.TEXTOS).map(([k, x]) => `<button class="secundario chico" data-legal="${k}">${x.t}</button>`).join('')}</div>
          <div class="acciones"><button class="primario" id="acCerrar">Cerrar</button></div>`);
          $('#acCerrar').onclick = cerrarHoja; $$('#capa [data-legal]').forEach((b) => (b.onclick = () => verLegal(b.dataset.legal))); } },
      ]);
    }
  };

  function atras() {
    if (window.Visor && Visor.abierto()) { Visor.cerrar(); return true; }
    if (!$('#capa').hidden) { cerrarHoja(); return true; }
    if (pantalla === 'editor') { guardarYa(); H = null; pantalla = 'inicio'; render(); return true; }
    if (pantalla === 'doc') { guardarDocYa(); D = null; pantalla = 'extras'; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'extras') { pantalla = 'inicio'; render(); return true; }
    if (pantalla === 'crisis') { if (crisisMenu && Crisis.activa()) { crisisMenu = false; render(); return true; } pantalla = ['editor', 'extras', 'guias', 'calc', 'bloqueos', 'bloqueo'].includes(crisisDesde) && (crisisDesde !== 'editor' || H) ? crisisDesde : 'inicio'; crisisMenu = false; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'calc') { if (calcDesde === 'crisis') { pantalla = 'crisis'; render(); window.scrollTo(0, 0); return true; } pantalla = ['editor', 'extras'].includes(calcDesde) && (calcDesde !== 'editor' || H) ? calcDesde : 'inicio'; if (calcDesde === 'editor') CT = null; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'guia') { pantalla = 'guias'; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'guias') { pantalla = guiaDesde === 'extras' ? 'extras' : 'inicio'; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'bloqueo') { pantalla = 'bloqueos'; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'bloqueos') { pantalla = ['extras', 'guias', 'guia'].includes(bqDesde) ? bqDesde : 'inicio'; render(); window.scrollTo(0, 0); return true; }
    if (pantalla === 'bienvenida') return false;
    if (pantalla === 'login') { pantalla = 'bienvenida'; render(); return true; }
    if (pantalla === 'importar') { impDatos = null; pantalla = impDesde === 'perfil' && cfg.cuenta ? 'perfil' : impDesde === 'login' ? 'login' : 'bienvenida'; render(); return true; }
    if (pantalla === 'registro') { pantalla = !cfg.cuenta && !cfg.omitirRegistro ? 'bienvenida' : cfg.cuenta || sesion ? 'perfil' : 'bienvenida'; render(); return true; }
    if (pantalla === 'sedes' || pantalla === 'perfil') {
      pantalla = H ? 'editor' : 'inicio'; if (H) H = migrar(Store.cargar(H.id) || H); render(); return true;
    }
    return false;
  }
  window.app = { atras: () => atras(), pausa: () => guardarYa(), _estado: () => ({ H, cfg }) };
  document.addEventListener('visibilitychange', () => { if (document.hidden) guardarYa(); });
  pantalla = 'bienvenida';
  render();
})();
