/* Shared, side-effect-free safety helpers for the Worker and local tests. */
const SENSOR_SCHEMA = "flytech.water-level.telemetry.v1";
const SENSOR_QUALITIES = new Set(["GOOD", "DISCONNECTED", "OUT_OF_RANGE", "SENSOR_FAULT"]);
const SOURCE_ID_RE = /^[A-Za-z0-9._:-]{3,96}$/;

function allowedOrigins(env) {
  const configured = String(env && env.ALLOWED_ORIGINS || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  return new Set(configured.length ? configured : [
    "http://127.0.0.1:4173",
    "http://localhost:4173"
  ]);
}

function cors(request, env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
  const origin = request && request.headers ? String(request.headers.get("Origin") || "") : "";
  if (origin && allowedOrigins(env).has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function sanitizeAppState(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("รูปแบบข้อมูลแอปไม่ถูกต้อง");
  const safe = { ...parsed };
  delete safe.adminPass;
  return safe;
}

function outputControlEnabled(env) {
  return String(env && env.OUTPUT_CONTROL_ENABLED || "").trim().toLowerCase() === "true";
}

function cleanText(value, max = 120) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function optionalFinite(value, name, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error("ค่า " + name + " ไม่ถูกต้อง");
  return number;
}

function normalizeTelemetrySample(raw, expectedSourceId, now = Date.now()) {
  const payload = raw && typeof raw === "object" ? raw : {};
  if (payload.schema !== SENSOR_SCHEMA) throw new Error("schema ของเซนเซอร์ไม่ถูกต้อง");
  const sourceId = cleanText(payload.source_id, 96);
  if (!SOURCE_ID_RE.test(sourceId) || sourceId !== expectedSourceId) throw new Error("source_id ไม่ตรงกับอุปกรณ์");
  if (payload.output_control_allowed !== false) throw new Error("telemetry ต้องประกาศ output_control_allowed=false");
  const observedRaw = cleanText(payload.observed_at, 48);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(observedRaw)) throw new Error("observed_at ต้องมี timezone");
  const observedTs = Date.parse(observedRaw);
  if (!Number.isFinite(observedTs)) throw new Error("observed_at ไม่ถูกต้อง");
  if (observedTs > now + 5 * 60000) throw new Error("เวลาเซนเซอร์อยู่ในอนาคตเกินกำหนด");
  if (observedTs < now - 45 * 86400000) throw new Error("ข้อมูลเซนเซอร์เก่าเกิน 45 วัน");
  const quality = cleanText(payload.quality, 24).toUpperCase();
  if (!SENSOR_QUALITIES.has(quality)) throw new Error("quality ไม่ถูกต้อง");
  const staleAfterS = Number(payload.stale_after_s == null ? 180 : payload.stale_after_s);
  if (!Number.isFinite(staleAfterS) || staleAfterS < 60 || staleAfterS > 3600) throw new Error("stale_after_s ไม่ถูกต้อง");
  const depthM = optionalFinite(payload.depth_m, "depth_m", 0, 4.3);
  const volumeM3 = optionalFinite(payload.volume_m3, "volume_m3", 0, 1000);
  const capacityPercent = optionalFinite(payload.capacity_percent, "capacity_percent", 0, 100);
  if (quality === "GOOD" && (depthM === null || volumeM3 === null || capacityPercent === null)) {
    throw new Error("ข้อมูล GOOD ต้องมี depth_m, volume_m3 และ capacity_percent");
  }
  if (quality !== "GOOD" && (depthM !== null || volumeM3 !== null || capacityPercent !== null)) {
    throw new Error("ข้อมูลที่ไม่ใช่ GOOD ต้องไม่มีค่าระดับ/ปริมาตร");
  }
  return {
    schema: SENSOR_SCHEMA,
    source_id: sourceId,
    observed_at: new Date(observedTs).toISOString(),
    observed_ts: observedTs,
    quality,
    voltage_v: optionalFinite(payload.voltage_v, "voltage_v", 0, 10),
    current_ma: optionalFinite(payload.current_ma, "current_ma", 0, 30),
    depth_m: depthM,
    staff_gauge_m: optionalFinite(payload.staff_gauge_m, "staff_gauge_m", -1, 4.3),
    volume_m3: volumeM3,
    capacity_percent: capacityPercent,
    stale_after_s: Math.round(staleAfterS),
    calibration_id: cleanText(payload.calibration_id || "UNKNOWN", 120),
    volume_model_id: cleanText(payload.volume_model_id || "UNKNOWN", 120),
    sample_count: Math.min(1_000_000_000, Math.max(0, Math.round(Number(payload.sample_count) || 0))),
    output_control_allowed: false
  };
}

export {
  SENSOR_SCHEMA,
  SOURCE_ID_RE,
  allowedOrigins,
  cleanText,
  cors,
  normalizeTelemetrySample,
  outputControlEnabled,
  sanitizeAppState
};
