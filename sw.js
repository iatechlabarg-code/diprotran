// Service Worker — DI.PRO.TRAN. Sistema de Guardia
// Network-first para app files (siempre sirve lo último cuando hay red)
// Cache-first solo para assets estáticos que no cambian (logo, manifest)
// ── Cambiar APP_VERSION con cada deploy para forzar actualización ──
const APP_VERSION  = "20260613-4";
const CACHE_NAME   = "diprotran-" + APP_VERSION;

// Assets verdaderamente estáticos — cache-first está bien
const STATIC_ASSETS = [
  "./logo_fondo_blanco.png",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.json",
];

// ── Install: pre-cachear solo los assets estáticos ──────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: limpiar caches viejos ─────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Mensaje desde el cliente para forzar activación inmediata ───────────────
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ── Fetch: estrategia mixta ──────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Supabase y CDN externos → network-first sin caché
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("cdnjs.cloudflare.com") ||
    url.hostname.includes("cdn.jsdelivr.net") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // Assets estáticos (logo, manifest) → cache-first
  const path = url.pathname;
  if (path.endsWith(".png") || path.endsWith("manifest.json")) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // App files (index.html, style.css, js/*.js, sw.js) → network-first
  // Cuando hay red: siempre sirve la versión más nueva y actualiza el cache
  // Cuando no hay red: sirve el cache como fallback offline
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && url.origin === location.origin) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
