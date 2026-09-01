/* ---------------- ซิงก์ข้อมูลกับ Lark Base (ผ่าน Cloudflare Worker) ----------------
   App Secret เก็บไว้ฝั่ง Worker เท่านั้น ไม่หลุดมาเบราว์เซอร์
   ใช้ในหน้าตั้งค่า: ทดสอบการเชื่อมต่อ / อัปโหลด (push) / ดาวน์โหลด (pull) */
const LARK_FN = "https://farmbackup.carfork123.workers.dev";
const LARK_STOCK_SOURCE_KEY = "farmult-lark-stock-source-v1";
let larkStockSyncTimer = null;

/* เรียก Cloudflare Worker — คืน data หรือ throw พร้อมข้อความ */
async function larkCall(action, body, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || 60000;
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  let r;
  try {
    r = await fetch(LARK_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action }, body || {})),
      signal: ctl ? ctl.signal : undefined
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("ซิงก์ใช้เวลานานเกินไป ลองกดซิงก์อีกครั้งหรือเช็กจำนวนรูปใน Lark");
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw new Error((j && j.error) || "เชื่อมต่อ Cloudflare Worker ไม่ได้");
  return j.data;
}

function larkStockSource() {
  try { return JSON.parse(localStorage.getItem(LARK_STOCK_SOURCE_KEY) || "null") || {}; }
  catch (e) { return {}; }
}

function larkStockParseSource(raw) {
  const value = String(raw || "").trim();
  if (!value) return {};
  let appToken = "", tableId = "";
  try {
    const u = new URL(value);
    const m = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
    appToken = m ? m[1] : "";
    tableId = u.searchParams.get("table") || "";
  } catch (e) {
    const m = value.match(/(?:base\/)?([A-Za-z0-9]{16,})/);
    appToken = m ? m[1] : "";
    const t = value.match(/(?:table=|table_id[:=\s]+)([A-Za-z0-9]+)/);
    tableId = t ? t[1] : "";
  }
  return { raw: value, app_token: appToken, table_id: tableId };
}

function larkStockGuideHtml() {
  return `
    <div style="background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:12px;margin:12px 0">
      <div class="bold" style="margin-bottom:8px">${ic("info")} ขั้นตอนดึงข้อมูลจาก Lark</div>
      <ol style="margin:0;padding-left:20px;line-height:1.75;font-size:.84rem">
        <li>ให้ผู้กรอกสร้างหรือคัดลอก Base จากเทมเพลตสต็อกเดียวกัน</li>
        <li>ใน Lark ให้แชร์ Base นั้นให้ App/Bot ของระบบมีสิทธิ์อ่าน</li>
        <li>เปิดตารางสต็อกตามเทมเพลตที่เตรียมไว้</li>
        <li>คัดลอก URL จากแถบ address ของ Lark แล้วนำมาวางในช่อง Lark Base URL</li>
        <li>กด <b>ซิงก์ตอนนี้</b> ระบบจะดึงจำนวนที่นับและรูปถ่ายเข้าเว็บ</li>
      </ol>
      <div class="hint" style="margin-top:10px">ตัวอย่าง URL: https://...larksuite.com/base/xxxx?table=tblxxxx</div>
      <div class="hint">คอลัมน์ที่ควรมี: ชื่อสินค้า ไทย, จำนวนที่นับ, รูปถ่าย, รหัสสินค้าเดิม, หมวดสินค้า, หน่วยนับ, ขนาดสินค้า, บริษัทจำหน่าย</div>
    </div>`;
}

function larkStockStopLoading() {
  if (larkStockSyncTimer) clearInterval(larkStockSyncTimer);
  larkStockSyncTimer = null;
}

function larkStockLoading(sourceLabel) {
  larkStockStopLoading();
  const steps = [
    "กำลังเชื่อมต่อ Lark Base...",
    "กำลังอ่านรายการสต็อก...",
    "กำลังดึงไฟล์รูปถ่ายจาก Lark...",
    "กำลังบันทึกรูปขึ้นคลาวด์...",
    "กำลังอัปเดตสต็อกในเว็บ..."
  ];
  openModal(`
    <div class="lark-sync-loading">
      <div class="lark-sync-spinner" aria-hidden="true"></div>
      <h3>กำลังซิงก์สต็อกจาก Lark</h3>
      <div class="modal-sub">${esc(sourceLabel || "Base ที่เลือก")}</div>
      <div class="lark-sync-step" id="larkSyncStep">${steps[0]}</div>
      <div class="lark-sync-note">ถ้ามีรูปเยอะอาจใช้เวลาประมาณ 1-2 นาที กรุณาอย่าเพิ่งปิดหน้านี้</div>
    </div>`);
  let idx = 0;
  larkStockSyncTimer = setInterval(() => {
    idx = Math.min(idx + 1, steps.length - 1);
    const el = document.getElementById("larkSyncStep");
    if (el) el.textContent = steps[idx];
  }, 2500);
}

