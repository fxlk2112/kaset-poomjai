const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
  const c=vm.createContext({console,Date,JSON,localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},setTimeout(){},App:{},Auth:{session:{email:'repair@example.invalid'}},route:{projectId:'p',view:'projectDataRepair'},esc:s=>String(s??'').replace(/[<>&"']/g,v=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[v]))});
  const run=s=>vm.runInContext(s,c);for(const file of ['data','batch-work','project-data-repair'])run(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'));
  run(`Object.assign(S,{projects:[{id:'p',name:'Synthetic project',status:'active'}],plots:[{id:'plot'}],cycles:[{id:'cycle',plotId:'plot',status:'active'}],stock:[],tasks:Array.from({length:7},(_,i)=>({id:'record-'+i,projectId:'p',plotId:'plot',cycleId:'cycle',projectStageId:'stage',source:'project-history',sourceRow:10+i,title:'Synthetic record '+i,type:'work',status:'done',date:i%2?'':todayISO(),doneDate:i%2?'':todayISO(),cost:0,revenue:0,incomeMode:'none',dataStatus:'pending',missingFields:['วันที่ทำจริง · ปริมาณ / หน่วยที่ใช้'],dataNote:'วันที่ทำจริง · ปริมาณ / หน่วยที่ใช้',photos:['photo-'+i],note:'preserve note',costItems:[{name:'Gift '+i,category:i===4?'labor':'fertilizer',qty:'',unit:'',totalCost:0,amountPending:false,funding:'supported',sponsor:'Synthetic sponsor',source:'manual'}]}))});
  const fill=d=>{d.rows.forEach((r,i)=>{r.selected=true;r.date=todayISO();if(i!==4){r.items[0].qty='2';r.items[0].unit='kg';}});return d;};`);
  return {run,c};
}
test('seven incomplete records update in place, keep evidence and cash support at zero across all scopes',()=>{
  const {run}=setup();run(`const before=JSON.stringify(S),d=fill(projectRepairDraft(S,'p')),p=projectRepairPlan(S,d);let writes=0;`);
  assert.equal(run('p.valid'),true);assert.equal(run('p.details.length'),7);assert.equal(run('p.delta'),0);assert.equal(run('JSON.stringify(S)===before'),true);
  run(`projectRepairCommit(S,d,()=>{writes++;return true;},p.signature);projectRepairCommit(S,d,()=>{writes++;return true;});`);
  assert.equal(run('writes'),1);assert.equal(run('S.tasks.length'),7);assert.equal(run('new Set(S.tasks.map(t=>t.id)).size'),7);assert.equal(run('projectRepairTasks(S,"p").length'),0);
  assert.equal(run('S.tasks.every((t,i)=>t.photos[0]==="photo-"+i&&t.note==="preserve note"&&t.sourceRow===10+i&&t.projectStageId==="stage")'),true);
  assert.equal(run('S.tasks.every(t=>materialIsSupported(t.costItems[0])&&t.cost===0)'),true);
  for(const [key,value] of [['plotId','plot'],['cycleId','cycle'],['projectId','p']])assert.equal(run(`taskFinance(S,t=>t.${key}==='${value}').cost`),0);
});
test('only selected ready records change; missing medicine quantity, unit, dates and negative cost are blocked',()=>{
  const {run}=setup();run(`const d=projectRepairDraft(S,'p');d.rows[0].selected=true;const before=JSON.stringify(S);`);
  assert.equal(run('projectRepairPlan(S,d).valid'),false);assert.throws(()=>run('projectRepairCommit(S,d,()=>true)'),/ตรวจ/);assert.equal(run('JSON.stringify(S)===before'),true);
  run(`d.rows[0].items[0].qty='2';d.rows[0].items[0].unit='kg';projectRepairCommit(S,d,()=>true);`);
  assert.equal(run('projectRepairTasks(S,"p").length'),6);assert.equal(run('S.tasks[1].date'),'');
  for(const change of ["d.rows[0].items[0].qty='0'","d.rows[0].items[0].unit=''","d.rows[0].date='2099-01-01'","d.rows[0].items[0].amount='-1'"]){const {run:r}=setup();r('const d=fill(projectRepairDraft(S,"p"));'+change);assert.equal(r('projectRepairPlan(S,d).valid'),false);}
});
test('sponsored cost is locked, ordinary cost replaces rather than increments, income and other scopes stay intact',()=>{
  const {run}=setup();run(`S.tasks[0].cost=10;S.tasks[0].revenue=55;S.tasks[0].incomeMode='general';delete S.tasks[0].costItems[0].funding;S.tasks[0].costItems[0].totalCost=10;const d=fill(projectRepairDraft(S,'p'));d.rows[0].items[0].amount='25';const p=projectRepairPlan(S,d);projectRepairCommit(S,d,()=>true,p.signature);`);
  assert.equal(run('p.delta'),15);assert.equal(run('S.tasks[0].cost'),25);assert.equal(run('taskFinance(S,()=>true).cost'),25);assert.equal(run('S.tasks[0].revenue'),55);assert.equal(run('S.tasks.length'),7);
  const {run:r}=setup();r(`const d=fill(projectRepairDraft(S,'p'));d.rows[0].items[0].amount='1';`);assert.equal(r('projectRepairPlan(S,d).valid'),false);
});
test('unknown pending notes require explicit acknowledgment and aggregate legacy cash is preserved',()=>{
  const {run}=setup();run(`S.tasks[0].missingFields.push('ตรวจใบเสร็จ');S.tasks[0].costItems=[];S.tasks[0].cost=100;const d=projectRepairDraft(S,'p');d.rows[0].selected=true;`);
  assert.equal(run('projectRepairPlan(S,d).valid'),false);run(`d.rows[0].otherChecked=true;projectRepairCommit(S,d,()=>true)`);assert.equal(run('S.tasks[0].cost'),100);
});
test('changed source, closed project, stock record and storage failure cannot partially apply',()=>{
  const {run}=setup();run(`const d=fill(projectRepairDraft(S,'p')),p=projectRepairPlan(S,d),before=JSON.stringify(S);`);
  assert.throws(()=>run('projectRepairCommit(S,d,()=>false,p.signature)'),/ไม่สำเร็จ/);assert.equal(run('JSON.stringify(S)===before'),true);
  run(`S.tasks[0].note='edited elsewhere'`);assert.equal(run('projectRepairPlan(S,d).valid'),false);
  run(`S.tasks[0].note='preserve note';S.projects[0].status='done'`);assert.throws(()=>run('projectRepairCommit(S,d,()=>true)'),/ปิด/);
  run(`S.projects[0].status='active';S.tasks[0].stockLog=[{id:'stock',qty:1}]`);assert.equal(run('projectRepairPlan(S,d).valid'),false);
});
test('review changes and account switches cannot save stale or other-user drafts; UI escapes names',()=>{
  const {run}=setup();run(`const d=fill(projectRepairDraft(S,'p')),p=projectRepairPlan(S,d);d.rows[0].items[0].qty='3'`);assert.throws(()=>run('projectRepairCommit(S,d,()=>true,p.signature)'),/เปลี่ยน/);
  run(`ProjectDataRepair.draft=d;ProjectDataRepair.owner=ProjectDataRepair.key('p');Auth.session.email='other@example.invalid';`);assert.equal(run('ProjectDataRepair.persist()'),false);
  run(`S.tasks[0].title='<img onerror="bad()">';ProjectDataRepair.draft=projectRepairDraft(S,'p')`);
  const html=run('renderProjectDataRepair()');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('readonly aria-readonly="true"'));assert.ok(html.includes('ตรวจรายการก่อนยืนยัน'));
});
