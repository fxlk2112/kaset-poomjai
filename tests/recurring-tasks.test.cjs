const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
const code = source.slice(source.indexOf('function repeatingTaskNextDate('), source.indexOf('function taskAllocationCostKey('));
function setup() {
  let n = 0;
  const s = { tasks: [], cycles: [{ id: 'c1', status: 'active' }], projects: [{ id: 'project-1', status: 'active', stages: [{ id: 'stage-2' }] }] };
  const c = vm.createContext({
    todayISO: () => '2026-11-18',
    addDaysISO: (iso, days) => {
      const d = new Date(iso + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    },
    cycleById: (state, id) => state.cycles.find(cycle => cycle.id === id),
    addTask: (state, task) => {
      const created = { ...task, id: `new${++n}` };
      state.tasks.push(created);
      return created;
    }
  });
  vm.runInContext(code, c);
  return { s, run: expression => vm.runInContext(expression, c) };
}

test('completed repeating work schedules one future task without copying stock use or cost', () => {
  const { s, run } = setup();
  s.tasks.push({ id: 'old', title: 'ตรวจแปลง', type: 'inspect', date: '2026-11-01', status: 'done',
    plotId: 'p1', cycleId: 'c1', projectId: 'project-1', projectStageId: 'stage-2',
    cost: 120, costItems: [{ stockId: 'spray', qty: 1 }], stockId: 'spray', qty: 1,
    note: 'เตรียมอุปกรณ์\nยา: 2 ไร่ × 50 ซีซี/ไร่ = 100 ซีซี',
    repeat: { seriesId: 'series', active: true, every: 7, unit: 'day', anchorDate: '2026-11-01', index: 0 } });
  const next = run('scheduleNextRepeatingTask').call(null, s, s.tasks[0], '2026-11-01');
  assert.equal(next.date, '2026-11-22');
  assert.equal(next.status, 'planned');
  assert.equal(next.cost, 0);
  assert.equal(next.costItems.length, 0);
  assert.equal(next.stockId, null);
  assert.equal(next.projectId, 'project-1');
  assert.equal(next.projectStageId, 'stage-2');
  assert.equal(next.note, 'เตรียมอุปกรณ์');
  assert.equal(next.repeat.generatedFrom, 'old');
  assert.equal(run('scheduleNextRepeatingTask').call(null, s, s.tasks[0], '2026-11-01').id, next.id);
  assert.equal(s.tasks.length, 2);
});

test('monthly schedule keeps the original day when February is shorter', () => {
  const { run } = setup();
  const task = { date: '2027-01-31', repeat: { active: true, every: 1, unit: 'month', anchorDate: '2027-01-31', index: 0 } };
  assert.equal(run('repeatingTaskNextDate').call(null, task, '2027-01-31').date, '2027-02-28');
  task.date = '2027-02-28';
  task.repeat.index = 1;
  assert.equal(run('repeatingTaskNextDate').call(null, task, '2027-02-28').date, '2027-03-31');
});

test('stopping a series preserves existing tasks and blocks new ones', () => {
  const { s, run } = setup();
  s.tasks.push({ id: 'done', date: '2026-11-18', status: 'done', repeat: { seriesId: 'a', active: true, every: 1, unit: 'week' } });
  s.tasks.push({ id: 'next', date: '2026-11-25', status: 'planned', repeat: { seriesId: 'a', active: true, every: 1, unit: 'week' } });
  run('stopRepeatingTaskSeries').call(null, s, 'a');
  assert.equal(s.tasks.length, 2);
  assert.equal(s.tasks.every(task => task.repeat.active === false), true);
  assert.equal(run('scheduleNextRepeatingTask').call(null, s, s.tasks[0], '2026-11-18'), null);
});

test('closed crop cycles do not create tasks beyond the cycle', () => {
  const { s, run } = setup();
  s.cycles[0].status = 'done';
  const task = { id: 'harvest', type: 'harvest', date: '2026-11-18', status: 'done', cycleId: 'c1',
    repeat: { seriesId: 'series', active: true, every: 1, unit: 'week', anchorDate: '2026-11-18', index: 0 } };
  s.tasks.push(task);
  assert.equal(run('scheduleNextRepeatingTask').call(null, s, task, '2026-11-18'), null);
  assert.equal(s.tasks.length, 1);
});

test('closed projects do not receive new recurring tasks', () => {
  const { s, run } = setup();
  s.projects[0].status = 'done';
  const task = { id: 'old', title: 'ตรวจอุปกรณ์', type: 'work', date: '2026-11-18', status: 'done',
    projectId: 'project-1', projectStageId: 'stage-2',
    repeat: { seriesId: 'series', active: true, every: 1, unit: 'week', anchorDate: '2026-11-18', index: 0 } };
  s.tasks.push(task);
  const next = run('scheduleNextRepeatingTask').call(null, s, task, '2026-11-18');
  assert.equal(next.projectId, null);
  assert.equal(next.projectStageId, null);
});
