'use strict';
const {fields,payerField,validPayer,validTeam,payerList,payersOf,text,imageType,normalize}=require('../js/wallet-lark-read.js');
const {create}=require('../js/wallet-image-cache.js');
const {readConfig}=require('./wallet-config.cjs');
// Credentials and transport identities isolate tests and independent connections.
const attachmentConnections=new WeakMap();
function connection(env,fetcher){
  let byEnv=attachmentConnections.get(fetcher);if(!byEnv){byEnv=new WeakMap();attachmentConnections.set(fetcher,byEnv);}
  let c=byEnv.get(env);if(!c){c={pending:new Map(),images:create({ttl:300000})};byEnv.set(env,c);}return c;
}
// Independent of the legacy bidirectional sync, which can write/delete records.
async function readRecords(env,fetcher,selectedFields,payerId,team,withToken=false){
  const {target}=readConfig(env);
  if(team===null?!validPayer(payerId):!validTeam(team))throw new Error('Invalid team or payer scope');
  if(!env.LARK_APP_ID||!env.LARK_APP_SECRET)throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Lark ฝั่งเซิร์ฟเวอร์');
  const signal=AbortSignal.timeout(45000);
  async function request(path,body,token){
    const response=await fetcher('https://open.larksuite.com/open-apis'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal});
    const data=await response.json();
    if(!response.ok||data.code!==0)throw new Error('Lark ปฏิเสธการอ่านข้อมูล ('+(Number(data.code)||response.status)+')');
    return data;
  }
  const auth=await request('/auth/v3/tenant_access_token/internal',{app_id:env.LARK_APP_ID,app_secret:env.LARK_APP_SECRET});
  if(!auth.tenant_access_token)throw new Error('ยืนยันการเชื่อมต่อ Lark ไม่สำเร็จ');
  let page='',records=[];const pages=new Set();
  do{
    if(pages.has(page))throw new Error('Lark ส่งหน้าข้อมูลซ้ำ');pages.add(page);
    const result=await request(`/bitable/v1/apps/${target.app}/tables/${target.table}/records/search?page_size=500&user_id_type=open_id${page?'&page_token='+encodeURIComponent(page):''}`,{
      field_names:selectedFields,filter:{conjunction:'and',conditions:[...(team===null?[]:[{field_name:'ทีม/แผนก',operator:'is',value:[team]}]),...(payerId?[{field_name:payerField,operator:'is',value:[payerId]}]:[])]}
    },auth.tenant_access_token);
    const data=result.data;if(!data||!Array.isArray(data.items))throw new Error('ข้อมูลจาก Lark ไม่ครบ');
    records.push(...data.items);if(records.length>10000)throw new Error('ข้อมูลเกินขอบเขตการทดลอง 10,000 รายการ');
    page=data.has_more?data.page_token:'';if(data.has_more&&!page)throw new Error('ข้อมูลจาก Lark ขาดหน้าถัดไป');
  }while(page);
  return withToken?{records,token:auth.tenant_access_token}:records;
}
async function readExpenses(env=process.env,fetcher=fetch,payerId,team){
  if(!validPayer(payerId))throw new Error('เลือกผู้จ่ายก่อนอ่านรายจ่าย');
  const {target}=readConfig(env);if(team===undefined)team=target.team;
  if(team!==null&&!validTeam(team))throw new Error('Invalid team');
  const records=await readRecords(env,fetcher,fields,payerId,team);
  return {source:{...target,team,payerId},expenses:normalize(records,payerId,team),fetchedAt:new Date().toISOString()};
}
async function readPayers(env=process.env,fetcher=fetch,payerId,team=readConfig(env).target.team){
  const {target}=readConfig(env);
  if(payerId!==undefined&&!validPayer(payerId))throw new Error('ผู้จ่ายไม่ถูกต้อง');
  if(team===null?!validPayer(payerId):!validTeam(team))throw new Error('Invalid team or payer scope');
  const records=await readRecords(env,fetcher,['ทีม/แผนก',payerField],payerId,team);
  const scoped=records.filter(r=>!payerId||payersOf(r).some(p=>p.id===payerId));
  const result=team===null?{payers:[...new Map(scoped.flatMap(payersOf).filter(p=>p.id===payerId).map(p=>[p.id,p])).values()],unassigned:0}:payerList(scoped,team);
  return {...result,payers:payerId?result.payers.filter(p=>p.id===payerId):result.payers,source:{...target,team}};
}
async function readAttachment(env=process.env,fetcher=fetch,payerId,recordId,index,expectedFile,team=readConfig(env).target.team){
  const {target}=readConfig(env);
  if(!validPayer(payerId)||!/^rec[A-Za-z0-9]+$/.test(recordId)||!Number.isInteger(index)||index<0||index>500)throw new Error('ข้อมูลอ้างอิงรูปไม่ถูกต้อง');
  if(team!==null&&!validTeam(team))throw new Error('Invalid team');
  const c=connection(env,fetcher),scope=JSON.stringify([target.app,target.table,team,payerId]);
  if(!c.pending.has(scope))c.pending.set(scope,readRecords(env,fetcher,['ทีม/แผนก',payerField,'หลักฐานแนบ'],payerId,team,true).finally(()=>c.pending.delete(scope)));
  const {records:rows,token}=await c.pending.get(scope);
  const row=rows.find(r=>r.record_id===recordId&&(team===null||text(r.fields?.['ทีม/แผนก'])===team)&&payersOf(r).some(p=>p.id===payerId));
  const file=row?.fields?.['หลักฐานแนบ']?.[index];
  if(!file||file.file_token!==expectedFile||!imageType(file.type)||!/^[A-Za-z0-9]+$/.test(file.file_token))throw new Error('รูปของรายการนี้เปลี่ยนแล้วหรือไม่มีสิทธิ์อ่าน กรุณาอัปเดตข้อมูล');
  const limit=10*1024*1024;if(file.size>limit)throw new Error('รูปใหญ่เกิน 10 MB กรุณาเปิดใน Lark');
  // Revalidate current record membership before consulting the image cache.
  return c.images.get([scope,recordId,index,expectedFile].join(':'),async()=>{
  const signal=AbortSignal.timeout(30000),base='https://open.larksuite.com/open-apis';
  const response=await fetcher(base+'/drive/v1/medias/'+file.file_token+'/download',{headers:{Authorization:'Bearer '+token},redirect:'error',signal});
  if(!response.ok)throw new Error('Lark ไม่อนุญาตให้อ่านรูป กรุณาเปิดหลักฐานใน Lark');
  const type=(response.headers.get('content-type')||'').split(';')[0];if(!imageType(type))throw new Error('ไฟล์นี้ไม่ใช่รูปที่แสดงได้');
  if(Number(response.headers.get('content-length'))>limit)throw new Error('รูปใหญ่เกิน 10 MB');
  const reader=response.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('รูปใหญ่เกิน 10 MB');}chunks.push(Buffer.from(value));}
  return {type,bytes:Buffer.concat(chunks)};
  });
}
module.exports={readExpenses,readPayers,readAttachment};
