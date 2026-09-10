import test from 'node:test';
import assert from 'node:assert/strict';
await import('../pond-details.js');
const now=Date.now(), row=(minutes,volume,depth=1,quality='GOOD')=>({observed_at:new Date(now-minutes*60000).toISOString(),volume_m3:volume,depth_m:depth,quality});
test('pond rate uses real elapsed time and excludes faults, future and duplicate rows',()=>{
 const first=row(60,100,1),last=row(0,90,.95);
 const a=PondDetails.analyze([last,first,first,row(30,95,.97),row(20,0,0,'SENSOR_FAULT'),row(-5,900)],now);
 assert.equal(a.count,3);assert.equal(a.total,4);assert.equal(a.rate,-10);assert.ok(Math.abs(a.depthRate+5)<1e-8);assert.equal(a.span,1);
 const html=PondDetails.html({history:[first,last],status:'GOOD',current:last,hours:24});
 assert.match(html,/น้ำลด ยังไม่เท่ากับน้ำรั่ว/);assert.match(html,/ยังไม่มีเซ็นเซอร์อุณหภูมิน้ำ/);assert.doesNotMatch(html,/NaN|Infinity/);
});
test('pond sparse data cannot produce a rate and scenarios never use implicit defaults',()=>{
 assert.equal(PondDetails.analyze([row(10,100),row(0,90)],now).rate,null);
 assert.equal(PondDetails.estimate(null,5),null);assert.equal(PondDetails.estimate(0,5),null);
 assert.deepEqual(PondDetails.estimate(1000,5),{day:5,hour:5/24,litres:5000});
 assert.deepEqual(PondDetails.estimate(1000,0),{day:0,hour:0,litres:0});
 assert.equal(PondDetails.estimate(1000,Infinity),null);
});
