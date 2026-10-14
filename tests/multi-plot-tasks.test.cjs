const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(){
  const c=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},setTimeout(){}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8'),c);
  const s={plots:[{id:'a',name:'A',sizeRai:12},{id:'b',name:'B',sizeRai:8}],
    cycles:[{id:'ca',plotId:'a',status:'active'}],tasks:[],
    stock:[{id:'s',name:'Liquid',unit:'bottle',size:'500 cc',qty:4,openQty:.5,avgCost:380}]};
  const selections=[{plotId:'a',cycleId:'ca',areaRai:12},{plotId:'b',cycleId:'__none__',areaRai:8}];
  const data={type:'spray',title:'Batch',status:'done',date:'2026-10-13',costItems:[{stockId:'s',stockMode:'content',qty:.1,usageQty:50,usageUnit:'cc',unit:'bottle',unitCost:380,totalCost:38}]};
  return {c,s,selections,data};
}
test('50 cc over 12 and 8 rai splits 30/20 cc, preserves costs, consumes only 50 cc',()=>{
  const {c,s,selections,data}=setup();const source=JSON.stringify(data);
  const tasks=c.addTasksForPlots(s,data,selections);
  assert.deepEqual(Array.from(tasks,t=>t.costItems[0].usageQty),[30,20]);
  assert.deepEqual(Array.from(tasks,t=>t.cost),[22.8,15.2]);
  assert.deepEqual(Array.from(tasks,t=>t.materialAreaRai),[12,8]);
  assert.equal(tasks[0].cycleId,'ca');assert.equal(tasks[1].cycleId,null);
  assert.equal(tasks[0].batchId,tasks[1].batchId);assert.notEqual(tasks[0].id,tasks[1].id);
  assert.equal(s.stock[0].qty,4);assert.equal(s.stock[0].openQty,.4);
  assert.equal(JSON.stringify(data),source);
});
test('planned allocations reserve the total and completing each does not double deduct',()=>{
  const {c,s,selections,data}=setup();data.status='planned';
  const tasks=c.addTasksForPlots(s,data,selections);
  assert.equal(s.stock[0].openQty,.5);assert.equal(c.stockReservationBreakdown(s,'s').content,.1);
  tasks.forEach(t=>c.toggleTaskDone(s,t.id));
  assert.equal(s.stock[0].openQty,.4);assert.equal(c.stockReservationBreakdown(s,'s').content,0);
});
test('allocation preserves cents through completion and invalidates cached cost after editing quantity',()=>{
  const {c,s,selections,data}=setup();data.status='planned';data.costItems[0].unitCost=1;data.costItems[0].totalCost=.1;
  const tasks=c.addTasksForPlots(s,data,selections);
  tasks.forEach(t=>c.toggleTaskDone(s,t.id));assert.equal(Math.round(tasks.reduce((n,t)=>n+t.cost,0)*100),10);
  const ci=tasks[0].costItems[0];ci.qty=.2;assert.equal(c.taskMaterialCost(ci,s.stock[0]),.2);
});
test('external package prices and fixed total fees split without multiplying totals',()=>{
  const {c,s,selections,data}=setup();data.costItems=[{name:'External',qty:50,unit:'cc',externalPriceMode:'package',externalPackQty:500,externalPackUnit:'cc',externalPackPrice:380,totalCost:38},
    {name:'Labour',qty:1,externalPriceMode:'total',externalTotal:101,totalCost:101}];
  const tasks=c.addTasksForPlots(s,data,selections);
  assert.equal(Math.round(tasks.reduce((n,t)=>n+t.cost,0)*100),13900);
  assert.deepEqual(Array.from(tasks,t=>t.costItems[1].externalTotal),[60.6,40.4]);
  assert.equal(s.stock[0].openQty,.5);
});
test('a later stock failure rolls back every plot and stock change',()=>{
  const {c,s,selections,data}=setup();data.costItems[0].qty=.6;data.costItems[0].usageQty=300;data.costItems[0].stockMode='open';
  const before=JSON.stringify(s);assert.throws(()=>c.addTasksForPlots(s,data,selections),/เปิดแล้ว/);assert.equal(JSON.stringify(s),before);
});
test('respects existing reservations and open-only mode',()=>{
  const {c,s,selections,data}=setup();data.costItems[0].stockMode='open';data.status='planned';
  c.addTasksForPlots(s,data,selections);assert.equal(c.stockReservationBreakdown(s,'s').open,.1);
  data.status='done';data.costItems[0].qty=.5;const before=JSON.stringify(s);
  assert.throws(()=>c.addTasksForPlots(s,data,selections),/เปิดแล้ว|พร้อมใช้/);assert.equal(JSON.stringify(s),before);
});
test('invalid selection, stale cycle, excessive/zero area and package mode are rejected atomically',()=>{
  for(const change of [r=>r.push({...r[0]}),r=>r[1].cycleId='ca',r=>r[0].areaRai=13,r=>r[0].areaRai=0,r=>r[0].areaRai=Infinity,r=>r[0].plotId='missing']){
    const {c,s,selections,data}=setup();change(selections);const before=JSON.stringify(s);
    assert.throws(()=>c.addTasksForPlots(s,data,selections));assert.equal(JSON.stringify(s),before);
  }
  const {c,s,selections,data}=setup();data.costItems[0].stockMode='package';
  assert.throws(()=>c.addTasksForPlots(s,data,selections),/เต็มขวด/);assert.equal(s.tasks.length,0);
});
test('undo one plot returns only its share, sealed stock stays integer',()=>{
  const {c,s,selections,data}=setup();s.stock[0].openQty=0;data.costItems[0].qty=1.5;data.costItems[0].usageQty=750;
  const tasks=c.addTasksForPlots(s,data,selections);
  assert.equal(s.stock[0].qty,2);assert.equal(s.stock[0].openQty,.5);
  c.restockTask(s,tasks[0]);assert.equal(c.rndQty(s.stock[0].qty+s.stock[0].openQty),3.4);
  assert.ok(Number.isInteger(s.stock[0].qty));
  c.restockTask(s,tasks[1]);assert.equal(c.rndQty(s.stock[0].qty+s.stock[0].openQty),4);
});
test('very small allocations are rejected instead of dropping a stock quantity',()=>{
  const {c,s,selections,data}=setup();data.costItems[0].qty=.0001;
  assert.throws(()=>c.addTasksForPlots(s,data,selections),/น้อยเกิน/);
});
test('three equal plots retain every cent and the stock total across plan completion',()=>{
  const {c,s,selections,data}=setup();s.plots.push({id:'c',sizeRai:1});
  selections.forEach(r=>r.areaRai=1);selections.push({plotId:'c',cycleId:'__none__',areaRai:1});
  Object.assign(data.costItems[0],{qty:1,usageQty:500,unitCost:1,totalCost:1});data.status='planned';
  const tasks=c.addTasksForPlots(s,data,selections);
  assert.deepEqual(Array.from(tasks,t=>t.cost),[.33,.34,.33]);
  tasks.forEach(t=>c.toggleTaskDone(s,t.id));
  assert.deepEqual(Array.from(tasks,t=>t.cost),[.33,.34,.33]);
  assert.equal(c.rndQty(s.stock[0].qty+s.stock[0].openQty),3.5);
});
test('record-only materials, notes and rates survive allocation without touching inventory',()=>{
  const {c,s,selections,data}=setup();data.costItems[0].stockMode='record';data.costItems[0].rate='20 cc / 20 L';data.note='Example';
  const tasks=c.addTasksForPlots(s,data,selections);
  assert.equal(s.stock[0].openQty,.5);assert.equal(s.stock[0].qty,4);
  for(const t of tasks){assert.equal(t.note,'Example');assert.equal(t.costItems[0].rate,'20 cc / 20 L');assert.equal(t.stockState,'untracked');}
});
test('mixed opened and content rows cannot overdraw the same stock',()=>{
  const {c,s,selections,data}=setup();s.stock[0].qty=0;
  data.costItems=[{...data.costItems[0],qty:.4,stockMode:'open'},{...data.costItems[0],qty:.4}];
  const before=JSON.stringify(s);assert.throws(()=>c.addTasksForPlots(s,data,selections),/พร้อมใช้/);assert.equal(JSON.stringify(s),before);
});
