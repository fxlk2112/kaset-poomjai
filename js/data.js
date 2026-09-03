/* ============================================================
   FARMULTIMATE SOLUTIONS v54 — data layer
   seed data + localStorage persistence + business logic
   ตัวเลขการเงินทั้งหมด (KPI, กราฟ, กำไรรายแปลง/รอบ) คำนวณจาก
   บันทึกงานจริง (tasks) ที่ผู้ใช้แก้ไขได้ — ไม่ใช่ตัวเลขตายตัว
   ============================================================ */
"use strict";

/* namespace กลางของ UI — ประกาศที่นี่ (โหลดก่อนไฟล์ UI ทั้งหมด) เพื่อให้ไฟล์ที่แยก
   (notify.js / stock.js / sales.js) เพิ่มฟังก์ชันลง App ได้ตอนโหลด */
const App = {};

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
/* ปัดจำนวนสต็อกเป็นทศนิยม 4 ตำแหน่ง — กันเลขทศนิยมลอย (เช่น 40-39.98 = 0.020000000000000018)
   ทำให้นับ/เทียบจำนวนของได้แม่นยำ ไม่บล็อกการกรอกจำนวนที่เท่ากับของที่เหลือพอดี */
function rndQty(n) {
  return Math.round((Number(n) || 0) * 1e4) / 1e4;
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
  work: "งานประจำ", fertilize: "ใส่ปุ๋ย", spray: "ฉีดยา", harvest: "เก็บเกี่ยว",
  water: "รดน้ำ", inspect: "ตรวจแปลง", expense: "ค่าใช้จ่าย"
};
const TYPE_ICONS = { work: "wrench", fertilize: "leaf", spray: "spray", harvest: "box", water: "droplet", inspect: "search", expense: "dollar" };

/* หมวดต้นทุน — ใช้จัดกลุ่มกราฟวงกลมต้นทุนเชิงลึก */
const COST_CATS = [
  { key: "labor", label: "ค่าจ้างแรงงานชั่วคราว", color: "#2563eb" },
  { key: "pilot", label: "ค่าแรงนักบิน", color: "#0ea5e9" },
  { key: "meals", label: "ค่าอาหารและเครื่องดื่ม", color: "#f97316" },
  { key: "chemical", label: "ค่าสารเคมีทางการเกษตร", color: "#f59e0b" },
  { key: "fertilizer", label: "ค่าปุ๋ยเคมี", color: "#16a34a" },
  { key: "seed", label: "ค่าเมล็ดพันธุ์", color: "#8b5cf6" },
  { key: "materials", label: "ค่าวัสดุอุปกรณ์", color: "#64748b" },
  { key: "utilities", label: "ค่าไฟ", color: "#06b6d4" },
  { key: "other", label: "ค่าใช้จ่ายอื่นๆ", color: "#e11d48" },
];
const COST_CAT_MAP = Object.fromEntries(COST_CATS.map(c => [c.key, c]));
/* หมวดสินค้าสต็อก (หมวดสินค้า) */
const STOCK_CATS = [
  "ปุ๋ยอินทรีย์",
  "ทำความสะอาดคราบ",
  "สารปรับสภาพน้ำ",
  "อาหารเสริม",
  "ปุ๋ยเคมี",
  "ยากำจัดศัตรูพืช",
  "ยากำจัดวัชพืช",
  "ยากำจัดโรคพืช",
  "อาหารเสริมและฮอร์โมน",
  "เมล็ดพันธุ์",
];
/* หน่วยนับสต็อก (แนะนำในฟอร์ม — พิมพ์เองได้ด้วย) */
const STOCK_UNITS = ["กก", "กล่อง", "ขวด", "แกลลอน", "ถุง", "ถัง", "กระปุก", "กระสอบ", "ซอง", "ชุด", "กรัม"];
/* ---- การแปลงหน่วยสำหรับคำนวณการใช้ตามพื้นที่ (เช่น ฉีดยา 4 ไร่ × 100 ซีซี/ไร่) ---- */
const VOLUME_UNITS = { "ซีซี": 1, "มล": 1, "มิลลิลิตร": 1, "ลิตร": 1000 }; // แปลงเป็น ซีซี
const MASS_UNITS = { "กรัม": 1, "กก": 1000, "กิโลกรัม": 1000 }; // แปลงเป็น กรัม
/* แยก "ขนาดสินค้า" เช่น "1,000 ซีซี" -> { amount: 1000, unit: "ซีซี" } (หน่วยตัดจุดท้ายออก) */
function parseStockSize(size) {
  if (!size) return null;
  const m = String(size).trim().match(/^([\d.,]+)\s*(\S.*)$/);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;
  return { amount, unit: m[2].trim().replace(/\.+$/, "") };
}
function sizeFamily(unit) {
  if (!unit) return null;
  const u = String(unit).trim().replace(/\.+$/, "");
  if (u in VOLUME_UNITS) return "volume";
  if (u in MASS_UNITS) return "mass";
  return null;
}
function unitToBase(unit) {
  if (!unit) return 1;
  const u = String(unit).trim().replace(/\.+$/, "");
  return VOLUME_UNITS[u] || MASS_UNITS[u] || 1;
}
/* นำเข้าสินค้า (Item Master) — เพิ่มรายการใหม่ และอัปเดตรายการเดิมเมื่อ import มีข้อมูลใหม่ */
function mergeStockProducts(s, products) {
  let added = 0, updated = 0, skipped = 0;
  const keyOf = x => (x.name || "").trim().toLowerCase() + "|" + (x.size || "") + "|" + (x.unit || "") + "|" + (x.supplier || "");
  const existing = new Map((s.stock || []).map(x => [keyOf(x), x]));
  (products || []).forEach(p => {
    const name = String(p.name || p.productName || "").trim();
    if (!name) return;
    const size = String(p.size || "").trim();
    const unit = String(p.unit || "").trim() || "ชิ้น";
    const supplier = String(p.supplier || p.company || "").trim();
    const key = name.toLowerCase() + "|" + size + "|" + unit + "|" + supplier;
    const photos = Array.isArray(p.photos) ? p.photos.map(x => String(x || "").trim()).filter(Boolean)
      : String(p.photo || p.photoName || "").split(",").map(x => x.trim()).filter(Boolean);
    const item = {
      name,
      code: String(p.code || "").trim(), // รหัสสินค้าเดิม (จากไฟล์ Excel)
      generic: String(p.generic || p.genericName || "").trim(),
      category: String(p.category || "").trim(),
      size, unit, supplier,
      photo: photos[0] || "",
      photos,
      qty: Number(p.qty) || 0,
      avgCost: Number(p.avgCost) || 0,
      salePrice: Number(p.salePrice) || 0 // ราคาขายต่อหน่วย (จากไฟล์ Excel / แก้ไขเอง)
    };
    const old = existing.get(key);
    if (old) {
      let changed = false;
      ["code", "generic", "category"].forEach(k => {
        if (item[k] !== "" && old[k] !== item[k]) { old[k] = item[k]; changed = true; }
      });
      if (p.salePrice !== undefined && Number(old.salePrice) !== item.salePrice) {
        old.salePrice = item.salePrice;
        changed = true;
      }
      if (photos.length) {
        const nextPhotos = p.appendPhotos
          ? [...(old.photos || (old.photo ? [old.photo] : [])), ...photos].filter((v, i, arr) => v && arr.indexOf(v) === i)
          : photos;
        if (JSON.stringify(old.photos || []) !== JSON.stringify(nextPhotos)) {
          old.photos = nextPhotos;
          old.photo = nextPhotos[0] || "";
          changed = true;
        }
      }
      if (photos.length && !old.photo) {
        old.photo = (old.photos || [])[0] || photos[0] || "";
        changed = true;
      }
      if (p.qty !== undefined && Number(old.qty) !== item.qty) {
        old.qty = item.qty;
        changed = true;
      }
      if (p.avgCost !== undefined && Number(old.avgCost) !== item.avgCost) {
        old.avgCost = item.avgCost;
        changed = true;
      }
      if (changed) updated++;
      else skipped++;
      return;
    }
    const fresh = Object.assign({ id: uid(), openQty: 0 }, item);
    s.stock.push(fresh);
    existing.set(key, fresh);
    added++;
  });
  return { added, updated, skipped };
}
/* หมวดต้นทุนทั้งหมด = หมวดพื้นฐาน + หมวดที่ผู้ใช้เพิ่มเอง (เก็บใน state.customCostCats) */
function allCostCats(s) {
  return [...COST_CATS, ...((s && s.customCostCats) || []).map(c => ({ ...c, custom: true }))];
}
function costCatMap(s) {
  return Object.fromEntries(allCostCats(s).map(c => [c.key, c]));
}
function defaultCostCat(type) {
  if (type === "fertilize") return "fertilizer";
  if (type === "work") return "labor";
  if (type === "spray") return "chemical";
  return "other";
}

