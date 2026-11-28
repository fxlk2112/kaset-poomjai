const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function harness(){
  const storage=new Map();
  const ctx=vm.createContext({console,Date,App:{},route:{},render(){},toast(){},closeModal(){},setTimeout(){},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)}});
  const run=source=>vm.runInContext(source,ctx);
  for(const file of ['data','projects','project-workspace','cycle-notebook'])run(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'));
  run(`S.tasks=[];S.trials=[];S.plots=[{id:'plot',sizeRai:10}];S.cycles=[{id:'cycle',plotId:'plot',status:'active'}];
    S.stock=[{id:'stock',name:'Synthetic material',qty:28,openQty:0.5,avgCost:180,unit:'bottle'}];
    S.projects=[{id:'project',status:'active',stages:[{id:'stage'}]},{id:'second',status:'active',stages:[{id:'stage2'}]}];
    const items=[{category:'chemical',stockId:'stock',name:'Synthetic material',qty:0.5,unit:'bottle',stockMode:'open',unitCost:180,totalCost:90},
      {category:'labor',name:'Synthetic labor',qty:0,externalPriceMode:'total',externalTotal:210,totalCost:210}];
    const activity={title:'Synthetic spray',type:'spray',status:'done',date:'2026-11-25',doneDate:'2026-11-25',plotId:'plot',cycleId:'cycle',projectId:'project',projectStageId:'stage',costItems:items};
    function totals(){return [plotFinance(S,'plot').cost,cycleFinance(S,'cycle').cost,projectCosts(projectById('project')).cost,notebookModel(S.cycles[0]).finance.cost,ytdFinance(S,2026).cost].join(',');}`);
  return {run};
}

test('one linked stock activity reconciles plot, crop-cycle, project and annual costs through repeated edits and reload',()=>{
  const h=harness();h.run('const task=addTask(S,activity);');
  assert.equal(h.run('totals()'),'300,300,300,300,300');
  assert.equal(h.run('S.tasks.length'),1);
  assert.equal(h.run('projectTaskList(projectById("project"))[0]===notebookModel(S.cycles[0]).tasks[0]'),true);
  assert.equal(h.run('S.stock[0].qty'),28);assert.equal(h.run('S.stock[0].openQty'),0);
  h.run(`const edited=JSON.parse(JSON.stringify(task.costItems));edited[1].externalTotal=260;edited[1].totalCost=260;
    updateTask(S,task.id,{costItems:edited,cost:edited.reduce((sum,item)=>sum+item.totalCost,0)},'keep');`);
  assert.equal(h.run('totals()'),'350,350,350,350,350');
  h.run(`updateTask(S,task.id,{costItems:JSON.parse(JSON.stringify(S.tasks.find(t=>t.id===task.id).costItems))},'keep');`);
  assert.equal(h.run('totals()'),'350,350,350,350,350');assert.equal(h.run('S.tasks.length'),1);
  assert.equal(h.run('S.stock[0].qty'),28);assert.equal(h.run('S.stock[0].openQty'),0);
  h.run('saveState(S);Object.assign(S,loadState());');
  assert.equal(h.run('totals()'),'350,350,350,350,350');assert.equal(h.run('S.tasks.length'),1);
  assert.equal(h.run('projectTaskList(projectById("project"))[0].id'),h.run('task.id'));
});

test('project relinking never adds a cost and planned/failed tasks are excluded until the existing task completes',()=>{
  const h=harness();h.run(`const task=addTask(S,{...activity,status:'planned'});`);
  assert.equal(h.run('totals()'),'0,0,0,0,0');assert.equal(h.run('S.stock[0].openQty'),0.5);
  h.run(`updateTask(S,task.id,{status:'failed'});`);
  assert.equal(h.run('totals()'),'0,0,0,0,0');
  h.run(`updateTask(S,task.id,{status:'done'});updateTask(S,task.id,{status:'done'});`);
  assert.equal(h.run('totals()'),'300,300,300,300,300');assert.equal(h.run('S.stock[0].openQty'),0);
  h.run(`App.projectMoveTask(task.id,'');App.projectAttachTask('second','stage2',task.id);App.projectAttachTask('second','stage2',task.id);`);
  assert.equal(h.run('totals()'),'300,300,0,300,300');
  assert.equal(h.run('projectCosts(projectById("second")).cost'),300);assert.equal(h.run('S.tasks.length'),1);
  assert.equal(h.run('S.stock[0].qty'),28);assert.equal(h.run('S.stock[0].openQty'),0);
});
