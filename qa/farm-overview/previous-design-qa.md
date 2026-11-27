# Activity and calendar circles — current design QA

2026-11-25 (Asia/Bangkok): unified the remaining task-row surfaces: Activities, selected-day tasks in global and crop-cycle calendars, plot overview, central work and notifications. Titles open details independently from the circle. Notification rows include plot names to distinguish identically named tasks. Existing home/history/project controls were also read back in the browser.

Material completion through both circles and task-detail completion enters actual quantity/cost review. Missing-price confirmation was rejected without completing the task; cancellation retained its plan. A synthetic central task moved from pending to recorded exactly once with a disabled tick and zero cost. Desktop 1440 × 940 and mobile 390 × 844 screenshots/readback passed; 44 × 44 targets and no horizontal overflow on exercised mobile activity/calendar/notification views. Browser error log empty. `npm run check`: **664 passed, 0 failed**, relay **9/9**. [Coverage and evidence](qa/all-task-circles/validation.md), [handoff](docs/ALL_TASK_CIRCLES_HANDOFF.md). **NOT_DEPLOYED**.

---

# Farm overview circles — preceding design QA

2026-11-25 (Asia/Bangkok): extended the shared circle completion control to the overview work list shown in the user screenshot. Task names still open details; chemical/fertilizer work enters actual quantity/cost review before confirmation. Desktop 1440 × 940 and mobile 390 × 844 screenshot/readback passed, including 44 × 44 mobile targets and no horizontal overflow. Synthetic completion changed overdue count 6 -> 5; material review cancellation retained the plan. `npm run check`: **662 passed, 0 failed**, relay **9/9**. [Evidence and handoff](qa/home-circles/validation.md). **NOT_DEPLOYED**.

---

# Task completion circles — current design QA

Date: 2026-11-25 (Asia/Bangkok). Circle controls are separate from task titles in plot/crop history and project work. Completed tasks show a disabled green tick. Chemical/fertilizer completion opens actual quantity and cost review before saving through the existing canonical activity path.

Desktop 1440 × 940 and mobile 390 × 844 screenshot/readback passed. Mobile circles have 44 × 44 targets and no document overflow. Browser testing corrected the confirmation label and mobile circle visibility. A synthetic 0.2-bag completion added 130 baht exactly once to both project and cycle, consumed 10 kg once, and retained original scheduling and links. Cancel and ordinary completion also verified. [Evidence and limitations](qa/task-circles/validation.md).

`npm run check`: **662 passed, 0 failed**, relay **9/9**. Original preview drafts preserved. Deployment: **NOT_DEPLOYED**. [Handoff](docs/TASK_CIRCLES_HANDOFF.md).

---

# Plot and crop-cycle history — current design QA

Date: 2026-11-25 (Asia/Bangkok). Local browser validation passed. History now separates recorded outcomes from planned work, groups each list by its relevant date and opens full activity details from each compact row. Failed work remains visible with an explicit outcome. Planned amounts are labelled budgets; actual totals continue to use canonical completed-activity costs. Plot-wide history uses the same component with explicit crop-round labels and a round filter.

Desktop 1440 × 940 and mobile 390 × 844 browser evidence was saved and visually inspected: [recorded desktop](qa/plot-history/01-recorded-desktop.jpg), [details](qa/plot-history/02-task-detail.jpg), [planned desktop](qa/plot-history/03-planned-desktop.jpg), [recorded mobile](qa/plot-history/04-recorded-mobile.jpg), [planned mobile](qa/plot-history/05-planned-mobile.jpg), [plot round filter](qa/plot-history/06-plot-round-history.jpg). Mobile review caught action buttons squeezing planned-work text; actions now occupy a separate row. Document width equals viewport width at 390 px. Reload testing caught an early render before the notebook module was available; initial rendering is guarded and refreshed when the module loads, with a regression test. Final reload and detail navigation produced no new browser errors.

`npm run check`: **655 passed, 0 failed**, relay **9/9**. Syntax and diff whitespace checks passed. No activity changes were saved during this follow-up; existing data and unfinished drafts were preserved. Full evidence and limits: [validation](qa/plot-history/validation.md). Deployment: **NOT_DEPLOYED**.

