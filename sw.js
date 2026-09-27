/* Morpheus MD: funciona sin internet. Guarda la app en caché la primera vez que se abre. */
const VERSION = 'morpheus-1.9.4';
const ARCHIVOS = [
  './',
  'css/app.css',
  'fonts/cormorant-garamond-latin-400-italic.woff2',
  'fonts/cormorant-garamond-latin-400-normal.woff2',
  'fonts/cormorant-garamond-latin-600-normal.woff2',
  'img/icono-192.png',
  'img/icono-512-mask.png',
  'img/icono-512.png',
  'img/portada.jpg',
  'index.html',
  'js/app.js',
  'js/calc.js',
  'js/cuenta.js',
  'js/extras.js',
  'js/fuentes.js',
  'js/imgs.js',
  'js/legal.js',
  'js/obs.js',
  'js/pdf.js',
  'js/pistas.js',
  'js/store.js',
  'js/visor.js',
  'lib/jspdf.umd.min.js',
  'lib/pdfjs/pdf.min.js',
  'lib/pdfjs/pdf.worker.min.js',
  'manifest.webmanifest'
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
    return res;
  })));
});
