/* Preparation edits a reviewed copy; recorded experiments keep stable membership. */
"use strict";
let projectSetupEditor=null;
function projectSetupHasEvidence(p,tr){
  if((tr.observations || []).length || (tr.treatments || []).some(t=>t.photos?.length) || (tr.units || []).some(u=>u.photos?.length))return true;
  if((S.projects || []).some(pr=>(pr.records || []).some(r=>r.trialId===tr.id)))return true;
  if(S.tasks.some(t=>t.trialId===tr.id))return true;
  const hasData=d=>d && ((d.photos || []).length || d.workNote?.trim() || d.note?.trim() || (d.rows || []).some(r=>r.note?.trim() || Object.values(r.values || {}).some(v=>v!=='' && v!=null)));
  if(projectRecordDraft?.trialId===tr.id && hasData(projectRecordDraft))return true;
  for(const task of projectTaskList(p)){try{if(hasData(JSON.parse(localStorage.getItem(projectRecordKey(p,task,tr)))))return true;}catch(_){return true;}}
  return false;
}
function projectSetupLocked(p,tr){
  return !!tr && (tr.projectId!==p.id || tr.collectionMode==='sampling' || tr.replications!=null || new Set((tr.treatments || []).map(t=>(tr.units || []).filter(u=>u.treatmentId===t.id).length)).size>1 || projectSetupHasEvidence(p,tr) || (S.projects || []).some(pr=>pr.id!==p.id && pr.trialIds?.includes(tr.id)));
}
function projectSetupSignature(p,tr){return JSON.stringify(tr?{groups:tr.treatments,metrics:tr.metrics,units:tr.units}:{groups:p.groups,metrics:p.measurementSchema});}
function projectValidateSetup(edit){
  const groups=edit.groups.map(g=>({...g,name:g.name.trim().normalize('NFC')})),metrics=edit.metrics.map(m=>({...m,name:m.name.trim(),unit:m.unit.trim()})),count=Number(edit.count);
  if(!groups.length || groups.length>12 || groups.some(g=>!g.name || g.name.length>120) || new Set(groups.map(g=>g.name.toLocaleLowerCase('th-TH'))).size!==groups.length)throw new Error('กรอกชื่อกลุ่มไม่ซ้ำกัน 1–12 กลุ่ม');
  if(!metrics.length || metrics.length>12 || metrics.some(m=>!m.name || m.name.length>100 || !m.unit || m.unit.length>30 || !['number','count'].includes(m.kind)) || new Set(metrics.map(m=>m.name.toLocaleLowerCase('th-TH'))).size!==metrics.length)throw new Error('กรอกชื่อค่าวัดและหน่วยให้ครบ ไม่ซ้ำกัน 1–12 รายการ');
  if(!Number.isInteger(count) || count<1 || count>200 || count*groups.length>400)throw new Error('ระบุจำนวนตัวอย่างต่อกลุ่ม 1–200 ตัวอย่าง รวมไม่เกิน 400 ตัวอย่าง');
  return {groups,metrics,count};
}
function projectApplySetup(p,tr,edit){
  if(!p || p.status==='done' || tr?.status==='done')throw new Error('เปิดโครงการและการทดลองก่อนแก้แผน');
  if(tr && !p.trialIds?.includes(tr.id))throw new Error('การทดลองไม่ตรงกับโครงการ');
  if(projectSetupSignature(p,tr)!==edit.signature)throw new Error('แผนถูกแก้ไขแล้ว กรุณาเปิดใหม่เพื่อตรวจข้อมูลล่าสุด');
  if(projectSetupLocked(p,tr))throw new Error('มีข้อมูลหรือการเชื่อมงานแล้ว เปลี่ยนชื่อกลุ่มได้ แต่ไม่เปลี่ยนกลุ่ม ตัวอย่าง หรือค่าวัดเดิม');
  const {groups,metrics,count}=projectValidateSetup(edit);
  if(new Set(groups.map(g=>g.id)).size!==groups.length || new Set(metrics.map(m=>m.id)).size!==metrics.length)throw new Error('รหัสกลุ่มหรือค่าวัดซ้ำ');
  p.groups=groups.map(g=>g.name);p.measurementSchema=projectClone(metrics);p.updatedAt=Date.now();
  if(!tr)return projectSetupSamples(p,count);
  const oldUnits=tr.units || [],oldTreatments=tr.treatments || [];
  tr.treatments=groups.map((g,i)=>({...oldTreatments.find(t=>t.id===g.id),id:g.id,code:g.code || String.fromCharCode(65+i),name:g.name}));
  tr.units=tr.treatments.flatMap(t=>Array.from({length:count},(_,i)=>{const prev=oldUnits.filter(u=>u.treatmentId===t.id)[i];return prev || {id:uid(),treatmentId:t.id,label:t.code+'-'+String(i+1).padStart(2,'0'),block:i+1,order:i+1,areaRai:0,note:''};}));
  tr.metrics=projectClone(metrics);tr.metric=metrics[0].name;tr.metricUnit=metrics[0].unit;tr.updatedAt=Date.now();p.updatedAt=Date.now();return tr;
}
App.projectExperimentSetup=function(projectId,trialId){
  if(!projectCanLeaveRecord())return;
  const p=projectId?projectById(projectId):null,tr=p?projectLinkedTrials(p).find(t=>t.id===trialId) || projectLinkedTrials(p)[0]:null,d=p || projectDraft;
  if(!d || d.status==='done' || tr?.status==='done')return;
  const counts=tr?tr.treatments.map(t=>tr.units.filter(u=>u.treatmentId===t.id).length):[];
  projectSetupEditor={owner:projectDraftKey(),projectId:p?.id || '',trialId:tr?.id || '',signature:p?projectSetupSignature(p,tr):JSON.stringify(projectDraft),locked:p?projectSetupLocked(p,tr):false,
    groups:tr?tr.treatments.map(t=>({id:t.id,code:t.code,name:t.name})):d.groups.map((name,i)=>({id:uid(),code:String.fromCharCode(65+i),name})),metrics:projectClone(tr?.metrics || d.measurementSchema || d.schema || []),count:counts.length?counts[0]:d.sampleCount || '',counts,step:'edit'};
  projectSetupModal();
};
App.projectEditSchema=function(){App.projectExperimentSetup();};
function projectSetupModal(){
  const e=projectSetupEditor;if(!e)return;const locked=e.locked,review=e.step==='review',p=e.projectId&&projectById(e.projectId);
  if(!e.trialId)e.groups.forEach((g,i)=>{g.code=String.fromCharCode(65+i);});
  openModal(`<h3>${review?'ตรวจแผนก่อนใช้':'เตรียมการทดลอง'}</h3><div class="pw-setup"><p>กำหนดกลุ่ม ตัวอย่าง และสิ่งที่จะวัดไว้ในจุดเดียว</p>${locked?'<p class="pw-notice">มีข้อมูลหรือการเชื่อมงานแล้ว แผนส่วนนี้แสดงเพื่ออ้างอิง เปลี่ยนชื่อกลุ่มได้โดยเก็บข้อมูลเดิมไว้</p>':''}<form onsubmit="return App.projectSetupNext(event)"><fieldset ${locked || review?'disabled':''}><h4>1. กลุ่มที่ต้องการเปรียบเทียบ</h4><div class="pw-setup-groups">${e.groups.map((g,i)=>`<div class="pw-setup-group"><b>${esc(g.code)}</b><label>ชื่อกลุ่ม ${esc(g.code)}<input aria-label="ชื่อกลุ่ม ${esc(g.code)}" maxlength="120" required value="${esc(g.name)}" oninput="App.projectSetupField('group',${i},'name',this.value)"></label>${!locked && !review?`<button type="button" class="btn btn-ghost" aria-label="เอากลุ่ม ${esc(g.code)} ออก" onclick="App.projectSetupRemove('group',${i})">${pwIcon('x')}</button>`:''}${locked?`<small>${e.counts[i]} ตัวอย่าง</small>`:''}</div>`).join('')}</div>${!locked && !review?'<button type="button" class="btn btn-outline" onclick="App.projectSetupAdd(\'group\')">เพิ่มกลุ่ม</button>':''}<h4>2. ตัวอย่าง</h4>${locked?`<p>รวม ${e.counts.reduce((a,b)=>a+b,0)} ตัวอย่าง รหัสและกลุ่มเดิมคงอยู่</p>`:`<label>จำนวนตัวอย่างต่อกลุ่ม<input aria-label="จำนวนตัวอย่างต่อกลุ่ม" type="number" min="1" max="200" step="1" required value="${esc(e.count)}" oninput="App.projectSetupField('count',0,'',this.value)"></label><p class="hint" id="projectSetupTotal">${e.groups.length} กลุ่ม × ${Number(e.count)||0} = ${e.groups.length*(Number(e.count)||0)} ตัวอย่าง</p>`}<h4>3. ค่าวัดที่จะเก็บ</h4><div class="pw-setup-metrics">${e.metrics.map((m,i)=>`<div class="pw-setup-metric"><label>ชื่อค่าวัด<input aria-label="ชื่อค่าวัด ${i+1}" maxlength="100" required value="${esc(m.name)}" oninput="App.projectSetupField('metric',${i},'name',this.value)"></label><label>หน่วย<input aria-label="หน่วยค่าวัด ${i+1}" maxlength="30" required value="${esc(m.unit)}" oninput="App.projectSetupField('metric',${i},'unit',this.value)"></label><label>รูปแบบตัวเลข<select aria-label="รูปแบบค่าวัด ${i+1}" onchange="App.projectSetupField('metric',${i},'kind',this.value)"><option value="number" ${m.kind!=='count'?'selected':''}>ทศนิยมได้</option><option value="count" ${m.kind==='count'?'selected':''}>จำนวนเต็ม</option></select></label>${!locked && !review?`<button type="button" class="btn btn-ghost" aria-label="เอาค่าวัด ${i+1} ออก" onclick="App.projectSetupRemove('metric',${i})">${pwIcon('x')}</button>`:''}</div>`).join('')}</div>${!locked && !review?'<button type="button" class="btn btn-outline" onclick="App.projectSetupAdd(\'metric\')">เพิ่มค่าวัด</button>':''}</fieldset>${review?'<p class="pw-notice">ตรวจชื่อกลุ่ม จำนวนตัวอย่าง และหน่วยก่อนยืนยัน ยังไม่มีการบันทึกผลทดลองจากขั้นตอนนี้</p>':''}<p id="projectSetupError" class="pw-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">${locked?'ปิด':'ยกเลิก'}</button>${locked?`<button type="button" class="btn btn-primary" onclick="App.projectManageGroups('${p.id}','${e.trialId}')">เปลี่ยนชื่อกลุ่ม</button>`:review?'<button type="button" class="btn btn-outline" onclick="projectSetupEditor.step=\'edit\';projectSetupModal()">กลับไปแก้</button><button type="submit" class="btn btn-primary">ยืนยันใช้แผนนี้</button>':'<button type="submit" class="btn btn-primary">ตรวจแผนก่อนใช้</button>'}</div></form></div>`);
}
App.projectSetupField=function(type,i,key,value){const e=projectSetupEditor;if(!e || e.locked || e.step!=='edit')return;if(type==='count'){e.count=value;const el=document.getElementById('projectSetupTotal');if(el)el.textContent=e.groups.length+' กลุ่ม × '+(Number(value)||0)+' = '+e.groups.length*(Number(value)||0)+' ตัวอย่าง';}else(type==='group'?e.groups:e.metrics)[i][key]=value;};
App.projectSetupAdd=function(type){const e=projectSetupEditor;if(!e || e.locked)return;const rows=type==='group'?e.groups:e.metrics;if(rows.length>=12){toast('เพิ่มได้ไม่เกิน 12 รายการ');return;}if(type==='group'){const codes=new Set(e.groups.map(g=>g.code));let code=65;while(codes.has(String.fromCharCode(code)))code++;rows.push({id:uid(),code:String.fromCharCode(code),name:''});}else rows.push({id:uid(),name:'',unit:'',kind:'number'});projectSetupModal();};
App.projectSetupRemove=function(type,i){const e=projectSetupEditor;if(!e || e.locked)return;const rows=type==='group'?e.groups:e.metrics;if(rows.length<=1){toast('ต้องมีอย่างน้อย 1 รายการ');return;}rows.splice(i,1);projectSetupModal();};
App.projectSetupNext=function(event){
  event.preventDefault();const edit=projectSetupEditor;if(!edit || edit.owner!==projectDraftKey() || edit.locked)return false;
  try{const ready=projectValidateSetup(edit);if(edit.step!=='review'){edit.step='review';projectSetupModal();return false;}
    if(!edit.projectId){if(JSON.stringify(projectDraft)!==edit.signature)throw new Error('ร่างโครงการเปลี่ยนแล้ว กรุณาเปิดแผนใหม่');const before=projectClone(projectDraft);Object.assign(projectDraft,{groups:ready.groups.map(g=>g.name),schema:ready.metrics,sampleCount:String(ready.count)});if(!projectStoreDraft()){projectDraft=before;throw new Error('เก็บร่างไม่สำเร็จ กรุณาลองอีกครั้ง');}}
    else{const p=projectById(edit.projectId),tr=edit.trialId?trialById(S,edit.trialId):null,result=projectTransaction(()=>projectApplySetup(p,tr,edit));if(!result.ok)throw new Error('บันทึกแผนไม่สำเร็จ กรุณาลองอีกครั้ง');for(const task of projectTaskList(p)){try{localStorage.removeItem(projectRecordKey(p,task,result.value));}catch(_){}}projectActiveTrial=result.value.id;projectRecordDraft=null;}
    projectSetupEditor=null;closeModal();render();toast('บันทึกแผนทดลองแล้ว');
  }catch(error){document.getElementById('projectSetupError').textContent=error.message;}return false;
};
