/* ---------------- Lark Base sync proxy (Cloudflare Worker) ----------------
   ใช้แทน Netlify Function (Netlify หมด production deploy ชั่วคราว)
   ความลับ (App Secret) เก็บเป็น Worker Secret — ไม่หลุดไปหน้าเว็บ
   รองรับ CORS เพราะเว็บอยู่คนละ origin กับ worker

   API (POST):
     { action: "status" }                          → ทดสอบการเชื่อมต่อ + นับ record + สร้างคอลัมน์ให้
     { action: "push", records: [...] }            → อัปโหลด (upsert) ข้อมูลไป Base
     { action: "pull" }                            → ดึง record ทั้งหมดกลับมา
*/
import { MARKET_DATA } from "./market-data.js";
const BATCH = 500;

/* แคช tenant_access_token ต่อ isolate (Cloudflare เก็บระหว่าง request) */
let cachedToken = { v: "", exp: 0 };

function cors() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: cors() });
}
function need(env, name) {
  const v = env[name];
  if (!v) throw new Error("ยังไม่ได้ตั้งค่า " + name + " ใน Worker");
  return v;
}
function base(env) {
  return (env.LARK_BASE_URL || "https://open.larksuite.com") + "/open-apis";
}

async function tenantToken(env) {
  if (cachedToken.v && Date.now() < cachedToken.exp) return cachedToken.v;
  const r = await fetch(base(env) + "/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: need(env, "LARK_APP_ID"), app_secret: need(env, "LARK_APP_SECRET") })
  });
  const j = await r.json().catch(() => ({}));
  if (!j || j.code !== 0) throw new Error("ขอ token ไม่สำเร็จ: " + (j && j.msg ? j.msg : "ตรวจสอบ App ID/Secret"));
  cachedToken = { v: j.tenant_access_token, exp: Date.now() + ((Number(j.expire) || 7200) - 120) * 1000 };
  return cachedToken.v;
}

async function lark(env, path, opts = {}) {
  const token = await tenantToken(env);
  const r = await fetch(base(env) + path, {
    ...opts,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  const j = await r.json().catch(() => ({}));
  if (!j || j.code !== 0) {
    throw new Error("Lark API error (" + (j && j.code) + "): " + (j && j.msg ? j.msg : "ไม่รู้จักข้อผิดพลาด"));
  }
  return j.data;
}

async function larkDownload(env, path) {
  const token = await tenantToken(env);
  const r = await fetch(base(env) + path, { headers: { "Authorization": "Bearer " + token } });
  if (!r.ok) throw new Error("ดาวน์โหลดไฟล์จาก Lark ไม่สำเร็จ (" + r.status + ")");
  return {
    bytes: await r.arrayBuffer(),
    contentType: r.headers.get("content-type") || "application/octet-stream"
  };
}

function textOfField(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(x => {
    if (x == null) return "";
    if (typeof x === "string" || typeof x === "number") return String(x);
    return x.text || x.name || x.url || "";
  }).join("");
  if (typeof v === "object") return v.text || v.name || v.url || "";
  return String(v);
}

function safeFileName(name, fallback) {
  const raw = String(name || fallback || "image.jpg");
  const dot = raw.lastIndexOf(".");
  const baseName = (dot > 0 ? raw.slice(0, dot) : raw).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || fallback || "image";
  const ext = dot > 0 ? raw.slice(dot).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") : ".jpg";
  return baseName + ext;
}

function cleanToken(v) {
  const s = String(v || "").trim();
  return /^[A-Za-z0-9]+$/.test(s) ? s : "";
}

function emailList(v) {
  return String(v || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}

function larkStockDefaultAllowed(env, email) {
  const allow = emailList(env.LARK_STOCK_DEFAULT_EMAILS);
  const fallback = allow.length ? allow : adminEmails(env);
  return fallback.includes(String(email || "").toLowerCase()) || isAdminEmail(env, email);
}

async function saveLarkStockPhoto(env, attachment) {
  const token = String(attachment.file_token || "");
  if (!token) return "";
  const name = safeFileName(attachment.name, token);
  const key = "lark/stock/" + token + "-" + name;
  const origin = "https://farmbackup.carfork123.workers.dev";
  if (!env.PHOTOS) return "images/products/" + name;
  const old = await env.PHOTOS.get(key);
  if (!old) {
    const dl = await larkDownload(env, "/drive/v1/medias/" + token + "/download");
    await env.PHOTOS.put(key, dl.bytes, {
      httpMetadata: { contentType: attachment.type || dl.contentType || "image/jpeg" }
    });
  }
  return origin + "/photo/" + key;
}

async function resolveStockTable(env, appToken, tableId) {
  const requested = cleanToken(tableId);
  if (requested) return { table_id: requested, name: "" };
  const d = await lark(env, "/bitable/v1/apps/" + appToken + "/tables?page_size=100");
  const items = d.items || [];
  if (!items.length) throw new Error("Base นี้ยังไม่มีตาราง");
  const preferred = String(env.LARK_STOCK_TABLE_NAME || "").trim();
  const found = preferred
    ? (items.find(t => String(t.name || "").trim() === preferred) ||
       items.find(t => String(t.name || "").includes(preferred)) ||
       items[0])
    : items[0];
  return { table_id: found.table_id, name: found.name || "" };
}

/* หา table_id: ใช้ env LARK_TABLE_ID ถ้าไม่ตั้ง ให้เลือกตารางแรกของ Base */
async function resolveTable(env) {
  const appToken = need(env, "LARK_APP_TOKEN");
  if (env.LARK_TABLE_ID) return env.LARK_TABLE_ID;
  const d = await lark(env, "/bitable/v1/apps/" + appToken + "/tables?page_size=100");
  const items = d.items || [];
  if (!items.length) throw new Error("Base นี้ยังไม่มีตาราง — สร้างตารางใน Base ก่อน");
  return items[0].table_id;
}

/* เช็คคอลัมน์ครบ (type/id/json/updated_at) — ถ้าขาดสร้างให้อัตโนมัติ */
async function ensureFields(env, tableId) {
  const appToken = need(env, "LARK_APP_TOKEN");
  const d = await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/fields?page_size=100");
  const have = new Set((d.items || []).map(f => f.field_name));
  const want = [{ n: "type", t: 1 }, { n: "id", t: 1 }, { n: "json", t: 1 }, { n: "updated_at", t: 2 }];
  for (const f of want) {
    if (!have.has(f.n)) {
      await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/fields", {
        method: "POST",
        body: JSON.stringify({ field_name: f.n, type: f.t })
      });
    }
  }
}

function fieldsOf(rec) {
  const v = rec.fields || {};
  const get = (k) => (v[k] && typeof v[k] === "object" && !Array.isArray(v[k]) ? v[k].text : v[k]);
  return { type: String(get("type") || ""), id: String(get("id") || ""), json: String(get("json") || ""), updated_at: Number(get("updated_at")) || 0 };
}

async function listAll(env) {
  const appToken = need(env, "LARK_APP_TOKEN");
  const tableId = await resolveTable(env);
  await ensureFields(env, tableId);
  const out = [];
  let pageToken = "";
  do {
    const q = "?page_size=" + BATCH + (pageToken ? "&page_token=" + pageToken : "");
    const d = await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records" + q);
    (d.items || []).forEach(r => out.push({ record_id: r.record_id, ...fieldsOf(r) }));
    pageToken = d.has_more ? d.page_token : "";
  } while (pageToken);
  return out;
}

async function batchCreate(env, records) {
  const appToken = need(env, "LARK_APP_TOKEN");
  const tableId = await resolveTable(env);
  for (let i = 0; i < records.length; i += BATCH) {
    await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_create", {
      method: "POST",
      body: JSON.stringify({ records: records.slice(i, i + BATCH) })
    });
  }
}
async function batchUpdate(env, rows) {
  const appToken = need(env, "LARK_APP_TOKEN");
  const tableId = await resolveTable(env);
  for (let i = 0; i < rows.length; i += BATCH) {
    await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_update", {
      method: "POST",
      body: JSON.stringify({ records: rows.slice(i, i + BATCH) })
    });
  }
}
async function batchDelete(env, recordIds) {
  const appToken = need(env, "LARK_APP_TOKEN");
  const tableId = await resolveTable(env);
  /* ลบทีละตัว — batch_delete ของ Lark คืน RecordIdNotFound ทั้งที่ id ถูกต้อง (บั๊กฝั่ง Lark)
     การลบเกิดขึ้นน้อย (เฉพาะรายการที่ถูกลบในแอป) ลบทีละตัวปลอดภัยกว่า */
  for (const rid of recordIds) {
    await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/" + rid, { method: "DELETE" });
  }
}

