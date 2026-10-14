'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const M=require('../js/wallet-lark-read.js');
const script=fs.readFileSync(path.join(__dirname,'../js/wallet-read-ui.js'),'utf8');
const key='farm-wallet-read-v2:lark:test';
const payer='ou_alice';
const expense=(id,team,cents)=>({id,title:id,team,cents,date:'2026-01-01',payerIds:[payer],attachments:[]});
const expenses=[expense('recRD','R&D',50000),expense('recSales','Sales',30000),expense('recNone',null,9000)];
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};

function fixture(saved){
  const nodes=new Map(),store=new Map(),writes=[],prints=[];let failWrite=false;
  if(saved)store.set(key,JSON.stringify({selected:payer,wallets:{[payer]:saved}}));
  class Element{
    constructor(){this.value='';this.textContent='';this.innerHTML='';this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.attributes={};this.classList={toggle:()=>{},add:()=>{}};this.listeners={};}
    setAttribute(k,v){this.attributes[k]=v;} append(){} prepend(){} replaceChildren(){} focus(){} reset(){} querySelector(){return new Element();}
    addEventListener(k,v){this.listeners[k]=v;} showModal(){this.open=true;} close(){this.open=false;this.listeners.close?.();}
  }
  const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  $('expenseTotal').previousElementSibling=new Element();
  const filters=['all','out','in'].map(x=>Object.assign(new Element(),{dataset:{filter:x}}));
  const tabs=['current','other','review'].map(x=>Object.assign(new Element(),{dataset:{departmentView:x}}));
  const document={getElementById:$,createElement:()=>new Element(),querySelector:s=>s==='#expenseTotal'?$('expenseTotal'):$('selector:'+s),querySelectorAll:s=>s==='[data-filter]'?filters:s==='[data-department-view]'?tabs:[],addEventListener:()=>{},hidden:false,body:new Element()};
  const walletStorage={getItem:k=>store.get(k)||null,setItem:async(k,v)=>{if(failWrite)throw Error('disk');store.set(k,v);writes.push(k);}};
  vm.runInNewContext(script,{WalletLarkRead:M,WalletAccess:{context:{owner:{id:payer,name:'Alice'},target:{...M.target,team:null},storageBase:'farm-wallet-read-v1:lark:test'},storage:walletStorage,fetch:async url=>({ok:true,json:async()=>url.includes('/payers')?{source:{...M.target,team:null},payers:[{id:payer,name:'Alice'}]}:{source:{...M.target,team:null,payerId:payer},expenses,fetchedAt:'2026-10-14T00:00:00Z'}})},WalletReceipt:{open:data=>prints.push(data)},WalletImageCache:{create:()=>({})},WalletEvidence:{validate:()=>{},remove:async()=>{},put:async()=>[]},document,window:{addEventListener:()=>{}},setInterval:()=>{},setTimeout,clearTimeout,AbortController,AbortSignal,URL,URLSearchParams,crypto:require('node:crypto').webcrypto});
  return {$,tabs,store,writes,prints,failWrites:()=>{failWrite=true;},book:()=>JSON.parse(store.get(key)),select:async team=>{$('departmentSelect').value=team;await $('departmentForm').onsubmit({preventDefault(){}});}};
}

test('first unlock asks for department, never shows combined debit, then classifies and remembers choice',async()=>{
  const f=fixture();await flush();
  assert.equal(f.$('departmentScope').hidden,false);assert.equal(f.$('balance').textContent,'—');assert.equal(f.$('receive').disabled,true);
  await f.select('R&D');assert.equal(f.$('balance').textContent,'-500.00');assert.equal(f.book().wallets[payer].departments.selected,'R&D');
  assert.match(f.$('entries').innerHTML,/recRD/);assert.doesNotMatch(f.$('entries').innerHTML,/recSales|recNone/);
  f.tabs[1].onclick();assert.match(f.$('entries').innerHTML,/recSales/);assert.match(f.$('entries').innerHTML,/ไม่หักกระเป๋านี้/);assert.doesNotMatch(f.$('entries').innerHTML,/−300/);assert.equal(f.$('balance').textContent,'-500.00');
  f.tabs[2].onclick();assert.match(f.$('entries').innerHTML,/recNone/);assert.match(f.$('entries').innerHTML,/รอตรวจสอบ/);assert.equal(f.$('balance').textContent,'-500.00');
});

test('income submission and edit stay within current department; switching does not mix money',async()=>{
  const f=fixture();await flush();await f.select('R&D');f.$('receive').onclick();
  f.$('amount').value='1000';f.$('fundDate').value='2026-01-01';f.$('fundName').value='RD funds';await f.$('fundForm').onsubmit({preventDefault(){}});
  assert.equal(f.$('balance').textContent,'500.00');assert.equal(f.$('departmentSelect').disabled,false);
  await f.select('Sales');assert.equal(f.$('balance').textContent,'-300.00');assert.equal(f.$('incomeTotal').textContent,'0.00');
  await f.select('R&D');assert.equal(f.$('incomeTotal').textContent,'1,000.00');assert.equal(f.book().wallets[payer].income.length,0);
  const saved=f.book().wallets[payer],again=fixture(saved);await flush();assert.equal(again.$('departmentSelect').value,'R&D');assert.equal(again.$('balance').textContent,'500.00');
});

test('old unscoped money remains intact and visible without contributing to a selected department',async()=>{
  const old={opening:{cents:70000,date:'2026-01-01'},income:[{id:'old',title:'Old money',cents:20000,date:'2026-01-01'}],expenses:[],syncedAt:null};
  const f=fixture(old);await flush();assert.equal(f.$('unassignedFundsNotice').hidden,false);await f.select('R&D');
  assert.equal(f.$('balance').textContent,'-500.00');assert.deepEqual(f.book().wallets[payer].income,old.income);assert.deepEqual(f.book().wallets[payer].opening,old.opening);
  f.$('viewUnassignedFunds').onclick();assert.match(f.$('detail').innerHTML,/Old money/);
});

test('failed selection storage keeps previous department and amount and exposes error',async()=>{
  const f=fixture();await flush();await f.select('R&D');f.failWrites();await f.select('Sales');
  assert.equal(f.book().wallets[payer].departments.selected,'R&D');assert.equal(f.$('balance').textContent,'-500.00');assert.match(f.$('departmentError').textContent,/บันทึกในเครื่องไม่สำเร็จ/);
});
