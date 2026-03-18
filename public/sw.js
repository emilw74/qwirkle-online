const CACHE_NAME = 'qwirkle-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase requests (real-time data should always be fresh)
  if (event.request.url.includes('firebasedatabase.app') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firebase')) {
    return;
  }

  // Network-first for HTML and JS/CSS, cache-first for images/fonts
  const url = new URL(event.request.url);
  const isAsset = url.pathname.match(/\.(png|jpg|svg|woff2?|ttf|ico)$/);

  if (isAsset) {
    // Cache-first for static assets
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request).then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        }))
        .catch(() => caches.match('/index.html'))
    );
  } else {
    // Network-first for HTML, JS, CSS (always get fresh code)
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')))
    );
  }
});
