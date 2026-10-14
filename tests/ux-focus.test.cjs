const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const stock=read('js/stock.js');
const context=vm.createContext({});
vm.runInContext(stock.slice(stock.indexOf('function stockPriceCoverage('),stock.indexOf('function stockBalanceHtml(')),context);

test('inventory value reports missing costs only for held stock',()=>{
  const rows=[{qty:2,avgCost:0},{qty:0,openQty:.5,avgCost:0},{qty:0,avgCost:0},{qty:3,avgCost:120}];
  const result=vm.runInContext('stockPriceCoverage('+JSON.stringify(rows)+')',context);
  assert.equal(result.priced,1);assert.equal(result.missing,2);
});

test('duplicate inventory warning detects names or codes but does not merge records',()=>{
  const rows=[{id:'a',name:'Product A',code:'001'},{id:'b',name:' product a ',code:'002'},{id:'c',name:'Another',code:'001'},{id:'d',name:'Unique'},{id:'e',name:''}];
  const ids=vm.runInContext('stockDuplicateIds('+JSON.stringify(rows)+')',context);
  assert.deepEqual(Array.from(ids).sort(),['a','b','c']);
  assert.equal(rows.length,5);
});

test('sealed inventory includes items with both full and opened packages',()=>{
  const match=stock.match(/if \(stockFilter === "sealed" && ([^\n]+)\) return false;/);
  assert.ok(match);
  const excludes=x=>vm.runInNewContext(match[1],{x});
  assert.equal(excludes({qty:4,openQty:.4}),false);
  assert.equal(excludes({qty:0,openQty:.4}),true);
});

test('UI keeps trial charts and optional photos, and separates pending work from history',()=>{
  const app=read('js/app.js'),flows=read('js/workspace-flows.js');
  assert.match(app,/let plannerFilter = "pending"/);
  assert.match(app,/taskRecordDate\(b\)\.localeCompare\(taskRecordDate\(a\)\)/);
  assert.match(flows,/trial-optional-photos/);
  assert.match(app,/trialComparePanel/);
  assert.match(app,/const shouldOpenDoneFlow = .*existing && existing.status !== "done"/);
});
