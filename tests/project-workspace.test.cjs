const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(){
  const storage=new Map(),fields={};let fail=false;
  const ctx=vm.createContext({console,Date,JSON,App:{modalTask(){}},route:{},toast(){},render(){},closeModal(){},
    localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(fail)throw new Error('quota');storage.set(k,String(v));},removeItem:k=>storage.delete(k)},
    document:{getElementById:id=>fields[id]||null,querySelector:()=>null},setTimeout(){},
    trialUnitDescription:(_tr,u)=>u?.name||'sample'});
  const run=s=>vm.runInContext(s,ctx);
  run(source('js/data.js'));run(source('js/projects.js'));run(source('js/project-workspace.js'));
  const app=source('js/app.js');
  run(app.slice(app.indexOf('function trialById('),app.indexOf('function trialSamplingNotice(')));
  run(app.slice(app.indexOf('function trialValidDate('),app.indexOf('function trialDateInRange(')));
  run(app.slice(app.indexOf('function costStockMode('),app.indexOf('function costPriceMissing(')));
  run(source('js/project-activity.js'));
  run('S.projects=[];S.tasks=[];S.trials=[];S.plots=[{id:"p",sizeRai:10}];S.cycles=[{id:"c",plotId:"p",status:"active"}];S.stock=[{id:"s",qty:10,avgCost:250}];');
  return {run,ctx,fields,storage,quota:v=>{fail=v;}};
}
const draft='projectSuggest("ทดลองปุ๋ยข้าวโพด","2026-11-24")';
test('drafts create canonical planned activities without stock or actual costs',()=>{
  const h=harness();h.run(`const d=${draft};d.plotId='p';d.cycleId='c';d.stages[0].tasks[0].include=false;const p=projectCreateFromDraft(d);`);
  assert.equal(h.run('S.tasks.length'),6);assert.equal(h.run('S.stock[0].qty'),10);
  assert.equal(h.run('projectCosts(p).cost'),0);
  assert.ok(h.run('S.tasks.every(t=>t.projectId===p.id && t.cycleId==="c" && t.status==="planned")'));
});
test('invalid draft or cycle rejects before creating any project or task',()=>{
  const h=harness();
  assert.throws(()=>h.run('projectCreateFromDraft({version:1,stages:[{}]})'));
  assert.throws(()=>h.run(`const d=${draft};d.cycleId='c';projectCreateFromDraft(d);`));
  assert.equal(h.run('S.projects.length+S.tasks.length'),0);
});
test('quota failure preserves draft and retries once with the original project sequence',()=>{
  const h=harness();h.run(`projectDraft=${draft};projectStoreDraft();`);h.quota(true);
  h.run('App.projectConfirmDraft()');assert.equal(h.run('S.projects.length+S.tasks.length'),0);assert.ok(h.run('!!projectDraft'));
  h.quota(false);h.run('App.projectConfirmDraft()');assert.equal(h.run('S.projects.length'),1);assert.equal(h.run('S.tasks.length'),7);
  const code=h.run('S.projects[0].code');assert.match(code,/-001$/);
  h.run('App.projectConfirmDraft()');assert.equal(h.run('S.projects.length'),1);
});
test('project codes continue beyond existing codes and do not recycle after deletion',()=>{
  const h=harness();h.run(`const d=${draft};const first=projectCreateFromDraft(d);S.projects=[];const second=projectCreateFromDraft(d);`);
  assert.match(h.run('second.code'),/-002$/);
});
test('project costs count completed activity once and exclude planned estimates',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});S.tasks[0].status='done';S.tasks[0].cost=125;S.tasks[1].cost=999;`);
  assert.equal(h.run('projectCosts(p).cost'),125);assert.equal(h.run('taskFinance(S,()=>true).cost'),125);
});
test('saved report snapshots isolate photos/results and exclude opted-out or other-project observations',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});p.trialIds=['tr'];S.tasks[0].photos=[{src:'demo'}];
    S.trials=[{id:'tr',name:'Trial',units:[{id:'u',name:'Unit'}],observations:[
      {id:'o',unitId:'u',value:0,projectTaskId:S.tasks[0].id,photos:[{src:'old'}]},
      {id:'hidden',value:2,includeInReport:false},{id:'other',value:3,projectTaskId:'another-task'}]}];
    const snapshot=projectReportSnapshot(p);S.trials[0].observations[0].value=99;S.tasks[0].photos[0].src='changed';`);
  assert.equal(h.run('snapshot.results.length'),1);assert.equal(h.run('snapshot.results[0].value'),0);
  assert.equal(h.run('snapshot.tasks[0].photos[0].src'),'demo');
});
test('failed report persistence does not add a duplicate revision on retry',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});`);h.quota(true);h.run('App.projectSaveReport(p.id)');
  assert.equal(h.run('projectById(p.id).reportVersions.length'),0);
  h.quota(false);h.run('App.projectSaveReport(p.id)');assert.equal(h.run('projectById(p.id).reportVersions.length'),1);
});
test('materials reuse uses current costs and strips historical stock/allocation state',()=>{
  const h=harness();h.run(`const old={photos:['old'],costItems:[{stockId:'s',category:'chemical',qty:.5,unitCost:99,stockMode:'package',areaAllocation:{cost:2},stockLog:[1]},{name:'labour',category:'labor',qty:1,totalCost:50}]};const reuse=taskReusableMaterials(old,S);`);
  assert.equal(h.run('reuse.length'),1);assert.equal(h.run('reuse[0].unitCost'),250);assert.equal(h.run('reuse[0].totalCost'),250);
  assert.equal(h.run('reuse[0].areaAllocation'),undefined);assert.equal(h.run('reuse[0].stockLog'),undefined);
  assert.equal(h.run('S.stock[0].qty'),10);assert.equal(h.run('old.costItems[0].unitCost'),99);
});
test('cycle material notebook excludes planned and failed activities and follows actual dates',()=>{
  const h=harness();h.run(`S.tasks=[{id:'a',cycleId:'c',type:'spray',status:'done',date:'2026-01-01',doneDate:'2026-11-24'},
  {id:'b',cycleId:'c',type:'spray',status:'done',date:'2026-11-22'},
  {id:'c',cycleId:'c',type:'spray',status:'planned',date:'2026-11-25'},
  {id:'d',cycleId:'c',type:'spray',status:'failed',date:'2026-11-26'}];`);
  assert.equal(h.run('cycleMaterialHistory("c").map(t=>t.id).join(",")'),'a,b');
});
test('legacy materials receive an explicit partial-use mode matching the save and stock preview',()=>{
  const h=harness();h.run(`const reuse=taskReusableMaterials({costItems:[{stockId:'s',category:'chemical',qty:.5}]},S);`);
  assert.equal(h.run('reuse[0].stockMode'),'content');assert.equal(h.run('reuse[0].totalCost'),125);
});
test('switching accounts cannot create a project from the previous account draft',()=>{
  const h=harness();h.run(`var Auth={session:{email:'first@example.invalid'}};projectDraft=${draft};projectStoreDraft();Auth.session.email='second@example.invalid';App.projectConfirmDraft();`);
  assert.equal(h.run('S.projects.length'),0);
  assert.equal(h.run('projectStoreDraft()'),false);
});
test('closed projects reject trial attachment without altering links',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});p.status='done';S.trials=[{id:'tr'}];App.projectAttachTrial(p.id,'tr');`);
  assert.equal(h.run('p.trialIds.length'),0);
});