async function doPush(env, records) {
  const existing = await listAll(env);
  const byKey = new Map();
  existing.forEach(e => { if (e.id) byKey.set(e.type + "|" + e.id, e); });

  let created = 0, updated = 0, skipped = 0, deleted = 0;
  const createList = [], updateList = [];
  const seen = new Set();

  for (const rec of records) {
    const type = String(rec.type || ""), id = String(rec.id || "");
    const key = type + "|" + id;
    if (!type || !id) continue;
    seen.add(key);
    const json = typeof rec.json === "string" ? rec.json : JSON.stringify(rec.json || {});
    const fieldsObj = { type, id, json, updated_at: Number(rec.updated_at) || Date.now() };
    const old = byKey.get(key);
    if (!old) { createList.push({ fields: fieldsObj }); created++; }
    else if (old.json !== json) { updateList.push({ record_id: old.record_id, fields: fieldsObj }); updated++; }
    else { skipped++; }
  }
  const deleteIds = [...byKey.values()].filter(e => !seen.has(e.type + "|" + e.id)).map(e => e.record_id);

  if (createList.length) await batchCreate(env, createList);
  if (updateList.length) await batchUpdate(env, updateList);
  if (deleteIds.length) { await batchDelete(env, deleteIds); deleted = deleteIds.length; }

  return { created, updated, skipped, deleted, total: existing.length - deleteIds.length + created };
}

async function doPull(env) {
  const list = await listAll(env);
  return { records: list.map(e => ({ type: e.type, id: e.id, json: e.json, updated_at: e.updated_at })) };
}

async function doStatus(env) {
  await tenantToken(env);
  const tableId = await resolveTable(env);
  await ensureFields(env, tableId);
  const list = await listAll(env);
  return { ok: true, table_id: tableId, records: list.length };
}

async function doStockLarkSync(env, p) {
  const u = await authUser(env, p.token);
  const suppliedAppToken = cleanToken(p.app_token) || cleanToken(p.appToken);
  if (!suppliedAppToken && !larkStockDefaultAllowed(env, u.email)) {
    throw new Error("บัญชีนี้ยังไม่มีแหล่ง Lark เริ่มต้น กรุณาวางลิงก์ Base ของคุณก่อนซิงก์");
  }
  const appToken = suppliedAppToken || cleanToken(env.LARK_STOCK_APP_TOKEN);
  if (!appToken) throw new Error("ยังไม่ได้ตั้งค่าแหล่ง Lark เริ่มต้น กรุณาวางลิงก์ Base ก่อนซิงก์");
  const tableInfo = await resolveStockTable(env, appToken, p.table_id || p.tableId || (suppliedAppToken ? "" : env.LARK_STOCK_TABLE_ID));
  const tableId = tableInfo.table_id;
  const fields = [
    "รหัสสินค้าเดิม", "จำนวนที่นับ", "ชื่อสินค้า ไทย", "ชื่อสามัญ", "หมวดสินค้า",
    "หน่วยนับ", "ขนาดสินค้า", "บริษัทจำหน่าย", "รูปถ่าย"
  ];
  const records = [];
  let pageToken = "";
  do {
    const q = "?page_size=" + BATCH + (pageToken ? "&page_token=" + encodeURIComponent(pageToken) : "");
    const d = await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/search" + q, {
      method: "POST",
      body: JSON.stringify({ field_names: fields })
    });
    (d.items || []).forEach(r => records.push(r));
    pageToken = d.has_more ? d.page_token : "";
  } while (pageToken);

  const photoLimit = Math.min(Math.max(Number(p.photo_limit) || 18, 0), 40);
  const photoOffset = Math.max(Number(p.photo_offset) || 0, 0);
  let photoRefs = 0, photoSaved = 0, photoProcessed = 0;
  const products = [];
  for (const rec of records) {
    const f = rec.fields || {};
    const attachments = Array.isArray(f["รูปถ่าย"]) ? f["รูปถ่าย"] : [];
    const photos = [];
    let skippedBefore = 0, deferredAfter = 0;
    for (const a of attachments) {
      const photoIndex = photoRefs++;
      if (photoIndex < photoOffset) { skippedBefore++; continue; }
      if (photoProcessed >= photoLimit) { deferredAfter++; continue; }
      photoProcessed++;
      const url = await saveLarkStockPhoto(env, a);
      if (url) { photos.push(url); photoSaved++; }
    }
    const name = textOfField(f["ชื่อสินค้า ไทย"]).trim();
    if (!name) continue;
    products.push({
      code: textOfField(f["รหัสสินค้าเดิม"]).trim(),
      name,
      generic: textOfField(f["ชื่อสามัญ"]).trim(),
      category: textOfField(f["หมวดสินค้า"]).trim(),
      unit: textOfField(f["หน่วยนับ"]).trim() || "ชิ้น",
      size: textOfField(f["ขนาดสินค้า"]).trim(),
      supplier: textOfField(f["บริษัทจำหน่าย"]).trim(),
      qty: Number(f["จำนวนที่นับ"]) || 0,
      photo: photos[0] || "",
      photos,
      appendPhotos: skippedBefore > 0 || deferredAfter > 0
    });
  }
  const nextOffset = photoOffset + photoProcessed < photoRefs ? photoOffset + photoProcessed : 0;
  return {
    table_name: tableInfo.name, records: records.length, products,
    photo_refs: photoRefs, photo_saved: photoSaved, photo_processed: photoProcessed,
    photo_offset: photoOffset, photo_next_offset: nextOffset,
    photo_deferred: nextOffset ? Math.max(photoRefs - nextOffset, 0) : 0
  };
}

