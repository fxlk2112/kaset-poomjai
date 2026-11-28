# Farm overview completion circles

- **Owner:** Codex for Folk under `PROJECTS-TRIALS-20261124`; SUCHA retains integration ownership.
- **Branch:** `codex/projects-trials-v1`, `origin/develop` base `40721b5`.
- **Task / Scope:** Extend the circle completion control to the farm overview work list highlighted in the user's screenshot. Preserve title-click details, date/status information and the existing material review flow.
- **Files changed:** `js/workspace.js`, `css/workspace.css`, `index.html`, `sw.js`, `COLLAB_STATUS.md`, `design-qa.md`, and `qa/home-circles/`. Earlier uncommitted work preserved.
- **Commit:** UNCOMMITTED on existing HEAD `c4d8798`; no push/merge.
- **Validation:** `npm run check`: 662 passed, 0 failed; relay 9/9. JavaScript syntax and `git diff --check` passed. Desktop 1440 x 940 and mobile 390 x 844 browser screenshots/readback inspected. Mobile document width 390; circle targets 44 x 44. No browser errors.
- **Blocked / Risks:** No local blocker. Synthetic QA on isolated loopback port 4180 only; original preview drafts on port 4178 were untouched. No live cloud or multi-device testing in this follow-up.
- **Deployment:** **NOT_DEPLOYED**. Existing `DATA_ONLY / SAFE_OFF`, stock/cost calculations, API and hardware boundaries unchanged.
- **Next action:** Include the overview extension with the circle-completion changes in SUCHA's integration review.

## Observed behavior

1. Each overview row has sibling completion and detail buttons, avoiding nested interactive controls. Accessible names include the plot to distinguish identically named work.
2. Clicking the water task title opens its original detail dialog. Clicking its circle opens the existing completion form.
3. Recording the synthetic water task complete removes it from pending work and changes the overdue count from 6 to 5. Recorded farm costs remain unchanged; no hardware action is performed.
4. Clicking a future fertilizer task circle opens **ตรวจปริมาณและต้นทุน**, with actual quantity and **ยืนยันและทำเสร็จ**. Cancelling leaves it planned and the upcoming count at 5.
5. Desktop layout preserves the overview's two columns. Mobile preserves name, plot/type, date and status alongside the separate circle without horizontal overflow.
6. Temporary viewport override reset and QA tab closed.

Screenshots: [desktop](desktop.jpg), [mobile](mobile.jpg). Check log: [check.log](check.log).
