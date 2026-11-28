# Production release — task statuses and planned progress

- Owner: Codex for Folk, user-authorized production release; SUCHA retains integration review.
- Branch: `codex/release-status-20261128`; published feature source `folk/status-progress`.
- Task / Scope: Deploy the latest status/progress fixes to the canonical site, verify live status consistency, and preserve seven incomplete worksheet entries. Do not save PDFs.
- Files changed: `COLLAB_STATUS.md` and this deployment record only. Application runtime comes unchanged from the accepted feature commit.
- Commit: Deployed runtime `a1ccb1d` (status/progress renderers, report pagination and cache wiring).
- Validation: Fresh `npm run check` 810/810 PASS; relay 9/9 PASS; 17 public asset hashes, same-origin API health, desktop/mobile browser readback, persisted-ledger verification and exact before/after QA-account comparison PASS.
- Deployment: **DEPLOYED** under the user's explicit `APPROVE_PRODUCTION_DEPLOY` on 2026-11-28 for `farmultimate-solutions.pages.dev`.
- Blocked / Risks: No release blocker. GitHub connector returned `403 Resource not accessible by integration` when opening a draft integration PR; source publication succeeded. No PR, remote CI or protected-branch merge is claimed. Mobile checks used a browser viewport rather than a physical phone.
- Next action: Integration owner reviews `folk/status-progress` into `develop` through normal GitHub access.

## Release identity

| Item | Verified value |
| --- | --- |
| Canonical site | https://farmultimate-solutions.pages.dev/ |
| Production deployment | `f05b6e34-fc29-4e8b-b19d-550c5f5507a6` |
| Immutable deployment | https://f05b6e34.farmultimate-solutions.pages.dev/ |
| Source | `a1ccb1d` |
| Service-worker cache | `farmult-v226-status` |
| Changed asset versions | `20261128status1` |
| API health | HTTP 200, `ok:true`, `SENSOR_PHASE1_READ_ONLY`, output control false |

114 public files were assembled directly from the accepted Git commit, excluding tests, README documentation, QA/private data and PDFs. Wrangler uploaded 113 static assets plus `_redirects` and compiled the existing Pages Function. All 17 checked canonical assets match the staged commit bytes, including every changed runtime module/style, index, service worker, runtime configuration and authentication module.

Initial assembly comparison identified Windows CRLF checkout differences; the final artifact uses canonical Git blob bytes after a clean public-source Git comparison. No application code was changed during release preparation.

Worker, Pages proxy and runtime API configuration sources match the previous deployed runtime. The existing same-origin `/api` service binding remains operational; no Worker redeployment, database migration, credential/configuration write or hardware action was required. The Pages production selector is labelled `master`; Git `master` and `develop` were not pushed or merged.

## Canonical-site browser verification

Reloaded the existing signed-in QA tab on the canonical origin, then checked desktop 1440×1000 and mobile 390×844:

- Project A shows 33 completed activities, seven marked “ทำแล้ว · ข้อมูลรอตรวจ”, and an explanation that there is no planned-work baseline. No `null%`, `NaN%`, `undefined%` or artificial 100% appears.
- The calendar uses the same baseline explanation for the historical QA project. The planned synthetic project shows two completed tasks out of three (67%), with one failed task shown separately.
- Overview shows six completed out of seven dated tasks, zero remaining and one failed. The failed task is not counted as pending.
- Project history says “บันทึกผลแล้ว 3” for two completed and one failed result; the completed summary says two. Plot and crop-cycle histories use the same labels.
- The incomplete fertilizer activity displays “ทำแล้ว · ข้อมูลรอตรวจ” in the activity list, project/plot/cycle history, details and disabled completion control. Missing quantity/date remain unspecified.
- At mobile width, document width remains 390 with no page-level horizontal overflow in the checked calendar/project views. Calendar and project status evidence was captured.
- Browser error log count was zero at the final check. Reload retained the new assets and original worksheet state. The QA worksheet project remains open for the user; temporary viewport override was reset.

No record-edit, completion, stock, sale or missing-data form was submitted during this release verification. No PDF export/print action was invoked and no PDF was saved.

## Data preservation and costs

Read the authorized QA account immediately before deployment and again after browser checks. The entire account snapshot compares exactly equal, including all 48 tasks. The 33 original worksheet records and seven incomplete records remain unchanged. Four missing dates remain blank, and sponsorship and sample images remain as before.

The existing synthetic ledger still reconciles: project/plot/crop-cycle task cost 250 baht = material 100 + labor 150; stock remains 7 kg, value 350 baht; the single sale remains 80 baht with cost of goods 50 and one private slip. No task, sale, deduction or expense was duplicated by deployment or viewing.

`qa/status-acceptance/verify.cjs` passed against the post-release snapshot. The prior four empty watering-list hydration defaults were already present before this release; no new data normalization or other account change occurred.

## Evidence

Private local evidence remains under ignored `tmp/status-release-20261128/`: `check.log`, `asset-hashes.json`, `deploy.log`, `deployments-before.json`, `deployments-after.json`, `public-readback.json`, `data-preservation.json`, before/after QA snapshots, and the desktop/mobile project, calendar and activity screenshots. Credentials, source-derived screenshots and account data are excluded from Git.

`DATA_ONLY`, `SAFE_OFF`, the Pi sole-writer boundary and canonical stock/cost accounting remain intact. This release does not change the previously reported QA-credential exposure or rotate authentication; no credential values were displayed or committed during this release.
