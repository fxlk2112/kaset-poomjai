/* ============================================================
   FARMULTIMATE SOLUTIONS v52 — app logic
   dashboard, role switcher, plots, stock, equipment, cycles,
   activity planner, IoT, analytics, FAB drawer, interactive tour
   ============================================================ */
"use strict";

/* ---------------- state & bootstrap ----------------
   (S ประกาศใน data.js — ให้ระบบบัญชี (auth.js) สลับ slot ข้อมูลรายบัญชีได้ก่อน render) */
let route = { view: "home", tab: "plots", year: Number(todayISO().slice(0, 4)) };
/* จำหน้าล่าสุดไว้ (sessionStorage — รีเฟรชแล้วอยู่หน้าเดิม ไม่กลับหน้าแรก, เปิดแท็บใหม่เริ่มหน้าแรกปกติ) */
const ROUTE_STORE = "kaset-route-v1";
function saveRoute() {
  try {
    const o = { view: route.view, tab: route.tab, year: route.year };
    if (route.plotId) o.plotId = route.plotId;
    if (route.cycleId) o.cycleId = route.cycleId;
    sessionStorage.setItem(ROUTE_STORE, JSON.stringify(o));
  } catch (e) {}
}
let plotTaskCycle = "";   // กรองงาน/กิจกรรมของแปลงตามรอบการปลูก ("" = ทั้งหมด, "__none__" = ไม่มีรอบ)
let cycTaskFilter = { sort: "new", type: "", status: "", costOnly: false }; // ตัวกรอง/เรียง "งาน/กิจกรรมของรอบนี้" ในหน้ารายละเอียดรอบ
let collapsedCycles = {}; // หน้ารอบการปลูก: แปลงที่กดย่อไว้ (plotId -> true) กันหน้ายาวเกิน
let cycleFilter = { q: "", status: "all" }; // ตัวกรองหน้ารอบการปลูก: q=ค้นหา (ชื่อแปลง/พืช), status=all|active|idle
let cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: todayISO() };

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
  { key: "iotTitle", label: "หน้าระบบน้ำ: ระบบน้ำรายแปลง", def: "ระบบน้ำรายแปลง" },
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
  spray: '<rect x="7" y="9" width="10" height="13" rx="2"/><path d="M10 9V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3"/><line x1="12" y1="5" x2="12" y2="3"/><line x1="15" y1="5" x2="18" y2="5"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><line x1="8" y1="19" x2="8.01" y2="19"/><line x1="12" y1="19" x2="12.01" y2="19"/><line x1="16" y1="19" x2="16.01" y2="19"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  pencil: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h2v2h-2z"/><path d="M19 14h2v2h-2z"/><path d="M14 19h2v2h-2z"/><path d="M18 18h3v3h-3z"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
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
  return `<span class="task-tag" style="background:var(--green-light);color:var(--green)">${ic(TYPE_ICONS[t.type] || "info")} ${TYPE_LABELS[t.type] || t.type}</span>`;
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
  /* แสดงแปลงเจ้าของงาน (ชื่อ + อีโมจิพืช) — ใช้ในหน้าแรก/ปฏิทิน รู้ทันทีว่างานนี้แปลงไหน ไม่ต้องเข้าไปดูรายละเอียด */
  if (opts.showPlot && t.plotId) {
    const p = plotById(S, t.plotId);
    if (p) meta.push(`<span class="task-plot">${cropEmoji(p.crop)} ${esc(p.name)}</span>`);
  }
  /* วัสดุที่ใช้: แสดงชื่อ+จำนวน+หน่วย (เช่น "ใช้ ปุ๋ยเคมี 46-0-0 14 ถุง") — รู้ทันทีว่างานนี้ใช้อะไรไปเท่าไร
     (เดิมขึ้นแค่ "จำนวน 14" ไม่รู้ว่า 14 อะไร) */
  if (t.stockId && t.qty) {
    const st = stockById(S, t.stockId);
    const unit = t.unit || (st && st.unit) || "";
    const extra = (t.costItems || []).filter(i => i.stockId && i.stockId !== t.stockId).length;
    const qtyTxt = fmtNum(t.qty) + (unit ? " " + unit : "");
    meta.push(`<span class="task-use">ใช้ ${st ? esc(st.name) + " " : ""}${qtyTxt}${extra ? ` <span class="task-use-more">+${extra} รายการ</span>` : ""}</span>`);
  } else if (t.qty) {
    /* งานเก็บเกี่ยว (ข้อมูลเก่า): ปริมาณเป็น กก. */
    meta.push(t.type === "harvest" ? `เก็บได้ ${fmtNum(t.qty)} กก.` : "จำนวน " + fmtNum(t.qty));
  }
  if (t.harvestQty) meta.push(`เก็บได้ ${fmtNum(t.harvestQty)} กก.`);
  /* เงิน: รายได้ = เขียว, ต้นทุน = แดง — แยกเห็นชัดว่าเข้า/ออก (ต้นทุนนับจาก costItems หลายรายการด้วย) */
  if (t.revenue) meta.push(`<span class="task-money in">${ic("dollar")} รายได้ ${fmtMoney(t.revenue)} บาท</span>`);
  const itemsCost = (t.costItems && t.costItems.length) ? t.costItems.reduce((a, ci) => a + (ci.totalCost || (Number(ci.qty || 0) * Number(ci.unitCost || 0)) || 0), 0) : 0;
  const costShow = itemsCost > 0 ? itemsCost : Number(t.cost || 0);
  if (costShow > 0) meta.push(`<span class="task-money out">${ic("dollar")} ต้นทุน ${fmtMoney(costShow)} บาท</span>`);
  if (opts.showNote && t.note) meta.push(esc(t.note));
  /* งานที่ยังไม่ผูกกับรอบการปลูก (เมื่อส่ง opts.cycleOptions มา — ใช้ในหน้าแปลง) */
  const noCycle = opts.cycleOptions && (!t.cycleId || !opts.cycleOptions.some(c => c.id === t.cycleId));
  if (noCycle) meta.push(`<span class="task-nocycle">ไม่มีรอบ</span>`);
  const assignSel = noCycle ? `
        <select class="task-cycle-assign" onclick="event.stopPropagation()" onchange="App.assignTaskCycle('${t.id}', this.value)" aria-label="ผูกเข้ารอบการปลูก">
          <option value="">ผูกเข้ารอบการปลูก…</option>
          ${opts.cycleOptions.map(c => `<option value="${c.id}">${esc(c.plant)}</option>`).join("")}
        </select>` : "";
  return `
    <div class="task-row ${done ? "done" : ""}" onclick="App.viewTask('${t.id}')" role="button" tabindex="0">
      <button class="task-dot ${dotCls}" onclick="event.stopPropagation();App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ" title="${st === "done" ? "ยกเลิกเสร็จ" : "ติ๊กเสร็จ"}"></button>
      <div class="grow">
        <div class="task-title">${esc(t.title)}</div>
        ${meta.length ? `<div class="muted">${meta.join(" · ")}</div>` : ""}
        ${assignSel}
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
        <button class="cal-today" onclick="App.calToday()">${ic("calendar")} วันนี้</button>
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
  /* โหมดแชร์: เปิดลิงก์ ?share=... — แสดงแปลงแบบดูอย่างเดียว (ไม่ต้องล็อกอิน) */
  if (typeof Auth !== "undefined" && Auth.shareMode) { App.renderShareView(); return; }
  /* บังคับล็อกอิน: ยังไม่ล็อกอิน (หรือโหลดระบบบัญชีไม่ได้) = ไม่วาดหน้าใด ๆ ของแอป */
  if (typeof Auth === "undefined" || !Auth.session) {
    const vn = document.getElementById("view");
    const nn = document.getElementById("bottomNav");
    const fd = document.getElementById("fabDock");
    if (vn) vn.innerHTML = "";
    if (nn) nn.innerHTML = "";
    if (fd) fd.style.display = "none";
    return;
  }
  const fd = document.getElementById("fabDock");
  if (fd) fd.style.display = "";
  // role switch
  const rs = document.getElementById("roleSwitch");
  rs.innerHTML = Object.keys(ROLE_META).map(k =>
    `<button class="${S.role === k ? "active" : ""}" onclick="App.setRole('${k}')">${ic(ROLE_META[k].ico)} ${ROLE_META[k].label}</button>`
  ).join("");

  // keep route valid for role (sub-views group under their parent nav item)
  const keys = visibleNav().map(n => n.key);
  const VIEW_GROUP = { equipment: "more", iot: "more", settings: "more", prices: "more", weather: "plots", plotDetail: "plots", cycleDetail: "plots" };
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
    plotDetail: renderPlotDetail, cycleDetail: renderCycleDetail,
    prices: renderPrices, weather: renderWeather
  };
  const viewChanged = lastView !== route.view;
  lastView = route.view;
  saveRoute();
  /* ปิดแอนิเมชันตอน re-render ในหน้าเดิม (กันกระพริบ) */
  v.classList.toggle("no-anim", !viewChanged);
  v.innerHTML = (views[route.view] || renderHome)();
  /* หลังวาดหน้า — ดึงสภาพอากาศของแปลง (หน้าแปลง + หน้าสภาพอากาศ) */
  if (route.view === "weather" || route.view === "plotDetail") renderPlotWeather();
  /* หน้าระบบน้ำ: ดึงโน้ตล่าสุดจากเซิร์ฟเวอร์ (ข้ามรอบเพราะฝน ฯลฯ) */
  if (route.view === "iot" && typeof App.waterPullStatus === "function") App.waterPullStatus();
  /* หน้าราคาตลาด: ฝังวิดเจ็ตราคารายวัน */
  if (route.view === "prices" && typeof App.mountRakaWidget === "function") App.mountRakaWidget();
  /* เลื่อนกลับหัวหน้าเฉพาะตอนเปลี่ยนหน้า (เช่น กดเมนู) — ถ้าแค่ re-render ในหน้าเดิม (กดวันปฏิทิน/กรอง/ติ๊กงาน)
     ต้องไม่กระโดดขึ้นบน กันบัคหน้าเด้ง */
  if (viewChanged) {
    v.scrollTop = 0;
    window.scrollTo(0, 0);
  }

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

  updateNotifBadge();
  maybeWarnStorage();
}

App.nav = function (key) {
  route.view = key;
  render();
  /* ปิดแผงแจ้งเตือนเมื่อเปลี่ยนหน้า */
  const np = document.getElementById("notifPanel");
  if (np) np.hidden = true;
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
/* เตือนเมื่อพื้นที่เก็บข้อมูลใกล้เต็ม (โชว์ครั้งเดียวต่อเซสชัน) */
let warnedStorageFull = false;
function maybeWarnStorage() {
  if (warnedStorageFull) return;
  const { pct } = storageHealthInfo();
  if (pct >= 80) {
    warnedStorageFull = true;
    setTimeout(function () {
      try { toast("⚠️ พื้นที่เก็บข้อมูลใกล้เต็ม (" + pct + "%) — ไปที่ ตั้งค่า เพื่อสำรอง/จัดการพื้นที่"); } catch (e) {}
    }, 1200);
  }
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
  const curBE = Number(todayISO().slice(0, 4)) + 543; // ปี พ.ศ. ปัจจุบัน (แสดงกำไรของปีนี้)
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
    .slice(0, 5);
  const selDate = cal.sel || today;
  const selTasks = tasksOn(S, selDate).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));

  const kpiProfit = ytd.net >= 0;
  const kpiClass = kpiProfit ? "pos" : "neg";
  /* กำไรตามแปลง: ใช้ปีปัจจุบัน (สอดคล้องกับ KPI กำไรสุทธิ) — ไม่ใช้ทุกปีปนกัน */
  const curYr = todayISO().slice(0, 4);
  const plotProfits = S.plots.filter(p => p.status === "active").map(p => ({
    p,
    fin: taskFinance(S, t => t.plotId === p.id && t.date.startsWith(curYr))
  }));
  /* รายได้ขายยา/สินค้า — แยกจากกำไร/ขาดทุนของแปลง ไม่ปนกัน (โชว์แค่ตัวเลขสรุป ไม่ขึ้นรายการใบเสร็จให้ยาว) */
  const salesBox = (() => {
    const day = salesToday(S), mo = salesMonth(S), yr = salesRevenue(S), cnt = salesYearCount(S);
    const body = (S.sales || []).length === 0 ? `
      <div class="empty">
        <div class="e-ico">${ic("dollar")}</div>
        <div class="e-title">ยังไม่มีรายการขาย</div>
        <div class="muted">กด "ขายสินค้า" ที่หน้าสต็อก เพื่อออกใบเสร็จและตัดสต็อก</div>
      </div>` : `
      <div class="meta-grid">
        <div class="meta-box"><div class="lb">วันนี้</div><div class="vl">${fmtMoney(day)} บาท</div></div>
        <div class="meta-box"><div class="lb">เดือนนี้</div><div class="vl">${fmtMoney(mo)} บาท</div></div>
        <div class="meta-box"><div class="lb">ปีนี้</div><div class="vl">${fmtMoney(yr)} บาท</div></div>
        <div class="meta-box"><div class="lb">ใบเสร็จปีนี้</div><div class="vl">${cnt} ใบ</div></div>
      </div>`;
    return `
    <div class="section-title">${ic("dollar")} รายได้ขายยา/สินค้า <span class="badge badge-blue">แยกจากกำไรแปลง</span></div>
    <div class="card">
      ${body}
    </div>`;
  })();

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
        <div class="row row-between"><span class="muted">รายได้รวม (พ.ศ. ${curBE})</span><span class="bold">${fmtMoney(ytd.revenue)} บาท</span></div>
        <div class="row row-between mt-4"><span class="muted">ต้นทุนรวม (พ.ศ. ${curBE})</span><span class="bold">${fmtMoney(ytd.cost)} บาท</span></div>
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
    <div class="card" style="border:1.5px solid var(--green-light);background:linear-gradient(135deg,var(--green-soft),var(--card))">
      <div class="row">
        <span class="plot-emoji" style="background:var(--green-light);color:var(--green-deep)">${ic("compass")}</span>
        <div class="grow">
          <div class="bold" style="color:var(--green-deep)">ยินดีต้อนรับสู่ระบบจัดการฟาร์มและร้านค้า</div>
          <div class="muted">จัดการแปลง รอบการปลูก งานรายวัน สต็อกยา/ปุ๋ย ออกใบส่งสินค้า และวิเคราะห์กำไร — ทั้งฟาร์มและร้านค้าในที่เดียว</div>
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
        <div class="kpi-sub">พ.ศ. ${curBE} · ${ytd.net >= 0 ? "กำไร" : "ขาดทุน"}</div>
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

    ${salesBox}

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
          ${selTasks.map(t => taskRowHtml(t, { showPlot: true })).join("")}
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
          ${tToday.length ? `<div class="task-group"><h3>วันนี้</h3>${tToday.map(t => taskRowHtml(t, { showPlot: true })).join("")}</div>` : ""}
          ${tTomorrow.length ? `<div class="task-group"><h3>พรุ่งนี้</h3>${tTomorrow.map(t => taskRowHtml(t, { showDate: t.date !== tomorrow, showPlot: true })).join("")}</div>` : ""}
          ${soon.length ? `<div class="task-group"><h3>เร็วๆ นี้</h3>${soon.map(t => taskRowHtml(t, { showDate: true, showPlot: true })).join("")}</div>` : ""}
          ${overdue.length ? `
            <div class="task-group"><h3>เลยกำหนด</h3>
              ${overdue.slice(0, 3).map(t => taskRowHtml(t, { showDate: true, showPlot: true })).join("")}
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
                <div class="bold" style="font-size:.88rem">${esc(p.name)}</div>
                <div class="muted" style="font-size:.68rem">รายได้ ${fmtMoney(fin.revenue)} · ต้นทุน ${fmtMoney(fin.cost)}${p.sizeRai > 0 ? ` · <b>${fmtMoney(Math.round(fin.cost / p.sizeRai))} บ./ไร่</b>` : ""}</div>
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
            const st = taskStatusOf(t);
            const dotCls = st === "done" ? "dot-green" : st === "overdue" ? "dot-red" : "dot-amber";
            return `
            <div class="row-line" onclick="App.viewTask('${t.id}')" role="button" style="cursor:pointer">
              <span class="task-ico ${esc(t.type)}">${ic(TYPE_ICONS[t.type] || "wrench")}</span>
              <div class="grow">
                <div class="bold" style="font-size:.84rem">${esc(t.title)}</div>
                <div class="muted" style="font-size:.7rem">${act} · ${dateLabel(t.date)} ${typeTag(t)}</div>
              </div>
              <button class="task-dot ${dotCls}" onclick="event.stopPropagation();App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ" title="${st === "done" ? "ยกเลิกเสร็จ" : "ติ๊กเสร็จ"}"></button>
              <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();App.editTask('${t.id}')" aria-label="แก้ไขกิจกรรม" title="แก้ไขกิจกรรม">${ic("pencil")}</button>
              ${statusTag(st)}
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
        <div class="row-line" onclick="App.openCycle('${c.id}')" role="button" tabindex="0" style="cursor:pointer" title="กดดูงาน/กิจกรรมของรอบนี้">
          <span class="plot-emoji sm">${cropEmoji(c.plant)}</span>
          <div class="grow">
            <div class="bold" style="font-size:.88rem">${esc(c.plant)}</div>
            <div class="muted">${p ? esc(p.name) : "—"} · อายุ ${ageDays(c.startDate)} วัน</div>
          </div>
          <div style="text-align:right">
            <div class="bold ${fin.net >= 0 ? "price-trend-up" : "price-trend-down"}" style="font-size:.82rem">${fmtMoney(fin.net)}</div>
            <div class="muted" style="font-size:.66rem">กำไร/ขาดทุน</div>
          </div>
          <span class="muted" style="font-size:1.05rem;margin-left:8px">›</span>
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
    ${active.length + inactive.length === 0 ? `
    <div class="card"><div class="empty"><div class="e-ico">${ic("map")}</div><div class="e-title">ยังไม่มีแปลง</div><div class="muted">กด "＋ แปลงใหม่" เพื่อเริ่มต้น</div></div></div>` : ""}
    <div class="card-grid">
    ${[...active, ...inactive].map(p => {
      const c = S.cycles.find(x => x.plotId === p.id && x.status === "active");
      return `
      <div class="card plot-card">
        <div class="plot-top clickable" onclick="App.openPlot('${p.id}')">
          <div class="plot-emoji">${cropEmoji(p.crop)}</div>
          <div class="grow">
            <div class="plot-name">${esc(p.name)} ${p.status === "active" ? `<span class="badge badge-green">Active</span>` : `<span class="badge badge-gray">ว่าง</span>`}</div>
          </div>
          <span class="muted" style="font-size:1.1rem">›</span>
        </div>
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">ขนาดพื้นที่</div><div class="vl">${fmtNum(p.sizeRai)} ไร่</div></div>
          <div class="meta-box"><div class="lb">พิกัด GPS</div><div class="vl" style="font-size:.72rem"><a class="gps-link" href="${mapLink(p.lat, p.lng)}" target="_blank" rel="noopener">${ic("map")} ${p.lat}, ${p.lng}</a></div></div>
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

  /* หน้ารอบการปลูก: แบ่งตามแปลง — แต่ละแปลงเป็นกลุ่ม (หัวแปลง + รอบทั้งหมดของแปลงนั้น)
     กดหัวแปลงเพื่อย่อ/ขยาย (กันหน้ายาวเกิน) */
  const cycleCardHtml = c => {
    const p = plotById(S, c.plotId);
    const fin = cycleFinance(S, c.id);
    const n = S.tasks.filter(t => t.cycleId === c.id).length;
    return `
      <div class="card cycle-card" onclick="App.openCycle('${c.id}')" role="button" tabindex="0" title="กดดูงาน/กิจกรรมของรอบนี้">
        <div class="row">
          <div class="plot-emoji">${cropEmoji(c.plant)}</div>
          <div class="grow">
            <div class="plot-name">${esc(c.plant)} <span class="badge badge-blue">รอบ ${c.round || "—"}</span></div>
            <div class="muted">เริ่ม ${c.startDate} · อายุ ${ageDays(c.startDate)} วัน</div>
          </div>
          ${c.status === "active" ? `<span class="badge badge-green">กำลังปลูก</span>` : `<span class="badge badge-gray">ปิดรอบ</span>`}
        </div>
        <div class="meta-grid">
          <div class="meta-box"><div class="lb">ต้นทุนรวม</div><div class="vl">${fmtMoney(fin.cost)} บาท</div></div>
          <div class="meta-box"><div class="lb">รายรับรวม</div><div class="vl">${fmtMoney(fin.revenue)} บาท</div></div>
          <div class="meta-box"><div class="lb">กำไร/ขาดทุน</div><div class="vl ${fin.net >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(fin.net)} บาท</div></div>
          <div class="meta-box"><div class="lb">สถานะ</div><div class="vl" style="font-size:.78rem">${fin.revenue > 0 ? "มีผลผลิตแล้ว" : "รอผลผลิต"}</div></div>
        </div>
        <div class="actions-row" style="margin-top:10px">
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.openShareLink('${c.plotId}', '${c.id}')">${ic("user")} แชร์พืชนี้</button>
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();App.modalCycle('${c.plotId}', '${c.id}')">${ic("pencil")} แก้ไขรอบ</button>
          ${c.status === "active" ? `<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();App.completeCycle('${c.id}')">${ic("check")} ปิดรอบการปลูก</button>` : `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.reopenCycle('${c.id}')">${ic("refresh")} เปิดรอบอีกครั้ง</button>`}
        </div>
        <div class="cycle-open-hint">${ic("chevron")} ดู ${n} กิจกรรมของรอบนี้</div>
      </div>`;
  };
  /* กลุ่มแปลง: เรียงตามชื่อแปลง (พจนานุกรมไทย) แล้วกรองตามคำค้น/สถานะ */
  const allGroups = [...S.plots]
    .map(p => ({ p, cs: cycles.filter(c => c.plotId === p.id) }))
    .sort((a, b) => a.p.name.localeCompare(b.p.name, "th"));
  const cycleQ = cycleFilter.q.trim().toLowerCase();
  const plotGroups = allGroups.filter(g => {
    if (cycleQ && !g.p.name.toLowerCase().includes(cycleQ) && !g.cs.some(c => (c.plant || "").toLowerCase().includes(cycleQ))) return false;
    const hasActive = g.cs.some(c => c.status === "active");
    if (cycleFilter.status === "active" && !hasActive) return false;
    if (cycleFilter.status === "idle" && hasActive) return false;
    return true;
  });
  const cntActive = allGroups.filter(g => g.cs.some(c => c.status === "active")).length;
  const cyclesTab = `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem" data-tkey="cyclesTitle">${T("cyclesTitle")} ${cycles.filter(c => c.status === "active").length} รอบ</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalCycle()">${ic("plus")} เริ่มปลูก</button>
    </div>
    <div class="card cycle-filter">
      <input id="cycleFilterQ" type="text" placeholder="ค้นหาชื่อแปลงหรือพืชที่ปลูก..." value="${esc(cycleFilter.q)}" oninput="App.cycleFilterQ(this.value)">
      <div class="stock-tabs">
        <button class="chip ${cycleFilter.status === "all" ? "chip-active" : ""}" onclick="App.cycleFilterStatus('all')">ทั้งหมด <span class="badge">${allGroups.length}</span></button>
        <button class="chip ${cycleFilter.status === "active" ? "chip-active" : ""}" onclick="App.cycleFilterStatus('active')">กำลังปลูก <span class="badge">${cntActive}</span></button>
        <button class="chip ${cycleFilter.status === "idle" ? "chip-active" : ""}" onclick="App.cycleFilterStatus('idle')">ว่าง <span class="badge">${allGroups.length - cntActive}</span></button>
        ${cycleQ ? `<button class="btn btn-sm btn-ghost" style="margin-left:auto" onclick="App.cycleFilterClear()">${ic("refresh")} ล้างตัวกรอง</button>` : ""}
      </div>
    </div>
    ${plotGroups.length === 0 ? `<div class="empty"><div class="e-ico">${ic("search")}</div><div class="e-title">ไม่พบแปลงที่ตรงกับตัวกรอง</div><div class="muted">ลองเปลี่ยนคำค้นหรือสถานะ</div><button class="btn btn-ghost btn-block mt-8" onclick="App.cycleFilterClear()">${ic("refresh")} ล้างตัวกรอง</button></div>` : ""}
    ${plotGroups.map(({ p, cs }) => {
      const isCollapsed = collapsedCycles[p.id];
      const act = cs.filter(c => c.status === "active").length;
      return `
      <div class="card plot-cycle-group">
        <div class="plot-cycle-head" onclick="App.togglePlotCycles('${p.id}')" role="button" tabindex="0" aria-expanded="${!isCollapsed}">
          <div class="plot-emoji">${cropEmoji(p.crop)}</div>
          <div class="grow">
            <div class="plot-name">${esc(p.name)} ${p.status === "active" ? `<span class="badge badge-green">Active</span>` : `<span class="badge badge-gray">ว่าง</span>`}</div>
            <div class="muted">${cs.length} รอบทั้งหมด · ${act} รอบกำลังปลูก</div>
          </div>
          <span class="plot-cycle-chevron">${isCollapsed ? "▸" : "▾"}</span>
        </div>
        ${isCollapsed ? "" : `
        <div class="plot-cycle-body">
          ${cs.length === 0 ? `<div class="muted" style="text-align:center;padding:12px">ยังไม่มีรอบการปลูก — <button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">${ic("plus")} เริ่มปลูก</button></div>`
            : `<div class="cycle-grid">${cs.map(cycleCardHtml).join("")}</div>`}
        </div>`}
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
/* ย่อ/ขยายกลุ่มแปลงในหน้ารอบการปลูก — กดหัวแปลงสลับได้ */
App.togglePlotCycles = function (plotId) {
  collapsedCycles[plotId] = !collapsedCycles[plotId];
  rerender();
};
/* ตัวกรองหน้ารอบการปลูก: ค้นหาชื่อแปลง/พืช — re-render แล้วคืนโฟกัสกลับช่องค้นหา (กันพิมพ์ต่อไม่ได้) */
App.cycleFilterQ = function (v) {
  cycleFilter.q = v;
  const pos = (document.getElementById("cycleFilterQ") || {}).selectionStart;
  rerender();
  const el = document.getElementById("cycleFilterQ");
  if (el) {
    el.focus();
    if (pos != null) { try { el.setSelectionRange(pos, pos); } catch (e) {} }
  }
};
App.cycleFilterStatus = function (st) { cycleFilter.status = st; rerender(); };
App.cycleFilterClear = function () { cycleFilter = { q: "", status: "all" }; rerender(); };

/* ---- ลิงก์แผนที่ Google จากพิกัด GPS (กดแล้วเปิดแผนที่ตำแหน่งแปลงได้เลย) ---- */
function mapLink(lat, lng) {
  return "https://www.google.com/maps?q=" + encodeURIComponent(String(lat)) + "," + encodeURIComponent(String(lng));
}

/* ---- สภาพอากาศรายแปลง (Open-Meteo — ฟรี ไม่ต้องใช้คีย์ ไม่ต้องสมัคร) ---- */
/* แคช 30 นาที เก็บใน localStorage — รีเฟรชหน้าแล้วตัวเลขคงที่ ไม่เปลี่ยนทุกครั้ง */
const WEATHER_TTL = 30 * 60 * 1000;
const WEATHER_STORE = "kaset-weather-cache-v2";
function weatherCacheLoad() {
  try { const raw = localStorage.getItem(WEATHER_STORE); if (raw) return JSON.parse(raw) || {}; } catch (e) {}
  return {};
}
function weatherCacheSave() {
  try { localStorage.setItem(WEATHER_STORE, JSON.stringify(WEATHER_CACHE)); } catch (e) {}
}
let WEATHER_CACHE = weatherCacheLoad();
/* การ์ดสภาพอากาศของแปลง — แสดง loading ก่อน แล้ว renderPlotWeather() ไปดึงข้อมูลจริงมาเติม */
/* การ์ดสภาพอากาศในหน้าแปลง — โชว์อากาศปัจจุบัน + 7 วันทันที (#weatherCard)
   พร้อมแถบเสริม "เทียบ 5 สถานี" กดเข้าหน้าเปรียบเทียบเต็มได้ */
function plotWeatherCard(p) {
  const hasCoords = p && Number(p.lat) && Number(p.lng);
  return `
    <div class="section-title">สภาพอากาศแปลงนี้ <span class="muted" style="font-size:.72rem;font-weight:600">จากพิกัด GPS</span></div>
    <div class="card weather-card" id="weatherCard">
      ${hasCoords ? `<div class="weather-loading">${ic("pin")} กำลังดึงสภาพอากาศของ ${esc(p.name)}...</div>`
        : `<div class="weather-note">${ic("pin")} ยังไม่มีพิกัด GPS ของแปลงนี้ — กด "แก้ไขแปลง" แล้วปักหมุด เพื่อดูสภาพอากาศ</div>`}
    </div>
    ${hasCoords ? `<button class="btn btn-sm btn-outline btn-block mt-8" onclick="App.openWeather('${p.id}')" style="font-size:.76rem">📡 เทียบ 5 สถานีพยากรณ์ <span class="muted" style="font-weight:600">Open-Meteo · ECMWF · GFS · ICON · MET Norway</span> ›</button>` : ""}`;
}

/* ---------------- หน้าสภาพอากาศ (แยกจากหน้าแปลง) ---------------- */
/* เข้าจาก: การ์ดทางเข้าในหน้าแปลง / เมนู "เพิ่มเติม" — แสดงเทียบ 5 สถานี + รายละเอียด 7 วัน + คำเตือน */
function renderWeather() {
  const plots = S.plots.filter(p => Number(p.lat) && Number(p.lng));
  let p = plotById(S, route.plotId);
  if (!p || !(Number(p.lat) && Number(p.lng))) p = plots[0] || null;
  if (p) route.plotId = p.id;
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn btn-sm btn-ghost" onclick="${route.plotId ? `App.openPlot('${route.plotId}')` : "App.nav('plots')"}">← กลับ</button>
    </div>
    <div class="section-title">${ic("droplet")} สภาพอากาศ · เทียบ 5 สถานีพยากรณ์</div>
    ${plots.length === 0 ? `
      <div class="card"><div class="empty"><div class="e-ico">${ic("pin")}</div><div class="e-title">ยังไม่มีแปลงที่ปักพิกัด GPS</div>
      <div class="muted">เพิ่มหรือแก้ไขแปลง แล้วปักหมุดพิกัด เพื่อดึงพยากรณ์อากาศรายแปลง</div>
      <button class="btn btn-primary btn-block mt-8" onclick="App.nav('plots')">${ic("map")} ไปหน้าแปลง</button></div></div>` : `
      <div class="row" style="gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px">
        ${plots.map(pl => `<button class="btn btn-sm ${pl.id === route.plotId ? "btn-primary" : "btn-outline"}" style="white-space:nowrap" onclick="App.wxPickPlot('${pl.id}')">${cropEmoji(pl.crop)} ${esc(pl.name)}</button>`).join("")}
      </div>
      <div class="card weather-card" id="weatherCompare"><div class="weather-loading">⏳ กำลังดึงพยากรณ์จาก 5 สถานี...</div></div>
      <div class="card weather-card" id="weatherCard" style="margin-top:10px"><div class="weather-loading">${ic("pin")} กำลังดึงรายละเอียด 7 วัน...</div></div>`}`;
}
App.wxPickPlot = function (id) { route.plotId = id; render(); };
App.openWeather = function (plotId) { route.view = "weather"; if (plotId) route.plotId = plotId; render(); };

