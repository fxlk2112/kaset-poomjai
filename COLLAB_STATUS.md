# FARMULTIMATE Collaboration Status

## Task lock — MULTI-PLOT-TYPE-REFRESH-20261128

- Owner: Codex for Folk, user-reported activity-form regression; SUCHA retains integration review.
- Branch: `codex/multi-plot-type-refresh`, source `9cac81f`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Restore multi-plot selection after changing the compact form's activity type, preserve selections across type changes, and verify allocation/cost/stock behavior locally.
- Files / lock: scoped `js/app.js` type-change hook, `js/task-wizard.js`, regression tests, `index.html` / `sw.js` asset versions and synthetic QA evidence. No overlapping active owner lock.
- Status: COMPLETE_LOCAL — compact dropdown refresh restored; 827 tests PASS and relay validation 9 PASS. Desktop/mobile UI and persisted synthetic two-plot allocation verified.
- Deployment: NOT_DEPLOYED. No production account write or inferred missing worksheet values.
- Validation / evidence: `qa/multi-plot-refresh/README.md`; 4 kg / 200 baht split into 1 kg / 50 and 3 kg / 150, stock 9 → 5 kg after reload. Seven incomplete fixture entries retain their missing values.
- Next action: Review this local fix for integration before a separately authorized production release.

## Task lock — RELEASE-LIGHT-THEME-20261128

- Owner: Codex for Folk, explicitly authorized production release; SUCHA retains integration review.
- Branch: `codex/release-light-theme-20261128`, source `344772c`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Deploy the latest light-theme and date/cycle-display fixes to the canonical Pages site, then verify light desktop/mobile through the existing QA account.
- Files / lock: this status and scoped release evidence only. No active conflicting lock; runtime remains the tested feature source.
- Status: DEPLOYED_AND_VERIFIED — runtime `344772c`; fresh check 824 PASS, relay 9 PASS, both required remote CI runs PASS. All 77 public asset hashes match; canonical-site desktop/mobile light-mode screenshot/readback passed.
- Deployment: Authorized by the user's `APPROVE_PRODUCTION_DEPLOY` in this chat for `farmultimate-solutions.pages.dev`. No backend source changes since the previous release; verify existing same-origin API capability. No hardware, schema, credential/config expansion or real farm-data write.
- Validation / evidence: `qa/light-theme/DEPLOYMENT-20261128.md`; Pages `a7b820be-41e7-4b95-91a2-d4d47ff100cf`. Existing backend/proxy unchanged; API healthy. No data forms submitted; seven incomplete entries remain pending.
- Integration: Draft PR https://github.com/fxlk2112/kaset-poomjai/pull/22 targets `develop`; source published to `folk/light-theme-surfaces`. Protected branches unchanged.
- Blocked / Risks: No release blocker; mobile verified by responsive viewport, not physical device.
- Next action: SUCHA reviews PR #22 in dependency order.

## Task lock — LIGHT-THEME-SURFACES-20261128

- Owner: Codex for Folk, user-requested light UI readability follow-up; SUCHA retains shared-shell integration review.
- Branch: `codex/light-theme-surfaces`, source `2be003c`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Inspect the supplied material-history light-theme screenshots; improve page/card/table separation within the existing green design. Verify light desktop/mobile and dark-mode regression locally.
- Files / lock: light surface/border tokens in `css/workspace.css`, material-history styles in `css/plot-materials.css`, matching `index.html` / `sw.js` versions, scoped synthetic QA evidence and this status. No active overlapping owner lock; no data or business-logic changes.
- Status: COMPLETE_LOCAL — light page/card/table/control separation improved. `npm run check`: 824 PASS, 0 FAIL; relay 9 PASS. Desktop/mobile screenshot/readback and dark-token comparison passed. See `qa/light-theme/HANDOFF.md`.
- Deployment: NOT_DEPLOYED. Keep prior no-deploy instruction; no production-account access or missing-record edits.
- Blocked / Risks: No blocker; mobile checked through viewport emulation. Shared light tokens affect owner views; representative farm overview and project list also inspected. Synthetic costs/stock and seven incomplete records unchanged.
- Next action: Review light-theme screenshots before any production release.

## Task lock — CYCLE-EXECUTION-FILE-DATES-20261128

- Owner: Codex for Folk, explicit user-requested Farm/Project follow-up; SUCHA retains integration review.
- Branch: `codex/cycle-execution-file-dates`, source `43e5902`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Guard missing/invalid attachment dates and represent partial/unsuccessful actual work in the crop-cycle overview; verify cost/stock idempotency and preserve seven incomplete records.
- Files / lock: `js/project-records.js`, the cycle journey renderer in `js/app.js`, scoped tests and synthetic QA evidence, matching `index.html` / `sw.js` cache wiring and this status. No overlapping active lock. No changes to canonical finance/stock mutations.
- Status: COMPLETE_LOCAL — both read-model fixes implemented. `npm run check`: 824 PASS, 0 FAIL; relay 9 PASS. Desktop/mobile screenshot/readback, mandatory quantity/cost review, repeat save/reload and persisted cost/stock reconciliation passed. See `qa/cycle-display/HANDOFF.md`.
- Deployment: NOT_DEPLOYED. User explicitly requested no deployment; production accounts and the seven real incomplete entries will not be written.
- Blocked / Risks: No blocker; mobile evidence uses viewport emulation. Seven incomplete synthetic records preserved in local acceptance; seven real entries were not accessed or modified.
- Next action: SUCHA reviews this feature branch into `develop`.

## Task lock — RELEASE-INTEGRITY-20261128

- Owner: Codex for Folk, explicitly authorized production release; SUCHA retains integration review.
- Branch: `codex/release-integrity-20261128`, source `f55802b`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Release the four High fixes to the canonical Pages site and existing backend; verify isolated live QA sync, actual costs and inventory without duplicate costs. Preserve all seven incomplete worksheet entries.
- Files / lock: this status, scoped release/QA evidence and acceptance helpers only. No other active owner lock overlaps. Runtime source remains the tested feature commit unless acceptance reveals a required fix.
- Status: DEPLOYED_AND_VERIFIED — runtime `f55802b`; 820 checks and relay 9 PASS. All 77 canonical public asset hashes match. Live QA repeated save, independent-client sync, private file download, cost and stock reconciliation PASS; all 33 worksheet records including seven incomplete entries are unchanged.
- Deployment: Approved by the user's `APPROVE_PRODUCTION_DEPLOY` in this chat for `farmultimate-solutions.pages.dev` plus backend. No hardware, schema migration, credential/config expansion or real farm-data write.
- Validation / evidence: `qa/high-integrity/DEPLOYMENT-20261128.md`; Pages `d5a725d5-aefd-405f-b1c2-8c2cc45ab80d`, backend `786ac3e0-7151-4163-8819-7b6791ff1fab`. Desktop/mobile browser readback and final API preservation check passed.
- Integration: Draft PR https://github.com/fxlk2112/kaset-poomjai/pull/20 targets `develop`; created through existing GitHub CLI access after the connector returned 403.
- Blocked / Risks: No release blocker. Physical phones and browser file-picker upload remain untested. Minor attachment-date and cycle-timeline display follow-ups are recorded in the release evidence. Source published to `folk/high-integrity-fixes`; protected branches unchanged.
- Next action: SUCHA reviews `folk/high-integrity-fixes` into `develop`.

