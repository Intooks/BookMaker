import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { connectUpdates } from '../src/updates.js';

function worker(){
  const handlers={},entries=new Map();let online=true,version='new',waiting=0,claimed=0,fetches=0;
  const key=request=>typeof request==='string'?request:request.url;
  const cache={addAll:async()=>{},match:async request=>entries.get(key(request))?.clone(),put:async(request,response)=>entries.set(key(request),response)};
  const self={location:new URL('https://example.test/bookmaker/sw.js'),addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>waiting++,clients:{claim:async()=>claimed++}};
  const source=readFileSync(new URL('../src/sw.js',import.meta.url),'utf8').replace('__VERSION__','test').replace('__ASSETS__','["", "app.js?v=new"]');
  vm.runInNewContext(source,{self,URL,AbortController,setTimeout,clearTimeout,caches:{open:async()=>cache,keys:async()=>['bookmaker-test'],delete:async()=>{}},fetch:async()=>{fetches++;if(!online)throw new Error('offline');return new Response(version);}});
  const dispatch=async name=>{let task;handlers[name]({waitUntil:p=>task=p});await task;};
  const navigate=async()=>{let response;handlers.fetch({request:{method:'GET',url:'https://example.test/bookmaker/',mode:'navigate'},respondWith:p=>response=p});return (await response).text();};
  return {dispatch,navigate,offline:()=>online=false,version:v=>version=v,get waiting(){return waiting;},get claimed(){return claimed;},get fetches(){return fetches;}};
}
test('PWA активирует свежий кэш без ожидания закрытия вкладок',async()=>{const w=worker();await w.dispatch('install');await w.dispatch('activate');assert.equal(w.waiting,1);assert.equal(w.claimed,1);});
test('HTML проверяется по сети и остаётся доступен оффлайн',async()=>{const w=worker();assert.equal(await w.navigate(),'new');w.version('updated');assert.equal(await w.navigate(),'updated');w.offline();assert.equal(await w.navigate(),'updated');assert.equal(w.fetches,3);});

async function browserState(fn,controlled=true){
  const original=new Map(['navigator','window','document','location'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const events={},messages=[],actions=[],notices=[];
  const registration={waiting:{postMessage:m=>messages.push(m)},addEventListener:()=>{},update:async()=>actions.push('check')};
  const serviceWorker={controller:controlled?{}:null,addEventListener:(n,f)=>events[n]=f,register:async(url,options)=>{assert.equal(options.updateViaCache,'none');return registration;}};
  const values={navigator:{serviceWorker},window:{addEventListener:()=>{}},document:{addEventListener:()=>{}},location:{reload:()=>actions.push('reload')}};
  for(const [k,v]of Object.entries(values))Object.defineProperty(globalThis,k,{configurable:true,value:v});
  try{await fn({events,messages,actions,notices});}finally{for(const [k,d]of original){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}
test('Обновление сначала дожидается сохранения книги',async()=>browserState(async({events,messages,actions,notices})=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);
  await connectUpdates(async()=>{actions.push('save');await pending;},m=>notices.push(m));
  const updating=events.controllerchange();assert.deepEqual(actions,['check','save']);finish();await updating;assert.deepEqual(actions,['check','save','reload']);assert.deepEqual(messages,['ACTIVATE']);
}));
test('Ошибка сохранения останавливает перезагрузку',async()=>browserState(async({events,actions,notices})=>{
  await connectUpdates(async()=>{throw new Error('storage full');},m=>notices.push(m));await events.controllerchange();assert.ok(!actions.includes('reload'));assert.equal(notices.length,1);
}));
test('Первая установка не перезагружает страницу, следующее обновление перезагружает',async()=>browserState(async({events,actions})=>{
  await connectUpdates(async()=>actions.push('save'),()=>{});await events.controllerchange();assert.deepEqual(actions,['check']);await events.controllerchange();assert.deepEqual(actions,['check','save','reload']);
},false));
