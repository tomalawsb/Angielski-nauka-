const CACHE_NAME = 'angielski-daily-trainer-v5.0.0';
const ASSETS = [
  './',
  './index.html?v=5.0.0',
  './style.css?v=5.0.0',
  './app.js?v=5.0.0',
  './words.json?v=5.0.0',
  './manifest.json?v=5.0.0',
  './icon-192.png?v=5.0.0',
  './icon-512.png?v=5.0.0'
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isAppFile = url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json');
  if (isAppFile) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
 .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
