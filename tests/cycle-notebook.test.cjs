const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function harness(){
  const count={textContent:'',isConnected:true},note={textContent:''};
  const ctx=vm.createContext({console,Date,localStorage:{getItem:()=>null,setItem(){}},App:{},Auth:{session:{email:'demo@example.invalid',token:'synthetic'}},
    document:{getElementById:id=>id==='nbPendingCount'?count:note},Team:{},setTimeout(){},route:{cycleId:'c'},
    taskAllPhotos:t=>[...(t.photos || []),...(t.donePhotos || [])],fmtNum:n=>String(n),esc:s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))});
  const run=s=>vm.runInContext(s,ctx);
  run(source('js/data.js'));run(source('js/projects.js'));run(source('js/cycle-notebook.js'));
  run(`S.tasks=[];S.projects=[];S.plots=[{id:'p',sizeRai:2}];S.cycles=[{id:'c',plotId:'p',status:'active'}];`);
  return {run,ctx,count,note};
}
test('notebook totals reconcile to canonical completed costs across categories',()=>{
  const h=harness();h.run(`S.tasks=[{id:'a',cycleId:'c',date:'2026-11-24',status:'done',cost:800,costItems:[{category:'chemical',totalCost:600},{category:'labor',totalCost:200}]},{id:'b',cycleId:'c',date:'2026-11-23',status:'done',cost:1300,costCat:'labor'},{id:'c',cycleId:'c',date:'2026-11-22',status:'done',cost:400,costCat:'other'},{id:'estimate',cycleId:'c',date:'2026-11-25',status:'planned',cost:9000},{id:'other-cycle',cycleId:'elsewhere',date:'2026-11-24',status:'done',cost:9000}];const model=notebookModel(S.cycles[0]);`);
  assert.equal(h.run('model.finance.cost'),2500);
  assert.equal(h.run('model.categories.materials'),600);
  assert.equal(h.run('model.categories.labor'),1500);
  assert.equal(h.run('Object.values(model.categories).reduce((a,b)=>a+b,0)'),2500);
});
test('material filters exclude labor and estimates without changing cycle totals',()=>{
  const h=harness();h.run(`S.tasks=[{id:'a',cycleId:'c',date:'2026-11-24',status:'done',type:'spray',cost:650,costItems:[{name:'A',category:'chemical',totalCost:400},{name:'B',category:'fertilizer',totalCost:150},{category:'labor',totalCost:100}]},{id:'b',cycleId:'c',date:'2026-10-20',status:'done',type:'fertilize',cost:200,costItems:[{name:'B',category:'fertilizer',totalCost:200}]},{id:'plan',cycleId:'c',date:'2026-11-24',status:'planned',type:'spray',cost:1000}];const rows=notebookMaterialRows(S.cycles[0],{month:'2026-11',category:'fertilizer'});`);
  assert.equal(h.run('rows.length'),1);assert.equal(h.run('rows[0].items[0].totalCost'),150);
  assert.equal(h.run('notebookModel(S.cycles[0]).finance.cost'),850);
});
test('zero-cost materials retain zero and mismatched old item totals do not inflate cards',()=>{
  const h=harness();h.run(`S.tasks=[{id:'a',cycleId:'c',date:'2026-11-24',status:'done',type:'spray',cost:100,costCat:'chemical',costItems:[{category:'chemical',totalCost:0,qty:10,unitCost:999},{category:'labor',totalCost:999}]}];`);
  assert.equal(h.run('notebookMaterialRows(S.cycles[0])[0].items[0].totalCost'),0);
  assert.equal(h.run('notebookModel(S.cycles[0]).categories.materials'),100);
  assert.equal(h.run('notebookModel(S.cycles[0]).categories.labor'),0);
});
test('quantity uses saved actual usage units and does not relabel historical package counts',()=>{
  const h=harness();assert.equal(h.run("notebookQuantity({qty:0.3,unit:'ขวด',usageQty:300,usageUnit:'ml'})"),'300 มล.');
  assert.equal(h.run("notebookQuantity({qty:0.3,unit:'ขวด'})"),'0.3 ขวด');
  assert.equal(h.run('notebookQuantity({})'),'ไม่ระบุ');
});
test('evidence includes before and completion photos once',()=>{
  const h=harness();assert.deepEqual(Array.from(h.run("notebookPhotos({photos:['before'],donePhotos:['after','before']})")),['before','after']);
});
test('pending review is cycle scoped and is distinct from planned tasks',()=>{
  const h=harness();assert.equal(h.run(`notebookPendingRows([{status:'pending',payload:'{"cycleId":"c"}'},{status:'approved',payload:'{"cycleId":"c"}'},{status:'pending',payload:'{"cycleId":"other"}'},{status:'pending',payload:'invalid'}],'c').length`),1);
});
test('pending read follows pagination and caches only the current account session',async()=>{
  const h=harness();const calls=[];
  h.ctx.Team.call=async(_action,args)=>{calls.push(args.offset);return args.offset===0?Array.from({length:100},()=>({status:'pending',payload:'{"cycleId":"other"}'})):[{status:'pending',payload:'{"cycleId":"c"}'}];};
  await h.run("App.cycleNotebookLoadPending('c')");assert.deepEqual(calls,[0,100]);assert.equal(h.count.textContent,'1 รายการ');
  await h.run("App.cycleNotebookLoadPending('c')");assert.deepEqual(calls,[0,100]);
  h.ctx.Auth.session={email:'demo@example.invalid',token:'new-synthetic'};
  await h.run("App.cycleNotebookLoadPending('c')");assert.equal(calls.length,4);
});
test('failed pending read stays unknown rather than displaying a false zero',async()=>{
  const h=harness();h.ctx.Team.call=async()=>{throw new Error('unavailable');};
  await h.run("App.cycleNotebookLoadPending('c')");assert.equal(h.count.textContent,'ยังตรวจสอบไม่ได้');
});
test('field-to-experiment link opens the selected task even after viewing a report',()=>{
  const h=harness();h.run("let projectSelectedTask='',projectWorkspaceTab='report';App.projectOpen=id=>{route.projectId=id;};App.cycleNotebookOpenResult('project','task');");
  assert.equal(h.run('projectWorkspaceTab'),'work');assert.equal(h.run('projectSelectedTask'),'task');assert.equal(h.ctx.route.projectId,'project');
});
test('new notebook activity retains the plot and cycle scope and cannot target closed cycles',()=>{
  const h=harness();h.run("let captured=null;App.modalTask=(date,preset)=>{captured=preset;};App.cycleNotebookAdd('c');");
  assert.equal(h.run('captured.plotId'),'p');assert.equal(h.run('captured.cycleId'),'c');assert.equal(h.run('captured.scope'),'plot');
  h.run("captured=null;S.cycles[0].status='done';App.cycleNotebookAdd('c','harvest');");assert.equal(h.run('captured'),null);
});
