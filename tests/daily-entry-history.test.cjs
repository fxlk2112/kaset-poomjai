const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function harness(){
  const ctx=vm.createContext({console,Date,JSON,TextEncoder,Blob,App:{modalTask(){}},route:{},toast(){},render(){},rerender(){},closeModal(){},setTimeout(){},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{getElementById:()=>null,querySelector:()=>null},taskAllPhotos:t=>[...(t.photos||[]),...(t.donePhotos||[])],dateLabel:d=>d,trialUnitDescription:()=>''});
  ctx.esc=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  const run=s=>vm.runInContext(s,ctx);
  for(const f of ['data','projects','project-workspace','project-planner','project-records','project-report','project-docx','project-proposal','project-report-editor','project-history','cycle-notebook','plot-materials'])run(source('js/'+f+'.js'));
  const app=source('js/app.js');run(app.slice(app.indexOf('function taskMaterialItems('),app.indexOf('function taskMaterialsHtml(')));
  run(app.slice(app.indexOf('function trialValidDate('),app.indexOf('function trialDateInRange(')));
  run(`notebookIcon=()=>'';pwIcon=()=>'';S.tasks=[];S.stock=[];S.trials=[];S.plots=[{id:'plot',name:'Plot',sizeRai:2}];S.cycles=[{id:'cycle',plotId:'plot',plant:'Corn',round:1,status:'active'}];S.projects=[{id:'p',code:'PRJ-QA',name:'Project',status:'active',plotId:'plot',cycleId:'cycle',stages:[{id:'s',name:'Work'}]}];const p=S.projects[0];`);
  return {run,ctx};
}
test('completed logs alone never fabricate 100 percent planned progress',()=>{
  const h=harness();h.run(`S.tasks=Array.from({length:33},(_,i)=>({id:'t'+i,title:'Entry',projectId:'p',status:'done',source:'qa-sheet-import',cost:i,photos:[]}));const before=JSON.stringify(S);const html=projectProgressHtml(p);`);
  assert.equal(h.run('projectCounts(p).done'),33);assert.equal(h.run('projectProgress(p)'),null);
  assert.match(h.run('html'),/ทำแล้ว 33 กิจกรรม/);assert.doesNotMatch(h.run('html'),/100%|<progress/);
  assert.equal(h.run('JSON.stringify(S)===before'),true);
});
test('plan denominator ignores ad-hoc expenses and survives completing, failing and regrouping work',()=>{
  const h=harness();h.run(`const a=addTask(S,{projectId:'p',plotId:'plot',cycleId:'cycle',status:'planned',cost:0});const b=addTask(S,{projectId:'p',status:'planned',cost:0});updateTask(S,a.id,{status:'done'});updateTask(S,b.id,{status:'failed'});addTask(S,{projectId:'p',status:'done',cost:200});`);
  assert.equal(h.run('projectPlanProgress(p).total'),2);assert.equal(h.run('projectPlanProgress(p).done'),1);assert.equal(h.run('projectProgress(p)'),50);
  h.run(`a.activityGroupId='same';b.activityGroupId='same';`);assert.equal(h.run('projectProgress(p)'),50);
  assert.equal(h.run('projectCosts(p).cost'),200);
});
test('legacy draft plans remain tracked, while unknown completed work remains unclassified as a plan',()=>{
  const h=harness();h.run(`S.tasks=[{id:'known',projectId:'p',source:'project-draft',status:'done'},{id:'legacy',projectId:'p',status:'done'}];`);
  assert.equal(h.run('projectPlanProgress(p).total'),1);assert.equal(h.run('projectProgress(p)'),100);
  assert.match(h.run('projectProgressHtml(p)'),/ความคืบหน้าของงานตามแผน ไม่ใช่ผลสำเร็จของโครงการ/);
});

