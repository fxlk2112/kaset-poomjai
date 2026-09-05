# Prompt สำหรับส่งให้น้องโฟล์ค

ให้เปิด Codex ในโฟลเดอร์ local clone ของ `farmultimate-sensor-phase1` แล้วก๊อปข้อความในกรอบด้านล่างไปวางทั้งชุด.

```text
คุณคือ Codex ฝั่งเครื่องน้องโฟล์ค ซึ่งจะร่วมพัฒนา FARMULTIMATE กับพี่ปิ๊กและ SUCHA คนละเครื่อง แต่อยู่ LAN เดียวกัน

เป้าหมายรอบนี้คือ WORKSTATION_PREFLIGHT_ONLY: ตรวจความพร้อมและรายงาน ห้ามเริ่มแก้ feature จนกว่า shared baseline จะพร้อม

กติกาบังคับ:
1. ใช้ local clone ของ Git repository `farmultimate-sensor-phase1` บนเครื่องนี้เท่านั้น ห้ามเปิดหรือแก้ shared folder/working tree ของเครื่องพี่ปิ๊กผ่าน LAN
2. ห้ามขอหรือพิมพ์ token, password, cookie, private Git URL หรือ credential ในแชท ใช้ GitHub sign-in/credential manager ของเครื่องนี้เท่านั้น
3. หา Git root แล้วอ่าน `AGENTS.md`, `COLLABORATION.md`, `COLLAB_STATUS.md`, `CONTRIBUTING.md` และ `README` ก่อนทำอะไร
4. รัน read-only preflight: `git status --short --branch`, `git remote` เฉพาะรายชื่อ remote, `git branch --all`, ตรวจ Node/npm version และ `npm run check`
5. อนุญาตให้ `git fetch origin` ได้ แต่ห้าม push, merge, rebase, reset, clean, force checkout, deploy หรือเปลี่ยน remote
6. ตรวจว่า `origin/develop` มีจริงและ `COLLAB_STATUS.md` ระบุ `BASELINE_READY`
7. ถ้าอย่างใดอย่างหนึ่งยังไม่พร้อม ให้จบด้วย `BLOCKED_WAITING_FOR_PICK_BASELINE`; ห้ามใช้ `origin/master` หรือสร้าง develop เองแทน
8. ถ้า working tree มีไฟล์แก้ไขอยู่ ห้ามทิ้งไฟล์ ให้รายงานรายการแบบ path only และสถานะ `BLOCKED_DIRTY_WORKTREE`
9. LAN รอบนี้ใช้เป็นข้อมูลประกอบเท่านั้น ห้ามเปิด firewall, bind server เป็น `0.0.0.0`, เชื่อม Pi/relay/Modbus หรือเขียนระบบจริง
10. รักษา `DATA_ONLY`, `SAFE_OFF` และ Raspberry Pi 5 sole-output-writer ทุกกรณี

รูปแบบคำตอบสุดท้าย:
- Workspace
- Git root
- Branch
- Remote names (ห้ามแสดง URL)
- origin/develop: PRESENT หรือ MISSING
- COLLAB_STATUS: BASELINE_READY หรือสถานะที่พบ
- Working tree: CLEAN หรือ DIRTY
- Validation: จำนวน test ผ่าน/ไม่ผ่าน
- Safety: DATA_ONLY / SAFE_OFF / NOT_DEPLOYED
- Verdict: READY_FOR_TASK หรือ BLOCKED_WAITING_FOR_PICK_BASELINE หรือ BLOCKED_DIRTY_WORKTREE
- Next action เพียงหนึ่งข้อ

ห้ามแก้ไฟล์ ห้าม commit ห้าม push และห้าม deploy ในรอบ preflight นี้
```
