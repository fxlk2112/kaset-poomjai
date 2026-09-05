# FARMULTIMATE Feature Ownership

FARMULTIMATE เป็นแอปเดียวและ release เดียว แต่แบ่งงานตามขอบเขตฟีเจอร์เพื่อลด merge conflict. ทุกงานเริ่มจาก `origin/develop`, ใช้ branch ของ owner และเปิด Pull Request กลับเข้า `develop`.

| Area | Owner | Default writable files | Acceptance |
|---|---|---|---|
| Farm, Master Map, Planner, Analytics, Water, Telemetry | Pick + SUCHA | `js/farm-map.js`, `js/sensors.js`, `data/weather-models.json`, `images/farm-map/**`, `images/digital-twin/**`, telemetry tests และ docs ของฟีเจอร์ | `npm run check`, visual QA เมื่อ UI เปลี่ยน, คง `DATA_ONLY / SAFE_OFF` |
| Stock, Sales, Products, Import, Market Price | Folk | `js/stock.js`, `js/sales.js`, ไฟล์ใหม่ใต้ `js/commerce/**`, commerce tests และ docs ของฟีเจอร์ | `npm run check`, visual QA เมื่อ UI เปลี่ยน, ไม่แก้ farm/telemetry contract |
| Integration, app shell, contracts, CI, release preparation | SUCHA | `index.html`, `js/app.js`, `js/data.js`, `js/auth.js`, `js/runtime-config.js`, `js/lark.js`, `css/style.css`, `sw.js`, `functions/**`, `worker/src/lark.js`, `.github/workflows/**`, governance docs | ตรวจ compatibility ของทั้ง Farm และ Commerce, full `npm run check`, secret scan, visual QA |

## Shared Hotspot Rule

ไฟล์ในแถว Integration เป็น shared hotspot. เจ้าของฟีเจอร์ไม่แก้ไฟล์เหล่านี้เอง เว้นแต่ `COLLAB_STATUS.md` ระบุ Task ID, owner, branch, source commit, scope และ lock ชัดเจน. ถ้าฟีเจอร์ต้องเปลี่ยน navigation หรือ API contract ให้เสนอ interface/contract พร้อม test แล้วให้ SUCHA รวมเข้า shared file.

## Branch Contract

- Pick/SUCHA: `pick/<task-slug>`
- Folk: `folk/<task-slug>`
- Base และ PR target: `develop`
- Release: `develop` ไป `master` หลัง `APPROVE_PRODUCTION_DEPLOY` เท่านั้น

`APPROVE_FARMULTIMATE_DEV_SETUP_ONCE` อนุญาต routine feature push ภายใน ownership นี้. ไม่อนุญาต production deploy, secret/config write, destructive action หรือ hardware action.
