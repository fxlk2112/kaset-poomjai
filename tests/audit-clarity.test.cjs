const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const app=read('js/app.js');

test('package fields preserve legacy text until a valid complete edit is made',()=>{
  const field=value=>({value,error:'',setCustomValidity(message){this.error=message;},get validity(){return {valid:!this.error};}});
  const fields={s_pack_amount:field(''),s_pack_unit:field(''),s_size:field('legacy custom package'),s_pack_summary:{textContent:''},s_unit:field('ขวด')};
  const c=vm.createContext({App:{},document:{getElementById:id=>fields[id]},unitLabel:u=>u});
  vm.runInContext(app.slice(app.indexOf('App.stockSizeChanged ='),app.indexOf('App.submitStock =')),c);
  assert.equal(fields.s_size.value,'legacy custom package');
  fields.s_pack_amount.value='500';c.App.stockSizeChanged();
  assert.ok(fields.s_pack_unit.error);assert.equal(fields.s_size.value,'legacy custom package');
  fields.s_pack_unit.value='ซีซี';c.App.stockSizeChanged();
  assert.equal(fields.s_size.value,'500 ซีซี');assert.equal(fields.s_pack_summary.textContent,'1 ขวด = 500 ซีซี');
  fields.s_pack_amount.value='0';c.App.stockSizeChanged();assert.ok(fields.s_pack_amount.error);assert.equal(fields.s_size.value,'500 ซีซี');
  fields.s_pack_amount.value='';fields.s_pack_unit.value='';c.App.stockSizeChanged();assert.equal(fields.s_size.value,'');
});

test('uninitialized sync timestamps never appear as a real 1970 sync',()=>{
  const c=vm.createContext({Date});vm.runInContext(app.slice(app.indexOf('function syncTimestampLabel('),app.indexOf('function renderSettings(')),c);
  for(const value of [null,0,1000,NaN,Infinity,'invalid',Date.now()+86400000])assert.equal(c.syncTimestampLabel(value),'ยังไม่มีข้อมูลเวลา');
  assert.match(c.syncTimestampLabel(Date.UTC(2026,8,30,20,0)),/2569/);
  assert.match(c.syncTimestampLabel(Date.UTC(2026,8,30,20,0)),/03:00/);
});

test('uncalculated inventory coverage follows the total into the shop report',()=>{
  assert.match(app,/const stockCoverage = stockPriceCoverage\(S.stock\)/);
  assert.match(app,/stockCoverage.missing \? 'มูลค่าที่คำนวณได้'/);
  assert.match(app,/stockCoverage.missing && !stockCoverage.priced \? 'ยังคำนวณไม่ได้'/);
});

test('inspection distinguishes missing selection, fallow land and missing planting dates',()=>{
  const src=read('js/inspection.js');
  assert.match(src,/innerHTML=!cycleId \?/);
  assert.match(src,/เลือกรอบปลูกเพื่อแสดงอายุพืช ณ วันที่ตรวจ/);
  assert.match(src,/cycleId==='__none__' \?/);
  assert.match(src,/รอบนี้ยังไม่มีวันเริ่มปลูก/);
});

test('calculated cost cannot be edited and shows zero instead of a blank total',()=>{
  assert.match(app,/ci-total cost-calculated-total[^\n]+type="text" readonly/);
  assert.match(app,/querySelector\("\.ci-total"\).value = it.totalCost \?\? 0/);
});

test('measurement inputs stay outside the collapsible date and subplot context',()=>{
  const modal=app.slice(app.indexOf('App.modalTrialObs ='),app.indexOf('App.saveTrialObs ='));
  const contextEnd=modal.indexOf('</details>');
  assert.ok(contextEnd>modal.indexOf('id="tro_unit"'));
  assert.ok(contextEnd<modal.indexOf('id="tro_value"'));
  assert.ok(contextEnd<modal.indexOf('trialSampleFields(tr,obs'));
  assert.match(modal,/tro_date'\)\?\.addEventListener\('change',updateContext\)/);
});
