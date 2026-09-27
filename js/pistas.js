/* Pistas de la grilla transoperatoria: gases, anestésico inhalatorio, opioide, relajante y drogas extra.
   Cada pista tiene un agente y eventos con hora (bolos, inicio/cambio de infusión, suspensión, % del vaporizador, flujos).
   Todas las dosis son de referencia: se verifican con el criterio clínico y los protocolos locales. */
window.Pistas = (function () {
  'use strict';
  const num = (v) => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); };
  const r1 = (x, d = 1) => (isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : NaN);

  /* ---------- Catálogo ---------- */
  // Colores de vaporizador (ISO 5360) y de etiquetas de jeringa (ISO 26825) usados como referencia visual.
  const INH = {
    Sevoflurano: { color: '#D4A106', cam40: 1.80, pasos: [0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8] },
    Isoflurano: { color: '#8E24AA', cam40: 1.17, pasos: [0.4, 0.6, 0.8, 1, 1.2, 1.5, 2, 3] },
    Desflurano: { color: '#1E88E5', cam40: 6.6, pasos: [2, 3, 4, 5, 6, 7, 8, 10, 12] },
    Halotano: { color: '#C62828', cam40: 0.75, pasos: [0.25, 0.5, 0.75, 1, 1.5, 2, 3] },
    Enflurano: { color: '#EF6C00', cam40: 1.63, pasos: [0.5, 1, 1.5, 2, 3] },
  };
  // CAM ajustada a la edad (Mapleson 1996): CAM(edad) = CAM40 × 10^(−0,00269 × (edad − 40))
  const camEdad = (agente, edad) => { const a = INH[agente]; if (!a) return NaN; const e = num(edad); return a.cam40 * Math.pow(10, -0.00269 * ((isFinite(e) ? e : 40) - 40)); };

  const C = { opi: '#1565C0', rel: '#D32F2F', vaso: '#6A1B9A', hip: '#B8860B', sed: '#EF6C00', la: '#607D8B', otro: '#00796B' };
  // bolo: [min, max, unidad por kg o absoluta]; ref: refuerzo; inf: rango de infusión.
  const FARM = {
    /* Opioides */
    'Fentanilo': { clase: 'opi', uB: 'mcg', bolo: [1, 3, 'mcg/kg', 'Inducción'], ref: [0.5, 1, 'mcg/kg'], inf: [0.5, 2, 'mcg/kg/h'] },
    'Remifentanilo': { clase: 'opi', uB: 'mcg', bolo: [0.5, 1, 'mcg/kg', 'Bolo'], inf: [0.05, 0.5, 'mcg/kg/min'] },
    'Sufentanilo': { clase: 'opi', uB: 'mcg', bolo: [0.3, 1, 'mcg/kg', 'Inducción'], ref: [0.1, 0.25, 'mcg/kg'], inf: [0.1, 0.5, 'mcg/kg/h'] },
    'Alfentanilo': { clase: 'opi', uB: 'mcg', bolo: [10, 20, 'mcg/kg', 'Inducción'], ref: [5, 10, 'mcg/kg'], inf: [0.5, 1, 'mcg/kg/min'] },
    'Morfina': { clase: 'opi', uB: 'mg', bolo: [0.05, 0.1, 'mg/kg', 'Dosis'] },
    'Meperidina': { clase: 'opi', uB: 'mg', bolo: [0.5, 1, 'mg/kg', 'Dosis'], nota: 'Escalofríos: 12,5–25 mg.' },
    /* Relajantes neuromusculares */
    'Rocuronio': { clase: 'rel', uB: 'mg', bolo: [0.6, 1.2, 'mg/kg', 'Intubación'], ref: [0.1, 0.2, 'mg/kg'] },
    'Vecuronio': { clase: 'rel', uB: 'mg', bolo: [0.08, 0.1, 'mg/kg', 'Intubación'], ref: [0.01, 0.015, 'mg/kg'] },
    'Cisatracurio': { clase: 'rel', uB: 'mg', bolo: [0.15, 0.2, 'mg/kg', 'Intubación'], ref: [0.03, 0.03, 'mg/kg'] },
    'Atracurio': { clase: 'rel', uB: 'mg', bolo: [0.4, 0.5, 'mg/kg', 'Intubación'], ref: [0.1, 0.1, 'mg/kg'] },
    'Succinilcolina': { clase: 'rel', uB: 'mg', bolo: [1, 1.5, 'mg/kg', 'Intubación'] },
    /* Vasopresores e inotrópicos */
    'Efedrina': { clase: 'vaso', uB: 'mg', bolo: [5, 10, 'mg', 'Bolo'], nota: 'Bolos repetidos; vigilar taquifilaxia.' },
    'Fenilefrina': { clase: 'vaso', uB: 'mcg', bolo: [50, 200, 'mcg', 'Bolo'], inf: [0.2, 1, 'mcg/kg/min'] },
    'Norepinefrina': { clase: 'vaso', uB: 'mcg', bolo: [4, 8, 'mcg', 'Bolo'], inf: [0.02, 0.1, 'mcg/kg/min'], nota: 'En choque puede requerir más (hasta 0,5 mcg/kg/min o más).' },
    'Adrenalina': { clase: 'vaso', uB: 'mcg', bolo: [5, 10, 'mcg', 'Bolo'], inf: [0.01, 0.15, 'mcg/kg/min'] },
    'Dopamina': { clase: 'vaso', uB: 'mcg', inf: [2, 20, 'mcg/kg/min'], nota: '1–3 dopaminérgico · 3–10 β · >10 α (efecto predominante).' },
    'Dobutamina': { clase: 'vaso', uB: 'mcg', inf: [2, 20, 'mcg/kg/min'] },
    /* Hipnóticos, sedantes y coadyuvantes */
    'Propofol': { clase: 'hip', uB: 'mg', bolo: [1.5, 2.5, 'mg/kg', 'Inducción'], inf: [4, 12, 'mg/kg/h'] },
    'Ketamina': { clase: 'hip', uB: 'mg', bolo: [0.15, 0.5, 'mg/kg', 'Analgésico'], inf: [0.1, 0.3, 'mg/kg/h'] },
    'Dexmedetomidina': { clase: 'sed', uB: 'mcg', bolo: [0.5, 1, 'mcg/kg', 'Impregnación (10 min)'], inf: [0.2, 0.7, 'mcg/kg/h'] },
    'Midazolam': { clase: 'sed', uB: 'mg', bolo: [0.02, 0.05, 'mg/kg', 'Dosis'] },
    'Lidocaína': { clase: 'la', uB: 'mg', bolo: [1, 1.5, 'mg/kg', 'Bolo'], inf: [1, 2, 'mg/kg/h'] },
    'Sulfato de Magnesio': { clase: 'otro', uB: 'mg', bolo: [30, 50, 'mg/kg', 'Carga (10–15 min)'], inf: [8, 15, 'mg/kg/h'] },
  };
  const GAS = { O2: '#128A62', Aire: '#F2C300', N2O: '#1565C0' }; // O2 verde quirófano · aire amarillo · N2O azul
  const gasDe = (p, e) => (e && e.g) || (p && p.agente) || 'Aire';
  function colorDe(id, p) {
    const ag = p && p.agente;
    if (id === 'o2') return GAS.O2;
    if (id === 'aire') return ag === 'N2O' ? GAS.N2O : GAS.Aire;
    if (id === 'inh') return (INH[ag] || {}).color || '#455A64';
    if (FARM[ag]) return C[FARM[ag].clase];
    return id === 'opi' ? C.opi : id === 'rel' ? C.rel : '#37474F';
  }
  const LISTAS = {
    opi: ['Fentanilo', 'Remifentanilo', 'Sufentanilo', 'Alfentanilo', 'Morfina', 'Meperidina'],
    rel: ['Rocuronio', 'Vecuronio', 'Cisatracurio', 'Atracurio', 'Succinilcolina'],
    droga: ['Efedrina', 'Fenilefrina', 'Norepinefrina', 'Adrenalina', 'Dopamina', 'Dobutamina', 'Propofol', 'Ketamina', 'Dexmedetomidina', 'Midazolam', 'Lidocaína', 'Sulfato de Magnesio'],
  };

  /* ---------- Estructura ---------- */
  const DEF = [
    { id: 'o2', fila: 0, tipo: 'gas', nombre: 'O2', u: 'L/min' },
    { id: 'aire', fila: 1, tipo: 'gas', nombre: 'Aire', u: 'L/min', agente: 'Aire' },
    { id: 'inh', fila: 2, tipo: 'inh', nombre: 'Inhalatorio', u: '%' },
    { id: 'opi', fila: 3, tipo: 'farm', nombre: 'Opioide', lista: 'opi' },
    { id: 'rel', fila: 4, tipo: 'farm', nombre: 'Relajante muscular', lista: 'rel' },
    { id: 'd1', fila: 5, tipo: 'farm', nombre: 'Droga 1', lista: 'droga' },
    { id: 'd2', fila: 6, tipo: 'farm', nombre: 'Droga 2', lista: 'droga' },
    { id: 'd3', fila: 10, tipo: 'farm', nombre: 'Droga 3', lista: 'droga' },
    { id: 'vc', fila: 7, tipo: 'sol', nombre: 'Soluciones · Vía Central' },
    { id: 'vp1', fila: 8, tipo: 'sol', nombre: 'Soluciones · Vía Periférica 1' },
    { id: 'vp2', fila: 9, tipo: 'sol', nombre: 'Soluciones · Vía Periférica 2' },
  ];
  // Soluciones administradas: símbolo de "casa invertida" con las iniciales, siempre en negro; CG (sangre) va rellena.
  const SOL = {
    SF: { nombre: 'Solución 0,9% (SF)' },
    RL: { nombre: 'Ringer Lactato' },
    PFC: { nombre: 'Plasma Fresco Congelado' },
    CG: { nombre: 'Concentrado Globular (sangre)', relleno: true },
  };
  function asegurar(h) {
    const to = h.to = h.to || {}; const nuevo = !to.pistas;
    to.pistas = to.pistas || {};
    DEF.forEach((d) => { if (!to.pistas[d.id]) to.pistas[d.id] = { agente: d.agente || '', ev: [] }; });
    if (nuevo) {
      // Historias anteriores: pasar los valores de las filas 0–6 y 10 a eventos de las pistas
      const filas = to.filas || [];
      DEF.forEach((d) => { if (d.fila >= 2 && filas[d.fila] && !to.pistas[d.id].agente) to.pistas[d.id].agente = filas[d.fila].replace(/\s+(%|mcg|mg|L\/min)$/i, ''); });
      (to.regs || []).forEach((r) => {
        if (!r.f) return;
        DEF.forEach((d) => {
          const v = r.f[d.fila]; if (v == null || v === '') return;
          const ev = d.tipo === 'farm' ? { hora: r.hora, tipo: 'bolo', v: String(v) } : { hora: r.hora, v: String(v) };
          to.pistas[d.id].ev.push(ev); delete r.f[d.fila];
        });
      });
    }
    // Fila Aire/N2O: cada registro guarda su gas
    const pa = to.pistas.aire; (pa.ev || []).forEach((e) => { if (e.tipo !== 'stop' && !e.g) e.g = pa.agente === 'N2O' ? 'N2O' : 'Aire'; });
    return to.pistas;
  }
  function info(id) { return DEF.find((d) => d.id === id); }

  /* ---------- Tiempo ---------- */
  const minDe = (hm) => { if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return NaN; const [a, b] = hm.split(':').map(Number); return a * 60 + b; };
  function off(to, hm) { const a = minDe(to.inicio), b = minDe(hm); if (!isFinite(a) || !isFinite(b)) return NaN; let x = b - a; if (x < -60) x += 1440; return x; }
  function finCaso(to) {
    const cands = [off(to, (to.t || {}).fa), ...(to.regs || []).map((r) => off(to, r.hora))].filter(isFinite);
    return cands.length ? Math.max(...cands) : NaN;
  }
  function ordenados(to, p) { return (p.ev || []).map((e) => Object.assign({ _o: off(to, e.hora) }, e)).filter((e) => isFinite(e._o)).sort((a, b) => a._o - b._o); }
  /* Tramos continuos: inhalatorio (cada %), infusiones (cada inicio/cambio) hasta el siguiente cambio, la suspensión o el fin del caso. */
  function tramos(to, p, tipoPista) {
    const ev = ordenados(to, p); const fin = finCaso(to); const out = [];
    const cont = tipoPista === 'inh' || tipoPista === 'gas';
    const esTramo = (e) => (cont ? e.tipo !== 'stop' : e.tipo === 'inf');
    ev.forEach((e, i) => {
      if (!esTramo(e)) return;
      const sig = ev.slice(i + 1).find((x) => (cont ? true : x.tipo === 'inf' || x.tipo === 'stop'));
      let b = sig ? sig._o : (isFinite(fin) && fin > e._o ? fin : e._o + 10);
      if (num(e.v) === 0) return;
      out.push({ a: e._o, b, v: e.v, u: e.u, fgf: e.fgf, g: e.g });
    });
    return out;
  }
  function valorEn(to, p, o) { let v = NaN; ordenados(to, p).forEach((e) => { if (e._o <= o) v = num(e.v); }); return v; }

  /* ---------- Consumo de inhalatorio: mL de líquido/h ≈ 3 × FGF (L/min) × % (Dion, 1992) ---------- */
  function consumo(h) {
    const to = h.to || {}; const ps = to.pistas || {}; const p = ps.inh; if (!p || !p.agente) return null;
    const tr = tramos(to, p, 'inh'); if (!tr.length) return null;
    let ml = 0, min = 0, sinFgf = 0, sumaF = 0;
    tr.forEach((t) => {
      for (let m = t.a; m < t.b; m++) {
        const f = isFinite(num(t.fgf)) ? num(t.fgf) : (valorEn(to, ps.o2, m + 0.5) || 0) + (valorEn(to, ps.aire, m + 0.5) || 0);
        if (!(f > 0)) { sinFgf++; continue; }
        ml += (3 * f * num(t.v)) / 60; min++; sumaF += f;
      }
    });
    return { agente: p.agente, ml, min, fgfProm: min ? sumaF / min : NaN, sinFgf, tramos: tr };
  }
  function textoConsumo(h) {
    const c = consumo(h); if (!c) return '';
    const hh = Math.floor(c.min / 60), mm = c.min % 60;
    return `${c.agente}: consumo estimado ≈ ${r1(c.ml, 1)} mL de líquido (${hh ? hh + ' h ' : ''}${mm} min; FGF prom. ${r1(c.fgfProm, 1)} L/min; 3 × FGF × %)` +
      (c.sinFgf ? ` · ${c.sinFgf} min sin flujo registrado no se contaron` : '');
  }

  /* ---------- Guía de dosis según el peso ---------- */
  function guia(agente, peso) {
    const f = FARM[agente]; if (!f) return [];
    const w = num(peso); const out = [];
    const rango = (x, et) => {
      if (!x) return;
      const porKg = /\/kg/.test(x[2]);
      const uni = x[2].replace('/kg', '');
      const txt = `${et}: ${x[0] === x[1] ? x[0] : x[0] + '–' + x[1]} ${x[2]}`;
      const calc = porKg && w > 0 ? ` = ${r1(x[0] * w, 1)}${x[0] === x[1] ? '' : '–' + r1(x[1] * w, 1)} ${uni}` : '';
      out.push({ txt: txt + calc, a: porKg && w > 0 ? r1(x[0] * w, 1) : (porKg ? NaN : x[0]), b: porKg && w > 0 ? r1(x[1] * w, 1) : (porKg ? NaN : x[1]), u: uni, tipo: /\/(min|h)$/.test(x[2]) ? 'inf' : 'bolo', uInf: x[2] });
    };
    rango(f.bolo, f.bolo && f.bolo[3] || 'Bolo'); rango(f.ref, 'Refuerzo'); rango(f.inf, 'Infusión');
    return out;
  }

  return { INH, GAS, gasDe, SOL, FARM, C, LISTAS, DEF, info, asegurar, colorDe, camEdad, tramos, ordenados, off, finCaso, consumo, textoConsumo, guia, num, r1 };
})();
