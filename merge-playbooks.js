const fs = require("fs");
const add = fs.readFileSync("D:/folk/WebFarm/playbooks2.tmp.js", "utf8");
const p = "D:/folk/WebFarm/js/data.js";
let t = fs.readFileSync(p, "utf8");

// หา comment "/* หาสูตรจากชื่อพืช" แล้วย้อนไปหา "};" ปิด object ที่อยู่ก่อนหน้า
const ci = t.indexOf("/* หาสูตรจากชื่อพืช");
if (ci < 0) { console.error("comment not found"); process.exit(1); }
const closeIdx = t.lastIndexOf("};", ci);
if (closeIdx < 0) { console.error("close not found"); process.exit(1); }
t = t.slice(0, closeIdx + 2) + "\n" + add + t.slice(closeIdx + 2);

// เพิ่ม alias ใน playbookFor
const oldFn = [
  "function playbookFor(plant) {",
  '  const n = String(plant || "").trim().toLowerCase();',
  "  if (!n) return null;",
  "  const keys = Object.keys(CROP_PLAYBOOKS).sort((a, b) => b.length - a.length);"
].join("\n");
const newFn = [
  "function playbookFor(plant) {",
  '  const n = String(plant || "").trim().toLowerCase();',
  "  if (!n) return null;",
  '  /* ชื่อพันธุ์การค้า → สูตรพืชหลัก (เช่น ไฮบริกซ์ 72 / ATS 15 = ข้าวโพดหวาน) */',
  "  const aliasKeys = Object.keys(CROP_PLAYBOOK_ALIASES).sort((a, b) => b.length - a.length);",
  "  for (const a of aliasKeys) {",
  "    if (n.indexOf(a) !== -1) return { key: CROP_PLAYBOOK_ALIASES[a], steps: CROP_PLAYBOOKS[CROP_PLAYBOOK_ALIASES[a]] };",
  "  }",
  "  const keys = Object.keys(CROP_PLAYBOOKS).sort((a, b) => b.length - a.length);"
].join("\n");
if (!t.includes(oldFn)) { console.error("fn marker not found"); process.exit(1); }
t = t.replace(oldFn, newFn);

fs.writeFileSync(p, t, "utf8");
fs.unlinkSync("D:/folk/WebFarm/playbooks2.tmp.js");
console.log("merged OK, size:", t.length);
