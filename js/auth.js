/* ============================================================
   FARMULTIMATE SOLUTIONS — บัญชีผู้ใช้ + ซิงก์ข้อมูลขึ้นคลาวด์ (Cloudflare D1)
   - บังคับล็อกอินก่อนใช้งาน (auth gate ครอบทั้งเว็บ)
   - ล็อกอินด้วยอีเมล+รหัสผ่าน (แฮช PBKDF2 ฝั่ง Worker)
   - แต่ละบัญชีมีข้อมูลของตัวเอง (แปลง/รอบ/งาน/สต็อก/ใบเสร็จ)
   - เก็บซ้อนใน localStorage ด้วยเสมอ → ล็อกอินค้างไว้แล้วออฟไลน์ใช้ได้ต่อ
   - บันทึกทุกครั้ง = เด้งขึ้นคลาวด์อัตโนมัติ (หน่วง 2.5 วินาทีรวบรวมก่อน)
   ============================================================ */
"use strict";

const AUTH_API = "https://farmbackup.carfork123.workers.dev";
const SESSION_KEY = "farmult-session-v1";   /* {token, email, name} */
const CLOUD_TS_KEY = "farmult-cloud-ts-v1"; /* updated_at ล่าสุดของข้อมูลบนคลาวด์ที่เคยเห็น */
const OWNER_KEY = "farmult-data-owner";     /* บัญชีเจ้าของข้อมูลที่กำลังเปิดใช้ในเครื่องนี้ */

function shareTokenFromUrl() {
  try { return String(new URL(location.href).searchParams.get("share") || "").trim(); }
  catch (e) { return ""; }
}

/* โหลดเซสชันค้างไว้จากเครื่องนี้ */
const Auth = {
  session: null,
  shareMode: shareTokenFromUrl(),
  syncing: false,
  suppress: false,
  timer: null,
  _askedThisLoad: false,
};
try { Auth.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}

/* ล็อกทันทีตั้งแต่ไฟล์นี้โหลด (ก่อน app.js render) — เครื่องที่ไม่มีเซสชันจะเห็นแต่หน้าล็อกอิน */
document.documentElement.classList.toggle("auth-locked", !(Auth.session || Auth.shareMode));

/* กันข้อความที่ผู้ใช้เคยแก้ไว้แล้วเพี้ยน (ตัวอักษรที่แสดงไม่ได้) — ลบทิ้งให้ใช้ค่าเริ่มต้น */
try {
  if (typeof S !== "undefined" && S && S.texts) {
    Object.keys(S.texts).forEach(k => {
      if (typeof S.texts[k] === "string" && /[\uFFFD\u25A1\u25AF]/.test(S.texts[k])) delete S.texts[k];
    });
  }
} catch (e) {}

function authCall(action, extra) {
  return fetch(AUTH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ action }, extra || {}))
  }).then(r => r.json()).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ต" }));
}

function setSession(s) {
  const oldEmail = Auth.session && Auth.session.email;
  Auth.session = s;
  const newEmail = s && s.email;
  if (oldEmail !== newEmail) {
    App._stockShares = { outgoing: [], incoming: [] };
    App._stockSharesLoaded = false;
    App._stockSharedCache = {};
    try { if (typeof stockViewKey !== "undefined") stockViewKey = "own"; } catch (e) {}
  }
  /* ล็อกทั้งระบบทันทีที่ระดับ DOM — ไม่ต้องรอ gate element */
  document.documentElement.classList.toggle("auth-locked", !(s || Auth.shareMode));
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}
function cloudTs() { return Number(localStorage.getItem(CLOUD_TS_KEY)) || 0; }
function setCloudTs(ts) { localStorage.setItem(CLOUD_TS_KEY, String(Number(ts) || Date.now())); }
function localHasData() {
  return (S.plots && S.plots.length) || (S.cycles && S.cycles.length) ||
         (S.tasks && S.tasks.length) || (S.stock && S.stock.length) ||
         (S.sales && S.sales.length) || (S.equipment && S.equipment.length);
}
function cloudHasContent(d) {
  return !!(d && ((d.plots && d.plots.length) || (d.cycles && d.cycles.length) ||
    (d.tasks && d.tasks.length) || (d.stock && d.stock.length) ||
    (d.sales && d.sales.length) || (d.equipment && d.equipment.length)));
}

