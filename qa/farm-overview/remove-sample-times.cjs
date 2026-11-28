// Only the known fabricated times in the isolated QA fixture. Never loaded by production.
function removeSampleTimes(state) {
  const planned = {'overview-moisture':'08:30','overview-fertilizer':'10:00','overview-measure':'14:00'};
  for (const task of state?.tasks || []) {
    if (Object.hasOwn(planned, task.id) && task.time === planned[task.id]) delete task.time;
    if (/^overview-done-a-[0-5]$/.test(task.id) && task.doneTime === '07:00') delete task.doneTime;
    if (/^overview-done-b-[0-3]$/.test(task.id) && task.doneTime === '07:30') delete task.doneTime;
  }
}
module.exports = {removeSampleTimes};
