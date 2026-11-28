# FARMULTIMATE Same-origin API

## Target Architecture

```text
ผู้ใช้
  |
  v
FARMULTIMATE public origin
  |-- static web app (Farm + Commerce)
  `-- /api -> Pages Function -> FARMULTIMATE_API service binding -> Worker -> D1/R2
```

หน้าเว็บที่ deploy แล้วกำหนด API เป็น `/api` ของ origin ปัจจุบัน. `functions/api/[[path]].js` ส่ง Request เดิมต่อผ่าน Service Binding ชื่อ `FARMULTIMATE_API`. Browser จึงเห็น public origin เดียวและ source ไม่ต้องเก็บ public Worker URL.

## Fail-closed Behavior

- Binding หาย: `503 API_SERVICE_UNAVAILABLE`.
- Worker เรียกไม่ได้: `502 API_UPSTREAM_FAILED`.
- Error response ไม่คืนชื่อ service, URL หรือรายละเอียดภายใน.
- Deployed runtime ไม่ fallback ไป global public API URL และ query string เปลี่ยน endpoint ไม่ได้.
- Local preview ยังคงใช้ placeholder/local configuration เพื่อทดสอบแบบ local ได้.

## Cloudflare Configuration Gate

ก่อน production release ให้ตั้ง Service Binding ใน Pages project:

- Variable name: `FARMULTIMATE_API`
- Service: Worker ของ FARMULTIMATE ใน environment ที่ตรงกับ deployment
- Preview binding ต้องชี้ preview/staging Worker; production binding ต้องชี้ production Worker

Workflow ใช้ `scripts/build-pages.mjs --out NEW_DIRECTORY` ประกอบ artifact เดียวที่มี static assets, `_worker.js` และ `_routes.json` ชัดเจน ไม่ขึ้นกับการค้นหา `functions/` จาก working directory ของ Wrangler. `_worker.js` สร้างจาก proxy ต้นทางเดียวใน `functions/api/[[path]].js` และทดสอบ forwarding, static fallback และ missing-binding fail-closed ก่อน upload.

ก่อนและหลัง release ต้องผ่าน `scripts/check-api-health.mjs PUBLIC_ORIGIN`: `/api` ต้องตอบ health, `output_control_allowed=false` และ capability `project_files_v1`. รุ่นนี้ต้องปล่อย backend ที่รองรับเอกสารส่วนตัวก่อน frontend ภายใต้ approval สำหรับ production แยกต่างหาก; workflow ไม่เปลี่ยน binding หรือ secrets ให้เอง. CI ทดสอบ artifact เดียวกันด้วยข้อมูลจำลอง. ดู [Cloudflare advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/).

การสร้างโค้ดและ integration branch เป็น `PREPARED / NOT_DEPLOYED`. การตั้ง production binding หรือ merge เข้า `master` ต้องมี `APPROVE_PRODUCTION_DEPLOY` และ readback หลัง deploy.
