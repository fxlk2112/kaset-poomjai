/* A report is an editable view of source records; saved versions are immutable snapshots. */
"use strict";
const PROJECT_REPORT_CHAPTERS=[['cover','ข้อมูลโครงการ'],['objective','วัตถุประสงค์'],['work','วิธีดำเนินงาน'],['results','ผลการทดลอง'],['photos','รูปประกอบงาน'],['conclusion','สรุปและข้อเสนอแนะ'],['raw','ภาคผนวกข้อมูลดิบ'],['costs','ต้นทุน'],['events','เหตุการณ์และการปรับแผน']];
let projectReportChapter='cover',projectReportDrag='';
function projectReportConfig(p){return {order:PROJECT_REPORT_CHAPTERS.map(c=>c[0]),texts:{},excludedPhotos:[],includeUnlinked:false,includeEvents:true,from:'',to:'',...(p.reportConfig || {})};}
function projectReportOrder(snap){return (snap.config?.order || PROJECT_REPORT_CHAPTERS.map(c=>c[0])).filter(k=>(k!=='events' || snap.config?.includeEvents!==false) && (k!=='results' || snap.hasExperiment!==false));}
function projectReportTitle(snap,key){return snap.hasExperiment===false && key==='raw'?'เอกสารประกอบ':snap.hasExperiment===false && key==='work'?'ผลการดำเนินงาน':PROJECT_REPORT_CHAPTERS.find(c=>c[0]===key)?.[1] || key;}
function projectReportSnapshot(p){
  const tasks=projectTaskList(p),costs=projectCosts(p),config=projectClone(projectReportConfig(p));
  const within=date=>(!config.from || date>=config.from) && (!config.to || date<=config.to);
  const results=projectLinkedTrials(p).flatMap(tr=>tr.observations.filter(o=>within(o.date) && o.includeInReport!==false && (tasks.some(t=>t.id===o.projectTaskId) || (config.includeUnlinked && !o.projectTaskId))).map(o=>({trial:tr.name,unitLabel:tr.units.find(u=>u.id===o.unitId)?.label || trialUnitDescription(tr,trialUnit(tr,o.unitId)),...projectClone(o),groupName:projectRecordGroupName(tr,o.unitId,o.sampleGroup || ''),revisions:undefined})));
  const snap={id:uid(),createdAt:Date.now(),createdBy:projectActor(),code:projectCode(p),name:config.coverTitle || p.name,objective:config.texts.objective ?? p.objective ?? p.description ?? '',conclusion:p.conclusion || '',cost:costs.cost,config,records:projectClone((p.records || []).filter(r=>within(r.date))),events:projectClone(p.events || []),
    tasks:tasks.map(t=>({id:t.id,title:t.title,date:taskRecordDate(t),status:t.status,cost:t.status==='done'?Number(t.cost)||0:0,costItems:projectClone(t.status==='done'?(t.costItems || []):[]),note:t.status==='done'?(t.doneNote || t.note || ''):t.note || '',photos:projectClone([...(t.photos || []),...(t.donePhotos || [])])})),results};
  snap.hasExperiment=projectHasExperiment(p);snap.attachments=projectClone(p.attachments || []);
  snap.photos=projectReportPhotos(snap).filter(ph=>!config.excludedPhotos.includes(ph.id));
  if(typeof projectReportDecorate==='function')projectReportDecorate(snap,p);
  return snap;
}
function projectReportPhotos(snap){
  const photos=[],seen=new Set();
  const add=(id,photo,caption='',unitLabel='')=>{const src=typeof photo==='string'?photo:photo.src || photo.url;if(!src)return;const key=src+'|'+unitLabel;if(seen.has(key))return;seen.add(key);photos.push({id,src,caption,unitLabel});};
  for(const r of snap.records || [])for(const ph of r.photos || [])if(ph.includeInReport!==false)add(ph.id,ph,ph.caption,r.rows.find(row=>row.unitId===ph.unitId)?.code || 'ภาพรวมงาน');
  for(const t of snap.tasks)for(const [i,ph] of (t.photos || []).entries())add(t.id+'-photo-'+i,ph,t.title);
  for(const o of snap.results)if(!o.projectRecordId)for(const [i,ph] of (o.photos || []).entries())if(o.photoMetadata?.[i]?.includeInReport!==false)add(o.id+'-photo-'+i,ph,o.photoMetadata?.[i]?.caption || o.photoCaption || o.note || o.metric,o.unitLabel);
  return photos;
}
function projectReportChapterBody(snap,key){
  const text=snap.config?.texts?.[key],photos=snap.photos || projectReportPhotos(snap);
  if(key==='cover')return `<section class="pw-report-cover"><div class="pw-report-brand"><img src="images/brand/farmultimate-mark.png" alt=""><b>FARMULTIMATE<br>SOLUTIONS</b></div><span class="pw-report-stamp">ฉบับร่าง</span><p>รายงานโครงการ</p><h1>${esc(snap.name)}</h1><p>${esc(snap.code)}</p>${photos[0]?`<img class="pw-cover-photo" src="${esc(photos[0].src)}" alt="${esc(photos[0].caption)}">`:''}<h2>วัตถุประสงค์</h2><p>${esc(snap.objective || 'ยังไม่ระบุ')}</p><footer>ข้อมูลถึงวันที่ ${new Date(snap.createdAt).toLocaleDateString('th-TH')}<br>${esc(snap.createdBy || '')}</footer></section>`;
  const title=projectReportTitle(snap,key);
  let body='';
  if(key==='objective')body=`<p>${esc(text ?? snap.objective ?? '')}</p>`;
  if(key==='conclusion')body=`<p>${esc((text ?? snap.conclusion) || 'ยังไม่ได้เขียนข้อสรุป')}</p>`;
  if(key==='work')body=`<p>${esc(text ?? snap.summary ?? '')}</p>${snap.tasks.map(t=>`<section><h3>${esc(t.title)}</h3><small>${esc(t.date || 'ยังไม่กำหนดวัน')} · ${t.status==='done'?'เสร็จแล้ว':t.status==='failed'?'ทำไม่ได้':'ยังไม่เสร็จ'}</small><p>${esc(t.note)}</p>${(snap.records || []).filter(r=>r.taskId===t.id).map(r=>`<p>${esc(r.workNote)}${r.note?'\nข้อสังเกต: '+esc(r.note):''}</p>`).join('')}</section>`).join('')}`;
  if(key==='results' || key==='raw')body=`<p>${esc(text || '')}</p>${snap.results.length?`<div class="pw-table-scroll"><table><thead><tr><th>วันที่</th><th>ตัวอย่าง</th><th>กลุ่มทดลอง</th><th>ค่าวัด</th><th>ผล</th>${key==='raw'?'<th>หมายเหตุ / ผู้บันทึก</th>':''}</tr></thead><tbody>${snap.results.map(o=>`<tr><td>${esc(o.date)}</td><td>${esc(o.unitLabel)}</td><td>${esc(o.groupName ?? o.sampleGroup ?? '—')}</td><td>${esc(o.metric)}</td><td>${fmtNum(o.value)} ${esc(o.unit)}</td>${key==='raw'?`<td>${esc(o.note || '')}<small>${esc(o.updatedBy || o.createdBy || '')}</small></td>`:''}</tr>`).join('')}</tbody></table></div>`:'<p>ยังไม่มีค่าวัดที่ยืนยันแล้ว</p>'}`;
  if(key==='raw' && snap.hasExperiment===false)body=`<p>${esc(text || '')}</p>${snap.attachments?.length?'':'<p>ยังไม่มีเอกสารแนบ</p>'}`;
  if(key==='raw' && snap.attachments?.length)body+=`<h3>เอกสารประกอบโครงการ</h3><ul>${snap.attachments.map(f=>`<li>${esc(f.name)}${f.caption?' — '+esc(f.caption):''}</li>`).join('')}</ul><p>ไฟล์ต้นฉบับเก็บในข้อมูลโครงการ</p>`;
  if(key==='photos')body=`<p>${esc(text || '')}</p>${photos.map(ph=>`<figure><img src="${esc(ph.src)}" alt="${esc(ph.caption)}"><figcaption>${esc(ph.unitLabel || '')} · ${esc(ph.caption)}</figcaption></figure>`).join('') || '<p>ยังไม่ได้เลือกรูปเข้าเล่ม</p>'}`;
  if(key==='costs')body=`<p>${esc(text || '')}</p><p>ต้นทุนจากกิจกรรมที่ทำแล้ว ${fmtMoney(snap.cost)} บาท</p><table><thead><tr><th>กิจกรรม</th><th>ต้นทุน (บาท)</th></tr></thead><tbody>${snap.tasks.filter(t=>t.status==='done').map(t=>`<tr><td>${esc(t.title)}</td><td>${fmtMoney(t.cost)}</td></tr>`).join('')}</tbody></table>`;
  if(key==='costs' && typeof ppReportCostsHtml==='function')body=`<p>${esc(text || '')}</p>${ppReportCostsHtml(snap)}`;
  if(key==='events')body=`<p>${esc(text || '')}</p>${(snap.events || []).map(e=>`<section><h3>${esc(snap.tasks.find(t=>t.id===e.taskId)?.title || 'โครงการ')}</h3><p>${esc(e.type==='reschedule'?(e.oldDate || 'ยังไม่กำหนด')+' → '+e.newDate:e.date)} · ${esc(e.reason)}</p><small>${esc(e.by)} · ${new Date(e.at).toLocaleString('th-TH')}</small></section>`).join('') || '<p>ไม่มีเหตุการณ์ที่บันทึกไว้</p>'}`;
  return `<section class="pw-report-chapter"><h2>${esc(title)}</h2>${body}</section>`;
}
function projectReportBody(snap){return `<article class="pw-report-document">${projectReportOrder(snap).map(k=>projectReportChapterBody(snap,k)).join('')}</article>`;}
function projectReportHtml(p){
  const versions=p.reportVersions || [],saved=versions.find(v=>v.id===projectReportVersion),snap=saved || projectReportSnapshot(p),config=snap.config || projectReportConfig(p),order=projectReportOrder(snap),photos=projectReportPhotos(snap);
  if(!order.includes(projectReportChapter))projectReportChapter=order[0];
  const index=order.indexOf(projectReportChapter),conclusion=config.texts?.conclusion ?? snap.conclusion;
  return `<div class="pw-report-tools"><div><h2>เตรียมเล่มสรุปโครงการ</h2><p>รวบรวมข้อมูลและรูปจากบันทึกงาน ตรวจและแก้ไขก่อนส่งออก</p></div><button class="btn btn-outline" onclick="App.projectReportVersions()">${pwIcon('history')} ประวัติเวอร์ชัน</button><button class="btn btn-outline" onclick="App.projectExportWord()">${pwIcon('file-text')} Word</button><button class="btn btn-primary" onclick="App.projectPrint()">${pwIcon('file-text')} ส่งออก PDF</button></div>
  <div class="pw-book-layout"><aside class="pw-book-chapters"><h3>เนื้อหาในเล่ม</h3><small>ลากหรือใช้ปุ่มเพื่อจัดลำดับหัวข้อ</small>${order.map((key,i)=>`<div class="pw-chapter-row ${key===projectReportChapter?'active':''}" draggable="${!saved}" ondragstart="App.projectReportDrag('${key}')" ondragover="event.preventDefault()" ondrop="App.projectReportDrop(event,'${key}')"><button onclick="App.projectReportPage('${key}')"><b>${i+1}</b>${esc(projectReportTitle(snap,key))}</button>${!saved?`<button class="pw-icon-button" aria-label="เลื่อนหัวข้อ ${i+1} ขึ้น" onclick="App.projectReportMove('${key}',-1)">${pwIcon('arrow-up')}</button>`:''}</div>`).join('')}</aside>
  <section class="pw-book-preview"><header><b>ตัวอย่างเอกสาร</b><button class="pw-icon-button" aria-label="หัวข้อก่อนหน้า" ${index===0?'disabled':''} onclick="App.projectReportPage('${order[index-1] || ''}')">${pwIcon('arrow-left')}</button><span>หัวข้อ ${index+1} / ${order.length}</span><button class="pw-icon-button" aria-label="หัวข้อถัดไป" ${index===order.length-1?'disabled':''} onclick="App.projectReportPage('${order[index+1] || ''}')">${pwIcon('chevron')}</button></header><article class="pw-report-document pw-report-preview">${projectReportChapterBody(snap,projectReportChapter)}</article></section>
  <aside class="pw-book-settings"><h3>ข้อมูลที่ใช้ทำเล่ม</h3><dl><div><dt>ข้อมูลถึงวันที่</dt><dd>${new Date(snap.createdAt).toLocaleDateString('th-TH')}</dd></div><div><dt>เวอร์ชัน</dt><dd>${saved?'ฉบับ '+(versions.indexOf(saved)+1):'ร่างล่าสุด'}</dd></div><div><dt>สถานะ</dt><dd><span class="pw-badge">${saved?'เก็บฉบับแล้ว':'ฉบับร่าง'}</span></dd></div></dl>${!conclusion?'<button class="pw-event-banner" onclick="App.projectReportPage(\'conclusion\')">ยังขาด: สรุปผลและข้อเสนอแนะ · เขียนสรุป</button>':''}
    ${!saved?`<div class="pw-book-edit"><label for="prChapterText">${projectReportChapter==='cover'?'ชื่อบนปก':'แก้เนื้อหา / เพิ่มคำอธิบายหัวข้อนี้'}</label>${projectReportChapter==='cover'?`<input id="prChapterText" value="${esc(config.coverTitle || p.name)}" oninput="App.projectReportText(this.value)">`:`<textarea id="prChapterText" rows="4" oninput="App.projectReportText(this.value)">${esc(config.texts?.[projectReportChapter] ?? (projectReportChapter==='objective'?p.objective:projectReportChapter==='conclusion'?p.conclusion:'') ?? '')}</textarea>`}<small>เนื้อหาในรายงานไม่เปลี่ยนข้อมูลดิบ</small></div>`:'<p>กำลังดูฉบับที่เก็บไว้ ข้อมูลจะไม่เปลี่ยนตามงานล่าสุด</p><button class="btn btn-outline" onclick="App.projectReportVersion(\'\')">กลับไปแก้ร่างล่าสุด</button>'}
    <h3>รูปที่เลือกเข้าเล่ม</h3><div class="pw-book-photo-list">${photos.map(ph=>`<label><input type="checkbox" ${!config.excludedPhotos.includes(ph.id)?'checked':''} ${saved?'disabled':''} onchange="App.projectReportPhoto('${ph.id}',this.checked)"><img src="${esc(ph.src)}" alt="${esc(ph.caption)}"><span>${esc(ph.unitLabel || '')}<small>${esc(ph.caption)}</small></span></label>`).join('') || '<p>แนบรูปในบันทึกงานก่อน</p>'}</div>
    <details><summary>ขอบเขตข้อมูลและเหตุการณ์</summary>${snap.hasExperiment!==false?`<div class="pw-report-date-range"><label>ผลทดลองตั้งแต่<input aria-label="ผลทดลองตั้งแต่" type="date" value="${esc(config.from || '')}" ${saved?'disabled':''} onchange="App.projectReportOption('from',this.value)"></label><label>ถึงวันที่<input aria-label="ผลทดลองถึงวันที่" type="date" value="${esc(config.to || '')}" ${saved?'disabled':''} onchange="App.projectReportOption('to',this.value)"></label><small>กรองผลและรูปทดลองตามวันที่ งานและต้นทุนรวมทั้งโครงการ</small></div><label class="pw-check"><input type="checkbox" ${config.includeUnlinked?'checked':''} ${saved?'disabled':''} onchange="App.projectReportOption('includeUnlinked',this.checked)"> รวมผลเดิมที่ยังไม่ผูกงานย่อย</label>`:''}<label class="pw-check"><input type="checkbox" ${config.includeEvents?'checked':''} ${saved?'disabled':''} onchange="App.projectReportOption('includeEvents',this.checked)"> รวมเหตุการณ์และการปรับแผน</label><p>${snap.hasExperiment!==false?snap.results.length+' ค่าวัด · ':''}${snap.tasks.length} งาน · ${(snap.events || []).length} เหตุการณ์</p></details>
    ${snap.attachments?.length?`<details><summary>เอกสารประกอบ ${snap.attachments.length} ไฟล์</summary>${snap.attachments.map(f=>`<p><a href="${esc(projectFileDownloadData(f))}" download="${esc(f.name)}" onclick="return App.projectDownloadFile('${f.id}')">${esc(f.name)}</a><small>${esc(f.caption || '')}</small></p>`).join('')}</details>`:''}
    <button class="btn btn-outline pw-save-version" onclick="App.projectSaveReport('${p.id}')">${pwIcon('file-text')} บันทึกเวอร์ชันรายงาน</button><small>เวอร์ชันที่บันทึกเก็บข้อมูล ณ วันที่ระบุ</small>
  </aside></div><div id="projectPrintDocument" class="pw-print-only">${projectReportBody(snap)}</div>`;
}
function projectReportChange(change){const p=projectById(route.projectId);if(!p || projectReportVersion)return;const result=projectTransaction(()=>{p.reportConfig=projectReportConfig(p);change(p.reportConfig);});if(result.ok)render();}
App.projectReportPage=function(key){projectReportChapter=key;render();};
App.projectReportText=function(value){
  const p=projectById(route.projectId);if(!p || projectReportVersion)return;
  const result=projectTransaction(()=>{p.reportConfig=projectReportConfig(p);if(projectReportChapter==='cover')p.reportConfig.coverTitle=value;else p.reportConfig.texts[projectReportChapter]=value;});
  if(!result.ok)return;
  const snap=projectReportSnapshot(p),preview=document.querySelector('.pw-report-preview'),print=document.getElementById('projectPrintDocument');
  if(preview)preview.innerHTML=projectReportChapterBody(snap,projectReportChapter);
  if(print)print.innerHTML=projectReportBody(snap);
  const missing=document.querySelector('.pw-book-settings > .pw-event-banner');if(missing && snap.config.texts.conclusion)missing.remove();
};
App.projectReportPhoto=function(id,selected){projectReportChange(c=>{c.excludedPhotos=c.excludedPhotos.filter(x=>x!==id);if(!selected)c.excludedPhotos.push(id);});};
App.projectReportOption=function(key,value){if(['includeUnlinked','includeEvents','from','to'].includes(key)){if(['from','to'].includes(key) && value && !trialValidDate(value))return;const c=projectReportConfig(projectById(route.projectId));c[key]=value;if(c.from && c.to && c.from>c.to){toast('วันเริ่มต้องไม่เกินวันสุดท้าย');render();return;}projectReportChange(c=>c[key]=value);}};
App.projectReportMove=function(key,dir){projectReportChange(c=>{const i=c.order.indexOf(key),j=i+dir;if(j>=0 && j<c.order.length)[c.order[i],c.order[j]]=[c.order[j],c.order[i]];});};
App.projectReportDrag=function(key){projectReportDrag=key;};
App.projectReportDrop=function(e,key){e.preventDefault();projectReportChange(c=>{const i=c.order.indexOf(projectReportDrag),j=c.order.indexOf(key);if(i>=0 && j>=0){c.order.splice(i,1);c.order.splice(j,0,projectReportDrag);}});};
App.projectReportVersions=function(){const p=projectById(route.projectId);openModal(`<h3>ประวัติเวอร์ชันรายงาน</h3><div class="project-task-choices"><button onclick="App.closeModal();App.projectReportVersion('')"><b>ร่างจากข้อมูลล่าสุด</b></button>${(p.reportVersions || []).map((v,i)=>`<button onclick="App.closeModal();App.projectReportVersion('${v.id}')"><b>ฉบับ ${i+1}</b><small>${new Date(v.createdAt).toLocaleString('th-TH')} · ${esc(v.createdBy || '')} · ${v.hasExperiment===false?v.tasks.filter(t=>t.status==='done').length+' งานเสร็จ':v.results.length+' ค่าวัด'}</small></button>`).reverse().join('')}</div><button class="btn btn-outline" onclick="App.closeModal()">ปิด</button>`);};
App.projectPrint=async function(){
  const source=document.getElementById('projectPrintDocument') || document.querySelector('.pw-report-document');if(!source)return;
  document.getElementById('projectPrintOutput')?.remove();
  const root=document.createElement('div');root.id='projectPrintOutput';root.className='pw-print-only';root.innerHTML=source.id==='projectPrintDocument'?source.innerHTML:source.outerHTML;document.body.append(root);
  const images=[...root.querySelectorAll('img')];
  const cleanup=()=>{document.body.classList.remove('pw-print');root.remove();};
  try{await Promise.all(images.map(img=>img.decode()));}catch(_){cleanup();toast('มีรูปที่ยังเปิดไม่ได้ กรุณาตรวจรูปก่อนส่งออก');return;}
  window.addEventListener('afterprint',cleanup,{once:true});document.body.classList.add('pw-print');window.print();
};
App.projectExportWord=async function(){
  const p=projectById(route.projectId),snap=(p.reportVersions || []).find(v=>v.id===projectReportVersion) || projectReportSnapshot(p);
  try{toast('กำลังจัดทำไฟล์ Word…');const blob=await projectDocx(snap);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=snap.code+'-รายงานโครงการ.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('สร้างไฟล์ Word แล้ว');}catch(e){toast('สร้าง Word ไม่สำเร็จ: '+e.message);}
};
