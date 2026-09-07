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
  const observed = Date.parse(readings.observed_at);
  const ready = readings.status === "GOOD" && observed <= now + 2000 && now - observed < 12000 && readings.modules.length === 2 && modes && fault === "NONE" && readings.modules.every(m => [...m.relay_status, ...m.digital_inputs].every(v => typeof v === "boolean"));
  const control_source = p?.control_source === "LAN" ? "LAN" : "CLOUD";
  return { protocol_version: p?.protocol_version === 2 ? 2 : 1, mode: "NO_LOAD_BENCH", observed_at: readings.observed_at, modules: readings.modules, mode_verified: modes, fault, control_source, ready: ready && control_source === "CLOUD" };
}
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
async function stateFor(db, user) {
  let state = await stmt(db, "SELECT * FROM relay_bench_state WHERE user_id=?1", user).first();
  if (!state) {
    await stmt(db, "INSERT OR IGNORE INTO relay_bench_state(user_id) VALUES(?1)", user).run();
    state = await stmt(db, "SELECT * FROM relay_bench_state WHERE user_id=?1", user).first();
  }
  return state;
}
async function publicState(db, user, now, supplied) {
  const [s, rows] = await Promise.all([supplied || stateFor(db, user), stmt(db, "SELECT id,module,channel,action,status,created_at,updated_at FROM relay_bench_commands WHERE user_id=?1 ORDER BY created_at DESC LIMIT 32", user).all()]);
  const p = JSON.parse(s.snapshot);
  const observed = Date.parse(p.observed_at);
  const fresh = now - s.heartbeat_at < 12000 && observed <= now + 2000 && now - observed < 12000;
  const compatible = p.protocol_version === 2;
  return { mode: "NO_LOAD_BENCH", protocol_version: 2, field_control_allowed: false, session_active: s.armed_until > now, armed_until: s.armed_until,
    control_source: p.control_source || "CLOUD", ready: fresh && compatible && p.ready === true && s.seen_stop_seq === s.stop_seq, connected: fresh, stopping: s.seen_stop_seq !== s.stop_seq,
    snapshot: fresh ? p : { mode: "NO_LOAD_BENCH", observed_at: p.observed_at || null, modules: [], ready: false, fault: "READBACK_FAILED" },
    commands: rows.results, last_command: rows.results[0] || null, pulse_seconds: 5, session_minutes: 15, server_now: now };
}
async function cancel(db, user, now, disarm) {
  await db.batch([
    stmt(db, "UPDATE relay_bench_commands SET status='CANCELLED',updated_at=?2 WHERE user_id=?1 AND status IN " + ACTIVE, user, now),
    stmt(db, "UPDATE relay_bench_state SET stop_seq=stop_seq+1,armed_until=CASE WHEN ?2=1 THEN 0 ELSE armed_until END WHERE user_id=?1", user, disarm ? 1 : 0)
  ]);
}
const validChannel = p => ["RELAY_A", "RELAY_B"].includes(p.module) && Number.isInteger(p.channel) && p.channel >= 1 && p.channel <= 8;
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
    if (!["poll", "read"].includes(action)) {
      const localOwner = await stmt(db, "SELECT snapshot FROM relay_bench_state WHERE user_id=?1", user).first();
      if (localOwner && JSON.parse(localOwner.snapshot).control_source === "LAN") return reply({ ok: false, error: "LOCAL_CONTROL_ACTIVE" }, 409);
    }
    if (action === "pulse" || (action === "off" && (p.module !== undefined || p.channel !== undefined))) {
      const kind = action === "pulse" ? "PULSE" : "OFF";
      if (!UUID.test(p.id) || !validChannel(p) || (kind === "PULSE" && p.pulse_seconds !== 5) || (p.cancel_id !== undefined && !UUID.test(p.cancel_id))) return reply({ ok: false, error: "INVALID_PULSE" }, 400);
      const old = await stmt(db, "SELECT id,module,channel,action,status FROM relay_bench_commands WHERE id=?1 AND user_id=?2", p.id, user).first();
      if (old) {
        if (old.module !== p.module || old.channel !== p.channel || old.action !== kind) return reply({ ok: false, error: "ID_REUSED" }, 409);
        return reply({ ok: true, accepted: old, server_now: now });
      }
      const command = { id: p.id, module: p.module, channel: p.channel, action: kind, status: "QUEUED" };
      if (kind === "OFF") {
        await db.batch([
          // Remember an in-flight ON cancelled by this click, even if its HTTP
          // request arrives after OFF has completed. Never replay that ON id.
          ...(p.cancel_id ? [stmt(db, "INSERT OR IGNORE INTO relay_bench_commands(id,user_id,module,channel,action,created_at,expires_at,stop_seq,status,updated_at) SELECT ?1,user_id,?3,?4,'PULSE',?5,?5,stop_seq,'CANCELLED',?5 FROM relay_bench_state WHERE user_id=?2", p.cancel_id, user, p.module, p.channel, now)] : []),
          stmt(db, "UPDATE relay_bench_commands SET status='CANCELLED',updated_at=?4 WHERE user_id=?1 AND module=?2 AND channel=?3 AND status IN " + ACTIVE, user, p.module, p.channel, now),
          stmt(db, "INSERT INTO relay_bench_commands(id,user_id,module,channel,action,created_at,expires_at,stop_seq,status,updated_at) SELECT ?1,user_id,?3,?4,'OFF',?5,?6,stop_seq,'QUEUED',?5 FROM relay_bench_state WHERE user_id=?2", p.id, user, p.module, p.channel, now, now + COMMAND_MS)
        ]);
      } else {
        const inserted = await stmt(db, `INSERT INTO relay_bench_commands(id,user_id,module,channel,action,created_at,expires_at,stop_seq,status,updated_at)
          SELECT ?1,user_id,?3,?4,'PULSE',?5,?6,stop_seq,'QUEUED',?5 FROM relay_bench_state
          WHERE user_id=?2 AND armed_until>?5+6000 AND heartbeat_at>?5-12000 AND seen_stop_seq=stop_seq
          AND json_extract(snapshot,'$.ready')=1 AND json_extract(snapshot,'$.protocol_version')=2
          AND COALESCE(json_extract(snapshot,'$.control_source'),'CLOUD')='CLOUD'
          AND NOT EXISTS(SELECT 1 FROM relay_bench_commands WHERE user_id=?2 AND module=?3 AND channel=?4 AND status IN ${ACTIVE})
          AND (SELECT COUNT(*) FROM relay_bench_commands WHERE user_id=?2 AND action='PULSE' AND created_at>?5-60000)<120`, p.id, user, p.module, p.channel, now, now + COMMAND_MS).run();
        if (!inserted.meta.changes) return reply({ ok: false, error: "NOT_READY_OR_BUSY" }, 409);
      }
      return reply({ ok: true, accepted: command, server_now: now });
    }
    let s = await stateFor(db, user);
    if (action === "poll") {
      if (!UUID.test(p.instance_id) || !Number.isInteger(p.seen_stop_seq) || p.seen_stop_seq < -1) return reply({ ok: false, error: "INVALID_POLL" }, 400);
      const snapshot = projectBenchSnapshot(p.snapshot, now);
      if (s.instance_id !== p.instance_id) {
        await cancel(db, user, now, true);
        await stmt(db, "UPDATE relay_bench_state SET instance_id=?2,seen_stop_seq=-1 WHERE user_id=?1", user, p.instance_id).run();
        s = await stateFor(db, user);
      } else if (s.armed_until && (s.armed_until <= now || snapshot.fault !== "NONE" || snapshot.protocol_version !== 2 || snapshot.control_source === "LAN")) {
        await cancel(db, user, now, true); s = await stateFor(db, user);
      }
      const seen = p.seen_stop_seq === s.stop_seq ? p.seen_stop_seq : -1;
      const acks = (Array.isArray(p.acks) ? p.acks : p.ack ? [p.ack] : []).slice(0,32).filter(a => a && UUID.test(a.id) && ["ON_VERIFIED", "OFF_VERIFIED", "FAILED"].includes(a.status));
      await db.batch([
        stmt(db, "UPDATE relay_bench_commands SET status='EXPIRED',updated_at=?2 WHERE user_id=?1 AND status='QUEUED' AND expires_at<=?2", user, now),
        stmt(db, "UPDATE relay_bench_state SET heartbeat_at=?2,snapshot=?3,seen_stop_seq=?4 WHERE user_id=?1 AND instance_id=?5", user, now, JSON.stringify(snapshot), seen, p.instance_id),
        ...acks.map(a => stmt(db, "UPDATE relay_bench_commands SET status=?3,updated_at=?4 WHERE user_id=?1 AND id=?2 AND claimed_by=?5 AND status IN ('CLAIMED','ON_VERIFIED') AND (action='PULSE' OR ?3!='ON_VERIFIED')", user, a.id, a.status, now, p.instance_id))
      ]);
      let commands = [];
      if (snapshot.ready && snapshot.protocol_version === 2 && seen === s.stop_seq) {
        // Atomically claim one bounded batch; per-channel unique index prevents overlap.
        const claimed = await stmt(db, `UPDATE relay_bench_commands SET status='CLAIMED',claimed_by=?2,updated_at=?3
          WHERE id IN (SELECT c.id FROM relay_bench_commands c JOIN relay_bench_state s ON s.user_id=c.user_id
          WHERE c.user_id=?1 AND c.status='QUEUED' AND c.expires_at>?3 AND c.stop_seq=s.stop_seq AND s.stop_seq=?4
          AND s.seen_stop_seq=s.stop_seq AND s.instance_id=?2 AND (c.action='OFF' OR s.armed_until>?3+6000)
          ORDER BY CASE c.action WHEN 'OFF' THEN 0 ELSE 1 END,c.created_at LIMIT 16)
          RETURNING id,module,channel,action,expires_at,stop_seq`, user, p.instance_id, now, s.stop_seq).all();
        commands = claimed.results.map(c => ({ ...c, pulse_seconds: c.action === "PULSE" ? 5 : 0 }));
      }
      return reply({ ok: true, data: { protocol_version: 2, server_now: now, armed_until: s.armed_until, stop_seq: s.stop_seq, commands, acknowledged_ids: acks.map(a => a.id) } });
    }
    if (action === "off" || action === "disarm") {
      await cancel(db, user, now, action === "disarm");
      return reply({ ok: true, accepted: { action: action === "off" ? "ALL_OFF" : "DISARM" }, server_now: now });
    }
    if (action === "arm") {
      const state = await publicState(db, user, now, s);
      const allOff = state.snapshot.modules.length === 2 && state.snapshot.modules.every(m => m.relay_status.every(v => v === false));
      if (p.no_load_confirmed !== true || !state.ready || !allOff) return reply({ ok: false, error: "NO_LOAD_AND_READY_REQUIRED" }, 409);
      await stmt(db, "UPDATE relay_bench_state SET armed_until=?2 WHERE user_id=?1", user, now + SESSION_MS).run();
      s.armed_until = now + SESSION_MS;
    }
    return reply({ ok: true, data: await publicState(db, user, now, s) });
  } catch { return reply({ ok: false, error: "BENCH_REQUEST_FAILED" }, 400); }
}
