/* ============================================================
   FARMULTIMATE SOLUTIONS v52 — data layer
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
/* นำเข้าสินค้า (Item Master) — เพิ่มรายการที่ไม่ซ้ำ (ชื่อ+ขนาด+หน่วย+บริษัท) กลับจำนวนที่เพิ่ม/ข้าม */
function mergeStockProducts(s, products) {
  let added = 0, skipped = 0;
  const existing = new Set((s.stock || []).map(x =>
    (x.name || "").trim().toLowerCase() + "|" + (x.size || "") + "|" + (x.unit || "") + "|" + (x.supplier || "")));
  (products || []).forEach(p => {
    const name = String(p.name || p.productName || "").trim();
    if (!name) return;
    const size = String(p.size || "").trim();
    const unit = String(p.unit || "").trim() || "ชิ้น";
    const supplier = String(p.supplier || p.company || "").trim();
    const key = name.toLowerCase() + "|" + size + "|" + unit + "|" + supplier;
    if (existing.has(key)) { skipped++; return; }
    existing.add(key);
    s.stock.push({
      id: uid(), name,
      code: String(p.code || "").trim(), // รหัสสินค้าเดิม (จากไฟล์ Excel)
      generic: String(p.generic || p.genericName || "").trim(),
      category: String(p.category || "").trim(),
      size, unit, supplier,
      photo: String(p.photo || p.photoName || "").trim(),
      qty: Number(p.qty) || 0,
      openQty: 0,
      avgCost: Number(p.avgCost) || 0,
      salePrice: Number(p.salePrice) || 0 // ราคาขายต่อหน่วย (จากไฟล์ Excel / แก้ไขเอง)
    });
    added++;
  });
  return { added, skipped };
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

/* รายการสินค้า FLYTECH (Item Master) — ใช้แทนที่สต็อกตัวอย่างครั้งเดียว + เป็นตัวตั้งต้นสำหรับหน้า สต็อก */
const FLYTECH_MASTER = [
  {"name":"ฟราสโล-เอ็นพีเค","generic":"13-5-4","category":"ปุ๋ยเคมี","unit":"ขวด","size":"1 ลิตร","supplier":"บาก้า จำกัด","photo":"Luban_178124668314631486d8b-0d66-4f56-bff5-556685c032d6.jpeg"},
  {"name":"ดาซาโฟล","generic":"2,4-ดี-โซเดียม+ไดยูรอน+ดีเอสเอ็มเอ","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บาก้า จำกัด","photo":"photo_1781246799736.JPEG"},
  {"name":"Q-TECH","generic":"","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"วินเนอร์ อะโกรอีควิปเม้นท์","photo":"photo_1781246882547.JPEG"},
  {"name":"เทกิโม","generic":"สารเพิ่มประสิทธิภาพพืช - กรดอะมิโนสําหรับพืช","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท บีเอเอสเอฟ (ไทย) จํากัด","photo":"Luban_1781247034356239f6635-446c-421e-a17b-9883461c3b5d.jpeg"},
  {"name":"คอโฟลิรูท","generic":"","category":"ปุ๋ยเคมี","unit":"ขวด","size":"1 ลิตร","supplier":"วิกเตอร์ นูตริพลานท์","photo":"photo_1781247396508.JPEG"},
  {"name":"แชปเตอร์","generic":"21-5-5","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บาก้า จำกัด","photo":"Luban_1781247529436e5ff4d74-56d1-4d67-a408-5fff02b0de9a.jpeg"},
  {"name":"อิเควชั่น","generic":"ไซมอกซานิล+ฟามอกซาโดน","category":"ยากำจัดโรคพืช","unit":"ซอง","size":"100 กรัม","supplier":"คอร์เทวา อะกริไซเอนซ์","photo":"photo_1781247790511.JPEG"},
  {"name":"บีเคแรงเจอร์","generic":"เพนดิเมทาลิน(pendimethalin)","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท บี เค อะโกร จำกัด","photo":"Luban_1781247916440c27d0856-c2bd-4d2c-9b8d-e304db8c5ef9.jpeg"},
  {"name":"โกลลีเอท","generic":"กรดฟอสโฟนิก","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"โกลบอล ครอปส์","photo":"photo_1781247809352.JPEG"},
  {"name":"ฟิลลัม","generic":"-","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บาก้า จำกัด","photo":"Luban_178124831529524ff76c9-71e1-4650-a9c4-e2eb4ea97e9c.jpeg"},
  {"name":"ไกลโฟเซต48","generic":"ไกลโฟเซต-โอโซโพรพิลแอมโมเนียม","category":"ยากำจัดวัชพืช","unit":"แกลลอน","size":"4 ลิตร","supplier":"โกลบอล ครอปส์","photo":"photo_1781248422316.JPEG"},
  {"name":"โนว่า","generic":"-","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท เอเลฟองเต้ อโกรเคมิคอล จํากัด","photo":"Luban_1781248618559fc14eb8c-36be-4400-8de3-0cff9a0a1ae4.jpeg"},
  {"name":"วิกโต้","generic":"ไทอะโคลพริด","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"100 กรัม","supplier":"เทพวัฒนา จำกัด","photo":"photo_1781248547479.JPEG"},
  {"name":"วีเซ่","generic":"อีไตรไดอะโซล","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 ซีซี","supplier":"เทพวัฒนา จำกัด","photo":"photo_1781248758974.JPEG"},
  {"name":"วีเซ่","generic":"อีไตรไดอะโซล","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"แพลนเตอร์ ยูไนเต็ด จำกัด","photo":"photo_1781249010762.JPEG"},
  {"name":"วิกเตอร์สเปรย์","generic":"-","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"100มิลลิลิตร","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"Luban_1781249209167f3e248a8-6565-42b5-9aa7-e5eb3a0e4829.jpeg"},
  {"name":"ปุ๋ยเกล็ดมรกต 13-4-46","generic":"โพแทสเซียมไนเตรท","category":"อาหารเสริม","unit":"ถุง","size":"1 กิโลกรัม","supplier":"ปุ๋ยไวกิ้ง จำกัด","photo":"photo_1781249283197.JPEG"},
  {"name":"มิสต้า","generic":"อะซอกซีสโตรบิน (azoxystrobin)","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 ซีซี","supplier":"โกลบอล ครอปส์","photo":"Luban_17812494282587aa35b5a-515b-442b-bf70-05fecb3dbb51.jpeg"},
  {"name":"เอนซิกา","generic":"ไดฟีโนโคนาโซล(difinoconazole) +อะซอกซีสโตรบิน (azoxystrobin)","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 ซีซี","supplier":"บริษัท โกรว์ เคมีคอล จำกัด","photo":"Luban_17812499009894eae7c1a-5301-472c-adc5-23381b5f51c1.jpeg"},
  {"name":"แอ็คบิว","generic":"บิวทาคลอร์","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"photo_1781249832426.JPEG"},
  {"name":"ไทแบค","generic":"ซิงค์ไทอะโซล(zinc thiazole)","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท ป.เคมีเทค จํากัด","photo":"Luban_17812502229892148233d-0a25-4e12-bc90-84e82b972a8d.jpeg"},
  {"name":"ไกลโฟเซต 48","generic":"ตไกลโฟเซต-ไอโซโพรพิลแอมโมเนียม (glyphosate-isopropylammonium)","category":"ยากำจัดวัชพืช","unit":"แกลลอน","size":"4 ลิตร","supplier":"บริษัท ฟอร์มูล่าร์-เอ จำกัด","photo":"Luban_1781250554048600c610f-4c3c-4664-bc2e-a95ee6bf1973.jpeg"},
  {"name":"กลูโฟสลีป","generic":"กลูโฟซิเนต-แอมโมเนียม (glufosinate-ammonium)","category":"ยากำจัดวัชพืช","unit":"แกลลอน","size":"4 ลิตร","supplier":"บริษัท ทีเอชซี อะโกรไซแอนส์ จํากัด","photo":"Luban_1781250852237506ab47f-438a-43fe-83a5-f068f2a5e747.jpeg"},
  {"name":"ผักกาดเขียวปลี","generic":"หยกเพชร","category":"เมล็ดพันธุ์","unit":"ถุง","size":"500 กรัม","supplier":"บจก เอกะ ฮอร์ติโปร","photo":"photo_1781250053062.JPEG"},
  {"name":"เม็กซิโอ้","generic":"อะทราซีน(atrazine)","category":"ยากำจัดวัชพืช","unit":"ถุง","size":"900กรัม","supplier":"บริษัท ไซโนเคม ฟาร์ม แคร์ (ประเทศไทย) จํากัด","photo":"Luban_17812513376206216b7e3-44db-4024-926f-6ade5f491f1e.jpeg"},
  {"name":"คะน้ายอดไต้หวัน (บางบัวทอง35)","generic":"ศรแดง","category":"เมล็ดพันธุ์","unit":"ถุง","size":"1 กิโลกรัม","supplier":"บริษัท อีสท์ เวสท์ ซีด จำกัด","photo":"photo_1781251388513.JPEG"},
  {"name":"นูทริแพค 60เค","generic":"0-0-60","category":"ปุ๋ยเคมี","unit":"ถุง","size":"1 กิโลกรัม","supplier":"บริษัท เอ็ม จี ที แพลนท์โกรท จํากัด","photo":"Luban_1781251787220cea999fe-f1f3-41bc-a90f-2ae96f9ebb86.jpeg"},
  {"name":"อินล็อค","generic":"อินดอกซาคาร์บ","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"โกลบอล ครอปส์","photo":"photo_1781252062474.JPEG"},
  {"name":"สกอร์","generic":"โดฟีโนโคนาโซล (difenoconazole","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_1781252048618fb2360d3-8cd9-4a9a-bba9-68dad1c7bc8b.jpeg"},
  {"name":"ไดออฟ","generic":"โดเมโทมอร์ฟ (dimethomorph)","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_1781252270046ee8311d8-d194-43c8-891b-e6a6fb66e0d3.jpeg"},
  {"name":"แอมเมท","generic":"อินดอกซาคาร์บ","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"บริษัท เอฟเอ็มซี เอจี (ประเทศไทย) จำกัด","photo":"photo_1781252157745.JPEG"},
  {"name":"อฟินโต","generic":"คลอโรทาโลมินิล (chlorothalonil) + เมทาแลกซิล-เอ็ม (metalaxyl-M)","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_17812524562436cd3cc82-32e9-4de5-805c-3297f46b1bc3.jpeg"},
  {"name":"คาซู่","generic":"คาซูกาไมซิน ไฮโดรคลอไรด์ ไฮเดรต","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ฮอกโกะ เคมีคอล อินดัสตรี จำกัด","photo":"photo_1781252457143.JPEG"},
  {"name":"โดรนแมทซ์","generic":"ลูเฟนนูรอน (lufenuron)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"photo_1781324814020.JPEG,photo_1781324806439.JPEG,Luban_178125276578021a51294-5a89-48d7-b9df-21fd9aa4c135.jpeg"},
  {"name":"เฟอร์ร่า","generic":"ไดเมโทมอร์ฟ","category":"ยากำจัดโรคพืช","unit":"กล่อง","size":"1 กิโลกรัม","supplier":"โกลบอล ครอปส์","photo":"photo_1781252769148.JPEG"},
  {"name":"ซานติส","generic":"อะชีทามิพริด(acetamipnd)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"แพลนเตอร์ ยูไนเต็ด จำกัด","photo":"Luban_1781253173796e1f31dd4-3f37-4296-8c33-2a973c7e06ee.jpeg"},
  {"name":"มิสเตอร์จั๊ม","generic":"ไดโนทีฟูแรน","category":"ยากำจัดศัตรูพืช","unit":"กล่อง","size":"100 กรัม","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"photo_1781253070538.JPEG"},
  {"name":"คอนราด","generic":"คลอแรนทรานิลิโพรล(chlorantraniliprole)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท เทพวัฒนา จํากัด","photo":"Luban_1781253473464be792662-918b-4cd9-9ed9-86176643f3bb.jpeg"},
  {"name":"โกลวาธอน","generic":"อินดอกซาคาร์บ","category":"ยากำจัดศัตรูพืช","unit":"กระปุก","size":"100 กรัม","supplier":"โกลบอล ครอปส์","photo":"photo_1781253459100.JPEG"},
  {"name":"เอวิด","generic":"ไทอะมีทอกแซม (thiamethoxam)+&#xA;อะบาเมกติน(abamectin)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_17812537562645bb5a37a-1b52-4b93-9da1-1102a2d21a1e.jpeg"},
  {"name":"ทีทริส","generic":"โพรฟอกซิดิม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท บีเอเอสเอฟ (ไทย) จํากัด","photo":"photo_1781253757425.JPEG"},
  {"name":"เอสเคเอ็นสเปรย์","generic":"ปิโตรเลียมออยล์(petroleum oil)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โซตัส อินเตอร์เนชั่นแนล จํากัด","photo":"Luban_178125413861579d13392-3283-4b83-95de-0f767df90a99.jpeg"},
  {"name":"เบฟอแคน","generic":"คลอแรนทรานิลิโพรล","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"โกลบอล ครอปส์","photo":"photo_1781254164478.JPEG"},
  {"name":"ซูมิ-โรดี้","generic":"เฟนโพรพาทริน(fenpropathrin)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกรว์ เคมีคอล จำกัด","photo":"Luban_178125445500582c3b18f-2f02-44ee-9d84-0c5e42ab418e.jpeg"},
  {"name":"ปุ๋ยเกล็ดเรือใบ 32-12-8","generic":"32-12-8","category":"ปุ๋ยเคมี","unit":"ถุง","size":"1 กิโลกรัม","supplier":"","photo":"photo_1781254565094.JPEG"},
  {"name":"ดูปองท์ อัลทาคอร์","generic":"คลอแรนทรานิลิโพรล","category":"ยากำจัดศัตรูพืช","unit":"กล่อง","size":"50 กรัม","supplier":"เจียไต๋","photo":"photo_1781254500438.JPEG"},
  {"name":"เอเทร็ก90 ดับบลิวจี","generic":"อะทราซีน","category":"ยากำจัดวัชพืช","unit":"ถุง","size":"900กรัม","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"photo_1781254690476.JPEG"},
  {"name":"แอคทาลิค50อีซี","generic":"พิริมิฟอส-เมทิล (pirimiphos-methyl)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_178125470606656ed4f06-f80d-4887-82b2-1e0c278ba6fa.jpeg"},
  {"name":"โนราโด้","generic":"อินดอกซาคาร์บ","category":"ยากำจัดศัตรูพืช","unit":"กล่อง","size":"250มิลลิลิตร","supplier":"","photo":"photo_1781254819709.JPEG"},
  {"name":"ไคโตซาน พลัส","generic":"ไคโตซาน ไอลิโกแซคคาไรด์","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ทีเอบี อิโนเวชั่น จำกัด","photo":"photo_1781254907136.JPEG"},
  {"name":"โรนัล","generic":"กรดอะมิโน","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"แพลนเตอร์ ยูไนเต็ด จำกัด","photo":"Luban_1781254980067ec645e6e-35ce-4a1e-bb19-3d6c596ee243.jpeg"},
  {"name":"เบสมอร์","generic":"สารเพิ่มประสิทธิภาพ","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"เจียไต๋","photo":"photo_1781255023316.JPEG"},
  {"name":"เทติก","generic":"กรดฟอสโฟนิก (phosphonic acid)","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"โกลบอล ครอปส์","photo":"Luban_1781255220951a1a9f764-08b5-4bed-8c39-c454d25c2c3f.jpeg"},
  {"name":"อะแลนโต","generic":"ไทอะโคลพริด","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1000 มิลลิลิตร","supplier":"ไบเออร์ไทย จำกัด","photo":"photo_1781254945965.JPEG"},
  {"name":"เมคเซนด์ 25%","generic":"ฟิโพรนิล","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท แมสค์ ครอป ชายน์ กำจัด","photo":"photo_1781255082170.JPEG"},
  {"name":"อัลเมโท","generic":"เอส-เมโทลาคลอร์ (s-metolachlor)","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท อัลวี่ ครอป โซลชั่น จํากัด","photo":"Luban_1781255389653db57e5ff-87ee-4df2-aa2d-ed9f542cda29.jpeg"},
  {"name":"คิวเรียม","generic":"ลูเฟนนูรอน+อิมาเมกตินเบนโซเอต","category":"ยากำจัดศัตรูพืช","unit":"กระปุก","size":"50 กรัม","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"photo_1781255373714.JPEG"},
  {"name":"โฟร์แมกติน","generic":"อีมาเมกตินเบนโชเอต","category":"ยากำจัดศัตรูพืช","unit":"กระปุก","size":"100 กรัม","supplier":"บริษัท โฟซัม เคมีคอล จำกัด","photo":"photo_1781336666146.JPEG,IMG_8371.JPEG"},
  {"name":"ล็อคโกลด์","generic":"ไพมีโทรซีน","category":"ยากำจัดศัตรูพืช","unit":"ซอง","size":"100 กรัม","supplier":"โกลบอล ครอปส์","photo":"photo_1781255599217.JPEG"},
  {"name":"โปรเคลม","generic":"จีมาเมกตินเบนโซเอต(emamectin benzoate)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_1781255809817916b56ae-fad8-461d-a974-c6ae92f6d001.jpeg"},
  {"name":"เพอมิท","generic":"ฮาโลซัลฟูรอน-เมทิล","category":"ยากำจัดวัชพืช","unit":"ซอง","size":"40 กรัม","supplier":"อริสต้า ไลฟ์ซายน์","photo":"photo_1781255913838.JPEG"},
  {"name":"บี-ทีโอนิค","generic":"กรดฟลูวิค","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บาก้า จำกัด","photo":"Luban_178125667599128d3def9-8c4d-4d92-bd04-6ba38ecd5c80.jpeg"},
  {"name":"นาร์ไอร์","generic":"โพรพานิล (propanil) +มิลฟอส (anilofos)","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"Luban_178125693227157da82bc-13c5-484f-925b-c73dc2b8ff56.jpeg"},
  {"name":"เคทีโอนิค","generic":"อริสต้า","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท อริสต้า ไลฟ์ซายน์ (ประเทศไทย) จำกัด","photo":"Luban_1781257193925a8d4c8d6-9295-4385-8506-3df7c0b81c95.jpeg"},
  {"name":"เอ็มซีเซท","generic":"ธาตุอาหารเสริม","category":"ปุ๋ยเคมี","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"Luban_1781257537683d48a6d1c-36a5-4f2f-9b67-7086ba3a7639.jpeg"},
  {"name":"แซทเทลไลท์ ซีเอส","generic":"เพนดิเมทาลิน (pendimethalin)","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ยูพีแอล จำกัด ประเทศอินเดีย","photo":"Luban_1781258015238ce8cbaf7-f3de-4fed-8489-bb7248dbc60b.jpeg"},
  {"name":"เฟตริลอน เพชร","generic":"ธาตุอาหารรอง","category":"อาหารเสริม","unit":"ซอง","size":"100 กรัม","supplier":"บริษัท สหายเกษตร จำกัด","photo":"photo_1781316378138.JPEG,photo_1781316371311.JPEG"},
  {"name":"แทนเนท","generic":"อีมาเมกติน เบนโซเอต","category":"ยากำจัดศัตรูพืช","unit":"ซอง","size":"100 กรัม","supplier":"บริษัท ฟอร์มูล่าร์-เอ จำกัด","photo":"photo_1781316228028.JPEG,photo_1781316458227.JPEG"},
  {"name":"โฟว่า","generic":"เหล็ก-แมงกานีส","category":"อาหารเสริม","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โซตัส อินเตอร์เนชั่นแนล จํากัด","photo":"photo_1781316578993.JPEG,photo_1781316571756.JPEG"},
  {"name":"บาก้ารอน","generic":"ไดยูรอน","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท แอนคอม ครอปแคร์ จำกัด ประเทศมาเลเซีย","photo":"photo_1781316813890.JPEG"},
  {"name":"Simodis","generic":"ไอโซไซโครเซอแรม","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"photo_1781316537419.JPEG"},
  {"name":"มอเตอร์เวย์กรีน","generic":"สาหร่ายทะเลสกัดผสมอะมิโน แอซิด","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"photo_1781317061280.JPEG"},
  {"name":"ปุ๋ยเกล็ดมรกต 30-5-5","generic":"30-5-5","category":"ปุ๋ยเคมี","unit":"ถุง","size":"1 กิโลกรัม","supplier":"ปุ๋ยไวกิ้ง จำกัด","photo":"photo_1781317401310.JPEG"},
  {"name":"มาร์แชล25 เอสทีดี","generic":"คาร์โบซัลแฟน","category":"ยากำจัดศัตรูพืช","unit":"ซอง","size":"20 กรัม","supplier":"","photo":"photo_1781316917061.JPEG,photo_1781316922694.JPEG"},
  {"name":"เนโช-เอส","generic":"เอส-เมโทลาคลอร์","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781317490923.JPEG"},
  {"name":"คิวเวท","generic":"ดี-ลิโมนีน","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท คิวแฟค จำกัด","photo":"photo_1781317688945.JPEG"},
  {"name":"บาก้าโทรซีน","generic":"มีไซไตรโอนอะทราซีน","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ดันเก้น อโกรโซลูชั่น จำกัด","photo":"photo_1781317498277.JPEG"},
  {"name":"แชปเตอร์21-5-5","generic":"21-5-5","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกรว์ เคมีคอล จำกัด","photo":"photo_1781317925167.JPEG"},
  {"name":"ลีซอส","generic":"อะซีโทคลอร์","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"โกลบอล ครอปส์","photo":"photo_1781317760547.JPEG"},
  {"name":"โคเลอร์5 เอสจี(แบบเกล็ด)","generic":"อีมาเมกตินเบนโซเอต","category":"ยากำจัดศัตรูพืช","unit":"กล่อง","size":"1 กิโลกรัม","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781317930098.JPEG"},
  {"name":"ปุ๋ยเกล็ดเรือใบ0-52-34","generic":"โมโนโพแทสเซียมฟอสเฟต","category":"ปุ๋ยเคมี","unit":"ถุง","size":"1 กิโลกรัม","supplier":"บริษัท ปุ๋ยไวกิ้ง จำกัด","photo":"photo_1781318219030.JPEG"},
  {"name":"เลบาน84","generic":"2,4-ดี-ไดเมทิลแอมโมเนียม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท เทพวัฒนา จํากัด","photo":"photo_1781318111518.JPEG"},
  {"name":"เลบาน84","generic":"2,4-ดี-ไดเมทิลแอมโมเนียม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท แพนเตอร์ ยูไนเต็ด จำกัด","photo":"photo_1781318335289.JPEG"},
  {"name":"ไลท์แม็กติน","generic":"อะบาเมกติน","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท สิงห์ก้าวหน้า จำกัด","photo":"photo_1781336351932.JPEG,photo_1781318501019.JPEG"},
  {"name":"วิกโต้(ฝาแดง)","generic":"ไทอะโคลพริด","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1000 มิลลิลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781318582924.JPEG"},
  {"name":"บาซากราน","generic":"เบนทาโซน","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท บีเอเอสเอฟ (ไทย) จํากัด","photo":"photo_1781318550087.JPEG"},
  {"name":"ไฮเฟต","generic":"ไพริพรอกซีเฟน","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท เทพวัฒนา จํากัด","photo":"photo_1781318628049.JPEG"},
  {"name":"บีคาโน","generic":"อินดาซิแฟลม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1000 มิลลิลิตร","supplier":"บาก้า จำกัด","photo":"photo_1781318751654.JPEG"},
  {"name":"โปรเกรซ 0-33-29","generic":"0-33-29","category":"ปุ๋ยเคมี","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โปร ไลฟ์ แคร์ จำกัด","photo":"photo_1781318882087.JPEG"},
  {"name":"ซีเลคท์24อีซี","generic":"คลีโทดิม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท อริสต้า ไลฟ์ซายน์ (ประเทศไทย) จำกัด","photo":"photo_1781318935741.JPEG"},
  {"name":"วอเตอร์ไฟน์","generic":"สารปรับสภาพน้ำ+ สารจับใบ","category":"สารปรับสภาพน้ำ","unit":"ขวด","size":"100มิลลิลิตร","supplier":"บริษัท วิกเตอร์ บูตริพลานท์ จำกัด","photo":"photo_1781319048745.JPEG,photo_1781319066965.JPEG"},
  {"name":"เบรค-ทรู","generic":"โดรน-บลาสท์","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1000 มิลลิลิตร","supplier":"บริษัท โปรครอป จำกัด","photo":"photo_1781319634508.JPEG,photo_1781319626867.JPEG,photo_1781319642585.JPEG"},
  {"name":"นาร์มิต","generic":"โคลมาโซน+โพรพานิล","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท วิกเตอร์ บูตริพลานท์ จำกัด","photo":"photo_1781319575054.JPEG"},
  {"name":"ไฮครอป-โดรน","generic":"ยาเพิ่มลิตร เพิ่มพลังดูดซึม","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท โปรครอป จำกัด","photo":"photo_1781319824243.JPEG,photo_1781319817475.JPEG,photo_1781319832487.JPEG"},
  {"name":"แอ็คบิว","generic":"บิวทาคลอร์","category":"ยากำจัดวัชพืช","unit":"แกลลอน","size":"5 ลิตร","supplier":"บริษัท วิกเตอร์ บูตริพลานท์ จำกัด","photo":"photo_1781319869644.JPEG"},
  {"name":"อีริค","generic":"โพรพานิล","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781319766904.JPEG"},
  {"name":"โดรนพาเวอร์","generic":"สารเพิ่มประสิทธิภาพ","category":"อาหารเสริม","unit":"ขวด","size":"1000 มิลลิลิตร","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"IMG_2890.JPEG,IMG_2891.JPEG"},
  {"name":"แร็พอัพ","generic":"ไซฮาโลฟอป-บิวทิล","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781320033573.JPEG"},
  {"name":"ทูโฟดี หัวเสือ","generic":"2,4-ดี-ไดเมทิลแอมโมเนียม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"โกลบอล ครอปส์","photo":"photo_1781324747729.JPEG"},
  {"name":"ไทเกอร์นิค","generic":"โซเดียม ออร์โท-ไนโตรฟีโนเลต&#xA;โซเดียม พารา-ไนโตรฟีโนเลต&#xA;โซเดียม-5-ไนโตรกัวเอียโคเลต","category":"อาหารเสริมและฮอร์โมน","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781325118895.JPEG,photo_1781325111937.JPEG"},
  {"name":"ฟรอนเทียร์ พี","generic":"ไดเมทีนามิด-พี","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท บีเอเอสเอฟ (ไทย) จํากัด","photo":"photo_1781325021188.JPEG"},
  {"name":"เมอริสเต็ม","generic":"ไดฟีโนโคนาโซล&#xA;โพรพิโคนาโซ","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท วิกเตอร์ นูตริพลานท์ จำกัด","photo":"photo_1781325326452.JPEG,photo_1781325320655.JPEG"},
  {"name":"เวลปาร์-เค","generic":"ไดยูรอน+เฮกซะซิโนน","category":"ยากำจัดวัชพืช","unit":"ถุง","size":"1 กิโลกรัม","supplier":"บาก้า จำกัด","photo":"photo_1781325424664.JPEG"},
  {"name":"ไซฮาโลฟอป-บิวทิล 10","generic":"ไซฮาโลฟอป-บิวทิล","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท เรนโบว์ อโกรไซเอนเซส จำกัด","photo":"photo_1781325221588.JPEG"},
  {"name":"บลาสฟูวัน","generic":"ไอโซโพรไทโอเลน","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781325626326.JPEG,photo_1781325619618.JPEG"},
  {"name":"กรีนออน โกร้ท","generic":"ธาตุหารเสริม Mn+Zn+Cu+B","category":"ปุ๋ยเคมี","unit":"ซอง","size":"50 กรัม","supplier":"บริษัท ไฟโตแพลนต้า เอเชีย จำกัด","photo":"photo_1781325525574.JPEG,photo_1781325542563.JPEG"},
  {"name":"อัลฟีต","generic":"เพรทิลาคลอร์","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกรว์ เคมีคอล จำกัด","photo":"photo_1781325597796.JPEG"},
  {"name":"ไซทรอน มิกซ์","generic":"ไตรโคลเพอร์ บิวทอกซีเอทิล เอสเทอร์&#xA;อะมิโนไพราลิด โพแทสเซียม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781325945538.JPEG,photo_1781325954428.JPEG"},
  {"name":"โกลสตาร์","generic":"ออกซาไดอะซอน","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781326004419.JPEG"},
  {"name":"นอร์ส","generic":"บิสไพริแบก-โซเดียม","category":"ยากำจัดวัชพืช","unit":"กระปุก","size":"100 กรัม","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781326107488.JPEG"},
  {"name":"บีเค ซิเนต","generic":"กลูโฟซิเนต-แอมโมเนียม","category":"ยากำจัดวัชพืช","unit":"แกลลอน","size":"4 ลิตร","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781326610491.JPEG,photo_1781326616610.JPEG"},
  {"name":"เสือฟิต","generic":"เพรทิลาคลอร์","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"IMG_2911.JPEG,photo_1781332791611.JPEG"},
  {"name":"เสือเทรลพลัส","generic":"โพรฟีโนฟอส+ลูเฟนนูรอน","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781332908255.JPEG"},
  {"name":"โครบ๊อกซิล","generic":"โคลมาโซน+โพรพานิล","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกรว์ เคมีคอล จำกัด","photo":"photo_1781332803570.JPEG,photo_1781332797270.JPEG"},
  {"name":"เรนโกลด์24","generic":"พีนอกซูแลม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781333200098.JPEG"},
  {"name":"นิวเทค","generic":"เฮกซะโคนาโซล","category":"ยากำจัดโรคพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"photo_1781333233643.JPEG,photo_1781333251930.JPEG"},
  {"name":"เบ็น-เท็น","generic":"โนวาลูรอน","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"บริษัท อดามา มัคเตซิม จำกัด ประเทศอิสราเอล","photo":"photo_1781333542019.JPEG,photo_1781333552854.JPEG"},
  {"name":"เพนดิ ไฮโดรแคป","generic":"เพนดิเมทาลิน","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781333510255.JPEG"},
  {"name":"ไตรอะโซฟอส 40% อีซี","generic":"ไตรอะโซฟอส","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท ไทย อะโกรเทรด จำกัด","photo":"photo_1781333711010.JPEG,photo_1781333719897.JPEG"},
  {"name":"แบคเคียว","generic":"โพรพาโมคาร์บไฮโดรคลอไรด์+เมทาแลกซิล","category":"ยากำจัดโรคพืช","unit":"กล่อง","size":"1 กิโลกรัม","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1781333875715.JPEG"},
  {"name":"ไดควอดไดโบรไมค์","generic":"ไตควอตไดโบร์โมด์","category":"ยากำจัดวัชพืช","unit":"แกลลอน","size":"5 ลิตร","supplier":"บริษัท เออีซี พลัส จำกัด","photo":"photo_1781333932667.JPEG"},
  {"name":"เรนโบว์ 25 โอดี","generic":"พีน็อกซูแลม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1000 มิลลิลิตร","supplier":"บริษัท ดาว อะโกรไซแอนส์ (ประเทศไทย) จำกัด","photo":"photo_1781334198495.JPEG"},
  {"name":"ทีโพล์ พาวเวอร์ แอลดีไอ","generic":"ผลิตภัณฑ์ทำความสะอาดคราบ","category":"ทำความสะอาดคราบ","unit":"แกลลอน","size":"100มิลลิลิตร","supplier":"บริษัท เอนจอยไลฟ์ เทรดดิ้ง จำกัด","photo":"photo_1781334158930.JPEG"},
  {"name":"บีเค แม็กซ์-พรี","generic":"อาทราซีน","category":"ยากำจัดวัชพืช","unit":"ถุง","size":"900กรัม","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781334248244.JPEG"},
  {"name":"ปุ๋ย15-15-15 กระต่าย","generic":"ไนโปรเฟต15-15-15","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50 กิโลกรัม","supplier":"เจียไต๋","photo":"IMG_3054.JPEG"},
  {"name":"ปุ๋ย16-20-0กระต่าย","generic":"ไนโปเฟท16-20-0","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50 กิโลกรัม","supplier":"เจียไต๋","photo":"IMG_3055.JPEG"},
  {"name":"ปุ๋ยยูเรีย46-0-0 กระต่าย","generic":"ไนโปเฟท46-0-0","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50 กิโลกรัม","supplier":"เจียไต๋","photo":"IMG_3056.JPEG"},
  {"name":"ไรซูม่า","generic":"สารฮิวมิคทางดิน","category":"ปุ๋ยอินทรีย์","unit":"กระสอบ","size":"25กิโลกรัม","supplier":"บริษัท ตราอินทรีย์ดำ","photo":"photo_1781339284662.JPEG,photo_1781339277770.JPEG"},
  {"name":"ปุ๋ย21-0-0 กระต่ายแดง","generic":"แอมโมเนียมซัลเฟต ไนโปเฟท 21-0-0","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50 กิโลกรัม","supplier":"เจียไต๋","photo":"IMG_3057.JPEG"},
  {"name":"แฟคท์ซอย","generic":"ฮิวมิค แอซิค ชนิดเข้มข้น","category":"ปุ๋ยอินทรีย์","unit":"กระสอบ","size":"10กิโลกรัม","supplier":"บริษัท วิกเตอร์ บูตริพลานท์ จำกัด","photo":"photo_1781339479647.JPEG,photo_1781339500064.JPEG"},
  {"name":"15-15-15 บาก้าคอมเพล็กซ์","generic":"15-15-15","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50กิโลกรัม","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781339631825.JPEG"},
  {"name":"บาก้า คอมเพล็กซ์","generic":"24-8-7","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50กิโลกรัม","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781339726763.JPEG,photo_1781339721244.JPEG"},
  {"name":"ยาราเรก้า 18-4-19","generic":"18-4-19","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"25 กิโลกรัม","supplier":"ยาราประเทศไทย จำกัด","photo":"IMG_3059.JPEG"},
  {"name":"ยาราเรก้า13-4-25","generic":"13-4-25","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"25กิโลกรัม","supplier":"ยาราประเทศไทย จำกัด","photo":"IMG_3058.JPEG"},
  {"name":"ยารามีร่า 15-15-15","generic":"15-15-15","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50กิโลกรัม","supplier":"ยาราประเทศไทย จำกัด","photo":"photo_1781339936427.JPEG"},
  {"name":"ปุ๋ย 25-7-7 กระต่าย","generic":"ไนโปเฟท25-7-7","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50กิโลกรัม","supplier":"เจียไต๋","photo":"IMG_3060.JPEG"},
  {"name":"ยารามีร่า 25-7-7","generic":"25-7-7","category":"ปุ๋ยเคมี","unit":"กระสอบ","size":"50กิโลกรัม","supplier":"ยาราประเทศไทย จำกัด","photo":"IMG_2929.JPEG"},
  {"name":"บาก้าดริพ 28-0-0","generic":"ธาตุอาหาร 28-0-0","category":"ปุ๋ยเคมี","unit":"แกลลอน","size":"20 ลิตร","supplier":"บริษัท บาก้า จำกัด","photo":"photo_1781493967616.JPEG"},
  {"name":"ซีซาน","generic":"คลีโทดิม","category":"ยากำจัดวัชพืช","unit":"ขวด","size":"1 ลิตร","supplier":"บริษัท โกลบอล ครอปส์ จำกัด","photo":"photo_1782369301642.JPEG,photo_1782369278580.JPEG"},
  {"name":"ซิโมดิส","generic":"ไอโซไซโคลเซอแรม (Isocycloseram)","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"500 มิลลิลิตร","supplier":"บริษัท ซินเจนทา ครอป โปรเทคชั่น จํากัด","photo":"image.png"},
  {"name":"ริดอิท","generic":"เมทอกซีฟีโนไซด์+สไปนีโทแรม","category":"ยากำจัดศัตรูพืช","unit":"ขวด","size":"250มิลลิลิตร","supplier":"บริษัท ดาว อะโกรไซแอนส์ (ประเทศไทย) จำกัด","photo":"image.png"}
];

/* ---------- seed ---------- */
function seed() {
  /* เวอร์ชันเริ่มต้นแบบว่างเปล่า — ไม่มีข้อมูลตัวอย่าง ให้ผู้ใช้กรอกเอง (แปลง/งาน/สต็อก/รอบ/ขาย) */
  return {
    version: 52,
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
};

/* หาสูตรจากชื่อพืช — ชื่อพืชต้อง "มี" คีย์อยู่ในตัว (กัน 'ข้าว' ไปจับ 'ข้าวโพด') หรือพิมพ์ตรงเป๊ะ */
function playbookFor(plant) {
  const n = String(plant || "").trim().toLowerCase();
  if (!n) return null;
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
        s.version = 52;
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
  /* หมายเหตุ: เดิมเคยเติมสต็อก FLYTECH อัตโนมัติ — เอาออกแล้ว (เริ่มต้นต้องว่างเปล่า ให้ผู้ใช้กรอกเอง) */
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
  /* เติมรหัสสินค้า (code) ให้สต็อกที่ยังไม่มี — แมปตามชื่อจากตารางรหัส FLYTECH */
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

/* รหัสสินค้าเดิม (Item Code) จากไฟล์ Excel ของ FLYTECH — ใช้เติมรหัสให้สต็อกที่มีชื่อตรงกัน */
const STOCK_CODE_MAP = {"ฟราสโล-เอ็นพีเค":"00-000L-130","ดาซาโฟล":"00-0000-269","Q-TECH":"00-0000-147","เทกิโม":"BASF-L-023","คอโฟลิรูท":"00-0000-31","แชปเตอร์":"00-0000-089","อิเควชั่น":"00-0000-136","โกลลีเอท":"00-G000-81","ฟิลลัม":"00-G000-82","ไกลโฟเซต48":"00-0000-102","โนว่า":"00-0000-040","วิกโต้":"00-0000-01","วีเซ่":"00-0000-112","วิกเตอร์สเปรย์":"00-0000-101","ปุ๋ยเกล็ดมรกต 13-4-46":"00-0000-228","มิสต้า":"00-0000-111","เอนซิกา":"00-000L-104","แอ็คบิว":"00-0000-04","ไกลโฟเซต 48":"00-0000-82","กลูโฟสลีป":"00-0000-196","เม็กซิโอ้":"00-0000-154","คะน้ายอดไต้หวัน (บางบัวทอง35)":"SDS-S-150","อินล็อค":"00-0000-226","สกอร์":"00-0000-121","ไดออฟ":"00-0000-12","แอมเมท":"00-G000-53","อฟินโต":"00-0000-229","คาซู่":"00-0000-54","โดรนแมทซ์":"00-0000-90","เฟอร์ร่า":"00-0000-168","ซานติส":"PTL-L-103","มิสเตอร์จั๊ม":"00-0000-36","คอนราด":"THP-L-159","โกลวาธอน":"00-G000-86","เอวิด":"00-0000-128","ทีทริส":"00-0000-60","เอสเคเอ็นสเปรย์":"00-0000-182","เบฟอแคน":"00-0000-256","ซูมิ-โรดี้":"00-000L-116","ดูปองท์ อัลทาคอร์":"00-G000-84","เอเทร็ก90 ดับบลิวจี":"SYN-L-026","แอคทาลิค50อีซี":"00-0000-230","โนราโด้":"00-0000-120","โรนัล":"00-G000-85","เบสมอร์":"00-000L-013","เทติก":"xx-xxxx-009","เมคเซนด์ 25%":"00-000L—002","อัลเมโท":"xx-xxxx-011","คิวเรียม":"00-0000-88","ล็อคโกลด์":"00-0000-153","โปรเคลม":"00-0000-142","เพอมิท":"00-0000-167","นาร์ไอร์":"CBC-L-405","เคทีโอนิค":"ART-L-004","เอ็มซีเซท":"SYN-L-085","แซทเทลไลท์ ซีเอส":"00-G000-80","เฟตริลอน เพชร":"SHA-L-061","แทนเนท":"00-0000-93","บาก้ารอน":"00-0000-87","Simodis":"00-0000-253","มอเตอร์เวย์กรีน":"00-0000-22","มาร์แชล25 เอสทีดี":"00-0000-257","เนโช-เอส":"00-0000-149","คิวเวท":"00-0000-264","บาก้าโทรซีน":"00-0000-266","ลีซอส":"00-0000-06","โคเลอร์5 เอสจี(แบบเกล็ด)":"00-0000-189","บาซากราน":"BASF-L-089","ไฮเฟต":"00-0000-250","บีคาโน":"00-0000-10","ซีเลคท์24อีซี":"00-0000-206","วอเตอร์ไฟน์":"00-0000-23","เบรค-ทรู":"00-0000-07","นาร์มิต":"00-0000-03","ไฮครอป-โดรน":"00-0000-08","อีริค":"00-0000-84","โดรนพาเวอร์":"00-0000-89","แร็พอัพ":"00-0000-259","ทูโฟดี หัวเสือ":"00-0000-104","ไทเกอร์นิค":"00-0000-17","ฟรอนเทียร์ พี":"00-0000-132","เมอริสเต็ม":"00-0000-35","เวลปาร์-เค":"BAKA-L-029","ไซฮาโลฟอป-บิวทิล 10":"00-0000-66","บลาสฟูวัน":"00-0000-48","กรีนออน โกร้ท":"00-0000-237","อัลฟีต":"00-0000-078","ไซทรอน มิกซ์":"00-G000-33","โกลสตาร์":"00-0000-190","นอร์ส":"00-0000-187","บีเค ซิเนต":"00-0000-053","เสือฟิต":"00-0000-16","เสือเทรลพลัส":"00-0000-215","โครบ๊อกซิล":"00-0000-081","เรนโกลด์24":"00-0000-197","เบ็น-เท็น":"00-0000-100","เพนดิ ไฮโดรแคป":"00-000L-077","ไตรอะโซฟอส 40% อีซี":"00-0000-217","แบคเคียว":"00-0000-134","ไดควอดไดโบรไมค์":"PHR-L-077","ทีโพล์ พาวเวอร์ แอลดีไอ":"00-0000-252","บีเค แม็กซ์-พรี":"00-0000-29","ปุ๋ย15-15-15 กระต่าย":"00-000F-037","ปุ๋ย16-20-0กระต่าย":"00-0000-039","ปุ๋ยยูเรีย46-0-0 กระต่าย":"00-0000-098","ไรซูม่า":"00-0000-007","ปุ๋ย21-0-0 กระต่ายแดง":"00-G000-96","ยาราเรก้า 18-4-19":"00-G000-88","ยาราเรก้า13-4-25":"00-G000-87","ยารามีร่า 15-15-15":"00-00F-004","ซิโมดิส":"N-L-090","ริดอิท":"CTV-L-006"};

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
