// Synthetic local-only evidence. No field coordinates, real people or real product recommendations.
const {buildDemoState} = require('../../tools/demo-state.cjs');
function buildMaterialsDemo() {
  const state = buildDemoState('2026-11-27');
  state.plots.forEach(p => {p.lat = ''; p.lng = '';});
  const plotId = 'demo-plot-1', cycleId = 'demo-cycle-active-0';
  const item = (name, category, qty, unit, totalCost) => ({name, category, usageQty:qty, usageUnit:unit, totalCost, stockMode:'record'});
  const activity = (id, date, title, items, extra={}) => ({id, title, plotId, cycleId, type:'spray', status:'done', date, doneDate:date,
    note:'ข้อมูลสมมติสำหรับทดสอบหน้าจอเท่านั้น', costItems:items, cost:items.reduce((sum,x)=>sum+x.totalCost,0), ...extra});
  state.tasks = [
    activity('qa-use-1','2026-11-24','ฉีดยาครั้งที่ 2',[item('ผลิตภัณฑ์ตัวอย่าง A','chemical',800,'ml',120),item('สารร่วมตัวอย่าง B','other',250,'ml',45),item('ค่าแรงตัวอย่าง','labor',1,'คน',150)],{date:'2026-11-20'}),
    activity('qa-use-2','2026-11-22','ใส่ปุ๋ยครั้งที่ 2',[item('ปุ๋ยตัวอย่าง A','fertilizer',25,'kg',325)],{type:'fertilize'}),
    activity('qa-use-3','2026-11-15','ฉีดยาครั้งที่ 1',[item('ผลิตภัณฑ์ตัวอย่าง A','chemical',1,'l',150),item('ผลิตภัณฑ์ตัวอย่าง C','chemical',20,'g',5),item('สารร่วมตัวอย่าง B','other',250,'ml',45),item('ค่าแรงตัวอย่าง','labor',1,'คน',100)]),
    activity('qa-old','2026-08-20','ฉีดยาในรอบก่อน',[item('ผลิตภัณฑ์ตัวอย่าง A','chemical',500,'ml',75)],{cycleId:'demo-cycle-old-0'}),
    activity('qa-plan','2026-12-01','ใส่ปุ๋ยครั้งถัดไป',[item('ปุ๋ยตัวอย่าง A','fertilizer',25,'kg',325)],{status:'planned',type:'fertilize',doneDate:''}),
    activity('qa-failed','2026-11-10','งดฉีดยา',[item('ผลิตภัณฑ์ตัวอย่าง A','chemical',500,'ml',75)],{status:'failed'}),
    activity('qa-other-plot','2026-11-24','งานแปลงอื่น',[item('ผลิตภัณฑ์ตัวอย่าง A','chemical',999,'l',99999)],{plotId:'demo-plot-2',cycleId:'demo-cycle-active-1'}),
    {id:'qa-unassigned',title:'บันทึกเก่าไม่ผูกรอบ',plotId,cycleId:'',status:'done',type:'spray',date:'2026-07-10',stockId:'demo-stock-2',qty:0.5,unit:'ขวด',cost:80,costCat:'chemical'}
  ];
  state.projects=[]; state.trials=[];
  return state;
}
module.exports = {buildMaterialsDemo};
