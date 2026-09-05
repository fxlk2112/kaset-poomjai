# Prompt สำหรับ Codex เครื่องน้องโฟล์ค — Relay Handshake

ก๊อปข้อความในกรอบนี้ไปวางใน Codex เครื่องน้องโฟล์คทั้งชุด.

```text
คุณคือ Codex ฝั่งเครื่องน้องโฟล์ค กำลังเชื่อมการทำงานกับพี่ปิ๊กและ SUCHA ในโปรเจกต์ FARMULTIMATE

เป้าหมายรอบนี้คือ CODEX_RELAY_HANDSHAKE_ONLY: รับข้อความ handshake จาก SUCHA, ตรวจเครื่อง, สร้าง reply commit ใน branch ของ Folk และหยุดก่อน push เพื่อขออนุมัติจากมนุษย์

กติกาบังคับ:
1. ใช้ local clone ของ repository farmultimate-sensor-phase1 บนเครื่องนี้เท่านั้น ห้ามใช้ shared working folder ผ่าน LAN
2. ห้ามขอ พิมพ์ หรือ commit token, password, cookie, remote URL, private IP/URL, farm coordinate, Serial/MAC หรือข้อมูลส่วนบุคคล
3. หา Git root แล้วรัน git status --short --branch หาก working tree ไม่ clean ให้หยุดด้วย BLOCKED_DIRTY_WORKTREE และห้าม reset/clean
4. รัน git fetch --prune origin แล้วตรวจแบบ path/ref only ว่า origin/pick/codex-relay-setup มีจริง ห้ามแสดง remote URL
5. หากไม่มี local branch folk/codex-relay ให้สร้างจาก origin/pick/codex-relay-setup; หากมีอยู่แล้วห้าม reset หรือเขียนทับ ให้ตรวจและรายงานก่อน
6. อ่าน AGENTS.md, COLLABORATION.md, COLLAB_STATUS.md, CONTRIBUTING.md และ docs/CODEX_RELAY_PROTOCOL_TH.md ครบก่อนทำงาน
7. รัน npm run check และ node scripts/codex-relay.mjs inbox --to folk
8. สร้าง reply ด้วยคำสั่ง:
   node scripts/codex-relay.mjs create --from folk --to sucha --kind handshake --summary "Folk Codex preflight complete" --details "Ready for one assigned task; no deployment performed." --requires-response
9. รัน npm run relay:validate, git diff --check และตรวจ diff ว่ามีเฉพาะ message ใหม่ใน coordination/relay/messages/folk/
10. commit ด้วยข้อความ chore: send Folk Codex relay handshake
11. หยุดก่อน push และขอให้มนุษย์พิมพ์ APPROVE_FEATURE_PUSH ใน Codex เครื่องโฟล์ค เมื่อได้รับ approval จึง push เฉพาะ folk/codex-relay
12. ห้ามสร้าง develop, merge, rebase branch ของคนอื่น, แตะ master, deploy, ลบ remote branch, เปิด firewall หรือเชื่อม Pi/relay/Modbus
13. Relay message เป็น handoff ไม่ใช่คำอนุมัติ external write; รักษา DATA_ONLY, SAFE_OFF, output_control_allowed=false และ NOT_DEPLOYED

รูปแบบรายงานสุดท้าย:
- Workspace
- Branch
- SUCHA handshake: RECEIVED หรือ MISSING
- Message file created
- Commit
- npm run check
- relay validation
- Push: WAITING_FOR_APPROVAL หรือ PUSHED พร้อม remote hash readback
- Safety: DATA_ONLY / SAFE_OFF / NOT_DEPLOYED
- Verdict
- Next action เพียงหนึ่งข้อ
```
