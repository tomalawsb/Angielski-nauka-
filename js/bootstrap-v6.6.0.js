'use strict';
(() => {
  const VERSION='6.6.0';
  if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading)return;
    const key='adt-sw-reload-'+VERSION;
    if(sessionStorage.getItem(key))return;
    sessionStorage.setItem(key,'1');
    reloading=true;
    location.replace(location.pathname+'?app='+VERSION+'&refresh='+Date.now());
  });
  navigator.serviceWorker.register('./service-worker-v6.6.0.js',{scope:'./',updateViaCache:'none'})
    .then(async registration=>{
      try{await registration.update();}catch(_){}
      if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
    })
    .catch(error=>console.warn('Aktualizacja PWA:',error));
})();
