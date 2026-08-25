/* ---------------- Lark Base sync proxy (Cloudflare Worker) ----------------
   ใช้แทน Netlify Function (Netlify หมด production deploy ชั่วคราว)
   ความลับ (App Secret) เก็บเป็น Worker Secret — ไม่หลุดไปหน้าเว็บ
   รองรับ CORS เพราะเว็บอยู่คนละ origin กับ worker

   API (POST):
     { action: "status" }                          → ทดสอบการเชื่อมต่อ + นับ record + สร้างคอลัมน์ให้
     { action: "push", records: [...] }            → อัปโหลด (upsert) ข้อมูลไป Base
     { action: "pull" }                            → ดึง record ทั้งหมดกลับมา
*/
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
  return { email: u.email, name: u.name, updated_at: d ? d.updated_at : 0 };
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
    if (request.method !== "POST") return json({ ok: false, error: "ใช้ POST เท่านั้น" }, 405);
    let payload = {};
    try { payload = await request.json(); } catch (e) { /* ปล่อยว่าง */ }
    try {
      let data;
      if (payload.action === "status") data = await doStatus(env);
      else if (payload.action === "push") data = await doPush(env, payload.records || []);
      else if (payload.action === "pull") data = await doPull(env);
      else if (payload.action === "register") data = await doRegister(env, request, payload);
      else if (payload.action === "login") data = await doLogin(env, request, payload);
      else if (payload.action === "logout") data = await doLogout(env, payload);
      else if (payload.action === "me") data = await doMe(env, payload);
      else if (payload.action === "save") data = await doSave(env, payload);
      else if (payload.action === "load") data = await doLoad(env, payload);
      else throw new Error("ไม่รู้จัก action: " + payload.action);
      return json({ ok: true, data });
    } catch (e) {
      return json({ ok: false, error: String(e.message || e) }, 400);
    }
  }
};
