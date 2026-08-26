/* FARMULTIMATE Phase 1 — sensor telemetry UI (read-only, no actuator actions). */
(function (root) {
  "use strict";

  const SOURCE_ID = "MAIN_WATER_LEVEL_PI_ZERO_01";
  const state = {
    sourceId: SOURCE_ID,
    loading: false,
    error: "",
    current: null,
    status: "NO_DATA",
    ageS: null,
    history: [],
    hours: 24,
    loadedAt: 0
  };

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeCurrentResponse(data) {
    const d = data && typeof data === "object" ? data : {};
    if (d.output_control_allowed !== false) throw new Error("เซิร์ฟเวอร์ไม่ได้ยืนยันโหมดอ่านอย่างเดียว");
    const current = d.current && typeof d.current === "object" ? Object.assign({}, d.current) : null;
    if (current) {
      current.depth_m = finiteOrNull(current.depth_m);
      current.volume_m3 = finiteOrNull(current.volume_m3);
      current.capacity_percent = finiteOrNull(current.capacity_percent);
      current.current_ma = finiteOrNull(current.current_ma);
      current.observed_ts = finiteOrNull(current.observed_ts);
    }
    return {
      status: String(d.status || "NO_DATA").toUpperCase(),
      ageS: finiteOrNull(d.age_s),
      current
    };
  }

  function statusMeta(status) {
    const map = {
      GOOD: { label: "ข้อมูลปกติ", cls: "good" },
      STALE: { label: "ข้อมูลเก่า", cls: "stale" },
      DISCONNECTED: { label: "เซนเซอร์หลุด", cls: "fault" },
      OUT_OF_RANGE: { label: "ค่าเกินช่วง", cls: "fault" },
      SENSOR_FAULT: { label: "เซนเซอร์ผิดปกติ", cls: "fault" },
      NO_DATA: { label: "ยังไม่มีข้อมูล", cls: "muted" }
    };
    return map[String(status || "").toUpperCase()] || { label: String(status || "ไม่ทราบสถานะ"), cls: "muted" };
  }

  function safeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function numberLabel(value, digits) {
    const n = finiteOrNull(value);
    return n === null ? "—" : n.toLocaleString("th-TH", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function observedLabel(value) {
    const d = new Date(String(value || ""));
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function ageLabel(ageS) {
    const n = finiteOrNull(ageS);
    if (n === null) return "ไม่ทราบอายุข้อมูล";
    if (n < 60) return "เมื่อ " + Math.round(n) + " วินาทีที่แล้ว";
    if (n < 3600) return "เมื่อ " + Math.round(n / 60) + " นาทีที่แล้ว";
    return "เมื่อ " + (n / 3600).toFixed(1) + " ชั่วโมงที่แล้ว";
  }

  function ageShortLabel(ageS) {
    return ageLabel(ageS).replace(/^เมื่อ\s+/, "");
  }

  function isLocalPreview() {
    if (typeof location === "undefined") return false;
    const host = String(location.hostname || "").toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") return false;
    try { return new URL(location.href).searchParams.get("sensorPreview") === "1"; }
    catch (error) { return false; }
  }

  function applyLocalPreview() {
    if (!isLocalPreview() || state.current) return;
    const base = Date.parse("2026-08-26T11:59:42+07:00");
    const volumes = [103.2, 103.8, 103.5, 102.7, 102.4, 102.9, 102.5, 102.8, 102.3, 102.6, 103.4, 103.8, 103.5, 103.1, 102.8, 103.0, 103.7, 104.0, 103.4, 103.1, 102.9];
    state.current = {
      observed_at: new Date(base).toISOString(), observed_ts: Math.floor(base / 1000),
      depth_m: 0.577, volume_m3: 104.9, capacity_percent: 13.1, current_ma: 6.40,
      volume_model_id: "legacy-calibration-v1"
    };
    state.status = "GOOD";
    state.ageS = 18;
    state.loadedAt = Date.now();
    state.history = volumes.map((volume, index) => ({
      observed_at: new Date(base - (volumes.length - 1 - index) * 60 * 60 * 1000).toISOString(),
      observed_ts: Math.floor((base - (volumes.length - 1 - index) * 60 * 60 * 1000) / 1000),
      quality: "GOOD", volume_m3: volume, depth_m: null, capacity_percent: null
    }));
  }

  function historyRows(raw) {
    return (Array.isArray(raw) ? raw : []).map(row => ({
      observed_at: String(row.observed_at || ""),
      observed_ts: finiteOrNull(row.observed_ts),
      quality: String(row.quality || ""),
      volume_m3: finiteOrNull(row.volume_m3),
      depth_m: finiteOrNull(row.depth_m),
      capacity_percent: finiteOrNull(row.capacity_percent)
    }));
  }

  async function refresh(force) {
    if (isLocalPreview()) {
      applyLocalPreview();
      return;
    }
    if (typeof Auth === "undefined" || !Auth.session || typeof authCall !== "function") return;
    if (state.loading) return;
    if (!force && state.loadedAt && Date.now() - state.loadedAt < 30000) return;
    state.loading = true;
    state.error = "";
    try {
      const results = await Promise.all([
        authCall("sensor_current", { token: Auth.session.token, source_id: state.sourceId }),
        authCall("sensor_history", { token: Auth.session.token, source_id: state.sourceId, hours: state.hours, limit: 400 })
      ]);
      if (!results[0].ok) throw new Error(results[0].error || "โหลดค่าล่าสุดไม่สำเร็จ");
      const normalized = normalizeCurrentResponse(results[0].data);
      state.current = normalized.current;
      state.status = normalized.status;
      state.ageS = normalized.ageS;
      if (results[1].ok && results[1].data && results[1].data.output_control_allowed === false) {
        state.history = historyRows(results[1].data.rows);
      } else {
        state.history = [];
      }
      state.loadedAt = Date.now();
    } catch (error) {
      state.error = String(error && error.message || error || "โหลดข้อมูลไม่สำเร็จ");
      state.loadedAt = Date.now();
    } finally {
      state.loading = false;
    }
    if (typeof route !== "undefined" && route.view === "iot" && typeof render === "function") render();
  }

  function cardHtml() {
    const meta = statusMeta(state.status);
    const c = state.current;
    const hasData = !!c;
    const statusClass = state.error ? "fault" : meta.cls;
    const statusLabel = state.loading && !c ? "กำลังรับข้อมูล" : state.error ? "เชื่อมต่อไม่ได้" : meta.label;
    const observed = hasData ? observedLabel(c.observed_at) : "—";
    const level = hasData ? numberLabel(c.depth_m, 3) : "—";
    const volume = hasData ? numberLabel(c.volume_m3, 1) : "—";
    const capacity = hasData ? numberLabel(c.capacity_percent, 1) : "—";
    const signal = hasData ? numberLabel(c.current_ma, 2) : "—";
    const age = hasData ? ageShortLabel(state.ageS) : "รอข้อมูลล่าสุด";
    const date = hasData && c.observed_at ? new Date(c.observed_at).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric"
    }) : "—";
    const errorNote = state.error ? `<div class="digital-alert" role="alert">${safeText(state.error)} <button onclick="App.refreshMainWaterSensor()">ลองใหม่</button></div>` : "";

    return `<section class="sensor-digital-twin" aria-live="polite" aria-busy="${state.loading ? "true" : "false"}">
      <header class="digital-header">
        <button class="digital-brand" onclick="App.nav('more')" aria-label="กลับไปเมนูเพิ่มเติม">
          <img src="images/digital-twin/fus-logo-white-v1.png" alt="FARMULTIMATE SOLUTIONS">
        </button>
        <div class="digital-title">
          <h1>แหล่งน้ำหลัก</h1>
          <div class="digital-live ${statusClass}"><span aria-hidden="true"></span> LIVE · ${safeText(statusLabel)}</div>
        </div>
      </header>

      <div class="digital-hero">
        <img src="images/digital-twin/main-reservoir-isometric-v1.png" alt="ภาพกราฟิกสามมิติของแหล่งเก็บน้ำหลักและระบบท่อ">
        <div class="hero-level-pin" aria-label="ระดับน้ำ ${level} เมตร"><span></span><b>${level} m</b></div>
        <div class="hero-reading">
          <span>ระดับน้ำ</span>
          <strong>${level}</strong><b>เมตร</b>
        </div>
      </div>

      <div class="digital-panel">
        ${errorNote}
        <div class="digital-primary-grid">
          <div class="digital-volume">
            <span>ปริมาตรโดยประมาณ</span>
            <div><strong>${volume}</strong><b>ลบ.ม.</b></div>
          </div>
          <div class="digital-capacity">
            <div><span>ความจุ</span><strong>${capacity}<b>%</b></strong></div>
            <canvas id="sensorCapacityGauge" data-value="${hasData ? Math.max(0, Math.min(100, Number(c.capacity_percent) || 0)) : 0}" aria-label="ความจุ ${capacity} เปอร์เซ็นต์"></canvas>
          </div>
        </div>

        <div class="digital-secondary-grid">
          <div class="digital-secondary-item"><span>สัญญาณ</span><strong>${signal} <b>mA</b></strong></div>
          <div class="digital-secondary-item"><span>อัปเดต</span><strong>${safeText(age)}</strong><small>${safeText(observed)}</small></div>
        </div>

        <div class="digital-chart-grid">
          <section class="digital-chart-card">
            <h2>โปรไฟล์ความลึก</h2>
            <div class="chart-caption">ความลึก (เมตร)</div>
            <canvas id="sensorDepthProfileChart" data-level="${hasData ? Number(c.depth_m) || 0 : 0}" aria-label="กราฟโปรไฟล์ความลึก"></canvas>
          </section>
          <section class="digital-chart-card">
            <h2>แนวโน้ม ${state.hours === 168 ? "7 วัน" : "24 ชั่วโมง"}</h2>
            <div class="chart-caption">ปริมาตร (ลบ.ม.)</div>
            <canvas id="sensorHistoryChart" aria-label="กราฟแนวโน้มปริมาตร"></canvas>
          </section>
        </div>

        <footer class="digital-footer">
          <span>${safeText(date)}</span>
          <b>DATA ONLY · SAFE_OFF</b>
        </footer>
      </div>
    </section>`;
  }

  function downsample(rows, maxPoints) {
    if (rows.length <= maxPoints) return rows;
    const out = [];
    for (let i = 0; i < maxPoints; i++) {
      const index = Math.round(i * (rows.length - 1) / (maxPoints - 1));
      out.push(rows[index]);
    }
    return out;
  }

  function canvasContext(canvas, cssHeight) {
    if (!canvas || typeof window === "undefined") return null;
    const width = Math.max(220, Math.round(canvas.getBoundingClientRect().width || 320));
    const height = cssHeight;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function drawGauge() {
    const canvas = typeof document !== "undefined" ? document.getElementById("sensorCapacityGauge") : null;
    const setup = canvasContext(canvas, 62);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pct = Math.max(0, Math.min(100, Number(canvas.dataset.value) || 0));
    const radius = Math.min(width, height) * 0.35;
    const cx = width / 2, cy = height / 2;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(124, 167, 169, .27)";
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#45e2ed";
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct / 100); ctx.stroke();
  }

  function drawEmptyChart(canvas, message) {
    const setup = canvasContext(canvas, 90);
    if (!setup) return;
    const { ctx, width, height } = setup;
    ctx.fillStyle = "rgba(210, 235, 232, .7)";
    ctx.font = "500 12px Sarabun, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
  }

  function drawDepthProfile() {
    const canvas = typeof document !== "undefined" ? document.getElementById("sensorDepthProfileChart") : null;
    const setup = canvasContext(canvas, 90);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = { l: 28, r: 8, t: 10, b: 22 };
    const values = [0, .08, .22, .35, .43, .57, .66, .76, .92, 1.08, 1.28, 2.5];
    const x = i => pad.l + i / (values.length - 1) * (width - pad.l - pad.r);
    const y = v => pad.t + v / 2.5 * (height - pad.t - pad.b);
    ctx.strokeStyle = "rgba(98, 151, 155, .24)";
    ctx.lineWidth = 1;
    [0, .5, 1, 1.5, 2, 2.5].forEach(v => {
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(width - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = "#b8cfcd"; ctx.font = "10px Sarabun, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(v.toFixed(1), pad.l - 5, y(v) + 3);
    });
    ctx.beginPath(); ctx.moveTo(x(0), y(values[0]));
    values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(values.length - 1), height - pad.b); ctx.lineTo(x(0), height - pad.b); ctx.closePath();
    ctx.fillStyle = "rgba(22, 187, 207, .24)"; ctx.fill();
    ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = "#45e2ed"; ctx.lineWidth = 2; ctx.stroke();
    const level = Math.max(0, Math.min(2.5, Number(canvas.dataset.level) || 0));
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#45e2ed"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y(level)); ctx.lineTo(width - pad.r, y(level)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#45e2ed"; ctx.font = "700 11px Sarabun, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(numberLabel(level, 3) + " m", width - pad.r, Math.max(12, y(level) - 5));
  }

  function drawHistoryChart() {
    const canvas = typeof document !== "undefined" ? document.getElementById("sensorHistoryChart") : null;
    const good = state.history.filter(row => row.quality === "GOOD" && row.volume_m3 !== null);
    if (!canvas) return;
    if (good.length < 2) { drawEmptyChart(canvas, "ยังมีข้อมูลไม่พอสำหรับวาดกราฟ"); return; }
    const setup = canvasContext(canvas, 90);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const rows = downsample(good, 28);
    const values = rows.map(row => Number(row.volume_m3));
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const margin = Math.max(.8, (rawMax - rawMin) * .35);
    const min = rawMin - margin, max = rawMax + margin;
    const pad = { l: 30, r: 8, t: 10, b: 22 };
    const x = i => pad.l + i / (values.length - 1) * (width - pad.l - pad.r);
    const y = v => pad.t + (max - v) / (max - min) * (height - pad.t - pad.b);
    ctx.strokeStyle = "rgba(98, 151, 155, .24)"; ctx.lineWidth = 1;
    [0, .5, 1].forEach(step => {
      const v = min + (max - min) * step;
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(width - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = "#b8cfcd"; ctx.font = "10px Sarabun, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(v.toFixed(0), pad.l - 5, y(v) + 3);
    });
    ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = "#45e2ed"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    const last = values.length - 1;
    ctx.fillStyle = "#45e2ed"; ctx.beginPath(); ctx.arc(x(last), y(values[last]), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = "10px Sarabun, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#b8cfcd";
    [0, Math.floor(last / 2), last].forEach(i => {
      const d = new Date(rows[i].observed_at);
      const label = state.hours === 168
        ? d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })
        : d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      ctx.fillText(label, x(i), height - 6);
    });
    ctx.fillStyle = "#45e2ed"; ctx.font = "700 11px Sarabun, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(numberLabel(values[last], 1), width - pad.r, Math.max(12, y(values[last]) - 7));
  }

  function mountChart() {
    drawGauge();
    drawDepthProfile();
    drawHistoryChart();
  }

  function setHours(hours) {
    state.hours = Number(hours) === 168 ? 168 : 24;
    state.loadedAt = 0;
    refresh(true);
  }

  root.SensorTelemetry = {
    SOURCE_ID,
    state,
    finiteOrNull,
    normalizeCurrentResponse,
    statusMeta,
    historyRows,
    downsample,
    refresh,
    cardHtml,
    mountChart,
    setHours
  };

  applyLocalPreview();
})(typeof window !== "undefined" ? window : globalThis);