## Task lock — HIGH-INTEGRITY-20261128

- Owner: Codex for Folk, explicitly requested cross-module audit fixes; SUCHA retains integration review.
- Branch: `codex/high-integrity-fixes`, source `fed1456`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Fix project attachment cloud size mismatch, preserve actual consumption/cost independently of failed outcomes, distinguish unknown material quantity from zero, and build/validate one complete same-origin Pages release artifact. Preserve all seven incomplete worksheet records. No deployment.
- Files / lock: scoped attachment/auth/Worker API code and tests; canonical task finance/stock helpers and dependent farm/project renderers; release assembly/check scripts and `.github/workflows/deploy.yml`; matching UI styles/asset wiring, tests, synthetic QA evidence and this status file. No conflicting active owner found; previous locks are completed/history. Shared changes remain subject to SUCHA integration review.
- Status: COMPLETE_LOCAL — all four High fixes implemented and locally verified; no production access or deployment.
- Validation: `npm run check`: 820 PASS, 0 FAIL; relay 9 PASS; release artifact/proxy contract PASS. Local desktop/mobile readback confirms 1 kg usage, 50 baht cost, stock 10 → 9 after repeat save/reload; seven synthetic incomplete entries unchanged. See `qa/high-integrity/HANDOFF.md` for scope, evidence and limits.
- Commit: Feature commit containing `qa/high-integrity/HANDOFF.md`.
- Blocked / Risks: Browser file-picker upload blocked by extension file-access permission; upload/download/auth/retry covered by API integration tests. Physical phones and deployed Cloudflare runtime not tested. Backend document capability must be released before frontend in a separately approved release.
- Deployment: NOT_DEPLOYED. No production data, secret/config, hardware or protected-branch writes.
- Next action: SUCHA reviews this local branch for integration into `develop`.

## Task lock — RELEASE-STATUS-20261128

- Owner: Codex for Folk, explicitly authorized production release; SUCHA retains integration review.
- Branch: `codex/release-status-20261128`, source `a1ccb1d`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Deploy the latest status/progress fixes to `farmultimate-solutions.pages.dev` and verify canonical-site desktop/mobile readback. Preserve all seven incomplete worksheet entries; do not save PDFs.
- Files / lock: this status file and scoped release evidence only; no additional feature changes or conflicting active owner found.
- Status: DEPLOYED_AND_VERIFIED — runtime `a1ccb1d`, full check 810 PASS, relay 9 PASS; 17 canonical asset hashes and same-origin API health PASS. Desktop/mobile status readback and whole-QA-account before/after equality PASS; seven incomplete entries unchanged. No PDFs saved.
- Deployment: DEPLOYED under the user's `APPROVE_PRODUCTION_DEPLOY` on 2026-11-28; production Pages deployment `f05b6e34-fc29-4e8b-b19d-550c5f5507a6`. Existing backend/binding unchanged. See `qa/status-acceptance/DEPLOYMENT-20261128.md`.
- Blocked / Risks: No deployment blocker. Source published to `folk/status-progress`; GitHub connector returned 403 when creating the integration PR. No protected-branch update, migration, configuration, hardware or field-data write.
- Next action: Integration owner reviews `folk/status-progress` into `develop` through normal GitHub access.

## Task lock — STATUS-MOBILE-ACCEPTANCE-20261128

- Owner: Codex for Folk, explicitly requested Farm/Project/Commerce follow-up; SUCHA retains shared integration review.
- Branch: `codex/status-mobile-acceptance`, source `0490f16`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Unify planned progress and work/data-completeness status across surfaces; verify mobile entry, actual proposal/report PDFs, payment slips and stock without duplicate costs. Preserve all 33 worksheet records including seven incomplete records.
- Files / lock: scoped status renderers in `js/projects.js`, `js/farm-calendar.js`, `js/farm-overview.js`, project/history/report modules and relevant `js/app.js`/`js/data.js` helpers; matching styles/tests; `index.html`/`sw.js`; dedicated QA harness/evidence and this status. Narrow entry/sales fixes only if acceptance exposes them. No conflicting active lock found.
- Status: COMPLETE_LOCAL — null progress removed; shared outcome/completeness labels and failed-work counts aligned; actual PDF pagination corrected.
- Validation: Full check 810 PASS; relay 9 PASS. Desktop/mobile browser readback, actual proposal/report PDFs, local and authorized production QA saves/photos/slips, edit/resave/reload and canonical ledger reconciliation PASS. All 33 original worksheet records and seven incomplete records unchanged. See `qa/status-acceptance/HANDOFF.md`.
- Commit: Feature commit containing `qa/status-acceptance/HANDOFF.md`.
- Blocked / Risks: Physical-phone OS/browser checks not performed. QA credentials appeared in a native-window diagnostic; stopped that inspection and notified the user. No credential values in committed evidence.
- Deployment: NOT_DEPLOYED. Only authorized synthetic QA data was written on the canonical site; new status/PDF code remains local. No hardware, schema or secret/config changes.
- Next action: Integration-owner review of this branch for `develop`.

## Task lock — PUBLISH-SYNGENTA-DEMO-20261128

- Owner: Codex for Folk, explicit user request to publish the existing worksheet example to the separate production QA account.
- Branch: `codex/publish-syngenta-demo-20261128`, source `a4e723c`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Append the saved local worksheet example, its linked plot/cycle and labelled sample images to the existing QA account; preserve seven incomplete records and every original amount/date/quantity.
- Files / lock: this status file and scoped QA handoff only. Transfer scripts, data and credentials stay ignored. No application or shared contract changes.
- Status: TRANSFERRED_AND_VERIFIED — 33 source records and two labelled sample photos available in the separate production QA account. All seven incomplete records preserved; existing 12 QA records unchanged.
- Validation: Original workbook/source reconciliation, revision-guarded append, exact API readback before and after browser login, unique IDs and project/plot/cycle finance agreement PASS. Canonical-site project, seven-row repair table and report/photo readback PASS. See `qa/syngenta-batch-example/PRODUCTION-EXAMPLE-20261128.md`.
- Deployment: No code deployment; the user explicitly authorized this QA-account data transfer on 2026-11-28. Real farm accounts and the original workbook remain unchanged.
- Next action: User tries project `PRJ-DEMO-A-002` in the signed-in QA browser tab, leaving missing inputs blank until confirmed.

