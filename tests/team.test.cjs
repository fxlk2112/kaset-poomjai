const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {localD1}=require('../tools/local-d1.cjs');
const {localR2}=require('../tools/local-r2.cjs');
const root=path.join(__dirname,'..');
const owner={user_id:'owner',email:'owner@example.invalid'},member={user_id:'member',email:'member@example.invalid'},stranger={user_id:'other',email:'other@example.invalid'};
const state=()=>({plots:[{id:'p',name:'Assigned',secret:'NOPE',lat:99},{id:'private',name:'SECRET'}],cycles:[{id:'c',plotId:'p',plant:'Corn',round:1,startDate:'2026-01-01',status:'active',cost:999}],tasks:[],stock:[{id:'private-stock',qty:100}],sales:[{revenue:123}],trials:[{id:'tr',name:'Test',status:'active',plotId:'p',startDate:'2026-01-01',collectionMode:'sampling',sampleCount:3,metrics:[{id:'m',name:'จำนวนแมลง',unit:'ตัว',valueKind:'count'}],treatments:[{id:'t',code:'T1',name:'secret formula',ingredients:['SECRET']}],units:[{id:'u',treatmentId:'t',plotId:'p',section:'Left'},{id:'hidden',plotId:'private'}],observations:[{id:'private-result',value:999}]}]});
const payload=()=>({type:'inspect',plotId:'p',cycleId:'c',date:'2026-09-01',workStatus:'done',title:'Inspect',checks:{growth:'ปกติ'},points:[{heightCm:40,pestCount:0,examinedPlants:10}],photos:[],cost:999,stockLog:[{id:'hack'}]});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8N0AAAAASUVORK5CYII=';

test('pending watering edits update the same record with revision and approval guards',async()=>{
  const t=await setup();try{
    const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['water']});
    await t.call('team_accept',{invite:g.invite},member);
    const input={grantId:g.id,id:'pending-water',payload:{...payload(),type:'water',wateringMinutes:30}};
    await t.call('team_submit',input,member);
    const edit={...input,revision:1,payload:{...input.payload,wateringMinutes:45}};
    await assert.rejects(t.call('team_submit',edit,stranger));
    await assert.rejects(t.call('team_submit',{...edit,revision:undefined},member));
    assert.equal((await t.call('team_submit',edit,member)).revision,2);
    assert.equal((await t.call('team_submit',edit,member)).revision,2);
    const rows=await t.call('team_inbox');assert.equal(rows.length,1);
    assert.equal(JSON.parse(rows[0].payload).wateringMinutes,45);
    assert.equal((await ownerState(t)).tasks.length,0);
    await assert.rejects(t.call('team_review',{id:input.id,revision:1,decision:'approve'}));
    await assert.rejects(t.call('team_submit',{...edit,payload:{...edit.payload,wateringMinutes:60}},member));
    await t.call('team_review',{id:input.id,revision:2,decision:'approve'});
    await assert.rejects(t.call('team_submit',{...edit,revision:3,payload:{...edit.payload,wateringMinutes:60}},member),/รับรองแล้ว/);
    assert.equal((await ownerState(t)).tasks[0].wateringSessions[0].minutes,45);
    assert.equal((await t.call('team_history',{id:input.id})).length,3);
  }finally{t.db.close();}
});

test('pending spray edits do not deduct stock until the latest version is approved',async()=>{
  const t=await materialSetup();try{
    const input={grantId:t.g.id,id:'pending-spray',payload:materialPayload()},before=await ownerState(t);
    await t.call('team_submit',input,member);
    const materials=[{stockId:'bottle',qty:2,unit:'bottle'},{source:'external',name:'Outside',qty:20,unit:'ml'}];
    await t.call('team_submit',{...input,revision:1,payload:{...input.payload,materials}},member);
    assert.deepEqual(await ownerState(t),before);
    await t.call('team_review',{id:input.id,revision:2,decision:'approve',confirmMaterials:true});
    const after=await ownerState(t);assert.equal(after.tasks.length,1);
    assert.equal(after.tasks[0].cost,100);
    assert.deepEqual(after.stock.find(s=>s.id==='bag'),before.stock.find(s=>s.id==='bag'));
    assert.equal(after.tasks[0].reportedMaterials[1].name,'Outside');
  }finally{t.db.close();}
});

test('approval that wins the race prevents a pending edit from overwriting approved data',async()=>{
  const t=await setup();try{
    const g=await active(t),input={grantId:g.id,id:'approval-race',payload:payload()};
    await t.call('team_submit',input,member);
    const batch=t.db.batch;t.db.batch=async statements=>{
      t.db.batch=batch;await t.call('team_review',{id:input.id,revision:1,decision:'approve'});
      return batch(statements);
    };
    await assert.rejects(t.call('team_submit',{...input,revision:1,payload:{...input.payload,note:'Late edit'}},member));
    const [s]=await t.call('team_inbox');assert.equal(s.status,'approved');
    assert.notEqual(JSON.parse(s.payload).note,'Late edit');
    assert.equal((await ownerState(t)).tasks.length,1);
    assert.equal((await t.call('team_history',{id:input.id})).length,2);
  }finally{t.db.close();}
});

