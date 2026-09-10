import test from "node:test";
import assert from "node:assert/strict";
await import("../energy.js");
await import("../farm-map.js");
const ui=globalThis.EnergyDashboard;
test("signed observations are labelled pending, remain empty when stale and graph below zero",()=>{
  globalThis.Auth={session:{token:"observation-test-session"}};ui.cardHtml();
  const row={observed_at:new Date().toISOString(),stale_after_s:180,quality:"UNVERIFIED",observation_only:true,
    observation:{active_power_total_kw:-.25,power_factor_total:-.08,voltage_l1_v:230,current_l1_a:4,frequency_hz:50,import_energy_total_kwh:1234}};
  const source={id:"UNASSIGNED_METER_01",circuit_role:"UNASSIGNED",meter_model:"ADL400N-CT/UNVERIFIED",status:"UNVERIFIED",current:row,history:[row]};
  ui.state.data={sources:[source],status:"AVAILABLE"};
  const html=ui.cardHtml();assert.match(html,/เชื่อมต่อแล้ว · รอตรวจรับ/);assert.match(html,/-0\.25/);assert.match(html,/ยังต้องตรวจอัตราทดและทิศ CT/);
  assert.doesNotMatch(html,/ตรวจอัตราทด CT ทิศทาง และเทียบค่ากับหน้าจอแล้ว/);
  assert.doesNotMatch(ui.chartHtml(source),/NaN|Infinity/);assert.match(ui.chartHtml(source),/รอตรวจรับ/);
  row.observed_at=new Date(Date.now()-240000).toISOString();source.history=[];
  assert.doesNotMatch(ui.cardHtml(),/-0\.25/);assert.match(ui.cardHtml(),/ข้อมูลขาดช่วง/);
  delete globalThis.Auth;ui.cardHtml();
});
test("energy is a separate map destination, signed-out readings stay empty",()=>{
  FarmMapDashboard.select("energy");assert.equal(FarmMapDashboard.isMapSurface(),false);
  const html=FarmMapDashboard.cardHtml();assert.match(html,/พลังงานไฟฟ้า/);assert.match(html,/เข้าสู่ระบบ/);assert.doesNotMatch(html,/farm-relay-panel|0\.00/);FarmMapDashboard.reset();
});
test("energy UI rechecks sample age and renders missing history without a zero trace",()=>{
  assert.equal(ui.statusOf({status:"GOOD",current:{observed_at:new Date(Date.now()-240000).toISOString(),quality:"GOOD",stale_after_s:180}}),"STALE");
  assert.doesNotMatch(ui.chartHtml(null),/<path|<circle/);assert.match(ui.chartHtml(null),/กราฟจะเริ่มเมื่อมีข้อมูลจริง/);
});
test("account switch discards a pending energy response and private data",async()=>{
  globalThis.Auth={session:{token:"first-fixture-session"}};globalThis.FarmUltimateRuntime={apiUrl:"https://example.invalid/api"};
  let release;const original=globalThis.fetch;globalThis.fetch=()=>new Promise(r=>release=r);
  try{const pending=ui.refresh(true);Auth.session={token:"second-fixture-session"};ui.cardHtml();release(Response.json({ok:true,data:{output_control_allowed:false,energy:{sources:[{private:"old"}],output_control_allowed:false,modbus_write_allowed:false}}}));await pending;assert.equal(ui.state.data,null);assert.equal(ui.state.loading,false);}
  finally{globalThis.fetch=original;delete globalThis.Auth;delete globalThis.FarmUltimateRuntime;ui.cardHtml();}
});
