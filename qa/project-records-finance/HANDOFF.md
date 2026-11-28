# Historical project records and finance

- Owner: Codex for Folk, user-authorized; SUCHA retains shared integration review.
- Branch: `codex/project-records-finance`; base `f3f607a`, fetched `origin/develop` verified as ancestor.
- Task / Scope: Correct the historical-project workflow demonstrated in the prior workbook audit. Preserve ordinary income, distinguish completed work from incomplete data, add reviewed grouping and historical entry, and include income/completeness in reports.
- Files changed: `js/project-history.js`; project workspace/proposal/report/Word/work-entry/count modules; focused hooks in `js/app.js`, `js/data.js`, `js/cycle-notebook.js`, `js/workspace-flows.js`, `js/task-wizard.js`; `css/project-proposal.css`; `index.html`, `sw.js`; history/notebook regression tests; this handoff and collaboration status.
- Commit: The feature commit containing this handoff (`git log -1 --format=%h -- qa/project-records-finance/HANDOFF.md`).
- Validation: `npm run check` **750/750 passed**, relay validation **9 messages**. Desktop 1280 × 720 and mobile 390 × 844 screenshot/readback, light/dark themes. Local same-origin API persistence/reload, unchanged-income editing, historical entry/edit, incomplete amounts/date, reviewed group/ungroup, project/cycle accounting, frozen editions and Word export verified.
- Blocked / Risks: No automatic Excel file importer is included; historical entry supports manual records and linking existing activities. Unknown source values stay unresolved. Historical expenses do not deduct stock or claim verified chemical application. Grouping is restricted to completed ordinary work with matching project, plot, cycle, stage and actual date; linked experiment/result records stay separate. PDF native print/save and native file-picker upload remain unverified from the prior audit. Local API adapters were used, not live Cloudflare resources.
- Deployment: **NOT_DEPLOYED**. No push, production migration, backend contract or hardware change. DATA_ONLY / SAFE_OFF and same-origin `/api` remain intact.
- Next action: Submit this scoped change to the integration owner for review into `develop`.

## Behavior and accounting contract

1. “มีงานที่ทำไปแล้ว” starts an empty ordinary project without inventing a prior plan, budget or date. “บันทึกย้อนหลัง” records actual work with multiple expense lines; blank amount/date produces an explicit pending-data state. Explicit zero is distinct from unknown. Existing source IDs, evidence and report editions survive editing.
2. General income has its own optional field. Rent/service receipts do not enable harvest or close a crop cycle. An unchanged legacy rental record retains its income. Invalid/missing harvest quantities or price cannot silently overwrite existing income with zero.
3. Work completion and data completeness have separate counts. Historical pending work is completed, not overdue planned work. Ordinary medication/fertilizer completion still uses the existing actual-quantity/cost review.
4. Grouping changes the display only. The operator selects source rows and confirms a shared activity title. Source IDs and raw expense/income rows remain canonical; project and cycle accounting still sum each task once. Ungrouping clears metadata. Later scope/date/stage changes split the display safely.
5. Live project reports and downloaded DOCX include expense detail, income detail, provisional difference and pending-data notices. Saved editions without income snapshots are never populated from current data. The report paper and metric strip remain readable in dark mode.

## Reproducible synthetic checks

Use a local test account. Create a project with “มีงานที่ทำไปแล้ว”, then record two completed activities on the same past day: a material expense of 600 and labor of 200. Group them after review: the work count becomes one and the cost remains 800. Open the activity to inspect both original rows, then ungroup: two activities, still 800. Record another activity with one known expense and one blank expense, leaving its actual date blank: it appears under completed work with pending data; the report labels the blank amount “รอยืนยัน”. Edit that activity through its details to verify the historical editor retains all expense rows.

Source-derived test records, database, screenshots and downloaded Word remain in ignored `qa/syngenta-project/.private/`; the workbook and real receipts were not changed, uploaded or committed. The isolated source dataset retained all 33 IDs and row references, 13 pending-data markers, four unknown dates, two sample photos, original totals, inventory and the saved report edition. A separate synthetic QA project exercised grouping and multiple expenses. HTTP QA readers use UTF-8 stream decoding to avoid corrupting Thai characters across network chunks.

Private evidence: `records-final-verification.json`, `records-check.log`, `records-desktop-final.jpg`, `records-mobile-dark-final.jpg`, `history-form-mobile.jpg`, `records-report-dark.jpg`, `records-cycle-history-final.jpg`, `records-report.docx`. DOCX inspected as ZIP/XML: both sample images, income, costs and incomplete-data notice present. No saved-PDF pass is claimed.
