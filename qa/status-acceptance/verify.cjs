// Read-only reconciliation of private acceptance snapshots. Never logs credentials or file keys.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const [baselinePath,snapshotPath]=process.argv.slice(2);
if(!baselinePath || !snapshotPath)throw Error('Usage: node verify.cjs baseline.json snapshot.json');
const read=p=>{const raw=JSON.parse(fs.readFileSync(p,'utf8'));return raw.data || raw;};
const baseline=read(baselinePath),snapshot=read(snapshotPath),id='status-qa-20261128';
let normalized=0;
for(const collection of ['plots','cycles','projects','tasks','stock','sales']){
  const current=snapshot[collection] || [];
  assert.equal(new Set(current.map(x=>x.id)).size,current.length,collection+' IDs must be unique');
  for(const old of baseline[collection] || []){
    const found=current.find(x=>x.id===old.id);
    assert.ok(found,'An original record is missing');
    const copy=structuredClone(found);
    // Existing hydration adds an empty watering list to legacy tasks; no field values may change.
    if(collection==='tasks' && old.wateringSessions===undefined && Array.isArray(copy.wateringSessions) && !copy.wateringSessions.length){delete copy.wateringSessions;normalized++;}
    assert.ok(isDeepStrictEqual(copy,old),'An original record changed');
  }
}
const ctx=vm.createContext({Date,console,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>null},setTimeout(){},snapshot});
const run=code=>vm.runInContext(code,ctx);
for(const file of ['js/data.js','js/projects.js','js/project-workspace.js'])run(fs.readFileSync(path.join(__dirname,'../..',file),'utf8'));
run('Object.assign(S,snapshot);');
const tasks=snapshot.tasks.filter(t=>t.projectId===id),stock=snapshot.stock.find(x=>x.id===id);
assert.equal(tasks.length,3);
const work=tasks.find(t=>t.id===id+'-fertilize');
assert.equal(work.status,'done');assert.equal(work.cost,250);
assert.equal(work.costItems.filter(i=>i.category==='fertilizer').reduce((n,i)=>n+i.totalCost,0),100);
assert.equal(work.costItems.filter(i=>i.category==='labor').reduce((n,i)=>n+i.totalCost,0),150);
assert.equal(work.stockLog.length,1);assert.equal(work.stockLog[0].qty,2);
assert.equal(work.stockState,'consumed');
assert.equal((work.photos || []).length+(work.donePhotos || []).length,1);
for(const expression of [`projectCosts(projectById('${id}')).cost`,`plotFinance(S,'${id}').cost`,`cycleFinance(S,'${id}').cost`])assert.equal(run(expression),250);
assert.equal(run(`projectPlanProgress(projectById('${id}')).percent`),67);
assert.equal(stock.qty,7);assert.equal(stock.openQty,0);assert.equal(stock.qty*stock.avgCost,350);
const sales=snapshot.sales.filter(s=>(s.items || []).some(i=>i.stockId===id));
assert.equal(sales.length,1);assert.equal(sales[0].items[0].qty,1);
ctx.sale=sales[0];assert.equal(run('saleGrandTotal(sale)'),80);assert.equal(run('saleCost(sale,S)'),50);
assert.equal(sales[0].paymentSlips.length,1);assert.match(sales[0].paymentSlips[0].key,/^sale-private\//);
const source=snapshot.tasks.filter(t=>t.projectId==='syngenta-new-project');
const original=baseline.tasks.filter(t=>t.projectId==='syngenta-new-project');
assert.equal(source.length,33);assert.ok(isDeepStrictEqual(source,original),'Worksheet records changed');
assert.equal(source.filter(t=>t.dataStatus==='pending').length,7);
assert.equal(source.filter(t=>!t.date).length,4);
assert.equal(run("projectProgress(projectById('syngenta-new-project'))"),null);
console.log(JSON.stringify({result:'PASS',originalWorksheetRecords:33,missingRecordsPreserved:7,blankDatesPreserved:4,legacyEmptyDefaults:normalized,taskCost:250,material:100,labor:150,stockRemaining:7,stockValue:350,sale:80,saleCost:50,taskPhotos:1,privateSlips:1}));
