/* ============================================================
   เกษตรภูมิใจ v52 — app logic
   dashboard, role switcher, plots, stock, equipment, cycles,
   activity planner, IoT, analytics, FAB drawer, interactive tour
   ============================================================ */
"use strict";

/* ---------------- state & bootstrap ---------------- */
const S = loadState();
let route = { view: "home", tab: "plots" };
let cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: todayISO() };

const App = {};

/* ---------------- small helpers ---------------- */
function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}
function thaiDateStr(d) {
  const by = d.getFullYear() + 543;
  return d.getDate() + " " + THAI_MONTHS[d.getMonth()] + " " + by;
}
function cropEmoji(crop) {
  const c = (crop || "").toLowerCase();
  if (c.includes("ข้าวโพด")) return "🌽";
  if (c.includes("ข้าว")) return "🌾";
  if (c.includes("มัน")) return "🍠";
  if (c.includes("ผัก") || c.includes("กะหล่ำ") || c.includes("คะน้า")) return "🥬";
  if (c.includes("อ้อย")) return "🎋";
  if (c.includes("กล้วย")) return "🍌";
  if (c.includes("มะม่วง")) return "🥭";
  return "🌱";
}
function statusTag(status) {
  if (status === "done") return `<span class="badge badge-green">เสร็จ</span>`;
  if (status === "overdue") return `<span class="badge badge-red">เลยกำหนด</span>`;
  return `<span class="badge badge-amber">แผน</span>`;
}
function typeTag(t) {
  return `<span class="task-tag" style="background:var(--green-soft);color:var(--green-dark)">${TYPE_ICONS[t.type] || ""} ${TYPE_LABELS[t.type] || t.type}</span>`;
}
/* แถวงานแบบเดียวกันทั้งหน้าแรก / กิจกรรม / หน้ารายละเอียดแปลง */
function taskRowHtml(t, opts) {
  opts = opts || {};
  const done = t.status === "done";
  const meta = [];
  if (opts.showDate) meta.push(t.date);
  if (t.qty) meta.push("จำนวน " + fmtNum(t.qty));
  if (t.revenue) meta.push("รายรับ " + fmtMoney(t.revenue) + " บาท");
  if (t.cost) meta.push("ต้นทุน " + fmtMoney(t.cost) + " บาท");
  if (opts.showNote && t.note) meta.push(esc(t.note));
  return `
    <div class="task-row ${done ? "done" : ""}">
      <button class="task-check" onclick="App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ">${done ? "✓" : ""}</button>
      <span class="task-ico ${esc(t.type)}">${TYPE_ICONS[t.type] || "🔧"}</span>
      <div class="grow">
        <div class="task-title">${esc(t.title)} ${typeTag(t)}</div>
        ${meta.length ? `<div class="muted">${meta.join(" · ")}</div>` : ""}
      </div>
      ${statusTag(taskStatusOf(t))}
      ${opts.showDelete ? `<button class="btn btn-sm btn-danger-soft" onclick="App.deleteTask('${t.id}')">🗑</button>` : ""}
    </div>`;
}

