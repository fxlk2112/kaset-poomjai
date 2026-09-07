/* Owner-authorized no-load bench: five-second pulses, Pi sole writer. */
(function (root) {
  "use strict";
  const MODULES = ["RELAY_A", "RELAY_B"];
  const bench = { data: null, busy: false, reading: false, error: "", loadedAt: 0, pending: {}, serverNow: 0 };
  let account = "", generation = 0;
  function syncBench() {
    const next = typeof Auth !== "undefined" && Auth.session && Auth.session.token || "";
    if (next !== account) { account = next; generation++; Object.assign(bench, { data: null, busy: false, reading: false, error: "", loadedAt: 0, pending: {}, serverNow: 0 }); }
    return next;
  }
  const keyOf = (module, channel) => module + ":" + channel;
  const busyStatus = status => ["SENDING", "QUEUED", "CLAIMED", "ON_VERIFIED"].includes(status);
  // Retain buttons while updating status: polling must not replace a pressed target.
  function morph(target, source) {
    if (target.nodeType !== source.nodeType || target.nodeName !== source.nodeName) { target.replaceWith(source.cloneNode(true)); return; }
    if (target.nodeType === 3) { if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue; return; }
    if (target.nodeType !== 1) return;
    for (const a of [...target.attributes]) if (!source.hasAttribute(a.name)) target.removeAttribute(a.name);
    for (const a of [...source.attributes]) if (target.getAttribute(a.name) !== a.value) target.setAttribute(a.name, a.value);
    for (let i = 0; i < source.childNodes.length; i++) {
      if (target.childNodes[i]) morph(target.childNodes[i], source.childNodes[i]); else target.append(source.childNodes[i].cloneNode(true));
    }
    while (target.childNodes.length > source.childNodes.length) target.lastChild.remove();
  }
  function draw() {
    if (typeof document === "undefined") return;
    const panel = document.getElementById("farm-relay-panel");
    if (panel) { const template = document.createElement("template"); template.innerHTML = cardHtml(); morph(panel, template.content.firstElementChild); }
  }
  async function request(action, extra = {}) {
    const token = syncBench(), perChannel = (action === "pulse" || action === "off") && extra.module;
    const key = perChannel ? keyOf(extra.module, extra.channel) : null;
    if (!token || (action === "read" && bench.reading) || (!perChannel && action !== "read" && bench.busy)) return;
    if (perChannel && action === "pulse" && bench.pending[key]) return;
    const epoch = generation;
    if (action === "read") bench.reading = true;
    else {
      bench.error = "";
      if (perChannel) bench.pending[key] = { ...extra, action: action === "pulse" ? "PULSE" : "OFF", status: "SENDING", since: Date.now() };
      else bench.busy = true;
      draw();
    }
    try {
      const response = await fetch(FarmUltimateRuntime.apiUrl + "/relay-bench/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000), body: JSON.stringify({ token, ...extra })
      });
      const result = await response.json();
      if (syncBench() !== token || epoch !== generation) return;
      if (!response.ok || !result.ok) {
        if (perChannel && bench.pending[key]?.id === extra.id) delete bench.pending[key];
        const messages = { OWNER_LOGIN_REQUIRED: "เข้าสู่ระบบด้วยบัญชีเจ้าของ", AUTH_DENIED: "เข้าสู่ระบบด้วยบัญชีเจ้าของอีกครั้ง", BENCH_DISABLED: "โหมดทดสอบยังไม่พร้อม", NO_LOAD_AND_READY_REQUIRED: "รอ Pi 5 พร้อมและทุกช่องปิดก่อนเริ่ม", NOT_READY_OR_BUSY: "ช่องนี้ยังทำงานหรือรอ Pi ยืนยัน กรุณารอสถานะล่าสุด" };
        throw new Error(messages[result.error] || "ยังยืนยันคำสั่งไม่ได้ กรุณาอ่านสถานะใหม่");
      }
      if (result.data && result.data.server_now >= bench.serverNow) {
        bench.data = result.data; bench.serverNow = result.data.server_now;
        for (const [pendingKey, pending] of Object.entries(bench.pending)) {
          const match = result.data.commands?.find(c => c.id === pending.id);
          if (match) delete bench.pending[pendingKey];
          else if (Date.now() - pending.since > 15000) delete bench.pending[pendingKey];
        }
      }
      if (perChannel && bench.pending[key]?.id === extra.id) bench.pending[key].status = result.accepted?.status || "QUEUED";
      if (result.accepted?.action === "ALL_OFF" || result.accepted?.action === "DISARM") {
        bench.pending = {};
        if (bench.data) { bench.data.ready = false; bench.data.stopping = true; if (result.accepted.action === "DISARM") bench.data.session_active = false; }
      }
      bench.error = "";
    } catch (error) {
      if (epoch !== generation) return;
      bench.error = error.name === "TimeoutError" || error.name === "AbortError" ? "การเชื่อมต่อตอบช้า กำลังรอสถานะจาก Pi 5" : error.message;
      if (action === "read") bench.data = null;
      if (perChannel && bench.pending[key]?.id === extra.id) bench.pending[key].status = "QUEUED";
    } finally {
      if (epoch === generation) {
        if (action === "read") bench.reading = false; else if (!perChannel) bench.busy = false;
        bench.loadedAt = action === "read" ? Date.now() : 0; draw();
      }
    }
  }
  function benchControls(module, channel) {
    syncBench();
    const d = bench.data;
    const fresh = d && Date.now() - Date.parse(d.snapshot?.observed_at) < 12000 && d.connected === true;
    const active = fresh && d.session_active === true && d.armed_until > Date.now();
    const pending = module && bench.pending[keyOf(module, channel)];
    const command = pending || d?.commands?.find(c => c.module === module && c.channel === channel);
    const value = d?.snapshot?.modules?.find(m => m.id === module)?.relay_status?.[channel - 1];
    const blocked = command && busyStatus(command.status);
    return { active: !!active, fresh: !!fresh, command, pending: !!pending,
      canPulse: !!(active && d.ready === true && d.protocol_version === 2 && !blocked && !bench.busy && (!module || value === false)),
      canOff: !!(account && !bench.busy && (value === true || (blocked && command.action === "PULSE"))) };
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
      <div class="relay-channels">${m.relays.map((value, i) => { const channel = benchControls(m.id, i + 1); return `<div class="relay-channel">
        <div><strong>CH ${i + 1}</strong><small>${channel.command && busyStatus(channel.command.status) ? ({SENDING:"กำลังส่ง…",QUEUED:"รอ Pi รับคำสั่ง",CLAIMED:"Pi รับคำสั่งแล้ว",ON_VERIFIED:"เปิดแล้ว · ปิดเอง 5 วิ"}[channel.command.status]) : "ทดสอบไม่มีโหลด"}</small></div>
        <span class="relay-reading ${value === true ? "is-on" : value === false ? "is-off" : "is-unknown"}">${value === true ? "ON" : value === false ? "OFF" : "ไม่ยืนยัน"}</span>
        <div class="relay-actions" role="group" aria-label="สวิตช์ ${m.name} CH ${i + 1}">
          <button type="button" ${channel.canPulse ? "" : "disabled"} onclick="RelayPanel.pulse('${m.id}',${i + 1})" aria-describedby="relay-control-blocker" aria-label="เปิด ${m.name} CH ${i + 1} 5 วินาที">เปิด 5 วิ</button>
          <button type="button" ${channel.canOff ? "" : "disabled"} onclick="RelayPanel.off('${m.id}',${i + 1})" aria-describedby="relay-control-blocker" aria-label="ปิด ${m.name} CH ${i + 1}">ปิด</button>
        </div>
      </div>`; }).join("")}</div>
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
      <div class="relay-blocker" id="relay-control-blocker"><strong>ทดสอบรีเลย์จริง · ไม่มีโหลดต่ออยู่</strong><p>เปิดหลายช่องพร้อมกันได้ แต่ละช่องปิดเองหลัง 5 วินาที ปุ่มปิดทำงานเฉพาะช่อง โหมดทดสอบใช้ได้ครั้งละ 15 นาที ห้ามต่อปั๊ม วาล์ว หรือโหลดขณะใช้โหมดนี้</p></div>
      ${signedIn ? `<div class="relay-bench-tools"><strong>${control.active ? "โหมดทดสอบพร้อมใช้งาน" : control.fresh ? "Pi 5 เชื่อมต่อแล้ว" : "รอเชื่อมต่อ Pi 5"}</strong>
        ${!control.active ? `<button type="button" class="farm-map-primary" onclick="RelayPanel.request('arm',{no_load_confirmed:true})" ${!control.fresh || !bench.data?.ready || bench.busy ? "disabled" : ""}>เริ่มทดสอบ · ยืนยันไม่มีโหลด</button>` : `<button type="button" class="farm-map-secondary" onclick="RelayPanel.request('disarm')" ${bench.busy ? "disabled" : ""}>จบการทดสอบ</button>`}
        <button type="button" class="farm-map-secondary" onclick="RelayPanel.request('off')" ${bench.busy ? "disabled" : ""}>ปิดทุกช่อง</button><button type="button" class="farm-map-secondary" onclick="RelayPanel.request('read')">อ่านสถานะทดสอบ</button></div>` : ""}
      ${bench.error ? `<p class="relay-access" role="status">${bench.error.replace(/[&<>"']/g, "")}</p>` : ""}
      ${bench.data?.last_command ? `<p class="relay-command-status" role="status">คำสั่งล่าสุด: ${{ QUEUED: "กำลังส่งไป Pi 5", CLAIMED: "Pi 5 รับคำสั่งแล้ว", ON_VERIFIED: "อ่านยืนยันว่าเปิดแล้ว · รอปิดอัตโนมัติ", OFF_VERIFIED: "อ่านยืนยันว่าปิดแล้ว", CANCELLED: "ยกเลิกคำสั่งเปิด · ตรวจสถานะปิดที่ช่อง", FAILED: "คำสั่งไม่สำเร็จ · ตรวจสถานะล่าสุด", EXPIRED: "คำสั่งหมดอายุ ไม่ได้เปิดรีเลย์" }[bench.data.last_command.status] || "รอข้อมูล"}</p>` : ""}
      ${!signedIn || (health.error && health.error.includes("เข้าสู่ระบบ")) ? `<div class="relay-access"><p>ใช้บัญชีเจ้าของเซ็นเซอร์เพื่อดูสถานะรีเลย์จริง</p><button type="button" class="farm-map-primary" onclick="App.openRelayLogin()">เข้าสู่ระบบเพื่อดูรีเลย์</button></div>` : health.error ? `<p class="relay-access" role="status">ยังรับสถานะจาก Pi 5 ไม่ได้ กรุณาลองอ่านสถานะใหม่</p>` : ""}
      <div class="relay-module-grid">${model.modules.map(m => moduleHtml(m, control)).join("")}</div>
      <p class="relay-footnote">ON/OFF คือสถานะหน้าสัมผัสรีเลย์ · ระบบให้น้ำภาคสนามยังปิดใช้งาน · สถานะเปลี่ยนเมื่อ Pi อ่านยืนยันแล้ว · ปุ่มปิดอาจรอการส่งถึง Pi 5 แต่ตัวรีเลย์ปิดเองภายใน 5 วินาที</p>
    </section>`;
  }
  root.RelayPanel = { viewModel, cardHtml, request, benchControls, pulse: (module, channel) => request("pulse", { id: crypto.randomUUID(), module, channel, pulse_seconds: 5 }), off: (module, channel) => { const c = benchControls(module, channel).command; return request("off", { id: crypto.randomUUID(), module, channel, ...(c?.action === "PULSE" ? { cancel_id: c.id } : {}) }); } };
  if (typeof document !== "undefined" && typeof root.setInterval === "function") root.setInterval(() => {
    if (!syncBench() || document.hidden || typeof route === "undefined" || route.view !== "iot" || !root.FarmMapDashboard?.isMapSurface()) return;
    if (Date.now() - bench.loadedAt >= (bench.data?.session_active || Object.keys(bench.pending).length ? 100 : 1500)) request("read");
  }, 100);
})(typeof window !== "undefined" ? window : globalThis);
