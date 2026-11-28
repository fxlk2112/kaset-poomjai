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

test('resuming legacy stock drafts preserves the saved title through type hydration',()=>{
  for(const autoTitle of ['true','false']){
    const {c,w}=setup();
    const title={tagName:'INPUT',value:'',dataset:{}},inspection={outerHTML:''};
    c.document.getElementById=id=>id==='t_title'?title:id==='inspectionBox'?inspection:null;
    w.form.querySelector=selector=>selector==='#t_title'?title:null;
    c.App.taskTypeChange=()=>{if(title.dataset.autoTitle==='true')title.value='ใส่ปุ๋ย';};
    for(const name of ['taskToggleCost','taskToggleHarvest','taskToggleIncome','taskRepeatToggle','taskProjectChange','waterSessionsRender','costRender','taskProjectRefresh'])c.App[name]=()=>{};
    Object.assign(c.Inspection,{begin:()=>'',contextRefresh(){},pointsRender(){}});
    c.renderTaskPhotoPreview=()=>{};c.labelFormFields=()=>{};c.ConceptWorkflows={formSummary(){}};
    w.renderPlots=()=>{};w.show=()=>{};let persisted='';w.persist=()=>{persisted=title.value;};
    const draft={fields:{t_title:{value:'ใช้ ปุ๋ยตัวอย่าง A'}},items:[{stockId:'sample',usageQty:2,totalCost:0}],autoTitle,step:0};
    const before=JSON.stringify(draft);w.restore(draft);
    assert.equal(title.value,'ใช้ ปุ๋ยตัวอย่าง A');assert.equal(persisted,'ใช้ ปุ๋ยตัวอย่าง A');
    assert.equal(JSON.stringify(draft),before);assert.equal(title.dataset.autoTitle,autoTitle);
  }
});
test('review validation exits before task mutation and draft deletion follows save',()=>{
  const app=read('js/app.js');const submit=app.slice(app.indexOf('App.submitTask ='),app.indexOf('App.submitTask =')+19000);
  assert.ok(submit.indexOf('if (validateOnly) return true;')<submit.indexOf('const data ='));
  const save=submit.indexOf('saveState(S);'), entryGuard=submit.indexOf("!projectEntrySaved(savedTaskId)"), completed=submit.indexOf('TaskWizard.completed()');
  assert.ok(save>0 && entryGuard>save && completed>entryGuard,'draft cleanup follows persistence and the project-entry rollback guard');
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

// Exercise the native compact-form dropdown, including the real scope and multi-plot renderers.
function typeForm(){
  const {c,w}=setup(),nodes={};
  for(const id of ['t_type','waterBox','t_title','t_note','t_usecost','t_useharvest','t_scope_plot','t_scope_farm',
    'taskMultiPlot','taskMultiPlotEnabled','taskMultiPlotRows','taskPlotCycleFields','t_material_area','t_plot','t_cycle',
    'taskScopeSummary','taskScopeSummaryDetail','taskMultiPlotTotal'])nodes[id]={value:'',checked:false,hidden:false,dataset:{},style:{},options:[]};
  // Native radio groups automatically uncheck the sibling.
  let plotScope=false;
  Object.defineProperty(nodes.t_scope_plot,'checked',{get:()=>plotScope,set:v=>{plotScope=!!v;}});
  Object.defineProperty(nodes.t_scope_farm,'checked',{get:()=>!plotScope,set:v=>{plotScope=!v;}});
  const areaLabel={},itemArea={value:0,readOnly:false};
  c.document.getElementById=id=>nodes[id]||null;
  c.document.querySelector=()=>areaLabel;
  w.form.querySelectorAll=()=>[itemArea];
  w.multiPlot=false;w.plotSelections=[];w.lastMultiActive=false;
  Object.assign(c,{S:{plots:[{id:'a',name:'A',sizeRai:1},{id:'b',name:'B',sizeRai:3}],cycles:[]},
    TYPE_LABELS:{work:'Work',spray:'Spray',fertilize:'Fertilize'},taskEditingId:'',taskCostItems:[],
    taskWaterSessions:[],defaultCostCat:()=>'',esc:String,fmtNum:String,plotById:(s,id)=>s.plots.find(p=>p.id===id),
    ConceptWorkflows:{formSummary(){}}});
  c.Inspection.contextRefresh=()=>{};
  Object.assign(c.App,{_taskFormType:'work',_taskCostDrafts:{},taskToggleCost(){},taskToggleHarvest(){},taskProjectRefresh(){},costRateRefresh(){},taskPlotChange(){}});
  const app=read('js/app.js');
  vm.runInContext(app.slice(app.indexOf('function taskMustBelongToPlot'),app.indexOf('function costOpenedAmount'))+
    app.slice(app.indexOf('App.costAreaSetPlot ='),app.indexOf('App.costUseMeasured ='))+
    app.slice(app.indexOf('App.taskScopeChange ='),app.indexOf('App.useStockInPlot =')),c);
  function change(type){nodes.t_type.value=type;c.App.taskTypeChange();}
  return {c,w,nodes,itemArea,change};
}

test('native activity dropdown reveals multi-plot selection and respects central-work scope',()=>{
  const {nodes,change}=typeForm();
  change('work');assert.equal(nodes.taskMultiPlot.hidden,true);assert.equal(nodes.taskPlotCycleFields.hidden,true);
  change('fertilize');assert.equal(nodes.taskMultiPlot.hidden,false);assert.equal(nodes.taskPlotCycleFields.hidden,false);
  assert.equal(nodes.t_scope_plot.checked,true);assert.equal(nodes.t_plot.disabled,false);
  change('spray');assert.equal(nodes.taskMultiPlot.hidden,false);
  change('work');assert.equal(nodes.taskMultiPlot.hidden,true);
  nodes.t_scope_farm.checked=true;change('work');assert.equal(nodes.taskPlotCycleFields.hidden,true);
});

test('type changes preserve multiple plots and areas without showing stale single-plot inputs',()=>{
  const {c,w,nodes,itemArea,change}=typeForm();
  change('fertilize');nodes.t_plot.value='a';nodes.t_cycle.value='__none__';
  w.multiPlot=true;w.plotSelections=[{plotId:'a',cycleId:'__none__',areaRai:1,selected:true},{plotId:'b',cycleId:'__none__',areaRai:3,selected:true}];
  const selected=JSON.stringify(w.plotSelections);
  for(const type of ['spray','fertilize']){
    change(type);assert.equal(nodes.taskMultiPlot.hidden,false);assert.equal(nodes.taskMultiPlotRows.hidden,false);
    assert.equal(nodes.taskPlotCycleFields.hidden,true);assert.equal(nodes.t_material_area.value,4);
    assert.equal(itemArea.value,4);assert.equal(itemArea.readOnly,true);
    assert.match(nodes.taskMultiPlotTotal.textContent,/2 แปลง.*4 ไร่/);
  }
  change('work');assert.equal(nodes.taskMultiPlot.hidden,true);assert.equal(nodes.taskPlotCycleFields.hidden,false);
  assert.equal(nodes.t_material_area.value,1);assert.equal(itemArea.readOnly,false);
  nodes.t_scope_farm.checked=true;c.App.taskScopeChange();change('work');assert.equal(nodes.taskPlotCycleFields.hidden,true);
  change('spray');assert.equal(nodes.taskPlotCycleFields.hidden,true);assert.equal(nodes.t_material_area.value,4);
  assert.equal(JSON.stringify(w.plotSelections),selected);
});

test('type refresh does not activate a closed, editing or hydrating wizard',()=>{
  const {w,nodes,change}=typeForm();w.ready=false;nodes.taskMultiPlot.hidden=true;
  change('fertilize');assert.equal(nodes.taskMultiPlot.hidden,true);assert.equal(w.ready,false);
});
