# D1 QUEUED index — migration สำเร็จและตรวจอ่านกลับแล้ว

Owner: SUCHA | วันที่ 10 กันยายน 2026

Branch: `pick/d1-queued-index-20260910`

สถานะ: **REMOTE_INDEX_APPLIED / QUERY_PLANS_VERIFIED / NO_WORKER_OR_PI_DEPLOYMENT**

## ผลดำเนินการจริง

พี่ปิ๊กอนุมัติ `APPROVE_FARM_D1_INDEX_MIGRATION` แล้ว รันเฉพาะ CREATE INDEX ที่ระบุด้านล่างสำเร็จในวันที่ 10 กันยายน 2026 ภายในช่วง 15:37:56–15:39:18 เวลาไทย (บันทึกเวลาแบบขอบเขต ไม่ใช่ timestamp commit ของ D1) Console รายงาน query time 0.45 ms และ response time 799 ms

อ่านกลับพบ index ใหม่ตรงนิยาม และ index เดิมทั้งสองพร้อม primary-key autoindex ยังครบ Remote EXPLAIN ยืนยัน expire ใช้ `relay_bench_queued_owner_expiry (user_id=? AND expires_at<?)` และ claim ใช้ `relay_bench_queued_owner_expiry (user_id=? AND expires_at>?)` แล้ว เงื่อนไข OFF/stop_seq/LAN และ ORDER BY เดิมคงอยู่

อ่าน health แบบจำกัด 5 รายการ ได้ 1 รายการ: heartbeat สดประมาณ 270 ms, fault NONE และ snapshot ready (อายุคำนวณจาก unixepoch ระดับวินาที จึงเป็นค่าโดยประมาณ) ไม่ได้ส่ง request ควบคุมอุปกรณ์หรือเปลี่ยน command/state rows จากการตรวจนี้

ได้รับ Time Travel bookmark ก่อนเปลี่ยนแล้ว เก็บใน `qa/d1-queued-index/migration-readback.json` สำหรับการกู้คืนที่ต้องได้รับอนุมัติแยก ไม่ได้ restore หรือสั่งหยุดระบบ ผล read-only preflight เดิมเก็บไว้เป็นประวัติ ไม่แก้ให้ดูเหมือนเป็นผลหลัง migration

### Metrics ช่วงแรก

Worker แสดง Errors = 0 ในช่วง 30 นาทีล่าสุด และประมาณ 1.36k invocations ช่วงนี้รวมทั้งก่อนและหลัง migration ไม่ใช่หลักฐานรับรองระยะยาว

| Query | ก่อน: 15:25–15:35 ไทย | หลัง: 15:40–15:41 ไทย |
|---|---|---|
| Expire | 569 calls / 46.09k rows_read ≈ 81 ต่อครั้ง | 10 calls / 20 rows_read = 2 ต่อครั้ง |
| Claim | 359 calls / 30.87k rows_read ≈ 86 ต่อครั้ง | ยังไม่ปรากฏใน Query Insights ช่วงที่เลือก |

ช่วงเวลาไม่ทับกันและช่วงหลังเริ่มหลังขอบเขตเวลาทำ migration แน่นอน เป็นหลักฐานเบื้องต้นว่า expire อ่านลดลง แต่ยังไม่สรุปเปอร์เซ็นต์ลดทั้งระบบหรือบิลรายวัน ตัวอย่างหลังมีเพียง 10 calls และ headline/กราฟภูมิภาคยังแสดงยอดไม่ตรงกัน Refresh อีกครั้งได้ตัวอย่างเดิม ไม่ตีความ claim ที่ไม่แสดงว่าเป็นศูนย์

P50 ของ expire ใน sample นี้เพิ่มจาก 0.3 ms เป็น 3 ms จึงยังไม่กล่าวว่า latency ดีขึ้น ต้องใช้ช่วงติดตามยาวขึ้นเพื่อแยกความแปรผันของตัวอย่าง เป้าหมาย rows_read ของ claim ยังต้องวัดจาก traffic จริงเพิ่มเติม แม้ remote query plan ยืนยันว่าใช้ index ใหม่แล้ว

## หลักฐานก่อน migration

ตรวจฐานข้อมูล `flytech-farmultimate-canary` จริงผ่าน Cloudflare Console แบบ read-only แล้ว พบ index เดิมครบสองตัว และ primary-key autoindex ไม่มี `relay_bench_queued_owner_expiry` ทั้งบนตารางเป้าหมายและชื่อซ้ำใน schema ทั้งฐานข้อมูล

Remote EXPLAIN ทั้ง expire และ claim เลือก `relay_bench_owner_time (user_id=?)` สอดคล้องกับการอ่านประวัติ user ซ้ำที่พบใน audit ก่อนหน้า ครั้งนี้ส่งเพียงสอง SELECT ของ sqlite_schema (LIMIT 20 และ LIMIT 1) กับสอง EXPLAIN โดยใช้ placeholder ไม่มีการ execute UPDATE จริง ไม่มีการอ่านข้อมูลคำสั่งหรือตัวตนผู้ใช้

ฐาน source เป็น deployed release `fba867ea0af77d8046ab654cded326c496d0ec83` ซึ่งมี `origin/develop@40721b5` เป็น ancestor เพื่อไม่ถอยเงื่อนไข LAN ที่ใหม่กว่าต้น integration ห้ามใช้ branch นี้เป็นเหตุให้ deploy ทั้งแอปหรือ merge งานอื่นที่ยังไม่รวมเข้า develop ขั้นนี้ต้องการเฉพาะ SQL เพิ่ม index

## SQL ที่ได้รับอนุมัติและรันแล้ว

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

## ขอบเขตที่ได้รับอนุมัติ

อนุมัติ **เพิ่ม index เดียวตาม SQL ข้างต้นใน D1 `flytech-farmultimate-canary`** แล้วตรวจ readback/EXPLAIN และ Query Insights แบบ read-only ไม่รวม Worker/Pi deploy, เปลี่ยน polling, สั่งอุปกรณ์, ลบข้อมูล หรือรัน migration อื่น

คำอนุมัติที่ใช้ได้: `APPROVE_FARM_D1_INDEX_MIGRATION`

ได้รับคำอนุมัติข้างต้นและดำเนินการแล้ว ขอบเขตไม่ขยายไปยัง Worker/Pi deployment, index อื่น, polling หรือ hardware

## Runbook ที่ใช้และการติดตามผล

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