---

# Project suggestions before saving — preceding design QA

Date: 2026-11-25 (Asia/Bangkok). Local validation passed. The activity form now places an optional project selector next to plot/cycle context, with exact cycle matches first and plot-wide projects next. Other projects remain available on demand. No project is automatically selected; changing to an incompatible plot/cycle clears the pending selection. A single-stage project needs no extra stage choice. Draft restore and editing preserve project/stage selections.

Browser evidence: [desktop/light](qa/project-suggestions/05-desktop-final.jpg), [mobile/dark](qa/project-suggestions/04-mobile-final.jpg). Both were saved and visually inspected. The dark mobile review exposed pale panels with low-contrast text; panel/scope/total colors were corrected and rechecked. Mobile page width is 390 px at a 390 px viewport. Ordinary and trial projects appear together when matched to the same cycle. A synthetic 30-baht chemical entry saved into its chosen project and increased crop-cycle cost exactly once. Existing user drafts were preserved; new-save QA used a separate localhost origin. Full evidence and limitations: [validation](qa/project-suggestions/validation.md).

`npm run check`: **648 passed, 0 failed**, relay **9/9**. Deployment: **NOT_DEPLOYED**.

---

# Ordinary projects usability — preceding design QA

final result: passed for the exercised local workflow

Date: 2026-11-25 (Asia/Bangkok). The user's clarified model is **project = a topic for work in a plot; experiments are optional**. The earlier experimental workflow review below is retained as history.

The ordinary brief “ดูแลแปลง A ใส่ปุ๋ย ตัดหญ้า และเก็บเกี่ยว” previously produced experimental setup and seven tasks. It now produces three ordinary tasks without metrics, sample groups or sample counts. A shorter path creates an empty project from its name, optionally inheriting plot/cycle. The user can add tasks one at a time and record actual work directly. Ordinary booklets omit experimental-result chapters. Undated planned tasks remain planned instead of overdue.

Actual browser walkthrough: crop notebook → short project form → empty PRJ-2569-004 → add and complete a grass-cutting task → add an undated fertilizer task → ordinary booklet with the saved work note. The existing PRJ-2569-002 experiment still shows four plants, two metrics and photo controls; its unsaved draft was not overwritten. Desktop 1440 × 940 and mobile 390 × 844 screenshots were saved and visually inspected. Mobile retains plot/cycle context, a task selector and 44 px main action buttons; document width equals viewport width (390 px).

Evidence and findings: [usability audit](qa/project-usability/audit.md). Latest `npm run check`: **643 passed, 0 failed**, relay **9/9**; browser error log empty. This is an implementation walkthrough, not participant usability testing or a complete accessibility audit. Deployment: **NOT_DEPLOYED**.

---

# Projects workflow correction — preceding design QA

final result: passed

Scope: the selected project draft, inline experiment record, booklet editor and mobile activity flow, integrated into the current FARMULTIMATE shell. This result covers local browser behavior and the visual comparisons below; it is not production or live-sync certification. The earlier notebook review is retained after this section.

## Exact references and browser evidence

Selected images in `C:/Users/USER/.codex/generated_images/01a207c1-667e-7670-86ba-5df7a70aacb0/`:

| Surface | Selected reference | Rendered browser evidence |
|---|---|---|
| Editable draft | `exec-31eb465b-9171-4c0d-9f32-729ae4da16f8.png` | `qa/projects-workflow/01-draft-desktop.jpg`, 1717 × 916 |
| Inline results | `exec-b3198cc9-75ba-45e3-a261-e15e22653e7e.png` | `qa/projects-workflow/02-record-desktop.jpg`, 1674 × 940 |
| Booklet editor | `exec-75ade1df-7510-48a8-87ea-4287dc8fa32b.png` | `qa/projects-workflow/03-booklet-desktop.jpg`, 1674 × 940 |
| Mobile results | `exec-d74acd86-bf4f-44bb-85db-886294b006be.png` | `qa/projects-workflow/04-record-mobile.jpg`, `04b-evidence-mobile.jpg`, 390 × 844 |
| Mobile activity | `exec-f1343914-c82f-4ec6-a88f-2929358344f3.png` | `qa/projects-workflow/05-activity-mobile.jpg`, `05b-materials-mobile.jpg`, `06-activity-review-mobile.jpg`, 390 × 844 |
| Document appendix | Added to close the original evidence-file requirement | `qa/projects-workflow/07-document-appendix.jpg` |