## Task lock — RELEASE-BATCH-INCOME-20261128

- Owner: Codex for Folk, explicitly authorized production release; SUCHA retains integration review.
- Branch: `codex/release-batch-income-20261128`, source `364eab8`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Deploy the latest batch entry, income copy, original worksheet paste and missing-data repair UI to the canonical site; verify live flows and consistent costs.
- Files / lock: this status file and scoped release evidence; live readback exposed legacy non-material stock links, so the lock also covers the narrow copy fix in `js/batch-work.js`, its regression tests, `index.html` and `sw.js` cache wiring. Existing backend and hardware contracts are unchanged.
- Status: DEPLOYED_AND_VERIFIED — final runtime `d244cb1`, full check 807 PASS and relay 9 PASS. Live isolated QA saved/reloaded all three flows; canonical-site readback confirmed the legacy service-copy fix.
- Deployment: DEPLOYED under the user's `APPROVE_PRODUCTION_DEPLOY` on 2026-11-28; final Pages deployment `56a813f3-469a-43c1-ba05-fc913e630676`. The user separately approved an isolated QA account and 12 synthetic records. Existing farm records were not submitted or changed by testing.
- Blocked / Risks: No deployment blocker. GitHub connector cannot create an integration PR (403); source is published to `folk/batch-income-repair`. See `qa/batch-income-repair/DEPLOYMENT-20261128.md` for evidence and limits.
- Next action: Integration owner reviews the published feature branch into `develop` through normal GitHub access.

## Task lock — BATCH-INCOME-MISSING-DATA-20261128

- Owner: Codex for Folk, user-authorized Farm/Project follow-up; SUCHA retains integration review.
- Branch: `codex/batch-income-missing-data`, source `b3a0ae9`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Preserve copied general income and sponsorship, recognize original Farm Record columns, and review/update incomplete project records in one table without duplicate financial entries.
- Files / lock: `js/batch-work.js`, `css/batch-work.css`, new scoped project data-repair module/style, project/history/notebook entry and status hooks, scoped app route, `index.html` / `sw.js`, focused tests, scoped QA, and this status file. No conflicting active lock found. No backend or hardware contract changes.
- Status: COMPLETE_LOCAL — ready for integration review; real missing values remain awaiting field evidence.
- Validation: `npm run check` 805 tests PASS; relay 9 PASS; desktop/mobile browser readback and screenshots; seven synthetic repairs plus income copy/original-header paste saved/reloaded through local API; source workbook and original 33 records unchanged. See `qa/batch-income-repair/HANDOFF.md`.
- Deployment: NOT_DEPLOYED.
- Next action: Fill the seven real records with confirmed field values and review the existing-record updates before confirming.

## Task lock — SYNGENTA-BATCH-EXAMPLE-20261128

- Owner: Codex for Folk, user-requested workbook example; SUCHA retains integration review.
- Branch: `codex/syngenta-batch-example`, source `b9f8cb9`; `origin/develop` is an ancestor.
- Task / Scope: Rebuild the Sheet A example using the new batch entry workflow in a separate local account, reconcile source rows and sponsorship, preserve missing inputs explicitly.
- Files / lock: `qa/syngenta-batch-example/**` and this status file. Source-derived data, screenshots and private runtime stay ignored; no original workbook or prior example overwrite.
- Status: LOCAL_COMPLETE. Rebuilt the example in an isolated local account, with source-derived artifacts kept private.
- Validation: `npm run check` 793/793 PASS; relay 9/9. All source rows reconciled, two batch UI saves and reload verified; project/plot/cycle totals agree without duplicate rows. Desktop/mobile readback and labelled sample photos verified. See `qa/syngenta-batch-example/HANDOFF.md` for evidence and limits.
- Deployment: NOT_DEPLOYED. No production, hardware or external-service write.
- Next action: Review the new local example and identify missing source dates/quantities.

## Task lock — BATCH-WORK-ENTRY-20261128

- Owner: Codex for Folk, explicitly requested Farm/Project entry follow-up; SUCHA retains integration review.
- Branch: `codex/batch-work-entry`, source `2a89f72`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Batch activity table, copy previous work, spreadsheet paste, quantity/cost review and atomic idempotent recording through the canonical task/stock ledger.
- Files / lock: new scoped batch entry JS/CSS, tests and synthetic QA; entry links in farm/project/cycle surfaces, scoped `js/app.js` routing if needed, `index.html` / `sw.js`, and this status file. No conflicting active owner found.
- Status: LOCAL_COMPLETE. Batch table, previous-work copy, TSV/CSV paste, account-scoped drafts and review-before-save implemented through the existing canonical task/stock ledger.
- Validation: `npm run check` 793/793 PASS; relay 9/9. Desktop 1440x940/mobile 390x844; real synthetic API save/edit/reload, duplicate guards and persisted ledger verification PASS. See `qa/batch-work/HANDOFF.md`.
- Commit: Feature commit containing `qa/batch-work/HANDOFF.md`.
- Blocked / Risks: No implementation blocker; one plot/cycle per batch, completed activities only. Duplicate-content warnings supplement stable batch/row retry IDs. Existing single-entry form remains available for harvest, inspections and attachments.
- Deployment: NOT_DEPLOYED. No production write, migration or hardware action is in this task.
- Next action: Integration-owner review of this branch for `develop`.

## Task lock — RELEASE-DAILY-ENTRY-20261128

- Owner: Codex for Folk, explicit production release requested in this chat; SUCHA retains integration review.
- Branch: `codex/release-daily-entry-20261128`, source `5a24672`.
- Task / Scope: Publish the latest approved frontend to `farmultimate-solutions.pages.dev`, preserve its existing same-origin backend, and verify entry/history/cost views on production without submitting test records.
- Files / lock: this status file and scoped release evidence; production readback exposed legacy auto-title restoration, so lock also covers `js/task-wizard.js`, its regression test and `index.html` / `sw.js` cache wiring for that narrow fix.
- Status: DEPLOYED_AND_VERIFIED. User supplied `APPROVE_PRODUCTION_DEPLOY` on 2026-11-28, naming the canonical site and production readback. Final runtime `2988cc9` includes a narrow legacy draft-title restoration fix discovered during live inspection.
- Validation: fresh `npm run check` 773/773; relay 9/9; production asset hashes, API health, desktop/mobile entry/history/cost readback and unchanged existing totals passed. Worker and Pages Function source unchanged from prior approved deployed runtime `845ea5b`.
- Deployment: DEPLOYED to `farmultimate-solutions.pages.dev`, production deployment `8189927f-12d1-4fde-b48a-9d55e869eb8d`. No Git master/develop push or merge, database migration or hardware action. See `qa/daily-entry-history/DEPLOYMENT-20261128.md`.
- Blocked / Risks: Source published to `folk/daily-entry-history`. PR creation is blocked by GitHub integration 403; automatic approval review rejected the proposed credential-manager fallback, which did not run. Production writes were not exercised with real farm data.
- Next action: Integration owner opens/reviews the published feature branch into `develop` using normal GitHub access.

