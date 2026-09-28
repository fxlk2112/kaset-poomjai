const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

function client() {
  const storage = new Map([['farmult-session-v1', JSON.stringify({email:'test@example.invalid', token:'test-token'})]]);
  const listeners = {};
  const timers = new Map();
  let timer = 0;
  const doc = {
    hidden: false, activeElement: null, modalOpen: false,
    documentElement: {classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){}},
    getElementById: () => null, querySelector(selector) { return selector === '#modalRoot .modal' && this.modalOpen ? {} : null; },
    querySelectorAll: () => [], addEventListener: (key, fn) => { listeners[key] = fn; }
  };
  const c = vm.createContext({
    document: doc, window: {addEventListener:(key, fn)=>{listeners[key]=fn;}}, navigator:{onLine:true},
    location:{href:'https://example.invalid/',search:'',reload(){throw new Error('Unexpected reload');}},
    localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    setTimeout:(fn, delay)=>{timers.set(++timer,{fn,delay});return timer;},clearTimeout:id=>timers.delete(id),setInterval(){},
    URL, Date, AbortController, console, App:{}, toast(){}, render(){}, fetch:async()=>({json:async()=>({ok:true,data:{data:null,updated_at:0}})})
  });
  vm.runInContext(source('js/data.js'),c);
  vm.runInContext(source('js/recovery.js'),c);
  vm.runInContext(source('js/auth.js')+'\nthis.auth = Auth; this.state = S; this.setSessionForTest = setSession;',c);
  const run = text => vm.runInContext(text,c);
  timers.clear();
  run('setCloudTs(100); setLocalDirty(false);');
  return {c,run,storage,timers,listeners,auth:c.auth,state:c.state};
}
function mockApi(client, handler) {
  client.c.fetch = async (_url, options) => ({json:async()=>handler(JSON.parse(options.body))});
}
const copied = value => JSON.parse(JSON.stringify(value));

function inventoryClient() {
  const c = client();
  c.run(`S.tasks=[]; S.sales=[]; S.stock=[{id:'s',name:'Fertilizer',qty:10,openQty:0,avgCost:750,unit:'bag'}];
    S.plots=[{id:'p',name:'Plot',crop:'Corn'}]; S.cycles=[{id:'c',plotId:'p',plant:'Corn',status:'active'}];`);
  c.c.plan = (qty, extra={}) => c.run(`addTask(S, ${JSON.stringify({type:'fertilize',date:'2026-08-31',status:'planned',plotId:'p',cycleId:'c',costItems:[{stockId:'s',qty,category:'fertilizer'}],...extra})})`);
  return c;
}

test('receipt cost is immutable across stock receipts, edits and product deletion',()=>{
  const c=inventoryClient();
  c.run('addSale(S,{customer:"A",items:[{stockId:"s",qty:2,price:900}]});');
  const created=c.state.sales[0].createdAt;
  c.run('receiveStock(S,"s",10,1000);');
  assert.equal(c.run('saleCost(S.sales[0],S)'),1500);
  c.run('updateSale(S,S.sales[0].id,{customer:"B",items:[{stockId:"s",qty:2,price:950}]});');
  assert.equal(c.run('saleCost(S.sales[0],S)'),1500);
  assert.equal(c.state.sales[0].createdAt,created);
  c.run('S.stock=[];');
  assert.equal(c.run('saleCost(S.sales[0],S)'),1500);
});

test('duplicate product lines retain historical costs and added units get a new cost',()=>{
  const c=inventoryClient();
  c.run('addSale(S,{items:[{stockId:"s",qty:1},{stockId:"s",qty:1}]}); receiveStock(S,"s",10,1000);');
  c.run('updateSale(S,S.sales[0].id,{items:[{stockId:"s",qty:1},{stockId:"s",qty:2}]});');
  assert.equal(c.run('saleCost(S.sales[0],S)'),2375);
  assert.ok(Math.abs(c.run('stockValue(S).total')-15125)<1e-8);
});

test('legacy costs stay unknown, zero-cost snapshots stay valid and reports never invent profit',()=>{
  const c=inventoryClient();
  c.state.sales=[{id:'old',date:c.run('todayISO()'),items:[{stockId:'s',qty:1,total:900,fromMain:1}]}];
  assert.equal(c.run('saleCost(S.sales[0],S)'),null);
  assert.equal(c.run('salesCostYTD(S)'),null);
  assert.equal(c.run('salesProfitYTD(S)'),null);
  c.run('updateSale(S,"old",{items:[{stockId:"s",qty:1,price:900}]});');
  assert.equal(c.run('saleCost(S.sales[0],S)'),null);
  c.state.sales[0].items[0].costTotal=0;
  assert.equal(c.run('salesProfitYTD(S)'),900);
});

test('void retains evidence, reverses once, blocks edit and never reuses receipt numbers',()=>{
  const c=inventoryClient();
  c.run('addSale(S,{items:[{stockId:"s",qty:1}]}); addSale(S,{items:[{stockId:"s",qty:1}]});');
  const original=copied(c.state.sales[0].items);
  assert.equal(c.run('voidSale(S,S.sales[0].id)'),true);
  assert.equal(c.run('voidSale(S,S.sales[0].id)'),false);
  assert.deepEqual(copied(c.state.sales[0].items),original);
  assert.equal(c.state.stock[0].qty,9);
  assert.throws(()=>c.run('updateSale(S,S.sales[0].id,{items:[{stockId:"s",qty:1}]})'));
  c.run('addSale(S,{items:[{stockId:"s",qty:1}]});');
  assert.deepEqual(copied(c.state.sales.map(x=>x.no)),[1,2,3]);
  c.run('S.sales=[]; addSale(S,{items:[{stockId:"s",qty:1}]});');
  assert.equal(c.state.sales[0].no,4);
});

