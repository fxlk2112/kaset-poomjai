/* ============================================================
   เกษตรภูมิใจ v52 — data layer
   seed data + localStorage persistence + business logic
   ตัวเลขการเงินทั้งหมด (KPI, กราฟ, กำไรรายแปลง/รอบ) คำนวณจาก
   บันทึกงานจริง (tasks) ที่ผู้ใช้แก้ไขได้ — ไม่ใช่ตัวเลขตายตัว
   ============================================================ */
"use strict";

const STORAGE_KEY = "kaset-poomjai-v51";

/* ---------- helpers ---------- */
function uid() {
  return "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addDaysISO(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + (n || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString("th-TH");
}
function fmtNum(n) {
  return Number(n || 0).toLocaleString("th-TH");
}
function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO), b = new Date(toISO || todayISO());
  return Math.max(0, Math.round((b - a) / 86400000));
}
function ageDays(startISO) {
  return daysBetween(startISO, todayISO());
}
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const TYPE_LABELS = {
  work: "งานประจำ", fertilize: "ใส่ปุ๋ย", harvest: "เก็บเกี่ยว",
  water: "รดน้ำ", inspect: "ตรวจแปลง", expense: "ค่าใช้จ่าย"
};
const TYPE_ICONS = { work: "wrench", fertilize: "leaf", harvest: "box", water: "droplet", inspect: "search", expense: "dollar" };

/* หมวดต้นทุน — ใช้จัดกลุ่มกราฟวงกลมต้นทุนเชิงลึก */
const COST_CATS = [
  { key: "fertilizer", label: "ค่าปุ๋ย", color: "#16a34a" },
  { key: "labor", label: "ค่าแรง", color: "#2563eb" },
  { key: "chemical", label: "ค่ายา/สารเคมี", color: "#f59e0b" },
  { key: "seed", label: "เมล็ดพันธุ์", color: "#8b5cf6" },
  { key: "fuel", label: "น้ำมัน/เชื้อเพลิง", color: "#64748b" },
  { key: "other", label: "อื่นๆ", color: "#e11d48" },
];
const COST_CAT_MAP = Object.fromEntries(COST_CATS.map(c => [c.key, c]));
function defaultCostCat(type) {
  if (type === "fertilize") return "fertilizer";
  if (type === "work") return "labor";
  return "other";
}