## Task lock — DAILY-ENTRY-HISTORY-CLARITY-20261128

- Owner: Codex for Folk, user-authorized farm/project follow-up; SUCHA retains shared integration review.
- Branch: `codex/daily-entry-history-clarity`, source `6f5fdc6`; refreshed `origin/develop` retained as ancestor.
- Task / Scope: Shorten daily activity entry, show project records as a readable table, separate labor from material summaries, and separate recorded work from planned progress. Preserve quantity/cost review and canonical accounting without duplicate charges.
- Files / lock: task/project entry, history, progress, report and plot-material modules/styles; scoped `js/app.js`, `js/data.js`, dashboard/notebook hooks, asset wiring `index.html` / `sw.js`, related tests, scoped QA and this status file. No other owner's conflicting active lock found.
- Status: LOCAL_COMPLETE. Daily entry, shared table history, explicit expense categories and planned-work progress implemented. No production migration, backend contract changes or hardware actions.
- Validation: `npm run check` 772/772; relay 9/9. Desktop/mobile UI, quantity/cost guards, real synthetic API save/edit/reload/photo, planned completion and canonical totals verified. See `qa/daily-entry-history/HANDOFF.md`.
- Commit: Feature commit containing `qa/daily-entry-history/HANDOFF.md`.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF and same-origin API retained.
- Next action: Integration-owner review of this branch for `develop`.

## Task lock — PROPOSAL-FIRST-SPONSORSHIP-20261128

- Owner: Codex for Folk, user-authorized follow-up; SUCHA retains shared integration review.
- Branch: `codex/proposal-first-sponsorship`, source `9ddebea`; fetched `origin/develop` verified as ancestor.
- Task / Scope: Proposal before work, optional task breakdown, normal activity recording linked to the project, explicit requested/approved budgets, and supplied materials at zero cash cost with separate reporting.
- Files / lock: project modules/styles, focused `js/app.js` / `js/data.js` / wizard hooks and `js/auth.js` stale-tab acknowledgement guard, asset wiring, tests, scoped QA and this status file. No conflicting active owner found.
- Status: LOCAL_COMPLETE. Proposal-first workflow, sponsorship, shared material quantity validation and stale-reader sync guard implemented. Original workbook and saved editions preserved; no production data migration.
- Validation: `npm run check` 761/761; relay 9/9. Desktop/mobile browser readback, actual Word download, API reload and original-data invariants verified. See `qa/proposal-first-sponsorship/HANDOFF.md` for evidence and limits.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF and same-origin API unchanged.
- Next action: Integration-owner review of this scoped branch for `develop`.

## Task lock — PROJECT-RECORDS-FINANCE-20261128

- Owner: Codex for Folk, user-authorized follow-up; SUCHA retains shared integration review.
- Branch: `codex/project-records-finance`, source `f3f607a`; fetched `origin/develop` verified as ancestor.
- Task / Scope: Preserve and enter non-harvest income; separate historical work from incomplete data; reviewed activity grouping; project income/completeness reporting; fix harvest state, proposal intent and report contrast.
- Files / lock: project modules and styles, new historical-record module, focused hooks in `js/app.js`, `js/data.js`, `js/task-wizard.js`, `js/workspace-flows.js`, `js/cycle-notebook.js`, `js/project-workspace.js`, asset wiring `index.html` / `sw.js`, tests, scoped QA and this status file. No other active conflicting owner found.
- Status: LOCAL_COMPLETE. Preserve original source records, canonical accounting, material confirmation and saved report editions. No production data migration.
- Commit: Feature commit containing `qa/project-records-finance/HANDOFF.md`.
- Validation: `npm run check` 750/750; relay 9/9. Desktop/mobile light/dark screenshots and readback, same-origin API persistence, income unchanged edit, historical entry/edit, reviewed grouping/ungrouping, canonical totals, saved editions and downloaded Word verified. See scoped handoff for evidence and limitations.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF and same-origin API unchanged.
- Next action: Submit this scoped change to the integration owner for review into `develop`.

## Task lock — SYNGENTA-PROJECT-AUDIT-20261127

- Owner: Codex for Folk, user-requested test; SUCHA retains integration review.
- Branch: `codex/syngenta-project-audit`, source `2d515c4`; `origin/develop` verified as ancestor.
- Task / Scope: Read the supplied A sheet, populate a project in isolated loopback QA, attach clearly labelled sample images, reconcile data and document reproducible website defects.
- Files / lock: `qa/syngenta-project/`, local ignored runtime artifacts and this status file. No product changes or shared contract changes planned.
- Status: AUDIT_COMPLETE; confirmed P1 non-harvest income loss remains unfixed. QA data restored after reproduction. Source workbook remains unchanged; private workbook contents and screenshots stay in ignored storage.
- Validation: 33 source rows mapped; two labelled sample images; project/plot/cycle/notebook accounting reconciled; medicine quantity guard and Word export checked. `npm run check` 733/733; relay 9/9. Desktop/mobile screenshot evidence retained privately. See `qa/syngenta-project/README.md`.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF preserved.
- Next action: Fix preservation and entry of non-harvest income before release review.

