/* Route continuity and summaries using the core data and calculations. */
const ConceptWorkflows = {
  backStack: [],
  teamQuery: '',
  mobileFiltersOpen: false,
  disclosure(node, title, open=false) {
    if(!node)return null;
    const details=document.createElement('details'),summary=document.createElement('summary');
    details.className='cw-secondary';details.open=open;summary.textContent=title;
    node.before(details);details.append(summary,node);return details;
  },
  clarity(view) {
    if(route.view==='home'){
      const subtitle=view.querySelector('.ch-subtitle');
      if(subtitle)subtitle.innerHTML=subtitle.innerHTML.replace('แปลงกำลังดูแล','แปลงที่เปิดใช้งาน');
      const today=view.querySelector('[onclick="Concept.taskView(\'today\')"]');
      if(today?.firstChild)today.firstChild.textContent='ค้างวันนี้';
      const work=view.querySelector('.ch-workspace'),fields=view.querySelector('.ch-fields'),finance=view.querySelector('.ch-finance');
      if(work&&fields&&finance){work.append(fields);work.after(finance);}
      const metrics=view.querySelector('.ch-metrics');
      if(metrics){view.append(metrics);this.disclosure(metrics,'ตัวเลขภาพรวมและยอดสะสม');}
    }
    if(route.view==='plots' && route.tab==='trials' && route.trialId && route.trialSection==='compare'){
      const range=view.querySelector('.trial-filter-bar .trial-range-form');
      this.disclosure(range,route.trialRangeStart||route.trialRangeEnd?'ช่วงวันที่ · กำลังกรองข้อมูล':'ช่วงวันที่ · ตลอดการทดลอง',!!(route.trialRangeStart||route.trialRangeEnd));
      const picker=view.querySelector('.trial-series-picker');
      const series=this.disclosure(picker,'เลือกสูตรที่แสดง',!!route.trialHiddenTreatments?.length);
      const filters=view.querySelector('.trial-filter-bar');
      if(filters&&series){filters.classList.add('cw-trial-filters');filters.append(series);}
      const meta=view.querySelector('.trial-results-meta');if(meta)meta.classList.add('cw-compact-counts');
    }
    if(route.view==='stock'){
      const photo=view.querySelector('#stockPhotoSelect')?.closest('label');
      const photoFilter=view.querySelector('#stockPhotoSelect')?.value;
      this.disclosure(photo,'กรองตามรูปภาพ',!!photoFilter&&photoFilter!=='all');
    }
    if(route.view==='cycleDetail'){
      const remove=view.querySelector('button[onclick^="App.deleteCycle("]');
      this.disclosure(remove,'จัดการรอบปลูก');
    }
    if(route.view==='plots' && route.tab==='trials' && route.trialSection==='plan'){
      for(const button of view.querySelectorAll('button[onclick^="App.deleteTrialTreatment("]'))this.disclosure(button,'จัดการสูตร');
    }
    const back=view.querySelector('.subpage-back');if(back)back.setAttribute('aria-label','กลับไปเมนูเครื่องมือและตั้งค่า');
  },
  mobileLayout() {
    const fields=document.querySelector('.planner-search-fields');
    if(!fields||fields.querySelector('.cm-filter-toggle'))return;
    const labels=[...fields.children].slice(1);
    const panel=document.createElement('div');panel.className='cm-filter-fields';panel.id='cmFilterFields';
    labels.forEach(label=>panel.append(label));
    const count=labels.filter(label=>label.querySelector('select')?.value).length;
    const button=document.createElement('button');button.type='button';button.className='btn btn-outline cm-filter-toggle';
    button.setAttribute('aria-controls',panel.id);button.innerHTML=ic('gear')+` ตัวกรอง${count?' ('+count+')':''}`;
    const update=()=>{button.setAttribute('aria-expanded',String(this.mobileFiltersOpen));panel.classList.toggle('cm-collapsed',!this.mobileFiltersOpen);};
    button.onclick=()=>{this.mobileFiltersOpen=!this.mobileFiltersOpen;update();};
    fields.append(button,panel);update();
  },
  remember() {
    this.backStack.push({route:{...route},plotDetailTab,plotTaskCycle,cycleDetailTab,cycleCal:{...cycleCal},y:window.scrollY,viewY:document.getElementById('view').scrollTop,focus:document.activeElement?.getAttribute('onclick')});
  },
  back() {
    const saved=this.backStack.pop();
    if(!saved){App.nav('plots');return;}
    route={...saved.route};plotDetailTab=saved.plotDetailTab;plotTaskCycle=saved.plotTaskCycle;
    cycleDetailTab=saved.cycleDetailTab;cycleCal={...saved.cycleCal};
    render();
    requestAnimationFrame(()=>{[...document.querySelectorAll('#view button')].find(b=>b.getAttribute('onclick')===saved.focus)?.focus({preventScroll:true});document.getElementById('view').scrollTop=saved.viewY;window.scrollTo(0,saved.y);});
  },
  scope() {
    const view=document.getElementById('view');
    const year=Number(route.year||todayISO().slice(0,4));
    let text='';
    if(route.view==='home')text=`ยอดเงิน: ทุกแปลงและงานส่วนกลาง · เฉพาะกิจกรรมที่เสร็จแล้ว · ปี ${Number(todayISO().slice(0,4))+543} · ไม่รวมการขายสินค้า`;
    else if(route.view==='farm')text=route.tab==='analytics'?(route.analyticsTab==='shop'?`การขายสินค้า · ปี ${year+543} · ไม่รวมกิจกรรมในแปลง`:`ทุกแปลงและงานส่วนกลาง · กิจกรรมที่เสร็จแล้ว · ปี ${year+543} · ไม่รวมการขายสินค้า`):`เฉพาะงานที่ไม่ผูกแปลง · ปี ${year+543}`;
    else if(route.view==='plotDetail')text=`${plotById(S,route.plotId)?.name||'แปลงนี้'} · รวมทุกรอบและทุกช่วงเวลา · ยอดเงินเฉพาะงานที่เสร็จแล้ว`;
    else if(route.view==='cycleDetail'){const c=cycleById(S,route.cycleId);if(c)text=`${plotById(S,c.plotId)?.name||'แปลงนี้'} · ${c.plant} รอบ ${c.round||'-'} · ${dateLabel(c.startDate)} ถึง ${c.endDate?dateLabel(c.endDate):'ปัจจุบัน'} · ยอดเงินเฉพาะงานที่เสร็จแล้ว`;}
    if(text){const band=document.createElement('details');band.className='cw-scope';const label=document.createElement('summary');label.textContent='ขอบเขตข้อมูล';const detail=document.createElement('p');detail.textContent=text;band.append(label,detail);const metrics=view.querySelector('.ch-metrics');if(metrics)metrics.before(band);else view.prepend(band);}
    if(route.view==='plots'&&route.tab==='trials'&&route.trialId&&route.trialSection==='compare'){
      const title=[...view.querySelectorAll('#trialWorkPanel h2')].find(h=>h.textContent==='ผลตลอดการทดลอง');
      if(title&&(route.trialRangeStart||route.trialRangeEnd))title.textContent='ผลในช่วงวันที่เลือก';
      const photoTitle=[...view.querySelectorAll('#trialWorkPanel h2')].find(h=>h.textContent==='รูปประจำสูตร / วิธี');
      const photoSection=photoTitle?.closest('section');
      if(photoSection){const details=document.createElement('details');details.className='trial-optional-photos';const summary=document.createElement('summary');summary.textContent='รูปประจำสูตร / วิธี';details.append(summary);photoSection.before(details);details.append(photoSection);}
    }
    if(route.view==='plots'&&route.tab==='trials'&&!route.trialId){
      for(const card of view.querySelectorAll('.trial-list-card')){
        const progress=card.querySelector('progress');
        const note=progress?.nextElementSibling;
        card.querySelector('.trial-list-progress')?.remove();
        progress?.remove();
        if(note)note.textContent=note.textContent.split(' · ')[0];
      }
    }
    if(route.view==='home'){
      const heading=view.querySelector('.ch-heading');
      const work=view.querySelector('.ch-workspace');
      if(heading&&work)heading.after(work);
      const attention=view.querySelector('.ch-attention');
      if(attention)attention.remove();
      const plots=S.plots.filter(p=>p.status==='active');
      const f=taskFinance(S,t=>plots.some(p=>p.id===t.plotId)&&taskRecordDate(t).startsWith(todayISO().slice(0,4)));
      const financeHeading=view.querySelector('.ch-finance .ch-section-head h2');if(financeHeading)financeHeading.textContent='รายรับ–ต้นทุนแปลงที่ดูแล';
      const net=view.querySelector('.ch-net strong');if(net)net.innerHTML=fmtMoney(f.net)+' <small>บาท</small>';
      const netLabel=view.querySelector('.ch-net>span');if(netLabel)netLabel.textContent='ส่วนต่างเฉพาะแปลงที่ดูแล';
    }
    view.classList.toggle('cw-detail',['plotDetail','cycleDetail'].includes(route.view));
    if(this.backStack.length){
      const back=route.view==='plots'&&route.trialId?view.querySelector('.trial-back'):route.view==='plotDetail'?view.querySelector('button[onclick="App.goPlots()"]'):route.view==='cycleDetail'?view.querySelector('button[onclick^="App.openPlot("]'):null;
      if(back){back.setAttribute('onclick','ConceptWorkflows.back()');back.innerHTML=ic('chevron')+' กลับ';back.setAttribute('aria-label','กลับไปหน้าก่อนหน้า');}
    }
    if(route.view==='plotDetail'){
      const header=view.querySelector('.card');header?.classList.add('cw-detail-header');
      const title=header?.querySelector('.plot-name');if(title){const h=document.createElement('h1');h.className='plot-name';h.innerHTML=title.innerHTML;title.replaceWith(h);}
      const finance=[...view.querySelectorAll('.card')].find(el=>el.style.background.includes('linear-gradient'));finance?.classList.add('cw-finance');
    }
    this.mobileLayout();
    this.clarity(view);
  },
  formSummary() {
    const form=document.querySelector('.task-form');
    if(!form)return;
    let summary=document.getElementById('cwTaskSummary');
    if(!summary){summary=document.createElement('section');summary.id='cwTaskSummary';summary.className='cw-task-summary';summary.setAttribute('aria-label','สรุปก่อนบันทึก');form.append(summary);}
    const status=document.getElementById('t_status')?.value||'planned';
    const useCost=document.getElementById('t_usecost')?.checked;
    const items=useCost?taskCostItems.filter(i=>i.stockId||String(i.name||'').trim()):[];
    const scope=document.querySelector('input[name="t_scope"]:checked')?.value;
    const plot=plotById(S,document.getElementById('t_plot')?.value);
    const multi=typeof TaskWizard!=='undefined' && TaskWizard.active() && TaskWizard.usesPlots() ? TaskWizard.selections() : [];
    const cycle=cycleById(S,document.getElementById('t_cycle')?.value);
    const total=useCost?taskCostItems.reduce((n,i)=>n+(Number(i.totalCost)||0),0):0;
    const missing=items.filter(costPriceMissing).length;
    const rows=items.map(i=>{
      const unit=unitLabel(i.usageUnit||i.unit||'');
      const qty=Number(i.usageUnit?i.usageQty:i.qty)||0;
      let effect='ไม่ตัดสต็อก';
      if(i.stockId&&costStockMode(i)!=='record')effect=status==='planned'?'จองตามแผน · ยังไม่ตัด':status==='failed'?'ไม่ตัดสต็อก (งานไม่สำเร็จ)':costStockMode(i)==='open'?'ใช้จากของเปิดแล้ว':costStockMode(i)==='package'?'เบิกจากสต็อกหลัก':'หักตามปริมาณที่ใช้';
      const rate=materialRateFromArea(i,document.getElementById('t_material_area')?.value);
      return `<li><div><strong>${esc(i.name||stockById(S,i.stockId)?.name||'รายการวัสดุ')}</strong><span>${fmtNum(qty)} ${esc(unit)} · ${esc(effect)}</span>${rate?'<span>เฉลี่ย '+esc(rate.text)+' · พื้นที่ '+fmtNum(rate.areaRai)+' ไร่</span>':''}</div><b>${costPriceMissing(i)?'ยังไม่ระบุราคา':fmtMoney(Number(i.totalCost)||0)+' บาท'}</b></li>`;
    }).join('');
    summary.innerHTML=`<h4>สรุปก่อนบันทึก</h4><dl><div><dt>บันทึกให้กับ</dt><dd>${esc(scope==='farm'?'งานส่วนกลาง':plot?.name||'ยังไม่ได้เลือกแปลง')}${scope!=='farm'&&cycle?' · รอบ '+esc(String(cycle.round||'-')):''}</dd></div><div><dt>ผลการทำงาน</dt><dd>${{planned:'วางแผน',done:'ทำแล้ว',failed:'ไม่สำเร็จ'}[status]||status}</dd></div></dl>${rows?'<ul>'+rows+'</ul>':''}<div class="cw-summary-total"><span>${status==='planned'?'ค่าใช้จ่ายตามแผน':'ค่าใช้จ่ายที่ระบุ'}</span><strong>${fmtMoney(total)} บาท</strong></div>${document.getElementById('t_useharvest')?.checked?'<div class="cw-summary-total"><span>รายรับเก็บเกี่ยว</span><strong>'+esc(document.getElementById('harvestSum')?.textContent||'0 บาท')+'</strong></div>':''}`;
    if(missing){const warning=document.createElement('p');warning.className='cost-price-warning';warning.textContent=`ยอดยังไม่ครบ ขาดราคา ${missing} รายการ`;summary.append(warning);}
    if(multi.length){summary.querySelector('dd').textContent=multi.length+' แปลง · '+multi.map(row=>plotById(S,row.plotId)?.name||'ไม่พบแปลง').join(', ');summary.querySelector('h4').textContent='ยอดรวมทุกแปลง';}
  },
  teamSearch() {
    const page=document.getElementById('teamPageContent');
    const list=page?.querySelector('.team-list');
    if(!list)return;
    let search=page.querySelector('#cwTeamSearch');
    if(!search){
      const label=document.createElement('label');label.className='cw-team-search';label.textContent=Team.section==='members'?'ค้นหาสมาชิกในหน้านี้':'ค้นหาผู้บันทึกหรือรายการในหน้านี้';
      search=document.createElement('input');search.type='search';search.id='cwTeamSearch';search.value=this.teamQuery;search.oninput=()=>{this.teamQuery=search.value;this.filterTeam();};label.append(search);list.before(label);
      const empty=document.createElement('p');empty.id='cwTeamEmpty';empty.className='ch-empty';empty.textContent='ไม่พบรายการที่ค้นหา';empty.hidden=true;list.after(empty);
    }
    search.value=this.teamQuery;
    search.oninput=()=>{this.teamQuery=search.value;this.filterTeam();};
    this.filterTeam();
  },
  filterTeam() {
    const rows=[...document.querySelectorAll('#teamPageContent .team-review-row,#teamPageContent .team-member')];
    const query=this.teamQuery.trim().toLocaleLowerCase('th');
    rows.forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('th').includes(query));
    const empty=document.getElementById('cwTeamEmpty');if(empty)empty.hidden=!rows.length||rows.some(row=>!row.hidden);
  }
};

