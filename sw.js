// Service Worker â DI.PRO.TRAN. Sistema de Guardia  v1.2
// Estrategia: Cache-first para shell local; Network-first para APIs externas.
// ActualizaciÃ³n: skipWaiting inmediato + notificaciÃ³n a clientes.

const CACHE_NAME = 'diprotran-v1.2';

const SHELL = [
  './index.html',
  './assets/img/logo.png',
  './manifest.json',
  './assets/css/app.v1.2.css',
  './assets/js/app.v1.2.js',
];

// ââ Install: pre-cachear el shell ââââââââââââââââââââââââââââââââââââââââââ
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(SHELL); })
      .then(function() { return self.skipWaiting(); })
  );
});

// ââ Activate: limpiar caches viejos y notificar clientes ââââââââââââââââââ
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
        );
      })
      .then(function() {
        // Notificar a todos los clientes abiertos que hay nueva versiÃ³n
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
        return self.clients.claim();
      })
  );
});

// ââ Fetch: estrategia mixta ââââââââââââââââââââââââââââââââââââââââââââââââ
self.addEventListener('fetch', function(event) {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  var url;
  try { url = new URL(event.request.url); }
  catch (_) { return; }

  // APIs externas â network-first (sin cachÃ©)
  if (
    url.hostname.includes('supabase.co')           ||
    url.hostname.includes('cdnjs.cloudflare.com')  ||
    url.hostname.includes('cdn.jsdelivr.net')       ||
    url.hostname.includes('fonts.googleapis.com')  ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Shell local â cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        if (
          response &&
          response.status === 200 &&
          url.origin === location.origin
        ) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback: devolver index.html para navegaciÃ³n
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ââ Mensajes desde la app ââââââââââââââââââââââââââââââââââââââââââââââââââ
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
