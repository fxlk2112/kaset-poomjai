/* ============================================================
   FARMULTIMATE SOLUTIONS v54 — app logic
   dashboard, plots, stock, equipment, cycles,
   activity planner, IoT, analytics, FAB drawer, interactive tour
   ============================================================ */
"use strict";

/* ---------------- state & bootstrap ----------------
   (S ประกาศใน data.js — ให้ระบบบัญชี (auth.js) สลับ slot ข้อมูลรายบัญชีได้ก่อน render) */
const APP_BUILD_VERSION = "20260905release40721b5";
window.APP_BUILD_VERSION = APP_BUILD_VERSION;
function ensureFreshAppBuild() {
  try {
    const key = "farmult-app-build-v1";
    if (localStorage.getItem(key) === APP_BUILD_VERSION) return;
    localStorage.setItem(key, APP_BUILD_VERSION);
    const jobs = [];
    if (window.caches) jobs.push(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
    if (typeof navigator !== "undefined" && navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))));
    Promise.allSettled(jobs).then(() => {
      try {
        const u = new URL(location.href);
        if (u.searchParams.get("build") !== APP_BUILD_VERSION) {
          u.searchParams.set("build", APP_BUILD_VERSION);
          location.replace(u.toString());
        }
      } catch (e) {}
    });
  } catch (e) {}
}
ensureFreshAppBuild();
let route = { view: "home", tab: "plots", year: Number(todayISO().slice(0, 4)) };
/* จำหน้าล่าสุดไว้ (sessionStorage — รีเฟรชแล้วอยู่หน้าเดิม ไม่กลับหน้าแรก, เปิดแท็บใหม่เริ่มหน้าแรกปกติ) */
const ROUTE_STORE = "kaset-route-v1";
function saveRoute() {
  try {
    const o = { view: route.view, tab: route.tab, year: route.year };
    if (route.plotId) o.plotId = route.plotId;
    if (route.cycleId) o.cycleId = route.cycleId;
    if (route.trialId) o.trialId = route.trialId;
    if (route.trialMetricId) o.trialMetricId = route.trialMetricId;
    if (route.trialTreatmentId) o.trialTreatmentId = route.trialTreatmentId;
    sessionStorage.setItem(ROUTE_STORE, JSON.stringify(o));
  } catch (e) {}
}
let plotTaskCycle = "";   // กรองงาน/กิจกรรมของแปลงตามรอบการปลูก ("" = ทั้งหมด, "__none__" = ไม่มีรอบ)
let cycTaskFilter = { sort: "new", type: "", status: "", costOnly: false }; // ตัวกรอง/เรียง "งาน/กิจกรรมของรอบนี้" ในหน้ารายละเอียดรอบ
let plotDetailTab = "overview"; // แยกหน้ารายละเอียดแปลงให้ไม่ยาวเกินบนมือถือ
let cycleDetailTab = "overview"; // แยกหน้ารายละเอียดรอบปลูกให้อ่านง่ายขึ้น
let plotFilter = { q: "", status: "all" }; // ตัวกรองหน้าแปลง: q=ค้นหา, status=all|growing|idle|inactive
let plannerFilter = "today"; // มุมมองกิจกรรม: today|week|overdue|failed|done
let collapsedCycles = {}; // หน้ารอบการปลูก: แปลงที่กดย่อไว้ (plotId -> true) กันหน้ายาวเกิน
let cycleFilter = { q: "", status: "all" }; // ตัวกรองหน้ารอบการปลูก: q=ค้นหา (ชื่อแปลง/พืช), status=all|active|idle
let trialObsPhotos = [];
let trialPhotoUploading = false;
let trialWizardIndex = 0;
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
  { key: "titleCal", label: "หัวข้อ: งานวันนี้", def: "งานวันนี้" },
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
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
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
  if (status === "failed") return `<span class="badge badge-red">ไม่สำเร็จ</span>`;
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
  const dotCls = st === "done" ? "dot-green" : st === "failed" ? "dot-gray" : st === "overdue" ? "dot-red" : "dot-amber";
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
  const photoCount = taskAllPhotos(t).length;
  if (photoCount) meta.push(`<span class="task-photo-pill">${ic("camera")} รูป ${fmtNum(photoCount)}</span>`);
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
    <div class="task-row ${done ? "done" : ""} ${st === "failed" ? "failed" : ""}" onclick="App.viewTask('${t.id}')" role="button" tabindex="0">
      <button class="task-dot ${dotCls}" onclick="event.stopPropagation();App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ" title="${st === "done" ? "ยกเลิกเสร็จ" : (st === "failed" ? "บันทึกใหม่เป็นเสร็จ" : "ติ๊กเสร็จ")}"></button>
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
    /* จุดบอกสถานะ: เสร็จ=เขียว แผน=เหลือง เลยกำหนด=แดง ไม่สำเร็จ=เทา */
    const dotCls = ds === "done" ? "dot-green" : ds === "failed" ? "dot-gray" : ds === "overdue" ? "dot-red" : ds ? "dot-amber" : "";
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
  return NAV_ALL;
}

/* ใช้กัน animation กระพริบซ้ำ — animation จะเล่นเฉพาะตอนเปลี่ยนหน้า
   (กด nav) แต่จะถูกปิดตอน re-render ในหน้าเดิม เช่น กดวันที่/เปลี่ยนเดือน */
let lastView = null;
function render() {
  /* โหมดแชร์: เปิดลิงก์ ?share=... — แสดงแปลงแบบดูอย่างเดียว (ไม่ต้องล็อกอิน) */
  if (typeof Auth !== "undefined" && Auth.shareMode) { App.renderShareView(); return; }
  /* Direct-open: หน้าแดชบอร์ดและข้อมูล local แสดงได้โดยไม่ต้องมีเซสชันคลาวด์ */
  const fd = document.getElementById("fabDock");
  // keep route valid for the current nav (sub-views group under their parent nav item)
  const keys = visibleNav().map(n => n.key);
  const VIEW_GROUP = {
    equipment: "more",
    iot: "more",
    settings: "more",
    prices: "more",
    weather: route.weatherFrom === "more" ? "more" : "plots",
    plotDetail: "plots",
    cycleDetail: "plots"
  };
  const navKey = VIEW_GROUP[route.view] || route.view;
  if (fd) {
    const inTrialDetail = route.view === "plots" && route.tab === "trials" && !!route.trialId;
    fd.style.display = navKey === "more" || inTrialDetail ? "none" : "";
    fd.classList.remove("open");
  }
  if (!keys.includes(navKey)) {
    route.view = keys.includes("home") ? "home" : keys[0];
  }
  document.body.classList.toggle("view-iot-digital-twin", route.view === "iot");
  document.body.classList.toggle(
    "view-iot-farm-map",
    route.view === "iot" && typeof FarmMapDashboard !== "undefined" && FarmMapDashboard.isMapSurface()
  );

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
  else clearRainRadar();
  /* หน้าระบบน้ำ Phase 1: อ่าน telemetry จริงเท่านั้น; ไม่มีคำสั่งเอาต์พุต */
  if (route.view === "iot") {
    if (typeof SensorTelemetry !== "undefined") {
      SensorTelemetry.mountChart();
      SensorTelemetry.refresh(false);
    }
    if (!SENSOR_PHASE1_READ_ONLY && typeof App.waterPullStatus === "function") App.waterPullStatus();
  }
  /* หน้าราคาตลาด: ฝังวิดเจ็ตราคารายวัน */
  if (route.view === "prices" && typeof App.mountRakaWidget === "function") App.mountRakaWidget();
  if (route.view === "settings") wireSettingsAccordion();
  /* หน้าราคาตลาด: reset _priceLoading เมื่อเปลี่ยนออกจากหน้า prices เพื่อให้โหลดใหม่ได้ครั้งถัดไป */
  if (viewChanged && route.view !== "prices") App._priceLoading = false;
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
  if (key === "iot" && typeof FarmMapDashboard !== "undefined") FarmMapDashboard.reset();
  route.view = key;
  if (key !== "weather") route.weatherFrom = "";
  render();
  /* ปิดแผงแจ้งเตือนเมื่อเปลี่ยนหน้า */
  const np = document.getElementById("notifPanel");
  if (np) np.hidden = true;
};
App.backToMore = function () {
  route.view = "more";
  route.weatherFrom = "";
  render();
};
function moreBackHeader(title, sub, actionHtml, tkey) {
  return `
    <div class="subpage-head">
      <button class="subpage-back" onclick="App.backToMore()" aria-label="กลับไปเมนูเพิ่มเติม">${ic("chevron")} <span>กลับ</span></button>
      <div class="subpage-title">
        <b ${tkey ? `data-tkey="${esc(tkey)}"` : ""}>${esc(title)}</b>
        ${sub ? `<span>${esc(sub)}</span>` : ""}
      </div>
      ${actionHtml ? `<div class="subpage-action">${actionHtml}</div>` : ""}
    </div>`;
}
App.farmMapSelect = function (id) {
  if (typeof FarmMapDashboard === "undefined") return;
  FarmMapDashboard.select(id);
  render();
};
App.farmMapBack = function () {
  if (typeof FarmMapDashboard === "undefined") return;
  FarmMapDashboard.reset();
  render();
};
App.farmMapKey = function (event, id) {
  if (!event || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  App.farmMapSelect(id);
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
function wireSettingsAccordion() {
  const groups = Array.from(document.querySelectorAll("details.settings-group"));
  groups.forEach(g => {
    if (g.dataset.wired) return;
    g.dataset.wired = "1";
    g.addEventListener("toggle", () => {
      if (!g.open) return;
      groups.forEach(other => { if (other !== g) other.open = false; });
    });
  });
}

/* ---------------- Dashboard ---------------- */
/* ลำดับ section หน้าแรก — งานวันนี้ล็อกไว้ด้านบน ส่วนที่เหลือผู้ดูแลเลื่อนได้ที่หน้าตั้งค่า */
function homeOrder() {
  const o = S.homeOrder && S.homeOrder.length === 4 ? S.homeOrder : ["cal", "tasks", "profit", "activity"];
  return o.filter(k => ["cal", "tasks", "profit", "activity"].includes(k));
}
/* สร้าง grid-template-areas สำหรับจอคอมตามลำดับที่ผู้ใช้เลือก
   slot 0 = คอลัมน์ซ้ายยาว 2 แถว, 1 = ขวาบน, 2 = ขวาล่าง, 3 = เต็มความกว้างล่าง
   ใช้ single quote ('...') เพื่อไม่ให้ชนกับเครื่องหมาย " ใน attribute style= */
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
  /* กิจกรรมล่าสุด: โชว์ประวัติงานที่ปิดงานแล้ว/ไม่สำเร็จ เพื่อไม่ซ้ำกับงานถัดไป */
  const tsOf = t => t.updatedAt || t.createdAt || new Date(t.date + "T12:00:00").getTime() || 0;
  const recent = [...S.tasks]
    .filter(t => t.status === "done" || t.status === "failed")
    .sort((a, b) => tsOf(b) - tsOf(a))
    .slice(0, 4);
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
    return `
    <button class="home-shop-strip" onclick="App.goShopAnalytics()">
      <span class="home-shop-ico">${ic("dollar")}</span>
      <span class="grow">
        <b>รายได้ขายสินค้า</b>
        <small>${(S.sales || []).length === 0 ? "ยังไม่มีใบเสร็จ" : `วันนี้ ${fmtMoney(day)} · เดือนนี้ ${fmtMoney(mo)} บาท`}</small>
      </span>
      <span class="home-shop-total">${fmtMoney(yr)}<small>${cnt} ใบ</small></span>
    </button>`;
  })();

  /* ปุ่มลัดงานหลักบนหน้าแรก */
  const quickActs = [
    { action: "task", ico: "plus", label: "เพิ่มกิจกรรม" },
    { action: "stock", ico: "box", label: "เพิ่มสินค้า" },
    { action: "sale", ico: "dollar", label: "ขายสินค้า" },
  ].map(a => `<button class="chip quick-chip" onclick="App.quickAction('${a.action}')">${ic(a.ico)} ${a.label}</button>`).join("");

  const extra = "";

  const setupSteps = [
    { done: (S.plots || []).length > 0, label: "เพิ่มแปลง", action: "App.nav('plots')" },
    { done: (S.stock || []).length > 0, label: "เพิ่มสินค้า", action: "App.nav('stock')" },
    { done: (S.tasks || []).length > 0, label: "บันทึกกิจกรรม", action: `App.modalTask('${today}')` },
  ];
  const welcome = setupSteps.some(x => !x.done) ? `
    <div class="welcome-strip setup-strip">
      <div class="setup-head">
        <span class="plot-emoji sm">${ic("compass")}</span>
        <div class="grow">
          <div class="bold">เริ่มต้นใช้งาน</div>
          <div class="muted">ทำตามลำดับนี้ก็เริ่มบันทึกงานได้เลย</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.startTour()">${ic("compass")} แนะนำ</button>
      </div>
      <div class="setup-steps">
        ${setupSteps.map((step, i) => `
          <button class="setup-step ${step.done ? "done" : ""}" onclick="${step.action}">
            <span>${step.done ? ic("check") : i + 1}</span>
            <b>${step.label}</b>
          </button>`).join("")}
      </div>
    </div>` : "";

  const todayPanel = `
    <section class="sec-cal">
      <div class="row row-between section-title" data-tkey="titleCal">
        <span>${T("titleCal")}</span>
        <button class="btn btn-ghost btn-sm" onclick="App.nav('planner')">${ic("calendar")} ปฏิทินเต็ม</button>
      </div>
      <div class="card today-card">
        <div class="today-head">
          <div>
            <div class="today-date">${thaiDateStr(new Date(today + "T12:00:00"))}</div>
            <div class="muted">วันนี้ก่อน แล้วค่อยเปิดปฏิทินเต็ม</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.modalTask('${today}')">${ic("plus")} เพิ่ม</button>
        </div>
        <div class="today-stats">
          <div><b>${tToday.length}</b><span>งานวันนี้</span></div>
          <div><b>${doneToday}</b><span>เสร็จแล้ว</span></div>
          <div><b>${overdue.length}</b><span>เลยกำหนด</span></div>
        </div>
        ${tToday.length === 0 ? `
          <div class="empty compact-empty">
            <div class="e-ico">${ic("check")}</div>
            <div class="e-title">วันนี้ยังไม่มีงาน</div>
            <div class="muted">พร้อมวางแผนงานถัดไป</div>
          </div>` : ""}
        ${tToday.slice(0, 4).map(t => taskRowHtml(t, { showPlot: true })).join("")}
        ${tToday.length > 4 ? `<button class="btn btn-ghost btn-block mt-8" onclick="App.nav('planner')">ดูอีก ${tToday.length - 4} งานในปฏิทิน</button>` : ""}
      </div>
    </section>`;
  const nextTasksCount = overdue.length + tTomorrow.length + soon.length;

  return `
    <div class="hero">
      <div class="hero-row">
        <div>
          <div class="hero-greet" data-tkey="heroGreet">${T("heroGreet")}</div>
          <div class="hero-sub">${thaiDateStr(new Date())}</div>
        </div>
        <span class="hero-ver">อัปเดตล่าสุด v${S.version}</span>
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

    <button class="home-water-entry" onclick="App.nav('iot')" aria-label="เปิดหน้าการจัดการน้ำ">
      <span class="home-water-entry-icon">${ic("droplet")}</span>
      <span class="home-water-entry-copy">
        <strong>การจัดการน้ำ</strong>
        <small>ดูระดับน้ำ สัญญาณเซนเซอร์ และประวัติข้อมูล</small>
      </span>
      <span class="home-water-entry-status"><b>LIVE</b><i aria-hidden="true">›</i></span>
    </button>

    ${welcome}
    ${todayPanel}

    <div class="home-summary-head" data-tkey="titleKpi">${T("titleKpi")}</div>
    <div class="home-summary-strip" id="kpiRow">
      <button class="home-summary-item ${kpiClass}" onclick="App.nav('analytics')">
        <span>${ic("dollar")}</span><b>${fmtMoney(ytd.net)}</b><small>กำไรสุทธิ พ.ศ. ${curBE}</small>
      </button>
      <button class="home-summary-item" onclick="App.nav('plots')">
        <span>${ic("pin")}</span><b>${fmtNum(area)} ไร่</b><small>${S.plots.filter(p => p.status === "active").length} แปลง Active</small>
      </button>
      <button class="home-summary-item" onclick="App.goCycles()">
        <span>${ic("leaf")}</span><b>${cycles.length}</b><small>รอบปลูก</small>
      </button>
    </div>

    ${salesBox}

    ${extra}

    <div class="home-flow" style="--flow-areas:'tasks profit' 'tasks activity'">
      ${homeOrder().filter(k => k !== "cal").map(k => {
        if (k === "tasks") return `
      <section class="sec-tasks">
        <div class="row row-between section-title" data-tkey="titleTasks">
          <span>งานถัดไป ${nextTasksCount ? `<span class="badge badge-amber">${nextTasksCount} รายการ</span>` : ""}</span>
          <button class="btn btn-primary btn-sm" onclick="App.modalTask('${today}')">${ic("plus")} เพิ่ม</button>
        </div>
        <div class="card">
          ${nextTasksCount === 0 ? `
            <div class="empty">
              <div class="e-ico">${ic("check")}</div>
              <div class="e-title">ไม่มีงานที่ต้องทำเร็วๆ นี้</div>
              <div class="muted">งานวันนี้แสดงอยู่ด้านบนแล้ว เพิ่มงานใหม่ได้ทันที</div>
            </div>` : ""}
          ${overdue.length ? `
            <div class="task-group"><h3>เลยกำหนด</h3>
              ${overdue.slice(0, 3).map(t => taskRowHtml(t, { showDate: true, showPlot: true })).join("")}
              ${overdue.length > 3 ? `<div class="muted" style="font-size:.72rem;padding:6px 2px">+${overdue.length - 3} รายการ — <a class="link" onclick="App.nav('planner')">ดูทั้งหมด</a></div>` : ""}
            </div>` : ""}
          ${tTomorrow.length ? `<div class="task-group"><h3>พรุ่งนี้</h3>${tTomorrow.map(t => taskRowHtml(t, { showDate: t.date !== tomorrow, showPlot: true })).join("")}</div>` : ""}
          ${soon.length ? `<div class="task-group"><h3>เร็วๆ นี้</h3>${soon.map(t => taskRowHtml(t, { showDate: true, showPlot: true })).join("")}</div>` : ""}
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
          ${recent.length === 0 ? `<div class="empty compact-empty"><div class="e-ico">${ic("check")}</div><div class="e-title">ยังไม่มีประวัติงานที่ทำเสร็จ</div><div class="muted">งานที่ยังต้องทำดูที่งานถัดไปด้านบน</div></div>` : ""}
          ${recent.map(t => {
            /* บอกว่าพึ่งทำอะไรกับงานนี้ */
            let act = t.status === "failed" ? "ไม่สำเร็จ" : "ทำเสร็จ";
            if (t.updatedAt && t.status !== "done" && t.status !== "failed") act = "แก้ไข";
            const st = taskStatusOf(t);
            const dotCls = st === "done" ? "dot-green" : st === "failed" ? "dot-gray" : st === "overdue" ? "dot-red" : "dot-amber";
            return `
            <div class="row-line" onclick="App.viewTask('${t.id}')" role="button" style="cursor:pointer">
              <span class="task-ico ${esc(t.type)}">${ic(TYPE_ICONS[t.type] || "wrench")}</span>
              <div class="grow">
                <div class="bold" style="font-size:.84rem">${esc(t.title)}</div>
                <div class="muted" style="font-size:.7rem">${act} · ${dateLabel(t.date)} ${typeTag(t)}</div>
              </div>
              <button class="task-dot ${dotCls}" onclick="event.stopPropagation();App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ" title="${st === "done" ? "ยกเลิกเสร็จ" : (st === "failed" ? "บันทึกใหม่เป็นเสร็จ" : "ติ๊กเสร็จ")}"></button>
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
  const plotRowsAll = S.plots.map(p => {
    const activeCycle = S.cycles.find(x => x.plotId === p.id && x.status === "active");
    const status = p.status !== "active" ? "inactive" : (activeCycle ? "growing" : "idle");
    const searchText = [p.name, p.crop, activeCycle && activeCycle.plant, p.lat, p.lng].filter(Boolean).join(" ").toLowerCase();
    return { p, activeCycle, status, searchText };
  });
  const plotQ = plotFilter.q.trim().toLowerCase();
  const plotRows = plotRowsAll.filter(row => {
    if (plotFilter.status !== "all" && row.status !== plotFilter.status) return false;
    if (plotQ && !row.searchText.includes(plotQ)) return false;
    return true;
  });
  const counts = {
    all: plotRowsAll.length,
    growing: plotRowsAll.filter(x => x.status === "growing").length,
    idle: plotRowsAll.filter(x => x.status === "idle").length,
    inactive: plotRowsAll.filter(x => x.status === "inactive").length
  };
  const activeCount = plotRowsAll.filter(x => x.p.status === "active").length;
  const plotFilterActive = plotFilter.status !== "all" || !!plotQ;
  const cycles = [...S.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const plotsTab = `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem" data-tkey="plotsTitle">${T("plotsTitle")} ${activeCount}/${S.plots.length}</div>
      <div class="row plots-heading-actions">
        ${counts.idle ? `<button class="btn btn-outline btn-sm" onclick="App.modalCycle()">${ic("leaf")} เริ่มปลูก</button>` : ""}
        <button class="btn btn-primary btn-sm" onclick="App.modalPlot()">＋ แปลงใหม่</button>
      </div>
    </div>
    <div class="plot-filter-panel">
      <div class="stock-search plot-search">
        ${ic("search")}
        <input id="plotSearchInput" type="text" value="${esc(plotFilter.q)}" placeholder="ค้นหาชื่อแปลง พืช หรือพิกัด..." oninput="App.plotFilterQ(this.value)">
        <button class="stock-search-clear" onclick="App.plotFilterQ('')" style="${plotFilter.q ? "" : "display:none"}">✕</button>
      </div>
      <div class="quick-filter-row" aria-label="กรองแปลง">
        <button class="quick-filter ${plotFilter.status === "all" ? "active" : ""}" onclick="App.plotFilterStatus('all')">ทั้งหมด <span>${counts.all}</span></button>
        <button class="quick-filter ${plotFilter.status === "growing" ? "active" : ""}" onclick="App.plotFilterStatus('growing')">กำลังปลูก <span>${counts.growing}</span></button>
        <button class="quick-filter ${plotFilter.status === "idle" ? "active" : ""}" onclick="App.plotFilterStatus('idle')">พักแปลง <span>${counts.idle}</span></button>
        <button class="quick-filter ${plotFilter.status === "inactive" ? "active" : ""}" onclick="App.plotFilterStatus('inactive')">ปิดใช้ <span>${counts.inactive}</span></button>
      </div>
      <div class="stock-filter-status ${plotFilterActive ? "" : "is-clear"}">
        <span>${plotFilterActive ? `แสดง ${fmtNum(plotRows.length)} จาก ${fmtNum(plotRowsAll.length)} แปลง` : `${ic("pin")} ปักหมุด GPS ทุกแปลง เพื่อให้สภาพอากาศแม่นขึ้น`}</span>
        ${plotFilterActive ? `<button class="btn btn-sm btn-ghost" onclick="App.plotFilterClear()">${ic("refresh")} ล้างตัวกรอง</button>` : ""}
      </div>
    </div>
    ${plotRowsAll.length === 0 ? `
    <div class="card"><div class="empty"><div class="e-ico">${ic("map")}</div><div class="e-title">ยังไม่มีแปลง</div><div class="muted">กด "＋ แปลงใหม่" เพื่อเริ่มต้น</div></div></div>` : ""}
    ${plotRowsAll.length && plotRows.length === 0 ? `
    <div class="card"><div class="empty"><div class="e-ico">${ic("search")}</div><div class="e-title">ไม่พบแปลงที่ตรงกับตัวกรอง</div><div class="muted">ลองเปลี่ยนคำค้นหรือสถานะ</div><button class="btn btn-ghost btn-block mt-8" onclick="App.plotFilterClear()">${ic("refresh")} ล้างตัวกรอง</button></div></div>` : ""}
    <div class="card-grid">
    ${plotRows.map(({ p, activeCycle: c, status }) => {
      const statusBadge = status === "growing" ? `<span class="badge badge-green">กำลังปลูก</span>` : (status === "idle" ? `<span class="badge badge-amber">พักแปลง</span>` : `<span class="badge badge-gray">ปิดใช้</span>`);
      return `
      <div class="card plot-card">
        <div class="plot-top clickable" onclick="App.openPlot('${p.id}')">
          <div class="plot-emoji">${cropEmoji(p.crop)}</div>
          <div class="grow">
            <div class="plot-name">${esc(p.name)} ${statusBadge}</div>
            <div class="muted" style="font-size:.72rem">${c ? `${esc(c.plant)} · อายุ ${ageDays(c.startDate)} วัน` : "ยังไม่มีรอบปลูกที่เปิดอยู่"}</div>
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
          <button class="btn btn-sm btn-outline" onclick="App.modalTrial('${p.id}')">${ic("search")} ทดลอง</button>
          ${c ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">${ic("leaf")} เริ่มปลูก</button>`}
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

  const trialsTab = renderTrialsTab();
  const tab = ["plots", "cycles", "trials"].includes(route.tab) ? route.tab : "plots";
  return `
    <div class="tabs">
      <button class="${tab === "plots" ? "active" : ""}" onclick="App.plotsTab('plots')">${ic("map")} แปลง</button>
      <button class="${tab === "cycles" ? "active" : ""}" onclick="App.plotsTab('cycles')">${ic("leaf")} รอบปลูก</button>
      <button class="${tab === "trials" ? "active" : ""}" onclick="App.plotsTab('trials')">${ic("search")} ทดลอง</button>
    </div>
    ${tab === "cycles" ? cyclesTab : (tab === "trials" ? trialsTab : plotsTab)}`;
}
App.plotsTab = function (tab) {
  route.tab = tab;
  if (tab !== "trials") {
    route.trialId = "";
    route.trialMetricId = "";
    route.trialTreatmentId = "";
  }
  render();
};
App.goCycles = function () { route.view = "plots"; route.tab = "cycles"; render(); };
App.goPlots = function () { route.view = "plots"; route.tab = "plots"; render(); };
App.plotFilterStatus = function (status) {
  plotFilter.status = status || "all";
  rerender();
};
App.plotFilterQ = function (v) {
  plotFilter.q = v || "";
  const pos = (document.getElementById("plotSearchInput") || {}).selectionStart;
  rerender();
  const el = document.getElementById("plotSearchInput");
  if (el) {
    el.focus();
    try { el.setSelectionRange(pos || el.value.length, pos || el.value.length); } catch (e) {}
  }
};
App.plotFilterClear = function () {
  plotFilter = { q: "", status: "all" };
  rerender();
};
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

/* ---------------- Field trials / experimental plots ---------------- */
function trialById(s, id) { return (s.trials || []).find(t => t.id === id); }
function trialTreatment(tr, id) { return (tr.treatments || []).find(t => t.id === id); }
function trialUnit(tr, id) { return (tr.units || []).find(u => u.id === id); }
const TRIAL_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#8b5cf6", "#e11d48", "#06b6d4", "#84cc16", "#f97316"];
const DEFAULT_TRIAL_METRICS = [
  { name: "ผลผลิต", unit: "กก." },
  { name: "ความสูง", unit: "ซม." },
  { name: "คะแนนโรค", unit: "0-5" }
];
const TRIAL_TYPES = {
  screening: { label: "Screening Trial", hint: "คัดสูตรเบื้องต้น ใช้ดูแนวโน้มก่อนทดลองเต็ม" },
  rcbd: { label: "RCBD ทดลองจริง", hint: "มีซ้ำ/บล็อก ใช้วิเคราะห์เชิงสถิติได้มากขึ้น" },
  demo: { label: "Demo / แปลงโชว์", hint: "เก็บภาพและผลหน้างานเพื่อสื่อสารกับลูกค้า" }
};
function trialType(tr) { return TRIAL_TYPES[tr.trialType] ? tr.trialType : "screening"; }
function trialTypeLabel(tr) { return TRIAL_TYPES[trialType(tr)].label; }
function trialEvidenceModeText(tr) {
  if (trialType(tr) === "screening") return "Screening Trial: ใช้คัดสูตรและดูแนวโน้ม ยังไม่ควรสรุปเป็นผลวิจัยเต็ม";
  if (trialType(tr) === "demo") return "Demo / แปลงโชว์: เน้นภาพและผลหน้างาน ไม่ใช่งานวิเคราะห์สถิติเต็ม";
  return "RCBD: ทรีตเมนต์ × ซ้ำ/บล็อก · วิเคราะห์เบื้องต้นจากข้อมูลในเว็บ";
}
function parseTrialRate(rate) {
  const s = String(rate || "").trim();
  const m = s.match(/^([\d.,]+)\s*([^/]+)?(?:\/\s*ไร่)?/i);
  if (!m) return null;
  const amount = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit: (m[2] || "หน่วย").trim() };
}
function trialRateText(rate) {
  const r = parseTrialRate(rate);
  return r ? `${fmtNum(r.amount)} ${esc(r.unit)}/ไร่` : esc(rate || "-");
}
function trialUnitArea(u) { return Number(u && u.areaRai) || 0; }
function trialTreatmentArea(tr, treatmentId) {
  return (tr.units || []).filter(u => u.treatmentId === treatmentId).reduce((a, u) => a + trialUnitArea(u), 0);
}
function trialChemicalTotal(rate, area) {
  const r = parseTrialRate(rate);
  if (!r || !(area > 0)) return "";
  return `${fmtNum(Math.round(r.amount * area * 100) / 100)} ${esc(r.unit)}`;
}
function trialTreatmentRecipe(t) {
  const parts = [];
  if (t.activeName || t.activeRate) parts.push(`${esc(t.activeName || "สารหลัก")} ${trialRateText(t.activeRate)}`);
  if (t.mixName || t.mixRate) parts.push(`${esc(t.mixName || "สารผสม")} ${trialRateText(t.mixRate)}`);
  return parts.length ? parts.join(" + ") : esc(t.desc || "");
}
function trialTaskForTreatment(tr, treatmentId) {
  return (S.tasks || [])
    .filter(t => t.trialId === tr.id && t.trialTreatmentId === treatmentId)
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0] || null;
}
function trialTasksForTreatment(tr, treatmentId) {
  return (S.tasks || []).filter(t => t.trialId === tr.id && t.trialTreatmentId === treatmentId);
}
function trialMetrics(tr) {
  const rows = Array.isArray(tr.metrics) && tr.metrics.length
    ? tr.metrics
    : [{ id: "legacy_metric", name: tr.metric || "ผลผลิต", unit: tr.metricUnit || "กก." }];
  return rows.map((m, i) => ({
    id: m.id || ("metric_" + i),
    name: (m.name || (i === 0 ? tr.metric : "") || "ตัวชี้วัด").trim(),
    unit: (m.unit || (i === 0 ? tr.metricUnit : "") || "หน่วย").trim()
  }));
}
function trialMetricById(tr, metricId) {
  const rows = trialMetrics(tr);
  return rows.find(m => m.id === metricId) || rows[0] || { id: "metric_0", name: "ผลผลิต", unit: "กก." };
}
function trialActiveMetricId(tr) {
  const rows = trialMetrics(tr);
  return rows.some(m => m.id === route.trialMetricId) ? route.trialMetricId : (rows[0] || {}).id || "";
}
function trialMetric(tr, metricId) { return trialMetricById(tr, metricId || trialActiveMetricId(tr)).name; }
function trialUnitLabel(tr, metricId) { return trialMetricById(tr, metricId || trialActiveMetricId(tr)).unit; }
function trialObsMetricId(tr, obs) {
  if (obs && obs.metricId && trialMetrics(tr).some(m => m.id === obs.metricId)) return obs.metricId;
  const byName = trialMetrics(tr).find(m => m.name === (obs && obs.metric));
  return byName ? byName.id : trialActiveMetricId(tr);
}
function trialLayoutMode(tr) { return (tr.layoutMode || (tr.design === "MANUAL" ? "manual" : "random")) === "manual" ? "manual" : "random"; }
function trialPlotName(tr) {
  const p = plotById(S, tr.plotId);
  return p ? p.name : ((tr.plotName || "").trim() || "แปลงนอกระบบ");
}
function trialTreatmentColor(tr, treatmentId) {
  const idx = Math.max(0, (tr.treatments || []).findIndex(t => t.id === treatmentId));
  return TRIAL_COLORS[idx % TRIAL_COLORS.length];
}
function trialEffectiveStatus(tr) {
  if ((tr.status || "active") === "done") return "done";
  return trialAnalysis(tr).complete ? "ready" : "active";
}
function trialTreatmentsFromText(text, old) {
  const oldByCode = Object.fromEntries((old || []).map(t => [String(t.code || "").trim().toUpperCase(), t]));
  return String(text || "").split(/\n+/).map((line, i) => {
    const raw = line.trim();
    if (!raw) return null;
    const m = raw.match(/^(T\d+)\s*[:=\-\u2013]\s*(.+)$/i);
    const code = (m ? m[1] : ("T" + (i + 1))).toUpperCase();
    const rest = (m ? m[2] : raw).trim();
    const parts = rest.split(/\s*[|]\s*/);
    const prev = oldByCode[code];
    return { id: prev ? prev.id : uid(), code, name: parts[0] || code, desc: parts[1] || "" };
  }).filter(Boolean);
}
function trialTreatmentsText(tr) {
  return (tr && tr.treatments || []).map(t => `${t.code}: ${t.name}${t.desc ? " | " + t.desc : ""}`).join("\n")
    || "T1: สูตรเดิม\nT2: สูตรใหม่\nT3: สูตรใหม่ + เสริม";
}
function trialMetricRowsHtml(metrics, startIndex) {
  const rows = (metrics && metrics.length ? metrics : DEFAULT_TRIAL_METRICS.map(x => ({ id: uid(), ...x }))).slice();
  const offset = Number(startIndex) || 0;
  return rows.map((m, i) => `
    <div class="trial-metric-row" data-trm-row>
      <div class="field trm-name" style="margin:0"><label>ตัวชี้วัด *</label><input data-trm-name value="${esc(m.name || "")}" placeholder="${esc(DEFAULT_TRIAL_METRICS[(offset + i) % DEFAULT_TRIAL_METRICS.length].name)}"></div>
      <div class="field trm-unit" style="margin:0"><label>หน่วย</label><input data-trm-unit value="${esc(m.unit || "")}" placeholder="${esc(DEFAULT_TRIAL_METRICS[(offset + i) % DEFAULT_TRIAL_METRICS.length].unit)}"></div>
      <button type="button" class="btn btn-sm btn-danger-soft trial-metric-remove" onclick="App.removeTrialMetricRow(this)" title="ลบตัวชี้วัด">${ic("trash")}</button>
    </div>`).join("");
}
function trialMetricsFromForm(old) {
  const oldByName = Object.fromEntries((old || []).map(m => [String(m.name || "").trim(), m]));
  return Array.from(document.querySelectorAll("[data-trm-row]")).map((row, i) => {
    const name = (row.querySelector("[data-trm-name]")?.value || "").trim();
    const unit = (row.querySelector("[data-trm-unit]")?.value || "").trim() || "หน่วย";
    if (!name) return null;
    const prev = oldByName[name] || (old || [])[i];
    return { id: prev ? prev.id : uid(), name, unit };
  }).filter(Boolean);
}
function trialTreatmentRowsHtml(treatments, startIndex) {
  const rows = (treatments && treatments.length ? treatments : trialTreatmentsFromText(trialTreatmentsText())).slice();
  const offset = Number(startIndex) || 0;
  return rows.map((t, i) => `
    <div class="trial-treatment-row" data-trt-row>
      <div class="trial-treatment-color" style="--tr-color:${TRIAL_COLORS[(offset + i) % TRIAL_COLORS.length]}"></div>
      <div class="field trt-code" style="margin:0"><label>รหัส</label><input data-trt-code value="${esc(t.code || ("T" + (offset + i + 1)))}" placeholder="T${offset + i + 1}"></div>
      <div class="field trt-name" style="margin:0"><label>ชื่อสูตร *</label><input data-trt-name value="${esc(t.name || "")}" placeholder="${offset + i === 0 ? "สูตรเดิม" : "สูตรทดลอง"}"></div>
      <div class="field trt-active" style="margin:0"><label>สารหลัก</label><input data-trt-active value="${esc(t.activeName || "")}" placeholder="เช่น สารกำจัดวัชพืช X"></div>
      <div class="field trt-active-rate" style="margin:0"><label>อัตรา/ไร่</label><input data-trt-active-rate value="${esc(t.activeRate || "")}" placeholder="250 cc/ไร่"></div>
      <div class="field trt-mix" style="margin:0"><label>สารผสม</label><input data-trt-mix value="${esc(t.mixName || "")}" placeholder="เช่น Loyant 2.5% EC"></div>
      <div class="field trt-mix-rate" style="margin:0"><label>อัตราผสม</label><input data-trt-mix-rate value="${esc(t.mixRate || "")}" placeholder="160 cc/ไร่"></div>
      <div class="field trt-timing" style="margin:0"><label>ช่วงพ่น</label><input data-trt-timing value="${esc(t.timing || "")}" placeholder="ข้าว 10-15 วัน / หญ้า 2-3 ใบ"></div>
      <div class="field trt-desc" style="margin:0"><label>หมายเหตุสูตร</label><input data-trt-desc value="${esc(t.desc || "")}" placeholder="เช่น สูตรคุม / สูตรทดลอง"></div>
      <button type="button" class="btn btn-sm btn-danger-soft trial-treatment-remove" onclick="App.removeTrialTreatmentRow(this)" title="ลบทรีตเมนต์">${ic("trash")}</button>
    </div>`).join("");
}
function trialTreatmentsFromForm(old) {
  const oldByCode = Object.fromEntries((old || []).map(t => [String(t.code || "").trim().toUpperCase(), t]));
  return Array.from(document.querySelectorAll("[data-trt-row]")).map((row, i) => {
    const code = (row.querySelector("[data-trt-code]")?.value || ("T" + (i + 1))).trim().toUpperCase();
    const name = (row.querySelector("[data-trt-name]")?.value || "").trim();
    const desc = (row.querySelector("[data-trt-desc]")?.value || "").trim();
    const activeName = (row.querySelector("[data-trt-active]")?.value || "").trim();
    const activeRate = (row.querySelector("[data-trt-active-rate]")?.value || "").trim();
    const mixName = (row.querySelector("[data-trt-mix]")?.value || "").trim();
    const mixRate = (row.querySelector("[data-trt-mix-rate]")?.value || "").trim();
    const timing = (row.querySelector("[data-trt-timing]")?.value || "").trim();
    if (!name) return null;
    const prev = oldByCode[code] || (old || [])[i];
    return { id: prev ? prev.id : uid(), code: code || ("T" + (i + 1)), name, desc, activeName, activeRate, mixName, mixRate, timing, photos: prev ? (prev.photos || []) : [] };
  }).filter(Boolean);
}
function shuffleCopy(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function makeTrialUnits(treatments, reps) {
  return makeTrialUnitsForMode(treatments, reps, "random");
}
function makeTrialUnitsForMode(treatments, reps, mode) {
  const units = [];
  for (let block = 1; block <= reps; block++) {
    const row = mode === "manual" ? treatments.slice() : shuffleCopy(treatments);
    row.forEach((t, order) => {
      units.push({ id: uid(), block, order: order + 1, treatmentId: t.id, label: "", areaRai: 0, note: "" });
    });
  }
  return units;
}
function trialObsForMetric(tr, metric) {
  const m = metric || trialActiveMetricId(tr);
  return (tr.observations || []).filter(o => {
    const hasValue = o.value !== "" && o.value !== null && o.value !== undefined && Number.isFinite(Number(o.value));
    return trialObsMetricId(tr, o) === m && hasValue;
  });
}
function trialLatestValues(tr, metric) {
  const latest = {};
  trialObsForMetric(tr, metric).forEach(o => {
    const u = trialUnit(tr, o.unitId);
    if (!u) return;
    const prev = latest[u.id];
    if (!prev || String(o.date || "") >= String(prev.date || "")) latest[u.id] = o;
  });
  return Object.values(latest).map(o => {
    const u = trialUnit(tr, o.unitId);
    return { obs: o, unit: u, treatmentId: u.treatmentId, value: Number(o.value) || 0 };
  });
}
function mean(vals) {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
function sd(vals) {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((a, v) => a + Math.pow(v - m, 2), 0) / (vals.length - 1));
}
function trialAnalysis(tr) {
  const vals = trialLatestValues(tr, trialActiveMetricId(tr));
  const rows = (tr.treatments || []).map(t => {
    const v = vals.filter(x => x.treatmentId === t.id).map(x => x.value);
    const avg = mean(v);
    return { treatment: t, values: v, n: v.length, mean: avg, sd: sd(v), cv: avg ? sd(v) / avg * 100 : 0 };
  });
  const used = rows.filter(r => r.n > 0);
  const allVals = used.flatMap(r => r.values);
  const grand = mean(allVals);
  const ssBetween = used.reduce((a, r) => a + r.n * Math.pow(r.mean - grand, 2), 0);
  const ssWithin = used.reduce((a, r) => a + r.values.reduce((b, v) => b + Math.pow(v - r.mean, 2), 0), 0);
  const dfBetween = Math.max(0, used.length - 1);
  const dfWithin = Math.max(0, allVals.length - used.length);
  const msBetween = dfBetween ? ssBetween / dfBetween : 0;
  const msWithin = dfWithin ? ssWithin / dfWithin : 0;
  const f = msWithin ? msBetween / msWithin : 0;
  const cv = grand && msWithin ? Math.sqrt(msWithin) / grand * 100 : 0;
  const best = used.slice().sort((a, b) => b.mean - a.mean)[0] || null;
  const complete = trialType(tr) === "rcbd"
    ? used.length >= 2 && used.every(r => r.n >= 2)
    : used.length >= Math.min(1, (tr.treatments || []).length) && used.length === (tr.treatments || []).length;
  return { rows, used, allVals, grand, dfBetween, dfWithin, msBetween, msWithin, f, cv, best, complete };
}
function trialMissingUnits(tr) {
  const measured = new Set(trialLatestValues(tr, trialActiveMetricId(tr)).map(x => x.unit.id));
  return (tr.units || []).filter(u => !measured.has(u.id)).map(u => {
    const t = trialTreatment(tr, u.treatmentId) || {};
    return `บล็อก ${u.block} ${t.code || ""}`.trim();
  });
}
function trialMeasureProgress(tr) {
  const total = (tr.units || []).length;
  const done = new Set(trialLatestValues(tr, trialActiveMetricId(tr)).map(x => x.unit.id)).size;
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}
function trialCleanText(value) {
  return String(value || "").trim();
}
function trialHeroMetaHtml(tr, photoCount) {
  const period = trialCleanText(tr.startDate) || trialCleanText(tr.endDate)
    ? `${tr.startDate || "ยังไม่ระบุ"} → ${tr.endDate || "ยังไม่ระบุ"}`
    : "ยังไม่ระบุ";
  const rows = [
    ["พืช/หัวข้อ", trialCleanText(tr.crop)],
    ["ตัวชี้วัด", `${trialMetric(tr)} · ${fmtNum(trialMetrics(tr).length)} ค่า`],
    ["ช่วงทดลอง", period],
    ["ข้อมูล", `${fmtNum((tr.observations || []).length)} ค่า · ${fmtNum(photoCount)} รูป`]
  ];
  if (trialCleanText(tr.sprayMethod)) rows.splice(3, 0, ["วิธีพ่น/ใส่", trialCleanText(tr.sprayMethod)]);
  return `<div class="meta-grid trial-hero-meta mt-8">
    ${rows.filter(([, value]) => trialCleanText(value)).map(([label, value]) => `
      <div class="meta-box ${label === "ช่วงทดลอง" ? "trial-meta-period" : ""}"><div class="lb">${esc(label)}</div><div class="vl">${esc(value)}</div></div>`).join("")}
  </div>`;
}
function trialPlanKvHtml(label, value, always) {
  const v = trialCleanText(value);
  if (!v && !always) return "";
  return `<div class="trial-plan-kv"><span>${esc(label)}</span><b>${esc(v || "ยังไม่ระบุ")}</b></div>`;
}
function trialQuickNavHtml() {
  const items = [
    ["plan", "แผน"],
    ["areas", "แปลง"],
    ["layout", "ผัง"],
    ["analysis", "วิเคราะห์"],
    ["timeline", "ไทม์ไลน์"],
    ["photos", "รูป"]
  ];
  return `<div class="trial-jumpbar">${items.map(([id, label]) =>
    `<button type="button" onclick="App.scrollTrialSection('${id}')">${esc(label)}</button>`).join("")}</div>`;
}
function trialMeanChartItems(tr) {
  const a = trialAnalysis(tr);
  return a.rows.filter(r => r.n).map(r => ({
    label: r.treatment.code,
    value: Math.round(r.mean * 100) / 100,
    color: trialTreatmentColor(tr, r.treatment.id)
  }));
}
function trialTrendChartItems(tr) {
  const treatmentId = trialActiveTreatmentId(tr);
  const byDate = {};
  trialObsForMetric(tr).forEach(o => {
    if (treatmentId) {
      const u = trialUnit(tr, o.unitId);
      if (!u || u.treatmentId !== treatmentId) return;
    }
    const d = o.date || todayISO();
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(Number(o.value) || 0);
  });
  return Object.keys(byDate).sort().slice(-12).map(d => ({
    label: d.slice(5).replace("-", "/"),
    value: Math.round(mean(byDate[d]) * 100) / 100
  }));
}
function trialActiveTreatmentId(tr) {
  return (tr.treatments || []).some(t => t.id === route.trialTreatmentId) ? route.trialTreatmentId : "";
}
function trialStatusBadge(tr) {
  const st = trialEffectiveStatus(tr);
  if (st === "done") return `<span class="badge badge-gray">สรุปผลแล้ว</span>`;
  if (st === "ready") return `<span class="badge badge-blue">เก็บข้อมูลครบ</span>`;
  return `<span class="badge badge-green">กำลังทดลอง</span>`;
}
function trialEvidenceText(tr, a) {
  if (!a.allVals.length) return "ยังไม่มีค่าวัด จึงยังวิเคราะห์ไม่ได้";
  if (trialType(tr) === "screening") {
    if (a.best) return `${a.best.treatment.code} ค่าเฉลี่ยสูงสุดตอนนี้ (${fmtNum(a.best.mean)} ${trialUnitLabel(tr)}) · ใช้เป็นแนวโน้มคัดสูตร ยังไม่ใช่ผลวิจัยเต็ม`;
    return "ข้อมูลเริ่มพออ่านแนวโน้ม Screening ได้ แต่ยังควรเก็บรูปและค่าวัดซ้ำก่อนเลือกสูตร";
  }
  if (trialType(tr) === "demo") return "โหมด Demo เน้นภาพและผลหน้างาน ใช้สื่อสาร/เปรียบเทียบเบื้องต้น มากกว่าสรุปเชิงสถิติ";
  if (!a.complete) return `ข้อมูลยังไม่ครบทุกทรีตเมนต์/ซ้ำ ใช้เป็นแนวโน้มก่อน ยังไม่ควรฟันธงผลทดลอง`;
  if (a.best) return `${a.best.treatment.code} ค่าเฉลี่ยสูงสุด (${fmtNum(a.best.mean)} ${trialUnitLabel(tr)}) · ANOVA เบื้องต้น F=${fmtNum(a.f.toFixed(2))}, CV=${fmtNum(a.cv.toFixed(1))}%`;
  return "ข้อมูลพร้อมเปรียบเทียบ แต่ยังไม่พบความต่างเด่นชัดจากค่าเฉลี่ย";
}
function trialPhotosHtml(photos) {
  const list = (photos || []).filter(Boolean);
  if (!list.length) return "";
  return `<div class="task-photo-strip trial-obs-strip">${list.slice(0, 4).map(p => `<button class="task-photo-thumb readonly" onclick="App.viewTrialObsPhoto(${esc(JSON.stringify(p))})" title="ดูรูปใหญ่"><img src="${esc(taskPhotoUrl(p))}" alt="รูปค่าวัด" loading="lazy" onerror="this.closest('.task-photo-thumb').remove()"></button>`).join("")}</div>`;
}
function trialMetricFilterHtml(tr) {
  const active = trialActiveMetricId(tr);
  return `<div class="trial-filter-card">
    <div class="trial-filter-head"><b>${ic("chart")} ตัวชี้วัด</b><span>เลือกค่าที่ต้องการดูกราฟและ timeline</span></div>
    <div class="trial-chip-row">
      ${trialMetrics(tr).map(m => `<button class="quick-filter ${active === m.id ? "active" : ""}" onclick="App.setTrialMetric('${m.id}')">${esc(m.name)} <small>${esc(m.unit)}</small></button>`).join("")}
    </div>
  </div>`;
}
function trialTreatmentFilterHtml(tr) {
  const active = trialActiveTreatmentId(tr);
  return `<div class="trial-filter-card">
    <div class="trial-filter-head"><b>${ic("leaf")} ทรีตเมนต์</b><span>เลือกดูรูปและค่าวัดต่อเนื่องของสูตรเดียว</span></div>
    <div class="trial-chip-row">
      <button class="quick-filter ${active ? "" : "active"}" onclick="App.setTrialTreatmentFilter('')">ทั้งหมด</button>
      ${(tr.treatments || []).map(t => `<button class="quick-filter ${active === t.id ? "active" : ""}" onclick="App.setTrialTreatmentFilter('${t.id}')"><i class="trial-dot" style="background:${trialTreatmentColor(tr, t.id)}"></i>${esc(t.code)} <small>${esc(t.name)}</small></button>`).join("")}
    </div>
  </div>`;
}
function trialTreatmentPhotosHtml(tr) {
  return `<div class="card trial-treatment-photo-card">
    <div class="row row-between">
      <div><div class="bold">รูปสรุปทรีตเมนต์</div><div class="muted">เก็บรูปเด่นของแต่ละสูตรไว้เทียบกันเร็ว ๆ</div></div>
    </div>
    <div class="trial-treatment-photo-grid">
      ${(tr.treatments || []).map(t => {
        const photos = (t.photos || []).filter(Boolean);
        return `<div class="trial-treatment-photo-box" style="--tr-color:${trialTreatmentColor(tr, t.id)}">
          <div class="trial-treatment-photo-title"><span><i></i><b>${esc(t.code)}</b> ${esc(t.name)}</span><button class="btn btn-sm btn-outline" onclick="App.pickTrialTreatmentPhotos('${tr.id}', '${t.id}')">${ic("camera")}</button></div>
          ${photos.length ? `<div class="task-photo-strip trial-obs-strip">${photos.slice(0, 5).map((p, i) => `
            <div class="task-photo-thumb">
              <img src="${esc(taskPhotoUrl(p))}" alt="รูปสรุปทรีตเมนต์" loading="lazy" onclick="App.viewTrialTreatmentPhoto('${tr.id}', '${t.id}', ${i})" onerror="this.closest('.task-photo-thumb').remove()">
              <button type="button" class="task-photo-remove" aria-label="ลบรูปนี้" onclick="event.stopPropagation();App.removeTrialTreatmentPhoto('${tr.id}', '${t.id}', ${i})">✕</button>
            </div>`).join("")}</div>` : `<div class="task-photo-empty trial-photo-empty-small">${ic("camera")} ยังไม่มีรูปสรุป</div>`}
        </div>`;
      }).join("")}
    </div>
  </div>`;
}
function trialPlanHtml(tr) {
  const optionalMissing = [
    ["เป้าหมาย", tr.objective],
    ["วิธีพ่น/ใส่", tr.sprayMethod],
    ["น้ำ/พาหะ", tr.waterRate],
    ["ผสมต่อครั้ง", tr.mixVolume]
  ].filter(([, value]) => !trialCleanText(value)).map(([label]) => label);
  const timedTreatments = (tr.treatments || []).filter(t => trialCleanText(t.timing));
  return `<div class="trial-plan-grid">
    <div class="card trial-plan-card">
      <div class="trial-plan-head">${ic("info")} ข้อมูลงานทดลอง</div>
      ${trialPlanKvHtml("ชนิดงาน", trialTypeLabel(tr), true)}
      ${trialPlanKvHtml("รูปแบบผัง", trialLayoutMode(tr) === "manual" ? "จัดผังเอง" : "สุ่มอัตโนมัติ", true)}
      ${trialPlanKvHtml("เป้าหมาย", tr.objective)}
      ${trialPlanKvHtml("วิธีพ่น/ใส่", tr.sprayMethod)}
      ${trialPlanKvHtml("น้ำ/พาหะ", tr.waterRate)}
      ${trialPlanKvHtml("ผสมต่อครั้ง", tr.mixVolume)}
      ${optionalMissing.length ? `<div class="trial-empty-note">${ic("info")} ยังไม่ได้ใส่ ${esc(optionalMissing.join(", "))}</div>` : ""}
    </div>
    <div class="card trial-plan-card">
      <div class="trial-plan-head">${ic("clock")} ช่วงเวลาพ่นโดยประมาณ</div>
      ${timedTreatments.length ? timedTreatments.map(t => `
        <div class="trial-timing-row" style="--tr-color:${trialTreatmentColor(tr, t.id)}">
          <b>${esc(t.code)}</b><span>${esc(t.timing)}</span>
        </div>`).join("") : `<div class="muted">ยังไม่ได้ใส่ช่วงพ่นของแต่ละสูตร</div>`}
    </div>
  </div>
  <div class="card trial-program-card">
    <div class="row row-between">
      <div><div class="bold">โปรแกรมการทดลอง</div><div class="muted">สูตรพ่น/อัตราต่อไร่จากแต่ละทรีตเมนต์</div></div>
      <span class="badge badge-blue">${fmtNum((tr.treatments || []).length)} สูตร</span>
    </div>
    <div class="trial-program-grid">
      ${(tr.treatments || []).map(t => {
        const linkedTask = trialTaskForTreatment(tr, t.id);
        const recipe = trialTreatmentRecipe(t);
        return `<div class="trial-program-item ${linkedTask ? "has-linked-task" : ""}" style="--tr-color:${trialTreatmentColor(tr, t.id)}">
        <div class="trial-program-title">
          <div class="trial-program-code">${esc(t.code)}</div>
          <b>${esc(t.name)}</b>
        </div>
        <span class="${recipe ? "" : "trial-program-incomplete"}">${recipe ? recipe : `${ic("alert")} ยังไม่ได้ใส่รายละเอียดสูตร`}</span>
        ${t.desc ? `<small>${esc(t.desc)}</small>` : ""}
        <div class="trial-program-actions">
          <div class="trial-program-main">
            ${linkedTask
              ? `<button class="btn btn-sm btn-primary" onclick="App.viewTask('${linkedTask.id}')">${ic("eye")} เปิดกิจกรรม</button><small class="trial-linked-task">สร้างไว้แล้ว · ${esc(dateLabel(linkedTask.date))}</small>`
              : `<button class="btn btn-sm btn-outline" onclick="App.createTaskFromTrialTreatment('${tr.id}', '${t.id}')">${ic("plus")} สร้างกิจกรรม</button>`}
          </div>
          <button class="btn btn-sm btn-danger-soft btn-icon trial-program-delete" onclick="App.deleteTrialTreatment('${tr.id}', '${t.id}')" title="ลบสูตรนี้" aria-label="ลบสูตร ${esc(t.code)}">${ic("trash")}</button>
        </div>
      </div>`;
      }).join("")}
    </div>
  </div>`;
}
function trialMixTableHtml(tr) {
  return `<div class="card trial-mix-card">
    <div class="row row-between">
      <div><div class="bold">ตารางสูตรผสมต่อพื้นที่</div><div class="muted">${esc(tr.mixVolume || "คำนวณจากพื้นที่แปลงย่อย × อัตราต่อไร่")}</div></div>
      <button class="btn btn-sm btn-outline" onclick="App.modalTrialAreas('${tr.id}')">${ic("pencil")} แก้พื้นที่</button>
    </div>
    <div class="trial-mix-table">
      <div class="trial-mix-head"><span>สูตร</span><span>พื้นที่</span><span>สารหลัก</span><span>สารผสม</span></div>
      ${(tr.treatments || []).map(t => {
        const area = trialTreatmentArea(tr, t.id);
        return `<div class="trial-mix-row" style="--tr-color:${trialTreatmentColor(tr, t.id)}">
          <span><b>${esc(t.code)}</b> ${esc(t.name)}</span>
          <span>${area ? fmtNum(area) + " ไร่" : "ยังไม่ใส่"}</span>
          <span>${t.activeName ? esc(t.activeName) + " " : ""}${trialChemicalTotal(t.activeRate, area) || trialRateText(t.activeRate)}</span>
          <span>${t.mixName || t.mixRate ? `${t.mixName ? esc(t.mixName) + " " : ""}${trialChemicalTotal(t.mixRate, area) || trialRateText(t.mixRate)}` : "-"}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="muted mt-8" style="font-size:.72rem">${ic("info")} ถ้าใส่พื้นที่แปลงย่อย ระบบจะคูณอัตรา/ไร่ให้เป็นปริมาณสารที่ต้องใช้ต่อสูตร</div>
  </div>`;
}
function trialAreaHtml(tr) {
  const total = (tr.units || []).reduce((a, u) => a + trialUnitArea(u), 0);
  return `<div class="card trial-area-card">
    <div class="row row-between">
      <div><div class="bold">แปลงทดสอบและพื้นที่</div><div class="muted">พื้นที่รวม ${fmtNum(Math.round(total * 1000) / 1000)} ไร่ · กำหนดชื่อแปลงย่อยได้ตามหน้างาน</div></div>
      <button class="btn btn-sm btn-outline" onclick="App.modalTrialAreas('${tr.id}')">${ic("pencil")} แก้พื้นที่</button>
    </div>
    <div class="trial-area-grid">
      ${(tr.units || []).slice().sort((a, b) => a.block - b.block || a.order - b.order).map(u => {
        const t = trialTreatment(tr, u.treatmentId) || {};
        return `<div class="trial-area-item" style="--tr-color:${trialTreatmentColor(tr, u.treatmentId)}">
          <b>${esc(u.label || `บล็อก ${u.block} · ลำดับ ${u.order}`)}</b>
          <span>${esc(t.code || "?")} ${esc(t.name || "")}</span>
          <small>${trialUnitArea(u) ? fmtNum(trialUnitArea(u)) + " ไร่" : "ยังไม่ใส่พื้นที่"}${u.note ? " · " + esc(u.note) : ""}</small>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}
function trialTimelineHtml(tr) {
  const metricId = trialActiveMetricId(tr);
  const treatmentId = trialActiveTreatmentId(tr);
  const rows = trialObsForMetric(tr, metricId)
    .map(o => {
      const u = trialUnit(tr, o.unitId);
      const t = u ? trialTreatment(tr, u.treatmentId) : null;
      return { obs: o, unit: u, treatment: t };
    })
    .filter(x => x.unit && (!treatmentId || x.unit.treatmentId === treatmentId))
    .sort((a, b) => String(a.obs.date || "").localeCompare(String(b.obs.date || "")) || a.unit.block - b.unit.block || a.unit.order - b.unit.order);
  return `<div class="card trial-timeline">
    ${rows.length ? rows.map(x => `<div class="trial-time-row" style="--tr-color:${trialTreatmentColor(tr, x.unit.treatmentId)}">
      <div class="trial-time-date">${esc(dateLabel(x.obs.date || todayISO()))}</div>
      <div class="grow">
        <div class="bold"><span class="trial-code-pill">${esc(x.treatment ? x.treatment.code : "?")}</span> ${esc(x.treatment ? x.treatment.name : "ไม่พบทรีตเมนต์")}</div>
        <div class="muted">ซ้ำ ${fmtNum(x.unit.block)} · ลำดับ ${fmtNum(x.unit.order)} · ${esc(x.obs.metric || trialMetric(tr, metricId))}: <b>${fmtNum(x.obs.value)} ${esc(x.obs.unit || trialUnitLabel(tr, metricId))}</b></div>
        ${x.obs.note ? `<div class="td-note-body mt-4">${esc(x.obs.note)}</div>` : ""}
        ${trialPhotosHtml(x.obs.photos)}
      </div>
      <button class="btn btn-sm btn-outline" onclick="App.modalTrialObs('${tr.id}', '${x.unit.id}', '${x.obs.id}')">${ic("pencil")}</button>
      <button class="btn btn-sm btn-danger-soft" onclick="App.deleteTrialObs('${tr.id}', '${x.obs.id}')">${ic("trash")}</button>
    </div>`).join("") : `<div class="empty compact-empty"><div class="e-ico">${ic("search")}</div><div class="e-title">ยังไม่มีข้อมูลตามตัวกรองนี้</div><div class="muted">เลือกทรีตเมนต์/ตัวชี้วัดอื่น หรือบันทึกค่าวัดเพิ่ม</div></div>`}
  </div>`;
}
function trialAnalysisHtml(tr) {
  const a = trialAnalysis(tr);
  const selectedTreatmentId = trialActiveTreatmentId(tr);
  const selectedTreatment = selectedTreatmentId ? trialTreatment(tr, selectedTreatmentId) : null;
  const metric = trialMetric(tr);
  const unit = trialUnitLabel(tr);
  const missing = trialMissingUnits(tr);
  return `
    <div class="trial-analysis-grid">
      <div class="card">
        <div class="row row-between">
          <div><div class="bold">ค่าเฉลี่ยตามทรีตเมนต์</div><div class="muted">${esc(metric)} (${esc(unit)}) · ใช้ค่าล่าสุดของแต่ละซ้ำ</div></div>
          <span class="badge badge-blue">${fmtNum(a.allVals.length)} ค่า</span>
        </div>
        ${a.allVals.length ? `<div class="chart-wrap trial-chart" id="trialMeanChart_${tr.id}" data-trial-mean="${tr.id}"></div>` : `<div class="empty compact-empty"><div class="e-ico">${ic("chart")}</div><div class="e-title">ยังไม่มีค่าวัด</div><div class="muted">กดแปลงย่อยเพื่อบันทึกข้อมูล</div></div>`}
      </div>
      <div class="card">
        <div class="row row-between">
          <div><div class="bold">แนวโน้มรายวันที่วัด</div><div class="muted">${selectedTreatment ? `เฉพาะ ${esc(selectedTreatment.code)} ${esc(selectedTreatment.name)}` : "ค่าเฉลี่ยรวมทุกทรีตเมนต์"} ตามวันที่บันทึก</div></div>
        </div>
        ${trialTrendChartItems(tr).length ? `<div class="chart-wrap trial-chart" id="trialTrendChart_${tr.id}" data-trial-trend="${tr.id}"></div>` : `<div class="muted" style="padding:20px 4px;text-align:center">รอข้อมูลมากกว่า 1 วันที่วัด</div>`}
      </div>
    </div>
    <div class="card">
      <div class="row row-between">
        <div><div class="bold">สรุปเชิงวิชาการ</div><div class="muted">${esc(trialEvidenceModeText(tr))}</div></div>
        <span class="badge ${a.complete ? "badge-green" : "badge-amber"}">${a.complete ? "ข้อมูลเริ่มพร้อม" : "หลักฐานยังจำกัด"}</span>
      </div>
      ${missing.length ? `<div class="trial-missing">${ic("alert")} ยังขาดค่าวัด ${fmtNum(missing.length)} แปลงย่อย: ${esc(missing.slice(0, 8).join(", "))}${missing.length > 8 ? "..." : ""}</div>` : ""}
      <div class="trial-finding">${esc(trialEvidenceText(tr, a))}</div>
      <div class="trial-stat-table">
        <div class="trial-stat-head"><span>ทรีตเมนต์</span><span>n</span><span>เฉลี่ย</span><span>SD</span><span>CV%</span></div>
        ${a.rows.map(r => `<div class="trial-stat-row">
          <span><b>${esc(r.treatment.code)}</b> ${esc(r.treatment.name)}</span>
          <span>${fmtNum(r.n)}</span>
          <span>${r.n ? fmtNum(r.mean.toFixed(2)) : "—"}</span>
          <span>${r.n > 1 ? fmtNum(r.sd.toFixed(2)) : "—"}</span>
          <span>${r.n > 1 && r.mean ? fmtNum(r.cv.toFixed(1)) : "—"}</span>
        </div>`).join("")}
      </div>
      <div class="muted mt-8" style="font-size:.72rem">${ic("info")} ${trialType(tr) === "rcbd" ? "ค่า ANOVA นี้เป็นตัวช่วยอ่านแนวโน้ม ยังไม่คำนวณ p-value/post-hoc เต็มแบบโปรแกรมสถิติ" : "โหมดนี้ใช้ดูแนวโน้มและคัดสูตรก่อน หากต้องใช้ทำรายงานวิจัยควรวางซ้ำ/สุ่มแบบ RCBD และเก็บข้อมูลครบ"} </div>
    </div>`;
}
function trialLayoutHtml(tr) {
  const blocks = [...new Set((tr.units || []).map(u => u.block))].sort((a, b) => a - b);
  return `
    <div class="trial-legend">
      ${(tr.treatments || []).map(t => `<span><i style="background:${trialTreatmentColor(tr, t.id)}"></i><b>${esc(t.code)}</b> ${esc(t.name)}</span>`).join("")}
    </div>
    <div class="trial-layout ${trialLayoutMode(tr) === "manual" ? "trial-layout-manual" : ""}">
      ${blocks.map(b => {
        const units = (tr.units || []).filter(u => u.block === b).sort((a, b) => a.order - b.order);
        return `<div class="trial-block">
          <div class="trial-block-head">ซ้ำ/บล็อก ${fmtNum(b)}</div>
          <div class="trial-unit-grid">
            ${units.map(u => {
              const t = trialTreatment(tr, u.treatmentId) || {};
              const latest = trialLatestValues(tr).find(x => x.unit.id === u.id);
              return `<button class="trial-unit" style="--tr-color:${trialTreatmentColor(tr, u.treatmentId)}" onclick="App.modalTrialObs('${tr.id}', '${u.id}')">
                <b>${esc(t.code || "?")}</b>
                <span>${esc(t.name || "")}</span>
                <small>${latest ? `${fmtNum(latest.value)} ${esc(trialUnitLabel(tr))}` : "ยังไม่วัด"}</small>
              </button>`;
            }).join("")}
          </div>
        </div>`;
      }).join("")}
    </div>`;
}
function renderTrialDetail(tr) {
  const status = trialEffectiveStatus(tr);
  const progress = trialMeasureProgress(tr);
  const photoCount = (tr.treatments || []).reduce((n, t) => n + ((t.photos || []).filter(Boolean).length), 0);
  return `
    <div class="trial-detail">
      <div class="row" style="margin-bottom:10px">
        <button class="btn btn-sm btn-ghost" onclick="App.closeTrial()">${ic("chevron")} กลับไปงานทดลองทั้งหมด</button>
      </div>
      <div class="card trial-hero">
        <div class="row row-between">
          <div class="grow">
            <div class="plot-name">${ic("search")} ${esc(tr.name)} ${trialStatusBadge(tr)}</div>
            <div class="muted">${esc(trialPlotName(tr))} · ${esc(trialTypeLabel(tr))} · ${trialLayoutMode(tr) === "manual" ? "จัดผังเอง" : "สุ่มอัตโนมัติ"} · ${fmtNum((tr.treatments || []).length)} ทรีตเมนต์</div>
          </div>
        </div>
        <div class="trial-progress-card mt-8">
          <div class="trial-progress-head">
            <span>${ic("chart")} ความคืบหน้าค่าวัด</span>
            <b>${fmtNum(progress.done)}/${fmtNum(progress.total)} แปลงย่อย</b>
          </div>
          <div class="hp-bar"><i style="width:${progress.pct}%"></i></div>
          <div class="muted">${progress.total ? `ครบ ${fmtNum(progress.pct)}% ของตัวชี้วัด "${esc(trialMetric(tr))}"` : "ยังไม่มีผังแปลงย่อย"}</div>
        </div>
        ${trialHeroMetaHtml(tr, photoCount)}
        ${tr.note ? `<div class="td-note-body mt-8">${esc(tr.note)}</div>` : ""}
        <div class="trial-manage-grid mt-8">
          <button class="btn btn-primary" onclick="App.modalTrialObs('${tr.id}')">${ic("plus")} บันทึกค่าวัด</button>
          <button class="btn btn-outline" onclick="App.modalTrialAreas('${tr.id}')">${ic("map")} จัดผัง/พื้นที่</button>
          <button class="btn btn-outline" onclick="App.scrollTrialSection('photos')">${ic("camera")} รูปเปรียบเทียบ</button>
          <button class="btn btn-outline" onclick="App.modalTrial('', '${tr.id}')">${ic("pencil")} แก้ไขงานทดลอง</button>
        </div>
        <div class="trial-secondary-actions">
          <button class="btn btn-sm btn-ghost" onclick="App.randomizeTrial('${tr.id}')">${ic("refresh")} สุ่มผังใหม่</button>
          ${status === "done" ? `<button class="btn btn-sm btn-primary" onclick="App.setTrialStatus('${tr.id}', 'active')">${ic("refresh")} เปิดทดลองต่อ</button>` : `<button class="btn btn-sm btn-primary" onclick="App.setTrialStatus('${tr.id}', 'done')">${ic("check")} สรุปผลแล้ว</button>`}
          <button class="btn btn-sm btn-danger-soft trial-danger-action" onclick="App.deleteTrial('${tr.id}')">${ic("trash")} ลบงานทดลอง</button>
        </div>
      </div>
      ${trialQuickNavHtml()}
      <div class="section-title trial-anchor" id="trialSec_plan">แผนทดลอง</div>
      ${trialPlanHtml(tr)}
      <div class="section-title trial-anchor" id="trialSec_areas">แปลงทดสอบ</div>
      ${trialAreaHtml(tr)}
      <div class="section-title trial-anchor" id="trialSec_mix">สูตรผสม</div>
      ${trialMixTableHtml(tr)}
      ${trialMetricFilterHtml(tr)}
      ${trialTreatmentFilterHtml(tr)}
      <div class="section-title trial-anchor" id="trialSec_layout">${trialLayoutMode(tr) === "manual" ? "ผังแปลงทดลอง" : "ผังสุ่มแปลงทดลอง"}</div>
      ${trialLayoutHtml(tr)}
      <div class="section-title trial-anchor" id="trialSec_analysis">วิเคราะห์ผลทดลอง</div>
      ${trialAnalysisHtml(tr)}
      <div class="section-title trial-anchor" id="trialSec_timeline">ไทม์ไลน์ค่าวัด</div>
      ${trialTimelineHtml(tr)}
      <div class="section-title trial-anchor" id="trialSec_photos">รูปเปรียบเทียบ</div>
      ${trialTreatmentPhotosHtml(tr)}
    </div>`;
}
function renderTrialsTab() {
  const trials = (S.trials || []).slice().sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));
  const selected = trialById(S, route.trialId);
  if (selected) return renderTrialDetail(selected);
  return `
    <div class="row row-between">
      <div class="bold" style="font-size:1.02rem">แปลงทดลอง ${fmtNum(trials.length)} งาน</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalTrial()">${ic("plus")} สร้างงานทดลอง</button>
    </div>
    <div class="trial-intro">
      <div>${ic("search")} ทดลองแบบสุ่ม มีทรีตเมนต์และซ้ำ เพื่อดูผลจริงจากแปลงของเรา</div>
      <span>เหมาะกับปุ๋ย ยา เมล็ดพันธุ์ วิธีให้น้ำ หรือสูตรดูแลใหม่</span>
    </div>
    ${trials.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("search")}</div><div class="e-title">ยังไม่มีแปลงทดลอง</div><div class="muted">เริ่มจากเลือกแปลงจริง แล้วกำหนดทรีตเมนต์กับจำนวนซ้ำ</div><button class="btn btn-primary btn-block mt-8" onclick="App.modalTrial()">${ic("plus")} สร้างงานทดลองแรก</button></div></div>` : ""}
    <div class="card-grid">
      ${trials.map(tr => {
        const p = plotById(S, tr.plotId);
        const a = trialAnalysis(tr);
        return `<div class="card trial-card">
          <div class="plot-top clickable" onclick="App.openTrial('${tr.id}')">
            <div class="plot-emoji">${ic("search")}</div>
            <div class="grow">
              <div class="plot-name">${esc(tr.name)} ${trialStatusBadge(tr)}</div>
              <div class="muted">${esc(trialPlotName(tr))} · ${esc(trialTypeLabel(tr))} · ${fmtNum((tr.treatments || []).length)} ทรีตเมนต์</div>
            </div>
            <span class="muted" style="font-size:1.1rem">›</span>
          </div>
          <div class="meta-grid">
            <div class="meta-box"><div class="lb">ตัวชี้วัด</div><div class="vl">${fmtNum(trialMetrics(tr).length)} ค่า</div></div>
            <div class="meta-box"><div class="lb">ค่าวัด</div><div class="vl">${fmtNum((tr.observations || []).length)}</div></div>
            <div class="meta-box"><div class="lb">ดีที่สุดตอนนี้</div><div class="vl">${a.best ? esc(a.best.treatment.code) : "—"}</div></div>
            <div class="meta-box"><div class="lb">CV%</div><div class="vl">${a.cv ? fmtNum(a.cv.toFixed(1)) : "—"}</div></div>
          </div>
          <div class="actions-row">
            <button class="btn btn-sm btn-ghost" onclick="App.openTrial('${tr.id}')">${ic("eye")} ดูผล</button>
            <button class="btn btn-sm btn-primary" onclick="App.modalTrialObs('${tr.id}')">${ic("plus")} วัดผล</button>
            <button class="btn btn-sm btn-outline" onclick="App.modalTrial('', '${tr.id}')">${ic("pencil")} แก้ไข</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
}
function renderTrialPhotoPreview() {
  const el = document.getElementById("trialObsPhotos");
  if (!el) return;
  if (!trialObsPhotos.length) {
    el.innerHTML = `<div class="task-photo-empty">${ic("camera")} ยังไม่มีรูปค่าวัด</div>`;
    return;
  }
  el.innerHTML = `<div class="task-photo-strip">${trialObsPhotos.map((p, i) => `
    <div class="task-photo-thumb">
      <img src="${esc(taskPhotoUrl(p))}" alt="รูปค่าวัด" loading="lazy" onclick="App.viewTrialTempPhoto(${i})" onerror="this.closest('.task-photo-thumb').remove()">
      <button type="button" class="task-photo-remove" aria-label="ลบรูปนี้" onclick="event.stopPropagation();App.trialRemovePhoto(${i})">✕</button>
    </div>`).join("")}</div>`;
}
App.openTrial = function (id) {
  route.view = "plots";
  route.tab = "trials";
  route.trialId = id;
  render();
};
App.closeTrial = function () {
  route.trialId = "";
  route.trialMetricId = "";
  route.trialTreatmentId = "";
  route.view = "plots";
  route.tab = "trials";
  render();
};
App.scrollTrialSection = function (id) {
  const el = document.getElementById(`trialSec_${id}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};
App.setTrialMetric = function (metricId) {
  route.trialMetricId = metricId || "";
  render();
};
App.setTrialTreatmentFilter = function (treatmentId) {
  route.trialTreatmentId = treatmentId || "";
  render();
};
App.trialPlotSelectChanged = function () {
  const sel = document.getElementById("tr_plot");
  const nameInput = document.getElementById("tr_plot_name");
  const cropInput = document.getElementById("tr_crop");
  const p = sel && sel.value ? plotById(S, sel.value) : null;
  if (nameInput && p) nameInput.value = "";
  if (cropInput && p && !cropInput.value.trim()) cropInput.value = plotCropName(S, p) || "";
};
App.addTrialTreatmentRow = function () {
  const list = document.getElementById("trialTreatmentList");
  if (!list) return;
  const n = list.querySelectorAll("[data-trt-row]").length + 1;
  list.insertAdjacentHTML("beforeend", trialTreatmentRowsHtml([{ id: uid(), code: "T" + n, name: "", desc: "" }], n - 1));
  const input = list.querySelector("[data-trt-row]:last-child [data-trt-name]");
  if (input) input.focus();
};
App.removeTrialTreatmentRow = function (btn) {
  const list = document.getElementById("trialTreatmentList");
  const row = btn && btn.closest("[data-trt-row]");
  if (!list || !row) return;
  if (list.querySelectorAll("[data-trt-row]").length <= 2) {
    toast("ต้องมีอย่างน้อย 2 ทรีตเมนต์");
    return;
  }
  row.remove();
};
App.addTrialMetricRow = function () {
  const list = document.getElementById("trialMetricList");
  if (!list) return;
  const n = list.querySelectorAll("[data-trm-row]").length;
  list.insertAdjacentHTML("beforeend", trialMetricRowsHtml([{ id: uid(), name: "", unit: "" }], n));
  const input = list.querySelector("[data-trm-row]:last-child [data-trm-name]");
  if (input) input.focus();
};
App.removeTrialMetricRow = function (btn) {
  const list = document.getElementById("trialMetricList");
  const row = btn && btn.closest("[data-trm-row]");
  if (!list || !row) return;
  if (list.querySelectorAll("[data-trm-row]").length <= 1) {
    toast("ต้องมีอย่างน้อย 1 ตัวชี้วัด");
    return;
  }
  row.remove();
};
App.trialObsMetricChanged = function (trialId) {
  const tr = trialById(S, trialId);
  const sel = document.getElementById("tro_metric_id");
  const unitInput = document.getElementById("tro_unitlabel");
  if (!tr || !sel || !unitInput) return;
  const m = trialMetricById(tr, sel.value);
  unitInput.value = m.unit || "หน่วย";
};
App.modalTrialLayout = function (id) {
  const tr = trialById(S, id);
  if (!tr) return;
  const units = (tr.units || []).slice().sort((a, b) => a.block - b.block || a.order - b.order);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("map")} จัดผังทรีตเมนต์เอง</h3>
    <div class="modal-sub">${esc(tr.name)} · ใช้เมื่อหน้างานวางตำแหน่งไว้แล้ว หรือแก้ผังจากการสุ่ม</div>
    ${(tr.observations || []).length ? `<div class="trial-missing">${ic("alert")} งานนี้มีค่าวัดแล้ว ถ้าเปลี่ยนทรีตเมนต์ของแปลงย่อย ผลวิเคราะห์จะอัปเดตตามผังใหม่ทันที</div>` : ""}
    <form onsubmit="return App.saveTrialLayout(event, '${tr.id}')">
      <div class="trial-layout-editor">
        ${units.map(u => {
          const cur = trialTreatment(tr, u.treatmentId);
          return `<div class="trial-layout-edit-row" data-tu="${u.id}" style="--tr-color:${trialTreatmentColor(tr, u.treatmentId)}">
            <b>บล็อก ${fmtNum(u.block)} · ลำดับ ${fmtNum(u.order)}</b>
            <select data-tu-treatment>
              ${(tr.treatments || []).map(t => `<option value="${t.id}" ${u.treatmentId === t.id ? "selected" : ""}>${esc(t.code)} · ${esc(t.name)}</option>`).join("")}
            </select>
            <span>${esc(cur ? cur.name : "")}</span>
          </div>`;
        }).join("")}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ic("save")} บันทึกผัง</button>
      </div>
    </form>`);
};
App.saveTrialLayout = function (e, id) {
  e.preventDefault();
  const tr = trialById(S, id);
  if (!tr) return false;
  document.querySelectorAll("[data-tu]").forEach(row => {
    const u = trialUnit(tr, row.dataset.tu);
    const treatmentId = row.querySelector("[data-tu-treatment]")?.value || "";
    if (u && treatmentId) u.treatmentId = treatmentId;
  });
  tr.layoutMode = "manual";
  tr.design = "MANUAL";
  tr.updatedAt = Date.now();
  saveState(S);
  closeModal();
  rerender();
  toast("บันทึกผังแปลงทดลองแล้ว");
  return false;
};
App.modalTrialAreas = function (id) {
  const tr = trialById(S, id);
  if (!tr) return;
  const units = (tr.units || []).slice().sort((a, b) => a.block - b.block || a.order - b.order);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("map")} แปลงทดสอบและพื้นที่</h3>
    <div class="modal-sub">ตั้งชื่อพื้นที่จริง เช่น แปลงทดสอบ 1 / คันนาซ้าย และใส่พื้นที่ไร่เพื่อคำนวณสูตรผสม</div>
    <form onsubmit="return App.saveTrialAreas(event, '${tr.id}')">
      <div class="trial-area-editor">
        ${units.map(u => {
          const t = trialTreatment(tr, u.treatmentId) || {};
          return `<div class="trial-area-edit-row" data-ta="${u.id}" style="--tr-color:${trialTreatmentColor(tr, u.treatmentId)}">
            <div class="trial-area-edit-title"><b>${esc(t.code || "?")} ${esc(t.name || "")}</b><span>บล็อก ${fmtNum(u.block)} · ลำดับ ${fmtNum(u.order)}</span></div>
            <div class="form-row-2">
              <div class="field" style="margin:0"><label>ชื่อแปลงย่อย</label><input data-ta-label value="${esc(u.label || "")}" placeholder="เช่น แปลงทดสอบ 1"></div>
              <div class="field" style="margin:0"><label>พื้นที่ (ไร่)</label><input data-ta-area type="number" min="0" step="0.001" value="${esc(u.areaRai || "")}" placeholder="เช่น 1.6"></div>
            </div>
            <div class="field" style="margin:0"><label>หมายเหตุ</label><input data-ta-note value="${esc(u.note || "")}" placeholder="เช่น เปรียบเทียบ Bis 100 vs 200 cc/ไร่"></div>
          </div>`;
        }).join("")}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ic("save")} บันทึกพื้นที่</button>
      </div>
    </form>`);
};
App.saveTrialAreas = function (e, id) {
  e.preventDefault();
  const tr = trialById(S, id);
  if (!tr) return false;
  document.querySelectorAll("[data-ta]").forEach(row => {
    const u = trialUnit(tr, row.dataset.ta);
    if (!u) return;
    u.label = (row.querySelector("[data-ta-label]")?.value || "").trim();
    u.areaRai = Number(row.querySelector("[data-ta-area]")?.value) || 0;
    u.note = (row.querySelector("[data-ta-note]")?.value || "").trim();
  });
  tr.updatedAt = Date.now();
  saveState(S);
  closeModal();
  rerender();
  toast("บันทึกพื้นที่แปลงทดสอบแล้ว");
  return false;
};
function trialWizardPanels() {
  return Array.from(document.querySelectorAll(".trial-wizard-step"));
}
function trialWizardSetStep(index) {
  const panels = trialWizardPanels();
  if (!panels.length) return;
  const max = panels.length - 1;
  trialWizardIndex = Math.max(0, Math.min(Number(index) || 0, max));
  panels.forEach((p, i) => p.classList.toggle("active", i === trialWizardIndex));
  document.querySelectorAll("[data-trial-step]").forEach((btn, i) => {
    btn.classList.toggle("active", i === trialWizardIndex);
    btn.classList.toggle("done", i < trialWizardIndex);
  });
  const back = document.getElementById("trialWizardBack");
  const next = document.getElementById("trialWizardNext");
  const submit = document.getElementById("trialWizardSubmit");
  const count = document.getElementById("trialWizardCount");
  if (back) back.disabled = trialWizardIndex === 0;
  if (next) next.hidden = trialWizardIndex === max;
  if (submit) submit.hidden = trialWizardIndex !== max;
  if (count) count.textContent = `${trialWizardIndex + 1}/${panels.length}`;
}
function trialWizardFocus(input, message, step) {
  trialWizardSetStep(step);
  setTimeout(() => {
    if (input) {
      setModalFieldError(input, message);
      (input.closest(".field") || input).scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    }
    toast(message);
  }, 40);
}
function trialWizardValidateStep(step) {
  if (step === 0) {
    const name = document.getElementById("tr_name");
    const plot = document.getElementById("tr_plot");
    const plotName = document.getElementById("tr_plot_name");
    if (!String(name?.value || "").trim()) {
      trialWizardFocus(name, "กรอกชื่องานทดลองก่อน", 0);
      return false;
    }
    clearModalFieldError(name);
    if (!String(plot?.value || "").trim() && !String(plotName?.value || "").trim()) {
      trialWizardFocus(plotName, "เลือกแปลงในระบบ หรือพิมพ์ชื่อแปลงนอกระบบ", 0);
      return false;
    }
    clearModalFieldError(plotName);
  }
  if (step === 1) {
    const rows = document.querySelectorAll("[data-trt-row]");
    const filled = Array.from(rows).filter(row => String(row.querySelector("[data-trt-name]")?.value || "").trim()).length;
    if (filled < 2) {
      const input = Array.from(rows).find(row => !String(row.querySelector("[data-trt-name]")?.value || "").trim())?.querySelector("[data-trt-name]") || rows[0]?.querySelector("[data-trt-name]");
      trialWizardFocus(input, "ต้องมีอย่างน้อย 2 ทรีตเมนต์", 1);
      return false;
    }
  }
  if (step === 2) {
    const rows = document.querySelectorAll("[data-trm-row]");
    const filled = Array.from(rows).filter(row => String(row.querySelector("[data-trm-name]")?.value || "").trim()).length;
    if (filled < 1) {
      const input = rows[0]?.querySelector("[data-trm-name]");
      trialWizardFocus(input, "ต้องมีอย่างน้อย 1 ตัวชี้วัด", 2);
      return false;
    }
    const rep = document.getElementById("tr_rep");
    if ((Number(rep?.value) || 0) < 1) {
      trialWizardFocus(rep, "จำนวนซ้ำต้องมากกว่า 0", 2);
      return false;
    }
  }
  return true;
}
App.trialWizardStep = function (index) {
  trialWizardSetStep(index);
};
App.trialWizardNext = function () {
  if (!trialWizardValidateStep(trialWizardIndex)) return;
  trialWizardSetStep(trialWizardIndex + 1);
};
App.trialWizardPrev = function () {
  trialWizardSetStep(trialWizardIndex - 1);
};
App.modalTrial = function (plotId, id) {
  const tr = id ? trialById(S, id) : null;
  const p = plotId ? plotById(S, plotId) : null;
  const defaultPlot = tr ? tr.plotId : (plotId || ((S.plots || [])[0] || {}).id || "");
  const externalPlotName = tr ? (tr.plotName || "") : "";
  trialWizardIndex = 0;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("search")} ${tr ? "แก้ไขงานทดลอง" : "สร้างแปลงทดลอง"}</h3>
    <div class="modal-sub">ตั้งข้อมูลงาน สูตรทดลอง แปลงย่อย และตัวชี้วัดแบบเป็นขั้นตอน</div>
    <form onsubmit="return App.saveTrial(event, '${tr ? tr.id : ""}')">
      <div class="trial-wizard">
        <div class="trial-wizard-steps">
          <button type="button" data-trial-step class="active" onclick="App.trialWizardStep(0)"><b>1</b><span>ข้อมูลงาน</span></button>
          <button type="button" data-trial-step onclick="App.trialWizardStep(1)"><b>2</b><span>สูตร</span></button>
          <button type="button" data-trial-step onclick="App.trialWizardStep(2)"><b>3</b><span>แปลง/วัดผล</span></button>
          <button type="button" data-trial-step onclick="App.trialWizardStep(3)"><b>4</b><span>สรุป</span></button>
        </div>
        <div class="trial-wizard-count" id="trialWizardCount">1/4</div>
      </div>

      <div class="trial-wizard-step active" data-trial-panel="0">
        <div class="field"><label>ชื่องานทดลอง *</label><input id="tr_name" value="${esc(tr ? tr.name : "")}" placeholder="เช่น ทดสอบสารกำจัดวัชพืช X ในนาข้าว"></div>
        <div class="field"><label>วัตถุประสงค์</label><input id="tr_objective" value="${esc(tr ? tr.objective || "" : "")}" placeholder="เช่น คัดเลือกสูตรที่เหมาะสำหรับใช้งานจริง"></div>
        <div class="field"><label>ชนิดงานทดลอง</label><select id="tr_type">
          ${Object.keys(TRIAL_TYPES).map(k => `<option value="${k}" ${(!tr && k === "screening") || (tr && trialType(tr) === k) ? "selected" : ""}>${esc(TRIAL_TYPES[k].label)} — ${esc(TRIAL_TYPES[k].hint)}</option>`).join("")}
        </select></div>
        <div class="form-row-2">
          <div class="field"><label>เลือกแปลงในระบบ</label><select id="tr_plot" onchange="App.trialPlotSelectChanged()">
            <option value="">-- แปลงนอกระบบ / พิมพ์เอง --</option>
            ${(S.plots || []).map(x => `<option value="${x.id}" ${defaultPlot === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}
          </select></div>
          <div class="field"><label>ชื่อแปลงนอกระบบ</label><input id="tr_plot_name" value="${esc(defaultPlot ? "" : externalPlotName)}" placeholder="เช่น แปลงลูกค้า A / แปลงเช่า"></div>
        </div>
        <div class="field"><label>พืช/เรื่องทดลอง</label><input id="tr_crop" value="${esc(tr ? tr.crop || "" : (p ? plotCropName(S, p) : ""))}" placeholder="เช่น ข้าว / พริก / แตงโม"></div>
        <div class="form-row-2">
          <div class="field"><label>วันที่เริ่ม</label><input id="tr_start" type="date" value="${esc(tr ? tr.startDate || todayISO() : todayISO())}"></div>
          <div class="field"><label>วันที่คาดว่าจะจบ</label><input id="tr_end" type="date" value="${esc(tr ? tr.endDate || "" : "")}"></div>
        </div>
      </div>

      <div class="trial-wizard-step" data-trial-panel="1">
        <div class="trial-step-title"><b>สูตรและโปรแกรมทดลอง</b><span>ใส่รหัสสูตร สารหลัก สารผสม อัตรา และช่วงพ่น</span></div>
        <div class="form-row-2">
          <div class="field"><label>รูปแบบพ่น/ใส่</label><input id="tr_spray_method" value="${esc(tr ? tr.sprayMethod || "" : "")}" placeholder="เช่น โดรน T25 / คนพ่น / หว่าน"></div>
          <div class="field"><label>น้ำหรือปริมาณพาหะ</label><input id="tr_water_rate" value="${esc(tr ? tr.waterRate || "" : "")}" placeholder="เช่น น้ำ 8 ลิตร/ไร่"></div>
        </div>
        <div class="field"><label>ปริมาตรผสมต่อครั้ง</label><input id="tr_mix_volume" value="${esc(tr ? tr.mixVolume || "" : "")}" placeholder="เช่น ผสมต่อครั้ง 15 ลิตร"></div>
        <div class="field"><label>ทรีตเมนต์ *</label>
          <div class="trial-treatment-list" id="trialTreatmentList">${trialTreatmentRowsHtml(tr ? tr.treatments : null)}</div>
          <button type="button" class="btn btn-sm btn-outline trial-add-treatment" onclick="App.addTrialTreatmentRow()">${ic("plus")} เพิ่มทรีตเมนต์</button>
        </div>
      </div>

      <div class="trial-wizard-step" data-trial-panel="2">
        <div class="trial-step-title"><b>แปลงย่อยและตัวชี้วัด</b><span>กำหนดจำนวนซ้ำ วิธีจัดผัง และค่าที่จะวิเคราะห์</span></div>
        <div class="form-row-2">
          <div class="field"><label>จำนวนซ้ำ/ชุดแปลง *</label><input id="tr_rep" type="number" min="1" step="1" value="${esc(tr ? tr.replications || 1 : 1)}"></div>
          <div class="field"><label>รูปแบบผัง</label><select id="tr_layout_mode">
            <option value="random" ${!tr || trialLayoutMode(tr) === "random" ? "selected" : ""}>สุ่มอัตโนมัติในแต่ละบล็อก</option>
            <option value="manual" ${tr && trialLayoutMode(tr) === "manual" ? "selected" : ""}>จัดผังเอง</option>
          </select></div>
        </div>
        <div class="field"><label>ตัวชี้วัด *</label>
          <div class="trial-metric-list" id="trialMetricList">${trialMetricRowsHtml(tr ? trialMetrics(tr) : null)}</div>
          <button type="button" class="btn btn-sm btn-outline trial-add-treatment" onclick="App.addTrialMetricRow()">${ic("plus")} เพิ่มตัวชี้วัด</button>
          <div class="hint">เพิ่มได้หลายค่า เช่น ผลผลิต, ความสูง, คะแนนโรค, จำนวนผล</div>
        </div>
      </div>

      <div class="trial-wizard-step" data-trial-panel="3">
        <div class="trial-step-title"><b>สถานะและหมายเหตุ</b><span>เก็บสมมติฐาน ข้อจำกัด หรือสิ่งที่ต้องระวังก่อนบันทึก</span></div>
        <div class="form-row-2">
          <div class="field"><label>สถานะ</label><select id="tr_status">
            <option value="active" ${!tr || (tr.status || "active") === "active" ? "selected" : ""}>กำลังทดลอง</option>
            <option value="done" ${tr && tr.status === "done" ? "selected" : ""}>สรุปผลแล้ว</option>
          </select></div>
          <div class="field"><label>คำอธิบายผัง</label><input value="RCBD / จัดผังเองตามหน้างาน" readonly></div>
        </div>
        <div class="field"><label>หมายเหตุ</label><textarea id="tr_note" rows="4" placeholder="สมมติฐาน วิธีวัด หรือข้อจำกัดของแปลง">${esc(tr ? tr.note || "" : "")}</textarea></div>
        <div class="trial-save-note">${ic("info")} หลังบันทึกแล้วสามารถแก้พื้นที่แปลงย่อย จัดผังเอง และบันทึกรูป/ค่าวัดรายทรีตเมนต์ได้จากหน้ารายละเอียด</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="trialWizardBack" onclick="App.trialWizardPrev()">ย้อนกลับ</button>
        <button type="button" class="btn btn-outline" onclick="App.closeModal()">ยกเลิก</button>
        <button type="button" class="btn btn-primary" id="trialWizardNext" onclick="App.trialWizardNext()">ถัดไป</button>
        <button type="submit" class="btn btn-primary" id="trialWizardSubmit" hidden>${ic("save")} ${tr ? "บันทึก" : "สร้างและสุ่มผัง"}</button>
      </div>
    </form>`);
  trialWizardSetStep(0);
};
App.saveTrial = function (e, id) {
  e.preventDefault();
  const tr = id ? trialById(S, id) : null;
  const nameInput = document.getElementById("tr_name");
  const name = (nameInput?.value || "").trim();
  if (!name) {
    trialWizardFocus(nameInput, "กรอกชื่องานทดลองก่อน", 0);
    return false;
  }
  const treatments = trialTreatmentsFromForm(tr && tr.treatments);
  const metrics = trialMetricsFromForm(tr && tr.metrics);
  const reps = Math.max(1, Number(document.getElementById("tr_rep").value) || 1);
  if (treatments.length < 2) {
    const rows = document.querySelectorAll("[data-trt-row]");
    const input = Array.from(rows).find(row => !String(row.querySelector("[data-trt-name]")?.value || "").trim())?.querySelector("[data-trt-name]") || rows[0]?.querySelector("[data-trt-name]");
    trialWizardFocus(input, "ต้องมีอย่างน้อย 2 ทรีตเมนต์", 1);
    return false;
  }
  if (!metrics.length) {
    const input = document.querySelector("[data-trm-name]");
    trialWizardFocus(input, "ต้องมีอย่างน้อย 1 ตัวชี้วัด", 2);
    return false;
  }
  const plotId = document.getElementById("tr_plot").value;
  const plotName = document.getElementById("tr_plot_name").value.trim();
  const layoutMode = document.getElementById("tr_layout_mode").value === "manual" ? "manual" : "random";
  if (!plotId && !plotName) {
    const input = document.getElementById("tr_plot_name");
    trialWizardFocus(input, "เลือกแปลงในระบบ หรือพิมพ์ชื่อแปลงนอกระบบ", 0);
    return false;
  }
  const codeSig = treatments.map(t => t.code).join("|");
  const oldSig = tr ? (tr.treatments || []).map(t => t.code).join("|") : "";
  const structureChanged = !tr || reps !== Number(tr.replications || 0) || codeSig !== oldSig || layoutMode !== trialLayoutMode(tr);
  if (tr && (tr.observations || []).length && structureChanged) {
    toast("มีค่าวัดแล้ว — ยังไม่ให้เปลี่ยนจำนวนซ้ำ/ทรีตเมนต์/รูปแบบผัง เพื่อกันข้อมูลวิเคราะห์เพี้ยน");
    return false;
  }
  const data = {
    name,
    objective: document.getElementById("tr_objective").value.trim(),
    trialType: document.getElementById("tr_type").value || "screening",
    plotId,
    plotName: plotId ? "" : plotName,
    crop: document.getElementById("tr_crop").value.trim(),
    sprayMethod: document.getElementById("tr_spray_method").value.trim(),
    waterRate: document.getElementById("tr_water_rate").value.trim(),
    mixVolume: document.getElementById("tr_mix_volume").value.trim(),
    design: layoutMode === "manual" ? "MANUAL" : "RCBD",
    layoutMode,
    startDate: document.getElementById("tr_start").value || todayISO(),
    endDate: document.getElementById("tr_end").value || "",
    metric: metrics[0].name,
    metricUnit: metrics[0].unit || "หน่วย",
    metrics,
    replications: reps,
    treatments,
    note: document.getElementById("tr_note").value.trim(),
    status: document.getElementById("tr_status").value || "active"
  };
  if (tr) {
    Object.assign(tr, data);
    if (structureChanged) tr.units = makeTrialUnitsForMode(treatments, reps, layoutMode);
    tr.updatedAt = Date.now();
  } else {
    const fresh = { id: uid(), ...data, units: makeTrialUnitsForMode(treatments, reps, layoutMode), observations: [], createdAt: Date.now(), updatedAt: Date.now() };
    S.trials.push(fresh);
    route.trialId = fresh.id;
  }
  saveState(S);
  closeModal();
  route.view = "plots";
  route.tab = "trials";
  render();
  toast(tr ? "บันทึกงานทดลองแล้ว" : "สร้างแปลงทดลองและสุ่มผังแล้ว");
  return false;
};
App.createTaskFromTrialTreatment = function (trialId, treatmentId) {
  const tr = trialById(S, trialId);
  const t = tr ? trialTreatment(tr, treatmentId) : null;
  if (!tr || !t) return;
  const existing = trialTaskForTreatment(tr, t.id);
  if (existing) {
    App.viewTask(existing.id);
    toast(`สูตร ${t.code} มีกิจกรรมอยู่แล้ว`);
    return existing;
  }
  const area = trialTreatmentArea(tr, t.id);
  const cycle = tr.plotId ? (S.cycles || []).find(c => c.plotId === tr.plotId && c.status === "active") : null;
  const activeTotal = trialChemicalTotal(t.activeRate, area);
  const mixTotal = trialChemicalTotal(t.mixRate, area);
  const typeText = `${tr.sprayMethod || ""} ${t.name || ""} ${t.activeName || ""} ${t.mixName || ""}`;
  const taskType = /ปุ๋ย|หว่าน|ใส่/.test(typeText) && !/ฉีด|พ่น|ยา|สารกำจัด/.test(typeText) ? "fertilize" : "spray";
  const lines = [
    `จากงานทดลอง: ${tr.name}`,
    `แปลงทดลอง: ${trialPlotName(tr)}`,
    `ทรีตเมนต์: ${t.code} ${t.name}`,
    area ? `พื้นที่รวมสูตรนี้: ${fmtNum(Math.round(area * 1000) / 1000)} ไร่` : "พื้นที่รวมสูตรนี้: ยังไม่ได้ใส่พื้นที่",
    tr.sprayMethod ? `วิธีพ่น/ใส่: ${tr.sprayMethod}` : "",
    tr.waterRate ? `น้ำ/พาหะ: ${tr.waterRate}` : "",
    tr.mixVolume ? `ผสมต่อครั้ง: ${tr.mixVolume}` : "",
    t.activeName || t.activeRate ? `สารหลัก: ${t.activeName || "-"} ${t.activeRate || ""}${activeTotal ? ` = ${activeTotal}` : ""}` : "",
    t.mixName || t.mixRate ? `สารผสม: ${t.mixName || "-"} ${t.mixRate || ""}${mixTotal ? ` = ${mixTotal}` : ""}` : "",
    t.timing ? `ช่วงพ่น: ${t.timing}` : "",
    t.desc ? `หมายเหตุสูตร: ${t.desc}` : ""
  ].filter(Boolean);
  const task = addTask(S, {
    title: `${TYPE_LABELS[taskType]}สูตรทดลอง ${t.code} ${t.name}`.trim(),
    type: taskType,
    date: tr.startDate || todayISO(),
    status: "planned",
    plotId: tr.plotId || null,
    cycleId: cycle ? cycle.id : null,
    costItems: [],
    costCat: null,
    stockId: null,
    qty: 0,
    unit: "",
    cost: 0,
    revenue: 0,
    harvestQty: 0,
    harvestUnitPrice: 0,
    finishCycle: false,
    note: lines.join("\n"),
    photos: [],
    donePhotos: [],
    doneNote: "",
    trialId: tr.id,
    trialTreatmentId: t.id
  });
  saveState(S);
  render();
  toast(`สร้างกิจกรรมจากสูตร ${t.code} แล้ว`);
  return task;
};
App.randomizeTrial = function (id) {
  const tr = trialById(S, id);
  if (!tr) return;
  if ((tr.observations || []).length) {
    toast("มีค่าวัดแล้ว — ไม่สุ่มผังใหม่ เพื่อกันข้อมูลแปลงย่อยสลับ");
    return;
  }
  tr.units = makeTrialUnits(tr.treatments || [], Number(tr.replications) || 3);
  tr.layoutMode = "random";
  tr.design = "RCBD";
  tr.updatedAt = Date.now();
  saveState(S);
  rerender();
  toast("สุ่มผังแปลงทดลองใหม่แล้ว");
};
App.setTrialStatus = function (id, status) {
  const tr = trialById(S, id);
  if (!tr) return;
  tr.status = status === "done" ? "done" : "active";
  tr.updatedAt = Date.now();
  saveState(S);
  rerender();
  toast(tr.status === "done" ? "ปิดงานทดลองเป็นสรุปผลแล้ว" : "เปิดงานทดลองต่อแล้ว");
};
App.deleteTrial = function (id) {
  const tr = trialById(S, id);
  if (!tr) return;
  App.confirm("ลบแปลงทดลองนี้?", "ค่าวัด รูป และผลวิเคราะห์ของงานทดลองนี้จะถูกลบด้วย", () => {
    S.trials = (S.trials || []).filter(x => x.id !== id);
    route.trialId = "";
    saveState(S);
    render();
    toast("ลบแปลงทดลองแล้ว");
  });
};
App.deleteTrialTreatment = function (trialId, treatmentId) {
  const tr = trialById(S, trialId);
  const t = tr ? trialTreatment(tr, treatmentId) : null;
  if (!tr || !t) return;
  if ((tr.treatments || []).length <= 2) {
    toast("ต้องมีอย่างน้อย 2 ทรีตเมนต์");
    return;
  }
  const units = (tr.units || []).filter(u => u.treatmentId === t.id);
  const unitIds = new Set(units.map(u => u.id));
  const obsCount = (tr.observations || []).filter(o => unitIds.has(o.unitId)).length;
  const photoCount = (t.photos || []).filter(Boolean).length;
  const taskCount = trialTasksForTreatment(tr, t.id).length;
  const details = [
    `จะลบ ${t.code} ${t.name}`,
    `${fmtNum(units.length)} แปลงย่อย`,
    obsCount ? `${fmtNum(obsCount)} ค่าวัด` : "",
    photoCount ? `${fmtNum(photoCount)} รูปสรุป` : "",
    taskCount ? `${fmtNum(taskCount)} กิจกรรมจะถูกถอดการผูกกับงานทดลอง แต่ไม่ลบงาน/สต็อก` : ""
  ].filter(Boolean).join(" · ");
  confirmChoice("ลบทรีตเมนต์นี้?", details, [
    { label: "ลบสูตรนี้", cls: "btn-danger-soft", value: "delete" },
    { label: "ยกเลิก", cls: "btn-ghost", value: "cancel" }
  ], v => {
    if (v !== "delete") return;
    tr.treatments = (tr.treatments || []).filter(x => x.id !== t.id);
    tr.units = (tr.units || []).filter(u => u.treatmentId !== t.id);
    tr.observations = (tr.observations || []).filter(o => !unitIds.has(o.unitId));
    const byBlock = {};
    tr.units.forEach(u => {
      const key = String(u.block || 1);
      byBlock[key] = byBlock[key] || [];
      byBlock[key].push(u);
    });
    Object.values(byBlock).forEach(rows => rows
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((u, i) => { u.order = i + 1; }));
    trialTasksForTreatment(tr, t.id).forEach(task => {
      task.trialId = null;
      task.trialTreatmentId = null;
      task.updatedAt = Date.now();
    });
    if (route.trialTreatmentId === t.id) route.trialTreatmentId = "";
    tr.updatedAt = Date.now();
    saveState(S);
    rerender();
    toast(`ลบทรีตเมนต์ ${t.code} แล้ว`);
  });
};
App.modalTrialObs = function (trialId, unitId, obsId) {
  const tr = trialById(S, trialId);
  if (!tr) return;
  const obs = obsId ? (tr.observations || []).find(o => o.id === obsId) : null;
  trialObsPhotos = obs ? (obs.photos || []).slice() : [];
  const units = (tr.units || []).slice().sort((a, b) => a.block - b.block || a.order - b.order);
  const selectedMetricId = obs ? trialObsMetricId(tr, obs) : trialActiveMetricId(tr);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic(obs ? "pencil" : "plus")} ${obs ? "แก้ไขค่าวัด" : "บันทึกค่าวัดแปลงทดลอง"}</h3>
    <div class="modal-sub">${esc(tr.name)} · ${esc(trialMetric(tr))}</div>
    <form onsubmit="return App.saveTrialObs(event, '${tr.id}', '${obs ? obs.id : ""}')">
      <div class="form-row-2">
        <div class="field"><label>วันที่วัด *</label><input id="tro_date" type="date" required value="${esc(obs ? obs.date || todayISO() : todayISO())}"></div>
        <div class="field"><label>แปลงย่อย *</label><select id="tro_unit" required>
          ${units.map(u => {
            const t = trialTreatment(tr, u.treatmentId) || {};
            const selectedUnit = obs ? obs.unitId : unitId;
            return `<option value="${u.id}" ${selectedUnit === u.id ? "selected" : ""}>บล็อก ${u.block} · ลำดับ ${u.order} · ${esc(t.code || "")} ${esc(t.name || "")}</option>`;
          }).join("")}
        </select></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>ตัวชี้วัด *</label><select id="tro_metric_id" required onchange="App.trialObsMetricChanged('${tr.id}')">
          ${trialMetrics(tr).map(m => `<option value="${m.id}" ${selectedMetricId === m.id ? "selected" : ""}>${esc(m.name)} (${esc(m.unit)})</option>`).join("")}
        </select></div>
        <div class="field"><label>ค่า *</label><input id="tro_value" type="number" step="0.01" required value="${obs && obs.value !== undefined ? esc(obs.value) : ""}" placeholder="เช่น 0, 12.5"></div>
      </div>
      <div class="field"><label>หน่วย</label><input id="tro_unitlabel" value="${esc(obs ? obs.unit || trialUnitLabel(tr, selectedMetricId) : trialUnitLabel(tr, selectedMetricId))}"></div>
      <div class="field"><label>หมายเหตุ</label><textarea id="tro_note" rows="3" placeholder="เช่น โรคใบจุดเล็กน้อย / วัดจาก 10 ต้นสุ่ม">${esc(obs ? obs.note || "" : "")}</textarea></div>
      <div class="task-photo-panel">
        <div class="task-photo-head">
          <div><b>รูปค่าวัด</b><span>แนบรูปทรงพุ่ม โรค แมลง หรือผลผลิตของแปลงย่อย</span></div>
          <button type="button" class="btn btn-sm btn-outline" onclick="App.trialPickPhotos()">${ic("camera")} เพิ่มรูป</button>
        </div>
        <div id="trialObsPhotos">${trialObsPhotos.length ? "" : `<div class="task-photo-empty">${ic("camera")} ยังไม่มีรูปค่าวัด</div>`}</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ic("save")} ${obs ? "บันทึกการแก้ไข" : "บันทึกค่าวัด"}</button>
      </div>
    </form>`);
  renderTrialPhotoPreview();
};
App.saveTrialObs = function (e, trialId, obsId) {
  e.preventDefault();
  if (trialPhotoUploading) { toast("รอเพิ่มรูปให้เสร็จก่อน"); return false; }
  const tr = trialById(S, trialId);
  if (!tr) return false;
  const unitId = document.getElementById("tro_unit").value;
  const metricId = document.getElementById("tro_metric_id").value || trialActiveMetricId(tr);
  const metric = trialMetricById(tr, metricId);
  const rawValue = document.getElementById("tro_value").value;
  const value = Number(rawValue);
  if (!unitId || rawValue === "" || !Number.isFinite(value)) return false;
  tr.observations = tr.observations || [];
  const old = obsId ? tr.observations.find(o => o.id === obsId) : null;
  const data = {
    id: old ? old.id : uid(),
    unitId,
    date: document.getElementById("tro_date").value || todayISO(),
    metricId,
    metric: metric.name || trialMetric(tr, metricId),
    value,
    unit: document.getElementById("tro_unitlabel").value.trim() || metric.unit || trialUnitLabel(tr, metricId),
    note: document.getElementById("tro_note").value.trim(),
    photos: trialObsPhotos.slice(),
    createdAt: old ? old.createdAt || Date.now() : Date.now(),
    updatedAt: Date.now()
  };
  if (old) Object.assign(old, data);
  else tr.observations.push(data);
  tr.updatedAt = Date.now();
  saveState(S);
  closeModal();
  route.view = "plots";
  route.tab = "trials";
  route.trialId = tr.id;
  render();
  toast(old ? "แก้ไขค่าวัดแล้ว · อัปเดตกราฟวิเคราะห์" : "บันทึกค่าวัดแล้ว · อัปเดตกราฟวิเคราะห์");
  return false;
};
App.deleteTrialObs = function (trialId, obsId) {
  const tr = trialById(S, trialId);
  if (!tr) return;
  tr.observations = (tr.observations || []).filter(o => o.id !== obsId);
  tr.updatedAt = Date.now();
  saveState(S);
  rerender();
  toast("ลบค่าวัดแล้ว");
};
App.trialPickPhotos = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.style.display = "none";
  input.onchange = async () => {
    const files = input.files ? [...input.files] : [];
    input.remove();
    if (!files.length) return;
    trialPhotoUploading = true;
    toast("กำลังเพิ่มรูปค่าวัด...");
    try {
      for (const f of files) trialObsPhotos.push(await readTaskPhotoFile(f));
      renderTrialPhotoPreview();
      toast(files.length > 1 ? `เพิ่มรูป ${files.length} รูปแล้ว` : "เพิ่มรูปแล้ว");
    } catch (e) {
      toast("อ่านรูปไม่สำเร็จ — ลองไฟล์ JPG/PNG");
    }
    trialPhotoUploading = false;
  };
  document.body.appendChild(input);
  input.click();
};
App.trialRemovePhoto = function (idx) {
  trialObsPhotos.splice(idx, 1);
  renderTrialPhotoPreview();
  toast("ลบรูปแล้ว");
};
App.viewTrialTempPhoto = function (idx) {
  showTaskLightbox(trialObsPhotos, idx, next => `App.viewTrialTempPhoto(${next})`);
};
App.viewTrialObsPhoto = function (photo) {
  showTaskLightbox([photo], 0, () => "");
};
App.pickTrialTreatmentPhotos = function (trialId, treatmentId) {
  const tr = trialById(S, trialId);
  const t = tr ? trialTreatment(tr, treatmentId) : null;
  if (!t) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.style.display = "none";
  input.onchange = async () => {
    const files = input.files ? [...input.files] : [];
    input.remove();
    if (!files.length) return;
    toast("กำลังเพิ่มรูปสรุปทรีตเมนต์...");
    try {
      t.photos = t.photos || [];
      for (const f of files) t.photos.push(await readTaskPhotoFile(f));
      tr.updatedAt = Date.now();
      saveState(S);
      rerender();
      toast(files.length > 1 ? `เพิ่มรูปสรุป ${files.length} รูปแล้ว` : "เพิ่มรูปสรุปแล้ว");
    } catch (e) {
      toast("อ่านรูปไม่สำเร็จ — ลองไฟล์ JPG/PNG");
    }
  };
  document.body.appendChild(input);
  input.click();
};
App.removeTrialTreatmentPhoto = function (trialId, treatmentId, idx) {
  const tr = trialById(S, trialId);
  const t = tr ? trialTreatment(tr, treatmentId) : null;
  if (!t) return;
  t.photos = t.photos || [];
  t.photos.splice(idx, 1);
  tr.updatedAt = Date.now();
  saveState(S);
  rerender();
  toast("ลบรูปสรุปแล้ว");
};
App.viewTrialTreatmentPhoto = function (trialId, treatmentId, idx) {
  const tr = trialById(S, trialId);
  const t = tr ? trialTreatment(tr, treatmentId) : null;
  if (!t) return;
  showTaskLightbox(t.photos || [], idx || 0, next => `App.viewTrialTreatmentPhoto('${trialId}', '${treatmentId}', ${next})`);
};

/* ---- ลิงก์แผนที่ Google จากพิกัด GPS (กดแล้วเปิดแผนที่ตำแหน่งแปลงได้เลย) ---- */
function mapLink(lat, lng) {
  return "https://www.google.com/maps?q=" + encodeURIComponent(String(lat)) + "," + encodeURIComponent(String(lng));
}

/* ---- สภาพอากาศรายแปลง (Open-Meteo — ฟรี ไม่ต้องใช้คีย์ ไม่ต้องสมัคร) ---- */
/* แคช 30 นาที เก็บใน localStorage — รีเฟรชหน้าแล้วตัวเลขคงที่ ไม่เปลี่ยนทุกครั้ง */
const WEATHER_TTL = 30 * 60 * 1000;
const WEATHER_STORE = "kaset-weather-cache-v5";
function weatherCacheLoad() {
  try { const raw = localStorage.getItem(WEATHER_STORE); if (raw) return JSON.parse(raw) || {}; } catch (e) {}
  return {};
}
function weatherCacheSave() {
  try { localStorage.setItem(WEATHER_STORE, JSON.stringify(WEATHER_CACHE)); } catch (e) {}
}
let WEATHER_CACHE = weatherCacheLoad();
/* การ์ดสภาพอากาศของแปลง — แสดง loading ก่อน แล้ว renderPlotWeather() ไปดึงข้อมูลจริงมาเติม */
/* การ์ดรูปแปลง — ถ่าย/เลือกรูป เก็บบน R2 (เก็บแค่ URL ในข้อมูล ไม่กินพื้นที่เครื่อง) */
function plotPhotoCard(p) {
  const url = p.photoUrl || "";
  return `
    <div class="section-title">รูปแปลง</div>
    <div class="card">
      ${url ? `<img src="${esc(url)}" alt="รูปแปลง" style="width:100%;border-radius:12px;display:block" loading="lazy" onclick="App.plotPhoto('${p.id}')" title="กดเพื่อเปลี่ยนรูป">`
        : `<div class="muted" style="text-align:center;padding:6px 0;font-size:.78rem">ยังไม่มีรูปแปลง</div>`}
      <div class="row" style="gap:8px;margin-top:8px">
        <button class="btn btn-sm btn-outline" style="flex:1" onclick="App.plotPhoto('${p.id}')">📷 ${url ? "เปลี่ยนรูป" : "เพิ่มรูปแปลง"}</button>
        ${url ? `<button class="btn btn-sm btn-danger-soft" onclick="App.plotPhotoRemove('${p.id}')">${ic("trash")} ลบรูป</button>` : ""}
      </div>
    </div>`;
}
App.plotPhoto = function (id) {
  const p = plotById(S, id); if (!p) return;
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    toast("กำลังอัปโหลดรูป...");
    const url = await App.uploadPhotoR2(f, 1280);
    if (!url) { toast("อัปโหลดไม่สำเร็จ — ต้องล็อกอินและมีอินเทอร์เน็ต"); return; }
    p.photoUrl = url;
    saveState(S); render();
    toast("เพิ่มรูปแปลงแล้ว (เก็บบนคลาวด์)");
  };
  input.click();
};
App.plotPhotoRemove = function (id) {
  const p = plotById(S, id); if (!p || !p.photoUrl) return;
  const url = p.photoUrl;
  p.photoUrl = "";
  saveState(S); render();
  toast("ลบรูปแปลงแล้ว");
  if (url.startsWith("http") && typeof Auth !== "undefined" && Auth.session) authCall("photo_del", { token: Auth.session.token, url }).catch(() => {});
};

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
  const fromMore = route.weatherFrom === "more";
  const backHtml = fromMore
    ? moreBackHeader("สภาพอากาศ", "เทียบพยากรณ์และแผนที่จากแปลง", "")
    : `<div class="row" style="margin-bottom:10px">
      <button class="btn btn-sm btn-ghost" onclick="${route.plotId ? `App.openPlot('${route.plotId}')` : "App.nav('plots')"}">← กลับ</button>
    </div>
    <div class="section-title">${ic("droplet")} สภาพอากาศ · เทียบ 5 สถานีพยากรณ์</div>`;
  return `
    ${backHtml}
    ${plots.length === 0 ? `
      <div class="card"><div class="empty"><div class="e-ico">${ic("pin")}</div><div class="e-title">ยังไม่มีแปลงที่ปักพิกัด GPS</div>
      <div class="muted">เพิ่มหรือแก้ไขแปลง แล้วปักหมุดพิกัด เพื่อดึงพยากรณ์อากาศรายแปลง</div>
      <button class="btn btn-primary btn-block mt-8" onclick="App.nav('plots')">${ic("map")} ไปหน้าแปลง</button></div></div>` : `
      <div class="row" style="gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px">
        ${plots.map(pl => `<button class="btn btn-sm ${pl.id === route.plotId ? "btn-primary" : "btn-outline"}" style="white-space:nowrap" onclick="App.wxPickPlot('${pl.id}')">${cropEmoji(pl.crop)} ${esc(pl.name)}</button>`).join("")}
      </div>
      <div class="card weather-card rain-radar-card" id="rainRadarCard"><div class="weather-loading">📡 กำลังโหลดเรดาร์ฝนใกล้แปลง...</div></div>
      <div class="card weather-card" id="weatherCompare"><div class="weather-loading">⏳ กำลังดึงพยากรณ์จาก 5 สถานี...</div></div>
      <div class="card weather-card" id="weatherCard" style="margin-top:10px"><div class="weather-loading">${ic("pin")} กำลังดึงรายละเอียด 7 วัน...</div></div>`}`;
}
App.wxPickPlot = function (id) { route.plotId = id; render(); };
App.openWeather = function (plotId, from) {
  route.view = "weather";
  route.weatherFrom = from === "more" ? "more" : "";
  if (plotId) route.plotId = plotId;
  render();
};

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
      + (d.prob != null ? `<div class="wx-prob">โอกาส ${d.prob}%</div>` : "")
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
      return `<td><div class="wx-mm ${avgMm >= 1 ? "wx-wet" : ""}">💧 ${fmt1(avgMm)} มม.</div>${avgProb != null ? `<div class="wx-prob">โอกาส ${avgProb}%</div>` : ""}<div class="wx-verdict">${verdict}</div></td>`;
    }).join("");
    const failNote = ok.length < WX_SOURCES.length ? `<div class="weather-updated" style="margin-top:6px">⚠️ ${WX_SOURCES.length - ok.length} สถานีดึงไม่สำเร็จชั่วคราว</div>` : "";
    el.innerHTML = `
      <div class="weather-top">
        <div>
          <div class="weather-loc">📡 เทียบ ${ok.length} สถานีพยากรณ์ · ${esc(p.name)}</div>
          <div class="weather-updated">ฝนสะสมที่คาด (มม.) · โอกาสฝน (%) · อุณหภูมิสูงสุด — อัปเดตทุก 30 นาที</div>
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
var rainRadarMap = null;
var rainRadarLayer = null;
var rainRadarMarker = null;
var rainRadarFrames = [];
var rainRadarFrameIndex = -1;
var RAIN_VIEWER_CACHE = null;
function clearRainRadar() {
  if (rainRadarMap) {
    try { rainRadarMap.remove(); } catch (e) {}
  }
  rainRadarMap = null;
  rainRadarLayer = null;
  rainRadarMarker = null;
  rainRadarFrames = [];
  rainRadarFrameIndex = -1;
}
function rainViewerData() {
  if (RAIN_VIEWER_CACHE && Date.now() - RAIN_VIEWER_CACHE.t < 5 * 60 * 1000) return Promise.resolve(RAIN_VIEWER_CACHE.data);
  return fetch("https://api.rainviewer.com/public/weather-maps.json")
    .then(r => { if (!r.ok) throw new Error("rainviewer " + r.status); return r.json(); })
    .then(data => {
      RAIN_VIEWER_CACHE = { t: Date.now(), data };
      return data;
    });
}
function rainRadarFrameLabel(frame) {
  if (!frame || !frame.time) return "—";
  try {
    return new Date(frame.time * 1000).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "—";
  }
}
function rainRadarShowFrame(idx) {
  if (!rainRadarMap || !rainRadarFrames.length) return;
  rainRadarFrameIndex = Math.max(0, Math.min(idx, rainRadarFrames.length - 1));
  const frame = rainRadarFrames[rainRadarFrameIndex];
  const meta = document.getElementById("rainRadarTime");
  if (meta) meta.textContent = `${rainRadarFrameIndex + 1}/${rainRadarFrames.length} · ${rainRadarFrameLabel(frame)}`;
  if (rainRadarLayer) {
    try { rainRadarMap.removeLayer(rainRadarLayer); } catch (e) {}
    rainRadarLayer = null;
  }
  const host = (RAIN_VIEWER_CACHE && RAIN_VIEWER_CACHE.data && RAIN_VIEWER_CACHE.data.host) || "";
  if (!host || !frame.path) return;
  rainRadarLayer = L.tileLayer(host + frame.path + "/256/{z}/{x}/{y}/2/1_1.png", {
    tileSize: 256,
    opacity: 0.68,
    maxNativeZoom: 7,
    maxZoom: 18,
    attribution: 'Weather radar by <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>'
  }).addTo(rainRadarMap);
}
App.rainRadarFrame = function (step) {
  rainRadarShowFrame(rainRadarFrameIndex + step);
};
App.rainRadarLatest = function () {
  rainRadarShowFrame(rainRadarFrames.length - 1);
};
function renderRainRadar(p) {
  const card = document.getElementById("rainRadarCard");
  if (!card) return;
  clearRainRadar();
  if (!Number(p.lat) || !Number(p.lng)) {
    card.innerHTML = `<div class="weather-note">${ic("pin")} ยังไม่มีพิกัด GPS ของแปลงนี้ จึงเปิดเรดาร์ฝนไม่ได้</div>`;
    return;
  }
  if (typeof L === "undefined") {
    card.innerHTML = `<div class="weather-note">${ic("alert")} โหลดแผนที่ไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</div>`;
    return;
  }
  card.innerHTML = `
    <div class="weather-top">
      <div>
        <div class="weather-loc">📡 เรดาร์ฝนใกล้แปลง ${esc(p.name)}</div>
        <div class="weather-updated">RainViewer · ภาพย้อนหลังราว 2 ชั่วโมง · ใช้ดูแนวฝนประกอบการตัดสินใจ</div>
      </div>
      <span class="rain-radar-time" id="rainRadarTime">กำลังโหลด...</span>
    </div>
    <div class="rain-radar-map" id="rainRadarMap"></div>
    <div class="rain-radar-controls">
      <button type="button" class="btn btn-sm btn-outline" onclick="App.rainRadarFrame(-1)">ย้อน</button>
      <button type="button" class="btn btn-sm btn-primary" onclick="App.rainRadarLatest()">ล่าสุด</button>
      <button type="button" class="btn btn-sm btn-outline" onclick="App.rainRadarFrame(1)">ถัดไป</button>
    </div>
    <div class="rain-radar-source">Weather radar by RainViewer · ข้อมูลเรดาร์อาจขาดหายบางพื้นที่ตามสถานีต้นทาง</div>`;
  rainRadarMap = L.map("rainRadarMap", {
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true
  }).setView([Number(p.lat), Number(p.lng)], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(rainRadarMap);
  rainRadarMarker = L.marker([Number(p.lat), Number(p.lng)]).addTo(rainRadarMap).bindPopup(esc(p.name || "แปลง"));
  setTimeout(() => { if (rainRadarMap) rainRadarMap.invalidateSize(); }, 250);
  rainViewerData()
    .then(data => {
      const radar = (data && data.radar) || {};
      rainRadarFrames = [...(radar.past || []), ...(radar.nowcast || [])].filter(f => f && f.path);
      if (!rainRadarFrames.length) throw new Error("no frames");
      RAIN_VIEWER_CACHE = { t: Date.now(), data };
      rainRadarShowFrame(rainRadarFrames.length - 1);
    })
    .catch(() => {
      const meta = document.getElementById("rainRadarTime");
      if (meta) meta.textContent = "โหลดไม่ได้";
      const src = card.querySelector(".rain-radar-source");
      if (src) src.textContent = "ดึงเรดาร์ฝนไม่ได้ชั่วคราว ตรวจสอบอินเทอร์เน็ตหรือลองใหม่ภายหลัง";
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
function weatherValue(n, suffix) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return fmtNum(Math.round(Number(n) * 10) / 10) + (suffix || "");
}
function currentTimeHHMM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function taskDoneDate(t) {
  return String((t && (t.doneDate || (t.weatherSnapshot && t.weatherSnapshot.targetDate) || t.date)) || todayISO()).slice(0, 10);
}
function taskDoneTime(t) {
  const raw = String((t && (t.doneTime || (t.weatherSnapshot && t.weatherSnapshot.targetTime))) || "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(raw) ? raw : currentTimeHHMM();
}
function weatherTargetIso(date, time) {
  const d = String(date || todayISO()).slice(0, 10);
  const t = /^\d{2}:\d{2}$/.test(String(time || "")) ? String(time).slice(0, 5) : "12:00";
  return d + "T" + t + ":00";
}
function nearestWeatherHour(times, targetIso) {
  if (!Array.isArray(times) || !times.length) return -1;
  const target = new Date(targetIso).getTime();
  let best = -1, bestDiff = Infinity;
  times.forEach((time, i) => {
    const ms = new Date(time).getTime();
    const diff = Math.abs(ms - target);
    if (Number.isFinite(diff) && diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  });
  return best;
}
function taskWeatherRecommended(t) {
  if (!t) return false;
  if (["spray", "fertilize", "water", "inspect", "harvest"].includes(t.type)) return true;
  return /(ฉีด|พ่น|ยา|ปุ๋ย|รดน้ำ|น้ำ|ตรวจ|เก็บเกี่ยว|วัชพืช)/.test(String(t.title || "") + " " + String(t.note || ""));
}
function taskWeatherPlot(t) {
  const p = t && t.plotId ? plotById(S, t.plotId) : null;
  return p && Number(p.lat) && Number(p.lng) ? p : null;
}
async function fetchTaskWeatherSnapshot(p, target) {
  target = target || {};
  const targetDate = String(target.date || todayISO()).slice(0, 10);
  const targetTime = /^\d{2}:\d{2}$/.test(String(target.time || "")) ? String(target.time).slice(0, 5) : currentTimeHHMM();
  const targetIso = weatherTargetIso(targetDate, targetTime);
  const isPastDate = targetDate < todayISO();
  const lat = encodeURIComponent(p.lat);
  const lng = encodeURIComponent(p.lng);
  const hourlyVars = "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m";
  const forecastVars = hourlyVars + ",precipitation_probability";
  const forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
    "&longitude=" + lng +
    "&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m" +
    "&hourly=" + forecastVars +
    "&past_days=7&forecast_days=7&timezone=auto";
  const archiveUrl = "https://archive-api.open-meteo.com/v1/archive?latitude=" + lat +
    "&longitude=" + lng +
    "&start_date=" + encodeURIComponent(targetDate) +
    "&end_date=" + encodeURIComponent(targetDate) +
    "&hourly=" + hourlyVars +
    "&timezone=auto";
  let source = isPastDate ? "Open-Meteo Historical" : "Open-Meteo Forecast";
  let om;
  try {
    om = await fetch(isPastDate ? archiveUrl : forecastUrl).then(r => { if (!r.ok) throw new Error("weather " + r.status); return r.json(); });
  } catch (e) {
    if (!isPastDate) throw e;
    source = "Open-Meteo Forecast";
    om = await fetch(forecastUrl).then(r => { if (!r.ok) throw new Error("weather " + r.status); return r.json(); });
  }
  const c = (om && om.current) || {};
  const h = (om && om.hourly) || {};
  const targetMs = new Date(targetIso).getTime();
  const bestIdx = nearestWeatherHour(h.time || [], targetIso);
  const idx = bestIdx >= 0 ? bestIdx : 0;
  const matchedMs = h.time && h.time[idx] ? new Date(h.time[idx]).getTime() : NaN;
  if (!Number.isFinite(matchedMs) || Math.abs(matchedMs - targetMs) > 90 * 60 * 1000) {
    throw new Error("weather target hour not covered");
  }
  const codeAtTarget = Number((h.weather_code && h.weather_code[idx]) ?? c.weather_code);
  const info = omCodeInfo(codeAtTarget);
  const hourly = (h.time || [])
    .map((time, i) => {
      const code = Number(h.weather_code && h.weather_code[i]);
      const hi = omCodeInfo(code);
      return {
        time,
        hour: String(time || "").slice(11, 16),
        temperature: Number(h.temperature_2m && h.temperature_2m[i]),
        humidity: Number(h.relative_humidity_2m && h.relative_humidity_2m[i]),
        precipitation: Number(h.precipitation && h.precipitation[i]),
        rainProb: h.precipitation_probability && h.precipitation_probability[i] != null ? Number(h.precipitation_probability[i]) : null,
        windSpeed: Number(h.wind_speed_10m && h.wind_speed_10m[i]),
        windDirection: Number(h.wind_direction_10m && h.wind_direction_10m[i]),
        weatherCode: code,
        condition: hi[0],
        icon: hi[1]
      };
    })
    .filter(x => !x.time || new Date(x.time).getTime() >= targetMs)
    .slice(0, 24);
  return {
    source,
    capturedAt: new Date().toISOString(),
    targetDate,
    targetTime,
    targetIso,
    time: (h.time && h.time[idx]) || c.time || "",
    plotId: p.id,
    plotName: p.name || "",
    condition: info[0],
    icon: info[1],
    weatherCode: codeAtTarget,
    temperature: Number((h.temperature_2m && h.temperature_2m[idx]) ?? c.temperature_2m),
    humidity: Number((h.relative_humidity_2m && h.relative_humidity_2m[idx]) ?? c.relative_humidity_2m),
    precipitation: Number((h.precipitation && h.precipitation[idx]) ?? c.precipitation),
    rain: Number((h.rain && h.rain[idx]) ?? c.rain ?? 0),
    rainProb: h.precipitation_probability && h.precipitation_probability[idx] != null ? Number(h.precipitation_probability[idx]) : null,
    windSpeed: Number((h.wind_speed_10m && h.wind_speed_10m[idx]) ?? c.wind_speed_10m),
    windDirection: Number((h.wind_direction_10m && h.wind_direction_10m[idx]) ?? c.wind_direction_10m),
    hourly
  };
}
function weatherSnapshotHtml(wx, compact) {
  if (!wx || typeof wx !== "object") return "";
  if (wx.error) return `<div class="task-weather-ref">${ic("alert")} เคยพยายามดึงสภาพอากาศแล้ว แต่ดึงไม่สำเร็จ</div>`;
  const actualLabel = wx.targetDate ? `${dateLabel(wx.targetDate)} ${wx.targetTime || String(wx.time || "").slice(11, 16)}` : "";
  const captured = wx.time || (wx.capturedAt ? new Date(wx.capturedAt).toLocaleString("th-TH") : "");
  const chips = [
    `${weatherValue(wx.temperature, "°C")}`,
    `ชื้น ${weatherValue(wx.humidity, "%")}`,
    `ฝน ${weatherValue((Number(wx.rain) || Number(wx.precipitation) || 0), " มม.")}`,
    wx.rainProb != null ? `โอกาสฝน ${weatherValue(wx.rainProb, "%")}` : "",
    `ลม ${weatherValue(wx.windSpeed, " m/s")}`
  ].filter(Boolean);
  return `
    <div class="task-weather-ref ${compact ? "compact" : ""}">
      <div class="task-weather-title">${wx.icon || "🌡️"} ${esc(wx.condition || "สภาพอากาศตอนทำงาน")}</div>
      <div class="task-weather-grid">${chips.map(x => `<span>${esc(x)}</span>`).join("")}</div>
      ${!compact && Array.isArray(wx.hourly) && wx.hourly.length ? `
      <div class="task-hourly-title">พยากรณ์รายชั่วโมงหลังบันทึก</div>
      <div class="task-hourly-strip">
        ${wx.hourly.slice(0, 12).map(h => `<div class="task-hourly-cell">
          <b>${esc(h.hour || String(h.time || "").slice(11, 16))}</b>
          <span>${h.icon || "🌡️"} ${weatherValue(h.temperature, "°")}</span>
          <small>${h.rainProb != null ? `โอกาสฝน ${fmtNum(h.rainProb)}%` : `ฝนคาด ${weatherValue(h.precipitation, " มม.")}`}</small>
          <small>ลม ${weatherValue(h.windSpeed, " m/s")}</small>
        </div>`).join("")}
      </div>` : ""}
      <div class="task-weather-source">อ้างอิง ${esc(wx.source || "Open-Meteo")}${wx.plotName ? ` · ${esc(wx.plotName)}` : ""}${actualLabel ? ` · เวลาทำจริง ${esc(actualLabel)}` : (captured ? ` · ${esc(captured)}` : "")}${wx.capturedAt ? ` · บันทึก ${esc(new Date(wx.capturedAt).toLocaleString("th-TH"))}` : ""}</div>
    </div>`;
}
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
    push("warn", ic("alert"), `โอกาสฝนสูงสุด ${best}% ${names} — <b>เลื่อนพ่นยา/ใส่ปุ๋ย</b>ไปหลังฝนผ่าน ประหยัดกว่า (ยาไม่ถูกฝนชะ)`);
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
      push("warn", ic("spray"), `งาน"${name}" (${dayNameISO(t.date)}) มีโอกาสฝน ${pr}% — พิจารณา<b>เลื่อนวัน</b>หรือทำให้เสร็จก่อนฝนตก`);
    } else if (t.type === "harvest" && (pr >= 50 || Number(sums[idx] || 0) >= 10)) {
      push("danger", ic("box"), `กำหนด<b>เก็บเกี่ยว</b>วัน${dayNameISO(t.date)} แต่มีโอกาสฝน ${pr}% (~${fmtNum(sums[idx] || 0)} มม.) — ถ้าผลผลิตพร้อม<b>รีบเก็บก่อนฝน</b> คุณภาพดีกว่า`);
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
  renderRainRadar(p);
  renderWeatherCompare(p); /* การ์ดเทียบหลายสถานี — ดึงขนานกันเอง */
  if (!Number(p.lat) || !Number(p.lng)) return;
  const ckey = p.id + "|" + p.lat + "," + p.lng;
  const hit = WEATHER_CACHE[ckey];
  if (hit && Date.now() - hit.t < WEATHER_TTL) { el.innerHTML = hit.html; fillWeatherAddress(p); return; }
  el.innerHTML = `<div class="weather-loading">${ic("pin")} กำลังดึงสภาพอากาศของ ${esc(p.name)}...</div>`;
  /* Open-Meteo — ฟรี ไม่ต้องใช้คีย์ · best_match = ผสมโมเดลที่ดีที่สุด (มี % ความน่าจะเป็นฝน) 7 วัน */
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.lat + "&longitude=" + p.lng +
    "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
    "&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code" +
    "&forecast_days=7&timezone=auto";
  fetch(url)
    .then(r => { if (!r.ok) throw new Error("om status " + r.status); return r.json(); })
    .then(om => {
      if (!om || !om.current || !om.daily) throw new Error("empty");
      const c = om.current;
      const d = om.daily;
      const h = om.hourly || {};
      const [cond, emoji] = omCodeInfo(c.weather_code);
      /* แสดงทศนิยม 1 ตำแหน่ง (ไม่ปัดเลขทิ้ง — เช่น 31.4°C) */
      const fmt1 = n => (n == null ? "—" : (Math.round(Number(n) * 10) / 10).toFixed(1).replace(/\.0$/, ""));
      const nowMs = c.time ? new Date(c.time).getTime() : Date.now();
      const hours = (h.time || [])
        .map((time, i) => {
          const [hc, he] = omCodeInfo(h.weather_code && h.weather_code[i]);
          return {
            time,
            hour: String(time || "").slice(11, 16),
            temp: h.temperature_2m && h.temperature_2m[i],
            hum: h.relative_humidity_2m && h.relative_humidity_2m[i],
            rain: h.precipitation && h.precipitation[i],
            prob: h.precipitation_probability && h.precipitation_probability[i] != null ? Number(h.precipitation_probability[i]) : null,
            wind: h.wind_speed_10m && h.wind_speed_10m[i],
            cond: hc,
            emoji: he
          };
        })
        .filter(x => !x.time || new Date(x.time).getTime() >= nowMs)
        .slice(0, 12);
      const hourlyHtml = hours.length ? `
      <div class="weather-hourly-title">รายชั่วโมงถัดไป <span>เปอร์เซ็นต์คือโอกาสฝนตามโมเดล ไม่ใช่ฝนตกจริง</span></div>
      <div class="weather-hourly-strip">
        ${hours.map(x => `<div class="weather-hourly-cell">
          <b>${esc(x.hour)}</b>
          <span>${x.emoji} ${fmt1(x.temp)}°</span>
          <small>${x.prob != null ? `โอกาสฝน ${fmtNum(x.prob)}%` : `ฝนคาด ${fmt1(x.rain)} มม.`}</small>
          <small>ลม ${fmt1(x.wind)} m/s</small>
        </div>`).join("")}
      </div>` : "";
      const days = (d.time || []).slice(0, 7).map((day, i) => {
        const [dc, de] = omCodeInfo(d.weather_code[i]);
        const probs = d.precipitation_probability_max || [];
        const pr = probs[i] == null ? null : Number(probs[i]);
        return `<div class="wday">
      <div class="wday-name">${THAI_DAYS[new Date(day + "T12:00:00").getDay()]}</div>
      <div class="wday-emoji">${de}</div>
      <div class="wday-temp">${fmt1(d.temperature_2m_max[i])}°/${fmt1(d.temperature_2m_min[i])}°</div>
      <div class="wday-rain">${pr != null ? "โอกาส " + pr + "%" : "ฝนรวม " + fmt1(d.precipitation_sum[i]) + " มม."}</div>
    </div>`;
      }).join("");
      const timeStr = c.time ? String(c.time).slice(11, 16) : "";
      const html = `
      <div class="weather-top">
        <div>
          <div class="weather-loc">${ic("pin")} ${esc(p.name)}<span class="weather-addr"></span></div>
          <div class="weather-updated">🌍 Open-Meteo · พยากรณ์ตามโมเดล — ข้อมูลล่าสุด ${timeStr} · อัปเดตอัตโนมัติทุก 30 นาที</div>
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
        <span>🌧️ ฝนล่าสุด ${fmt1(c.precipitation)} มม.</span>
        <span>💨 ลม ${fmt1(c.wind_speed_10m)} m/s</span>
      </div>
      ${hourlyHtml}
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
  const tab = ["overview", "cycles", "tasks"].includes(plotDetailTab) ? plotDetailTab : "overview";
  const tabBtn = (key, icon, label, count) => `
    <button class="detail-tab ${tab === key ? "active" : ""}" onclick="App.plotDetailTab('${key}')">
      ${ic(icon)} <span>${label}</span>${count != null ? `<b>${fmtNum(count)}</b>` : ""}
    </button>`;
  const cyclesHtml = `
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
    </div>`;
  const tasksHtml = `
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
  const overviewHtml = `
    ${plotPhotoCard(p)}
    ${plotWeatherCard(p)}
    ${plotWaterZonesCard(p)}
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
    </div>`;
  const content = tab === "cycles" ? cyclesHtml : (tab === "tasks" ? tasksHtml : overviewHtml);
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
        <button class="btn btn-sm btn-outline" onclick="App.modalTrial('${p.id}')">${ic("search")} สร้างแปลงทดลอง</button>
        ${activeCycle ? "" : `<button class="btn btn-sm btn-primary" onclick="App.modalCycle('${p.id}')">${ic("leaf")} เริ่มปลูก</button>`}
        <button class="btn btn-sm btn-primary" onclick="App.modalTask(todayISO(), { plotId: '${p.id}' })">${ic("plus")} เพิ่มกิจกรรม</button>
      </div>
    </div>
    <div class="detail-tabs">
      ${tabBtn("overview", "chart", "ภาพรวม", null)}
      ${tabBtn("cycles", "leaf", "รอบปลูก", cycles.length)}
      ${tabBtn("tasks", "calendar", "กิจกรรม", tasks.length)}
    </div>
    ${content}
    <details class="danger-zone plot-danger-zone">
      <summary>${ic("trash")} จัดการแปลงนี้</summary>
      <div class="muted">ลบเฉพาะเมื่อไม่ต้องใช้แปลงนี้แล้ว รอบปลูกของแปลงนี้จะถูกลบด้วย</div>
      <button class="btn btn-danger-soft btn-block mt-8" onclick="App.deletePlot('${p.id}')">${ic("trash")} ลบแปลงนี้</button>
    </details>`;
}
App.openPlot = function (id) {
  route.view = "plotDetail";
  route.plotId = id;
  plotTaskCycle = "";
  plotDetailTab = "overview";
  render();
};
App.plotDetailTab = function (tab) {
  plotDetailTab = ["overview", "cycles", "tasks"].includes(tab) ? tab : "overview";
  rerender();
};
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
        : dayTasks.some(t => taskStatusOf(t) === "failed") ? "dot-gray"
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
  else if (f.status === "failed") tasks = tasks.filter(t => t.status === "failed");
  else if (f.status === "planned") tasks = tasks.filter(t => t.status !== "done" && t.status !== "failed");
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
  const tab = ["overview", "calendar", "costs", "tasks"].includes(cycleDetailTab) ? cycleDetailTab : "overview";
  const tabBtn = (key, icon, label, count) => `
    <button class="detail-tab ${tab === key ? "active" : ""}" onclick="App.cycleDetailTab('${key}')">
      ${ic(icon)} <span>${label}</span>${count != null ? `<b>${fmtNum(count)}</b>` : ""}
    </button>`;
  const overviewHtml = `
    <div class="section-title">ภาพรวมรอบนี้</div>
    <div class="card cycle-overview-card">
      <div class="meta-grid">
        <div class="meta-box"><div class="lb">แปลง</div><div class="vl" style="font-size:.78rem">${p ? esc(p.name) : "แปลงถูกลบ"}</div></div>
        <div class="meta-box"><div class="lb">วันที่เริ่ม</div><div class="vl">${dateLabel(c.startDate)}</div></div>
        <div class="meta-box"><div class="lb">จำนวนกิจกรรม</div><div class="vl">${fmtNum(allTasks.length)} รายการ</div></div>
        <div class="meta-box"><div class="lb">ต้นทุนที่บันทึก</div><div class="vl">${fmtMoney(totalCost)} บาท</div></div>
      </div>
      <div class="hint" style="margin-top:10px">ใช้แท็บด้านบนเพื่อดูปฏิทิน ต้นทุน หรือรายการกิจกรรมของรอบนี้โดยไม่ต้องเลื่อนยาว</div>
    </div>`;
  const calendarHtml = `
    <div class="section-title">ปฏิทินกิจกรรมของรอบนี้</div>
    ${cycleCalCardHtml(c)}`;
  const costsHtml = `
    <div class="section-title">สรุปต้นทุนรายหมวด ${totalCost > 0 ? `<span class="muted" style="font-size:.75rem;font-weight:600">รวม ${fmtMoney(totalCost)} บาท</span>` : ""}</div>
    <div class="card">
      ${catRows ? `<div class="cc-grid">${catRows}</div>` : `<div class="muted" style="text-align:center;padding:8px">ยังไม่มีต้นทุนในรอบนี้</div>`}
    </div>`;
  const tasksHtml = `
    <div class="section-title">งาน/กิจกรรมของรอบนี้ <span class="muted" style="font-size:.75rem;font-weight:600">${tasks.length === allTasks.length ? allTasks.length : "แสดง " + tasks.length + " จาก " + allTasks.length}</span></div>
    ${allTasks.length === 0 ? `
    <div class="card"><div class="muted" style="text-align:center;padding:8px">ยังไม่มีบันทึกงานในรอบนี้ — กด + เพิ่มกิจกรรม ได้เลย</div></div>` : `
    <div class="card cycf-bar">
      <select class="cycf" onchange="App.cycTaskFilter('sort', this.value)" title="เรียงลำดับ">
        <option value="new" ${f.sort === "new" ? "selected" : ""}>ใหม่ → เก่า</option>
        <option value="old" ${f.sort === "old" ? "selected" : ""}>เก่า → ใหม่</option>
        <option value="cost" ${f.sort === "cost" ? "selected" : ""}>ต้นทุนสูง → ต่ำ</option>
      </select>
      <select class="cycf" onchange="App.cycTaskFilter('type', this.value)" title="กรองประเภท">
        <option value="">ทุกประเภท</option>
        ${[...new Set(allTasks.map(t => t.type))].map(tp => `<option value="${tp}" ${f.type === tp ? "selected" : ""}>${TYPE_LABELS[tp] || tp}</option>`).join("")}
      </select>
      <select class="cycf" onchange="App.cycTaskFilter('status', this.value)" title="กรองสถานะ">
        <option value="" ${!f.status ? "selected" : ""}>ทุกสถานะ</option>
        <option value="planned" ${f.status === "planned" ? "selected" : ""}>ยังไม่เสร็จ</option>
        <option value="failed" ${f.status === "failed" ? "selected" : ""}>ไม่สำเร็จ</option>
        <option value="done" ${f.status === "done" ? "selected" : ""}>เสร็จแล้ว</option>
      </select>
      <label class="cycf-cost"><input type="checkbox" ${f.costOnly ? "checked" : ""} onchange="App.cycTaskFilter('costOnly', this.checked)"> มีค่าใช้จ่าย</label>
      ${(f.sort !== "new" || f.type || f.status || f.costOnly) ? `<button class="btn btn-sm btn-ghost" onclick="App.cycTaskFilter('reset')" title="ล้างตัวกรอง">✕ ล้าง</button>` : ""}
    </div>
    <div class="card">
      ${tasks.length === 0 ? `<div class="muted" style="text-align:center;padding:8px">ไม่มีงานตรงกับตัวกรอง — ลองล้างตัวกรอง</div>` : ""}
      ${tasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true })).join("")}
    </div>`}`;
  const content = tab === "calendar" ? calendarHtml : (tab === "costs" ? costsHtml : (tab === "tasks" ? tasksHtml : overviewHtml));
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
    <div class="detail-tabs detail-tabs-4">
      ${tabBtn("overview", "chart", "ภาพรวม", null)}
      ${tabBtn("calendar", "calendar", "ปฏิทิน", null)}
      ${tabBtn("costs", "dollar", "ต้นทุน", Object.keys(costByCat).length)}
      ${tabBtn("tasks", "check", "กิจกรรม", allTasks.length)}
    </div>
    ${content}`;
}
/* ตั้งค่าตัวกรอง/เรียง "งาน/กิจกรรมของรอบนี้" — re-render หน้าเดิม (ไม่เลื่อนขึ้นหัว) */
App.cycTaskFilter = function (key, val) {
  if (key === "reset") cycTaskFilter = { sort: "new", type: "", status: "", costOnly: false };
  else cycTaskFilter[key] = val;
  rerender();
};
App.openCycle = function (id) {
  route.view = "cycleDetail"; route.cycleId = id;
  cycleDetailTab = "overview";
  /* ปฏิทินรายรอบเริ่มที่เดือนเริ่มปลูกรอบนี้ */
  const c = cycleById(S, id);
  if (c && c.startDate) {
    const d = new Date(c.startDate + "T00:00:00");
    cycleCal = { y: d.getFullYear(), m: d.getMonth(), sel: null };
  }
  render();
};
App.cycleDetailTab = function (tab) {
  cycleDetailTab = ["overview", "calendar", "costs", "tasks"].includes(tab) ? tab : "overview";
  rerender();
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
  App.confirm("ลบแปลงนี้?", "รอบการปลูก งานทดลอง และระบบน้ำของแปลงนี้จะถูกลบด้วย ต้องการดำเนินการต่อหรือไม่?", () => {
    S.plots = S.plots.filter(p => p.id !== id);
    S.cycles = S.cycles.filter(c => c.plotId !== id);
    S.trials = (S.trials || []).filter(tr => tr.plotId !== id);
    saveState(S);
    render();
    toast("ลบแปลงแล้ว");
  });
};
App.toggleTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  if (t.status !== "done") {
    App.modalTaskComplete(id);
    return;
  }
  toggleTaskDone(S, id);
  saveState(S);
  rerender();
  toast(`ยกเลิก: ${t.title}`);
  /* ถ้ากำลังเปิดหน้าต่างรายละเอียดงานนี้อยู่ → อัปเดต modal ทันที (ไม่ต้องปิด-เปิดใหม่) */
  const root = document.getElementById("modalRoot");
  if (root && root.innerHTML.trim() !== "" && root.querySelector(".td-list")) {
    App.viewTask(id);
  }
  /* อัปเดตแผงแจ้งเตือนถ้ากำลังเปิดอยู่ */
  const np = document.getElementById("notifPanel");
  if (np && !np.hidden) renderNotifPanel();
};
App.resetTaskPlanned = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  t.status = "planned";
  if (Array.isArray(t.wateringSessions)) {
    t.wateringSessions = t.wateringSessions.map(w => ({ ...w, status: "planned" }));
  }
  t.updatedAt = Date.now();
  if (S.notifDismissed) delete S.notifDismissed[id];
  saveState(S);
  closeModal();
  rerender();
  toast(`กลับเป็นแผนแล้ว: ${t.title}`);
  const np = document.getElementById("notifPanel");
  if (np && !np.hidden) renderNotifPanel();
};
App.modalTaskComplete = function (id, returnToDetail, resultIntent) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  taskCompleteReturnToDetail = !!returnToDetail;
  taskDonePhotos = taskDonePhotosOf(t).slice();
  const p = t.plotId ? plotById(S, t.plotId) : null;
  const weatherPlot = taskWeatherPlot(t);
  const recommendWeather = taskWeatherRecommended(t);
  const recommendPhoto = taskPhotoRecommended(t);
  const alreadyDone = t.status === "done";
  const alreadyFailed = t.status === "failed";
  const failIntent = resultIntent === "failed" && !alreadyDone;
  const doneDate = (alreadyDone || alreadyFailed) ? taskDoneDate(t) : todayISO();
  const doneTime = (alreadyDone || alreadyFailed) ? taskDoneTime(t) : currentTimeHHMM();
  taskDoneWaterSessions = doneWaterSessionsForTask(t);
  if (failIntent && t.type === "water" && taskDoneWaterSessions.length) {
    taskDoneWaterSessions = taskDoneWaterSessions.map(w => ({ ...w, status: "failed" }));
  }
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic(failIntent || alreadyFailed ? "alert" : "check")} ${alreadyDone ? "แก้ผลหลังทำ" : (alreadyFailed ? "แก้ผลงานไม่สำเร็จ" : (failIntent ? "บันทึกงานไม่สำเร็จ" : "บันทึกผลการทำงาน"))}</h3>
    <div class="modal-sub">${esc(t.title)}${p ? ` · ${esc(p.name)}` : ""}${alreadyDone ? " · งานนี้ทำเสร็จแล้ว" : (alreadyFailed ? " · งานนี้บันทึกว่าไม่สำเร็จ" : (failIntent ? " · เลือกรอบที่ไม่ได้ทำจริงได้" : ""))}</div>
    <div class="task-photo-panel">
      <div class="task-photo-head">
        <div><b>รูปหลังทำ</b><span>ถ่ายหลักฐานหลังตรวจแปลง ฉีดยา ใส่ปุ๋ย หรือเก็บเกี่ยว</span></div>
        <button type="button" class="btn btn-sm btn-outline" onclick="App.taskPickPhotos('done')">${ic("camera")} เพิ่มรูป</button>
      </div>
      <div id="taskDonePhotoPreview">${taskPhotoPreviewHtml(taskDonePhotos, "done")}</div>
    </div>
    ${recommendPhoto ? `<div class="task-photo-reminder">${ic("camera")} งาน${esc(TYPE_LABELS[t.type] || "นี้")}แนะนำให้แนบรูปหลังทำไว้เป็นหลักฐาน</div>` : ""}
    <div id="taskWaterResultMount">${taskDoneWaterSessionsHtml()}</div>
    <div class="field">
      <label>หมายเหตุหลังทำ</label>
      <textarea id="tdone_note" rows="3" placeholder="เช่น พบเพลี้ยเล็กน้อย ฉีดตามอัตราแล้ว / ดินยังชื้นดี">${esc(t.doneNote || "")}</textarea>
    </div>
    <div class="form-row-2">
      <div class="field"><label>วันที่ทำจริง *</label><input id="tdone_date" type="date" value="${esc(doneDate)}" required></div>
      <div class="field"><label>เวลาที่ทำจริง</label><input id="tdone_time" type="time" value="${esc(doneTime)}"></div>
    </div>
    ${recommendWeather ? `
    <div class="task-weather-panel">
      <label class="option-box inline-option"><input type="checkbox" id="tdone_weather" ${weatherPlot ? "checked" : ""} ${weatherPlot ? "" : "disabled"}><span>${ic("droplet")} บันทึกสภาพอากาศตอนทำงาน</span></label>
      <div class="hint">${weatherPlot ? `ดึงจากพิกัดแปลง ${esc(weatherPlot.name)} ตามวันที่/เวลาที่ทำจริงด้านบน ถ้ากรอกย้อนหลัง ระบบจะใช้อากาศย้อนหลังรายชั่วโมง` : "งานนี้ยังไม่มีพิกัดแปลง จึงยังดึงสภาพอากาศอัตโนมัติไม่ได้"}</div>
      ${t.weatherSnapshot ? weatherSnapshotHtml(t.weatherSnapshot, true) : ""}
    </div>` : ""}
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button type="button" class="btn btn-danger-soft" onclick="App.failTask('${id}')">${ic("alert")} ${alreadyFailed || failIntent ? "บันทึกไม่สำเร็จ" : "งานไม่สำเร็จ"}</button>
      <button type="button" class="btn btn-outline" onclick="App.finishTask('${id}', true)">${alreadyDone ? "บันทึกโดยไม่แนบรูป" : "ทำเสร็จโดยไม่แนบรูป"}</button>
      <button type="button" class="btn btn-primary" onclick="App.finishTask('${id}', false)">${ic("check")} ${alreadyDone ? "บันทึกผลหลังทำ" : "บันทึกผล"}</button>
    </div>`);
};
App.finishTask = async function (id, allowNoPhoto) {
  if (taskPhotoUploading.done) { toast("รอเพิ่มรูปให้เสร็จก่อน"); return; }
  if (taskFinishSaving) { toast("กำลังบันทึกผลอยู่..."); return; }
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  if (taskPhotoRecommended(t) && !allowNoPhoto && !taskDonePhotos.length) {
    const panel = document.querySelector(".task-photo-panel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    toast(`งาน${TYPE_LABELS[t.type] || "นี้"}แนะนำให้แนบรูปหลังทำ หรือกดทำเสร็จโดยไม่แนบรูป`);
    return;
  }
  taskFinishSaving = true;
  t.status = "done";
  if (t.type === "water" && taskDoneWaterSessions.length) {
    t.wateringSessions = normalizeTaskWaterSessions(taskDoneWaterSessions.map(w => ({ ...w, status: w.status || "done" })));
  }
  t.donePhotos = taskDonePhotos.slice();
  t.doneNote = (document.getElementById("tdone_note")?.value || "").trim();
  const doneDateInput = document.getElementById("tdone_date");
  const doneTimeInput = document.getElementById("tdone_time");
  const doneDate = (doneDateInput?.value || todayISO()).slice(0, 10);
  const doneTime = (doneTimeInput?.value || currentTimeHHMM()).slice(0, 5);
  if (!doneDate) {
    taskFinishSaving = false;
    if (doneDateInput) setModalFieldError(doneDateInput, "กรุณาเลือกวันที่ทำจริง");
    return;
  }
  t.doneDate = doneDate;
  t.doneTime = doneTime;
  const weatherCheck = document.getElementById("tdone_weather");
  const weatherPlot = taskWeatherPlot(t);
  if (weatherCheck && weatherCheck.checked && weatherPlot) {
    toast(`กำลังดึงสภาพอากาศ ${dateLabel(doneDate)} ${doneTime}...`);
    try {
      t.weatherSnapshot = await fetchTaskWeatherSnapshot(weatherPlot, { date: doneDate, time: doneTime });
    } catch (e) {
      console.warn("weather snapshot failed", e);
      toast("บันทึกงานได้ แต่อากาศดึงไม่สำเร็จ");
    }
  }
  t.updatedAt = Date.now();
  if (S.notifDismissed) delete S.notifDismissed[id];
  saveState(S);
  closeModal();
  rerender();
  if (taskCompleteReturnToDetail) App.viewTask(id);
  taskCompleteReturnToDetail = false;
  const n = taskAllPhotos(t).length;
  toast(n ? `บันทึกแล้ว · รูปรวม ${fmtNum(n)} รูป` : `บันทึกแล้ว: ${t.title}`);
  const np = document.getElementById("notifPanel");
  if (np && !np.hidden) renderNotifPanel();
  taskFinishSaving = false;
};
App.failTask = async function (id) {
  if (taskPhotoUploading.done) { toast("รอเพิ่มรูปให้เสร็จก่อน"); return; }
  if (taskFinishSaving) { toast("กำลังบันทึกผลอยู่..."); return; }
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  taskFinishSaving = true;
  const doneDateInput = document.getElementById("tdone_date");
  const doneTimeInput = document.getElementById("tdone_time");
  const doneDate = (doneDateInput?.value || todayISO()).slice(0, 10);
  const doneTime = (doneTimeInput?.value || currentTimeHHMM()).slice(0, 5);
  if (!doneDate) {
    taskFinishSaving = false;
    if (doneDateInput) setModalFieldError(doneDateInput, "กรุณาเลือกวันที่บันทึกผล");
    return;
  }
  t.status = "failed";
  if (t.type === "water") {
    const rows = taskDoneWaterSessions.length ? taskDoneWaterSessions : doneWaterSessionsForTask(t);
    const allDefaultDone = rows.length && rows.every(w => w.status === "done");
    t.wateringSessions = normalizeTaskWaterSessions(rows.map(w => ({
      ...w,
      status: allDefaultDone ? "failed" : (w.status || "failed")
    })));
  }
  t.donePhotos = taskDonePhotos.slice();
  t.doneNote = (document.getElementById("tdone_note")?.value || "").trim();
  t.doneDate = doneDate;
  t.doneTime = doneTime;
  t.updatedAt = Date.now();
  if (S.notifDismissed) delete S.notifDismissed[id];
  saveState(S);
  closeModal();
  rerender();
  if (taskCompleteReturnToDetail) App.viewTask(id);
  taskCompleteReturnToDetail = false;
  toast(`บันทึกว่าไม่สำเร็จ: ${t.title}`);
  const np = document.getElementById("notifPanel");
  if (np && !np.hidden) renderNotifPanel();
  taskFinishSaving = false;
};
App.modalTaskWeatherBackfill = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const p = taskWeatherPlot(t);
  if (!p) { toast("กิจกรรมนี้ยังไม่มีพิกัดแปลง จึงดึงอากาศไม่ได้"); return; }
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("droplet")} บันทึกอากาศย้อนหลัง</h3>
    <div class="modal-sub">${esc(t.title)} · ดึงตามเวลาที่ทำจริง ไม่ใช่เวลาที่กดบันทึก</div>
    <div class="form-row-2">
      <div class="field"><label>วันที่ทำจริง *</label><input id="twx_date" type="date" value="${esc(taskDoneDate(t))}" required></div>
      <div class="field"><label>เวลาที่ทำจริง</label><input id="twx_time" type="time" value="${esc(taskDoneTime(t))}"></div>
    </div>
    <div class="hint">ถ้าเป็นย้อนหลังใกล้ๆ ระบบใช้ข้อมูลรายชั่วโมงย้อนหลัง ถ้าเก่ากว่านั้นจะลองใช้ข้อมูล Historical ของ Open-Meteo</div>
    ${t.weatherSnapshot ? weatherSnapshotHtml(t.weatherSnapshot, true) : ""}
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button type="button" class="btn btn-primary" onclick="App.saveTaskWeatherBackfill('${id}')">${ic("save")} บันทึกอากาศ</button>
    </div>`);
};
App.saveTaskWeatherBackfill = async function (id) {
  if (taskFinishSaving) { toast("กำลังดึงสภาพอากาศอยู่..."); return; }
  const t = S.tasks.find(x => x.id === id);
  const p = t ? taskWeatherPlot(t) : null;
  if (!t || !p) return;
  const dateInput = document.getElementById("twx_date");
  const timeInput = document.getElementById("twx_time");
  const doneDate = (dateInput?.value || "").slice(0, 10);
  const doneTime = (timeInput?.value || currentTimeHHMM()).slice(0, 5);
  if (!doneDate) {
    if (dateInput) setModalFieldError(dateInput, "กรุณาเลือกวันที่ทำจริง");
    return;
  }
  taskFinishSaving = true;
  toast(`กำลังดึงสภาพอากาศ ${dateLabel(doneDate)} ${doneTime}...`);
  try {
    t.doneDate = doneDate;
    t.doneTime = doneTime;
    t.weatherSnapshot = await fetchTaskWeatherSnapshot(p, { date: doneDate, time: doneTime });
    t.updatedAt = Date.now();
    saveState(S);
    closeModal();
    rerender();
    App.viewTask(id);
    toast("บันทึกสภาพอากาศย้อนหลังแล้ว");
  } catch (e) {
    console.warn("weather backfill failed", e);
    toast("ดึงอากาศย้อนหลังไม่สำเร็จ — ลองเลือกเวลาใกล้เคียงหรือเช็กอินเทอร์เน็ต");
  } finally {
    taskFinishSaving = false;
  }
};

/* ---------------- Planner / calendar ---------------- */
function renderPlanner() {
  const { sel } = cal;
  const selTasks = sel ? tasksOn(S, sel).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0)) : [];
  const today = todayISO();
  const weekEnd = addDaysISO(today, 6);
  const pending = t => t.status !== "done" && t.status !== "failed";
  const counts = {
    today: S.tasks.filter(t => t.date === today && pending(t)).length,
    week: S.tasks.filter(t => t.date >= today && t.date <= weekEnd && pending(t)).length,
    overdue: S.tasks.filter(t => taskStatusOf(t) === "overdue").length,
    failed: S.tasks.filter(t => t.status === "failed").length,
    done: S.tasks.filter(t => t.status === "done").length
  };
  const modes = {
    today: { label: "วันนี้", hint: "งานที่ต้องจัดการในวันนี้", ico: "calendar" },
    week: { label: "สัปดาห์นี้", hint: "งานที่ยังไม่เสร็จใน 7 วันข้างหน้า", ico: "leaf" },
    overdue: { label: "เลยกำหนด", hint: "งานค้างที่ควรเคลียร์ก่อน", ico: "alert" },
    failed: { label: "ไม่สำเร็จ", hint: "งานที่บันทึกว่าไม่ได้ทำหรือทำไม่ครบ", ico: "alert" },
    done: { label: "เสร็จแล้ว", hint: "ประวัติงานที่ปิดงานแล้ว", ico: "check" }
  };
  const mode = modes[plannerFilter] ? plannerFilter : "today";
  const plannerItems = S.tasks.filter(t => {
    if (mode === "today") return t.date === today && pending(t);
    if (mode === "week") return t.date >= today && t.date <= weekEnd && pending(t);
    if (mode === "overdue") return taskStatusOf(t) === "overdue";
    if (mode === "failed") return t.status === "failed";
    if (mode === "done") return t.status === "done";
    return false;
  }).sort((a, b) => {
    if (mode === "done") return b.date.localeCompare(a.date);
    if (mode === "overdue") return a.date.localeCompare(b.date);
    if (mode === "failed") return b.date.localeCompare(a.date);
    return a.date.localeCompare(b.date);
  });
  const filterBtn = (key, count) => `
    <button class="planner-filter ${mode === key ? "active" : ""}" onclick="App.plannerFilter('${key}')">
      ${ic(modes[key].ico)} <span>${modes[key].label}</span><b>${fmtNum(count)}</b>
    </button>`;

  return `
    <div class="row row-between section-title">
      <span data-tkey="plannerTitle">${T("plannerTitle")}</span>
      <button class="btn btn-primary btn-sm" onclick="App.modalTask('${today}')">${ic("plus")} เพิ่มกิจกรรม</button>
    </div>
    <div class="planner-filters">
      ${filterBtn("today", counts.today)}
      ${filterBtn("week", counts.week)}
      ${filterBtn("overdue", counts.overdue)}
      ${filterBtn("failed", counts.failed)}
      ${filterBtn("done", counts.done)}
    </div>
    <div class="card planner-list-card">
      <div class="planner-list-head">
        <div>
          <div class="bold">${modes[mode].label}</div>
          <div class="muted">${modes[mode].hint}</div>
        </div>
        <span class="badge ${mode === "overdue" || mode === "failed" ? "badge-red" : "badge-green"}">${fmtNum(plannerItems.length)} งาน</span>
      </div>
      ${plannerItems.length === 0 ? `<div class="empty compact-empty"><div class="e-ico">${ic(mode === "done" ? "check" : "calendar")}</div><div class="e-title">${mode === "overdue" ? "ไม่มีงานเลยกำหนด" : (mode === "failed" ? "ยังไม่มีงานไม่สำเร็จ" : (mode === "done" ? "ยังไม่มีงานที่เสร็จแล้ว" : "ไม่มีงานในช่วงนี้"))}</div><div class="muted">กดเพิ่มกิจกรรมเมื่อต้องวางแผนงานใหม่</div></div>` : ""}
      ${plannerItems.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true, showPlot: true })).join("")}
    </div>
    <details class="planner-calendar-panel">
      <summary>${ic("calendar")} ปฏิทินเต็ม <span>${sel ? dateLabel(sel) : "เลือกวันที่เพื่อดูงาน"}</span></summary>
      ${calCardHtml()}
      <div class="card">
        <div class="row row-between" style="margin-bottom:8px">
          <div class="bold">${sel ? `${T("plannerTitle")} ${dateLabel(sel)}` : "กดวันที่เพื่อดูงาน"}</div>
          ${sel ? `<button class="btn btn-primary btn-sm" onclick="App.modalTask('${sel}')">${ic("plus")} เพิ่มกิจกรรม</button>` : ""}
        </div>
        ${!sel ? `<div class="muted" style="text-align:center;padding:10px">เลือกวันที่ในปฏิทินด้านบน</div>` : ""}
        ${selTasks.length === 0 && sel ? `<div class="empty compact-empty"><div class="e-ico">${ic("calendar")}</div><div class="e-title">ไม่มีงานในวันนี้</div><div class="muted">กด + เพิ่มกิจกรรม เพื่อวางแผน</div></div>` : ""}
        ${selTasks.map(t => taskRowHtml(t, { showDate: true, showNote: true, showDelete: true, showPlot: true })).join("")}
      </div>
    </details>
    <div class="muted" style="font-size:.72rem;text-align:center">${ic("refresh")} เมื่อบันทึกงานที่ใช้วัสดุ (เช่น ใส่ปุ๋ย) ระบบจะตัดสต็อกและบันทึกต้นทุนเข้าสู่รอบปลูกทันที</div>`;
}
App.plannerFilter = function (key) {
  plannerFilter = key || "today";
  rerender();
};
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
  const overdueTasks = S.tasks.filter(t => taskStatusOf(t) === "overdue").sort((a, b) => a.date.localeCompare(b.date));
  const weekEnd = addDaysISO(todayISO(), 6);
  const weekTasks = S.tasks.filter(t => t.status !== "done" && t.date >= todayISO() && t.date <= weekEnd);
  const outStock = (S.stock || []).filter(x => (Number(x.qty) || 0) + (Number(x.openQty) || 0) <= 0);
  const lowStock = (S.stock || [])
    .map(x => ({ ...x, avail: (Number(x.qty) || 0) + (Number(x.openQty) || 0) }))
    .filter(x => x.avail > 0 && x.avail <= 5)
    .sort((a, b) => a.avail - b.avail);
  const bestPlot = plotRows[0] || null;
  const weakPlot = [...plotRows].reverse().find(p => p.net < 0) || null;
  const bestCrop = [...crops].filter(c => c.revenue > 0).sort((a, b) => b.margin - a.margin)[0] || null;
  const insightItems = [
    overdueTasks.length ? { icon: "alert", tone: "red", title: `${fmtNum(overdueTasks.length)} งานเลยกำหนด`, sub: "ควรเคลียร์ก่อนเริ่มงานใหม่", action: "App.nav('planner')" } : { icon: "check", tone: "green", title: "ไม่มีงานเลยกำหนด", sub: "ตารางงานสะอาดดี", action: "App.nav('planner')" },
    outStock.length ? { icon: "box", tone: "red", title: `${fmtNum(outStock.length)} รายการสต็อกหมด`, sub: outStock.slice(0, 2).map(x => x.name).join(" · "), action: "App.nav('stock')" } : { icon: "box", tone: "green", title: "ไม่มีสต็อกหมด", sub: lowStock.length ? `${fmtNum(lowStock.length)} รายการใกล้หมด` : "จำนวนคงเหลือยังดูดี", action: "App.nav('stock')" },
    weakPlot ? { icon: "chart", tone: "amber", title: `แปลงขาดทุน: ${weakPlot.name}`, sub: `${fmtMoney(weakPlot.net)} บาท ในพ.ศ. ${beYr}`, action: `App.openPlot('${weakPlot.plotId}')` } : { icon: "chart", tone: "green", title: bestPlot ? `แปลงเด่น: ${bestPlot.name}` : "ยังไม่มีข้อมูลกำไรแปลง", sub: bestPlot ? `กำไร ${fmtMoney(bestPlot.net)} บาท` : "บันทึกงาน/ขายเพื่อเริ่มวิเคราะห์", action: bestPlot ? `App.openPlot('${bestPlot.plotId}')` : "App.nav('planner')" },
    bestCrop ? { icon: "leaf", tone: "blue", title: `พืชมาร์จินดี: ${bestCrop.crop}`, sub: `Margin ${fmtNum(bestCrop.margin)}%`, action: "App.analyticsTab('farm')" } : { icon: "leaf", tone: "blue", title: "รอข้อมูลพืช", sub: "เมื่อมีรายได้และต้นทุนจะจัดอันดับให้", action: "App.nav('plots')" }
  ];
  const analyticsBrief = `
    <div class="analytics-brief">
      <button class="analytics-brief-card" onclick="App.nav('planner')">
        <b>${fmtNum(weekTasks.length)}</b><span>งาน 7 วัน</span><small>${overdueTasks.length ? `${fmtNum(overdueTasks.length)} งานค้าง` : "ไม่มีงานค้าง"}</small>
      </button>
      <button class="analytics-brief-card" onclick="App.nav('stock')">
        <b>${fmtNum(outStock.length)}</b><span>สต็อกหมด</span><small>${lowStock.length ? `${fmtNum(lowStock.length)} ใกล้หมด` : "คงเหลือปกติ"}</small>
      </button>
      <button class="analytics-brief-card" onclick="App.analyticsTab('farm')">
        <b>${fmtMoney(ytd.net)}</b><span>กำไรฟาร์ม</span><small>Margin ${ytd.margin.toFixed(1)}%</small>
      </button>
      <button class="analytics-brief-card" onclick="App.analyticsTab('shop')">
        <b>${fmtMoney(salesProfitYTD(S, yr))}</b><span>กำไรร้าน</span><small>${salesYearCount(S, yr)} ใบเสร็จ</small>
      </button>
    </div>
    <div class="analytics-insights">
      ${insightItems.map(it => `
        <button class="analytics-insight ${it.tone}" onclick="${it.action}">
          <span class="action-ico">${ic(it.icon)}</span>
          <span><b>${esc(it.title)}</b><small>${esc(it.sub || "")}</small></span>
          <span class="more-chevron">${ic("chevron")}</span>
        </button>`).join("")}
    </div>`;
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
    ${analyticsBrief}
    <div class="tabs">
      <button class="${tab === "farm" ? "active" : ""}" onclick="App.analyticsTab('farm')">${ic("leaf")} ฟาร์ม (แปลง)</button>
      <button class="${tab === "shop" ? "active" : ""}" onclick="App.analyticsTab('shop')">${ic("dollar")} ร้านค้า</button>
    </div>
    ${tab === "shop" ? shopHtml : farmHtml}`;
}
App.analyticsTab = function (tab) { route.tab = tab; render(); };
App.goShopAnalytics = function () { route.view = "analytics"; route.tab = "shop"; render(); };
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
    ${moreBackHeader(`${T("equipmentTitle")} (${S.equipment.length})`, "ค่าเสื่อม ซ่อมบำรุง และมูลค่าเครื่องจักร", `<button class="btn btn-primary btn-sm" onclick="App.modalEquipment()">＋ เพิ่มอุปกรณ์</button>`, "equipmentTitle")}
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
      <button class="btn btn-sm btn-outline" onclick="App.modalWaterNow('${sys.id}')">${ic("save")} บันทึกการให้น้ำ</button>
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
  /* Phase 1 dashboard is telemetry-only. Legacy planning/editing markup below is
     intentionally kept in source for later migration, but is not rendered here. */
  return typeof FarmMapDashboard !== "undefined"
    ? FarmMapDashboard.cardHtml()
    : typeof SensorTelemetry !== "undefined"
    ? SensorTelemetry.cardHtml()
    : `<section class="sensor-digital-twin"><div class="digital-alert" role="alert">โมดูลข้อมูลเซนเซอร์ยังไม่พร้อม</div></section>`;

  /* c8 ignore start -- legacy water-planning UI, unreachable during SAFE_OFF */
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
        <span class="badge badge-gray">ควบคุมถูกปิด</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${sys.auto && sys.auto.enabled ? `<span class="badge badge-blue">${ic("clock")} อัตโนมัติ ทุก ${sys.auto.everyDays} วัน · ${sys.auto.time} · ${sys.auto.minutes} นาที</span>` : `<span class="badge badge-gray">ให้น้ำด้วยมือ</span>`}
        ${due ? `<span class="badge badge-amber">${ic("droplet")} ถึงรอบให้น้ำแล้ว</span>` : next ? `<span class="badge badge-green">ครั้งถัดไป ${dateLabel(next)}</span>` : ""}
      </div>
      <div class="muted" data-wnote="${esc(sys.id)}" style="font-size:.7rem;color:var(--amber-text);margin-top:4px;min-height:0"></div>
      <div class="row row-between mt-8">
        <div class="muted" style="font-size:.72rem">ให้น้ำล่าสุด: ${sys.lastWatered ? dateLabel(sys.lastWatered) : "ยังไม่เคย"}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-outline" onclick="App.modalWaterNow('${sys.id}')">${ic("save")} บันทึกการให้น้ำ</button>
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
    ${moreBackHeader(T("iotTitle"), "วาล์ว ตารางให้น้ำ และอุปกรณ์ IoT", `<button class="btn btn-outline btn-sm" onclick="App.modalWaterSystem()">${ic("plus")} เพิ่มระบบน้ำ</button>`, "iotTitle")}
    <div class="card" style="background:linear-gradient(135deg,#1d4ed8,#172554);color:#fff;border:none">
      <div class="row">
        <span style="font-size:2rem;color:#fff">${ic("droplet")}</span>
        <div class="grow">
          <div class="bold" style="font-size:1rem">ระบบน้ำและเซนเซอร์ภาคสนาม</div>
          <div style="font-size:.76rem;opacity:.85">Phase 1 อ่านข้อมูลจริงจาก Pi 5 · บันทึกงานให้น้ำ · เอาต์พุตทุกช่องยัง SAFE_OFF</div>
        </div>
      </div>
    </div>

    ${typeof SensorTelemetry !== "undefined" ? SensorTelemetry.cardHtml() : ""}

    <div class="row row-between iot-section-head">
      <div class="bold" style="font-size:1.02rem" data-tkey="iotTitle">${T("iotTitle")} (${W.systems.length})</div>
      <button class="btn btn-primary btn-sm" onclick="App.modalWaterSystem()">${ic("plus")} เพิ่มระบบน้ำให้แปลง</button>
    </div>
    ${W.systems.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("droplet")}</div><div class="e-title">ยังไม่มีระบบน้ำ</div><div class="muted">เลือกแปลง ตั้งปั๊ม และกำหนดตารางให้น้ำได้จากปุ่มด้านบน</div></div></div>` : ""}
    <div class="card-grid">${sysCards}</div>

    <div class="row row-between iot-section-head">
      <div class="bold" style="font-size:1.02rem">แหล่งน้ำ (${W.sources.length})</div>
      <button class="btn btn-outline btn-sm" onclick="App.modalWaterSource()">${ic("plus")} เพิ่มแหล่งน้ำ</button>
    </div>
    ${W.sources.length === 0 ? `<div class="card"><div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีแหล่งน้ำ — เพิ่มบ่อ/บาดาล/ประปา เพื่อบันทึกระดับน้ำ</div></div>` : `<div class="card-grid">${srcCards}</div>`}

    <div class="section-title">${ic("clock")} บันทึกการให้น้ำล่าสุด</div>
    <div class="card">
      ${logs.length === 0 ? `<div class="muted" style="text-align:center;padding:8px;font-size:.8rem">ยังไม่มีบันทึก — กด "ให้น้ำตอนนี้" ที่การ์ดแปลงเพื่อบันทึก</div>` : logRows}
    </div>

    <div class="section-title">${ic("lock")} ขอบเขตความปลอดภัย Phase 1</div>
    <div class="card sensor-control-lock">
      <div class="bold">เอาต์พุตถูกปิดทั้งหน้าเว็บและ Worker</div>
      <div class="muted mt-8" style="font-size:.76rem">ระบบนี้รับและแสดงข้อมูลจาก Pi 5 เท่านั้น ไม่ออก Device Key สำหรับ ESP32 และไม่ส่งคำสั่งเปิดปั๊มหรือวาล์ว การควบคุมจริงจะทำภายใต้ Pi 5 single-writer หลังผ่าน commissioning แยกต่างหาก</div>
    </div>`;
}

App.refreshMainWaterSensor = function () {
  if (typeof SensorTelemetry !== "undefined") SensorTelemetry.refresh(true);
};
App.setSensorHistoryHours = function (hours) {
  if (typeof SensorTelemetry !== "undefined") SensorTelemetry.setHours(hours);
};

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
  if (SENSOR_PHASE1_READ_ONLY) { toast("Phase 1 อ่านข้อมูลเท่านั้น — เอาต์พุตยัง SAFE_OFF"); return; }
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
  if (SENSOR_PHASE1_READ_ONLY) { toast("Phase 1 ไม่ส่งตารางควบคุมขึ้นเซิร์ฟเวอร์"); return; }
  if (typeof Auth === "undefined" || !Auth.session) return;
  toast("กำลังซิงก์ระบบน้ำขึ้นเซิร์ฟเวอร์...");
  const r = await Auth.waterSync();
  toast(r && r.ok ? "ซิงก์เซิร์ฟเวอร์แล้ว ✓ — ตารางอัตโนมัติทำงานแม้ปิดแอป" : "ซิงก์ไม่สำเร็จ: " + ((r && r.error) || ""));
};

App.waterAddDevice = async function () {
  if (SENSOR_PHASE1_READ_ONLY) { toast("Phase 1 ปิดการออก Device Key สำหรับควบคุม"); return; }
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
    <div class="field"><label>URL API ที่อุปกรณ์ใช้ (POST)</label><input readonly value="${esc(FarmUltimateRuntime.apiUrl)}" onclick="this.select()"></div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="App.copyText('${esc(key)}')">${ic("save")} คัดลอก Key</button>
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
App.waterListDevices = async function () {
  if (SENSOR_PHASE1_READ_ONLY) { toast("Phase 1 ปิดระบบอุปกรณ์ควบคุม"); return; }
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
    <h3>${ic("droplet")} ${sys ? "แก้ไขระบบน้ำ" : "เพิ่มระบบน้ำ"}</h3>
    <div class="field"><label>แปลง *</label><select id="ws_plot">${opt(S.plots, sys ? sys.plotId : (S.plots[0] || {}).id)}</select></div>
    <div class="field"><label>ชื่อระบบ</label><input id="ws_name" placeholder="เช่น ระบบสปริงเกลอร์ / ระบบน้ำหยด" value="${esc(sys ? sys.name : "")}"></div>
    <div class="field"><label>แหล่งน้ำ</label><select id="ws_source"><option value="">— ไม่ระบุ —</option>${opt(W.sources, sys ? sys.sourceId : "")}</select></div>
    <div class="field"><label>ชื่อปั๊มน้ำ</label><input id="ws_pump" placeholder="เช่น ปั๊ม 1.5 HP" value="${esc(sys ? sys.pumpName || "" : "")}"></div>
    <div class="field"><label>จำนวนวาล์ว/โซน</label><input id="ws_valves" type="number" min="0" value="${sys ? sys.valveCount || 0 : 1}"></div>
    <div class="field"><label><input type="checkbox" id="ws_auto" ${sys && sys.auto && sys.auto.enabled ? "checked" : ""} style="width:auto;margin-right:6px">เปิดตารางให้น้ำอัตโนมัติ</label></div>
    <div class="water-schedule-row">
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
    <div class="water-duo-row">
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
    <div class="water-duo-row">
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
/* ===== ข้อมูล flat สำหรับราคาตลาด (ใช้ร่วมกันทุก view) ===== */
function priceFlatRows(cached) {
  const rows = [];
  (cached.products || []).forEach(p => {
    (p.markets || []).forEach(m => {
      rows.push({ product: p.product, category: p.category, market: m.market, province: m.province || "", price: Number(m.price) || 0, unit: p.unit, min: p.min, max: p.max, date: p.date, change: Number(m.change) || 0, status: m.status || "stable" });
    });
  });
  return rows;
}
function priceFilterRows(rows, searchKey, catFilter) {
  return rows.filter(r => {
    if (searchKey && !(r.product.toLowerCase().includes(searchKey.toLowerCase()) || r.market.toLowerCase().includes(searchKey.toLowerCase()))) return false;
    if (catFilter && r.category !== catFilter) return false;
    return true;
  });
}

/* ===== card grid ราคา (อัปเดตเฉพาะจุด = focus ไม่หลุด) แบบ kasetpoomjai ===== */
function priceTableHtml() {
  const cached = App._marketPrices;
  if (!cached) return "";
  const searchKey = App._priceSearch || "";
  const catFilter = App._priceCat || "";
  const rows = priceFilterRows(priceFlatRows(cached), searchKey, catFilter);
  if (!rows.length) return `<div class="card" style="text-align:center;padding:32px 20px"><div class="muted" style="font-size:.88rem">${ic("search")} ไม่พบสินค้าที่ตรงกับเงื่อนไข<br><span style="font-size:.76rem">กรุณาลองเปลี่ยนตลาดหรือคำค้นหาของคุณ</span></div></div>`;

  /* จัดกลุ่มตามสินค้า เพื่อรวมหลายตลาดในการ์ดเดียว */
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.product]) grouped[r.product] = { product: r.product, category: r.category, unit: r.unit, markets: [] };
    grouped[r.product].markets.push(r);
  });
  const items = Object.values(grouped).sort((a, b) => a.product.localeCompare(b.product, "th"));

  const cards = items.map(g => {
    const marketRows = g.markets.map(m => {
      const priceStr = m.min === m.max ? fmtNum(m.min) : `${fmtNum(m.min)}-${fmtNum(m.max)}`;
      const changeBadge = m.status === "up"
        ? `<span style="color:var(--green);font-weight:700;font-size:.82rem;white-space:nowrap">▲ ${m.change > 0 ? fmtNum(m.change) : ""}</span>`
        : m.status === "down"
        ? `<span style="color:var(--red);font-weight:700;font-size:.82rem;white-space:nowrap">▼ ${m.change > 0 ? fmtNum(m.change) : ""}</span>`
        : `<span style="color:var(--muted);font-size:.76rem;white-space:nowrap">—</span>`;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;${g.markets.length > 1 ? "border-top:1px solid var(--line);" : ""}">
          <div style="min-width:0">
            <div style="font-size:.75rem;color:var(--muted);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.market)}</div>
            <div style="font-size:.72rem;color:var(--muted2,var(--muted));margin-top:1px">${dateLabel(m.date)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
            <div style="text-align:right">
              <span style="font-weight:800;font-size:1rem;color:var(--green-deep)">${priceStr}</span>
              <span style="font-size:.72rem;color:var(--muted);margin-left:2px">/${esc(g.unit)}</span>
            </div>
            <div style="min-width:32px;text-align:right">${changeBadge}</div>
          </div>
        </div>`;
    }).join("");

    /* สีขอบซ้ายตามสถานะสินค้าโดยรวม (ถ้ามีตลาดใดขึ้น = ขึ้น / ลงทั้งหมด = ลง / อื่นๆ = ปกติ) */
    const hasUp = g.markets.some(m => m.status === "up");
    const hasDown = g.markets.some(m => m.status === "down");
    const borderColor = hasUp ? "var(--green)" : hasDown ? "var(--red)" : "var(--line)";

    const productEsc = esc(g.product).replace(/'/g, "\\'");
    return `
      <div class="card" style="padding:12px 14px;border-left:3px solid ${borderColor};cursor:pointer"
           onclick="App.showPriceHistory('${productEsc}','${esc(g.unit)}')"
           role="button" title="ดูประวัติราคา ${esc(g.product)}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:${g.markets.length > 1 ? "2px" : "0"}">
          <div>
            <div style="font-weight:700;font-size:.92rem;line-height:1.3">${esc(g.product)}</div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${esc(g.category)}</div>
          </div>
          <span style="font-size:.68rem;color:var(--muted);opacity:.6;flex-shrink:0;margin-top:2px">${ic("chart")}</span>
        </div>
        ${marketRows}
      </div>`;
  }).join("");

  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">${cards}</div>`;
}

/* ===== modal ประวัติราคา + กราฟ ===== */
const PRICE_HISTORY_MODES = {
  day30: { label: "30 วัน", sub: "รายวัน 30 วัน", req: { period: "day", days: 30 } },
  day90: { label: "90 วัน", sub: "รายวัน 90 วัน", req: { period: "day", days: 90 } },
  month: { label: "รายเดือน", sub: "เฉลี่ยรายเดือน 12 เดือน", req: { period: "month", months: 12 } },
  year: { label: "รายปี", sub: "เฉลี่ยรายปี 5 ปี", req: { period: "year", years: 5 } }
};
function priceHistoryMode() {
  return PRICE_HISTORY_MODES[App._phMode] ? App._phMode : "day30";
}
function priceHistoryLabel(bucket, mode) {
  if (mode === "year") return bucket;
  if (mode === "month") {
    const m = Number(String(bucket).slice(5, 7));
    return (THAI_MONTHS_SHORT[m - 1] || String(bucket).slice(5, 7)) + " " + String(bucket).slice(2, 4);
  }
  return String(bucket).slice(5);
}
function currentPricePoints(product, mode) {
  const cached = App._marketPrices;
  const prod = cached && (cached.products || []).find(p => p.product === product);
  if (!prod) return {};
  const bucket = mode === "year" ? String(prod.date || cached.date || todayISO()).slice(0, 4)
    : mode === "month" ? String(prod.date || cached.date || todayISO()).slice(0, 7)
    : String(prod.date || cached.date || todayISO()).slice(0, 10);
  const out = {};
  (prod.markets || []).forEach(m => {
    out[m.market] = {
      date: bucket,
      price: Number(m.price) || ((Number(prod.min) + Number(prod.max)) / 2),
      min: Number(prod.min) || 0,
      max: Number(prod.max) || 0,
      status: m.status || "stable",
      samples: 0,
      current: true
    };
  });
  return out;
}
function mergedPriceHistory(product, mode, history, markets) {
  const cur = currentPricePoints(product, mode);
  const byMarket = {};
  (markets || []).forEach(m => { byMarket[m] = (history && history[m] ? history[m] : []).slice(); });
  Object.keys(cur).forEach(m => {
    if (!byMarket[m]) byMarket[m] = [];
    if (!byMarket[m].some(p => p.date === cur[m].date)) byMarket[m].push(cur[m]);
  });
  Object.keys(byMarket).forEach(m => byMarket[m].sort((a, b) => String(a.date).localeCompare(String(b.date))));
  return { history: byMarket, markets: Object.keys(byMarket) };
}
function priceHistoryModeButtons(product, unit) {
  const mode = priceHistoryMode();
  const pArg = String(product || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const uArg = String(unit || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    ${Object.keys(PRICE_HISTORY_MODES).map(k => `
      <button class="chip ${mode === k ? "chip-active" : ""}"
              onclick="App._phMode='${k}';App.showPriceHistory('${pArg}','${uArg}')">
        ${PRICE_HISTORY_MODES[k].label}
      </button>`).join("")}
  </div>`;
}
App.showPriceHistory = async function (product, unit) {
  const mode = priceHistoryMode();
  const meta = PRICE_HISTORY_MODES[mode];
  /* เปิด modal ทันทีด้วย loading state */
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("chart")} ${esc(product)}</h3>
    <div class="muted" style="font-size:.78rem;margin-bottom:14px">ประวัติราคา · ${meta.sub}</div>
    <div id="phModalBody" style="text-align:center;padding:32px 0">
      <div class="muted">${ic("refresh")} กำลังโหลดข้อมูล...</div>
    </div>`);

  try {
    const r = await authCall("market_price_history", Object.assign({ product }, meta.req));
    const el = document.getElementById("phModalBody");
    if (!el) return;

    if (!r.ok) {
      /* Worker เก่าหรือ network error — fallback ราคาปัจจุบันจาก cache */
      App._showPriceFromCache(el, product, unit);
      return;
    }

    const priceData = r.data || {};
    const merged = mergedPriceHistory(product, mode, priceData.history || {}, priceData.markets || []);
    const history = merged.history;
    const markets = merged.markets;

    /* ยังไม่มีประวัติ (เพิ่งเริ่มบันทึก) — แสดงราคาปัจจุบันจาก cache แทน */
    const hasHistory = markets && markets.length && Object.values(history).some(arr => arr.length);
    if (!hasHistory) {
      /* สร้าง mock จากข้อมูล snapshot ปัจจุบัน */
      const cached = App._marketPrices;
      const prod = cached && (cached.products || []).find(p => p.product === product);
      if (prod) {
        const priceStr = prod.min === prod.max ? fmtNum(prod.min) : `${fmtNum(prod.min)}–${fmtNum(prod.max)}`;
        el.innerHTML = `
          <div style="padding:12px 0 4px">
            ${prod.markets.map(m => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">
                <span style="font-size:.82rem;color:var(--muted)">${esc(m.market)}</span>
                <span style="font-weight:700;font-size:1rem;color:var(--green-deep)">${fmtNum(m.price)} <span style="font-size:.72rem;font-weight:400">/${esc(prod.unit)}</span></span>
              </div>`).join("")}
          </div>
          <div class="muted" style="font-size:.74rem;text-align:center;margin-top:16px;padding:10px;background:var(--bg);border-radius:8px">
            ${ic("chart")} ระบบเริ่มเก็บประวัติราคาแล้ว<br>กราฟจะแสดงหลังจากมีข้อมูลสะสม 2 วันขึ้นไป
          </div>`;
      } else {
        el.innerHTML = `<div class="muted" style="padding:24px 0">ยังไม่มีประวัติราคา — ระบบจะเริ่มบันทึกตั้งแต่วันนี้</div>`;
      }
      return;
    }

    /* มีประวัติ — วาดกราฟแยกตามตลาด */
    const MARKET_COLORS = ["#16a34a","#2563eb","#f97316","#8b5cf6","#e11d48"];
    const chartSections = markets.map((mkt, mi) => {
      const pts = (history[mkt] || []);
      if (!pts.length) return "";
      const last = pts[pts.length - 1];
      const first = pts[0];
      const diff = last.price - first.price;
      const diffSign = diff > 0 ? `<span style="color:var(--green)">▲ ${fmtNum(diff)}</span>`
                     : diff < 0 ? `<span style="color:var(--red)">▼ ${fmtNum(Math.abs(diff))}</span>`
                     : `<span style="color:var(--muted)">—</span>`;
      /* label ย่อ — แสดงทุก N วัน เพื่อไม่ให้แน่น */
      const step = pts.length > 14 ? Math.ceil(pts.length / 7) : 1;
      const chartItems = pts.map((pt, i) => ({
        label: i % step === 0 ? priceHistoryLabel(pt.date, mode) : "",
        value: pt.price
      }));
      const color = MARKET_COLORS[mi % MARKET_COLORS.length];
      const sampleText = pts.length === 1
        ? `<div class="muted" style="font-size:.7rem;margin-top:6px">มีข้อมูล 1 จุด ระบบจะต่อกราฟเมื่อ cron บันทึกราคาเพิ่ม</div>`
        : "";
      return `
        <div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
              <span style="font-size:.8rem;font-weight:600">${esc(mkt)}</span>
            </div>
            <div style="font-size:.78rem">
              <span style="font-weight:700;color:var(--green-deep)">${fmtNum(last.price)}</span>
              <span style="font-size:.68rem;color:var(--muted)"> /${esc(unit)}</span>
              <span style="margin-left:6px;font-size:.74rem">${diffSign}</span>
            </div>
          </div>
          <div id="ph_chart_${mi}" style="width:100%;overflow:hidden"></div>
          ${sampleText}
        </div>`;
    }).join("");

    el.innerHTML = priceHistoryModeButtons(product, unit) + chartSections;

    /* วาดกราฟทุกตลาด */
    markets.forEach((mkt, mi) => {
      const pts = (history[mkt] || []);
      if (!pts.length) return;
      const step = pts.length > 14 ? Math.ceil(pts.length / 7) : 1;
      const chartItems = pts.map((pt, i) => ({ label: i % step === 0 ? priceHistoryLabel(pt.date, mode) : "", value: pt.price }));
      const color = MARKET_COLORS[mi % MARKET_COLORS.length];
      const container = document.getElementById("ph_chart_" + mi);
      if (!container) return;
      Charts.line(container, chartItems, { color });
      /* แก้สีเส้น + จุด + area ให้ตรงกับตลาด */
      const svg = container.querySelector("svg");
      if (svg) {
        svg.querySelectorAll("polyline").forEach(el => el.setAttribute("stroke", color));
        svg.querySelectorAll("circle").forEach(el => el.setAttribute("fill", color));
        svg.querySelectorAll("polygon").forEach(el => { el.setAttribute("fill", color); el.setAttribute("opacity","0.1"); });
      }
    });

  } catch (e) {
    const el = document.getElementById("phModalBody");
    if (el) App._showPriceFromCache(el, product, unit);
  }
};
App._phMode = "day30";

/* helper: แสดงราคาปัจจุบันจาก cache เมื่อ worker ยังไม่มี price_history */
App._showPriceFromCache = function (el, product, unit) {
  if (!el) return;
  const cached = App._marketPrices;
  const prod = cached && (cached.products || []).find(p => p.product === product);
  if (!prod) {
    el.innerHTML = `<div class="muted" style="padding:24px 0">ไม่พบข้อมูลราคาในขณะนี้</div>`;
    return;
  }
  const mode = priceHistoryMode();
  const points = currentPricePoints(product, mode);
  const markets = (prod.markets || []).map(m => m.market).filter(m => points[m]);
  const MARKET_COLORS = ["#16a34a","#2563eb","#f97316","#8b5cf6","#e11d48"];
  el.innerHTML = `
    ${priceHistoryModeButtons(product, unit)}
    <div style="padding:4px 0 12px">
      ${prod.markets.map(m => {
        const badge = m.status === "up"
          ? `<span style="color:var(--green);font-weight:700">▲</span>`
          : m.status === "down"
          ? `<span style="color:var(--red);font-weight:700">▼</span>`
          : `<span style="color:var(--muted)">—</span>`;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
            <span style="font-size:.84rem;color:var(--muted)">${esc(m.market)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:800;font-size:1.05rem;color:var(--green-deep)">${fmtNum(m.price)}</span>
              <span style="font-size:.72rem;color:var(--muted)">/${esc(prod.unit)}</span>
              ${badge}
            </div>
          </div>`;
      }).join("")}
    </div>
    ${markets.map((mkt, mi) => {
      const pt = points[mkt];
      const color = MARKET_COLORS[mi % MARKET_COLORS.length];
      return `
      <div style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
            <span style="font-size:.8rem;font-weight:600">${esc(mkt)}</span>
          </div>
          <div style="font-size:.78rem">
            <span style="font-weight:700;color:var(--green-deep)">${fmtNum(pt.price)}</span>
            <span style="font-size:.68rem;color:var(--muted)"> /${esc(prod.unit)}</span>
          </div>
        </div>
        <div id="ph_cache_chart_${mi}" style="width:100%;overflow:hidden"></div>
        <div class="muted" style="font-size:.7rem;margin-top:6px">เริ่มกราฟจากราคาปัจจุบัน ระบบจะต่อเส้นเมื่อมีประวัติสะสมเพิ่ม</div>
      </div>`;
    }).join("")}`;
  markets.forEach((mkt, mi) => {
    const pt = points[mkt];
    const color = MARKET_COLORS[mi % MARKET_COLORS.length];
    const container = document.getElementById("ph_cache_chart_" + mi);
    if (!container || !pt) return;
    Charts.line(container, [{ label: priceHistoryLabel(pt.date, mode), value: pt.price }], { color });
    const svg = container.querySelector("svg");
    if (svg) {
      svg.querySelectorAll("polyline").forEach(el => el.setAttribute("stroke", color));
      svg.querySelectorAll("circle").forEach(el => el.setAttribute("fill", color));
      svg.querySelectorAll("polygon").forEach(el => { el.setAttribute("fill", color); el.setAttribute("opacity","0.1"); });
    }
  });
};

/* ===== summary banner แบบ kasetpoomjai (ราคาขึ้น / ลง / คงที่ ใน 1 แถวเดียว) ===== */
function priceSummaryHtml(cached) {
  const rows = priceFlatRows(cached);
  const upCount = rows.filter(r => r.status === "up").length;
  const downCount = rows.filter(r => r.status === "down").length;
  const stableCount = rows.filter(r => r.status === "stable").length;
  /* นับเฉพาะสินค้า (unique product) ไม่นับซ้ำหลายตลาด */
  const products = new Set(rows.map(r => r.product));
  return `
  <div style="display:flex;gap:0;border-radius:var(--radius);overflow:hidden;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="flex:1;background:var(--green);color:#fff;padding:14px 10px;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;line-height:1">${upCount}</div>
      <div style="font-size:.7rem;opacity:.92;margin-top:3px;white-space:nowrap">รายการ ราคาขึ้น</div>
    </div>
    <div style="flex:1;background:var(--red,#e11d48);color:#fff;padding:14px 10px;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;line-height:1">${downCount}</div>
      <div style="font-size:.7rem;opacity:.92;margin-top:3px;white-space:nowrap">รายการ ราคาลง</div>
    </div>
    <div style="flex:1;background:var(--card);color:var(--text);padding:14px 10px;text-align:center;border:1px solid var(--line)">
      <div style="font-size:1.5rem;font-weight:800;line-height:1;color:var(--muted)">${stableCount}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:3px;white-space:nowrap">รายการ ราคาคงที่</div>
    </div>
    <div style="flex:1;background:var(--card);color:var(--text);padding:14px 10px;text-align:center;border:1px solid var(--line);border-left:none">
      <div style="font-size:1.5rem;font-weight:800;line-height:1">${products.size}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:3px;white-space:nowrap">สินค้าทั้งหมด</div>
    </div>
  </div>`;
}

/* ===== แท็บกรองหมวด ===== */
function priceCatTabsHtml(cached) {
  const rows = priceFlatRows(cached);
  const catCounts = {};
  rows.forEach(r => { const c = r.category || "อื่นๆ"; catCounts[c] = (catCounts[c] || 0) + 1; });
  const cats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  if (cats.length <= 1) return "";
  const cur = App._priceCat || "";
  return `<div style="display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;-webkit-overflow-scrolling:touch">
    <button class="chip ${!cur ? "chip-active" : ""}" onclick="App.priceCatFilter('')" style="white-space:nowrap;flex-shrink:0">ทั้งหมด <span class="badge">${rows.length}</span></button>
    ${cats.map(([cat, n]) => `<button class="chip ${cur === cat ? "chip-active" : ""}" onclick="App.priceCatFilter('${esc(cat).replace(/'/g, "\\'")}');" style="white-space:nowrap;flex-shrink:0">${esc(cat)} <span class="badge">${n}</span></button>`).join("")}
  </div>`;
}

/* ===== ช่องค้นหา ===== */
function priceSearchHtml(searchKey) {
  return `<div class="card" style="padding:10px 14px;margin-bottom:14px;border-radius:var(--radius)">
    <div class="row" style="align-items:center;gap:10px">
      <span style="opacity:.4">${ic("search")}</span>
      <input type="text" class="input" placeholder="ค้นหาสินค้าหรือตลาด..." value="${esc(searchKey)}" oninput="App.priceSearch(this.value)" style="border:none;background:transparent;font-size:.86rem;flex:1;padding:0">
      ${searchKey ? `<button class="btn btn-ghost btn-sm" onclick="App.priceSearch('')" style="padding:2px 8px;font-size:.72rem;border-radius:8px">✕ ล้าง</button>` : ""}
    </div>
  </div>`;
}

/* ===== อัปเดตเฉพาะตาราง (ไม่ rebuild ทั้งหน้า = focus ช่องค้นหาไม่หลุด) ===== */
App.priceSearch = function (v) {
  App._priceSearch = v;
  const wrap = document.getElementById("priceTableWrap");
  if (wrap) wrap.innerHTML = priceTableHtml();
};
App.priceCatFilter = function (cat) {
  App._priceCat = cat;
  render();
};

function renderPrices() {
  const cached = App._marketPrices;
  const searchKey = App._priceSearch || "";
  const head = moreBackHeader("ราคาตลาด", "ราคาผักผลไม้รายวันและกราฟย้อนหลัง", `<button class="btn btn-outline btn-sm" onclick="App._priceLoading=false;App.loadMarketPrices()">${ic("refresh")} รีเฟรช</button>`);

  /* โหลดอัตโนมัติครั้งแรกที่เปิดหน้า (ไม่ต้องกดปุ่ม) */
  if (!cached && !App._priceLoading) {
    App._priceLoading = true;
    App.loadMarketPrices();
    return `
      ${head}
      <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none;padding:28px 20px;text-align:center">
        <div style="font-size:2.2rem;margin-bottom:10px">${ic("dollar")}</div>
        <div class="bold" style="font-size:1.15rem;margin-bottom:6px">ราคาสินค้าเกษตรวันนี้</div>
        <div style="font-size:.78rem;opacity:.85;line-height:1.6">ติดตามและวิเคราะห์ราคาสินค้าเกษตรล่าสุด<br>จากตลาดกลางชั้นนำทั่วประเทศ</div>
      </div>
      <div class="card" style="text-align:center;padding:40px 20px;margin-top:12px">
        <div style="font-size:2rem;margin-bottom:12px;opacity:.35">${ic("refresh")}</div>
        <div class="bold" style="margin-bottom:6px">กำลังดึงข้อมูลราคา...</div>
        <div class="muted" style="font-size:.78rem">ข้อมูลราคา ณ ตลาดศรีเมือง + ตลาดสี่มุมเมือง</div>
      </div>`;
  }

  if (!cached) {
    return `
      ${head}
      <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none;padding:28px 20px;text-align:center">
        <div style="font-size:2.2rem;margin-bottom:10px">${ic("dollar")}</div>
        <div class="bold" style="font-size:1.15rem;margin-bottom:6px">ราคาสินค้าเกษตรวันนี้</div>
        <div style="font-size:.78rem;opacity:.85;line-height:1.6">ติดตามและวิเคราะห์ราคาสินค้าเกษตรล่าสุด<br>จากตลาดกลางชั้นนำทั่วประเทศ</div>
      </div>
      <div class="card" style="text-align:center;padding:36px 20px;margin-top:12px">
        <div class="muted" style="margin-bottom:14px;font-size:.84rem">เชื่อมต่อไม่สำเร็จ หรือยังไม่ได้โหลดข้อมูล</div>
        <button class="btn btn-primary" onclick="App._priceLoading=false;App.loadMarketPrices()">${ic("refresh")} ลองใหม่</button>
      </div>`;
  }
  const priceDateIso = (() => {
    try { return new Date(cached.date).toISOString().slice(0, 10); }
    catch (e) { return ""; }
  })();
  const priceAgeDays = priceDateIso ? daysBetween(priceDateIso, todayISO()) : 0;
  const priceTitle = priceAgeDays > 0 ? "ราคาสินค้าเกษตร" : "ราคาสินค้าเกษตรวันนี้";
  const priceFreshLabel = priceAgeDays <= 0 ? "ข้อมูลวันนี้" : `ข้อมูลเก่า ${fmtNum(priceAgeDays)} วัน`;

  return `
    ${head}
    <!-- Hero banner + summary -->
    <div class="card" style="background:linear-gradient(135deg,var(--green-dark),var(--green-deep));color:#fff;border:none;padding:18px 16px 14px;margin-bottom:12px">
      <div class="row row-between" style="align-items:flex-start;margin-bottom:10px">
        <div>
          <div class="bold" style="font-size:1.08rem;margin-bottom:3px">${priceTitle}</div>
          <div style="font-size:.73rem;opacity:.85">ตลาดศรีเมือง + ตลาดสี่มุมเมือง · อัปเดต ${thaiDateStr(new Date(cached.date))}</div>
        </div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.22);color:#fff;border:none;flex-shrink:0;margin-left:10px" onclick="App._priceLoading=false;App.loadMarketPrices()">${ic("refresh")}</button>
      </div>
      <div class="price-freshness ${priceAgeDays > 2 ? "is-stale" : ""}">
        ${ic(priceAgeDays > 2 ? "alert" : "check")} ${priceFreshLabel}
      </div>
      <!-- summary bar ขึ้น/ลง/คงที่ -->
      ${(() => {
        const rows = priceFlatRows(cached);
        const up = rows.filter(r => r.status === "up").length;
        const down = rows.filter(r => r.status === "down").length;
        const stable = rows.filter(r => r.status === "stable").length;
        return `<div style="display:flex;gap:8px">
          <div style="flex:1;background:rgba(255,255,255,.18);border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:1.15rem;font-weight:800;line-height:1">${up}</div>
            <div style="font-size:.65rem;opacity:.9;margin-top:2px">ราคาขึ้น</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,.18);border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:1.15rem;font-weight:800;line-height:1">${down}</div>
            <div style="font-size:.65rem;opacity:.9;margin-top:2px">ราคาลง</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,.18);border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:1.15rem;font-weight:800;line-height:1">${stable}</div>
            <div style="font-size:.65rem;opacity:.9;margin-top:2px">ราคาคงที่</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,.18);border-radius:8px;padding:8px 6px;text-align:center">
            <div style="font-size:1.15rem;font-weight:800;line-height:1">${new Set(rows.map(r => r.product)).size}</div>
            <div style="font-size:.65rem;opacity:.9;margin-top:2px">สินค้า</div>
          </div>
        </div>`;
      })()}
    </div>

    <!-- ค้นหา + กรองหมวด -->
    ${priceSearchHtml(searchKey)}
    ${priceCatTabsHtml(cached)}

    <!-- card grid สินค้า -->
    <div id="priceTableWrap">${priceTableHtml()}</div>

    <div class="section-title" style="margin-top:20px">${ic("dollar")} แหล่งราคาทางการ</div>
    <div class="card">
      <div class="row-line" onclick="window.open('https://www.kasetpoomjai.com/ราคาตลาด/','_blank')" role="button">
        <span class="task-ico" style="background:var(--green-light);color:var(--green-deep)">${ic("leaf")}</span>
        <div class="grow"><div class="bold" style="font-size:.84rem">เกษตรภูมิใจ — ราคาตลาดผักผลไม้</div><div class="muted" style="font-size:.7rem">ตลาดศรีเมือง + ตลาดสี่มุมเมือง รายวัน</div></div>
        <span class="task-arrow">${ic("chevron")}</span>
      </div>
      <div class="row-line" onclick="window.open('https://talaadthai.com/products','_blank')" role="button">
        <span class="task-ico" style="background:var(--green-light);color:var(--green-deep)">${ic("dollar")}</span>
        <div class="grow"><div class="bold" style="font-size:.84rem">ตลาดไท — ราคาผักผลไม้ขายส่งรายวัน</div><div class="muted" style="font-size:.7rem">ราคาผักสดขายส่ง ณ ตลาดไท</div></div>
        <span class="task-arrow">${ic("chevron")}</span>
      </div>
      <div class="row-line" onclick="window.open('https://pricelist.dit.go.th/main.php','_blank')" role="button">
        <span class="task-ico" style="background:var(--blue-light);color:var(--blue)">${ic("dollar")}</span>
        <div class="grow"><div class="bold" style="font-size:.84rem">กรมการค้าภายใน — ราคาขายปลีก/ขายส่ง</div><div class="muted" style="font-size:.7rem">ราคาสินค้าเกษตรทางการรายวัน</div></div>
        <span class="task-arrow">${ic("chevron")}</span>
      </div>
    </div>`;
}
/* โหลดราคาจาก Worker (proxy กัน CORS) — เรียกอัตโนมัติตอนเปิดหน้า */
App.loadMarketPrices = async function () {
  App._priceLoading = true;
  try {
    const r = await authCall("market_prices", {});
    if (!r.ok) { toast("ดึงราคาไม่สำเร็จ: " + (r.error || "")); App._priceLoading = false; render(); return; }
    App._marketPrices = r.data;
    App._priceLoading = false;
    render();
  } catch (e) { toast("เชื่อมต่อไม่ได้"); App._priceLoading = false; render(); }
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
  const planPhotos = taskPhotos(t);
  const donePhotos = taskDonePhotosOf(t);
  const photosHtml = (planPhotos.length || donePhotos.length) ? `
    <div class="share-photo-groups">
      ${planPhotos.length ? `<div class="share-photo-label">ก่อนทำ</div><div class="task-photo-strip share">
        ${planPhotos.slice(0, 6).map(p => `<span class="task-photo-thumb readonly"><img src="${esc(taskPhotoUrl(p))}" alt="รูปก่อนทำ" loading="lazy" onerror="this.closest('.task-photo-thumb').remove()"></span>`).join("")}
      </div>` : ""}
      ${donePhotos.length ? `<div class="share-photo-label">หลังทำ</div><div class="task-photo-strip share">
        ${donePhotos.slice(0, 6).map(p => `<span class="task-photo-thumb readonly"><img src="${esc(taskPhotoUrl(p))}" alt="รูปหลังทำ" loading="lazy" onerror="this.closest('.task-photo-thumb').remove()"></span>`).join("")}
      </div>` : ""}
    </div>` : "";
  return `
    <div class="row-line" style="align-items:flex-start">
      <span class="task-ico">${ic(TYPE_ICONS[t.type] || "check")}</span>
      <div class="grow">
        <div class="bold" style="font-size:.84rem">${esc(t.title)}</div>
        <div class="muted" style="font-size:.7rem">${meta.map(esc).join(" · ")}</div>
        ${t.note ? `<div class="td-note-body" style="margin-top:6px;font-size:.74rem">${esc(t.note)}</div>` : ""}
        ${t.doneNote ? `<div class="td-note-body" style="margin-top:6px;font-size:.74rem">${esc(t.doneNote)}</div>` : ""}
        ${photosHtml}
        ${costsHtml}
      </div>
      ${statusTag(taskStatusOf(t))}
    </div>`;
}
App.renderShareView = function () {
  const v = document.getElementById("view");
  const nav = document.getElementById("bottomNav");
  const fd = document.getElementById("fabDock");
  if (nav) nav.innerHTML = "";
  if (fd) fd.style.display = "none";
  ["notifBtn", "profileBtn", "tourBtn", "editBtn"].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = "none"; });
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
    { label: "🔎 แปลงทดลอง", key: "trials" },
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
function clearDataOptions() {
  const linkedCycleIds = new Set((S.cycles || []).map(c => c.id));
  const customCount = Object.keys(S.texts || {}).length + (S.customMenus || []).length + (S.customCostCats || []).length;
  return [
    {
      key: "plots", icon: "leaf", label: "ข้อมูลแปลง",
      count: (S.plots || []).length,
      note: "ลบแปลงทั้งหมด พร้อมรอบปลูก งานทดลอง งาน และระบบน้ำที่ผูกกับแปลง",
      clear: () => { S.plots = []; S.cycles = []; S.tasks = []; S.trials = []; S.water = { sources: [], systems: [], logs: [] }; S.valves = []; }
    },
    {
      key: "cycles", icon: "leaf", label: "รอบปลูก",
      count: (S.cycles || []).length,
      note: "ลบรอบปลูกทั้งหมด และลบงานที่อยู่ในรอบปลูกเหล่านั้น",
      clear: () => { S.cycles = []; S.tasks = (S.tasks || []).filter(t => !linkedCycleIds.has(t.cycleId)); }
    },
    {
      key: "tasks", icon: "menu", label: "งาน/กิจกรรม",
      count: (S.tasks || []).length,
      note: "ลบงาน แผนงาน กิจกรรม และประวัติต้นทุนจากงานทั้งหมด",
      clear: () => { S.tasks = []; }
    },
    {
      key: "trials", icon: "search", label: "แปลงทดลอง",
      count: (S.trials || []).length,
      note: "ลบงานทดลอง ทรีตเมนต์ ผังสุ่ม ค่าวัด และรูปหลักฐานของแปลงทดลองทั้งหมด",
      clear: () => { S.trials = []; route.trialId = ""; }
    },
    {
      key: "stock", icon: "box", label: "สต็อกยา/ปุ๋ย",
      count: (S.stock || []).length,
      note: "ลบรายการสต็อกทั้งหมด แต่เก็บงานและประวัติขายไว้ โดยตัดการผูก stock id ออก",
      clear: () => {
        S.stock = [];
        (S.tasks || []).forEach(t => {
          t.stockId = null; t.stockLog = [];
          (t.costItems || []).forEach(ci => { ci.stockId = ""; });
        });
        (S.sales || []).forEach(s => (s.items || []).forEach(it => { it.stockId = ""; }));
      }
    },
    {
      key: "sales", icon: "dollar", label: "การขาย/ใบเสร็จ",
      count: (S.sales || []).length,
      note: "ลบประวัติการขาย ใบเสร็จ และข้อมูลลูกค้าจากการขายทั้งหมด",
      clear: () => { S.sales = []; }
    },
    {
      key: "equipment", icon: "truck", label: "อุปกรณ์",
      count: (S.equipment || []).length,
      note: "ลบรายการเครื่องจักร อุปกรณ์ และข้อมูลค่าเสื่อมทั้งหมด",
      clear: () => { S.equipment = []; }
    },
    {
      key: "water", icon: "droplet", label: "ระบบน้ำ",
      count: ((S.water && S.water.systems) || []).length + ((S.water && S.water.sources) || []).length + ((S.water && S.water.logs) || []).length + (S.valves || []).length,
      note: "ลบแหล่งน้ำ ระบบน้ำ บันทึกการให้น้ำ และวาล์วทั้งหมด",
      clear: () => { S.water = { sources: [], systems: [], logs: [] }; S.valves = []; }
    },
    {
      key: "workers", icon: "user", label: "ข้อมูลแรงงาน",
      count: Number((S.workers || {}).total) || Number((S.workers || {}).working) || 0,
      note: "ล้างตัวเลขแรงงานที่กำลังทำงาน พัก ลา และจำนวนรวม",
      clear: () => { S.workers = { working: 0, resting: 0, leave: 0, total: 0 }; }
    },
    {
      key: "custom", icon: "wrench", label: "การตั้งค่าที่ปรับเอง",
      count: customCount,
      note: "ล้างคำที่แก้เอง เมนูที่เพิ่มเอง หมวดต้นทุนที่เพิ่มเอง ลำดับหน้าแรก และสถานะทัวร์",
      clear: () => {
        S.texts = {}; S.customMenus = []; S.customCostCats = [];
        S.homeOrder = ["cal", "tasks", "profit", "activity"];
        S.role = "general"; S.tourDone = false;
      }
    }
  ];
}
function clearDataToolsHtml() {
  return clearDataOptions().map(o => `
    <div class="ed-row">
      <span class="mc-ico" style="width:auto">${ic(o.icon)}</span>
      <div class="grow">
        <div class="bold" style="font-size:.86rem">${esc(o.label)} <span class="badge badge-gray">${fmtNum(o.count)} รายการ</span></div>
        <div class="muted" style="font-size:.7rem;line-height:1.45">${esc(o.note)}</div>
      </div>
      <button class="btn btn-sm btn-danger-soft" onclick="App.clearDataSection('${o.key}')">${ic("trash")} ลบ</button>
    </div>`).join("");
}
App.clearDataSection = function (key) {
  const opt = clearDataOptions().find(o => o.key === key);
  if (!opt) return;
  App.confirm("ลบ" + opt.label + "?", opt.note + " — ถ้าล็อกอินอยู่ ระบบจะซิงก์การลบนี้ขึ้นคลาวด์ด้วย ต้องการดำเนินการต่อหรือไม่?", async () => {
    opt.clear();
    ensureDefaults(S);
    saveState(S);
    if (typeof Auth !== "undefined" && Auth.session) await Auth.saveNow();
    render();
    toast("ลบ" + opt.label + "แล้ว");
  });
};
/* ดูข้อมูลดิบรายหมวดเป็น JSON (แสดง 8,000 ตัวอักษรแรก — ก๊อปได้ทั้งก้อน) */
App._rawKey = "plots";
App.viewRawData = function (key) {
  if (key) App._rawKey = key;
  const opts = [["plots", "🌱 แปลง"], ["cycles", "🌿 รอบปลูก"], ["tasks", "📋 งาน/กิจกรรม"], ["trials", "🔎 แปลงทดลอง"], ["stock", "🧪 สต็อกยา/ปุ๋ย"], ["sales", "🧾 การขาย"], ["equipment", "🚜 อุปกรณ์"]];
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
      <div class="modal-sub">บัญชี ${esc(typeof maskEmailForDisplay === "function" ? maskEmailForDisplay(Auth.session.email) : Auth.session.email)}</div>
      <div class="card" style="margin-top:8px">
        <div class="row row-between"><span class="muted">ขนาดข้อมูลล่าสุด</span><span class="bold">${fmtBytes(dataStr.length)}</span></div>
        <div class="row row-between mt-8"><span class="muted">อัปเดตเมื่อ</span><span class="small bold">${ts ? ts.toLocaleString("th-TH") : "—"}</span></div>
        <div class="muted mt-8" style="font-size:.72rem">เก็บบน Cloudflare D1 (ฐานข้อมูล farmultimate-db) — ซิงก์อัตโนมัติทุกครั้งที่แก้ข้อมูลเมื่อล็อกอินอยู่</div>
      </div>`);
  } catch (e) { toast("เชื่อมต่อคลาวด์ไม่ได้ (ออฟไลน์?)"); }
};
App.clearAppCache = async function () {
  toast("กำลังล้างแคชเว็บ...");
  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {}
  try { sessionStorage.removeItem(ROUTE_STORE); } catch (e) {}
  setTimeout(() => location.replace(location.pathname + "?r=" + Date.now()), 250);
};

/* ---------------- รูปภาพบนคลาวด์ (R2) ---------------- */
/* ย่อ + อัปโหลดรูปขึ้น R2 ผ่าน worker — สำเร็จคืน URL (ข้อมูลเก็บแค่ URL ไม่กิน localStorage)
   ล้มเหลว (ออฟไลน์/ยังไม่ล็อกอิน/R2 ยังไม่พร้อม) คืน null ให้ผู้เรียก fallback เก็บ base64 เดิม */
App.uploadPhotoR2 = async function (file, maxSide) {
  try {
    if (typeof Auth === "undefined" || !Auth.session) return null;
    const dataUrl = await downscaleImage(file, maxSide || 960, 0.8);
    const r = await authCall("photo_put", { token: Auth.session.token, data: dataUrl.split(",")[1], contentType: "image/jpeg" });
    if (!r || !r.ok || !r.data || !r.data.url) return null;
    return r.data.url;
  } catch (e) { return null; }
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
    ${moreBackHeader(T("settingsTitle"), "บัญชี สำรองข้อมูล เครื่องมือเสริม และล้างข้อมูล", "", "settingsTitle")}
    <details class="settings-group" name="settingsGroups" open>
      <summary class="settings-group-head">
        <b>${ic("gear")} บัญชีและข้อมูลระบบ</b>
        <span>สถานะบัญชี เวอร์ชัน และข้อมูลหลักของเว็บ</span>
      </summary>
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
      <div class="row row-between mt-8"><span class="muted">เวอร์ชัน</span><span class="small bold">v${S.version}</span></div>
    </div>
    ${typeof Auth !== "undefined" ? Auth.cardHtml() : ""}
    </details>
    <details class="settings-group" name="settingsGroups">
      <summary class="settings-group-head">
        <b>${ic("save")} สำรองและพื้นที่เก็บข้อมูล</b>
        <span>นำเข้า ส่งออก และตรวจขนาดข้อมูลก่อนพื้นที่เต็ม</span>
      </summary>
    <div class="section-title">${ic("save")} สำรองข้อมูล (Export / Import)</div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">ดาวน์โหลดข้อมูลทั้งหมด (งาน / สต็อก / แปลง / ค่าใช้จ่าย) เป็นไฟล์ .json เพื่อสำรอง หรือนำเข้าไฟล์สำรองกลับมาใช้งาน — ข้อมูลบันทึกในเบราว์เซอร์เท่านั้น</div>
      <button class="btn btn-primary btn-block" onclick="App.exportData()">${ic("download")} ดาวน์โหลดข้อมูล (.json)</button>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.importData()">${ic("upload")} นำเข้าข้อมูล (.json)</button>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.importMerge()">${ic("box")} ผสานข้อมูลจากไฟล์ (เพิ่มเข้าของเดิม)</button>
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
      <div class="row row-between"><span class="muted">หน้าเว็บค้าง/ยังเป็นเวอร์ชันเก่า</span><span class="small bold">ไม่ลบข้อมูลฟาร์ม</span></div>
      <div class="muted mt-8" style="font-size:.72rem">ล้างเฉพาะ cache และ service worker ของเว็บ แล้วโหลดใหม่ เหมาะกับหลังอัปเดตเว็บแต่ยังเห็น UI เก่า</div>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.clearAppCache()">${ic("refresh")} ล้างแคชเว็บแล้วโหลดใหม่</button>
    </div>
    <div class="card mt-8">
      <div class="row row-between"><span class="muted">บนคลาวด์ (Cloudflare D1)</span><span class="small bold">${typeof Auth !== "undefined" && Auth.session ? esc(typeof maskEmailForDisplay === "function" ? maskEmailForDisplay(Auth.session.email) : Auth.session.email) : "ยังไม่ล็อกอิน"}</span></div>
      <div class="row row-between mt-8"><span class="muted">ซิงก์ล่าสุด</span><span class="small bold">${typeof cloudTs === "function" && cloudTs() ? dateLabel(new Date(cloudTs()).toISOString().slice(0, 10)) + " " + new Date(cloudTs()).toTimeString().slice(0, 5) : "—"}</span></div>
      <button class="btn btn-ghost btn-block mt-8" onclick="App.checkCloudSize()">${ic("refresh")} ตรวจขนาดข้อมูลบนคลาวด์</button>
    </div>
    </details>
    <details class="settings-group" name="settingsGroups">
      <summary class="settings-group-head">
        <b>${ic("wrench")} เครื่องมือเสริม</b>
        <span>Lark หมวดต้นทุน และแหล่งข้อมูลภายนอก</span>
      </summary>
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
    </details>
    <details class="settings-group" name="settingsGroups">
      <summary class="settings-group-head">
        <b>${ic("pencil")} ปรับแต่งเว็บ</b>
        <span>แก้คำ เมนู หน้าแรก และเปิดทัวร์ใช้งานอีกครั้ง</span>
      </summary>
    ${editorHtml}
    <button class="btn btn-ghost btn-block" onclick="App.startTour()">${ic("compass")} แนะนำระบบ (Tour) อีกครั้ง</button>
    </details>
    <details class="settings-group danger" name="settingsGroups">
      <summary class="settings-group-head">
        <b>${ic("trash")} ล้างข้อมูล</b>
        <span>ลบเฉพาะหมวด หรือรีเซ็ตทุกอย่างเมื่อจำเป็น</span>
      </summary>
    <div class="section-title">${ic("trash")} ล้างข้อมูลบางส่วน</div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:8px">เลือกลบเฉพาะหมวดที่ไม่ต้องการแล้วได้ โดยไม่กระทบข้อมูลหมวดอื่นที่ไม่เกี่ยวข้อง</div>
      ${clearDataToolsHtml()}
    </div>
    <button class="btn btn-danger-soft btn-block mt-8" onclick="App.resetData()">${ic("refresh")} รีเซ็ตข้อมูลทั้งหมด</button>
    </details>
    <div class="muted mt-8" style="font-size:.7rem;text-align:center">สภาพอากาศรายแปลงจาก Open-Meteo · เซนเซอร์ระดับน้ำจริงทำงานแบบ read-only ผ่าน Pi 5 · เอาต์พุตยัง SAFE_OFF</div>`;
}
/* เครื่องมือแก้ไข (ใช้ทั้งในหน้าตั้งค่า และ modal จากปุ่ม ✏️ แก้ไขหัวเว็บ) */
function adminToolsHtml() {
  const order = homeOrder();
  const HOME_LABELS = { cal: "งานวันนี้ (ล็อกไว้ด้านบน)", tasks: "งานที่ต้องทำเร็วๆ นี้", profit: "กำไร/ขาดทุนรายแปลง", activity: "กิจกรรมล่าสุด" };
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
        <div class="muted" style="font-size:.72rem;margin-bottom:6px">งานวันนี้อยู่ด้านบนเสมอ เลื่อนขึ้น/ลงได้เฉพาะ section ถัดไป</div>
        ${order.map((k, i) => `
        <div class="ed-row">
          <span class="grow">${HOME_LABELS[k] || k}</span>
          <button class="btn btn-sm btn-ghost" onclick="App.homeMove(${i}, -1)" ${i === 0 || k === "cal" || order[i - 1] === "cal" ? "disabled" : ""}>↑</button>
          <button class="btn btn-sm btn-ghost" onclick="App.homeMove(${i}, 1)" ${i === order.length - 1 || k === "cal" ? "disabled" : ""}>↓</button>
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

/* ผสานข้อมูลจากไฟล์ .json (เช่นที่แปลงจาก Excel) — "เพิ่มเข้า" ข้อมูลเดิม ไม่ทับของที่มีอยู่
   - แปลง: ถ้ามีแปลงชื่อเดียวกันอยู่แล้ว -> ผูกงาน/รอบเข้าแปลงเดิม (ไม่สร้างซ้ำ)
   - รอบ/งาน: ข้ามรายการที่ id ซ้ำกับที่มีอยู่, เลขรอบ (round) คำนวณใหม่ให้อัตโนมัติ */
App.importMerge = function () {
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
      try { obj = JSON.parse(reader.result); } catch (e) { toast("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง"); return; }
      const payload = obj && obj.type === "backup" && obj.data ? obj.data : obj;
      const nP = (payload.plots || []).length, nC = (payload.cycles || []).length, nT = (payload.tasks || []).length;
      if (!nP && !nC && !nT) { toast("ไฟล์นี้ไม่มีแปลง/รอบ/งานให้ผสาน"); return; }
      App.confirm("ผสานข้อมูล?",
        `จะเพิ่มเข้าข้อมูลเดิม (ไม่ลบของที่มี): ${nP} แปลง · ${nC} รอบปลูก · ${nT} งาน` +
        (obj.label ? `\n(${obj.label})` : "") + "\nต้องการดำเนินการต่อหรือไม่?", () => {
        /* แปลง: map ตามชื่อ (ตัดช่องว่าง) — มีอยู่แล้วใช้ของเดิม ไม่มีค่อยสร้างใหม่ */
        const norm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
        const byName = {};
        S.plots.forEach(p => { byName[norm(p.name)] = p; });
        const idRemap = {};
        let addedPlots = 0;
        (payload.plots || []).forEach(np => {
          if (!np || !np.id) return;
          let ex = byName[norm(np.name)];
          if (!ex) {
            ex = Object.assign({}, np);
            if (S.plots.some(p => p.id === ex.id)) ex.id = uid();
            S.plots.push(ex); byName[norm(ex.name)] = ex; addedPlots++;
          }
          idRemap[np.id] = ex.id;
        });
        let addedCycles = 0;
        (payload.cycles || []).forEach(c => {
          if (!c || !c.id || S.cycles.some(x => x.id === c.id)) return;
          const nc = Object.assign({}, c, { plotId: idRemap[c.plotId] || c.plotId });
          /* เลขรอบ: ต่อท้ายรอบที่มีของแปลงนั้น (กันเลขซ้ำ) */
          const rounds = S.cycles.filter(x => x.plotId === nc.plotId).map(x => Number(x.round) || 0);
          nc.round = Math.max(0, ...rounds) + 1;
          S.cycles.push(nc); addedCycles++;
        });
        let addedTasks = 0;
        (payload.tasks || []).forEach(t => {
          if (!t || !t.id || S.tasks.some(x => x.id === t.id)) return;
          S.tasks.push(Object.assign({}, t, { plotId: idRemap[t.plotId] || t.plotId }));
          addedTasks++;
        });
        ensureTaskIds(S);
        saveState(S);
        toast(`ผสานแล้ว: +${addedPlots} แปลง · +${addedCycles} รอบ · +${addedTasks} งาน`);
        setTimeout(() => location.reload(), 800);
      });
    };
    reader.readAsText(file);
  });
  input.click();
};

App.resetData = function () {
  App.confirm("รีเซ็ตข้อมูลทั้งหมด?", "ข้อมูลที่บันทึกไว้ทั้งหมดจะถูกล้างให้ว่างเปล่า และถ้าล็อกอินอยู่จะซิงก์การลบนี้ขึ้นคลาวด์ด้วย ต้องการดำเนินการต่อหรือไม่?", async () => {
    const fresh = typeof blankState === "function" ? blankState() : seed();
    resetSTo(fresh);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    saveState(S);
    if (typeof Auth !== "undefined" && Auth.session) await Auth.saveNow();
    location.reload();
  });
};

/* ---------------- More ---------------- */
function renderMore() {
  const moreList = html => `<div class="action-list more-list">${html}</div>`;
  const item = (ico, name, desc, action) => `
    <button class="action-item more-item" onclick="${action}">
      <span class="action-ico">${ico}</span>
      <span><b>${esc(name)}</b><small>${esc(desc)}</small></span>
      <span class="more-chevron">${ic("chevron")}</span>
    </button>`;
  const customMenus = (S.customMenus || []).map(m =>
    item(m.ico && ICONS[m.ico] ? ic(m.ico) : esc(m.ico || ""), m.name || "เมนู", m.desc || "เมนูที่ผู้ดูแลเพิ่มไว้", `App.goTarget('${esc(m.target || "")}')`)
  ).join("");
  return `
    <div class="section-title" data-tkey="moreTitle">${T("moreTitle")}</div>
    <section class="more-section">
      <div class="more-section-head">
        <div><b>เครื่องมือฟาร์ม</b><span>ข้อมูลเสริมที่ไม่ได้อยู่ในแถบล่าง</span></div>
      </div>
      ${moreList(`
      ${item(ic("truck"), "อุปกรณ์", "ค่าเสื่อม ซ่อมบำรุง และมูลค่าเครื่องจักร", "App.nav('equipment')")}
      ${item(ic("dollar"), "ราคาตลาด", "ราคาผักผลไม้รายวันและกราฟย้อนหลัง", "App.nav('prices')")}
      ${item(ic("droplet"), "สภาพอากาศ", "เทียบพยากรณ์และแผนที่จากแปลง", "App.openWeather('', 'more')")}
      ${item(ic("droplet"), "ระบบน้ำ", "วาล์ว ตารางให้น้ำ และอุปกรณ์ IoT", "App.nav('iot')")}`)}
    </section>
    <section class="more-section">
      <div class="more-section-head">
        <div><b>ระบบและข้อมูล</b><span>ตั้งค่า สำรองข้อมูล และทัวร์ใช้งาน</span></div>
      </div>
      ${moreList(`
      ${item(ic("gear"), "ตั้งค่า", "บัญชี สำรองข้อมูล เครื่องมือเสริม และล้างข้อมูล", "App.nav('settings')")}
      ${item(ic("compass"), "แนะนำระบบ", "เปิดทัวร์ใช้งานเร็วอีกครั้ง", "App.startTour()")}`)}
    </section>
    ${customMenus ? `
    <section class="more-section">
      <div class="more-section-head">
        <div><b>เมนูที่เพิ่มเอง</b><span>ลิงก์หรือหน้าที่ผู้ดูแลเพิ่มไว้</span></div>
      </div>
      ${moreList(customMenus)}
    </section>` : ""}`;
}

/* ---------------- Modals ---------------- */
/* ล็อกการเลื่อนพื้นหลังตอนเปิด modal — กัน iOS/มือถือเลื่อนหน้าหลัง modal ตาม */
function lockBodyScroll() {
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.dataset.scrollLockY = String(y);
  document.documentElement.classList.add("modal-open");
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}
function unlockBodyScroll() {
  const y = Number(document.body.dataset.scrollLockY || 0);
  delete document.body.dataset.scrollLockY;
  document.documentElement.classList.remove("modal-open");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  if (y) window.scrollTo(0, y);
}
function modalFieldLabel(el) {
  const field = el.closest(".field");
  const raw = field && field.querySelector("label") ? field.querySelector("label").textContent : "";
  return String(raw || el.getAttribute("aria-label") || el.placeholder || "ช่องนี้").replace(/\s*\*\s*/g, "").trim();
}
function modalValidationMessage(el) {
  const label = modalFieldLabel(el);
  const v = el.validity || {};
  if (v.valueMissing) return `${el.tagName === "SELECT" || el.type === "date" ? "กรุณาเลือก" : "กรุณากรอก"}${label}`;
  if (v.typeMismatch) return `รูปแบบ${label}ไม่ถูกต้อง`;
  if (v.rangeUnderflow) return `${label}ต้องไม่ต่ำกว่า ${el.getAttribute("min")}`;
  if (v.rangeOverflow) return `${label}ต้องไม่เกิน ${el.getAttribute("max")}`;
  if (v.stepMismatch || v.badInput) return `กรุณากรอก${label}ให้ถูกต้อง`;
  return el.validationMessage || `กรุณาตรวจสอบ${label}`;
}
function setModalFieldError(el, message) {
  const field = el.closest(".field") || el.parentElement;
  if (!field) return;
  field.classList.add("field-invalid");
  el.setAttribute("aria-invalid", "true");
  let err = field.querySelector(".field-error");
  if (!err) {
    err = document.createElement("div");
    err.className = "field-error";
    field.appendChild(err);
  }
  if (!err.id) err.id = (el.id || ("field_" + uid())) + "_error";
  err.textContent = message;
  const describedBy = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  if (!describedBy.includes(err.id)) el.setAttribute("aria-describedby", describedBy.concat(err.id).join(" "));
}
function clearModalFieldError(el) {
  const field = el.closest(".field") || el.parentElement;
  if (!field) return;
  if (!el.validity || !el.validity.valid) return;
  field.classList.remove("field-invalid");
  el.removeAttribute("aria-invalid");
  const err = field.querySelector(".field-error");
  if (err) err.remove();
}
function focusModalInvalidField(form) {
  const first = form.querySelector(":invalid");
  if (!first) return;
  setModalFieldError(first, modalValidationMessage(first));
  const target = first.closest(".field") || first;
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  setTimeout(() => {
    try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
  }, 220);
}
function installModalValidation(form) {
  form.addEventListener("invalid", e => {
    e.preventDefault();
    setModalFieldError(e.target, modalValidationMessage(e.target));
    clearTimeout(form._modalInvalidTimer);
    form._modalInvalidTimer = setTimeout(() => focusModalInvalidField(form), 0);
  }, true);
  form.addEventListener("input", e => clearModalFieldError(e.target), true);
  form.addEventListener("change", e => clearModalFieldError(e.target), true);
}
function modalShouldLockBackdrop(modalEl) {
  if (!modalEl) return false;
  return !!modalEl.querySelector([
    ".modal-lock-backdrop",
    "form",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    ".water-zone-editor-list",
    ".stock-import-preview",
    ".lark-photo-conflict"
  ].join(","));
}
function openModal(html) {
  /* ปิดแผงแจ้งเตือนเมื่อเปิด modal (กดแถวงานในแผง → ดูรายละเอียด) */
  const np = document.getElementById("notifPanel");
  if (np) np.hidden = true;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-scroll">${html}</div></div></div>`;
  const modalEl = root.querySelector(".modal");
  const actionBars = modalEl ? Array.from(modalEl.querySelectorAll(".modal-actions")) : [];
  const actions = actionBars[actionBars.length - 1];
  if (modalEl && actions) {
    const form = actions.closest("form");
    if (form) {
      if (!form.id) form.id = "modalForm_" + uid();
      actions.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(btn => {
        if (!btn.getAttribute("form")) btn.setAttribute("form", form.id);
      });
    }
    modalEl.classList.add("modal-has-actions");
    modalEl.appendChild(actions);
  }
  if (modalEl) {
    modalEl.querySelectorAll(".modal-x").forEach(btn => {
      if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", "ปิดหน้าต่าง");
      if (!btn.getAttribute("title")) btn.setAttribute("title", "ปิดหน้าต่าง");
    });
    modalEl.querySelectorAll("form").forEach(installModalValidation);
    if (modalShouldLockBackdrop(modalEl)) modalEl.classList.add("modal-backdrop-locked");
  }
  const bd = root.querySelector(".modal-backdrop");
  bd.addEventListener("click", e => {
    if (e.target !== bd) return;
    const modal = root.querySelector(".modal");
    if (modal && modal.classList.contains("modal-backdrop-locked")) {
      return;
    }
    closeModal();
  });
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
  const lat = p ? p.lat : "";
  const lng = p ? p.lng : "";
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

let plotWaterZoneDraft = [];
let plotWaterZonePlotId = "";
function waterZoneDraftHtml() {
  const totalArea = plotWaterZoneDraft.reduce((sum, z) => sum + (Number(z.areaRai) || 0), 0);
  const totalMinutes = plotWaterZoneDraft.reduce((sum, z) => sum + (Number(z.defaultMinutes) || 0), 0);
  return `
    <div class="water-zone-summary">
      <span>${fmtNum(plotWaterZoneDraft.length)} โซน</span>
      <span>${fmtNum(totalArea)} ไร่</span>
      <span>${fmtNum(totalMinutes)} นาที/รอบ</span>
    </div>
    <div class="water-zone-editor-list">
      ${plotWaterZoneDraft.length ? plotWaterZoneDraft.map((z, i) => `
        <div class="water-zone-editor-row" data-wz="${i}">
          <div class="water-zone-editor-head">
            <b>โซน ${i + 1}</b>
            <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.waterZoneRemove(${i})">${ic("trash")} ลบ</button>
          </div>
          <div class="form-row-2">
            <div class="field"><label>ชื่อโซน *</label><input value="${esc(z.name || "")}" placeholder="เช่น หน้าแปลง / กลางแปลง" oninput="App.waterZoneSet(${i}, 'name', this.value)"></div>
            <div class="field"><label>พื้นที่โซน (ไร่)</label><input type="number" min="0" step="0.01" inputmode="decimal" value="${z.areaRai || ""}" placeholder="เช่น 2" oninput="App.waterZoneSet(${i}, 'areaRai', this.value)"></div>
          </div>
          <div class="form-row-2">
            <div class="field"><label>นาทีมาตรฐาน</label><input type="number" min="0" step="1" inputmode="numeric" value="${z.defaultMinutes || ""}" placeholder="เช่น 30" oninput="App.waterZoneSet(${i}, 'defaultMinutes', this.value)"></div>
            <div class="field"><label>วิธีรดน้ำ</label><select onchange="App.waterZoneSet(${i}, 'method', this.value)">
              ${WATER_METHODS.map(m => `<option value="${esc(m)}" ${z.method === m ? "selected" : ""}>${esc(m)}</option>`).join("")}
            </select></div>
          </div>
          <div class="field"><label>หมายเหตุ</label><input value="${esc(z.note || "")}" placeholder="เช่น ปั๊มเปิดได้ทีละ 2 ไร่ / วาล์วกลางแปลง" oninput="App.waterZoneSet(${i}, 'note', this.value)"></div>
        </div>`).join("") : `<div class="water-zone-empty">กดเพิ่มโซน เช่น หน้าแปลง กลางแปลง ท้ายแปลง แล้วกำหนดนาทีที่ใช้ประจำ</div>`}
    </div>`;
}
App.modalPlotWaterZones = function (plotId) {
  const p = plotById(S, plotId);
  if (!p) return;
  plotWaterZonePlotId = plotId;
  plotWaterZoneDraft = plotWaterZones(p).map(z => ({ ...z }));
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>โซนน้ำของ ${esc(p.name)}</h3>
    <div class="modal-sub">ตั้งโซนที่ต้องรดประจำไว้ครั้งเดียว แล้วใช้ปุ่มลัดตอนบันทึกกิจกรรมรดน้ำ</div>
    <div id="waterZoneDraftMount">${waterZoneDraftHtml()}</div>
    <button type="button" class="btn btn-sm btn-ghost btn-block mt-8" onclick="App.waterZoneAdd()">${ic("plus")} เพิ่มโซน</button>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button type="button" class="btn btn-primary" onclick="App.savePlotWaterZones()">บันทึกโซนน้ำ</button>
    </div>`);
};
App.waterZoneSet = function (i, key, value) {
  if (!plotWaterZoneDraft[i]) return;
  plotWaterZoneDraft[i][key] = ["areaRai", "defaultMinutes"].includes(key) ? (Number(value) || 0) : String(value || "");
  const mount = document.getElementById("waterZoneDraftMount");
  const summary = mount ? mount.querySelector(".water-zone-summary") : null;
  if (summary) {
    const totalArea = plotWaterZoneDraft.reduce((sum, z) => sum + (Number(z.areaRai) || 0), 0);
    const totalMinutes = plotWaterZoneDraft.reduce((sum, z) => sum + (Number(z.defaultMinutes) || 0), 0);
    summary.innerHTML = `<span>${fmtNum(plotWaterZoneDraft.length)} โซน</span><span>${fmtNum(totalArea)} ไร่</span><span>${fmtNum(totalMinutes)} นาที/รอบ</span>`;
  }
};
App.waterZoneAdd = function () {
  plotWaterZoneDraft.push({ id: uid(), name: "โซน " + (plotWaterZoneDraft.length + 1), areaRai: "", defaultMinutes: 30, method: "ระบบน้ำ", note: "" });
  const mount = document.getElementById("waterZoneDraftMount");
  if (mount) mount.innerHTML = waterZoneDraftHtml();
};
App.waterZoneRemove = function (i) {
  plotWaterZoneDraft.splice(i, 1);
  const mount = document.getElementById("waterZoneDraftMount");
  if (mount) mount.innerHTML = waterZoneDraftHtml();
};
App.savePlotWaterZones = function () {
  const p = plotById(S, plotWaterZonePlotId);
  if (!p) return;
  p.waterZones = plotWaterZoneDraft
    .map((z, i) => ({
      id: z.id || uid(),
      name: String(z.name || "").trim() || "โซน " + (i + 1),
      areaRai: Number(z.areaRai) || 0,
      defaultMinutes: Number(z.defaultMinutes) || 0,
      method: String(z.method || "ระบบน้ำ").trim() || "ระบบน้ำ",
      note: String(z.note || "").trim()
    }))
    .filter(z => z.name || z.areaRai > 0 || z.defaultMinutes > 0 || z.note);
  saveState(S);
  closeModal();
  render();
  toast("บันทึกโซนน้ำของแปลงแล้ว");
};

/* ---- cycle form ---- */
/* แผนงานอัตโนมัติ: โชว์สูตรให้ตรวจ/แก้ก่อนยืนยัน (ติ๊กเลือกงาน + แก้วัน/ข้อความได้) */
App._ppKey = null;
App._cycleRoundAuto = true;
App.pickPlaybook = function (key) {
  const inp = document.getElementById("f_plant");
  if (inp) inp.value = key;
  App._ppKey = null; /* บังคับวาดใหม่ */
  App.planPreviewRefresh();
};
App.planPreviewDatesRefresh = function () {
  const start = (document.getElementById("f_start") || {}).value || "";
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start);
  document.querySelectorAll("#planPreview [data-pp-row]").forEach(row => {
    const day = Math.max(0, Number((row.querySelector(".pp-day") || {}).value) || 0);
    const dateEl = row.querySelector(".pp-date");
    if (!dateEl) return;
    if (!validStart) {
      dateEl.textContent = "เลือกวันเริ่ม";
      dateEl.title = "";
      return;
    }
    const iso = addDaysISO(start, day);
    dateEl.textContent = dateLabel(iso);
    dateEl.title = iso;
  });
};
App.planPreviewRefresh = function () {
  const box = document.getElementById("planPreview");
  if (!box) return;
  const plant = (document.getElementById("f_plant") || {}).value || "";
  const pb = playbookFor(plant);
  /* ถ้าสูตรเดิม (คีย์ไม่เปลี่ยน) ไม่วาดใหม่ — คงการแก้ไขของผู้ใช้ไว้ */
  if (pb && pb.key === App._ppKey && box.querySelector("[data-pp-row]")) {
    App.planPreviewDatesRefresh();
    return;
  }
  App._ppKey = pb ? pb.key : null;
  if (!pb) {
    box.innerHTML = plant ? `ยังไม่มีสูตรสำเร็จรูปสำหรับ "<b>${esc(plant)}</b>" — จะไม่สร้างงานอัตโนมัติ (กดปุ่มพืชด้านบนเพื่อดูสูตรที่มี)` : `พิมพ์ชื่อพืชข้างบน หรือกดปุ่มพืชด้านบน เพื่อดูแผนงานทั้งฤดู (ติ๊กเลือก/แก้วัน/แก้ข้อความได้ก่อนกดเริ่มปลูก)`;
    return;
  }
  const rows = pb.steps.map((st, i) => `
    <div class="plan-preview-row" data-pp-row="${i}">
      <input type="checkbox" class="pp-chk" checked style="width:auto" title="สร้างงานนี้">
      <input type="number" class="pp-day" value="${st.day}" min="0" style="width:64px;padding:4px 6px" title="วันที่หลังปลูก" oninput="App.planPreviewDatesRefresh()">
      <span class="pp-date"></span>
      <input class="pp-title grow" value="${esc((st.warn ? "⚠️ " : "") + st.title)}" style="flex:1;padding:4px 8px">
    </div>
    <div class="muted" style="font-size:.68rem;margin:-2px 0 4px 30px;line-height:1.4">${esc(st.note || "")}</div>`).join("");
  box.innerHTML = `
    <div class="muted" style="font-size:.74rem;margin-bottom:6px">📋 สูตร <b>${esc(pb.key)}</b> — ${pb.steps.length} งาน · ติ๊ก = สร้าง · แก้วันที่/ข้อความได้ · อิงคำแนะนำกรมวิชาการเกษตร (ปรับตามพื้นที่จริงได้)</div>
    ${rows}`;
  App.planPreviewDatesRefresh();
};

App.cyclePlotChange = function () {
  const plotSel = document.getElementById("f_plot");
  const roundInput = document.getElementById("f_round");
  if (!plotSel || !roundInput || App._cycleRoundAuto === false) return;
  roundInput.value = nextCycleRound(S, plotSel.value);
};
function cycleDateDeltaDays(oldStart, newStart) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(oldStart || "") || !/^\d{4}-\d{2}-\d{2}$/.test(newStart || "")) return 0;
  const oldTime = new Date(oldStart + "T00:00:00").getTime();
  const newTime = new Date(newStart + "T00:00:00").getTime();
  if (!Number.isFinite(oldTime) || !Number.isFinite(newTime)) return 0;
  return Math.round((newTime - oldTime) / 86400000);
}
function playbookDayFromNote(note) {
  const m = String(note || "").match(/วันที่\s*(\d+)\s*หลังปลูก/);
  return m ? Math.max(0, Number(m[1]) || 0) : null;
}
function isPendingAutoCycleTask(t, cycleId) {
  return t && t.cycleId === cycleId
    && t.status !== "done" && t.status !== "failed"
    && /แผนอัตโนมัติ|สูตร/.test(String(t.note || ""));
}
function syncCycleAutoTasks(cycleId, plotId, oldStart, newStart) {
  const delta = cycleDateDeltaDays(oldStart, newStart);
  let touched = 0;
  let shifted = 0;
  (S.tasks || []).forEach(t => {
    if (!isPendingAutoCycleTask(t, cycleId)) return;
    let changed = false;
    if (plotId && t.plotId !== plotId) {
      t.plotId = plotId;
      changed = true;
    }
    if (delta && /^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) {
      const relDay = playbookDayFromNote(t.note);
      t.date = relDay == null ? addDaysISO(t.date, delta) : addDaysISO(newStart, relDay);
      shifted++;
      changed = true;
    }
    if (changed) {
      t.updatedAt = Date.now();
      touched++;
    }
  });
  return { touched, shifted };
}
function playbookTaskType(type) {
  if (TYPE_LABELS[type]) return type;
  if (type === "plant") return "work";
  if (type === "pesticide") return "spray";
  return "work";
}
App.modalCycle = function (plotId, cycleId) {
  const c = cycleId ? cycleById(S, cycleId) : null;
  const selectedPlotId = c ? c.plotId : (plotId || ((S.plots || [])[0] || {}).id || "");
  /* เพิ่มรอบอัตโนมัติ: รอบแรก = รอบ 1, รอบที่ 2 = รอบ 2 ... (นับจากรอบทั้งหมดของแปลงนั้น) */
  const newRound = c ? c.round : nextCycleRound(S, selectedPlotId);
  App._cycleRoundAuto = !c;
  App._ppKey = null;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${c ? "แก้ไขรอบการปลูก" : "เริ่มรอบการปลูกใหม่"}</h3>
    <div class="modal-sub">${c ? "แก้ไขชื่อพืช และวันเริ่มปลูก — อายุและรอบจะคำนวณใหม่ตามวันที่ที่แก้" : `รอบการปลูกจะเพิ่มเป็น <b>รอบที่ ${newRound}</b> ของแปลงนี้ อัตโนมัติ`}</div>
    <form onsubmit="return App.submitCycle(event, '${c ? c.id : ""}')">
      <div class="field"><label>แปลง *</label><select id="f_plot" required onchange="App.cyclePlotChange()">
        ${S.plots.map(p => `<option value="${p.id}" ${selectedPlotId === p.id ? "selected" : ""}>${esc(p.name)} — ${fmtNum(p.sizeRai)} ไร่</option>`).join("")}
      </select></div>
      ${c ? "" : `<div class="field"><label>เลขรอบ (อัตโนมัติ)</label><input id="f_round" type="number" min="1" value="${newRound}" oninput="App._cycleRoundAuto=false"><div class="hint">เพิ่มรอบใหม่ระบบจะนับให้อัตโนมัติ (รอบ 1, รอบ 2...) — เปลี่ยนแปลงแล้วเลขรอบจะตามอัตโนมัติจนกว่าจะแก้เลขเอง</div></div>`}
      <div class="field"><label>ชื่อพืช / รอบ *</label><input id="f_plant" value="${c ? esc(c.plant) : ""}" placeholder="เช่น ข้าวโพดหวาน / ข้าวนาปี" required oninput="App.planPreviewRefresh()" onchange="App.planPreviewRefresh()"></div>
      ${c ? "" : `
      <div class="field">
        <label>สูตรแผนดูแลอัตโนมัติ — กดพืชเพื่อดูแผน ตรวจ/แก้ได้ก่อนยืนยัน</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${Object.keys(CROP_PLAYBOOKS).map(k => `<button type="button" class="btn btn-sm btn-outline" onclick="App.pickPlaybook('${k}')">${k}</button>`).join("")}
        </div>
        <div id="planPreview" class="muted" style="font-size:.76rem">พิมพ์ชื่อพืชข้างบน หรือกดปุ่มพืชด้านบน เพื่อดูแผนงานทั้งฤดู (ติ๊กเลือก/แก้วัน/แก้ข้อความได้ก่อนกดเริ่มปลูก)</div>
      </div>`}
      <div class="field"><label>วันที่เริ่ม *</label><input id="f_start" type="date" value="${c ? c.startDate : todayISO()}" required oninput="App.planPreviewDatesRefresh()" onchange="App.planPreviewDatesRefresh()"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${c ? "บันทึกการแก้ไข" : "เริ่มปลูก"}</button>
      </div>
    </form>`);
  App.cyclePlotChange();
  App.planPreviewDatesRefresh();
};
App.submitCycle = function (e, cycleId) {
  e.preventDefault();
  const plotId = document.getElementById("f_plot").value;
  const plant = document.getElementById("f_plant").value.trim();
  const start = document.getElementById("f_start").value;
  if (!plant) return false;
  if (cycleId) {
    const c = cycleById(S, cycleId);
    const oldStart = c ? c.startDate : "";
    let synced = { touched: 0, shifted: 0 };
    if (c) {
      c.plotId = plotId;
      c.plant = plant;
      c.startDate = start;
      synced = syncCycleAutoTasks(c.id, plotId, oldStart, start);
    }
    saveState(S);
    closeModal();
    render();
    toast("บันทึกการแก้ไขรอบแล้ว" + (synced.touched ? ` · ปรับงานอัตโนมัติ ${synced.touched} งาน` : ""));
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
      const st = (playbookFor(plant) || { steps: [] }).steps[Number(row.dataset.ppRow) || 0] || {};
      const note = "แผนอัตโนมัติ (วันที่ " + day + " หลังปลูก)" + (st.note ? " — " + st.note : "");
      S.tasks.push({
        id: uid(), title, date: addDaysISO(start, day), type: playbookTaskType(st.type),
        plotId, cycleId: c.id, status: "planned",
        note, createdAt: Date.now()
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
/* รายชื่อบริษัท/ผู้จำหน่ายที่เคยใช้ — จากสต็อกปัจจุบัน + รายการตั้งต้นถ้ามี
   ใช้เป็นตัวเลือกค้นหา (datalist) ในฟอร์มเพิ่ม/แก้ไข */
function stockSuppliers() {
  const set = new Set();
  (S.stock || []).forEach(x => { const v = String(x.supplier || "").trim(); if (v) set.add(v); });
  (typeof STOCK_MASTER_PRESETS !== "undefined" ? STOCK_MASTER_PRESETS : []).forEach(p => { const v = String(p.supplier || "").trim(); if (v) set.add(v); });
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
      <div class="field"><label>หมวดสินค้า</label>
        <select id="s_category">
          <option value="">-- ไม่มีหมวด --</option>
          ${STOCK_CATS.map(c => `<option value="${esc(c)}" ${x && x.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>หน่วยนับ *</label><input id="s_unit" list="stockUnitList" value="${x ? esc(x.unit) : ""}" placeholder="เลือกจากรายการหรือพิมพ์เอง เช่น ถุง / ขวด / ลิตร" required>
        <datalist id="stockUnitList">${STOCK_UNITS.map(u => `<option value="${esc(u)}">`).join("")}</datalist>
      </div>
      <div class="field"><label>จำนวนเริ่มต้น</label><input id="s_qty" type="number" min="0" step="1" value="${x ? x.qty : 0}">
        <div class="hint">สต็อกหลักเก็บเป็นจำนวนเต็ม (ถุง/ขวดเต็ม) — ของที่ใช้ไม่หมดจะไปเป็น "ของเหลือจากการเปิดใช้" อัตโนมัติ</div></div>
      <div class="field"><label>ราคาต้นทุนต่อหน่วย (บาท)</label><input id="s_price" type="number" min="0" step="0.5" value="${x ? x.avgCost : 0}"></div>
      <details class="optional-fields" ${x ? "open" : ""}>
        <summary>${ic("menu")} รายละเอียดเสริม</summary>
        <div class="field"><label>ชื่อสามัญ (สารออกฤทธิ์ / สูตร)</label><input id="s_generic" value="${x ? esc(x.generic || "") : ""}" placeholder="เช่น ไกลโฟเซต หรือ 46-0-0"></div>
        <div class="form-row-2">
          <div class="field"><label>รหัสสินค้าเดิม</label><input id="s_code" value="${x ? esc(x.code || "") : ""}" placeholder="เช่น 00-0000-269"></div>
          <div class="field"><label>ขนาดสินค้า</label><input id="s_size" value="${x ? esc(x.size || "") : ""}" placeholder="เช่น 50 กก. / 5 ลิตร"></div>
        </div>
        <div class="field"><label>บริษัท / ผู้จำหน่าย</label><input id="s_supplier" list="stockSupplierList" value="${x ? esc(x.supplier || "") : ""}" placeholder="เช่น ซินเจนทา / บาก้า">
          <datalist id="stockSupplierList">${stockSuppliers().map(s => `<option value="${esc(s)}">`).join("")}</datalist>
        </div>
        <div class="form-row-2">
          <div class="field"><label>ราคาทั่วไปต่อหน่วย (บาท)</label><input id="s_saleprice" type="number" min="0" step="0.5" value="${x ? (x.salePrice || "") : ""}" placeholder="เว้นว่างไว้ได้"></div>
          <div class="field"><label>ราคาลูกค้าประจำ (บาท)</label><input id="s_memberprice" type="number" min="0" step="0.5" value="${x ? (x.memberPrice || "") : ""}" placeholder="เว้นว่างไว้ได้"></div>
        </div>
      </details>
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
    salePrice: Number(document.getElementById("s_saleprice").value) || 0,
    memberPrice: Number(document.getElementById("s_memberprice").value) || 0
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
      <div class="field"><label>จำนวนที่ตัด * (${esc(item.unit)})</label><input id="d_qty" type="number" min="1" max="${item.qty}" required oninput="App.stockDeductLimit(this, '${id}')">
        <div class="stock-limit" id="dLimit">${ic("info")} ตัดได้ไม่เกิน ${fmtNum(item.qty)} ${esc(item.unit)}</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">ตัดสต็อก</button>
      </div>
    </form>`);
};
App.stockDeductLimit = function (input, id) {
  const item = stockById(S, id);
  if (!input || !item) return true;
  const max = Number(item.qty) || 0;
  const qty = Number(input.value) || 0;
  const over = qty > max;
  const msg = over ? `จำนวนเกิน — ตัดได้ไม่เกิน ${fmtNum(max)} ${item.unit}` : `ตัดได้ไม่เกิน ${fmtNum(max)} ${item.unit}`;
  const limit = document.getElementById("dLimit");
  if (limit) {
    limit.innerHTML = `${ic(over ? "alert" : "info")} ${esc(msg)}`;
    limit.classList.toggle("is-error", over);
  }
  input.setCustomValidity(over ? msg : "");
  input.closest(".field").classList.toggle("field-invalid", over);
  if (!over) clearModalFieldError(input);
  return !over;
};
App.submitDeduct = function (e, id) {
  e.preventDefault();
  const input = document.getElementById("d_qty");
  if (!App.stockDeductLimit(input, id)) {
    setModalFieldError(input, input.validationMessage);
    (input.closest(".field") || input).scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (err) { input.focus(); } }, 220);
    return false;
  }
  const qty = Number(input.value);
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
let taskFormPhotos = [];
let taskDonePhotos = [];
let taskCompleteReturnToDetail = false;
let taskEditReturnToDetail = false;
let taskFinishSaving = false;
const taskPhotoUploading = { form: false, done: false };
function taskPhotos(t) {
  if (!t) return [];
  if (Array.isArray(t.photos)) return t.photos.map(p => String(p || "").trim()).filter(Boolean);
  return t.photo ? [String(t.photo).trim()].filter(Boolean) : [];
}
function taskDonePhotosOf(t) {
  return t && Array.isArray(t.donePhotos) ? t.donePhotos.map(p => String(p || "").trim()).filter(Boolean) : [];
}
function taskAllPhotos(t) {
  return [...taskPhotos(t), ...taskDonePhotosOf(t)];
}
function taskPhotoRecommended(t) {
  return !!t && ["inspect", "spray", "fertilize"].includes(t.type);
}
function taskPhotoUrl(photo) {
  return stockPhotoSrc({ photo });
}
function taskPhotoPreviewHtml(photos, mode) {
  const label = mode === "done" ? "รูปหลังทำ" : "รูปกิจกรรม";
  if (!photos.length) return `<div class="task-photo-empty">${ic("camera")} ยังไม่มี${label}</div>`;
  return `<div class="task-photo-strip">${photos.map((p, i) => `
    <div class="task-photo-thumb">
      <img src="${esc(taskPhotoUrl(p))}" alt="${label}" loading="lazy" onclick="App.viewTaskTempPhoto('${mode}', ${i})" onerror="this.closest('.task-photo-thumb').remove()">
      <button type="button" class="task-photo-remove" aria-label="ลบรูปนี้" onclick="event.stopPropagation();App.taskRemovePhoto('${mode}', ${i})">✕</button>
    </div>`).join("")}</div>`;
}
function renderTaskPhotoPreview(mode) {
  const el = document.getElementById(mode === "done" ? "taskDonePhotoPreview" : "taskPhotoPreview");
  if (el) el.innerHTML = taskPhotoPreviewHtml(mode === "done" ? taskDonePhotos : taskFormPhotos, mode);
}
async function readTaskPhotoFile(file) {
  const url = await App.uploadPhotoR2(file, 1280);
  if (url) return url;
  return downscaleImage(file, 760, 0.72);
}
App.taskPickPhotos = function (mode) {
  const key = mode === "done" ? "done" : "form";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.style.display = "none";
  input.onchange = async () => {
    const files = input.files ? [...input.files] : [];
    input.remove();
    if (!files.length) return;
    const arr = key === "done" ? taskDonePhotos : taskFormPhotos;
    taskPhotoUploading[key] = true;
    toast("กำลังเพิ่มรูป...");
    try {
      for (const f of files) arr.push(await readTaskPhotoFile(f));
      renderTaskPhotoPreview(key);
      toast(files.length > 1 ? `เพิ่มรูป ${files.length} รูปแล้ว` : "เพิ่มรูปแล้ว");
    } catch (e) {
      toast("อ่านรูปไม่สำเร็จ — ลองไฟล์ JPG/PNG");
    }
    taskPhotoUploading[key] = false;
  };
  document.body.appendChild(input);
  input.click();
};
App.taskRemovePhoto = function (mode, idx) {
  const arr = mode === "done" ? taskDonePhotos : taskFormPhotos;
  arr.splice(idx, 1);
  renderTaskPhotoPreview(mode === "done" ? "done" : "form");
  toast("ลบรูปแล้ว");
};
let taskLightboxEl = null;
function showTaskLightbox(photos, idx, renderAction) {
  const list = (photos || []).filter(Boolean);
  if (!list.length) return;
  const n = list.length;
  const cur = ((idx % n) + n) % n;
  if (!taskLightboxEl) {
    taskLightboxEl = document.createElement("div");
    taskLightboxEl.id = "taskLightbox";
    document.body.appendChild(taskLightboxEl);
  }
  taskLightboxEl.innerHTML = `
    <div class="lightbox-backdrop" onclick="App.closeTaskLightbox()">
      <button class="lightbox-x" aria-label="ปิดรูปใหญ่" title="ปิดรูปใหญ่" onclick="App.closeTaskLightbox()">✕</button>
      ${n > 1 ? `<button class="lightbox-nav prev" onclick="event.stopPropagation();${renderAction(cur - 1)}">‹</button>
      <button class="lightbox-nav next" onclick="event.stopPropagation();${renderAction(cur + 1)}">›</button>` : ""}
      <img src="${esc(taskPhotoUrl(list[cur]))}" alt="" onclick="event.stopPropagation()">
      ${n > 1 ? `<div class="lightbox-count">${cur + 1} / ${n}</div>` : ""}
    </div>`;
}
App.closeTaskLightbox = function () {
  if (taskLightboxEl) taskLightboxEl.innerHTML = "";
};
App.viewTaskTempPhoto = function (mode, idx) {
  const key = mode === "done" ? "done" : "form";
  showTaskLightbox(key === "done" ? taskDonePhotos : taskFormPhotos, idx, next => `App.viewTaskTempPhoto('${key}', ${next})`);
};
App.viewTaskPhoto = function (id, group, idx) {
  const t = S.tasks.find(x => x.id === id);
  if (typeof idx === "undefined") {
    idx = group;
    group = "plan";
  }
  const photos = group === "done" ? taskDonePhotosOf(t) : taskPhotos(t);
  showTaskLightbox(photos, idx, next => `App.viewTaskPhoto('${id}', '${group}', ${next})`);
};
function taskWateringDetailHtml(t) {
  const rows = normalizeTaskWaterSessions(t && t.wateringSessions);
  if (!rows.length) return "";
  const total = rows.reduce((a, w) => a + (Number(w.minutes) || 0), 0);
  const area = rows.reduce((a, w) => a + (Number(w.areaRai) || 0), 0);
  const groups = [];
  Object.keys(WATER_PERIOD_LABELS).forEach(k => {
    const list = rows.filter(w => (w.period || "custom") === k);
    if (list.length) groups.push([k, list]);
  });
  const seen = new Set(Object.keys(WATER_PERIOD_LABELS));
  rows.filter(w => w.period && !seen.has(w.period)).forEach(w => {
    seen.add(w.period);
    groups.push([w.period, rows.filter(x => x.period === w.period)]);
  });
  return `
    <div class="td-note task-water-detail">
      <div class="td-note-title">${ic("droplet")} รอบรดน้ำ (${fmtNum(rows.length)} รอบ · รวม ${fmtNum(total)} นาที${area ? " · " + fmtNum(area) + " ไร่" : ""})</div>
      <div class="task-water-detail-list">
        ${groups.map(([period, list]) => `
          <div class="task-water-period-group">
            <div class="task-water-period-title">${esc(WATER_PERIOD_LABELS[period] || period || "รอบรดน้ำ")}</div>
            ${list.map(w => {
              const meta = [];
              if (w.start) meta.push(w.start);
              if (w.minutes) meta.push(`${fmtNum(w.minutes)} นาที`);
              if (w.areaRai) meta.push(`${fmtNum(w.areaRai)} ไร่`);
              if (w.method) meta.push(w.method);
              return `<div class="task-water-detail-row">
                <span><b>${esc(w.zone || "ไม่ระบุโซน")}</b>${meta.length ? `<small>${esc(meta.join(" · "))}</small>` : ""}</span>
                <em>${esc(WATER_STATUS_LABELS[w.status] || w.status || "วางแผนไว้")}</em>
              </div>`;
            }).join("")}
          </div>`).join("")}
      </div>
    </div>`;
}
function doneWaterSessionsForTask(t) {
  if (!t || t.type !== "water") return [];
  const base = normalizeTaskWaterSessions(t.wateringSessions && t.wateringSessions.length ? t.wateringSessions : defaultWaterSessionsForPlot(t.plotId || ""));
  const fallbackStatus = t.status === "failed" ? "failed" : "done";
  return base.map(w => ({
    ...w,
    status: (t.status === "done" || t.status === "failed") ? (w.status || fallbackStatus) : fallbackStatus
  }));
}
function taskDoneWaterSessionsHtml() {
  if (!taskDoneWaterSessions.length) return "";
  return `
    <div class="task-water-result-panel">
      <div class="task-water-result-head">
        <div>
          <b>${ic("droplet")} ผลรอบรดน้ำ</b>
          <span>เลือกว่ารอบไหนทำแล้ว หรือไม่ได้ทำจริง</span>
        </div>
        <div class="task-water-result-actions">
          <button type="button" class="btn btn-sm btn-ghost" onclick="App.taskDoneWaterAll('done')">ทำแล้วทั้งหมด</button>
          <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.taskDoneWaterAll('failed')">ไม่ได้ทำทั้งหมด</button>
        </div>
      </div>
      <div class="task-water-result-list">
        ${taskDoneWaterSessions.map((w, i) => {
          const meta = [];
          if (w.start) meta.push(w.start);
          if (w.minutes) meta.push(`${fmtNum(w.minutes)} นาที`);
          if (w.areaRai) meta.push(`${fmtNum(w.areaRai)} ไร่`);
          if (w.method) meta.push(w.method);
          return `<div class="task-water-result-row">
            <div>
              <b>${esc(w.zone || WATER_PERIOD_LABELS[w.period] || "รอบ " + (i + 1))}</b>
              <span>${esc([WATER_PERIOD_LABELS[w.period] || w.period, ...meta].filter(Boolean).join(" · "))}</span>
            </div>
            <select onchange="App.taskDoneWaterSet(${i}, this.value)" aria-label="ผลรอบรดน้ำ">
              <option value="done" ${w.status === "done" ? "selected" : ""}>ทำแล้ว</option>
              <option value="failed" ${w.status === "failed" ? "selected" : ""}>ไม่ได้ทำ</option>
              <option value="planned" ${w.status === "planned" ? "selected" : ""}>ยังวางแผนไว้</option>
            </select>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}
App.taskDoneWaterSet = function (i, status) {
  if (!taskDoneWaterSessions[i]) return;
  taskDoneWaterSessions[i].status = ["done", "failed", "planned"].includes(status) ? status : "done";
};
App.taskDoneWaterAll = function (status) {
  taskDoneWaterSessions = taskDoneWaterSessions.map(w => ({ ...w, status: status === "failed" ? "failed" : "done" }));
  const box = document.getElementById("taskWaterResultMount");
  if (box) box.innerHTML = taskDoneWaterSessionsHtml();
};

function normalizePlotWaterZones(p) {
  if (!p) return [];
  if (!Array.isArray(p.waterZones)) p.waterZones = [];
  p.waterZones = p.waterZones.map((z, i) => ({
    id: String(z.id || "").trim() || uid(),
    name: String(z.name || "").trim() || "โซน " + (i + 1),
    areaRai: Number(z.areaRai) || 0,
    defaultMinutes: Number(z.defaultMinutes) || 0,
    method: String(z.method || "ระบบน้ำ").trim() || "ระบบน้ำ",
    note: String(z.note || "").trim()
  })).filter(z => z.name || z.areaRai > 0 || z.defaultMinutes > 0 || z.note);
  return p.waterZones;
}
function plotWaterZones(plotOrId) {
  const p = typeof plotOrId === "string" ? plotById(S, plotOrId) : plotOrId;
  return normalizePlotWaterZones(p);
}
function plotWaterZonesCard(p) {
  const zones = plotWaterZones(p);
  const totalArea = zones.reduce((sum, z) => sum + (Number(z.areaRai) || 0), 0);
  const totalMinutes = zones.reduce((sum, z) => sum + (Number(z.defaultMinutes) || 0), 0);
  const zoneHtml = zones.length ? `
    <div class="water-zone-grid">
      ${zones.map(z => `
        <div class="water-zone-pill">
          <b>${esc(z.name)}</b>
          <span>${z.areaRai ? fmtNum(z.areaRai) + " ไร่" : "ไม่ระบุพื้นที่"} · ${z.defaultMinutes ? fmtNum(z.defaultMinutes) + " นาที" : "ยังไม่ตั้งนาที"}</span>
          <small>${esc([z.method, z.note].filter(Boolean).join(" · ") || "ระบบน้ำ")}</small>
        </div>`).join("")}
    </div>` : `
    <div class="water-zone-empty">ยังไม่มีโซนน้ำประจำแปลง ตั้งไว้ครั้งเดียวแล้วตอนเพิ่มกิจกรรมรดน้ำจะกดเติมรอบได้เร็วขึ้น</div>`;
  return `
  <div class="card water-zone-card">
    <div class="row row-between water-zone-card-head">
      <div>
        <div class="bold">${ic("droplet")} โซนน้ำประจำแปลง</div>
        <div class="muted">${zones.length ? `${fmtNum(zones.length)} โซน · รวม ${fmtNum(totalArea)} ไร่ · ${fmtNum(totalMinutes)} นาที/รอบ` : "ช่วยลดการพิมพ์ซ้ำเวลารดน้ำหลายจุด"}</div>
      </div>
      <button class="btn btn-sm btn-outline" onclick="App.modalPlotWaterZones('${p.id}')">${ic("pencil")} จัดการ</button>
    </div>
    ${zoneHtml}
  </div>`;
}
/* ดูรายละเอียดงาน — กดที่แถวงานเพื่อดูว่าต้องทำอะไร + จัดการได้ */
App.viewTask = function (id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const p = t.plotId ? plotById(S, t.plotId) : null;
  const c = t.cycleId ? cycleById(S, t.cycleId) : null;
  const st = t.stockId ? stockById(S, t.stockId) : null;
  const rows = [
    { k: "วันที่", v: `${dateLabel(t.date)} (${t.date})` },
    ...(t.status === "done" || t.status === "failed" ? [{ k: t.status === "failed" ? "บันทึกผล" : "ทำจริง", v: `${dateLabel(taskDoneDate(t))}${t.doneTime || (t.weatherSnapshot && t.weatherSnapshot.targetTime) ? " " + (t.doneTime || t.weatherSnapshot.targetTime) : ""}` }] : []),
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
  const planPhotos = taskPhotos(t);
  const donePhotos = taskDonePhotosOf(t);
  const planPhotoHtml = planPhotos.length ? `
    <div class="td-photo-section">
      <div class="td-note-title">${ic("camera")} รูปก่อนทำ / รูปประกอบ (${fmtNum(planPhotos.length)})</div>
      <div class="task-photo-strip detail">
        ${planPhotos.map((p, i) => `<button class="task-photo-thumb readonly" onclick="App.viewTaskPhoto('${t.id}', 'plan', ${i})" title="ดูรูปใหญ่"><img src="${esc(taskPhotoUrl(p))}" alt="รูปก่อนทำ" loading="lazy" onerror="this.closest('.task-photo-thumb').remove()"></button>`).join("")}
      </div>
    </div>` : "";
  const donePhotoHtml = donePhotos.length ? `
    <div class="td-photo-section td-photo-done">
      <div class="td-note-title">${ic("check")} รูปหลังทำ (${fmtNum(donePhotos.length)})</div>
      <div class="task-photo-strip detail">
        ${donePhotos.map((p, i) => `<button class="task-photo-thumb readonly" onclick="App.viewTaskPhoto('${t.id}', 'done', ${i})" title="ดูรูปใหญ่"><img src="${esc(taskPhotoUrl(p))}" alt="รูปหลังทำ" loading="lazy" onerror="this.closest('.task-photo-thumb').remove()"></button>`).join("")}
      </div>
    </div>` : "";
  const doneNoteHtml = t.doneNote ? `
    <div class="td-note td-done-note">
      <div class="td-note-title">${ic("check")} บันทึกหลังทำ</div>
      <div class="td-note-body">${esc(t.doneNote)}</div>
    </div>` : "";
  const waterDetailHtml = taskWateringDetailHtml(t);
  const weatherDetailHtml = t.weatherSnapshot ? `
    <div class="td-note task-weather-detail">
      <div class="td-note-title">${ic("droplet")} สภาพอากาศตอนทำงาน</div>
      ${weatherSnapshotHtml(t.weatherSnapshot)}
    </div>` : "";
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${esc(t.title)}</h3>
    <div class="modal-sub">${typeTag(t)} ${statusTag(taskStatusOf(t))}</div>
    <div class="td-list">
      ${rows.map(r => `<div class="td-row"><span class="td-k">${r.k}</span><span class="td-v">${esc(r.v)}</span></div>`).join("")}
    </div>
    ${costListHtml}
    ${waterDetailHtml}
    ${planPhotoHtml}
    <div class="td-note">
      <div class="td-note-title">${ic("info")} สิ่งที่ต้องทำ</div>
      ${t.note ? `<div class="td-note-body">${esc(t.note)}</div>` : `<div class="muted" style="font-size:.76rem">ยังไม่มีรายละเอียด — กดแก้ไขเพื่อเพิ่มสิ่งที่ต้องทำ</div>`}
    </div>
    ${donePhotoHtml}
    ${doneNoteHtml}
    ${weatherDetailHtml}
    <div class="modal-actions">
      <button class="btn btn-sm btn-danger-soft" onclick="App.deleteTask('${t.id}')">${ic("trash")} ลบ</button>
      <button class="btn btn-sm btn-outline" onclick="App.editTask('${t.id}')">${ic("pencil")} แก้ไข</button>
      ${t.status === "done" || t.status === "failed"
        ? `<button class="btn btn-sm btn-primary" onclick="App.modalTaskComplete('${t.id}', true)">${ic("camera")} ${t.status === "failed" ? "แก้ผลไม่สำเร็จ" : "แก้ผลหลังทำ"}</button>
           ${taskWeatherPlot(t) ? `<button class="btn btn-sm btn-outline" onclick="App.modalTaskWeatherBackfill('${t.id}')">${ic("droplet")} บันทึกอากาศย้อนหลัง</button>` : ""}
           <button class="btn btn-sm btn-outline" onclick="App.resetTaskPlanned('${t.id}')">${ic("refresh")} กลับเป็นแผน</button>`
        : `<button class="btn btn-sm btn-danger-soft" onclick="App.modalTaskComplete('${t.id}', true, 'failed')">${ic("alert")} งานไม่สำเร็จ</button>
           <button class="btn btn-sm btn-primary" onclick="App.modalTaskComplete('${t.id}', true)">${ic("check")} ทำเสร็จ</button>`}
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
  const root = document.getElementById("modalRoot");
  taskEditReturnToDetail = !!(root && root.innerHTML.trim() !== "" && root.querySelector(".td-list"));
  if (t) App.modalTask(t.date, { taskId: t.id });
};
/* ===== รายการค่าใช้จ่าย/ตัดสต็อก (หลายรายการต่องาน — แบบเว็บอ้างอิง) ===== */
let taskCostItems = [];   // state ชั่วคราวระหว่างเปิด modal
let taskStockQueries = {}; // คำค้นหาสต็อก ต่อรายการ (index -> string) เพื่อไม่ให้ rebuild ขณะพิมพ์
let taskEditingId = "";   // งานที่กำลังแก้ไขอยู่ ใช้บวกยอดเดิมกลับเฉพาะตอนตรวจจำนวน
let taskWaterSessions = []; // รอบรดน้ำหลายช่วงต่อกิจกรรมเดียว
let taskDoneWaterSessions = []; // ผลรอบรดน้ำใน modal ทำเสร็จ/ไม่สำเร็จ
function taskOriginalStockQty(stockId) {
  if (!taskEditingId || !stockId) return 0;
  const t = S.tasks.find(x => x.id === taskEditingId);
  if (!t) return 0;
  const rows = (t.costItems && t.costItems.length)
    ? t.costItems
    : (t.stockId ? [{ stockId: t.stockId, qty: t.qty }] : []);
  return rndQty(rows
    .filter(x => x.stockId === stockId)
    .reduce((sum, x) => sum + (Number(x.qty) || 0), 0));
}
function costEditableAvail(stockId, rowIndex) {
  const st = stockById(S, stockId);
  if (!st) return 0;
  const actual = rndQty((Number(st.qty) || 0) + (Number(st.openQty) || 0));
  const original = taskOriginalStockQty(stockId);
  const usedByOtherRows = taskCostItems.reduce((sum, row, idx) => {
    if (idx === rowIndex || !row || row.stockId !== stockId) return sum;
    return sum + (Number(row.qty) || 0);
  }, 0);
  return rndQty(Math.max(0, actual + original - usedByOtherRows));
}
/* รายการสต็อกใน picker (กรองตามคำค้น) */
function stockPickItemsHtml(i) {
  const it = taskCostItems[i];
  if (!it) return "";
  const q = (taskStockQueries[i] || "").trim().toLowerCase();
  /* เอาเฉพาะรายการที่มีของ (ยาหมดไม่โชว์ในตัวเลือกตัดสต็อก) */
  const list = S.stock.filter(x => {
    const avail = costEditableAvail(x.id, i);
    if (avail <= 0 && it.stockId !== x.id) return false;
    return !q || x.name.toLowerCase().includes(q) || (x.code || "").toLowerCase().includes(q) || x.unit.toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q);
  });
  if (!list.length) return `<div class="muted" style="font-size:.72rem;padding:6px 2px">${q ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีของในสต็อก — ไปรับของเข้าก่อน"}</div>`;
  return list.map(x => {
    const open = rndQty(x.openQty);
    const avail = costEditableAvail(x.id, i);
    const out = avail <= 0; // ของหมด -> แถบแดง + กดไม่ได้
    const sel = it.stockId === x.id;
    const original = taskOriginalStockQty(x.id);
    const sub = original > 0
      ? `แก้ได้ ${fmtNum(avail)} ${esc(x.unit)} (รวมของเดิม ${fmtNum(original)})`
      : (open > 0 ? `หลัก ${fmtNum(x.qty)} + เหลือเปิด ${fmtNum(open)} ${esc(x.unit)}` : `คงเหลือ ${fmtNum(x.qty)} ${esc(x.unit)}`);
    return `<button type="button" class="stock-pick-item ${sel ? "selected" : ""} ${out ? "out" : ""}" onclick="App.costSet(${i}, 'stockId', '${x.id}')" ${sel ? `title="กดอีกครั้งเพื่อเอารายการนี้ออก"` : ""}>
      <span class="sp-name">${esc(x.name)}</span>${sel ? `<span class="sp-x">✕</span>` : (out ? `<span class="sp-out">ยาหมด</span>` : `<span class="sp-sub">${sub}</span>`)}
    </button>`;
  }).join("");
}
function costAvailInfo(it, rowIndex) {
  if (!it || !it.stockId) return null;
  const st = stockById(S, it.stockId);
  if (!st) return null;
  const avail = costEditableAvail(it.stockId, rowIndex);
  const original = taskOriginalStockQty(it.stockId);
  const need = Number(it.qty) || 0;
  const unit = st.unit || it.unit || "";
  let msg = original > 0
    ? `แก้ได้ไม่เกิน ${fmtNum(avail)} ${unit} (รวมของเดิมในกิจกรรมนี้ ${fmtNum(original)} ${unit})`
    : `ใช้ได้ไม่เกิน ${fmtNum(avail)} ${unit}`;
  let over = false;
  if (avail <= 0) {
    msg = `"${st.name}" หมดแล้ว — ไม่มี ${unit} เหลือในสต็อก`;
    over = true;
  } else if (need - avail > 1e-9) {
    msg = `จำนวนเกิน — ใช้ได้ไม่เกิน ${fmtNum(avail)} ${unit}`;
    over = true;
  }
  return { st, avail, need, unit, msg, over };
}
function costLimitHtml(i, it) {
  const info = costAvailInfo(it, i);
  if (!info) return "";
  return `<div class="stock-limit ${info.over ? "is-error" : ""}" id="ciLimit_${i}">${ic(info.over ? "alert" : "info")} ${esc(info.msg)}</div>`;
}
function costCategoryUsesStock(category) {
  const key = String(category || "other");
  if (["chemical", "fertilizer", "seed", "materials"].includes(key)) return true;
  const cat = costCatMap(S)[key];
  const label = cat ? cat.label : "";
  return /(ยา|ปุ๋ย|เคมี|สาร|เมล็ด|พันธุ์|วัสดุ|อุปกรณ์)/.test(label);
}
function costStockPickerHtml(i, it) {
  const show = !!(it && (it.stockId || it.showStockPicker || costCategoryUsesStock(it.category)));
  if (!show) {
    return `<div class="stock-picker-collapsed">
      <span>${ic("box")} หมวดนี้ไม่ต้องเลือกยา/ปุ๋ยจากสต็อก</span>
      <button type="button" class="btn btn-sm btn-outline" onclick="App.costShowStock(${i})">เลือกจากสต็อก</button>
    </div>`;
  }
  return `<div class="stock-picker">
    <input class="sp-search" type="text" placeholder="ค้นหาปุ๋ย/ยา/เมล็ด..." value="${esc(taskStockQueries[i] || "")}" oninput="App.costStockQuery(${i}, this.value)">
    <div class="stock-pick-list" id="stockPickList_${i}">${stockPickItemsHtml(i)}</div>
  </div>
  <div class="hint">ใช้ของที่เหลือจากการเปิดใช้ก่อน แล้วเบิกจากหลักเป็นหน่วยเต็ม (ปัดขึ้น) เศษเป็นของเหลือ</div>`;
}
App.costShowStock = function (i) {
  if (!taskCostItems[i]) return;
  taskCostItems[i].showStockPicker = true;
  App.costRender();
};
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
      priceMode = v === (Number(st.avgCost) || 0) ? "cost" : ((st.memberPrice && v === (Number(st.memberPrice) || 0)) ? "member" : ((st.salePrice && v === (Number(st.salePrice) || 0)) ? "sale" : "custom"));
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
          ${costStockPickerHtml(i, it)}
        </div>
      </div>
      ${it.stockId ? calcBoxHtml(i, it) : ""}
      <div class="field"><label>ชื่อรายการ / รายละเอียด</label>
        <input class="ci-name" value="${esc(it.name || "")}" placeholder="เช่น ค่าน้ำมัน, ยาจากร้านนอกสต็อก" oninput="App.costSet(${i}, 'name', this.value)">
      </div>
      <div class="form-row-2">
        <div class="field"><label>จำนวนที่ใช้</label><input class="ci-qty" type="number" min="0" ${st ? `max="${costAvailInfo(it, i).avail}"` : ""} step="0.01" value="${it.qty || ""}" oninput="App.costSet(${i}, 'qty', this.value)">
          ${costLimitHtml(i, it)}
        </div>
        <div class="field"><label>หน่วย</label><input class="ci-unit" value="${esc(it.unit || "")}" placeholder="เช่น cc, กก., ขวด" oninput="App.costSet(${i}, 'unit', this.value)"></div>
      </div>
      <div class="form-row-2">
        <div class="field"><label>ราคาต่อหน่วย</label>
          ${st ? `
          <select class="ci-pricemode" onchange="App.costPriceMode(${i}, this.value)" title="เลือกใช้ราคาไหนคำนวณต้นทุน">
            <option value="cost" ${priceMode === "cost" ? "selected" : ""}>ต้นทุน (${fmtMoney(st.avgCost)} บาท)</option>
            ${st.salePrice ? `<option value="sale" ${priceMode === "sale" ? "selected" : ""}>ราคาทั่วไป (${fmtMoney(st.salePrice)} บาท)</option>` : ""}
            ${st.memberPrice ? `<option value="member" ${priceMode === "member" ? "selected" : ""}>ลูกค้าประจำ (${fmtMoney(st.memberPrice)} บาท)</option>` : ""}
            <option value="custom" ${priceMode === "custom" ? "selected" : ""}>พิมพ์เอง…</option>
          </select>` : ""}
          <input class="ci-price" type="number" min="0" step="0.01" value="${it.unitCost || ""}" ${(st && priceMode !== "custom") ? "readonly" : ""} oninput="App.costSet(${i}, 'unitCost', this.value)">
        </div>
        <div class="field"><label>รวมเป็นเงิน</label><input class="ci-total" type="number" readonly value="${it.totalCost || ""}"></div>
      </div>
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
function stockUnitNeedsSize(st) {
  if (!st) return false;
  const unit = String(st.unit || "").trim().replace(/\.+$/, "");
  return !!unit && !sizeFamily(unit);
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
  if (stockUnitNeedsSize(st)) return null;
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
        <div class="grow field" style="margin:0"><label>ขนาดต่อ 1 ${esc(st.unit)}</label><input class="ci-szamt" type="number" min="0" step="0.1" value="${it.calcSizeAmt || ""}" placeholder="เช่น 1000" oninput="App.costCalcSize(${i}, this.value)"></div>
        <div class="field" style="margin:0"><label>หน่วย</label><select class="ci-szunit" onchange="App.costCalcSize(${i}, null, this.value)">
          ${[["ซีซี", "ซีซี"], ["มล.", "มล"], ["ลิตร", "ลิตร"], ["กรัม", "กรัม"], ["กก.", "กก"]].map(u => `<option value="${u[1]}" ${(it.calcSizeUnit || "ซีซี") === u[1] ? "selected" : ""}>${u[0]}</option>`).join("")}
        </select></div>
      </div>
      <button type="button" class="btn btn-sm btn-outline calc-size-save" onclick="App.costSaveCalcSize(${i})">${ic("save")} บันทึกขนาดนี้</button>
      <div class="hint" style="margin-top:6px;margin-bottom:8px">กรอกให้ครบก่อน เช่น 1 ลิตร หรือ 100 ซีซี แล้วค่อยกดบันทึกขนาดนี้</div>`}
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
      <div class="calc-result" id="calcResult_${i}"><div class="hint">${known ? "กรอกพื้นที่และอัตราใช้เพื่อคำนวณจำนวนที่ใช้ — จำนวนจะถูกกรอกและตัดสต็อกอัตโนมัติ" : "กรอกขนาดสินค้าให้ครบ แล้วกดบันทึกขนาดนี้ก่อนคำนวณจำนวนใช้"}</div></div>
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
      : `<div class="hint">${it.stockId && stockUnitNeedsSize(stockById(S, it.stockId)) ? "กรอกขนาดสินค้าให้ครบ แล้วกดบันทึกขนาดนี้ก่อนคำนวณจำนวนใช้" : "กรอกพื้นที่และอัตราใช้เพื่อคำนวณจำนวนที่ใช้ — จำนวนจะถูกกรอกและตัดสต็อกอัตโนมัติ"}</div>`;
  }
  if (r && r.qty > 0) {
    it.qty = r.qty;
    it.unit = r.unit;
    App.costSet(i, "qty", r.qty);
  }
};
/* กรอกขนาดสินค้าที่กล่องคำนวณ (กรณีสินค้ายังไม่ตั้งขนาด) — เก็บชั่วคราวก่อน รอให้ผู้ใช้กดบันทึก */
App.costCalcSize = function (i, amt, unit) {
  const it = taskCostItems[i];
  if (!it || !it.stockId) return;
  if (amt !== null && amt !== undefined) it.calcSizeAmt = amt;
  if (unit) it.calcSizeUnit = unit;
  const res = document.getElementById("calcResult_" + i);
  if (res) {
    res.innerHTML = `<div class="hint">กรอกขนาดสินค้าให้ครบ แล้วกดบันทึกขนาดนี้ก่อนคำนวณจำนวนใช้</div>`;
  }
};
App.costSaveCalcSize = function (i) {
  const it = taskCostItems[i];
  if (!it || !it.stockId) return;
  const st = stockById(S, it.stockId);
  if (!st) return;
  const val = Number(it.calcSizeAmt) || 0;
  const sizeUnit = it.calcSizeUnit || "ซีซี"; // ค่าเริ่มต้น ซีซี
  const input = document.querySelector(`[data-ci="${i}"] .ci-szamt`);
  if (val <= 0) {
    if (input) {
      setModalFieldError(input, `กรุณากรอกขนาดต่อ 1 ${st.unit}`);
      input.focus();
    }
    return;
  }
  st.size = fmtNum(val) + " " + unitLabel(sizeUnit);
  saveState(S);
  it.calcSizeAmt = "";
  it.calcSizeUnit = "";
  it.calcUnit = defaultCalcUnit(st);
  App.costRender();
  toast(`บันทึกขนาด "${st.size}" ให้ ${st.name} แล้ว — ครั้งหน้าคำนวณได้เลย`);
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
    if (chk && costEditableAvail(value, i) <= 0) {
      toast(`"${chk.name}" หมดแล้ว — ไม่มีเหลือในสต็อก (ถ้าซื้อนอกสต็อกใช้ช่อง "ชื่อรายการ" แทนได้)`);
      return;
    }
  }
  /* กดรายการที่เลือกอยู่ซ้ำ -> ยกเลิกการเลือก (เอารายการนี้ออก ไม่ต้องลบทั้งแถว) */
  if (field === "stockId" && value === it.stockId) value = "";
  it[field] = value;
  if (field === "category") {
    if (!costCategoryUsesStock(value) && !it.stockId) it.showStockPicker = false;
    if (costCategoryUsesStock(value)) it.showStockPicker = true;
    App.costRender();
    return;
  }
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
      if (!costCategoryUsesStock(it.category)) it.showStockPicker = false;
    }
    it.totalCost = Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0));
    App.costRender();
    return;
  }
  const row = document.querySelector(`[data-ci="${i}"]`);
  it.totalCost = Math.round((Number(it.qty) || 0) * (Number(it.unitCost) || 0));
  if (row) {
    const qtyInput = row.querySelector(".ci-qty");
    if (qtyInput && document.activeElement !== qtyInput) qtyInput.value = it.qty || "";
    row.querySelector(".ci-total").value = it.totalCost || "";
  }
  App.costSum();
  checkStockWarn(i, it, row);
};
/* เลือกใช้ราคาต่อหน่วยของวัสดุจากสต็อก: ต้นทุน / ราคาทั่วไป / ลูกค้าประจำ / พิมพ์เอง */
App.costPriceMode = function (i, mode) {
  const it = taskCostItems[i];
  if (!it || !it.stockId) return;
  const st = stockById(S, it.stockId);
  if (!st) return;
  it.priceMode = mode;
  const input = document.querySelector(`[data-ci="${i}"] .ci-price`);
  if (mode === "cost") it.unitCost = (Number(st.avgCost) || 0).toFixed(2);
  else if (mode === "sale") it.unitCost = (Number(st.salePrice) || 0).toFixed(2);
  else if (mode === "member") it.unitCost = (Number(st.memberPrice) || 0).toFixed(2);
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
  const limit = document.getElementById("ciLimit_" + i);
  const qtyInput = row ? row.querySelector(".ci-qty") : null;
  const field = qtyInput ? qtyInput.closest(".field") : null;
  const info = costAvailInfo(it, i);
  const msg = info && info.over ? info.msg : "";
  if (limit && info) {
    limit.innerHTML = `${ic(info.over ? "alert" : "info")} ${esc(info.msg)}`;
    limit.classList.toggle("is-error", info.over);
  }
  if (warn) warn.hidden = true;
  if (qtyInput) {
    qtyInput.max = info ? String(info.avail) : "";
    qtyInput.setCustomValidity(msg);
    if (!msg) clearModalFieldError(qtyInput);
  }
  if (field) field.classList.toggle("field-invalid", !!msg);
  return msg;
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
const WATER_PERIOD_LABELS = {
  morning: "เช้า",
  noon: "กลางวัน",
  evening: "เย็น",
  custom: "กำหนดเอง"
};
const WATER_STATUS_LABELS = {
  planned: "วางแผนไว้",
  done: "ทำแล้ว",
  failed: "ไม่ได้ทำ"
};
const WATER_METHODS = ["ระบบน้ำ", "สปริงเกอร์", "น้ำหยด", "สายยาง", "ร่องน้ำ", "อื่นๆ"];
function defaultWaterSessions() {
  return [
    { period: "morning", start: "06:00", minutes: "", method: "ระบบน้ำ", zone: "", status: "planned" },
    { period: "evening", start: "17:00", minutes: "", method: "ระบบน้ำ", zone: "", status: "planned" }
  ];
}
function addMinutesHHMM(time, minutes) {
  if (!time) return "";
  const m = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time;
  const total = (Number(m[1]) * 60 + Number(m[2]) + Number(minutes || 0)) % 1440;
  const safe = total < 0 ? total + 1440 : total;
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}
function waterZoneMinutes(z) {
  return Number(z && z.defaultMinutes) || 30;
}
function waterZoneRowsForPeriod(plotId, period) {
  const zones = plotWaterZones(plotId);
  const base = ({ morning: "06:00", noon: "12:00", evening: "17:00" })[period] || "";
  let offset = 0;
  return zones.map(z => {
    const minutes = waterZoneMinutes(z);
    const row = {
      zoneId: z.id,
      period,
      start: base ? addMinutesHHMM(base, offset) : "",
      minutes,
      areaRai: Number(z.areaRai) || 0,
      method: z.method || "ระบบน้ำ",
      zone: z.name,
      status: "planned"
    };
    offset += minutes;
    return row;
  });
}
function waterSessionsLookUntouched(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return true;
  return list.every(w => !w.zoneId && !w.zone && !(Number(w.minutes) || 0));
}
function defaultWaterSessionsForPlot(plotId) {
  return plotWaterZones(plotId).length ? waterZoneRowsForPeriod(plotId, "morning") : defaultWaterSessions();
}
function normalizeTaskWaterSessions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(w => ({
      zoneId: String(w.zoneId || "").trim(),
      period: String(w.period || "").trim(),
      start: String(w.start || "").trim(),
      minutes: Number(w.minutes) || 0,
      method: String(w.method || "").trim(),
      areaRai: Number(w.areaRai) || 0,
      zone: String(w.zone || "").trim(),
      status: String(w.status || "planned").trim()
    }))
    .filter(w => w.period || w.start || w.minutes > 0 || w.method || w.zone || w.zoneId);
}
function collectTaskWaterSessions() {
  return normalizeTaskWaterSessions(taskWaterSessions);
}
function waterSessionTotalText(rows) {
  const list = normalizeTaskWaterSessions(rows);
  const total = list.reduce((a, w) => a + (Number(w.minutes) || 0), 0);
  const area = list.reduce((a, w) => a + (Number(w.areaRai) || 0), 0);
  return list.length ? `${fmtNum(list.length)} รอบ · รวม ${fmtNum(total)} นาที${area ? " · " + fmtNum(area) + " ไร่" : ""}` : "ยังไม่มีรอบรดน้ำ";
}
function waterZoneQuickHtml() {
  const plotId = (document.getElementById("t_plot") || {}).value || "";
  if (!plotId) return `<div class="water-zone-quick muted">เลือกแปลงก่อน ถ้ามีโซนน้ำ ระบบจะแสดงปุ่มเติมรอบให้</div>`;
  const p = plotById(S, plotId);
  const zones = plotWaterZones(plotId);
  if (!zones.length) {
    return `<div class="water-zone-quick">
      <span>แปลงนี้ยังไม่มีโซนน้ำประจำ</span>
      <button type="button" class="btn btn-sm btn-outline" onclick="App.modalPlotWaterZones('${plotId}')">${ic("plus")} ตั้งโซน</button>
    </div>`;
  }
  const totalArea = zones.reduce((sum, z) => sum + (Number(z.areaRai) || 0), 0);
  return `<div class="water-zone-quick">
    <div>
      <b>${esc(p ? p.name : "แปลงนี้")}</b>
      <span>${fmtNum(zones.length)} โซน${totalArea ? " · " + fmtNum(totalArea) + " ไร่" : ""}</span>
    </div>
    <div class="water-zone-quick-actions">
      <button type="button" class="btn btn-sm btn-ghost" onclick="App.waterFillZones('morning')">เติมเช้า</button>
      <button type="button" class="btn btn-sm btn-ghost" onclick="App.waterFillZones('evening')">เติมเย็น</button>
      <button type="button" class="btn btn-sm btn-primary" onclick="App.waterFillZones('both')">เช้า+เย็น</button>
    </div>
  </div>`;
}
function waterSessionsHtml() {
  const rows = taskWaterSessions.length ? taskWaterSessions : [];
  return `
    ${waterZoneQuickHtml()}
    <div class="water-session-list" id="waterSessionsList">
      ${rows.map((w, i) => `
      <div class="water-session-row" data-wi="${i}">
        <div class="water-session-head">
          <strong>รอบที่ ${i + 1}</strong>
          <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.waterSessionRemove(${i})">${ic("trash")} ลบ</button>
        </div>
        <div class="form-row-2">
          <div class="field"><label>ช่วง</label><select onchange="App.waterSessionSet(${i}, 'period', this.value)">
            ${Object.keys(WATER_PERIOD_LABELS).map(k => `<option value="${k}" ${w.period === k ? "selected" : ""}>${WATER_PERIOD_LABELS[k]}</option>`).join("")}
          </select></div>
          <div class="field"><label>เวลาเริ่ม</label><input type="time" value="${esc(w.start || "")}" oninput="App.waterSessionSet(${i}, 'start', this.value)"></div>
        </div>
        <div class="form-row-2">
          <div class="field"><label>กี่นาที</label><input type="number" min="0" step="1" inputmode="numeric" value="${w.minutes || ""}" placeholder="เช่น 30" oninput="App.waterSessionSet(${i}, 'minutes', this.value)"></div>
          <div class="field"><label>วิธีรดน้ำ</label><select onchange="App.waterSessionSet(${i}, 'method', this.value)">
            ${WATER_METHODS.map(m => `<option value="${esc(m)}" ${w.method === m ? "selected" : ""}>${esc(m)}</option>`).join("")}
          </select></div>
        </div>
        <div class="form-row-2">
          <div class="field"><label>โซน / หมายเหตุ</label><input value="${esc(w.zone || "")}" placeholder="เช่น โซน A / ท้ายแปลง" oninput="App.waterSessionSet(${i}, 'zone', this.value)"></div>
          <div class="field"><label>สถานะรอบนี้</label><select onchange="App.waterSessionSet(${i}, 'status', this.value)">
            ${Object.keys(WATER_STATUS_LABELS).map(k => `<option value="${k}" ${w.status === k ? "selected" : ""}>${WATER_STATUS_LABELS[k]}</option>`).join("")}
          </select></div>
        </div>
        ${w.areaRai ? `<div class="water-zone-row-meta">${ic("map")} พื้นที่โซน ${fmtNum(w.areaRai)} ไร่</div>` : ""}
      </div>`).join("")}
    </div>
    <div class="water-session-footer">
      <button type="button" class="btn btn-sm btn-ghost" onclick="App.waterSessionAdd()">${ic("plus")} เพิ่มรอบรดน้ำ</button>
      <div class="usage-total water-session-total">สรุป <strong id="waterSessionTotal">${waterSessionTotalText(rows)}</strong></div>
    </div>`;
}
App.waterSessionSet = function (i, key, value) {
  if (!taskWaterSessions[i]) return;
  taskWaterSessions[i][key] = ["minutes", "areaRai"].includes(key) ? value : String(value || "");
  const total = document.getElementById("waterSessionTotal");
  if (total) total.textContent = waterSessionTotalText(taskWaterSessions);
};
App.waterSessionAdd = function () {
  taskWaterSessions.push({ period: "custom", start: "", minutes: "", method: "ระบบน้ำ", zone: "", status: "planned" });
  App.waterSessionsRender();
};
App.waterSessionRemove = function (i) {
  taskWaterSessions.splice(i, 1);
  App.waterSessionsRender();
};
App.waterSessionsRender = function () {
  const box = document.getElementById("waterSessionsMount");
  if (box) box.innerHTML = waterSessionsHtml();
};
App.waterFillZones = function (mode) {
  const plotId = (document.getElementById("t_plot") || {}).value || "";
  const zones = plotWaterZones(plotId);
  if (!zones.length) { toast("ยังไม่มีโซนน้ำของแปลงนี้"); return; }
  const rows = mode === "both"
    ? [...waterZoneRowsForPeriod(plotId, "morning"), ...waterZoneRowsForPeriod(plotId, "evening")]
    : waterZoneRowsForPeriod(plotId, mode || "morning");
  if (mode === "both" || waterSessionsLookUntouched(taskWaterSessions)) {
    taskWaterSessions = rows;
  } else {
    taskWaterSessions.push(...rows);
  }
  App.waterSessionsRender();
  toast("เติมรอบรดน้ำจากโซนแล้ว");
};
App.taskTypeChange = function () {
  const sel = document.getElementById("t_type");
  const box = document.getElementById("waterBox");
  if (!sel || !box) return;
  const isWater = sel.value === "water";
  const plotId = (document.getElementById("t_plot") || {}).value || "";
  if (isWater && waterSessionsLookUntouched(taskWaterSessions)) taskWaterSessions = defaultWaterSessionsForPlot(plotId);
  box.style.display = isWater ? "" : "none";
  if (isWater) App.waterSessionsRender();
};
App.modalTask = function (date, preset) {
  preset = preset || {};
  const editing = preset.taskId ? S.tasks.find(x => x.id === preset.taskId) : null;
  taskEditingId = editing ? editing.id : "";
  if (!editing) taskEditReturnToDetail = false;
  const type = editing ? editing.type : (preset.type || "work");
  const title = editing ? editing.title : (preset.title || "");
  const d = editing ? editing.date : (date || todayISO());
  const status = editing ? (["done", "failed"].includes(editing.status) ? editing.status : "planned") : "planned";
  const hasCost = editing ? (editing.cost > 0 || !!editing.stockId) : false;
  const hasHarvest = editing ? editing.revenue > 0 : false;
  const stockItem = editing && editing.stockId ? stockById(S, editing.stockId) : null;
  const unitPrice = editing ? (stockItem ? stockItem.avgCost.toFixed(2) : (editing.qty ? (editing.cost / editing.qty).toFixed(2) : "")) : "";
  taskFormPhotos = taskPhotos(editing).slice();
  taskWaterSessions = editing ? normalizeTaskWaterSessions(editing.wateringSessions) : (type === "water" ? defaultWaterSessionsForPlot(preset.plotId || "") : []);
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
          <option value="failed" ${status === "failed" ? "selected" : ""}>ไม่สำเร็จ</option>
        </select></div>
      </div>
      <div class="field"><label>ชื่องาน *</label><input id="t_title" value="${esc(title)}" placeholder="เช่น ใส่ปุ๋ยครั้งที่ 2" required></div>
      <div class="form-row-2">
        <div class="field"><label>แปลง</label><select id="t_plot" onchange="App.taskPlotChange()"></select></div>
        <div class="field"><label>พืช / รอบ</label><select id="t_cycle" disabled></select></div>
      </div>
      <div class="hint" style="margin-top:-6px">เลือกแปลง/รอบ เพื่อให้ต้นทุนเข้าถูกที่</div>
      <div class="field"><label>ประเภทกิจกรรม</label><select id="t_type" onchange="App.taskTypeChange()">
        ${Object.keys(TYPE_LABELS).map(k => `<option value="${k}" ${k === type ? "selected" : ""}>${TYPE_LABELS[k]}</option>`).join("")}
      </select></div>

      <div id="waterBox" class="nested-fields water-box" style="display:${type === "water" ? "" : "none"}">
        <div class="water-box-title">${ic("droplet")} รอบรดน้ำ</div>
        <div class="hint">เหมาะกับงานที่ต้องรดหลายช่วง เช่น เช้า/เย็น และย้อนดูได้ว่ารดกี่นาทีต่อรอบ</div>
        <div id="waterSessionsMount">${waterSessionsHtml()}</div>
      </div>

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
      <div class="task-photo-panel">
        <div class="task-photo-head">
          <div><b>รูปกิจกรรม</b><span>ใส่รูปประกอบแผนงานหรือรูปหน้างานไว้ดูย้อนหลัง</span></div>
          <button type="button" class="btn btn-sm btn-outline" onclick="App.taskPickPhotos('form')">${ic("camera")} เพิ่มรูป</button>
        </div>
        <div id="taskPhotoPreview">${taskPhotoPreviewHtml(taskFormPhotos, "form")}</div>
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
  App.waterSessionsRender();
  App.taskTypeChange();
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
    if (!editing && type === "water" && plotWaterZones(selPlotId).length && waterSessionsLookUntouched(taskWaterSessions)) {
      taskWaterSessions = defaultWaterSessionsForPlot(selPlotId);
      App.waterSessionsRender();
    } else if (type === "water") {
      App.waterSessionsRender();
    }
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
    if ((document.getElementById("t_type") || {}).value === "water") App.waterSessionsRender();
    return;
  }
  const cycles = S.cycles.filter(c => c.plotId === pid && c.status === "active");
  cycSel.innerHTML = '<option value="">-- เลือกพืช / รอบ --</option>' +
    cycles.map(c => `<option value="${c.id}">${esc(c.plant)}</option>`).join("") +
    '<option value="__none__">ยังไม่ปลูกอะไร (ต้นทุนเข้ารวมแปลงนี้)</option>';
  cycSel.disabled = false;
  if ((document.getElementById("t_type") || {}).value === "water") {
    if (!taskEditingId && waterSessionsLookUntouched(taskWaterSessions)) taskWaterSessions = defaultWaterSessionsForPlot(pid);
    App.waterSessionsRender();
  }
};
App.submitTask = function (e, editId) {
  e.preventDefault();
  if (taskPhotoUploading.form) { toast("รอเพิ่มรูปให้เสร็จก่อน"); return false; }
  const title = document.getElementById("t_title").value.trim();
  if (!title) return false;
  const useCost = document.getElementById("t_usecost").checked;
  const useHarvest = document.getElementById("t_useharvest").checked;
  const hqty = Number(document.getElementById("t_hqty").value) || 0;
  const hprice = Number(document.getElementById("t_hprice").value) || 0;
  if (useCost) {
    for (let i = 0; i < taskCostItems.length; i++) {
      const raw = taskCostItems[i];
      if (!raw || !raw.stockId || !(Number(raw.qty) || 0)) continue;
      const row = document.querySelector(`[data-ci="${i}"]`);
      const msg = checkStockWarn(i, raw, row);
      if (msg) {
        const input = row ? row.querySelector(".ci-qty") : null;
        if (input) {
          setModalFieldError(input, msg);
          (input.closest(".field") || input).scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }, 220);
        }
        return false;
      }
    }
  }
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
  /* ตรวจจำนวนกับสต็อกก่อนบันทึก — ตอนแก้ไขต้องบวกยอดเดิมของงานนี้กลับแบบชั่วคราว */
  const stockNeeds = {};
  costItems.forEach(it => {
    if (!it.stockId || !it.qty) return;
    stockNeeds[it.stockId] = (stockNeeds[it.stockId] || 0) + (Number(it.qty) || 0);
  });
  for (const stockId of Object.keys(stockNeeds)) {
    const st = stockById(S, stockId);
    if (!st) continue;
    /* ปัดเป็น 4 ตำแหน่งกันเลขทศนิยมลอย — กรอก 40.02 พอดีกับของเหลือ จะได้ไม่โดนบล็อก */
    const avail = rndQty((Number(st.qty) || 0) + (Number(st.openQty) || 0) + taskOriginalStockQty(stockId));
    if (rndQty(stockNeeds[stockId]) - avail > 1e-9) {
      toast(`"${st.name}" ใช้ได้ไม่เกิน ${fmtNum(avail)} ${st.unit} — กรอกจำนวนใหม่`);
      return false;
    }
  }
  const totalCost = costItems.reduce((a, it) => a + it.totalCost, 0);
  const tPlot = document.getElementById("t_plot").value || null;
  const tCycleRaw = document.getElementById("t_cycle").value || "";
  /* "ยังไม่ปลูกอะไร" = ไม่ผูกกับรอบ แต่ยังเข้ารวมต้นทุนของแปลงที่เลือก */
  const tCycle = tCycleRaw === "__none__" ? null : (tCycleRaw || null);
  const tRevenue = useHarvest ? Math.round(hqty * hprice) || 0 : 0;
  const tType = document.getElementById("t_type").value;
  const existing = editId ? S.tasks.find(x => x.id === editId) : null;
  /* กันข้อมูลหาย: ถ้ามีต้นทุนหรือรายได้แต่ยังไม่เลือกแปลง -> บล็อกไม่ให้บันทึก
     (งานที่ไม่มีแปลง ต้นทุน/รายได้จะไม่เข้ารอบหรือแปลงไหนเลย) */
  if ((totalCost > 0 || tRevenue > 0) && !tPlot) {
    toast("ต้องเลือกแปลงก่อน — ต้นทุน/รายได้จะไม่เข้ารอบไหน");
    return false;
  }
  const data = {
    title,
    type: tType,
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
    wateringSessions: tType === "water" ? collectTaskWaterSessions() : [],
    note: document.getElementById("t_note").value.trim(),
    photos: taskFormPhotos.slice(),
    donePhotos: existing ? taskDonePhotosOf(existing).slice() : [],
    doneNote: existing ? (existing.doneNote || "") : "",
    doneDate: existing ? (existing.doneDate || "") : "",
    doneTime: existing ? (existing.doneTime || "") : "",
    weatherSnapshot: existing ? (existing.weatherSnapshot || null) : null
  };
  if (data.type === "water" && data.wateringSessions.length && (data.status === "done" || data.status === "failed")) {
    const nextStatus = data.status === "done" ? "done" : "failed";
    data.wateringSessions = data.wateringSessions.map(w => ({
      ...w,
      status: w.status === "planned" ? nextStatus : (w.status || nextStatus)
    }));
  }
  if ((data.status === "done" || data.status === "failed") && !data.doneDate) {
    data.doneDate = data.date || todayISO();
    data.doneTime = data.doneTime || currentTimeHHMM();
  }
  let savedTaskId = existing ? existing.id : "";
  const shouldOpenDoneFlow = data.status === "done" && (!existing || existing.status !== "done");
  const doneFlowReturnToDetail = !!taskEditReturnToDetail;
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
    if (savedTaskId && shouldOpenDoneFlow) {
      setTimeout(() => App.modalTaskComplete(savedTaskId, doneFlowReturnToDetail), 0);
    } else if (editId && taskEditReturnToDetail) {
      App.viewTask(editId);
    }
    taskEditReturnToDetail = false;
    taskEditingId = "";
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
          `งานนี้เคยเบิกของจากสต็อก ${existing.costItems.filter(i => i.stockId).length} รายการ ตอนนี้คุณนำรายการสต็อกออก — ถ้ายังไม่ได้ใช้จริง ระบบจะคืนของเข้าสต็อก`,
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
    const created = addTask(S, data);
    savedTaskId = created ? created.id : "";
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
App.quickAction = function (act) {
  closeFAB();
  if (act === "task") {
    App.modalTask(todayISO());
    return;
  }
  if (act === "lark") {
    route.view = "stock";
    render();
    requestAnimationFrame(() => App.larkStockSync());
    return;
  }
  if (act === "stock") {
    route.view = "stock";
    render();
    requestAnimationFrame(() => App.modalStock());
    return;
  }
  if (act === "sale") {
    App.modalSale();
    return;
  }
  if (act === "plot") {
    route.view = "plots";
    route.tab = "plots";
    render();
    requestAnimationFrame(() => App.modalPlot());
  }
};
fabDock.querySelectorAll(".fab-item").forEach(btn => {
  btn.addEventListener("click", () => {
    App.quickAction(btn.dataset.action);
  });
});

/* ---------------- Interactive tour ---------------- */
const TOUR_STEPS = [
  { sel: ".today-card", title: "1 · งานวันนี้", text: "ดูงานที่ต้องจัดการวันนี้ก่อน และกดเพิ่มงานใหม่จากตรงนี้ได้ทันที", pos: "below" },
  { sel: "#kpiRow", title: "2 · ตัวเลขสำคัญ", text: "กำไรสุทธิ พื้นที่ และรอบปลูก สรุปให้ดูเร็วบนหน้าแรก", pos: "below" },
  { sel: "#fabBtn", title: "3 · ปุ่มลัด", text: "ปุ่มกลมมุมขวาล่างสำหรับสร้างข้อมูลเร็ว เช่น เพิ่มกิจกรรม เพิ่มสินค้า ขายสินค้า และเพิ่มแปลง", pos: "left" },
  { sel: "#bottomNav", title: "4 · เมนูหลัก", text: "หน้าแรก แปลง สต็อก กิจกรรม วิเคราะห์ และเพิ่มเติม กดเพื่อสลับหน้าได้ทันที", pos: "below" },
  { sel: "#tourBtn", title: "5 · จบการแนะนำ", text: "พร้อมแล้ว กดปุ่มแนะนำระบบได้ทุกเมื่อเพื่อดูทัวร์อีกครั้ง", pos: "below" },
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
  if (route.view === "plots" && route.tab === "trials") {
    document.querySelectorAll("[data-trial-mean]").forEach(el => {
      const tr = trialById(S, el.dataset.trialMean);
      const items = tr ? trialMeanChartItems(tr) : [];
      if (items.length) Charts.bars(el, items);
    });
    document.querySelectorAll("[data-trial-trend]").forEach(el => {
      const tr = trialById(S, el.dataset.trialTrend);
      const items = tr ? trialTrendChartItems(tr) : [];
      if (items.length) Charts.line(el, items);
    });
  }
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
    if (saved.trialId) route.trialId = saved.trialId;
    if (saved.trialMetricId) route.trialMetricId = saved.trialMetricId;
    if (saved.trialTreatmentId) route.trialTreatmentId = saved.trialTreatmentId;
    if (saved.year) route.year = saved.year;
  }
} catch (e) {}
try {
  const previewUrl = new URL(location.href);
  const previewHost = String(location.hostname || "").toLowerCase();
  const localSensorRoute = (previewHost === "localhost" || previewHost === "127.0.0.1") &&
    (previewUrl.searchParams.get("sensorPreview") === "1" ||
      (typeof FarmUltimateRuntime !== "undefined" && FarmUltimateRuntime.isRealSensorStaging));
  if (localSensorRoute) {
    route.view = "iot";
  }
} catch (e) {}
render();
