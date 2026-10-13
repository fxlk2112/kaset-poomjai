const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const ui=read('js/workspace.js'),flows=read('js/workspace-flows.js');

test('live activity search keeps typing focus and cannot rerender a departed page',()=>{
  const app=read('js/app.js');
  const snippet=app.slice(app.indexOf('let plannerQueryTimer;'),app.indexOf('App.clearPlannerSearch ='));
  let callback,renders=0,focused=0,selection;
  const input={value:'test',isConnected:true,selectionStart:2,selectionEnd:2};
  const ctx={App:{},plannerSearch:{},plannerFilter:'today',route:{view:'planner'},setTimeout:fn=>{callback=fn;return 1;},clearTimeout:()=>{},
    document:{activeElement:input,getElementById:()=>({focus:()=>focused++,setSelectionRange:(...args)=>selection=args})},rerender:()=>renders++};
  vm.createContext(ctx);vm.runInContext(snippet,ctx);
  ctx.App.plannerQueryInput(input,{});assert.equal(ctx.plannerSearch.query,'test');callback();
  assert.equal(renders,1);assert.equal(focused,1);assert.deepEqual(selection,[2,2]);
  ctx.App.plannerQueryInput(input,{});ctx.route.view='home';callback();assert.equal(renders,1);
  ctx.route.view='planner';input.isConnected=false;callback();assert.equal(renders,1);
});

test('workspace shell is enabled only for a signed-in owner surface',()=>{
  const body=ui.match(/enabled\(\) \{([^}]+)\}/)[1];
  const enabled=Auth=>vm.runInNewContext('(function(){'+body+'})()',{Auth});
  assert.equal(enabled({session:null}),false);
  assert.equal(enabled({session:{token:'a'},shareMode:true}),false);
  assert.equal(enabled({session:{token:'a'},landingMode:true}),false);
  assert.equal(enabled({session:{token:'a'}}),true);
  assert.match(ui,/if\(!enabled\)/);
  assert.match(flows,/if\(!Concept.enabled\(\)\)/);
});

test('team rerenders preserve current page without closing dialogs or reloading',()=>{
  const start=flows.indexOf('let workspaceTeamToken=null;');
  const end=flows.indexOf('const workflowsModalTask=',start);
  let loads=0,scopes=0,searches=0;
  const page={innerHTML:'existing'};
  const context={route:{view:'team'},Auth:{session:{token:'a'}},Concept:{enabled:()=>true},
    document:{getElementById:()=>page},workflowsRender:()=>{page.innerHTML='loading';},
    ConceptWorkflows:{scope:()=>scopes++,teamSearch:()=>searches++},Team:{open:()=>{loads++;page.innerHTML='page 2';}}};
  vm.createContext(context);vm.runInContext(flows.slice(start,end),context);
  context.render();assert.equal(loads,1);
  page.innerHTML='page 2 filtered';context.render();
  assert.equal(loads,1);assert.equal(page.innerHTML,'page 2 filtered');assert.equal(searches,1);
  context.route.view='home';context.render();context.route.view='team';context.render();assert.equal(loads,2);
  context.Auth.session.token='b';context.render();assert.equal(loads,3);
});

test('production assets keep public screens, offline shell and real API isolated from the demo',()=>{
  const index=read('index.html'),sw=read('sw.js'),css=read('css/workspace.css');
  for(const file of ['js/workspace.js','js/workspace-flows.js','css/workspace.css']){
    assert.ok(index.includes(file));assert.ok(sw.includes('/'+file));
  }
  assert.match(index,/serviceWorker.register/);
  assert.match(css,/body:not\(\.concept\)/);
  for(const content of [index,ui,flows,read('js/auth.js')])assert.doesNotMatch(content,/__preview|preview-only|demo-state|สำเนาทดลอง|สำเนา UI ทดลอง/);
  assert.match(ui,/workspaceOriginalHome\(\)/);
  assert.match(ui,/p.photoUrl/);
  assert.doesNotMatch(css,/#syncStatus\s*\{\s*display:none/);
  assert.match(read('js/auth.js'),/App.nav\('settings'\)/);
});
