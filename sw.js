// Service Worker — DI.PRO.TRAN. Sistema de Guardia
// Cache-first para el shell de la app; network-first para Supabase API
// ── Cambiar APP_VERSION con cada deploy para forzar actualización ──
const APP_VERSION  = "20260607-2";
const CACHE_NAME   = "diprotran-" + APP_VERSION;
const SHELL = [
  "./index.html",
  "./logo_fondo_blanco.png",
  "./manifest.json",
];

// ── Install: pre-cachear el shell ────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
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

  // Supabase y CDN externos → network-first (sin caché)
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

  // Shell local → cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachear solo respuestas válidas del mismo origen
        if (response && response.status === 200 && url.origin === location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