/* ---------- seed ---------- */
function seed() {
  const tasks = [
    /* --- แปลง C มันสำปะหลัง (c3) --- */
    { date: "2026-01-10", title: "ใส่ปุ๋ยครั้งที่ 1 แปลง C", type: "fertilize", status: "done", plotId: "p3", cycleId: "c3", costCat: "fertilizer", qty: 20, cost: 11000, revenue: 0, note: "" },
    { date: "2026-04-18", title: "ปลูกมันสำปะหลังแปลง C", type: "work", status: "done", plotId: "p3", cycleId: "c3", costCat: "labor", qty: 0, cost: 7000, revenue: 0, note: "" },
    { date: "2026-05-10", title: "ใส่ปุ๋ยครั้งที่ 1 แปลง C", type: "fertilize", status: "done", plotId: "p3", cycleId: "c3", costCat: "fertilizer", qty: 15, cost: 11500, revenue: 0, note: "" },
    { date: "2026-06-15", title: "กำจัดวัชพืชแปลง C", type: "work", status: "done", plotId: "p3", cycleId: "c3", costCat: "labor", qty: 0, cost: 6500, revenue: 0, note: "" },
    { date: "2026-07-20", title: "ใส่ปุ๋ยครั้งที่ 2 แปลง C", type: "fertilize", status: "done", plotId: "p3", cycleId: "c3", costCat: "fertilizer", qty: 14, cost: 12500, revenue: 0, note: "" },
    { date: "2026-08-08", title: "ตรวจแปลง C", type: "inspect", status: "done", plotId: "p3", cycleId: "c3", costCat: null, qty: 0, cost: 0, revenue: 0, note: "ต้นสมบูรณ์ดี" },
    { date: "2026-08-11", title: "พ่นยาแปลง C", type: "work", status: "planned", plotId: "p3", cycleId: "c3", costCat: "chemical", qty: 0, cost: 4800, revenue: 0, note: "" },

    /* --- แปลง A ข้าวโพดหวาน (c1) --- */
    { date: "2026-05-22", title: "หยอดเมล็ดข้าวโพด แปลง A", type: "work", status: "done", plotId: "p1", cycleId: "c1", costCat: "seed", stockId: "s4", qty: 5, cost: 8000, revenue: 0, note: "" },
    { date: "2026-06-05", title: "ใส่ปุ๋ยครั้งที่ 1 แปลง A", type: "fertilize", status: "done", plotId: "p1", cycleId: "c1", costCat: "fertilizer", stockId: "s1", qty: 14, cost: 12500, revenue: 0, note: "" },
    { date: "2026-06-20", title: "รดน้ำแปลง A", type: "water", status: "done", plotId: "p1", cycleId: "c1", costCat: null, qty: 0, cost: 0, revenue: 0, note: "" },
    { date: "2026-07-05", title: "ใส่ปุ๋ยครั้งที่ 2 แปลง A", type: "fertilize", status: "done", plotId: "p1", cycleId: "c1", costCat: "fertilizer", qty: 16, cost: 13800, revenue: 0, note: "" },
    { date: "2026-07-25", title: "พ่นยาแปลง A", type: "work", status: "done", plotId: "p1", cycleId: "c1", costCat: "chemical", stockId: "s3", qty: 8, cost: 5200, revenue: 0, note: "" },
    { date: "2026-08-10", title: "รดน้ำแปลง A", type: "water", status: "done", plotId: "p1", cycleId: "c1", costCat: null, qty: 0, cost: 0, revenue: 0, note: "" },
    { date: "2026-08-11", title: "เก็บเกี่ยวข้าวโพดหวาน (รอบ 1)", type: "harvest", status: "done", plotId: "p1", cycleId: "c1", costCat: null, qty: 3000, cost: 0, revenue: 55000, note: "" },
    { date: "2026-08-12", title: "เก็บเกี่ยวข้าวโพดหวาน (รอบ 2)", type: "harvest", status: "done", plotId: "p1", cycleId: "c1", costCat: null, qty: 2000, cost: 0, revenue: 35000, note: "" },
    { date: "2026-08-15", title: "ใส่ปุ๋ยครั้งที่ 3 แปลง A", type: "fertilize", status: "planned", plotId: "p1", cycleId: "c1", costCat: "fertilizer", qty: 0, cost: 12000, revenue: 0, note: "" },
    { date: "2026-08-20", title: "พ่นยากันเชื้อราแปลง A", type: "work", status: "planned", plotId: "p1", cycleId: "c1", costCat: "chemical", qty: 0, cost: 5600, revenue: 0, note: "" },

    /* --- แปลง B ข้าวนาปี (c2) --- */
    { date: "2026-06-12", title: "หว่านเมล็ดข้าว แปลง B", type: "work", status: "done", plotId: "p2", cycleId: "c2", costCat: "seed", stockId: "s5", qty: 10, cost: 9000, revenue: 0, note: "" },
    { date: "2026-07-02", title: "ใส่ปุ๋ยครั้งที่ 1 แปลง B", type: "fertilize", status: "done", plotId: "p2", cycleId: "c2", costCat: "fertilizer", stockId: "s1", qty: 17, cost: 15000, revenue: 0, note: "" },
    { date: "2026-07-20", title: "พ่นยากันหนอนแปลง B", type: "work", status: "done", plotId: "p2", cycleId: "c2", costCat: "chemical", stockId: "s3", qty: 11, cost: 6800, revenue: 0, note: "" },
    { date: "2026-08-05", title: "ใส่ปุ๋ยครั้งที่ 2 แปลง B", type: "fertilize", status: "done", plotId: "p2", cycleId: "c2", costCat: "fertilizer", qty: 18, cost: 16200, revenue: 0, note: "" },
    { date: "2026-08-13", title: "ตรวจแปลง B (ข้าวนาปี)", type: "inspect", status: "planned", plotId: "p2", cycleId: "c2", costCat: null, qty: 0, cost: 0, revenue: 0, note: "" },

    /* --- แปลง D ผักสวนครัว รอบ 1/66 (c5 ปิดรอบแล้ว) --- */
    { date: "2026-02-03", title: "ปลูกผักสวนครัว รอบ 1/66", type: "work", status: "done", plotId: "p4", cycleId: "c5", costCat: "labor", qty: 0, cost: 3500, revenue: 0, note: "" },
    { date: "2026-02-10", title: "เก็บเกี่ยวผัก รอบ 1", type: "harvest", status: "done", plotId: "p4", cycleId: "c5", costCat: null, qty: 700, cost: 0, revenue: 12000, note: "" },
    { date: "2026-02-20", title: "ใส่ปุ๋ยอินทรีย์ แปลง D", type: "fertilize", status: "done", plotId: "p4", cycleId: "c5", costCat: "fertilizer", qty: 8, cost: 2600, revenue: 0, note: "" },
    { date: "2026-02-26", title: "เก็บเกี่ยวผัก รอบ 2", type: "harvest", status: "done", plotId: "p4", cycleId: "c5", costCat: null, qty: 600, cost: 0, revenue: 9800, note: "" },
    { date: "2026-03-05", title: "เก็บเกี่ยวผัก รอบ 3", type: "harvest", status: "done", plotId: "p4", cycleId: "c5", costCat: null, qty: 650, cost: 0, revenue: 11000, note: "" },
    { date: "2026-03-18", title: "เก็บเกี่ยวผัก รอบ 4", type: "harvest", status: "done", plotId: "p4", cycleId: "c5", costCat: null, qty: 700, cost: 0, revenue: 13500, note: "" },

    /* --- แปลง D ผักสวนครัว รอบ 2/66 (c6 ปิดรอบแล้ว) --- */
    { date: "2026-05-02", title: "ปลูกผักสวนครัว รอบ 2/66", type: "work", status: "done", plotId: "p4", cycleId: "c6", costCat: "labor", qty: 0, cost: 3200, revenue: 0, note: "" },
    { date: "2026-05-12", title: "เก็บเกี่ยวผัก รอบ 1 (2/66)", type: "harvest", status: "done", plotId: "p4", cycleId: "c6", costCat: null, qty: 550, cost: 0, revenue: 9500, note: "" },
    { date: "2026-05-20", title: "ใส่ปุ๋ยอินทรีย์ รอบ 2/66", type: "fertilize", status: "done", plotId: "p4", cycleId: "c6", costCat: "fertilizer", qty: 7, cost: 2500, revenue: 0, note: "" },
    { date: "2026-05-28", title: "เก็บเกี่ยวผัก รอบ 2 (2/66)", type: "harvest", status: "done", plotId: "p4", cycleId: "c6", costCat: null, qty: 600, cost: 0, revenue: 10800, note: "" },
    { date: "2026-06-08", title: "เก็บเกี่ยวผัก รอบ 3 (2/66)", type: "harvest", status: "done", plotId: "p4", cycleId: "c6", costCat: null, qty: 650, cost: 0, revenue: 12400, note: "" },

    /* --- แปลง D ผักสวนครัว รอบ 3 (c4 กำลังปลูก) --- */
    { date: "2026-07-03", title: "ปลูกผักสวนครัว รอบ 3", type: "work", status: "done", plotId: "p4", cycleId: "c4", costCat: "labor", qty: 0, cost: 3000, revenue: 0, note: "" },
    { date: "2026-07-15", title: "ใส่ปุ๋ยอินทรีย์ แปลง D", type: "fertilize", status: "done", plotId: "p4", cycleId: "c4", costCat: "fertilizer", stockId: "s2", qty: 8, cost: 2800, revenue: 0, note: "" },
    { date: "2026-07-25", title: "รดน้ำแปลง D", type: "water", status: "done", plotId: "p4", cycleId: "c4", costCat: null, qty: 0, cost: 0, revenue: 0, note: "" },
    { date: "2026-08-01", title: "ใส่ปุ๋ยครั้งที่ 2 แปลง D", type: "fertilize", status: "done", plotId: "p4", cycleId: "c4", costCat: "fertilizer", qty: 6, cost: 2400, revenue: 0, note: "" },
    { date: "2026-08-02", title: "เก็บเกี่ยวผักสวนครัว แปลง D", type: "harvest", status: "done", plotId: "p4", cycleId: "c4", costCat: null, qty: 500, cost: 0, revenue: 8000, note: "ส่งตลาดสด 500 กก." },
    { date: "2026-08-12", title: "เก็บเกี่ยวผักสวนครัว (รอบ 2)", type: "harvest", status: "done", plotId: "p4", cycleId: "c4", costCat: null, qty: 450, cost: 0, revenue: 7200, note: "" },
    { date: "2026-08-18", title: "เก็บเกี่ยวผักสวนครัว (รอบ 3)", type: "harvest", status: "planned", plotId: "p4", cycleId: "c4", costCat: null, qty: 0, cost: 0, revenue: 6500, note: "" },
  ];
  tasks.forEach(t => { if (!t.id) t.id = uid(); });
  return {
    version: 52,
    role: "general",
    /* ---- โหมดแก้ไขเว็บ (ผู้ดูแล) ---- */
    adminPass: "",            // รหัสผ่านผู้ดูแล — ว่าง = ยังไม่ได้ตั้ง (ตั้งครั้งแรกได้ที่หน้าตั้งค่า)
    texts: {},                // คำที่ผู้ดูแลแก้ เช่น { brandName: "..." } — ชนะค่าเริ่มต้น
    homeOrder: ["cal", "tasks", "profit", "activity"], // ลำดับ section หน้าแรก
    customMenus: [],          // เมนูที่ผู้ดูแลเพิ่มในหน้าเพิ่มเติม [{ id, ico, name, desc, target }]
    plots: [
      { id: "p1", name: "แปลง A", crop: "ข้าวโพดหวาน", sizeRai: 25, lat: 14.9823, lng: 100.4582, status: "active" },
      { id: "p2", name: "แปลง B", crop: "ข้าวนาปี", sizeRai: 40, lat: 14.9750, lng: 100.4711, status: "active" },
      { id: "p3", name: "แปลง C", crop: "มันสำปะหลัง", sizeRai: 15, lat: 14.9901, lng: 100.4498, status: "active" },
      { id: "p4", name: "แปลง D", crop: "ผักสวนครัว", sizeRai: 5, lat: 14.9788, lng: 100.4625, status: "active" },
      { id: "p5", name: "แปลง E", crop: "อ้อย", sizeRai: 30, lat: 14.9694, lng: 100.4850, status: "inactive" },
    ],
    stock: [
      { id: "s1", name: "ปุ๋ยเคมี สูตร 46-0-0", unit: "ถุง", qty: 120, avgCost: 890, openQty: 0 },
      { id: "s2", name: "ปุ๋ยอินทรีย์", unit: "ถุง", qty: 60, avgCost: 350, openQty: 0 },
      { id: "s3", name: "ยาฆ่าแมลง (คลอร์ไพริฟอส)", unit: "ขวด", qty: 24, avgCost: 620, openQty: 0 },
      { id: "s4", name: "เมล็ดข้าวโพดหวาน", unit: "ถุง", qty: 15, avgCost: 1250, openQty: 0 },
      { id: "s5", name: "เมล็ดพันธุ์ข้าว กข15", unit: "ถุง", qty: 30, avgCost: 980, openQty: 0 },
      { id: "s6", name: "น้ำมันดีเซล", unit: "ลิตร", qty: 300, avgCost: 34.5, openQty: 0 },
      { id: "s7", name: "สารเร่งการเจริญเติบโต", unit: "ขวด", qty: 10, avgCost: 480, openQty: 0 },
    ],
    equipment: [
      { id: "e1", name: "รถแทรกเตอร์", type: "เครื่องจักร", purchaseDate: "2019-03-15", cost: 1850000, lifespan: 15 },
      { id: "e2", name: "รถพ่นยา", type: "เครื่องจักร", purchaseDate: "2021-06-01", cost: 450000, lifespan: 10 },
      { id: "e3", name: "ปั๊มน้ำสูบสูง", type: "อุปกรณ์", purchaseDate: "2022-01-20", cost: 85000, lifespan: 8 },
      { id: "e4", name: "เครื่องหยอดเมล็ด", type: "เครื่องจักร", purchaseDate: "2020-05-10", cost: 320000, lifespan: 12 },
      { id: "e5", name: "รถกระบะบรรทุก", type: "ยานพาหนะ", purchaseDate: "2023-02-01", cost: 780000, lifespan: 10 },
    ],
    cycles: [
      { id: "c1", plotId: "p1", plant: "ข้าวโพดหวาน รุ่น 1/66", startDate: "2026-05-20", status: "active" },
      { id: "c2", plotId: "p2", plant: "ข้าวนาปี รุ่น 1/66", startDate: "2026-06-10", status: "active" },
      { id: "c3", plotId: "p3", plant: "มันสำปะหลัง รุ่น 1/66", startDate: "2026-04-15", status: "active" },
      { id: "c4", plotId: "p4", plant: "ผักสวนครัว รอบ 3", startDate: "2026-07-01", status: "active" },
      { id: "c5", plotId: "p4", plant: "ผักสวนครัว รอบ 1/66", startDate: "2026-02-01", status: "done" },
      { id: "c6", plotId: "p4", plant: "ผักสวนครัว รอบ 2/66", startDate: "2026-05-01", status: "done" },
    ],
    tasks: tasks,
    valves: [
      { id: "v1", name: "วาล์วแปลง A (Zone 1)", zone: "Zone 1", state: "off", schedule: [{ start: "05:30", end: "07:30" }] },
      { id: "v2", name: "วาล์วแปลง B (Zone 2)", zone: "Zone 2", state: "off", schedule: [{ start: "06:00", end: "08:00" }] },
      { id: "v3", name: "ปั๊มน้ำบาดาล", zone: "Main", state: "on", schedule: [{ start: "05:00", end: "09:00" }] },
      { id: "v4", name: "วาล์วแปลง D (Zone 3)", zone: "Zone 3", state: "off", schedule: [] },
    ],
    workers: { working: 12, resting: 3, leave: 1, total: 16 },
    tourDone: false,
  };
}

