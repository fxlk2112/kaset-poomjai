# Light theme — approved production release

- Owner: Codex for Folk; SUCHA retains integration review.
- Branch: `codex/release-light-theme-20261128`; published source `folk/light-theme-surfaces`.
- Integration PR: [#22 — Improve light theme separation in plot material history](https://github.com/fxlk2112/kaset-poomjai/pull/22), draft targeting `develop`, following PRs #20 and #21.
- Task / Scope: Deploy the latest light-theme surfaces and preceding date/cycle-display fixes, then inspect light mode on the canonical site at desktop and mobile widths.
- Files changed: `COLLAB_STATUS.md`, this release record, and synthetic live UI evidence. Application code remains the tested feature snapshot.
- Commit: Runtime `344772c0417dc1afd6538fd922b6e9a46d9f0de2`; release-evidence commit contains this document.
- Deployment: **DEPLOYED** under the user's explicit `APPROVE_PRODUCTION_DEPLOY` in this chat for `farmultimate-solutions.pages.dev`.
- Next action: SUCHA reviews integration PR #22 in dependency order.

## Release identity

| Item | Verified result |
| --- | --- |
| Canonical origin | https://farmultimate-solutions.pages.dev/ |
| Production deployment | `a7b820be-41e7-4b95-91a2-d4d47ff100cf` |
| Immutable deployment | https://a7b820be.farmultimate-solutions.pages.dev/ |
| Previous deployment | `d5a725d5-aefd-405f-b1c2-8c2cc45ab80d` (runtime `f55802b`) |
| Source | `344772c` |
| Service-worker cache | `farmult-v229-light-surfaces` |
| Updated stylesheet versions | `20261128light1` |
| Canonical public assets | All 77 checked HTML/JS/CSS files match the assembled release artifact |
| Same-origin API | Health, `project_files_v1`, and `output_control_allowed=false` passed before and after release |

Used the repository's existing Pages assembler and Wrangler release path. The Pages production selector is `master`; Git `master` and `develop` were not pushed or merged. Backend, Pages proxy and runtime API configuration source are unchanged from `f55802b`; no backend redeployment or configuration/migration was needed. Existing same-origin service binding remains healthy.

## Validation

- Fresh `npm run check`: **824 passed, 0 failed**; relay validation: **9 passed**.
- Both required GitHub `npm-check` runs passed for runtime `344772c` before upload: [46128195450](https://github.com/fxlk2112/kaset-poomjai/actions/runs/46128195450), [46128199946](https://github.com/fxlk2112/kaset-poomjai/actions/runs/46128199946).
- Pages artifact assembly verified referenced assets, API forwarding, static fallback and missing-binding fail-closed behavior.
- Confirmed the existing signed-in account is the isolated QA account before interacting. The real farm-account tab was not accessed.
- Desktop **1440 × 1000**: verified the pale green-gray page, visible white card boundaries, darker form-control borders, green table headings/totals, date mode and expandable name summary. Browser-computed colors match the final local evidence.
- Mobile viewport **390 × 844**: verified date and expanded name modes, search match/no-match/clear, crop-cycle/category/month filters, and activity details. Document width stays 390 px. Material amount/cost remain readable; long native-select month text is shortened within the control and available in the selector.
- Farm overview inspected at both sizes. Mobile cards stack correctly; page has no horizontal overflow.
- Reload on the canonical origin retains `workspace.css?v=20261128light1` and the new page background. Browser console reported zero errors during final inspection.
- Crop-cycle overview now shows the actual partial work (`ทำบางส่วน 1 งาน`) and the existing 50-baht cost. Material history still has one 1-kg / 50-baht source record after filtering, expanding, opening details and reloading.
- The worksheet project still shows 33 recorded activities with 7 awaiting data review. No task/edit/completion, missing-data, stock or sale form was submitted. No PDF saved and no fields were inferred. This release check is read-only UI acceptance, not a new whole-account API equality audit.

## Evidence

- [Desktop date mode](live-desktop-dates.jpg)
- [Desktop expanded name summary](live-desktop-summary.jpg)
- [Mobile date mode](live-mobile-dates.jpg)
- [Mobile expanded name summary](live-mobile-summary.jpg)
- [Mobile activity detail](live-mobile-detail.jpg)
- [Crop-cycle overview](live-cycle-desktop.jpg)
- `live-styles.json`: sampled computed styles on the canonical site.

Committed screenshots contain only isolated synthetic QA plot/activity details. Full overview screenshots, raw release inventories/logs, and asset hash results remain under ignored `tmp/light-release-20261128/`; no credentials or source-derived account snapshots are committed.

## Blocked / Risks

No blocker for the requested deploy or light-mode acceptance. Mobile testing used responsive browser emulation, not a physical phone. Git integration PR remains draft for review; protected branches are unchanged. DATA_ONLY / SAFE_OFF retained. No hardware action, secret/config expansion, schema migration or field-data entry.