/* รายการสินค้าเริ่มต้นถูกถอดออกจาก client เพื่อไม่เปิดเผยข้อมูลสต็อกของกิจการ */
const STOCK_MASTER_PRESETS = [];

/* ---------- seed ---------- */
function seed() {
  /* เวอร์ชันเริ่มต้นแบบว่างเปล่า — ไม่มีข้อมูลตัวอย่าง ให้ผู้ใช้กรอกเอง (แปลง/งาน/สต็อก/รอบ/ขาย) */
  return {
    version: 54,
    role: "general",
    /* ---- โหมดแก้ไขเว็บ (ผู้ดูแล) ---- */
    adminPass: "",            // รหัสผ่านผู้ดูแล — ว่าง = ยังไม่ได้ตั้ง (ตั้งครั้งแรกได้ที่หน้าตั้งค่า)
    texts: {},                // คำที่ผู้ดูแลแก้ เช่น { brandName: "..." } — ชนะค่าเริ่มต้น
    homeOrder: ["cal", "tasks", "profit", "activity"], // ลำดับ section หน้าแรก
    customMenus: [],          // เมนูที่ผู้ดูแลเพิ่มในหน้าเพิ่มเติม [{ id, ico, name, desc, target }]
    customCostCats: [],       // หมวดต้นทุนที่ผู้ใช้เพิ่มเองจากหน้า ตั้งค่า [{ key, label, color }]
    plots: [],                // แปลง
    stock: [],                // สต็อกยา/ปุ๋ย/สินค้า
    equipment: [],            // อุปกรณ์/เครื่องจักร
    cycles: [],               // รอบการปลูก
    tasks: [],                // งาน/กิจกรรม
    sales: [],                // ใบเสร็จขายสินค้า
    valves: [],               // วาล์วน้ำ IoT (โครงเดิม)
    water: { sources: [], systems: [], logs: [] },  // ระบบน้ำรายแปลง: แหล่งน้ำ / ระบบต่อแปลง / บันทึกให้น้ำ
    workers: { working: 0, resting: 0, leave: 0, total: 0 },
    tourDone: false,
    notifDismissed: {}, /* งานที่ปิดการแจ้งเตือนแล้ว (กัน crash ในรอบแรกที่ยังไม่มีข้อมูลเก่า) */
  };
}

/* ==================== สูตรแผนดูแลรายพืช (Crop Playbook) — ฉบับวิชาการ ====================
   อ้างอิง: กรมวิชาการเกษตร (ศูนย์วิจัยพืชไร่นครสวรรค์), กรมส่งเสริมการเกษตร,
   ธ.ที่ดิน (ดินไทยและธาตุอาหารพืช), Rice Knowledge Bank, ม.เกษตรศาสตร์
   day = จำนวนวันหลังวันเริ่มปลูก · note = อัตรา/รายละเอียดวิชาการ · warn = ช่วงต้องระวังเป็นพิเศษ
   อัตราปุ๋ยเป็นค่าแนะนำทั่วไป — แม่นยำสุดคือใส่ตามค่าวิเคราะห์ดินรายแปลง */