/* ปฏิทินงาน — ใช้ร่วมกันทั้งหน้าแรกและหน้าปฏิทิน */
function calendarCellsHtml(compact) {
  const { y, m, sel } = cal;
  const firstDow = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const today = todayISO();
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= dim;
    const dateStr = inMonth ? `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null;
    const dayTasks = dateStr ? tasksOn(S, dateStr) : [];
    const ds = dayTasks.length ? dayStatus(S, dateStr) : null;
    /* จุดบอกสถานะ: เสร็จ=เขียว แผน=เหลือง เลยกำหนด=แดง */
    const dotCls = ds === "done" ? "dot-green" : ds === "overdue" ? "dot-red" : ds ? "dot-amber" : "";
    const dots = ds ? `<span class="dots"><i class="${dotCls}"></i></span>` : "";
    /* ชื่อเสียงานในช่องวัน: ปฏิทินใหญ่แสดง 2 รายการ (เห็นงานได้เลย) / ปฏิทินกะทัดรัดหน้าแรกแสดงแค่จุด */
    const maxTips = compact ? 0 : 2;
    const tips = dayTasks.slice(0, maxTips).map(t => {
      const st = taskStatusOf(t);
      return `<span class="cal-tip t-${st}">${esc(t.title)}</span>`;
    }).join("");
    const more = (!compact && dayTasks.length > maxTips) ? `<span class="cal-more">+${dayTasks.length - maxTips}</span>` : "";
    const cls = [
      inMonth ? "" : "other",
      dateStr === today ? "today" : "",
      dateStr === sel ? "selected" : ""
    ].join(" ");
    cells += `<button class="cal-day ${cls}" onclick="App.pickDay('${dateStr || ""}')">${inMonth ? dayNum : ""}${dots}${tips}${more}</button>`;
  }
  return cells;
}
function calCardHtml(compact) {
  const { y, m } = cal;
  const overdueCount = S.tasks.filter(t => taskStatusOf(t) === "overdue").length;
  return `
    <div class="card cal-card${compact ? " cal-sm" : ""}">
      <div class="cal-head">
        <button class="cal-nav" onclick="App.calMove(-1)">‹</button>
        <div class="cal-title">${THAI_MONTHS[m]} ${y + 543}</div>
        <button class="cal-nav" onclick="App.calMove(1)">›</button>
      </div>
      <div class="cal-grid">
        ${THAI_DAYS.map(d => `<div class="cal-dow">${d}</div>`).join("")}
        ${calendarCellsHtml(compact)}
      </div>
      <div class="legend">
        <span><i class="dot-green"></i> เสร็จ</span>
        <span><i class="dot-amber"></i> แผน</span>
        <span><i class="dot-red"></i> เลยกำหนด</span>
        ${overdueCount ? `<span class="bold" style="color:var(--red)">⚠️ ${overdueCount} งานเลยกำหนด</span>` : ""}
      </div>
    </div>`;
}

/* ---------------- router & nav ---------------- */
const NAV_ALL = [
  { key: "home", label: "หน้าแรก", ico: "🏠" },
  { key: "plots", label: "แปลง", ico: "🗺️" },
  { key: "stock", label: "สต็อก", ico: "📦" },
  { key: "planner", label: "กิจกรรม", ico: "📅" },
  { key: "analytics", label: "วิเคราะห์", ico: "📊" },
  { key: "more", label: "เพิ่มเติม", ico: "☰" },
];
function visibleNav() {
  const role = S.role;
  if (role === "large") return NAV_ALL.filter(n => n.key !== "analytics");
  if (role === "business") return NAV_ALL.filter(n => ["home", "analytics", "more"].includes(n.key));
  return NAV_ALL;
}
const ROLE_META = {
  general: { label: "เกษตรกร", ico: "👨‍🌾", desc: "งานรายวัน · ปฏิทิน · สิ่งที่ต้องทำ" },
  large: { label: "ฟาร์มใหญ่", ico: "🚜", desc: "ภาพรวมพื้นที่ · แปลง · สถานะคนงาน" },
  business: { label: "ธุรกิจ", ico: "💼", desc: "ตัวเลขการเงิน · กำไรขาดทุน · วิเคราะห์เชิงลึก" },
};

function render() {
  // role switch
  const rs = document.getElementById("roleSwitch");
  rs.innerHTML = Object.keys(ROLE_META).map(k =>
    `<button class="${S.role === k ? "active" : ""}" onclick="App.setRole('${k}')">${ROLE_META[k].ico} ${ROLE_META[k].label}</button>`
  ).join("");

  // keep route valid for role (sub-views group under their parent nav item)
  const keys = visibleNav().map(n => n.key);
  const VIEW_GROUP = { equipment: "more", iot: "more", settings: "more", plotDetail: "plots" };
  const navKey = VIEW_GROUP[route.view] || route.view;
  if (!keys.includes(navKey)) {
    route.view = keys.includes("home") ? "home" : keys[0];
  }

  // bottom nav
  const nav = document.getElementById("bottomNav");
  nav.innerHTML = visibleNav().map(n =>
    `<button class="nav-item ${navKey === n.key ? "active" : ""}" onclick="App.nav('${n.key}')">
       <span class="nav-ico">${n.ico}</span><span>${n.label}</span>
     </button>`
  ).join("");

  // view
  const v = document.getElementById("view");
  const views = {
    home: renderHome, plots: renderPlots, stock: renderStock,
    planner: renderPlanner, analytics: renderAnalytics, more: renderMore,
    equipment: renderEquipment, iot: renderIoT, settings: renderSettings,
    plotDetail: renderPlotDetail
  };
  v.innerHTML = (views[route.view] || renderHome)();
  v.scrollTop = 0;
  window.scrollTo(0, 0);

  drawCharts();
}

App.nav = function (key) {
  route.view = key;
  render();
};
App.setRole = function (role) {
  S.role = role;
  saveState(S);
  render();
  toast(`สลับโหมด: ${ROLE_META[role].label} — ${ROLE_META[role].desc}`);
};
/* re-render แบบไม่กระโดดกลับหัวหน้า (ใช้กับปุ่มในหน้า เช่น ติ๊กงาน / กดวันที่ปฏิทิน) */
function rerender() {
  const sy = window.scrollY;
  render();
  requestAnimationFrame(() => window.scrollTo(0, sy));
}

/* ---------------- Dashboard ---------------- */
function renderHome() {
  const ytd = ytdFinance(S);
  const area = activeAreaRai(S);
  const cycles = activeCycles(S);
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const tToday = tasksOn(S, today);
  const tTomorrow = tasksOn(S, tomorrow);
  /* งานที่ต้องทำเร็วๆ นี้: วันนี้ + พรุ่งนี้ — ถ้าพรุ่งนี้ไม่มีงาน ให้ดึงงานถัดไปที่จะถึงมาแทน */
  const soon = tTomorrow.length ? [] : [...S.tasks]
    .filter(t => taskStatusOf(t) === "planned" && t.date > tomorrow)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const todays = [...tToday, ...tTomorrow, ...soon]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));
  const doneToday = tToday.filter(t => t.status === "done").length;
  const todayPct = tToday.length ? Math.round(doneToday / tToday.length * 100) : 0;
  const overdue = S.tasks.filter(t => taskStatusOf(t) === "overdue");
  const recent = [...S.tasks].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const selDate = cal.sel || today;
  const selTasks = tasksOn(S, selDate).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));

  const kpiProfit = ytd.net >= 0;
  const kpiClass = kpiProfit ? "pos" : "neg";
  const plotProfits = S.plots.filter(p => p.status === "active").map(p => ({ p, fin: plotFinance(S, p.id) }));

  /* ปุ่มลัดบันทึกงานประจำวันบนหน้าแรก */
  const quickActs = [
    { type: "inspect", ico: "🔍", label: "ตรวจแปลง" },
    { type: "fertilize", ico: "🌱", label: "ใส่ปุ๋ย" },
    { type: "harvest", ico: "📦", label: "เก็บเกี่ยว" },
    { type: "water", ico: "💧", label: "รดน้ำ" },
  ].map(a => `<button class="chip" onclick="App.modalTask('${today}', { type: '${a.type}', title: '${a.label}' })"><span>${a.ico}</span>${a.label}</button>`).join("");

  let extra = "";
  if (S.role === "business") {
    extra = `
      <div class="section-title">สรุปการเงิน <span class="badge badge-blue">${ROLE_META.business.label}</span></div>
      <div class="card">
        <div class="row row-between"><span class="muted">รายได้รวม (ปี 2569)</span><span class="bold">${fmtMoney(ytd.revenue)} บาท</span></div>
        <div class="row row-between mt-4"><span class="muted">ต้นทุนรวม (ปี 2569)</span><span class="bold">${fmtMoney(ytd.cost)} บาท</span></div>
        <div class="divider"></div>
        <div class="row row-between"><span class="bold">กำไรสุทธิ</span><span class="bold ${kpiProfit ? "price-trend-up" : "price-trend-down"}">${fmtMoney(ytd.net)} บาท</span></div>
        <div class="row row-between mt-4"><span class="muted">อัตรากำไร (Margin)</span><span class="bold">${ytd.margin.toFixed(1)}%</span></div>
        <button class="btn btn-primary btn-block mt-12" onclick="App.nav('analytics')">📊 ดูการวิเคราะห์เชิงลึก</button>
      </div>`;
  } else if (S.role === "large") {
    const w = S.workers;
    extra = `
      <div class="section-title">สถานะคนงาน <span class="badge badge-blue">${ROLE_META.large.label}</span></div>
      <div class="card">
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">กำลังทำงาน</div><div class="vl price-trend-up">${w.working} คน</div></div>
          <div class="meta-box"><div class="lb">พัก / รอคิว</div><div class="vl" style="color:var(--amber)">${w.resting} คน</div></div>
          <div class="meta-box"><div class="lb">ลา</div><div class="vl" style="color:var(--red)">${w.leave} คน</div></div>
          <div class="meta-box"><div class="lb">แปลง Active</div><div class="vl">${S.plots.filter(p => p.status === "active").length} แปลง</div></div>
        </div>
      </div>`;
  }

  const welcome = S.tourDone ? "" : `
    <div class="card" style="border:1.5px solid var(--green-light);background:linear-gradient(135deg,#f0fdf4,#ffffff)">
      <div class="row">
        <span style="font-size:1.7rem">✨</span>
        <div class="grow">
          <div class="bold" style="color:var(--green-deep)">ใหม่ใน v52 — หน้าตาเว็บคอมพิวเตอร์</div>
          <div class="muted">เลย์เอาต์เดสก์ท็อปเต็มรูปแบบ: เมนูข้าง, เนื้อหาหลายคอลัมน์, ปุ่มลัดมุมขวาล่าง — ยังใช้บนมือถือได้สบาย</div>
        </div>
      </div>
      <button class="btn btn-primary btn-block mt-12" onclick="App.startTour()">🚀 เริ่มแนะนำระบบ</button>
    </div>`;

  return `
    <div class="hero">
      <div class="hero-row">
        <div>
          <div class="hero-greet">สวัสดีครับ 👋</div>
          <div class="hero-sub">${thaiDateStr(new Date())} · โหมด ${ROLE_META[S.role].label}</div>
        </div>
        <span class="hero-ver">${S.version === 52 ? "อัปเดตล่าสุด v52" : "v" + S.version}</span>
      </div>
      <div class="hero-progress">
        <div class="hp-row">
          <span>ความคืบหน้างานวันนี้</span>
          <span class="hp-num">${tToday.length ? `${doneToday}/${tToday.length} เสร็จ` : "ไม่มีงาน 🎉"}</span>
        </div>
        <div class="hp-bar"><i style="width:${todayPct}%"></i></div>
      </div>
      <div class="hero-chips">${quickActs}</div>
    </div>

    ${welcome}

    <div class="section-title">ตัวเลขสำคัญ</div>
    <div class="kpi-row" id="kpiRow">
      <div class="kpi green ${kpiClass}">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">กำไรสุทธิ</div>
        <div class="kpi-value">${fmtMoney(ytd.net)}</div>
        <div class="kpi-sub">ปี 2569 · ${ytd.net >= 0 ? "กำไร" : "ขาดทุน"}</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-icon">🗺️</div>
        <div class="kpi-label">พื้นที่ (ไร่)</div>
        <div class="kpi-value">${fmtNum(area)}</div>
        <div class="kpi-sub">${S.plots.filter(p => p.status === "active").length} แปลง Active</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-icon">🌱</div>
        <div class="kpi-label">รอบปลูก</div>
        <div class="kpi-value">${cycles.length}</div>
        <div class="kpi-sub">กำลังดำเนินการ</div>
      </div>
    </div>

    ${extra}

    <div class="home-flow">
      <section class="sec-tasks">
        <div class="section-title">งานที่ต้องทำเร็วๆ นี้ ${todays.length ? `<span class="badge badge-amber">${todays.length} รายการ</span>` : ""}</div>
        <div class="card">
          ${todays.length === 0 ? `
            <div class="empty">
              <div class="e-ico">🎉</div>
              <div class="e-title">ไม่มีงานที่ต้องทำเร็วๆ นี้</div>
              <div class="muted">จดงานหรือกดตรวจแปลงได้เลย</div>
              <button class="btn btn-primary btn-sm mt-8" onclick="App.modalTask('${today}')">＋ เพิ่มงานวันนี้</button>
            </div>` : ""}
          ${todays.map(t => taskRowHtml(t, { showDate: t.date !== today })).join("")}
          ${overdue.length ? `
            <div class="row row-between mt-4" style="background:var(--red-light);border-radius:10px;padding:8px 10px">
              <span class="bold" style="color:var(--red);font-size:.8rem">⚠️ งานเลยกำหนด ${overdue.length} รายการ</span>
              <button class="btn btn-sm btn-danger-soft" onclick="App.nav('planner')">ดูเลย</button>
            </div>` : ""}
        </div>
      </section>
      <section class="sec-profit">
        <div class="section-title">กำไร/ขาดทุนรายแปลง</div>
        <div class="card" style="padding:6px 14px">
          ${plotProfits.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีแปลง Active</div>` : ""}
          ${plotProfits.map(({ p, fin }) => `
            <button class="row plot-profit" onclick="App.openPlot('${p.id}')">
              <span class="plot-emoji sm">${cropEmoji(p.crop)}</span>
              <div class="grow" style="text-align:left">
                <div class="bold" style="font-size:.88rem">${esc(p.name)} <span class="muted" style="font-weight:400;font-size:.7rem">${esc(p.crop || "")}</span></div>
                <div class="muted" style="font-size:.68rem">รายได้ ${fmtMoney(fin.revenue)} · ต้นทุน ${fmtMoney(fin.cost)}</div>
              </div>
              <div class="bold ${fin.net >= 0 ? "price-trend-up" : "price-trend-down"}" style="font-size:.95rem">${fmtMoney(fin.net)}</div>
            </button>`).join("")}
        </div>
      </section>
      <section class="sec-cal">
        <div class="row row-between section-title">
          <span>ปฏิทินงาน</span>
          <button class="btn btn-primary btn-sm" onclick="App.nav('planner')">เปิดเต็ม</button>
        </div>
        ${calCardHtml(true)}
        <div class="card">
          <div class="row row-between" style="margin-bottom:4px">
            <div class="bold" style="font-size:.9rem">📅 งานวันที่ ${selDate}</div>
            <button class="btn btn-sm btn-ghost" onclick="App.modalTask('${selDate}')">＋ เพิ่มงาน</button>
          </div>
          ${selTasks.length === 0 ? `<div class="muted" style="text-align:center;padding:10px">ไม่มีงานในวันนี้ 🎉</div>` : ""}
          ${selTasks.map(t => taskRowHtml(t)).join("")}
        </div>
      </section>
      <section class="sec-activity">
        <div class="section-title">กิจกรรมล่าสุด</div>
        <div class="card">
          ${recent.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีกิจกรรม</div>` : ""}
          ${recent.map(t => `
            <div class="row-line">
              <span class="task-ico ${esc(t.type)}">${TYPE_ICONS[t.type] || "🔧"}</span>
              <div class="grow">
                <div class="bold" style="font-size:.84rem">${esc(t.title)}</div>
                <div class="muted" style="font-size:.7rem">${t.date} ${typeTag(t)}</div>
              </div>
              ${statusTag(taskStatusOf(t))}
            </div>`).join("")}
        </div>
      </section>
    </div>

    <div class="section-title">รอบปลูกที่กำลังดำเนินการ</div>
    <div class="card">
      ${cycles.length === 0 ? `<div class="empty"><div class="e-ico">🌱</div><div class="e-title">ยังไม่มีรอบปลูก</div><div class="muted">กดเริ่มปลูกที่หน้าแปลง</div></div>` : ""}
      ${cycles.map(c => {
        const p = plotById(S, c.plotId);
        const fin = cycleFinance(S, c.id);
        return `
        <div class="row-line">
          <span class="plot-emoji sm">${cropEmoji(c.plant)}</span>
          <div class="grow">
            <div class="bold" style="font-size:.88rem">${esc(c.plant)}</div>
            <div class="muted">${p ? esc(p.name) : "—"} · อายุ ${ageDays(c.startDate)} วัน</div>
          </div>
          <div style="text-align:right">
            <div class="bold ${fin.net >= 0 ? "price-trend-up" : "price-trend-down"}" style="font-size:.82rem">${fmtMoney(fin.net)}</div>
            <div class="muted" style="font-size:.66rem">กำไร/ขาดทุน</div>
          </div>
        </div>`;
      }).join("")}
      <button class="btn btn-ghost btn-block mt-12" onclick="App.goCycles()">🌱 + เริ่มปลูกพืชใหม่</button>
    </div>`;
}

/* ---------------- Plots & cycles ---------------- */
function renderPlots() {
  const active = S.plots.filter(p => p.status === "active");
  const inactive = S.plots.filter(p => p.status !== "active");
  const cycles = [...S.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const plotsTab = `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem">แผนที่แปลง ${active.length}/${S.plots.length}</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalPlot()">＋ แปลงใหม่</button>
    </div>
    <div class="muted mt-4" style="font-size:.72rem">📍 ปักหมุดพิกัด GPS ทุกแปลง เพื่อให้ระบบดึงข้อมูลสภาพอากาศได้แม่นยำ (เร็วๆ นี้)</div>
    <div class="card-grid">
    ${[...active, ...inactive].map(p => {
      const c = S.cycles.find(x => x.plotId === p.id && x.status === "active");
      return `
      <div class="card plot-card">
        <div class="plot-top clickable" onclick="App.openPlot('${p.id}')">
          <div class="plot-emoji">${cropEmoji(p.crop)}</div>
          <div class="grow">
            <div class="plot-name">${esc(p.name)} ${p.status === "active" ? `<span class="badge badge-green">Active</span>` : `<span class="badge badge-gray">ว่าง</span>`}</div>
            <div class="muted">${esc(p.crop || "ยังไม่ระบุพืช")}</div>
          </div>
          <span class="muted" style="font-size:1.1rem">›</span>
        </div>
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">ขนาดพื้นที่</div><div class="vl">${fmtNum(p.sizeRai)} ไร่</div></div>
          <div class="meta-box"><div class="lb">พิกัด GPS</div><div class="vl" style="font-size:.72rem">${p.lat}, ${p.lng}</div></div>
          <div class="meta-box"><div class="lb">รอบล่าสุด</div><div class="vl" style="font-size:.78rem">${c ? esc(c.plant) : "—"}</div></div>
          <div class="meta-box"><div class="lb">อายุรอบ</div><div class="vl">${c ? ageDays(c.startDate) + " วัน" : "—"}</div></div>
        </div>
        <div class="actions-row">
          <button class="btn btn-sm btn-ghost" onclick="App.openPlot('${p.id}')">👁️ ดูรายละเอียด</button>
          <button class="btn btn-sm btn-outline" onclick="App.modalPlot('${p.id}')">✏️ แก้ไข</button>
          ${c ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">🌱 เริ่มปลูก</button>`}
          <button class="btn btn-sm btn-danger-soft" onclick="App.deletePlot('${p.id}')">🗑</button>
        </div>
      </div>`;
    }).join("")}
    </div>`;

  const cyclesTab = `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem">รอบการปลูก ${cycles.filter(c => c.status === "active").length} รอบ</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalCycle()">🌱 + เริ่มปลูก</button>
    </div>
    <div class="card-grid">
    ${cycles.map(c => {
      const p = plotById(S, c.plotId);
      const fin = cycleFinance(S, c.id);
      return `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">${cropEmoji(c.plant)}</div>
          <div class="grow">
            <div class="plot-name">${esc(c.plant)}</div>
            <div class="muted">${p ? esc(p.name) : "แปลงถูกลบ"} · เริ่ม ${c.startDate} · อายุ ${ageDays(c.startDate)} วัน</div>
          </div>
          ${c.status === "active" ? `<span class="badge badge-green">กำลังปลูก</span>` : `<span class="badge badge-gray">ปิดรอบ</span>`}
        </div>
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">ต้นทุนรวม</div><div class="vl">${fmtMoney(fin.cost)} บาท</div></div>
          <div class="meta-box"><div class="lb">รายรับรวม</div><div class="vl">${fmtMoney(fin.revenue)} บาท</div></div>
          <div class="meta-box"><div class="lb">กำไร/ขาดทุน</div><div class="vl ${fin.net >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(fin.net)} บาท</div></div>
          <div class="meta-box"><div class="lb">สถานะ</div><div class="vl" style="font-size:.78rem">${fin.revenue > 0 ? "มีผลผลิตแล้ว 🎉" : "รอผลผลิต"}</div></div>
        </div>
        ${c.status === "active" ? `<button class="btn btn-sm btn-ghost mt-12" onclick="App.completeCycle('${c.id}')">✅ ปิดรอบการปลูก</button>` : ""}
      </div>`;
    }).join("")}
    </div>`;

  return `
    <div class="tabs">
      <button class="${route.tab === "plots" ? "active" : ""}" onclick="App.plotsTab('plots')">🗺️ แปลง</button>
      <button class="${route.tab === "cycles" ? "active" : ""}" onclick="App.plotsTab('cycles')">🌱 รอบปลูก</button>
    </div>
    ${route.tab === "cycles" ? cyclesTab : plotsTab}`;
}
App.plotsTab = function (tab) { route.tab = tab; render(); };
App.goCycles = function () { route.view = "plots"; route.tab = "cycles"; render(); };
App.goPlots = function () { route.view = "plots"; route.tab = "plots"; render(); };

/* ---------------- Plot detail ---------------- */
function renderPlotDetail() {
  const p = plotById(S, route.plotId);
  if (!p) { route.view = "plots"; return renderPlots(); }
  const fin = plotFinance(S, p.id);
  const cycles = S.cycles.filter(c => c.plotId === p.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const tasks = S.tasks.filter(t => t.plotId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const activeCycle = cycles.find(c => c.status === "active");
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn btn-sm btn-ghost" onclick="App.goPlots()">← กลับไปแปลงทั้งหมด</button>
    </div>
    <div class="card">
      <div class="plot-top">
        <div class="plot-emoji">${cropEmoji(p.crop)}</div>
        <div class="grow">
          <div class="plot-name">${esc(p.name)} ${p.status === "active" ? `<span class="badge badge-green">Active</span>` : `<span class="badge badge-gray">ว่าง</span>`}</div>
          <div class="muted">${esc(p.crop || "ยังไม่ระบุพืช")}</div>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><div class="lb">ขนาดพื้นที่</div><div class="vl">${fmtNum(p.sizeRai)} ไร่</div></div>
        <div class="meta-box"><div class="lb">พิกัด GPS</div><div class="vl" style="font-size:.72rem">${p.lat}, ${p.lng}</div></div>
        <div class="meta-box"><div class="lb">รอบที่กำลังปลูก</div><div class="vl" style="font-size:.78rem">${activeCycle ? esc(activeCycle.plant) : "—"}</div></div>
        <div class="meta-box"><div class="lb">จำนวนรอบ</div><div class="vl">${cycles.length} รอบ</div></div>
      </div>
      <div class="actions-row">
        <button class="btn btn-sm btn-outline" onclick="App.modalPlot('${p.id}')">✏️ แก้ไขแปลง</button>
        ${activeCycle ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">🌱 เริ่มปลูก</button>`}
        <button class="btn btn-sm btn-primary" onclick="App.modalTask(todayISO(), { plotId: '${p.id}' })">＋ เพิ่มงาน</button>
      </div>
    </div>

    <div class="section-title">กำไร/ขาดทุนของแปลงนี้</div>
    <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none">
      <div class="row row-between">
        <div>
          <div style="font-size:.75rem;opacity:.85">กำไรสุทธิ (รวมทุกรอบ)</div>
          <div class="bold" style="font-size:1.5rem">${fmtMoney(fin.net)} บาท</div>
          <div style="font-size:.7rem;opacity:.85">รายได้ ${fmtMoney(fin.revenue)} · ต้นทุน ${fmtMoney(fin.cost)}</div>
        </div>
        <span style="font-size:2.2rem">${fin.net >= 0 ? "📈" : "📉"}</span>
      </div>
    </div>

    <div class="section-title">รอบการปลูก (${cycles.length})</div>
    ${cycles.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">🌱</div><div class="e-title">ยังไม่มีรอบการปลูก</div><div class="muted">กด 🌱 เริ่มปลูก ได้เลย</div></div></div>` : ""}
    <div class="card-grid">
    ${cycles.map(c => {
      const cf = cycleFinance(S, c.id);
      return `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">${cropEmoji(c.plant)}</div>
          <div class="grow">
            <div class="plot-name">${esc(c.plant)}</div>
            <div class="muted">เริ่ม ${c.startDate} · อายุ ${ageDays(c.startDate)} วัน</div>
          </div>
          ${c.status === "active" ? `<span class="badge badge-green">กำลังปลูก</span>` : `<span class="badge badge-gray">ปิดรอบ</span>`}
        </div>
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">รายรับ</div><div class="vl">${fmtMoney(cf.revenue)} บาท</div></div>
          <div class="meta-box"><div class="lb">ต้นทุน</div><div class="vl">${fmtMoney(cf.cost)} บาท</div></div>
          <div class="meta-box"><div class="lb">กำไร/ขาดทุน</div><div class="vl ${cf.net >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(cf.net)} บาท</div></div>
          <div class="meta-box"><div class="lb">สถานะ</div><div class="vl" style="font-size:.78rem">${cf.revenue > 0 ? "มีผลผลิตแล้ว 🎉" : "รอผลผลิต"}</div></div>
        </div>
        ${c.status === "active" ? `<button class="btn btn-sm btn-ghost mt-12" onclick="App.completeCycle('${c.id}')">✅ ปิดรอบการปลูก</button>` : ""}
      </div>`;
    }).join("")}
    </div>

    <div class="section-title">งาน/กิจกรรมของแปลงนี้ (${tasks.length})</div>
    <div class="card">
      ${tasks.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีบันทึกงาน — กด + เพิ่มงาน ได้เลย</div>` : ""}
      ${tasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true })).join("")}
    </div>`;
}
App.openPlot = function (id) { route.view = "plotDetail"; route.plotId = id; render(); };

App.deletePlot = function (id) {
  App.confirm("ลบแปลงนี้?", "รอบการปลูกของแปลงนี้จะถูกลบด้วย ต้องการดำเนินการต่อหรือไม่?", () => {
    S.plots = S.plots.filter(p => p.id !== id);
    S.cycles = S.cycles.filter(c => c.plotId !== id);
    saveState(S);
    render();
    toast("ลบแปลงแล้ว");
  });
};
App.completeCycle = function (id) {
  const c = cycleById(S, id);
  if (c) c.status = "done";
  saveState(S);
  render();
  toast("ปิดรอบการปลูกเรียบร้อย ✅");
};
App.toggleTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  toggleTaskDone(S, id);
  saveState(S);
  rerender();
  toast(t.status === "done" ? `เสร็จแล้ว: ${t.title} ✅` : `ยกเลิก: ${t.title}`);
};

/* ---------------- Stock ---------------- */
function renderStock() {
  const total = totalStockValue(S);
  return `
    <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none">
      <div class="row row-between">
        <div>
          <div style="font-size:.76rem;opacity:.85">มูลค่าสต็อกทั้งหมด</div>
          <div class="bold" style="font-size:1.5rem">${fmtMoney(total)} บาท</div>
        </div>
        <span style="font-size:2rem">📦</span>
      </div>
    </div>
    <div class="row row-between section-title">
      <span>รายการวัสดุ (${S.stock.length})</span>
      <button class="btn btn-primary btn-sm" onclick="App.modalStock()">＋ เพิ่มรายการ</button>
    </div>
    <div class="card-grid">
    ${S.stock.map(x => `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">🧺</div>
          <div class="grow">
            <div class="plot-name">${esc(x.name)}</div>
            <div class="muted">ต้นทุนถัวเฉลี่ย ${fmtMoney(x.avgCost)} บาท/${x.unit}</div>
          </div>
          <div class="stock-qty">${fmtNum(x.qty)} <small>${esc(x.unit)}</small></div>
        </div>
        <div class="row row-between mt-8">
          <div class="muted">มูลค่ารวม <span class="bold">${fmtMoney(x.qty * x.avgCost)} บาท</span></div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-primary" onclick="App.modalReceive('${x.id}')">⬇️ รับของเข้า</button>
            <button class="btn btn-sm btn-outline" onclick="App.modalDeduct('${x.id}')">➖ ตัดสต็อก</button>
            <button class="btn btn-sm btn-danger-soft" onclick="App.deleteStock('${x.id}')">🗑</button>
          </div>
        </div>
      </div>`).join("")}
    </div>
    <div class="muted" style="font-size:.72rem;text-align:center;padding:6px">💡 วิธีคิดต้นทุนแบบถัวเฉลี่ยถ่วงน้ำหนัก (Weighted Average) เพื่อความแม่นยำทางบัญชี</div>`;
}
App.deleteStock = function (id) {
  App.confirm("ลบรายการวัสดุ?", "", () => {
    S.stock = S.stock.filter(x => x.id !== id);
    saveState(S);
    render();
    toast("ลบรายการแล้ว");
  });
};

/* ---------------- Planner / calendar ---------------- */
function renderPlanner() {
  const { sel } = cal;
  const selTasks = sel ? tasksOn(S, sel).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0)) : [];

  return `
    ${calCardHtml()}

    <div class="row row-between section-title">
      <span>${sel ? "งานวันที่ " + sel : "กดวันที่เพื่อดูงาน"}</span>
      ${sel ? `<button class="btn btn-primary btn-sm" onclick="App.modalTask('${sel}')">＋ เพิ่มงาน</button>` : ""}
    </div>
    <div class="card">
      ${!sel ? `<div class="muted" style="text-align:center;padding:10px">เลือกวันที่ในปฏิทินด้านบน 👆</div>` : ""}
      ${selTasks.length === 0 && sel ? `<div class="empty"><div class="e-ico">📅</div><div class="e-title">ไม่มีงานในวันนี้</div><div class="muted">กด + เพิ่มงาน เพื่อวางแผน</div></div>` : ""}
      ${selTasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true })).join("")}
    </div>
    <div class="muted" style="font-size:.72rem;text-align:center">🔄 เมื่อบันทึกงานที่ใช้วัสดุ (เช่น ใส่ปุ๋ย) ระบบจะตัดสต็อกและบันทึกต้นทุนเข้าสู่รอบปลูกทันที</div>`;
}
App.pickDay = function (d) {
  if (d) cal.sel = d;
  rerender();
};
App.calMove = function (dir) {
  cal.m = cal.m + dir;
  if (cal.m < 0) { cal.m = 11; cal.y--; }
  if (cal.m > 11) { cal.m = 0; cal.y++; }
  cal.sel = null;
  rerender();
};
App.deleteTask = function (id) {
  S.tasks = S.tasks.filter(t => t.id !== id);
  saveState(S);
  render();
  toast("ลบงานแล้ว");
};

/* ---------------- Analytics ---------------- */
function renderAnalytics() {
  const ytd = ytdFinance(S);
  const months = monthlySeries(S, todayISO().slice(0, 4));
  const crops = cropMargins(S);
  const costs = costBreakdown(S);
  const totalCost = costs.reduce((a, c) => a + c.value, 0);
  const costRev = costs.map(c => ({ ...c, pct: totalCost ? (c.value / totalCost * 100).toFixed(0) : 0 }));

  return `
    <div class="section-title">ภาพรวมปี 2569</div>
    <div class="kpi-row">
      <div class="kpi green"><div class="kpi-icon">💰</div><div class="kpi-label">รายได้</div><div class="kpi-value">${fmtMoney(ytd.revenue)}</div><div class="kpi-sub">บาท</div></div>
      <div class="kpi amber"><div class="kpi-icon">🧾</div><div class="kpi-label">ต้นทุน</div><div class="kpi-value">${fmtMoney(ytd.cost)}</div><div class="kpi-sub">บาท</div></div>
      <div class="kpi blue ${ytd.net >= 0 ? "pos" : "neg"}"><div class="kpi-icon">📈</div><div class="kpi-label">กำไรสุทธิ</div><div class="kpi-value">${fmtMoney(ytd.net)}</div><div class="kpi-sub">Margin ${ytd.margin.toFixed(1)}%</div></div>
    </div>

    <div class="section-title">สรุปผลประกอบการรายปี (กำไรรายเดือน)</div>
    <div class="card">
      <div class="chart-wrap" id="chartYear"></div>
      <div class="muted mt-8" style="font-size:.72rem">เทียบเทรนด์กำไรเดือนต่อเดือน · เขียว = กำไร แดง = ขาดทุน</div>
    </div>

    <div class="section-title">วิเคราะห์กำไรตามพืช (Margin %)</div>
    <div class="card">
      <div class="chart-wrap" id="chartCrop"></div>
      <div class="legend-list">
        ${crops.map(c => {
          const margin = c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue * 100).toFixed(0) : 0;
          const note = c.revenue === 0 ? " (ยังไม่มีรายได้)" : "";
          return `<div class="li"><span class="sw" style="background:var(--green)"></span><span>${cropEmoji(c.crop)} ${esc(c.crop)}${note}</span><span class="val">${margin}%</span></div>`;
        }).join("")}
      </div>
    </div>

    <div class="section-title">ต้นทุนเชิงลึก (เงินจมอยู่ที่ไหน?)</div>
    <div class="card">
      <div class="chart-wrap" id="chartCost"></div>
      <div class="legend-list">
        ${costRev.map(c => `<div class="li"><span class="sw" style="background:${c.color}"></span><span>${esc(c.label)}</span><span class="val">${fmtMoney(c.value)} บาท (${c.pct}%)</span></div>`).join("")}
      </div>
    </div>`;
}

/* ---------------- Equipment ---------------- */
function renderEquipment() {
  const years = d => Math.max(0, daysBetween(d, todayISO()) / 365.25);
  return `
    <div class="row row-between section-title">
      <span>อุปกรณ์ / เครื่องจักร (${S.equipment.length})</span>
      <button class="btn btn-primary btn-sm" onclick="App.modalEquipment()">＋ เพิ่มอุปกรณ์</button>
    </div>
    <div class="muted" style="font-size:.72rem;margin-bottom:10px">💡 ติดตามค่าเสื่อมราคาและประวัติการซ่อมบำรุงของเครื่องจักรทุกชิ้น</div>
    <div class="card-grid">
    ${S.equipment.map(e => {
      const yrs = years(e.purchaseDate);
      const dep = e.cost / e.lifespan;
      const value = Math.max(0, e.cost - dep * yrs);
      return `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">🚜</div>
          <div class="grow">
            <div class="plot-name">${esc(e.name)} <span class="badge badge-blue">${esc(e.type)}</span></div>
            <div class="muted">ซื้อเมื่อ ${e.purchaseDate} · อายุใช้งาน ${yrs.toFixed(1)} ปี / ${e.lifespan} ปี</div>
          </div>
        </div>
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">ราคาซื้อ</div><div class="vl">${fmtMoney(e.cost)} บาท</div></div>
          <div class="meta-box"><div class="lb">ค่าเสื่อม/ปี</div><div class="vl">${fmtMoney(dep)} บาท</div></div>
          <div class="meta-box"><div class="lb">มูลค่าปัจจุบัน</div><div class="vl price-trend-up">${fmtMoney(value)} บาท</div></div>
          <div class="meta-box"><div class="lb">สถานะ</div><div class="vl">${value > 0 ? "ใช้งานได้" : "หมดอายุ"}</div></div>
        </div>
        <div class="actions-row">
          <button class="btn btn-sm btn-ghost">🔧 บันทึกซ่อมบำรุง</button>
          <button class="btn btn-sm btn-danger-soft" onclick="App.deleteEquipment('${e.id}')">🗑</button>
        </div>
      </div>`;
    }).join("")}
    </div>`;
}
App.deleteEquipment = function (id) {
  App.confirm("ลบอุปกรณ์นี้?", "", () => {
    S.equipment = S.equipment.filter(e => e.id !== id);
    saveState(S);
    render();
    toast("ลบอุปกรณ์แล้ว");
  });
};

/* ---------------- IoT ---------------- */
function renderIoT() {
  return `
    <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#172554);color:#fff;border:none">
      <div class="row">
        <span style="font-size:2rem">📡</span>
        <div class="grow">
          <div class="bold" style="font-size:1rem">ระบบควบคุมน้ำ IoT</div>
          <div style="font-size:.76rem;opacity:.85">สั่งเปิด-ปิดวาล์วจากทุกที่ · รองรับ Valve ID และ Sonoff DIY</div>
        </div>
      </div>
    </div>
    <div class="section-title">วาล์ว / ปั๊มน้ำ (${S.valves.length})</div>
    <div class="card-grid">
    ${S.valves.map(v => `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">💧</div>
          <div class="grow">
            <div class="plot-name">${esc(v.name)}</div>
            <div class="muted">${esc(v.zone)} · ${v.state === "on" ? `<span class="badge badge-green">เปิดอยู่</span>` : `<span class="badge badge-gray">ปิด</span>`}</div>
          </div>
          <button class="switch ${v.state === "on" ? "on" : ""}" onclick="App.toggleValve('${v.id}')" aria-label="สลับเปิดปิด"></button>
        </div>
        <div class="row row-between mt-8">
          <div class="grow">
            <div class="muted" style="font-size:.72rem">กำหนดการทำงาน</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
              ${v.schedule.length === 0 ? `<span class="muted" style="font-size:.74rem">ยังไม่มีกำหนดการ</span>` : v.schedule.map(s => `<span class="badge badge-blue">🕐 ${s.start}–${s.end}</span>`).join("")}
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="App.modalValve('${v.id}')">⏰ ตั้งเวลา</button>
        </div>
      </div>`).join("")}
    </div>
    <div class="muted" style="font-size:.72rem;text-align:center;padding:6px">⚙️ ตั้งเวลาล่วงหน้า (Schedule) หรือควบคุมตามปริมาณน้ำ (Volume Control) — เร็วๆ นี้</div>`;
}
App.toggleValve = function (id) {
  const v = S.valves.find(x => x.id === id);
  if (!v) return;
  v.state = v.state === "on" ? "off" : "on";
  saveState(S);
  render();
  toast(v.state === "on" ? `เปิด ${v.name} 💧` : `ปิด ${v.name}`);
};

/* ---------------- Settings ---------------- */
function renderSettings() {
  return `
    <div class="section-title">ตั้งค่าระบบ</div>
    <div class="card">
      <div class="row">
        <div class="plot-emoji">🌾</div>
        <div class="grow">
          <div class="plot-name">เกษตรภูมิใจ v52</div>
          <div class="muted">ระบบจัดการฟาร์มอัจฉริยะ · ออกแบบเป็นเว็บคอมพิวเตอร์ ใช้งานง่ายทั้งจอใหญ่และจอเล็ก</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="row row-between"><span class="muted">ข้อมูลทั้งหมด</span><span class="small bold">บันทึกในเบราว์เซอร์ (LocalStorage)</span></div>
      <div class="row row-between mt-8"><span class="muted">โหมดเริ่มต้น</span><span class="small bold">${ROLE_META[S.role].label}</span></div>
      <div class="row row-between mt-8"><span class="muted">เวอร์ชัน</span><span class="small bold">v${S.version}</span></div>
    </div>
    <button class="btn btn-ghost btn-block" onclick="App.startTour()">✨ แนะนำระบบ (Tour) อีกครั้ง</button>
    <button class="btn btn-danger-soft btn-block mt-8" onclick="App.resetData()">🔄 รีเซ็ตข้อมูลทั้งหมด</button>
    <div class="muted mt-8" style="font-size:.7rem;text-align:center">📍 ระบบจะเชื่อมข้อมูลสภาพอากาศและ IoT จริงในเวอร์ชันถัดไป</div>`;
}
App.resetData = function () {
  App.confirm("รีเซ็ตข้อมูลทั้งหมด?", "ข้อมูลที่บันทึกไว้ทั้งหมดจะกลับไปเป็นข้อมูลตัวอย่าง ต้องการดำเนินการต่อหรือไม่?", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
};

/* ---------------- More ---------------- */
function renderMore() {
  return `
    <div class="section-title">เมนูเพิ่มเติม</div>
    <div class="more-grid">
      <button class="more-card" onclick="App.nav('equipment')"><span class="mc-ico">🚜</span><span class="mc-name">จัดการอุปกรณ์</span><span class="mc-desc">เครื่องจักร ค่าเสื่อมราคา ซ่อมบำรุง</span></button>
      <button class="more-card" onclick="App.nav('iot')"><span class="mc-ico">📡</span><span class="mc-name">ควบคุมน้ำ IoT</span><span class="mc-desc">วาล์ว ปั๊ม ตั้งเวลาอัตโนมัติ</span></button>
      <button class="more-card" onclick="App.nav('settings')"><span class="mc-ico">⚙️</span><span class="mc-name">ตั้งค่า</span><span class="mc-desc">ข้อมูลระบบ รีเซ็ต ทัวร์</span></button>
      <button class="more-card" onclick="App.startTour()"><span class="mc-ico">🧭</span><span class="mc-name">แนะนำระบบ</span><span class="mc-desc">ทัวร์หน้าจอทีละขั้นตอน</span></button>
    </div>
    <div class="card mt-12">
      <div class="bold" style="font-size:.9rem">📋 เกี่ยวกับ v52</div>
      <ul style="margin:8px 0 0 18px;font-size:.8rem;color:var(--muted);line-height:1.9">
        <li>หน้าตาเว็บคอมพิวเตอร์: เมนูข้าง + เนื้อหา 2 คอลัมน์ อ่านง่ายบนจอกว้าง</li>
        <li>ปุ่มลัด (FAB) มุมขวาล่าง บันทึกงานได้ทันทีทั้งคอมและมือถือ</li>
        <li>ระบบแนะนำ (Interactive Tour) ทีละขั้นตอน</li>
        <li>รอบการปลูกแยกต้นทุนรายรอบ + ตัดสต็อกอัตโนมัติ</li>
      </ul>
    </div>`;
}

/* ---------------- Modals ---------------- */
function openModal(html) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  const bd = root.querySelector(".modal-backdrop");
  bd.addEventListener("click", e => { if (e.target === bd) closeModal(); });
}
function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}
function confirmModal(title, text, onOk) {
  openModal(`
    <h3>${esc(title)}</h3>
    <div class="modal-sub">${esc(text || "")}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" id="confirmOk">ยืนยัน</button>
    </div>`);
  document.getElementById("confirmOk").addEventListener("click", () => { closeModal(); onOk(); });
}
App.closeModal = closeModal;
App.confirm = confirmModal;

/* ---- plot form ---- */
App.modalPlot = function (id) {
  const p = id ? plotById(S, id) : null;
  const lat = p ? p.lat : 14.9823;
  const lng = p ? p.lng : 100.4582;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${p ? "อัปเกรด / แก้ไขแปลง" : "เพิ่มแปลงใหม่"}</h3>
    <div class="modal-sub">${p ? "ปรับปรุงข้อมูลแปลงและพิกัด GPS" : "สร้างแผนที่ดิจิทัลของฟาร์ม ระบุชื่อ ขนาด และปักหมุดพิกัด GPS"}</div>
    <form onsubmit="return App.submitPlot(event, '${id || ""}')">
      <div class="field"><label>ชื่อแปลง *</label><input id="f_name" value="${p ? esc(p.name) : ""}" placeholder="เช่น แปลง A" required></div>
      <div class="field"><label>พืชที่ปลูก</label><input id="f_crop" value="${p ? esc(p.crop || "") : ""}" placeholder="เช่น ข้าวโพดหวาน"></div>
      <div class="field"><label>ขนาดพื้นที่ (ไร่) *</label><input id="f_size" type="number" min="0.5" step="0.5" value="${p ? p.sizeRai : ""}" placeholder="เช่น 25" required></div>
      <div class="field">
        <label>สถานะ</label>
        <select id="f_status">
          <option value="active" ${p && p.status !== "active" ? "" : "selected"}>Active (ใช้งาน)</option>
          <option value="inactive" ${p && p.status !== "active" ? "selected" : ""}>ว่าง / ไม่ใช้งาน</option>
        </select>
      </div>
      <div class="field">
        <label>📍 พิกัด GPS (ปักหมุด)</label>
        <div class="row" style="gap:8px">
          <input id="f_lat" type="number" step="0.0001" value="${lat}" style="flex:1" placeholder="ละติจูด">
          <input id="f_lng" type="number" step="0.0001" value="${lng}" style="flex:1" placeholder="ลองจิจูด">
        </div>
        <div class="hint">ระบบจะใช้พิกัดนี้ดึงข้อมูลสภาพอากาศในอนาคต</div>
        <button type="button" class="btn btn-sm btn-ghost mt-8" onclick="App.useGps()">🛰️ ใช้ตำแหน่งจริงของฉัน</button>
      </div>
      <div class="gps-box" id="gpsPreview"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${p ? "บันทึกการแก้ไข" : "สร้างแปลง"}</button>
      </div>
    </form>`);
  const update = () => {
    const la = parseFloat(document.getElementById("f_lat").value) || 14.9823;
    const ln = parseFloat(document.getElementById("f_lng").value) || 100.4582;
    document.getElementById("gpsPreview").innerHTML =
      `<div class="gps-coords">📍 ${la.toFixed(4)}, ${ln.toFixed(4)}</div>
       <div class="muted" style="font-size:.7rem">ตัวอย่างแผนที่ — ระบบจะเชื่อมแผนที่จริงในเวอร์ชันถัดไป</div>`;
  };
  ["f_lat", "f_lng"].forEach(n => {
    const el = document.getElementById(n);
    el.addEventListener("input", update);
  });
  update();
};
App.useGps = function () {
  if (!navigator.geolocation) { toast("เบราว์เซอร์นี้ไม่รองรับ GPS"); return; }
  toast("กำลังระบุตำแหน่ง...");
  navigator.geolocation.getCurrentPosition(
    pos => {
      document.getElementById("f_lat").value = pos.coords.latitude.toFixed(6);
      document.getElementById("f_lng").value = pos.coords.longitude.toFixed(6);
      document.getElementById("f_lat").dispatchEvent(new Event("input"));
      toast("ปักหมุดตำแหน่งปัจจุบันแล้ว 📍");
    },
    () => toast("ไม่สามารถระบุตำแหน่งได้ (อนุญาตการเข้าถึงตำแหน่งก่อน)"),
    { timeout: 8000 }
  );
};
App.submitPlot = function (e, id) {
  e.preventDefault();
  const name = document.getElementById("f_name").value.trim();
  const crop = document.getElementById("f_crop").value.trim();
  const size = parseFloat(document.getElementById("f_size").value);
  const status = document.getElementById("f_status").value;
  const lat = parseFloat(document.getElementById("f_lat").value);
  const lng = parseFloat(document.getElementById("f_lng").value);
  if (!name || !size) return false;
  if (id) {
    const p = plotById(S, id);
    Object.assign(p, { name, crop, sizeRai: size, status, lat, lng });
    toast("อัปเกรดแปลงเรียบร้อย ✨");
  } else {
    S.plots.push({ id: uid(), name, crop, sizeRai: size, status, lat, lng });
    toast("สร้างแปลงใหม่แล้ว 🗺️");
  }
  saveState(S);
  closeModal();
  render();
  return false;
};

/* ---- cycle form ---- */
App.modalCycle = function (plotId) {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>เริ่มรอบการปลูกใหม่</h3>
    <div class="modal-sub">ข้อมูลทุกอย่างจะถูกจัดเก็บแยกตามรอบนี้ ระบบเริ่มนับอายุและติดตามต้นทุนทันที</div>
    <form onsubmit="return App.submitCycle(event)">
      <div class="field"><label>แปลง *</label><select id="f_plot" required>
        ${S.plots.map(p => `<option value="${p.id}" ${p.id === plotId ? "selected" : ""}>${esc(p.name)} — ${fmtNum(p.sizeRai)} ไร่</option>`).join("")}
      </select></div>
      <div class="field"><label>ชื่อพืช / รอบ *</label><input id="f_plant" placeholder="เช่น ข้าวโพด รุ่น 1/66 แปลง A" required></div>
      <div class="field"><label>วันที่เริ่ม *</label><input id="f_start" type="date" value="${todayISO()}" required></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">เริ่มปลูก</button>
      </div>
    </form>`);
};
App.submitCycle = function (e) {
  e.preventDefault();
  const plotId = document.getElementById("f_plot").value;
  const plant = document.getElementById("f_plant").value.trim();
  const start = document.getElementById("f_start").value;
  if (!plant) return false;
  S.cycles.push({ id: uid(), plotId, plant, startDate: start, status: "active" });
  saveState(S);
  closeModal();
  render();
  toast("เริ่มรอบปลูกแล้ว 🌱");
  return false;
};

/* ---- stock forms ---- */
App.modalStock = function () {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>เพิ่มรายการวัสดุ</h3>
    <div class="modal-sub">เช่น ปุ๋ย ยา เมล็ดพันธุ์ พร้อมหน่วยนับ</div>
    <form onsubmit="return App.submitStock(event)">
      <div class="field"><label>ชื่อสินค้า *</label><input id="s_name" placeholder="เช่น ปุ๋ยเคมี สูตร 46-0-0" required></div>
      <div class="field"><label>หน่วยนับ *</label><input id="s_unit" placeholder="เช่น ถุง / ขวด / ลิตร / กิโลกรัม" required></div>
      <div class="field"><label>จำนวนเริ่มต้น</label><input id="s_qty" type="number" min="0" value="0"></div>
      <div class="field"><label>ต้นทุนต่อหน่วย (บาท)</label><input id="s_price" type="number" min="0" step="0.5" value="0"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">เพิ่มรายการ</button>
      </div>
    </form>`);
};
App.submitStock = function (e) {
  e.preventDefault();
  const name = document.getElementById("s_name").value.trim();
  const unit = document.getElementById("s_unit").value.trim();
  if (!name || !unit) return false;
  S.stock.push({
    id: uid(), name, unit,
    qty: Number(document.getElementById("s_qty").value) || 0,
    avgCost: Number(document.getElementById("s_price").value) || 0
  });
  saveState(S);
  closeModal();
  render();
  toast("เพิ่มรายการวัสดุแล้ว 📦");
  return false;
};
App.modalReceive = function (id) {
  const item = stockById(S, id);
  if (!item) return;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>รับของเข้า — ${esc(item.name)}</h3>
    <div class="modal-sub">บันทึกต้นทุนการซื้อ ระบบคำนวณต้นทุนถัวเฉลี่ย (Weighted Average) ให้อัตโนมัติ</div>
    <form onsubmit="return App.submitReceive(event, '${id}')">
      <div class="field"><label>จำนวนที่รับเข้า * (${esc(item.unit)})</label><input id="r_qty" type="number" min="1" required></div>
      <div class="field"><label>ราคาต่อหน่วย (บาท) *</label><input id="r_price" type="number" min="0" step="0.5" required></div>
      <div class="field" style="background:var(--green-soft);border-radius:10px;padding:10px">
        <div class="row row-between"><span class="muted">ต้นทุนถัวเฉลี่ยเดิม</span><span class="bold">${fmtMoney(item.avgCost)} บาท/${esc(item.unit)}</span></div>
        <div class="row row-between mt-4"><span class="muted">จำนวนคงเหลือเดิม</span><span class="bold">${fmtNum(item.qty)} ${esc(item.unit)}</span></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">บันทึกการรับเข้า</button>
      </div>
    </form>`);
};
App.submitReceive = function (e, id) {
  e.preventDefault();
  const qty = Number(document.getElementById("r_qty").value);
  const price = Number(document.getElementById("r_price").value);
  receiveStock(S, id, qty, price);
  const item = stockById(S, id);
  saveState(S);
  closeModal();
  render();
  toast(`รับของเข้าแล้ว · ต้นทุนถัวเฉลี่ยใหม่ ${fmtMoney(item.avgCost)} บาท/${item.unit} ⬇️`);
  return false;
};
App.modalDeduct = function (id) {
  const item = stockById(S, id);
  if (!item) return;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>ตัดสต็อก — ${esc(item.name)}</h3>
    <div class="modal-sub">คงเหลือ ${fmtNum(item.qty)} ${esc(item.unit)} · ต้นทุน ${fmtMoney(item.avgCost)} บาท/${esc(item.unit)}</div>
    <form onsubmit="return App.submitDeduct(event, '${id}')">
      <div class="field"><label>จำนวนที่ตัด * (${esc(item.unit)})</label><input id="d_qty" type="number" min="1" max="${item.qty}" required></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">ตัดสต็อก</button>
      </div>
    </form>`);
};
App.submitDeduct = function (e, id) {
  e.preventDefault();
  const qty = Number(document.getElementById("d_qty").value);
  deductStock(S, id, qty);
  saveState(S);
  closeModal();
  render();
  toast("ตัดสต็อกแล้ว ➖");
  return false;
};

/* ---- equipment form ---- */
App.modalEquipment = function () {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>เพิ่มอุปกรณ์ / เครื่องจักร</h3>
    <div class="modal-sub">ติดตามค่าเสื่อมราคาและประวัติซ่อมบำรุง</div>
    <form onsubmit="return App.submitEquipment(event)">
      <div class="field"><label>ชื่ออุปกรณ์ *</label><input id="e_name" placeholder="เช่น รถไถนา" required></div>
      <div class="field"><label>ประเภท</label><select id="e_type">
        <option>เครื่องจักร</option><option>อุปกรณ์</option><option>ยานพาหนะ</option><option>อื่นๆ</option>
      </select></div>
      <div class="field"><label>วันที่ซื้อ *</label><input id="e_date" type="date" required></div>
      <div class="field"><label>ราคาซื้อ (บาท) *</label><input id="e_cost" type="number" min="0" required></div>
      <div class="field"><label>อายุการใช้งาน (ปี) *</label><input id="e_life" type="number" min="1" value="10" required></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">ลงทะเบียนอุปกรณ์</button>
      </div>
    </form>`);
};
App.submitEquipment = function (e) {
  e.preventDefault();
  const name = document.getElementById("e_name").value.trim();
  if (!name) return false;
  S.equipment.push({
    id: uid(), name,
    type: document.getElementById("e_type").value,
    purchaseDate: document.getElementById("e_date").value,
    cost: Number(document.getElementById("e_cost").value) || 0,
    lifespan: Number(document.getElementById("e_life").value) || 10
  });
  saveState(S);
  closeModal();
  render();
  toast("ลงทะเบียนอุปกรณ์แล้ว 🚜");
  return false;
};

