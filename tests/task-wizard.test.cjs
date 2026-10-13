const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function setup(){
  const storage=new Map(),status={textContent:''};
  let closed=0;
  const c=vm.createContext({Auth:{session:{email:'Owner@Example.test'}},App:{modalTask(){},submitTask(){},closeModal(){}},document:{addEventListener(){},getElementById(){return status;}},window:{addEventListener(){}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},clearTimeout(){},setTimeout(){},closeModal(){closed++;},toast(){},taskPhotoUploading:{form:false},Inspection:{pending:0}});
  vm.runInContext(read('js/task-wizard.js')+'\nthis.wizard=TaskWizard;',c);
  const w=c.wizard;w.form={isConnected:true};w.ready=true;w.owner=w.key();w.capture=()=>({version:1,fields:{t_title:{value:'draft'}},items:[{stockId:'a',usageQty:50}]});
  return {c,w,storage,status,closed:()=>closed};
}
test('drafts are account-scoped and preserve material data without writing farm state',()=>{
  const {c,w,storage}=setup();assert.equal(w.persist(),true);
  assert.equal(storage.size,1);assert.equal(w.read().items[0].usageQty,50);
  c.Auth.session.email='other@example.test';assert.equal(w.read(),null);assert.equal(w.persist(),false);
  assert.equal(storage.size,1);
});
test('quota failure does not claim saved or close the live form',()=>{
  const {c,w,status,closed}=setup();c.localStorage.setItem=()=>{throw new Error('quota');};
  assert.equal(w.persist(),false);assert.match(status.textContent,/เก็บฉบับร่างไม่ได้/);
  w.close();assert.equal(closed(),0);assert.equal(w.ready,true);
});
test('close waits for photos then preserves the draft',()=>{
  const {c,w,closed,storage}=setup();c.taskPhotoUploading.form=true;w.close();assert.equal(closed(),0);
  c.taskPhotoUploading.form=false;w.close();assert.equal(closed(),1);assert.equal(storage.size,1);assert.equal(w.ready,false);
});
test('successful completion clears only this account draft and stops pending writes',()=>{
  const {w,storage}=setup();w.persist();storage.set('other','keep');w.completed();
  assert.equal(storage.has(w.owner),false);assert.equal(storage.get('other'),'keep');assert.equal(w.persist(),false);
});
test('back navigation never validates, clears fields or saves a task',()=>{
  const {w}=setup();let validations=0,shown=-1,saved=0;
  w.step=2;w.validate=()=>{validations++;return false;};w.show=s=>{shown=s;};w.persist=()=>{saved++;};
  w.go(0);assert.equal(shown,0);assert.equal(validations,0);assert.equal(saved,1);
});
test('forward jumps cannot bypass an invalid earlier step',()=>{
  const {w}=setup();const checked=[];let shown=-1;
  w.step=0;w.validate=s=>{checked.push(s);return s===0;};w.show=s=>{shown=s;};w.go(2);
  assert.deepEqual(checked,[0,1]);assert.equal(shown,-1);
});
test('broken and unsupported drafts do not crash opening the form',()=>{
  const {w,storage}=setup();for(const raw of ['{','null','{"version":2,"fields":{},"items":[]}']){storage.set(w.key(),raw);assert.equal(w.read(),null);}
});
test('review validation exits before task mutation and draft deletion follows save',()=>{
  const app=read('js/app.js');const submit=app.slice(app.indexOf('App.submitTask ='),app.indexOf('App.submitTask =')+19000);
  assert.ok(submit.indexOf('if (validateOnly) return true;')<submit.indexOf('const data ='));
  assert.match(submit,/saveState\(S\);\s+if \(!editId && typeof TaskWizard !== 'undefined'\) TaskWizard.completed\(\)/);
  assert.match(read('js/task-wizard.js'),/if\(taskEditingId\)return;/);
  assert.match(read('sw.js'),/"\/js\/task-wizard.js"/);
});

test('stock preview uses the real ledger logic on copies without deducting live stock',()=>{
  const c=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},setTimeout(){}});
  vm.runInContext(read('js/data.js'),c);
  const src=read('js/task-wizard.js');vm.runInContext(src.slice(src.indexOf('function taskWizardStockPreview'),src.indexOf('const TaskWizard')),c);
  const state={stock:[{id:'a',name:'A',unit:'bottle',size:'500 cc',qty:4,openQty:.5,avgCost:380}],tasks:[]};
  const item={stockId:'a',stockMode:'content',qty:.1,totalCost:38,unitCost:380};
  const before=JSON.stringify(state),original=JSON.stringify(item);
  const preview=c.taskWizardStockPreview(state,[item],'done');
  assert.equal(preview[0].after.qty,4);assert.equal(preview[0].after.openQty,.4);
  assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(item),original);
  assert.equal(c.taskWizardStockPreview(state,[item],'planned').length,0);
  assert.equal(c.taskWizardStockPreview(state,[item],'failed').length,0);
});
