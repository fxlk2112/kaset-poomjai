import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { projectHealth, projectWeather } from "../monitor-contract.js";
import { handleMonitor } from "../owner-monitor.js";
const now = Date.now();
const sample = { observed_at: new Date(now-20000).toISOString(), quality:"GOOD",temp_c:48,load1:0.2,load5:0.1,load15:0.1,uptime_s:1800,cpu_count:4 };
const health = { generated_at:new Date(now).toISOString(),output_control_allowed:false,sources:{PI5_CONTROLLER_01:{current:sample,samples_24h:100},PI_ZERO_GATEWAY_01:{current:{...sample,temp_c:39},samples_24h:100}},history:{PI5_CONTROLLER_01:[sample],PI_ZERO_GATEWAY_01:[sample]} };
const weather = JSON.parse(await readFile(new URL("../../data/weather-models.json",import.meta.url),"utf8"));
const request = (path,p={},headers={}) => new Request("https://app.example.invalid/api/monitor/"+path,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(p)});
function database({owner="fixture-owner",row={payload:JSON.stringify(health),received_at:now}}={}) {
  const queries=[],writes=[];
  return {queries,writes,prepare(sql){
    const state={sql,args:[]};queries.push(state);
    return {bind(...args){state.args=args;return this;},async first(){
      if(sql.includes("sessions")||sql.includes("token_hash")) return owner?{user_id:owner}:null;
      return row;
    },async run(){writes.push(state);return {meta:{changes:1}};}};
  }};
}
test("health projection removes private identity fields and preserves finite readings",()=>{
  const p=structuredClone(health);p.sources.PI5_CONTROLLER_01.current.hostname="private-host";p.sources.PI5_CONTROLLER_01.current.address="hidden";p.secret="hidden";
  const out=projectHealth(p,now);assert.equal(out.sources.PI5_CONTROLLER_01.current.temp_c,48);
  assert.doesNotMatch(JSON.stringify(out),/private-host|hidden|hostname|address|secret/);
});
test("health status ages even when the publisher stops; null values are not invented zeroes",()=>{
  const out=projectHealth(health,now+3600000);assert.equal(out.sources.PI5_CONTROLLER_01.status,"STALE");
  const p=structuredClone(health);p.sources.PI5_CONTROLLER_01.current.temp_c=null;
  assert.equal(projectHealth(p,now).sources.PI5_CONTROLLER_01.status,"DEGRADED");
  assert.equal(projectHealth(p,now).sources.PI5_CONTROLLER_01.current.temp_c,null);
});
test("unsafe or future health readings are rejected",()=>{
  assert.throws(()=>projectHealth({...health,output_control_allowed:true}),/SAFE_OFF/);
  const p=structuredClone(health);p.sources.PI5_CONTROLLER_01.current.observed_at=new Date(now+3600000).toISOString();
  assert.throws(()=>projectHealth(p,now),/FUTURE/);
});
test("weather projection contains only approved forecast fields and server-known model names",()=>{
  const p=structuredClone(weather);p.latitude=12;p.models[0].name="untrusted name";p.models[0].private_endpoint="hidden";
  const out=projectWeather(p);assert.equal(out.models.length,10);assert.equal(out.models[0].name,"ECMWF IFS");
  assert.doesNotMatch(JSON.stringify(out),/latitude|hidden|untrusted/);
  assert.equal(out.station_truth_available,false);
});
test("unknown models and station-truth or unsafe forecasts are rejected",()=>{
  assert.throws(()=>projectWeather({...weather,station_truth_available:true}),/FORECAST/);
  assert.throws(()=>projectWeather({...weather,output_control_allowed:true}),/SAFE_OFF/);
  const p=structuredClone(weather);p.models[0].id="unknown";assert.throws(()=>projectWeather(p),/UNKNOWN/);
});
test("missing binding fails closed",async()=>{assert.equal((await handleMonitor(request("read"),{})).status,503);});
test("signed-out reads and publication cannot access the database",async()=>{
  const db=database();assert.equal((await handleMonitor(request("read"),{MONITOR_DB:db})).status,401);
  assert.equal((await handleMonitor(request("publish"),{MONITOR_DB:db})).status,401);assert.equal(db.queries.length,0);
});
test("invalid or revoked owner sessions cannot read health",async()=>{
  const db=database({owner:null});const r=await handleMonitor(request("read",{token:"test-session-123456789"}),{MONITOR_DB:db});assert.equal(r.status,403);assert.equal(db.queries.length,1);
  assert.match(db.queries[0].sql,/s.expires_at>\?2/);assert.match(db.queries[0].sql,/d.active=1/);
});
test("authenticated health query is scoped to the authenticated owner and is read-only",async()=>{
  const db=database();const r=await handleMonitor(request("read",{token:"test-session-123456789",hours:24}),{MONITOR_DB:db});
  assert.equal(r.status,200);assert.equal(db.queries[1].args[0],"fixture-owner");assert.equal(db.writes.length,0);assert.equal((await r.json()).data.output_control_allowed,false);
});
test("public forecast never returns owner identity, credentials or Pi health",async()=>{
  const db=database({row:{payload:JSON.stringify(weather)}});const r=await handleMonitor(new Request("https://app.example.invalid/api/monitor/weather"),{MONITOR_DB:db});
  assert.equal(r.status,200);assert.equal(r.headers.get("Cache-Control"),"no-store");assert.doesNotMatch(await r.text(),/user_id|token|PI5_CONTROLLER/);
});
test("foreign browser origins are rejected before database reads",async()=>{
  const db=database();const r=await handleMonitor(request("read",{}, {Origin:"https://other.example.invalid"}),{MONITOR_DB:db});assert.equal(r.status,403);assert.equal(db.queries.length,0);
});
test("publisher credential is hashed and only active source is accepted",async()=>{
  const db=database({owner:null});const r=await handleMonitor(request("publish",{kind:"health",data:health},{Authorization:"Bearer "+"a".repeat(64)}),{MONITOR_DB:db});
  assert.equal(r.status,403);assert.notEqual(db.queries[0].args[0],"a".repeat(64));assert.match(db.queries[0].sql,/active=1/);assert.equal(db.writes.length,0);
});
test("publisher writes only projected snapshots, with newer-only idempotency",async()=>{
  const db=database();const r=await handleMonitor(request("publish",{kind:"health",data:health},{Authorization:"Bearer "+"a".repeat(64)}),{MONITOR_DB:db});
  assert.equal(r.status,200);assert.equal(db.writes.length,1);assert.match(db.writes[0].sql,/WHERE excluded.observed_ts>owner_monitor_snapshots.observed_ts/);assert.equal(db.writes[0].args[1],"health");
});
test("oversized or unsafe publication cannot write any data",async()=>{
  const db=database();const headers={Authorization:"Bearer "+"a".repeat(64)};
  assert.equal((await handleMonitor(request("publish",{kind:"health",data:{...health,output_control_allowed:true}},headers),{MONITOR_DB:db})).status,400);
  assert.equal((await handleMonitor(request("publish",{padding:"x".repeat(512001)},headers),{MONITOR_DB:db})).status,400);assert.equal(db.writes.length,0);
});
