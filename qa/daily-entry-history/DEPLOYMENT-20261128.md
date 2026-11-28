# Production release — 2026-11-28

- Owner: Codex for Folk, explicitly authorized in this chat; SUCHA retains integration review.
- Branch: `codex/release-daily-entry-20261128`; published source `folk/daily-entry-history`.
- Task / Scope: Release the latest farm/project frontend and verify activity entry, history and costs on the canonical production site.
- Files changed: legacy draft-title preservation in `js/task-wizard.js`, regression in `tests/task-wizard.test.cjs`, cache wiring in `index.html` / `sw.js`, `COLLAB_STATUS.md`, and this evidence. Accumulated feature source is documented in `HANDOFF.md` and preceding scoped handoffs.
- Commit: deployed runtime `2988cc90a957e6a09c8bbb3d71b557798f7caa83`, based on feature `5a24672`.
- Validation: `npm run check` **773/773 PASS**, relay **9/9 PASS**, staged source hashes and live asset hashes match, production API health and browser readback passed as detailed below.
- Deployment: **DEPLOYED** under the user's exact `APPROVE_PRODUCTION_DEPLOY` instruction on 2026-11-28, explicitly naming `farmultimate-solutions.pages.dev` and live entry/history/cost checks.
- Blocked / Risks: Deployment is complete. Opening an integration PR remains blocked; no live test records were submitted. See limits below.
- Next action: Integration owner opens/reviews the published feature branch into `develop` using normal GitHub access.

## Verified release identity

| Component | Evidence |
| --- | --- |
| Canonical production URL | https://farmultimate-solutions.pages.dev/ |
| Final Pages deployment | `8189927f-12d1-4fde-b48a-9d55e869eb8d` |
| Immutable URL | https://8189927f.farmultimate-solutions.pages.dev/ |
| Source | `2988cc9` |
| Service worker | `farmult-v222-draft-title` |
| Task wizard asset | `js/task-wizard.js?v=20261128daily2` |
| Existing binding | `FARMULTIMATE_API` to existing `farmbackup`, production |
| API health | HTTP 200, `ok:true`, `SENSOR_PHASE1_READ_ONLY`, `output_control_allowed:false` |

Pages production branch label `master` selects the existing production environment; Git `master` and `develop` were not pushed or merged. The initial `5a24672` deployment (`e74188ff-7171-4b63-9da4-90d1c1a432e4`) was superseded by the final runtime after a live draft-resume issue was fixed.

118 tracked public assets were assembled and verified against the checkout, with no unexpected files. The Pages proxy was compiled from unchanged source. Live hashes matched for index, service worker, wizard, history, data, materials, proposal, projects and history CSS. No backend redeployment or database migration was needed; backend/Pages Function source is unchanged from the previously approved `845ea5b` release.

## Production browser verification

- Authenticated canonical-site session loaded the new asset versions and displayed synchronized status.
- Opened activity entry and resumed an existing draft without submitting it. Verified continuous entry, explicit material/labor/other categories, actual quantity, missing-cost feedback, evidence attachment control, and separate review action. Incomplete draft stayed on entry; no activity or stock mutation was submitted.
- Discovered an existing stock-created draft with `autoTitle=true` whose saved product-specific title was replaced by the generic activity type on resume. Restored the original draft title via its field, fixed hydration to preserve stored text, added an actual restore-path regression for both auto-title flags, and redeployed. Final browser reload and resume retained the original title.
- Plot table displayed recorded/planned tabs, search, date/table views, material quantity, expense, evidence and direct edit controls. Search isolated an existing labor-only task; details and evidence opened successfully.
- Existing task, plot and crop-cycle totals agreed. Labor appeared under labor and did not also appear in the material summary. The cycle material view correctly showed no material charge for this labor-only record. Reload after all checks retained the same task count and cost.
- Mobile at 390×844 rendered labelled history cards and the entry form. Document width stayed 390, with no page-level horizontal overflow. Temporary viewport override was reset.
- Browser error log was empty for the final readback.

## Evidence handling and limits

Production screenshots and sanitized hash/health reports remain in ignored `tmp/daily-release-20261128/`. They are deliberately not committed to the public repository because the authenticated UI contains account/farm context. Files include `production-entry-final.jpg`, `production-history.jpg`, `production-costs.jpg`, `production-mobile-entry.jpg`, `production-mobile-history-final.jpg` and `public-readback-final.json`. Committed feature screenshots remain synthetic.

No test activity, cost, stock use, payment or uploaded photo was submitted to production. Full save/edit/reload/photo and stock-idempotence checks use the isolated synthetic backend described in `HANDOFF.md`; the live checks establish deployment identity, rendering, existing-account reads and total consistency, not a new production write certification. The existing local activity draft was preserved. No private fields, credentials or production screenshots were staged.

Source publication succeeded at `folk/daily-entry-history`. The GitHub connector returned 403 on draft PR creation; GitHub CLI's existing authentication was invalid. Automatic approval review rejected a proposed Git Credential Manager fallback as credential probing; that command did not run and no workaround was attempted. This blocks only PR creation. Existing Git integration review remains outstanding; no new PR or remote CI success is claimed. The separate historical `flytechfarm` build integration was not retried or reconfigured.

`DATA_ONLY / SAFE_OFF`, Pi sole-writer and same-origin `/api` remain intact. No hardware command, interlock change, migration, secret change, or broad production data rewrite occurred.