/* ==================== แยกข้อมูลรายบัญชีในเครื่อง ====================
   แต่ละบัญชีมี storage slot ของตัวเอง: "kaset-poomjai-v51::<email>"
   - ล็อกอินบัญชีไหน = สลับเข้า slot ของบัญชีนั้นทันที (ห้ามเห็นข้ามบัญชี)
   - key รวม (STORAGE_KEY) ใช้เฉพาะตอนยังไม่มีใครล็อกอิน (ข้อมูลเดิมก่อนมีระบบบัญชี) */
function slotKey(email) { return STORAGE_KEY + "::" + String(email || "").toLowerCase(); }

function loadSlotIntoS(email) {
  try {
    const raw = localStorage.getItem(slotKey(email));
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        ensureTaskIds(s);
        ensureDefaults(s);
        s.version = 54;
        return s;
      }
    }
  } catch (e) { /* slot เสียหาย → เริ่มใหม่ */ }
  return null;
}

/* ค่าเริ่มต้นล้วน (seed) — แคชไว้ครั้งเดียว ครบทุกฟิลด์ (role/cycles/workers ฯลฯ) */
let SEED_SNAPSHOT = null;
function blankState() {
  if (!SEED_SNAPSHOT) {
    const backup = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    SEED_SNAPSHOT = loadState();
    if (backup !== null) localStorage.setItem(STORAGE_KEY, backup);
  }
  return JSON.parse(JSON.stringify(SEED_SNAPSHOT));
}

function resetSTo(newState) {
  /* ฐาน = seed ครบทุกฟิลด์ แล้วทับด้วยข้อมูลของบัญชี — กันฟิลด์ขาด (slot เก่า/คลาวด์คนละเวอร์ชัน) */
  const merged = Object.assign(blankState(), newState || {});
  try { ensureTaskIds(merged); ensureDefaults(merged); } catch (e) {}
  merged.version = 54;
  Object.keys(S).forEach(k => { delete S[k]; });
  Object.assign(S, merged);
}

/* สลับเข้า slot ของบัญชีที่เพิ่งล็อกอิน — เรียกหลัง setSession เสมอ */
Auth.switchAccount = function () {
  if (!Auth.session) return;
  const email = Auth.session.email;
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner === email) return; /* บัญชีเดิม — S ถูกต้องอยู่แล้ว */
  const cached = loadSlotIntoS(email);
  if (cached) {
    resetSTo(cached);
  } else if (!owner && localHasData()) {
    /* เครื่องยังไม่มีเจ้าของ + มีข้อมูลเดิมก่อนมีระบบบัญชี → ให้บัญชีนี้รับไป (bootCheck จะอัปขึ้นคลาวด์) */
  } else {
    resetSTo(blankState());
  }
  localStorage.setItem(OWNER_KEY, email);
  localStorage.removeItem(STORAGE_KEY); /* ปิด key รวม — กันบัญชีอื่นเห็นข้อมูลนี้ */
  saveState(S); /* เขียนลง slot ของบัญชีนี้ */
};

/* ---------- sync ---------- */
Auth.queueSave = function () {
  if (!Auth.session || Auth.suppress) return;
  clearTimeout(Auth.timer);
  Auth.timer = setTimeout(() => Auth.saveNow(), 2500);
};

Auth.saveNow = async function () {
  if (!Auth.session || Auth.syncing) return;
  Auth.syncing = true;
  try {
    const ts = Date.now();
    const r = await authCall("save", { token: Auth.session.token, data: JSON.stringify(S), updated_at: ts });
    if (r.ok) setCloudTs(ts);
  } catch (e) { /* ออฟไลน์ — รอบันทึกครั้งถัดไป */ }
  Auth.syncing = false;
};

function applyCloudState(cloudData, updatedAt) {
  Auth.suppress = true;
  resetSTo(cloudData);
  saveState(S);
  if (updatedAt) setCloudTs(updatedAt); /* กันถามซ้ำทันทีหลังโหลด */
  location.reload();
}

