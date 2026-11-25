# Projects: integration and online readiness

Date: 2026-11-25, Asia/Bangkok. This is the current readiness record; earlier QA and handoffs describe their original local checkpoints.

## Current result

The local project workflow and application tests pass. The remaining task is a real staging deployment and a two-device walkthrough. The user confirmed on 2026-11-25 that no separate staging site or test account currently exists. **Live cloud synchronization: NOT_TESTED. Deployment: NOT_DEPLOYED.**

`projectPreview=1` on loopback intentionally disables authenticated synchronization. It is useful for UI QA but is not evidence of live cloud operation.

## New integration verification

`tests/project-sync-integration.test.cjs` runs two isolated application clients through the actual same-origin Pages Function and Worker handlers. SQLite and R2 storage are substituted with in-memory adapters; requests never reach a network service. This verifies application/handler compatibility, not deployed Cloudflare bindings.

1. A project, linked completed material activity, trial measurement, photo metadata, work note, report version and project sequence arrive intact on the second client. The cycle/project cost remains 90 baht, with one task and one stock deduction after repeated synchronization and a second-device edit.
2. Simultaneous project edits produce a conflict. The losing client's unsynced edit remains intact. A stale revision is also rejected by the Worker/SQLite write condition.
3. Offline state and an unavailable service binding keep local project changes pending. Restoring the binding permits retry.
4. Oversized project state does not replace the last cloud version or discard local evidence.
5. Evidence uploads return a URL under the same public origin at `/api/photo/`; reading and deleting that URL work through Pages. Cross-owner deletion and private-team photo access remain denied.

The photo test initially failed because uploads returned `/photo/`, outside the Pages `/api` route. The Worker now returns and accepts `/api/photo/` when invoked through `/api`, and continues accepting legacy `/photo/` requests. A hard-coded fallback backend origin was removed from photo upload responses.

Final local validation: **669 tests passed, 0 failed; relay 9/9**. Output is retained locally in `qa/online-readiness/check.log` (ignored by Git). Existing UI evidence covers desktop and mobile; no visual layout was changed during this readiness follow-up. The new checks are source/handler integration tests, not browser tests against a live backend.

## Integration scope

- Local branch: `codex/projects-trials-v1`.
- Publication branch: `folk/projects-trials-v1`, within the existing owner development approval.
- PR base: `develop`, verified at `40721b5bfa71670ea97aba0d247e5616277c018a`.
- Existing head before this follow-up: `c4d8798`.
- This checkout already includes 14 commits beyond develop, including the newer UI source `3f8d208`, the project implementation and notebook correction. The complete PR includes that baseline; it must not be described as only a small circle-button change.
- SUCHA reviews shared shell/contracts and the inherited newer baseline before integration. No automatic merge, protected-branch push or production release is part of this work.
- High-confidence credential patterns were scanned in pending text files without printing matched values; no matches. Synthetic QA records and sample CSV/JSON were reviewed. The scope manifest is `qa/online-readiness/scope-review.json`; it records the pre-publication snapshot, before this readiness document was added.

## Concrete staging setup to review

Use a dedicated non-production environment with these proposed resource names:

| Resource | Proposed staging name / binding |
|---|---|
| Pages project | `farmultimate-projects-staging` |
| Worker | `farmultimate-projects-staging-api` |
| D1 database | `farmultimate-projects-staging-db`, Worker binding `DB` |
| R2 bucket | `farmultimate-projects-staging-photos`, Worker binding `PHOTOS` |
| Pages service binding | `FARMULTIMATE_API` → staging Worker only |

Use a fresh staging database with the repository schemas required by the app. Do not copy production accounts, sessions, farm records, coordinates or credentials. Do not blindly run the optional Google ALTER migration against the fresh schema; it already contains `google_sub`. Leave optional Lark, telemetry and hardware connections unset and output control disabled.

Keep this separate from the production-only deploy workflow. Before creating resources or changing Cloudflare bindings/configuration, obtain the repository-required authorization for that concrete setup. After authorization, verify the active Cloudflare account and resource targets, apply only staging configuration, and record deployed frontend/Worker commit identifiers. No Cloudflare configuration or schema migration has been executed by this follow-up.

## Live acceptance walkthrough after staging exists

Use one disposable staging account on two separate browser profiles/devices. Use only synthetic plot/cycle/material data and a harmless sample image.

1. Read the same-origin health response and confirm `SENSOR_PHASE1_READ_ONLY` with output control disabled. Confirm `/api` uses only the staging service binding.
2. Device A creates an ordinary project and two tasks. Device B receives the same project code and task IDs.
3. A records one material activity, reviews actual quantity/cost, and links the project. B sees one history record and matching plot/cycle/project cost, with a single stock deduction.
4. A records trial measurements and a photo, then saves a report version. B opens the values, image and report; refresh both devices and verify persistence.
5. Edit a project independently on both devices. Verify an explicit conflict, preservation of local edits and a recoverable backup before choosing a side.
6. Make an offline edit, reconnect and verify exactly one saved activity. Repeat sync and confirm unchanged totals/stock.
7. Check the same pages at desktop and mobile widths, record screenshots, and attach deployed commit/revision evidence to the draft PR.

## Limits that remain visible

- The Worker currently limits a saved account snapshot to about 0.9 MB. Inline image/document evidence and multiple report snapshots can reach this limit. The test verifies that failure retains local data and the preceding cloud version; it does not remove the limit or provide automatic attachment offloading.
- Unsubmitted project/measurement drafts are account-scoped **on that device**. Confirmed project data syncs; drafts are not promised to move between devices.
- Hosting/database/storage availability, Cloudflare bindings, browser sessions and real multi-device behavior require the live staging walkthrough above.
- `DATA_ONLY / SAFE_OFF`, same-origin `/api`, existing production state and original local preview drafts remain unchanged.

## Handoff

- **Owner:** Codex for Folk, `PROJECTS-TRIALS-20261124`; SUCHA is integration owner.
- **Branch:** Local `codex/projects-trials-v1`; publication `folk/projects-trials-v1`; target `develop`.
- **Task / Scope:** Finish project workflow/circle changes, verify synchronization compatibility, fix same-origin evidence routes, package for integration review.
- **Files changed:** Existing scoped project/activity/notebook modules and CSS, asset wiring, regression tests, QA and handoffs; readiness additions are `worker/src/lark.js`, `tests/project-sync-integration.test.cjs`, this document and `qa/online-readiness/`.
- **Commit:** See the feature branch/PR for the commit containing this document; earlier uncommitted checkpoints remain historical records.
- **Validation:** 669/669 tests; relay 9/9; existing desktop/mobile UI QA; source/handler integration and credential-pattern review described above.
- **Blocked / Risks:** No live staging resources or test account yet; inherited shared baseline needs integration review; 0.9 MB snapshot limit remains.
- **Deployment:** **NOT_DEPLOYED**.
- **Next action:** Approve and provision the separate staging setup above so the real two-device acceptance walkthrough can run.
