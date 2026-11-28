const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const ORIGIN='https://farm.example.invalid';
const FIXTURE_SESSION='synthetic-project-sync-session';

// Exercise the shipped Pages and Worker handlers with SQLite/R2 adapters in memory.
// No network, live accounts, cloud resources or credentials are used.
async function server(t){
  const {default:worker}=await import(pathToFileURL(path.join(root,'worker/src/lark.js')));
  const {onRequest}=await import(pathToFileURL(path.join(root,'functions/api/[[path]].js')));
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(source('worker/schema.sql'));
  db.prepare('INSERT INTO users (id,email,pass_hash,name,created_at) VALUES (?,?,?,?,?)')
    .run('fixture-owner','sync@example.invalid','unused-fixture','Synthetic owner',1);
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(FIXTURE_SESSION,'fixture-owner',Date.now()+86400000);
  const objects=new Map(),requests=[];
  const env={DB:{prepare(sql){
    const statement=db.prepare(sql);let bindings={};
    return {bind(...values){bindings=Object.fromEntries(values.map((value,index)=>['?'+(index+1),value]));return this;},
      async first(){return statement.get(bindings)||null;},
      async all(){return {results:statement.all(bindings)};},
      async run(){return {meta:{changes:Number(statement.run(bindings).changes)}};}};
  }},PHOTOS:{
    async put(key,body,options){objects.set(key,{body:new Uint8Array(body),httpMetadata:options.httpMetadata});},
    async get(key){return objects.get(key)||null;},
    async delete(key){objects.delete(key);}
  }};
  const api={db,objects,requests,bindingAvailable:true,
    async fetch(url,options={}){
      assert.equal(new URL(url).origin,ORIGIN,'browser requests remain same-origin');
      const request=new Request(url,options);
      if(!new URL(url).pathname.startsWith('/api'))return new Response('Not found',{status:404});
      if(options.body)requests.push(JSON.parse(options.body).action);
      return onRequest({request,env:api.bindingAvailable?{FARMULTIMATE_API:{fetch:r=>worker.fetch(r,env)}}:{}});
    },
    async call(action,extra={}){return (await api.fetch(ORIGIN+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:FIXTURE_SESSION,...extra})})).json();},
    snapshot(){const row=db.prepare('SELECT data,updated_at FROM user_data WHERE user_id=?').get('fixture-owner');return row?{data:JSON.parse(row.data),revision:row.updated_at}:null;}
  };
  return api;
}

function device(api,sharedStorage){
  const storage=sharedStorage||new Map([['farmult-session-v1',JSON.stringify({email:'sync@example.invalid',token:FIXTURE_SESSION,name:'Synthetic owner'})]]);
  const document={hidden:false,activeElement:null,
    documentElement:{dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){}},
    getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{addEventListener(){}},navigator:{onLine:true},
    location:{href:ORIGIN+'/',search:''},URL,Date,AbortController,console,App:{},route:{},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){},render(){},toast(){},closeModal(){},
    fetch:(url,options)=>api.fetch(url,options)});
  const run=code=>vm.runInContext(code,context);
  for(const file of ['runtime-config','data','recovery','auth','projects','project-workspace','project-planner','project-records','project-report'])run(source('js/'+file+'.js'));
  const app=source('js/app.js');
  run(app.slice(app.indexOf('function trialById('),app.indexOf('function trialSamplingNotice(')));
  run(app.slice(app.indexOf('function trialValidDate('),app.indexOf('function trialDateInRange(')));
  run(`S.plots=[];S.cycles=[];S.tasks=[];S.projects=[];S.trials=[];S.stock=[];S.sales=[];S.projectSequences={};setCloudTs(0);setLocalDirty(false);this.auth=Auth;this.state=S;`);
  return {context,run,storage,auth:context.auth,state:context.state};
}

function createProject(c){
  c.run(`
    S.plots=[{id:'plot',name:'Synthetic plot',sizeRai:10}];
    S.cycles=[{id:'cycle',plotId:'plot',plant:'Synthetic crop',status:'active'}];
    S.stock=[{id:'stock',name:'Synthetic material',qty:10,openQty:0.5,avgCost:180,unit:'bottle'}];
    const p=projectCreateSimple('Synthetic care project','plot','cycle');
    const task=addTask(S,{title:'Synthetic material work',type:'spray',status:'done',date:todayISO(),doneDate:todayISO(),plotId:'plot',cycleId:'cycle',projectId:p.id,projectStageId:p.stages[0].id,
      costItems:[{category:'chemical',stockId:'stock',name:'Synthetic material',qty:0.5,unit:'bottle',stockMode:'open',unitCost:180,totalCost:90}]});
    p.groups=['Synthetic group'];p.measurementSchema=[{id:'height',name:'Height',unit:'cm',kind:'number'}];
    task.recordKind='measurement';
    const trial=projectSetupSamples(p,1),record=projectRecordLoad(p,task,trial);
    record.rows[0].values.height='12.5';
    record.photos=[{id:'photo',unitId:trial.units[0].id,src:'data:image/png;base64,cGhvdG8=',caption:'Synthetic evidence'}];
    record.workNote='Synthetic work note';projectRecordCommit(p,task,trial,record);
    p.reportVersions=[projectReportSnapshot(p)];
    saveState(S);
  `);
}

