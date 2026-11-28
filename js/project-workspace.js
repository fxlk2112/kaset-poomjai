/* A project references existing activities and trials; it never posts a second cost ledger. */
"use strict";
let projectWorkspaceTab = 'work';
let projectSelectedTask = '';
let projectDraft = null;
let projectDraftOwner = '';
let projectHubTab = 'projects';
function pwIcon(name){const key=name==='chevron'?'ChevronRight':name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('');return typeof lucide!=='undefined'?lucide.createElement(lucide.icons[key] || lucide.icons.Info,{class:'ic','stroke-width':1.8,'aria-hidden':'true'}).outerHTML:ic(name);}
function projectOffsetDate(date,days) { const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function projectCode(p) { return p.code || `PRJ-${new Date(p.createdAt || Date.now()).getFullYear()+543}-${String(p.id).slice(-6).toUpperCase()}`; }
function projectLinkedTrials(p) { return (S.trials || []).filter(tr => (p.trialIds || []).includes(tr.id)); }
function projectHasExperiment(p) { return p.kind==='experiment' || projectLinkedTrials(p).length>0; }
function projectTaskRecordKind(task,p) {
  if(['work','measurement'].includes(task?.recordKind))return task.recordKind;
  const title=(task?.title || '').trim();
  // Legacy template tasks are classified without rewriting their data or observations.
  if(/^(ยืนยัน|กำหนด|ตรวจความครบถ้วน|สรุปผล|รวมข้อมูล)/.test(title))return 'work';
  if(/^(บันทึกค่าก่อนเริ่ม|เก็บค่าวัด|เก็บข้อมูลสัปดาห์ที่|วัด(?:ความสูง|จำนวนใบ|น้ำหนัก|ความหวาน))/.test(title))return 'measurement';
  const recorded=p && (projectLinkedTrials(p).some(tr=>(tr.observations || []).some(o=>o.projectTaskId===task?.id)) || (p.records || []).some(r=>r.taskId===task?.id && (r.rows || []).some(row=>Object.values(row.values || {}).some(v=>v!=='' && v!=null))));
  return recorded?'measurement':'work';
}
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
  const before=JSON.parse(JSON.stringify({projects:S.projects,tasks:S.tasks,trials:S.trials,projectSequences:S.projectSequences || {},notifDismissed:S.notifDismissed || {}}));
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
function projectSuggest(brief, date, mode) {
  const intent=brief.replace(/(?:ไม่มี|ไม่ทำ|ไม่ใช่|ไม่ต้อง(?:ทำ)?|ไม่)\s*(?:การ)?ทดลอง/g,'');
  const experiment = mode==='experiment' || (mode!=='work' && /ทดลอง|เปรียบเทียบ|ทดสอบ(?:ปุ๋ย|ยา|ผลิตภัณฑ์)/.test(intent));
  const drone = /โดรน|สำรวจ|แผนที่/.test(brief);
  const software = /แอป|เว็บ|โปรแกรม|ระบบ/.test(brief);
  let stages = experiment ? [
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
  ] : [['งานในโครงการ',[]]];
  if(!experiment && !drone && !software){
    const actions=['เตรียมแปลง','ไถพรวน','ตัดหญ้า','กำจัดวัชพืช','ปลูก','ใส่ปุ๋ย','ฉีดพ่น','ให้น้ำ','ตัดแต่งกิ่ง','เก็บเกี่ยว'].filter(word=>brief.includes(word)).filter(word=>word!=='ปลูก' || !/รอบปลูก/.test(brief)).sort((a,b)=>brief.indexOf(a)-brief.indexOf(b));
    stages[0][1]=actions.length?actions:[brief.trim().slice(0,150)];
  }
  const normalized=brief.replace(/[๐-๙]/g,c=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
  const weeks=Math.min(52,Number(normalized.match(/(\d+)\s*สัปดาห์/)?.[1]) || 0);
  if(experiment && weeks) stages=[['เตรียมการทดลอง',['กำหนดกลุ่มทดลองและรหัสต้น','บันทึกค่าก่อนเริ่ม']],['ติดตามผล',Array.from({length:weeks},(_,i)=>'เก็บข้อมูลสัปดาห์ที่ '+(i+1))],['สรุปผล',['รวมข้อมูลและสรุปข้อสังเกต']]];
  const schema=[];
  if(experiment)for(const [pattern,name,unit,kind] of [[/ความสูง|สูง/, 'ความสูง','ซม.','number'],[/จำนวนใบ|นับใบ/,'จำนวนใบ','ใบ','count'],[/น้ำหนัก|ผลผลิต/,'น้ำหนัก','กก.','number'],[/ความหวาน|บริกซ์/,'ความหวาน','°Brix','number']])if(pattern.test(brief))schema.push({id:uid(),name,unit,kind});
  if(experiment && !schema.length)schema.push({id:uid(),name:'ความสูง',unit:'ซม.',kind:'number'});
  const name=brief.split(/[\n。]/)[0].replace(/\s*(?:ติดตาม\s*)?\d+\s*สัปดาห์[\s\S]*/, '').slice(0,100);
  const groupA=brief.match(/(?:ทดลอง|ทดสอบ)\s*(.+?)\s*(?:เทียบ|เปรียบเทียบ)/)?.[1]?.trim() || 'กลุ่มทดลอง';
  return {version:1,brief,name,objective:experiment?'เปรียบเทียบการเจริญเติบโตระหว่างสองวิธี':'',plotId:'',cycleId:'',startDate:date || '',kind:experiment?'experiment':drone?'survey':software?'software':'work',schema,groups:experiment?[groupA,'วิธีเดิม']:[],sampleCount:'',assignee:'',
    stages:stages.map(([name,titles],i)=>({id:uid(),name,tasks:titles.map((title,j)=>{const offset=experiment && weeks?(i===1?(j+1)*7:i===2?weeks*7:0):0;return {id:uid(),title,date:date?projectOffsetDate(date,offset):'',offset,assignee:'',include:true,...(experiment?{recordKind:projectTaskRecordKind({title})}:{})};})}))};
}
function projectCreateFromDraft(draft,{allowEmpty=false}={}) {
  if(typeof projectValidateProposal==='function')projectValidateProposal(draft);
  if(!projectValidDraft(draft))throw new Error('ร่างงานไม่ครบ กรุณาร่างใหม่อีกครั้ง');
  if (!draft?.name?.trim() || !draft.stages?.length) throw new Error('ใส่ชื่อโครงการและขั้นตอนอย่างน้อยหนึ่งขั้น');
  const selected = draft.stages.flatMap(stage => stage.tasks.filter(t=>t.include).map(task=>({stage,task})));
  if (!selected.length && !allowEmpty) throw new Error('เลือกงานย่อยอย่างน้อยหนึ่งงาน');
  if (selected.some(({stage,task})=>!stage.name.trim() || !task.title.trim() || (task.date && !trialValidDate(task.date)))) throw new Error('ตรวจชื่อขั้นตอน ชื่องาน และวันที่ของทุกงานที่เลือก');
  const plot = draft.plotId ? plotById(S,draft.plotId) : null;
  const cycle = draft.cycleId ? cycleById(S,draft.cycleId) : null;
  if (draft.plotId && !plot || draft.cycleId && (!cycle || cycle.plotId!==draft.plotId)) throw new Error('ตรวจแปลงและรอบปลูกอีกครั้ง');
  if(draft.sampleCount){const count=Number(draft.sampleCount),groups=(draft.groups || []).filter(Boolean);if(!Number.isInteger(count) || count<1 || count>200 || count*groups.length>400 || !groups.length || !draft.schema?.length)throw new Error('ตรวจจำนวนต้น กลุ่มทดลอง และค่าวัดก่อนสร้างโครงการ');}
  const year = Number(todayISO().slice(0,4))+543;
  const prefix = `PRJ-${year}-`;
  let n = Math.max(Number(S.projectSequences?.[year]) || 0,...(S.projects || []).map(p=>p.code?.startsWith(prefix) ? Number(p.code.slice(prefix.length)) || 0 : 0))+1;
  while ((S.projects || []).some(p=>p.code===prefix+String(n).padStart(3,'0'))) n++;
  const p={id:uid(),code:prefix+String(n).padStart(3,'0'),name:draft.name.trim(),objective:draft.objective.trim(),description:draft.brief,
    kind:draft.kind || 'work',startDate:draft.startDate,endDate:draft.endDate || '',assignee:draft.assignee || '',proposal:draft.proposal?JSON.parse(JSON.stringify(draft.proposal)):undefined,plotId:draft.plotId,cycleId:draft.cycleId,status:'active',createdAt:Date.now(),trialIds:[],reportVersions:[],
    measurementSchema:JSON.parse(JSON.stringify(draft.schema || [])),groups:(draft.groups || []).filter(Boolean),records:[],events:[],
    stages:draft.stages.map(({id,name})=>({id,name:name.trim()}))};
  const tasks=selected.map(({stage,task},order)=>({id:uid(),title:task.title.trim(),date:task.date,time:task.time || '',type:task.type || 'work',...(draft.kind==='experiment'?{recordKind:projectTaskRecordKind(task)}:{}),status:'planned',order,assignee:task.assignee || draft.assignee || '',
    plotId:draft.plotId || null,cycleId:draft.cycleId || null,projectId:p.id,projectStageId:stage.id,
    cost:0,revenue:0,costItems:[],photos:[],note:'',createdAt:Date.now(),source:'project-draft'}));
  S.projectSequences={...(S.projectSequences || {}),[year]:n};
  S.projects.push(p); S.tasks.push(...tasks);
  if(draft.sampleCount && typeof projectSetupSamples==='function')projectSetupSamples(p,Number(draft.sampleCount));
  return p;
}
function renderProjects() {
  if(route.view==='projectDetail') return renderProjectDetail();
  if(route.view==='projectDraft') return renderProjectDraft();
  const all=(S.projects || []).slice().sort((a,b)=>(b.createdAt || 0)-(a.createdAt || 0));
  const shown=all.filter(p=>projectListFilter==='all' || (p.status==='done'?'done':'active')===projectListFilter);
  const tabs=`<div class="pw-tabs"><button class="${projectHubTab==='projects'?'active':''}" onclick="App.projectHub('projects')">โครงการและงาน</button><button class="${projectHubTab==='trials'?'active':''}" onclick="App.projectHub('trials')">การทดลองเดิม <small>${(S.trials || []).length}</small></button></div>`;
  if(projectHubTab==='trials') return `<div class="project-page"><h1>งานและการทดลอง</h1>${tabs}${renderTrialsTab()}</div>`;
  return `<div class="project-page pw-page"><header class="project-list-head"><div><h1>โครงการและงาน</h1><p>ตั้งเรื่องที่จะทำในแปลง แล้วรวมงาน บันทึก รูป และค่าใช้จ่ายไว้ด้วยกัน</p></div><div class="pp-buttons"><button class="btn btn-outline" onclick="App.projectHistoryNew()">มีงานที่ทำไปแล้ว</button><button class="btn btn-primary" onclick="App.projectSimpleModal()">${pwIcon('plus')} ตั้งโครงการ</button></div></header>${tabs}
    <form class="pw-composer card" onsubmit="return App.projectSuggestDraft(event)"><label for="projectBrief"><b>อยากทำอะไรในโครงการนี้?</b></label><textarea id="projectBrief" rows="2" maxlength="1200" required placeholder="เช่น ดูแลแปลง A ใส่ปุ๋ย ตัดหญ้า และเก็บเกี่ยว"></textarea><div class="pw-between"><small>ให้ช่วยแตกงานได้ หรือเริ่มจากชื่อโครงการแล้วค่อยเพิ่มงานภายหลัง</small><button class="btn btn-primary" type="submit">${ic('plus')} ช่วยร่างงานย่อย</button></div><button class="btn btn-ghost btn-sm" type="button" onclick="App.projectResumeDraft()">เปิดฉบับร่างที่เก็บไว้</button></form>
    <div class="project-filters" aria-label="กรองโครงการ">${[['active','กำลังทำ'],['done','ปิดแล้ว'],['all','ทั้งหมด']].map(([key,label])=>`<button class="${projectListFilter===key?'active':''}" onclick="App.projectFilter('${key}')">${label}</button>`).join('')}</div>
    <div class="project-grid">${shown.map(p=>{const n=projectCounts(p),trials=projectLinkedTrials(p);return `<article class="card project-card"><button class="project-card-open" onclick="App.projectOpen('${p.id}')"><span class="project-eyebrow">${esc(projectCode(p))} · ${p.status==='done'?'ปิดแล้ว':'กำลังทำ'}</span><h2>${esc(p.name)}</h2><p>${esc(projectScopeText(p))}</p>${p.objective?`<p>${esc(p.objective)}</p>`:''}<div class="pw-between"><span>${n.total?n.done+'/'+n.total+' งานเสร็จ':'ยังไม่ได้เพิ่มงาน'}</span>${trials.length?`<span>${trials.length} การทดลอง</span>`:''}</div>${n.total?`<div class="project-progress-bar"><i style="width:${projectProgress(p)}%"></i></div>`:''}</button></article>`;}).join('') || '<div class="card project-empty"><h2>เริ่มจากเรื่องที่จะทำ</h2><p>ตั้งชื่อโครงการ เลือกแปลง แล้วเพิ่มงานได้ตามที่ทำจริง</p></div>'}</div></div>`;
}
function projectObservationList(p,taskId) {
  const rows=projectLinkedTrials(p).flatMap(tr=>tr.observations.filter(o=>o.projectTaskId===taskId).map(o=>({tr,o}))).sort((a,b)=>String(b.o.date).localeCompare(String(a.o.date)));
  return rows.length?rows.map(({tr,o})=>`<article class="card pw-observation"><div class="pw-between"><b>${esc(o.metric)}: ${fmtNum(o.value)} ${esc(o.unit)}</b><button class="btn btn-ghost btn-sm" onclick="App.projectRecord('${p.id}','${taskId}','${tr.id}','${o.id}')">แก้ไข</button></div><small>${esc(dateLabel(o.date))} · ${esc(trialUnitDescription(tr,trialUnit(tr,o.unitId)))}</small><p>${esc(o.note)}</p>${trialPhotosHtml(o.photos)}${o.photoCaption?`<small>${esc(o.photoCaption)}</small>`:''}${o.revisions?.length?`<details><summary>ประวัติการแก้ไข ${o.revisions.length} ครั้ง</summary>${o.revisions.map(v=>`<p>${esc(v.date)} · ${esc(v.metric)} ${fmtNum(v.value)} ${esc(v.unit)} · ${esc(v.note)}</p>`).join('')}</details>`:''}</article>`).join(''):'<p class="pw-empty">ยังไม่มีค่าวัดที่ผูกกับงานนี้ ผลเดิมยังอยู่ในหน้าการทดลอง</p>';
}
function renderProjectDetail() {
  const p=projectById(route.projectId); if(!p) return '<div class="project-page"><h1>ไม่พบโครงการ</h1><button class="btn" onclick="App.projectBack()">กลับโครงการ</button></div>';
  const n=projectCounts(p), costs=projectCosts(p);
  return `<div class="project-page pw-page"><header class="pw-project-head"><span class="project-eyebrow">${esc(projectCode(p))} · ${p.status==='done'?'ปิดโครงการแล้ว':'กำลังดำเนินการ'}</span><div class="pw-between"><h1>${esc(p.name)}</h1><button class="btn btn-outline" onclick="App.projectToggleStatus('${p.id}')">${p.status==='done'?'เปิดโครงการอีกครั้ง':'ปิดโครงการ'}</button></div><p>${esc(projectScopeText(p))}${p.objective?' · '+esc(p.objective):''}</p></header>
    <nav class="pw-tabs">${[['work',projectHasExperiment(p)?'งานและผลทดลอง':'งานและบันทึก'],['info','ข้อมูลโครงการ'],['report','เล่มสรุปโครงการ']].map(([key,label])=>`<button class="${projectWorkspaceTab===key?'active':''}" onclick="App.projectTab('${key}')">${label}</button>`).join('')}</nav>
    ${projectWorkspaceTab==='report'?projectReportHtml(p):projectWorkspaceTab==='info'?projectInfoHtml(p):projectWorkHtml(p)}</div>`;
}
function projectInfoHtml(p) {
  return `<form class="card pw-section" onsubmit="return App.projectSaveInfo(event,'${p.id}')"><div class="field"><label for="piName">ชื่อโครงการ</label><input id="piName" name="name" maxlength="100" required value="${esc(p.name)}"></div><div class="field"><label for="piObjective">วัตถุประสงค์</label><textarea id="piObjective" name="objective" maxlength="2000">${esc(p.objective || '')}</textarea></div><div class="field"><label for="piConclusion">สรุปผลและข้อเสนอแนะ</label><textarea id="piConclusion" name="conclusion" maxlength="6000" rows="5" placeholder="สรุปจากข้อมูลจริง ผลไม่เป็นไปตามคาดสามารถบันทึกได้">${esc(p.conclusion || '')}</textarea></div><button class="btn btn-primary" type="submit">บันทึกข้อมูลโครงการ</button></form>${projectFilesHtml(p)}${projectOptionalTrialHtml(p)}`;
}
let projectReportVersion = '';
App.projectHub=function(tab){projectHubTab=tab;delete route.trialId;render();};
App.projectSuggestDraft=function(e){e.preventDefault();const brief=document.getElementById('projectBrief').value.trim();if(!brief)return false;projectDraft=projectSuggest(brief,'');projectDraftOwner=projectDraftKey();projectStoreDraft();route.view='projectDraft';render();return false;};
App.projectCreateModal=function(){projectHubTab='projects';route.view='projects';render();document.getElementById('projectBrief')?.focus();};
App.projectResumeDraft=function(){try{const d=JSON.parse(localStorage.getItem(projectDraftKey()));if(projectValidDraft(d)){projectDraft=d;projectDraftOwner=projectDraftKey();route.view='projectDraft';render();return;}}catch(_){}toast('ยังไม่มีฉบับร่างที่เปิดได้');};
App.projectDraftField=function(key,value){if(!['name','objective','cycleId','sampleCount','assignee'].includes(key))return;projectDraft[key]=value;const ok=projectStoreDraft();const el=document.getElementById('projectDraftStatus');if(el)el.textContent=ok?'เก็บร่างในเครื่องแล้ว':'เก็บร่างไม่สำเร็จ';};
App.projectDraftStage=function(i,value){projectDraft.stages[i].name=value;projectStoreDraft();};
App.projectDraftTask=function(i,j,key,value){if(!['title','date','include','assignee'].includes(key))return;projectDraft.stages[i].tasks[j][key]=value;if(key==='date')projectDraft.stages[i].tasks[j].manualDate=true;projectStoreDraft();};
App.projectDraftAdd=function(i){projectDraft.stages[i].tasks.push({id:uid(),title:'งานย่อยใหม่',date:'',include:true});projectStoreDraft();render();};
App.projectDraftPlot=function(id){projectDraft.plotId=id;projectDraft.cycleId='';projectStoreDraft();render();};
App.projectSaveDraftClose=function(){if(projectStoreDraft())App.projectBack();};
App.projectConfirmDraft=function(){try{if(projectDraftOwner!==projectDraftKey())throw new Error('บัญชีเปลี่ยนแล้ว กรุณาเปิดฉบับร่างของบัญชีนี้');const result=projectTransaction(()=>projectCreateFromDraft(projectDraft));if(!result.ok)return;try{localStorage.removeItem(projectDraftKey());}catch(_){}projectDraft=null;projectWorkspaceTab='work';App.projectOpen(result.value.id);toast('สร้างโครงการและงานย่อยแล้ว');}catch(e){toast(e.message);}};
App.projectTab=function(tab){projectWorkspaceTab=tab;projectReportVersion='';render();};
App.projectSelectTask=function(id){projectSelectedTask=id;render();};
App.projectSaveInfo=function(e,id){e.preventDefault();const p=projectById(id);if(!p)return false;const f=e.target.elements;if(!f.name.value.trim())return false;const result=projectTransaction(()=>{p.name=f.name.value.trim();p.objective=f.objective.value.trim();p.conclusion=f.conclusion.value.trim();p.updatedAt=Date.now();});if(result.ok)toast('บันทึกข้อมูลโครงการแล้ว');return false;};
App.projectReportVersion=function(id){projectReportVersion=id;render();};
App.projectSaveReport=function(id){const p=projectById(id);if(!p)return;const result=projectTransaction(()=>{p.reportVersions=p.reportVersions || [];const selected=p.reportVersions.find(v=>v.id===projectReportVersion);const snapshot=selected?{...JSON.parse(JSON.stringify(selected)),id:uid(),createdAt:Date.now()}:projectReportSnapshot(p);p.reportVersions.push(snapshot);return snapshot.id;});if(result.ok){projectReportVersion=result.value;render();toast('เก็บฉบับรายงานแล้ว');}};
App.projectOpenTrial=function(id){route.view='plots';route.tab='trials';route.trialId=id;route.trialSection='record';render();};
App.projectTrialLinkModal=function(id){const p=projectById(id);if(!p)return;openModal(`<button class="modal-x" onclick="App.closeModal()">${ic('x')}</button><h3>เชื่อมการทดลองเดิม</h3><p>ข้อมูลดิบและรูปภาพยังอยู่ในรายการเดิม</p><div class="project-task-choices">${(S.trials || []).map(tr=>`<button ${p.trialIds?.includes(tr.id)?'disabled':''} onclick="App.projectAttachTrial('${id}','${tr.id}')"><b>${esc(tr.name)}</b><small>${p.trialIds?.includes(tr.id)?'เชื่อมแล้ว':tr.observations.length+' ค่าวัด'}</small></button>`).join('') || '<p>ยังไม่มีการทดลอง</p>'}</div><button class="btn btn-primary" onclick="App.projectCreateTrial('${id}')">สร้างการทดลอง</button>`);};
App.projectAttachTrial=function(id,trialId){const p=projectById(id);if(!p || p.status==='done' || !trialById(S,trialId))return;const result=projectTransaction(()=>{p.trialIds=[...new Set([...(p.trialIds || []),trialId])];});if(result.ok){closeModal();render();}};
App.projectCreateTrial=function(id){const p=projectById(id);if(!p || p.status==='done')return;closeModal();App.modalTrial(p.plotId || '');const form=document.querySelector('.trial-setup-form');if(form){form.dataset.projectId=id;const input=form.querySelector('#tr_name');if(input)input.value=p.name;}};
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
