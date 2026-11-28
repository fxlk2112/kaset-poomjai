# Production release — batch income and missing records

- Owner: Codex for Folk, explicitly authorized release; SUCHA retains integration review.
- Branch: `codex/release-batch-income-20261128`; published source `folk/batch-income-repair`.
- Task / Scope: Deploy the latest frontend and verify copied income, original worksheet paste, missing-data repairs and consistent costs on the production release.
- Files changed: `js/batch-work.js`, `tests/batch-work.test.cjs`, `index.html`, `sw.js`, `COLLAB_STATUS.md`, and this release record. The runtime change fixes legacy non-material rows carrying stock links when copied; source records are unchanged.
- Commit: final deployed runtime `d244cb155b6e304ea999bbffc72975df116f5254`; main feature `364eab8`.
- Validation: `npm run check` **807 PASS**, relay **9 PASS**; public asset hashes, API health, browser desktop/mobile checks and persisted production QA ledger reconciliation passed.
- Deployment: **DEPLOYED**, explicitly approved by `APPROVE_PRODUCTION_DEPLOY` on 2026-11-28 for `farmultimate-solutions.pages.dev` and the three requested checks.
- Blocked / Risks: No deployment blocker. Source publication succeeded; GitHub PR creation returned `403 Resource not accessible by integration`, so no new PR or merge/remote CI pass is claimed. The isolated QA account/data remain as explicitly approved; credentials and state are private and ignored.
- Next action: Integration owner reviews the published feature branch into `develop` through normal GitHub access.

## Release identity

| Component | Verified value |
| --- | --- |
| Canonical site | https://farmultimate-solutions.pages.dev/ |
| Final deployment | `56a813f3-469a-43c1-ba05-fc913e630676` |
| Immutable production deployment | https://56a813f3.farmultimate-solutions.pages.dev/ |
| Source | `d244cb1` |
| Service-worker cache | `farmult-v225-batch-legacy-copy` |
| Batch asset | `js/batch-work.js?v=20261128batch3` |
| Repair asset | `js/project-data-repair.js?v=20261128repair1` |
| API health | POST `/api`, action `health`: HTTP 200, `ok:true`, `SENSOR_PHASE1_READ_ONLY`, output control false |

115 tracked public assets were assembled and checked against the final checkout. Test directories, source-derived fixtures and runtime/private data were excluded. Ten key live asset hashes match the checkout, including the index, service worker, batch and repair modules/styles, app routes, proposal and cycle notebook. The Pages Function was compiled from unchanged source and uses the existing same-origin service binding. Worker and proxy sources are unchanged from the prior deployed runtime `2988cc9`; no Worker redeployment, migration or configuration change was required.

The first deployment (`68ac01c8-e443-4aaa-a0bc-d4b105deb1e6`, feature `364eab8`) was superseded after live readback found the legacy service-copy issue. Production is selected through the existing Pages production environment labelled `master`; Git `master` and `develop` were not pushed, merged or altered.

## Canonical-site verification

- Existing authenticated farm session loaded the new assets. Pasting three synthetic Farm Record rows correctly identified the multi-line headers, actual quantity, purchase unit price, expense sign, income and supported service. Review showed expense 700 and income 2,000; these were drafts only.
- Removing the material quantity blocked review. Restoring it produced the expected review and required the explicit confirmation checkbox.
- Live copy exposed a legacy labor row with a retained stock ID. The original copy path treated it as inventory and blocked a non-material category. The final fix only keeps stock links for material categories, preserves the original expense amount and leaves the source unchanged. Regression coverage verifies five non-material categories, income, repeated commit, and unchanged inventory; actual material stock costing remains intact.
- Final canonical-site readback copied that legacy labor record with its original 1,500 expense, separated income and no stock deduction. No real activity was submitted. Test drafts were cleared; after reload the farm account retained 17 activities (12 recorded, 5 planned).
- Desktop and 390×844 mobile readback/screenshots checked the review form. Mobile document width stayed 390. Canonical-site error logs were empty at the final check.

## Production write acceptance — isolated QA account

Automatic approval review initially rejected creating permanent synthetic production records without explicit authorization. That command did not execute. The user then explicitly approved creation of a separate QA account and a 12-record synthetic test set, with final expense 900 and income 12,000. The normal public auth/save API created only that new account, with eight synthetic baseline records; no real farm account was seeded or overwritten.

Browser writes used the immutable URL of the **same final production deployment**, with `/api` routed to the production backend, keeping the user's canonical-site login/storage separate. A subsequent authenticated read through the canonical `/api` independently retrieved the saved QA state.

1. Opened seven incomplete historical records. Missing material quantity blocked confirmation. Filled synthetic dates, quantities and units; sponsored cash amounts remained read-only zero. The review showed seven existing-record updates and zero cost difference. Saved all seven; no tasks were added and existing income remained 5,000 with cost 100.
2. Copied the general-income source: income 5,000 and expense 100 were retained. Pasted three rows using the original Farm Record headers: fertilizer 25 kg / expense 700, general income 2,000, and supported labor / expense zero. Review showed four new tasks, cost 800 and income 7,000. Saved and reloaded through the live backend.
3. Attempted to copy the saved same-day income task again. The duplicate warning blocked confirmation without explicit acknowledgment of a genuinely separate job. No extra task was submitted; the draft was cleared.
4. Verified project, plot and crop-cycle views. The cycle split was fertilizer 700 and meals 200, total 900. Supported items/services remained zero. Reload retained 12 complete tasks; the missing-data count was zero.
5. Read the persisted QA state through the canonical API. Assertions verified 12 unique task IDs, seven original IDs repaired, four unique batch/row IDs, source references/links/notes/evidence arrays preserved, original income record retained, and stock unchanged. Standard hydration only added empty completion/watering fields to the original source task.

| Scope | Expense | Income | Net |
| --- | ---: | ---: | ---: |
| Plot | 900 | 12,000 | 11,100 |
| Crop cycle | 900 | 12,000 | 11,100 |
| Project | 900 | 12,000 | 11,100 |

These are explicitly synthetic test totals, not farm results. The actual seven source-workbook records in the local example were not filled with invented values or uploaded to production. The QA scenario uses external/sponsored items and does not certify a new live stock deduction; inventory commit/idempotence paths are covered by the regression suite. Google sign-in was not used in the isolated deployment origin; it emitted the expected unallowlisted-origin warning there. Email/password QA login and API persistence worked; the canonical site's Google configuration was unchanged.

## Evidence and safety

Private local evidence stays under ignored `tmp/batch-release-20261128/`: final check log, staged asset manifest, deployment readback, public hash/health report, persisted QA snapshot and `ledger-verification.json`. Browser evidence includes `canonical-paste-review.jpg`, `canonical-mobile-review.jpg`, `canonical-legacy-copy-fixed.jpg`, `qa-repair-mobile-review.jpg`, `qa-copy-income.jpg`, `qa-batch-review.jpg`, `qa-duplicate-blocked.jpg`, `qa-project-after-reload.jpg`, `qa-plot-totals.jpg` and `qa-cycle-costs.jpg`. Production credentials, account details, snapshots and private farm screenshots are not committed.

`DATA_ONLY / SAFE_OFF`, the Pi sole-writer boundary, stock accounting and same-origin API contracts remain intact. No hardware command, secret/config change, migration, protected-branch update or real farm/customer write occurred.
