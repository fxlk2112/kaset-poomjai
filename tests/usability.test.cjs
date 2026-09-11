const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('js/app.js');
const section=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
function client(fields={}) {
  let id=0;
  const context=vm.createContext({App:{},document:{getElementById:key=>fields[key] || null,querySelectorAll:()=>[]},
    uid:()=>`ux-${++id}`,S:{plots:[],tasks:[],stock:[],cycles:[],water:{systems:[{id:'pump',lastWatered:'2026-09-10'}],logs:[]}},
    saveState(){},closeModal(){},render(){},toast(){},setTimeout(){},setModalFieldError(input,message){input.error=message;},todayISO:()=> '2026-09-11'});
  return {c:context,run:s=>vm.runInContext(s,context)};
}
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
