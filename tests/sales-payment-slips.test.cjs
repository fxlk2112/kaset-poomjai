const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWQ0AAAAASUVORK5CYII=';
const slip={id:'slip-1',name:'Synthetic slip.png',src:PNG};
function client(){
  const elements={},storage=new Map(),modal={dataset:{}},messages=[];
  const c=vm.createContext({console,Date,AbortController,setTimeout(){return 1;},clearTimeout(){},navigator:{onLine:false},
    Auth:{session:{localPreview:true,email:'sale@example.invalid'}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);}},
    document:{getElementById:id=>elements[id]||null,querySelector:q=>q.includes('sale_pay')?{value:'transfer'}:modal,querySelectorAll:()=>[]},
    ic:()=>'',esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    T:k=>k,dateLabel:d=>d,toast:m=>messages.push(m),render(){},closeModal(){},showTaskLightbox(){},labelFormFields(){},
    openModal(html){c.html=html;if(elements.saleForm)elements.saleForm.isConnected=false;elements.saleForm={isConnected:true,closest:()=>modal};},
    downscaleImage:async()=>PNG});
  const run=s=>vm.runInContext(s,c);
  run(read('js/data.js'));run(read('js/sales.js'));
  run(`S.stock=[{id:'stock',name:'Synthetic product',qty:10,openQty:2,avgCost:60,unit:'ขวด'}];S.sales=[];App.saleRender=()=>{};this.state=S;`);
  for(const id of ['saleSlipList','saleSlipStatus','saleSlipInput','saleSubmit','sale_date','sale_customer','sale_discount','sale_note','sale_acct'])elements[id]={value:'',disabled:false};
  elements.sale_date.value='2026-11-26';
  const start=(id='')=>{run(`App.modalSale(${JSON.stringify(id)});saleItems=[{stockId:'stock',name:'Synthetic product',qty:2,price:100}];`);};
  return {c,run,elements,storage,messages,start,state:c.state};
}
test('slips survive sale create, edit, reload and void without duplicate stock/cost',()=>{
  const {run,state}=client();
  run(`const data={items:[{stockId:'stock',qty:2,price:100}],payMethod:'transfer',paymentSlips:[${JSON.stringify(slip)}]};const sale=addSale(S,data);`);
  assert.equal(state.stock[0].qty,8);assert.equal(run('saleCost(sale,S)'),120);
  for(let i=0;i<3;i++)run('updateSale(S,sale.id,{...data,paymentSlips:undefined});saveState(S);');
  assert.equal(state.stock[0].qty,8);assert.equal(state.stock[0].openQty,2);assert.equal(run('saleGrandTotal(sale)'),200);
  assert.equal(JSON.parse(JSON.stringify(state.sales))[0].paymentSlips[0].src,PNG);
  run('updateSale(S,sale.id,{...data,paymentSlips:[]});');assert.equal(state.sales[0].paymentSlips.length,0);
  run('updateSale(S,sale.id,data);voidSale(S,sale.id);voidSale(S,sale.id);');
  assert.equal(state.stock[0].qty,10);assert.equal(state.sales[0].paymentSlips[0].src,PNG);
});
test('invalid and oversized slips fail before stock or receipt mutation',()=>{
  const {c,run,state}=client();run("const sale=addSale(S,{items:[{stockId:'stock',qty:1,price:100}]});");
  const before=JSON.stringify(state);
  for(const invalid of [[{src:'https://example.invalid/public.jpg'}],[{src:'data:image/svg+xml;base64,PHN2Zz4='}],Array(4).fill(slip),[{src:'data:image/png;base64,'+'a'.repeat(180000)}]]){
    c.invalid=invalid;
    assert.throws(()=>run("addSale(S,{items:[{stockId:'stock',qty:1}],paymentSlips:invalid})"));
    assert.throws(()=>run("updateSale(S,sale.id,{items:[{stockId:'stock',qty:2}],paymentSlips:invalid})"));
    assert.equal(JSON.stringify(state),before);
  }
});
test('sale form saves slips atomically; failed local save keeps draft and stock intact',()=>{
  const x=client();x.start();x.run(`saleSlipDraft.slips=[${JSON.stringify(slip)}];App.viewSale=()=>{};`);
  const before=JSON.stringify(x.state);x.c.localStorage.setItem=()=>{throw new Error('quota');};
  x.run('App.submitSale({preventDefault(){}}, "")');
  assert.equal(JSON.stringify(x.state),before);assert.equal(x.run('saleSlipDraft.slips.length'),1);
  x.c.localStorage.setItem=(k,v)=>x.storage.set(k,v);
  x.run('App.submitSale({preventDefault(){}}, "")');
  assert.equal(x.state.sales.length,1);assert.equal(x.state.stock[0].qty,8);
  assert.equal(JSON.parse([...x.storage.values()].pop()).sales[0].paymentSlips[0].src,PNG);
  x.run('App.submitSale({preventDefault(){}}, "")');assert.equal(x.state.sales.length,1);
});
test('adding slips validates files, blocks submission during preparation and ignores a closed/replaced form',async()=>{
  const x=client();x.start();
  await x.run("App.saleAddSlips([{name:'bad.pdf',type:'application/pdf',size:10}])");
  assert.equal(x.run('saleSlipDraft.slips.length'),0);
  let resolve;x.c.downscaleImage=()=>new Promise(r=>{resolve=r;});
  const pending=x.run("App.saleAddSlips([{name:'synthetic.png',type:'image/png',size:100}])");
  x.run('App.submitSale({preventDefault(){}}, "")');assert.equal(x.state.sales.length,0);
  x.start();resolve(PNG);await pending;
  assert.equal(x.run('saleSlipDraft.slips.length'),0);
  x.c.downscaleImage=async()=>PNG;
  await x.run("App.saleAddSlips([{name:'synthetic.png',type:'image/png',size:100}])");
  assert.equal(x.run('saleSlipDraft.slips.length'),1);
  x.run('App.saleRemoveSlip(0)');assert.equal(x.run('saleSlipDraft.slips.length'),0);
});
test('account change while preparing evidence cannot attach it to another account',async()=>{
  const x=client();x.start();let resolve;x.c.downscaleImage=()=>new Promise(r=>{resolve=r;});
  const pending=x.run("App.saleAddSlips([{name:'synthetic.png',type:'image/png',size:100}])");
  x.c.Auth.session={localPreview:true,email:'another@example.invalid'};resolve(PNG);await pending;
  assert.equal(x.run('saleSlipDraft.slips.length'),0);
  x.run('App.submitSale({preventDefault(){}}, "")');assert.equal(x.state.sales.length,0);
});
test('slip evidence stays out of customer receipt print/share content and escapes names',()=>{
  const {run,c}=client();c.fixture={...slip,name:'<img src=x onerror=alert(1)>'};
  run("const sale=addSale(S,{items:[{stockId:'stock',qty:1,price:100}],paymentSlips:[fixture]});");
  assert.ok(!run('saleReceiptHtml(sale)').includes(PNG));assert.ok(!run('saleShareText(sale)').includes(PNG));
  assert.match(run('saleSlipDetailHtml(sale)'),/&lt;img/);
  c.Auth.shareMode='synthetic-share';assert.equal(run('saleSlipDetailHtml(sale)'),'');
});
test('private slip API round-trips through Pages, syncs references and denies other accounts/public reads',async t=>{
  const {default:worker}=await import(pathToFileURL(path.join(root,'worker/src/lark.js')));
  const {onRequest}=await import(pathToFileURL(path.join(root,'functions/api/[[path]].js')));
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(read('worker/schema.sql'));
  for(const id of ['owner','other']){
    db.prepare('INSERT INTO users(id,email,pass_hash,name,created_at) VALUES(?,?,?,?,?)').run(id,id+'@example.invalid','unused-fixture',id,1);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('fixture-session-'+id,id,Date.now()+86400000);
  }
  const objects=new Map();const env={DB:{prepare(sql){const s=db.prepare(sql);let b={};return {bind(...a){b=Object.fromEntries(a.map((v,i)=>['?'+(i+1),v]));return this;},async first(){return s.get(b)||null;},async run(){return {meta:{changes:Number(s.run(b).changes)}};}};}},PHOTOS:{
    async put(key,body,options){objects.set(key,{body:new Uint8Array(body),httpMetadata:options.httpMetadata,size:body.length,arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength)});},async get(key){return objects.get(key);}
  }};
  const request=(pathname,options)=>onRequest({request:new Request('https://farm.example.invalid'+pathname,options),env:{FARMULTIMATE_API:{fetch:r=>worker.fetch(r,env)}}});
  const call=async(action,extra={},owner='owner')=>{const res=await request('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:'fixture-session-'+owner,...extra})});return {res,body:await res.json()};};
  const uploaded=await call('sale_slip_put',{data:PNG.split(',')[1],contentType:'image/png'});
  assert.equal(uploaded.body.ok,true);assert.equal(uploaded.res.headers.get('Cache-Control'),'no-store');
  const key=uploaded.body.data.key;assert.match(key,/^sale-private\/owner\//);
  const got=await call('sale_slip_get',{key});assert.equal(got.body.data.src,PNG);
  assert.equal((await call('sale_slip_get',{key},'other')).body.ok,false);
  assert.equal((await call('sale_slip_get',{key},'expired')).body.ok,false);
  for(const prefix of ['/api/photo/','/photo/']){
    const req=new Request('https://farm.example.invalid'+prefix+key);
    assert.equal((await worker.fetch(req,env)).status,403);
  }
  assert.equal((await request('/api/photo/'+key)).status,403);
  assert.equal((await call('sale_slip_put',{data:'PHN2Zz4=',contentType:'image/png'})).body.ok,false);
  assert.equal((await call('sale_slip_get',{key:'sale-private/owner/../other/x.png'})).body.ok,false);
  const c=client();c.c.fixture={id:'slip',name:'Synthetic',key};
  c.run("addSale(S,{items:[{stockId:'stock',qty:2,price:100}],paymentSlips:[fixture]})");
  assert.equal((await call('save',{data:c.state,base_updated_at:0})).body.ok,true);
  const loaded=(await call('load')).body.data.data;
  assert.equal(loaded.sales[0].paymentSlips[0].key,key);assert.equal(loaded.stock[0].qty,8);
  assert.equal((await call('load',{},'other')).body.data.data,null);
});
