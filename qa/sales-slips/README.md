# Sales payment-slip attachments — 2026-11-26

- Owner: Codex for Folk; SUCHA retains shared integration review.
- Branch: `codex/sales-payment-slips`, based on current app `eb40888`, a descendant of integration baseline `origin/develop` (`40721b5`).
- Task / Scope: Attach payment evidence while creating or editing a product sale; open saved evidence from sale detail. Up to three JPG/PNG/WebP images, original file limit 5 MB each. Existing records require no migration. Attachments do not change payment status or totals.
- Files changed: `js/sales.js`, `js/data.js`, `css/sales-evidence.css`, `worker/src/lark.js`, `index.html`, `sw.js`, `tests/sales-payment-slips.test.cjs`, `COLLAB_STATUS.md`, and this synthetic QA directory.
- Commit: Included in the feature commit containing this handoff (parent `eb40888`); no remote push.
- Validation: `npm run check` — 676 passed, 0 failed; relay validation 9 messages passed. `git diff --check` passed. Tests cover create/edit/void without duplicate stock or cost, invalid images, storage failure and retry, stale forms/account changes, receipt/share exclusion, and the Pages-to-Worker private upload/read/save/load contract using an in-memory database and object store.
- Browser validation: Edge, isolated loopback origin on port 4181, sample account/data only. Selected `sample-slip.png` with the Windows file picker; created a 200 THB synthetic sale; opened its full-size slip; reloaded and reopened; entered edit mode; removed the slip then cancelled/discarded the edit; reopened and confirmed the original slip remained. Captured `desktop-edit.jpg` at 1440 x 940 and `mobile-edit.jpg` at 390 x 844. DOM viewport/scroll widths matched at both sizes. No browser console errors observed. Temporary viewport override reset.
- Safety impact: `sale_slip_put` and `sale_slip_get` require the owner's authenticated session. Private object keys are blocked by both public photo paths; API responses use `no-store`. Slips stay out of customer receipt print/share content. All requests use the existing same-origin API. No production data, credentials, device identifiers, field coordinates, hardware controls, secrets, or configuration changed.
- Blocked / Risks: Authenticated upload/sync against a deployed service is **NOT_TESTED**; there is no separate staging site/account. Local tests exercise the actual Pages/Worker handlers with synthetic storage, not Cloudflare infrastructure. Online image storage needs the existing PHOTOS binding and this Worker change. Small offline images remain inline in the existing account snapshot; the 900,000-character snapshot guard prevents oversized saves before stock or sales mutate. Inline images are not automatically migrated to object storage later. Removing/cancelling an uploaded slip removes its record reference only; remote objects are retained to avoid breaking existing backups. No public object-store access configuration was changed or verified. External Workers Builds failure from the previous task remains unresolved; push/deploy remains paused.
- Deployment: **NOT_DEPLOYED**.
- Next action: Folk/SUCHA review this local feature together with the pending project baseline before resuming integration.

## Reproduce locally

Run `node qa/sales-slips/serve-audit.mjs` and open `http://127.0.0.1:4181/?projectPreview=1`.
The helper reuses the existing allowlisted, loopback-only project preview with an isolated origin and starts on Sales. It rejects API requests and seeds synthetic records only when the preview slot is empty. It does not touch the user's preview on port 4178.

`sample-slip.png` is clearly marked TEST ONLY / NOT A PAYMENT and contains no bank details. Screenshots contain synthetic records only. The local `check.log` is ignored by Git.

## Publication checkpoint — 2026-11-26

- Owner: Codex for Folk; production approval remains with Pick.
- Branch: local `codex/sales-payment-slips`; published `folk/sales-payment-slips`.
- Task / Scope: User explicitly requested `gitpush deploy` after reviewing the Pages/Worker/API-binding release proposal.
- Files changed: This checkpoint and `COLLAB_STATUS.md` only; feature code is unchanged.
- Commit: Published feature `845ea5bc2181bffe7b6f8b4935cdde98e3bcffb8`; this checkpoint is local only.
- Validation: GitHub npm-check passed for the exact feature head, run https://github.com/fxlk2112/kaset-poomjai/actions/runs/45735939839. Local Worker dry-run and Pages Function compilation passed. Existing 676-test and desktop/mobile evidence remains applicable.
- Integration: Draft PR https://github.com/fxlk2112/kaset-poomjai/pull/18 targets `develop`; no merge or protected-branch push occurred. The GitHub connector returned 403 for PR creation; authenticated GitHub CLI successfully created the draft.
- Blocked / Risks: Automatic approval review rejected `wrangler deploy --config worker/wrangler.toml --keep-vars` to production because the repository-required explicit `APPROVE_PRODUCTION_DEPLOY` confirmation was missing. The command did not run. No indirect deployment was attempted. Independent `Workers Builds: flytechfarm` failed again after the feature push, separate from passing npm-check. Pages production still requires `FARMULTIMATE_API` to `farmbackup`; that configuration was prepared locally only. Authenticated live synchronization is NOT_TESTED.
- Deployment: **NOT_DEPLOYED**.
- Next action: Obtain Pick's explicit `APPROVE_PRODUCTION_DEPLOY` for feature commit `845ea5b`, the existing Pages/Worker targets, and the necessary service binding.
