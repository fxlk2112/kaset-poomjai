# Project proposal workflow — design QA, 2026-11-27

final result: passed

Scope: the five approved green FARMULTIMATE screens implemented inside the existing app. Previous calendar QA is preserved in `qa/project-proposal/previous-design-qa.md`. This is a functional adaptation using the existing shell and accounting controls, not a claim of pixel-identical reproduction.

## Visual truth and capture evidence

Source directory: `C:/Users/USER/.codex/generated_images/01a207c1-667e-7670-86ba-5df7a70aacb0/`.

| Screen | Approved source filename | Source pixels | Actual capture / CSS viewport |
| --- | --- | --- | --- |
| Proposal | `exec-6221ab14-8b3f-4220-ba44-0c173c21a436.png` | 1717 × 916 | `qa/project-proposal/proposal-desktop.png`, 1717 × 916 |
| Task review | `exec-8a2385e3-907e-4c52-8270-fcdeb5a09321.png` | 1586 × 992 | `qa/project-proposal/tasks-desktop.png`, 1586 × 992 |
| Workspace | `exec-201b487f-40b0-48a6-9a38-39c9a99ccc43.png` | 1561 × 1008 | `qa/project-proposal/project-desktop.png`, 1560 × 1000 |
| Material entry | `exec-51bbdd38-f005-4a3d-bd1b-039753657179.png` | 1561 × 1008 | `qa/project-proposal/entry-desktop.png`, 1560 × 1000 |
| Report | `exec-ad2a35a9-799f-4075-9d07-6e710efc654a.png` | 1536 × 1024 | `qa/project-proposal/report-desktop.png`, 1560 × 1000 |

Implementation: <http://127.0.0.1:4186/?projectPreview=1>. Light theme, isolated synthetic account; no production data. DPR observed as 1. Screenshots were read back after viewport changes. A capture immediately after resizing returned the prior surface dimensions; those incorrect captures were replaced using the settled native browser screenshot.

Each source and implementation was opened together in `qa/project-proposal/comparison-{proposal,tasks,project,entry,report}.jpg`. Each image is fit proportionally into a 780 × 530 panel, without stretching, with reference left and implementation right. Minor desktop dimension differences are recorded above. `compare.py` reproduces these comparison inputs. Readable material-form and report-editor crops are in `comparison-entry-focus.jpg` and `comparison-report-focus.jpg`; these were also opened together and reviewed.

State: proposal for plot A / round 2 with budget 5,000 and no invented dates; selected fertilizer task; project/report at 3 of 6 tasks, 800 total and two report photos. Entry capture uses an unconfirmed draft on synthetic plot B with the same 8 kg / 600 + 200 values. Its stock preview is 42 → 34 because plot A already consumed 8 kg; this is an intentional state difference, not duplicate posting. Task review has 6 selected tasks; the optional unselected spray task in the mock is not invented when absent from the brief.

Mobile: 390 × 844. `entry-mobile.png`, `project-mobile.png`, `report-mobile.png` are final viewport captures. `proposal-mobile.png` and `tasks-mobile.png` are full-page captures from the same 390 CSS px responsive flow. Layout collapses to one column; measured document width equals viewport width. There is no separate approved mobile mock for these five screens, so mobile evidence validates usability and responsive continuity rather than an invented 1:1 target.

## Findings, iteration history and fixes

