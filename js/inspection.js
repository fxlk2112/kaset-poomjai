/* Field inspections are observations, not experimental replications. */
const INSPECTION_CHECKS = [
  ['growth', 'การเจริญเติบโต', ['ปกติ', 'โตช้า', 'ไม่สม่ำเสมอ']],
  ['condition', 'ใบและต้น', ['ไม่พบอาการผิดปกติ', 'พบอาการ']],
  ['pests', 'แมลง', ['ไม่พบ', 'พบ']],
  ['weeds', 'วัชพืช', ['ไม่พบ', 'พบ']],
  ['moisture', 'ดินและน้ำ', ['แห้ง', 'ชื้น', 'แฉะ', 'มีน้ำขัง']]
];
function inspectionAge(cycle, date) {
  if (!cycle || !trialValidDate(cycle.startDate) || !trialValidDate(date) || date < cycle.startDate) return null;
  const days = daysBetween(cycle.startDate, date);
  return days < 0 ? null : days;
}
function inspectionAgeLabel(record) {
  return record && Number.isInteger(record.ageDays) && record.ageDays >= 0 ? `อายุ ${record.ageDays} วัน ณ วันที่ตรวจ` : 'ยังระบุอายุพืชไม่ได้';
}
function inspectionRecords(state, plotId, cycleId, before, excludeId) {
  return (state.tasks || []).filter(t => t.type === 'inspect' && t.status === 'done' && t.plotId === plotId &&
    (!cycleId || t.cycleId === cycleId) && t.id !== excludeId && (!before || taskRecordDate(t) < before))
    .slice().sort((a,b) => taskRecordDate(b).localeCompare(taskRecordDate(a)) || (b.createdAt || 0) - (a.createdAt || 0));
}
function inspectionSummary(record) {
  if (!record) return 'บันทึกแบบเดิม';
  const entries = INSPECTION_CHECKS.filter(([key]) => record.checks?.[key]?.value);
  return entries.length ? entries.map(([key,label]) => label + ': ' + record.checks[key].value).join(' · ') : 'ยังไม่ได้ระบุหัวข้อที่ตรวจ';
}
function inspectionHasResult(record) {
  return Object.values(record?.checks || {}).some(c=>c.value || c.note) ||
    (record?.points || []).some(p=>['heightCm','examinedPlants','pestCount','affectedPlants'].some(k=>p[k]!=null && p[k]!=='') || p.pestName || p.symptomName || p.target || p.photos?.length) ||
    !!record?.resolutions?.length || !!record?.weather?.note?.trim();
}
function inspectionBuild(draft, cycle, date, cycleId, old) {
  if (!trialValidDate(date)) throw new Error('กรุณาระบุวันที่ตรวจให้ถูกต้อง');
  const result = JSON.parse(JSON.stringify(draft));
  result.version = 1;
  result.observedDate = date;
  result.cycleId = cycleId || null;
  const sameContext = old && old.observedDate === date && old.cycleId === result.cycleId;
  result.plantingDate = sameContext ? old.plantingDate : (cycle?.startDate || '');
  result.plantName = sameContext ? old.plantName : (cycle?.plant || '');
  result.ageDays = sameContext ? old.ageDays : inspectionAge(cycle,date);
  result.checks = result.checks || {};
  for (const [key,,options] of INSPECTION_CHECKS) {
    const entry = result.checks[key];
    if (entry?.value && !options.includes(entry.value)) throw new Error('กรุณาตรวจตัวเลือกผลสำรวจ');
  }
  result.points = (result.points || []).map((p,i) => {
    const next = {...p, label:String(p.label || '').trim() || `จุด ${i+1}`};
    for (const key of ['heightCm','pestCount','affectedPlants','examinedPlants']) {
      const raw = p[key];
      next[key] = raw === '' || raw == null ? null : Number(raw);
      if (next[key] !== null && (!Number.isFinite(next[key]) || next[key] < 0 || (key !== 'heightCm' && !Number.isInteger(next[key])))) throw new Error(`${next.label}: ค่าวัดต้องเป็นจำนวนไม่ติดลบ และจำนวนที่นับต้องเป็นจำนวนเต็ม`);
    }
    if (next.affectedPlants !== null && next.examinedPlants !== null && next.affectedPlants > next.examinedPlants) throw new Error(`${next.label}: ต้นที่มีอาการต้องไม่เกินต้นที่ตรวจ`);
    next.pestName = String(p.pestName || '').trim();
    next.symptomName = String(p.symptomName || '').trim();
    return next;
  });
  return result;
}
function inspectionPhotos(photos, label) {
  return (photos || []).length ? `<div class="inspection-photos">${photos.map(url => `<a href="${esc(taskPhotoUrl(url))}" target="_blank" rel="noopener"><img src="${esc(taskPhotoUrl(url))}" alt="${esc(label)}" loading="lazy"></a>`).join('')}</div>` : '';
}
function inspectionWeatherKey(plot, date) {
  if (!plot || !trialValidDate(date) || plot.lat == null || plot.lng == null || String(plot.lat).trim() === '' || String(plot.lng).trim() === '') return '';
  const lat=Number(plot.lat),lng=Number(plot.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180 ? JSON.stringify([plot.id,lat,lng,date]) : '';
}
async function inspectionWeatherFetch(plot,date) {
  const key=inspectionWeatherKey(plot,date);
  if(!key || date>todayISO())throw new Error('invalid weather context');
  const archive=daysBetween(date,todayISO())>5;
  const base=archive?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast';
  const url=base+'?latitude='+Number(plot.lat)+'&longitude='+Number(plot.lng)+'&start_date='+date+'&end_date='+date+'&timezone=Asia%2FBangkok&daily=temperature_2m_min,temperature_2m_max,precipitation_sum';
  const json=await weatherJson(url),daily=json.daily;
  const index=daily?.time?.indexOf(date) ?? -1;
  if(index<0)throw new Error('weather date unavailable');
  const value=name=>{
    const raw=daily[name]?.[index];
    return raw==null || raw==='' || !Number.isFinite(Number(raw)) ? null : Number(raw);
  };
  const snapshot={key,date,timezone:'Asia/Bangkok',source:'Open-Meteo',kind:date===todayISO()?'forecast':'historical',capturedAt:new Date().toISOString(),minC:value('temperature_2m_min'),maxC:value('temperature_2m_max'),rainMm:value('precipitation_sum')};
  if([snapshot.minC,snapshot.maxC,snapshot.rainMm].every(v=>v===null))throw new Error('weather data unavailable');
  return snapshot;
}
function inspectionWeatherHtml(weather) {
  if(!weather)return '';
  const w=weather.snapshot;
  const number=v=>v==null?'ไม่มีข้อมูล':fmtNum(v);
  return `${w?`<p class="muted">${w.kind==='forecast'?'ประมาณการทั้งวัน':'อากาศย้อนหลังรายวัน'} · ${esc(dateLabel(w.date))} · เวลาไทย</p><dl class="inspection-weather-values"><div><dt>ต่ำสุด</dt><dd>${number(w.minC)}${w.minC==null?'':' °C'}</dd></div><div><dt>สูงสุด</dt><dd>${number(w.maxC)}${w.maxC==null?'':' °C'}</dd></div><div><dt>ฝนรวม</dt><dd>${number(w.rainMm)}${w.rainMm==null?'':' มม.'}</dd></div></dl><p class="muted">ข้อมูลแบบจำลองจาก <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> ไม่ใช่ค่าที่วัดในแปลง</p>`:''}${weather.note?`<p><strong>สิ่งที่พบจริง</strong><br>${esc(weather.note)}</p>`:''}`;
}
function inspectionWeatherReport(weather) {
  if(!weather?.snapshot && !weather?.note)return '';
  return `<details class="inspection-weather"><summary>สภาพอากาศประกอบการตรวจ</summary>${inspectionWeatherHtml(weather)}</details>`;
}
function inspectionDetailHtml(t) {
  if (t.type !== 'inspect') return '';
  const r = t.inspection;
  const cycle = cycleById(S,t.cycleId);
  const age = r || {ageDays:inspectionAge(cycle,taskRecordDate(t))};
  const completed = t.status === 'done';
  const ageText = completed ? inspectionAgeLabel(age) : Number.isInteger(age.ageDays) ? `อายุคาดการณ์ ${age.ageDays} วันตามกำหนดตรวจ` : 'ยังระบุอายุพืชไม่ได้';
  return `<section class="inspection-report"><h3>${completed ? 'ผลตรวจแปลง' : 'ข้อมูลเตรียมตรวจแปลง'}</h3><p class="inspection-age">${ageText}</p><div data-inspection-weather="${esc(t.id)}">${inspectionWeatherReport(r?.weather)}</div>
    ${!r ? '<p class="muted">บันทึกเดิมยังไม่มีแบบตรวจแปลง</p>' : `<dl class="inspection-results">${INSPECTION_CHECKS.map(([key,label]) => {
      const check = r.checks?.[key];
      return `<div><dt>${label}</dt><dd>${esc(check?.value || 'ไม่ได้ตรวจ')}${check?.note ? '<p>'+esc(check.note)+'</p>' : ''}${check?.followUp ? '<strong class="inspection-follow">ต้องติดตาม</strong>' : ''}</dd></div>`;
    }).join('')}</dl>${(r.points || []).map(point => `<article class="inspection-point-result"><h4>${esc(point.label)}</h4><p>${[
      point.heightCm != null ? `ความสูง ${fmtNum(point.heightCm)} ซม.` : '',
      point.pestCount != null ? `แมลง ${fmtNum(point.pestCount)} ตัว` : '',
      point.target ? esc(point.target) : '',
      point.affectedPlants != null ? `ต้นที่มีอาการ ${fmtNum(point.affectedPlants)}` : '',
      point.examinedPlants != null ? `ต้นที่ตรวจ ${fmtNum(point.examinedPlants)}` : ''
    ].filter(Boolean).join(' · ') || 'ไม่ได้วัด'}</p>${point.pestName ? '<p>ชนิดแมลง: '+esc(point.pestName)+'</p>' : ''}${point.symptomName ? '<p>อาการที่นับ: '+esc(point.symptomName)+'</p>' : ''}${inspectionPhotos(point.photos,point.label)}</article>`).join('')}${r.resolutions?.length ? '<h4>'+(completed?'ปิดเรื่องในการตรวจครั้งนี้':'เตรียมปิดเรื่อง')+'</h4><ul>'+r.resolutions.map(ref=>'<li>'+esc(INSPECTION_CHECKS.find(([key])=>key===ref.key)?.[1] || ref.key)+' · '+esc(ref.note || '')+'</li>').join('')+'</ul>' : ''}`}</section>`;
}
function inspectionHeightSeries(records) {
  const byDate = new Map();
  for (const t of records) {
    const date = taskRecordDate(t);
    if (!byDate.has(date)) byDate.set(date,[]);
    for (const point of t.inspection?.points || []) if (point.heightCm !== null && point.heightCm !== '' && point.heightCm !== undefined && Number.isFinite(Number(point.heightCm))) byDate.get(date).push(Number(point.heightCm));
  }
  return [...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,value:values.length ? values.reduce((a,b)=>a+b,0)/values.length : null,n:values.length}));
}
function inspectionIssueId(ref) { return JSON.stringify([ref.taskId,ref.key]); }
function inspectionIssues(state, plotId, cycleId, asOf, excludeId) {
  const records=inspectionRecords(state,plotId,null).filter(t => (t.cycleId || null)===(cycleId || null) && t.id!==excludeId && (!asOf || taskRecordDate(t)<=asOf));
  const issues=records.flatMap(t=>INSPECTION_CHECKS.filter(([key])=>t.inspection?.checks?.[key]?.followUp).map(([key,label])=>({taskId:t.id,key,label,date:taskRecordDate(t),note:t.inspection.checks[key].note || t.inspection.checks[key].value || label,resolvedDate:null})));
  for(const issue of issues) {
    const resolution=records.filter(t=>taskRecordDate(t)>=issue.date && t.inspection?.resolutions?.some(ref=>inspectionIssueId(ref)===inspectionIssueId(issue))).sort((a,b)=>taskRecordDate(a).localeCompare(taskRecordDate(b)))[0];
    if(resolution)issue.resolvedDate=taskRecordDate(resolution);
  }
  return issues;
}
function inspectionSubject(value) { return String(value || '').trim().replace(/\s+/g,' ').toLocaleLowerCase(); }
function inspectionMetricSubjects(records, metric) {
  const field=metric==='pests'?'pestName':'symptomName';
  return [...new Set(records.flatMap(t=>(t.inspection?.points || []).map(p=>inspectionSubject(p[field]))).filter(Boolean))].sort();
}
function inspectionMetricSeries(records, metric, subject) {
  if(metric==='height')return inspectionHeightSeries(records);
  const nameField=metric==='pests'?'pestName':'symptomName', countField=metric==='pests'?'pestCount':'affectedPlants';
  const byDate=new Map();
  for(const t of records) {
    const date=taskRecordDate(t);
    if(!byDate.has(date))byDate.set(date,{date,n:0,total:0,examined:0});
    const row=byDate.get(date);
    for(const p of t.inspection?.points || []) {
      if(!subject || inspectionSubject(p[nameField])!==inspectionSubject(subject))continue;
      const count=p[countField], base=p.examinedPlants;
      if(count==null || count==='' || !Number.isInteger(Number(count)) || Number(count)<0 || !Number.isInteger(Number(base)) || Number(base)<=0)continue;
      if(metric==='affected' && Number(count)>Number(base))continue;
      row.total+=Number(count);row.examined+=Number(base);row.n++;
    }
  }
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(row=>({...row,value:row.examined ? row.total/row.examined*(metric==='pests'?10:100) : null}));
}
function inspectionMetricSummaryHtml(series, metric, subject) {
  const latest=series.filter(row=>row.value!==null).slice().sort((a,b)=>a.date.localeCompare(b.date)).pop();
  if(!latest)return '';
  const height=metric==='height', pests=metric==='pests';
  const unit=height?'ซม.':pests?'ตัว / 10 ต้น':'%';
  const counted=height ? `วัดความสูง ${fmtNum(latest.n)} จุด` : `${pests?'พบแมลง':'พบต้นที่มีอาการ'} ${fmtNum(latest.total)} ${pests?'ตัว':'ต้น'} จากต้นที่ตรวจ ${fmtNum(latest.examined)} ต้น · ${fmtNum(latest.n)} จุด`;
  return `<section class="inspection-reading" aria-label="สรุปผลที่มีค่าวัดล่าสุด"><p class="inspection-reading-date">ผลที่มีค่าวัดล่าสุด · ${esc(dateLabel(latest.date))}${height?'':' · '+esc(subject)}</p><div class="inspection-reading-value"><strong>${fmtNum(latest.value)}</strong><span>${unit}</span></div><p>${counted}</p>${pests?'<p class="muted">เป็นจำนวนตัวแมลงเฉลี่ย ไม่ใช่จำนวนต้นที่พบแมลง</p>':''}${!height?`<details><summary>ที่มาของ${pests?'ค่าเฉลี่ย':'เปอร์เซ็นต์'}</summary><p>${fmtNum(latest.total)} ÷ ${fmtNum(latest.examined)} × ${pests?'10':'100'} = ${fmtNum(latest.value)} ${unit}</p></details>`:''}</section>`;
}
function inspectionMissingNoteHtml(series) {
  const missing=series.filter(p=>p.value===null);
  if(!missing.length)return '';
  const first=series.findIndex(p=>p.value!==null),last=series.findLastIndex(p=>p.value!==null);
  const bridged=series.some((p,i)=>p.value===null && i>first && i<last);
  return `<p class="muted inspection-reading-note"><strong>ไม่มีค่าวัด:</strong> ${missing.map(p=>esc(dateLabel(p.date))).join(' · ')}${bridged?'<br>เส้นประ = ช่วงขาดค่าวัด ไม่ใช่ค่าที่วัดหรือประมาณเพิ่ม':''}</p>`;
}
function inspectionMetricTableHtml(series, metric) {
  const height=metric==='height', pests=metric==='pests';
  const valueLabel=height?'เฉลี่ย (ซม.)':pests?'เฉลี่ย (ตัว/10 ต้น)':'มีอาการ (%)';
  return `<div class="inspection-table-scroll"><table class="inspection-history-table inspection-readable-table"><caption>ผลตรวจรายวัน</caption><thead><tr><th scope="col">วันที่ตรวจ</th><th scope="col">${height?'จุดที่วัด':'จำนวนที่ตรวจและพบ'}</th><th scope="col">${valueLabel}</th></tr></thead><tbody>${series.map(row=>{
    const counted=row.value===null?'ยังไม่มีค่าวัด':height?`${fmtNum(row.n)} จุด`:`${pests?'แมลง':'มีอาการ'} ${fmtNum(row.total)} ${pests?'ตัว':'ต้น'}<small>ตรวจ ${fmtNum(row.examined)} ต้น · ${fmtNum(row.n)} จุด</small>`;
    return `<tr><th scope="row">${esc(dateLabel(row.date))}</th><td>${counted}</td><td>${row.value===null?'—':fmtNum(row.value)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
const Inspection = {
  draft:null, original:null, context:null, pending:0,
  begin(task) {
    this.activePoint=0;
    this.original = task?.status === 'done' ? task.inspection || null : null;
    this.draft = JSON.parse(JSON.stringify(task?.inspection || {version:1,checks:{},points:[]}));
    this.draft.checks = this.draft.checks || {};
    this.draft.points = this.draft.points || [];
    this.pending = 0;
    this.weatherRequest = null;
    this.weatherMessage = '';
    this.draft.weather = this.draft.weather || {enabled:true,note:'',snapshot:null};
    this.taskId = task?.id || '';
    return `<section id="inspectionBox" class="inspection-editor"><div id="inspectionContext" aria-live="polite"></div><div id="inspectionFollowups"></div>
      <details class="inspection-weather"><summary>สภาพอากาศประกอบการตรวจ <span id="inspectionWeatherBadge" class="muted"></span></summary><label class="inspection-tick"><input type="checkbox" ${this.draft.weather.enabled!==false?'checked':''} onchange="Inspection.weatherToggle(this.checked)"> ดึงอากาศรายวันอัตโนมัติ</label><div id="inspectionWeatherStatus" role="status"></div><label class="field">สิ่งที่พบจริงเกี่ยวกับอากาศ (ไม่บังคับ)<textarea rows="2" oninput="Inspection.draft.weather.note=this.value;Inspection.dirty()">${esc(this.draft.weather.note || '')}</textarea></label></details>
      <h3>ตรวจแบบเร็ว</h3><div class="inspection-checks">${INSPECTION_CHECKS.map(([key,label,options])=>{
        const entry=this.draft.checks?.[key] || {};
        return `<div class="inspection-check"><label for="inspect_${key}">${label}</label><select id="inspect_${key}" onchange="Inspection.check('${key}','value',this.value)"><option value="">ไม่ได้ตรวจ</option>${options.map(v=>`<option ${entry.value===v?'selected':''}>${v}</option>`).join('')}</select>
        <details ${entry.note || entry.followUp ? 'open' : ''}><summary>รายละเอียด / ติดตาม</summary><label class="field">สิ่งที่พบ<input aria-label="${label}: สิ่งที่พบ" value="${esc(entry.note || '')}" oninput="Inspection.check('${key}','note',this.value)"></label><label class="inspection-tick"><input type="checkbox" ${entry.followUp?'checked':''} onchange="Inspection.check('${key}','followUp',this.checked)"> ต้องติดตาม</label></details></div>`;
      }).join('')}</div><details class="inspection-points" ${this.draft.points?.length ? 'open' : ''}><summary>เก็บรายละเอียดรายจุด</summary><div id="inspectionPoints"></div><button type="button" class="btn btn-outline" onclick="Inspection.addPoint()">${ic('plus')} เพิ่มจุดสำรวจ</button></details></section>`;
  },
  dirty() { const modal=document.querySelector('#modalRoot .modal');if(modal)modal.dataset.dirty='true'; },
  compact() {
    const form=document.querySelector('.task-form');if(!form)return;
    const details=document.createElement('details');details.className='inspection-task-options';
    const summary=document.createElement('summary');summary.textContent='ชื่องาน / ประเภทกิจกรรม';details.appendChild(summary);
    for(const id of ['t_type','t_title'])details.appendChild(document.getElementById(id).closest('.field'));
    form.insertBefore(details,form.firstChild);
    details.addEventListener('invalid',()=>{details.open=true;},true);
  },
  check(key,field,value) { this.draft.checks[key]={...(this.draft.checks[key] || {}),[field]:value};this.dirty(); },
  contextRefresh() {
    const box=document.getElementById('inspectionBox');if(!box)return;
    const inspect=document.getElementById('t_type')?.value === 'inspect';box.hidden=!inspect;
    box.querySelectorAll('input,select,textarea,button').forEach(control=>{control.disabled=!inspect;});
    const status=document.getElementById('t_status')?.value;
    const heading=document.querySelector('#modalRoot [data-default-title]');
    if(heading)heading.textContent=inspect ? (status==='done'?'บันทึกผลตรวจแปลง':status==='planned'?'วางแผนตรวจแปลง':'บันทึกการตรวจไม่สำเร็จ') : heading.dataset.defaultTitle;
    const submit=document.getElementById('taskSubmitButton');
    if(submit)submit.textContent=inspect ? (status==='done'?'บันทึกผลตรวจ':status==='planned'?'บันทึกแผนตรวจ':'บันทึกไม่สำเร็จ') : this.taskId ? 'บันทึกการแก้ไข' : status==='planned'?'บันทึกแผนงาน':'บันทึกงานที่ทำแล้ว';
    const noteLabel=document.querySelector('label[for="t_note"]');
    if(noteLabel)noteLabel.textContent=inspect?'หมายเหตุเพิ่มเติม':'สิ่งที่ต้องทำ / รายละเอียดเพิ่มเติม';
    const options=document.querySelector('.inspection-task-options');if(options && !inspect)options.open=true;
    if(!inspect)return;
    const plotId=document.getElementById('t_plot')?.value;
    const cycleId=document.getElementById('t_cycle')?.value;
    const date=document.getElementById('t_date')?.value;
    const cycle=cycleById(S,cycleId);
    this.context={plotId,cycleId:cycleId==='__none__'?null:cycleId,date};
    const old=this.original;
    const same=old && old.observedDate===date && old.cycleId===this.context.cycleId;
    const age=same ? old.ageDays : inspectionAge(cycle,date);
    const previous=plotId ? inspectionRecords(S,plotId,cycleId==='__none__'?null:cycleId,date,this.taskId).filter(t=>(t.cycleId || null)===(this.context.cycleId || null))[0] : null;
    const planned=document.getElementById('t_status')?.value==='planned';
    document.getElementById('inspectionContext').innerHTML=`<div class="inspection-context"><b>${planned && age!==null ? 'อายุคาดการณ์ '+age+' วันตามกำหนดตรวจ' : inspectionAgeLabel({ageDays:age})}</b><span>${esc((same?old.plantName:cycle?.plant) || 'ยังไม่ระบุพืช / รอบ')}</span><small>${(same?old.plantingDate:cycle?.startDate) ? 'เริ่มปลูก '+esc(dateLabel(same?old.plantingDate:cycle.startDate))+' · วันเริ่มปลูกนับเป็น 0 วัน' : 'ยังไม่มีวันที่เริ่มปลูกของรอบนี้'}</small></div>
      ${previous?`<details class="inspection-previous"><summary>ครั้งก่อน ${esc(dateLabel(taskRecordDate(previous)))} · ${inspectionAgeLabel(previous.inspection || {ageDays:inspectionAge(cycle,taskRecordDate(previous))})}</summary><p>${esc(inspectionSummary(previous.inspection))}</p><p>${esc(previous.doneNote || previous.note || '')}</p>${inspectionPhotos([...(previous.photos || []),...(previous.donePhotos || []),...(previous.inspection?.points || []).flatMap(p=>p.photos || [])],'รูปการตรวจครั้งก่อน')}</details>`:'<p class="muted inspection-previous">ยังไม่มีผลตรวจก่อนหน้านี้ในรอบที่เลือก</p>'}`;
    this.followupsRender();
    this.weatherRefresh();
  },
  weatherToggle(enabled) {
    this.draft.weather.enabled=enabled;
    this.weatherRequest=null;
    if(!enabled)this.draft.weather.snapshot=null;
    this.dirty();this.weatherRefresh();
  },
  weatherRender() {
    const mount=document.getElementById('inspectionWeatherStatus');if(!mount)return;
    const weather=this.draft.weather;
    mount.innerHTML=weather.snapshot?inspectionWeatherHtml({...weather,note:''}):`<p class="muted">${esc(this.weatherMessage)}</p>${this.weatherFailed?'<button type="button" class="btn btn-outline btn-sm" onclick="Inspection.weatherRequest=null;Inspection.weatherRefresh()">'+ic('refresh')+' ลองใหม่</button>':''}`;
    const badge=document.getElementById('inspectionWeatherBadge');
    if(badge)badge.textContent=weather.snapshot?'· มีข้อมูลรายวัน':this.weatherRequest?.pending?'· กำลังดึง':'· ไม่บังคับ';
  },
  weatherRefresh() {
    const draft=this.draft,weather=draft.weather;
    if(!weather || !this.context)return;
    const {plotId,date}=this.context,plot=S.plots.find(p=>p.id===plotId);
    const key=inspectionWeatherKey(plot,date),done=document.getElementById('t_status')?.value==='done';
    if(weather.snapshot?.key!==key || !done || weather.enabled===false)weather.snapshot=null;
    this.weatherFailed=false;
    if(!done || !key || weather.enabled===false || date>todayISO()) {
      this.weatherRequest=null;
      this.weatherMessage=weather.enabled===false?'ปิดการดึงอากาศอัตโนมัติ':!done?'ยังไม่มีอากาศประกอบผลตรวจ':!key?'ยังไม่มีพิกัดแปลงหรือวันที่ตรวจ':'ยังไม่ถึงวันที่ตรวจ';
      this.weatherRender();return;
    }
    if(weather.snapshot){this.weatherRender();return;}
    if(this.weatherRequest?.key===key){this.weatherFailed=!!this.weatherRequest.failed;this.weatherRender();return;}
    if(typeof navigator!=='undefined' && navigator.onLine===false){this.weatherRequest=null;this.weatherMessage='ออฟไลน์ · บันทึกผลตรวจได้โดยไม่ต้องรออากาศ';this.weatherFailed=true;this.weatherRender();return;}
    const request={key,pending:true};this.weatherRequest=request;
    this.weatherMessage='กำลังดึงอากาศรายวัน · บันทึกผลตรวจได้ทันที';this.weatherRender();
    request.promise=inspectionWeatherFetch(plot,date).then(snapshot=>{
      if(this.draft===draft && this.weatherRequest===request)weather.snapshot=snapshot;
      return snapshot;
    }).catch(()=>{
      request.failed=true;
      if(this.draft===draft && this.weatherRequest===request){this.weatherFailed=true;this.weatherMessage='ดึงอากาศไม่ได้ · ยังบันทึกผลตรวจได้ตามปกติ';}
      return null;
    }).finally(()=>{
      request.pending=false;
      if(this.draft===draft && this.weatherRequest===request && document.getElementById('inspectionBox'))this.weatherRender();
    });
  },
  weatherAfterSave(task) {
    const request=this.weatherRequest,state=S,record=task?.inspection;
    if(!task || task.type!=='inspect' || task.status!=='done' || !record?.weather?.enabled || record.weather.snapshot || !request?.promise)return;
    const session=typeof Auth==='undefined'?null:Auth.session;
    // A late response may enrich only this exact saved revision and account.
    request.promise.then(snapshot=>{
      if(!snapshot || S!==state || (typeof Auth!=='undefined' && Auth.session!==session) || !S.tasks.includes(task) || task.inspection!==record || task.type!=='inspect' || task.status!=='done' || !record.weather.enabled || record.weather.snapshot)return;
      if(snapshot.key!==inspectionWeatherKey(S.plots.find(p=>p.id===task.plotId),record.observedDate))return;
      record.weather.snapshot=snapshot;saveState(S);
      document.querySelectorAll('[data-inspection-weather]').forEach(mount=>{if(mount.dataset.inspectionWeather===task.id)mount.innerHTML=inspectionWeatherReport(record.weather);});
    }).catch(error=>console.warn('Inspection weather was not saved',error));
  },
  followupsRender() {
    const mount=document.getElementById('inspectionFollowups');if(!mount || !this.context)return;
    const {plotId,cycleId,date}=this.context;
    this.followupItems=inspectionIssues(S,plotId,cycleId,date,this.taskId).filter(issue=>!issue.resolvedDate);
    mount.innerHTML=this.followupItems.length ? '<h3>ติดตามจากครั้งก่อน</h3>'+this.followupItems.map((issue,i)=>`<div class="inspection-followup"><div><b>${esc(issue.label)}</b><span>${esc(issue.note)}</span><small>พบ ${esc(dateLabel(issue.date))}</small></div><label class="inspection-tick"><input type="checkbox" aria-label="แก้แล้ว: ${esc(issue.label)} ${esc(issue.date)}" ${this.draft.resolutions?.some(ref=>inspectionIssueId(ref)===inspectionIssueId(issue))?'checked':''} onchange="Inspection.resolve(${i},this.checked)"> แก้แล้ว</label></div>`).join('') : '';
    mount.querySelectorAll('input').forEach(input=>{input.disabled=document.getElementById('t_status')?.value!=='done';});
  },
  resolve(i,checked) {
    const issue=this.followupItems[i];if(!issue)return;
    this.draft.resolutions=(this.draft.resolutions || []).filter(ref=>inspectionIssueId(ref)!==inspectionIssueId(issue));
    if(checked)this.draft.resolutions.push({taskId:issue.taskId,key:issue.key,note:issue.note});
    this.dirty();
  },
  addPoint() { this.draft.points=this.draft.points || [];this.draft.points.push({id:uid(),label:'จุด '+(this.draft.points.length+1),photos:[]});this.activePoint=this.draft.points.length-1;this.pointsRender();this.goPoint(this.activePoint);this.dirty(); },
  pointSummary(p) { return [p.label || 'ไม่ระบุชื่อ',p.heightCm!=null && p.heightCm!=='' ? p.heightCm+' ซม.' : '',p.pestCount!=null && p.pestCount!=='' ? 'แมลง '+p.pestCount+' ตัว' : ''].filter(Boolean).join(' · '); },
  point(i,key,value) { if(this.draft.points[i])this.draft.points[i][key]=value;const summary=document.getElementById('inspectionPointSummary'+i);if(summary)summary.textContent=this.pointSummary(this.draft.points[i]);this.dirty(); },
  goPoint(i) {
    const item=document.getElementById('inspectionPoint'+i);if(!item)return;
    this.activePoint=i;
    document.querySelectorAll('#inspectionPoints details').forEach(el=>{el.open=el===item;});
    item.scrollIntoView({block:'start',behavior:'smooth'});item.querySelector('summary')?.focus({preventScroll:true});
  },
  removePoint(i) { this.draft.points.splice(i,1);this.activePoint=Math.max(0,Math.min(this.activePoint || 0,this.draft.points.length-1));this.pointsRender();this.dirty(); },
  pointsRender() {
    const mount=document.getElementById('inspectionPoints');if(!mount)return;
    mount.innerHTML='<nav class="inspection-point-nav" aria-label="เลือกจุดสำรวจ">'+(this.draft.points || []).map((p,i)=>`<button type="button" title="จุด ${i+1}: ${esc(p.label || '')}" onclick="Inspection.goPoint(${i})">${i+1}</button>`).join('')+'</nav>'+(this.draft.points || []).map((p,i)=>`<details class="inspection-point-fold" id="inspectionPoint${i}" ${i===(this.activePoint || 0)?'open':''}><summary><b>จุดสำรวจ ${i+1}</b><span id="inspectionPointSummary${i}">${esc(this.pointSummary(p))}</span></summary><fieldset class="inspection-point"><legend>จุดสำรวจ ${i+1}</legend>
      <div class="inspection-point-head"><label class="field">ชื่อจุด<input aria-label="ชื่อจุด ${i+1}" value="${esc(p.label || '')}" oninput="Inspection.point(${i},'label',this.value)"></label><button type="button" class="btn btn-danger-soft" title="ลบจุด ${i+1}" aria-label="ลบจุด ${i+1}" onclick="Inspection.removePoint(${i})">${ic('trash')}</button></div>
      <div class="inspection-measures">${[['heightCm','ความสูง (ซม.)','0.1'],['examinedPlants','ต้นที่ตรวจ (ต้น)','1'],['pestCount','จำนวนแมลง (ตัว)','1'],['affectedPlants','ต้นที่มีอาการ (ต้น)','1']].map(([key,label,step])=>`<label class="field">${label}<input aria-label="จุด ${i+1}: ${label}" type="number" min="0" step="${step}" value="${p[key] == null ? '' : esc(p[key])}" oninput="Inspection.point(${i},'${key}',this.value)"></label>`).join('')}</div>
      <div class="inspection-measures"><label class="field">ชนิดแมลง<input aria-label="จุด ${i+1}: ชนิดแมลง" value="${esc(p.pestName || '')}" oninput="Inspection.point(${i},'pestName',this.value)"></label><label class="field">อาการที่นับ<input aria-label="จุด ${i+1}: อาการที่นับ" value="${esc(p.symptomName || '')}" oninput="Inspection.point(${i},'symptomName',this.value)"></label></div>
      ${p.target ? `<label class="field">รายละเอียดเดิม<input aria-label="จุด ${i+1}: รายละเอียดเดิม" value="${esc(p.target)}" oninput="Inspection.point(${i},'target',this.value)"></label>` : ''}
      <div class="inspection-point-photos">${(p.photos || []).map((url,j)=>`<div><a href="${esc(taskPhotoUrl(url))}" target="_blank" rel="noopener"><img src="${esc(taskPhotoUrl(url))}" alt="รูปจุด ${i+1}"></a><button type="button" class="btn btn-danger-soft" aria-label="ลบรูป ${j+1} จุด ${i+1}" onclick="Inspection.removePhoto(${i},${j})">${ic('trash')}</button></div>`).join('')}</div>
      <label class="btn btn-outline inspection-upload">${ic('camera')} เพิ่มรูปจุดนี้<input type="file" accept="image/*" multiple aria-label="เพิ่มรูปจุด ${i+1}" onchange="Inspection.photos(this,${i})"></label>${i<this.draft.points.length-1?`<button type="button" class="btn btn-outline" onclick="Inspection.goPoint(${i+1})">จุดถัดไป ${ic('chevron')}</button>`:''}</fieldset></details>`).join('');
    if(document.getElementById('inspectionBox')?.hidden)mount.querySelectorAll('input,button').forEach(control=>{control.disabled=true;});
  },
  removePhoto(i,j) { this.draft.points[i].photos.splice(j,1);this.pointsRender();this.dirty(); },
  async photos(input,i) {
    const draft=this.draft,point=draft.points[i];const files=[...(input.files || [])];if(!files.length)return;
    this.pending++;this.dirty();
    try { for(const f of files) { const url=await readTaskPhotoFile(f);if(url)(point.photos || (point.photos=[])).push(url); } }
    catch(error) { toast('เพิ่มรูปไม่สำเร็จ กรุณาลองใหม่'); }
    finally { if(this.draft===draft){this.pending--;this.pointsRender();this.dirty();} }
  },
  collect(cycleId,date) {
    if(this.pending)throw new Error('รอเพิ่มรูปจุดสำรวจให้เสร็จก่อน');
    const result=inspectionBuild(this.draft,cycleById(S,cycleId),date,cycleId,this.original);
    const plotId=cycleById(S,cycleId)?.plotId || this.context?.plotId;
    const allowed=inspectionIssues(S,plotId,cycleId,date,this.taskId);
    result.resolutions=(result.resolutions || []).filter(ref=>allowed.some(issue=>inspectionIssueId(ref)===inspectionIssueId(issue)));
    return result;
  },
  history(plotId,cycleId) {
    const cycles=S.cycles.filter(c=>c.plotId===plotId);
    const selected=cycleId || cycles.find(c=>c.status==='active')?.id || cycles[0]?.id || '__none__';
    this.historyPlot=plotId;
    openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><h3>ประวัติตรวจแปลง</h3><div class="field"><label for="inspectionHistoryCycle">พืช / รอบ</label><select id="inspectionHistoryCycle" oninput="event.stopPropagation()" onchange="event.stopPropagation();Inspection.historyRender(this.value)">${cycles.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.plant)} · รอบ ${c.round || '-'} · ${esc(c.startDate)}</option>`).join('')}<option value="__none__" ${selected==='__none__'?'selected':''}>ไม่ผูกรอบปลูก</option></select></div><div id="inspectionHistory"></div>`);
    this.historyRender(selected);
  },
  historyRender(cycleId) {
    const records=inspectionRecords(S,this.historyPlot,null).filter(t=>(t.cycleId || '__none__')===cycleId);
    this.historyRecords=records;
    const cycle=cycleById(S,cycleId);
    const issues=inspectionIssues(S,this.historyPlot,cycleId==='__none__'?null:cycleId,todayISO());
    const open=issues.filter(issue=>!issue.resolvedDate),closed=issues.filter(issue=>issue.resolvedDate);
    const issueHtml=issue=>`<div class="inspection-followup"><div><b>${esc(issue.label)}</b><span>${esc(issue.note)}</span><small>พบ ${esc(dateLabel(issue.date))}${issue.resolvedDate?' · ปิดเรื่อง '+esc(dateLabel(issue.resolvedDate)):''}</small></div></div>`;
    const mount=document.getElementById('inspectionHistory');
    mount.innerHTML=`<section class="inspection-followup-list"><h4>ต้องติดตาม ${open.length} เรื่อง</h4>${open.map(issueHtml).join('')}${open.length?'<button class="btn btn-outline" onclick="Inspection.startFollowup()">'+ic('plus')+' ตรวจติดตาม</button>':''}${closed.length?'<details><summary>ปิดแล้ว '+closed.length+' เรื่อง</summary>'+closed.map(issueHtml).join('')+'</details>':''}</section>
      <div class="inspection-metric-controls"><label class="field">แนวโน้ม<select id="inspectionMetric" oninput="event.stopPropagation()" onchange="event.stopPropagation();Inspection.metricChange()"><option value="height">ความสูงเฉลี่ย</option><option value="pests">แมลงเฉลี่ย (ตัว/10 ต้น)</option><option value="affected">ต้นที่มีอาการ (%)</option></select></label><label class="field" id="inspectionSubjectField" hidden><span id="inspectionSubjectLabel">ชนิดแมลง</span><select id="inspectionSubject" oninput="event.stopPropagation()" onchange="event.stopPropagation();Inspection.metricRender()"></select></label></div><div id="inspectionMetricResult"></div>
      ${!records.length?'<p class="empty">ยังไม่มีผลตรวจในรอบนี้</p>':records.map(t=>`<details class="inspection-history-entry"><summary>${esc(dateLabel(taskRecordDate(t)))} · ${inspectionAgeLabel(t.inspection || {ageDays:inspectionAge(cycle,taskRecordDate(t))})}</summary><p>${esc(t.title)}</p>${inspectionDetailHtml(t)}<p>${esc(t.doneNote || t.note || '')}</p>${inspectionPhotos([...(t.photos || []),...(t.donePhotos || [])],'รูปผลตรวจ')}<button class="btn btn-outline" data-task-id="${esc(t.id)}" onclick="App.viewTask(this.dataset.taskId)">${ic('eye')} ดูบันทึกกิจกรรม</button></details>`).join('')}`;
    this.metricChange();
  },
  startFollowup() {
    const cycleId=document.getElementById('inspectionHistoryCycle').value;
    App.modalTask(todayISO(),{type:'inspect',status:'done',plotId:this.historyPlot,cycleId});
  },
  metricChange() {
    const metric=document.getElementById('inspectionMetric').value;
    document.getElementById('inspectionSubjectField').hidden=metric==='height';
    document.getElementById('inspectionSubjectLabel').textContent=metric==='pests'?'ชนิดแมลง':'อาการที่นับ';
    const names=inspectionMetricSubjects(this.historyRecords,metric);
    document.getElementById('inspectionSubject').innerHTML=names.length?names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join(''):'<option value="">ยังไม่ระบุชนิด</option>';
    this.metricRender();
  },
  metricRender() {
    const metric=document.getElementById('inspectionMetric').value;
    const subject=document.getElementById('inspectionSubject').value;
    const series=inspectionMetricSeries(this.historyRecords,metric,subject);
    const height=metric==='height';
    const title=height?'ความสูงเฉลี่ยของจุดที่วัด':metric==='pests'?'แมลงเฉลี่ย (ตัว/10 ต้น)':'ต้นที่มีอาการ (%)';
    const unit=height?'ซม.':metric==='pests'?'ตัว / 10 ต้น':'%';
    const mount=document.getElementById('inspectionMetricResult');
    if(!series.some(p=>p.value!==null)) {mount.innerHTML='<p class="empty">'+(height?'ยังไม่มีค่าความสูงที่วัด':'ยังไม่มีข้อมูลที่เทียบกันได้: ต้องมีชนิดที่นับ จำนวนที่พบ และจำนวนต้นที่ตรวจมากกว่า 0')+'</p>'+inspectionMetricTableHtml(series,metric);return;}
    mount.innerHTML=`${inspectionMetricSummaryHtml(series,metric,subject)}<h4>${title}${!height?' · '+esc(subject):''}</h4><div id="inspectionMetricChart" class="inspection-chart"></div><p class="muted inspection-reading-note">${height?'เฉลี่ยเฉพาะจุดที่วัดในวันนั้น':'คำนวณเฉพาะชนิดเดียวกัน จากจุดที่ระบุจำนวนต้นที่ตรวจ'}</p>${inspectionMissingNoteHtml(series)}${inspectionMetricTableHtml(series,metric)}`;
    Charts.series(document.getElementById('inspectionMetricChart'),series.map(p=>p.date),[{label:title,color:height?'#168b62':metric==='pests'?'#dc8b2c':'#c6667b',points:series}],{unit,minValue:0,maxValue:metric==='affected'?100:undefined,recordDateTicks:true,connectMissing:true,dateLabel:d=>d.slice(8)+'/'+d.slice(5,7)+'/'+String(Number(d.slice(0,4))+543).slice(-2),sampleLabel:'จุดที่วัด',title,description:title+'ตามวันที่ตรวจแปลง เส้นประคือช่วงขาดค่าวัด ไม่มีการเพิ่มค่าประมาณ ค่าวัดและจำนวนจุดอยู่ในตารางด้านล่าง'});
  }
};
