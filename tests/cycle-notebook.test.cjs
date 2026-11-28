const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('harvest weight conversion avoids a misleading cost per kg for mixed units',()=>{
  const h=harness();assert.equal(h.run(`notebookHarvestKg([{harvestQty:2,harvestUnit:'kg'},{harvestQty:500,harvestUnit:'กรัม'}])`),2.5);
  assert.equal(h.run(`notebookHarvestKg([{harvestQty:2,harvestUnit:'kg'},{harvestQty:8,harvestUnit:'ลูก'}])`),null);
  assert.equal(h.run('notebookHarvestKg([])'),0);
});
test('yield panel excludes rent from harvest revenue while cycle totals include both',()=>{
  const h=harness();h.run(`function taskRowHtml(t){return t.title || '';}S.tasks=[{id:'rent',cycleId:'c',status:'done',type:'work',revenue:50000,cost:0,date:'2026-03-31'},{id:'crop',cycleId:'c',status:'done',type:'harvest',revenue:220,cost:0,harvestQty:10,date:'2026-03-31'}];const model=notebookModel(S.cycles[0]);const html=notebookYield({...S.cycles[0],status:'closed'},model);`);
  assert.equal(h.run('model.finance.revenue'),50220);assert.match(h.run('html'),/รายรับจากผลผลิต<\/span><strong>220 บาท/);assert.doesNotMatch(h.run('html'),/50,220/);
});
function harness({notebook=true}={}){
  const count={textContent:'',isConnected:true},note={textContent:''};
  const ctx=vm.createContext({console,Date,localStorage:{getItem:()=>null,setItem(){}},App:{},Auth:{session:{email:'demo@example.invalid',token:'synthetic'}},
    document:{getElementById:id=>id==='nbPendingCount'?count:note},Team:{},setTimeout(){},route:{cycleId:'c'},
    taskAllPhotos:t=>[...(t.photos || []),...(t.donePhotos || [])],fmtNum:n=>String(n),esc:s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))});
  const run=s=>vm.runInContext(s,ctx);
  run(source('js/data.js'));run(source('js/projects.js'));if(notebook)run(source('js/cycle-notebook.js'));
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

test('history defaults to recorded outcomes and groups by actual date without moving planned work or mutating tasks',()=>{
  const h=harness();h.run(`const historyTasks=[
    {id:'done',status:'done',date:'2026-11-20',doneDate:'2026-11-24',cost:30},
    {id:'fail',status:'failed',date:'2026-11-21',doneDate:'2026-11-24',cost:999},
    {id:'plan',status:'planned',date:'2026-12-01',cost:500},
    {id:'old',status:'done',date:'2026-11-18',cost:0}];const before=JSON.stringify(historyTasks);const history=notebookHistoryModel(historyTasks);`);
  assert.equal(h.run('history.mode'),'recorded');assert.equal(h.run('history.recorded'),3);assert.equal(h.run('history.planned'),1);
  assert.equal(h.run('history.groups[0].date'),'2026-11-24');assert.equal(h.run('history.groups[0].tasks.length'),2);
  assert.equal(h.run('history.groups.some(g=>g.tasks.some(t=>t.id==="plan"))'),false);
  assert.equal(h.run('JSON.stringify(historyTasks)===before'),true);
});

test('plans use due-date order with undated work last, while history falls back to recorded weather date',()=>{
  const h=harness();h.run(`const tasks=[{id:'later',status:'planned',date:'2026-12-01'},{id:'blank',status:'planned',date:''},{id:'early',status:'planned',date:'2026-11-20'},{id:'actual',status:'done',date:'2026-11-01',weatherSnapshot:{targetDate:'2026-11-25'}}];const plan=notebookHistoryModel(tasks,{mode:'planned'});`);
  assert.equal(h.run('plan.groups.map(g=>g.tasks[0].id).join(",")'),'early,later,blank');
  assert.equal(h.run('notebookHistoryModel(tasks).groups[0].date'),'2026-11-25');
  assert.equal(h.run('notebookHistoryModel(tasks,{mode:"planned",sort:"new"}).groups.map(g=>g.tasks[0].id).join(",")'),'later,early,blank');
});

test('type and failure filters keep overall category counts and do not affect cost totals',()=>{
  const h=harness();h.run(`S.tasks=[{id:'d',cycleId:'c',status:'done',type:'spray',cost:50,date:'2026-11-24'},{id:'f',cycleId:'c',status:'failed',type:'spray',cost:900,date:'2026-11-23'},{id:'p',cycleId:'c',status:'planned',type:'spray',cost:1000,date:'2026-12-01'}];const view=notebookHistoryModel(S.tasks,{type:'spray',outcome:'failed'});`);
  assert.equal(h.run('view.count'),1);assert.equal(h.run('view.recorded'),2);assert.equal(h.run('view.planned'),1);
  assert.equal(h.run('cycleFinance(S,"c").cost'),50);
  assert.equal(h.run('notebookHistoryModel(S.tasks,{type:"harvest"}).groups.length'),0);
});

