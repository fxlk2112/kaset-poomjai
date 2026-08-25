const fs = require("fs");
const s = fs.readFileSync("D:/folk/WebFarm/css/style.css", "utf8");
const lines = s.split("\n");
// ตัดช่วง :root (1-35) กับ dark var block ออก — สนใจเฉพาะสี hardcode ที่ render จริง
const out = [];
let inDarkVars = false;
lines.forEach((l, i) => {
  const m = l.match(/#[0-9a-fA-F]{3,8}\b/g);
  if (!m) return;
  if (l.includes("data-theme") && l.includes("{")) { inDarkVars = true; }
  if (l.includes("}")) inDarkVars = false;
  if (inDarkVars) return; // ข้ามบล็อกประกาศตัวแปร dark
  // สนใจเฉพาะสี "สว่าง" ที่จะมองไม่เห็น/เรืองเกินบนพื้นเข้ม หรือสี "เข้ม" ที่จะจมบนพื้นเข้ม
  const lightBg = /#(fff|ffffff|f8faf9|f8fafc|fafafa|f1f5f9|f9fafb|e2e8f0|eef2f0|eef0f2|d9efe1|cbd5d1|fef9c3|fef3c7|dcfce7|dbeafe|f0fdf4|e8eeea|f7fdf9|eefaf3)/i.test(l);
  const darkText = /#(16211c|111827|1f2937|14532d|166534|15803d|123f23|0b3d20|374151|4b5563|1e40af|166534)/i.test(l);
  if (lightBg || darkText) {
    out.push((i + 1) + ": " + l.trim().slice(0, 120));
  }
});
fs.writeFileSync("C:/Users/USER/AppData/Local/Temp/opencode/webfarm-test/full-audit.txt", out.join("\n"), "utf8");
console.log("found", out.length);
