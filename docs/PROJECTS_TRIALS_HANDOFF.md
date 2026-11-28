# Projects, trial evidence and crop-cycle notebook

The later notebook visual correction is documented in `CYCLE_NOTEBOOK_HANDOFF.md`. Original validation below is preserved in `qa/projects-trials/validation.md`; the current `design-qa.md` covers the corrected notebook.

- **Owner:** Codex for Folk; shared integration review: SUCHA.
- **Branch:** `codex/projects-trials-v1`, managed worktree `farm-projects-trials/WebFarm`.
- **Task / Scope:** Integrate the selected current workspace design with editable suggested project tasks, project codes/objectives, canonical activities, task-linked trial measurements/photos/history, crop-cycle material costs and versioned report preview/print.
- **Files changed:** Feature modules `js/project-workspace.js`, `js/project-activity.js`, `css/project-workspace.css`; wiring in `index.html`, `js/app.js`, `js/workspace.js`, `sw.js`; synchronization compatibility in `js/auth.js`, `js/recovery.js`; tests in `tests/project-workspace.test.cjs`, `tests/interior.test.cjs`, `tests/workspace.test.cjs`, `js/tests/*`; preview in `scripts/serve-projects.mjs`; `package.json`, `js/package.json`; QA images and `design-qa.md`. The local merge also imports the current upstream UI/assets/tests from `3f8d208`, reconciles `css/style.css`, `worker/src/lark.js`, and keeps telemetry migration `schema5.sql` separate from the legacy Google migration `schema6-google.sql`. Existing education files are retained.
- **Commit:** Included in this branch's local merge commit (see `git log -1`); no push.
- **Validation:** `npm run check`: 610/610; relay validation 9 messages. Desktop and mobile browser readback/screenshots, persistence after refresh, photo upload, revision history, duplicate/date validation, material review, cost reconciliation and print preview passed. Logout also has regression coverage for returning to the account gate while preserving the local account slot. See `design-qa.md`.
- **Blocked / Risks:** No local blocker. Incoming UI is substantially newer than develop; SUCHA must review the shared baseline before integration. Live cloud synchronization and deployment configuration are unverified. The wallet was moved to a same-origin path to preserve the web contract; its production serving/backend wiring needs integration review. Legacy Google migration must only be applied to a database without `google_sub`; fresh schema already includes it. No migrations were executed. Suggestions are templates; no AI service or Word export is included.
- **Safety:** `DATA_ONLY`, `SAFE_OFF`, Pi sole output writer preserved. Browser backend remains same-origin. Preview binds only to `127.0.0.1` and uses synthetic data; no real field data was used for screenshots.
- **Deployment:** `NOT_DEPLOYED`.
- **Next action:** Review this local preview with the user before SUCHA integrates the feature into develop.

## Preview

Run `npm run preview:projects` from this worktree, then open `http://127.0.0.1:4178/?projectPreview=1`.
The preview stores edits in a synthetic local account slot and blocks API writes. Closing/restarting the server retains that browser's sample edits.
