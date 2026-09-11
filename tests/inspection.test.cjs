const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('js/app.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function client() {
  const c=vm.createContext({console,localStorage:{getItem(){return null;},setItem(){}},document:{getElementById(){return null;},querySelector(){return null;}},App:{}});
  vm.runInContext(read('js/data.js'),c);
  vm.runInContext(app.slice(app.indexOf('function esc('),app.indexOf('function toast(')),c);
  vm.runInContext(app.slice(app.indexOf('function trialValidDate('),app.indexOf('function trialDateInRange(')),c);
  vm.runInContext(read('js/inspection.js'),c);
  const run=code=>vm.runInContext(code,c);
  run('S.tasks=[]; S.cycles=[{id:"cycle",plotId:"plot",plant:"Corn",startDate:"2026-08-10",status:"active"}]; S.plots=[{id:"plot",name:"Plot"}];');
  return {c,run};
}
test('inspection age uses observed date, allows day zero, and never clamps a pre-plant date to zero',()=>{
  const {run}=client();
  assert.equal(run('inspectionAge(S.cycles[0],"2026-09-10")'),31);
  assert.equal(run('inspectionAge(S.cycles[0],"2026-09-07")'),28);
  assert.equal(run('inspectionAge(S.cycles[0],"2026-08-10")'),0);
  assert.equal(run('inspectionAge(S.cycles[0],"2026-08-09")'),null);
  assert.equal(run('inspectionAge(null,"2026-09-10")'),null);
  assert.equal(run('inspectionAge(S.cycles[0],"2026-02-31")'),null);
});
test('saved inspection age is stable when the cycle is edited, but changing observed date recalculates',()=>{
  const {run}=client();
  run('this.record=inspectionBuild({checks:{},points:[]},S.cycles[0],"2026-09-10","cycle"); S.cycles[0].startDate="2026-08-01";');
  assert.equal(run('inspectionBuild(record,S.cycles[0],"2026-09-10","cycle",record).ageDays'),31);
  assert.equal(run('inspectionBuild(record,S.cycles[0],"2026-09-09","cycle",record).ageDays'),39);
  assert.equal(run('inspectionBuild(record,null,"2026-09-10","cycle",record).ageDays'),31);
});
test('blank checks and numeric measurements stay unknown while explicit zero remains zero',()=>{
  const {run}=client();
  const result=clone(run('inspectionBuild({checks:{},points:[{heightCm:"",pestCount:"0"}]},S.cycles[0],"2026-09-10","cycle")'));
  assert.deepEqual(result.checks,{});assert.equal(result.points[0].heightCm,null);assert.equal(result.points[0].pestCount,0);
});