/* ---------- persistence ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 52) {
        ensureTaskIds(s);
        ensureDefaults(s);
        saveState(s);
        return s;
      }
    }
  } catch (e) { /* corrupted -> reseed */ }
  const s = seed();
  saveState(s);
  return s;
}
/* งานที่ยังไม่มี id (ข้อมูลเก่า) ให้สร้าง id ใหม่ — จำเป็นสำหรับการติ๊กถูก/ลบงาน */
function ensureTaskIds(s) {
  (s.tasks || []).forEach(t => { if (!t.id) t.id = uid(); });
}
/* เติมค่าเริ่มต้นสำหรับฟิลด์โหมดแก้ไขเว็บ — รองรับข้อมูลที่บันทึกไว้จากเวอร์ชันก่อน */
function ensureDefaults(s) {
  if (typeof s.adminPass !== "string") s.adminPass = "";
  s.texts = s.texts || {};
  if (!Array.isArray(s.homeOrder) || s.homeOrder.length !== 4) s.homeOrder = ["cal", "tasks", "profit", "activity"];
  s.customMenus = s.customMenus || [];
  /* ฟิลด์สต็อกใช้งานแล้ว (openQty) — ของที่เบิกมาเปิดใช้แล้วยังไม่หมด */
  (s.stock || []).forEach(x => {
    if (typeof x.openQty !== "number" || isNaN(x.openQty)) x.openQty = 0;
  });
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* storage full / blocked */ }
}

