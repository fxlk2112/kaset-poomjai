// Separate session and storage: this page never loads the owner's application state.
const C={api:'https://farmbackup.carfork123.workers.dev',session:null,context:null,tab:'record',photos:[],busy:false,register:false,assignment:'',editing:null};
const el=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={inspect:'ตรวจแปลง',work:'งานทั่วไป',water:'ให้น้ำ',spray:'ฉีดยา',fertilize:'ใส่ปุ๋ย',harvest:'เก็บเกี่ยว',trial:'ผลทดลอง'};
const cIcon=name=>'<i data-lucide="'+name+'" aria-hidden="true"></i>';
const icons=()=>{if(typeof lucide!=='undefined')lucide.createIcons();};
const checkOptions={growth:['การเจริญเติบโต','ปกติ','โตช้า','ไม่สม่ำเสมอ'],condition:['ใบและต้น','ไม่พบอาการผิดปกติ','พบอาการ'],pests:['แมลง','ไม่พบ','พบ'],weeds:['วัชพืช','ไม่พบ','พบ'],moisture:['ดินและน้ำ','แห้ง','ชื้น','แฉะ','มีน้ำขัง']};
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10), dateLabel=d=>new Date(d+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
const msg=s=>{el('message').textContent=s;};
const key=part=>'farmult-collector-'+part+'::'+C.session.email.toLowerCase();
const read=(part,fallback)=>{try{return JSON.parse(localStorage.getItem(key(part))) ?? fallback;}catch(e){return fallback;}};
const write=(part,value)=>{localStorage.setItem(key(part),JSON.stringify(value));};
async function api(action,data={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const r=await fetch(C.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:C.session?.token,...data}),signal:controller.signal});if(r.status>=500)throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');const j=await r.json();if(!j.ok){const error=new Error(j.error||'ส่งไม่สำเร็จ');error.denied=true;throw error;}return j.data;}finally{clearTimeout(timer);}
}
function options(items,value,label=x=>x.name){return items.map(x=>`<option value="${esc(x.id)}" ${value===x.id?'selected':''}>${esc(label(x))}</option>`).join('');}
async function signedIn(session) {
  C.session=session;localStorage.setItem('farmult-collector-session',JSON.stringify(session));
  el('login').hidden=true;el('workspace').hidden=false;el('logout').hidden=false;el('identity').textContent=session.name+' · '+session.email;
  el('inviteBox').hidden=!new URLSearchParams(location.hash.slice(1)).has('invite');await refresh();
}
async function refresh() {
  const epoch=C.refreshEpoch=(C.refreshEpoch || 0)+1,session=C.session,assignment=C.assignment;
  msg('กำลังโหลดสิทธิ์...');
  try {
    const rows=await api('team_assignments');if(C.refreshEpoch!==epoch || C.session!==session || C.assignment!==assignment)return;write('assignments',rows);
    el('assignment').innerHTML=options(rows,C.assignment,x=>x.owner_name||'ฟาร์มที่ได้รับมอบหมาย');
    C.assignment=el('assignment').value;await loadContext();msg('');await flush();
  }catch(e){
    if(C.refreshEpoch!==epoch || C.session!==session)return;
    const rows=read('assignments',[]);el('assignment').innerHTML=options(rows,C.assignment,x=>x.owner_name||'ฟาร์มที่ได้รับมอบหมาย');C.assignment=el('assignment').value;
    C.context=read('context-'+C.assignment,null);render();msg(e.denied?e.message:'เชื่อมต่อไม่ได้ กรอกร่างออฟไลน์ได้ ส่งข้อมูลจะตรวจสิทธิ์ใหม่');
  }
}
async function loadContext() {
  C.context=null;if(!C.assignment){render();return;}
  el('content').innerHTML='<p role="status" class="empty-state">กำลังโหลดแบบฟอร์ม...</p>';
  const assignment=C.assignment,session=C.session;
  try{const context=await api('team_context',{grantId:assignment});if(C.assignment!==assignment || C.session!==session)return;C.context=context;write('context-'+assignment,context);}
  catch(e){if(C.assignment!==assignment || C.session!==session)return;if(e.denied)write('context-'+assignment,null);else C.context=read('context-'+assignment,null);render();throw e;}
  render();
}
function draft(){return read('draft-'+C.assignment,{id:crypto.randomUUID(),date:today(),workStatus:'done',points:[]});}
function draftNotice(p){
  if(!p.date || p.date===today())return '';
  return `<div class="draft-notice" role="status"><div><strong>${p.revision?'กำลังแก้รายการวันที่':'ร่างวันที่'} ${esc(dateLabel(p.date))}</strong><span>${p.date>today()?'วันที่อยู่ในอนาคต':'บันทึกย้อนหลัง'}</span></div><button type="button" onclick="startNewDraft()">${cIcon('plus')} เริ่มบันทึกวันนี้</button></div>`;
}
function localWorkCount(){
  const suffix='::'+C.session.email.toLowerCase();
  return {queued:read('queue',[]).length,drafts:Object.keys(localStorage).filter(k=>k.startsWith('farmult-collector-draft-') && k.endsWith(suffix)).reduce((count,k)=>{
    try{const p=JSON.parse(localStorage.getItem(k));return count+Number(!!p && (hasResults(p) || !!p.revision || !!p.title && p.title!==types[p.type]));}catch(e){return count+1;}
  },0)};
}
const contextFields=['plotId','cycleId','type','trialId','unitId','metricId'];
function hasResults(p){return !!(Object.values(p.applicationWork || {}).some(v=>v!=='' && v!==null && v!==undefined) || (p.wateringMinutes!==undefined && p.wateringMinutes!==null && p.wateringMinutes!=='') || p.materials?.length || p.note || p.photos?.length || p.points?.length || Object.values(p.checks || {}).some(Boolean) || (p.value!==undefined && p.value!==null && p.value!=='') || p.samples?.some(v=>v!=='' && v!==null));}
function transitionDraft(before,field,value){
  const next={...before,[field]:value,samples:[],value:'',points:[],checks:{},note:'',photos:[],materials:[],wateringMinutes:'',applicationWork:{}};
  if(field==='plotId'){next.cycleId='';next.trialId='';next.unitId='';next.metricId='';}
  if(field==='trialId'){next.unitId='';next.metricId='';}
  if(field==='type'){next.title=types[value];if(value==='trial')next.workStatus='done';}
  return next;
}
function confirmContext(replacing=false){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='context-dialog';
    dialog.innerHTML='<h2>เปลี่ยนหัวข้อที่บันทึก?</h2><p>ผลที่กรอกไว้จะเก็บเป็นร่างก่อนเปลี่ยน แล้วเริ่มกรอกผลของหัวข้อใหม่</p><div><button type="button" data-cancel>กรอกต่อที่เดิม</button><button type="button" class="primary" data-confirm>เปลี่ยนและเก็บร่างเดิม</button></div>';
    if(replacing){
      dialog.querySelector('h2').textContent='เปิดรายการเพื่อแก้ไข?';
      dialog.querySelector('p').textContent='มีร่างที่ยังไม่ส่ง ระบบจะเก็บร่างเดิมไว้ให้ย้อนคืนได้';
      dialog.querySelector('[data-cancel]').textContent='ยังไม่เปิด';
      dialog.querySelector('[data-confirm]').textContent='เก็บร่างและเปิดรายการ';
    }
    let accepted=false;
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-confirm]').onclick=()=>{accepted=true;dialog.close();};
    dialog.onclose=()=>{dialog.remove();resolve(accepted);};
    document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  });
}
async function changeContext(before,field,value){
  const assignment=C.assignment,session=C.session;
  if(hasResults(before) && !await confirmContext())return null;
  if(C.assignment!==assignment || C.session!==session)return null;
  const next=transitionDraft(before,field,value);
  write('undo-'+C.assignment,before);write('draft-'+C.assignment,next);return next;
}
function restoreDraft(){
  const previous=read('undo-'+C.assignment,null);if(!previous)return;
  const current=el('recordForm')?capture():draft();
  try{write('undo-'+C.assignment,current);write('draft-'+C.assignment,previous);render();msg('คืนร่างก่อนเปลี่ยนแล้ว');}catch(e){msg('พื้นที่เครื่องเต็ม ยังไม่ได้เปลี่ยนร่าง');}
}
function startNewDraft(){
  if(C.busy)return;
  const current=el('recordForm')?capture():draft();if((hasResults(current) || current.revision) && !confirm('เก็บร่างปัจจุบันไว้ แล้วเริ่มรายการใหม่?'))return;
  try{write('undo-'+C.assignment,current);write('draft-'+C.assignment,{id:crypto.randomUUID(),date:today(),workStatus:'done',points:[]});render();}catch(e){msg('พื้นที่เครื่องเต็ม ยังไม่ได้เปลี่ยนร่าง');}
}
function capture() {
  const form=el('recordForm');if(!form)return draft();const fd=new FormData(form),p={...draft()};
  for(const k of ['type','plotId','cycleId','date','title','note','workStatus','trialId','unitId','metricId','value'])p[k]=fd.get(k)||'';
  const watering=form.elements.namedItem('wateringMinutes');p.wateringMinutes=watering?watering.value:(p.wateringMinutes??'');
  p.applicationWork={...p.applicationWork};
  for(const key of ['waterLitres','areaRai']){const input=form.elements.namedItem(key);if(input)p.applicationWork[key]=input.value;}
  p.checks=Object.fromEntries(Object.keys(checkOptions).map(k=>[k,fd.get('check-'+k)||'']));
  p.points=[...form.querySelectorAll('[data-point]')].map(node=>Object.fromEntries([...node.querySelectorAll('input')].map(input=>[input.dataset.key,input.value])));
  p.samples=[...form.querySelectorAll('[data-sample]')].map(input=>input.value);p.photos=C.photos;
  p.materials=[...form.querySelectorAll('[data-material]')].map(node=>({...((node.dataset.source==='external')
    ?{source:'external',name:node.querySelector('[data-material-name]').value,qty:node.querySelector('[data-material-qty]').value,unit:node.querySelector('[data-material-unit]').value,rate:node.querySelector('[data-material-rate]')?.value || ''}
    :{stockId:node.querySelector('select').value,qty:node.querySelector('[data-material-qty]').value,unit:node.dataset.unit,rate:node.querySelector('[data-material-rate]')?.value || ''}),...captureDose(node)}));return p;
}
function captureDose(node){
  const amount=node.querySelector('[data-dose="amount"]');if(!amount)return {};
  return {dose:Object.fromEntries(['amount','unit','per','basis'].map(key=>[key,node.querySelector('[data-dose="'+key+'"]').value]))};
}
function persist(){try{write('draft-'+C.assignment,capture());if(el('draftStatus'))el('draftStatus').textContent='เก็บร่างในเครื่องแล้ว · ยังไม่ส่ง · '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});return true;}catch(e){msg('พื้นที่เครื่องเต็ม ร่างยังไม่ถูกเก็บ อย่าปิดหน้านี้');return false;}}
function render() {
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===C.tab)));
  if(C.tab==='sent'){sent();return;}
  if(!C.context){el('content').innerHTML='<div class="empty-state"><h2>ยังไม่มีแปลงที่เปิดให้บันทึก</h2><p>รับคำเชิญจากเจ้าของฟาร์ม หรือรีเฟรชสิทธิ์อีกครั้ง</p><button onclick="refresh()">โหลดสิทธิ์ใหม่</button></div>';return;}
  const p=draft(),ctx=C.context;
  if((p.plotId && !ctx.plots.some(x=>x.id===p.plotId)) || (p.type && !ctx.types.includes(p.type)) || (p.cycleId && !ctx.cycles.some(c=>c.id===p.cycleId && c.plotId===(p.plotId || ctx.plots[0]?.id)))){
    el('content').innerHTML='<div class="empty-state"><h2>ร่างนี้อยู่นอกสิทธิ์ปัจจุบัน</h2><p>ข้อมูลเดิมยังเก็บอยู่ในเครื่อง ไม่ได้นำไปใส่แปลงอื่น</p><button onclick="startNewDraft()">เริ่มร่างใหม่</button></div>';return;
  }
  p.type=p.type || ctx.types[0];p.plotId=p.plotId || ctx.plots[0]?.id;
  const cycles=ctx.cycles.filter(c=>c.plotId===p.plotId);p.cycleId=cycles.some(c=>c.id===p.cycleId)?p.cycleId:cycles[0]?.id;
  const cycle=cycles.find(c=>c.id===p.cycleId),age=cycle?Math.round((Date.parse(p.date)-Date.parse(cycle.startDate))/86400000):null;
  if(p.type==='trial' && p.trialId){const t=ctx.trials.find(t=>t.id===p.trialId);if(!t || (p.unitId && !t.units.some(u=>u.id===p.unitId && u.plotId===p.plotId)) || (p.metricId && !t.metrics.some(m=>m.id===p.metricId))){el('content').innerHTML='<div class="empty-state"><h2>งานทดลองในร่างเปลี่ยนไปแล้ว</h2><p>เก็บข้อมูลเดิมไว้แล้ว กรุณาเริ่มร่างใหม่ตามสิทธิ์ปัจจุบัน</p><button onclick="startNewDraft()">เริ่มร่างใหม่</button></div>';return;}}
  C.photos=p.photos||[];
  el('content').innerHTML=`<form id="recordForm"><div class="draft-bar"><span id="draftStatus" role="status">${p.revision?'ฉบับแก้ไขในเครื่อง · ยังไม่ส่ง':'ร่างในเครื่อง · ยังไม่ส่งให้เจ้าของ'}</span>${read('undo-'+C.assignment,null)?`<button type="button" class="text-button" onclick="restoreDraft()">${cIcon('undo-2')} คืนร่างก่อนเปลี่ยน</button>`:''}</div>${draftNotice(p)}<section class="form-section"><h2>${cIcon('map-pin')} 1. แปลงและวันที่</h2><div class="grid context-grid"><label>แปลง<select name="plotId" required>${options(ctx.plots,p.plotId)}</select></label><label>รอบปลูก<select name="cycleId" required>${options(cycles,p.cycleId,c=>c.plant+' · รอบ '+c.round+' · เริ่ม '+dateLabel(c.startDate))}</select></label><label>ประเภทงาน<select name="type">${Object.entries(types).filter(([k])=>ctx.types.includes(k)).map(([k,v])=>`<option value="${k}" ${k===p.type?'selected':''}>${v}</option>`).join('')}</select></label><label>วันที่ทำงาน<input type="date" name="date" max="${today()}" min="${cycle?.startDate || ''}" value="${esc(p.date)}" required><small>${dateLabel(p.date)}</small></label></div>
    <div class="age"><div>${cIcon('sprout')} <span>${esc(cycle?.plant || 'ยังไม่มีรอบปลูก')}</span></div><p>${age!==null && age>=0?'<strong>'+age+'</strong> วัน <small>ณ '+esc(dateLabel(p.date))+'</small>':'ยังระบุอายุพืชไม่ได้'}</p></div>${!cycle?'<p class="review-notice" role="status">ยังส่งไม่ได้ · รอเจ้าของเปิดรอบปลูกของแปลงนี้</p>':''}</section>
    <section class="form-section"><h2>${cIcon('clipboard-check')} 2. ผลการทำงาน</h2><label>ชื่องาน<input name="title" value="${esc(p.title || types[p.type])}" maxlength="160" required></label>${p.type==='trial'?'<input type="hidden" name="workStatus" value="done">':`<fieldset class="result-options"><legend>สถานะงาน</legend><label><input type="radio" name="workStatus" value="done" ${p.workStatus!=='failed'?'checked':''}>${cIcon('check')} สำเร็จ</label><label><input type="radio" name="workStatus" value="failed" ${p.workStatus==='failed'?'checked':''}>${cIcon('circle-x')} ไม่สำเร็จ</label></fieldset>`}
    ${p.type==='inspect'?`<fieldset><legend>ผลตรวจแปลง</legend><div class="grid">${Object.entries(checkOptions).map(([k,[label,...opts]])=>`<label>${label}<select name="check-${k}"><option value="">ไม่ได้ตรวจ</option>${opts.map(v=>`<option ${p.checks?.[k]===v?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div></fieldset><h2>จุดสำรวจ</h2><nav class="pointnav">${(p.points||[]).map((q,i)=>`<button type="button" onclick="pointGo(${i})">${i+1}</button>`).join('')}</nav>${(p.points||[]).map((q,i)=>pointHtml(q,i)).join('')}<button type="button" id="addPoint">เพิ่มจุดสำรวจ</button>`:''}
    ${p.type==='water'?wateringHtml(p):''}${p.type==='trial'?trialHtml(p):''}${['spray','fertilize'].includes(p.type)?materialsHtml(p):''}</section>
    <details class="form-section extra-details" ${p.note || C.photos.length?'open':''}><summary>หมายเหตุและรูปประกอบ <small>ไม่บังคับ</small></summary><label>หมายเหตุ <small>ไม่บังคับ</small><textarea name="note" rows="3" maxlength="3000">${esc(p.note)}</textarea></label><label>รูปประกอบ <small>ไม่บังคับ · สูงสุด 3 รูป</small><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div class="photos">${C.photos.map((src,i)=>`<div><button class="photo-open" type="button" onclick="PrivatePhotos.open(this.querySelector('img').src)" aria-label="ขยายรูป ${i+1}"><img src="${esc(src)}" alt="รูป ${i+1}"></button><button class="text-button" type="button" onclick="removePhoto(${i})" aria-label="ลบรูป ${i+1}">${cIcon('trash-2')} ลบรูป</button></div>`).join('')}</div></details>
    <div class="actions"><button type="button" id="saveDraft">${cIcon('save')} เก็บร่าง</button><button type="submit" class="primary" ${!cycle?'disabled':''}>${cIcon('send')} ${p.revision?'ตรวจทานการแก้ไข':'ตรวจทานก่อนส่ง'}</button></div></form>`;
  const form=el('recordForm'),selections=Object.fromEntries(contextFields.map(k=>[k,form.elements.namedItem(k)?.value || '']));
  form.addEventListener('input',e=>{
    if(e.target.matches('[data-material-search]')){filterMaterials(Number(e.target.dataset.materialSearch),e.target.value);return;}
    if(!contextFields.includes(e.target.name) && !e.target.matches('[data-material] select:not([data-dose])')){persist();updateEstimates();}
  });
  form.addEventListener('change',async e=>{
    const changed=e.target.name;
    if(contextFields.includes(changed)){
      const before=capture(),value=e.target.value;before[changed]=selections[changed];
      if(C.busy){e.target.value=selections[changed];return;}
      try{if(!await changeContext(before,changed,value)){e.target.value=selections[changed];return;}render();}
      catch(error){e.target.value=selections[changed];msg('พื้นที่เครื่องเต็ม ร่างเดิมยังอยู่ กรุณาอย่าปิดหน้านี้');}
    }else if(e.target.matches('[data-material] select:not([data-dose])')){
      const row=e.target.closest('[data-material]'),p=capture(),stock=C.context.materials.find(x=>x.id===e.target.value);
      try{write('undo-'+C.assignment,draft());p.materials[Number(row.dataset.material)]={stockId:e.target.value,qty:'',unit:stock?.unit || ''};write('draft-'+C.assignment,p);render();}catch(error){msg('พื้นที่เครื่องเต็ม กรุณาตรวจรายการอีกครั้ง');}
    }else{persist();updateEstimates();if(changed==='date')render();}
  });
  form.addEventListener('invalid',e=>{e.target.closest('details')?.setAttribute('open','');},true);
  form.onsubmit=queue;el('saveDraft').onclick=()=>{if(persist())msg('เก็บร่างในเครื่องแล้ว · ยังไม่ส่งให้เจ้าของ');};
  if(el('addPoint'))el('addPoint').onclick=()=>{const p=capture();if(p.points.length>=100){msg('ได้ไม่เกิน 100 จุด');return;}p.points.push({label:'จุด '+(p.points.length+1)});write('draft-'+C.assignment,p);render();pointGo(p.points.length-1);};
  el('photos').onchange=addPhotos;
  try{write('draft-'+C.assignment,p);}catch(e){msg('พื้นที่เครื่องเต็ม ร่างยังไม่ถูกเก็บ อย่าปิดหน้านี้');}
  icons();
  updateEstimates();
}
function pointHtml(p,i){return `<details data-point="${i}" ${i===0?'open':''}><summary><span class="point-index">${i+1}</span> ${esc(p.label || 'จุด '+(i+1))}<small>${p.heightCm!=='' && p.heightCm!==undefined && p.heightCm!==null?esc(p.heightCm)+' ซม.':'ยังไม่มีความสูง'}</small></summary><div class="grid">${[['label','ชื่อจุด','text'],['heightCm','ความสูง (ซม.)','number'],['examinedPlants','ต้นที่ตรวจ (ต้น)','number'],['pestCount','แมลงที่นับ (ตัว)','number'],['affectedPlants','ต้นที่มีอาการ (ต้น)','number'],['pestName','ชนิดแมลง','text'],['symptomName','อาการที่พบ','text']].map(([k,l,t])=>`<label>${l}<input aria-label="จุด ${i+1}: ${l}" data-key="${k}" type="${t}" ${t==='number'?`min="0" step="${k==='heightCm'?'any':'1'}" inputmode="decimal"`:''} value="${esc(p[k])}"></label>`).join('')}</div><button class="text-button danger" type="button" onclick="removePoint(${i})">${cIcon('trash-2')} ลบจุดนี้</button></details>`;}
function pointGo(i){document.querySelectorAll('[data-point]').forEach(node=>node.open=Number(node.dataset.point)===i);document.querySelector(`[data-point="${i}"] summary`)?.focus();}
function wateringHtml(p){return `<label>ระยะเวลารดน้ำ (นาที) <small>ไม่บังคับ</small><input name="wateringMinutes" type="number" inputmode="numeric" min="1" max="1440" step="1" placeholder="เช่น 30" value="${esc(p.wateringMinutes??'')}"></label>`;}
function validateWatering(p){
  if(p.type!=='water' || p.wateringMinutes===undefined || p.wateringMinutes===null || String(p.wateringMinutes).trim()==='')return;
  const minutes=Number(p.wateringMinutes);
  if(!Number.isInteger(minutes) || minutes<1 || minutes>1440)throw new Error('ระยะเวลารดน้ำต้องเป็นจำนวนเต็ม 1-1440 นาที');
}
function materialMatches(catalog,query){
  const words=String(query || '').normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.filter(x=>{const label=[x.name,x.size,x.unit].join(' ').normalize('NFKC').toLocaleLowerCase();return words.every(word=>label.includes(word));});
}
function materialOptions(catalog,selected,query=''){
  const matches=materialMatches(catalog,query),current=catalog.find(x=>x.id===selected);
  return '<option value="">เลือกจากสต็อก</option>'+(selected && !current?'<option selected value="'+esc(selected)+'">รายการเดิมใช้ไม่ได้ กรุณาเลือกใหม่</option>':'')+
    (current && !matches.includes(current)?options([current],selected,x=>'ที่เลือกไว้: '+x.name+' ('+x.unit+')'):'')+
    options(matches,selected,x=>x.name+(x.size?' · '+x.size:'')+' ('+x.unit+')');
}
function filterMaterials(i,query){
  const row=document.querySelector(`[data-material="${i}"]`);if(!row)return;
  const select=row.querySelector('select'),selected=select.value,catalog=C.context.materials || [];
  select.innerHTML=materialOptions(catalog,selected,query);select.value=selected;
  const count=materialMatches(catalog,query).length;
  row.querySelector('[data-material-results]').textContent=count?'พบ '+count+' รายการ':'ไม่พบรายการที่ตรงกับคำค้น';
}
function materialsHtml(p){
  const catalog=C.context.materials || [],rows=p.materials || [];
  return `<fieldset class="material-section"><legend>ยาและปุ๋ยที่ใช้</legend><div class="material-tools"><button type="button" onclick="reusePrevious()">${cIcon('history')} ใช้รายการครั้งก่อน</button></div>${applicationWorkHtml(p)}${!catalog.length?'<p class="muted">ยังไม่มีสินค้าในรายการสต็อก</p>':''}
    ${rows.map((row,i)=>{if(row.source==='external')return externalMaterialHtml(row,i);const item=catalog.find(x=>x.id===row.stockId);return `<div class="material-row" data-material="${i}" data-unit="${esc(row.unit || item?.unit || '')}">
      <div class="material-picker"><label>ค้นหายา / ปุ๋ย รายการ ${i+1}<input type="search" data-material-search="${i}" placeholder="ชื่อยา ขนาด หรือหน่วย" autocomplete="off" aria-describedby="materialResults${i}"></label><small id="materialResults${i}" data-material-results role="status" aria-live="polite">${catalog.length} รายการ</small><label>สินค้า รายการ ${i+1}<select required aria-label="สินค้า รายการ ${i+1}">${materialOptions(catalog,row.stockId)}</select></label></div>
      <label>จำนวนใช้จริง (${esc(item?.unit || row.unit || 'หน่วย')})<input data-material-qty aria-label="จำนวนใช้ รายการ ${i+1}" type="number" inputmode="decimal" min="0.0001" step="0.0001" required value="${esc(row.qty)}"></label>
      <button type="button" class="icon-button text-button danger" onclick="removeMaterial(${i})" aria-label="ลบสินค้า รายการ ${i+1}" title="ลบรายการ">${cIcon('trash-2')}</button>${materialRateHtml(row,i)}</div>`;}).join('')}
    <div class="material-add"><button type="button" onclick="addMaterial()" ${!catalog.length || rows.length>=20?'disabled':''}>${cIcon('plus')} เพิ่มจากสต็อก</button><button type="button" onclick="addMaterial('external')" ${rows.length>=20?'disabled':''}>${cIcon('pencil')} เพิ่มนอกสต็อก</button></div></fieldset>`;
}
function materialRateHtml(row,i){
  const d=row.dose || {},select=(key,items,value)=>Object.entries(items).map(([k,v])=>`<option value="${k}" ${value===k?'selected':''}>${v}</option>`).join('');
  let structured=false;try{structured=!!ApplicationRate.cleanDose(row.dose);}catch(e){ /* Keep legacy text while a replacement ratio is incomplete. */ }
  return `<div class="material-rate"><div class="rate-heading">อัตราใช้ <small>ไม่บังคับ</small></div>${row.rate && !structured?`<label>อัตราเดิม (ข้อความ)<input data-material-rate aria-label="อัตราเดิม รายการ ${i+1}" value="${esc(row.rate)}" maxlength="120"></label>`:''}<div class="rate-grid">
    <label>ปริมาณยา/ปุ๋ย<input data-dose="amount" aria-label="ปริมาณตามอัตรา รายการ ${i+1}" type="number" inputmode="decimal" min="0.0001" max="1000000000" step="0.0001" value="${esc(d.amount??'')}"></label>
    <label>หน่วย<select data-dose="unit" aria-label="หน่วยอัตรา รายการ ${i+1}">${select('unit',ApplicationRate.units,d.unit || 'ml')}</select></label>
    <label>ต่อ<input data-dose="per" aria-label="ปริมาณฐาน รายการ ${i+1}" type="number" inputmode="decimal" min="0.0001" max="1000000000" step="0.0001" value="${esc(d.per??'')}"></label>
    <label>น้ำ / พื้นที่<select data-dose="basis" aria-label="ฐานอัตรา รายการ ${i+1}">${select('basis',ApplicationRate.bases,d.basis || 'water')}</select></label>
  </div><output class="rate-estimate" data-estimate="${i}" aria-live="polite"></output></div>`;
}
function applicationWorkHtml(p){return `<fieldset class="work-totals"><legend>ปริมาณงานจริง <small>ไม่บังคับ</small></legend><div class="grid"><label>น้ำที่ใช้ทั้งหมด (ลิตร)<input name="waterLitres" type="number" inputmode="decimal" min="0.0001" max="1000000000" step="0.0001" value="${esc(p.applicationWork?.waterLitres??'')}"></label><label>พื้นที่ที่ทำ (ไร่)<input name="areaRai" type="number" inputmode="decimal" min="0.0001" max="1000000000" step="0.0001" value="${esc(p.applicationWork?.areaRai??'')}"></label></div></fieldset>`;}
function updateEstimates(){
  if(!el('recordForm'))return;
  const p=capture();
  document.querySelectorAll('[data-estimate]').forEach(output=>{
    const m=p.materials[Number(output.dataset.estimate)];
    try{output.textContent=ApplicationRate.estimateText(m,p.applicationWork,p.workStatus);output.classList.remove('invalid');}
    catch(e){output.textContent=e.message;output.classList.add('invalid');}
  });
}
function externalMaterialHtml(row,i){
  return `<div class="material-row material-external" data-material="${i}" data-source="external"><div class="material-picker"><span class="material-source">นอกสต็อก · ไม่ตัดสต็อก</span><label>ชื่อยา / ปุ๋ย รายการ ${i+1}<input data-material-name value="${esc(row.name)}" maxlength="160" required></label></div><label>จำนวนใช้จริง รายการ ${i+1}<input aria-label="จำนวนใช้ รายการ ${i+1}" data-material-qty type="number" inputmode="decimal" min="0.0001" max="1000000000" step="0.0001" value="${esc(row.qty)}" required></label><label>หน่วย รายการ ${i+1}<input data-material-unit value="${esc(row.unit)}" maxlength="40" placeholder="เช่น ขวด กรัม มล." required></label><button type="button" class="icon-button text-button danger" onclick="removeMaterial(${i})" aria-label="ลบสินค้า รายการ ${i+1}" title="ลบรายการ">${cIcon('trash-2')}</button>${materialRateHtml(row,i)}</div>`;
}
function addMaterial(source='stock'){const p=capture();if(p.materials.length>=20)return;p.materials.push(source==='external'?{source:'external',name:'',qty:'',unit:''}:{stockId:'',qty:'',unit:''});try{write('draft-'+C.assignment,p);render();}catch(e){msg('พื้นที่เครื่องเต็ม ยังเพิ่มรายการไม่ได้');}}
function removeMaterial(i){const p=capture();try{write('undo-'+C.assignment,p);p.materials=p.materials.filter((_,n)=>n!==i);write('draft-'+C.assignment,p);render();}catch(e){msg('พื้นที่เครื่องเต็ม ยังไม่ได้ลบรายการ');}}
function removePoint(i){const p=capture();write('undo-'+C.assignment,p);p.points=p.points.filter((_,n)=>n!==i);write('draft-'+C.assignment,p);render();}
function removePhoto(i){write('undo-'+C.assignment,capture());C.photos=C.photos.filter((_,n)=>n!==i);persist();render();}
function trialHtml(p){const trials=C.context.trials.filter(t=>t.units.some(u=>u.plotId===p.plotId)),tr=trials.find(t=>t.id===p.trialId)||trials[0];if(!tr)return '<p>ยังไม่มีงานทดลองที่ได้รับมอบหมายในแปลงนี้</p>';
  const metric=tr.metrics.find(m=>m.id===p.metricId)||tr.metrics[0],constraint=`${metric.kind!=='number'?'min="0"':''} step="${metric.kind==='count'?'1':'any'}"`;
  return `<label>งานทดลอง<select name="trialId">${options(trials,tr.id)}</select></label><div class="grid"><label>แปลงย่อย<select name="unitId">${options(tr.units.filter(u=>u.plotId===p.plotId),p.unitId,u=>u.label || u.id)}</select></label><label>ตัวชี้วัด<select name="metricId">${options(tr.metrics,metric.id,m=>m.name+' ('+m.unit+')')}</select></label></div>${tr.sampling?`<fieldset><legend>จุดสุ่ม (${esc(metric.unit)})</legend><div class="grid">${Array.from({length:tr.sampleCount},(_,i)=>`<label>จุด ${i+1}<input type="number" data-sample="${i}" ${constraint} value="${esc(p.samples?.[i])}"></label>`).join('')}</div></fieldset>`:`<label>ค่าวัด (${esc(metric.unit)})<input type="number" name="value" ${constraint} value="${esc(p.value)}" required></label>`}`;
}
async function addPhotos(e){
  if(C.busy)return;C.busy=true;const assignment=C.assignment,draftId=draft().id,session=C.session;
  const current=()=>C.assignment===assignment && C.session===session && C.tab==='record' && draft().id===draftId;
  try{for(const file of e.target.files){if(C.photos.length>=3)throw new Error('แนบได้ไม่เกิน 3 รูป');if(file.size>12*1024*1024)throw new Error('รูปต้นฉบับใหญ่เกิน 12 MB');const image=await createImageBitmap(file);if(!current()){image.close();return;}const scale=Math.min(1,720/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();const src=canvas.toDataURL('image/jpeg',.5);if(src.length>150000)throw new Error('รูปยังใหญ่เกิน กรุณาเลือกรูปที่เล็กลง');C.photos.push(src);}persist();render();}
  catch(error){if(current()){persist();render();msg(error.message);}}finally{C.busy=false;}
}
function validateMaterials(materials){
  if(materials.length>20)throw new Error('เพิ่มรายการได้ไม่เกิน 20 รายการ');
  const used=new Set();
  for(const m of materials){
    ApplicationRate.materialFields(m);
    let key;
    if(m.source==='external'){
      if(m.stockId || !m.name?.trim() || !m.unit?.trim() || m.name.length>160 || m.unit.length>40)throw new Error('กรอกชื่อและหน่วยของรายการนอกสต็อก');
      key='external:'+JSON.stringify([m.name.trim().normalize('NFKC').toLowerCase(),m.unit.trim().normalize('NFKC').toLowerCase()]);
    }else{
      const stock=C.context.materials?.find(x=>x.id===m.stockId);
      if(!stock || stock.unit!==m.unit)throw new Error('สินค้าใช้ไม่ได้หรือหน่วยเปลี่ยน กรุณาเลือกรายการใหม่');key=m.stockId;
    }
    const qty=Number(m.qty);
    if(!Number.isFinite(qty) || qty<=0 || qty>1e9 || Math.abs(qty*1e4-Math.round(qty*1e4))>1e-6)throw new Error('จำนวนใช้ต้องมากกว่า 0 และมีทศนิยมไม่เกิน 4 ตำแหน่ง');
    if(used.has(key))throw new Error('รายการซ้ำ กรุณารวมจำนวนในแถวเดียว');used.add(key);
  }
}
function reviewSubmission(p){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='submission-review';dialog.setAttribute('aria-labelledby','reviewTitle');
    dialog.innerHTML=`<div class="review-body"><h2 id="reviewTitle">ตรวจทานก่อนส่ง</h2><h3>${esc(p.title)}</h3><p>${esc(dateLabel(p.date))}</p>${submissionDetails(p)}${p.note?'<p class="review-note"><strong>หมายเหตุ</strong><br>'+esc(p.note)+'</p>':''}<p class="review-notice">${p.workStatus==='failed'?'งานไม่สำเร็จ · ไม่ตัดสต็อก':p.materials?.some(m=>m.source!=='external')?'ยังไม่ตัดสต็อกจนกว่าเจ้าของจะรับรอง โดยใช้จำนวนใช้จริงที่กรอก':'รอเจ้าของตรวจรับรอง'}</p>${!navigator.onLine?'<p class="review-notice">ออฟไลน์ · เก็บในคิวแล้วส่งเมื่อมีอินเทอร์เน็ต</p>':''}</div><div class="review-actions"><button type="button" data-back>${cIcon('arrow-left')} กลับไปแก้</button><button type="button" class="primary" data-send>${cIcon('send')} ${navigator.onLine?'ยืนยันส่ง':'ยืนยันเก็บรอส่ง'}</button></div>`;
    let accepted=false;
    dialog.querySelector('[data-back]').onclick=()=>dialog.close();
    dialog.querySelector('[data-send]').onclick=()=>{accepted=true;dialog.close();};
    dialog.onclose=()=>{dialog.remove();resolve(accepted);};
    document.body.appendChild(dialog);dialog.showModal();icons();dialog.querySelector('[data-back]').focus();
  });
}
async function queue(e){e.preventDefault();if(C.busy)return;const p=capture(),assignment=C.assignment,session=C.session;let queued=false;C.busy=true;
  try{
    if(!p.cycleId)throw new Error('แปลงนี้ยังไม่มีรอบปลูกที่เปิดใช้งาน');
    const start=C.context?.cycles?.find(c=>c.id===p.cycleId)?.startDate;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(Date.parse(p.date)) || new Date(p.date).toISOString().slice(0,10)!==p.date || p.date>today() || (start && p.date<start))throw new Error('วันที่ทำงานต้องอยู่ตั้งแต่เริ่มรอบปลูกถึงวันนี้');
    validateMaterials(p.materials || []);
    validateWatering(p);
    if(['spray','fertilize'].includes(p.type)){
      p.applicationWork=ApplicationRate.cleanWork(p.applicationWork);
      p.materials=p.materials.map(m=>{const {rate,dose,...rest}=m;return {...rest,...ApplicationRate.materialFields(m)};});
      if(p.workStatus==='done')p.materials.forEach(m=>ApplicationRate.estimate(m,p.applicationWork));
    }
    if(p.type==='trial' && (!p.trialId || !(p.samples?.some(v=>v!=='') || p.value!=='')))throw new Error('กรอกผลทดลองอย่างน้อยหนึ่งจุด');
    if(p.type==='inspect' && p.workStatus==='done' && !hasResults(p))throw new Error('ยังไม่มีผลตรวจ เลือกหัวข้อที่ตรวจหรือกรอกค่าวัดก่อน');
    for(const q of p.points || [])if(q.affectedPlants!=='' && q.examinedPlants!=='' && Number(q.affectedPlants)>Number(q.examinedPlants))throw new Error('ต้นที่มีอาการต้องไม่มากกว่าต้นที่ตรวจ');
    write('draft-'+assignment,p);
    if(!await reviewSubmission(p))return;
    if(C.assignment!==assignment || C.session!==session || C.tab!=='record')return;
    const items=read('queue',[]).filter(x=>x.id!==p.id);if(items.length>=20)throw new Error('มีรายการรอส่งครบ 20 รายการแล้ว กรุณาส่งก่อน');items.push({id:p.id,grantId:assignment,revision:p.revision,payload:p});write('queue',items);queued=true;write('draft-'+assignment,{id:crypto.randomUUID(),date:today(),workStatus:'done',points:[]});C.tab='sent';C.sentOffset=0;await sent();
  }catch(error){msg(error.message);}finally{C.busy=false;}
  if(queued)await flush();
}
function reusableRows(records,p,context){return records.filter(s=>{
  if(s.status!=='approved')return false;
  const previous=JSON.parse(s.payload);
  return previous.workStatus==='done' && previous.type===p.type && previous.plotId===p.plotId && previous.materials?.length && context.types.includes(previous.type) && context.plots.some(x=>x.id===previous.plotId);
});}
function reuseDraft(p,s){
  const previous=JSON.parse(s.payload);
  return {id:crypto.randomUUID(),date:p.date,plotId:p.plotId,cycleId:p.cycleId,type:p.type,title:types[p.type],workStatus:p.workStatus || 'done',photos:[],points:[],note:'',applicationWork:{},materials:previous.materials.map(m=>{
    const fields=ApplicationRate.materialFields(m);
    return m.source==='external'?{source:'external',name:m.name,unit:m.unit,qty:'',...fields}:{stockId:m.stockId,unit:m.unit,qty:'',...fields};
  })};
}
async function reusePrevious(){
  if(C.busy)return;const p=capture(),assignment=C.assignment,session=C.session;C.busy=true;
  try{
    write('draft-'+assignment,p);
    const records=await api('team_sent',{grantId:assignment,offset:0});
    if(C.assignment!==assignment || C.session!==session || C.tab!=='record')return;
    const rows=reusableRows(records,p,C.context);
    if(!rows.length){msg('ไม่พบรายการที่รับรองแล้วของแปลงและประเภทงานนี้ใน 100 รายการล่าสุด');return;}
    const selected=await new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='submission-review';dialog.setAttribute('aria-labelledby','reuseTitle');
      dialog.innerHTML=`<div class="review-body"><h2 id="reuseTitle">ใช้รายการครั้งก่อน</h2><p>แปลง ${esc(C.context.plots.find(x=>x.id===p.plotId)?.name)} · ${esc(types[p.type])}</p>${rows.map((s,i)=>{const v=JSON.parse(s.payload);return `<article class="entry"><h3>${esc(v.title)}</h3><p>${esc(dateLabel(v.date))}</p>${v.materials.map(m=>'<p>'+esc(m.name)+(m.rate?' · '+esc(m.rate):'')+'</p>').join('')}<button type="button" data-reuse="${i}">${cIcon('copy')} ใช้รายการนี้</button></article>`;}).join('')}</div><div class="review-actions"><button type="button" data-back>ยกเลิก</button></div>`;
      let choice=null;
      dialog.querySelector('[data-back]').onclick=()=>dialog.close();
      dialog.querySelectorAll('[data-reuse]').forEach(b=>b.onclick=()=>{choice=rows[Number(b.dataset.reuse)];dialog.close();});
      dialog.onclose=()=>{dialog.remove();resolve(choice);};document.body.appendChild(dialog);dialog.showModal();icons();dialog.querySelector('[data-back]').focus();
    });
    if(!selected || C.assignment!==assignment || C.session!==session || C.tab!=='record')return;
    write('undo-'+assignment,p);write('draft-'+assignment,reuseDraft(p,selected));render();msg('สร้างร่างใหม่จากรายการครั้งก่อนแล้ว');
  }catch(e){msg('ใช้รายการครั้งก่อนไม่ได้: '+e.message);}finally{C.busy=false;}
}
async function flush(){if(C.busy || !navigator.onLine)return;C.busy=true;const session=C.session;
  let delivered=0,problem='';
  try{for(const item of [...read('queue',[])]){if(C.session!==session)break;try{const {lastError,...request}=item;await api('team_submit',request);write('queue',read('queue',[]).filter(q=>q.id!==item.id));delivered++;}catch(e){problem=e.message;write('queue',read('queue',[]).map(q=>q.id===item.id?{...q,lastError:problem}:q));if(!e.denied)break;}}
    if(problem)msg((delivered?'ส่งแล้ว '+delivered+' รายการ · ':'')+'ยังส่งไม่ได้: '+problem+' · ร่างยังอยู่ในรายการรอส่ง');else if(delivered)msg('ส่งให้เจ้าของตรวจแล้ว');
  }finally{C.busy=false;if(C.tab==='sent')await sent(true);}
}
function submissionDetails(p){
  const ctx=C.context,tr=ctx?.trials.find(t=>t.id===p.trialId),metric=tr?.metrics.find(m=>m.id===p.metricId);
  return `<p>แปลง: ${esc(ctx?.plots.find(x=>x.id===p.plotId)?.name || 'แปลงที่ส่งบันทึก')} · ${esc(types[p.type])} · ${p.workStatus==='failed'?'ไม่สำเร็จ':'สำเร็จ'}</p>${ctx?.cycles?.find(c=>c.id===p.cycleId)?'<p>รอบปลูก: '+esc(ctx.cycles.find(c=>c.id===p.cycleId).plant)+' · รอบ '+esc(ctx.cycles.find(c=>c.id===p.cycleId).round)+'</p>':''}${p.applicationWork && ApplicationRate.workText(p.applicationWork)?'<p>'+esc(ApplicationRate.workText(p.applicationWork))+'</p>':''}${p.type==='water'?'<p>ระยะเวลารดน้ำ: '+(p.wateringMinutes===null || p.wateringMinutes===undefined || p.wateringMinutes===''?'ไม่ได้ระบุ':esc(p.wateringMinutes)+' นาที')+'</p>':''}${Object.entries(p.checks || {}).filter(([,v])=>v).map(([k,v])=>`<p>${esc(checkOptions[k]?.[0] || k)}: ${esc(v)}</p>`).join('')}${(p.points || []).map(q=>`<p><b>${esc(q.label)}</b><br>ความสูง ${q.heightCm??'ยังไม่วัด'} ซม. · ตรวจ ${q.examinedPlants??'ยังไม่นับ'} ต้น<br>แมลง ${q.pestCount??'ยังไม่นับ'} ตัว${q.pestName?' ('+esc(q.pestName)+')':''} · มีอาการ ${q.affectedPlants??'ยังไม่นับ'} ต้น${q.symptomName?' ('+esc(q.symptomName)+')':''}</p>`).join('')}${(p.materials || []).map(m=>'<p>'+esc(m.name || ctx?.materials?.find(x=>x.id===m.stockId)?.name || 'สินค้าที่เลือก')+(m.source==='external'?' (นอกสต็อก · ไม่ตัดสต็อก)':'')+'<br>จำนวนใช้จริง: '+esc(m.qty)+' '+esc(m.unit)+(m.rate?'<br>อัตราใช้: '+esc(m.rate):'')+(m.dose && p.workStatus!=='failed'?'<br>'+esc(ApplicationRate.estimateText(m,p.applicationWork,p.workStatus)):'')+'</p>').join('')}${p.type==='trial'?`<p>${esc(tr?.name || 'งานทดลอง')} · ${esc(tr?.units.find(u=>u.id===p.unitId)?.label || p.unitId)}<br>${esc(metric?.name || p.metricId)}: ${esc(p.value)} ${esc(metric?.unit || '')}</p>${p.samples?'<p>'+p.samples.map((v,i)=>'จุด '+(i+1)+': '+(v===null?'ยังไม่วัด':esc(v))).join(' · ')+'</p>':''}`:''}<div class="photos">${(p.photos || []).map(src=>`<img src="${esc(src)}" alt="รูปประกอบบันทึก">`).join('')}</div>`;
}
async function sent(silent=false){const request=C.sentRequest=(C.sentRequest || 0)+1,assignment=C.assignment,session=C.session;let records=[],loaded=false;try{records=await api('team_sent',{grantId:assignment,offset:C.sentOffset || 0});loaded=true;}catch(e){if(!silent && request===C.sentRequest)msg('โหลดรายการที่ส่งไม่ได้ ตรวจการเชื่อมต่อหรือสิทธิ์');}
  if(request!==C.sentRequest || C.tab!=='sent' || C.assignment!==assignment || C.session!==session)return;C.sent=records;C.sentLoaded=loaded;renderSent();
}
function sentMatches(s,filter,context){
  const p=JSON.parse(s.payload),query=(filter.q || '').trim().toLocaleLowerCase();
  return (!filter.status || s.status===filter.status) && (!filter.plot || p.plotId===filter.plot) && (!filter.from || p.date>=filter.from) && (!filter.to || p.date<=filter.to) && (!query || [p.title,p.note,context?.plots?.find(x=>x.id===p.plotId)?.name,types[p.type]].join(' ').toLocaleLowerCase().includes(query));
}
function filterSent(){
  C.sentFilter=Object.fromEntries(['q','status','plot','from','to'].map(k=>[k,el('sent-'+k).value]));
  const f=C.sentFilter,invalid=!!(f.from && f.to && f.from>f.to);
  el('sent-to').setCustomValidity(invalid?'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น':'');
  let count=0;
  document.querySelectorAll('[data-sent-entry]').forEach(node=>{node.hidden=invalid || !sentMatches(C.sent[Number(node.dataset.sentEntry)],f,C.context);if(!node.hidden)count++;});
  el('sentResult').textContent=invalid?'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น':`พบ ${count} จาก ${C.sent.length} รายการในหน้านี้`;
}
function clearSentFilter(){C.sentFilter={};renderSent();}
function renderSent(){
  const records=C.sent || [],loaded=C.sentLoaded,f=C.sentFilter || {};
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab==='sent')));
  const pending=read('queue',[]).filter(q=>q.grantId===C.assignment);
  el('content').innerHTML=`<h2 class="queue-heading">รอส่งจากเครื่อง (${pending.length})</h2>${pending.map((q,i)=>`<article class="entry"><span class="status">${navigator.onLine?'ยังส่งไม่ถึงเจ้าของ':'รออินเทอร์เน็ต'}</span><h3>${esc(q.payload.title)}</h3><p>${esc(dateLabel(q.payload.date))} · ${esc(C.context?.plots?.find(x=>x.id===q.payload.plotId)?.name || 'แปลงเดิม')}</p>${q.lastError?'<p class="danger" role="status">'+esc(q.lastError)+'</p>':''}<button onclick="editQueue(${i})">แก้ไขร่าง</button></article>`).join('')}${pending.length?'<button onclick="flush()">ส่งรายการค้างอีกครั้ง</button>':'<p class="muted">ไม่มีรายการรอส่งจากฟาร์มนี้</p>'}<h2 class="queue-heading" id="sentHeading">ส่งถึงเจ้าของแล้ว · หน้า ${(C.sentOffset || 0)/100+1}</h2>
    <div class="sent-filters"><label>ค้นหาในหน้านี้<input id="sent-q" type="search" value="${esc(f.q || '')}" oninput="filterSent()"></label><label>สถานะ<select id="sent-status" onchange="filterSent()"><option value="">ทั้งหมด</option>${Object.entries({pending:'รอเจ้าของตรวจ',returned:'ส่งกลับแก้ไข',approved:'รับรองแล้ว'}).map(([k,v])=>'<option value="'+k+'" '+(f.status===k?'selected':'')+'>'+v+'</option>').join('')}</select></label><label>แปลง<select id="sent-plot" onchange="filterSent()"><option value="">ทุกแปลง</option>${options(C.context?.plots || [],f.plot)}</select></label><label>ตั้งแต่วันที่<input type="date" id="sent-from" value="${esc(f.from || '')}" onchange="filterSent()"></label><label>ถึงวันที่<input type="date" id="sent-to" value="${esc(f.to || '')}" onchange="filterSent()"></label><button type="button" onclick="clearSentFilter()">ล้างตัวกรอง</button></div><p id="sentResult" role="status" class="muted"></p>
    ${loaded && !records.length?'<p class="empty-state">ยังไม่มีรายการที่ส่ง</p>':''}${records.map((s,i)=>{const p=JSON.parse(s.payload);return `<article class="entry" data-sent-entry="${i}"><span class="status ${s.status}">${esc({pending:'รอเจ้าของตรวจ',returned:'ส่งกลับแก้ไข',approved:'รับรองแล้ว'}[s.status])}</span><h3>${esc(p.title)}</h3><p>${esc(dateLabel(p.date))} · ${esc(C.context?.plots?.find(x=>x.id===p.plotId)?.name || 'แปลงเดิม')} · ${esc(types[p.type])}</p>${p.note?'<p>'+esc(p.note)+'</p>':''}${s.review_note?'<p>ข้อเสนอแนะจากเจ้าของ: '+esc(s.review_note)+'</p>':''}<details><summary>ข้อมูลที่ฉันส่ง</summary>${submissionDetails(p)}</details>${sentEditAction(s,i,pending)}</article>`;}).join('')}`;
  el('content').insertAdjacentHTML('beforeend',`<div class="actions">${C.sentOffset?'<button onclick="sentPage(-1)">ก่อนหน้า</button>':''}${records.length===100?'<button onclick="sentPage(1)">ถัดไป</button>':''}</div>`);
  icons();filterSent();
  if(!loaded){el('sentHeading').textContent='รายการที่ส่งแล้ว · ยังโหลดไม่ได้';el('sentResult').textContent='ยังตรวจสอบรายการที่ส่งแล้วไม่ได้';}
}
function sentPage(step){C.sentOffset=Math.max(0,(C.sentOffset || 0)+100*step);sent();}
async function replaceDraft(){const p=draft();return !(p.title || hasResults(p)) || await confirmContext(true);}
async function editQueue(i){
  const assignment=C.assignment,session=C.session,queued=read('queue',[]).filter(x=>x.grantId===assignment)[i];
  if(C.busy || !queued || !await replaceDraft())return;
  if(C.busy || C.assignment!==assignment || C.session!==session)return;
  const all=read('queue',[]),q=all.find(x=>x.id===queued.id && x.grantId===assignment);
  if(!q){msg('รายการรอส่งเปลี่ยนไปแล้ว กรุณาโหลดรายการล่าสุด');return;}
  try{
    write('undo-'+assignment,draft());
    write('draft-'+assignment,{...q.payload,id:q.id,revision:q.revision});
    write('queue',all.filter(x=>x.id!==q.id));C.tab='record';render();
  }catch(e){msg('เปิดรายการแก้ไขไม่ได้ กรุณาตรวจพื้นที่ในเครื่อง');}
}
function sentEditAction(s,i,pending){
  if(s.status==='approved')return '<p class="locked-status">'+cIcon('lock-keyhole')+' รับรองแล้ว · แก้ไขไม่ได้</p>';
  if(!['pending','returned'].includes(s.status))return '';
  if(pending.some(q=>q.id===s.id))return '<p>มีฉบับแก้ไขอยู่ในรายการรอส่งจากเครื่อง</p>';
  return '<button onclick="editSent('+i+')">'+cIcon('pencil')+' '+(s.status==='returned'?'แก้ไขแล้วส่งใหม่':'แก้ไขรายการ')+'</button>';
}
async function editSent(i){
  const s=C.sent?.[i],assignment=C.assignment,session=C.session;if(C.busy || !s)return;
  if(!['pending','returned'].includes(s.status)){msg('รายการนี้รับรองแล้ว ไม่สามารถแก้ไขได้');return;}
  const queued=read('queue',[]).filter(q=>q.grantId===C.assignment).findIndex(q=>q.id===s.id);
  if(queued!==-1)return editQueue(queued);
  if(!await replaceDraft())return;
  if(C.busy || C.assignment!==assignment || C.session!==session)return;
  try{
    write('undo-'+C.assignment,draft());
    write('draft-'+C.assignment,{...JSON.parse(s.payload),id:s.id,revision:s.revision});
    C.tab='record';render();
  }catch(e){msg('เปิดรายการแก้ไขไม่ได้ ร่างเดิมยังอยู่ กรุณาตรวจพื้นที่ในเครื่อง');}
}
function editReturned(i){return editSent(i);}
async function logoutCollector(){
  if(C.busy)return;
  if(C.tab==='record' && !persist())return;
  const work=localWorkCount(),session=C.session;
  const accepted=await new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='context-dialog';
    dialog.innerHTML=`<h2>ออกจากระบบผู้บันทึก?</h2><p>ร่าง ${work.drafts} รายการ · รอส่ง ${work.queued} รายการ</p><p>ข้อมูลที่ยังไม่ส่งจะอยู่ในเครื่องนี้ หลังเข้าสู่บัญชีเดิมอีกครั้งจึงส่งต่อได้ เครื่องที่ใช้ร่วมกันควรส่งงานให้ครบก่อนออก</p><div><button type="button" data-cancel>กลับไปทำงาน</button><button type="button" data-confirm>ออกและเก็บร่างไว้</button></div>`;
    let value=false;dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-confirm]').onclick=()=>{value=true;dialog.close();};dialog.onclose=()=>{dialog.remove();resolve(value);};document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  });
  if(!accepted || C.session!==session || C.busy)return;
  C.busy=true;
  try{await api('logout');}catch(e){}
  localStorage.removeItem('farmult-collector-session');C.session=null;location.reload();
}
el('loginForm').onsubmit=async e=>{e.preventDefault();if(C.busy)return;C.busy=true;let loggedIn=false;try{const f=new FormData(e.target);await signedIn(await api(C.register?'register':'login',Object.fromEntries(f)));loggedIn=true;msg('');}catch(error){msg(error.message);}finally{C.busy=false;}if(loggedIn)try{await flush();}catch(error){msg('ยังส่งรายการค้างไม่ได้ · ข้อมูลยังอยู่ในเครื่อง');}};
PrivatePhotos.configure(api,()=>C.session?.token);
el('registerToggle').onclick=()=>{C.register=!C.register;el('nameField').hidden=!C.register;el('loginSubmit').textContent=C.register?'สร้างบัญชี':'เข้าสู่ระบบ';el('registerToggle').textContent=C.register?'มีบัญชีแล้ว':'สร้างบัญชีใหม่';};
el('logout').onclick=logoutCollector;
el('accept').onclick=async()=>{try{const invite=new URLSearchParams(location.hash.slice(1)).get('invite');await api('team_accept',{invite});history.replaceState(null,'',location.pathname+location.search);el('inviteBox').hidden=true;await refresh();msg('รับคำเชิญแล้ว');}catch(e){msg(e.message);}};
el('refresh').onclick=()=>{if(C.busy)return;if(C.tab==='record' && !persist())return;PrivatePhotos.retry();refresh();};
el('assignment').onchange=async()=>{if(C.busy){el('assignment').value=C.assignment;return;}if(C.tab==='record' && !persist()){el('assignment').value=C.assignment;return;}C.assignment=el('assignment').value;C.sentOffset=0;try{await loadContext();}catch(e){msg(e.message);}};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(C.busy)return;if(C.tab==='record' && !persist())return;C.tab=b.dataset.tab;msg('');render();});
window.addEventListener('online',flush);window.addEventListener('beforeunload',()=>{if(C.session && C.tab==='record')persist();});
icons();
(async()=>{try{C.session=JSON.parse(localStorage.getItem('farmult-collector-session'));if(C.session)await signedIn(C.session);}catch(e){msg(e.message);}try{const config=await api('google_config');if(config.client_id){const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=()=>{google.accounts.id.initialize({client_id:config.client_id,callback:async r=>{try{await signedIn(await api('google_login',{credential:r.credential}));}catch(e){msg(e.message);}}});google.accounts.id.renderButton(el('google'),{theme:'outline',size:'large',text:'continue_with'});};document.head.appendChild(script);}}catch(e){}if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js?v=20260928ux1').catch(()=>{});})();
