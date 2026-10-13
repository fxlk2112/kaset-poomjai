const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
  const values=new Map(),message={textContent:''};
  const ctx=vm.createContext({ApplicationRate:require('../js/application-rate.js'),crypto:require('node:crypto').webcrypto,URLSearchParams,Date,console,
    localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
    document:{getElementById:()=>message},navigator:{onLine:true},confirm:()=>false});
  const source=fs.readFileSync(path.join(__dirname,'../js/collector.js'),'utf8');
  vm.runInContext(source.slice(0,source.indexOf("el('loginForm').onsubmit=")),ctx);
  vm.runInContext("C.session={email:'first@example.invalid',token:'first'};C.assignment='grant';confirmContext=async()=>false;",ctx);
  return {ctx,message,run:s=>vm.runInContext(s,ctx)};
}

test('unassigned collector never requests history and distinguishes an unavailable connection',async()=>{
  const t=setup();let called=0;t.ctx.api=async()=>{called++;return [];};
  t.run("C.assignment='';C.tab='sent';write('queue',[{id:'preserve'}]);");
  await t.run('sent()');assert.equal(called,0);assert.match(t.message.innerHTML,/ยังไม่ได้รับสิทธิ์เข้าฟาร์ม/);
  t.run("C.assignmentError='<offline>';renderSent=()=>{};");
  assert.match(t.run('unassignedHtml()'),/ยังโหลดสิทธิ์เข้าฟาร์มไม่ได้/);
  assert.match(t.run('unassignedHtml()'),/&lt;offline&gt;/);
  assert.equal(t.run("read('queue',[])[0].id"),'preserve');
});

  test('context change cancellation preserves measurements, zeros, notes and photos',async()=>{
  const t=setup();t.run("write('draft-grant',{id:'keep',plotId:'p',samples:[0,2],note:'keep',photos:['photo']});");
  assert.equal(await t.run("changeContext(draft(),'plotId','other')"),null);
  assert.equal(t.run("draft().plotId"),'p');assert.equal(t.run("draft().samples[0]"),0);
  assert.equal(t.run("draft().photos[0]"),'photo');
});
  test('confirmed context change keeps recoverable prior draft and resets dependent results',async()=>{
  const t=setup();await t.run("confirmContext=async()=>true;write('draft-grant',{id:'keep',plotId:'p',cycleId:'c',samples:[0,2],note:'keep',photos:['photo']});changeContext(draft(),'plotId','other');");
  assert.equal(t.run("draft().plotId"),'other');assert.equal(t.run("draft().cycleId"),'');
  assert.equal(t.run("draft().photos.length"),0);assert.equal(t.run("read('undo-grant',{}).photos[0]"),'photo');
  assert.equal(t.run("read('undo-grant',{}).samples[0]"),0);
});
  test('failed backup storage leaves the original draft untouched',async()=>{
  const t=setup();t.run("confirmContext=async()=>true;write('draft-grant',{id:'keep',note:'unsent'});localStorage.setItem=()=>{throw new Error('quota')};");
  await assert.rejects(t.run("changeContext(draft(),'type','trial')"));
  assert.equal(t.run("draft().id"),'keep');assert.equal(t.run("draft().note"),'unsent');
});
test('collector drafts and queues are isolated by account',()=>{
  const t=setup();t.run("write('draft-grant',{title:'Private draft'});write('queue',[{id:'first'}]);C.session={email:'second@example.invalid'};");
  assert.equal(t.run("read('draft-grant',null)"),null);
  assert.equal(t.run("read('queue',[]).length"),0);
  t.run("C.session={email:'first@example.invalid'};");assert.equal(t.run("draft().title"),'Private draft');
});

test('material rows are protected by context confirmation and render no financial fields',async()=>{
  const t=setup();t.run("write('draft-grant',{id:'keep',type:'spray',materials:[{stockId:'a',qty:'1.5',unit:'bottle'}]});");
  assert.equal(await t.run("changeContext(draft(),'type','inspect')"),null);
  t.run("confirmContext=async()=>true;");
  await t.run("changeContext(draft(),'type','inspect')");
  assert.equal(t.run("draft().materials.length"),0);assert.equal(t.run("read('undo-grant',{}).materials[0].qty"),'1.5');
  t.run("C.context={materials:[{id:'a',name:'<Product>',unit:'bottle',size:'1L',qty:999,avgCost:123}]};");
  const html=t.run("materialsHtml({materials:[{stockId:'a',qty:1.5,unit:'bottle'}]})");
  assert.match(html,/&lt;Product&gt;/);assert.match(html,/1\.5/);assert.doesNotMatch(html,/999|123|avgCost/);
});

