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
      for(const ci of items) categories[bucket(ci.category)]+=Number(ci.totalCost)||0;
    } else categories[bucket(t.costCat)]+=cost;
  }
  const materials=done.filter(t=>['spray','fertilize'].includes(t.type) || t.costItems?.some(ci=>['chemical','fertilizer'].includes(ci.category)));
  return {tasks,done,finance,categories,materials,projects:notebookProjects(c),area:Number(plotById(S,c.plotId)?.sizeRai)||0};
}
function notebookMaterialItems(t, category='') {
  const items=(t.costItems || []).filter(ci=>['chemical','fertilizer'].includes(ci.category));
  if(items.length) return items.filter(ci=>!category || ci.category===category);
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
  return qty==null?'ไม่ระบุ':fmtNum(Number(qty)||0)+' '+esc(labels[unit] || unit);
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
  return `<section class="nb-card nb-projects"><h2>โครงการที่เชื่อมอยู่</h2>${projects.length?projects.map(p=>`<div class="nb-project"><span class="nb-square-icon">${notebookIcon('FlaskConical')}</span><div><button class="nb-project-code" onclick="${notebookAction('projectOpen',p.id)}">${esc(projectCode(p))}</button><strong>${esc(p.name)}</strong><small>${full?esc(p.objective || p.description || 'ยังไม่ระบุวัตถุประสงค์'):'ใช้กิจกรรมและหลักฐานชุดเดียวกัน'}</small></div><button class="nb-text-link" onclick="${notebookAction('projectOpen',p.id)}">เปิดโครงการ ${notebookIcon('ArrowRight')}</button></div>`).join(''):'<p class="nb-empty">ยังไม่มีโครงการที่เชื่อมรอบปลูกนี้</p><button class="nb-text-link" onclick="App.go(\'projects\')">ไปที่งานและการทดลอง '+notebookIcon('ArrowRight')+'</button>'}</section>`;
}
function notebookReportCard(c) {
  return `<section class="nb-card nb-book"><h2>เล่มสรุปรอบปลูก</h2><div><span class="nb-square-icon">${notebookIcon('FileText')}</span><p>รวมประวัติงาน ต้นทุน ผลผลิต และรูปภาพ</p><button class="btn btn-outline" onclick="${notebookAction('cycleNotebookReport',c.id)}">ดูร่างเล่มสรุป</button></div></section>`;
}
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
  const filter=notebookFilters.get(c.id) || {category:'',month:''}, rows=notebookMaterialRows(c,filter);
  const months=[...new Set(model.materials.map(t=>taskRecordDate(t).slice(0,7)))].filter(Boolean).sort().reverse();
  const total=rows.reduce((sum,row)=>sum+row.items.reduce((n,ci)=>n+(Number(ci.totalCost)||0),0),0);
  return `<div class="nb-columns"><section class="nb-card nb-history"><div class="nb-history-heading"><h2>ประวัติการใช้ยาและปุ๋ย</h2><div class="nb-filters"><select aria-label="ประเภทวัสดุ" onchange="App.cycleNotebookFilter('category',this.value)"><option value="">ทุกรายการ</option><option value="fertilizer" ${filter.category==='fertilizer'?'selected':''}>ปุ๋ย</option><option value="chemical" ${filter.category==='chemical'?'selected':''}>ยา</option></select><label class="nb-month">${notebookIcon('CalendarDays')}<select aria-label="เดือนที่ใช้วัสดุ" onchange="App.cycleNotebookFilter('month',this.value)"><option value="">ทุกเดือน</option>${months.map(month=>`<option value="${esc(month)}" ${filter.month===month?'selected':''}>${esc(notebookMonth(month))}</option>`).join('')}</select></label></div></div><div class="nb-table-scroll"><table class="nb-material-table"><thead><tr><th>วันที่</th><th>กิจกรรม / วัสดุ</th><th>ใช้จริง</th><th>ค่าวัสดุ</th><th>หลักฐาน</th><th><span class="nb-sr-only">รายละเอียด</span></th></tr></thead><tbody>${rows.map(({task:t,items})=>`<tr><td>${esc(dateLabel(taskRecordDate(t)))}</td><td><button class="nb-task-title" onclick="${notebookAction('viewTask',t.id)}">${esc(t.title)}</button>${items.map(ci=>`<span class="nb-material-name">${esc(ci.name || 'ไม่ระบุชื่อวัสดุ')}</span>`).join('')}${t.projectId&&projectById(t.projectId)?`<button class="nb-project-code nb-row-project" onclick="${notebookAction('projectOpen',t.projectId)}">${notebookIcon('Link')} ${esc(projectCode(projectById(t.projectId)))}</button>`:''}</td><td>${items.map(ci=>`<span class="nb-material-value">${notebookQuantity(ci)}</span>`).join('')}</td><td>${items.map(ci=>`<span class="nb-material-value">${fmtMoney(Number(ci.totalCost)||0)} บาท</span>`).join('')}</td><td><button class="nb-evidence" onclick="${notebookAction('viewTask',t.id)}" aria-label="${esc('ดูหลักฐาน: '+t.title)}">${notebookIcon('Image')} ${notebookPhotos(t).length} รูป</button></td><td><button class="nb-row-open" onclick="${notebookAction('viewTask',t.id)}" aria-label="${esc('เปิดกิจกรรม: '+t.title)}">${notebookIcon('ChevronRight')}</button></td></tr>`).join('') || '<tr><td colspan="6" class="nb-empty">'+(model.materials.length?'ไม่พบรายการตามตัวกรองที่เลือก':'ยังไม่มีการใช้ยาและปุ๋ยที่บันทึกเสร็จแล้วในรอบนี้')+'</td></tr>'}</tbody><tfoot><tr><th colspan="3">ค่าวัสดุที่ใช้รวม${filter.category || filter.month?' · ตามตัวกรอง':''}</th><td colspan="3">${fmtMoney(total)} บาท</td></tr></tfoot></table></div><p class="nb-table-note">${notebookIcon('Info')} แตะรายการเพื่อดูวัสดุ ค่าแรง รูปภาพ และรายละเอียดการบันทึก</p>${notebookBridge(c,model)}</section><aside class="nb-sidebar">${notebookCostCard(model)}${notebookProjectCard(model.projects)}${notebookReportCard(c)}</aside></div>`;
}
function notebookActivityList(c,model) {
  const f=cycTaskFilter;
  let tasks=model.tasks.filter(t=>(!f.type || t.type===f.type) && (!f.status || t.status===f.status) && (!f.costOnly || Number(t.cost)>0));
  if(f.sort==='old') tasks.reverse();
  if(f.sort==='cost') tasks.sort((a,b)=>(Number(b.cost)||0)-(Number(a.cost)||0));
  return `<section class="nb-card"><div class="nb-history-heading"><h2>ประวัติงาน <small>${tasks.length} รายการ</small></h2><button class="btn btn-outline" onclick="App.cycleDetailTab('calendar')">${notebookIcon('CalendarDays')} ปฏิทินงาน</button></div><div class="nb-filters nb-task-filters"><select aria-label="สถานะกิจกรรม" onchange="App.cycTaskFilter('status',this.value)">${[['','ทุกสถานะ'],['done','เสร็จแล้ว'],['planned','ยังไม่เสร็จ'],['failed','ไม่สำเร็จ']].map(([key,label])=>`<option value="${key}" ${f.status===key?'selected':''}>${label}</option>`).join('')}</select><select aria-label="เรียงกิจกรรม" onchange="App.cycTaskFilter('sort',this.value)">${[['new','ใหม่ → เก่า'],['old','เก่า → ใหม่'],['cost','ต้นทุนสูง → ต่ำ']].map(([key,label])=>`<option value="${key}" ${f.sort===key?'selected':''}>${label}</option>`).join('')}</select></div>${tasks.map(t=>taskRowHtml(t,{showDate:true,showNote:true,showDelete:true})).join('') || '<p class="nb-empty">ไม่มีงานตรงกับตัวกรอง</p>'}</section>`;
}
function notebookYield(c,model) {
  const tasks=model.done.filter(t=>t.type==='harvest');
  return `<section class="nb-card"><div class="nb-history-heading"><h2>ผลผลิตของรอบนี้</h2>${c.status==='active'?`<button class="btn btn-outline" onclick="${notebookAction('cycleNotebookAdd',c.id,'harvest')}">บันทึกเก็บเกี่ยว</button>`:''}</div>${tasks.length?tasks.map(t=>taskRowHtml(t,{showDate:true,showNote:true})).join(''):'<p class="nb-empty">ยังไม่มีบันทึกเก็บเกี่ยวในรอบปลูกนี้</p>'}<div class="nb-total"><span>รายรับจากผลผลิต</span><strong>${fmtMoney(model.finance.revenue)} บาท</strong></div></section>`;
}
function notebookOverview(c,model) {
  return `<div class="nb-columns"><div><section class="nb-card">${cycleJourneyHtml(c,model.tasks)}<div class="nb-overview-actions"><button class="btn btn-outline" onclick="App.cycleDetailTab('tasks')">ดูประวัติงาน</button><button class="btn btn-outline" onclick="App.cycleDetailTab('calendar')">${notebookIcon('CalendarDays')} ปฏิทินงาน</button></div></section>${notebookYield(c,model)}<details class="nb-card nb-settings"><summary>จัดการรอบปลูก</summary><div class="nb-overview-actions"><button class="btn btn-outline" onclick="${notebookAction('modalCycle',c.plotId,c.id)}">แก้ไขรอบ</button><button class="btn btn-outline" onclick="${notebookAction('openShareLink',c.plotId,c.id)}">QR Passport</button><button class="btn btn-outline" onclick="${notebookAction(c.status==='active'?'completeCycle':'reopenCycle',c.id)}">${c.status==='active'?'ปิดรอบการปลูก':'เปิดรอบการปลูกอีกครั้ง'}</button><button class="btn btn-danger-soft" onclick="${notebookAction('deleteCycle',c.id)}">ลบรอบปลูก</button></div></details></div><aside class="nb-sidebar">${notebookCostCard(model)}${notebookProjectCard(model.projects)}${notebookReportCard(c)}</aside></div>`;
}
function notebookCostDetails(model) {
  const breakdown=costBreakdown({...S,tasks:model.done});
  return `<div class="nb-columns"><section class="nb-card"><h2>ต้นทุนแยกตามหมวด</h2>${breakdown.length?breakdown.map(row=>`<div class="nb-total"><span>${esc(row.label)}</span><strong>${fmtMoney(row.value)} บาท</strong></div>`).join(''):'<p class="nb-empty">ยังไม่มีต้นทุนที่บันทึกแล้ว</p>'}<div class="nb-total"><strong>รวมทั้งหมด</strong><strong>${fmtMoney(model.finance.cost)} บาท</strong></div><p class="nb-table-note">เฉพาะงานที่เสร็จแล้วในรอบปลูกนี้ · ไม่รวมงานวางแผนและรายการรอตรวจรับ</p></section><aside class="nb-sidebar">${notebookCostCard(model)}${notebookReportCard(cycleById(S,route.cycleId))}</aside></div>`;
}
function notebookReport(c,model) {
  const p=plotById(S,c.plotId);
  return `<div class="pw-page"><div class="pw-report-tools"><div><h2>ร่างเล่มสรุปรอบปลูก</h2><small>จากข้อมูลล่าสุด · ตรวจข้อมูลก่อนส่งออก</small></div><button class="btn btn-outline" onclick="App.cycleDetailTab('materials')">กลับสมุดรอบปลูก</button><button class="btn btn-primary" onclick="App.projectPrint()">${notebookIcon('Printer')} พิมพ์ / บันทึก PDF</button></div><article class="pw-report-document"><span>สมุดประจำรอบปลูก</span><h1>${esc(p?.name || 'แปลง')} · รอบปลูก ${esc(c.round || '—')}</h1><p>${esc(c.plant)} · เริ่ม ${esc(dateLabel(c.startDate))} · พื้นที่ ${fmtNum(model.area)} ไร่</p><h2>ข้อมูลรอบปลูก</h2><p>${esc(c.note || 'ยังไม่มีบันทึกเพิ่มเติม')}</p><h2>ต้นทุนและผลผลิต</h2><p>ต้นทุน ${fmtMoney(model.finance.cost)} บาท · รายรับ ${fmtMoney(model.finance.revenue)} บาท</p>${model.done.filter(t=>t.type==='harvest').map(t=>`<p>${esc(t.title)} · ${fmtNum(Number(t.harvestQty)||0)} ${esc(t.harvestUnit || 'กก.')} · ${esc(dateLabel(taskRecordDate(t)))}</p>`).join('')}<h2>ประวัติการดำเนินงาน</h2>${model.tasks.slice().reverse().map(t=>`<section><h3>${esc(t.title)}</h3><small>${esc(dateLabel(taskRecordDate(t)))} · ${t.status==='done'?'เสร็จแล้ว':t.status==='failed'?'ไม่สำเร็จ':'ยังไม่เสร็จ'}</small><p>${esc(t.doneNote || t.note || '')}</p><p>ต้นทุนที่บันทึก ${fmtMoney(t.status==='done'?Number(t.cost)||0:0)} บาท</p>${(t.costItems || []).map(ci=>`<p>${esc(ci.name)} · ${notebookQuantity(ci)} · ${fmtMoney(Number(ci.totalCost)||0)} บาท${t.status!=='done'?' (ตามแผน ยังไม่รวมต้นทุนจริง)':''}</p>`).join('')}${trialPhotosHtml(notebookPhotos(t))}</section>`).join('')}<h2>โครงการที่เกี่ยวข้อง</h2>${model.projects.map(p=>`<section><h3>${esc(projectCode(p))} · ${esc(p.name)}</h3><p>วัตถุประสงค์: ${esc(p.objective || p.description || 'ยังไม่ระบุ')}</p><p>สรุปผล: ${esc(p.conclusion || 'ยังไม่มีข้อสรุป')}</p></section>`).join('') || '<p>ยังไม่มีโครงการที่เชื่อม</p>'}</article></div>`;
}
function renderCycleNotebook(c) {
  const p=plotById(S,c.plotId),model=notebookModel(c),tab=cycleDetailTab;
  if(tab==='calendar' && (!Number.isInteger(cycleCal.y) || cycleCal.y<1)) {
    const start=new Date((c.startDate || todayISO())+'T00:00:00');
    cycleCal={y:start.getFullYear(),m:start.getMonth(),sel:null};
  }
  const tabs=[['overview','ภาพรวม'],['tasks','ประวัติงาน'],['materials','ยาและปุ๋ย'],['costs','ต้นทุน'],['yield','ผลผลิต'],['projects','โครงการที่เกี่ยวข้อง']];
  const content=tab==='report'?notebookReport(c,model):tab==='materials'?notebookMaterials(c,model):tab==='tasks'?notebookActivityList(c,model):tab==='costs'?notebookCostDetails(model):tab==='yield'?notebookYield(c,model):tab==='projects'?notebookProjectCard(model.projects,true):tab==='calendar'?`<section class="nb-card"><h2>ปฏิทินงาน</h2>${cycleCalCardHtml(c)}</section>`:notebookOverview(c,model);
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
