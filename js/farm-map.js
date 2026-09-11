/* FARMULTIMATE master farm map — local, DATA_ONLY, SAFE_OFF navigation surface. */
(function (root) {
  "use strict";

  const MAP_REVISION = "BOOKING_LAYOUT_2026_09_06";
  const DEFAULT_SELECTION = "overview";

  const zones = Object.freeze([
    {"id":"A","points":"454,584 571,845 366,945 243,685","x":407,"y":764.5,"type":"field"},
    {"id":"B","points":"335,306 451,577 238,675 117,409","x":284,"y":490.5,"type":"field"},
    {"id":"C","points":"332,300 114,402 22,186 21,168 22,151 29,137 42,118 59,104 87,89 117,75 142,65 163,58 181,57 198,57 217,62 228,67 232,75","x":176.5,"y":229.5,"type":"field"},
    {"id":"D","points":"699,91 679,261 318,222 335,61","x":508.5,"y":161,"type":"field"},
    {"id":"J","points":"723,88 992,114 971,295 700,267","x":846,"y":191.5,"type":"field"},
    {"id":"H-I","points":"699,270 971,298 925,672 650,641","x":810.5,"y":471,"type":"field"},
    {"id":"G","points":"925,672 922,688 778,749 644,741 650,641","x":784.5,"y":695,"type":"field"},
    {"id":"E1","points":"459,332 560,341 552,421 449,412","x":504.5,"y":376.5,"type":"automation"},
    {"id":"E2","points":"560,341 668,351 659,431 552,421","x":610,"y":386,"type":"automation"},
    {"id":"E3","points":"567,256 678,268 668,351 560,341","x":619,"y":303.5,"type":"automation"},
    {"id":"E4","points":"470,246 567,256 560,341 459,332","x":513,"y":293.5,"type":"automation"},
    {"id":"E5","points":"438,244 470,246 449,412 425,365","x":447.5,"y":328,"type":"automation compact-layout"},
    {"id":"pond","points":"333,237 432,247 420,351 386,353","x":382.5,"y":295,"type":"pond","label":"สระ","ariaLabel":"สระน้ำหลัก"}
  ]);

  const state = {
    selection: DEFAULT_SELECTION
  };

  function zoneById(id) {
    return zones.find(zone => zone.id === id) || null;
  }

  function normalizeSelection(id) {
    return [DEFAULT_SELECTION, "health", "forecast", "relays", "energy", "owner-summary"].includes(id) || zoneById(id) ? id : DEFAULT_SELECTION;
  }

  function select(id) {
    state.selection = normalizeSelection(id);
  }

  function reset() {
    state.selection = DEFAULT_SELECTION;
  }

  function isMapSurface() {
    return !["pond", "health", "forecast", "energy", "owner-summary"].includes(state.selection);
  }

  function sensorSummary() {
    const sensor = root.SensorTelemetry && root.SensorTelemetry.state;
    const current = sensor && sensor.current;
    const depth = current && Number.isFinite(Number(current.depth_m)) ? Number(current.depth_m) : null;
    const volume = current && Number.isFinite(Number(current.volume_m3)) ? Number(current.volume_m3) : null;
    return {
      depth,
      volume,
      status: sensor ? String(sensor.status || "NO_DATA") : "NO_DATA"
    };
  }

  function numberText(value, digits) {
    return value === null ? "—" : Number(value).toLocaleString("th-TH", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function statusText(value) {
    const key = String(value || "NO_DATA").toUpperCase();
    if (key === "GOOD") return "ข้อมูลปกติ";
    if (key === "STALE") return "ข้อมูลเก่า";
    if (key === "OUT_OF_RANGE") return "ค่านอกช่วง";
    return "รอข้อมูล";
  }

  function overviewPanelHtml() {
    const pond = sensorSummary();
    return `<div class="farm-map-detail-copy">
      <span class="farm-map-eyebrow">MASTER OVERVIEW</span>
      <h2>ภาพรวมฟาร์ม</h2>
      <p>เลือกพื้นที่บนแผนที่เพื่อดูข้อมูลเฉพาะจุด สระน้ำเชื่อมข้อมูลระดับและปริมาตร ส่วน E1–E5 เตรียมไว้สำหรับระบบให้น้ำอัตโนมัติผ่าน Pi 5</p>
    </div>
    <div class="farm-map-kpi-grid">
      <article><span>สระน้ำหลัก</span><strong>1</strong><small>${statusText(pond.status)}</small></article>
      <article><span>โซนอัตโนมัติ</span><strong>5</strong><small>E1–E5</small></article>
      <article><span>ช่องพร้อมสั่งงาน</span><strong>0</strong><small>ยังไม่ผูกอุปกรณ์</small></article>
    </div>
    <button class="farm-map-primary" type="button" onclick="App.farmMapSelect('pond')">เปิดข้อมูลสระน้ำ</button>
    <div class="farm-map-contract">
      <b>Pi 5 · SINGLE WRITER</b>
      <span>PoE Relay ยังไม่ผูกช่องจริง · Output disabled</span>
    </div>`;
  }

  function automationPanelHtml(zone) {
    const isCompactE5 = zone.id === "E5";
    const description = isCompactE5
      ? "ขอบเขต E5 อ้างอิงผัง Booking ล่าสุด อยู่เป็นแนวยาวระหว่างสระน้ำกับ E4/E1 ยังไม่ใช่ผลสำรวจภาคสนาม"
      : "โซนนี้อยู่ในขอบเขตระบบให้น้ำอัตโนมัติ E1–E5 แต่ยังไม่มีการจับคู่รีเลย์ วาล์ว หรือระยะเวลาเปิดจริง";
    return `<div class="farm-map-detail-copy">
      <span class="farm-map-eyebrow">AUTOMATION ZONE</span>
      <h2>แปลง ${zone.id}</h2>
      <div class="farm-map-state-chip">PRE-COMMISSIONING · SAFE_OFF</div>
      <p>${description}</p>
    </div>
    <dl class="farm-map-specs">
      <div><dt>ขอบเขตพื้นที่</dt><dd>${isCompactE5 ? "ตามผัง Booking ล่าสุด" : "ตามผังแปลง"}</dd></div>
      <div><dt>ผู้เขียนเอาต์พุต</dt><dd>Raspberry Pi 5</dd></div>
      <div><dt>PoE Relay channel</dt><dd>UNASSIGNED</dd></div>
      <div><dt>วาล์วภาคสนาม</dt><dd>รอยืนยัน</dd></div>
      <div><dt>คำสั่งอัตโนมัติ</dt><dd>ปิด</dd></div>
    </dl>
    <button class="farm-map-secondary" type="button" onclick="App.farmMapBack()">กลับภาพรวม</button>`;
  }

  function fieldPanelHtml(zone) {
    return `<div class="farm-map-detail-copy">
      <span class="farm-map-eyebrow">FIELD AREA</span>
      <h2>แปลง ${zone.id}</h2>
      <div class="farm-map-state-chip muted">ยังไม่เชื่อมระบบอัตโนมัติ</div>
      <p>พื้นที่นี้อยู่ใน Master Map แล้ว แต่ยังไม่มีการกำหนด telemetry หรือ output control ในเฟสปัจจุบัน</p>
    </div>
    <dl class="farm-map-specs">
      <div><dt>ข้อมูลแปลง</dt><dd>รอเชื่อม</dd></div>
      <div><dt>เซนเซอร์</dt><dd>ยังไม่กำหนด</dd></div>
      <div><dt>ระบบให้น้ำ</dt><dd>นอกเฟส E1–E5</dd></div>
      <div><dt>เอาต์พุต</dt><dd>ไม่มีการเขียน</dd></div>
    </dl>
    <button class="farm-map-secondary" type="button" onclick="App.farmMapBack()">กลับภาพรวม</button>`;
  }

  function selectedPanelHtml() {
    if (state.selection === DEFAULT_SELECTION) return overviewPanelHtml();
    const zone = zoneById(state.selection);
    if (!zone) return overviewPanelHtml();
    return zone.type.indexOf("automation") === 0 ? automationPanelHtml(zone) : fieldPanelHtml(zone);
  }

  function zoneMarkup(zone) {
    const selected = state.selection === zone.id ? " is-selected" : "";
    const label = zone.label || zone.id;
    const ariaLabel = zone.ariaLabel || label;
    const className = `farm-map-zone ${zone.type}${selected}`;
    return `<g class="${className}" role="button" tabindex="0" aria-label="เปิดข้อมูล ${ariaLabel}" data-zone-id="${zone.id}" onclick="App.farmMapSelect('${zone.id}')" onkeydown="App.farmMapKey(event,'${zone.id}')">
      <polygon points="${zone.points}"></polygon>
      <text x="${zone.x}" y="${zone.y}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${label}</text>
    </g>`;
  }

  function mapSurfaceHtml() {
    return `<section class="farm-master-map" aria-label="แผนที่หลักของระบบชลประทาน">
      <header class="farm-map-header">
        <button class="farm-map-home" type="button" onclick="App.nav('home')">← หน้าหลัก</button>
        <img src="images/digital-twin/fus-logo-white-v1.png" alt="FARMULTIMATE SOLUTIONS">
        <div>
          <span>FARM OPERATIONS · MASTER MAP</span>
          <h1>ภาพรวมระบบการจัดการ</h1>
        </div>
        <div class="farm-map-safety"><b>NO LOAD TEST</b><strong>FIELD SAFE_OFF</strong></div>
      </header>

      <div class="farm-map-layout">
        <div class="farm-map-canvas-card">
          <nav class="farm-map-page-links" aria-label="ข้อมูลฟาร์ม">
            <button type="button" onclick="App.farmMapSelect('owner-summary')" aria-label="สรุปสำหรับเจ้าของ">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M7 8h10M7 12h5M7 16h8"></path></svg>
              <span><strong>สรุปสำหรับเจ้าของ</strong><small>น้ำ · พลังงาน · สุขภาพระบบ</small></span><b aria-hidden="true">›</b>
            </button>
            <button type="button" onclick="App.farmMapSelect('forecast')" aria-label="สภาพอากาศ">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"></circle><path d="M8 1v2M1 8h2M3 3l1.5 1.5M13 3l-1.5 1.5M6 19h12a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A3.5 3.5 0 0 0 6 19Z"></path></svg>
              <span><strong>สภาพอากาศ</strong><small>พยากรณ์ 10 โมเดล</small></span><b aria-hidden="true">›</b>
            </button>
            <button type="button" onclick="App.farmMapSelect('health')" aria-label="สุขภาพระบบ">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M1 12h6l3-5 4 10 3-5h6"></path></svg>
              <span><strong>สุขภาพระบบ</strong><small>Pi 5 และ Pi Zero</small></span><b aria-hidden="true">›</b>
            </button>
            <button type="button" onclick="App.farmMapSelect('energy')" aria-label="พลังงานไฟฟ้า">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 9-13h-7z"></path></svg>
              <span><strong>พลังงานไฟฟ้า</strong><small>Acrel · มิเตอร์ 3 เฟส</small></span><b aria-hidden="true">›</b>
            </button>
            <button class="farm-map-relay-link" type="button" onclick="App.farmMapRelays()" aria-label="รีเลย์ / สวิตช์">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="6"></rect><circle cx="8" cy="12" r="3"></circle></svg>
              <span><strong>รีเลย์ / สวิตช์</strong><small>สถานะช่องและการควบคุม</small></span><b aria-hidden="true">↓</b>
            </button>
          </nav>
          <div class="farm-map-canvas">
            <img src="images/farm-map/pixel-art-farm-master-v1.png" alt="ผังฟาร์มล่าสุดจาก Booking แสดงสระน้ำ แปลง A B C D G H-I J และ E1–E5">
            <svg class="farm-map-overlay" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" aria-label="พื้นที่ที่เลือกได้บนแผนที่">
              ${zones.map(zoneMarkup).join("")}
            </svg>
          </div>
          <div class="farm-map-legend" aria-label="คำอธิบายสถานะแผนที่">
            <span><i class="pond"></i>สระน้ำและเซนเซอร์</span>
            <span><i class="automation"></i>E1–E5 ระบบอัตโนมัติ</span>
            <span><i class="field"></i>พื้นที่ทั้งหมดของโครงการ</span>
          </div>
        </div>

        <aside class="farm-map-detail" aria-live="polite">
          ${selectedPanelHtml()}
          <footer><a href="https://kapcrop.co.th/booking" target="_blank" rel="noopener noreferrer">อ้างอิงผัง Booking · 6 ก.ย. 2569</a><span>ขอบเขตบนภาพ · ยังไม่ใช่ผลสำรวจ</span></footer>
        </aside>
      </div>
      ${root.RelayPanel ? root.RelayPanel.cardHtml() : ""}
    </section>`;
  }

  function cardHtml() {
    if (state.selection === "owner-summary" && root.OwnerSummary) return root.OwnerSummary.cardHtml();
    if (state.selection === "energy" && root.EnergyDashboard) return root.EnergyDashboard.cardHtml();
    if (["health", "forecast"].includes(state.selection) && root.SensorTelemetry) return root.SensorTelemetry.monitorHtml(state.selection);
    if (state.selection === "pond" && root.SensorTelemetry) {
      return root.SensorTelemetry.cardHtml({
        backAction: "App.farmMapBack()",
        backLabel: "← แผนที่ฟาร์ม",
        separateMonitorPages: true
      });
    }
    return mapSurfaceHtml();
  }

  root.FarmMapDashboard = {
    MAP_REVISION,
    zones,
    state,
    zoneById,
    select,
    reset,
    isMapSurface,
    cardHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
