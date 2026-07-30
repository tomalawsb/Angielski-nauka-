'use strict';

/**
 * Angielski Daily Trainer 5.8.6
 * Rejestracja Service Workera, cache i twarde odświeżanie PWA.
 * Wydzielone z wersji 5.8.3 bez zmiany zachowania aplikacji.
 */

async function clearAppCaches(){
  if(!('caches'in window))return true;
  try{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('english-trainer-')).map(key=>caches.delete(key)));return true;}
  catch(error){console.error('Usuwanie cache:',error);notify('Nie udało się odświeżyć plików aplikacji.','error');return false;}
}
async function registerServiceWorker(){
  if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol))return null;
  try{
    let reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(reloading)return;
      const key='adt-sw-reload-'+APP_VERSION;
      if(sessionStorage.getItem(key))return;
      sessionStorage.setItem(key,'1');
      reloading=true;
      location.reload();
    });
    const registration=await navigator.serviceWorker.register('./service-worker-v5.8.6.js',{scope:'./',updateViaCache:'none'});
    await registration.update();
    if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    return registration;
  }catch(error){console.warn('Service Worker:',error);return null;}
}
async function hardRefresh(){if(!await askConfirm('Odświeżyć pliki aplikacji?','Postęp pozostanie zachowany. Program usunie wyłącznie pliki z pamięci podręcznej i pobierze aktualną wersję.','Odśwież'))return;const cleared=await clearAppCaches();if(!cleared)return;try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration();if(registration)await registration.update();}}catch(error){console.warn('Aktualizacja Service Workera:',error);}location.replace(location.pathname+'?v='+APP_VERSION+'&reload='+Date.now());}
