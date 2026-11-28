const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {buildFixture}=require('../qa/high-integrity/fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(){
  const store=new Map();
  const context=vm.createContext({console,Date,App:{},route:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},ic:name=>`<i>${name}</i>`,dateLabel:v=>v||'ไม่ระบุวันที่',fmtNum:String});
  const run=code=>vm.runInContext(code,context);
  run(read('js/data.js'));run(read('js/project-records.js'));
  const app=read('js/app.js');run(app.slice(app.indexOf('function cycleJourneyHtml('),app.indexOf('function renderCycleDetail(')));
  run("function pwIcon(){return '';}function esc(value){return String(value??'').replaceAll('<','&lt;').replaceAll('>','&gt;');}");
  return {context,run,store};
}

test('attachment metadata has a safe missing-date label without inventing or changing dates',()=>{
  const h=harness();
  for(const value of [undefined,null,'','  ','invalid-date',NaN,Infinity,{},true]){
    h.context.dateValue=value;assert.equal(h.run('projectFileDateLabel(dateValue)'),'ไม่ระบุวันที่แนบ');
  }
  for(const value of [1795827600000,'2026-11-28T01:00:00.000Z']){
    h.context.dateValue=value;assert.equal(h.run('projectFileDateLabel(dateValue)'),new Date(value).toLocaleDateString('th-TH'));
  }
  h.run("const p={id:'p',attachments:[{id:'f',name:'example.txt',size:1,data:'data:text/plain;base64,QQ=='}]};const before=JSON.stringify(p);const html=projectFilesHtml(p);");
  assert.match(h.run('html'),/1 KB · ไม่ระบุวันที่แนบ/);
  assert.doesNotMatch(h.run('html'),/Invalid Date|undefined|1970|2513/);
  assert.equal(h.run('JSON.stringify(p)'),h.run('before'));
});

test('cycle overview shows partial and fully performed unsuccessful work as actual execution, without success ticks',()=>{
  const h=harness();
  for(const execution of ['partial','full']){
    h.context.execution=execution;
    h.run("var tasks=[{id:'t',type:'fertilize',status:'failed',execution}];var html=cycleJourneyHtml({id:'c',status:'active'},tasks);");
    assert.match(h.run('html'),execution==='partial'?/ทำบางส่วน 1 งาน/:/ทำแล้วแต่ผลไม่เป็นไปตามเป้า 1 งาน/);
    assert.doesNotMatch(h.run('html'),/ยังไม่มีบันทึกงานดูแล|ทำสำเร็จ 1 งาน/);
    assert.match(h.run('html'),/<li class="waiting"><span class="work-journey-mark"><i>clock<\/i><\/span><span><b>ดูแลแปลง/);
  }
});

test('mixed care and harvest outcomes remain distinct from plans and unperformed failures',()=>{
  const h=harness();h.run(`const tasks=[
    {id:'ok',type:'fertilize',status:'done'},
    {id:'part',type:'spray',status:'failed',execution:'partial'},
    {id:'full',type:'harvest',status:'failed',execution:'full'},
    {id:'not-started',type:'spray',status:'failed',execution:'none'},
    {id:'legacy',type:'spray',status:'failed'},
    {id:'plan',type:'harvest',status:'planned',date:'2026-12-01'}];
    const before=JSON.stringify(tasks),html=cycleJourneyHtml({id:'c',status:'active'},tasks);`);
  const html=h.run('html');
  assert.match(html,/ทำสำเร็จ 1 งาน · ทำบางส่วน 1 งาน · ทำแล้วแต่ผลไม่เป็นไปตามเป้า 1 งาน · รอทำ 1 งาน/);
  assert.match(html,/<b>ดูแลแปลง<\/b><small>ทำสำเร็จ 1 งาน · ทำบางส่วน 1 งาน/);
  assert.match(html,/<b>เก็บเกี่ยว<\/b><small>ทำแล้วแต่ผลไม่เป็นไปตามเป้า 1 งาน/);
  assert.equal(h.run('JSON.stringify(tasks)'),h.run('before'));
  h.run("const empty=cycleJourneyHtml({id:'c',status:'active'},tasks.slice(3));");
  assert.match(h.run('empty'),/ยังไม่มีบันทึกงานดูแล/);
  assert.doesNotMatch(h.run('empty'),/ทำบางส่วน|ทำสำเร็จ|1 งานที่วางแผน/);
});

test('repeated overview/file renders, cost review saves and reload preserve one expense, stock and seven incomplete records',()=>{
  const h=harness();h.context.fixture=buildFixture();h.run('Object.assign(S,fixture);saveState(S);Object.assign(S,loadState());');
  const missingBefore=h.run('JSON.stringify(S.tasks.filter(t=>t.dataStatus==="pending"))');
  h.run(`S.projects[0].attachments=[{id:'no-date',name:'sample.txt',size:1,data:'data:text/plain;base64,QQ=='}];
    const task=S.tasks.find(t=>t.id==='planned-material'),items=JSON.parse(JSON.stringify(task.costItems));
    items[0].qty=1;items[0].totalCost=50;
    updateTask(S,task.id,{status:'failed',execution:'partial',doneDate:'2026-11-28',costItems:items});
    const snapshot=JSON.stringify(S);
    for(let i=0;i<3;i++){cycleJourneyHtml(S.cycles[0],S.tasks);projectFilesHtml(S.projects[0]);}
  `);
  assert.equal(h.run('JSON.stringify(S)'),h.run('snapshot'),'rendering must not save or normalize source data');
  h.run("updateTask(S,task.id,{status:'failed',execution:'partial',costItems:items});saveState(S);Object.assign(S,loadState());");
  for(const query of ['plotFinance(S,"integrity-qa").cost','cycleFinance(S,"integrity-qa").cost','taskFinance(S,t=>t.projectId==="integrity-qa").cost'])assert.equal(h.run(query),50);
  assert.equal(h.run('S.stock[0].qty'),9);assert.equal(h.run('S.tasks.filter(t=>t.id==="planned-material").length'),1);
  assert.equal(h.run('JSON.stringify(S.tasks.filter(t=>t.dataStatus==="pending"))'),missingBefore);
  assert.equal(h.run('S.tasks.filter(t=>t.dataStatus==="pending").length'),7);
});