/* ---------- derived helpers ---------- */
function plotById(s, id) { return s.plots.find(p => p.id === id); }
function cycleById(s, id) { return s.cycles.find(c => c.id === id); }
function stockById(s, id) { return s.stock.find(x => x.id === id); }

function activeAreaRai(s) {
  return s.plots.filter(p => p.status === "active").reduce((a, p) => a + p.sizeRai, 0);
}
function activeCycles(s) {
  return s.cycles.filter(c => c.status === "active");
}
function totalStockValue(s) {
  return s.stock.reduce((a, x) => a + (x.qty + (x.openQty || 0)) * x.avgCost, 0);
}

/* เฉพาะงานที่ "เสร็จ" เท่านั้นที่นับเป็นรายได้/ต้นทุน */
function doneTasks(s) {
  return s.tasks.filter(t => t.status === "done");
}

/* คำนวณรายรับ/ต้นทุนจากงานตามเงื่อนไข */
function taskFinance(s, filterFn) {
  let revenue = 0, cost = 0;
  doneTasks(s).forEach(t => {
    if (filterFn(t)) {
      revenue += t.revenue || 0;
      cost += t.cost || 0;
    }
  });
  return { revenue, cost, net: revenue - cost };
}
function plotFinance(s, plotId) {
  return taskFinance(s, t => t.plotId === plotId);
}
function cycleFinance(s, cycleId) {
  return taskFinance(s, t => t.cycleId === cycleId);
}
/* กำไรสุทธิปีปัจจุบัน (YTD) — คำนวณจากงานจริง */
function ytdFinance(s) {
  const yr = todayISO().slice(0, 4);
  const fin = taskFinance(s, t => t.date.startsWith(yr));
  return { ...fin, margin: fin.revenue > 0 ? ((fin.revenue - fin.cost) / fin.revenue) * 100 : 0 };
}
/* กำไรรายเดือนทั้ง 12 เดือนของปี */
function monthlySeries(s, year) {
  const arr = [];
  for (let m = 0; m < 12; m++) {
    const prefix = year + "-" + String(m + 1).padStart(2, "0");
    const fin = taskFinance(s, t => t.date.startsWith(prefix));
    arr.push({ label: THAI_MONTHS_SHORT[m], revenue: fin.revenue, cost: fin.cost, value: fin.net });
  }
  return arr;
}
/* กำไร/ขาดทุนตามชนิดพืช — กลุ่มจากแปลง (จากงานจริง) */
function cropMargins(s) {
  const map = {};
  s.plots.forEach(p => {
    if (!p.crop) return;
    const fin = plotFinance(s, p.id);
    if (fin.revenue === 0 && fin.cost === 0) return; // ยังไม่มีการทำกิจกรรม
    if (!map[p.crop]) map[p.crop] = { crop: p.crop, revenue: 0, cost: 0 };
    map[p.crop].revenue += fin.revenue;
    map[p.crop].cost += fin.cost;
  });
  return Object.values(map).map(c => ({
    ...c,
    margin: c.revenue > 0 ? Math.round(((c.revenue - c.cost) / c.revenue) * 100) : 0
  }));
}
/* ต้นทุนเชิงลึก — กลุ่มตามหมวดต้นทุนของงาน */
function costBreakdown(s) {
  const map = {};
  doneTasks(s).forEach(t => {
    if (!t.cost) return;
    const key = t.costCat && COST_CAT_MAP[t.costCat] ? t.costCat : "other";
    if (!map[key]) map[key] = { label: COST_CAT_MAP[key].label, value: 0, color: COST_CAT_MAP[key].color };
    map[key].value += t.cost;
  });
  return Object.values(map).sort((a, b) => b.value - a.value);
}

