const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('js/app.js');
const section=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
test('beginner setup follows plots, crop cycles and recorded work without requiring stock',()=>{
  const ctx=vm.createContext({S:{plots:[],cycles:[],stock:[],tasks:[]},today:'2026-09-24'});
  const code=section('  const setupSteps = [','  const welcome =');
  const steps=()=>vm.runInContext('(()=>{'+code+'return setupSteps;})()',ctx);
  assert.deepEqual(Array.from(steps(),s=>s.label),['เพิ่มแปลง','เริ่มรอบปลูก','บันทึกงานแรก']);
  assert.equal(steps().filter(s=>s.done).length,0);
  ctx.S.plots.push({id:'p'});ctx.S.cycles.push({id:'c'});ctx.S.tasks.push({status:'planned'});
  assert.equal(steps().filter(s=>s.done).length,2);
  ctx.S.tasks.push({status:'failed'});assert.equal(steps().every(s=>s.done),true);assert.equal(ctx.S.stock.length,0);
  assert.match(steps()[2].action,/status:'done'/);
});
function client(fields={}) {
  let id=0;
  const context=vm.createContext({App:{},document:{getElementById:key=>fields[key] || null,querySelectorAll:()=>[]},
    uid:()=>`ux-${++id}`,S:{plots:[],tasks:[],stock:[],cycles:[],water:{systems:[{id:'pump',lastWatered:'2026-09-10'}],logs:[]}},
    saveState(){},closeModal(){},render(){},toast(){},setTimeout(){},setModalFieldError(input,message){input.error=message;},todayISO:()=> '2026-09-11'});
  return {c:context,run:s=>vm.runInContext(s,context)};
}

