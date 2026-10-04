/* Almacenamiento: archivos de la app en Android (puente "Nativo") o localStorage en navegador. */
(function () {
  const N = window.Nativo;
  // 2.0: cada cuenta tiene su propio espacio (prefijo) en el dispositivo; '' = datos anteriores a las cuentas en línea.
  let pre = '';
  const leer0 = (k) => {
    try { return N ? N.leer(k) : localStorage.getItem('ha_' + k); } catch (e) { return null; }
  };
  const escribir0 = (k, v) => {
    try { if (N) N.escribir(k, v); else localStorage.setItem('ha_' + k, v); return true; }
    catch (e) { console.error(e); return false; }
  };
  const borrar0 = (k) => { try { if (N) N.borrar(k); else localStorage.removeItem('ha_' + k); } catch (e) {} };
  const leer = (k) => leer0(pre + k), escribir = (k, v) => escribir0(pre + k, v), borrar = (k) => borrar0(pre + k);
  let mudo = false; // true mientras se escriben datos que llegan de la nube (no se marcan como cambios)
  const aviso = (tipo, id, borrado) => { if (!mudo && window.Store.alCambiar) try { window.Store.alCambiar(tipo, id, borrado); } catch (e) { console.error(e); } };
  const json = (k, def) => { const t = leer(k); if (!t) return def; try { return JSON.parse(t); } catch (e) { return def; } };

  window.Store = {
    alCambiar: null,
    espacio() { return pre; },
    usarEspacio(p) { pre = p || ''; },
    sinAviso(f) { mudo = true; try { return f(); } finally { mudo = false; } },
    leerCrudo: leer, escribirCrudo: escribir,
    // Datos anteriores a las cuentas en línea (espacio vacío), para pasarlos a la cuenta
    legado() { const p0 = pre; pre = ''; try { const r = this.respaldo(); return r; } finally { pre = p0; } },
    indice() { return json('indice.json', []); },
    cargar(id) { return json('h_' + id + '.json', null); },
    guardar(h, conservar) {
      if (!conservar || !h.modificado) h.modificado = Date.now();
      const ok = escribir('h_' + h.id + '.json', JSON.stringify(h));
      const idx = this.indice().filter((x) => x.id !== h.id);
      idx.push({
        id: h.id, nombre: h.p.nombre || '', ci: h.p.ci || '', fecha: h.p.fecha || '',
        interv: h.intervencion || h.dx || '', sede: h.sedeId || '', modificado: h.modificado,
      });
      escribir('indice.json', JSON.stringify(idx));
      aviso('h', h.id);
      return ok;
    },
    borrar(id) {
      borrar('h_' + id + '.json');
      escribir('indice.json', JSON.stringify(this.indice().filter((x) => x.id !== id)));
      aviso('h', id, true);
    },
    /* Documentos de Extras (valoración preanestésica, récipe) */
    docs() { return json('docs.json', []); },
    cargarDoc(id) { return json('d_' + id + '.json', null); },
    guardarDoc(x, conservar) {
      if (!conservar || !x.modificado) x.modificado = Date.now();
      const ok = escribir('d_' + x.id + '.json', JSON.stringify(x));
      const idx = this.docs().filter((y) => y.id !== x.id);
      idx.push({ id: x.id, tipo: x.tipo, nombre: (x.p && x.p.nombre) || '', ci: (x.p && x.p.ci) || '', fecha: x.fecha || '', det: x.tipo === 'val' ? (x.p && x.p.proc) || '' : ((x.items || []).map((i) => i.med).filter(Boolean)[0] || ''), modificado: x.modificado });
      escribir('docs.json', JSON.stringify(idx));
      aviso('d', x.id);
      return ok;
    },
    borrarDoc(id) { borrar('d_' + id + '.json'); escribir('docs.json', JSON.stringify(this.docs().filter((x) => x.id !== id))); aviso('d', id, true); },
    config() { return json('config.json', null); },
    guardarConfig(c) { const ok = escribir('config.json', JSON.stringify(c)); aviso('c', 'config'); return ok; },
    // Borra del dispositivo todo lo del espacio actual (al cerrar sesión en un equipo compartido; todo queda en la nube)
    vaciarEspacio() {
      if (!pre) return;
      this.indice().forEach((x) => borrar('h_' + x.id + '.json')); this.docs().forEach((x) => borrar('d_' + x.id + '.json'));
      ['indice.json', 'docs.json', 'config.json', 'sync.json'].forEach(borrar);
    },
    respaldo() {
      const hs = this.indice().map((x) => this.cargar(x.id)).filter(Boolean);
      const ds = this.docs().map((x) => this.cargarDoc(x.id)).filter(Boolean);
      return { app: 'historia-anestesia', version: 1, fecha: new Date().toISOString(), config: this.config(), historias: hs, docs: ds };
    },
    restaurar(obj, reemplazarConfig) {
      if (!obj || obj.app !== 'historia-anestesia') throw new Error('El archivo no es un respaldo de esta app');
      let n = 0;
      (obj.historias || []).forEach((h) => { if (h && h.id) { this.guardar(h); n++; } });
      (obj.docs || []).forEach((x) => { if (x && x.id) this.guardarDoc(x); });
      if (obj.config) {
        const c = this.config();
        if (reemplazarConfig || !c) this.guardarConfig(obj.config);
        else {
          const ids = new Set(c.sedes.map((s) => s.id));
          (obj.config.sedes || []).forEach((s) => { if (!ids.has(s.id)) c.sedes.push(s); });
          this.guardarConfig(c);
        }
      }
      return n;
    },
  };
})();
