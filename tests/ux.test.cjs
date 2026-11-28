const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const method = name => { const start = app.indexOf('App.' + name + ' ='); return app.slice(start, app.indexOf('\n};', start) + 3); };
const copy = x => JSON.parse(JSON.stringify(x));

test('invalid controls inside folded groups are revealed and focused, not their fieldsets',()=>{
  let focused=false, scrolled=false, errorTarget;
  const form={querySelector(selector){assert.equal(selector,'input:invalid, select:invalid, textarea:invalid');return input;}};
  const details={tagName:'DETAILS',open:false,parentElement:form};
  const input={parentElement:details,closest:()=>null,scrollIntoView(){scrolled=true;},focus(){focused=true;}};
  const c=vm.createContext({setModalFieldError(el){errorTarget=el;},modalValidationMessage:()=> 'Invalid count',setTimeout:fn=>fn()});
  vm.runInContext(section('function focusModalInvalidField(', 'function installModalValidation('),c);
  c.focusModalInvalidField(form);
  assert.equal(details.open,true);assert.equal(errorTarget,input);assert.equal(focused,true);assert.equal(scrolled,true);
});

function prices(response) {
  let calls = 0;
  const c = vm.createContext({App:{},todayISO:()=> '2026-09-08',daysBetween:(a,b)=>(new Date(b)-new Date(a))/86400000,fmtNum:String,render(){},authCall:async()=>{calls++;return response;}});
  vm.runInContext(section('function marketPriceFreshness(', 'function renderPrices(') + method('loadMarketPrices'), c);
  return {c, calls:()=>calls, run:code=>vm.runInContext(code,c)};
}
test('missing and invalid price dates are never labeled today',()=>{
  const {run} = prices({});
  for (const date of [undefined, '', 'invalid']) {
    const result=run(`marketPriceFreshness(${JSON.stringify({date})})`);
    assert.equal(result.age,null);assert.equal(result.date,'');
    assert.equal(result.label,'ไม่ทราบวันที่ข้อมูล');
  }
  assert.equal(run('marketPriceFreshness({date:"2026-09-08"}).age'),0);
  assert.equal(run('marketPriceFreshness({date:"2026-08-27"}).age'),12);
  assert.equal(run('marketPriceFreshness({date:"2026-09-09"}).label'),'วันที่ข้อมูลอยู่ในอนาคต');
});
test('malformed price payload fails without replacing previous data',async()=>{
  const {c,calls}=prices({ok:true,data:{}});
  const cached={date:'2026-08-27',products:[]};c.App._marketPrices=cached;
  await c.App.loadMarketPrices();
  assert.equal(c.App._marketPrices,cached);assert.ok(c.App._priceError);
  assert.equal(c.App._priceLoading,false);assert.equal(c.App._priceAttempted,true);assert.equal(calls(),1);
});
test('price requests deduplicate and accept an explicitly empty product list',async()=>{
  const {c,calls}=prices({ok:true,data:{date:'2026-09-08',products:[]}});
  await Promise.all([c.App.loadMarketPrices(),c.App.loadMarketPrices()]);
  assert.equal(calls(),1);assert.equal(c.App._priceError,'');assert.deepEqual(copy(c.App._marketPrices.products),[]);
});
test('calendar mode restores a selection within the displayed month',()=>{
  const c=vm.createContext({App:{},cal:{y:2024,m:1,sel:null},todayISO:()=> '2026-09-08',rerender(){}});
  vm.runInContext(method('plannerView'),c);c.App.plannerView(true);
  assert.equal(c.cal.sel,'2024-02-01');c.App.plannerView(false);assert.equal(c.cal.sel,'2024-02-01');
});
function equipment() {
  const values={e_name:'Updated pump',e_type:'Legacy type',e_date:'2025-01-01',e_cost:'20000',e_life:'6'};
  const original={id:'eq',name:'Pump',type:'Legacy type',cost:10000,lifespan:5,purchaseDate:'2024-01-01',maintenance:[{id:'repair',cost:500}],custom:'preserve'};
  let saves=0,closes=0;
  const c=vm.createContext({App:{},S:{equipment:[original]},document:{getElementById:id=>({value:values[id]})},todayISO:()=> '2026-09-08',trialValidDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d),uid:()=> 'new',saveState(){saves++;},closeModal(){closes++;},render(){},toast(){}});
  vm.runInContext(method('submitEquipment'),c);
  return {c,values,original,saves:()=>saves,closes:()=>closes};
}
test('equipment edits preserve identity, maintenance and custom fields',()=>{
  const {c,original,saves,closes}=equipment();const history=original.maintenance;
  c.App.submitEquipment({preventDefault(){}},'eq');
  assert.equal(c.S.equipment.length,1);assert.equal(c.S.equipment[0],original);
  assert.equal(original.name,'Updated pump');assert.equal(original.cost,20000);
  assert.equal(original.maintenance,history);assert.equal(original.custom,'preserve');
  assert.equal(saves(),1);assert.equal(closes(),1);
});
test('equipment rejects invalid cost and lifespan without changing stored data',()=>{
  for(const [key,value] of [['e_cost',''],['e_cost','bad'],['e_cost','-1'],['e_life','1.5'],['e_date','2027-01-01']]) {
    const {c,values,original,saves}=equipment();const before=copy(original);values[key]=value;
    c.App.submitEquipment({preventDefault(){}},'eq');assert.deepEqual(original,before);assert.equal(saves(),0);
  }
});
test('clean modal close bypasses the discard prompt, dirty close does not',()=>{
  let closes=0,prompts=0;
  const modal={dataset:{},children:[],querySelector:()=>null,appendChild(){prompts++;}};
  const c=vm.createContext({App:{},document:{querySelector:()=>modal,createElement:()=>({setAttribute(){},addEventListener(){},querySelector:()=>({focus(){}})})},closeModal(){closes++;}});
  vm.runInContext(section('function modalHasUnsavedChanges()', 'App.keepEditing ='),c);
  c.App.closeModal();assert.equal(closes,1);assert.equal(prompts,0);
  modal.dataset.dirty='true';c.App.closeModal();assert.equal(closes,1);assert.equal(prompts,1);
});
