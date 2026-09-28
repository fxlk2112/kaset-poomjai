const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function client() {
  const nodes={t_status:{value:'done'},inspectionBox:{},inspectionWeatherStatus:{innerHTML:''},inspectionWeatherBadge:{textContent:''}};
  const c=vm.createContext({console,Date,JSON,Number,Math,navigator:{onLine:true},document:{getElementById:id=>nodes[id] || null,querySelector:()=>null,querySelectorAll:()=>[]},S:{plots:[{id:'p',lat:0,lng:100}],tasks:[],cycles:[]},Auth:{session:{email:'demo'}},todayISO:()=> '2026-09-10',daysBetween:(a,b)=>(Date.parse(b)-Date.parse(a))/86400000,trialValidDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d),esc:s=>String(s).replaceAll('<','&lt;'),fmtNum:n=>String(n),dateLabel:d=>d,ic:()=>'',saveState:()=>{c.saves=(c.saves || 0)+1;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/inspection.js'),'utf8'),c);
  const run=code=>vm.runInContext(code,c);
  run("Inspection.draft={weather:{enabled:true,note:'',snapshot:null}};Inspection.context={plotId:'p',date:'2026-09-10'}");
  return {c,run,nodes};
}
const daily=(date='2026-09-10')=>({daily:{time:[date],temperature_2m_min:[24],temperature_2m_max:[33],precipitation_sum:[0]}});
test('weather accepts equator coordinates but rejects missing or out-of-range coordinates',()=>{
  const {run}=client();
  assert.ok(run("inspectionWeatherKey({id:'p',lat:0,lng:0},'2026-09-10')"));
  for(const lat of [null,'',91,'bad'])assert.equal(run(`inspectionWeatherKey({id:'p',lat:${JSON.stringify(lat)},lng:100},'2026-09-10')`),'');
});
test('daily weather is requested for the observation date in Thai time, with no current fallback',async()=>{
  const {c,run}=client();let url;
  c.weatherJson=async u=>{url=u;return daily('2026-08-23');};
  const result=await run("inspectionWeatherFetch(S.plots[0],'2026-08-23')");
  assert.match(url,/archive-api/);assert.match(url,/start_date=2026-08-23&end_date=2026-08-23/);assert.match(url,/timezone=Asia%2FBangkok/);
  assert.equal(result.kind,'historical');assert.equal(result.rainMm,0);
  c.weatherJson=async()=>({...daily('2026-09-10'),current:{temperature_2m:99}});
  await assert.rejects(run("inspectionWeatherFetch(S.plots[0],'2026-08-23')"),/date unavailable/);
});
test('unknown values stay null and today is explicitly an all-day estimate',async()=>{
  const {c,run}=client();c.weatherJson=async()=>({daily:{time:['2026-09-10'],temperature_2m_min:[null],temperature_2m_max:[33],precipitation_sum:[null]}});
  c.result=await run("inspectionWeatherFetch(S.plots[0],'2026-09-10')");
  assert.equal(c.result.minC,null);assert.equal(c.result.rainMm,null);assert.equal(c.result.kind,'forecast');
  const html=run("inspectionWeatherHtml({snapshot:result,note:'<script>'})");
  assert.match(html,/ประมาณการทั้งวัน/);assert.match(html,/ไม่มีข้อมูล/);assert.doesNotMatch(html,/0 มม\./);assert.doesNotMatch(html,/<script>/);
});
test('disabled, planned, missing-coordinate and offline inspections never request weather',()=>{
  for(const mode of ['disabled','planned','coordinates','offline']){
    const {c,run,nodes}=client();let calls=0;c.weatherJson=async()=>{calls++;return daily();};
    if(mode==='disabled')run('Inspection.draft.weather.enabled=false');
    if(mode==='planned')nodes.t_status.value='planned';
    if(mode==='coordinates')c.S.plots[0].lat=null;
    if(mode==='offline')c.navigator.onLine=false;
    run('Inspection.weatherRefresh()');assert.equal(calls,0);assert.equal(run('Inspection.pending'),0);
  }
});
test('late responses cannot attach to another date or a newly opened editor',async()=>{
  const {c,run}=client();const resolvers=[];c.weatherJson=()=>new Promise(resolve=>resolvers.push(resolve));
  run('Inspection.weatherRefresh()');const old=run('Inspection.weatherRequest.promise');
  run("Inspection.context.date='2026-09-09';Inspection.weatherRefresh()");const next=run('Inspection.weatherRequest.promise');
  resolvers[0](daily());await old;
  assert.equal(run('Inspection.draft.weather.snapshot'),null);
  run("Inspection.draft={weather:{enabled:true,note:'new',snapshot:null}};");
  resolvers[1](daily('2026-09-09'));await next;
  assert.equal(run('Inspection.draft.weather.snapshot'),null);
});
test('fetch failure is nonblocking and retry remains available after context refresh',async()=>{
  const {c,run,nodes}=client();c.weatherJson=async()=>{throw Error('offline');};
  run('Inspection.weatherRefresh()');await run('Inspection.weatherRequest.promise');
  run('Inspection.weatherRefresh()');
  assert.match(nodes.inspectionWeatherStatus.innerHTML,/ลองใหม่/);
  assert.equal(run('Inspection.pending'),0);
});
test('saving while weather is pending enriches only the exact saved revision',async()=>{
  for(const mode of ['same','edited','account','deleted','date','plot','state']) {
    const {c,run}=client();let resolve;c.weatherJson=()=>new Promise(r=>resolve=r);
    run('Inspection.weatherRefresh()');const pending=run('Inspection.weatherRequest.promise');
    run("S.tasks=[{id:'t',plotId:'p',type:'inspect',status:'done',inspection:{observedDate:'2026-09-10',weather:{enabled:true,note:'kept',snapshot:null}}}];Inspection.weatherAfterSave(S.tasks[0]);");
    if(mode==='edited')run('S.tasks[0].inspection=JSON.parse(JSON.stringify(S.tasks[0].inspection))');
    if(mode==='account')run("Auth.session={email:'another'}");
    if(mode==='deleted')run('S.tasks=[]');
    if(mode==='date')run("S.tasks[0].inspection.observedDate='2026-09-09'");
    if(mode==='plot')run('S.plots[0].lat=11');
    if(mode==='state')run('S={...S}');
    resolve(daily());await pending;await Promise.resolve();
    assert.equal(c.saves || 0,mode==='same'?1:0,mode);
    if(mode==='same')assert.equal(run('S.tasks[0].inspection.weather.note'),'kept');
  }
});
test('existing saved daily weather is retained without refetching',()=>{
  const {c,run}=client();c.weatherJson=()=>{throw Error('must not fetch');};
  run("Inspection.draft.weather.snapshot={key:inspectionWeatherKey(S.plots[0],'2026-09-10'),date:'2026-09-10',kind:'forecast',minC:20,maxC:30,rainMm:0};Inspection.weatherRefresh()");
  assert.equal(run('Inspection.draft.weather.snapshot.minC'),20);
});