/* ---- เทียบหลายสถานีพยากรณ์ (ฟรีทั้งหมด ไม่ใช้คีย์ · ทดสอบ CORS แล้ว) ----
   1) Open-Meteo best_match (ผสมโมเดลดีที่สุด — มี % ความน่าจะเป็นฝน)
   2) ECMWF IFS ยุโรป (แม่นสุดในโลก)  3) GFS อเมริกา  4) ICON เยอรมนี — ผ่าน Open-Meteo models=
   5) MET Norway (Yr.no นอร์เวย์) — อิสระจาก Open-Meteo จริง (hourly → รวมเป็นรายวันเอง) */
const WX_SOURCES = [
  { key: "best", name: "Open-Meteo ผสม", flag: "🌍",
    url: (la, ln) => "https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + ln + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=auto" },
  { key: "ecmwf", name: "ECMWF ยุโรป", flag: "🇪🇺",
    url: (la, ln) => "https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + ln + "&models=ecmwf_ifs025&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=3&timezone=auto" },
  { key: "gfs", name: "GFS อเมริกา", flag: "🇺🇸",
    url: (la, ln) => "https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + ln + "&models=gfs_seamless&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=auto" },
  { key: "icon", name: "ICON เยอรมนี", flag: "🇩🇪",
    url: (la, ln) => "https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + ln + "&models=icon_seamless&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=3&timezone=auto" },
  { key: "metno", name: "MET Norway", flag: "🇳🇴", custom: true }
];
/* Open-Meteo daily JSON -> [{date, tmax, tmin, mm, prob}] (prob อาจเป็น null ถ้าโมเดลไม่ให้) */
function parseOmDaily(om) {
  const d = om && om.daily; if (!d || !d.time) return [];
  const probs = d.precipitation_probability_max || [];
  return d.time.slice(0, 3).map((date, i) => ({
    date,
    tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i],
    mm: Number(d.precipitation_sum[i] || 0),
    prob: probs[i] == null ? null : Number(probs[i])
  }));
}
/* MET Norway compact (hourly, UTC) -> รวมเป็นรายวันตามเวลาไทย (UTC+7 ไม่มี DST) */
function parseMetNo(mj) {
  const ts = mj && mj.properties && mj.properties.timeseries; if (!ts) return [];
  const byDay = {};
  ts.forEach(e => {
    const day = new Date(new Date(e.time).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
    const det = (e.data && e.data.instant && e.data.instant.details) || {};
    const pr = (e.data.next_1_hours && e.data.next_1_hours.details && e.data.next_1_hours.details.precipitation_amount) ||
               (e.data.next_6_hours && e.data.next_6_hours.details && e.data.next_6_hours.details.precipitation_amount) || 0;
    const d = byDay[day] || (byDay[day] = { date: day, tmax: -99, tmin: 99, mm: 0, prob: null });
    if (det.air_temperature != null) { d.tmax = Math.max(d.tmax, det.air_temperature); d.tmin = Math.min(d.tmin, det.air_temperature); }
    d.mm += Number(pr || 0);
  });
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
    .map(d => ({ ...d, mm: Math.round(d.mm * 10) / 10, tmax: Math.round(d.tmax), tmin: Math.round(d.tmin) }));
}
/* ดึงข้อมูลสถานีเดียว (แคช 30 นาทีต่อสถานี) -> [{date,tmax,tmin,mm,prob}] */
function wxSourceDays(p, src) {
  const key = p.id + "|" + p.lat + "," + p.lng + "|" + src.key;
  const hit = WEATHER_CACHE[key];
  if (hit && Date.now() - hit.t < WEATHER_TTL) return Promise.resolve(hit.days);
  const req = src.custom
    ? fetch("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + p.lat + "&lon=" + p.lng).then(r => { if (!r.ok) throw new Error("metno " + r.status); return r.json(); }).then(parseMetNo)
    : fetch(src.url(p.lat, p.lng)).then(r => { if (!r.ok) throw new Error(src.key + " " + r.status); return r.json(); }).then(parseOmDaily);
  return req.then(days => { if (days && days.length) { WEATHER_CACHE[key] = { t: Date.now(), days }; weatherCacheSave(); } return days; });
}
/* การ์ดเทียบ 5 สถานี: ตาราง 3 วันข้างหน้า + แถวฉันทามติ (เฉลี่ยทุกสถานี + กี่สถานีชี้ฝนตก) */
function renderWeatherCompare(p) {
  const el = document.getElementById("weatherCompare");
  if (!el || !Number(p.lat) || !Number(p.lng)) return;
  Promise.allSettled(WX_SOURCES.map(s => wxSourceDays(p, s).then(days => ({ s, days })))).then(rs => {
    const ok = rs.filter(r => r.status === "fulfilled" && r.value.days && r.value.days.length).map(r => r.value);
    if (!ok.length) { el.innerHTML = `<div class="weather-note">${ic("alert")} ดึงข้อมูลสถานีพยากรณ์ไม่ได้ (ตรวจสอบอินเทอร์เน็ต)</div>`; return; }
    const fmt1 = n => (n == null ? "—" : (Math.round(Number(n) * 10) / 10).toFixed(1).replace(/\.0$/, ""));
    const cell = (d) => d ? `<div class="wx-mm ${d.mm >= 1 ? "wx-wet" : ""}">💧 ${fmt1(d.mm)} มม.</div>`
      + (d.prob != null ? `<div class="wx-prob">ฝน ${d.prob}%</div>` : "")
      + `<div class="wx-t">${d.tmax != null ? fmt1(d.tmax) + "°" : "—"}</div>` : `<div class="wx-t">—</div>`;
    const dates = ok[0].days.map(d => d.date);
    const heads = dates.map((dt, i) => i === 0 ? "วันนี้" : i === 1 ? "พรุ่งนี้" : dayNameISO(dt));
    const rows = ok.map(({ s, days }) => `
      <tr>
        <td class="wx-src">${s.flag} ${esc(s.name)}</td>
        ${dates.map((_, i) => `<td>${cell(days[i])}</td>`).join("")}
      </tr>`).join("");
    /* ฉันทามติรายวัน: เฉลี่ย มม. + กี่สถานีชี้ว่าฝนตก (มม. >= 1) */
    const cons = dates.map((dt, i) => {
      const vals = ok.map(o => o.days[i]).filter(Boolean);
      const avgMm = vals.length ? vals.reduce((a, d) => a + d.mm, 0) / vals.length : null;
      const probs = vals.map(d => d.prob).filter(v => v != null);
      const avgProb = probs.length ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : null;
      const wetN = vals.filter(d => d.mm >= 1).length;
      const verdict = wetN >= Math.ceil(ok.length * 0.8) ? `<span class="badge badge-blue">ฝนชัด ${wetN}/${ok.length} สถานี</span>`
        : wetN === 0 ? `<span class="badge badge-green">แล้งชัด ${ok.length}/${ok.length} สถานี</span>`
        : `<span class="badge badge-gray">ไม่แน่นอน ${wetN}/${ok.length} สถานี</span>`;
      return `<td><div class="wx-mm ${avgMm >= 1 ? "wx-wet" : ""}">💧 ${fmt1(avgMm)} มม.</div>${avgProb != null ? `<div class="wx-prob">ฝน ${avgProb}%</div>` : ""}<div class="wx-verdict">${verdict}</div></td>`;
    }).join("");
    const failNote = ok.length < WX_SOURCES.length ? `<div class="weather-updated" style="margin-top:6px">⚠️ ${WX_SOURCES.length - ok.length} สถานีดึงไม่สำเร็จชั่วคราว</div>` : "";
    el.innerHTML = `
      <div class="weather-top">
        <div>
          <div class="weather-loc">📡 เทียบ ${ok.length} สถานีพยากรณ์ · ${esc(p.name)}</div>
          <div class="weather-updated">ฝน (มม.) · % ความน่าจะเป็นฝน · อุณหภูมิสูงสุด — อัปเดตทุก 30 นาที</div>
        </div>
      </div>
      <div class="wx-table-wrap"><table class="wx-table">
        <thead><tr><th></th>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}
          <tr class="wx-consensus"><td class="wx-src">🤝 ฉันทามติ</td>${cons}</tr>
        </tbody>
      </table></div>${failNote}`;
  });
}
/* รหัสสภาพอากาศ WMO ของ Open-Meteo -> [คำอธิบายไทย, อีโมจิ] */
const OM_CODES = {
  0: ["ท้องฟ้าแจ่มใส", "☀️"], 1: ["ฟ้าใสบางส่วน", "🌤️"], 2: ["มีเมฆบางส่วน", "⛅"], 3: ["มีเมฆมาก", "☁️"],
  45: ["มีหมอก", "🌫️"], 48: ["หมอก/น้ำค้างแข็ง", "🌫️"],
  51: ["ฝนปรอยเล็กน้อย", "🌦️"], 53: ["ฝนปรอยปานกลาง", "🌦️"], 55: ["ฝนปรอยหนาแน่น", "🌧️"], 56: ["ฝนเยือกแข็งปรอย", "🌧️"], 57: ["ฝนเยือกแข็งปรอยหนา", "🌧️"],
  61: ["ฝนเล็กน้อย", "🌧️"], 63: ["ฝนปานกลาง", "🌧️"], 65: ["ฝนหนัก", "🌧️"], 66: ["ฝนเยือกแข็ง", "🌧️"], 67: ["ฝนเยือกแข็งหนัก", "🌧️"],
  71: ["หิมะเล็กน้อย", "❄️"], 73: ["หิมะปานกลาง", "❄️"], 75: ["หิมะหนัก", "❄️"], 77: ["เกล็ดหิมะ", "🌨️"],
  80: ["ฝนโปรยเล็กน้อย", "🌦️"], 81: ["ฝนโปรยปานกลาง", "🌧️"], 82: ["ฝนโปรยหนัก", "⛈️"], 85: ["หิมะโปรยเล็กน้อย", "🌨️"], 86: ["หิมะโปรยหนัก", "❄️"],
  95: ["พายุฟ้าคะนอง", "⛈️"], 96: ["พายุฟ้าคะนอง + ลูกเห็บ", "⛈️"], 99: ["พายุรุนแรง + ลูกเห็บ", "⛈️"]
};
function omCodeInfo(code) { const w = OM_CODES[code]; return w ? w : ["อากาศแปรปรวน", "🌡️"]; }
/* วันภาษาไทยสั้นจาก ISO date */
function dayNameISO(iso) { try { return "วัน" + THAI_DAYS[new Date(iso + "T12:00:00").getDay()]; } catch (e) { return ""; } }
/* คำเตือนสภาพอากาศเชิงปฏิบัติการ — แปลงพยากรณ์เป็นคำแนะนำทำงานจริง:
   ฝนใน 2 วัน -> เลื่อนพ่นยา/ใส่ปุ๋ย · ลมแรง -> งดฉีด (หยดลอย) · ฝนหนัก -> ระบายน้ำ
   และเทียบกับงานที่วางไว้ของแปลงนี้ (ฉีดยา/ใส่ปุ๋ย/เก็บเกี่ยว) ว่าชนกับฝนไหม */
function weatherAdvisoryHtml(p, c, d) {
  const out = [];
  const probs = d.precipitation_probability_max || [], sums = d.precipitation_sum || [];
  const push = (cls, icon, msg) => out.push(`<div class="adv-banner adv-${cls}"><span>${icon}</span><span>${msg}</span></div>`);
  /* 1) ฝนโปรย 60%+ ใน 2 วันข้างหน้า -> เลื่อนพ่นยา/ใส่ปุ๋ย */
  const rainDays = [];
  for (let i = 1; i <= 2 && i < (d.time || []).length; i++) {
    const pr = probs[i] == null ? 0 : Number(probs[i]);
    if (pr >= 60) rainDays.push({ i, pr, name: i === 1 ? "พรุ่งนี้" : dayNameISO(d.time[i]) });
  }
  if (rainDays.length) {
    const best = Math.max(...rainDays.map(r => r.pr));
    const names = rainDays.map(r => r.name).join(" และ ");
    push("warn", ic("alert"), `พยากรณ์ฝน ${best}% ${names} — <b>เลื่อนพ่นยา/ใส่ปุ๋ย</b>ไปหลังฝนผ่าน ประหยัดกว่า (ยาไม่ถูกฝนชะ)`);
  }
  /* 2) ลมแรงตอนนี้ -> งดฉีดพ่น (หยดลอยเสี่ยง) */
  const wind = Number(c.wind_speed_10m);
  if (wind >= 10) {
    push("danger", "💨", `ลมแรง ${fmtNum(wind)} m/s — <b>งดฉีดพ่นตอนนี้</b> หยดลอยเสี่ยงฟุ้งกระเด็นถึงคน/แปลงข้างเคียง รอลมสงบก่อน`);
  } else if (wind >= 6) {
    push("info", "💨", `ลมปานกลาง ${fmtNum(wind)} m/s — ฉีดพ่นได้ แต่ควรฉีด<b>เช้ามืดหรือเย็น</b> ช่วงลมสงบ และฉีดตามทิศลม`);
  }
  /* 3) ฝนหนัก >= 30 มม. ใน 2 วัน -> เตรียมระบายน้ำ */
  for (let i = 1; i <= 2 && i < (d.time || []).length; i++) {
    const mm = Number(sums[i] || 0);
    if (mm >= 30) { push("warn", "🌧️", `${dayNameISO(d.time[i])} ฝนหนัก ~${fmtNum(mm)} มม. — เตรียม<b>ระบายน้ำแปลง</b> กันขังเน่า และเก็บอุปกรณ์/ถุงปุ๋ยให้พ้นฝน`); break; }
  }
  /* 4) เทียบกับงานที่วางไว้ของแปลงนี้ (3 วันข้างหน้า) */
  const upcoming = S.tasks.filter(t => t.plotId === p.id && t.status === "planned" && t.date &&
    t.date >= todayISO() && t.date <= addDaysISO(todayISO(), 2));
  upcoming.forEach(t => {
    const idx = (d.time || []).indexOf(t.date);
    if (idx < 0 || idx > 2) return;
    const pr = probs[idx] == null ? 0 : Number(probs[idx]);
    const name = esc((t.title || TYPE_LABELS[t.type] || "งาน").slice(0, 40));
    if ((t.type === "spray" || t.type === "fertilize") && pr >= 50) {
      push("warn", ic("spray"), `งาน"${name}" (${dayNameISO(t.date)}) เสี่ยงโดนฝน ${pr}% — พิจารณา<b>เลื่อนวัน</b>หรือทำให้เสร็จก่อนฝนตก`);
    } else if (t.type === "harvest" && (pr >= 50 || Number(sums[idx] || 0) >= 10)) {
      push("danger", ic("box"), `กำหนด<b>เก็บเกี่ยว</b>วัน${dayNameISO(t.date)} แต่มีฝน ${pr}% (~${fmtNum(sums[idx] || 0)} มม.) — ถ้าผลผลิตพร้อม<b>รีบเก็บก่อนฝน</b> คุณภาพดีกว่า`);
    }
  });
  return out.join("");
}

/* ดึงข้อมูลจาก Open-Meteo (ECMWF IFS — แบบจำลองที่แม่นที่สุดในโลก) แล้วเติมลงการ์ด (แคช 30 นาที ตามพิกัด) */
function renderPlotWeather() {
  const el = document.getElementById("weatherCard");
  if (!el) return;
  const p = plotById(S, route.plotId);
  if (!p) return;
  renderWeatherCompare(p); /* การ์ดเทียบหลายสถานี — ดึงขนานกันเอง */
  if (!Number(p.lat) || !Number(p.lng)) return;
  const ckey = p.id + "|" + p.lat + "," + p.lng;
  const hit = WEATHER_CACHE[ckey];
  if (hit && Date.now() - hit.t < WEATHER_TTL) { el.innerHTML = hit.html; fillWeatherAddress(p); return; }
  el.innerHTML = `<div class="weather-loading">${ic("pin")} กำลังดึงสภาพอากาศของ ${esc(p.name)}...</div>`;
  /* Open-Meteo — ฟรี ไม่ต้องใช้คีย์ · best_match = ผสมโมเดลที่ดีที่สุด (มี % ความน่าจะเป็นฝน) 7 วัน */
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.lat + "&longitude=" + p.lng +
    "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code" +
    "&forecast_days=7&timezone=auto";
  fetch(url)
    .then(r => { if (!r.ok) throw new Error("om status " + r.status); return r.json(); })
    .then(om => {
      if (!om || !om.current || !om.daily) throw new Error("empty");
      const c = om.current;
      const d = om.daily;
      const [cond, emoji] = omCodeInfo(c.weather_code);
      /* แสดงทศนิยม 1 ตำแหน่ง (ไม่ปัดเลขทิ้ง — เช่น 31.4°C) */
      const fmt1 = n => (n == null ? "—" : (Math.round(Number(n) * 10) / 10).toFixed(1).replace(/\.0$/, ""));
      const days = (d.time || []).slice(0, 7).map((day, i) => {
        const [dc, de] = omCodeInfo(d.weather_code[i]);
        const probs = d.precipitation_probability_max || [];
        const pr = probs[i] == null ? null : Number(probs[i]);
        return `<div class="wday">
      <div class="wday-name">${THAI_DAYS[new Date(day + "T12:00:00").getDay()]}</div>
      <div class="wday-emoji">${de}</div>
      <div class="wday-temp">${fmt1(d.temperature_2m_max[i])}°/${fmt1(d.temperature_2m_min[i])}°</div>
      <div class="wday-rain">${pr != null ? "ฝน " + pr + "%" : "ฝน " + fmt1(d.precipitation_sum[i]) + " มม."}</div>
    </div>`;
      }).join("");
      const timeStr = c.time ? String(c.time).slice(11, 16) : "";
      const html = `
      <div class="weather-top">
        <div>
          <div class="weather-loc">${ic("pin")} ${esc(p.name)}<span class="weather-addr"></span></div>
          <div class="weather-updated">🌍 Open-Meteo · ECMWF — ข้อมูลล่าสุด ${timeStr} · อัปเดตอัตโนมัติทุก 30 นาที</div>
        </div>
        <a class="weather-map" href="${mapLink(p.lat, p.lng)}" target="_blank" rel="noopener">${ic("map")} แผนที่</a>
      </div>
      <div class="weather-now">
        <span class="weather-emoji">${emoji}</span>
        <div>
          <div class="weather-temp">${fmt1(c.temperature_2m)}°C</div>
          <div class="weather-cond">${cond}</div>
        </div>
      </div>
      <div class="weather-chips">
        <span>💧 ความชื้น ${fmt1(c.relative_humidity_2m)}%</span>
        <span>🌧️ ฝน ${fmt1(c.precipitation)} มม.</span>
        <span>💨 ลม ${fmt1(c.wind_speed_10m)} m/s</span>
      </div>
      ${weatherAdvisoryHtml(p, c, d)}
      <div class="weather-days">${days}</div>`;
      WEATHER_CACHE[ckey] = { t: Date.now(), html };
      weatherCacheSave();
      el.innerHTML = html;
      fillWeatherAddress(p);
    })
    .catch(() => {
      el.innerHTML = `<div class="weather-note">${ic("alert")} ดึงข้อมูลสภาพอากาศไม่ได้ (ตรวจสอบอินเทอร์เน็ต) — ลองใหม่อีกครั้งภายหลัง</div>`;
    });
}
/* ---- ที่อยู่/อำเภอจากพิกัด (Nominatim/OpenStreetMap — ฟรี ไม่ต้องใช้คีย์) ---- */
const GEO_CACHE = {};
function reverseGeocode(p) {
  const gkey = p.lat + "," + p.lng;
  const hit = GEO_CACHE[gkey];
  if (hit && Date.now() - hit.t < 86400000) return Promise.resolve(hit.name);
  return fetch("https://nominatim.openstreetmap.org/reverse?lat=" + p.lat + "&lon=" + p.lng + "&format=json&accept-language=th")
    .then(r => { if (!r.ok) throw new Error("geo"); return r.json(); })
    .then(j => {
      const a = j.address || {};
      const parts = [a.county, a.province, a.city].filter(Boolean);
      const name = parts.length ? parts.join(", ") : "";
      GEO_CACHE[gkey] = { t: Date.now(), name };
      return name;
    })
    .catch(() => "");
}
/* เติมชื่อที่อยู่ (อำเภอ/จังหวัด) ลงการ์ด — โหลดทีหลัง ไม่บล็อกข้อมูลอากาศ */
function fillWeatherAddress(p) {
  const s = document.querySelector("#weatherCard .weather-addr");
  if (!s) return;
  reverseGeocode(p).then(name => { if (s && name) s.textContent = " · 📍 " + name; });
}
/* รีเฟรชสภาพอากาศอัตโนมัติทุก 10 นาที (จริงๆ อัปเดตทุก 30 นาทีตาม TTL แคช) —
   ขณะอยู่หน้ารายละเอียดแปลง ไม่ต้องกดรีเฟรชเอง และเลขไม่เปลี่ยนทุกครั้งที่รีเฟรช */
setInterval(() => {
  if ((route.view === "weather" || route.view === "plotDetail") && document.getElementById("weatherCard")) renderPlotWeather();
}, 600000);

/* ---------------- Plot detail ---------------- */
function renderPlotDetail() {
  const p = plotById(S, route.plotId);
  if (!p) { route.view = "plots"; return renderPlots(); }
  const fin = plotFinance(S, p.id);
  const cycles = S.cycles.filter(c => c.plotId === p.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const tasks = S.tasks.filter(t => t.plotId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const activeCycle = cycles.find(c => c.status === "active");
  /* กรองงาน/กิจกรรมตามรอบการปลูก (ดูเฉพาะรอบที่เลือก) — งานที่ cycleId ไม่อยู่ในรอบของแปลงนี้ ถือว่า "ไม่มีรอบ" ด้วย */
  const noCycleTasks = tasks.filter(t => !t.cycleId || !cycles.some(c => c.id === t.cycleId));
  const shownTasks = plotTaskCycle === "__none__" ? noCycleTasks
    : (plotTaskCycle ? tasks.filter(t => t.cycleId === plotTaskCycle) : tasks);
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn btn-sm btn-ghost" onclick="App.goPlots()">← กลับไปแปลงทั้งหมด</button>
    </div>
    <div class="card">
      <div class="plot-top">
        <div class="plot-emoji">${cropEmoji(p.crop)}</div>
        <div class="grow">
          <div class="plot-name">${esc(p.name)} ${p.status === "active" ? `<span class="badge badge-green">Active</span>` : `<span class="badge badge-gray">ว่าง</span>`}</div>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><div class="lb">ขนาดพื้นที่</div><div class="vl">${fmtNum(p.sizeRai)} ไร่</div></div>
        <div class="meta-box"><div class="lb">พิกัด GPS</div><div class="vl" style="font-size:.72rem"><a class="gps-link" href="${mapLink(p.lat, p.lng)}" target="_blank" rel="noopener">${ic("map")} ${p.lat}, ${p.lng}</a></div></div>
        <div class="meta-box"><div class="lb">รอบที่กำลังปลูก</div><div class="vl" style="font-size:.78rem">${activeCycle ? esc(activeCycle.plant) : "—"}</div></div>
        <div class="meta-box"><div class="lb">จำนวนรอบ</div><div class="vl">${cycles.length} รอบ</div></div>
      </div>
      <div class="actions-row">
        <button class="btn btn-sm btn-outline" onclick="App.modalPlot('${p.id}')">${ic("pencil")} แก้ไขแปลง</button>
        <button class="btn btn-sm btn-outline" onclick="App.modalShare('${p.id}')">${ic("user")} แชร์</button>
        ${activeCycle ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">${ic("leaf")} เริ่มปลูก</button>`}
        <button class="btn btn-sm btn-primary" onclick="App.modalTask(todayISO(), { plotId: '${p.id}' })">${ic("plus")} เพิ่มกิจกรรม</button>
      </div>
    </div>

    ${plotWeatherCard(p)}

    ${plotWaterCard(p)}

    <div class="section-title">กำไร/ขาดทุนของแปลงนี้</div>
    <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none">
      <div class="row row-between">
        <div>
          <div style="font-size:.75rem;opacity:.85">กำไรสุทธิ (รวมทุกรอบ)</div>
          <div class="bold" style="font-size:1.5rem">${fmtMoney(fin.net)} บาท</div>
          <div style="font-size:.7rem;opacity:.85">รายได้ ${fmtMoney(fin.revenue)} · ต้นทุน ${fmtMoney(fin.cost)}</div>
          ${p.sizeRai > 0 ? `<div style="font-size:.7rem;opacity:.85;margin-top:4px">ต่อไร่: ต้นทุน <b>${fmtMoney(Math.round(fin.cost / p.sizeRai))}</b> · กำไรสุทธิ <b>${fmtMoney(Math.round(fin.net / p.sizeRai))}</b> บ./ไร่</div>` : ""}
        </div>
        <span class="kpi-icon" style="font-size:2rem">${ic(fin.net >= 0 ? "chart" : "alert")}</span>
      </div>
    </div>

    <div class="section-title">รอบการปลูก (${cycles.length})</div>
    ${cycles.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("leaf")}</div><div class="e-title">ยังไม่มีรอบการปลูก</div><div class="muted">กดเริ่มปลูกได้เลย</div></div></div>` : ""}
    <div class="card-grid">
    ${cycles.map(c => {
      const cf = cycleFinance(S, c.id);
      const n = tasks.filter(t => t.cycleId === c.id).length;
      return `
      <div class="card cycle-card" onclick="App.openCycle('${c.id}')" role="button" tabindex="0" title="กดดูงาน/กิจกรรมของรอบนี้">
        <div class="row">
          <div class="plot-emoji">${cropEmoji(c.plant)}</div>
          <div class="grow">
            <div class="plot-name">${esc(c.plant)} <span class="badge badge-blue">รอบ ${c.round || "—"}</span></div>
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
        <div class="actions-row" style="margin-top:10px">
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();App.modalCycle('${c.plotId}', '${c.id}')">${ic("pencil")} แก้ไขรอบ</button>
          ${c.status === "active" ? `<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();App.completeCycle('${c.id}')">${ic("check")} ปิดรอบการปลูก</button>` : `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();App.reopenCycle('${c.id}')">${ic("refresh")} เปิดรอบอีกครั้ง</button>`}
        </div>
        <div class="cycle-open-hint">${ic("chevron")} ดู ${n} กิจกรรมของรอบนี้</div>
      </div>`;
    }).join("")}
    </div>

    <div class="section-title">งาน/กิจกรรมของแปลงนี้ (${shownTasks.length})</div>
    <div class="stock-cat-wrap">
      <select class="stock-cat-select" onchange="App.plotTaskFilter(this.value)" aria-label="กรองรอบการปลูก">
        <option value="" ${plotTaskCycle === "" ? "selected" : ""}>ทุกๆ รอบ (${tasks.length})</option>
        ${cycles.map(c => `<option value="${c.id}" ${plotTaskCycle === c.id ? "selected" : ""}>${esc(c.plant)} (${tasks.filter(t => t.cycleId === c.id).length})</option>`).join("")}
        ${noCycleTasks.length ? `<option value="__none__" ${plotTaskCycle === "__none__" ? "selected" : ""}>ไม่มีรอบ (${noCycleTasks.length})</option>` : ""}
      </select>
    </div>
    <div class="card">
      ${shownTasks.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">${plotTaskCycle === "__none__" ? "ไม่มีงานที่ยังไม่ผูกกับรอบการปลูก" : (plotTaskCycle ? "ยังไม่มีบันทึกงานในรอบนี้" : "ยังไม่มีบันทึกงาน — กด + เพิ่มกิจกรรม ได้เลย")}</div>` : ""}
      ${shownTasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true, cycleOptions: cycles })).join("")}
    </div>`;
}
App.openPlot = function (id) { route.view = "plotDetail"; route.plotId = id; plotTaskCycle = ""; render(); };
App.plotTaskFilter = function (v) { plotTaskCycle = v; rerender(); };
/* ผูกงานที่ยังไม่มีรอบเข้ากับรอบการปลูก (จากหน้าแปลง — งานที่ไม่มีรอบมี dropdown ให้เลือก) */
App.assignTaskCycle = function (id, cycleId) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const c = cycleById(S, cycleId);
  if (!c) { toast("เลือกรอบการปลูกก่อน"); return; }
  t.cycleId = c.id;
  t.plotId = c.plotId;
  saveState(S);
  rerender();
  toast(`ผูกงานเข้ารอบ "${c.plant}" แล้ว`);
};

/* ---------------- Cycle detail (งาน/กิจกรรมของแต่ละรอบการปลูก) ---------------- */
let cycleCal = { y: 0, m: 0, sel: null }; // ปฏิทินรายรอบ (เดือนเริ่มจากเดือนปลูกรอบนี้)
/* ปฏิทินกิจกรรมของรอบนี้ — เห็นวันไหนมีงาน (เขียว=เสร็จ เหลือง=แผน แดง=เลยกำหนด) กดวันที่ดูงานวันนั้น */
function cycleCalCardHtml(c) {
  const { y, m, sel } = cycleCal;
  const firstDow = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const today = todayISO();
  const cycleTasks = S.tasks.filter(t => t.cycleId === c.id);
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= dim;
    const dateStr = inMonth ? `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null;
    const dayTasks = dateStr ? cycleTasks.filter(t => t.date === dateStr) : [];
    let dotCls = "";
    if (dayTasks.length) {
      dotCls = dayTasks.some(t => taskStatusOf(t) === "overdue") ? "dot-red"
        : dayTasks.some(t => taskStatusOf(t) === "planned") ? "dot-amber" : "dot-green";
    }
    const dots = dotCls ? `<span class="dots"><i class="${dotCls}"></i></span>` : "";
    const cls = [inMonth ? "" : "other", dateStr === today ? "today" : "", dateStr === sel ? "selected" : ""].join(" ");
    cells += `<button class="cal-day ${cls}" onclick="App.cycleCalPick('${dateStr || ""}')">${inMonth ? dayNum : ""}${dots}</button>`;
  }
  const selTasks = sel ? cycleTasks.filter(t => t.date === sel) : [];
  return `
    <div class="card cal-card cal-sm">
      <div class="cal-head">
        <button class="cal-nav" onclick="App.cycleCalMove(-1)">‹</button>
        <div class="cal-title">${THAI_MONTHS[m]} ${y + 543}</div>
        <button class="cal-nav" onclick="App.cycleCalMove(1)">›</button>
      </div>
      <div class="cal-grid">
        ${THAI_DAYS.map(d => `<div class="cal-dow">${d}</div>`).join("")}
        ${cells}
      </div>
      <div class="legend">
        <span><i class="dot-green"></i> เสร็จ</span>
        <span><i class="dot-amber"></i> แผน</span>
        <span><i class="dot-red"></i> เลยกำหนด</span>
        <button class="cal-today" onclick="App.cycleCalToday()">${ic("calendar")} วันนี้</button>
      </div>
      ${sel ? `
      <div class="cycle-cal-day">
        <div class="row row-between" style="margin-bottom:6px">
          <div class="bold" style="font-size:.8rem">งานวันที่ ${dateLabel(sel)}</div>
          ${c.status === "active" ? `<button class="btn btn-sm btn-primary" onclick="App.modalTask('${sel}', { cycleId: '${c.id}' })">${ic("plus")} เพิ่มกิจกรรม</button>` : ""}
        </div>
        ${selTasks.length === 0 ? `<div class="muted" style="font-size:.75rem">ไม่มีงานของรอบนี้ในวันนี้ — กด + เพิ่มกิจกรรม ได้เลย</div>` : ""}
        ${selTasks.map(t => taskRowHtml(t, { showDate: false, showNote: true, showDelete: true })).join("")}
      </div>` : ""}
    </div>`;
}
App.cycleCalPick = function (d) { cycleCal.sel = d || null; rerender(); };
App.cycleCalMove = function (dir) {
  cycleCal.m += dir;
  if (cycleCal.m < 0) { cycleCal.m = 11; cycleCal.y--; }
  if (cycleCal.m > 11) { cycleCal.m = 0; cycleCal.y++; }
  cycleCal.sel = null;
  rerender();
};
/* กระโดดกลับมาที่วันนี้ (ปฏิทินรายรอบ) */
App.cycleCalToday = function () {
  const now = new Date();
  cycleCal = { y: now.getFullYear(), m: now.getMonth(), sel: todayISO() };
  rerender();
};
function renderCycleDetail() {
  const c = cycleById(S, route.cycleId);
  if (!c) { route.view = "plots"; return renderPlots(); }
  const p = plotById(S, c.plotId);
  const cf = cycleFinance(S, c.id);
  /* ต้นทุนรวมของงานเดียว (costItems หลายรายการ หรือ cost เดี่ยว) — ใช้เรียง/กรอง */
  const costOf = t => {
    if (t.costItems && t.costItems.length) return t.costItems.reduce((a, ci) => a + (ci.totalCost || (Number(ci.qty || 0) * Number(ci.unitCost || 0)) || 0), 0);
    return Number(t.cost || 0);
  };
  /* กรอง + เรียงตามตัวเลือกของผู้ใช้ (เก่า→ใหม่ ให้เห็นงานแรกของรอบได้ไม่ต้องเลื่อนล่างสุด) */
  const allTasks = S.tasks.filter(t => t.cycleId === c.id);
  const f = cycTaskFilter;
  let tasks = allTasks.slice();
  if (f.type) tasks = tasks.filter(t => t.type === f.type);
  if (f.status === "done") tasks = tasks.filter(t => t.status === "done");
  else if (f.status === "planned") tasks = tasks.filter(t => t.status !== "done");
  if (f.costOnly) tasks = tasks.filter(t => costOf(t) > 0);
  if (f.sort === "old") tasks.sort((a, b) => a.date.localeCompare(b.date));
  else if (f.sort === "cost") tasks.sort((a, b) => costOf(b) - costOf(a));
  else tasks.sort((a, b) => b.date.localeCompare(a.date));
  /* สรุปต้นทุนแยกรายหมวดของรอบนี้ (เฉพาะงานที่เสร็จ) */
  const cmap = costCatMap(S);
  const costByCat = {};
  let totalCost = 0;
  tasks.forEach(t => {
    if (t.status !== "done") return;
    if (t.costItems && t.costItems.length) {
      t.costItems.forEach(ci => {
        const amt = ci.totalCost || (Number(ci.qty || 0) * Number(ci.unitCost || 0)) || 0;
        if (amt > 0) { const k = ci.category || "other"; costByCat[k] = (costByCat[k] || 0) + amt; totalCost += amt; }
      });
    } else if (t.cost > 0) {
      const k = t.costCat || "other";
      costByCat[k] = (costByCat[k] || 0) + t.cost;
      totalCost += t.cost;
    }
  });
  const catRows = Object.keys(costByCat).sort((a, b) => costByCat[b] - costByCat[a]).map(k => {
    const cat = cmap[k];
    const color = (cat && cat.color) || "#64748b";
    return `<div class="cc-box"><div class="cc-label"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0"></i>${esc(cat ? cat.label : "อื่นๆ")}</div><div class="cc-val">${fmtMoney(costByCat[k])} บาท</div></div>`;
  }).join("");
  return `
    <div class="row" style="margin-bottom:10px">
      <button class="btn btn-sm btn-ghost" onclick="App.openPlot('${c.plotId}')">← กลับไป ${p ? esc(p.name) : "แปลง"}</button>
    </div>
    <div class="card">
      <div class="plot-top">
        <div class="plot-emoji">${cropEmoji(c.plant)}</div>
        <div class="grow">
          <div class="plot-name">${esc(c.plant)} <span class="badge badge-blue">รอบ ${c.round || "—"}</span> ${c.status === "active" ? `<span class="badge badge-green">กำลังปลูก</span>` : `<span class="badge badge-gray">ปิดรอบ</span>`}</div>
          <div class="muted">${p ? esc(p.name) : "แปลงถูกลบ"} · เริ่ม ${c.startDate} · อายุ ${ageDays(c.startDate)} วัน</div>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><div class="lb">รายรับ</div><div class="vl">${fmtMoney(cf.revenue)} บาท</div></div>
        <div class="meta-box"><div class="lb">ต้นทุน</div><div class="vl">${fmtMoney(cf.cost)} บาท</div></div>
        <div class="meta-box"><div class="lb">กำไร/ขาดทุน</div><div class="vl ${cf.net >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(cf.net)} บาท</div></div>
        <div class="meta-box"><div class="lb">สถานะ</div><div class="vl" style="font-size:.78rem">${cf.revenue > 0 ? "มีผลผลิตแล้ว" : "รอผลผลิต"}</div></div>
      </div>
      <div class="actions-row">
        ${c.status === "active" ? `<button class="btn btn-sm btn-primary" onclick="App.modalTask(todayISO(), { cycleId: '${c.id}' })">${ic("plus")} เพิ่มกิจกรรม</button>` : ""}
        <button class="btn btn-sm btn-outline" onclick="App.openShareLink('${c.plotId}', '${c.id}')">${ic("qr")} QR Passport</button>
        <button class="btn btn-sm btn-ghost" onclick="App.modalCycle('${c.plotId}', '${c.id}')">${ic("pencil")} แก้ไขรอบ</button>
        ${c.status === "active" ? `<button class="btn btn-sm btn-ghost" onclick="App.completeCycle('${c.id}')">${ic("check")} ปิดรอบการปลูก</button>` : `<button class="btn btn-sm btn-outline" onclick="App.reopenCycle('${c.id}')">${ic("refresh")} เปิดรอบการปลูกอีกครั้ง</button>`}
      </div>
    </div>

    <div class="section-title">ปฏิทินกิจกรรมของรอบนี้</div>
    ${cycleCalCardHtml(c)}

    <div class="section-title">สรุปต้นทุนรายหมวด ${totalCost > 0 ? `<span class="muted" style="font-size:.75rem;font-weight:600">รวม ${fmtMoney(totalCost)} บาท</span>` : ""}</div>
    <div class="card">
      ${catRows ? `<div class="cc-grid">${catRows}</div>` : `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีต้นทุนในรอบนี้</div>`}
    </div>

    <div class="section-title">งาน/กิจกรรมของรอบนี้ <span class="muted" style="font-size:.75rem;font-weight:600">${tasks.length === allTasks.length ? allTasks.length : "แสดง " + tasks.length + " จาก " + allTasks.length}</span></div>
    ${allTasks.length === 0 ? `
    <div class="card"><div class="muted" style="text-align:center;padding:8px">ยังไม่มีบันทึกงานในรอบนี้ — กด + เพิ่มกิจกรรม ได้เลย</div></div>` : `
    <div class="card cycf-bar">
      <select class="cycf" onchange="App.cycTaskFilter('sort', this.value)" title="เรียงลำดับ">
        <option value="new" ${f.sort === "new" ? "selected" : ""}>⏱ ใหม่ → เก่า</option>
        <option value="old" ${f.sort === "old" ? "selected" : ""}>⏱ เก่า → ใหม่ (งานแรกของรอบ)</option>
        <option value="cost" ${f.sort === "cost" ? "selected" : ""}>💰 ต้นทุนสูง → ต่ำ</option>
      </select>
      <select class="cycf" onchange="App.cycTaskFilter('type', this.value)" title="กรองประเภท">
        <option value="">ทุกประเภท</option>
        ${[...new Set(allTasks.map(t => t.type))].map(tp => `<option value="${tp}" ${f.type === tp ? "selected" : ""}>${TYPE_LABELS[tp] || tp}</option>`).join("")}
      </select>
      <select class="cycf" onchange="App.cycTaskFilter('status', this.value)" title="กรองสถานะ">
        <option value="" ${!f.status ? "selected" : ""}>ทุกสถานะ</option>
        <option value="planned" ${f.status === "planned" ? "selected" : ""}>ยังไม่เสร็จ</option>
        <option value="done" ${f.status === "done" ? "selected" : ""}>เสร็จแล้ว</option>
      </select>
      <label class="cycf-cost"><input type="checkbox" ${f.costOnly ? "checked" : ""} onchange="App.cycTaskFilter('costOnly', this.checked)"> มีค่าใช้จ่าย</label>
      ${(f.sort !== "new" || f.type || f.status || f.costOnly) ? `<button class="btn btn-sm btn-ghost" onclick="App.cycTaskFilter('reset')" title="ล้างตัวกรอง">✕ ล้าง</button>` : ""}
    </div>
    <div class="card">
      ${tasks.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ไม่มีงานตรงกับตัวกรอง — ลองล้างตัวกรอง</div>` : ""}
      ${tasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true })).join("")}
    </div>`}`;
}
/* ตั้งค่าตัวกรอง/เรียง "งาน/กิจกรรมของรอบนี้" — re-render หน้าเดิม (ไม่เลื่อนขึ้นหัว) */
App.cycTaskFilter = function (key, val) {
  if (key === "reset") cycTaskFilter = { sort: "new", type: "", status: "", costOnly: false };
  else cycTaskFilter[key] = val;
  rerender();
};
App.openCycle = function (id) {
  route.view = "cycleDetail"; route.cycleId = id;
  /* ปฏิทินรายรอบเริ่มที่เดือนเริ่มปลูกรอบนี้ */
  const c = cycleById(S, id);
  if (c && c.startDate) {
    const d = new Date(c.startDate + "T00:00:00");
    cycleCal = { y: d.getFullYear(), m: d.getMonth(), sel: null };
  }
  render();
};
App.completeCycle = function (id) {
  App.confirm("ปิดรอบการปลูก?", "รอบนี้จะถูกปิดและไม่สามารถเพิ่มกิจกรรมได้ — ถ้าปิดผิดสามารถกดเปิดรอบอีกครั้งได้ภายหลัง", () => {
    const c = cycleById(S, id);
    if (c) c.status = "done";
    saveState(S);
    rerender();
    toast("ปิดรอบการปลูกเรียบร้อย");
  });
};
/* เปิดรอบการปลูกที่ปิดไปแล้วกลับมาเป็นกำลังปลูกอีกครั้ง (กันกดปิดผิดแล้วแก้อะไรไม่ได้) */
App.reopenCycle = function (id) {
  const c = cycleById(S, id);
  if (!c) return;
  c.status = "active";
  saveState(S);
  rerender();
  toast(`เปิดรอบ "${c.plant}" กลับมาแล้ว`);
};

App.deletePlot = function (id) {
  App.confirm("ลบแปลงนี้?", "รอบการปลูกของแปลงนี้จะถูกลบด้วย ต้องการดำเนินการต่อหรือไม่?", () => {
    S.plots = S.plots.filter(p => p.id !== id);
    S.cycles = S.cycles.filter(c => c.plotId !== id);
    saveState(S);
    render();
    toast("ลบแปลงแล้ว");
  });
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
  /* อัปเดตแผงแจ้งเตือนถ้ากำลังเปิดอยู่ */
  const np = document.getElementById("notifPanel");
  if (np && !np.hidden) renderNotifPanel();
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
      ${selTasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true, showPlot: true })).join("")}
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
/* กระโดดกลับมาที่วันนี้ (ปฏิทินหลัก: หน้าแรก + หน้าปฏิทินงาน) */
App.calToday = function () {
  const now = new Date();
  cal = { y: now.getFullYear(), m: now.getMonth(), sel: todayISO() };
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
    rerender();
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
  const tab = route.tab === "shop" ? "shop" : "farm";
  const yr = String(route.year || Number(todayISO().slice(0, 4)));
  const beYr = Number(yr) + 543; // ปี พ.ศ. ที่แสดง
  const years = analyticsYears(S);
  /* ---- แท็บฟาร์ม (แปลง) — ตัวเลขจากงานในแปลงเท่านั้น ---- */
  const ytd = ytdFinance(S, yr);
  const months = monthlySeries(S, yr);
  const crops = cropMargins(S, yr);
  const costs = costBreakdown(S, yr);
  const totalCost = costs.reduce((a, c) => a + c.value, 0);
  const costRev = costs.map(c => ({ ...c, pct: totalCost ? (c.value / totalCost * 100).toFixed(0) : 0 }));
  const plotRows = plotYearProfits(S, yr);
  const chemRows = plotChemUse(S, yr);
  const farmHtml = `
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

    <div class="section-title">กำไรรายแปลง (พ.ศ. ${beYr}) — ใครกำไร ใครขาดทุน</div>
    <div class="card">
      <div class="chart-wrap" id="chartPlot"></div>
      <div class="legend-list">
        ${plotRows.map(p => {
          const isProfit = p.net >= 0;
          return `<div class="li"><span class="sw" style="background:${isProfit ? "var(--green)" : "var(--red)"}"></span><span>${cropEmoji(p.crop)} ${esc(p.name)}${p.crop ? ` <span class="muted" style="font-size:.68rem">· ${esc(p.crop)}</span>` : ""}</span><span class="val">${fmtMoney(p.net)} บาท</span></div>`;
        }).join("")}
      </div>
      <div class="muted mt-8" style="font-size:.72rem">${ic("info")} กำไร = รายได้ − ต้นทุน (เฉพาะงานที่เสร็จแล้วพ.ศ. ${beYr}) · เขียว = กำไร แดง = ขาดทุน · เรียงจากกำไรมากสุด</div>
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
      <div class="chart-wrap chart-donut" id="chartCost"></div>
      <div class="legend-list">
        ${costRev.map(c => `<div class="li"><span class="sw" style="background:${c.color}"></span><span>${esc(c.label)}</span><span class="val">${fmtMoney(c.value)} บาท (${c.pct}%)</span></div>`).join("")}
      </div>
    </div>

    <div class="section-title">การใช้ยา/สารเคมีรายแปลง (พ.ศ. ${beYr}) — แปลงไหนใช้ยามากสุด</div>
    <div class="card">
      ${chemRows.length === 0
        ? `<div class="empty"><div class="e-ico">${ic("spray")}</div><div class="e-title">ยังไม่มีรายการใช้ยา/สารเคมีในพ.ศ. ${beYr}</div><div class="muted">เมื่อบันทึกงานที่มีหมวด "ค่าสารเคมีทางการเกษตร" จะแสดงที่นี่</div></div>`
        : `<div class="chart-wrap" id="chartChem"></div>
      <div class="legend-list">
        ${chemRows.map(c => `
          <div class="li"><span class="sw" style="background:#f59e0b"></span><span>${cropEmoji(c.crop)} ${esc(c.name)}${c.items.length ? ` <span class="muted" style="font-size:.68rem">· ${esc(c.items.map(it => `${it.name} ${fmtNum(it.qty)}`).join(" · "))}</span>` : ""}</span><span class="val">${fmtMoney(c.cost)} บาท</span></div>`).join("")}
      </div>
      <div class="muted mt-8" style="font-size:.72rem">${ic("info")} ต้นทุนยา/สารเคมีที่ใช้ (พ.ศ. ${beYr}) · แปลงที่ใช้มากสุดอยู่บนสุด · วงเล็บคือรายการยาที่ใช้กับจำนวน</div>`}
    </div>`;
  /* ---- แท็บร้านค้า — ยอดขายยา/สินค้า + มูลค่าสต็อก (แยกจากกำไรแปลง) ---- */
  const saleYr = salesRevenue(S, yr);
  const saleCnt = salesYearCount(S, yr);
  const cogs = salesCostYTD(S, yr);
  const saleProfit = salesProfitYTD(S, yr);
  const sv = stockValue(S);
  const topItems = topSaleItems(S, yr, 5);
  const topCusts = topCustomers(S, yr, 5);
  const topStock = [...S.stock]
    .map(x => ({ name: x.name, unit: x.unit, val: ((Number(x.qty) || 0) + (Number(x.openQty) || 0)) * (Number(x.avgCost) || 0) }))
    .filter(x => x.val > 0).sort((a, b) => b.val - a.val).slice(0, 5);
  const emptySale = (S.sales || []).length === 0;
  const shopHtml = `
    <div class="kpi-row">
      <div class="kpi blue"><div class="kpi-icon">${ic("dollar")}</div><div class="kpi-label">ยอดขาย (พ.ศ. ${beYr})</div><div class="kpi-value">${fmtMoney(saleYr)}</div><div class="kpi-sub">${saleCnt} ใบเสร็จ</div></div>
      <div class="kpi amber"><div class="kpi-icon">${ic("box")}</div><div class="kpi-label">ต้นทุนขาย</div><div class="kpi-value">${fmtMoney(cogs)}</div><div class="kpi-sub">บาท (COGS)</div></div>
      <div class="kpi green ${saleProfit >= 0 ? "pos" : "neg"}"><div class="kpi-icon">${ic("chart")}</div><div class="kpi-label">กำไรร้าน</div><div class="kpi-value">${fmtMoney(saleProfit)}</div><div class="kpi-sub">${saleYr > 0 ? `Margin ${(saleProfit / saleYr * 100).toFixed(1)}%` : "ยังไม่มีขาย"}</div></div>
    </div>

    <div class="section-title">ยอดขายรายเดือน (พ.ศ. ${beYr})</div>
    <div class="card">
      ${emptySale ? `<div class="empty"><div class="e-ico">${ic("dollar")}</div><div class="e-title">ยังไม่มีรายการขาย</div><div class="muted">กดปุ่มลัด "ขายสินค้า" เพื่อออกใบเสร็จใบแรก</div></div>` : `<div class="chart-wrap" id="chartSale"></div>`}
      <div class="muted mt-8" style="font-size:.72rem">ยอดขายสุทธิ (หลังหักส่วนลด) เดือนต่อเดือน</div>
    </div>

    <div class="section-title">สินค้าขายดี (พ.ศ. ${beYr})</div>
    <div class="card">
      ${topItems.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีข้อมูลการขาย</div>` : topItems.map((x, i) => `
        <div class="row-line">
          <span class="rank-badge">${i + 1}</span>
          <span class="grow">${esc(x.name)}</span>
          <span class="muted" style="font-size:.72rem">${fmtNum(x.qty)} หน่วย</span>
          <b style="margin-left:10px">${fmtMoney(x.revenue)} บาท</b>
        </div>`).join("")}
    </div>

    <div class="section-title">ลูกค้าที่ซื้อเยอะที่สุด (พ.ศ. ${beYr})</div>
    <div class="card">
      ${topCusts.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีข้อมูลการขาย</div>` : topCusts.map((c, i) => `
        <div class="row-line">
          <span class="rank-badge">${i + 1}</span>
          <span class="grow">${esc(c.name)}</span>
          <span class="muted" style="font-size:.72rem">${c.count} ครั้ง</span>
          <b style="margin-left:10px">${fmtMoney(c.total)} บาท</b>
        </div>`).join("")}
    </div>

    <div class="section-title">มูลค่าสต็อกคงเหลือ <span class="badge badge-blue">สินทรัพย์</span></div>
    <div class="card">
      <div class="meta-grid">
        <div class="meta-box"><div class="lb">มูลค่ารวม</div><div class="vl">${fmtMoney(sv.total)} บาท</div></div>
        <div class="meta-box"><div class="lb">สต็อกหลัก</div><div class="vl">${fmtMoney(sv.main)} บาท</div></div>
        <div class="meta-box"><div class="lb">ของเหลือเปิดใช้</div><div class="vl">${fmtMoney(sv.open)} บาท</div></div>
        <div class="meta-box"><div class="lb">รายการสินค้า</div><div class="vl">${S.stock.length} รายการ</div></div>
      </div>
      ${topStock.length ? `
      <div class="divider"></div>
      <div class="bold" style="font-size:.84rem;margin-bottom:4px">สินค้าที่มีมูลค่าคงคลังสูงสุด</div>
      ${topStock.map(x => `
        <div class="row-line">
          <span class="grow">${esc(x.name)}</span>
          <b>${fmtMoney(x.val)} บาท</b>
        </div>`).join("")}` : ""}
      <div class="muted mt-8" style="font-size:.72rem">${ic("info")} มูลค่าคงคลังคำนวณจากต้นทุนถัวเฉลี่ย × จำนวนคงเหลือ (หลัก + ของที่เปิดใช้แล้ว)</div>
    </div>`;

  /* แถวเลือกปี: ◀ ปี พ.ศ. ▶ + ปุ่มปีทั้งหมดที่มีข้อมูล */
  const yearNav = `
    <div class="year-nav">
      <button class="year-nav-btn" onclick="App.analyticsYear(${Number(yr) - 1})" aria-label="ปีก่อนหน้า">◀</button>
      <span class="year-nav-label">พ.ศ. ${beYr}</span>
      <button class="year-nav-btn" onclick="App.analyticsYear(${Number(yr) + 1})" aria-label="ปีถัดไป">▶</button>
    </div>
    <div class="year-chips">
      ${years.map(y => `<button class="year-chip ${y === Number(yr) ? "active" : ""}" onclick="App.analyticsYear(${y})">${y + 543}</button>`).join("")}
    </div>`;
  return `
    <div class="section-title" data-tkey="analyticsTitle">${T("analyticsTitle")} พ.ศ. ${beYr}</div>
    ${yearNav}
    <div class="tabs">
      <button class="${tab === "farm" ? "active" : ""}" onclick="App.analyticsTab('farm')">${ic("leaf")} ฟาร์ม (แปลง)</button>
      <button class="${tab === "shop" ? "active" : ""}" onclick="App.analyticsTab('shop')">${ic("dollar")} ร้านค้า</button>
    </div>
    ${tab === "shop" ? shopHtml : farmHtml}`;
}
App.analyticsTab = function (tab) { route.tab = tab; render(); };
/* สลับปีที่วิเคราะห์ — เก็บใน route.year (CE) แสดงเป็น พ.ศ. */
App.analyticsYear = function (ceYr) {
  route.year = Number(ceYr) || Number(todayISO().slice(0, 4));
  render();
};
/* แท็บร้านค้ายังไม่มีกราฟ — ข้ามการวาดกราฟฟาร์ม (chartYear/chartCrop/chartCost ไม่มีใน DOM) */

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
/* การ์ดระบบน้ำของแปลง (ในหน้ารายละเอียดแปลง) */
function plotWaterCard(p) {
  const systems = (S.water.systems || []).filter(x => x.plotId === p.id);
  if (systems.length === 0) {
    return `
    <div class="card" style="border-style:dashed">
      <div class="row">
        <div class="plot-emoji chip-water">${ic("droplet")}</div>
        <div class="grow">
          <div class="bold" style="font-size:.86rem">ระบบน้ำของแปลงนี้</div>
          <div class="muted" style="font-size:.72rem">ยังไม่มีระบบน้ำ — เพิ่มเพื่อตั้งตารางให้น้ำอัตโนมัติ</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="App.modalWaterSystem()">${ic("plus")} เพิ่ม</button>
      </div>
    </div>`;
  }
  const today = todayISO();
  const rows = systems.map(sys => {
    const next = waterNextDate(sys);
    const due = next && next <= today;
    return `
    <div class="row" style="margin-top:6px">
      <div class="plot-emoji chip-water">${ic("droplet")}</div>
      <div class="grow">
        <div class="bold" style="font-size:.86rem">${esc(sys.name)}</div>
        <div class="muted" style="font-size:.72rem">
          ${sys.auto && sys.auto.enabled ? `อัตโนมัติ ทุก ${sys.auto.everyDays} วัน · ${esc(sys.auto.time)} · ${sys.auto.minutes} นาที · ` : "ให้น้ำด้วยมือ · "}
          ล่าสุด ${sys.lastWatered ? dateLabel(sys.lastWatered) : "ยังไม่เคย"}
        </div>
      </div>
      ${due ? `<span class="badge badge-amber">ถึงรอบ</span>` : next ? `<span class="badge badge-green">${dateLabel(next)}</span>` : ""}
      <button class="btn btn-sm btn-primary" onclick="App.modalWaterNow('${sys.id}')">${ic("droplet")} ให้น้ำ</button>
    </div>`;
  }).join("");
  return `
  <div class="card">
    <div class="row row-between" style="margin-bottom:4px">
      <div class="bold" style="font-size:.86rem">${ic("droplet")} ระบบน้ำของแปลงนี้</div>
      <button class="btn btn-sm btn-ghost" onclick="App.nav('iot')">เปิดหน้ารวม</button>
    </div>
    ${rows}
    <button class="btn btn-sm btn-ghost btn-block mt-8" onclick="App.modalWaterSystem()">${ic("plus")} เพิ่มระบบน้ำอีกสำหรับแปลงนี้</button>
  </div>`;
}

/* ---------------- ระบบน้ำรายแปลง (หน้ารวม) ---------------- */
function waterNextDate(sys) {
  if (!sys.auto || !sys.auto.enabled || !sys.lastWatered) return null;
  return addDaysISO(sys.lastWatered, Number(sys.auto.everyDays) || 1);
}
function renderIoT() {
  const W = S.water;
  const plotName = id => { const p = plotById(S, id); return p ? p.name : "(แปลงถูกลบ)"; };
  const today = todayISO();

  /* การ์ดระบบน้ำต่อแปลง */
  const sysCards = W.systems.map(sys => {
    const next = waterNextDate(sys);
    const due = next && next <= today;
    const src = W.sources.find(x => x.id === sys.sourceId);
    return `
    <div class="card">
      <div class="row">
        <div class="plot-emoji chip-water">${ic("droplet")}</div>
        <div class="grow">
          <div class="plot-name">${esc(plotName(sys.plotId))}</div>
          <div class="muted" style="font-size:.74rem">${esc(sys.name)}${sys.pumpName ? " · ปั๊ม: " + esc(sys.pumpName) : ""}${sys.valveCount ? " · " + sys.valveCount + " วาล์ว" : ""}${src ? " · " + esc(src.name) : ""}</div>
        </div>
        <button class="switch ${sys.state === "on" ? "on" : ""}" onclick="App.toggleWater('${sys.id}')" aria-label="สลับเปิดปิด"></button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${sys.auto && sys.auto.enabled ? `<span class="badge badge-blue">${ic("clock")} อัตโนมัติ ทุก ${sys.auto.everyDays} วัน · ${sys.auto.time} · ${sys.auto.minutes} นาที</span>` : `<span class="badge badge-gray">ให้น้ำด้วยมือ</span>`}
        ${due ? `<span class="badge badge-amber">${ic("droplet")} ถึงรอบให้น้ำแล้ว</span>` : next ? `<span class="badge badge-green">ครั้งถัดไป ${dateLabel(next)}</span>` : ""}
      </div>
      <div class="muted" data-wnote="${esc(sys.id)}" style="font-size:.7rem;color:var(--amber-text);margin-top:4px;min-height:0"></div>
      <div class="row row-between mt-8">
        <div class="muted" style="font-size:.72rem">ให้น้ำล่าสุด: ${sys.lastWatered ? dateLabel(sys.lastWatered) : "ยังไม่เคย"}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-primary" onclick="App.modalWaterNow('${sys.id}')">${ic("droplet")} ให้น้ำตอนนี้</button>
          <button class="btn btn-sm btn-outline" onclick="App.modalWaterSystem('${sys.id}')">${ic("pencil")} ตั้งค่า</button>
          <button class="btn btn-sm btn-danger-soft" onclick="App.delWaterSystem('${sys.id}')">${ic("trash")}</button>
        </div>
      </div>
    </div>`;
  }).join("");

  /* แหล่งน้ำ */
  const srcCards = W.sources.map(src => `
    <div class="card">
      <div class="row">
        <div class="plot-emoji chip-water">${ic("droplet")}</div>
        <div class="grow">
          <div class="plot-name">${esc(src.name)}</div>
          <div class="muted" style="font-size:.74rem">${esc(src.type || "—")}${src.capacityM3 ? " · ความจุ " + fmtNum(src.capacityM3) + " ลบ.ม." : ""}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-outline" onclick="App.modalWaterSource('${src.id}')">${ic("pencil")}</button>
          <button class="btn btn-sm btn-danger-soft" onclick="App.delWaterSource('${src.id}')">${ic("trash")}</button>
        </div>
      </div>
      <div class="mt-8">
        <div class="row row-between"><span class="muted" style="font-size:.72rem">ระดับน้ำคงเหลือ</span><span class="bold" style="font-size:.8rem">${Number(src.levelPct) || 0}%</span></div>
        <div class="hp-bar"><i style="width:${Math.min(100, Number(src.levelPct) || 0)}%;background:linear-gradient(90deg,#38bdf8,#2563eb)"></i></div>
      </div>
    </div>`).join("");

  /* บันทึกการให้น้ำ */
  const sysName = id => { const s = W.systems.find(x => x.id === id); return s ? plotName(s.plotId) : "—"; };
  const logs = [...W.logs].sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))).slice(0, 12);
  const logRows = logs.map(l => `
    <div class="row-line">
      <span class="task-ico water">${ic("droplet")}</span>
      <div class="grow">
        <div class="bold" style="font-size:.84rem">${esc(sysName(l.systemId))}</div>
        <div class="muted" style="font-size:.7rem">${dateLabel(l.date)} ${l.time || ""} · ${l.minutes || 0} นาที${l.m3 ? " · " + l.m3 + " ลบ.ม." : ""}${l.note ? " · " + esc(l.note) : ""}</div>
      </div>
      <button class="btn btn-sm btn-danger-soft" onclick="App.delWaterLog('${l.id}')">${ic("trash")}</button>
    </div>`).join("");

  return `
    <div class="card" style="background:linear-gradient(135deg,#1d4ed8,#172554);color:#fff;border:none">
      <div class="row">
        <span style="font-size:2rem;color:#fff">${ic("droplet")}</span>
        <div class="grow">
          <div class="bold" style="font-size:1rem">ระบบน้ำอัตโนมัติรายแปลง</div>
          <div style="font-size:.76rem;opacity:.85">ตั้งตารางให้น้ำแยกแต่ละแปลง · บันทึกทุกครั้งที่ให้น้ำ · เห็นภาพรวมในหน้าเดียว</div>
        </div>
      </div>
    </div>

    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem" data-tkey="iotTitle">${T("iotTitle")} (${W.systems.length})</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalWaterSystem()">${ic("plus")} เพิ่มระบบน้ำให้แปลง</button>
    </div>
    ${W.systems.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("droplet")}</div><div class="e-title">ยังไม่มีระบบน้ำ</div><div class="muted">กด "เพิ่มระบบน้ำให้แปลง" เลือกแปลง ตั้งตารางให้น้ำอัตโนมัติได้เลย</div></div></div>` : ""}
    <div class="card-grid">${sysCards}</div>

    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem">แหล่งน้ำ (${W.sources.length})</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalWaterSource()">${ic("plus")} เพิ่มแหล่งน้ำ</button>
    </div>
    ${W.sources.length === 0 ? `<div class="card"><div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีแหล่งน้ำ — เพิ่มบ่อ/บาดาล/ประปา เพื่อบันทึกระดับน้ำ</div></div>` : `<div class="card-grid">${srcCards}</div>`}

    <div class="section-title">${ic("clock")} บันทึกการให้น้ำล่าสุด</div>
    <div class="card">
      ${logs.length === 0 ? `<div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีบันทึก — กด "ให้น้ำตอนนี้" ที่การ์ดแปลงเพื่อบันทึก</div>` : logRows}
    </div>

    <div class="section-title">${ic("wifi")} อุปกรณ์ควบคุมที่แปลง (ESP32)</div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">เซิร์ฟเวอร์ตัดสินใจให้น้ำตามตารางให้อัตโนมัติ (ทุกนาที) และเช็คพยากรณ์ฝนก่อนสั่ง — อุปกรณ์ ESP32 ที่แปลงจะดึงคำสั่งจาก API ทุก ~10 วินาที แล้วเปิด/ปิดวาล์วตาม กดปุ่มเพื่อรับ Device Key</div>
      <button class="btn btn-primary btn-block" onclick="App.waterAddDevice()">${ic("plus")} เพิ่มอุปกรณ์ / รับ Device Key</button>
      <button class="btn btn-outline btn-block mt-8" onclick="App.waterListDevices()">${ic("eye")} ดู Device Key ที่มีอยู่</button>
    </div>`;
}

/* ดึงสถานะ/โน้ตล่าสุดจากเซิร์ฟเวอร์ (เช่น "ข้ามรอบเพราะฝน") มาแสดงในการ์ด */
App.waterPullStatus = async function () {
  if (!(typeof Auth !== "undefined" && Auth.session)) return;
  try {
    const r = await authCall("water_status", { token: Auth.session.token });
    if (!r.ok || !r.data.states) return;
    r.data.states.forEach(st => {
      const el = document.querySelector('[data-wnote="' + st.system_id + '"]');
      if (el && st.note) el.textContent = "☁️ " + st.note;
    });
  } catch (e) { /* ออฟไลน์ */ }
};

/* สลับสวิตช์วาล์ว — สั่งเซิร์ฟเวอร์จริง (อุปกรณ์ ESP32 ดึงคำสั่งนี้ไปทำงาน) + จำลองในเว็บ */
App.toggleWater = function (id) {
  const sys = (S.water.systems || []).find(x => x.id === id);
  if (!sys) return;
  sys.state = sys.state === "on" ? "off" : "on";
  saveState(S);
  render();
  toast(sys.state === "on" ? "สั่งเปิดวาล์ว → เซิร์ฟเวอร์" : "สั่งปิดวาล์ว → เซิร์ฟเวอร์");
  if (typeof authCall === "function" && typeof Auth !== "undefined" && Auth.session) {
    authCall("water_set", { token: Auth.session.token, systemId: id, cmd: sys.state, minutes: sys.auto && sys.auto.enabled ? sys.auto.minutes : 30 })
      .then(r => { if (!r.ok) toast("⚠️ สั่งเซิร์ฟเวอร์ไม่สำเร็จ: " + (r.error || "") + " (กดซิงก์ระบบน้ำก่อน)"); });
  }
};

/* ซิงก์ระบบน้ำทั้งหมดขึ้นเซิร์ฟเวอร์ (ตารางอัตโนมัติทำงานฝั่งเซิร์ฟเวอร์) */
App.waterSyncNow = async function () {
  if (typeof Auth === "undefined" || !Auth.session) return;
  toast("กำลังซิงก์ระบบน้ำขึ้นเซิร์ฟเวอร์...");
  const r = await Auth.waterSync();
  toast(r && r.ok ? "ซิงก์เซิร์ฟเวอร์แล้ว ✓ — ตารางอัตโนมัติทำงานแม้ปิดแอป" : "ซิงก์ไม่สำเร็จ: " + ((r && r.error) || ""));
};

App.waterAddDevice = async function () {
  if (!(typeof Auth !== "undefined" && Auth.session)) { toast("ต้องล็อกอินก่อน"); return; }
  const r = await authCall("water_register", { token: Auth.session.token, name: "ESP32-" + new Date().toISOString().slice(5, 10) });
  if (!r.ok) { toast(r.error || "ทำรายการไม่สำเร็จ"); return; }
  App.waterShowKey(r.data.device_key);
};
App.waterShowKey = function (key) {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("wifi")} Device Key สำหรับ ESP32</h3>
    <div class="modal-sub">คัดลอก Key นี้ไปใส่ในไฟล์ firmware (บรรทัด DEVICE_KEY) — ใครมี Key นี้สั่งวาล์วคุณได้ อย่าเปิดเผย</div>
    <div class="card soft-bg" style="font-family:monospace;font-size:.85rem;word-break:break-all;user-select:all">${esc(key)}</div>
    <div class="field"><label>URL API ที่อุปกรณ์ใช้ (POST)</label><input readonly value="https://farmbackup.carfork123.workers.dev" onclick="this.select()"></div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="App.copyText('${esc(key)}')">${ic("save")} คัดลอก Key</button>
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
App.waterListDevices = async function () {
  if (!(typeof Auth !== "undefined" && Auth.session)) { toast("ต้องล็อกอินก่อน"); return; }
  const r = await authCall("water_keys", { token: Auth.session.token });
  if (!r.ok) { toast(r.error || "โหลดไม่สำเร็จ"); return; }
  const ds = r.data.devices || [];
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("wifi")} Device Key ทั้งหมด (${ds.length})</h3>
    ${ds.length === 0 ? `<div class="muted" style="text-align:center;padding:10px">ยังไม่มีอุปกรณ์ — กด "เพิ่มอุปกรณ์" ที่หน้าระบบน้ำ</div>` : ds.map(d => `
      <div class="ed-row">
        <span class="grow" style="font-family:monospace;font-size:.75rem;word-break:break-all">${esc(d.device_key)}</span>
        <button class="btn btn-sm btn-outline" onclick="App.copyText('${esc(d.device_key)}')">${ic("save")}</button>
      </div>`).join("")}
    <div class="modal-actions"><button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button></div>`);
};
App.copyText = function (t) {
  try { navigator.clipboard.writeText(t); toast("คัดลอกแล้ว"); }
  catch (e) { toast("คัดลอกไม่ได้ — เลือกข้อความแล้วก๊อปเอง"); }
};

/* ฟอร์ม: เพิ่ม/แก้ไขระบบน้ำของแปลง */
App.modalWaterSystem = function (id) {
  const W = S.water;
  const sys = id ? W.systems.find(x => x.id === id) : null;
  if (S.plots.length === 0) { toast("ยังไม่มีแปลง — ไปหน้าแปลงเพื่อเพิ่มแปลงก่อน"); return; }
  const opt = (arr, sel) => arr.map(x => `<option value="${esc(x.id)}" ${x.id === sel ? "selected" : ""}>${esc(x.name || x.label)}</option>`).join("");
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("droplet")} ${sys ? "แก้ไขระบบน้ำ" : "เพิ่มระบบน้ำให้แปลง"}</h3>
    <div class="field"><label>แปลง *</label><select id="ws_plot">${opt(S.plots, sys ? sys.plotId : (S.plots[0] || {}).id)}</select></div>
    <div class="field"><label>ชื่อระบบ</label><input id="ws_name" placeholder="เช่น ระบบสปริงเกลอร์ / ระบบน้ำหยด" value="${esc(sys ? sys.name : "")}"></div>
    <div class="field"><label>แหล่งน้ำ</label><select id="ws_source"><option value="">— ไม่ระบุ —</option>${opt(W.sources, sys ? sys.sourceId : "")}</select></div>
    <div class="field"><label>ชื่อปั๊มน้ำ</label><input id="ws_pump" placeholder="เช่น ปั๊ม 1.5 HP" value="${esc(sys ? sys.pumpName || "" : "")}"></div>
    <div class="field"><label>จำนวนวาล์ว/โซน</label><input id="ws_valves" type="number" min="0" value="${sys ? sys.valveCount || 0 : 1}"></div>
    <div class="field"><label><input type="checkbox" id="ws_auto" ${sys && sys.auto && sys.auto.enabled ? "checked" : ""} style="width:auto;margin-right:6px">เปิดตารางให้น้ำอัตโนมัติ</label></div>
    <div style="display:flex;gap:8px">
      <div class="field grow"><label>ทุกกี่วัน</label><input id="ws_days" type="number" min="1" value="${sys && sys.auto ? sys.auto.everyDays : 2}"></div>
      <div class="field grow"><label>เวลา</label><input id="ws_time" type="time" value="${sys && sys.auto ? sys.auto.time : "06:00"}"></div>
      <div class="field grow"><label>นาน (นาที)</label><input id="ws_min" type="number" min="1" value="${sys && sys.auto ? sys.auto.minutes : 30}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveWaterSystem('${id || ""}')">${ic("save")} บันทึก</button>
    </div>`);
};
App.saveWaterSystem = function (id) {
  const g = x => (document.getElementById(x) || {}).value || "";
  const plotId = g("ws_plot");
  if (!plotId) { toast("เลือกแปลงก่อน"); return; }
  const sys = id ? (S.water.systems.find(x => x.id === id) || {}) : { id: uid(), state: "off", lastWatered: null, createdAt: Date.now() };
  sys.plotId = plotId;
  sys.name = g("ws_name").trim() || ("ระบบน้ำ" + (S.plots.find(p => p.id === plotId) ? " " + S.plots.find(p => p.id === plotId).name : ""));
  sys.sourceId = g("ws_source") || "";
  sys.pumpName = g("ws_pump").trim();
  sys.valveCount = Number(g("ws_valves")) || 0;
  sys.auto = {
    enabled: document.getElementById("ws_auto").checked,
    everyDays: Number(g("ws_days")) || 2,
    time: g("ws_time") || "06:00",
    minutes: Number(g("ws_min")) || 30
  };
  if (!id) S.water.systems.push(sys);
  saveState(S);
  if (typeof Auth !== "undefined" && Auth.waterSync) Auth.waterSync(); /* ส่งตารางขึ้นเซิร์ฟเวอร์ */
  closeModal();
  render();
  toast(id ? "บันทึกระบบน้ำแล้ว" : "เพิ่มระบบน้ำแล้ว");
};
App.delWaterSystem = function (id) {
  App.confirm("ลบระบบน้ำนี้?", "บันทึกการให้น้ำของระบบนี้จะถูกลบด้วย", () => {
    S.water.systems = S.water.systems.filter(x => x.id !== id);
    S.water.logs = S.water.logs.filter(l => l.systemId !== id);
    saveState(S);
    if (typeof Auth !== "undefined" && Auth.waterSync) Auth.waterSync();
    render(); toast("ลบแล้ว");
  });
};

