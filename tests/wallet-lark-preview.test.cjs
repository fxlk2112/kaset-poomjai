const {test}=require('node:test');
const assert=require('node:assert/strict');
const {plan,target,categories,sources,vats,assets}=require('../js/wallet-lark-preview.js');
const row=()=>({kind:'out',cents:58001,title:'ซื้อยาทดสอบ',date:'2026-10-13',method:'transfer',party:'ร้านตัวอย่าง',note:'ห้ามแทนหมายเหตุการเงิน',photos:[{name:'test.jpg',type:'image/jpeg',size:10,url:'blob:local'}],lark:{project:'แปลงตัวอย่าง',purpose:'ทดสอบเท่านั้น',category:categories[2],source:sources[3],vat:vats[2],asset:assets[1]}});
test('mapping is pinned to the sandbox and keeps baht precision',()=>{
  const p=plan(row());assert.equal(target.app_token,'appExample');assert.equal(target.table_id,'tblExample');
  assert.equal(p.fields['จำนวนเงิน (THB)'],580.01);assert.equal(p.fields['วิธีจ่าย'],'โอน');assert.equal(p.fields['สถานะอนุมัติ'],'Draft');assert.equal(p.automaticSend,false);
  assert.equal(new Date(p.fields['วันที่จ่ายเงินให้แก่ร้านค้าหรือซัพพลายเออร์ (Date)']).toISOString(),'2026-10-13T05:00:00.000Z');
});
test('mapping never fabricates user references, linked payees or attachments',()=>{
  const p=plan(row());for(const key of ['ชื่อผู้รับเงิน / Payee','ผู้ขอ (Requester)','ผู้จ่าย/ผู้ทำรายการจ่าย','หลักฐานแนบ','หมวดค่าใช้จ่าย (Expense Category)','หมายเหตุการเงิน','สถานะการจ่ายเงินให้กับซัพพลายเออร์','EXP No. (Text/Auto ID)'])assert.equal(p.fields[key],undefined);
  assert.equal(p.localOnly.party,'ร้านตัวอย่าง');assert.equal(p.localOnly.photos[0].url,undefined);assert.ok(p.missing.length>=4);
});
test('receipt, void, invalid amounts, impossible dates and unknown options cannot be exported',()=>{
  for(const patch of [{kind:'in'},{voided:true},{cents:0},{cents:1.1},{cents:NaN},{date:'2026-02-30'},{method:'unknown'},{title:' '},{lark:{category:'new option'}}])assert.throws(()=>plan({...row(),...patch}));
});
test('optional mapping stays incomplete instead of guessing business details',()=>{
  const p=plan({...row(),lark:{},photos:[]});assert.equal(p.fields['ภาษี VAT'],undefined);assert.ok(p.missing.includes('ที่มาของเงินจ่าย'));assert.ok(p.missing.includes('จับคู่ผู้รับเงินกับทะเบียน Lark'));
  assert.ok(p.missing.some(x=>x.includes('2 ไฟล์')));
});
test('mapping does not mutate the transaction or financial ledger',()=>{
  const r=row(),before=JSON.stringify(r);plan(r);assert.equal(JSON.stringify(r),before);assert.equal(plan({...r,method:'cash'}).fields['วิธีจ่าย'],'เงินสด');
});
