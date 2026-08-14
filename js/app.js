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

/* ---------------- โหมดแก้ไขเว็บ: คำที่แก้ไขได้ ----------------
   ผู้ดูแลแก้ผ่านหน้าตั้งค่า (ล็อกด้วยรหัสผ่าน) ค่าที่แก้เก็บใน S.texts
   ใช้ T(key) เพื่ออ่านค่า: ค่าที่แก้แล้ว (ถ้ามี) ชนะค่าเริ่มต้น */
const EDITABLE_TEXTS = [
  { key: "brandName", label: "ชื่อแบรนด์ (หัวเว็บ)", def: "FARMULTIMATE SOLUTIONS" },
  { key: "brandSub", label: "คำใต้แบรนด์", def: "ระบบจัดการฟาร์มอัจฉริยะ" },
  { key: "heroGreet", label: "คำทักทายหน้าแรก", def: "สวัสดีครับ" },
  { key: "titleTasks", label: "หัวข้อ: งานที่ต้องทำเร็วๆ นี้", def: "งานที่ต้องทำเร็วๆ นี้" },
  { key: "titleProfit", label: "หัวข้อ: กำไร/ขาดทุนรายแปลง", def: "กำไร/ขาดทุนรายแปลง" },
  { key: "titleCal", label: "หัวข้อ: ปฏิทินงาน", def: "ปฏิทินงาน" },
  { key: "titleActivity", label: "หัวข้อ: กิจกรรมล่าสุด", def: "กิจกรรมล่าสุด" },
  { key: "titleCycles", label: "หัวข้อ: รอบปลูกที่กำลังดำเนินการ", def: "รอบปลูกที่กำลังดำเนินการ" },
  { key: "titleKpi", label: "หัวข้อ: ตัวเลขสำคัญ", def: "ตัวเลขสำคัญ" },
  /* หน้าอื่นๆ */
  { key: "plotsTitle", label: "หน้าแปลง: แผนที่แปลง", def: "แผนที่แปลง" },
  { key: "cyclesTitle", label: "หน้าแปลง: รอบการปลูก", def: "รอบการปลูก" },
  { key: "stockTitle", label: "หน้าสต็อก: รายการวัสดุ", def: "รายการวัสดุ" },
  { key: "plannerTitle", label: "หน้าปฏิทิน: งานวันที่", def: "งานวันที่" },
  { key: "analyticsTitle", label: "หน้าวิเคราะห์: ภาพรวมปี", def: "ภาพรวมปี" },
  { key: "equipmentTitle", label: "หน้าอุปกรณ์: อุปกรณ์/เครื่องจักร", def: "อุปกรณ์ / เครื่องจักร" },
  { key: "iotTitle", label: "หน้า IoT: วาล์ว/ปั๊มน้ำ", def: "วาล์ว / ปั๊มน้ำ" },
  { key: "moreTitle", label: "หน้าเพิ่มเติม: เมนูเพิ่มเติม", def: "เมนูเพิ่มเติม" },
  { key: "settingsTitle", label: "หน้าตั้งค่า: ตั้งค่าระบบ", def: "ตั้งค่าระบบ" },
];
function T(key) {
  const o = S.texts && S.texts[key];
  return (o && String(o).trim()) || (EDITABLE_TEXTS.find(e => e.key === key) || {}).def || "";
}

/* แปะปุ่ม ✏️ เล็กๆ ข้างหัวข้อทุกหน้าที่ผู้ดูแลปลดล็อกไว้
   element ที่มี data-tkey จะได้ปุ่มแก้ไขคำนั้นๆ — กดแล้วเปิด modal แก้ไขทันที */
