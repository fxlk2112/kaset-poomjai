const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildDemoState,mergeDemoState}=require('../tools/demo-state.cjs');

test('demo covers app data sections with synthetic names and disabled hardware',()=>{
  const s=buildDemoState('2026-09-08');
  assert.equal(s.plots.length,3); assert.equal(s.cycles.length,6); assert.equal(s.tasks.length,33);
  assert.equal(s.stock.length,8); assert.equal(s.sales.length,4); assert.equal(s.equipment.length,3);
  assert.equal(s.water.systems.length,3); assert.equal(s.water.logs.length,12);
  assert.equal(s.trials.length,5); assert.equal(s.workers.total,6);
  assert.ok(s.water.systems.every(x=>x.state==='off' && x.auto.enabled===false && !x.deviceId && !x.deviceKey));
  assert.ok(s.tasks.every(t=>t.title.startsWith('[ตัวอย่าง]')));
  assert.ok(JSON.stringify(s).length<900000);
});

test('demo inventory reflects actual app task and sale mutations',()=>{
  const s=buildDemoState('2026-09-08');
  assert.equal(s.stock[0].qty,36);
  assert.equal(s.stock[1].qty+s.stock[1].openQty,53.5);
  assert.equal(s.stock[2].qty+s.stock[2].openQty,28.5);
  assert.equal(s.sales.filter(x=>x.status==='void').length,1);
  assert.equal(s.tasks.filter(t=>t.status==='failed').length,3);
  assert.equal(s.tasks.filter(t=>t.stockLog.length>0).length,6);
  assert.ok(s.stock.every(x=>x.qty>=0 && x.openQty>=0));
});

test('all demo references resolve and every trial has seven dates every three days',()=>{
  const s=buildDemoState('2026-09-08');
  const ids=new Set();
  for(const collection of [s.plots,s.cycles,s.tasks,s.stock,s.sales,s.equipment,s.water.sources,s.water.systems,s.water.logs,s.trials,...s.trials.flatMap(t=>[t.treatments,t.metrics,t.units,t.observations])]) for(const item of collection) {
    assert.ok(!ids.has(item.id)); ids.add(item.id);
  }
  s.tasks.forEach(t=>{
    assert.ok(s.plots.some(p=>p.id===t.plotId)); assert.ok(s.cycles.some(c=>c.id===t.cycleId));
    (t.costItems||[]).filter(i=>i.stockId).forEach(i=>assert.ok(s.stock.some(x=>x.id===i.stockId)));
  });
  for(const tr of s.trials) {
    const dates=[...new Set(tr.observations.map(o=>o.date))].sort();
    assert.equal(dates.length,7);
    dates.slice(1).forEach((d,i)=>assert.equal((Date.parse(d)-Date.parse(dates[i]))/86400000,3));
    tr.observations.forEach(o=>{
      assert.ok(tr.units.some(u=>u.id===o.unitId)); assert.ok(tr.metrics.some(m=>m.id===o.metricId));
      assert.ok(Number.isFinite(o.value)); assert.ok(o.date>=tr.startDate && o.date<='2026-09-08');
      if(o.samples) assert.equal(o.value,o.samples.reduce((a,b)=>a+b,0)/3);
    });
  }
});

test('merging demos preserves all existing records, settings, balances and receipt numbers',()=>{
  const old={plots:[{id:'real',name:'Original'}],stock:[{id:'real-stock',qty:141}],sales:[{id:'real-sale',no:9}],saleSequence:12,workers:{total:2},texts:{brandName:'Keep'},water:{deviceConfig:{key:'preserve'},systems:[{id:'real-water',state:'on'}]},customProperty:{keep:true}};
  const before=JSON.stringify(old), demo=buildDemoState('2026-09-08');
  const merged=mergeDemoState(old,demo);
  assert.equal(JSON.stringify(old),before); assert.deepEqual(merged.plots[0],old.plots[0]);
  assert.deepEqual(merged.stock[0],old.stock[0]); assert.deepEqual(merged.sales[0],old.sales[0]);
  assert.deepEqual(merged.water.systems[0],old.water.systems[0]); assert.deepEqual(merged.water.deviceConfig,old.water.deviceConfig);
  assert.deepEqual(merged.workers,old.workers); assert.deepEqual(merged.texts,old.texts); assert.deepEqual(merged.customProperty,old.customProperty);
  assert.deepEqual(merged.sales.slice(1).map(s=>s.no),[13,14,15,16]); assert.equal(merged.saleSequence,16);
  assert.throws(()=>mergeDemoState(merged,demo),/already exist/);
});
