# Crop-cycle notebook design QA

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
