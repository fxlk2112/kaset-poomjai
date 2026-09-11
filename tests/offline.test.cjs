const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function worker() {
  const listeners={},stores=new Map(),timers=new Map();let timer=0,skipped=false;
  const key=value=>new URL(typeof value==='string'?value:value.url,'https://example.invalid').pathname;
  const caches={
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());
      const store=stores.get(name);
      return {async put(req,res){store.set(key(req),res.clone());},async match(req){return store.get(key(req))?.clone();}};
    },
    async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}
  };
  const c=vm.createContext({URL,Response,Promise,console,caches,
    setTimeout:(fn,delay)=>{timers.set(++timer,{fn,delay});return timer;},clearTimeout:id=>timers.delete(id),
    fetch:async req=>new Response('online:'+key(req)),
    self:{location:{origin:'https://example.invalid'},clients:{async claim(){}},async skipWaiting(){skipped=true;},addEventListener:(type,fn)=>{listeners[type]=fn;}}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),c);
  async function emit(type,req) {
    const jobs=[];let response;
    listeners[type]({request:req,waitUntil:p=>jobs.push(p),respondWith:p=>{response=p;}});
    if(type!=='fetch')await Promise.all(jobs);
    return response;
  }
  const request=(url,extra={})=>({url:'https://example.invalid'+url,mode:'cors',method:'GET',...extra});
  return {c,emit,request,stores,timers,get skipped(){return skipped;}};
}

test('first installation precaches every local script and stylesheet before taking control',async()=>{
  const w=worker();await w.emit('install');assert.equal(w.skipped,true);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const scripts=[...html.matchAll(/src="(js\/[^?]+)\?/g)].map(m=>'/'+m[1]);
  const styles=[...html.matchAll(/href="(css\/[^?]+)\?/g)].map(m=>'/'+m[1]);
  const cache=[...w.stores.values()][0];
  for(const file of ['/',...styles,...scripts])assert.ok(cache.has(file),file);
});

test('offline navigation with a different query and versioned scripts uses the cached shell',async()=>{
  const w=worker();await w.emit('install');w.c.fetch=async()=>{throw new Error('offline');};
  assert.equal(await (await w.emit('fetch',w.request('/?build=another&landing=1',{mode:'navigate'}))).text(),'online:/');
  assert.equal(await (await w.emit('fetch',w.request('/js/auth.js?v=new'))).text(),'online:/js/auth.js');
});

test('server failures use cache and slow connections fall back after a bounded wait',async()=>{
  const w=worker();await w.emit('install');w.c.fetch=async()=>new Response('failure',{status:503});
  assert.equal(await (await w.emit('fetch',w.request('/js/data.js'))).text(),'online:/js/data.js');
  w.c.fetch=()=>new Promise(()=>{});
  const result=w.emit('fetch',w.request('/js/app.js'));
  while(![...w.timers.values()].some(t=>t.delay===3500))await new Promise(setImmediate);
  [...w.timers.values()].find(t=>t.delay===3500).fn();
  assert.equal(await (await result).text(),'online:/js/app.js');
});

test('failed shell installation leaves previous cache and worker usable',async()=>{
  const w=worker();w.stores.set('farmult-old',new Map());
  w.c.fetch=async req=>new Response('response',{status:req==='/js/auth.js'?503:200});
  await assert.rejects(w.emit('install'));
  assert.equal(w.skipped,false);assert.ok(w.stores.has('farmult-old'));
});

test('activation removes only obsolete app caches and fetch ignores APIs and cross-origin resources',async()=>{
  const w=worker();await w.emit('install');w.stores.set('other-application',new Map());w.stores.set('farmult-old',new Map());
  await w.emit('activate');assert.ok(w.stores.has('other-application'));assert.equal(w.stores.has('farmult-old'),false);
  for(const req of [w.request('/__preview/api'),w.request('/api/private'),w.request('/',{method:'POST'}),w.request('/',{url:'https://private.invalid/photo.jpg'})]) {
    assert.equal(await w.emit('fetch',req),undefined);
  }
});

test('build migration does not unregister the worker or erase the offline cache',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const migration=app.slice(app.indexOf('function ensureFreshAppBuild'),app.indexOf('ensureFreshAppBuild();'));
  assert.doesNotMatch(migration,/caches\.delete|\.unregister\(|location\.replace/);
});
