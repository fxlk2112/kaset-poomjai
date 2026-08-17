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
  for (let i = 0; i < recordIds.length; i += BATCH) {
    await lark(env, "/bitable/v1/apps/" + appToken + "/tables/" + tableId + "/records/batch_delete", {
      method: "DELETE",
      body: JSON.stringify({ records: recordIds.slice(i, i + BATCH) })
    });
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
      else throw new Error("ไม่รู้จัก action: " + payload.action);
      return json({ ok: true, data });
    } catch (e) {
      return json({ ok: false, error: String(e.message || e) }, 400);
    }
  }
};
