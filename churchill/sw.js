// Network first, cache as the offline fallback. The app's files import one
// another, so they must all come from the same version: serving cached
// copies first, or letting the browser's HTTP cache (GitHub Pages allows
// 10 minutes) answer, can mix old and new files and stop the app loading.
const CACHE_NAME = 'churchill-v9';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './play.js',
  './core.js',
  './solver-worker.js',
  './core.wasm',
  './core-version.txt',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
