# Project suggestions in activity recording

2026-11-25 (Asia/Bangkok), build `20261125workflow7`.

## Implemented behavior

- Project selector is visible next to plot/cycle context on desktop and mobile, before cost entry/save.
- Active projects matching the exact plot/cycle are first. Plot-wide projects are next. Legacy unscoped projects can match from their existing linked tasks; explicit project scope takes priority.
- Ordinary and experimental projects both qualify. Closed projects are not suggested for new work; an existing closed-project link is preserved during editing.
- No automatic assignment. “ไม่อยู่ในโครงการ” remains available. “เลือกโครงการอื่น” reveals other active projects when needed.
- Changing plot/cycle clears an incompatible selection and explains why. A matching plot-wide selection stays selected across cycle changes.
- Multi-plot suggestions must cover every selected plot/cycle, not just the first. The existing form still applies one chosen project to the whole batch and states this beside the selector.
- A project with one stage uses that stage without an extra dropdown. Existing multi-stage selections and local drafts are preserved.
- Review includes project code/name/stage, or explicitly states that the activity has no project. The canonical save and cost/stock paths are unchanged.

## Actual browser walkthrough

The user's `127.0.0.1:4178` preview contained an unfinished activity draft. It was left intact. New-save QA used the same loopback server at the separate `localhost:4178` origin, with synthetic data. No account login, API, production or hardware action was performed.

1. Created synthetic ordinary PRJ-2569-001 “ดูแลแปลง 1 รอบนี้” from plot 1 / corn cycle 2. Opening activity recording showed one recommendation and initially selected “ไม่อยู่ในโครงการ”.
2. Selected that project for spray activity. Changing cycle to no-crop cleared the link; choosing plot 2 showed no matching project. Re-selecting plot 1 restored its recommendation, without selecting it automatically.
3. Adding plot 2 in multi-plot mode cleared the first plot's project. The selector explained that the chosen project would apply to every plot. Returned to single-plot mode.
4. Saved a draft with the project selected, reloaded at 390 × 844, resumed, and confirmed both the project and single stage remained selected.
5. Entered synthetic external material “ยาตัวอย่างสำหรับทดสอบระบบ”, 50 ml, total 30 baht. Review showed the same project code/name/stage, material quantity and cost. Saved through the normal form.
6. Cycle material history immediately showed the new activity with PRJ-2569-001. Cycle cost changed from 2,465 to 2,495 baht; project showed one completed task and 30 baht. No stock deduction applied to this external material.
7. On the original preview, opened an existing fertilizer task in edit mode without saving changes. It recommended three cycle-matched projects (ordinary and experimental), preserving PRJ-2569-002 and its “ติดตามผล” stage. “เลือกโครงการอื่น” revealed the unrelated manual-documentation project. Cancelled the edit.
8. Browser error log was empty. Temporary viewport override was reset, QA tab closed, and original crop notebook left open.

## Screenshot evidence

- `01-desktop-selected.jpg`: early dark desktop capture; form was scrolled above the project section. Not the final selector visual evidence.
- `02-mobile-restored.jpg`: initial restored draft; exposed dark-mode panel contrast issue, subsequently fixed.
- `03-mobile-review.jpg`: review before save; selected project and 30-baht entry visible. Earlier total-text contrast was subsequently fixed.
- [04-mobile-final.jpg](04-mobile-final.jpg): final dark mobile input, 390 × 844; readable plot/cycle and project selector; page width equals viewport width.
- [05-desktop-final.jpg](05-desktop-final.jpg): final light desktop edit form, 1440 × 940; plot/cycle, matched project, existing stage and other-project action visible.

Final screenshots were visually inspected from the saved files. DOM readback verified options and selected values independently.

## Validation and limits

`npm run check`: **648 passed, 0 failed**, relay **9/9**. See [check.log](check.log). Five new behavioral tests cover ranking/no mutation/no auto-selection, context changes, closed/explicit links, all-context multi-plot matching, and missing/no-crop/inconsistent scopes. Existing activity save, draft, stock and cost tests remain passing.

Actual browser checks covered selection, context changes, multi-plot filtering, draft restore, successful single-plot save and existing-task edit initialization. A multi-plot save, production/cloud sync, full keyboard/screen-reader use and measured contrast conformance were not newly tested. Existing loopback/same-origin and DATA_ONLY / SAFE_OFF boundaries are unchanged.

Deployment: **NOT_DEPLOYED**.
