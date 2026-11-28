"use strict";

// A calendar read model over the same activities used by plots, projects and costs.
function farmCalendarTime(task) {
  return taskPlannedTime(['done','failed'].includes(task.status) ? {time:task.doneTime} : task);
}
function farmCalendarSort(a,b) {
  return taskRecordDate(a).localeCompare(taskRecordDate(b)) ||
    Number(a.status==='done')-Number(b.status==='done') ||
    (farmCalendarTime(a)||'99:99').localeCompare(farmCalendarTime(b)||'99:99') || String(a.id).localeCompare(String(b.id));
}
function farmCalendarMonth(date, delta=0) {
  const d=new Date(date+'T12:00:00'),day=d.getDate();
  d.setDate(1);d.setMonth(d.getMonth()+delta);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0,12).getDate()));
  return overviewISO(d);
}
function farmCalendarDays(date) {
  const first=date.slice(0,7)+'-01',d=new Date(first+'T12:00:00');
  const last=overviewISO(new Date(d.getFullYear(),d.getMonth()+1,0,12));
  const start=overviewWeek(first)[0],end=overviewWeek(last)[6],days=[];
  for(let day=start;day<=end;day=overviewOffset(day,1))days.push(day);
  return days;
}
function farmCalendarModel(state, selected, filters={}, today=todayISO()) {
  const query=String(filters.query||'').trim().toLocaleLowerCase('th');
  const tasks=(state.tasks||[]).filter(t=>
    (!query||[t.title,t.note,t.doneNote].some(v=>String(v||'').toLocaleLowerCase('th').includes(query))) &&
    (!filters.plot||t.plotId===filters.plot) && (!filters.cycle||t.cycleId===filters.cycle) &&
    (!filters.project||t.projectId===filters.project) && (!filters.type||t.type===filters.type) &&
    (!filters.scope||(filters.scope==='farm'?!t.plotId:!!t.plotId)) &&
    (!filters.status||t.status===filters.status)).slice().sort(farmCalendarSort);
  const byDay=new Map(),undated=[];
  for(const task of tasks){const day=taskRecordDate(task);if(!overviewValidDate(day)){undated.push(task);continue;}if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(task);}
  const selectedTasks=byDay.get(selected)||[],ids=new Set(selectedTasks.map(t=>t.projectId).filter(Boolean));
  const related=(state.projects||[]).filter(p=>ids.has(p.id)||filters.project===p.id);
  return {tasks,byDay,selectedTasks,related,undated,overdue:tasks.filter(t=>t.status==='planned'&&overviewValidDate(t.date)&&t.date<today)};
}
function farmCalendarAction(method,...args) { return esc('FarmCalendar.'+method+'('+args.map(v=>JSON.stringify(v)).join(',')+')'); }
function farmCalendarMonthLabel(date) { return new Date(date+'T12:00:00').toLocaleDateString('th-TH',{month:'long',year:'numeric'}); }
function farmCalendarType(task) { return ['spray','fertilize','water','inspect','harvest'].includes(task.type)?task.type:'work'; }
function farmCalendarChip(task) {
  const plot=plotById(S,task.plotId),time=farmCalendarTime(task),status=taskStatusText(task);
  const text=[time,task.title,plot?.name].filter(Boolean).join(' · ');
  return `<button class="fc-chip fc-${farmCalendarType(task)} ${task.status==='done'?'is-done':''}" title="${esc(text+' · '+status)}" aria-label="${esc(text+' · '+status)}" onclick="${overviewApp('viewTask',task.id)}">${ic(task.status==='done'?'check':task.status==='failed'?'alert':TYPE_ICONS[task.type]||'calendar')}<span>${time?'<b>'+esc(time)+'</b> ':''}${esc(task.title)}${plot?'<small> · '+esc(plot.name)+'</small>':''}</span></button>`;
}
function farmCalendarGrid(model,selected,mode) {
  const dates=mode==='week'?overviewWeek(selected):farmCalendarDays(selected),today=todayISO(),weekdays=['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
  return `<div class="fc-grid fc-${mode}" aria-label="${mode==='week'?'ปฏิทินรายสัปดาห์':'ปฏิทินรายเดือน'}"><div class="fc-weekdays" aria-hidden="true">${weekdays.map(d=>'<span>'+d+'</span>').join('')}</div><div class="fc-days">${dates.map(date=>{
    const tasks=model.byDay.get(date)||[],label=overviewDate(date,true)+' · '+tasks.length+' งาน';
    return `<article class="fc-day ${date.slice(0,7)!==selected.slice(0,7)?'outside':''} ${date===selected?'selected':''} ${date===today?'is-today':''}"><button class="fc-day-pick" aria-label="${esc(label)}" aria-pressed="${date===selected}" ${date===today?'aria-current="date"':''} onclick="${farmCalendarAction('select',date,true)}"><span>${Number(date.slice(-2))}</span><small>${tasks.length?tasks.length+' งาน':''}</small></button><div class="fc-day-events">${tasks.slice(0,mode==='week'?5:3).map(farmCalendarChip).join('')}${tasks.length>(mode==='week'?5:3)?`<button class="fc-overflow" onclick="${farmCalendarAction('select',date,true)}">ดูอีก ${tasks.length-(mode==='week'?5:3)} งาน</button>`:''}</div></article>`;
  }).join('')}</div></div>`;
}
function farmCalendarTask(task) {
  const time=farmCalendarTime(task),overdue=task.status==='planned'&&overviewValidDate(task.date)&&task.date<todayISO();
  return `<article class="fc-task" data-calendar-task="${esc(task.id)}">${taskCompletionCircleHtml(task,{locked:projectById(task.projectId)?.status==='done'})}<div class="fc-task-body"><button class="fc-task-title" onclick="${overviewApp('viewTask',task.id)}">${esc(task.title)}</button>${overviewContext(task)}<div class="fc-task-meta">${time?'<span>'+ic('clock')+esc(time)+(task.status==='planned'?'':' · ทำจริง')+'</span>':''}<span class="${overdue||task.status==='failed'?'fc-late':'fc-status'}">${esc(taskStatusText(task))}</span>${task.status==='planned'&&taskNeedsMaterialReview(task)?'<span class="fo-review">ตรวจปริมาณและต้นทุน</span>':''}</div></div><button class="fc-task-detail" aria-label="${esc('ดูรายละเอียด: '+task.title)}" onclick="${overviewApp('viewTask',task.id)}">${ic('chevron')}</button></article>`;
}
function farmCalendarSelected(model,selected) {
  const pending=model.selectedTasks.filter(t=>!['done','failed'].includes(t.status)),done=model.selectedTasks.filter(t=>t.status==='done'),failed=model.selectedTasks.filter(t=>t.status==='failed');
  return `<section class="fc-card fc-selected"><header><div><h2 id="fcSelectedHeading" tabindex="-1">${selected===todayISO()?'งานวันนี้':'งานวันที่เลือก'}</h2><p>${overviewDate(selected,true)}</p></div><span class="fc-count">${model.selectedTasks.length} งาน</span></header>${pending.map(farmCalendarTask).join('')}${done.length?`<details class="fc-completed" ${FarmCalendar.doneOpen?'open':''} ontoggle="FarmCalendar.doneOpen=this.open"><summary>${ic('check')} ทำแล้ว ${done.length} งาน ${ic('chevron')}</summary>${done.map(farmCalendarTask).join('')}</details>`:''}${failed.length?`<section class="fc-failed"><h3>ไม่สำเร็จ ${failed.length} งาน</h3>${failed.map(farmCalendarTask).join('')}</section>`:''}${!model.selectedTasks.length?'<div class="fc-empty">'+ic('calendar')+'<strong>ไม่มีงานในวันที่เลือก</strong><p>เลือกวันอื่น หรือวางแผนงานสำหรับวันที่เลือก</p></div>':''}<button class="fc-add-day" onclick="FarmCalendar.add()">${ic('plus')} ${selected===todayISO()?'วางแผนงานวันนี้':'วางแผนงานวันที่เลือก'}</button><p class="fc-date-note">งานที่ทำแล้วแสดงตามวันที่ทำจริง</p></section>`;
}
function farmCalendarProjects(projects) {
  return `<section class="fc-card fc-projects"><header><h2>${ic('leaf')} โครงการที่เกี่ยวข้อง</h2></header>${projects.length?projects.map(p=>`<article><small>${esc(projectCode(p))}</small><button class="fc-project-title" onclick="${overviewAction('project',p.id)}">${esc(p.name)} ${ic('chevron')}</button>${projectProgressHtml(p)}${p.status==='done'?'<small>ปิดโครงการแล้ว</small>':''}</article>`).join(''):'<p class="fc-muted">ไม่มีโครงการที่เกี่ยวข้องกับงานของวันที่เลือก</p>'}</section>`;
}
function farmCalendarFilters() {
  const f={...plannerSearch,project:FarmCalendar.project,status:FarmCalendar.status},count=Object.values(f).filter(Boolean).length;
  const options=(rows,value)=>rows.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
  return `<div class="fc-search-row"><label class="fc-search">${ic('search')}<input id="plannerQuery" type="search" value="${esc(f.query)}" placeholder="ค้นหาชื่องานหรือบันทึก" aria-label="ค้นหางานในปฏิทิน" oninput="App.plannerQueryInput(this,event)" oncompositionend="App.plannerQueryInput(this,event)"></label><button class="btn btn-outline" aria-expanded="${FarmCalendar.filtersOpen}" aria-controls="fcFilters" onclick="FarmCalendar.filtersOpen=!FarmCalendar.filtersOpen;rerender()">${ic('gear')} ตัวกรอง${count?' ('+count+')':''}</button>${count?'<button class="fc-link" onclick="FarmCalendar.clearFilters()">ล้างตัวกรอง</button>':''}</div><div id="fcFilters" class="fc-filters" ${FarmCalendar.filtersOpen?'':'hidden'}>
    <label>แปลง<select aria-label="กรองแปลง" onchange="FarmCalendar.filter('plot',this.value)"><option value="">ทุกแปลง</option>${options(S.plots.map(p=>[p.id,p.name]),f.plot)}</select></label>
    <label>รอบปลูก<select aria-label="กรองรอบปลูก" onchange="FarmCalendar.filter('cycle',this.value)"><option value="">ทุกรอบ</option>${options(S.cycles.filter(c=>!f.plot||c.plotId===f.plot).map(c=>[c.id,(plotById(S,c.plotId)?.name||'')+' · '+c.plant+' · รอบ '+(c.round||'—')]),f.cycle)}</select></label>
    <label>โครงการ<select aria-label="กรองโครงการ" onchange="FarmCalendar.filter('project',this.value)"><option value="">ทุกโครงการ</option>${options(S.projects.map(p=>[p.id,projectCode(p)+' · '+p.name]),f.project)}</select></label>
    <label>ประเภท<select aria-label="กรองประเภทงาน" onchange="FarmCalendar.filter('type',this.value)"><option value="">ทุกประเภท</option>${options(Object.entries(TYPE_LABELS),f.type)}</select></label>
    <label>สถานะ<select aria-label="กรองสถานะงาน" onchange="FarmCalendar.filter('status',this.value)"><option value="">ทุกสถานะ</option>${options([['planned','วางแผนไว้'],['done','ทำแล้ว'],['failed','ไม่สำเร็จ']],f.status)}</select></label>
    <label>บันทึกให้กับ<select aria-label="กรองขอบเขตงาน" onchange="FarmCalendar.filter('scope',this.value)"><option value="">ทั้งหมด</option>${options([['farm','งานส่วนกลาง'],['plot','รายแปลง']],f.scope)}</select></label></div>`;
}
const FarmCalendar={
  mode:'',project:'',status:'',filtersOpen:false,doneOpen:false,
  selected(){return overviewValidDate(cal.sel)?cal.sel:`${cal.y}-${String(cal.m+1).padStart(2,'0')}-01`;},
  currentMode(){return this.mode||(matchMedia('(max-width:899px)').matches?'week':'month');},
  select(date,focus=false){if(!overviewValidDate(date))return;const d=new Date(date+'T12:00:00');cal={y:d.getFullYear(),m:d.getMonth(),sel:date};rerender();if(focus&&matchMedia('(max-width:899px)').matches)document.getElementById('fcSelectedHeading')?.scrollIntoView({block:'start',behavior:'smooth'});},
  view(mode){if(!['day','week','month'].includes(mode))return;this.mode=mode;rerender();},
  move(delta){const mode=this.currentMode(),date=this.selected();this.select(mode==='month'?farmCalendarMonth(date,delta):overviewOffset(date,delta*(mode==='week'?7:1)));},
  today(){this.select(todayISO());},
  filter(key,value){if(['project','status'].includes(key))this[key]=value;else if(Object.hasOwn(plannerSearch,key)){plannerSearch[key]=value;if(key==='plot')plannerSearch.cycle='';if(key==='scope'&&value==='farm'){plannerSearch.plot='';plannerSearch.cycle='';}}rerender();},
  clearFilters(){this.project='';this.status='';App.clearPlannerSearch();},
  add(){const preset={status:'planned'};for(const [key,target] of [['plot','plotId'],['cycle','cycleId'],['type','type'],['scope','scope']])if(plannerSearch[key])preset[target]=plannerSearch[key];if(this.project&&projectById(this.project)?.status!=='done')preset.projectId=this.project;App.modalTask(this.selected(),preset);},
  chooseDate(){openModal(`<button class="modal-x" aria-label="ปิด" onclick="App.closeModal()">${notebookIcon('X')}</button><h3>ไปวันที่</h3><form onsubmit="return FarmCalendar.jump(event)"><label class="field">เลือกวันที่<input type="date" name="date" aria-label="วันที่ต้องการดู" required value="${this.selected()}"></label><button type="submit" class="btn btn-primary">ดูงานวันที่เลือก</button></form>`);},
  jump(event){event.preventDefault();const date=event.target.elements.date.value;if(!overviewValidDate(date))return false;closeModal();this.select(date);return false;},
  extra(kind){const m=farmCalendarModel(S,this.selected(),{...plannerSearch,project:this.project,status:this.status});const tasks=kind==='overdue'?m.overdue:m.undated;openModal(`<button class="modal-x" aria-label="ปิด" onclick="App.closeModal()">${notebookIcon('X')}</button><h3>${kind==='overdue'?'งานเลยกำหนด':'งานที่ยังไม่กำหนดวัน'}</h3><div class="fc-extra-list">${tasks.map(t=>'<div><small class="fc-muted">'+(overviewValidDate(taskRecordDate(t))?overviewDate(taskRecordDate(t),true):'ยังไม่กำหนดวัน')+'</small>'+farmCalendarTask(t)+'</div>').join('')||'<p>ไม่มีงานในกลุ่มนี้</p>'}</div>`);}
};
const farmCalendarPreviousPlanner=renderPlanner;
renderPlanner=function(){
  if(!Concept.enabled()||!plannerCalendarOpen)return farmCalendarPreviousPlanner();
  const selected=FarmCalendar.selected(),mode=FarmCalendar.currentMode(),model=farmCalendarModel(S,selected,{...plannerSearch,project:FarmCalendar.project,status:FarmCalendar.status});
  const period=mode==='month'?farmCalendarMonthLabel(selected):mode==='week'?overviewDate(overviewWeek(selected)[0])+' – '+overviewDate(overviewWeek(selected)[6])+' '+(Number(overviewWeek(selected)[6].slice(0,4))+543):overviewDate(selected,true);
  return `<div class="fc-page"><header class="fc-heading"><div><h1>ปฏิทินงาน</h1><p>วางแผนและติดตามงานในแปลงของคุณ</p></div><button class="btn btn-outline" onclick="App.plannerView(false)">${ic('menu')} รายการงาน</button></header>${farmCalendarFilters()}<div class="fc-layout ${mode==='day'?'fc-day-layout':''}"><main class="fc-card fc-calendar"><div class="fc-toolbar"><div class="fc-navigation"><button aria-label="ช่วงก่อนหน้า" onclick="FarmCalendar.move(-1)">${ic('chevron')}</button><button aria-label="ช่วงถัดไป" onclick="FarmCalendar.move(1)">${ic('chevron')}</button><button class="fc-period" aria-label="เลือกวันที่" onclick="FarmCalendar.chooseDate()">${ic('calendar')}<strong>${period}</strong></button></div><div class="fc-toolbar-actions"><button class="fc-today" onclick="FarmCalendar.today()">วันนี้</button><div class="fc-modes" role="group" aria-label="มุมมองปฏิทิน">${[['day','วัน'],['week','สัปดาห์'],['month','เดือน']].map(([key,label])=>`<button aria-pressed="${mode===key}" onclick="${farmCalendarAction('view',key)}">${label}</button>`).join('')}</div><button class="btn btn-primary" onclick="FarmCalendar.add()">${ic('plus')} วางแผนงาน</button></div></div>${mode==='day'?farmCalendarSelected(model,selected):farmCalendarGrid(model,selected,mode)}<div class="fc-legend"><span class="fc-fertilize">${ic('leaf')} ใส่ปุ๋ย</span><span class="fc-spray">${ic('spray')} ฉีดยา</span><span class="fc-water">${ic('droplet')} รดน้ำ</span><span>${ic('check')} ทำแล้ว</span></div></main><aside class="fc-sidebar">${model.overdue.length?`<button class="fc-notice" onclick="FarmCalendar.extra('overdue')">${ic('alert')}<span>เลยกำหนด ${model.overdue.length} งาน</span>${ic('chevron')}</button>`:''}${mode==='day'?'':farmCalendarSelected(model,selected)}${farmCalendarProjects(model.related)}${model.undated.length?`<button class="fc-link" onclick="FarmCalendar.extra('undated')">งานที่ยังไม่กำหนดวัน ${model.undated.length} งาน ${ic('chevron')}</button>`:''}</aside></div></div>`;
};
