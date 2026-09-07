import test from "node:test";
import assert from "node:assert/strict";
import {projectEnergy} from "../energy-contract.js";
import {projectHealth} from "../monitor-contract.js";
import {handleMonitor} from "../owner-monitor.js";
const now=Date.now();
export function fixture(time=now) {
  const row={observed_at:new Date(time-30000).toISOString(),quality:"GOOD",output_control_allowed:false,modbus_write_allowed:false,
    ct_ratio_verified:true,direction_verified:true,display_comparison_verified:true,stale_after_s:180,
    voltage_l1_v:230.1,voltage_l2_v:231.2,voltage_l3_v:229.8,current_l1_a:2.1,current_l2_a:2.2,current_l3_a:2.1,
    active_power_total_kw:1.45,import_energy_total_kwh:1234.56,power_factor_total:.97,frequency_hz:50.01};
  return {generated_at:new Date(time).toISOString(),output_control_allowed:false,modbus_write_allowed:false,status:"AVAILABLE",sources:[{id:"SYSTEM_TOTAL_FEEDER_QA",circuit_role:"SYSTEM_TOTAL_FEEDER",meter_model:"ADL400N-CT/D16",register_map_id:"ACREL_ADL400N_CT_EXTERNAL_CT_MANUAL_V1_5_FAST_READ_V1",current:row,history:[row]}]};
}
test("energy projects measured zero correctly and strips private fields",()=>{
  const p=fixture();p.sources[0].current.current_l1_a=0;p.sources[0].current.secret="hidden-value";p.sources[0].serial="hidden-value";
  const out=projectEnergy(p,now);assert.equal(out.sources[0].status,"GOOD");assert.equal(out.sources[0].current.current_l1_a,0);assert.doesNotMatch(JSON.stringify(out),/hidden-value|secret|serial/);
  assert.deepEqual(projectEnergy(out,now),out,"stored projection can be reprojected on every read");
});
test("energy freshness is recomputed from measurement time even after a fresh publication",()=>{
  const p=fixture();p.generated_at=new Date(now+240000).toISOString();const out=projectEnergy(p,now+240000);
  assert.equal(out.sources[0].status,"STALE");assert.equal(out.sources[0].current.quality,"GOOD");
});
test("unverified commissioning or incomplete readings never become valid measurements",()=>{
  for(const key of ["ct_ratio_verified","direction_verified","display_comparison_verified"]){const p=fixture();p.sources[0].current[key]=false;const out=projectEnergy(p,now);assert.equal(out.sources[0].status,"UNVERIFIED");assert.equal(out.sources[0].current.active_power_total_kw,null);}
  for(const value of [null,"",true,Infinity,800]){const p=fixture();p.sources[0].current.voltage_l1_v=value;assert.equal(projectEnergy(p,now).sources[0].status,"SENSOR_FAULT");}
});
test("unsafe, unknown identity, duplicate, oversized and future energy fail closed without breaking health",()=>{
  const mutations=[p=>p.output_control_allowed=true,p=>p.sources[0].current.modbus_write_allowed=true,p=>p.sources[0].id="UNKNOWN",p=>p.sources[0].meter_model="other",p=>p.sources.push(p.sources[0]),p=>p.sources[0].history=Array(301).fill(p.sources[0].current),p=>p.sources[0].current.observed_at=new Date(now+3600000).toISOString()];
  for(const mutate of mutations){const p=fixture();mutate(p);assert.equal(projectEnergy(p,now).status,"UNAVAILABLE");const out=projectHealth({generated_at:new Date(now).toISOString(),output_control_allowed:false,energy:p},now);assert.ok(out.sources.PI5_CONTROLLER_01);assert.equal(out.energy.sources.length,0);}
});
test("empty source states remain distinct and age if the publisher stops",()=>{
  const p={...fixture(),sources:[],status:"INGEST_NOT_READY"};assert.equal(projectEnergy(p,now).status,"INGEST_NOT_READY");assert.equal(projectEnergy({...p,status:"NO_METER_DATA"},now).status,"NO_METER_DATA");assert.equal(projectEnergy(p,now+181000).status,"STALE");
});
test("energy history excludes old points, deduplicates and retains faults",()=>{
  const p=fixture(),r=p.sources[0].current;p.sources[0].history=[{...r,observed_at:new Date(now-2*86400000).toISOString()},r,r,{...r,observed_at:new Date(now-900000).toISOString(),quality:"SENSOR_FAULT"}];
  const rows=projectEnergy(p,now).sources[0].history;assert.equal(rows.length,2);assert.equal(rows[0].active_power_total_kw,null);assert.equal(rows[1].quality,"GOOD");
});
test("energy read uses existing authenticated owner scope and performs no writes",async()=>{
  const queries=[],payload={generated_at:new Date(now).toISOString(),output_control_allowed:false,energy:fixture()};
  const db={prepare(sql){const q={sql,args:[]};queries.push(q);return{bind(...args){q.args=args;return this;},async first(){return sql.includes("sessions")?{user_id:"owner-test"}:{payload:JSON.stringify(payload),received_at:now};},run(){throw Error("Unexpected write");}};}};
  const request=p=>new Request("https://example.invalid/api/monitor/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
  assert.equal((await handleMonitor(request({}),{MONITOR_DB:db})).status,401);assert.equal(queries.length,0);
  const result=await handleMonitor(request({token:"fixture-owner-session"}),{MONITOR_DB:db});assert.equal(result.status,200);assert.equal((await result.json()).data.energy.sources[0].current.active_power_total_kw,1.45);assert.equal(queries[1].args[0],"owner-test");assert.match(queries[0].sql,/s.expires_at>\?2/);
});
