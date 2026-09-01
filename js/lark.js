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
    <div class="lark-sync-loading modal-lock-backdrop">
      <div class="lark-sync-spinner" aria-hidden="true"></div>
      <h3>กำลังซิงก์สต็อกจาก Lark</h3>
      <div class="modal-sub">${esc(sourceLabel || "Base ที่เลือก")}</div>
      <div class="lark-sync-progress" aria-label="ความคืบหน้าการซิงก์">
        <div class="lark-sync-progress-top">
          <span id="larkSyncProgressText">เริ่มซิงก์</span>
          <b id="larkSyncProgressPct">5%</b>
        </div>
        <div class="lark-sync-progress-track"><div id="larkSyncProgressBar" style="width:5%"></div></div>
      </div>
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

function larkStockSetProgress(done, total, text) {
  const d = Math.max(Number(done) || 0, 0);
  const t = Math.max(Number(total) || 0, 0);
  const pct = t ? Math.min(100, Math.max(1, Math.round((d / t) * 100))) : Math.min(95, Math.max(5, Math.round(d) || 5));
  const bar = document.getElementById("larkSyncProgressBar");
  const pctEl = document.getElementById("larkSyncProgressPct");
  const txtEl = document.getElementById("larkSyncProgressText");
  if (bar) bar.style.width = pct + "%";
  if (pctEl) pctEl.textContent = pct + "%";
  if (txtEl) txtEl.textContent = text || (t ? `รูป ${fmtNum(d)}/${fmtNum(t)}` : "กำลังเตรียมข้อมูล");
}

function larkStockSetStep(text) {
  if (larkStockSyncTimer) {
    clearInterval(larkStockSyncTimer);
    larkStockSyncTimer = null;
  }
  const el = document.getElementById("larkSyncStep");
  if (el) el.textContent = text;
}

function larkStockKeyOf(x) {
  return (x.name || x.productName || "").trim().toLowerCase() + "|" +
    (x.size || "") + "|" + ((x.unit || "").trim() || "ชิ้น") + "|" + (x.supplier || x.company || "");
}

function larkJsArg(v) {
  return JSON.stringify(String(v == null ? "" : v)).replace(/</g, "\\u003c");
}
function larkJsAttr(code) {
  return esc(String(code || ""));
}

function larkStockPhotosOf(x) {
  return (Array.isArray(x && x.photos) ? x.photos : (x && x.photo ? [x.photo] : []))
    .map(p => String(p || "").trim()).filter(Boolean);
}

function larkStockFindExisting(p) {
  const key = larkStockKeyOf(p);
  return (S.stock || []).find(x => larkStockKeyOf(x) === key) || null;
}

function larkStockSamePhotos(a, b) {
  const aa = larkStockPhotosOf(a);
  const bb = larkStockPhotosOf(b);
  return aa.length === bb.length && aa.every((p, i) => p === bb[i]);
}

function larkStockRememberProducts(map, products) {
  (products || []).forEach(p => {
    const key = larkStockKeyOf(p);
    if (!key || key === "|||") return;
    const old = map.get(key);
    const photos = [...(old ? larkStockPhotosOf(old) : []), ...larkStockPhotosOf(p)]
      .filter((v, i, arr) => v && arr.indexOf(v) === i);
    map.set(key, Object.assign({}, old || {}, p, {
      photo: photos[0] || "",
      photos,
      appendPhotos: false
    }));
  });
}

function larkStockSplitPhotoConflicts(products) {
  const clean = [], conflicts = [];
  (products || []).forEach(p => {
    const old = larkStockFindExisting(p);
    const webPhotos = larkStockPhotosOf(old);
    const larkPhotos = larkStockPhotosOf(p);
    if (old && webPhotos.length && larkPhotos.length && !larkStockSamePhotos(old, p)) {
      conflicts.push({
        key: larkStockKeyOf(p), id: old.id, code: p.code || old.code || "",
        name: p.name || old.name, generic: p.generic || old.generic || "",
        category: p.category || old.category || "", size: p.size || old.size || "",
        unit: p.unit || old.unit || "", supplier: p.supplier || old.supplier || "",
        webPhotos, larkPhotos
      });
      clean.push(Object.assign({}, p, { photo: "", photos: [] }));
      return;
    }
    clean.push(p);
  });
  return { clean, conflicts };
}

function larkStockApplyPhotoChoice(conflicts, decisions) {
  let changed = 0;
  (conflicts || []).forEach(c => {
    const useLark = decisions && decisions[c.key] === "lark";
    if (!useLark) return;
    const item = (S.stock || []).find(x => x.id === c.id) || null;
    if (!item) return;
    item.photos = [...c.larkPhotos];
    item.photo = item.photos[0] || "";
    changed++;
  });
  return changed;
}

