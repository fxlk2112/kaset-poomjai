# Trial timeline restoration

Build: `20260907trialtimeline1`. Preview: http://127.0.0.1:4184/?build=20260907trialtimeline1

## Scope

Restored longitudinal comparison without reverting the existing batch-entry
workflow or changing stored trial schemas. Production records, auth, Worker,
and landing content were not modified. No deployment or Git push was performed.

The former single-day comparison hid the original trend and made detailed
records difficult to find. Historical source was reviewed at `b548007`.

## Implemented

- Results open by default for trials with observations; new trials still open
  entry. Explicit Record and Results buttons retain their respective actions.
- Four keyboard-accessible tabs: results, recording, history/photos, plan.
- Multi-series chart and date-by-treatment matrix include the entire trial,
  with optional inclusive start/end filters. No twelve-date cutoff.
- Changing the detail date does not change the full-period chart or matrix.
- Each point is a treatment mean for one date, with measured/expected counts.
  Missing observations remain gaps, not zeroes. Latest edited duplicates are
  counted once; incompatible units and invalid records are disclosed.
- Detailed statistics include mean, sample SD and range for a selected day.
  Before/after changes use only the same subplot IDs measured on both dates.
  Repeated observations are never presented as independent replications or
  as proof of statistical significance. No new ANOVA or post-hoc engine.
- History includes every metric by default, treatment/date filters, an optional
  photos-only filter, notes, all attached photos, editing and deletion.
  Orphan records remain visible instead of silently disappearing.
- Plans, treatments, layout, areas, recipes, activities, setup and management
  remain available. Restored a disclosure for subplot area details and notes.
- Added a summary CSV for the current metric/range/treatments. Raw CSV remains
  a full-observation export. CSV content tested; external spreadsheet import
  and actual browser file downloads were not independently checked.
- Fixed history-row CSS that assigned grid columns to a flex container.
  Mobile actions now sit above full-width notes/photos. Graphs redraw on resize.
- Cache version updated to `farmult-v125-trialtimeline`.

## Verification

126 automated tests passed, including 39 trial tests. Commands:

```text
node --test tests/interior.test.cjs tests/trials.test.cjs tests/offline.test.cjs tests/recovery.test.cjs tests/landing.test.cjs
git diff --check
```

Browser checks used only isolated synthetic preview data: 16 dates, three
treatments, three replications, two metrics and a missing treatment-day.

1. Results: all 16 dates and separate treatment curves rendered; narrowed to
   six dates, changed snapshot date without losing those dates, hid/restored
   a treatment, and switched metrics successfully.
2. Recording: filled the missing subplot through batch entry; coverage changed
   from 8/9 to 9/9 and the result mean updated. Existing records were retained.
3. History: all-metric records, photos-only filtering, loaded image, note and
   image enlargement verified. Refresh retained the selected history filter.
4. Plan: layout and treatment details rendered; existing setup dialog opened
   with preserved fields and was cancelled without saving.
5. Responsive: inspected 320/390px mobile and 1440px desktop, in light/dark
   themes. All four tabs passed the 320px document overflow check. Numeric
   tables have their own scroll region. No final runtime error logs.

Evidence directory:
`C:/Users/USER/.codex/visualizations/2026/09/05/01a0706b-5ca9-74a1-8974-9dd8f1c04c57/trial-timeline-qa/`

Accepted captures: `desktop-1440-overview-final.png`,
`desktop-statistics-final.png`, `mobile-320-graph-final.png`,
`mobile-320-history-final.png`.

`desktop-1440-results.png` is rejected as full-page stitching displaced the
fixed navigation. Use the viewport captures above instead.

No physical-device, production photo-upload, real multi-device sync or full
accessibility certification is claimed. Existing automated offline/recovery
regressions passed; these services were not redesigned in this change.