/* ---------- mutations ---------- */
function addTask(s, t) {
  t.id = uid();
  t.status = t.status || "planned";
  t.qty = Number(t.qty) || 0;
  t.cost = Number(t.cost) || 0;
  t.revenue = Number(t.revenue) || 0;
  t.createdAt = Date.now(); // เวลาเพิ่มงาน — ใช้เรียง "กิจกรรมล่าสุด"
  // ถ้าผูกกับรอบแต่ไม่ระบุแปลง ให้ดึงแปลงจากรอบนั้นมา
  if (t.cycleId && !t.plotId) {
    const c = cycleById(s, t.cycleId);
    if (c) t.plotId = c.plotId;
  }
  if (!t.costCat && t.cost > 0) t.costCat = defaultCostCat(t.type);
  applyStockUse(s, t);
  s.tasks.push(t);
  return t;
}
/* ตัดสต็อกอัตโนมัติเมื่อใช้ของ (รองรับหลายรายการ costItems)
   หลักการ: ใช้ของที่เบิกมาเปิดแล้ว (openQty) ก่อน แล้วเบิกจากสต็อกหลักปัดขึ้นเป็นหน่วยเต็ม
   เช่น ใช้ 3.5 ถุง, openQty=0 → เบิก 4 ถุงจากหลัก, ใช้ 3.5 → เศษ 0.5 เข้า openQty
   เก็บ log (stockLog) ไว้ในงาน เพื่อให้คืนสต็อกได้แม่นยำเมื่อแก้ไข/ลบงาน */