function larkStockConflictModalHtml() {
  const pending = App._larkStockPhotoPending || {};
  const conflicts = pending.conflicts || [];
  const query = String(pending.query || "").trim().toLowerCase();
  const filter = pending.filter || "all";
  const visible = conflicts.filter(c => {
    const picked = (pending.decisions && pending.decisions[c.key]) || "web";
    if (filter !== "all" && picked !== filter) return false;
    if (!query) return true;
    const hay = [c.name, c.code, c.generic, c.category, c.size, c.unit, c.supplier].join(" ").toLowerCase();
    return hay.includes(query);
  });
  const chip = (key, label) => `<button class="chip ${filter === key ? "chip-active" : ""}" onclick="App.larkStockPhotoFilter('${key}')">${label}</button>`;
  const rows = visible.map((c, i) => {
    const picked = (pending.decisions && pending.decisions[c.key]) || "web";
    const thumbs = arr => arr.slice(0, 4).map(p => `<img src="${esc(stockPhotoSrc({ photo: p }))}" alt="" loading="lazy" onerror="this.remove()">`).join("") || `<span class="muted">ไม่มีรูป</span>`;
    return `
      <div class="lark-photo-conflict">
        <div class="lpc-head">
          <div>
            <div class="bold">${esc(c.name)}</div>
            <div class="muted">${c.code ? "รหัส " + esc(c.code) + " · " : ""}${c.category ? esc(c.category) + " · " : ""}${c.size ? esc(c.size) + " · " : ""}${esc(c.unit || "")}${c.supplier ? " · " + esc(c.supplier) : ""}</div>
          </div>
          <span class="badge badge-amber">รูปไม่ตรง</span>
        </div>
        <div class="lpc-choices">
          <label class="${picked === "web" ? "selected" : ""}">
            <input type="radio" name="lpc_${i}" ${picked === "web" ? "checked" : ""} onchange="${larkJsAttr(`App.larkStockPhotoPick(${larkJsArg(c.key)},"web")`)}">
            <span>ใช้รูปเว็บ</span>
            <div class="lpc-thumbs">${thumbs(c.webPhotos)}</div>
          </label>
          <label class="${picked === "lark" ? "selected" : ""}">
            <input type="radio" name="lpc_${i}" ${picked === "lark" ? "checked" : ""} onchange="${larkJsAttr(`App.larkStockPhotoPick(${larkJsArg(c.key)},"lark")`)}">
            <span>ใช้รูป Lark</span>
            <div class="lpc-thumbs">${thumbs(c.larkPhotos)}</div>
          </label>
        </div>
      </div>`;
  }).join("");
  return `
    <button class="modal-x" onclick="App.larkStockPhotoCancel()">✕</button>
    <h3>${ic("image")} เจอรูปที่ไม่ตรงกัน</h3>
    <div class="modal-sub">ข้อมูลและจำนวนซิงก์เสร็จแล้ว เลือกรูปที่จะเก็บไว้สำหรับ ${fmtNum(conflicts.length)} รายการ</div>
    <div class="lpc-tools">
      <div class="stock-search lpc-search">
        ${ic("search")}
        <input type="text" value="${esc(pending.query || "")}" placeholder="ค้นหาชื่อสินค้า รหัส หมวด บริษัท..." oninput="App.larkStockPhotoSearch(this.value)">
        ${pending.query ? `<button class="stock-search-clear" onclick="App.larkStockPhotoSearch('')">✕</button>` : ""}
      </div>
      <div class="lpc-filter-row">
        <div class="stock-tabs">
          ${chip("all", "ทั้งหมด")}
          ${chip("web", "เลือกเว็บ")}
          ${chip("lark", "เลือก Lark")}
        </div>
        <span class="muted">พบ ${fmtNum(visible.length)}/${fmtNum(conflicts.length)} รายการ</span>
      </div>
    </div>
    <div class="modal-actions lpc-top-actions">
      <button class="btn btn-outline" onclick="App.larkStockPhotoAll('web')">${ic("check")} ใช้รูปเว็บทั้งหมด</button>
      <button class="btn btn-outline" onclick="App.larkStockPhotoAll('lark')">${ic("check")} ใช้รูป Lark ทั้งหมด</button>
    </div>
    <div class="lpc-list">${rows || `<div class="empty" style="padding:18px 8px"><div class="e-title">ไม่พบรายการที่ค้นหา</div><div class="muted">ลองลบคำค้นหรือเปลี่ยนตัวกรอง</div></div>`}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.larkStockPhotoCancel()">${ic("image")} ใช้รูปเว็บไว้ก่อน</button>
      <button class="btn btn-primary" onclick="App.larkStockPhotoApply()">${ic("save")} บันทึกตามที่เลือก</button>
    </div>`;
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
  }).join("");
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
  larkStockSetProgress(5, 100, "กำลังเชื่อมต่อ");
  toast("กำลังซิงก์สต็อกจาก Lark...");
  try {
    const PHOTO_LIMIT = 18;
    const MAX_BATCHES = 12;
    let offset = 0, batch = 0, last = null;
    const synced = new Map();
    do {
      batch++;
      larkStockSetStep(batch === 1 ? "กำลังอ่านรายการและดึงรูปชุดแรก..." : `กำลังดึงรูปชุดที่ ${batch}...`);
      if (!last) larkStockSetProgress(12, 100, "กำลังอ่านรายการ");
      last = await larkCall("stock_lark_sync", {
        token: Auth.session.token,
        app_token: cfg.app_token || "",
        table_id: cfg.table_id || "",
        photo_limit: PHOTO_LIMIT,
        photo_offset: offset
      }, { timeoutMs: 55000 });
      larkStockRememberProducts(synced, last.products || []);
      offset = Number(last.photo_next_offset) || 0;
      const totalPhotos = Number(last.photo_refs) || 0;
      const donePhotos = offset || totalPhotos;
      larkStockSetProgress(donePhotos, totalPhotos, totalPhotos ? `รูป ${fmtNum(donePhotos)}/${fmtNum(totalPhotos)}` : "ไม่มีรูปที่ต้องดึง");
      if (offset) larkStockSetStep(`ดึงรูปแล้ว ${fmtNum(donePhotos)}/${fmtNum(totalPhotos || donePhotos)} รูป กำลังไปต่อ...`);
    } while (offset && batch < MAX_BATCHES);
    larkStockSetProgress(100, 100, "บันทึกข้อมูลเสร็จแล้ว");
    const syncedProducts = [...synced.values()];
    const split = larkStockSplitPhotoConflicts(syncedProducts);
    const totalResult = mergeStockProducts(S, split.clean);
    saveState(S);
    if (typeof Auth !== "undefined" && Auth.session) Auth.saveNow();
    larkStockStopLoading();
    render();
    const more = offset && last ? ` · ยังเหลือรูปประมาณ ${fmtNum(last.photo_deferred || 0)} รูป กดซิงก์อีกครั้งเพื่อเก็บต่อ` : "";
    const donePhotos = Math.min(Number(offset || (last && last.photo_refs) || 0), Number((last && last.photo_refs) || 0));
    const baseToast = `ซิงก์ Lark สำเร็จ: ${syncedProducts.length} รายการ · รูป ${fmtNum(donePhotos)}/${fmtNum(last.photo_refs)} · เพิ่ม ${totalResult.added} · อัปเดต ${totalResult.updated}${totalResult.skipped ? ` · ไม่เปลี่ยน ${totalResult.skipped}` : ""}${more}`;
    if (split.conflicts.length) {
      App._larkStockPhotoPending = {
        conflicts: split.conflicts,
        decisions: Object.fromEntries(split.conflicts.map(c => [c.key, "web"])),
        toast: baseToast
      };
      openModal(larkStockConflictModalHtml());
      toast(`เจอรูปไม่ตรงกัน ${split.conflicts.length} รายการ เลือกรูปก่อนจบซิงก์`);
    } else {
      closeModal();
      toast(baseToast);
    }
  } catch (e) {
    larkStockError(e.message);
    toast("ซิงก์ Lark ไม่สำเร็จ: " + e.message);
  }
};