test('empty-result warning distinguishes unobserved fields from explicit zero and checks',()=>{
  const {run}=client();
  assert.equal(run('inspectionHasResult({checks:{},points:[{label:"Point 1",heightCm:""}],weather:{snapshot:{temperature:29}}})'),false);
  assert.equal(run('inspectionHasResult({checks:{pests:{value:"ไม่พบ"}}})'),true);
  assert.equal(run('inspectionHasResult({points:[{pestCount:0}]})'),true);
  assert.equal(run('inspectionHasResult({weather:{note:"ฝนตก"}})'),true);
});
test('invalid measurements reject the complete draft without changing it',()=>{
  const {run}=client();
  for(const point of [{heightCm:'bad'},{heightCm:-1},{pestCount:1.5},{affectedPlants:6,examinedPlants:5}]) {
    run(`this.draft={checks:{},points:[${JSON.stringify(point)}]};`);
    const before=clone(run('draft'));
    assert.throws(()=>run('inspectionBuild(draft,S.cycles[0],"2026-09-10","cycle")'));
    assert.deepEqual(clone(run('draft')),before);
  }
});
test('previous inspections exclude plans, failures, later dates and other crop cycles',()=>{
  const {run}=client();
  run('S.tasks=[{id:"old",type:"inspect",status:"done",plotId:"plot",cycleId:"cycle",date:"2026-09-04",doneDate:"2026-09-07"},{id:"plan",type:"inspect",status:"planned",plotId:"plot",cycleId:"cycle",date:"2026-09-08"},{id:"fail",type:"inspect",status:"failed",plotId:"plot",cycleId:"cycle",date:"2026-09-08"},{id:"other",type:"inspect",status:"done",plotId:"plot",cycleId:"other",date:"2026-09-08"}];');
  assert.deepEqual(clone(run('inspectionRecords(S,"plot","cycle","2026-09-10").map(t=>t.id)')),['old']);
  assert.equal(run('inspectionRecords(S,"plot","cycle","2026-09-06").length'),0);
});
test('height chart leaves unmeasured dates as gaps and averages only measured points',()=>{
  const {run}=client();
  const result=clone(run('inspectionHeightSeries([{date:"2026-09-01",inspection:{points:[{heightCm:10},{heightCm:20},{heightCm:null}]}},{date:"2026-09-04",inspection:{points:[{heightCm:""}]}},{date:"2026-09-07",inspection:{points:[{heightCm:0}]}}])'));
  assert.deepEqual(result.map(p=>[p.value,p.n]),[[15,2],[null,0],[0,1]]);
});
test('task add/edit round-trips inspection metadata and photos without inventory side effects',()=>{
  const {run}=client();
  run('this.beforeStock=JSON.stringify(S.stock); this.t=addTask(S,{title:"Inspect",type:"inspect",plotId:"plot",cycleId:"cycle",date:"2026-09-10",status:"done",inspection:inspectionBuild({checks:{pests:{value:"พบ",note:"Observed",followUp:true}},points:[{heightCm:20,photos:["photo"]}]},S.cycles[0],"2026-09-10","cycle")});');
  assert.equal(run('JSON.stringify(S.stock)===beforeStock'),true);
  run('updateTask(S,t.id,{note:"Updated"},"keep");');
  assert.equal(run('t.inspection.ageDays'),31);assert.equal(run('t.inspection.points[0].photos[0]'),'photo');
  assert.equal(run('t.inspection.checks.pests.followUp'),true);
});
test('completing a planned inspection opens the inspection template rather than requiring photo evidence',()=>{
  const {c,run}=client();
  run('App.modalTask=(_date,p)=>{this.preset=p;};');
  run('S.tasks=[{id:"i",type:"inspect",status:"planned"}];');
  const start=app.indexOf('App.modalTaskComplete =');
  vm.runInContext(app.slice(start,app.indexOf('\n};',start)+3),c);
  run('App.modalTaskComplete("i",true)');
  assert.equal(c.preset.taskId,'i');assert.equal(c.preset.inspectionCompletion,true);
});

test('planned observations are not frozen as completed snapshots and draft edits do not mutate saved data',()=>{
  const {c,run}=client();c.ic=()=>'';
  run('this.task={status:"planned",inspection:{observedDate:"2026-09-10",cycleId:"cycle",ageDays:4,checks:{},points:[]}};Inspection.begin(task);Inspection.check("growth","value","ปกติ");');
  assert.equal(run('Inspection.original'),null);
  assert.equal(run('task.inspection.checks.growth'),undefined);
  assert.equal(run('Inspection.collect("cycle","2026-09-10").ageDays'),31);
});

test('point photos block save while uploading and remain attached to their original point',async()=>{
  const {c,run}=client();c.ic=()=>'';
  let resolvePhoto;c.readTaskPhotoFile=()=>new Promise(resolve=>{resolvePhoto=resolve;});
  run('Inspection.begin(null);Inspection.pointsRender=()=>{};Inspection.addPoint();');
  const pending=run('Inspection.photos({files:[{}]},0)');
  assert.throws(()=>run('Inspection.collect("cycle","2026-09-10")'),/รอเพิ่มรูป/);
  resolvePhoto('data:image/png;base64,test');await pending;
  assert.equal(run('Inspection.pending'),0);
  assert.equal(run('Inspection.collect("cycle","2026-09-10").points[0].photos.length'),1);
});

test('inspection report retains symptom-only notes and does not call planned data a completed result',()=>{
  const {run}=client();
  const html=run('inspectionDetailHtml({type:"inspect",status:"planned",cycleId:"cycle",date:"2026-09-10",inspection:{ageDays:31,checks:{},points:[{label:"A",target:"ใบเหลือง"}]}})');
  assert.match(html,/ใบเหลือง/);assert.match(html,/ข้อมูลเตรียมตรวจแปลง/);assert.doesNotMatch(html,/ณ วันที่ตรวจ/);
});