function larkStockSetStep(text) {
  if (larkStockSyncTimer) {
    clearInterval(larkStockSyncTimer);
    larkStockSyncTimer = null;
  }
  const el = document.getElementById("larkSyncStep");
  if (el) el.textContent = text;
}

function larkStockError(message) {
  larkStockStopLoading();
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("alert")} ซิงก์ Lark ไม่สำเร็จ</h3>
    <div class="modal-sub">${esc(message || "เกิดข้อผิดพลาดระหว่างซิงก์")}</div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px;font-size:.8rem;color:#9a3412;line-height:1.6">
      เช็กว่า Base ถูกแชร์ให้ App/Bot ของระบบแล้ว และลิงก์ที่วางเป็นลิงก์ของตารางสต็อกที่ใช้เทมเพลตเดียวกัน
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-primary" onclick="App.larkStockSync()">${ic("refresh")} ลองใหม่</button>
    </div>`);
}

/* แปลงข้อมูลทั้งหมดในแอปเป็น record สำหรับ Lark Base (1 record ต่อ 1 รายการ) */
function larkSerializeState() {
  const out = [];
  const push = (type, list) => (list || []).forEach(x => {
    out.push({ type, id: x.id, json: JSON.stringify(x), updated_at: Number(x.updatedAt) || Number(x.createdAt) || Date.now() });
  });
  push("plots", S.plots);
  push("cycles", S.cycles);
  push("tasks", S.tasks);
  push("stock", S.stock);
  push("sales", S.sales);
  push("equipment", S.equipment);
  /* ข้อมูลระบบที่ไม่ใช่รายการ (คำที่แก้ หมวดต้นทุน เมนู ลำดับหน้าแรก โหมด) */
  const misc = {};
  ["texts", "customCostCats", "customMenus", "homeOrder", "role", "version", "stockReplacedV1"].forEach(k => {
    if (S[k] !== undefined) misc[k] = S[k];
  });
  out.push({ type: "state", id: "state", json: JSON.stringify(misc), updated_at: Date.now() });
  return out;
}

/* ใช้ข้อมูลจาก Base แทนที่ข้อมูลปัจจุบัน (pull) — เก็บ adminPass/notifDismissed ที่เป็นของเครื่องไว้ */
function larkApplyPull(records) {
  const byType = {};
  (records || []).forEach(r => { (byType[r.type] = byType[r.type] || []).push(r); });
  const parse = r => { try { return JSON.parse(r.json); } catch (e) { return null; } };
  ["plots", "cycles", "tasks", "stock", "sales", "equipment"].forEach(t => {
    S[t] = (byType[t] || []).map(parse).filter(Boolean);
  });
  const st = (byType.state || []).find(r => r.id === "state");
  if (st) {
    const m = parse(st);
    if (m && typeof m === "object") Object.assign(S, m);
  }
  saveState(S);
}

/* ---- UI (ปุ่มในหน้าตั้งค่า) ---- */
App.larkTest = async function () {
  toast("กำลังทดสอบการเชื่อมต่อกับ Lark Base...");
  try {
    const d = await larkCall("status");
    toast(`เชื่อมต่อสำเร็จ — มี ${d.records} record ในตารางแล้ว`);
  } catch (e) { toast("เชื่อมต่อไม่ได้: " + e.message); }
};

App.larkPush = async function () {
  const recs = larkSerializeState();
  App.confirm("อัปโหลดข้อมูลไป Lark Base?",
    `อัปโหลด ${recs.length} รายการ (แปลง/รอบ/งาน/สต็อก/ใบเสร็จ) — ข้อมูลใน Base จะถูกอัปเดตให้ตรงกับเครื่องนี้`,
    async () => {
      toast("กำลังอัปโหลด...");
      try {
        const d = await larkCall("push", { records: recs });
        toast(`อัปโหลดสำเร็จ: เพิ่ม ${d.created} · แก้ไข ${d.updated} · ข้าม ${d.skipped} · ลบ ${d.deleted}`);
      } catch (e) { toast("อัปโหลดไม่สำเร็จ: " + e.message); }
    });
};

App.larkPull = async function () {
  App.confirm("ดาวน์โหลดข้อมูลจาก Lark Base?",
    "ข้อมูลปัจจุบันในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลใน Base ทั้งหมด — ต้องการดำเนินการต่อหรือไม่?",
    async () => {
      toast("กำลังดาวน์โหลด...");
      try {
        const d = await larkCall("pull");
        larkApplyPull(d.records || []);
        location.reload();
      } catch (e) { toast("ดาวน์โหลดไม่สำเร็จ: " + e.message); }
    });
};

App.larkStockSync = function () {
  if (typeof Auth === "undefined" || !Auth.session) {
    toast("กรุณาล็อกอินก่อนซิงก์สต็อกจาก Lark");
    return;
  }
  const cfg = larkStockSource();
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("refresh")} ซิงก์สต็อกจาก Lark</h3>
    <div class="modal-sub">ใช้สำหรับดึงข้อมูลเข้าสต็อกของบัญชีนี้เท่านั้น ถ้าจะให้บัญชีอื่นดู ให้ใช้ปุ่ม แชร์สต็อก ในหน้าสต็อกแทนการส่ง Lark Base</div>
    ${larkStockGuideHtml()}
    <div class="field">
      <label>Lark Base URL</label>
      <input id="lark_stock_url" value="${esc(cfg.raw || "")}" placeholder="https://...larksuite.com/base/...?...table=...">
      <div class="hint">ต้องแชร์ Base นี้ให้ Lark App/Bot ของระบบอ่านได้ก่อน ถ้าแอดมินผูกแหล่งของบัญชีนี้ไว้แล้วสามารถเว้นว่างและกดซิงก์ได้</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.larkStockRun()">${ic("refresh")} ซิงก์ตอนนี้</button>
    </div>`);
};

