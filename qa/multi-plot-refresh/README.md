# Multi-plot dropdown regression — 2026-11-28

- Owner: Codex for Folk; SUCHA retains integration review.
- Branch: `codex/multi-plot-type-refresh`.
- Task / Scope: Restore existing multi-plot selection when the compact new-activity form changes from general work to spray/fertilize. Preserve selected plots/cycles/areas across type changes; keep central-work plot fields hidden.
- Files changed: `js/app.js`, `js/task-wizard.js`, `index.html`, `sw.js`, `tests/task-wizard.test.cjs`, task lock and this synthetic QA evidence.
- Commit: The commit containing this report (based on `9cac81f`).
- Deployment: **NOT_DEPLOYED**. No production requests, account writes, backend/schema/hardware changes, or inferred worksheet values in this task.
- Next action: Review the local fix for integration before a separately authorized production release.

## Confirmed cause

The compact form exposes the native activity-type select. Its `App.taskTypeChange()` handler previously refreshed scope and cost fields but not the wizard's multi-plot controls. Only the older wizard type buttons refreshed those controls. Reproduced locally: open a new general-work activity, select fertilizer, and the multi-plot checkbox remains hidden.

The type-change handler now refreshes multi-plot controls when a live wizard is active. It does not activate a closed, editing or hydrating wizard. Single-plot fields also respect the central-work radio selection. No ledger mutation code changed.

Existing eligibility remains: multiple plots are available for **new spray/fertilizer records**. Other activity types and editing an existing record retain their existing behavior.

## Validation

- `npm run check`: **827 passed**, 0 failed; `RELAY_VALIDATION_OK messages=9`.
- Focused wizard + allocation suite: **25 passed**. Three new behavioral cases cover the native dropdown, plot/area preservation and inactive wizard guard. Existing allocation cases cover atomic rollback, reservations, rounding and stock consumption.
- `git diff --check`: passed.
- Browser readback and screenshots: desktop **1440 × 1000** and mobile viewport **390 × 844**; mobile document width 390, no horizontal page overflow. This was responsive browser testing, not a physical phone.
- Ran the shipped Worker and same-origin Pages API handler through a loopback-only SQLite adapter. All records were synthetic. The runtime/session database is ignored and is not included in evidence.
- Created one fertilizer entry for two plots (1 and 3 rai), selected each crop cycle, switched fertilizer → spray → fertilizer, and retained both selections and areas.
- Review showed **4 kg / 200 baht** total, split **1 kg / 50 baht** and **3 kg / 150 baht**. Stock preview showed **9 → 5 kg**. Confirmed the save through the mobile UI, waited for sync, reloaded, and verified stock stayed **5 kg**.
- Database assertions: exactly **2 new records**, one shared batch, total quantity **4 kg**, total new cost **200 baht**. Plot and cycle totals are **100 and 150 baht**, including the pre-existing 50-baht partial record on the first plot. No duplicate cost or stock deduction in this scenario.
- All seven incomplete synthetic records retain their original data, including blank dates, null quantities and pending flags. Only the existing load normalizer's empty `doneNote`, `doneTime` and `wateringSessions` defaults were added; no missing data was filled. Real farm/QA cloud data was untouched.

## Evidence

- [Desktop plot selection](desktop-selection.jpg)
- [Desktop confirmation](desktop-review.jpg)
- [Mobile plot selection](mobile-selection.jpg)
- [Mobile allocation and stock confirmation](mobile-review.jpg)
- [Mobile stock after reload](mobile-stock-reloaded.jpg)
- [Persistence assertion results](persistence-check.json)

## Blocked / Risks

No local blocker. This change is not yet available on the production website. The verification covers the existing spray/fertilizer multi-plot flow; it does not add multi-plot support to other work types.
