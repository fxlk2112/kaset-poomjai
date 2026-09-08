const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const section=source.slice(source.indexOf('function trialById('),source.indexOf('function mapLink('));
const copy=x=>JSON.parse(JSON.stringify(x));
function setup() {
  let sequence=0;
  const tr={id:'trial',name:'Trial',plotId:'p',status:'active',trialType:'screening',startDate:'2026-08-01',replications:2,layoutMode:'random',
    metrics:[{id:'m1',name:'Height',unit:'cm'},{id:'m2',name:'Disease',unit:'score'}],
    treatments:[{id:'t1',code:'T1',name:'Control',photos:['photo']},{id:'t2',code:'T2',name:'Test'}],
    units:[{id:'u1',treatmentId:'t1',block:1,order:1},{id:'u2',treatmentId:'t2',block:1,order:2},{id:'u3',treatmentId:'t1',block:2,order:1},{id:'u4',treatmentId:'t2',block:2,order:2}],observations:[]};
  const document={getElementById:()=>null,querySelectorAll:()=>[]};
  const c=vm.createContext({S:{trials:[tr],plots:[{id:'p',name:'Plot'}],tasks:[]},App:{},route:{trialMetricId:'m1'},document,
    uid:()=>`id${++sequence}`,todayISO:()=> '2026-09-07',fmtNum:x=>String(x),dateLabel:x=>x,
    esc:x=>String(x ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    ic:()=>'',taskPhotoUrl:p=>p,plotById:(s,id)=>s.plots.find(p=>p.id===id),render(){},rerender(){},saveState(){},closeModal(){},toast(){},
    window:{scrollTo(){}},setTimeout(){},console});
  vm.runInContext(section,c);
  return {c,tr,run:code=>vm.runInContext(code,c)};
}
function observation(id,unitId,date,value,extra={}) {
  return {id,unitId,date,value,metricId:'m1',metric:'Height',unit:'cm',updatedAt:1,...extra};
}

test('legacy recipe reads both products without mutation and an empty list stays empty',()=>{
  const {tr,run}=setup();
  Object.assign(tr.treatments[0],{activeName:'Old A',activeRate:'20 ml/ไร่',mixName:'Old B',mixRate:'10 g/ไร่'});
  const before=copy(tr);
  assert.deepEqual(copy(run('trialIngredients(S.trials[0].treatments[0])')),[{name:'Old A',rate:'20 ml/ไร่'},{name:'Old B',rate:'10 g/ไร่'}]);
  assert.deepEqual(tr,before);
  tr.treatments[0].ingredients=[];
  assert.equal(run('trialIngredients(S.trials[0].treatments[0]).length'),0);
});

test('recipe editor and area totals include every product and escape names',()=>{
  const {tr,run}=setup();
  tr.treatments[0].ingredients=['One','Two','<Three>','Four'].map(name=>({name,rate:'10 ml/ไร่'}));
  tr.units.forEach(u=>u.areaRai=0.5);
  const editor=run('trialTreatmentRowsHtml(S.trials[0].treatments)');
  assert.equal((editor.match(/data-trt-ingredient>/g)||[]).length,4);
  assert.ok(editor.includes('&lt;Three>')); assert.ok(!editor.includes('สารหลัก'));
  const table=run('trialMixTableHtml(S.trials[0])');
  assert.ok(table.includes('Four')); assert.ok(table.includes('&lt;Three>'));
  assert.equal((table.match(/10 ml<small/g)||[]).length,4);
  assert.ok(run('trialTreatmentRecipe(S.trials[0].treatments[0])').includes('Four'));
});

test('recipe saves all rows, skips blanks, and preserves treatment identity and photos',()=>{
  const {c,tr,run}=setup();
  const values=[[' A ',' 10 ml/ไร่ '],['B',''],['','5 g/ไร่'],['C','2 g/ไร่'],['','']];
  const ingredients=values.map(([name,rate])=>({querySelector:key=>({value:key==='[data-ingredient-name]'?name:rate})}));
  c.document.querySelectorAll=()=>[{dataset:{trtId:'t1'},querySelectorAll:()=>ingredients,querySelector:key=>({value:key==='[data-trt-name]'?'Control':''})}];
  tr.treatments[0].activeName='Legacy';
  const saved=run('trialTreatmentsFromForm(S.trials[0].treatments)[0]');
  assert.equal(saved.id,'t1'); assert.deepEqual(copy(saved.photos),['photo']);
  assert.equal(saved.ingredients.length,4); assert.deepEqual(copy(saved.ingredients[0]),{name:'A',rate:'10 ml/ไร่'});
  assert.equal(saved.activeName,'');
  ingredients.length=0;
  assert.equal(run('trialTreatmentsFromForm(S.trials[0].treatments)[0].ingredients.length'),0);
});

test('trial plan no longer creates activities and retains previously linked activities',()=>{
  const {c,tr,run}=setup();
  run("route.trialSection='plan'");
  c.S.tasks.push({id:'task',trialId:tr.id,trialTreatmentId:'t1',date:'2026-08-01'});
  const before=copy(c.S.tasks);
  const html=run('renderTrialDetail(S.trials[0])');
  assert.ok(!html.includes('สร้างกิจกรรม')); assert.ok(!html.includes('App.createTaskFromTrialTreatment'));
  assert.ok(html.includes('เปิดกิจกรรม')); assert.deepEqual(c.S.tasks,before);
});
test('batch skips blanks, accepts zero and stages without mutating observations',()=>{
  const {tr,run}=setup();
  const changes=run("trialBatchChanges(S.trials[0],'m1','2026-09-07',[{unitId:'u1',value:'0'},{unitId:'u2',value:''},{unitId:'u3',value:'12.5'}])");
  assert.equal(changes.length,2); assert.equal(changes[0].value,0); assert.equal(tr.observations.length,0);
});
test('invalid rows reject an entire batch before mutation',()=>{
  const {tr,run}=setup();
  for(const bad of ["{unitId:'u2',value:'Infinity'}","{unitId:'missing',value:'2'}","{unitId:'u1',value:'2'}"])
    assert.throws(()=>run(`trialBatchChanges(S.trials[0],'m1','2026-09-07',[{unitId:'u1',value:'1'},${bad}])`));
  assert.equal(tr.observations.length,0);
});
test('batch rejects unknown metrics, future and invalid calendar dates',()=>{
  const {run}=setup();
  for(const date of ['2026-09-08','2026-02-30','','invalid']) assert.throws(()=>run(`trialBatchChanges(S.trials[0],'m1','${date}',[])`));
  assert.throws(()=>run("trialBatchChanges(S.trials[0],'gone','2026-09-07',[])"));
});
test('editing the same day preserves identity, notes and photos and is idempotent',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('old','u1','2026-09-07',10,{note:'Keep',photos:['image'],createdAt:123})];
  run("applyTrialBatch(S.trials[0],trialBatchChanges(S.trials[0],'m1','2026-09-07',[{unitId:'u1',value:'11'}]))");
  assert.equal(tr.observations.length,1); assert.equal(tr.observations[0].id,'old'); assert.equal(tr.observations[0].value,11);
  assert.equal(tr.observations[0].note,'Keep'); assert.deepEqual(copy(tr.observations[0].photos),['image']); assert.equal(tr.observations[0].createdAt,123);
  assert.equal(run("trialBatchChanges(S.trials[0],'m1','2026-09-07',[{unitId:'u1',value:'11'}]).length"),0);
});
test('day comparison excludes other dates and chooses the most recently edited duplicate',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('other','u1','2026-09-06',99),observation('a','u1','2026-09-07',10,{updatedAt:20}),observation('b','u1','2026-09-07',12,{updatedAt:10})];
  assert.equal(run("trialDayValues(S.trials[0],'m1','2026-09-07').get('u1').value"),10);
  run("route.trialSection='compare';route.trialDate='2026-09-07'");
  assert.equal(run('trialMeanChartItems(S.trials[0])[0].value'),10);
});
test('comparison defaults to latest measured day, recording defaults to today',()=>{
  const {tr,run}=setup(); tr.observations=[observation('a','u1','2026-09-06',5)];
  run("route.trialSection='compare'"); assert.equal(run('trialMeasurementDate(S.trials[0])'),'2026-09-06');
  run("route.trialSection='record'"); assert.equal(run('trialMeasurementDate(S.trials[0])'),'2026-09-07');
});
test('legacy metric mapping does not change when another metric tab is selected',()=>{
  const {run}=setup(); run("route.trialMetricId='m2'");
  assert.equal(run('trialObsMetricId(S.trials[0],{})'),'m1');
});
test('coverage spans all units and metrics without claiming the trial is complete',()=>{
  const {tr,run}=setup(); tr.observations=[observation('a','u1','2026-09-07',1),observation('b','u2','2026-09-07',2)];
  assert.deepEqual(copy(run('trialCoverage(S.trials[0])')),{total:8,done:2});
  assert.equal(run('trialEffectiveStatus(S.trials[0])'),'active');
});
test('batch never relabels a legacy observation stored in another unit',()=>{
  const {tr,run}=setup(); tr.observations=[observation('a','u1','2026-09-07',1,{unit:'m'})];
  assert.throws(()=>run("trialBatchChanges(S.trials[0],'m1','2026-09-07',[{unitId:'u1',value:'2'}])"));
  assert.equal(tr.observations[0].unit,'m');
});
test('CSV preserves Thai and quotes, and neutralizes spreadsheet formulas',()=>{
  const {tr,run}=setup(); tr.name='=FORMULA'; tr.observations=[observation('a','u1','2026-09-07',12,{note:'Thai, "quoted"\nline'})];
  const csv=run('trialCsv(S.trials[0])');
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes("\"'=FORMULA\"")); assert.ok(csv.includes('"Thai, ""quoted""\nline"'));
});
test('recording workspace hides setup, destructive actions, and empty charts',()=>{
  const {run}=setup(); const html=run('renderTrialDetail(S.trials[0])');
  assert.ok(html.includes('กรอกหลายแปลง')); assert.ok(html.includes('role="tabpanel"'));
  assert.ok(!html.includes('สุ่มผังใหม่')); assert.ok(!html.includes('ลบงานทดลอง')); assert.ok(!html.includes('data-trial-mean'));
});
test('comparison is neutral, shows missing measurements and escapes trial content',()=>{
  const {tr,run}=setup(); tr.name='<script>'; tr.observations=[observation('a','u1','2026-09-07',10)];
  run("route.trialSection='compare'"); const html=run('renderTrialDetail(S.trials[0])');
  assert.ok(html.includes('&lt;script>')); assert.ok(html.includes('ยังขาดค่าวัด 3'));
  assert.ok(!html.includes('ดีที่สุด')); assert.ok(!html.includes('ANOVA')); assert.ok(!html.includes('F='));
});
test('renaming treatment and metric retains stable IDs and treatment photos',()=>{
  const {c,run}=setup();
  const row=(dataset,fields)=>({dataset,querySelectorAll:()=>[],querySelector:key=>({value:fields[key] || ''})});
  c.document.querySelectorAll=selector=>selector==='[data-trt-row]' ? [row({trtId:'t1'},{'[data-trt-code]':'NEW','[data-trt-name]':'Renamed'})] : [row({trmId:'m2'},{'[data-trm-name]':'New metric name','[data-trm-unit]':'score'})];
  assert.equal(run('trialTreatmentsFromForm(S.trials[0].treatments)[0].id'),'t1');
  assert.deepEqual(copy(run('trialTreatmentsFromForm(S.trials[0].treatments)[0].photos')),['photo']);
  assert.equal(run('trialMetricsFromForm(S.trials[0].metrics)[0].id'),'m2');
});
test('trial search and status filters render matching items only',()=>{
  const {c,run}=setup();
  c.S.trials.push({...copy(c.S.trials[0]),id:'closed',name:'Closed',status:'done'});
  run("trialListFilter={status:'done',q:'Closed'}");
  const html=run('renderTrialsTab()'); assert.ok(html.includes('Closed')); assert.ok(!html.includes('>Trial</h2>'));
  run("trialListFilter={status:'all',q:'no match'}"); assert.ok(run('renderTrialsTab()').includes('ไม่พบงานทดลอง'));
});

