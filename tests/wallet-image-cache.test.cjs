const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../js/wallet-image-cache.js');
test('image cache shares in-flight requests and reuses completed bytes',async()=>{
  const cache=create();let calls=0,finish;
  const loader=()=>{calls++;return new Promise(resolve=>finish=resolve);};
  const a=cache.get('payer:record:file',loader),b=cache.get('payer:record:file',loader);
  await Promise.resolve();finish({size:3});await Promise.all([a,b]);await cache.get('payer:record:file',loader);assert.equal(calls,1);
});
test('image cache expires, evicts least recently used bytes and isolates keys',async()=>{
  let time=0,calls=0;const cache=create({maxBytes:6,ttl:10,now:()=>time}),load=async()=>{calls++;return {size:3};};
  await cache.get('a',load);await cache.get('b',load);await cache.get('a',load);await cache.get('c',load);assert.equal(calls,3);
  await cache.get('b',load);assert.equal(calls,4);time=10;await cache.get('b',load);assert.equal(calls,5);
});
test('image cache never remembers failures or oversized files',async()=>{
  const cache=create({maxBytes:2});let calls=0;
  await assert.rejects(cache.get('bad',async()=>{throw new Error('offline');}));
  await cache.get('bad',async()=>{calls++;return {size:1};});
  const large=async()=>{calls++;return {size:3};};await cache.get('large',large);await cache.get('large',large);assert.equal(calls,3);
});
test('server reuses image bytes but rechecks current ownership before every cached response',async()=>{
  const M=require('../js/wallet-lark-read.js'),{readAttachment}=require('../tools/wallet-lark-source.cjs');
  let payer='ou_alice',downloads=0,searches=0,auth=0;
  const env={...require('./fixtures/wallet-config.cjs'),LARK_APP_ID:'test',LARK_APP_SECRET:'test'};
  const fetcher=async url=>{
    if(url.endsWith('/download')){downloads++;return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});}
    if(url.includes('/auth/')){auth++;return {ok:true,json:async()=>({code:0,tenant_access_token:'test'})};}
    searches++;return {ok:true,json:async()=>({code:0,data:{has_more:false,items:[{record_id:'recABC',fields:{'ทีม/แผนก':M.target.team,[M.payerField]:[{id:payer,name:'Alice'}],'หลักฐานแนบ':[{file_token:'file123',type:'image/png',size:3}]}}]}})};
  };
  const read=()=>readAttachment(env,fetcher,'ou_alice','recABC',0,'file123');
  await Promise.all([read(),read(),read()]);assert.equal(downloads,1);assert.equal(searches,1);assert.equal(auth,1);
  await read();assert.equal(downloads,1);assert.equal(searches,2);
  payer='ou_bob';await assert.rejects(read());assert.equal(downloads,1);assert.equal(searches,3);
});