test('legacy gaps and duplicate numbers are not renumbered and next number exceeds max',()=>{
  const c=inventoryClient();
  c.state.sales=[{no:8,items:[]},{no:8,items:[]},{no:3,items:[]}];
  c.run('addSale(S,{items:[{stockId:"s",qty:1}]});');
  assert.deepEqual(copied(c.state.sales.map(x=>x.no)),[8,8,3,9]);
});

test('all sales and customer aggregates exclude void receipts',()=>{
  const c=inventoryClient();
  c.run('addSale(S,{customer:"A",items:[{stockId:"s",name:"Item",qty:1,price:900}]}); voidSale(S,S.sales[0].id);');
  for(const fn of ['salesRevenue','salesToday','salesMonth','salesYearCount','salesCostYTD','salesProfitYTD']) assert.equal(c.run(`${fn}(S)`),0,fn);
  for(const fn of ['topSaleItems','topCustomers','customerList']) assert.equal(c.run(`${fn}(S,todayISO().slice(0,4)).length`),0,fn);
  assert.equal(c.run('salesMonthlySeries(S,todayISO().slice(0,4)).reduce((a,x)=>a+x.value,0)'),0);
});

test('receive and void conserve stock value including opened units',()=>{
  const c=inventoryClient();c.state.stock[0].openQty=0.5;
  c.run('addSale(S,{items:[{stockId:"s",qty:2}]});receiveStock(S,"s",10,1000);voidSale(S,S.sales[0].id);');
  assert.ok(Math.abs(c.run('stockValue(S).total')-17875)<1e-8);
  assert.equal(c.state.stock[0].qty,20);
  assert.equal(c.state.stock[0].openQty,0.5);
});

function conflictClient() {
  const c=client();
  const remote=copied(c.state);remote.tasks=[{id:'remote',title:'Remote'}];
  c.run('S.tasks=[{id:"local",title:"Local",photos:["data:image/png;base64,cGhvdG8="]}];saveState(S);');
  c.backups=[];c.writes=[];
  c.c.captureBackup=async(owner,local,cloud,revision,reason)=>{c.backups.push(copied({owner,local,cloud,revision,reason}));};
  c.run('Recovery.save=(...args)=>captureBackup(...args);');
  c.c.openModal=html=>{c.html=html;};c.c.closeModal=()=>{};c.c.ic=()=>'';c.c.esc=x=>String(x).replaceAll('<','&lt;');
  c.c.confirmForTest=(_title,_body,callback)=>{c.confirm=callback;};
  c.run('App.confirm=confirmForTest;');
  mockApi(c,p=>{
    if(p.action==='load') return {ok:true,data:{data:remote,updated_at:101}};
    c.writes.push(copied(p));return {ok:true,data:{updated_at:102}};
  });
  c.auth.askMerge(remote,101);
  return c;
}

test('conflict view identifies additions and changed details, including nested trial measurements',()=>{
  const c=client();
  const diff=c.run('syncDifference({tasks:[{id:"a",title:"Local"}],trials:[{id:"t",observations:[{value:1}]}]},{tasks:[{id:"b",title:"Remote"}],trials:[{id:"t",observations:[{value:2}]}]})');
  assert.equal(diff.groups.find(x=>x.label==='กิจกรรม').localOnly[0],'Local');
  assert.equal(diff.groups.find(x=>x.label==='กิจกรรม').cloudOnly[0],'Remote');
  assert.equal(diff.groups.find(x=>x.label==='การทดลอง').changed.length,1);
});

test('pull preserves both sides including photos before replacement without session tokens',async()=>{
  const c=conflictClient();c.auth.choosePull();await c.confirm();
  assert.equal(c.backups.length,1);
  assert.equal(c.backups[0].local.tasks[0].photos.length,1);
  assert.equal(c.backups[0].cloud.tasks[0].id,'remote');
  assert.equal(c.state.tasks[0].id,'remote');
  assert.equal(c.run('localDirty()'),false);
  assert.equal(c.writes.length,0);
  assert.equal(JSON.stringify(c.backups).includes('test-token'),false);
});

test('failed backup prevents pull and push without losing dirty local data',async()=>{
  for(const action of ['choosePull','choosePush']) {
    const c=conflictClient();c.c.captureBackup=async()=>{throw new Error('quota');};
    c.auth[action]();await c.confirm();
    assert.equal(c.state.tasks[0].id,'local');assert.equal(c.run('localDirty()'),true);
    assert.equal(c.writes.length,0);
  }
});

test('push preserves remote data before CAS and only acknowledges the approved snapshot',async()=>{
  const c=conflictClient();c.auth.choosePush();await c.confirm();
  assert.equal(c.backups[0].reason,'push');assert.equal(c.backups[0].cloud.tasks[0].id,'remote');
  assert.equal(c.writes.length,1);assert.equal(c.writes[0].base_updated_at,101);
  assert.equal(c.run('localDirty()'),false);
});

test('explicit replacement still backs up when another tab has acknowledged the compared revision',async()=>{
  const c=conflictClient();c.run('setCloudTs(101);');
  c.auth.choosePush();await c.confirm();
  assert.equal(c.backups.length,1);assert.equal(c.writes.length,1);
});

test('explicit replacement rejects a changed revision even when another tab already acknowledged it',async()=>{
  const c=conflictClient();c.run('setCloudTs(102);');
  mockApi(c,p=>p.action==='load'?{ok:true,data:{data:{tasks:[{id:'newer'}]},updated_at:102}}:(c.writes.push(p),{ok:true,data:{updated_at:103}}));
  c.auth.choosePush();await c.confirm();
  assert.equal(c.backups.length,0);assert.equal(c.writes.length,0);assert.equal(c.auth._conflict.updated_at,102);
});

test('local changes after the comparison invalidate both replacement choices',async()=>{
  for(const action of ['choosePull','choosePush']) {
    const c=conflictClient();c.auth[action]();c.state.tasks.push({id:'new'});await c.confirm();
    assert.equal(c.state.tasks.length,2);assert.equal(c.writes.length,0);assert.equal(c.backups.length,0);
  }
});

