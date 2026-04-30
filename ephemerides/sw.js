const CACHE_NAME = 'ephemerides-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './astronomy.js',
  './app.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Don't cache API calls — handled by app-level localStorage caching
  if (e.request.url.includes('ssd.jpl.nasa.gov')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // Return cached, but also update cache in background
      const fetchPromise = fetch(e.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