const CROP_PLAYBOOKS = {
  "ข้าว": [
    { day: 0, title: "เตรียมดิน: ไถตากดิน 7-10 วัน แล้วคราดเก็บเศษซาก", type: "inspect",
      note: "ไถ 1 ครั้ง ตากดิน 7-10 วัน พรวน 1 ครั้ง — กำจัดเมล็ดวัชพืชข้ามปี ก่อนปักดำ/หว่าน" },
    { day: 7, title: "ปักดำ / หว่านเมล็ด", type: "plant",
      note: "ข้าวไวต่อช่วงแสง: ใส่ปุ๋ยไนโตรเจนครั้งแรกหลังปักดำ 1 สัปดาห์ (ระยะ 15-20 วันหลังงอก)" },
    { day: 20, title: "ใส่ปุ๋ยครั้งที่ 1 (ระยะตั้งตัว/แตกกอ)", type: "fertilize", warn: true,
      note: "46-0-0 20-25 กก./ไร่ + 16-20-0 20-25 กก./ไร่ (ฟอสเฟต+โพแทชใส่ครั้งแรกทั้งหมด) — ใส่ช้า = แตกกอน้อย ผลผลิตหาย" },
    { day: 40, title: "ตรวจศัตรูพืชช่วงแตกกอ: เพลี้ยกระโดด/เพลี้ยหอย/หนอนกอ", type: "inspect", warn: true,
      note: "เพลี้ยกระโดดหลังหูกระจายเร็วมาก — พบมากกว่า 30-40 ตัว/ต้น ให้พ่นทันที" },
    { day: 60, title: "ใส่ปุ๋ยครั้งที่ 2 (ระยะกำเนิดช่อดอก)", type: "fertilize", warn: true,
      note: "46-0-0 10-15 กก./ไร่ — กำเนิดช่อดอก = ก่อนเก็บเกี่ยว ~2 เดือน ต้องมีน้ำในนาตลอด ขาดน้ำ = รวงเป็นพัง" },
    { day: 85, title: "ระยะออกดอก — รักษาระดับน้ำ อย่าให้ขาด", type: "water", warn: true,
      note: "ช่วงออกดอกนาต้องมีน้ำตลอดเวลา · ระวังเพลี้ยไฟทำลายข้าวอ่อน (ข้าวหัวปี) ช่วงนาแห้ง" },
    { day: 115, title: "เก็บเกี่ยว", type: "harvest",
      note: "สังเกตเมล็ดบนรวงสุก ~90% แฉกทอง — ข้าวตั้งท้องถึงสุกใช้เวลา 25-30 วัน" }
  ],
  "ข้าวโพด": [
    { day: 0, title: "เตรียมดิน + ใส่ปุ๋ยรองพื้น + ปลูก", type: "plant",
      note: "ไถตาก 7-10 วัน · ปุ๋ยรองพื้น 15-15-15: ดินเหนียวดำ 40 กก./ไร่ · ดินเหนียวแดง/ร่วนเหนียว 50 · ดินร่วนทราย 60 + ปุ๋ยอินทรีย์ 500-1,000 กก./ไร่ · ปลูกระยะ 70-75 × 20 ซม. เมล็ด 3-4 กก./ไร่" },
    { day: 1, title: "พ่นสารกำจัดวัชพืชทันทีหลังปลูก (ก่อนงอก)", type: "pesticide", warn: true,
      note: "อะลาคลอร์ 48% 125-150 มล./น้ำ 20 ล. หรืออาทราซีน 80% 100-150 ก./น้ำ 20 ล. พ่น 80 ล./ไร่ — พ่นคลุมดิน ดินต้องมีความชื้น ห้ามพ่นหลังข้าวโพดงอก" },
    { day: 22, title: "กำจัดวัชพืชระหว่างแถว + ปุ๋ยแต่งหน้าครั้งที่ 1 + พูนโคน", type: "fertilize", warn: true,
      note: "อายุ 20-25 วัน: 46-0-0 15-25 กก./ไร่ (หรือ 21-0-0 30 กก./ไร่) โรยข้างแถวแล้วพรวนกลบ พูนโคน — ต้องเสร็จก่อนให้น้ำครั้งแรก" },
    { day: 45, title: "ปุ๋ยแต่งหน้าครั้งที่ 2 (ช่วงออกไหม-ช่อดอกตัวผู้)", type: "fertilize", warn: true,
      note: "46-0-0 10-20 กก./ไร่ โรยข้างร่องหลังให้น้ำ — ⚠️ ระยะวิกฤตน้ำ: ขาดน้ำช่วงออกดอก = ฝักอ่อน เมล็ดลีบ ผลผลิตหายหนัก · น้ำทั้งฤดู 450-500 มม. อย่างน้อย 4 ครั้ง" },
    { day: 75, title: "ตรวจหนอนเจาะฝัก/เพลี้ยแป้ง", type: "inspect",
      note: "หนอนเจาะฝักข้าวโพดระบาดช่วงออกฝักอ่อน — ตรวจปลายฝักและช่อเกสรตัวเมีย" },
    { day: 95, title: "เก็บเกี่ยว", type: "harvest",
      note: "ข้าวโพดเลี้ยงสัตว์ 95-100 วัน — เกล็ดหุ้มฝักเริ่มเปลี่ยนสี ฝักอวบเต็มที่" }
  ],
  "มันสำปะหลัง": [
    { day: 0, title: "เตรียมดิน + ปลูกท่อนพันธุ์", type: "plant",
      note: "ไถ 1-2 ครั้ง ตากดิน · ดินเป็นกรด pH<5.5 ใส่โดโลไมท์ 100 กก./ไร่ก่อนไถ · ดินอินทรียวัตถุต่ำ ใส่ปุ๋ยอินทรีย์ 700 กก./ไร่ไถกลบ · ปลูกท่อนพันธุ์ยาว 20-25 ซม. ปักเฉียง" },
    { day: 30, title: "กำจัดวัชพืชครั้งที่ 1 + ใส่ปุ๋ยครั้งแรก ⭐ ระยะสำคัญของปุ๋ย", type: "fertilize", warn: true,
      note: "อายุ 1 เดือน: 16-8-8 50 กก./ไร่ (หรือ 15-15-15 54 กก./ไร่) เปิดร่องข้างแถวโรยแล้วกลบ — มันสำปะหลังต้องการปุ๋ยช่วงอายุ 1-3 เดือนมากที่สุด ใส่ช้า = หัวมันเล็ก" },
    { day: 90, title: "ใส่ปุ๋ยครั้งที่ 2 (ดินทราย/อัตราสูง)", type: "fertilize",
      note: "อายุ 3 เดือนหลังกำจัดวัชพืช: 46-0-0 18-28 กก./ไร่ (ดินทรายควรแบ่งใส่ อายุ 1 และ 2 เดือน) — ใส่ตามค่าวิเคราะห์ดินประหยัดกว่า" },
    { day: 180, title: "ตรวจโรคใบจุดน้ำตาล/แมลงหนวดจิ้ดเต่า", type: "inspect",
      note: "โรคใบจุดน้ำตาลระบาดช่วงฝนชุก — เก็บใบเป็นโรคทำลายนอกแปลง" },
    { day: 330, title: "เก็บเกี่ยว (ตามสายพันธุ์ 10-12 เดือน)", type: "harvest",
      note: "ระยางค์ 10-12 เดือนให้แป้งสูงสุด · ตัดโคนก่อนขุด 1-2 สัปดาห์ เพื่อลดความชื้นหัวมัน" }
  ],
  "อ้อย": [
    { day: 0, title: "เตรียมร่อง + ปุ๋ยรองพื้น + ปลูกท่อนพันธุ์", type: "plant",
      note: "ใส่ปุ๋ยรองพื้น 0-3-0 (หินฟอสเฟต) 200 กก./ไร่ รองก้นร่องตอนปลูก · วางท่อนพันธุ์ซ้อนกัน 2 ท่อน" },
    { day: 30, title: "ใส่ปุ๋ยครั้งแรก (อายุ 1 เดือนหลังงอก)", type: "fertilize",
      note: "20-10-12 45 กก./ไร่ + 0-0-60 2 กก./ไร่ (เขตชลประทาน · เขตน้ำฝนใส่ต้นฤดูฝน)" },
    { day: 120, title: "ใส่ปุ๋ยครั้งที่ 2 (หลังครั้งแรก 2 เดือน)", type: "fertilize",
      note: "20-10-12 45 กก./ไร่ — แบ่งใส่ปีละ 2 ครั้ง ไนโตรเจนครึ่งหนึ่งต่อครั้ง ฟอสฟอรัส/โพแทสเซียมใส่ครั้งแรกทั้งหมด" },
    { day: 180, title: "ตรวจศัตรู: เพลี้ยไฟ/หนอนกอ/โรคส้มครู", type: "inspect", warn: true,
      note: "ช่วงฝนชุกโรคส้มครูระบายผ่านแมลงดูดน้ำเลี้ยง — ถอนต้นเป็นโรคเผาทำลาย ห้ามนำไปใช้ท่อนพันธุ์" },
    { day: 330, title: "หยุดให้น้ำ 6-8 สัปดาห์ก่อนตัด", type: "water", warn: true,
      note: "หยุดให้น้ำช่วงท้าย = น้ำตาลสะสมสูงขึ้น 1-2% ได้ราคาพรีเมียมจากโรงงาน" },
    { day: 365, title: "ตัดอ้อยส่งโรงงาน", type: "harvest",
      note: "อ้อยปลูก 10-14 เดือน · ตัดแล้วส่งโรงงานภายใน 48 ชม. กันน้ำตาลลด" }
  ],
  "พริก": [
    { day: 0, title: "ปลูกกล้าลงแปลง (ระยะไม่ชิด กันความชื้นสูง)", type: "plant",
      note: "เพาะกล้าล่วงหน้า 25-30 วัน · แช่เมล็ดน้ำอุ่น 50°C 20-25 นาที กันโรคก่อนเพาะ · จัดระยะปลูกห่าง กำจัดวัชพืชสม่ำเสมอ ลดความชื้น = ลดโรค" },
    { day: 15, title: "ใส่ปุ๋ยรอง (สูตรเสมอ)", type: "fertilize",
      note: "15-15-15 หรือสูตรใกล้เคียง โรยรอบโคน" },
    { day: 30, title: "ตรวจเพลี้ยไฟ/ไรแดง/เพลี้ยแป้ง ⚠️ พาหะโรคใบด่าง", type: "inspect", warn: true,
      note: "เพลี้ยไฟ/เพลี้ยแป้งเป็นพาหะโรคใบด่าง (มันสำปะหลังใบด่างในพริก) — พบใบม้วน/แคระ ถอนทำลายทันที + ควบคุมแมลงพาหะ" },
    { day: 45, title: "ใส่ปุ๋ยรอบ 1 ช่วงออกดอก + ป้องกันโรคแอนแทรคโนส", type: "fertilize", warn: true,
      note: "ปุ๋ยร่วมโพแทสเซียมสูงช่วงออกดอก · พ่นป้องกันแอนแทรคโนส (โรคกุ้งแห้ง): โพรคลอราซ 45% EC 20 มล. หรือไดฟีโนโคนาโซล 25% EC 20 มล. หรืออะซอกซีสโตรบิน 25% SC 10 มล./น้ำ 20 ล. พ่นซ้ำทุก 7 วัน" },
    { day: 60, title: "เก็บผลรอบแรก", type: "harvest",
      note: "เก็บผลแก่เขียว — ผลเริ่มเปลี่ยนสีคือช่วงแอนแทรคโนสระบาด ตรวจทุกวัน เก็บผลเป็นโรคไปทำลายนอกแปลง" },
    { day: 75, title: "ใส่ปุ๋ยหลังเก็บ + เฝ้าระวังโรคต่อเนื่อง", type: "fertilize",
      note: "ใส่ปุ๋ยทุกครั้งหลังเก็บผล เพื่อให้ออกดอกรอบถัดไป · หลีกเลี่ยงให้น้ำสาดท่วมแปลง (โรคเน่า)" }
  ],
  "แตงโม": [
    { day: 0, title: "ยกร่อง + คลุมฟิล์ม + ปลูกกล้า", type: "plant",
      note: "ยกร่องกว้าง 3-4 ม. ปลูก 2 แถว/ร่อง ระยะ 60-80 ซม. — คลุมฟิล์มดำกันวัชพืช/รักษาความชื้น" },
    { day: 10, title: "ใส่ปุ๋ยรอง + รดน้ำเช้า-เย็น", type: "fertilize",
      note: "ปุ๋ยสูตรเสมอ 15-15-15 ผสมน้ำรด — แตงโมต้องการน้ำสม่ำเสมอช่วงแตกเถา" },
    { day: 25, title: "ใส่ปุ๋ยรอบ 1 + ตรวจเพลี้ยแป้ง/ไรแดง", type: "inspect",
      note: "เพลี้ยแป้ง/ไรแดงระบาดอากาศร้อนแล้ง — พ่นน้ำล้างใบช่วยลดได้" },
    { day: 40, title: "ผสมเกสรด้วยมือ + ปลิดผลทิ้ง เหลือ 1-2 ผล/ต้น ⭐ หัวใจของแตงโม", type: "inspect", warn: true,
      note: "ผสมเกสรเช้าแดดอ่อน (ดอกบานเช้าวันเดียว) — เลือกไว้ 1-2 ผล/ต้นที่รูปทรงดี ตำแหน่งเหมาะ ที่เหลือปลิดทิ้ง ผลจะได้น้ำหนักเต็มที่" },
    { day: 55, title: "ใส่ปุ๋ยช่วงสร้างความหวาน + ลดน้ำ", type: "fertilize", warn: true,
      note: "โพแทสเซียมสูง (0-0-60/13-13-21) — ลดน้ำช่วงท้าย เพิ่มความหวาน แต่ระวังผลแตก (น้ำเปลี่ยนแปลงกระทันหัน)" },
    { day: 70, title: "เก็บเกี่ยว", type: "harvest",
      note: "อายุผล 30-35 วันหลังติดผล · สัญญาณ: ม้วนใกล้ผลแห้ง/เสียงก้องเมื่อเคาะ · เก็บเช้าตรู่" }
  ],
  "มะม่วง": [
    { day: 0, title: "ใส่ปุ๋ยหลังเก็บผล + ตัดแต่งกิ่งเปิดทรงพุ่ม", type: "fertilize",
      note: "ปุ๋ยอินทรีย์ + สูตรเสมอ ตัดกิ่งแห้ง/กิ่งไขว้ เปิดแดดทะลุ ลดโรค" },
    { day: 45, title: "ใส่ปุ๋ยกระตุ้นดอก + พ่นกระตุ้น", type: "fertilize",
      note: "โพแทสเซียมสูง (13-13-21/0-0-60) + พ่นสารกระตุ้นดอกตามคำแนะนำ — รดน้ำสลับแล้งเพื่อบังคับดอก" },
    { day: 60, title: "ช่วงดอกบาน ⚠️ โรคราแป้ง/แอนแทรคโนส/เพลี้ยจักจั่นฝอย", type: "inspect", warn: true,
      note: "ปฏิทินศัตรู กรมส่งเสริมการเกษตร: ช่วงดอกบานพบ ราแป้ง-ราดำ-เพลี้ยแป้ง-เพลี้ยไฟ-เพลี้ยจักจั่นฝอย-ด้วงงวง — พ่นป้องกันตามรอบ 7-10 วัน" },
    { day: 75, title: "ผลติด ⚠️ แอนแทรคโนส/หนอนเจาะผล — คลุมผล", type: "inspect", warn: true,
      note: "คลุมผลถุงกันแมลง/ฝน ขนาดผลไข่ไก่ — ลดการใช้สารเคมีช่วงท้าย ตอบโจทย์สารตกค้าง" },
    { day: 105, title: "⚠️ แมลงวันผลไม้ระบาด — วางกับดัก", type: "inspect", warn: true,
      note: "วางกับดักกาวผสมเมทิลยูจีโนล + เก็บผลร่วงทำลาย — ใกล้เก็บเลี่ยงพ่นสารเคมี (เวลารอคอยผลผลิต)" },
    { day: 120, title: "เก็บเกี่ยว", type: "harvest",
      note: "เก็บเกี่ยวหลังดอกบาน 120 วัน — ตัดพร้อมก้าน ระวังน้ำยางหยดใส่ผล (ทำให้ผลด่าง)" }
  ],
  "ทุเรียน": [
    { day: 0, title: "ใส่ปุ๋ยอินทรีย์ + โดโลไมท์ (หลังเก็บเกี่ยว)", type: "fertilize",
      note: "ปุ๋ยอินทรีย์ 20-50 กก./ต้น + โดโลไมท์ 1-2 กก./ต้น รอบแนวโคน — ฟื้นฟูต้นหลังลงทุนผล" },
    { day: 30, title: "⚠️ ตรวจโรครากเน่า-โคนเน่า (ฤดูฝน)", type: "inspect", warn: true,
      note: "โรครากเน่าโคนเน่า (Phytophthora) ระบาดหน้าฝน — ระบายน้ำรอบโคน ไม่ให้ขัง พบเปลือกเปื่อยยางไหล ให้ขูดแผลทายา" },
    { day: 90, title: "ใส่ปุ๋ยช่วงแตกใบ/ออกดอก", type: "fertilize",
      note: "สูตรเสมอหรือสูตรส่งเสริมดอก (โพแทสเซียมสูง) รอบแนวโคน — ทุเรียนต้องการน้ำสม่ำเสมอแต่ไม่ขัง" },
    { day: 120, title: "ช่วงออกดอก ⚠️ ราดำ/แอนแทรคโนส/เพลี้ยหอย/ไหมทอง", type: "inspect", warn: true,
      note: "พ่นป้องกันช่วงช่อดอก-ดอกบาน ทุก 7-10 วัน — ดอกร่วงจากราดำคือความเสียหายทั้งปี" },
    { day: 150, title: "ติดผล — รดน้ำสม่ำเสมอ ขาดน้ำ = ผลร่วง", type: "water", warn: true,
      note: "รักษาความชื้นสม่ำเสมอช่วงผลกำลังพัฒนา ห้ามขาดน้ำ/น้ำกระชั้น — ผลจะร่วงหรือผลผลิตตก" }
  ]
,
"ข้าวโพดหวาน": [
    { day: 0, title: "เตรียมดิน + ปุ๋ยรองพื้น + หยอดเมล็ด", type: "plant",
      note: "ปุ๋ยรองพื้น 16-20-0 (ดินเหนียว) หรือ 15-15-15 (ดินทราย) อัตรา 25-75 กก./ไร่ + อินทรียวัตถุ 1,000 กก./ไร่ · ระยะปลูก 25×75 ซม. · เมล็ดพันธุ์ต้องทดสอบงอก ≥85% ก่อนปลูก (มกษ.)" },
    { day: 1, title: "พ่นสารกำจัดวัชพืชทันทีหลังปลูก (ก่อนงอก)", type: "pesticide",
      note: "พ่นคลุมดิน ดินต้องมีความชื้น — ห้ามพ่นหลังข้าวโพดงอกแล้ว" },
    { day: 7, title: "ใส่ปุ๋ยครั้งที่ 1", type: "fertilize",
      note: "15-15-15 25-50 กก./ไร่ หรือ 21-0-0 50 กก./ไร่ ละลายน้ำ 80 ล. รดโคนต้น/หยอดโคน" },
    { day: 25, title: "ใส่ปุ๋ยครั้งที่ 2 + กำจัดวัชพืช + คลุมโคน", type: "fertilize", warn: true,
      note: "46-0-0 25-50 กก./ไร่ — ⚠️ หลังจากนี้เข้าช่วงสร้างช่อดอกเกสรตัวผู้ + รากเจริญเร็ว ห้ามรบกวนราก (ต้นจะเหี่ยว ชะงักโต)" },
    { day: 32, title: "ตรวจหนอนเจาะฝัก/โรคราน้ำค้าง/ไวรัส", type: "inspect",
      note: "โรคสำคัญของข้าวโพดหวาน: ราน้ำค้าง ไวรัส ราสนิม ใบไหม้แผลใหญ่ + หนอนเจาะฝัก — ตรวจสม่ำเสมอช่วงก่อนออกไหม" },
    { day: 45, title: "ใส่ปุ๋ยครั้งสุดท้าย + ให้น้ำต่อเนื่อง", type: "fertilize", warn: true,
      note: "13-13-21 25-50 กก./ไร่ — ⚠️ ขาดน้ำช่วงนี้ ต้นจะหยุดสร้างฝัก ปลายฝักฟ่อทันที" },
    { day: 47, title: "📝 จดวันออกไหม! (อายุ 45-50 วัน ออกไหม 50% ของแปลง)", type: "inspect", warn: true,
      note: "หัวใจของข้าวโพดหวาน: นับวันเก็บเกี่ยวจากวันออกไหม = ออกไหม + 16-20 วัน (ฤดูหนาวเก็บช้ากว่า 3-5 วัน) — จดวันที่นี้ไว้เด็ดขาด" },
    { day: 65, title: "ตรวจความพร้อมเก็บเกี่ยว", type: "inspect",
      note: "เกณฑ์ฝักสด: ปลายไหมเริ่มแห้ง · บีบเมล็ดมีของเหลวขาวขุ่นคล้ายน้ำนม · TSS ≥ 9 °Brix · ฝัก 4-5 ซม. ยาว 15-18 ซม. น้ำหนัก ≥ 250 ก." },
    { day: 70, title: "เก็บเกี่ยว (อายุรวม 70-75 วัน)", type: "harvest",
      note: "เก็บเช้าตรู่ ตัดก้านเหลือ 20 ซม. ยืดความสด · ส่งตลาด/โรงงานภายใน 24 ชม. (ไม่ปอกเปลือกจะสดนานกว่า) · เก็บที่ร่ม ไม่กองสุม" }
  ],
  "คะน้า": [
    { day: 0, title: "เตรียมดิน + หยอดเมล็ด", type: "plant",
      note: "ขุดดินลึก 15-20 ซม. ตาก 7-10 วัน + ปุ๋ยคอก/ปุ๋ยหมักคลุกดิน + ปูนขาวถ้าดินเป็นกรด · หยอดเมล็ด 3-5 เมล็ด/หลุม ระยะ 25×50 ซม. กลบดิน 0.5 ซม." },
    { day: 8, title: "ถอนแยกเหลือ 1 ต้น/หลุม + ใส่ปุ๋ยครั้งที่ 1", type: "fertilize",
      note: "ถอนแยกอายุ 15-20 วัน (หรือเพาะถาดย้ายอายุ 25 วัน) · ปุ๋ยครั้งที่ 1 หลังย้าย/ถอนแยก 7-10 วัน" },
    { day: 20, title: "ใส่ปุ๋ยครั้งที่ 2", type: "fertilize",
      note: "หลังครั้งแรก 10-15 วัน — 46-0-0 หรือสูตรเสมอ โรยรอบโคนตามด้วยน้ำ" },
    { day: 32, title: "ใส่ปุ๋ยครั้งที่ 3 (ช่วงเจริญเติบโตเร็ว)", type: "fertilize",
      note: "หลังครั้งที่ 2 อีก 10 วัน — คะน้ารากตื้นต้องการน้ำสม่ำเสมอ ขาดน้ำ = ใบแข็งเหี่ยว" },
    { day: 35, title: "ตรวจหนอนใบหยัก/หนอนคืบหลังจุด/เพลี้ยกระโดด", type: "inspect", warn: true,
      note: "ผักตระกูลกะหล่ำหนอนระบาดเร็วมากช่วงฝน — ตรวจใต้ใบทุก 2-3 วัน จับทำลายช่วงตัวหนอนเล็ก" },
    { day: 48, title: "เก็บเกี่ยว (45-55 วัน)", type: "harvest",
      note: "เก็บทั้งต้นตัดโคน หรือเก็บยอดอ่อน (อายุ 30 วัน) — คะน้าบางบัวทองใบใหญ่ก้านอวบ ขายได้ทั้งก้านและยอด" }
  ],
  "ผักกาดเขียวปลี": [
    { day: 0, title: "เตรียมดิน + คุมวัชพืช + หยอดเมล็ด", type: "plant",
      note: "ไถตาก 10 วัน + ปุ๋ยคอก + ปูนขาว ยกร่อง · พ่นอะลาคลอร์/เพนดิเมทารินคุมวัชพืช ทิ้ง 1 คืน · โรยฟางบาง ๆ แล้วหยอดเมล็ดคลุกคาร์โบซัลแฟน/อิมิดาโคลพริด+เมตาแลคซิล ระยะ 30×35 ซม. 2-3 เมล็ด/หลุม" },
    { day: 10, title: "ถอนแยก (ใบจริง 2 คู่) + ใส่ปุ๋ยครั้งที่ 1", type: "fertilize",
      note: "46-0-0 ผสม 15-15-15 รวม 50 กก./ไร่ — ใส่แล้วรดน้ำให้ทั่วถึง ละลายปุ๋ยหมด" },
    { day: 25, title: "ตรวจหนอนใบหยัก/หนอนคืบหลังจุด/เพลี้ยกระโดด", type: "inspect", warn: true,
      note: "หนอนใบหยักระบาดหนักช่วงฝน — ใช้สารชีวภัณฑ์ บีที/เชื้อบาซิลลัส ช่วงหนอนเล็ก ปลอดสารตกค้าง" },
    { day: 40, title: "ใส่ปุ๋ยรอบ 2 บำรุงปลี", type: "fertilize",
      note: "ปุ๋ยสูตรบำรุงใบ/ปลี — ระยะนี้ผักกาดกำลังสร้างปลี ต้องการน้ำสม่ำเสมอ ขาดน้ำ = ใบแข็งขม" },
    { day: 55, title: "เก็บเกี่ยว (พันธุ์เบา 50-60 วัน)", type: "harvest",
      note: "ตัดโคนด้วยมีด — พันธุ์เบา 50-60 วัน ปลูกได้ทั้งปี · พันธุ์หนัก 90-100 วัน (ก.ย.-ม.ค.) ส่งโรงดอง" }
  ],
  "ผักกาดขาว": [
    { day: 0, title: "เตรียมดิน + ยกแปลง + ย้ายกล้า/หยอดเมล็ด", type: "plant",
      note: "ขุดตาก 14 วัน + ปูนขาว 0-100 ก./ตร.ม. ทิ้งไว้ 10 วัน + ปุ๋ย 12-24-12 30 ก./ตร.ม. + ปุ๋ยคอก 1 กก./ตร.ม. · แปลงกว้าง 1 ม. · เพาะกล้าย้ายอายุ 20-25 วัน" },
    { day: 18, title: "ใส่ปุ๋ยครั้งที่ 1 (หลังย้ายปลูก 15-20 วัน)", type: "fertilize",
      note: "15-15-15 หรือ 46-0-0 30 ก./ตร.ม. พร้อมกำจัดวัชพืช" },
    { day: 28, title: "ใส่ปุ๋ยครั้งที่ 2 (หลังย้าย 25-30 วัน) — ช่วงเข้าหัว", type: "fertilize", warn: true,
      note: "13-13-21 30 ก./ตร.ม. + กำจัดวัชพืช — ⚠️ ระยะเข้าหัวต้องการน้ำสม่ำเสมอมากที่สุด ขาดน้ำ = ไม่เข้าหัว/หัวแตก" },
    { day: 35, title: "ตรวจโรคเน่าคอดิน/แมลงหวี่ขาว/เพลี้ยอ่อน", type: "inspect", warn: true,
      note: "โรคเน่าคอดินระบาดช่วงฝน แปลงน้ำขัง — ยกแปลงสูง 30-50 ซม. ฤดูฝน · แมลงหวี่ขาวใบหยิก ใช้กับดักเหลือง" },
    { day: 60, title: "เก็บเกี่ยว", type: "harvest",
      note: "เข้าหัวดี ห่อปลีแน่น — ตัดโคนด้วยมีด ทาปูนแดงที่รอยตัด เหลือใบนอก 2-3 ใบ ผึ่งแห้ง คัดมาตรฐาน ตัดหัวเน่า/ถูกแมลงทำลาย" }
  ]
};