test('account switches and edits during backup cannot overwrite a newer local state',async()=>{
  for(const action of ['choosePull','choosePush']) for(const change of ['edit','account']) {
    const c=conflictClient();
    c.c.captureBackup=async()=>{
      if(change==='edit')c.state.tasks.push({id:'new'});
      else c.c.setSessionForTest({email:'other@example.invalid',token:'other'});
    };
    c.auth[action]();await c.confirm();
    assert.equal(c.state.tasks[0].id,'local');assert.equal(c.writes.length,0);
  }
});

test('cloud revision races require another comparison and never force overwrite',async()=>{
  const c=conflictClient();
  mockApi(c,()=>({ok:true,data:{data:{tasks:[{id:'newer'}]},updated_at:102}}));
  c.auth.choosePull();await c.confirm();
  assert.equal(c.backups.length,0);assert.equal(c.state.tasks[0].id,'local');
  assert.equal(c.auth._conflict.updated_at,102);
});

test('quota failure when applying cloud does not mutate memory or acknowledge the revision',()=>{
  const c=client();c.state.tasks=[{id:'keep'}];
  c.c.localStorage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>c.run('applyCloudState({tasks:[]},101)'));
  assert.equal(c.state.tasks[0].id,'keep');assert.equal(c.run('cloudTs()'),100);
});

test('pull preserves and uploads the highest receipt sequence so clean devices do not reuse it',async()=>{
  const c=client();c.state.saleSequence=20;let sent;
  mockApi(c,p=>p.action==='load'?{ok:true,data:{data:{sales:[],saleSequence:2},updated_at:101}}:(sent=JSON.parse(p.data),{ok:true,data:{updated_at:102}}));
  assert.equal((await c.auth.saveNow()).ok,true);
  assert.equal(sent.saleSequence,20);assert.equal(c.state.saleSequence,20);
  assert.equal(c.run('localDirty()'),false);
});

test('restoring a backup preserves current data first and queues ordinary sync',async()=>{
  const c=conflictClient();
  c.c.recoveryEntries=[{id:'backup',local:{tasks:[{id:'restored'}],sales:[]}}];
  c.run('Recovery.list=async()=>recoveryEntries;');
  c.auth.restoreRecovery('backup','local');await c.confirm();
  assert.equal(c.backups[0].reason,'restore');assert.equal(c.backups[0].local.tasks[0].id,'local');
  assert.equal(c.state.tasks[0].id,'restored');assert.equal(c.run('localDirty()'),true);
  assert.equal(c.writes.length,0);
});

test('separate device clients upload and receive snapshots automatically, preserving offline photos',async()=>{
  const desktop=client(),phone=client();let revision=100,remote=copied(desktop.state);
  const server=p=>{
    if(p.action==='load')return {ok:true,data:{data:remote,updated_at:revision}};
    if(p.base_updated_at!==revision)return {ok:true,data:{conflict:true}};
    remote=JSON.parse(p.data);return {ok:true,data:{updated_at:++revision}};
  };
  mockApi(desktop,server);mockApi(phone,server);
  desktop.c.navigator.onLine=false;
  desktop.run('S.tasks=[{id:"offline-photo",photos:["data:image/jpeg;base64,cGhvdG8="]}];saveState(S);');
  await desktop.auth.saveNow();
  desktop.c.navigator.onLine=true;await desktop.listeners.online();
  await phone.auth.saveNow();
  assert.equal(phone.state.tasks[0].photos[0],desktop.state.tasks[0].photos[0]);
  assert.equal(phone.run('localDirty()'),false);
  const persisted=JSON.parse(desktop.storage.get('kaset-poomjai-v51::test@example.invalid'));
  assert.equal(persisted.tasks[0].photos[0],desktop.state.tasks[0].photos[0]);
});

test('offline photo selection falls back locally without attempting an upload',async()=>{
  const c=client();c.c.navigator.onLine=false;c.c.downscaleImage=async()=> 'data:image/jpeg;base64,cGhvdG8=';
  c.c.fetch=()=>{throw new Error('must not upload');};
  const app=source('js/app.js');
  for(const marker of ['App.uploadPhotoR2 = async function','async function readTaskPhotoFile']) {
    const start=app.indexOf(marker),end=marker.startsWith('App.')?app.indexOf('\n};',start)+3:app.indexOf('\n}',start)+2;
    c.run(app.slice(start,end));
  }
  assert.equal(await c.run('readTaskPhotoFile({})'),'data:image/jpeg;base64,cGhvdG8=');
});

