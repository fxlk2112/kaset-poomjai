// Collector APIs never return an owner's state. All projections are explicit allowlists.
import stockLogic from '../../js/data.js';
import applicationRate from '../../js/application-rate.js';
export const TEAM_TYPES = ['inspect','work','water','spray','fertilize','harvest','trial'];
const checks = {growth:['ปกติ','โตช้า','ไม่สม่ำเสมอ'],condition:['ไม่พบอาการผิดปกติ','พบอาการ'],pests:['ไม่พบ','พบ'],weeds:['ไม่พบ','พบ'],moisture:['แห้ง','ชื้น','แฉะ','มีน้ำขัง']};
const fail = message => { throw new Error(message); };
const text = (v,max=500) => String(v ?? '').trim().slice(0,max);
const parse = s => JSON.parse(s || '{}');
const today = () => new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d;
const id = v => /^[a-zA-Z0-9_-]{1,100}$/.test(v || '') ? v : fail('รหัสไม่ถูกต้อง');
const hash = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');
// A valid transparent image keeps existing image renderers compatible while the
// client resolves this private reference through an authenticated API call.
export const TEAM_PHOTO_PREFIX='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#team-photo=';
const photoId=v=>typeof v==='string' && v.startsWith(TEAM_PHOTO_PREFIX) && /^[a-f0-9]{64}$/.test(v.slice(TEAM_PHOTO_PREFIX.length))?v.slice(TEAM_PHOTO_PREFIX.length):null;
const stateRow = async (db,owner) => await db.prepare('SELECT data, updated_at FROM user_data WHERE user_id=?').bind(owner).first() || fail('เจ้าของยังไม่มีข้อมูลบนคลาวด์');
const metricKind = m => ['count','positive','number'].includes(m.valueKind)?m.valueKind:/จำนวน|นับ|แมลง|count|insect/i.test(m.name || '') || /^(ตัว|ต้น|ใบ|ผล)(\/|$)/.test(m.unit || '')?'count':'number';
const metrics = tr => (tr.metrics?.length?tr.metrics:[{id:'legacy_metric',name:tr.metric || 'ผลผลิต',unit:tr.metricUnit || 'กก.'}]).map((m,i)=>({...m,id:m.id || 'metric_'+i,name:m.name || (i===0?tr.metric:'') || 'ตัวชี้วัด',unit:m.unit || (i===0?tr.metricUnit:'') || 'หน่วย'}));
function number(v,kind='positive') {
  if(v===null || v===undefined || (typeof v==='string' && !v.trim()))return null;
  if(typeof v!=='number' && typeof v!=='string')fail('ค่าวัดต้องเป็นตัวเลข');
  const n=Number(v);
  if(!Number.isFinite(n) || Math.abs(n)>1e9 || (kind!=='number' && n<0) || (kind==='count' && !Number.isInteger(n)))fail('ค่าวัดไม่ถูกต้อง จำนวนที่นับต้องเป็นจำนวนเต็มตั้งแต่ 0');
  return n;
}
const packageUnits={ml:{factor:1,family:'volume'},l:{factor:1000,family:'volume'},g:{factor:1,family:'mass'},kg:{factor:1000,family:'mass'}};
function packageUnitKey(unit){const key=String(unit||'').trim().toLowerCase().replace(/\.+$/,'');return ({'ซีซี':'ml','cc':'ml','มล':'ml','มิลลิลิตร':'ml','ml':'ml','ลิตร':'l','litre':'l','liter':'l','l':'l','กรัม':'g','gram':'g','g':'g','กก':'kg','กิโลกรัม':'kg','kg':'kg'})[key] || '';}
function packageContent(size){const match=String(size||'').trim().match(/^([\d.,]+)\s*([^\d\s].*)$/);if(!match)return null;const amount=Number(match[1].replace(/,/g,'')),unit=packageUnitKey(match[2]);return Number.isFinite(amount) && amount>0 && packageUnits[unit]?{amount,unit}:null;}
function contentUsage(row,stock){
  if(!Object.hasOwn(row,'usageQty') && !Object.hasOwn(row,'usageUnit'))return null;
  const pack=packageContent(stock.size);if(!pack || packageUnitKey(row.usageUnit)!==pack.unit)fail('ขนาดบรรจุของสินค้าไม่รองรับปริมาณที่ใช้จริง');
  const usageQty=number(row.usageQty);if(usageQty===null || usageQty<=0 || Math.abs(usageQty*1e4-Math.round(usageQty*1e4))>1e-6)fail('ปริมาณที่ใช้จริงไม่ถูกต้อง');
  const qty=usageQty/pack.amount;if(!Number.isFinite(qty) || qty<=0 || Math.abs(qty*1e4-Math.round(qty*1e4))>1e-6)fail('ปริมาณที่ใช้ละเอียดเกินขนาดบรรจุ กรุณาตรวจขนาดสินค้า');
  return {qty:Math.round(qty*1e4)/1e4,usageQty,usageUnit:pack.unit,packageSize:String(stock.size||''),stockMode:'content'};
}
function photos(values=[]) {
  if(!Array.isArray(values) || values.length>3)fail('แนบรูปได้ไม่เกิน 3 รูป');
  return values.map(v=>{
    if(photoId(v))return v;
    if(typeof v!=='string' || v.length>150000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v))fail('รูปไม่ถูกต้องหรือใหญ่เกินไป');
    return v;
  });
}
function checkedScope(state,p){
  if(!Array.isArray(p.plots) || p.plots.length>200 || !Array.isArray(p.types) || p.types.length>TEAM_TYPES.length)fail('ขอบเขตสิทธิ์ไม่ถูกต้อง');
  const scope={plots:[...new Set(p.plots)],types:[...new Set(p.types)]};
  if(!scope.plots.length || scope.plots.some(id=>!(state.plots || []).some(x=>x.id===id && x.status!=='inactive')) || !scope.types.length || scope.types.some(t=>!TEAM_TYPES.includes(t)))fail('เลือกแปลงและประเภทงานให้ถูกต้อง');
  return scope;
}
async function storePhotos(env,values,g,sid){
  const refs=[];
  for(const value of values){
    let pid=photoId(value);
    if(pid){
      const row=await env.DB.prepare('SELECT id FROM team_photos WHERE id=? AND owner_id=? AND member_id=? AND grant_id=? AND submission_id=?').bind(pid,g.owner_id,g.member_id,g.id,sid).first();
      if(!row)fail('รูปนี้ไม่ใช่ของรายการที่ส่ง');
    }else{
      if(!env.PHOTOS)fail('พื้นที่เก็บรูปยังไม่พร้อม รายการยังไม่ถูกส่ง');
      const match=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(value);
      const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0)),ct=match[1];
      const signature=ct==='image/jpeg'?bytes[0]===255 && bytes[1]===216 && bytes[2]===255:ct==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
      if(!signature)fail('ข้อมูลรูปไม่ตรงกับชนิดไฟล์');
      pid=await hash(JSON.stringify([g.owner_id,g.id,sid,value]));
      const key='team-private/'+pid;
      const exists=await env.DB.prepare('SELECT id FROM team_photos WHERE id=?').bind(pid).first();
      if(!exists){
        await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:ct}});
        await env.DB.prepare("INSERT OR IGNORE INTO team_photos(id,owner_id,member_id,grant_id,submission_id,object_key,content_type,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM team_grants WHERE id=? AND status='active' AND revision=?)").bind(pid,g.owner_id,g.member_id,g.id,sid,key,ct,Date.now(),g.id,g.revision).run();
      }
    }
    refs.push(TEAM_PHOTO_PREFIX+pid);
  }
  return refs;
}
export function teamContext(state,scope) {
  const plots=(state.plots || []).filter(p=>scope.plots.includes(p.id) && p.status!=='inactive').map(p=>({id:p.id,name:p.name}));
  const allowed=new Set(plots.map(p=>p.id));
  // Sampling layouts can span real plots even when the trial has one parent plot.
  const unitPlot=(u,t)=>{
    if(u.plotId)return u.plotId;
    if(u.physicalPlot){const matches=(state.plots || []).filter(p=>p.name===u.physicalPlot);return matches.length===1?matches[0].id:null;}
    return t.plotId;
  };
  return {plots,types:scope.types,
    materials:scope.types.some(t=>['spray','fertilize'].includes(t))?(state.stock || []).filter(x=>x.status!=='inactive' && x.name && x.unit).map(x=>({id:x.id,name:x.name,unit:x.unit,size:String(x.size || '')})):[],
    cycles:(state.cycles || []).filter(c=>allowed.has(c.plotId) && c.status==='active').map(c=>({id:c.id,plotId:c.plotId,plant:c.plant,round:c.round,startDate:c.startDate})),
    trials:scope.types.includes('trial')?(state.trials || []).filter(t=>t.status==='active').map(t=>({id:t.id,name:t.name,startDate:t.startDate,sampling:t.collectionMode==='sampling',sampleCount:Math.max(1,Math.min(100,Number(t.sampleCount)||3)),
      metrics:metrics(t).map(m=>({id:m.id,name:m.name,unit:m.unit,kind:metricKind(m)})),
      units:(t.units || []).filter(u=>allowed.has(unitPlot(u,t))).map(u=>({id:u.id,plotId:unitPlot(u,t),label:[(t.treatments || []).find(x=>x.id===u.treatmentId)?.code,u.sectionName || u.section || u.label,t.collectionMode!=='sampling' && (u.block || u.rep)?'บล็อก '+(u.block || u.rep):'',u.order?'ลำดับ '+u.order:''].filter(Boolean).join(' · ')}))})).filter(t=>t.units.length):[]};
}
export function cleanSubmission(raw,context) {
  if(!raw || typeof raw!=='object')fail('ข้อมูลไม่ถูกต้อง');
  if(!context.types.includes(raw.type) || !context.plots.some(p=>p.id===raw.plotId))fail('ไม่มีสิทธิ์บันทึกแปลงหรือประเภทนี้');
  if(!validDate(raw.date) || raw.date>today())fail('วันที่บันทึกไม่ถูกต้องหรืออยู่ในอนาคต');
  if(!['done','failed'].includes(raw.workStatus))fail('กรุณาระบุผลการทำงาน');
  const cycle=context.cycles.find(c=>c.id===raw.cycleId && c.plotId===raw.plotId);
  if(!cycle || raw.date<cycle.startDate)fail('รอบปลูกไม่ถูกต้อง หรือวันที่ก่อนเริ่มปลูก');
  const out={type:raw.type,plotId:raw.plotId,cycleId:cycle.id,date:raw.date,workStatus:raw.workStatus,title:text(raw.title,160),note:text(raw.note,3000),photos:photos(raw.photos)};
  if(!out.title)fail('กรุณากรอกชื่องาน');
  if(raw.type==='water'){
    const minutes=number(raw.wateringMinutes,'count');
    if(minutes!==null && (minutes<1 || minutes>1440))fail('ระยะเวลารดน้ำต้องเป็นจำนวนเต็ม 1-1440 นาที');
    out.wateringMinutes=minutes;
  }
  if(raw.materials?.length && !['spray','fertilize'].includes(raw.type))fail('รายการวัสดุใช้ได้เฉพาะฉีดยาหรือใส่ปุ๋ย');
  if(['spray','fertilize'].includes(raw.type)){
    const work=applicationRate.cleanWork(raw.applicationWork);
    if(Object.keys(work).length)out.applicationWork=work;
    if(!Array.isArray(raw.materials || []) || (raw.materials || []).length>20)fail('เพิ่มรายการได้ไม่เกิน 20 รายการ');
    const used=new Set();
    out.materials=(raw.materials || []).map(row=>{
      if(!row || typeof row!=='object' || Array.isArray(row))fail('รายการยาไม่ถูกต้อง');
      const rateFields=applicationRate.materialFields(row);
      if(raw.workStatus==='done')applicationRate.estimate(row,work);
      if(row.source==='external'){
        const qty=number(row.qty);
        if(qty===null || qty<=0 || Math.abs(qty*1e4-Math.round(qty*1e4))>1e-6)fail('จำนวนใช้ต้องมากกว่า 0 และมีทศนิยมไม่เกิน 4 ตำแหน่ง');
        if(row.stockId || typeof row.name!=='string' || typeof row.unit!=='string' || row.name.length>160 || row.unit.length>40)fail('รายการนอกสต็อกไม่ถูกต้อง');
        const name=text(row.name,160),unit=text(row.unit,40);
        if(!name || !unit)fail('กรอกชื่อและหน่วยของรายการนอกสต็อก');
        const key='external:'+JSON.stringify([name.normalize('NFKC').toLowerCase(),unit.normalize('NFKC').toLowerCase()]);
        if(used.has(key))fail('รายการซ้ำ กรุณารวมจำนวนไว้ในแถวเดียว');used.add(key);
        return {source:'external',name,unit,qty,...rateFields};
      }
      if(row.source && row.source!=='stock')fail('ประเภทแหล่งสินค้าไม่ถูกต้อง');
      const stock=context.materials?.find(x=>x.id===row.stockId);
      if(!stock)fail('รายการที่เลือกใช้ไม่ได้แล้ว กรุณาโหลดรายการใหม่');
      if(row.unit && row.unit!==stock.unit)fail('หน่วยสินค้าเปลี่ยนแล้ว กรุณาเลือกรายการใหม่');
      if(used.has(stock.id))fail('รายการซ้ำ กรุณารวมจำนวนไว้ในแถวเดียว');used.add(stock.id);
      const content=contentUsage(row,stock);
      if(content)return {stockId:stock.id,name:stock.name,unit:stock.unit,...content,...rateFields};
      const qty=number(row.qty);
      if(qty===null || qty<=0 || Math.abs(qty*1e4-Math.round(qty*1e4))>1e-6)fail('จำนวนใช้ต้องมากกว่า 0 และมีทศนิยมไม่เกิน 4 ตำแหน่ง');
      return {stockId:stock.id,name:stock.name,unit:stock.unit,qty,...rateFields};
    });
  }
  if(raw.type==='inspect') {
    out.checks={};
    for(const [key,options] of Object.entries(checks)) {
      const value=text(raw.checks?.[key],80);
      if(value && !options.includes(value))fail('ผลตรวจไม่ถูกต้อง');
      out.checks[key]=value;
    }
    if(!Array.isArray(raw.points || []) || (raw.points || []).length>100)fail('จำนวนจุดไม่ถูกต้อง');
    out.points=(raw.points || []).map((p,i)=>{
      const q={label:text(p.label,80)||'จุด '+(i+1),heightCm:number(p.heightCm),examinedPlants:number(p.examinedPlants,'count'),pestCount:number(p.pestCount,'count'),affectedPlants:number(p.affectedPlants,'count'),pestName:text(p.pestName,150),symptomName:text(p.symptomName,150),photos:[]};
      if(q.affectedPlants!==null && q.examinedPlants!==null && q.affectedPlants>q.examinedPlants)fail('ต้นที่มีอาการมากกว่าต้นที่ตรวจ');
      return q;
    });
    if(out.workStatus==='done' && !Object.values(out.checks).some(Boolean) && !out.points.some(p=>['heightCm','examinedPlants','pestCount','affectedPlants'].some(k=>p[k]!==null)) && !out.note && !out.photos.length)fail('ยังไม่มีผลตรวจ เลือกผลตรวจอย่างน้อยหนึ่งหัวข้อ');
  }
  if(raw.type==='trial') {
    const tr=context.trials.find(t=>t.id===raw.trialId), unit=tr?.units.find(u=>u.id===raw.unitId && u.plotId===raw.plotId), metric=tr?.metrics.find(m=>m.id===raw.metricId);
    if(!tr || !unit || !metric || raw.date<tr.startDate)fail('งานทดลอง แปลงย่อย หรือตัวชี้วัดไม่ถูกต้อง');
    if(out.workStatus!=='done')fail('ผลทดลองต้องมีค่าวัด ใช้กิจกรรมทั่วไปสำหรับงานที่ไม่สำเร็จ');
    out.trialId=tr.id;out.unitId=unit.id;out.metricId=metric.id;
    if(tr.sampling) {
      if(!Array.isArray(raw.samples) || raw.samples.length!==tr.sampleCount)fail('จำนวนจุดสุ่มไม่ตรงกับแผน');
      out.samples=raw.samples.map(v=>number(v,metric.kind));
      const used=out.samples.filter(v=>v!==null);if(!used.length)fail('กรอกค่าวัดอย่างน้อยหนึ่งจุด');
      out.value=used.reduce((a,b)=>a+b,0)/used.length;
    } else {out.value=number(raw.value,metric.kind);if(out.value===null)fail('กรุณากรอกค่าวัด');}
  }
  return out;
}
export function applySubmission(state,record,context,memberName) {
  const p=cleanSubmission(parse(record.payload),context), key='team-'+record.id;
  const attribution={submissionId:record.id,memberId:record.member_id,name:memberName,submittedAt:record.updated_at,acceptedAt:Date.now()};
  if(p.type==='trial') {
    const tr=state.trials.find(t=>t.id===p.trialId), metric=metrics(tr).find(m=>m.id===p.metricId);
    tr.observations=tr.observations || [];
    if(tr.observations.some(o=>o.unitId===p.unitId && o.date===p.date && (o.metricId===metric.id || (!o.metricId && o.metric===metric.name))))fail('มีค่าวัดแปลงย่อยและวันนี้แล้ว กรุณาส่งกลับให้ตรวจสอบ ไม่ทับข้อมูลเดิม');
    tr.observations.push({id:key,unitId:p.unitId,metricId:metric.id,metric:metric.name,unit:metric.unit,date:p.date,value:p.value,...(p.samples?{samples:p.samples}:{}),note:p.note,photos:p.photos,createdAt:Date.now(),updatedAt:Date.now(),submittedBy:attribution});
  } else {
    state.tasks=state.tasks || [];if(state.tasks.some(t=>t.id===key))fail('รายการนี้รับเข้าแล้ว');
    const task={id:key,title:p.title,type:p.type,plotId:p.plotId,cycleId:p.cycleId,date:p.date,doneDate:p.date,status:p.workStatus,note:p.note,doneNote:p.note,photos:p.photos,cost:0,revenue:0,costItems:[],createdAt:Date.now(),submittedBy:attribution};
    if(p.type==='water' && p.wateringMinutes!==null){
      task.wateringSessions=[{period:'custom',start:'',minutes:p.wateringMinutes,zoneId:'',zone:'',method:'',areaRai:0,status:p.workStatus}];
    }
    if(p.materials?.length){
      task.reportedMaterials=p.materials;
      const stockMaterials=p.materials.filter(m=>m.source!=='external');
      if(p.workStatus==='done' && stockMaterials.length){
        task.stockState='reserved';
        task.costItems=stockMaterials.map(m=>{
          const stock=state.stock.find(x=>x.id===m.stockId),unitCost=Number(stock.avgCost);
          if(!Number.isFinite(unitCost) || unitCost<0)fail('กรุณาตรวจต้นทุนสินค้าก่อนรับรอง');
          const stockMode=m.stockMode==='content'?'content':'package';
          return {stockId:m.stockId,name:m.name,unit:m.unit,qty:m.qty,stockMode,usageQty:m.usageQty,usageUnit:m.usageUnit,packageSize:m.packageSize,category:p.type==='fertilize'?'fertilizer':'chemical',unitCost,totalCost:Math.round((stockMode==='package'?Math.ceil(m.qty):m.qty)*unitCost)};
        });
        stockLogic.prepareTaskStock(state,task);
      }
    }
    if(p.applicationWork)task.applicationWork=p.applicationWork;
    if(p.type==='inspect') {
      const c=context.cycles.find(c=>c.id===p.cycleId);
      task.inspection={version:1,observedDate:p.date,cycleId:c.id,plantingDate:c.startDate,plantName:c.plant,ageDays:Math.round((Date.parse(p.date)-Date.parse(c.startDate))/86400000),checks:Object.fromEntries(Object.entries(p.checks).map(([k,value])=>[k,{value,note:'',followUp:false}])),points:p.points,resolutions:[]};
    }
    state.tasks.push(task);
  }
  return state;
}
async function grant(db,grantId,user,owner=false) {
  const g=await db.prepare(`SELECT * FROM team_grants WHERE id=? AND ${owner?'owner_id':'member_id'}=?`).bind(id(grantId),user.user_id).first();
  if(!g || (!owner && g.status!=='active'))fail('ไม่มีสิทธิ์หรือสิทธิ์ถูกถอนแล้ว');
  return g;
}
const event = (db,sid,user,kind,payload) => db.prepare('INSERT INTO team_events(id,submission_id,actor_id,event,payload,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),sid,user.user_id,kind,JSON.stringify(payload),Date.now());
export async function teamAction(env,p,user) {
  const db=env.DB, now=Date.now();
  if(p.action==='team_photo_get'){
    if(!/^[a-f0-9]{64}$/.test(p.id || ''))fail('รหัสรูปไม่ถูกต้อง');
    const photo=await db.prepare('SELECT * FROM team_photos WHERE id=?').bind(p.id).first();
    if(!photo || (photo.owner_id!==user.user_id && photo.member_id!==user.user_id))fail('ไม่มีสิทธิ์ดูรูป');
    const sub=await db.prepare('SELECT * FROM team_submissions WHERE id=?').bind(photo.submission_id).first();
    const payload=sub?parse(sub.payload):null;
    if(!payload?.photos?.includes(TEAM_PHOTO_PREFIX+photo.id))fail('ไม่พบรูปในรายการ');
    if(photo.owner_id!==user.user_id){
      const g=await grant(db,photo.grant_id,user),scope=parse(g.scopes);
      if(!scope.plots.includes(payload.plotId) || !scope.types.includes(payload.type))fail('ไม่มีสิทธิ์ดูรูปของแปลงนี้');
    }
    const object=await env.PHOTOS?.get(photo.object_key);if(!object || object.size>120000)fail('ไม่พบรูปหรือรูปใหญ่เกินไป');
    const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
    return {src:'data:'+photo.content_type+';base64,'+btoa(binary)};
  }
  if(p.action==='team_update'){
    const g=await grant(db,p.grantId,user,true);if(g.status==='revoked')fail('สิทธิ์นี้ถูกถอนแล้ว กรุณาสร้างคำเชิญใหม่');
    const scope=checkedScope(parse((await stateRow(db,user.user_id)).data),p);
    const r=await db.prepare("UPDATE team_grants SET scopes=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND status IN ('active','invited')").bind(JSON.stringify(scope),g.id,user.user_id,p.revision).run();
    if(!r.meta.changes)fail('สิทธิ์ถูกแก้จากอีกหน้าจอแล้ว กรุณาโหลดใหม่');
    return {id:g.id,revision:g.revision+1};
  }
  if(p.action==='team_renew_invite') {
    const g=await grant(db,p.grantId,user,true);
    if(g.status!=='invited')fail('สร้างลิงก์ใหม่ได้เฉพาะสมาชิกที่ยังไม่รับคำเชิญ');
    if(!Number.isSafeInteger(p.revision) || p.revision!==g.revision)fail('คำเชิญเปลี่ยนแล้ว กรุณาโหลดรายชื่อใหม่');
    const token=crypto.randomUUID()+crypto.randomUUID(),expiresAt=now+7*86400000;
    const r=await db.prepare("UPDATE team_grants SET invite_hash=?,expires_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND status='invited'").bind(await hash(token),expiresAt,g.id,user.user_id,p.revision).run();
    if(!r.meta.changes)fail('คำเชิญเปลี่ยนแล้ว กรุณาโหลดรายชื่อใหม่');
    return {id:g.id,invite:token,expiresAt,revision:g.revision+1};
  }
  if(p.action==='team_invite') {
    const email=text(p.email,254).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email===user.email.toLowerCase())fail('กรุณาระบุอีเมลของผู้บันทึก');
    const state=parse((await stateRow(db,user.user_id)).data);
    const scope=checkedScope(state,p);
    const token=crypto.randomUUID()+crypto.randomUUID(), gid=crypto.randomUUID();
    await db.prepare('INSERT INTO team_grants(id,owner_id,email,scopes,invite_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(gid,user.user_id,email,JSON.stringify(scope),await hash(token),now+7*86400000,now).run();
    return {id:gid,invite:token,expiresAt:now+7*86400000};
  }
  if(p.action==='team_accept') {
    if(typeof p.invite!=='string' || p.invite.length>150)fail('ลิงก์เชิญไม่ถูกต้อง');
    const g=await db.prepare("UPDATE team_grants SET member_id=?,status='active',invite_hash=NULL,revision=revision+1 WHERE invite_hash=? AND email=? AND status='invited' AND expires_at>? RETURNING id").bind(user.user_id,await hash(p.invite),user.email.toLowerCase(),now).first();
    if(!g)fail('ลิงก์หมดอายุ ใช้แล้ว หรืออีเมลไม่ตรงกับคำเชิญ');
    return g;
  }
  if(p.action==='team_revoke') {
    const g=await grant(db,p.grantId,user,true);
    await db.prepare("UPDATE team_grants SET status='revoked',invite_hash=NULL,revision=revision+1 WHERE id=? AND owner_id=?").bind(g.id,user.user_id).run();
    return {revoked:true};
  }
  if(p.action==='team_members') {
    const offset=Number.isSafeInteger(p.offset) && p.offset>=0?p.offset:0;
    const r=await db.prepare('SELECT id,email,member_id,scopes,status,revision,expires_at,created_at FROM team_grants WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 200 OFFSET ?').bind(user.user_id,offset).all();return r.results;
  }
  if(p.action==='team_assignments') {
    const r=await db.prepare("SELECT g.id,u.name AS owner_name FROM team_grants g JOIN users u ON u.id=g.owner_id WHERE g.member_id=? AND g.status='active' ORDER BY g.created_at DESC").bind(user.user_id).all();return r.results;
  }
  if(p.action==='team_counts'){
    return (await db.prepare('SELECT status,COUNT(*) AS count FROM team_submissions WHERE owner_id=? GROUP BY status').bind(user.user_id).all()).results;
  }
  if(p.action==='team_context') {
    const g=await grant(db,p.grantId,user);return teamContext(parse((await stateRow(db,g.owner_id)).data),parse(g.scopes));
  }
  if(p.action==='team_sent' || p.action==='team_inbox') {
    const owner=p.action==='team_inbox';
    if(!owner)await grant(db,p.grantId,user);
    const offset=Number.isSafeInteger(p.offset) && p.offset>=0?p.offset:0;
    const status=['pending','returned','approved'].includes(p.status)?p.status:null;
    const args=owner?[user.user_id]:[user.user_id,p.grantId];if(status)args.push(status);args.push(offset);
    const r=await db.prepare(`SELECT s.*,u.name AS member_name FROM team_submissions s JOIN users u ON u.id=s.member_id WHERE s.${owner?'owner_id':'member_id'}=? ${owner?'':'AND s.grant_id=?'} ${status?'AND s.status=?':''} ORDER BY ${owner?"CASE s.status WHEN 'pending' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END,":''} s.updated_at DESC,s.id LIMIT 100 OFFSET ?`).bind(...args).all();return r.results;
  }
  if(p.action==='team_submit') {
    const g=await grant(db,p.grantId,user), sid=id(p.id);
    const context=teamContext(parse((await stateRow(db,g.owner_id)).data),parse(g.scopes));
    const cleaned=cleanSubmission(p.payload,context);
    cleaned.photos=await storePhotos(env,cleaned.photos,g,sid);
    const payload=JSON.stringify(cleaned);
    const existing=await db.prepare('SELECT * FROM team_submissions WHERE id=?').bind(sid).first();
    if(existing) {
      if(existing.member_id!==user.user_id || existing.grant_id!==g.id)fail('รหัสรายการซ้ำ');
      if(existing.payload===payload && existing.status!=='returned')return {id:sid,status:existing.status,revision:existing.revision};
      if(existing.status==='approved')fail('รายการนี้รับรองแล้ว ไม่สามารถแก้ไขได้');
      if(!['pending','returned'].includes(existing.status) || existing.revision!==p.revision)fail('รายการเปลี่ยนไปแล้ว กรุณาโหลดรายการล่าสุดก่อนแก้ไข');
    }
    const guard="EXISTS(SELECT 1 FROM team_grants WHERE id=? AND member_id=? AND status='active' AND revision=?)";
    const statement=existing?db.prepare(`UPDATE team_submissions SET payload=?,status='pending',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status=? AND ${guard}`).bind(payload,now,sid,p.revision,existing.status,g.id,user.user_id,g.revision):db.prepare(`INSERT INTO team_submissions(id,grant_id,owner_id,member_id,payload,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(sid,g.id,g.owner_id,user.user_id,payload,now,now,g.id,user.user_id,g.revision);
    // Only log the version actually written, including retries and concurrent revocations.
    const audit=db.prepare("INSERT INTO team_events(id,submission_id,actor_id,event,payload,created_at) SELECT ?,id,?,'submit',payload,? FROM team_submissions WHERE id=? AND revision=? AND updated_at=? AND changes()=1").bind(crypto.randomUUID(),user.user_id,now,sid,existing?existing.revision+1:1,now);
    const result=await db.batch([statement,audit]);if(!result[0].meta.changes)fail('สิทธิ์หรือรายการเปลี่ยนไปแล้ว กรุณาโหลดใหม่');
    return {id:sid,status:'pending',revision:existing?existing.revision+1:1};
  }
  if(p.action==='team_history') {
    const s=await db.prepare('SELECT id FROM team_submissions WHERE id=? AND owner_id=?').bind(id(p.id),user.user_id).first();if(!s)fail('ไม่มีสิทธิ์');
    return (await db.prepare('SELECT event,payload,created_at FROM team_events WHERE submission_id=? ORDER BY created_at').bind(s.id).all()).results;
  }
  if(p.action==='team_review') {
    const s=await db.prepare('SELECT * FROM team_submissions WHERE id=? AND owner_id=?').bind(id(p.id),user.user_id).first();
    if(!s || s.status!=='pending' || s.revision!==p.revision)fail('รายการเปลี่ยนไปแล้ว กรุณาโหลดใหม่');
    if(p.decision==='return') {
      const note=text(p.note,1000);if(!note)fail('ระบุสิ่งที่ต้องแก้ไข');
      const result=await db.batch([db.prepare("UPDATE team_submissions SET status='returned',review_note=?,revision=revision+1,reviewed_at=?,updated_at=? WHERE id=? AND owner_id=? AND status='pending' AND revision=?").bind(note,now,now,s.id,user.user_id,s.revision),db.prepare("INSERT INTO team_events(id,submission_id,actor_id,event,payload,created_at) SELECT ?,id,?,'return',?,? FROM team_submissions WHERE id=? AND revision=? AND reviewed_at=? AND changes()=1").bind(crypto.randomUUID(),user.user_id,JSON.stringify({note}),now,s.id,s.revision+1,now)]);
      if(!result[0].meta.changes)fail('รายการเปลี่ยนไปแล้ว');return {status:'returned'};
    }
    if(p.decision!=='approve')fail('คำสั่งไม่ถูกต้อง');
    const g=await grant(db,s.grant_id,user,true);if(g.status!=='active')fail('ผู้ส่งถูกถอนสิทธิ์แล้ว ไม่รับเข้าข้อมูลฟาร์ม');
    const row=await stateRow(db,user.user_id), state=parse(row.data), context=teamContext(state,parse(g.scopes));
    const submitted=parse(s.payload);
    if(submitted.workStatus==='done' && submitted.materials?.some(m=>m.source!=='external') && p.confirmMaterials!==true)fail('กรุณาตรวจรายการและยืนยันการตัดสต็อก');
    const member=await db.prepare('SELECT name FROM users WHERE id=?').bind(s.member_id).first();
    const compact=parse(s.payload);compact.photos=await storePhotos(env,photos(compact.photos),g,s.id);s.payload=JSON.stringify(compact);
    applySubmission(state,s,context,member?.name || 'ผู้บันทึก');
    const nonce=crypto.randomUUID();state.teamCommit=nonce;
    const data=JSON.stringify(state);if(data.length>900000)fail('พื้นที่ข้อมูลเต็ม กรุณาจัดการก่อนรับข้อมูลเพิ่ม');
    const revision=Math.max(now,row.updated_at+1);
    // CAS plus a transaction marker links approval and owner state in one D1 transaction.
    const result=await db.batch([
      db.prepare("UPDATE user_data SET data=?,updated_at=? WHERE user_id=? AND updated_at=? AND EXISTS(SELECT 1 FROM team_submissions WHERE id=? AND status='pending' AND revision=?) AND EXISTS(SELECT 1 FROM team_grants WHERE id=? AND status='active' AND revision=?)").bind(data,revision,user.user_id,row.updated_at,s.id,s.revision,g.id,g.revision),
      db.prepare("UPDATE team_submissions SET payload=?,status='approved',revision=revision+1,reviewed_at=?,updated_at=? WHERE id=? AND owner_id=? AND status='pending' AND revision=? AND EXISTS(SELECT 1 FROM user_data WHERE user_id=? AND updated_at=? AND json_extract(data,'$.teamCommit')=?)").bind(s.payload,now,now,s.id,user.user_id,s.revision,user.user_id,revision,nonce),
      db.prepare("INSERT INTO team_events(id,submission_id,actor_id,event,payload,created_at) SELECT ?,id,?,'approve',?,? FROM team_submissions WHERE id=? AND status='approved' AND revision=? AND reviewed_at=? AND EXISTS(SELECT 1 FROM user_data WHERE user_id=? AND json_extract(data,'$.teamCommit')=?)").bind(crypto.randomUUID(),user.user_id,JSON.stringify({recordId:'team-'+s.id}),now,s.id,s.revision+1,now,user.user_id,nonce)
    ]);
    if(!result[0].meta.changes || !result[1].meta.changes)fail('มีข้อมูลใหม่เข้ามา กรุณาโหลดแล้วตรวจรับอีกครั้ง');
    return {status:'approved',updated_at:revision};
  }
  fail('ไม่รู้จักคำสั่งทีมงาน');
}
