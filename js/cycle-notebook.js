"use strict";

// The notebook is a read model of canonical activities, never a second cost ledger.
const notebookFilters = new Map();
const notebookPending = new Map();
function notebookIcon(name) {
  return lucide.createElement(lucide.icons[name] || lucide.icons.FileText,
    {class:'ic', 'aria-hidden':'true', 'stroke-width':1.7}).outerHTML;
}
function notebookAction(name, ...args) {
  return esc('App.' + name + '(' + args.map(value=>JSON.stringify(value)).join(',') + ')');
}
function notebookProjects(c) {
  return (S.projects || []).filter(p=>p.cycleId===c.id || projectTaskList(p).some(t=>t.cycleId===c.id));
}
function notebookModel(c) {
  const tasks=S.tasks.filter(t=>t.cycleId===c.id).slice().sort((a,b)=>taskRecordDate(b).localeCompare(taskRecordDate(a)));
  const done=tasks.filter(t=>t.status==='done'),finance=cycleFinance(S,c.id);
  const categories={materials:0,labor:0,other:0};
  const bucket=category=>['chemical','fertilizer'].includes(category)?'materials':category==='labor'?'labor':'other';
  for(const t of done) {
    const cost=Number(t.cost)||0,items=t.costItems || [];
    const itemTotal=items.reduce((sum,ci)=>sum+(Number(ci.totalCost)||0),0);
    if(items.length && Math.abs(itemTotal-cost)<0.005) {
      for(const ci of items) categories[taskItemIsMaterial(ci)?'materials':bucket(ci.category)]+=Number(ci.totalCost)||0;
    } else categories[bucket(t.costCat)]+=cost;
  }
  const materials=done.filter(t=>['spray','fertilize'].includes(t.type) || t.costItems?.some(ci=>['chemical','fertilizer'].includes(ci.category)));
  return {tasks,done,finance,categories,materials,projects:notebookProjects(c),area:Number(plotById(S,c.plotId)?.sizeRai)||0};
}
function notebookMaterialItems(t, category='') {
  const items=(t.costItems || []).filter(taskItemIsMaterial);
  if((t.costItems || []).length) return items.filter(ci=>!category || ci.category===category);
  const cat=t.costCat || (t.type==='fertilize'?'fertilizer':t.type==='spray'?'chemical':'');
  if(!['chemical','fertilizer'].includes(cat) || (category && category!==cat)) return [];
  return [{name:'วัสดุที่บันทึกเดิม',category:cat,totalCost:Number(t.cost)||0}];
}
function notebookMaterialRows(c, filter={}) {
  return notebookModel(c).materials.filter(t=>!filter.month || taskRecordDate(t).slice(0,7)===filter.month)
    .map(task=>({task,items:notebookMaterialItems(task,filter.category)})).filter(row=>row.items.length);
}
function notebookQuantity(ci) {
  const qty=ci.usageUnit?ci.usageQty:ci.qty,unit=ci.usageUnit || ci.unit || '';
  const labels={kg:'กก.',g:'กรัม',ml:'มล.',l:'ลิตร',cc:'มล.'};
  return qty==null || qty===''?'ไม่ระบุปริมาณ':fmtNum(Number(qty)||0)+' '+esc(labels[unit] || unit);
}
function notebookPhotos(t) { return [...new Set(taskAllPhotos(t))]; }
function notebookMonth(month) {
  const [year,m]=month.split('-').map(Number);
  return new Date(year,m-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'});
}
function notebookCostCard(model) {
  return `<section class="nb-card nb-costs"><h2>ต้นทุนรอบนี้</h2><div class="nb-bars">${[['materials','ยาและปุ๋ย'],['labor','ค่าแรง'],['other','อื่น ๆ']].map(([key,label])=>`<div class="nb-cost-row"><span>${label}</span><meter class="nb-meter nb-${key}" min="0" max="${Math.max(model.finance.cost,1)}" value="${model.categories[key]}" aria-label="${label}"></meter><span>${fmtMoney(model.categories[key])} บาท</span></div>`).join('')}</div><div class="nb-total"><span>รวม</span><strong>${fmtMoney(model.finance.cost)} บาท</strong></div><button class="nb-text-link" onclick="App.cycleDetailTab('costs')">ดูรายละเอียดต้นทุน ${notebookIcon('ArrowRight')}</button></section>`;
}
function notebookProjectCard(projects, full=false) {
  return `<section class="nb-card nb-projects"><h2>โครงการที่เชื่อมอยู่</h2>${projects.length?projects.map(p=>`<div class="nb-project"><span class="nb-square-icon">${notebookIcon(projectLinkedTrials(p).length?'FlaskConical':'FolderOpen')}</span><div><button class="nb-project-code" onclick="${notebookAction('projectOpen',p.id)}">${esc(projectCode(p))}</button><strong>${esc(p.name)}</strong><small>${full?esc(p.objective || p.description || 'ยังไม่ระบุวัตถุประสงค์'):'ใช้กิจกรรมและหลักฐานชุดเดียวกัน'}</small></div><button class="nb-text-link" onclick="${notebookAction('projectOpen',p.id)}">เปิดโครงการ ${notebookIcon('ArrowRight')}</button></div>`).join(''):'<p class="nb-empty">ยังไม่มีโครงการที่เชื่อมรอบปลูกนี้</p><button class="nb-text-link" onclick="App.go(\'projects\')">ไปที่งานและการทดลอง '+notebookIcon('ArrowRight')+'</button>'}</section>`;
}
function notebookReportCard(c) {
  return `<section class="nb-card nb-book"><h2>เล่มสรุปรอบปลูก</h2><div><span class="nb-square-icon">${notebookIcon('FileText')}</span><p>รวมประวัติงาน ต้นทุน ผลผลิต และรูปภาพ</p><button class="btn btn-outline" onclick="${notebookAction('cycleNotebookReport',c.id)}">ดูร่างเล่มสรุป</button></div></section>`;
}
function notebookProjectWorkspace(c,model){return `<section class="nb-card"><div class="nb-history-heading"><div><h2>โครงการของรอบปลูกนี้</h2><p>ตั้งเรื่องที่ต้องการทำกับแปลง แล้วค่อยเพิ่มงานและบันทึกผล</p></div><button class="btn btn-primary" onclick="${notebookAction('projectSimpleModal',c.plotId,c.id)}">${notebookIcon('Plus')} ตั้งโครงการของรอบนี้</button></div></section>${notebookProjectCard(model.projects,true)}`;}
function notebookBridge(c, model) {
  const linked=model.done.find(t=>t.projectId && model.projects.some(p=>p.id===t.projectId));
  const p=linked?projectById(linked.projectId):model.projects[0];
  if(!p) return `<section class="nb-bridge"><h3>จากงานในแปลง สู่ผลทดลอง</h3><p>เชื่อมงานในรอบปลูกกับโครงการ เพื่อดูผลทดลองและหลักฐานร่วมกัน</p><button class="btn btn-outline" onclick="App.go('projects')">ดูงานและผลทดลอง ${notebookIcon('ExternalLink')}</button></section>`;
  const cycleTasks=new Set(model.tasks.filter(t=>t.projectId===p.id).map(t=>t.id));
  const observations=projectLinkedTrials(p).flatMap(tr=>tr.observations.filter(o=>cycleTasks.has(o.projectTaskId)))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const latest=observations[0],resultTask=latest?model.tasks.find(t=>t.id===latest.projectTaskId):null;
  const photos=[...new Set([...(linked?notebookPhotos(linked):[]),...observations.flatMap(o=>o.photos || [])])].slice(0,2);
  return `<section class="nb-bridge"><h3>จากงานในแปลง สู่ผลทดลอง</h3><div class="nb-bridge-body">${photos.length?`<div class="nb-photos">${photos.map(photo=>`<img src="${esc(taskPhotoUrl(photo))}" alt="ภาพบันทึกจากงานและผลทดลองของ ${esc(projectCode(p))}" loading="lazy">`).join('')}</div>`:''}<div class="nb-bridge-copy"><strong>${esc(linked?.title || p.name)}${resultTask?' → '+esc(resultTask.title):''}</strong><p>เชื่อมกับ ${esc(projectCode(p))}</p><button class="btn btn-outline" onclick="${notebookAction('cycleNotebookOpenResult',p.id,resultTask?.id || linked?.id || '')}">ดูงานและผลทดลอง ${notebookIcon('ExternalLink')}</button></div></div></section>`;
}
function notebookMaterials(c, model) {
  if(typeof materialHistoryHtml === 'function') return materialHistoryHtml(c.plotId,c.id);
  const filter=notebookFilters.get(c.id) || {category:'',month:''}, rows=notebookMaterialRows(c,filter);
  const months=[...new Set(model.materials.map(t=>taskRecordDate(t).slice(0,7)))].filter(Boolean).sort().reverse();
  const total=rows.reduce((sum,row)=>sum+row.items.reduce((n,ci)=>n+(Number(ci.totalCost)||0),0),0);
  return `<div class="nb-columns"><section class="nb-card nb-history"><div class="nb-history-heading"><h2>ประวัติการใช้ยาและปุ๋ย</h2><div class="nb-filters"><select aria-label="ประเภทวัสดุ" onchange="App.cycleNotebookFilter('category',this.value)"><option value="">ทุกรายการ</option><option value="fertilizer" ${filter.category==='fertilizer'?'selected':''}>ปุ๋ย</option><option value="chemical" ${filter.category==='chemical'?'selected':''}>ยา</option></select><label class="nb-month">${notebookIcon('CalendarDays')}<select aria-label="เดือนที่ใช้วัสดุ" onchange="App.cycleNotebookFilter('month',this.value)"><option value="">ทุกเดือน</option>${months.map(month=>`<option value="${esc(month)}" ${filter.month===month?'selected':''}>${esc(notebookMonth(month))}</option>`).join('')}</select></label></div></div><div class="nb-table-scroll"><table class="nb-material-table"><thead><tr><th>วันที่</th><th>กิจกรรม / วัสดุ</th><th>ใช้จริง</th><th>ค่าวัสดุ</th><th>หลักฐาน</th><th><span class="nb-sr-only">รายละเอียด</span></th></tr></thead><tbody>${rows.map(({task:t,items})=>`<tr><td>${esc(dateLabel(taskRecordDate(t)))}</td><td><button class="nb-task-title" onclick="${notebookAction(t.activityMembers?.length?'projectViewActivity':'viewTask',t.id)}">${esc(t.title)}</button>${items.map(ci=>`<span class="nb-material-name">${esc(ci.name || 'ไม่ระบุชื่อวัสดุ')}</span>`).join('')}${t.projectId&&projectById(t.projectId)?`<button class="nb-project-code nb-row-project" onclick="${notebookAction('projectOpen',t.projectId)}">${notebookIcon('Link')} ${esc(projectCode(projectById(t.projectId)))}</button>`:''}</td><td>${items.map(ci=>`<span class="nb-material-value">${notebookQuantity(ci)}</span>`).join('')}</td><td>${items.map(ci=>`<span class="nb-material-value">${fmtMoney(Number(ci.totalCost)||0)} บาท</span>`).join('')}</td><td><button class="nb-evidence" onclick="${notebookAction(t.activityMembers?.length?'projectViewActivity':'viewTask',t.id)}" aria-label="${esc('ดูหลักฐาน: '+t.title)}">${notebookIcon('Image')} ${notebookPhotos(t).length} รูป</button></td><td><button class="nb-row-open" onclick="${notebookAction(t.activityMembers?.length?'projectViewActivity':'viewTask',t.id)}" aria-label="${esc('เปิดกิจกรรม: '+t.title)}">${notebookIcon('ChevronRight')}</button></td></tr>`).join('') || '<tr><td colspan="6" class="nb-empty">'+(model.materials.length?'ไม่พบรายการตามตัวกรองที่เลือก':'ยังไม่มีการใช้ยาและปุ๋ยที่บันทึกเสร็จแล้วในรอบนี้')+'</td></tr>'}</tbody><tfoot><tr><th colspan="3">ค่าวัสดุที่ใช้รวม${filter.category || filter.month?' · ตามตัวกรอง':''}</th><td colspan="3">${fmtMoney(total)} บาท</td></tr></tfoot></table></div><p class="nb-table-note">${notebookIcon('Info')} แตะรายการเพื่อดูวัสดุ ค่าแรง รูปภาพ และรายละเอียดการบันทึก</p>${notebookBridge(c,model)}</section><aside class="nb-sidebar">${notebookCostCard(model)}${notebookProjectCard(model.projects)}${notebookReportCard(c)}</aside></div>`;
}
function notebookActivityList(c,model) {
  return notebookHistoryHtml(model.tasks,'cycle:'+c.id,{calendar:true});
}
const notebookHistoryFilters=new Map();
function notebookHistoryModel(tasks,filter={}) {
  tasks=taskActivityRows(tasks);
  const mode=filter.mode==='planned'?'planned':'recorded';
  const recorded=tasks.filter(t=>['done','failed'].includes(t.status));
  const planned=tasks.filter(t=>!['done','failed'].includes(t.status));
  const query=String(filter.query || '').trim().normalize('NFC').toLocaleLowerCase('th-TH');
  const rows=(mode==='planned'?planned:recorded).filter(t=>(!filter.type || t.type===filter.type) && (mode==='planned' || !filter.outcome || t.status===filter.outcome) &&
    (!query || [t.title,...(t.costItems || []).map(ci=>ci.name)].join(' ').normalize('NFC').toLocaleLowerCase('th-TH').includes(query)));
  const byDate=new Map();
  for(const task of rows){const date=taskRecordDate(task);if(!byDate.has(date))byDate.set(date,[]);byDate.get(date).push(task);}
  const sort=filter.sort || (mode==='planned'?'old':'new');
  const dates=[...byDate.keys()].sort((a,b)=>!a?1:!b?-1:(sort==='old'?a.localeCompare(b):b.localeCompare(a)));
  const groups=dates.map(date=>({date,tasks:byDate.get(date).slice().sort((a,b)=>String(a.doneTime || '').localeCompare(String(b.doneTime || '')) || String(a.id).localeCompare(String(b.id)))}));
  return {mode,sort,recorded:recorded.length,planned:planned.length,groups,count:rows.length};
}
function notebookHistoryRow(t,{showCycle=false}={}) {
  const recorded=['done','failed'].includes(t.status),status=taskStatusOf(t),project=projectById(t.projectId),cycle=showCycle?cycleById(S,t.cycleId):null;
  const materials=notebookMaterialItems(t),photos=notebookPhotos(t).length,cost=Number(t.cost)||0;
  const statusText={done:'ทำแล้ว',failed:'ไม่สำเร็จ',overdue:'เลยกำหนด',planned:t.date===todayISO()?'กำหนดวันนี้':'วางไว้'}[status];
  const materialText=materials.slice(0,2).map(ci=>`${esc(ci.name || 'ไม่ระบุชื่อวัสดุ')} · ${t.status==='done'?'ใช้':recorded?'ระบุไว้':'วางแผนใช้'} ${notebookQuantity(ci)}`).join(' · ');
  const facts=[];
  if(t.status==='done')facts.push(`<span class="nb-work-cost">${taskDataPending(t)&&!cost?'ต้นทุนรอยืนยัน':'ต้นทุน '+fmtMoney(cost)+' บาท'}</span>`);
  if(taskDataPending(t))facts.push('<span class="badge badge-amber">ทำแล้ว · ข้อมูลรอตรวจ</span>');
  if(t.activityMembers?.length)facts.push(`<span>${t.activityMembers.length} รายการต้นทาง</span>`);
  else if(!recorded && cost>0)facts.push(`<span>งบประมาณ ${fmtMoney(cost)} บาท</span>`);
  if(t.status==='done' && Number(t.revenue)>0)facts.push(`<span>รายรับ ${fmtMoney(Number(t.revenue))} บาท</span>`);
  if(t.status==='done' && Number(t.harvestQty)>0)facts.push(`<span>เก็บได้ ${fmtNum(Number(t.harvestQty))} ${esc(t.harvestUnit || 'กก.')}</span>`);
  if(photos)facts.push(`<span>${notebookIcon('Image')} ${photos} รูป</span>`);
  if(showCycle)facts.push(`<span>${cycle?esc(cycle.plant)+' · รอบ '+esc(cycle.round || '—'):'ไม่ผูกรอบปลูก'}</span>`);
  return `<article class="nb-work-item">${t.activityMembers?`<button class="task-complete-circle is-done" aria-label="ดูรายการในกิจกรรม ${esc(t.title)}" onclick="${notebookAction('projectViewActivity',t.id)}">✓</button>`:taskCompletionCircleHtml(t,{locked:project?.status==='done'})}<button type="button" class="nb-work-open" onclick="${notebookAction(t.activityMembers?.length?'projectViewActivity':'viewTask',t.id)}" aria-label="${esc('ดูรายละเอียด: '+t.title)}"><span class="nb-work-content"><span class="nb-work-title"><strong>${esc(t.title)}</strong><span class="nb-work-status nb-work-${status}">${esc(statusText || 'วางไว้')}</span></span>${materialText?`<span class="nb-work-material">${materialText}${materials.length>2?` · อีก ${materials.length-2} รายการ`:''}</span>`:''}${facts.length?`<span class="nb-work-facts">${facts.join('')}</span>`:''}${project?`<span class="nb-work-project">${notebookIcon('FolderOpen')} ${esc(projectCode(project))} · ${esc(project.name)}</span>`:''}</span><span class="nb-work-detail">ดูรายละเอียด ${notebookIcon('ChevronRight')}</span></button>${!recorded?`<div class="nb-work-actions"><button class="btn btn-sm btn-ghost" onclick="${notebookAction('rescheduleTask',t.id)}" aria-label="${esc('เลื่อนวัน: '+t.title)}">${notebookIcon('CalendarDays')} เลื่อน</button></div>`:''}</article>`;
}
function notebookHistoryTable(model,{showCycle=false,hideProject=false}={}) {
  const planned=model.mode==='planned';
  return `<div class="nb-table-scroll" role="region" aria-label="ตารางประวัติงาน" tabindex="0"><table class="nb-history-table"><thead><tr><th>วันที่${planned?'ตามแผน':'ทำจริง'}</th><th>งาน / สถานะ</th><th>วัสดุและปริมาณ</th><th>${planned?'งบประมาณ':'เงินที่จ่ายจริง'}</th><th>หลักฐาน / จัดการ</th></tr></thead><tbody>${model.groups.flatMap(group=>group.tasks.map(t=>{
    const project=projectById(t.projectId),cycle=showCycle?cycleById(S,t.cycleId):null,closed=project?.status==='done';
    const items=typeof taskMaterialItems==='function'?taskMaterialItems(t):notebookMaterialItems(t),costs=t.costItems || [];
    const supported=costs.filter(materialIsSupported),labor=costs.filter(ci=>ci.category==='labor').reduce((n,ci)=>n+(Number(ci.totalCost)||0),0);
    const uncertain=costs.filter(ci=>(!ci.category || ci.category==='other') && !taskItemIsMaterial(ci));
    const photos=notebookPhotos(t).length,status=taskStatusOf(t),view=t.activityMembers?'projectViewActivity':'viewTask';
    const statusText={done:'ทำแล้ว',failed:'ไม่สำเร็จ',overdue:'เลยกำหนด',planned:'วางไว้'}[status] || 'วางไว้';
    const amount=t.status==='failed'?'ไม่รวมในต้นทุนจริง':taskDataPending(t)&&!Number(t.cost)?'ยอดรอยืนยัน':fmtMoney(Number(t.cost)||0)+' บาท';
    return `<tr><td data-label="วันที่"><strong>${group.date?esc(dateLabel(group.date)):'ยังไม่ระบุวัน'}</strong>${taskPlannedTime(t)&&planned?`<small>${esc(taskPlannedTime(t))}</small>`:''}${showCycle?`<small>${cycle?esc(cycle.plant)+' · รอบ '+esc(cycle.round || '—'):'ไม่ผูกรอบปลูก'}</small>`:''}</td>
      <td data-label="งาน"><div class="nb-table-work">${t.activityMembers?'<span class="nb-group-check" aria-label="ทำแล้ว">✓</span>':taskCompletionCircleHtml(t,{locked:closed})}<div><button class="nb-table-link" onclick="${notebookAction(view,t.id)}">${esc(t.title || 'กิจกรรม')}</button><small>${esc(statusText)}${taskDataPending(t)?' · ข้อมูลรอตรวจ':''}${t.activityMembers?' · '+t.activityMembers.length+' รายการต้นทาง':''}</small>${!hideProject&&project?`<small>${esc(projectCode(project))}</small>`:''}</div></div></td>
      <td data-label="วัสดุ / ปริมาณ">${items.map(ci=>`<div class="nb-table-material"><span>${esc(ci.name || 'วัสดุเดิม')}</span><strong>${notebookQuantity(ci)}</strong>${materialIsSupported(ci)?'<small class="nb-support-tag">ได้รับสนับสนุน</small>':''}</div>`).join('') || '<span class="muted">—</span>'}</td>
      <td data-label="${planned?'งบประมาณ':'จ่ายจริง'}"><strong>${esc(amount)}</strong>${t.status!=='failed'&&labor?`<small>รวมค่าแรง ${fmtMoney(labor)} บาท</small>`:''}${supported.length?`<small class="nb-support-tag">สนับสนุน ${supported.length} รายการ · จ่าย 0 บาท</small>`:''}${uncertain.length?`<small class="nb-category-review">ตรวจหมวด ${uncertain.length} รายการ</small>`:''}${t.status==='done'&&Number(t.revenue)>0?`<small>รายรับ ${fmtMoney(t.revenue)} บาท</small>`:''}</td>
      <td data-label="หลักฐาน / จัดการ"><button class="btn btn-sm btn-ghost" onclick="${notebookAction(view,t.id)}">${photos?notebookIcon('Image')+' '+photos+' รูป':'ดูรายละเอียด'}</button>${!closed?`<button class="btn btn-sm btn-outline" onclick="${notebookAction(t.activityMembers?'projectViewActivity':'editTask',t.id)}">${t.activityMembers?'ดูรายการ':'แก้ไข'}</button>`:''}${planned?`<button class="btn btn-sm btn-ghost" onclick="${notebookAction('rescheduleTask',t.id)}">เลื่อนวัน</button>`:''}</td></tr>`;
  })).join('')}</tbody></table></div>`;
}
App.notebookHistorySearch=function(input,key){
  const value=input.value,start=input.selectionStart,end=input.selectionEnd;
  notebookHistoryFilters.set(key,{...(notebookHistoryFilters.get(key) || {}),query:value});rerender();
  const next=document.getElementById('nbHistorySearch-'+key);if(next){next.focus();try{next.setSelectionRange(start,end);}catch(_){}}
};
function notebookHistoryHtml(tasks,key,options={}) {
  const filter=notebookHistoryFilters.get(key) || {},model=notebookHistoryModel(tasks,filter),planned=model.mode==='planned',list=filter.view==='list';
  const change=field=>esc('App.notebookHistoryFilter('+JSON.stringify(key)+','+JSON.stringify(field)+',this.value)');
  const empty=filter.type || filter.outcome || filter.query?'ไม่พบงานตามตัวกรองที่เลือก':planned?'ยังไม่มีงานที่วางไว้':'ยังไม่มีงานที่ลงผลแล้ว';
  const content=!model.count?`<p class="nb-empty" role="status">${empty}</p>`:list?model.groups.map(group=>`<section class="nb-work-day"><h3>${notebookIcon('CalendarDays')} ${group.date?esc(dateLabel(group.date)):planned?'ยังไม่กำหนดวัน':'ไม่ระบุวันที่ลงผล'} <small>${group.tasks.length} งาน</small></h3><div class="nb-work-day-items">${group.tasks.map(t=>notebookHistoryRow(t,options)).join('')}</div></section>`).join(''):notebookHistoryTable(model,options);
  return `<section class="nb-card nb-activity-history"><div class="nb-history-heading"><div><h2>ประวัติงาน</h2><small>บันทึกเดียวกันกับแปลง รอบปลูก และโครงการ</small></div>${options.calendar?`<button class="btn btn-outline" onclick="App.cycleDetailTab('calendar')">${notebookIcon('CalendarDays')} ปฏิทินงาน</button>`:''}</div>
    <div class="nb-work-toolbar"><div class="nb-work-tabs" role="group" aria-label="แยกประวัติกับแผนงาน"><button type="button" aria-pressed="${!planned}" onclick="${notebookAction('notebookHistoryFilter',key,'mode','recorded')}">งานที่ทำแล้ว <b>${model.recorded}</b></button><button type="button" aria-pressed="${planned}" onclick="${notebookAction('notebookHistoryFilter',key,'mode','planned')}">งานที่วางไว้ <b>${model.planned}</b></button></div>
    <div class="nb-history-view" role="group" aria-label="มุมมองประวัติ"><button type="button" aria-pressed="${!list}" onclick="${notebookAction('notebookHistoryFilter',key,'view','table')}">ตาราง</button><button type="button" aria-pressed="${list}" onclick="${notebookAction('notebookHistoryFilter',key,'view','list')}">ตามวัน</button></div></div>
    <div class="nb-history-search"><input id="${esc('nbHistorySearch-'+key)}" type="search" aria-label="ค้นหางานหรือวัสดุในประวัติ" placeholder="ค้นหาชื่องาน ยา หรือปุ๋ย" value="${esc(filter.query || '')}" oninput="${esc('App.notebookHistorySearch(this,'+JSON.stringify(key)+')')}"><div class="nb-filters nb-work-filters"><select aria-label="ประเภทงานในประวัติ" onchange="${change('type')}"><option value="">ทุกประเภทงาน</option>${Object.entries(TYPE_LABELS).map(([value,label])=>`<option value="${value}" ${filter.type===value?'selected':''}>${esc(label)}</option>`).join('')}</select>${!planned?`<select aria-label="ผลการทำงาน" onchange="${change('outcome')}">${[['','ทุกผลการทำงาน'],['done','ทำแล้ว'],['failed','ไม่สำเร็จ']].map(([value,label])=>`<option value="${value}" ${filter.outcome===value?'selected':''}>${label}</option>`).join('')}</select>`:''}<select aria-label="เรียงวันที่งาน" onchange="${change('sort')}">${[['new','วันที่ใหม่ → เก่า'],['old','วันที่เก่า → ใหม่']].map(([value,label])=>`<option value="${value}" ${model.sort===value?'selected':''}>${label}</option>`).join('')}</select></div></div>
    <p class="nb-work-hint">${planned?'เรียงตามกำหนดทำงาน · งบประมาณยังไม่ใช่ต้นทุนจริง':'เรียงตามวันที่ลงผลจริง · งานไม่สำเร็จไม่รวมในต้นทุนจริง'} · ${model.count} รายการ</p>${content}</section>`;
}
App.notebookHistoryFilter=function(key,field,value){
  if(!['mode','type','outcome','sort','view'].includes(field))return;
  const filter={...(notebookHistoryFilters.get(key) || {})};
  if(field==='mode'){filter.mode=value==='planned'?'planned':'recorded';filter.sort=filter.mode==='planned'?'old':'new';filter.outcome='';}
  else filter[field]=value;
  notebookHistoryFilters.set(key,filter);rerender();
};
function notebookYield(c,model) {
  const tasks=model.done.filter(t=>taskIncomeMode(t)==='harvest');
  const harvestRevenue=tasks.reduce((sum,t)=>sum+(Number(t.revenue)||0),0);
  const kg=notebookHarvestKg(tasks);
  return `<section class="nb-card"><div class="nb-history-heading"><h2>ผลผลิตของรอบนี้</h2>${c.status==='active'?`<button class="btn btn-outline" onclick="${notebookAction('cycleNotebookAdd',c.id,'harvest')}">บันทึกเก็บเกี่ยว</button>`:''}</div>${tasks.length?tasks.map(t=>taskRowHtml(t,{showDate:true,showNote:true})).join(''):'<p class="nb-empty">ยังไม่มีบันทึกเก็บเกี่ยวในรอบปลูกนี้</p>'}<div class="nb-total"><span>รายรับจากผลผลิต</span><strong>${fmtMoney(harvestRevenue)} บาท</strong></div><div class="nb-total"><span>ต้นทุนต่อกิโลกรัม</span><strong>${kg>0?fmtMoney(model.finance.cost/kg)+' บาท/กก.':kg===null?'มีผลผลิตที่ยังไม่ระบุน้ำหนัก':'ยังไม่มีน้ำหนักผลผลิต'}</strong></div></section>`;
}
function notebookHarvestKg(tasks){let kg=0;for(const t of tasks){const qty=Number(t.harvestQty)||0;if(qty<=0)continue;const unit=String(t.harvestUnit || 'กก.').trim().toLowerCase();if(['kg','กก','กก.','กิโลกรัม'].includes(unit))kg+=qty;else if(['g','กรัม'].includes(unit))kg+=qty/1000;else return null;}return kg;}
function notebookOverview(c,model) {
  return `<div class="nb-columns"><div><section class="nb-card">${cycleJourneyHtml(c,model.tasks)}<div class="nb-overview-actions"><button class="btn btn-outline" onclick="App.cycleDetailTab('tasks')">ดูประวัติงาน</button><button class="btn btn-outline" onclick="App.cycleDetailTab('calendar')">${notebookIcon('CalendarDays')} ปฏิทินงาน</button></div></section>${notebookYield(c,model)}<details class="nb-card nb-settings"><summary>จัดการรอบปลูก</summary><div class="nb-overview-actions"><button class="btn btn-outline" onclick="${notebookAction('modalCycle',c.plotId,c.id)}">แก้ไขรอบ</button><button class="btn btn-outline" onclick="${notebookAction('openShareLink',c.plotId,c.id)}">QR Passport</button><button class="btn btn-outline" onclick="${notebookAction(c.status==='active'?'completeCycle':'reopenCycle',c.id)}">${c.status==='active'?'ปิดรอบการปลูก':'เปิดรอบการปลูกอีกครั้ง'}</button><button class="btn btn-danger-soft" onclick="${notebookAction('deleteCycle',c.id)}">ลบรอบปลูก</button></div></details></div><aside class="nb-sidebar">${notebookCostCard(model)}${notebookProjectCard(model.projects)}${notebookReportCard(c)}</aside></div>`;
}
function notebookCostDetails(model) {
  const breakdown=costBreakdown({...S,tasks:model.done});
  return `<div class="nb-columns"><section class="nb-card"><h2>ต้นทุนแยกตามหมวด</h2>${breakdown.length?breakdown.map(row=>`<div class="nb-total"><span>${esc(row.label)}</span><strong>${fmtMoney(row.value)} บาท</strong></div>`).join(''):'<p class="nb-empty">ยังไม่มีต้นทุนที่บันทึกแล้ว</p>'}<div class="nb-total"><strong>รวมทั้งหมด</strong><strong>${fmtMoney(model.finance.cost)} บาท</strong></div><p class="nb-table-note">เฉพาะงานที่เสร็จแล้วในรอบปลูกนี้ · ไม่รวมงานวางแผนและรายการรอตรวจรับ</p></section><aside class="nb-sidebar">${notebookCostCard(model)}${notebookReportCard(cycleById(S,route.cycleId))}</aside></div>`;
}
function notebookReport(c,model) {
  const p=plotById(S,c.plotId);
  return `<div class="pw-page"><div class="pw-report-tools"><div><h2>ร่างเล่มสรุปรอบปลูก</h2><small>จากข้อมูลล่าสุด · ตรวจข้อมูลก่อนส่งออก</small></div><button class="btn btn-outline" onclick="App.cycleDetailTab('materials')">กลับสมุดรอบปลูก</button><button class="btn btn-primary" onclick="App.projectPrint()">${notebookIcon('Printer')} พิมพ์ / บันทึก PDF</button></div><article class="pw-report-document"><span>สมุดประจำรอบปลูก</span><h1>${esc(p?.name || 'แปลง')} · รอบปลูก ${esc(c.round || '—')}</h1><p>${esc(c.plant)} · เริ่ม ${esc(dateLabel(c.startDate))} · พื้นที่ ${fmtNum(model.area)} ไร่</p><h2>ข้อมูลรอบปลูก</h2><p>${esc(c.note || 'ยังไม่มีบันทึกเพิ่มเติม')}</p><h2>ต้นทุนและผลผลิต</h2><p>ต้นทุน ${fmtMoney(model.finance.cost)} บาท · รายรับ ${fmtMoney(model.finance.revenue)} บาท</p>${model.done.filter(t=>taskIncomeMode(t)==='harvest').map(t=>`<p>${esc(t.title)} · ${fmtNum(Number(t.harvestQty)||0)} ${esc(t.harvestUnit || 'กก.')} · ${esc(dateLabel(taskRecordDate(t)))}</p>`).join('')}<h2>ประวัติการดำเนินงาน</h2>${model.tasks.slice().reverse().map(t=>`<section><h3>${esc(t.title)}</h3><small>${esc(dateLabel(taskRecordDate(t)))} · ${t.status==='done'?'เสร็จแล้ว':t.status==='failed'?'ไม่สำเร็จ':'ยังไม่เสร็จ'}</small><p>${esc(t.doneNote || t.note || '')}</p><p>ต้นทุนที่บันทึก ${fmtMoney(t.status==='done'?Number(t.cost)||0:0)} บาท</p>${(t.costItems || []).map(ci=>`<p>${esc(ci.name)} · ${notebookQuantity(ci)} · ${fmtMoney(Number(ci.totalCost)||0)} บาท${t.status!=='done'?' (ตามแผน ยังไม่รวมต้นทุนจริง)':''}</p>`).join('')}${trialPhotosHtml(notebookPhotos(t))}</section>`).join('')}<h2>โครงการที่เกี่ยวข้อง</h2>${model.projects.map(p=>`<section><h3>${esc(projectCode(p))} · ${esc(p.name)}</h3><p>วัตถุประสงค์: ${esc(p.objective || p.description || 'ยังไม่ระบุ')}</p><p>สรุปผล: ${esc(p.conclusion || 'ยังไม่มีข้อสรุป')}</p></section>`).join('') || '<p>ยังไม่มีโครงการที่เชื่อม</p>'}</article></div>`;
}
function renderCycleNotebook(c) {
  const p=plotById(S,c.plotId),model=notebookModel(c),tab=cycleDetailTab;
  if(tab==='calendar' && (!Number.isInteger(cycleCal.y) || cycleCal.y<1)) {
    const start=new Date((c.startDate || todayISO())+'T00:00:00');
    cycleCal={y:start.getFullYear(),m:start.getMonth(),sel:null};
  }
  const tabs=[['overview','ภาพรวม'],['tasks','ประวัติงาน'],['materials','ยาและปุ๋ย'],['costs','ต้นทุน'],['yield','ผลผลิต'],['projects','โครงการที่เกี่ยวข้อง']];
  const content=tab==='report'?notebookReport(c,model):tab==='materials'?notebookMaterials(c,model):tab==='tasks'?notebookActivityList(c,model):tab==='costs'?notebookCostDetails(model):tab==='yield'?notebookYield(c,model):tab==='projects'?notebookProjectWorkspace(c,model):tab==='calendar'?`<section class="nb-card"><h2>ปฏิทินงาน</h2>${cycleCalCardHtml(c)}</section>`:notebookOverview(c,model);
  return `<div class="nb-page"><header class="nb-header"><div><div class="nb-eyebrow">สมุดประจำรอบปลูก${typeof LOCAL_SENSOR_PREVIEW!=='undefined'&&LOCAL_SENSOR_PREVIEW?'<span class="nb-preview-badge">ข้อมูลตัวอย่าง</span>':''}</div><div class="nb-title"><h1>${esc(p?.name || 'แปลงถูกลบ')} · รอบปลูก ${esc(c.round || '—')}</h1><span class="nb-status ${c.status==='active'?'':'nb-closed'}">${c.status==='active'?'กำลังปลูก':'ปิดรอบแล้ว'}</span></div><p>${esc(c.plant)} · พื้นที่ ${model.area>0?fmtNum(model.area)+' ไร่':'ยังไม่ระบุ'} · เริ่ม ${esc(dateLabel(c.startDate))}</p></div><div class="nb-header-actions"><button class="btn btn-outline" onclick="${notebookAction('cycleNotebookReport',c.id)}">${notebookIcon('FileText')} เล่มสรุปรอบปลูก</button>${c.status==='active'?`<button class="btn btn-primary" onclick="${notebookAction('cycleNotebookAdd',c.id)}">${notebookIcon('Plus')} บันทึกกิจกรรม</button>`:''}</div></header><div class="nb-stats"><div class="nb-stat"><span class="nb-stat-icon">${notebookIcon('Coins')}</span><div><span>ต้นทุนที่ยืนยันแล้ว</span><strong>${fmtMoney(model.finance.cost)} บาท</strong></div></div><div class="nb-stat"><span class="nb-stat-icon">${notebookIcon('Sprout')}</span><div><span>ต้นทุนต่อไร่</span><strong>${model.area>0?fmtMoney(model.finance.cost/model.area)+' บาท':'ยังไม่ทราบพื้นที่'}</strong></div></div><button class="nb-stat nb-pending" onclick="${notebookAction('cycleNotebookShowPending',c.id)}"><span class="nb-stat-icon">${notebookIcon('ClipboardList')}</span><div><span>รายการรอตรวจรับ</span><strong id="nbPendingCount">กำลังตรวจสอบ</strong><small id="nbPendingNote">ยังไม่รวมในต้นทุน</small></div></button></div><nav class="nb-tabs" aria-label="ข้อมูลรอบปลูก">${tabs.map(([key,label])=>`<button class="${tab===key?'active':''}" aria-pressed="${tab===key}" onclick="App.cycleDetailTab('${key}')">${label}</button>`).join('')}</nav>${content}</div>`;
}
App.cycleNotebookFilter=function(key,value) {
  if(!['category','month'].includes(key))return;
  const filter=notebookFilters.get(route.cycleId) || {category:'',month:''};
  filter[key]=value;notebookFilters.set(route.cycleId,filter);rerender();
};
App.cycleNotebookReport=function(id) { route.view='cycleDetail';route.cycleId=id;cycleDetailTab='report';render(); };
App.cycleNotebookAdd=function(id,type='work') {
  const cycle=cycleById(S,id);if(!cycle || cycle.status!=='active')return;
  App.modalTask(todayISO(),{plotId:cycle.plotId,cycleId:cycle.id,scope:'plot',type,status:'done'});
};
App.cycleNotebookOpenResult=function(id,taskId) { projectSelectedTask=taskId;projectWorkspaceTab='work';App.projectOpen(id); };
function notebookPendingRows(rows,cycleId) {
  return rows.filter(row=>{try{return row.status==='pending' && (typeof row.payload==='string'?JSON.parse(row.payload):row.payload)?.cycleId===cycleId;}catch(_){return false;}});
}
App.cycleNotebookLoadPending=async function(id) {
  const session=Auth.session,node=document.getElementById('nbPendingCount');if(!node)return;
  if(session?.localPreview){node.textContent='0 รายการ';return;}
  const key=(session?.email || '')+'::'+id,cached=notebookPending.get(key);
  if(cached?.session===session && Date.now()-cached.at<30000){node.textContent=cached.rows.length+' รายการ';return;}
  try {
    if(!session?.token)throw new Error('offline');
    const rows=[];
    for(let offset=0;;offset+=100){const page=await Team.call('team_inbox',{status:'pending',offset});if(Auth.session!==session)return;rows.push(...notebookPendingRows(page,id));if(page.length<100)break;}
    if(Auth.session!==session)return;
    notebookPending.set(key,{session,rows,at:Date.now()});
    if(node.isConnected)node.textContent=rows.length+' รายการ';
  }catch(_){if(node.isConnected && Auth.session===session){node.textContent='ยังตรวจสอบไม่ได้';document.getElementById('nbPendingNote').textContent='แตะเพื่อเปิดหน้าตรวจรับ';}}
};
App.cycleNotebookShowPending=function(id) {
  if(Auth.session?.localPreview){openModal('<button class="modal-x" onclick="App.closeModal()" aria-label="ปิด">'+notebookIcon('X')+'</button><h3>รายการรอตรวจรับ</h3><p>ข้อมูลตัวอย่างรอบนี้ไม่มีรายการรอตรวจรับ</p><p class="muted">งานที่วางแผนไว้ดูได้ในแท็บประวัติงาน</p>');return;}
  const cached=notebookPending.get((Auth.session?.email || '')+'::'+id);
  openModal('<button class="modal-x" onclick="App.closeModal()" aria-label="ปิด">'+notebookIcon('X')+'</button><h3>รายการรอตรวจรับของรอบนี้</h3>'+(cached?.session===Auth.session?cached.rows.map(row=>{const p=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;return '<p><strong>'+esc(p.title)+'</strong><br>'+esc(dateLabel(p.date))+'</p>';}).join('') || '<p>ไม่มีรายการรอตรวจรับ</p>':'<p>ยังโหลดข้อมูลไม่ได้ เปิดหน้าตรวจรับเพื่อตรวจสอบล่าสุด</p>')+'<button class="btn btn-primary" onclick="App.closeModal();Concept.go(\'team\')">เปิดหน้าตรวจรับข้อมูล</button>');
};

// The app restores its route before this module loads; refresh that initial view now.
if(typeof route!=='undefined' && ['plotDetail','cycleDetail'].includes(route.view) && typeof render==='function')render();