function renderConceptTeam(){return '<div id="teamPageContent" class="cw-team-page"><p role="status">กำลังโหลดทีม...</p></div>';}

const workflowsNav=App.nav;
App.nav=function(key){ConceptWorkflows.backStack=[];return workflowsNav.call(this,key);};
for(const method of ['openPlot','openCycle','openTrial']){
  const original=App[method];
  App[method]=function(...args){ConceptWorkflows.remember();const result=original.apply(this,args);window.scrollTo(0,0);return result;};
}
const workflowsRender=render;
let workspaceTeamToken=null;
render=function(){
  const teamPage=Concept.enabled()&&route.view==='team';
  const continuing=teamPage&&workspaceTeamToken===Auth.session.token;
  const previous=continuing?document.getElementById('teamPageContent')?.innerHTML:null;
  workflowsRender();
  if(!Concept.enabled()){workspaceTeamToken=null;return;}
  ConceptWorkflows.scope();
  if(!teamPage){workspaceTeamToken=null;return;}
  workspaceTeamToken=Auth.session.token;
  if(previous){document.getElementById('teamPageContent').innerHTML=previous;ConceptWorkflows.teamSearch();}
  else Team.open();
};
const workflowsModalTask=App.modalTask;
App.modalTask=function(...args){const result=workflowsModalTask.apply(this,args);ConceptWorkflows.formSummary();return result;};
for(const method of ['costSum','taskTypeChange','taskModeChange','taskToggleCost','taskCalcHarvest']){
  const original=App[method];
  App[method]=function(...args){const result=original.apply(this,args);ConceptWorkflows.formSummary();return result;};
}
document.addEventListener('input',event=>{if(event.target.closest('.task-form'))queueMicrotask(()=>ConceptWorkflows.formSummary());});
document.addEventListener('change',event=>{if(event.target.closest('.task-form'))queueMicrotask(()=>ConceptWorkflows.formSummary());});
render();
