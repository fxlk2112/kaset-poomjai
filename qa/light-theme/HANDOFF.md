# Light-theme surface review — 2026-11-28

- Owner: Codex for Folk; SUCHA retains shared-shell integration review.
- Branch: `codex/light-theme-surfaces`, based on `2be003c`.
- Task / Scope: Improve light-theme separation using the user's material-history screenshots and the existing green design. Scoped visual changes only.
- Files changed: `css/workspace.css`, `css/plot-materials.css`, `index.html`, `sw.js`, `COLLAB_STATUS.md`, and synthetic evidence in `qa/light-theme/`.
- Commit: The commit containing this handoff; resolve with `git log -1 -- qa/light-theme/HANDOFF.md`.
- Deployment: NOT_DEPLOYED. No push, production access, PDF export, or backend/data mutation in this task.

## Findings and implemented fixes

1. **Medium — weak surface hierarchy.** The outer panel and inner activity cards both rendered white with nearly white borders. Changed the owner workspace page to pale green-gray, strengthened shared card/divider tokens, and used pale green activity headers, table headings, and totals. The first user screenshot includes a modal overlay; that dimming was not reproduced as a theme.
2. **Medium — faint control boundaries.** Search and selects used the same decorative card border. In the material view, control borders now have a measured 3.34:1 contrast against white, up from 1.27:1. Selected view buttons also have a green inset border and bold text.
3. **Low — table headings blend into rows.** Added a darker green-gray heading fill and stronger heading text. Measured text contrast increased from 4.48:1 to 6.21:1. Shared muted text was darkened to remain readable on the new page background.

These measurements cover sampled rendered colors, not a full accessibility certification.

## Validation

- `npm run check`: 824 tests passed, 0 failed; relay validation passed for 9 messages. Repeated after the final muted-text adjustment.
- `git diff --check`: passed.
- Local browser checks: 1440 × 1000 desktop and 390 × 844 mobile viewport. Date mode, summary expansion, search/clear, crop-cycle/category selection, and activity details remained usable.
- Mobile document width equals viewport width (390 px); no horizontal overflow in the inspected material view.
- Representative farm overview and project-list screenshots checked for shared-token regressions.
- Sampled dark-mode backgrounds, borders, and text colors remained identical to baseline. Material-specific additions apply only outside dark mode.
- Read-only persisted synthetic data reconciliation: plot cost = cycle cost = project cost = 50 baht; stock = 9 kg; one source material task. Seven incomplete synthetic records and attachment dates unchanged. Existing idempotency/stock regressions passed as part of the full check suite.
- Real farm accounts and the seven real incomplete entries were not accessed or changed.

## Evidence

- `before-desktop.jpg`: original material view.
- `after-desktop.jpg`, `after-mobile-dates.jpg`: final CSS, including darker muted text.
- `after-summary.jpg`, `after-mobile-summary.jpg`, `after-mobile-detail.jpg`, `overview-desktop.jpg`, `projects-desktop.jpg`: interaction and visual checks before the final muted-token-only darkening.
- `after-dark.jpg`: dark-mode visual check; subsequent muted-token adjustment is overridden by the unchanged dark-mode token.
- `styles-before.json`, `styles-after.json`: sampled browser-computed colors. After file contains final light colors and verified unchanged dark colors.
- `data-validation.json`: persisted synthetic cost/stock reconciliation result.

Full-page evidence can position sticky headers/navigation within the captured page; final date-view evidence uses ordinary viewport captures.

## Blocked / Risks

No blocker. Mobile validation uses viewport emulation rather than a physical device. This is a scoped visual review, not an audit of every application screen. Shared light tokens affect owner views using these tokens; public and collector layouts retain their own styles. DATA_ONLY / SAFE_OFF and hardware behavior unchanged.

## Next action

Review the light-theme screenshots before authorizing any production release.
