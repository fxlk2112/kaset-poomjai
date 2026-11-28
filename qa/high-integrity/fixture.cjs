const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function buildFixture(){
  const context=vm.createContext({console,Date,localStorage:{getItem:()=>null,setItem(){}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../js/data.js'),'utf8'),context);
  const s=JSON.parse(vm.runInContext('JSON.stringify(seed())',context));
  for(const key of ['plots','cycles','tasks','projects','stock','sales','trials','equipment','workers'])s[key]=[];
  const id='integrity-qa';
  s.plots=[{id,name:'แปลงทดสอบความถูกต้อง',sizeRai:1,crop:'พืชตัวอย่าง',status:'active',lat:'',lng:''}];
  s.cycles=[{id,plotId:id,plant:'พืชตัวอย่าง',round:1,status:'active',startDate:'2026-11-01'}];
  s.projects=[{id,code:'PRJ-QA-INTEGRITY',name:'ทดสอบซิงก์และต้นทุน',kind:'work',entryMode:'proposal',objective:'ตรวจด้วยข้อมูลสมมติเท่านั้น',plotId:id,cycleId:id,status:'active',stages:[{id:'stage',name:'ดำเนินงาน'}],trialIds:[],records:[],events:[],reportVersions:[],attachments:[],proposal:{budget:500}}];
  s.stock=[{id,name:'ปุ๋ยตัวอย่าง QA',category:'ปุ๋ยเคมี',unit:'กก.',packageSize:'1 กก.',qty:10,openQty:0,avgCost:50}];
  s.tasks=[{id:'planned-material',title:'ใส่ปุ๋ยเพื่อทดสอบ',type:'fertilize',status:'planned',date:'2026-11-28',projectId:id,projectStageId:'stage',plotId:id,cycleId:id,planTracked:true,cost:100,revenue:0,costItems:[{category:'fertilizer',name:'ปุ๋ยตัวอย่าง QA',stockId:id,stockMode:'package',qty:2,unit:'กก.',unitCost:50,totalCost:100}],stockState:'reserved',stockLog:[],photos:[],donePhotos:[]}];
  for(let i=1;i<=7;i++)s.tasks.push({id:'missing-'+i,title:'ข้อมูลขาดตัวอย่าง '+i,type:'spray',status:'done',date:'',doneDate:'',projectId:id,projectStageId:'stage',plotId:id,cycleId:id,source:'project-history',dataStatus:'pending',missingFields:['วันที่','ปริมาณ'],cost:0,revenue:0,qty:null,costItems:[{name:'วัสดุไม่ทราบปริมาณ '+i,category:'chemical',qty:null,unit:'',totalCost:0,supported:true}],stockState:'untracked',stockLog:[],photos:[],donePhotos:[]});
  return s;
}
module.exports={buildFixture};
