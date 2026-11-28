/* Historical records and display groups reference the one activity ledger. */
'use strict';
const projectHistoryLegacyModalTask=App.modalTask;
App.modalTask=function(date,options={}){
  const t=options?.taskId?S.tasks.find(t=>t.id===options.taskId):null;
  if(t?.source==='project-history'&&!options.completionReview)return App.projectHistoryRecordModal(t.projectId,t.id);
  return projectHistoryLegacyModalTask.apply(this,arguments);
};
function projectHistoryProject(id){
  const p=projectById(id);
  if(!p || p.status==='done' || projectHasExperiment(p))throw Error('ใช้ได้กับโครงการทั่วไปที่ยังเปิดอยู่');
  return p;
}
function projectHistoryCreate(values){
  const d={version:1,name:values.name || '',objective:values.objective || '',brief:'',kind:'work',plotId:values.plotId || '',cycleId:values.cycleId || '',startDate:'',stages:[{id:uid(),name:'งานที่ทำแล้ว',tasks:[]}]};
  const p=projectCreateFromDraft(d,{allowEmpty:true});p.entryMode='historical';return p;
}
function projectHistoryCandidates(p){return S.tasks.filter(t=>t.status==='done'&&!t.projectId&&!t.activityGroupId&&!t.trialId&&(t.plotId||'')===(p.plotId||'')&&(!p.cycleId||t.cycleId===p.cycleId));}
function projectHistoryLink(pid,ids){
  const p=projectHistoryProject(pid),available=projectHistoryCandidates(p),selected=[...new Set(ids)].map(id=>available.find(t=>t.id===id));
  if(!selected.length||selected.some(t=>!t))throw Error('ตรวจรายการที่เลือกอีกครั้ง งานต้องยังไม่เชื่อมโครงการ');
  if(!p.stages.length)p.stages.push({id:uid(),name:'งานที่ทำแล้ว'});
  for(const t of selected){t.projectId=p.id;t.projectStageId=p.stages[0].id;t.updatedAt=Date.now();}
  return selected;
}
function projectActivityGroup(pid,ids,title){
  const p=projectHistoryProject(pid),tasks=[...new Set(ids)].map(id=>projectTaskList(p).find(t=>t.id===id));
  if(!title?.trim()||title.length>150)throw Error('ระบุชื่อกิจกรรมไม่เกิน 150 ตัวอักษร');
  if(tasks.length<2||tasks.some(t=>!t||t.status!=='done'||t.activityGroupId||t.trialId))throw Error('เลือกอย่างน้อย 2 รายการที่ทำแล้วและยังไม่จัดกลุ่ม');
  const key=t=>JSON.stringify([t.plotId||'',t.cycleId||'',t.projectStageId||'',taskRecordDate(t)]);
  if(!taskRecordDate(tasks[0])||tasks.some(t=>key(t)!==key(tasks[0])))throw Error('ต้องเป็นแปลง รอบปลูก ขั้นตอน และวันที่ทำจริงเดียวกัน');
  if((p.records||[]).some(r=>ids.includes(r.taskId)))throw Error('รายการมีผลบันทึกเฉพาะงาน กรุณาเก็บแยกไว้');
  const id=uid();for(const t of tasks){t.activityGroupId=id;t.activityTitle=title.trim();t.activityType='work';t.updatedAt=Date.now();}return id;
}
function projectActivityUngroup(pid,id){const p=projectHistoryProject(pid);for(const t of projectTaskList(p).filter(t=>t.activityGroupId===id)){delete t.activityGroupId;delete t.activityTitle;delete t.activityType;t.updatedAt=Date.now();}}
function projectHistoryRecord(pid,values,existingId=''){
  const p=projectHistoryProject(pid),existing=existingId?S.tasks.find(t=>t.id===existingId&&t.projectId===pid):null;
  if(existingId&&(!existing||existing.source!=='project-history'||hasTaskStockUse(existing)))throw Error('แก้รายการนี้ผ่านบันทึกต้นทาง');
  if(!values.title?.trim()||values.title.length>150)throw Error('ระบุชื่องานไม่เกิน 150 ตัวอักษร');
  const date=values.date||'';
  if(date&&(!trialValidDate(date)||date>todayISO()))throw Error('วันที่ทำจริงต้องไม่เป็นวันในอนาคต');
  const missing=[];if(!date)missing.push('วันที่ทำจริง');
  const items=(values.items||[]).filter(r=>r.name?.trim()||String(r.amount??'').trim()!=='').map(r=>{
    if(!r.name?.trim())throw Error('ระบุชื่อค่าใช้จ่ายทุกรายการ');
    const supported=r.funding==='supported',pending=!supported && String(r.amount??'').trim()==='',amount=supported||pending?0:Number(r.amount);
    if(!Number.isFinite(amount)||amount<0)throw Error('ค่าใช้จ่ายต้องเป็นจำนวนตั้งแต่ 0 บาท');
    if(pending)missing.push('ยอด '+r.name.trim());
    return {name:r.name.trim(),qty:r.qty||'',unit:r.unit||'',totalCost:Math.round(amount*100)/100,amountPending:pending,source:'manual',category:allCostCats(S).some(c=>c.key===r.category)?r.category:'other',...materialSupportFields(r)};
  });
  if(items.length&&values.noCost)throw Error('มีรายการค่าใช้จ่ายแล้ว กรุณาเอาเครื่องหมายไม่มีค่าใช้จ่ายออก');
  if(!items.length&&!values.noCost)missing.push('ค่าใช้จ่าย');
  const cost=Math.round(items.reduce((sum,r)=>sum+r.totalCost,0)*100)/100;
  const hasIncome=String(values.income??'').trim()!=='';
  const revenue=taskRevenueInput({useGeneral:hasIncome,amount:values.income});
  if(values.pending)missing.push(values.dataNote?.trim()||'ข้อมูลรอตรวจ');
  const data={title:values.title.trim(),date,doneDate:date,type:'work',status:'done',projectId:pid,projectStageId:existing?.projectStageId||p.stages[0]?.id,plotId:p.plotId||null,cycleId:p.cycleId||null,cost,costItems:items,revenue,incomeMode:hasIncome?'general':'none',note:values.note||'',dataStatus:missing.length?'pending':'complete',missingFields:missing,dataNote:values.dataNote||'',source:'project-history',updatedAt:Date.now()};
  // No material reservation or inventory transaction is created by a historical expense.
  if(existing){Object.assign(existing,data);return existing;}
  const t={id:uid(),...data,photos:[],donePhotos:[],createdAt:Date.now(),stockLog:[],stockState:'none'};S.tasks.push(t);return t;
}
function phField(id,label,type='text',value=''){return `<label class="pp-field">${label}<input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="0.01"':''}></label>`;}
function phRun(fn,after){try{const result=projectTransaction(fn);if(result.ok){closeModal();render();after?.(result.value);}}catch(e){toast(e.message);}}
App.projectHistoryNew=function(){
  openModal(`<div class="pp-page ph-modal"><h2>เริ่มจากงานที่ทำไปแล้ว</h2><p>ตั้งโครงการเพื่อรวบรวมบันทึกเดิม แล้วเติมข้อมูลที่ยังขาดได้</p><form onsubmit="return App.projectHistoryCreate(event)">${phField('phName','ชื่อโครงการ *')}${phField('phObjective','วัตถุประสงค์ (ไม่บังคับ)')}<label class="pp-field">แปลง<select id="phPlot" onchange="App.projectHistoryCycles()"><option value="">ยังไม่ระบุ</option>${S.plots.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label class="pp-field">รอบปลูก<select id="phCycle"><option value="">ยังไม่ระบุ</option></select></label><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button><button class="btn btn-primary" type="submit">สร้างโครงการจากงานเดิม</button></div></form></div>`);
};
App.projectHistoryCycles=function(){const id=document.getElementById('phPlot').value;document.getElementById('phCycle').innerHTML='<option value="">ยังไม่ระบุ</option>'+S.cycles.filter(c=>c.plotId===id).map(c=>`<option value="${esc(c.id)}">${esc(c.plant||'รอบปลูก')} · รอบ ${esc(c.round||'')}</option>`).join('');};
App.projectHistoryCreate=function(e){e.preventDefault();const get=id=>document.getElementById(id).value;phRun(()=>projectHistoryCreate({name:get('phName'),objective:get('phObjective'),plotId:get('phPlot'),cycleId:get('phCycle')}),p=>App.projectOpen(p.id));return false;};
App.projectHistoryLinkModal=function(pid){try{const p=projectHistoryProject(pid),rows=projectHistoryCandidates(p);openModal(`<div class="pp-page ph-modal"><h2>เชื่อมงานที่บันทึกไว้แล้ว</h2><p>${esc(projectScopeText(p))} · ใช้บันทึกเดิมและยอดเดิม</p><form onsubmit="return App.projectHistoryLinkSave(event,'${pid}')"><div class="ph-choices">${rows.map(t=>`<label><input type="checkbox" name="historyIds" value="${esc(t.id)}"><span><b>${esc(t.title)}</b><small>${esc(taskRecordDate(t)||'ยังไม่ทราบวันที่')} · ค่าใช้จ่าย ${fmtMoney(t.cost||0)} บาท · รายรับ ${fmtMoney(t.revenue||0)} บาท</small></span></label>`).join('')||'<p>ไม่มีงานที่ยังไม่เชื่อมโครงการในขอบเขตนี้</p>'}</div><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button><button type="submit" class="btn btn-primary" ${rows.length?'':'disabled'}>เชื่อมรายการที่เลือก</button></div></form></div>`);}catch(e){toast(e.message);}};
App.projectHistoryLinkSave=function(e,pid){e.preventDefault();const ids=[...e.target.querySelectorAll('[name=historyIds]:checked')].map(el=>el.value);phRun(()=>projectHistoryLink(pid,ids));return false;};
App.projectActivityGroupModal=function(pid){try{const p=projectHistoryProject(pid),rows=projectTaskList(p).filter(t=>t.status==='done'&&!t.activityGroupId);openModal(`<div class="pp-page ph-modal"><h2>จัดรายการเป็นกิจกรรมเดียวกัน</h2><p>เลือกเฉพาะรายการของกิจกรรมเดียวกัน ในวัน แปลง รอบปลูก และขั้นตอนเดียวกัน</p><p>คงรายการต้นทางและยอดเดิมไว้ ยกเลิกการจัดกลุ่มได้</p><form onsubmit="return App.projectActivityGroupSave(event,'${pid}')">${phField('phActivityTitle','ชื่อกิจกรรม *')}<div class="ph-choices">${rows.map(t=>`<label><input type="checkbox" name="groupIds" value="${esc(t.id)}"><span><b>${esc(t.title)}</b><small>${esc(taskRecordDate(t)||'ยังไม่ทราบวันที่')} · ${esc(projectStageById(p,t.projectStageId)?.name||'')} · ค่าใช้จ่าย ${fmtMoney(t.cost||0)} บาท</small></span></label>`).join('')||'<p>ยังไม่มีรายการที่จัดกลุ่มได้</p>'}</div><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button><button type="submit" class="btn btn-primary">ยืนยันจัดกลุ่มรายการที่เลือก</button></div></form></div>`);}catch(e){toast(e.message);}};
App.projectActivityGroupSave=function(e,pid){e.preventDefault();const ids=[...e.target.querySelectorAll('[name=groupIds]:checked')].map(el=>el.value);phRun(()=>projectActivityGroup(pid,ids,document.getElementById('phActivityTitle').value));return false;};
App.projectViewActivity=function(id){const source=S.tasks.find(t=>t.id===id);if(!source)return;const row=taskActivityRows(S.tasks).find(t=>t.id===id||t.activityMembers?.some(m=>m.id===id));if(!row?.activityMembers)return App.viewTask(id);const p=projectById(source.projectId);openModal(`<div class="pp-page ph-modal"><h2>${esc(row.title)}</h2><p>${esc(taskRecordDate(row))} · ${row.activityMembers.length} รายการต้นทาง</p><p>ค่าใช้จ่าย ${fmtMoney(row.cost)} บาท · รายรับ ${fmtMoney(row.revenue)} บาท</p>${taskDataPending(row)?'<p class="pp-notice">ทำแล้ว · ข้อมูลรอตรวจ</p>':''}<div class="ph-choices">${row.activityMembers.map(t=>`<button class="btn btn-outline" onclick="App.viewTask('${t.id}')">${esc(t.title)} · ค่าใช้จ่าย ${fmtMoney(t.cost||0)} บาท · รายรับ ${fmtMoney(t.revenue||0)} บาท</button>`).join('')}</div><div class="modal-actions"><button class="btn btn-outline" onclick="App.closeModal()">ปิด</button>${p&&p.status!=='done'?`<button class="btn btn-outline" onclick="App.projectActivityUngroup('${p.id}','${source.activityGroupId}')">แยกกลับเป็นรายการเดิม</button>`:''}</div></div>`);};
App.projectActivityUngroup=function(pid,id){phRun(()=>projectActivityUngroup(pid,id));};
function phExpenseRow(item={}){return `<div class="ph-expense"><label>รายการค่าใช้จ่าย<input name="expenseName" value="${esc(item.name||'')}" maxlength="150"></label><label>ประเภทค่าใช้จ่าย<select name="expenseCategory">${allCostCats(S).map(c=>`<option value="${c.key}" ${(item.category || 'other')===c.key?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label><label>จำนวน (ถ้าทราบ)<input name="expenseQty" value="${esc(item.qty??'')}"></label><label>หน่วย<input name="expenseUnit" value="${esc(item.unit||'')}"></label><label class="ph-check"><input name="expenseSupported" type="checkbox" ${materialIsSupported(item)?'checked':''} onchange="App.projectHistorySupportToggle(this)"> ได้รับสนับสนุน</label><label>ผู้สนับสนุน / ที่มา<input name="expenseSponsor" maxlength="150" value="${esc(item.sponsor||'')}"></label><label>ยอดที่จ่ายจริง (บาท)<input name="expenseAmount" ${materialIsSupported(item)?'disabled':''} type="number" min="0" step="0.01" placeholder="ยังไม่ทราบ" value="${item.amountPending?'':esc(item.totalCost??'')}"></label><button type="button" class="btn btn-ghost" aria-label="ลบค่าใช้จ่ายแถวนี้" onclick="this.closest('.ph-expense').remove()">ลบแถว</button></div>`;}
App.projectHistoryRecordModal=function(pid,tid=''){try{const p=projectHistoryProject(pid),t=tid?S.tasks.find(t=>t.id===tid&&t.projectId===pid):null;if(tid&&t?.source!=='project-history')return App.modalTask(todayISO(),{taskId:tid});openModal(`<div class="pp-page ph-modal"><h2>${t?'เติมข้อมูลบันทึกย้อนหลัง':'บันทึกงานที่ทำแล้ว'}</h2><p>${esc(projectScopeText(p))}</p><p class="pp-notice">บันทึกประวัติและค่าใช้จ่ายย้อนหลัง โดยไม่ตัดคลังวัสดุ กรอกเฉพาะข้อมูลที่ทราบ เว้นยอดว่างหากยังไม่ทราบ (0 หมายถึงไม่มีค่าใช้จ่าย)</p><form onsubmit="return App.projectHistoryRecordSave(event,'${pid}','${tid}')">${phField('phTitle','ชื่องาน *','text',t?.title||'')}${phField('phDate','วันที่ทำจริง (เว้นได้หากยังไม่ทราบ)','date',t?taskRecordDate(t):'')}<h3>รายการค่าใช้จ่าย</h3><label class="ph-check"><input id="phNoCost" type="checkbox" ${t && !t.costItems?.length && !taskDataPending(t)?'checked':''}> ยืนยันว่าไม่มีค่าใช้จ่าย</label><div id="phExpenses">${(t?.costItems?.length?t.costItems:[{}]).map(phExpenseRow).join('')}</div><button class="btn btn-outline" type="button" onclick="App.projectHistoryExpenseAdd()">+ เพิ่มรายการค่าใช้จ่าย</button>${phField('phIncome','รายรับทั่วไป เช่น ค่าเช่า / ค่าบริการ (บาท)','number',t?.incomeMode==='general'?t.revenue:'')}<label class="pp-field">บันทึกการทำงาน<textarea id="phNote">${esc(t?.note||'')}</textarea></label><label class="ph-check"><input id="phPending" type="checkbox" ${taskDataPending(t)?'checked':''}> ทำแล้ว แต่มีข้อมูลที่ยังรอตรวจ</label>${phField('phDataNote','ข้อมูลที่ยังขาด / รอตรวจ','text',t?.dataNote||'')}<label class="ph-check"><input type="checkbox" required> ตรวจรายการและยอดแล้ว ยืนยันบันทึกเป็นงานที่ทำแล้ว</label><p class="hint">แนบรูปได้ที่รายละเอียดงาน → แก้ผลหลังทำ</p><div class="modal-actions"><button class="btn btn-outline" type="button" onclick="App.closeModal()">ยกเลิก</button><button class="btn btn-primary" type="submit">บันทึกประวัติและค่าใช้จ่าย</button></div></form></div>`);}catch(e){toast(e.message);}};
App.projectHistorySupportToggle=function(el){const input=el.closest('.ph-expense').querySelector('[name=expenseAmount]');input.disabled=el.checked;input.value=el.checked?'0':'';};
App.projectHistoryExpenseAdd=function(){document.getElementById('phExpenses').insertAdjacentHTML('beforeend',phExpenseRow());};
App.projectHistoryRecordSave=function(e,pid,tid){e.preventDefault();const get=id=>document.getElementById(id).value,items=[...e.target.querySelectorAll('.ph-expense')].map(row=>{const v=name=>row.querySelector(`[name=${name}]`).value;return {name:v('expenseName'),category:v('expenseCategory'),qty:v('expenseQty'),unit:v('expenseUnit'),amount:v('expenseAmount'),funding:row.querySelector('[name=expenseSupported]').checked?'supported':'paid',sponsor:v('expenseSponsor')};});phRun(()=>projectHistoryRecord(pid,{title:get('phTitle'),date:get('phDate'),income:get('phIncome'),note:get('phNote'),noCost:document.getElementById('phNoCost').checked,pending:document.getElementById('phPending').checked,dataNote:get('phDataNote'),items},tid));return false;};
