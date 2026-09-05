# Contributing to FARMULTIMATE

อ่าน `AGENTS.md`, `COLLABORATION.md` และ `COLLAB_STATUS.md` ก่อนเริ่มทุกครั้ง.

## Branch Contract

- `master`: production; owner-approved release only.
- `develop`: integration baseline after it exists on origin.
- `pick/<task>`: feature owned by Pick.
- `folk/<task>`: feature owned by Folk.
- หนึ่ง task ต่อหนึ่ง branch และหนึ่ง owner.
- ขอบเขตไฟล์ของแต่ละ owner อยู่ใน `docs/FEATURE_OWNERSHIP.md`.

หาก `origin/develop` ไม่มี ให้หยุดด้วย `BLOCKED_WAITING_FOR_BASELINE`. ห้ามสร้างงานจาก `origin/master` เพื่อแก้ขัด เพราะ branch นั้นอาจเก่ากว่างาน local ของพี่ปิ๊ก.

## Start a Task

```powershell
git status --short --branch
git fetch origin
git branch --remotes
git switch develop
git pull --ff-only origin develop
git switch -c folk/<task-slug>
```

เปลี่ยน prefix เป็น `pick/` สำหรับเครื่องพี่ปิ๊ก. อย่าใช้ชื่อ branch เดียวกันบนสองเครื่อง.

## Validate

```powershell
npm run check
git diff --check
git status --short
```

UI change ต้องตรวจหน้า local จริงและแนบ screenshot/readback. Safety-sensitive change ต้องยืนยันว่า `DATA_ONLY`, `SAFE_OFF` และ Pi 5 sole-writer ยังอยู่ครบ.

## Commit

```powershell
git add <only-files-in-scope>
git diff --cached
git commit -m "feat: concise task summary"
```

ห้ามใช้ `git add .` เมื่อ working tree มีงานหลายคนหรือหลาย task.

## Share a Feature Branch

หลัง `APPROVE_FARMULTIMATE_DEV_SETUP_ONCE` owner สามารถ push feature branch ตาม scope ที่ประกาศไว้ได้โดยไม่ต้องขออนุมัติ push ซ้ำ:

```powershell
git push -u origin folk/<task-slug>
```

เปิด Pull Request เข้า `develop`; ห้าม target `master` สำหรับงานปกติ.

การแตะ shared hotspot ต้องมี task lock ใน `COLLAB_STATUS.md` และให้ SUCHA เป็น integration owner. สิทธิ์ setup ครั้งเดียวไม่ครอบคลุม direct push เข้า `develop`, `master`, production deploy, secret/config write, destructive action หรือ hardware action.

## Resolve Concurrent Work

- ตรวจ `COLLAB_STATUS.md` ก่อนแก้ hotspot.
- ถ้ามี owner คนอื่น ให้เลือกไฟล์อื่นหรือรอ merge.
- หลัง PR แรก merge ให้ refresh branch ที่สองจาก `origin/develop`.
- ห้าม force push branch ของคนอื่น.

## Production Release

ไฟล์ `.github/workflows/deploy.yml` deploy อัตโนมัติเมื่อ push เข้า `master`. การ merge release PR ต้องมี `APPROVE_PRODUCTION_DEPLOY` จากพี่ปิ๊กและ readback หลัง deploy.
