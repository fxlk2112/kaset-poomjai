# Within-Area Sampling

Build: `20260908trialsampling1`

## Scope

- Keep the existing replication/block workflow as the default for old trials.
- Add an explicit within-area sampling mode with one area per treatment, physical plot names, and free-form plot portions.
- Support the requested five treatments in three physical plots: two halves, two halves, and one whole plot.
- Store the individual point values on each area/date/metric observation. The observation value is their arithmetic mean; null points are excluded, zero is included.
- Sampling-point numbers are slots within a measurement visit, not independent replications or permanent geographic locations. Selection of locations happens in the field; this feature does not generate GPS coordinates or select plants automatically.
- Charts and paired changes operate on area means. Sample counts are separate from the number of areas; a single area never receives an estimated between-area SD.
- Raw CSV emits each sample point, including missing points. Summary CSV includes both area and point counts.
- Existing observations, photos, notes, units, and treatment identities are preserved. Recorded trials cannot switch collection design or change planned point count; use a new trial for a different design.
- Sample-mode layout is grouped by actual plot and cannot use block randomization.

## Verification

- Node tests: legacy behavior, 5-area/3-plot creation, partial and zero samples, invalid input, unchanged-mean raw edits, stable IDs, mode-change protection, coverage, CSV, and layout grouping.
- Browser local preview only: create the 5-treatment example through the wizard; record individual points and all areas; edit a missing point; reload; reopen the plan.
- Confirmed 15/15 points, area means 6, 8, 10, 12, 14, and n=1/1 area for each treatment.
- The incomplete-area filter retains an area with 2/3 points, and clears after its final point is recorded.
- Desktop 1440x1000: visible chart and physical-plot grouping. Mobile 390x844 and 320x800: no horizontal page overflow; point inputs at least 44px tall.
- New preview data is synthetic and is not written to production. No deployment or Git push in this change.

## Methodology Reference

The distinction between multiple samples within a replicate and independent replication follows University of Minnesota Extension's on-farm research guidance: https://extension.umn.edu/courses-and-events/for-professionals/on-farm-research/how-to-do-research-on-your-farm

No significance testing or causal efficacy claim is made for the unreplicated comparison.
