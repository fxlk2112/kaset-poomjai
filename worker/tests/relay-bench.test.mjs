import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { harness } from "./relay-bench-harness.mjs";

test("bench endpoints require scoped owner/device authentication and same origin", async () => {
  const h = harness();
  assert.equal((await h.call("read", { token: "" })).status, 401);
  assert.equal((await h.call("arm", { token: "wrong-owner-session-0000", no_load_confirmed: true })).status, 403);
  assert.equal((await h.call("read", {}, { Origin: "https://foreign.example.invalid" })).status, 403);
  assert.equal((await h.call("poll")).status, 401);
  assert.equal((await h.call("read", {}, {}, { ...h.env, RELAY_BENCH_ENABLED: "false" })).status, 503);
  assert.equal(h.sql.prepare("SELECT COUNT(*) AS n FROM relay_bench_commands").get().n, 0);
});
test("only confirmed no-load sessions with fresh verified all-off readbacks can arm", async () => {
  const h = harness(); assert.equal((await h.call("arm", { no_load_confirmed: true })).status, 409);
  await h.poll({ seen_stop_seq: -1 }); await h.poll();
  assert.equal((await h.call("arm")).status, 409);
  const bad = h.snapshot(); bad.modules[0].relay_status[0] = true; await h.poll({ snapshot: bad });
  assert.equal((await h.call("arm", { no_load_confirmed: true })).status, 409);
  await h.poll(); assert.equal((await h.call("arm", { no_load_confirmed: true })).status, 200);
});
test("pulse is claimed once, duplicate requests are idempotent and ACK tracks real completion", async () => {
  const h = harness(); await h.ready();
  const id = randomUUID(); assert.equal((await h.pulse({ id })).status, 200);
  assert.equal((await h.pulse({ id })).status, 200);
  assert.equal((await h.pulse({ id, channel: 2 })).status, 409);
  const claimed = await h.poll(); assert.equal(claimed.data.commands[0].id, id);
  assert.equal((await h.poll()).data.commands.length, 0);
  await h.poll({ ack: { id, status: "ON_VERIFIED" } });
  assert.equal((await h.call("read")).data.last_command.status, "ON_VERIFIED");
  await h.poll({ ack: { id, status: "OFF_VERIFIED" } });
  assert.equal((await h.call("read")).data.last_command.status, "OFF_VERIFIED");
});
test("different channels overlap, same channel cannot retrigger, global OFF cancels all", async () => {
  const h = harness(); await h.ready();
  const results = await Promise.all([h.pulse(), h.pulse({ channel: 2 })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 200]);
  assert.equal((await h.pulse()).status, 409);
  await h.call("off"); assert.equal((await h.poll()).data.commands.length, 0);
  assert.equal((await h.pulse()).status, 409);
  await h.poll({ seen_stop_seq: 2 }); assert.equal((await h.pulse()).status, 200);
});
test("expired, unarmed, invalid and out-of-range commands never reach a device", async () => {
  const h = harness(); assert.equal((await h.pulse()).status, 409); await h.ready();
  for (const extra of [{ module: "RELAY_C" }, { channel: 0 }, { channel: 9 }, { channel: "1" }, { pulse_seconds: 60 }]) assert.equal((await h.pulse(extra)).status, 400);
  await h.pulse(); h.sql.exec("UPDATE relay_bench_commands SET expires_at=0");
  assert.equal((await h.poll()).data.commands.length, 0);
  assert.equal((await h.call("read")).data.last_command.status, "EXPIRED");
  await h.call("disarm"); assert.equal((await h.pulse()).status, 409);
});
test("agent restart or a failed readback disarms the session and never replays commands", async () => {
  const h = harness(); await h.ready(); await h.pulse(); await h.poll();
  await h.poll({ instance_id: randomUUID() });
  assert.equal((await h.call("read")).data.session_active, false);
  assert.equal((await h.call("read")).data.last_command.status, "CANCELLED");
});

test("individual OFF supersedes only its channel and preserves the other channel", async () => {
  const h=harness(); await h.ready(); await h.pulse(); await h.pulse({channel:2});
  const claimed=await h.poll(); assert.equal(claimed.data.commands.length,2);
  const off=await h.call("off",{id:randomUUID(),module:"RELAY_A",channel:1}); assert.equal(off.status,200);
  assert.equal((await h.poll()).data.commands[0].action,"OFF");
  const rows=h.sql.prepare("SELECT channel,action,status FROM relay_bench_commands ORDER BY created_at").all();
  assert.equal(rows.find(r=>r.channel===2).status,"CLAIMED");
  assert.equal(rows.find(r=>r.channel===1&&r.action==='PULSE').status,"CANCELLED");
});
test("OFF before a delayed ON request leaves a cancellation tombstone so ON never starts", async () => {
  const h=harness();await h.ready();const id=randomUUID(),offId=randomUUID();
  await h.call('off',{id:offId,module:'RELAY_A',channel:1,cancel_id:id});
  const poll=await h.poll();assert.equal(poll.data.commands[0].action,'OFF');
  await h.poll({acks:[{id:offId,status:'OFF_VERIFIED'}]});
  assert.equal((await h.pulse({id})).accepted.status,'CANCELLED');
  assert.equal((await h.poll()).data.commands.length,0);
  assert.equal((await h.pulse({channel:2})).status,200);
});
test("v1 agents fail closed; v2 accepts all 16 channels and returns per-channel commands",async()=>{
  const h=harness(); await h.ready(); const old=h.snapshot();delete old.protocol_version;
  await h.poll({snapshot:old});assert.equal((await h.pulse()).status,409);
  await h.poll({seen_stop_seq:2});await h.call('arm',{no_load_confirmed:true});
  for(const module of ['RELAY_A','RELAY_B'])for(let channel=1;channel<=8;channel++)assert.equal((await h.pulse({module,channel})).status,200);
  const claimed=await h.poll({seen_stop_seq:2});assert.equal(claimed.data.commands.length,16);
  const state=await h.call('read');assert.equal(state.data.commands.length,16);assert.equal(state.data.protocol_version,2);
});
