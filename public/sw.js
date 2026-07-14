/* TikPlay service worker — app-shell caching for PWA install/offline. */
const VERSION = 'v1';
const STATIC_CACHE = `tikplay-static-${VERSION}`;
const PAGE_CACHE = `tikplay-pages-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add('/'))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Audio streaming uses Range requests + immutable HTTP cache; let the
  // browser handle it directly. Other API calls are live data — no SW cache.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first so the app stays fresh, cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/', { cacheName: PAGE_CACHE })),
    );
    return;
  }

  // Hashed build assets, fonts, icons: cache-first.
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    request.destination === 'font';

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
