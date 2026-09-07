const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

function client() {
  const storage = new Map([['farmult-session-v1', JSON.stringify({email:'test@example.invalid', token:'test-token'})]]);
  const listeners = {};
  const timers = new Map();
  let timer = 0;
  const doc = {
    hidden: false, activeElement: null, modalOpen: false,
    documentElement: {classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){}},
    getElementById: () => null, querySelector(selector) { return selector === '#modalRoot .modal' && this.modalOpen ? {} : null; },
    querySelectorAll: () => [], addEventListener: (key, fn) => { listeners[key] = fn; }
  };
  const c = vm.createContext({
    document: doc, window: {addEventListener:(key, fn)=>{listeners[key]=fn;}}, navigator:{onLine:true},
    location:{href:'https://example.invalid/',search:'',reload(){throw new Error('Unexpected reload');}},
    localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    setTimeout:(fn, delay)=>{timers.set(++timer,{fn,delay});return timer;},clearTimeout:id=>timers.delete(id),setInterval(){},
    URL, Date, AbortController, console, App:{}, toast(){}, render(){}, fetch:async()=>({json:async()=>({ok:true,data:{data:null,updated_at:0}})})
  });
  vm.runInContext(source('js/data.js'),c);
  vm.runInContext(source('js/auth.js')+'\nthis.auth = Auth; this.state = S; this.setSessionForTest = setSession;',c);
  const run = text => vm.runInContext(text,c);
  timers.clear();
  run('setCloudTs(100); setLocalDirty(false);');
  return {c,run,storage,timers,listeners,auth:c.auth,state:c.state};
}
function mockApi(client, handler) {
  client.c.fetch = async (_url, options) => ({json:async()=>handler(JSON.parse(options.body))});
}
const copied = value => JSON.parse(JSON.stringify(value));

test('failed upload stays dirty and schedules a retry without reporting success',async()=>{
  const c=client();
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,p=>p.action==='load'?{ok:true,data:{data:{tasks:[]},updated_at:100}}:{ok:false,error:'offline'});
  const result=await c.auth.saveNow();
  assert.equal(result.ok,false);
  assert.equal(c.run('localDirty()'),true);
  assert.equal(c.auth.syncState,'error');
  assert.ok([...c.timers.values()].some(t=>t.delay>=5000));
});

test('edits during an in-flight save are sent in a subsequent save',async()=>{
  const c=client(); let complete; let writes=0; let remote={data:{tasks:[]},updated_at:100};
  c.run('S.tasks.push({id:"first"}); saveState(S);');
  mockApi(c,async p=>{
    if(p.action==='load') return {ok:true,data:remote};
    writes++;
    if(writes===1) await new Promise(resolve=>{complete=resolve;});
    remote={data:JSON.parse(p.data),updated_at:100+writes};
    return {ok:true,data:{updated_at:remote.updated_at}};
  });
  const first=c.auth.saveNow();
  while(!complete) await new Promise(setImmediate);
  c.run('S.tasks.push({id:"second"}); saveState(S);');
  assert.equal(c.auth.saveNow(),first);
  complete(); await first;
  assert.equal(c.run('localDirty()'),true);
  await c.auth.saveNow();
  assert.equal(remote.data.tasks.length,2);
  assert.equal(c.run('localDirty()'),false);
});

test('a timed-out sync releases the request and keeps edits for retry',async()=>{
  const c=client();
  c.run('S.tasks.push({id:"pending"}); saveState(S);');
  c.c.fetch=(_url,options)=>new Promise((_resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(new Error('timeout')));
  });
  const pending=c.auth.saveNow();
  [...c.timers.values()].find(t=>t.delay===20000).fn();
  assert.equal((await pending).ok,false);
  assert.equal(c.auth._syncPromise,null);
  assert.equal(c.run('localDirty()'),true);
  assert.equal(c.auth.syncState,'error');
});

test('cloud changes are deferred while a form is open, then applied without reloading',async()=>{
  const c=client(); const remote=copied(c.state);remote.tasks=[{id:'remote'}];
  mockApi(c,()=>({ok:true,data:{data:remote,updated_at:101}}));
  c.c.document.modalOpen=true;
  assert.equal((await c.auth.saveNow()).deferred,true);
  assert.equal(c.state.tasks.length,0);
  assert.equal(c.run('cloudTs()'),100);
  c.c.document.modalOpen=false;
  await c.auth.saveNow();
  assert.equal(c.state.tasks[0].id,'remote');
  assert.equal(c.run('cloudTs()'),101);
});

