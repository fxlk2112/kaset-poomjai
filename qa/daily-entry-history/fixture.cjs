// Synthetic UI/accounting cases only; no production or field data.
const {buildProjectDemo}=require('../project-proposal/fixture.cjs');
function buildDailyEntryDemo(){
  const s=buildProjectDemo(),plotId=s.plots[0].id,cycleId=s.cycles.find(c=>c.plotId===plotId&&c.status==='active').id;
  const project=(id,name,code)=>({id,name,code,kind:'work',entryMode:'proposal',objective:'ตรวจขั้นตอนบันทึกงานด้วยข้อมูลสมมติ',plotId,cycleId,status:'active',stages:[{id:id+'-stage',name:'ดูแลแปลง'}],startDate:'2026-11-01',endDate:'2026-12-31',createdAt:1,trialIds:[],reportVersions:[],records:[],events:[],proposal:{budget:5000,method:'ตรวจปริมาณ ต้นทุน และประวัติ'},conclusion:''});
  s.projects=[project('daily-project','โครงการทดสอบบันทึกงาน','PRJ-QA-001'),project('daily-plan','โครงการทดสอบงานตามแผน','PRJ-QA-002')];
  const task=(id,p,date,status,items,extra={})=>({id,title:'ใส่ปุ๋ย',projectId:p,projectStageId:p+'-stage',plotId,cycleId,type:'fertilize',status,date,doneDate:status==='done'?date:'',cost:items.reduce((n,i)=>n+i.totalCost,0),revenue:0,costItems:items,photos:[],donePhotos:[],stockLog:[],stockState:'none',createdAt:1,...extra});
  s.tasks=[
    task('daily-legacy','daily-project','2026-11-26','done',[{name:'ปุ๋ยสนับสนุนตัวอย่าง',category:'fertilizer',qty:5,unit:'kg',totalCost:0,funding:'supported',sponsor:'ผู้สนับสนุนตัวอย่าง'},{name:'ค่าแรงเดิม QA',category:'other',qty:0,unit:'',totalCost:200,externalPriceMode:'total',externalTotal:200}]),
    task('daily-paid','daily-project','2026-11-27','done',[{name:'ปุ๋ยซื้อภายนอกตัวอย่าง',category:'fertilizer',qty:4,unit:'kg',totalCost:300,externalPriceMode:'total',externalTotal:300},{name:'ค่าแรง',category:'labor',totalCost:100,externalPriceMode:'total',externalTotal:100}]),
    task('daily-plan-done','daily-plan','2026-11-27','done',[],{title:'สำรวจแปลง',type:'work',source:'project-draft'}),
    task('daily-plan-next','daily-plan','2026-11-28','planned',[],{source:'project-draft'})
  ];
  return s;
}
module.exports={buildDailyEntryDemo};