App.larkStockGuide = function () {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("info")} วิธีดึงสต็อกจาก Lark</h3>
    <div class="modal-sub">ใช้วิธีนี้แทน Excel เมื่ออยากดึงรูปถ่ายสินค้าเข้ามาด้วย</div>
    ${larkStockGuideHtml()}
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px;font-size:.8rem;color:#9a3412;line-height:1.6">
      ถ้ากดแล้วขึ้นว่าไม่มีสิทธิ์หรือไม่พบ Base ให้กลับไปที่ Lark แล้วแชร์ Base ให้ App/Bot ของระบบก่อน จากนั้นคัดลอกลิงก์ใหม่อีกครั้ง
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-primary" onclick="App.larkStockSync()">${ic("refresh")} ไปหน้าซิงก์</button>
    </div>`);
};

App.larkStockClearSource = function () {
  localStorage.removeItem(LARK_STOCK_SOURCE_KEY);
  const el = document.getElementById("lark_stock_url");
  if (el) el.value = "";
  App.larkStockRun();
};

App.larkStockRun = async function () {
  if (typeof Auth === "undefined" || !Auth.session) {
    toast("กรุณาล็อกอินก่อนซิงก์สต็อกจาก Lark");
    return;
  }
  const input = document.getElementById("lark_stock_url");
  const cfg = larkStockParseSource(input ? input.value : "");
  if (cfg.raw && !cfg.app_token) {
    toast("อ่านลิงก์ Base ไม่ได้ — ลองคัดลอก URL จากหน้า Lark Base อีกครั้ง");
    return;
  }
  if (cfg.raw) localStorage.setItem(LARK_STOCK_SOURCE_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(LARK_STOCK_SOURCE_KEY);
  larkStockLoading(cfg.raw ? "Base ที่เลือกจาก URL" : "แหล่งที่ผูกกับบัญชีนี้");
  toast("กำลังซิงก์สต็อกจาก Lark...");
  try {
    const PHOTO_LIMIT = 18;
    const MAX_BATCHES = 12;
    let offset = 0, batch = 0, last = null;
    const totalResult = { added: 0, updated: 0, skipped: 0 };
    do {
      batch++;
      larkStockSetStep(batch === 1 ? "กำลังอ่านรายการและดึงรูปชุดแรก..." : `กำลังดึงรูปชุดที่ ${batch}...`);
      last = await larkCall("stock_lark_sync", {
        token: Auth.session.token,
        app_token: cfg.app_token || "",
        table_id: cfg.table_id || "",
        photo_limit: PHOTO_LIMIT,
        photo_offset: offset
      }, { timeoutMs: 55000 });
      const part = mergeStockProducts(S, last.products || []);
      totalResult.added += part.added || 0;
      totalResult.updated += part.updated || 0;
      totalResult.skipped += part.skipped || 0;
      offset = Number(last.photo_next_offset) || 0;
      if (offset) larkStockSetStep(`ดึงรูปแล้ว ${Math.min(offset, last.photo_refs || offset)}/${last.photo_refs || offset} รูป กำลังไปต่อ...`);
    } while (offset && batch < MAX_BATCHES);
    saveState(S);
    if (typeof Auth !== "undefined" && Auth.session) Auth.saveNow();
    larkStockStopLoading();
    closeModal();
    render();
    const more = offset && last ? ` · ยังเหลือรูปประมาณ ${fmtNum(last.photo_deferred || 0)} รูป กดซิงก์อีกครั้งเพื่อเก็บต่อ` : "";
    toast(`ซิงก์ Lark สำเร็จ: ${last.products.length} รายการ · รูป ${fmtNum(Math.min(Number(last.photo_next_offset) || Number(last.photo_refs) || 0, Number(last.photo_refs) || 0))}/${fmtNum(last.photo_refs)} · เพิ่ม ${totalResult.added} · อัปเดต ${totalResult.updated}${totalResult.skipped ? ` · ไม่เปลี่ยน ${totalResult.skipped}` : ""}${more}`);
  } catch (e) {
    larkStockError(e.message);
    toast("ซิงก์ Lark ไม่สำเร็จ: " + e.message);
  }
};
