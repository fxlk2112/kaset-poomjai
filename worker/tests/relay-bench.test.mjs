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
  const claimed = await h.poll(); assert.equal(claimed.data.command.id, id);
  assert.equal((await h.poll()).data.command, null);
  await h.poll({ ack: { id, status: "ON_VERIFIED" } });
  assert.equal((await h.call("read")).data.last_command.status, "ON_VERIFIED");
  await h.poll({ ack: { id, status: "OFF_VERIFIED" } });
  assert.equal((await h.call("read")).data.last_command.status, "OFF_VERIFIED");
});
test("concurrent pulses serialize and OFF cancels queued work before another pulse", async () => {
  const h = harness(); await h.ready();
  const results = await Promise.all([h.pulse(), h.pulse({ channel: 2 })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  await h.call("off"); assert.equal((await h.poll()).data.command, null);
  assert.equal((await h.pulse()).status, 409);
  await h.poll({ seen_stop_seq: 2 }); assert.equal((await h.pulse()).status, 200);
});
test("expired, unarmed, invalid and out-of-range commands never reach a device", async () => {
  const h = harness(); assert.equal((await h.pulse()).status, 409); await h.ready();
  for (const extra of [{ module: "RELAY_C" }, { channel: 0 }, { channel: 9 }, { channel: "1" }, { pulse_seconds: 60 }]) assert.equal((await h.pulse(extra)).status, 400);
  await h.pulse(); h.sql.exec("UPDATE relay_bench_commands SET expires_at=0");
  assert.equal((await h.poll()).data.command, null);
  assert.equal((await h.call("read")).data.last_command.status, "EXPIRED");
  await h.call("disarm"); assert.equal((await h.pulse()).status, 409);
});
test("agent restart or a failed readback disarms the session and never replays commands", async () => {
  const h = harness(); await h.ready(); await h.pulse(); await h.poll();
  await h.poll({ instance_id: randomUUID() });
  assert.equal((await h.call("read")).data.session_active, false);
  assert.equal((await h.call("read")).data.last_command.status, "CANCELLED");
});
