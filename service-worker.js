self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));await self.registration.unregister();await self.clients.claim();})());});
self.addEventListener('fetch',()=>{});
unregister();
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.navigate(client.url);
  })());
});
self.addEventListener('fetch', () => {});
me => name !== CACHE_NAME).map(name => caches.delete(name)));
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
