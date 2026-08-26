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
    const loading = state.loading && !c;
    const notice = `<div class="sensor-safety-note">อ่านข้อมูลเท่านั้น · Pi 5 ไม่รับคำสั่งเอาต์พุตจากคลาวด์</div>`;
    if (loading) {
      return `<section class="card sensor-card" aria-live="polite">
        <div class="sensor-head"><div><div class="sensor-eyebrow">เซนเซอร์จริง · แหล่งน้ำหลัก</div><div class="plot-name">กำลังโหลดข้อมูลจาก Pi 5…</div></div></div>
        ${notice}</section>`;
    }
    if (state.error) {
      return `<section class="card sensor-card" aria-live="polite">
        <div class="sensor-head"><div><div class="sensor-eyebrow">เซนเซอร์จริง · แหล่งน้ำหลัก</div><div class="plot-name">ยังเชื่อมข้อมูลไม่ได้</div></div><span class="sensor-status fault">ตรวจสอบระบบ</span></div>
        <div class="muted mt-8">${safeText(state.error)}</div>
        <button class="btn btn-outline btn-sm mt-8" onclick="App.refreshMainWaterSensor()">ลองใหม่</button>
        ${notice}</section>`;
    }
    if (!c) {
      return `<section class="card sensor-card" aria-live="polite">
        <div class="sensor-head"><div><div class="sensor-eyebrow">เซนเซอร์จริง · แหล่งน้ำหลัก</div><div class="plot-name">ยังไม่มีข้อมูลจาก Pi 5</div></div><span class="sensor-status muted">${safeText(meta.label)}</span></div>
        <div class="muted mt-8">ลงทะเบียนอุปกรณ์และตั้ง telemetry forwarder แล้วข้อมูลจะปรากฏที่นี่</div>
        <button class="btn btn-outline btn-sm mt-8" onclick="App.refreshMainWaterSensor()">ตรวจอีกครั้ง</button>
        ${notice}</section>`;
    }
    const observed = observedLabel(c.observed_at);
    return `<section class="card sensor-card" aria-live="polite">
      <div class="sensor-head">
        <div><div class="sensor-eyebrow">เซนเซอร์จริง · แหล่งน้ำหลัก</div><div class="plot-name">ระดับน้ำและปริมาตรโดยประมาณ</div></div>
        <span class="sensor-status ${meta.cls}">${safeText(meta.label)}</span>
      </div>
      <div class="sensor-primary">
        <div><span class="sensor-value">${numberLabel(c.volume_m3, 1)}</span><span class="sensor-unit"> ลบ.ม.</span><div class="muted">ปริมาตรโดยประมาณ</div></div>
        <div class="sensor-ring" style="--sensor-pct:${Math.max(0, Math.min(100, c.capacity_percent || 0))}"><b>${numberLabel(c.capacity_percent, 1)}%</b><span>ความจุ</span></div>
      </div>
      <div class="sensor-metrics">
        <div><span>ระดับจากเซนเซอร์</span><b>${numberLabel(c.depth_m, 3)} เมตร</b></div>
        <div><span>กระแสสัญญาณ</span><b>${numberLabel(c.current_ma, 2)} mA</b></div>
        <div><span>วัดล่าสุด</span><b>${safeText(observed)}</b><small>${safeText(ageLabel(state.ageS))}</small></div>
      </div>
      <div class="row row-between sensor-history-head">
        <div><b>ประวัติปริมาตร</b><div class="muted">ข้อมูล GOOD เท่านั้น</div></div>
        <div class="sensor-range" role="group" aria-label="ช่วงเวลาของกราฟ">
          <button class="${state.hours === 24 ? "active" : ""}" onclick="App.setSensorHistoryHours(24)">24 ชม.</button>
          <button class="${state.hours === 168 ? "active" : ""}" onclick="App.setSensorHistoryHours(168)">7 วัน</button>
        </div>
      </div>
      <div class="chart-wrap sensor-history-chart" id="sensorHistoryChart"></div>
      <div class="sensor-foot"><span>โมเดลปริมาตร: ${safeText(c.volume_model_id || "ยังไม่ระบุ")}</span><span>ค่าปริมาตรยังเป็นค่าประมาณจากจุดอ้างอิงเดิม</span></div>
      ${notice}
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

  function mountChart() {
    const el = typeof document !== "undefined" ? document.getElementById("sensorHistoryChart") : null;
    if (!el) return;
    const good = state.history.filter(row => row.quality === "GOOD" && row.volume_m3 !== null);
    if (good.length < 2 || typeof Charts === "undefined") {
      el.innerHTML = `<div class="muted sensor-chart-empty">ยังมีข้อมูลไม่พอสำหรับวาดกราฟ</div>`;
      return;
    }
    const points = downsample(good, 10).map(row => {
      const d = new Date(row.observed_at);
      const label = state.hours === 24
        ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
      return { label, value: row.volume_m3 };
    });
    Charts.line(el, points, {});
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
})(typeof window !== "undefined" ? window : globalThis);
