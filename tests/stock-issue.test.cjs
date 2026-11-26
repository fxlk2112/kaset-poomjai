const {test} = require('node:test');
const assert = require('node:assert/strict');
const StockIssue = require('../js/stock-issue.js');

function state() {
  return {
    stock: [{id:'s1', name:'ยา A', code:'A-1', unit:'ขวด', qty:3, adjustments:[{date:'2026-10-22', qty:-2, reason:'นับใหม่'}]}],
    plots: [{id:'p1', name:'แปลง A'}, {id:'p2', name:'แปลง B'}],
    tasks: [
      {id:'t1', batchId:'b1', title:'ฉีดยา', plotId:'p1', status:'done', date:'2026-10-20', doneDate:'2026-10-22',
        costItems:[{stockId:'s1', stockMode:'content', name:'ยา A', qty:.06, usageQty:30, usageUnit:'cc'}],
        stockLog:[{stockId:'s1', qty:.06, mainWithdrawn:1, openUsed:0, openAdded:.94}]},
      {id:'t2', batchId:'b1', title:'ฉีดยา', plotId:'p2', status:'done', doneDate:'2026-10-22',
        costItems:[{stockId:'s1', stockMode:'open', name:'ยา A', qty:.04, usageQty:20, usageUnit:'cc'}],
        stockLog:[{stockId:'s1', qty:.04, mainWithdrawn:0, openUsed:.04, openAdded:0}]},
      {id:'t3', title:'วางแผน', status:'planned', date:'2026-10-22', costItems:[{stockId:'s1', qty:1}]},
      {id:'t4', title:'ไม่สำเร็จ', status:'failed', doneDate:'2026-10-22', costItems:[{stockId:'s1', qty:1}]},
      {id:'t5', title:'ไม่ตัดสต็อก', status:'done', doneDate:'2026-10-22', costItems:[{stockId:'s1', qty:1, stockMode:'record'}], stockLog:[]}
    ]
  };
}

test('groups a multi-plot batch without double counting sealed packages', () => {
  const s = state(), before = JSON.stringify(s);
  const report = StockIssue.forDate(s, '2026-10-22');
  assert.equal(report.entries.length, 2);
  assert.equal(report.products.length, 1);
  assert.equal(report.products[0].withdrawn, 1);
  assert.deepEqual(report.products[0].used, [{unit:'cc', qty:50}]);
  assert.deepEqual(report.products[0].plots, ['แปลง A', 'แปลง B']);
  assert.equal(report.products[0].activities.length, 1);
  assert.equal(report.adjustments.length, 1);
  assert.equal(report.unverified.length, 0);
  assert.equal(JSON.stringify(s), before);
});

test('uses actual completion date and keeps manual adjustments separate', () => {
  const s = state();
  assert.equal(StockIssue.forDate(s, '2026-10-20').products.length, 0);
  const report = StockIssue.forDate(s, '2026-10-22');
  assert.equal(report.adjustments[0].qty, 2);
  assert.equal(report.products[0].withdrawn, 1);
});

test('older consumed tasks without a reliable stock log require review', () => {
  const s = state();
  s.tasks.push({id:'old', title:'งานเก่า', status:'done', doneDate:'2026-10-22', stockState:'consumed',
    costItems:[{stockId:'s1', qty:.2, stockMode:'content'}]});
  const report = StockIssue.forDate(s, '2026-10-22');
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].id, 'old');
  assert.equal(report.products[0].withdrawn, 1);
});

test('defaults to the latest dated stock event', () => {
  assert.equal(StockIssue.latestDate(state(), '2026-10-23'), '2026-10-22');
  assert.equal(StockIssue.latestDate({tasks:[], stock:[]}, '2026-10-23'), '2026-10-23');
  const s = state();
  s.tasks.push({id:'old', status:'done', doneDate:'2026-10-23', stockState:'consumed', costItems:[{stockId:'s1', qty:1}]});
  assert.equal(StockIssue.latestDate(s, '2026-10-23'), '2026-10-23');
});

test('history starts with all dates in newest-first order and searches products without a date guess', () => {
  const s = state();
  s.tasks.push({id:'older', title:'พ่นวัสดุ', status:'done', doneDate:'2026-10-19', plotId:'p2',
    costItems:[{stockId:'s1', name:'ยา A', qty:1, unit:'ขวด'}],
    stockLog:[{stockId:'s1', qty:1, mainWithdrawn:1, openUsed:0, openAdded:0}]});
  s.stock[0].adjustments.push({date:'2026-10-18', qty:-1, reason:'ชำรุด'});
  const before = JSON.stringify(s);
  const all = StockIssue.history(s);
  assert.deepEqual(all.map(day => day.date), ['2026-10-22', '2026-10-19', '2026-10-18']);
  assert.equal(all[0].products[0].used[0].qty, 50);
  assert.equal(all[1].products[0].withdrawn, 1);
  assert.equal(all[2].products.length, 0);
  assert.equal(StockIssue.history(s, 'A-1').length, 3);
  assert.deepEqual(StockIssue.history(s, 'พ่นวัสดุ').map(day => day.date), ['2026-10-19']);
  assert.deepEqual(StockIssue.history(s, 'ชำรุด').map(day => day.date), ['2026-10-18']);
  assert.equal(StockIssue.history(s, 'ไม่มี').length, 0);
  assert.equal(JSON.stringify(s), before);
});
