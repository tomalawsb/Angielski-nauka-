'use strict';
const CACHE_NAME='english-trainer-v5.7.1';
const APP_SHELL=[
  './',
  './index.html',
  './learning-core.js',
  './data.js',
  './dialogues.js',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('english-trainer-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        const cache=await caches.open(CACHE_NAME);
        cache.put('./index.html',response.clone());
        return response;
      }catch(_){
        return (await caches.match(request))||(await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request,{ignoreSearch:true});
    const network=fetch(request).then(async response=>{
      if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
      return response;
    }).catch(()=>null);
    return cached||(await network)||new Response('Offline',{status:503,statusText:'Offline'});
  })());
});

self.addEventListener('periodicsync',event=>{
  if(event.tag!=='daily-learning-reminder')return;
  event.waitUntil(self.registration.showNotification('Czas na angielski',{
    body:'Zrób krótką sesję lub sprawdź dzisiejsze powtórki.',
    icon:'./icon-192.png',badge:'./icon-192.png',tag:'daily-learning-reminder'
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=clientsList.find(client=>'focus'in client);
    if(existing){await existing.focus();return;}
    if(self.clients.openWindow)await self.clients.openWindow('./index.html?v=5.7.1');
  })());
});
