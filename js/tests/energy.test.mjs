import test from "node:test";
import assert from "node:assert/strict";
await import("../energy.js");
await import("../farm-map.js");
const ui=globalThis.EnergyDashboard;
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