## Task lock — PROJECT-SETUP-RELEASE-CHECKS-20261127

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/project-setup-release-checks`, source `41b4ad4`; fetched `origin/develop` verified as ancestor.
- Task / Scope: Unified experiment preparation (groups, sample count, metrics and review); project dark-mode contrast; end-to-end verification using shipped Pages/Worker handlers with isolated local SQLite/photo storage.
- Files / lock: project modules/styles, new scoped setup module, asset wiring `index.html` / `sw.js`, related tests, synthetic local backend QA and this status file. No conflicting active owner found. No production auth or backend contract changes planned.
- Status: LOCAL_IMPLEMENTED; PDF_FILE_CHECK_PENDING. DATA_ONLY / SAFE_OFF and same-origin API preserved.
- Commit: Feature commit on this branch containing `qa/project-setup/HANDOFF.md`.
- Validation: `npm run check` 733/733, relay 9/9. Desktop 1560 x 1000 and mobile 390 x 844 screenshots/readback. Shipped Pages/Worker handlers persisted synthetic projects, four measurements, one photo and one report edition; a second browser loaded them. Word file downloaded and inspected. Structure/ID/evidence/storage-failure/accounting regressions passed.
- Blocked / Risks: Native PDF print window could not be controlled by the available UI tools; no saved-PDF pass claimed. Local SQLite/photo adapters were used, not live Cloudflare resources. Full details in `qa/project-setup/README.md`.
- Deployment: NOT_DEPLOYED.
- Next action: Verify a saved PDF from the tested report before release review.

## Task lock — PROJECT-GROUP-NAMES-20261127

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/project-group-names`, source `e27796d`; fetched `origin/develop` verified as ancestor.
- Task / Scope: Rename existing experimental groups from the project record screen, preserving sample IDs, measurements, photos, accounting and saved report editions. Show current names in live records and reports.
- Files / lock: `js/project-records.js`, `js/project-report.js`, `js/project-docx.js`, scoped project CSS, asset versions in `index.html` / `sw.js`, project tests, synthetic QA and this status file. No conflicting active owner found.
- Status: LOCAL_COMPLETE. DATA_ONLY / SAFE_OFF and same-origin API unchanged.
- Commit: Feature commit on `codex/project-group-names` containing `qa/project-group-names/HANDOFF.md`.
- Validation: `npm run check` 727/727, relay 9/9; browser screenshots/readback at 1560 x 1000 and 390 x 844. Rename, duplicate rejection, cancel, mobile save/reload and frozen-versus-live report names verified. Regression checks preserve IDs, measurements, photos, costs, stock and historical editions; Word output checked by test.
- Deployment: NOT_DEPLOYED.
- Next action: Review the new group-name editor in the local preview.

## Task lock — PROJECT-TASK-RECORD-KIND-20261127

- Owner: Codex for Folk, follow-up to the approved project workflow; SUCHA retains integration review.
- Branch: `codex/project-task-record-kind`, source `23e9bf1`; fetched `origin/develop` verified as ancestor.
- Task / Scope: Show work/evidence recording for preparation and summary tasks; show measurements only for measurement tasks inside an experimental project. Preserve legacy records and canonical accounting.
- Files / lock: `js/project-workspace.js`, `js/project-records.js`, scoped project styles, `index.html`, `sw.js`, related tests and isolated QA. No conflicting active owner found.
- Status: LOCAL_COMPLETE. DATA_ONLY / SAFE_OFF, API and production data unchanged.
- Commit: Fix commit on `codex/project-task-record-kind` containing `qa/project-task-record-kind/HANDOFF.md`.
- Validation: `npm run check` 721/721, relay 9/9; desktop 1560 x 1000 and mobile 390 x 844 screenshots/readback. Preparation completed without measurements; baseline values survived mode switches and reload; project cost stayed 0. Legacy records, closed-project guard and cost invariance covered by regression tests.
- Deployment: NOT_DEPLOYED.
- Next action: Review the corrected task forms in the local preview.

## Task lock — PROJECT-PROPOSAL-WORKFLOW-20261127

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/project-proposal-workflow`, source `d3c9369`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Implement the five approved green project screens: proposal draft, task review, ordinary project workspace, material work entry and editable report with Word/PDF export. Reuse canonical activities, costs and stock review.
- Files / lock: project modules and styles, new scoped workflow module/style and tests; scoped hooks in `js/app.js`, asset wiring in `index.html` / `sw.js`, isolated synthetic QA, `design-qa.md`, this status file. No conflicting active owner found.
- Status: LOCAL_COMPLETE. Existing experiments, DATA_ONLY / SAFE_OFF and same-origin API preserved. No new accounting ledger or production writes.
- Commit: Feature commit on `codex/project-proposal-workflow` containing `qa/project-proposal/HANDOFF.md`.
- Validation: `npm run check` 716/716, relay 9/9; desktop/mobile browser screenshots and actual proposal-to-report workflow. Material cost 600 + labor 200 = 800 once across project/plot/cycle; stock 50 → 42 kg, draft/cancel and return-to-plan/recomplete checked. Word downloaded and inspected; PDF print preview inspected. See `design-qa.md` and the handoff.
- Deployment: NOT_DEPLOYED.
- Next action: Review the local project workflow at `http://127.0.0.1:4186/?projectPreview=1`.

## Task lock — FARM-CALENDAR-20261127

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/farm-calendar-refresh`, source `5823f34`; refreshed `origin/develop` is an ancestor.
- Task / Scope: Adapt the supplied calendar reference to the existing green farm app: month/week/day views, selected-day work, related projects, filters and mobile week-first layout. Read canonical tasks and reuse material completion review.
- Files / lock: new `js/farm-calendar.js`, `css/farm-calendar.css`; scoped calendar link in `js/app.js`, asset wiring `index.html` / `sw.js`, isolated QA preview and tests, `design-qa.md`, this status file. No conflicting active owner found.
- Status: LOCAL_COMPLETE. No new task, cost or stock ledger; retain DATA_ONLY / SAFE_OFF and same-origin API.
- Commit: HEAD of `codex/farm-calendar-refresh`, feature commit containing `qa/farm-calendar/handoff.md`.
- Validation: `npm run check` 703/703, relay 9/9; desktop/tablet/mobile screenshots and UI readback; navigation, filters, plan presets, material review/cancellation and one-time cost update verified. Details: `qa/farm-calendar/handoff.md`.
- Deployment: NOT_DEPLOYED.
- Next action: Review the local calendar at `http://127.0.0.1:4185/?projectPreview=1&view=calendar`.

## Task lock — OPTIONAL-PLANNED-TIME-20261127

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/optional-planned-time`, source `0e8f0dc`; refreshed `origin/develop` verified as ancestor.
- Scope / files: Optional planned time in the canonical activity form, draft/review/edit flow, repeated plans and overview; `js/app.js`, `js/data.js`, `js/task-wizard.js`, `js/farm-overview.js`, `css/farm-overview.css`, asset versions in `index.html` / `sw.js`, synthetic overview fixture/preview cleanup, focused tests and QA evidence. No other active owner found for this scope.
- Status: LOCAL_COMPLETE. Optional time saves/edits/clears and survives reload/drafts. Actual completion time and canonical cost/stock review preserved. Invented sample times removed only from isolated QA data.
- Commit: HEAD of `codex/optional-planned-time`, feature commit containing `qa/farm-overview/planned-time-handoff.md`.
- Validation: `npm run check` 696/696, relay 9/9; browser readback and screenshots at 1440, 1024, 390 and 360 px; empty-time, explicit-time, reload, clear, draft/resume, review and material-review/cancel checked. No horizontal overflow or observed console errors.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF and same-origin API unchanged.
- Next action: Review the updated local preview at `http://127.0.0.1:4185/?projectPreview=1`.

## Task lock — FARM-OVERVIEW-20261127

