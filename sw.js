const CACHE = 'feed-offline-v8';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// When the PC is off, ngrok still answers with its own error page (not a network error),
// so a network response must never be trusted over the cached app files.
function refresh(request, cacheKey) {
  return fetch(request).then(response => {
    const sameOrigin = new URL(request.url).origin === self.location.origin;
    const isNgrokError = response.headers.get('ngrok-error-code');
    if (response.ok && sameOrigin && !isNgrokError) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(cacheKey, copy));
    }
    return response;
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        const update = refresh(request, './index.html').catch(() => null);
        if (cached) {
          event.waitUntil(update);
          return cached;
        }
        return update.then(response => response || new Response('', { status: 503 }));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const update = refresh(request, new URL(request.url).pathname).catch(() => null);
      if (cached) {
        event.waitUntil(update);
        return cached;
      }
      return update.then(response => response || new Response('', { status: 503, statusText: 'Offline' }));
    })
  );
});
