/* Proposal and approval metadata never post to the activity or stock ledger. */
'use strict';
function projectBudgetSummary(p,cost=projectCosts(p).cost){
  const requested=p.proposal?.budget,approved=p.budgetApproval?.amount;
  const has=v=>v!=='' && v!=null && Number.isFinite(Number(v)) && Number(v)>=0;
  return {requested:has(requested)?Number(requested):null,approved:has(approved)?Number(approved):null,actual:Number(cost)||0,remaining:has(approved)?Number(approved)-(Number(cost)||0):null};
}
function projectBudgetText(p,cost){
  const b=projectBudgetSummary(p,cost);
  return [b.requested==null?'ยังไม่ระบุงบเสนอ':'งบเสนอ '+fmtMoney(b.requested)+' บาท',b.approved==null?'ยังไม่บันทึกงบอนุมัติ':'งบอนุมัติ '+fmtMoney(b.approved)+' บาท',b.remaining==null?'':(b.remaining<0?'เกินงบอนุมัติ ':'คงเหลือจากงบอนุมัติ ')+fmtMoney(Math.abs(b.remaining))+' บาท'].filter(Boolean).join(' · ');
}
function projectRecordBudgetApproval(p,values){
  if(!p || p.status==='done')throw Error('เปิดโครงการก่อนบันทึกผลอนุมัติ');
  const amount=Number(values.amount),date=String(values.date||'');
  if(String(values.amount??'').trim()===''||!Number.isFinite(amount)||amount<0)throw Error('ระบุวงเงินที่อนุมัติตั้งแต่ 0 บาท');
  if(!trialValidDate(date)||date>todayISO())throw Error('ตรวจวันที่อนุมัติ ต้องไม่เป็นวันในอนาคต');
  if(!values.approver?.trim()||!values.reference?.trim())throw Error('ระบุผู้อนุมัติและเลขเอกสารหรือแหล่งอ้างอิง');
  const approval={id:uid(),amount:Math.round(amount*100)/100,date,approver:values.approver.trim().slice(0,150),reference:values.reference.trim().slice(0,500),recordedAt:Date.now(),proposal:projectClone(p.proposal||{}),name:p.name,objective:p.objective,startDate:p.startDate||'',endDate:p.endDate||'',plotId:p.plotId||'',cycleId:p.cycleId||''};
  p.budgetApprovals=p.budgetApprovals||[];p.budgetApprovals.push(projectClone(approval));p.budgetApproval=approval;p.updatedAt=Date.now();return approval;
}
function projectBudgetPanel(p){
  const a=p.budgetApproval;
  return `<section class="pp-card pp-budget"><h2>งบประมาณและผลอนุมัติ</h2><p>${esc(projectBudgetText(p))}</p><small>งบเสนอและงบอนุมัติไม่ใช่ค่าใช้จ่ายจริง ค่าใช้จ่ายมาจากยอดใช้จริงที่บันทึก แม้งานไม่สำเร็จ</small>${a?`<p>บันทึกอนุมัติ ${esc(dateLabel(a.date))} · ${esc(a.approver)}<br>${esc(a.reference)}</p><details><summary>ข้อมูลที่ใช้ตอนอนุมัติและประวัติ</summary>${(p.budgetApprovals||[a]).slice().reverse().map(v=>`<p><b>${esc(dateLabel(v.date))} · ${fmtMoney(v.amount)} บาท</b><br>${esc(v.name)}<br>${esc(v.objective)}<br>${esc(v.reference)}</p>`).join('')}</details>`:'<p>ส่งข้อเสนอให้ตรวจตามขั้นตอนของหน่วยงาน แล้วนำผลอนุมัติมาบันทึกที่นี่</p>'}<button class="btn btn-outline" ${p.status==='done'?'disabled':''} onclick="App.projectBudgetModal()">บันทึกผลอนุมัติที่ได้รับ</button></section>`;
}
App.projectBudgetModal=function(){const p=projectById(route.projectId);if(!p||p.status==='done')return;openModal(`<h3>บันทึกผลอนุมัติที่ได้รับ</h3><p>ใช้เก็บผลอนุมัติจากหัวหน้าหรือบัญชี ไม่ได้ส่งขออนุมัติจากหน้านี้</p><form onsubmit="return App.projectBudgetSave(event)"><div class="field"><label for="pbAmount">วงเงินที่อนุมัติ (บาท)</label><input id="pbAmount" type="number" min="0" step="0.01" required></div><div class="field"><label for="pbDate">วันที่อนุมัติ</label><input id="pbDate" type="date" max="${todayISO()}" required></div><div class="field"><label for="pbApprover">ผู้อนุมัติ</label><input id="pbApprover" maxlength="150" required></div><div class="field"><label for="pbReference">เลขเอกสารหรือแหล่งอ้างอิงผลอนุมัติ</label><textarea id="pbReference" maxlength="500" required></textarea></div><p>เก็บข้อมูลข้อเสนอ ณ วันนี้ไว้กับผลอนุมัติ การแก้ข้อเสนอภายหลังจะไม่เปลี่ยนประวัตินี้</p><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button><button class="btn btn-primary" type="submit">บันทึกผลอนุมัติ</button></div></form>`);};
App.projectBudgetSave=function(e){e.preventDefault();try{const p=projectById(route.projectId),v={amount:document.getElementById('pbAmount').value,date:document.getElementById('pbDate').value,approver:document.getElementById('pbApprover').value,reference:document.getElementById('pbReference').value};const r=projectTransaction(()=>projectRecordBudgetApproval(p,v));if(r.ok){closeModal();render();toast('บันทึกผลอนุมัติแล้ว');}}catch(error){toast(error.message);}return false;};
App.proposalNew=function(plotId='',cycleId=''){
  projectDraft={version:1,name:'',objective:'',brief:'',kind:'work',entryMode:'proposal',flowStep:'proposal',plotId,cycleId,startDate:'',endDate:'',assignee:'',schema:[],groups:[],proposal:{budget:'',method:'',resources:'',support:''},stages:[{id:uid(),name:'งานในโครงการ',tasks:[]}]};
  projectDraftOwner=projectDraftKey();projectStoreDraft();route.view='projectDraft';render();
};
App.proposalReviewTasks=function(){
  if(!projectDraft.stages.some(s=>s.tasks.length)){
    const suggestion=projectSuggest(projectDraft.brief||projectDraft.name||'ดูแลแปลง',projectDraft.startDate,'work');
    projectDraft.stages=suggestion.stages;
  }
  App.proposalStep('tasks');
};
function projectCreateProposal(d,withTasks=false){
  if(!d?.name?.trim()||!d.objective?.trim())throw Error('ระบุชื่อโครงการและวัตถุประสงค์ก่อนตั้งโครงการ หรือเก็บเป็นร่างไว้ก่อน');
  const draft=projectClone(d);draft.proposal=draft.proposal||{};draft.proposal.method=draft.proposal.method||projectProposalValues(d).method;if(!withTasks)draft.stages=[{id:uid(),name:'งานในโครงการ',tasks:[]}];
  const p=projectCreateFromDraft(draft,{allowEmpty:true});p.entryMode='proposal';return p;
}
App.proposalCreateOnly=function(){try{
  if(projectDraftOwner!==projectDraftKey())throw Error('บัญชีเปลี่ยนแล้ว กรุณาเปิดร่างของบัญชีนี้');
  const result=projectTransaction(()=>projectCreateProposal(projectDraft));if(!result.ok)return;
  try{localStorage.removeItem(projectDraftKey());}catch(_){}projectDraft=null;projectWorkspaceTab='info';App.projectOpen(result.value.id);toast('ตั้งโครงการแล้ว ส่งออกข้อเสนอและบันทึกงานได้');
}catch(error){toast(error.message);}};
App.proposalLogNew=function(){const p=projectById(route.projectId);if(!p||p.status==='done')return;App.closeModal();App.modalTask(todayISO(),{type:'work',status:'done',projectId:p.id,projectStageId:p.stages?.[0]?.id||'',plotId:p.plotId||'',cycleId:p.cycleId||''});};
