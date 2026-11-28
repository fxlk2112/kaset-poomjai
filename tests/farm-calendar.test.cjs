const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(mobile=false){
  const calls=[],ctx=vm.createContext({Date,console,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>null,querySelector:()=>null},setTimeout(){},matchMedia:()=>({matches:mobile}),
    Auth:{session:{email:'test@local.invalid'},setSyncStatus(){}},Concept:{enabled:()=>true},renderHome:()=>'',renderPlanner:()=>'<legacy-list>',render(){},rerender(){},route:{},
    esc:v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])),ic:()=>'',notebookIcon:()=>'',localDirty:()=>false,openModal:html=>calls.push(html),closeModal(){}});
  const run=s=>vm.runInContext(s,ctx);
  for(const file of ['js/data.js','js/projects.js','js/project-workspace.js','js/farm-overview.js'])run(source(file));
  run(`let cal={y:2026,m:10,sel:'2026-11-27'},plannerCalendarOpen=true;const plannerSearch={query:'',plot:'',cycle:'',scope:'',type:''};todayISO=()=>'2026-11-27';`);
  run(source('js/farm-calendar.js'));
  ctx.fixture=require('../qa/farm-overview/fixture.cjs').buildOverviewDemo();run('Object.assign(S,fixture);');
  return {run,ctx,calls};
}
test('calendar months align Monday through Sunday, retain adjacent dates and clamp month changes',()=>{
  const {run}=harness();
  assert.equal(run(`farmCalendarDays('2026-11-27')[0]`),'2026-10-26');
  assert.equal(run(`farmCalendarDays('2026-11-27').at(-1)`),'2026-12-06');
  assert.equal(run(`farmCalendarDays('2026-11-27').length`),42);
  assert.equal(run(`farmCalendarMonth('2027-01-31',1)`),'2027-02-28');
  assert.equal(run(`farmCalendarMonth('2024-01-31',1)`),'2024-02-29');
  assert.equal(run(`farmCalendarMonth('2026-12-27',1)`),'2027-01-27');
});

test('calendar and project cards agree without inventing progress for historical or empty projects',()=>{
  const h=harness();
  h.run(`const p=S.projects[0];S.tasks=[{id:'historical',title:'Unknown quantity',projectId:p.id,status:'done',source:'project-history',date:'2026-11-27',dataStatus:'pending',missingFields:['ปริมาณ'],cost:0}];const before=JSON.stringify(S);`);
  for(const count of [1,0]){
    if(!count)h.run('S.tasks=[];');
    const html=h.run('farmCalendarProjects([p])');
    assert.ok(html.includes(h.run('projectProgressHtml(p)')));
    assert.match(html,/ยังไม่มีฐานงานตามแผน/);
    assert.doesNotMatch(html,/null%|NaN|undefined|<progress|100%/);
    if(count){assert.match(html,/ข้อมูลรอตรวจ 1 กิจกรรม/);assert.equal(h.run('JSON.stringify(S)===before'),true);}
  }
});

test('planned progress excludes imported work and failed outcomes stay out of remaining work',()=>{
  const h=harness();
  h.run(`const p=S.projects[0];S.tasks=[{id:'a',title:'Complete',projectId:p.id,status:'done',planTracked:true,date:'2026-11-27',cost:100},{id:'b',title:'Failed work',projectId:p.id,status:'failed',planTracked:true,date:'2026-11-27',cost:900},{id:'c',title:'Imported',projectId:p.id,status:'done',source:'project-history',date:'2026-11-27',cost:50}];const before=JSON.stringify(S);`);
  const html=h.run('farmCalendarProjects([p])');
  assert.match(html,/งานตามแผน 1\/2 งาน · 50%/);assert.match(html,/ไม่สำเร็จ 1 งาน/);
  assert.match(html,/ทำแล้ว 2 กิจกรรม/); // Imported work is complete, while failed work is not.
  h.run(`FarmOverview.projectTasks(p.id,'remaining');`);
  assert.doesNotMatch(h.calls.at(-1),/Failed work/);assert.match(h.calls.at(-1),/งานที่เหลือ 0/);
  h.run(`FarmOverview.projectTasks(p.id,'failed');`);assert.match(h.calls.at(-1),/Failed work/);
  assert.match(h.run(`farmCalendarSelected(farmCalendarModel(S,'2026-11-27'),'2026-11-27')`),/ไม่สำเร็จ 1 งาน/);
  assert.equal(h.run('projectCosts(p).cost'),150);assert.equal(h.run('JSON.stringify(S)===before'),true);
});

