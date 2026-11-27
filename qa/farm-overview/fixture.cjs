// Synthetic QA only. Never imported by production assets.
const {buildDemoState}=require('../../tools/demo-state.cjs');
function buildOverviewDemo() {
  const s=buildDemoState('2026-11-27');
  s.plots.forEach((p,i)=>{p.name='แปลง '+String.fromCharCode(65+i);p.lat='';p.lng='';});
  s.tasks=[];s.sales=[];s.trials=[];s.equipment=[];s.stockMoves=[];
  s.stock.forEach(p=>{p.qty=20;p.openQty=0;});
  s.projects=[0,1].map(i=>({id:'overview-project-'+i,code:'PRJ-2569-00'+(i+1),name:i?'ทดลองปุ๋ยในแปลง B':'ดูแลแปลง A รอบ 2',kind:i?'experiment':'work',status:'active',plotId:s.plots[i].id,cycleId:'demo-cycle-active-'+i,stages:[{id:'stage-'+i,name:'ลงมือทำ'}],trialIds:[],files:[],events:[],createdAt:Date.parse('2026-11-01T00:00:00Z'),updatedAt:Date.parse('2026-11-27T00:00:00Z')}));
  const add=(id,title,date,status,plot,extra={})=>s.tasks.push({id,title,date,status,type:'work',stockState:'reserved',stockLog:[],plotId:s.plots[plot].id,cycleId:'demo-cycle-active-'+plot,projectId:s.projects[plot===2?1:plot].id,projectStageId:'stage-'+(plot===2?1:plot),cost:0,revenue:0,costItems:[],note:'ข้อมูลสมมติสำหรับตรวจหน้าจอ',doneDate:status==='done'?date:'',...extra});
  add('overview-moisture','ตรวจความชื้นแปลง A','2026-11-27','planned',0);
  add('overview-fertilizer','ใส่ปุ๋ยครั้งที่ 2','2026-11-27','planned',0,{type:'fertilize',cost:650,costCat:'fertilizer',stockId:'demo-stock-1',qty:1,unit:'กระสอบ',costItems:[{stockId:'demo-stock-1',name:'ปุ๋ยตัวอย่าง A',category:'fertilizer',qty:1,unit:'กระสอบ',usageQty:50,usageUnit:'kg',packageSize:'50 กก.',unitCost:650,totalCost:650}]});
  add('overview-measure','เก็บค่าวัดการเจริญเติบโต','2026-11-27','planned',1);
  add('overview-survey','สำรวจแปลง C','2026-11-28','planned',2);
  add('overview-followup','ติดตามผลหลังใส่ปุ๋ย','2026-11-30','planned',0);
  add('overview-later','สรุปผลการดูแลแปลง','2026-12-03','planned',1);
  add('overview-late-a','ตรวจสภาพดินแปลง A','2026-11-25','planned',0);
  add('overview-late-b','สำรวจใบแปลง B','2026-11-26','planned',1);
  for(let i=0;i<6;i++)add('overview-done-a-'+i,i===0?'ให้น้ำแปลง A':'ดูแลแปลง A ครั้งที่ '+i,i===0?'2026-11-27':'2026-11-'+String(10+i).padStart(2,'0'),'done',0,{cost:i===1?200:0});
  for(let i=0;i<4;i++)add('overview-done-b-'+i,i===0?'สำรวจแปลง B':'ดูแลแปลง B ครั้งที่ '+i,i===0?'2026-11-27':'2026-11-'+String(10+i).padStart(2,'0'),'done',1,{cost:i===1?100:0});
  return s;
}
module.exports={buildOverviewDemo};
