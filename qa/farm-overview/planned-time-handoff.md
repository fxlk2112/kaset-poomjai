# Optional planned time — 2026-11-27

- **Owner:** Codex for Folk, explicitly requested in this chat; SUCHA retains integration review.
- **Branch:** `codex/optional-planned-time`, source `0e8f0dc`; refreshed `origin/develop` verified as ancestor.
- **Task / Scope:** Optional planned time in the existing activity form. Blank default; persist on create/edit and in drafts; display in review/details and overview only when supplied. Keep planned time separate from actual completion time. Recurring plans carry the explicit planned time without copying actual time or costs. Remove invented times from the synthetic overview preview.
- **Files changed:** `js/app.js`, `js/data.js`, `js/task-wizard.js`, `js/farm-overview.js`, `css/farm-overview.css`, asset versions in `index.html` and `sw.js`; `tests/farm-overview.test.cjs`, `tests/recurring-tasks.test.cjs`; synthetic `fixture.cjs`, `remove-sample-times.cjs`, `serve-audit.mjs`, screenshots in this directory; `COLLAB_STATUS.md`, `design-qa.md`, this handoff.
- **Commit:** HEAD of `codex/optional-planned-time` (feature commit containing this handoff).
- **Validation:** `npm run check` **696/696** and relay **9/9**. JS syntax and whitespace checks passed. Browser screenshots/readback at desktop 1440×1000, tablet 1024×900, mobile 390×844 and 360×800. No observed console errors; no horizontal overflow.
- **Interaction evidence:** Existing plan starts blank. Entered 09:15, saved, reloaded and reopened edit: 09:15 persisted and appeared on overview/details. Cleared and saved: overview/detail time removed. Mobile new-plan draft retained 09:15 after close/resume, and review showed the planned time; clearing removed it from review. Today and upcoming times remained visible at 360/1024 px. Cleared both QA-entered values and reloaded: zero time labels, original 2/5 today count. The temporary draft was discarded through UI.
- **Material/cost evidence:** Existing material circle still opens actual-quantity/cost review with planned-time input hidden/disabled. Cancellation retains the task and counts. Full regression suite verifies single canonical cost/stock mutation and no duplicate totals; the change adds no financial writes.
- **Preview cleanup:** Fresh fixture contains no planned or actual times. Existing isolated preview receives a one-time cleanup limited to known synthetic IDs with exactly the old fabricated values. Other times, task fields and cost records are retained. Production assets do not import cleanup code.
- **Blocked / Risks:** No implementation blocker. Live authenticated cloud round trip remains untested because there is no separate test account; existing state synchronization is unchanged. No backend, hardware, secrets or production data edits.
- **Deployment:** **NOT_DEPLOYED**. DATA_ONLY / SAFE_OFF and same-origin API retained. No push or merge.
- **Next action:** Review [the updated local preview](http://127.0.0.1:4185/?projectPreview=1).

Screenshots with entered times are test evidence only. Final preview has those values cleared. See [design QA](../../design-qa.md) for links to all captures.

The project task-list modal was also checked at 360 px with an entered planned time: [project list](planned-time-project-list.jpg). Its content/scroll widths both equal 332 px, with no overlap; the time was cleared after verification.
