# Linked cost audit handoff

- **Owner:** Codex for Folk under `PROJECTS-TRIALS-20261124`; SUCHA retains shared-file integration ownership.
- **Branch:** `codex/projects-trials-v1`; verified `origin/develop` base `40721b5`.
- **Task / Scope:** Audit chemical activity recording with a selected project across plot history, crop-cycle costs and project work/costs; verify editing and reload do not double-count.
- **Files changed:** New `tests/project-cost-reconciliation.test.cjs`, `qa/linked-cost-audit/` with isolated preview helper/evidence/check log, this handoff and `COLLAB_STATUS.md`. No application code change in this follow-up. All earlier working changes preserved.
- **Commit:** UNCOMMITTED on prior HEAD `c4d8798`; no push or merge.
- **Validation:** Real synthetic save of material 90 + labor 210 = 300, linked to one project. Cycle 2,465 -> 2,765; project 0 -> 300; plot/project/cycle share one activity ID. Labor edit to 260 yields project 350 and cycle 2,815. Repeated unchanged edit-save and reload preserve cost and stock. Two new accounting tests; full `npm run check` 657 passed, 0 failed, relay 9/9. Browser errors empty. Evidence in `qa/linked-cost-audit/validation.md`.
- **Blocked / Risks:** No local accounting blocker. Validation covers single-plot local state, not live cloud, simultaneous devices or new-create double-click/retry behavior. Existing unfinished drafts were preserved; testing used a separate synthetic origin. Distinct manual entries for the same real-world work are still distinct activities.
- **Deployment:** **NOT_DEPLOYED**. Product assets unchanged from the history follow-up. Temporary loopback audit server stopped; original preview retained. No hardware, production, secret or network-exposure changes.
- **Next action:** Include this reconciliation evidence in SUCHA's integration review for the existing project workflow.
