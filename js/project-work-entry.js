/* Present the existing activity form in the project page; its validator and ledger remain canonical. */
'use strict';
let projectEntryTaskId='',projectEntryOwner='',projectEntryBefore=null,projectEntrySaving=false;
const legacyProjectLogWork=App.projectLogWork,legacyProjectTaskComplete=App.projectTaskComplete;
function projectEntryKey(id){return projectDraftKey()+'::work::'+id;}
function projectEntryPrepare(data,existing){if(!projectEntrySaving || existing?.id!==projectEntryTaskId)return;data.doneNote=data.note;data.note=existing.note || '';data.photos=taskPhotos(existing).slice();data.donePhotos=taskFormPhotos.slice();}
function projectEntryMaterialError(type,useCost,items){
  if(!['spray','fertilize'].includes(type))return '';
  const materials=items.filter(it=>!it.projectEntryExpense);
  if(!useCost || !materials.length)return 'ระบุวัสดุและปริมาณที่ใช้จริงก่อนบันทึกงานยา/ปุ๋ย';
  for(const it of materials){const qty=Number(it.usageUnit?it.usageQty:it.qty);if(!(it.name || it.stockId) || !Number.isFinite(qty) || qty<=0 || !(it.usageUnit || it.unit))return 'ตรวจชื่อวัสดุ หน่วย และปริมาณที่ใช้จริงให้มากกว่า 0';}
  return '';
}
function projectEntryPage(p){
  const t=S.tasks.find(t=>t.id===projectEntryTaskId && t.projectId===p.id);if(!t){projectEntryTaskId='';return renderProjectDetail();}
  setTimeout(()=>{if(route.view==='projectDetail' && route.projectId===p.id && projectEntryTaskId===t.id && !document.querySelector('.pp-entry-form'))projectEntryMount(p,t);},0);
  return `<div class="project-page pw-page pp-page pp-entry"><header class="pp-heading"><div><h1>บันทึกงาน${esc(t.type==='fertilize'?'ใส่ปุ๋ย':t.type==='spray'?'ใช้ยา':'')}</h1><p>กรอกข้อมูลที่ใช้จริง แล้วตรวจปริมาณและต้นทุนก่อนยืนยัน</p></div><button class="btn btn-outline" onclick="App.projectEntryClose()">${pwIcon('arrow-left')} กลับไปโครงการ</button></header>${ppContext(p)}<div id="ppEntryMount" aria-live="polite">กำลังเตรียมแบบบันทึก…</div></div>`;
}
App.projectLogWork=function(pid,tid){const p=projectById(pid),t=S.tasks.find(t=>t.id===tid && t.projectId===pid);if(!p || !t)return;if(projectHasExperiment(p)||p.status==='done'||t.status!=='planned'||!t.plotId||!t.cycleId||hasTaskStockUse(t))return legacyProjectLogWork(pid,tid);projectEntryTaskId=tid;projectEntryOwner=projectEntryKey(tid);route.projectId=pid;route.view='projectDetail';render();};
App.projectTaskComplete=function(id=projectSelectedTask){const p=projectById(route.projectId);if(p&&!projectHasExperiment(p))return App.projectLogWork(p.id,id);return legacyProjectTaskComplete(id);};
function projectEntryMount(p,t){
  const mount=document.getElementById('ppEntryMount');if(!mount)return;
  App.modalTask(todayISO(),{taskId:t.id,completionReview:true});
  taskFormPhotos=taskDonePhotosOf(t).slice();
  const form=document.querySelector('.task-form');if(!form)return;
  mount.replaceChildren(form);closeModal();form.classList.add('pp-entry-form');form.onsubmit=e=>{e.preventDefault();App.projectEntryReview();return false;};
  if(typeof Auth!=='undefined'){Auth.formEditing=true;Auth._editingForm=form;}
  const context=form.querySelector('[data-task-step="0"]'),details=form.querySelector('[data-task-step="1"]');context.hidden=true;
  const layout=document.createElement('div');layout.className='pp-columns pp-entry-columns';layout.innerHTML='<div class="pp-entry-fields"></div><aside id="ppEntryReview" class="pp-card pp-entry-review"></aside>';form.prepend(layout);
  const left=layout.firstElementChild,dateCard=document.createElement('section');dateCard.className='pp-card';dateCard.innerHTML='<h2>ข้อมูลการทำงาน</h2><div class="pp-fields"></div>';
  dateCard.lastElementChild.append(document.getElementById('t_date').closest('.field'));const time=document.createElement('label');time.className='pp-field';time.innerHTML='เวลา (ไม่บังคับ)<input id="peActualTime" type="time">';dateCard.lastElementChild.append(time);left.append(dateCard);
  const costs=document.createElement('section');costs.className='pp-card pp-material-card'+(['spray','fertilize'].includes(t.type)?' pp-material-required':'');costs.innerHTML='<h2>วัสดุและปริมาณที่ใช้</h2>';costs.append(dateCard.lastElementChild,document.getElementById('t_usecost').closest('label'),document.getElementById('costBox'));dateCard.remove();left.append(costs);
  const area=document.getElementById('materialAreaFields');if(area){const advanced=document.createElement('details');advanced.className='pp-area-options';advanced.innerHTML='<summary>พื้นที่ที่ทำงาน</summary>';costs.prepend(advanced);advanced.append(area);}
  const extras=document.createElement('section');extras.className='pp-card';extras.innerHTML='<h2>ค่าใช้จ่ายเพิ่มเติม</h2><div class="pp-fields"><label class="pp-field">ค่าแรง (บาท)<input id="peLabor" type="number" min="0" step="0.01" placeholder="ยังไม่ระบุ" oninput="App.projectEntryExpense(\'labor\',this.value)"></label><label class="pp-field">ค่าใช้จ่ายอื่น (บาท)<input id="peOther" type="number" min="0" step="0.01" placeholder="ยังไม่ระบุ" oninput="App.projectEntryExpense(\'other\',this.value)"></label></div><small>ค่าวัสดุจากคลังรวมไว้แล้ว</small>';left.append(extras);
  const evidence=form.querySelector('.task-extras');evidence.open=true;evidence.classList.add('pp-card');evidence.querySelector('summary').textContent='บันทึกการทำงานและรูปภาพ';left.append(evidence);document.querySelector('label[for="t_note"]').textContent='บันทึกการทำงาน';document.getElementById('t_note').placeholder='ทำอะไรไปบ้าง มีข้อสังเกตอะไร';
  const incomeChoice=document.getElementById('t_useincome')?.closest('label');if(incomeChoice)left.append(incomeChoice);const quality=form.querySelector('.task-data-review');if(quality)left.append(quality);
  for(const box of ['inspectionBox','waterBox','taskHarvestOption','harvestBox','incomeBox']){const el=document.getElementById(box);if(el)left.append(el);}
  details.hidden=true;
  form.querySelector('#cwTaskSummary')?.remove();
  const actions=document.createElement('div');form.append(actions);actions.className='pp-actions';actions.innerHTML='<button type="button" class="btn btn-outline" onclick="App.projectEntryClose()">ยกเลิก</button><span id="ppEntryDraftStatus" role="status">ยังไม่บันทึกค่าใช้จ่ายหรือตัดสต็อก</span><button type="button" class="btn btn-outline" onclick="App.projectEntryClose()">เก็บเป็นร่าง</button><button type="submit" class="btn btn-primary" id="taskSubmitButton">ตรวจและยืนยันบันทึก '+pwIcon('arrow-right')+'</button>';
  try{const d=JSON.parse(localStorage.getItem(projectEntryOwner));if(d?.taskId===t.id && d.account===projectDraftKey() && d.base===(t.updatedAt || t.createdAt || 0)){for(const [id,value] of Object.entries(d.fields)){const el=document.getElementById(id);if(el && id!=='t_status'){if(el.type==='checkbox')el.checked=!!value;else el.value=value;}}taskCostItems=d.items || taskCostItems;taskFormPhotos=d.photos || [];}}catch(_){}
  document.getElementById('t_status').value='done';
  for(const it of taskCostItems)if(!it.name && !it.stockId && S.stock.length){it.source='stock';it.showStockPicker=true;}
  for(const [id,key] of [['peLabor','labor'],['peOther','other']]){const row=taskCostItems.find(ci=>ci.projectEntryExpense===key);if(row)document.getElementById(id).value=row.totalCost;}
  App.costRender();App.taskToggleCost();App.taskToggleIncome?.();renderTaskPhotoPreview('form');
  form.addEventListener('input',()=>{projectEntryRefresh();projectEntryStore();});form.addEventListener('change',()=>{projectEntryRefresh();projectEntryStore();});projectEntryRefresh();
}
function projectEntryStore(){const form=document.querySelector('.pp-entry-form');if(!form || !projectEntryTaskId || projectEntryOwner!==projectEntryKey(projectEntryTaskId))return false;const t=S.tasks.find(t=>t.id===projectEntryTaskId),fields={};form.querySelectorAll('[id^="t_"],#peActualTime').forEach(el=>{if(['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&el.type!=='file')fields[el.id]=el.type==='checkbox'?el.checked:el.value;});try{localStorage.setItem(projectEntryOwner,JSON.stringify({taskId:t.id,account:projectDraftKey(),base:t.updatedAt || t.createdAt || 0,fields,items:taskCostItems,photos:taskFormPhotos}));return true;}catch(_){const el=document.getElementById('ppEntryDraftStatus');if(el)el.textContent='เก็บร่างไม่ได้ อย่าเพิ่งปิดหน้านี้';return false;}}
App.projectEntryExpense=function(key,value){let item=taskCostItems.find(ci=>ci.projectEntryExpense===key);if(value===''){taskCostItems=taskCostItems.filter(ci=>ci!==item);}else{if(!item){item={category:key==='labor'?'labor':'other',name:key==='labor'?'ค่าแรง':'ค่าใช้จ่ายอื่น',source:'external',stockId:'',stockMode:'record',externalPriceMode:'total',qty:1,unit:'ครั้ง',projectEntryExpense:key};taskCostItems.push(item);}item.unitCost=value;item.externalTotal=value;item.totalCost=Number(value);document.getElementById('t_usecost').checked=true;}App.costRender();App.taskToggleCost();projectEntryStore();};
function projectEntryRefresh(){
  const target=document.getElementById('ppEntryReview');if(!target)return;const use=document.getElementById('t_usecost')?.checked,items=use?taskCostItems:[],total=items.reduce((sum,it)=>sum+(Number(costTotal(it))||0),0);let stock='';
  try{stock=taskWizardStockPreview(S,items.filter(it=>it.stockId),'done').map(({before,after})=>`<p>${esc(before.name)} <b>${fmtNum(before.qty)} → ${fmtNum(after.qty)} ${esc(before.unit || '')}</b></p>`).join('');}catch(e){stock=`<p class="pp-notice">${esc(e.message)}</p>`;}
  target.innerHTML=`<h2>ตรวจปริมาณและต้นทุน</h2><span class="pp-tag">ยอดก่อนยืนยัน</span><div class="pp-entry-totals">${items.filter(it=>it.name || it.stockId).map(it=>`<div><span>${esc(it.name || stockById(S,it.stockId)?.name || 'วัสดุ')}<small>${esc([it.usageQty ?? it.qty,it.usageUnit || it.unit].filter(v=>v!==''&&v!=null).join(' '))}</small></span><b>${fmtMoney(costTotal(it))} บาท</b></div>`).join('') || '<p>ยังไม่มีค่าใช้จ่ายที่ระบุ</p>'}<div class="pp-context"><b>ต้นทุนรายการนี้</b><strong>${fmtMoney(total)} บาท</strong></div></div>${stock?`<section class="pp-card pp-stock-after"><h3>สต็อกหลังยืนยัน</h3>${stock}</section>`:''}<p class="pp-notice">ตรวจชื่อวัสดุ หน่วย ปริมาณ และยอดรวมก่อนยืนยัน</p><h3>หลังยืนยัน ข้อมูลจะอัปเดตที่</h3><ul><li>ประวัติงานของแปลง</li><li>ยาและปุ๋ยของรอบปลูก</li><li>ต้นทุนรอบปลูกและโครงการ</li><li>เล่มสรุปโครงการ</li></ul><small>ใช้บันทึกเดียวกันทุกหน้า ต้นทุนรายการนี้นับครั้งเดียว</small>`;
  document.querySelectorAll('#costItemsList [data-ci]').forEach(el=>{el.hidden=!!taskCostItems[Number(el.dataset.ci)]?.projectEntryExpense;});
}
function projectEntryCompactMaterials(openRows=[]){
  if(!document.querySelector('.pp-entry-form'))return;
  document.querySelectorAll('#costItemsList [data-ci]').forEach(row=>{
    const it=taskCostItems[Number(row.dataset.ci)];if(!it || it.projectEntryExpense)return;
    if(!it.stockId){row.classList.toggle('pp-stock-picking',it.source==='stock' && !!it.showStockPicker);return;}
    row.classList.add('pp-stock-chosen');
    const head=row.querySelector('.usage-row-head'),source=row.querySelector('.cost-source-fields'),values=row.querySelector('.ci-qty')?.closest('.form-row-2'),total=row.querySelector('.ci-total')?.closest('.field');
    if(!values || !total)return;
    const advanced=document.createElement('details');advanced.className='pp-material-options';advanced.open=openRows.includes(row.dataset.ci);advanced.innerHTML='<summary>ราคา หน่วยบรรจุ และวิธีเบิก</summary>';
    values.append(total);values.classList.add('pp-material-values');total.querySelector('label').textContent='ค่าวัสดุ (บาท)';
    for(const child of [...row.children])if(child!==head && child!==source && child!==values)advanced.append(child);
    const category=source?.querySelector('.cost-category');if(category)advanced.prepend(category);
    row.append(advanced);
    const mode={package:'เบิกเต็มขวด/ถุง',partial:'ใช้บางส่วน · เก็บที่เหลือ',open:'ใช้เฉพาะของเปิด',record:'ไม่ตัดสต็อก'}[costStockMode(it)] || 'วิธีเบิก';advanced.querySelector('summary').textContent=mode+' · ดูราคาและหน่วยบรรจุ';
  });
}
const ppCostRender=App.costRender;App.costRender=function(...args){const openRows=[...document.querySelectorAll('.pp-material-options[open]')].map(el=>el.closest('[data-ci]').dataset.ci);const result=ppCostRender.apply(this,args);projectEntryCompactMaterials(openRows);projectEntryRefresh();return result;};
const ppCostSet=App.costSet;App.costSet=function(...args){const result=ppCostSet.apply(this,args);projectEntryRefresh();projectEntryStore();return result;};
const ppPhotoRender=renderTaskPhotoPreview;renderTaskPhotoPreview=function(mode){ppPhotoRender(mode);if(mode==='form' && projectEntryTaskId)projectEntryStore();};
App.projectEntryClose=function(){if(taskPhotoUploading.form){toast('รอเพิ่มรูปให้เสร็จก่อน');return;}if(projectEntryStore()){projectEntryTaskId='';taskEditingId='';render();}};
App.projectEntryReview=function(){
  if(projectEntrySaving || taskPhotoUploading.form)return;
  const form=document.querySelector('.pp-entry-form'),id=projectEntryTaskId,p=projectById(route.projectId);if(!form || !p || p.status==='done' || projectEntryOwner!==projectEntryKey(id))return;
  const materialError=projectEntryMaterialError(document.getElementById('t_type').value,document.getElementById('t_usecost').checked,taskCostItems);
  if(materialError){toast(materialError);document.querySelector('#costItemsList .ci-qty')?.focus();return;}
  for(const input of form.querySelectorAll(':invalid'))for(let el=input.parentElement;el && el!==form;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;
  if(!form.reportValidity())return;
  if(!App.submitTask({preventDefault(){}},id,true)){form.querySelectorAll('.pp-material-options').forEach(el=>el.open=true);return;}
  projectEntryStore();const total=document.getElementById('t_usecost').checked?taskCostItems.reduce((n,it)=>n+costTotal(it),0):0;
  App.confirm('ยืนยันบันทึกงานและต้นทุน?',`วันที่ ${dateLabel(document.getElementById('t_date').value)} · รวม ${fmtMoney(total)} บาท · ${taskFormPhotos.length} รูป\nเมื่อยืนยันจะทำเครื่องหมายงานเสร็จและปรับสต็อกตามรายการ`,()=>{if(projectEntrySaving || S.tasks.find(t=>t.id===id)?.status!=='planned')return;projectEntrySaving=true;projectEntryBefore=JSON.parse(JSON.stringify(S));App.submitTask({preventDefault(){}},id);projectEntrySaving=false;});
};
function projectEntrySaved(id){if(!projectEntrySaving || id!==projectEntryTaskId)return true;if(typeof storageSaveFailed!=='undefined' && storageSaveFailed){if(projectEntryBefore)S=projectEntryBefore;projectEntryBefore=null;projectEntrySaving=false;toast('ยังบันทึกไม่ได้ เก็บร่างไว้เพื่อยืนยันอีกครั้ง');return false;}try{localStorage.removeItem(projectEntryOwner);}catch(_){}projectEntryTaskId='';projectEntryBefore=null;return true;}
