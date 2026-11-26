# Plot history validation

Date: 2026-11-25 (Asia/Bangkok). Owner: Codex for Folk under `PROJECTS-TRIALS-20261124`.

## Scope and behavior

- Crop-cycle history and plot activity history share compact, date-grouped rows.
- Default **งานที่ทำแล้ว** includes completed and explicitly unsuccessful outcomes. **งานที่วางไว้** contains pending work. Counts reflect the selected plot/cycle scope before type/outcome filtering.
- Recorded groups use canonical `taskRecordDate` (actual completion date, recorded weather date or original date for older records). Planned groups use due dates, oldest first by default; undated work remains last and is not marked overdue.
- A row opens the existing activity detail dialog, retaining materials, labor, cost, notes, photos and editing controls. Planned rows retain completion and reschedule controls. Long notes stay in details.
- Costs use canonical saved activity cost; planned amounts are explicitly budgets. Saved quantities/units appear in the compact summary. Filtering changes only UI state.
- Plot history adds crop and round context. The round selector now distinguishes rounds of the same crop by number.

## Browser evidence

Local synthetic preview only, `http://127.0.0.1:4178/?projectPreview=1&cycle=demo-cycle-active-0&tab=tasks&build=20261125workflow8`.
Final app/notebook assets: `20261125history2`; service worker cache: `farmult-v205-plot-history`.

| Check | Observed result |
|---|---|
| Recorded default | Current cycle shows 8 recorded outcomes, including 1 unsuccessful outcome, separate from 19 planned tasks. Two tasks on 24 November share one date heading. |
| Task details | The synthetic product-use row opens materials (90 baht) and labor (200 baht), totaling 290 baht, with existing edit controls. |
| Evidence photos | The inspection row opens its saved note and one photo on mobile. |
| Outcome/type filters | Failure filter isolates the unsuccessful watering record. Switching to planned clears the outcome filter. Fertilizer filter shows the 27 November task. A harvest filter with no current-cycle matches shows an explicit empty state. |
| Planned actions | The fertilizer row says budget 650 baht. Completion opens the date/photo form; reschedule opens the date/reason form. Both were cancelled without saving. |
| Round scope | All rounds show 10 recorded and 19 planned; round 1 shows only its 2 recorded tasks and 0 plans, with harvest on 20 September and preparation on 27 July. |
| Mobile layout | 390 × 844, no horizontal document overflow (390 px). Planned controls initially compressed the title; fixed by placing controls on their own row and visually rechecked. |
| Restored route | A reload after opening a plot exposed `notebookHistoryHtml` being called before its module loaded. Added a loading guard and a refresh on module readiness. Reload with final asset versions and later detail navigation produced no new errors. |

Screenshots, all visually inspected:

- `01-recorded-desktop.jpg` — 1440 × 940, default history with dated groups and project context.
- `02-task-detail.jpg` — 1440 × 940, material/labor details and existing editing controls.
- `03-planned-desktop.jpg` — 1440 × 940, planned fertilizer and budget/actions.
- `04-recorded-mobile.jpg` — 390 × 844, compact history controls and first date group.
- `05-planned-mobile.jpg` — 390 × 844, final full-width title/materials with actions below.
- `06-plot-round-history.jpg` — 1440 × 940, plot history filtered to the older crop round.

## Automated validation and boundaries

- `npm run check`: **655 passed, 0 failed**, relay **9/9** (`check.log`). Seven new behavior/regression tests cover history grouping, actual-date fallback, planned ordering, filters, saved quantities/canonical costs, actions, state isolation and restored-route load order.
- `node --check js/app.js` and `node --check js/cycle-notebook.js`: passed.
- `git diff --check`: passed; only existing LF/CRLF normalization warnings.
- Existing synthetic data includes prior QA records. This follow-up did not save completion, rescheduling, cost, stock or project mutations, and did not overwrite unfinished activity/project drafts.
- No real-account, cloud synchronization, live field data or hardware test. No new dark-mode walkthrough or full accessibility audit. This is an implementation walkthrough, not participant usability testing.
- Existing error-log entries from the earlier load-order bug remain in browser history; no new errors appeared after the final correction and reload.
- **Deployment: NOT_DEPLOYED**. No push, merge, production changes, firewall changes or LAN listeners.
