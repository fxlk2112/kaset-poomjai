const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function harness() {
  const ctx = vm.createContext({console, Date, localStorage: {getItem: () => null, setItem() {}},
    route: {}, render() {}, rerender() {}, document: {getElementById: () => null}, setTimeout() {},
    taskAllPhotos: t => t.photos || [], dateLabel: date => date,
    esc: value => String(value).replace(/[<>&"']/g, c => ({'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;'}[c]))});
  const run = text => vm.runInContext(text, ctx);
  run(source('js/data.js')); run(source('js/projects.js')); run(source('js/project-workspace.js'));
  const app = source('js/app.js');
  run(app.slice(app.indexOf('function taskMaterialItems('), app.indexOf('function taskMaterialsHtml(')));
  run(source('js/cycle-notebook.js')); run(source('js/plot-materials.js'));
  run(`notebookIcon=()=>''; S.tasks=[]; S.projects=[]; S.stock=[];
    S.plots=[{id:'p',sizeRai:4},{id:'q',sizeRai:2}];
    S.cycles=[{id:'c1',plotId:'p',plant:'Corn',round:1,startDate:'2026-08-01',status:'done'},
      {id:'c2',plotId:'p',plant:'Corn',round:2,startDate:'2026-11-01',status:'active'},
      {id:'other',plotId:'q',plant:'Corn',round:1,startDate:'2026-11-01',status:'active'}];
    const item=(name,qty=100,cost=10,unit='ml')=>({name,category:'chemical',usageQty:qty,usageUnit:unit,qty:0.1,unit:'ขวด',totalCost:cost});
    const task=(id,cycleId='c2',items=[item('A')],status='done')=>({id,title:'Task '+id,plotId:'p',cycleId,type:'spray',date:'2026-11-06',doneDate:'2026-11-12',status,cost:items.reduce((sum,i)=>sum+(Number(i.totalCost)||0),0),costItems:items});`);
  return {run, ctx};
}

test('date/product views count canonical material lines once, exclude labor/plans/failures and never mutate accounting', () => {
  const h = harness();
  h.run(`S.projects=[{id:'pr',name:'Project',stages:[]}];
    const done=task('a','c2',[item('A',800,210),{...item('B',1000,340),category:'other'},{name:'labor',category:'labor',totalCost:200}]);
    done.projectId='pr'; done.stockId='mirror'; done.qty=123;
    done.reportedMaterials=[{name:'A',usageQty:800,usageUnit:'ml'},{name:'B',usageQty:1000,usageUnit:'ml'}];
    S.tasks=[done,task('plan','c2',[item('A',9000,9000)],'planned'),task('fail','c2',[item('A',9000,9000)],'failed')];
    const before=JSON.stringify(S), totalBefore=cycleFinance(S,'c2').cost;
    const model=materialHistoryModel([...S.tasks,done]);
    const html=materialHistoryHtml('p'); App.materialHistoryFilter('plot:p','view','products'); const summary=materialHistoryHtml('p');`);
  assert.equal(h.run('model.rows.length'), 1); assert.equal(h.run('model.planned.length'), 1);
  assert.equal(h.run('model.cost'), 550); assert.equal(h.run('model.products.length'), 2);
  assert.equal(h.run('model.days.keys().next().value'), '2026-11-12');
  assert.equal(h.run('model.products[0].tasks.size'), 1);
  assert.equal(h.run('JSON.stringify(S)===before'), true);
  assert.equal(h.run('cycleFinance(S,"c2").cost'), 750);
  assert.equal(h.run('projectCosts(projectById("pr")).cost'), 750);
  assert.match(h.run('html'), /ไม่รวมค่าแรงและงานที่วางไว้/);
  assert.match(h.run('summary'), /mh-product-history/);
});

test('plot and cycle scope isolate other plots, closed cycles, and orphaned legacy activities', () => {
  const h=harness(); h.run(`S.tasks=[task('old','c1'),task('new','c2'),task('orphan','deleted'),task('none',''),{...task('q','other'),plotId:'q'}];`);
  assert.equal(h.run('materialHistoryScope("p").tasks.length'),4);
  h.run(`App.materialHistoryFilter('plot:p','cycle','c1');`);
  assert.equal(h.run('materialHistoryScope("p").tasks[0].id'),'old');
  h.run(`App.materialHistoryFilter('plot:p','cycle','__none__');`);
  assert.equal(h.run('materialHistoryScope("p").tasks.length'),2);
  assert.equal(h.run('materialHistoryScope("p","c2").tasks[0].id'),'new');
  assert.equal(h.run('materialHistoryScope("q").tasks.length'),1);
});

test('product totals convert compatible saved units and keep unknown package sizes and mass separate', () => {
  const h=harness();h.run(`S.stock=[{id:'stock',name:'A',size:'99 ลิตร',unit:'ขวด'}];
    const rows=[item(' A ',500,5,'cc'),item('A',1,10,'l'),item('A',1,10,'kg'),item('A',500,5,'g'),
      {name:'A',category:'chemical',stockId:'stock',qty:2,unit:'ขวด',totalCost:4},
      {name:'A',category:'chemical',stockId:'stock',qty:1,unit:'ขวด',packageSize:'500 ml',totalCost:5},
      {name:'A',category:'chemical',totalCost:0}];
    const model=materialHistoryModel([task('a','c2',rows),task('b','c2',[item('A',100,1)])]); const p=model.products[0];`);
  assert.equal(h.run('model.products.length'),1); assert.equal(h.run('p.tasks.size'),2);
  assert.equal(h.run('p.quantities.get("volume").qty'),2100);
  assert.equal(h.run('p.quantities.get("mass").qty'),1500);
  assert.equal(h.run('p.quantities.get("ขวด").qty'),2);
  assert.equal(h.run('p.quantities.get("unknown").qty'),null);
  assert.equal(h.run('materialHistoryQuantityText(p.quantities.get("volume"))'),'2.1 ลิตร');
});

test('legacy single-stock records use saved cost without mirroring modern item fields or current stock prices', () => {
  const h=harness();h.run(`S.stock=[{id:'s',name:'Legacy A',category:'ยากำจัดศัตรูพืช',avgCost:9999,unit:'ขวด',size:'10 ลิตร'}];
    S.tasks=[{id:'old',plotId:'p',cycleId:'c2',type:'spray',date:'2026-10-01',status:'done',stockId:'s',qty:0.5,unit:'ขวด',cost:20,costCat:'chemical'},
      {...task('new','c2',[{...item('A',100,0),stockId:'s'}]),stockId:'s',qty:200}];const model=materialHistoryModel(S.tasks);`);
  assert.equal(h.run('model.cost'),20); assert.equal(h.run('model.missingCosts'),0);
  assert.equal(h.run('model.products.find(p=>p.name==="Legacy A").quantities.get("ขวด").qty'),0.5);
  assert.equal(h.run('model.rows.length'),2);
});

test('mismatched or missing legacy costs remain explicit, while zero costs stay zero', () => {
  const h=harness();h.run(`S.tasks=[{...task('mismatch'),cost:999},task('missing','c2',[{name:'B',category:'chemical',qty:2,unit:'ขวด'}]),task('zero','c2',[item('C',1,0)])];const model=materialHistoryModel(S.tasks);`);
  assert.equal(h.run('model.cost'),0);assert.equal(h.run('model.missingCosts'),2);
  assert.match(h.run('materialHistoryHtml("p")'),/ตรวจต้นทุนเดิม/);
  assert.equal(h.run('model.products.find(p=>p.name==="C").missingCosts'),0);
});

test('filters use actual dates and line categories, do not reuse another scope, and reset month when changing cycles', () => {
  const h=harness();h.run(`S.tasks=[{...task('a','c2',[item('A'),{...item('B'),category:'fertilizer'}]),date:'2026-10-01',doneDate:'2026-11-12'}];
    const november=materialHistoryModel(S.tasks,{month:'2026-11',category:'fertilizer'});
    App.materialHistoryFilter('plot:p','month','2026-11'); App.materialHistoryFilter('plot:p','cycle','c1');`);
  assert.equal(h.run('november.rows.length'),1);assert.equal(h.run('november.cost'),10);
  assert.equal(h.run('materialHistoryModel(S.tasks,{month:"2026-10"}).rows.length'),0);
  assert.equal(h.run('materialHistoryFilters.get("plot:p").month'),'');
  assert.equal(h.run('materialHistoryFilters.has("cycle:c2")'),false);
});

test('a linked material edit refreshes both views from the one task and leaves stock/project/cycle totals unchanged on reads', () => {
  const h=harness();h.run(`S.projects=[{id:'pr',stages:[]}];S.stock=[{id:'s',name:'A',qty:5,openQty:1,avgCost:100}];
    const saved=addTask(S,{...task('saved','c2',[{...item('A',500,50),stockId:'s',qty:0.5,stockMode:'open'}]),projectId:'pr'});
    const amended=[{...saved.costItems[0],usageQty:800,qty:0.8,totalCost:80}];
    updateTask(S,saved.id,{costItems:amended,cost:80},'keep');
    const before=JSON.stringify(S); const model=materialHistoryModel(S.tasks); materialHistoryHtml('p');
    App.materialHistoryFilter('plot:p','view','products'); materialHistoryHtml('p');`);
  assert.equal(h.run('model.cost'),80);assert.equal(h.run('model.products[0].quantities.get("volume").qty'),800);
  assert.equal(h.run('S.tasks.length'),1);assert.equal(h.run('JSON.stringify(S)===before'),true);
  assert.equal(h.run('cycleFinance(S,"c2").cost'),80);assert.equal(h.run('projectCosts(projectById("pr")).cost'),80);
});

test('material names and identifiers are escaped in date and expanded-product views', () => {
  const h=harness();h.run(`S.tasks=[task('a"bad','c2',[item('<img src=x onerror=alert(1)>')])];`);
  for (const view of ['dates','products']) {
    h.run(`App.materialHistoryFilter('plot:p','view',${JSON.stringify(view)});`);
    const html=h.run('materialHistoryHtml("p")');
    assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);assert.match(html,/App\.viewTask/);
  }
});

test('name search filters matching lines in both views without adding other materials or changing ledger totals', () => {
  const h=harness();h.run(`S.projects=[{id:'pr',stages:[]}];
    S.tasks=[{...task('a','c2',[item('ยา ตัวอย่าง A',800,120),item('สารร่วม B',250,45),{name:'แรง',category:'labor',totalCost:150}]),projectId:'pr'},
      task('b','c2',[item('ยา ตัวอย่าง A',1000,150)]),task('old','c1',[item('ยา ตัวอย่าง A',500,75)]),
      task('plan','c2',[item('ยา ตัวอย่าง A',1000,100)],'planned')];
    const before=JSON.stringify(S);
    const selected=materialHistoryScope('p','c2');
    const model=materialHistoryModel(selected.tasks,{query:'  ตัวอย่าง   a  ',month:'2026-11',category:'chemical'});
    const dates=materialHistoryResultsHtml(model,false), products=materialHistoryResultsHtml(model,true);`);
  assert.equal(h.run('model.cost'),270);assert.equal(h.run('model.rows.length'),2);
  assert.equal(h.run('model.products.length'),1);assert.equal(h.run('model.planned.length'),1);
  assert.equal(h.run('model.products[0].quantities.get("volume").qty'),1800);
  for(const view of ['dates','products']){assert.match(h.run(view),/270 บาท/);assert.doesNotMatch(h.run(view),/สารร่วม B/);}
  assert.equal(h.run('materialHistoryModel(selected.tasks,{query:"ไม่มีชื่อนี้"}).rows.length'),0);
  assert.equal(h.run('materialHistoryModel(selected.tasks,{query:"   "}).cost'),315);
  assert.equal(h.run('JSON.stringify(S)===before'),true);
  assert.equal(h.run('cycleFinance(S,"c2").cost'),465);assert.equal(h.run('projectCosts(projectById("pr")).cost'),315);
});

test('record shortcut preserves selected, closed, unassigned and fixed cycles and requires a choice for multiple active cycles', () => {
  const h=harness();h.run(`let captured=null; App.modalTask=(date,preset)=>{captured=preset}; const before=JSON.stringify(S); App.materialHistoryAdd('p');`);
  assert.equal(h.run('captured.cycleId'),'c2');assert.equal(h.run('captured.plotId'),'p');
  assert.equal(h.run('captured.status'),'done');assert.equal(h.run('captured.type'),'spray');
  h.run(`App.materialHistoryFilter('plot:p','cycle','c1'); App.materialHistoryAdd('p');`);
  assert.equal(h.run('captured.cycleId'),'c1');
  h.run(`App.materialHistoryFilter('plot:p','cycle','__none__'); App.materialHistoryAdd('p');`);
  assert.equal(h.run('captured.cycleId'),'__none__');
  h.run(`App.materialHistoryFilter('cycle:c2','category','fertilizer'); App.materialHistoryAdd('p','c2');`);
  assert.equal(h.run('captured.cycleId'),'c2');assert.equal(h.run('captured.type'),'fertilize');
  assert.equal(h.run('JSON.stringify(S)===before'),true);
  h.run(`captured=null;App.materialHistoryAdd('p','other');App.materialHistoryAdd('missing');`);
  assert.equal(h.run('captured'),null);
  h.run(`S.cycles.push({id:'c3',plotId:'p',status:'active'});App.materialHistoryFilter('plot:p','cycle','');App.materialHistoryAdd('p');`);
  assert.equal(h.run('captured.cycleId'),'');
  h.run(`S.cycles.forEach(c=>c.status='done');App.materialHistoryAdd('p');`);
  assert.equal(h.run('captured.cycleId'),'__none__');
});

test('shortcut opens a draft only; one canonical save, repeated searches and edit-save count stock and linked costs once', () => {
  const h=harness();h.run(`S.projects=[{id:'pr',stages:[]}];S.stock=[{id:'s',name:'A',qty:5,openQty:1,avgCost:100}];
    let preset; App.modalTask=(date,context)=>{preset=context};
    const before=JSON.stringify(S);App.materialHistoryAdd('p'); const untouched=JSON.stringify(S)===before;
    const saved=addTask(S,{...task('saved'),...preset,projectId:'pr',costItems:[{...item('A',500,50),stockId:'s',qty:0.5,stockMode:'open'}],cost:50});
    const afterSave=JSON.stringify(S.stock);
    for(let i=0;i<5;i++){materialHistoryModel(S.tasks,{query:'A'});materialHistoryHtml('p');}
    updateTask(S,saved.id,{costItems:JSON.parse(JSON.stringify(saved.costItems)),cost:50},'keep');`);
  assert.equal(h.run('untouched'),true);assert.equal(h.run('S.tasks.length'),1);
  assert.equal(h.run('JSON.stringify(S.stock)===afterSave'),true);
  assert.equal(h.run('cycleFinance(S,"c2").cost'),50);assert.equal(h.run('projectCosts(projectById("pr")).cost'),50);
  assert.equal(h.run('materialHistoryModel(S.tasks).cost'),50);
});
