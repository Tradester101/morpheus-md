/* Almacenamiento: archivos de la app en Android (puente "Nativo") o localStorage en navegador. */
(function () {
  const N = window.Nativo;
  const leer = (k) => {
    try { return N ? N.leer(k) : localStorage.getItem('ha_' + k); } catch (e) { return null; }
  };
  const escribir = (k, v) => {
    try { if (N) N.escribir(k, v); else localStorage.setItem('ha_' + k, v); return true; }
    catch (e) { console.error(e); return false; }
  };
  const borrar = (k) => { try { if (N) N.borrar(k); else localStorage.removeItem('ha_' + k); } catch (e) {} };
  const json = (k, def) => { const t = leer(k); if (!t) return def; try { return JSON.parse(t); } catch (e) { return def; } };

  window.Store = {
    indice() { return json('indice.json', []); },
    cargar(id) { return json('h_' + id + '.json', null); },
    guardar(h) {
      h.modificado = Date.now();
      const ok = escribir('h_' + h.id + '.json', JSON.stringify(h));
      const idx = this.indice().filter((x) => x.id !== h.id);
      idx.push({
        id: h.id, nombre: h.p.nombre || '', ci: h.p.ci || '', fecha: h.p.fecha || '',
        interv: h.intervencion || h.dx || '', sede: h.sedeId || '', modificado: h.modificado,
      });
      escribir('indice.json', JSON.stringify(idx));
      return ok;
    },
    borrar(id) {
      borrar('h_' + id + '.json');
      escribir('indice.json', JSON.stringify(this.indice().filter((x) => x.id !== id)));
    },
    /* Documentos de Extras (valoración preanestésica, récipe) */
    docs() { return json('docs.json', []); },
    cargarDoc(id) { return json('d_' + id + '.json', null); },
    guardarDoc(x) {
      x.modificado = Date.now();
      const ok = escribir('d_' + x.id + '.json', JSON.stringify(x));
      const idx = this.docs().filter((y) => y.id !== x.id);
      idx.push({ id: x.id, tipo: x.tipo, nombre: (x.p && x.p.nombre) || '', ci: (x.p && x.p.ci) || '', fecha: x.fecha || '', det: x.tipo === 'val' ? (x.p && x.p.proc) || '' : ((x.items || []).map((i) => i.med).filter(Boolean)[0] || ''), modificado: x.modificado });
      escribir('docs.json', JSON.stringify(idx));
      return ok;
    },
    borrarDoc(id) { borrar('d_' + id + '.json'); escribir('docs.json', JSON.stringify(this.docs().filter((x) => x.id !== id))); },
    config() { return json('config.json', null); },
    guardarConfig(c) { return escribir('config.json', JSON.stringify(c)); },
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
