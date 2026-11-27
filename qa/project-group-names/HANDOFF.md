# Project group names — 2026-11-27

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/project-group-names`, based on `e27796d`; fetched `origin/develop` verified as an ancestor before work.
- Task / Scope: Add “จัดการกลุ่มทดลอง” to project work/measurement forms. Rename existing groups while keeping their identity and all recorded evidence.
- Files changed: `js/project-records.js`, `js/project-report.js`, `js/project-docx.js`, `css/project-workspace.css`, asset versions in `index.html` / `sw.js`, `tests/project-workspace.test.cjs`, `COLLAB_STATUS.md`, and this synthetic QA folder.
- Commit: The feature commit containing this handoff on the branch above.
- Validation: `npm run check` **727 passed, 0 failed**, relay validation 9 messages; desktop/mobile browser screenshots and readback described below; `git diff --check` passed.
- Blocked / Risks: No local blocker. This editor renames existing groups only; adding/removing groups or moving samples is outside this change. A trial shared with other projects uses the same canonical names. Production/cloud synchronization was not exercised by the isolated preview.
- Deployment: NOT_DEPLOYED. No push, migration, API/config change, production write or hardware action. DATA_ONLY / SAFE_OFF preserved.
- Next action: Review the new group-name editor in the local preview.

## Behavior

The modal shows each stable group code, sample count and editable name. It rejects blank names, names over 120 characters, duplicates, changed group identity, concurrent name edits and closed projects/trials. It saves through the existing rollback-capable project transaction and appends group-name change history to the trial. No observation, sample, photo, task, cost or stock ledger is rewritten by a rename.

Current measurement rows resolve group names through sample membership, including in-memory drafts, persisted drafts and previously confirmed records. This fixes stale names copied into older record rows. Live report tables and Word exports include a group column. Saved report editions retain their original names and data. Draft measurement values/notes/photos remain intact; rename does not confirm draft measurements or mark tasks complete.

## Checks

- Six new automated regressions: preservation of IDs/evidence/costs/stock/report editions; draft/saved-row name refresh; validation and closed-state protection; persistence rollback/retry; linked-trial isolation; live report and DOCX names versus frozen editions.
- Desktop 1560 x 1000: stored A-01 height 12 cm and leaf width 3 cm, saved report edition 1, then renamed A/B to “ปุ๋ยสูตร 1” / “ปุ๋ยสูตร 2”. Both names changed in rows; sample codes and numeric values remained intact.
- Duplicate names displayed “ชื่อกลุ่มต้องไม่ซ้ำกัน” without saving. Editing and canceling used the existing discard confirmation and left the saved names unchanged.
- Live report showed “ปุ๋ยสูตร 1” beside 12 / 3. Reopened edition 1 still showed the original “กลุ่มทดลอง” beside the same values.
- Mobile 390 x 844: editor controls and save button accessible; document scrollWidth 390. Renamed B to “ชุดควบคุม”, reloaded, reopened the editor and verified both persisted names. A-01 still held 12 / 3.
- Browser error log empty at the end of verification. Viewport override reset.
- DOCX group-column content verified by automated export test; this turn did not visually inspect Word or print/save a PDF. The PDF preview uses the same report table renderer.

## Evidence and preview

- `desktop-editor.png`: existing groups and editable names.
- `desktop-renamed.png`: renamed groups and preserved numeric values.
- `desktop-report.png`: live report using the new group name.
- `saved-report-original.png`: saved report retaining its original group name.
- `mobile-editor.png`: mobile group-name editor.
- `mobile-renamed.png`: mobile sample view with renamed group and unchanged values.

Run `node qa/project-group-names/serve-audit.mjs` and open `http://127.0.0.1:4188/?projectPreview=1`. This is a GET-only loopback preview using the previous synthetic legacy-project fixture. Existing previews on other ports are untouched; API access is rejected. Runtime logs are ignored. All captured names, records and measurements are synthetic.
