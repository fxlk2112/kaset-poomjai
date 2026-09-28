// Shared by the collector, owner views and Worker; never converts stock packages.
const ApplicationRate = (() => {
  const units = {ml:'มล. (ซีซี)',l:'ลิตร',g:'กรัม',kg:'กก.'};
  const bases = {water:'น้ำ (ลิตร)',area:'พื้นที่ (ไร่)'};
  const blank = v => v === undefined || v === null || (typeof v === 'string' && !v.trim());
  function positive(v,label) {
    if(blank(v))return null;
    if(!['number','string'].includes(typeof v))throw new Error(label+'ต้องเป็นตัวเลข');
    const n=Number(v);
    if(!Number.isFinite(n) || n<=0 || n>1e9 || Math.abs(n*1e4-Math.round(n*1e4))>1e-6)throw new Error(label+'ต้องมากกว่า 0 และมีทศนิยมไม่เกิน 4 ตำแหน่ง');
    return n;
  }
  const fmt = n => Number(n).toLocaleString('th-TH',{maximumFractionDigits:4});
  function cleanDose(raw) {
    if(raw===undefined || raw===null)return null;
    if(typeof raw!=='object' || Array.isArray(raw))throw new Error('อัตราใช้ไม่ถูกต้อง');
    if(blank(raw.amount) && blank(raw.per))return null;
    const amount=positive(raw.amount,'ปริมาณยา/ปุ๋ย'),per=positive(raw.per,'ปริมาณน้ำหรือพื้นที่ฐาน');
    if(amount===null || per===null || !Object.hasOwn(units,raw.unit) || !Object.hasOwn(bases,raw.basis))throw new Error('กรอกอัตราใช้ให้ครบทั้งปริมาณ หน่วย และปริมาณน้ำหรือพื้นที่');
    return {amount,unit:raw.unit,per,basis:raw.basis};
  }
  const doseText = d => fmt(d.amount)+' '+units[d.unit]+' ต่อ'+(d.basis==='water'?'น้ำ ':'พื้นที่ ')+fmt(d.per)+' '+(d.basis==='water'?'ลิตร':'ไร่');
  function materialFields(row) {
    const dose=cleanDose(row.dose);
    if(dose)return {dose,rate:doseText(dose)};
    if(row.rate!=null && (typeof row.rate!=='string' || row.rate.length>120))throw new Error('อัตราใช้ต้องเป็นข้อความไม่เกิน 120 ตัวอักษร');
    const rate=(row.rate || '').trim();return rate?{rate}:{};
  }
  function cleanWork(raw) {
    if(raw===undefined || raw===null)return {};
    if(typeof raw!=='object' || Array.isArray(raw))throw new Error('ปริมาณงานไม่ถูกต้อง');
    const out={};
    for(const [key,label] of [['waterLitres','น้ำที่ใช้ทั้งหมด'],['areaRai','พื้นที่ที่ทำ']]){
      const n=positive(raw[key],label);if(n!==null)out[key]=n;
    }
    return out;
  }
  function workText(raw) {
    const work=cleanWork(raw);
    return [work.waterLitres?'น้ำทั้งหมด '+fmt(work.waterLitres)+' ลิตร':'',work.areaRai?'พื้นที่ '+fmt(work.areaRai)+' ไร่':''].filter(Boolean).join(' · ');
  }
  function estimate(row,work) {
    const dose=cleanDose(row.dose),totals=cleanWork(work);
    if(!dose)return null;
    const total=totals[dose.basis==='water'?'waterLitres':'areaRai'];
    if(!total)return null;
    const amount=dose.amount*total/dose.per;
    if(!Number.isFinite(amount) || amount>1e9)throw new Error('ปริมาณคำนวณสูงเกินไป กรุณาตรวจอัตราและปริมาณงาน');
    return {amount,unit:dose.unit};
  }
  function estimateText(row,work,status) {
    if(status==='failed')return '';
    const result=estimate(row,work);
    return result?'ตามอัตราที่กรอก: '+(result.amount<0.0001?'น้อยกว่า 0.0001':fmt(result.amount))+' '+units[result.unit]:'';
  }
  return {units,bases,cleanDose,materialFields,cleanWork,workText,estimate,estimateText};
})();
if(typeof module!=='undefined' && module.exports)module.exports=ApplicationRate;
