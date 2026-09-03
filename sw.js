/* ============================================================
   Heavyline Trucker — service worker
   Makes the client installable and usable with no connection.
   Bump CACHE when you ship a change so clients pick it up.
   ============================================================ */
/* The -r suffix is the cache revision: bump it when the strategy below
   changes, so activate() drops caches written under the old rules. */
const CACHE = 'heavylinetrucker-v4.8.0-r3';

/* the app shell — everything needed to boot with no network */
const SHELL = [
  './tracker.html',
  './style.css',        /* the client draws with the website's design */
  './tracker.css',
  './tracker.js',
  './map-data.js',
  './manifest.webmanifest',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './hll.jpg',
  './icons/mark.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* addAll fails the whole install if any single file 404s, so add individually */
    await Promise.all(SHELL.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
        console.warn('[sw] could not precache', url, err);
      })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* let fonts etc. go to the network */

  /* Navigations: try the network first so a redeploy lands, fall back to the
     cached shell when offline. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./tracker.html')) ||
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  /* Code is network-first. Cache-first outlives every edit: a script cached
     once is served ahead of the network for good, so a redeploy never lands and
     a single truncated response stays wedged in the cache until the CACHE name
     changes by hand. Offline still works — the cache is the fallback. */
  const isCode = /\.(js|css|webmanifest)$/i.test(url.pathname);

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    if (isCode) {
      try {
        const fresh = await fetch(req, { cache: 'no-cache' });
        /* only a whole, good response is worth keeping */
        if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await cache.match(req)) ||
          new Response('', { status: 504, statusText: 'Offline' });
      }
    }

    /* Everything else — images, fonts, the brand mark — changes rarely enough
       to serve from cache immediately and refresh in the background. */
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) ||
      new Response('', { status: 504, statusText: 'Offline' });
  })());
});
