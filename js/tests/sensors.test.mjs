import test from "node:test";
import assert from "node:assert/strict";

await import("../sensors.js");
const Sensors = globalThis.SensorTelemetry;

test("frontend rejects responses that are not explicitly read-only", () => {
  assert.throws(
    () => Sensors.normalizeCurrentResponse({ output_control_allowed: true }),
    /อ่านอย่างเดียว/
  );
});

test("frontend normalizes numeric telemetry", () => {
  const out = Sensors.normalizeCurrentResponse({
    output_control_allowed: false,
    status: "GOOD",
    age_s: 12.5,
    current: { observed_ts: 1000, depth_m: "0.577", volume_m3: "104.9", capacity_percent: "13.1" }
  });
  assert.equal(out.status, "GOOD");
  assert.equal(out.current.depth_m, 0.577);
  assert.equal(out.current.volume_m3, 104.9);
});

test("history parsing preserves faults and converts finite values", () => {
  const rows = Sensors.historyRows([
    { observed_at: "2026-08-26T00:00:00Z", quality: "GOOD", volume_m3: "100.5" },
    { observed_at: "2026-08-26T00:05:00Z", quality: "SENSOR_FAULT", volume_m3: null }
  ]);
  assert.equal(rows[0].volume_m3, 100.5);
  assert.equal(rows[1].volume_m3, null);
});

test("downsample keeps endpoints and target size", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ i }));
  const sampled = Sensors.downsample(rows, 10);
  assert.equal(sampled.length, 10);
  assert.equal(sampled[0].i, 0);
  assert.equal(sampled.at(-1).i, 99);
});

test("status labels distinguish stale and sensor faults", () => {
  assert.equal(Sensors.statusMeta("STALE").cls, "stale");
  assert.equal(Sensors.statusMeta("SENSOR_FAULT").cls, "fault");
});