- Owner: Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- Branch: `codex/farm-overview-refresh` (preserves `9577530`; refreshed `origin/develop` is an ancestor).
- Task / Scope: Approved desktop/mobile farm overview, date selection, today/upcoming work, project progress, collapsed farm finances and honest save feedback. Reuse canonical activities and material completion review.
- Files: `js/farm-overview.js`, `css/farm-overview.css`, minimal `js/app.js` save notifications and `js/workspace-flows.js` financial scope placement, `index.html`, `sw.js`, tests, `qa/farm-overview/`, `design-qa.md`, this status file. No backend changes.
- Status: LOCAL_COMPLETE. No active conflicting owner found for this scope; shared integration review retained by SUCHA.
- Commit: HEAD of `codex/farm-overview-refresh`, feature commit containing `qa/farm-overview/handoff.md`.
- Validation: `npm run check` 694/694; relay 9/9; desktop/mobile browser screenshots and readback, final visual comparison passed. Material use 25 kg / 325 baht added once to the same plot/cycle/project activity; reload and cancellation checked. Details: `qa/farm-overview/handoff.md`.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF unchanged.
- Next action: Review the local overview at `http://127.0.0.1:4185/?projectPreview=1`.

## Current production checkpoint — 2026-11-27

- Owner: Codex for Folk; SUCHA retains shared integration review.
- Branch: local `codex/sales-payment-slips`; published runtime `folk/sales-payment-slips` at `845ea5bc2181bffe7b6f8b4935cdde98e3bcffb8`.
- Task / Scope: User-approved latest web, backend and same-origin API release to `https://farmultimate-solutions.pages.dev/`, including projects/trials and private sales slips.
- Files changed: Deployment evidence only in this checkpoint; runtime code unchanged from the tested feature commit.
- Commit: Runtime `845ea5b`; the newer local commits contain documentation only.
- Validation: 676 local checks passed, relay 9/9; exact runtime GitHub npm-check passed (run `45735939839`). Production web assets and sales-slip form verified. `POST /api` health returned 200, `output_control_allowed=false`; unauthenticated private-slip access was rejected and public private-object access returned 403. D1, private R2 and nine existing secret bindings retained.
- Blocked / Risks: Live authenticated upload/save/reload was not exercised with a test account. Draft PR #18 remains unmerged; independent `Workers Builds: flytechfarm` failure remains separate and unresolved. Detailed limits are in `qa/sales-slips/deployment-20261127.md`.
- Deployment: **DEPLOYED**, explicitly approved in this chat with `APPROVE_PRODUCTION_DEPLOY` on 2026-11-27. Pages `c4b571c9-e046-48df-b137-3c1d13694de4`; Worker `farmbackup` version `f493a6ec-71bc-4dbf-8dfc-36a8df6e0423`; `FARMULTIMATE_API` binding operational. No protected Git branch was pushed or merged.
- Safety: `DATA_ONLY / SAFE_OFF / output_control_allowed=false`; no hardware action.
- Next action: SUCHA review draft PR #18 for integration into `develop`, preserving this approved production revision.

## Historical baseline checkpoint

- Updated: `2026-09-05 Asia/Bangkok`
- State: `BASELINE_READY`
- Development approval: `APPROVE_FARMULTIMATE_DEV_SETUP_ONCE`
- Production branch: `master` at `dba54778aa5043c1d699ec7136d30fd4d18da71c`
- Integration branch: `develop` — `REMOTE_VERIFIED`
- Integration preparation branch: `pick/integration-baseline-v2` — `REMOTE_VERIFIED` at the same branch head
- Functional baseline commit: `0ac5b826b5cf8b16b5b2b9ec81194273f27bd11a`
- Merge source: `origin/master` + `origin/pick/codex-relay-setup` at `d03b82c5cda86031d1dac07e47707f755002edff`
- Raw source branch: `sucha/sensor-phase1-local` — `PRESERVED / LOCAL_ONLY_DO_NOT_PUSH`
- Production deployment: `NOT_DEPLOYED`

## Baseline V2 Result

- Master commerce/auth changes and the reviewed Farm/Map/Telemetry baseline are merged in an isolated worktree.
- Conflict resolution completed for `index.html`, `js/app.js` and `sw.js`; no unmerged path remains.
- Deployed runtime uses same-origin `/api`. A Pages Function forwards requests through the `FARMULTIMATE_API` Service Binding and fails closed when unavailable.
- Farm and Commerce remain parts of one static app, one repository, one integration branch and one release.
- Feature ownership is defined in `docs/FEATURE_OWNERSHIP.md`.
- Same-origin architecture and its release gate are defined in `docs/SAME_ORIGIN_API.md`.

## Validation

- `npm run check`: `64/64 PASS`, zero failed/skipped.
- UTC runner reproduction after timezone fix: `64/64 PASS`.
- GitHub Actions `npm-check`: `PASS`, code run `33950163815` and status run `33950212687`.
- Relay tree on the integration worktree: `9 messages PASS`.
- Incoming `origin/folk/codex-relay`: `6 messages PASS`.
- Git conflict markers/unmerged paths: `NONE`.
- Desktop browser `1280 x 720`: Home and Master Map `PASS`; no horizontal overflow.
- Mobile browser `390 x 844`: Master Map and Stock `PASS`; no horizontal overflow.
- Browser console warnings/errors: `0`.
- Current production Service Binding and deployed `/api` response: `NOT_TESTED / NOT_DEPLOYED`.
- Field geometry/survey: `NOT_SURVEYED`.
- Hardware output/commissioning: `NOT_RUN`.

## Relay Review

- Folk report `21b91065-5089-4878-b679-489c19426280` replies once to `29faf594-950b-4bd1-9ca3-4c7906cf84c2` and was already acknowledged by SUCHA message `5629206a-d0ea-4c77-8c27-29644b44695b`.
- Folk blocker `4a6cfff6-3b4c-4b9f-ab12-06696d4738e1` was already covered by that ACK and requires no duplicate acknowledgement.
- Direct Codex ingress remains optional and blocked. Git feature branches and Pull Requests are the active collaboration channel.
- Old handshake, FOLK-001 and link reports must not be reissued.

## Ownership and Locks

### Active task: PLOT-MATERIAL-HISTORY-20261127