test('financial reports use actual dates across months and years, with legacy fallback',()=>{
  const c=inventoryClient();
  c.state.tasks=[{status:'done',date:'2025-12-31',doneDate:'2026-01-02',plotId:'p',cycleId:'c',cost:750,costCat:'chemical'},
    {status:'done',date:'2026-02-03',plotId:'p',cycleId:'c',revenue:1000},
    {status:'planned',date:'2026-01-01',cost:9999}];
  assert.equal(c.run('ytdFinance(S,2025).cost'),0);
  assert.equal(c.run('ytdFinance(S,2026).cost'),750);
  assert.equal(c.run('monthlySeries(S,2026)[0].cost'),750);
  assert.equal(c.run('monthlySeries(S,2026)[1].revenue'),1000);
  for(const fn of ['cropMargins','plotYearProfits','plotChemUse','cycleStageFinance']) assert.equal(c.run(`${fn}(S,2026)[0].cost`),750);
  assert.equal(c.run('costBreakdown(S,2026)[0].value'),750);
});
test('cost categories split mixed items without changing the total',()=>{
  const c=inventoryClient();
  c.state.tasks=[{status:'done',date:'2026-01-01',cost:900,costItems:[{category:'labor',totalCost:600},{category:'other',totalCost:300}]}];
  assert.deepEqual(copied(c.run('costBreakdown(S,2026).map(x=>x.value)')),[600,300]);
});
test('planned task reserves stock but does not withdraw or recognize actual cost',()=>{
  const c=inventoryClient();c.c.plan(2);
  assert.equal(c.state.stock[0].qty,10);
  assert.equal(c.run('stockReserved(S,"s")'),2);
  assert.equal(c.run('stockAvailable(S,"s")'),8);
  assert.equal(c.state.tasks[0].cost,1500);
  assert.equal(c.run('ytdFinance(S,2026).cost'),0);
});
test('two plans cannot reserve the same remaining stock',()=>{
  const c=inventoryClient();c.c.plan(7);
  assert.throws(()=>c.c.plan(4),/พร้อมใช้/);
  assert.equal(c.state.tasks.length,1);
  assert.equal(c.state.stock[0].qty,10);
});
test('editing a reservation excludes itself and leaves physical quantities unchanged',()=>{
  const c=inventoryClient();const t=c.c.plan(8);
  c.run(`updateTask(S,'${t.id}',{costItems:[{stockId:'s',qty:9,totalCost:6750}]})`);
  assert.equal(c.run('stockReserved(S,"s")'),9);
  assert.equal(c.state.stock[0].qty,10);
});
test('failed inventory edit is atomic for task and all stock rows',()=>{
  const c=inventoryClient();const t=c.c.plan(2,{status:'done'});
  const before=copied(c.state);
  assert.throws(()=>c.run(`updateTask(S,'${t.id}',{costItems:[{stockId:'s',qty:11}]})`));
  assert.deepEqual(copied(c.state),before);
});
test('completion consumes a reservation exactly once and recognizes actual cost',()=>{
  const c=inventoryClient();const t=c.c.plan(2.5);
  c.run(`updateTask(S,'${t.id}',{status:'done',doneDate:'2026-09-02'}); applyStockUse(S,S.tasks[0]);`);
  assert.equal(c.state.stock[0].qty,7);
  assert.equal(c.state.stock[0].openQty,0.5);
  assert.equal(c.run('stockReserved(S,"s")'),0);
  assert.equal(c.run('monthlySeries(S,2026)[8].cost'),1875);
});
test('open units are consumed before opening another sealed unit',()=>{
  const c=inventoryClient();c.state.stock[0].openQty=0.8;
  c.c.plan(0.5,{status:'done'});
  assert.equal(c.state.stock[0].qty,10);assert.equal(c.state.stock[0].openQty,0.3);
});
test('cancelling or deleting a reserved task never creates physical stock',()=>{
  const c=inventoryClient();c.c.plan(2);
  c.run('S.tasks[0].status="failed"; restockTask(S,S.tasks[0]);');
  assert.equal(c.run('stockReserved(S,"s")'),0);assert.equal(c.state.stock[0].qty,10);
  c.run('S.tasks=[];');assert.equal(c.state.stock[0].qty,10);
});
test('legacy planned withdrawals are preserved at completion',()=>{
  const c=inventoryClient();c.state.stock[0].qty=8;
  c.state.tasks=[{id:'old',status:'planned',stockId:'s',qty:2,stockLog:[{stockId:'s',qty:2,mainWithdrawn:2}]}];
  c.run('updateTask(S,"old",{status:"done"},"keep");');
  assert.equal(c.state.stock[0].qty,8);assert.equal(c.run('stockReserved(S,"s")'),0);
});
test('reversing a withdrawal after another task used its remainder conserves quantities',()=>{
  const c=inventoryClient();c.c.plan(2.5,{status:'done'});c.c.plan(0.5,{status:'done'});
  c.run('restockTask(S,S.tasks[0]);');
  assert.equal(c.state.stock[0].qty+c.state.stock[0].openQty,9.5);
  c.run('restockTask(S,S.tasks[0]);');
  assert.equal(c.state.stock[0].qty+c.state.stock[0].openQty,9.5);
});
test('sales and manual withdrawals respect reserved unopened units',()=>{
  const c=inventoryClient();c.c.plan(2.5);
  assert.equal(c.run('stockSealedAvailable(S,"s")'),7);
  assert.throws(()=>c.run('deductStock(S,"s",8)'));
  assert.throws(()=>c.run('addSale(S,{items:[{stockId:"s",qty:8,price:900}]})'));
  c.run('addSale(S,{items:[{stockId:"s",qty:7,price:900}]})');
  assert.equal(c.state.stock[0].qty,3);
});
test('duplicate sale lines and a failed receipt edit cannot partially withdraw stock',()=>{
  const c=inventoryClient();c.c.plan(2);
  assert.throws(()=>c.run('addSale(S,{items:[{stockId:"s",qty:5},{stockId:"s",qty:5}]})'));
  c.run('addSale(S,{items:[{stockId:"s",qty:2}]})');
  const before=copied(c.state);
  assert.throws(()=>c.run('updateSale(S,S.sales[0].id,{items:[{stockId:"s",qty:9}]})'));
  assert.deepEqual(copied(c.state),before);
});
test('final harvest closes only on completion and undo reopens its own cycle',()=>{
  const c=inventoryClient();const t=c.c.plan(0,{type:'harvest',finishCycle:true});
  assert.equal(c.state.cycles[0].status,'active');
  c.run(`updateTask(S,'${t.id}',{status:'done',doneDate:'2026-09-02'});`);
  assert.equal(c.state.cycles[0].status,'done');assert.equal(c.state.cycles[0].endDate,'2026-09-02');
  c.run(`toggleTaskDone(S,'${t.id}');`);
  assert.equal(c.state.cycles[0].status,'active');
});
test('failed harvest and harvest without finish flag leave cycle open',()=>{
  const c=inventoryClient();c.c.plan(0,{type:'harvest',finishCycle:true,status:'failed'});
  c.c.plan(0,{type:'harvest',finishCycle:false,status:'done'});
  assert.equal(c.state.cycles[0].status,'active');
});
test('changing a final harvest to failed reopens only the cycle it closed',()=>{
  const c=inventoryClient();const t=c.c.plan(0,{type:'harvest',finishCycle:true,status:'done',doneDate:'2026-09-02'});
  c.run(`updateTask(S,'${t.id}',{status:'failed'});`);
  assert.equal(c.state.cycles[0].status,'active');
  c.state.cycles[0].status='done'; delete c.state.cycles[0].closedByTaskId;
  c.run(`closeCycleForTask(S,S.tasks[0]);`);
  assert.equal(c.state.cycles[0].status,'done');
});
test('fractional legacy main stock cannot become negative or create leftovers',()=>{
  const c=inventoryClient(); c.state.stock[0].qty=0.5;
  c.c.plan(0.5,{status:'done'});
  assert.equal(c.state.stock[0].qty,0);assert.equal(c.state.stock[0].openQty,0);
});
test('the actual finishTask handler closes a planned final harvest and withdraws once',async()=>{
  const c=inventoryClient();const t=c.c.plan(1,{type:'harvest',finishCycle:true});
  Object.assign(c.c,{taskPhotoUploading:{done:false},taskFinishSaving:false,taskPhotoRecommended:()=>false,
    taskDonePhotos:[],taskDoneWaterSessions:[],taskCompleteReturnToDetail:false,currentTimeHHMM:()=> '09:00',
    taskWeatherPlot:()=>null,closeModal(){},rerender(){},taskAllPhotos:()=>[]});
  c.c.document.getElementById=id=>id==='tdone_date'?{value:'2026-09-02',checkValidity:()=>true}:null;
  const app=source('js/app.js');const start=app.indexOf('App.finishTask = async function');const end=app.indexOf('\nApp.',start+1);
  c.run(app.slice(start,end));
  await c.run(`App.finishTask('${t.id}',true)`);await c.run(`App.finishTask('${t.id}',true)`);
  assert.equal(c.state.stock[0].qty,9);assert.equal(c.state.cycles[0].status,'done');assert.equal(c.state.cycles[0].endDate,'2026-09-02');
});
test('weather forecast, archive and live requests explicitly request metres per second',()=>{
  const app=source('js/app.js');
  assert.equal((app.match(/wind_speed_unit=ms/g)||[]).length,3);
  assert.ok(app.includes('windUnit: "m/s"'));
  assert.ok(app.includes('wx.windUnit || "km/h"'));
});
test('water commands keep the last accepted state on failure or offline',async()=>{
  const c=client();c.state.water={systems:[{id:'w',state:'off'}]};
  const app=source('js/app.js');const start=app.indexOf('App.toggleWater = async function');const end=app.indexOf('\n};',start)+3;
  c.c.authCall=async()=>({ok:false,error:'unavailable'});c.run(app.slice(start,end));
  await c.run('App.toggleWater("w")');assert.equal(c.state.water.systems[0].state,'off');
  c.c.navigator.onLine=false;c.c.authCall=()=>{throw new Error('must not send offline');};
  await c.run('App.toggleWater("w")');assert.equal(c.state.water.systems[0].state,'off');
});
test('duplicate water clicks send once and only accepted commands change state',async()=>{
  const c=client();c.state.water={systems:[{id:'w',state:'off'}]};let calls=0,resolve;
  c.c.authCall=()=>{calls++;return new Promise(r=>{resolve=r;});};
  const app=source('js/app.js');const start=app.indexOf('App.toggleWater = async function');const end=app.indexOf('\n};',start)+3;
  c.run(app.slice(start,end));const pending=c.run('App.toggleWater("w")');
  await c.run('App.toggleWater("w")');assert.equal(calls,1);assert.equal(c.state.water.systems[0].state,'off');
  resolve({ok:true});await pending;assert.equal(c.state.water.systems[0].state,'on');
});

