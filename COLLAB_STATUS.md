# FARMULTIMATE Collaboration Status

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

2026-11-25 online-readiness follow-up: LOCAL_INTEGRATION_VALIDATED / LIVE_STAGING_PENDING under PROJECTS-TRIALS-20261124, same owner/branch/base. Two isolated clients exercised shipped auth + Pages + Worker code with in-memory SQLite/R2 adapters: project/results/photos/report/cost round-trip, concurrent edit rejection, offline/binding failure and oversized state retention passed. Corrected Worker photo upload/read/delete to support /api/photo while retaining legacy Worker /photo paths. npm run check 669 passed, 0 failed, relay 9/9. User confirmed there is no separate staging site or test account. Scoped development commit/publication and draft PR to develop are being prepared; no live cloud certification or deployment. SUCHA retains shared-file integration ownership. See docs/PROJECTS_ONLINE_READINESS.md.

2026-11-25 all-task-surfaces follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch/base. Shared completion circles now cover activity lists, selected-day lists in global/crop calendars, plot summaries, central work and notifications, alongside existing project/history/home circles. Lock includes shared task rendering/completion in js/app.js, js/projects.js, js/notify.js, scoped css/project-workspace.css, asset versions, relevant tests and QA. Material completion from task details and compatibility handlers also requires quantity/cost review before mutation. Desktop 1440x940 and mobile 390x844 screenshot/readback passed; mobile targets 44x44, no page overflow, browser error log empty. Missing-price confirmation blocked; cancellation retained planned work; synthetic central task completed once and appeared in activity history. npm run check 664 passed, 0 failed, relay 9/9. Existing drafts/canonical accounting preserved. See docs/ALL_TASK_CIRCLES_HANDOFF.md and qa/all-task-circles/validation.md. Uncommitted; NOT_DEPLOYED.

2026-11-25 home-circle follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch/base. Shared completion circles added to the farm overview work list, with separate detail buttons and plot-qualified accessible names. Lock: js/workspace.js, scoped css/workspace.css, index.html/sw.js asset versions, QA and handoff. Desktop/mobile screenshot/readback passed; completing a synthetic task reduces pending count; fertilizer circle opens quantity/cost review and cancellation preserves its plan. npm run check 662 passed, 0 failed, relay 9/9. Existing data paths and original preview drafts preserved. See qa/home-circles/validation.md. NOT_DEPLOYED.

2026-11-25 circle completion follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Accessible 44px circle controls in plot/crop history and project lists, including mobile task selection. Material work opens actual quantity/cost review before confirmation; canonical activity/stock/cost paths and original drafts preserved. Lock includes existing project/history modules, shared activity form/completion wiring, js/inspection.js confirmation-label handling, scoped styles, asset versions, tests and QA. Synthetic 130-baht completion increased project and cycle totals once, consumed 10kg once, and retained original planned date. Desktop/mobile screenshot/readback passed; npm run check 662 passed, 0 failed, relay 9/9. See docs/TASK_CIRCLES_HANDOFF.md and qa/task-circles/validation.md. Existing changes uncommitted. NOT_DEPLOYED.

2026-11-25 linked-cost audit: LOCAL_ACCOUNTING_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Actual synthetic save of stock chemical 90 + labor 210 = 300 appeared once with the same activity ID in plot/cycle history and project; cycle cost 2,465 -> 2,765. Editing labor to 260 changed project cost to 350 and cycle cost to 2,815; repeated edit-save/reload left costs and stock unchanged. Two new accounting regression tests cover shared views, edits/reload, project relinking and planned/failed exclusions. npm run check: 657 passed, 0 failed, relay 9/9. No product code change needed. Original preview drafts preserved; isolated loopback QA server stopped. See docs/LINKED_COST_AUDIT_HANDOFF.md and qa/linked-cost-audit/validation.md. NOT_DEPLOYED.

2026-11-25 history follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Separate recorded outcomes from planned work, group by date and open details from compact activity rows in crop-cycle and plot history. Scope: js/cycle-notebook.js, css/cycle-notebook.css, plot-history wiring in js/app.js, asset versions, tests and QA. npm run check: 655 passed, 0 failed, relay 9/9. Desktop 1440x940 and mobile 390x844 screenshot/readback passed after correcting mobile action layout and restored-route initialization. Final reload/detail navigation has no new browser errors. Canonical activity/cost data and existing drafts preserved. See docs/PLOT_HISTORY_HANDOFF.md and qa/plot-history/validation.md. NOT_DEPLOYED.

2026-11-25 project suggestions follow-up: LOCAL_WORKFLOW_VALIDATED under PROJECTS-TRIALS-20261124, same owner/branch. Activity form recommends matching plot/cycle projects before save; preserves explicit choice/drafts and clears mismatches after context changes. js/projects.js, js/app.js, js/task-wizard.js, scoped CSS, asset versions and tests updated. npm run check: 648 passed, 0 failed, relay 9/9. Desktop/light and mobile/dark browser evidence plus successful linked chemical-cost save in qa/project-suggestions/. See docs/PROJECT_SUGGESTIONS_HANDOFF.md. Existing user draft retained. NOT_DEPLOYED.

2026-11-25 usability follow-up: LOCAL_USABILITY_VALIDATED under the same PROJECTS-TRIALS-20261124 owner/lock. Ordinary projects can start with only a name; plot/cycle context is optional and inherited from the crop notebook. Tasks, work records and booklets do not require a trial. Corrected fertilizer misclassification and false overdue status for undated work. npm run check: 643 passed, 0 failed; relay 9/9. Desktop 1440x940 and mobile 390x844 inspected. See docs/PROJECTS_USABILITY_HANDOFF.md and qa/project-usability/audit.md. Existing changes/evidence preserved. NOT_DEPLOYED.

Review the PROJECTS-TRIALS-20261124 local preview with the user before SUCHA integrates it into develop.