test('a concurrent collector edit forces the owner to review the new version',async()=>{
  const t=await setup();try{
    const g=await active(t),input={grantId:g.id,id:'edit-race',payload:payload()};
    await t.call('team_submit',input,member);
    const batch=t.db.batch;t.db.batch=async statements=>{
      t.db.batch=batch;await t.call('team_submit',{...input,revision:1,payload:{...input.payload,note:'Updated'}},member);
      return batch(statements);
    };
    await assert.rejects(t.call('team_review',{id:input.id,revision:1,decision:'approve'}));
    const [s]=await t.call('team_inbox');assert.equal(s.status,'pending');assert.equal(s.revision,2);
    assert.equal((await ownerState(t)).tasks.length,0);
  }finally{t.db.close();}
});

test('renewing an expired invitation preserves its scopes and replaces the single-use token',async()=>{
  const t=await setup();try{
    const before=await ownerState(t),g=await t.call('team_invite',{email:member.email,plots:['p'],types:['inspect']});
    await t.db.prepare('UPDATE team_grants SET expires_at=1 WHERE id=?').bind(g.id).run();
    const old=(await t.call('team_members'))[0];
    const renewed=await t.call('team_renew_invite',{grantId:g.id,revision:old.revision});
    assert.notEqual(renewed.invite,g.invite);assert.ok(renewed.expiresAt>Date.now()+6*86400000);
    const rows=await t.call('team_members');assert.equal(rows.length,1);
    assert.equal(rows[0].scopes,old.scopes);assert.equal(rows[0].email,old.email);
    assert.equal(rows[0].revision,old.revision+1);assert.equal(JSON.stringify(rows).includes(renewed.invite),false);
    const stored=await t.db.prepare('SELECT invite_hash FROM team_grants WHERE id=?').bind(g.id).first();
    assert.notEqual(stored.invite_hash,renewed.invite);
    await assert.rejects(t.call('team_accept',{invite:g.invite},member));
    await assert.rejects(t.call('team_accept',{invite:renewed.invite},stranger));
    await t.call('team_accept',{invite:renewed.invite},member);
    await assert.rejects(t.call('team_accept',{invite:renewed.invite},member));
    assert.deepEqual(await ownerState(t),before);
  }finally{t.db.close();}
});

test('renewal requires owner, current revision and an unaccepted, non-revoked invitation',async()=>{
  const t=await setup();try{
    const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['inspect']});
    const request={grantId:g.id,revision:1};
    for(const u of [member,stranger])await assert.rejects(t.call('team_renew_invite',request,u));
    await assert.rejects(t.call('team_renew_invite',{grantId:g.id}));
    const r=await t.call('team_renew_invite',request);
    await assert.rejects(t.call('team_renew_invite',request));
    await t.call('team_accept',{invite:r.invite},member);
    await assert.rejects(t.call('team_renew_invite',{grantId:g.id,revision:3}));
    await t.call('team_revoke',{grantId:g.id});
    await assert.rejects(t.call('team_renew_invite',{grantId:g.id,revision:4}));
  }finally{t.db.close();}
});

test('accepting an invitation during renewal cannot reactivate or replace it',async()=>{
  const t=await setup();try{
    const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['inspect']});
    const prepare=t.db.prepare.bind(t.db);let raced=false;
    t.db.prepare=sql=>{
      if(sql.startsWith('UPDATE team_grants SET invite_hash='))return {bind(...args){return {async run(){
        if(!raced){raced=true;await t.call('team_accept',{invite:g.invite},member);}
        return prepare(sql).bind(...args).run();
      }};}};
      return prepare(sql);
    };
    await assert.rejects(t.call('team_renew_invite',{grantId:g.id,revision:1}));
    assert.equal((await t.call('team_members'))[0].status,'active');
  }finally{t.db.close();}
});

test('watering minutes survive submit, return, resubmit and approval as ordinary watering sessions',async()=>{
  const t=await setup();try{
    const before=await ownerState(t),g=await t.call('team_invite',{email:member.email,plots:['p'],types:['water']});
    await t.call('team_accept',{invite:g.invite},member);
    const p={...payload(),type:'water',wateringMinutes:'30'};
    await t.call('team_submit',{grantId:g.id,id:'water-duration',payload:p},member);
    assert.equal(JSON.parse((await t.call('team_inbox'))[0].payload).wateringMinutes,30);
    await t.call('team_review',{id:'water-duration',revision:1,decision:'return',note:'Check duration'});
    await t.call('team_submit',{grantId:g.id,id:'water-duration',revision:2,payload:{...p,wateringMinutes:45}},member);
    await t.call('team_review',{id:'water-duration',revision:3,decision:'approve'});
    const s=await ownerState(t);assert.equal(s.tasks[0].wateringSessions[0].minutes,45);
    assert.equal(s.tasks[0].wateringSessions[0].status,'done');assert.equal(s.tasks[0].cost,0);
    assert.deepEqual(s.stock,before.stock);assert.deepEqual(s.water,before.water);
  }finally{t.db.close();}
});

