# Farm calendar — 2026-11-27

- **Owner:** Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- **Branch:** `codex/farm-calendar-refresh`, source `5823f34`; refreshed `origin/develop` verified as ancestor.
- **Task / Scope:** Adapt supplied calendar inside current green app. Desktop month/week/day, selected-day tasks and related projects; mobile week-first, tablet date/count grid; search and plot/cycle/project/type/status/scope filters; selected date/context prefilled in existing form. Preserve optional time, material review and canonical accounting.
- **Files changed:** new `js/farm-calendar.js`, `css/farm-calendar.css`, `tests/farm-calendar.test.cjs`; scoped calendar link in `js/app.js`; assets/cache in `index.html` / `sw.js`; QA-only route in `qa/farm-overview/serve-audit.mjs`; `COLLAB_STATUS.md`, `design-qa.md`, evidence in this directory.
- **Commit:** HEAD of `codex/farm-calendar-refresh`, feature commit containing this handoff.
- **Validation:** `npm run check` **703/703**, relay **9/9**; syntax/whitespace pass. Browser readback/screenshots at 1920, 1440, 1024, 390 and 360 px. Navigation, date jump, filtering/search, prefilled form, completion/cancellation checked. Visual QA passed; inspected browser error logs empty.
- **Accounting evidence:** Isolated synthetic port 4183: planned fertilizer completed with 25 kg / 325 baht. Project/plot each total 525; farm 625. Reload retained amounts/progress and disabled completed circle. Tests verify cycle total 525 and no duplicate mutation. Calendar rendering/filtering creates no task/cost/stock record.
- **Blocked / Risks:** No implementation blocker. Live authenticated cloud round trip untested because no separate account exists. Existing synchronization/completion services retained. No backend, secrets, production data or hardware changes; DATA_ONLY / SAFE_OFF and same-origin API retained.
- **Deployment:** **NOT_DEPLOYED**. No push, merge or production release.
- **Next action:** Review [local calendar](http://127.0.0.1:4185/?projectPreview=1&view=calendar).

[Design QA](../../design-qa.md) contains evidence and intentional deviations. Final preview data is unchanged by accounting tests.
