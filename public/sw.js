const CACHE_NAME = 'classflow-cache-v5';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-48x48.png',
  '/classflow-mark.png',
  '/classflow-mark-512.png',
  '/classflow-mark.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip external or non-http requests (e.g. Supabase API)
  if (url.origin !== self.location.origin) return;

  // Always fetch fresh version metadata for update popups
  if (url.pathname === '/version.json') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // SPA navigation requests (e.g. HTML pages, route transitions)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((res) => {
            return res || caches.match('/') || caches.match('/index.html') || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Network-first with cache fallback for same-origin static assets
  // Ensures fresh updates are served immediately when online, while still working 100% offline
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