/* ==================== บัญชีผู้ใช้ + ข้อมูลรายบัญชี (D1) ====================
   register {email,password,name} → {token,email,name}
   login    {email,password}      → {token,email,name}
   logout   {token}
   me       {token}               → {email,name,updated_at}
   save     {token,data}          → {updated_at}  (data = สถานะทั้งหมดของแอป JSON)
   load     {token}               → {data,updated_at} | {data:null}
*/
const ITERATIONS = 100000;
const SESSION_DAYS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function hashPassword(password, saltB64) {
  const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: ITERATIONS },
    keyMat, 256
  );
  return "pbkdf2$" + ITERATIONS + "$" + saltB64 + "$" + b64(bits);
}
function makeSalt() {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}
function makeToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* จำกัดความถี่พื้นฐาน (ต่อ isolate): register/login ไม่เกิน 20 ครั้ง/นาที/IP */
const rateMap = new Map();
function rateLimit(request) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const now = Date.now();
  const e = rateMap.get(ip) || { n: 0, reset: now + 60000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60000; }
  e.n++;
  rateMap.set(ip, e);
  if (e.n > 20) throw new Error("พยายามบ่อยเกินไป กรุณารอสักครู่");
}

async function authUser(env, token) {
  if (!token) throw new Error("ยังไม่ได้ล็อกอิน");
  const row = await env.DB.prepare("SELECT s.user_id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?1 AND s.expires_at > ?2")
    .bind(token, Date.now()).first();
  if (!row) throw new Error("เซสชันหมดอายุ กรุณาล็อกอินใหม่");
  /* ต่ออายุแบบ sliding */
  await env.DB.prepare("UPDATE sessions SET expires_at = ?1 WHERE token = ?2")
    .bind(Date.now() + SESSION_DAYS * 86400000, token).run();
  return row;
}