- Owner: Codex for Folk, explicitly requested in the current chat; SUCHA retains shared integration review.
- Branch: `codex/plot-material-history`; source `9d08a11` (deployed runtime `845ea5b` plus handoff documentation), descendant of refreshed `origin/develop` at `40721b5`.
- Task / Scope: Add date and product views for existing plot/crop-cycle material usage with a cycle selector. Read canonical tasks only; preserve saved quantities, accounting, stock and project links.
- Scope / lock: new `js/plot-materials.js` and `css/plot-materials.css`; scoped plot-tab wiring in `js/app.js`, notebook material-panel wiring in `js/cycle-notebook.js`, asset wiring in `index.html` / `sw.js`, focused tests and synthetic QA/handoff. Prior same-owner sales/project work is committed and preserved; no other owner's active lock is present in this checkout.
- Status: LOCAL_COMPLETE / VISUAL_VALIDATED. `npm run check`: 684 passed, 0 failed; relay 9/9. Desktop 1440 x 940 and mobile 390 x 844 browser readback/screenshot completed. Date/product views agree on synthetic material cost 690; canonical cycle cost remains 940 including labor 250. Legacy/unassigned/closed-cycle records, mixed units, zero/missing/mismatched costs, detail links and planned exclusions verified. See `qa/plot-materials/README.md`.
- 2026-11-27 continuation: LOCAL_COMPLETE / VISUAL_VALIDATED, same owner/branch/task lock, parent `74537a7`. Added name search, a recording shortcut inheriting the selected plot/cycle through the existing task form, and a compact mobile plot header. Lock includes scoped plot-header markup in `js/app.js`; no ledger, backend or stock contract changes. `npm run check`: 687 passed, relay 9/9. Desktop/mobile readback and screenshots verified search, prefilled active/closed cycles, fertilizer selection, expandable mobile header, and a synthetic 130-THB save: material total 690 -> 820 and canonical cycle total 940 -> 1,070, once. Reload retained 820; no browser errors. See `qa/plot-materials/search-entry-handoff.md`. NOT_DEPLOYED.
- Deployment: NOT_DEPLOYED for this follow-up; production remains the prior approved `845ea5b` release. No backend/schema change, production data, remote push or hardware action. DATA_ONLY / SAFE_OFF retained.

### Active task: SALES-SLIPS-20261126

- Owner: Codex for Folk, user-requested sales payment-slip attachments.
- Branch: `codex/sales-payment-slips`; source `eb40888` (current app/project baseline, descendant of `origin/develop` at `40721b5`). Preserve pending project integration; no old-UI replacement.
- Scope / lock: `js/sales.js`, sales evidence module/styles, sales data contract in `js/data.js`, private slip endpoints in `worker/src/lark.js`, scoped sales-list indicator in `js/workspace.js`, asset wiring in `index.html` / `sw.js`, tests and synthetic QA/handoff. SUCHA retains shared integration review.
- Prior project implementation is committed; this task takes the same owner's local shared-file lock for the sales follow-up only. No other owner's active lock is present.
- Status: LOCAL_COMPLETE; `npm run check` passed 676/676 with relay validation 9/9. Browser upload/save/reload/open/cancel verified with synthetic evidence; desktop 1440 x 940 and mobile 390 x 844 screenshots in `qa/sales-slips/`. Preserve DATA_ONLY / SAFE_OFF and same-origin API. External Workers Build remains unresolved: no remote push/configuration/deployment in this task. Handoff: `qa/sales-slips/README.md`.
- 2026-11-26 publication update: user requested `gitpush deploy` after the scoped release preflight. Pushed `845ea5bc2181bffe7b6f8b4935cdde98e3bcffb8` to `folk/sales-payment-slips`; GitHub `npm-check` passed (run `45735939839`). Draft integration PR: https://github.com/fxlk2112/kaset-poomjai/pull/18. The independent `Workers Builds: flytechfarm` check failed again; no retry was issued. Automatic approval review rejected the attempted `farmbackup` production deployment because explicit `APPROVE_PRODUCTION_DEPLOY` was missing; the command did not execute. Pages deploy and production binding changes were not attempted. `NOT_DEPLOYED`; next action is Pick's explicit production approval for this exact release and the required `FARMULTIMATE_API` binding.

### Active task: PROJECTS-TRIALS-20261124

- Owner: Codex for Folk, explicitly requested in the current chat on 2026-11-24.
- Branch: `codex/projects-trials-v1` (isolated managed worktree).
- Base: `origin/develop` at `40721b5`.
- Incoming UI source: `origin/codex/release-multiplot-20261013` at `3f8d208`.
- Scope / lock: reconcile the current UI with develop safeguards; projects, trial links, activity reuse, crop-cycle cost views, report draft, their tests and local preview.
- Shared files in this task: `index.html`, `js/app.js`, `js/data.js`, `js/auth.js`, `js/lark.js`, `css/style.css`, `sw.js`; preserve same-origin API and DATA_ONLY / SAFE_OFF. Integration review remains with SUCHA.
- No production mutation, hardware action, remote branch rewrite or deployment. The 2026-11-25 follow-up authorizes scoped development publication on the owner feature branch and a draft PR to develop.
- Existing untracked `docs/rnd/` in the original checkout is preserved.
- Status: LOCAL_VISUAL_VALIDATED; crop notebook revised against the user's 2026-11-24 reference. `npm run check`: 620/620, relay 9/9. Desktop 1674 × 940 and mobile 390 × 844 browser evidence in `qa/cycle-notebook/`; see `design-qa.md` and `docs/CYCLE_NOTEBOOK_HANDOFF.md`. Lock includes `js/cycle-notebook.js`, `css/cycle-notebook.css`, cycle wiring in `js/app.js`, `js/workspace.js`, `js/workspace-flows.js`, preview, tests and QA. Existing records and canonical cost calculations preserved. NOT_DEPLOYED.
- Baseline reconciliation also covers `js/workspace.js`, `js/recovery.js`, the Worker merge and migration naming; SUCHA retains integration ownership.
- 2026-11-24 revision: LOCAL_WORKFLOW_VALIDATED — corrected selected draft, measurement, booklet and mobile activity flows; added document evidence and crop cost/kg. Same owner/branch/lock, including project planner/record/report/DOCX modules, scoped styles, task wizard, tests and QA. `npm run check`: 636/636, relay 9/9; desktop/mobile browser interaction and Word/native print verification recorded in `qa/projects-workflow/validation.md`. See `docs/PROJECTS_WORKFLOW_HANDOFF.md`. Original audit artifacts preserved. Local changes uncommitted; no push or deployment. NOT_DEPLOYED.

| Area | Owner | Current lock |
|---|---|---|
| Farm / Map / Planner / Analytics / Water / Telemetry | Pick + SUCHA | `AVAILABLE_BY_TASK_LOCK` |
| Stock / Sales / Products / Import / Market Price | Folk | `READY_FROM_ORIGIN_DEVELOP` |
| Shared shell / contracts / CI / release preparation | SUCHA | `AVAILABLE_BY_TASK_LOCK` |
| `master` and Cloudflare production | Pick approval | `LOCKED_NEEDS_APPROVE_PRODUCTION_DEPLOY` |

## Development Push Policy

The one-time development approval authorizes publication of this reviewed baseline and routine pushes to owner feature branches under `docs/FEATURE_OWNERSHIP.md`. Future work uses Pull Requests into `develop`. It does not authorize direct routine pushes to `develop`, changes to `master`, production binding/deploy, secret/config writes, branch/data deletion or hardware action.

## Remaining External Setup

