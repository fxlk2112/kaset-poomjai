const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createPinGate,IDLE,ABSOLUTE,COOLDOWN}=require('../tools/wallet-pin.cjs');
const Vault=require('../js/wallet-vault.js');
const fixture=async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallet-pin-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return path.join(dir,'pin.json');};
test('PIN setup uses a salted hash, blocks re-setup and never persists sessions or plaintext PIN',async t=>{
  const file=await fixture(t),gate=createPinGate(file);
  assert.deepEqual(await gate.status(),{configured:false});assert.equal(gate.valid('none'),false);
  for(const pin of ['',123456,'12345','1234567','abcdef'])await assert.rejects(gate.setup(pin),e=>e.status===400);
  const result=await gate.setup('654321');assert.equal(gate.valid(result.token),true);assert.deepEqual(await gate.status(),{configured:true});
  const raw=await fs.readFile(file,'utf8');assert.ok(!raw.includes('654321'));assert.ok(!raw.includes(result.token));assert.match(result.key,/^[a-f0-9]{64}$/);
  await assert.rejects(gate.setup('123456'),e=>e.status===409);
  const restarted=createPinGate(file);assert.equal(restarted.valid(result.token),false);assert.equal((await restarted.unlock('654321')).key,result.key);
});
test('five wrong PIN attempts block even correct PINs and survive server restart',async t=>{
  const file=await fixture(t);let now=1000000;const gate=createPinGate(file,{now:()=>now});await gate.setup('654321');
  for(let i=0;i<5;i++)await assert.rejects(gate.unlock('123456'),e=>e.status===(i===4?429:401));
  const restarted=createPinGate(file,{now:()=>now});await assert.rejects(restarted.unlock('654321'),e=>e.status===429&&e.retryAfter>0);
  now+=COOLDOWN+1;assert.equal(restarted.valid((await restarted.unlock('654321')).token),true);
});
test('session tokens expire on inactivity or absolute lifetime, and lock revokes all tabs',async t=>{
  const file=await fixture(t);let now=1000;const gate=createPinGate(file,{now:()=>now}),first=await gate.setup('654321');
  now+=IDLE-1;gate.touch(first.token);now+=IDLE-1;assert.equal(gate.valid(first.token),true);now+=2;assert.equal(gate.valid(first.token),false);
  assert.throws(()=>gate.touch(first.token),e=>e.status===401);
  const second=await gate.unlock('654321'),third=await gate.unlock('654321');gate.lock(second.token);assert.equal(gate.valid(third.token),false);
  const fresh=await gate.unlock('654321');for(let i=0;i<ABSOLUTE/60000;i++){now+=60000;if(i<ABSOLUTE/60000-1)gate.touch(fresh.token);}assert.equal(gate.valid(fresh.token),false);
});
test('parallel setup attempts cannot replace PIN and malformed stored settings fail closed',async t=>{
  const file=await fixture(t),gate=createPinGate(file),results=await Promise.allSettled([gate.setup('654321'),gate.setup('123456')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await fs.writeFile(file,'not json');await assert.rejects(gate.status(),e=>e.status===503);await assert.rejects(gate.setup('654321'),e=>e.status===503);
});
function memoryStore(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('recovery rotates single-use codes, revokes sessions and preserves encrypted records and photos',async t=>{
  const file=await fixture(t),gate=createPinGate(file),first=await gate.setup('654321'),store=memoryStore();
  assert.match(first.recoveryCode,/^([A-F0-9]{4}-){9}[A-F0-9]{4}$/);
  const vault=await Vault.create(first.key,store);await vault.setItem('wallet','original money');const photo=await vault.seal(new Uint8Array([4,5,6]),'photo');
  const raw=await fs.readFile(file,'utf8');assert.ok(!raw.includes(first.recoveryCode));assert.ok(!raw.includes(first.recoveryCode.replaceAll('-','')));
  const other=await gate.unlock('654321');assert.equal(other.recoveryCode,undefined);
  const restored=await gate.recover(first.recoveryCode.toLowerCase().replaceAll('-',' '),'123456');
  assert.equal(restored.key,first.key);assert.notEqual(restored.recoveryCode,first.recoveryCode);assert.equal(gate.valid(first.token),false);assert.equal(gate.valid(other.token),false);
  await assert.rejects(gate.unlock('654321'),e=>e.status===401);assert.equal((await gate.unlock('123456')).key,first.key);
  await assert.rejects(gate.recover(first.recoveryCode,'222222'),e=>e.status===401);
  const reopened=await Vault.create(restored.key,store);await reopened.load(['wallet']);assert.equal(reopened.getItem('wallet'),'original money');assert.deepEqual([...new Uint8Array(await reopened.open(photo,'photo'))],[4,5,6]);
  assert.equal((await createPinGate(file).recover(restored.recoveryCode,'333333')).key,first.key);
});
test('recovery needs session plus current PIN to issue a code, including legacy settings',async t=>{
  const file=await fixture(t),gate=createPinGate(file),first=await gate.setup('654321');
  await assert.rejects(gate.recovery('invalid','654321'),e=>e.status===401);await assert.rejects(gate.recovery(first.token,'123456'),e=>e.status===401);
  const value=JSON.parse(await fs.readFile(file,'utf8'));delete value.recoveryHash;delete value.recoveryFailures;delete value.recoveryBlockedUntil;await fs.writeFile(file,JSON.stringify(value));
  await assert.rejects(gate.recover(first.recoveryCode,'123456'),e=>e.status===409);
  const generated=await gate.recovery(first.token,'654321');assert.equal((await gate.recover(generated.recoveryCode,'123456')).key,first.key);
});
test('recovery throttling persists across restarts and malformed PIN does not consume a valid code',async t=>{
  const file=await fixture(t);let now=1000000;const gate=createPinGate(file,{now:()=>now}),first=await gate.setup('654321');
  await assert.rejects(gate.recover(first.recoveryCode,'bad'),e=>e.status===400);
  for(let i=0;i<5;i++)await assert.rejects(gate.recover('invalid','123456'),e=>e.status===(i===4?429:401));
  const restart=createPinGate(file,{now:()=>now});await assert.rejects(restart.recover(first.recoveryCode,'123456'),e=>e.status===429);
  now+=COOLDOWN+1;assert.equal((await restart.recover(first.recoveryCode,'123456')).key,first.key);
});
test('concurrent recoveries consume a code once and malformed recovery settings fail closed',async t=>{
  const file=await fixture(t),gate=createPinGate(file),first=await gate.setup('654321');
  const results=await Promise.allSettled([gate.recover(first.recoveryCode,'123456'),gate.recover(first.recoveryCode,'222222')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const value=JSON.parse(await fs.readFile(file,'utf8'));value.recoveryHash='bad';await fs.writeFile(file,JSON.stringify(value));await assert.rejects(gate.status(),e=>e.status===503);
});
test('vault migrates local records losslessly and stores only authenticated ciphertext',async()=>{
  const storage=memoryStore(),key='ab'.repeat(32),plain=JSON.stringify({income:[{cents:500000,title:'private income'}]});storage.setItem('wallet',plain);
  const vault=await Vault.create(key,storage);await vault.load(['wallet']);assert.equal(vault.getItem('wallet'),plain);assert.equal(storage.getItem('wallet'),null);assert.ok(![...storage.map.values()].join('').includes('private income'));
  const again=await Vault.create(key,storage);await again.load(['wallet']);assert.equal(again.getItem('wallet'),plain);
  await vault.setItem('wallet','updated');vault.clear();assert.throws(()=>vault.getItem('wallet'));await assert.rejects(vault.setItem('wallet','bad'));
  const restored=await Vault.create(key,storage);await restored.load(['wallet']);assert.equal(restored.getItem('wallet'),'updated');
});
test('failed encryption persistence keeps original data; wrong keys and contexts cannot decrypt',async()=>{
  const store=memoryStore();store.setItem('wallet','original');store.setItem=()=>{throw new Error('quota');};const vault=await Vault.create('ab'.repeat(32),store);await assert.rejects(vault.load(['wallet']));assert.equal(store.getItem('wallet'),'original');
  const encrypted=await vault.seal(new Uint8Array([1,2,3]),'photo:id');assert.deepEqual([...new Uint8Array(await vault.open(encrypted,'photo:id'))],[1,2,3]);
  await assert.rejects(vault.open(encrypted,'photo:other'));const other=await Vault.create('cd'.repeat(32),memoryStore());await assert.rejects(other.open(encrypted,'photo:id'));
  encrypted.data[0]^=1;await assert.rejects(vault.open(encrypted,'photo:id'));
});
test('page boots locked and cannot load cached wallet UI until authenticated',async()=>{
  const root=path.join(__dirname,'..'),read=p=>fs.readFile(path.join(root,p),'utf8');
  const html=await read('wallet-preview.html'),ui=await read('js/wallet-read-ui.js'),gate=await read('js/wallet-access.js'),server=await read('tools/wallet-read-server.cjs');
  assert.match(html,/<body class="wallet-locked">/);assert.doesNotMatch(html,/<script src="js\/wallet-read-ui.js/);
  assert.doesNotMatch(ui,/localStorage\./);assert.match(ui,/WalletAccess.fetch\('/);assert.match(ui,/WalletAccess.fetch\(url/);
  assert.ok(gate.indexOf('await vault.load(')<gate.indexOf("await script('js/wallet-read-ui.js')"));
  assert.ok(server.indexOf('if(!pin.valid(token))')<server.indexOf("if(url.pathname==='/__wallet/attachment')"));
  assert.match(gate,/vault\?\.clear\(\)/);assert.match(gate,/event.persisted/);
});
test('HTTP guards protect every Lark route, reject other origins and recheck in-flight reads',async t=>{
  const vm=require('node:vm'),{Readable}=require('node:stream'),{createRequire}=require('node:module');
  const file=await fixture(t),gate=createPinGate(file),filename=path.join(__dirname,'../tools/wallet-read-server.cjs'),realRequire=createRequire(filename);
  let handler,calls=0,pendingResolve;
  const reqModule=name=>name==='./wallet-config.cjs'?{...realRequire(name),loadPrivateEnv:()=>require('./fixtures/wallet-config.cjs'),receiptCells:()=>({})}:name==='node:http'?{createServer:fn=>{handler=fn;return {listen(){}};}}:name==='./wallet-pin.cjs'?{createPinGate:()=>gate}:name==='./wallet-lark-source.cjs'?{readPayers:async()=>{calls++;return {payers:[]};},readExpenses:async()=>{calls++;return await new Promise(resolve=>{pendingResolve=resolve;});},readAttachment:async()=>{calls++;return {bytes:Buffer.from('image'),type:'image/png'};}}:realRequire(name);
  vm.runInNewContext(await fs.readFile(filename,'utf8'),{require:reqModule,__dirname:path.dirname(filename),process:{argv:['node',filename,'4208'],env:{}},Buffer,URL,console,fetch});
  const request=(url,{token,origin='http://127.0.0.1:4208',method='POST',body={}}={})=>new Promise((resolve,reject)=>{
    const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{url,method,headers:{host:'127.0.0.1:4208',origin,'x-wallet-preview':'1',...(token?{'x-wallet-session':token}:{})}});
    let status;const res={writeHead:s=>{status=s;},end:data=>resolve({status,body:String(data)})};Promise.resolve(handler(req,res)).catch(reject);
  });
  const owner=realRequire('../js/wallet-lark-read.js').owner.id;
  for(const url of ['/__wallet/payers','/__wallet/lark?payer='+owner,'/__wallet/attachment?payer='+owner])assert.equal((await request(url)).status,401);
  assert.equal(calls,0);assert.equal((await request('/__wallet/pin/setup',{origin:'https://example.com',body:{pin:'654321'}})).status,403);assert.deepEqual(await gate.status(),{configured:false});
  const setup=await request('/__wallet/pin/setup',{body:{pin:'654321'}});assert.equal(setup.status,200);const {token}=JSON.parse(setup.body);
  assert.equal((await request('/__wallet/payers',{token})).status,200);
  assert.equal((await request('/__wallet/payers',{token,method:'GET'})).status,403);
  assert.equal((await request('/tools/.wallet-private/pin.json',{method:'GET'})).status,404);
  const inflight=request('/__wallet/lark?payer='+owner,{token});
  await new Promise(resolve=>setImmediate(resolve));gate.lock(token);pendingResolve({expenses:[]});assert.equal((await inflight).status,401);
  assert.equal((await request('/__wallet/attachment?payer='+owner,{token})).status,401);
  assert.equal((await request('/__wallet/pin/recovery',{body:{pin:'654321'}})).status,401);
  assert.equal((await request('/__wallet/pin/recover',{origin:'https://example.com',body:{code:JSON.parse(setup.body).recoveryCode,pin:'123456'}})).status,403);
  const recovered=await request('/__wallet/pin/recover',{body:{code:JSON.parse(setup.body).recoveryCode,pin:'123456'}});assert.equal(recovered.status,200);
  assert.equal(JSON.parse(recovered.body).key,JSON.parse(setup.body).key);
  assert.equal((await request('/__wallet/pin/recover',{body:{code:JSON.parse(setup.body).recoveryCode,pin:'222222'}})).status,401);
  assert.equal((await request('/__wallet/pin/recover',{body:null})).status,400);
  for(const url of ['/__wallet/oauth/start','/__wallet/oauth/logout','/__wallet/member/context','/__wallet/member/lark']){
    assert.equal((await request(url,{origin:'https://example.com'})).status,403);
    assert.equal((await request(url,{method:'GET'})).status,403);
  }
  assert.equal((await request('/__wallet/member/lark',{token})).status>=400,true);
});