test('comparison excludes mixed legacy units without silently converting them',()=>{
  const {tr,run}=setup(); tr.observations=[observation('a','u1','2026-09-07',1,{unit:'m'}),observation('b','u3','2026-09-07',110)];
  run("route.trialSection='compare'");
  assert.equal(run('trialMeanChartItems(S.trials[0])[0].value'),110);
  assert.ok(run('trialComparePanel(S.trials[0],"2026-09-07")').includes('หน่วยไม่ตรงกัน'));
});
function formHarness() {
  const h=setup(), fields={tr_name:'Updated',tr_plot:'p',tr_plot_name:'',tr_rep:'2',tr_layout_mode:'random',tr_start:'2026-08-01',tr_end:'',tr_objective:'',tr_type:'screening',tr_crop:'Corn',tr_spray_method:'',tr_water_rate:'',tr_mix_volume:'',tr_note:'',tr_status:'active'};
  h.c.document.getElementById=id=>({value:fields[id] ?? ''});
  h.c.treatments=copy(h.tr.treatments); h.c.metrics=copy(h.tr.metrics);
  h.run('trialWizardValidateStep=()=>true;trialTreatmentsFromForm=()=>treatments;trialMetricsFromForm=()=>metrics;trialWizardSetStep=()=>{};trialWizardFocus=()=>{};');
  return {...h,fields,save:(id='trial')=>h.c.App.saveTrial({preventDefault(){}},id)};
}
test('saving renamed formulas preserves measured units and old observations',()=>{
  const h=formHarness(); h.tr.observations=[observation('a','u1','2026-09-07',10)];
  const units=copy(h.tr.units), observations=copy(h.tr.observations);
  h.c.treatments[0].name='Changed'; h.c.treatments[0].code='A'; h.save();
  assert.equal(h.tr.treatments[0].code,'A'); assert.deepEqual(copy(h.tr.units),units); assert.deepEqual(copy(h.tr.observations),observations);
});
test('save prevents removing a measured metric or changing its unit',()=>{
  for(const change of ['remove','unit']) {
    const h=formHarness(); h.tr.observations=[observation('a','u1','2026-09-07',10)]; const before=copy(h.tr);
    if(change==='remove') h.c.metrics.shift(); else h.c.metrics[0].unit='metres';
    h.save(); assert.deepEqual(copy(h.tr),before);
  }
});
test('save rejects duplicate treatment codes, fractional replications and reversed dates',()=>{
  for(const change of ['codes','reps','dates']) {
    const h=formHarness(), before=copy(h.tr);
    if(change==='codes') h.c.treatments[1].code='T1';
    if(change==='reps') h.fields.tr_rep='1.5';
    if(change==='dates') h.fields.tr_end='2026-07-01';
    h.save(); assert.deepEqual(copy(h.tr),before);
  }
});
test('new trials create the expected units and open recording, not the previous tab',()=>{
  const h=formHarness(); h.c.route.trialSection='plan'; h.c.route.trialDate='2026-01-01';
  h.save(''); const created=h.c.S.trials[1];
  assert.equal(created.units.length,4); assert.equal(new Set(created.units.map(u=>u.id)).size,4);
  assert.equal(h.c.route.trialSection,'record'); assert.equal(h.c.route.trialDate,'');
});
test('legacy replications are inferred from preserved units when the field is missing',()=>{
  const h=formHarness(); delete h.tr.replications; h.tr.observations=[observation('a','u1','2026-09-07',10)];
  const units=copy(h.tr.units); h.save(); assert.equal(h.tr.replications,2); assert.deepEqual(copy(h.tr.units),units);
});