/* ฟอร์ม: แหล่งน้ำ */
App.modalWaterSource = function (id) {
  const src = id ? S.water.sources.find(x => x.id === id) : null;
  const types = ["บ่อพักน้ำ", "น้ำบาดาล", "ประปา", "คลอง/แม่น้ำ", "ฝน"];
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("droplet")} ${src ? "แก้ไขแหล่งน้ำ" : "เพิ่มแหล่งน้ำ"}</h3>
    <div class="field"><label>ชื่อ *</label><input id="wsrc_name" placeholder="เช่น บ่อพักน้ำใหญ่" value="${esc(src ? src.name : "")}"></div>
    <div class="field"><label>ประเภท</label><select id="wsrc_type">${types.map(t => `<option ${src && src.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    <div style="display:flex;gap:8px">
      <div class="field grow"><label>ความจุ (ลบ.ม.)</label><input id="wsrc_cap" type="number" min="0" value="${src ? src.capacityM3 || "" : ""}"></div>
      <div class="field grow"><label>ระดับน้ำ (%)</label><input id="wsrc_lvl" type="number" min="0" max="100" value="${src ? src.levelPct || "" : ""}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveWaterSource('${id || ""}')">${ic("save")} บันทึก</button>
    </div>`);
};
App.saveWaterSource = function (id) {
  const name = (document.getElementById("wsrc_name").value || "").trim();
  if (!name) { toast("กรอกชื่อแหล่งน้ำ"); return; }
  const src = id ? (S.water.sources.find(x => x.id === id) || {}) : { id: uid() };
  src.name = name;
  src.type = document.getElementById("wsrc_type").value;
  src.capacityM3 = Number(document.getElementById("wsrc_cap").value) || 0;
  src.levelPct = Math.max(0, Math.min(100, Number(document.getElementById("wsrc_lvl").value) || 0));
  if (!id) S.water.sources.push(src);
  saveState(S);
  closeModal();
  render();
  toast("บันทึกแหล่งน้ำแล้ว");
};
App.delWaterSource = function (id) {
  App.confirm("ลบแหล่งน้ำนี้?", "ระบบน้ำที่ผูกกับแหล่งนี้จะไม่ระบุแหล่งน้ำ (ข้อมูลอื่นไม่หาย)", () => {
    S.water.sources = S.water.sources.filter(x => x.id !== id);
    S.water.systems.forEach(sys => { if (sys.sourceId === id) sys.sourceId = ""; });
    saveState(S); render(); toast("ลบแล้ว");
  });
};

