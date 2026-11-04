/* ==========================================================================
   DataP · service worker
   Estrategia "red primero": siempre intenta la versión más reciente y, si no
   hay conexión, usa la copia guardada. Así la app funciona sin internet sin
   quedarse con versiones viejas.
   ========================================================================== */
var CACHE = 'datap-v2';
var SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/styles.css',
  'assets/css/app.css',
  'assets/js/app.js',
  'assets/js/store.js',
  'assets/js/ui.js',
  'assets/js/lib/pca.js',
  'assets/js/lib/file-reader.js',
  'assets/js/lib/charts.js',
  'assets/data/pca-clientes.js',
  'assets/js/modules/inicio.js',
  'assets/js/modules/tareas.js',
  'assets/js/modules/notas.js',
  'assets/js/modules/proyectos.js',
  'assets/js/modules/analisis-pca.js',
  'assets/js/modules/laboratorio.js',
  'assets/js/modules/ajustes.js',
  'assets/img/segmentacion-clientes.png',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined);
      });
    })
  );
});
