# Material search and recording follow-up — 2026-11-27

- Owner: Codex for Folk, explicitly requested in the current chat; SUCHA retains shared integration review.
- Branch: `codex/plot-material-history`, continuing the same feature from `74537a7`. Refreshed `origin/develop` is an ancestor.
- Task / Scope: Search material names in both date/product views; open the existing task wizard with plot/cycle context; collapse secondary plot information and tools on mobile.
- Files changed: `js/plot-materials.js`, `css/plot-materials.css`, scoped plot-header markup in `js/app.js`, asset versions in `index.html` / `sw.js`, `tests/plot-materials.test.cjs`, `COLLAB_STATUS.md`, this handoff and five synthetic screenshots in this directory.
- Commit: Included in the feature commit containing this handoff; parent `74537a7`.
- Validation: `npm run check` **687 passed, 0 failed**, relay **9/9**; `git diff --check` passed. Browser readback/screenshot at desktop 1440 x 940 and mobile 390 x 844. No browser errors observed.
- Blocked / Risks: No implementation blocker. Local synthetic data only, no production writes or live backend testing. Existing task drafts are preserved by the original resume/new-draft flow. Archived cycles are honored when explicitly selected for historical entry; the actual date remains editable in the existing form. Multiple active cycles require the user to select one in the form. Existing unrelated Workers Build failure remains outside this change.
- Deployment: **NOT_DEPLOYED**. No remote push, backend/schema changes, API routing changes or hardware actions. DATA_ONLY / SAFE_OFF retained.
- Next action: Review the updated local preview before a separately requested production release.

## Behavior and evidence

Preview: [Local material history](http://127.0.0.1:4182/?projectPreview=1), served by `node qa/plot-materials/serve-audit.mjs` with synthetic data and rejected API writes.

| Check | Result |
| --- | --- |
| Name search | Partial Thai/English names, whitespace normalization and case-insensitive tokens. Searching `ผลิตภัณฑ์ a` yields product A: 2 uses, 1.8 l, 270 THB in both views, preserving the selected crop cycle. Only matching material lines contribute to the filtered total. |
| Typing | Incremental typing remains in the same input; results update without replacing the input or losing the caret. Clear restores all results and focuses the input. No-match text is explicit. |
| Recording shortcut | Active cycle prefilled with plot 1 / round 2, done status and spray type. The original form exposes project suggestions and quantity/cost review. Selecting fertilizer and closed round 1 prefilled those exact values on mobile. Opening/canceling the form does not create an activity. |
| Actual browser save | Saved one synthetic non-stock material activity, 500 ml / 130 THB. Current-cycle material total increased **690 -> 820**; canonical cycle cost increased **940 -> 1,070**. One new history entry. Reload retained 820; canceling the subsequent draft did not add cost. |
| Accounting tests | Shortcut itself leaves state unchanged; canonical save/edit and repeated searches keep one task, unchanged post-save stock balance, and the same 50-THB material/project/cycle cost. No second ledger or stock writer was introduced. |
| Mobile header | About 182 px collapsed, showing plot name, area/current cycle, primary action and disclosure. Opening reveals the existing GPS/details and inspection tools; closing hides them again. `aria-expanded` follows the state. |
| Mobile controls | 390 px viewport / 390 px document width; no horizontal page overflow. New search, record, clear and disclosure controls are 44–47 px high. |

Screenshots: `search-desktop.jpg`, `header-mobile.jpg`, `search-mobile.jpg`, `entry-review.jpg`, `entry-mobile.jpg`.

Search and grouping derive from canonical saved activity lines. The shortcut calls `App.modalTask` and retains the existing wizard's review and submit path. It does not write activity, stock, cost or project data itself. The filtered subtotal describes the displayed matches; it does not replace the complete crop-cycle accounting total.