function applyStockUse(s, t) {
  if (t.costItems && t.costItems.length) {
    let total = 0;
    t.stockLog = [];
    t.costItems.forEach(ci => {
      total += Number(ci.totalCost) || 0;
      if (ci.stockId && ci.qty > 0) {
        const item = stockById(s, ci.stockId);
        if (item) {
          let need = Number(ci.qty) || 0;
          item.openQty = Number(item.openQty) || 0;
          const beforeMain = item.qty, beforeOpen = item.openQty;
          // 1) ใช้ของที่เปิดใช้แล้วก่อน
          const fromOpen = Math.min(item.openQty, need);
          item.openQty -= fromOpen;
          need -= fromOpen;
          // 2) เบิกจากสต็อกหลักเป็นหน่วยเต็ม (ปัดขึ้น)
          let openAdded = 0;
          if (need > 0) {
            const withdraw = Math.ceil(need);
            item.qty = Math.max(0, item.qty - withdraw);
            // เศษที่เบิกเกิน (เช่น 4-3.5=0.5) เก็บเป็นของที่เปิดใช้แล้ว
            openAdded = Math.max(0, withdraw - need);
            item.openQty += openAdded;
          }
          t.stockLog.push({
            stockId: ci.stockId,
            qty: Number(ci.qty) || 0,
            mainWithdrawn: beforeMain - item.qty,   // เบิกจากหลักไปเท่าไหร่
            openUsed: beforeOpen - (item.openQty - openAdded), // ใช้ openQty ไปเท่าไหร่
            openAdded                                    // เศษที่เพิ่มเข้า openQty
          });
          if (!ci.totalCost) ci.totalCost = Math.round(ci.qty * item.avgCost);
        }
      }
    });
    t.cost = Math.round(total);
    // สรุปยอดจากรายการแรก (เข้ากันได้กับโค้ดเดิมที่อ่าน t.stockId/t.qty)
    const first = t.costItems.find(ci => ci.stockId) || t.costItems[0];
    if (first) {
      t.stockId = first.stockId || null;
      t.qty = Number(first.qty) || 0;
      t.unit = first.unit || "";
      t.costCat = first.category || t.costCat;
    }
  } else if (t.stockId && t.qty > 0) {
    const item = stockById(s, t.stockId);
    if (item) {
      item.qty = Math.max(0, item.qty - t.qty);
      if (!t.cost) t.cost = Math.round(t.qty * item.avgCost);
    }
    t.stockLog = [{ stockId: t.stockId, qty: t.qty, mainWithdrawn: t.qty, openUsed: 0, openAdded: 0 }];
  } else {
    t.stockLog = [];
  }
}
function toggleTaskDone(s, taskId) {
  const t = s.tasks.find(x => x.id === taskId);
  if (!t) return;
  t.status = t.status === "done" ? "planned" : "done";
  t.updatedAt = Date.now(); // เวลาทำเสร็จ/ยกเลิก — ใช้เรียงกิจกรรมล่าสุด
}
function updateTaskStatus(s, taskId, status) {
  const t = s.tasks.find(x => x.id === taskId);
  if (t) t.status = status;
}

