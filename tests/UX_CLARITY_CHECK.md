# UX Clarity Check - 2026-09-08

Build: `20260908uxclarity1`. Local preview: port 4186 with `--demo`.
This verification did not write to the production account or deploy.

## Verified

- 155 automated tests pass, including new equipment edit, price freshness,
  request deduplication, modal close, calendar selection and trial grouping tests.
- Customer entry survives Close -> Keep editing. Cancel -> Discard closes it.
- Equipment edit saves without a discard prompt and retains maintenance history.
- Batch trial edit survives Close -> Keep editing, then saves and updates its graph.
- Trial records are grouped by replicate, or by physical plot for sampling.
- The 5-treatment sampling comparison retains all seven dates, raw data exports,
  history and its five visible graph series.
- Calendar selection remains open with the correct selected day's tasks.
  Blank calendar cells are not buttons. Mobile cells use status dots rather than
  illegible task-name fragments. The floating shortcut no longer overlaps it.
- Stock search by product code returns the matching item; clearing restores items.
  At 390px wide, the first stock card starts around 332px from the viewport top.
- Analytics opens the selected farm/shop totals and graphs before secondary context.
- Water logging and hardware-command controls have distinct labels. No command sent.
- Malformed preview price responses display an error rather than a NaN date or a
  false freshness indicator. Automated tests cover missing, stale and future dates.
- Screenshots inspected at desktop 1280x720 and mobile 390x844; the sampling view
  was also checked at 320x740 without horizontal page overflow.
- No browser console errors observed in the inspected flows. Viewport override reset.

## Limits

- Browser checks used a local mock account, not production authentication or a
  real two-device sync session. Existing automated sync/offline tests still pass.
- Hardware, upstream weather availability and current market-price correctness were
  not end-to-end tested. Malformed-price handling was tested intentionally.
- Visual inspection is not a complete accessibility certification or usability study.
- Screenshots are stored outside the repository in the existing UX audit directory.
