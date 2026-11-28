# Four High audit fixes — local acceptance

- Owner: Codex for Folk; explicit user request covers these cross-module findings. SUCHA retains integration ownership.
- Branch: `codex/high-integrity-fixes`; source `fed1456`. Refreshed `origin/develop` verified as ancestor before implementation.
- Task / Scope: document sync size, actual costs/stock after unsuccessful work, unknown chemical quantities, deterministic same-origin release assembly.
- Files changed: `js/auth.js`, `js/project-records.js`, `worker/src/project-files.js`, `worker/src/lark.js`; canonical task finance/stock in `js/data.js` and dependent app/notebook/material/project/report renderers; `scripts/build-pages.mjs`, `scripts/check-api-health.mjs`, `.github/workflows/deploy.yml`, `deploy.ps1`, same-origin documentation, asset/cache versions, regression tests, synthetic QA harness/screenshots and collaboration status.
- Commit: The feature commit containing this handoff (`git log -1 --format=%h -- qa/high-integrity/HANDOFF.md`).
- Deployment: **NOT_DEPLOYED**. No push, protected-branch update, cloud configuration, production data, or hardware action. DATA_ONLY / SAFE_OFF retained.
- Next action: SUCHA reviews this local branch for integration into `develop`.

## Result

| Finding | Implemented behavior | Verification |
|---|---|---|
| H1: inline documents exceed the account sync limit | Store documents as authenticated, content-addressed private objects; sync references. Migrate inline documents in both live attachments and frozen report editions. Keep original local bytes on upload or local persistence failure. | 700 KiB document across two simulated devices, exact byte download, 2 MiB limit, wrong owner/session rejection, public-route denial, retries, concurrent edit and local quota failure. Saved edition retains its document after removal from the live project. |
| H2: unsuccessful outcome removes actual costs/consumption | Separate execution (`none`, `partial`, `full`) from work outcome. Require actual quantity/cost review for partial/unsuccessful records. Reuse the canonical task and stock transaction. | Status changes, reviewed quantity correction, repeat save and reload reconcile plot, crop cycle, project, annual totals and report. Legacy failed records are not guessed or automatically converted. |
| H3: unknown material quantity appears as zero | Keep unknown quantity as null; show “ยังไม่ทราบปริมาณ”. Mixed known/unknown totals disclose missing entries; units remain separate. | Automated unknown/zero/mixed-unit tests and browser analytics readback. Source quantities are unchanged. |
| H4: release relies on implicit API assembly | Build one verified Pages artifact containing static assets, explicit API worker and routes; verify missing binding fails closed. API health/capability gates run before/after future release. | Real artifact assembled in a temporary directory; same-origin forwarding, static fallback, required backend capability and refusal to overwrite an existing build directory tested. Workflow was not executed. |

## Validation

- `npm run check`: **820 PASS, 0 FAIL**; `RELAY_VALIDATION_OK messages=9`.
- `git diff --check`: PASS.
- Browser: Edge, local loopback harness using shipped Pages/Worker handlers with SQLite/R2 adapters; desktop layout and **390 × 844** mobile viewport. Temporary viewport reset after testing.
- UI flow: planned fertilizer task → partial work → missing quantity blocked → enter **1 kg** → review **50 baht** → confirm → edit/save again → reload. Stock remained **9 kg from 10 kg**; plot, cycle, project, report and analytics remained **50 baht**. Only one actual task record persisted.
- Seven **synthetic** incomplete fixtures retain their original date, quantity, cost, revenue, material rows and missing-field values after local saves/reloads. The user's actual seven incomplete worksheet records were not accessed or changed; no values inferred.
- No PDFs saved. No field accounts or production data used. Local QA server stopped after acceptance; private runtime, temporary session and raw logs are ignored.

## Evidence

- [Mobile quantity/cost confirmation](mobile-review.jpg)
- [Mobile history after repeat save](mobile-result.jpg)
- [Desktop analytics showing unknown quantity](analytics-unknown.jpg)

## Blocked / Risks

- Browser file selection could not complete because the Edge extension does not allow file-URL access. Permissions were not changed. File upload/download, privacy and cross-device sync were verified through shipped-handler integration tests, not a completed browser picker flow.
- Responsive emulation is not a physical-phone test; SQLite/R2 adapters do not establish live Cloudflare readiness. Production validation remains for a separately approved release.
- Future release must deploy the compatible backend first. The frontend gate intentionally stops when `/api` lacks `project_files_v1`; no binding/secrets were modified in this task.
- New document uploads require connectivity. Saved report editions keep referenced files; orphan-object cleanup is intentionally not introduced because deleting retained report evidence would be unsafe.

## Reproduce locally

Use Node 22.13+ (SQLite support), run `node qa/high-integrity/serve-backend.mjs`, then open the loopback URL printed by the harness. It uses only synthetic data and a temporary local session. Stop the server before running `node qa/high-integrity/add-analytics-fixture.mjs` to append the independent unknown-quantity analytics fixture; the seven incomplete records are preserved. Do not publish this harness or its ignored `.private` directory.
