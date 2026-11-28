# Historical project audit

Owner: Codex for Folk; SUCHA retains integration review.
Branch: `codex/syngenta-project-audit`
Deployment: **NOT_DEPLOYED**

This audit uses the existing application, shipped Pages Function and Worker handlers with a loopback-only SQLite/photo adapter. It makes no product changes. The user-provided workbook, extracted rows, local database, screenshots and exported document remain under ignored `.private/`. Do not commit them or real receipts. Original workbook was read only.

## Reproduction environment

Run `node qa/syngenta-project/serve-backend.mjs` with the locally prepared `.private/fixture.json`. Preview: `http://127.0.0.1:4190/`. Only the synthetic QA account is bootstrapped. No Cloudflare, production or hardware action is performed. Source-derived records are confidential local test data, not synthetic financial values.

The proposal and a representative expense completion were entered through the UI. Bulk historical records and two clearly labelled repository sample images were posted through the isolated same-origin API; the browser verified rendering and report captions. Native file-chooser automation did not complete, so this is **not** an end-to-end file-picker upload pass. Word downloaded with two embedded images. PDF file generation was not verified.

## Confirmed findings

| Priority | Finding / reproduction | Expected behavior |
| --- | --- | --- |
| P1 | An imported/legacy ordinary task with positive `revenue` but no harvest quantity/price opens with “บันทึกการเก็บเกี่ยว” checked. Save without editing: revenue becomes zero. Reproduced in UI, persisted and then restored from the local pre-test copy. `js/app.js:9373`, `js/app.js:9696`. | Provide non-harvest income fields and preserve existing revenue unless explicitly edited. Do not infer a harvest from income. |
| P2 | Crop-cycle card says “มีผลผลิตแล้ว” solely because `cf.revenue > 0`, even when the only income is non-harvest income. `js/app.js:3816`, `js/app.js:4119`. | Determine harvest state from actual harvest records. |
| P2 | Ordinary-project summary/report automatically totals expenses but omits income; latest-income work shows “รวม 0 บาท” (its cost). Income had to be added manually to the report text. `js/project-report.js:12`, `js/project-proposal.js:85`. | Include income and clearly labelled provisional difference from canonical tasks, with data-completeness notice. |
| P2 | There is no distinct status for historical work whose date or price is unknown. Holding incomplete source rows under planned tasks makes them look unfinished/overdue and distorts progress. This is a workflow gap demonstrated by the import mapping, not an automatic-import defect. | Separate work status, evidence completeness and cost confirmation; retain unknown values instead of coercing them to confirmed zero. |
| P2 | Dark-mode report metric strip is nearly unreadable; paragraphs in the white report paper inherit light muted text. Verified desktop and 390 × 844 mobile screenshots. Paragraph computed color `rgb(180, 193, 185)` on light paper. | Give the paper its own dark text palette and the metric strip sufficient contrast. No horizontal page overflow at 390 px. |
| P2 | Brief containing “ดูแลแปลง … ไม่มีการทดลอง” creates an ordinary project but misses the four-stage farm-care proposal template, leaving only matched actions. `js/project-proposal.js:9` checks raw “ทดลอง”, unlike the intent parser. | Use normalized intent consistently, including negation, so explicitly non-experimental projects receive the care workflow. |

## Additional usability observations

- Historical completion defaults to today's date. The test operator changed it to the source date; offer a clearly labelled historical-entry mode with planned/source date and actual date distinct.
- Task entry labels change from “บันทึกการทำงาน / ตรวจและยืนยันบันทึก” to legacy labels after editing quantities. Confirmation still worked, so this is consistency debt rather than a bypass.
- Bulk mapping, source-row references and unresolved-data review currently required an audit script. A reviewed import screen would remove considerable manual effort.
- Date/area/package inconsistencies belong to source review; do not silently repair them or infer treatment recommendations.

## Validation

- `npm run check`: 733 passed, 0 failed; relay validation 9 messages.
- 33 unique source rows mapped to 33 unique canonical tasks; 20 complete records, 13 awaiting source-data review, 4 dates intentionally blank.
- Same accounting totals across project, plot, cycle and notebook after API persistence/reload; no duplicate task/expense posting in this dataset. No stock was supplied, so this does not establish stock-deduction behavior for these source rows.
- UI completion required a confirmation; missing medicine quantity blocked confirmation.
- Two sample pictures rendered in the report, captions edited and one report version saved. Downloaded DOCX is valid and contains both embedded pictures, totals, captions and incomplete-data notice.
- The income-loss reproduction was restored; final QA data matches the source-derived totals. The product defect remains unfixed.

Private evidence index: `report-desktop-top.jpg`, `report-mobile.jpg`, `cycle-readback.txt`, `income-edit.txt`, `income-after-edit.txt`, `income-after-edit.jpg`, `material-validation.txt`, `reconciliation.json`, `word-verification.json`, `final-state.json`, `project-report.docx`.