test('overview retains more than twelve dates and keeps treatment means separate',()=>{
  const {tr,run}=setup();
  for(let d=1;d<=20;d++) {
    const date='2026-08-'+String(d).padStart(2,'0');
    tr.observations.push(observation('a'+d,'u1',date,d),observation('b'+d,'u2',date,100+d));
  }
  run("route.trialSection='compare';route.trialDate='2026-08-10'");
  const data=run('trialComparisonData(S.trials[0])');
  assert.equal(data.dates.length,20);assert.equal(data.count,40);
  assert.equal(data.series[0].points[19].value,20);assert.equal(data.series[1].points[19].value,120);
  assert.ok(run('trialComparePanel(S.trials[0])').includes('2026-08-01'));
});

test('timeline gaps remain null, while zero and negative observations remain measured',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('a','u1','2026-08-01',0),observation('b','u2','2026-08-02',-3)];
  const data=run('trialComparisonData(S.trials[0])');
  assert.deepEqual(copy(data.series.map(s=>s.points.map(p=>p.value))),[[0,null],[null,-3]]);
  assert.equal(data.series[0].points[0].sd,null);assert.equal(data.count,2);
});

test('comparison excludes mixed units, malformed values, dates and orphan units without mutation',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('good','u1','2026-08-01',12),
    observation('unit','u2','2026-08-01',2,{unit:'m'}),observation('blank','u3','2026-08-01',' '),
    observation('nan','u4','2026-08-01','NaN'),observation('date','u1','2026-02-30',2),
    observation('future','u1','2026-09-08',2),observation('gone','missing','2026-08-01',2)];
  const before=copy(tr),data=run('trialComparisonData(S.trials[0])');
  assert.equal(data.count,1);assert.equal(data.excluded,6);assert.deepEqual(copy(tr),before);
});