- Branch protection is `BLOCKED_NEEDS_REPOSITORY_ADMIN`: the authenticated SUCHA account has push permission but not repository admin permission. An admin must apply this once to `develop` and `master`: Pull Request required, one human approval, `npm-check`, no force push or deletion.
- Configure the Pages `FARMULTIMATE_API` Service Binding only during an approved production release.

## Safety

`DATA_ONLY / SAFE_OFF / output_control_allowed=false / Raspberry Pi 5 sole writer / NOT_DEPLOYED`

## Next Action

2026-11-25 publication checkpoint: feature commit b132c6114d03756b8c940c30fd69322e04cbcf24 published to folk/projects-trials-v1; GitHub Actions npm-check passed (run 45576707306). The independent existing Workers Builds: flytechfarm check failed and exposed no failure cause; further pushes paused pending inspection of that external integration. Draft PR creation returned GitHub connector 403, and Edge is signed out; no PR created. User sign-in requested. Publication-status notes and prepared PR body remain local. Live staging does not exist; NOT_TESTED / NOT_DEPLOYED (no successful deployment observed). See docs/PROJECTS_ONLINE_READINESS.md for evidence and the single next action.

2026-11-25 online-readiness follow-up: LOCAL_INTEGRATION_VALIDATED / LIVE_STAGING_PENDING under PROJECTS-TRIALS-20261124, same owner/branch/base. Two isolated clients exercised shipped auth + Pages + Worker code with in-memory SQLite/R2 adapters: project/results/photos/report/cost round-trip, concurrent edit rejection, offline/binding failure and oversized state retention passed. Corrected Worker photo upload/read/delete to support /api/photo while retaining legacy Worker /photo paths. npm run check 669 passed, 0 failed, relay 9/9. User confirmed there is no separate staging site or test account. Scoped development commit/publication and draft PR to develop are being prepared; no live cloud certification or deployment. SUCHA retains shared-file integration ownership. See docs/PROJECTS_ONLINE_READINESS.md.

2026-11-25 all-task-surfaces follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch/base. Shared completion circles now cover activity lists, selected-day lists in global/crop calendars, plot summaries, central work and notifications, alongside existing project/history/home circles. Lock includes shared task rendering/completion in js/app.js, js/projects.js, js/notify.js, scoped css/project-workspace.css, asset versions, relevant tests and QA. Material completion from task details and compatibility handlers also requires quantity/cost review before mutation. Desktop 1440x940 and mobile 390x844 screenshot/readback passed; mobile targets 44x44, no page overflow, browser error log empty. Missing-price confirmation blocked; cancellation retained planned work; synthetic central task completed once and appeared in activity history. npm run check 664 passed, 0 failed, relay 9/9. Existing drafts/canonical accounting preserved. See docs/ALL_TASK_CIRCLES_HANDOFF.md and qa/all-task-circles/validation.md. Uncommitted; NOT_DEPLOYED.

2026-11-25 home-circle follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch/base. Shared completion circles added to the farm overview work list, with separate detail buttons and plot-qualified accessible names. Lock: js/workspace.js, scoped css/workspace.css, index.html/sw.js asset versions, QA and handoff. Desktop/mobile screenshot/readback passed; completing a synthetic task reduces pending count; fertilizer circle opens quantity/cost review and cancellation preserves its plan. npm run check 662 passed, 0 failed, relay 9/9. Existing data paths and original preview drafts preserved. See qa/home-circles/validation.md. NOT_DEPLOYED.

2026-11-25 circle completion follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Accessible 44px circle controls in plot/crop history and project lists, including mobile task selection. Material work opens actual quantity/cost review before confirmation; canonical activity/stock/cost paths and original drafts preserved. Lock includes existing project/history modules, shared activity form/completion wiring, js/inspection.js confirmation-label handling, scoped styles, asset versions, tests and QA. Synthetic 130-baht completion increased project and cycle totals once, consumed 10kg once, and retained original planned date. Desktop/mobile screenshot/readback passed; npm run check 662 passed, 0 failed, relay 9/9. See docs/TASK_CIRCLES_HANDOFF.md and qa/task-circles/validation.md. Existing changes uncommitted. NOT_DEPLOYED.

2026-11-25 linked-cost audit: LOCAL_ACCOUNTING_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Actual synthetic save of stock chemical 90 + labor 210 = 300 appeared once with the same activity ID in plot/cycle history and project; cycle cost 2,465 -> 2,765. Editing labor to 260 changed project cost to 350 and cycle cost to 2,815; repeated edit-save/reload left costs and stock unchanged. Two new accounting regression tests cover shared views, edits/reload, project relinking and planned/failed exclusions. npm run check: 657 passed, 0 failed, relay 9/9. No product code change needed. Original preview drafts preserved; isolated loopback QA server stopped. See docs/LINKED_COST_AUDIT_HANDOFF.md and qa/linked-cost-audit/validation.md. NOT_DEPLOYED.

2026-11-25 history follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Separate recorded outcomes from planned work, group by date and open details from compact activity rows in crop-cycle and plot history. Scope: js/cycle-notebook.js, css/cycle-notebook.css, plot-history wiring in js/app.js, asset versions, tests and QA. npm run check: 655 passed, 0 failed, relay 9/9. Desktop 1440x940 and mobile 390x844 screenshot/readback passed after correcting mobile action layout and restored-route initialization. Final reload/detail navigation has no new browser errors. Canonical activity/cost data and existing drafts preserved. See docs/PLOT_HISTORY_HANDOFF.md and qa/plot-history/validation.md. NOT_DEPLOYED.

2026-11-25 project suggestions follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Activity form recommends matching plot/cycle projects before save; preserves explicit choice/drafts and clears mismatches after context changes. js/projects.js, js/app.js, js/task-wizard.js, scoped CSS, asset versions and tests updated. npm run check: 648 passed, 0 failed, relay 9/9. Desktop/light and mobile/dark browser evidence plus successful linked chemical-cost save in qa/project-suggestions/. See docs/PROJECT_SUGGESTIONS_HANDOFF.md. Existing user draft retained. NOT_DEPLOYED.

2026-11-25 usability follow-up: LOCAL_USABILITY_VALIDATED under the same PROJECTS-TRIALS-20261124 owner/lock. Ordinary projects can start with only a name; plot/cycle context is optional and inherited from the crop notebook. Tasks, work records and booklets do not require a trial. Corrected fertilizer misclassification and false overdue status for undated work. npm run check: 643 passed, 0 failed; relay 9/9. Desktop 1440x940 and mobile 390x844 inspected. See docs/PROJECTS_USABILITY_HANDOFF.md and qa/project-usability/audit.md. Existing changes/evidence preserved. NOT_DEPLOYED.

Review the PROJECTS-TRIALS-20261124 local preview with the user before SUCHA integrates it into develop.
