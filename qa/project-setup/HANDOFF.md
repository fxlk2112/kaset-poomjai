# Project setup handoff

- Owner: Codex for Folk; SUCHA retains integration review.
- Branch: `codex/project-setup-release-checks`, based on `41b4ad4` with
  `origin/develop` verified as an ancestor.
- Task / Scope: Unified experiment preparation and review, dark project surfaces,
  and isolated backend workflow validation.
- Files changed: `js/project-experiment-setup.js`, `js/project-planner.js`,
  `js/project-records.js`, `css/project-workspace.css`, `index.html`, `sw.js`,
  `tests/project-workspace.test.cjs`, `COLLAB_STATUS.md`, and `qa/project-setup/`.
- Commit: Feature commit containing this handoff on the branch above.
- Validation: `npm run check` 733/733; relay 9/9; `git diff --check` clean.
  Desktop/mobile screenshots and browser readback recorded. Actual shipped
  Pages/Worker handlers stored and reloaded synthetic records/photos; another
  browser retrieved them. Word downloaded and content verified. See `README.md`.
- Blocked / Risks: PDF file verification remains incomplete because the available
  UI tools could not control the print window. No live Cloudflare acceptance test.
  Structure changes are intentionally restricted after evidence, saved drafts,
  shared links or advanced legacy layouts; existing group names remain editable.
  The preparation editor supports equal sample counts per group.
- Safety impact: No accounting ledger or stock writes added; existing accounting
  regressions pass. DATA_ONLY / SAFE_OFF, Pi sole-writer and same-origin API unchanged.
- Deployment: NOT_DEPLOYED. No push or production change in this task.
- Next action: Verify a saved PDF from the tested report before release review.