test('leaving an inline form allows deferred cloud updates to resume',async()=>{
  const c=client();const remote=copied(c.state);remote.tasks=[{id:'remote'}];
  mockApi(c,()=>({ok:true,data:{data:remote,updated_at:101}}));
  c.auth.formEditing=true;c.auth._editingForm={isConnected:true};
  assert.equal((await c.auth.saveNow()).deferred,true);
  c.auth._editingForm.isConnected=false;
  assert.equal((await c.auth.saveNow()).ok,true);
  assert.equal(c.state.tasks[0].id,'remote');
});

test('reconnect automatically uploads offline edits',async()=>{
  const c=client();let saved=0;
  c.c.navigator.onLine=false;
  c.run('S.tasks.push({id:"offline"}); saveState(S);');
  assert.equal((await c.auth.saveNow()).offline,true);
  mockApi(c,p=>p.action==='load'?{ok:true,data:{data:{tasks:[]},updated_at:100}}:(saved++,{ok:true,data:{updated_at:101}}));
  c.c.navigator.onLine=true;
  await c.listeners.online();
  assert.equal(saved,1);
  assert.equal(c.run('localDirty()'),false);
});

test('concurrent device edits never silently overwrite cloud data',async()=>{
  const c=client();let writes=0;
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,p=>{if(p.action==='save')writes++;return {ok:true,data:{data:{tasks:[{id:'other'}]},updated_at:101}};});
  assert.equal((await c.auth.saveNow()).conflict,true);
  assert.equal((await c.auth.saveNow()).conflict,true);
  assert.equal(writes,0);
  assert.equal(c.state.tasks[0].id,'local');
});

test('cloud empty state propagates deletions instead of resurrecting data',async()=>{
  const c=client(); c.state.tasks.push({id:'old'});
  const empty=copied(c.state);empty.tasks=[];
  mockApi(c,()=>({ok:true,data:{data:empty,updated_at:101}}));
  await c.auth.saveNow();
  assert.equal(c.state.tasks.length,0);
});

test('a clean stale tab refreshes even if another tab already acknowledged the revision',async()=>{
  const c=client();
  const remote=copied(c.state);remote.tasks=[{id:'latest'}];
  mockApi(c,()=>({ok:true,data:{data:remote,updated_at:100}}));
  assert.equal((await c.auth.saveNow()).ok,true);
  assert.equal(c.state.tasks[0].id,'latest');
  assert.equal(c.run('localDirty()'),false);
});

test('a response from the previous account cannot acknowledge the next account',async()=>{
  const c=client();let release;
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,async()=>{await new Promise(resolve=>{release=resolve;});return {ok:true,data:{data:null,updated_at:0}};});
  const pending=c.auth.saveNow();
  while(!release)await new Promise(setImmediate);
  c.c.setSessionForTest({email:'second@example.invalid',token:'second-token'});
  c.run('setCloudTs(500); setLocalDirty(true);');
  release();await pending;
  assert.equal(c.run('cloudTs()'),500);
  assert.equal(c.run('localDirty()'),true);
});

test('manual sync does not toast success when offline',async()=>{
  const c=client();const messages=[];c.c.toast=m=>messages.push(m);
  c.c.navigator.onLine=false;
  await c.run('App.authSyncNow()');
  assert.ok(messages.length);
  assert.ok(messages.every(m=>!m.includes('ซิงก์ข้อมูลล่าสุดแล้ว')));
});

test('refreshing account permissions does not interrupt an in-flight sync',async()=>{
  const c=client();let release;
  c.run('S.tasks.push({id:"local"}); saveState(S);');
  mockApi(c,async p=>{
    if(p.action==='me')return {ok:true,data:{admin:false}};
    if(p.action==='load')return {ok:true,data:{data:{tasks:[]},updated_at:100}};
    await new Promise(resolve=>{release=resolve;});
    return {ok:true,data:{updated_at:101}};
  });
  const pending=c.auth.saveNow();
  while(!release)await new Promise(setImmediate);
  await c.auth.refreshAdmin();
  assert.equal(c.auth._syncPromise,pending);
  release();
  assert.equal((await pending).ok,true);
  assert.equal(c.run('localDirty()'),false);
  assert.equal(c.auth.syncState,'synced');
});

