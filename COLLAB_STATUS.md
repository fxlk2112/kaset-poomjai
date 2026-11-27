# FARMULTIMATE Collaboration Status

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
