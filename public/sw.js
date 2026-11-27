const CACHE_NAME = 'classflow-cache-v8';
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

// Inlined cute mascot offline HTML ensures Chrome NEVER throws ERR_FAILED even if cache is purged or missed!
const INLINE_OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ClassFlow — Offline Study Mode</title>
    <link rel="icon" href="/favicon.ico" />
    <style>
      :root { --sand: #f6f2e9; --earth: #4d443a; --muted: #796f64; --sage: #718c75; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: var(--sand);
        color: var(--earth);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        text-align: center;
      }
      .offline-card {
        max-width: 440px;
        width: 100%;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(120, 103, 76, 0.2);
        border-radius: 28px;
        padding: 40px 24px;
        box-shadow: 0 16px 42px rgba(75, 62, 45, 0.1);
      }
      .cute-mascot { width: 140px; height: 140px; margin: 0 auto 20px; display: block; }
      h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #3f362e; }
      p { font-size: 13px; color: var(--muted); line-height: 1.5; margin-bottom: 24px; }
      .actions { display: flex; flex-direction: column; gap: 10px; }
      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        height: 44px; padding: 0 20px; border-radius: 999px; font-size: 13px;
        font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.2s ease;
      }
      .btn-primary { background: var(--sage); color: white; border: none; }
      .btn-primary:hover { background: #5c7560; }
      .btn-secondary { background: rgba(113, 140, 117, 0.12); color: #435b46; border: 1px solid rgba(113, 140, 117, 0.25); }
    </style>
  </head>
  <body>
    <div class="offline-card">
      <svg class="cute-mascot" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="64" fill="#E8E2D5" />
        <ellipse cx="80" cy="85" rx="42" ry="46" fill="#899F8B" />
        <ellipse cx="80" cy="88" rx="34" ry="36" fill="#F4F0E7" />
        <path d="M64 82C67 85 71 85 74 82" stroke="#4D443A" stroke-width="3" stroke-linecap="round" />
        <path d="M86 82C89 85 93 85 96 82" stroke="#4D443A" stroke-width="3" stroke-linecap="round" />
        <polygon points="80,87 76,92 84,92" fill="#E2A35C" />
        <circle cx="62" cy="88" r="4" fill="#F4B0A1" opacity="0.8" />
        <circle cx="98" cy="88" r="4" fill="#F4B0A1" opacity="0.8" />
        <polygon points="80,45 106,55 80,63 54,55" fill="#4D443A" />
        <rect x="70" y="58" width="20" height="9" rx="3" fill="#4D443A" />
        <path d="M106 55V70" stroke="#E2A35C" stroke-width="2" stroke-linecap="round" />
        <circle cx="106" cy="71" r="2.5" fill="#E2A35C" />
        <path d="M116 38L124 38L116 46L124 46" stroke="#899F8B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M125 24L131 24L125 30L131 30" stroke="#899F8B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="42" cy="48" r="14" fill="#FFFFFF" stroke="#78674C20" stroke-width="1.5" />
        <path d="M35 44C39 40 45 40 49 44" stroke="#A89F91" stroke-width="2" stroke-linecap="round" />
        <path d="M38 48C40 46 44 46 46 48" stroke="#A89F91" stroke-width="2" stroke-linecap="round" />
        <line x1="34" y1="56" x2="50" y2="40" stroke="#D36B5B" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <h1>No Internet Connection</h1>
      <p>You're offline. Your downloaded campus notes and cached study materials are still available inside the app!</p>
      <div class="actions">
        <a href="/downloads" class="btn btn-primary">📥 Open In-App Downloads</a>
        <button class="btn btn-secondary" onclick="window.location.reload()">🔄 Retry Connection</button>
      </div>
    </div>
  </body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Also cache offline.html explicitly
      cache.put('/offline.html', new Response(INLINE_OFFLINE_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }));
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
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy.clone());
              cache.put('/index.html', copy.clone());
              cache.put('/', copy);
            });
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = (await cache.match(event.request))
            || (await cache.match('/index.html'))
            || (await cache.match('/'))
            || (await cache.match('/offline.html'));
          if (cached) return cached;
          // Guaranteed fallback: Return inline cute mascot HTML response so Chrome NEVER throws ERR_FAILED!
          return new Response(INLINE_OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Same-origin static assets (JS, CSS, images, icons)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkRes;
        })
        .catch(() => {
          // If offline and asset is not cached, return empty 204 response instead of throwing ERR_FAILED
          return new Response('', { status: 204 });
        });
    })
  );
});