test('calendar, overview and completion control expose incomplete data without reopening completed work',()=>{
  const h=harness();h.run(`const t={id:'pending',title:'Supported material',status:'done',dataStatus:'pending',missingFields:['ปริมาณ'],date:'2026-11-27',cost:0};const failed={...t,status:'failed'};const before=JSON.stringify(S);`);
  for(const expression of ['farmCalendarChip(t)','farmCalendarTask(t)','overviewTaskRow(t)','taskCompletionCircleHtml(t)'])assert.match(h.run(expression),/ทำแล้ว · ข้อมูลรอตรวจ/);
  assert.match(h.run('taskCompletionCircleHtml(t)'),/disabled/);
  assert.equal(h.run('taskStatusText(failed)'),'ไม่สำเร็จ');
  assert.equal(h.run('taskStatusText({...t,status:"planned",date:"2026-11-26"})'),'เลยกำหนด');
  assert.equal(h.run('JSON.stringify(S)===before'),true);
});
test('calendar uses actual dates for results, planned dates for work and excludes invalid dates from grids',()=>{
  const {run}=harness();run(`S.tasks=[{id:'done',status:'done',date:'2026-11-01',doneDate:'2026-11-27'}, {id:'late',status:'planned',date:'2026-11-26'}, {id:'invalid',status:'planned',date:'2026-02-30'}];const model=farmCalendarModel(S,'2026-11-27');`);
  assert.equal(run(`model.byDay.has('2026-11-01')`),false);
  assert.equal(run(`model.selectedTasks[0].id`),'done');assert.equal(run('model.undated.length'),1);assert.equal(run('model.overdue.length'),1);
});
test('calendar filters and related ordinary projects use canonical IDs without creating tasks or costs',()=>{
  const {run}=harness();run(`const before=JSON.stringify(S);const model=farmCalendarModel(S,'2026-11-27',{plot:'demo-plot-1',cycle:'demo-cycle-active-0',project:'overview-project-0',status:'planned'});renderPlanner();FarmCalendar.view('week');renderPlanner();FarmCalendar.view('day');renderPlanner();`);
  assert.equal(run('model.selectedTasks.length'),2);assert.equal(run('model.related[0].kind'),'work');assert.equal(run('JSON.stringify(S)===before'),true);
  assert.equal(run(`farmCalendarModel(S,'2026-11-27',{query:'ใส่ปุ๋ย',type:'fertilize'}).selectedTasks.length`),1);
  assert.equal(run(`farmCalendarModel(S,'2026-11-27',{scope:'farm'}).tasks.length`),0);
});
test('month overflow opens the same day; task names are escaped and absent times stay absent',()=>{
  const {run}=harness();run(`const base={title:'<งาน>',type:'work',date:'2026-11-27',status:'planned'};S.tasks=Array.from({length:5},(_,i)=>({...base,id:'task-'+i}));const html=farmCalendarGrid(farmCalendarModel(S,'2026-11-27'),'2026-11-27','month');`);
  assert.match(run('html'),/ดูอีก 2 งาน/);assert.match(run('html'),/&lt;งาน&gt;/);assert.doesNotMatch(run('html'),/<งาน>|\d\d:\d\d/);
  assert.match(run(`farmCalendarChip({...base,id:'x',time:'09:15'})`),/09:15/);
});
test('mobile defaults to week and desktop to month, with working date/view navigation and legacy list retained',()=>{
  const desktop=harness(),mobile=harness(true);assert.equal(desktop.run('FarmCalendar.currentMode()'),'month');assert.equal(mobile.run('FarmCalendar.currentMode()'),'week');
  desktop.run(`FarmCalendar.select('2026-12-31');FarmCalendar.move(1);`);assert.equal(desktop.run('cal.sel'),'2027-01-31');
  desktop.run(`FarmCalendar.view('week');FarmCalendar.move(-1);`);assert.equal(desktop.run('cal.sel'),'2027-01-24');
  desktop.run(`FarmCalendar.today();FarmCalendar.select('invalid');`);assert.equal(desktop.run('cal.sel'),'2026-11-27');
  desktop.run('plannerCalendarOpen=false;');assert.equal(desktop.run('renderPlanner()'),'<legacy-list>');
});
test('calendar add inherits selected date and filters without assigning an invented time',()=>{
  const h=harness();h.ctx.savePreset=(date,preset)=>h.calls.push({date,preset});
  h.run(`App.modalTask=savePreset;FarmCalendar.select('2026-12-02');FarmCalendar.filter('plot','demo-plot-1');FarmCalendar.filter('cycle','demo-cycle-active-0');FarmCalendar.filter('project','overview-project-0');FarmCalendar.add();`);
  assert.equal(h.calls[0].date,'2026-12-02');assert.equal(h.calls[0].preset.cycleId,'demo-cycle-active-0');assert.equal(h.calls[0].preset.projectId,'overview-project-0');assert.equal(h.calls[0].preset.time,undefined);
});
test('calendar material rows use canonical review and confirmed work changes totals only once across surfaces',()=>{
  const h=harness(),app=source('js/app.js');h.ctx.review=[];h.run('let taskEditReturnToDetail=false;App.modalTask=(date,preset)=>review.push(preset);');
  const start=app.indexOf('App.reviewTaskCompletion =');h.run(app.slice(start,app.indexOf('\n};',start)+3));
  h.run(`const id='overview-fertilizer',t=S.tasks.find(x=>x.id===id),before=JSON.stringify(S),row=farmCalendarTask(t);App.completeTaskFromCircle(id);`);
  assert.match(h.run('row'),/App.completeTaskFromCircle/);assert.equal(h.ctx.review[0].completionReview,true);assert.equal(h.run('JSON.stringify(S)===before'),true);
  h.run(`updateTask(S,id,{...t,status:'done',doneDate:'2026-11-28',costItems:[{stockId:'demo-stock-1',name:'ปุ๋ยตัวอย่าง A',category:'fertilizer',qty:0.5,unit:'กระสอบ'}]},'replace');const after=JSON.stringify(S);renderPlanner();FarmCalendar.select('2026-11-28');renderPlanner();`);
  assert.equal(h.run('JSON.stringify(S)===after'),true);
  for(const expression of [`plotFinance(S,'demo-plot-1').cost`,`cycleFinance(S,'demo-cycle-active-0').cost`,`projectCosts(projectById('overview-project-0')).cost`])assert.equal(h.run(expression),525);
  assert.equal(h.run(`farmCalendarModel(S,'2026-11-28').selectedTasks.filter(x=>x.id===id).length`),1);
  assert.doesNotMatch(h.run('farmCalendarTask(t)'),/onclick="App.completeTaskFromCircle/);
});