test('chart date labels are unique and remain inside the viewport for short intervals',()=>{
  const {c,run}=client();vm.runInContext(read('js/charts.js'),c);
  run('this.mount={clientWidth:360,clientHeight:240};Charts.series(mount,["2026-09-07","2026-09-08"],[{label:"Height",color:"green",points:[{date:"2026-09-07",value:10,n:1},{date:"2026-09-08",value:20,n:1}]}],{sampleLabel:"points"});');
  assert.equal((c.mount.innerHTML.match(/>08\/09\/26</g)||[]).length,1);
  assert.equal((c.mount.innerHTML.match(/>07\/09\/26</g)||[]).length,1);
  assert.match(c.mount.innerHTML,/x="328"[^>]*>08\/09\/26</);
});

test('insect rates group by named species and inspected plants, not raw totals or point averages',()=>{
  const {run}=client();
  run('this.records=[{date:"2026-09-01",inspection:{points:[{pestName:"A",pestCount:10,examinedPlants:10},{pestName:" a ",pestCount:0,examinedPlants:90},{pestName:"B",pestCount:900,examinedPlants:10},{target:"A",pestCount:99,examinedPlants:10}]}},{date:"2026-09-04",inspection:{points:[{pestName:"a",pestCount:0,examinedPlants:10}]}}];');
  assert.deepEqual(clone(run('inspectionMetricSeries(records,"pests","a").map(p=>[p.value,p.n,p.total,p.examined])')),[[1,2,10,100],[0,1,0,10]]);
  assert.deepEqual(clone(run('inspectionMetricSubjects(records,"pests")')),['a','b']);
});

test('symptom percentages use weighted denominators and leave invalid or unmeasured dates as gaps',()=>{
  const {run}=client();
  run('this.records=[{date:"2026-09-01",inspection:{points:[{symptomName:"yellow",affectedPlants:5,examinedPlants:10},{symptomName:"yellow",affectedPlants:0,examinedPlants:90}]}},{date:"2026-09-04",inspection:{points:[{symptomName:"yellow",affectedPlants:0,examinedPlants:0},{symptomName:"yellow",affectedPlants:5,examinedPlants:2},{symptomName:"yellow",affectedPlants:null,examinedPlants:10}]}},{date:"2026-09-07",inspection:{points:[{symptomName:"yellow",affectedPlants:0,examinedPlants:10}]}}];');
  assert.deepEqual(clone(run('inspectionMetricSeries(records,"affected","yellow").map(p=>[p.value,p.n])')),[[5,2],[null,0],[0,1]]);
});

function seedIssue(run) {
  run('S.tasks=[{id:"source",type:"inspect",status:"done",plotId:"plot",cycleId:"cycle",date:"2026-09-01",inspection:{checks:{pests:{value:"พบ",followUp:true,note:"A"}},points:[]}},{id:"close",type:"inspect",status:"done",plotId:"plot",cycleId:"cycle",date:"2026-09-07",inspection:{checks:{},resolutions:[{taskId:"source",key:"pests",note:"A"}]}}];');
}

test('followups close only through completed records in the same plot and cycle, at or after discovery',()=>{
  const {run}=client();seedIssue(run);
  assert.equal(run('inspectionIssues(S,"plot","cycle","2026-09-10")[0].resolvedDate'),'2026-09-07');
  assert.equal(run('inspectionIssues(S,"plot","cycle","2026-09-04")[0].resolvedDate'),null);
  for(const change of ['status="planned"','status="failed"','cycleId="other"','plotId="other"','date="2026-08-01"']) {
    seedIssue(run);run('S.tasks[1].'+change);
    assert.equal(run('inspectionIssues(S,"plot","cycle","2026-09-10")[0].resolvedDate'),null);
  }
});

test('removing or editing a resolution reopens the source issue without rewriting its original observation',()=>{
  const {run}=client();seedIssue(run);
  run('this.original=JSON.stringify(S.tasks[0]);S.tasks[1].inspection.resolutions=[];');
  assert.equal(run('inspectionIssues(S,"plot","cycle")[0].resolvedDate'),null);
  assert.equal(run('JSON.stringify(S.tasks[0])===original'),true);
  seedIssue(run);
  assert.equal(run('inspectionIssues(S,"plot","cycle","2026-09-10","close")[0].resolvedDate'),null);
});

