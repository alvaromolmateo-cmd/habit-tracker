// Service worker: precachea la app y sirve con «red primero, caché si falla», para que funcione sin conexión
// y a la vez reciba las actualizaciones en cuanto haya red.

const VERSION = 'v1.3.0'; // la misma que APP_VERSION en js/views/settings.js
const CACHE = `habit-tracker-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/charts.js',
  './js/dates.js',
  './js/dayform.js',
  './js/events.js',
  './js/stats.js',
  './js/store.js',
  './js/tasks.js',
  './js/ui.js',
  './js/views/calendar.js',
  './js/views/habits.js',
  './js/views/monthly.js',
  './js/views/settings.js',
  './js/views/shared.js',
  './js/views/statistics.js',
  './js/views/today.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Precachea archivo a archivo: si alguno falla no se aborta la instalación (la estrategia de red
// lo guardará en caché en cuanto se pida), pero se deja constancia en la consola del worker.
async function precache() {
  const cache = await caches.open(CACHE);
  const results = await Promise.allSettled(ASSETS.map(async (asset) => {
    const response = await fetch(new Request(asset, { cache: 'reload' }));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
      await cache.put(asset, response);
    } catch (e) {
      // La página puede estar guardando el mismo archivo a la vez (estrategia de red): ya está en caché.
      if (!/already exists/i.test(e.message)) throw e;
    }
  }));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[sw] no se pudo precachear', ASSETS[i], r.reason && r.reason.message);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          // Puede coincidir con el precacheo del mismo archivo durante la instalación: se ignora.
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }),
  );
});