function attachPens() {
  if (!adminUnlocked()) return;
  document.querySelectorAll("[data-tkey]").forEach(el => {
    if (el.querySelector(".ed-pen")) return;
    const pen = document.createElement("button");
    pen.className = "ed-pen";
    pen.type = "button";
    pen.title = "แก้ไขข้อความนี้";
    pen.innerHTML = ic("pencil");
    pen.addEventListener("click", e => {
      e.stopPropagation();
      App.editText(el.dataset.tkey);
    });
    el.appendChild(pen);
  });
}
/* แก้ไขคำเดียวจากปุ่ม ✏️ — เปิด modal ใส่ข้อความใหม่ */
App.editText = function (key) {
  const meta = EDITABLE_TEXTS.find(e => e.key === key);
  if (!meta) return;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("pencil")} แก้ไข: ${esc(meta.label)}</h3>
    <div class="modal-sub">เปลี่ยนคำนี้ได้เฉพาะเครื่องนี้ (LocalStorage) — ปล่อยว่างเพื่อคืนค่าเริ่มต้น</div>
    <div class="field"><label>ข้อความ</label><input id="et_val" value="${esc(T(key))}"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveEditText('${key}')">${ic("save")} บันทึก</button>
    </div>`);
  const inp = document.getElementById("et_val");
  if (inp) { inp.focus(); inp.select(); }
};
App.saveEditText = function (key) {
  const v = (document.getElementById("et_val").value || "").trim();
  const meta = EDITABLE_TEXTS.find(e => e.key === key);
  if (!meta) return;
  S.texts = S.texts || {};
  if (v && v !== meta.def) S.texts[key] = v; else delete S.texts[key];
  saveState(S);
  closeModal();
  render();
  toast("บันทึกแล้ว");
};

/* ---------------- icons (SVG line icons, professional) ----------------
   ใช้แทนอีโมจิ — สีเดียว (currentColor) ปรับขนาดด้วย class .ic */
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  box: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  pencil: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
};
/* สร้าง SVG icon */
function ic(name, cls) {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

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
/* ไอคอนพืช — ใช้ใบไม้ SVG เดียวกัน (มืออาชีพ) */
function cropEmoji(crop) {
  return ic("leaf");
}
function statusTag(status) {
  if (status === "done") return `<span class="badge badge-green">เสร็จ</span>`;
  if (status === "overdue") return `<span class="badge badge-red">เลยกำหนด</span>`;
  return `<span class="badge badge-amber">แผน</span>`;
}
function typeTag(t) {
  return `<span class="task-tag" style="background:var(--green-soft);color:var(--green-dark)">${ic(TYPE_ICONS[t.type] || "info")} ${TYPE_LABELS[t.type] || t.type}</span>`;
}
/* แปลงวันที่ ISO เป็นไทยสั้น: 2026-08-13 -> 13 ส.ค. 2569 */
function dateLabel(iso) {
  if (!iso) return "";
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3) return iso;
  return `${parts[2]} ${THAI_MONTHS_SHORT[parts[1] - 1]} ${parts[0] + 543}`;
}
/* แถวงานแบบเดียวกับเว็บอ้างอิง (Farm Command): จุดสถานะกลม + ชื่องาน + meta เรียบง่าย
   กดทั้งแถว = ดูรายละเอียด / จุดสถานะ = ติ๊กเสร็จ */
function taskRowHtml(t, opts) {
  opts = opts || {};
  const done = t.status === "done";
  const st = taskStatusOf(t);
  const dotCls = st === "done" ? "dot-green" : st === "overdue" ? "dot-red" : "dot-amber";
  const meta = [];
  /* แสดงวันที่เสมอ (เป็นไทย พร้อมไอคอนปฏิทิน) — รู้ทันทีว่างานนี้วันไหน */
  if (opts.showDate || opts.alwaysDate) {
    meta.push(`<span class="td-date">${ic("calendar")} ${dateLabel(t.date)}</span>`);
  }
  if (t.qty) meta.push("จำนวน " + fmtNum(t.qty));
  if (t.revenue) meta.push("รายรับ " + fmtMoney(t.revenue) + " บาท");
  if (t.cost) meta.push("ต้นทุน " + fmtMoney(t.cost) + " บาท");
  if (opts.showNote && t.note) meta.push(esc(t.note));
  return `
    <div class="task-row ${done ? "done" : ""}" onclick="App.viewTask('${t.id}')" role="button" tabindex="0">
      <button class="task-dot ${dotCls}" onclick="event.stopPropagation();App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ" title="${st === "done" ? "ยกเลิกเสร็จ" : "ติ๊กเสร็จ"}"></button>
      <div class="grow">
        <div class="task-title">${esc(t.title)}</div>
        ${meta.length ? `<div class="muted">${meta.join(" · ")}</div>` : ""}
      </div>
      ${opts.showDelete ? `<button class="btn btn-sm btn-danger-soft" onclick="event.stopPropagation();App.deleteTask('${t.id}')">${ic("trash")}</button>` : ""}
      <span class="task-arrow">${ic("chevron")}</span>
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
        ${overdueCount ? `<span class="bold" style="color:var(--red)">${ic("alert")} ${overdueCount} งานเลยกำหนด</span>` : ""}
      </div>
    </div>`;
}

/* ---------------- router & nav ---------------- */
const NAV_ALL = [
  { key: "home", label: "หน้าแรก", ico: "home" },
  { key: "plots", label: "แปลง", ico: "map" },
  { key: "stock", label: "สต็อก", ico: "box" },
  { key: "planner", label: "กิจกรรม", ico: "calendar" },
  { key: "analytics", label: "วิเคราะห์", ico: "chart" },
  { key: "more", label: "เพิ่มเติม", ico: "menu" },
];
function visibleNav() {
  const role = S.role;
  if (role === "large") return NAV_ALL.filter(n => n.key !== "analytics");
  if (role === "business") return NAV_ALL.filter(n => ["home", "analytics", "more"].includes(n.key));
  return NAV_ALL;
}
const ROLE_META = {
  general: { label: "เกษตรกร", ico: "user", desc: "งานรายวัน · ปฏิทิน · สิ่งที่ต้องทำ" },
  large: { label: "ฟาร์มใหญ่", ico: "truck", desc: "ภาพรวมพื้นที่ · แปลง · สถานะคนงาน" },
  business: { label: "ธุรกิจ", ico: "briefcase", desc: "ตัวเลขการเงิน · กำไรขาดทุน · วิเคราะห์เชิงลึก" },
};

/* ใช้กัน animation กระพริบซ้ำ — animation จะเล่นเฉพาะตอนเปลี่ยนหน้า
   (กด nav) แต่จะถูกปิดตอน re-render ในหน้าเดิม เช่น กดวันที่/เปลี่ยนเดือน */
let lastView = null;
function render() {
  // role switch
  const rs = document.getElementById("roleSwitch");
  rs.innerHTML = Object.keys(ROLE_META).map(k =>
    `<button class="${S.role === k ? "active" : ""}" onclick="App.setRole('${k}')">${ic(ROLE_META[k].ico)} ${ROLE_META[k].label}</button>`
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
       <span class="nav-ico">${ic(n.ico)}</span><span>${n.label}</span>
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
  const viewChanged = lastView !== route.view;
  lastView = route.view;
  /* ปิดแอนิเมชันตอน re-render ในหน้าเดิม (กันกระพริบ) */
  v.classList.toggle("no-anim", !viewChanged);
  v.innerHTML = (views[route.view] || renderHome)();
  v.scrollTop = 0;
  window.scrollTo(0, 0);

  // แบรนด์ที่ผู้ดูแลแก้ (หัวเว็บ + title แท็บ)
  const bn = document.getElementById("brandNameTxt");
  if (bn) bn.textContent = T("brandName");
  const bs = document.getElementById("brandSubTxt");
  if (bs) bs.textContent = T("brandSub");
  document.title = T("brandName") + " — ระบบจัดการฟาร์มอัจฉริยะ";

  // ปุ่ม ✏️ แก้ไข (ผู้ดูแล) ที่หัวเว็บ — แสดงเฉพาะตอนปลดล็อก
  const eb = document.getElementById("editBtn");
  if (eb) eb.style.display = adminUnlocked() ? "" : "none";

  drawCharts();

  attachPens();
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
/* ลำดับ section หน้าแรก — ผู้ดูแลเลื่อนได้ที่หน้าตั้งค่า (ค่าเริ่มต้น: ปฏิทิน → งาน → กำไร → กิจกรรม) */
function homeOrder() {
  const o = S.homeOrder && S.homeOrder.length === 4 ? S.homeOrder : ["cal", "tasks", "profit", "activity"];
  return o.filter(k => ["cal", "tasks", "profit", "activity"].includes(k));
}
/* สร้าง grid-template-areas สำหรับจอคอมตามลำดับที่ผู้ใช้เลือก
   slot 0 = คอลัมน์ซ้ายยาว 2 แถว, 1 = ขวาบน, 2 = ขวาล่าง, 3 = เต็มความกว้างล่าง
   ใช้ single quote ('...') เพื่อไม่ให้ชนกับเครื่องหมาย " ใน attribute style= */
function homeFlowAreas() {
  const o = homeOrder();
  return `'${o[0]} ${o[1]}' '${o[0]} ${o[2]}' '${o[3]} ${o[3]}'`;
}
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
  /* กิจกรรมล่าสุด: เรียงตามเวลาที่เพิ่งทำจริง (เพิ่ม/ทำเสร็จ/แก้ไข) ไม่ใช่ตามวันที่งาน
     งานเก่าที่ยังไม่มี timestamp -> ใช้เวลาวันที่ของงานแทน */
  const tsOf = t => t.updatedAt || t.createdAt || new Date(t.date + "T12:00:00").getTime() || 0;
  const recent = [...S.tasks]
    .sort((a, b) => tsOf(b) - tsOf(a))
    .slice(0, 3);
  const selDate = cal.sel || today;
  const selTasks = tasksOn(S, selDate).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));

  const kpiProfit = ytd.net >= 0;
  const kpiClass = kpiProfit ? "pos" : "neg";
  const plotProfits = S.plots.filter(p => p.status === "active").map(p => ({ p, fin: plotFinance(S, p.id) }));

  /* ปุ่มลัดบันทึกงานประจำวันบนหน้าแรก */
  const quickActs = [
    { type: "inspect", ico: "search", label: "ตรวจแปลง" },
    { type: "fertilize", ico: "leaf", label: "ใส่ปุ๋ย" },
    { type: "harvest", ico: "box", label: "เก็บเกี่ยว" },
    { type: "water", ico: "droplet", label: "รดน้ำ" },
  ].map(a => `<button class="chip" onclick="App.modalTask('${today}', { type: '${a.type}', title: '${a.label}' })">${ic(a.ico)} ${a.label}</button>`).join("");

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
        <button class="btn btn-primary btn-block mt-12" onclick="App.nav('analytics')">${ic("chart")} ดูการวิเคราะห์เชิงลึก</button>
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
        <span class="plot-emoji" style="background:var(--green-light);color:var(--green-deep)">${ic("compass")}</span>
        <div class="grow">
          <div class="bold" style="color:var(--green-deep)">ใหม่ใน v52 — หน้าตาเว็บคอมพิวเตอร์</div>
          <div class="muted">เลย์เอาต์เดสก์ท็อปเต็มรูปแบบ: เมนูข้าง, เนื้อหาหลายคอลัมน์, ปุ่มลัดมุมขวาล่าง — ยังใช้บนมือถือได้สบาย</div>
        </div>
      </div>
      <button class="btn btn-primary btn-block mt-12" onclick="App.startTour()">${ic("compass")} เริ่มแนะนำระบบ</button>
    </div>`;

  return `
    <div class="hero">
      <div class="hero-row">
        <div>
          <div class="hero-greet" data-tkey="heroGreet">${T("heroGreet")}</div>
          <div class="hero-sub">${thaiDateStr(new Date())} · โหมด ${ROLE_META[S.role].label}</div>
        </div>
        <span class="hero-ver">${S.version === 52 ? "อัปเดตล่าสุด v52" : "v" + S.version}</span>
      </div>
      <div class="hero-progress">
        <div class="hp-row">
          <span>ความคืบหน้างานวันนี้</span>
          <span class="hp-num">${tToday.length ? `${doneToday}/${tToday.length} เสร็จ` : "ไม่มีงาน"}</span>
        </div>
        <div class="hp-bar"><i style="width:${todayPct}%"></i></div>
      </div>
      <div class="hero-chips">${quickActs}</div>
    </div>

    ${welcome}

    <div class="section-title" data-tkey="titleKpi">${T("titleKpi")}</div>
    <div class="kpi-row" id="kpiRow">
      <div class="kpi green ${kpiClass}">
        <div class="kpi-icon">${ic("dollar")}</div>
        <div class="kpi-label">กำไรสุทธิ</div>
        <div class="kpi-value">${fmtMoney(ytd.net)}</div>
        <div class="kpi-sub">ปี 2569 · ${ytd.net >= 0 ? "กำไร" : "ขาดทุน"}</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-icon">${ic("pin")}</div>
        <div class="kpi-label">พื้นที่ (ไร่)</div>
        <div class="kpi-value">${fmtNum(area)}</div>
        <div class="kpi-sub">${S.plots.filter(p => p.status === "active").length} แปลง Active</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-icon">${ic("leaf")}</div>
        <div class="kpi-label">รอบปลูก</div>
        <div class="kpi-value">${cycles.length}</div>
        <div class="kpi-sub">กำลังดำเนินการ</div>
      </div>
    </div>

    ${extra}

    <div class="home-flow" style="--flow-areas:${homeFlowAreas()}">
      ${homeOrder().map(k => {
        if (k === "cal") return `
      <section class="sec-cal">
        <div class="row row-between section-title" data-tkey="titleCal">
          <span>${T("titleCal")}</span>
          <button class="btn btn-primary btn-sm" onclick="App.nav('planner')">เปิดเต็ม</button>
        </div>
        ${calCardHtml(true)}
        <div class="card">
          <div class="row row-between" style="margin-bottom:4px">
            <div class="bold" style="font-size:.9rem">${ic("calendar")} งานวันที่ ${selDate}</div>
            <button class="btn btn-sm btn-ghost" onclick="App.modalTask('${selDate}')">${ic("plus")} เพิ่มกิจกรรม</button>
          </div>
          ${selTasks.length === 0 ? `<div class="muted" style="text-align:center;padding:10px">ไม่มีงานในวันนี้</div>` : ""}
          ${selTasks.map(t => taskRowHtml(t)).join("")}
        </div>
      </section>`;
        if (k === "tasks") return `
      <section class="sec-tasks">
        <div class="row row-between section-title" data-tkey="titleTasks">
          <span>${T("titleTasks")} ${todays.length ? `<span class="badge badge-amber">${todays.length} รายการ</span>` : ""}</span>
          <button class="btn btn-primary btn-sm" onclick="App.modalTask('${today}')">${ic("plus")} เพิ่มกิจกรรม</button>
        </div>
        <div class="card">
          ${todays.length === 0 ? `
            <div class="empty">
              <div class="e-ico">${ic("check")}</div>
              <div class="e-title">ไม่มีงานที่ต้องทำเร็วๆ นี้</div>
              <div class="muted">จดงานหรือกดตรวจแปลงได้เลย</div>
            </div>` : ""}
          ${tToday.length ? `<div class="task-group"><h3>วันนี้</h3>${tToday.map(t => taskRowHtml(t)).join("")}</div>` : ""}
          ${tTomorrow.length ? `<div class="task-group"><h3>พรุ่งนี้</h3>${tTomorrow.map(t => taskRowHtml(t, { showDate: t.date !== tomorrow })).join("")}</div>` : ""}
          ${soon.length ? `<div class="task-group"><h3>เร็วๆ นี้</h3>${soon.map(t => taskRowHtml(t, { showDate: true })).join("")}</div>` : ""}
          ${overdue.length ? `
            <div class="task-group"><h3>เลยกำหนด</h3>
              ${overdue.slice(0, 3).map(t => taskRowHtml(t, { showDate: true })).join("")}
              ${overdue.length > 3 ? `<div class="muted" style="font-size:.72rem;padding:6px 2px">+${overdue.length - 3} รายการ — <a class="link" onclick="App.nav('planner')">ดูทั้งหมด</a></div>` : ""}
            </div>` : ""}
        </div>
      </section>`;
        if (k === "profit") return `
      <section class="sec-profit">
        <div class="section-title" data-tkey="titleProfit">${T("titleProfit")}</div>
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
      </section>`;
        if (k === "activity") return `
      <section class="sec-activity">
        <div class="row row-between section-title" data-tkey="titleActivity">
          <span>${T("titleActivity")}</span>
          <button class="btn btn-sm btn-ghost" onclick="App.nav('planner')">${ic("calendar")} ดูเพิ่มเติม</button>
        </div>
        <div class="card">
          ${recent.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีกิจกรรม</div>` : ""}
          ${recent.map(t => {
            /* บอกว่าพึ่งทำอะไรกับงานนี้ */
            let act = "เพิ่มแผน";
            if (t.updatedAt && t.status === "done") act = "ทำเสร็จ";
            else if (t.updatedAt && t.status === "planned") act = "แก้ไข";
            return `
            <div class="row-line" onclick="App.viewTask('${t.id}')" role="button" style="cursor:pointer">
              <span class="task-ico ${esc(t.type)}">${ic(TYPE_ICONS[t.type] || "wrench")}</span>
              <div class="grow">
                <div class="bold" style="font-size:.84rem">${esc(t.title)}</div>
                <div class="muted" style="font-size:.7rem">${act} · ${dateLabel(t.date)} ${typeTag(t)}</div>
              </div>
              ${statusTag(taskStatusOf(t))}
            </div>`;
          }).join("")}
        </div>
      </section>`;
        return "";
      }).join("")}
    </div>

    <div class="section-title" data-tkey="titleCycles">${T("titleCycles")}</div>
    <div class="card">
      ${cycles.length === 0 ? `<div class="empty"><div class="e-ico">${ic("leaf")}</div><div class="e-title">ยังไม่มีรอบปลูก</div><div class="muted">กดเริ่มปลูกที่หน้าแปลง</div></div>` : ""}
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
      <button class="btn btn-ghost btn-block mt-12" onclick="App.goCycles()">${ic("plus")} เริ่มปลูกพืชใหม่</button>
    </div>`;
}

/* ---------------- Plots & cycles ---------------- */
function renderPlots() {
  const active = S.plots.filter(p => p.status === "active");
  const inactive = S.plots.filter(p => p.status !== "active");
  const cycles = [...S.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const plotsTab = `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem" data-tkey="plotsTitle">${T("plotsTitle")} ${active.length}/${S.plots.length}</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalPlot()">＋ แปลงใหม่</button>
    </div>
    <div class="muted mt-4" style="font-size:.72rem">${ic("pin")} ปักหมุดพิกัด GPS ทุกแปลง เพื่อให้ระบบดึงข้อมูลสภาพอากาศได้แม่นยำ (เร็วๆ นี้)</div>
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
          <button class="btn btn-sm btn-ghost" onclick="App.openPlot('${p.id}')">${ic("eye")} ดูรายละเอียด</button>
          <button class="btn btn-sm btn-outline" onclick="App.modalPlot('${p.id}')">${ic("pencil")} แก้ไข</button>
          ${c ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">${ic("leaf")} เริ่มปลูก</button>`}
          <button class="btn btn-sm btn-danger-soft" onclick="App.deletePlot('${p.id}')">${ic("trash")}</button>
        </div>
      </div>`;
    }).join("")}
    </div>`;

  const cyclesTab = `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem" data-tkey="cyclesTitle">${T("cyclesTitle")} ${cycles.filter(c => c.status === "active").length} รอบ</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalCycle()">${ic("plus")} เริ่มปลูก</button>
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
          <div class="meta-box"><div class="lb">สถานะ</div><div class="vl" style="font-size:.78rem">${fin.revenue > 0 ? "มีผลผลิตแล้ว" : "รอผลผลิต"}</div></div>
        </div>
        ${c.status === "active" ? `<button class="btn btn-sm btn-ghost mt-12" onclick="App.completeCycle('${c.id}')">${ic("check")} ปิดรอบการปลูก</button>` : ""}
      </div>`;
    }).join("")}
    </div>`;

  return `
    <div class="tabs">
      <button class="${route.tab === "plots" ? "active" : ""}" onclick="App.plotsTab('plots')">${ic("map")} แปลง</button>
      <button class="${route.tab === "cycles" ? "active" : ""}" onclick="App.plotsTab('cycles')">${ic("leaf")} รอบปลูก</button>
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
        <button class="btn btn-sm btn-outline" onclick="App.modalPlot('${p.id}')">${ic("pencil")} แก้ไขแปลง</button>
        ${activeCycle ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">${ic("leaf")} เริ่มปลูก</button>`}
        <button class="btn btn-sm btn-primary" onclick="App.modalTask(todayISO(), { plotId: '${p.id}' })">${ic("plus")} เพิ่มกิจกรรม</button>
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
        <span class="kpi-icon" style="font-size:2rem">${ic(fin.net >= 0 ? "chart" : "alert")}</span>
      </div>
    </div>

    <div class="section-title">รอบการปลูก (${cycles.length})</div>
    ${cycles.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("leaf")}</div><div class="e-title">ยังไม่มีรอบการปลูก</div><div class="muted">กดเริ่มปลูกได้เลย</div></div></div>` : ""}
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
          <div class="meta-box"><div class="lb">สถานะ</div><div class="vl" style="font-size:.78rem">${cf.revenue > 0 ? "มีผลผลิตแล้ว" : "รอผลผลิต"}</div></div>
        </div>
        ${c.status === "active" ? `<button class="btn btn-sm btn-ghost mt-12" onclick="App.completeCycle('${c.id}')">${ic("check")} ปิดรอบการปลูก</button>` : ""}
      </div>`;
    }).join("")}
    </div>

    <div class="section-title">งาน/กิจกรรมของแปลงนี้ (${tasks.length})</div>
    <div class="card">
      ${tasks.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีบันทึกงาน — กด + เพิ่มกิจกรรม ได้เลย</div>` : ""}
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
  toast("ปิดรอบการปลูกเรียบร้อย");
};
App.toggleTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  toggleTaskDone(S, id);
  saveState(S);
  rerender();
  toast(t.status === "done" ? `เสร็จแล้ว: ${t.title}` : `ยกเลิก: ${t.title}`);
  /* ถ้ากำลังเปิดหน้าต่างรายละเอียดงานนี้อยู่ → อัปเดต modal ทันที (ไม่ต้องปิด-เปิดใหม่) */
  const root = document.getElementById("modalRoot");
  if (root && root.innerHTML.trim() !== "" && root.querySelector(".td-list")) {
    App.viewTask(id);
  }
};

/* ---------------- Stock ---------------- */
let stockFilter = "all"; // all | sealed | opened
let stockQuery = "";    // คำค้นหาชื่อ/หน่วย
/* HTML รายการสต็อก (กรองตามแท็บ + คำค้น) — แยกเป็นฟังก์ชันเพื่ออัปเดตเฉพาะส่วนนี้ ไม่ rebuild ทั้งหน้า */
function stockListHtml() {
  const q = stockQuery.trim().toLowerCase();
  const list = S.stock.filter(x => {
    const open = Number(x.openQty) || 0;
    if (stockFilter === "sealed" && open > 0) return false;
    if (stockFilter === "opened" && open <= 0) return false;
    if (q && !(x.name.toLowerCase().includes(q) || x.unit.toLowerCase().includes(q))) return false;
    return true;
  });
  const emptyHtml = list.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("box")}</div><div class="e-title">${q ? "ไม่พบรายการที่ค้นหา" : (stockFilter === "sealed" ? "ไม่มีของที่ยังไม่เปิดใช้" : "ไม่มีของที่เปิดใช้แล้ว")}</div><div class="muted">${q ? "ลองค้นด้วยชื่ออื่น" : (stockFilter === "opened" ? "เมื่อใช้ของไม่หมด จะมีของเหลือจากการเปิดใช้ที่นี่" : "")}</div></div></div>` : "";
  const grid = `<div class="card-grid">
    ${list.map(x => {
      const open = Number(x.openQty) || 0;
      return `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">${ic("box")}</div>
          <div class="grow">
            <div class="plot-name">${esc(x.name)}</div>
            <div class="muted">ต้นทุนถัวเฉลี่ย ${fmtMoney(x.avgCost)} บาท/${x.unit}</div>
            ${open > 0 ? `<div class="stock-open">${ic("unlock")} เหลือจากการเปิดใช้ ${fmtNum(open)} ${esc(x.unit)} — ใช้ได้ก่อน</div>` : `<div class="stock-sealed">${ic("lock")} ยังไม่เปิดใช้</div>`}
          </div>
          <div class="stock-qty">${fmtNum(x.qty)} <small>${esc(x.unit)}</small></div>
        </div>
        <div class="row row-between mt-8">
          <div class="muted">มูลค่ารวม <span class="bold">${fmtMoney((x.qty + open) * x.avgCost)} บาท</span>${open > 0 ? `<span class="muted" style="font-size:.66rem"> (รวมของที่เหลือจากการเปิดใช้)</span>` : ""}</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-primary" onclick="App.modalReceive('${x.id}')">${ic("down")} รับของเข้า</button>
            <button class="btn btn-sm btn-outline" onclick="App.modalDeduct('${x.id}')">${ic("minus")} ตัดสต็อก</button>
            <button class="btn btn-sm btn-danger-soft" onclick="App.deleteStock('${x.id}')">${ic("trash")}</button>
          </div>
        </div>
      </div>`;
    }).join("")}
    </div>`;
  return emptyHtml + grid;
}
function renderStock() {
  const total = totalStockValue(S);
  const openedCount = S.stock.filter(x => (Number(x.openQty) || 0) > 0).length;
  const sealedCount = S.stock.length - openedCount;
  const tab = (key, label, count) =>
    `<button class="chip ${stockFilter === key ? "chip-active" : ""}" onclick="App.stockFilter('${key}')">${label} ${count ? `<span class="badge">${count}</span>` : ""}</button>`;
  return `
    <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none">
      <div class="row row-between">
        <div>
          <div style="font-size:.76rem;opacity:.85">มูลค่าสต็อกทั้งหมด</div>
          <div class="bold" style="font-size:1.5rem">${fmtMoney(total)} บาท</div>
        </div>
        <span style="font-size:2rem;color:#fff">${ic("box")}</span>
      </div>
    </div>
    <div class="row row-between section-title" data-tkey="stockTitle">
      <span>${T("stockTitle")} (${S.stock.length})</span>
      <button class="btn btn-primary btn-sm" onclick="App.modalStock()">${ic("plus")} เพิ่มรายการ</button>
    </div>
    <div class="stock-tabs">
      ${tab("all", "ทั้งหมด", S.stock.length)}
      ${tab("sealed", "ยังไม่เปิดใช้", sealedCount)}
      ${tab("opened", "เปิดใช้แล้ว", openedCount)}
    </div>
    <div class="stock-search">
      ${ic("search")}
      <input type="text" id="stockSearchInput" placeholder="ค้นหาปุ๋ย/ยา/เมล็ดพันธุ์..." value="${esc(stockQuery)}" oninput="App.stockSearch(this.value)">
      ${stockQuery ? `<button class="stock-search-clear" onclick="App.stockSearch('')">✕</button>` : ""}
    </div>
    <div id="stockListWrap">${stockListHtml()}</div>
    <div class="muted" style="font-size:.72rem;text-align:center;padding:6px">${ic("info")} สต็อกหลักเก็บเป็นหน่วยเต็ม · เมื่อใช้ของไม่หมด ของที่เหลือจากการเปิดใช้จะนำไปใช้ก่อนเสมอ · วิธีคิดต้นทุนแบบถัวเฉลี่ยถ่วงน้ำหนัก (Weighted Average)</div>`;
}
App.stockFilter = function (key) {
  stockFilter = key;
  rerender();
};
/* พิมพ์ค้นหา -> อัปเดตเฉพาะรายการ (ไม่ rebuild ทั้งหน้า = focus ไม่หลุด พิมพ์ต่อเนื่องได้) */
App.stockSearch = function (v) {
  stockQuery = v;
  const wrap = document.getElementById("stockListWrap");
  if (wrap) wrap.innerHTML = stockListHtml();
  const clearBtn = document.querySelector(".stock-search-clear");
  if (clearBtn) clearBtn.style.display = v ? "" : "none";
};
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
      <span data-tkey="plannerTitle">${sel ? `${T("plannerTitle")} ${sel}` : "กดวันที่เพื่อดูงาน"}</span>
      ${sel ? `<button class="btn btn-primary btn-sm" onclick="App.modalTask('${sel}')">${ic("plus")} เพิ่มกิจกรรม</button>` : ""}
    </div>
    <div class="card">
      ${!sel ? `<div class="muted" style="text-align:center;padding:10px">เลือกวันที่ในปฏิทินด้านบน</div>` : ""}
      ${selTasks.length === 0 && sel ? `<div class="empty"><div class="e-ico">${ic("calendar")}</div><div class="e-title">ไม่มีงานในวันนี้</div><div class="muted">กด + เพิ่มกิจกรรม เพื่อวางแผน</div></div>` : ""}
      ${selTasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true })).join("")}
    </div>
    <div class="muted" style="font-size:.72rem;text-align:center">${ic("refresh")} เมื่อบันทึกงานที่ใช้วัสดุ (เช่น ใส่ปุ๋ย) ระบบจะตัดสต็อกและบันทึกต้นทุนเข้าสู่รอบปลูกทันที</div>`;
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
/* อธิบายผลต่างการใช้สต็อก (ใช้ในป๊อปอัปยืนยันตอนแก้ไข) */
function describeStockDiff(oldT, newData) {
  const oldUse = (oldT.costItems || []).filter(i => i.stockId);
  const newUse = (newData.costItems || []).filter(i => i.stockId);
  const parts = [];
  oldUse.forEach(o => {
    const item = stockById(S, o.stockId);
    const name = item ? item.name : o.name;
    const n = newUse.find(x => x.stockId === o.stockId);
    if (!n) parts.push(`${name}: ลดจาก ${fmtNum(o.qty)} → 0`);
    else if (Number(n.qty) !== Number(o.qty)) parts.push(`${name}: ${fmtNum(o.qty)} → ${fmtNum(n.qty)}`);
  });
  newUse.forEach(n => {
    if (!oldUse.find(x => x.stockId === n.stockId)) {
      const item = stockById(S, n.stockId);
      parts.push(`${item ? item.name : n.name}: เพิ่ม ${fmtNum(n.qty)}`);
    }
  });
  return parts.join(", ") || "ปรับรายการ";
}
App.deleteTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  const usedStock = (t && t.stockLog && t.stockLog.length) || (t && t.costItems && t.costItems.some(i => i.stockId));
  const doDelete = (restock) => {
    if (restock && t) restockTask(S, t);
    S.tasks = S.tasks.filter(x => x.id !== id);
    saveState(S);
    render();
    toast(restock ? "ลบงานแล้ว · คืนสต็อกที่ยังไม่ได้ใช้" : "ลบงานแล้ว");
  };
  if (usedStock) {
    confirmChoice("ได้ใช้ของจากสต็อกแล้วหรือยัง?",
      "งานนี้เบิกของจากสต็อกมาแล้ว — ถ้ายังไม่ได้ใช้จริง ระบบจะคืนของเข้าสต็อกให้",
      [
        { label: "ยังไม่ได้ใช้ — คืนสต็อก", cls: "btn-primary", value: "restock" },
        { label: "ใช้แล้ว (ไม่คืน)", cls: "btn-ghost", value: "keep" },
        { label: "ยกเลิก", cls: "btn-danger-soft", value: "cancel" }
      ],
      v => { if (v !== "cancel") doDelete(v === "restock"); });
  } else {
    App.confirm("ลบงานนี้?", "ต้องการลบงานนี้หรือไม่?", () => doDelete(false));
  }
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
    <div class="section-title" data-tkey="analyticsTitle">${T("analyticsTitle")} 2569</div>
    <div class="kpi-row">
      <div class="kpi green"><div class="kpi-icon">${ic("dollar")}</div><div class="kpi-label">รายได้</div><div class="kpi-value">${fmtMoney(ytd.revenue)}</div><div class="kpi-sub">บาท</div></div>
      <div class="kpi amber"><div class="kpi-icon">${ic("box")}</div><div class="kpi-label">ต้นทุน</div><div class="kpi-value">${fmtMoney(ytd.cost)}</div><div class="kpi-sub">บาท</div></div>
      <div class="kpi blue ${ytd.net >= 0 ? "pos" : "neg"}"><div class="kpi-icon">${ic("chart")}</div><div class="kpi-label">กำไรสุทธิ</div><div class="kpi-value">${fmtMoney(ytd.net)}</div><div class="kpi-sub">Margin ${ytd.margin.toFixed(1)}%</div></div>
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
    <div class="row row-between section-title" data-tkey="equipmentTitle">
      <span>${T("equipmentTitle")} (${S.equipment.length})</span>
      <button class="btn btn-primary btn-sm" onclick="App.modalEquipment()">＋ เพิ่มอุปกรณ์</button>
    </div>
    <div class="muted" style="font-size:.72rem;margin-bottom:10px">${ic("info")} ติดตามค่าเสื่อมราคาและประวัติการซ่อมบำรุงของเครื่องจักรทุกชิ้น</div>
    <div class="card-grid">
    ${S.equipment.map(e => {
      const yrs = years(e.purchaseDate);
      const dep = e.cost / e.lifespan;
      const value = Math.max(0, e.cost - dep * yrs);
      return `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">${ic("truck")}</div>
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
          <button class="btn btn-sm btn-ghost">${ic("wrench")} บันทึกซ่อมบำรุง</button>
          <button class="btn btn-sm btn-danger-soft" onclick="App.deleteEquipment('${e.id}')">${ic("trash")}</button>
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
        <span style="font-size:2rem;color:#fff">${ic("wifi")}</span>
        <div class="grow">
          <div class="bold" style="font-size:1rem">ระบบควบคุมน้ำ IoT</div>
          <div style="font-size:.76rem;opacity:.85">สั่งเปิด-ปิดวาล์วจากทุกที่ · รองรับ Valve ID และ Sonoff DIY</div>
        </div>
      </div>
    </div>
    <div class="section-title" data-tkey="iotTitle">${T("iotTitle")} (${S.valves.length})</div>
    <div class="card-grid">
    ${S.valves.map(v => `
      <div class="card">
        <div class="row">
          <div class="plot-emoji">${ic("droplet")}</div>
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
              ${v.schedule.length === 0 ? `<span class="muted" style="font-size:.74rem">ยังไม่มีกำหนดการ</span>` : v.schedule.map(s => `<span class="badge badge-blue">${ic("clock")} ${s.start}–${s.end}</span>`).join("")}
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="App.modalValve('${v.id}')">${ic("clock")} ตั้งเวลา</button>
        </div>
      </div>`).join("")}
    </div>
    <div class="muted" style="font-size:.72rem;text-align:center;padding:6px">${ic("gear")} ตั้งเวลาล่วงหน้า (Schedule) หรือควบคุมตามปริมาณน้ำ (Volume Control) — เร็วๆ นี้</div>`;
}
App.toggleValve = function (id) {
  const v = S.valves.find(x => x.id === id);
  if (!v) return;
  v.state = v.state === "on" ? "off" : "on";
  saveState(S);
  render();
  toast(v.state === "on" ? `เปิด ${v.name}` : `ปิด ${v.name}`);
};

/* ---------------- Settings ---------------- */
const ADMIN_LS = "fus_admin_unlocked";
function adminUnlocked() { return sessionStorage.getItem(ADMIN_LS) === "1"; }
function renderSettings() {
  const unlocked = adminUnlocked();
  let editorHtml = "";
  if (!unlocked) {
    if (!S.adminPass) {
      /* ยังไม่เคยตั้งรหัส — ตั้งครั้งแรก */
      editorHtml = `
      <div class="section-title">${ic("wrench")} โหมดแก้ไขเว็บ <span class="badge badge-blue">ผู้ดูแล</span></div>
      <div class="card">
        <div class="muted" style="font-size:.78rem;margin-bottom:10px">ตั้งรหัสผ่านครั้งแรก เพื่อเปิดสิทธิ์แก้ไขคำในเว็บ เลื่อนตำแหน่ง UI และเพิ่มเมนูเอง</div>
        <div class="field"><label>รหัสผ่านใหม่ *</label><input id="admP1" type="password" placeholder="อย่างน้อย 4 ตัวอักษร"></div>
        <div class="field"><label>ยืนยันรหัสผ่าน *</label><input id="admP2" type="password" placeholder="พิมพ์อีกครั้ง"></div>
        <button class="btn btn-primary btn-block" onclick="App.setAdminPass()">${ic("lock")} ตั้งรหัสผ่าน</button>
      </div>`;
    } else {
      /* มีรหัสแล้ว — ต้องปลดล็อก */
      editorHtml = `
      <div class="section-title">${ic("wrench")} โหมดแก้ไขเว็บ <span class="badge badge-blue">ผู้ดูแล</span></div>
      <div class="card">
        <div class="muted" style="font-size:.78rem;margin-bottom:10px">ใส่รหัสผ่านเพื่อปลดล็อกสิทธิ์แก้ไขเว็บ (คำในเว็บ / เรียงตำแหน่ง UI / เพิ่มเมนู)</div>
        <div class="field"><label>รหัสผ่าน</label><input id="admP1" type="password" placeholder="••••••"></div>
        <button class="btn btn-primary btn-block" onclick="App.unlockAdmin()">${ic("unlock")} ปลดล็อก</button>
      </div>`;
    }
  } else {
    /* ปลดล็อกแล้ว — แสดงเครื่องมือแก้ไข */
    editorHtml = adminToolsHtml();
  }
  return `
    <div class="section-title" data-tkey="settingsTitle">${T("settingsTitle")}</div>
    <div class="card">
      <div class="row">
        <div class="plot-emoji">${ic("leaf")}</div>
        <div class="grow">
          <div class="plot-name">${T("brandName")} v${S.version}</div>
          <div class="muted">${T("brandSub")} · ออกแบบเป็นเว็บคอมพิวเตอร์ ใช้งานง่ายทั้งจอใหญ่และจอเล็ก</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="row row-between"><span class="muted">ข้อมูลทั้งหมด</span><span class="small bold">บันทึกในเบราว์เซอร์ (LocalStorage)</span></div>
      <div class="row row-between mt-8"><span class="muted">โหมดเริ่มต้น</span><span class="small bold">${ROLE_META[S.role].label}</span></div>
      <div class="row row-between mt-8"><span class="muted">เวอร์ชัน</span><span class="small bold">v${S.version}</span></div>
    </div>
    ${editorHtml}
    <button class="btn btn-ghost btn-block" onclick="App.startTour()">${ic("compass")} แนะนำระบบ (Tour) อีกครั้ง</button>
    <button class="btn btn-danger-soft btn-block mt-8" onclick="App.resetData()">${ic("refresh")} รีเซ็ตข้อมูลทั้งหมด</button>
    <div class="muted mt-8" style="font-size:.7rem;text-align:center">ระบบจะเชื่อมข้อมูลสภาพอากาศและ IoT จริงในเวอร์ชันถัดไป</div>`;
}
/* เครื่องมือแก้ไข (ใช้ทั้งในหน้าตั้งค่า และ modal จากปุ่ม ✏️ แก้ไขหัวเว็บ) */
function adminToolsHtml() {
  const order = homeOrder();
  const HOME_LABELS = { cal: "ปฏิทิน + งานวันที่", tasks: "งานที่ต้องทำเร็วๆ นี้", profit: "กำไร/ขาดทุนรายแปลง", activity: "กิจกรรมล่าสุด" };
  return `
      <div class="row row-between section-title">
        <span>${ic("wrench")} โหมดแก้ไขเว็บ <span class="badge badge-green">ปลดล็อกแล้ว</span></span>
        <button class="btn btn-sm btn-ghost" onclick="App.lockAdmin()">${ic("lock")} ล็อก</button>
      </div>

      <div class="section-title">${ic("pencil")} แก้ไขคำในเว็บ</div>
      <div class="card">
        <div class="muted" style="font-size:.72rem;margin-bottom:8px">หรือกดปุ่ม ${ic("pencil")} เล็กๆ ข้างหัวข้อในทุกหน้า เพื่อแก้ไขตรงจุดนั้นได้เลย</div>
        ${EDITABLE_TEXTS.map(e => `
        <div class="field"><label>${esc(e.label)}</label><input id="ed_${e.key}" value="${esc(T(e.key))}"></div>`).join("")}
        <button class="btn btn-primary btn-block" onclick="App.saveTexts()">${ic("save")} บันทึกคำทั้งหมด</button>
      </div>

      <div class="section-title">เรียงลำดับหน้าแรก</div>
      <div class="card">
        <div class="muted" style="font-size:.72rem;margin-bottom:6px">เลื่อนขึ้น/ลง เพื่อจัดตำแหน่ง section บนหน้าแรก (จอคอม: ช่องที่ 1 อยู่คอลัมน์ซ้ายยาว · จอเล็ก: เรียงตามลำดับ)</div>
        ${order.map((k, i) => `
        <div class="ed-row">
          <span class="grow">${HOME_LABELS[k] || k}</span>
          <button class="btn btn-sm btn-ghost" onclick="App.homeMove(${i}, -1)" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="btn btn-sm btn-ghost" onclick="App.homeMove(${i}, 1)" ${i === order.length - 1 ? "disabled" : ""}>↓</button>
        </div>`).join("")}
        <button class="btn btn-ghost btn-block mt-8" onclick="App.homeReset()">${ic("refresh")} คืนค่าเริ่มต้น</button>
      </div>

      <div class="section-title">${ic("plus")} เมนูที่เพิ่มเอง (หน้าเพิ่มเติม)</div>
      <div class="card">
        ${(S.customMenus || []).length === 0 ? `<div class="muted" style="font-size:.76rem;text-align:center;padding:6px">ยังไม่มีเมนูที่เพิ่มเอง</div>` : ""}
        ${(S.customMenus || []).map((m, i) => `
        <div class="ed-row">
          <span class="mc-ico" style="width:auto">${m.ico && ICONS[m.ico] ? ic(m.ico) : esc(m.ico || "")}</span>
          <div class="grow">
            <div class="bold" style="font-size:.85rem">${esc(m.name)}</div>
            <div class="muted" style="font-size:.68rem">${esc(m.desc || "")}</div>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="App.modalMenu(${i})">${ic("pencil")}</button>
          <button class="btn btn-sm btn-danger-soft" onclick="App.deleteMenu(${i})">${ic("trash")}</button>
        </div>`).join("")}
        <button class="btn btn-primary btn-block mt-8" onclick="App.modalMenu(-1)">${ic("plus")} เพิ่มเมนู</button>
      </div>`;
}
/* เปิดเครื่องมือแก้ไขเป็น modal — ใช้ได้จากทุกหน้า (ปุ่ม ✏️ แก้ไขที่หัวเว็บ) */
App.openEditor = function () {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    ${adminToolsHtml()}`);
};
App.setAdminPass = function () {
  const p1 = (document.getElementById("admP1").value || "").trim();
  const p2 = (document.getElementById("admP2").value || "").trim();
  if (p1.length < 4) { toast("รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร"); return; }
  if (p1 !== p2) { toast("รหัสผ่านไม่ตรงกัน"); return; }
  S.adminPass = p1;
  saveState(S);
  sessionStorage.setItem(ADMIN_LS, "1");
  render();
  toast("ตั้งรหัสผ่านแล้ว");
};
App.unlockAdmin = function () {
  const p = (document.getElementById("admP1").value || "").trim();
  if (p === S.adminPass) {
    sessionStorage.setItem(ADMIN_LS, "1");
    render();
    toast("ปลดล็อกโหมดแก้ไขเว็บ");
  } else {
    toast("รหัสผ่านไม่ถูกต้อง");
  }
};
App.lockAdmin = function () {
  sessionStorage.removeItem(ADMIN_LS);
  render();
  toast("ล็อกแล้ว");
};
App.saveTexts = function () {
  const t = {};
  EDITABLE_TEXTS.forEach(e => {
    const el = document.getElementById("ed_" + e.key);
    const v = (el ? el.value : "").trim();
    if (v && v !== e.def) t[e.key] = v;
  });
  S.texts = t;
  saveState(S);
  render();
  toast("บันทึกคำแล้ว");
};
App.homeMove = function (i, dir) {
  const o = homeOrder();
  const j = i + dir;
  if (j < 0 || j >= o.length) return;
  const tmp = o[i]; o[i] = o[j]; o[j] = tmp;
  S.homeOrder = o;
  saveState(S);
  render();
};
App.homeReset = function () {
  S.homeOrder = ["cal", "tasks", "profit", "activity"];
  saveState(S);
  render();
  toast("คืนลำดับเริ่มต้นแล้ว");
};
App.modalMenu = function (i) {
  const m = i >= 0 ? S.customMenus[i] : null;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${m ? "แก้ไขเมนู" : "เพิ่มเมนู"}</h3>
    <div class="modal-sub">เมนูจะแสดงในหน้าเพิ่มเติม — ใส่ชื่อ ไอคอน และปลายทาง (URL หรือชื่อหน้าในระบบ เช่น home / plots / stock / planner / analytics)</div>
    <div class="field"><label>ชื่อเมนู *</label><input id="m_name" value="${m ? esc(m.name) : ""}" placeholder="เช่น ติดต่อเรา"></div>
    <div class="field"><label>ไอคอน (ชื่อไอคอน เช่น leaf, truck, gear)</label><input id="m_ico" value="${m ? esc(m.ico || "") : ""}" placeholder="เช่น leaf, truck, gear"></div>
    <div class="field"><label>คำอธิบาย</label><input id="m_desc" value="${m ? esc(m.desc || "") : ""}" placeholder="เช่น โทรหาเจ้าของฟาร์ม"></div>
    <div class="field"><label>ปลายทาง *</label><input id="m_target" value="${m ? esc(m.target || "") : ""}" placeholder="https://... หรือ home, plots, stock..."></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveMenu(${i})">${m ? "บันทึก" : "เพิ่ม"}</button>
    </div>`);
};
App.saveMenu = function (i) {
  const name = (document.getElementById("m_name").value || "").trim();
  const target = (document.getElementById("m_target").value || "").trim();
  if (!name || !target) { toast("กรอกชื่อและปลายทางก่อน"); return; }
  const data = {
    name,
    ico: (document.getElementById("m_ico").value || "link").trim(),
    desc: (document.getElementById("m_desc").value || "").trim(),
    target
  };
  if (i >= 0) S.customMenus[i] = data; else S.customMenus.push(data);
  saveState(S);
  closeModal();
  render();
  toast("บันทึกเมนูแล้ว");
};
App.deleteMenu = function (i) {
  App.confirm("ลบเมนูนี้?", "", () => {
    S.customMenus.splice(i, 1);
    saveState(S);
    render();
    toast("ลบเมนูแล้ว");
  });
};
/* เปิดเมนูที่ผู้ดูแลเพิ่ม — ถ้าเป็น URL เปิดแท็บใหม่, ถ้าเป็นหน้าในระบบไปที่หน้านั้น */
App.goTarget = function (target) {
  if (!target) return;
  if (/^https?:\/\//i.test(target)) { window.open(target, "_blank"); return; }
  App.nav(target);
};

App.resetData = function () {
  App.confirm("รีเซ็ตข้อมูลทั้งหมด?", "ข้อมูลที่บันทึกไว้ทั้งหมดจะกลับไปเป็นข้อมูลตัวอย่าง ต้องการดำเนินการต่อหรือไม่?", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
};

/* ---------------- More ---------------- */
function renderMore() {
  return `
    <div class="section-title" data-tkey="moreTitle">${T("moreTitle")}</div>
    <div class="more-grid">
      <button class="more-card" onclick="App.nav('equipment')"><span class="mc-ico">${ic("truck")}</span><span class="mc-name">จัดการอุปกรณ์</span><span class="mc-desc">เครื่องจักร ค่าเสื่อมราคา ซ่อมบำรุง</span></button>
      <button class="more-card" onclick="App.nav('iot')"><span class="mc-ico">${ic("wifi")}</span><span class="mc-name">ควบคุมน้ำ IoT</span><span class="mc-desc">วาล์ว ปั๊ม ตั้งเวลาอัตโนมัติ</span></button>
      <button class="more-card" onclick="App.nav('settings')"><span class="mc-ico">${ic("gear")}</span><span class="mc-name">ตั้งค่า</span><span class="mc-desc">ข้อมูลระบบ รีเซ็ต ทัวร์</span></button>
      <button class="more-card" onclick="App.startTour()"><span class="mc-ico">${ic("compass")}</span><span class="mc-name">แนะนำระบบ</span><span class="mc-desc">ทัวร์หน้าจอทีละขั้นตอน</span></button>
      ${(S.customMenus || []).map(m => `
      <button class="more-card" onclick="App.goTarget('${esc(m.target || "")}')"><span class="mc-ico">${m.ico && ICONS[m.ico] ? ic(m.ico) : esc(m.ico || "")}</span><span class="mc-name">${esc(m.name)}</span><span class="mc-desc">${esc(m.desc || "")}</span></button>`).join("")}
    </div>
    <div class="card mt-12">
      <div class="bold" style="font-size:.9rem">${ic("info")} เกี่ยวกับ v52</div>
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
/* ป๊อปอัปเลือกได้หลายปุ่ม — ใช้ตอนถาม "ใช้ของจากสต็อกแล้วหรือยัง?" */
function confirmChoice(title, text, buttons, onPick) {
  /* buttons: [{ label, cls, value }] */
  openModal(`
    <h3>${esc(title)}</h3>
    <div class="modal-sub">${esc(text || "")}</div>
    <div class="modal-actions">
      ${buttons.map(b => `<button class="btn ${b.cls || "btn-ghost"}" data-cv="${esc(b.value)}">${b.label}</button>`).join("")}
    </div>`);
  document.querySelectorAll("[data-cv]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-cv");
      closeModal();
      onPick(v);
    });
  });
}
App.closeModal = closeModal;
App.confirm = confirmModal;
App.confirmChoice = confirmChoice;

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
        <label>พิกัด GPS (ปักหมุด)</label>
        <div class="row" style="gap:8px">
          <input id="f_lat" type="number" step="0.0001" value="${lat}" style="flex:1" placeholder="ละติจูด">
          <input id="f_lng" type="number" step="0.0001" value="${lng}" style="flex:1" placeholder="ลองจิจูด">
        </div>
        <div class="hint">ระบบจะใช้พิกัดนี้ดึงข้อมูลสภาพอากาศในอนาคต</div>
        <button type="button" class="btn btn-sm btn-ghost mt-8" onclick="App.useGps()">${ic("pin")} ใช้ตำแหน่งจริงของฉัน</button>
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
      `<div class="gps-coords">${ic("pin")} ${la.toFixed(4)}, ${ln.toFixed(4)}</div>
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
      toast("ปักหมุดตำแหน่งปัจจุบันแล้ว");
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
    toast("อัปเกรดแปลงเรียบร้อย");
  } else {
    S.plots.push({ id: uid(), name, crop, sizeRai: size, status, lat, lng });
    toast("สร้างแปลงใหม่แล้ว");
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
  toast("เริ่มรอบปลูกแล้ว");
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
      <div class="field"><label>จำนวนเริ่มต้น</label><input id="s_qty" type="number" min="0" step="1" value="0">
        <div class="hint">สต็อกหลักเก็บเป็นจำนวนเต็ม (ถุง/ขวดเต็ม) — ของที่ใช้ไม่หมดจะไปเป็น "ของเหลือจากการเปิดใช้" อัตโนมัติ</div></div>
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
  toast("เพิ่มรายการวัสดุแล้ว");
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
      <div class="field"><label>จำนวนที่รับเข้า * (${esc(item.unit)})</label><input id="r_qty" type="number" min="1" step="1" required>
        <div class="hint">รับเข้าเป็นหน่วยเต็มเท่านั้น — ถ้าซื้อมาครึ่งถุง ระบุ 1 ถุง แล้วส่วนที่เหลือจะไปเป็น "ของเหลือจากการเปิดใช้"</div></div>
      <div class="field"><label>ราคาต่อหน่วย (บาท) *</label><input id="r_price" type="number" min="0" step="0.5" required></div>
      <div class="field" style="background:var(--green-soft);border-radius:10px;padding:10px">
        <div class="row row-between"><span class="muted">ต้นทุนถัวเฉลี่ยเดิม</span><span class="bold">${fmtMoney(item.avgCost)} บาท/${esc(item.unit)}</span></div>
        <div class="row row-between mt-4"><span class="muted">ในสต็อกหลัก</span><span class="bold">${fmtNum(item.qty)} ${esc(item.unit)}</span></div>
        ${(Number(item.openQty) || 0) > 0 ? `<div class="row row-between mt-4"><span class="muted">เหลือจากการเปิดใช้ (ใช้ได้ก่อน)</span><span class="bold">${fmtNum(item.openQty)} ${esc(item.unit)}</span></div>` : ""}
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
  toast(`รับของเข้าแล้ว · ต้นทุนถัวเฉลี่ยใหม่ ${fmtMoney(item.avgCost)} บาท/${item.unit}`);
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
  toast("ตัดสต็อกแล้ว");
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
  toast("ลงทะเบียนอุปกรณ์แล้ว");
  return false;
};

/* ---- task form (used by FAB + planner) ---- */
/* ดูรายละเอียดงาน — กดที่แถวงานเพื่อดูว่าต้องทำอะไร + จัดการได้ */
App.viewTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const p = t.plotId ? plotById(S, t.plotId) : null;
  const c = t.cycleId ? cycleById(S, t.cycleId) : null;
  const st = t.stockId ? stockById(S, t.stockId) : null;
  const rows = [
    { k: "วันที่", v: `${dateLabel(t.date)} (${t.date})` },
    { k: "แปลง", v: p ? p.name : "—" },
    { k: "รอบการปลูก", v: c ? c.plant : "—" },
    { k: "ต้นทุน", v: t.cost ? fmtMoney(t.cost) + " บาท" : "—" },
    { k: "รายรับ", v: t.revenue ? fmtMoney(t.revenue) + " บาท" : "—" },
  ];
  /* รายการค่าใช้จ่ายย่อย (ถ้ามีหลายรายการในงานเดียว) */
  const costItems = (t.costItems && t.costItems.length ? t.costItems : [])
    .filter(it => it.name || it.stockId || it.qty > 0 || it.totalCost > 0);
  const costListHtml = costItems.length ? `
    <div class="td-cost-title">${ic("dollar")} ค่าใช้จ่าย / ตัดสต็อก (${costItems.length} รายการ)</div>
    <div class="td-cost-list">
      ${costItems.map(it => {
        const si = it.stockId ? stockById(S, it.stockId) : null;
        const name = it.name || (si ? si.name : "");
        const meta = [];
        if (si) meta.push("จากสต็อก");
        if (it.qty) meta.push(fmtNum(it.qty) + (it.unit ? " " + it.unit : ""));
        const cat = COST_CAT_MAP[it.category];
        if (cat) meta.push(cat.label);
        return `<div class="td-cost-row"><span>${esc(name)} ${meta.length ? `<span class="muted" style="font-size:.68rem">${esc(meta.join(" · "))}</span>` : ""}</span><b>${fmtMoney(it.totalCost)}</b></div>`;
      }).join("")}
    </div>` : "";
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${esc(t.title)}</h3>
    <div class="modal-sub">${typeTag(t)} ${statusTag(taskStatusOf(t))}</div>
    <div class="td-list">
      ${rows.map(r => `<div class="td-row"><span class="td-k">${r.k}</span><span class="td-v">${esc(r.v)}</span></div>`).join("")}
    </div>
    ${costListHtml}
    <div class="td-note">
      <div class="td-note-title">${ic("info")} สิ่งที่ต้องทำ</div>
      ${t.note ? `<div class="td-note-body">${esc(t.note)}</div>` : `<div class="muted" style="font-size:.76rem">ยังไม่มีรายละเอียด — กดแก้ไขเพื่อเพิ่มสิ่งที่ต้องทำ</div>`}
    </div>
    <div class="modal-actions">
      <button class="btn btn-sm btn-danger-soft" onclick="App.deleteTask('${t.id}')">${ic("trash")} ลบ</button>
      <button class="btn btn-sm btn-outline" onclick="App.editTask('${t.id}')">${ic("pencil")} แก้ไข</button>
      <button class="btn btn-sm btn-primary" onclick="App.toggleTask('${t.id}')">${ic("check")} ${t.status === "done" ? "ยกเลิกเสร็จ" : "ทำเสร็จ"}</button>
      <button class="btn btn-sm btn-ghost" onclick="App.gotoCalendar('${t.date}')">${ic("calendar")} ไปดูในปฏิทิน</button>
    </div>`);
};
/* กระโดดไปที่ปฏิทิน (หน้า Planner) แล้วเลือกวันที่ของงานนั้นทันที */
App.gotoCalendar = function (iso) {
  if (!iso) return;
  const parts = iso.split("-").map(Number);
  if (parts.length === 3) {
    cal.y = parts[0];
    cal.m = parts[1] - 1;
    cal.sel = iso;
  }
  closeModal();
  route.view = "planner";
  render();
};
/* แก้ไขงาน — โหลดค่าปัจจุบันใส่ฟอร์ม */
App.editTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (t) App.modalTask(t.date, { taskId: t.id });
};
/* ===== รายการค่าใช้จ่าย/ตัดสต็อก (หลายรายการต่องาน — แบบเว็บอ้างอิง) ===== */
let taskCostItems = [];   // state ชั่วคราวระหว่างเปิด modal
let taskStockQueries = {}; // คำค้นหาสต็อก ต่อรายการ (index -> string) เพื่อไม่ให้ rebuild ขณะพิมพ์
/* รายการสต็อกใน picker (กรองตามคำค้น) */
function stockPickItemsHtml(i) {
  const it = taskCostItems[i];
  if (!it) return "";
  const q = (taskStockQueries[i] || "").trim().toLowerCase();
  const list = S.stock.filter(x => !q || x.name.toLowerCase().includes(q) || x.unit.toLowerCase().includes(q));
  if (!list.length) return `<div class="muted" style="font-size:.72rem;padding:6px 2px">ไม่พบรายการที่ค้นหา</div>`;
  return list.map(x => {
    const open = Number(x.openQty) || 0;
    const sel = it.stockId === x.id;
    const sub = open > 0 ? `หลัก ${fmtNum(x.qty)} + เหลือเปิด ${fmtNum(open)} ${esc(x.unit)}` : `คงเหลือ ${fmtNum(x.qty)} ${esc(x.unit)}`;
    return `<button type="button" class="stock-pick-item ${sel ? "selected" : ""}" onclick="App.costSet(${i}, 'stockId', '${x.id}')">
      <span class="sp-name">${esc(x.name)}</span><span class="sp-sub">${sub}</span>
    </button>`;
  }).join("");
}
/* พิมพ์ค้นหาสต็อก -> อัปเดตเฉพาะ list ของรายการนั้น (ไม่ rebuild = พิมพ์ต่อเนื่องได้) */
App.costStockQuery = function (i, v) {
  taskStockQueries[i] = v;
  const el = document.getElementById("stockPickList_" + i);
  if (el) el.innerHTML = stockPickItemsHtml(i);
};
/* เปิด/ปิดกล่องบันทึกค่าใช้จ่าย / ตัดสต็อก */
App.taskToggleCost = function () {
  const on = document.getElementById("t_usecost").checked;
  const box = document.getElementById("costBox");
  if (box) box.style.display = on ? "" : "none";
  if (on) App.costRender();
};
/* เปิด/ปิดกล่องบันทึกการเก็บเกี่ยว */
App.taskToggleHarvest = function () {
  const on = document.getElementById("t_useharvest").checked;
  const box = document.getElementById("harvestBox");
  if (box) box.style.display = on ? "" : "none";
  if (on) App.taskCalcHarvest();
};
/* render รายการค่าใช้จ่ายทั้งหมดลงกล่อง */
App.costRender = function () {
  const list = document.getElementById("costItemsList");
  if (!list) return;
  list.innerHTML = taskCostItems.map((it, i) => `
    <div class="usage-row" data-ci="${i}">
      <div class="usage-row-head">
        <strong>รายการที่ ${i + 1}</strong>
        <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.costRemove(${i})">${ic("trash")} ลบ</button>
      </div>
      <div class="form-row-2">
        <div class="field"><label>หมวดหมู่</label><select onchange="App.costSet(${i}, 'category', this.value)">
          ${COST_CATS.map(c => `<option value="${c.key}" ${(it.category || "other") === c.key ? "selected" : ""}>${c.label}</option>`).join("")}
        </select></div>
        <div class="field"><label>ตัดจากสต็อก (ถ้ามี)</label>
          <div class="stock-picker">
            <input class="sp-search" type="text" placeholder="ค้นหาปุ๋ย/ยา/เมล็ด..." value="${esc(taskStockQueries[i] || "")}" oninput="App.costStockQuery(${i}, this.value)">
            <div class="stock-pick-list" id="stockPickList_${i}">${stockPickItemsHtml(i)}</div>
          </div>
          <div class="hint">ใช้ของที่เหลือจากการเปิดใช้ก่อน แล้วเบิกจากหลักเป็นหน่วยเต็ม (ปัดขึ้น) เศษเป็นของเหลือ</div>
        </div>
      </div>
      <div class="field"><label>ชื่อรายการ / รายละเอียด</label>
        <input class="ci-name" value="${esc(it.name || "")}" placeholder="เช่น ค่าน้ำมัน, ยาจากร้านนอกสต็อก" oninput="App.costSet(${i}, 'name', this.value)">
      </div>
      <div class="form-row-2">
        <div class="field"><label>จำนวนที่ใช้</label><input class="ci-qty" type="number" min="0" step="0.01" value="${it.qty || ""}" oninput="App.costSet(${i}, 'qty', this.value)"></div>
        <div class="field"><label>หน่วย</label><input class="ci-unit" value="${esc(it.unit || "")}" placeholder="เช่น cc, กก., ขวด" oninput="App.costSet(${i}, 'unit', this.value)"></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>ราคาต่อหน่วย</label><input class="ci-price" type="number" min="0" step="0.01" value="${it.unitCost || ""}" ${it.stockId ? "readonly" : ""} oninput="App.costSet(${i}, 'unitCost', this.value)"></div>
        <div class="field"><label>รวมเป็นเงิน</label><input class="ci-total" type="number" readonly value="${it.totalCost || ""}"></div>
      </div>
    </div>`).join("");
  App.costSum();
};
/* เพิ่มรายการว่าง */
App.costAdd = function () {
  taskCostItems.push({ category: "other", stockId: "", name: "", qty: "", unit: "", unitCost: "", totalCost: 0 });
  App.costRender();
};
App.costRemove = function (i) {
  taskCostItems.splice(i, 1);
  App.costRender();
};
/* อัปเดตค่าในรายการ — อัปเดตเฉพาะ state + ยอดรวม (ไม่ rebuild DOM = พิมพ์ต่อเนื่องได้) */
App.costSet = function (i, field, value) {
  const it = taskCostItems[i];
  if (!it) return;
  it[field] = value;
  const row = document.querySelector(`[data-ci="${i}"]`);
  // เลือกสต็อก -> ดึงราคาถัวเฉลี่ย + หน่วยมาให้อัตโนมัติ + ราคาเป็น read-only
  if (field === "stockId" && value) {
    const item = stockById(S, value);
    if (item) {
      it.unitCost = item.avgCost.toFixed(2);
      if (!it.unit) it.unit = item.unit;
      if (!it.name) it.name = item.name;
    }
    if (row) {
      const priceEl = row.querySelector(".ci-price");
      priceEl.readOnly = !!it.stockId;
      priceEl.value = it.unitCost || "";
      if (!row.querySelector(".ci-unit").value) row.querySelector(".ci-unit").value = it.unit || "";
      if (!row.querySelector(".ci-name").value) row.querySelector(".ci-name").value = it.name || "";
      // อัปเดต highlight ใน picker (รายการที่เลือก)
      const listEl = document.getElementById("stockPickList_" + i);
      if (listEl) listEl.innerHTML = stockPickItemsHtml(i);
    }
  } else if (field === "stockId" && !value) {
    if (row) {
      row.querySelector(".ci-price").readOnly = false;
      const listEl = document.getElementById("stockPickList_" + i);
      if (listEl) listEl.innerHTML = stockPickItemsHtml(i);
    }
  }
  it.totalCost = Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0));
  if (row) row.querySelector(".ci-total").value = it.totalCost || "";
  App.costSum();
};
/* อัปเดตยอดรวมต้นทุนทั้งหมด */
App.costSum = function () {
  const total = taskCostItems.reduce((a, it) => a + (Number(it.totalCost) || 0), 0);
  const sum = document.getElementById("costSum");
  if (sum) sum.textContent = fmtMoney(total) + " บาท";
};
/* คำนวณรายรับรวมสดๆ (ปริมาณ x ราคา) */
App.taskCalcHarvest = function () {
  const qty = Number(document.getElementById("t_hqty").value) || 0;
  const price = Number(document.getElementById("t_hprice").value) || 0;
  const sum = document.getElementById("harvestSum");
  if (sum) sum.textContent = fmtMoney(Math.round(qty * price)) + " บาท";
};
App.modalTask = function (date, preset) {
  preset = preset || {};
  const editing = preset.taskId ? S.tasks.find(x => x.id === preset.taskId) : null;
  const type = editing ? editing.type : (preset.type || "work");
  const title = editing ? editing.title : (preset.title || "");
  const d = editing ? editing.date : (date || todayISO());
  const status = editing ? (editing.status === "done" ? "done" : "planned") : "planned";
  const actCycles = activeCycles(S);
  const hasCost = editing ? (editing.cost > 0 || !!editing.stockId) : false;
  const hasHarvest = editing ? editing.revenue > 0 : false;
  const stockItem = editing && editing.stockId ? stockById(S, editing.stockId) : null;
  const unitPrice = editing ? (stockItem ? stockItem.avgCost.toFixed(2) : (editing.qty ? (editing.cost / editing.qty).toFixed(2) : "")) : "";
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${editing ? "แก้ไขกิจกรรม" : (preset.title ? esc(preset.title) : "เพิ่มกิจกรรมใหม่")}</h3>
    <div class="modal-sub">${editing ? "ปรับข้อมูลกิจกรรม" : (preset.title ? "ทางลัดบันทึกข้อมูลได้รวดเร็วด้วยมือเดียว" : "วางแผนและบันทึกกิจกรรมรายวัน")}</div>
    <form onsubmit="return App.submitTask(event, '${editing ? editing.id : ""}')">
      <div class="form-row-2">
        <div class="field"><label>วันที่ *</label><input id="t_date" type="date" value="${d}" required></div>
        <div class="field"><label>สถานะ</label><select id="t_status">
          <option value="planned" ${status === "planned" ? "selected" : ""}>วางแผนไว้</option>
          <option value="done" ${status === "done" ? "selected" : ""}>เสร็จสิ้น</option>
        </select></div>
      </div>
      <div class="field"><label>ชื่องาน *</label><input id="t_title" value="${esc(title)}" placeholder="เช่น ใส่ปุ๋ยครั้งที่ 2" required></div>
      <div class="field"><label>เลือกพืช / แปลง</label><select id="t_cycle">
        <option value="">-- เลือกรายการ --</option>
        ${actCycles.map(c => { const p = plotById(S, c.plotId); return `<option value="${c.id}" ${editing && editing.cycleId === c.id ? "selected" : ""}>${esc(c.plant)} / ${p ? esc(p.name) : ""}</option>`; }).join("")}
      </select>
      <div class="hint">เลือกรอบที่กำลังดำเนินการ — รายรับ/ต้นทุนจะเข้ารอบและแปลงนั้นทันที</div></div>
      <div class="field"><label>ประเภทกิจกรรม</label><select id="t_type">
        ${Object.keys(TYPE_LABELS).map(k => `<option value="${k}" ${k === type ? "selected" : ""}>${TYPE_LABELS[k]}</option>`).join("")}
      </select></div>

      <label class="option-box"><input type="checkbox" id="t_usecost" onchange="App.taskToggleCost()" ${hasCost ? "checked" : ""}><span>${ic("dollar")} บันทึกค่าใช้จ่าย / ตัดสต็อก</span></label>
      <div id="costBox" class="nested-fields" style="display:${hasCost ? "" : "none"}">
        <div id="costItemsList"></div>
        <button type="button" class="btn btn-sm btn-ghost" onclick="App.costAdd()">${ic("plus")} เพิ่มรายการ</button>
        <div class="usage-total">รวมต้นทุน <strong id="costSum">0 บาท</strong></div>
      </div>

      <label class="option-box"><input type="checkbox" id="t_useharvest" onchange="App.taskToggleHarvest()" ${hasHarvest ? "checked" : ""}><span>${ic("box")} บันทึกการเก็บเกี่ยว</span></label>
      <div id="harvestBox" class="nested-fields" style="display:${hasHarvest ? "" : "none"}">
        <div class="form-row-2">
          <div class="field"><label>ปริมาณ (กก.)</label><input id="t_hqty" type="number" min="0" step="0.01" value="${editing && editing.harvestQty ? editing.harvestQty : ""}" oninput="App.taskCalcHarvest()"></div>
          <div class="field"><label>ราคาต่อหน่วย</label><input id="t_hprice" type="number" min="0" step="0.01" value="${editing && editing.harvestUnitPrice ? editing.harvestUnitPrice : ""}" oninput="App.taskCalcHarvest()"></div>
        </div>
        <div class="usage-total">รายรับรวม <strong id="harvestSum">${fmtMoney(editing ? editing.revenue || 0 : 0)} บาท</strong></div>
        <label class="option-box inline-option"><input type="checkbox" id="t_finishcycle" ${editing && editing.finishCycle ? "checked" : ""}><span>ติ๊กจบการปลูกรอบนี้ (เก็บเกี่ยวหมดแล้ว)</span></label>
      </div>

      <div class="field"><label>สิ่งที่ต้องทำ / รายละเอียดเพิ่มเติม</label>
        <textarea id="t_note" rows="3" placeholder="เช่น ใช้ปุ๋ยสูตร 46-0-0 อัตรา 20 กก./ไร่ รดน้ำตามหลังทันที">${editing ? esc(editing.note || "") : ""}</textarea>
        <div class="hint">เขียนขั้นตอนหรือสิ่งที่ต้องทำ — จะแสดงเมื่อกดดูรายละเอียดกิจกรรม</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${editing ? "บันทึกการแก้ไข" : "บันทึกกิจกรรม"}</button>
      </div>
    </form>`);
  // ตั้งค่ารายการค่าใช้จ่ายเริ่มต้น (จากงานเดิม หรือ 1 รายการว่าง)
  if (editing && editing.costItems && editing.costItems.length) {
    taskCostItems = editing.costItems.map(x => ({ ...x }));
  } else if (editing && (editing.cost > 0 || editing.stockId)) {
    taskCostItems = [{
      category: editing.costCat || defaultCostCat(editing.type),
      stockId: editing.stockId || "",
      name: editing.stockName || "",
      qty: editing.qty || "",
      unit: editing.unit || "",
      unitCost: editing.qty ? (editing.cost / editing.qty).toFixed(2) : editing.cost || "",
      totalCost: editing.cost || 0
    }];
  } else {
    taskCostItems = [{ category: defaultCostCat(type), stockId: "", name: "", qty: "", unit: "", unitCost: "", totalCost: 0 }];
  }
  App.costRender();
  // ทางลัดจากปุ่ม "เพิ่มกิจกรรม" ของแปลง -> เลือกรอบของแปลงนั้น
  if (!editing && preset.plotId) {
    const c = actCycles.find(x => x.plotId === preset.plotId);
    if (c) document.getElementById("t_cycle").value = c.id;
  }
};
App.submitTask = function (e, editId) {
  e.preventDefault();
  const title = document.getElementById("t_title").value.trim();
  if (!title) return false;
  const useCost = document.getElementById("t_usecost").checked;
  const useHarvest = document.getElementById("t_useharvest").checked;
  const hqty = Number(document.getElementById("t_hqty").value) || 0;
  const hprice = Number(document.getElementById("t_hprice").value) || 0;
  /* รวบรวมรายการค่าใช้จ่าย: เฉพาะรายการที่มีข้อมูล (ชื่อ/จำนวน/สต็อก/ราคา) */
  const costItems = taskCostItems
    .map(it => ({
      category: it.category || "other",
      stockId: it.stockId || null,
      name: (it.name || "").trim(),
      qty: Number(it.qty) || 0,
      unit: (it.unit || "").trim(),
      unitCost: Number(it.unitCost) || 0,
      totalCost: Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0))
    }))
    .filter(it => it.name || it.stockId || it.qty > 0 || it.unitCost > 0);
  const totalCost = costItems.reduce((a, it) => a + it.totalCost, 0);
  const data = {
    title,
    type: document.getElementById("t_type").value,
    date: document.getElementById("t_date").value,
    status: document.getElementById("t_status").value,
    cycleId: document.getElementById("t_cycle").value || null,
    plotId: null,
    costItems: useCost ? costItems : [],
    costCat: useCost && costItems.length ? costItems[0].category : null,
    stockId: useCost && costItems.length ? (costItems.find(it => it.stockId) || costItems[0]).stockId : null,
    qty: useCost && costItems.length ? (costItems.find(it => it.stockId) || costItems[0]).qty : 0,
    unit: useCost && costItems.length ? (costItems.find(it => it.stockId) || costItems[0]).unit : "",
    cost: useCost ? totalCost : 0,
    revenue: useHarvest ? Math.round(hqty * hprice) || 0 : 0,
    harvestQty: useHarvest ? hqty : 0,
    harvestUnitPrice: useHarvest ? hprice : 0,
    finishCycle: useHarvest && document.getElementById("t_finishcycle").checked,
    note: document.getElementById("t_note").value.trim()
  };
  const existing = editId ? S.tasks.find(x => x.id === editId) : null;
  /* บันทึกงาน (ใหม่ หรือแก้ไข) — คืนค่าและปิด modal */
  const commit = (restocked) => {
    // ถ้าติ๊ก "จบการปลูกรอบนี้" -> ปิดรอบทันที
    if (data.finishCycle && data.cycleId) {
      const c = cycleById(S, data.cycleId);
      if (c) c.status = "done";
    }
    saveState(S);
    closeModal();
    render();
    if (restocked) toast("บันทึกแล้ว · คืนสต็อกส่วนที่ไม่ได้ใช้");
  };
  if (existing) {
    // กันไม่ให้ plotId เดิมหายเมื่อเลือกรอบใหม่ / ไม่เลือกรอบ
    if (data.cycleId) {
      const c = cycleById(S, data.cycleId);
      if (c) data.plotId = c.plotId;
    } else {
      data.plotId = existing.plotId;
    }
    const oldUsed = (existing.stockLog && existing.stockLog.length) ? true : false;
    const newUsed = data.costItems.some(it => it.stockId && it.qty > 0) || (data.stockId && data.qty > 0);
    /* กรณีแก้ไขงานที่เคยใช้สต็อก (หรือเพิ่มการใช้ใหม่) → ถามว่าของใช้จริงหรือยัง */
    if (oldUsed || newUsed) {
      const changed = JSON.stringify((existing.costItems || []).map(i => [i.stockId, i.qty]))
        !== JSON.stringify(data.costItems.map(i => [i.stockId, i.qty]));
      if (oldUsed && !newUsed) {
        // เคยใช้สต็อกแต่ตอนแก้ไขเอาออก → ถามว่าจะคืนไหม
        confirmChoice("ได้ใช้ของจากสต็อกแล้วหรือยัง?",
          "งานนี้เคยเบิกของจากสต็อก ${existing.costItems.filter(i => i.stockId).length} รายการ ตอนนี้คุณนำรายการสต็อกออก — ถ้ายังไม่ได้ใช้จริง ระบบจะคืนของเข้าสต็อก",
          [
            { label: "ยังไม่ได้ใช้ — คืนสต็อก", cls: "btn-primary", value: "restock" },
            { label: "ใช้แล้ว", cls: "btn-ghost", value: "keep" },
            { label: "ยกเลิก", cls: "btn-danger-soft", value: "cancel" }
          ],
          v => {
            if (v === "cancel") return;
            if (v === "restock") restockTask(S, existing);
            Object.assign(existing, data);
            existing.costItems = [];
            existing.cost = 0; existing.stockId = null; existing.qty = 0; existing.stockLog = [];
            existing.updatedAt = Date.now();
            toast(v === "restock" ? "บันทึกแล้ว · คืนสต็อกแล้ว" : "บันทึกแล้ว (ไม่คืนสต็อก)");
            commit();
          });
        return false;
      }
      if (changed && newUsed) {
        // เปลี่ยนจำนวน/รายการสต็อก → ถามว่าจะคืนแล้วตัดใหม่ หรือถือว่าใช้ไปแล้ว
        const diff = describeStockDiff(existing, data);
        confirmChoice("ใช้ของจากสต็อกแล้วหรือยัง?",
          `มีการแก้ไขการใช้สต็อก (${diff}) — ถ้ายังไม่ได้ใช้จริง ระบบจะคืนของเดิมแล้วเบิกใหม่ตามจำนวนที่แก้`,
          [
            { label: "ยังไม่ได้ใช้ — คืนแล้วเบิกใหม่", cls: "btn-primary", value: "restock" },
            { label: "ใช้แล้ว (ไม่คืน)", cls: "btn-ghost", value: "keep" },
            { label: "ยกเลิก", cls: "btn-danger-soft", value: "cancel" }
          ],
          v => {
            if (v === "cancel") return;
            if (v === "restock") restockTask(S, existing);
            Object.assign(existing, data);
            existing.updatedAt = Date.now();
            if (v === "restock") {
              applyStockUse(S, existing);
              toast("บันทึกแล้ว · คืนของเดิมแล้วเบิกใหม่ตามจำนวนที่แก้");
            } else {
              toast("บันทึกแล้ว (ถือว่าใช้ของจริงแล้ว)");
            }
            commit();
          });
        return false;
      }
    }
    Object.assign(existing, data);
    existing.updatedAt = Date.now();
    toast("บันทึกการแก้ไขแล้ว");
    commit();
  } else {
    addTask(S, data);
    const msg = data.revenue > 0 ? `บันทึกกิจกรรมแล้ว · รายรับ ${fmtMoney(data.revenue)} บาท`
      : data.cost > 0 ? "บันทึกกิจกรรมแล้ว · ตัดสต็อก/บันทึกต้นทุนแล้ว"
      : "บันทึกกิจกรรมแล้ว";
    toast(msg);
    commit();
  }
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
    <h3>${ic("clock")} ตั้งเวลา — ${esc(v.name)}</h3>
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
  toast("บันทึกกำหนดการแล้ว");
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
    else App.modalTask(todayISO(), { type: "work", title: "เพิ่มกิจกรรมทั่วไป" });
  });
});

/* ---------------- Interactive tour ---------------- */
const TOUR_STEPS = [
  { sel: ".role-switch", title: "1 · สลับโหมดการใช้งาน", text: "กดที่แถบด้านบนเพื่อเปลี่ยนมุมมองแดชบอร์ด — เกษตรกร ฟาร์มใหญ่ หรือ ธุรกิจ เมนูจะปรับตามโหมดอัตโนมัติ", pos: "below" },
  { sel: "#kpiRow", title: "2 · ตัวเลขสำคัญ (KPI)", text: "กำไรสุทธิ พื้นที่ และรอบปลูก จัดเรียงแนวนอนเสมอ อ่านง่ายทั้งบนคอมและมือถือ เขียว = กำไร แดง = ขาดทุน", pos: "below" },
  { sel: "#fabBtn", title: "3 · ปุ่มลัด (FAB)", text: "ปุ่มกลมมุมขวาล่าง กดแล้วยืดออกเป็นเมนู — บันทึกเก็บเกี่ยว ใส่ปุ๋ย/จ่าย และเพิ่มกิจกรรมทั่วไป ได้ทันที", pos: "left" },
  { sel: "#bottomNav", title: "4 · เมนูหลัก", text: "หน้าแรก แปลง สต็อก กิจกรรม และวิเคราะห์ — บนคอมอยู่เมนูซ้าย บนมือถืออยู่แถบล่าง กดเพื่อสลับหน้าได้ทันที", pos: "below" },
  { sel: "#tourBtn", title: "5 · จบการแนะนำ", text: "พร้อมแล้ว! กดปุ่มแนะนำระบบได้ทุกเมื่อเพื่อดูทัวร์อีกครั้ง ขอให้เพาะปลูกสำเร็จ", pos: "below" },
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
  toast("จบการแนะนำระบบ");
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
const editBtn = document.getElementById("editBtn");
if (editBtn) editBtn.addEventListener("click", () => App.openEditor());
render();