test('watering accepts legacy and failed records without duration but rejects invalid minutes',async()=>{
  const t=await setup();try{
    const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['water','inspect']});
    await t.call('team_accept',{invite:g.invite},member);const ctx=await t.call('team_context',{grantId:g.id},member);
    for(const wateringMinutes of ['',null,undefined]){
      const p={...payload(),type:'water',workStatus:'failed',wateringMinutes};assert.equal(t.cleanSubmission(p,ctx).wateringMinutes,null);
    }
    for(const wateringMinutes of [-1,0,1.5,1441,'bad',true])assert.throws(()=>t.cleanSubmission({...payload(),type:'water',wateringMinutes},ctx));
    assert.equal(t.cleanSubmission({...payload(),wateringMinutes:20},ctx).wateringMinutes,undefined);
    await t.call('team_submit',{grantId:g.id,id:'water-failed',payload:{...payload(),type:'water',workStatus:'failed',wateringMinutes:10}},member);
    await t.call('team_review',{id:'water-failed',revision:1,decision:'approve'});
    assert.equal((await ownerState(t)).tasks[0].wateringSessions[0].status,'failed');
  }finally{t.db.close();}
});

async function materialSetup(){
  const t=await setup(),s=state();
  s.stock=[{id:'bottle',name:'Product A',unit:'bottle',size:'1 litre',qty:10,openQty:.25,avgCost:50,supplier:'SECRET',salePrice:80},{id:'bag',name:'Product B',unit:'bag',qty:10,openQty:0,avgCost:100}];
  await t.db.prepare('UPDATE user_data SET data=? WHERE user_id=?').bind(JSON.stringify(s),'owner').run();
  const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['spray','fertilize','inspect']});
  await t.call('team_accept',{invite:g.invite},member);
  return {...t,g,s};
}
const materialPayload=()=>({...payload(),type:'spray',materials:[{stockId:'bottle',qty:1.5,unit:'bottle',name:'FORGED',unitCost:1},{stockId:'bag',qty:2,unit:'bag'}]});
const ownerState=async t=>JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);

test('spray and fertilizer rates survive pending edits and approval without changing stock math',async()=>{
  for(const type of ['spray','fertilize']){
    const t=await materialSetup();try{
      const p={...materialPayload(),type,materials:[{stockId:'bottle',qty:1,unit:'bottle',rate:' 20 ml / 20 L '},{source:'external',name:'Outside',qty:2,unit:'kg',rate:'25 kg / rai'}]};
      const input={grantId:t.g.id,id:'rate-'+type,payload:p};
      await t.call('team_submit',input,member);
      p.materials[0].rate='30 ml / 20 L';
      await t.call('team_submit',{...input,revision:1},member);
      const [s]=await t.call('team_inbox');assert.equal(JSON.parse(s.payload).materials[0].rate,'30 ml / 20 L');
      await t.call('team_review',{id:input.id,revision:2,decision:'approve',confirmMaterials:true});
      const task=(await ownerState(t)).tasks[0];
      assert.equal(task.reportedMaterials[0].rate,'30 ml / 20 L');assert.equal(task.reportedMaterials[1].rate,'25 kg / rai');
      assert.equal(task.cost,50);
    }finally{t.db.close();}
  }
});

test('rates are optional bounded text and are not invented for legacy records',async()=>{
  const t=await materialSetup();try{
    const ctx=await t.call('team_context',{grantId:t.g.id},member);
    for(const rate of [undefined,null,'','  ']){
      const p=materialPayload();p.materials[0].rate=rate;
      assert.equal(t.cleanSubmission(p,ctx).materials[0].rate,undefined);
    }
    for(const rate of [123,{},[],true,'x'.repeat(121)]){
      const p=materialPayload();p.materials[0].rate=rate;assert.throws(()=>t.cleanSubmission(p,ctx));
    }
  }finally{t.db.close();}
});

