/* Morpheus MD 2.0 — cuentas en línea (Supabase), suscripción y sincronización de historias y documentos.
   La app sigue funcionando sin internet: guarda en el dispositivo y sube los cambios cuando hay conexión. */
window.Nube = (function () {
  'use strict';
  const CFG = window.NUBE_CONFIG || {};
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  const PRUEBA = /[?&]nube=prueba/.test(location.search) || ls.get('morpheus-nube-prueba') === '1';
  if (/[?&]nube=prueba/.test(location.search)) ls.set('morpheus-nube-prueba', '1');
  let sb = null, usuario = null, alRecuperar = null, alConfig = null, alCambioUsuario = null;

  /* ---------- Servidor de prueba (solo para pruebas automáticas y demostraciones: ?nube=prueba) ---------- */
  function clientePrueba() {
    const K = 'morpheus-nube-prueba-db';
    const db = () => JSON.parse(ls.get(K) || '{"users":{},"subs":{},"pagos":[],"historias":[],"documentos":[],"configuracion":[],"seq":0}');
    const save = (d) => ls.set(K, JSON.stringify(d));
    const SES = 'morpheus-nube-prueba-sesion';
    const ahora = () => new Date().toISOString();
    const yo = () => { const s = JSON.parse(ls.get(SES) || 'null'); return s && s.user; };
    const err = (m) => ({ data: null, error: { message: m } });
    const subsDe = (d, id) => d.subs[id];
    const estadoJson = (d, id) => { const s = subsDe(d, id); const venc = Date.parse(s.vence) <= Date.now(); return { ahora: ahora(), estado: venc ? 'vencida' : s.estado, plan: s.plan, canal: s.canal, vence: s.vence, dias: Math.max(0, Math.ceil((Date.parse(s.vence) - Date.now()) / 864e5)), admin: !!d.users[Object.keys(d.users).find((c) => d.users[c].id === id)].admin }; };
    const esAdmin = (d) => { const u = yo(); return !!(u && Object.values(d.users).find((x) => x.id === u.id && x.admin)); };
    const listeners = [];
    function tabla(nombre) {
      let filtros = [], orden = null, lim = 1000, sel = '*';
      const q = {
        select(c) { sel = c || '*'; return q; },
        eq(c, v) { filtros.push((r) => r[c] === v); return q; },
        gt(c, v) { filtros.push((r) => r[c] > v); return q; },
        order(c, o) { orden = [c, !o || o.ascending !== false]; return q; },
        limit(n) { lim = n; return q; },
        maybeSingle() { return q.then((r) => ({ data: (r.data || [])[0] || null, error: r.error })); },
        then(ok, mal) {
          const d = db(), u = yo(); if (!u) return Promise.resolve(err('sin sesión')).then(ok, mal);
          let rows = d[nombre].filter((r) => (nombre === 'pagos' && esAdmin(d)) || r.user_id === u.id);
          filtros.forEach((f) => (rows = rows.filter(f)));
          if (orden) rows.sort((a, b) => (a[orden[0]] < b[orden[0]] ? -1 : 1) * (orden[1] ? 1 : -1));
          return Promise.resolve({ data: rows.slice(0, lim).map((r) => JSON.parse(JSON.stringify(r))), error: null }).then(ok, mal);
        },
        upsert(rows) {
          const d = db(), u = yo(); if (!u) return Promise.resolve(err('sin sesión'));
          (Array.isArray(rows) ? rows : [rows]).forEach((r) => {
            if (r.user_id !== u.id) return; const t = d[nombre];
            const i = t.findIndex((x) => x.user_id === r.user_id && (nombre === 'configuracion' || x.id === r.id));
            const fila = Object.assign({}, r, { actualizado: ahora() }); if (i >= 0) t[i] = Object.assign(t[i], fila); else t.push(fila);
          });
          save(d); return Promise.resolve({ data: null, error: null });
        },
        insert(r) {
          const d = db(), u = yo(); if (!u || r.user_id !== u.id) return Promise.resolve(err('permiso'));
          d.seq++; d[nombre].push(Object.assign({ id: d.seq, estado: 'pendiente', creado: ahora() }, r)); save(d); return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    }
    const storage = {
      from: () => ({
        async upload(path, blob) {
          const u = yo(); if (!u || path.split('/')[0] !== u.id) return err('new row violates row-level security policy');
          const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
          const d = db(); d.archivos = d.archivos || {}; if (d.archivos[path]) return err('The resource already exists'); d.archivos[path] = url; save(d); return { data: { path }, error: null };
        },
        async createSignedUrl(path) {
          const d = db(), u = yo(); if (!u || !(d.archivos || {})[path] || (path.split('/')[0] !== u.id && !esAdmin(d))) return err('Object not found');
          return { data: { signedUrl: d.archivos[path] }, error: null };
        },
      }),
    };
    return {
      storage,
      auth: {
        async signUp({ email, password, options }) {
          const d = db(); if (d.users[email]) return err('User already registered');
          const id = 'u' + Math.random().toString(16).slice(2, 10) + '-0000-4000-8000-000000000000';
          d.users[email] = { id, password, nombre: (options && options.data && options.data.nombre) || '', admin: !Object.keys(d.users).length, creado: ahora() };
          d.subs[id] = { estado: 'prueba', plan: 'prueba', canal: 'prueba', inicio: ahora(), vence: new Date(Date.now() + 7 * 864e5).toISOString() };
          save(d); return { data: { user: { id, email }, session: null }, error: null };
        },
        async signInWithPassword({ email, password }) {
          const u = db().users[email]; if (!u || u.password !== password) return err('Invalid login credentials');
          const user = { id: u.id, email }; ls.set(SES, JSON.stringify({ user })); listeners.forEach((f) => f('SIGNED_IN', { user })); return { data: { user, session: { user } }, error: null };
        },
        async signOut() { ls.del(SES); listeners.forEach((f) => f('SIGNED_OUT', null)); return { error: null }; },
        async getSession() { const u = yo(); return { data: { session: u ? { user: u } : null }, error: null }; },
        onAuthStateChange(f) { listeners.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
        async resetPasswordForEmail() { return { data: {}, error: null }; },
        async updateUser({ password }) { const d = db(), u = yo(); const c = Object.keys(d.users).find((k) => d.users[k].id === u.id); d.users[c].password = password; save(d); return { data: {}, error: null }; },
      },
      from: tabla,
      async rpc(fn, a) {
        const d = db(), u = yo(); if (!u) return err('permission denied');
        if (fn === 'mi_estado') return { data: estadoJson(d, u.id), error: null };
        if (fn === 'ajustes') return { data: d.ajustes || null, error: null };
        if (!esAdmin(d) && fn !== 'borrar_mi_cuenta') return err('Solo administradores');
        if (fn === 'revisar_pago') {
          const p = d.pagos.find((x) => x.id === a.p_id); if (!p || p.estado !== 'pendiente') return err('Ese pago ya fue revisado');
          p.estado = a.p_aprobar ? 'aprobado' : 'rechazado';
          if (a.p_aprobar) { const s = d.subs[p.user_id]; const base = Math.max(Date.parse(s.vence), Date.now()); Object.assign(s, { estado: 'activa', plan: p.plan, canal: p.canal, vence: new Date(base + (p.plan === 'anual' ? 365 : 30) * 864e5).toISOString() }); }
          save(d); return { data: {}, error: null };
        }
        if (fn === 'admin_usuarios') return { data: Object.keys(d.users).map((c) => { const x = d.users[c], s = d.subs[x.id]; return { user_id: x.id, correo: c, nombre: x.nombre, creado: x.creado, estado: Date.parse(s.vence) <= Date.now() ? 'vencida' : s.estado, plan: s.plan, canal: s.canal, vence: s.vence }; }), error: null };
        if (fn === 'admin_extender') { const s = d.subs[a.p_user]; Object.assign(s, { estado: 'activa', canal: 'manual', plan: ['mensual', 'anual', 'clinica'].includes(a.p_plan) ? a.p_plan : s.plan, vence: new Date(Math.max(Date.parse(s.vence), Date.now()) + a.p_dias * 864e5).toISOString() }); save(d); return { data: {}, error: null }; }
        if (fn === 'admin_guardar_ajustes') { d.ajustes = a.p_datos; save(d); return { data: d.ajustes, error: null }; }
        if (fn === 'borrar_mi_cuenta') { const c = Object.keys(d.users).find((k) => d.users[k].id === u.id); delete d.users[c]; save(d); return { data: null, error: null }; }
        return err('función desconocida');
      },
    };
  }

  /* ---------- Cliente ---------- */
  const compartido = () => ls.get('morpheus-compartido') === '1';
  function crearCliente() {
    if (PRUEBA) { sb = clientePrueba(); return; }
    if (!CFG.url || !CFG.key || !window.supabase) { sb = null; return; }
    sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'morpheus-sesion', storage: compartido() ? window.sessionStorage : window.localStorage } });
  }
  const disponible = () => !!sb;
  const MSJ = [
    [/pagos_registro_completo/i, 'Faltan datos del pago: referencia, datos del remitente y captura.'],
    [/Bucket not found/i, 'Falta activar el almacenamiento de comprobantes en el servidor. Avísale al administrador.'],
    [/exceeded the maximum allowed size|Payload too large/i, 'La captura es demasiado grande. Prueba con otra imagen.'],
    [/mime type .* is not supported|invalid_mime_type/i, 'Ese archivo no es una imagen válida. Sube una captura (JPG o PNG).'],
    [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/Email not confirmed/i, 'Todavía no confirmas tu correo: abre el enlace que te enviamos (revisa también spam).'],
    [/already registered|already been registered/i, 'Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.'],
    [/Password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/Unable to validate email|invalid format|valid email/i, 'Revisa el correo: el formato no es válido.'],
    [/security purposes|rate limit|too many/i, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'],
    [/Failed to fetch|NetworkError|network|Load failed/i, 'Sin conexión a internet. Revisa tu conexión y vuelve a intentar.'],
    [/permission denied|JWT|not authorized/i, 'Tu sesión venció. Vuelve a iniciar sesión.'],
  ];
  const traducir = (e) => { const m = (e && (e.message || e.error_description || e)) + ''; const t = MSJ.find(([r]) => r.test(m)); return t ? t[1] : m; };
  const falla = (e) => { const x = new Error(traducir(e)); x.original = e; return x; };

  async function iniciar(cb) {
    alRecuperar = cb && cb.recuperar; alConfig = cb && cb.config; alCambioUsuario = cb && cb.usuario;
    crearCliente(); if (!sb) return null;
    try {
      escuchar();
      const { data } = await sb.auth.getSession();
      const s = data && data.session; usuario = s && s.user ? { id: s.user.id, correo: s.user.email } : null;
    } catch (e) { console.error(e); }
    return usuario;
  }
  function escuchar() {
    try {
      sb.auth.onAuthStateChange((ev, ses) => {
        const u = ses && ses.user ? { id: ses.user.id, correo: ses.user.email } : null;
        if (ev === 'PASSWORD_RECOVERY' && alRecuperar) alRecuperar();
        if (ev === 'SIGNED_OUT') { usuario = null; if (alCambioUsuario) alCambioUsuario(null); }
        else if (u && (!usuario || usuario.id !== u.id)) { usuario = u; if (alCambioUsuario) alCambioUsuario(u); }
      });
    } catch (e) { console.error(e); }
  }
  async function registrar(correo, clave, nombre) {
    const { data, error } = await sb.auth.signUp({ email: correo.trim(), password: clave, options: { data: { nombre }, emailRedirectTo: location.origin.startsWith('http') && !/appassets/.test(location.host) ? location.origin + location.pathname : 'https://morpheus-md.vercel.app/' } });
    if (error) throw falla(error);
    if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw falla('already registered');
    return { confirmar: !(data && data.session) };
  }
  async function entrar(correo, clave, esCompartido) {
    if (!!esCompartido !== compartido()) { ls.set('morpheus-compartido', esCompartido ? '1' : '0'); crearCliente(); escuchar(); }
    const { data, error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error) throw falla(error);
    usuario = { id: data.user.id, correo: data.user.email };
    return usuario;
  }
  async function salir() {
    try { await sincronizar(); } catch (e) {}
    if (compartido()) window.Store.vaciarEspacio();
    try { await sb.auth.signOut(); } catch (e) {}
    usuario = null;
  }
  async function recuperar(correo) {
    const { error } = await sb.auth.resetPasswordForEmail(correo.trim(), { redirectTo: 'https://morpheus-md.vercel.app/' });
    if (error) throw falla(error);
  }
  async function nuevaClave(clave) { const { error } = await sb.auth.updateUser({ password: clave }); if (error) throw falla(error); }

  /* ---------- Suscripción ---------- */
  const kLic = () => 'morpheus-lic-' + (usuario ? usuario.id : '');
  function efectivo(c) {
    if (!c) return null;
    const ahora = Date.now() + (c.desfase || 0);
    const sinRevisar = Date.now() - c.chequeado > 14 * 864e5; // sin internet por más de 14 días: hay que conectarse
    const vigente = c.vence > ahora && c.estado !== 'vencida' && c.estado !== 'cancelada';
    return Object.assign({}, c, { activa: vigente && !sinRevisar, dias: Math.max(0, Math.ceil((c.vence - ahora) / 864e5)), requiereConexion: sinRevisar });
  }
  async function estado(forzar) {
    if (!usuario || !sb) return null;
    let c = null; try { c = JSON.parse(ls.get(kLic()) || 'null'); } catch (e) {}
    if (forzar || !c || Date.now() - c.chequeado > 10 * 60e3) {
      try {
        const { data, error } = await sb.rpc('mi_estado'); if (error) throw error;
        if (data) { c = { estado: data.estado, plan: data.plan, canal: data.canal, vence: Date.parse(data.vence), admin: !!data.admin, desfase: Date.parse(data.ahora) - Date.now(), chequeado: Date.now() }; ls.set(kLic(), JSON.stringify(c)); }
      } catch (e) { if (c) c.offline = true; else return { estado: 'desconocido', activa: false, offline: true, error: traducir(e) }; }
    }
    return efectivo(c);
  }
  const estadoCache = () => { try { return efectivo(JSON.parse(ls.get(kLic()) || 'null')); } catch (e) { return null; } };
  /* Reporte de pago: primero se sube el comprobante (carpeta del usuario, privada), luego el registro. */
  async function reportarPago(p) {
    if (!p.archivo) throw new Error('Falta la captura del pago');
    const ruta = usuario.id + '/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
    const sub = await sb.storage.from('comprobantes').upload(ruta, p.archivo, { contentType: p.archivo.type || 'image/jpeg', upsert: false });
    if (sub.error) throw falla(sub.error);
    const { error } = await sb.from('pagos').insert({ user_id: usuario.id, plan: p.plan, canal: p.canal, monto: p.monto || null, moneda: p.moneda || 'USD', referencia: p.referencia, nota: p.nota || '', remitente: p.remitente || {}, comprobante: ruta });
    if (error) throw falla(error);
  }
  async function verComprobante(ruta) { const { data, error } = await sb.storage.from('comprobantes').createSignedUrl(ruta, 600); if (error) throw falla(error); return data.signedUrl; }
  /* Precios y datos de cobro: los define el administrador en Supabase (tabla ajustes); sin conexión se usa la última copia. */
  const K_AJ = 'morpheus-ajustes';
  const ajustesCache = () => { try { return JSON.parse(ls.get(K_AJ) || 'null'); } catch (e) { return null; } };
  async function ajustes() { const { data, error } = await sb.rpc('ajustes'); if (error) throw falla(error); if (data) ls.set(K_AJ, JSON.stringify(data)); return data; }
  async function admAjustes(datos) { const { data, error } = await sb.rpc('admin_guardar_ajustes', { p_datos: datos }); if (error) throw falla(error); ls.set(K_AJ, JSON.stringify(data || datos)); return data; }
  async function misPagos() { const { data, error } = await sb.from('pagos').select('*').eq('user_id', usuario.id).order('creado', { ascending: false }).limit(20); if (error) throw falla(error); return data || []; }

  /* ---------- Administrador ---------- */
  async function admPagos() { const { data, error } = await sb.from('pagos').select('*').order('creado', { ascending: false }).limit(200); if (error) throw falla(error); return data || []; }
  async function admRevisar(id, ok) { const { error } = await sb.rpc('revisar_pago', { p_id: id, p_aprobar: !!ok }); if (error) throw falla(error); }
  async function admUsuarios() { const { data, error } = await sb.rpc('admin_usuarios'); if (error) throw falla(error); return data || []; }
  async function admExtender(uid, dias, plan) { const { error } = await sb.rpc('admin_extender', { p_user: uid, p_dias: dias, p_plan: plan || 'manual' }); if (error) throw falla(error); }
  async function borrarCuenta() { const { error } = await sb.rpc('borrar_mi_cuenta'); if (error) throw falla(error); window.Store.vaciarEspacio(); try { await sb.auth.signOut(); } catch (e) {} usuario = null; }

  /* ---------- Sincronización ---------- */
  const META = 'sync.json';
  const meta = () => { try { return Object.assign({ pull: {}, sucio: { h: {}, d: {}, c: false }, borr: { h: {}, d: {} } }, JSON.parse(window.Store.leerCrudo(META) || 'null') || {}); } catch (e) { return { pull: {}, sucio: { h: {}, d: {}, c: false }, borr: { h: {}, d: {} } }; } };
  const guardarMeta = (m) => window.Store.escribirCrudo(META, JSON.stringify(m));
  let tSync = null, sincronizando = null, ultimo = null, ultimoError = '';
  function marcar(tipo, id, borrado) {
    if (!usuario) return; const m = meta();
    if (tipo === 'c') m.sucio.c = true;
    else if (borrado) { delete m.sucio[tipo][id]; m.borr[tipo][id] = 1; }
    else { m.sucio[tipo][id] = 1; delete m.borr[tipo][id]; }
    guardarMeta(m); programar();
  }
  function programar(ms) { clearTimeout(tSync); tSync = setTimeout(() => sincronizar().catch(() => {}), ms == null ? 4000 : ms); }
  const NO_SYNC_CFG = ['cuenta', 'sesion', 'omitirRegistro', 'onbPend', 'tourPend'];
  function cfgParaSubir(c) { const x = {}; Object.keys(c || {}).forEach((k) => { if (!NO_SYNC_CFG.includes(k)) x[k] = c[k]; }); x._mod = Date.now(); return x; }
  async function subirTabla(t, tabla, cargar) {
    const m = meta(), ids = Object.keys(m.sucio[t]), bs = Object.keys(m.borr[t]);
    const filas = [];
    ids.forEach((id) => { const x = cargar(id); if (x) filas.push({ id, user_id: usuario.id, datos: x, borrado: false }); });
    bs.forEach((id) => filas.push({ id, user_id: usuario.id, datos: {}, borrado: true }));
    for (let i = 0; i < filas.length; i += 40) {
      const { error } = await sb.from(tabla).upsert(filas.slice(i, i + 40), { onConflict: 'user_id,id' }); if (error) throw falla(error);
    }
    const m2 = meta(); // solo limpia lo que no volvió a cambiar mientras se subía
    filas.forEach((f) => { if (f.borrado) delete m2.borr[t][f.id]; else { const x = cargar(f.id); if (x && x.modificado === f.datos.modificado) delete m2.sucio[t][f.id]; } });
    guardarMeta(m2); return filas.length;
  }
  async function bajarTabla(t, tabla, cargar, guardar, borrarLocal) {
    let n = 0;
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const m = meta(); const desde = m.pull[t] || '1970-01-01T00:00:00Z';
      const { data, error } = await sb.from(tabla).select('id,datos,borrado,actualizado').gt('actualizado', desde).order('actualizado', { ascending: true }).limit(200);
      if (error) throw falla(error); if (!data || !data.length) break;
      window.Store.sinAviso(() => data.forEach((r) => {
        if (m.sucio[t][r.id] || m.borr[t][r.id]) return; // el cambio local gana; se subirá después
        const loc = cargar(r.id);
        if (r.borrado) { if (loc) { borrarLocal(r.id); n++; } return; }
        if (!loc || (loc.modificado || 0) <= (r.datos.modificado || 0)) { guardar(r.datos); n++; }
      }));
      const m2 = meta(); m2.pull[t] = data[data.length - 1].actualizado; guardarMeta(m2);
      if (data.length < 200) break;
    }
    return n;
  }
  async function sincronizar() {
    if (!usuario || !sb) return null;
    if (sincronizando) return sincronizando;
    const S = window.Store;
    sincronizando = (async () => {
      try {
        let subidos = 0, bajados = 0;
        subidos += await subirTabla('h', 'historias', (id) => S.cargar(id));
        subidos += await subirTabla('d', 'documentos', (id) => S.cargarDoc(id));
        const m = meta();
        if (m.sucio.c) {
          const { error } = await sb.from('configuracion').upsert({ user_id: usuario.id, datos: cfgParaSubir(S.config()) }, { onConflict: 'user_id' }); if (error) throw falla(error);
          const m2 = meta(); m2.sucio.c = false; guardarMeta(m2);
        } else {
          const { data, error } = await sb.from('configuracion').select('datos,actualizado').eq('user_id', usuario.id).maybeSingle();
          if (error) throw falla(error);
          if (data && data.actualizado > (m.pull.c || '') && alConfig) { S.sinAviso(() => alConfig(data.datos)); const m3 = meta(); m3.pull.c = data.actualizado; guardarMeta(m3); }
        }
        bajados += await bajarTabla('h', 'historias', (id) => S.cargar(id), (x) => S.guardar(x, true), (id) => S.borrar(id));
        bajados += await bajarTabla('d', 'documentos', (id) => S.cargarDoc(id), (x) => S.guardarDoc(x, true), (id) => S.borrarDoc(id));
        ultimo = Date.now(); ultimoError = ''; ls.set('morpheus-ultsync-' + usuario.id, String(ultimo));
        return { subidos, bajados };
      } catch (e) { ultimoError = traducir(e); throw e; } finally { sincronizando = null; }
    })();
    return sincronizando;
  }
  function pendientes() { const m = meta(); return Object.keys(m.sucio.h).length + Object.keys(m.sucio.d).length + Object.keys(m.borr.h).length + Object.keys(m.borr.d).length + (m.sucio.c ? 1 : 0); }
  function marcarTodo() { // al pasar datos del dispositivo a la cuenta: todo se sube
    const S = window.Store, m = meta(); S.indice().forEach((x) => (m.sucio.h[x.id] = 1)); S.docs().forEach((x) => (m.sucio.d[x.id] = 1)); m.sucio.c = true; guardarMeta(m); programar(500);
  }
  window.addEventListener('online', () => programar(1000));
  document.addEventListener('visibilitychange', () => { if (document.hidden && usuario && pendientes()) sincronizar().catch(() => {}); });

  return {
    PRUEBA, disponible, iniciar, registrar, entrar, salir, recuperar, nuevaClave, usuario: () => usuario, compartido,
    estado, estadoCache, reportarPago, verComprobante, misPagos, ajustes, ajustesCache, admAjustes, admPagos, admRevisar, admUsuarios, admExtender, borrarCuenta,
    marcar, sincronizar, programar, pendientes, marcarTodo, ultimaSync: () => ultimo || +(ls.get('morpheus-ultsync-' + (usuario && usuario.id)) || 0), ultimoError: () => ultimoError, traducir,
  };
})();
