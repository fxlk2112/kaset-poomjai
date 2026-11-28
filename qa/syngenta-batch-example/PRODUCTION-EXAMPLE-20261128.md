# Production QA worksheet example

- Owner: Codex for Folk, under the user's explicit request to put the existing worksheet example in the separate test account on the canonical site.
- Branch: `codex/publish-syngenta-demo-20261128`, source `a4e723c`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Append the existing local example and its plot/cycle to the previously authorized production QA account. Preserve missing source fields, sponsorship, photos and all previous QA records.
- Files changed: `COLLAB_STATUS.md` and this handoff only. Transfer scripts, snapshots, credentials and screenshots remain ignored under `tmp/syngenta-live-20261128/`.
- Commit: The documentation commit containing this handoff.
- Deployment: NOT_DEPLOYED (no application code change). Production QA data write explicitly authorized by the user on 2026-11-28; existing production runtime remains `d244cb1`. Same-origin `/api` used throughout; DATA_ONLY / SAFE_OFF unchanged.

## Result and validation

- Canonical site: https://farmultimate-solutions.pages.dev/ ; project `PRJ-DEMO-A-002` is open in the in-app browser, signed into the separate QA account.
- Reconciled the saved local example against the original workbook before transfer. Workbook hash unchanged.
- Added the exact saved source subset: one project, one plot, one crop cycle and 33 activities. Stable source/task/batch IDs preserved and unique. No duplicate financial entries created.
- Guarded the append with QA identity, remote revision and pre-transfer snapshot checks. Only the four target arrays were extended. All 12 previous QA activities and other existing state stayed unchanged; account now contains 45 activities in two distinct projects.
- API readback immediately after save and again after browser login/inspection confirmed exact equality of source records, seven pending records and four blank dates. No inferred dates, quantities, units or approved budgets.
- Canonical finance functions agree at project, plot and crop-cycle scopes. All 13 sponsored entries retain zero cash cost. Recorded actual expenses remain separate from requested/approved budgets. Unallocated fixed costs remain excluded as documented in the original example.
- Canonical-site UI shows 33 activities, 26 complete activities, seven awaiting information and two photos. Read-only inspection of the seven-row repair table confirmed that missing dates/quantities/units remain blank. No repaired records were submitted.
- Report preview displays sponsorship separately, retains incomplete-data disclosures, and loads both illustration photos with explicit captions identifying them as examples rather than actual field evidence.
- Desktop screenshot/readback: `project-live.jpg`, `missing-7.jpg` in the ignored transfer directory. Final API reconciliation: `verification.json` there. User-facing browser tab left open on the project.
- No JavaScript, CSS, HTML, Worker or workflow changed; full application tests were not rerun for this data/documentation-only task. Scoped data reconciliation and live browser verification PASS; documentation whitespace check PASS.

## Blocked / Risks

- No transfer blocker. Seven records remain incomplete intentionally; users must supply confirmed values when available.
- Photos are illustrations. The historical cycle remains open for testing and does not assert current cultivation. Requested/approved budgets remain blank.
- No inventory deduction was exercised because the source example has no stock usage. Word/PDF exports were not regenerated in this task; the report preview was checked.
- The canonical in-app browser tab now uses QA. Other devices/browsers require signing into that QA account; opening the public URL alone does not grant access to the example.
- Source-derived row data and credentials are intentionally absent from Git. Existing farm accounts were not updated by the transfer.

- Next action: User tries `PRJ-DEMO-A-002` in the signed-in QA tab, keeping missing values blank until verified.