test('compact history row uses saved material quantities and canonical cost, escapes content, and opens full details',()=>{
  const h=harness();h.run(`notebookIcon=()=>'';function projectCode(p){return p.code;}S.projects=[{id:'pr',code:'PRJ-001',name:'Project'}];const row=notebookHistoryRow({id:'t',title:'<unsafe>',status:'done',type:'spray',cost:0,projectId:'pr',note:'Long note is only in detail',photos:['a'],donePhotos:['a','b'],costItems:[{name:'Material',category:'chemical',usageQty:50,usageUnit:'ml',totalCost:999}]});`);
  const html=h.run('row');assert.match(html,/&lt;unsafe&gt;/);assert.match(html,/Material · ใช้ 50 มล\./);
  assert.match(html,/ต้นทุน 0 บาท/);assert.doesNotMatch(html,/999 บาท|Long note/);assert.match(html,/2 รูป/);assert.match(html,/PRJ-001 · Project/);
  assert.match(html,/App\.viewTask/);assert.doesNotMatch(html,/App\.toggleTask|App\.editTask/);
});

test('planned rows retain completion/reschedule actions and label amounts as budgets; failures have no actual-cost claim',()=>{
  const h=harness();h.run(`notebookIcon=()=>'';const plan=notebookHistoryRow({id:'p',title:'Plan',status:'planned',type:'spray',date:'',cost:650});const failed=notebookHistoryRow({id:'f',title:'Failed',status:'failed',date:'2026-11-20',cost:900});`);
  assert.match(h.run('plan'),/งบประมาณ 650 บาท/);assert.match(h.run('plan'),/App\.completeTaskFromCircle/);assert.match(h.run('plan'),/App\.rescheduleTask/);
  assert.doesNotMatch(h.run('plan'),/เลยกำหนด|ต้นทุน 650/);assert.match(h.run('failed'),/ไม่สำเร็จ/);assert.doesNotMatch(h.run('failed'),/ต้นทุน 900|App\.toggleTask/);
});

test('history mode and filters are isolated by plot/cycle and preserve UI state without saving farm data',()=>{
  const h=harness();h.run(`let renders=0;function rerender(){renders++;}App.notebookHistoryFilter('cycle:c','type','spray');App.notebookHistoryFilter('cycle:c','outcome','failed');App.notebookHistoryFilter('cycle:c','mode','planned');`);
  assert.equal(h.run('notebookHistoryFilters.get("cycle:c").outcome'),'');assert.equal(h.run('notebookHistoryFilters.get("cycle:c").sort'),'old');
  assert.equal(h.run('notebookHistoryFilters.get("cycle:c").type'),'spray');assert.equal(h.run('notebookHistoryFilters.has("plot:p:")'),false);
  assert.equal(h.run('renders'),3);assert.equal(h.run('S.tasks.length'),0);
});

test('restored plot history renders safely before notebook loading and refreshes when the module is ready',()=>{
  const h=harness({notebook:false}),app=source('js/app.js');
  h.run(`route.view='plotDetail';route.plotId='p';let plotDetailTab='tasks',plotTaskCycle='',rendered='';
    S.cycles[0].startDate='2026-11-01';S.cycles[0].round=1;S.cycles[0].plant='Corn';
    S.tasks=[{id:'done',plotId:'p',cycleId:'c',title:'Recorded work',date:'2026-11-24',status:'done',cost:30}];
    const ic=()=>'',cropEmoji=()=>'',cycleDurationLabel=()=>'',plotCoordinatesHtml=()=>'',plotWeatherCard=()=>'',plotPhotoCard=()=>'',plotWaterZonesCard=()=>'',plotWaterCard=()=>'',taskRowHtml=()=>'',dateLabel=date=>date,lucide={icons:{},createElement:()=>({outerHTML:''})};
    function render(){rendered=renderPlotDetail();}`);
  h.run(app.slice(app.indexOf('function renderPlotDetail()'),app.indexOf('App.openPlot =')));
  h.run('render()');assert.match(h.run('rendered'),/กำลังโหลดประวัติงาน/);
  h.run(source('js/cycle-notebook.js'));
  assert.match(h.run('rendered'),/งานที่ทำแล้ว/);assert.match(h.run('rendered'),/Recorded work/);
  assert.doesNotMatch(h.run('rendered'),/กำลังโหลดประวัติงาน/);assert.equal(h.run('S.tasks[0].cost'),30);
});