test('material search matches Thai names, package size and case-insensitive units',()=>{
  const t=setup();t.run("C.context={materials:[{id:'a',name:'ปุ๋ยสูตร 15-15-15',unit:'กระสอบ',size:'50 KG'},{id:'b',name:'ยา A',unit:'ขวด',size:'1 L'}]};");
  assert.equal(t.run("materialMatches(C.context.materials,'ปุ๋ย 50 kg')[0].id"),'a');
  assert.equal(t.run("materialMatches(C.context.materials,'ขวด')[0].id"),'b');
  assert.equal(t.run("materialMatches(C.context.materials,'ไม่พบ').length"),0);
  assert.equal(t.run("materialMatches(C.context.materials,'  ').length"),2);
  const html=t.run("materialOptions(C.context.materials,'a','ยา')");
  assert.match(html,/ที่เลือกไว้:/);assert.match(html,/value="a" selected/);
});

test('measured package content lets a collector enter millilitres instead of bottle fractions',()=>{
  const t=setup();t.run("C.context={materials:[{id:'a',name:'ยา A',unit:'ขวด',size:'500 ซีซี'}]};");
  assert.equal(t.run("stockContentInfo(C.context.materials[0]).unit"),'ml');
  assert.equal(t.run("stockContentInfo(C.context.materials[0]).amount"),500);
  const html=t.run("materialsHtml({materials:[{stockId:'a',unit:'ขวด',usageQty:50,usageUnit:'ml'}]})");
  assert.match(html,/ใช้จริง \(ซีซี \(มล\.\)\)/);assert.match(html,/data-material-usage/);assert.match(html,/0\.1 ขวด/);
  assert.doesNotThrow(()=>t.run("validateMaterials([{stockId:'a',unit:'ขวด',qty:'',usageQty:50,usageUnit:'ml'}])"));
  assert.throws(()=>t.run("validateMaterials([{stockId:'a',unit:'ขวด',qty:'',usageQty:50,usageUnit:'kg'}])"));
});

test('filtering materials preserves selection and quantity without rerendering or saving the form',()=>{
  const t=setup(),select={value:'a',innerHTML:''},result={textContent:''},qty={value:'1.5'};
  t.ctx.document.querySelector=()=>({querySelector:q=>q==='select'?select:q==='[data-material-results]'?result:qty});
  t.run("C.context={materials:[{id:'a',name:'ยา A',unit:'ขวด'},{id:'b',name:'ยา B',unit:'ขวด'}]};filterMaterials(0,'not found');");
  assert.equal(select.value,'a');assert.equal(qty.value,'1.5');assert.match(result.textContent,/ไม่พบ/);
  t.run("filterMaterials(0,'ยา');");assert.match(result.textContent,/2/);
});

test('external rows work with an empty catalog, escape names and validate before queueing',()=>{
  const t=setup();t.run("C.context={materials:[]};");
  const html=t.run("materialsHtml({materials:[{source:'external',name:'<Product>',unit:'ml',qty:12}]})");
  assert.match(html,/&lt;Product&gt;/);assert.match(html,/data-material-name/);assert.match(html,/data-material-unit/);
  assert.match(html,/onclick="addMaterial\('external'\)" >|onclick="addMaterial\('external'\)"\s*>/);
  assert.doesNotThrow(()=>t.run("validateMaterials([{source:'external',name:'Outside',unit:'ml',qty:12}])"));
  for(const row of [{source:'external',name:'',unit:'ml',qty:1},{source:'external',name:'Outside',unit:'',qty:1},{source:'external',name:'Outside',unit:'ml',qty:.00001}])assert.throws(()=>t.run('validateMaterials('+JSON.stringify([row])+')'));
  assert.throws(()=>t.run("validateMaterials([{source:'external',name:'Outside',unit:'ml',qty:1},{source:'external',name:' outside ',unit:'ml',qty:2}])"));
});

