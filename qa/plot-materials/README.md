# Plot material history — 2026-11-27

- Owner: Codex for Folk, user-requested plot/crop-cycle material read views; SUCHA retains shared integration review.
- Branch: `codex/plot-material-history`, based on `9d08a11` (deployed runtime `845ea5b` plus release documentation); refreshed `origin/develop` at `40721b5` is an ancestor.
- Task / Scope: Show existing material use by actual date or product name; filter plot usage by crop cycle, category and month. Expand a product to inspect each use, or open the original task. Reuse the same views inside the crop notebook. Preserve all canonical stock/accounting/project data.
- Files changed: `js/plot-materials.js`, `css/plot-materials.css`, scoped navigation/wiring in `js/app.js`, `js/cycle-notebook.js`, `index.html`, `sw.js`, `tests/plot-materials.test.cjs`, this QA directory and `COLLAB_STATUS.md`.
- Commit: Included in the feature commit containing this handoff, parent `9d08a11`.
- Validation: `npm run check`: **684 passed, 0 failed**, relay **9/9**; `git diff --check` passed. Eight focused behavioral tests cover accounting/stock immutability, shared project links and repeated reads, cycle/plot scope, actual-date filters, old records, matching reported-material deduplication, comparable/incomparable units, missing/mismatched/zero costs, edits to canonical activities and HTML escaping.
- Blocked / Risks: No implementation blocker. Real production records were not modified or used for QA. Historical records without quantity/unit/cost remain explicitly unknown. Package quantities are converted only using a saved package snapshot; current stock sizes/prices are never used to rewrite past usage. Product names are grouped after trimming/collapsing whitespace and case normalization; incompatible units remain separate within the product. Existing unrelated Workers Build failure is outside this change; no remote push was issued.
- Deployment: **NOT_DEPLOYED** for this feature. Production remains the previously approved `845ea5b` release. No backend/API/schema changes are required.
- Next action: Review the local material-history preview before a separately requested production release.

## Browser evidence

Preview: `node qa/plot-materials/serve-audit.mjs`, then `http://127.0.0.1:4182/?projectPreview=1`.
This reuses the allowlisted loopback-only project preview on an isolated origin with synthetic fixtures. API writes are rejected. Original preview data on other ports is untouched. The temporary viewport override was reset after QA.

| Check | Observed result |
| --- | --- |
| Desktop 1440 x 940 | Five plot tabs fit on one row. Both material views render without page overflow. |
| Mobile 390 x 844 | All plot tabs remain visible across two rows with an opaque sticky background; no content shows through. Date rows and product cards fit without horizontal page overflow. Switches/selects are at least 44 px high. |
| Current cycle | 3 completed activities, 4 named materials, material cost **690 THB** in both views. |
| Original cycle total | **940 THB**, comprising 690 material + 250 labor; unchanged after filtering, switching views and opening original tasks. |
| Product A | 800 ml + 1 l = **1.8 l**, 2 activities, 270 THB; expanding shows both dated uses. |
| Other-category material | Synthetic co-material B remains visible: 500 ml, 2 activities, 90 THB. Labor is excluded from material totals. |
| Closed cycle | 1 activity, 500 ml, 75 THB, separate from current-cycle totals. |
| Unassigned legacy work | 0.5 bottle, 80 THB, retained without converting from today's package size. |
| Fertilizer filter | 25 kg, 1 completed use, 325 THB. |
| Planned-only month | 0 actual uses / 0 THB; 1 planned activity shown separately. Failed activity is excluded. |
| Task detail | Opens the existing record; planned 20 Nov vs actual 24 Nov retained. Original task cost 315 THB includes material 165 + labor 150. No save was submitted. |
| Errors | Browser error log empty. |

Final screenshots (synthetic data only):

- `dates-desktop.jpg`: plot date view, light theme.
- `products-desktop.jpg`: plot product summary, light theme.
- `dates-mobile.jpg`: mobile date table and task details link.
- `products-mobile.jpg`: mobile product cards and corrected sticky navigation.
- `cycle-materials.jpg`: crop notebook uses the same material summary while retaining the canonical 940-THB cycle total.

Dark-theme readability was also inspected before the final navigation adjustment; preliminary screenshots remain in ignored local `tmp/`, not in the final evidence set.

## Accounting boundary

The new module reads `S.tasks` and uses the existing material/report merger. Top-level legacy material mirrors are not added again when `costItems` exist. Each activity is counted once; repeated product lines within one activity add their real quantities/costs but count as one use. Project links are displayed as context, not read as another cost source.

The view does not call `saveState`, create/update tasks, touch stock balances or write a second ledger. Only completed activity costs contribute to actual material totals. Labor, planned and failed work are excluded. If a historical task total and its item breakdown conflict, the view flags the cost for review instead of inventing a material allocation. DATA_ONLY / SAFE_OFF and the existing same-origin API remain unchanged.
