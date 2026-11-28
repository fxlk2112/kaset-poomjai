/* A batch is a draft of canonical activities, never a second cost ledger. */
'use strict';
const BATCH_WORK_TYPES={work:'งานทั่วไป',fertilize:'ใส่ปุ๋ย',spray:'ฉีดยา',water:'รดน้ำ',expense:'ค่าใช้จ่าย'};
const BATCH_WORK_COLUMNS={skip:'ไม่ใช้คอลัมน์นี้',date:'วันที่',title:'ชื่องาน',type:'ประเภทงาน',material:'วัสดุ / รายการ',qty:'ปริมาณ',unit:'หน่วย',amount:'ค่าวัสดุ / รายการ (บาท)',labor:'ค่าแรง (บาท)',supported:'ของสนับสนุน',note:'หมายเหตุ',group:'รหัสงานในชุด'};
function batchWorkClone(value){return JSON.parse(JSON.stringify(value));}
function batchWorkText(value){return String(value??'').trim().replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-3664));}
function batchWorkNumber(value,label,positive=false){
  const raw=batchWorkText(value).replace(/^฿\s*/,'').replace(/\s*บาท$/,'');
  if(!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(raw))throw Error('ระบุ'+label+'เป็นตัวเลข'+(positive?'มากกว่า 0':'ตั้งแต่ 0 (ไม่เว้นว่าง)'));
  const n=Number(raw.replace(/,/g,''));
  if(!Number.isFinite(n)||n>1e9||(positive?n<=0:n<0))throw Error('ตรวจ'+label+'อีกครั้ง');
  return n;
}
function batchWorkDate(value){
  const raw=batchWorkText(value);let y,m,d;
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(match)[,y,m,d]=match;
  else if((match=raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)))[,d,m,y]=match;
  else if(/^\d{5}$/.test(raw)&&Number(raw)>=20000&&Number(raw)<=80000){const date=new Date(Date.UTC(1899,11,30)+Number(raw)*86400000);return date.toISOString().slice(0,10);}
  else throw Error('ใช้วันที่ วว/ดด/ปปปป หรือ ปปปป-ดด-วว');
  y=Number(y);if(y>=2400)y-=543;m=Number(m);d=Number(d);
  const date=new Date(Date.UTC(y,m-1,d));
  if(y<1900||y>2100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error('วันที่ไม่ถูกต้อง');
  return date.toISOString().slice(0,10);
}
function batchWorkReadCells(text){
  if(typeof text!=='string'||text.length>100000)throw Error('วางได้ไม่เกิน 100,000 ตัวอักษรต่อครั้ง');
  const delimiter=text.includes('\t')?'\t':',',rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'&&(quoted||!cell)){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==delimiter){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}}
    else cell+=c;
  }
  if(quoted)throw Error('เครื่องหมายคำพูดในข้อมูลยังปิดไม่ครบ');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(!rows.length)throw Error('ยังไม่มีข้อมูลที่วาง');
  if(rows.length>101||rows.some(r=>r.length>25))throw Error('รองรับไม่เกิน 100 แถว และ 25 คอลัมน์ต่อครั้ง');
  if(rows.some(r=>r.some(v=>/^\s*[=+@]/.test(v))))throw Error('วางเป็นค่าเท่านั้น ไม่รับสูตรจากชีต');
  return rows;
}
function batchWorkGuessColumns(cells){
  const aliases={date:['วันที่','วันที่ทำจริง','date'],title:['ชื่องาน','งาน','กิจกรรม','title','task'],type:['ประเภท','ประเภทงาน','ประเภทกิจกรรม','type'],material:['วัสดุ','ยา','ปุ๋ย','ชื่อยา','รายการ','วัสดุ / รายการ','material'],qty:['ปริมาณ','จำนวน','ปริมาณที่ใช้','qty','quantity'],unit:['หน่วย','unit'],amount:['ค่าวัสดุ','ราคา','ค่าใช้จ่าย','จ่ายจริง','ค่าวัสดุ / รายการ (บาท)','amount','cost'],labor:['ค่าแรง','ค่าแรง (บาท)','labor'],supported:['ของสนับสนุน','สนับสนุน','supported'],note:['หมายเหตุ','note'],group:['รหัสงาน','รหัสงานในชุด','group']};
  const map=cells[0].map(v=>Object.keys(aliases).find(k=>aliases[k].includes(batchWorkText(v).toLowerCase()))||'skip');
  return {header:map.includes('title')&&map.includes('date'),map};
}
function batchWorkBlankItem(type='work'){return {source:'external',name:'',qty:'',unit:'',amount:'',category:type==='spray'?'chemical':type==='fertilize'?'fertilizer':type==='expense'?'other':'materials',stockId:''};}
function batchWorkBlankRow(date=todayISO()){return {id:uid(),date,title:'',type:'work',items:[batchWorkBlankItem()],labor:'',note:'',allowDuplicate:false};}
function batchWorkHasInput(row){return !!(batchWorkText(row.title)||batchWorkText(row.labor)||batchWorkText(row.note)||(row.items||[]).some(i=>i.source!=='external'||[i.name,i.stockId,i.qty,i.unit,i.amount].some(v=>batchWorkText(v))));}
function batchWorkPasteRows(cells,mapping,hasHeader){
  const selected=mapping.filter(k=>k!=='skip');
  if(new Set(selected).size!==selected.length)throw Error('เลือกแต่ละคอลัมน์เพียงครั้งเดียว');
  if(!selected.includes('date')||!selected.includes('title'))throw Error('จับคู่วันที่และชื่องานก่อน');
  const input=cells.slice(hasHeader?1:0),groups=new Map(),out=[];
  if(!input.length||input.length>100)throw Error('เลือกข้อมูล 1–100 แถว');
  input.forEach((cells,index)=>{
    const v={};mapping.forEach((key,i)=>{if(key!=='skip')v[key]=batchWorkText(cells[i]);});
    const type=Object.keys(BATCH_WORK_TYPES).find(k=>k===v.type||BATCH_WORK_TYPES[k]===v.type)||(v.type==='งานประจำ'?'work':v.type==='ใช้ยา'?'spray':v.type?'': 'work');
    if(!type)throw Error('แถว '+(index+1)+': เลือกประเภทงานที่รองรับ (งานเก็บเกี่ยวใช้แบบบันทึกเดิม)');
    if(!v.title)throw Error('แถว '+(index+1)+': ระบุชื่องาน');
    let date;try{date=batchWorkDate(v.date);}catch(e){throw Error('แถว '+(index+1)+': '+e.message);}
    if(v.supported&&!['ใช่','ได้รับสนับสนุน','สนับสนุน','yes','true','1','ไม่','ไม่ใช่','no','false','0'].includes(v.supported.toLowerCase()))throw Error('แถว '+(index+1)+': ของสนับสนุนใช้ ใช่ / ไม่ใช่');
    const item={...batchWorkBlankItem(type),name:v.material||'',qty:v.qty||'',unit:v.unit||'',amount:v.amount||'',source:['ใช่','ได้รับสนับสนุน','สนับสนุน','yes','true','1'].includes((v.supported||'').toLowerCase())?'supported':'external'};
    if(item.source==='supported'&&item.amount&&batchWorkNumber(item.amount,'ค่าวัสดุ')!==0)throw Error('แถว '+(index+1)+': ของสนับสนุนต้องไม่มียอดจ่าย');
    const hasItem=item.name||item.qty||item.unit||item.amount||item.source==='supported';
    let row=v.group?groups.get(v.group):null;
    if(row){
      if(row.date!==date||row.title!==v.title||row.type!==type)throw Error('รหัสงาน '+v.group+': วันที่ ชื่องาน และประเภทต้องตรงกัน');
      if(v.labor&&row.labor&&batchWorkNumber(v.labor,'ค่าแรง')!==batchWorkNumber(row.labor,'ค่าแรง'))throw Error('รหัสงาน '+v.group+': ค่าแรงต่อหนึ่งงานต้องตรงกัน หรือกรอกครั้งเดียว');
      if(v.labor)row.labor=v.labor;
      if(hasItem)row.items.push(item);
      if(v.note&&!row.note.split('\n').includes(v.note))row.note=[row.note,v.note].filter(Boolean).join('\n');
    }else{
      row={...batchWorkBlankRow(date),title:v.title,type,items:hasItem?[item]:[],labor:v.labor||'',note:v.note||'',importGroup:v.group||''};out.push(row);if(v.group)groups.set(v.group,row);
    }
    if(row.items.length>20)throw Error('หนึ่งงานมีวัสดุได้ไม่เกิน 20 รายการ');
  });
  return out;
}
function batchWorkItem(state,input){
  const name=batchWorkText(input.name),source=input.source||'external';
  if(source==='external'&&!name&&!input.stockId&&!batchWorkText(input.qty)&&!batchWorkText(input.amount)&&!batchWorkText(input.unit))return null;
  if(!['external','supported','stock'].includes(source))throw Error('เลือกแหล่งวัสดุ');
  const category=input.category||'materials';
  if(!['chemical','fertilizer','seed','materials','other'].includes(category))throw Error('เลือกหมวดค่าใช้จ่าย');
  const material=category!=='other',stock=source==='stock'?stockById(state,input.stockId):null;
  if(source==='stock'&&!stock)throw Error('เลือกวัสดุจากคลัง');
  if(!name&&!stock)throw Error('ระบุชื่อวัสดุหรือค่าใช้จ่าย');
  if(name.length>150)throw Error('ชื่อรายการยาวเกิน 150 ตัวอักษร');
  const needsQty=material||stock||batchWorkText(input.qty)||batchWorkText(input.unit);
  const qty=needsQty?batchWorkNumber(input.qty,'ปริมาณ',true):0,unit=batchWorkText(input.unit);
  if(needsQty&&(!unit||unit.length>30))throw Error('ระบุหน่วยของปริมาณ');
  if(source==='supported'){
    if(!material)throw Error('ของสนับสนุนใช้กับรายการวัสดุ');
    if(batchWorkText(input.amount)&&batchWorkNumber(input.amount,'ยอดจ่าย')!==0)throw Error('ของสนับสนุนต้องมียอดจ่าย 0 บาท');
    return {category,name,qty,unit,stockId:null,source:'external',...materialSupportFields({funding:'supported',sponsor:input.sponsor||''})};
  }
  if(stock){
    const unitKey=v=>batchWorkText(v).toLowerCase().replace(/\.+$/,'');let packages,packageSize;
    if(unitKey(unit)===unitKey(stock.unit)){packages=qty;}
    else if(sizeFamily(unit)&&sizeFamily(unit)===sizeFamily(stock.unit)){packages=qty*unitToBase(unit)/unitToBase(stock.unit);}
    else {const pack=parseStockSize(stock.size);if(!pack||!sizeFamily(unit)||sizeFamily(unit)!==sizeFamily(pack.unit))throw Error('หน่วยไม่ตรงกับขนาดบรรจุในคลัง');packageSize=pack.amount*unitToBase(pack.unit)/unitToBase(unit);packages=qty/packageSize;}
    const exact=packages;packages=rndQty(packages);
    if(packages<=0||Math.abs(exact-packages)>Math.max(1e-8,Math.abs(exact)*0.001))throw Error('ปริมาณเล็กเกินความละเอียดของคลัง กรุณาตรวจหน่วย');
    const unitCost=batchWorkNumber(stock.avgCost,'ต้นทุนต่อหน่วยในคลัง');
    const item={category,name:stock.name,source:'stock',stockId:stock.id,stockMode:'content',qty:packages,unit:stock.unit,usageQty:qty,usageUnit:unit,packageSize,unitCost,priceMode:'cost'};
    item.totalCost=taskMaterialCost(item,stock);return item;
  }
  const amount=Math.round(batchWorkNumber(input.amount,'ค่าใช้จ่าย')*100)/100;
  return {category,name,qty,unit,stockId:null,source:'external',stockMode:'record',externalPriceMode:'total',externalTotal:amount,totalCost:amount,unitCost:qty?amount/qty:0};
}
function batchWorkFingerprint(t){
  const normalize=s=>batchWorkText(s).replace(/\s+/g,' ').toLowerCase();
  const items=(t.costItems||[]).map(i=>{const unit=i.usageUnit||i.unit||'',qty=Number(i.usageUnit?i.usageQty:i.qty)||0;return [normalize(i.name),i.category||'other',i.stockId||'',i.funding||'',sizeFamily(unit)||normalize(unit),Math.round(qty*unitToBase(unit)*1e6)/1e6,Math.round((Number(i.totalCost)||0)*100)];}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify([t.plotId||'',t.cycleId||'',taskRecordDate(t),normalize(t.title),t.type,items,Math.round((Number(t.cost)||0)*100)]);
}
function batchWorkContext(state,draft){
  const c=draft.context||{},plot=(state.plots||[]).find(x=>x.id===c.plotId),cycle=(state.cycles||[]).find(x=>x.id===c.cycleId),project=(state.projects||[]).find(x=>x.id===c.projectId);
  if(!plot||plot.active===false)throw Error('เลือกแปลงที่เปิดใช้งาน');
  if(c.cycleId!=='__none__'&&(!cycle||cycle.plotId!==plot.id||cycle.status!=='active'))throw Error('เลือกรอบปลูกที่เปิดอยู่ หรือต้นทุนรวมแปลง');
  if(c.projectId&&(!project||project.status==='done'||(project.plotId&&project.plotId!==plot.id)||(project.cycleId&&project.cycleId!==cycle?.id)))throw Error('โครงการต้องเปิดอยู่และตรงกับแปลง / รอบปลูก');
  if(project&&!(project.stages||[]).some(s=>s.id===c.stageId))throw Error('เลือกขั้นตอนในโครงการ');
  return {plotId:plot.id,cycleId:cycle?.id||null,projectId:project?.id||null,projectStageId:project?c.stageId:null,scope:'plot'};
}
function batchWorkPlan(state,draft){
  const context=batchWorkContext(state,draft),staged=batchWorkClone(state),details=[],errors=[],duplicates=[],seen=new Map();
  if(!draft.id||!Array.isArray(draft.rows)||!draft.rows.length||draft.rows.length>100)throw Error('เพิ่มงาน 1–100 แถวก่อนตรวจ');
  const ids=new Set();
  for(const [index,row] of draft.rows.entries()){
    try{
      if(!row.id||ids.has(row.id))throw Error('รหัสแถวซ้ำ กรุณาสร้างแถวใหม่');ids.add(row.id);
      const date=batchWorkDate(row.date),title=batchWorkText(row.title);
      if(date>todayISO())throw Error('วันที่ทำจริงต้องไม่เป็นอนาคต');
      if(!title||title.length>150)throw Error('ระบุชื่องานไม่เกิน 150 ตัวอักษร');
      if(!BATCH_WORK_TYPES[row.type])throw Error('เลือกประเภทงาน');
      if(!Array.isArray(row.items)||row.items.length>20)throw Error('หนึ่งงานมีวัสดุได้ไม่เกิน 20 รายการ');
      const items=row.items.map(it=>batchWorkItem(state,it)).filter(Boolean);
      const itemKeys=items.map(it=>batchWorkFingerprint({costItems:[it]}));
      if(new Set(itemKeys).size!==itemKeys.length)throw Error('มีรายการวัสดุ / ค่าใช้จ่ายตรงกันซ้ำในงานนี้ ตรวจและรวมปริมาณก่อน');
      if(batchWorkText(row.labor)!==''){const amount=Math.round(batchWorkNumber(row.labor,'ค่าแรง')*100)/100;items.push({name:'ค่าแรง',category:'labor',projectEntryExpense:true,qty:0,unit:'',externalPriceMode:'total',externalTotal:amount,totalCost:amount});}
      const error=taskMaterialReviewError(row.type,items.length>0,items);if(error)throw Error(error);
      const task={...context,title,type:row.type,date,doneDate:date,status:'done',source:'batch-work',entryBatchId:draft.id,entryRowId:row.id,costItems:items,cost:Math.round(items.reduce((n,it)=>n+it.totalCost,0)*100)/100,note:String(row.note||'').slice(0,4000),revenue:0,photos:[],donePhotos:[],planTracked:false};
      const fingerprint=batchWorkFingerprint(task),prior=(state.tasks||[]).find(t=>t.entryBatchId===draft.id&&t.entryRowId===row.id);
      if(prior){if(prior.entryFingerprint!==fingerprint)throw Error('แถวนี้บันทึกแล้ว หากต้องแก้ให้เปิดจากประวัติ');details.push({index,task:prior,already:true});continue;}
      const matches=(state.tasks||[]).filter(t=>t.status==='done'&&batchWorkFingerprint(t)===fingerprint);
      if((matches.length||seen.has(fingerprint))&&!row.allowDuplicate){duplicates.push({index,message:matches.length?'มีงานตรงกันในประวัติแล้ว':'ตรงกับแถว '+(seen.get(fingerprint)+1)+' ในชุดนี้'});}
      seen.set(fingerprint,index);task.entryFingerprint=fingerprint;
      const created=addTask(staged,task);details.push({index,task:created,already:false});
    }catch(e){errors.push({index,message:e.message});}
  }
  const stocks=state.stock.filter(before=>{const after=stockById(staged,before.id);return after&&(before.qty!==after.qty||before.openQty!==after.openQty);}).map(before=>({id:before.id,name:before.name,unit:before.unit,before:Number(before.qty)||0,after:Number(stockById(staged,before.id).qty)||0,openBefore:Number(before.openQty)||0,openAfter:Number(stockById(staged,before.id).openQty)||0}));
  const total=Math.round(details.filter(r=>!r.already).reduce((n,r)=>n+Number(r.task.cost),0)*100)/100;
  const signature=JSON.stringify({context,rows:details.map(r=>[r.task.entryFingerprint,r.already]),stocks,total});
  return {staged,details,errors,duplicates,stocks,total,signature,valid:!errors.length&&!duplicates.length};
}
function batchWorkCommit(state,draft,persist,expectedSignature){
  const plan=batchWorkPlan(state,draft);
  if(!plan.valid)throw Error('ตรวจแถวที่ผิดหรือซ้ำก่อนยืนยัน');
  if(expectedSignature&&expectedSignature!==plan.signature)throw Error('ข้อมูลหรือต้นทุนเปลี่ยน กรุณาตรวจรายการอีกครั้ง');
  if(plan.details.some(r=>!r.already)){
    if(persist(plan.staged)===false)throw Error('เก็บข้อมูลไม่สำเร็จ ร่างยังอยู่ กรุณาลองใหม่');
    Object.assign(state,plan.staged);
  }
  return plan;
}
function batchWorkCopyRow(task,state){
  const row={...batchWorkBlankRow(),title:task.title,type:BATCH_WORK_TYPES[task.type]?task.type:'work',note:task.note||'',items:[],copiedFrom:task.id};
  const items=task.costItems||[];
  let labor=0,hasLabor=false;
  for(const item of items){
    if(item.category==='labor'){labor+=Number(item.totalCost)||0;hasLabor=true;continue;}
    const stock=item.stockId?stockById(state,item.stockId):null;
    row.items.push({source:stock?'stock':materialIsSupported(item)?'supported':'external',stockId:stock?.id||'',name:item.name||stock?.name||'',category:['chemical','fertilizer','seed','materials'].includes(item.category)?item.category:'other',qty:item.usageUnit?item.usageQty:item.qty??'',unit:item.usageUnit||item.unit||'',amount:item.amountPending?'':item.totalCost??'',sponsor:item.sponsor||''});
  }
  if(!items.length&&Number(task.cost)>0)row.items.push({...batchWorkBlankItem(),category:'other',name:'ค่าใช้จ่ายจากงานเดิม',amount:task.cost});
  if(hasLabor)row.labor=String(Math.round(labor*100)/100);
  return row;
}

function batchWorkButton(context={}){return `<button type="button" class="btn btn-outline bw-entry-link" onclick="BatchWork.open(${esc(JSON.stringify(context))})">${typeof ic==='function'?ic('table'):''} บันทึกหลายรายการ</button>`;}
function batchWorkOptions(values,selected){return values.map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`).join('');}
const BatchWork={
  draft:null,owner:'',step:'edit',review:null,issues:[],duplicates:[],receipt:null,busy:false,panel:'',pasteRaw:'',pasteCells:null,pasteMap:[],pasteHeader:true,message:'',returnRoute:null,
  clearTransient(){this.step='edit';this.review=null;this.receipt=null;this.issues=[];this.duplicates=[];this.panel='';this.pasteRaw='';this.pasteCells=null;this.pasteMap=[];this.pasteHeader=true;this.message='';},
  key(){return 'farmult-batch-work-v1::'+String(typeof Auth!=='undefined'?Auth.session?.email||'local':'local').toLowerCase();},
  read(){try{const d=JSON.parse(localStorage.getItem(this.key()));return d?.version===1&&d.id&&d.context&&Array.isArray(d.rows)&&d.rows.length<=100&&d.rows.every(r=>r.id&&Array.isArray(r.items)&&r.items.length<=20)?d:null;}catch(_){return null;}},
  fresh(context={}){const c={plotId:'',cycleId:'',projectId:'',stageId:'',...context},p=(S.projects||[]).find(p=>p.id===c.projectId);if(p){c.plotId=p.plotId||c.plotId;c.cycleId=p.cycleId||c.cycleId;c.stageId=p.stages?.length===1?p.stages[0].id:c.stageId;}if(c.plotId&&!c.cycleId){const cycles=S.cycles.filter(x=>x.plotId===c.plotId&&x.status==='active');if(cycles.length===1)c.cycleId=cycles[0].id;else if(!cycles.length)c.cycleId='__none__';}return {version:1,id:uid(),context:c,rows:[batchWorkBlankRow()]};},
  open(context={}){
    if(typeof Auth!=='undefined'&&Auth.shareMode)return;
    this.clearTransient();this.returnRoute={...route};this.owner=this.key();this.draft=this.read()||this.fresh(context);this.message=this.read()?'เปิดร่างที่เก็บไว้ในเครื่องนี้แล้ว':'';route.view='batchWork';render();
  },
  persist(){
    if(!this.draft||this.owner!==this.key()||this.receipt)return false;
    try{localStorage.setItem(this.owner,JSON.stringify(this.draft));const el=document.getElementById('bwDraftStatus');if(el)el.textContent='เก็บร่างในเครื่องแล้ว · ยังไม่ลงต้นทุน';return true;}
    catch(_){const el=document.getElementById('bwDraftStatus');if(el)el.textContent='เก็บร่างไม่ได้ กรุณาอย่าปิดหน้านี้';return false;}
  },
  render(){render();},
  back(){if(!this.receipt&&!this.persist()){toast('เก็บร่างไม่สำเร็จ กรุณาอย่าเพิ่งปิด');return;}Object.assign(route,this.returnRoute||{view:'planner'});if(route.view==='batchWork')route.view='planner';render();},
  newBatch(){const go=()=>{this.draft=this.fresh(this.draft?.context);this.clearTransient();this.persist();this.render();};if(this.receipt)return go();App.confirm('เริ่มชุดใหม่?','ร่างชุดนี้จะถูกแทนที่ ข้อมูลที่บันทึกแล้วไม่เปลี่ยน',go);},
  context(key,value){
    const c=this.draft.context;c[key]=value;
    if(key==='plotId'){c.cycleId='';c.projectId='';c.stageId='';const cycles=S.cycles.filter(x=>x.plotId===value&&x.status==='active');if(cycles.length===1)c.cycleId=cycles[0].id;else if(!cycles.length)c.cycleId='__none__';}
    if(key==='cycleId'){c.projectId='';c.stageId='';}
    if(key==='projectId'){const p=(S.projects||[]).find(x=>x.id===value);c.stageId=p?.stages?.length===1?p.stages[0].id:'';}
    this.review=null;this.issues=[];this.duplicates=[];this.draft.rows.forEach(r=>r.allowDuplicate=false);this.persist();this.render();
  },
  set(i,j,key,value){
    const row=this.draft.rows[i];if(!row)return;const target=j<0?row:row.items[j];if(!target)return;target[key]=value;
    row.allowDuplicate=false;this.review=null;this.issues=this.issues.filter(x=>x.index!==i);
    if(key==='type'){row.items.filter(it=>!it.name&&!it.stockId).forEach(it=>it.category=batchWorkBlankItem(value).category);}
    if(key==='source'){target.stockId='';if(value==='supported')target.amount='0';}
    if(key==='stockId'){const s=stockById(S,value);if(s){target.name=s.name;target.unit=parseStockSize(s.size)?.unit||s.unit;target.amount='';}}
    this.persist();if(['type','source','stockId','category'].includes(key)){const open=document.getElementById('bwMore'+i)?.open;this.render();if(open)document.getElementById('bwMore'+i)?.setAttribute('open','');}else this.totals();
  },
  allow(i,checked){this.draft.rows[i].allowDuplicate=checked;this.persist();},
  addRow(){if(this.draft.rows.length>=100){toast('หนึ่งชุดมีได้ไม่เกิน 100 งาน');return;}this.draft.rows.push(batchWorkBlankRow(this.draft.rows.at(-1)?.date||todayISO()));this.persist();this.render();},
  remove(i){this.draft.rows.splice(i,1);this.issues=[];this.duplicates=[];this.persist();this.render();},
  addItem(i){const row=this.draft.rows[i];if(row.items.length>=20)return toast('หนึ่งงานมีได้ไม่เกิน 20 รายการ');row.items.push(batchWorkBlankItem(row.type));this.persist();this.render();document.getElementById('bwMore'+i)?.setAttribute('open','');},
  removeItem(i,j){this.draft.rows[i].items.splice(j,1);this.persist();this.render();document.getElementById('bwMore'+i)?.setAttribute('open','');},
  totals(){let sum=0,missing=0;this.draft.rows.forEach((r,i)=>{r.items.forEach((it,j)=>{const cell=document.getElementById('bwAmount'+i+'-'+j);if(cell&&it.source==='stock')cell.innerHTML=this.itemAmount(i,j,it);});let amount=0;for(const item of r.items)try{amount+=batchWorkItem(S,item)?.totalCost||0;}catch(_){missing++;}try{if(batchWorkText(r.labor))amount+=batchWorkNumber(r.labor,'ค่าแรง');}catch(_){missing++;}sum+=amount;const el=document.getElementById('bwTotal'+i);if(el)el.textContent=fmtMoney(amount)+' บาท';});const total=document.getElementById('bwTotal');if(total)total.textContent=fmtMoney(sum)+' บาท'+(missing?' · ยังต้องตรวจ '+missing+' รายการ':'');},
  showPanel(panel){this.panel=this.panel===panel?'':panel;this.render();},
  pasteInput(value){this.pasteRaw=value;this.pasteCells=null;const preview=document.getElementById('bwPastePreview');if(preview)preview.hidden=true;},
  pasteEvent(event){const text=event.clipboardData?.getData('text/plain');if(text?.includes('\t')){event.preventDefault();this.pasteRaw=text;this.panel='paste';this.analyze();}},
  analyze(){try{this.pasteCells=batchWorkReadCells(this.pasteRaw);const guess=batchWorkGuessColumns(this.pasteCells),width=Math.max(...this.pasteCells.map(r=>r.length));this.pasteHeader=guess.header;const order=['date','title','type','material','qty','unit','amount','labor','supported','note','group'];this.pasteMap=Array.from({length:width},(_,i)=>guess.header?guess.map[i]||'skip':order[i]||'skip');this.message='';this.render();}catch(e){this.message=e.message;this.render();}},
  pastePreview(){try{if(!this.pasteCells)throw Error('อ่านและจับคู่คอลัมน์อีกครั้งหลังแก้ข้อมูล');return {rows:batchWorkPasteRows(this.pasteCells,this.pasteMap,this.pasteHeader)};}catch(e){return {error:e.message};}},
  pasteApply(){
    const p=this.pastePreview();if(p.error)return toast(p.error);
    const existing=this.draft.rows.filter(batchWorkHasInput);
    if(existing.length+p.rows.length>100)return toast('รวมแล้วเกิน 100 งาน กรุณาแบ่งชุด');
    this.draft.rows=existing.concat(p.rows);this.panel='';this.pasteRaw='';this.pasteCells=null;this.message='เพิ่ม '+p.rows.length+' งานจากชีตแล้ว ตรวจปริมาณและค่าใช้จ่ายทุกแถว';this.issues=[];this.duplicates=[];this.persist();this.render();
  },
  candidates(){const c=this.draft.context;return S.tasks.filter(t=>t.status==='done'&&t.plotId===c.plotId&&(c.cycleId==='__none__'?!t.cycleId:t.cycleId===c.cycleId)&&BATCH_WORK_TYPES[t.type]).sort((a,b)=>taskRecordDate(b).localeCompare(taskRecordDate(a))).slice(0,30);},
  copyApply(){const selected=Array.from(document.querySelectorAll('[data-bw-copy]:checked')).map(el=>this.candidates()[Number(el.value)]).filter(Boolean);if(!selected.length)return toast('เลือกอย่างน้อย 1 งาน');const existing=this.draft.rows.filter(batchWorkHasInput);if(existing.length+selected.length>100)return toast('รวมแล้วเกิน 100 งาน');this.draft.rows=existing.concat(selected.map(t=>batchWorkCopyRow(t,S)));this.message='คัดลอกเป็นงานใหม่วันที่วันนี้แล้ว · ตรวจปริมาณและราคาจริงอีกครั้ง';this.panel='';this.persist();this.render();},
  edit(){this.step='edit';this.review=null;this.message='';this.render();},
  reviewAll(){
    try{if(this.owner!==this.key())throw Error('บัญชีเปลี่ยน กรุณาเปิดตารางใหม่');if(!this.persist())throw Error('เก็บร่างไม่สำเร็จ');const p=batchWorkPlan(S,this.draft);this.issues=p.errors;this.duplicates=p.duplicates;if(!p.valid){this.message='ตรวจแถวที่แจ้งก่อนยืนยัน';this.render();document.getElementById('bwIssues')?.focus();return;}this.review=p;this.step='review';this.message='';this.render();window.scrollTo({top:0,behavior:'instant'});}catch(e){this.message=e.message;this.render();}
  },
  save(){
    if(this.busy||this.receipt||this.step!=='review'||!document.getElementById('bwConfirm')?.checked)return;
    this.busy=true;const btn=document.getElementById('bwSave');if(btn)btn.disabled=true;
    try{
      if(this.owner!==this.key()||(typeof Auth!=='undefined'&&Auth.shareMode))throw Error('บัญชีเปลี่ยน กรุณาเปิดตารางใหม่');
      const plan=batchWorkCommit(S,this.draft,staged=>{const silent=typeof Auth!=='undefined'?Auth._silentLocalSave:false;try{if(typeof Auth!=='undefined')Auth._silentLocalSave=true;saveState(staged);return !storageSaveFailed;}finally{if(typeof Auth!=='undefined')Auth._silentLocalSave=silent;}},this.review.signature);
      if(plan.details.some(r=>!r.already)&&typeof Auth!=='undefined'&&Auth.session){setLocalDirty(true);Auth.queueSave();}
      this.receipt={count:plan.details.filter(r=>!r.already).length,already:plan.details.filter(r=>r.already).length,total:plan.total,ids:plan.details.map(r=>r.task.id)};
      try{localStorage.removeItem(this.owner);}catch(_){}this.message='';this.render();
    }catch(e){this.step='edit';this.review=null;this.message=e.message;this.render();}finally{this.busy=false;}
  },
  history(){const c=this.draft.context;if(c.projectId){App.projectOpen(c.projectId);return;}if(c.cycleId&&c.cycleId!=='__none__'){route.view='cycleDetail';route.cycleId=c.cycleId;cycleDetailTab='tasks';render();}else{App.nav('planner');App.plannerFilter('history');}},
  field(i,j,key,value,label,type='text',extra=''){return `<input type="${type}" value="${esc(value??'')}" aria-label="แถว ${i+1} ${j>0?'รายการ '+(j+1)+' ':''}${label}" ${extra} oninput="BatchWork.set(${i},${j},'${key}',this.value)">`;},
  itemName(i,j,item){return `<select aria-label="แถว ${i+1} รายการ ${j+1} แหล่งวัสดุ" onchange="BatchWork.set(${i},${j},'source',this.value)">${batchWorkOptions([['external','ซื้อ / ใช้นอกคลัง'],['stock','จากคลัง · ตัดตามใช้จริง'],['supported','ได้รับสนับสนุน · จ่าย 0']],item.source)}</select>${item.source==='stock'?`<select aria-label="แถว ${i+1} รายการ ${j+1} วัสดุจากคลัง" onchange="BatchWork.set(${i},${j},'stockId',this.value)">${batchWorkOptions([['','เลือกวัสดุ'],...S.stock.map(s=>[s.id,s.name+' · '+(s.size||s.unit||'')])],item.stockId)}</select>`:this.field(i,j,'name',item.name,'ชื่อวัสดุ / ค่าใช้จ่าย','text','maxlength="150" placeholder="ชื่อวัสดุหรือรายการ"')}`;},
  itemQty(i,j,item){return `${this.field(i,j,'qty',item.qty,'ปริมาณ','text','inputmode="decimal" placeholder="ปริมาณ"')}${this.field(i,j,'unit',item.unit,'หน่วย','text','list="bwUnits" placeholder="หน่วย" maxlength="30"')}`;},
  itemAmount(i,j,item){if(item.source==='supported')return '<strong class="bw-supported">0 บาท</strong><small>ได้รับสนับสนุน</small>';if(item.source==='stock'){try{return '<strong>'+fmtMoney(batchWorkItem(S,item)?.totalCost||0)+' บาท</strong><small>ราคาต้นทุนคลัง</small>';}catch(e){return '<small class="bw-error">'+esc(e.message)+'</small>';}}return this.field(i,j,'amount',item.amount,'ค่าวัสดุ / รายการ','text','inputmode="decimal" placeholder="ใส่ยอดรวม เช่น 300"');},
  rowHtml(row,i){const first=row.items[0],issues=this.issues.filter(e=>e.index===i),dup=this.duplicates.find(e=>e.index===i);return `<tr class="${issues.length||dup?'bw-invalid':''}"><td data-label="วันที่">${this.field(i,-1,'date',row.date,'วันที่ทำจริง','date','max="'+todayISO()+'"')}<small>งาน ${i+1}</small></td><td data-label="งาน">${this.field(i,-1,'title',row.title,'ชื่องาน','text','maxlength="150" placeholder="ทำอะไร"')}<select aria-label="แถว ${i+1} ประเภทงาน" onchange="BatchWork.set(${i},-1,'type',this.value)">${batchWorkOptions(Object.entries(BATCH_WORK_TYPES),row.type)}</select>${row.copiedFrom?'<small>คัดลอกจากงานเดิม · ตรวจค่าจริง</small>':''}</td><td data-label="วัสดุ / รายการ">${first?this.itemName(i,0,first):`<button class="btn btn-outline" onclick="BatchWork.addItem(${i})">เพิ่มวัสดุ</button>`}</td><td data-label="ปริมาณ / หน่วย">${first?this.itemQty(i,0,first):'—'}</td><td data-label="ค่าวัสดุ">${first?`<div id="bwAmount${i}-0">${this.itemAmount(i,0,first)}</div>`:'—'}</td><td data-label="ค่าแรงทั้งงาน">${this.field(i,-1,'labor',row.labor,'ค่าแรงทั้งงาน','text','inputmode="decimal" placeholder="ถ้ามี"')}<small id="bwTotal${i}">รวมงานนี้</small></td><td class="bw-remove"><button class="btn btn-ghost" aria-label="นำงานแถว ${i+1} ออกจากร่าง" onclick="BatchWork.remove(${i})">${ic('trash')}</button></td></tr><tr class="bw-row-detail"><td colspan="7"><details id="bwMore${i}" ${issues.length||dup?'open':''}><summary>วัสดุ ${row.items.length} รายการ · หมวดค่าใช้จ่าย / หมายเหตุ${issues.length?' · มีข้อมูลต้องตรวจ':''}</summary><div class="bw-item-list">${row.items.map((it,j)=>`<div class="bw-extra-item"><strong>รายการ ${j+1}</strong>${j?this.itemName(i,j,it)+this.itemQty(i,j,it)+'<div id="bwAmount'+i+'-'+j+'">'+this.itemAmount(i,j,it)+'</div>':''}<select aria-label="แถว ${i+1} รายการ ${j+1} หมวดค่าใช้จ่าย" onchange="BatchWork.set(${i},${j},'category',this.value)">${batchWorkOptions([['chemical','ยา / สาร'],['fertilizer','ปุ๋ย'],['seed','เมล็ดพันธุ์'],['materials','วัสดุ'],['other','ค่าใช้จ่ายอื่น']],it.category)}</select><button class="btn btn-ghost" onclick="BatchWork.removeItem(${i},${j})">นำรายการนี้ออก</button></div>`).join('')}<button class="btn btn-outline" onclick="BatchWork.addItem(${i})">+ วัสดุ / ค่าใช้จ่ายในงานนี้</button></div>${this.field(i,-1,'note',row.note,'หมายเหตุ','text','maxlength="4000" placeholder="หมายเหตุของงาน"')}${issues.map(e=>`<p class="bw-error">${esc(e.message)}</p>`).join('')}${dup?`<label class="bw-duplicate"><input type="checkbox" ${row.allowDuplicate?'checked':''} onchange="BatchWork.allow(${i},this.checked)">${esc(dup.message)} — ยืนยันว่าเป็นอีกงานหนึ่งที่ทำจริง</label>`:''}</details></td></tr>`;},
  pasteHtml(){const preview=this.pasteCells?this.pastePreview():null;return `<section class="card bw-panel"><h2>วางข้อมูลจากชีต</h2><p>คัดลอกเซลล์จาก Excel หรือ Google Sheets แล้ววางด้านล่าง · วันที่แบบไทย วัน/เดือน/ปี</p><textarea aria-label="ข้อมูลที่คัดลอกจากชีต" rows="4" maxlength="100000" placeholder="วันที่&#9;ชื่องาน&#9;ประเภทงาน&#9;วัสดุ&#9;ปริมาณ&#9;หน่วย&#9;ค่าวัสดุ&#9;ค่าแรง" oninput="BatchWork.pasteInput(this.value)">${esc(this.pasteRaw)}</textarea><button class="btn btn-outline" onclick="BatchWork.analyze()">อ่านและจับคู่คอลัมน์</button>${preview?`<div id="bwPastePreview"><label class="bw-inline"><input type="checkbox" ${this.pasteHeader?'checked':''} onchange="BatchWork.pasteHeader=this.checked;BatchWork.render()">แถวแรกเป็นหัวคอลัมน์</label><div class="bw-mapping">${this.pasteMap.map((key,i)=>`<label>คอลัมน์ ${i+1} · ${esc(this.pasteCells[0][i]||'ว่าง')}<select aria-label="จับคู่คอลัมน์ ${i+1}" onchange="BatchWork.pasteMap[${i}]=this.value;BatchWork.render()">${batchWorkOptions(Object.entries(BATCH_WORK_COLUMNS),key)}</select><small>${esc(this.pasteCells[this.pasteHeader?1:0]?.[i]||'—').slice(0,100)}</small></label>`).join('')}</div><p>ค่าวัสดุเป็นยอดรวมของแต่ละรายการ · ค่าแรงเป็นยอดของหนึ่งงาน · เว้นว่างค่าวัสดุหมายถึงยังไม่ทราบราคา</p><p>ถ้างานเดียวมีหลายวัสดุ ให้ใช้ <b>รหัสงานในชุด</b> เดียวกัน ค่าแรงที่ซ้ำกันในรหัสเดียวจะนับครั้งเดียว</p>${this.pasteMap.includes('skip')?'<p class="bw-warning">มีคอลัมน์ที่เลือกไม่ใช้ ตรวจการจับคู่ก่อนเพิ่มงาน</p>':''}${preview.error?`<p class="bw-error">${esc(preview.error)}</p>`:`<p>${this.pasteCells.length-(this.pasteHeader?1:0)} แถวจากชีต → <b>${preview.rows.length} งาน</b></p><ul>${preview.rows.slice(0,3).map(r=>`<li>${esc(dateLabel(r.date))} · ${esc(r.title)} · ${r.items.length} รายการวัสดุ</li>`).join('')}</ul><button class="btn btn-primary" onclick="BatchWork.pasteApply()">เพิ่ม ${preview.rows.length} งานลงตาราง</button>`}</div>`:''}</section>`;},
  copyHtml(){const tasks=this.candidates();return `<section class="card bw-panel"><h2>คัดลอกจากครั้งก่อน</h2><p>งานที่ทำแล้วของแปลงและรอบที่เลือก · ใช้วันที่วันนี้ · คัดลอกชื่อ วัสดุ ปริมาณ และค่าใช้จ่ายเป็นร่างให้ตรวจใหม่</p><p>รูป ผลทดลอง และสถานะตรวจรับคงอยู่กับงานต้นฉบับ</p><div class="bw-copy-list">${tasks.map((t,i)=>`<label><input type="checkbox" data-bw-copy value="${i}"><span><b>${esc(t.title)}</b><small>${esc(dateLabel(taskRecordDate(t)))} · ${fmtMoney(t.cost)} บาท · ${(t.costItems||[]).length} รายการ</small></span></label>`).join('')||'<p>ยังไม่มีงานที่คัดลอกได้ในแปลงและรอบที่เลือก</p>'}</div>${tasks.length?'<button class="btn btn-primary" onclick="BatchWork.copyApply()">เพิ่มงานที่เลือกลงตาราง</button>':''}</section>`;},
  reviewHtml(){const p=this.review;return `<section class="card bw-review"><h2>ตรวจปริมาณและต้นทุนก่อนยืนยัน</h2><p>งานใหม่ ${p.details.filter(r=>!r.already).length} งาน · บันทึกแล้ว ${p.details.filter(r=>r.already).length} งานที่ระบบจะข้าม</p>${p.details.map(r=>`<article><h3>${esc(r.task.title)} ${r.already?'<span class="bw-supported">บันทึกแล้ว</span>':''}</h3><small>${esc(dateLabel(r.task.date))} · ${esc(BATCH_WORK_TYPES[r.task.type])}</small><ul>${r.task.costItems.map(it=>`<li><span>${esc(it.name)} · ${it.category==='labor'?'ค่าแรง':it.category==='other'?'ค่าใช้จ่ายอื่น':esc(it.usageQty??it.qty)+' '+esc(it.usageUnit||it.unit)}${it.funding==='supported'?' · ได้รับสนับสนุน':''}</span><b>${fmtMoney(it.totalCost)} บาท</b></li>`).join('')||'<li>ไม่มีค่าใช้จ่าย</li>'}</ul><strong>รวม ${fmtMoney(r.task.cost)} บาท</strong></article>`).join('')}${p.stocks.length?`<h3>สต็อกที่จะเปลี่ยนเมื่อยืนยัน</h3><ul>${p.stocks.map(s=>`<li>${esc(s.name)} · สต็อกหลัก ${fmtNum(s.before)} → ${fmtNum(s.after)} ${esc(s.unit)} · ส่วนที่เปิด ${fmtNum(s.openBefore)} → ${fmtNum(s.openAfter)}</li>`).join('')}</ul>`:'<p>รายการชุดนี้ไม่ตัดสต็อก</p>'}<div class="bw-review-total">ค่าใช้จ่ายที่จะเพิ่ม <strong>${fmtMoney(p.total)} บาท</strong></div><label class="bw-inline"><input id="bwConfirm" type="checkbox" onchange="document.getElementById('bwSave').disabled=!this.checked">ตรวจปริมาณ ค่าใช้จ่าย และรายการซ้ำครบแล้ว</label><div class="bw-actions"><button class="btn btn-outline" onclick="BatchWork.edit()">กลับไปแก้ตาราง</button><button id="bwSave" class="btn btn-primary" disabled onclick="BatchWork.save()">ยืนยันบันทึก ${p.details.filter(r=>!r.already).length} งาน</button></div></section>`;}
};
function renderBatchWork(){
  if(BatchWork.owner!==BatchWork.key()||!BatchWork.draft){BatchWork.clearTransient();BatchWork.returnRoute=null;BatchWork.owner=BatchWork.key();BatchWork.draft=BatchWork.read()||BatchWork.fresh();}
  const b=BatchWork,c=b.draft.context,cycles=S.cycles.filter(x=>x.plotId===c.plotId&&x.status==='active'),projects=(S.projects||[]).filter(p=>p.status!=='done'&&(!p.plotId||p.plotId===c.plotId)&&(!p.cycleId||p.cycleId===c.cycleId)),p=projects.find(p=>p.id===c.projectId);
  setTimeout(()=>{const form=document.getElementById('bwForm');if(form&&typeof Auth!=='undefined'){Auth.formEditing=true;Auth._editingForm=form;}if(b.step==='edit'&&!b.receipt)b.totals();},0);
  const context=`<div class="bw-context"><label>แปลง<select aria-label="แปลงสำหรับชุดงาน" onchange="BatchWork.context('plotId',this.value)" ${b.step==='review'?'disabled':''}>${batchWorkOptions([['','เลือกแปลง'],...S.plots.filter(p=>p.active!==false).map(p=>[p.id,p.name])],c.plotId)}</select></label><label>รอบปลูก<select aria-label="รอบปลูกสำหรับชุดงาน" onchange="BatchWork.context('cycleId',this.value)" ${b.step==='review'?'disabled':''}>${batchWorkOptions([['','เลือกรอบปลูก'],...cycles.map(x=>[x.id,x.plant+' · รอบ '+x.round]),['__none__','ต้นทุนรวมแปลง (ไม่ผูกรอบ)']],c.cycleId)}</select></label><label>โครงการ (ไม่บังคับ)<select aria-label="โครงการสำหรับชุดงาน" onchange="BatchWork.context('projectId',this.value)" ${b.step==='review'?'disabled':''}>${batchWorkOptions([['','ไม่อยู่ในโครงการ'],...projects.map(x=>[x.id,(x.code||'')+' · '+x.name])],c.projectId)}</select></label>${p?`<label>ขั้นตอน<select aria-label="ขั้นตอนของชุดงาน" onchange="BatchWork.context('stageId',this.value)" ${b.step==='review'?'disabled':''}>${batchWorkOptions([['','เลือกขั้นตอน'],...p.stages.map(s=>[s.id,s.name])],c.stageId)}</select></label>`:''}</div>`;
  const html=`<div class="bw-page"><header class="bw-heading"><div><small>บันทึกงานที่ทำแล้ว</small><h1>บันทึกหลายรายการ</h1><p>หนึ่งแถวคือหนึ่งงาน · วัสดุหลายตัวอยู่ในงานเดียวกันได้</p></div><button class="btn btn-outline" onclick="BatchWork.back()">เก็บร่างและกลับ</button></header>${b.receipt?`<section class="card bw-receipt"><h2>บันทึกแล้ว ${b.receipt.count} งาน</h2><p>เพิ่มค่าใช้จ่าย ${fmtMoney(b.receipt.total)} บาท${b.receipt.already?' · ข้าม '+b.receipt.already+' งานที่บันทึกแล้ว':''}</p><p>ใช้บันทึกเดียวกันในประวัติแปลง รอบปลูก และโครงการ</p><button class="btn btn-primary" onclick="BatchWork.history()">ดูประวัติงาน</button><button class="btn btn-outline" onclick="BatchWork.newBatch()">เริ่มชุดใหม่</button></section>`:`<form id="bwForm" onsubmit="event.preventDefault();BatchWork.reviewAll()" onpaste="BatchWork.pasteEvent(event)">${context}<nav class="bw-steps" aria-label="ขั้นตอนบันทึกหลายรายการ"><span class="${b.step==='edit'?'active':''}">1 กรอกตาราง</span><span class="${b.step==='review'?'active':''}">2 ตรวจและยืนยัน</span><small id="bwDraftStatus">ร่าง · ยังไม่ลงต้นทุน</small></nav>${b.message?`<p id="bwIssues" class="bw-message" role="status" tabindex="-1">${esc(b.message)}</p>`:''}${b.step==='review'?b.reviewHtml():`<div class="bw-toolbar"><button type="button" class="btn btn-outline" onclick="BatchWork.showPanel('copy')">${ic('copy')} คัดลอกจากครั้งก่อน</button><button type="button" class="btn btn-outline" onclick="BatchWork.showPanel('paste')">${ic('clipboard')} วางจากชีต</button><button type="button" class="btn btn-ghost" onclick="BatchWork.newBatch()">เริ่มชุดใหม่</button></div>${b.panel==='paste'?b.pasteHtml():b.panel==='copy'?b.copyHtml():''}${b.issues.length||b.duplicates.length?`<div class="bw-warning" role="alert">${b.issues.concat(b.duplicates).map(e=>`<p>แถว ${e.index+1}: ${esc(e.message)}</p>`).join('')}</div>`:''}<datalist id="bwUnits"><option value="กก."><option value="กรัม"><option value="ลิตร"><option value="ซีซี"><option value="ขวด"><option value="ถุง"><option value="ชิ้น"></datalist><div class="bw-table-wrap" role="region" aria-label="ตารางกรอกงาน"><table class="bw-table"><thead><tr><th>วันที่ทำจริง</th><th>งาน</th><th>วัสดุ / ค่าใช้จ่าย</th><th>ปริมาณ / หน่วย</th><th>ค่าวัสดุ (บาท)</th><th>ค่าแรงทั้งงาน</th><th></th></tr></thead><tbody>${b.draft.rows.map((r,i)=>b.rowHtml(r,i)).join('')}</tbody></table></div><button type="button" class="btn btn-outline bw-add" onclick="BatchWork.addRow()">+ เพิ่มงาน</button><footer class="bw-footer"><div>${b.draft.rows.length} งาน · ค่าใช้จ่ายรวม<strong id="bwTotal">—</strong><small>ตรวจทุกรายการก่อนบันทึกและตัดสต็อก</small></div><button type="button" class="btn btn-primary" onclick="BatchWork.reviewAll()">ตรวจรายการก่อนบันทึก ${ic('chevron')}</button></footer>`}</form>`}</div>`;
  return html.replace(/<button(?![^>]*\btype=)/g,'<button type="button"');
}
if(typeof window!=='undefined')window.addEventListener('beforeunload',()=>{if(typeof route!=='undefined'&&route.view==='batchWork')BatchWork.persist();});
// Contextual links share one screen and one draft; the main navigation stays compact.
if(typeof render==='function'){
  const batchWorkBaseRender=render;
  render=function(){
    batchWorkBaseRender();
    if(typeof Auth!=='undefined'&&Auth.shareMode)return;
    let mount,context={};
    if(route.view==='home')mount=document.querySelector('.fo-heading');
    if(route.view==='planner')mount=document.querySelector('.fc-heading')||document.querySelector('#view .section-title');
    if(route.view==='cycleDetail'){const cycle=cycleById(S,route.cycleId);if(cycle?.status==='active'){mount=document.querySelector('.nb-header-actions');context={plotId:cycle.plotId,cycleId:cycle.id};}}
    if(route.view==='projectDetail'){const project=projectById(route.projectId);if(project&&project.status!=='done'){mount=document.querySelector('.pp-heading .pp-buttons')||document.querySelector('.pw-project-head .pw-between');context={projectId:project.id,plotId:project.plotId||'',cycleId:project.cycleId||''};}}
    if(mount&&!mount.querySelector('.bw-entry-link'))mount.insertAdjacentHTML('beforeend',batchWorkButton(context));
  };
  window.addEventListener('DOMContentLoaded',()=>render());
}
