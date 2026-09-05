import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../farm-map.js");

const MapDashboard = globalThis.FarmMapDashboard;
const styleSource = readFileSync(new URL("../../css/style.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("master map contains every owner-confirmed area and five automation zones", () => {
  assert.ok(MapDashboard);
  assert.deepEqual(
    MapDashboard.zones.filter(zone => zone.type.startsWith("automation")).map(zone => zone.id),
    ["E1", "E2", "E3", "E4", "E5"]
  );
  assert.deepEqual(
    MapDashboard.zones.map(zone => zone.id),
    ["A", "B", "C", "D", "J", "H-I", "G", "E1", "E2", "E3", "E4", "E5", "pond"]
  );
});

test("E5 follows the compact usable strip and excludes staff accommodation", () => {
  const e5 = MapDashboard.zoneById("E5");
  assert.equal(e5.points, "434,245 466,247 448,409 438,407 439,374 435,348 429,325 431,278");
  assert.match(e5.type, /compact-layout/);
  assert.equal(e5.x, 447);
  assert.equal(e5.y, 294);
});

test("G and J use their corrected physical locations", () => {
  assert.equal(MapDashboard.zoneById("J").points, "993,115 971,289 699,263 722,89");
  assert.equal(MapDashboard.zoneById("G").points, "648,663 909,690 778,749 643,739");
});

test("map surface is interactive but contains no actuator command", () => {
  MapDashboard.reset();
  const html = MapDashboard.cardHtml();
  assert.match(html, /pixel-art-farm-master-v1\.png/);
  assert.match(html, /DATA ONLY/);
  assert.match(html, /SAFE_OFF/);
  assert.match(html, /App\.farmMapSelect\('pond'\)/);
  assert.match(html, /role="button" tabindex="0"/);
  assert.doesNotMatch(html, /เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/);
});

test("automation zone details remain unassigned and safe off", () => {
  MapDashboard.select("E5");
  const html = MapDashboard.cardHtml();
  assert.match(html, /แปลง E5/);
  assert.match(html, /PRE-COMMISSIONING · SAFE_OFF/);
  assert.match(html, /UNASSIGNED/);
  assert.match(html, /ย่อหลบที่พักพนักงาน/);
  assert.match(html, /เว้นสระน้ำและพื้นที่พักพนักงาน/);
  assert.match(html, /คำสั่งอัตโนมัติ<\/dt><dd>ปิด/);
  MapDashboard.reset();
});

test("pond selection hands off to the existing telemetry screen with a map back action", () => {
  let receivedOptions = null;
  globalThis.SensorTelemetry = {
    cardHtml(options) {
      receivedOptions = options;
      return "<section>pond telemetry</section>";
    }
  };
  MapDashboard.select("pond");
  assert.equal(MapDashboard.cardHtml(), "<section>pond telemetry</section>");
  assert.equal(receivedOptions.backAction, "App.farmMapBack()");
  assert.equal(receivedOptions.backLabel, "← แผนที่ฟาร์ม");
  delete globalThis.SensorTelemetry;
  MapDashboard.reset();
});

test("application and stylesheet wire the master map into the existing IoT route", () => {
  assert.match(appSource, /FarmMapDashboard\.cardHtml\(\)/);
  assert.match(appSource, /App\.farmMapSelect/);
  assert.match(appSource, /view-iot-farm-map/);
  assert.match(styleSource, /\.farm-master-map\s*\{/);
  assert.match(styleSource, /\.farm-map-overlay\s*\{/);
});
