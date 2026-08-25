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

/* โหลดเซสชันค้างไว้จากเครื่องนี้ */
const Auth = {
  session: null,
  syncing: false,
  suppress: false,
  timer: null,
  _askedThisLoad: false,
};
try { Auth.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}

function authCall(action, extra) {
  return fetch(AUTH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ action }, extra || {}))
  }).then(r => r.json()).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ต" }));
}

function setSession(s) {
  Auth.session = s;
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
  Object.assign(S, cloudData || {});
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
  if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); return false; }
  toast("กำลังล็อกอิน...");
  const r = await authCall("login", { email, password: pw });
  if (!r.ok) { toast(r.error || "ล็อกอินไม่สำเร็จ"); return false; }
  setSession({ token: r.data.token, email: r.data.email, name: r.data.name });
  render();
  toast("ล็อกอินสำเร็จ");
  Auth.hideGate();
  Auth._askedThisLoad = false;
  await Auth.bootCheck();
  return true;
}
async function coreRegister(email, pw, name) {
  if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); return false; }
  toast("กำลังสมัครบัญชี...");
  const r = await authCall("register", { email, password: pw, name });
  if (!r.ok) { toast(r.error || "สมัครไม่สำเร็จ"); return false; }
  setSession({ token: r.data.token, email: r.data.email, name: r.data.name });
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

/* ---------- ประตูบังคับล็อกอิน (gate) ---------- */
Auth.gateEl = null;

Auth.showGate = function () {
  if (!Auth.gateEl) Auth.buildGate();
  Auth.gateEl.style.display = "flex";
};
Auth.hideGate = function () {
  if (Auth.gateEl) Auth.gateEl.style.display = "none";
};

Auth.buildGate = function () {
  const el = document.createElement("div");
  el.id = "authGate";
  el.innerHTML = `
    <div class="auth-box">
      <div class="auth-brand">
        <img src="logo.jpg" alt="" onerror="this.style.display='none'">
        <div class="auth-brand-name">FARMULTIMATE SOLUTIONS</div>
        <div class="auth-brand-sub">ระบบจัดการฟาร์มอัจฉริยะ</div>
      </div>
      <div class="auth-tabs">
        <button id="ag_tab_login" class="active" onclick="Auth.gateMode('login')">ล็อกอิน</button>
        <button id="ag_tab_reg" onclick="Auth.gateMode('register')">สมัครใหม่</button>
      </div>
      <div class="field"><label>อีเมล</label><input id="g_email" type="email" placeholder="you@example.com" autocomplete="email"></div>
      <div class="field"><label>รหัสผ่าน</label><input id="g_pass" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" autocomplete="current-password"></div>
      <div id="g_reg_extra" style="display:none">
        <div class="field"><label>ยืนยันรหัสผ่าน</label><input id="g_pass2" type="password" autocomplete="new-password"></div>
        <div class="field"><label>ชื่อ-นามสกุล (ไม่บังคับ)</label><input id="g_name"></div>
      </div>
      <button class="btn btn-primary btn-block mt-8" id="ag_submit" onclick="Auth.gateSubmit()">${ic("unlock")} ล็อกอิน</button>
      <div class="auth-hint">ข้อมูลของแต่ละบัญชีแยกกัน และซิงก์ขึ้นคลาวด์อัตโนมัติ<br>เปิดได้ทุกเครื่อง · ใช้แบบออฟไลน์ได้หลังล็อกอิน</div>
    </div>`;
  document.body.appendChild(el);
  Auth.gateEl = el;
  /* Enter ในช่องกรอก = กดปุ่ม */
  ["g_email", "g_pass", "g_pass2", "g_name"].forEach(id => {
    const inp = el.querySelector("#" + id);
    if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") Auth.gateSubmit(); });
  });
};

Auth.gateMode = function (mode) {
  Auth._gateMode = mode;
  const tl = document.getElementById("ag_tab_login"), tr = document.getElementById("ag_tab_reg");
  const extra = document.getElementById("g_reg_extra"), submit = document.getElementById("ag_submit");
  if (tl) tl.classList.toggle("active", mode === "login");
  if (tr) tr.classList.toggle("active", mode === "register");
  if (extra) extra.style.display = mode === "register" ? "" : "none";
  if (submit) submit.innerHTML = (mode === "register" ? ic("plus") + " สมัครบัญชีใหม่" : ic("unlock") + " ล็อกอิน");
};

Auth.gateSubmit = async function () {
  const email = (document.getElementById("g_email")?.value || "").trim();
  const pw = document.getElementById("g_pass")?.value || "";
  if (!Auth._gateMode || Auth._gateMode === "login") {
    await coreLogin(email, pw);
  } else {
    const pw2 = document.getElementById("g_pass2")?.value || "";
    const name = (document.getElementById("g_name")?.value || "").trim();
    if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); return; }
    if (pw.length < 6) { toast("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (pw !== pw2) { toast("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    await coreRegister(email, pw, name);
  }
};

/* ---------- ออกจากระบบ / ซิงก์ปุ่มในหน้าตั้งค่า ---------- */
App.authLogout = function () {
  App.confirm("ออกจากระบบ?", "ข้อมูลยังอยู่บนคลาวด์ของบัญชีคุณ ล็อกอินกลับมาใช้ได้อีก", () => {
    if (Auth.session) authCall("logout", { token: Auth.session.token });
    setSession(null);
    toast("ออกจากระบบแล้ว");
    Auth.showGate();
  });
};

App.authSyncNow = async function () {
  if (!Auth.session) return;
  toast("กำลังซิงก์...");
  Auth.syncing = false;
  await Auth.saveNow();
  toast("ซิงก์ขึ้นคลาวด์แล้ว ✓");
};

/* ---------- UI: การ์ดบัญชีในหน้าตั้งค่า ---------- */
Auth.cardHtml = function () {
  return `
  <div class="section-title">${ic("user")} บัญชีผู้ใช้ / ซิงก์คลาวด์ ${Auth.session ? `<span class="badge badge-green">เชื่อมต่อแล้ว</span>` : ""}</div>
  <div class="card">
    ${Auth.session ? `
      <div class="row row-between"><span class="muted">อีเมล</span><span class="small bold">${esc(Auth.session.email)}</span></div>
      ${Auth.session.name ? `<div class="row row-between mt-8"><span class="muted">ชื่อ</span><span class="small bold">${esc(Auth.session.name)}</span></div>` : ""}
      <div class="muted mt-8" style="font-size:.72rem">${ic("info")} ทุกครั้งที่บันทึกงาน ระบบจะส่งขึ้นคลาวด์ให้อัตโนมัติ</div>
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

/* ---------- hook: saveState ทุกครั้ง = เด้งซิงก์ ---------- */
(function () {
  const orig = saveState;
  saveState = function (s) {
    orig(s);
    Auth.queueSave();
  };
})();

/* เริ่มระบบ: ไม่มีเซสชัน = โชว์ประตูทันที / มี = ปล่อยเข้า + ตรวจคลาวด์
   (เลื่อนไป setTimeout เพราะ buildGate ใช้ ic() จาก app.js ที่โหลดทีหลังไฟล์นี้) */
setTimeout(() => {
  if (Auth.session) Auth.bootCheck();
  else Auth.showGate();
}, 0);
