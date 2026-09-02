/* FARMULTIMATE master farm map — local, DATA_ONLY, SAFE_OFF navigation surface. */
(function (root) {
  "use strict";

  const MAP_REVISION = "OWNER_LAYOUT_2026_09_01_C";
  const DEFAULT_SELECTION = "overview";

  const zones = Object.freeze([
    { id: "A", type: "field", points: "452,587 567,845 367,943 243,685", x: 405, y: 765 },
    { id: "B", type: "field", points: "333,311 447,577 238,675 117,409", x: 282, y: 493 },
    { id: "C", type: "field", points: "328,297 113,400 22,186 19,168 22,151 31,136 42,120 53,110 88,90 119,76 142,65 160,60 176,60 191,58 207,61 224,66 232,76", x: 173.5, y: 229 },
    { id: "D", type: "field", points: "699,91 679,261 322,224 342,62", x: 510.5, y: 161.5 },
    /* Owner correction: the former G location is now J. */
    { id: "J", type: "field", points: "993,115 971,289 699,263 722,89", x: 846, y: 189 },
    { id: "H-I", type: "field", points: "700,272 970,300 923,670 651,638", x: 810.5, y: 471 },
    /* Owner correction: the former J location is now G. */
    { id: "G", type: "field", points: "648,663 909,690 778,749 643,739", x: 776, y: 706 },
    { id: "E1", type: "automation", points: "458,329 560,341 553,422 448,409", x: 504, y: 375.5 },
    { id: "E2", type: "automation", points: "561,341 670,355 660,434 553,422", x: 611.5, y: 387.5 },
    { id: "E3", type: "automation", points: "678,270 568,259 561,342 669,355", x: 619.5, y: 307 },
    { id: "E4", type: "automation", points: "466,247 569,259 562,342 457,329", x: 513, y: 294.5 },
    /* Owner update: E5 is a compact strip that follows the usable ground beside E4/E1.
       The pond wall and staff accommodation remain outside the automation boundary. */
    { id: "E5", type: "automation compact-layout", points: "434,245 466,247 448,409 438,407 439,374 435,348 429,325 431,278", x: 447, y: 294 },
    { id: "pond", label: "สระ", ariaLabel: "สระน้ำหลัก", type: "pond", points: "349,249 424,254 419,325 407,350 379,343 365,318", x: 380, y: 286 }
  ]);

  const state = {
    selection: DEFAULT_SELECTION
  };

  function zoneById(id) {
    return zones.find(zone => zone.id === id) || null;
  }

  function normalizeSelection(id) {
    return id === DEFAULT_SELECTION || zoneById(id) ? id : DEFAULT_SELECTION;
  }

  function select(id) {
    state.selection = normalizeSelection(id);
  }

  function reset() {
    state.selection = DEFAULT_SELECTION;
  }

  function isMapSurface() {
    return state.selection !== "pond";
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
      <p>เลือกพื้นที่บนแผนที่เพื่อดูข้อมูลเฉพาะจุด สระน้ำเชื่อมข้อมูลระดับและปริมาตร ส่วน E1–E4 และ E5 ขนาดย่อเตรียมไว้สำหรับระบบให้น้ำอัตโนมัติผ่าน Pi 5</p>
    </div>
    <div class="farm-map-kpi-grid">
      <article><span>สระน้ำหลัก</span><strong>1</strong><small>${statusText(pond.status)}</small></article>
      <article><span>โซนอัตโนมัติ</span><strong>5</strong><small>E1–E5</small></article>
      <article><span>เอาต์พุตทำงาน</span><strong>0</strong><small>จาก 32 ช่อง</small></article>
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
      ? "ขอบเขต E5 ถูกย่อตามพื้นที่ใช้งานจริงข้างหัวแปลง E4/E1 โดยเว้นสระน้ำและพื้นที่พักพนักงานออกจากโซนให้น้ำอัตโนมัติ"
      : "โซนนี้อยู่ในขอบเขตระบบให้น้ำอัตโนมัติ E1–E5 แต่ยังไม่มีการจับคู่รีเลย์ วาล์ว หรือระยะเวลาเปิดจริง";
    return `<div class="farm-map-detail-copy">
      <span class="farm-map-eyebrow">AUTOMATION ZONE</span>
      <h2>แปลง ${zone.id}</h2>
      <div class="farm-map-state-chip">PRE-COMMISSIONING · SAFE_OFF</div>
      <p>${description}</p>
    </div>
    <dl class="farm-map-specs">
      <div><dt>ขอบเขตพื้นที่</dt><dd>${isCompactE5 ? "ย่อหลบที่พักพนักงาน" : "ตามผังแปลง"}</dd></div>
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
          <h1>ภาพรวมระบบชลประทาน</h1>
        </div>
        <div class="farm-map-safety"><b>DATA ONLY</b><strong>SAFE_OFF</strong></div>
      </header>

      <div class="farm-map-layout">
        <div class="farm-map-canvas-card">
          <div class="farm-map-canvas">
            <img src="images/farm-map/pixel-art-farm-master-v1.png" alt="ภาพแผนที่ฟาร์ม แสดงสระน้ำ แปลง A ถึง J และ E5 ขนาดย่อที่เว้นพื้นที่พักพนักงาน">
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
          <footer><span>ผังเจ้าของยืนยัน</span><b>${MAP_REVISION}</b></footer>
        </aside>
      </div>
    </section>`;
  }

  function cardHtml() {
    if (state.selection === "pond" && root.SensorTelemetry) {
      return root.SensorTelemetry.cardHtml({
        backAction: "App.farmMapBack()",
        backLabel: "← แผนที่ฟาร์ม"
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
