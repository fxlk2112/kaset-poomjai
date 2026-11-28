const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function harness() {
  const calls=[],ctx=vm.createContext({Date,console,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>null,querySelector:()=>null},setTimeout(){},
    Auth:{session:{email:'test@local.invalid'},setSyncStatus(state){this.syncState=state;}},Concept:{enabled:()=>true},renderHome:()=>'',render(){},route:{},
    esc:v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])),ic:()=>'',notebookIcon:()=>'',localDirty:()=>false,openModal:html=>calls.push(html)});
  const run=s=>vm.runInContext(s,ctx);
  run(source('js/data.js'));run(source('js/projects.js'));run(source('js/project-workspace.js'));run(source('js/farm-overview.js'));
  ctx.fixture=require('../qa/farm-overview/fixture.cjs').buildOverviewDemo();run('Object.assign(S,fixture);todayISO=()=>"2026-11-27";');
  return {ctx,run,calls};
}
test('day selection uses actual completion date; overdue, failed, undated and future work stay distinct',()=>{
  const h=harness();h.run(`S.tasks=[{id:'moved',status:'done',date:'2026-11-25',doneDate:'2026-11-27'}, {id:'plan',status:'planned',date:'2026-11-27'}, {id:'late',status:'planned',date:'2026-11-26'}, {id:'future',status:'planned',date:'2026-11-28'}, {id:'failed',status:'failed',date:'2026-11-27'}, {id:'undated',status:'planned',date:''}];const m=overviewModel(S,'2026-11-27','2026-11-27');`);
  for(const [key,expected] of Object.entries({onDay:3,pending:1,done:1,failed:1,overdue:1,upcoming:1,undated:1}))assert.equal(h.run(`m.${key}.length`),expected);
  assert.equal(h.run(`overviewModel(S,'2026-11-25','2026-11-27').done.length`),0);
  assert.equal(h.run(`overviewModel(S,'2026-11-28','2026-11-27').overdue.length`),1);
  assert.equal(h.run(`overviewModel(S,'2026-11-25','2026-11-27').upcoming.some(t=>t.id==='late')`),false);
});
test('week navigation handles months, leap days and Buddhist-year labels without UTC day drift',()=>{
  const h=harness();assert.equal(h.run(`overviewWeek('2027-01-01').join(',')`),'2026-12-28,2026-12-29,2026-12-30,2026-12-31,2027-01-01,2027-01-02,2027-01-03');
  assert.equal(h.run(`overviewOffset('2026-11-27',7)`),'2026-12-04');assert.equal(h.run(`overviewOffset('2024-02-28',1)`),'2024-02-29');
  assert.equal(h.run(`overviewValidDate('2026-02-30')`),false);assert.equal(h.run(`overviewValidDate('2026-13-01')`),false);
  assert.match(h.run(`overviewDate('2026-11-27',true)`),/2569/);
});
test('home and project lists read the same tasks without changing money, stock or saved state',()=>{
  const h=harness();h.run('const before=JSON.stringify(S);const first=renderHome();FarmOverview.select("2026-11-28");const second=renderHome();FarmOverview.projectTasks("overview-project-0","done");');
  assert.equal(h.run('JSON.stringify(S)===before'),true);
  assert.match(h.run('first'),/ทำแล้ว 2 จาก 5 งาน/);assert.match(h.run('first'),/ทำแล้ว 6 กิจกรรม/);assert.match(h.run('second'),/งานวันที่ 28/);
  assert.match(h.run('second'),/งานตามแผน 0\/4 งาน · 0%/);assert.match(h.calls[0],/overview-done-a-5/);assert.doesNotMatch(h.calls[0],/data-task-id="overview-fertilizer"/);
  h.run('FarmOverview.projectTasks("overview-project-0","remaining")');assert.match(h.calls[1],/data-task-id="overview-fertilizer"/);
});
test('material circle from overview opens review and cancellation leaves totals and reservations unchanged',()=>{
  const h=harness(),app=source('js/app.js');h.ctx.reviewCalls=[];
  h.run('let taskEditReturnToDetail=false;App.modalTask=(date,preset)=>reviewCalls.push({date,preset});');
  const start=app.indexOf('App.reviewTaskCompletion =');h.run(app.slice(start,app.indexOf('\n};',start)+3));
  h.run(`const before=JSON.stringify(S);const html=overviewTaskRow(S.tasks.find(t=>t.id==='overview-fertilizer'));App.completeTaskFromCircle('overview-fertilizer');`);
  assert.equal(h.ctx.reviewCalls[0].preset.completionReview,true);assert.equal(h.run('JSON.stringify(S)===before'),true);
  assert.match(h.run('html'),/App.completeTaskFromCircle/);assert.match(h.run('html'),/ตรวจปริมาณและต้นทุน/);
});
test('confirmed material work contributes once to plot, cycle and project and repeated reads or edits never deduct again',()=>{
  const h=harness();h.run(`const id='overview-fertilizer',t=S.tasks.find(t=>t.id===id),stock=S.stock.find(s=>s.id==='demo-stock-1'),beforeStock=stock.qty;
    updateTask(S,id,{...t,status:'done',doneDate:'2026-11-27',costItems:[{stockId:stock.id,name:stock.name,category:'fertilizer',qty:0.5,unit:stock.unit}]},'replace');
    FarmOverview.recordSaved([id]);renderHome();renderHome();FarmOverview.projectTasks(t.projectId,'done');`);
  for(const expr of [`plotFinance(S,'demo-plot-1').cost`,`cycleFinance(S,'demo-cycle-active-0').cost`,`projectCosts(projectById('overview-project-0')).cost`])assert.equal(h.run(expr),525);
  assert.equal(h.run('beforeStock-stock.qty'),1);assert.equal(h.run('stock.openQty'),0.5);assert.equal(h.run(`S.tasks.filter(t=>t.id===id).length`),1);
  h.run(`const saved=JSON.stringify(S);updateTask(S,id,{...t},'keep');`);
  assert.equal(h.run('stock.qty'),19);assert.equal(h.run(`cycleFinance(S,'demo-cycle-active-0').cost`),525);
});
test('save feedback only claims cloud success after acknowledgement, not pending, offline, failure or stale synced state',()=>{
  const h=harness(),status=opts=>h.run(`overviewSaveStatus(${JSON.stringify({hasSession:true,...opts})}).tone`);
  assert.equal(status({state:'synced',dirty:false}),'synced');assert.equal(status({state:'synced',dirty:true}),'pending');
  for(const state of ['pending','checking','offline'])assert.equal(status({state}),'pending');
  for(const state of ['error','conflict','reauth'])assert.equal(status({state}),'error');
  assert.equal(status({state:'synced',failed:true}),'error');assert.equal(status({state:'synced',preview:true}),'local');
  h.run('FarmOverview.recordSaved(["overview-fertilizer"]);Auth.session.email="different@local.invalid";');assert.equal(h.run('FarmOverview.receiptHtml()'),'');
});
test('empty data, missing dates and special characters render safely without manufactured projects or overdue work',()=>{
  const h=harness();h.run(`S.plots=[];S.cycles=[];S.tasks=[];S.projects=[];const empty=renderHome();`);
  assert.match(h.run('empty'),/ยังไม่มีงานในวันที่เลือก/);assert.match(h.run('empty'),/ยังไม่มีโครงการ/);assert.doesNotMatch(h.run('empty'),/class="fo-overdue"/);
  h.run(`const unsafe=overviewTaskRow({id:'x"',title:'<img src=x>',status:'planned'});`);assert.match(h.run('unsafe'),/&lt;img src=x&gt;/);assert.doesNotMatch(h.run('unsafe'),/<img src=x>/);
});
test('optional planned time survives edits and serialization, clears fully, and never falls back to actual completion time',()=>{
  const h=harness();
  h.run(`const t=S.tasks.find(t=>t.id==='overview-moisture');t.doneTime='17:45';const stockBefore=JSON.stringify(S.stock);`);
  assert.doesNotMatch(h.run('overviewTaskRow(t)'),/17:45|fo-task-detail[^>]*><span>/);
  h.run(`updateTask(S,t.id,{time:'09:15'},'keep');Object.assign(S,JSON.parse(JSON.stringify(S)));`);
  assert.match(h.run(`overviewTaskRow(S.tasks.find(t=>t.id==='overview-moisture'))`),/09:15/);
  h.run(`updateTask(S,'overview-moisture',{time:''},'keep');`);
  assert.doesNotMatch(h.run(`overviewTaskRow(S.tasks.find(t=>t.id==='overview-moisture'))`),/09:15|17:45|fo-task-detail[^>]*><span>/);
  for(const value of ['','24:00','12:60','9:15','09:15:00',null])assert.equal(h.run(`taskPlannedTime({time:${JSON.stringify(value)}})`),'');
  assert.equal(h.run(`taskPlannedTime({time:'00:00'})`),'00:00');
  assert.equal(h.run(`taskPlannedTime({time:'23:59'})`),'23:59');
  assert.equal(h.run('JSON.stringify(S.stock)===stockBefore'),true);
});
test('overview fixture has no invented times and cleanup preserves user times, costs and unrelated tasks',()=>{
  const fixture=require('../qa/farm-overview/fixture.cjs').buildOverviewDemo();
  assert.ok(fixture.tasks.every(t=>!t.time&&!t.doneTime));
  const {removeSampleTimes}=require('../qa/farm-overview/remove-sample-times.cjs');
  const state={tasks:[{id:'overview-moisture',time:'08:30',cost:12},{id:'overview-fertilizer',time:'09:15',doneTime:'11:20'}, {id:'overview-done-a-0',doneTime:'07:00'}, {id:'real-task',time:'08:30',doneTime:'07:00'}]};
  removeSampleTimes(state);removeSampleTimes(state);
  assert.deepEqual(state.tasks,[{id:'overview-moisture',cost:12},{id:'overview-fertilizer',time:'09:15',doneTime:'11:20'},{id:'overview-done-a-0'},{id:'real-task',time:'08:30',doneTime:'07:00'}]);
});
