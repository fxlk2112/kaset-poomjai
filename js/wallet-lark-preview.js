/* Read-only mapping preview. No credentials or network operations. */
'use strict';
const WalletLarkPreview = (() => {
  const target=Object.freeze({app_token:'appExample',table_id:'tblExample'});
  const url='';
  const categories=Object.freeze([
    'F1 เมล็ดพันธุ์/ต้นกล้า/วัสดุปลูก',
    'F2 ปุ๋ย/ธาตุอาหาร/ฮอร์โมน/ชีวภัณฑ์',
    'F3 สารกำจัดศัตรูพืช/สารเคมีการเกษตร',
    'F4 ค่าแรงงานแปลง/เหมางานเกษตร/คนฉีดยาใส่ปุ๋ย',
    'F5 ค่าน้ำ/ไฟ/ปั๊ม/ระบบน้ำในแปลง',
    'F6 ค่าไถพรวน/เตรียมแปลง (จ้างรถไถ)',
    'F7 ค่าอาหาร/น้ำดื่มแรงงานแปลง',
    'F8 วัสดุ/อุปกรณ์แปลงวิจัย (ไฟฟ้า/ติดตั้ง)',
    'F9 วัสดุ/อุปกรณ์แปลงเกษตร'
  ]);
  const sources=Object.freeze(['จ่ายตรงซัพพลายเออร์','เบิกคืนพนักงาน','เงินทดรอง','เงินสดย่อย','เงินทดรอง(เบิกตรงจากบริษัท)']);
  const vats=Object.freeze(['มี VAT','ไม่มี VAT','ไม่แน่ใจ (ให้การเงินช่วยเช็ค)']);
  const assets=Object.freeze(['เป็นทรัพย์สินบริษัท','ไม่ใช่']);
  function plan(row){
    if(row.kind!=='out'||row.voided)throw new Error('จับคู่ได้เฉพาะรายการจ่ายที่ยังไม่ยกเลิก');
    if(!Number.isSafeInteger(row.cents)||row.cents<=0||row.cents>99999999999)throw new Error('จำนวนเงินไม่ถูกต้อง');
    const date=new Date(row.date+'T12:00:00+07:00');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==row.date)throw new Error('วันที่ไม่ถูกต้อง');
    if(!row.title?.trim())throw new Error('กรุณาระบุรายการ');
    const method={cash:'เงินสด',transfer:'โอน'}[row.method];
    if(!method)throw new Error('ช่องทางจ่ายไม่ตรงกับ Lark');
    const details=row.lark||{},missing=[];
    const fields={
      'รายการค่าใช้จ่าย':row.title.trim(),
      'จำนวนเงิน (THB)':row.cents/100,
      'วันที่จ่ายเงินให้แก่ร้านค้าหรือซัพพลายเออร์ (Date)':date.getTime(),
      'วิธีจ่าย':method,
      'ทีม/แผนก':'Example Department',
      'สถานะอนุมัติ':'Draft'
    };
    for(const [key,label,allowed] of [
      ['category','Category Name Detail',categories],['source','ที่มาของเงินจ่าย',sources],
      ['vat','ภาษี VAT',vats],['asset','เป็นทรัพย์สินบริษัทหรือไม่',assets]
    ]){
      const value=details[key];
      if(!value){missing.push(label);continue;}
      if(!allowed.includes(value))throw new Error('ตัวเลือกไม่ตรงกับ Lark: '+label);
      fields[label]=value;
    }
    for(const [key,label] of [['project','โปรเจกต์/งาน'],['purpose','จุดประสงค์ที่ทำให้เกิดค่าใช้จ่าย']]){
      const value=String(details[key]||'').trim();
      if(value)fields[label]=value;else missing.push(label);
    }
    // A typed party and local blob URLs are not valid Lark relationship/attachment values.
    missing.push('เลือกผู้ขอและผู้ทำรายการจ่ายจากบัญชี Lark','จับคู่ผู้รับเงินกับทะเบียน Lark','จับคู่หมวดค่าใช้จ่ายกับตาราง EXP_Categories','อัปโหลดหลักฐานเป็นไฟล์แนบ Lark');
    if((row.photos||[]).length<2)missing.push('ตรวจเงื่อนไขหลักฐาน: หน้าฟอร์มระบุอย่างน้อย 2 ไฟล์');
    return {
      target:{...target},mode:'draft-preview',fields,missing,
      localOnly:{party:row.party||'',note:row.note||'',photos:(row.photos||[]).map(p=>({name:p.name,type:p.type,size:p.size}))},
      automaticSend:false
    };
  }
  return {target,url,categories,sources,vats,assets,plan};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WalletLarkPreview;
