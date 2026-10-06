/* Generador del PDF: redibuja la hoja "Historia de Anestesia" en tamaño carta.
   Las coordenadas están en píxeles de una hoja de referencia de 935 × 1210 (110 ppp) y se escalan a puntos. */
window.PDFHistoria = (function () {
  'use strict';
  const S = 612 / 935;
  // Página con márgenes de 1 cm: la hoja de referencia se ajusta al ancho útil y el alto sobrante
  // se reparte (6 % más de alto en toda la hoja y el resto para la franja final de Observaciones/Reversión/Firma).
  const MARG = 28.35, FF = 1.1;                       // FF: factor de aumento de letra
  const RX1 = 38, RX2 = 895, RY1 = 82.5, RYC = 1008.5, RY2 = 1110;
  const SX = (612 - 2 * MARG) / (RX2 - RX1);
  const SY = S * 1.06;
  const YC = MARG + (RYC - RY1) * SY;
  const SYB = (792 - MARG - YC) / (RY2 - RYC);
  const PX = (x) => MARG + (x - RX1) * SX;
  const PY = (y) => (y <= RYC ? MARG + (y - RY1) * SY : YC + (y - RYC) * SYB);
  const AZUL = [12, 38, 115], NEGRO = [0, 0, 0], GRIS = [150, 150, 150], ROJO = [190, 30, 30];
  let d; // jsPDF

  const n = (v) => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); };
  const t = (v) => (v == null ? '' : String(v));
  const minDe = (hm) => { if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return NaN; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const hmMas = (hm, m) => { const x = (minDe(hm) + m + 1440 * 10) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  const ampm = (hm) => { const m = minDe(hm); if (!isFinite(m)) return ''; let h = Math.floor(m / 60); const s = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + String(m % 60).padStart(2, '0') + ' ' + s; };
  const fechaTxt = (s) => (s ? s.split('-').reverse().join('/') : '');

  /* ---- primitivas en px de referencia ---- */
  function col(c) { d.setTextColor(c[0], c[1], c[2]); }
  function hex(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [55, 71, 79]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lw(w) { d.setLineWidth(w); }
  function L(x1, y1, x2, y2, w = 0.5, c = NEGRO) { d.setDrawColor(c[0], c[1], c[2]); lw(w); d.line(PX(x1), PY(y1), PX(x2), PY(y2)); }
  function Rc(x1, y1, x2, y2, o = {}) {
    if (o.fill) d.setFillColor(o.fill[0], o.fill[1], o.fill[2]);
    d.setDrawColor(...(o.color || NEGRO)); lw(o.w || 0.5);
    d.rect(PX(x1), PY(y1), PX(x2) - PX(x1), PY(y2) - PY(y1), o.fill ? (o.stroke === false ? 'F' : 'FD') : 'S');
  }
  function Negro(x1, y1, x2, y2) { Rc(x1, y1, x2, y2, { fill: NEGRO, stroke: false }); }
  /* Símbolo de solución administrada: "casa invertida" (cuadro + punta hacia abajo), siempre en negro; CG va rellena. */
  function Casa(x, y, relleno, txt) {
    const hw = Math.max(3.6, 1.6 + (t(txt).length || 1) * 1.55), yTop = y - 5.6, yMid = y - 2, yApex = y + 1.8;
    const pts = [[x - hw, yTop], [x + hw, yTop], [x + hw, yMid], [x, yApex], [x - hw, yMid]];
    d.setFillColor(...(relleno ? NEGRO : [255, 255, 255]));
    d.triangle(PX(pts[0][0]), PY(pts[0][1]), PX(pts[1][0]), PY(pts[1][1]), PX(pts[2][0]), PY(pts[2][1]), 'F');
    d.triangle(PX(pts[0][0]), PY(pts[0][1]), PX(pts[2][0]), PY(pts[2][1]), PX(pts[4][0]), PY(pts[4][1]), 'F');
    d.triangle(PX(pts[4][0]), PY(pts[4][1]), PX(pts[2][0]), PY(pts[2][1]), PX(pts[3][0]), PY(pts[3][1]), 'F');
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L(a[0], a[1], b[0], b[1], 0.7, NEGRO); }
    T(txt, x, yTop + 3.3, { size: 3.5, b: true, align: 'center', c: relleno ? [255, 255, 255] : NEGRO, fijo: true, maxw: hw * 2 - 1 });
  }
  const RARO = { '≈': '~', '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '−': '-', '₂': '2', 'μ': 'mc', '✓': 'v' };
  const limpia = (s) => t(s).replace(/[≈≥≤→←−₂μ✓]/g, (c) => RARO[c]);
  function T(s, x, y, o = {}) {
    s = limpia(s); if (!s) return;
    d.setFont('helvetica', o.b ? (o.i ? 'bolditalic' : 'bold') : (o.i ? 'italic' : 'normal'));
    const tam = (o.size || 6.5) * (o.fijo ? 1 : FF);
    d.setFontSize(tam); col(o.c || NEGRO);
    if (o.maxw) { // encoger hasta que quepa
      let sz = tam; while (sz > 3.2 && d.getTextWidth(s) > o.maxw * SX) { sz -= 0.25; d.setFontSize(sz); }
      if (d.getTextWidth(s) > o.maxw * SX) { while (s.length > 1 && d.getTextWidth(s + '…') > o.maxw * SX) s = s.slice(0, -1); s += '…'; }
    }
    d.text(s, PX(x), PY(y), { align: o.align || 'left', baseline: o.base || 'middle', angle: o.angle || 0 });
  }
  const V = (s, x, y, o = {}) => T(s, x, y, Object.assign({ c: AZUL, size: 7.2 }, o)); // dato escrito
  function Parrafo(s, x1, y1, x2, y2, o = {}) {
    s = limpia(s).trim(); if (!s) return;
    let sz = (o.size || 7) * FF; d.setFont('helvetica', 'normal');
    let lineas; const H = PY(y2) - PY(y1);
    for (;;) {
      d.setFontSize(sz);
      lineas = d.splitTextToSize(s, (x2 - x1) * SX);
      const alto = lineas.length * sz * 1.15;
      if (alto <= H || sz <= 4) break;
      sz -= 0.25;
    }
    col(o.c || AZUL);
    const max = Math.floor(H / (sz * 1.15));
    d.text(lineas.slice(0, max), PX(x1), PY(y1), { baseline: 'top', lineHeightFactor: 1.15 });
  }
  function Caja(x, y, marcado, sz = 7) { // casilla centrada en (x,y)
    const h = sz / 2; Rc(x - h, y - h, x + h, y + h, { w: 0.45 });
    if (marcado) { L(x - h + 1, y - h + 1, x + h - 1, y + h - 1, 1.1, AZUL); L(x - h + 1, y + h - 1, x + h - 1, y - h + 1, 1.1, AZUL); }
  }
  function Circ(x, y, marcado, r = 3.6) {
    d.setDrawColor(0, 0, 0); lw(0.5); d.circle(PX(x), PY(y), r * SX, 'S');
    if (marcado) { d.setFillColor(...AZUL); d.circle(PX(x), PY(y), (r - 1.3) * SX, 'F'); }
  }
  function Opc(x, y, etq, marcado, o = {}) { Caja(x, y, marcado, o.sz || 7); T(etq, x + 7, y + 0.3, { size: o.size || 5.6, b: o.b, fijo: o.fijo }); }
  function Img(data, x1, y1, x2, y2, o = {}) {
    if (!data) return;
    try {
      const p = d.getImageProperties(data);
      const bx = PX(x1), by = PY(y1), bw = PX(x2) - bx, bh = PY(y2) - by;
      const k = Math.min(bw / p.width, bh / p.height);
      const w = p.width * k, h = p.height * k;
      d.addImage(data, 'PNG', bx + (bw - w) / 2, by + (bh - h) / 2, w, h, undefined, 'FAST');
      if (o.marco) Rc(x1, y1, x2, y2, { w: 0.3 });
    } catch (e) { console.warn('imagen', e); }
  }
  function Sub(x1, y1, x2, y2, etq) { Negro(x1, y1, x2, y2); T(etq, (x1 + x2) / 2, (y1 + y2) / 2 + 0.3, { b: true, size: 5.4, maxw: x2 - x1 - 2, c: [255, 255, 255], align: 'center' }); }
  function Celda(x1, y1, x2, y2, etq, valor, o = {}) {
    Rc(x1, y1, x2, y2);
    T(etq, x1 + 2, y1 + (y2 - y1) / 2 + 0.3, { b: true, size: o.size || 5.4 });
    d.setFont('helvetica', 'bold'); d.setFontSize((o.size || 5.4) * FF);
    const w = d.getTextWidth(t(etq)) / SX + 5;
    V(valor, x1 + w, y1 + (y2 - y1) / 2 + 0.4, { maxw: x2 - x1 - w - 2, size: o.vsize || 7 });
  }

  /* ---- encabezado ---- */
  const FX1 = 38, FX2 = 895, FY1 = 82.5, FY2 = 1110;
  function Opacidad(o) { try { d.setGState(new d.GState({ opacity: o })); } catch (e) { } }
  function Encabezado(h, sede, cont) {
    Negro(FX1, FY1, FX2, 124);
    // 2.0.1: la corona de Morpheus MD siempre arriba a la izquierda; el logo propio del colega, arriba a la derecha.
    Opacidad(0.85); Img(window.IMGS.marcaBlanca, 42, 85, 84, 121.5); Opacidad(1); let x0 = 90;
    // Logo del lugar: versión clara sin fondo directamente sobre la barra negra; los logos viejos (sin versión clara) siguen en su recuadro blanco
    if (sede.logoB) { Img(sede.logoB, x0 - 1, 86, x0 + 44, 120.5); x0 += 50; }
    else if (sede.logo) { Rc(x0 - 2, 85, x0 + 42, 121.5, { fill: [255, 255, 255], stroke: false }); Img(sede.logo, x0 - 0.5, 86.5, x0 + 40.5, 120); x0 += 48; }
    T(sede.nombre || '', (x0 + 655) / 2, 96, { b: true, size: 11, c: [255, 255, 255], align: 'center', maxw: 655 - x0 });
    const sub = [t(sede.sub).trim(), t(sede.rif).trim() && 'RIF ' + t(sede.rif).trim()].filter(Boolean).join(' · ');
    T(sub, (x0 + 655) / 2, 114, { b: true, size: 6.8, c: [255, 255, 255], align: 'center', maxw: 655 - x0 });
    const xt = MARCA.propio ? 752 : 797;
    if (MARCA.propio) { Opacidad(MARCA.op); Img(MARCA.propio, 850, 85, 892, 121.5); Opacidad(1); }
    T('Historia de Anestesia', xt, cont ? 99 : 104, { b: true, size: 10.5, c: [255, 255, 255], align: 'center' });
    if (cont) T('Hoja de continuación ' + cont, xt, 114, { size: 6, c: [255, 255, 255], align: 'center' });
  }
  function BloquePaciente(h) {
    const p = h.p;
    const filas = [['Nombre:', p.nombre], ['CI:', p.ci], ['N Historia:', p.nhist], ['Teléfono:', p.tel], ['Fecha:', fechaTxt(p.fecha)]];
    const ys = [124, 141, 157.5, 174, 190.5, 207];
    filas.forEach(([e, v], i) => {
      Negro(666.5, ys[i], 714, ys[i + 1]); T(e, 668.5, (ys[i] + ys[i + 1]) / 2 + 0.3, { b: true, size: 6.2, c: [255, 255, 255], maxw: 44 });
      Rc(714, ys[i], FX2, ys[i + 1]); V(v, 717, (ys[i] + ys[i + 1]) / 2 + 0.4, { maxw: 175, size: 7.4 });
    });
  }
  function Datos(h) {
    const p = h.p; const y = [124, 141, 157.5, 174, 190.5, 207];
    const vol = t(p.volemia) || t(p._volemia), pmp = t(p.pmp) || t(p._pmp);
    // Línea 1 (2.0.1): Edad · Peso · Talla · IMC · Hb · Hto · Plaquetas · Volemia · PMP
    const imc = t(p._imc) || (() => { const w = parseFloat(t(p.peso).replace(',', '.')), tl = parseFloat(t(p.talla).replace(',', '.')); return w > 0 && tl > 0 ? (Math.round((w / Math.pow(tl / 100, 2)) * 10) / 10).toString().replace('.', ',') : ''; })();
    const x1 = [FX1, 90, 148, 208, 262, 312, 362, 452, 538, 666.5];
    [['Edad', p.edad ? p.edad + ' a' : ''], ['Peso', p.peso ? p.peso + ' kg' : ''], ['Talla', p.talla ? p.talla + ' cm' : ''], ['IMC', imc], ['Hb', p.hb], ['Hto', p.hto ? p.hto + ' %' : ''],
      ['Plaquetas', p.plaq], ['Volemia', vol ? vol + ' ml' : ''], ['PMP (Hto ' + (t(p.htoMin) || (t(p.hto) ? '30' : '__')) + ')', pmp ? pmp + ' ml' : '']].forEach(([e, v], i) => Celda(x1[i], y[0], x1[i + 1], y[1], e, v));
    // Línea 2: Glicemia · Urea · Creatinina · TP · TPT · Grupo y Rh · Na · K · Cl · Otros
    const x2 = [FX1, 96, 140, 202, 256, 312, 358, 394, 424, 458, 666.5];
    const grupo = t(p.grupo) + (p.rh === '+' ? '+' : p.rh === '-' ? '-' : '');
    [['Glicemia', p.glic], ['Urea', p.urea], ['Creat.', p.creat], ['TP', p.tp], ['TPT', p.tpt], ['Grupo', grupo], ['Na', p.na], ['K', p.k], ['Cl', p.cl]]
      .forEach(([e, v], i) => Celda(x2[i], y[1], x2[i + 1], y[2], e, v, { size: 5.2 }));
    // Otros exámenes: lo que no quepa pasa a Observaciones
    const CORTO = { 'Hepatitis B (HBsAg)': 'Hep B', 'Hepatitis C (anti-HCV)': 'Hep C', 'β-HCG': 'B-HCG', 'Tiempo de sangría': 'T. sangría', 'Tiempo de coagulación': 'T. coag.', 'Calcio iónico': 'Ca iónico', 'Calcio': 'Ca', 'Magnesio': 'Mg', 'Fósforo': 'P',
      'Glicemia postprandial': 'Glic. postpr.', 'Proteínas totales': 'Prot. tot.', 'Bilirrubina total': 'BT', 'Bilirrubina directa': 'BD', 'TGO (AST)': 'TGO', 'TGP (ALT)': 'TGP', 'Fosfatasa alcalina': 'FA', 'Ácido úrico': 'Ác. úrico',
      'Depuración de creatinina': 'Dep. creat.', 'Colesterol total': 'Colest.', 'Triglicéridos': 'TG', 'Exceso de base': 'EB', 'SatO2 arterial': 'SaO2', 'Leucocitos': 'Leuc.', 'Neutrófilos': 'Neut.', 'Linfocitos': 'Linf.', 'Hierro sérico': 'Fe', 'Saturación de transferrina': 'Sat. transf.', 'Procalcitonina': 'PCT', 'Examen de orina': 'Orina' };
    const piezas = (Array.isArray(p.labs) ? p.labs : []).filter((x) => t(x.n).trim() && t(x.v).trim()).map((x) => (CORTO[x.n] || t(x.n).trim()) + ' ' + t(x.v).trim() + (x.u === '%' ? '%' : ''));
    const ox = x2[9]; Rc(ox, y[1], 666.5, y[2]); T('Otros:', ox + 2, (y[1] + y[2]) / 2 + 0.3, { b: true, size: 5.2 });
    const wOtros = 666.5 - ox - anchoTxt('Otros:', 5.2, true) - 7; let cabe = piezas.length, sz = 7;
    const ancho = (n, z) => anchoTxt(piezas.slice(0, n).join(' · '), z, false);
    while (sz > 5 && ancho(cabe, sz) > wOtros) sz -= 0.25;
    while (cabe > 0 && ancho(cabe, sz) > wOtros) cabe--;
    const txtO = piezas.slice(0, cabe).join(' · ') + (cabe < piezas.length ? ' · (ver Obs.)' : '');
    V(txtO, ox + 4 + anchoTxt('Otros:', 5.2, true), (y[1] + y[2]) / 2 + 0.4, { size: sz, maxw: wOtros });
    h._labsObs = cabe < piezas.length ? 'Otros laboratorios: ' + piezas.slice(cabe).join(' · ') + '.' : '';
    Celda(FX1, y[2], 351, y[3], 'Alergias:', h.alergias); Celda(351, y[2], 666.5, y[3], 'Premedicación:', h.premed);
    Celda(FX1, y[3], 351, y[4], 'Anestesiólogo(s):', h.anest); Celda(351, y[3], 666.5, y[4], 'Asistente de Anestesia:', h.asist);
    Celda(FX1, y[4], 351, y[5], 'Cirujanos:', h.ciruj); Celda(351, y[4], 666.5, y[5], 'Instrumentista:', h.instr);
  }

  /* ---- columna izquierda superior ---- */
  function Izquierda(h) {
    Rc(FX1, 207, 268.5, 622.5);
    // Mallampati
    T('Mallampati', 41, 214, { b: true, size: 6.4 });
    const mx = [63.5, 113.5, 162.5, 212.5], rom = ['I', 'II', 'III', 'IV'];
    mx.forEach((x, i) => {
      Img(window.IMGS['mall' + (i + 1)], x + 7, 219, x + 32, 253);
      Circ(x, 243, h.mallampati === rom[i]);
      T(rom[i], x, 260, { b: true, size: 5.6, align: 'center' });
    });
    L(FX1, 268, 268.5, 268);
    // ASA
    T('ASA', 41, 276, { b: true, size: 7.5 });
    ['I', 'II', 'III', 'IV', 'V'].forEach((r, i) => { const x = 47 + i * 33; Circ(x, 290, h.asa === r, 3.2); T(r, x + 6, 290.3, { b: true, size: 6.2 }); });
    Circ(212, 290, !!h.asaE, 3.2); T('E', 218, 290.3, { b: true, size: 6.2 });
    T('Razón:', 41, 302.5, { b: true, size: 6 }); V(h.asaRazon, 76, 302.8, { maxw: 200, size: 6.6 });
    // Glasgow
    const g = h.gcs || {};
    T('Glasgow', 41, 316, { b: true, size: 7 });
    const tot = (n(g.ro) + n(g.rv) + n(g.rm));
    const gx = (lbl, v, of, x) => { T(lbl, x, 328.5, { b: true, size: 5.6 }); d.setFontSize(5.6 * FF); d.setFont('helvetica', 'bold'); const w = d.getTextWidth(lbl) / SX; V(v || '__', x + w + 1, 328.2, { size: 6.4, c: v ? AZUL : NEGRO }); T('/' + of, x + w + 8, 328.5, { b: true, size: 5.6 }); };
    gx('RO', g.ro, 4, 41); gx('RV', g.rv, 5, 76); gx('RM', g.rm, 6, 111);
    const tv = isFinite(tot) ? String(tot) : '__'; V(tv, 148, 328.2, { size: 6.4, c: isFinite(tot) ? AZUL : NEGRO });
    d.setFont('helvetica', 'normal'); d.setFontSize(6.4 * FF); T('/15', 149 + d.getTextWidth(tv) / SX, 328.5, { b: true, size: 5.6 });
    L(FX1, 335, 268.5, 335);
    // Verificación
    const CH = [['maq', 'Máquina de anestesia operativa'], ['mon', 'Monitores de signos operativos'], ['asp', 'Aspiración operativa'],
      ['sum', 'Suministros anestésicos necesarios'], ['med', 'Medicamentos anestésicos necesarios'], ['hem', 'Verificación de hemoderivados'],
      ['den', 'Verificar estado de piezas dentales'], ['ocu', 'Oclusión de globos oculares'], ['pre', 'Cuidado de puntos de presión']];
    // 2 columnas para no desperdiciar el lateral; libera espacio para agrandar la medicación coadyuvante
    const CHCOL = 5; // ítems en la 1a columna; el resto pasa a la 2a
    const CX = [44, 156], CHW = [156 - 4 - 52.5, 266.5 - 164.5]; // columnas y ancho útil del texto
    // un solo tamaño de letra para todos los ítems: el mayor que deja caber el texto más largo
    d.setFont('helvetica', 'bold'); let chSz = 5.2;
    CH.forEach(([, e], i) => { const w = CHW[i < CHCOL ? 0 : 1] * SX; d.setFontSize(chSz * FF); while (chSz > 3.6 && d.getTextWidth(e) > w) { chSz -= 0.1; d.setFontSize(chSz * FF); } });
    CH.forEach(([k, e], i) => {
      const col = i < CHCOL ? 0 : 1, fila = col === 0 ? i : i - CHCOL;
      const x = CX[col], y = 341 + fila * 12.05;
      Caja(x, y, !!(h.chk || {})[k]); T(e, x + 8.5, y + 0.3, { b: true, size: chSz, maxw: CHW[col] });
    });
    // Medicación coadyuvante (recuadro más alto: la checklist ahora ocupa menos por ir en 2 columnas)
    Negro(FX1, 397, 268.5, 407.5); T('MEDICACIÓN COADYUVANTE', 41, 402.5, { b: true, size: 6, c: [255, 255, 255] });
    const CO = [['ansio', 'Ansiólisis', 'mg', 419], ['gast', 'Protección Gástrica', 'mg', 434], ['emet', 'Antieméticos', 'mg', 449],
      ['analg', 'Analgésicos', 'mg', 480], ['atb', 'Antibióticos', 'mg / g', 526], ['ester', 'Esteroides', 'mg', 556.5],
      ['nebu', 'Nebulización', 'gts/puff', 586], ['otros', 'Otros', 'mg / g', 600.5]];
    // Cada fármaco ocupa su propia línea (nombre + dosis a la derecha y su unidad). Si algún ítem lleva varios,
    // el espacio libre del recuadro se reparte entre los ítems: se usa mejor sin cambiar el tamaño del recuadro.
    const TXW = 234 - 117, LH = 9.4, YA = 419, YB = 600.5;
    d.setFont('helvetica', 'normal');
    const lineasCo = CO.map(([k]) => {
      const c = (h.coad || {})[k] || {}, ls = [];
      (c.meds || []).forEach((m) => { const nm = String(m.n || '').trim(), ds = String(m.d || '').trim(); if (nm || ds) ls.push({ t: [nm, ds].filter(Boolean).join(' '), u: m.u || '' }); });
      if (String(c.det || '').trim()) { d.setFontSize(6.2 * FF); d.splitTextToSize(String(c.det).trim(), TXW * SX).forEach((t) => ls.push({ t, u: '', libre: true })); }
      return ls;
    });
    const hayDatos = lineasCo.some((ls) => ls.length);
    let ys = CO.map((x) => x[3]);
    if (hayDatos) {
      const ext = lineasCo.map((ls) => Math.max(0, ls.length - 1) * LH), tot = ext.reduce((a, b) => a + b, 0);
      let lh = LH, gap = (YB - YA - tot) / (CO.length - 1);
      if (gap < 11) { const f = Math.max(0.6, (YB - YA - 11 * (CO.length - 1)) / Math.max(1, tot)); lh = LH * Math.min(1, f); gap = (YB - YA - tot * Math.min(1, f)) / (CO.length - 1); }
      let y = YA; ys = lineasCo.map((ls) => { const y0 = y; y += Math.max(0, ls.length - 1) * lh + gap; return y0; });
      CO.forEach((x, i) => (x.lh = lh));
    }
    CO.forEach(([k, e, u], i) => {
      const c = (h.coad || {})[k] || {}, ls = lineasCo[i], y = ys[i], lh = CO[i].lh || LH;
      d.setFont('helvetica', 'normal'); d.setFontSize(6.4 * FF);
      const anchoTxt = ls.length ? Math.min(TXW, Math.max(...ls.map((l) => d.getTextWidth(limpia(l.t)) / SX))) : 50;
      Caja(47, y, !!c.on || ls.length > 0); T(e, 56.5, y + 0.3, { b: true, size: 5.4, maxw: Math.max(58, 234 - anchoTxt - 56.5 - 4) });
      if (!ls.length) { L(187.5, y + 4.6, 235, y + 4.6, 0.5); T(u, 237.5, y + 0.3, { size: 5 }); return; }
      ls.forEach((l, j) => {
        const yl = y + j * lh;
        if (l.libre) { V(l.t, 234, yl - 0.2, { size: 6.2, align: 'right', maxw: TXW }); return; }
        V(l.t, 234, yl - 0.2, { size: 6.4, align: 'right', maxw: TXW }); if (l.u) T(l.u, 237.5, yl + 0.3, { size: 5.2 });
      });
    });
    TecInd(h);
  }

  /* ---- grilla transoperatoria ---- */
  // 11 columnas mayores de 30 min, cada una dividida en 6 subcolumnas de 5 min → 5 h 30 min por hoja
  const NCOL = 11, CMIN = 30, SPC = 6, GX0 = 350, GX1 = 895, NSUB = NCOL * SPC, SW = (GX1 - GX0) / NSUB, MW = (GX1 - GX0) / NCOL, MINP = NCOL * CMIN;
  const RY0 = 238, RH = (396 - 238) / 12, NF = 11, YH = RY0 + NF * RH; // 11 filas de fármacos; luego HORA y EKG
  // escala de la gráfica: una fila cada 10 unidades, números de 20 en 20 (20–220)
  const yv = (v) => 577.5 - (v - 20) * 0.6975;

  function Grilla(h, ini) {
    const to = h.to || {}; const regs = (to.regs || []).map((r) => Object.assign({ _o: off(to, r.hora) }, r)).filter((r) => isFinite(r._o));
    const enPag = regs.filter((r) => r._o >= ini && r._o < ini + MINP);
    const X = (o) => GX0 + ((o - ini) / MINP) * (GX1 - GX0);
    const colMayor = (o) => Math.floor((o - ini) / CMIN);

    // Dx / intervención
    Negro(268.5, 207, 350, 238); T('Dx Quirúrgico:', 271, 214.8, { b: true, size: 6.6, c: [255, 255, 255], maxw: 77 }); T('Intervención Qx:', 271, 230.3, { b: true, size: 6.6, c: [255, 255, 255], maxw: 77 });
    Rc(350, 207, FX2, 222.5); Rc(350, 222.5, FX2, 238);
    V(h.dx, 354, 215, { maxw: 538 }); V(h.intervencion, 354, 230.5, { maxw: 538 });
    Rc(268.5, 238, FX2, 711.5, { w: 0.8 });
    L(350, 238, 350, 622.5, 0.8);

    // filas de fármacos / gases (pistas)
    const nombres = to.filas || [];
    const P = window.Pistas, ps = to.pistas || {};
    const FF_ = { 2: '(INHALATORIO)', 3: '(OPIOIDE)', 4: '(RELAJ MUSC)', 5: '(DROGA)', 6: '(DROGA)', 10: '(DROGA)' };
    const fijos = { 7: 'VC #  YI SC  D/I', 8: 'VP #  M Sup/Inf  D/I', 9: 'VP #  M Sup/Inf  D/I' };
    const yF = (i) => RY0 + i * RH + RH / 2 + 0.3;
    P.DEF.forEach((dd) => {
      const p = ps[dd.id] || {}; const y = yF(dd.fila); const col = hex(P.colorDe(dd.id, p));
      // nombres de fila en negro (el color va solo en las líneas de la grilla)
      if (dd.id === 'o2') T('O2  L/min', 271, y, { b: true, size: 5.2, maxw: 76 });
      else if (dd.id === 'aire') T('Aire/N2O  L/min', 271, y, { b: true, size: 5.2, maxw: 76 });
      else if (dd.tipo === 'sol') { if (nombres[dd.fila]) V(nombres[dd.fila], 271, y, { size: 5.4, maxw: 76, b: true }); else T(fijos[dd.fila] || '', 271, y, { b: true, size: 5, maxw: 76 }); }
      else if (p.agente) {
        const f = P.FARM[p.agente]; const u = dd.id === 'inh' ? '%' : (f ? f.uB : '');
        T(p.agente + (u ? '  ' + u : ''), 271, y, { b: true, size: 5.2, maxw: 76 });
      } else if (nombres[dd.fila]) V(nombres[dd.fila], 271, y, { size: 5.4, maxw: 76, b: true });
      else if (dd.tipo === 'sol') T(fijos[dd.fila] || '', 271, y, { b: true, size: 5, maxw: 76 });
      else T(FF_[dd.fila] || '', 271, y, { size: 3.8 });
    });
    for (let i = 0; i <= NF; i++) L(i === 0 || i === NF ? 268.5 : 350, RY0 + i * RH, GX1, RY0 + i * RH, i === NF ? 0.8 : 0.35, i === NF ? NEGRO : GRIS);
    subCols(RY0, YH);
    // valores de filas libres (VC/VP y registros antiguos)
    enPag.forEach((r) => Object.keys(r.f || {}).forEach((k) => {
      const i = +k; if (!(i >= 0 && i < NF)) return;
      V(r.f[k], X(r._o) + 1, yF(i), { size: 5.2 });
    }));
    const dentro = (o) => o >= ini && o < ini + MINP;
    P.DEF.forEach((dd) => {
      const p = ps[dd.id]; if (!p) return;
      const y = yF(dd.fila); const col = hex(P.colorDe(dd.id, p)); const colT = col;
      const ev = P.ordenados(to, p);
      if (dd.tipo === 'sol') { // soluciones: bolsa invertida al inicio; línea negra hasta el fin (rayita vertical) o hasta la siguiente bolsa
        const fin = (e) => (e.fin ? P.off(to, e.fin) : NaN), ini1 = ini + MINP;
        ev.forEach((e, k) => {
          const f = fin(e), sig = ev[k + 1];
          let hasta = isFinite(f) && f > e._o ? f : sig ? sig._o : NaN; if (!isFinite(hasta)) return;
          const a = Math.max(e._o, ini), b = Math.min(hasta, ini1); if (b <= a) return;
          L(X(a), y, X(b), y, 0.8, NEGRO);
          if (isFinite(f) && f > e._o && dentro(f)) L(X(f), y - 3.2, X(f), y + 3.2, 0.9, NEGRO);
        });
        ev.filter((e) => dentro(e._o)).forEach((e) => { const info = P.SOL[e.v]; Casa(X(e._o), y, !!(info && info.relleno), e.v === 'Otro' ? (e.txt || '?') : e.v); });
        return;
      }
      // tramos continuos (inhalatorio o infusiones)
      P.tramos(to, p, dd.tipo).forEach((t) => {
        const a = Math.max(t.a, ini), b = Math.min(t.b, ini + MINP); if (b <= a) return;
        const col = dd.id === 'aire' ? hex(P.GAS[P.gasDe(p, t)] || P.GAS.Aire) : colT;
        const cont = dd.tipo === 'inh' || dd.tipo === 'gas';
        const etq = cont ? String(t.v) : `${t.v}${t.u ? ' ' + t.u : ''}`;
        const sz = cont ? 5.6 : 4.4;
        d.setFont('helvetica', 'bold'); d.setFontSize(sz * FF); const w = d.getTextWidth(etq) / SX;
        const empieza = t.a >= ini;
        if (cont) {
          if (empieza) T(etq, X(a) + 0.8, y, { size: sz, b: true, c: col });
          const x0 = X(a) + (empieza ? w + 2 : 0);
          if (X(b) > x0) L(x0, y, X(b), y, dd.tipo === 'gas' ? 1.1 : 1.5, col);
        } else {
          if (empieza) T(etq, X(a) + 0.8, y - 3.1, { size: sz, b: true, c: col });
          L(X(a), y + 1.6, X(b), y + 1.6, 1.3, col);
          if (empieza) L(X(a), y - 0.4, X(a), y + 3.6, 0.8, col);
        }
        if (t.b < ini + MINP) L(X(b), y - 2.6, X(b), y + 3.2, 0.8, col);
      });
      if (dd.tipo === 'farm') ev.filter((e) => e.tipo === 'bolo' && dentro(e._o)).forEach((e) => {
        const x = X(e._o); d.setFillColor(...col);
        d.triangle(PX(x) - 1.6, PY(y - 4.4), PX(x) + 1.6, PY(y - 4.4), PX(x), PY(y - 1.4), 'F');
        T(e.v + (e.u && P.FARM[p.agente] && e.u !== P.FARM[p.agente].uB ? ' ' + e.u : ''), x + 2.2, y + 0.3, { size: 5.2, b: true, c: col });
      });
    });

    // HORA / EKG / SatO2 / EtCO2
    T('HORA:', 271, (YH + 396) / 2 + 0.3, { b: true, size: 6.4 }); T('EKG', 271, 401.8, { b: true, size: 6.4 });
    T('SatO2', 271, 413.8, { b: true, size: 6.4 }); T('EtCO2', 271, 425.8, { b: true, size: 6.4 });
    L(268.5, 396, GX1, 396, 0.8); L(268.5, 407.5, GX1, 407.5, 0.5); L(268.5, 420, GX1, 420, 0.5); L(268.5, 431, GX1, 431, 0.8);
    for (let c = 0; c <= NCOL; c++) L(GX0 + c * MW, YH, GX0 + c * MW, 396, c % NCOL ? 0.6 : 0.8);
    subCols(396, 431); // EKG, SatO2 y EtCO2 con la misma grilla de 5 min que la gráfica
    // EKG: la sigla se escribe cuando cambia el ritmo; una línea fina indica que continúa
    const conEkg = regs.filter((r) => t(r.ekg));
    let prevE = ''; const tramos = [];
    conEkg.forEach((r) => { if (r.ekg !== prevE) { tramos.push({ o: r._o, v: r.ekg }); prevE = r.ekg; } });
    const finEkg = conEkg.length ? conEkg[conEkg.length - 1]._o + 5 : 0;
    tramos.forEach((tr, i) => {
      const fin = i + 1 < tramos.length ? tramos[i + 1].o : finEkg;
      const a = Math.max(tr.o, ini), z = Math.min(fin, ini + MINP); if (z <= a) return;
      d.setFont('helvetica', 'bold'); d.setFontSize(5.6 * FF); const w = d.getTextWidth(tr.v) / SX;
      V(tr.v, X(a) + 1, 401.8, { size: 5.6, b: true, maxw: Math.max(12, X(z) - X(a) - 2) });
      if (X(z) - X(a) > w + 5) L(X(a) + w + 2.5, 402, X(z) - 1, 402, 0.5, AZUL);
    });
    const finA = off(to, (to.t || {}).fa), cerrar = (to.cierre || 'recta') !== 'no' && isFinite(finA);
    for (let c = 0; c < NCOL; c++) {
      const cx = GX0 + (c + 0.5) * MW;
      if (to.inicio && !(cerrar && ini + c * CMIN > finA)) {
        // flecha que señala la línea donde empieza la hora; la hora va justo a su derecha
        const bx = GX0 + c * MW; d.setFillColor(...AZUL);
        d.triangle(PX(bx), PY(396), PX(bx) - 2.2, PY(396) - 3.4, PX(bx) + 2.2, PY(396) - 3.4, 'F');
        V(hmMas(to.inicio, ini + c * CMIN), bx + 3.5, (YH + 396) / 2 - 0.4, { size: 6.2 });
      }
    }
    // SatO2 y EtCO2: último valor de cada bloque de 15 min, centrado en sus 3 cuadritos
    for (let q = 0; q < NCOL * 2; q++) {
      const cx = GX0 + (q + 0.5) * MW / 2;
      const enQ = enPag.filter((r) => Math.floor((r._o - ini) / (CMIN / 2)) === q);
      const ultimo = (k) => { for (let j = enQ.length - 1; j >= 0; j--) if (t(enQ[j][k])) return enQ[j][k]; return ''; };
      V(ultimo('sat'), cx, 414, { size: 5.6, align: 'center', maxw: MW / 2 - 1 }); V(ultimo('etco2'), cx, 426, { size: 5.6, align: 'center', maxw: MW / 2 - 1 });
    }

    // gráfica
    const CY0 = 431, CY1 = 587.5;
    Negro(268.5, CY0, 285, 577.5);
    T('Signos vitales de inicio', 279.5, 555, { b: true, size: 6.8, c: [255, 255, 255], angle: 90 });
    // columna de inicio con la misma cuadrícula que la gráfica (líneas cada 10, marcadas cada 20; dos subcolumnas)
    for (let v = 10; v <= 230; v += 10) { const may = v % 20 === 0; L(301.5, yv(v), 317.5, yv(v), may ? 0.4 : 0.2, may ? [120, 120, 120] : [185, 185, 185]); }
    L(309.5, yv(230), 309.5, 577.5, 0.2, [185, 185, 185]);
    L(301.5, yv(230), 301.5, 577.5, 0.5); L(317.5, yv(230), 317.5, 577.5, 0.5);
    for (let v = 220; v >= 20; v -= 20) T(String(v), 347, yv(v), { size: 4, align: 'right', b: v % 100 === 0 });
    for (let v = 10; v <= 230; v += 10) { const may = v % 20 === 0; L(GX0, yv(v), GX1, yv(v), may ? 0.4 : 0.2, may ? [120, 120, 120] : [185, 185, 185]); }
    subCols(CY0, CY1);
    // FC / FR iniciales
    Negro(268.5, 577.5, 285, 587.5); T('FC:', 270, 582.8, { b: true, size: 5, c: [255, 255, 255] });
    Rc(285, 577.5, 300, 587.5); Negro(300, 577.5, 315, 587.5); T('FR:', 302, 582.8, { b: true, size: 5, c: [255, 255, 255] }); Rc(315, 577.5, 332, 587.5);
    const b = to.base || {};
    V(b.fc, 292.5, 582.8, { size: 5.4, align: 'center' }); V(b.fr, 323.5, 582.8, { size: 5.4, align: 'center' });
    const bx = 305.5, lim = (v) => yv(Math.max(10, Math.min(230, n(v)))); // TA en la subcolumna izquierda, FC en la derecha
    if (isFinite(n(b.tas))) marca('v', bx, lim(b.tas), ROJO);
    if (isFinite(n(b.tad))) marca('^', bx, lim(b.tad), ROJO);
    if (isFinite(n(b.fc))) marca('.', 313.5, lim(b.fc), AZUL);
    if (isFinite(n(b.sat))) T('Sat ' + b.sat, 309.5, 434.5, { size: 3.6, c: AZUL, align: 'center' });
    // series
    const serie = (k, s, c) => {
      const pts = enPag.filter((r) => isFinite(n(r[k]))).map((r) => [X(r._o), yv(Math.max(10, Math.min(230, n(r[k]))))]);
      d.setDrawColor(...c); lw(0.35);
      for (let i = 1; i < pts.length; i++) L(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0.3, c);
      pts.forEach(([x, y]) => marca(s, x, y, c));
    };
    serie('tas', 'v', ROJO); serie('tad', '^', ROJO); serie('fc', '.', AZUL); serie('fr', 'o', [20, 110, 40]);
    // tiempos (eventos)
    const EV = [['ia', 'X', 'Inicio anestesia'], ['ic', 'O', 'Inicio cirugía'], ['fc', 'O', 'Fin cirugía'], ['fa', 'X', 'Fin anestesia']];
    EV.forEach(([k, s]) => {
      const o = off(to, (to.t || {})[k]); if (!isFinite(o) || o < ini || o >= ini + MINP) return;
      const x = X(o), y = 436.5;
      if (s === 'X') { L(x - 2.6, y - 2.6, x + 2.6, y + 2.6, 0.9, AZUL); L(x - 2.6, y + 2.6, x + 2.6, y - 2.6, 0.9, AZUL); }
      else { d.setDrawColor(...AZUL); lw(0.8); d.circle(PX(x), PY(y), 2.8 * SX, 'S'); d.setFillColor(...AZUL); d.circle(PX(x), PY(y), 0.9 * SX, 'F'); }
      T({ ia: 'IA', ic: 'IC', fc: 'FC', fa: 'FA' }[k], x, 442, { size: 3.4, c: AZUL, align: 'center', b: true });
    });
    // leyenda
    const lx = 700, ly = 628.3; // leyenda en la franja de VENTILACIÓN
    marca('v', lx + 2, ly + 1.7, ROJO); T('TAS', lx + 6, ly + 0.4, { size: 3.6 });
    marca('^', lx + 26, ly - 1.7, ROJO); T('TAD', lx + 30, ly + 0.4, { size: 3.6 });
    marca('.', lx + 50, ly + 0.2, AZUL); T('FC', lx + 54, ly + 0.4, { size: 3.6 });
    marca('o', lx + 70, ly + 0.2, [20, 110, 40]); T('FR', lx + 74, ly + 0.4, { size: 3.6 });
    T('X anestesia  O cirugía', lx + 90, ly + 0.4, { size: 3.6 });
    L(268.5, CY1, GX1, CY1, 0.8);

    // ventilación
    const VY = [587.5, 599.2, 610.9, 622.5];
    ['ESPONTÁNEA', 'ASISTIDA', 'CONTROLADA'].forEach((e, i) => T(e, 309, (VY[i] + VY[i + 1]) / 2 + 0.3, { b: true, size: 5.2, align: 'center' }));
    L(GX0, VY[1], GX1, VY[1], 0.35, GRIS); L(GX0, VY[2], GX1, VY[2], 0.35, GRIS);
    subCols(587.5, 622.5);
    const conModo = regs.filter((r) => r.vent);
    conModo.forEach((r, i) => {
      const fin = i + 1 < conModo.length ? conModo[i + 1]._o : (regs.length ? Math.max(regs[regs.length - 1]._o, r._o) + 5 : r._o + 5);
      const a = Math.max(r._o, ini), z = Math.min(fin, ini + MINP); if (z <= a) return;
      const fila = { E: 0, A: 1, C: 2 }[r.vent]; const y = (VY[fila] + VY[fila + 1]) / 2;
      L(X(a), y, X(z), y, 2.2, AZUL);
    });
    L(268.5, 622.5, GX1, 622.5, 0.8);

    // ventilador
    Negro(268.5, 622.5, 350, 634); T('VENTILACIÓN', 309, 628.3, { b: true, size: 5.6, c: [255, 255, 255], align: 'center' });
    L(268.5, 634, GX1, 634, 0.5);
    T('Posición:', 271, 640.3, { b: true, size: 6.2 }); V(to.posicion, 318, 640.5, { maxw: 585, size: 6.8 });
    const VR = [['VC / FR', 'vc', 'vfr'], ['Ppico / PEEP', 'ppico', 'peep'], ['PVC / PAP', 'pvc', 'pap'], ['GC / Cuna', 'gc', 'cuna'], ['Temp / Entrop', 'temp', 'entrop']];
    const VPY = [646.5, 659.4, 672.3, 685.2, 698.1, 711.5];
    L(268.5, 646.5, GX1, 646.5, 0.8);
    VR.forEach(([e, a, bb], i) => {
      const yc = (VPY[i] + VPY[i + 1]) / 2;
      T(e, 271, yc + 0.3, { b: true, size: 7, maxw: 77 });
      L(350, VPY[i + 1], GX1, VPY[i + 1], 0.5);
      for (let c = 0; c < NCOL; c++) {
        const cx = GX0 + (c + 0.5) * MW;
        T('/', cx, yc + 0.3, { b: true, size: 7.5, align: 'center', i: true });
        const enCol = enPag.filter((r) => colMayor(r._o) === c);
        const ult = (k) => { for (let j = enCol.length - 1; j >= 0; j--) if (t(enCol[j][k])) return enCol[j][k]; return ''; };
        V(ult(a), cx - 2.5, yc + 0.4, { size: 5.8, align: 'right', maxw: 21 }); V(ult(bb), cx + 2.5, yc + 0.4, { size: 5.8, maxw: 21 });
      }
    });
    L(350, 646.5, 350, 711.5, 0.8);
    for (let c = 1; c < NCOL; c++) L(GX0 + c * MW, 646.5, GX0 + c * MW, 711.5, 0.5);
    Cierre(to, ini, X);
  }
  /* Cierre de la grilla: línea gruesa (recta o en zigzag) en el fin de anestesia y rayado diagonal del espacio que queda sin usar */
  function Cierre(to, ini, X) {
    const modo = to.cierre || 'recta'; if (modo === 'no') return;
    const fin = off(to, (to.t || {}).fa); if (!isFinite(fin) || fin < ini || fin >= ini + MINP) return;
    const x0 = X(fin), Y0 = RY0, Y1 = 711.5;
    // rayado a 45° (x = c + y) recortado a cada franja con tiempo; se salta la franja VENTILACIÓN / Posición (texto y leyenda)
    const rayar = (ya0, yb0) => { if (GX1 - x0 <= 1) return;
      const paso = 7, k0 = Math.floor((x0 - yb0) / paso) * paso;
      for (let c = k0; c < GX1 - ya0; c += paso) {
        const ya = Math.max(ya0, x0 - c), yb = Math.min(yb0, GX1 - c);
        if (yb - ya > 0.5) L(c + ya, ya, c + yb, yb, 0.3, [90, 90, 90]);
      } };
    rayar(Y0, 622.5); rayar(646.5, Y1);
    const linea = (ya, yb) => {
      if (modo !== 'zigzag') { L(x0, ya, x0, yb, 1.8, NEGRO); return; }
      const amp = 2.2, per = 6; let y = ya, lado = 1; const pts = [[x0, ya]];
      while (y + per / 2 < yb) { y += per / 2; pts.push([x0 + amp * lado, y]); lado = -lado; }
      pts.push([x0, yb]);
      for (let i = 1; i < pts.length; i++) L(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1.3, NEGRO);
    };
    linea(Y0, 622.5); linea(646.5, Y1);
  }
  function subCols(y1, y2) {
    for (let c = 0; c <= NSUB; c++) {
      const may = c % SPC === 0, medio = c % (SPC / 2) === 0;
      L(GX0 + c * SW, y1, GX0 + c * SW, y2, may ? 0.6 : medio ? 0.3 : 0.2, may ? NEGRO : medio ? [120, 120, 120] : [185, 185, 185]);
    }
  }
  function marca(s, x, y, c) {
    if (s === 'v') { L(x - 2.3, y - 3.3, x, y, 0.9, c); L(x, y, x + 2.3, y - 3.3, 0.9, c); }
    else if (s === '^') { L(x - 2.3, y + 3.3, x, y, 0.9, c); L(x, y, x + 2.3, y + 3.3, 0.9, c); }
    else if (s === 'o') { d.setDrawColor(...c); lw(0.6); d.setFillColor(255, 255, 255); d.circle(PX(x), PY(y), 1.7 * SX, 'FD'); }
    else { d.setFillColor(...c); d.circle(PX(x), PY(y), 1.7 * SX, 'F'); }
  }
  function off(to, hm) { const a = minDe(to.inicio), b = minDe(hm); if (!isFinite(a) || !isFinite(b)) return NaN; let x = b - a; if (x < -60) x += 1440; return x; }

  /* ---- técnica e inducción (2.0.1): bloque izquierdo y 622.5–838.5 ---- */
  const TEC_N = { sed: 'Sedación', gen: 'General', tiva: 'TIVA', reg: 'Regional', esp: 'Espinal', epi: 'Peridural', bloq: 'Bloqueo regional', local: 'Local' };
  const SED_N = { ansio: '(ansiólisis)', consc: 'consciente', prof: 'profunda' };
  function tecNombre(k, h) {
    const tc = h.tec || {};
    if (k === 'gen') return 'General' + ({ inh: ' inhalatoria', bal: ' balanceada' }[tc.genVia] || '');
    if (k === 'sed') return 'Sedación' + (SED_N[h.sedNivel] ? ' ' + SED_N[h.sedNivel] : '');
    if (k === 'esp') return 'Espinal (raquídea)';
    return TEC_N[k] || '';
  }
  function tecTexto(h) {
    const tc = (h && h.tec) || {}; const p = tc.p === 'reg' ? tc.regTipo || 'reg' : tc.p || ''; if (!p) return '';
    const A = tecNombre(p, h), c = tc.comb && tc.comb !== p ? tc.comb : '';
    const anest = (k, x) => (['gen', 'esp', 'epi', 'reg', 'local'].includes(k) ? 'Anestesia ' + x.charAt(0).toLowerCase() + x.slice(1) : k === 'tiva' ? 'TIVA (anestesia total intravenosa)' : x);
    if (!c) return anest(p, A);
    const B = tecNombre(c, h);
    if (c === 'sed' || c === 'local' || p === 'sed' || p === 'local') return anest(p, A) + ' + ' + B.charAt(0).toLowerCase() + B.slice(1);
    return 'Anestesia combinada: ' + A + ' + ' + B;
  }
  /* Texto y casillas en fila, midiendo el ancho real (evita que se monten) */
  function anchoTxt(s, size, b) { d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(size * FF); return d.getTextWidth(limpia(s)) / SX; }
  function Flujo(x, y, items, o = {}) {
    const size = o.size || 5.3, gap = o.gap == null ? 6 : o.gap;
    items.forEach((it) => {
      if (!it) return;
      if (it.t != null) { T(it.t, x, y, { b: it.b !== false, size: it.size || size }); x += anchoTxt(it.t, it.size || size, it.b !== false) + (it.gap == null ? 3 : it.gap); }
      else if (it.v != null) { const sz = it.size || 6.4, w = it.w || Math.max(10, anchoTxt(t(it.v), sz)); if (it.caja) Rc(x, y - 4.5, x + w, y + 4.5, { w: 0.5 }); V(it.v, it.caja ? x + w / 2 : x, y + 0.3, { size: sz, maxw: w - 1, align: it.caja ? 'center' : 'left' }); x += w + (it.gap == null ? gap : it.gap); }
      else { Opc(x + 3.5, y, it[0], it[1], { size, b: o.b }); x += 10.5 + anchoTxt(it[0], size, o.b) + gap; }
    });
    return x;
  }
  function TecInd(h) {
    const tc = h.tec || {}, I = h.ind || {}, pr = tc.p, c = tc.comb;
    const tiene = (k) => pr === k || c === k || (k === 'reg' && (c === 'esp' || c === 'epi'));
    Rc(FX1, 622.5, 268.5, 838.5, { w: 0.8 });
    Negro(FX1, 622.5, 98, 632); T('TÉCNICA', 68, 627.5, { b: true, size: 6.6, c: [255, 255, 255], align: 'center' });
    const cols = [44, 100, 192];
    [['sed', 'Sedación'], ['gen', 'General'], ['tiva', 'TIVA'], ['reg', 'Regional'], ['bloq', 'Bloqueo regional'], ['local', 'Local']].forEach(([k, e], i) => {
      Opc(cols[i % 3], 639 + Math.floor(i / 3) * 9.5, e, tiene(k), { b: true, size: 5.2 }); });
    const txt = tecTexto(h);
    if (txt) { d.setFont('helvetica', 'normal'); d.setFontSize(6.4 * FF); const ls = d.splitTextToSize(limpia(txt), 222 * SX).slice(0, 2); ls.forEach((l, i) => V(l, 42, 658 + i * 7.6, { size: 6.4, maxw: 222 })); }
    // Inducción
    L(FX1, 670.5, 268.5, 670.5, 0.8);
    Flujo(41, 677, [{ t: 'INDUCCIÓN:', size: 5.8, gap: 4 }, ['Intravenosa', I.tipo === 'iv'], ['Inhalatoria', I.tipo === 'inh'], ['Mixta', I.tipo === 'mixta']], { size: 5, b: true, gap: 4 });
    Flujo(60, 687, [{ t: 'Intravenosa:', b: false, size: 5.2, gap: 5 }, ['Estándar', I.tipo === 'iv' && I.ivTipo === 'est'], ['Secuencia rápida', I.tipo === 'iv' && I.ivTipo === 'sr']], { size: 5.2, gap: 8 });
    Negro(FX1, 693, 268.5, 702.5); T('Medicamentos de inducción:', 42, 698, { b: true, size: 6.4, c: [255, 255, 255] });
    const meds = I.meds || [];
    'ABCDEFGHIJ'.split('').forEach((l, i) => { const y = 709 + i * 12.7; T(l + '.', 42, y, { size: 4.8 }); V(meds[i], 51, y, { size: 6.8, maxw: 214 }); if (i < 9) L(50, y + 6.2, 266, y + 6.2, 0.15, GRIS); });
  }

  /* ---- Anestesia general y recién nacido (2.0.1): x 268.5–895, y 711.5–838.5 ---- */
  function Tecnica(h) {
    const va = h.va || {}, rz = va.razon || {}, rn = h.rn || {}, X = 272, XM = 760, ind = va.lar === 'ind';
    Rc(268.5, 711.5, FX2, 838.5, { w: 0.8 });
    Negro(268.5, 711.5, XM, 721); T('ANESTESIA GENERAL', 272, 716.4, { b: true, size: 6.6, c: [255, 255, 255] });
    Negro(XM, 711.5, FX2, 721); T('RECIÉN NACIDO (cesárea)', (XM + FX2) / 2, 716.4, { b: true, size: 5.8, c: [255, 255, 255], align: 'center' });
    L(XM, 711.5, XM, 838.5, 0.8);
    L(681, 838.5, 681, 999, 0.8); // divisor de la columna Mezcla / infusión (debajo)
    Flujo(X, 728, [{ t: 'Vía aérea:' }, ['TET oral', va.disp === 'oral'], ['TET nasal', va.disp === 'nasal'], ['Supraglótico:', va.disp === 'supra'],
      { v: va.disp === 'supra' ? [va.supraTipo, va.supraN && 'N° ' + va.supraN].filter(Boolean).join(' ') : '', w: 70, size: 6 },
      ['Mascarilla facial', va.disp === 'masc'], ['Otro:', va.disp === 'otro'], { v: va.disp === 'otro' ? va.dispOtro : '', w: 90, size: 6 }]);
    const IND = [['video', 'Videolaringoscopio'], ['airtraq', 'AirTraq'], ['glide', 'Glidescope'], ['fast', 'FastTrach'], ['fibro', 'Fibroscopio flexible'], ['otro', 'Otro']];
    Flujo(X, 736.5, [{ t: 'Laringoscopía:' }, ['Directa', va.lar === 'dir'], ['A ciegas', va.lar === 'ciegas'], ['Indirecta', ind], { t: '', gap: 30 },
      { t: 'Hoja N°', gap: 2 }, { v: va.hojaN || '', w: 14, size: 6.6 }, ['Recta', va.hoja === 'recta'], ['Curva', va.hoja === 'curva'], ['Hiperangulada', va.hoja === 'hiper']], { gap: 7 });
    Flujo(X, 745, [{ t: 'Indirecta con:' }].concat(IND.map(([k, e]) => [e, ind && va.ind === k]), [{ v: ind && va.ind === 'otro' ? va.indOtro : '', w: 70, size: 5.8 }]), { gap: 7 });
    Flujo(X, 753.5, [{ t: 'Razón:' }, ['Entrenamiento', !!rz.entren], ['Vía aérea difícil', !!rz.dificil]], { gap: 8 });
    L(268.5, 758, XM, 758, 0.3);
    if (ind) {
      Flujo(X, 764, [{ t: 'POGO:' }, { v: t(va.pogo) ? va.pogo + ' %' : '', w: 30 }]);
      const px = [278, 326, 374, 422, 470];
      ['0', '25', '50', '75', '100'].forEach((k, i) => { Img(window.IMGS['pogo' + k], px[i], 768, px[i] + 30, 795, { marco: true }); Opc(px[i] + 6, 800.5, k + '%', va.pogoCat === k, { size: 5.2 }); });
    } else {
      T('Cormack-Lehane:', X, 764, { b: true, size: 5.6 });
      const cx = [282, 342, 402, 462];
      ['I', 'II', 'III', 'IV'].forEach((r, i) => { Caja(cx[i], 780, va.cl === r); Img(window.IMGS['cl' + (i + 1)], cx[i] + 6, 768, cx[i] + 50, 797); T(r, cx[i], 791, { b: true, size: 6, align: 'center' }); });
    }
    const TX = 530; L(TX - 5, 758, TX - 5, 806, 0.3);
    Flujo(TX, 764, [{ t: 'TET N°', gap: 2 }, { v: va.tuboN || '', w: 18, size: 7 }, ['Simple', va.tubo === 'simple'], ['Armado', va.tubo === 'armado']]);
    Flujo(TX, 772.2, [['Preformado', va.tubo === 'preformado'], ['Selectivo', va.tubo === 'selectivo'], { v: va.tubo === 'selectivo' && va.lado ? (va.lado === 'D' ? 'Derecho' : 'Izquierdo') : '', w: 40, size: 6 }]);
    Flujo(TX, 780.4, [['Con manguito', va.manguito === 'con'], ['Sin manguito', va.manguito === 'sin'], { t: 'Aire', gap: 2 }, { v: va.aire || '', w: 16, caja: true, size: 6.2, gap: 2 }, { t: 'cc', b: false }]);
    Flujo(TX, 788.6, [{ t: 'Fijado a', gap: 2 }, { v: va.long || '', w: 16, caja: true, size: 6.2, gap: 2 }, { t: 'cm de la comisura labial', b: false, gap: 5 }, ['Izq', va.fijLado === 'I'], ['Der', va.fijLado === 'D']]);
    Flujo(TX, 797, [['Ruidos resp. simétricos', !!va.ruidos], ['EtCO2 +', !!va.etco2]], { gap: 8 });
    L(268.5, 806, XM, 806, 0.3);
    Flujo(X, 813, [{ t: 'Se conecta a sistema semicerrado:', gap: 6 }, ['Circular', va.sist === 'circ'], ['Lineal', va.sist === 'lin'], ['con reinhalación parcial de gases', !!va.reinh]], { size: 5.4, gap: 9 });
    // Recién nacido
    const RX = XM + 5, hm = minDe(rn.hora);
    const h12 = isFinite(hm) ? String(Math.floor(hm / 60) % 12 || 12).padStart(2, '0') + ':' + String(hm % 60).padStart(2, '0') : '';
    Flujo(RX, 729, [['Vivo', rn.estado === 'vivo'], ['Fallecido', rn.estado === 'fall']], { size: 5.4, gap: 9 });
    Flujo(RX, 739, [['Masculino', rn.sexo === 'M'], ['Femenino', rn.sexo === 'F']], { size: 5.4, gap: 7 });
    Flujo(RX, 750, [{ t: 'Hora:' }, { v: h12, w: 24 }, ['AM', isFinite(hm) && hm < 720], ['PM', isFinite(hm) && hm >= 720]], { size: 5.4, gap: 6 });
    Flujo(RX, 761, [{ t: 'APGAR', gap: 5 }, { t: "1':", b: false, gap: 2 }, { v: rn.apgar1 || '', w: 14 }, { t: "5':", b: false, gap: 2 }, { v: rn.apgar5 || '', w: 14 }], { size: 5.4 });
    Flujo(RX, 772, [{ t: 'Peso:' }, { v: rn.peso ? rn.peso + ' g' : '', w: 38 }, { t: 'Talla:' }, { v: rn.talla ? rn.talla + ' cm' : '', w: 34 }], { size: 5.4 });
    Flujo(RX, 784, [{ t: '¿Lloró al nacer?', gap: 4, size: 5.1 }, ['Sí', rn.lloro === 'si'], ['No', rn.lloro === 'no']], { size: 5.1, gap: 4 });
    Flujo(RX, 795, [{ t: '¿Respiró al nacer?', gap: 4, size: 5.1 }, ['Sí', rn.respiro === 'si'], ['No', rn.respiro === 'no']], { size: 5.1, gap: 4 });
  }

  /* ---- balance, ácido-base ---- */
  function Balance(h) {
    const b = h.bal || {}; const tot = b._tot || [];
    Negro(FX1, 838.5, 268.5, 848.5); T('BALANCE', 41, 843.8, { b: true, size: 6.4, c: [255, 255, 255] });
    const cols = [137.5, 170.5, 203.5, 236.5, 268.5];
    (b.cols || []).forEach((c, i) => T(c, (cols[i] + cols[i + 1]) / 2, 843.8, { size: 4.6, c: [255, 255, 255], align: 'center', maxw: 31 }));
    const RY = []; for (let i = 0; i <= 11; i++) RY.push(848.5 + i * 8.6);
    Negro(FX1, RY[0], 54, RY[5]); T('INGRESOS', 46.5, RY[5] - 4, { b: true, size: 4.6, c: [255, 255, 255], angle: 90 });
    Negro(FX1, RY[5], 54, RY[10]); T('EGRESOS', 46.5, RY[10] - 5, { b: true, size: 4.6, c: [255, 255, 255], angle: 90 });
    const F = [['cris', 'Cristaloides'], ['colo', 'Coloides'], ['hemo', 'Hemoderivados'], ['_si', 'Subtotal'], ['_ti', 'TOTAL INGRESOS'],
      ['pins', 'P.Ins / Mant / Ayuno'], ['sang', 'Sangramiento / P.Exp'], ['diur', 'Diuresis'], ['_se', 'Subtotal'], ['_te', 'TOTAL EGRESOS'], ['_bal', 'BALANCE (Ingresos - Egresos)']];
    const fm = (x) => (Math.round(x * 10) / 10).toString();
    F.forEach(([k, e], i) => {
      const yc = (RY[i] + RY[i + 1]) / 2 + 0.3;
      if (k === '_ti' || k === '_te' || k === '_bal') {
        const tv = k === '_ti' ? b._ti : k === '_te' ? b._te : b._bal;
        if (k === '_bal') { Negro(FX1, RY[i], 137.5, RY[i + 1]); T(e, 40, yc, { b: true, size: 4.7, c: [255, 255, 255], maxw: 96 }); }
        else { Rc(54, RY[i], 137.5, RY[i + 1], { fill: [225, 225, 225], w: 0.45 }); T(e, 57, yc, { b: true, size: 4.8 }); }
        Rc(137.5, RY[i], 268.5, RY[i + 1], { w: k === '_bal' ? 0.9 : 0.45 });
        if (b._hay && isFinite(tv)) {
          let txt = fm(tv) + ' ml';
          if (k === '_bal') txt = (tv > 0 ? '+' : '') + fm(tv) + ' ml  ' + (tv > 0 ? 'POSITIVO' : tv < 0 ? 'NEGATIVO' : 'NEUTRO');
          V(txt, 203, yc + 0.1, { size: k === '_bal' ? 5.6 : 5.3, align: 'center', b: true, c: k === '_bal' && tv < 0 ? ROJO : AZUL });
        }
        return;
      }
      if (k === '_si' || k === '_se') { Rc(95, RY[i], 137.5, RY[i + 1], { fill: [190, 190, 190], stroke: false }); T(e, 135.5, yc, { b: true, size: 4.8, c: [255, 255, 255], align: 'right' }); }
      else T(e, 57, yc, { b: true, size: 4.9, maxw: 79 });
      for (let c = 0; c < 4; c++) {
        Rc(cols[c], RY[i], cols[c + 1], RY[i + 1], { w: 0.45 });
        const cx = (cols[c] + cols[c + 1]) / 2; const tt = tot[c];
        let v = '';
        if (k === '_si') v = tt ? fm(tt.ing) : ''; else if (k === '_se') v = tt ? fm(tt.egr) : '';
        else v = (b[k] || [])[c];
        V(v, cx, yc + 0.1, { size: 5.3, align: 'center', maxw: 31, b: k.startsWith('_') });
      }
    });
    // ácido-base
    const ab = h.ab || {};
    const AY = RY[11], AH = (1008.5 - AY - 8.5) / 6;
    Negro(FX1, AY, 268.5, AY + 8.5); T('ÁCIDO-BASE', 40, AY + 4.5, { b: true, size: 5.4, c: [255, 255, 255] });
    d.setFont('helvetica', 'bold'); d.setFontSize(5.4 * FF); const finT = 40 + d.getTextWidth('ÁCIDO-BASE') / SX;
    const ac = [71.5, 104.5, 137.5, 170.5, 203.5, 236.5, 268.5];
    (ab.horas || []).forEach((hh, i) => { if (!hh) return; d.setFont('helvetica', 'normal'); d.setFontSize(4.4 * FF); const w = d.getTextWidth(hh) / SX;
      T(hh, Math.max(i === 0 ? finT + 2 : 0, (ac[i] + ac[i + 1]) / 2 - w / 2), AY + 4.5, { size: 4.4, c: [255, 255, 255] }); });
    const AF = [['ph', 'pH'], ['pco2', 'pCO2'], ['hco3', 'HCO3/EB'], ['po2', 'pO2'], ['nak', 'Na+ / K+'], ['lact', 'Lactato']];
    AF.forEach(([k, e], i) => {
      const y1 = AY + 8.5 + i * AH, y2 = y1 + AH, yc = (y1 + y2) / 2 + 0.3;
      Rc(FX1, y1, ac[0], y2, { w: 0.45 }); T(e, 40, yc, { b: true, size: 5.2, maxw: 31 });
      for (let c = 0; c < 6; c++) { Rc(ac[c], y1, ac[c + 1], y2, { w: 0.45 }); V((ab[k] || [])[c], (ac[c] + ac[c + 1]) / 2, yc + 0.1, { size: 6, align: 'center', maxw: 31 }); }
    });
  }

  /* ---- regional / conductiva / mezcla ---- */
  function Regional(h) {
    const r = h.reg || {}, c = h.cond || {};
    Rc(268.5, 838.5, 681, 999, { w: 0.8 });
    Negro(268.5, 838.5, 681, 848.5); T('Regional', 271, 843.8, { b: true, size: 6.6, c: [255, 255, 255] });
    Opc(277, 854, 'Intravenosa', !!r.iv); Opc(277, 864, 'Bloqueo:', !!r.bloqueo); L(320, 867.5, 620, 867.5, 0.5); V(r.bloqueoTxt, 322, 863.5, { size: 6.4, maxw: 300 });
    Opc(292, 874, 'Guiado por neuroestimulador', !!r.neuro); Opc(292, 884, 'Guiado por ultrasonografía', !!r.us);
    Negro(268.5, 889, 681, 898.5); T('Conductiva', 271, 894, { b: true, size: 6.6, c: [255, 255, 255] });
    Sub(275, 900, 335, 908, 'Técnica:'); Sub(352, 900, 414, 908, 'Tipo Aguja:'); Sub(432, 900, 498, 908, 'Nivel PL:'); Sub(510, 900, 575, 908, 'Nivel Bloqueo:');
    [['sub', 'Subaracnoidea'], ['epi', 'Epidural'], ['comb', 'Combinada']].forEach(([k, e], i) => Opc(277, 913 + i * 9.5, e, c.tec === k));
    [['quincke', 'Quincke'], ['whitacre', 'Whitacre'], ['tuohy', 'Tuohy']].forEach(([k, e], i) => Opc(356, 913 + i * 9.5, e, c.aguja === k));
    Rc(432, 908, 498, 918); V(c.nivelPL, 465, 913.3, { size: 6.4, align: 'center', maxw: 62 });
    Rc(510, 908, 575, 918); V(c.nivelBloq, 542.5, 913.3, { size: 6.4, align: 'center', maxw: 62 });
    Sub(275, 941, 335, 949, 'Posición:'); Opc(277, 954, 'Sentado', c.pos === 'sentado'); Opc(277, 963.5, 'Decúbito Lat', c.pos === 'decubito');
    Sub(352, 941, 414, 949, 'Aguja N°:'); Rc(352, 949, 414, 958); V(c.agujaN, 383, 953.8, { size: 6.4, align: 'center' });
    Sub(352, 960, 414, 968, 'Cateter N°:'); Rc(352, 968, 414, 977); V(c.cateterN, 383, 972.8, { size: 6.4, align: 'center' });
    Sub(432, 925, 498, 933, 'Bisel:');
    [['cef', 'Cefálico'], ['cau', 'Caudal'], ['ind', 'Indiferente']].forEach(([k, e], i) => Opc(437, 938 + i * 9.5, e, c.bisel === k));
    Sub(510, 925, 575, 933, 'Complicaciones:');
    Opc(515, 938, 'Punción Accidental Duramadre', !!c.punc); Opc(515, 947.5, 'Otras:', !!c.otras); V(c.otrasTxt, 540, 947.8, { size: 5.8, maxw: 138 });
    L(510, 953, 681, 953, 0.5); Sub(510, 953, 575, 961, 'Conducta:'); L(510, 953, 510, 999, 0.5);
    Parrafo(c.conducta, 513, 962, 678, 997, { size: 6 });
    Sub(275, 980, 335, 988, 'Limpieza:');
    Opc(277, 993, 'Asepsia', c.limpieza === 'asepsia'); Opc(356, 993, 'Antisepsia', c.limpieza === 'antisepsia');
    T('Con:', 420, 993.3, { size: 5.6 }); V(c.con, 435, 993.4, { size: 6.2, maxw: 72 });
    // Mezcla
    Rc(681, 838.5, FX2, 999, { w: 0.8 });
    Mezcla(h);
  }

  /* ---- mezcla / infusión de mantenimiento ---- */
  function Mezcla(h) {
    const X1 = 684, X2 = 892, Y1 = 850, Y2 = 996;
    T('MEZCLA / INFUSIÓN MANTENIMIENTO:', X1, 844, { b: true, size: 6 });
    const infs = (h.inf || []).filter((f) => f && (t(f.farm) || t(f.conc) || t(f.dosis)));
    const libre = t(h.mezcla).trim();
    // tamaño de letra que deje caber todo
    let sz = 7.4, y;
    const medir = (tam) => {
      let alto = 0; d.setFontSize(tam); d.setFont('helvetica', 'normal');
      infs.forEach((f) => {
        const det = [t(f.conc), t(f.dosis)].filter(Boolean).join(' · ');
        alto += tam * 1.2 + (det ? d.splitTextToSize(det, (X2 - X1 - 6) * SX).length * tam * 1.15 : 0) + 1.6;
      });
      if (libre) alto += d.splitTextToSize(libre, (X2 - X1) * SX).length * tam * 1.15 + 2;
      return alto / SY;
    };
    while (sz > 4.2 && medir(sz) > Y2 - Y1) sz -= 0.2;
    y = Y1;
    infs.forEach((f) => {
      if (y > Y2 - 4) return;
      const hr = [t(f.ini), t(f.fin)].filter(Boolean).join(' – ');
      V('• ' + (t(f.farm) || '—'), X1, y + sz * 0.6 / SY, { size: sz, fijo: true, b: true, maxw: hr ? 150 : 205, base: 'middle' });
      if (hr) V(hr, X2, y + sz * 0.6 / SY, { size: sz * 0.9, fijo: true, align: 'right' });
      y += sz * 1.2 / SY;
      const det = [t(f.conc), t(f.dosis)].filter(Boolean).join(' · ');
      if (det) {
        d.setFont('helvetica', 'normal'); d.setFontSize(sz); col(AZUL);
        const ls = d.splitTextToSize(det, (X2 - X1 - 6) * SX);
        d.text(ls, PX(X1 + 6), PY(y), { baseline: 'top', lineHeightFactor: 1.15 });
        y += (ls.length * sz * 1.15) / SY;
      }
      y += 1.6 / SY * 1.5;
    });
    if (libre) {
      if (infs.length) { L(X1, y + 0.5, X2, y + 0.5, 0.3, GRIS); y += 2; }
      Parrafo(libre, X1, y, X2, Y2, { size: sz / FF });
    }
  }

  /* ---- reversión, SAP, traslado, observaciones, firma ---- */
  function Final(h) {
    const rv = h.rev || {}, sp = h.sap || {}, tr = h.tras || {};
    Negro(335, 999, FX2, 1008.5); T('REVERSIÓN', 338, 1004, { b: true, size: 6.6, c: [255, 255, 255] });
    L(268.5, 1008.5, 335, 1008.5, 0.8);
    // Observaciones
    T('Observaciones/Nota:', 41, 1014.5, { b: true, i: true, size: 6.2 });
    L(335, 1008.5, 335, FY2, 0.5);
    Parrafo([h._labsObs, window.Obs ? Obs.texto(h) : t(h.obs)].filter((x) => t(x).trim()).join('\n'), 41, 1019, 332, 1107, { size: 7.6 });
    // Rel muscular
    Sub(338, 1010.5, 398, 1018.5, 'Rel Muscular');
    const dosis = (y, x1, x2, v) => { L(x1, y + 3.4, x2, y + 3.4, 0.5); V(v, (x1 + x2) / 2, y + 0.3, { size: 6.2, align: 'center', maxw: x2 - x1 + 2 }); };
    Opc(343, 1024, 'Neostigmina', !!rv.neo); dosis(1024, 418, 442, rv.neoD); T(rv.neoU || 'mg', 445, 1024.3, { size: 5.4 });
    Opc(343, 1034, 'Sugammadex', !!rv.sug); dosis(1034, 418, 442, rv.sugD); T(rv.sugU || 'mg', 445, 1034.3, { size: 5.4 });
    Opc(343, 1044, 'Atropina', !!rv.atro); dosis(1044, 418, 442, rv.atroD); T(rv.atroU || 'mg', 445, 1044.3, { size: 5.4 });
    Sub(468, 1010.5, 556, 1018.5, 'Opioides');
    Opc(472, 1024, 'Naloxona', !!rv.nalo, { size: 5.7, fijo: true }); dosis(1024, 523, 543, rv.naloD); T(rv.naloU || 'mcg', 546, 1024.3, { size: 5.4 });
    Sub(468, 1030, 556, 1038, 'Benzodiacepinas');
    Opc(472, 1044, 'Flumazenil', !!rv.flum, { size: 5.7, fijo: true }); dosis(1044, 523, 543, rv.flumD); T(rv.flumU || 'mg', 546, 1044.3, { size: 5.4 });
    Sub(568, 1010.5, 648, 1018.5, 'SAP');
    Opc(571, 1024, 'Intravenoso', !!sp.iv); Opc(571, 1034, 'Epidural', !!sp.epi); Opc(571, 1044, 'No lleva SAP / Razón:', !!sp.no, { size: 5.4 });
    V(sp.razon, 571, 1052, { size: 5.6, maxw: 112 });
    // Traslado
    Sub(338, 1057, 398, 1065, 'Traslado'); Sub(428, 1057, 470, 1065, 'Hora');
    Opc(343, 1070, 'INGRESO A UCPA', tr.dest === 'ucpa', { size: 5 }); Opc(343, 1080, 'INGRESO A UCI', tr.dest === 'uci', { size: 5 });
    const hr = ampm(tr.hora); const fila = tr.dest === 'uci' ? 1 : 0;
    [0, 1].forEach((f) => { const y = 1070.3 + f * 10; if (hr && f === fila) V(hr, 449, y, { size: 6.2, align: 'center' }); else T('am/pm', 458, y, { size: 5 }); });
    Opc(492, 1066, 'Monitor de traslado', !!tr.monitor, { size: 5.2 }); Opc(492, 1075.5, 'Oxigeno suplementario', !!tr.o2, { size: 5.2 }); Opc(492, 1085, 'Con intubación', !!tr.intub, { size: 5.2 });
    Sub(612, 1060, 680, 1068, 'Signos vitales');
    T('TA', 616, 1075, { b: true, size: 5.8 }); V(tr.ta, 646, 1075.2, { size: 6.4, maxw: 34 });
    T('FC', 616, 1085, { b: true, size: 5.8 }); V(tr.fc, 646, 1085.2, { size: 6.4, maxw: 44 });
    T('SpO2', 616, 1095, { b: true, size: 5.8 }); V(tr.spo2 ? tr.spo2 + ' %' : '', 646, 1095.2, { size: 6.4, maxw: 44 });
    Sub(338, 1099.5, 398, 1108, 'Recibe Dr(a):'); V(tr.recibe, 402, 1104, { size: 6.4, maxw: 190 });
    // Firma
    Rc(681, 1008.5, FX2, FY2, { w: 0.8 });
    Sub(681, 1009, 829, 1019, 'Firma y Sello:');
    // firma y sello escaneados (fondo transparente) y/o firma dibujada; si hay ambas, la dibujada va encima del escaneo
    if (h.firmaSello) Img(h.firmaSello, 686, 1021, 890, 1079);
    if (h.firma) Img(h.firma, h.firmaSello ? 740 : 700, 1030, h.firmaSello ? 880 : 876, 1078);
    const sl = t(h.sello).split('\n').filter((x) => x.trim()).slice(0, 3);
    if (sl.length) { L(705, 1079, 871, 1079, 0.4); sl.forEach((l, i) => V(l.trim(), 788, 1084 + i * 9, { size: 5.4, align: 'center', maxw: 200 })); }
  }

  let MARCA = {};
  function MarcaCentro(sede) {
    // Clínica: su logo muy tenue en el fondo de la grilla (solo historias hechas en esa clínica)
    if (sede && sede.clinica && sede.logo) { Opacidad(0.08); Img(sede.logo, 400, 250, 845, 610); Opacidad(1); return; }
    if (!MARCA.centro || !MARCA.negra) return;
    Opacidad(0.07); Img(MARCA.negra, 250, 380, 685, 820); Opacidad(1);
  }
  function generar(h, sede, perfil) {
    h = JSON.parse(JSON.stringify(h || {})); h.p = h.p || {}; h.to = h.to || {};
    if (window.Pistas) window.Pistas.asegurar(h);
    const pf = perfil || {};
    MARCA = { propio: pf.marcaOn !== false && pf.marcaBlanca ? pf.marcaBlanca : '', negra: pf.marcaNegra || window.IMGS.marcaNegra, op: pf.marcaOpacidad ? +pf.marcaOpacidad : 0.55, centro: !!pf.marcaCentro };
    const { jsPDF } = window.jspdf;
    d = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
    d.setProperties({ title: 'Historia de Anestesia - ' + (h.p.nombre || ''), creator: 'Morpheus MD' });
    d.setLineJoin('miter');
    const to = h.to || {};
    const offs = (to.regs || []).map((r) => off(to, r.hora)).filter(isFinite);
    ['ia', 'ic', 'fc', 'fa'].forEach((k) => { const o = off(to, (to.t || {})[k]); if (isFinite(o)) offs.push(o); });
    const paginas = Math.max(1, Math.ceil((Math.max(0, ...offs) + 1) / MINP));
    for (let pg = 0; pg < paginas; pg++) {
      if (pg > 0) d.addPage('letter', 'portrait');
      Rc(FX1, FY1, FX2, pg === 0 ? FY2 : 711.5, { w: 1.4 });
      Encabezado(h, sede, pg > 0 ? pg + 1 : 0);
      BloquePaciente(h);
      if (pg === 0) { Datos(h); Izquierda(h); }
      else {
        Rc(FX1, 124, 666.5, 207); T('Paciente:', 42, 135, { b: true, size: 6 }); V(h.p.nombre, 84, 135, { maxw: 570 });
        T('Continuación del registro transoperatorio desde las ' + (to.inicio ? hmMas(to.inicio, pg * MINP) : '—') + ' h.', 42, 150, { size: 6 });
        Rc(FX1, 207, 268.5, 711.5);
      }
      Grilla(h, pg * MINP);
      if (pg === 0) { Tecnica(h); Balance(h); Regional(h); Final(h); }
      MarcaCentro(sede);
      T('Página ' + (pg + 1) + ' de ' + paginas, FX2, 1118, { size: 5, c: GRIS, align: 'right' });
    }
    return d;
  }
  return { generar, tecTexto };
})();