test('saving after changing the cycle or backdating cannot close unrelated or future issues',()=>{
  const {c,run}=client();c.ic=()=>'';seedIssue(run);
  run('Inspection.begin(S.tasks[1]);Inspection.context={plotId:"plot"};');
  assert.equal(run('Inspection.collect("cycle","2026-09-10").resolutions.length'),1);
  assert.equal(run('Inspection.collect("other","2026-09-10").resolutions.length'),0);
  assert.equal(run('Inspection.collect("cycle","2026-08-01").resolutions.length'),0);
});

test('account normalization and serialized offline state retain inspection metrics and issue references',()=>{
  const {c,run}=client();seedIssue(run);
  const auth=read('js/auth.js'),start=auth.indexOf('function normalizedAccountState(');
  run('let SEED_SNAPSHOT=null;');
  vm.runInContext(auth.slice(auth.indexOf('function blankState('),start),c);
  vm.runInContext(auth.slice(start,auth.indexOf('\n}',start)+2),c);
  run('S.tasks[0].inspection.points=[{pestName:"A",pestCount:3,symptomName:"yellow",affectedPlants:2,examinedPlants:10}];this.restored=normalizedAccountState(JSON.parse(JSON.stringify(S)));');
  assert.equal(run('restored.tasks[0].inspection.points[0].examinedPlants'),10);
  assert.equal(run('inspectionIssues(restored,"plot","cycle")[0].resolvedDate'),'2026-09-07');
});

test('percentage chart bounds stay within zero and one hundred',()=>{
  const {c,run}=client();vm.runInContext(read('js/charts.js'),c);
  run('this.mount={clientWidth:360,clientHeight:240};Charts.series(mount,["2026-09-07","2026-09-10"],[{label:"Rate",color:"green",points:[{date:"2026-09-07",value:0,n:1},{date:"2026-09-10",value:100,n:1}]}],{minValue:0,maxValue:100,sampleLabel:"points"});');
  const labels=[...c.mount.innerHTML.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map(m=>Number(m[1]));
  assert.deepEqual(labels,[0,25,50,75,100]);
});

test('inspection axis labels use only recorded dates, preserve gaps and show Buddhist years',()=>{
  const {c,run}=client();vm.runInContext(read('js/charts.js'),c);
  const dates=['2026-08-23','2026-08-26','2026-08-29','2026-09-01','2026-09-04','2026-09-05','2026-09-07','2026-09-10'];
  c.dates=dates;
  for(const width of [292,362,632,1100]) {
    c.width=width;
    run('this.mount={clientWidth:width,clientHeight:260};Charts.series(mount,dates,[{label:"Height",color:"green",points:dates.map((date,i)=>({date,value:i===5?null:22+i*4,n:10}))}],{recordDateTicks:true,dateLabel:d=>d.slice(8)+"/"+d.slice(5,7)+"/"+String(Number(d.slice(0,4))+543).slice(-2)});');
    const labels=[...c.mount.innerHTML.matchAll(/text-anchor="middle"[^>]*>([^<]+)</g)].map(m=>m[1]);
    const allowed=dates.map(d=>d.slice(8)+'/'+d.slice(5,7)+'/69');
    assert.ok(labels.every(label=>allowed.includes(label)));
    assert.equal(labels[0],'23/08/69');assert.equal(labels.at(-1),'10/09/69');
    assert.ok(!labels.includes('06/09/69'));assert.ok(!labels.includes('28/08/69'));
    assert.equal((c.mount.innerHTML.match(/<circle /g)||[]).length,7);
    assert.equal((c.mount.innerHTML.match(/<polyline /g)||[]).length,2);
    const positions=[...c.mount.innerHTML.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="middle"/g)].map(m=>Number(m[1]));
    assert.ok(positions.slice(1).every((x,i)=>x-positions[i]>=64));
  }
});

