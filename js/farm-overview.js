"use strict";

// Home is a read model of canonical activities. It never writes costs or stock.
function overviewValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(value + 'T12:00:00');
  return !Number.isNaN(d.getTime()) && overviewISO(d) === value;
}
function overviewISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function overviewOffset(date, days) { const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()+days); return overviewISO(d); }
function overviewWeek(date) {
  const d=new Date(date+'T12:00:00'), start=overviewOffset(date,-((d.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>overviewOffset(start,i));
}
function overviewDate(date, full=false) {
  return new Date(date+'T12:00:00').toLocaleDateString('th-TH',full ? {weekday:'long',day:'numeric',month:'long',year:'numeric'} : {day:'numeric',month:'short'});
}
function overviewTaskDate(t) { return ['done','failed'].includes(t.status) ? taskRecordDate(t) : t.date; }
function overviewTaskSort(a,b) {
  return String(overviewTaskDate(a)||'').localeCompare(String(overviewTaskDate(b)||'')) || String(a.time||'').localeCompare(String(b.time||'')) || String(a.id).localeCompare(String(b.id));
}
function overviewModel(state, selected, today) {
  const tasks=(state.tasks||[]).slice().sort(overviewTaskSort);
  const onDay=tasks.filter(t=>overviewTaskDate(t)===selected);
  const pending=t=>t.status==='planned';
  return {
    selected, today, onDay, pending:onDay.filter(pending), done:onDay.filter(t=>t.status==='done'), failed:onDay.filter(t=>t.status==='failed'),
    overdue:tasks.filter(t=>pending(t)&&overviewValidDate(t.date)&&t.date<today),
    upcoming:tasks.filter(t=>pending(t)&&overviewValidDate(t.date)&&t.date>selected&&t.date>=today),
    undated:tasks.filter(t=>pending(t)&&!overviewValidDate(t.date)),
    projects:(state.projects||[]).filter(p=>p.status!=='done'),
    plots:(state.plots||[]).filter(p=>p.status==='active'), cycles:activeCycles(state)
  };
}
function overviewAction(name,...args) { return esc('FarmOverview.'+name+'('+args.map(a=>JSON.stringify(a)).join(',')+')'); }
function overviewApp(name,...args) { return esc('App.'+name+'('+args.map(a=>JSON.stringify(a)).join(',')+')'); }
function overviewContext(t,{compact=false}={}) {
  const plot=plotById(S,t.plotId), cycle=cycleById(S,t.cycleId), project=projectById(t.projectId), parts=[];
  if(plot)parts.push(`<button onclick="${overviewAction('plot',plot.id)}">${esc(plot.name)}</button>`);
  else parts.push('<span>งานส่วนกลาง</span>');
  if(cycle&&(!compact||!project||!projectHasExperiment(project)))parts.push(`<button onclick="${overviewAction('cycle',cycle.id)}">รอบ ${esc(cycle.round||'—')}</button>`);
  if(project&&(!compact||!cycle||projectHasExperiment(project)))parts.push(`<button onclick="${overviewAction('project',project.id)}">${esc(projectCode(project))}</button>`);
  return `<div class="fo-context">${parts.join('<span aria-hidden="true">·</span>')}</div>`;
}
function overviewTaskRow(t,{future=false}={}) {
  const time=['done','failed'].includes(t.status)?t.doneTime:taskPlannedTime(t);
  const review=t.status==='planned'&&taskNeedsMaterialReview(t);
  const label=t.title+' · '+(plotById(S,t.plotId)?.name||'งานส่วนกลาง');
  return `<article class="fo-task${future?' fo-task-future':''}" data-task-id="${esc(t.id)}">
    ${future?`<button class="fo-date-badge" aria-label="${esc('ดูงานวันที่ '+overviewDate(t.date))}" onclick="${overviewAction('select',t.date)}">${overviewDate(t.date)}</button>`:taskCompletionCircleHtml({...t,title:label},{locked:projectById(t.projectId)?.status==='done'})}
    <div class="fo-task-main"><button class="fo-task-title" onclick="${overviewApp('viewTask',t.id)}">${esc(t.title)}</button>${overviewContext(t,{compact:true})}${review?'<span class="fo-review">ตรวจปริมาณและต้นทุน</span>':''}<span class="fo-task-status">${esc(taskStatusText(t))}</span></div>
    <button class="fo-task-detail" aria-label="${esc('ดูรายละเอียด: '+label)}" onclick="${overviewApp('viewTask',t.id)}">${/^\d{2}:\d{2}$/.test(time||'')?`<span>${ic('clock')}${esc(time)}</span>`:''}${ic('chevron')}</button>
  </article>`;
}
function overviewWeekHtml(selected,today) {
  const week=overviewWeek(selected),days=['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
  return `<section class="fo-week" aria-label="เลือกวันดูงาน"><div class="fo-week-controls"><button aria-label="สัปดาห์ก่อนหน้า" onclick="${overviewAction('shift',-7)}">${ic('chevron')}</button><span>${overviewDate(week[0])} – ${overviewDate(week[6])} ${Number(week[6].slice(0,4))+543}</span><button aria-label="สัปดาห์ถัดไป" onclick="${overviewAction('shift',7)}">${ic('chevron')}</button><button class="fo-today-button" onclick="FarmOverview.select(todayISO())">กลับวันนี้</button></div><div class="fo-days" role="group" aria-label="วันในสัปดาห์">${week.map((date,i)=>`<button class="fo-day${date===selected?' selected':''}" aria-pressed="${date===selected}" ${date===today?'aria-current="date"':''} aria-label="${esc(overviewDate(date,true))}" onclick="${overviewAction('select',date)}"><span>${days[i]}</span><b>${Number(date.slice(-2))}</b>${date===today?'<small>วันนี้</small>':''}</button>`).join('')}</div></section>`;
}
function overviewProjectsHtml(projects) {
  return `<section class="fo-card fo-projects"><header class="fo-section-head"><h2>${ic('leaf')}โครงการและงานตามแผน</h2><button class="fo-link" onclick="Concept.go('projects')">ดูทั้งหมด ${ic('chevron')}</button></header>
    ${projects.slice(0,FarmOverview.allProjects?projects.length:3).map(p=>{
      const next=projectTaskList(p).filter(t=>t.status==='planned').sort(overviewTaskSort)[0];
      return `<article class="fo-project"><span class="fo-code">${esc(projectCode(p))}</span><h3><button onclick="${overviewAction('project',p.id)}">${esc(p.name)}</button></h3>${projectProgressHtml(p)}<div class="fo-project-next">${next?`<button onclick="${overviewApp('viewTask',next.id)}">${ic('calendar')}<span>ถัดไป: ${esc(next.title)}</span></button>`:'<span class="fo-muted">ไม่มีงานรอทำ</span>'}<button class="fo-link" onclick="${overviewAction('project',p.id)}">เปิดโครงการ ${ic('chevron')}</button></div></article>`;
    }).join('')||'<div class="fo-empty"><p>ยังไม่มีโครงการ</p><button class="fo-link" onclick="App.projectCreateModal()">เริ่มจากเรื่องที่จะทำ</button></div>'}
    ${projects.length>3?`<button class="fo-more" onclick="FarmOverview.allProjects=!FarmOverview.allProjects;render()">${FarmOverview.allProjects?'ย่อรายการ':'ดูอีก '+(projects.length-3)+' โครงการ'}</button>`:''}</section>`;
}
function overviewFarmHtml(model) {
  const year=model.today.slice(0,4),fin=ytdFinance(S),planted=model.plots.filter(p=>model.cycles.some(c=>c.plotId===p.id));
  const finance=model.plots.map(p=>({p,f:taskFinance(S,t=>t.plotId===p.id&&taskRecordDate(t).startsWith(year))})).filter(x=>x.f.cost||x.f.revenue).sort((a,b)=>b.f.cost-a.f.cost);
  const max=Math.max(1,...finance.flatMap(x=>[x.f.cost,x.f.revenue]));
  return `<details class="fo-card fo-farm" ${FarmOverview.farmOpen?'open':''} ontoggle="FarmOverview.farmOpen=this.open"><summary>${ic('map')}<span><strong>แปลงที่กำลังปลูกและต้นทุน</strong><small>${planted.length} แปลง · ${model.cycles.length} รอบปลูก · ดูสรุป</small></span>${ic('chevron')}</summary><div class="fo-farm-content"><div class="ch-section-head"><h2>แปลงที่กำลังปลูก</h2><button onclick="Concept.go('plots')">แปลงทั้งหมด ${ic('chevron')}</button></div><div class="fo-fields">${planted.map(p=>`<button class="ch-field" onclick="${overviewApp('openPlot',p.id)}">${p.photoUrl?`<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}">`:`<span class="ch-field-placeholder">${ic('leaf')}</span>`}<div><strong>${esc(p.name)}</strong><p>${fmtNum(p.sizeRai)} ไร่</p>${model.cycles.filter(c=>c.plotId===p.id).map(c=>`<span class="ch-field-state">${esc(c.plant)} · รอบ ${esc(c.round)} · อายุ ${ageDays(c.startDate)} วัน</span>`).join('')}</div></button>`).join('')||'<p class="fo-empty">ยังไม่มีแปลงที่กำลังปลูก</p>'}</div><div class="ch-section-head fo-finance-heading"><h2>รายรับและต้นทุน · ปี ${Number(year)+543}</h2><button onclick="Concept.go('reports')">ดูรายงาน ${ic('chevron')}</button></div><p class="fo-muted">รายรับกิจกรรม ${fmtMoney(fin.revenue)} บาท · ต้นทุน ${fmtMoney(fin.cost)} บาท · ไม่รวมขายสินค้า</p><div class="ch-legend"><span><i class="green"></i>รายรับ</span><span><i class="amber"></i>ต้นทุน</span></div>${finance.map(({p,f})=>`<button class="ch-finance-row" onclick="${overviewApp('openPlot',p.id)}"><span>${esc(p.name)}<small>${fmtNum(p.sizeRai)} ไร่</small></span><div class="ch-bar-pair"><div><progress max="${max}" value="${f.revenue}" aria-label="รายรับ ${esc(p.name)}"></progress><b>${fmtMoney(f.revenue)}</b></div><div><progress class="cost" max="${max}" value="${f.cost}" aria-label="ต้นทุน ${esc(p.name)}"></progress><small>${fmtMoney(f.cost)}</small></div></div></button>`).join('')||'<p class="fo-empty">ยังไม่มียอดรายรับหรือต้นทุนในปีนี้</p>'}<div class="ch-net"><span>ส่วนต่างรายรับ − ต้นทุน</span><strong>${fmtMoney(fin.net)} บาท</strong></div></div></details>`;
}
function overviewSaveStatus({failed,preview,hasSession,state,dirty}) {
  if(failed)return {tone:'error',text:'ยังบันทึกในเครื่องไม่สำเร็จ'};
  if(preview||!hasSession)return {tone:'local',text:'บันทึกแล้ว · เก็บในเครื่องนี้'};
  if(state==='synced'&&!dirty)return {tone:'synced',text:'บันทึกแล้ว · ซิงก์สำเร็จ'};
  if(['error','conflict','reauth'].includes(state))return {tone:'error',text:'บันทึกในเครื่องแล้ว · ต้องตรวจสอบการซิงก์'};
  if(state==='offline')return {tone:'pending',text:'บันทึกในเครื่องแล้ว · ออฟไลน์ รอซิงก์'};
  return {tone:'pending',text:'บันทึกในเครื่องแล้ว · รอซิงก์'};
}
const FarmOverview = {
  selected:'', allUpcoming:false, allProjects:false, farmOpen:false, receipt:null,
  select(date) { if(!overviewValidDate(date))return; this.selected=date; this.allUpcoming=false; render(); document.querySelector('.fo-day.selected')?.focus({preventScroll:true}); },
  shift(days) { this.select(overviewOffset(this.selected||todayISO(),days)); },
  closeTaskList() { if(document.querySelector('.fo-modal-tasks'))closeModal(); },
  plot(id) { this.closeTaskList();App.openPlot(id); App.plotDetailTab('tasks'); },
  cycle(id) { this.closeTaskList();App.openCycle(id); App.cycleDetailTab('tasks'); },
  project(id) { this.closeTaskList();projectWorkspaceTab='work'; App.projectOpen(id); },
  projectTasks(id,status='done') {
    const p=projectById(id); if(!p)return;
    const all=projectTaskList(p),tasks=all.filter(t=>status==='done'?t.status==='done':status==='failed'?t.status==='failed':!['done','failed'].includes(t.status));
    openModal(`<button class="modal-x" aria-label="ปิด" onclick="App.closeModal()">${notebookIcon('X')}</button><h3>${esc(p.name)}</h3><p>${esc(projectCode(p))}</p><div class="fo-list-tabs" role="group" aria-label="สถานะงานในโครงการ">${[['done','ทำแล้ว'],['remaining','งานที่เหลือ'],['failed','ไม่สำเร็จ']].map(([key,label])=>`<button class="btn btn-outline" aria-pressed="${key===status}" onclick="${overviewAction('projectTasks',id,key)}">${label} ${all.filter(t=>key==='done'?t.status==='done':key==='failed'?t.status==='failed':!['done','failed'].includes(t.status)).length}</button>`).join('')}</div><div class="fo-modal-tasks">${tasks.map(t=>overviewTaskRow(t)).join('')||'<p class="fo-empty">ไม่มีงานในกลุ่มนี้</p>'}</div>`);
  },
  recordSaved(ids) {
    this.receipt={ids:ids.filter(id=>S.tasks.some(t=>t.id===id)),owner:Auth.session?.email||'',failed:!!storageSaveFailed};
    this.refreshReceipt();
  },
  receiptHtml() {
    const receipt=this.receipt;
    if(!receipt||receipt.owner!==(Auth.session?.email||''))return '';
    const tasks=receipt.ids.map(id=>S.tasks.find(t=>t.id===id)).filter(Boolean); if(!tasks.length)return '';
    const status=overviewSaveStatus({failed:receipt.failed,preview:typeof LOCAL_SENSOR_PREVIEW!=='undefined'&&LOCAL_SENSOR_PREVIEW,hasSession:!!Auth.session,state:Auth.syncState,dirty:typeof localDirty==='function'?localDirty():true});
    return `<div class="fo-receipt ${status.tone}"><div class="fo-receipt-title" role="status">${ic(status.tone==='error'?'alert':'check')}<strong>${status.text}</strong></div>${tasks.map(t=>`<div class="fo-receipt-row"><div><b>${esc(t.title)}</b>${overviewContext(t)}</div><button class="fo-link" onclick="${overviewApp('viewTask',t.id)}">ดูรายการ ${ic('chevron')}</button></div>`).join('')}${status.tone==='error'&&!receipt.failed?'<button class="fo-link" onclick="App.authSyncNow()">ตรวจสอบการซิงก์</button>':''}<button class="fo-dismiss" aria-label="ปิดข้อความบันทึก" onclick="FarmOverview.receipt=null;FarmOverview.refreshReceipt()">${notebookIcon('X')}</button></div>`;
  },
  refreshReceipt() { const el=document.getElementById('overviewReceipt');if(el)el.innerHTML=this.receiptHtml(); }
};

const overviewPreviousHome=renderHome;
renderHome=function() {
  if(!Concept.enabled())return overviewPreviousHome();
  const today=todayISO(),selected=overviewValidDate(FarmOverview.selected)?FarmOverview.selected:today,model=overviewModel(S,selected,today);
  const heading=selected===today?'งานวันนี้':'งานวันที่ '+overviewDate(selected);
  return `<div class="fo-page"><header class="fo-heading"><div><h1>ภาพรวมฟาร์ม</h1><p>${overviewDate(today,true)} <span>· ${model.plots.length} แปลงกำลังดูแล</span></p></div><button class="btn btn-outline fo-calendar" onclick="Concept.go('calendar')">${ic('calendar')} ปฏิทินงาน</button><button class="btn btn-primary fo-record" onclick="App.modalTask(todayISO(),{status:'done'})">${ic('plus')} บันทึกกิจกรรม</button></header>
    ${overviewWeekHtml(selected,today)}
    ${model.overdue.length?`<details class="fo-overdue"><summary>${ic('alert')}<strong>เลยกำหนด ${model.overdue.length} งาน</strong><span>ดูงาน ${ic('chevron')}</span></summary><div class="fo-overdue-list">${model.overdue.map(t=>`<div class="fo-overdue-item"><small>กำหนด ${overviewDate(t.date)}</small>${overviewTaskRow(t)}</div>`).join('')}</div></details>`:''}
    <div class="fo-grid"><div class="fo-work"><section class="fo-card fo-today"><header class="fo-today-head"><h2>${ic('calendar')}${heading}</h2><p>ทำแล้ว ${model.done.length} จาก ${model.onDay.length} งาน <span>· เหลือ ${model.pending.length} งาน${model.failed.length?' · ไม่สำเร็จ '+model.failed.length+' งาน':''}</span></p></header>
    ${model.pending.map(t=>overviewTaskRow(t)).join('')||`<p class="fo-empty">${model.onDay.length?'ไม่มีงานรอทำในวันนี้':'ยังไม่มีงานในวันที่เลือก'}</p>`}
    ${model.done.length?`<details class="fo-done"><summary>${ic('check')}<strong>${selected===today?'ทำแล้ววันนี้':'ทำแล้ว'} ${model.done.length} งาน</strong>${ic('chevron')}</summary>${model.done.map(t=>overviewTaskRow(t)).join('')}</details>`:''}
    ${model.failed.length?`<details class="fo-failed"><summary>งานที่ไม่สำเร็จ ${model.failed.length} งาน ${ic('chevron')}</summary>${model.failed.map(t=>overviewTaskRow(t)).join('')}</details>`:''}
    ${model.onDay.length?'' : `<button class="fo-add" onclick="${overviewApp('modalTask',selected)}">${ic('plus')} วางแผนงาน${selected===today?'วันนี้':'วันที่ '+overviewDate(selected)}</button>`}</section>
    <section class="fo-card fo-upcoming"><header class="fo-section-head"><h2>${ic('calendar')}งานถัดไป</h2><button class="fo-link" onclick="Concept.go('tasks')">กิจกรรมทั้งหมด ${ic('chevron')}</button></header>${model.upcoming.slice(0,FarmOverview.allUpcoming?model.upcoming.length:2).map(t=>overviewTaskRow(t,{future:true})).join('')||'<p class="fo-empty">ยังไม่มีงานถัดไป</p>'}${model.upcoming.length>2?`<button class="fo-more" onclick="FarmOverview.allUpcoming=!FarmOverview.allUpcoming;render()">${FarmOverview.allUpcoming?'ย่อรายการ':'ดูอีก '+(model.upcoming.length-2)+' งาน'}</button>`:''}${model.undated.length?`<details class="fo-undated"><summary>ยังไม่กำหนดวัน ${model.undated.length} งาน ${ic('chevron')}</summary>${model.undated.map(t=>overviewTaskRow(t)).join('')}</details>`:''}</section></div>
    ${overviewProjectsHtml(model.projects)}</div>${overviewFarmHtml(model)}<div id="overviewReceipt">${FarmOverview.receiptHtml()}</div><div id="teamHomeInbox"></div></div>`;
};
// Reflect acknowledged sync status without changing sync scheduling or persistence.
const overviewPreviousSyncStatus=Auth.setSyncStatus;
Auth.setSyncStatus=function(...args) { const result=overviewPreviousSyncStatus.apply(this,args);FarmOverview.refreshReceipt();return result; };
