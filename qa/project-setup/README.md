# Project preparation QA — 2026-11-27

Run `node qa/project-setup/serve-backend.mjs`, then open `http://127.0.0.1:4189/`.
The Node runtime must support `node:sqlite`.

This harness calls the shipped Pages Function and Worker through the same-origin
`/api` path. SQLite adapts D1 operations and stores uploaded photo bytes locally.
It does not connect to Cloudflare, production accounts, hardware or LAN services.
Only the load/save/profile/photo actions required by this test are enabled.

The session is generated on startup for a synthetic account. The QA-only bootstrap
enables the loopback API before application initialization. The persistent test
database lives in ignored `.runtime/`; logs are also ignored. Never commit either.
Restarting the server rotates the synthetic session, so reload test tabs afterward.

## Observed workflow

- Drafted an experimental project and configured two custom groups, two samples
  per group, and a height metric with units through the unified editor and review.
- Recorded heights 12.5, 13, 11 and 11.5 with a work note and a synthetic illustration.
  The existing public farm illustration was explicitly captioned as test material.
- `photo_put`, photo reads, save and load used the actual API handlers. The database
  contains the measurements, one project record, one photo object and report edition 1.
- Opened the test origin in Edge, separate from the in-app browser. The project,
  custom group labels, results and report photo loaded from the backend.
- Created a second project after API setup, synced it, and verified its appearance
  after reloading Edge. See `cross-browser-readback.txt` and `verification.json`.
- Downloaded Word through the UI. Inspected the DOCX ZIP/XML: both custom group
  names, numeric results and one embedded image are present (275,412 bytes).
- Attempted PDF in both browsers. The available UI tools could not operate the
  native print window reliably. A saved PDF file was **not verified** in this run.
  Existing export tests passed; they do not substitute for that missing file check.

## Interface evidence

- `desktop-review-light.png`: reviewed groups, sample count and metric before commit,
  1560 × 1000.
- `desktop-locked-dark.png`: after recording, structure is read-only and renaming
  groups remains available, 1560 × 1000.
- `report-dark.png`: readable project chrome and white report paper, 1560 × 1000.
- `mobile-setup-dark.png`: readable locked setup on a 390 × 844 viewport.
- `mobile-values-dark.png`: loaded measurement and note fields, 390 × 844.
  DOM readback confirmed document width equals viewport width (390 px).

## Automated checks

`npm run check`: 733 passed, 0 failed; relay validation: 9 messages.
New regression coverage includes retained sample IDs, evidence/unsent-draft locks,
shared and legacy experiment protection, validation, stale edits, closed projects
and rollback when storage fails. Existing accounting checks also passed; this
feature does not post costs or stock movements.

These are local integration results, not a live Cloudflare/D1/R2 acceptance test.
