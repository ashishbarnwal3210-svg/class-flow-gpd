const CACHE_NAME = 'classflow-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
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

self.addEventListener('fetch', (event) => {
  // Only handle GET requests, don't intercept API / supabase calls
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests (e.g. Supabase, analytics)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
