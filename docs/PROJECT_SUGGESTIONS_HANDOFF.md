# Project suggestions handoff

- **Owner:** Codex for Folk. Existing lock `PROJECTS-TRIALS-20261124`; SUCHA remains shared-file integration owner.
- **Branch:** `codex/projects-trials-v1`; `origin/develop` baseline verified at `40721b5`.
- **Task / Scope:** Recommend projects matching the activity's plot/cycle before chemical/fertilizer recording is saved. Preserve optional assignment, manual other-project selection, draft/edit selections and existing canonical costs/stock.
- **Files changed:** This follow-up: `js/projects.js`, `js/app.js`, `js/task-wizard.js`, `css/project-workspace.css`, `index.html`, `sw.js`, new `tests/project-suggestions.test.cjs`, `COLLAB_STATUS.md`, `design-qa.md`, this handoff and `qa/project-suggestions/`. Prior working changes remain intact.
- **Commit:** UNCOMMITTED on prior HEAD `c4d8798`. No push, merge or deployment.
- **Validation:** `npm run check`: 648 passed, 0 failed; relay 9/9. Desktop/light 1440 × 940 and mobile/dark 390 × 844 browser screenshot/readback. Single-plot synthetic chemical save linked immediately to its chosen project with 30-baht cost counted once. Existing edit preserves project/stage, draft restore preserves choice, mismatched context clears it. See `qa/project-suggestions/validation.md`.
- **Blocked / Risks:** No local blocker. Multi-plot selection still uses one project for the whole batch, explicitly stated in the form; suggestions require coverage of all selected contexts. No new end-to-end multi-plot save, real-account/cloud test or full accessibility audit. User's original unfinished activity draft was preserved; QA save used separate localhost synthetic data.
- **Deployment:** **NOT_DEPLOYED**. Build `20261125workflow7`, cache `farmult-v202-project-suggestions`. Existing loopback server and same-origin API contract retained. No hardware, secrets, firewall or production changes.
- **Next action:** Review the project selector in the local crop-cycle activity form before SUCHA integrates into `develop`.
