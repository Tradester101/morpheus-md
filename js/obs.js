/* Observaciones / Nota: textos armados con opciones (tiempos, consumo, escalas de salida y frases estándar) + texto libre. */
window.Obs = (function () {
  'use strict';
  const ESCALAS = [
    { k: 'glasgow', t: 'Glasgow', max: 15, ops: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((v) => [String(v), String(v)]) },
    { k: 'ramsay', t: 'Ramsay', ops: [['1', '1 · Ansioso, agitado'], ['2', '2 · Cooperador, orientado, tranquilo'], ['3', '3 · Responde solo a órdenes'],
      ['4', '4 · Dormido, respuesta rápida'], ['5', '5 · Dormido, respuesta lenta'], ['6', '6 · Sin respuesta']] },
    { k: 'rass', t: 'RASS', ops: [['+4', '+4 · Combativo'], ['+3', '+3 · Muy agitado'], ['+2', '+2 · Agitado'], ['+1', '+1 · Inquieto'], ['0', '0 · Alerta y tranquilo'],
      ['-1', '−1 · Somnoliento'], ['-2', '−2 · Sedación leve'], ['-3', '−3 · Sedación moderada'], ['-4', '−4 · Sedación profunda'], ['-5', '−5 · No despertable']] },
    { k: 'bromage', t: 'Bromage', ops: [['0', '0 · Sin bloqueo motor'], ['1', '1 · No eleva la pierna extendida'], ['2', '2 · No flexiona rodillas'], ['3', '3 · No mueve pies ni rodillas']] },
    { k: 'aldrete', t: 'Aldrete', max: 10, ops: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((v) => [String(v), String(v)]) },
    { k: 'eva', t: 'EVA (dolor)', max: 10, ops: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => [String(v), String(v)]) },
  ];
  // Grupos de frases: los de "uno" permiten una sola opción; "varios", varias.
  const GRUPOS = [
    { k: 'dest', t: 'Traslado', uno: true, ops: [['ucpa', 'UCPA / Recuperación'], ['uci', 'UCI'], ['hosp', 'Hospitalización'], ['casa', 'Alta a domicilio']] },
    { k: 'cond', t: 'Condición', uno: true, ops: [['estable', 'Estable'], ['inestable', 'Inestable']] },
    { k: 'sc', t: 'Complicaciones', uno: true, ops: [['sc', 'S/C (sin complicaciones)']] },
    { k: 'va', t: 'Vía aérea', uno: true, ops: [['ext', 'Extubado/a S/C'], ['int', 'Intubado/a'], ['sga', 'Retiro de supraglótico S/C'], ['esp', 'Ventilación espontánea']] },
    { k: 'hemo', t: 'Hemodinamia', uno: true, ops: [['est', 'Hemodinámicamente estable'], ['inest', 'Hemodinámicamente inestable'], ['vaso', 'Con soporte vasoactivo']] },
    { k: 'otros', t: 'Otros', uno: false, ops: [['desp', 'Despierto/a y orientado/a'], ['o2', 'Con O2 suplementario'], ['nv', 'Sin náuseas ni vómitos'], ['dolor', 'Sin dolor']] },
  ];
  const DEST = { ucpa: 'UCPA/Recuperación', uci: 'UCI', hosp: 'hospitalización', casa: 'domicilio' };

  const minDe = (hm) => { if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return NaN; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  function dur(a, b) {
    const x = minDe(a), y = minDe(b); if (!isFinite(x) || !isFinite(y)) return '';
    let m = y - x; if (m < 0) m += 1440;
    return ' (' + (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min') + ')';
  }
  function opc(h) { h.obsOpc = h.obsOpc || {}; const o = h.obsOpc; o.esc = o.esc || {}; o.fr = o.fr || {}; return o; }
  // "Extubado/a" → según el sexo del paciente
  function genero(s, sexo) { return sexo === 'F' ? s.replace(/o\/a\b/g, 'a') : sexo === 'M' ? s.replace(/o\/a\b/g, 'o') : s; }

  function lineas(h) {
    const o = opc(h), out = [];
    const tt = (h.to || {}).t || {};
    if (o.tiempos !== false) {
      const p = [];
      if (tt.ia || tt.fa) p.push('Anestesia ' + (tt.ia || '—') + '–' + (tt.fa || '—') + dur(tt.ia, tt.fa));
      if (tt.ic || tt.fc) p.push('Cirugía ' + (tt.ic || '—') + '–' + (tt.fc || '—') + dur(tt.ic, tt.fc));
      if (p.length) out.push(p.join(' · '));
    }
    if (o.consumo !== false && window.Pistas) {
      const c = Pistas.consumo(h);
      if (c && c.ml > 0) out.push('Consumo de ' + c.agente + ': ' + (c.ml < 10 ? Pistas.r1(c.ml, 1) : Math.round(c.ml)) + ' mL');
    }
    const es = ESCALAS.filter((e) => o.esc[e.k] !== undefined && o.esc[e.k] !== '').map((e) => e.t + ' ' + o.esc[e.k] + (e.max ? '/' + e.max : ''));
    if (es.length) out.push('Salida: ' + es.join(' · '));
    const f = o.fr, sexo = (h.p || {}).sexo, fr = [];
    if (f.dest) fr.push('Se traslada paciente a ' + DEST[f.dest] + (f.cond ? ' ' + f.cond : '') + (f.sc ? ' S/C' : ''));
    else { if (f.cond) fr.push('Paciente ' + f.cond); if (f.sc && !f.cond) fr.push('Sin complicaciones'); else if (f.sc) fr[fr.length - 1] += ' S/C'; }
    GRUPOS.filter((g) => ['va', 'hemo', 'otros'].includes(g.k)).forEach((g) => g.ops.forEach(([k, e]) => {
      const sel = g.uno ? f[g.k] === k : (f[g.k] || []).includes(k);
      if (sel) fr.push(genero(e, sexo));
    }));
    if (fr.length) out.push(fr.join('. ') + '.');
    return out;
  }
  function texto(h) { const l = lineas(h); const libre = String(h.obs || '').trim(); return l.concat(libre ? [libre] : []).join('\n'); }
  return { ESCALAS, GRUPOS, lineas, texto, opc };
})();