test('pending work without a matching stage remains visible on the work page',()=>{
  const h=harness();h.run(`taskCompletionCircleHtml=()=>'';taskNeedsMaterialReview=()=>false;notebookHistoryHtml=()=>'';S.tasks=[{id:'orphan',projectId:'p',projectStageId:'removed',title:'Unassigned task',status:'planned'}];const html=ppWorkPage(p,{tasks:S.tasks,photos:[],config:{},conclusion:''});`);
  assert.match(h.run('html'),/งานที่ยังไม่จัดขั้นตอน/);assert.match(h.run('html'),/Unassigned task/);
});
const mixed=`const items=[{name:'Fertilizer',category:'fertilizer',qty:5,unit:'kg',totalCost:100},{name:'Labor QA',category:'labor',qty:0,unit:'',totalCost:200},{name:'Old labor',category:'other',qty:0,unit:'',totalCost:50},{name:'Supported',category:'fertilizer',qty:2,unit:'kg',funding:'supported',totalCost:0}];const t={id:'t',projectId:'p',projectStageId:'s',plotId:'plot',cycleId:'cycle',title:'Apply <fertilizer>',type:'fertilize',status:'done',date:'2026-11-28',cost:350,costItems:items,photos:['sample.jpg'],donePhotos:['sample.jpg']};S.tasks.push(t);`;

test('a stale mirrored stock field cannot turn classified labor into a material',()=>{
  const h=harness();h.run(`const t={stockId:'old',qty:1,unit:'kg',costItems:[{name:'Labor',category:'labor',totalCost:200}]};`);
  assert.equal(h.run('taskMaterialItems(t).length'),0);
  assert.equal(h.run('taskMaterialItems({...t,costItems:[]}).length'),1);
});

