/* Pantalla de bienvenida: ilustración de fondo y textos legales. */
window.LEGAL = (function () {
  'use strict';
  // Ilustración original (línea fina y siluetas): lámpara quirúrgica, monitor y anestesiólogo con gorro y mascarilla.
  const ILUSTRACION = `
<svg viewBox="0 0 400 640" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="bvFig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8bd83" stop-opacity=".55"/>
      <stop offset=".55" stop-color="#d8bd83" stop-opacity=".22"/>
      <stop offset="1" stop-color="#d8bd83" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="bvLuz" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff6e0" stop-opacity=".35"/>
      <stop offset="1" stop-color="#fff6e0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bvHaz" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6e0" stop-opacity=".10"/>
      <stop offset="1" stop-color="#fff6e0" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- lámpara quirúrgica -->
  <g transform="translate(-26 -34) scale(.9)" fill="none" stroke="#d8bd83" stroke-opacity=".45" stroke-width="1.1">
    <path d="M118 0 V40 Q118 52 130 56 L150 62"/>
    <circle cx="112" cy="104" r="58" fill="url(#bvLuz)"/>
    <circle cx="112" cy="104" r="58"/>
    <circle cx="112" cy="104" r="44" stroke-opacity=".3"/>
    <circle cx="112" cy="104" r="11"/>
    <g stroke-opacity=".35">
      <circle cx="112" cy="74" r="8"/><circle cx="138" cy="89" r="8"/><circle cx="138" cy="119" r="8"/>
      <circle cx="112" cy="134" r="8"/><circle cx="86" cy="119" r="8"/><circle cx="86" cy="89" r="8"/>
    </g>
  </g>
  <path d="M40 110 L0 520 H300 L140 110 Z" fill="url(#bvHaz)"/>
  <!-- monitor -->
  <g class="bv-mon" transform="translate(-3 -58) scale(.6)" fill="none" stroke="#d8bd83" stroke-width="1" stroke-opacity=".4">
    <rect x="18" y="300" width="150" height="104" rx="8"/>
    <path d="M26 334 H56 L62 324 L68 346 L74 314 L80 334 H104 L110 330 L116 334 H160" stroke="#7fd6c2" stroke-opacity=".75" stroke-width="1.3"/>
    <path d="M26 366 Q36 354 46 366 T66 366 T86 366 T106 366 T126 366 T146 366 T160 366" stroke="#8fb8ff" stroke-opacity=".55"/>
    <path d="M26 390 H160" stroke-opacity=".2"/>
  </g>
  <!-- anestesiólogo -->
  <g transform="translate(4 -150)">
    <path fill="url(#bvFig)" d="M160 800 C162 540 182 452 226 430 L246 420 C250 404 252 392 252 380 L300 380 C300 392 302 404 306 420 L326 430 C370 452 390 540 392 800 Z"/>
    <ellipse cx="276" cy="322" rx="47" ry="58" fill="url(#bvFig)"/>
    <path fill="#d8bd83" fill-opacity=".5" d="M224 316 C216 262 246 236 280 236 C318 236 342 262 330 312 C326 300 314 294 300 294 L250 296 C238 296 228 304 224 316 Z"/>
    <path fill="none" stroke="#d8bd83" stroke-opacity=".5" stroke-width="1" d="M228 306 C246 298 306 296 328 304"/>
    <path fill="#e9dcc0" fill-opacity=".42" d="M234 332 C250 326 302 326 318 332 L316 366 C306 382 288 390 276 390 C262 390 246 382 236 366 Z"/>
    <g fill="none" stroke="#e9dcc0" stroke-opacity=".45" stroke-width=".9">
      <path d="M238 342 H314 M238 352 H314 M240 362 H312"/>
      <path d="M234 334 L222 326 M318 334 L332 326"/>
    </g>
    <g fill="none" stroke="#0b1d20" stroke-opacity=".55" stroke-width="2" stroke-linecap="round">
      <path d="M250 318 Q258 314 266 318 M286 318 Q294 314 302 318"/>
    </g>
    <path fill="none" stroke="#d8bd83" stroke-opacity=".5" stroke-width="1.1" d="M246 422 L276 468 L306 422"/>
    <path fill="none" stroke="#d8bd83" stroke-opacity=".45" stroke-width="1.2" d="M240 426 C236 470 244 500 262 510 M312 426 C318 468 312 496 296 508 M262 510 C266 520 280 522 290 514 L296 508"/>
    <circle cx="279" cy="522" r="7" fill="none" stroke="#d8bd83" stroke-opacity=".5" stroke-width="1.2"/>
  </g>
</svg>`;

  const ANIO = 2026;
  const TEXTOS = {
    privacidad: {
      t: 'Política de privacidad',
      h: (window.Nativo ? `<p><b>Tus datos se quedan en tu teléfono.</b> Las historias, tu perfil, tu firma y tu contraseña se guardan solo en el almacenamiento interno de este dispositivo.</p>
        <p>La aplicación <b>no tiene permiso de acceso a Internet</b>: no envía información a servidores, no usa analítica, publicidad ni rastreadores, y no crea cuentas en la nube.</p>`
        : `<p><b>Tus datos se quedan en este equipo.</b> Las historias, tu perfil, tu firma y tu contraseña se guardan solo en el almacenamiento de este navegador, en este dispositivo.</p>
        <p>La página se descarga una sola vez desde morpheus-md.vercel.app y luego funciona sin internet. <b>No envía tus historias ni tus datos</b> a ningún servidor, no usa analítica, publicidad ni rastreadores, y no crea cuentas en la nube.</p>
        <p>Si usas un equipo compartido (por ejemplo, el de una clínica), protege tu sesión con contraseña y cierra sesión al terminar. Borrar los datos de navegación de este sitio borra tus historias: haz respaldos periódicos.</p>`) + `
        <p>La contraseña no se guarda tal cual: se guarda un resumen criptográfico (SHA-256 con sal) que no permite recuperarla. El código de recuperación se muestra una sola vez.</p>
        <p>Un PDF o un respaldo solo sale del teléfono cuando tú decides compartirlo, guardarlo o imprimirlo. A partir de ese momento, su resguardo depende de la aplicación o persona que lo reciba.</p>
        <p>Los datos clínicos están protegidos por el secreto médico. Es responsabilidad del profesional usarlos y compartirlos conforme a la normativa de su país y de su institución.</p>
        <p>${window.Nativo ? 'Al desinstalar la aplicación se borran sus datos.' : 'Al borrar los datos del sitio en el navegador se borran tus historias.'} Haz respaldos periódicos desde el menú.</p>`,
    },
    terminos: {
      t: 'Términos de uso',
      h: `<p>Morpheus MD es una herramienta de apoyo para <b>documentar</b> el acto anestésico. Está dirigida a profesionales de la salud.</p>
        <p>No sustituye el juicio clínico, los protocolos de la institución ni la vigilancia del paciente. El profesional que la usa es responsable de la exactitud de lo registrado y de las decisiones clínicas.</p>
        <p>La aplicación se ofrece "tal cual", sin garantías de ningún tipo. Sus autores no se hacen responsables por daños derivados de su uso, de errores de registro o de la pérdida de datos.</p>
        <p>El usuario debe mantener protegido su teléfono y su contraseña, y respaldar su información.</p>`,
    },
    aviso: {
      t: 'Aviso médico',
      h: `<p>Las dosis, rangos, modelos farmacocinéticos (Marsh, Schnider, Minto, Hannivoort, Dyck), el esquema de Roberts, la regla del 6, la CAM ajustada por edad (Mapleson) y el consumo de halogenado (Dion, 1992) son <b>cálculos de referencia</b> tomados de la literatura.</p>
        <p>Verifica siempre cada dosis, dilución y velocidad con la bomba, la etiqueta de la jeringa, el prospecto y tu criterio clínico, en especial en pacientes pediátricos, ancianos, obesos, embarazadas o críticos.</p>`,
    },
    licencias: {
      t: 'Licencias y créditos',
      h: `<p><b>jsPDF</b> 2.5.2 · Licencia MIT · © James Hall, yWorks GmbH y colaboradores.</p>
        <p><b>PDF.js</b> 3.11 · Licencia Apache 2.0 · © Mozilla Foundation.</p>
        <p><b>Cormorant Garamond</b> y <b>Montserrat</b> · SIL Open Font License 1.1 · © The Cormorant Project Authors · © The Montserrat Project Authors.</p>
        <p><b>Fotografía de portada</b>: "Changing the fluids", Oliver Cole, U.S. Navy (DVIDS 356869) · Dominio público, vía Wikimedia Commons.</p>
        <p>Íconos: propios de la aplicación.</p>`,
    },
  };
  return { ILUSTRACION, TEXTOS, ANIO };
})();
