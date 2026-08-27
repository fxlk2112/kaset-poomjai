/* แปลงชีต "C รอบใหม่" จาก Farm Record (C2.69).xlsx → ไฟล์ JSON สำหรับ "ผสานข้อมูล" ในเว็บ
   ใช้: node tools/xlsx_to_import.js [out.json]   (อ่านจากโฟลเดอร์ tmp_xlsx ที่แตก zip ไว้แล้ว)
   สูตรเงินใน Excel: L = I*RAI (ถ้าไม่ระบุ L ตรงๆ), N = ±(L/K)*M  (K=ขนาดแพ็ก, M=ราคา/แพ็ก) */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "tmp_xlsx");
const OUT = process.argv[2] || path.join(__dirname, "..", "import-plotC-round.json");

function decodeXml(s) {
  return s.replace(/&(lt|gt|amp|quot|apos|#x?[0-9a-fA-F]+);/g, (m, g) => {
    if (g === "lt") return "<"; if (g === "gt") return ">"; if (g === "amp") return "&";
    if (g === "quot") return '"'; if (g === "apos") return "'";
    if (/^#x/.test(g)) return String.fromCharCode(parseInt(g.slice(2), 16));
    return String.fromCharCode(parseInt(g.slice(1), 10));
  });
}

/* sharedStrings */
const shared = [];
{
  const xml = fs.readFileSync(path.join(ROOT, "xl", "sharedStrings.xml"), "utf8");
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    let text = "";
    const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tre.exec(m[1]))) text += decodeXml(t[1]);
    shared.push(text);
  }
}