/* ---------- boot: เช็กคลาวด์ตอนเปิดเว็บ (มีเซสชันค้าง) ---------- */
Auth.bootCheck = async function () {
  if (!Auth.session) { Auth.showGate(); return; }
  try {
    const r = await authCall("load", { token: Auth.session.token });
    if (!r.ok) {
      if (String(r.error || "").indexOf("เซสชัน") >= 0) {
        setSession(null);
        Auth.showGate();
        toast("เซสชันหมดอายุ กรุณาล็อกอินใหม่");
      } else {
        toast(String(r.error || "เชื่อมต่อไม่ได้") + " — ใช้ข้อมูลในเครื่องชั่วคราว");
      }
      return;
    }
    const { data, updated_at } = r.data || {};
    if (!data || !cloudHasContent(data)) {
      /* คลาวด์ยังว่าง — ถ้าเครื่องนี้มีข้อมูล อัปขึ้นให้เลย (ถ้าไม่มีก็ผ่าน ห้ามวนลูป) */
      if (localHasData()) await Auth.saveNow();
      else setCloudTs(Math.max(cloudTs(), updated_at || 0));
      return;
    }
    const seenTs = cloudTs();
    if (!localHasData()) {
      /* เครื่องใหม่/ข้อมูลว่าง — ดึงจากคลาวด์เงียบ ๆ (พร้อม mark timestamp กันถามซ้ำ) */
      applyCloudState(data, updated_at);
      return;
    }
    if (updated_at > seenTs + 1000 && !Auth._askedThisLoad) {
      Auth._askedThisLoad = true;
      Auth.askMerge(data, updated_at);
      return;
    }
    setCloudTs(Math.max(seenTs, updated_at));
  } catch (e) { /* ออฟไลน์ — ใช้ข้อมูลเครื่องต่อ */ }
};

