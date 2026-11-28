# Approved production release — 2026-11-27

- Owner: Codex for Folk; SUCHA retains shared integration review.
- Branch: local `codex/sales-payment-slips`; published feature `folk/sales-payment-slips`.
- Task / Scope: Deploy the latest projects/trials and sales payment-slip runtime to the user's confirmed `farmultimate-solutions.pages.dev` site, its existing backend, and the same-origin API service binding.
- Files changed: `COLLAB_STATUS.md`, `qa/sales-slips/README.md` and this deployment record. Runtime source unchanged during this release.
- Commit: `845ea5bc2181bffe7b6f8b4935cdde98e3bcffb8`. Local `d5d934d` differed only in status/QA documentation; staged public source assets matched the checkout hashes.
- Validation: Local `npm run check` passed 676 tests with relay 9/9. GitHub npm-check passed on the exact deployed runtime: https://github.com/fxlk2112/kaset-poomjai/actions/runs/45735939839. Worker dry-run and Pages proxy compilation/syntax checks passed. No product code changed after these checks.
- Deployment: **DEPLOYED**, approved by the user's exact `APPROVE_PRODUCTION_DEPLOY` message in this chat on 2026-11-27, explicitly naming the site, backend and API connection.
- Blocked / Risks: Deployment is complete. Authenticated live slip upload/save/reload remains NOT_TESTED because no isolated test account exists. Draft integration PR #18 is still unmerged; `master`/`develop` were not pushed or merged. The unrelated `Workers Builds: flytechfarm` integration remains failed and was not retried or reconfigured.
- Next action: SUCHA review https://github.com/fxlk2112/kaset-poomjai/pull/18 for integration into `develop`, preserving the deployed runtime.

## Release identity

| Component | Verified release |
| --- | --- |
| Canonical site | https://farmultimate-solutions.pages.dev/ |
| Pages production deployment | `c4b571c9-e046-48df-b137-3c1d13694de4` |
| Immutable deployment URL | https://c4b571c9.farmultimate-solutions.pages.dev/ |
| Pages source revision | `845ea5b`, deployment branch label `master` |
| Backend target | Existing Worker `farmbackup` |
| Worker version | `f493a6ec-71bc-4dbf-8dfc-36a8df6e0423` |
| Pages service binding | `FARMULTIMATE_API` to `farmbackup`, production |
| Service-worker cache | `farmult-v209-sales-slips` |

The Pages deployment branch label selects production; it did not push to Git `master`. Published feature source is available in draft PR #18. The other Pages project and separate `flytechfarm` Worker build were not used.

## Production checks

- Canonical page returned HTTP 200 and loaded the current project workspace asset.
- Deployed sales JavaScript contained the new `App.saleAddSlips` handler; the service-worker cache matched the release above.
- `POST /api` with the health action returned HTTP 200 and `ok:true`, `mode:SENSOR_PHASE1_READ_ONLY`, `output_control_allowed:false`.
- Private-slip action with a deliberately invalid synthetic session was rejected (HTTP 400, expired-session response); the handler was reachable through the Pages service binding.
- Public access to a synthetic `sale-private/` object path returned HTTP 403.
- Worker version readback retained D1, PHOTOS/R2 and all nine existing secret bindings. `OUTPUT_CONTROL_ENABLED` remained `false`; existing variables were preserved using `--keep-vars`.
- R2 public access was disabled and no custom domains were configured at preflight. No database migration or destructive data operation was performed.
- Desktop browser readback at 1280 x 720 showed the deployed farm dashboard, project/trial navigation, task-completion circles, and the sales form's optional three-image slip uploader. The empty form was closed with its X control without saving. No browser console errors were observed; the page subsequently displayed its synchronized status.
- Full production form screenshot is retained locally at ignored `tmp/sales-release/production-sales-form.jpg`; it is deliberately not committed because the surrounding authenticated UI contains account context. Existing committed desktop/mobile screenshots use synthetic records only.

## Limits and safety

The production checks verify release identity, browser rendering, API reachability, bindings and unauthenticated access rejection. They do not certify every authenticated production workflow. Actual upload/save/reload and accounting tests passed locally using the shipped handlers with synthetic storage; no test sale, payment or stock change was submitted to production.

`DATA_ONLY / SAFE_OFF` remains in effect. No actuator command, Pi connection, interlock change or telemetry commissioning occurred. No credentials or private endpoints are recorded in this handoff. The existing minute cron schedule was retained.

Prepared deployment configuration and compiled artifacts remain in ignored `tmp/sales-release/`; no external backend fallback was added to the frontend.