test('structured application data survives submit, edit and approval; only actual quantities affect costs',async()=>{
  const t=await materialSetup();try{
    const p={...materialPayload(),applicationWork:{waterLitres:200,areaRai:3},materials:[{stockId:'bottle',unit:'bottle',qty:1,rate:'forged',dose:{amount:20,unit:'ml',per:20,basis:'water'}}]};
    const input={grantId:t.g.id,id:'structured',payload:p};
    await t.call('team_submit',input,member);const before=await ownerState(t);
    p.applicationWork.waterLitres=300;
    await t.call('team_submit',{...input,revision:1},member);
    assert.deepEqual(await ownerState(t),before);
    const [s]=await t.call('team_inbox');assert.equal(JSON.parse(s.payload).materials[0].rate,'20 มล. (ซีซี) ต่อน้ำ 20 ลิตร');
    await t.call('team_review',{id:input.id,revision:2,decision:'approve',confirmMaterials:true});
    const task=(await ownerState(t)).tasks[0];assert.equal(task.applicationWork.waterLitres,300);
    assert.equal(task.reportedMaterials[0].dose.per,20);assert.equal(task.cost,50);assert.equal(task.costItems[0].qty,1);
  }finally{t.db.close();}
});

test('malformed structured rates and work totals cannot bypass server validation',async()=>{
  const t=await materialSetup();try{
    const ctx=await t.call('team_context',{grantId:t.g.id},member),p=materialPayload();
    for(const dose of [{amount:1,unit:'ml',per:0,basis:'water'},{amount:1,unit:'bottle',per:20,basis:'water'},{amount:1},'bad']){
      p.materials[0].dose=dose;assert.throws(()=>t.cleanSubmission(p,ctx));
    }
    delete p.materials[0].dose;
    for(const waterLitres of [0,-1,true,'bad'])assert.throws(()=>t.cleanSubmission({...p,applicationWork:{waterLitres}},ctx));
  }finally{t.db.close();}
});

test('external materials are recorded without stock, fabricated cost or automatic catalog additions',async()=>{
  const t=await materialSetup();try{
    const external={source:'external',name:'Outside product',unit:'ml',qty:250,unitCost:999,totalCost:12345};
    await t.call('team_submit',{grantId:t.g.id,id:'external-only',payload:{...materialPayload(),materials:[external]}},member);
    await t.call('team_review',{id:'external-only',revision:1,decision:'approve'});
    const s=await ownerState(t);assert.deepEqual(s.stock,t.s.stock);
    assert.equal(s.tasks[0].cost,0);assert.deepEqual(s.tasks[0].costItems,[]);
    assert.deepEqual(s.tasks[0].reportedMaterials,[{source:'external',name:'Outside product',unit:'ml',qty:250}]);
    assert.equal(s.tasks[0].stockLog,undefined);
  }finally{t.db.close();}
});

test('mixed material submissions consume and price only selected inventory items',async()=>{
  const t=await materialSetup();try{
    const p=materialPayload();p.materials.push({source:'external',name:'Outside',unit:'g',qty:12});
    await t.call('team_submit',{grantId:t.g.id,id:'mixed',payload:p},member);
    await assert.rejects(t.call('team_review',{id:'mixed',revision:1,decision:'approve'}));
    await t.call('team_review',{id:'mixed',revision:1,decision:'approve',confirmMaterials:true});
    const s=await ownerState(t);assert.equal(s.tasks[0].cost,275);assert.equal(s.tasks[0].costItems.length,2);
    assert.equal(s.tasks[0].reportedMaterials.length,3);assert.equal(s.stock.length,t.s.stock.length);
  }finally{t.db.close();}
});

test('external material validation rejects empty, duplicate, malformed and disguised stock rows',async()=>{
  const t=await materialSetup();try{
    const ctx=await t.call('team_context',{grantId:t.g.id},member),base={source:'external',name:'Outside',unit:'ml',qty:1};
    for(const row of [null,{...base,name:''},{...base,unit:' '},{...base,stockId:'bottle'},{...base,qty:0},{...base,qty:1e10},{...base,name:'x'.repeat(161)},{...base,source:'unknown'}]){
      assert.throws(()=>t.cleanSubmission({...materialPayload(),materials:[row]},ctx));
    }
    assert.throws(()=>t.cleanSubmission({...materialPayload(),materials:[base,{...base,name:' OUTSIDE '}]},ctx));
    assert.throws(()=>t.cleanSubmission({...payload(),materials:[base]},ctx));
    ctx.materials=[];assert.equal(t.cleanSubmission({...materialPayload(),materials:[base]},ctx).materials[0].source,'external');
  }finally{t.db.close();}
});

test('material picker exposes only names, units and size, never balances or prices',async()=>{
  const t=await materialSetup();try{
    const ctx=await t.call('team_context',{grantId:t.g.id},member);
    assert.deepEqual(Object.keys(ctx.materials[0]).sort(),['id','name','size','unit']);
    for(const secret of ['SECRET','avgCost','salePrice','openQty','supplier'])assert.equal(JSON.stringify(ctx).includes(secret),false);
    assert.deepEqual(t.teamContext(t.s,{plots:['p'],types:['inspect']}).materials,[]);
  }finally{t.db.close();}
});

