'use strict';
const VERSION='5.8.3';
const CACHE_NAME='english-trainer-v5.8.3';
const APP_SHELL=[
  './index.html?app=5.8.3',
  './bootstrap-v5.8.3.js',
  './styles-v5.8.3.css',
  './learning-core-v5.8.3.js',
  './data-v5.8.3.js',
  './dialogues-v5.8.3.js',
  './script-v5.8.3.js',
  './manifest-v5.8.3.json',
  './icon-192.png',
  './icon-512.png'
];

async function fetchFresh(request){
  return fetch(new Request(request,{cache:'no-store'}));
}
async function put(cache,key,response){
  if(response&&response.ok)try{await cache.put(key,response.clone());}catch(error){console.warn('Cache put:',error);}
  return response;
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url=>{
      try{await put(cache,url,await fetchFresh(url));}catch(error){console.warn('Precache:',url,error);}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('english-trainer-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isDocument=event.request.mode==='navigate'||event.request.destination==='document';
  const isCode=['script','style','worker','manifest'].includes(event.request.destination)||/\.(?:js|css|json)$/.test(url.pathname);

  if(isDocument||isCode){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try{
        const response=await fetchFresh(event.request);
        await put(cache,event.request,response);
        return response;
      }catch(error){
        if(isDocument)return (await cache.match('./index.html?app=5.8.3'))||(await caches.match(event.request));
        return (await cache.match(event.request))||(await caches.match(event.request));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    try{
      const response=await fetchFresh(event.request);
      const cache=await caches.open(CACHE_NAME);
      await put(cache,event.request,response);
      return response;
    }catch(error){return new Response('Offline',{status:503,statusText:'Offline'});}
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=list.find(client=>'focus' in client);
    if(existing){await existing.focus();return;}
    if(self.clients.openWindow)await self.clients.openWindow('./index.html?app=5.8.3');
  })());
});