test('capture retains visible materials while the category select is changing',async()=>{
  const t=setup();
  t.ctx.FormData=class {get(k){return ({type:'inspect',plotId:'p',cycleId:'c',date:'2026-09-13',title:'Spray',workStatus:'done'})[k] || '';}};
  t.ctx.document.getElementById=()=>({elements:{namedItem:()=>null},querySelectorAll:selector=>selector==='[data-material]'?[{dataset:{unit:'bottle'},querySelector:q=>({value:q==='select'?'a':'1.5'})}]:[]});
  t.run("write('draft-grant',{id:'keep',type:'spray',materials:[{stockId:'a',qty:1.5,unit:'bottle'}]});");
  assert.equal(t.run("capture().materials[0].qty"),'1.5');
  assert.equal(await t.run("changeContext({...capture(),type:'spray'},'type','inspect')"),null);
  assert.equal(t.run("draft().materials.length"),1);
});

test('watering duration is optional, bounded and preserved through draft confirmation',async()=>{
  const t=setup();
  for(const wateringMinutes of ['',null,undefined,1,30,1440])assert.doesNotThrow(()=>t.ctx.validateWatering({type:'water',wateringMinutes}));
  for(const wateringMinutes of [0,-1,1.5,1441,'bad'])assert.throws(()=>t.ctx.validateWatering({type:'water',wateringMinutes}));
  t.run("write('draft-grant',{id:'water',type:'water',wateringMinutes:'30'});");
  assert.equal(t.run('hasResults(draft())'),true);
  assert.equal(await t.run("changeContext(draft(),'type','inspect')"),null);
  assert.equal(t.run('draft().wateringMinutes'),'30');
  await t.run("confirmContext=async()=>true;changeContext(draft(),'type','inspect');");
  assert.equal(t.run('draft().wateringMinutes'),'');
  assert.equal(t.run("read('undo-grant',{}).wateringMinutes"),'30');
  assert.match(t.run("wateringHtml({wateringMinutes:30})"),/value="30"/);
});

test('watering capture uses the visible minutes field while switching categories',()=>{
  const t=setup();t.ctx.FormData=class{get(k){return k==='type'?'inspect':'';}};
  t.ctx.document.getElementById=()=>({elements:{namedItem:k=>k==='wateringMinutes'?{value:'45'}:null},querySelectorAll:()=>[]});
  assert.equal(t.run('capture().wateringMinutes'),'45');
});

test('each material has an optional escaped rate which is captured and shown in submitted details',()=>{
  const t=setup();t.run("C.context={materials:[{id:'a',name:'A',unit:'bottle'}],plots:[],trials:[]};");
  const html=t.run("materialsHtml({materials:[{stockId:'a',qty:1,rate:'<rate>'},{source:'external',name:'Outside',qty:2,unit:'kg',rate:'25 kg / rai'}]})");
  assert.equal((html.match(/data-material-rate/g)||[]).length,2);assert.match(html,/&lt;rate&gt;/);
  assert.match(t.run("submissionDetails({materials:[{name:'A',qty:1,unit:'bottle',rate:'<rate>'}]})"),/อัตราใช้: &lt;rate&gt;/);
  t.ctx.FormData=class{get(){return '';}};
  t.ctx.document.getElementById=()=>({elements:{namedItem:()=>null},querySelectorAll:q=>q==='[data-material]'?[{dataset:{unit:'bottle'},querySelector:s=>({value:s==='select'?'a':s==='[data-material-rate]'?'20 ml / 20 L':'1'})}]:[]});
  assert.equal(t.run('capture().materials[0].rate'),'20 ml / 20 L');
  assert.throws(()=>t.run("validateMaterials([{stockId:'a',unit:'bottle',qty:1,rate:'x'.repeat(121)}])"));
});