/* บันทึกให้น้ำตอนนี้ */
App.modalWaterNow = function (sysId) {
  const sys = S.water.systems.find(x => x.id === sysId);
  if (!sys) return;
  const defMin = sys.auto && sys.auto.enabled ? sys.auto.minutes : 30;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("droplet")} บันทึกให้น้ำ</h3>
    <div class="modal-sub">แปลง: ${esc((plotById(S, sys.plotId) || {}).name || "-")} · วันนี้ ${dateLabel(todayISO())}</div>
    <div style="display:flex;gap:8px">
      <div class="field grow"><label>นาน (นาที)</label><input id="wn_min" type="number" min="1" value="${defMin}"></div>
      <div class="field grow"><label>ปริมาณ (ลบ.ม.) — ไม่บังคับ</label><input id="wn_m3" type="number" min="0" step="0.1"></div>
    </div>
    <div class="field"><label>โน้ต</label><input id="wn_note" placeholder="เช่น ให้น้ำเช้า / ฝนตกเล็กน้อย"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveWaterNow('${sysId}')">${ic("save")} บันทึกการให้น้ำ</button>
    </div>`);
};
App.saveWaterNow = function (sysId) {
  const sys = S.water.systems.find(x => x.id === sysId);
  if (!sys) return;
  const minutes = Number((document.getElementById("wn_min") || {}).value) || 0;
  const m3 = Number((document.getElementById("wn_m3") || {}).value) || 0;
  const note = ((document.getElementById("wn_note") || {}).value || "").trim();
  S.water.logs.push({ id: uid(), systemId: sysId, date: todayISO(), time: new Date().toTimeString().slice(0, 5), minutes, m3, note });
  sys.lastWatered = todayISO();
  saveState(S);
  closeModal();
  render();
  toast("บันทึกการให้น้ำแล้ว 💧");
};
App.delWaterLog = function (id) {
  S.water.logs = S.water.logs.filter(l => l.id !== id);
  saveState(S); render(); toast("ลบบันทึกแล้ว");
};

/* ---------------- ราคาตลาดวันนี้ (ข้อมูลจริงจาก สศก. + ตลาดไท) ---------------- */
function renderPrices() {
  const cached = App._marketPrices;
  const cards = cached ? cached.products.map(p => {
    const same = p.min === p.max;
    const detail = p.markets.map(m => esc(m.market) + " (" + esc(m.province) + ") = " + fmtNum(m.price) + " " + esc(p.unit)).join("<br>");
    return `
    <details class="card" style="padding:12px 14px">
      <summary style="cursor:pointer;list-style:none">
        <div class="row">
          <div class="plot-emoji chip-price">${ic("dollar")}</div>
          <div class="grow">
            <div class="bold" style="font-size:.86rem">${esc(p.product)}</div>
            <div class="muted" style="font-size:.72rem">${esc(p.category)} · ${p.count} จุดรับซื้อ · ${dateLabel(p.date)}</div>
          </div>
          <div style="text-align:right">
            <div class="bold price-trend-up" style="font-size:.92rem">${fmtNum(p.min)}${same ? "" : "-" + fmtNum(p.max)}</div>
            <div class="muted" style="font-size:.68rem">${esc(p.unit)}</div>
          </div>
        </div>
      </summary>
      <div class="muted" style="font-size:.76rem;margin-top:8px;border-top:1px solid var(--line);padding-top:8px;line-height:1.7">${detail}</div>
    </details>`;
  }).join("") : `
    <div class="card"><div class="empty"><div class="e-ico">${ic("dollar")}</div><div class="e-title">กดปุ่มด้านล่างเพื่อดึงราคาล่าสุด</div><div class="muted">ข้อมูลจริงจาก API สศก. (ศูนย์ข้อมูลเกษตรแห่งชาติ) — ราคารับซื้อรายวัน ณ ตลาดสำคัญทั่วประเทศ</div></div></div>`;
  return `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem">ราคารับซื้อรายวัน <span class="badge badge-green">ข้อมูลจริง สศก.</span></div>
      <button class="btn btn-primary btn-sm" onclick="App.loadMarketPrices()">${ic("refresh")} ${cached ? "รีเฟรช" : "ดึงราคาล่าสุด"}</button>
    </div>
    ${cached ? `<div class="muted" style="font-size:.72rem;margin-bottom:8px">ข้อมูลวันที่ ${dateLabel(cached.date)} · ${cached.products.length} สินค้า — กดการ์ดเพื่อดูราคาแยกตามตลาด</div>` : ""}
    <div class="card-grid">${cards}</div>

    <div class="section-title">ราคาสินค้าเกษตรรายวัน (วิดเจ็ตอัปเดตอัตโนมัติ)</div>
    <div class="card" id="rakaWidget"><div class="muted" style="font-size:.76rem;text-align:center;padding:6px">กำลังโหลดตารางราคา...</div></div>

    <div class="section-title">แหล่งราคาทางการ (กดเปิดเว็บ)</div>
    <div class="card">
      <div class="row-line" onclick="window.open('https://talaadthai.com/products','_blank')" role="button">
        <span class="task-ico" style="background:var(--green-light);color:var(--green-deep)">${ic("dollar")}</span>
        <div class="grow"><div class="bold" style="font-size:.84rem">ตลาดไท — ราคาผักผลไม้ขายส่งรายวัน</div><div class="muted" style="font-size:.7rem">ราคาผักสดรายวัน (คะน้า ผักกาด และอื่น ๆ) — ที่มาข้อมูลจริงจากตลาดไท</div></div>
        <span class="task-arrow">${ic("chevron")}</span>
      </div>
      <div class="row-line" onclick="window.open('https://pricelist.dit.go.th/main.php','_blank')" role="button">
        <span class="task-ico" style="background:var(--blue-light);color:var(--blue-text)">${ic("dollar")}</span>
        <div class="grow"><div class="bold" style="font-size:.84rem">กรมการค้าภายใน — ราคาขายปลีก/ขายส่ง</div><div class="muted" style="font-size:.7rem">ราคาสินค้าเกษตรทางการรายวัน รวมตลาดดำหม้อ ตลาดบ้านเด่น</div></div>
        <span class="task-arrow">${ic("chevron")}</span>
      </div>
      <div class="muted mt-8" style="font-size:.7rem">${ic("info")} หมายเหตุ: ราคาผักสดรายวันยังไม่มี API เปิดเผย — ดูจากลิงก์ทางการด้านบน หรือดูราคาขายจริงของคุณเองจากใบเสร็จในหน้า "ขายสินค้า"</div>
    </div>`;
}
/* โหลดราคาจาก Worker (proxy กัน CORS) + ฝังวิดเจ็ตราคา */
App.loadMarketPrices = async function () {
  toast("กำลังดึงราคาล่าสุดจาก สศก...");
  try {
    const r = await authCall("market_prices", {});
    if (!r.ok) { toast("ดึงราคาไม่สำเร็จ: " + (r.error || "")); return; }
    App._marketPrices = r.data;
    render();
  } catch (e) { toast("เชื่อมต่อไม่ได้"); }
};
/* ฝังวิดเจ็ต rakakaset (script แบบ dynamic — innerHTML ไม่รัน script เอง) */
App.mountRakaWidget = function () {
  const el = document.getElementById("rakaWidget");
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = "1";
  el.innerHTML = "";
  const s = document.createElement("script");
  s.src = "https://rakakaset.com/widgets/table.js";
  el.appendChild(s);
};

/* ---------------- โหมดแชร์: หน้าดูแปลงแบบ read-only + คอมเมนต์ ---------------- */
function qrImageUrl(link, size) {
  const s = Number(size) || 220;
  return "https://api.qrserver.com/v1/create-qr-code/?size=" + s + "x" + s + "&margin=12&data=" + encodeURIComponent(link);
}
function passportMetrics(d) {
  const tasks = d.tasks || [];
  const done = tasks.filter(t => t.status === "done");
  const dates = tasks.map(t => t.date).filter(Boolean).sort();
  const inputs = {};
  let harvestKg = 0, inputCost = 0;
  tasks.forEach(t => {
    if (t.status !== "done") return;
    if (t.harvestQty) harvestKg += Number(t.harvestQty) || 0;
    else if (t.type === "harvest" && t.qty) harvestKg += Number(t.qty) || 0;
    (t.costItems || []).forEach(it => {
      const name = String(it.name || "").trim();
      if (!name) return;
      const unit = String(it.unit || "").trim();
      const key = name + "|" + unit;
      if (!inputs[key]) inputs[key] = { name, unit, qty: 0, cost: 0, category: it.category || "" };
      inputs[key].qty += Number(it.qty) || 0;
      inputs[key].cost += Number(it.totalCost) || 0;
      inputCost += Number(it.totalCost) || 0;
    });
  });
  const typeCounts = {};
  done.forEach(t => {
    const k = t.type || "work";
    typeCounts[k] = (typeCounts[k] || 0) + 1;
  });
  const typeRows = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, label: TYPE_LABELS[type] || type || "กิจกรรม" }));
  const inputRows = Object.values(inputs).sort((a, b) => b.cost - a.cost).slice(0, 8);
  return {
    totalTasks: tasks.length,
    doneTasks: done.length,
    plannedTasks: tasks.length - done.length,
    harvestKg,
    inputCost,
    firstDate: dates[0] || "",
    lastDate: dates[dates.length - 1] || "",
    typeRows,
    inputRows
  };
}
function passportMiniStats(d, m) {
  const f = d.finance || { revenue: 0, cost: 0, net: 0 };
  const shareCycle = d.cycle || null;
  const age = shareCycle && shareCycle.startDate ? ageDays(shareCycle.startDate) : 0;
  const perRaiCost = d.plot && d.plot.sizeRai > 0 ? Math.round(f.cost / d.plot.sizeRai) : 0;
  const perKgCost = m.harvestKg > 0 ? Math.round(f.cost / m.harvestKg) : 0;
  return [
    { label: "อายุรอบปลูก", value: shareCycle ? age + " วัน" : (d.cycles || []).length + " รอบ" },
    { label: "กิจกรรมเสร็จ", value: m.doneTasks + "/" + m.totalTasks },
    { label: "เก็บเกี่ยวรวม", value: m.harvestKg ? fmtNum(m.harvestKg) + " กก." : "รอบันทึก" },
    { label: "ต้นทุน/ไร่", value: perRaiCost ? fmtMoney(perRaiCost) + " บ." : "—" },
    { label: "ต้นทุน/กก.", value: perKgCost ? fmtMoney(perKgCost) + " บ." : "—" },
    { label: "กำไรสุทธิ", value: fmtMoney(f.net) + " บ.", cls: f.net >= 0 ? "price-trend-up" : "price-trend-down" }
  ];
}
function shareTaskHtml(t) {
  const meta = [];
  meta.push(TYPE_LABELS[t.type] || t.type || "กิจกรรม");
  if (t.date) meta.push(dateLabel(t.date));
  if (t.harvestQty) meta.push("เก็บเกี่ยว " + fmtNum(t.harvestQty) + " กก.");
  else if (t.qty) meta.push("จำนวน " + fmtNum(t.qty) + (t.unit ? " " + t.unit : ""));
  if (t.revenue) meta.push("รายรับ " + fmtMoney(t.revenue) + " บาท");
  if (t.cost) meta.push("ต้นทุน " + fmtMoney(t.cost) + " บาท");
  const costs = (t.costItems || []).filter(it => it.name || it.qty || it.totalCost);
  const costsHtml = costs.length ? `
    <div class="td-cost-list" style="margin-top:7px">
      ${costs.map(it => {
        const m = [];
        if (it.qty) m.push(fmtNum(it.qty) + (it.unit ? " " + it.unit : ""));
        return `<div class="td-cost-row"><span>${esc(it.name || "ค่าใช้จ่าย")} ${m.length ? `<span class="muted" style="font-size:.68rem">${esc(m.join(" · "))}</span>` : ""}</span><b>${fmtMoney(it.totalCost)} บาท</b></div>`;
      }).join("")}
    </div>` : "";
  return `
    <div class="row-line" style="align-items:flex-start">
      <span class="task-ico">${ic(TYPE_ICONS[t.type] || "check")}</span>
      <div class="grow">
        <div class="bold" style="font-size:.84rem">${esc(t.title)}</div>
        <div class="muted" style="font-size:.7rem">${meta.map(esc).join(" · ")}</div>
        ${t.note ? `<div class="td-note-body" style="margin-top:6px;font-size:.74rem">${esc(t.note)}</div>` : ""}
        ${costsHtml}
      </div>
      ${t.status === "done" ? '<span class="badge badge-green">เสร็จ</span>' : '<span class="badge badge-amber">แผน</span>'}
    </div>`;
}
App.renderShareView = function () {
  const v = document.getElementById("view");
  const nav = document.getElementById("bottomNav");
  const fd = document.getElementById("fabDock");
  if (nav) nav.innerHTML = "";
  if (fd) fd.style.display = "none";
  ["notifBtn", "profileBtn", "tourBtn", "editBtn"].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = "none"; });
  const rs = document.getElementById("roleSwitch");
  if (rs) rs.innerHTML = "";
  if (v.dataset.shareLoaded) return;
  v.dataset.shareLoaded = "1";
  v.innerHTML = `<div class="card"><div class="muted" style="text-align:center;padding:20px">${ic("droplet")} กำลังโหลดแปลงที่แชร์...</div></div>`;
  App.loadShareView();
};
App.loadShareView = async function () {
  const v = document.getElementById("view");
  const r = await authCall("share_get", { shareToken: Auth.shareMode });
  if (!r.ok) {
    v.innerHTML = `<div class="card"><div class="empty"><div class="e-title">${ic("alert")} ลิงก์ไม่ถูกต้อง</div><div class="muted">${esc(r.error || "")}</div></div></div>`;
    return;
  }
  const d = r.data;
  let body = "";
  if (d.plot) {
    const f = d.finance || { revenue: 0, cost: 0, net: 0 };
    const perRai = d.plot.sizeRai > 0 ? Math.round(f.cost / d.plot.sizeRai) : 0;
    const shareCycle = d.cycle || null;
    const pm = passportMetrics(d);
    const stats = passportMiniStats(d, pm);
    const pageLink = location.href;
    const qr = qrImageUrl(pageLink, 180);
    body = `
      <div class="passport-hero">
        <div class="passport-hero-main">
          <div class="passport-eyebrow">${ic("qr")} Product Passport</div>
          <h1>${shareCycle ? esc(shareCycle.plant) : esc(d.plot.name)}</h1>
          <div class="passport-sub">${shareCycle ? `แปลง ${esc(d.plot.name)} · รอบ ${shareCycle.round || "—"} · เริ่ม ${dateLabel(shareCycle.startDate || "")}` : "พาสปอร์ตภาพรวมทั้งแปลง — รวมทุกรอบปลูก"}</div>
          <div class="passport-badges">
            ${shareCycle ? (shareCycle.status === "active" ? '<span class="badge badge-green">กำลังปลูก</span>' : '<span class="badge badge-gray">ปิดรอบแล้ว</span>') : (d.plot.status === "active" ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">ว่าง</span>')}
            <span class="badge badge-blue">บันทึกจากเจ้าของฟาร์ม</span>
            <span class="badge badge-amber">ดูอย่างเดียว</span>
          </div>
        </div>
        <div class="passport-qr">
          <img src="${esc(qr)}" alt="QR Product Passport">
          <div>สแกนเพื่อเปิดหน้านี้</div>
        </div>
      </div>
      <div class="passport-actions no-print">
        <button class="btn btn-primary" onclick="window.print()">${ic("printer")} พิมพ์/บันทึก PDF</button>
        <button class="btn btn-outline" onclick="App.copyText(String(location.href))">${ic("save")} คัดลอกลิงก์</button>
      </div>
      <div class="passport-stats">
        ${stats.map(x => `<div class="passport-stat"><div class="lb">${esc(x.label)}</div><div class="vl ${x.cls || ""}">${esc(x.value)}</div></div>`).join("")}
      </div>
      <div class="section-title">สรุปผลผลิตและต้นทุน</div>
      <div class="card">
        <div class="row row-between"><span class="muted">ขนาดพื้นที่</span><span class="bold">${fmtNum(d.plot.sizeRai)} ไร่</span></div>
        <div class="row row-between mt-4"><span class="muted">รายได้รวม</span><span class="bold price-trend-up">${fmtMoney(f.revenue)} บาท</span></div>
        <div class="row row-between mt-4"><span class="muted">ต้นทุนรวม</span><span class="bold price-trend-down">${fmtMoney(f.cost)} บาท</span></div>
        <div class="divider"></div>
        <div class="row row-between"><span class="bold">กำไรสุทธิ</span><span class="bold ${f.net >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(f.net)} บาท</span></div>
        <div class="muted mt-8" style="font-size:.72rem">ช่วงบันทึก ${pm.firstDate ? dateLabel(pm.firstDate) : "—"} ถึง ${pm.lastDate ? dateLabel(pm.lastDate) : "—"}${perRai ? ` · ต้นทุน ${fmtMoney(perRai)} บ./ไร่` : ""}</div>
      </div>
      <div class="section-title">บันทึกการปฏิบัติงาน</div>
      <div class="card">
        ${pm.typeRows.length ? pm.typeRows.map(x => `
          <div class="row-line"><span class="task-ico">${ic(TYPE_ICONS[x.type] || "check")}</span><div class="grow"><div class="bold" style="font-size:.84rem">${esc(x.label)}</div><div class="muted" style="font-size:.7rem">กิจกรรมที่ทำเสร็จแล้ว</div></div><span class="badge badge-green">${x.count} ครั้ง</span></div>
        `).join("") : '<div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีงานที่ติ๊กเสร็จ</div>'}
      </div>
      <div class="section-title">วัสดุ/ปัจจัยผลิตที่บันทึกไว้</div>
      <div class="card">
        ${pm.inputRows.length ? pm.inputRows.map(x => `
          <div class="row-line"><span class="task-ico">${ic(x.category === "chemical" ? "spray" : x.category === "fertilizer" ? "leaf" : "box")}</span><div class="grow"><div class="bold" style="font-size:.84rem">${esc(x.name)}</div><div class="muted" style="font-size:.7rem">${x.qty ? fmtNum(x.qty) + (x.unit ? " " + esc(x.unit) : "") : "มีบันทึกต้นทุน"}</div></div><span class="bold" style="font-size:.8rem">${fmtMoney(x.cost)} บ.</span></div>
        `).join("") : '<div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีรายการวัสดุในรอบนี้</div>'}
      </div>
      <div class="section-title">ข้อมูลรอบปลูก</div>
      <div class="card">
        ${d.cycles.length === 0 ? '<div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีรอบปลูก</div>' : d.cycles.map(c => `
        <div class="row-line"><span class="task-ico">${ic("leaf")}</span><div class="grow"><div class="bold" style="font-size:.84rem">${esc(c.plant)}</div><div class="muted" style="font-size:.7rem">เริ่ม ${dateLabel(c.startDate || "")} · รอบ ${c.round || "-"}</div></div>${c.status === "active" ? '<span class="badge badge-green">กำลังปลูก</span>' : '<span class="badge badge-gray">ปิดแล้ว</span>'}</div>`).join("")}
      </div>
      <div class="section-title">${shareCycle ? "ไทม์ไลน์กิจกรรมของพืชนี้" : "กิจกรรมล่าสุด"}</div>
      <div class="card">
        ${d.tasks.length === 0 ? '<div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีบันทึก</div>' : d.tasks.map(t => `
        ${shareTaskHtml(t)}`).join("")}
      </div>
      <div class="card passport-note">
        <div class="bold">${ic("info")} หมายเหตุความน่าเชื่อถือ</div>
        <div class="muted mt-4" style="font-size:.74rem">ข้อมูลนี้มาจากบันทึกของเจ้าของฟาร์มในระบบ FARMULTIMATE SOLUTIONS เพื่อใช้ประกอบการตรวจสอบย้อนกลับ ไม่ใช่ใบรับรองมาตรฐานจากหน่วยงานรัฐโดยตรง</div>
      </div>`;
  } else {
    body = `
      <div class="section-title">ฟาร์มของเจ้าของแปลง</div>
      <div class="card">
        ${(d.farm || []).map(pl => `<div class="row-line"><span class="task-ico">${ic("map")}</span><div class="grow"><div class="bold" style="font-size:.84rem">${esc(pl.name)}</div><div class="muted" style="font-size:.7rem">${fmtNum(pl.sizeRai)} ไร่</div></div>${pl.status === "active" ? '<span class="badge badge-green">Active</span>' : ""}</div>`).join("") || '<div class="muted" style="text-align:center;padding:8px">ยังไม่มีแปลง</div>'}
      </div>`;
  }
  const comments = (d.comments || []).map(cm => `
    <div class="row-line"><span class="task-ico">${ic("user")}</span><div class="grow"><div class="bold" style="font-size:.8rem">${esc(cm.name)}</div><div class="muted" style="font-size:.74rem">${esc(cm.text)}</div></div><span class="muted" style="font-size:.66rem">${new Date(Number(cm.created_at)).toLocaleDateString("th-TH")}</span></div>`).join("");
  v.innerHTML = `
    <div class="hero no-print" style="margin-bottom:12px"><div class="hero-row"><div><div class="hero-greet">FARMULTIMATE SOLUTIONS</div><div class="hero-sub">Product Passport / หน้าแชร์สำหรับผู้เยี่ยมชม</div></div></div></div>
    ${body}
    <div class="section-title no-print">คอมเมนต์ (${(d.comments || []).length})</div>
    <div class="card no-print">
      <div class="field"><label>ชื่อ</label><input id="sc_name" placeholder="ชื่อของคุณ (ไม่บังคับ)"></div>
      <div class="field"><label>คอมเมนต์</label><textarea id="sc_text" rows="2" placeholder="แสดงความคิดเห็น/ถาม-ตอบเจ้าของแปลง"></textarea></div>
      <button class="btn btn-primary btn-block" onclick="App.shareCommentSubmit()">${ic("check")} ส่งคอมเมนต์</button>
      <div id="sc_list" class="mt-12">${comments || '<div class="muted" style="text-align:center;font-size:.76rem">ยังไม่มีคอมเมนต์</div>'}</div>
    </div>
    <div class="muted" style="font-size:.68rem;text-align:center;padding:10px">FARMULTIMATE SOLUTIONS — ระบบจัดการฟาร์มอัจฉริยะ</div>`;
};
App.shareCommentSubmit = async function () {
  const name = (document.getElementById("sc_name") || {}).value || "";
  const text = (document.getElementById("sc_text") || {}).value || "";
  if (!text.trim()) { toast("พิมพ์คอมเมนต์ก่อนส่ง"); return; }
  const r = await authCall("share_comment", { shareToken: Auth.shareMode, name, text });
  if (!r.ok) { toast(r.error || "ส่งไม่สำเร็จ"); return; }
  toast("ส่งคอมเมนต์แล้ว ✓");
  const v = document.getElementById("view");
  if (v) v.dataset.shareLoaded = "";
  App.renderShareView();
};

/* ฝั่งเจ้าของ: สร้าง/ดูลิงก์แชร์ของแปลง */
App.modalShare = async function (plotId) {
  if (!(typeof Auth !== "undefined" && Auth.session)) return;
  const p = plotById(S, plotId);
  if (!p) return;
  const cycles = S.cycles.filter(c => c.plotId === plotId).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lst = await authCall("share_list", { token: Auth.session.token });
  const shares = lst.ok ? (lst.data.shares || []) : [];
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("user")} เลือกลิงก์แชร์</h3>
    <div class="modal-sub">แนะนำให้แชร์ตามพืช/รอบปลูก เพื่อให้ผู้รับเห็นเฉพาะรายละเอียดและกิจกรรมของพืชนั้น ไม่รวมทุกพืชเข้าด้วยกัน</div>
    <div class="card" style="box-shadow:none;margin-bottom:10px">
      <div class="row-line">
        <span class="task-ico">${ic("map")}</span>
        <div class="grow"><div class="bold" style="font-size:.84rem">ทั้งแปลง: ${esc(p.name)}</div><div class="muted" style="font-size:.72rem">รวมทุกรอบปลูกและทุกกิจกรรมของแปลงนี้</div></div>
        <button class="btn btn-sm btn-outline" onclick="App.openShareLink('${plotId}', '')">${ic("user")} แชร์</button>
      </div>
      ${cycles.length ? cycles.map(c => {
        const f = shares.find(x => x.plot_id === plotId && x.cycle_id === c.id && x.active);
        return `<div class="row-line">
          <span class="task-ico">${ic("leaf")}</span>
          <div class="grow"><div class="bold" style="font-size:.84rem">${esc(c.plant)} <span class="badge badge-blue">รอบ ${c.round || "—"}</span></div><div class="muted" style="font-size:.72rem">เริ่ม ${esc(c.startDate)} · ${S.tasks.filter(t => t.cycleId === c.id).length} กิจกรรม${f ? ` · คอมเมนต์ ${f.comments || 0}` : ""}</div></div>
          <button class="btn btn-sm btn-primary" onclick="App.openShareLink('${plotId}', '${c.id}')">${ic("qr")} QR Passport</button>
        </div>`;
      }).join("") : `<div class="muted" style="text-align:center;padding:10px">ยังไม่มีรอบปลูกให้แชร์แบบแยกพืช</div>`}
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button></div>`);
};
App.openShareLink = async function (plotId, cycleId) {
  if (!(typeof Auth !== "undefined" && Auth.session)) return;
  toast("กำลังเตรียมลิงก์แชร์...");
  let token = null, comments = 0;
  const lst = await authCall("share_list", { token: Auth.session.token });
  if (lst.ok) { const f = (lst.data.shares || []).find(x => x.plot_id === plotId && (x.cycle_id || "") === (cycleId || "") && x.active); if (f) { token = f.token; comments = f.comments; } }
  if (!token) {
    const cr = await authCall("share_create", { token: Auth.session.token, plotId, cycleId });
    if (!cr.ok) { toast(cr.error || "สร้างลิงก์ไม่สำเร็จ"); return; }
    token = cr.data.token;
  }
  const c = cycleId ? cycleById(S, cycleId) : null;
  const link = location.origin + "/?share=" + token;
  const qr = qrImageUrl(link, 220);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("qr")} ${c ? "QR Product Passport" : "ลิงก์แชร์แปลง"}</h3>
    <div class="modal-sub">${c ? `สแกนแล้วเห็นเฉพาะ <b>${esc(c.plant)}</b> รอบ ${c.round || "—"} พร้อมกิจกรรม ผลผลิต ต้นทุน และวัสดุที่ใช้` : "ลิงก์นี้เห็นทั้งแปลง รวมทุกรอบปลูก"} · ดูได้อย่างเดียวและคอมเมนต์ได้ · คอมเมนต์ปัจจุบัน ${comments} รายการ</div>
    <div class="passport-share-box">
      <img src="${esc(qr)}" alt="QR Product Passport">
      <div>
        <div class="bold">${c ? esc(c.plant) : "แชร์แปลง"}</div>
        <div class="muted" style="font-size:.74rem">${c ? "ใช้พิมพ์ติดผลผลิต/กล่อง/เอกสารส่งของได้" : "ใช้ส่งให้ผู้เยี่ยมชมดูข้อมูลแปลง"}</div>
      </div>
    </div>
    <div class="field"><label>ลิงก์แชร์</label><input readonly value="${esc(link)}" onclick="this.select()" class="soft-bg" style="font-size:.78rem"></div>
    <div class="modal-actions share-actions">
      <button class="btn btn-primary" onclick="App.copyText('${esc(link)}')">${ic("save")} คัดลอกลิงก์</button>
      <button class="btn btn-outline" onclick="window.open('${esc(link)}','_blank')">${ic("eye")} เปิดดู</button>
      <button class="btn btn-danger-soft" onclick="App.shareRevoke('${esc(token)}')">${ic("trash")} ยกเลิกลิงก์</button>
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
App.shareRevoke = function (token) {
  App.confirm("ยกเลิกลิงก์แชร์นี้?", "ใครก็ตามที่มีลิงก์เดิมจะเข้าดูไม่ได้อีก (คอมเมนต์เดิมยังเก็บไว้)", () => {
    authCall("share_revoke", { token: Auth.session.token, shareToken: token }).then(r => {
      toast(r.ok ? "ยกเลิกลิงก์แล้ว" : "ยกเลิกไม่สำเร็จ");
      closeModal();
    });
  });
};

