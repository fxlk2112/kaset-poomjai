# Trial workspace redesign

Historical report: the single-day comparison described here is superseded by
`TRIAL_TIMELINE_AUDIT.md` and build `20260907trialtimeline1`.

Build: `20260907trials2`. Preview: http://127.0.0.1:4181/?build=20260907trials2

## Findings and decisions

1. The old detail page placed setup, optional chemical fields, areas, layout,
   analysis, timeline, and photos in one long scroll. Replaced it with Recording,
   Comparison, and Plan tabs. The default tab is Recording.
2. Recording one observation required reopening a modal for every subplot.
   Added batch entry for the selected metric/day, with blanks left unrecorded,
   existing values prefilled, and an unmeasured-only filter.
3. The setup wizard had four steps and exposed chemical inputs even for trials
   about seeds or irrigation. Reduced it to three steps, starting with two
   treatments and one metric. Optional recipe and application fields are folded.
4. The old list labeled the highest mean as best and could mark partial data as
   complete. Removed those claims. Comparison uses one date and matching units,
   shows measured/expected counts, and keeps statistical summaries descriptive.
5. Renaming or removing form rows could associate old IDs by row position.
   Form rows now retain IDs; measured metrics cannot be removed or relabeled
   with a different unit. Existing notes and photos survive batch value edits.

## Verified workflows

- Create: three steps, live subplot count, two treatments and two replications
  produce four unique subplot records. Optional external-plot name is hidden
  when a saved plot is selected.
- Record: add three values with one blank, filter missing plots, edit one value
  and add a note, then batch-edit without losing the note. No duplicate row is
  created by editing the same day.
- Compare: means and ranges reflect the selected day; missing or mixed-unit
  values are disclosed. CSV content preserves Unicode and quotes and guards
  formula-leading values. Native spreadsheet import was not tested.
- Plan: rename a treatment with existing observations without changing its
  units or losing measurements. Destructive controls are separated from entry.
- Navigate: list search and state filters, keyboard arrow tab switching, and
  refresh restoring the selected tab.

## Visual and accessibility checks

Screenshots inspected at 320 and 390 pixels in light mode and 1440 pixels in
dark mode. All three workspace tabs passed the 320px horizontal-overflow check.
Batch inputs are at least 44px high. Form labels, native buttons, named photo
actions, tab roles, keyboard navigation, and focus visibility were checked.
This is not a complete accessibility certification or physical-phone test.

The old modal footer's hidden controls were being displayed outside their form;
the wizard footer now correctly shows only Next or Save for the current step.
Selected tabs and graph values received dark-theme contrast corrections.

## Tests and limits

`node --test tests/trials.test.cjs tests/interior.test.cjs`: 59 passed, 0 failed.
There are 20 trial tests and 39 existing interior regression tests.

Production data, live device commands, and deployment were not touched. Photo
upload to the production cloud and real multi-device concurrency were not
retested. Photos remain on the existing upload path. No inferential statistical
engine was added, and a high mean is not interpreted as a better treatment.

## Captured evidence

Evidence folder:
`C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/farm-all-cards-20260907/trial-redesign`

Before: `01-before-detail.png`, `02-before-measure.png`, `03-before-setup.png`.
After: `08-after-batch-320-final.png`, `09-record-320.png`,
`09-compare-320.png`, `09-plan-320.png`,
`12-after-compare-desktop-final.png`, `13-after-record-390-final.png`.

![Batch entry](C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/farm-all-cards-20260907/trial-redesign/08-after-batch-320-final.png)

![Comparison](C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/farm-all-cards-20260907/trial-redesign/12-after-compare-desktop-final.png)
