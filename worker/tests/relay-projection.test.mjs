import test from "node:test";
import assert from "node:assert/strict";
import { projectRelays, projectHealth } from "../monitor-contract.js";
const now = Date.now();
const sample = { observed_at: new Date(now - 1000).toISOString(), output_control_allowed: false, modules: [{ id: "RELAY_A", online: true, identity_verified: true, crc_valid: true, relay_status: Array(8).fill(false), digital_inputs: Array(8).fill(true) }] };
test("relay projection strips identities and commands and survives a publish/read projection round trip", () => {
  const p = structuredClone(sample); p.modules[0].private_host = "fixture-private-host"; p.modules[0].command = "ON";
  const result = projectRelays(p, now);
  assert.equal(result.status, "GOOD"); assert.equal(result.modules[0].digital_inputs[0], true);
  assert.doesNotMatch(JSON.stringify(result), /private_host|command|fixture-private/);
  assert.deepEqual(projectRelays(result, now), result);
  assert.equal(projectRelays(result, now + 181000).status, "STALE");
});
test("untrusted relay observations remain unknown, including false-looking strings", () => {
  for (const key of ["online", "identity_verified", "crc_valid"]) {
    const p = structuredClone(sample); p.modules[0][key] = false;
    assert.deepEqual(projectRelays(p, now).modules[0].relay_status, Array(8).fill(null));
  }
  const p = structuredClone(sample); p.modules[0].relay_status[0] = "false";
  assert.equal(projectRelays(p, now).modules[0].relay_status[0], null);
});
test("missing or malformed relay data does not break independent Pi health", () => {
  for (const p of [null, {}, { ...sample, observed_at: "invalid" }, { ...sample, output_control_allowed: true }, { ...sample, modules: [sample.modules[0], sample.modules[0]] }, { ...sample, observed_at: new Date(now + 121000).toISOString() }]) {
    const health = projectHealth({ generated_at: new Date(now).toISOString(), output_control_allowed: false, sources: {}, history: {}, relays: p }, now);
    assert.equal(health.relays.status, "NO_DATA"); assert.equal(health.output_control_allowed, false);
  }
});
