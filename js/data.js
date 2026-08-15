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
      generic: String(p.generic || p.genericName || "").trim(),
      category: String(p.category || "").trim(),
      size, unit, supplier,
      photo: String(p.photo || p.photoName || "").trim(),
      qty: Number(p.qty) || 0,
      openQty: 0,
      avgCost: Number(p.avgCost) || 0
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
    customCostCats: [],       // หมวดต้นทุนที่ผู้ใช้เพิ่มเองจากหน้า ตั้งค่า [{ key, label, color }]
    plots: [
      { id: "p1", name: "แปลง A", crop: "ข้าวโพดหวาน", sizeRai: 25, lat: 14.9823, lng: 100.4582, status: "active" },
      { id: "p2", name: "แปลง B", crop: "ข้าวนาปี", sizeRai: 40, lat: 14.9750, lng: 100.4711, status: "active" },
      { id: "p3", name: "แปลง C", crop: "มันสำปะหลัง", sizeRai: 15, lat: 14.9901, lng: 100.4498, status: "active" },
      { id: "p4", name: "แปลง D", crop: "ผักสวนครัว", sizeRai: 5, lat: 14.9788, lng: 100.4625, status: "active" },
      { id: "p5", name: "แปลง E", crop: "อ้อย", sizeRai: 30, lat: 14.9694, lng: 100.4850, status: "inactive" },
    ],
    stock: [
      { id: "s1", name: "ปุ๋ยเคมี สูตร 46-0-0", category: "ปุ๋ยเคมี", size: "50 กก.", unit: "ถุง", qty: 120, avgCost: 890, openQty: 0 },
      { id: "s2", name: "ปุ๋ยอินทรีย์", category: "ปุ๋ยอินทรีย์", size: "20 กก.", unit: "ถุง", qty: 60, avgCost: 350, openQty: 0 },
      { id: "s3", name: "ยาฆ่าแมลง (คลอร์ไพริฟอส)", category: "ยากำจัดศัตรูพืช", size: "1,000 ซีซี", unit: "ขวด", qty: 24, avgCost: 620, openQty: 0 },
      { id: "s4", name: "เมล็ดข้าวโพดหวาน", category: "เมล็ดพันธุ์", size: "1 กก.", unit: "ถุง", qty: 15, avgCost: 1250, openQty: 0 },
      { id: "s5", name: "เมล็ดพันธุ์ข้าว กข15", category: "เมล็ดพันธุ์", size: "20 กก.", unit: "ถุง", qty: 30, avgCost: 980, openQty: 0 },
      { id: "s6", name: "น้ำมันดีเซล", category: "", size: "", unit: "ลิตร", qty: 300, avgCost: 34.5, openQty: 0 },
      { id: "s7", name: "สารเร่งการเจริญเติบโต", category: "อาหารเสริมและฮอร์โมน", size: "1 ลิตร", unit: "ขวด", qty: 10, avgCost: 480, openQty: 0 },
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
/* แทนที่สต็อกด้วยรายการสินค้า FLYTECH (ตามคำขอ: ลบสต็อกเดิม ใส่รายการจริง) — รันครั้งเดียว */
  if (!s.stockReplacedV1 && FLYTECH_MASTER.length) {
    s.stock = FLYTECH_MASTER.map(p => ({
      id: uid(), name: p.name, generic: p.generic || "", category: p.category || "",
      size: p.size || "", unit: p.unit || "ชิ้น", supplier: p.supplier || "", photo: p.photo || "",
      qty: 0, openQty: 0, avgCost: 0
    }));
    s.stockReplacedV1 = true;
  }
  if (typeof s.adminPass !== "string") s.adminPass = "";
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
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* storage full / blocked */ }
}

/* ---------- derived helpers ---------- */
function plotById(s, id) { return s.plots.find(p => p.id === id); }
function cycleById(s, id) { return s.cycles.find(c => c.id === id); }
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
/* ต้นทุนเชิงลึก — กลุ่มตามหมวดต้นทุนของงาน (รวมหมวดที่ผู้ใช้เพิ่มเอง) */
function costBreakdown(s) {
  const map = {};
  const cmap = costCatMap(s);
  doneTasks(s).forEach(t => {
    if (!t.cost) return;
    const key = t.costCat && cmap[t.costCat] ? t.costCat : "other";
    if (!map[key]) map[key] = { label: cmap[key].label, value: 0, color: cmap[key].color };
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
