import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../sensors.js", import.meta.url), "utf8");
const safeHealth = { ok: true, data: { mode: "SENSOR_PHASE1_READ_ONLY", output_control_allowed: false } };
const reading = { observed_at: "2026-09-06T01:00:00Z", observed_ts: 1788656400000, depth_m: 1.23, volume_m3: 230, capacity_percent: 28.75, current_ma: 8.7 };
function currentResponse() {
  return { ok: true, data: { output_control_allowed: false, status: "GOOD", age_s: 15, current: reading } };
}
function harness({ session = null, handler, fastDeadline = false } = {}) {
  const calls = [], forecasts = [];
  const context = vm.createContext({
    URL, URLSearchParams, AbortSignal,
    setTimeout: (fn, ms) => setTimeout(fn, fastDeadline ? 10 : ms), clearTimeout,
    FarmUltimateRuntime: { isOwnerCanary: true },
    Auth: { session },
    authCall: async (action, extra) => {
      calls.push({ action, extra });
      if (handler) return handler(action, extra);
      if (action === "health") return safeHealth;
      if (action === "sensor_current") return currentResponse();
      return { ok: true, data: { output_control_allowed: false, rows: [reading] } };
    },
    fetch: async url => { forecasts.push(String(url)); return { ok: false }; }
  });
  vm.runInContext(source, context);
  return { context, sensors: context.SensorTelemetry, calls, forecasts };
}
const owner = { token: "test-owner-session", email: "owner@example.invalid" };

test("signed-out sensors finish public health and forecast checks without private API calls or a render loop", async () => {
  const h = harness();
  h.context.route = { view: "iot" };
  let renders = 0;
  h.context.render = () => { renders++; h.sensors.refresh(false); };
  await h.sensors.refresh(true);
  assert.equal(h.sensors.state.backendStatus, "ONLINE_SAFE_OFF");
  assert.equal(h.sensors.state.accessStatus, "SIGNED_OUT");
  assert.equal(h.sensors.state.loading, false);
  assert.deepEqual(h.calls.map(c => c.action), ["health"]);
  assert.equal(h.forecasts.length, 1);
  assert.ok(renders <= 3);
  const html = h.sensors.cardHtml();
  assert.match(html, /เว็บเชื่อมต่อแล้ว/);
  assert.match(html, /App.openSensorLogin/);
  assert.doesNotMatch(html, /LIVE ·|กำลังตรวจการเชื่อมต่อ/);
});

test("owner login reads current and history and logout immediately clears both", async () => {
  const h = harness();
  await h.sensors.refresh(true);
  h.context.Auth.session = owner;
  await h.sensors.refresh(false);
  assert.equal(h.sensors.state.current.depth_m, 1.23);
  assert.equal(h.sensors.state.history.length, 1);
  assert.equal(h.sensors.state.accessStatus, "AUTHENTICATED");
  assert.match(h.sensors.cardHtml(), /LIVE ·/);
  h.sensors.state.piHealth.relays = { output_control_allowed: false, modules: [{ id: "RELAY_A" }] };
  h.context.Auth.session = null;
  h.sensors.syncSession();
  assert.equal(h.sensors.state.piHealth.relays, null);
  assert.equal(h.sensors.state.current, null);
  assert.equal(h.sensors.state.history.length, 0);
  assert.doesNotMatch(h.sensors.cardHtml(), /LIVE ·|1\.230/);
});

test("expired sessions clear readings and show a sign-in path, even when only history rejects the session", async () => {
  const h = harness({ session: owner, handler: action => action === "health" ? safeHealth
    : action === "sensor_current" ? currentResponse()
    : { ok: false, error: "เซสชันหมดอายุ กรุณาล็อกอินใหม่" } });
  await h.sensors.refresh(true);
  assert.equal(h.sensors.state.accessStatus, "SESSION_EXPIRED");
  assert.equal(h.sensors.state.current, null);
  assert.equal(h.sensors.state.history.length, 0);
  assert.match(h.sensors.cardHtml(), /เข้าสู่ระบบอีกครั้ง/);
});

test("missing source explains account linkage without inventing a sensor value", async () => {
  const h = harness({ session: owner, handler: action => action === "health" ? safeHealth
    : { ok: false, error: "ไม่พบแหล่งข้อมูลเซนเซอร์นี้" } });
  await h.sensors.refresh(true);
  assert.equal(h.sensors.state.accessStatus, "SOURCE_UNAVAILABLE");
  assert.equal(h.sensors.state.current, null);
  assert.match(h.sensors.cardHtml(), /บัญชีนี้ยังไม่ได้เชื่อม/);
});

