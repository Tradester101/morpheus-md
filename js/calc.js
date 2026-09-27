/* Calculadora de infusiones: conversiones para BIC, esquema de Roberts y modelos farmacocinéticos para TCI manual.
   Todo es de referencia: el anestesiólogo verifica cada valor con su bomba y su criterio clínico. */
window.CalcInf = (function () {
  'use strict';
  const num = (v) => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); };
  const r = (x, d = 1) => (isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : NaN);

  /* ---------- Fármacos ---------- */
  // masa: unidad de la masa del fármaco en la jeringa (mg o mcg). Las concentraciones internas van en masa/mL.
  const FARMACOS = {
    'Propofol': {
      masa: 'mg', uDosis: 'mg/kg/h', unidades: ['mg/kg/h', 'mcg/kg/min'],
      preps: [[200, 20, '1 % sin diluir (10 mg/mL)'], [1000, 50, '2 % sin diluir (20 mg/mL)'], [500, 50, '1 % jeringa 50 mL (10 mg/mL)']],
      rango: 'Mantenimiento TIVA 4–12 mg/kg/h (≈ 70–200 mcg/kg/min); sedación 1,5–4,5 mg/kg/h (25–75 mcg/kg/min).',
      bolo: { u: 'mg/kg', rango: 'Inducción 1,5–2,5 mg/kg (menos en ancianos o ASA III–IV).', def: 1 },
      modelos: ['marsh', 'schnider'], roberts: true, ct: { u: 'mcg/mL', def: 3, rango: 'Hipnosis habitual 2,5–4 mcg/mL (sedación 0,8–2).' },
    },
    'Remifentanilo': {
      masa: 'mcg', uDosis: 'mcg/kg/min', unidades: ['mcg/kg/min', 'mcg/kg/h'],
      preps: [[2000, 40, '2 mg en 40 mL (50 mcg/mL)'], [1000, 50, '1 mg en 50 mL (20 mcg/mL)'], [2000, 50, '2 mg en 50 mL (40 mcg/mL)']],
      rango: 'Mantenimiento 0,05–0,5 mcg/kg/min (habitual 0,1–0,25; ficha técnica hasta 2).',
      bolo: { u: 'mcg/kg', rango: 'Bolo opcional 0,5–1 mcg/kg en 30–60 s.', def: 1 },
      modelos: ['minto'], ct: { u: 'ng/mL', def: 4, rango: 'Intubación 4–6 ng/mL; mantenimiento 2–8 ng/mL según estímulo.' },
    },
    'Dexmedetomidina': {
      masa: 'mcg', uDosis: 'mcg/kg/h', unidades: ['mcg/kg/h', 'mcg/kg/min'],
      preps: [[200, 50, '200 mcg en 50 mL (4 mcg/mL)'], [200, 100, '200 mcg en 100 mL (2 mcg/mL)'], [400, 100, '400 mcg en 100 mL (4 mcg/mL)']],
      rango: 'Mantenimiento 0,2–0,7 mcg/kg/h (UCI hasta 1,4).', dosisDef: 0.5,
      bolo: { u: 'mcg/kg', rango: 'Impregnación 0,5–1 mcg/kg en 10 min (procedimientos 0,25–0,5); luego mantenimiento en mcg/kg/h.', def: 1, carga: 10, prellenar: true, nombre: 'Impregnación' },
      modelos: ['hannivoort', 'dyck'], ct: { u: 'ng/mL', def: 0.6, rango: 'Sedación 0,3–1,2 ng/mL.' },
    },
    'Lidocaína': {
      masa: 'mg', uDosis: 'mg/kg/h', unidades: ['mg/kg/h', 'mg/kg/min', 'mcg/kg/min'],
      preps: [[400, 20, '2 % sin diluir (20 mg/mL)'], [1000, 250, '1 g en 250 mL (4 mg/mL)'], [1000, 100, '1 g en 100 mL (10 mg/mL)']],
      rango: 'Infusión 1–2 mg/kg/h (usar peso ideal; no pasar de 2 mg/kg/h).',
      bolo: { u: 'mg/kg', rango: 'Bolo 1–1,5 mg/kg lento.', def: 1.5 },
    },
    'Sulfato de Magnesio': {
      masa: 'mg', uDosis: 'mg/kg/h', unidades: ['mg/kg/h', 'g/h'],
      preps: [[2000, 100, '2 g en 100 mL (20 mg/mL)'], [5000, 250, '5 g en 250 mL (20 mg/mL)'], [4000, 50, '4 g en 50 mL (80 mg/mL)']],
      rango: 'Mantenimiento 8–15 mg/kg/h (habitual 10).',
      bolo: { u: 'mg/kg', rango: 'Carga 30–50 mg/kg en 10–15 min; luego mantenimiento en mg/kg/h.', def: 30, carga: 15, nombre: 'Carga' },
    },
    'Ketamina': {
      masa: 'mg', uDosis: 'mg/kg/h', unidades: ['mg/kg/h', 'mcg/kg/min'],
      preps: [[50, 50, '50 mg en 50 mL (1 mg/mL)'], [100, 50, '100 mg en 50 mL (2 mg/mL)'], [500, 50, '500 mg en 50 mL (10 mg/mL)']],
      rango: 'Analgesia (dosis subanestésica) 0,1–0,3 mg/kg/h (≈ 2–5 mcg/kg/min).',
      bolo: { u: 'mg/kg', rango: 'Bolo analgésico 0,15–0,5 mg/kg.', def: 0.25 },
    },
    /* Vasopresores e inotrópicos (Stanford Cardiac Anesthesia; Rev Mex Anest 2016; Pediatría de México 2013) */
    'Norepinefrina': {
      masa: 'mcg', uDosis: 'mcg/kg/min', unidades: ['mcg/kg/min', 'mcg/min'],
      preps: [[4000, 250, '4 mg en 250 mL (16 mcg/mL)'], [8000, 250, '8 mg en 250 mL (32 mcg/mL)'], [4000, 50, '4 mg en 50 mL (80 mcg/mL)'],
        { porKg: 0.6, vol: 100, label: 'Regla de los 6: 0,6 mg/kg en 100 mL (1 mL/h = 0,1 mcg/kg/min)' }],
      rango: 'Infusión 0,02–0,1 mcg/kg/min (≈ 1–10 mcg/min); en choque puede requerir más.',
      bolo: { u: 'mcg', rango: 'Bolo 4–8 mcg (jeringa de 8 mcg/mL).', def: 4 },
    },
    'Adrenalina': {
      masa: 'mcg', uDosis: 'mcg/kg/min', unidades: ['mcg/kg/min', 'mcg/min'],
      preps: [[1000, 100, '1 mg en 100 mL (10 mcg/mL)'], [4000, 250, '4 mg en 250 mL (16 mcg/mL)'],
        { porKg: 0.6, vol: 100, label: 'Regla de los 6: 0,6 mg/kg en 100 mL (1 mL/h = 0,1 mcg/kg/min)' }],
      rango: 'Infusión 0,01–0,15 mcg/kg/min.',
      bolo: { u: 'mcg', rango: 'Bolo 5–10 mcg (jeringa de 10 mcg/mL). En paro/anafilaxia: protocolo específico.', def: 5 },
    },
    'Fenilefrina': {
      masa: 'mcg', uDosis: 'mcg/kg/min', unidades: ['mcg/kg/min', 'mcg/min'],
      preps: [[10000, 100, '10 mg en 100 mL (100 mcg/mL)'], [10000, 250, '10 mg en 250 mL (40 mcg/mL)']],
      rango: 'Infusión 0,2–1 mcg/kg/min.',
      bolo: { u: 'mcg', rango: 'Bolo 50–200 mcg (jeringa de 100 mcg/mL).', def: 100 },
    },
    'Efedrina': {
      masa: 'mg', uDosis: 'mg/h', unidades: ['mg/h'],
      preps: [[50, 10, '50 mg en 10 mL (5 mg/mL)'], [60, 10, '60 mg en 10 mL (6 mg/mL)']],
      rango: 'Se usa en bolos de 5–10 mg; vigilar taquifilaxia.',
      bolo: { u: 'mg', rango: 'Bolo 5–10 mg.', def: 5 },
    },
    'Dopamina': {
      masa: 'mcg', uDosis: 'mcg/kg/min', unidades: ['mcg/kg/min'],
      preps: [[200000, 250, '200 mg en 250 mL (800 mcg/mL)'], [400000, 250, '400 mg en 250 mL (1600 mcg/mL)'],
        { porKg: 6, vol: 100, label: 'Regla de los 6: 6 mg/kg en 100 mL (1 mL/h = 1 mcg/kg/min)' }],
      rango: '2–20 mcg/kg/min (1–3 dopaminérgico · 3–10 β · >10 α predominante).',
    },
    'Dobutamina': {
      masa: 'mcg', uDosis: 'mcg/kg/min', unidades: ['mcg/kg/min'],
      preps: [[250000, 250, '250 mg en 250 mL (1000 mcg/mL)'], [500000, 250, '500 mg en 250 mL (2000 mcg/mL)'],
        { porKg: 6, vol: 100, label: 'Regla de los 6: 6 mg/kg en 100 mL (1 mL/h = 1 mcg/kg/min)' }],
      rango: '2–20 mcg/kg/min.',
    },
    'Otra': { masa: 'mg', uDosis: 'mg/kg/h', unidades: ['mg/kg/h', 'mg/kg/min', 'mcg/kg/min', 'mcg/kg/h', 'mg/h', 'mcg/h'], preps: [], rango: '' },
  };

  /* ---------- Conversión de unidades ---------- */
  // Devuelve cuánta masa (en la unidad "masa" del fármaco) por hora pide una dosis.
  function masaPorHora(dosis, u, peso, masa) {
    let x = num(dosis); if (!isFinite(x)) return NaN;
    const porKg = /\/kg/.test(u); if (porKg) { if (!(peso > 0)) return NaN; x *= peso; }
    if (/\/min$/.test(u)) x *= 60;
    const uMasa = u.split('/')[0];
    const aMg = { g: 1000, mg: 1, mcg: 0.001 }[uMasa];
    const baseMg = { mg: 1, mcg: 0.001 }[masa];
    return (x * aMg) / baseMg;
  }
  function velocidad(dosis, u, peso, conc, masa) { const m = masaPorHora(dosis, u, peso, masa); return conc > 0 ? m / conc : NaN; } // mL/h
  function dosisDesde(mlh, u, peso, conc, masa) { const uno = masaPorHora(1, u, peso, masa); return uno > 0 ? (num(mlh) * conc) / uno : NaN; }

  /* ---------- Modelos farmacocinéticos (3 compartimentos) ---------- */
  function lbmJames(peso, talla, sexo) {
    return sexo === 'F' ? 1.07 * peso - 148 * (peso / talla) ** 2 : 1.1 * peso - 128 * (peso / talla) ** 2;
  }
  const MODELOS = {
    marsh: { nombre: 'Marsh (propofol)', req: ['peso'], fn: (p) => ({ V1: 0.228 * p.peso, k10: 0.119, k12: 0.112, k13: 0.0419, k21: 0.055, k31: 0.0033, ke0: 1.21 }),
      nota: 'V1 = 0,228 L/kg. Clásico (Diprifusor) con objetivo plasmático; para sitio efecto se usa ke0 1,21 min⁻¹ (bombas actuales).' },
    schnider: { nombre: 'Schnider (propofol)', req: ['peso', 'talla', 'edad', 'sexo'], fn: (p) => {
      const lbm = lbmJames(p.peso, p.talla, p.sexo);
      const V1 = 4.27, V2 = 18.9 - 0.391 * (p.edad - 53), V3 = 238;
      const Cl1 = 1.89 + 0.0456 * (p.peso - 77) - 0.0681 * (lbm - 59) + 0.0264 * (p.talla - 177);
      const Cl2 = 1.29 - 0.024 * (p.edad - 53), Cl3 = 0.836;
      return { V1, k10: Cl1 / V1, k12: Cl2 / V1, k13: Cl3 / V1, k21: Cl2 / V2, k31: Cl3 / V3, ke0: 0.456, lbm };
    }, nota: 'Usa edad, peso, talla y sexo (masa magra de James). En obesos la masa magra de James se vuelve poco fiable.' },
    minto: { nombre: 'Minto (remifentanilo)', req: ['peso', 'talla', 'edad', 'sexo'], fn: (p) => {
      const lbm = lbmJames(p.peso, p.talla, p.sexo), a = p.edad - 40, l = lbm - 55;
      const V1 = 5.1 - 0.0201 * a + 0.072 * l, V2 = 9.82 - 0.0811 * a + 0.108 * l, V3 = 5.42;
      const Cl1 = 2.6 - 0.0162 * a + 0.0191 * l, Cl2 = 2.05 - 0.0301 * a, Cl3 = 0.076 - 0.00113 * a;
      return { V1, k10: Cl1 / V1, k12: Cl2 / V1, k13: Cl3 / V1, k21: Cl2 / V2, k31: Cl3 / V3, ke0: 0.595 - 0.007 * a, lbm };
    }, nota: 'Usa edad y masa magra (James).' },
    hannivoort: { nombre: 'Hannivoort 2015 (dexmedetomidina)', req: ['peso'], fn: (p) => {
      const w = p.peso / 70, V1 = 1.78 * w, V2 = 30.3 * w, V3 = 52.0 * w;
      const Cl1 = 0.686 * w ** 0.75, Q2 = 2.98 * w ** 0.75, Q3 = 0.602 * w ** 0.75;
      return { V1, k10: Cl1 / V1, k12: Q2 / V1, k13: Q3 / V1, k21: Q2 / V2, k31: Q3 / V3 };
    }, nota: 'Adultos sanos; escalado alométrico por peso total.' },
    dyck: { nombre: 'Dyck 1993 (dexmedetomidina)', req: ['talla'], fn: (p) => {
      const V1 = 7.99, V2 = 13.8, V3 = 187, Cl1 = 0.00791 * p.talla - 0.927, Q2 = 2.26, Q3 = 1.99;
      return { V1, k10: Cl1 / V1, k12: Q2 / V1, k13: Q3 / V1, k21: Q2 / V2, k31: Q3 / V3 };
    }, nota: 'Depende de la talla.' },
  };

  /* Esquema BET (bolo–eliminación–transferencia): mantiene la concentración plasmática objetivo.
     Bolo = Ct·V1; velocidad(t) = Ct·V1·(k10 + k12·e^(−k21·t) + k13·e^(−k31·t)).  Ct en masa/L, V1 en L → masa/min. */
  const TRAMOS = [[0, 5], [5, 10], [10, 15], [15, 20], [20, 30], [30, 45], [45, 60], [60, 90], [90, 120], [120, 180], [180, 240]];
  function tci(modeloId, pac, ct) {
    const M = MODELOS[modeloId]; const k = M.fn(pac);
    const A = ct * k.V1;
    const media = (a, b) => A * (k.k10 + k.k12 * (Math.exp(-k.k21 * a) - Math.exp(-k.k21 * b)) / (k.k21 * (b - a)) + k.k13 * (Math.exp(-k.k31 * a) - Math.exp(-k.k31 * b)) / (k.k31 * (b - a)));
    const final = A * k.k10;
    return { k, bolo: A, tramos: TRAMOS.map(([a, b]) => ({ a, b, masaMin: media(a, b) })), estable: final };
  }
  /* Objetivo en sitio efecto: bolo que lleva el pico de Ce justo al objetivo (sin sobrepasarlo) y, desde ese pico,
     la infusión que mantiene Cp = Ce = objetivo. Se integra numéricamente (pasos de 1 s) y se promedia por tramo. */
  function tciCe(modeloId, pac, ct) {
    const M = MODELOS[modeloId]; const k = M.fn(pac); if (!k.ke0) return null;
    const dt = 1 / 60, K1 = k.k10 + k.k12 + k.k13;
    // pico de Ce por unidad de bolo
    let a1 = 1, a2 = 0, a3 = 0, ce = 0, pico = 0, tp = 0;
    for (let t = 0; t < 30; t += dt) {
      const d1 = -K1 * a1 + k.k21 * a2 + k.k31 * a3, d2 = k.k12 * a1 - k.k21 * a2, d3 = k.k13 * a1 - k.k31 * a3;
      ce += k.ke0 * (a1 / k.V1 - ce) * dt; a1 += d1 * dt; a2 += d2 * dt; a3 += d3 * dt;
      if (ce > pico) { pico = ce; tp = t + dt; }
    }
    const bolo = ct / pico;
    a1 = bolo; a2 = 0; a3 = 0; ce = 0;
    const fin = TRAMOS[TRAMOS.length - 1][1]; const suma = TRAMOS.map(() => 0); let u = 0;
    for (let t = 0; t < fin; t += dt) {
      u = t >= tp ? Math.max(0, K1 * a1 - k.k21 * a2 - k.k31 * a3 - (a1 - ct * k.V1) / dt * 0) : 0;
      if (t >= tp && a1 < ct * k.V1) u = Math.max(u, (ct * k.V1 - a1) / dt + K1 * a1 - k.k21 * a2 - k.k31 * a3);
      const d1 = u - K1 * a1 + k.k21 * a2 + k.k31 * a3, d2 = k.k12 * a1 - k.k21 * a2, d3 = k.k13 * a1 - k.k31 * a3;
      ce += k.ke0 * (a1 / k.V1 - ce) * dt; a1 += d1 * dt; a2 += d2 * dt; a3 += d3 * dt;
      TRAMOS.forEach(([x, y], i) => { if (t >= x && t < y) suma[i] += u * dt; });
    }
    return { k, bolo, tpico: tp, tramos: TRAMOS.map(([x, y], i) => { const desde = Math.max(x, tp); return { a: x, b: y, desde, masaMin: y > desde ? suma[i] / (y - desde) : 0 }; }), estable: ct * k.V1 * k.k10 };
  }
  // Simulación numérica para comprobar el esquema (se usa en pruebas).
  function simular(k, bolo, tasa, minutos, dt = 1 / 60) {
    let a1 = bolo, a2 = 0, a3 = 0; const cp = [];
    for (let t = 0; t < minutos; t += dt) {
      const u = tasa(t);
      const d1 = u - (k.k10 + k.k12 + k.k13) * a1 + k.k21 * a2 + k.k31 * a3, d2 = k.k12 * a1 - k.k21 * a2, d3 = k.k13 * a1 - k.k31 * a3;
      a1 += d1 * dt; a2 += d2 * dt; a3 += d3 * dt; cp.push(a1 / k.V1);
    }
    return cp;
  }

  /* Esquema de Roberts (1988): bolo 1 mg/kg, luego 10 → 8 → 6 mg/kg/h (cambios a los 10 y 20 min) ≈ 3 mcg/mL. */
  function roberts(peso, conc) {
    return [
      { etapa: 'Bolo', mgkg: 1, mg: peso, ml: peso / conc },
      { etapa: '0–10 min', mgkgh: 10, mlh: (10 * peso) / conc },
      { etapa: '10–20 min', mgkgh: 8, mlh: (8 * peso) / conc },
      { etapa: 'Desde 20 min', mgkgh: 6, mlh: (6 * peso) / conc },
    ];
  }

  /* Anestésicos locales: dosis máximas orientativas (mg/kg y tope absoluto). */
  const LOCALES = {
    'Lidocaína': { sin: [4.5, 300], con: [7, 500] },
    'Bupivacaína': { sin: [2.5, 175], con: [3, 225] },
    'Levobupivacaína': { sin: [2.5, 150], con: [2.5, 150] },
    'Ropivacaína': { sin: [3, 225], con: [3, 225] },
  };

  return { FARMACOS, MODELOS, LOCALES, num, r, masaPorHora, velocidad, dosisDesde, tci, tciCe, simular, roberts, lbmJames, TRAMOS };
})();
