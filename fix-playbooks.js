const fs = require("fs");
const p = "D:/folk/WebFarm/js/data.js";
let t = fs.readFileSync(p, "utf8");

const ci = t.indexOf("/* หาสูตรจากชื่อพืช");
const isn = t.indexOf('"ข้าวโพดหวาน": [');
const pbClose = t.lastIndexOf("};", isn);           // ปิด CROP_PLAYBOOKS เดิม
const aliasesEnd = t.lastIndexOf("};", ci);          // ปิด const CROP_PLAYBOOK_ALIASES
if (isn < 0 || pbClose < 0 || aliasesEnd < 0) { console.error("markers missing", isn, pbClose, aliasesEnd); process.exit(1); }

// ส่วนที่แทรกผิด = จากหลัง }; ถึงปลาย aliases
const inserted = t.slice(pbClose + 2, aliasesEnd + 2);
const splitAt = inserted.indexOf("/* ชื่อพันธุ์การค้า");
if (splitAt < 0) { console.error("alias comment not found"); process.exit(1); }
const cropPart = inserted.slice(0, splitAt).trim();          // รายการพืชใหม่ (ไม่มี ;)
const aliasPart = inserted.slice(splitAt).trim();            // const CROP_PLAYBOOK_ALIASES ...

// ประกอบใหม่: ใส่พืชใหม่ "ใน" object (เติม comma ต่อท้ายทุเรียน) แล้ว aliases เป็น const แยก
t = t.slice(0, pbClose) + ",\n" + cropPart + "\n};\n\n" + aliasPart + "\n\n" + t.slice(aliasesEnd + 2);

fs.writeFileSync(p, t, "utf8");
console.log("fixed, size:", t.length);
