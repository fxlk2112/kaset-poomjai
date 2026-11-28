# All task surfaces circle completion handoff

- **Owner:** Codex for Folk, existing `PROJECTS-TRIALS-20261124` lock; SUCHA retains shared-file integration ownership.
- **Branch:** `codex/projects-trials-v1`, verified `origin/develop` base `40721b5`.
- **Task / Scope:** Complete the circle interaction across Activities, global/crop calendars, plot summaries, central work and notifications; preserve quantity/cost review for material work from every completion entry point.
- **Files changed in this follow-up:** `js/app.js`, `js/projects.js`, `js/notify.js`, `css/project-workspace.css`, `index.html`, `sw.js`, `tests/task-circle-completion.test.cjs`, `tests/interior.test.cjs`, `tests/inspection.test.cjs`, `qa/all-task-circles/`, `design-qa.md`, `COLLAB_STATUS.md`, and this handoff. Existing unrelated/uncommitted work preserved.
- **Commit:** UNCOMMITTED on existing HEAD `c4d8798`; no push, merge or rebase.
- **Validation:** `npm run check`: 664 passed, 0 failed; relay 9/9. Diff whitespace check passed. Desktop 1440 × 940 and mobile 390 × 844 browser screenshots/readback passed. Missing material price blocked confirmation; cancellation did not complete the task. Ordinary central work completed once, appeared in activity history and could not be checked again. No browser errors. Detailed coverage: `qa/all-task-circles/validation.md`.
- **Blocked / Risks:** No local blocker. QA uses isolated synthetic loopback preview data; live cloud and multi-device synchronization were not exercised. Calendar cells select the day; circles are in the selected day's task list. Completed/failed circles are disabled; explicit edit actions remain available. Original preview drafts untouched.
- **Deployment:** **NOT_DEPLOYED**. No production write, secret/config change, LAN exposure or hardware action. Same-origin API and `DATA_ONLY / SAFE_OFF` preserved.
- **Next action:** Have SUCHA review the local changes for integration into `develop` with the existing project-workflow feature.