test('failed upload stays dirty and schedules a retry without reporting success',async()=>{
  const c=client();
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,p=>p.action==='load'?{ok:true,data:{data:{tasks:[]},updated_at:100}}:{ok:false,error:'offline'});
  const result=await c.auth.saveNow();
  assert.equal(result.ok,false);
  assert.equal(c.run('localDirty()'),true);
  assert.equal(c.auth.syncState,'error');
  assert.ok([...c.timers.values()].some(t=>t.delay>=5000));
});

test('edits during an in-flight save are sent in a subsequent save',async()=>{
  const c=client(); let complete; let writes=0; let remote={data:{tasks:[]},updated_at:100};
  c.run('S.tasks.push({id:"first"}); saveState(S);');
  mockApi(c,async p=>{
    if(p.action==='load') return {ok:true,data:remote};
    writes++;
    if(writes===1) await new Promise(resolve=>{complete=resolve;});
    remote={data:JSON.parse(p.data),updated_at:100+writes};
    return {ok:true,data:{updated_at:remote.updated_at}};
  });
  const first=c.auth.saveNow();
  while(!complete) await new Promise(setImmediate);
  c.run('S.tasks.push({id:"second"}); saveState(S);');
  assert.equal(c.auth.saveNow(),first);
  complete(); await first;
  assert.equal(c.run('localDirty()'),true);
  await c.auth.saveNow();
  assert.equal(remote.data.tasks.length,2);
  assert.equal(c.run('localDirty()'),false);
});

test('a timed-out sync releases the request and keeps edits for retry',async()=>{
  const c=client();
  c.run('S.tasks.push({id:"pending"}); saveState(S);');
  c.c.fetch=(_url,options)=>new Promise((_resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(new Error('timeout')));
  });
  const pending=c.auth.saveNow();
  [...c.timers.values()].find(t=>t.delay===20000).fn();
  assert.equal((await pending).ok,false);
  assert.equal(c.auth._syncPromise,null);
  assert.equal(c.run('localDirty()'),true);
  assert.equal(c.auth.syncState,'error');
});

