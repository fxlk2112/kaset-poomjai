'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{Readable}=require('node:stream');
const {createMemberRoutes}=require('../tools/wallet-member-routes.cjs');
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallet-members-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const people={alice:{id:'ou_alice',name:'Same Name',tenant:'tenantA'},bob:{id:'ou_bob',name:'Same Name',tenant:'tenantA'},otherTenant:{id:'ou_alice',name:'Same Name',tenant:'tenantB'}};
  const sessions=new Set(Object.keys(people)),calls=[];let pending=null;
  const auth={authenticate:async cookie=>{if(!sessions.has(cookie))throw Object.assign(new Error('login'),{status:401});return people[cookie];},valid:cookie=>sessions.has(cookie)};
  const handler=createMemberRoutes({auth,directory:dir,env:{...require('./fixtures/wallet-config.cjs'),LARK_APP_ID:'app'},read:{readExpenses:async(...args)=>{calls.push(['expenses',...args.slice(2)]);if(pending)await pending;return {expenses:[],source:{payerId:args[2],team:args[3]}};},readAttachment:async(...args)=>{calls.push(['attachment',...args.slice(2)]);return {bytes:Buffer.from('test'),type:'image/png'};}}});
  const scopeFor=cookie=>'farm-wallet-read-v1:lark:'+require('node:crypto').createHash('sha256').update(JSON.stringify(['app',people[cookie]?.tenant,people[cookie]?.id])).digest('hex');
  async function request(action,{cookie='alice',token,body={},scope=scopeFor(cookie)}={}){
    const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.headers={cookie,'x-wallet-session':token,'x-wallet-scope':scope};
    try{let output;await handler(req,new URL('http://127.0.0.1:4208/__wallet/member/'+action),(status,body,type)=>{output={status,body:type?body:JSON.parse(body)};});return output;}catch(e){return {status:e.status||500,error:e.message};}
  }
  return {request,calls,sessions,setPending:p=>pending=p,dir};
}
test('Lark identity, not submitted name or payer, owns wallet and PIN',async t=>{
  const f=await fixture(t);assert.equal((await f.request('context',{cookie:'stranger'})).status,401);
  const alice=(await f.request('context')).body,bob=(await f.request('context',{cookie:'bob'})).body,tenant=(await f.request('context',{cookie:'otherTenant'})).body;
  assert.equal(alice.owner.id,'ou_alice');assert.equal(alice.target.team,null);assert.notEqual(alice.storageBase,bob.storageBase);assert.notEqual(alice.profileKey,bob.profileKey);assert.notEqual(alice.storageBase,tenant.storageBase);
  assert.equal((await f.request('pin/setup',{cookie:'bob',scope:alice.storageBase,body:{pin:'654321'}})).status,401);
  assert.equal((await f.request('pin/setup',{scope:'',body:{pin:'654321'}})).status,401);
  const setup=(await f.request('pin/setup',{body:{pin:'654321',payer:'ou_bob',name:'attacker'}})).body;
  assert.equal((await f.request('pin/status',{cookie:'bob'})).body.configured,false);
  assert.equal((await f.request('lark',{cookie:'bob',token:setup.token})).status,401);
  assert.equal((await f.request('lark?payer=ou_bob',{token:setup.token})).status,403);
  assert.equal((await f.request('lark?team=Sales',{token:setup.token})).status,403);
  assert.equal(f.calls.length,0);
  const payers=await f.request('payers',{token:setup.token});assert.deepEqual(payers.body.payers,[alice.owner]);
  assert.equal((await f.request('lark?payer=ou_alice',{token:setup.token})).status,200);assert.deepEqual(f.calls[0],['expenses','ou_alice',null]);
  assert.equal((await f.request('attachment?payer=ou_bob&record=rec1&index=0&file=file1',{token:setup.token})).status,403);
  assert.equal((await f.request('attachment?payer=ou_alice&record=rec1&index=0&file=file1',{token:setup.token})).status,200);assert.deepEqual(f.calls[1],['attachment','ou_alice','rec1',0,'file1',null]);
});
test('each Lark person has distinct vault key and recovery code, and cannot recover another wallet',async t=>{
  const f=await fixture(t),alice=(await f.request('pin/setup',{body:{pin:'654321'}})).body,bob=(await f.request('pin/setup',{cookie:'bob',body:{pin:'654321'}})).body;
  assert.notEqual(alice.key,bob.key);assert.notEqual(alice.recoveryCode,bob.recoveryCode);
  assert.equal((await f.request('pin/recover',{cookie:'bob',body:{code:alice.recoveryCode,pin:'123456'}})).status,401);
  const recovered=await f.request('pin/recover',{body:{code:alice.recoveryCode,pin:'123456'}});assert.equal(recovered.body.key,alice.key);
  assert.equal((await f.request('lark',{cookie:'bob',token:bob.token})).status,200);
});
test('session expiry or logout during an in-flight read never releases the response',async t=>{
  const f=await fixture(t),setup=(await f.request('pin/setup',{body:{pin:'654321'}})).body;let release;f.setPending(new Promise(resolve=>release=resolve));
  const result=f.request('lark',{token:setup.token});await new Promise(resolve=>setImmediate(resolve));f.sessions.delete('alice');release();assert.equal((await result).status,401);
  assert.equal((await f.request('pin/unlock',{body:{pin:'654321'}})).status,401);
});
test('member UI separates cached ledger, evidence and receipt profile from the legacy wallet',async()=>{
  const read=file=>fs.readFile(path.join(__dirname,'..',file),'utf8'),access=await read('js/wallet-access.js'),ui=await read('js/wallet-read-ui.js'),receipt=await read('js/wallet-receipt.js');
  assert.match(access,/context\?\.storageBase/);assert.match(access,/profileKey\(\)/);assert.match(ui,/WalletAccess.context\?\.storageBase/);assert.match(ui,/payerSelect'\)\.disabled=true/);assert.match(receipt,/WalletAccess.profileKey/);assert.match(receipt,/WalletAccess.context\?\.owner.name/);
  assert.doesNotMatch(access,/localStorage\.setItem\([^\n]*(token|identity)/);
});
test('logout invalidates every asynchronous unlock phase and cannot reveal a stale wallet',async()=>{
  const vm=require('node:vm'),source=await fs.readFile(path.join(__dirname,'../js/wallet-access.js'),'utf8');
  const enter=source.slice(source.indexOf('  async function enter('),source.indexOf('  async function oauth('));
  for(const phase of ['config','create','load','evidence','script']){
    let release,reached=false,revealed=0,cleared=0;const pending=new Promise(resolve=>release=resolve);
    const pause=async current=>{if(current===phase){reached=true;await pending;}};
    const fakeVault={load:()=>pause('load'),clear:()=>cleared++};
    const ctx={accessEpoch:1,context:{storageBase:'account-a'},legacyContext:null,memberMode:true,scopeHeaders:()=>({}),AbortSignal,WalletLarkRead:{target:{}},fetch:async()=>{await pause('config');return {ok:true,json:async()=>({})};},profileKey:()=> 'profile-a',Date,localStorage:{},token:'',unlocked:false,vault:null,
      WalletVault:{create:async()=>{await pause('create');return fakeVault;}},WalletEvidence:{secure:()=>pause('evidence')},
      script:()=>pause('script'),document:{body:{classList:{remove:()=>revealed++}}}};
    vm.createContext(ctx);vm.runInContext("function ensureCurrent(epoch){if(epoch!==accessEpoch)throw Object.assign(new Error('cancelled'),{cancelled:true});}\n"+enter,ctx);
    const opening=ctx.enter({token:'test-session',key:'test-key',expiresAt:Date.now()+100000,idleMs:300000},1);
    await new Promise(resolve=>setImmediate(resolve));assert.equal(reached,true,phase);
    ctx.accessEpoch++;ctx.unlocked=false;ctx.vault?.clear();release();
    await assert.rejects(opening,e=>e.cancelled===true);assert.equal(ctx.unlocked,false);assert.equal(revealed,0);if(phase!=='config')assert.ok(cleared>=1);
  }
});
