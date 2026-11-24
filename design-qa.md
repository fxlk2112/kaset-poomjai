# Projects and trials implementation QA

final result: PASS — local preview, synthetic data only, 2026-11-24.

Base: develop `40721b5`; current UI source: `3f8d208`; branch: `codex/projects-trials-v1`.

## Browser checks

- Desktop 1440 × 960 and mobile 390 × 844, using the existing teal/white workspace shell.
- Brief → editable draft → plot/cycle selection → confirmation created PRJ-2569-001 and seven planned canonical activities. No costs or stock were posted by project creation.
- Linked an existing synthetic trial, selected a task, entered 42.5 cm and attached a local sample image through the native file picker. Duplicate same-day observation and future date were rejected. A valid date saved successfully.
- Edited the observation to 43 cm; one prior revision remained. Refresh retained the task link, measurement, image and caption.
- Saved report version 1. Browser print preview rendered a 16-page report with headings, activities, raw measurements, images and conclusion. Cancelled before printing; no physical print or production write.
- Reused material rows in the cycle activity form. No previous result/photo was copied. Review displayed current price and the stock change before confirmation.
- Recorded a synthetic 90-baht activity: cycle cost changed from 2,465 to 2,555; the same project showed 90. No second ledger entry.
- Report version 1 retained its earlier zero cost while the latest report reflected the new activity.
- Mobile width check: document width 390 / viewport 390, no page overflow. Forms and confirmation controls remained usable. Browser error log was empty.

## Evidence

- `qa/projects-trials/desktop-project.jpg`
- `qa/projects-trials/mobile-project.jpg`
- `qa/projects-trials/mobile-measurement.jpg`
- `qa/projects-trials/mobile-materials.jpg`
- `qa/projects-trials/cycle-notebook.jpg`

## Automated validation

`npm run check`: 610 passed, 0 failed; relay validation passed (9 messages).
The 12 added tests cover validation-before-mutation, failed-write rollback/retry, project codes, actual costs, immutable report versions, material reuse, account draft isolation and closed-project trial links.
An additional merge regression test verifies that logout reopens the account gate, clears account data from memory and retains the saved account slot.

## Limits

The task suggester uses editable templates. No model API has been configured. Reports use browser print / Save as PDF; no Word export. Local preview deliberately does not contact the real API. Live account synchronization, backend migrations, service bindings and production deployment were not performed.
