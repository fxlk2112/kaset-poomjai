const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../js/wallet-receipt.js'),T=require('../js/wallet-receipt-template.js');
const entry=(id,cents=32500)=>({id:String(id),title:'ค่าอุปกรณ์',date:'2026-10-05',cents});
const profile={name:'ผู้เบิกตัวอย่าง',position:'ฝ่ายตัวอย่าง'};
test('receipt notes use each source payment method, never default to cash',()=>{
  const entries=['เงินสด','โอน','บัตรบริษัท','',undefined].map((paymentMethod,i)=>({...entry(i),paymentMethod}));
  const page=R.paginate(entries,s=>s.length)[0];
  assert.deepEqual(page.lines.map(l=>l.note),['เงินสด','โอน','บัตรบริษัท','ไม่ระบุ','ไม่ระบุ']);
  const html=R.pageHTML(page,profile);assert.ok(html.includes('โอน'));assert.ok(html.includes('บัตรบริษัท'));
});
test('long source payment methods wrap without repeating the amount',()=>{
  const method='เครดิตรายเดือน ปั๊ม จรรโลง';
  const page=R.paginate([{...entry(1),paymentMethod:method}],s=>s.length*10)[0];
  assert.equal(page.lines.map(l=>l.note).join(''),method);assert.equal(page.lines.filter(l=>l.amount).length,1);
});
test('public receipt has blank identity cells while preserving logo geometry and 18 writing rows',()=>{
  assert.equal(T.rows.length,41);assert.equal(T.cols.length,10);for(const key of ['B2','D3','D4','C29','H29'])assert.equal(T.cells[key].value,'');assert.ok(T.logo.width>120);
  const html=R.pageHTML(R.paginate([entry(1)])[0],profile);for(let i=8;i<=25;i++)assert.ok(html.includes(`data-cell="B${i}"`));assert.ok(html.includes('assets/wallet-receipt/logo.png'));
});
test('Thai amount words keep exact satang and Thai tens and million endings',()=>{
  for(const [cents,words] of [[0,'ศูนย์บาทถ้วน'],[1,'ศูนย์บาทหนึ่งสตางค์'],[101,'หนึ่งบาทหนึ่งสตางค์'],[1100,'สิบเอ็ดบาทถ้วน'],[2100,'ยี่สิบเอ็ดบาทถ้วน'],[10100,'หนึ่งร้อยเอ็ดบาทถ้วน'],[32500,'สามร้อยยี่สิบห้าบาทถ้วน'],[37364,'สามร้อยเจ็ดสิบสามบาทหกสิบสี่สตางค์'],[100000100,'หนึ่งล้านเอ็ดบาทถ้วน']])assert.equal(R.thaiAmount(cents),words);
  for(const bad of [-1,1.2,NaN,Infinity])assert.throws(()=>R.thaiAmount(bad));
});
test('19 short entries become two pages with no duplicate or missing amounts',()=>{
  const entries=Array.from({length:19},(_,i)=>entry(i,100+i));const pages=R.paginate(entries,s=>s.length);assert.deepEqual(pages.map(p=>p.lines.length),[18,1]);assert.equal(pages.flatMap(p=>p.entries).reduce((s,e)=>s+e.cents,0),entries.reduce((s,e)=>s+e.cents,0));assert.equal(pages.flatMap(p=>p.lines).filter(l=>l.amount).length,19);
});
test('long descriptions reserve extra lines without repeating date or amount',()=>{
  const pages=R.paginate([{...entry(1),title:'x'.repeat(100)}],s=>s.length*10);assert.equal(pages[0].lines.length,3);assert.equal(pages[0].lines.map(l=>l.description).join(''),'x'.repeat(100));assert.equal(pages[0].lines.filter(l=>l.amount).length,1);assert.equal(pages[0].entries.length,1);
});
test('HTML escapes record and profile content and uses Thai dates without ISO parentheses',()=>{
  const page=R.paginate([{...entry(1),title:'<img src=x>'}],s=>s.length)[0],html=R.pageHTML(page,{name:'<script>bad</script>',position:'R&D'});assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(html.includes('5/10/69'));assert.ok(!html.includes('(2026-10-05)'));assert.ok(!html.includes('ศูนย์บาทถ้วน'));assert.ok(html.includes('สามร้อยยี่สิบห้าบาทถ้วน'));
});
test('invalid dates, amounts and overlong text cannot produce a misleading print',()=>{
  assert.throws(()=>R.paginate([{...entry(1),date:'2026-02-30'}]));assert.throws(()=>R.paginate([entry(1,0)]));assert.throws(()=>R.paginate([{...entry(1),title:'x'.repeat(1000)}],s=>s.length*10));assert.deepEqual(R.paginate([]),[]);
});
