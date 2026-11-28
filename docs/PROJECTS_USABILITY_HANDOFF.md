# Ordinary projects usability handoff

- **Owner:** Codex for Folk; shared-shell integration owner SUCHA. Existing task lock `PROJECTS-TRIALS-20261124`.
- **Branch:** `codex/projects-trials-v1`; existing isolated checkout; `origin/develop` baseline present.
- **Task / Scope:** Make a project a topic for work on a plot, with optional experiments. Short creation, editable ordinary task suggestions, direct work records, context inherited from crop cycle, ordinary booklet and correct undated-task status.
- **Files changed:** This follow-up updates `js/project-workspace.js`, `js/project-planner.js`, `js/project-records.js`, `js/project-report.js`, `js/project-docx.js`, `js/projects.js`, `js/cycle-notebook.js`, `js/data.js`, `js/app.js`, `css/project-workspace.css`, `index.html`, `sw.js`, `tests/project-workspace.test.cjs`, `COLLAB_STATUS.md`, `design-qa.md`, this handoff and `qa/project-usability/`. All prior working changes and QA evidence remain intact; several modules are still untracked from the preceding implementation.
- **Commit:** UNCOMMITTED on original HEAD `c4d8798`. No commit, push, merge or rebase in this follow-up.
- **Validation:** `npm run check`: 643 passed, 0 failed; relay 9/9. Desktop 1440 × 940 and mobile 390 × 844 actual browser walkthrough and saved screenshots. Ordinary project created, task completed, note read back in booklet; experimental table/photo controls retained. Browser error log empty. Details: `qa/project-usability/audit.md`.
- **Blocked / Risks:** No local implementation blocker. Suggestion engine is template-based. Participant usability, complete accessibility, real-account sync, actual camera, disconnected reconciliation and Office rendering remain untested. Earlier trial draft preserved. No stored-project bulk conversion performed; ordinary behavior derives from explicit kind and actual trial links. Asset build is `20261125workflow6`, cache `farmult-v201-general-projects`.
- **Deployment:** **NOT_DEPLOYED**. Preview: `http://127.0.0.1:4178/?projectPreview=1&build=20261125workflow6`. No production, hardware, configuration, secret, LAN or cloud-data changes. DATA_ONLY, SAFE_OFF and same-origin API contract preserved.
- **Next action:** Review PRJ-2569-004 in the local preview with the user before SUCHA integrates the change set into `develop`.

## Updated interaction model

1. Name the project; plot/cycle are optional and prefilled when entering from a crop cycle.
2. Add one task or ask the existing helper for an editable draft. No experimental setup is required for ordinary tasks.
3. Record work, photos and costs through canonical task controls. Unknown due dates stay blank without false overdue warnings.
4. Use project information to add an experiment only when needed. Existing trials retain the measurement/photo workflow.
5. The booklet gathers actual records; normal projects omit experimental chapters.

PRJ-2569-004 is synthetic QA data. It has one completed grass-cutting task and one planned fertilizer task; it has no trial. PRJ-2569-002 remains the earlier experimental example.