test('cloud changes are deferred while a form is open, then applied without reloading',async()=>{
  const c=client(); const remote=copied(c.state);remote.tasks=[{id:'remote'}];
  mockApi(c,()=>({ok:true,data:{data:remote,updated_at:101}}));
  c.c.document.modalOpen=true;
  assert.equal((await c.auth.saveNow()).deferred,true);
  assert.equal(c.state.tasks.length,0);
  assert.equal(c.run('cloudTs()'),100);
  c.c.document.modalOpen=false;
  await c.auth.saveNow();
  assert.equal(c.state.tasks[0].id,'remote');
  assert.equal(c.run('cloudTs()'),101);
});

test('leaving an inline form allows deferred cloud updates to resume',async()=>{
  const c=client();const remote=copied(c.state);remote.tasks=[{id:'remote'}];
  mockApi(c,()=>({ok:true,data:{data:remote,updated_at:101}}));
  c.auth.formEditing=true;c.auth._editingForm={isConnected:true};
  assert.equal((await c.auth.saveNow()).deferred,true);
  c.auth._editingForm.isConnected=false;
  assert.equal((await c.auth.saveNow()).ok,true);
  assert.equal(c.state.tasks[0].id,'remote');
});

test('reconnect automatically uploads offline edits',async()=>{
  const c=client();let saved=0;
  c.c.navigator.onLine=false;
  c.run('S.tasks.push({id:"offline"}); saveState(S);');
  assert.equal((await c.auth.saveNow()).offline,true);
  mockApi(c,p=>p.action==='load'?{ok:true,data:{data:{tasks:[]},updated_at:100}}:(saved++,{ok:true,data:{updated_at:101}}));
  c.c.navigator.onLine=true;
  await c.listeners.online();
  assert.equal(saved,1);
  assert.equal(c.run('localDirty()'),false);
});

test('concurrent device edits never silently overwrite cloud data',async()=>{
  const c=client();let writes=0;
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,p=>{if(p.action==='save')writes++;return {ok:true,data:{data:{tasks:[{id:'other'}]},updated_at:101}};});
  assert.equal((await c.auth.saveNow()).conflict,true);
  assert.equal((await c.auth.saveNow()).conflict,true);
  assert.equal(writes,0);
  assert.equal(c.state.tasks[0].id,'local');
});

test('cloud empty state propagates deletions instead of resurrecting data',async()=>{
  const c=client(); c.state.tasks.push({id:'old'});
  const empty=copied(c.state);empty.tasks=[];
  mockApi(c,()=>({ok:true,data:{data:empty,updated_at:101}}));
  await c.auth.saveNow();
  assert.equal(c.state.tasks.length,0);
});

test('a clean stale tab refreshes even if another tab already acknowledged the revision',async()=>{
  const c=client();
  const remote=copied(c.state);remote.tasks=[{id:'latest'}];
  mockApi(c,()=>({ok:true,data:{data:remote,updated_at:100}}));
  assert.equal((await c.auth.saveNow()).ok,true);
  assert.equal(c.state.tasks[0].id,'latest');
  assert.equal(c.run('localDirty()'),false);
});

test('a response from the previous account cannot acknowledge the next account',async()=>{
  const c=client();let release;
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,async()=>{await new Promise(resolve=>{release=resolve;});return {ok:true,data:{data:null,updated_at:0}};});
  const pending=c.auth.saveNow();
  while(!release)await new Promise(setImmediate);
  c.c.setSessionForTest({email:'second@example.invalid',token:'second-token'});
  c.run('setCloudTs(500); setLocalDirty(true);');
  release();await pending;
  assert.equal(c.run('cloudTs()'),500);
  assert.equal(c.run('localDirty()'),true);
});

test('manual sync does not toast success when offline',async()=>{
  const c=client();const messages=[];c.c.toast=m=>messages.push(m);
  c.c.navigator.onLine=false;
  await c.run('App.authSyncNow()');
  assert.ok(messages.length);
  assert.ok(messages.every(m=>!m.includes('ซิงก์ข้อมูลล่าสุดแล้ว')));
});

test('refreshing account permissions does not interrupt an in-flight sync',async()=>{
  const c=client();let release;
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,async p=>{
    if(p.action==='me')return {ok:true,data:{admin:false}};
    if(p.action==='load')return {ok:true,data:{data:{tasks:[]},updated_at:100}};
    await new Promise(resolve=>{release=resolve;});
    return {ok:true,data:{updated_at:101}};
  });
  const pending=c.auth.saveNow();
  while(!release)await new Promise(setImmediate);
  await c.auth.refreshAdmin();
  assert.equal(c.auth._syncPromise,pending);
  release();
  assert.equal((await pending).ok,true);
  assert.equal(c.run('localDirty()'),false);
  assert.equal(c.auth.syncState,'synced');
});

test('loading an account does not write the empty seed over its stored data',()=>{
  const c=client();
  c.run('S.tasks.push({id:"keep"}); saveState(S); setLocalDirty(false);');
  const before=c.storage.get('kaset-poomjai-v51::test@example.invalid');
  c.run('resetSTo(JSON.parse(localStorage.getItem(slotKey(Auth.session.email))));');
  assert.equal(c.storage.get('kaset-poomjai-v51::test@example.invalid'),before);
  assert.equal(c.run('localDirty()'),false);
  assert.equal(c.state.tasks[0].id,'keep');
});

test('worker revision guard is atomic and server revisions are monotonic',()=>{
  const worker=source('worker/src/lark.js');
  const start=worker.indexOf('async function doSave(');
  const end=worker.indexOf('async function doLoad(',start);
  const sql=worker.slice(start,end).match(/`(INSERT INTO user_data[\s\S]+?RETURNING updated_at)`/)[1];
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE user_data (user_id TEXT PRIMARY KEY, data TEXT, updated_at INTEGER)');
  const save=(data,now,base)=>db.prepare(sql).get({'?1':'user','?2':JSON.stringify(data),'?3':now,'?4':base});
  assert.equal(save({first:1},100,0).updated_at,100);
  assert.equal(save({second:1},99,100).updated_at,101);
  assert.equal(save({stale:1},200,100),undefined);
  assert.equal(JSON.parse(db.prepare('SELECT data FROM user_data').get().data).second,1);
  db.close();
});