test('latest duplicate is chosen once, even when the latest value must be excluded',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('first','u1','2026-08-01',10,{updatedAt:5}),observation('last','u1','2026-08-01',12,{updatedAt:10})];
  assert.equal(run('trialComparisonData(S.trials[0]).series[0].points[0].value'),12);
  assert.equal(run('trialComparisonData(S.trials[0]).duplicates'),1);
  tr.observations[1].unit='m';
  assert.equal(run('trialComparisonData(S.trials[0]).count'),0);
  assert.equal(tr.observations.length,2);
});

test('metric selection never pools other metrics or unknown explicit metric IDs',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('height','u1','2026-08-01',10),observation('disease','u1','2026-08-01',2,{metricId:'m2',unit:'score'}),observation('unknown','u2','2026-08-01',500,{metricId:'gone'})];
  assert.equal(run('trialComparisonData(S.trials[0]).count'),1);
  run("route.trialMetricId='m2'");
  assert.equal(run('trialComparisonData(S.trials[0]).series[0].points[0].value'),2);
});

test('range is inclusive and independent of the selected snapshot day',()=>{
  const {tr,run}=setup();
  tr.observations=[1,2,3,4].map(d=>observation('a'+d,'u1','2026-08-0'+d,d));
  run("route.trialRangeStart='2026-08-02';route.trialRangeEnd='2026-08-03';route.trialSnapshotDate='2026-08-01'");
  assert.deepEqual(copy(run('trialComparisonData(S.trials[0]).dates')),['2026-08-02','2026-08-03']);
  assert.equal(run('trialSnapshotDate(S.trials[0])'),'2026-08-03');
  run("App.setTrialSnapshotDate('2026-08-02')");
  assert.equal(run('trialComparisonData(S.trials[0]).dates.length'),2);
});