test('record-date axis supports a single observation without duplicate ticks',()=>{
  const {c,run}=client();vm.runInContext(read('js/charts.js'),c);
  run('this.mount={clientWidth:292,clientHeight:260};Charts.series(mount,["2026-09-07"],[{label:"Height",color:"green",points:[{date:"2026-09-07",value:0,n:1}]}],{recordDateTicks:true});');
  assert.equal((c.mount.innerHTML.match(/text-anchor="middle"/g)||[]).length,1);
  assert.doesNotMatch(c.mount.innerHTML,/NaN|Infinity/);
});

test('optional missing-data bridge joins measured endpoints without fabricated dots or extrapolation',()=>{
  const {c,run}=client();vm.runInContext(read('js/charts.js'),c);
  for(const enabled of [true,false]) {
    run(`this.mount={clientWidth:632,clientHeight:260};Charts.series(mount,["2026-09-01","2026-09-04","2026-09-05","2026-09-06","2026-09-07","2026-09-10"],[{label:"Height",color:"green",points:[{date:"2026-09-01",value:null},{date:"2026-09-04",value:0,n:10},{date:"2026-09-05",value:null},{date:"2026-09-06",value:null},{date:"2026-09-07",value:44,n:10},{date:"2026-09-10",value:null}]}],{connectMissing:${enabled}});`);
    assert.equal((c.mount.innerHTML.match(/<circle /g)||[]).length,2);
    assert.equal((c.mount.innerHTML.match(/stroke-dasharray="4 5"/g)||[]).length,enabled?1:0);
    assert.doesNotMatch(c.mount.innerHTML,/NaN|Infinity/);
  }
});

test('missing-value note names dates without interpreting zero as missing',()=>{
  const {c,run}=client();c.dateLabel=d=>d;
  const html=run('inspectionMissingNoteHtml([{date:"2026-09-04",value:0},{date:"2026-09-05",value:null},{date:"2026-09-07",value:44}])');
  assert.match(html,/2026-09-05/);assert.match(html,/เส้นประ/);assert.doesNotMatch(html,/2026-09-04/);
  assert.equal(run('inspectionMissingNoteHtml([{date:"2026-09-04",value:0}])'),'');
  assert.doesNotMatch(run('inspectionMissingNoteHtml([{date:"2026-09-04",value:null},{date:"2026-09-07",value:44}])'),/เส้นประ/);
});

test('readable pest summary separates insect counts, inspected plants and average',()=>{
  const {c,run}=client();c.dateLabel=x=>x;
  const html=run('inspectionMetricSummaryHtml([{date:"2026-09-10",value:1,total:20,examined:200,n:10}],"pests","เพลี้ย")');
  assert.match(html,/พบแมลง 20 ตัว จากต้นที่ตรวจ 200 ต้น/);
  assert.match(html,/<strong>1<\/strong>/);
  assert.match(html,/20 ÷ 200 × 10 = 1/);
  assert.match(html,/ไม่ใช่จำนวนต้นที่พบแมลง/);
});

test('latest measured summary keeps explicit zero and labels its date when later records are unmeasured',()=>{
  const {c,run}=client();c.dateLabel=x=>x;
  const html=run('inspectionMetricSummaryHtml([{date:"2026-09-10",value:null,n:0},{date:"2026-09-07",value:0,total:0,examined:20,n:1}],"pests","<test>")');
  assert.match(html,/2026-09-07/);assert.doesNotMatch(html,/2026-09-10/);
  assert.match(html,/<strong>0<\/strong>/);assert.match(html,/&lt;test&gt;/);
  assert.equal(run('inspectionMetricSummaryHtml([{date:"2026-09-10",value:null,n:0}],"pests","")'),'');
});

test('daily table spells out the numerator and denominator and preserves missing measurements',()=>{
  const {c,run}=client();c.dateLabel=x=>x;
  const html=run('inspectionMetricTableHtml([{date:"2026-09-07",value:null,n:0},{date:"2026-09-10",value:4.5,total:9,examined:200,n:10}],"affected")');
  assert.match(html,/มีอาการ 9 ต้น/);assert.match(html,/ตรวจ 200 ต้น · 10 จุด/);
  assert.match(html,/ยังไม่มีค่าวัด/);assert.match(html,/>4.5</);
  assert.doesNotMatch(html,/9 \/ 200/);
});