test('cycle-stage totals reconcile to annual totals and exclude planned work',()=>{
  const c=client();
  c.run(`S.cycles=[{id:'a',status:'active'},{id:'b',status:'done'}];
    S.tasks=[{date:'2026-09-07',status:'done',cycleId:'a',cost:100,revenue:0},
    {date:'2026-09-07',status:'done',cycleId:'b',cost:200,revenue:400},
    {date:'2026-09-07',status:'done',cost:50,revenue:0},
    {date:'2026-09-07',status:'planned',cost:999,revenue:999},
    {date:'2025-09-07',status:'done',cost:999,revenue:999}];`);
  const groups=c.run('cycleStageFinance(S,2026)');
  assert.equal(groups[0].cost,100);
  assert.equal(groups[1].net,200);
  assert.equal(groups[2].cost,50);
  assert.equal(groups.reduce((sum,g)=>sum+g.net,0),c.run('ytdFinance(S,2026).net'));
});

for (const method of ['finishTask','failTask']) {
  test(`${method} rejects empty and future dates without changing the task`,async()=>{
    const app=source('js/app.js');
    const start=app.indexOf(`App.${method} = async function`);
    const end=app.indexOf('\nApp.',start+1);
    for(const date of ['', '2026-09-08']) {
      const task={id:'task',status:'planned'};
      const messages=[];
      const context=vm.createContext({
        App:{},S:{tasks:[task]},taskPhotoUploading:{done:false},taskFinishSaving:false,
        taskPhotoRecommended:()=>false,taskDonePhotos:[],todayISO:()=> '2026-09-07',currentTimeHHMM:()=> '09:00',
        document:{getElementById:id=>id==='tdone_date'?{value:date,checkValidity:()=>true}:null},
        setModalFieldError:(_el,msg)=>messages.push(msg)
      });
      vm.runInContext(app.slice(start,end),context);
      await context.App[method]('task',true);
      assert.deepEqual(task,{id:'task',status:'planned'});
      assert.equal(context.taskFinishSaving,false);
      assert.equal(messages.length,1);
    }
  });
}

function loadAppMethod(c, name) {
  const app = source('js/app.js');
  const start = app.indexOf(`App.${name} = `);
  assert.ok(start >= 0, name);
  c.run(app.slice(start, app.indexOf('\n};', start) + 3));
}

function taskResultClient(type = 'fertilize', status = 'planned') {
  const c = inventoryClient();
  c.c.plan(2, {id:'task',type,status});
  if(type==='water') c.state.tasks[0].wateringSessions=[{period:'Morning',status:'done'},{period:'Evening',status:'done'}];
  c.run(`let taskCompleteReturnToDetail=false, taskDonePhotos=[], taskDoneWaterSessions=[], taskFinishSaving=false;
    const taskPhotoUploading={done:false};`);
  Object.assign(c.c, {
    ic:()=>'', esc:value=>String(value ?? ''), currentTimeHHMM:()=> '09:00',
    taskDonePhotosOf:task=>task.donePhotos || [], taskWeatherPlot:()=>({name:'Plot'}),
    taskWeatherRecommended:()=>true, taskPhotoRecommended:()=>true,
    doneWaterSessionsForTask:task=>task.wateringSessions || [], taskDoneWaterSessionsHtml:()=>'',
    taskPhotoPreviewHtml:()=>'', taskDoneTime:()=> '09:00', taskDoneDate:task=>task.doneDate,
    openModal:html=>{c.c.modalHtml=html;}, closeModal(){}, rerender(){}, renderNotifPanel(){},
    saveState:()=>{c.c.saved=true;}
  });
  const app=source('js/app.js');
  c.run(app.slice(app.indexOf('function normalizeTaskWaterSessions('),app.indexOf('function collectTaskWaterSessions(')));
  loadAppMethod(c,'modalTaskComplete');
  loadAppMethod(c,'failTask');
  return c;
}

