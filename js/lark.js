/* ---------------- ซิงก์ข้อมูลกับ Lark Base (ผ่าน Netlify Function) ----------------
   เรียก /.netlify/functions/lark — App Secret เก็บไว้ฝั่ง Netlify เท่านั้น ไม่หลุดมาเบราว์เซอร์
   ใช้ในหน้าตั้งค่า: ทดสอบการเชื่อมต่อ / อัปโหลด (push) / ดาวน์โหลด (pull) */
/* เรียก Cloudflare Worker (proxy เก็บ App Secret ฝั่ง server) */
const LARK_FN = "https://farmbackup.carfork123.workers.dev";

/* เรียก Netlify Function — คืน data หรือ throw พร้อมข้อความ */
async function larkCall(action, body) {
  const r = await fetch(LARK_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ action }, body || {}))
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw new Error((j && j.error) || "เชื่อมต่อ Netlify Function ไม่ได้");
  return j.data;
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
