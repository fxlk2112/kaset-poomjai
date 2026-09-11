import test from 'node:test';
import assert from 'node:assert/strict';
await import('../sensors.js');
await import('../owner-summary.js');
await import('../farm-map.js');
const ui=globalThis.OwnerSummary;
const now=Date.parse('2026-09-12T05:00:00Z');
const point=(time,kwh,quality='UNVERIFIED')=>({observed_at:time,quality,observation_only:true,observation:{import_energy_total_kwh:kwh,active_power_total_kw:-0.3}});
test('today is Bangkok calendar day, with no midnight extrapolation or yesterday total',()=>{
 const rows=[point('2026-09-11T16:59:00Z',10),point('2026-09-11T17:14:00Z',11),point('2026-09-12T04:45:00Z',14)];
 const source={windows:{24:{points:rows,bucket_seconds:900}},current:point('2026-09-12T05:00:00Z',15)};
 const result=ui.dayEnergy(source,now);assert.equal(result.delta,4);assert.equal(result.count,3);assert.equal(result.first,rows[1].observed_at);assert.equal(result.gaps,true);
 assert.equal(ui.dayEnergy(source,Date.parse('2026-09-12T17:00:00Z')).delta,null);
 assert.equal(ui.dayEnergy({current:source.current},now).delta,null);
 assert.equal(ui.dayEnergy({history:[source.current,source.current]},now).delta,null);
});
test('counter resets, faults, missing values refuse daily totals, zero remains valid',()=>{
 const source={history:[point('2026-09-12T04:30:00Z',10),point('2026-09-12T04:45:00Z',9)]};
 assert.equal(ui.dayEnergy(source,now).delta,null);assert.equal(ui.dayEnergy(source,now).reset,true);
 source.history[1]=point('2026-09-12T04:45:00Z',12,'SENSOR_FAULT');assert.equal(ui.dayEnergy(source,now).delta,null);
 source.history[1]=point('2026-09-12T04:45:00Z',null);assert.equal(ui.dayEnergy(source,now).delta,null);
 source.history=source.history.map((p)=>({...p,quality:'UNVERIFIED',observation:{import_energy_total_kwh:0}}));assert.equal(ui.dayEnergy(source,now).delta,0);
});
test('freshness ages locally and invalid future times never become live',()=>{
 assert.equal(ui.freshness(point('2026-09-12T04:56:00Z',1),'GOOD',now),'STALE');
 assert.equal(ui.freshness(point('2026-09-12T05:03:00Z',1),'GOOD',now),'INVALID_TIME');
 assert.equal(ui.freshness({observed_at:'bad'},'GOOD',now),'INVALID_TIME');
 assert.equal(ui.freshness(point('2026-09-12T05:00:00Z',1),'UNVERIFIED',now),'UNVERIFIED');
});
test('summary navigation, signed out and account switches never expose previous readings',()=>{
 globalThis.Auth={session:{token:'synthetic-account-a'}};ui.sync();
 ui.state.water={status:'GOOD',current:{observed_at:'2026-09-12T05:00:00Z',capacity_percent:33.37,volume_m3:4567,depth_m:2.2}};
 assert.match(ui.bodyHtml(now),/33\.4/);assert.doesNotMatch(ui.bodyHtml(now+240000),/33\.4|4,567/);
 Auth.session={token:'synthetic-account-b'};assert.doesNotMatch(ui.bodyHtml(now),/33\.4|4,567/);assert.equal(ui.state.water,null);
 delete globalThis.Auth;FarmMapDashboard.select('owner-summary');assert.equal(FarmMapDashboard.isMapSurface(),false);
 assert.match(FarmMapDashboard.cardHtml(),/เข้าสู่ระบบเพื่อดูฟาร์ม/);assert.doesNotMatch(FarmMapDashboard.cardHtml(),/farm-relay-panel/);FarmMapDashboard.reset();
});
test('only two read requests, independent failure, coalescing, and late old-account rejection',async()=>{
 const oldFetch=globalThis.fetch;globalThis.FarmUltimateRuntime={apiUrl:'https://example.invalid/api'};
 globalThis.Auth={session:{token:'synthetic-account-a'}};ui.sync();
 const calls=[];let releases=[];
 globalThis.fetch=(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Promise(resolve=>releases.push(resolve));};
 try {
   const pending=ui.refresh(true);await ui.refresh(true);assert.equal(calls.length,2);
   assert.equal(calls[0].body.action,'sensor_current');assert.equal(calls[1].url,'https://example.invalid/api/monitor/read');
   Auth.session={token:'synthetic-account-b'};ui.sync();releases.forEach(resolve=>resolve(Response.json({ok:true,data:{output_control_allowed:false}})));await pending;
   assert.equal(ui.state.monitor,null);assert.equal(ui.state.water,null);
   globalThis.fetch=async url=>url.endsWith('/monitor/read')?Response.json({ok:false},{status:503}):Response.json({ok:true,data:{output_control_allowed:false,status:'GOOD',current:{observed_at:new Date().toISOString(),capacity_percent:33}}});
   await ui.refresh(true);assert.equal(ui.state.water.current.capacity_percent,33);assert.equal(ui.state.monitor,null);assert.match(ui.state.monitorError,/เชื่อมต่อข้อมูลไม่ได้/);
   globalThis.fetch=async()=>Response.json({ok:false},{status:401});await ui.refresh(true);assert.equal(ui.state.loginRequired,true);assert.equal(ui.state.water,null);
 }finally{globalThis.fetch=oldFetch;delete globalThis.Auth;delete globalThis.FarmUltimateRuntime;ui.sync();}
});