/* ข้อมูลต่างกันทั้งสองฝั่ง — ถามว่าจะเอาฝั่งไหน */
Auth.askMerge = function (cloudData, updatedAt) {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("refresh")} พบข้อมูลในคลาวด์</h3>
    <div class="modal-sub">ข้อมูลบนคลาวด์ของบัญชี ${esc(Auth.session.email)} อัปเดตล่าสุด (${dateLabel(new Date(updatedAt).toISOString().slice(0, 10))}) ไม่ตรงกับเครื่องนี้ — เลือกว่าจะใช้ชุดไหน</div>
    <div class="modal-actions" style="flex-direction:column;display:flex;gap:8px">
      <button class="btn btn-primary btn-block" onclick="Auth.choosePull()">${ic("download")} ใช้ข้อมูลจากคลาวด์ (ทับเครื่องนี้)</button>
      <button class="btn btn-outline btn-block" onclick="Auth.choosePush()">${ic("upload")} ใช้ข้อมูลเครื่องนี้ (ส่งขึ้นคลาวด์ทับ)</button>
      <button class="btn btn-ghost btn-block" onclick="App.closeModal()">ไว้ก่อน</button>
    </div>`);
};
Auth.choosePull = function () {
  closeModal();
  App.confirm("ยืนยันดึงข้อมูลจากคลาวด์?", "ข้อมูลปัจจุบันในเครื่องนี้จะถูกแทนที่ทั้งหมด", () => {
    authCall("load", { token: Auth.session.token }).then(r => {
      if (r.ok && r.data.data) { setCloudTs(r.data.updated_at); applyCloudState(r.data.data, r.data.updated_at); }
    });
  });
};
Auth.choosePush = function () {
  closeModal();
  Auth.saveNow().then(() => toast("ส่งข้อมูลเครื่องนี้ขึ้นคลาวด์แล้ว"));
};

/* ---------- core: สมัคร / ล็อกอิน (ใช้ร่วม gate และหน้าตั้งค่า) ---------- */
async function coreLogin(email, pw) {
  if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); Auth.gateMsg("กรอกอีเมลและรหัสผ่านให้ครบ"); return false; }
  toast("กำลังล็อกอิน...");
  const r = await authCall("login", { email, password: pw });
  if (!r.ok) { toast(r.error || "ล็อกอินไม่สำเร็จ"); Auth.gateMsg(r.error || "ล็อกอินไม่สำเร็จ"); return false; }
  setSession({ token: r.data.token, email: r.data.email, name: r.data.name });
  Auth.switchAccount(); /* สลับเข้า slot ข้อมูลของบัญชีนี้ — แยกจากบัญชีอื่นเด็ดขาด */
  render();
  toast("ล็อกอินสำเร็จ");
  Auth.hideGate();
  Auth._askedThisLoad = false;
  await Auth.bootCheck();
  Auth.refreshAdmin();
  return true;
}
async function coreRegister(email, pw, name) {
  if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); Auth.gateMsg("กรอกอีเมลและรหัสผ่านให้ครบ"); return false; }
  toast("กำลังสมัครบัญชี...");
  const r = await authCall("register", { email, password: pw, name });
  if (!r.ok) { toast(r.error || "สมัครไม่สำเร็จ"); Auth.gateMsg(r.error || "สมัครไม่สำเร็จ"); return false; }
  setSession({ token: r.data.token, email: r.data.email, name: r.data.name });
  Auth.switchAccount();
  render();
  toast("สมัครสำเร็จ — ข้อมูลเครื่องนี้จะถูกส่งขึ้นคลาวด์");
  Auth.hideGate();
  await Auth.saveNow();
  return true;
}

/* ปุ่มในหน้าตั้งค่า (การ์ด au_*) */
App.authLogin = async function () {
  const email = (document.getElementById("au_email")?.value || "").trim();
  const pw = document.getElementById("au_pass")?.value || "";
  await coreLogin(email, pw);
};
App.authRegister = async function () {
  const email = (document.getElementById("au_email")?.value || "").trim();
  const pw = document.getElementById("au_pass")?.value || "";
  const pw2 = document.getElementById("au_pass2")?.value || "";
  const name = (document.getElementById("au_name")?.value || "").trim();
  if (pw !== pw2) { toast("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
  await coreRegister(email, pw, name);
};

/* ---------- ประตูบังคับล็อกอิน (gate) — หน้าล็อกอินเป็น static HTML ใน index.html ----------
   auth.js หน้าที่แค่: โชว์/ซ่อน + ผูกปุ่ม + เรียก API  (ถ้า auth.js โหลดไม่ได้ gate ยังอยู่เสมอ) */
Auth.gateEl = null;

Auth.showGate = function () {
  if (Auth.shareMode) return;
  if (!Auth.gateEl) Auth.gateEl = document.getElementById("authGate");
  if (Auth.gateEl) Auth.gateEl.style.display = "flex";
};
Auth.hideGate = function () {
  if (!Auth.gateEl) Auth.gateEl = document.getElementById("authGate");
  if (Auth.gateEl) Auth.gateEl.style.display = "none";
};

Auth.gateMsg = function (msg) {
  const m = document.getElementById("ag_msg");
  if (m) m.textContent = msg || "";
};

Auth.gateMode = function (mode) {
  Auth._gateMode = mode;
  const tl = document.getElementById("ag_tab_login"), tr = document.getElementById("ag_tab_reg");
  const extra = document.getElementById("g_reg_extra"), submit = document.getElementById("ag_submit");
  if (tl) tl.classList.toggle("active", mode === "login");
  if (tr) tr.classList.toggle("active", mode === "register");
  if (extra) extra.style.display = mode === "register" ? "" : "none";
  if (submit) submit.textContent = (mode === "register" ? "สมัครบัญชีใหม่" : "ล็อกอิน");
  Auth.gateMsg("");
};

Auth.gateSubmit = async function () {
  const email = (document.getElementById("g_email")?.value || "").trim();
  const pw = document.getElementById("g_pass")?.value || "";
  if (!Auth._gateMode || Auth._gateMode === "login") {
    if (!email || !pw) { Auth.gateMsg("กรอกอีเมลและรหัสผ่านให้ครบ"); return; }
    Auth.gateMsg("กำลังล็อกอิน…");
    await coreLogin(email, pw);
  } else {
    const pw2 = document.getElementById("g_pass2")?.value || "";
    const name = (document.getElementById("g_name")?.value || "").trim();
    if (!email || !pw) { Auth.gateMsg("กรอกอีเมลและรหัสผ่านให้ครบ"); return; }
    if (pw.length < 6) { Auth.gateMsg("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (pw !== pw2) { Auth.gateMsg("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    Auth.gateMsg("กำลังสมัครบัญชี…");
    await coreRegister(email, pw, name);
  }
};

/* ผูกปุ่มของ gate (elements เป็น static HTML — มีอยู่แล้วตอนไฟล์นี้โหลด) */
(function wireGate() {
  const q = id => document.getElementById(id);
  const tl = q("ag_tab_login"), tr = q("ag_tab_reg"), sub = q("ag_submit");
  if (!tl || !sub) return;
  Auth._gateMode = "login";
  tl.addEventListener("click", () => Auth.gateMode("login"));
  tr.addEventListener("click", () => Auth.gateMode("register"));
  sub.addEventListener("click", () => Auth.gateSubmit());
  ["g_email", "g_pass", "g_pass2", "g_name"].forEach(id => {
    const i = q(id);
    if (i) i.addEventListener("keydown", e => { if (e.key === "Enter") Auth.gateSubmit(); });
  });
  /* ปุ่มโปรไฟล์มุมขวาบน + ปิดเมนูเมื่อกดนอก panel */
  const pb = q("profileBtn");
  if (pb) pb.addEventListener("click", e => { e.stopPropagation(); Auth.toggleProfile(); });
  document.addEventListener("click", e => {
    const p = q("profilePanel");
    if (p && !p.hidden && !p.contains(e.target)) Auth.closeProfile();
  });
})();

/* ---------- ออกจากระบบ / ซิงก์ปุ่มในหน้าตั้งค่า ---------- */
App.authLogout = function () {
  App.confirm("ออกจากระบบ?", "ข้อมูลของบัญชีนี้ถูกเก็บไว้ทั้งในเครื่องและบนคลาวด์ ล็อกอินกลับมาใช้ได้อีก", () => {
    if (Auth.session) authCall("logout", { token: Auth.session.token });
    setSession(null);
    /* เคลียร์ข้อมูลบัญชีนี้ออกจากหน่วยความจำ — บัญชีถัดไปต้องไม่เห็นข้อมูลซ้อน */
    resetSTo(blankState());
    localStorage.removeItem(OWNER_KEY);
    toast("ออกจากระบบแล้ว");
    Auth.showGate();
    render();
  });
};

App.authSyncNow = async function () {
  if (!Auth.session) return;
  toast("กำลังซิงก์...");
  Auth.syncing = false;
  await Auth.saveNow();
  toast("ซิงก์ขึ้นคลาวด์แล้ว ✓");
};

/* ---------- ซิงก์ระบบน้ำ (ตารางอัตโนมัติ) ขึ้นเซิร์ฟเวอร์ — cron ใช้ตัดสินใจให้น้ำ ---------- */
Auth.waterSync = async function () {
  if (!Auth.session) return null;
  const systems = (S.water.systems || []).map(sys => {
    const p = plotById(S, sys.plotId);
    return {
      id: sys.id,
      plotName: p ? p.name : "",
      name: sys.name || "",
      everyDays: (sys.auto && sys.auto.everyDays) || 2,
      time: (sys.auto && sys.auto.time) || "06:00",
      minutes: (sys.auto && sys.auto.minutes) || 30,
      enabled: !!(sys.auto && sys.auto.enabled),
      lastWatered: sys.lastWatered || "",
      lat: p ? Number(p.lat) || 0 : 0,
      lng: p ? Number(p.lng) || 0 : 0
    };
  });
  return authCall("water_sync", { token: Auth.session.token, systems });
};

/* ---------- แอดมิน: ตรวจสิทธิ์ + ดูข้อมูลทุกบัญชี ---------- */
Auth.refreshAdmin = async function () {
  if (!Auth.session) return;
  const r = await authCall("me", { token: Auth.session.token });
  if (r.ok) {
    const isAdmin = !!r.data.admin;
    if (Auth.session.admin !== isAdmin) {
      Auth.session.admin = isAdmin;
      setSession(Auth.session);
      if (typeof render === "function") render();
    }
  }
};

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function thDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  return dateLabel(d.toISOString().slice(0, 10)) + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

App.adminView = async function () {
  if (!Auth.session || !Auth.session.admin) { toast("เฉพาะผู้ดูแลระบบ"); return; }
  toast("กำลังโหลดข้อมูลทุกบัญชี...");
  const r = await authCall("admin_list", { token: Auth.session.token });
  if (!r.ok) { toast(r.error || "โหลดไม่สำเร็จ"); return; }
  Auth._adminRows = r.data;
  const rows = r.data;
  const th = (x) => `<th class="tbl-th">${x}</th>`;
  const td = (x, extra) => `<td class="tbl-td" style="${extra || ""}">${x}</td>`;
  const table = `
    <div style="overflow-x:auto;max-height:56vh;overflow-y:auto;border:1px solid var(--line);border-radius:10px">
      <table style="width:100%;border-collapse:collapse;min-width:760px">
        <thead><tr>${th("อีเมล")}${th("ชื่อ")}${th("สมัคร")}${th("เซฟล่าสุด")}${th("แปลง")}${th("รอบ")}${th("งาน")}${th("สต็อก")}${th("ใบเสร็จ")}${th("ขนาด")}${th("")}</tr></thead>
        <tbody>
          ${rows.map(x => `
          <tr>
            ${td(esc(x.email), "font-weight:700")}
            ${td(esc(x.name || "—"))}
            ${td(thDateTime(x.created_at))}
            ${td(thDateTime(x.updated_at))}
            ${td(x.summary.plots)}
            ${td(x.summary.cycles)}
            ${td(x.summary.tasks)}
            ${td(x.summary.stock)}
            ${td(x.summary.sales)}
            ${td(Math.round(x.bytes / 1024) + " KB")}
            ${td(`<button class="btn btn-sm btn-primary" onclick="App.adminDetail('${esc(x.email)}')">ดู</button>`)}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("user")} ข้อมูลทุกบัญชี (แอดมิน) — ${rows.length} บัญชี</h3>
    ${table}
    <div class="modal-actions mt-12">
      <button class="btn btn-outline" onclick="App.adminExportCsv()">${ic("download")} ส่งออก CSV (สรุป)</button>
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};

App.adminExportCsv = function () {
  const rows = Auth._adminRows || [];
  const head = ["อีเมล", "ชื่อ", "สมัครเมื่อ", "เซฟล่าสุด", "แปลง", "รอบปลูก", "งาน", "สต็อก", "ใบเสร็จ", "ขนาดไบต์"];
  const lines = [head.join(",")].concat(rows.map(x => [
    x.email, x.name || "", thDateTime(x.created_at), thDateTime(x.updated_at),
    x.summary.plots, x.summary.cycles, x.summary.tasks, x.summary.stock, x.summary.sales, x.bytes
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")));
  downloadBlob("farmultimate-accounts-" + todayISO() + ".csv", new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  toast("ดาวน์โหลด CSV แล้ว");
};

App.adminDetail = async function (email) {
  toast("กำลังโหลดข้อมูลของ " + email + "...");
  const r = await authCall("admin_get", { token: Auth.session.token, email });
  if (!r.ok) { toast(r.error || "โหลดไม่สำเร็จ"); return; }
  const s = r.data.data || {};
  const sec = (title, items) => `
    <div style="margin-bottom:12px">
      <div style="font-weight:800;font-size:.85rem;margin-bottom:4px">${title} (${items.length})</div>
      ${items.length === 0 ? `<div class="muted" style="font-size:.76rem">— ไม่มีข้อมูล —</div>` :
      `<div style="max-height:150px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:.78rem">${items.map(i => `<div style="padding:2px 0">${i}</div>`).join("")}</div>`}
    </div>`;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${esc(email)} ${r.data.name ? "(" + esc(r.data.name) + ")" : ""}</h3>
    <div class="modal-sub">เซฟล่าสุด: ${thDateTime(r.data.updated_at)}</div>
    ${sec("แปลง", (s.plots || []).map(p => esc(p.name) + " — " + (p.sizeRai || 0) + " ไร่"))}
    ${sec("รอบปลูก", (s.cycles || []).map(c => esc(c.plant || "-") + " (เริ่ม " + (c.startDate || "-") + ")"))}
    ${sec("งาน", (s.tasks || []).map(t => "[" + (t.status === "done" ? "เสร็จ" : "แผน") + "] " + esc(t.title) + " (" + (t.date || "-") + ")"))}
    ${sec("สต็อกสินค้า", (s.stock || []).map(st => esc(st.name) + " — เหลือ " + (st.qty || 0) + " " + esc(st.unit || "")))}
    ${sec("ใบเสร็จขาย", (s.sales || []).map(x => esc(x.no || x.id || "-") + " — " + (x.total || 0) + " บาท"))}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="App.adminDownloadJson('${esc(email)}')">${ic("download")} ดาวน์โหลด JSON (ข้อมูลเต็ม)</button>
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};

App.adminDownloadJson = async function (email) {
  const r = await authCall("admin_get", { token: Auth.session.token, email });
  if (!r.ok) { toast(r.error || "โหลดไม่สำเร็จ"); return; }
  downloadBlob("farmultimate-" + email.replace(/[^a-z0-9]/gi, "_") + "-" + todayISO() + ".json",
    new Blob([JSON.stringify({ app: "farmultimate-solutions", type: "backup", version: 54, exportedAt: new Date().toISOString(), data: r.data.data }, null, 2)], { type: "application/json" }));
  toast("ดาวน์โหลด JSON แล้ว");
};

/* ---------- ธีม: สว่าง / มืด / ตามระบบ / ตามเวลา (18:00-06:00 มืด) ---------- */
Auth.applyTheme = function () {
  let mode = "system";
  try { mode = localStorage.getItem("farmult-theme") || "system"; } catch (e) {}
  let dark;
  if (mode === "dark") dark = true;
  else if (mode === "auto") {
    const h = new Date().getHours();
    dark = h >= 18 || h < 6; /* 18:00-06:00 = มืด */
  } else {
    dark = mode === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  return mode;
};
/* โหมด "ตามเวลา": เช็กทุกนาที สลับเองเมื่อขึ้น-ตกดิน */
setInterval(() => {
  try { if ((localStorage.getItem("farmult-theme") || "system") === "auto") Auth.applyTheme(); } catch (e) {}
}, 60000);
Auth.getTheme = function () {
  try { return localStorage.getItem("farmult-theme") || "system"; } catch (e) { return "system"; }
};
Auth.setTheme = function (mode) {
  try { localStorage.setItem("farmult-theme", mode); } catch (e) {}
  Auth.applyTheme();
  render();
  toast(mode === "dark" ? "🌙 โหมดมืด" : mode === "light" ? "☀️ โหมดสว่าง" : mode === "auto" ? "⏰ สลับเองตามเวลา (มืด 18:00-06:00)" : "🖥️ ตามระบบเครื่อง");
};
try {
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => Auth.applyTheme());
} catch (e) {}
Auth.applyTheme();

/* ---------- เมนูโปรไฟล์ (ปุ่มมุมขวาบน) ---------- */
Auth.closeProfile = function () {
  const p = document.getElementById("profilePanel");
  if (p) p.hidden = true;
};
Auth.toggleProfile = function () {
  const p = document.getElementById("profilePanel");
  if (!p) return;
  if (p.hidden) { Auth.fillProfilePanel(); p.hidden = false; }
  else p.hidden = true;
};
Auth.fillProfilePanel = function () {
  const p = document.getElementById("profilePanel");
  if (!p || !Auth.session) return;
  const s = Auth.session;
  p.innerHTML = `
    <div class="pp-head">
      <div class="pp-avatar">${ic("user")}</div>
      <div class="pp-info">
        <div class="pp-name">${esc(s.name || s.email)}</div>
        <div class="pp-email">${esc(s.email)}</div>
        ${s.admin ? `<span class="badge badge-green">ผู้ดูแลระบบ</span>` : ""}
      </div>
    </div>
    <div class="pp-actions">
      ${s.admin ? `<button class="btn btn-primary btn-block" onclick="Auth.closeProfile();App.adminView()">${ic("user")} ดูข้อมูลทุกบัญชี</button>` : ""}
      <button class="btn btn-outline btn-block" onclick="Auth.closeProfile();App.authSyncNow()">${ic("refresh")} ซิงก์ขึ้นคลาวด์</button>
      <button class="btn btn-danger-soft btn-block" onclick="Auth.closeProfile();App.authLogout()">${ic("lock")} ออกจากระบบ</button>
    </div>
    <div class="pp-theme">
      <button class="${Auth.getTheme() === "light" ? "active" : ""}" onclick="Auth.setTheme('light')" title="โหมดสว่างตลอด">☀️ สว่าง</button>
      <button class="${Auth.getTheme() === "dark" ? "active" : ""}" onclick="Auth.setTheme('dark')" title="โหมดมืดตลอด">🌙 มืด</button>
      <button class="${Auth.getTheme() === "system" ? "active" : ""}" onclick="Auth.setTheme('system')" title="ตามค่าที่ตั้งในเครื่อง">🖥️ ระบบ</button>
      <button class="${Auth.getTheme() === "auto" ? "active" : ""}" onclick="Auth.setTheme('auto')" title="สว่างกลางวัน มืดหลัง 18:00">⏰ เวลา</button>
    </div>`;
};

/* ---------- UI: การ์ดบัญชีในหน้าตั้งค่า ---------- */
Auth.cardHtml = function () {
  return `
  <div class="section-title">${ic("user")} บัญชีผู้ใช้ / ซิงก์คลาวด์ ${Auth.session ? `<span class="badge badge-green">เชื่อมต่อแล้ว</span>` : ""}</div>
  <div class="card">
    ${Auth.session ? `
      <div class="row row-between"><span class="muted">อีเมล</span><span class="small bold">${esc(Auth.session.email)}</span></div>
      ${Auth.session.name ? `<div class="row row-between mt-8"><span class="muted">ชื่อ</span><span class="small bold">${esc(Auth.session.name)}</span></div>` : ""}
      <div class="muted mt-8" style="font-size:.72rem">${ic("info")} ทุกครั้งที่บันทึกงาน ระบบจะส่งขึ้นคลาวด์ให้อัตโนมัติ${Auth.session.admin ? " · เมนูผู้ดูแลระบบอยู่ที่ไอคอนโปรไฟล์มุมขวาบน" : ""}</div>
      <button class="btn btn-primary btn-block mt-12" onclick="App.authSyncNow()">${ic("refresh")} ซิงก์ขึ้นคลาวด์ตอนนี้</button>
      <button class="btn btn-danger-soft btn-block mt-8" onclick="App.authLogout()">${ic("lock")} ออกจากระบบ</button>
    ` : `
      <div class="field"><label>อีเมล</label><input id="au_email" type="email" autocomplete="email"></div>
      <div class="field"><label>รหัสผ่าน</label><input id="au_pass" type="password" autocomplete="current-password"></div>
      <div class="field"><label>ยืนยันรหัสผ่าน (สมัครใหม่)</label><input id="au_pass2" type="password"></div>
      <div class="field"><label>ชื่อ-นามสกุล (ไม่บังคับ)</label><input id="au_name"></div>
      <button class="btn btn-primary btn-block mt-8" onclick="App.authLogin()">${ic("unlock")} ล็อกอิน</button>
      <button class="btn btn-outline btn-block mt-8" onclick="App.authRegister()">${ic("plus")} สมัครบัญชีใหม่</button>
    `}
  </div>`;
};

/* ---------- hook: saveState เขียนลง slot ของบัญชีที่ล็อกอิน (แยกข้อมูลรายบัญชี) ---------- */
(function () {
  const orig = saveState;
  saveState = function (s) {
    const key = Auth.session ? slotKey(Auth.session.email) : STORAGE_KEY;
    try {
      localStorage.setItem(key, JSON.stringify(s));
      storageSaveFailed = false;
    } catch (e) {
      storageSaveFailed = true;
      setTimeout(function () {
        try { toast("⚠️ พื้นที่จัดเก็บเต็ม! ข้อมูลล่าสุดอาจไม่ถูกบันทึก — ไปที่ ตั้งค่า เพื่อสำรอง/จัดการพื้นที่"); } catch (e2) {}
      }, 0);
    }
    Auth.queueSave();
  };
})();

/* รีเซ็ตข้อมูล: เคลียร์ key รวม + slot ของบัญชี (ไม่แตะคลาวด์ — ดึงกลับจากคลาวด์ได้) */
App.resetData = function () {
  App.confirm("รีเซ็ตข้อมูลทั้งหมด?", "ข้อมูลที่บันทึกไว้ในเครื่องนี้จะถูกล้างให้ว่างเปล่า (ข้อมูลบนคลาวด์ของบัญชียังอยู่ — กดดาวน์โหลดจากคลาวด์เพื่อกู้คืน) ต้องการดำเนินการต่อหรือไม่?", () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    if (Auth.session) { try { localStorage.removeItem(slotKey(Auth.session.email)); } catch (e) {} }
    location.reload();
  });
};

/* เริ่มระบบ: ไม่มีเซสชัน = โชว์ประตูทันที (static gate — ปลอดภัยแม้ไฟล์อื่นโหลดไม่ครบ)
   มีเซสชัน = สลับเข้า slot ของบัญชีนั้นก่อน render (auth.js โหลดก่อน app.js) แล้วค่อยตรวจคลาวด์ */
if (Auth.shareMode) {
  document.documentElement.classList.remove("auth-locked");
  Auth.hideGate();
} else if (Auth.session) {
  const __cached = loadSlotIntoS(Auth.session.email);
  if (__cached) resetSTo(__cached);
  localStorage.removeItem(STORAGE_KEY); /* ขณะล็อกอิน ข้อมูลอยู่ใน slot ของบัญชีเท่านั้น */
  localStorage.setItem(OWNER_KEY, Auth.session.email);
  setTimeout(() => { Auth.bootCheck(); Auth.refreshAdmin(); }, 400);
} else {
  Auth.showGate();
}
