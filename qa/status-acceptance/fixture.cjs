// Dedicated synthetic acceptance records; never modify imported worksheet records.
function appendAcceptance(s){
  const id='status-qa-20261128';
  if((s.projects||[]).some(p=>p.id===id))throw Error('Acceptance fixture already exists');
  s.plots.push({id,name:'QA มือถือและสต็อก',sizeRai:1,crop:'พืชทดสอบ',lat:'',lng:'',active:true});
  s.cycles.push({id,plotId:id,plant:'พืชทดสอบ',round:1,status:'active',startDate:'2026-11-01'});
  s.projects.push({id,code:'PRJ-QA-MOBILE',name:'QA มือถือ PDF สลิป สต็อก',kind:'work',entryMode:'proposal',objective:'ทดสอบการบันทึกและยอดด้วยข้อมูลสมมติ',plotId:id,cycleId:id,status:'active',stages:[{id:id+'-stage',name:'ตรวจระบบ'}],startDate:'2026-11-01',endDate:'2026-12-31',createdAt:1,trialIds:[],reportVersions:[],records:[],events:[],proposal:{budget:1000,rationale:'ใช้ข้อมูลสมมติตรวจการทำงานของระบบ',method:'บันทึกงาน ตรวจปริมาณและต้นทุน แล้วโหลดกลับ',targets:'บันทึกเดียว ยอดตรงกันทุกหน้า',resources:'วัสดุทดสอบและค่าแรงสมมติ',scope:'บัญชี QA เท่านั้น'},conclusion:'ข้อมูลสมมติสำหรับทดสอบระบบ ไม่ใช่ผลดำเนินงานจริง'});
  s.stock.push({id,name:'ปุ๋ย QA ทดสอบระบบ',category:'ปุ๋ยเคมี',unit:'กก.',packageSize:'1 กก.',qty:10,openQty:0,avgCost:50,salePrice:80,minQty:0});
  for(const [suffix,title,status,type]of [['done','QA ตรวจข้อมูลก่อนเริ่ม','done','work'],['failed','QA งานไม่สำเร็จ','failed','work'],['fertilize','QA ใส่ปุ๋ยจากมือถือ','planned','fertilize']])s.tasks.push({id:id+'-'+suffix,title,status,type,date:'2026-11-28',doneDate:status==='planned'?'':'2026-11-28',projectId:id,projectStageId:id+'-stage',plotId:id,cycleId:id,planTracked:true,source:'project-draft',cost:0,revenue:0,costItems:[],photos:[],donePhotos:[],stockLog:[],stockState:'none',createdAt:1});
  return s;
}
module.exports={appendAcceptance};
