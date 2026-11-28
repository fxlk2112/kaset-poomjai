const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cents,dateValid,ledger,validate,validatePhotos}=require('../js/wallet-preview.js');
const entry=(id,kind,amount,date='2026-10-13')=>({id,order:Number(id),kind,cents:amount,date,title:'Sample'});
test('wallet parses exact cents, rejecting ambiguous and invalid input',()=>{
  assert.equal(cents('580.01'),58001);assert.equal(cents('0.10'),10);
  for(const n of ['0','-1','NaN','1e3','1,000','0.001','1000000000'])assert.throws(()=>cents(n));
});
test('wallet orders transactions and computes running balances without float drift',()=>{
  const rows=[entry('3','out',10),entry('1','in',100),entry('2','out',20)];
  assert.deepEqual(ledger(rows).map(r=>r.balance),[100,80,70]);assert.equal(rows[0].id,'3');
});
test('wallet rejects impossible dates, future payments, and blank titles',()=>{
  assert.equal(dateValid('2026-02-30'),false);assert.equal(dateValid('2024-02-29'),true);
  assert.throws(()=>validate([],entry('1','in',100,'2026-10-14'),'2026-10-13'));
  assert.throws(()=>validate([],{...entry('1','in',100),title:'  '},'2026-10-13'));
});
test('wallet edits replace rather than double count and voided payments restore balance',()=>{
  const rows=[entry('1','in',100000),entry('2','out',58000)];
  assert.equal(validate(rows,entry('2','out',42000),'2026-10-13').at(-1).balance,58000);
  assert.equal(validate(rows,{...rows[1],voided:true},'2026-10-13').at(-1).balance,100000);
  assert.throws(()=>validate(rows,{...rows[0],voided:true},'2026-10-13'));
});
test('wallet blocks overspending including backdated payments before funding',()=>{
  const rows=[entry('1','in',100)];
  assert.throws(()=>validate(rows,entry('2','out',101),'2026-10-13'));
  assert.throws(()=>validate(rows,entry('2','out',50,'2026-10-12'),'2026-10-13'));
  assert.equal(validate(rows,entry('2','out',100),'2026-10-13').at(-1).balance,0);
});
test('wallet evidence accepts multiple supported images within limits',()=>{
  const image={type:'image/jpeg',size:1024};
  assert.doesNotThrow(()=>validatePhotos([image],[image,{type:'image/png',size:20},{type:'image/webp',size:30}]));
  assert.doesNotThrow(()=>validatePhotos([],Array(6).fill(image)));
  assert.throws(()=>validatePhotos([image],Array(6).fill(image)));
});
test('wallet evidence rejects unsupported, empty, large and excessive total files',()=>{
  for(const type of ['image/svg+xml','image/heic','application/pdf','text/html',''])assert.throws(()=>validatePhotos([],[{type,size:100}]));
  assert.throws(()=>validatePhotos([],[{type:'image/png',size:0}]));
  assert.throws(()=>validatePhotos([],[{type:'image/png',size:10*1024*1024+1}]));
  const large={type:'image/jpeg',size:10*1024*1024};
  assert.doesNotThrow(()=>validatePhotos([],[large,large,large]));
  assert.throws(()=>validatePhotos([large,large,large],[{type:'image/jpeg',size:1}]));
});
test('wallet editing and voiding keep evidence without changing money calculations',()=>{
  const photos=[{name:'proof.jpg',url:'blob:preview-only'}];
  const rows=[entry('1','in',100000),{...entry('2','out',58000),photos}];
  const updated=validate(rows,{...rows[1],cents:50000},'2026-10-13');
  assert.equal(updated.at(-1).balance,50000);assert.deepEqual(updated.at(-1).photos,photos);
  assert.deepEqual(validate(rows,{...rows[1],voided:true},'2026-10-13').at(-1).photos,photos);
});
