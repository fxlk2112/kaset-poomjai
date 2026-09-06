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

test("all map polygons and label centers match the captured Booking reference", () => {
  const reference = JSON.parse(readFileSync(new URL("../../qa/map-relay/booking-reference.json", import.meta.url), "utf8"));
  for (const source of reference.zones) {
    const zone = MapDashboard.zoneById(source.id);
    assert.equal(zone.points, source.points);
    assert.equal(zone.x, source.x);
    assert.equal(zone.y, source.y);
  }
});

test("G and J use their corrected physical locations", () => {
  assert.equal(MapDashboard.zoneById("J").points, "723,88 992,114 971,295 700,267");
  assert.equal(MapDashboard.zoneById("G").points, "925,672 922,688 778,749 644,741 650,641");
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
  assert.match(html, /ตามผัง Booking ล่าสุด/);
  assert.match(html, /ยังไม่ใช่ผลสำรวจภาคสนาม/);
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
