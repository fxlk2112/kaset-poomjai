# Farm overview handoff — 2026-11-27

- **Owner:** Codex for Folk, explicitly requested in this chat. SUCHA retains integration review.
- **Branch:** `codex/farm-overview-refresh`; based on existing `9577530` with refreshed `origin/develop` verified as an ancestor.
- **Task / Scope:** Approved desktop/mobile farm overview using existing activities, projects, cycles, material review and accounting. Includes date navigation, overdue work, today/done/upcoming lists, ordinary and experimental project progress, collapsible farm finances, contextual save status.
- **Files changed:** `js/farm-overview.js`, `css/farm-overview.css`, five notification/tracking lines in `js/app.js`, scoped financial-description/sync placement in `js/workspace-flows.js`, asset loading in `index.html`, shell cache in `sw.js`, seven behavior tests in `tests/farm-overview.test.cjs`, synthetic QA and screenshots in this directory, root `design-qa.md`, `COLLAB_STATUS.md`.
- **Commit:** HEAD of `codex/farm-overview-refresh` (the feature commit containing this handoff; `git log -1 --format=%h -- js/farm-overview.js`).
- **Validation:** `npm run check` 694/694, relay 9/9; JS syntax and `git diff --check` passed. Browser screenshots/readback at desktop 1717/1440/1024 px and mobile 390/360 px; dark mode; no console errors. Root design QA passed after fixes and visual recapture.
- **Accounting evidence:** 25 kg actual fertilizer = 325 baht. One canonical task in plot history, cycle and project. Each scoped total 200 → 525; farm total 300 → 625. Stock 19 unopened bags + 25 kg open after consuming half a 50 kg bag from 20 bags. Cancel, repeated rendering, project navigation and reload do not add costs. Completed circles cannot be submitted again.
- **Blocked / Risks:** No implementation blocker. Live authenticated cloud save/acknowledgement untested because there is no separate test account; receipt status logic tested with pending/offline/error/synced states. Existing dated data and ordinary projects are preserved. No migration, new backend endpoint, financial ledger, control command, credential or secret change. Previous material-history commits remain included and local.
- **Deployment:** **NOT_DEPLOYED**. No push/merge into `develop` or `master`; no production release in this task. DATA_ONLY / SAFE_OFF and same-origin API behavior retained.
- **Preview:** `http://127.0.0.1:4185/?projectPreview=1`; launch with `node qa/farm-overview/serve-audit.mjs`. Synthetic-only local storage, loopback-only GET server, `/api` rejected. The old 4182 preview and its data remain untouched.
- **Next action:** Review the local overview in the preview.

See [design QA](../../design-qa.md) for comparison images, resolved findings and coverage limits. No production data was edited during QA.
