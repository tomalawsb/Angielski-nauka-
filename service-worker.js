'use strict';
const CACHE_NAME='english-trainer-v5.8.2';
const APP_SHELL=[
  './','./index.html','./styles.css','./learning-core.js','./data.js','./dialogues.js','./script.js','./manifest.json','./icon-192.png','./icon-512.png'
];

async function safeCachePut(cache,request,response){
  try{await cache.put(request,response);}catch(error){console.warn('Nie udało się zapisać pliku w cache:',request.url||request,error);}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
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

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await safeCachePut(cache,'./index.html',response.clone());}
        return response;
      }catch(error){
        return (await caches.match(request,{ignoreSearch:true}))||(await caches.match('./index.html'))||new Response('Aplikacja jest niedostępna offline.',{status:503,statusText:'Offline'});
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request,{ignoreSearch:true});
    const networkPromise=fetch(request).then(async response=>{
      if(response&&response.ok){const cache=await caches.open(CACHE_NAME);await safeCachePut(cache,request,response.clone());}
      return response;
    }).catch(error=>{console.warn('Błąd sieci:',request.url,error);return null;});
    return cached||(await networkPromise)||new Response('Offline',{status:503,statusText:'Offline'});
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=list.find(client=>'focus'in client);
    if(existing){await existing.focus();return;}
    if(self.clients.openWindow)await self.clients.openWindow('./index.html?v=5.8.2');
  })());
});
