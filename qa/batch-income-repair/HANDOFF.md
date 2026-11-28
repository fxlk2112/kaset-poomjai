# Batch income, original headers, and missing project records

- Owner: Codex for Folk; SUCHA retains shared integration review.
- Branch: `codex/batch-income-missing-data` (starting commit `b3a0ae9`; refreshed `origin/develop` is an ancestor).
- Task / Scope: Copy general income into batch drafts and show it separately through review/receipt; map original Farm Record columns; complete selected existing historical project records in a dedicated table.
- Files changed: `js/batch-work.js`, `css/batch-work.css`, `js/project-data-repair.js`, `css/project-data-repair.css`, scoped route/entry/status hooks in `js/app.js`, `js/workspace.js`, `js/project-proposal.js`, `js/cycle-notebook.js`; `index.html`, `sw.js`; focused tests; this QA directory and collaboration status.
- Commit: See the feature commit accompanying this handoff (`feat: preserve batch income and complete missing project records`).
- Deployment: NOT_DEPLOYED. Local preview uses the existing workbook example on loopback port 4194. Production remains unchanged.

## Behavior

- Copy includes general income, including explicitly entered zero, while harvest income stays in the harvest-specific workflow. Paid categories and supported services retain their distinction. Reviews and receipts separate income from expenses.
- Farm Record maps Bill-Date, Bill-Type, Topic, Cost-Type, Unit, package quantity, actual usage, unit price, and Total Amount. Signed expenses become positive costs only when identified as expenses. Income follows Bill-Type, not the task title. The right-side `รายได้` summary column is ignored in this format. Description, chemical type, and Remark are preserved in notes.
- Complete quantity/price inputs are reconciled with the total; a missing total is calculated only when all inputs exist. Missing dates/quantities are not fabricated. Blank-price sponsorship requires an explicit confirmation, and supported services are allowed without artificial material quantities.
- The missing-data table opens the seven actual historical rows and shows source row numbers. Editing selects the row; partial batches are supported by leaving other rows unselected. Amounts on sponsored records remain zero. A separate review and checkbox are required before saving.
- Repairs replace the existing task fields without adding tasks, posting a parallel cost, or changing stock. Task IDs, links, photos, income, notes and source references remain. Changes after opening/review, account switches, closed projects, stock-backed records and failed local persistence are guarded. Nonstandard pending notes require explicit acknowledgment. Account-scoped drafts survive leaving the screen.
- Zero-cost sponsored records with missing quantities no longer display a misleading unconfirmed-money label. The project metric now explicitly labels records with complete data.

## Validation

- `npm run check`: **805 tests passed**, relay validation **9 messages**; `git diff --check` passed.
- Unit coverage includes income retries and duplicates, original multi-line headers and right-side summary labels, service sponsorship, negative expenses, calculated/mismatched totals, missing-input blocking, repair selection, seven-row updates, stale data, storage failure, unchanged evidence and costs across all scopes.
- Original-source reconciliation (read-only, private local script): **33 source rows**, **2 income rows**, **13 sponsored rows**, **4 unknown dates** retained; original workbook hash unchanged. All seven real incomplete rows remain incomplete pending actual input. No source values were invented.
- Browser acceptance on isolated synthetic account at loopback 4195: updated **7 existing records**, then copied one income record and pasted **3 original-header rows**, giving **12 unique tasks**. Save/reload and the shipped Worker/Pages API handlers were exercised. The expected synthetic totals (cost 900, revenue 12,000) agree across plot, cycle and project; stock unchanged. `node qa/batch-income-repair/verify.cjs` passed.
- Browser duplicate guard blocked copying an already-saved record on the same date. Required quantity validation blocked incomplete repairs. Correcting a field clears its stale inline error.
- Desktop 1440×940 and mobile 390×844 screenshots/readback inspected. The actual seven-row repair table and the copied-income form fit mobile without document overflow. No browser console errors observed.
- Source-derived data, SQLite runtime, generated clipboard fixtures, logs and screenshots stay under ignored `.private/` or `data/private/` and are not committed.

## Evidence / reproduction

Private local evidence includes `actual-seven-desktop.jpg`, `actual-seven-mobile.jpg`, `actual-income-mobile.jpg`, `copy-income-desktop.jpg`, `batch-income-review.jpg`, and `repair-mobile-review.jpg` under this directory's `.private/`.

For a fresh isolated test directory: `node qa/batch-income-repair/prepare.mjs`, then `node qa/batch-income-repair/serve-backend.mjs`. The harness binds only `127.0.0.1:4195`, uses synthetic credentials internally, allows only scoped test API actions, and initializes an empty test database without replacing existing state. Do not reset or reuse the workbook-example database. The verifier expects the completed browser sequence described above.

- Blocked / Risks: No implementation blocker. Real missing inputs still require the user's field records. The table intentionally directs stock-linked/harvest/experiment records to their original editors; it does not change those accounting workflows. Review source rows before committing a separate real import.
- Safety impact: DATA_ONLY / SAFE_OFF, hardware controls and same-origin `/api` contract unchanged. No backend/schema changes, cloud resources, secrets, push or production deployment.
- Next action: Fill the seven real records with confirmed dates and quantities, then review the existing-record updates before confirming.