test('materials validate identifiers, duplicates, quantities and stale units',async()=>{
  const t=await materialSetup();try{
    const ctx=await t.call('team_context',{grantId:t.g.id},member),p=materialPayload();
    const clean=t.cleanSubmission(p,ctx);
    assert.equal(clean.materials[0].name,'Product A');assert.equal(clean.materials[0].unitCost,undefined);
    for(const materials of [[{stockId:'private',qty:1}],[{stockId:'bottle',qty:0}],[{stockId:'bottle',qty:-1}],[{stockId:'bottle',qty:.00001}],[{stockId:'bottle',qty:1,unit:'litre'}],[p.materials[0],p.materials[0]]]){
      assert.throws(()=>t.cleanSubmission({...p,materials},ctx));
    }
    assert.throws(()=>t.cleanSubmission({...p,type:'inspect'},ctx));
  }finally{t.db.close();}
});

test('owner approval consumes stock exactly once using open packages and records real cost',async()=>{
  const t=await materialSetup();try{
    const input={grantId:t.g.id,id:'stock-use',payload:materialPayload()};
    await t.call('team_submit',input,member);await t.call('team_submit',input,member);
    assert.deepEqual((await ownerState(t)).stock,t.s.stock);
    await assert.rejects(t.call('team_review',{id:input.id,revision:1,decision:'approve'}));
    await t.call('team_review',{id:input.id,revision:1,decision:'approve',confirmMaterials:true});
    const s=await ownerState(t);assert.equal(s.stock[0].qty,8);assert.equal(s.stock[0].openQty,.75);
    assert.equal(s.stock[1].qty,8);assert.equal(s.tasks[0].cost,275);assert.equal(s.tasks[0].stockState,'consumed');
    assert.equal(s.tasks[0].stockLog.length,2);assert.equal(s.tasks[0].costItems[0].unitCost,50);
    assert.deepEqual(s.sales,t.s.sales);
    await assert.rejects(t.call('team_review',{id:input.id,revision:1,decision:'approve',confirmMaterials:true}));
    assert.deepEqual(await ownerState(t),s);
  }finally{t.db.close();}
});

test('failed work and returned submissions never consume stock',async()=>{
  const t=await materialSetup();try{
    await t.call('team_submit',{grantId:t.g.id,id:'failed-stock',payload:{...materialPayload(),workStatus:'failed'}},member);
    await t.call('team_review',{id:'failed-stock',revision:1,decision:'approve'});
    const s=await ownerState(t);assert.deepEqual(s.stock,t.s.stock);assert.equal(s.tasks[0].cost,0);
    assert.equal(s.tasks[0].reportedMaterials.length,2);assert.deepEqual(s.tasks[0].costItems,[]);
    await t.call('team_submit',{grantId:t.g.id,id:'return-stock',payload:materialPayload()},member);
    await t.call('team_review',{id:'return-stock',revision:1,decision:'return',note:'Check quantity'});
    assert.deepEqual((await ownerState(t)).stock,t.s.stock);
  }finally{t.db.close();}
});

test('insufficient reserved stock, changed units and concurrent edits leave approval pending',async()=>{
  for(const mode of ['reserved','unit','concurrent']){
    const t=await materialSetup();try{
      await t.call('team_submit',{grantId:t.g.id,id:'stock-guard',payload:materialPayload()},member);
      const s=await ownerState(t);
      if(mode==='reserved')s.tasks.push({id:'reservation',status:'planned',stockState:'reserved',costItems:[{stockId:'bag',qty:9}]});
      if(mode==='unit')s.stock[0].unit='litre';
      await t.db.prepare('UPDATE user_data SET data=? WHERE user_id=?').bind(JSON.stringify(s),'owner').run();
      if(mode==='concurrent'){const batch=t.db.batch;t.db.batch=async items=>{await t.db.prepare('UPDATE user_data SET updated_at=updated_at+1 WHERE user_id=?').bind('owner').run();return batch(items);};}
      await assert.rejects(t.call('team_review',{id:'stock-guard',revision:1,decision:'approve',confirmMaterials:true}));
      assert.deepEqual(await ownerState(t),s);assert.equal((await t.call('team_inbox'))[0].status,'pending');
    }finally{t.db.close();}
  }
});

