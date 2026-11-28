const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function setup(ui=false){
  const storage=new Map(),c=vm.createContext({console,Date,JSON,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout(){},window:{addEventListener(){}},document:{getElementById(){return null;}},Auth:{session:{email:'batch@example.invalid'}},App:{},route:{view:'batchWork'},esc:s=>String(s??'').replace(/[<>&"']/g,v=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[v])),ic:()=>'',dateLabel:d=>d});
  const run=s=>vm.runInContext(s,c);run(read('js/data.js'));
  const source=read('js/batch-work.js');run(ui?source:source.slice(0,source.indexOf('const BatchWork=')));
  run(`Object.assign(S,{plots:[{id:'plot',name:'Plot',sizeRai:4}],cycles:[{id:'cycle',plotId:'plot',status:'active',plant:'Corn',round:1}],projects:[{id:'project',name:'Project',plotId:'plot',cycleId:'cycle',status:'active',stages:[{id:'stage',name:'Work'}]}],tasks:[],stock:[{id:'stock',name:'Material',unit:'ขวด',size:'500 cc',qty:3,openQty:0,avgCost:380}]});
    const item=(extra={})=>({source:'external',name:'Fertilizer',category:'fertilizer',qty:'2',unit:'kg',amount:'120',...extra});
    const row=(extra={})=>({id:uid(),date:todayISO(),title:'Apply fertilizer',type:'fertilize',items:[item()],labor:'80',...extra});
    const draft=(rows=[row()])=>({version:1,id:uid(),context:{plotId:'plot',cycleId:'cycle',projectId:'project',stageId:'stage'},rows});`);
  return {c,run,storage};
}
test('sheet parser handles quoted CSV, Thai numbers, Buddhist dates and real calendar validation',()=>{
  const {run}=setup();assert.equal(run(`batchWorkDate('๒๘/๑๑/๒๕๖๙')`),'2026-11-28');assert.equal(run(`batchWorkNumber('1,250.50 บาท','cost')`),1250.5);
  assert.throws(()=>run(`batchWorkDate('31/02/2569')`),/วันที่/);assert.throws(()=>run(`batchWorkNumber('1,2','cost')`),/ตัวเลข/);
  assert.equal(run(`batchWorkReadCells(${JSON.stringify('date,title,note\n"2026-11-28","quoted, task","line 1\nline 2"')})[1][2]`),'line 1\nline 2');
  assert.throws(()=>run(`batchWorkReadCells(${JSON.stringify('title\tamount\nname\t=1+1')})`),/สูตร/);
});
test('mapped sheet groups several materials into one task and charges repeated group labor once',()=>{
  const {run}=setup();run(`const cells=[['2026-11-27','Feed','fertilize','A','2','kg','120','80','','g1'],['2026-11-27','Feed','fertilize','B','3','kg','0','80','yes','g1']];const rows=batchWorkPasteRows(cells,['date','title','type','material','qty','unit','amount','labor','supported','group'],false);const d=draft(rows),p=batchWorkPlan(S,d);`);
  assert.equal(run('rows.length'),1);assert.equal(run('rows[0].items.length'),2);assert.equal(run('p.valid'),true);assert.equal(run('p.total'),200);assert.equal(run(`p.details[0].task.costItems.filter(i=>i.category==='labor').length`),1);
  assert.equal(run('S.tasks.length'),0);assert.equal(run('S.stock[0].qty'),3);
});
test('conflicting grouped dates or labor and positive supported amounts cannot silently merge',()=>{
  const {run}=setup();run(`const cells=[['2026-11-27','Feed','80','group'],['2026-11-27','Feed','90','group']];`);
  assert.throws(()=>run(`batchWorkPasteRows(cells,['date','title','labor','group'],false)`),/ค่าแรง/);
  assert.throws(()=>run(`batchWorkPasteRows([['2026-11-27','Feed','100','yes']],['date','title','amount','supported'],false)`),/ยอดจ่าย/);
  assert.throws(()=>run(`batchWorkPasteRows([['a','b']],['title','title'],false)`),/ครั้งเดียว/);
});
test('material quantity and money are explicit; missing price is never inferred as free sponsorship',()=>{
  const {run}=setup();for(const extra of [`{qty:''}`,`{qty:'-1'}`,`{amount:''}`,`{unit:''}`,`{amount:'abc'}`])assert.equal(run(`batchWorkPlan(S,draft([row({items:[item(${extra})]})])).valid`),false);
  assert.equal(run(`batchWorkPlan(S,draft([row({items:[item({amount:'0'})]})])).valid`),true);
  assert.equal(run(`batchWorkPlan(S,draft([row({items:[item({source:'supported',amount:'',qty:''})]})])).valid`),false);
  assert.equal(run(`batchWorkPlan(S,draft([row({items:[item({source:'supported',amount:''})],labor:''})])).total`),0);
});
test('measured stock converts units, previews balances and commits through the canonical ledger once',()=>{
  const {run}=setup();run(`const d=draft([row({items:[item({source:'stock',stockId:'stock',qty:'100',unit:'ml'})],labor:'24'})]);const before=JSON.stringify(S);const p=batchWorkPlan(S,d);`);
  assert.equal(run('p.total'),100);assert.equal(run('JSON.stringify(S)===before'),true);
  assert.equal(run('p.stocks[0].after'),2);assert.equal(run('p.stocks[0].openAfter'),.8);
  run(`let writes=0;batchWorkCommit(S,d,()=>{writes++;return true;},p.signature);batchWorkCommit(S,d,()=>{writes++;return true;});`);
  assert.equal(run('S.tasks.length'),1);assert.equal(run('writes'),1);assert.equal(run('S.stock[0].qty'),2);assert.equal(run('S.stock[0].openQty'),.8);
  assert.equal(run(`taskFinance(S,t=>t.projectId==='project').cost`),100);assert.equal(run(`taskFinance(S,t=>t.cycleId==='cycle').cost`),100);
});
test('combined stock shortages leave every task and stock unchanged',()=>{
  const {run}=setup();run(`const d=draft([row({items:[item({source:'stock',stockId:'stock',qty:'1000',unit:'ml'})]}),row({title:'Second',items:[item({source:'stock',stockId:'stock',qty:'1000',unit:'ml'})]})]);const before=JSON.stringify(S);const p=batchWorkPlan(S,d);`);
  assert.equal(run('p.valid'),false);assert.match(run('p.errors[0].message'),/ไม่พอ|พร้อมใช้/);assert.throws(()=>run('batchWorkCommit(S,d,()=>true)'),/ตรวจ/);assert.equal(run('JSON.stringify(S)===before'),true);
});
test('incompatible stock units and missing catalog cost cannot be confirmed',()=>{
  const {run}=setup();assert.equal(run(`batchWorkPlan(S,draft([row({items:[item({source:'stock',stockId:'stock',unit:'kg'})]})])).valid`),false);
  run('delete S.stock[0].avgCost');assert.equal(run(`batchWorkPlan(S,draft([row({items:[item({source:'stock',stockId:'stock',unit:'ml'})]})])).valid`),false);
});
test('storage failure and changed prices after review are atomic and retryable',()=>{
  const {run}=setup();run(`const d=draft([row({items:[item({source:'stock',stockId:'stock',qty:'100',unit:'ml'})]})]);const before=JSON.stringify(S),p=batchWorkPlan(S,d);`);
  assert.throws(()=>run('batchWorkCommit(S,d,()=>false,p.signature)'),/เก็บข้อมูล/);assert.equal(run('JSON.stringify(S)===before'),true);
  run('S.stock[0].avgCost=400');assert.throws(()=>run('batchWorkCommit(S,d,()=>true,p.signature)'),/เปลี่ยน/);assert.equal(run('S.tasks.length'),0);
  run('batchWorkCommit(S,d,()=>true,batchWorkPlan(S,d).signature)');assert.equal(run('S.tasks.length'),1);
});
test('pasted duplicates in one batch and against saved history require an explicit separate-work decision',()=>{
  const {run}=setup();run(`const d=draft();batchWorkCommit(S,d,()=>true);const copied=draft([row()]);const p=batchWorkPlan(S,copied);`);
  assert.equal(run('p.valid'),false);assert.equal(run('p.duplicates.length'),1);
  run(`copied.rows[0].allowDuplicate=true;batchWorkCommit(S,copied,()=>true);`);assert.equal(run('S.tasks.length'),2);
  assert.equal(run(`batchWorkPlan({...S,tasks:[]},draft([row(),row()])).duplicates.length`),1);
});
test('same batch row cannot be changed and resubmitted as a second activity',()=>{
  const {run}=setup();run(`const d=draft();batchWorkCommit(S,d,()=>true);d.rows[0].labor='100';`);assert.equal(run('batchWorkPlan(S,d).valid'),false);assert.equal(run('S.tasks.length'),1);
});
test('normal history editing restocks then reapplies once without a parallel batch cost record',()=>{
  const {run}=setup();run(`const d=draft([row({items:[item({source:'stock',stockId:'stock',qty:'100',unit:'ml'})],labor:'24'})]);batchWorkCommit(S,d,()=>true);const t=S.tasks[0],items=batchWorkClone(t.costItems);items[1].totalCost=34;items[1].externalTotal=34;updateTask(S,t.id,{costItems:items});const after=JSON.stringify(S.stock);updateTask(S,t.id,{costItems:items});`);
  assert.equal(run('S.tasks[0].cost'),110);assert.equal(run('S.tasks.length'),1);assert.equal(run('JSON.stringify(S.stock)===after'),true);assert.equal(run('S.stock[0].openQty'),.8);
});
test('closed/mismatched context and future dates block the whole batch',()=>{
  const {run}=setup();assert.equal(run(`batchWorkPlan(S,draft([row({date:addDaysISO(todayISO(),1)})])).valid`),false);
  run(`S.projects[0].status='done'`);assert.throws(()=>run('batchWorkPlan(S,draft())'),/โครงการ/);
  run(`S.projects[0].status='active';S.cycles[0].plotId='another'`);assert.throws(()=>run('batchWorkPlan(S,draft())'),/รอบปลูก/);
});
test('copy previous work keeps materials and expenses but drops IDs, photos, measurements and completion',()=>{
  const {run}=setup();run(`const t={id:'original',date:'2026-01-01',title:'Previous',type:'fertilize',status:'done',photos:['private'],donePhotos:['private'],trialId:'trial',costItems:[{name:'A',category:'fertilizer',qty:2,unit:'kg',totalCost:0,funding:'supported'},{name:'Labor',category:'labor',totalCost:50}]};const original=JSON.stringify(t),r=batchWorkCopyRow(t,S);`);
  assert.notEqual(run('r.id'),'original');assert.equal(run('r.date===todayISO()'),true);assert.equal(run('r.items[0].source'),'supported');assert.equal(run('r.labor'),'50');assert.equal(run('r.photos'),undefined);assert.equal(run('r.trialId'),undefined);assert.equal(run('JSON.stringify(t)===original'),true);
});
test('batch rendering escapes spreadsheet text and avoids unintended form submits',()=>{
  const {run}=setup(true);run(`BatchWork.owner=BatchWork.key();BatchWork.draft=draft([row({title:'<img src=x onerror=bad()>',note:'" onclick="bad()'})]);const html=renderBatchWork();`);
  assert.match(run('html'),/&lt;img/);assert.doesNotMatch(run('html'),/<img src=x/);assert.equal(run(`(html.match(/<button(?![^>]*\\btype=)/g)||[]).length`),0);
});
test('drafts stay account scoped and do not write the task ledger',()=>{
  const {run,storage}=setup(true);const before=storage.size;run(`BatchWork.owner=BatchWork.key();BatchWork.draft=draft();BatchWork.persist();`);assert.equal(storage.size,before+1);assert.equal(run('S.tasks.length'),0);
  run(`Auth.session.email='another@example.invalid'`);assert.equal(run('BatchWork.read()'),null);assert.equal(run('BatchWork.persist()'),false);
});
test('account changes clear pending sheet data and completed receipts',()=>{
  const {run}=setup(true);run(`BatchWork.owner=BatchWork.key();BatchWork.draft=draft();BatchWork.pasteRaw='private draft';BatchWork.pasteCells=[['private draft']];BatchWork.panel='paste';BatchWork.message='private message';Auth.session.email='another@example.invalid';renderBatchWork();`);
  assert.equal(run('BatchWork.pasteRaw'),'');assert.equal(run('BatchWork.pasteCells'),null);assert.equal(run('BatchWork.panel'),'');assert.equal(run('BatchWork.message'),'');
});
test('copy and paste preserve partial rows containing labor, quantity or notes',()=>{
  const {run}=setup();assert.equal(run(`batchWorkHasInput(batchWorkBlankRow())`),false);
  for(const extra of [`{labor:'0'}`,`{note:'keep'}`,`{items:[{...batchWorkBlankItem(),qty:'2'}]}`,`{items:[{...batchWorkBlankItem(),source:'stock'}]}`])assert.equal(run(`batchWorkHasInput({...batchWorkBlankRow(),...${extra}})`),true);
});
test('editing pasted raw text invalidates the previous preview before import',()=>{
  const {run}=setup(true);run(`BatchWork.pasteCells=[['old']];BatchWork.pasteInput('changed');`);
  assert.equal(run('BatchWork.pasteCells'),null);assert.match(run('BatchWork.pastePreview().error'),/อีกครั้ง/);
});
test('duplicated material lines inside one grouped task cannot silently double the expense',()=>{
  const {run}=setup();const error=run(`batchWorkPlan(S,draft([row({items:[item(),item()]})])).errors[0].message`);assert.match(error,/ซ้ำ/);assert.equal(run('S.tasks.length'),0);
});
test('optional quantities on other expenses are preserved and still require a valid unit',()=>{
  const {run}=setup();run(`const expense=item({name:'เครื่องจักร',category:'other',qty:'3',unit:'ชั่วโมง',amount:'600'});const p=batchWorkPlan(S,draft([row({type:'expense',items:[expense],labor:''})]));`);
  assert.equal(run('p.valid'),true);assert.equal(run('p.total'),600);assert.equal(run('p.details[0].task.costItems[0].qty'),3);
  assert.equal(run(`batchWorkPlan(S,draft([row({type:'expense',items:[{...expense,unit:''}]})])).valid`),false);
});
