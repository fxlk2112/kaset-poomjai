import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  SENSOR_SCHEMA,
  cors,
  normalizeTelemetrySample,
  outputControlEnabled,
  sanitizeAppState
} from "../src/lark.js";
import worker from "../src/lark.js";

const sourceId = "MAIN_WATER_LEVEL_PI_ZERO_01";
const good = {
  schema: SENSOR_SCHEMA,
  source_id: sourceId,
  observed_at: new Date().toISOString(),
  quality: "GOOD",
  voltage_v: 1.2,
  current_ma: 6.4,
  depth_m: 0.577,
  staff_gauge_m: -0.423,
  volume_m3: 104.9,
  capacity_percent: 13.1,
  stale_after_s: 180,
  calibration_id: "OWNER_BASELINE_V1",
  volume_model_id: "OWNER_CONFIRMED_APPROXIMATE_LEGACY_BASELINE",
  sample_count: 9,
  output_control_allowed: false
};

class D1SqliteAdapter {
  constructor(database) { this.database = database; }
  prepare(sql) {
    const statement = this.database.prepare(sql);
    let values = [];
    return {
      bind(...next) { values = next; return this; },
      async first() { return statement.get(...values) || null; },
      async all() { return { results: statement.all(...values) }; },
      async run() {
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes || 0) } };
      }
    };
  }
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

test("normalizes a valid read-only telemetry sample", () => {
  const out = normalizeTelemetrySample(good, sourceId);
  assert.equal(out.source_id, sourceId);
  assert.equal(out.quality, "GOOD");
  assert.equal(out.volume_m3, 104.9);
  assert.equal(out.output_control_allowed, false);
});

test("rejects a telemetry payload that allows output control", () => {
  assert.throws(
    () => normalizeTelemetrySample({ ...good, output_control_allowed: true }, sourceId),
    /output_control_allowed=false/
  );
});

test("rejects a source mismatch and incomplete GOOD sample", () => {
  assert.throws(() => normalizeTelemetrySample(good, "OTHER_SOURCE"), /source_id/);
  assert.throws(() => normalizeTelemetrySample({ ...good, depth_m: null }, sourceId), /GOOD/);
});

test("non-GOOD samples carry no calculated water values", () => {
  const out = normalizeTelemetrySample({
    ...good,
    quality: "DISCONNECTED",
    depth_m: null,
    staff_gauge_m: null,
    volume_m3: null,
    capacity_percent: null
  }, sourceId);
  assert.equal(out.quality, "DISCONNECTED");
  assert.equal(out.volume_m3, null);
});

test("output control is disabled unless explicitly enabled", () => {
  assert.equal(outputControlEnabled({}), false);
  assert.equal(outputControlEnabled({ OUTPUT_CONTROL_ENABLED: "false" }), false);
  assert.equal(outputControlEnabled({ OUTPUT_CONTROL_ENABLED: "true" }), true);
});

test("CORS reflects only allowlisted origins", () => {
  const allowed = new Request("https://worker.invalid", { headers: { Origin: "https://farmultimate-solutions.pages.dev" } });
  const denied = new Request("https://worker.invalid", { headers: { Origin: "https://evil.invalid" } });
  assert.equal(cors(allowed, {})["Access-Control-Allow-Origin"], "https://farmultimate-solutions.pages.dev");
  assert.equal(cors(denied, {})["Access-Control-Allow-Origin"], undefined);
});

test("cloud state strips the local-only admin password", () => {
  const out = sanitizeAppState({ plots: [], adminPass: "local-only-value" });
  assert.equal("adminPass" in out, false);
  assert.deepEqual(out.plots, []);
});

test("water output routes fail closed before any database access", async () => {
  const request = new Request("https://worker.invalid", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://farmultimate-solutions.pages.dev" },
    body: JSON.stringify({ action: "water_set", systemId: "x", cmd: "on" })
  });
  const response = await worker.fetch(request, {});
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /SENSOR_PHASE1_READ_ONLY/);
});

test("sensor ingest rejects a missing bearer credential before database access", async () => {
  const request = new Request("https://worker.invalid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sensor_ingest", sample: good })
  });
  const response = await worker.fetch(request, {});
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.error, /credential/);
});

test("sensor ingest is idempotent and older samples cannot replace latest", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(readFileSync(new URL("../schema2.sql", import.meta.url), "utf8"));
    database.exec(readFileSync(new URL("../schema4.sql", import.meta.url), "utf8"));
    const deviceToken = "ab".repeat(32);
    database.prepare(
      "INSERT INTO sensor_devices (id,user_id,source_id,name,token_hash,active,created_at,revoked_at) VALUES (?,?,?,?,?,1,?,0)"
    ).run("device-1", "user-1", sourceId, "Main water", await sha256Hex(deviceToken), Date.now());
    const env = { DB: new D1SqliteAdapter(database) };
    const newest = { ...good, observed_at: new Date().toISOString() };
    const older = { ...good, observed_at: new Date(Date.now() - 60000).toISOString(), volume_m3: 99.1 };
    const send = async sample => {
      const response = await worker.fetch(new Request("https://worker.invalid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + deviceToken },
        body: JSON.stringify({ action: "sensor_ingest", sample })
      }), env);
      assert.equal(response.status, 200);
      return (await response.json()).data;
    };

    const first = await send(newest);
    const duplicate = await send(newest);
    const oldInsert = await send(older);
    assert.deepEqual([first.accepted, duplicate.duplicate, oldInsert.accepted], [true, true, true]);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM sensor_samples").get().n, 2);
    const latest = database.prepare("SELECT observed_at,volume_m3,output_control_allowed FROM sensor_latest").get();
    assert.equal(latest.observed_at, newest.observed_at);
    assert.equal(latest.volume_m3, newest.volume_m3);
    assert.equal(latest.output_control_allowed, 0);
  } finally {
    database.close();
  }
});