/* ชื่อพันธุ์การค้า → สูตรพืช (เช่น ไฮบริกซ์ 72 / เอทีเอส 15 คือข้าวโพดหวาน) */
const CROP_PLAYBOOK_ALIASES = {
  "ไฮบริกซ์": "ข้าวโพดหวาน", "ไฮบริก": "ข้าวโพดหวาน", "hybrix": "ข้าวโพดหวาน",
  "เอทีเอส": "ข้าวโพดหวาน", "ats": "ข้าวโพดหวาน",
  "บางบัวทอง": "คะน้า", "เขียวปลี": "ผักกาดเขียวปลี", "กาดขาว": "ผักกาดขาว"
};




/* หาสูตรจากชื่อพืช — ชื่อพืชต้อง "มี" คีย์อยู่ในตัว (กัน 'ข้าว' ไปจับ 'ข้าวโพด') หรือพิมพ์ตรงเป๊ะ */
function playbookFor(plant) {
  const n = String(plant || "").trim().toLowerCase();
  if (!n) return null;
  /* ชื่อพันธุ์การค้า → สูตรพืชหลัก (เช่น ไฮบริกซ์ 72 / ATS 15 = ข้าวโพดหวาน) */
  const aliasKeys = Object.keys(CROP_PLAYBOOK_ALIASES).sort((a, b) => b.length - a.length);
  for (const a of aliasKeys) {
    if (n.indexOf(a) !== -1) return { key: CROP_PLAYBOOK_ALIASES[a], steps: CROP_PLAYBOOKS[CROP_PLAYBOOK_ALIASES[a]] };
  }
  const keys = Object.keys(CROP_PLAYBOOKS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const kk = k.toLowerCase();
    if (n === kk || n.indexOf(kk) !== -1) return { key: k, steps: CROP_PLAYBOOKS[k] };
  }
  return null;
}
/* สร้างงานจากสูตร → คืนจำนวนงานที่สร้าง (ขั้น warn ติด ⚠️ + แนบอัตรา/ข้อควรระวังวิชาการใน note) */
function generatePlaybookTasks(cycle) {
  const pb = playbookFor(cycle.plant);
  if (!pb) return 0;
  pb.steps.forEach(st => {
    S.tasks.push({
      id: uid(), title: (st.warn ? "⚠️ " : "") + st.title, date: addDaysISO(cycle.startDate, st.day),
      type: st.type, plotId: cycle.plotId, cycleId: cycle.id, status: "planned",
      note: "📋 สูตร " + pb.key + " (วันที่ " + st.day + " หลังปลูก)" + (st.note ? " — " + st.note : ""), createdAt: Date.now()
    });
  });
  return pb.steps.length;
}