/* ---------- แอดมิน: อีเมลใน env ADMIN_EMAILS (คั่นด้วย ,) เท่านั้น ---------- */
function isAdminEmail(env, email) {
  return adminEmails(env).includes(String(email || "").toLowerCase());
}
function adminEmails(env) {
  return String(env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}
async function requireAdmin(env, token) {
  const u = await authUser(env, token);
  if (!isAdminEmail(env, u.email)) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return u;
}

/* แอดมิน: สรุปข้อมูลทุกบัญชี */
async function doAdminList(env, p) {
  await requireAdmin(env, p.token);
  const users = await env.DB.prepare("SELECT id, email, name, created_at FROM users ORDER BY created_at DESC").all();
  const datas = await env.DB.prepare("SELECT user_id, data, updated_at FROM user_data").all();
  const byUser = new Map(datas.results.map(d => [d.user_id, d]));
  return users.results.map(u => {
    const d = byUser.get(u.id);
    const summary = { plots: 0, cycles: 0, tasks: 0, stock: 0, sales: 0, equipment: 0 };
    if (d && d.data) {
      try {
        const s = JSON.parse(d.data);
        ["plots", "cycles", "tasks", "stock", "sales", "equipment"].forEach(k => { summary[k] = (s[k] || []).length; });
      } catch (e) { /* data เสียหาย */ }
    }
    return { email: u.email, name: u.name, created_at: u.created_at, updated_at: d ? d.updated_at : 0, bytes: d ? d.data.length : 0, summary };
  });
}

/* แอดมิน: ข้อมูลเต็มของบัญชีหนึ่ง */
async function doAdminGet(env, p) {
  await requireAdmin(env, p.token);
  const row = await env.DB.prepare(
    "SELECT u.email, u.name, d.data, d.updated_at FROM users u LEFT JOIN user_data d ON d.user_id = u.id WHERE u.email = ?1"
  ).bind(String(p.email || "").toLowerCase()).first();
  if (!row) throw new Error("ไม่พบบัญชีนี้");
  let data = null;
  try { data = row.data ? JSON.parse(row.data) : null; } catch (e) { /* data เสียหาย */ }
  return { email: row.email, name: row.name, updated_at: row.updated_at || 0, data };
}

/* ---------- ราคาตลาดจริงจาก API สศก. (NABC) — ราคารับซื้อรายวัน ณ ตลาดสำคัญ ---------- */
/* ราคาตลาด: ข้อมูล static จาก kasetpoomjai.com (ตลาดศรีเมือง + ตลาดสี่มุมเมือง)
   อัปเดตทุกครั้งที่ deploy worker — ข้อมูลมี 213 รายการ, 171 สินค้า */
async function doMarketPrices(env, p) {
  /* เปิดหน้าราคาแล้ว seed ประวัติวันนี้ทันทีด้วย
     INSERT OR REPLACE ทำให้เรียกซ้ำได้ ไม่ต้องรอ cron รอบ 08:00 วันถัดไป */
  if (env.DB) {
    try { await doRecordPrices(env); } catch (e) { /* แสดงราคาปัจจุบันต่อได้ แม้บันทึก history ไม่สำเร็จ */ }
  }
  return MARKET_DATA;
}

/* บันทึกราคาวันนี้จาก MARKET_DATA ลง D1 (เรียกจาก cron ครั้งเดียวต่อวัน)
   ใช้ INSERT OR REPLACE เพื่อ idempotent — รัน cron ซ้ำได้ปลอดภัย */
async function doRecordPrices(env) {
  /* ตรวจว่า table มีแล้วหรือยัง (migration อาจยังไม่ได้รัน) */
  try {
    await env.DB.prepare("SELECT 1 FROM price_history LIMIT 1").first();
  } catch (e) {
    /* table ยังไม่มี — สร้างอัตโนมัติ */
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        product TEXT NOT NULL, market TEXT NOT NULL, date TEXT NOT NULL,
        price REAL NOT NULL, min REAL NOT NULL, max REAL NOT NULL,
        unit TEXT DEFAULT '', category TEXT DEFAULT '', status TEXT DEFAULT 'stable',
        recorded_at INTEGER NOT NULL, PRIMARY KEY (product, market, date)
      );
      CREATE INDEX IF NOT EXISTS idx_ph_product_date ON price_history(product, date DESC);
      CREATE INDEX IF NOT EXISTS idx_ph_date ON price_history(date DESC);
    `);
  }
  const nowBkk = new Date(Date.now() + 7 * 3600 * 1000);
  const today = nowBkk.toISOString().slice(0, 10);
  const ts = Date.now();
  /* แบ่ง batch ทีละ 50 rows (D1 จำกัด bound params) */
  const rows = [];
  for (const p of MARKET_DATA.products || []) {
    for (const m of p.markets || []) {
      rows.push({
        product: p.product, market: m.market, date: today,
        price: Number(m.price) || ((Number(p.min) + Number(p.max)) / 2),
        min: Number(p.min) || 0, max: Number(p.max) || 0,
        unit: p.unit || "", category: p.category || "",
        status: m.status || "stable", recorded_at: ts
      });
    }
  }
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const stmt = env.DB.prepare(
      "INSERT OR REPLACE INTO price_history (product,market,date,price,min,max,unit,category,status,recorded_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"
    );
    await env.DB.batch(chunk.map(r => stmt.bind(r.product, r.market, r.date, r.price, r.min, r.max, r.unit, r.category, r.status, r.recorded_at)));
  }
  /* เก็บย้อนหลัง 2 ปี เพื่อให้กราฟรายเดือน/รายปีมีข้อมูลพอใช้งาน */
  const nowBkk730 = new Date(Date.now() + 7 * 3600 * 1000 - 730 * 86400 * 1000);
  const cutoff = nowBkk730.toISOString().slice(0, 10);
  await env.DB.prepare("DELETE FROM price_history WHERE date < ?1").bind(cutoff).run();
  return { recorded: rows.length, date: today };
}

function bkkDateAgo(days) {
  return new Date(Date.now() + 7 * 3600 * 1000 - days * 86400 * 1000).toISOString().slice(0, 10);
}

/* ดึงประวัติราคาของสินค้าหนึ่งชนิด (ทุกตลาด): รายวัน / รายเดือน / รายปี */
async function doMarketPriceHistory(env, p) {
  const product = String(p.product || "").trim();
  if (!product) throw new Error("กรุณาระบุชื่อสินค้า");
  const period = ["day", "month", "year"].includes(String(p.period || "day")) ? String(p.period || "day") : "day";
  /* ตรวจ table ก่อน */
  try { await env.DB.prepare("SELECT 1 FROM price_history LIMIT 1").first(); }
  catch (e) { return { product, period, history: {}, markets: [] }; }

  let rows;
  if (period === "month") {
    const months = Math.min(Math.max(Number(p.months) || 12, 3), 24);
    const from = bkkDateAgo(months * 31);
    rows = await env.DB.prepare(
      "SELECT substr(date,1,7) AS date, market, AVG(price) AS price, MIN(min) AS min, MAX(max) AS max, 'stable' AS status, COUNT(*) AS samples FROM price_history WHERE product = ?1 AND date >= ?2 GROUP BY market, substr(date,1,7) ORDER BY date ASC"
    ).bind(product, from).all();
  } else if (period === "year") {
    const years = Math.min(Math.max(Number(p.years) || 5, 2), 5);
    const fromYear = String(new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear() - years + 1) + "-01-01";
    rows = await env.DB.prepare(
      "SELECT substr(date,1,4) AS date, market, AVG(price) AS price, MIN(min) AS min, MAX(max) AS max, 'stable' AS status, COUNT(*) AS samples FROM price_history WHERE product = ?1 AND date >= ?2 GROUP BY market, substr(date,1,4) ORDER BY date ASC"
    ).bind(product, fromYear).all();
  } else {
    const days = Math.min(Math.max(Number(p.days) || 30, 7), 365);
    const from = bkkDateAgo(days);
    rows = await env.DB.prepare(
      "SELECT date, market, price, min, max, status, 1 AS samples FROM price_history WHERE product = ?1 AND date >= ?2 ORDER BY date ASC"
    ).bind(product, from).all();
  }

  /* จัดกลุ่มตามตลาด */
  const byMarket = {};
  for (const r of rows.results || []) {
    if (!byMarket[r.market]) byMarket[r.market] = [];
    byMarket[r.market].push({ date: r.date, price: Math.round((Number(r.price) || 0) * 100) / 100, min: r.min, max: r.max, status: r.status, samples: r.samples || 1 });
  }
  return { product, period, markets: Object.keys(byMarket), history: byMarket };
}

/* ---------- แชร์แปลง: ลิงก์ดูอย่างเดียว + คอมเมนต์ ---------- */
async function userState(env, userId) {
  const d = await env.DB.prepare("SELECT data FROM user_data WHERE user_id = ?1").bind(userId).first();
  try { return d && d.data ? JSON.parse(d.data) : {}; } catch (e) { return {}; }
}

/* ---------- แชร์สต็อกให้บัญชีอื่น (ดูอย่างเดียว) ---------- */
async function ensureStockShares(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS stock_shares (owner_user_id TEXT NOT NULL, viewer_user_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_user_id, viewer_user_id))"
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_stock_shares_viewer ON stock_shares(viewer_user_id)"
  ).run();
}
function stockSummaryFromState(state) {
  const stock = Array.isArray(state.stock) ? state.stock : [];
  const items = stock.length;
  const qty = stock.reduce((a, x) => a + (Number(x.qty) || 0) + (Number(x.openQty) || 0), 0);
  const value = stock.reduce((a, x) => a + ((Number(x.qty) || 0) + (Number(x.openQty) || 0)) * (Number(x.avgCost) || 0), 0);
  const photos = stock.reduce((a, x) => {
    const ps = Array.isArray(x.photos) ? x.photos : (x.photo ? [x.photo] : []);
    return a + ps.filter(Boolean).length;
  }, 0);
  return { items, qty, value, photos };
}
function stockPublicList(state) {
  return (Array.isArray(state.stock) ? state.stock : []).map(x => ({
    id: String(x.id || ""),
    code: String(x.code || ""),
    name: String(x.name || ""),
    generic: String(x.generic || ""),
    category: String(x.category || ""),
    unit: String(x.unit || "ชิ้น"),
    size: String(x.size || ""),
    supplier: String(x.supplier || ""),
    qty: Number(x.qty) || 0,
    openQty: Number(x.openQty) || 0,
    avgCost: Number(x.avgCost) || 0,
    salePrice: Number(x.salePrice) || 0,
    photo: String(x.photo || ""),
    photos: Array.isArray(x.photos) ? x.photos.map(p => String(p || "")).filter(Boolean) : (x.photo ? [String(x.photo)] : [])
  })).filter(x => x.id && x.name);
}
async function doStockShareList(env, p) {
  const u = await authUser(env, p.token);
  await ensureStockShares(env);
  const outgoingRows = await env.DB.prepare(
    "SELECT u.email, u.name, ss.created_at FROM stock_shares ss JOIN users u ON u.id = ss.viewer_user_id WHERE ss.owner_user_id = ?1 ORDER BY ss.created_at DESC"
  ).bind(u.user_id).all();
  const incomingRows = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, ss.created_at, d.data, d.updated_at FROM stock_shares ss JOIN users u ON u.id = ss.owner_user_id LEFT JOIN user_data d ON d.user_id = u.id WHERE ss.viewer_user_id = ?1 ORDER BY ss.created_at DESC"
  ).bind(u.user_id).all();
  const incoming = [];
  for (const r of incomingRows.results || []) {
    let state = {};
    try { state = r.data ? JSON.parse(r.data) : {}; } catch (e) { state = {}; }
    incoming.push({ email: r.email, name: r.name, created_at: r.created_at, updated_at: r.updated_at || 0, summary: stockSummaryFromState(state) });
  }
  return { outgoing: outgoingRows.results || [], incoming };
}
async function doStockShareGrant(env, p) {
  const owner = await authUser(env, p.token);
  await ensureStockShares(env);
  const email = String(p.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
  if (email === String(owner.email || "").toLowerCase()) throw new Error("ไม่ต้องแชร์ให้บัญชีตัวเอง");
  const viewer = await env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?1").bind(email).first();
  if (!viewer) throw new Error("ไม่พบบัญชีนี้ในระบบ ให้เขาสมัคร/ล็อกอินเว็บก่อน");
  await env.DB.prepare(
    "INSERT INTO stock_shares (owner_user_id, viewer_user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(owner_user_id, viewer_user_id) DO UPDATE SET created_at = ?3"
  ).bind(owner.user_id, viewer.id, Date.now()).run();
  return { email: viewer.email, name: viewer.name || "" };
}
async function doStockShareRevoke(env, p) {
  const owner = await authUser(env, p.token);
  await ensureStockShares(env);
  const email = String(p.email || "").trim().toLowerCase();
  const viewer = await env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(email).first();
  if (viewer) {
    await env.DB.prepare("DELETE FROM stock_shares WHERE owner_user_id = ?1 AND viewer_user_id = ?2")
      .bind(owner.user_id, viewer.id).run();
  }
  return { revoked: true };
}
async function doStockShareGet(env, p) {
  const viewer = await authUser(env, p.token);
  await ensureStockShares(env);
  const ownerEmail = String(p.owner_email || p.ownerEmail || "").trim().toLowerCase();
  if (!EMAIL_RE.test(ownerEmail)) throw new Error("ระบุบัญชีเจ้าของสต็อกไม่ถูกต้อง");
  const owner = await env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?1").bind(ownerEmail).first();
  if (!owner) throw new Error("ไม่พบบัญชีเจ้าของสต็อก");
  const allowed = await env.DB.prepare("SELECT 1 FROM stock_shares WHERE owner_user_id = ?1 AND viewer_user_id = ?2")
    .bind(owner.id, viewer.user_id).first();
  if (!allowed) throw new Error("บัญชีนี้ยังไม่ได้แชร์สต็อกให้คุณ หรือถูกยกเลิกแล้ว");
  const state = await userState(env, owner.id);
  return { owner: { email: owner.email, name: owner.name || "" }, stock: stockPublicList(state), summary: stockSummaryFromState(state) };
}
async function doShareCreate(env, p) {
  const u = await authUser(env, p.token);
  const plotId = String(p.plotId || "");
  const cycleId = String(p.cycleId || "");
  if (!plotId) throw new Error("ไม่พบรหัสแปลงที่ต้องการแชร์");
  const state = await userState(env, u.user_id);
  const plots = state.plots || [];
  if (!plots.find(pl => pl.id === plotId)) throw new Error("ไม่พบแปลงนี้ในบัญชีของคุณ");
  const cycles = state.cycles || [];
  if (cycleId && !cycles.find(c => c.id === cycleId && c.plotId === plotId)) throw new Error("รอบปลูกนี้ไม่อยู่ในแปลงที่เลือก");
  const oldRows = await env.DB.prepare(
    "SELECT s.token, COALESCE(sc.cycle_id, '') AS cycle_id FROM shares s LEFT JOIN share_scopes sc ON sc.token = s.token WHERE s.owner_user_id = ?1 AND s.plot_id = ?2 AND s.active = 1 ORDER BY s.created_at DESC"
  ).bind(u.user_id, plotId).all();
  const old = (oldRows.results || []).find(r => String(r.cycle_id || "") === cycleId);
  if (old && old.token) return { token: old.token, reused: true };
  const token = makeToken().slice(0, 20);
  await env.DB.prepare("INSERT INTO shares (token, owner_user_id, plot_id, created_at, active) VALUES (?1, ?2, ?3, ?4, 1)")
    .bind(token, u.user_id, plotId, Date.now()).run();
  if (cycleId) {
    await env.DB.prepare("INSERT INTO share_scopes (token, cycle_id) VALUES (?1, ?2)")
      .bind(token, cycleId).run();
  }
  return { token };
}
async function doShareList(env, p) {
  const u = await authUser(env, p.token);
  const rows = await env.DB.prepare(
    "SELECT s.token, s.plot_id, COALESCE(sc.cycle_id, '') AS cycle_id, s.created_at, s.active FROM shares s LEFT JOIN share_scopes sc ON sc.token = s.token WHERE s.owner_user_id = ?1 ORDER BY s.created_at DESC"
  ).bind(u.user_id).all();
  const out = [];
  for (const r of rows.results) {
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM share_comments WHERE token = ?1").bind(r.token).first();
    out.push({ token: r.token, plot_id: r.plot_id, cycle_id: r.cycle_id || "", created_at: r.created_at, active: r.active, comments: c ? c.n : 0 });
  }
  return { shares: out };
}
async function doShareRevoke(env, p) {
  const u = await authUser(env, p.token);
  await env.DB.prepare("UPDATE shares SET active = 0 WHERE owner_user_id = ?1 AND token = ?2").bind(u.user_id, String(p.shareToken || "")).run();
  return { revoked: true };
}
async function doShareGet(env, p) {
  const s = await env.DB.prepare("SELECT owner_user_id, plot_id FROM shares WHERE token = ?1 AND active = 1").bind(String(p.shareToken || "")).first();
  if (!s) throw new Error("ลิงก์หมดอายุหรือถูกยกเลิกแล้ว");
  const scope = await env.DB.prepare("SELECT cycle_id FROM share_scopes WHERE token = ?1").bind(String(p.shareToken || "")).first();
  const cycleId = String((scope && scope.cycle_id) || "");
  const state = await userState(env, s.owner_user_id);
  const comments = await env.DB.prepare("SELECT name, text, created_at FROM share_comments WHERE token = ?1 ORDER BY created_at DESC LIMIT 50").bind(String(p.shareToken || "")).all();
  const out = { share: { mode: cycleId ? "cycle" : "plot" }, comments: comments.results, plot: null, cycle: null, cycles: [], tasks: [], finance: null, farm: null };
  const plots = state.plots || [];
  const target = s.plot_id ? plots.find(pl => pl.id === s.plot_id) : null;
  if (!target) throw new Error("แปลงนี้ถูกลบหรือเจ้าของหยุดแชร์แล้ว");
  const allCycles = state.cycles || [];
  const targetCycle = cycleId ? allCycles.find(c => c.id === cycleId && c.plotId === target.id) : null;
  if (cycleId && !targetCycle) throw new Error("รอบปลูกนี้ถูกลบหรือเจ้าของหยุดแชร์แล้ว");
  if (target) {
    out.plot = { name: target.name, sizeRai: target.sizeRai || 0, status: target.status || "", crop: target.crop || "" };
    out.cycles = (targetCycle ? [targetCycle] : allCycles.filter(c => c.plotId === target.id))
      .map(c => ({ plant: c.plant || "", startDate: c.startDate || "", status: c.status || "", round: c.round || 0 }));
    out.cycle = targetCycle ? out.cycles[0] : null;
    out.tasks = (state.tasks || [])
      .filter(t => targetCycle ? t.cycleId === targetCycle.id : t.plotId === target.id)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 80)
      .map(t => ({
        title: t.title || "", date: t.date || "", status: t.status || "", type: t.type || "",
        note: t.note || "", cost: Number(t.cost) || 0, revenue: Number(t.revenue) || 0,
        qty: Number(t.qty) || 0, unit: t.unit || "", harvestQty: Number(t.harvestQty) || 0,
        costItems: (t.costItems || []).slice(0, 8).map(it => ({
          name: it.name || "", category: it.category || "", qty: Number(it.qty) || 0, unit: it.unit || "", totalCost: Number(it.totalCost) || 0
        }))
      }));
    let revenue = 0, cost = 0;
    (state.tasks || []).forEach(t => {
      if ((t.status || "") === "done" && (targetCycle ? t.cycleId === targetCycle.id : t.plotId === target.id)) {
        revenue += Number(t.revenue) || 0; cost += Number(t.cost) || 0;
      }
    });
    out.finance = { revenue, cost, net: revenue - cost };
  }
  return out;
}
async function doShareComment(env, request, p) {
  rateLimit(request);
  const s = await env.DB.prepare("SELECT token FROM shares WHERE token = ?1 AND active = 1").bind(String(p.shareToken || "")).first();
  if (!s) throw new Error("ลิงก์ไม่ถูกต้อง");
  const text = String(p.text || "").trim().slice(0, 500);
  const name = String(p.name || "ไม่ระบุชื่อ").trim().slice(0, 60) || "ไม่ระบุชื่อ";
  if (!text) throw new Error("พิมพ์คอมเมนต์ก่อนส่ง");
  await env.DB.prepare("INSERT INTO share_comments (id, token, name, text, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(makeToken().slice(0, 16), s.token, name, text, Date.now()).run();
  return { ok: true };
}

/* ==================== ระบบน้ำ IoT ====================
   แอป:  water_sync  (ส่งรายการระบบน้ำ+ตารางขึ้นเซิร์ฟเวอร์)
         water_status (อ่านสถานะจริงล่าสุด)
         water_set   (สั่งเปิด/ปิดด้วยมือ + นาที)
         water_register (ออก device key ให้ ESP32)
   อุปกรณ์: water_poll (ดึงคำสั่ง on/off), water_report (รายงานสถานะจริง)
   Cron (ทุกนาที): คิดตารางอัตโนมัติ + เช็คฝน (Open-Meteo) ข้ามรอบถ้าฝนชุก */
async function doWaterSync(env, p) {
  const u = await authUser(env, p.token);
  const systems = Array.isArray(p.systems) ? p.systems : [];
  for (const s of systems) {
    await env.DB.prepare(
      `INSERT INTO water_systems (user_id, system_id, plot_name, name, every_days, time_of_day, minutes, enabled, last_watered, lat, lng, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
       ON CONFLICT(user_id, system_id) DO UPDATE SET plot_name=?3, name=?4, every_days=?5, time_of_day=?6, minutes=?7, enabled=?8, last_watered=?9, lat=?10, lng=?11, updated_at=?12`
    ).bind(u.user_id, String(s.id || ""), String(s.plotName || ""), String(s.name || ""),
      Number(s.everyDays) || 2, String(s.time || "06:00"), Number(s.minutes) || 30,
      s.enabled ? 1 : 0, String(s.lastWatered || ""), Number(s.lat) || 0, Number(s.lng) || 0, Date.now()).run();
  }
  /* ลบระบบที่ถูกลบจากแอป */
  const existing = await env.DB.prepare("SELECT system_id FROM water_systems WHERE user_id = ?1").bind(u.user_id).all();
  for (const row of existing.results) {
    if (!systems.find(s => String(s.id) === row.system_id)) {
      await env.DB.prepare("DELETE FROM water_systems WHERE user_id = ?1 AND system_id = ?2").bind(u.user_id, row.system_id).run();
    }
  }
  return { synced: systems.length };
}

async function doWaterStatus(env, p) {
  const u = await authUser(env, p.token);
  const rows = await env.DB.prepare("SELECT system_id, plot_name, name, enabled, state, until_ts, last_watered, note, updated_at FROM water_systems WHERE user_id = ?1").bind(u.user_id).all();
  return { states: rows.results };
}

async function doWaterSet(env, p) {
  const u = await authUser(env, p.token);
  const on = p.cmd === "on";
  const minutes = Number(p.minutes) || 30;
  const until = on ? Date.now() + minutes * 60000 : 0;
  const res = await env.DB.prepare("UPDATE water_systems SET state = ?3, until_ts = ?4, updated_at = ?5 WHERE user_id = ?1 AND system_id = ?2")
    .bind(u.user_id, String(p.systemId || ""), on ? "on" : "off", until, Date.now()).run();
  if (!res.meta.changes) throw new Error("ไม่พบระบบน้ำนี้บนเซิร์ฟเวอร์ (ลองซิงก์ก่อน)");
  return { state: on ? "on" : "off", minutes, until };
}

async function doWaterRegister(env, p) {
  const u = await authUser(env, p.token);
  const key = makeToken();
  await env.DB.prepare("INSERT INTO water_devices (user_id, device_key, name, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(u.user_id, key, String(p.name || "valve-controller").slice(0, 60), Date.now()).run();
  return { device_key: key };
}

async function doWaterKeys(env, p) {
  const u = await authUser(env, p.token);
  const rows = await env.DB.prepare("SELECT device_key, name, created_at FROM water_devices WHERE user_id = ?1 ORDER BY created_at DESC").bind(u.user_id).all();
  return { devices: rows.results };
}

async function deviceUser(env, key) {
  const dev = await env.DB.prepare("SELECT user_id FROM water_devices WHERE device_key = ?1").bind(String(key || "")).first();
  if (!dev) throw new Error("device key ไม่ถูกต้อง");
  return dev.user_id;
}

async function doWaterPoll(env, p) {
  const uid2 = await deviceUser(env, p.device_key);
  const now = Date.now();
  /* ปิดอัตโนมัติเมื่อหมดเวลา */
  await env.DB.prepare("UPDATE water_systems SET state = 'off' WHERE user_id = ?1 AND state = 'on' AND until_ts <= ?2").bind(uid2, now).run();
  const rows = await env.DB.prepare("SELECT system_id, state, until_ts FROM water_systems WHERE user_id = ?1").bind(uid2).all();
  return { cmds: rows.results.map(r => ({ system_id: r.system_id, on: r.state === "on" && r.until_ts > now })) };
}

async function doWaterReport(env, p) {
  const uid2 = await deviceUser(env, p.device_key);
  await env.DB.prepare("UPDATE water_systems SET state = ?3, updated_at = ?4 WHERE user_id = ?1 AND system_id = ?2")
    .bind(uid2, String(p.system_id || ""), p.state === "on" ? "on" : "off", Date.now()).run();
  return { ok: true };
}

/* Cron: ตัดสินใจให้น้ำอัตโนมัติทุกนาที (เวลาไทย UTC+7) + ข้ามรอบถ้าพยากรณ์ฝนชุก */
async function cronWater(env) {
  const nowBkk = new Date(Date.now() + 7 * 3600 * 1000);
  const today = nowBkk.toISOString().slice(0, 10);
  const nowHM = nowBkk.toISOString().slice(11, 16);
  /* ปิดวาล์วที่หมดเวลา */
  await env.DB.prepare("UPDATE water_systems SET state = 'off' WHERE state = 'on' AND until_ts <= ?1").bind(Date.now()).run();
  /* ระบบที่ถึงเวลา (enabled, ยังไม่ให้วันนี้, ถึงเวลาตั้งไว้) */
  const due = await env.DB.prepare(
    "SELECT user_id, system_id, minutes, lat, lng FROM water_systems WHERE enabled = 1 AND last_watered <> ?1 AND time_of_day <= ?2"
  ).bind(today, nowHM).all();
  const weatherCache = new Map();
  for (const row of due.results) {
    let skip = "";
    /* เช็คฝน: ถ้ามีพิกัดและพยากรณ์ฝนชุก → ข้ามรอบ (ฝนช่วยรดน้ำแทน) */
    if (row.lat && row.lng) {
      const ck = row.lat.toFixed(2) + "," + row.lng.toFixed(2);
      let w = weatherCache.get(ck);
      if (!w) {
        try {
          const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + row.lat + "&longitude=" + row.lng + "&daily=precipitation_probability_max,precipitation_sum&forecast_days=1&timezone=auto");
          const jj = await res.json();
          const prob = (jj.daily && jj.daily.precipitation_probability_max && jj.daily.precipitation_probability_max[0]) || 0;
          const mm = (jj.daily && jj.daily.precipitation_sum && jj.daily.precipitation_sum[0]) || 0;
          w = { prob: Number(prob) || 0, mm: Number(mm) || 0 };
        } catch (e) { w = { prob: 0, mm: 0 }; }
        weatherCache.set(ck, w);
      }
      if (w.prob >= 70 || w.mm >= 3) skip = "ข้ามรอบ " + today + " — พยากรณ์ฝน " + w.prob + "% (" + w.mm + " มม.)";
    }
    if (skip) {
      /* ฝนตก = น้ำได้แล้ว → เลื่อนรอบไปวันถัดไปตาม interval */
      await env.DB.prepare("UPDATE water_systems SET last_watered = ?3, note = ?4, updated_at = ?5 WHERE user_id = ?1 AND system_id = ?2")
        .bind(row.user_id, row.system_id, today, skip, Date.now()).run();
    } else {
      const until = Date.now() + (row.minutes || 30) * 60000;
      await env.DB.prepare("UPDATE water_systems SET state = 'on', until_ts = ?3, last_watered = ?4, note = '', updated_at = ?5 WHERE user_id = ?1 AND system_id = ?2")
        .bind(row.user_id, row.system_id, until, today, Date.now()).run();
    }
  }
}

async function doRegister(env, request, p) {
  rateLimit(request);
  const email = String(p.email || "").trim().toLowerCase();
  const password = String(p.password || "");
  const name = String(p.name || "").trim().slice(0, 80);
  if (!EMAIL_RE.test(email)) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
  if (password.length < 6) throw new Error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(email).first();
  if (exists) throw new Error("อีเมลนี้ถูกใช้แล้ว");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id, email, pass_hash, name, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(id, email, await hashPassword(password, makeSalt()), name, Date.now()).run();
  const token = makeToken();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)")
    .bind(token, id, Date.now() + SESSION_DAYS * 86400000).run();
  return { token, email, name };
}

async function doLogin(env, request, p) {
  rateLimit(request);
  const email = String(p.email || "").trim().toLowerCase();
  const password = String(p.password || "");
  const row = await env.DB.prepare("SELECT id, pass_hash, email, name FROM users WHERE email = ?1").bind(email).first();
  /* ถ้าไม่พบอีเมล ก็แฮชทึบ ๆ ให้เสียเวลาเท่ากัน กันการเดาว่าอีเมลนี้มีในระบบ */
  const stored = row ? row.pass_hash : "pbkdf2$" + ITERATIONS + "$" + makeSalt() + "$" + b64(crypto.getRandomValues(new Uint8Array(32)));
  const parts = stored.split("$");
  /* hashPassword คืนสตริงเต็ม pbkdf2$iter$salt$hash — เทียบเฉพาะส่วน hash */
  const testHash = (await hashPassword(password, parts[2])).split("$")[3];
  if (!row || testHash !== parts[3]) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  const token = makeToken();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)")
    .bind(token, row.id, Date.now() + SESSION_DAYS * 86400000).run();
  return { token, email: row.email, name: row.name };
}

async function doLogout(env, p) {
  if (p.token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?1").bind(p.token).run();
  return { loggedOut: true };
}

async function doMe(env, p) {
  const u = await authUser(env, p.token);
  const d = await env.DB.prepare("SELECT updated_at FROM user_data WHERE user_id = ?1").bind(u.user_id).first();
  return { email: u.email, name: u.name, updated_at: d ? d.updated_at : 0, admin: isAdminEmail(env, u.email) };
}

async function doSave(env, p) {
  const u = await authUser(env, p.token);
  const data = typeof p.data === "string" ? p.data : JSON.stringify(p.data || {});
  if (data.length > 900000) throw new Error("ข้อมูลใหญ่เกิน (~0.9MB) — ติดต่อผู้ดูแล");
  const ts = Number(p.updated_at) || Date.now();
  await env.DB.prepare(
    "INSERT INTO user_data (user_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET data = ?2, updated_at = ?3"
  ).bind(u.user_id, data, ts).run();
  return { updated_at: ts };
}

async function doLoad(env, p) {
  const u = await authUser(env, p.token);
  const d = await env.DB.prepare("SELECT data, updated_at FROM user_data WHERE user_id = ?1").bind(u.user_id).first();
  if (!d) return { data: null, updated_at: 0 };
  let parsed = null;
  try { parsed = JSON.parse(d.data); } catch (e) { /* ข้อมูลเสียหาย */ }
  return { data: parsed, updated_at: d.updated_at };
}

/* ---------- รูปภาพ (R2) ---------- */
/* อัปโหลดรูป: base64 (ไม่มี prefix data:) — จำกัดขนาด ~2MB base64 ≈ 1.5MB ไบต์จริง
   key = u/<userId>/<timestamp>-<rand>.jpg — แยกตามเจ้าของ เดายาก */
async function doPhotoPut(env, payload, request) {
  const u = await authUser(env, payload.token);
  const b64 = String(payload.data || "");
  const ct = String(payload.contentType || "image/jpeg");
  if (!b64) throw new Error("ไม่มีข้อมูลรูป");
  if (!["image/jpeg", "image/png", "image/webp"].includes(ct)) throw new Error("ชนิดไฟล์ไม่รองรับ (JPG/PNG/WebP เท่านั้น)");
  if (b64.length > 2 * 1024 * 1024) throw new Error("รูปใหญ่เกิน (จำกัด ~1.5MB หลังย่อ)");
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (!bytes.length) throw new Error("ข้อมูลรูปว่าง");
  const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
  if (!env.PHOTOS) throw new Error("R2 ยังไม่พร้อม — ต้องเปิด R2 และสร้าง bucket farmultimate-photos ก่อน");
  const key = "u/" + u.user_id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: ct } });
  const origin = request ? new URL(request.url).origin : "https://farmbackup.carfork123.workers.dev";
  return { url: origin + "/photo/" + key, key, size: bytes.length };
}
/* ลบรูป: ต้องเป็นรูปของตัวเองเท่านั้น (prefix u/<userId>/) */
async function doPhotoDel(env, payload) {
  const u = await authUser(env, payload.token);
  let key = String(payload.key || "");
  if (!key && payload.url) {
    try { key = decodeURIComponent(new URL(payload.url).pathname.slice("/photo/".length)); } catch (e) {}
  }
  if (!key || !key.startsWith("u/" + u.user_id + "/")) throw new Error("ไม่อนุญาต (ไม่ใช่รูปของคุณ)");
  if (env.PHOTOS) await env.PHOTOS.delete(key);
  return { deleted: key };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
    /* GET /photo/<key> — เสิร์ฟรูปจาก R2 (อ่านสาธารณะ เพราะ key เดายาก + แชร์/QR ต้องโชว์รูปได้) */
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/photo/")) {
        try {
          const key = decodeURIComponent(url.pathname.slice("/photo/".length));
          if (!key || key.includes("..")) return new Response("bad key", { status: 400 });
          if (!env.PHOTOS) return new Response("R2 ยังไม่พร้อม", { status: 503 });
          const obj = await env.PHOTOS.get(key);
          if (!obj) return new Response("ไม่พบรูป", { status: 404 });
          return new Response(obj.body, {
            headers: {
              "Content-Type": (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg",
              "Cache-Control": "public, max-age=31536000, immutable",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (e) { return new Response("photo error", { status: 500 }); }
      }
      return new Response("ใช้ POST เท่านั้น", { status: 405 });
    }
    if (request.method !== "POST") return json({ ok: false, error: "ใช้ POST เท่านั้น" }, 405);
    let payload = {};
    try { payload = await request.json(); } catch (e) { /* ปล่อยว่าง */ }
    try {
      let data;
      if (payload.action === "status") data = await doStatus(env);
      else if (payload.action === "push") data = await doPush(env, payload.records || []);
      else if (payload.action === "pull") data = await doPull(env);
      else if (payload.action === "stock_lark_sync") data = await doStockLarkSync(env, payload);
      else if (payload.action === "register") data = await doRegister(env, request, payload);
      else if (payload.action === "login") data = await doLogin(env, request, payload);
      else if (payload.action === "logout") data = await doLogout(env, payload);
      else if (payload.action === "me") data = await doMe(env, payload);
      else if (payload.action === "save") data = await doSave(env, payload);
      else if (payload.action === "load") data = await doLoad(env, payload);
      else if (payload.action === "admin_list") data = await doAdminList(env, payload);
      else if (payload.action === "admin_get") data = await doAdminGet(env, payload);
      else if (payload.action === "water_sync") data = await doWaterSync(env, payload);
      else if (payload.action === "water_status") data = await doWaterStatus(env, payload);
      else if (payload.action === "water_set") data = await doWaterSet(env, payload);
      else if (payload.action === "water_register") data = await doWaterRegister(env, payload);
      else if (payload.action === "water_keys") data = await doWaterKeys(env, payload);
      else if (payload.action === "water_poll") data = await doWaterPoll(env, payload);
      else if (payload.action === "water_report") data = await doWaterReport(env, payload);
      else if (payload.action === "market_prices") data = await doMarketPrices(env, payload);
      else if (payload.action === "market_price_history") data = await doMarketPriceHistory(env, payload);
      else if (payload.action === "stock_share_list") data = await doStockShareList(env, payload);
      else if (payload.action === "stock_share_grant") data = await doStockShareGrant(env, payload);
      else if (payload.action === "stock_share_revoke") data = await doStockShareRevoke(env, payload);
      else if (payload.action === "stock_share_get") data = await doStockShareGet(env, payload);
      else if (payload.action === "share_create") data = await doShareCreate(env, payload);
      else if (payload.action === "share_list") data = await doShareList(env, payload);
      else if (payload.action === "share_revoke") data = await doShareRevoke(env, payload);
      else if (payload.action === "share_get") data = await doShareGet(env, payload);
      else if (payload.action === "share_comment") data = await doShareComment(env, request, payload);
      else if (payload.action === "photo_put") data = await doPhotoPut(env, payload, request);
      else if (payload.action === "photo_del") data = await doPhotoDel(env, payload);
      else throw new Error("ไม่รู้จัก action: " + payload.action);
      return json({ ok: true, data });
    } catch (e) {
      return json({ ok: false, error: String(e.message || e) }, 400);
    }
  },
  async scheduled(event, env, ctx) {
    try { await cronWater(env); } catch (e) { console.error("cron water error:", e); }
    /* บันทึกราคาตลาดวันนี้ลง D1 (ทุกนาที แต่ INSERT OR REPLACE = idempotent)
       เช็คเฉพาะช่วง 08:00–08:59 BKK เพื่อไม่ให้ query DB ทุกนาที */
    try {
      const hBkk = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();
      if (hBkk === 8) await doRecordPrices(env);
    } catch (e) { console.error("cron price error:", e); }
  }
};
