# D1 QUEUED index — พร้อมอนุมัติ migration

Owner: SUCHA | วันที่ 10 กันยายน 2026

Branch: `pick/d1-queued-index-20260910`

สถานะ: **LOCAL_READY / NOT_DEPLOYED / REMOTE_MIGRATION_NOT_APPLIED**

## ผลตรวจล่าสุด

ตรวจฐานข้อมูล `flytech-farmultimate-canary` จริงผ่าน Cloudflare Console แบบ read-only แล้ว พบ index เดิมครบสองตัว และ primary-key autoindex ไม่มี `relay_bench_queued_owner_expiry` ทั้งบนตารางเป้าหมายและชื่อซ้ำใน schema ทั้งฐานข้อมูล

Remote EXPLAIN ทั้ง expire และ claim เลือก `relay_bench_owner_time (user_id=?)` สอดคล้องกับการอ่านประวัติ user ซ้ำที่พบใน audit ก่อนหน้า ครั้งนี้ส่งเพียงสอง SELECT ของ sqlite_schema (LIMIT 20 และ LIMIT 1) กับสอง EXPLAIN โดยใช้ placeholder ไม่มีการ execute UPDATE จริง ไม่มีการอ่านข้อมูลคำสั่งหรือตัวตนผู้ใช้

ฐาน source เป็น deployed release `fba867ea0af77d8046ab654cded326c496d0ec83` ซึ่งมี `origin/develop@40721b5` เป็น ancestor เพื่อไม่ถอยเงื่อนไข LAN ที่ใหม่กว่าต้น integration ห้ามใช้ branch นี้เป็นเหตุให้ deploy ทั้งแอปหรือ merge งานอื่นที่ยังไม่รวมเข้า develop ขั้นนี้ต้องการเฉพาะ SQL เพิ่ม index

## Proposed migration only

ไฟล์ที่เสนอ: `worker/relay-bench-migrate-queued-index.sql`

```sql
CREATE INDEX IF NOT EXISTS relay_bench_queued_owner_expiry
ON relay_bench_commands(user_id, expires_at)
WHERE status = 'QUEUED';
```

เพิ่ม index เดียว ไม่เปลี่ยน query, command rows, state, polling, OFF priority, LAN arbitration, unique active-channel guard หรือ Pi configuration อัปเดต `worker/relay-bench-schema.sql` สำหรับการสร้างฐานใหม่ให้ตรงกันด้วย แต่ห้ามนำ schema ทั้งไฟล์ไปรันกับ production

## Validation

`TZ=UTC npm run check` ผ่าน **129/129**, relay validation **9 messages** ผ่าน รวม tests ใหม่สามรายการ: migration รันซ้ำได้และไม่เปลี่ยนข้อมูล/index เดิม, query plan และผลคำสั่ง/guards ก่อนหลังตรงกัน, schema ที่ action อยู่ท้ายตารางแบบ production รองรับ migration เดียวกัน

ชุด regression เดิมทั้งหมดใช้ fresh schema ที่มี index ใหม่ จึงครอบคลุม auth, duplicate command, OFF tombstone, 16 channels และ LAN takeover ด้วย ไม่มี UI/runtime code เปลี่ยน จึงไม่ต้อง build หรือ deploy Worker

## ขอบเขตที่ขออนุมัติ

อนุมัติ **เพิ่ม index เดียวตาม SQL ข้างต้นใน D1 `flytech-farmultimate-canary`** แล้วตรวจ readback/EXPLAIN และ Query Insights แบบ read-only ไม่รวม Worker/Pi deploy, เปลี่ยน polling, สั่งอุปกรณ์, ลบข้อมูล หรือรัน migration อื่น

คำอนุมัติที่ใช้ได้: `APPROVE_FARM_D1_INDEX_MIGRATION`

การอนุมัติรอบล่าสุดครอบคลุม read-only preflight และเตรียม local migration ตามข้อเสนอ ยังไม่ได้อนุมัติแก้ฐาน Farm จริง จึงหยุดเฉพาะก่อน apply SQL นี้ตามขอบเขตที่แจ้งกับผู้ใช้ ไม่ใช่ข้อจำกัดจากเครื่องมือ

## แผนดำเนินการหลังอนุมัติ

1. ยืนยัน database UUID `e4d96f00-36b2-404f-a5eb-abcae72755d1`, binding และตรวจ index metadata ซ้ำก่อน apply หากชื่อมีอยู่และนิยามต่างต้องหยุด หากเหมือนกันให้ข้าม CREATE และตรวจ readback ต่อ
2. ตรวจสถานะ D1 และ recovery/Time Travel ที่ใช้งานได้ รับ bookmark ปัจจุบันก่อนเปลี่ยน ใช้ช่วง traffic ต่ำหากทำได้ การสร้าง index อ่านตารางครั้งแรกและอาจหน่วง request ชั่วคราว ไม่สั่ง disarm/หยุด service โดยอัตโนมัติ
3. รันเฉพาะ SQL ใน `worker/relay-bench-migrate-queued-index.sql` ครั้งเดียว ไม่รัน migration runner ทั้งชุด ไม่รัน `relay-bench-migrate-v2.sql` เดิมซึ่งมี cancel/disarm ไม่ทำ PRAGMA optimize/ANALYZE เพิ่มใน scope นี้
4. อ่าน sqlite_schema ยืนยันนิยามใหม่และ index เดิมครบ แล้ว EXPLAIN สอง query เดิม ตรวจว่าเลือก queued index หากไม่ได้ใช้ ให้รายงานผลและตรวจต่อแบบ read-only ไม่เปลี่ยน query หรือเพิ่ม index อื่นเอง
5. ตรวจ Worker errors และข้อมูล heartbeat ที่มีอยู่แบบ read-only ไม่ยิง `/poll`, `/pulse`, `/off` หรือ `/arm` เป็น smoke test
6. ใช้ Query Insights เปรียบเทียบช่วงก่อน/หลังที่ไม่ทับกัน วัด rows_read ต่อ call ของสอง query พร้อมจำนวน calls และ writes ช่วงแรกอาจยังไม่มีข้อมูลเพียงพอ ต้องรายงานว่า pending ไม่อ้างว่าลดบิลแล้วจากผล local

Rollback ที่เสนอหากมีปัญหา: ถอดเฉพาะ `relay_bench_queued_owner_expiry` หลังได้รับอนุมัติ rollback ไม่ย้อนทั้งฐานเพราะจะกระทบคำสั่งที่เกิดภายหลัง ไม่ลบ index เดิมหรือข้อมูลธุรกิจ

## คำสั่งตรวจ local

```powershell
$env:TZ = 'UTC'
npm run check
git diff --check
```

หลักฐาน preflight และผลทดสอบอยู่ใน `qa/d1-queued-index/read-only-preflight.json` ส่วนผล 20 paired scenarios และ VM-step benchmark เดิมอยู่ใน artifact audit วันที่ 10 กันยายน VM steps เป็นค่าทดสอบ SQLite ไม่ใช่ D1 rows_read หรือยอดประหยัดเงินจริง
