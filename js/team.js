/* Owner-side controls. Collector data is accessed only through scoped team APIs. */
function teamMaterialQtyHtml(m) {
  if (m.usageQty === undefined || m.usageQty === null) return `${esc(m.qty)} ${esc(m.unit)}`;
  const unit = ({ ml: "มล. (ซีซี)", l: "ลิตร", g: "กรัม", kg: "กก." })[m.usageUnit] || m.usageUnit || "";
  return `${esc(m.usageQty)} ${esc(unit)}<small> = ${esc(m.qty)} ${esc(m.unit)}</small>`;
}

const Team = {
  present(html) {
    const page=typeof document!=='undefined'?document.getElementById('teamPageContent'):null;
    if(typeof route==='undefined'||route.view!=='team'||!page){openModal(html);return;}
    closeModal();
    page.innerHTML=html;
    page.querySelector('.modal-x')?.remove();
    const heading=page.querySelector('h3');
    if(heading){const h=document.createElement('h1');h.innerHTML=heading.innerHTML;heading.replaceWith(h);}
    labelFormFields(page);
    if(typeof Concept!=='undefined')Concept.shell();
    if(typeof ConceptWorkflows!=='undefined')ConceptWorkflows.teamSearch();
  },
  members:[], inbox:[], busy:false, offset:0, memberOffset:0, section:'inbox', filter:'pending', counts:[], homeEpoch:0,
  async call(action,extra={}) {
    const token=Auth.session?.token,r=await authCall(action,{token,...extra});
    if(Auth.session?.token!==token)throw new Error('บัญชีเปลี่ยนแล้ว กรุณาเปิดหน้าทีมใหม่');
    if(!r.ok)throw new Error(r.error || 'ดำเนินการไม่สำเร็จ');return r.data;
  },
  async open() {
    const pageRequest=typeof route!=='undefined'&&route.view==='team',requestId=this.requestId=(this.requestId||0)+1;
    this.offset=0;
    this.present('<button class="modal-x" onclick="App.closeModal()">✕</button><h3>ทีมบันทึกข้อมูล</h3><p role="status">กำลังโหลด...</p>');
    try {this.members=await this.call('team_members',{offset:this.memberOffset});this.inbox=await this.call('team_inbox',{status:this.filter});this.counts=await this.call('team_counts');if(requestId!==this.requestId||(pageRequest&&route.view!=='team'))return;this.render();}
    catch(e){if(requestId!==this.requestId||(pageRequest&&route.view!=='team'))return;const expired=/เซสชัน/.test(String(e.message||''));this.present('<button class="modal-x" onclick="App.closeModal()">✕</button><h3>ทีมบันทึกข้อมูล</h3><p role="alert">'+esc(e.message)+'</p><button class="btn '+(expired?'btn-primary':'btn-outline')+'" onclick="'+(expired?'App.closeModal();Auth.reauthenticate()':'Team.open()')+'">'+(expired?'เข้าสู่ระบบใหม่':'ลองใหม่')+'</button>');}
  },
  openPending() { this.section='inbox'; this.filter='pending'; this.open(); },
  async renderHomeInbox() {
    const slot=document.getElementById('teamHomeInbox'),token=Auth.session?.token,epoch=++this.homeEpoch;
    if(!slot || !token)return;
    slot.innerHTML='';
    try {
      const rows=await this.call('team_inbox',{status:'pending',offset:0});
      if(epoch!==this.homeEpoch || Auth.session?.token!==token || !slot.isConnected || !rows.length)return;
      const count=rows.length===100?'100+':fmtNum(rows.length);
      slot.innerHTML=`<section class="team-home-inbox"><div><span class="team-home-eyebrow">รอตรวจจากทีม</span><h2>${count} รายการกำลังรอการรับรอง</h2><p>ตรวจรายละเอียดก่อนบันทึกเข้าประวัติฟาร์มและตัดสต็อก</p></div><button class="btn btn-primary" onclick="Team.openPending()">${ic('check')} ตรวจรับ</button></section>`;
    } catch(e) { if(epoch===this.homeEpoch && slot.isConnected)slot.innerHTML=''; }
  },
  render() {
    const statuses={pending:'รอตรวจ',returned:'ส่งกลับแก้ไข',approved:'รับรองแล้ว'};
    this.present(`<button class="modal-x" onclick="App.closeModal()">✕</button><div class="team-screen"><header class="team-heading"><div><span class="team-eyebrow">การทำงานร่วมกัน</span><h3>ทีมบันทึกข้อมูล</h3></div><button class="btn btn-primary" onclick="Team.invite()">${ic('plus')} เชิญสมาชิก</button></header>
      ${this.section==='inbox' ? `<div class="team-counts">${Object.entries(statuses).map(([k,v])=>`<div><strong>${this.counts.find(c=>c.status===k)?.count || 0}</strong><span>${v}</span></div>`).join('')}</div>` : ''}
      <nav class="team-tabs" aria-label="ส่วนจัดการทีม"><button class="btn ${this.section==='inbox'?'btn-primary':'btn-ghost'}" aria-pressed="${this.section==='inbox'}" onclick="Team.section='inbox';Team.render()">${ic('check')} ตรวจรับข้อมูล</button><button class="btn ${this.section==='members'?'btn-primary':'btn-ghost'}" aria-pressed="${this.section==='members'}" onclick="Team.section='members';Team.render()">${ic('user')} สมาชิกและสิทธิ์</button><button class="btn btn-icon btn-ghost" title="โหลดข้อมูลทีมใหม่" aria-label="โหลดข้อมูลทีมใหม่" onclick="Team.open()">${ic('refresh')}</button></nav>
      ${this.section==='members'?`<div class="team-list">${this.members.length?this.members.map((m,i)=>{const scope=JSON.parse(m.scopes);return `<article class="team-member"><div class="team-member-head"><b>${esc(m.email)}</b><span class="team-status ${m.status}">${esc(({active:'ใช้งานอยู่',invited:m.expires_at<Date.now()?'คำเชิญหมดอายุ':'รอรับคำเชิญ',revoked:'ถอนสิทธิ์แล้ว'})[m.status])}</span></div><dl class="team-permissions"><dt>แปลง</dt><dd>${scope.plots.map(id=>esc(S.plots.find(p=>p.id===id)?.name || 'แปลงที่ปิดไปแล้ว')).join(' · ')}</dd><dt>บันทึกได้</dt><dd>${scope.types.map(t=>esc(t==='trial'?'ผลทดลอง':TYPE_LABELS[t] || t)).join(' · ')}</dd></dl>${m.status!=='revoked'?`<div class="team-member-actions">${m.status==='invited'?`<button class="btn btn-outline btn-sm" onclick="Team.renewInvite(${i})">${ic('refresh')} สร้างลิงก์ใหม่</button>`:''}<button class="btn btn-outline btn-sm" onclick="Team.invite(${i})">${ic('pencil')} แก้สิทธิ์</button><button class="btn btn-ghost btn-sm" onclick="Team.revoke(${i})">ถอนสิทธิ์</button></div>`:''}</article>`;}).join(''):'<div class="team-empty"><h4>ยังไม่มีสมาชิก</h4><p>เริ่มจากเชิญผู้บันทึกคนแรก</p></div>'}</div><div class="row">${this.memberOffset?'<button class="btn btn-ghost" onclick="Team.memberPage(-1)">ก่อนหน้า</button>':''}${this.members.length===200?'<button class="btn btn-ghost" onclick="Team.memberPage(1)">ถัดไป</button>':''}</div><a class="btn btn-ghost" href="/collector">${ic('pencil')} เปิดหน้าผู้บันทึก</a>`:
      `<label class="team-filter">สถานะ<select onchange="Team.setFilter(this.value)"><option value="">ทั้งหมด</option>${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${this.filter===k?'selected':''}>${v}</option>`).join('')}</select></label><div class="team-list">${this.inbox.length?this.inbox.map((s,i)=>{const p=JSON.parse(s.payload);return `<button class="team-review-row" onclick="Team.detail(${i})"><span><b>${esc(p.title)}</b><small>${esc(s.member_name)} · ${esc(dateLabel(p.date))}</small><small>${esc(S.plots.find(x=>x.id===p.plotId)?.name || 'แปลงเดิม')} · ${esc(p.type==='trial'?'ผลทดลอง':TYPE_LABELS[p.type])}</small></span><span class="team-status ${s.status}">${statuses[s.status]}</span></button>`;}).join(''):'<div class="team-empty">'+ic('check')+'<h4>ไม่มีรายการในสถานะนี้</h4><p>รายการใหม่จากผู้บันทึกจะอยู่ในรอตรวจ</p></div>'}</div><div class="team-pagination"><span>หน้า ${this.offset/100+1}</span>${this.offset?'<button class="btn btn-ghost" onclick="Team.page(-1)">ก่อนหน้า</button>':''}${this.inbox.length===100?'<button class="btn btn-ghost" onclick="Team.page(1)">ถัดไป</button>':''}</div>`}</div>`);
  },
  async page(step){try{const offset=Math.max(0,this.offset+step*100),rows=await this.call('team_inbox',{offset,status:this.filter});this.offset=offset;this.inbox=rows;this.render();}catch(e){toast(e.message);}},
  async setFilter(value){this.filter=value;this.offset=0;await this.page(0);},
  async memberPage(step){try{const offset=Math.max(0,this.memberOffset+step*200),rows=await this.call('team_members',{offset});this.memberOffset=offset;this.members=rows;this.render();}catch(e){toast(e.message);}},
  invite(index) {
    this.editing=Number.isInteger(index)?this.members[index]:null;const m=this.editing,scope=m?JSON.parse(m.scopes):{plots:[],types:['inspect']};
    openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><div class="team-screen"><h3>${m?'แก้สิทธิ์ผู้บันทึก':'เชิญผู้บันทึก'}</h3><form onsubmit="Team.sendInvite(event)">
      <label class="field">อีเมลผู้บันทึก<input name="email" type="email" value="${esc(m?.email || '')}" ${m?'readonly':''} required maxlength="254"></label>
      <fieldset class="team-options"><legend>แปลงที่มอบหมาย</legend>${S.plots.filter(p=>p.status!=='inactive').map(p=>`<label><input type="checkbox" name="plots" value="${esc(p.id)}" ${scope.plots.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</fieldset>
      <fieldset class="team-options"><legend>ประเภทงานที่บันทึกได้</legend>${Object.entries({...TYPE_LABELS,trial:'ผลทดลอง'}).filter(([k])=>k!=='expense').map(([k,v])=>`<label><input type="checkbox" name="types" value="${k}" ${scope.types.includes(k)?'checked':''}>${esc(v)}</label>`).join('')}</fieldset>
      <p class="team-policy">${ic('eye')} เลือกชื่อวัสดุเพื่อบันทึกได้ แต่ไม่เห็นยอดคงเหลือ ต้นทุน หรือข้อมูลวิเคราะห์</p><p class="muted">${m?'การส่งครั้งถัดไปจะตรวจตามสิทธิ์ใหม่ ข้อมูลที่บันทึกแล้วจะไม่ถูกลบ':'ลิงก์ใช้ได้ครั้งเดียว ภายใน 7 วัน ผู้รับต้องใช้อีเมลนี้'}</p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button><button class="btn btn-primary" type="submit">${m?'บันทึกสิทธิ์':'สร้างคำเชิญ'}</button></div></form></div>`);
  },
  async sendInvite(e) {
    e.preventDefault();if(this.busy)return;this.busy=true;const button=e.submitter,fd=new FormData(e.target),m=this.editing;if(button)button.disabled=true;
    try {
      await Auth.saveNow();if(typeof localDirty==='function' && localDirty())throw new Error('รอข้อมูลเจ้าของซิงก์สำเร็จก่อนสร้างคำเชิญ');
      if(!fd.getAll('plots').length || !fd.getAll('types').length)throw new Error('เลือกแปลงและประเภทงานอย่างน้อยอย่างละหนึ่งรายการ');
      const r=await this.call(m?'team_update':'team_invite',{email:fd.get('email'),plots:fd.getAll('plots'),types:fd.getAll('types'),...(m?{grantId:m.id,revision:m.revision}:{})});
      if(m){closeModal();this.section='members';await this.open();toast('บันทึกสิทธิ์แล้ว');return;}
      this.showInvite(r,fd.get('email'));
    } catch(error){toast(error.message);}finally{this.busy=false;if(button)button.disabled=false;}
  },
  showInvite(r,email,renewed=false){
    const url=new URL('/collector',location.href);url.hash='invite='+r.invite;
    openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><div class="team-screen team-invite-result"><h3>${renewed?'สร้างลิงก์ใหม่แล้ว':'สร้างคำเชิญแล้ว'}</h3><p>ส่งให้ <strong>${esc(email)}</strong></p><p class="muted">ยังไม่ได้ส่งอีเมลอัตโนมัติ · ใช้ได้ครั้งเดียว<br>หมดอายุ ${esc(new Date(r.expiresAt).toLocaleString('th-TH'))}</p>${renewed?'<p role="status">ลิงก์เก่าใช้ไม่ได้แล้ว อีเมลและสิทธิ์ยังเหมือนเดิม</p>':''}<label class="field">ลิงก์คำเชิญ<input readonly id="teamInviteLink" value="${esc(url.href)}" onclick="this.select()"></label><p class="muted">หากปิดหน้าต่างแล้วลิงก์หาย สร้างลิงก์ใหม่ได้ที่ สมาชิกและสิทธิ์</p><div class="modal-actions"><button class="btn btn-ghost" onclick="Team.section='members';Team.open()">กลับรายชื่อสมาชิก</button><button class="btn btn-primary" onclick="Team.copyInvite()">${ic('copy')} คัดลอกลิงก์</button></div></div>`);
  },
  renewInvite(i){
    const m=this.members[i];if(!m || m.status!=='invited' || this.busy)return;
    App.confirm('สร้างลิงก์คำเชิญใหม่?',`ลิงก์เก่าของ ${m.email} จะใช้ไม่ได้ทันที ลิงก์ใหม่มีอายุ 7 วัน อีเมลและสิทธิ์ยังเหมือนเดิม`,async()=>{
      if(this.busy)return;this.busy=true;
      try{const r=await this.call('team_renew_invite',{grantId:m.id,revision:m.revision});m.revision=r.revision;m.expires_at=r.expiresAt;this.showInvite(r,m.email,true);}
      catch(e){await this.open();toast(e.message);}finally{this.busy=false;}
    });
  },
  async copyInvite(){const input=document.getElementById('teamInviteLink');if(!input)return;try{await navigator.clipboard.writeText(input.value);toast('คัดลอกแล้ว');}catch(e){input.focus();input.select();toast('คัดลอกอัตโนมัติไม่ได้ กดค้างที่ลิงก์แล้วเลือกคัดลอก');}},
  revoke(i){const m=this.members[i];App.confirm('ถอนสิทธิ์ผู้บันทึก?',m.email+' จะเปิดข้อมูลหรือส่งรายการใหม่ไม่ได้ ร่างที่อยู่ในเครื่องเขาไม่สามารถลบจากระยะไกลได้',async()=>{try{await this.call('team_revoke',{grantId:m.id});await this.open();}catch(e){toast(e.message);}});},
  detail(i) {
    const s=this.inbox[i],p=JSON.parse(s.payload);this.current=i;
    const tr=S.trials.find(t=>t.id===p.trialId),unit=tr?.units?.find(u=>u.id===p.unitId),metric=tr?trialMetrics(tr).find(m=>m.id===p.metricId):null;
    const treatment=tr?.treatments?.find(t=>t.id===unit?.treatmentId);
    const usesMaterials=p.workStatus==='done' && p.materials?.some(m=>m.source!=='external');
    const details=Object.entries(p.checks || {}).map(([k,v])=>v?`<div>${esc(INSPECTION_CHECKS.find(x=>x[0]===k)?.[1] || k)}: ${esc(v)}</div>`:'').join('');
    openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><div class="team-detail"><button class="btn btn-ghost btn-sm" onclick="Team.render()">${ic('chevron','team-back-icon')} กลับรายการ</button><h3>${esc(p.title)}</h3><span class="team-status ${s.status}">${esc({pending:'รอตรวจ',returned:'ส่งกลับแล้ว',approved:'รับรองแล้ว'}[s.status])}</span><dl class="team-permissions"><dt>ผู้บันทึก</dt><dd>${esc(s.member_name)}</dd><dt>วันที่</dt><dd>${esc(dateLabel(p.date))}</dd><dt>แปลง</dt><dd>${esc(plotById(S,p.plotId)?.name || p.plotId)}</dd><dt>ผลการทำงาน</dt><dd>${p.workStatus==='failed'?'ไม่สำเร็จ':'สำเร็จ'}</dd>${p.type==='water'?`<dt>รดน้ำ</dt><dd>${p.wateringMinutes===null || p.wateringMinutes===undefined?'ไม่ได้ระบุเวลา':esc(p.wateringMinutes)+' นาที'}</dd>`:''}</dl>${p.applicationWork?'<p>'+esc(ApplicationRate.workText(p.applicationWork))+'</p>':''}${p.note?'<p class="team-note">'+esc(p.note)+'</p>':''}<div class="team-checks">${details}</div>
      ${(p.points || []).map(q=>`<section class="team-point"><h4>${esc(q.label)}</h4><dl>${[['ความสูง',q.heightCm,'ซม.'],['ต้นที่ตรวจ',q.examinedPlants,'ต้น'],['แมลงที่นับ',q.pestCount,'ตัว'],['ต้นที่มีอาการ',q.affectedPlants,'ต้น']].map(([label,value,unit])=>`<div><dt>${label}</dt><dd>${value===null || value===undefined?'ยังไม่วัด':esc(value)+' <small>'+unit+'</small>'}</dd></div>`).join('')}</dl>${q.pestName?'<p>ชนิดแมลง: '+esc(q.pestName)+'</p>':''}${q.symptomName?'<p>อาการที่พบ: '+esc(q.symptomName)+'</p>':''}</section>`).join('')}
      ${p.type==='trial'?`<p>งานทดลอง: ${esc(tr?.name || p.trialId)}<br>แปลงย่อย: ${esc(treatment?.code || '')} · ${esc(unit?trialUnitDescription(tr,unit):p.unitId)}<br>ตัวชี้วัด: ${esc(metric?.name || p.metricId)}<br>${p.samples?'ค่าเฉลี่ย':'ค่าวัด'}: ${p.value} ${esc(metric?.unit || '')}${p.samples?'<br>'+p.samples.map((v,i)=>'จุด '+(i+1)+': '+(v??'ยังไม่วัด')).join(' · '):''}</p>`:''}
      ${p.materials?.length?`<section class="team-point"><h4>ยาและปุ๋ยที่ระบุ</h4>${p.materials.map(m=>`<div class="team-row"><span>${esc(m.name)}${m.rate?'<br><small>อัตราใช้: '+esc(m.rate)+'</small>':''}${m.source==='external'?' <small>นอกสต็อก · ไม่ตัดสต็อก</small>':''}</span><b>${teamMaterialQtyHtml(m)}</b></div>`).join('')}${p.workStatus==='failed'?'<p>งานไม่สำเร็จ รายการนี้ไม่ตัดสต็อก</p>':''}</section>`:''}
      <div class="inspection-photos">${(p.photos || []).map((src,i)=>`<button class="team-photo" aria-label="ขยายรูป ${i+1}" onclick="PrivatePhotos.open(this.querySelector('img').src)"><img src="${esc(src)}" alt="รูปจากผู้บันทึก"></button>`).join('')}</div>
      ${s.review_note?'<p>ข้อเสนอแนะ: '+esc(s.review_note)+'</p>':''}
      ${s.status==='pending'?`<label class="field">สิ่งที่ต้องแก้ไข <small>จำเป็นเมื่อส่งกลับแก้ไข</small><textarea id="teamReviewNote" maxlength="1000" placeholder="เช่น ระบุเวลารดน้ำ หรือแนบรูปหน้างานเพิ่ม"></textarea></label><p class="muted">${usesMaterials?'รับรองแล้วจะตัดและบันทึกต้นทุนเฉพาะรายการจากสต็อก รายการนอกสต็อกเก็บเป็นข้อมูลการใช้เท่านั้น':'รับรองแล้วจะเพิ่มกิจกรรมหรือค่าวัด ไม่ตัดสต็อกและไม่เพิ่มต้นทุน'}</p><div class="modal-actions"><button class="btn btn-outline" onclick="Team.review('return')">ส่งกลับแก้ไข</button><button class="btn btn-primary" onclick="Team.review('approve')">${ic('check')} ${usesMaterials?'รับรองและตัดสต็อก':'รับรองข้อมูล'}</button></div>`:''}
      <details><summary>ประวัติรายการ</summary><button class="btn btn-sm btn-ghost" onclick="Team.history()">โหลดประวัติ</button><div id="teamHistory"></div></details></div>`);
  },
  async history(){try{const rows=await this.call('team_history',{id:this.inbox[this.current].id});document.getElementById('teamHistory').innerHTML=rows.map(r=>`<p>${esc(new Date(r.created_at).toLocaleString('th-TH'))} · ${esc({submit:'ส่งข้อมูล',return:'ส่งกลับแก้ไข',approve:'รับรอง'}[r.event])}</p>`).join('');}catch(e){toast(e.message);}},
  async review(decision) {
    if(this.busy)return;
    const noteInput=document.getElementById('teamReviewNote'),note=noteInput?.value || '';
    if(decision==='return' && !note.trim()){
      noteInput?.setCustomValidity('กรุณาระบุสิ่งที่ต้องแก้ไขก่อนส่งกลับ');
      noteInput?.reportValidity();noteInput?.focus();return;
    }
    noteInput?.setCustomValidity('');this.busy=true;const s=this.inbox[this.current];
    try {
      // Sync pending owner edits before a server-side atomic review updates the owner's state.
      await Auth.saveNow();if(typeof localDirty==='function' && localDirty())throw new Error('ข้อมูลในเครื่องยังไม่ซิงก์ กรุณาซิงก์ก่อนตรวจรับ');
      await this.call('team_review',{id:s.id,revision:s.revision,decision,note,confirmMaterials:true});
      closeModal();await Auth.saveNow();await this.open();toast(decision==='approve'?'รับรองข้อมูลแล้ว':'ส่งกลับแก้ไขแล้ว');
    }catch(e){toast(e.message);}finally{this.busy=false;}
  }
};
PrivatePhotos.configure((action,p)=>Team.call(action,p),()=>Auth.session?.token);
