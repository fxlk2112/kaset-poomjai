/* Keep one live form across steps; drafts never enter the farm state or stock ledger. */
function taskWizardStockPreview(state,items,status) {
  if(status!=='done')return [];
  const staged={...state,stock:state.stock.map(row=>({...row}))};
  const task={status,stockState:'reserved',stockLog:[],costItems:JSON.parse(JSON.stringify(items))};
  prepareTaskStock(staged,task);
  const ids=new Set((task.stockLog || []).map(row=>row.stockId));
  return [...ids].map(id=>({before:stockById(state,id),after:stockById(staged,id)}));
}
const TaskWizard = {
  step:0, ready:false, timer:null, form:null, owner:'',
  key() { return 'farmult-task-draft-v1::'+String(Auth.session?.email || 'local').toLowerCase(); },
  read() {
    try { const d=JSON.parse(localStorage.getItem(this.key()));return d?.version===1 && d.fields && Array.isArray(d.items)?d:null; }
    catch (_) { return null; }
  },
  active() { return this.ready && this.form?.isConnected && this.owner===this.key(); },
  capture() {
    const fields={};
    this.form.querySelectorAll('[id^="t_"]').forEach(el=>{
      if(!['INPUT','SELECT','TEXTAREA'].includes(el.tagName) || el.type==='file')return;
      fields[el.id]={value:el.value,checked:el.checked};
    });
    return {version:1,at:Date.now(),step:this.step,fields,autoTitle:document.getElementById('t_title').dataset.autoTitle,
      items:taskCostItems,costDrafts:App._taskCostDrafts,water:taskWaterSessions,photos:taskFormPhotos,inspection:Inspection.draft,
      multiPlot:this.multiPlot,plotSelections:this.plotSelections};
  },
  persist() {
    clearTimeout(this.timer);
    if(!this.active())return false;
    const status=document.getElementById('taskDraftStatus');
    try { localStorage.setItem(this.owner,JSON.stringify(this.capture()));if(status)status.textContent='เก็บฉบับร่างในเครื่องนี้แล้ว';return true; }
    catch (_) { if(status)status.textContent='เก็บฉบับร่างไม่ได้ พื้นที่เครื่องอาจเต็ม อย่าเพิ่งปิดหน้านี้';return false; }
  },
  schedule() { if(this.active()){clearTimeout(this.timer);this.timer=setTimeout(()=>this.persist(),250);} },
  completed() { clearTimeout(this.timer);if(this.owner)try{localStorage.removeItem(this.owner);}catch(_){} this.ready=false; },
  close() {
    if(!this.ready){closeModal();return;}
    if(taskPhotoUploading.form || Inspection.pending){toast('รอเพิ่มรูปให้เสร็จก่อนปิด');return;}
    if(this.persist()){this.ready=false;closeModal();}
    else toast('เก็บฉบับร่างไม่ได้ กรุณาบันทึกกิจกรรมก่อนปิด');
  },
  init(preset={}) {
    clearTimeout(this.timer);this.ready=false;this.form=null;
    if(taskEditingId)return;
    const form=document.querySelector('.task-form');if(!form)return;
    this.form=form;this.owner=this.key();this.step=0;
    this.multiPlot=false;this.plotSelections=[];this.lastMultiActive=false;
    form.classList.add('task-wizard');form.noValidate=true;
    const first=form.querySelector('[data-task-step="0"]');
    const plots=document.createElement('section');plots.id='taskMultiPlot';
    plots.innerHTML='<label class="option-box"><input type="checkbox" id="taskMultiPlotEnabled" onchange="TaskWizard.togglePlots(this.checked)"><span>ใช้ยา / ปุ๋ยเดียวกันหลายแปลง</span></label><div id="taskMultiPlotRows" hidden></div>';
    document.getElementById('taskPlotCycleFields').before(plots);
    const compact=first.querySelector('.inspection-task-options');
    if(compact){[...compact.querySelectorAll('.field')].forEach(el=>first.append(el));compact.remove();}
    const types=document.createElement('fieldset');types.className='task-type-options';
    types.innerHTML='<legend>ทำอะไร?</legend><div>'+Object.keys(TYPE_LABELS).map(type=>`<button type="button" data-wizard-type="${type}" onclick="TaskWizard.type('${type}')">${ic(TYPE_ICONS[type])}<span>${esc(TYPE_LABELS[type])}</span></button>`).join('')+'</div>';
    const typeField=document.getElementById('t_type').closest('.field');typeField.hidden=true;
    first.querySelector('.task-mode').after(types);
    const dateRow=document.getElementById('t_date').closest('.form-row-2');
    form.append(document.getElementById('t_status').closest('.field'));
    dateRow.append(document.getElementById('t_title').closest('.field'));
    const nav=document.createElement('nav');nav.className='task-step-nav';nav.setAttribute('aria-label','ขั้นตอนบันทึกกิจกรรม');
    nav.innerHTML=['งานและแปลง','รายละเอียดงาน','ตรวจและบันทึก'].map((label,i)=>`<button type="button" data-wizard-step="${i}" onclick="TaskWizard.go(${i})"><b>${i+1}</b><span>${label}</span></button>`).join('');
    form.prepend(nav);
    const summary=document.getElementById('cwTaskSummary');
    const review=document.createElement('section');review.dataset.taskStep='2';review.className='task-wizard-review';
    review.innerHTML='<div id="taskReviewContext"></div><div class="task-review-edit"><button type="button" class="btn btn-outline" onclick="TaskWizard.go(0)">'+ic('pencil')+' แก้งานและแปลง</button><button type="button" class="btn btn-outline" onclick="TaskWizard.go(1)">'+ic('pencil')+' แก้รายละเอียด</button></div>';
    if(summary)review.prepend(summary);form.append(review);
    const actions=document.getElementById('taskSubmitButton').closest('.modal-actions');actions.classList.add('task-wizard-actions');
    actions.querySelector('button[type="button"]').textContent='เก็บร่างและปิด';
    const back=document.createElement('button');back.type='button';back.id='taskStepBack';back.className='btn btn-outline';back.setAttribute('aria-label','ย้อนกลับ');back.title='ย้อนกลับ';back.innerHTML=ic('chevron');back.onclick=()=>this.go(this.step-1);actions.prepend(back);
    const next=document.createElement('button');next.type='button';next.id='taskStepNext';next.className='btn btn-primary';next.innerHTML='ถัดไป '+ic('chevron');next.onclick=()=>this.go(this.step+1);actions.append(next);
    const status=document.createElement('p');status.id='taskDraftStatus';status.className='task-draft-status';status.setAttribute('role','status');form.append(status);
    form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();if(this.step<2){this.go(this.step+1);return;}if(this.validate(0)&&this.validate(1)){this.show(2);wizardSubmitTask(e,'');}},true);
    this.ready=true;this.renderPlots();this.show(0,false);
    const draft=preset._wizardDraft || this.read();
    if(preset._wizardDraft){this.restore(draft);return;}
    if(draft){
      this.ready=false;form.hidden=true;actions.hidden=true;
      const prompt=document.createElement('section');prompt.id='taskDraftResume';prompt.className='task-draft-resume';
      prompt.innerHTML=`<h4>มีฉบับร่างที่ยังไม่บันทึก</h4><p>${esc(draft.fields.t_title?.value || 'กิจกรรม')} · ${esc(draft.fields.t_date?.value || '')}</p><button type="button" class="btn btn-primary" onclick="TaskWizard.resume()">กรอกต่อจากฉบับร่าง</button> <button type="button" class="btn btn-ghost" onclick="TaskWizard.fresh()">ทิ้งฉบับร่างและเริ่มใหม่</button>`;
      form.before(prompt);
    }
  },
  resume() {
    const d=this.read();if(!d){this.fresh();return;}
    App.modalTask(d.fields.t_date?.value,{type:d.fields.t_type?.value,status:d.fields.t_status?.value,plotId:d.fields.t_plot?.value,cycleId:d.fields.t_cycle?.value,_wizardDraft:d});
  },
  fresh() {
    try{localStorage.removeItem(this.owner);}catch(_){}
    document.getElementById('taskDraftResume')?.remove();this.form.hidden=false;
    document.getElementById('taskSubmitButton').closest('.modal-actions').hidden=false;
    this.ready=true;this.show(0);
  },
  restore(d) {
    this.ready=false;
    for(const [id,entry] of Object.entries(d.fields)){
      if(!/^t_[a-z_]+$/.test(id))continue;
      const el=this.form.querySelector('#'+id);if(!el)continue;
      if(el.tagName==='SELECT' && ![...el.options].some(o=>o.value===entry.value))continue;
      el.value=entry.value;if(el.type==='checkbox'||el.type==='radio')el.checked=!!entry.checked;
    }
    taskCostItems=d.items;App._taskCostDrafts=d.costDrafts || {};taskWaterSessions=d.water || [];taskFormPhotos=d.photos || [];
    this.multiPlot=!!d.multiPlot;this.plotSelections=Array.isArray(d.plotSelections)?d.plotSelections:[];
    document.getElementById('t_title').dataset.autoTitle=d.autoTitle || 'false';
    document.getElementById('inspectionBox').outerHTML=Inspection.begin({inspection:d.inspection});
    App.taskTypeChange();App.taskToggleCost();App.taskToggleHarvest();App.waterSessionsRender();App.costRender();
    renderTaskPhotoPreview('form');Inspection.contextRefresh();Inspection.pointsRender();
    labelFormFields(this.form);ConceptWorkflows.formSummary();
    this.renderPlots();
    this.ready=true;this.show(0,false);
    const step=Number.isInteger(d.step)?Math.max(0,Math.min(2,d.step)):0;
    if(step)this.go(step);else this.persist();
  },
  type(type) {
    document.getElementById('t_type').value=type;App.taskTypeChange();this.renderPlots();this.show(this.step,false);this.schedule();
  },
  usesPlots() {
    return !!this.multiPlot && ['spray','fertilize'].includes(document.getElementById('t_type')?.value);
  },
  selections() { return this.usesPlots()?this.plotSelections.filter(row=>row.selected):[]; },
  togglePlots(enabled) {
    this.multiPlot=enabled;
    if(enabled && !this.plotSelections.length){
      const plotId=document.getElementById('t_plot').value;
      if(plotId)this.plotSelections.push({plotId,selected:true,cycleId:document.getElementById('t_cycle').value,areaRai:document.getElementById('t_material_area').value || plotById(S,plotId)?.sizeRai || ''});
    }
    this.renderPlots();this.schedule();
  },
  renderPlots() {
    const mount=document.getElementById('taskMultiPlot');if(!mount)return;
    mount.hidden=!['spray','fertilize'].includes(document.getElementById('t_type').value);
    document.getElementById('taskMultiPlotEnabled').checked=this.multiPlot;
    const enabled=this.usesPlots(), rows=document.getElementById('taskMultiPlotRows');rows.hidden=!enabled;
    document.getElementById('taskPlotCycleFields').hidden=enabled;
    const area=document.getElementById('t_material_area');area.readOnly=enabled;
    document.querySelector('label[for="t_material_area"]').textContent=enabled?'พื้นที่ทำจริงรวมทุกแปลง (ไร่)':'พื้นที่ใช้ยา/ปุ๋ย (ไร่)';
    if(!enabled){if(this.lastMultiActive){this.form.querySelectorAll('.ci-area').forEach(input=>{input.readOnly=false;});App.costAreaSetPlot();App.taskScopeChange();}this.lastMultiActive=false;return;}
    this.lastMultiActive=true;
    rows.innerHTML=S.plots.map((plot,i)=>{
      const row=this.plotSelections.find(r=>r.plotId===plot.id);
      const cycles=S.cycles.filter(c=>c.plotId===plot.id&&c.status==='active');
      const farm=(S.farms||[]).find(f=>f.id===plot.farmId);
      return `<div class="task-plot-choice"><label class="task-plot-check"><input type="checkbox" ${row?.selected?'checked':''} onchange="TaskWizard.selectPlot(${i},this.checked)"><span><b>${esc(plot.name)}</b>${farm?'<small>'+esc(farm.name)+'</small>':''}</span></label>${row?.selected?`<div class="task-plot-inputs"><div class="field"><label for="multiCycle${i}">รอบปลูก · ${esc(plot.name)}</label><select id="multiCycle${i}" onchange="TaskWizard.plotField(${i},'cycleId',this.value)"><option value="">เลือกรอบปลูก</option>${cycles.map(c=>`<option value="${esc(c.id)}" ${row.cycleId===c.id?'selected':''}>${esc(c.plant)} · รอบ ${esc(c.round||'-')}</option>`).join('')}<option value="__none__" ${row.cycleId==='__none__'?'selected':''}>ต้นทุนรวมแปลง (ไม่ผูกรอบ)</option></select></div><div class="field"><label for="multiArea${i}">พื้นที่ทำจริง (ไร่)</label><input id="multiArea${i}" type="number" min="0.0001" ${Number(plot.sizeRai)>0?'max="'+Number(plot.sizeRai)+'"':''} step="any" required value="${esc(row.areaRai)}" oninput="TaskWizard.plotField(${i},'areaRai',this.value)"></div></div>`:''}</div>`;
    }).join('')+'<output id="taskMultiPlotTotal" aria-live="polite"></output>';
    this.syncPlots();
  },
  selectPlot(index,selected) {
    const plot=S.plots[index];if(!plot)return;
    let row=this.plotSelections.find(r=>r.plotId===plot.id);
    if(!row){const cycles=S.cycles.filter(c=>c.plotId===plot.id&&c.status==='active');row={plotId:plot.id,areaRai:plot.sizeRai||'',cycleId:cycles.length===1?cycles[0].id:!cycles.length?'__none__':''};this.plotSelections.push(row);}
    row.selected=selected;this.renderPlots();this.schedule();
  },
  plotField(index,key,value) {
    const row=this.plotSelections.find(r=>r.plotId===S.plots[index]?.id);if(!row)return;
    row[key]=value;this.syncPlots();this.schedule();
  },
  syncPlots() {
    if(!this.usesPlots())return;
    const rows=this.selections(), first=rows[0];
    const plot=document.getElementById('t_plot'),cycle=document.getElementById('t_cycle');
    if(plot.value!==(first?.plotId||'')){plot.value=first?.plotId||'';App.taskPlotChange();}
    cycle.value=first?.cycleId||'';
    const total=rows.reduce((n,r)=>n+(Number(r.areaRai)||0),0);
    document.getElementById('t_material_area').value=total || '';
    this.form.querySelectorAll('.ci-area').forEach(input=>{input.value=total || '';input.readOnly=true;});
    document.getElementById('taskMultiPlotTotal').textContent=`เลือก ${rows.length} แปลง · พื้นที่รวม ${fmtNum(total)} ไร่`;
    document.getElementById('taskScopeSummary').textContent=`${rows.length} แปลง`;
    document.getElementById('taskScopeSummaryDetail').textContent='แบ่งยอดตามพื้นที่ทำจริง · ประวัติแยกแต่ละแปลง';
    App.costRateRefresh();ConceptWorkflows.formSummary();
  },
  batchData() {
    return {type:document.getElementById('t_type').value,status:document.getElementById('t_status').value,
      costItems:document.getElementById('t_usecost').checked?taskCostItems.filter(it=>String(it.name||'').trim() || it.stockId || Number(it.qty)>0 || Number(it.unitCost)>0 || Number(it.totalCost)>0):[]};
  },
  show(step,focus=true) {
    this.step=Math.max(0,Math.min(2,step));
    this.form.querySelectorAll('[data-task-step]').forEach(el=>el.hidden=Number(el.dataset.taskStep)!==this.step);
    this.form.querySelectorAll('[data-wizard-step]').forEach(el=>el.setAttribute('aria-current',Number(el.dataset.wizardStep)===this.step?'step':'false'));
    this.form.querySelectorAll('[data-wizard-type]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.wizardType===document.getElementById('t_type').value)));
    document.getElementById('taskStepBack').hidden=this.step===0;
    document.getElementById('taskStepNext').hidden=this.step===2;
    document.getElementById('taskSubmitButton').hidden=this.step!==2;
    if(this.step===2)this.review();
    if(focus){const current=this.form.querySelector(`[data-wizard-step="${this.step}"]`);current.focus();current.scrollIntoView({block:'nearest'});}
  },
  error(id,message,step) { this.show(step);const input=document.getElementById(id);setModalFieldError(input,message);input?.focus();return false; },
  validate(step) {
    this.show(step,false);
    const panel=this.form.querySelector(`[data-task-step="${step}"]`);
    // Ignore inactive work-type sections, but validate fields in closed optional details.
    const inputs=[...panel.querySelectorAll('input,select,textarea')].filter(el=>!el.disabled && !el.closest('[hidden]') && !el.closest('[style*="display: none"]'));
    const invalid=inputs.find(el=>!el.validity.valid);
    if(invalid){for(let p=invalid.parentElement;p&&p!==panel;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;setModalFieldError(invalid,modalValidationMessage(invalid));invalid.focus();return false;}
    if(step===0){
      const value=id=>document.getElementById(id).value;
      if(!value('t_title').trim())return this.error('t_title','ระบุชื่องาน',0);
      if(!trialValidDate(value('t_date')))return this.error('t_date','ระบุวันที่ให้ถูกต้อง',0);
      if(value('t_status')!=='planned'&&value('t_date')>todayISO())return this.error('t_date','วันที่ทำจริงต้องไม่เกินวันนี้',0);
      if(this.usesPlots()){
        this.syncPlots();
        try{taskPlotAllocations(S,{type:value('t_type'),costItems:[]},this.selections());}
        catch(error){toast(error.message);return false;}
      }
      if(document.getElementById('t_scope_plot').checked){
        if(!value('t_plot'))return this.error('t_plot','เลือกแปลง',0);
        if(!value('t_cycle'))return this.error('t_cycle','เลือกรอบปลูก หรือเลือกยังไม่ปลูกอะไร',0);
      }
      return true;
    }
    if(taskPhotoUploading.form || Inspection.pending){toast('รอเพิ่มรูปให้เสร็จก่อน');return false;}
    if(wizardSubmitTask({preventDefault(){}},'',true)!==true)return false;
    if(this.usesPlots()){
      try { addTasksForPlots({...S,stock:S.stock.map(x=>({...x})),tasks:S.tasks.slice()},this.batchData(),this.selections()); }
      catch(error){toast(error.message);return false;}
    }
    try { taskWizardStockPreview(S,document.getElementById('t_usecost').checked?taskCostItems:[],document.getElementById('t_status').value); }
    catch(error){toast(error.message);return false;}
    return true;
  },
  go(step) {
    if(!this.active())return;
    if(step>this.step){for(let i=this.step;i<step;i++)if(!this.validate(i))return;}
    this.show(step);this.persist();
  },
  review() {
    ConceptWorkflows.formSummary();
    const type=document.getElementById('t_type').value;
    const note=document.getElementById('t_note').value.trim();
    document.getElementById('taskReviewContext').innerHTML=`<dl><div><dt>กิจกรรม</dt><dd>${esc(document.getElementById('t_title').value)}</dd></div><div><dt>วันที่</dt><dd>${esc(dateLabel(document.getElementById('t_date').value))}</dd></div></dl>${type==='water'?'<p>'+esc(waterSessionTotalText(taskWaterSessions))+'</p>':''}${type==='inspect'?'<p>'+esc(inspectionSummary(Inspection.draft))+' · '+fmtNum(Inspection.draft.points.length)+' จุดสำรวจ</p>':''}${note?'<p>'+esc(note)+'</p>':''}<p class="muted">รูปประกอบ ${taskFormPhotos.length} รูป</p>`;
    if(this.usesPlots()){
      const section=document.createElement('section');section.className='task-plot-allocation';
      const tasks=taskPlotAllocations(S,this.batchData(),this.selections());
      section.innerHTML='<h4>ยอดที่แบ่งให้แต่ละแปลง</h4>'+tasks.map(t=>`<div><strong>${esc(plotById(S,t.plotId)?.name)} · ${fmtNum(t.materialAreaRai)} ไร่</strong><small>${t.cycleId?esc(cycleById(S,t.cycleId)?.plant)+' · รอบ '+esc(cycleById(S,t.cycleId)?.round||'-'):'ต้นทุนรวมแปลง'}</small><ul>${t.costItems.map(ci=>`<li>${esc(ci.name||stockById(S,ci.stockId)?.name||'ค่าใช้จ่าย')} <b>${fmtNum(ci.usageUnit?ci.usageQty:ci.qty)} ${esc(unitLabel(ci.usageUnit||ci.unit||''))}</b> · ${fmtMoney(ci.totalCost)} บาท</li>`).join('')}</ul><b>รวม ${fmtMoney(Math.round(t.cost*100)/100)} บาท</b></div>`).join('');
      document.getElementById('taskReviewContext').append(section);
    }
    const stock=taskWizardStockPreview(S,document.getElementById('t_usecost').checked?taskCostItems:[],document.getElementById('t_status').value);
    if(stock.length){const section=document.createElement('section');section.className='task-stock-preview';section.innerHTML='<h4>สต็อกหลังยืนยันบันทึก</h4>'+stock.map(({before,after})=>`<div><strong>${esc(before.name)}</strong><p>สต็อกหลัก ${fmtNum(before.qty)} → ${fmtNum(after.qty)} ${esc(before.unit)}<br>ของเปิดแล้ว ${esc(costOpenedAmount(before,Number(before.openQty)||0))} → ${esc(costOpenedAmount(after,Number(after.openQty)||0))}</p></div>`).join('');document.getElementById('taskReviewContext').append(section);}
  }
};
const wizardModalTask=App.modalTask;
App.modalTask=function(date,preset){wizardModalTask.call(this,date,preset);TaskWizard.init(preset);};
const wizardSubmitTask=App.submitTask;
const wizardCloseModal=App.closeModal;
App.closeModal=function(){if(TaskWizard.form?.isConnected&&!taskEditingId)return TaskWizard.close();return wizardCloseModal.call(this);};
document.addEventListener('click',e=>{if(TaskWizard.active()&&e.target.closest('.task-form button'))TaskWizard.persist();},true);
for(const event of ['input','change','click'])document.addEventListener(event,e=>{if(e.target.closest('.task-form,.task-wizard-actions'))queueMicrotask(()=>TaskWizard.schedule());});
window.addEventListener('pagehide',()=>{if(TaskWizard.active())TaskWizard.persist();});
window.addEventListener('beforeunload',()=>{if(TaskWizard.active())TaskWizard.persist();});
