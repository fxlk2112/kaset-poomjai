# Rebuilt workbook example

- Owner: Codex for Folk; SUCHA retains integration review.
- Branch: `codex/syngenta-batch-example`, based on `b9f8cb9`; `origin/develop` verified as ancestor.
- Task / Scope: Rebuild the requested worksheet as a separate local farm/project example and exercise the new batch-entry table. Preserve original workbook, prior demo and production data.
- Files changed: `COLLAB_STATUS.md`, this handoff, `.gitignore`, and `serve-backend.mjs` in this folder. Source-derived data, reconciliation scripts, screenshots and SQLite runtime remain under ignored `.private/`.
- Commit: The feature commit containing this handoff.
- Deployment: NOT_DEPLOYED. Loopback only; no cloud write, production migration or hardware action. DATA_ONLY / SAFE_OFF retained.

## Result and validation

- New isolated account at `http://127.0.0.1:4194/`; project `PRJ-DEMO-A-002`.
- Independently re-read the workbook and recompute row amounts from quantity, package quantity and unit price. Original workbook SHA-256 unchanged.
- All 33 source rows represented exactly once. Nineteen complete rows were pasted, reviewed and saved through the batch-entry UI in two batches. Fourteen historical/income/incomplete rows were prepared through the existing historical-record function in the private fixture, not represented as batch UI submissions.
- Saved state was reloaded through the shipped Worker + Pages Function handlers, backed by isolated local SQLite. Read-only reconciliation verifies unique task/source/batch row IDs and exact row dates, costs and income.
- Project, plot and cycle totals agree. All 13 sponsored entries have zero cash cost; six are services and seven are materials. Labor is separate from material categories. No inventory was used in this workbook example, so this run does not exercise stock deduction.
- Seven activities retain incomplete date/quantity flags; four dates remain blank. No fictional measurements, harvest or planned-work percentage. Requested/approved budgets remain blank; recorded actual expenses are not treated as approved budget. Unallocated fixed costs remain excluded and explained.
- Two repository sample images are labelled as illustrations, not evidence of the actual farm work.
- Desktop project, proposal, report and batch-review readback; mobile project/report at 390 × 844, no document overflow. Project report images loaded. Page reload retained all records.
- `npm run check`: 793/793 tests PASS; relay validation 9 messages PASS. Harness syntax PASS. Private persisted-state reconciliation PASS.

## Evidence and limitations

Private evidence in `.private/`: `source-current.json`, `verified-source.json`, `reconciliation.json`, `prepare-review.png`, `care-table.png`, `project-desktop.png`, `project-mobile.png`, `proposal-desktop.png`, `report-desktop.png`, `report-mobile.png`.

- This example is local to this machine; source fixtures are intentionally absent from Git. Existing local fixture/runtime can be resumed with `node qa/syngenta-batch-example/serve-backend.mjs`; do not publish this account-bootstrap harness.
- The historical crop cycle remains open for example entry; this does not assert that the crop is currently growing or that harvest occurred.
- Proposal/report were read back on screen. Word/PDF export was not tested in this task.
- Existing history wording can show “ยอดรอยืนยัน” on a zero-cash sponsored record whose missing input is date/quantity. Amounts remain correct; the wording deserves a separate UI follow-up. The “ข้อมูลในร่างเล่ม” metric counts complete activities while the report also discloses incomplete ones.
- Sidebar plot navigation did not change the screen during this local readback. Plot/cycle totals were verified through canonical finance functions against saved data, not claimed as visual plot-page QA.

- Next action: Review the new local project and identify the missing source dates/quantities.
