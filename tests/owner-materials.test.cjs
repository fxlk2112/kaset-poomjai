const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
function client() {
  const c = vm.createContext({ console, setTimeout() {}, localStorage: { getItem: () => null, setItem() {} }, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] }, toast() {} });
  const run = s => vm.runInContext(s, c);
  run(read('js/data.js'));
  run(`Object.assign(S, {tasks:[],sales:[],stock:[
    {id:'a',name:'Product A',unit:'ขวด',size:'500 cc',avgCost:120,qty:10,openQty:0},
    {id:'b',name:'Product B',unit:'ถุง',size:'1 kg',avgCost:300,qty:10,openQty:0}
  ]});`);
  const app = read('js/app.js');
  run(app.slice(app.indexOf('let taskCostItems ='), app.indexOf('/* อัปเดตยอดรวมต้นทุนทั้งหมด */')));
  run(app.slice(app.indexOf('function costOpenedAmount('), app.indexOf('App.taskScopeChange =')));
  run('function esc(s){return String(s ?? "");}');
  run('App.costRender = function() {}; App.costSum = function() {}; taskCostItems=[{stockMode:"package"}];');
  return { c, run };
}

test('unknown stock price is not free; zero must be explicitly entered', () => {
  const {run}=client();
  assert.equal(run('costPriceMissing({stockId:"a",unitCost:0})'),true);
  for(const price of [null,undefined,'', ' ', -1, 'not a price']) {
    assert.equal(run(`costPriceMissing({stockId:"a",priceMode:"custom",unitCost:${JSON.stringify(price) || 'undefined'}})`),true);
  }
  assert.equal(run('costPriceMissing({stockId:"a",priceMode:"custom",unitCost:0})'),false);
  assert.equal(run('costPriceMissing({stockId:"a",unitCost:120})'),false);
});

test('explicit zero cost remains explicit after saving and reopening', () => {
  const {run}=client();
  const app=read('js/app.js');
  const start=app.indexOf('  const costItems = (useCost ? taskCostItems : [])');
  const end=app.indexOf('  /* ตรวจจำนวนกับสต็อกก่อนบันทึก',start);
  run('const useCost=true; taskCostItems=[{stockId:"a",name:"Free sample",qty:.1,unit:"ขวด",usageQty:50,usageUnit:"ซีซี",unitCost:0,priceMode:"custom"}];');
  run(app.slice(start,end));
  assert.equal(run('costItems[0].priceMode'),'custom');
  assert.equal(run('costPriceMissing(costItems[0])'),false);
  run('var saved=addTask(S,{status:"done",costItems});');
  assert.equal(run('costPriceMissing(saved.costItems[0])'),false);
});

test('stock picker collapses on selection and product changes replace the linked name', () => {
  const {run}=client();
  run('App.costShowStock(0); App.costSet(0,"stockId","a");');
  assert.equal(run('taskCostItems[0].showStockPicker'),false);
  assert.equal(run('taskCostItems[0].name'),'Product A');
  run('App.costShowStock(0); App.costSet(0,"stockId","b");');
  assert.equal(run('taskCostItems[0].showStockPicker'),false);
  assert.equal(run('taskCostItems[0].name'),'Product B');
});