test("history failure preserves a successful current reading and exposes the history error", async () => {
  const h = harness({ session: owner, handler: action => action === "health" ? safeHealth
    : action === "sensor_current" ? currentResponse() : Promise.reject(new Error("offline")) });
  await h.sensors.refresh(true);
  assert.equal(h.sensors.state.current.depth_m, 1.23);
  assert.equal(h.sensors.state.error, "");
  assert.match(h.sensors.state.historyError, /โหลดประวัติไม่สำเร็จ/);
  assert.match(h.sensors.cardHtml(), /24 ชั่วโมง|7 วัน/);
});

test("unsafe backend stops all private reads and clears any prior sensor data", async () => {
  const h = harness({ session: owner, handler: () => ({ ok: true, data: { mode: "SENSOR_PHASE1_READ_ONLY", output_control_allowed: true } }) });
  await h.sensors.refresh(true);
  assert.deepEqual(h.calls.map(c => c.action), ["health"]);
  assert.equal(h.sensors.state.backendStatus, "ERROR");
  assert.equal(h.sensors.state.current, null);
  assert.equal(h.sensors.state.loading, false);
  assert.match(h.sensors.state.error, /อ่านอย่างเดียว/);
});

test("a late response cannot repopulate telemetry after account switch", async () => {
  let resolveOld, started;
  const pending = new Promise(resolve => { resolveOld = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  const h = harness({ session: owner, handler: (action, extra) => {
    if (action === "health") return safeHealth;
    if (extra.token !== owner.token) return { ok: false, error: "ไม่พบแหล่งข้อมูลเซนเซอร์นี้" };
    started();
    return pending;
  } });
  const first = h.sensors.refresh(true);
  await requested;
  h.context.Auth.session = { token: "test-other-owner", email: "other@example.invalid" };
  h.sensors.syncSession();
  await h.sensors.refresh(true);
  resolveOld(currentResponse());
  await first;
  assert.equal(h.sensors.state.accessStatus, "SOURCE_UNAVAILABLE");
  assert.equal(h.sensors.state.current, null);
  assert.equal(h.sensors.state.history.length, 0);
  assert.equal(h.sensors.state.loading, false);
});

test("a stalled health request times out with an actionable retry state", async () => {
  const h = harness({ fastDeadline: true, handler: () => new Promise(() => {}) });
  await h.sensors.refresh(true);
  assert.equal(h.sensors.state.loading, false);
  assert.equal(h.sensors.state.backendStatus, "ERROR");
  assert.match(h.sensors.cardHtml(), /ลองใหม่/);
  assert.deepEqual(h.calls.map(c => c.action), ["health"]);
});

test("no-data and stale responses are distinct from live readings", async () => {
  let empty = true;
  const h = harness({ session: owner, handler: action => action === "health" ? safeHealth
    : action === "sensor_current" ? { ok: true, data: { output_control_allowed: false, status: empty ? "NO_DATA" : "STALE", age_s: 3600, current: empty ? null : reading } }
      : { ok: true, data: { output_control_allowed: false, rows: [] } } });
  await h.sensors.refresh(true);
  assert.match(h.sensors.cardHtml(), /ยังไม่มีข้อมูลจากเซ็นเซอร์/);
  empty = false;
  await h.sensors.refresh(true);
  assert.equal(h.sensors.state.current.depth_m, 1.23);
  assert.doesNotMatch(h.sensors.cardHtml(), /LIVE ·/);
});

test("expired forecast snapshots do not appear as upcoming rain or next-hour readings", async () => {
  const h = harness();
  const snapshot = JSON.parse(await readFile(new URL("../../data/weather-models.json", import.meta.url), "utf8"));
  h.sensors.state.weatherModels.data = h.sensors.normalizeWeatherModelsSnapshot(snapshot);
  const afterExpiry = Date.parse(snapshot.freshness.last_valid_at) + 3600000;
  const html = h.sensors.weatherModelsHtml(afterExpiry);
  assert.match(html, /พยากรณ์หมดอายุ/);
  assert.doesNotMatch(html, /อุณหภูมิชั่วโมงถัดไป|digital-weather-model-kpis|digital-rain-window-main/);
});
