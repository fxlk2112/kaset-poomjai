/* ============================================================
   FARMULTIMATE SOLUTIONS — บัญชีผู้ใช้ + ซิงก์ข้อมูลขึ้นคลาวด์ (Cloudflare D1)
   - ล็อกอินด้วยอีเมล+รหัสผ่าน (แฮช PBKDF2 ฝั่ง Worker)
   - แต่ละบัญชีมีข้อมูลของตัวเอง (แปลง/รอบ/งาน/สต็อก/ใบเสร็จ)
   - เก็บซ้อนใน localStorage ด้วยเสมอ → ใช้แบบออฟไลน์ได้เหมือนเดิม
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
};
try { Auth.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}

function authCall(action, extra) {
  return fetch(AUTH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ action }, extra || {}))
  }).then(r => r.json()).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }));
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

function applyCloudState(cloudData) {
  Auth.suppress = true;
  Object.assign(S, cloudData || {});
  saveState(S);
  setTimeout(() => { Auth.suppress = false; }, 100);
  location.reload();
}

/* ---------- boot: เช็กคลาวด์ตอนเปิดเว็บ (มีเซสชันค้าง) ---------- */
Auth.bootCheck = async function () {
  if (!Auth.session) return;
  try {
    const r = await authCall("load", { token: Auth.session.token });
    if (!r.ok) {
      /* เซสชันหมดอายุ/ไม่ถูกต้อง */
      if (String(r.error || "").indexOf("เซสชัน") >= 0) {
        setSession(null);
        toast("เซสชันหมดอายุ กรุณาล็อกอินใหม่");
      }
      return;
    }
    const { data, updated_at } = r.data || {};
    if (!data) {
      /* คลาวด์ยังว่าง — ถ้าเครื่องนี้มีข้อมูล อัปขึ้นให้เลย */
      if (localHasData()) await Auth.saveNow();
      return;
    }
    const seenTs = cloudTs();
    if (!localHasData()) {
      /* เครื่องใหม่/ข้อมูลว่าง — ดึงจากคลาวด์เงียบ ๆ */
      applyCloudState(data);
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
      if (r.ok && r.data.data) { setCloudTs(r.data.updated_at); applyCloudState(r.data.data); }
    });
  });
};
Auth.choosePush = function () {
  closeModal();
  Auth.saveNow().then(() => toast("ส่งข้อมูลเครื่องนี้ขึ้นคลาวด์แล้ว"));
};

/* ---------- สมัคร / ล็อกอิน / ออกจากระบบ ---------- */
App.authRegister = async function () {
  const email = (document.getElementById("au_email")?.value || "").trim();
  const pw = document.getElementById("au_pass")?.value || "";
  const pw2 = document.getElementById("au_pass2")?.value || "";
  const name = (document.getElementById("au_name")?.value || "").trim();
  if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); return; }
  if (pw !== pw2) { toast("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
  toast("กำลังสมัครบัญชี...");
  const r = await authCall("register", { email, password: pw, name });
  if (!r.ok) { toast(r.error || "สมัครไม่สำเร็จ"); return; }
  setSession({ token: r.data.token, email: r.data.email, name: r.data.name });
  closeModal(); render();
  toast("สมัครสำเร็จ");
  await Auth.saveNow();
  setCloudTs(Date.now());
};

App.authLogin = async function () {
  const email = (document.getElementById("au_email")?.value || "").trim();
  const pw = document.getElementById("au_pass")?.value || "";
  if (!email || !pw) { toast("กรอกอีเมลและรหัสผ่านให้ครบ"); return; }
  toast("กำลังล็อกอิน...");
  const r = await authCall("login", { email, password: pw });
  if (!r.ok) { toast(r.error || "ล็อกอินไม่สำเร็จ"); return; }
  setSession({ token: r.data.token, email: r.data.email, name: r.data.name });
  closeModal(); render();
  toast("ล็อกอินสำเร็จ");
  await Auth.bootCheck();
};

App.authLogout = function () {
  App.confirm("ออกจากระบบ?", "ข้อมูลยังอยู่ในเครื่องนี้ และบนคลาวด์ของบัญชีคุณ", () => {
    if (Auth.session) authCall("logout", { token: Auth.session.token });
    setSession(null);
    toast("ออกจากระบบแล้ว");
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

/* ---------- UI: การ์ดบัญชีในหน้าตั้งค่า ---------- */
Auth.cardHtml = function () {
  if (!Auth.session) {
    return `
    <div class="section-title">${ic("user")} บัญชีผู้ใช้ / ซิงก์คลาวด์ <span class="badge badge-blue">ใช้ได้หลายเครื่อง</span></div>
    <div class="card">
      <div class="muted" style="font-size:.76rem;margin-bottom:10px">มีบัญชีเดียว เก็บข้อมูลไว้บนคลาวด์ — เปิดเครื่องไหนก็เห็นข้อมูลเดียวกัน พร้อมใช้แบบออฟไลน์เหมือนเดิม</div>
      <div class="field"><label>อีเมล</label><input id="au_email" type="email" placeholder="you@example.com" autocomplete="email"></div>
      <div class="field"><label>รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><input id="au_pass" type="password" autocomplete="current-password"></div>
      <div class="field"><label>ยืนยันรหัสผ่าน (สำหรับสมัครใหม่)</label><input id="au_pass2" type="password"></div>
      <div class="field"><label>ชื่อ-นามสกุล (ไม่บังคับ — สำหรับสมัครใหม่)</label><input id="au_name"></div>
      <button class="btn btn-primary btn-block mt-8" onclick="App.authLogin()">${ic("unlock")} ล็อกอิน</button>
      <button class="btn btn-outline btn-block mt-8" onclick="App.authRegister()">${ic("plus")} สมัครบัญชีใหม่</button>
    </div>`;
  }
  return `
  <div class="section-title">${ic("user")} บัญชีผู้ใช้ / ซิงก์คลาวด์ <span class="badge badge-green">เชื่อมต่อแล้ว</span></div>
  <div class="card">
    <div class="row row-between"><span class="muted">อีเมล</span><span class="small bold">${esc(Auth.session.email)}</span></div>
    ${Auth.session.name ? `<div class="row row-between mt-8"><span class="muted">ชื่อ</span><span class="small bold">${esc(Auth.session.name)}</span></div>` : ""}
    <div class="muted mt-8" style="font-size:.72rem">${ic("info")} ทุกครั้งที่บันทึกงาน ระบบจะส่งขึ้นคลาวด์ให้อัตโนมัติ</div>
    <button class="btn btn-primary btn-block mt-12" onclick="App.authSyncNow()">${ic("refresh")} ซิงก์ขึ้นคลาวด์ตอนนี้</button>
    <button class="btn btn-danger-soft btn-block mt-8" onclick="App.authLogout()">${ic("lock")} ออกจากระบบ</button>
  </div>`;
};

/* ---------- hook: saveState ทุกครั้ง = เด้งซิงก์ ---------- */
(function () {
  const orig = saveState;
  window.__origSaveState = orig;
  saveState = function (s) {
    orig(s);
    Auth.queueSave();
  };
})();

/* เริ่มตรวจคลาวด์หลังแอปโหลดเสร็จ */
setTimeout(() => Auth.bootCheck(), 400);
