const CACHE_NAME = 'qwirkle-v4';
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

// --- Web Push ---

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '🎲 Qwirkle', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // One notification per room, so a reminder replaces the earlier
      // "your turn" instead of stacking up on the lock screen.
      tag: data.tag || 'qwirkle',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  // Focus an already-open tab when there is one, otherwise open the app.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
