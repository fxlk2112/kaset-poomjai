import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './relay-bench-harness.mjs';
test('LAN ownership disarms cloud and blocks cloud control while allowing readback',async()=>{
 const h=harness();await h.ready();const snapshot={...h.snapshot(),control_source:'LAN'};await h.poll({snapshot});
 for(const action of ['arm','off','disarm'])assert.equal((await h.call(action,{no_load_confirmed:true})).status,409);
 assert.equal((await h.pulse()).status,409);
 const state=await h.call('read');assert.equal(state.status,200);assert.equal(state.data.control_source,'LAN');assert.equal(state.data.ready,false);assert.equal(state.data.session_active,false);
});
test('new Pi instance cancels commands queued before outage or transport handoff',async()=>{
 const h=harness();await h.ready();const pending=await h.pulse();assert.equal(pending.status,200);
 const result=await h.poll({instance_id:crypto.randomUUID(),seen_stop_seq:-1});assert.equal(result.data.commands.length,0);assert.equal(result.data.armed_until,0);
 assert.equal(h.sql.prepare('SELECT status FROM relay_bench_commands WHERE id=?').get(pending.accepted.id).status,'CANCELLED');
});
