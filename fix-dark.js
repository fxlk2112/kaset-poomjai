const fs = require("fs");

// ===== 1) style.css: แทนสี hardcode ด้วยตัวแปร + เพิ่มตัวแปร/คลาส =====
const sp = "D:/folk/WebFarm/css/style.css";
let s = fs.readFileSync(sp, "utf8");

// 1a) เพิ่มตัวแปรใน :root
s = s.replace(
  "  --line: #e8eeea;\n  --radius: 14px;",
  "  --line: #e8eeea;\n  --chip: #eef2f0; --soft: #f8fafc; --amber-text: #92400e; --blue-text: #1e40af;\n  --radius: 14px;"
);
// 1b) เพิ่มตัวแปรใน dark block
s = s.replace(
  "  --amber-light: #33270e; --red-light: #381515; --blue-light: #14213a;",
  "  --amber-light: #33270e; --red-light: #381515; --blue-light: #14213a;\n  --chip: #26332c; --soft: #101814; --amber-text: #fde047; --blue-text: #93c5fd;"
);
// 1c) แทนสี hardcode ด้วยตัวแปร (global)
s = s.split("background: #eef2f0").join("background: var(--chip)");
s = s.split("background: #f8fafc").join("background: var(--soft)");
s = s.split("background: #fef3c7").join("background: var(--amber-light)");
s = s.split("background: #fef9c3").join("background: var(--amber-light)");
s = s.split("background: #f0fdf4").join("background: var(--green-soft)");
s = s.split("background: #dbeafe").join("background: var(--blue-light)");
s = s.split("color: #92400e").join("color: var(--amber-text)");
s = s.split("background: #ffffff;\n  border-radius: 0 0").join("background: var(--card);\n  border-radius: 0 0"); // bottomnav
// 1d) คลาสชิป/ตาราง/แบนเนอร์ (มี dark variant ผ่านตัวแปร)
s += `

/* ==================== ชิป/ตาราง/แบนเนอร์ (สลับธีมผ่านตัวแปร) ==================== */
.chip-water { background: var(--blue-light); color: var(--blue-text); }
.chip-price { background: var(--amber-light); color: var(--amber-text); }
.soft-bg { background: var(--soft); }
.tbl-th { padding: 8px 10px; text-align: left; border-bottom: 2px solid var(--line); white-space: nowrap; font-size: .78rem; color: var(--muted); }
.tbl-td { padding: 8px 10px; border-bottom: 1px solid var(--line); font-size: .8rem; }
.warn-banner { background: var(--amber-light); color: var(--amber-text); border-radius: 10px; padding: 8px 10px; margin: 8px 0; font-size: .76rem; font-weight: 700; }
`;
fs.writeFileSync(sp, s, "utf8");
console.log("style.css: vars + classes done, size:", s.length);

// ===== 2) app.js: เปลี่ยน inline style เป็นคลาส/ตัวแปร =====
const ap = "D:/folk/WebFarm/js/app.js";
let a = fs.readFileSync(ap, "utf8");
const reps = [
  // ไอคอนชิปสีฟ้า (ระบบน้ำ/แหล่งน้ำ)
  ['<div class="plot-emoji" style="background:#eff6ff;color:#1d4ed8">', '<div class="plot-emoji chip-water">'],
  ['<div class="plot-emoji" style="background:#dbeafe;color:#1e40af">', '<div class="plot-emoji chip-water">'],
  // ไอคอนราคา (เหลือง)
  ['<div class="plot-emoji" style="background:#fef9c3;color:#a16207">', '<div class="plot-emoji chip-price">'],
  ['<span class="task-ico" style="background:#dcfce7;color:#166534">', '<span class="task-ico" style="background:var(--green-light);color:var(--green-deep)">'],
  ['<span class="task-ico" style="background:#dbeafe;color:#1e40af">', '<span class="task-ico" style="background:var(--blue-light);color:var(--blue-text)">'],
  // แบนเนอร์เตือนฝน
  ['style="background:#fef3c7;color:#92400e;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:.76rem;font-weight:700"', 'class="warn-banner"'],
  // ตารางแอดมิน
  ['<th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;white-space:nowrap;font-size:.78rem;color:#374151">', '<th class="tbl-th">'],
  ['<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:.8rem;', '<td class="tbl-td" style="'],
  // กล่อง device key
  ['<div class="card" style="background:#f8fafc;font-family:monospace', '<div class="card soft-bg" style="font-family:monospace'],
  // เส้นตารางรายละเอียดแอดมิน
  ['border:1px solid #f3f4f6', 'border:1px solid var(--line)'],
  // การ์ดต้อนรับหน้าแรก (ขาวในโหมดมืด)
  ['background:linear-gradient(135deg,#f0fdf4,#ffffff)', 'background:linear-gradient(135deg,var(--green-soft),var(--card))']
];
let n = 0;
for (const [from, to] of reps) {
  const before = a;
  a = a.split(from).join(to);
  if (a !== before) n++;
}
fs.writeFileSync(ap, a, "utf8");
console.log("app.js: replaced", n, "patterns");

// ===== 3) auth.js: กล่อง device key =====
const ap2 = "D:/folk/WebFarm/js/auth.js";
let a2 = fs.readFileSync(ap2, "utf8");
const b2 = a2;
a2 = a2.split('<div class="card" style="background:#f8fafc;font-family:monospace').join('<div class="card soft-bg" style="font-family:monospace');
if (a2 !== b2) { fs.writeFileSync(ap2, a2, "utf8"); console.log("auth.js: device key box fixed"); }