App.larkStockPhotoPick = function (key, choice) {
  const pending = App._larkStockPhotoPending;
  if (!pending) return;
  pending.decisions = pending.decisions || {};
  pending.decisions[String(key || "")] = choice === "lark" ? "lark" : "web";
  openModal(larkStockConflictModalHtml());
};

App.larkStockPhotoAll = function (choice) {
  const pending = App._larkStockPhotoPending;
  if (!pending) return;
  const v = choice === "lark" ? "lark" : "web";
  pending.decisions = Object.fromEntries((pending.conflicts || []).map(c => [c.key, v]));
  openModal(larkStockConflictModalHtml());
};

App.larkStockPhotoSearch = function (q) {
  const pending = App._larkStockPhotoPending;
  if (!pending) return;
  pending.query = String(q || "");
  openModal(larkStockConflictModalHtml());
  const input = document.querySelector(".lpc-search input");
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
};

App.larkStockPhotoFilter = function (filter) {
  const pending = App._larkStockPhotoPending;
  if (!pending) return;
  pending.filter = ["all", "web", "lark"].includes(filter) ? filter : "all";
  openModal(larkStockConflictModalHtml());
};

App.larkStockPhotoCancel = function () {
  const pending = App._larkStockPhotoPending;
  App._larkStockPhotoPending = null;
  closeModal();
  render();
  toast((pending && pending.toast ? pending.toast + " · ใช้รูปเว็บเดิม" : "ใช้รูปเว็บเดิมแล้ว"));
};

App.larkStockPhotoApply = function () {
  const pending = App._larkStockPhotoPending;
  if (!pending) return;
  const changed = larkStockApplyPhotoChoice(pending.conflicts || [], pending.decisions || {});
  saveState(S);
  if (typeof Auth !== "undefined" && Auth.session) Auth.saveNow();
  App._larkStockPhotoPending = null;
  closeModal();
  render();
  toast((pending.toast || "ซิงก์ Lark สำเร็จ") + (changed ? ` · ใช้รูป Lark ${changed} รายการ` : " · ใช้รูปเว็บเดิม"));
};
