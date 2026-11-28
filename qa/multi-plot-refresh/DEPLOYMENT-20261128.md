# Multi-plot fix — approved production release

- Owner: Codex for Folk; SUCHA retains integration review.
- Branch: `codex/release-multi-plot-20261128`; published source `folk/multi-plot-type-refresh`.
- Task / Scope: Deploy the existing multi-plot dropdown fix and verify desktop/mobile input, quantity/cost confirmation, persistence and duplicate-free cost/stock behavior in the isolated QA account.
- Files changed: `COLLAB_STATUS.md`, this release evidence and synthetic screenshots/results. Runtime code is the previously tested fix.
- Commit: Runtime `d98c096a2aab53412822521fb1b6a6a6644997a1`; the evidence commit contains this report.
- Deployment: **DEPLOYED**, authorized by the user's explicit `APPROVE_PRODUCTION_DEPLOY` in this chat for `farmultimate-solutions.pages.dev`.
- Next action: SUCHA reviews draft PR #23 after the existing integration stack.

## Release identity

| Item | Verified result |
| --- | --- |
| Canonical site | https://farmultimate-solutions.pages.dev/ |
| Production deployment | `7d15d444-d3da-4f1c-9d70-cc8d8291c0e3` |
| Immutable deployment | https://7d15d444.farmultimate-solutions.pages.dev/ |
| Source | `d98c096` |
| Previous release | `a7b820be-41e7-4b95-91a2-d4d47ff100cf`, source `344772c` |
| Service-worker cache | `farmult-v230-multi-plot-refresh` |
| App and wizard asset query | `20261128multiplot1` |
| Public artifact verification | All 77 HTML/JS/CSS hashes match on the canonical origin |
| Same-origin API | Health, `project_files_v1`, and `output_control_allowed=false` passed before and after release |
| Integration | [Draft PR #23](https://github.com/fxlk2112/kaset-poomjai/pull/23), target `develop` |

Used the existing verified Pages assembler and Wrangler release path, with Pages production selector `master`. No Git push/merge to `master` or `develop`. Backend, proxy, binding, schema and runtime API configuration are unchanged; no backend redeployment was necessary. DATA_ONLY / SAFE_OFF retained.

The GitHub connector returned 403 when creating the PR. The configured GitHub CLI successfully created it without changing permissions or credentials.

## Release gates

- Fresh `npm run check`: **827 passed**, 0 failed; relay validation **9 passed**.
- Both GitHub CI runs passed for the exact runtime commit before deployment: [push run 46133072544](https://github.com/fxlk2112/kaset-poomjai/actions/runs/46133072544) and [PR run 46133140254](https://github.com/fxlk2112/kaset-poomjai/actions/runs/46133140254).
- Artifact validation checked referenced assets, same-origin API forwarding, static fallback and fail-closed missing binding behavior.
- Loaded script URLs in the production browser match `20261128multiplot1`. Final browser console readback contained no errors.

## Live acceptance

Verified the signed-in identity is the isolated synthetic QA account before testing. The real farm-account tab was not accessed. Read a QA baseline through the existing authenticated API and compared it after UI saves; credentials and raw account snapshots remain ignored and are not committed.

Prepared only two new synthetic QA plots/cycles (1 and 3 rai) and one new synthetic fertilizer stock item (10 kg, 50 baht/kg). These fixtures and the resulting records remain in the QA account for inspection.

- Desktop **1440 × 1000**: changed the native dropdown from general work to fertilizer; the multi-plot checkbox appeared immediately. Chose both QA plots and cycles, changed fertilizer → spray → fertilizer, and retained selections and areas.
- Mobile viewport **390 × 844**: changed general work → fertilizer, retained both selected plots and the 4-rai total. Document width stayed 390 px; no horizontal page overflow. This is browser responsive testing, not a physical-phone test.
- Attempting review with no material quantity was blocked with the expected quantity/unit message.
- Review showed **4 kg / 200 baht** total and split it into **1 kg / 50 baht** for plot A and **3 kg / 150 baht** for plot B. Stock preview showed **10 → 6 kg**.
- Submitted the new entry through the mobile-width UI, waited for sync, reloaded, and verified **6 kg** remained.
- Desktop activity history showed exactly the two new records with **50 and 150 baht** respectively.
- Opened the new plot A record, saved it again without changing quantity/cost, waited for sync and reloaded. Totals and stock remained unchanged.
- API readback assertions passed after both the first save and the repeat save: exactly **2 new task IDs**, one shared batch, **4 kg** total, **200 baht** total. Canonical plot and cycle finance calculations each return **50 and 150 baht**; stock remains **6 kg**, opened quantity **0**. No duplicate cost or stock deduction in these tested paths.
- Every original plot, cycle, project, task, stock item, sale and trial was deep-equal to the pre-test baseline. The A Syngenta worksheet project retains **33 records**, including **7 pending records** with their missing fields untouched. No PDF was saved and no values were inferred.

## Evidence

- [Desktop selection](live-desktop-selection.jpg)
- [Desktop cost/stock review](live-desktop-review.jpg)
- [Desktop saved history](live-desktop-history.jpg)
- [Mobile selection](live-mobile-selection.jpg)
- [Mobile cost/stock review](live-mobile-review.jpg)
- [Mobile stock after reload](live-mobile-stock-reloaded.jpg)
- [Final API assertions](live-acceptance-result.json)

## Blocked / Risks

No release or acceptance blocker. Existing scope remains new spray/fertilizer entries; this release does not add multi-plot support to other work types or editing an existing entry. The integration PR remains draft pending review; protected Git branches are unchanged.