test('a pending confirmation cannot move a draft into a different assignment',async()=>{
  const t=setup();t.run("write('draft-grant',{id:'keep',note:'unsent'});confirmContext=async()=>{C.assignment='another';return true;};");
  assert.equal(await t.run("changeContext(draft(),'type','trial')"),null);
  assert.equal(t.run("read('draft-another',null)"),null);
  assert.equal(t.run("read('draft-grant',{}).note"),'unsent');
});
test('collector review uses readable labels, preserves zeros and escapes submitted text',()=>{
  const t=setup();const html=t.run("submissionDetails({type:'inspect',workStatus:'done',points:[{label:'<img>',heightCm:0,pestCount:0,examinedPlants:10,affectedPlants:null,pestName:'<script>'}],photos:[]})");
  assert.match(html,/ความสูง 0/);assert.match(html,/แมลง 0/);assert.match(html,/ยังไม่นับ/);
  assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('failed upload retains the same queue ID and successful retry removes only that record',async()=>{
  const t=setup();t.run("write('queue',[{id:'one',grantId:'grant',payload:{title:'Draft'}}]);api=async()=>{throw new Error('offline')};");
  await t.run('flush()');assert.equal(t.run("read('queue',[])[0].id"),'one');assert.match(t.message.textContent,/ร่างยังอยู่/);
  t.run("api=async(action,item)=>{if(item.id!=='one')throw new Error('ID changed');return {status:'pending'};};");
  await t.run('flush()');assert.equal(t.run("read('queue',[]).length"),0);
});
test('editing a returned record cannot silently replace an unsent draft',async()=>{
  const t=setup();await t.run("write('draft-grant',{id:'keep',title:'Unsent'});C.sent=[{id:'returned',status:'returned',revision:2,payload:'{}'}];editReturned(0);");
  assert.equal(t.run('draft().id'),'keep');
});

test('pending edit preserves record ID, revision and watering values; approved records are locked',async()=>{
  const t=setup();await t.run("render=()=>{};C.sent=[{id:'sent',status:'pending',revision:1,payload:JSON.stringify({type:'water',wateringMinutes:30})}];editSent(0);");
  assert.equal(t.run('draft().id'),'sent');assert.equal(t.run('draft().revision'),1);
  assert.equal(t.run('draft().wateringMinutes'),30);
  assert.match(t.run("sentEditAction(C.sent[0],0,[])"),/editSent/);
  await t.run("C.sent[0].status='approved';editSent(0);");assert.match(t.message.textContent,/รับรองแล้ว/);
  assert.doesNotMatch(t.run("sentEditAction(C.sent[0],0,[])"),/onclick/);
});

test('queued edits take precedence over older server data',async()=>{
  const t=setup();await t.run("render=()=>{};C.sent=[{id:'sent',status:'pending',revision:1,payload:JSON.stringify({wateringMinutes:30})}];write('queue',[{id:'sent',grantId:'grant',revision:1,payload:{wateringMinutes:45}}]);editSent(0);");
  assert.equal(t.run('draft().wateringMinutes'),45);assert.equal(t.run('draft().revision'),1);
  assert.equal(t.run("read('queue',[]).length"),0);
  assert.doesNotMatch(t.run("sentEditAction(C.sent[0],0,[{id:'sent'}])"),/onclick/);
});

test('watering and material drafts are protected when opening a submitted record',async()=>{
  for(const payload of [{wateringMinutes:30},{materials:[{stockId:'a',qty:1}]}]){
    const t=setup();await t.run("C.sent=[{id:'sent',status:'pending',revision:1,payload:'{}'}];write('draft-grant',"+JSON.stringify({id:'keep',...payload})+");editSent(0);");
    assert.equal(t.run('draft().id'),'keep');
  }
});

test('approval conflicts preserve the edited payload and revision in the offline queue',async()=>{
  const t=setup();t.run("write('queue',[{id:'sent',grantId:'grant',revision:1,payload:{wateringMinutes:45}}]);api=async()=>{const e=new Error('รายการนี้รับรองแล้ว');e.denied=true;throw e;};");
  await t.run('flush()');assert.equal(t.run("read('queue',[])[0].payload.wateringMinutes"),45);
  assert.equal(t.run("read('queue',[])[0].revision"),1);assert.match(t.message.textContent,/รับรองแล้ว/);
});

test('confirmed editing keeps the old draft recoverable and cannot cross assignment changes',async()=>{
  const t=setup();await t.run("render=()=>{};confirmContext=async()=>true;write('draft-grant',{id:'old',wateringMinutes:12});C.sent=[{id:'sent',status:'pending',revision:1,payload:'{}'}];editSent(0);");
  assert.equal(t.run("read('undo-grant',{}).wateringMinutes"),12);
  assert.equal(t.run('draft().id'),'sent');
  await t.run("write('draft-grant',{id:'keep',note:'Draft'});confirmContext=async()=>{C.assignment='another';return true;};editSent(0);");
  assert.equal(t.run("read('draft-another',null)"),null);
  assert.equal(t.run("read('draft-grant',{}).id"),'keep');
});

test('a revoked assignment does not block queued submissions to another owner',async()=>{
  const t=setup();t.run("write('queue',[{id:'revoked'},{id:'allowed'}]);api=async(action,item)=>{if(item.id==='revoked'){const e=new Error('Revoked');e.denied=true;throw e;}return {status:'pending'};};");
  await t.run('flush()');assert.equal(t.run("read('queue',[]).length"),1);assert.equal(t.run("read('queue',[])[0].id"),'revoked');
});

test('old draft notice is explicit without mutating the saved date',()=>{
  const t=setup();t.run("p={date:'2026-09-01',note:'keep'};");
  const html=t.run('draftNotice(p)');assert.match(html,/บันทึกย้อนหลัง/);assert.match(html,/startNewDraft/);
  assert.equal(t.run('p.date'),'2026-09-01');assert.equal(t.run('draftNotice({date:today()})'),'');
  assert.match(t.run("draftNotice({date:'2099-01-01'})"),/อนาคต/);
});

test('logout keeps account-scoped drafts and queues but removes the session',async()=>{
  const t=setup();let removed='',reloaded=false;
  t.ctx.localStorage.removeItem=k=>{removed=k;};t.ctx.location={reload(){reloaded=true;}};
  const buttons={'[data-cancel]':{focus(){}},'[data-confirm]':{}};
  const dialog={querySelector:k=>buttons[k],close(){this.onclose();},remove(){},showModal(){buttons['[data-confirm]'].onclick();}};
  t.ctx.document.createElement=()=>dialog;t.ctx.document.body={appendChild(){}};
  t.run("C.tab='sent';write('draft-grant',{id:'keep',wateringMinutes:45});write('queue',[{id:'queued'}]);api=async()=>{};");
  await t.run('logoutCollector()');
  assert.equal(removed,'farmult-collector-session');assert.equal(reloaded,true);assert.equal(t.run('C.session'),null);
  t.run("C.session={email:'first@example.invalid'};");assert.equal(t.run('draft().wateringMinutes'),45);assert.equal(t.run("read('queue',[])[0].id"),'queued');
});

test('latest sent page wins when responses arrive out of order',async()=>{
  const t=setup();t.run("C.tab='sent';replies=[];api=()=>new Promise(r=>replies.push(r));renderSent=()=>{};");
  const first=t.run('sent()'),second=t.run('sent()');
  t.run("replies[1]([{id:'new'}])");await second;t.run("replies[0]([{id:'old'}])");await first;
  assert.equal(t.run('C.sent[0].id'),'new');
});

test('submission dates reject missing, impossible, future and pre-cycle dates before review',async()=>{
  const t=setup();t.run("C.context={cycles:[{id:'c',startDate:'2026-09-01'}]};reviewSubmission=()=>{throw Error('review should not open')};");
  for(const date of ['', '2026-02-30', '2099-01-01', '2026-08-31']){
    t.run('capture=()=>({id:"invalid",type:"water",cycleId:"c",date:'+JSON.stringify(date)+'});');
    await t.run('queue({preventDefault(){}})');assert.match(t.message.textContent,/วันที่ทำงาน/);assert.equal(t.run("read('queue',[]).length"),0);
  }
});

test('sent filters combine status, plot, date range and search without changing records',()=>{
  const t=setup();t.run("record={status:'pending',payload:JSON.stringify({title:'ให้น้ำเช้า',plotId:'p',type:'water',date:'2026-09-13'})};context={plots:[{id:'p',name:'เหนือ'}]};");
  assert.equal(t.run("sentMatches(record,{q:'เหนือ',status:'pending',plot:'p',from:'2026-09-13',to:'2026-09-13'},context)"),true);
  for(const f of [{q:'missing'},{status:'approved'},{plot:'other'},{from:'2026-09-14'},{to:'2026-09-12'}])assert.equal(t.run('sentMatches(record,'+JSON.stringify(f)+',context)'),false);
  assert.equal(t.run('record.status'),'pending');
});

test('queue failures keep a per-record reason and do not send local error metadata on retry',async()=>{
  const t=setup();t.run("write('queue',[{id:'q',payload:{title:'keep'}}]);api=async()=>{throw Error('Offline')};");
  await t.run('flush()');assert.equal(t.run("read('queue',[])[0].lastError"),'Offline');
  t.run("api=async(a,p)=>{if('lastError' in p)throw Error('metadata leaked');return {}};");
  await t.run('flush()');assert.equal(t.run("read('queue',[]).length"),0);
});

test('review cancellation keeps the draft and never queues or sends a record',async()=>{
  const t=setup();t.run("capture=()=>({id:'review',date:today(),type:'water',cycleId:'c',wateringMinutes:30});reviewSubmission=async()=>false;api=()=>{throw Error('must not call')};");
  await t.run('queue({preventDefault(){}})');
  assert.equal(t.run("read('queue',[]).length"),0);assert.equal(t.run('draft().wateringMinutes'),30);
  assert.equal(t.run('C.busy'),false);
});

test('confirmed review uses the reviewed snapshot exactly once and prevents concurrent submits',async()=>{
  const t=setup();t.run("capture=()=>({id:'review',date:today(),type:'water',cycleId:'c',wateringMinutes:30});reviewSubmission=()=>new Promise(r=>{releaseReview=r});sent=async()=>{};flush=async()=>{};");
  const first=t.run('queue({preventDefault(){}})');
  await t.run('queue({preventDefault(){}})');assert.equal(t.run("read('queue',[]).length"),0);
  t.run('releaseReview(true)');await first;
  assert.equal(t.run("read('queue',[]).length"),1);assert.equal(t.run("read('queue',[])[0].payload.wateringMinutes"),30);
  assert.notEqual(t.run('draft().id'),'review');assert.equal(t.run('C.busy'),false);
});

test('changing assignment during review cannot queue the old record for a new owner',async()=>{
  const t=setup();t.run("capture=()=>({id:'review',date:today(),type:'water',cycleId:'c'});reviewSubmission=async()=>{C.assignment='other';return true;};");
  await t.run('queue({preventDefault(){}})');assert.equal(t.run("read('queue',[]).length"),0);
});

test('reuse selects only approved successful records for the same plot and type',()=>{
  const t=setup();t.run("base={type:'spray',plotId:'p',workStatus:'done',materials:[{stockId:'a'}]};rows=[{id:'ok',status:'approved',payload:JSON.stringify(base)},{status:'pending',payload:JSON.stringify(base)},{status:'approved',payload:JSON.stringify({...base,workStatus:'failed'})},{status:'approved',payload:JSON.stringify({...base,plotId:'other'})},{status:'approved',payload:JSON.stringify({...base,type:'fertilize'})}];");
  assert.equal(t.run("reusableRows(rows,{type:'spray',plotId:'p'},{types:['spray'],plots:[{id:'p'}]}).length"),1);
});

test('reuse creates a new draft, keeps ratios but clears previous amounts, totals, evidence and revision',()=>{
  const t=setup();const next=t.run("reuseDraft({type:'spray',plotId:'p',cycleId:'new-cycle',date:'2026-09-14'}, {id:'old',revision:2,payload:JSON.stringify({date:'2026-09-01',photos:['private-photo'],note:'old',applicationWork:{waterLitres:200},materials:[{stockId:'a',unit:'bottle',qty:2,dose:{amount:20,unit:'ml',per:20,basis:'water'}},{source:'external',name:'Outside',unit:'kg',qty:4,rate:'old rate'}]})})");
  assert.notEqual(next.id,'old');assert.equal(next.revision,undefined);assert.equal(next.cycleId,'new-cycle');assert.equal(next.date,'2026-09-14');
  assert.equal(next.photos.length,0);assert.equal(next.note,'');assert.equal(Object.keys(next.applicationWork).length,0);
  assert.equal(next.materials[0].qty,'');assert.equal(next.materials[0].dose.amount,20);assert.equal(next.materials[1].qty,'');assert.equal(next.materials[1].rate,'old rate');
});

test('legacy free-text rates remain editable after draft captures with empty or partial structured fields',()=>{
  const t=setup();
  for(const dose of [{amount:'',per:'',unit:'ml',basis:'water'},{amount:20,per:'',unit:'ml',basis:'water'}]){
    const html=t.run('materialRateHtml('+JSON.stringify({rate:'legacy rate',dose})+',0)');
    assert.match(html,/data-material-rate/);assert.match(html,/legacy rate/);
  }
});
