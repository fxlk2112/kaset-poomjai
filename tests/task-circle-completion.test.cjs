const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(){
  const calls=[];
  const ctx=vm.createContext({Date,console,mockModalTask:(date,preset)=>calls.push({date,preset}),mockComplete:id=>calls.push({complete:id}),route:{},
    localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:()=>null,getElementById:()=>null},
    esc:value=>String(value??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))});
  const run=s=>vm.runInContext(s,ctx);
  run(source('js/data.js'));run(source('js/projects.js'));run('App.modalTask=mockModalTask;App.modalTaskComplete=mockComplete;let taskEditReturnToDetail=true;S.tasks=[];S.projects=[];');
  const app=source('js/app.js'),start=app.indexOf('App.reviewTaskCompletion =');
  run(app.slice(start,app.indexOf('\n};',start)+3));
  return {run,ctx,calls};
}

test('material circles open actual-quantity review without marking done, changing money or cutting stock',()=>{
  const h=harness();h.run(`S.tasks=[{id:'t',title:'Spray',type:'spray',status:'planned',date:'2099-01-01',cost:300,costItems:[{stockId:'s',qty:1}]}];S.stock=[{id:'s',qty:10}];const before=JSON.stringify(S);App.completeTaskFromCircle('t');`);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].preset.taskId,'t');assert.equal(h.calls[0].preset.completionReview,true);
  assert.equal(h.calls[0].date,h.run('todayISO()'));assert.equal(h.run('JSON.stringify(S)===before'),true);assert.equal(h.run('taskEditReturnToDetail'),false);
  for(const input of [{type:'fertilize'},{type:'work',costCat:'chemical'},{type:'work',costItems:[{category:'fertilizer'}]}])assert.equal(h.run(`taskNeedsMaterialReview(${JSON.stringify(input)})`),true);
});

test('ordinary circles use the completion form, while completed, failed and closed-project tasks cannot be toggled',()=>{
  const h=harness();h.run(`S.projects=[{id:'closed',status:'done'}];S.tasks=[{id:'work',type:'work',status:'planned'},{id:'done',status:'done'},{id:'failed',status:'failed'},{id:'locked',status:'planned',projectId:'closed'}];App.completeTaskFromCircle('work');for(const id of ['done','failed','locked','missing'])App.completeTaskFromCircle(id);`);
  assert.deepEqual(h.calls,[{complete:'work'}]);assert.equal(h.run('S.tasks[0].status'),'planned');assert.equal(h.run('S.tasks[1].status'),'done');
});

test('circle state is accessible, escaped, separate from detail actions and not a destructive uncheck',()=>{
  const h=harness();
  const pending=h.run(`taskCompletionCircleHtml({id:'x"',title:'<Spray>',status:'planned'})`);
  assert.match(pending,/aria-label="ทำเสร็จ: &lt;Spray&gt;"/);assert.match(pending,/App\.completeTaskFromCircle/);assert.doesNotMatch(pending,/disabled|toggleTask/);
  for(const status of ['done','failed']){const html=h.run(`taskCompletionCircleHtml({id:'x',title:'Work',status:'${status}'})`);assert.match(html,/disabled/);assert.doesNotMatch(html,/onclick=/);}
  const locked=h.run(`taskCompletionCircleHtml({id:'x',title:'Work',status:'planned'},{project:true,locked:true})`);assert.match(locked,/โครงการปิดแล้ว/);assert.match(locked,/disabled/);
});

test('project circles respect unsaved-record guards and reject tasks from another project',()=>{
  const h=harness(),records=source('js/project-records.js');
  h.run(`let projectSelectedTask='t',canLeave=false;function projectCanLeaveRecord(){return canLeave;}S.projects=[{id:'p',status:'active'}];S.tasks=[{id:'t',type:'work',status:'planned',projectId:'p'},{id:'other',status:'planned',projectId:'else'}];route.projectId='p';`);
  h.run(records.slice(records.indexOf('App.projectTaskComplete='),records.indexOf('\n',records.indexOf('App.projectTaskComplete='))));
  h.run(`App.projectTaskComplete('t');`);assert.equal(h.calls.length,0);
  h.run(`canLeave=true;App.projectTaskComplete('other');`);assert.equal(h.calls.length,0);
  h.run(`App.projectTaskComplete('t');`);assert.deepEqual(h.calls,[{complete:'t'}]);
});

test('a stale confirmation cannot resubmit an already completed material task',()=>{
  const h=harness(),app=source('js/app.js');
  h.ctx.document.querySelector=()=>({});h.ctx.toast=()=>{};
  h.run(`S.tasks=[{id:'t',status:'done',cost:350}];`);
  const start=app.indexOf('App.submitTask =');h.run(app.slice(start,app.indexOf('\n};',start)+3));
  assert.equal(h.run(`App.submitTask({preventDefault(){}},'t')`),false);assert.equal(h.run('S.tasks[0].cost'),350);assert.equal(h.run('S.tasks.length'),1);
});

test('detail and legacy completion entry points cannot bypass actual material review',()=>{
  const h=harness(),app=source('js/app.js');
  for(const method of ['modalTaskComplete','toggleTask']){
    const start=app.indexOf('App.'+method+' =');h.run(app.slice(start,app.indexOf('\n};',start)+3));
  }
  h.run(`S.tasks=[{id:'spray',title:'Spray',type:'spray',status:'planned',cost:300},{id:'fert',type:'fertilize',status:'planned'},{id:'mixed',type:'work',status:'planned',costItems:[{category:'chemical',qty:2,totalCost:50}]}];S.stock=[{id:'s',qty:10}];const before=JSON.stringify(S);`);
  h.run(`App.modalTaskComplete('spray',true);`);
  assert.equal(h.calls[0].preset.completionReview,true);assert.equal(h.run('taskEditReturnToDetail'),true);
  h.run(`App.toggleTask('fert');App.modalTaskComplete('mixed',false);`);
  assert.equal(h.calls.length,3);assert.ok(h.calls.every(call=>call.preset.completionReview));
  assert.equal(h.run('JSON.stringify(S)===before'),true);assert.equal(h.run('taskEditReturnToDetail'),false);
});

test('material review respects closed projects even when requested from task details',()=>{
  const h=harness();h.run(`S.projects=[{id:'p',status:'done'}];S.tasks=[{id:'t',type:'spray',status:'planned',projectId:'p'}];App.reviewTaskCompletion('t',true);`);
  assert.equal(h.calls.length,0);assert.equal(h.run('S.tasks[0].status'),'planned');
});