/* workbook: sheet name -> file */
const wbXml = fs.readFileSync(path.join(ROOT, "xl", "workbook.xml"), "utf8");
const relXml = fs.readFileSync(path.join(ROOT, "xl", "_rels", "workbook.xml.rels"), "utf8");
const rels = {};
for (const m of relXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels[m[1]] = m[2];
let targetFile = null;
for (const m of wbXml.matchAll(/<sheet[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
  if (decodeXml(m[1]).trim() === "C รอบใหม่") targetFile = rels[m[2]];
}
if (!targetFile) { console.error("ไม่เจอชีต C รอบใหม่"); process.exit(1); }

/* เซลล์ทั้งหมด -> map "A1" -> value (ค่า raw: string index / number) */
const cells = {};
{
  const xml = fs.readFileSync(path.join(ROOT, "xl", targetFile.replace(/^\//, "")), "utf8");
  for (const cm of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = cm[1];
    const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
    const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
    const inner = cm[2] || "";
    if (!ref) continue;
    let val = "";
    /* ถ้าเป็นสูตร ใช้ค่า <v> (cache) — ไฟล์นี้ส่วนใหญ่ไม่มี cache จึงต้องคำนวณเองด้านล่าง */
    const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
    if (type === "s" && vm) val = shared[parseInt(vm[1], 10)] ?? "";
    else if (vm) val = decodeXml(vm[1]);
    cells[ref] = val;
  }
}
function cell(ref) { return cells[ref]; }
function num(ref) { const v = parseFloat(cells[ref]); return isNaN(v) ? 0 : v; }

/* serial Excel -> ISO date (epoch 1899-12-30) */
function serialToISO(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/* ---- หัวตาราง: จำนวนไร่ / วันเริ่ม / วันคาดเก็บ ---- */
const RAI = num("B2") || 4;
const startISO = serialToISO(num("B3"));
const dueISO = serialToISO(num("D3"));
console.log(`RAI=${RAI} เริ่ม=${startISO} คาดเก็บ=${dueISO}`);

/* ---- แผนที่หมวดต้นทุน (Cost-Type -> key ในแอป) ---- */
function costCat(e) {
  const s = String(e || "");
  if (s.includes("นักบิน")) return "pilot";
  if (s.includes("แรงงาน")) return "labor";
  if (s.includes("อาหารและเครื่องดื่ม")) return "meals";
  if (s.includes("สารเคมีทางการเกษตร") || s.includes("สารชีวภัณฑ์")) return "chemical";
  if (s.includes("เมล็ดพันธุ์")) return "seed";
  if (s.includes("ปุ๋ย")) return "fertilizer";
  if (s.includes("วัสดุ")) return "materials";
  if (s.includes("ไฟ")) return "utilities";
  return "other";
}
function taskType(cat, isRevenue) {
  if (isRevenue) return "harvest";
  if (cat === "chemical" || cat === "pilot") return "spray";
  if (cat === "fertilizer") return "fertilize";
  if (cat === "labor" || cat === "meals") return "work";
  return "expense";
}
let uidN = Date.now();
function uid() { return "imp" + (uidN++).toString(36); }

/* ---- อ่านแถวรายการ (7..117): A=วันที่ C=ประเภท D=รายการ E=หมวด F=ชนิดสาร
        I=จำนวน J=หน่วย K=ปริมาณ/แพ็ก L=ใช้ทั้งหมด(formula/ค่า) M=ราคา/แพ็ก N=รวม(formula) ---- */
const plotId = uid();
const cycleId = uid();
const tasks = [];
let totalCost = 0, totalRev = 0;
for (let r = 7; r <= 117; r++) {
  const dateS = num("A" + r);
  const billType = String(cell("C" + r) || "").trim();
  const topic = String(cell("D" + r) || "").trim();
  if (!dateS || !topic) continue;
  const isRevenue = billType.includes("รายได้");
  const e = cell("E" + r) || "";
  const chemType = String(cell("F" + r) || "").trim();
  const qtyI = num("I" + r);
  const unitJ = String(cell("J" + r) || "").trim();
  let packK = num("K" + r);
  let usedL = num("L" + r);          // ถ้าเซลล์เก็บค่าไว้จริง (เช่นแถวผลผลิต)
  if (!usedL && qtyI) usedL = qtyI * RAI; // ไม่งั้น = จำนวน × ไร่ (ตามสูตร I*$B$2)
  if (!packK) packK = 1;
  const priceM = num("M" + r);
  let moneyN = num("N" + r);
  if (!moneyN && priceM) moneyN = (usedL / packK) * priceM; // ตามสูตร ±(L/K)*M
  const money = Math.round(moneyN * 100) / 100;

  const cat = costCat(isRevenue ? "" : e);
  const noteParts = [];
  if (chemType) noteParts.push("ประเภทสาร: " + chemType);
  if (qtyI && unitJ) noteParts.push(`บันทึกใน Excel: ${qtyI} ${unitJ}` + (packK > 1 ? ` (แพ็ก ${packK} ${unitJ})` : "") + (RAI > 1 && !num("L" + r) ? ` × ${RAI} ไร่` : ""));
  if (!money && !isRevenue) noteParts.push("(Excel ไม่ระบุราคา)");

  const t = {
    id: uid(),
    title: topic,
    type: taskType(cat, isRevenue),
    date: serialToISO(dateS),
    status: "done",
    plotId,
    cycleId,
    costItems: [],
    costCat: null, stockId: null, qty: 0, unit: "",
    cost: 0, revenue: 0,
    harvestQty: 0, harvestUnitPrice: 0,
    finishCycle: false,
    note: noteParts.join(" · "),
    createdAt: Date.now()
  };
  if (isRevenue) {
    t.revenue = Math.round(money);
    t.harvestQty = qtyI;
    t.harvestUnitPrice = priceM;
    totalRev += t.revenue;
  } else {
    t.cost = Math.round(money);
    totalCost += t.cost;
    if (t.cost > 0) {
      /* เก็บเป็น: จำนวนตาม Excel × ราคาต่อหน่วยที่คิดกลับ = ยอดเงินรวมเดิมเป๊ะ */
      const effUnit = qtyI > 0 ? Math.round((money / qtyI) * 100) / 100 : money;
      t.costItems.push({ category: cat, stockId: null, name: topic + (chemType ? ` (${chemType})` : ""), qty: qtyI || 1, unit: unitJ || "รายการ", unitCost: effUnit, totalCost: t.cost });
      t.costCat = cat;
      t.qty = qtyI || 1; t.unit = unitJ || "รายการ";
    } else {
      t.costCat = cat; // รายการไม่มียอดเงิน (เช่นฉีดยาร่วมกับค่าแรงนักบิน) — เก็บเป็นบันทึกกิจกรรม
    }
  }
  tasks.push(t);
}

/* งานเก็บเกี่ยวรอบสุดท้าย → จบรอบ */
const lastHarvest = [...tasks].reverse().find(t => t.type === "harvest");
if (lastHarvest) lastHarvest.finishCycle = true;

const out = {
  type: "backup",
  label: "แปลง C รอบใหม่ (ข้าวโพดหวาน ไฮบริกซ์ 72) — จาก Farm Record (C2.69).xlsx",
  data: {
    version: 52,
    plots: [{ id: plotId, name: "แปลง C", crop: "ข้าวโพดหวาน", sizeRai: RAI, status: "active", lat: null, lng: null }],
    cycles: [{ id: cycleId, plotId, plant: "ข้าวโพดหวาน", startDate: startISO, status: "done", round: 0, dueDate: dueISO }],
    tasks,
    stock: [], sales: [], equipment: []
  }
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), "utf8");
console.log(`งาน ${tasks.length} รายการ · ต้นทุนรวม ${totalCost.toLocaleString()} บ. · รายได้รวม ${totalRev.toLocaleString()} บ.`);
console.log(`เขียนไฟล์: ${OUT}`);
