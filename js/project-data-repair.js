/* Complete existing historical records; never append activities or post a second cost. */
'use strict';
function projectRepairEditable(t){return t?.status==='done'&&t.source==='project-history'&&!hasTaskStockUse(t)&&!t.trialId&&taskIncomeMode(t)!=='harvest';}
function projectRepairFieldIssues(t){
  const issues=[];
  if(!taskRecordDate(t))issues.push('วันที่ทำจริง');
  for(const it of t.costItems||[]){
    if(['chemical','fertilizer','seed','materials'].includes(it.category)){
      if(!(Number(it.qty)>0))issues.push('ปริมาณ '+it.name);
      if(!String(it.unit||'').trim())issues.push('หน่วย '+it.name);
    }
    if(it.amountPending&&!materialIsSupported(it))issues.push('ยอด '+it.name);
  }
  return issues;
}
function projectRepairOtherIssues(t){
  const known=new Set(['วันที่ทำจริง','วันที่','ปริมาณ / หน่วยที่ใช้','ปริมาณที่ใช้','หน่วยที่ใช้','ปริมาณและหน่วยที่ใช้',...(t.costItems||[]).flatMap(it=>['ยอด '+it.name,'ปริมาณ '+it.name,'หน่วย '+it.name])]);
  return [...new Set([...taskDataIssues(t),t.dataNote].filter(Boolean).flatMap(v=>String(v).split(' · ').map(v=>v.trim()).filter(Boolean)))].filter(v=>!known.has(v));
}
function projectRepairTasks(state,pid){return (state.tasks||[]).filter(t=>t.projectId===pid&&t.status==='done'&&(taskDataPending(t)||(projectRepairEditable(t)&&projectRepairFieldIssues(t).length)));}
function projectRepairDraft(state,pid){
  return {version:1,id:uid(),projectId:pid,createdAt:Date.now(),rows:projectRepairTasks(state,pid).filter(projectRepairEditable).map(t=>({id:t.id,before:batchWorkClone(t),selected:false,date:taskRecordDate(t),otherChecked:false,items:(t.costItems||[]).map(it=>({qty:it.qty??'',unit:it.unit||'',amount:materialIsSupported(it)?'0':it.amountPending?'':String(it.totalCost??'')}))}))};
}
function projectRepairPlan(state,draft){
  const p=(state.projects||[]).find(p=>p.id===draft.projectId);
  if(!p||p.status==='done')throw Error('โครงการปิดแล้วหรือไม่พบโครงการ');
  if(!draft.id||!Array.isArray(draft.rows)||draft.rows.length>1000)throw Error('ร่างไม่ถูกต้อง กรุณาเปิดตารางใหม่');
  const selected=draft.rows.filter(r=>r.selected),ids=new Set(),details=[],errors=[],staged=batchWorkClone(state);
  if(!selected.length)throw Error('เลือกและเติมข้อมูลอย่างน้อย 1 รายการ');
  for(const row of selected){try{
    if(ids.has(row.id))throw Error('รหัสรายการซ้ำ');ids.add(row.id);
    const current=state.tasks.find(t=>t.id===row.id&&t.projectId===p.id),before=row.before;
    if(!current||!before||current.id!==before.id||!projectRepairEditable(current))throw Error('รายการนี้ต้องแก้ผ่านบันทึกต้นทาง');
    const date=batchWorkDate(row.date);if(date>todayISO())throw Error('วันที่ทำจริงต้องไม่เป็นอนาคต');
    if(!Array.isArray(row.items)||row.items.length!==(before.costItems||[]).length)throw Error('จำนวนรายการต้นทุนเปลี่ยน กรุณาเปิดตารางใหม่');
    const items=row.items.map((input,j)=>{
      const old=before.costItems[j],material=['chemical','fertilizer','seed','materials'].includes(old.category),supported=materialIsSupported(old);
      const quantity=batchWorkText(input.qty),unit=batchWorkText(input.unit),needsQty=material||quantity!==''||unit!=='';
      const qty=needsQty?batchWorkNumber(input.qty,'ปริมาณ '+old.name,true):old.qty??'';
      if(needsQty&&(!unit||unit.length>30))throw Error('ระบุหน่วย '+old.name);
      const amount=Math.round(batchWorkNumber(input.amount,'ยอดจ่าย '+old.name)*100)/100;
      if(supported&&amount!==0)throw Error('ของสนับสนุนต้องมียอดจ่าย 0 บาท');
      const next={...old,qty,unit,totalCost:amount,amountPending:false};
      if(supported)Object.assign(next,materialSupportFields(old));
      else {next.externalTotal=amount;next.externalPriceMode='total';next.unitCost=Number(qty)>0?amount/Number(qty):0;}
      return next;
    });
    const other=projectRepairOtherIssues(before);if(other.length&&!row.otherChecked)throw Error('ยังต้องตรวจ: '+other.join(' · '));
    if(!items.length&&taskDataIssues(before).includes('ค่าใช้จ่าย')&&!row.otherChecked)throw Error('ยืนยันข้อมูลค่าใช้จ่ายก่อน');
    const next={...batchWorkClone(before),date,doneDate:date,costItems:items,cost:items.length?Math.round(items.reduce((sum,it)=>sum+Number(it.totalCost),0)*100)/100:Number(before.cost)||0,dataStatus:'complete',missingFields:[],dataNote:'',updatedAt:draft.createdAt,dataRepairId:draft.id};
    const remaining=projectRepairFieldIssues(next);if(remaining.length)throw Error(remaining.join(' · '));
    const already=JSON.stringify(current)===JSON.stringify(next);
    if(!already&&JSON.stringify(current)!==JSON.stringify(before))throw Error('ข้อมูลเปลี่ยนหลังเปิดตาราง กรุณากลับไปเปิดใหม่');
    const target=staged.tasks.find(t=>t.id===row.id);Object.assign(target,next);
    details.push({id:row.id,before,current,next,already});
  }catch(e){errors.push({id:row.id,message:e.message});}}
  const delta=Math.round(details.filter(d=>!d.already).reduce((sum,d)=>sum+d.next.cost-(Number(d.current.cost)||0),0)*100)/100;
  return {staged,details,errors,delta,valid:!errors.length,signature:JSON.stringify({project:p,rows:details.map(d=>[d.current,d.next,d.already]),delta})};
}
function projectRepairCommit(state,draft,persist,signature){
  const plan=projectRepairPlan(state,draft);if(!plan.valid)throw Error('ตรวจข้อมูลที่แจ้งก่อนยืนยัน');
  if(signature&&signature!==plan.signature)throw Error('ข้อมูลหรือต้นทุนเปลี่ยน กรุณาตรวจรายการอีกครั้ง');
  if(plan.details.some(d=>!d.already)){if(persist(plan.staged)===false)throw Error('เก็บข้อมูลไม่สำเร็จ กรุณาลองใหม่');Object.assign(state,plan.staged);}
  return plan;
}
function projectDataRepairButton(p){const count=projectRepairTasks(S,p.id).length;return count&&p.status!=='done'?`<section class="pp-card pr-entry"><div><b>ข้อมูลที่ยังขาด ${count} รายการ</b><p>เติมวันที่ ปริมาณ และยอดจ่ายในบันทึกเดิม</p></div><button type="button" class="btn btn-outline" onclick="ProjectDataRepair.open('${esc(p.id)}')">เติมข้อมูลที่ขาด ${count} รายการ</button></section>`:'';}
const ProjectDataRepair={
  draft:null,owner:'',review:null,message:'',errors:[],receipt:null,busy:false,
  key(pid){return 'farmult-data-repair-v1::'+String(typeof Auth!=='undefined'?Auth.session?.email||'local':'local').toLowerCase()+'::'+pid;},
  open(pid){
    if(typeof Auth!=='undefined'&&Auth.shareMode)return;
    this.owner=this.key(pid);this.draft=projectRepairDraft(S,pid);this.review=null;this.message='';this.errors=[];this.receipt=null;
    try{const saved=JSON.parse(localStorage.getItem(this.owner));if(saved?.version===1&&saved.projectId===pid&&Array.isArray(saved.rows)&&saved.rows.length<=1000){this.draft=saved;this.message='เปิดร่างที่เก็บไว้แล้ว · หากต้นทางเปลี่ยน ให้เริ่มจากข้อมูลล่าสุด';}}catch(_){}
    route.projectId=pid;route.view='projectDataRepair';render();
  },
  persist(){if(!this.draft||this.owner!==this.key(this.draft.projectId))return false;try{localStorage.setItem(this.owner,JSON.stringify(this.draft));return true;}catch(_){this.message='เก็บร่างไม่ได้ กรุณาอย่าปิดหน้านี้';return false;}},
  set(i,j,key,value){const r=this.draft.rows[i];if(!r)return;if(j<0)r[key]=value;else r.items[j][key]=value;if(key!=='selected')r.selected=true;this.review=null;this.errors=this.errors.filter(e=>e.id!==r.id);this.persist();const checkbox=document.getElementById('prSelect'+i);if(checkbox){checkbox.checked=r.selected;const tr=checkbox.closest('tr');tr?.classList.remove('pr-invalid');tr?.querySelectorAll('.bw-error').forEach(el=>el.remove());}},
  reset(){App.confirm('เริ่มจากข้อมูลล่าสุด?','ข้อมูลที่เติมไว้ในร่างนี้จะถูกแทนที่ บันทึกจริงไม่เปลี่ยน',()=>{try{localStorage.removeItem(this.owner);}catch(_){}this.open(this.draft.projectId);});},
  back(){if(!this.receipt&&!this.persist()){toast(this.message);return;}App.projectOpen(this.draft.projectId);},
  check(){try{if(this.owner!==this.key(this.draft.projectId))throw Error('บัญชีเปลี่ยน กรุณาเปิดตารางใหม่');if(!this.persist())throw Error(this.message);const p=projectRepairPlan(S,this.draft);this.errors=p.errors;this.review=p.valid?p:null;this.message=p.valid?'':'เติมข้อมูลของรายการที่เลือกให้ครบ หรือเอาเครื่องหมายออกเพื่อเก็บไว้เติมภายหลัง';render();document.getElementById('prMessage')?.focus();window.scrollTo({top:0,behavior:'instant'});}catch(e){this.message=e.message;render();}},
  edit(){this.review=null;render();},
  save(){
    if(this.busy||!this.review||this.receipt||!document.getElementById('prConfirm')?.checked)return;
    this.busy=true;
    try{
      if(this.owner!==this.key(this.draft.projectId)||(typeof Auth!=='undefined'&&Auth.shareMode))throw Error('บัญชีเปลี่ยน กรุณาเปิดตารางใหม่');
      const p=projectRepairCommit(S,this.draft,staged=>{const silent=typeof Auth!=='undefined'?Auth._silentLocalSave:false;try{if(typeof Auth!=='undefined')Auth._silentLocalSave=true;saveState(staged);return !storageSaveFailed;}finally{if(typeof Auth!=='undefined')Auth._silentLocalSave=silent;}},this.review.signature);
      if(p.details.some(d=>!d.already)&&typeof Auth!=='undefined'&&Auth.session){setLocalDirty(true);Auth.queueSave();}
      this.receipt={count:p.details.filter(d=>!d.already).length,delta:p.delta};try{localStorage.removeItem(this.owner);}catch(_){}this.message='';render();
    }catch(e){this.review=null;this.message=e.message;render();}finally{this.busy=false;}
  },
  field(i,j,key,value,label,type='text',extra=''){return `<input type="${type}" value="${esc(value??'')}" aria-label="รายการ ${i+1} ${j>=0?'ค่าใช้จ่าย '+(j+1)+' ':''}${label}" ${extra} oninput="ProjectDataRepair.set(${i},${j},'${key}',this.value)">`;},
  rowHtml(r,i){const t=r.before,other=projectRepairOtherIssues(t),errors=this.errors.filter(e=>e.id===r.id);return `<tr class="${errors.length?'pr-invalid':''}"><td data-label="เลือก"><input id="prSelect${i}" type="checkbox" aria-label="เลือกเติมรายการ ${i+1}" ${r.selected?'checked':''} onchange="ProjectDataRepair.set(${i},-1,'selected',this.checked)"></td><td data-label="งาน"><b>${esc(t.title)}</b><small>${t.sourceRow?'แถวชีต '+esc(t.sourceRow):'รายการ '+(i+1)}</small><small class="pr-missing">${esc([...new Set([...projectRepairFieldIssues(t),...other])].join(' · ') || 'ตรวจข้อมูลที่ระบุว่ารอตรวจ')}</small>${other.length?`<label class="pr-other"><input type="checkbox" ${r.otherChecked?'checked':''} onchange="ProjectDataRepair.set(${i},-1,'otherChecked',this.checked)">ตรวจแล้ว: ${esc(other.join(' · '))}</label>`:''}${errors.map(e=>`<p class="bw-error" role="alert">${esc(e.message)}</p>`).join('')}</td><td data-label="วันที่ทำจริง">${this.field(i,-1,'date',r.date,'วันที่ทำจริง','date','max="'+todayISO()+'"')}</td><td data-label="ปริมาณ / หน่วย / ยอดจ่าย">${r.items.map((it,j)=>{const old=t.costItems[j],supported=materialIsSupported(old);return `<div class="pr-item"><b>${esc(old.name)}</b><small>${esc(BATCH_WORK_CATEGORIES[old.category]||old.category)}${supported?' · ได้รับสนับสนุน · '+esc(old.sponsor||'ยังไม่ระบุผู้สนับสนุน'):''}</small><div class="pr-item-fields"><label>ปริมาณ${this.field(i,j,'qty',it.qty,'ปริมาณ','text','inputmode="decimal" placeholder="ยังไม่ทราบ"')}</label><label>หน่วย${this.field(i,j,'unit',it.unit,'หน่วย','text','maxlength="30" placeholder="หน่วย"')}</label><label>จ่ายจริง (บาท)${this.field(i,j,'amount',it.amount,'ยอดจ่าย','text','inputmode="decimal" '+(supported?'readonly aria-readonly="true"':'placeholder="ยังไม่ทราบ"'))}</label></div>${!['chemical','fertilizer','seed','materials'].includes(old.category)?'<small>งานบริการไม่บังคับปริมาณและหน่วย ถ้าไม่มีข้อมูลให้เว้นทั้งคู่</small>':''}</div>`;}).join('')||'<small>ไม่มีรายการค่าใช้จ่าย · คงยอดรายรับเดิม</small>'}</td></tr>`;},
  reviewHtml(){const p=this.review;return `<section class="card bw-review"><h2>ตรวจปริมาณและต้นทุนก่อนยืนยัน</h2><p>แก้ ${p.details.length} บันทึกเดิม · ไม่สร้างงานเพิ่ม · รูปภาพและรายรับคงเดิม</p>${p.details.map(d=>`<article><h3>${esc(d.next.title)}</h3><p>วันที่ ${esc(taskRecordDate(d.before)||'ยังไม่ทราบ')} → ${esc(d.next.date)}</p><ul>${d.next.costItems.map((it,j)=>`<li><span>${esc(it.name)} · ${esc(d.before.costItems[j].qty||'ยังไม่ทราบ')} ${esc(d.before.costItems[j].unit||'')} → ${esc(it.qty||'—')} ${esc(it.unit||'')}${materialIsSupported(it)?' · สนับสนุน':''}</span><b>${fmtMoney(d.before.costItems[j].totalCost||0)} → ${fmtMoney(it.totalCost)} บาท</b></li>`).join('')}</ul><strong>ค่าใช้จ่าย ${fmtMoney(d.before.cost||0)} → ${fmtMoney(d.next.cost)} บาท</strong><p>รายรับเดิม ${fmtMoney(d.next.revenue||0)} บาท</p></article>`).join('')}<div class="bw-review-total">ค่าใช้จ่ายเปลี่ยนสุทธิ <strong>${p.delta>0?'+':''}${fmtMoney(p.delta)} บาท</strong></div><p>ประวัติแปลง ต้นทุนรอบปลูก และโครงการอ่านจากบันทึกชุดเดียวกัน</p><label class="bw-inline"><input id="prConfirm" type="checkbox" onchange="document.getElementById('prSave').disabled=!this.checked">ตรวจวันที่ ปริมาณ หน่วย และยอดจ่ายจริงครบแล้ว</label><div class="bw-actions"><button type="button" class="btn btn-outline" onclick="ProjectDataRepair.edit()">กลับไปแก้ตาราง</button><button type="button" id="prSave" class="btn btn-primary" disabled onclick="ProjectDataRepair.save()">ยืนยันแก้ ${p.details.length} บันทึกเดิม</button></div></section>`;}
};
function renderProjectDataRepair(){
  const b=ProjectDataRepair,p=(S.projects||[]).find(p=>p.id===route.projectId);
  if(!p)return '<p>ไม่พบโครงการ</p>';
  if(!b.draft||b.owner!==b.key(p.id)||b.draft.projectId!==p.id){b.owner=b.key(p.id);b.draft=projectRepairDraft(S,p.id);b.review=null;b.errors=[];b.receipt=null;b.message='';}
  const unsupported=projectRepairTasks(S,p.id).filter(t=>!projectRepairEditable(t));
  setTimeout(()=>{const form=document.getElementById('prForm');if(form&&typeof Auth!=='undefined'){Auth.formEditing=true;Auth._editingForm=form;}},0);
  return `<div class="bw-page pr-page"><header class="bw-heading"><div><small>${esc(p.code||'')} · ${esc(p.name)}</small><h1>เติมข้อมูลที่ขาด</h1><p>${b.draft.rows.length} รายการในตาราง · กรอกเฉพาะข้อมูลจริงที่ยืนยันได้</p></div><button type="button" class="btn btn-outline" onclick="ProjectDataRepair.back()">เก็บร่างและกลับ</button></header>${b.message?`<p id="prMessage" class="bw-message" role="status" tabindex="-1">${esc(b.message)}</p>`:''}${b.receipt?`<section class="card bw-receipt"><h2>เติมข้อมูลแล้ว ${b.receipt.count} รายการ</h2><p>เปลี่ยนค่าใช้จ่ายสุทธิ ${fmtMoney(b.receipt.delta)} บาท · ไม่มีงานเพิ่ม</p><p>ยังขาดข้อมูล ${projectRepairTasks(S,p.id).length} รายการ</p><button type="button" class="btn btn-primary" onclick="ProjectDataRepair.back()">ดูโครงการและต้นทุน</button></section>`:`<form id="prForm" onsubmit="event.preventDefault();ProjectDataRepair.check()">${b.review?b.reviewHtml():`<div class="pr-intro"><p>แก้บันทึกเดิมพร้อมกันได้ เลือกเฉพาะรายการที่เติมครบแล้ว รายการอื่นเก็บไว้เติมภายหลัง</p><button type="button" class="btn btn-ghost" onclick="ProjectDataRepair.reset()">เริ่มจากข้อมูลล่าสุด</button></div><div class="pr-table-wrap"><table class="pr-table"><thead><tr><th>เลือก</th><th>งาน / ข้อมูลที่ขาด</th><th>วันที่ทำจริง</th><th>วัสดุหรือบริการ · ปริมาณ · ยอดจ่าย</th></tr></thead><tbody>${b.draft.rows.map((r,i)=>b.rowHtml(r,i)).join('')||'<tr><td colspan="4">ไม่มีรายการที่ต้องเติมในตารางนี้</td></tr>'}</tbody></table></div>${unsupported.length?`<section class="card bw-panel"><h2>รายการที่ต้องตรวจผ่านบันทึกต้นทาง</h2>${unsupported.map(t=>`<button type="button" class="btn btn-outline" onclick="App.viewTask('${esc(t.id)}')">${esc(t.title)}</button>`).join('')}</section>`:''}<footer class="bw-footer"><div><b>ยังไม่เปลี่ยนต้นทุนจนกว่าจะยืนยัน</b><small>ของสนับสนุนคงยอดจ่าย 0 · เก็บรูปและรายรับเดิม</small></div><button type="button" class="btn btn-primary" ${p.status==='done'||!b.draft.rows.length?'disabled':''} onclick="ProjectDataRepair.check()">ตรวจรายการก่อนยืนยัน</button></footer>`}</form>`}</div>`;
}
if(typeof window!=='undefined')window.addEventListener('beforeunload',()=>{if(typeof route!=='undefined'&&route.view==='projectDataRepair'&&!ProjectDataRepair.receipt)ProjectDataRepair.persist();});
