# Farm overview design QA — 2026-11-27

final result: passed

## Optional planned-time follow-up — 2026-11-27

Added the user-requested optional planned-time field, with blank default, draft/review/edit support and separate actual completion time. Removed fabricated planned/actual times from the overview fixture and one-time cleaned only matching known synthetic IDs in the local preview. No production migration. Overview shows entered times at narrow widths as well as desktop; no clock/time when blank.

Browser evidence: [desktop form](qa/farm-overview/planned-time-desktop.jpg), [mobile form](qa/farm-overview/planned-time-mobile.jpg), [360 px entered time](qa/farm-overview/planned-time-360.jpg), [1024 px today/upcoming times](qa/farm-overview/planned-time-tablet.jpg), [desktop with no sample times](qa/farm-overview/planned-time-desktop-home.jpg), [mobile with no sample times](qa/farm-overview/planned-time-mobile-home.jpg). The 09:15 / 11:20 values in test captures were entered through the form during QA and cleared afterward. Final preview contains no fabricated or QA-entered times. 360/390/1024 px DOM widths matched viewport widths; no overflow. Full checks: **696 passed, 0 failed; relay 9/9**. [Current handoff and limits](qa/farm-overview/planned-time-handoff.md).

Scope: implement the approved combined desktop overview and latest mobile adaptation inside the existing FARMULTIMATE app. Previous project QA is preserved in [previous-design-qa.md](qa/farm-overview/previous-design-qa.md).

## Visual evidence

- Desktop visual truth: `C:/Users/USER/.codex/generated_images/01a207c1-667e-7670-86ba-5df7a70aacb0/exec-c9da43fc-37d3-4f15-a4ca-a7a7d7b2ff28.png` (1717 × 916).
- Mobile visual truth: same folder, `exec-fb4ecfb1-62a4-4ca4-833d-d1d70b2ee824.png` (1206 × 1306; two scroll positions of one page).
- Actual desktop: [desktop-reference-size.jpg](qa/farm-overview/desktop-reference-size.jpg), 1717 × 916 CSS/pixels, density 1. Additional capture [desktop.jpg](qa/farm-overview/desktop.jpg), 1440 × 1000.
- Actual mobile: [mobile.jpg](qa/farm-overview/mobile.jpg) and [mobile-lower.jpg](qa/farm-overview/mobile-lower.jpg), each 390 × 844 CSS/pixels, density 1.
- Full comparisons, opened together and inspected: [desktop-comparison.jpg](qa/farm-overview/desktop-comparison.jpg), source left / implementation right at identical dimensions; [mobile-comparison.jpg](qa/farm-overview/mobile-comparison.jpg), source / implementation for top and lower scroll positions. Mobile source screen crops `(25,75,582,1289)` and `(623,75,1180,1289)` are normalized to 390 × 850 (6 px aspect-ratio difference; no UI stretching in the app).
- Focused task control/copy comparison: [tasks-focused-comparison.jpg](qa/farm-overview/tasks-focused-comparison.jpg). Save-state visual: [mobile-receipt.jpg](qa/farm-overview/mobile-receipt.jpg).
- Additional widths: [tablet.jpg](qa/farm-overview/tablet.jpg) 1024 × 900, [mobile-360.jpg](qa/farm-overview/mobile-360.jpg) 360 × 800. [mobile-dark.jpg](qa/farm-overview/mobile-dark.jpg) checks dark-theme legibility.

## Findings and iteration