/* ---------- persistence ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        /* ยอมรับข้อมูลทุกเวอร์ชัน — เติมฟิลด์ใหม่ผ่าน ensureDefaults (ไม่ทิ้งข้อมูลผู้ใช้)
           เวอร์ชันถูกรีเซ็ตเป็นเวอร์ชันปัจจุบันเพื่อให้ saveState ครั้งถัดไปอัปเดตครบ */
        ensureTaskIds(s);
        ensureDefaults(s);
        s.version = 54;
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
  /* หมายเหตุ: เดิมเคยเติมสต็อกตัวอย่างอัตโนมัติ — เอาออกแล้ว (เริ่มต้นต้องว่างเปล่า ให้ผู้ใช้กรอกเอง) */
  if (typeof s.adminPass !== "string") s.adminPass = "";
  /* งานที่ผู้ใช้กด "ปิดการแจ้งเตือน" แล้ว (id งาน -> true) — ใช้ในระบบแจ้งเตือนกระดิ่ง */
  s.notifDismissed = s.notifDismissed || {};
  /* ประวัติการขายสินค้า (ใบเสร็จรับเงิน) */
  s.sales = s.sales || [];
  /* ระบบน้ำรายแปลง: แหล่งน้ำ / ระบบต่อแปลง / บันทึกการให้น้ำ */
  if (!s.water || typeof s.water !== "object") s.water = { sources: [], systems: [], logs: [] };
  if (!Array.isArray(s.water.sources)) s.water.sources = [];
  if (!Array.isArray(s.water.systems)) s.water.systems = [];
  if (!Array.isArray(s.water.logs)) s.water.logs = [];
  s.texts = s.texts || {};
  if (!Array.isArray(s.homeOrder) || s.homeOrder.length !== 4) s.homeOrder = ["cal", "tasks", "profit", "activity"];
  s.customMenus = s.customMenus || [];
  /* หมวดต้นทุนที่ผู้ใช้เพิ่มเอง (จากหน้า ตั้งค่า) */
  s.customCostCats = (s.customCostCats || []).filter(c => c && c.key && c.label).map(c => ({
    key: c.key, label: c.label, color: c.color || "#64748b"
  }));
  /* ฟิลด์สต็อกใช้งานแล้ว (openQty) — ของที่เบิกมาเปิดใช้แล้วยังไม่หมด */
  (s.stock || []).forEach(x => {
    if (typeof x.openQty !== "number" || isNaN(x.openQty)) x.openQty = 0;
    /* ปัดเลขทศนิยมลอยที่สะสมจากข้อมูลเก่า (เช่น 0.020000000000000018) ให้เป็นเลขกลม 4 ตำแหน่ง */
    x.qty = rndQty(x.qty);
    x.openQty = rndQty(x.openQty);
    if (typeof x.category !== "string") x.category = "";
    if (typeof x.size !== "string") x.size = "";
    if (typeof x.generic !== "string") x.generic = "";
    if (typeof x.supplier !== "string") x.supplier = "";
    if (typeof x.photo !== "string") x.photo = "";
    /* รูปหลายใบ: ข้อมูลเก่ามี photo (รูปเดียว) -> ย้ายเข้ารายการ photos */
    if (!Array.isArray(x.photos)) x.photos = x.photo ? [x.photo] : [];
    x.photo = x.photos[0] || "";
  });
  /* หมวดต้นทุนที่ไม่มีในระบบแล้ว (เช่น น้ำมัน/เชื้อเพลิง หรือหมวดที่ถูกลบ) — โยนไป "อื่นๆ" */
  const cmap = costCatMap(s);
  (s.tasks || []).forEach(t => {
    if (t.costCat && !cmap[t.costCat]) t.costCat = "other";
    (t.costItems || []).forEach(ci => {
      if (ci.category && !cmap[ci.category]) ci.category = "other";
    });
  });
  /* เติมรหัสสินค้า (code) ให้สต็อกที่ยังไม่มี — แมปตามชื่อจากตารางรหัสที่ตั้งค่าไว้ */
  (s.stock || []).forEach(x => {
    if (typeof x.code !== "string") x.code = "";
    if (!x.code && x.name && STOCK_CODE_MAP[x.name]) x.code = STOCK_CODE_MAP[x.name];
  });
  /* เลขรอบ (round) ของรอบการปลูก — รอบเก่าที่ยังไม่มีเลข ให้เรียงตามวันเริ่มต้น (รอบ 1, 2, 3... ต่อแปลง) */
  (s.cycles || []).forEach(c => { if (typeof c.round !== "number") c.round = 0; });
  const plotCyclesMap = {};
  [...(s.cycles || [])].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))).forEach(c => {
    const k = c.plotId;
    if (!plotCyclesMap[k]) plotCyclesMap[k] = 0;
    if (!c.round) c.round = ++plotCyclesMap[k];
  });
}
/* ---------- ตรวจสอบพื้นที่เก็บข้อมูล (localStorage) ----------
   localStorage มีโควตา ~5MB — เดิมถ้าพื้นที่เต็ม saveState กลืน error เงียบๆ ข้อมูลใหม่หายโดยไม่รู้ตัว
   ตอนนี้: นับขนาดที่ใช้ + เตือนก่อนเต็ม + แจ้งทันทีเมื่อบันทึกไม่สำเร็จ (โชว์ในหน้าตั้งค่าด้วย) */
