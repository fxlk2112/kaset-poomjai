import test from "node:test";
import assert from "node:assert/strict";
await import("../relay-panel.js");
const panel = globalThis.RelayPanel;
const now = Date.now();
const sample = { output_control_allowed: false, observed_at: new Date(now - 1000).toISOString(), modules: [{ id: "RELAY_A", online: true, identity_verified: true, crc_valid: true, relay_status: [true, false, false, false, false, false, false, false], digital_inputs: Array(8).fill(false) }] };
test("real relay readbacks distinguish ON, OFF, missing modules and unknown bits", () => {
  const result = panel.viewModel(sample, now);
  assert.equal(result.modules[0].relays[0], true);
  assert.equal(result.modules[0].relays[1], false);
  assert.deepEqual(result.modules[1].relays, Array(8).fill(null));
});
test("stale, future, mismatched identity, offline and malformed values never appear as current OFF", () => {
  for (const edit of [p => p.observed_at = new Date(now - 181000).toISOString(), p => p.observed_at = new Date(now + 121000).toISOString(), p => p.modules[0].identity_verified = false, p => p.modules[0].online = false, p => p.output_control_allowed = true, p => p.modules.push(p.modules[0])]) {
    const p = structuredClone(sample); edit(p); assert.deepEqual(panel.viewModel(p, now).modules[0].relays, Array(8).fill(null));
  }
  const p = structuredClone(sample); p.modules[0].relay_status[0] = "false";
  assert.equal(panel.viewModel(p, now).modules[0].relays[0], null);
});
test("rendered switches are disabled regardless of data and cannot call command handlers", () => {
  globalThis.SensorTelemetry = { state: { piHealth: { relays: sample } } };
  const html = panel.cardHtml();
  assert.equal((html.match(/disabled aria-describedby="relay-control-blocker"/g) || []).length, 32);
  assert.match(html, /ยังสั่งเปิด–ปิดอุปกรณ์จริงไม่ได้/);
  assert.doesNotMatch(html, /onclick="[^\"]*(?:command|toggle|relayOn|relayOff)/i);
  delete globalThis.SensorTelemetry;
});
