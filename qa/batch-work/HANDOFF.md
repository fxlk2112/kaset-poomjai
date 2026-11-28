# Batch work entry — 2026-11-28

- Owner: Codex for Folk, explicitly requested Farm/Project entry follow-up. SUCHA retains integration review.
- Branch: `codex/batch-work-entry`, source `2a89f72`; refreshed `origin/develop` verified as an ancestor before editing.
- Task / Scope: Table entry for multiple completed activities, reuse of previous work, spreadsheet paste, and explicit quantity/cost review before canonical task and stock updates.
- Commit: Feature commit containing this handoff.
- Deployment: **NOT_DEPLOYED**. No push, merge, production write, migration, secret/config change or hardware action in this task.
- Next action: Integration-owner review of this branch for `develop`.

## Result

- “บันทึกหลายรายการ” is available from the farm overview, activities/calendar, active crop-cycle notebook, and open project. The batch shares a selected plot, crop cycle, optional project and project stage. One table row is one completed activity; additional materials/expenses expand inside that row. Mobile displays labelled cards.
- Copy previous work from the selected plot/cycle into editable drafts dated today. Materials, quantities, sponsorship and expenses are copied; completion state, attachments, trial measurements and task IDs are not. Stock prices are checked against the current catalog at review.
- Paste Excel/Sheets TSV or CSV with a visible column mapping and preview. Thai numerals, Buddhist dates, Excel serial dates, quoted cells and multiline CSV are handled. Optional “รหัสงานในชุด” groups multiple material rows into one activity and counts identical repeated labor once; conflicting labor values stop import. Editing the raw pasted text invalidates its old preview.
- Explicit material quantities/units and costs are required; blank costs never imply sponsorship. Supported materials have zero cash expense and still require quantities. Materials from stock use the existing unit conversion and stock deduction functions. All rows, stock availability and current costs must pass review before the confirm button can be used.
- Uses canonical `addTask` records and existing account save/sync. The whole batch is staged on a cloned state, persisted once, then published to the live state. Batch/row IDs make retry idempotent. Existing identical activities and duplicate rows require an explicit different-work acknowledgement; duplicate material lines within one activity must be corrected before confirmation. There is no additional cost ledger.
- Drafts are stored separately from the single-entry form and scoped to the active account. Partial rows survive copy/paste; switching accounts clears transient pasted text and review state.

## Files changed

- New feature: `js/batch-work.js`, `css/batch-work.css`.
- Scoped routing/navigation: `js/app.js`, `js/workspace.js`.
- Asset/cache wiring: `index.html`, `sw.js` (`farmult-v223-batch-work`).
- Regression coverage: `tests/batch-work.test.cjs` (20 focused cases).
- Collaboration lock: `COLLAB_STATUS.md`.
- Synthetic harness, read-only ledger verification and screenshots: `qa/batch-work/`. Private runtime database/session data are ignored.

## Validation

- `npm run check`: **793/793 PASS**; relay **9/9 PASS**.
- `node --check js/batch-work.js` and QA server syntax check: PASS.
- `git diff --check`: PASS.
- Browser readback/screenshots: desktop **1440×940**, mobile **390×844**, existing green/dark theme; document widths match viewport with no horizontal page overflow. Viewport override reset after testing. No browser console errors observed.
- All four entry links checked. Project entry prefills plot, crop cycle, project and stage. Copy preview, Ctrl+V, column mapping, stale-preview invalidation, draft resume after reload, required quantity/cost errors, review checkbox and duplicate warnings exercised through UI.
- Isolated loopback server on port 4193 uses the shipped same-origin Pages Function and Worker handlers with synthetic SQLite and photo storage. Production, the user's imported workbook data and existing preview databases were not modified.

### Actual save/edit/reload scenario

1. Starting fixture: main project expense **600**, stock **50 kg**, 4 total task records.
2. Paste 3 sheet rows: one fertilization activity with purchased material **2 kg / 120**, sponsored material **3 kg / 0**, and repeated labor **80**; one watering activity with labor **40**. Grouping produces 2 activities, expense **240**, with labor 80 counted once.
3. Add a stock activity using **1 kg × 75**, labor **25**. Missing quantity and missing material cost each block review. Returning from review changes no ledger.
4. Confirm 3 activities once: expense added **340**; main project **940**, stock **49 kg**. Reload retains all three records once.
5. Edit that stock activity's labor **25 → 35** using the existing single-activity editor: main project **950**, stock stays **49 kg**.
6. Paste the same sheet again: both activities are flagged as already matching history; confirmation is unavailable until addressed. Remove these unsubmitted draft rows.
7. Copy the previous stock activity as a new activity dated today, change quantity to **2 kg**, retain labor **35**, review and confirm **185**. Main project and crop-cycle total become **1,135**, stock **47 kg**.
8. `node qa/batch-work/verify-ledger.cjs`: **PASS** against persisted synthetic API data: 8 task IDs / 8 unique IDs, 4 batch rows / 4 unique batch-row IDs, project **1,135**, cycle **1,135**, materials **645**, supported expense **0**, grouped labor **80**, stock **47**. The plan-only project's progress stays **50%**, while the ad-hoc project has no invented progress percentage.
9. Final UI-only draft/copy/readback tests leave **3 unsubmitted activities / 360**. They do not change persisted totals or stock. The draft is retained in the synthetic account for inspection.

## Evidence

- [Desktop table](desktop-table.png)
- [Desktop review](desktop-review.png)
- [Mobile table](mobile-table.png)
- [Mobile review](mobile-review.png)
- [Duplicate warning](duplicate-warning.png)
- [Project history](project-history.png)
- [Crop-cycle costs](cycle-costs.png)

The final table/review screenshots show the unsubmitted **360** draft, including preview stock **47 → 46**. Persisted stock remains **47**. History and cycle screenshots show the completed save scenario.

## Blocked / Risks

- No implementation blocker. Not deployed or tested by writing to a live production account.
- One batch uses one plot/cycle context, up to 100 activities and 20 material/expense items per activity. Completed work only; harvest and structured inspection workflows continue to use the existing forms. Photo attachments remain available through normal activity editing, not this batch table.
- Duplicate detection warns about matching date/type/title/material quantities/expense, and is not a universal detector for differently worded versions of the same real-world work. Batch retries themselves use stable identifiers.
- Drafts are local to the browser/account. Cloud sync and conflict handling use the existing application path; this change does not introduce a backend transaction endpoint or offline multi-device merge policy.
- Existing stock, sales, PDF/Word generation, backend and irrigation contracts are unchanged. `DATA_ONLY` / `SAFE_OFF`, Pi sole-writer and same-origin `/api` are preserved. Export layouts were not re-tested in this task.

## Reproduce

Run `node qa/batch-work/serve-backend.mjs`, open `http://127.0.0.1:4193/`, and follow the scenario above. The harness reuses the synthetic fixture from `qa/daily-entry-history/fixture.cjs` and persists its own ignored `.private/runtime/state.sqlite` between runs. `verify-ledger.cjs` reads only the completed scenario, not the initial fixture.
