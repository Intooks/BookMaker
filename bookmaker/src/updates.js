export async function connectUpdates(save,notify){
  if(!('serviceWorker' in navigator))return;
  let controlled=!!navigator.serviceWorker.controller;
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',async()=>{
    if(!controlled){controlled=true;return;}
    if(reloading)return;
    reloading=true;
    try{await save();location.reload();}
    catch{reloading=false;notify('Не удалось сохранить книгу перед обновлением. Скачайте резервную копию и перезагрузите страницу.');}
  });
  const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  const activate=()=>registration.waiting?.postMessage('ACTIVATE');
  activate();
  registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{if(worker.state==='installed')activate();});
  });
  const check=()=>registration.update().catch(()=>{});
  window.addEventListener('online',check);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
  await check();
}