/* ---------------- Settings ---------------- */
const ADMIN_LS = "fus_admin_unlocked";
function adminUnlocked() { return sessionStorage.getItem(ADMIN_LS) === "1"; }
/* ---------------- พื้นที่เก็บข้อมูล (หน้าตั้งค่า) ---------------- */
function fmtBytes(b) { return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB"; }
/* แยกขนาดข้อมูลตามหมวด — เห็นว่าอะไรกินพื้นที่ */
function storageBreakdown() {
  const sz = v => { try { return JSON.stringify(v).length; } catch (e) { return 0; } };
  const rows = [
    { label: "🌱 แปลง", key: "plots" },
    { label: "🌿 รอบปลูก", key: "cycles" },
    { label: "📋 งาน/กิจกรรม", key: "tasks" },
    { label: "🧪 สต็อกยา/ปุ๋ย", key: "stock" },
    { label: "🧾 การขาย", key: "sales" },
    { label: "🚜 อุปกรณ์", key: "equipment" }
  ].map(r => ({ label: r.label, count: (S[r.key] || []).length, bytes: sz(S[r.key] || []) }));
  const knownSum = rows.reduce((a, r) => a + r.bytes, 0);
  rows.push({ label: "📦 อื่นๆ (ตั้งค่า/แบรนด์ ฯลฯ)", count: null, bytes: Math.max(0, sz(S) - knownSum) });
  let wx = 0; try { wx = (localStorage.getItem("kaset-weather-cache-v2") || "").length; } catch (e) {}
  if (wx) rows.push({ label: "🌦️ แคชพยากรณ์อากาศ", count: null, bytes: wx });
  return rows.sort((a, b) => b.bytes - a.bytes);
}
/* ดูข้อมูลดิบรายหมวดเป็น JSON (แสดง 8,000 ตัวอักษรแรก — ก๊อปได้ทั้งก้อน) */
App._rawKey = "plots";
App.viewRawData = function (key) {
  if (key) App._rawKey = key;
  const opts = [["plots", "🌱 แปลง"], ["cycles", "🌿 รอบปลูก"], ["tasks", "📋 งาน/กิจกรรม"], ["stock", "🧪 สต็อกยา/ปุ๋ย"], ["sales", "🧾 การขาย"], ["equipment", "🚜 อุปกรณ์"]];
  const json = JSON.stringify(S[App._rawKey] || [], null, 2);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>ดูข้อมูลดิบ (JSON)</h3>
    <div class="modal-sub">ข้อมูลจริงที่เก็บอยู่ในเครื่องนี้ — ก๊อปไปเปิดดู/เก็บไว้ได้</div>
    <select class="cycf" style="width:100%" onchange="App.viewRawData(this.value)">
      ${opts.map(o => `<option value="${o[0]}" ${o[0] === App._rawKey ? "selected" : ""}>${o[1]} (${(S[o[0]] || []).length} รายการ)</option>`).join("")}
    </select>
    <pre class="raw-json" id="rawJson">${esc(json.length > 8000 ? json.slice(0, 8000) + "\n… (เหลืออีก " + fmtBytes(json.length - 8000) + " — กดก๊อปเพื่อดูทั้งก้อน)" : json)}</pre>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.copyRawJson()">${ic("download")} ก๊อปทั้งหมด</button>
      <button class="btn btn-primary" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
App.copyRawJson = function () {
  const txt = JSON.stringify(S[App._rawKey] || [], null, 2);
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
    () => toast("ก๊อปข้อมูลแล้ว (" + fmtBytes(txt.length) + ")"),
    () => toast("ก๊อปไม่ได้ — เบราว์เซอร์ไม่อนุญาต")
  );
};
/* ตรวจขนาดข้อมูลก้อนล่าสุดบนคลาวด์ (D1) ของบัญชีนี้ */
App.checkCloudSize = async function () {
  if (typeof authCall === "undefined" || !Auth.session) { toast("ยังไม่ล็อกอิน — ยังไม่มีข้อมูลบนคลาวด์"); return; }
  toast("กำลังตรวจข้อมูลบนคลาวด์...");
  try {
    const r = await authCall("load", { token: Auth.session.token });
    if (!r || !r.ok) { toast("ตรวจไม่สำเร็จ: " + ((r && r.error) || "เชื่อมต่อไม่ได้")); return; }
    const dataStr = (r.data && r.data.data) ? String(r.data.data) : "";
    const ts = r.data && r.data.updated_at ? new Date(Number(r.data.updated_at) || Date.now()) : null;
    openModal(`
      <button class="modal-x" onclick="App.closeModal()">✕</button>
      <h3>ข้อมูลบนคลาวด์</h3>
      <div class="modal-sub">บัญชี ${esc(Auth.session.email)}</div>
      <div class="card" style="margin-top:8px">
        <div class="row row-between"><span class="muted">ขนาดข้อมูลล่าสุด</span><span class="bold">${fmtBytes(dataStr.length)}</span></div>
        <div class="row row-between mt-8"><span class="muted">อัปเดตเมื่อ</span><span class="small bold">${ts ? ts.toLocaleString("th-TH") : "—"}</span></div>
        <div class="muted mt-8" style="font-size:.72rem">เก็บบน Cloudflare D1 (ฐานข้อมูล farmultimate-db) — ซิงก์อัตโนมัติทุกครั้งที่แก้ข้อมูลเมื่อล็อกอินอยู่</div>
      </div>`);
  } catch (e) { toast("เชื่อมต่อคลาวด์ไม่ได้ (ออฟไลน์?)"); }
};

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
    ${typeof Auth !== "undefined" ? Auth.cardHtml() : ""}
    <div class="section-title">${ic("save")} สำรองข้อมูล (Export / Import)</div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">ดาวน์โหลดข้อมูลทั้งหมด (งาน / สต็อก / แปลง / ค่าใช้จ่าย) เป็นไฟล์ .json เพื่อสำรอง หรือนำเข้าไฟล์สำรองกลับมาใช้งาน — ข้อมูลบันทึกในเบราว์เซอร์เท่านั้น</div>
      <button class="btn btn-primary btn-block" onclick="App.exportData()">${ic("download")} ดาวน์โหลดข้อมูล (.json)</button>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.importData()">${ic("upload")} นำเข้าข้อมูล (.json)</button>
    </div>
    <div class="section-title">${ic("alert")} พื้นที่เก็บข้อมูล <span class="muted" style="font-size:.72rem;font-weight:600">ในเครื่อง + คลาวด์</span></div>
    <div class="card">
      ${(() => { const st = storageHealthInfo(); const bd = storageBreakdown(); const maxB = Math.max(...bd.map(r => r.bytes), 1); const photoN = S.stock.filter(s => s.photo).length; return `
      <div class="row row-between"><span class="muted">ใช้ไปในเครื่อง</span><span class="bold">${(st.used / 1048576).toFixed(2)} MB / ~5 MB (${st.pct}%)</span></div>
      <div class="storage-bar"><div class="storage-bar-fill ${st.pct >= 80 ? "warn" : ""}" style="width:${st.pct}%"></div></div>
      <div class="divider"></div>
      ${bd.map(r => `
      <div class="row row-between" style="padding:3px 0">
        <span class="muted" style="font-size:.78rem">${r.label}${r.count != null ? ` <b style="color:inherit">(${fmtNum(r.count)})</b>` : ""}</span>
        <span class="small bold" style="white-space:nowrap">${fmtBytes(r.bytes)}</span>
      </div>
      <div class="storage-bar" style="height:4px"><div class="storage-bar-fill" style="width:${Math.round(r.bytes / maxB * 100)}%"></div></div>`).join("")}
      <div class="muted mt-8" style="font-size:.72rem">📷 รูปสินค้าสต็อก ${photoN} รายการ — เก็บเป็นไฟล์ใน images/products/ ของเว็บ (ไม่กินพื้นที่นี้) · รูปที่ถ่ายเพิ่มในอนาคตควรเก็บบนคลาวด์แยก</div>
      ${st.pct >= 80 ? `<div class="muted" style="color:var(--red);font-size:.76rem;margin-top:6px">${ic("alert")} พื้นที่ใกล้เต็ม — สำรองข้อมูลไว้ และลบสต็อก/งานเก่าที่ไม่ใช้</div>` : ""}
      ${storageSaveFailed ? `<div class="muted" style="color:var(--red);font-size:.76rem;margin-top:6px">${ic("alert")} บันทึกล่าสุดไม่สำเร็จ (พื้นที่เต็ม) — สำรองข้อมูลด่วน</div>` : ""}
      <div class="divider"></div>
      <div class="row" style="gap:8px">
        <button class="btn btn-sm btn-outline" style="flex:1" onclick="App.viewRawData()">${ic("eye")} ดูข้อมูลดิบ</button>
        <button class="btn btn-sm btn-outline" style="flex:1" onclick="App.exportData()">${ic("download")} สำรอง .json</button>
      </div>`; })()}
    </div>
    <div class="card mt-8">
      <div class="row row-between"><span class="muted">บนคลาวด์ (Cloudflare D1)</span><span class="small bold">${typeof Auth !== "undefined" && Auth.session ? esc(Auth.session.email) : "ยังไม่ล็อกอิน"}</span></div>
      <div class="row row-between mt-8"><span class="muted">ซิงก์ล่าสุด</span><span class="small bold">${typeof cloudTs === "function" && cloudTs() ? dateLabel(new Date(cloudTs()).toISOString().slice(0, 10)) + " " + new Date(cloudTs()).toTimeString().slice(0, 5) : "—"}</span></div>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.checkCloudSize()">${ic("refresh")} ตรวจขนาดข้อมูลบนคลาวด์</button>
    </div>
    ${adminUnlocked() ? `
    <div class="section-title">${ic("upload")} ซิงก์กับ Lark Base (ผู้ดูแลระบบ) <span class="badge badge-gray">ระดับแอดมิน</span></div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">สำรอง/กู้คืนข้อมูลทั้งหมดไปยัง <b>Lark Base</b> ผ่าน Cloudflare Worker — App Secret เก็บไว้ฝั่ง Worker ไม่หลุดไปหน้าเว็บ</div>
      <button class="btn btn-primary btn-block" onclick="App.larkTest()">${ic("wifi")} ทดสอบการเชื่อมต่อ</button>
      <button class="btn btn-outline btn-block mt-8" onclick="App.larkPush()">${ic("upload")} อัปโหลดข้อมูลไป Lark Base</button>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.larkPull()">${ic("download")} ดาวน์โหลดข้อมูลจาก Lark Base</button>
    </div>` : ""}
    <div class="section-title">${ic("dollar")} หมวดต้นทุน</div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">หมวดที่ใช้ใน dropdown "หมวดหมู่" ของฟอร์มงานและกราฟต้นทุน — เพิ่มหมวดเองได้ตามธุรกิจของคุณ</div>
      ${allCostCats(S).map(c => `
      <div class="ed-row">
        <span class="cc-dot" style="background:${esc(c.color)}"></span>
        <span class="grow">${esc(c.label)}</span>
        ${c.custom ? `<button class="btn btn-sm btn-danger-soft" onclick="App.deleteCostCat('${c.key}')" title="ลบหมวดนี้">${ic("trash")}</button>` : ""}
      </div>`).join("")}
      <button class="btn btn-primary btn-block mt-8" onclick="App.modalCostCat()">${ic("plus")} เพิ่มหมวดต้นทุน</button>
    </div>
    <div class="section-title">${ic("droplet")} สภาพอากาศรายแปลง (Open-Meteo)</div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">สภาพอากาศของแต่ละแปลงดึงจาก <b>Open-Meteo</b> (แบบจำลอง ECMWF IFS ของยุโรป — แบบจำลองที่แม่นที่สุดในโลก) ตามพิกัด GPS ที่ปักหมุด — <b>ฟรี ไม่ต้องใช้คีย์ ไม่ต้องสมัคร</b></div>
      <div class="muted" style="font-size:.72rem">🌍 แหล่งข้อมูล: open-meteo.com · อัปเดตข้อมูลทุก ~15 นาที · แสดงผลแคช 30 นาที (เลขนิ่ง ไม่กระโดดเมื่อรีเฟรช)</div>
    </div>
    ${editorHtml}
    <button class="btn btn-ghost btn-block" onclick="App.startTour()">${ic("compass")} แนะนำระบบ (Tour) อีกครั้ง</button>
    <button class="btn btn-danger-soft btn-block mt-8" onclick="App.resetData()">${ic("refresh")} รีเซ็ตข้อมูลทั้งหมด</button>
    <div class="muted mt-8" style="font-size:.7rem;text-align:center">สภาพอากาศรายแปลงจาก Open-Meteo (ECMWF) — ฟรี ไม่ต้องใช้คีย์ · IoT จริงในเวอร์ชันถัดไป</div>`;
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

/* ---------------- หมวดต้นทุนที่เพิ่มเอง (หน้า ตั้งค่า) ---------------- */
let ccColor = "#16a34a";
const COST_COLOR_CHOICES = ["#16a34a", "#2563eb", "#0ea5e9", "#059669", "#f97316", "#f59e0b", "#8b5cf6", "#64748b", "#06b6d4", "#e11d48", "#7c3aed", "#334155"];
App.modalCostCat = function () {
  ccColor = "#16a34a";
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("plus")} เพิ่มหมวดต้นทุน</h3>
    <div class="modal-sub">หมวดจะแสดงใน dropdown "หมวดหมู่" ของฟอร์มงาน และกราฟต้นทุนในหน้าวิเคราะห์</div>
    <div class="field"><label>ชื่อหมวด *</label><input id="cc_name" placeholder="เช่น ค่าขนส่งผลผลิต" maxlength="40"></div>
    <div class="field"><label>สี</label>
      <div class="cc-colors">
        ${COST_COLOR_CHOICES.map(c => `<button type="button" class="cc-swatch ${c === ccColor ? "sel" : ""}" data-c="${c}" style="background:${c}" onclick="App.costCatColor('${c}')" aria-label="เลือกสี ${c}"></button>`).join("")}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveCostCat()">${ic("save")} เพิ่มหมวด</button>
    </div>`);
  const inp = document.getElementById("cc_name");
  if (inp) inp.focus();
};
App.costCatColor = function (c) {
  ccColor = c;
  document.querySelectorAll(".cc-swatch").forEach(el => el.classList.toggle("sel", el.dataset.c === c));
};
App.saveCostCat = function () {
  const name = (document.getElementById("cc_name").value || "").trim();
  if (!name) { toast("กรอกชื่อหมวดก่อน"); return; }
  if (allCostCats(S).some(c => c.label === name)) { toast("มีหมวดนี้อยู่แล้ว"); return; }
  S.customCostCats = S.customCostCats || [];
  S.customCostCats.push({ key: "cc" + Date.now().toString(36), label: name, color: ccColor });
  saveState(S);
  closeModal();
  render();
  toast("เพิ่มหมวดต้นทุนแล้ว");
};
App.deleteCostCat = function (key) {
  const cat = (S.customCostCats || []).find(c => c.key === key);
  if (!cat) return;
  App.confirm(`ลบหมวด "${cat.label}"?`, "งานที่ใช้หมวดนี้จะถูกเปลี่ยนเป็น 'ค่าใช้จ่ายอื่นๆ' ต้องการดำเนินการต่อหรือไม่?", () => {
    S.customCostCats = (S.customCostCats || []).filter(c => c.key !== key);
    /* ย้ายงานที่ผูกหมวดที่ลบไปเป็น "อื่นๆ" */
    S.tasks.forEach(t => {
      if (t.costCat === key) t.costCat = "other";
      (t.costItems || []).forEach(ci => { if (ci.category === key) ci.category = "other"; });
    });
    saveState(S);
    render();
    toast("ลบหมวดต้นทุนแล้ว");
  });
};

