// Read-only verification of the synthetic browser acceptance run.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'.private/runtime/state.sqlite'),{readOnly:true});
const state=JSON.parse(db.prepare('SELECT data FROM user_data WHERE user_id=?').get('batch-income-repair-qa').data);db.close();
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'.private/fixture.json'),'utf8'));
assert.equal(state.tasks.length,12);assert.equal(new Set(state.tasks.map(t=>t.id)).size,12);
for(const before of fixture.tasks.slice(0,7)){
  const after=state.tasks.find(t=>t.id===before.id);assert.ok(after);assert.equal(after.dataStatus,'complete');assert.deepEqual(after.missingFields,[]);assert.equal(after.cost,0);assert.equal(after.date,'2026-11-20');assert.equal(after.costItems[0].funding,'supported');assert.equal(after.costItems[0].sponsor,before.costItems[0].sponsor);
  for(const key of ['photos','donePhotos','source','sourceRow','projectId','cycleId','plotId','projectStageId','revenue','note'])assert.deepEqual(after[key],before[key]);
}
const batch=state.tasks.filter(t=>t.source==='batch-work');assert.equal(batch.length,4);assert.equal(new Set(batch.map(t=>t.entryBatchId+':'+t.entryRowId)).size,4);
assert.equal(batch.reduce((n,t)=>n+t.cost,0),800);assert.equal(batch.reduce((n,t)=>n+t.revenue,0),7000);
assert.equal(batch.find(t=>t.title==='ปุ๋ยนำเข้าตัวอย่าง').costItems[0].category,'fertilizer');
assert.equal(batch.find(t=>t.title==='บริการสนับสนุนนำเข้า').costItems[0].funding,'supported');
const c=vm.createContext({console,JSON,Date,localStorage:{getItem:()=>null,setItem(){}},setTimeout(){},state});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../js/data.js'),'utf8'),c);
const totals=vm.runInContext(`Object.fromEntries(['plotId','cycleId','projectId'].map(key=>[key,taskFinance(state,t=>t[key]===state.tasks[0][key])]))`,c);
for(const total of Object.values(totals))assert.deepEqual(JSON.parse(JSON.stringify(total)),{revenue:12000,cost:900,net:11100});
assert.equal(state.tasks.filter(t=>t.dataStatus==='pending').length,0);assert.equal(state.stock.length,0);
console.log(JSON.stringify({result:'PASS',records:12,existingRecordsRepaired:7,newBatchRecords:4,pending:0,totals,unchangedEvidence:true,noDuplicateTaskIds:true,noStockChanges:true},null,2));
