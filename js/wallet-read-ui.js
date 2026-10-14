'use strict';
(()=>{
  const M={...WalletLarkRead,...(WalletAccess.context||WalletAccess.legacyContext||{})},$=id=>document.getElementById(id),storage=WalletAccess.storage;
  const member=!!WalletAccess.context;
  const lockButton=document.createElement('button');lockButton.id='lockWallet';lockButton.className='icon-btn';lockButton.title='ล็อกกระเป๋า';lockButton.setAttribute('aria-label','ล็อกกระเป๋า');lockButton.innerHTML='<i data-lucide="lock-keyhole"></i>';document.querySelector('.top-actions').prepend(lockButton);
  const legacyKey=WalletAccess.context?.storageBase||`farm-wallet-read-v1:${M.target.app}:${M.target.table}:${M.target.team}`,key=legacyKey.replace('-v1:','-v2:');
  if(WalletAccess.context){document.querySelector('.page-heading .eyebrow').textContent=M.owner.name;document.querySelector('.preview-tag').textContent='พรีวิว · กระเป๋าส่วนตัว Lark';$('payerSelect').disabled=true;$('refreshPayers').hidden=true;}
  else{const link=document.createElement('a');link.className='text-btn';link.href='/wallet-preview.html?mode=lark';link.textContent='กระเป๋าส่วนตัวด้วย Lark';document.querySelector('.wallet-navigation').append(link);}
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
  const empty=()=>({opening:null,income:[],expenses:[],syncedAt:null});
  let book={selected:M.owner.id,wallets:{}},state=empty(),legacy=null,cacheError='',filter='all',hidden=false,busy=false,formMode='income',editing=null,selected=null,payers=[],epoch=0,controller;
  let departmentView='current',departmentSaving=false,departmentOptions='',formScope='';
  const funds=()=>member?M.departmentFunds(state):state;
  const activeTeam=()=>member?funds().team:M.target.team;
  const summary=()=>member?M.departmentTotals(state):M.totals(state);
  const shownExpenses=()=>{const t=summary();return member&&departmentView==='other'?t.otherExpenses:member&&departmentView==='review'?t.unassignedExpenses:t.expenses;};
  const deduction=row=>!member||!!activeTeam()&&row.team===activeTeam();
  const deductionLabel=row=>deduction(row)?'หักแล้ว ไม่รออนุมัติ':!M.validTeam(row.team)?'รอตรวจสอบแผนก · ไม่หักยอด':'ไม่หักกระเป๋านี้';
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>(n/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const amount=n=>hidden?'••••••':money(n);
  const date=d=>new Date(d+'T12:00:00Z').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
  const icons=()=>window.lucide?.createIcons();
  const printToolbar=document.createElement('button');printToolbar.className='text-btn';printToolbar.innerHTML='<i data-lucide="printer"></i> ใบรับรองแทนใบเสร็จ';printToolbar.onclick=()=>WalletReceipt.open({expenses:shownExpenses()});document.querySelector('.list-heading').append(printToolbar);
  const printEntry=document.createElement('button');printEntry.className='text-btn';printEntry.innerHTML='<i data-lucide="printer"></i> พิมพ์ใบรับรอง';printEntry.onclick=()=>{const row=state.expenses.find(r=>r.id===selected);if(row){$('detailDialog').close();WalletReceipt.open({expenses:shownExpenses(),selectedIds:[row.id]});}};$('detailDialog').querySelector('.form-footer').prepend(printEntry);
  let staged=[],kept=[],formUrls=[],detailUrls=[],detailRun=0,saving=false;
  const imageCache=WalletImageCache.create();
  const photoScope=()=>key+':'+book.selected+(member?':department:'+encodeURIComponent(activeTeam()||''):'');
  const revoke=urls=>{urls.forEach(u=>URL.revokeObjectURL(u));urls.length=0;};
  function clearEvidence(){++detailRun;revoke(detailUrls);$('evidenceGallery').replaceChildren();$('detailEvidence').hidden=true;$('evidenceStatus').textContent='';}
  function showImage(url,name){$('evidenceImage').src=url;$('evidenceImage').alt=name;$('imageTitle').textContent=name;$('imageDialog').showModal();}
  function renderFormPhotos(){
    revoke(formUrls);$('fundPhotos').innerHTML=[...kept.map((p,i)=>({name:p.name,index:i,kind:'kept'})),...staged.map((p,i)=>({name:p.name,index:i,kind:'staged',url:URL.createObjectURL(p)}))].map(p=>{if(p.url)formUrls.push(p.url);return `<div class="photo-item">${p.url?`<img class="photo-thumb" src="${p.url}" alt="${esc(p.name)}">`:'<span class="photo-caption">รูปที่บันทึกไว้</span>'}<span class="photo-caption">${esc(p.name)}</span><button type="button" class="photo-remove" data-photo-kind="${p.kind}" data-photo-index="${p.index}" aria-label="นำรูป ${esc(p.name)} ออกจากรายการ">×</button></div>`;}).join('');
  }
  async function showEvidence(row,out){
    clearEvidence();const run=detailRun,scope=photoScope(),payer=book.selected,photos=out?(row.attachments||[]):(row.photos||[]);
    $('detailEvidence').hidden=false;$('evidenceStatus').textContent=photos.length?(out?'หลักฐานจาก Lark':'รูปที่เก็บในเบราว์เซอร์นี้'):'ยังไม่มีรูปแนบ';
    const jobs=photos.map(p=>{
      const item=document.createElement('div');item.className='photo-item';item.textContent=p.name+' · กำลังโหลด';$('evidenceGallery').append(item);
      return {p,item};
    });
    async function load({p,item}){
      if(out&&!p.previewable){item.textContent=p.name+' · เปิดไฟล์นี้ใน Lark';return;}
      if(out&&p.size>10*1024*1024){item.textContent=p.name+' · รูปใหญ่เกิน 10 MB กรุณาเปิดใน Lark';return;}
      try{
        let blob;if(out){const query=new URLSearchParams({payer,record:row.id,index:p.index,file:p.id});blob=await imageCache.get(scope+':'+query,async()=>{const res=await WalletAccess.fetch('/__wallet/attachment?'+query,{method:'POST',headers:{'X-Wallet-Preview':'1'},signal:AbortSignal.timeout(55000)});if(!res.ok){const data=await res.json();throw new Error(data.error||'อ่านรูปไม่สำเร็จ');}const result=await res.blob();if(!M.imageType(result.type))throw new Error('รูปแบบไฟล์ไม่รองรับ');return result;});}
        else blob=await WalletEvidence.get(p.id,scope,row.id);
        if(run!==detailRun)return;const url=URL.createObjectURL(blob);detailUrls.push(url);item.replaceChildren();const button=document.createElement('button');button.type='button';button.className='evidence-open';button.setAttribute('aria-label','ดูรูป '+p.name);const img=document.createElement('img');img.className='photo-thumb';img.alt=p.name;img.src=url;button.append(img);button.onclick=()=>showImage(url,p.name);const caption=document.createElement('span');caption.className='photo-caption';caption.textContent=p.name;item.append(button,caption);
      }catch(error){if(run!==detailRun)return;item.textContent=p.name+' · '+error.message;const retry=document.createElement('button');retry.type='button';retry.className='text-btn';retry.textContent='ลองโหลดใหม่';retry.onclick=()=>{item.textContent=p.name+' · กำลังโหลด';load({p,item});};item.append(retry);}
    }
    let cursor=0;
    async function worker(){while(run===detailRun&&cursor<jobs.length)await load(jobs[cursor++]);}
    await Promise.all(Array.from({length:Math.min(3,jobs.length)},worker));
  }
  function validCache(s){
    const row=r=>r&&typeof r.id==='string'&&typeof r.title==='string'&&Number.isSafeInteger(r.cents)&&r.cents>0&&M.validDate(r.date);
    return s&&M.validDepartments(s.departments)&&Array.isArray(s.income)&&s.income.every(row)&&Array.isArray(s.expenses)&&s.expenses.every(row)&&(!s.opening||(M.validDate(s.opening.date)&&Number.isSafeInteger(s.opening.cents)&&s.opening.cents>=0))&&(!s.syncedAt||Number.isFinite(Date.parse(s.syncedAt)));
  }
  try{
    const raw=storage.getItem(key);if(raw){const saved=JSON.parse(raw);if(!saved||typeof saved.wallets!=='object'||(saved.selected&&!M.validPayer(saved.selected))||!Object.entries(saved.wallets).every(([id,s])=>M.validPayer(id)&&validCache(s)&&s.expenses.every(r=>r.payerIds?.includes(id))))throw new Error('cache');book=saved;state=book.wallets[book.selected]||empty();}
  }catch{cacheError='อ่านข้อมูลกระเป๋าในเครื่องไม่ได้ ยังไม่เขียนทับข้อมูลเดิม';}
  try{const raw=storage.getItem(legacyKey);if(raw){const old=JSON.parse(raw);if(validCache(old))legacy=old;}}catch{/* Keep the original unmodified if it cannot be read. */}
  let writingBook=false;
  async function saveBook(next){if(cacheError)throw new Error(cacheError);if(writingBook)throw new Error('กำลังบันทึกข้อมูล กรุณาลองอีกครั้ง');writingBook=true;try{await storage.setItem(key,JSON.stringify(next));book=next;}catch{throw new Error('บันทึกในเครื่องไม่สำเร็จ ข้อมูลเดิมยังอยู่');}finally{writingBook=false;}}
  async function commit(next){if(!M.validPayer(book.selected))throw new Error('เลือกผู้จ่ายก่อนบันทึก');await saveBook({...book,wallets:{...book.wallets,[book.selected]:next}});state=next;}
  const commitFunds=changes=>commit(member?M.updateDepartmentFunds(state,changes):{...state,...changes});
  const payerName=()=>payers.find(p=>p.id===book.selected)?.name||book.wallets[book.selected]?.payerName||(book.selected===M.owner.id?M.owner.name:'ผู้จ่ายที่เลือก');
  function renderDepartment(){
    if(!member)return;
    $('departmentScope').hidden=false;$('departmentTabs').hidden=false;$('departmentListSummary').hidden=false;
    const teams=[...new Set([...state.expenses.map(r=>r.team),...(state.departments?.wallets||[]).map(w=>w.team),M.defaultTeam].filter(M.validTeam))].sort((a,b)=>a.localeCompare(b));
    const signature=JSON.stringify([teams,activeTeam()]);
    if(departmentOptions!==signature){departmentOptions=signature;$('departmentSelect').innerHTML='<option value="">เลือกแผนก</option>'+teams.map(team=>`<option value="${esc(team)}">${esc(team)}</option>`).join('')+'<option value="__custom__">ระบุแผนกอื่น…</option>';$('departmentSelect').value=activeTeam()||'';$('customDepartmentLabel').hidden=true;$('customDepartment').required=false;}
    $('departmentTitle').textContent=activeTeam()?'กระเป๋า: '+activeTeam():'กระเป๋านี้ใช้เงินของแผนกไหน?';
    $('departmentStatus').textContent=activeTeam()?'หักเฉพาะรายการแผนกนี้ · เงินเข้าและยอดยกมาแยกจากแผนกอื่น':'เลือกแผนกก่อนคำนวณยอดเงิน';
    const pending=busy||saving||writingBook||departmentSaving;
    $('departmentSelect').disabled=pending;$('saveDepartment').disabled=pending;$('customDepartment').disabled=pending;
    $('unassignedFundsNotice').hidden=!state.income.length&&!state.opening;
    document.querySelector('.demo-notice').textContent='FIN-EXPENSE (Phase 1) · อ่านอย่างเดียว · เงินเข้าเก็บเฉพาะเบราว์เซอร์นี้';
    document.querySelector('#expenseTotal').previousElementSibling.textContent='รายจ่ายแผนกนี้';
  }
  function render(){
    const t=summary(),current=funds(),chosen=!!book.selected&&(!member||!!activeTeam()),known=chosen&&!!state.syncedAt;
    renderDepartment();
    $('balance').textContent=known?amount(t.balance):'—';
    document.querySelector('.balance-card').classList.toggle('warning-balance',known&&t.balance<0);
    $('balanceLabel').textContent=current.opening?'เงินคงเหลือ':'ยอดสุทธิจากรายการ';
    $('balanceHint').textContent=!chosen?(member?'เลือกแผนกก่อนดูยอด':'เลือกผู้จ่ายก่อนดูยอด'):!known?'รออ่านรายจ่ายของคนนี้จาก Lark':!current.opening?'เงินเข้า − เงินออก · ไม่รวมยอดก่อนเริ่มบันทึก':t.balance<0?'รายจ่ายมากกว่าเงินที่บันทึกไว้':'ยอดตั้งต้น + เงินเข้า − เงินออก';
    $('period').textContent=!chosen?(member?'ยังไม่เลือกแผนก':'ยังไม่เลือกผู้จ่าย'):current.opening?'ตั้งแต่ '+date(current.opening.date):'ยังไม่รวมยอดยกมา';
    $('openingButton').textContent=current.opening?'แก้ยอดยกมา':'เพิ่มยอดยกมา (ถ้ามี)';$('openingButton').disabled=!chosen||busy||departmentSaving;$('receive').disabled=!chosen||busy||departmentSaving;
    $('summaryTitle').textContent=member?(activeTeam()||'ยังไม่เลือกแผนก'):chosen?payerName():'ยอดของผู้จ่ายที่เลือก';
    $('incomeTotal').textContent=chosen?amount(t.received):'—';$('expenseTotal').textContent=known?amount(t.paid):'—';
    $('syncStatus').textContent=busy?'กำลังอัปเดตรายจ่าย…':!book.selected?'ยังไม่เลือกผู้จ่าย':state.syncedAt?'อัปเดต '+new Date(state.syncedAt).toLocaleString('th-TH'):'ยังไม่ได้อ่านรายจ่ายของคนนี้';$('sync').disabled=busy||!book.selected||departmentSaving;
    const oldSum=(legacy?.income||[]).reduce((s,r)=>s+r.cents,0);
    $('legacyNotice').hidden=!legacy||(!legacy.income.length&&!legacy.opening);
    $('legacyText').textContent=`เงินเข้าเดิม ${amount(oldSum)} บาท แยกไว้ ยังไม่รวมกระเป๋ารายคน`;
    const absent=t.expenses.filter(r=>r.missing).length,unusual=t.expenses.filter(r=>r.date>today()||['Cancelled','Rejected'].includes(r.approval)).length;
    $('reconcileWarning').hidden=!absent&&!unusual;$('reconcileWarning').textContent=[absent?`${absent} รายการไม่อยู่ในผลอ่านล่าสุด ยังคงยอดหักเดิม รอตรวจสอบ`:'',unusual?`${unusual} รายการวันที่ล่วงหน้าหรือสถานะยกเลิก/ตีกลับ ยังคงหักตามการจ่ายจริง`:'' ].filter(Boolean).join(' · ');
    const query=$('search').value.trim().toLowerCase();
    if(member){
      $('currentDepartmentCount').textContent=t.expenses.length+t.income.length;$('otherDepartmentCount').textContent=t.otherExpenses.length;$('reviewDepartmentCount').textContent=t.unassignedExpenses.length;
      document.querySelectorAll('[data-department-view]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.departmentView===departmentView));b.disabled=!chosen;});
      $('departmentListSummary').textContent=!chosen?'ยังไม่คำนวณยอดจนกว่าจะเลือกแผนก':departmentView==='other'?'จ่ายให้แผนกอื่น '+amount(t.otherPaid)+' บาท · ไม่หักกระเป๋านี้':departmentView==='review'?'ไม่ระบุแผนก '+amount(t.unassignedPaid)+' บาท · ยังไม่หักยอด':'รายจ่าย '+amount(t.paid)+' บาท · หักเฉพาะ '+activeTeam();
      document.querySelector('.filters .segments').hidden=departmentView!=='current';
    }
    const rows=(chosen?[...shownExpenses().map(r=>({...r,kind:'out'})),...(!member||departmentView==='current'?t.income.map(r=>({...r,kind:'in'})):[])]:[]).filter(r=>(filter==='all'||r.kind===filter)&&[r.title,r.reference||'',r.team||''].join(' ').toLowerCase().includes(query)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    printToolbar.disabled=!chosen||!shownExpenses().length;
    $('resultCount').textContent=rows.length+' รายการ';let last='';
    $('entries').innerHTML=rows.map(r=>{const head=last!==r.date?`<h3 class="day-heading">${date(r.date)}</h3>`:'';last=r.date;const excluded=r.kind==='out'&&!deduction(r);return head+`<button class="entry${excluded?' not-deducted':''}" data-id="${esc(r.id)}" data-kind="${r.kind}"><span class="direction ${r.kind==='in'?'incoming':'outgoing'}" aria-hidden="true"><i data-lucide="${r.kind==='in'?'arrow-down-left':'arrow-up-right'}"></i></span><span><span class="entry-title">${esc(r.title)}</span><span class="entry-meta">${r.kind==='out'?'Lark'+(r.reference?' · '+esc(r.reference):''):'รับเงินเพิ่ม'}${member&&r.kind==='out'?' · '+esc(r.team||'ไม่ระบุแผนก'):''}${r.missing?' · ต้องตรวจสอบ':''}${r.dateBasis==='requested'?' · ใช้วันที่ขอ':''}</span></span><span class="entry-money"><strong>${hidden?'••••••':(r.kind==='in'?'+':excluded?'':'−')+money(r.cents)}</strong><small>${r.kind==='out'?(excluded?(M.validTeam(r.team)?'ไม่หักกระเป๋านี้':'รอตรวจสอบ · ไม่หักยอด'):'หักแล้ว'):'เงินเข้า'}</small></span><i class="row-chevron" data-lucide="chevron-right"></i></button>`;}).join('')||`<div class="empty">${!chosen?(member?'เลือกแผนกด้านบนเพื่อเปิดกระเป๋า':'เลือกชื่อผู้จ่ายเพื่อดูรายการของคนนั้น'):query||filter!=='all'?'ไม่พบรายการตามตัวกรอง':!known?'ยังไม่มีข้อมูลจาก Lark':'ไม่มีรายการในขอบเขตนี้'}</div>`;
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));icons();
  }
  async function api(url,signal){const res=await WalletAccess.fetch(url,{method:'POST',headers:{'X-Wallet-Preview':'1'},signal});const data=await res.json().catch(()=>{throw new Error('เปิดพรีวิวผ่านพอร์ต 4208 เพื่ออ่าน Lark');});if(!res.ok)throw new Error(data.error||'อ่าน Lark ไม่สำเร็จ');return data;}
  async function loadPayers(){
    $('refreshPayers').disabled=true;
    try{
      const data=await api('/__wallet/payers',AbortSignal.timeout(50000));if(data.source?.app!==M.target.app||data.source?.table!==M.target.table||data.source?.team!==M.target.team||!Array.isArray(data.payers)||!data.payers.every(p=>M.validPayer(p.id)&&typeof p.name==='string'))throw new Error('รายชื่อผู้จ่ายไม่สมบูรณ์');
      payers=data.payers;const choices=[...payers];if(book.selected&&!choices.some(p=>p.id===book.selected))choices.push({id:book.selected,name:book.wallets[book.selected]?.payerName||'ผู้จ่ายเดิม (ไม่พบในรายชื่อล่าสุด)'});
      $('payerSelect').innerHTML='<option value="">เลือกชื่อผู้จ่าย</option>'+choices.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${choices.filter(c=>c.name===p.name).length>1?' · '+esc(p.id.slice(-6)):''}</option>`).join('');$('payerSelect').value=book.selected;
      $('scopeHint').textContent=(WalletAccess.context?'เฉพาะรายการที่คุณเป็นผู้จ่าย ไม่รวมรายการของคนอื่น':'เฉพาะผู้จ่ายที่เลือกในทีม '+M.target.team)+(data.unassigned?` · ${data.unassigned} รายการยังไม่ระบุผู้จ่าย ไม่รวมในยอด`:'');
    }catch(error){$('syncError').textContent=error.message;$('payerSelect').innerHTML=book.selected?`<option value="${esc(book.selected)}">${esc(payerName())}</option>`:'<option value="">อ่านรายชื่อไม่สำเร็จ</option>';}
    finally{$('refreshPayers').disabled=false;render();}
  }
  async function sync(){
    if(busy||saving||writingBook||departmentSaving||$('fundDialog').open||!book.selected)return;const id=book.selected,run=++epoch,requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),50000);busy=true;$('syncError').textContent='';render();
    try{
      const data=await api('/__wallet/lark?payer='+encodeURIComponent(id),requestController.signal);if(run!==epoch||book.selected!==id)return;
      if(data.source?.app!==M.target.app||data.source?.table!==M.target.table||data.source?.team!==M.target.team||data.source?.payerId!==id||!Array.isArray(data.expenses)||!data.expenses.every(r=>r.payerIds?.includes(id))||!Number.isFinite(Date.parse(data.fetchedAt)))throw new Error('ข้อมูลไม่ตรงกับผู้จ่ายที่เลือก');
      const next={...state,payerName:payerName(),expenses:M.reconcile(state.expenses,data.expenses),syncedAt:data.fetchedAt};if(!validCache(next))throw new Error('ข้อมูล Lark ไม่สมบูรณ์');await commit(next);
    }catch(error){if(run===epoch)$('syncError').textContent=(error.name==='AbortError'?'Lark ตอบช้า กรุณาลองใหม่':error.message)+(state.syncedAt?' · คงข้อมูลล่าสุดที่อ่านสำเร็จ':'');}
    finally{clearTimeout(timeout);if(run===epoch){busy=false;render();}}
  }
  $('payerSelect').onchange=async()=>{
    const id=$('payerSelect').value;if(id&&!payers.some(p=>p.id===id)&&!book.wallets[id])return;
    try{await saveBook({...book,selected:id});}catch(error){$('syncError').textContent=error.message;$('payerSelect').value=book.selected;return;}
    ++epoch;controller?.abort();busy=false;state=book.wallets[id]||empty();filter='all';$('search').value='';$('syncError').textContent='';render();sync();
  };
  $('departmentSelect').onchange=()=>{const custom=$('departmentSelect').value==='__custom__';$('customDepartmentLabel').hidden=!custom;$('customDepartment').required=custom;$('departmentError').textContent='';if(custom)$('customDepartment').focus();};
  $('departmentForm').onsubmit=async event=>{
    event.preventDefault();if(!member||busy||saving||writingBook||departmentSaving||$('fundDialog').open)return;
    const team=$('departmentSelect').value==='__custom__'?$('customDepartment').value.trim():$('departmentSelect').value;
    departmentSaving=true;$('departmentError').textContent='';render();
    try{await commit(M.selectDepartment(state,team));departmentView='current';filter='all';$('search').value='';departmentOptions='';}
    catch(error){$('departmentError').textContent=error.message;}
    finally{departmentSaving=false;render();}
  };
  document.querySelectorAll('[data-department-view]').forEach(button=>button.onclick=()=>{departmentView=button.dataset.departmentView;filter='all';$('search').value='';render();});
  function openFunds(mode,id=null){
    if(!book.selected||busy||departmentSaving||member&&!activeTeam())return;formMode=mode;editing=id;formScope=photoScope();const current=funds(),row=mode==='opening'?current.opening:current.income.find(r=>r.id===id);
    staged=[];kept=[...(row?.photos||[])];renderFormPhotos();$('fundEvidence').hidden=mode==='opening';$('restoreLegacy').hidden=!(legacy?.deletedIncome?.length);$('saveFund').disabled=false;
    $('fundForm').reset();$('fundTitle').textContent=mode==='opening'?'ยอดยกมาก่อนเริ่มวันแรก':id?'แก้ไขเงินเข้า':'รับเงินเพิ่ม';
    $('fundHint').textContent=payerName()+' · '+(member?activeTeam()+' · ':'')+(mode==='opening'?'ยอดก่อนรับ–จ่ายของวันเริ่มต้น รายการก่อนวันที่นี้จะไม่รวมในยอด':'บันทึกเฉพาะกระเป๋านี้ในเบราว์เซอร์นี้');
    $('fundNameLabel').hidden=mode==='opening';$('fundName').required=mode!=='opening';$('fundName').value=row?.title||'';
    $('amount').value=row?(row.cents/100).toFixed(2):'';$('fundDate').value=row?.date||today();$('fundDate').max=today();$('fundError').textContent='';$('fundDialog').showModal();$('amount').focus();
  }
  $('fundForm').onsubmit=async e=>{
    e.preventDefault();if(saving)return;saving=true;$('saveFund').disabled=true;let added=[];
    try{
      if(formScope!==photoScope())throw new Error('กระเป๋าเปลี่ยน กรุณาเปิดแบบฟอร์มใหม่');
      const current=funds();
      const cents=M.money($('amount').value,formMode==='opening'),d=$('fundDate').value;if(!M.validDate(d)||d>today())throw new Error('ระบุวันที่จริง ไม่เกินวันนี้');
      if(formMode==='opening'){if(current.income.some(r=>r.date<d))throw new Error('เลือกวันเริ่มต้นก่อนหรือเท่ารายการเงินเข้าแรก');await commitFunds({opening:{cents,date:d}});}
      else{if(current.opening&&d<current.opening.date)throw new Error('วันที่เงินเข้าต้องไม่ก่อนวันที่เริ่มกระเป๋า');const title=$('fundName').value.trim();if(!title)throw new Error('กรุณาระบุรายการ');WalletEvidence.validate(kept,staged);const id=editing||'income-'+crypto.randomUUID();added=staged.length?await WalletEvidence.put(formScope,id,staged):[];if(formScope!==photoScope())throw new Error('กระเป๋าเปลี่ยน กรุณาเปิดรายการใหม่');const row={id,title,cents,date:d,photos:[...kept,...added]};await commitFunds({income:[...current.income.filter(r=>r.id!==row.id),row]});added=[];}
      $('fundDialog').close();render();
    }catch(error){await WalletEvidence.remove(added.map(p=>p.id)).catch(()=>{});$('fundError').textContent=error.message;}finally{saving=false;$('saveFund').disabled=false;render();}
  };
  $('addFundPhotos').onclick=()=>{if(!saving)$('fundPhotoFiles').click();};
  $('fundPhotoFiles').onchange=()=>{if(saving){$('fundPhotoFiles').value='';return;}try{const files=Array.from($('fundPhotoFiles').files);WalletEvidence.validate([...kept,...staged],files);staged.push(...files);renderFormPhotos();$('fundError').textContent='';}catch(error){$('fundError').textContent=error.message;}$('fundPhotoFiles').value='';};
  $('fundPhotos').onclick=e=>{const b=e.target.closest('[data-photo-kind]');if(!b||saving)return;(b.dataset.photoKind==='kept'?kept:staged).splice(Number(b.dataset.photoIndex),1);renderFormPhotos();};
  $('fundDialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  $('fundDialog').addEventListener('close',()=>{revoke(formUrls);staged=[];kept=[];});
  $('imageDialog').addEventListener('close',()=>$('evidenceImage').removeAttribute('src'));
  $('closeImage').onclick=()=>$('imageDialog').close();
  $('detailDialog').addEventListener('close',clearEvidence);
  function detail(title,values){clearEvidence();printEntry.hidden=$('sourceLink').hidden;$('deleteLegacy').hidden=true;$('detailTitle').textContent=title;$('detail').innerHTML=values.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');$('detailDialog').showModal();}
  $('viewUnassignedFunds').onclick=()=>{$('sourceLink').hidden=true;$('editIncome').hidden=true;detail('เงินเดิมที่ยังไม่จัดสรรแผนก',[['ขอบเขต','เก็บแยกไว้ ไม่รวมยอดของแผนกใด'],...(state.opening?[['ยอดยกมาเดิม',amount(state.opening.cents)+' บาท']]:[]),...state.income.map(r=>[date(r.date)+' · '+r.title,amount(r.cents)+' บาท'])]);};
  $('viewLegacy').onclick=()=>{$('sourceLink').hidden=true;$('editIncome').hidden=true;detail('เงินเดิมที่ยังไม่จัดสรร',[['ขอบเขต','แยกจากกระเป๋ารายคน ยังไม่รวมยอด'],...(legacy?.opening?[['ยอดยกมาเดิม',amount(legacy.opening.cents)+' บาท']]:[]),...(legacy?.income||[]).map(r=>[date(r.date)+' · '+r.title,amount(r.cents)+' บาท'])]);$('deleteLegacy').hidden=!legacy?.income.length;};
  let deleteSnapshot='';
  $('deleteLegacy').onclick=()=>{deleteSnapshot=storage.getItem(legacyKey);const old=JSON.parse(deleteSnapshot);$('deleteLegacyMessage').textContent=`ลบเงินเข้าเดิม ${money(old.income.reduce((s,r)=>s+r.cents,0))} บาท ออกจากรายการที่ยังไม่จัดสรร?`;$('deleteLegacyError').textContent='';$('deleteLegacyDialog').showModal();};
  $('cancelDeleteLegacy').onclick=()=>$('deleteLegacyDialog').close();
  $('confirmDeleteLegacy').onclick=async()=>{try{if(storage.getItem(legacyKey)!==deleteSnapshot)throw new Error('ข้อมูลเปลี่ยนจากหน้าต่างอื่น กรุณาเปิดรายการใหม่');const old=JSON.parse(deleteSnapshot);if(!validCache(old))throw new Error('ข้อมูลเดิมไม่สมบูรณ์');const next=M.discardLegacyIncome(old);await storage.setItem(legacyKey,JSON.stringify(next));legacy=next;$('deleteLegacyDialog').close();$('detailDialog').close();render();}catch(error){$('deleteLegacyError').textContent=error.message;}};
  $('restoreLegacy').onclick=async()=>{try{const old=JSON.parse(storage.getItem(legacyKey));if(!validCache(old))throw new Error('อ่านข้อมูลเดิมไม่ได้');const next={...old,income:[...old.income,...(old.deletedIncome||[])],deletedIncome:[]};if(!validCache(next))throw new Error('ข้อมูลที่กู้คืนไม่สมบูรณ์');await storage.setItem(legacyKey,JSON.stringify(next));legacy=next;$('restoreLegacy').hidden=true;render();}catch(error){$('fundError').textContent=error.message;}};
  $('entries').onclick=e=>{const button=e.target.closest('[data-id]');if(!button)return;const out=button.dataset.kind==='out',row=(out?state.expenses:funds().income).find(r=>r.id===button.dataset.id);if(!row)return;selected=row.id;$('sourceLink').hidden=!out;$('sourceLink').href=M.baseUrl+'&record='+encodeURIComponent(row.id);$('editIncome').hidden=out;detail(row.title,[['เจ้าของกระเป๋า',payerName()],...(member?[['แผนก',out?row.team||'ไม่ระบุใน Lark':activeTeam()]]:[]),['จำนวนเงิน',amount(row.cents)+' บาท'],[row.dateBasis==='requested'?'วันที่ขอ (ยังไม่ระบุวันที่จ่าย)':'วันที่',date(row.date)],...(out?[['เลขอ้างอิง',row.reference||'ไม่ระบุ'],['วิธีจ่าย',row.paymentMethod||'ไม่ระบุใน Lark'],['สถานะอนุมัติ',row.approval||'ไม่ระบุ'],['การคิดยอด',deductionLabel(row)]]:[])]);};
  $('entries').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;const out=b.dataset.kind==='out',row=(out?state.expenses:funds().income).find(r=>r.id===b.dataset.id);if(row)showEvidence(row,out);});
  $('editIncome').onclick=()=>{$('detailDialog').close();openFunds('income',selected);};$('closeDetail').onclick=()=>$('detailDialog').close();$('closeFund').onclick=()=>{if(!saving)$('fundDialog').close();};
  $('openingButton').onclick=()=>openFunds('opening');$('receive').onclick=()=>openFunds('income');$('newExpense').href=M.baseUrl;$('sync').onclick=sync;$('refreshPayers').onclick=async()=>{await loadPayers();sync();};
  $('search').oninput=render;document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
  $('privacy').onclick=()=>{hidden=!hidden;$('privacy').setAttribute('aria-pressed',String(hidden));$('privacy').setAttribute('aria-label',hidden?'แสดงจำนวนเงิน':'ซ่อนจำนวนเงิน');$('privacy').title=hidden?'แสดงจำนวนเงิน':'ซ่อนจำนวนเงิน';$('privacy').innerHTML=`<i data-lucide="${hidden?'eye-off':'eye'}"></i>`;render();};
  $('theme').onclick=()=>{const dark=document.body.classList.toggle('dark');$('theme').setAttribute('aria-label',dark?'สลับโหมดสว่าง':'สลับโหมดมืด');$('theme').title=dark?'สลับโหมดสว่าง':'สลับโหมดมืด';$('theme').innerHTML=`<i data-lucide="${dark?'sun':'moon'}"></i>`;icons();};
  render();loadPayers().then(sync);setInterval(()=>{if(!document.hidden)sync();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});window.addEventListener('online',()=>loadPayers().then(sync));
})();
