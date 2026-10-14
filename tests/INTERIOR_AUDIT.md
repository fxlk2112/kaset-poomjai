# Interior UX and behavior audit

Build: `20260907cardaudit` (2026-09-07)

## Scope

Reviewed the home, plots, crop cycles and details, stock, activities, analytics,
trials and details, equipment, water, weather, prices, settings, and sales forms.
Kept the existing brand, logo, landing page, navigation, and application patterns.

## Changes

- Recognize completed/failed activity costs using the actual recorded date.
- Split mixed cost items into their respective reporting categories.
- Reserve stock for new planned activities; withdraw only on completion.
- Validate grouped stock quantities and stage edits before committing changes.
- Preserve legacy withdrawals rather than silently changing historical stock.
- Close a final-harvest cycle on completion and reopen only its owned closure
  when that completion is undone or changed to failed.
- Distinguish planned budgets, reserved stock, physical stock, and actual costs.
- Simplify repeated cards, nested surfaces, mobile spacing, and action layouts.
- Wrap long content, remove decorative KPI overflow, and label dynamic forms.
- Use native buttons for interactive card areas and expose selection states.
- Enable equipment maintenance add/edit/delete with validation and history.
- Display water commands as requests, not confirmed physical device states.
  Reject offline requests, guard duplicate submissions, and preserve the last
  accepted command when the server rejects a request.
- Request explicit weather wind units; preserve the correct label for legacy
  snapshots. Reference: https://open-meteo.com/en/docs
- Correct local/cloud storage wording in settings and receipt theme contrast.

## Verification

Command: `node --test tests/interior.test.cjs`

Result: 39 passed, 0 failed. Coverage includes financial dates, stock reservation
and reversal, legacy stock, atomic sale edits, cycle completion, water requests,
sync retry, concurrent revisions, reconnect, and account isolation.

Syntax checks passed for the changed application JavaScript files.
`git diff --check` passed.

Browser checks used an isolated local preview with synthetic data. Screenshots
were inspected at 320, 390, 768, and 1440 pixels, across dark and light themes.
The main mobile/tablet screens had no document-level horizontal overflow.
Weather hourly forecasts intentionally remain horizontally scrollable.

Interactive checks included planning and completing a stock-consuming task,
maintenance add/edit, a sale and receipt, and keyboard activation of cycle
details. No console errors or warnings were observed in the preview.

Evidence folder:
`C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/farm-all-cards-20260907`

## Limits and follow-up

- Production data was not modified; this build was not pushed or deployed.
- No physical pump/ESP32 commands were sent. Device acknowledgement needs a
  separate hardware integration test.
- Real Google sign-in and multi-device production sync were not repeated in
  this audit; local automated sync tests passed.
- Price-provider integration was not tested with a live response.
- Fresh offline installation and a complete accessibility audit remain untested.
- Historical sale margins still use the current stock average cost. Persisting
  immutable cost-of-goods snapshots is separate accounting work.

This is a scoped audit of observed screens and covered workflows, not a claim
that every possible application state or external integration is defect-free.
