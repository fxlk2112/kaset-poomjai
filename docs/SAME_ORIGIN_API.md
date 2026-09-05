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

Workflow ใช้ Wrangler จาก repository root. Cloudflare จะตรวจ `functions/` ที่ root และรวม Pages Functions ใน deployment แม้ static assets จะถูกประกอบไว้ใน staging directory.

การสร้างโค้ดและ integration branch เป็น `PREPARED / NOT_DEPLOYED`. การตั้ง production binding หรือ merge เข้า `master` ต้องมี `APPROVE_PRODUCTION_DEPLOY` และ readback หลัง deploy.
