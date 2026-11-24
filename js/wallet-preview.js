/* Isolated UI prototype: no app state, persistence, or network writes. */
'use strict';
const WalletPreview = (() => {
  function cents(value) {
    const raw=String(value).trim();
    if(!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) throw new Error('ใส่จำนวนเงินมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง');
    const [whole,fraction='']=raw.split('.');
    const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if(n<=0)throw new Error('จำนวนเงินต้องมากกว่า 0 บาท');
    return n;
  }
  function dateValid(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  }
  function ledger(rows) {
    let balance=0;
    return [...rows].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order).map(row=>{
      if(!row.voided)balance+=row.kind==='in'?row.cents:-row.cents;
      return {...row,balance};
    });
  }
  function validate(rows,row,today) {
    if(!['in','out'].includes(row.kind)||!Number.isSafeInteger(row.cents)||row.cents<=0)throw new Error('จำนวนเงินไม่ถูกต้อง');
    if(!row.title.trim())throw new Error('กรุณาระบุรายการ');
    if(!dateValid(row.date)||row.date>today)throw new Error('ใช้วันที่รับหรือจ่ายเงินจริง ไม่เกินวันนี้');
    const result=ledger([...rows.filter(r=>r.id!==row.id),row]);
    if(result.some(r=>r.balance<0))throw new Error('เงินไม่พอในวันที่จ่าย ตรวจยอดรับเงินและวันที่ก่อนบันทึก');
    return result;
  }
  function validatePhotos(existing,files) {
    if(existing.length+files.length>6)throw new Error('แนบได้สูงสุด 6 รูปต่อรายการ');
    for(const file of files){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('รองรับเฉพาะ JPG, PNG และ WebP กรุณาแปลง HEIC หรือ PDF เป็นรูปก่อน');
      if(!file.size||file.size>10*1024*1024)throw new Error('แต่ละรูปต้องมีขนาดไม่เกิน 10 MB และไม่ใช่ไฟล์ว่าง');
    }
    if([...existing,...files].reduce((sum,f)=>sum+f.size,0)>30*1024*1024)throw new Error('รูปทั้งหมดในรายการต้องมีขนาดรวมไม่เกิน 30 MB');
  }
  function start() {
    const $=id=>document.getElementById(id);
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}),month=today.slice(0,7);
    const day=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
    const sample=()=>[
      ['in',2000000,'รับเงินสำหรับดูแลฟาร์ม','เจ้าของฟาร์ม',-7,'transfer','งบค่าใช้จ่ายประจำเดือน'],
      ['out',150000,'ซื้อปุ๋ย 15-15-15','ร้านเกษตร',-6,'transfer','2 กระสอบ'],
      ['out',180000,'ค่าแรงเตรียมแปลง A','ทีมงานแปลง A',-4,'cash','จ่ายค่าแรง 3 คน'],
      ['out',85000,'น้ำมันเครื่องสูบน้ำ','สถานีบริการ',-2,'cash',''],
      ['in',300000,'รับเงินเพิ่มสำหรับระบบน้ำ','เจ้าของฟาร์ม',-1,'transfer',''],
      ['out',58000,'ซื้อยาดูแลแปลง','ร้านเกษตร',0,'transfer','จ่ายค่าสินค้าแล้ว'],
      ['out',42000,'อุปกรณ์ซ่อมระบบน้ำ','ร้านวัสดุ',0,'cash','ข้อต่อและสายยาง']
    ].map(([kind,amount,title,party,offset,method,note],i)=>({id:String(i+1),order:i+1,kind,cents:amount,title,party,date:day(offset),method,note,
      ...(i===5?{lark:{project:'แปลง A · ข้อมูลสมมติ',purpose:'ซื้อยาดูแลแปลง A (ตัวอย่างเท่านั้น)',category:WalletLarkPreview.categories[2],source:'เงินสดย่อย',vat:'ไม่แน่ใจ (ให้การเงินช่วยเช็ค)',asset:'ไม่ใช่'}}:{})}));
    let rows=sample(),filter='all',hidden=false,editing=null,kind='in',seq=8,toastTimer;
    let draftPhotos=[],photoBusy=false,photoSession=0;
    const photoUrls=new Set();
    const money=n=>(n/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
    const show=n=>hidden?'••••••':money(n);
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const dateText=d=>new Date(d+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
    const larkInputs={project:'larkProject',purpose:'larkPurpose',category:'larkCategory',source:'larkSource',vat:'larkVat',asset:'larkAsset'};
    for(const [id,options] of [['larkCategory',WalletLarkPreview.categories],['larkSource',WalletLarkPreview.sources],['larkVat',WalletLarkPreview.vats],['larkAsset',WalletLarkPreview.assets]]){
      $(id).innerHTML='<option value="">ยังไม่ระบุ</option>'+options.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
    }
    const larkValues=()=>Object.fromEntries(Object.entries(larkInputs).map(([key,id])=>[key,$(id).value.trim()]));
    $('openLark').href=WalletLarkPreview.url;
    $('closeLark').onclick=()=>$('larkDialog').close();
    $('checkLark').onclick=()=>{
      $('formError').textContent='';
      try{
        const plan=WalletLarkPreview.plan({kind,voided:!!rows.find(r=>r.id===editing)?.voided,cents:cents($('amount').value),title:$('title').value,date:$('date').value,method:$('method').value,party:$('party').value,note:$('note').value,lark:larkValues(),photos:draftPhotos});
        $('larkMapping').innerHTML=Object.entries(plan.fields).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(key.startsWith('วันที่')?dateText($('date').value):key==='จำนวนเงิน (THB)'?money(cents($('amount').value))+' บาท':value)}</dd></div>`).join('');
        $('larkMissing').innerHTML=plan.missing.map(value=>`<li>${esc(value)}</li>`).join('');$('larkDialog').showModal();
      }catch(error){$('formError').textContent=error.message;$('formError').scrollIntoView({block:'nearest'});}
    };
    const monthText=m=>new Date(m+'-01T12:00:00').toLocaleDateString('th-TH',{month:'long',year:'numeric'});
    // Same Feather icon shapes used by the owner workspace.
    const icon=name=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+({eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',theme:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',close:'<path d="m18 6-12 12M6 6l12 12"/>'}[name])+'</svg>';
    $('privacy').innerHTML=icon('eye');$('theme').innerHTML=icon('theme');$('closeDialog').innerHTML=icon('close');$('searchIcon').innerHTML=icon('search');
    $('date').max=today;
    function toast(message){$('toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').textContent='';},4000);}
    function confirmPreview(message){
      return new Promise(resolve=>{
        const dialog=$('confirmDialog');$('confirmMessage').textContent=message;
        const finish=result=>{dialog.close();resolve(result);};
        $('cancelConfirm').onclick=()=>finish(false);$('acceptConfirm').onclick=()=>finish(true);
        dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();$('cancelConfirm').focus();
      });
    }
    function months(){const selected=$('month').value||month;const values=[...new Set([month,...rows.map(r=>r.date.slice(0,7))])].sort().reverse();$('month').innerHTML='<option value="all">ทุกช่วงเวลา</option>'+values.map(m=>`<option value="${m}">${monthText(m)}</option>`).join('');$('month').value=values.includes(selected)||selected==='all'?selected:month;}
    function releasePhotos(){
      const used=new Set([...rows.flatMap(r=>r.photos||[]),...draftPhotos].map(p=>p.url));
      for(const url of photoUrls)if(!used.has(url)){URL.revokeObjectURL(url);photoUrls.delete(url);}
    }
    function renderPhotos(){
      const readonly=!!rows.find(r=>r.id===editing)?.voided;
      $('photoCount').textContent=`(${draftPhotos.length}/6)`;
      $('addPhotos').hidden=readonly;$('addPhotos').disabled=photoBusy||draftPhotos.length>=6;
      $('submitEntry').disabled=photoBusy;
      $('photoList').innerHTML=draftPhotos.map((p,i)=>`<figure class="photo-item"><button type="button" class="photo-thumb" data-photo="${i}" aria-label="ขยายรูป ${esc(p.name)}"><img src="${esc(p.url)}" alt="${esc(p.name)}"></button><figcaption class="photo-caption"><span title="${esc(p.name)}">${esc(p.name)}</span>${readonly?'':`<button type="button" class="photo-remove" data-remove-photo="${i}" aria-label="เอารูป ${esc(p.name)} ออก" title="เอารูปออก">×</button>`}</figcaption></figure>`).join('');
      $('photoStatus').textContent=photoBusy?'กำลังอ่านรูป…':draftPhotos.length?'รูปอยู่ในพรีวิวนี้เท่านั้น ยังไม่ได้อัปโหลด':'ยังไม่มีรูปหลักฐาน';
    }
    function readPhoto(file){
      const url=URL.createObjectURL(file);photoUrls.add(url);
      return new Promise((resolve,reject)=>{
        const img=new Image();
        const finish=error=>{clearTimeout(timer);img.onload=img.onerror=null;if(error){URL.revokeObjectURL(url);photoUrls.delete(url);reject(new Error(error));}else resolve({name:file.name,type:file.type,size:file.size,url});};
        const timer=setTimeout(()=>finish('อ่านรูปนานเกินไป กรุณาลองรูปอื่น'),10000);
        img.onload=()=>finish(img.naturalWidth*img.naturalHeight>40000000?'รูปมีความละเอียดสูงเกินไป กรุณาย่อให้ไม่เกิน 40 ล้านพิกเซล':null);
        img.onerror=()=>finish('เปิดรูปไม่ได้ ไฟล์อาจเสียหรือชนิดไฟล์ไม่ตรง');img.src=url;
      });
    }
    $('addPhotos').onclick=()=>$('photoFiles').click();
    $('photoFiles').onchange=async()=>{
      const files=[...$('photoFiles').files];$('photoFiles').value='';if(!files.length||photoBusy)return;
      const session=photoSession;const added=[];$('photoError').textContent='';
      try{
        validatePhotos(draftPhotos,files);photoBusy=true;renderPhotos();
        for(const file of files){
          added.push(await readPhoto(file));
          if(session!==photoSession){for(const p of added){URL.revokeObjectURL(p.url);photoUrls.delete(p.url);}return;}
        }
        draftPhotos.push(...added);
      }catch(error){if(session===photoSession)$('photoError').textContent=error.message;}
      finally{if(session===photoSession){photoBusy=false;releasePhotos();renderPhotos();}}
    };
    $('photoList').onclick=e=>{
      const preview=e.target.closest('[data-photo]'),remove=e.target.closest('[data-remove-photo]');
      if(preview){const p=draftPhotos[Number(preview.dataset.photo)];$('fullPhoto').src=p.url;$('fullPhoto').alt=p.name;$('photoTitle').textContent=p.name;$('photoDialog').showModal();}
      if(remove&&!photoBusy){draftPhotos.splice(Number(remove.dataset.removePhoto),1);releasePhotos();renderPhotos();}
    };
    $('closePhoto').onclick=()=>$('photoDialog').close();
    $('photoDialog').onclose=()=>$('fullPhoto').removeAttribute('src');
    $('entryDialog').onclose=()=>{photoSession++;draftPhotos=[];photoBusy=false;releasePhotos();};
    function render(){
      const ordered=ledger(rows),balance=ordered.at(-1)?.balance||0;
      $('balance').textContent=show(balance);$('balanceDate').textContent='ณ วันที่ '+dateText(today);$('summaryMonth').textContent=monthText(month);
      ['in','out'].forEach(k=>{$(k==='in'?'income':'expense').textContent=show(rows.filter(r=>!r.voided&&r.kind===k&&r.date.startsWith(month)).reduce((n,r)=>n+r.cents,0));});
      const query=$('search').value.trim().toLocaleLowerCase('th');
      const visible=ordered.reverse().filter(r=>(filter==='all'||r.kind===filter)&&($('month').value==='all'||r.date.startsWith($('month').value))&&[r.title,r.party,r.note].join(' ').toLocaleLowerCase('th').includes(query));
      $('resultCount').textContent=visible.length+' รายการ';
      let lastDate='';
      $('entries').innerHTML=visible.map(r=>{const heading=lastDate!==r.date?`<h3 class="day-heading">${r.date===today?'วันนี้ · ':''}${dateText(r.date)}</h3>`:'';lastDate=r.date;return heading+`<button class="entry ${r.voided?'voided':''}" data-id="${r.id}" aria-label="ดูรายละเอียด ${esc(r.title)}"><span class="direction ${r.kind==='in'?'incoming':'outgoing'}" aria-hidden="true">${r.kind==='in'?'↙':'↗'}</span><span><span class="entry-title">${esc(r.title)}${r.voided?'<span class="void-tag">ยกเลิกแล้ว</span>':''}</span><span class="entry-meta">${esc(r.party||'ไม่ระบุชื่อ')} · ${r.method==='cash'?'เงินสด':'โอนเงิน'}</span></span><span class="entry-money"><strong class="${r.kind==='in'?'positive':'negative'}">${hidden?'••••••':(r.kind==='in'?'+':'−')+money(r.cents)}</strong><small>คงเหลือ ${show(r.balance)}</small></span><span class="row-chevron" aria-hidden="true">›</span></button>`;}).join('')||'<div class="empty">ไม่พบรายการในช่วงนี้<button id="clearFilters">ล้างตัวกรอง</button></div>';
      for(const button of $('entries').querySelectorAll('[data-id]')){
        const row=visible.find(r=>r.id===button.dataset.id);
        if(row.photos?.length)button.querySelector('.entry-meta').append(` · หลักฐาน ${row.photos.length} รูป`);
      }
      document.querySelectorAll('.segments button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
    }
    function after(){
      const current=ledger(rows).at(-1)?.balance||0,original=rows.find(r=>r.id===editing);let amount=0;
      try{amount=cents($('amount').value);}catch{}
      const base=current-(original&&!original.voided?(original.kind==='in'?original.cents:-original.cents):0);
      const next=base+(original?.voided?0:(kind==='in'?amount:-amount));
      $('afterBalance').innerHTML=`<span>${original?.voided?'ยอดคงเหลือปัจจุบัน':'ยอดคงเหลือรวมหลังบันทึก'}</span><strong>${money(next)} บาท</strong>`;
    }
    function open(entryKind,id=null){
      const r=rows.find(x=>x.id===id);editing=id;kind=r?.kind||entryKind;$('entryForm').reset();$('formError').textContent='';
      $('dialogTitle').textContent=r?.voided?'รายการที่ยกเลิกแล้ว':(r?'แก้ไข · ':'')+(kind==='in'?'รับเงินเข้า':'จ่ายเงิน');
      for(const name of ['title','party','note','method','date'])$(name).value=r?.[name]||(name==='date'?today:name==='method'?'transfer':'');
      $('amount').value=r?(r.cents/100).toFixed(2):'';$('partyLabel').textContent=kind==='in'?'รับเงินจาก':'ผู้รับเงิน';
      $('larkDetails').hidden=kind!=='out';$('larkDetails').open=false;$('checkLark').disabled=!!r?.voided;
      for(const [key,id] of Object.entries(larkInputs))$(id).value=r?.lark?.[key]||'';
      $('title').placeholder=kind==='in'?'เช่น รับเงินสำหรับดูแลฟาร์ม':'เช่น ซื้อปุ๋ยสำหรับแปลง A';
      $('voidEntry').hidden=!r||r.voided;$('submitEntry').hidden=!!r?.voided;
      for(const el of $('entryForm').querySelectorAll('input,select,textarea'))el.disabled=!!r?.voided;
      photoSession++;draftPhotos=[...(r?.photos||[])];photoBusy=false;$('photoError').textContent='';renderPhotos();
      after();$('entryDialog').showModal();(r?.voided?$('closeDialog'):$('amount')).focus();
    }
    $('receive').onclick=()=>open('in');$('pay').onclick=()=>open('out');$('closeDialog').onclick=()=>$('entryDialog').close();
    $('entries').onclick=e=>{const b=e.target.closest('[data-id]');if(b)open('in',b.dataset.id);if(e.target.id==='clearFilters'){filter='all';$('search').value='';$('month').value='all';render();}};
    $('amount').oninput=after;
    $('entryForm').onsubmit=e=>{
      e.preventDefault();$('formError').textContent='';
      if(photoBusy){$('formError').textContent='รออ่านรูปให้เสร็จก่อนบันทึก';return;}
      try{
        const original=rows.find(r=>r.id===editing);
        if(original?.voided)throw new Error('รายการนี้ถูกยกเลิกแล้ว');
        const r={id:editing||String(seq),order:original?.order||seq,kind,cents:cents($('amount').value),date:$('date').value,title:$('title').value.trim(),party:$('party').value.trim(),note:$('note').value.trim(),method:$('method').value,photos:[...draftPhotos]};
        if(kind==='out')r.lark=larkValues();
        validate(rows,r,today);rows=[...rows.filter(x=>x.id!==r.id),r];if(!editing)seq++;
        months();$('month').value=r.date.slice(0,7);filter='all';$('search').value='';render();$('entryDialog').close();toast('บันทึกตัวอย่างแล้ว · คงเหลือ '+show(ledger(rows).at(-1).balance)+' บาท');
      }catch(error){$('formError').textContent=error.message;}
    };
    $('voidEntry').onclick=async()=>{
      if(!await confirmPreview('ยกเลิกรายการตัวอย่างนี้? ยอดเงินจะคำนวณใหม่ และยังเก็บรายการไว้ในประวัติ'))return;
      const r={...rows.find(x=>x.id===editing),voided:true};
      try{validate(rows,r,today);rows=rows.map(x=>x.id===r.id?r:x);render();$('entryDialog').close();toast('ยกเลิกรายการตัวอย่างแล้ว');}catch(error){$('formError').textContent=error.message;}
    };
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$('search').oninput=render;$('month').onchange=render;
    $('privacy').onclick=()=>{hidden=!hidden;$('privacy').setAttribute('aria-pressed',String(hidden));const label=hidden?'แสดงจำนวนเงิน':'ซ่อนจำนวนเงิน';$('privacy').setAttribute('aria-label',label);$('privacy').title=label;render();};
    $('theme').onclick=()=>{const dark=document.body.classList.toggle('dark');$('theme').setAttribute('aria-label',dark?'สลับโหมดสว่าง':'สลับโหมดมืด');$('theme').title=dark?'สลับโหมดสว่าง':'สลับโหมดมืด';};
    $('reset').onclick=async()=>{if(!await confirmPreview('เริ่มข้อมูลตัวอย่างใหม่? รายการที่ลองกรอกและรูปหลักฐานในหน้านี้จะถูกล้าง'))return;rows=sample();releasePhotos();seq=8;filter='all';$('search').value='';$('month').value=month;months();render();toast('เริ่มข้อมูลตัวอย่างใหม่แล้ว');};
    months();render();
  }
  return {cents,dateValid,ledger,validate,validatePhotos,start};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletPreview;
else WalletPreview.start();
