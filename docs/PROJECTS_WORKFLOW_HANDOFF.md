# Projects and experiments — corrected workflow handoff

- **Owner:** Codex for Folk; shared-shell integration owner SUCHA. Task lock `PROJECTS-TRIALS-20261124`.
- **Branch:** `codex/projects-trials-v1`; suitable existing isolated checkout, `origin/develop` baseline present.
- **Task / Scope:** Correct the current FARMULTIMATE app against the selected project draft, inline measurement, booklet and mobile activity designs. Brief → editable stages/tasks → project code/sample setup → measurements/photos/documents → editable versioned booklet. Preserve canonical crop-cycle material, stock and cost behavior; no KPI scoring.
- **Files changed:** `js/project-workspace.js`, new `js/project-planner.js`, `js/project-records.js`, `js/project-report.js`, `js/project-docx.js`; project ordering in `js/projects.js`; mobile activity flow in `js/task-wizard.js`; scoped styles in `css/project-workspace.css`; crop cost/kg in `js/cycle-notebook.js`; rescheduling history in `js/app.js`; shell class/breadcrumb wiring in `js/workspace.js`; asset wiring/cache in `index.html`, `sw.js`; `tests/project-workspace.test.cjs`, `tests/cycle-notebook.test.cjs`, `tests/interior.test.cjs`; `COLLAB_STATUS.md`, `design-qa.md`, this handoff and `qa/projects-workflow/`. Prior audit artifacts are preserved.
- **Commit:** UNCOMMITTED local working changes on original HEAD `c4d8798`. No push or merge performed.
- **Validation:** `npm run check` 636/636, relay 9/9, new module syntax and diff whitespace checks pass. Desktop 1717 × 916 and 1674 × 940, mobile 390 × 844 inspected through actual browser interactions. Word package validated; native print preview 9 pages. CSV upload/download bytes match. See `qa/projects-workflow/validation.md` and `design-qa.md`.
- **Blocked / Risks:** No local implementation blocker. Real-account sync, actual camera, disconnected-network reconciliation, Office rendering and production readiness are outside the exercised preview. Brief drafting uses local templates. Documents are capped at 2 MB per file / 10 files / 4 MB total; browser capacity can be lower when photos and report versions already occupy storage. Saved report versions are snapshots and consume storage. Existing records and previous QA artifacts were retained.
- **Deployment:** **NOT_DEPLOYED**. Local preview at `http://127.0.0.1:4178/?projectPreview=1&build=20261125workflow5`. No credentials/config writes, migrations, hardware control, LAN exposure or production API calls. DATA_ONLY, SAFE_OFF and same-origin API contract preserved.
- **Next action:** SUCHA reviews the local change set and browser evidence for integration into `develop`.

## What changed from the earlier audited implementation

| Earlier gap | Corrected behavior |
|---|---|
| Generic template ignored four-week wording and assigned today's date | Generates week 1–4 and height/leaves fields; leaves unknown dates blank and derives dates from an explicit start |
| Separate modal for one measurement | Inline desktop table with four plants and multiple metrics; mobile records one plant at a time |
| No measurement draft / incomplete revision context | Account-local automatic drafts, stale-edit guard, values/photo/caption/actor/time history |
| Report omitted completion evidence and could sweep in unrelated history | Includes task completion notes/photos; unlinked historic results require explicit inclusion; result date scope is visible |
| Plain report with no book editing or Word | Chapter order/text/photo choices, paper preview, immutable versions, Word and browser print/PDF path |
| Mobile activity used three input steps | Compact input plus review, retaining the existing stock and costing contract |
| Documents and cost/kg missing | Project document store/download/appendix; cost/kg when harvested weight is known |

Data in the preview is synthetic. PRJ-2569-002 demonstrates the complete trial flow; PRJ-2569-003 demonstrates an ordinary project. Original-document files are listed in the booklet and downloaded separately, not embedded as executable Office objects.
