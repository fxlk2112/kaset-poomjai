const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const source = app.slice(app.indexOf('function materialRateFromArea('),app.indexOf('function taskRowHtml('));
const data = fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8');
const unitSource = data.slice(data.indexOf('const VOLUME_UNITS ='),data.indexOf('function stockImportKey('));
function render(task,compact=false) {
  const c=vm.createContext({task,compact,S:{},plotById:()=>({sizeRai:4}),stockById:()=>({name:'Current catalog name',unit:'ขวด'}),fmtNum:String,
    unitLabel:u=>['ml','มล','ซีซี'].includes(u)?'ซีซี (มล.)':u,
    esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
  vm.runInContext(unitSource + source,c);
  return vm.runInContext('taskMaterialsHtml(task,compact)',c);
}

test('compact cards show two products while details preserve every product',()=>{
  const task={status:'done',type:'spray',materialAreaRai:4,costItems:Array.from({length:6},(_,i)=>({name:'Product '+i,category:'chemical',qty:200,unit:'ml'}))};
  const compact=render(task,true),full=render(task);
  assert.equal((compact.match(/class="task-material-brief"/g)||[]).length,2);
  assert.match(compact,/อีก 4 รายการ/);
  assert.equal((full.match(/class="task-material-name"/g)||[]).length,6);
  assert.match(compact,/50 ซีซี/);
});

test('saved sack content becomes kilograms and kg per rai, never sacks per rai',()=>{
  const html=render({status:'done',type:'fertilize',materialAreaRai:10,costItems:[{name:'Fertilizer',stockId:'a',qty:1.5,unit:'กระสอบ',packageSize:'50 กก.'}]},true);
  assert.match(html,/75/);assert.match(html,/7.5/);assert.doesNotMatch(html,/กระสอบ/);
});
test('activity shows all recorded products, actual cc and rate separately from bottle quantity',()=>{
  const html=render({status:'done',type:'spray',costItems:[
    {stockId:'a',name:'Product A',qty:.1,unit:'ขวด',usageQty:50,usageUnit:'ซีซี',rate:'25 ซีซี/ไร่'},
    {name:'External B',category:'chemical',qty:20,unit:'กรัม',rate:'10 กรัม/ไร่'},
    {name:'Labor',category:'labor',qty:1,unit:'คน'}]});
  assert.match(html,/Product A/);assert.match(html,/External B/);assert.doesNotMatch(html,/Labor|0.1 ขวด|Current catalog name/);
  assert.match(html,/ใช้จริง/);assert.match(html,/50 ซีซี \(มล\.\)/);assert.match(html,/25 ซีซี\/ไร่/);
});
test('approved collector products are merged once and retain reported rates and external items',()=>{
  const html=render({status:'done',costItems:[{stockId:'a',name:'A',qty:.1,unit:'ขวด',usageQty:50,usageUnit:'ml'}],
    reportedMaterials:[{stockId:'a',name:'A',rate:'20 ซีซี/น้ำ 20 ลิตร'},{name:'External',qty:10,unit:'กรัม'}]});
  assert.equal((html.match(/class="task-material-name"/g)||[]).length,2);
  assert.match(html,/20 ซีซี\/น้ำ 20 ลิตร/);assert.match(html,/External/);
});
test('missing rates are explicit, historical names are escaped and planned quantities are not actual usage',()=>{
  const html=render({status:'planned',type:'spray',costItems:[{stockId:'a',name:'<script>bad</script>',qty:2,unit:'ขวด'}]});
  assert.match(html,/ปริมาณที่วางไว้/);assert.doesNotMatch(html,/ใช้จริง|<script>/);
  assert.match(html,/ยังคำนวณต่อไร่ไม่ได้/);assert.match(html,/&lt;script>/);
  assert.match(render({status:'failed',reportedMaterials:[{name:'A',qty:50,unit:'ซีซี'}]}),/ปริมาณที่ระบุ/);
});
test('owner input rate is saved and per-area calculator fills the rate field',()=>{
  assert.match(app,/rate: String\(it.rate \|\| ""\)\.trim\(\)\.slice\(0, 240\)/);
  assert.match(app,/class="ci-usage-rate"/);
  assert.match(app,/rateInput\) rateInput.value = it.rate/);
});
test('total cc divided by saved treated area is automatic and independent of current plot size',()=>{
  const html=render({status:'done',plotId:'p',materialAreaRai:2,costItems:[{name:'A',category:'chemical',usageQty:200,usageUnit:'ซีซี',rate:'20 ซีซี/น้ำ 20 ลิตร'}]});
  assert.match(html,/100 ซีซี \(มล\.\)\/ไร่/);
  assert.match(html,/พื้นที่ที่บันทึก 2 ไร่/);
  assert.match(html,/20 ซีซี\/น้ำ 20 ลิตร/);
  assert.doesNotMatch(html,/ประมาณ|ไม่ได้ระบุ/);
});
test('old records use current plot area only as an explicitly labelled estimate',()=>{
  const task={status:'done',plotId:'p',costItems:[{name:'A',category:'chemical',qty:1,unit:'ลิตร'}]};
  assert.match(render(task),/250 ซีซี \(มล\.\)\/ไร่/);
  assert.match(render(task),/จากขนาดแปลงปัจจุบัน 4 ไร่/);
  assert.match(render(task),/ประมาณ/);
  assert.doesNotMatch(render({...task,materialAreaRai:null}),/250 ซีซี/);
  assert.doesNotMatch(render({...task,plotId:null}),/เฉลี่ยต่อไร่/);
});
test('saved package size and mass units work; unknown packages and invalid areas do not fabricate rates',()=>{
  const task={status:'done',materialAreaRai:2,costItems:[{name:'A',category:'chemical',qty:.2,unit:'ขวด',packageSize:'500 ml'}]};
  assert.match(render(task),/50 ซีซี \(มล\.\)\/ไร่/);
  assert.doesNotMatch(render({...task,materialAreaRai:0}),/เฉลี่ยต่อไร่/);
  assert.doesNotMatch(render({...task,costItems:[{...task.costItems[0],packageSize:''}]}),/เฉลี่ยต่อไร่/);
  assert.match(render({...task,costItems:[{name:'B',category:'fertilizer',qty:500,unit:'กรัม'}]}),/0.25 กก\/ไร่/);
});
