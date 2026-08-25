const fs = require("fs");

// ===== 1) charts.js: สีตัวหนังสือ/เส้นกริดอ่านค่าจาก CSS variable (รองรับ dark) =====
const cp = "D:/folk/WebFarm/js/charts.js";
let c = fs.readFileSync(cp, "utf8");
if (!c.includes("chartCol")) {
  // เพิ่ม helper หลังประกาศแรกของไฟล์
  c = c.replace(/("use strict";\s*\n)?/, `$1
/* อ่านสีจาก CSS variable — ให้กราฟสอดคล้องทั้งโหมดสว่าง/มืด */
function chartCol(name, fallback) {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; } catch (e) { return fallback; }
}
`);
  c = c.split('stroke="#94a3b8"').join('stroke="${chartCol("--muted","#94a3b8")}"');
  // บรรทัดข้างบนอยู่ใน template literal อยู่แล้ว — ใช้ ${} ได้เลย
  c = c.split('fill="#6b7280"').join('fill="${chartCol("--muted","#6b7280")}"');
  c = c.split('fill="#4b5563"').join('fill="${chartCol("--text","#4b5563")}"');
  c = c.split('fill="#111827"').join('fill="${chartCol("--text","#111827")}"');
  fs.writeFileSync(cp, c, "utf8");
  console.log("charts.js theme-aware:", (c.match(/chartCol\(/g) || []).length, "จุด");
} else console.log("charts.js already done");

// ===== 2) style.css: แก้สีแผงแจ้งเตือน + ชุด dark mode =====
const sp = "D:/folk/WebFarm/css/style.css";
let s = fs.readFileSync(sp, "utf8");
// 2a) ตัวหนังสือแผงแจ้งเตือน/โปรไฟล์ (เดิม inherit ขาวจาก topbar)
if (!s.includes(".notif-panel, .profile-panel { color: var(--text); }")) {
  s += `

/* ==================== แก้สีแผงแจ้งเตือน/โปรไฟล์ (เดิมตัวหนังสือขาวบนพื้นขาว) ==================== */
.notif-panel, .profile-panel { color: var(--text); }
.notif-panel .muted, .profile-panel .muted, .pp-email { color: var(--muted); }
.notif-head { color: var(--text); }

/* ==================== Dark Mode (สว่าง/มืด/ตามระบบ) ==================== */
html[data-theme="dark"] {
  --bg: #0e1512; --card: #18211c; --card-border: #26332c;
  --text: #e6efe9; --muted: #93a89b; --line: #26332c;
  --green-light: #143522; --green-soft: #10241a;
  --amber-light: #33270e; --red-light: #381515; --blue-light: #14213a;
  --shadow: 0 1px 2px rgba(0,0,0,.35), 0 4px 12px rgba(0,0,0,.4);
  --shadow-lg: 0 12px 28px rgba(0,0,0,.55);
  color-scheme: dark;
}
html[data-theme="dark"] body { background: var(--bg); }
html[data-theme="dark"] input, html[data-theme="dark"] select, html[data-theme="dark"] textarea { background: #101814; border-color: var(--card-border); color: var(--text); }
html[data-theme="dark"] .modal { background: var(--card); color: var(--text); box-shadow: 0 -8px 30px rgba(0,0,0,.55); }
html[data-theme="dark"] .btn-outline { background: rgba(22,163,74,.14); color: #86efac; }
html[data-theme="dark"] .role-switch button.active, html[data-theme="dark"] .tabs button.active { background: #e6efe9; color: #14532d; }
html[data-theme="dark"] .receipt { background: var(--card); }
html[data-theme="dark"] .storage-bar { background: #26332c; }
html[data-theme="dark"] .weather-card, html[data-theme="dark"] .weather-note { color: var(--text); }
html[data-theme="dark"] .notif-panel, html[data-theme="dark"] .profile-panel { background: var(--card); }
html[data-theme="dark"] .pp-theme button { background: var(--green-soft); color: var(--text); }
html[data-theme="dark"] .pp-theme button.active { background: var(--green); color: #fff; }
.pp-theme { display: flex; gap: 6px; padding: 0 12px 12px; }
.pp-theme button { flex: 1; border: 0; cursor: pointer; font: inherit; font-size: .8rem; font-weight: 700; padding: 8px 0; border-radius: 9px; background: var(--green-soft); color: var(--text); transition: all .15s; }
.pp-theme button.active { background: var(--green); color: #fff; }
`;
  fs.writeFileSync(sp, s, "utf8");
  console.log("style.css dark mode added, size:", s.length);
} else console.log("style.css already done");

// ===== 3) index.html: inline script ตั้งธีมก่อน CSS (กันแฟลชขาว) =====
const ip = "D:/folk/WebFarm/index.html";
let h = fs.readFileSync(ip, "utf8");
if (!h.includes("farmult-theme")) {
  h = h.replace(
    '  <link rel="stylesheet" href="css/style.css',
    `  <script>try{var _ft=localStorage.getItem("farmult-theme")||"system";var _fd=_ft==="dark"||(_ft==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);if(_fd)document.documentElement.setAttribute("data-theme","dark");}catch(e){}</script>
  <link rel="stylesheet" href="css/style.css`
  );
  fs.writeFileSync(ip, h, "utf8");
  console.log("index.html theme script added");
} else console.log("index.html already done");