const STORAGE_LIMIT = 5 * 1024 * 1024; // ~5MB (โควตาทั่วไปของเบราว์เซอร์)
let storageSaveFailed = false;          // save ครั้งล่าสุดพัง (พื้นที่เต็ม)
function storageUsageBytes() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) || "";
      total += (k.length + v.length) * 2; // UTF-16 → 2 ไบต์/ตัวอักษร
    }
  } catch (e) {}
  return total;
}
function storageHealthInfo() {
  const used = storageUsageBytes();
  return { used, pct: Math.min(100, Math.round(used / STORAGE_LIMIT * 100)) };
}
function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    storageSaveFailed = false;
  } catch (e) {
    /* พื้นที่เต็ม/ถูกบล็อก — ต้องเตือนผู้ใช้ ไม่ใช่เงียบๆ ปล่อยข้อมูลหาย */
    storageSaveFailed = true;
    setTimeout(function () {
      try { toast("⚠️ พื้นที่จัดเก็บเต็ม! ข้อมูลล่าสุดอาจไม่ถูกบันทึก — ไปที่ ตั้งค่า เพื่อสำรอง/จัดการพื้นที่"); } catch (e2) {}
    }, 0);
  }
}

/* รหัสสินค้าจะมาจากไฟล์ import หรือ Lark sync ของแต่ละบัญชี */
const STOCK_CODE_MAP = {};

