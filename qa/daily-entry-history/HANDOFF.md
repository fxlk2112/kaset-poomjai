# Daily entry, history and progress clarity — 2026-11-28

- Owner: Codex for Folk, user-authorized farm/project follow-up. SUCHA retains shared integration review.
- Branch: `codex/daily-entry-history-clarity`, based on `6f5fdc6`; refreshed `origin/develop` is an ancestor.
- Task / Scope: Three approved workflow improvements: easier daily entry, table history, and accurate material/labor classification and planned progress.
- Commit: Feature commit containing this handoff.
- Deployment: **NOT_DEPLOYED**. No push, merge, production data migration, secret/config write or hardware action.
- Next action: Integration-owner review of this branch for `develop`.

## Result

1. New daily activity entry uses one continuous form followed by a separate quantity/cost review. Plot, cycle and project are prefilled from context; optional settings are collapsed; photos are directly available. Separate material, labor and other expense buttons make classification explicit. External materials default to a total-cost entry; package/unit pricing remains available. Existing records retain their stored pricing.
2. Project work uses a full-width history table: actual/planned date, task/status, material quantities, cost, evidence and edit. Search by task/material name, filter by type/outcome, and switch back to date grouping. Plot/cycle histories use the same component. On mobile each row becomes a labelled card. The large report preview is replaced by a compact report link/readiness summary.
3. Progress counts canonical tasks known to have been planned, with provenance retained on completion/failure. Historical completed entries alone show a record count and no invented 100%. Planned progress is distinct from project closure and report completeness. Labor and unclassified lump sums do not become materials merely because the task is fertilization/spraying. Unknown old categories remain flagged for review instead of being rewritten from their names.

Additional defects found during browser QA and fixed: reusing materials previously replaced the open form with a confirmation modal and lost its controls; inline confirmation now preserves the form and entered labor. Review starts at the top of the scroll area. Lump-sum labor displays “ยอดรวม”, not quantity 0. Pending work with no matching stage remains visible.

## Files changed

- Entry and summaries: `js/app.js`, `js/data.js`, `js/task-wizard.js`, `js/workspace-flows.js`, `js/project-activity.js`, `js/project-work-entry.js`.
- History/materials: `js/cycle-notebook.js`, `js/plot-materials.js`, `js/project-history.js`.
- Project/progress/report: `js/projects.js`, `js/project-workspace.js`, `js/project-records.js`, `js/project-proposal.js`, `js/project-report-editor.js`, `js/farm-overview.js`.
- Styles: `css/project-workspace.css`, `css/project-proposal.css`, `css/cycle-notebook.css`, `css/plot-materials.css`.
- Asset cache wiring: `index.html`, `sw.js`; lock: `COLLAB_STATUS.md`.
- Tests: `tests/daily-entry-history.test.cjs`, `tests/activity-material-display.test.cjs`, `tests/cycle-notebook.test.cjs`, `tests/farm-overview.test.cjs`.
- Synthetic harness/evidence: this directory; runtime database and raw check log excluded in `.private/`.

## Validation

- `npm run check`: **772/772 PASS**, relay **9/9 PASS**.
- `git diff --check`: PASS.
- Browser UI/readback: desktop 1280×900 and mobile 390×844, existing dark theme. Mobile document/dialog width 390, no horizontal overflow. Viewport override reset afterwards.
- Isolated loopback QA uses shipped same-origin Pages Function and Worker handlers with a synthetic SQLite/photo store. Original imported field records and production account were not modified.
- Blank material quantity blocks review; blank manually entered cost blocks review. Supported materials still require quantity. Planned fertilizer completion also blocks missing quantity before confirmation.
- Actual UI sequence: enter stock material 1 kg × 75, labor 150, supported material 2 kg × 0; attach a screenshot of synthetic test data as evidence; review and save once. Project total 600 → 825; stock 50 → 49. Edit labor 150 → 175: project total 850, stock stays 49. Reload preserves one activity and one uploaded photo.
- Complete the remaining planned fertilizer task with stock material 1 kg × 75 and labor 25: planned project 100; stock 49 → 48; planned progress 1/2 → 2/2 (100%) while project status stays active.
- Plot and cycle show **950 total = 450 materials + 300 labor + 200 unclassified legacy expense**. Main project 850 + planned project 100 = cycle 950. Sponsored material expense stays 0. Material name summary shows supported 5 kg and 2 kg, each at 0.
- Search, date/table switch, direct edit, evidence detail, draft resume and reuse confirmation exercised. Reuse retains labor 50 in an unsubmitted draft; draft/review does not deduct stock or add an activity.
- `node qa/daily-entry-history/verify-ledger.cjs`: **PASS** against persisted synthetic API data, 5 records / 5 unique IDs, 1 new activity, 1 photo, stock 48, project totals 850/100, cycle total 950, materials 450, ad-hoc progress null, planned progress 100.

## Evidence

- [Desktop project table](desktop-history-final.jpg)
- [Desktop entry](desktop-entry.jpg)
- [Quantity/cost review](desktop-review.jpg)
- [Mobile entry](mobile-entry.jpg)
- [Mobile material fields](mobile-materials.jpg)
- [Mobile searchable history](mobile-history.jpg)
- [Cycle totals](cycle-costs.jpg)

The review/entry screenshots include an unsubmitted reuse draft (125). Its displayed projected stock 48 → 47 is a preview only; the verified persisted stock remains 48. Full-page screenshots can place the fixed header at the capture scroll position; native viewport screenshots show the actual visible entry layout.

## Blocked / Risks

- No implementation blocker. Production deployment and live-account migration were not part of this turn.
- Unknown legacy completed tasks cannot reliably be reconstructed as prior plans; they deliberately have no invented plan provenance. Unknown expense categories require a human category selection; historical amounts are preserved.
- Existing saved report editions are preserved. PDF/Word export was not re-exercised in this turn; report accounting/snapshot tests passed. This is not a new claim that all export layouts or all unrelated app surfaces passed visual QA.
- Collector and unrelated cloud integrations are disabled in the local QA harness. Irrigation remains DATA_ONLY / SAFE_OFF; Pi output-control and same-origin `/api` production contracts are unchanged.

## Reproduce

Run `node qa/daily-entry-history/serve-backend.mjs`, open `http://127.0.0.1:4192/`, and follow the synthetic scenario above. The harness preserves `.private/runtime/state.sqlite` between runs. `verify-ledger.cjs` is read-only and checks the completed scenario, not the initial fixture.
