const CACHE_NAME = 'classflow-cache-v11';
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
  const url = new URL(event.request.url);

  // Handle native Web Share Target (files/links shared from phone files/WhatsApp to ClassFlow)
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const files = formData.getAll('shared_files');
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const link = formData.get('url') || '';

        await new Promise((resolve, reject) => {
          const req = indexedDB.open('classflow-share-db', 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('shared-files')) {
              db.createObjectStore('shared-files', { keyPath: 'id', autoIncrement: true });
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('shared-files', 'readwrite');
            const store = tx.objectStore('shared-files');
            store.add({ files, title, text, url: link, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.error('Share target capture error:', err);
      }
      return Response.redirect('/upload?shared=1', 303);
    })());
    return;
  }

  // Only handle GET requests, don't intercept API / supabase calls
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests (e.g. Supabase, analytics)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html').then((idx) => idx || caches.match('/'));
          }
        });
      })
  );
});
