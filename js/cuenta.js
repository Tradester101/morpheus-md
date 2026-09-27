/* Cuenta local del médico: contraseña con hash SHA-256 + sal, código de recuperación y firma/sello escaneados. */
window.Cuenta = (function () {
  'use strict';
  // SHA-256 en JavaScript puro (funciona sin conexión y sin contexto seguro)
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = 2 ** 32; let result = '';
    const words = []; const bytes = unescape(encodeURIComponent(ascii)); const len = bytes.length * 8;
    const hash = [], k = []; let primeCounter = 0; const isComposite = {};
    for (let c = 2; primeCounter < 64; c++) {
      if (!isComposite[c]) {
        for (let i = 0; i < 313; i += c) isComposite[i] = c;
        hash[primeCounter] = (Math.pow(c, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
      }
    }
    let str = bytes + '\x80';
    while (str.length % 64 - 56) str += '\x00';
    for (let i = 0; i < str.length; i++) { const j = str.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((len / maxWord) | 0); words[words.length] = len;
    let H = hash.slice(0, 8);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16); const old = H; H = H.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2]; const a = H[0], e = H[4];
        const t1 = H[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & H[5]) ^ ((~e) & H[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & H[1]) ^ (a & H[2]) ^ (H[1] & H[2]));
        H = [(t1 + t2) | 0].concat(H); H[4] = (H[4] + t1) | 0;
      }
      for (let i = 0; i < 8; i++) H[i] = (H[i] + old[i]) | 0;
    }
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (H[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    return result;
  }
  const azar = (n) => { const a = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256)); return Array.from(a); };
  const sal = () => azar(12).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hash = (clave, s) => sha256(s + '|' + clave);
  function codigoRecuperacion() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const c = azar(10).map((b) => abc[b % abc.length]).join('');
    return c.slice(0, 5) + '-' + c.slice(5);
  }
  function crear(usuario, clave) {
    const s = sal(), cod = codigoRecuperacion();
    return { cuenta: { usuario: usuario.trim().toLowerCase(), sal: s, hash: hash(clave, s), rec: hash(cod.replace('-', '').toUpperCase(), s), pedirClave: true, creado: Date.now() }, codigo: cod };
  }
  const verificar = (c, usuario, clave) => !!c && c.usuario === String(usuario || '').trim().toLowerCase() && c.hash === hash(clave, c.sal);
  const verificarCodigo = (c, cod) => !!c && c.rec === hash(String(cod || '').replace(/[\s-]/g, '').toUpperCase(), c.sal);
  function cambiarClave(c, clave) { c.sal = c.sal || sal(); const cod = codigoRecuperacion(); c.hash = hash(clave, c.sal); c.rec = hash(cod.replace('-', ''), c.sal); return cod; }

  /* Firma y sello escaneados: quita el fondo claro (papel) y conserva el color de la tinta. */
  function procesarFirma(archivo) {
    return new Promise((ok, mal) => {
      const r = new FileReader(); r.onerror = mal;
      r.onload = () => { const im = new Image(); im.onerror = mal; im.onload = () => {
        const k = Math.min(1, 1400 / Math.max(im.width, im.height));
        const W = Math.round(im.width * k), Hh = Math.round(im.height * k);
        const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
        x.drawImage(im, 0, 0, W, Hh);
        const id = x.getImageData(0, 0, W, Hh), px = id.data;
        // nivel de papel: brillo típico del borde
        let suma = 0, nb = 0; const lum = (i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        for (let i = 0; i < W; i += 3) { suma += lum(i * 4) + lum(((Hh - 1) * W + i) * 4); nb += 2; }
        const papel = Math.max(150, suma / nb);
        let a = W, b = Hh, cc = 0, e = 0;
        for (let y = 0; y < Hh; y++) for (let xx = 0; xx < W; xx++) {
          const i = (y * W + xx) * 4; const l = lum(i);
          const tinta = Math.max(0, Math.min(1, (papel - 12 - l) / (papel * 0.45)));
          px[i + 3] = Math.round(255 * tinta * (px[i + 3] / 255));
          if (px[i + 3] > 40) { if (xx < a) a = xx; if (xx > cc) cc = xx; if (y < b) b = y; if (y > e) e = y; }
        }
        x.putImageData(id, 0, 0);
        if (cc <= a || e <= b) { mal(new Error('No se encontró la firma en la imagen')); return; }
        const m = 8; a = Math.max(0, a - m); b = Math.max(0, b - m); cc = Math.min(W - 1, cc + m); e = Math.min(Hh - 1, e + m);
        const o = document.createElement('canvas'); o.width = cc - a + 1; o.height = e - b + 1;
        o.getContext('2d').drawImage(c, a, b, o.width, o.height, 0, 0, o.width, o.height);
        ok(o.toDataURL('image/png'));
      }; im.src = r.result; };
      r.readAsDataURL(archivo);
    });
  }
  function componerSello(p) {
    if (!p) return '';
    const l = [];
    if (p.nombre) l.push(p.nombre);
    if (p.especialidad) l.push(p.especialidad);
    const ids = [p.colegio ? (p.colegioSigla || 'C.M.') + ' ' + p.colegio : '', p.mpps ? 'MPPS ' + p.mpps : '', p.ci ? 'CI ' + p.ci : ''].filter(Boolean);
    if (ids.length) l.push(ids.join(' · '));
    return l.join('\n');
  }
  return { sha256, crear, verificar, verificarCodigo, cambiarClave, procesarFirma, componerSello };
})();
