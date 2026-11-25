const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const c=vm.createContext({App:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/projects.js'),'utf8'),c);
function state(){return {cycles:[{id:'c1',plotId:'p1'},{id:'c2',plotId:'p1'},{id:'c3',plotId:'p2'}],tasks:[],projects:[
  {id:'exact',name:'Trial',plotId:'p1',cycleId:'c1',status:'active'},
  {id:'ordinary',name:'Work',plotId:'p1',cycleId:'c1',status:'active'},
  {id:'plot',name:'All rounds',plotId:'p1',status:'active'},
  {id:'old',name:'Other round',plotId:'p1',cycleId:'c2',status:'active'},
  {id:'other',name:'Other plot',plotId:'p2',cycleId:'c3',status:'active'},
  {id:'closed',name:'Closed',plotId:'p1',cycleId:'c1',status:'done'},
  {id:'general',name:'General',status:'active'}]};}
const context=[{plotId:'p1',cycleId:'c1'}];
const ids=result=>Array.from(result.recommended,r=>r.project.id);
test('suggestions prioritize the exact plot/cycle, then plot-wide projects, without mutation or automatic selection',()=>{
  const s=state(),before=JSON.stringify(s),result=c.taskProjectChoices(s,context);
  assert.deepEqual(ids(result),['exact','ordinary','plot']);assert.equal(result.selectedId,'');
  assert.equal(JSON.stringify(s),before);assert.ok(!result.available.some(p=>p.id==='closed'));
});
test('changing round clears a stale link, keeps a plot-wide choice and respects no-project choice',()=>{
  const s=state(),next=[{plotId:'p1',cycleId:'c2'}];
  const stale=c.taskProjectChoices(s,next,{selectedId:'exact',contextChanged:true});
  assert.equal(stale.selectedId,'');assert.equal(stale.cleared,true);assert.deepEqual(ids(stale),['old','plot']);
  assert.equal(c.taskProjectChoices(s,next,{selectedId:'plot',contextChanged:true}).selectedId,'plot');
  assert.equal(c.taskProjectChoices(s,context,{selectedId:'',contextChanged:true}).selectedId,'');
});
test('explicit other-project and existing closed-project links survive initialization but closed projects cannot be newly selected',()=>{
  const s=state();
  assert.equal(c.taskProjectChoices(s,context,{selectedId:'general'}).selectedId,'general');
  const edited=c.taskProjectChoices(s,context,{selectedId:'closed',editingProjectId:'closed'});
  assert.equal(edited.selectedId,'closed');assert.ok(!ids(edited).includes('closed'));
  assert.equal(c.taskProjectChoices(s,context,{selectedId:'closed'}).selectedId,'');
  assert.equal(c.taskProjectChoices(s,[],{selectedId:'exact',contextChanged:true}).selectedId,'');
});
test('multi-plot suggestions require a project covering every selected context',()=>{
  const s=state(),both=[...context,{plotId:'p2',cycleId:'c3'}];
  assert.deepEqual(ids(c.taskProjectChoices(s,both)),[]);
  assert.equal(c.taskProjectChoices(s,both,{selectedId:'exact',contextChanged:true}).selectedId,'');
  s.projects.push({id:'legacy',name:'Shared field project',status:'active'});
  s.tasks=[{projectId:'legacy',plotId:'p1',cycleId:'c1'},{projectId:'legacy',plotId:'p2',cycleId:'c3'}];
  assert.deepEqual(ids(c.taskProjectChoices(s,both)),['legacy']);
  assert.deepEqual(ids(c.taskProjectChoices(s,[...context,{plotId:'p2',cycleId:''}])),[]);
});
test('missing cycle, no-crop scope and inconsistent plot/cycle do not recommend a different round',()=>{
  const s=state();
  for(const cycleId of ['','__none__'])assert.deepEqual(ids(c.taskProjectChoices(s,[{plotId:'p1',cycleId}])),['plot']);
  assert.deepEqual(ids(c.taskProjectChoices(s,[{plotId:'p2',cycleId:'c1'}])),[]);
  s.projects.push({id:'cycle-only',name:'Cycle scoped',cycleId:'c1',status:'active'});
  assert.ok(ids(c.taskProjectChoices(s,context)).includes('cycle-only'));
  assert.deepEqual(ids(c.taskProjectChoices(s,[])),[]);
});
