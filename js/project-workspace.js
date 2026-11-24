/* A project references existing activities and trials; it never posts a second cost ledger. */
"use strict";
let projectWorkspaceTab = 'work';
let projectSelectedTask = '';
let projectDraft = null;
let projectDraftOwner = '';
let projectHubTab = 'projects';

function projectCode(p) { return p.code || `PRJ-${new Date(p.createdAt || Date.now()).getFullYear()+543}-${String(p.id).slice(-6).toUpperCase()}`; }
function projectLinkedTrials(p) { return (S.trials || []).filter(tr => (p.trialIds || []).includes(tr.id)); }
function projectCosts(p) { const ids = new Set(projectTaskList(p).map(t => t.id)); return taskFinance(S,t => ids.has(t.id)); }
function projectDraftKey() { return 'farmult-project-draft-v1'+(typeof AUTH_NAMESPACE==='string'?AUTH_NAMESPACE:'')+'::'+String(typeof Auth !== 'undefined' ? Auth.session?.email || 'local' : 'local').toLowerCase(); }
function projectStoreDraft() {
  if(projectDraftOwner && projectDraftOwner!==projectDraftKey())return false;
  projectDraftOwner=projectDraftKey();
  try { localStorage.setItem(projectDraftKey(),JSON.stringify(projectDraft)); return true; }
  catch (_) { toast('เก็บร่างไม่ได้ พื้นที่ในเครื่องอาจเต็ม'); return false; }
}
function projectPersist() {
  saveState(S);
  if (typeof storageSaveFailed !== 'undefined' && storageSaveFailed) { toast('ยังเก็บข้อมูลในเครื่องไม่สำเร็จ กรุณาสำรองข้อมูลก่อนปิดหน้า'); return false; }
  return true;
}
// Keep failed writes retryable without duplicating projects, activities or report versions.
function projectTransaction(change) {
  const before=JSON.parse(JSON.stringify({projects:S.projects,tasks:S.tasks,projectSequences:S.projectSequences || {}}));
  try {
    const value=change();
    if(projectPersist())return {ok:true,value};
  } catch(error) { Object.assign(S,before); throw error; }
  Object.assign(S,before);
  return {ok:false};
}
function projectValidDraft(d) {
  return d?.version===1 && typeof d.name==='string' && typeof d.objective==='string' && typeof d.brief==='string' && Array.isArray(d.stages) && d.stages.length>0 &&
    d.stages.every(s=>typeof s.id==='string' && typeof s.name==='string' && Array.isArray(s.tasks) && s.tasks.every(t=>typeof t.title==='string' && typeof t.date==='string'));
}
function projectSuggest(brief, date) {
  const experiment = /ทดลอง|ทดสอบ|เปรียบเทียบ|ปุ๋ย|ผลิตภัณฑ์/.test(brief);
  const drone = /โดรน|สำรวจ|แผนที่/.test(brief);
  const software = /แอป|เว็บ|โปรแกรม|ระบบ/.test(brief);
  const stages = experiment ? [
    ['เตรียมการทดลอง',['ยืนยันวัตถุประสงค์และแผนทดลอง','กำหนดชุดทดลอง ตัวอย่าง และค่าวัด','บันทึกค่าก่อนเริ่ม']],
    ['ดำเนินการและติดตาม',['ดำเนินงานตามแผนและบันทึกวัสดุ','เก็บค่าวัดและรูปภาพติดตามผล']],
    ['สรุปผล',['ตรวจความครบถ้วนของข้อมูล','สรุปผลและจัดทำรายงาน']]
  ] : drone ? [
    ['เตรียมงาน',['ยืนยันขอบเขตและสิ่งส่งมอบ','เตรียมแผนสำรวจ']],
    ['สำรวจและจัดทำ',['บันทึกการสำรวจภาคสนาม','จัดทำและตรวจแผนที่']],
    ['ส่งมอบ',['ตรวจความครบถ้วน','จัดทำรายงานและส่งมอบ']]
  ] : software ? [
    ['เตรียมงาน',['ยืนยันความต้องการและเกณฑ์ตรวจรับ','แบ่งงานและกำหนดขอบเขต']],
    ['พัฒนาและทดสอบ',['พัฒนาตามขอบเขตที่ตกลง','ทดสอบและบันทึกผล']],
    ['สรุปและตรวจรับ',['แก้ไขประเด็นที่พบ','สรุปผลและส่งตรวจรับ']]
  ] : [
    ['เตรียมงาน',['ยืนยันเป้าหมายและขอบเขตงาน','เตรียมแผนและวัสดุ']],
    ['ลงมือทำ',['ปฏิบัติงานและบันทึกค่าใช้จ่าย','ติดตามผลและแนบหลักฐาน']],
    ['สรุปผล',['ทบทวนงานที่ทำจริง','สรุปผลและจัดทำรายงาน']]
  ];
  return {version:1,brief,name:brief.split(/[\n。]/)[0].slice(0,100),objective:'',plotId:'',cycleId:'',startDate:date,
    stages:stages.map(([name,titles])=>({id:uid(),name,tasks:titles.map(title=>({id:uid(),title,date,include:true}))}))};
}
function projectCreateFromDraft(draft) {
  if(!projectValidDraft(draft))throw new Error('ร่างงานไม่ครบ กรุณาร่างใหม่อีกครั้ง');
  if (!draft?.name?.trim() || !draft.stages?.length) throw new Error('ใส่ชื่อโครงการและขั้นตอนอย่างน้อยหนึ่งขั้น');
  const selected = draft.stages.flatMap(stage => stage.tasks.filter(t=>t.include).map(task=>({stage,task})));
  if (!selected.length) throw new Error('เลือกงานย่อยอย่างน้อยหนึ่งงาน');
  if (selected.some(({stage,task})=>!stage.name.trim() || !task.title.trim() || !trialValidDate(task.date))) throw new Error('ตรวจชื่อขั้นตอน ชื่องาน และวันที่ของทุกงานที่เลือก');
  const plot = draft.plotId ? plotById(S,draft.plotId) : null;
  const cycle = draft.cycleId ? cycleById(S,draft.cycleId) : null;
  if (draft.plotId && !plot || draft.cycleId && (!cycle || cycle.plotId!==draft.plotId)) throw new Error('ตรวจแปลงและรอบปลูกอีกครั้ง');
  const year = Number(todayISO().slice(0,4))+543;
  const prefix = `PRJ-${year}-`;
  let n = Math.max(Number(S.projectSequences?.[year]) || 0,...(S.projects || []).map(p=>p.code?.startsWith(prefix) ? Number(p.code.slice(prefix.length)) || 0 : 0))+1;
  while ((S.projects || []).some(p=>p.code===prefix+String(n).padStart(3,'0'))) n++;
  const p={id:uid(),code:prefix+String(n).padStart(3,'0'),name:draft.name.trim(),objective:draft.objective.trim(),description:draft.brief,
    startDate:draft.startDate,plotId:draft.plotId,cycleId:draft.cycleId,status:'active',createdAt:Date.now(),trialIds:[],reportVersions:[],
    stages:draft.stages.map(({id,name})=>({id,name:name.trim()}))};
  const tasks=selected.map(({stage,task})=>({id:uid(),title:task.title.trim(),date:task.date,type:'work',status:'planned',
    plotId:draft.plotId || null,cycleId:draft.cycleId || null,projectId:p.id,projectStageId:stage.id,
    cost:0,revenue:0,costItems:[],photos:[],note:'',createdAt:Date.now(),source:'project-draft'}));
  S.projectSequences={...(S.projectSequences || {}),[year]:n};
  S.projects.push(p); S.tasks.push(...tasks);
  return p;
}
function renderProjects() {
  if(route.view==='projectDetail') return renderProjectDetail();
  if(route.view==='projectDraft') return renderProjectDraft();
  const all=(S.projects || []).slice().sort((a,b)=>(b.createdAt || 0)-(a.createdAt || 0));
  const shown=all.filter(p=>projectListFilter==='all' || (p.status==='done'?'done':'active')===projectListFilter);
  const tabs=`<div class="pw-tabs"><button class="${projectHubTab==='projects'?'active':''}" onclick="App.projectHub('projects')">โครงการและงาน</button><button class="${projectHubTab==='trials'?'active':''}" onclick="App.projectHub('trials')">การทดลองเดิม <small>${(S.trials || []).length}</small></button></div>`;
  if(projectHubTab==='trials') return `<div class="project-page"><h1>งานและการทดลอง</h1>${tabs}${renderTrialsTab()}</div>`;
  return `<div class="project-page pw-page"><header class="project-list-head"><div><h1>งานและการทดลอง</h1><p>งานย่อย ผลทดลอง และหลักฐาน อยู่ในโครงการเดียวกัน</p></div></header>${tabs}
    <form class="pw-composer card" onsubmit="return App.projectSuggestDraft(event)"><label for="projectBrief"><b>อยากทำอะไรในโครงการนี้?</b></label><textarea id="projectBrief" rows="2" maxlength="1200" required placeholder="เช่น ทดลองปุ๋ย A เทียบวิธีเดิม เก็บความสูงและรูปภาพทุกสัปดาห์"></textarea><div class="pw-between"><small>ระบบช่วยจัดร่างจากแบบงาน ให้คุณแก้ก่อนสร้างโครงการ</small><button class="btn btn-primary" type="submit">${ic('plus')} ช่วยร่างงานย่อย</button></div><button class="btn btn-ghost btn-sm" type="button" onclick="App.projectResumeDraft()">เปิดฉบับร่างที่เก็บไว้</button></form>
    <div class="project-filters" aria-label="กรองโครงการ">${[['active','กำลังทำ'],['done','ปิดแล้ว'],['all','ทั้งหมด']].map(([key,label])=>`<button class="${projectListFilter===key?'active':''}" onclick="App.projectFilter('${key}')">${label}</button>`).join('')}</div>
    <div class="project-grid">${shown.map(p=>{const n=projectCounts(p);return `<article class="card project-card"><button class="project-card-open" onclick="App.projectOpen('${p.id}')"><span class="project-eyebrow">${esc(projectCode(p))} · ${p.status==='done'?'ปิดแล้ว':'กำลังทำ'}</span><h2>${esc(p.name)}</h2><p>${esc(p.objective || p.description || '')}</p><div class="pw-between"><span>${n.done}/${n.total} งานเสร็จ</span><span>${projectLinkedTrials(p).length} การทดลอง</span></div><div class="project-progress-bar"><i style="width:${projectProgress(p)}%"></i></div></button></article>`;}).join('') || '<div class="card project-empty"><h2>เริ่มจากโครงการแรก</h2><p>พิมพ์สิ่งที่จะทำด้านบน แล้วตรวจร่างงานย่อยก่อนสร้าง</p></div>'}</div></div>`;
}
function renderProjectDraft() {
  if(!projectDraft || projectDraftOwner!==projectDraftKey()) {
    projectDraft=null;projectDraftOwner=projectDraftKey();
    try{const stored=JSON.parse(localStorage.getItem(projectDraftKey()));if(projectValidDraft(stored))projectDraft=stored;}catch(_){}
  }
  const d=projectDraft; if(!d) return '<div class="project-page"><button class="btn" onclick="App.projectBack()">กลับไปโครงการ</button></div>';
  const field=(name,value)=>`oninput="App.projectDraftField('${name}',this.value)" value="${esc(value || '')}"`;
  return `<div class="project-page pw-page"><header><span class="project-eyebrow">ยังไม่สร้างกิจกรรมหรือตัดสต็อก</span><h1>ร่างงานย่อยก่อนสร้างโครงการ</h1><p>${esc(d.brief)}</p></header><div class="pw-draft-layout"><div><section class="card pw-section"><div class="field"><label for="pdName">ชื่อโครงการ</label><input id="pdName" maxlength="100" ${field('name',d.name)}></div><div class="field"><label for="pdObjective">วัตถุประสงค์</label><textarea id="pdObjective" oninput="App.projectDraftField('objective',this.value)">${esc(d.objective)}</textarea></div></section>
    ${d.stages.map((stage,i)=>`<section class="card pw-section"><div class="pw-stage-name"><span class="project-stage-number">${i+1}</span><input aria-label="ชื่อขั้นตอน ${i+1}" value="${esc(stage.name)}" oninput="App.projectDraftStage(${i},this.value)"></div>${stage.tasks.map((t,j)=>`<div class="pw-draft-task"><input type="checkbox" aria-label="รวมงาน ${esc(t.title)}" ${t.include?'checked':''} onchange="App.projectDraftTask(${i},${j},'include',this.checked)"><input aria-label="ชื่องานย่อย" maxlength="150" value="${esc(t.title)}" oninput="App.projectDraftTask(${i},${j},'title',this.value)"><input type="date" aria-label="กำหนดงาน ${esc(t.title)}" value="${esc(t.date)}" onchange="App.projectDraftTask(${i},${j},'date',this.value)"></div>`).join('')}<button class="btn btn-ghost btn-sm" onclick="App.projectDraftAdd(${i})">${ic('plus')} เพิ่มงานย่อย</button></section>`).join('')}</div>
    <aside class="card pw-section pw-draft-context"><h2>ผูกกับรอบปลูก</h2><p>ไม่บังคับ สำหรับงานที่เกี่ยวกับแปลง</p><div class="field"><label for="pdPlot">แปลง</label><select id="pdPlot" onchange="App.projectDraftPlot(this.value)"><option value="">ไม่ผูกแปลง</option>${S.plots.map(p=>`<option value="${p.id}" ${d.plotId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label for="pdCycle">รอบปลูก</label><select id="pdCycle" onchange="App.projectDraftField('cycleId',this.value)"><option value="">ไม่ผูกรอบปลูก</option>${S.cycles.filter(c=>c.plotId===d.plotId).map(c=>`<option value="${c.id}" ${d.cycleId===c.id?'selected':''}>${esc(c.plant)} · รอบ ${c.round || ''}</option>`).join('')}</select></div><p class="hint">ตรวจวันของแต่ละงานก่อนสร้าง แผนนี้ยังแก้ไขเพิ่มเติมได้</p></aside></div>
    <footer class="pw-footer"><span id="projectDraftStatus" role="status">ฉบับร่าง · ยังไม่สร้างโครงการ</span><button class="btn btn-outline" onclick="App.projectSaveDraftClose()">เก็บร่างและปิด</button><button class="btn btn-primary" onclick="App.projectConfirmDraft()">สร้างโครงการ</button></footer></div>`;
}
function projectWorkHtml(p) {
  const tasks=projectTaskList(p), selected=tasks.find(t=>t.id===projectSelectedTask) || tasks[0];
  const trials=projectLinkedTrials(p);
  return `<div class="pw-work-layout"><aside class="pw-task-tree"><h2>ขั้นตอนและงานย่อย</h2>${p.stages.map((stage,i)=>`<section><h3><span class="project-stage-number">${i+1}</span>${esc(stage.name)}</h3>${tasks.filter(t=>t.projectStageId===stage.id).map(t=>`<button class="pw-task ${selected?.id===t.id?'active':''}" onclick="App.projectSelectTask('${t.id}')">${ic(t.status==='done'?'check':'calendar')}<span>${esc(t.title)}<small>${esc(dateLabel(t.date))} · ${t.status==='done'?'เสร็จแล้ว':t.status==='failed'?'ทำไม่ได้':'รอทำ'}</small></span></button>`).join('')}<div class="pw-stage-links"><button class="btn btn-ghost btn-sm" onclick="App.projectNewTask('${p.id}','${stage.id}')">เพิ่มงาน</button><button class="btn btn-ghost btn-sm" onclick="App.projectLinkModal('${p.id}','${stage.id}')">เชื่อมงานเดิม</button></div></section>`).join('')}</aside>
    <section class="pw-record-pane">${selected?`<div class="pw-between"><div><span class="project-eyebrow">งานที่เลือก</span><h2>${esc(selected.title)}</h2></div><button class="btn btn-outline" onclick="App.viewTask('${selected.id}')">บันทึกงาน / ต้นทุน</button></div><p>${esc(selected.note || 'เลือกบันทึกงานที่ทำจริง หรือเก็บค่าวัดพร้อมรูปภาพ')}</p>`:'<h2>เลือกหรือเพิ่มงานย่อยเพื่อเริ่มบันทึก</h2>'}
    <div class="pw-between"><h3>การทดลองที่เชื่อมอยู่</h3><button class="btn btn-ghost" onclick="App.projectTrialLinkModal('${p.id}')">${ic('link')} เชื่อมการทดลอง</button></div>
    ${trials.map(tr=>`<article class="card pw-section"><div class="pw-between"><div><h3>${esc(tr.name)}</h3><small>${tr.units.length} แปลงย่อย · ${tr.observations.length} ค่าวัด</small></div><button class="btn btn-primary" ${!selected || p.status==='done'?'disabled':''} onclick="App.projectRecord('${p.id}','${selected?.id || ''}','${tr.id}')">${ic('pencil')} บันทึกผล</button></div><button class="btn btn-ghost btn-sm" onclick="App.projectOpenTrial('${tr.id}')">ดูผลและแผนทดลอง</button></article>`).join('') || `<div class="pw-empty"><h3>ยังไม่ได้เชื่อมการทดลอง</h3><p>ใช้การทดลองที่มีอยู่ หรือสร้างแผนทดลองแล้วกลับมาเชื่อมได้</p><button class="btn btn-outline" onclick="App.projectTrialLinkModal('${p.id}')">เลือกการทดลอง</button><button class="btn btn-ghost" onclick="App.projectCreateTrial('${p.id}')">สร้างการทดลอง</button></div>`}
    <h3>ผลบันทึกของงานนี้</h3>${selected?projectObservationList(p,selected.id):''}</section></div>`;
}
function projectObservationList(p,taskId) {
  const rows=projectLinkedTrials(p).flatMap(tr=>tr.observations.filter(o=>o.projectTaskId===taskId).map(o=>({tr,o}))).sort((a,b)=>String(b.o.date).localeCompare(String(a.o.date)));
  return rows.length?rows.map(({tr,o})=>`<article class="card pw-observation"><div class="pw-between"><b>${esc(o.metric)}: ${fmtNum(o.value)} ${esc(o.unit)}</b><button class="btn btn-ghost btn-sm" onclick="App.projectRecord('${p.id}','${taskId}','${tr.id}','${o.id}')">แก้ไข</button></div><small>${esc(dateLabel(o.date))} · ${esc(trialUnitDescription(tr,trialUnit(tr,o.unitId)))}</small><p>${esc(o.note)}</p>${trialPhotosHtml(o.photos)}${o.photoCaption?`<small>${esc(o.photoCaption)}</small>`:''}${o.revisions?.length?`<details><summary>ประวัติการแก้ไข ${o.revisions.length} ครั้ง</summary>${o.revisions.map(v=>`<p>${esc(v.date)} · ${esc(v.metric)} ${fmtNum(v.value)} ${esc(v.unit)} · ${esc(v.note)}</p>`).join('')}</details>`:''}</article>`).join(''):'<p class="pw-empty">ยังไม่มีค่าวัดที่ผูกกับงานนี้ ผลเดิมยังอยู่ในหน้าการทดลอง</p>';
}
function renderProjectDetail() {
  const p=projectById(route.projectId); if(!p) return '<div class="project-page"><h1>ไม่พบโครงการ</h1><button class="btn" onclick="App.projectBack()">กลับโครงการ</button></div>';
  const n=projectCounts(p), costs=projectCosts(p);
  return `<div class="project-page pw-page"><button class="btn btn-ghost" onclick="App.projectBack()">${ic('chevron')} โครงการทั้งหมด</button><header class="pw-project-head"><span class="project-eyebrow">${esc(projectCode(p))} · ${p.status==='done'?'ปิดโครงการแล้ว':'กำลังดำเนินการ'}</span><div class="pw-between"><h1>${esc(p.name)}</h1><button class="btn btn-outline" onclick="App.projectToggleStatus('${p.id}')">${p.status==='done'?'เปิดโครงการอีกครั้ง':'ปิดโครงการ'}</button></div><p>วัตถุประสงค์: ${esc(p.objective || p.description || 'ยังไม่ระบุ')}</p><div class="pw-facts"><span>${n.done}/${n.total} งานเสร็จ</span><span>ต้นทุนจากงานที่ทำแล้ว ${fmtMoney(costs.cost)} บาท</span></div></header>
    <nav class="pw-tabs">${[['work','งานและผลทดลอง'],['info','ข้อมูลโครงการ'],['report','เล่มสรุปโครงการ']].map(([key,label])=>`<button class="${projectWorkspaceTab===key?'active':''}" onclick="App.projectTab('${key}')">${label}</button>`).join('')}</nav>
    ${projectWorkspaceTab==='report'?projectReportHtml(p):projectWorkspaceTab==='info'?projectInfoHtml(p):projectWorkHtml(p)}</div>`;
}
function projectInfoHtml(p) {
  return `<form class="card pw-section" onsubmit="return App.projectSaveInfo(event,'${p.id}')"><div class="field"><label for="piName">ชื่อโครงการ</label><input id="piName" name="name" maxlength="100" required value="${esc(p.name)}"></div><div class="field"><label for="piObjective">วัตถุประสงค์</label><textarea id="piObjective" name="objective" maxlength="2000">${esc(p.objective || '')}</textarea></div><div class="field"><label for="piConclusion">สรุปผลและข้อเสนอแนะ</label><textarea id="piConclusion" name="conclusion" maxlength="6000" rows="5" placeholder="สรุปจากข้อมูลจริง ผลไม่เป็นไปตามคาดสามารถบันทึกได้">${esc(p.conclusion || '')}</textarea></div><button class="btn btn-primary" type="submit">บันทึกข้อมูลโครงการ</button></form>`;
}
function projectReportSnapshot(p) {
  const tasks=projectTaskList(p), costs=projectCosts(p);
  return {id:uid(),createdAt:Date.now(),code:projectCode(p),name:p.name,objective:p.objective || p.description || '',conclusion:p.conclusion || '',cost:costs.cost,
    tasks:tasks.map(t=>({id:t.id,title:t.title,date:taskRecordDate(t),status:t.status,cost:t.status==='done'?Number(t.cost)||0:0,note:t.note || '',photos:JSON.parse(JSON.stringify(t.photos || []))})),
    results:projectLinkedTrials(p).flatMap(tr=>tr.observations.filter(o=>o.includeInReport!==false && (!o.projectTaskId || tasks.some(t=>t.id===o.projectTaskId))).map(o=>({trial:tr.name,unitLabel:trialUnitDescription(tr,trialUnit(tr,o.unitId)),...JSON.parse(JSON.stringify(o)),revisions:undefined}))) };
}
function projectReportBody(snap) {
  return `<article class="pw-report-document"><div class="project-eyebrow">รายงานสรุปโครงการ · ${esc(snap.code)}</div><h1>${esc(snap.name)}</h1><p>ข้อมูล ณ ${new Date(snap.createdAt).toLocaleString('th-TH')}</p><h2>วัตถุประสงค์</h2><p>${esc(snap.objective || 'ยังไม่ระบุ')}</p><h2>การดำเนินงาน</h2>${snap.tasks.map(t=>`<section><h3>${esc(t.title)}</h3><small>${esc(t.date)} · ${t.status==='done'?'เสร็จแล้ว':t.status==='failed'?'ทำไม่ได้':'ยังไม่เสร็จ'}</small><p>${esc(t.note)}</p>${trialPhotosHtml(t.photos)}</section>`).join('')}<h2>ผลทดลองและข้อมูลดิบ</h2>${snap.results.length?`<div class="pw-table-scroll"><table><thead><tr><th>วันที่ / การทดลอง</th><th>ตัวอย่าง</th><th>ค่าวัด</th><th>ผล</th></tr></thead><tbody>${snap.results.map(o=>`<tr><td>${esc(o.date)}<small>${esc(o.trial)}</small></td><td>${esc(o.unitLabel)}</td><td>${esc(o.metric)}</td><td>${fmtNum(o.value)} ${esc(o.unit)}</td></tr>`).join('')}</tbody></table></div>${snap.results.filter(o=>o.photos?.length).map(o=>`<section>${trialPhotosHtml(o.photos)}<p>${esc(o.photoCaption || o.note || o.metric)}</p></section>`).join('')}`:'<p>ยังไม่มีผลทดลองที่เชื่อมกับโครงการ</p>'}<h2>ต้นทุน</h2><p>ต้นทุนจากกิจกรรมที่ทำแล้ว ${fmtMoney(snap.cost)} บาท</p><h2>สรุปผลและข้อเสนอแนะ</h2><p>${esc(snap.conclusion || 'ยังไม่ได้เขียนข้อสรุป')}</p></article>`;
}
let projectReportVersion = '';
function projectReportHtml(p) {
  const versions=p.reportVersions || [], snapshot=versions.find(v=>v.id===projectReportVersion) || projectReportSnapshot(p);
  return `<div class="pw-report-tools"><div><h2>เล่มสรุปโครงการ</h2><small>${projectReportVersion?'ฉบับที่เก็บไว้':'ร่างจากข้อมูลล่าสุด'} · ตรวจข้อมูลก่อนส่งออก</small></div><select aria-label="รุ่นรายงาน" onchange="App.projectReportVersion(this.value)"><option value="">ข้อมูลล่าสุด</option>${versions.map((v,i)=>`<option value="${v.id}" ${v.id===projectReportVersion?'selected':''}>ฉบับ ${i+1} · ${new Date(v.createdAt).toLocaleDateString('th-TH')}</option>`).join('')}</select><button class="btn btn-outline" onclick="App.projectSaveReport('${p.id}')">เก็บฉบับนี้</button><button class="btn btn-primary" onclick="App.projectPrint()">${ic('download')} พิมพ์ / บันทึก PDF</button></div>${!snapshot.conclusion?'<p class="pw-notice">ยังไม่มีข้อสรุป เติมได้ในแท็บข้อมูลโครงการ</p>':''}${projectReportBody(snapshot)}`;
}
App.projectHub=function(tab){projectHubTab=tab;delete route.trialId;render();};
App.projectSuggestDraft=function(e){e.preventDefault();const brief=document.getElementById('projectBrief').value.trim();if(!brief)return false;projectDraft=projectSuggest(brief,todayISO());projectDraftOwner=projectDraftKey();projectStoreDraft();route.view='projectDraft';render();return false;};
App.projectCreateModal=function(){projectHubTab='projects';route.view='projects';render();document.getElementById('projectBrief')?.focus();};
App.projectResumeDraft=function(){try{const d=JSON.parse(localStorage.getItem(projectDraftKey()));if(projectValidDraft(d)){projectDraft=d;projectDraftOwner=projectDraftKey();route.view='projectDraft';render();return;}}catch(_){}toast('ยังไม่มีฉบับร่างที่เปิดได้');};
App.projectDraftField=function(key,value){if(!['name','objective','cycleId'].includes(key))return;projectDraft[key]=value;const ok=projectStoreDraft();const el=document.getElementById('projectDraftStatus');if(el)el.textContent=ok?'เก็บร่างในเครื่องแล้ว':'เก็บร่างไม่สำเร็จ';};
App.projectDraftStage=function(i,value){projectDraft.stages[i].name=value;projectStoreDraft();};
App.projectDraftTask=function(i,j,key,value){if(!['title','date','include'].includes(key))return;projectDraft.stages[i].tasks[j][key]=value;projectStoreDraft();};
App.projectDraftAdd=function(i){projectDraft.stages[i].tasks.push({id:uid(),title:'',date:todayISO(),include:true});projectStoreDraft();render();};
App.projectDraftPlot=function(id){projectDraft.plotId=id;projectDraft.cycleId='';projectStoreDraft();render();};
App.projectSaveDraftClose=function(){if(projectStoreDraft())App.projectBack();};
App.projectConfirmDraft=function(){try{if(projectDraftOwner!==projectDraftKey())throw new Error('บัญชีเปลี่ยนแล้ว กรุณาเปิดฉบับร่างของบัญชีนี้');const result=projectTransaction(()=>projectCreateFromDraft(projectDraft));if(!result.ok)return;try{localStorage.removeItem(projectDraftKey());}catch(_){}projectDraft=null;projectWorkspaceTab='work';App.projectOpen(result.value.id);toast('สร้างโครงการและงานย่อยแล้ว');}catch(e){toast(e.message);}};
App.projectTab=function(tab){projectWorkspaceTab=tab;projectReportVersion='';render();};
App.projectSelectTask=function(id){projectSelectedTask=id;render();};
App.projectSaveInfo=function(e,id){e.preventDefault();const p=projectById(id);if(!p)return false;const f=e.target.elements;if(!f.name.value.trim())return false;const result=projectTransaction(()=>{p.name=f.name.value.trim();p.objective=f.objective.value.trim();p.conclusion=f.conclusion.value.trim();p.updatedAt=Date.now();});if(result.ok)toast('บันทึกข้อมูลโครงการแล้ว');return false;};
App.projectReportVersion=function(id){projectReportVersion=id;render();};
App.projectSaveReport=function(id){const p=projectById(id);if(!p)return;const result=projectTransaction(()=>{p.reportVersions=p.reportVersions || [];const selected=p.reportVersions.find(v=>v.id===projectReportVersion);const snapshot=selected?{...JSON.parse(JSON.stringify(selected)),id:uid(),createdAt:Date.now()}:projectReportSnapshot(p);p.reportVersions.push(snapshot);return snapshot.id;});if(result.ok){projectReportVersion=result.value;render();toast('เก็บฉบับรายงานแล้ว');}};
App.projectPrint=function(){document.body.classList.add('pw-print');window.print();document.body.classList.remove('pw-print');};
App.projectOpenTrial=function(id){route.view='plots';route.tab='trials';route.trialId=id;route.trialSection='record';render();};
App.projectTrialLinkModal=function(id){const p=projectById(id);if(!p)return;openModal(`<button class="modal-x" onclick="App.closeModal()">${ic('x')}</button><h3>เชื่อมการทดลองเดิม</h3><p>ข้อมูลดิบและรูปภาพยังอยู่ในรายการเดิม</p><div class="project-task-choices">${(S.trials || []).map(tr=>`<button ${p.trialIds?.includes(tr.id)?'disabled':''} onclick="App.projectAttachTrial('${id}','${tr.id}')"><b>${esc(tr.name)}</b><small>${p.trialIds?.includes(tr.id)?'เชื่อมแล้ว':tr.observations.length+' ค่าวัด'}</small></button>`).join('') || '<p>ยังไม่มีการทดลอง</p>'}</div><button class="btn btn-primary" onclick="App.projectCreateTrial('${id}')">สร้างการทดลอง</button>`);};
App.projectAttachTrial=function(id,trialId){const p=projectById(id);if(!p || p.status==='done' || !trialById(S,trialId))return;const result=projectTransaction(()=>{p.trialIds=[...new Set([...(p.trialIds || []),trialId])];});if(result.ok){closeModal();render();}};
App.projectCreateTrial=function(id){const p=projectById(id);if(!p || p.status==='done')return;closeModal();App.modalTrial(p.plotId || '');const form=document.querySelector('.trial-setup-form');if(form){form.dataset.projectId=id;const input=form.querySelector('#tr_name');if(input)input.value=p.name;}};
App.projectRecord=function(projectId,taskId,trialId,obsId){const p=projectById(projectId),tr=trialById(S,trialId);if(!p || p.status==='done' || !projectTaskList(p).some(t=>t.id===taskId) || !projectLinkedTrials(p).includes(tr))return;projectSelectedTask=taskId;App.modalTrialObs(trialId,'',obsId);const select=document.getElementById('tro_project_task');if(select)select.value=taskId;};
function projectObservationContextHtml(tr,obs) {
  const p=(S.projects || []).find(p=>p.id===route.projectId && p.trialIds?.includes(tr.id)) || (S.projects || []).find(p=>p.trialIds?.includes(tr.id) && projectTaskList(p).some(t=>t.id===obs?.projectTaskId));
  if(!p)return '';
  return `<input type="hidden" id="tro_project_id" value="${p.id}"><div class="field"><label for="tro_project_task">งานย่อยใน ${esc(projectCode(p))}</label><select id="tro_project_task" required><option value="">เลือกงานย่อย</option>${projectTaskList(p).map(t=>`<option value="${t.id}" ${t.id===(obs?.projectTaskId || projectSelectedTask)?'selected':''}>${esc(t.title)}</option>`).join('')}</select></div><div class="field"><label for="tro_caption">คำอธิบายรูป</label><input id="tro_caption" maxlength="400" value="${esc(obs?.photoCaption || '')}"></div><label class="trial-check"><input id="tro_in_report" type="checkbox" ${obs?.includeInReport!==false?'checked':''}> ใช้ผลและรูปนี้ในเล่มสรุป</label>`;
}
function projectObservationFields(tr,old) {
  const projectId=document.getElementById('tro_project_id')?.value;
  if(!projectId)return old ? {projectTaskId:old.projectTaskId,photoCaption:old.photoCaption,includeInReport:old.includeInReport} : {};
  const p=projectById(projectId),taskId=document.getElementById('tro_project_task')?.value;
  if(!p || p.status==='done' || !projectLinkedTrials(p).includes(tr) || !projectTaskList(p).some(t=>t.id===taskId))throw new Error('เลือกงานย่อยของโครงการที่เชื่อมกับการทดลองนี้');
  return {projectTaskId:taskId,photoCaption:document.getElementById('tro_caption')?.value.trim() || '',includeInReport:document.getElementById('tro_in_report')?.checked!==false};
}
