const {buildProjectDemo}=require('../project-proposal/fixture.cjs');
function buildRecordKindDemo(){
  const s=buildProjectDemo(),pid='qa-task-kind',tid='qa-task-kind-trial';
  const stages=[{id:'prepare',name:'เตรียมการทดลอง'},{id:'follow',name:'ดำเนินการและติดตาม'},{id:'summary',name:'สรุปผล'}];
  const titles=[['ยืนยันวัตถุประสงค์และแผนทดลอง','prepare'],['กำหนดชุดทดลอง ตัวอย่าง และค่าวัด','prepare'],['บันทึกค่าก่อนเริ่ม','prepare'],['ดำเนินงานตามแผนและบันทึกวัสดุ','follow'],['เก็บค่าวัดและรูปภาพติดตามผล','follow'],['ตรวจความครบถ้วนของข้อมูล','summary'],['สรุปผลและจัดทำรายงาน','summary']];
  const metrics=[{id:'height',name:'ความสูง',unit:'ซม.',kind:'number'},{id:'width',name:'ความกว้างใบ',unit:'ซม.',kind:'number'}];
  const plot=s.plots[0],cycle=s.cycles.find(c=>c.plotId===plot.id && c.status==='active');
  // Omit recordKind intentionally: this fixture verifies legacy projects from before the fix.
  s.tasks=titles.map(([title,stage],i)=>({id:'qa-kind-task-'+i,title,projectId:pid,projectStageId:stage,plotId:plot.id,cycleId:cycle.id,date:'',time:'',status:'planned',type:'work',order:i,cost:0,revenue:0,costItems:[],photos:[],note:'',createdAt:1795737600000}));
  s.projects=[{id:pid,code:'PRJ-2569-TEST',name:'[ตัวอย่าง] ทดลองเปรียบเทียบการดูแลแปลง',kind:'experiment',plotId:plot.id,cycleId:cycle.id,status:'active',objective:'ตรวจการบันทึกงานและค่าวัดแยกตามงานย่อย',stages,trialIds:[tid],groups:['กลุ่มทดลอง','วิธีเดิม'],measurementSchema:metrics,records:[],events:[],reportVersions:[],createdAt:1795737600000}];
  const treatments=[{id:'group-a',code:'A',name:'กลุ่มทดลอง'},{id:'group-b',code:'B',name:'วิธีเดิม'}];
  s.trials=[{id:tid,projectId:pid,name:'[ตัวอย่าง] ชุดเปรียบเทียบ',plotId:plot.id,status:'active',design:'MANUAL',layoutMode:'manual',metrics,treatments,units:treatments.flatMap(t=>Array.from({length:10},(_,i)=>({id:t.code+'-'+(i+1),treatmentId:t.id,label:t.code+'-'+String(i+1).padStart(2,'0'),block:i+1,order:i+1,areaRai:0,note:''}))),observations:[]}];
  return s;
}
module.exports={buildRecordKindDemo};
