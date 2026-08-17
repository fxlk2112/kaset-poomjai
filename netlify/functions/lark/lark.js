/* ---------------- Lark Base sync proxy (Netlify Function) ----------------
   ให้หน้าเว็บ (ฝั่งเบราว์เซอร์) อัปโหลด/ดาวน์โหลดข้อมูลไปยัง Lark Base (bitable)
   โดย App Secret เก็บไว้ที่ environment variables ของ Netlify เท่านั้น — ไม่หลุดไปหน้าเว็บ

   Env vars (ตั้งที่ Netlify → Site settings → Environment variables):
     LARK_APP_ID      — App ID ของแอปที่สร้างจาก open.larksuite.com
     LARK_APP_SECRET  — App Secret (เก็บเป็นความลับ!)
     LARK_APP_TOKEN   — app_token ของ Base (จาก URL ของ Base)
     LARK_TABLE_ID    — table_id ของตารางที่ใช้เก็บ (ตารางต้องมีคอลัมน์: type / id / json / updated_at)

   API:
     POST /.netlify/functions/lark
       { action: "status" }                          → ทดสอบการเชื่อมต่อ + นับจำนวน record
       { action: "push", records: [...] }            → อัปโหลด (upsert) ข้อมูลไป Base
       { action: "pull" }                            → ดึง record ทั้งหมดกลับมา
*/
/* Lark (ต่างประเทศ) = open.larksuite.com · Feishu (จีน) = open.feishu.cn — ตั้ง LARK_BASE_URL ได้ */
const BASE = (process.env.LARK_BASE_URL || "https://open.larksuite.com") + "/open-apis";
const BATCH = 500; // Lark จำกัด ~1000 record/ครั้ง — ใช้ 500 เผื่อ payload ใหญ่

let cachedToken = { v: "", exp: 0 };

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error("ยังไม่ได้ตั้งค่า " + name + " ใน Netlify");
  return v;
}

/* ขอ tenant_access_token (อายุ ~2 ชม.) — แคชไว้ใน memory */
async function tenantToken() {
  if (cachedToken.v && Date.now() < cachedToken.exp) return cachedToken.v;
  const appId = need("LARK_APP_ID");
  const appSecret = need("LARK_APP_SECRET");
  const r = await fetch(BASE + "/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const j = await r.json().catch(() => ({}));
  if (!j || j.code !== 0) throw new Error("ขอ token ไม่สำเร็จ: " + (j && j.msg ? j.msg : "ตรวจสอบ App ID/Secret"));
  cachedToken = { v: j.tenant_access_token, exp: Date.now() + ((Number(j.expire) || 7200) - 120) * 1000 };
  return cachedToken.v;
}

/* เรียก Lark Base API — ถ้า code ไม่ใช่ 0 ให้ throw พร้อมข้อความจาก Lark */
async function lark(path, opts = {}) {
  const token = await tenantToken();
  const r = await fetch(BASE + path, {
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

function fields(rec) {
  /* ดึงค่า field จาก record (field ชื่ออาจมีค่าเป็น object หรือค่าตรง) */
  const v = rec.fields || {};
  const get = (k) => (v[k] && typeof v[k] === "object" && !Array.isArray(v[k]) ? v[k].text : v[k]);
  return { type: String(get("type") || ""), id: String(get("id") || ""), json: String(get("json") || ""), updated_at: Number(get("updated_at")) || 0 };
}

/* list ทั้งหมด (แบ่งหน้า) แล้วคืน array ของ { record_id, type, id, json, updated_at } */
async function listAll() {
  const appToken = need("LARK_APP_TOKEN");
  const tableId = need("LARK_TABLE_ID");
  const out = [];
  let pageToken = "";
  do {
    const q = "?page_size=" + BATCH + (pageToken ? "&page_token=" + pageToken : "");
    const d = await lark("/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records" + q);
    (d.items || []).forEach(r => out.push({ record_id: r.record_id, ...fields(r) }));
    pageToken = d.has_more ? d.page_token : "";
  } while (pageToken);
  return out;
}

/* สร้าง record ใหม่เป็นกลุ่ม (ไม่เกิน BATCH ต่อครั้ง) */
async function batchCreate(records) {
  const appToken = need("LARK_APP_TOKEN");
  const tableId = need("LARK_TABLE_ID");
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await lark("/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_create", {
      method: "POST",
      body: JSON.stringify({ records: chunk })
    });
  }
}

/* อัปเดต record เดิมเป็นกลุ่ม */
async function batchUpdate(rows) {
  const appToken = need("LARK_APP_TOKEN");
  const tableId = need("LARK_TABLE_ID");
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await lark("/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_update", {
      method: "POST",
      body: JSON.stringify({ records: chunk })
    });
  }
}

/* ลบ record ที่ไม่อยู่ในแอปแล้ว */
async function batchDelete(recordIds) {
  const appToken = need("LARK_APP_TOKEN");
  const tableId = need("LARK_TABLE_ID");
  for (let i = 0; i < recordIds.length; i += BATCH) {
    const chunk = recordIds.slice(i, i + BATCH);
    await lark("/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_delete", {
      method: "DELETE",
      body: JSON.stringify({ records: chunk })
    });
  }
}

/* push: upsert — เปรียบเทียบจาก json string (ไม่ต้องพึ่ง timestamp) */
async function doPush(records) {
  const existing = await listAll();
  const byKey = new Map(); // "type|id" -> { record_id, json }
  existing.forEach(e => { if (e.id) byKey.set(e.type + "|" + e.id, e); });

  let created = 0, updated = 0, skipped = 0, deleted = 0;
  const createList = [];
  const updateList = [];
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
  /* ลบ record ที่ค้างใน Base แต่ไม่อยู่ในข้อมูลแล้ว */
  const deleteIds = [...byKey.values()].filter(e => !seen.has(e.type + "|" + e.id)).map(e => e.record_id);

  if (createList.length) await batchCreate(createList);
  if (updateList.length) await batchUpdate(updateList);
  if (deleteIds.length) { await batchDelete(deleteIds); deleted = deleteIds.length; }

  return { created, updated, skipped, deleted, total: existing.length - deleteIds.length + created };
}

async function doPull() {
  const list = await listAll();
  return { records: list.map(e => ({ type: e.type, id: e.id, json: e.json, updated_at: e.updated_at })) };
}

async function doStatus() {
  await tenantToken(); // ตรวจว่า credential ใช้ได้
  const list = await listAll();
  return { ok: true, records: list.length };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ ok: false, error: "ใช้ POST เท่านั้น" }) };
  }
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch (e) { /* ปล่อยว่าง */ }
  const action = payload.action;
  try {
    let data;
    if (action === "status") data = await doStatus();
    else if (action === "push") data = await doPush(payload.records || []);
    else if (action === "pull") data = await doPull();
    else throw new Error("ไม่รู้จัก action: " + action);
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, data }) };
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
}