test('range validation is atomic and rejects reversed or impossible dates',()=>{
  const {c}=setup();c.route.trialRangeStart='2026-08-01';
  for(const [start,end] of [['2026-08-05','2026-08-01'],['2026-02-30',''],['','2026-09-08']]) {
    c.App.applyTrialRange({preventDefault(){},target:{elements:{start:{value:start},end:{value:end}}}});
    assert.equal(c.route.trialRangeStart,'2026-08-01');
  }
  c.App.applyTrialRange({preventDefault(){},target:{elements:{start:{value:'2026-08-02'},end:{value:''}}}});
  assert.equal(c.route.trialRangeStart,'2026-08-02');
});

test('paired change compares the same units instead of differences of unrelated daily means',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('a','u1','2026-08-01',10),observation('b','u3','2026-08-01',100),observation('c','u1','2026-08-02',20)];
  const result=run("trialPairedChange(S.trials[0],'t1','2026-08-01','2026-08-02',trialComparisonData(S.trials[0]))");
  assert.deepEqual(copy(result),{n:1,before:10,after:20,change:10});
});

test('paired change reports zero matched units if no units overlap',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('a','u1','2026-08-01',10),observation('b','u3','2026-08-02',20)];
  assert.equal(run("trialPairedChange(S.trials[0],'t1','2026-08-01','2026-08-02',trialComparisonData(S.trials[0])).n"),0);
});

