# Beginner Workflow QA - 2026-09-24

Build: `20260924clarity1`. Local preview only; no production data changes or deployment.

## Changes

- Owner setup follows plot, crop cycle, first completed/failed activity. Stock is not a prerequisite.
- An account without plots starts with setup instead of a dashboard full of empty summaries.
- Owner home has a direct entry to pending team reviews.
- Home financial summaries distinguish missing financial entries from explicit zero-valued finance records.
- Collector draft state explicitly distinguishes device storage from submission.
- Historical drafts retain their date and expose a separate new-today action with undo protection.
- Crop selection includes the round and planting date; plant age names the observation date.
- Optional notes/photos are collapsible and existing content reopens them.
- Review includes plot, crop round, date, result, watering/material information, notes and photos.
- Submitted-list filters cover text, status, plot and inclusive date range on the current page (100 records maximum per page). This is intentionally labeled, not global search.
- Queue errors remain attached to the failed record; internal error metadata is excluded from retry requests.
- Logout removes the session without deleting account-scoped drafts/queues. The dialog discloses device retention, including the shared-device concern.
- Email login retries queued work after the login busy state is released.
- Out-of-order sent-list responses cannot replace newer results.

## Verification

- `node --test tests/*.test.cjs`: 292 passing tests.
- Syntax checks for owner and collector scripts; `git diff --check`.
- Local synthetic collector: historical date 2026-09-13 shows 7-day age for planting on 2026-09-06.
- Review/back/review/submit watering at 30 minutes: one pending record visible in owner inbox.
- Status filter hides a nonmatching record; clear restores it.
- Logout/login preserves a new 45-minute watering draft.
- Empty-owner UI: first action opens plot form; creating a plot enables cycle setup; creating a cycle enables first-work entry, which opens in completed-work mode.
- Desktop screenshots and mobile-width screenshots of setup, collector filters and logout dialog; checked for horizontal overflow.

## Limits

- No physical-phone or multi-browser concurrency test in this pass.
- Existing historical records were not repaired or removed.
- Drafts are browser-local, not encrypted backups; browser storage deletion still removes them.
- Existing deployment and team-feature work was already uncommitted before this pass and remains uncommitted.
