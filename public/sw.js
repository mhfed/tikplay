/* TikPlay service worker — app-shell caching for PWA install/offline. */
const VERSION = 'v2';
const STATIC_CACHE = `tikplay-static-${VERSION}`;
const PAGE_CACHE = `tikplay-pages-${VERSION}`;
const RSC_CACHE = `tikplay-rsc-${VERSION}`;

/* All known routes to pre-cache on install for offline navigation. */
const PRECACHE_ROUTES = [
  '/',
  '/library',
  '/library/favorites',
  '/terms',
  '/copyright',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_ROUTES.map((url) =>
            cache.add(url).catch(() => {
              // Individual route failures are non-fatal.
            }),
          ),
        ),
      )
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
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== PAGE_CACHE &&
                key !== RSC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => {
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(() => {});
        }
        return self.clients.claim();
      }),
  );
});

/**
 * Network-first strategy: try the network, cache on success, fall back to
 * cache on failure. Returns `null` when both network and cache miss.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName });
    return cached || null;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Audio streaming / API: let the browser handle it directly (native HTTP
  // cache / Range requests). Offline audio playback is handled by OPFS + the
  // offline engine, not by the SW cache.
  if (url.pathname.startsWith('/api/')) return;

  // RSC data fetches (client-side navigation in Next.js App Router).
  // These are normal GET requests to the page URL with an `RSC: 1` header.
  // Cache them with network-first so previously-visited pages work offline.
  if (request.headers.get('RSC') === '1') {
    event.respondWith(networkFirst(request, RSC_CACHE));
    return;
  }

  // Full navigations: network-first so the app stays fresh, cached shell
  // when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const response = await networkFirst(request, PAGE_CACHE);
        if (response) return response;
        // Ultimate fallback: root page as the app shell.
        return caches.match('/', { cacheName: PAGE_CACHE });
      })(),
    );
    return;
  }

  // Hashed build assets, fonts, icons: cache-first (immutable content).
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
    return;
  }

  // Everything else (e.g. manifest, fonts, images): pass through.
});