test('treatment visibility updates all comparison views but never hides the last series',()=>{
  const {c,run}=setup();c.route.trialId='trial';
  c.App.toggleTrialSeries('t1',false);assert.equal(run('trialComparisonData(S.trials[0]).series.length'),1);
  c.App.toggleTrialSeries('t2',false);assert.equal(run('trialVisibleTreatments(S.trials[0])[0].id'),'t2');
  c.App.toggleTrialSeries('t1',true);assert.equal(run('trialComparisonData(S.trials[0]).series.length'),2);
});

test('summary CSV covers the selected range and visible treatments, raw CSV preserves everything',()=>{
  const {tr,run}=setup();tr.name='=unsafe';
  tr.observations=[observation('a','u1','2026-08-01',0),observation('b','u2','2026-08-02',5)];
  run("route.trialRangeStart='2026-08-02';route.trialHiddenTreatments=['t1']");
  const summary=run('trialSummaryCsv(S.trials[0])');
  assert.equal(summary.split('\r\n').length,2);assert.ok(summary.includes("\"'=unsafe\""));
  assert.ok(!summary.includes('2026-08-01'));assert.ok(summary.includes('2026-08-02'));
  assert.ok(run('trialCsv(S.trials[0])').includes('2026-08-01'));
});

test('history defaults to all metrics and retains notes, photos and orphan observations',()=>{
  const {tr,run}=setup();
  tr.observations=[observation('a','u1','2026-08-01',1,{note:'Keep note',photos:['photo.jpg']}),observation('b','missing','2026-08-02',5,{metricId:'m2',metric:'Disease',unit:'score'})];
  run("route.trialSection='history'");const html=run('renderTrialDetail(S.trials[0])');
  assert.ok(html.includes('Keep note'));assert.ok(html.includes('photo.jpg'));assert.ok(html.includes('Disease'));
  assert.ok(html.includes('ไม่พบแปลงย่อยเดิม'));assert.ok(html.includes('disabled'));
});

test('opening a measured trial defaults to results, explicit record and empty trials still open entry',()=>{
  const {c,tr}=setup();tr.observations=[observation('a','u1','2026-08-01',1)];
  c.route.trialRangeStart='2020-01-01';c.App.openTrial('trial');
  assert.equal(c.route.trialSection,'compare');assert.equal(c.route.trialRangeStart,'');
  c.App.openTrial('trial','record');assert.equal(c.route.trialSection,'record');
  tr.observations=[];c.App.openTrial('trial');assert.equal(c.route.trialSection,'record');
});

test('four-tab keyboard navigation wraps and supports home/end',()=>{
  const {c}=setup();const press=(section,key)=>c.App.trialTabKey({key,preventDefault(){}},section);
  press('compare','ArrowLeft');assert.equal(c.route.trialSection,'plan');
  press('plan','ArrowRight');assert.equal(c.route.trialSection,'compare');
  press('record','End');assert.equal(c.route.trialSection,'plan');
  press('plan','Home');assert.equal(c.route.trialSection,'compare');
});

test('empty comparison and missing-only day render without NaN or false zeroes',()=>{
  const {tr,run}=setup();run("route.trialSection='compare'");
  assert.ok(run('trialComparePanel(S.trials[0])').includes('ยังไม่มีค่าวัด'));
  tr.observations=[observation('bad','u1','2026-08-01',' ',{unit:'m'})];
  const html=run('trialComparePanel(S.trials[0])');
  assert.ok(!html.includes('NaN'));assert.ok(html.includes('ยังไม่วัด'));
});

test('series chart keeps gaps, all dates and escaped labels with valid coordinates',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../js/charts.js'),'utf8');
  const c=vm.createContext({fmtNum:String});vm.runInContext(code+'\nthis.charts=Charts;',c);
  const dates=['2026-08-01','2026-08-02','2026-08-10','2026-08-15'];
  const el={clientWidth:360,innerHTML:''};
  c.charts.series(el,dates,[{label:'<img onerror=alert(1)>',color:'#123456',expected:2,points:dates.map((date,i)=>({date,value:[-2,0,null,5][i],n:1}))}],{unit:'cm'});
  assert.equal((el.innerHTML.match(/<circle /g)||[]).length,3);
  assert.equal((el.innerHTML.match(/<polyline /g)||[]).length,1);
  assert.ok(el.innerHTML.includes('&lt;img'));assert.ok(!el.innerHTML.includes('<img'));assert.ok(!/NaN|Infinity/.test(el.innerHTML));
});