/* ---------------- Export / Import ข้อมูล ---------------- */
App.exportData = function () {
  const payload = {
    app: "farmultimate-solutions",
    type: "backup",
    version: S.version,
    exportedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(S)) // คัดลอกลึก — ข้อมูลทั้งหมด (แปลง/สต็อก/งาน/ค่าใช้จ่าย/รอบ/อุปกรณ์)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "farmultimate-backup-" + todayISO() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`ดาวน์โหลดข้อมูลแล้ว (${S.plots.length} แปลง / ${S.stock.length} รายการสต็อก / ${S.tasks.length} งาน)`);
};
App.importData = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let obj;
      try {
        obj = JSON.parse(reader.result);
      } catch (e) {
        toast("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง");
        return;
      }
      const payload = obj && obj.type === "backup" && obj.data ? obj.data : obj;
      if (!payload || !Array.isArray(payload.tasks) || !Array.isArray(payload.plots) || !Array.isArray(payload.stock)) {
        toast("ไฟล์นี้ไม่ใช่ข้อมูลสำรองของระบบ");
        return;
      }
      App.confirm("นำเข้าข้อมูล?", "ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้ทั้งหมด ต้องการดำเนินการต่อหรือไม่?", () => {
        payload.version = S.version; // ใช้เวอร์ชันระบบปัจจุบันเสมอ
        ensureTaskIds(payload);
        ensureDefaults(payload);
        saveState(payload);
        location.reload();
      });
    };
    reader.readAsText(file);
  });
  input.click();
};

