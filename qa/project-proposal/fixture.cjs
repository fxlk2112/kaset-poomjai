// Isolated synthetic data, never included in production assets.
const {buildOverviewDemo}=require('../farm-overview/fixture.cjs');
function buildProjectDemo(){
  const s=buildOverviewDemo();s.projects=[];s.tasks=[];s.trials=[];
  s.stock=[{id:'proposal-stock',name:'ปุ๋ยตัวอย่าง A',category:'ปุ๋ยเคมี',unit:'กก.',packageSize:'1 กก.',qty:50,openQty:0,avgCost:75,salePrice:75,minQty:0}];
  s.demoData.note='ข้อมูลสมมติสำหรับตรวจระบบโครงการ ไม่ใช่คำแนะนำการใช้ยา';
  return s;
}
module.exports={buildProjectDemo};
