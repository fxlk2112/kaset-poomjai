# FARMULTIMATE Two-Machine Collaboration

## Operating Model

```text
พี่ปิ๊ก PC  -> pick/<task> -> Pull Request -> develop
น้องโฟล์ค PC -> folk/<task> -> Pull Request -> develop
                                      |
                                      v
                    owner-approved release PR -> master -> Cloudflare deploy
```

แต่ละเครื่องต้องมี local clone ของตัวเอง GitHub เป็นตัวกลาง และห้ามเปิด source folder เดียวกันผ่าน SMB/shared drive เพื่อแก้พร้อมกัน.

Codex Worktree ใช้แยกงานหลายชิ้นภายในเครื่องเดียวได้ แต่ไม่ใช่ตัวซิงก์ข้ามเครื่อง. การส่งงานข้ามเครื่องใช้ commit, feature branch และ Pull Request.

การสื่อสาร Codex-to-Codex ใช้ message envelope บน branch แยกตาม
`docs/CODEX_RELAY_PROTOCOL_TH.md`. Relay ใช้ส่ง task/status/handoff เท่านั้น,
ไม่ใช้แทน source branch, Pull Request หรือ owner approval.

## One-time Setup Gates

1. Consolidate และ review งานที่ยังอยู่บน `sucha/sensor-phase1-local`.
2. Scan staged files ว่าไม่มี secret, farm coordinates, device identity หรือ private runtime data.
3. Push baseline ไป feature branch เท่านั้นหลัง `APPROVE_FEATURE_PUSH`.
4. สร้าง `develop` จาก baseline ที่พี่ปิ๊กยืนยันแล้ว.
5. ตั้ง GitHub branch protection:
   - no direct push to `master`
   - require Pull Request
   - require `npm-check`
   - require at least one human review
6. เชิญน้องโฟล์คเข้า private repository ด้วยบัญชีของน้องโฟล์คเอง ห้ามแชร์ token หรือบัญชี GitHub.

จนกว่า `origin/develop` จะมีและ `COLLAB_STATUS.md` เปลี่ยนเป็น `BASELINE_READY` เครื่องน้องโฟล์คต้องทำได้เฉพาะ preflight/read-only audit.

## Daily Workflow

เริ่มงาน:

```powershell
git status --short --branch
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c folk/<task-slug>
```

ถ้า working tree ไม่ clean ให้หยุดและตรวจเจ้าของไฟล์ก่อน ห้าม reset หรือ clean.

ก่อนส่งงาน:

```powershell
npm run check
git status --short
git diff --check
git diff --cached
```

จากนั้น stage เฉพาะไฟล์ใน scope, commit ขนาดเล็ก และ push feature branch หลังได้รับ `APPROVE_FEATURE_PUSH`.

## Hotspot Ownership

ไฟล์เหล่านี้ชนกันง่าย ต้องมี owner เพียงคนเดียวต่อรอบ:

- `js/app.js`
- `js/sensors.js`
- `js/farm-map.js`
- `css/style.css`
- `index.html`
- `sw.js`
- `.github/workflows/*`

บันทึก owner และ branch ใน `COLLAB_STATUS.md` ก่อนแก้. ถ้าทั้งสองงานต้องแตะไฟล์เดียวกัน ให้ merge งานแรกเข้า `develop` ก่อน แล้วให้งานที่สอง rebase/refresh จาก `develop`.

## Pull Request Order

1. PR เข้า `develop` เท่านั้นสำหรับงานปกติ.
2. ผู้ที่ไม่ได้เขียนโค้ดเป็น reviewer.
3. CI และ `npm run check` ต้องผ่าน.
4. UI PR แนบภาพ desktop/mobile หรือบอกเหตุผลที่ตรวจภาพไม่ได้.
5. Merge ทีละ PR แล้วให้ branch ที่เหลือ refresh จาก `develop`.
6. Release PR จาก `develop` ไป `master` ทำเมื่อพี่ปิ๊กอนุมัติ Production เท่านั้น.

## LAN Usage

อยู่ LAN เดียวกันช่วยให้ตรวจหน้า preview ได้ แต่ไม่จำเป็นต่อ Git collaboration.

- Preview ต้องเป็น static/read-only และ expose เฉพาะไฟล์เว็บที่จำเป็น.
- ห้าม bind `scripts/serve-local.mjs` เดิมออก LAN เพราะ server เดิมออกแบบไว้สำหรับ `127.0.0.1`.
- ห้ามเปิด firewall, Pi endpoint, Modbus หรือ relay เพื่อการ review UI.
- หากต้องการ LAN preview ให้ทำ hardened preview server เป็นงานแยกภายใต้ `APPROVE_LAN_PREVIEW`.

## Short Handoff Template

```text
Owner:
Branch:
Task:
Files changed:
Commit:
Validation:
Blocked/Risks:
Deployment: NOT_DEPLOYED
Next action:
```