for (const type of ['fertilize','inspect','harvest','water']) {
  test(`failed ${type} result has one save action and no required evidence`,async()=>{
    const c = taskResultClient(type);
    c.run('App.modalTaskComplete(S.tasks[0].id,false,"failed")');
    assert.match(c.c.modalHtml,/App\.failTask\(/);
    assert.doesNotMatch(c.c.modalHtml,/App\.finishTask\(|tdone_weather|task-photo-reminder/);
    assert.match(c.c.modalHtml,/<details class="task-result-optional"\s*>/);
    assert.match(c.c.modalHtml,/วันที่บันทึกผล/);
    assert.doesNotMatch(c.c.modalHtml,/<textarea[^>]*required/);
    const stockBefore=copied(c.state.stock);
    c.c.document.getElementById=id=>id==='tdone_date'
      ? {value:c.run('todayISO()'),checkValidity:()=>true}:null;
    await c.run('App.failTask(S.tasks[0].id)');
    assert.equal(c.state.tasks[0].status,'failed');
    assert.equal(c.state.tasks[0].doneNote,'');
    if(type==='water') assert.ok(c.state.tasks[0].wateringSessions.every(w=>w.status==='failed'));
    assert.deepEqual(copied(c.state.tasks[0].donePhotos),[]);
    assert.deepEqual(copied(c.state.stock),stockBefore);
    assert.equal(c.state.cycles[0].status,'active');
    assert.equal(c.c.saved,true);
  });
}

test('editing a failed result preserves its status, photos and note',async()=>{
  const c=taskResultClient();
  const t=c.state.tasks[0];
  Object.assign(t,{status:'failed',doneDate:c.run('todayISO()'),doneNote:'Rain',donePhotos:['photo.png']});
  c.run('App.modalTaskComplete(S.tasks[0].id,false)');
  assert.doesNotMatch(c.c.modalHtml,/App\.finishTask\(/);
  assert.match(c.c.modalHtml,/<details class="task-result-optional" open>/);
  c.c.document.getElementById=id=>id==='tdone_date'?{value:t.doneDate,checkValidity:()=>true}
    :id==='tdone_note'?{value:'Rain'}:null;
  await c.run('App.failTask(S.tasks[0].id)');
  assert.equal(t.status,'failed');
  assert.equal(t.doneNote,'Rain');
  assert.deepEqual(copied(t.donePhotos),['photo.png']);
});

test('normal completion still offers completion and photo-free completion',()=>{
  const c=taskResultClient();
  c.run('App.modalTaskComplete(S.tasks[0].id,false)');
  assert.match(c.c.modalHtml,/App\.finishTask\('[^']+', true\)/);
  assert.match(c.c.modalHtml,/App\.finishTask\('[^']+', false\)/);
  assert.match(c.c.modalHtml,/task-photo-reminder/);
});

function plannerClient() {
  const c=client();
  c.run(`let plannerCalendarOpen=false, plannerFilter='today';
    let route={view:'planner'}, cal={y:2026,m:8,sel:null}; S.tasks=[];`);
  Object.assign(c.c,{ic:()=>'',T:()=>'',esc:x=>String(x ?? ''),TYPE_LABELS:{inspect:'ตรวจแปลง'},dateLabel:date=>date,calCardHtml:()=>'',taskRowHtml:()=>'',closeModal(){},rerender(){}});
  const app=source('js/app.js');
  c.run(app.slice(app.indexOf('const plannerSearch ='),app.indexOf('App.plannerCalendarToggle =')));
  for(const name of ['plannerCalendarToggle','pickDay','calMove','calToday','gotoCalendar','plannerFilter']) loadAppMethod(c,name);
  return c;
}

test('planner counts follow plot, cycle, type and search filters and reset together',()=>{
  const c=plannerClient();
  c.run(`S.tasks=[
    {id:'a',title:'Inspect north',date:todayISO(),plotId:'p1',cycleId:'c1',type:'inspect',status:'done'},
    {id:'b',title:'Inspect south',date:todayISO(),plotId:'p2',cycleId:'c2',type:'inspect',status:'done'},
    {id:'c',title:'Water north',date:todayISO(),plotId:'p1',cycleId:'c1',type:'water',status:'planned'}
  ];App.setPlannerSearch('plot','p1');App.setPlannerSearch('type','inspect');App.setPlannerSearch('query','north');App.setPlannerSearch('cycle','c1');`);
  assert.equal(c.run('S.tasks.filter(plannerMatches).length'),1);
  assert.match(c.run('renderPlanner()'),/เสร็จแล้ว<\/span><b>1<\/b>/);
  c.run('App.setPlannerSearch("plot","p2")');assert.equal(c.run('plannerSearch.cycle'),'');
  c.run('App.clearPlannerSearch()');assert.equal(c.run('S.tasks.filter(plannerMatches).length'),3);
});

test('calendar stays expanded after selecting days, months, today and filters',()=>{
  const c=plannerClient();
  const isOpen=()=>/<details class="planner-calendar-panel" open/.test(c.run('renderPlanner()'));
  assert.equal(isOpen(),false);
  c.run('App.plannerCalendarToggle({isConnected:true,open:true})');
  c.run('App.pickDay("2026-09-05")');
  assert.equal(c.run('cal.sel'),'2026-09-05');
  assert.equal(isOpen(),true);
  c.run('App.calMove(1)');
  assert.equal(c.run('cal.m'),9);
  assert.equal(isOpen(),true);
  c.run('App.calToday(); App.plannerFilter("failed")');
  assert.equal(c.run('cal.sel'),c.run('todayISO()'));
  assert.equal(isOpen(),true);
  c.run('App.plannerCalendarToggle({isConnected:false,open:false})');
  assert.equal(isOpen(),true);
  c.run('App.plannerCalendarToggle({isConnected:true,open:false})');
  assert.equal(isOpen(),false);
});

test('go to calendar opens the correct month/day from another view',()=>{
  const c=plannerClient();
  c.run('route.view="home"; App.gotoCalendar("2026-12-31")');
  assert.equal(c.run('route.view'),'planner');
  assert.equal(c.run('cal.y'),2026);
  assert.equal(c.run('cal.m'),11);
  assert.equal(c.run('cal.sel'),'2026-12-31');
  assert.equal(c.run('plannerCalendarOpen'),true);
});

test('home calendar interactions do not expand the planner calendar',()=>{
  const c=plannerClient();
  c.run('route.view="home"; App.pickDay("2026-09-05"); App.calMove(1); App.calToday()');
  assert.equal(c.run('plannerCalendarOpen'),false);
});

test('rescheduling changes only the date and preserves stock and recorded costs',()=>{
  const c=client();
  c.run('S.tasks=[{id:"task",date:"2026-09-01",status:"planned",cost:750,stockLog:[{stockId:"stock",qty:1}]}];S.stock=[{id:"stock",qty:9}];S.notifDismissed={task:true};');
  c.c.document.getElementById=id=>id==='rescheduleDate'?{value:'2026-09-08'}:null;
  c.c.closeModal=()=>{};c.c.rerender=()=>{};
  const app=source('js/app.js');
  const start=app.indexOf('App.saveTaskDate = function');
  const end=app.indexOf('\n};',start)+3;
  c.run(app.slice(start,end));
  c.run('App.saveTaskDate({preventDefault(){}},"task");');
  assert.equal(c.state.tasks[0].date,'2026-09-08');
  assert.equal(c.state.tasks[0].manualDate,true);
  assert.equal(c.state.tasks[0].cost,750);
  assert.equal(c.state.stock[0].qty,9);
  assert.equal(c.state.tasks[0].stockLog[0].qty,1);
  assert.equal(c.state.notifDismissed.task,undefined);
});