test('public photo route cannot expose private keys, including encoded slashes',async()=>{
  const worker=(await import('../worker/src/lark.js')).default;
  for(const key of ['team-private/abc','team-private%2Fabc']){
    const response=await worker.fetch(new Request('https://example.invalid/photo/'+key),{PHOTOS:{get(){throw new Error('must not read');}}});
    assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});

test('pending legacy inline photos compact on approval without touching other state',async()=>{
  const t=await setup();try{
    const g=await active(t);await t.call('team_submit',{grantId:g.id,id:'legacy-photo',payload:payload()},member);
    await t.db.prepare('UPDATE team_submissions SET payload=? WHERE id=?').bind(JSON.stringify({...payload(),photos:[png]}),'legacy-photo').run();
    await t.call('team_review',{id:'legacy-photo',revision:1,decision:'approve'});
    const ref=JSON.parse((await t.call('team_inbox'))[0].payload).photos[0];
    assert.ok(ref.startsWith(t.TEAM_PHOTO_PREFIX));
    assert.equal((await t.call('team_photo_get',{id:ref.slice(t.TEAM_PHOTO_PREFIX.length)})).src,png);
  }finally{t.db.close();}
});

test('scope edits require owner and current revision, and narrow subsequent access',async()=>{
  const t=await setup();try{
    const g=await active(t),m=(await t.call('team_members'))[0];
    const edit={grantId:g.id,revision:m.revision,plots:['p'],types:['work']};
    await assert.rejects(t.call('team_update',edit,member));
    await assert.rejects(t.call('team_update',edit,stranger));
    await t.call('team_update',edit);
    await assert.rejects(t.call('team_update',edit));
    assert.deepEqual((await t.call('team_context',{grantId:g.id},member)).types,['work']);
    await assert.rejects(t.call('team_submit',{grantId:g.id,id:'blocked-inspect',payload:payload()},member));
    await t.call('team_revoke',{grantId:g.id});
    await assert.rejects(t.call('team_update',{...edit,revision:m.revision+1}));
  }finally{t.db.close();}
});

test('private photos use compact references and authenticated reads without duplicate uploads',async()=>{
  const t=await setup();try{
    const g=await active(t),input={grantId:g.id,id:'photo-record',payload:{...payload(),photos:[png]}};
    await t.call('team_submit',input,member);await t.call('team_submit',input,member);
    assert.equal(t.photos.objects.size,1);
    const sub=(await t.call('team_inbox'))[0],ref=JSON.parse(sub.payload).photos[0],id=ref.slice(t.TEAM_PHOTO_PREFIX.length);
    assert.ok(ref.startsWith(t.TEAM_PHOTO_PREFIX));assert.ok(ref.length<160);
    assert.equal((await t.call('team_photo_get',{id})).src,png);
    assert.equal((await t.call('team_photo_get',{id},member)).src,png);
    await assert.rejects(t.call('team_photo_get',{id},stranger));
    await assert.rejects(t.call('team_submit',{...input,id:'forged',payload:{...payload(),photos:[ref]}},member));
    await t.call('team_review',{id:input.id,revision:1,decision:'approve'});
    const saved=JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);
    assert.deepEqual(saved.tasks[0].photos,[ref]);assert.deepEqual(saved.stock,state().stock);
    assert.equal(JSON.stringify(saved).includes(png),false);
    const m=(await t.call('team_members'))[0];
    await t.call('team_update',{grantId:g.id,revision:m.revision,plots:['p'],types:['work']});
    await assert.rejects(t.call('team_photo_get',{id},member));
    assert.equal((await t.call('team_photo_get',{id})).src,png);
    await t.call('team_revoke',{grantId:g.id});
    await assert.rejects(t.call('team_photo_get',{id},member));
  }finally{t.db.close();}
});

test('photo failures never create a submission or mutate owner data',async()=>{
  const t=await setup();try{
    const g=await active(t),input={grantId:g.id,id:'photo-failure',payload:{...payload(),photos:[png]}};
    t.photos.put=async()=>{throw new Error('R2 unavailable');};
    await assert.rejects(t.call('team_submit',input,member));
    assert.equal((await t.call('team_inbox')).length,0);
    assert.equal(JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data).tasks.length,0);
    await assert.rejects(t.call('team_submit',{...input,payload:{...payload(),photos:['data:image/png;base64,aGVsbG8=']}},member));
  }finally{t.db.close();}
});

