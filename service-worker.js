'use strict';
const VERSION='6.6.0-p8-topic-fix1';
const CACHE_NAME='english-trainer-v6.6.0-p8-topic-fix1';
const APP_ENTRY='./index.html?app='+VERSION;
const APP_SHELL=[
  APP_ENTRY,
  './js/bootstrap-v6.6.0.js',
  './css/styles-v6.6.0.css',
  './js/learning-core-v6.6.0.js',
  './js/course-core-v6.6.0.js',
  './data/materials-v6.6.0.js',
  './data/dialogues-v6.6.0.js',
  './data/course-a1-module1-v6.6.0.js',
  './data/course-a1-full-expansion-v6.6.0.js',
  './data/course-a2-full-v6.6.0.js',
  './data/content-quality-v6.6.0.js',
  './data/course-catalog-v6.6.0.js',
  './js/app-state-v6.6.0.js',
  './js/storage-v6.6.0.js',
  './js/pwa-services-v6.6.0.js',
  './js/reminders-v6.6.0.js',
  './js/settings-v6.6.0.js',
  './js/navigation-v6.6.0.js',
  './js/review-engine-v6.6.0.js',
  './js/course-engine-v6.6.0.js',
  './js/course-ui-v6.6.0.js',
  './js/exercise-engine-v6.6.0.js',
  './js/statistics-v6.6.0.js',
  './js/speech-v6.6.0.js',
  './js/car-mode-v6.6.0.js',
  './js/data-io-v6.6.0.js',
  './js/app-v6.6.0.js',
  './manifest-v6.6.0.json',
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
    try{
      const responses=await Promise.all(APP_SHELL.map(url=>fetchFresh(url)));
      for(let index=0;index<APP_SHELL.length;index++){
        const response=responses[index];if(!response?.ok)throw new Error('Brak zasobu '+APP_SHELL[index]);
        await cache.put(APP_SHELL[index],response.clone());
      }
    }catch(error){await caches.delete(CACHE_NAME);throw error;}
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
        if(isDocument)return (await cache.match(APP_ENTRY))||(await caches.match(event.request));
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
    if(self.clients.openWindow)await self.clients.openWindow(APP_ENTRY);
  })());
});
