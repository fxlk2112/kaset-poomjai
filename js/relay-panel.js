/* Real readback only. No command endpoint, queue, local override or demo output. */
(function (root) {
  "use strict";
  const MODULES = ["RELAY_A", "RELAY_B"];
  function viewModel(payload, now = Date.now()) {
    const safe = payload && payload.output_control_allowed === false;
    const time = safe && typeof payload.observed_at === "string" ? Date.parse(payload.observed_at) : NaN;
    const fresh = Number.isFinite(time) && time <= now + 120000 && now - time <= 180000;
    const rows = safe && Array.isArray(payload.modules) ? payload.modules : [];
    return {
      observedAt: Number.isFinite(time) ? new Date(time).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false }) : "ยังไม่มีข้อมูล",
      modules: MODULES.map((id, index) => {
        const matches = rows.filter(m => m && m.id === id);
        const m = matches.length === 1 ? matches[0] : null;
        const trusted = fresh && m && m.online === true && m.identity_verified === true && m.crc_valid === true;
        const bits = key => Array.from({ length: 8 }, (_, i) => trusted && Array.isArray(m[key]) && m[key].length === 8 && typeof m[key][i] === "boolean" ? m[key][i] : null);
        return { id, name: "รีเลย์ " + (index + 1), label: index === 0 ? "A" : "B", status: !m ? "รอข้อมูล" : !fresh ? "ข้อมูลเก่า / ไม่ยืนยัน" : !trusted ? "อ่านค่าไม่สำเร็จ" : "เชื่อมต่อแล้ว", relays: bits("relay_status"), inputs: bits("digital_inputs") };
      })
    };
  }
  function moduleHtml(m) {
    return `<article class="relay-module">
      <header><div><span>MODULE ${m.label} · 8 CHANNELS</span><h3>${m.name}</h3></div><b>${m.status}</b></header>
      <div class="relay-channels">${m.relays.map((value, i) => `<div class="relay-channel">
        <div><strong>CH ${i + 1}</strong><small>ยังไม่ระบุอุปกรณ์</small></div>
        <span class="relay-reading ${value === true ? "is-on" : value === false ? "is-off" : "is-unknown"}">${value === true ? "ON" : value === false ? "OFF" : "ไม่ยืนยัน"}</span>
        <div class="relay-actions" role="group" aria-label="สวิตช์ ${m.name} CH ${i + 1}">
          <button type="button" disabled aria-describedby="relay-control-blocker" aria-label="เปิด ${m.name} CH ${i + 1}">เปิด</button>
          <button type="button" disabled aria-describedby="relay-control-blocker" aria-label="ปิด ${m.name} CH ${i + 1}">ปิด</button>
        </div>
      </div>`).join("")}</div>
      <div class="relay-inputs"><strong>สัญญาณสวิตช์เข้า · DI</strong><div>${m.inputs.map((v, i) => `<span class="${v === true ? "is-on" : ""}" title="DI ${i + 1}: ${v === null ? "ไม่ยืนยัน" : v ? "HIGH" : "LOW"}">${i + 1}<b>${v === null ? "—" : v ? "HIGH" : "LOW"}</b></span>`).join("")}</div></div>
    </article>`;
  }
  function cardHtml() {
    const sensor = root.SensorTelemetry;
    if (sensor && typeof sensor.syncSession === "function") sensor.syncSession();
    const health = sensor && sensor.state.piHealth || {};
    const model = viewModel(health.relays);
    const signedIn = !!(typeof Auth !== "undefined" && Auth.session && Auth.session.token);
    return `<section id="farm-relay-panel" class="farm-relay-panel" tabindex="-1" aria-labelledby="relay-panel-title">
      <header class="relay-panel-header"><div><span class="farm-map-eyebrow">RELAY & SWITCHES</span><h2 id="relay-panel-title">รีเลย์ / สวิตช์</h2><p>สถานะจาก Pi 5 · อ่านล่าสุด ${model.observedAt}</p></div><button type="button" class="farm-map-secondary" onclick="App.refreshMainWaterSensor()" ${health.loading ? "disabled" : ""}>${health.loading ? "กำลังอ่าน…" : "อ่านสถานะใหม่"}</button></header>
      <div class="relay-blocker" id="relay-control-blocker"><strong>ยังสั่งเปิด–ปิดอุปกรณ์จริงไม่ได้</strong><p>ต้องระบุว่าช่องไหนต่อปั๊มหรือวาล์ว และตั้งค่าตัวควบคุมบน Pi 5 พร้อมตรวจระบบป้องกันก่อน ปุ่มด้านล่างจึงยังล็อกอยู่</p></div>
      ${!signedIn || (health.error && health.error.includes("เข้าสู่ระบบ")) ? `<div class="relay-access"><p>ใช้บัญชีเจ้าของเซ็นเซอร์เพื่อดูสถานะรีเลย์จริง</p><button type="button" class="farm-map-primary" onclick="App.openRelayLogin()">เข้าสู่ระบบเพื่อดูรีเลย์</button></div>` : health.error ? `<p class="relay-access" role="status">ยังรับสถานะจาก Pi 5 ไม่ได้ กรุณาลองอ่านสถานะใหม่</p>` : ""}
      <div class="relay-module-grid">${model.modules.map(moduleHtml).join("")}</div>
      <p class="relay-footnote">ON/OFF คือสถานะหน้าสัมผัสรีเลย์ ไม่ใช่หลักฐานว่าปั๊มหรือวาล์วทำงาน · ข้อมูลเกิน 3 นาทีจะแสดง “ไม่ยืนยัน” · ตรวจข้อมูลทุก 60 วินาที</p>
    </section>`;
  }
  root.RelayPanel = { viewModel, cardHtml };
})(typeof window !== "undefined" ? window : globalThis);