test('status filters and counts remain scoped to the owner',async()=>{
  const t=await setup();try{
    const g=await active(t);await t.call('team_submit',{grantId:g.id,id:'counts',payload:payload()},member);
    assert.equal((await t.call('team_counts'))[0].count,1);
    assert.deepEqual(await t.call('team_counts',{},stranger),[]);
    assert.equal((await t.call('team_inbox',{status:'approved'})).length,0);
    await t.call('team_review',{id:'counts',revision:1,decision:'return',note:'Check'});
    assert.equal((await t.call('team_sent',{grantId:g.id,status:'returned'},member)).length,1);
    assert.equal((await t.call('team_inbox',{status:'pending'})).length,0);
  }finally{t.db.close();}
});
async function setup(){const db=localD1();await db.exec(fs.readFileSync(path.join(root,'worker/schema.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(root,'worker/team.sql'),'utf8'));for(const u of [owner,member,stranger])await db.prepare('INSERT INTO users(id,email,pass_hash,name,created_at) VALUES(?,?,?,?,?)').bind(u.user_id,u.email,'test',u.user_id,1).run();await db.prepare('INSERT INTO user_data VALUES(?,?,?)').bind(owner.user_id,JSON.stringify(state()),1).run();const module=await import('../worker/src/team.js');const photos=localR2();const call=(action,p={},u=owner)=>module.teamAction({DB:db,PHOTOS:photos},{action,...p},u);return {db,photos,call,...module};}
async function active(t){const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['inspect','trial','work']});await t.call('team_accept',{invite:g.invite},member);return g;}
test('invites require correct account, expire, are single-use and never list secret tokens',async()=>{const t=await setup();try{const g=await t.call('team_invite',{email:member.email,plots:['p'],types:['inspect']});await assert.rejects(t.call('team_accept',{invite:g.invite},stranger));await t.call('team_accept',{invite:g.invite},member);await assert.rejects(t.call('team_accept',{invite:g.invite},member));const members=await t.call('team_members');assert.equal(JSON.stringify(members).includes(g.invite),false);assert.equal(JSON.stringify(members).includes('invite_hash'),false);const x=await t.call('team_invite',{email:member.email,plots:['p'],types:['inspect']});await t.db.prepare('UPDATE team_grants SET expires_at=0 WHERE id=?').bind(x.id).run();await assert.rejects(t.call('team_accept',{invite:x.invite},member));}finally{t.db.close();}});
test('collector receives only allowed fields, never other plots, results, recipes or finances',async()=>{const t=await setup();try{const g=await active(t),ctx=await t.call('team_context',{grantId:g.id},member);const json=JSON.stringify(ctx);for(const value of ['NOPE','SECRET','private-stock','revenue','secret formula','private-result','cost','lat'])assert.equal(json.includes(value),false,value);assert.equal(ctx.trials[0].units.length,1);await assert.rejects(t.call('team_context',{grantId:g.id},stranger));assert.equal((await t.call('team_inbox',{},member)).length,0);await assert.rejects(t.call('team_revoke',{grantId:g.id},member));}finally{t.db.close();}});
test('scoped validation rejects tampering, bad dates, bad counts and arbitrary photos',async()=>{const t=await setup();try{const ctx=t.teamContext(state(),{plots:['p'],types:['inspect','trial']});for(const bad of [{plotId:'private'},{cycleId:'private'},{type:'expense'},{date:'2099-01-01'},{date:'2026-02-30'},{points:[{pestCount:-1}]},{points:[{pestCount:.5}]},{points:[{examinedPlants:1,affectedPlants:2}]},{photos:['https://private-image']},{workStatus:'approved'}])assert.throws(()=>t.cleanSubmission({...payload(),...bad},ctx));const clean=t.cleanSubmission(payload(),ctx);assert.equal(clean.cost,undefined);assert.equal(clean.stockLog,undefined);assert.equal(clean.points[0].pestCount,0);assert.equal(clean.points[0].affectedPlants,null);const tr={...payload(),type:'trial',trialId:'tr',unitId:'u',metricId:'m',samples:[0,1,null]};assert.equal(t.cleanSubmission(tr,ctx).value,.5);assert.throws(()=>t.cleanSubmission({...tr,samples:[0,-1,null]},ctx));}finally{t.db.close();}});
test('pending submission is isolated; duplicate retries do not duplicate, approve adds no stock/cost',async()=>{const t=await setup();try{const g=await active(t),input={grantId:g.id,id:'submission-1',payload:payload()};await t.call('team_submit',input,member);await t.call('team_submit',input,member);assert.equal((await t.call('team_inbox')).length,1);let before=JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);assert.equal(before.tasks.length,0);await assert.rejects(t.call('team_review',{id:input.id,revision:1,decision:'approve'},member));await t.call('team_review',{id:input.id,revision:1,decision:'approve'});const after=JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);assert.equal(after.tasks.length,1);assert.equal(after.tasks[0].cost,0);assert.deepEqual(after.stock,before.stock);assert.deepEqual(after.sales,before.sales);assert.equal(after.tasks[0].inspection.points[0].pestCount,0);await assert.rejects(t.call('team_review',{id:input.id,revision:1,decision:'approve'}));assert.equal((await t.call('team_history',{id:input.id})).length,2);}finally{t.db.close();}});
test('returned submissions can be corrected only by author, with audit trail and revision guard',async()=>{const t=await setup();try{const g=await active(t),input={grantId:g.id,id:'s2',payload:payload()};await t.call('team_submit',input,member);await t.call('team_review',{id:'s2',revision:1,decision:'return',note:'Fix height'});await assert.rejects(t.call('team_submit',{...input,revision:1,payload:{...payload(),note:'new'}},member));await t.call('team_submit',{...input,revision:2,payload:{...payload(),note:'new'}},member);const rows=await t.call('team_sent',{grantId:g.id},member);assert.equal(rows[0].revision,3);assert.equal(rows[0].status,'pending');await assert.rejects(t.call('team_sent',{grantId:g.id},stranger));assert.equal((await t.call('team_history',{id:'s2'})).length,3);}finally{t.db.close();}});
test('revoked users cannot load context or send offline queued records',async()=>{const t=await setup();try{const g=await active(t);await t.call('team_revoke',{grantId:g.id});await assert.rejects(t.call('team_context',{grantId:g.id},member));await assert.rejects(t.call('team_submit',{grantId:g.id,id:'s3',payload:payload()},member));assert.equal((await t.call('team_assignments',{},member)).length,0);}finally{t.db.close();}});
test('concurrent owner changes prevent approval and do not discard either side',async()=>{const t=await setup();try{const g=await active(t);await t.call('team_submit',{grantId:g.id,id:'s4',payload:payload()},member);const original=t.db.batch;t.db.batch=async statements=>{await t.db.prepare('UPDATE user_data SET updated_at=updated_at+1 WHERE user_id=?').bind('owner').run();return original(statements);};await assert.rejects(t.call('team_review',{id:'s4',revision:1,decision:'approve'}));assert.equal((await t.call('team_inbox'))[0].status,'pending');assert.equal(JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data).tasks.length,0);}finally{t.db.close();}});
test('revocation during submit is checked inside the write, not only at request start',async()=>{const t=await setup();try{const g=await active(t),original=t.db.batch;t.db.batch=async statements=>{await t.db.prepare("UPDATE team_grants SET status='revoked',revision=revision+1 WHERE id=?").bind(g.id).run();return original(statements);};await assert.rejects(t.call('team_submit',{grantId:g.id,id:'s5',payload:payload()},member));assert.equal((await t.call('team_inbox')).length,0);}finally{t.db.close();}});