test('project, measurements, photos, report and canonical cost survive two clients through Pages and Worker',async t=>{
  const api=await server(t),desktop=device(api),phone=device(api);createProject(desktop);
  desktop.run(`localStorage.setItem(projectDraftKey(),'local-only-draft');`);
  assert.equal((await desktop.auth.saveNow()).ok,true);
  assert.equal((await phone.auth.saveNow()).ok,true);
  const normalized=desktop.run('normalizedAccountState(S)');
  for(const key of ['projects','trials','tasks','stock','projectSequences'])assert.deepEqual(copy(phone.state[key]),copy(normalized[key]),key);
  assert.equal(phone.state.projects[0].records[0].rows[0].values.height,'12.5');
  assert.equal(phone.state.projects[0].reportVersions[0].cost,90);
  assert.equal(phone.run('cycleFinance(S,"cycle").cost'),90);
  assert.equal(phone.run('projectCosts(S.projects[0]).cost'),90);
  assert.equal(phone.state.tasks.length,1);assert.equal(phone.state.stock[0].openQty,0);
  assert.equal(phone.storage.get(phone.run('projectDraftKey()')),undefined,'unsubmitted drafts remain device-local');
  const before=api.snapshot();await desktop.auth.saveNow();await phone.auth.saveNow();
  assert.deepEqual(api.snapshot(),before,'repeat sync neither duplicates cost nor deducts inventory again');
  phone.run(`const task=S.tasks[0];updateTask(S,task.id,{doneNote:'Edited on second device'},'keep');saveState(S);`);
  assert.equal((await phone.auth.saveNow()).ok,true);assert.equal((await desktop.auth.saveNow()).ok,true);
  assert.equal(desktop.state.tasks[0].doneNote,'Edited on second device');
  assert.equal(desktop.run('cycleFinance(S,"cycle").cost'),90);
  assert.equal(desktop.state.stock[0].openQty,0);
});

test('concurrent project edits preserve the losing device and reject stale Worker revisions',async t=>{
  const api=await server(t),a=device(api),b=device(api);createProject(a);
  await a.auth.saveNow();await b.auth.saveNow();const old=api.snapshot();
  a.run(`S.projects[0].objective='Desktop objective';saveState(S);`);
  b.run(`S.projects[0].objective='Phone objective';saveState(S);`);
  assert.equal((await a.auth.saveNow()).ok,true);
  const result=await b.auth.saveNow();assert.equal(result.conflict,true);
  assert.equal(b.state.projects[0].objective,'Phone objective');assert.equal(b.run('localDirty()'),true);
  assert.equal(api.snapshot().data.projects[0].objective,'Desktop objective');
  const stale=await api.call('save',{base_updated_at:old.revision,data:JSON.stringify(b.state)});
  assert.equal(stale.data.conflict,true);assert.equal(api.snapshot().data.projects[0].objective,'Desktop objective');
});

test('offline and unavailable binding retain project changes for retry and never report success',async t=>{
  const api=await server(t),c=device(api);createProject(c);const before=copy(c.state);
  c.context.navigator.onLine=false;
  assert.equal((await c.auth.saveNow()).offline,true);assert.equal(api.requests.length,0);
  c.context.navigator.onLine=true;api.bindingAvailable=false;
  assert.equal((await c.auth.saveNow()).ok,false);assert.equal(c.auth.syncState,'error');
  assert.equal(c.run('localDirty()'),true);assert.deepEqual(copy(c.state),before);assert.equal(api.snapshot(),null);
  api.bindingAvailable=true;assert.equal((await c.auth.saveNow()).ok,true);assert.equal(c.run('localDirty()'),false);
});

test('oversized project snapshots retain the last cloud version and unsynced local evidence',async t=>{
  const api=await server(t),c=device(api);createProject(c);await c.auth.saveNow();const before=api.snapshot();
  c.run(`S.projects[0].attachments=[{id:'large',name:'synthetic.txt',data:'x'.repeat(910000)}];saveState(S);`);
  const result=await c.auth.saveNow();assert.equal(result.ok,false);assert.match(result.error,/0\.9MB/);
  assert.equal(c.run('localDirty()'),true);assert.equal(c.state.projects[0].attachments[0].data.length,910000);
  assert.deepEqual(api.snapshot(),before);
});

test('uploaded evidence can be read and deleted through the same-origin API photo path',async t=>{
  const api=await server(t),data=Buffer.from('synthetic-image-bytes');
  const uploaded=await api.call('photo_put',{data:data.toString('base64'),contentType:'image/png'});
  assert.equal(uploaded.ok,true);assert.equal(new URL(uploaded.data.url).origin,ORIGIN);
  assert.match(new URL(uploaded.data.url).pathname,/^\/api\/photo\/u\/fixture-owner\//);
  const photo=await api.fetch(uploaded.data.url);assert.equal(photo.status,200);assert.equal(photo.headers.get('Content-Type'),'image/png');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()),data);
  const denied=await api.call('photo_del',{url:ORIGIN+'/api/photo/u/someone-else/photo.png'});assert.equal(denied.ok,false);
  const removed=await api.call('photo_del',{url:uploaded.data.url});assert.equal(removed.ok,true);
  assert.equal((await api.fetch(uploaded.data.url)).status,404);
  assert.equal((await api.fetch(ORIGIN+'/api/photo/team-private/fixture.png')).status,403);
});

test('stale reader tab cannot clear the shared dirty flag or discard a new project',async t=>{
 const api=await server(t),writer=device(api);createProject(writer);await writer.auth.saveNow();
 const reader=device(api,writer.storage);await reader.auth.saveNow();
 writer.run("const added=projectCreateSimple('New proposal');saveState(S);");
 const result=await reader.auth.saveNow();assert.equal(result.otherTab,true);
 assert.equal(writer.run('localDirty()'),true);assert.equal(writer.state.projects.length,2);
 assert.equal((await writer.auth.saveNow()).ok,true);assert.equal(api.snapshot().data.projects.length,2);
 await reader.auth.saveNow();assert.equal(reader.state.projects.length,2);
});
