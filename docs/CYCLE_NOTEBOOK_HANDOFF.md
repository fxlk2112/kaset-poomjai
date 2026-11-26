# Crop-cycle notebook visual correction

- **Owner:** Codex for Folk; shared integration owner: SUCHA.
- **Branch:** `codex/projects-trials-v1`, managed worktree `farm-projects-trials/WebFarm`.
- **Task / Scope:** Match the crop-cycle notebook to the user's approved reference using the existing shell, material history, cycle cost breakdown, linked experiments and report draft. Preserve saved data and the single canonical activity ledger.
- **Files changed:** `js/cycle-notebook.js`, `css/cycle-notebook.css`, `tests/cycle-notebook.test.cjs`; wiring in `index.html`, `js/app.js`, `js/workspace.js`, `js/workspace-flows.js`, `sw.js`; deep-link support in `scripts/serve-projects.mjs`; `COLLAB_STATUS.md`, `design-qa.md`, this handoff, the original project handoff, and QA evidence under `qa/cycle-notebook/`. Prior QA is archived in `qa/projects-trials/validation.md`.
- **Commit:** Local revision titled `fix: match crop notebook to approved layout`, following `ddf4e0f`. Resolve its hash with `git log -1 --format=%h -- docs/CYCLE_NOTEBOOK_HANDOFF.md`. No push.
- **Validation:** `npm run check`: 620/620 passed; relay validation: 9 messages. Browser screenshots/readback at desktop 1674 × 940 and mobile 390 × 844. Material filters, canonical totals, activity presets, linked measurement, calendar, report draft and mobile activity details checked. See `design-qa.md`.
- **Blocked / Risks:** No local blocker. Live review API not exercised; pagination and session guards have unit coverage. Native print preview was not rerun for this revision. Existing preview record values/images intentionally differ from the reference. Existing integration and cloud-sync limits from `PROJECTS_TRIALS_HANDOFF.md` still apply.
- **Safety:** Read model over canonical activities; no second cost ledger, backend mutations or hardware commands. Same-origin API, `DATA_ONLY`, `SAFE_OFF` and Pi sole-writer contract preserved. Preview is loopback-only and uses synthetic records.
- **Deployment:** `NOT_DEPLOYED`.
- **Next action:** Review the corrected local notebook with the user before SUCHA integration.

## Preview

Run `npm run preview:projects`, then open:

`http://127.0.0.1:4178/?projectPreview=1&cycle=demo-cycle-active-0&tab=materials&build=20261124notebook3`

The browser retains this preview account's sample edits. No production account data was replaced to imitate the reference.

## Evidence

- `qa/cycle-notebook/reference.png`
- `qa/cycle-notebook/before.jpg`
- `qa/cycle-notebook/desktop.jpg`
- `qa/cycle-notebook/mobile.jpg`
