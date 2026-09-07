import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { handleRelayBench } from "../relay-bench.js";
const token = "fixture-owner-session-1234", device = "b".repeat(64);
export function harness() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE sessions(token TEXT,user_id TEXT,expires_at INTEGER); CREATE TABLE sensor_devices(user_id TEXT,token_hash TEXT,source_id TEXT,active INTEGER);");
  sql.exec(readFileSync(new URL("../relay-bench-schema.sql", import.meta.url), "utf8"));
  sql.prepare("INSERT INTO sessions VALUES(?,?,?)").run(token, "fixture-owner", Date.now() + 3600000);
  sql.prepare("INSERT INTO sensor_devices VALUES(?,?,?,1)").run("fixture-owner", createHash("sha256").update(device).digest("hex"), "MAIN_WATER_LEVEL_PI_ZERO_01");
  const db = { prepare(query) { return { bind(...args) { return { async first() { return sql.prepare(query).get(...args) || null; }, async all() { return { results: sql.prepare(query).all(...args) }; }, async run() { const r = sql.prepare(query).run(...args); return { meta: { changes: Number(r.changes) } }; } }; } }; }, async batch(statements) { sql.exec("BEGIN"); try { const results = []; for (const s of statements) results.push(await s.run()); sql.exec("COMMIT"); return results; } catch (e) { sql.exec("ROLLBACK"); throw e; } } };
  const env = { MONITOR_DB: db, RELAY_BENCH_ENABLED: "true" };
  const instance = randomUUID();
  const snapshot = () => ({ protocol_version: 2, observed_at: new Date().toISOString(), fault: "NONE", modules: ["RELAY_A", "RELAY_B"].map(id => ({ id, online: true, identity_verified: true, crc_valid: true, mode_verified: true, relay_status: Array(8).fill(false), digital_inputs: Array(8).fill(false) })) });
  async function call(action, data = {}, headers = {}, override = env) {
    const r = await handleRelayBench(new Request("https://app.example.invalid/api/relay-bench/" + action, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ token, ...data }) }), override);
    return { status: r.status, ...(await r.json()) };
  }
  const poll = (extra = {}) => call("poll", { instance_id: instance, seen_stop_seq: 1, snapshot: snapshot(), ...extra }, { Authorization: "Bearer " + device });
  async function ready() { await poll({ seen_stop_seq: -1 }); await poll(); return call("arm", { no_load_confirmed: true }); }
  const pulse = (extra = {}) => call("pulse", { id: randomUUID(), module: "RELAY_A", channel: 1, pulse_seconds: 5, ...extra });
  return { sql, call, poll, ready, pulse, snapshot, env };
}
