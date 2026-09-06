import { projectHealth, projectWeather } from "./monitor-contract.js";
const SOURCE = "MAIN_WATER_LEVEL_PI_ZERO_01";
const reply = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
async function body(request, maxBytes) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) throw new Error("JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("BODY_REQUIRED");
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("BODY_LIMIT"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(buffer));
}
export async function handleMonitor(request, env) {
  if (!env.MONITOR_DB) return reply({ ok: false, error: "MONITOR_UNAVAILABLE" }, 503);
  const url = new URL(request.url), path = url.pathname;
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return reply({ ok: false, error: "ORIGIN_DENIED" }, 403);
  try {
    if (path === "/api/monitor/weather" && request.method === "GET") {
      const row = await env.MONITOR_DB.prepare("SELECT payload FROM owner_monitor_snapshots WHERE kind='weather' ORDER BY observed_ts DESC LIMIT 1").first();
      return row ? reply({ ok: true, data: projectWeather(JSON.parse(row.payload)) }) : reply({ ok: false, error: "NO_FORECAST" }, 404);
    }
    if (request.method !== "POST" || !["/api/monitor/publish", "/api/monitor/read"].includes(path)) return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    if (path.endsWith("/publish")) {
      const credential = request.headers.get("Authorization")?.match(/^Bearer ([a-fA-F0-9]{64})$/)?.[1];
      if (!credential) return reply({ ok: false, error: "PUBLISH_AUTH_REQUIRED" }, 401);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential)))).map(b => b.toString(16).padStart(2, "0")).join("");
      const owner = await env.MONITOR_DB.prepare("SELECT user_id FROM sensor_devices WHERE token_hash=?1 AND source_id=?2 AND active=1").bind(hash, SOURCE).first();
      if (!owner) return reply({ ok: false, error: "PUBLISH_AUTH_DENIED" }, 403);
      const p = await body(request, 512000);
      if (!["health", "weather"].includes(p.kind)) return reply({ ok: false, error: "KIND_DENIED" }, 400);
      const projected = p.kind === "health" ? projectHealth(p.data) : projectWeather(p.data);
      const observed = Date.parse(projected.generated_at);
      if (observed > Date.now() + 120000 || observed < Date.now() - 7 * 86400000) return reply({ ok: false, error: "SNAPSHOT_TIME_DENIED" }, 400);
      const result = await env.MONITOR_DB.prepare("INSERT INTO owner_monitor_snapshots(user_id,kind,payload,observed_ts,received_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(user_id,kind) DO UPDATE SET payload=excluded.payload,observed_ts=excluded.observed_ts,received_at=excluded.received_at WHERE excluded.observed_ts>owner_monitor_snapshots.observed_ts")
        .bind(owner.user_id, p.kind, JSON.stringify(projected), observed, Date.now()).run();
      return reply({ ok: true, data: { kind: p.kind, stored: result.meta.changes > 0, observed_at: projected.generated_at, output_control_allowed: false } });
    }
    const p = await body(request, 4096);
    if (typeof p.token !== "string" || p.token.length < 16 || p.token.length > 256) return reply({ ok: false, error: "OWNER_LOGIN_REQUIRED" }, 401);
    const owner = await env.MONITOR_DB.prepare("SELECT s.user_id FROM sessions s JOIN sensor_devices d ON d.user_id=s.user_id WHERE s.token=?1 AND s.expires_at>?2 AND d.source_id=?3 AND d.active=1 LIMIT 1").bind(p.token, Date.now(), SOURCE).first();
    if (!owner) return reply({ ok: false, error: "OWNER_LOGIN_REQUIRED" }, 403);
    const row = await env.MONITOR_DB.prepare("SELECT payload,received_at FROM owner_monitor_snapshots WHERE user_id=?1 AND kind='health'").bind(owner.user_id).first();
    if (!row) return reply({ ok: false, error: "NO_HEALTH_DATA" }, 404);
    const data = projectHealth(JSON.parse(row.payload));
    const hours = Number(p.hours) === 168 ? 168 : 24;
    for (const key of Object.keys(data.history)) data.history[key] = data.history[key].filter(r => r.observed_epoch * 1000 >= Date.now() - hours * 3600000);
    return reply({ ok: true, data: { ...data, received_at: new Date(row.received_at).toISOString(), hours } });
  } catch {
    return reply({ ok: false, error: "MONITOR_REQUEST_FAILED" }, 400);
  }
}