test('unchanged returned records can be explicitly resubmitted but stale retries cannot',async()=>{
  const t=await setup();try{
    const g=await active(t),input={grantId:g.id,id:'unchanged',payload:payload()};
    await t.call('team_submit',input,member);
    await t.call('team_review',{id:input.id,revision:1,decision:'return',note:'Please confirm'});
    await assert.rejects(t.call('team_submit',input,member));
    const next=await t.call('team_submit',{...input,revision:2},member);
    assert.equal(next.status,'pending');assert.equal(next.revision,3);
    await t.call('team_submit',{...input,revision:2},member);
    assert.equal((await t.call('team_history',{id:input.id})).length,3);
  }finally{t.db.close();}
});

test('trial approval preserves sampled zeros and refuses to overwrite existing observations',async()=>{
  const t=await setup();try{
    const g=await active(t),p={...payload(),type:'trial',trialId:'tr',unitId:'u',metricId:'m',samples:[0,2,null]};
    await t.call('team_submit',{grantId:g.id,id:'trial-first',payload:p},member);
    await t.call('team_review',{id:'trial-first',revision:1,decision:'approve'});
    const data=JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);
    assert.equal(data.trials[0].observations.length,2);
    assert.deepEqual(data.trials[0].observations[1].samples,[0,2,null]);
    assert.equal(data.trials[0].observations[1].value,1);
    assert.deepEqual(data.stock,state().stock);assert.deepEqual(data.sales,state().sales);
    await t.call('team_submit',{grantId:g.id,id:'trial-second',payload:{...p,samples:[3,4,5]}},member);
    await assert.rejects(t.call('team_review',{id:'trial-second',revision:1,decision:'approve'}));
    await assert.rejects(t.call('team_history',{id:'trial-first'},stranger));
    const unchanged=JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);
    assert.deepEqual(unchanged,data);
  }finally{t.db.close();}
});

test('failed activity needs no evidence, grants reject malformed scopes, history paginates',async()=>{
  const t=await setup();try{
    await assert.rejects(t.call('team_invite',{email:member.email,plots:'p',types:['inspect']}));
    const g=await active(t),p={...payload(),type:'work',title:'Could not finish',workStatus:'failed',photos:[],note:''};
    await t.call('team_submit',{grantId:g.id,id:'failed-work',payload:p},member);
    await t.call('team_review',{id:'failed-work',revision:1,decision:'approve'});
    const data=JSON.parse((await t.db.prepare('SELECT data FROM user_data WHERE user_id=?').bind('owner').first()).data);
    assert.equal(data.tasks[0].status,'failed');
    assert.equal((await t.call('team_inbox',{offset:100})).length,0);
    assert.equal((await t.call('team_sent',{grantId:g.id,offset:100},member)).length,0);
  }finally{t.db.close();}
});

test('legacy sampling layouts never inherit parent plot access for another physical plot',async()=>{
  const t=await setup();try{
    const s=state();s.trials[0].units=[{id:'a',physicalPlot:'Assigned'},{id:'b',physicalPlot:'SECRET'},{id:'c',physicalPlot:'Unknown'}];
    const ctx=t.teamContext(s,{plots:['p'],types:['trial']});
    assert.deepEqual(ctx.trials[0].units.map(u=>u.id),['a']);
    s.plots.push({id:'duplicate',name:'Assigned'});
    assert.deepEqual(t.teamContext(s,{plots:['p'],types:['trial']}).trials,[]);
  }finally{t.db.close();}
});