- **Resolved P0 — material-entry mount failed.** Replacing modal actions after moving the canonical form left a null target. The page now creates its own actions and mounts the existing form safely. Actual browser flow and final entry captures verify the working form.
- **Resolved P1 — zero material quantity passed completion.** Entry now checks material identity, unit and finite positive quantity before canonical validation. UI zero-quantity attempt was blocked; the focused tests cover zero, negative, missing and non-finite values. Explicit zero price remains allowed.
- **Resolved P2 — oversized desktop form hid evidence.** Initial material fields and spacing pushed notes/photos far below the useful work area. Kept quantity/unit/total visible, collapsed price/package/issue details, grouped actual date with materials and tightened desktop cards. Final entry full/focused comparisons show the evidence section and upload action within the first viewport. Long evidence naturally scrolls.
- **Resolved P2 — mobile stock name wrapped into a narrow strip.** The change-material button shared a narrow grid cell with the name. Mobile selected stock now uses a vertical flex layout; `entry-mobile.png` shows the full name and its button without horizontal overflow.
- **Resolved P2 — footer controls stacked and mobile metric columns overflowed.** Scoped the footer's row direction and used `minmax(0,1fr)` metric tracks. Final mobile workspace/report captures show contained totals and reachable controls.
- **Resolved P2 — report chapter preview did not follow editing.** The preview now renders the selected chapter, and the work chapter shows the summary/costs/photos spread. Caption selection/order and edited narrative were checked in browser and exports.
- **Resolved P2 — proposal/workspace/task-review density diverged.** The first comparison hid objectives, the fourth stage and the latest work below the fold. Tightened desktop fields, task rows and headers; reduced workspace summary-paper scale. Re-captured proposal at exactly 1717 × 916 and task review at 1586 × 992. Final comparison inputs show objective/sections, all six selected tasks, and the workspace's latest record in the intended hierarchy.
- **Resolved P2 — report paper and editor spacing.** Reduced duplicate header spacing and paper typography, retained chapter selection and narrowed the paper. The final report spread exposes costs and photos together with editable prose and captions.

No actionable P0/P1/P2 findings remain for this scope.

## Required fidelity surfaces

- **Fonts / typography:** reused the app's Sarabun stack and Thai line-height conventions. Clear heading/section/field hierarchy, 12–14 px desktop form labels, larger mobile inputs; no mobile text overflow. The raster mocks have heavier apparent strokes, and desktop IAB captures are softer than source artwork; these are not treated as exact font-weight or antialiasing measurements. Native mobile readback remains legible.
- **Spacing / layout:** preserved left editor/right paper, green context/metrics bar, numbered task stages, explicit review totals and bottom actions. Existing 238 px sidebar and 60 px header differ from the mock's narrower shell by design; changing unrelated navigation was outside scope. Report body is a scrolling real document rather than fake page controls. The final dense desktop rows and one-column mobile layout were checked after fixes.
- **Colors / tokens:** existing emerald primary, mint panels, pale neutral canvas, bordered white cards, amber pending/review and red delete states. No replacement brand palette or new design system.
- **Images / icons:** retained actual FARMULTIMATE mark and the existing icon library. QA photos are the repository's farm/trial imagery, selected through the real upload control. Thumbnails use the existing activity attachment renderer; report captions/order are editable. Actual uploaded media replaces the mock's illustrative crop photos. No fabricated field evidence or hand-drawn replacement logo.
- **Copy / content:** ordinary care project labels; no trial metrics forced into non-experimental work. Missing dates/time/owner/results stay unspecified. Prose is drafted from local templates/data and remains editable. Actual record totals are read-only in the report. No KPI scoring added.

## Behavior and residual limits

Verified proposal → task review → create → actual fertilizer/labor/photos → cost confirmation → report; drafts, cancellation, zero-quantity rejection, snapshot immutability, captions/order/selection, Word download, and browser PDF print preview. Canonical total is 800 in project, plot and cycle; stock changed once. Final browser error log was empty. `npm run check`: 716/716, relay 9/9. Details and limits: `qa/project-proposal/HANDOFF.md`.

Expected adaptations: keep the established activity/stock validators, real browser date controls, original app navigation and canonical photo controls. The report uses a scrollable page and explicit saved-edition controls. Search reopens through “เปลี่ยนสินค้า” after a stock item is selected. Photo captions are edited in the report. Manual prose remains unchanged until the user requests a fresh draft; source totals still update.

Follow-up P3 polish: tune exact desktop stroke/spacing against a future vector design if desired; evaluate more compact multi-photo thumbnails with large attachment sets. No cloud-sync/production or Microsoft Word visual rendering claim is made.

## Implementation checklist

- [x] Source and actual images opened together, including focused regions.
- [x] Fixed blocking/moderate findings and recaptured affected routes.
- [x] Tested desktop/mobile core workflow and checked console.
- [x] Verified totals, stock, draft behavior and saved report editions.
- [x] Left a local preview open; deployment remains NOT_DEPLOYED.