App.resetData = function () {
  App.confirm("รีเซ็ตข้อมูลทั้งหมด?", "ข้อมูลที่บันทึกไว้ทั้งหมดจะถูกล้างให้ว่างเปล่า (เริ่มต้นใหม่ — กรอกเอง) ต้องการดำเนินการต่อหรือไม่?", () => {
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
      <button class="more-card" onclick="App.nav('prices')"><span class="mc-ico">${ic("dollar")}</span><span class="mc-name">ราคาตลาดวันนี้</span><span class="mc-desc">ราคาจริงจาก สศก. + ตลาดไท</span></button>
      <button class="more-card" onclick="App.openWeather('')"><span class="mc-ico">${ic("droplet")}</span><span class="mc-name">สภาพอากาศ 5 สถานี</span><span class="mc-desc">เทียบพยากรณ์ Open-Meteo · ECMWF · GFS · ICON · MET Norway</span></button>
      <button class="more-card" onclick="App.nav('iot')"><span class="mc-ico">${ic("droplet")}</span><span class="mc-name">ระบบน้ำอัตโนมัติ</span><span class="mc-desc">แยกตามแปลง · ตารางให้น้ำ · บันทึกการให้น้ำ</span></button>
      <button class="more-card" onclick="App.nav('settings')"><span class="mc-ico">${ic("gear")}</span><span class="mc-name">ตั้งค่า</span><span class="mc-desc">ข้อมูลระบบ รีเซ็ต ทัวร์</span></button>
      <button class="more-card" onclick="App.startTour()"><span class="mc-ico">${ic("compass")}</span><span class="mc-name">แนะนำระบบ</span><span class="mc-desc">ทัวร์หน้าจอทีละขั้นตอน</span></button>
      ${(S.customMenus || []).map(m => `
      <button class="more-card" onclick="App.goTarget('${esc(m.target || "")}')"><span class="mc-ico">${m.ico && ICONS[m.ico] ? ic(m.ico) : esc(m.ico || "")}</span><span class="mc-name">${esc(m.name)}</span><span class="mc-desc">${esc(m.desc || "")}</span></button>`).join("")}
    </div>
    <div class="card mt-12">
      <div class="bold" style="font-size:.9rem">${ic("info")} ฟีเจอร์หลักของระบบ</div>
      <ul style="margin:8px 0 0 18px;font-size:.8rem;color:var(--muted);line-height:1.9">
        <li>แปลง + รอบการปลูกอัตโนมัติ (รอบ 1, รอบ 2...) พร้อมต้นทุนรายรอบและปฏิทินกิจกรรม</li>
        <li>งานรายวัน: กิจกรรม + ค่าใช้จ่าย/ตัดสต็อกหลายรายการ + ราคาเลือกได้ (ต้นทุน/ขาย/พิมพ์เอง)</li>
        <li>สต็อกยา/ปุ๋ย: นำเข้า Excel, รหัสสินค้า, เปิดใช้/เหลือเศษ, แจ้งเตือน</li>
        <li>ขายสินค้า + ใบส่งสินค้า A4 + ประวัติลูกค้า</li>
        <li>วิเคราะห์รายปี (พ.ศ.): กำไรรายแปลง, การใช้ยา, ร้านค้า — ดูย้อนหลังทุกปี</li>
        <li>ติดตั้งเป็นแอปบนมือถือ (PWA) + ใช้แบบออฟไลน์ได้</li>
      </ul>
    </div>`;
}

/* ---------------- Modals ---------------- */
/* ล็อกการเลื่อนพื้นหลังตอนเปิด modal — กันพื้นหลังเลื่อนตาม/จอกระตุกบนมือถือ
   ใช้ overflow:hidden บน html+body: ปลอดภัยกว่า position:fixed เพราะ
   1) ตำแหน่งเลื่อนเดิมคงอยู่เอง ไม่เด้งไปหัวหน้า 2) ไม่มี state ค้าง (ปิด modal แล้วเลื่อนได้เสมอ)
   3) ไม่มีบั๊ก iOS ตอนคีย์บอร์ดเด้งขึ้น (position:fixed + คีย์บอร์ด ทำให้หน้าไถ่/ค้างเลื่อนไม่ได้) */
function lockBodyScroll() {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}
function unlockBodyScroll() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
function openModal(html) {
  /* ปิดแผงแจ้งเตือนเมื่อเปิด modal (กดแถวงานในแผง → ดูรายละเอียด) */
  const np = document.getElementById("notifPanel");
  if (np) np.hidden = true;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  const bd = root.querySelector(".modal-backdrop");
  bd.addEventListener("click", e => { if (e.target === bd) closeModal(); });
  lockBodyScroll();
  /* ซ่อนปุ่มลัด (FAB) ระหว่างเปิด modal — กันกด/เลื่อนตรงมุมขวาล่างไปโดนพื้นหลัง */
  const fd = document.getElementById("fabDock");
  if (fd) fd.style.visibility = "hidden";
}
function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
  /* ล้างแผนที่ปักหมุด (Leaflet) ตอนปิด modal — กันค้าง/รั่ว */
  if (pickMap) { pickMap.remove(); pickMap = null; pickMarker = null; }
  unlockBodyScroll();
  const fd = document.getElementById("fabDock");
  if (fd) fd.style.visibility = "";
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
          <input id="f_lat" type="text" inputmode="decimal" value="${lat}" style="flex:1" placeholder="ละติจูด">
          <input id="f_lng" type="text" inputmode="decimal" value="${lng}" style="flex:1" placeholder="ลองจิจูด">
        </div>
        <div class="hint">ใช้พิกัดนี้ดึงสภาพอากาศรายแปลง (Open-Meteo) — ควรปักหมุดให้ตรงแปลงเพื่อให้ข้อมูลแม่นยำ</div>
        <button type="button" class="btn btn-sm btn-ghost mt-8" onclick="App.useGps()">${ic("pin")} ใช้ตำแหน่งจริงของฉัน</button>
      </div>
      <div class="pick-hint">${ic("pin")} หรือ<b>แตะ/ลากหมุดบนแผนที่</b>เพื่อปักหมุดตำแหน่งแปลง</div>
      <div class="plot-pick-map" id="pickMap"></div>
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
      `<div class="gps-coords">${ic("pin")} ${la.toFixed(6)}, ${ln.toFixed(6)}</div>
       <a class="btn btn-sm btn-outline mt-8" href="${mapLink(la, ln)}" target="_blank" rel="noopener">${ic("map")} เปิดแผนที่ Google Maps</a>`;
  };
  ["f_lat", "f_lng"].forEach(n => {
    const el = document.getElementById(n);
    el.addEventListener("input", update);
  });
  update();
  initPickMap();
};
/* ---- แผนที่ปักหมุด (Leaflet + OpenStreetMap — ฟรี ไม่ต้องใช้คีย์) ---- */
let pickMap = null, pickMarker = null;
/* สร้าง/ย้ายแผนที่ไปยังพิกัดปัจจุบันในฟอร์ม */
function initPickMap() {
  const el = document.getElementById("pickMap");
  if (!el || typeof L === "undefined") return;
  const la = parseFloat(document.getElementById("f_lat").value) || 14.9823;
  const ln = parseFloat(document.getElementById("f_lng").value) || 100.4582;
  if (!pickMap) {
    pickMap = L.map(el, { scrollWheelZoom: false }).setView([la, ln], 16);
    /* โหมดมืด = ใช้ tile สีเข้ม (CARTO) — กันแผนที่ขาวโพลนตอนกลางคืน */
    const darkMap = document.documentElement.getAttribute("data-theme") === "dark";
    if (darkMap) {
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, attribution: "© OpenStreetMap © CARTO" }).addTo(pickMap);
    } else {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(pickMap);
    }
    pickMarker = L.marker([la, ln], { draggable: true }).addTo(pickMap);
    pickMap.on("click", e => { pickMarker.setLatLng(e.latlng); setPickCoords(e.latlng.lat, e.latlng.lng); });
    pickMarker.on("dragend", () => { const p = pickMarker.getLatLng(); setPickCoords(p.lat, p.lng); });
  } else {
    pickMap.setView([la, ln], 16);
    pickMarker.setLatLng([la, ln]);
  }
  /* รอ modal แสดงเสร็จก่อนวัดขนาด (กันแผนที่เบี้ยว/จอว่าง) */
  setTimeout(() => { if (pickMap) pickMap.invalidateSize(); }, 350);
}
/* เขียนพิกัดจากหมุดลงช่องกรอก + อัปเดตพรีวิว */
function setPickCoords(lat, lng) {
  const fl = document.getElementById("f_lat");
  const fn = document.getElementById("f_lng");
  if (fl) { fl.value = Number(lat).toFixed(6); fl.dispatchEvent(new Event("input")); }
  if (fn) { fn.value = Number(lng).toFixed(6); fn.dispatchEvent(new Event("input")); }
}
App.useGps = function () {
  if (!navigator.geolocation) { toast("เบราว์เซอร์นี้ไม่รองรับ GPS"); return; }
  toast("กำลังระบุตำแหน่ง...");
  navigator.geolocation.getCurrentPosition(
    pos => {
      setPickCoords(pos.coords.latitude, pos.coords.longitude);
      if (pickMap) pickMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
      toast("ปักหมุดตำแหน่งปัจจุบันแล้ว");
    },
    () => toast("ไม่สามารถระบุตำแหน่งได้ (อนุญาตการเข้าถึงตำแหน่งก่อน)"),
    { timeout: 8000 }
  );
};
App.submitPlot = function (e, id) {
  e.preventDefault();
  const name = document.getElementById("f_name").value.trim();
  /* พืชที่ปลูกย้ายไปอยู่ที่รอบการปลูกแล้ว — แปลงไม่เก็บพืชอีกต่อไป (แก้ไข: คงค่าเดิมไว้ไม่ให้ข้อมูลเก่าหาย) */
  const crop = id ? (plotById(S, id).crop || "") : "";
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
/* แผนงานอัตโนมัติ: โชว์สูตรให้ตรวจ/แก้ก่อนยืนยัน (ติ๊กเลือกงาน + แก้วัน/ข้อความได้) */
App._ppKey = null;
App.pickPlaybook = function (key) {
  const inp = document.getElementById("f_plant");
  if (inp) inp.value = key;
  App._ppKey = null; /* บังคับวาดใหม่ */
  App.planPreviewRefresh();
};
App.planPreviewRefresh = function () {
  const box = document.getElementById("planPreview");
  if (!box) return;
  const plant = (document.getElementById("f_plant") || {}).value || "";
  const pb = playbookFor(plant);
  /* ถ้าสูตรเดิม (คีย์ไม่เปลี่ยน) ไม่วาดใหม่ — คงการแก้ไขของผู้ใช้ไว้ */
  if (pb && pb.key === App._ppKey && box.querySelector("[data-pp-row]")) return;
  App._ppKey = pb ? pb.key : null;
  if (!pb) {
    box.innerHTML = plant ? `ยังไม่มีสูตรสำเร็จรูปสำหรับ "<b>${esc(plant)}</b>" — จะไม่สร้างงานอัตโนมัติ (กดปุ่มพืชด้านบนเพื่อดูสูตรที่มี)` : `พิมพ์ชื่อพืชข้างบน หรือกดปุ่มพืชด้านบน เพื่อดูแผนงานทั้งฤดู (ติ๊กเลือก/แก้วัน/แก้ข้อความได้ก่อนกดเริ่มปลูก)`;
    return;
  }
  const rows = pb.steps.map((st, i) => `
    <div style="display:flex;gap:6px;align-items:center;padding:3px 0" data-pp-row="${i}">
      <input type="checkbox" class="pp-chk" checked style="width:auto" title="สร้างงานนี้">
      <input type="number" class="pp-day" value="${st.day}" min="0" style="width:64px;padding:4px 6px" title="วันที่หลังปลูก">
      <input class="pp-title grow" value="${esc((st.warn ? "⚠️ " : "") + st.title)}" style="flex:1;padding:4px 8px">
    </div>
    <div class="muted" style="font-size:.68rem;margin:-2px 0 4px 30px;line-height:1.4">${esc(st.note || "")}</div>`).join("");
  box.innerHTML = `
    <div class="muted" style="font-size:.74rem;margin-bottom:6px">📋 สูตร <b>${esc(pb.key)}</b> — ${pb.steps.length} งาน · ติ๊ก = สร้าง · แก้วันที่/ข้อความได้ · อิงคำแนะนำกรมวิชาการเกษตร (ปรับตามพื้นที่จริงได้)</div>
    ${rows}`;
};

App.modalCycle = function (plotId, cycleId) {
  const c = cycleId ? cycleById(S, cycleId) : null;
  /* เพิ่มรอบอัตโนมัติ: รอบแรก = รอบ 1, รอบที่ 2 = รอบ 2 ... (นับจากรอบทั้งหมดของแปลงนั้น) */
  const newRound = c ? c.round : nextCycleRound(S, plotId);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${c ? "แก้ไขรอบการปลูก" : "เริ่มรอบการปลูกใหม่"}</h3>
    <div class="modal-sub">${c ? "แก้ไขชื่อพืช และวันเริ่มปลูก — อายุและรอบจะคำนวณใหม่ตามวันที่ที่แก้" : `รอบการปลูกจะเพิ่มเป็น <b>รอบที่ ${newRound}</b> ของแปลงนี้ อัตโนมัติ`}</div>
    <form onsubmit="return App.submitCycle(event, '${c ? c.id : ""}')">
      <div class="field"><label>แปลง *</label><select id="f_plot" required>
        ${S.plots.map(p => `<option value="${p.id}" ${(c ? c.plotId : plotId) === p.id ? "selected" : ""}>${esc(p.name)} — ${fmtNum(p.sizeRai)} ไร่</option>`).join("")}
      </select></div>
      ${c ? "" : `<div class="field"><label>เลขรอบ (อัตโนมัติ)</label><input id="f_round" type="number" min="1" value="${newRound}"><div class="hint">เพิ่มรอบใหม่ระบบจะนับให้อัตโนมัติ (รอบ 1, รอบ 2...) — แก้ได้ถ้าต้องการ</div></div>`}
      <div class="field"><label>ชื่อพืช / รอบ *</label><input id="f_plant" value="${c ? esc(c.plant) : ""}" placeholder="เช่น ข้าวโพดหวาน / ข้าวนาปี" required onchange="App.planPreviewRefresh()"></div>
      ${c ? "" : `
      <div class="field">
        <label>สูตรแผนดูแลอัตโนมัติ — กดพืชเพื่อดูแผน ตรวจ/แก้ได้ก่อนยืนยัน</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${Object.keys(CROP_PLAYBOOKS).map(k => `<button type="button" class="btn btn-sm btn-outline" onclick="App.pickPlaybook('${k}')">${k}</button>`).join("")}
        </div>
        <div id="planPreview" class="muted" style="font-size:.76rem">พิมพ์ชื่อพืชข้างบน หรือกดปุ่มพืชด้านบน เพื่อดูแผนงานทั้งฤดู (ติ๊กเลือก/แก้วัน/แก้ข้อความได้ก่อนกดเริ่มปลูก)</div>
      </div>`}
      <div class="field"><label>วันที่เริ่ม *</label><input id="f_start" type="date" value="${c ? c.startDate : todayISO()}" required></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${c ? "บันทึกการแก้ไข" : "เริ่มปลูก"}</button>
      </div>
    </form>`);
};
App.submitCycle = function (e, cycleId) {
  e.preventDefault();
  const plotId = document.getElementById("f_plot").value;
  const plant = document.getElementById("f_plant").value.trim();
  const start = document.getElementById("f_start").value;
  if (!plant) return false;
  if (cycleId) {
    const c = cycleById(S, cycleId);
    if (c) { c.plotId = plotId; c.plant = plant; c.startDate = start; }
    saveState(S);
    closeModal();
    render();
    toast("บันทึกการแก้ไขรอบแล้ว");
  } else {
    /* เลขรอบอัตโนมัติ: ใช้ค่าจากฟอร์ม (ระบบเติมให้แล้ว) — กันเลขซ้ำ/กระโดดด้วยการนับจริง */
    const roundInput = document.getElementById("f_round");
    const round = roundInput ? (Math.max(1, Math.round(Number(roundInput.value) || 0)) || nextCycleRound(S, plotId)) : nextCycleRound(S, plotId);
    const c = { id: uid(), plotId, plant, startDate: start, status: "active", round };
    S.cycles.push(c);
    /* สร้างงานจากแผนที่ผู้ใช้ตรวจ/แก้ไว้ในฟอร์ม (ติ๊กเฉพาะขั้นที่เลือก + วัน/ข้อความที่แก้) */
    let made = 0;
    document.querySelectorAll("#planPreview [data-pp-row]").forEach(row => {
      if (!row.querySelector(".pp-chk").checked) return;
      const day = Math.max(0, Number(row.querySelector(".pp-day").value) || 0);
      const title = row.querySelector(".pp-title").value.trim();
      if (!title) return;
      S.tasks.push({
        id: uid(), title, date: addDaysISO(start, day), type: "task",
        plotId, cycleId: c.id, status: "planned",
        note: "แผนอัตโนมัติ (วันที่ " + day + " หลังปลูก)", createdAt: Date.now()
      });
      made++;
    });
    saveState(S);
    closeModal();
    render();
    toast(`เริ่มรอบปลูกแล้ว — รอบที่ ${round}` + (made ? ` · สร้างงานตามแผน ${made} งาน 📋` : ""));
  }
  return false;
};

/* ---- stock forms ---- */
/* รายชื่อบริษัท/ผู้จำหน่ายที่เคยใช้ — จากสต็อกปัจจุบัน + ฐานข้อมูลสินค้า FLYTECH
   ใช้เป็นตัวเลือกค้นหา (datalist) ในฟอร์มเพิ่ม/แก้ไข */
function stockSuppliers() {
  const set = new Set();
  (S.stock || []).forEach(x => { const v = String(x.supplier || "").trim(); if (v) set.add(v); });
  (typeof FLYTECH_MASTER !== "undefined" ? FLYTECH_MASTER : []).forEach(p => { const v = String(p.supplier || "").trim(); if (v) set.add(v); });
  return [...set].sort((a, b) => a.localeCompare(b, "th"));
}
App.modalStock = function (id) {
  const x = id ? stockById(S, id) : null;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${x ? "แก้ไขรายการวัสดุ" : "เพิ่มรายการวัสดุ"}</h3>
    <div class="modal-sub">${x ? "ปรับข้อมูลรายการวัสดุ" : "เช่น ปุ๋ย ยา เมล็ดพันธุ์ พร้อมหน่วยนับ"}</div>
    <form onsubmit="return App.submitStock(event, '${x ? x.id : ""}')">
      <div class="field"><label>ชื่อสินค้า *</label><input id="s_name" value="${x ? esc(x.name) : ""}" placeholder="เช่น ปุ๋ยเคมี สูตร 46-0-0" required></div>
      <div class="field"><label>ชื่อสามัญ (สารออกฤทธิ์ / สูตร)</label><input id="s_generic" value="${x ? esc(x.generic || "") : ""}" placeholder="เช่น ไกลโฟเซต-ไอโซโพรพิลแอมโมเนียม หรือ 46-0-0"></div>
      <div class="form-row-2">
        <div class="field"><label>รหัสสินค้าเดิม</label><input id="s_code" value="${x ? esc(x.code || "") : ""}" placeholder="เช่น 00-0000-269"></div>
        <div class="field"><label>ขนาดสินค้า</label><input id="s_size" value="${x ? esc(x.size || "") : ""}" placeholder="เช่น 50 กก. / 5 ลิตร / 1,000 ซีซี"></div>
      </div>
      <div class="field"><label>หมวดสินค้า</label>
        <select id="s_category">
          <option value="">-- ไม่มีหมวด --</option>
          ${STOCK_CATS.map(c => `<option value="${esc(c)}" ${x && x.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>หน่วยนับ *</label><input id="s_unit" list="stockUnitList" value="${x ? esc(x.unit) : ""}" placeholder="เลือกจากรายการหรือพิมพ์เอง เช่น ถุง / ขวด / ลิตร" required>
        <datalist id="stockUnitList">${STOCK_UNITS.map(u => `<option value="${esc(u)}">`).join("")}</datalist>
      </div>
      <div class="field"><label>บริษัท / ผู้จำหน่าย</label><input id="s_supplier" list="stockSupplierList" value="${x ? esc(x.supplier || "") : ""}" placeholder="พิมพ์ค้นหา เช่น ซินเจนทา / บาก้า / โกลบอล ครอปส์">
        <datalist id="stockSupplierList">${stockSuppliers().map(s => `<option value="${esc(s)}">`).join("")}</datalist>
      </div>
      <div class="field"><label>จำนวนเริ่มต้น</label><input id="s_qty" type="number" min="0" step="1" value="${x ? x.qty : 0}">
        <div class="hint">สต็อกหลักเก็บเป็นจำนวนเต็ม (ถุง/ขวดเต็ม) — ของที่ใช้ไม่หมดจะไปเป็น "ของเหลือจากการเปิดใช้" อัตโนมัติ</div></div>
      <div class="field"><label>ต้นทุนต่อหน่วย (บาท)</label><input id="s_price" type="number" min="0" step="0.5" value="${x ? x.avgCost : 0}"></div>
      <div class="field"><label>ราคาขายต่อหน่วย (บาท)</label><input id="s_saleprice" type="number" min="0" step="0.5" value="${x ? (x.salePrice || "") : ""}" placeholder="เว้นว่างไว้ได้"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${x ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}</button>
      </div>
    </form>`);
};
App.submitStock = function (e, editId) {
  e.preventDefault();
  const name = document.getElementById("s_name").value.trim();
  const unit = document.getElementById("s_unit").value.trim();
  if (!name || !unit) return false;
  const data = {
    name, unit,
    code: (document.getElementById("s_code").value || "").trim(),
    generic: (document.getElementById("s_generic").value || "").trim(),
    category: document.getElementById("s_category").value,
    size: (document.getElementById("s_size").value || "").trim(),
    supplier: (document.getElementById("s_supplier").value || "").trim(),
    qty: Number(document.getElementById("s_qty").value) || 0,
    avgCost: Number(document.getElementById("s_price").value) || 0,
    salePrice: Number(document.getElementById("s_saleprice").value) || 0
  };
  if (editId) {
    const x = stockById(S, editId);
    if (x) Object.assign(x, data);
  } else {
    S.stock.push({ id: uid(), ...data, openQty: 0 });
  }
  saveState(S);
  closeModal();
  render();
  toast(editId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มรายการวัสดุแล้ว");
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
        const cat = costCatMap(S)[it.category];
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
  /* เอาเฉพาะรายการที่มีของ (ยาหมดไม่โชว์ในตัวเลือกตัดสต็อก) */
  const list = S.stock.filter(x => {
    const avail = rndQty((Number(x.qty) || 0) + (Number(x.openQty) || 0));
    if (avail <= 0) return false;
    return !q || x.name.toLowerCase().includes(q) || (x.code || "").toLowerCase().includes(q) || x.unit.toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q);
  });
  if (!list.length) return `<div class="muted" style="font-size:.72rem;padding:6px 2px">${q ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีของในสต็อก — ไปรับของเข้าก่อน"}</div>`;
  return list.map(x => {
    const open = rndQty(x.openQty);
    const avail = rndQty((Number(x.qty) || 0) + open);
    const out = avail <= 0; // ของหมด -> แถบแดง + กดไม่ได้
    const sel = it.stockId === x.id;
    const sub = open > 0 ? `หลัก ${fmtNum(x.qty)} + เหลือเปิด ${fmtNum(open)} ${esc(x.unit)}` : `คงเหลือ ${fmtNum(x.qty)} ${esc(x.unit)}`;
    return `<button type="button" class="stock-pick-item ${sel ? "selected" : ""} ${out ? "out" : ""}" onclick="App.costSet(${i}, 'stockId', '${x.id}')" ${sel ? `title="กดอีกครั้งเพื่อเอารายการนี้ออก"` : ""}>
      <span class="sp-name">${esc(x.name)}</span>${sel ? `<span class="sp-x">✕</span>` : (out ? `<span class="sp-out">ยาหมด</span>` : `<span class="sp-sub">${sub}</span>`)}
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
  list.innerHTML = taskCostItems.map((it, i) => {
    const st = it.stockId ? stockById(S, it.stockId) : null;
    /* โหมดราคาต่อหน่วย: ต้นทุน / ราคาขาย / พิมพ์เอง — ตอนแก้ไขงาน เดาโหมดจากราคาที่บันทึกไว้ */
    let priceMode = it.priceMode;
    if (!priceMode && st) {
      const v = Number(it.unitCost) || 0;
      priceMode = v === (Number(st.avgCost) || 0) ? "cost" : ((st.salePrice && v === (Number(st.salePrice) || 0)) ? "sale" : "custom");
    }
    if (!priceMode) priceMode = "custom";
    return `
    <div class="usage-row" data-ci="${i}">
      <div class="usage-row-head">
        <strong>รายการที่ ${i + 1}</strong>
        <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.costRemove(${i})">${ic("trash")} ลบ</button>
      </div>
      <div class="form-row-2">
        <div class="field"><label>หมวดหมู่</label><select onchange="App.costSet(${i}, 'category', this.value)">
          ${allCostCats(S).map(c => `<option value="${c.key}" ${(it.category || "other") === c.key ? "selected" : ""}>${c.label}</option>`).join("")}
        </select></div>
        <div class="field"><label>ตัดจากสต็อก (ถ้ามี)</label>
          <div class="stock-picker">
            <input class="sp-search" type="text" placeholder="ค้นหาปุ๋ย/ยา/เมล็ด..." value="${esc(taskStockQueries[i] || "")}" oninput="App.costStockQuery(${i}, this.value)">
            <div class="stock-pick-list" id="stockPickList_${i}">${stockPickItemsHtml(i)}</div>
          </div>
          <div class="hint">ใช้ของที่เหลือจากการเปิดใช้ก่อน แล้วเบิกจากหลักเป็นหน่วยเต็ม (ปัดขึ้น) เศษเป็นของเหลือ</div>
        </div>
      </div>
      ${it.stockId ? calcBoxHtml(i, it) : ""}
      <div class="field"><label>ชื่อรายการ / รายละเอียด</label>
        <input class="ci-name" value="${esc(it.name || "")}" placeholder="เช่น ค่าน้ำมัน, ยาจากร้านนอกสต็อก" oninput="App.costSet(${i}, 'name', this.value)">
      </div>
      <div class="form-row-2">
        <div class="field"><label>จำนวนที่ใช้</label><input class="ci-qty" type="number" min="0" step="0.01" value="${it.qty || ""}" oninput="App.costSet(${i}, 'qty', this.value)"></div>
        <div class="field"><label>หน่วย</label><input class="ci-unit" value="${esc(it.unit || "")}" placeholder="เช่น cc, กก., ขวด" oninput="App.costSet(${i}, 'unit', this.value)"></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>ราคาต่อหน่วย</label>
          ${st ? `
          <select class="ci-pricemode" onchange="App.costPriceMode(${i}, this.value)" title="เลือกใช้ราคาไหนคำนวณต้นทุน">
            <option value="cost" ${priceMode === "cost" ? "selected" : ""}>ต้นทุน (${fmtMoney(st.avgCost)} บาท)</option>
            ${st.salePrice ? `<option value="sale" ${priceMode === "sale" ? "selected" : ""}>ราคาขาย (${fmtMoney(st.salePrice)} บาท)</option>` : ""}
            <option value="custom" ${priceMode === "custom" ? "selected" : ""}>พิมพ์เอง…</option>
          </select>` : ""}
          <input class="ci-price" type="number" min="0" step="0.01" value="${it.unitCost || ""}" ${(st && priceMode !== "custom") ? "readonly" : ""} oninput="App.costSet(${i}, 'unitCost', this.value)">
        </div>
        <div class="field"><label>รวมเป็นเงิน</label><input class="ci-total" type="number" readonly value="${it.totalCost || ""}"></div>
      </div>
      <div class="ci-warn" id="ciWarn_${i}" hidden></div>
    </div>`;
  }).join("");
  App.costSum();
  taskCostItems.forEach((it, i) => {
    checkStockWarn(i, it, document.querySelector(`[data-ci="${i}"]`));
    /* รีเฟรชผลลัพธ์คำนวณ (เช่น หลังกรอกขนาดสินค้าแล้ว rebuild) */
    if (it.stockId && ((Number(it.calcArea) || 0) > 0 || (Number(it.calcRate) || 0) > 0)) {
      App.costCalcInput(i, "unit", it.calcUnit);
    }
  });
};
/* ---- คำนวณการใช้ตามพื้นที่ (เช่น ฉีดยา 4 ไร่ × 100 ซีซี/ไร่ = 0.4 ขวด) ---- */
function calcRateUnits(st) {
  const sz = st ? parseStockSize(st.size) : null;
  const fam = sz ? sizeFamily(sz.unit) : null;
  if (fam === "volume") return [{ label: "ซีซี", value: "ซีซี" }, { label: "มล.", value: "มล" }, { label: "ลิตร", value: "ลิตร" }];
  if (fam === "mass") return [{ label: "กรัม", value: "กรัม" }, { label: "กก.", value: "กก" }];
  return [{ label: (st && st.unit) || "หน่วย", value: (st && st.unit) || "" }];
}
function defaultCalcUnit(st) {
  const fam = st ? sizeFamily(parseStockSize(st.size) && parseStockSize(st.size).unit) : null;
  if (fam === "volume") return "ซีซี";
  if (fam === "mass") return "กก";
  return st ? st.unit : "";
}
function unitLabel(u) {
  return ({ "ซีซี": "ซีซี", "มล": "มล.", "ลิตร": "ลิตร", "กรัม": "กรัม", "กก": "กก." })[u] || u;
}
/* คำนวณจำนวนที่ใช้ (หน่วยสต็อก) จากพื้นที่+อัตรา — คืน null ถ้ายังกรอกไม่ครบหรือหน่วยไม่ตรง */
function computeStockUsage(i) {
  const it = taskCostItems[i];
  if (!it || !it.stockId) return null;
  const st = stockById(S, it.stockId);
  if (!st) return null;
  const area = Number(it.calcArea) || 0;
  const rate = Number(it.calcRate) || 0;
  if (area <= 0 || rate <= 0) return null;
  const rateUnit = it.calcUnit || defaultCalcUnit(st);
  const rateLabel = unitLabel(rateUnit);
  const sz = parseStockSize(st.size);
  if (sz) {
    const fam = sizeFamily(sz.unit);
    if (!fam || fam !== sizeFamily(rateUnit)) return null; // ขนาดเป็น กก. แต่เลือก ซีซี -> คำนวณไม่ได้
    const totalBase = area * rate * unitToBase(rateUnit);
    const totalInSizeUnit = totalBase / unitToBase(sz.unit);
    const qty = totalInSizeUnit / sz.amount;
    return {
      qty, unit: st.unit,
      totalTxt: `${fmtNum(area)} ไร่ × ${fmtNum(rate)} ${rateLabel}/ไร่ = ${fmtNum(totalInSizeUnit)} ${sz.unit}`,
      summary: `${st.name}: ${fmtNum(area)} ไร่ × ${fmtNum(rate)} ${rateLabel}/ไร่ = ${fmtNum(qty)} ${st.unit}`
    };
  }
  // ไม่มีขนาดสินค้า -> อัตราเป็นหน่วยสต็อกตรงๆ (เช่น 0.25 ขวด/ไร่)
  const qty = area * rate;
  return {
    qty, unit: st.unit,
    totalTxt: `${fmtNum(area)} ไร่ × ${fmtNum(rate)} ${rateLabel}/ไร่`,
    summary: `${st.name}: ${fmtNum(area)} ไร่ × ${fmtNum(rate)} ${rateLabel}/ไร่ = ${fmtNum(qty)} ${st.unit}`
  };
}
/* กล่องคำนวณ (แสดงเมื่อเลือกรายการสต็อกแล้ว) */
function calcBoxHtml(i, it) {
  const st = stockById(S, it.stockId);
  if (!st) return "";
  const sz = parseStockSize(st.size);
  const known = !!sz && !!sizeFamily(sz.unit); // รู้ขนาดแล้ว (เช่น 1,000 ซีซี/ขวด)
  const units = calcRateUnits(st);
  const cur = it.calcUnit || defaultCalcUnit(st);
  return `
    <div class="calc-box" id="calcBox_${i}">
      <div class="calc-title">${ic("calculator")} คำนวณการใช้ตามพื้นที่</div>
      ${known
        ? `<div class="hint" style="margin-bottom:6px">ขนาด ${esc(st.size)} / 1 ${esc(st.unit)} — แก้ได้ที่หน้า สต็อก</div>`
        : `
      <div class="row" style="gap:6px;margin-bottom:8px">
        <div class="grow field" style="margin:0"><label>ขนาดต่อ 1 ${esc(st.unit)}</label><input class="ci-szamt" type="number" min="0" step="0.1" value="${it.calcSizeAmt || ""}" placeholder="เช่น 1,000" oninput="App.costCalcSize(${i}, this.value)"></div>
        <div class="field" style="margin:0"><label>หน่วย</label><select class="ci-szunit" onchange="App.costCalcSize(${i}, null, this.value)">
          ${[["ซีซี", "ซีซี"], ["มล.", "มล"], ["ลิตร", "ลิตร"], ["กรัม", "กรัม"], ["กก.", "กก"]].map(u => `<option value="${u[1]}" ${(it.calcSizeUnit || "ซีซี") === u[1] ? "selected" : ""}>${u[0]}</option>`).join("")}
        </select></div>
      </div>`}
      <div class="form-row-2">
        <div class="field"><label>พื้นที่ (ไร่)</label><input class="ci-area" type="number" min="0" step="0.25" value="${it.calcArea || ""}" placeholder="เช่น 4" oninput="App.costCalcInput(${i}, 'area', this.value)"></div>
        <div class="field"><label>ใช้ต่อไร่</label>
          <div class="row" style="gap:6px">
            <input class="ci-rate" type="number" min="0" step="0.1" value="${it.calcRate || ""}" placeholder="เช่น 100" style="flex:1" oninput="App.costCalcInput(${i}, 'rate', this.value)">
            <select class="ci-ratunit" style="width:auto;flex-shrink:0" onchange="App.costCalcInput(${i}, 'unit', this.value)">
              ${units.map(u => `<option value="${esc(u.value)}" ${cur === u.value ? "selected" : ""}>${esc(u.label)}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="calc-result" id="calcResult_${i}"><div class="hint">กรอกพื้นที่และอัตราใช้เพื่อคำนวณจำนวนที่ใช้ — จำนวนจะถูกกรอกและตัดสต็อกอัตโนมัติ</div></div>
    </div>`;
}
App.costCalcInput = function (i, field, value) {
  const it = taskCostItems[i];
  if (!it) return;
  if (field === "area") it.calcArea = value;
  else if (field === "rate") it.calcRate = value;
  else it.calcUnit = value;
  const r = computeStockUsage(i);
  const res = document.getElementById("calcResult_" + i);
  if (res) {
    res.innerHTML = r && r.qty > 0
      ? `<b>${esc(r.totalTxt)} = <span class="calc-amt">${fmtNum(r.qty)} ${esc(r.unit)}</span></b><div class="hint">${esc(r.summary)}</div>`
      : `<div class="hint">กรอกพื้นที่และอัตราใช้เพื่อคำนวณจำนวนที่ใช้ — จำนวนจะถูกกรอกและตัดสต็อกอัตโนมัติ</div>`;
  }
  if (r && r.qty > 0) {
    it.qty = r.qty;
    it.unit = r.unit;
    App.costSet(i, "qty", r.qty);
  }
};
/* กรอกขนาดสินค้าที่กล่องคำนวณ (กรณีสินค้ายังไม่ตั้งขนาด) — บันทึกให้สต็อกอัตโนมัติ */
App.costCalcSize = function (i, amt, unit) {
  const it = taskCostItems[i];
  if (!it || !it.stockId) return;
  const st = stockById(S, it.stockId);
  if (!st) return;
  if (amt !== null && amt !== undefined) it.calcSizeAmt = amt;
  if (unit) it.calcSizeUnit = unit;
  const val = Number(it.calcSizeAmt) || 0;
  const sizeUnit = it.calcSizeUnit || "ซีซี"; // ค่าเริ่มต้น ซีซี
  if (val > 0) {
    st.size = fmtNum(val) + " " + unitLabel(sizeUnit);
    saveState(S);
    it.calcSizeAmt = ""; it.calcSizeUnit = "";
    App.costRender();
    toast(`บันทึกขนาด "${st.size}" ให้ ${st.name} แล้ว — ครั้งหน้าคำนวณได้เลย`);
  } else {
    App.costCalcInput(i, "unit", it.calcUnit); // อัปเดตข้อความผลลัพธ์
  }
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
  /* บล็อกการเลือกของที่หมดสต็อก (qty + openQty = 0) ก่อนตั้งค่า */
  if (field === "stockId" && value) {
    const chk = stockById(S, value);
    if (chk && (Number(chk.qty) || 0) + (Number(chk.openQty) || 0) <= 0) {
      toast(`"${chk.name}" หมดแล้ว — ไม่มีเหลือในสต็อก (ถ้าซื้อนอกสต็อกใช้ช่อง "ชื่อรายการ" แทนได้)`);
      return;
    }
  }
  /* กดรายการที่เลือกอยู่ซ้ำ -> ยกเลิกการเลือก (เอารายการนี้ออก ไม่ต้องลบทั้งแถว) */
  if (field === "stockId" && value === it.stockId) value = "";
  it[field] = value;
  /* เลือก/ยกเลิกรายการสต็อก -> ตั้งค่าเริ่มต้น + rebuild แถว (แสดง/ซ่อนกล่องคำนวณ ปัก highlight) */
  if (field === "stockId") {
    if (value) {
      const item = stockById(S, value);
      if (item) {
        it.priceMode = "cost"; // เริ่มที่ต้นทุน — เปลี่ยนเป็นราคาขาย/พิมพ์เองได้
        it.unitCost = item.avgCost.toFixed(2);
        if (!it.unit) it.unit = item.unit;
        if (!it.name) it.name = item.name;
        it.calcUnit = defaultCalcUnit(item);
      }
      it.calcArea = ""; it.calcRate = ""; // เริ่มคำนวณใหม่เมื่อเปลี่ยนรายการ
    } else {
      delete it.priceMode;
      it.stockId = "";
      it.unitCost = ""; it.calcUnit = ""; it.calcArea = ""; it.calcRate = "";
    }
    it.totalCost = Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0));
    App.costRender();
    return;
  }
  const row = document.querySelector(`[data-ci="${i}"]`);
  it.totalCost = Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0));
  if (row) row.querySelector(".ci-total").value = it.totalCost || "";
  App.costSum();
  checkStockWarn(i, it, row);
};
/* เลือกใช้ราคาต่อหน่วยของวัสดุจากสต็อก: ต้นทุน / ราคาขาย / พิมพ์เอง */
App.costPriceMode = function (i, mode) {
  const it = taskCostItems[i];
  if (!it || !it.stockId) return;
  const st = stockById(S, it.stockId);
  if (!st) return;
  it.priceMode = mode;
  const input = document.querySelector(`[data-ci="${i}"] .ci-price`);
  if (mode === "cost") it.unitCost = (Number(st.avgCost) || 0).toFixed(2);
  else if (mode === "sale") it.unitCost = (Number(st.salePrice) || 0).toFixed(2);
  if (input) {
    input.value = it.unitCost;
    input.readOnly = mode !== "custom";
    if (mode === "custom") input.focus();
  }
  const row = document.querySelector(`[data-ci="${i}"]`);
  it.totalCost = Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0));
  if (row) row.querySelector(".ci-total").value = it.totalCost || "";
  App.costSum();
  checkStockWarn(i, it, row);
};
/* เตือนเมื่อกรอกจำนวนเกินของในสต็อก (หรือเลือกของที่หมดแล้ว) */
function checkStockWarn(i, it, row) {
  const warn = document.getElementById("ciWarn_" + i);
  if (!warn) return;
  let msg = "";
  if (it.stockId) {
    const st = stockById(S, it.stockId);
    if (st) {
      /* ปัดกันเลขทศนิยมลอย — 40.02 พอดีกับของเหลือต้องไม่เตือนเกิน */
      const avail = rndQty((Number(st.qty) || 0) + (Number(st.openQty) || 0));
      const need = Number(it.qty) || 0;
      if (avail <= 0) msg = `"${st.name}" หมดแล้ว — ไม่มี ${st.unit} เหลือในสต็อก`;
      else if (need - avail > 1e-9) msg = `จำนวนเกินของในสต็อก — เหลือแค่ ${fmtNum(avail)} ${st.unit}`;
    }
  }
  warn.textContent = msg;
  warn.hidden = !msg;
}
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
      <div class="form-row-2">
        <div class="field"><label>แปลง</label><select id="t_plot" onchange="App.taskPlotChange()"></select></div>
        <div class="field"><label>พืช / รอบ</label><select id="t_cycle" disabled></select></div>
      </div>
      <div class="hint" style="margin-top:-6px">เลือกแปลงก่อน แล้วเลือกรอบที่กำลังดำเนินการ — รายรับ/ต้นทุนจะเข้ารอบและแปลงนั้นทันที</div>
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
  /* เติม dropdown แปลง + พืช/รอบ (เลือกแปลงก่อน แล้วเลือกพืชของแปลงนั้น)
     รองรับทางลัด: ปุ่มเพิ่มกิจกรรมของแปลง/รอบ จะเลือกแปลงและรอบให้อัตโนมัติ */
  const initTaskPlotCycle = () => {
    const plotSel = document.getElementById("t_plot");
    const cycSel = document.getElementById("t_cycle");
    if (!plotSel || !cycSel) return;
    let selCycleId = editing ? editing.cycleId : (preset.cycleId || "");
    let selPlotId = "";
    if (selCycleId) {
      const cc = cycleById(S, selCycleId);
      if (cc) selPlotId = cc.plotId;
    }
    /* งานที่แก้ไข: ถ้ารอบไม่มี/ถูกลบ (เช่น งานที่ผูก "ยังไม่ปลูกอะไร") ให้ใช้แปลงเดิมของงาน — กันต้องเลือกแปลงใหม่ */
    if (!selPlotId && editing && editing.plotId) {
      selPlotId = editing.plotId;
    }
    if (!selPlotId && preset.plotId) {
      selPlotId = preset.plotId;
      const first = S.cycles.find(c => c.plotId === preset.plotId && c.status === "active");
      if (first) selCycleId = first.id; // ทางลัดจากปุ่มของแปลง -> เลือกรอบที่กำลังดำเนินการให้อัตโนมัติ
      else selCycleId = "__none__"; // แปลงนี้ยังไม่มีการปลูกรอบไหน -> เลือก "ยังไม่ปลูกอะไร" ให้อัตโนมัติ
    }
    const plots = S.plots.slice();
    if (selPlotId && !plots.some(p => p.id === selPlotId)) {
      const cc = cycleById(S, selCycleId);
      plots.unshift({ id: cc ? cc.plotId : selPlotId, name: "(แปลงถูกลบ)" });
    }
    plotSel.innerHTML = '<option value="">-- เลือกแปลง --</option>' +
      plots.map(p => `<option value="${p.id}" ${p.id === selPlotId ? "selected" : ""}>${esc(p.name)}</option>`).join("");
    /* รอบของแปลงที่เลือก: รอบที่กำลังดำเนินการ + รอบเดิมของงานที่กำลังแก้ไข (กันรอบปิดแล้วหาย)
       + ตัวเลือก "ยังไม่ปลูกอะไร" สำหรับแปลงที่ยังไม่ได้ปลูก — ต้นทุนจะเข้ารวมที่แปลง */
    const cycles = S.cycles.filter(c => c.plotId === selPlotId && (c.status === "active" || c.id === selCycleId));
    cycSel.innerHTML = '<option value="">-- เลือกพืช / รอบ --</option>' +
      cycles.map(c => `<option value="${c.id}" ${c.id === selCycleId ? "selected" : ""}>${esc(c.plant)}</option>`).join("") +
      `<option value="__none__" ${selCycleId === "__none__" ? "selected" : ""}>ยังไม่ปลูกอะไร (ต้นทุนเข้ารวมแปลงนี้)</option>`;
    cycSel.disabled = !selPlotId;
  };
  initTaskPlotCycle();
};
/* เมื่อเปลี่ยนแปลง -> โหลดเฉพาะพืช/รอบของแปลงนั้น (ทีละ 1: แปลงก่อน แล้วค่อยเลือกรอบ) */
App.taskPlotChange = function () {
  const plotSel = document.getElementById("t_plot");
  const cycSel = document.getElementById("t_cycle");
  if (!plotSel || !cycSel) return;
  const pid = plotSel.value;
  if (!pid) {
    cycSel.innerHTML = '<option value="">-- เลือกแปลงก่อน --</option>';
    cycSel.disabled = true;
    return;
  }
  const cycles = S.cycles.filter(c => c.plotId === pid && c.status === "active");
  cycSel.innerHTML = '<option value="">-- เลือกพืช / รอบ --</option>' +
    cycles.map(c => `<option value="${c.id}">${esc(c.plant)}</option>`).join("") +
    '<option value="__none__">ยังไม่ปลูกอะไร (ต้นทุนเข้ารวมแปลงนี้)</option>';
  cycSel.disabled = false;
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
  /* ตรวจจำนวนกับสต็อกก่อนบันทึก — กันกรอกเกินของที่มี (เช่น ยาหมดแล้วใส่จำนวนอีก) */
  for (const it of costItems) {
    if (!it.stockId || !it.qty) continue;
    const st = stockById(S, it.stockId);
    if (!st) continue;
    /* ปัดเป็น 4 ตำแหน่งกันเลขทศนิยมลอย — กรอก 40.02 พอดีกับของเหลือ จะได้ไม่โดนบล็อก */
    const avail = rndQty((Number(st.qty) || 0) + (Number(st.openQty) || 0));
    if (Number(it.qty) - avail > 1e-9) {
      toast(`"${st.name}" มีในสต็อกแค่ ${fmtNum(avail)} ${st.unit} — กรอกจำนวนใหม่`);
      return false;
    }
  }
  const totalCost = costItems.reduce((a, it) => a + it.totalCost, 0);
  const tPlot = document.getElementById("t_plot").value || null;
  const tCycleRaw = document.getElementById("t_cycle").value || "";
  /* "ยังไม่ปลูกอะไร" = ไม่ผูกกับรอบ แต่ยังเข้ารวมต้นทุนของแปลงที่เลือก */
  const tCycle = tCycleRaw === "__none__" ? null : (tCycleRaw || null);
  const tRevenue = useHarvest ? Math.round(hqty * hprice) || 0 : 0;
  /* กันข้อมูลหาย: ถ้ามีต้นทุนหรือรายได้แต่ยังไม่เลือกแปลง -> บล็อกไม่ให้บันทึก
     (งานที่ไม่มีแปลง ต้นทุน/รายได้จะไม่เข้ารอบหรือแปลงไหนเลย) */
  if ((totalCost > 0 || tRevenue > 0) && !tPlot) {
    toast("ต้องเลือกแปลงก่อน — ต้นทุน/รายได้จะไม่เข้ารอบไหน");
    return false;
  }
  const data = {
    title,
    type: document.getElementById("t_type").value,
    date: document.getElementById("t_date").value,
    status: document.getElementById("t_status").value,
    cycleId: tCycle,
    plotId: tPlot,
    costItems: useCost ? costItems : [],
    costCat: useCost && costItems.length ? costItems[0].category : null,
    stockId: useCost && costItems.length ? (costItems.find(it => it.stockId) || costItems[0]).stockId : null,
    qty: useCost && costItems.length ? (costItems.find(it => it.stockId) || costItems[0]).qty : 0,
    unit: useCost && costItems.length ? (costItems.find(it => it.stockId) || costItems[0]).unit : "",
    cost: useCost ? totalCost : 0,
    revenue: tRevenue,
    harvestQty: useHarvest ? hqty : 0,
    harvestUnitPrice: useHarvest ? hprice : 0,
    finishCycle: useHarvest && document.getElementById("t_finishcycle").checked,
    note: document.getElementById("t_note").value.trim()
  };
  /* เขียนสรุปการคำนวณ (เช่น ฉีดยา 4 ไร่ × 100 ซีซี/ไร่ = 0.4 ขวด) ลงในบันทึกอัตโนมัติ */
  const calcLines = [];
  taskCostItems.forEach((it, idx) => {
    if (it.stockId && (Number(it.calcArea) || 0) > 0 && (Number(it.calcRate) || 0) > 0) {
      const r = computeStockUsage(idx);
      if (r && r.summary && !calcLines.includes(r.summary)) calcLines.push(r.summary);
    }
  });
  if (calcLines.length) {
    const cur = data.note ? data.note.split("\n") : [];
    calcLines.forEach(l => { if (!cur.includes(l)) cur.push(l); });
    data.note = cur.join("\n");
  }
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
            delete S.notifDismissed[existing.id]; // แก้ไขงาน → แจ้งเตือนใหม่
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
            delete S.notifDismissed[existing.id]; // แก้ไขงาน → แจ้งเตือนใหม่
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
    delete S.notifDismissed[existing.id]; // แก้ไขงาน → แจ้งเตือนใหม่
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
    else if (act === "sale") App.modalSale();
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
  /* กดปุ่มใน bubble ต้องไม่ทะลุไป trigger การกดผ่าน overlay */
  bubble.addEventListener("click", e => e.stopPropagation());
  function step(i) {
    const st = TOUR_STEPS[i];
    const el = document.querySelector(st.sel);
    if (!el) { App.tourGo(i + 1); return; }
    /* เลื่อน element ให้อยู่ในจอถ้าจำเป็น (element ที่ fixed เช่น bottomNav/FAB จะไม่เลื่อน) */
    if (st.scroll !== false && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", behavior: "auto" });
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
    // place bubble — ให้อยู่ในจอเสมอ: ถ้าข้างล่างไม่พอให้พลิกไปข้างบน (เช่น #bottomNav อยู่ขอบล่าง)
    const vw = window.innerWidth, vh = window.innerHeight;
    const bh = bubble.offsetHeight, bw = bubble.offsetWidth;
    let left = Math.max(8, Math.min(r.left, vw - bw - 8));
    let top;
    const fitsBelow = r.bottom + bh + 16 <= vh;
    const fitsAbove = r.top - bh - 12 >= 8;
    if (st.pos === "above") top = fitsAbove ? r.top - bh - 12 : r.bottom + 12;
    else if (st.pos === "below") top = fitsBelow ? r.bottom + 12 : r.top - bh - 12;
    else top = r.top + Math.max(0, (r.height - bh) / 2); // left/right → จัดกลางแนวตั้ง
    top = Math.max(8, Math.min(top, vh - bh - 8));
    bubble.style.left = left + "px";
    bubble.style.top = top + "px";
    // กดที่ไหนก็ไปขั้นถัดไป (ขั้นสุดท้าย = จบทัวร์) — กัน bubble ติดค้าง
    ov.onclick = () => App.tourGo(idx + 1);
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
    const yr = String(route.year || Number(todayISO().slice(0, 4)));
    /* แท็บร้านค้า: กราฟยอดขายรายเดือน (chartYear/chartCrop/chartCost ไม่มีใน DOM) */
    if (route.tab === "shop") {
      const el = document.getElementById("chartSale");
      if (el) Charts.bars(el, salesMonthlySeries(S, yr), { color: "#2563eb" });
      return;
    }
    const months = monthlySeries(S, yr);
    Charts.bars(document.getElementById("chartYear"), months);
    /* กำไรรายแปลง: เขียว = กำไร แดง = ขาดทุน (ตามเครื่องหมายค่า) */
    const plotRows = plotYearProfits(S, yr);
    if (plotRows.length) {
      Charts.bars(document.getElementById("chartPlot"), plotRows.map(p => ({
        label: p.name,
        value: p.net
      })));
    }
    const cropBars = cropMargins(S, yr).map(c => ({
      label: c.crop.split(" ")[0],
      value: c.margin,
      color: "#16a34a"
    }));
    Charts.bars(document.getElementById("chartCrop"), cropBars);
    const costs = costBreakdown(S, yr);
    const totalCost = costs.reduce((a, c) => a + c.value, 0);
    Charts.donut(document.getElementById("chartCost"), costs, {
      centerLabel: fmtMoney(totalCost), centerSub: "ต้นทุนรวม (บาท)"
    });
    /* การใช้ยารายแปลง: แท่งสีเหลือง (หมวดสารเคมี) */
    const chemRows = plotChemUse(S, yr);
    if (chemRows.length) {
      Charts.bars(document.getElementById("chartChem"), chemRows.map(c => ({
        label: c.name,
        value: c.cost,
        color: "#f59e0b"
      })));
    }
  }
}

/* ---------------- init ---------------- */
/* ปุ่มแนะนำระบบ (ทัวร์) — เดิมลืมผูก event ทำให้กดไม่ได้ */
const tourBtn = document.getElementById("tourBtn");
if (tourBtn) tourBtn.addEventListener("click", () => App.startTour());
const editBtn = document.getElementById("editBtn");
if (editBtn) editBtn.addEventListener("click", () => App.openEditor());
/* ปุ่มกระดิ่งแจ้งเตือน */
const notifBtn = document.getElementById("notifBtn");
if (notifBtn) notifBtn.addEventListener("click", () => App.toggleNotif());
/* คืนค่าหน้าล่าสุดหลังรีเฟรช (จาก sessionStorage) — ถ้าไม่มี หรือหน้าไม่ถูกต้องกับโหมด ระบบจะคืนค่าให้เอง */
try {
  const saved = JSON.parse(sessionStorage.getItem(ROUTE_STORE) || "null");
  if (saved && saved.view) {
    route.view = saved.view;
    if (saved.tab) route.tab = saved.tab;
    if (saved.plotId) route.plotId = saved.plotId;
    if (saved.cycleId) route.cycleId = saved.cycleId;
    if (saved.year) route.year = saved.year;
  }
} catch (e) {}
render();
