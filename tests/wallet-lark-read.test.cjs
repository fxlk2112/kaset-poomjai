const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/wallet-lark-read.js');
const config=require('./fixtures/wallet-config.cjs');
const {readExpenses:readRaw,readPayers,readAttachment}=require('../tools/wallet-lark-source.cjs');
const readExpenses=(env,fetcher)=>readRaw(env,fetcher,'ou_alice');
const record=(id='recABC',approval='Draft',amount=580)=>({record_id:id,fields:{'ทีม/แผนก':M.target.team,[M.payerField]:[{id:'ou_alice',name:'Alice'}],'รายการค่าใช้จ่าย':[{text:'ซื้อยาสมมติ'}],'จำนวนเงิน (THB)':amount,'วันที่จ่ายเงินให้แก่ร้านค้าหรือซัพพลายเออร์ (Date)':Date.parse('2026-10-13T05:00:00Z'),'สถานะอนุมัติ':approval,'EXP No. (Text/Auto ID)':'EXP-TEST'}});
const state=expenses=>({opening:{cents:100000,date:'2026-10-13'},income:[],expenses});
test('payment method comes only from the Lark method field, including missing and updated values',()=>{
  assert.ok(M.fields.includes('วิธีจ่าย'));const r=record();
  r.fields['ที่มาของเงินจ่าย']='เงินสดย่อย';assert.equal(M.normalize([r])[0].paymentMethod,'');
  r.fields['วิธีจ่าย']='โอน';const before=M.normalize([r]);assert.equal(before[0].paymentMethod,'โอน');
  r.fields['วิธีจ่าย']='เงินสด';assert.equal(M.reconcile(before,M.normalize([r]))[0].paymentMethod,'เงินสด');
  r.fields['วิธีจ่าย']=[{text:'บัตรบริษัท'}];assert.equal(M.normalize([r])[0].paymentMethod,'บัตรบริษัท');
  delete r.fields['วิธีจ่าย'];assert.equal(M.reconcile(before,M.normalize([r]))[0].paymentMethod,'');
});
test('runtime Base configuration isolates its storage namespace from sandbox',()=>{
  assert.equal(M.target.app,config.LARK_WALLET_BASE_APP);assert.equal(M.target.table,config.LARK_WALLET_TABLE);assert.equal(M.owner.id,config.LARK_WALLET_OWNER_ID);
  const fs=require('node:fs'),path=require('node:path'),ui=fs.readFileSync(path.join(__dirname,'../js/wallet-read-ui.js'),'utf8');
  assert.ok(ui.includes('${M.target.app}:${M.target.table}:${M.target.team}'));assert.ok(ui.includes('WalletAccess.legacyContext'));
});
test('scoped payer discovery filters upstream and strips other IDs returned by the source',async()=>{
  const r=record();r.fields[M.payerField].push({id:'ou_bob',name:'Bob'});const requests=[];
  const fetcher=async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test'}:{code:0,data:{items:[r],has_more:false}}};};
  const d=await readPayers({...config,LARK_APP_ID:'test',LARK_APP_SECRET:'test'},fetcher,'ou_alice');assert.deepEqual(d.payers,[{id:'ou_alice',name:'Alice'}]);assert.equal(requests[1].filter.conditions[1].value[0],'ou_alice');
});
test('deleting legacy income is recoverable and does not change expenses or the original object',()=>{
  const old={...state([{id:'expense'}]),income:[{id:'old',cents:500000}]};const next=M.discardLegacyIncome(old);
  assert.deepEqual(next.income,[]);assert.deepEqual(next.deletedIncome,old.income);assert.deepEqual(next.expenses,old.expenses);assert.deepEqual(next.opening,old.opening);assert.equal(old.income.length,1);assert.equal(M.discardLegacyIncome(next).deletedIncome.length,1);
});
test('attachment metadata strips remote URLs and marks only supported raster images',()=>{
  const r=record();r.fields['หลักฐานแนบ']=[{file_token:'abc',name:'proof.png',type:'image/png',size:20,tmp_url:'secret',url:'secret'},{file_token:'pdf',name:'file.pdf',type:'application/pdf'}];
  const photos=M.normalize([r])[0].attachments;assert.equal(photos[0].previewable,true);assert.equal(photos[1].previewable,false);assert.ok(!JSON.stringify(photos).includes('secret'));
});
test('income photos enforce count, type, nonempty content and size limits',()=>{
  const E=require('../js/wallet-evidence.js'),p={type:'image/png',size:20};E.validate([],Array(6).fill(p));assert.throws(()=>E.validate([p],Array(6).fill(p)));for(const x of [{type:'image/svg+xml',size:20},{...p,size:0},{...p,size:5242881}])assert.throws(()=>E.validate([],[x]));
});
test('attachment proxy rechecks payer, record and file identity before downloading',async()=>{
  const {readAttachment}=require('../tools/wallet-lark-source.cjs');const r=record();r.fields['หลักฐานแนบ']=[{file_token:'photo123',type:'image/png',size:3}];let downloads=0;
  const fetcher=async url=>{if(url.endsWith('/download')){downloads++;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});}return {ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test'}:{code:0,data:{items:[r],has_more:false}}};};
  const env={...config,LARK_APP_ID:'test',LARK_APP_SECRET:'test'};
  for(const args of [['ou_bob','recABC',0,'photo123'],['ou_alice','recOther',0,'photo123'],['ou_alice','recABC',1,'photo123'],['ou_alice','recABC',0,'changed']])await assert.rejects(readAttachment(env,fetcher,...args));
  assert.equal(downloads,0);const image=await readAttachment(env,fetcher,'ou_alice','recABC',0,'photo123');assert.equal(image.bytes.length,3);assert.equal(image.type,'image/png');
  r.fields['หลักฐานแนบ'][0].size=11000000;await assert.rejects(readAttachment(env,fetcher,'ou_alice','recABC',0,'photo123'),/10 MB/);assert.equal(downloads,1);
});
test('every imported expense deducts immediately without approval gating',()=>{
  for(const status of ['Draft','Submitted','Approved','Rejected','Cancelled',''])assert.equal(M.totals(state(M.normalize([record('recABC',status)]))).balance,42000);
});
test('filter is exact team only, never company-wide',()=>{
  const other=record('recOther');other.fields['ทีม/แผนก']='Other Department';assert.equal(M.normalize([record(),other]).length,1);
});
test('repeated reads deduct once and a source edit replaces its original amount',()=>{
  const first=M.normalize([record()]);let latest=M.reconcile(first,first);assert.equal(latest.length,1);assert.equal(M.totals(state(latest)).balance,42000);
  latest=M.reconcile(latest,M.normalize([record('recABC','Draft',600)]));assert.equal(latest.length,1);assert.equal(M.totals(state(latest)).balance,40000);
});
test('missing source retains debit and warning; reappearance clears warning',()=>{
  const first=M.normalize([record()]),missing=M.reconcile(first,[]);assert.equal(missing[0].missing,true);assert.equal(M.totals(state(missing)).balance,42000);
  assert.equal(M.reconcile(missing,first)[0].missing,false);
});
test('negative balance is allowed because spending has already happened',()=>{assert.equal(M.totals(state(M.normalize([record('recABC','Draft',1200)]))).balance,-20000);});
test('without opening amount the UI can show net flow, not an unknown dash',()=>{assert.equal(M.totals({...state(M.normalize([record()])),opening:null,income:[{id:'in',date:'2026-10-13',cents:100000}]}).balance,42000);});
test('opening cutoff and local income affect balance once, including zero opening',()=>{
  const older=M.normalize([record()])[0];older.date='2026-10-12';const s={...state([older]),opening:{cents:0,date:'2026-10-13'},income:[{id:'in',date:'2026-10-13',cents:50000}]};assert.deepEqual(M.totals(s),{expenses:[],income:s.income,paid:0,received:50000,balance:50000});
});
test('malformed or duplicate source data fails instead of quietly understating expenses',()=>{
  for(const amount of [undefined,null,-1,0,1.234,'NaN'])assert.throws(()=>M.normalize([record('recABC','Draft',amount===undefined?'':amount)]));
  assert.throws(()=>M.normalize([record(),record()]));assert.throws(()=>M.normalize([{...record(),record_id:'unsafe<script>'}]));
});
test('missing paid date uses request date with an explicit label; no dates fails',()=>{
  const r=record();delete r.fields['วันที่จ่ายเงินให้แก่ร้านค้าหรือซัพพลายเออร์ (Date)'];assert.throws(()=>M.normalize([r]));
  r.fields['วันที่ขอ (Date)']=Date.parse('2026-10-12T20:00:00Z');const row=M.normalize([r])[0];assert.equal(row.date,'2026-10-13');assert.equal(row.dateBasis,'requested');
});
test('read source paginates, filters on server and only uses auth/search endpoints',async()=>{
  const calls=[];let page=0;
  const fetcher=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test-only'}:{code:0,data:++page===1?{items:[record()],has_more:true,page_token:'second'}:{items:[record('recSecond')],has_more:false}}};};
  const data=await readExpenses({...config,LARK_APP_ID:'test',LARK_APP_SECRET:'test'},fetcher);assert.equal(data.expenses.length,2);assert.equal(calls.length,3);
  assert.ok(calls.slice(1).every(c=>c.url.includes(M.target.app)&&c.url.includes('/records/search?')));assert.equal(calls[1].body.filter.conditions[0].value[0],M.target.team);
  assert.equal(calls[1].body.filter.conditions[1].field_name,M.payerField);assert.equal(calls[1].body.filter.conditions[1].value[0],'ou_alice');assert.equal(data.source.payerId,'ou_alice');
  assert.ok(!JSON.stringify(data).includes('test-only'));
});
test('a later page failure never returns an incomplete successful snapshot',async()=>{
  let page=0;const fetcher=async url=>({ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test-only'}:++page===1?{code:0,data:{items:[record()],has_more:true,page_token:'next'}}:{code:91403}});
  await assert.rejects(readExpenses({...config,LARK_APP_ID:'test',LARK_APP_SECRET:'test'},fetcher),/91403/);
});
test('missing credentials fail closed before any network request',async()=>{await assert.rejects(readExpenses({...config},()=>assert.fail('must not call')),/เซิร์ฟเวอร์/);});
test('payer filtering uses stable user IDs, not matching names or requester fields',()=>{
  const bob=record('recBob');bob.fields[M.payerField]=[{id:'ou_bob',name:'Alice'}];bob.fields['ผู้ขอ (Requester)']=[{id:'ou_alice',name:'Alice'}];
  const missing=record('recMissing');delete missing.fields[M.payerField];
  const rows=M.normalize([record(),bob,missing],'ou_alice');assert.equal(rows.length,1);assert.equal(rows[0].id,'recABC');assert.deepEqual(rows[0].payerIds,['ou_alice']);
});
test('payer discovery deduplicates IDs and does not return emails or expenses',async()=>{
  const r=record();r.fields[M.payerField][0].email='private@example.invalid';const missing=record('recMissing');delete missing.fields[M.payerField];const requests=[];
  const fetcher=async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test'}:{code:0,data:{items:[r,r,missing],has_more:false}}};};
  const d=await readPayers({...config,LARK_APP_ID:'test',LARK_APP_SECRET:'test'},fetcher);assert.deepEqual(d.payers,[{id:'ou_alice',name:'Alice'}]);assert.equal(d.unassigned,1);assert.deepEqual(requests[1].field_names,['ทีม/แผนก',M.payerField]);assert.ok(!JSON.stringify(d).includes('private@example'));
});
test('expense endpoint refuses missing or invalid payer before reading anything',async()=>{
  for(const id of [undefined,'','Alice','ou_a&payer=other'])await assert.rejects(readRaw({},()=>assert.fail('network must not run'),id),/เลือกผู้จ่าย/);
});

const testEnv=()=>({...config,LARK_APP_ID:'test',LARK_APP_SECRET:'test'});
const secondTeam='Other Department';
function scopedRecord(id,team,payer='ou_alice'){
  const r=record(id);r.fields['ทีม/แผนก']=team;r.fields[M.payerField]=[{id:payer,name:payer==='ou_alice'?'Alice':'Bob'}];
  r.fields['หลักฐานแนบ']=[{file_token:'sharedPhoto',type:'image/png',size:1}];return r;
}
function mockRows(rows,calls=[]){
  return async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test-only'}:{code:0,data:{items:rows,has_more:false}}};
  };
}
test('explicit second team filters API and hostile local rows exactly, preserving default Farm',async()=>{
  const rows=[scopedRecord('recFarm',M.target.team),scopedRecord('recSales',secondTeam),scopedRecord('recBob',secondTeam,'ou_bob'),scopedRecord('recNear',secondTeam+' '),scopedRecord('recEmpty',secondTeam)];
  rows[4].fields[M.payerField]=[];
  const calls=[],fetcher=mockRows(rows,calls),env=testEnv();
  const result=await readRaw(env,fetcher,'ou_alice',secondTeam);
  assert.deepEqual(result.expenses.map(r=>r.id),['recSales']);assert.equal(result.source.team,secondTeam);
  assert.deepEqual(calls[1].body.filter,{conjunction:'and',conditions:[{field_name:'ทีม/แผนก',operator:'is',value:[secondTeam]},{field_name:M.payerField,operator:'is',value:['ou_alice']}]});
  assert.deepEqual(M.normalize(rows,'ou_alice').map(r=>r.id),['recFarm']);
  assert.deepEqual(M.normalize(rows,'ou_alice',secondTeam).map(r=>r.id),['recSales']);
  assert.deepEqual(M.payerList(rows,secondTeam),{payers:[{id:'ou_alice',name:'Alice'},{id:'ou_bob',name:'Bob'}],unassigned:1});
  assert.deepEqual(M.payerList(rows).payers,[{id:'ou_alice',name:'Alice'}]);
  const payers=await readPayers(env,fetcher,'ou_alice',secondTeam);
  assert.deepEqual(payers.payers,[{id:'ou_alice',name:'Alice'}]);assert.equal(payers.unassigned,0);assert.equal(payers.source.team,secondTeam);
  assert.deepEqual(calls[3].body.filter,calls[1].body.filter);
  assert.deepEqual(calls[3].body.field_names,['ทีม/แผนก',M.payerField]);
  assert.equal((await readRaw(env,fetcher,'ou_alice')).source.team,M.target.team);
});
test('invalid teams fail before transport and helper filtering; null requires a payer',async()=>{
  const noFetch=()=>assert.fail('must not access network');
  for(const team of ['', ' ', ' Farm', 'Farm ', 'a'.repeat(121), 'Farm\nSales', 'Farm\u0000', 'Farm\u007f', 12, {}, []]){
    assert.equal(M.validTeam(team),false);
    assert.throws(()=>M.normalize([],'ou_alice',team),/team/);assert.throws(()=>M.payerList([],team),/team/);
    await assert.rejects(readRaw(testEnv(),noFetch,'ou_alice',team),/team/);
    await assert.rejects(readPayers(testEnv(),noFetch,'ou_alice',team),/team/);
    await assert.rejects(readAttachment(testEnv(),noFetch,'ou_alice','recABC',0,'sharedPhoto',team),/team/);
  }
  for(const payer of [undefined,null,'','Alice','ou_a&other']){
    assert.throws(()=>M.normalize([],payer,null));
    await assert.rejects(readRaw(testEnv(),noFetch,payer,null));
    await assert.rejects(readPayers(testEnv(),noFetch,payer,null));
    await assert.rejects(readAttachment(testEnv(),noFetch,payer,'recABC',0,'sharedPhoto',null));
  }
  assert.throws(()=>M.payerList([],null));
  for(const team of [M.target.team,secondTeam,'a'.repeat(120),'ทีมวิจัย', 'Ops:ou_alice'])assert.equal(M.validTeam(team),true);
});
test('authenticated payer across all teams uses only the payer API filter and ignores hostile other payers',async()=>{
  const rows=[scopedRecord('recFarm',M.target.team),scopedRecord('recSales',secondTeam),scopedRecord('recNoTeam',''),scopedRecord('recBobFarm',M.target.team,'ou_bob'),scopedRecord('recBobSales',secondTeam,'ou_bob')];
  rows[3].fields[M.payerField][0].name='Alice';rows[3].fields['ผู้ขอ (Requester)']=[{id:'ou_alice',name:'Alice'}];
  rows[1].fields[M.payerField].push({id:'ou_bob',name:'Bob'},{id:'ou_alice',name:'Alice'});
  const calls=[],fetcher=mockRows(rows,calls),env=testEnv();
  const result=await readRaw(env,fetcher,'ou_alice',null);
  assert.equal(result.source.team,null);assert.equal(result.source.payerId,'ou_alice');
  assert.deepEqual(result.expenses.map(r=>r.id),['recFarm','recSales','recNoTeam']);
  assert.equal(new Set(result.expenses.map(r=>r.id)).size,3);assert.equal(result.expenses.reduce((n,r)=>n+r.cents,0),174000);
  assert.deepEqual(M.normalize(rows,'ou_alice',null),result.expenses);
  assert.throws(()=>M.normalize([...rows,rows[0]],'ou_alice',null),/ซ้ำ/);
  const payers=await readPayers(env,fetcher,'ou_alice',null);
  assert.equal(payers.source.team,null);assert.equal(payers.unassigned,0);assert.deepEqual(payers.payers,[{id:'ou_alice',name:'Alice'}]);
  for(const call of calls.filter(c=>c.url.includes('/records/search?')))assert.deepEqual(call.body.filter,{conjunction:'and',conditions:[{field_name:M.payerField,operator:'is',value:['ou_alice']}]});
});
test('attachment pending reads and byte cache isolate teams and all-team scope and recheck membership',async()=>{
  const env=testEnv(),searches=[],downloads=[];
  let moved=false;
  const fetcher=async(url,options)=>{
    if(url.endsWith('/download')){downloads.push(url);return new Response(new Uint8Array([downloads.length]),{headers:{'Content-Type':'image/png'}});}
    if(url.includes('/auth/'))return {ok:true,json:async()=>({code:0,tenant_access_token:'test'})};
    const body=JSON.parse(options.body);searches.push(body);
    const team=body.filter.conditions.find(c=>c.field_name==='ทีม/แผนก')?.value[0]??null;
    const other=team===M.target.team?secondTeam:M.target.team;
    const items=[scopedRecord('recABC',other),scopedRecord('recABC',team??secondTeam,'ou_bob')];
    if(!moved)items.push(scopedRecord('recABC',team??secondTeam));
    else items.splice(0,1);
    return {ok:true,json:async()=>({code:0,data:{items,has_more:false}})};
  };
  const read=team=>readAttachment(env,fetcher,'ou_alice','recABC',0,'sharedPhoto',team);
  const [farm,sales,all]=await Promise.all([read(M.target.team),read(secondTeam),read(null)]);
  assert.equal(searches.length,3);assert.equal(downloads.length,3);assert.equal(new Set([farm.bytes[0],sales.bytes[0],all.bytes[0]]).size,3);
  assert.deepEqual(searches[2].filter.conditions,[{field_name:M.payerField,operator:'is',value:['ou_alice']}]);
  for(const [team,previous] of [[M.target.team,farm],[secondTeam,sales],[null,all]])assert.deepEqual(await read(team),previous);
  assert.equal(downloads.length,3);assert.equal(searches.length,6);
  moved=true;
  for(const team of [M.target.team,secondTeam,null])await assert.rejects(read(team));
  assert.equal(downloads.length,3);
});
test('attachment cannot read or reuse a cached image from another team, but own all-team scope can',async()=>{
  const env=testEnv(),r=scopedRecord('recABC',secondTeam);let downloads=0;
  const rows=mockRows([r]);
  const fetcher=async(url,options)=>url.endsWith('/download')?(downloads++,new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/png'}})):rows(url,options);
  const read=team=>readAttachment(env,fetcher,'ou_alice','recABC',0,'sharedPhoto',team);
  await read(secondTeam);await assert.rejects(read(M.target.team));assert.equal(downloads,1);
  await read(null);assert.equal(downloads,2);
  r.fields[M.payerField]=[{id:'ou_bob',name:'Alice'}];
  await assert.rejects(read(null));await assert.rejects(read(secondTeam));assert.equal(downloads,2);
});
test('own-payer reads retain the 10000 record limit and reject invalid pagination',async()=>{
  for(const count of [10000,10001]){
    let offset=0;
    const fetcher=async(url,options)=>({ok:true,json:async()=>{
      if(url.includes('/auth/'))return {code:0,tenant_access_token:'test'};
      assert.deepEqual(JSON.parse(options.body).filter.conditions,[{field_name:M.payerField,operator:'is',value:['ou_alice']}]);
      const size=Math.min(500,count-offset);offset+=size;
      return {code:0,data:{items:Array(size).fill(scopedRecord('recABC',secondTeam)),has_more:offset<count,page_token:String(offset)}};
    }});
    if(count===10000)assert.deepEqual((await readPayers(testEnv(),fetcher,'ou_alice',null)).payers,[{id:'ou_alice',name:'Alice'}]);
    else await assert.rejects(readPayers(testEnv(),fetcher,'ou_alice',null),/10,000/);
  }
  for(const data of [{items:[],has_more:true},{items:[],has_more:true,page_token:'repeat'},{}]){
    const fetcher=async url=>({ok:true,json:async()=>url.includes('/auth/')?{code:0,tenant_access_token:'test'}:{code:0,data}});
    await assert.rejects(readPayers(testEnv(),fetcher,'ou_alice',null));
  }
});
