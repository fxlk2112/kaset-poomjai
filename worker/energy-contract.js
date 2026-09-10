// Optional owner-private energy telemetry. No raw identity, free text or control capability.
const roles = ["SYSTEM_TOTAL_FEEDER", "FILL_PUMP", "OUTFLOW_PUMP", "UNASSIGNED"];
const limits = {
  voltage_l1_v: [0,600], voltage_l2_v: [0,600], voltage_l3_v: [0,600],
  current_l1_a: [0,10000], current_l2_a: [0,10000], current_l3_a: [0,10000],
  active_power_total_kw: [0,10000], import_energy_total_kwh: [0,1e12],
  power_factor_total: [0,1], frequency_hz: [45,65]
};
const numeric = (v, [min,max]) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
const observationLimits = {...limits, active_power_total_kw:[-10000,10000], power_factor_total:[-1,1]};
function sample(row, now) {
  if (!row || row.output_control_allowed !== false || row.modbus_write_allowed !== false) throw Error("ENERGY_SAFE_ONLY");
  const time = typeof row.observed_at === "string" ? Date.parse(row.observed_at) : NaN;
  if (!Number.isFinite(time) || time > now + 120000) throw Error("ENERGY_TIME");
  const verified = ["ct_ratio_verified", "direction_verified", "display_comparison_verified"].every(k => row[k] === true);
  const out = {observed_at: new Date(time).toISOString(), output_control_allowed: false, modbus_write_allowed: false,
    ct_ratio_verified: row.ct_ratio_verified === true, direction_verified: row.direction_verified === true,
    display_comparison_verified: row.display_comparison_verified === true,
    stale_after_s: numeric(row.stale_after_s, [60,3600]) ?? 180};
  out.quality = !verified ? "UNVERIFIED" : ["GOOD","STALE","OUT_OF_RANGE","DISCONNECTED","SENSOR_FAULT"].includes(row.quality) ? row.quality : "SENSOR_FAULT";
  if (row.observation_only === true) {
    if (!["ct_ratio_verified","direction_verified","display_comparison_verified"].every(k=>row[k]===false) || !["UNVERIFIED","SENSOR_FAULT"].includes(row.quality)) throw Error("OBSERVATION_UNCOMMISSIONED_ONLY");
    out.observation_only = true;
    out.quality = row.quality;
    out.observation = null;
    if (row.quality === "UNVERIFIED" && row.observation && typeof row.observation === "object") {
      const values = Object.fromEntries(Object.entries(observationLimits).map(([key,range])=>[key,numeric(row.observation[key],range)]));
      if (Object.values(values).every(v=>v!==null)) out.observation=values;
      else out.quality="SENSOR_FAULT";
    } else if (row.quality === "UNVERIFIED") out.quality="SENSOR_FAULT";
  }
  for (const [key,range] of Object.entries(limits)) out[key] = out.quality === "GOOD" ? numeric(row[key],range) : null;
  if (out.quality === "GOOD" && Object.keys(limits).some(k => out[k] === null)) {
    out.quality = "SENSOR_FAULT";
    for (const k of Object.keys(limits)) out[k] = null;
  }
  return out;
}
export function projectEnergy(p, now = Date.now()) {
  const empty = {schema:"farmultimate.energy.v1", status:"UNAVAILABLE", generated_at:null, sources:[], output_control_allowed:false, modbus_write_allowed:false};
  if (!p) return empty;
  try {
    if (p.output_control_allowed !== false || p.modbus_write_allowed !== false) throw Error("ENERGY_SAFE_ONLY");
    const generated = Date.parse(p.generated_at);
    if (!Number.isFinite(generated) || generated > now + 120000 || !Array.isArray(p.sources) || p.sources.length > 3) throw Error("ENERGY_SNAPSHOT");
    const seen = new Set();
    const sources = p.sources.map(source => {
      if (!roles.includes(source.circuit_role) || !new RegExp("^"+source.circuit_role+"_[A-Z0-9_-]{1,48}$").test(source.id) || seen.has(source.id)) throw Error("ENERGY_SOURCE");
      seen.add(source.id);
      if (!/^ADL400N-CT\/[A-Za-z0-9/-]{1,40}$/.test(source.meter_model) || source.register_map_id !== "ACREL_ADL400N_CT_EXTERNAL_CT_MANUAL_V1_5_FAST_READ_V1") throw Error("ENERGY_MODEL");
      const current = source.current ? sample(source.current,now) : null;
      if (source.circuit_role === "UNASSIGNED" && (source.id !== "UNASSIGNED_METER_01" || current?.observation_only !== true)) throw Error("OBSERVATION_SOURCE");
      if (!Array.isArray(source.history) || source.history.length > 300) throw Error("ENERGY_HISTORY");
      const unique = new Map(source.history.map(r => {const s=sample(r,now); return [s.observed_at,s];}));
      const history = [...unique.values()].filter(r => Date.parse(r.observed_at) >= now - 86400000).sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
      const status = !current ? "NO_DATA" : now - Date.parse(current.observed_at) > current.stale_after_s * 1000 ? "STALE" : current.quality;
      return {id:source.id, circuit_role:source.circuit_role, meter_model:source.meter_model, register_map_id:source.register_map_id, status,current,history};
    });
    return {...empty, generated_at:new Date(generated).toISOString(), sources,
      status: now - generated > 180000 ? "STALE" : sources.length ? "AVAILABLE" : p.status === "INGEST_NOT_READY" ? "INGEST_NOT_READY" : p.status === "UNAVAILABLE" ? "UNAVAILABLE" : "NO_METER_DATA"};
  } catch { return empty; } // Invalid energy must not take Pi health offline.
}