test('series chart handles a single measured day, empty data and zero-only series',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../js/charts.js'),'utf8');
  const c=vm.createContext({fmtNum:String});vm.runInContext(code+'\nthis.charts=Charts;',c);
  const el={clientWidth:700,innerHTML:''};
  c.charts.series(el,['2026-08-01'],[{label:'T1',color:'#123456',points:[{date:'2026-08-01',value:0,n:1}],expected:1}]);
  assert.ok(el.innerHTML.includes('<circle'));assert.ok(!/NaN|Infinity/.test(el.innerHTML));
  c.charts.series(el,[],[]);assert.equal(el.innerHTML,'');
});

test('negative bars use the full negative half of the axis and keep empty charts safe',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../js/charts.js'),'utf8');
  const c=vm.createContext({fmtNum:String});vm.runInContext(code+'\nthis.charts=Charts;',c);
  const el={innerHTML:''};c.charts.bars(el,[{label:'T1',value:-10},{label:'T2',value:10}]);
  assert.equal((el.innerHTML.match(/height="73.0"/g)||[]).length,2);
  c.charts.bars(el,[]);assert.equal(el.innerHTML,'');
});

test('photo history filter does not remove observations and shows every attached photo',()=>{
  const {tr,run}=setup();tr.observations=[observation('a','u1','2026-08-01',1,{photos:['a','b','c','d','e','f']}),observation('b','u2','2026-08-01',2)];
  run("route.trialPhotosOnly=true");const html=run('trialTimelineHtml(S.trials[0],true)');
  assert.equal((html.match(/class="trial-time-row"/g)||[]).length,1);
  assert.equal((html.match(/alt="รูปค่าวัด"/g)||[]).length,6);
  assert.equal(tr.observations.length,2);
});

test('layout editor groups the 3-treatment 4-replication sample into four ordered blocks',()=>{
  const {c,run}=setup();
  const tr=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/trial-3x4-7.json'),'utf8'));
  tr.units.reverse();c.S.trials=[tr];const before=copy(tr);
  const html=run('trialLayoutEditorHtml(S.trials[0])');
  assert.equal((html.match(/class="trial-layout-block"/g)||[]).length,4);
  assert.equal((html.match(/data-tu-treatment/g)||[]).length,12);
  assert.equal((html.match(/ selected>/g)||[]).length,12);
  for(let block=1;block<=4;block++) for(let order=1;order<=3;order++) assert.ok(html.includes(`ทรีตเมนต์ บล็อก ${block} ตำแหน่ง ${order}`));
  assert.ok(html.indexOf('บล็อก 1 ตำแหน่ง 1')<html.indexOf('บล็อก 1 ตำแหน่ง 2'));
  assert.ok(html.indexOf('layoutBlock_1')<html.indexOf('layoutBlock_2'));
  assert.deepEqual(copy(tr),before);
});

test('layout color preview changes only the unsaved control, not treatment assignments or observations',()=>{
  const {c,tr}=setup();tr.observations=[observation('a','u1','2026-08-01',5)];
  const before=copy(tr);let color;
  c.App.previewTrialLayoutTreatment({value:'t2',closest:()=>({style:{setProperty:(key,value)=>{color=value;}}})},'trial');
  assert.equal(color,'#2563eb');assert.deepEqual(copy(tr),before);
});

test('layout save retains subplot identity, block, order, notes, area and recorded measurements',()=>{
  const {c,tr}=setup();tr.units[0].note='Keep';tr.units[0].areaRai=0.5;
  tr.observations=[observation('a','u1','2026-08-01',5,{photos:['image']})];const before=copy(tr);
  c.document.querySelectorAll=()=>tr.units.map(u=>({dataset:{tu:u.id},querySelector:()=>({value:u.treatmentId})}));
  c.App.saveTrialLayout({preventDefault(){}},'trial');
  assert.deepEqual(copy(tr.units),before.units);assert.deepEqual(copy(tr.observations),before.observations);
});
