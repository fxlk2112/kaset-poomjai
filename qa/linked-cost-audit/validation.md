# Linked chemical-cost audit

Date: 2026-11-25 (Asia/Bangkok). Result: no duplicate activity, expense or stock deduction found in the exercised local workflow.

## Isolation

The existing preview at `localhost:4178` contained an unfinished activity draft. Its draft prompt was closed without restoring, discarding or overwriting it. The original `127.0.0.1:4178` preview was also left intact. Actual saves used fresh synthetic state at `127.0.0.1:4180`, served by the existing reviewed loopback preview implementation through `serve-audit.mjs`. No real account, API, farm data or hardware was used. The temporary server was stopped after QA, and the browser viewport was reset.

## Actual browser workflow

1. Created an ordinary project **PRJ-2569-001 — [ทดสอบ] ตรวจต้นทุนยาไม่ซ้ำ**, scoped to synthetic plot 1 / corn round 2. The project initially had no tasks. Cycle baseline was **2,465 baht**.
2. Opened crop-cycle activity recording, selected spray, named the task **[ทดสอบยอด] ใช้ยาเชื่อมโครงการ**, and selected the recommended project before saving.
3. Selected synthetic stock product A, 500 ml, using only opened stock. Cost was **90 baht**. Added synthetic labor **210 baht**. Review showed the selected plot, round, project and **300 baht** total. Stock preview: sealed 28 -> 28 bottles; opened 500 -> 0 ml.
4. Saved through the normal activity form. Cycle history contained exactly one matching task. Its row opened `App.viewTask("idmwvm2cm577ajn")`. Cycle cost became **2,765 baht** (+300), with 90 more material cost and 210 more labor cost.
5. Material history showed the activity once, 500 ml, **90 baht material cost**, with the project code. This material subtotal intentionally excludes its labor; the complete activity and cycle totals include both.
6. Opened the project. It showed **1 / 1 completed task**, total **300 baht**. Its detail action referenced the same activity ID `idmwvm2cm577ajn`, not a copied activity.
7. Edited the existing task from the project, changing labor from 210 to **260 baht**. Project cost became **350 baht** while task count remained one. Opened stock stayed at 0 ml and sealed stock at 28 bottles. Reopened and saved the unchanged edit again: project still 350, no additional deduction.
8. Reloaded the page. Cycle cost was **2,815 baht** (+350 from baseline), including chemicals 180, fertilizer 975 and labor 1,660. No accumulated 300 + 350 cost.
9. Opened plot-wide history. Exactly one matching row opened the same ID, showing round 2, project code and **350 baht**. Plot-wide cost was **5,515 baht**, including its older crop round.
10. Reloaded and opened the project again: **one completed task, 350 baht**. Full task details showed material 90 + labor 260 and the same plot/cycle/project linkage. Browser error log was empty.

| Surface | Before new activity | After first save | After edit and reload |
|---|---:|---:|---:|
| Current cycle actual cost | 2,465 | 2,765 | 2,815 |
| Selected project actual cost | 0 (empty project) | 300 | 350 |
| Matching cycle-history rows | 0 | 1 | 1 shared activity |
| Matching plot-history rows | 0 (new unique task name) | — | 1 |
| Stock: sealed bottles / opened ml | 28 / 500 | 28 / 0 | 28 / 0 |

The plot, cycle and project display overlapping views of the same expense. Their displayed totals should not be summed together as three separate expenditures.

## Code and regression validation

- `js/projects.js`: `projectTaskList` filters the canonical `S.tasks` collection by project link. Attaching or moving a task updates its link; it does not create a cost ledger.
- `js/project-workspace.js`: `projectCosts` passes linked task IDs into `taskFinance`.
- `js/data.js`: `plotFinance` and `cycleFinance` also use `taskFinance`, which includes completed tasks only. `updateTask` edits the existing activity ID.
- `js/cycle-notebook.js`: history and notebook finances read the same tasks and canonical cost fields.
- New `tests/project-cost-reconciliation.test.cjs` exercises real `addTask`, `updateTask`, save/load, stock handling, project attach/move, plot/cycle/project/notebook/year totals, and planned/failed exclusions. Test edits supply both item details and the total, matching the actual form's save contract.
- `npm run check`: **657 passed, 0 failed**, relay **9/9** (`check.log`). No application code correction was required.

## Evidence and limits

Screenshots in this directory: `01-before-save.jpg`, `02-cycle-history.jpg`, `03-project-300.jpg`, `04-cycle-after-edit.jpg`, `05-plot-history.jpg`, `06-linked-detail-350.jpg`, `07-project-final.jpg`. Final plot, detail and project screenshots were visually inspected at 1440 × 940; DOM readback supplied precise values and shared activity IDs. The application followed its existing dark theme. This audit is focused on linkage/accounting, not a full visual or accessibility review.

This run covered one plot, one crop cycle, an ordinary project, stock material plus external labor, editing, unchanged resave and reload. Automated tests additionally covered relinking and planned/failed state transitions. Multi-plot saves, real cloud synchronization, simultaneous devices, request retry/double-click creation and production behavior were not newly verified. Separately creating the same real-world activity twice would still be two distinct records; project linking itself does not create a second record.

Deployment: **NOT_DEPLOYED**. No push, merge or production changes.
