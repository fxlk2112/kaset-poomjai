export const SOURCES = ["PI5_CONTROLLER_01", "PI_ZERO_GATEWAY_01"];
const safety = { output_control_allowed: false, safety: { mode: "DATA_ONLY", control_contract: "SAFE_OFF" } };
const number = v => v === null || v === undefined || v === "" ? null : typeof v === "number" && Number.isFinite(v) ? v : null;
const date = v => {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error("INVALID_TIMESTAMP");
  return new Date(v).toISOString();
};
function safe(p) {
  if (!p || p.output_control_allowed !== false) throw new Error("SAFE_OFF_REQUIRED");
}
function metrics(row) {
  const out = { observed_at: date(row.observed_at), quality: ["GOOD", "DEGRADED", "SENSOR_FAULT"].includes(row.quality) ? row.quality : "DEGRADED" };
  out.observed_epoch = Date.parse(out.observed_at) / 1000;
  for (const key of ["temp_c", "load1", "load5", "load15", "uptime_s", "cpu_count"]) out[key] = number(row[key]);
  if (out.temp_c === null || out.load1 === null) out.quality = "DEGRADED";
  return out;
}
// Relay data is observational only. A good readback never grants control.
export function projectRelays(p, now = Date.now()) {
  const empty = { observed_at: null, status: "NO_DATA", modules: [], output_control_allowed: false };
  try {
    if (!p || p.output_control_allowed !== false || !Array.isArray(p.modules) || p.modules.length > 2) return empty;
    const observed_at = date(p.observed_at), age = now - Date.parse(observed_at);
    if (age < -120000) return empty;
    const seen = new Set();
    const bits = rows => Array.from({ length: 8 }, (_, i) => Array.isArray(rows) && rows.length === 8 && typeof rows[i] === "boolean" ? rows[i] : null);
    const modules = p.modules.map(m => {
      if (!m || !["RELAY_A", "RELAY_B"].includes(m.id) || seen.has(m.id)) throw new Error("INVALID_RELAY");
      seen.add(m.id);
      const valid = m.online === true && m.identity_verified === true && m.crc_valid === true;
      return { id: m.id, online: m.online === true, identity_verified: m.identity_verified === true, crc_valid: m.crc_valid === true,
        status: age > 180000 ? "STALE" : !valid ? "UNVERIFIED" : "GOOD",
        relay_status: bits(valid ? m.relay_status : null), digital_inputs: bits(valid ? m.digital_inputs : null) };
    });
    return { observed_at, status: !modules.length ? "NO_DATA" : age > 180000 ? "STALE" : modules.every(m => m.status === "GOOD") ? "GOOD" : "DEGRADED", modules, output_control_allowed: false };
  } catch { return empty; }
}
export function projectHealth(p, now = Date.now()) {
  safe(p);
  const out = { ...safety, generated_at: date(p.generated_at), sources: {}, history: {}, relays: projectRelays(p.relays, now) };
  for (const id of SOURCES) {
    const source = p.sources?.[id];
    const current = source?.current ? metrics(source.current) : null;
    if (current && current.observed_epoch * 1000 > now + 120000) throw new Error("FUTURE_SAMPLE");
    const age = current ? Math.max(0, now / 1000 - current.observed_epoch) : null;
    if (current) current.age_s = Math.round(age);
    out.sources[id] = { status: !current ? "NO_DATA" : age > 180 ? "STALE" : current.quality, current, samples_24h: number(source?.samples_24h) };
    const rows = p.history?.[id] || [];
    if (!Array.isArray(rows) || rows.length > 700) throw new Error("HISTORY_LIMIT");
    out.history[id] = rows.map(metrics).filter(row => row.observed_epoch * 1000 <= now + 120000 && row.observed_epoch * 1000 >= now - 7 * 86400000).sort((a,b) => a.observed_epoch - b.observed_epoch);
  }
  return out;
}
const modelNames = {
  ecmwf_ifs025: ["ECMWF IFS", "ยุโรป"], ecmwf_aifs025_single: ["ECMWF AIFS", "ยุโรป · AI"],
  gfs_seamless: ["GFS", "สหรัฐอเมริกา"], icon_seamless: ["ICON", "เยอรมนี"], gem_seamless: ["GEM", "แคนาดา"],
  jma_seamless: ["JMA", "ญี่ปุ่น"], meteofrance_arpege_world: ["ARPEGE", "ฝรั่งเศส"], ukmo_global_deterministic_10km: ["UKMO", "สหราชอาณาจักร"],
  cma_grapes_global: ["CMA GRAPES", "จีน"], ncep_aigfs025: ["AIGFS", "สหรัฐอเมริกา · AI"]
};
const stats = p => Object.fromEntries(["median", "min", "max", "models"].map(k => [k, number(p?.[k])]));
export function projectWeather(p) {
  safe(p);
  if (p.forecast_only !== true || p.station_truth_available !== false || p.safety?.mode !== "DATA_ONLY" || p.safety?.control_contract !== "SAFE_OFF" || !Array.isArray(p.models) || !p.models.length || p.models.length > 12) throw new Error("FORECAST_ONLY_REQUIRED");
  const out = { ...safety, schema: "sucha.weather-model-dashboard.v1", generated_at: date(p.generated_at), status: "READY_FORECAST_ONLY", forecast_only: true, station_truth_available: false, freshness: {}, consensus: {}, models: [], rain_windows: [] };
  for (const key of ["latest_issued_at", "first_valid_at", "last_valid_at"]) out.freshness[key] = date(p.freshness?.[key]);
  out.freshness.models = p.models.length;
  for (const key of ["rain_24h_mm", "next_hour_temperature_c", "next_hour_wind_kmh"]) out.consensus[key] = stats(p.consensus?.[key]);
  for (const key of ["wet_model_count", "rain_model_count"]) out.consensus[key] = number(p.consensus?.[key]);
  out.models = p.models.map(m => {
    if (!modelNames[m.id]) throw new Error("UNKNOWN_FORECAST_MODEL");
    const next = { valid_at: date(m.next_hour?.valid_at) };
    for (const key of ["temperature_c", "humidity_percent", "rain_mm", "wind_kmh"]) next[key] = number(m.next_hour?.[key]);
    const model = { id: m.id, name: modelNames[m.id][0], region: modelNames[m.id][1], issued_at: date(m.issued_at), next_hour: next };
    for (const key of ["hours", "rain_24h_mm", "rain_probability_max_percent", "temperature_mean_c"]) model[key] = number(m[key]);
    return model;
  });
  if (new Set(out.models.map(m=>m.id)).size !== out.models.length) throw new Error("DUPLICATE_MODEL");
  if (!Array.isArray(p.rain_windows) || p.rain_windows.length > 30) throw new Error("RAIN_WINDOW_LIMIT");
  out.rain_windows = p.rain_windows.map(w => ({ start_at: date(w.start_at), end_at_exclusive: date(w.end_at_exclusive), hours: number(w.hours), trigger: "AT_LEAST_2_MODELS_WITH_0P2_MM_PER_HOUR", agreement: { wet_models: number(w.agreement?.wet_models), rain_models: number(w.agreement?.rain_models), peak_wet_models: number(w.agreement?.peak_wet_models) }, rain_total_mm: { all_models: stats(w.rain_total_mm?.all_models), wet_models_only: stats(w.rain_total_mm?.wet_models_only) } }));
  return out;
}
