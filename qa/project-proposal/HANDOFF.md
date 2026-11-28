# Project proposal workflow — 2026-11-27

- Owner: Codex for Folk, requested in this chat; SUCHA retains shared-shell integration review.
- Branch: `codex/project-proposal-workflow`, based on `d3c9369`; fetched `origin/develop` was verified as an ancestor before work.
- Task / Scope: Implement the five approved project screens in the existing FARMULTIMATE app: proposal, stage/task review, ordinary project workspace, material work entry, and editable report. Projects do not require an experiment.
- Files changed: `js/project-proposal.js`, `js/project-work-entry.js`, `js/project-report-editor.js`, `css/project-proposal.css`; scoped hooks in `js/app.js`, `js/project-workspace.js`, `js/project-report.js`, `js/project-docx.js`; `index.html`, `sw.js`; `tests/project-proposal.test.cjs`, `tests/task-wizard.test.cjs`; `COLLAB_STATUS.md`, `design-qa.md`, and `qa/project-proposal/` evidence.
- Commit: The feature commit containing this handoff on the branch above.
- Deployment: NOT_DEPLOYED. No push, production API write, migration, credential/config change or hardware action.
- Next action: Review the local workflow at <http://127.0.0.1:4186/?projectPreview=1>.

## Result

The proposal stores its objective, scope, dates, owner, budget and supporting sections. Users review editable stages/tasks before any canonical activities are created. Planned time is optional and remains absent unless entered. Ordinary projects show current work, actual costs/photos and a live report.

Material entry reuses the existing activity form, cost calculator, stock selection, validator and submit transaction. It requires material identity, units and positive quantity for fertilizer/spray work. Save draft and cancel do not post costs. Actual notes/photos are kept separate from the original plan. Existing completed activities, experiments and tasks with prior stock movements keep the established editor and adjustment checks.

The report reads canonical activities; it does not add a project-cost ledger. Narrative edits, image selection/order and captions affect the report only. Saving an edition freezes its data. Word export downloads a DOCX; PDF uses the browser print/save-to-PDF flow.

## Validation

- Latest `npm run check`: **716 passed, 0 failed**, relay validation 9 messages. Syntax checks of new modules and `git diff --check` passed.
- Added 13 focused tests: proposal validation/storage rollback, optional time, ordinary projects without experiments, source-cost reconciliation, snapshots, photo configuration, exports and positive actual quantities.
- Browser: desktop proposal 1717 × 916, task review 1586 × 992, workspace/entry/report 1560 × 1000; responsive viewport 390 × 844. No horizontal overflow in the inspected mobile routes. Final observed browser error log: empty.
- UI workflow: brief → proposal → selected plot/cycle → review → create → material/labor/photos → explicit review/confirmation → report; reopen draft, edit narrative/captions, reorder/exclude photos, save edition, edit current draft, reopen unchanged saved edition.
- Synthetic A: 3/6 completed, fertilizer 8 kg × 75 = 600, labor 200, total **800**. Plot/cycle/project all showed 800; material history showed one use/600 material cost. Stock moved 50 → 42 kg once. Return to plan and recomplete kept stock at 42 kg and actual cost at 800.
- Synthetic B: 8 kg + 200 labor + two draft photos, preview 800; changing to 9 kg showed 875 and corresponding stock preview. Cancel and save draft retained **0 actual project cost**. This project was not confirmed.
- Actual Word download inspected: valid ZIP/DOCX structure, 2 embedded images, expected captions/narrative and 800 total. Browser PDF print preview inspected at 8 pages, then canceled; no physical print or saved PDF was produced.
- Visual review and before/after findings: root `design-qa.md`; full reference/capture pairs and focused comparisons in this folder.

## Blocked / Risks / Limits

- No local blockers. Production/cloud synchronization was not exercised: this isolated loopback preview uses synthetic local data and rejects API access. Existing application persistence/API contracts are reused.
- Draft suggestions and report summaries are local templates and calculations, not a connected generative-AI service. Users review all prose. Missing dates, owner and results stay unspecified.
- Manually edited narrative stays as written when source activities change; current tables/totals still refresh. Use “ร่างจากข้อมูลล่าสุด” to deliberately replace the work narrative. Saved editions remain immutable.
- Long reports scroll; PDF pagination follows the browser. DOCX content/embedded images were checked, but rendering in Microsoft Word was not visually inspected.
- Changing the project proposal's plot/cycle does not silently move already recorded activities; the UI says so. Closed-project mutation remains blocked by the existing status guard.
- Existing brand/Sarabun/Lucide and canonical photo controls are retained. QA images are repository sample images, not field evidence.

## Local preview

Run `node qa/project-proposal/serve-audit.mjs` if the existing listener has stopped. It is GET-only on `127.0.0.1:4186`; it keeps the older 4185 preview and production data separate. The source fixture contains only synthetic records. Runtime logs are ignored.