test('reuse confirmation retains the live form and labor, and never changes the ledger',()=>{
  const h=harness();h.run(source('js/project-activity.js'));
  h.run(`const controls={t_plot:{value:'plot'},t_cycle:{value:'cycle'},t_type:{value:'fertilize'},t_usecost:{checked:false},taskReuseStatus:{after(el){controls.taskReuseConfirm=el;}}};
    document.getElementById=id=>controls[id]||null;document.createElement=()=>({setAttribute(){},remove(){delete controls.taskReuseConfirm;}});
    let taskEditingId='',taskCostItems=[{name:'Old material',category:'fertilizer',qty:1,unit:'kg',totalCost:9},{name:'Labor',category:'labor',externalTotal:50,totalCost:50}];
    const TaskWizard={persist(){}};App.taskToggleCost=()=>{};App.costRender=()=>{};App.confirm=()=>{throw Error('Must not replace the live form');};
    S.tasks=[{id:'previous',plotId:'plot',cycleId:'cycle',type:'fertilize',date:'2026-11-27',status:'done',cost:20,costItems:[{name:'New material',category:'fertilizer',qty:2,unit:'kg',totalCost:20}]}];const before=JSON.stringify(S);
    App.taskUsePreviousMaterials();`);
  assert.equal(h.run('taskCostItems[0].name'),'Old material');
  assert.equal(h.run('!!controls.taskReuseConfirm'),true);
  h.run('App.taskUsePreviousMaterials(true);');
  assert.equal(h.run('taskCostItems[0].name'),'New material');assert.equal(h.run('taskCostItems[1].totalCost'),50);
  assert.equal(h.run('controls.t_usecost.checked'),true);assert.equal(h.run('!!controls.taskReuseConfirm'),false);
  assert.equal(h.run('JSON.stringify(S)===before'),true);
});
test('labor and unclassified lump sums stay out of materials without changing the canonical total',()=>{
  const h=harness();h.run(mixed+`const before=JSON.stringify(S);const model=materialHistoryModel([t,t]);const html=materialHistoryHtml('plot');`);
  assert.equal(h.run('model.cost'),100);assert.equal(h.run('model.products.length'),2);assert.equal(h.run('model.rows.length'),1);assert.equal(h.run('model.unclassified.length'),1);
  assert.equal(h.run('model.products.find(p=>p.name==="Supported").supported'),1);
  assert.equal(h.run('projectCosts(p).cost'),350);assert.equal(h.run('cycleFinance(S,"cycle").cost'),350);
  assert.equal(h.run('notebookModel(S.cycles[0]).categories.materials'),100);
  assert.match(h.run('html'),/ได้รับสนับสนุน/);assert.doesNotMatch(h.run('html'),/Labor QA|Old labor/);
  assert.equal(h.run('JSON.stringify(S)===before'),true);
});
test('table exposes saved quantities, actual dates and direct edit without duplicate accounting',()=>{
  const h=harness();h.run(mixed+`const before=JSON.stringify(S);t.doneDate='2026-11-27';const html=notebookHistoryHtml(S.tasks,'project:p',{hideProject:true});const filtered=notebookHistoryModel(S.tasks,{query:'Supported'});`);
  assert.match(h.run('html'),/<table class="nb-history-table"/);assert.match(h.run('html'),/2026-11-27/);
  assert.match(h.run('html'),/Apply &lt;fertilizer&gt;/);assert.match(h.run('html'),/5 กก\./);assert.match(h.run('html'),/350 บาท/);assert.match(h.run('html'),/รวมค่าแรง 200/);
  assert.match(h.run('html'),/1 รูป/);assert.match(h.run('html'),/App\.editTask/);assert.match(h.run('html'),/ตรวจหมวด 1 รายการ/);
  assert.equal(h.run('filtered.count'),1);assert.equal(h.run('S.tasks.length'),1);assert.equal(h.run('projectCosts(p).cost'),350);
});
test('editing historical expense categories preserves sponsorship, cash and frozen report editions',()=>{
  const h=harness();h.run(`const t=projectHistoryRecord(p.id,{title:'Work',date:'2026-11-28',items:[{name:'Fertilizer',category:'fertilizer',qty:5,unit:'kg',funding:'supported'},{name:'Labor',category:'labor',amount:200}]});const snap=projectReportSnapshot(p);const frozen=JSON.stringify(snap);projectHistoryRecord(p.id,{title:t.title,date:t.date,items:[{name:'Fertilizer',category:'fertilizer',qty:6,unit:'kg',funding:'supported'},{name:'Labor',category:'labor',amount:200}]},t.id);`);
  assert.equal(h.run('t.costItems[1].category'),'labor');assert.equal(h.run('materialHistoryModel(S.tasks).cost'),0);
  assert.equal(h.run('projectCosts(p).cost'),200);assert.equal(h.run('cycleFinance(S,"cycle").cost'),200);assert.equal(h.run('S.tasks.length'),1);
  assert.equal(h.run('ppExpenseRows(snap).reduce((n,r)=>n+r.amount,0)'),200);assert.equal(h.run('JSON.stringify(snap)===frozen'),true);
});
test('viewing and editing a stock-backed activity charges inventory only once alongside labor and supported material',()=>{
  const h=harness();h.run(`S.stock=[{id:'stock',name:'A',unit:'bottle',qty:5,openQty:0,avgCost:100}];const items=[{stockId:'stock',name:'A',category:'chemical',qty:1,unit:'bottle',unitCost:100,totalCost:100,stockMode:'package'},{name:'Labor',category:'labor',totalCost:200},{name:'Support',category:'fertilizer',qty:5,unit:'kg',funding:'supported',totalCost:0}];const t=addTask(S,{projectId:'p',plotId:'plot',cycleId:'cycle',status:'done',type:'spray',cost:300,costItems:items});const first=JSON.stringify(S.stock);for(let i=0;i<3;i++){materialHistoryModel(S.tasks);projectCosts(p);notebookHistoryModel(S.tasks);}updateTask(S,t.id,{title:'Edited note',cost:300,costItems:items});`);
  assert.equal(h.run('S.tasks.length'),1);assert.equal(h.run('S.stock[0].qty'),4);assert.equal(h.run('JSON.stringify(S.stock)===first'),true);
  assert.equal(h.run('materialHistoryModel(S.tasks).cost'),100);assert.equal(h.run('projectCosts(p).cost'),300);assert.equal(h.run('cycleFinance(S,"cycle").cost'),300);
});
test('medicine guard still rejects absent or invalid quantity, even for free supported materials',()=>{
  const h=harness();for(const qty of ['',0,-1,'invalid']){h.ctx.qty=qty;assert.match(h.run(`taskMaterialReviewError('fertilize',true,[{name:'Support',category:'fertilizer',qty,unit:'kg',funding:'supported'}])`),/ปริมาณ/);}
  assert.equal(h.run(`taskMaterialReviewError('fertilize',true,[{name:'Support',category:'fertilizer',qty:1,unit:'kg',funding:'supported'},{name:'Labor',category:'labor',totalCost:200}])`),'');
});