References and rendered screenshots were visually compared together, including the final desktop record and booklet. DOM readback verified text, controls and saved values because desktop screenshot compression softens text. No reference image was used as the implemented interface.

## Corrections and final assessment

- Layout: current white/teal shell and sidebar retained. Draft has three progress steps, editable stage/task list and project/measurement setup. Work view has a left task tree and a right inline measurement table, photos and notes. Booklet has chapter navigation, a paper preview and settings/photos.
- Measured desktop record table starts at approximately y=444 with height 161 px, versus y=440 and 158 px in the selected reference. Evidence starts at y=620 versus y=619. Paper preview is 450 px wide versus about 448 px in the reference. Earlier oversized spacing and booklet proportions were corrected.
- Type and assets: existing Sarabun, bundled brand and Lucide icons. The preview evidence image is an existing repository image uploaded through the actual file control; it is explicitly synthetic test evidence, not a fabricated field result.
- Mobile: task selector, per-plant previous/next controls, two measurement fields, observations, photo/caption and draft/final actions. Page width is 390 px at a 390 px viewport. Additional project navigation, history and recorded-event controls make this longer than the isolated mockup; photo/evidence remains reachable by vertical scrolling. No horizontal page overflow.
- Mobile activities: compact input page followed by a review page. Existing stock conversion/partial-use controls remain accessible in details. The stock review is more detailed than the mockup because it shows the actual inventory impact.
- State: confirmed results, local drafts, blank values, zero values, missing sample setup, ordinary projects without trials, invalid values, stale edits and storage failures have explicit handling. Saving results leaves task completion separate.
- Content differences: stored project codes, task counts, status, cost totals and uploaded photos are used. The mockup's fictional totals/photos are not substituted. Menu entries such as the wallet continue to follow the existing app configuration.
- No known P0/P1/P2 issue remains in the locally exercised flow. Minor font rasterization, icon and spacing differences remain; this is not a pixel-identical-content claim.

## Validation and limits

`npm run check`: **636 passed, 0 failed**, relay **9/9**. New modules pass `node --check`; `git diff --check` passes. Browser error log: empty. Full functional evidence and boundaries are in `qa/projects-workflow/validation.md`.

Word was downloaded twice and its OOXML package was read successfully: actual values, photo, conclusion and document appendix are present. Native Chromium print preview showed 9 pages with report contents; no physical print or saved PDF file was produced. Office application rendering was not tested.

Draft restoration was exercised by reloading. Real device camera, a disconnected-network round trip, real account cloud sync, dark mode and a complete accessibility audit were not exercised. Drafts remain account-local; confirmed records use the existing state persistence path. The brief assistant uses editable work templates and recognized duration/metric terms, not an external language-model service. Documents support PDF/DOCX/XLSX/CSV/TXT, 2 MB per file, 10 files and 4 MB total per project, subject to browser storage capacity.

`Deployment: NOT_DEPLOYED`. Same-origin API, loopback preview, DATA_ONLY and SAFE_OFF remain unchanged. No hardware or production write occurred.

---

# Crop-cycle notebook design QA — prior revision

final result: passed

Date: 2026-11-24 (Asia/Bangkok). Owner: Codex for Folk. Branch: `codex/projects-trials-v1`.
Scope: correct the existing crop-cycle notebook to the user's supplied reference; retain canonical activities, costs, photos and project links.

## Reference and comparison method

