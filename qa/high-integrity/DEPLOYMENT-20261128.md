# High integrity fixes — approved production release

- Owner: Codex for Folk; SUCHA retains integration review.
- Branch: `codex/release-integrity-20261128`; published source `folk/high-integrity-fixes`.
- Integration PR: [#20 — Preserve actual farm costs and sync private project files](https://github.com/fxlk2112/kaset-poomjai/pull/20), draft targeting `develop`.
- Task / Scope: Deploy the four High fixes and verify sync, actual costs and stock in the existing isolated QA account on the canonical site. Preserve the seven incomplete worksheet records.
- Files changed: This release record, synthetic live QA screenshots and `COLLAB_STATUS.md`. Runtime source is unchanged from the tested feature commit.
- Commit: Runtime `f55802b`; release-evidence commit contains this document.
- Deployment: **DEPLOYED** under the user's explicit `APPROVE_PRODUCTION_DEPLOY` for frontend and backend. User separately approved inspecting the signed-in account and UI testing only when it is QA.
- Next action: SUCHA reviews `folk/high-integrity-fixes` into `develop`.

## Release readback

| Component | Verified result |
|---|---|
| Public origin | https://farmultimate-solutions.pages.dev/ |
| Pages production deployment | `d5a725d5-aefd-405f-b1c2-8c2cc45ab80d` |
| Backend version | `786ac3e0-7151-4163-8819-7b6791ff1fab` |
| Backend deployment | `097ac7d0-7d52-4400-905a-2948be8152b9`, 100% |
| API | Same-origin `/api`, `project_files_v1` available; `output_control_allowed=false` |
| Cloud configuration | Backend bindings compared before/after and unchanged; existing Pages service binding used. No schema migration or secret/config expansion. |
| Static release | All 77 public JS/CSS/HTML hashes match the assembled artifact. Cache `farmult-v227-integrity`. |

Backend was released first, followed by the verified Pages artifact. Git `master` and `develop` were not pushed or merged. Previous Pages deployment was `f05b6e34-fc29-4e8b-b19d-550c5f5507a6`; previous backend version was `f493a6ec-71bc-4dbf-8dfc-36a8df6e0423`. Rollback must consider compatibility: the new frontend requires the private-document backend capability.

## Validation

- Fresh `npm run check`: **820 PASS, 0 FAIL**; relay **9 PASS**. Worker dry run and Pages assembly passed.
- Authenticated against the existing QA account. Captured an immutable pre-test baseline and used revision-guarded writes. Added one isolated synthetic project, plot, cycle, stock item and work record.
- Actual partial fertilizer use: **1 kg at 50 baht**, stock **10 → 9 kg**. Repeated save, outcome transitions and independent client reload retain one task; plot/cycle/project each remain **50 baht**. These are three views of the same expense, not three expense entries.
- Shipped sync modules ran against the live API in independent clients. A **700 KiB** synthetic document migrated to a private reference shared by the live project and saved report edition; exact downloaded bytes matched. Unauthenticated public-photo access to this private object returned **403**.
- Production browser: confirmed QA account before mutation. At **390 × 844**, edit/save required the actual quantity/cost confirmation; confirmed the unchanged **1 kg / 50 baht** entry successfully. At **1440 × 1000**, stock showed **9 kg**, plot/cycle/project cost showed **50 baht**, cycle history showed one partial-work record, and the sync indicator showed saved. No console errors observed. Viewport override was reset.
- Downloaded the synced TXT through its live UI control: **716,800 bytes**. No PDF exported or saved.
- Final API readback after the mobile UI save: **FINAL_PRESERVATION_PASS**. Every pre-existing plot/cycle/project/task/stock/sale/trial record is deeply equal to the baseline; IDs are unique. All **33 worksheet records**, including all **7 incomplete records**, are unchanged. Missing dates and quantities remain missing; no values inferred.
- The real farm-account tab was inspected only to identify its account; testing and writes were confined to QA.

## Screenshots

- [Mobile actual quantity/cost confirmation](live-mobile-cost-review.jpg)
- [Desktop stock after repeated save](live-desktop-stock.jpg)
- [Desktop cycle history and cost](live-desktop-cycle-history.jpg)

Screenshots contain only the isolated synthetic acceptance project/stock and QA account label. Source-derived worksheet data, credentials, raw account snapshots and deployment logs remain ignored and are not published.

## Blocked / Risks and follow-ups

- No blocker for the requested release or live sync/cost/stock acceptance. Mobile evidence is responsive viewport emulation, not a physical-phone test.
- Browser file-picker upload was not repeated. Live upload/migration and byte-accurate download were exercised through the shipped sync module/API; browser download passed.
- Low: The synthetic API-created attachment lacks an attachment timestamp; the plan UI renders `Invalid Date`. Add a missing-date fallback in a separate scoped change. The file itself downloaded correctly.
- Medium: The cycle overview's care milestone says no care record when its only work record has a partial/failed outcome, although history and costs correctly include it. Distinguish actual execution from successful outcome in this overview text in a follow-up.
- GitHub connector still reports `403 Resource not accessible by integration` for PR creation. Existing authorized GitHub CLI access successfully created draft PR #20 targeting `develop`; no repository permissions changed.
- DATA_ONLY / SAFE_OFF retained. No hardware commands, new output capability, destructive action or real farm-data mutation.
