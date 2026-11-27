# Farm calendar design QA — 2026-11-27

final result: passed

Scope: adapt the supplied calendar composition inside the existing green FARMULTIMATE application. User approved implementation with existing task/material-review behavior. Previous QA: [archive](qa/farm-calendar/previous-design-qa.md).

## Findings and fixes

- **Resolved P2 — future-day wording.** The add button originally said “วันนี้” on future dates. It now refers to the selected date, as do the empty state and date-picker action. UI readback confirmed 28 November, plot A, cycle 2 and the filtered project were prefilled, with planned time blank.
- **Resolved P2 — tall mobile toolbar.** Moved Today alongside view modes/add, keeping date/navigation together. [Final mobile](qa/farm-calendar/mobile.jpg) shows the compact two-row toolbar.
- **Resolved P2 — compressed tablet task names.** At 900–1199 px, cells now show dates/counts; the selected-day panel contains full task names. [Final tablet](qa/farm-calendar/tablet.jpg).
- **Resolved P2 — excessive empty month-row height.** Reduced minimum heights, allowing busy rows to grow for three task chips and overflow. [Desktop](qa/farm-calendar/desktop.jpg), [large desktop](qa/farm-calendar/desktop-reference-size.jpg), [complete page](qa/farm-calendar/desktop-full.jpg).

No remaining P0/P1/P2 findings in inspected states. This is a functional adaptation, not a pixel copy of the blue personal-planning example.

## Visual comparison

Source [reference](qa/farm-calendar/reference.png): 1920×1097, October 2026, five rows, personal tasks/goals, no farm shell. Implementation: 1920×1097 CSS viewport, density 1; captured viewport pixels 1920×1068; full-page image 1920×1217. No scaling applied. The 29-pixel capture difference is blank-padded, not treated as a design defect.

Opened and compared together: [full comparison](qa/farm-calendar/desktop-comparison.jpg), [toolbar](qa/farm-calendar/toolbar-comparison.jpg), [complete project card](qa/farm-calendar/project-comparison.jpg). Focused crops retain original pixel scale; blank space accommodates different region dimensions.

Intentional differences: existing farm sidebar/app bar/font/green palette; actual November 27 synthetic data and six calendar rows; Monday-first week consistent with the overview. Selected-day tasks replace personal goals. Projects derive from that day's work or project filter. Empty days are not filled with invented tasks/times.

## Required fidelity surfaces

- **Typography:** existing Thai font stack and weights retained. Desktop task titles 15 px, mobile 17 px. Full names wrap in the selected-day panel. Small calendar chips truncate with full titles on hover/click; tablet/mobile show counts instead.
- **Layout:** calendar left, daily work/projects right; mobile stacks week/date controls, work and projects. Rounded white cards, subtle borders, consistent gutters. No horizontal overflow at 360/390/1024 px; completion controls measured 44×44 px. Dense months scroll vertically within the existing page.
- **Colors:** existing emerald actions/selection, mint completion, pastel activity categories and amber overdue/material-review labels.
- **Images/icons:** existing brand image and standard line-icon helpers reused. No rasterized UI or external image dependencies. Personal category icons intentionally become farm activity icons.
- **Content:** Thai dates, canonical task counts/project codes, ordinary projects supported. No forced experiment or KPI. Blank times display no clock/time; completed work uses the actual recorded date.

## Functional/accounting checks

Month/week/day navigation, today, date jump to 3 December, search, plot/cycle/project filters and clear were exercised through UI. Mobile defaults to week. Evidence: [week](qa/farm-calendar/desktop-week.jpg), [mobile selected date](qa/farm-calendar/mobile-selected.jpg), [360 px month](qa/farm-calendar/mobile-month-360.jpg). Prefilled plan form left time blank; no plan was committed in the final preview.

On isolated synthetic port 4183, circular completion opened canonical quantity/cost review. Editing then cancelling retained the original plan. Confirming 25 kg / 325 baht completed the same activity: [result](qa/farm-calendar/material-result.jpg). Project total 525, plot A total 525, farm total 625. Reload retained three completed tasks and 70% project progress; completed circles disabled. Regression tests also verify cycle total 525 and no duplicate mutation. Final preview port 4185 retains original synthetic tasks/costs.

Seven focused calendar tests cover dates/leap years, actual completion dates, filters, ordinary projects, invalid dates, escaped names, absent times, navigation/default modes, form presets, material review and one canonical cost mutation. `npm run check`: **703 passed, 0 failed; relay 9/9**. Diff whitespace check passed. Error logs empty on inspected browser tabs.

## Completion checklist

- [x] Existing green shell retained; desktop/mobile screenshots and readback inspected.
- [x] Source/rendered combined comparison and focused regions inspected.
- [x] Material review and canonical accounting verified; required checks passed.

Live authenticated cloud synchronization and device-specific native browsers were not tested; no separate staging account exists. No production/backend/hardware changes or deployment. [Handoff](qa/farm-calendar/handoff.md).
