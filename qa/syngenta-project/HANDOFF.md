# Handoff

- Owner: Codex for Folk; SUCHA integration review.
- Branch: `codex/syngenta-project-audit`
- Task / Scope: Populate a source-derived farm-care project in isolated local QA, attach labelled sample images and audit data entry, accounting and reporting.
- Files changed: `COLLAB_STATUS.md`, `qa/syngenta-project/.gitignore`, `qa/syngenta-project/serve-backend.mjs`, `qa/syngenta-project/README.md`, this handoff. Private input/output artifacts are ignored and excluded.
- Commit: The scoped audit commit containing this handoff; product source baseline `2d515c4`.
- Validation: `npm run check` 733/733; relay 9/9. Browser desktop/mobile readback and screenshots; canonical ledger reconciliation; missing-material guard; report caption/version/Word checks. Detailed evidence and limitations in README.
- Blocked / Risks: Confirmed P1 income loss when an imported non-harvest income record is saved unchanged. QA amount restored; product not fixed. Additional reporting, status, template and contrast findings documented. File-picker flow and saved PDF unverified. This is local adapter testing, not a Cloudflare production pass.
- Deployment: NOT_DEPLOYED. DATA_ONLY / SAFE_OFF unchanged; no production, secrets, LAN or hardware changes.
- Next action: Fix preservation and entry of non-harvest income before release review.