/* ---- task form (used by FAB + planner) ---- */
App.modalTask = function (date, preset) {
  preset = preset || {};
  const type = preset.type || "work";
  const title = preset.title || "";
  const d = date || todayISO();
  const actCycles = activeCycles(S);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${preset.title ? esc(preset.title) : "เพิ่มงาน"}</h3>
    <div class="modal-sub">${preset.title ? "ทางลัดบันทึกข้อมูลได้รวดเร็วด้วยมือเดียว" : "วางแผนและบันทึกงานรายวัน"}</div>
    <form onsubmit="return App.submitTask(event)">
      <div class="field"><label>ชื่องาน *</label><input id="t_title" value="${esc(title)}" placeholder="เช่น ใส่ปุ๋ยครั้งที่ 2" required></div>
      <div class="field"><label>ประเภทงาน</label><select id="t_type">
        ${Object.keys(TYPE_LABELS).map(k => `<option value="${k}" ${k === type ? "selected" : ""}>${TYPE_ICONS[k]} ${TYPE_LABELS[k]}</option>`).join("")}
      </select></div>
      <div class="field"><label>วันที่ *</label><input id="t_date" type="date" value="${d}" required></div>
      <div class="field"><label>แปลง (ไม่บังคับ)</label><select id="t_plot">
        <option value="">— ไม่ระบุแปลง —</option>
        ${S.plots.map(p => `<option value="${p.id}">${esc(p.name)} — ${fmtNum(p.sizeRai)} ไร่</option>`).join("")}
      </select></div>
      <div class="field"><label>รอบการปลูก (ไม่บังคับ)</label><select id="t_cycle">
        <option value="">— ไม่ผูกกับรอบ —</option>
        ${actCycles.map(c => { const p = plotById(S, c.plotId); return `<option value="${c.id}">${esc(c.plant)} (${p ? esc(p.name) : ""})</option>`; }).join("")}
      </select>
      <div class="hint">เลือกแปลง/รอบเพื่อให้รายรับ-ต้นทุนถูกคำนวณเข้ารายแปลงและรอบทันที · ถ้าเลือกทั้งสอง ระบบจะใช้แปลงของรอบนั้น</div></div>
      <div class="field"><label>ตัดจากสต็อก (ไม่บังคับ)</label><select id="t_stock">
        <option value="">— ไม่ใช้วัสดุ —</option>
        ${S.stock.map(x => `<option value="${x.id}">${esc(x.name)} (คงเหลือ ${fmtNum(x.qty)} ${esc(x.unit)})</option>`).join("")}
      </select></div>
      <div class="field"><label>จำนวนวัสดุ</label><input id="t_qty" type="number" min="0" value="0"></div>
      <div class="field"><label>ต้นทุน (บาท) — เว้นว่าง = คำนวณจากราคาถัวเฉลี่ย</label><input id="t_cost" type="number" min="0" value="0"></div>
      <div class="field"><label>รายรับ (บาท) — เฉพาะงานเก็บเกี่ยว/ขาย</label><input id="t_revenue" type="number" min="0" value="0"></div>
      <div class="field"><label>หมวดต้นทุน (ใช้จัดกลุ่มกราฟต้นทุนเชิงลึก)</label><select id="t_costcat">
        ${COST_CATS.map(c => `<option value="${c.key}">${c.label}</option>`).join("")}
      </select></div>
      <div class="field"><label>หมายเหตุ</label><input id="t_note" placeholder="เช่น ใช้ปุ๋ยสูตร 46-0-0"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">บันทึกงาน</button>
      </div>
    </form>`);
  // เลือกรอบ -> ดึงแปลงของรอบนั้นมาให้อัตโนมัติ
  const cycleSel = document.getElementById("t_cycle");
  const plotSel = document.getElementById("t_plot");
  cycleSel.addEventListener("change", () => {
    const c = cycleById(S, cycleSel.value);
    if (c) plotSel.value = c.plotId;
  });
  if (preset.plotId) {
    plotSel.value = preset.plotId;
    const c = actCycles.find(x => x.plotId === preset.plotId);
    if (c) cycleSel.value = c.id;
  }
  // ค่าเริ่มต้นหมวดต้นทุนตามประเภทงาน
  document.getElementById("t_costcat").value = defaultCostCat(type);
};
App.submitTask = function (e) {
  e.preventDefault();
  const title = document.getElementById("t_title").value.trim();
  if (!title) return false;
  const t = {
    title,
    type: document.getElementById("t_type").value,
    date: document.getElementById("t_date").value,
    cycleId: document.getElementById("t_cycle").value || null,
    plotId: document.getElementById("t_plot").value || null,
    costCat: document.getElementById("t_costcat").value || null,
    stockId: document.getElementById("t_stock").value || null,
    qty: Number(document.getElementById("t_qty").value) || 0,
    cost: Number(document.getElementById("t_cost").value) || 0,
    revenue: Number(document.getElementById("t_revenue").value) || 0,
    note: document.getElementById("t_note").value.trim(),
    status: "planned"
  };
  addTask(S, t);
  saveState(S);
  closeModal();
  render();
  const msg = t.revenue > 0 ? `บันทึกงานแล้ว · รายรับ ${fmtMoney(t.revenue)} บาท 💰`
    : t.stockId ? "บันทึกงานแล้ว · ตัดสต็อกอัตโนมัติ ✅"
    : "บันทึกงานแล้ว ✅";
  toast(msg);
  return false;
};

/* ---- valve schedule modal ---- */
App.modalValve = function (id) {
  const v = S.valves.find(x => x.id === id);
  if (!v) return;
  const rows = v.schedule.map((s, i) => `
    <div class="row" style="gap:8px;margin-bottom:8px">
      <input type="time" value="${s.start}" class="vs-start" style="flex:1">
      <span class="muted">–</span>
      <input type="time" value="${s.end}" class="vs-end" style="flex:1">
      <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.delSchedule('${id}', ${i})">✕</button>
    </div>`).join("");
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>⏰ ตั้งเวลา — ${esc(v.name)}</h3>
    <div class="modal-sub">กำหนดช่วงเวลาที่วาล์วทำงานอัตโนมัติ (Schedule)</div>
    <div class="field" id="scheduleRows"><label>กำหนดการ</label>${rows || `<div class="muted">ยังไม่มีกำหนดการ</div>`}</div>
    <div class="row" style="gap:8px">
      <input type="time" id="ns_start" value="05:30" style="flex:1">
      <span class="muted">–</span>
      <input type="time" id="ns_end" value="07:30" style="flex:1">
      <button type="button" class="btn btn-sm btn-primary" onclick="App.addSchedule('${id}')">＋ เพิ่ม</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-primary" onclick="App.saveSchedules('${id}')">บันทึก</button>
    </div>`);
};
App.addSchedule = function (id) {
  const v = S.valves.find(x => x.id === id);
  if (!v) return;
  const s = document.getElementById("ns_start").value;
  const e = document.getElementById("ns_end").value;
  if (s && e) { v.schedule.push({ start: s, end: e }); saveState(S); }
  App.modalValve(id);
};
App.delSchedule = function (id, idx) {
  const v = S.valves.find(x => x.id === id);
  if (v) { v.schedule.splice(idx, 1); saveState(S); }
  App.modalValve(id);
};
App.saveSchedules = function (id) {
  const v = S.valves.find(x => x.id === id);
  if (!v) return;
  const starts = document.querySelectorAll(".vs-start");
  const ends = document.querySelectorAll(".vs-end");
  v.schedule = [];
  starts.forEach((el, i) => {
    if (el.value && ends[i] && ends[i].value) v.schedule.push({ start: el.value, end: ends[i].value });
  });
  saveState(S);
  closeModal();
  render();
  toast("บันทึกกำหนดการแล้ว ⏰");
};

