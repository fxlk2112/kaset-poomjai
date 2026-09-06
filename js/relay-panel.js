/* Owner-authorized no-load bench: five-second pulses, Pi sole writer. */
(function (root) {
  "use strict";
  const MODULES = ["RELAY_A", "RELAY_B"];
  const bench = { data: null, busy: false, reading: false, error: "", loadedAt: 0 };
  let account = "", generation = 0;
  function syncBench() {
    const next = typeof Auth !== "undefined" && Auth.session && Auth.session.token || "";
    if (next !== account) { account = next; generation++; Object.assign(bench, { data: null, busy: false, reading: false, error: "", loadedAt: 0 }); }
    return next;
  }
  function draw() {
    if (typeof route !== "undefined" && route.view === "iot" && typeof render === "function") render();
  }
  async function request(action, extra = {}) {
    const token = syncBench();
    if (!token || (action === "read" ? bench.reading || bench.busy : bench.busy)) return;
    const epoch = generation;
    if (action === "read") bench.reading = true; else { bench.busy = true; bench.error = ""; draw(); }
    try {
      const response = await fetch(FarmUltimateRuntime.apiUrl + "/relay-bench/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000), body: JSON.stringify({ token, ...extra })
      });
      const result = await response.json();
      if (syncBench() !== token || epoch !== generation) return;
      if (!response.ok || !result.ok) {
        const messages = { OWNER_LOGIN_REQUIRED: "เข้าสู่ระบบด้วยบัญชีเจ้าของ", AUTH_DENIED: "เข้าสู่ระบบด้วยบัญชีเจ้าของอีกครั้ง", BENCH_DISABLED: "โหมดทดสอบยังไม่พร้อม", NO_LOAD_AND_READY_REQUIRED: "รอ Pi 5 พร้อมและทุกช่องปิดก่อนเริ่ม", NOT_READY_OR_BUSY: "รอช่องที่กำลังทดสอบปิดก่อน แล้วลองใหม่" };
        throw new Error(messages[result.error] || "ยังยืนยันคำสั่งไม่ได้ กรุณาอ่านสถานะใหม่");
      }
      bench.data = result.data;
      bench.error = "";
    } catch (error) {
      if (epoch !== generation) return;
      bench.error = error.name === "TimeoutError" || error.name === "AbortError" ? "การเชื่อมต่อตอบช้า กำลังรอสถานะจาก Pi 5" : error.message;
      if (action === "read") bench.data = null;
    } finally {
      if (epoch === generation) { bench.busy = false; bench.reading = false; bench.loadedAt = Date.now(); draw(); }
    }
  }
  function benchControls() {
    syncBench();
    const d = bench.data;
    const fresh = d && Date.now() - Date.parse(d.snapshot?.observed_at) < 12000 && d.connected === true;
    const active = fresh && d.session_active === true && d.armed_until > Date.now();
    const commandBusy = d && ["QUEUED", "CLAIMED", "ON_VERIFIED"].includes(d.last_command?.status);
    return { active: !!active, fresh: !!fresh, canPulse: !!(active && d.ready === true && !commandBusy && !bench.busy) };
  }
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
  function moduleHtml(m, control) {
    return `<article class="relay-module">
      <header><div><span>MODULE ${m.label} · 8 CHANNELS</span><h3>${m.name}</h3></div><b>${m.status}</b></header>
      <div class="relay-channels">${m.relays.map((value, i) => `<div class="relay-channel">
        <div><strong>CH ${i + 1}</strong><small>ทดสอบไม่มีโหลด</small></div>
        <span class="relay-reading ${value === true ? "is-on" : value === false ? "is-off" : "is-unknown"}">${value === true ? "ON" : value === false ? "OFF" : "ไม่ยืนยัน"}</span>
        <div class="relay-actions" role="group" aria-label="สวิตช์ ${m.name} CH ${i + 1}">
          <button type="button" ${control.canPulse ? "" : "disabled"} onclick="RelayPanel.pulse('${m.id}',${i + 1})" aria-describedby="relay-control-blocker" aria-label="เปิด ${m.name} CH ${i + 1} 5 วินาที">เปิด 5 วิ</button>
          <button type="button" ${account && value === true && !bench.busy ? "" : "disabled"} onclick="RelayPanel.request('off')" aria-describedby="relay-control-blocker" aria-label="ปิด ${m.name} CH ${i + 1}">ปิด</button>
        </div>
      </div>`).join("")}</div>
      <div class="relay-inputs"><strong>สัญญาณสวิตช์เข้า · DI</strong><div>${m.inputs.map((v, i) => `<span class="${v === true ? "is-on" : ""}" title="DI ${i + 1}: ${v === null ? "ไม่ยืนยัน" : v ? "HIGH" : "LOW"}">${i + 1}<b>${v === null ? "—" : v ? "HIGH" : "LOW"}</b></span>`).join("")}</div></div>
    </article>`;
  }
  function cardHtml() {
    const sensor = root.SensorTelemetry;
    if (sensor && typeof sensor.syncSession === "function") sensor.syncSession();
    const health = sensor && sensor.state.piHealth || {};
    const control = benchControls();
    const model = viewModel(control.fresh ? { ...bench.data.snapshot, output_control_allowed: false } : null);
    const signedIn = !!(typeof Auth !== "undefined" && Auth.session && Auth.session.token);
    return `<section id="farm-relay-panel" class="farm-relay-panel" tabindex="-1" aria-labelledby="relay-panel-title">
      <header class="relay-panel-header"><div><span class="farm-map-eyebrow">RELAY & SWITCHES</span><h2 id="relay-panel-title">รีเลย์ / สวิตช์</h2><p>สถานะจาก Pi 5 · อ่านล่าสุด ${model.observedAt}</p></div><button type="button" class="farm-map-secondary" onclick="RelayPanel.request('read')" ${bench.reading ? "disabled" : ""}>${bench.reading ? "กำลังอ่าน…" : "อ่านสถานะใหม่"}</button></header>
      <div class="relay-blocker" id="relay-control-blocker"><strong>ทดสอบรีเลย์จริง · ไม่มีโหลดต่ออยู่</strong><p>เปิดครั้งละ 1 ช่อง นาน 5 วินาทีแล้วปิดเองที่ตัวรีเลย์ โหมดทดสอบใช้ได้ครั้งละ 15 นาที ห้ามต่อปั๊ม วาล์ว หรือโหลดขณะใช้โหมดนี้</p></div>
      ${signedIn ? `<div class="relay-bench-tools"><strong>${control.active ? "โหมดทดสอบพร้อมใช้งาน" : control.fresh ? "Pi 5 เชื่อมต่อแล้ว" : "รอเชื่อมต่อ Pi 5"}</strong>
        ${!control.active ? `<button type="button" class="farm-map-primary" onclick="RelayPanel.request('arm',{no_load_confirmed:true})" ${!control.fresh || !bench.data?.ready || bench.busy ? "disabled" : ""}>เริ่มทดสอบ · ยืนยันไม่มีโหลด</button>` : `<button type="button" class="farm-map-secondary" onclick="RelayPanel.request('disarm')" ${bench.busy ? "disabled" : ""}>จบการทดสอบ</button>`}
        <button type="button" class="farm-map-secondary" onclick="RelayPanel.request('off')" ${bench.busy ? "disabled" : ""}>ปิดทุกช่อง</button><button type="button" class="farm-map-secondary" onclick="RelayPanel.request('read')">อ่านสถานะทดสอบ</button></div>` : ""}
      ${bench.error ? `<p class="relay-access" role="status">${bench.error.replace(/[&<>"']/g, "")}</p>` : ""}
      ${bench.data?.last_command ? `<p class="relay-command-status" role="status">คำสั่งล่าสุด: ${{ QUEUED: "กำลังส่งไป Pi 5", CLAIMED: "Pi 5 รับคำสั่งแล้ว", ON_VERIFIED: "อ่านยืนยันว่าเปิดแล้ว · รอปิดอัตโนมัติ", OFF_VERIFIED: "อ่านยืนยันว่าปิดแล้ว", CANCELLED: "ยกเลิกคำสั่งเปิด · ตรวจสถานะปิดที่ช่อง", FAILED: "คำสั่งไม่สำเร็จ · ตรวจสถานะล่าสุด", EXPIRED: "คำสั่งหมดอายุ ไม่ได้เปิดรีเลย์" }[bench.data.last_command.status] || "รอข้อมูล"}</p>` : ""}
      ${!signedIn || (health.error && health.error.includes("เข้าสู่ระบบ")) ? `<div class="relay-access"><p>ใช้บัญชีเจ้าของเซ็นเซอร์เพื่อดูสถานะรีเลย์จริง</p><button type="button" class="farm-map-primary" onclick="App.openRelayLogin()">เข้าสู่ระบบเพื่อดูรีเลย์</button></div>` : health.error ? `<p class="relay-access" role="status">ยังรับสถานะจาก Pi 5 ไม่ได้ กรุณาลองอ่านสถานะใหม่</p>` : ""}
      <div class="relay-module-grid">${model.modules.map(m => moduleHtml(m, control)).join("")}</div>
      <p class="relay-footnote">ON/OFF คือสถานะหน้าสัมผัสรีเลย์ · ระบบให้น้ำภาคสนามยังปิดใช้งาน · เมื่อทดสอบจะอ่านสถานะทุก 1 วินาที · ปุ่มปิดอาจรอการส่งถึง Pi 5 แต่ตัวรีเลย์ปิดเองภายใน 5 วินาที</p>
    </section>`;
  }
  root.RelayPanel = { viewModel, cardHtml, request, benchControls, pulse: (module, channel) => request("pulse", { id: crypto.randomUUID(), module, channel, pulse_seconds: 5 }) };
  if (typeof document !== "undefined" && typeof root.setInterval === "function") root.setInterval(() => {
    if (!syncBench() || document.hidden || typeof route === "undefined" || route.view !== "iot" || !root.FarmMapDashboard?.isMapSurface()) return;
    if (Date.now() - bench.loadedAt >= (bench.data?.session_active ? 1000 : 5000)) request("read");
  }, 1000);
})(typeof window !== "undefined" ? window : globalThis);
