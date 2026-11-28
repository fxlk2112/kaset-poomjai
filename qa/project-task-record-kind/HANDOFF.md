# Task-specific record forms — 2026-11-27

- Owner: Codex for Folk, follow-up to the approved project workflow; SUCHA retains integration review.
- Branch: `codex/project-task-record-kind`, based on `23e9bf1`; fetched `origin/develop` verified as an ancestor before work.
- Task / Scope: Correct the experimental-project workspace that showed plant measurements for preparation and report tasks. Choose work/evidence or measurement recording per task.
- Files changed: `js/project-workspace.js`, `js/project-records.js`, `css/project-workspace.css`, `index.html`, `sw.js`, `tests/project-workspace.test.cjs`, `tests/project-sync-integration.test.cjs`, `COLLAB_STATUS.md`, and this synthetic QA folder.
- Commit: The fix commit containing this handoff on the branch above.
- Validation: `npm run check` **721 passed, 0 failed**; relay validation 9 messages; `git diff --check` passed. Desktop/mobile browser evidence below.
- Blocked / Risks: No local blockers. New custom task names default to work recording unless recognized as a measurement template or already associated with observations; users can explicitly select the recording type. Production/cloud synchronization was not exercised in this isolated preview.
- Deployment: NOT_DEPLOYED. No push, API/schema change, production data write or hardware action. DATA_ONLY / SAFE_OFF preserved.
- Next action: Review the corrected task forms in the local preview.

## Cause and correction

The renderer previously checked only whether the project had an experiment. Every task then received the same measurement grid, including objective confirmation and report preparation.

Generated experimental tasks now store an explicit `recordKind`. Legacy preparation/summary templates open the existing work/evidence form; baseline and follow-up measurement templates open measurement entry. Custom legacy tasks with saved observations remain accessible as measurement tasks. A per-task selector handles user-defined tasks and preserves all prior records. Switching form type changes only task metadata; it does not remove observations, photos, report editions, costs or stock movements. Existing measurements on legacy preparation tasks are retained with an explanatory notice and can be reopened through the selector.

Work recording uses the existing canonical completion form with notes/photos. Measurement commits reject work tasks, preventing accidental submission through the measurement action. Material completion continues through the existing quantity/cost review flow. There is no additional cost ledger.

## Browser verification

The GET-only loopback preview on port 4187 uses `fixture.cjs`, with synthetic legacy tasks intentionally lacking `recordKind`. It is isolated from the user's existing port 4186 preview and rejects API access.

- Opened objective confirmation: work/evidence form, no plant-value inputs. Completed it with a synthetic note and no photo; progress became 1/7 and the note appeared in the task.
- Group/sample setup and report-summary tasks also opened the work form.
- Baseline task opened 20 samples and two measurements. Saved A-01 height 12 cm / leaf width 3 cm; confirmation did not change task completion.
- Switched that task to work, observed the retained-data notice, then switched back: values remained 12 / 3. Reloaded and reopened: values still present.
- Report cost section after work/measurement writes showed **0 baht**, with no confirmed costs.
- Mobile 390 x 844: task selector and recording-type selector usable; work form and individual-sample inputs accessible. Document scrollWidth equals viewport width (390) in both modes. Final observed browser error log empty.
- Automated regression checks cover generated weekly tasks, legacy/custom classification, work-versus-measurement rendering, invalid measurement submission, data/report/cost preservation on switching, explicit type after renaming and the closed-project guard.

## Evidence

- `desktop-plan.png`: preparation task with work/evidence actions at 1560 x 1000.
- `desktop-measurement.png`: baseline measurement task at 1560 x 1000.
- `mobile-plan.png`: completed objective-confirmation task at 390 x 844.
- `mobile-measurement.png`: mobile measurement task context and mode selector.
- `mobile-measurement-fields.png`: saved A-01 values, observations and photo controls at 390 x 844.

To reproduce the isolated preview: `node qa/project-task-record-kind/serve-audit.mjs`, then open `http://127.0.0.1:4187/?projectPreview=1`. Logs are ignored. All fixture data and screenshots are synthetic.
