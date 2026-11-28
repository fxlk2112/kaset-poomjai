# Status and mobile acceptance — 2026-11-28

- Owner: Codex for Folk, explicit user-requested Farm/Project/Commerce follow-up; SUCHA retains shared integration review.
- Branch: `codex/status-mobile-acceptance`, based on `0490f16`; refreshed `origin/develop` verified as ancestor before implementation.
- Task / Scope: Remove invalid progress, align work status across pages, and exercise mobile recording, actual PDF export, payment slips and stock. Preserve the seven incomplete worksheet entries.
- Files changed: Shared task status helper; app, project, calendar, overview, history and document renderers; corresponding styles, cache wiring and regression tests; isolated QA harness and read-only reconciliation script; collaboration status.
- Commit: Feature commit containing this handoff.
- Validation: `npm run check`: 810/810 PASS; relay validation: 9/9 PASS. Browser, PDF and ledger evidence below.
- Deployment: **NOT_DEPLOYED**. New status/PDF rendering was checked on the local preview. Existing production runtime `d244cb1` was used for authorized QA recording and persistence checks; it still has the previous status presentation.
- Next action: Integration-owner review of this branch for `develop`.

## Resulting behavior

- A project without a planned-work denominator displays an explanation instead of `null%`, a progress bar or fabricated 100%.
- Done, failed, planned/overdue and incomplete-data labels use the same helper in overview, calendar, activities, project work, plot/cycle history, task details and report output. Failed work has a separate group and is excluded from remaining-work counts.
- The history tab says “บันทึกผลแล้ว” because it contains both successful and failed outcomes. Summary “ทำแล้ว” counts only completed work.
- Completed work with missing inputs remains completed and marked “ข้อมูลรอตรวจ”; its completion control remains disabled.
- Printed report totals appear once after the table. Short activity records and their headings stay together across page breaks.

## Browser and persisted-ledger acceptance

Tested at 390×844 and desktop 1440×1000. The small-screen checks are browser viewport tests, not a physical phone certification.

| Check | Result |
| --- | --- |
| Material task with blank quantity | Submission blocked; no deduction |
| Review before save | Quantity, material expense, labor and photo shown before confirmation |
| Local create, edit labor, save again | 2 kg at 50 baht = 100; labor 150; final task cost 250 |
| Live QA create and repeated edit/save | Same single task, same 250 cost and one photo after reload |
| Project, plot and crop-cycle finance | Each reads 250 from the same task ledger |
| Sale with sample slip | One sale, 1 kg, 80 baht, cost of goods 50; attached slip opens after save |
| Sale edit/save again | One sale and one slip; no second deduction |
| Final stock | 10 − 2 used − 1 sold = 7 kg; value 350 baht |
| Planned progress | Two done and one failed = 2/3 (67%); failed is not an outstanding task |
| Worksheet preservation | All 33 records exactly equal the saved baseline, including seven missing records, four blank dates, sponsorship and sample photos |

Local persistence used the shipped Worker and same-origin Pages handlers with SQLite/R2 adapters. Production checks used the explicitly authorized QA account only, through the canonical site's `/api`. Added fixture project: `PRJ-QA-MOBILE`; synthetic sale/customer and images are labelled as test data. Existing real farm accounts were not used.

Four older synthetic QA tasks acquired the existing hydration default `wateringSessions: []`. Reconciliation permits only that absent-to-empty-list normalization; no financial, date, quantity or worksheet field changed. There are no duplicate IDs. The original worksheet records themselves compare exactly without normalization.

Read-only verification, using private snapshots (not committed):

```text
node qa/status-acceptance/verify.cjs baseline.json latest.json
node qa/status-acceptance/verify.cjs baseline.json local-final.json
```

Both snapshots passed. `verify.cjs` prints only synthetic totals/counts, never credentials, private image keys or source records.

## Actual exported PDF inspection

Used the application's PDF buttons and Edge's Save as PDF destination, then extracted text and rendered every page for inspection. No substitute document generator was used.

- Synthetic proposal: requested budget 1,000 baht.
- Synthetic report: local-only sample approval 800 baht, actual 250, remaining 550; materials 100 and labor 150 separated; one attached image.
- Worksheet proposal: unspecified requested/approved budget stays unspecified. Retrospective expenses are not substituted for the budget.
- Worksheet report: source expense/revenue/net values match the baseline; 13 sponsored material/service entries remain zero cash expense; seven missing records remain disclosed; two sample photos remain labelled as examples.
- Found and fixed a repeated income-table footer on a page boundary and orphaned activity headings. Re-exported and inspected the final 15-page worksheet report; income total appears once after both income rows.

Machine-local evidence is under ignored `tmp/status-acceptance-20261128/`:

- `check.log`, `baseline.json`, `latest.json`, `local-final.json`.
- `phone-390-review-production.jpg`, `phone-status-local.jpg`, `phone-calendar-local.jpg`, `desktop-calendar-local.jpg`.
- `mobile-review-local.jpg`, `mobile-slip-local.jpg`, `mobile-slip-production.jpg` (the latter production slip capture is tablet width).
- `qa-proposal.pdf`, `qa-report.pdf`, `syngenta-proposal.pdf`, `syngenta-report-final.pdf`, with all rendered pages in `pdf-render/`.

Source-derived PDFs, screenshots, account snapshots and credentials remain ignored. The committed fixture/harness contain synthetic data only. The fixture adds three QA tasks to a private seed; it is not included in the application bundle.

## Blocked / Risks and safety

- No implementation blocker. A production release of these code changes has not been performed.
- Not tested on physical Android/iOS hardware, with a live camera, interrupted mobile networking or simultaneous edits from two devices in this acceptance run.
- Reports retain the existing new-page-per-chapter design, so short chapters leave white space.
- During native print-window discovery, a pre-opened QA credential file appeared in accessibility diagnostic output. The inspection was stopped and `[SECRET_DETECTED]` reported. Credential values are excluded from Git and evidence; the QA password/session should be rotated before continued sharing. No authentication changes were made.
- Production actions were synthetic QA writes explicitly authorized by the user. No payment was executed. No schema migration, secret/config write, external backend URL, irrigation command or hardware access was added. `DATA_ONLY`, `SAFE_OFF` and the Pi sole-writer contract remain unchanged.
