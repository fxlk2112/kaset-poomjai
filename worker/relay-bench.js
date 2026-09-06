import { projectRelays } from "./monitor-contract.js";
const SOURCE = "MAIN_WATER_LEVEL_PI_ZERO_01";
const SESSION_MS = 15 * 60000;
const COMMAND_MS = 8000;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACTIVE = "('QUEUED','CLAIMED','ON_VERIFIED')";
const reply = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
async function readBody(request) {
  if (!request.headers.get("Content-Type")?.includes("application/json") || !request.body) throw new Error("JSON_REQUIRED");
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new Error("BODY_LIMIT"); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function projectBenchSnapshot(p, now = Date.now()) {
  const readings = projectRelays({ ...p, output_control_allowed: false }, now);
  const modes = Array.isArray(p?.modules) && p.modules.length === 2 && p.modules.every(m => m.mode_verified === true);
  const fault = ["NONE", "READBACK_FAILED", "IDENTITY_MISMATCH", "MODE_MISMATCH", "UNEXPECTED_ON", "WRITE_FAILED", "OFF_UNVERIFIED", "JOURNAL_FAILED", "LOCAL_DISABLED"].includes(p?.fault) ? p.fault : "READBACK_FAILED";
  const ready = readings.status === "GOOD" && readings.modules.length === 2 && modes && fault === "NONE" && readings.modules.every(m => [...m.relay_status, ...m.digital_inputs].every(v => typeof v === "boolean"));
  return { mode: "NO_LOAD_BENCH", observed_at: readings.observed_at, modules: readings.modules, mode_verified: modes, fault, ready };
}
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
async function stateFor(db, user) {
  await stmt(db, "INSERT OR IGNORE INTO relay_bench_state(user_id) VALUES(?1)", user).run();
  return stmt(db, "SELECT * FROM relay_bench_state WHERE user_id=?1", user).first();
}
async function publicState(db, user, now) {
  const s = await stateFor(db, user);
  const p = JSON.parse(s.snapshot);
  const fresh = now - s.heartbeat_at < 12000 && now - Date.parse(p.observed_at) < 12000;
  const last = await stmt(db, "SELECT id,module,channel,status,created_at,updated_at FROM relay_bench_commands WHERE user_id=?1 ORDER BY created_at DESC LIMIT 1", user).first();
  return { mode: "NO_LOAD_BENCH", field_control_allowed: false, session_active: s.armed_until > now, armed_until: s.armed_until,
    ready: fresh && p.ready === true && s.seen_stop_seq === s.stop_seq, connected: fresh, stopping: s.seen_stop_seq !== s.stop_seq,
    snapshot: fresh ? p : { mode: "NO_LOAD_BENCH", observed_at: p.observed_at || null, modules: [], ready: false, fault: "READBACK_FAILED" },
    last_command: last, pulse_seconds: 5, session_minutes: 15, server_now: now };
}
async function cancel(db, user, now, disarm) {
  await db.batch([
    stmt(db, `UPDATE relay_bench_commands SET status='CANCELLED',updated_at=?2 WHERE user_id=?1 AND status IN ${ACTIVE}`, user, now),
    stmt(db, `UPDATE relay_bench_state SET stop_seq=stop_seq+1,armed_until=CASE WHEN ?2=1 THEN 0 ELSE armed_until END WHERE user_id=?1`, user, disarm ? 1 : 0)
  ]);
}
export async function handleRelayBench(request, env) {
  if (env.RELAY_BENCH_ENABLED !== "true" || !env.MONITOR_DB) return reply({ ok: false, error: "BENCH_DISABLED" }, 503);
  const url = new URL(request.url), action = url.pathname.slice("/api/relay-bench/".length), origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return reply({ ok: false, error: "ORIGIN_DENIED" }, 403);
  if (request.method !== "POST" || !["read", "arm", "pulse", "off", "disarm", "poll"].includes(action)) return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const db = env.MONITOR_DB, now = Date.now();
  try {
    const p = await readBody(request); let owner;
    if (action === "poll") {
      const credential = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
      if (!credential) return reply({ ok: false, error: "DEVICE_AUTH_REQUIRED" }, 401);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential)))].map(v => v.toString(16).padStart(2, "0")).join("");
      owner = await stmt(db, "SELECT user_id FROM sensor_devices WHERE token_hash=?1 AND source_id=?2 AND active=1", hash, SOURCE).first();
    } else {
      if (typeof p.token !== "string" || p.token.length < 16 || p.token.length > 256) return reply({ ok: false, error: "OWNER_LOGIN_REQUIRED" }, 401);
      owner = await stmt(db, "SELECT s.user_id FROM sessions s JOIN sensor_devices d ON d.user_id=s.user_id WHERE s.token=?1 AND s.expires_at>?2 AND d.source_id=?3 AND d.active=1 LIMIT 1", p.token, now, SOURCE).first();
    }
    if (!owner) return reply({ ok: false, error: "AUTH_DENIED" }, 403);
    const user = owner.user_id;
    let s = await stateFor(db, user);
    // Expired, never-delivered commands cannot be picked up on reconnection.
    await stmt(db, "UPDATE relay_bench_commands SET status='EXPIRED',updated_at=?2 WHERE user_id=?1 AND status='QUEUED' AND expires_at<=?2", user, now).run();
    if (action === "poll") {
      if (!UUID.test(p.instance_id) || !Number.isInteger(p.seen_stop_seq) || p.seen_stop_seq < -1) return reply({ ok: false, error: "INVALID_POLL" }, 400);
      const snapshot = projectBenchSnapshot(p.snapshot, now);
      if (s.instance_id !== p.instance_id) {
        await cancel(db, user, now, true);
        await stmt(db, "UPDATE relay_bench_state SET instance_id=?2,seen_stop_seq=-1 WHERE user_id=?1", user, p.instance_id).run();
      } else if (s.armed_until && (s.armed_until <= now || snapshot.fault !== "NONE")) await cancel(db, user, now, true);
      s = await stateFor(db, user);
      const seen = p.seen_stop_seq === s.stop_seq ? p.seen_stop_seq : -1;
      await stmt(db, "UPDATE relay_bench_state SET heartbeat_at=?2,snapshot=?3,seen_stop_seq=?4 WHERE user_id=?1 AND instance_id=?5", user, now, JSON.stringify(snapshot), seen, p.instance_id).run();
      if (p.ack && UUID.test(p.ack.id) && ["ON_VERIFIED", "OFF_VERIFIED", "FAILED"].includes(p.ack.status)) {
        await stmt(db, "UPDATE relay_bench_commands SET status=?3,updated_at=?4 WHERE user_id=?1 AND id=?2 AND claimed_by=?5 AND status IN ('CLAIMED','ON_VERIFIED')", user, p.ack.id, p.ack.status, now, p.instance_id).run();
      }
      let command = null;
      if (snapshot.ready && seen === s.stop_seq && s.armed_until > now + 6000) {
        command = await stmt(db, "UPDATE relay_bench_commands SET status='CLAIMED',claimed_by=?2,updated_at=?3 WHERE id=(SELECT id FROM relay_bench_commands WHERE user_id=?1 AND status='QUEUED' AND expires_at>?3 AND stop_seq=?4 ORDER BY created_at LIMIT 1) RETURNING id,module,channel,expires_at,stop_seq", user, p.instance_id, now, s.stop_seq).first();
      }
      return reply({ ok: true, data: { server_now: now, armed_until: s.armed_until, stop_seq: s.stop_seq, command: command ? { ...command, pulse_seconds: 5 } : null } });
    }
    if (action === "off" || action === "disarm") await cancel(db, user, now, action === "disarm");
    if (action === "arm") {
      const state = await publicState(db, user, now);
      const allOff = state.snapshot.modules.length === 2 && state.snapshot.modules.every(m => m.relay_status.every(v => v === false));
      if (p.no_load_confirmed !== true || !state.ready || !allOff) return reply({ ok: false, error: "NO_LOAD_AND_READY_REQUIRED" }, 409);
      await stmt(db, "UPDATE relay_bench_state SET armed_until=?2 WHERE user_id=?1", user, now + SESSION_MS).run();
    }
    if (action === "pulse") {
      if (!UUID.test(p.id) || !["RELAY_A", "RELAY_B"].includes(p.module) || !Number.isInteger(p.channel) || p.channel < 1 || p.channel > 8 || p.pulse_seconds !== 5) return reply({ ok: false, error: "INVALID_PULSE" }, 400);
      const old = await stmt(db, "SELECT id,module,channel FROM relay_bench_commands WHERE id=?1 AND user_id=?2", p.id, user).first();
      if (old) {
        if (old.module !== p.module || old.channel !== p.channel) return reply({ ok: false, error: "ID_REUSED" }, 409);
        return reply({ ok: true, data: await publicState(db, user, now) });
      }
      // The conditional insert + partial unique index enforce a single active pulse,
      // even for concurrent tabs. The Pi independently enforces the same boundary.
      const inserted = await stmt(db, `INSERT INTO relay_bench_commands(id,user_id,module,channel,created_at,expires_at,stop_seq,status,updated_at)
        SELECT ?1,user_id,?3,?4,?5,?6,stop_seq,'QUEUED',?5 FROM relay_bench_state
        WHERE user_id=?2 AND armed_until>?5+6000 AND heartbeat_at>?5-12000 AND seen_stop_seq=stop_seq
        AND json_extract(snapshot,'$.ready')=1
        AND NOT EXISTS(SELECT 1 FROM relay_bench_commands WHERE user_id=?2 AND status IN ${ACTIVE})
        AND (SELECT COUNT(*) FROM relay_bench_commands WHERE user_id=?2 AND created_at>?5-60000)<12`, p.id, user, p.module, p.channel, now, now + COMMAND_MS).run();
      if (!inserted.meta.changes) return reply({ ok: false, error: "NOT_READY_OR_BUSY" }, 409);
    }
    return reply({ ok: true, data: await publicState(db, user, now) });
  } catch { return reply({ ok: false, error: "BENCH_REQUEST_FAILED" }, 400); }
}