/* ---------------- FAB drawer ---------------- */
const fabDock = document.getElementById("fabDock");
const fabBtn = document.getElementById("fabBtn");
function closeFAB() { fabDock.classList.remove("open"); }
fabBtn.addEventListener("click", () => fabDock.classList.toggle("open"));
fabDock.querySelectorAll(".fab-item").forEach(btn => {
  btn.addEventListener("click", () => {
    closeFAB();
    const act = btn.dataset.action;
    if (act === "harvest") App.modalTask(todayISO(), { type: "harvest", title: "บันทึกเก็บเกี่ยว" });
    else if (act === "expense") App.modalTask(todayISO(), { type: "fertilize", title: "บันทึกใส่ปุ๋ย / จ่าย" });
    else App.modalTask(todayISO(), { type: "work", title: "เพิ่มงานทั่วไป" });
  });
});

/* ---------------- Interactive tour ---------------- */
const TOUR_STEPS = [
  { sel: ".role-switch", title: "1 · สลับโหมดการใช้งาน", text: "กดที่แถบด้านบนเพื่อเปลี่ยนมุมมองแดชบอร์ด — เกษตรกร ฟาร์มใหญ่ หรือ ธุรกิจ เมนูจะปรับตามโหมดอัตโนมัติ", pos: "below" },
  { sel: "#kpiRow", title: "2 · ตัวเลขสำคัญ (KPI)", text: "กำไรสุทธิ พื้นที่ และรอบปลูก จัดเรียงแนวนอนเสมอ อ่านง่ายทั้งบนคอมและมือถือ เขียว = กำไร แดง = ขาดทุน", pos: "below" },
  { sel: "#fabBtn", title: "3 · ปุ่มลัด (FAB)", text: "ปุ่มกลมมุมขวาล่าง กดแล้วยืดออกเป็นเมนู — บันทึกเก็บเกี่ยว ใส่ปุ๋ย/จ่าย และเพิ่มงานทั่วไป ได้ทันที", pos: "left" },
  { sel: "#bottomNav", title: "4 · เมนูหลัก", text: "หน้าแรก แปลง สต็อก กิจกรรม และวิเคราะห์ — บนคอมอยู่เมนูซ้าย บนมือถืออยู่แถบล่าง กดเพื่อสลับหน้าได้ทันที", pos: "below" },
  { sel: "#tourBtn", title: "5 · จบการแนะนำ", text: "พร้อมแล้ว! กดปุ่มแนะนำระบบได้ทุกเมื่อเพื่อดูทัวร์อีกครั้ง ขอให้เพาะปลูกสำเร็จ 🌾", pos: "below" },
];
App.startTour = function () {
  closeFAB();
  S.tourDone = true;
  saveState(S);
  route.view = "home";
  render();
  let idx = 0;
  const ov = document.getElementById("tourOverlay");
  ov.hidden = false;
  ov.innerHTML = `<div class="tour-dim"></div><div class="tour-bubble"></div>`;
  const dim = ov.querySelector(".tour-dim");
  const bubble = ov.querySelector(".tour-bubble");
  function step(i) {
    const st = TOUR_STEPS[i];
    const el = document.querySelector(st.sel);
    if (!el) { next(); return; }
    const r = el.getBoundingClientRect();
    dim.style.left = r.left + "px";
    dim.style.top = r.top + "px";
    dim.style.width = r.width + "px";
    dim.style.height = r.height + "px";
    dim.style.borderRadius = "12px";
    bubble.innerHTML = `
      <div class="tb-title">${st.title}</div>
      <div class="tb-text">${st.text}</div>
      <div class="tb-actions">
        <span class="tb-pos">${i + 1} / ${TOUR_STEPS.length}</span>
        ${i > 0 ? `<button class="btn btn-sm btn-ghost" onclick="App.tourGo(${i - 1})">← ก่อนหน้า</button>` : ""}
        <button class="btn btn-sm btn-primary" onclick="App.tourGo(${i + 1})">${i === TOUR_STEPS.length - 1 ? "เสร็จสิ้น ✓" : "ถัดไป →"}</button>
      </div>`;
    // place bubble
    const vw = window.innerWidth;
    let left = Math.max(8, Math.min(r.left, vw - 316));
    let top;
    if (st.pos === "below") top = r.bottom + 12;
    else if (st.pos === "above") top = r.top - bubble.offsetHeight - 12;
    else top = r.top;
    if (top < 10) top = r.bottom + 12;
    bubble.style.left = left + "px";
    bubble.style.top = top + "px";
    ov.onclick = null;
  }
  App.tourGo = function (i) {
    if (i >= TOUR_STEPS.length || i < 0) { App.tourEnd(); return; }
    idx = i;
    step(i);
  };
  step(0);
};
App.tourEnd = function () {
  const ov = document.getElementById("tourOverlay");
  ov.hidden = true;
  ov.innerHTML = "";
  toast("จบการแนะนำระบบ 🎉");
};

/* ---------------- charts wiring ---------------- */
function drawCharts() {
  if (route.view === "analytics") {
    const months = monthlySeries(S, todayISO().slice(0, 4));
    Charts.bars(document.getElementById("chartYear"), months);
    const cropBars = cropMargins(S).map(c => ({
      label: c.crop.split(" ")[0],
      value: c.margin,
      color: "#16a34a"
    }));
    Charts.bars(document.getElementById("chartCrop"), cropBars);
    const costs = costBreakdown(S);
    const totalCost = costs.reduce((a, c) => a + c.value, 0);
    Charts.donut(document.getElementById("chartCost"), costs, {
      centerLabel: fmtMoney(totalCost), centerSub: "ต้นทุนรวม (บาท)"
    });
  }
}

/* ---------------- init ---------------- */
render();