- User reference: `qa/cycle-notebook/reference.png`, 1674 × 940.
- Before: `qa/cycle-notebook/before.jpg`, 1674 × 940.
- Final desktop: `qa/cycle-notebook/desktop.jpg`, 1674 × 940, materials tab, all material categories, November 2026.
- Final mobile: `qa/cycle-notebook/mobile.jpg`, 390 × 844, materials tab, all months.
- Reference and rendered desktop screenshots were displayed together and compared at the same viewport and tab. Desktop and mobile were also checked with browser DOM readback and interaction.
- A full-page capture produced a distorted capture despite a correct viewport capture. That artifact was excluded; the verified viewport screenshots above are the evidence.

## Visual iterations

1. Before: oversized heading, mismatched tabs, and missing reference-style right column. Rebuilt the notebook with the existing shell, three summary cards, one tab row, material history and three stacked sidebar cards.
2. First comparison: excess vertical spacing put the table below the reference. Reduced spacing and card padding; final summary cards start at approximately y=191 and the material panel at y=370, matching the reference's structure.
3. Mobile comparison: document overflow reached 682 px at a 390 px viewport. Contained the accessible table label and reflowed material rows into cards. Final document width and viewport width are both 390 px; quantity and material cost remain visible together.
4. Interaction review: corrected activity presets to retain both plot and cycle, initialized the deep-linked calendar year, and made the experiment shortcut open its selected task even after visiting a project report.

## Final visual assessment

- Layout: white/teal sidebar, compact notebook header and actions, three equal summary cards, six tabs, and approximately 1.63:1 main/sidebar columns follow the reference. Sidebar contains costs, linked projects and report draft.
- Typography: existing Sarabun font, 28 px page heading, 23 px card headings and 16 px table text. Long saved project/task names wrap rather than being truncated.
- Color and surfaces: existing teal actions, pale green material header/footer and experiment bridge, white cards, thin gray borders and restrained radii.
- Icons and images: bundled Lucide icons and existing brand asset; photos come from saved task/observation evidence. No generated photographs or fabricated evidence were introduced.
- Copy and data: reference labels are retained where appropriate. Filtered material totals are labelled as filtered, while cycle totals remain unfiltered. Missing review data displays an unknown state, not a false zero.
- Responsive behavior: mobile sidebar collapses through the existing shell; activity rows become readable cards; tabs can scroll without page overflow.
- Remaining minor differences: exact icon strokes/font rendering differ from the mockup. Existing longer names make linked-project and report cards taller. These are not unresolved functional blockers.

## Intentional content differences

The preview uses the existing synthetic account records: 10 rai, cost 2,555 baht (materials 1,155; labor 1,400; other 0), no pending review, and the previously saved project and observation image. The reference's 2 rai, 3,500 baht, one pending item and corn photographs were not substituted into saved records. The wallet entry follows the existing preview configuration. This review does not claim pixel-identical content.

## Interaction checks

- Material and month filters work; the fertilizer subtotal is 975 baht while cycle cost remains 2,555 baht.
- Cost details reconcile: labor 1,400 + fertilizer 975 + chemicals 180 = 2,555 baht.
- Activity form selects the current plot and cycle automatically. Closed cycles are guarded.
- Experiment shortcut opens the linked measurement task and its existing 43 cm observation, prior revision and image.
- History filtering, pending-review preview state, empty harvest state, linked project objective and overview actions render correctly.
- Calendar displays October 2569 for the preview cycle, rather than year 543.
- Report draft shows saved cycle data, actual costs, activities and photos; planned costs are labelled separately. Its print control is present. Native print preview was not rerun in this revision.
- Mobile activity details open the selected record. Final browser error log: none.

## Automated validation and boundaries

`npm run check`: 620 tests passed, 0 failed; `RELAY_VALIDATION_OK messages=9`.
Ten new regression tests cover canonical cost reconciliation, filtering, zero/legacy values, actual units, evidence deduplication, review scoping/pagination/session isolation/failure, task navigation and plot/cycle presets.

Live review API behavior is unit-tested but was not exercised against a real account. Dark mode was not visually tested. No production writes, migrations, deployment or hardware actions occurred. `DATA_ONLY`, `SAFE_OFF`, same-origin API and loopback preview remain intact.

Prior project/experiment flow validation is preserved in `qa/projects-trials/validation.md`; it is separate from this visual correction.