/* ---------- derived helpers ---------- */
function plotById(s, id) { return s.plots.find(p => p.id === id); }
function cycleById(s, id) { return s.cycles.find(c => c.id === id); }
/* เลขรอบถัดไปของแปลงนี้ = จำนวนรอบทั้งหมดของแปลง + 1 (เพิ่มรอบอัตโนมัติ: รอบ 1, รอบ 2, รอบ 3...) */
function nextCycleRound(s, plotId) {
  return (s.cycles || []).filter(c => c.plotId === plotId).length + 1;
}
/* ชื่อพืชของแปลง — แปลงใหม่ไม่เก็บพืชแล้ว ใช้ชื่อพืชจากรอบที่เริ่มล่าสุด (fallback ชื่อพืชเก่า) */
function plotCropName(s, p) {
  if (!p) return "";
  if (p.crop) return p.crop;
  const cs = (s.cycles || []).filter(c => c.plotId === p.id);
  if (!cs.length) return "";
  return [...cs].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0].plant || "";
}
function stockById(s, id) { return s.stock.find(x => x.id === id); }
/* รูปสินค้า: data URL / URL ใช้ตรงๆ, ชื่อไฟล์ -> โฟลเดอร์ images/products/ (วางรูปตามชื่อไฟล์จาก Excel ได้) */
function stockPhotoSrc(x) {
  const p = (x && x.photo) || "";
  if (!p) return "";
  if (p.startsWith("data:") || p.startsWith("http://") || p.startsWith("https://")) return p;
  return "images/products/" + p;
}
/* รายการรูปทั้งหมดของสินค้า (รองรับหลายใบ) */
function stockPhotos(x) {
  if (x && Array.isArray(x.photos) && x.photos.length) return x.photos;
  return x && x.photo ? [x.photo] : [];
}
function firstStockPhoto(x) { const p = stockPhotos(x); return p.length ? p[0] : ""; }

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
/* กำไรสุทธิของปี (YTD) — คำนวณจากงานจริง (year เป็น CE เช่น 2026; ไม่ระบุ = ปีปัจจุบัน) */
function ytdFinance(s, year) {
  const yr = String(year || todayISO().slice(0, 4));
  const fin = taskFinance(s, t => t.date.startsWith(yr));
  return { ...fin, margin: fin.revenue > 0 ? ((fin.revenue - fin.cost) / fin.revenue) * 100 : 0 };
}
/* ปีทั้งหมดที่มีข้อมูล (งาน + ขาย) + ปีปัจจุบัน — ใช้สร้างตัวเลือกปีในหน้าการวิเคราะห์ */
function analyticsYears(s) {
  const set = new Set([Number(todayISO().slice(0, 4))]);
  (s.tasks || []).forEach(t => { if (t.date && String(t.date).length >= 4) set.add(Number(String(t.date).slice(0, 4))); });
  (s.sales || []).forEach(x => { if (x.date && String(x.date).length >= 4) set.add(Number(String(x.date).slice(0, 4))); });
  return [...set].sort((a, b) => a - b);
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
/* ชื่อพืชหลัก — ตัดเลขรอบ/รุ่นออกจากชื่อ เช่น "ข้าวโพดหวาน รุ่น 1/66" -> "ข้าวโพดหวาน"
   ใช้จัดกลุ่มกำไรตามพืชให้รวมรอบเดียวกันเป็นกลุ่มเดียว */
function cropBaseName(plant) {
  return String(plant || "")
    .replace(/รุ่น\s*\d+(\/\d+)?/g, "")   // รุ่น 1/66, รุ่น 2
    .replace(/รอบ\s*\d+(\/\d+)?/g, "")    // รอบ 1/66, รอบ 3
    .replace(/ครั้ง(ที่)?\s*\d+/g, "")      // ครั้งที่ 1
    .replace(/\d+\/\d+/g, "")             // 1/66
    .replace(/\s+/g, " ")
    .trim();
}
/* กำไร/ขาดทุนตามชนิดพืช — กลุ่มจากรอบการปลูกของแปลง (แปลงใหม่ไม่เก็บพืชแล้ว พืชอยู่ที่รอบ)
   ใช้ชื่อพืชของรอบที่งานผูกอยู่ (fallback ชื่อพืชเก่าของแปลงสำหรับข้อมูลเดิม; year ไม่ระบุ = ทุกปี)
   กลุ่มตามชื่อพืชหลัก (ไม่แยกตามเลขรอบ) */
function cropMargins(s, year) {
  const map = {};
  const yr = year ? String(year) : "";
  doneTasks(s).forEach(t => {
    if (yr && !t.date.startsWith(yr)) return;
    if (!t.plotId) return;
    const p = plotById(s, t.plotId);
    if (!p) return;
    /* ชื่อพืช: จากรอบที่งานผูกอยู่ก่อน ถ้าไม่มีรอบใช้ชื่อพืชเก่าของแปลง */
    let crop = "";
    if (t.cycleId) {
      const c = cycleById(s, t.cycleId);
      if (c) crop = c.plant;
    }
    if (!crop) crop = p.crop || "";
    if (!crop) return;
    const base = cropBaseName(crop);
    const key = base || crop;
    if (!map[key]) map[key] = { crop: base || crop, revenue: 0, cost: 0 };
    map[key].revenue += t.revenue || 0;
    map[key].cost += t.cost || 0;
  });
  return Object.values(map)
    .filter(c => c.revenue > 0 || c.cost > 0) // ข้ามชนิดที่ยังไม่มีการทำกิจกรรม
    .map(c => ({
      ...c,
      margin: c.revenue > 0 ? Math.round(((c.revenue - c.cost) / c.revenue) * 100) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
/* ต้นทุนเชิงลึก — กลุ่มตามหมวดต้นทุนของงาน (รวมหมวดที่ผู้ใช้เพิ่มเอง; year ไม่ระบุ = ทุกปี) */
function costBreakdown(s, year) {
  const map = {};
  const cmap = costCatMap(s);
  const yr = year ? String(year) : "";
  doneTasks(s).forEach(t => {
    if (!t.cost) return;
    if (yr && !t.date.startsWith(yr)) return;
    const key = t.costCat && cmap[t.costCat] ? t.costCat : "other";
    if (!map[key]) map[key] = { label: cmap[key].label, value: 0, color: cmap[key].color };
    map[key].value += t.cost;
  });
  return Object.values(map).sort((a, b) => b.value - a.value);
}
/* กำไร/ขาดทุนรายแปลง (ปีนี้) — แยกแต่ละแปลง เรียงจากกำไรมากสุด → ขาดทุนมากสุด
   ใช้เฉพาะงานที่ทำเสร็จแล้วในปีที่ระบุ (เหมือน ytdFinance) */
function plotYearProfits(s, year) {
  const rows = [];
  s.plots.forEach(p => {
    const fin = taskFinance(s, t => t.plotId === p.id && t.date.startsWith(year));
    if (fin.revenue === 0 && fin.cost === 0) return; // ข้ามแปลงที่ยังไม่มีกิจกรรมปีนี้
    rows.push({
      plotId: p.id,
      name: p.name,
      crop: plotCropName(s, p),
      revenue: fin.revenue,
      cost: fin.cost,
      net: fin.net,
      margin: fin.revenue > 0 ? (fin.net / fin.revenue) * 100 : 0
    });
  });
  rows.sort((a, b) => b.net - a.net);
  return rows;
}
/* การใช้ยา/สารเคมีรายแปลง (ปีนี้) — ต้นทุนค่าเคมี + รายการยาที่ใช้
   นับจากงานที่ทำเสร็จแล้วซึ่งมีหมวด chemical (ระดับงานหรือระดับรายการย่อย costItems)
   เรียงจากแปลงที่ใช้ยามากสุด (ตามต้นทุน) */
function plotChemUse(s, year) {
  const map = {};
  doneTasks(s).forEach(t => {
    if (!t.plotId || !t.date.startsWith(year)) return;
    const items = (t.costItems || []).filter(ci => ci.category === "chemical");
    const isChem = t.costCat === "chemical" || items.length > 0;
    if (!isChem) return;
    if (!map[t.plotId]) map[t.plotId] = { plotId: t.plotId, cost: 0, items: {} };
    const row = map[t.plotId];
    if (items.length) {
      /* มีรายการย่อย: นับเฉพาะรายการที่เป็น chemical (ต้นทุน + จำนวน) */
      items.forEach(ci => {
        row.cost += Number(ci.totalCost) || 0;
        const nm = ci.name || (ci.stockId ? (stockById(s, ci.stockId) || {}).name : "") || "อื่นๆ";
        row.items[nm] = (row.items[nm] || 0) + (Number(ci.qty) || 0);
      });
    } else {
      /* งานเดียวแบบเก่า: ใช้ t.cost + t.stockId/t.qty */
      row.cost += Number(t.cost) || 0;
      if (t.stockId) {
        const st = stockById(s, t.stockId);
        const nm = (st && st.name) || "อื่นๆ";
        row.items[nm] = (row.items[nm] || 0) + (Number(t.qty) || 0);
      }
    }
  });
  return Object.values(map).map(r => ({
    plotId: r.plotId,
    name: (plotById(s, r.plotId) || {}).name || "—",
    crop: plotCropName(s, plotById(s, r.plotId)),
    cost: r.cost,
    items: Object.entries(r.items).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, qty]) => ({ name: nm, qty }))
  })).sort((a, b) => b.cost - a.cost);
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
          let need = rndQty(ci.qty);
          item.openQty = rndQty(item.openQty);
          const beforeMain = item.qty, beforeOpen = item.openQty;
          // 1) ใช้ของที่เปิดใช้แล้วก่อน
          const fromOpen = Math.min(item.openQty, need);
          item.openQty = rndQty(item.openQty - fromOpen);
          need = rndQty(need - fromOpen);
          // 2) เบิกจากสต็อกหลักเป็นหน่วยเต็ม (ปัดขึ้น)
          let openAdded = 0;
          if (need > 0) {
            const withdraw = Math.ceil(need);
            item.qty = Math.max(0, item.qty - withdraw);
            // เศษที่เบิกเกิน (เช่น 4-3.5=0.5) เก็บเป็นของที่เปิดใช้แล้ว
            openAdded = rndQty(Math.max(0, withdraw - need));
            item.openQty = rndQty(item.openQty + openAdded);
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
  /* งานถูกแก้สถานะ → ให้กลับมาแสดงการแจ้งเตือนใหม่ (ถ้ายังไม่เสร็จ/ยังไม่พ้นกำหนด) */
  if (s.notifDismissed) delete s.notifDismissed[taskId];
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
/* ---------- การขายสินค้า (ใบเสร็จรับเงิน) ----------
   กฎการขาย: ขายจากสต็อกหลัก (หน่วยเต็ม) เท่านั้น — ไม่ยุ่งกับของที่เปิดใช้แล้ว (openQty) */
/* สร้างรายการขายจากข้อมูลฟอร์ม — บังคับจำนวนเต็ม */
function buildSaleItems(s, data) {
  const items = (data.items || [])
    .filter(it => it.stockId && (Number(it.qty) || 0) > 0)
    .map(it => {
      const qty = Math.floor(Number(it.qty) || 0); // ขายจำนวนเต็มเท่านั้น
      const price = Number(it.price) || 0;
      const x = stockById(s, it.stockId);
      return {
        stockId: it.stockId,
        code: x ? (x.code || x.id) : "", // รหัสสินค้าเดิม ถ้าไม่มีใช้ id สต็อก — แสดงในใบส่งสินค้า
        name: String(it.name || ""),
        unit: String(it.unit || "ชิ้น"),
        qty,
        price,
        total: Math.round(qty * price),
        fromOpen: 0,   // ขายไม่แตะของที่เปิดใช้แล้ว
        fromMain: qty  // เบิกจากหลักทั้งหมด
      };
    });
  return items;
}
/* ตัดสต็อกหลักเป็นหน่วยเต็ม (ไม่ใช้ของที่เปิดใช้แล้ว) */
function deductSaleItems(s, items) {
  items.forEach(it => {
    const x = stockById(s, it.stockId);
    if (!x) return;
    x.qty = Math.max(0, (Number(x.qty) || 0) - Math.floor(Number(it.qty) || 0));
  });
}
/* คืนสต็อกหลักตามที่ขายไป (ใช้ตอนยกเลิก/แก้ไขใบเสร็จ) */
function restockSaleItems(s, items) {
  items.forEach(it => {
    const x = stockById(s, it.stockId);
    if (!x) return;
    x.qty = (Number(x.qty) || 0) + (Number(it.fromMain) || 0);
  });
}
/* บันทึกการขายใหม่ + ตัดสต็อก */
function addSale(s, data) {
  const items = buildSaleItems(s, data);
  const sale = {
    id: uid(),
    no: (s.sales || []).length + 1, // เลขที่ใบเสร็จ (เรียงตามลำดับ)
    date: data.date || todayISO(),
    customer: String(data.customer || "").trim(),
    items,
    discount: Math.round(Number(data.discount) || 0), // ส่วนลด (บาท)
    note: String(data.note || "").trim(),
    payMethod: data.payMethod === "transfer" ? "transfer" : "cash",
    account: String(data.account || "").trim(),
    createdAt: Date.now()
  };
  deductSaleItems(s, items);
  s.sales = s.sales || [];
  s.sales.push(sale);
  return sale;
}
/* แก้ไขใบเสร็จที่มีอยู่ — คืนสต็อกเดิม แล้วตัดใหม่ตามรายการที่แก้ */
function updateSale(s, saleId, data) {
  const sale = (s.sales || []).find(x => x.id === saleId);
  if (!sale) return false;
  /* 1) คืนสต็อกของรายการเดิม */
  restockSaleItems(s, sale.items);
  /* 2) สร้างรายการใหม่ + ตัดสต็อกใหม่ */
  const items = buildSaleItems(s, data);
  deductSaleItems(s, items);
  /* 3) อัปเดตใบเสร็จ (คงเลขที่เดิม) */
  sale.date = data.date || sale.date;
  sale.customer = String(data.customer || "").trim();
  sale.items = items;
  sale.discount = Math.round(Number(data.discount) || 0);
  sale.note = String(data.note || "").trim();
  sale.payMethod = data.payMethod === "transfer" ? "transfer" : "cash";
  sale.account = String(data.account || "").trim();
  sale.createdAt = Date.now();
  return sale;
}
/* ยอดรวมของใบเสร็จ (ก่อนหักส่วนลด) */
function saleTotal(sale) {
  return (sale.items || []).reduce((a, it) => a + (Number(it.total) || 0), 0);
}
/* ยอดสุทธิหลังหักส่วนลด (จำนวนเงินทั้งสิ้น) */
function saleGrandTotal(sale) {
  return Math.max(0, saleTotal(sale) - (Number(sale.discount) || 0));
}
/* ต้นทุนของสินค้าที่ขายในใบนี้ (ใช้คำนวณกำไร) */
function saleCost(sale, s) {
  return (sale.items || []).reduce((a, it) => {
    const x = stockById(s, it.stockId);
    return a + (Number(it.qty) || 0) * (x ? x.avgCost : 0);
  }, 0);
}
/* ยกเลิกใบเสร็จ — คืนสต็อกที่ขายไปแล้วลบใบออก */
function voidSale(s, saleId) {
  const sale = (s.sales || []).find(x => x.id === saleId);
  if (!sale) return false;
  restockSaleItems(s, sale.items);
  s.sales = (s.sales || []).filter(x => x.id !== saleId);
  return true;
}
/* รายรับจากการขายสินค้าของปี (year ไม่ระบุ = ปีปัจจุบัน) — แยกจากรายรับงานแปลง */
function salesRevenue(s, year) {
  const yr = String(year || todayISO().slice(0, 4));
  return (s.sales || []).filter(x => (x.date || "").startsWith(yr)).reduce((a, x) => a + saleGrandTotal(x), 0);
}
/* ยอดขายวันนี้ (ใบเสร็จที่ออกวันนี้) */
function salesToday(s) {
  const d = todayISO();
  return (s.sales || []).filter(x => x.date === d).reduce((a, x) => a + saleGrandTotal(x), 0);
}
/* ยอดขายเดือนนี้ */
function salesMonth(s) {
  const ym = todayISO().slice(0, 7);
  return (s.sales || []).filter(x => (x.date || "").startsWith(ym)).reduce((a, x) => a + saleGrandTotal(x), 0);
}
/* จำนวนใบเสร็จของปี (year ไม่ระบุ = ปีปัจจุบัน) */
function salesYearCount(s, year) {
  const yr = String(year || todayISO().slice(0, 4));
  return (s.sales || []).filter(x => (x.date || "").startsWith(yr)).length;
}
/* ต้นทุนขายของปี (COGS — ราคาทุนของสินค้าที่ขายไป; year ไม่ระบุ = ปีปัจจุบัน) */
function salesCostYTD(s, year) {
  const yr = String(year || todayISO().slice(0, 4));
  return (s.sales || []).filter(x => (x.date || "").startsWith(yr)).reduce((a, x) => a + saleCost(x, s), 0);
}
/* กำไรร้านของปี = ยอดขาย − ต้นทุนขาย (แยกจากกำไรแปลง; year ไม่ระบุ = ปีปัจจุบัน) */
function salesProfitYTD(s, year) {
  return salesRevenue(s, year) - salesCostYTD(s, year);
}
/* มูลค่าสต็อกคงเหลือ (เงินที่จมอยู่ในของคงคลัง) — แยกสต็อกหลัก / ของเหลือเปิดใช้ */
function stockValue(s) {
  let main = 0, open = 0;
  (s.stock || []).forEach(x => {
    const c = Number(x.avgCost) || 0;
    main += (Number(x.qty) || 0) * c;
    open += (Number(x.openQty) || 0) * c;
  });
  return { main, open, total: main + open };
}
/* ยอดขายรายเดือนทั้ง 12 เดือนของปี (บาทสุทธิหลังหักส่วนลด) */
function salesMonthlySeries(s, year) {
  const arr = [];
  for (let m = 0; m < 12; m++) {
    const prefix = year + "-" + String(m + 1).padStart(2, "0");
    const total = (s.sales || []).filter(x => (x.date || "").startsWith(prefix)).reduce((a, x) => a + saleGrandTotal(x), 0);
    arr.push({ label: THAI_MONTHS_SHORT[m], value: total });
  }
  return arr;
}
/* สินค้าขายดีปีนี้ — รวมจำนวน/ยอดตามชื่อสินค้า เรียงตามยอดมากสุด */
function topSaleItems(s, year, n) {
  const map = {};
  (s.sales || []).forEach(sl => {
    if (!(sl.date || "").startsWith(year)) return;
    (sl.items || []).forEach(it => {
      const key = String(it.name || "").trim() || "ไม่ระบุ";
      if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0 };
      map[key].qty += Number(it.qty) || 0;
      map[key].revenue += Number(it.total) || 0;
    });
  });
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, n || 5);
}
/* ลูกค้าที่ซื้อเยอะที่สุดปีนี้ (ยอดรวม/จำนวนครั้ง) */
function topCustomers(s, year, n) {
  const map = {};
  (s.sales || []).forEach(sl => {
    if (!(sl.date || "").startsWith(year)) return;
    const name = String(sl.customer || "").trim();
    if (!name) return;
    if (!map[name]) map[name] = { name, total: 0, count: 0 };
    map[name].total += saleGrandTotal(sl);
    map[name].count++;
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, n || 5);
}
/* รายชื่อลูกค้าทั้งหมด (จากใบเสร็จ) — พร้อมยอดซื้อรวม/จำนวนครั้ง/ครั้งล่าสุด */
function customerList(s) {
  const map = {};
  (s.sales || []).forEach(sl => {
    const name = String(sl.customer || "").trim();
    if (!name) return;
    if (!map[name]) map[name] = { name, count: 0, total: 0, last: 0, lastDate: "" };
    map[name].count++;
    map[name].total += saleGrandTotal(sl);
    if ((sl.createdAt || 0) > map[name].last) { map[name].last = sl.createdAt || 0; map[name].lastDate = sl.date || ""; }
  });
  return Object.values(map).sort((a, b) => b.last - a.last);
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
    item.openQty = rndQty(Math.max(0, item.openQty - (log.openAdded || 0) + (log.openUsed || 0)));
  });
  t.stockLog = [];
}

/* Task status per date: done / planned / overdue */
function taskStatusOf(t) {
  if (t.status === "done") return "done";
  if (t.date < todayISO()) return "overdue";
  return "planned";
}
/* รายการแจ้งเตือน: งานที่ครบกำหนดวันนี้ + งานที่เลยกำหนด (ยังไม่เสร็จ, ยังไม่กดปิด)
   เรียง: เลยกำหนด ตามวันที่เก่าสุดก่อน / วันนี้ ตามเวลาที่เพิ่มล่าสุดก่อน */
function notifList(s) {
  const today = todayISO();
  const dis = s.notifDismissed || {};
  const overdue = [], dueToday = [];
  (s.tasks || []).forEach(t => {
    if (t.status === "done" || dis[t.id]) return;
    if (t.date < today) overdue.push(t);
    else if (t.date === today) dueToday.push(t);
  });
  overdue.sort((a, b) => a.date.localeCompare(b.date));
  dueToday.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return { overdue, dueToday };
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


/* สถานะหลักของแอป — ประกาศท้าย data.js (โหลดก่อน auth.js/app.js)
   เพื่อให้ระบบบัญชีสลับ slot ข้อมูลรายบัญชีได้ก่อน render หน้าแรก */
const S = loadState();
