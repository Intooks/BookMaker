const CACHE='bookmaker-__VERSION__';
const BASE=new URL('./',self.location).pathname;
const FILES=__ASSETS__.map(p=>BASE+p);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bookmaker-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
async function navigation(request,cache){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4000);
  try{
    const response=await fetch(request,{cache:'no-store',signal:controller.signal});
    if(response.status>=500)throw new Error('Сервер недоступен');
    if(response.ok){try{await cache.put(BASE,response.clone());await cache.put(BASE+'index.html',response.clone());}catch{}}
    return response;
  }catch(error){const saved=await cache.match(BASE);if(saved)return saved;throw error;}
  finally{clearTimeout(timeout);}
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    if(event.request.mode==='navigate')return navigation(event.request,cache);
    return await cache.match(event.request)||fetch(event.request);
  }));
});