1. **Resolved P2 — first mobile screen too tall.** The pre-existing financial scope banner and large task spacing pushed the third task/completion disclosure below the screen. Evidence: [mobile-comparison-first.jpg](qa/farm-overview/mobile-comparison-first.jpg). Moved financial scope into the farm summary, placed sync state under the heading, compacted spacing, and retained readable 18 px task titles and 44 × 44 completion targets. Final mobile shows all three tasks plus the completed-work disclosure above navigation.
2. **Resolved P2 — mobile brand missing.** Restored the existing real brand image/text in the home app bar. Kept the existing menu, notification, account and bottom-navigation controls functional.
3. **Resolved P2 — narrow desktop today badge wrapping.** Added non-wrapping badge text and responsive day-cell gaps; final 1024 px capture/readback shows a single-line today badge, no horizontal overflow.
4. **Resolved P2 — desktop task hierarchy too small.** Increased wide-screen task titles to 20 px, section headings to 24 px and project names to 24 px; recaptured both desktop sizes and recomposed the exact-size comparison after this change.
5. **Resolved P2 — project cards too tall on mobile.** Reduced caption/control spacing; retained real progress, accessible count buttons and task/project links. Final lower capture shows both projects and the collapsed farm summary.

No remaining P0/P1/P2 findings in the inspected states.

## Required fidelity surfaces

- **Fonts/typography:** existing Sarabun/Noto Sans Thai stack retained, with larger task/section hierarchy. Thai labels wrap without ellipsis on mobile. Mock glyph shapes/weights differ slightly from the existing app font (P3, accepted consistency with the existing web).
- **Spacing/layout:** desktop work left / projects right; mobile date → overdue → today → upcoming → projects → collapsed finances → receipt. Flat white cards, 8 px radii, mint states. No overflow at 360, 390, 1024 or 1440 px. Sidebar dimensions and menu remain the existing app shell.
- **Colors/tokens:** existing emerald actions, pale mint, muted neutral background, amber material/overdue states; dark mode uses existing tokens with corrected selected-day contrast.
- **Image/icon quality:** existing brand PNG and installed line-icon helpers retained. No rasterized UI, substituted illustrative assets, or new external image dependencies.
- **Copy/content:** real task dates, counts and canonical project codes. No KPI scores or forced experiment data. Date headings change with selection. Existing data determines upcoming/overdue entries; no invented times.

Expected differences from illustrative mocks: overdue is also visible on desktop when nonzero; week navigation is functional; this fixture has a third upcoming task exposed by “ดูอีก 1 งาน”; next project tasks are the earliest unfinished canonical tasks, including overdue work. The pre-save lower screenshot has no success banner. The separate post-save screenshot correctly says “เก็บในเครื่องนี้”, never claims cloud synchronization in the local preview. The QA-only footer overlay in earlier/receipt captures is absent from the clean final preview.

## Interaction and accounting checks

- Selected 28 November, advanced into the week spanning November/December, returned to today; task lists/heading change, current project progress stays current.
- Overdue disclosure, completed-work disclosure, project done/remaining lists, plot/cycle/project links, calendar CTA and ordinary completion form exercised in the browser. Closed-project/material safeguards remain canonical.
- Cancelled material review: no status or monetary change. Confirmed 25 kg of synthetic fertilizer: 325 baht exactly once. Plot/cycle/project cost 200 → 525; farm cost 300 → 625; stock 20 unopened → 19 unopened + 25 kg open. Reload preserves totals; done circle disabled. Readback evidence is in `qa/farm-overview/*-accounting-readback.txt`.
- Ordinary zero-cost task completion updates progress and produces a contextual save receipt without changing cost. Receipt owner separation and pending/error/offline/synced labels covered by unit tests.
- Console: no errors observed in tested flows.
- Final `npm run check`: **694 passed, 0 failed**, relay validation **9/9**. New behavior tests include date boundaries, actual completion dates, empty state, escaping, read-only rendering, material review, idempotent accounting and honest sync feedback.

## Limits and follow-up

All browser mutations used isolated synthetic origins. Live authenticated cloud synchronization was not exercised; no separate test account exists. The existing API/sync flow was not modified. P3 follow-up: refine small icon/typographic differences only if requested; the approved structure and core interactions are complete.

Local deliverable: `http://127.0.0.1:4185/?projectPreview=1` (GET-only static preview; API returns 503). Deployment: **NOT_DEPLOYED**. Hardware remains **DATA_ONLY / SAFE_OFF**.
