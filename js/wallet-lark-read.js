'use strict';
const WalletLarkRead=(()=>{
  // Fictional defaults for pure-model tests; live connections require server configuration.
  const target=Object.freeze({app:'appExample',table:'tblExample',team:'Example Department'});
  const owner=Object.freeze({id:'ou_example',name:'Example User'});
  const baseUrl='';
  const payerField='ผู้จ่าย/ผู้ทำรายการจ่าย';
  const fields=Object.freeze(['ทีม/แผนก',payerField,'รายการค่าใช้จ่าย','จำนวนเงิน (THB)','วันที่จ่ายเงินให้แก่ร้านค้าหรือซัพพลายเออร์ (Date)','วันที่ขอ (Date)','สถานะอนุมัติ','EXP No. (Text/Auto ID)','หลักฐานแนบ','วิธีจ่าย']);
  const imageType=type=>['image/jpeg','image/png','image/webp','image/gif'].includes(type);
  function attachments(r){return (Array.isArray(r.fields?.['หลักฐานแนบ'])?r.fields['หลักฐานแนบ']:[]).map((p,index)=>({index,id:String(p.file_token||''),name:String(p.name||'หลักฐาน'),type:String(p.type||''),size:Number(p.size)||0,previewable:imageType(p.type)}));}
  const validPayer=id=>typeof id==='string'&&/^ou_[A-Za-z0-9]+$/.test(id);
  const validTeam=team=>typeof team==='string'&&team.length>0&&team.length<=120&&team.trim()===team&&!/[\u0000-\u001f\u007f-\u009f]/.test(team);
  function payersOf(r){return (Array.isArray(r.fields?.[payerField])?r.fields[payerField]:[]).filter(p=>validPayer(p?.id)).map(p=>({id:p.id,name:text(p.name)||text(p.en_name)||p.id}));}
  function payerList(records,team=target.team){
    if(!validTeam(team))throw new Error('Invalid team');
    const people=new Map();let unassigned=0;
    for(const r of records){if(text(r.fields?.['ทีม/แผนก'])!==team)continue;const list=payersOf(r);if(!list.length)unassigned++;for(const p of list)people.set(p.id,p);}
    return {payers:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name)),unassigned};
  }
  function text(value){if(typeof value==='string')return value;if(Array.isArray(value))return value.map(v=>typeof v==='string'?v:v?.text||v?.name||'').join('');return '';}
  function expenseTeam(value){
    // Multiple or malformed departments need review, never concatenate them into a new department.
    if(Array.isArray(value)){if(value.length!==1)return null;value=typeof value[0]==='string'?value[0]:value[0]?.text||value[0]?.name;}
    return validTeam(value)?value:null;
  }
  function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
  function money(value,allowZero=false){
    const raw=String(value).trim();if(!/^\d{1,9}(\.\d{1,2})?$/.test(raw))throw new Error('จำนวนเงินต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง');
    const [a,b='']=raw.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));
    if(n===0&&!allowZero)throw new Error('จำนวนเงินต้องมากกว่า 0');return n;
  }
  function day(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('วันที่ Lark ไม่ถูกต้อง');const d=new Date(value);if(!Number.isFinite(d.getTime()))throw new Error('วันที่ Lark ไม่ถูกต้อง');return d.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});}
  function normalize(records,payerId=null,team=target.team){
    if(team===null?!validPayer(payerId):!validTeam(team))throw new Error('Invalid team or payer scope');
    if(!Array.isArray(records))throw new Error('ข้อมูล Lark ไม่ครบ');const seen=new Set();
    return records.filter(r=>(team===null||text(r.fields?.['ทีม/แผนก'])===team)&&(!payerId||payersOf(r).some(p=>p.id===payerId))).map(r=>{
      if(!/^rec[A-Za-z0-9]+$/.test(r.record_id)||seen.has(r.record_id))throw new Error('รหัสรายการ Lark ซ้ำหรือไม่ถูกต้อง');seen.add(r.record_id);
      const f=r.fields,title=text(f['รายการค่าใช้จ่าย']).trim();if(!title)throw new Error('มีรายการ Lark ที่ยังไม่มีชื่อ');
      let cents;try{cents=money(f['จำนวนเงิน (THB)']);}catch{throw new Error('มีรายการ Lark ที่จำนวนเงินไม่ถูกต้อง กรุณาตรวจต้นฉบับ');}
      const paidDate=f['วันที่จ่ายเงินให้แก่ร้านค้าหรือซัพพลายเออร์ (Date)'],dateBasis=paidDate==null?'requested':'paid';
      return {id:r.record_id,title,cents,team:expenseTeam(f['ทีม/แผนก']),date:day(paidDate??f['วันที่ขอ (Date)']),dateBasis,paymentMethod:text(f['วิธีจ่าย']).trim(),approval:text(f['สถานะอนุมัติ']),reference:text(f['EXP No. (Text/Auto ID)']),payerIds:payersOf(r).map(p=>p.id),attachments:attachments(r),missing:false};
    });
  }
  function reconcile(previous,incoming){
    const map=new Map(incoming.map(r=>[r.id,{...r,missing:false}]));
    // Disappearance is not proof of a refund. Keep the last debit until reconciled.
    for(const old of previous)if(!map.has(old.id))map.set(old.id,{...old,missing:true});
    return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  }
  function totals(state){
    const from=state.opening?.date||'0000-01-01';
    const expenses=state.expenses.filter(r=>r.date>=from),income=state.income.filter(r=>r.date>=from);
    const paid=expenses.reduce((s,r)=>s+r.cents,0),received=income.reduce((s,r)=>s+r.cents,0);
    return {expenses,income,paid,received,balance:(state.opening?.cents||0)+received-paid};
  }
  function discardLegacyIncome(old){return {...old,income:[],deletedIncome:[...(old.deletedIncome||[]),...old.income]};}
  function validDepartments(value){
    if(value===undefined)return true;
    if(!value||!Array.isArray(value.wallets)||!(value.selected===null||validTeam(value.selected)))return false;
    const seen=new Set();
    return value.wallets.every(w=>{
      if(!w||!validTeam(w.team)||seen.has(w.team)||!Array.isArray(w.income))return false;seen.add(w.team);
      const ids=new Set();
      return w.income.every(r=>r&&typeof r.id==='string'&&!ids.has(r.id)&&ids.add(r.id)&&typeof r.title==='string'&&Number.isSafeInteger(r.cents)&&r.cents>0&&validDate(r.date))&&
        (w.opening===null||!!w.opening&&validDate(w.opening.date)&&Number.isSafeInteger(w.opening.cents)&&w.opening.cents>=0);
    })&&(value.selected===null||seen.has(value.selected));
  }
  function departmentFunds(state){return state.departments?.wallets.find(w=>w.team===state.departments.selected)||{team:null,opening:null,income:[]};}
  function selectDepartment(state,team){
    if(!validTeam(team)||!validDepartments(state.departments))throw new Error('แผนกไม่ถูกต้อง');
    const wallets=state.departments?.wallets||[];
    return {...state,departments:{selected:team,wallets:wallets.some(w=>w.team===team)?wallets:[...wallets,{team,opening:null,income:[]}]}};
  }
  function updateDepartmentFunds(state,changes){
    const current=departmentFunds(state);if(!current.team)throw new Error('เลือกแผนกก่อนบันทึกเงิน');
    const next={...state,departments:{...state.departments,wallets:state.departments.wallets.map(w=>w.team===current.team?{...w,...changes,team:w.team}:w)}};
    if(!validDepartments(next.departments))throw new Error('ข้อมูลเงินของแผนกไม่ถูกต้อง');return next;
  }
  function departmentTotals(state){
    const funds=departmentFunds(state),from=funds.opening?.date||'0000-01-01';
    const rows=state.expenses.filter(r=>r.date>=from),team=funds.team;
    const expenses=team?rows.filter(r=>r.team===team):[];
    const otherExpenses=team?rows.filter(r=>validTeam(r.team)&&r.team!==team):[];
    const unassignedExpenses=rows.filter(r=>!validTeam(r.team));
    return {...totals({...funds,expenses}),otherExpenses,unassignedExpenses,
      otherPaid:otherExpenses.reduce((s,r)=>s+r.cents,0),unassignedPaid:unassignedExpenses.reduce((s,r)=>s+r.cents,0)};
  }
  return {target,owner,baseUrl,fields,payerField,validPayer,validTeam,payersOf,payerList,text,validDate,money,imageType,attachments,discardLegacyIncome,normalize,reconcile,totals,expenseTeam,validDepartments,departmentFunds,selectDepartment,updateDepartmentFunds,departmentTotals};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletLarkRead;
