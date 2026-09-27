/* Visor de PDF dentro de la app (pdf.js): páginas en canvas, zoom con pellizco, doble toque y botones +/−. */
window.Visor = (function () {
  'use strict';
  let cargando = null;
  function cargarPdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (cargando) return cargando;
    cargando = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = 'lib/pdfjs/pdf.min.js';
      s.onload = () => { const L = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        if (!L) { mal(new Error('pdf.js no disponible')); return; }
        window.pdfjsLib = L; L.GlobalWorkerOptions.workerSrc = 'lib/pdfjs/pdf.worker.min.js'; ok(L); };
      s.onerror = () => { cargando = null; mal(new Error('No se pudo cargar el visor')); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  let actual = null;
  function cerrar() { if (!actual) return; actual.raiz.remove(); if (actual.doc) actual.doc.destroy(); actual = null; history.replaceState && 0; }

  /* opts: { bytes: Uint8Array, titulo, acciones: [{t, f}] } */
  async function abrir(opts) {
    cerrar();
    const raiz = document.createElement('div'); raiz.id = 'visor';
    raiz.innerHTML = `
      <div class="vs-barra">
        <button class="icono" id="vsCerrar" aria-label="Cerrar">&#8592;</button>
        <div class="vs-tit">${(opts.titulo || 'Vista previa').replace(/</g, '&lt;')}</div>
        <button class="icono" id="vsMenos" aria-label="Alejar">&minus;</button>
        <span id="vsZoom">100%</span>
        <button class="icono" id="vsMas" aria-label="Acercar">+</button>
      </div>
      <div class="vs-area" id="vsArea"><div class="vs-hojas" id="vsHojas"><div class="vs-cargando">Preparando vista previa…</div></div></div>
      <div class="vs-acciones" id="vsAcc"></div>`;
    document.body.appendChild(raiz);
    const area = raiz.querySelector('#vsArea'), hojas = raiz.querySelector('#vsHojas');
    const acc = raiz.querySelector('#vsAcc');
    (opts.acciones || []).forEach((a, i) => { const b = document.createElement('button'); b.className = i === 0 ? 'primario' : 'secundario'; b.innerHTML = a.t; b.onclick = a.f; acc.appendChild(b); });
    const st = actual = { raiz, doc: null, zoom: 1, paginas: [] };
    raiz.querySelector('#vsCerrar').onclick = cerrar;

    // --- zoom ---
    const ZMIN = 1, ZMAX = 5;
    function aplicar(z, cx, cy) {
      z = Math.max(ZMIN, Math.min(ZMAX, z));
      const r = area.getBoundingClientRect();
      if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
      const fx = (area.scrollLeft + cx) / hojas.offsetWidth, fy = (area.scrollTop + cy) / hojas.offsetHeight;
      st.zoom = z; hojas.style.width = (z * 100) + '%';
      area.scrollLeft = fx * hojas.offsetWidth - cx; area.scrollTop = fy * hojas.offsetHeight - cy;
      raiz.querySelector('#vsZoom').textContent = Math.round(z * 100) + '%';
      if (z > st.nitidez * 0.9) renderTodo(z);
    }
    raiz.querySelector('#vsMas').onclick = () => aplicar(st.zoom * 1.5);
    raiz.querySelector('#vsMenos').onclick = () => aplicar(st.zoom / 1.5);
    let t0 = 0, pin = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    area.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { const r = area.getBoundingClientRect(); pin = { d: dist(e.touches), z: st.zoom, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top }; e.preventDefault(); }
      else if (e.touches.length === 1) {
        const ahora = Date.now();
        if (ahora - t0 < 300) { const r = area.getBoundingClientRect(); aplicar(st.zoom > 1.2 ? 1 : 2.5, e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); e.preventDefault(); t0 = 0; }
        else t0 = ahora;
      }
    }, { passive: false });
    area.addEventListener('touchmove', (e) => { if (pin && e.touches.length === 2) { e.preventDefault(); aplicar(pin.z * dist(e.touches) / pin.d, pin.cx, pin.cy); } }, { passive: false });
    area.addEventListener('touchend', (e) => { if (e.touches.length < 2) pin = null; });
    area.addEventListener('dblclick', (e) => { const r = area.getBoundingClientRect(); aplicar(st.zoom > 1.2 ? 1 : 2.5, e.clientX - r.left, e.clientY - r.top); });
    area.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); const r = area.getBoundingClientRect(); aplicar(st.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

    // --- render ---
    let tRender = null;
    function renderTodo(z) {
      clearTimeout(tRender);
      tRender = setTimeout(async () => {
        const nit = Math.min(ZMAX, Math.max(1, z)); if (nit <= st.nitidez) return;
        st.nitidez = nit;
        for (const p of st.paginas) await pintar(p, nit);
      }, 250);
    }
    async function pintar(p, nit) {
      const dpr = window.devicePixelRatio || 1;
      const ancho = Math.min(4200, area.clientWidth * dpr * nit * 1.1);
      const base = p.pag.getViewport({ scale: 1 });
      const vp = p.pag.getViewport({ scale: ancho / base.width });
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
      await p.pag.render({ canvasContext: cx, viewport: vp }).promise;
      if (!actual || actual !== st) return;
      if (p.caja.style.paddingTop) { p.caja.style.position = 'relative'; c.style.position = 'absolute'; c.style.left = '0'; c.style.top = '0'; }
      p.caja.replaceChildren ? p.caja.replaceChildren(c) : (p.caja.innerHTML = '', p.caja.appendChild(c));
    }
    // Primer intento normal; si falla (p. ej. fuentes incrustadas en algunos WebView), se repite dibujando el texto como trazos.
    const cargar = async (sinFuentes) => {
      const L = await cargarPdfjs();
      if (st.doc) { try { st.doc.destroy(); } catch (e) { /* nada */ } }
      st.paginas = [];
      const doc = st.doc = await L.getDocument({ data: opts.bytes.slice(0), isEvalSupported: false, disableFontFace: !!sinFuentes, useSystemFonts: !sinFuentes }).promise;
      if (actual !== st) return;
      hojas.innerHTML = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const pag = await doc.getPage(i); const v = pag.getViewport({ scale: 1 });
        const caja = document.createElement('div'); caja.className = 'vs-hoja';
        caja.style.aspectRatio = v.width + ' / ' + v.height;
        if (!caja.style.aspectRatio) caja.style.paddingTop = (v.height / v.width * 100) + '%'; // WebView antiguos
        hojas.appendChild(caja); st.paginas.push({ pag, caja });
      }
      st.nitidez = 1.6;
      for (const p of st.paginas) await pintar(p, st.nitidez);
      raiz.dataset.listo = '1';
    };
    try { await Promise.race([cargar(false), new Promise((_, no) => setTimeout(() => no(new Error('tiempo agotado')), 12000))]); } catch (e1) {
      console.warn('Vista previa: reintento sin fuentes', e1);
      try { await cargar(true); } catch (e) {
        console.error(e);
        hojas.innerHTML = '<div class="vs-cargando">No se pudo mostrar la vista previa (' + (e.message || e) + ').<br>Puedes compartir, guardar o imprimir el PDF igualmente.</div>';
        raiz.dataset.listo = 'error';
      }
    }
  }
  return { abrir, cerrar, abierto: () => !!actual };
})();