test('50 cc keeps whole bottles untouched when using opened stock', () => {
  const {run}=client();
  run('S.stock[0].openQty=.5; S.stock[0].avgCost=380; App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",50); taskCostItems[0].stockMode="open";');
  assert.equal(run('costTotal(taskCostItems[0])'),38);
  run('addTask(S,{status:"done",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('S.stock[0].qty'),10);
  assert.equal(run('S.stock[0].openQty'),.4);
});

test('chemical reports show measured usage instead of bottle fractions', () => {
  const {run}=client();
  run('S.tasks=[{plotId:"p",date:"2026-10-01",status:"done",costItems:[{category:"chemical",name:"A",stockId:"a",qty:.1,unit:"ขวด",usageUnit:"ซีซี",usageQty:50,totalCost:38}]}];');
  assert.equal(run('plotChemUse(S,"2026")[0].items[0].qty'),50);
  assert.equal(run('plotChemUse(S,"2026")[0].items[0].unit'),'ซีซี');
  assert.equal(run('plotChemUse(S,"2026")[0].cost'),38);
});

test('external package price uses actual volume, persists cents and never changes stock', () => {
  const {run} = client();
  run('taskCostItems=[{name:"External",category:"chemical",unit:"ซีซี",externalPriceMode:"package",externalPackQty:500,externalPackPrice:300,stockMode:"package"}]; App.costSet(0,"qty",50);');
  assert.equal(run('taskCostItems[0].totalCost'),30);
  assert.equal(run('taskCostItems[0].unitCost'),.6);
  run('const before=JSON.stringify(S.stock); const task=addTask(S,{type:"spray",status:"planned",costItems:JSON.parse(JSON.stringify(taskCostItems))}); updateTask(S,task.id,{status:"done"});');
  assert.equal(run('task.cost'),30);
  assert.equal(run('JSON.stringify(S.stock)===before'),true);
  run('taskCostItems=JSON.parse(JSON.stringify(S.tasks[0].costItems)); App.costSet(0,"qty",51); App.costSet(0,"externalPackPrice",125); updateTask(S,task.id,{costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('S.tasks[0].cost'),12.75);
  assert.equal(run('S.tasks[0].costItems[0].qty'),51);
  assert.equal(run('JSON.stringify(S.stock)===before'),true);
});

test('external total is independent of measured quantity and supports zero', () => {
  const {run} = client();
  run('taskCostItems=[{name:"External",unit:"กรัม",qty:50,externalPriceMode:"total",externalTotal:12.75}]; App.costSet(0,"qty",100);');
  assert.equal(run('taskCostItems[0].totalCost'),12.75);
  run('App.costSet(0,"qty",0); const task=addTask(S,{status:"done",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('task.cost'),12.75);
  run('App.costSet(0,"externalTotal",0);');
  assert.equal(run('taskCostItems[0].totalCost'),0);
});

test('external source toggling retains price mode; stock switching clears external pricing', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",50); App.costUseExternal(0);');
  assert.equal(run('taskCostItems[0].externalPackQty'),500);
  assert.equal(run('taskCostItems[0].externalPackPrice'),120);
  assert.equal(run('taskCostItems[0].totalCost'),12);
  run('App.costUseExternal(0);');
  assert.equal(run('taskCostItems[0].externalPriceMode'),'package');
  run('App.costSet(0,"stockId","b");');
  assert.equal(run('taskCostItems[0].externalPriceMode'),undefined);
  assert.equal(run('taskCostItems[0].externalPackPrice'),undefined);
});

test('legacy external unit prices remain unchanged and package mode rejects missing sizes in calculation', () => {
  const {run} = client();
  assert.equal(run('costTotal({qty:2,unitCost:35})'),70);
  assert.equal(run('taskMaterialCost({qty:2,unitCost:35})'),70);
  assert.equal(run('costTotal({qty:50,unitCost:.255,externalPriceMode:"unit"})'),12.75);
  assert.equal(run('taskMaterialCost({qty:50,unitCost:.255,externalPriceMode:"unit"})'),12.75);
  assert.equal(run('externalMaterialCost({externalPriceMode:"package",qty:50,externalPackQty:0,externalPackPrice:300})'),0);
  assert.equal(run('externalMaterialCost({externalPriceMode:"package",qty:50,externalPackQty:500,externalPackPrice:0})'),0);
  assert.equal(run('externalMaterialCost({stockId:"a",externalPriceMode:"total",externalTotal:99})'),null);
});
test('fractional external quantities have identical preview, saved and edited costs', () => {
  const {run} = client();
  for (const mode of ['unit', undefined]) {
    run(`taskCostItems=[{name:"External",qty:.5,unit:"ลิตร",unitCost:120,stockMode:"package",externalPriceMode:${JSON.stringify(mode) || 'undefined'}}];`);
    assert.equal(run('costTotal(taskCostItems[0])'),60);
    run('var externalTask=addTask(S,{status:"planned",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
    assert.equal(run('externalTask.cost'),60);
    run('updateTask(S,externalTask.id,{status:"done"});');
    assert.equal(run('S.tasks.find(t=>t.id===externalTask.id).cost'),60);
    run('App.costSet(0,"qty",.25); updateTask(S,externalTask.id,{costItems:JSON.parse(JSON.stringify(taskCostItems))});');
    assert.equal(run('S.tasks.find(t=>t.id===externalTask.id).cost'),30);
  }
  assert.equal(run('S.stock[0].qty'),10);
  assert.equal(run('taskMaterialCost({stockId:"a",qty:.5,unitCost:120,stockMode:"package"},S.stock[0])'),120);
});

test('external package units convert volume and mass, retain aliases and reject incompatible units', () => {
  const {run} = client();
  for (const [unit, packUnit, qty, size, expected] of [
    ['ซีซี','ลิตร',50,1,15], ['ML','l',50,1,15], ['ลิตร','มล.',.05,500,30],
    ['กรัม','กก.',50,1,15], ['kg','g',.5,1000,150], ['ซีซี',undefined,50,500,30]
  ]) {
    run(`taskCostItems=[${JSON.stringify({name:'External',unit,externalPackUnit:packUnit,qty,externalPackQty:size,externalPackPrice:300,externalPriceMode:'package',stockMode:'package'})}];`);
    assert.equal(run('costExternalPackageError(taskCostItems[0])'),null);
    assert.equal(run('costTotal(taskCostItems[0])'),expected);
    run('var converted=addTask(S,{status:"done",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
    assert.equal(run('converted.cost'),expected);
    assert.equal(run('converted.costItems[0].externalPackUnit'),packUnit);
  }
  run('App.costSet(0,"externalPackUnit","กก");');
  assert.equal(run('externalPackageSizeInUsageUnit(taskCostItems[0])'),null);
  assert.equal(run('costExternalPackageError(taskCostItems[0])[0]'),'.ci-pack-unit-select');
  run('App.costSet(0,"externalPackUnit","ซีซี");');
  assert.equal(run('costExternalPackageError(taskCostItems[0])'),null);
  assert.equal(run('S.stock[0].qty'),10);
});

test('fine unit prices survive mode changes and saving without early rounding', () => {
  const {run} = client();
  run('taskCostItems=[{name:"External",unit:"ซีซี",qty:50,externalPriceMode:"package",externalPackQty:500,externalPackPrice:299,stockMode:"package"}]; App.costSet(0,"qty",50); App.costSet(0,"externalPriceMode","unit");');
  assert.equal(run('taskCostItems[0].unitCost'),.598);
  assert.equal(run('costTotal(taskCostItems[0])'),29.9);
  run('var precise=addTask(S,{status:"done",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('precise.cost'),29.9);
  assert.equal(run('precise.costItems[0].unitCost'),.598);
  assert.match(read('js/app.js'),/class="ci-price"[^>]*type="number" min="0" step="any"/);
});

test('package validation points to missing fields and accepts free products', () => {
  const {run} = client();
  run('var input={qty:50,unit:"ซีซี",externalPackQty:1,externalPackUnit:"ลิตร",externalPackPrice:0};');
  assert.equal(run('costExternalPackageError(input)'),null);
  for (const [key,value,field] of [['qty',0,'.ci-qty'],['unit','','.ci-unit'],['externalPackQty',0,'.ci-pack-qty'],['externalPackPrice','','.ci-pack-price']]) {
    assert.equal(run(`costExternalPackageError({...input,${key}:${JSON.stringify(value)}})[0]`),field);
  }
});

test('owner enters 50 cc from 500 cc bottle and pays 12, with no bottle arithmetic', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty","50");');
  assert.equal(run('taskCostItems[0].usageUnit'), 'ซีซี');
  assert.equal(run('taskCostItems[0].qty'), .1);
  assert.equal(run('taskCostItems[0].totalCost'), 12);
  assert.equal(run('taskCostItems[0].stockMode'), 'package');
  run('const task={status:"done",stockState:"reserved",costItems:JSON.parse(JSON.stringify(taskCostItems))}; prepareTaskStock(S,task);');
  assert.equal(run('task.cost'), 12);
  assert.equal(run('S.stock[0].qty'), 9);
  assert.equal(run('S.stock[0].openQty'), 0);
  assert.equal(run('Number(task.costItems[0].usageQty)'), 50);
});
test('cc and ml share one option while saved ml quantities keep the same cost', () => {
  const {run} = client();
  for (const unit of ['ซีซี', 'มล', 'มล.', 'มิลลิลิตร', 'cc', 'ml', 'ML']) {
    assert.equal(run(`costUnitKey(${JSON.stringify(unit)})`), 'ซีซี');
  }
  run('App.costSet(0,"stockId","a"); taskCostItems[0].usageUnit="มล"; App.costSet(0,"usageQty",50);');
  assert.equal(run('taskCostItems[0].totalCost'), 12);
  assert.equal(run('taskCostItems[0].usageUnit'), 'มล');
  assert.deepEqual(JSON.parse(run('JSON.stringify(costUsageOptions(taskCostItems[0],S.stock[0]))')), [
    {label:'ซีซี (มล.)',value:'ซีซี'}, {label:'ลิตร',value:'ลิตร'}, {label:'ขวด',value:'ขวด'}
  ]);
  run('taskCostItems[0].calcSizeAmt=500; taskCostItems[0].calcSizeUnit="มล"; App.costSaveCalcSize(0);');
  assert.equal(run('S.stock[0].size'), '500 ซีซี');
  assert.equal(run('parseStockSize(S.stock[0].size).amount'), 500);
  assert.equal(run('taskCostItems[0].usageQty'), 50);
});
test('stock replacement and deselection reset stale name, quantity, unit and size', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",50); App.costSet(0,"stockId","b");');
  assert.equal(run('taskCostItems[0].name'), 'Product B');
  assert.equal(run('taskCostItems[0].unit'), 'ถุง');
  assert.equal(run('taskCostItems[0].packageSize'), '1 kg');
  assert.equal(run('taskCostItems[0].usageQty'), '');
  assert.equal(run('taskCostItems[0].unitCost'), '300.00');
  run('App.costSet(0,"stockId","b");');
  assert.equal(run('taskCostItems[0].name'), '');
  assert.equal(run('taskCostItems[0].unit'), '');
  assert.equal(run('taskCostItems[0].usageUnit'), undefined);
});
test('unit changes preserve the amount, and manual entry overrides per-area calculation', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costCalcInput(0,"area",2); App.costCalcInput(0,"rate",25);');
  assert.equal(run('taskCostItems[0].usageQty'), 50);
  run('App.costSet(0,"usageUnit","ลิตร");');
  assert.equal(run('taskCostItems[0].rate'), '25 ซีซี (มล.)/ไร่');
  assert.equal(run('taskCostItems[0].usageQty'), .05);
  assert.equal(run('taskCostItems[0].totalCost'), 12);
  run('App.costSet(0,"usageQty",.1);');
  assert.equal(run('taskCostItems[0].qty'), .2);
  assert.equal(run('taskCostItems[0].totalCost'), 24);
  assert.equal(run('taskCostItems[0].calcRate'), '');
});
test('saved size and selected price survive completion, including cents and zero price', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",51); App.costSet(0,"unitCost",125); S.stock[0].size="1 L";');
  assert.equal(run('costUsageFactor(taskCostItems[0],S.stock[0])'), 500);
  run('const task={status:"done",stockState:"reserved",costItems:JSON.parse(JSON.stringify(taskCostItems))}; prepareTaskStock(S,task);');
  assert.equal(run('task.cost'), 12.75);
  assert.equal(run('taskMaterialCost({...task.costItems[0],unitCost:0},S.stock[0])'), 0);
});
test('record-only keeps stock intact and legacy bottle quantities still charge whole bottles', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",50); App.costSet(0,"stockMode","record"); const task={status:"done",costItems:taskCostItems}; prepareTaskStock(S,task);');
  assert.equal(run('task.cost'), 12);
  assert.equal(run('S.stock[0].qty'), 10);
  assert.equal(run('taskStockChargeQty({qty:.1,stockMode:"package"})'), 1);
  assert.equal(run('costTotal({stockId:"a",qty:.1,stockMode:"package",unitCost:120})'), 120);
});
test('mass and English units convert without mixing volume and mass', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","b"); App.costSet(0,"usageUnit","กรัม"); App.costSet(0,"usageQty",50);');
  assert.equal(run('taskCostItems[0].qty'), .05);
  assert.equal(run('taskCostItems[0].totalCost'), 15);
  assert.equal(run('sizeFamily("ML")'), 'volume');
  assert.equal(run('unitToBase("KG")'), 1000);
  assert.equal(run('costUsageFactor({...taskCostItems[0],usageUnit:"ซีซี"},S.stock[1])'), null);
});
test('saved activity can reopen and change measured quantity without double stock deduction', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",50); const task=addTask(S,{type:"spray",date:"2026-09-30",status:"done",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('task.cost'), 12);
  run('taskCostItems=JSON.parse(JSON.stringify(task.costItems)); App.costSet(0,"usageQty",100); updateTask(S,task.id,{costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('S.tasks[0].cost'), 24);
  assert.equal(run('S.tasks[0].costItems[0].usageQty'), 100);
  assert.equal(run('S.stock[0].qty'), 9);
});
test('partial use opens one full bottle, retains 450 cc, then uses that remainder without touching sealed stock', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a"); App.costSet(0,"usageQty",50); App.costSet(0,"stockMode","content"); const task=addTask(S,{type:"spray",status:"planned",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('S.stock[0].qty'),10);
  assert.equal(run('S.stock[0].openQty'),0);
  run('updateTask(S,task.id,{status:"done"});');
  assert.equal(run('S.stock[0].qty'),9);
  assert.equal(run('S.stock[0].openQty'),.9);
  assert.equal(run('costOpenedAmount(S.stock[0],S.stock[0].openQty)'), '450 ซีซี (มล.)');
  run('App.costSet(0,"stockMode","open"); addTask(S,{type:"spray",status:"done",costItems:JSON.parse(JSON.stringify(taskCostItems))});');
  assert.equal(run('S.stock[0].qty'),9);
  assert.equal(run('S.stock[0].openQty'),.8);
  assert.equal(run('S.tasks[1].cost'),12);
});
test('stock with only opened contents remains selectable and its opened-only mode works', () => {
  const {run} = client();
  run('S.stock[0].qty=0; S.stock[0].openQty=.9;');
  assert.match(run('stockPickItemsHtml(0)'),/Product A/);
  run('App.costSet(0,"stockId","a");');
  assert.equal(run('taskCostItems[0].stockId'),'a');
  run('App.costSet(0,"stockMode","open"); App.costSet(0,"usageQty",50); addTask(S,{type:"spray",status:"done",costItems:taskCostItems});');
  assert.equal(run('S.stock[0].qty'),0);
  assert.equal(run('S.stock[0].openQty'),.8);
});
test('partial-use choice is always visible and empty opened stock explains the disabled choice', () => {
  const {run} = client();
  run('App.costSet(0,"stockId","a");');
  const html=run('costStockActionHtml(0,taskCostItems[0],S.stock[0])');
  assert.match(html,/ใช้บางส่วน · เก็บที่เหลือ/);
  assert.match(html,/ยังไม่มียอดเปิด/);
  assert.match(html,/disabled title="ยังไม่มียอดเปิดที่พร้อมใช้"/);
  assert.match(html,/เบิกเต็มขวด\/ถุง/);
  assert.equal(run('taskCostItems[0].stockMode'),'package');
});
