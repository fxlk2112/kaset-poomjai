# Circle completion across task surfaces

Date: 2026-11-25, Asia/Bangkok. Owner: Codex for Folk under `PROJECTS-TRIALS-20261124`. Branch: `codex/projects-trials-v1`. Deployment: **NOT_DEPLOYED**.

## Implemented behavior

- Shared task rows show a 44 × 44 completion target to the left of a separate detail button. The circle is visually 26 px; its clickable area is larger.
- The calendar grid remains a day selector. Each task in the selected-day list has its own circle, including global and crop-cycle calendars.
- Completed tasks show a disabled green tick, failed tasks a disabled cross, and closed-project tasks a disabled circle. Clicking titles opens details without changing task status.
- Notifications use separate circle, detail and dismiss controls, with visible plot names. Opening completion closes the notification panel.
- Pending chemical/fertilizer work enters the existing actual-quantity/cost review form from circles, task details, ordinary project work recording and the legacy compatibility completion handler. No new activity/cost/stock persistence path was added.

## Coverage

| Surface / path | Verification |
|---|---|
| Activities: pending list | Desktop/mobile screenshot and DOM readback; 10 pending tasks have separate circles and details. Material circle opens review. |
| Activities: history | Mobile DOM and screenshot; new central task appears once; completed and failed circles disabled. History grows from 25 to 26 after the synthetic completion. |
| Activities: all list | Source audit: same shared task renderer as pending/history. |
| Global calendar | Browser selects 27 November; two pending fertilizer tasks and one completed fertilizer task show appropriate circles. Pending material circle opens review. |
| Crop-cycle calendar | Browser selects plot 2, round 2, 27 November; circle and independent detail control visible. Circle opens quantity/cost review. |
| Plot overview | Browser readback/screenshot: pending work circles and disabled completed inspection circle. |
| Plot/crop history | Crop history readback: recorded and planned tabs still separated/grouped by date; done/failed disabled and pending actionable. Plot-wide history uses the same existing component. |
| Farm overview | Browser readback after reload: overdue work retains separate circle and title buttons. |
| Project subtasks | Browser readback: all three existing completed tasks show disabled ticks; project total remains 480 baht. Existing project dirty-record guard retained. |
| Central work | Created one synthetic zero-cost planned task; clicked circle, confirmed without a photo; pending 1 → 0, completed 0 → 1, cost remains 0. Confirmed matching single activity-history entry. |
| Notifications | Mobile screenshot/readback: circle, plot name, separate details and dismiss. Circle closes panel and opens normal completion; cancellation leaves task pending. Details independently open the task. |
| Task detail completion | Pending fertilizer detail → “ทำเสร็จ” opens quantity/cost review. |
| Crop yield rows / legacy list fallbacks | Source audit: shared task renderer, including completed yield records. No new synthetic harvest created. |

## Material safety and persistence checks

Global calendar fertilizer review showed actual quantity, stock source, unit price and summary before confirmation. Attempting confirmation with missing unit price stayed in the form with the price error. Canceling preserved the pending task. Crop-calendar material review was also canceled. No material usage, stock deduction or material cost save was made in this follow-up.

Regression tests verify that spray, fertilizer and general work containing chemical/fertilizer cost items enter review without mutating task, money or stock state. Direct detail/legacy completion and return-to-detail context are covered. Closed-project review is rejected. Earlier tests still cover stale double submission, canonical cost reconciliation, inventory and ordinary/failed completion.

The preceding actual material-save audit remains documented in `qa/task-circles/validation.md`: 0.2 fertilizer bag added 130 baht once to project and crop cycle and consumed 10 kg once. This follow-up reuses that persistence path; it does not claim another live material-save test.

## Visual evidence

Screenshots captured through the browser and inspected:

- `activities-desktop.jpg` — 1440 × 940, pending list and left-side circles.
- `activities-mobile.jpg` — 390 × 844, pending list with separate reschedule row.
- `activities-history-mobile.jpg` — completed history including the new synthetic central task.
- `calendar-desktop.jpg`, `calendar-mobile.jpg` — selected-day task controls; mobile capture is scrolled to the task list.
- `cycle-calendar.jpg` — crop-cycle calendar with selected-day fertilizer circle.
- `plot-overview.jpg` — plot summary task rows.
- `central-pending.jpg`, `central-complete.jpg` — before/after ordinary completion.
- `notifications-mobile.jpg` — final notification circles and visible plot names.

Mobile DOM measurements: activity history, global calendar and notification page width = viewport width = 390 px. Calendar and notification circle targets are 44 × 44 px. Dark-theme screenshots reflect the current preview theme; no theme preference was changed. Full-page screenshot capture initially timed out, so evidence uses supported viewport captures instead.

## Checks and limits

- `npm run check`: **664 passed, 0 failed**, relay **9/9**. Output: `check.log`.
- `git diff --check`: passed (only existing line-ending conversion warnings).
- Browser error log after final reload/interactions: **empty**.
- Synthetic saves used isolated loopback preview on port 4180. Original preview and unfinished drafts on port 4178 were not modified. QA tab closed and temporary viewport override reset.
- No live cloud, production deployment, real farm data or hardware actions. Existing working-tree changes preserved.

Handoff: `docs/ALL_TASK_CIRCLES_HANDOFF.md`.
