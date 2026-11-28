# Project workflow validation

Owner: Codex for Folk. Branch: `codex/projects-trials-v1`. Local synthetic preview only.

## Exercised browser flow

1. Entered a fertilizer comparison brief with four weeks, height and leaf count. The editable draft contains preparation, weekly tasks 1–4, summary, start date, plot/cycle, groups, sample count and metric fields. Blank start remains blank; dates can be changed. Stage movement and metric field editing were exercised.
2. Created PRJ-2569-002 from the draft. Seven planned tasks and one trial with four sample plants were created. No actual cost or inventory deduction occurred at project creation.
3. Selected week 2. Entered height/leaf pairs A-01 38.2/14, A-02 37.6/13, B-01 35.4/12 and B-02 34.9/12. Uploaded a repository image, assigned it to A-01, entered a caption and selected inclusion in the report. Added work and observation notes. Confirmed results without completing the task.
4. Reloaded mobile at 390 × 844. Draft navigation and restoration worked. Edited A-01 height to 38.3 and confirmed. History retained 38.2, previous caption/evidence, actor and time. Final readback contains eight values and one image; document width is 390 px.
5. Recorded a synthetic weather event. Rescheduled week 3 from 2026-12-01 to 2026-12-02 with a reason. Original/new dates and reason are visible. No cost or stock change accompanies this action.
6. Edited the booklet conclusion and checked that a saved earlier version did not change. Chapter navigation/order, individual photo choice and result date scope were exercised. A date scope excluding the observations shows zero values; clearing the scope restores eight. Work/cost scope remains explicitly whole-project.
7. Downloaded Word through the actual control. Final DOCX is valid XML within an OOXML ZIP, contains 38.3, the conclusion, one embedded image and the document appendix. Native Chromium print preview showed nine report pages with values, evidence, conclusion and costs. Cancelled the dialog without physical printing.
8. Opened the mobile activity form from the crop cycle. Reused a material, inspected the input/review screens and saved 0.1 bag at 650 baht = 65 baht. Review showed 53 full bags unchanged and open material decreasing from 25 to 20 kg. Crop cost increased from 2,555 to 2,620 baht exactly once, materials from 1,155 to 1,220; project cost became 65. The new activity links back to PRJ-2569-002. No real farm account was used.
9. Crop yield empty state shows no harvested weight instead of a misleading cost/kg. Unit tests cover kg/g conversion and mixed unknown units.
10. Created PRJ-2569-003 for a general farm manual. Six tasks are available with work/cost/evidence and booklet controls, without requiring a trial or sample plants.
11. Uploaded `sample-readings.csv` under project information, added its caption, navigated away and verified the appendix. Downloaded the original file through the UI; SHA-256 equals the local fixture. Report snapshots preserve file bytes and captions; saved report versions expose downloads of their own attachments. DOCX contains the filename and caption, while original documents remain separate downloads.
12. Returned to the confirmed week-2 record. Final desktop readback: viewport 1674 × 940, document width 1674, eight saved values, one photo, confirmed status, no console errors. Cleared the viewport override and left the project tab open.

## Automated evidence

- `check.log`: `npm run check`, 636 passed / 0 failed; `RELAY_VALIDATION_OK messages=9`.
- New module syntax and `git diff --check`: passed.
- Regression coverage includes weekly scheduling/manual dates, atomic creation, zero vs missing measurements, validation/collisions, stale drafts, quota rollback/retry, photo batch failures, report snapshot isolation, completion evidence, document validation/snapshot/export, rescheduling and crop weight conversions.

## Scope boundaries

The original audit at `docs/PROJECTS_TRIALS_REQUIREMENTS_AUDIT.md` describes the earlier commit. This correction closes its local workflow and layout gaps. It does not certify real-account sync, mobile camera capture, offline-to-online server reconciliation, Office rendering, dark mode or all accessibility criteria. Local draft persistence after reload was verified. No server credentials, production records or hardware were used.

The brief parser recognizes known work types, duration and measurement terms and produces editable templates. It does not use an external AI service. Large photos, documents and immutable report versions consume account-local storage; quota errors are surfaced without silently completing a failed save.

All screenshots and fixture CSV contain synthetic preview information. The native print screenshot was not stored because surrounding application chrome included unrelated user material.

Deployment: **NOT_DEPLOYED**.