/* Weighted-average stock receive — สต็อกหลักรับเป็นจำนวนเต็มเท่านั้น */
function receiveStock(s, id, qty, price) {
  const item = stockById(s, id);
  if (!item) return;
  qty = Number(qty) || 0;
  price = Number(price) || 0;
  if (qty <= 0) return;
  qty = Math.floor(qty); // ปัดเศษทิ้ง — หลักเก็บเต็มหน่วยเท่านั้น
  if (qty <= 0) return;
  const totalCost = item.qty * item.avgCost + qty * price;
  item.qty += qty;
  item.avgCost = totalCost / item.qty;
}
function deductStock(s, id, qty) {
  const item = stockById(s, id);
  if (!item) return;
  item.qty = Math.max(0, item.qty - (Number(qty) || 0));
}

/* คืนสต็อกที่งานเบิกไป (ย้อนกลับ addTask) — ใช้ตอนแก้ไขลดจำนวน / ลบงานที่ยังไม่ได้ใช้ของ
   รองรับงานที่ไม่มี stockLog (ข้อมูลเก่า) โดยประมาณจาก costItems */
function restockTask(s, t) {
  const logs = t.stockLog && t.stockLog.length ? t.stockLog : (t.costItems || []).map(ci => ({
    stockId: ci.stockId,
    qty: Number(ci.qty) || 0,
    mainWithdrawn: Math.ceil(Number(ci.qty) || 0),
    openUsed: 0,
    openAdded: Math.max(0, Math.ceil(Number(ci.qty) || 0) - (Number(ci.qty) || 0))
  }));
  logs.forEach(log => {
    if (!log.stockId) return;
    const item = stockById(s, log.stockId);
    if (!item) return;
    item.openQty = Number(item.openQty) || 0;
    // คืนหลักตามที่เบิกไป
    item.qty += log.mainWithdrawn || 0;
    // ย้อน openQty: เอาส่วนที่งานนี้เพิ่มเข้า (openAdded) ออก และคืนส่วนที่ใช้ไป (openUsed)
    item.openQty = Math.max(0, item.openQty - (log.openAdded || 0) + (log.openUsed || 0));
  });
  t.stockLog = [];
}

/* Task status per date: done / planned / overdue */
function taskStatusOf(t) {
  if (t.status === "done") return "done";
  if (t.date < todayISO()) return "overdue";
  return "planned";
}

/* Calendar helpers */
function tasksOn(s, dateStr) {
  return s.tasks.filter(t => t.date === dateStr);
}
function dayStatus(s, dateStr) {
  const list = tasksOn(s, dateStr);
  if (!list.length) return null;
  const hasOverdue = list.some(t => taskStatusOf(t) === "overdue");
  const hasPlanned = list.some(t => taskStatusOf(t) === "planned");
  if (hasOverdue) return "overdue";
  if (hasPlanned) return "planned";
  return "done";
}
