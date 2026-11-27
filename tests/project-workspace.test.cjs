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
  run(source('js/data.js'));run(source('js/projects.js'));run(source('js/project-workspace.js'));run(source('js/project-records.js'));run(source('js/project-report.js'));
  const app=source('js/app.js');
  run(app.slice(app.indexOf('function trialById('),app.indexOf('function trialSamplingNotice(')));
  run(app.slice(app.indexOf('function trialValidDate('),app.indexOf('function trialDateInRange(')));
  run(app.slice(app.indexOf('function costStockMode('),app.indexOf('function costPriceMissing(')));
  run(source('js/project-activity.js'));
  run('S.projects=[];S.tasks=[];S.trials=[];S.plots=[{id:"p",sizeRai:10}];S.cycles=[{id:"c",plotId:"p",status:"active"}];S.stock=[{id:"s",qty:10,avgCost:250}];');
  return {run,ctx,fields,storage,quota:v=>{fail=v;}};
}
const draft='projectSuggest("ทดลองปุ๋ยข้าวโพด","2026-11-24")';
test('experimental projects distinguish preparation, measurement and summary tasks',()=>{
  const h=harness();h.run(`const d=${draft};const p=projectCreateFromDraft(d);`);
  assert.equal(h.run("projectTaskList(p).map(t=>t.recordKind).join(',')"),'work,work,measurement,work,measurement,work,work');
  h.run("const weekly=projectSuggest('ทดลอง 4 สัปดาห์ วัดความสูง','');");
  assert.equal(h.run("weekly.stages.flatMap(s=>s.tasks).filter(t=>t.recordKind==='measurement').length"),5);
});
test('legacy preparation remains work while existing custom observations stay accessible',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});p.groups=['A'];p.measurementSchema=[{id:'height',name:'ความสูง',unit:'ซม.'}];const tr=projectSetupSamples(p,1),task=projectTaskList(p)[0];delete task.recordKind;tr.observations=[{id:'old',projectTaskId:task.id,value:12}];const before=JSON.stringify(tr.observations);`);
  assert.equal(h.run('projectTaskRecordKind(task,p)'),'work');
  h.run("task.title='งานเดิมที่ตั้งชื่อเอง';");assert.equal(h.run('projectTaskRecordKind(task,p)'),'measurement');
  assert.equal(h.run('JSON.stringify(tr.observations)===before'),true);
  h.run("task.recordKind='work';");assert.equal(h.run('projectTaskRecordKind(task,p)'),'work');
});
test('preparation renders work evidence instead of plant-value inputs, baseline renders values',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});p.groups=['A'];p.measurementSchema=[{id:'height',name:'ความสูง',unit:'ซม.'}];projectSetupSamples(p,1);projectTaskTree=()=>'<aside></aside>';pwIcon=()=>'';trialPhotosHtml=()=>'';projectSelectedTask=projectTaskList(p)[0].id;`);
  h.ctx.esc=String;h.ctx.dateLabel=String;const prep=h.run('projectWorkHtml(p)');assert.match(prep,/บันทึกการทำงาน/);assert.match(prep,/ดูวัตถุประสงค์และแผนโครงการ/);assert.doesNotMatch(prep,/pw-measure-table|projectRowCount|projectSaveRecord/);
  h.run('projectSelectedTask=projectTaskList(p)[2].id;');const baseline=h.run('projectWorkHtml(p)');assert.match(baseline,/pw-measure-table/);assert.match(baseline,/ความสูง/);assert.match(baseline,/บันทึกผล/);
});
test('measurement commit rejects work tasks without writing results or changing costs',()=>{
  const h=prepared();h.run("task.recordKind='work';record.rows[0].values[tr.metrics[0].id]='12';const before=JSON.stringify({records:p.records,observations:tr.observations,tasks:S.tasks});");
  assert.throws(()=>h.run('projectRecordCommit(p,task,tr,record)'),/งานนี้ใช้บันทึกการทำงาน/);
  assert.equal(h.run('JSON.stringify({records:p.records,observations:tr.observations,tasks:S.tasks})===before'),true);
});
test('switching task record kind preserves historical data and saved reports',()=>{
  const h=prepared();h.run("record.rows[0].values[tr.metrics[0].id]='12';projectRecordCommit(p,task,tr,record);p.reportVersions=[projectReportSnapshot(p)];route.projectId=p.id;const before=JSON.stringify({records:p.records,observations:tr.observations,versions:p.reportVersions,cost:projectCosts(p)});App.projectSetRecordKind(task.id,'work');");
  assert.equal(h.run('task.recordKind'),'work');assert.equal(h.run('JSON.stringify({records:p.records,observations:tr.observations,versions:p.reportVersions,cost:projectCosts(p)})===before'),true);
  h.run("App.projectSetRecordKind(task.id,'measurement');task.title='ชื่อใหม่';");assert.equal(h.run('projectTaskRecordKind(task,p)'),'measurement');
  h.run("p.status='done';App.projectSetRecordKind(task.id,'work');");assert.equal(h.run('task.recordKind'),'measurement');
});
test('ordinary plot work with fertilizer or yield does not create experiment setup',()=>{
  const h=harness();h.run(`const d=projectSuggest('ดูแลแปลง A ใส่ปุ๋ย ตัดหญ้า และเก็บเกี่ยวผลผลิต','');`);
  assert.equal(h.run('d.kind'),'work');assert.equal(h.run('d.schema.length+d.groups.length'),0);
  assert.equal(h.run('d.stages.flatMap(s=>s.tasks).map(t=>t.title).join(",")'),'ใส่ปุ๋ย,ตัดหญ้า,เก็บเกี่ยว');
  assert.equal(h.run(`projectSuggest('ใส่ปุ๋ย ไม่มีการทดลอง','').kind`),'work');
  assert.equal(h.run(`projectSuggest('พัฒนาเว็บและทดสอบระบบ','').kind`),'software');
});
test('simple project creation needs no tasks, trial, samples or actual spending',()=>{
  const h=harness();h.run(source('js/project-planner.js'));h.run(`const p=projectCreateSimple('ดูแลแปลงนี้','p','c');`);
  assert.equal(h.run('S.projects.length'),1);assert.equal(h.run('S.tasks.length+S.trials.length'),0);assert.equal(h.run('S.stock[0].qty'),10);
  assert.equal(h.run('p.plotId+":"+p.cycleId'),'p:c');assert.equal(h.run('projectHasExperiment(p)'),false);
  assert.throws(()=>h.run(`projectCreateSimple('   ','p','c')`));assert.equal(h.run('S.projects.length'),1);
});
test('rewriting an experiment as ordinary work clears hidden sample setup',()=>{
  const h=harness();h.run(source('js/project-planner.js'));h.fields.pdBriefEdit={value:'ดูแลแปลง ใส่ปุ๋ยและตัดหญ้า'};
  h.run(`projectDraft=projectSuggest('ทดลองปุ๋ย','');projectDraft.sampleCount=2;App.projectResuggest({preventDefault(){}});const p=projectCreateFromDraft(projectDraft);`);
  assert.equal(h.run('projectDraft.kind'),'work');assert.equal(h.run('projectDraft.sampleCount'),'');assert.equal(h.run('S.trials.length'),0);assert.equal(h.run('projectHasExperiment(p)'),false);
});
test('simple tasks inherit project plot and cycle and remain planned without costs',()=>{
  const h=harness();h.run(source('js/project-planner.js'));h.run(`const p=projectCreateSimple('ดูแลแปลงนี้','p','c');const t=projectAddSimpleTask(p,'ใส่ปุ๋ย');`);
  assert.equal(h.run('t.plotId+":"+t.cycleId'),'p:c');assert.equal(h.run('t.status'),'planned');assert.equal(h.run('t.date'),'');
  assert.equal(h.run('projectCosts(p).cost'),0);assert.equal(h.run('S.stock[0].qty'),10);
  h.quota(true);assert.equal(h.run(`projectTransaction(()=>projectAddSimpleTask(p,'ตัดหญ้า')).ok`),false);assert.equal(h.run('S.tasks.length'),1);
});
test('legacy projects without a kind are ordinary work until an experiment is linked',()=>{
  const h=harness();h.run(`const p={id:'old',stages:[]};`);assert.equal(h.run('projectHasExperiment(p)'),false);
  h.run(`p.trialIds=['tr1'];S.trials.push({id:'tr1'});`);assert.equal(h.run('projectHasExperiment(p)'),true);
});
test('undated planned work is not overdue and does not produce a due notification',()=>{
  const h=harness();h.run(`S.tasks=[{id:'u',date:'',status:'planned'},{id:'v',status:'planned'}];`);
  assert.equal(h.run('taskStatusOf(S.tasks[0])'),'planned');assert.equal(h.run('taskStatusOf(S.tasks[1])'),'planned');
  assert.equal(h.run('notifList(S).overdue.length+notifList(S).dueToday.length'),0);
});
test('ordinary project reports include work and documents without experiment chapters',async()=>{
  const h=harness();h.run(source('js/project-planner.js'));h.run(`const p=projectCreateSimple('ดูแลแปลงนี้','p','c');const t=projectAddSimpleTask(p,'ตัดหญ้า');t.status='done';t.doneNote='ตัดหญ้าเรียบร้อย';const snap=projectReportSnapshot(p);`);
  assert.equal(h.run('projectReportOrder(snap).includes("results")'),false);assert.equal(h.run('projectReportTitle(snap,"raw")'),'เอกสารประกอบ');
  h.ctx.TextEncoder=TextEncoder;h.ctx.Blob=Blob;h.run(source('js/project-docx.js'));const blob=await h.run('projectDocx(snap)'),xml=new TextDecoder().decode(await blob.arrayBuffer());
  assert.ok(xml.includes('ตัดหญ้าเรียบร้อย'));assert.ok(!xml.includes('ผลการทดลอง'));assert.ok(!xml.includes('ค่าวัด'));
});
test('invalid sample setup cannot leave a partial project or consume a code',()=>{
  const h=harness();assert.throws(()=>h.run(`const invalid=${draft};invalid.sampleCount='201';projectCreateFromDraft(invalid);`));
  assert.equal(h.run('S.projects.length+S.tasks.length+S.trials.length'),0);
});
test('editing report text persists without changing raw data or saved versions',()=>{
  const h=harness();h.run(`const p=projectCreateFromDraft(${draft});route.projectId=p.id;projectReportChapter='conclusion';App.projectReportText('ข้อสรุปแรก');App.projectSaveReport(p.id);projectReportVersion='';App.projectReportText('ข้อสรุปแก้ไข');`);
  assert.equal(h.run('p.reportConfig.texts.conclusion'),'ข้อสรุปแก้ไข');assert.equal(h.run('p.reportVersions[0].config.texts.conclusion'),'ข้อสรุปแรก');assert.equal(h.run('p.conclusion'),undefined);
  h.quota(true);h.run(`App.projectReportText('ไม่ควรบันทึก');`);assert.equal(h.run('projectById(p.id).reportConfig.texts.conclusion'),'ข้อสรุปแก้ไข');
});
test('report date scope filters results and record photos without altering source data',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='2';projectRecordCommit(p,task,tr,record);p.reportConfig={from:'2099-01-01'};const filtered=projectReportSnapshot(p);`);
  assert.equal(h.run('filtered.results.length+filtered.records.length'),0);assert.equal(h.run('tr.observations.length'),1);assert.equal(h.run('p.records.length'),1);
});
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

test('four-week brief creates weekly tasks and both metrics without inventing a start date',()=>{
  const h=harness();h.run(`const d=projectSuggest('ทดลองปุ๋ย A เทียบวิธีเดิม 4 สัปดาห์ วัดความสูงและจำนวนใบทุกสัปดาห์','');`);
  assert.equal(h.run('d.stages[1].tasks.length'),4);
  assert.equal(h.run('d.stages[1].tasks[3].title'),'เก็บข้อมูลสัปดาห์ที่ 4');
  assert.equal(h.run('d.stages.flatMap(s=>s.tasks).every(t=>t.date==="")'),true);
  assert.equal(h.run('d.schema.map(m=>m.name).join(",")'),'ความสูง,จำนวนใบ');
  assert.equal(h.run('d.groups[0]'),'ปุ๋ย A');
  h.run('const p=projectCreateFromDraft(d)');assert.equal(h.run('S.tasks.every(t=>t.date==="")'),true);
});
test('weekly scheduling crosses month boundaries and manual dates are preserved',()=>{
  const h=harness();h.run(source('js/project-planner.js'));
  h.run(`projectDraft=projectSuggest('ทดลอง 4 สัปดาห์ ความสูง','');projectDraft.stages[1].tasks[1].manualDate=true;projectDraft.stages[1].tasks[1].date='2026-12-04';App.projectDraftStart('2026-11-24');`);
  assert.equal(h.run('projectDraft.stages[1].tasks[0].date'),'2026-12-01');
  assert.equal(h.run('projectDraft.stages[1].tasks[1].date'),'2026-12-04');
  assert.equal(h.run('projectDraft.stages[1].tasks[3].date'),'2026-12-22');
});
function prepared(){const h=harness();h.run(`const d=projectSuggest('ทดลองปุ๋ย A เทียบวิธีเดิม 4 สัปดาห์ วัดความสูงและจำนวนใบ','');d.sampleCount=2;const p=projectCreateFromDraft(d),task=projectTaskList(p)[2],tr=projectLinkedTrials(p)[0];const record=projectRecordLoad(p,task,tr);`);return h;}
test('renaming experimental groups preserves samples, evidence, costs and frozen reports',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='12';record.photos=[{id:'photo',unitId:tr.units[0].id,src:'synthetic-photo',caption:'Evidence'}];projectRecordCommit(p,task,tr,record);p.reportVersions=[projectReportSnapshot(p)];const before=JSON.stringify({units:tr.units,observations:tr.observations,records:p.records,versions:p.reportVersions,tasks:S.tasks,stock:S.stock,cost:projectCosts(p)});const expected=projectGroupNames(tr),names=expected.map((t,i)=>({...t,name:'สูตร '+(i+1)}));projectRenameGroups(p,tr,names,expected);`);
  assert.equal(h.run('tr.treatments.map(t=>t.name).join(",")'),'สูตร 1,สูตร 2');
  assert.equal(h.run('p.groups.join(",")'),'สูตร 1,สูตร 2');
  assert.equal(h.run('JSON.stringify({units:tr.units,observations:tr.observations,records:p.records,versions:p.reportVersions,tasks:S.tasks,stock:S.stock,cost:projectCosts(p)})===before'),true);
  assert.equal(h.run('tr.groupNameHistory[0].changes.length'),2);
  assert.equal(h.run('projectReportSnapshot(p).results[0].groupName'),'สูตร 1');
  assert.equal(h.run('p.reportVersions[0].results[0].groupName===expected[0].name'),true);
});
test('current names refresh in memory, stored drafts and saved records without losing unsaved values',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='19';record.dirty=true;record.workNote='unsaved note';projectRecordStore();const names=projectGroupNames(tr).map((t,i)=>({...t,name:'ชื่อใหม่ '+i}));projectRenameGroups(p,tr,names,projectGroupNames(tr));`);
  assert.equal(h.run('projectRecordLoad(p,task,tr).rows[0].group'),'ชื่อใหม่ 0');
  h.run('projectRecordDraft=null;');
  assert.equal(h.run('projectRecordLoad(p,task,tr).rows[0].group'),'ชื่อใหม่ 0');
  assert.equal(h.run('projectRecordDraft.rows[0].values[tr.metrics[0].id]'),'19');
  assert.equal(h.run('projectRecordDraft.workNote+":"+projectRecordDraft.dirty'),'unsaved note:true');
  h.run('projectRecordCommit(p,task,tr,projectRecordDraft);localStorage.removeItem(projectRecordKey(p,task,tr));projectRecordDraft=null;');
  assert.equal(h.run('projectRecordLoad(p,task,tr).rows[0].group'),'ชื่อใหม่ 0');
});
test('invalid, stale and closed group edits cannot partially rename or move samples',()=>{
  const h=prepared();h.run('const names=projectGroupNames(tr),before=JSON.stringify(S);');
  for(const expression of [
    "names.map(t=>({...t,name:'ซ้ำ'}))",
    "names.map((t,i)=>({...t,name:i?'ใหม่':'   '}))",
    "names.map(t=>({...t,name:'x'.repeat(121)}))",
    "names.slice(1)",
    "names.map((t,i)=>({...t,id:i?t.id:'unrelated'}))"
  ]){assert.throws(()=>h.run(`projectRenameGroups(p,tr,${expression},names)`));assert.equal(h.run('JSON.stringify(S)===before'),true);}
  assert.throws(()=>h.run("projectRenameGroups(p,tr,names,[])"),/ถูกแก้ไขแล้ว/);
  h.run("p.status='done';");assert.throws(()=>h.run('projectRenameGroups(p,tr,names,names)'),/เปิดโครงการ/);
  h.run("p.status='active';tr.status='done';");assert.throws(()=>h.run('projectRenameGroups(p,tr,names,names)'),/เปิดโครงการ/);
});
test('failed group persistence rolls back and retry records one rename',()=>{
  const h=prepared();h.run("const names=projectGroupNames(tr),next=names.map((t,i)=>({...t,name:'New '+i}));");h.quota(true);
  assert.equal(h.run('projectTransaction(()=>projectRenameGroups(p,tr,next,names)).ok'),false);
  assert.equal(h.run('JSON.stringify(projectGroupNames(S.trials[0]))===JSON.stringify(names)'),true);
  assert.equal(h.run('S.trials[0].groupNameHistory'),undefined);
  h.quota(false);assert.equal(h.run('projectTransaction(()=>projectRenameGroups(S.projects[0],S.trials[0],next,names)).ok'),true);
  assert.equal(h.run('S.trials[0].groupNameHistory.length'),1);
});
test('renaming a linked trial leaves another trial and its project template alone',()=>{
  const h=prepared();h.run("const other=projectSetupSamples(p,1),before=JSON.stringify(other),groupTemplate=JSON.stringify(p.groups);projectRenameGroups(p,tr,projectGroupNames(tr).map((t,i)=>({...t,name:'New '+i})),projectGroupNames(tr));");
  assert.equal(h.run('JSON.stringify(other)===before && JSON.stringify(p.groups)===groupTemplate'),true);
});
test('live report and Word export show group names while saved editions keep original names',async()=>{
  const h=prepared();h.run("record.rows[0].values[tr.metrics[0].id]='12';projectRecordCommit(p,task,tr,record);const saved=projectReportSnapshot(p);projectRenameGroups(p,tr,projectGroupNames(tr).map((t,i)=>({...t,name:'สูตรใหม่ '+i})),projectGroupNames(tr));const live=projectReportSnapshot(p);");
  h.ctx.esc=String;h.ctx.fmtNum=String;h.ctx.fmtMoney=String;
  assert.match(h.run("projectReportChapterBody(live,'results')"),/สูตรใหม่ 0/);
  assert.doesNotMatch(h.run("projectReportChapterBody(saved,'results')"),/สูตรใหม่ 0/);
  h.ctx.TextEncoder=TextEncoder;h.ctx.Blob=Blob;h.run(source('js/project-docx.js'));const blob=await h.run('projectDocx(live)');
  assert.ok(new TextDecoder().decode(await blob.arrayBuffer()).includes('สูตรใหม่ 0'));
});
test('a failed multi-photo upload leaves no hidden partial evidence in the draft',async()=>{
  const h=prepared();let reads=0;
  h.ctx.readTaskPhotoFile=async()=>{if(++reads===2)throw new Error('unreadable image');return 'data:image/jpeg;base64,AA==';};
  await h.run(`App.projectAddPhotos([{type:'image/jpeg',size:10},{type:'image/jpeg',size:10}])`);
  assert.equal(reads,2);assert.equal(h.run('record.photos.length'),0);assert.equal(h.run('projectRecordUploading'),false);
  reads=0;await h.run(`App.projectAddPhotos([{type:'image/jpeg',size:10},{type:'text/plain',size:10}])`);
  assert.equal(reads,0);assert.equal(h.run('record.photos.length'),0);
});
test('project documents validate type and size and remain frozen in report versions',async()=>{
  const h=prepared();h.run(`p.attachments=[{id:'f1',name:'samples.csv',size:12,data:'data:text/csv;base64,YSxi',caption:'sample readings'}];const snap=projectReportSnapshot(p);p.attachments[0].caption='changed';p.attachments=[];`);
  assert.equal(h.run('snap.attachments[0].caption'),'sample readings');
  assert.equal(h.run('projectFileDownloadData(snap.attachments[0])'),'data:application/octet-stream;base64,YSxi');
  assert.equal(h.run(`projectFileDownloadData({data:'javascript:alert(1)'})`),'');
  assert.throws(()=>h.run(`projectValidateFiles([],[{name:'run.exe',size:12}])`));
  assert.throws(()=>h.run(`projectValidateFiles([],[{name:'large.pdf',size:3000000}])`));
  h.ctx.TextEncoder=TextEncoder;h.ctx.Blob=Blob;h.run(source('js/project-docx.js'));
  const blob=await h.run('projectDocx(snap)'),xml=new TextDecoder().decode(await blob.arrayBuffer());
  assert.ok(xml.includes('samples.csv'));assert.ok(xml.includes('sample readings'));assert.ok(!xml.includes('changed'));
});
test('one record stores several plants and metrics, preserving missing vs zero and task status',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='0';record.rows[0].values[tr.metrics[1].id]='12';record.rows[1].values[tr.metrics[0].id]='37.6';projectRecordCommit(p,task,tr,record);`);
  assert.equal(h.run('tr.observations.length'),3);assert.equal(h.run('tr.observations[0].value'),0);
  assert.equal(h.run('task.status'),'planned');assert.equal(h.run('projectCosts(p).cost'),0);
  assert.equal(h.run('p.records[0].rows[1].values[tr.metrics[1].id]'),'');
});
test('record validation is atomic on fractional counts and duplicate dates',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='32';record.rows[1].values[tr.metrics[1].id]='3.2';`);
  assert.throws(()=>h.run('projectRecordCommit(p,task,tr,record)'));
  assert.equal(h.run('tr.observations.length+p.records.length'),0);
  h.run(`record.rows[1].values[tr.metrics[1].id]='3';tr.observations.push({id:'other',unitId:record.rows[0].unitId,metricId:tr.metrics[0].id,date:record.date,value:1});`);
  assert.throws(()=>h.run('projectRecordCommit(p,task,tr,record)'));
  assert.equal(h.run('tr.observations.length'),1);assert.equal(h.run('p.records.length'),0);
});
test('record edit retains prior actor, time, caption, photo linkage and missing-value history',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='31';record.photos=[{id:'ph',src:'data:image/png;base64,AA==',caption:'before',unitId:record.rows[0].unitId,includeInReport:true}];record.workNote='measured';const first=projectRecordCommit(p,task,tr,record);record.baseUpdatedAt=first.updatedAt;record.rows[0].values[tr.metrics[0].id]='';record.photos[0].caption='after';projectRecordCommit(p,task,tr,record);`);
  assert.equal(h.run('tr.observations.length'),0);
  assert.equal(h.run('p.records[0].revisions[0].rows[0].values[tr.metrics[0].id]'),'31');
  assert.equal(h.run('p.records[0].revisions[0].photos[0].caption'),'before');
  assert.ok(h.run('p.records[0].revisions[0].createdBy'));
});
test('failed record persistence rolls back trials and project records together, retry is not duplicated',()=>{
  const h=prepared();h.run(`record.rows[0].values[tr.metrics[0].id]='38.2';`);h.quota(true);
  h.run(`projectTransaction(()=>projectRecordCommit(projectById(p.id),task,trialById(S,tr.id),record));`);
  assert.equal(h.run('S.trials[0].observations.length+S.projects[0].records.length'),0);
  h.quota(false);h.run('App.projectSaveRecord()');assert.equal(h.run('S.trials[0].observations.length'),1);assert.equal(h.run('S.projects[0].records.length'),1);
  h.run('App.projectSaveRecord()');assert.equal(h.run('S.trials[0].observations.length'),1);
});
test('stale drafts cannot overwrite a newer saved record',()=>{
  const h=prepared();h.run(`record.workNote='first';projectRecordCommit(p,task,tr,record);`);
  assert.throws(()=>h.run(`projectRecordCommit(p,task,tr,record)`),/ถูกแก้ไข/);
});
test('report includes completion evidence and individually selected record photos without duplicate observations',()=>{
  const h=prepared();h.run(`task.status='done';task.doneNote='completed work';task.note='planned';task.donePhotos=['completion.jpg'];record.rows[0].values[tr.metrics[0].id]='38';record.photos=[{id:'yes',src:'yes.jpg',caption:'keep',unitId:record.rows[0].unitId,includeInReport:true},{id:'no',src:'no.jpg',caption:'exclude',includeInReport:false}];projectRecordCommit(p,task,tr,record);const snap=projectReportSnapshot(p);`);
  assert.equal(h.run('snap.tasks.find(t=>t.id===task.id).note'),'completed work');
  assert.equal(h.run('snap.photos.map(ph=>ph.src).join(",")'),'yes.jpg,completion.jpg');
});
test('report excludes unlinked historical values unless explicitly included and freezes source edits',()=>{
  const h=prepared();h.run(`tr.observations.push({id:'legacy',unitId:tr.units[0].id,metricId:tr.metrics[0].id,value:7,date:todayISO()});const first=projectReportSnapshot(p);p.reportConfig={includeUnlinked:true};const second=projectReportSnapshot(p);tr.observations[0].value=100;`);
  assert.equal(h.run('first.results.length'),0);assert.equal(h.run('second.results[0].value'),7);
});
test('reschedule preserves original due date and reason and rolls back on storage failure',()=>{
  const h=prepared(),src=source('js/app.js');h.ctx.rerender=()=>{};h.run(src.slice(src.indexOf('App.saveTaskDate ='),src.indexOf('/* ปฏิทินงาน')));
  h.fields.rescheduleDate={value:'2026-12-10'};h.fields.rescheduleReason={value:'rain'};
  h.run('S.notifDismissed={};task.date="2026-12-09";App.saveTaskDate({preventDefault(){}},task.id)');
  assert.equal(h.run('task.scheduleHistory[0].oldDate'),'2026-12-09');assert.equal(h.run('p.events[0].reason'),'rain');
  h.quota(true);h.fields.rescheduleDate.value='2026-12-11';h.run('App.saveTaskDate({preventDefault(){}},task.id)');
  assert.equal(h.run('S.tasks.find(t=>t.id===task.id).date'),'2026-12-10');
  assert.equal(h.run('S.projects[0].events.length'),1);
});