test('loading an account does not write the empty seed over its stored data',()=>{
  const c=client();
  c.run('S.tasks.push({id:"keep"}); saveState(S); setLocalDirty(false);');
  const before=c.storage.get('kaset-poomjai-v51::test@example.invalid');
  c.run('resetSTo(JSON.parse(localStorage.getItem(slotKey(Auth.session.email))));');
  assert.equal(c.storage.get('kaset-poomjai-v51::test@example.invalid'),before);
  assert.equal(c.run('localDirty()'),false);
  assert.equal(c.state.tasks[0].id,'keep');
});

test('worker revision guard is atomic and server revisions are monotonic',()=>{
  const worker=source('worker/src/lark.js');
  const start=worker.indexOf('async function doSave(');
  const end=worker.indexOf('async function doLoad(',start);
  const sql=worker.slice(start,end).match(/`(INSERT INTO user_data[\s\S]+?RETURNING updated_at)`/)[1];
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE user_data (user_id TEXT PRIMARY KEY, data TEXT, updated_at INTEGER)');
  const save=(data,now,base)=>db.prepare(sql).get({'?1':'user','?2':JSON.stringify(data),'?3':now,'?4':base});
  assert.equal(save({first:1},100,0).updated_at,100);
  assert.equal(save({second:1},99,100).updated_at,101);
  assert.equal(save({stale:1},200,100),undefined);
  assert.equal(JSON.parse(db.prepare('SELECT data FROM user_data').get().data).second,1);
  db.close();
});

test('cycle-stage totals reconcile to annual totals and exclude planned work',()=>{
  const c=client();
  c.run(`S.cycles=[{id:'a',status:'active'},{id:'b',status:'done'}];
    S.tasks=[{date:'2026-09-07',status:'done',cycleId:'a',cost:100,revenue:0},
    {date:'2026-09-07',status:'done',cycleId:'b',cost:200,revenue:400},
    {date:'2026-09-07',status:'done',cost:50,revenue:0},
    {date:'2026-09-07',status:'planned',cost:999,revenue:999},
    {date:'2025-09-07',status:'done',cost:999,revenue:999}];`);
  const groups=c.run('cycleStageFinance(S,2026)');
  assert.equal(groups[0].cost,100);
  assert.equal(groups[1].net,200);
  assert.equal(groups[2].cost,50);
  assert.equal(groups.reduce((sum,g)=>sum+g.net,0),c.run('ytdFinance(S,2026).net'));
});

for (const method of ['finishTask','failTask']) {
  test(`${method} rejects empty and future dates without changing the task`,async()=>{
    const app=source('js/app.js');
    const start=app.indexOf(`App.${method} = async function`);
    const end=app.indexOf('\nApp.',start+1);
    for(const date of ['', '2026-09-08']) {
      const task={id:'task',status:'planned'};
      const messages=[];
      const context=vm.createContext({
        App:{},S:{tasks:[task]},taskPhotoUploading:{done:false},taskFinishSaving:false,
        taskPhotoRecommended:()=>false,taskDonePhotos:[],todayISO:()=> '2026-09-07',currentTimeHHMM:()=> '09:00',
        document:{getElementById:id=>id==='tdone_date'?{value:date,checkValidity:()=>true}:null},
        setModalFieldError:(_el,msg)=>messages.push(msg)
      });
      vm.runInContext(app.slice(start,end),context);
      await context.App[method]('task',true);
      assert.deepEqual(task,{id:'task',status:'planned'});
      assert.equal(context.taskFinishSaving,false);
      assert.equal(messages.length,1);
    }
  });
}

test('rescheduling changes only the date and preserves stock and recorded costs',()=>{
  const c=client();
  c.run('S.tasks=[{id:"task",date:"2026-09-01",status:"planned",cost:750,stockLog:[{stockId:"stock",qty:1}]}];S.stock=[{id:"stock",qty:9}];S.notifDismissed={task:true};');
  c.c.document.getElementById=id=>id==='rescheduleDate'?{value:'2026-09-08'}:null;
  c.c.closeModal=()=>{};c.c.rerender=()=>{};
  const app=source('js/app.js');
  const start=app.indexOf('App.saveTaskDate = function');
  const end=app.indexOf('\n};',start)+3;
  c.run(app.slice(start,end));
  c.run('App.saveTaskDate({preventDefault(){}},"task");');
  assert.equal(c.state.tasks[0].date,'2026-09-08');
  assert.equal(c.state.tasks[0].manualDate,true);
  assert.equal(c.state.tasks[0].cost,750);
  assert.equal(c.state.stock[0].qty,9);
  assert.equal(c.state.tasks[0].stockLog[0].qty,1);
  assert.equal(c.state.notifDismissed.task,undefined);
});
