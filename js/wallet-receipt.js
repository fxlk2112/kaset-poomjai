'use strict';
const WalletReceipt=(()=>{
  const T=typeof WalletReceiptTemplate!=='undefined'?WalletReceiptTemplate:require('./wallet-receipt-template.js');
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sum=a=>a.reduce((s,n)=>s+n,0),width=sum(T.cols),height=sum(T.rows);
  function thaiAmount(cents){
    if(!Number.isSafeInteger(cents)||cents<0)throw new Error('จำนวนเงินไม่ถูกต้อง');
    const digits=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'],places=['','สิบ','ร้อย','พัน','หมื่น','แสน'];
    function words(n){if(n>=1000000)return words(Math.floor(n/1000000))+'ล้าน'+(n%1000000===1?'เอ็ด':n%1000000?words(n%1000000):'');const str=String(n);return [...str].map((d,i)=>{const v=Number(d),p=str.length-i-1;if(!v)return '';if(p===1)return (v===1?'':v===2?'ยี่':digits[v])+'สิบ';if(p===0&&v===1&&str.length>1)return 'เอ็ด';return digits[v]+places[p];}).join('');}
    const whole=Math.floor(cents/100),fraction=cents%100;return (whole?words(whole):'ศูนย์')+'บาท'+(fraction?words(fraction)+'สตางค์':'ถ้วน');
  }
  function date(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw new Error('วันที่รายการไม่ถูกต้อง');const [y,m,day]=d.split('-').map(Number);return `${day}/${m}/${String(y+543).slice(-2)}`;}
  function wrap(text,max,measure){
    const lines=[];let line='';for(const ch of new Intl.Segmenter('th',{granularity:'grapheme'}).segment(String(text))){if(ch.segment==='\n'){lines.push(line);line='';continue;}if(line&&measure(line+ch.segment)>max){lines.push(line);line='';}line+=ch.segment;}lines.push(line);return lines;
  }
  function paginate(entries,measure=s=>s.length*11){
    const pages=[];let page={lines:[],entries:[]};
    for(const e of entries){date(e.date);if(!Number.isSafeInteger(e.cents)||e.cents<=0)throw new Error('จำนวนเงินรายการไม่ถูกต้อง');
      const desc=wrap(e.title,361,measure),notes=wrap(e.paymentMethod?.trim()||'ไม่ระบุ',123,measure),count=Math.max(desc.length,notes.length);
      if(count>18)throw new Error('รายละเอียดรายการยาวเกินหนึ่งหน้า กรุณาเปิดตรวจสอบต้นฉบับ');
      if(page.lines.length+count>18){pages.push(page);page={lines:[],entries:[]};}
      page.entries.push(e);for(let i=0;i<count;i++)page.lines.push({description:desc[i]||'',note:notes[i]||'',date:i?'':date(e.date),amount:i?'':(e.cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})});
    }
    if(page.lines.length)pages.push(page);return pages;
  }
  function position(ref){const [,c,r]=ref.match(/^([A-J])(\d+)$/);return {c:c.charCodeAt(0)-65,r:Number(r)-1};}
  function pageHTML(page,profile){
    const values={I8:'',I12:'',C29:profile.name,H29:profile.position};
    for(let i=0;i<18;i++){const line=page.lines[i]||{};for(const [c,k] of [['B','date'],['C','description'],['H','amount'],['I','note']])values[c+(i+8)]=line[k]||'';}
    const total=page.entries.reduce((s,e)=>s+e.cents,0);if(!Number.isSafeInteger(total))throw new Error('ยอดรวมมากเกินไป');
    const dates=page.entries.map(e=>e.date).sort();values.B27='( '+thaiAmount(total)+' )';values.H27=(total/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});values.E31=date(dates[0]);values.G31=date(dates.at(-1));
    const merges=new Map(),skip=new Set();for(const range of T.merges){const [a,b]=range.split(':'),start=position(a),end=position(b);merges.set(a,end);for(let r=start.r;r<=end.r;r++)for(let c=start.c;c<=end.c;c++){const ref=String.fromCharCode(65+c)+(r+1);if(ref!==a)skip.add(ref);}}
    // Excel lets these certification sentences flow across adjacent blank cells.
    for(const [a,b] of [['B30','I30'],['B31','C31'],['F29','G29']]){merges.set(a,position(b));const start=position(a),end=position(b);for(let c=start.c+1;c<=end.c;c++)skip.add(String.fromCharCode(65+c)+(start.r+1));}
    let html='';for(let r=0;r<41;r++)for(let c=0;c<10;c++){
      const ref=String.fromCharCode(65+c)+(r+1);if(skip.has(ref))continue;const cell=T.cells[ref]||{style:0,value:''},s=T.styles[cell.style],end=merges.get(ref)||{r,c};
      const w=sum(T.cols.slice(c,end.c+1)),h=sum(T.rows.slice(r,end.r+1)),b={...s.borders};
      const corner=T.cells[String.fromCharCode(65+end.c)+(end.r+1)];if(corner){const edge=T.styles[corner.style].borders;if(edge.right)b.right=edge.right;if(edge.bottom)b.bottom=edge.bottom;}
      const content=values[ref]??cell.value,align=c===7&&r>=7&&r<=26?'right':s.align||'left';
      const css=`left:${sum(T.cols.slice(0,c))}px;top:${sum(T.rows.slice(0,r))}px;width:${w+1}px;height:${h+1}px;background:${s.fill};color:${s.color};font-size:${s.size}px;font-weight:${s.bold?700:400};text-align:${align};`+Object.entries(b).map(([edge,value])=>`border-${edge}:${value};`).join('');
      html+=`<div class="receipt-cell" data-cell="${ref}" ${Object.hasOwn(values,ref)?'data-filled="true"':''} style="${css}"><span>${escape(content)}</span></div>`;
    }
    return `<article class="receipt-paper"><div class="receipt-sheet" style="width:${width}px;height:${height}px">${html}<img class="receipt-logo" src="assets/wallet-receipt/logo.png" alt="" style="left:${T.logo.x}px;top:${T.logo.y}px;width:${T.logo.width}px;height:${T.logo.height}px"></div></article>`;
  }
  let dialog,rows=[],chosen=new Set();const settingsKey=()=>WalletAccess.profileKey||'farm-wallet-receipt-profile-v1';
  function init(){
    if(dialog)return;const css=document.createElement('link');css.rel='stylesheet';css.href='css/wallet-receipt.css';css.onload=()=>{if(dialog.open)render();};document.head.append(css);
    dialog=document.createElement('dialog');dialog.id='receiptDialog';dialog.setAttribute('aria-label','ใบรับรองแทนใบเสร็จรับเงิน');
    dialog.innerHTML=`<header class="receipt-toolbar"><h2>ใบรับรองแทนใบเสร็จรับเงิน</h2><button id="receiptClose" class="icon-btn" aria-label="ปิดหน้าพิมพ์">×</button></header><div class="receipt-layout"><section class="receipt-controls"><label>ผู้เบิกจ่าย<input id="receiptName" maxlength="60"></label><label>ตำแหน่ง<input id="receiptPosition" maxlength="70"></label><div class="receipt-dates"><label>ตั้งแต่<input id="receiptFrom" type="date"></label><label>ถึง<input id="receiptTo" type="date"></label></div><div class="receipt-select-actions"><button id="receiptSelect" class="text-btn">เลือกที่แสดง</button><button id="receiptClear" class="text-btn">ล้างการเลือก</button></div><div id="receiptOptions"></div></section><section class="receipt-preview"><div id="receiptSummary" role="status"></div><div id="receiptPages"></div></section></div><footer class="receipt-toolbar"><span id="receiptError" role="alert"></span><button id="receiptPrint" class="action-btn receive"><i data-lucide="printer"></i> พิมพ์ / บันทึก PDF</button></footer>`;
    document.body.append(dialog);const area=document.createElement('div');area.id='receiptPrintArea';document.body.append(area);
    new ResizeObserver(()=>{const panel=dialog.querySelector('.receipt-preview');$('receiptPages').style.setProperty('--receipt-zoom',Math.min(1,Math.max(.2,(panel.clientWidth-32)/793.7008)));}).observe(dialog.querySelector('.receipt-preview'));
    const $=id=>document.getElementById(id);let profile={name:WalletAccess.context?.owner.name||T.cells.C29.value.trim(),position:WalletAccess.context?'':T.cells.H29.value.trim()};try{const saved=JSON.parse(WalletAccess.storage.getItem(settingsKey()));if(saved&&typeof saved.name==='string'&&typeof saved.position==='string')profile=saved;}catch{}
    $('receiptName').value=profile.name;$('receiptPosition').value=profile.position;
    $('receiptClose').onclick=()=>dialog.close();
    for(const id of ['receiptName','receiptPosition'])$(id).oninput=render;
    for(const id of ['receiptFrom','receiptTo'])$(id).onchange=options;
    $('receiptSelect').onclick=()=>{visible().forEach(e=>chosen.add(e.id));options();};$('receiptClear').onclick=()=>{chosen.clear();options();};
    $('receiptOptions').onchange=e=>{const id=e.target.dataset.receiptId;if(!id)return;e.target.checked?chosen.add(id):chosen.delete(id);render();};
    $('receiptPrint').onclick=async()=>{if(!render())return;try{await document.fonts.ready;await Promise.all([...$('receiptPrintArea').querySelectorAll('img')].map(img=>img.decode()));await WalletAccess.storage.setItem(settingsKey(),JSON.stringify({name:$('receiptName').value.trim(),position:$('receiptPosition').value.trim()}));document.body.classList.add('printing-wallet-receipt');window.print();}catch{$('receiptError').textContent='โหลดฟอนต์หรือโลโก้ไม่สำเร็จ กรุณาลองใหม่';}};
    window.addEventListener('afterprint',()=>document.body.classList.remove('printing-wallet-receipt'));
    dialog.addEventListener('close',()=>{document.body.classList.remove('printing-wallet-receipt');$('receiptPrintArea').replaceChildren();});
  }
  const $=id=>document.getElementById(id);
  function visible(){const from=$('receiptFrom').value,to=$('receiptTo').value;return rows.filter(e=>(!from||e.date>=from)&&(!to||e.date<=to));}
  function options(){$('receiptOptions').innerHTML=visible().map(e=>`<label class="receipt-option"><input type="checkbox" data-receipt-id="${escape(e.id)}" ${chosen.has(e.id)?'checked':''}><span>${escape(e.title)}<small>${date(e.date)} · ${(e.cents/100).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท · วิธีจ่าย: ${escape(e.paymentMethod?.trim()||'ไม่ระบุ')}${e.dateBasis==='requested'?' · ใช้วันที่ขอ':''}${e.missing?' · ไม่พบในผลอ่านล่าสุด':''}</small></span></label>`).join('')||'<p>ไม่มีรายการในช่วงวันที่นี้</p>';render();}
  function render(){
    const picked=rows.filter(e=>chosen.has(e.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));$('receiptError').textContent='';$('receiptPrint').disabled=true;$('receiptPrintArea').replaceChildren();
    if(!picked.length){$('receiptSummary').textContent='ยังไม่ได้เลือกรายจ่าย';$('receiptPages').innerHTML='';return false;}
    try{
      if($('receiptFrom').value&&$('receiptTo').value&&$('receiptFrom').value>$('receiptTo').value)throw new Error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');
      const profile={name:$('receiptName').value.trim(),position:$('receiptPosition').value.trim()},canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='21px Calibri, Tahoma, sans-serif';
      const pages=paginate(picked,s=>ctx.measureText(s).width),html=pages.map(p=>pageHTML(p,profile)).join('');
      $('receiptSummary').textContent=`เลือก ${picked.length} รายการ · ${pages.length} หน้า · รวม ${(picked.reduce((s,e)=>s+e.cents,0)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})} บาท`;
      $('receiptPages').innerHTML=html;$('receiptPrintArea').innerHTML=html;
      if(!profile.name||!profile.position)throw new Error('ระบุชื่อผู้เบิกจ่ายและตำแหน่งก่อนพิมพ์');
      const clipped=[...$('receiptPages').querySelectorAll('.receipt-cell[data-filled] span')].some(el=>el.scrollWidth>el.parentElement.clientWidth-3);
      if(clipped)throw new Error('มีข้อความยาวเกินช่อง กรุณาตรวจชื่อผู้เบิก ตำแหน่ง หรือรายละเอียดก่อนพิมพ์');
      $('receiptPrint').disabled=false;return true;
    }catch(error){$('receiptError').textContent=error.message;return false;}
  }
  function open({expenses,selectedIds=[]}){init();rows=expenses.map(e=>({...e}));chosen=new Set(selectedIds.filter(id=>rows.some(e=>e.id===id)));$('receiptFrom').value='';$('receiptTo').value='';dialog.showModal();options();window.lucide?.createIcons();document.fonts.ready.then(()=>{if(dialog.open)render();});}
  return {open,thaiAmount,paginate,pageHTML};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletReceipt;
