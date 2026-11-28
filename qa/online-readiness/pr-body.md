## Problem and resulting behavior

Farm work, project tasks, experimental measurements and crop-cycle costs need to stay connected in the current FARMULTIMATE interface. This change provides an editable project/task draft, ordinary projects without experiments, measurement/photo/document records and versioned project booklets with DOCX export. Recording material use recommends projects for the selected plot/cycle and reuses the same activity for history, stock and costs.

Plot/cycle history separates planned work from recorded outcomes and groups by date. Completion circles work across home, activities, project tasks, plot/cycle history, calendars, central work and notifications. Material completion requires review of actual quantity and cost before saving.

The readiness audit also fixes photo upload/read/delete paths through the same-origin Pages `/api/photo/` route. Five integration tests exercise shipped client, Pages and Worker handlers with in-memory SQLite/R2.

## Scope and ownership

- Owner: Codex for Folk; lock `PROJECTS-TRIALS-20261124`. SUCHA retains shared-shell/contracts integration review.
- Local branch: `codex/projects-trials-v1`; publication: `folk/projects-trials-v1`; target: **develop**.
- Latest feature commit: `b132c6114d03756b8c940c30fd69322e04cbcf24`.
- This is a complete integration proposal: **260 files**, including **14 existing commits beyond develop** before this follow-up (newer UI source `3f8d208`, reconciliation, projects and crop notebook). It is not limited to the final circle-control or photo fix. Review the inherited current-app baseline as part of integration.
- Latest scoped commit changes 116 files: project/activity/notebook modules, styles and wiring, regression tests, synthetic QA evidence and handoffs.

## Validation and screenshots

- `npm run check`: **669 passed, 0 failed**; relay **9/9**.
- `git diff --cached --check`: passed before commit.
- Existing desktop/mobile browser interaction and screenshot/readback evidence covers the UI changes. This readiness follow-up changes no layout.
- Two isolated clients verify project/results/photos/report/cost round-trip, no duplicate stock/cost, stale-edit rejection, offline retry, unavailable binding, oversized-state retention and same-origin photo authorization.
- Pending text files were checked for high-confidence credential patterns without printing values; no matches. QA records are synthetic.
- [Activity desktop](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/all-task-circles/activities-desktop.jpg), [activity mobile](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/all-task-circles/activities-mobile.jpg), [calendar mobile](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/all-task-circles/calendar-mobile.jpg).
- [Measurement desktop](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/projects-workflow/02-record-desktop.jpg), [measurement mobile](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/projects-workflow/04-record-mobile.jpg), [project booklet](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/projects-workflow/03-booklet-desktop.jpg).
- [Circle UI validation](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/all-task-circles/validation.md), [cost reconciliation](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/qa/linked-cost-audit/validation.md), [online readiness and staging plan](https://github.com/fxlk2112/kaset-poomjai/blob/b132c6114d03756b8c940c30fd69322e04cbcf24/docs/PROJECTS_ONLINE_READINESS.md).

## Publication checks

- GitHub Actions npm-check passed: https://github.com/fxlk2112/kaset-poomjai/actions/runs/45576707306.
- The separate existing `Workers Builds: flytechfarm` integration triggered on this feature push and failed: https://github.com/fxlk2112/kaset-poomjai/runs/139076740841. Its check output does not include a failure reason. Further pushes are paused pending inspection of that integration. No successful deployment has been observed.

## Safety, deployment and remaining gates

**Deployment: NOT_DEPLOYED.** No master push, merge, production release, secret/config write or hardware action. Preserve `DATA_ONLY / SAFE_OFF`, Pi 5 sole writer, same-origin `/api` and fail-closed binding behavior.

The user has no separate staging website or test account. **Live Cloudflare / two-device synchronization is NOT_TESTED**; the integration checks use local in-memory storage adapters. Loopback `projectPreview=1` disables authenticated sync.

The existing account-state limit is about **0.9 MB**; inline evidence/report snapshots can exceed it. Tests verify local changes and the previous cloud version survive rejection; automatic attachment offloading is not implemented. Unsubmitted drafts remain device-local.

Next action: authorize/provision the dedicated staging setup in the readiness document, then perform its live two-device acceptance walkthrough before release.
