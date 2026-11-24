const test = require('node:test');
const assert = require('node:assert/strict');
const { rowsFromState } = require('../js/ledger-preview.js');

test('ledger shows one line per cost item without counting the parent task again', () => {
  const state = {
    plots: [{ id: 'p1', name: 'A' }],
    cycles: [{ id: 'c1', plotId: 'p1', plant: 'ข้าวโพดหวาน', startDate: '2026-09-01' }],
    stock: [{ id: 's1', name: 'ยา A', category: 'ยากำจัดวัชพืช' }],
    tasks: [
      { id: 'planned', status: 'planned', date: '2026-09-04', cost: 9999 },
      { id: 'failed', status: 'failed', date: '2026-09-04', cost: 9999 },
      { id: 'done', status: 'done', date: '2026-09-04', doneDate: '2026-09-05', plotId: 'p1', cycleId: 'c1',
        title: 'ฉีดยา', materialAreaRai: 2.5, cost: 80, costItems: [
          { name: 'ยา A', stockId: 's1', category: 'chemical', qty: 0.1, unit: 'ขวด', usageQty: 50, usageUnit: 'ซีซี', unitCost: 500, totalCost: 50 },
          { name: 'ค่าพ่น', category: 'labor', qty: 1, unit: 'ครั้ง', unitCost: 30, totalCost: 30 }
        ] }
    ]
  };
  const rows = rowsFromState(state);
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((sum, row) => sum + (row.amount || 0), 0), -80);
  assert.equal(rows[0].date, '2026-09-05');
  assert.equal(rows[0].age, 4);
  assert.equal(rows[0].area, 2.5);
  assert.equal(rows.find(row => row.topic === 'ยา A').used, 50);
  assert.equal(rows.find(row => row.topic === 'ยา A').unit, 'ซีซี');
});

test('ledger separates revenue and zero-cost activity from expenses', () => {
  const rows = rowsFromState({ plots: [], cycles: [], stock: [], tasks: [
    { id: 'harvest', status: 'done', date: '2026-09-03', title: 'เก็บเกี่ยว', revenue: 1200, harvestQty: 100, harvestUnitPrice: 12 },
    { id: 'inspect', status: 'done', date: '2026-09-02', title: 'ตรวจแปลง', cost: 0, revenue: 0 }
  ] });
  assert.deepEqual(rows.map(row => row.kind), ['รายได้', 'กิจกรรม']);
  assert.equal(rows[0].amount, 1200);
  assert.equal(rows[1].amount, null);
});