test('financial summaries distinguish missing records from explicit zero-cost finance entries',()=>{
  const c=vm.createContext({});vm.runInContext(section('function hasRecordedFinance(', 'function renderHome()'),c);
  const check=rows=>vm.runInContext('hasRecordedFinance('+JSON.stringify(rows)+')',c);
  assert.equal(check([]),false);
  assert.equal(check([{status:'done',type:'inspect',cost:0,revenue:0}]),false);
  assert.equal(check([{status:'planned',type:'expense',cost:100}]),false);
  assert.equal(check([{status:'done',type:'expense',cost:0}]),true);
  assert.equal(check([{status:'done',type:'work',cost:100,revenue:100}]),true);
});
test('home finance labels show the currency and do not use a dollar glyph as the primary summary icon',()=>{
  const home=section('function renderHome()', '/* ---------------- Plots & cycles ---------------- */');
  assert.match(home,/home-money-unit/);
  assert.match(home,/ic\("chart"\)/);
  assert.match(home,/รายได้ \$\{fmtMoney\(fin\.revenue\)\} บาท/);
});
test('activity scope requires an intentional plot choice and reserves whole-farm work for general activities',()=>{
  const form=section('App.modalTask = function', '/* เมื่อเปลี่ยนแปลง -> โหลดเฉพาะพืช');
  const submit=section('App.submitTask = function', '  let savedTaskId =');
  assert.match(form,/บันทึกให้กับ/);
  assert.match(form,/ทั้งฟาร์ม/);
  assert.match(form,/t_scope_plot/);
  assert.match(submit,/เลือกแปลง หรือเลือกงานทั้งฟาร์ม/);
  assert.match(app,/function taskMustBelongToPlot/);
});
test('home prioritizes updating scheduled work and gives a next step after setup is complete',()=>{
  const home=section('function renderHome()', '/* ---------------- Plots & cycles ---------------- */');
  assert.match(home,/อัปเดตงานที่วางไว้/);
  assert.match(home,/App\.openPlannerFilter\('\$\{priorityTaskMode\}'\)/);
  assert.match(home,/ฟาร์มพร้อมเริ่มติดตาม/);
  assert.match(home,/วางแผนงานแรกของ/);
});
test('general work defaults to farm scope while crop work remains attributed to a plot',()=>{
  const form=section('App.modalTask = function', '/* เมื่อเปลี่ยนแปลง -> โหลดเฉพาะพืช');
  assert.match(form,/taskMustBelongToPlot\(type\) \|\| preset\.plotId \? "plot" : "farm"/);
  assert.match(form,/taskScopeChangeButton/);
  assert.match(app,/App\.taskScopeToggle/);
  assert.match(app,/if \(changeButton\) changeButton\.hidden = mustUsePlot/);
});
test('home keeps team review after today work and limits the quick menu to the current workspace',()=>{
  const home=section('function renderHome()', '/* ---------------- Plots & cycles ---------------- */');
  assert.ok(home.indexOf('${todayPanel}') < home.indexOf('id="teamHomeInbox"'));
  const renderSource=section('function render() {', 'App.nav = function');
  assert.match(renderSource,/navKey === "stock" \? \["stock", "sale"\]/);
  assert.match(renderSource,/navKey === "planner" \? \["task"\]/);
  assert.match(renderSource,/button\.hidden = !fabActions\.includes/);
  assert.match(app,/จะแสดงคำสั่งที่เกี่ยวกับหน้าที่กำลังใช้อยู่/);
});
test('sale row totals and grand total update together, including custom price',()=>{
  const fields={saleTotal:{},saleGrandTotal:{},sale_discount:{value:'30'},saleLineTotal_0:{},saleLineTotal_1:{}};
  const {c,run}=client(fields);c.fmtMoney=String;
  const source=read('js/sales.js');
  run(source.slice(source.indexOf('function saleLineTotal('),source.indexOf('function saleLimitInfo(')));
  run(source.slice(source.indexOf('App.saleSum ='),source.indexOf('App.saleRender =')));
  run('let saleItems=[{qty:2,price:290},{qty:3,price:10}]; App.saleSum();');
  assert.equal(fields.saleLineTotal_0.textContent,'580 บาท');assert.equal(fields.saleLineTotal_1.textContent,'30 บาท');assert.equal(fields.saleGrandTotal.value,'580 บาท');
  run('saleItems[0].price=100;App.saleSum();');assert.equal(fields.saleLineTotal_0.textContent,'200 บาท');assert.equal(fields.saleTotal.textContent,'230 บาท');assert.equal(fields.saleGrandTotal.value,'200 บาท');
});
test('quarter-rai plot saves without fabricated GPS; zero coordinates remain valid',()=>{
  const fields=Object.fromEntries(Object.entries({f_name:'Test',f_size:'0.25',f_status:'active',f_lat:'',f_lng:''}).map(([k,value])=>[k,{value}]));
  const {run}=client(fields);run(section('App.submitPlot =','let plotWaterZoneDraft'));
  run('App.submitPlot({preventDefault(){}},"")');
  assert.equal(run('S.plots[0].sizeRai'),.25);assert.equal(run('S.plots[0].lat'),null);assert.equal(run('S.plots[0].lng'),null);
  fields.f_lat.value='0';fields.f_lng.value='0';run('App.submitPlot({preventDefault(){}},"")');assert.equal(run('S.plots[1].lat'),0);
  fields.f_lat.value='91';run('App.submitPlot({preventDefault(){}},"")');assert.equal(run('S.plots.length'),2);assert.ok(fields.f_lat.error);
  fields.f_lat.value='';run('App.submitPlot({preventDefault(){}},"")');assert.equal(run('S.plots.length'),2);
});
test('new plot form keeps optional location behind a clear disclosure',()=>{
  const plotForm=section('App.modalPlot = function', '/* ---- แผนที่ปักหมุด');
  assert.match(plotForm,/เพิ่มตำแหน่งเพื่อดูสภาพอากาศ/);
  assert.match(plotForm,/ไม่บังคับ/);
  assert.match(plotForm,/plotLocationDetails/);
});
test('watering accepts past dates, rejects future/negative inputs, and preserves latest watered date',()=>{
  const fields=Object.fromEntries(Object.entries({wn_date:'2026-09-01',wn_time:'08:30',wn_min:'30',wn_m3:'2',wn_note:'Test'}).map(([k,value])=>[k,{value}]));
  const {run}=client(fields);run(section('function trialValidDate(','function trialDateInRange('));run(section('App.saveWaterNow =','App.delWaterLog ='));
  run('App.saveWaterNow("pump")');assert.equal(run('S.water.logs[0].date'),'2026-09-01');assert.equal(run('S.water.systems[0].lastWatered'),'2026-09-10');
  fields.wn_date.value='2026-09-12';run('App.saveWaterNow("pump")');assert.equal(run('S.water.logs.length'),1);
  fields.wn_date.value='2026-09-11';fields.wn_min.value='-1';run('App.saveWaterNow("pump")');assert.equal(run('S.water.logs.length'),1);
});
test('chemical quantities keep units separate rather than adding bottles to litres',()=>{
  const {c,run}=client();c.localStorage={getItem:()=>null,setItem(){}};run(read('js/data.js'));
  run(`S.plots=[{id:'p',name:'Plot'}];S.tasks=[{status:'done',date:'2026-09-10',plotId:'p',costItems:[{name:'A',category:'chemical',qty:.5,unit:'ขวด',totalCost:20},{name:'A',category:'chemical',qty:2,unit:'ลิตร',totalCost:30}]}]`);
  assert.equal(run('plotChemUse(S,"2026")[0].items.length'),2);assert.equal(run('plotChemUse(S,"2026")[0].cost'),50);
});
test('price recording retains source dates and never re-dates static data as today',async()=>{
  const source=read('worker/src/lark.js');const rows=[];
  const c=vm.createContext({Date,MARKET_DATA:{date:'2026-08-27',products:[{product:'Corn',min:10,max:12,markets:[{market:'Market',price:11}]}]},env:{DB:{prepare(){return {first:async()=>1,bind(...values){return {values,run:async()=>{}};}};},batch:async statements=>rows.push(...statements)}}});
  vm.runInContext(source.slice(source.indexOf('async function doRecordPrices('),source.indexOf('function bkkDateAgo(')),c);
  await vm.runInContext('doRecordPrices(env)',c);assert.equal(rows[0].values[2],'2026-08-27');
});
