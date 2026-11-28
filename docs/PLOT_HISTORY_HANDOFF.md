# Plot history handoff

- **Owner:** Codex for Folk, existing lock `PROJECTS-TRIALS-20261124`; SUCHA retains shared-file integration ownership.
- **Branch:** `codex/projects-trials-v1`, based on verified `origin/develop` at `40721b5`.
- **Task / Scope:** Separate recorded and planned plot/crop-cycle work, group by date, and open complete activity details from compact rows. Preserve canonical costs, evidence and task actions.
- **Files changed:** This follow-up: `js/cycle-notebook.js`, `css/cycle-notebook.css`, `js/app.js`, `index.html`, `sw.js`, `tests/cycle-notebook.test.cjs`, `COLLAB_STATUS.md`, `design-qa.md`, this handoff and `qa/plot-history/`. Earlier working changes remain intact.
- **Commit:** UNCOMMITTED on prior HEAD `c4d8798`; no push or merge.
- **Validation:** `npm run check`: 655 passed, 0 failed; relay 9/9. Syntax and diff whitespace checks passed. Desktop 1440 × 940 and mobile 390 × 844 browser interaction, screenshots and readback verified grouping, details/photos, outcome/type filters, round scope and empty state. Completion/reschedule forms opened and cancelled. Mobile action placement and initial route loading corrected and rechecked; no new browser errors after final reload. See `qa/plot-history/validation.md`.
- **Blocked / Risks:** No local blocker. Failed work is intentionally retained among recorded outcomes with an explicit badge and filter. Historical records without an actual date use the existing canonical fallback. No real cloud/account testing, new dark-mode walkthrough or full accessibility audit. Existing drafts and farm records were preserved.
- **Deployment:** **NOT_DEPLOYED**. Final app/notebook/CSS assets `20261125history2`, cache `farmult-v205-plot-history`; loopback preview remains on port 4178. DATA_ONLY / SAFE_OFF and same-origin API contract unchanged.
- **Next action:** Review the updated local history with the user before SUCHA integrates this task into `develop`.
