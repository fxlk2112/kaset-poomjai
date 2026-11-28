# Ordinary project usability audit

Date: 2026-11-25, Asia/Bangkok. Local synthetic preview, build `20261125workflow6`.

User model: a project groups what will be done in a plot. Experiments are optional. The audit follows the actual path from a brief or crop cycle to tasks, work records and a booklet. It does not assess KPI scoring.

## Findings and fixes

| Priority | Observed problem | User impact | Implemented correction |
|---|---|---|---|
| P1 | Mentioning “ปุ๋ย” classified ordinary work as an experiment | User had to handle groups, plant codes and measurements for fertilizer application | Explicit experimental intent/mode is required; ordinary briefs produce ordinary tasks |
| P1 | Every new project required a drafted task plan | Could not simply name the work to be done in a plot | “ตั้งโครงการ” requires only a name; plot/cycle optional; empty projects supported |
| P2 | Generic normal-work drafts generated six administrative tasks | Extra cleanup before starting practical work | Recognized farm actions become a single stage in input order; add tasks individually when desired |
| P2 | Legacy projects lacking kind entered trial setup | Existing non-experimental work looked incomplete | Actual linked trial or explicit experimental kind determines trial UI |
| P2 | Ordinary recording required opening task details before completion | Extra navigation on every work record | Direct record action opens the canonical completion form |
| P2 | Undated tasks were marked overdue and notified | False urgency when the user only intended to list future work | Missing due date remains “วางไว้ / ยังไม่กำหนดวัน”; excluded from due notifications |
| P2 | Ordinary booklet contained empty experiment sections | Report suggested that required data was missing | Normal report/Word omit measurement results and use a document appendix |
| P2 | Mobile hid plot/cycle under the project title | Could lose track of which plot the topic concerns | Context remains visible and wraps on mobile |

No known blocker remains in the exercised ordinary-project path. These priorities express impact in this workflow, not a complete product audit.

## Browser evidence

All images were saved and visually inspected. Before screenshots use the existing app viewport; after screenshots are 1440 × 940 except mobile 390 × 844. Desktop screenshot compression softens text, so DOM readback independently confirmed labels, selected context, values and saved notes.

1. [Before: project hub](01-before-hub.jpg) — experiment-oriented copy and counters dominated ordinary work.
2. [Before: wrong classification](02-before-misclassified.jpg) — fertilizer, grass-cutting and harvest brief generated a trial.
3. [Corrected draft](03-simple-draft.jpg) — one stage, three ordinary tasks; no sample/measurement setup.
4. [Create from crop cycle](04-create-from-cycle.jpg) — plot/cycle prefilled; only the project name entered.
5. [Empty project](05-empty-project.jpg) — zero tasks/trials, clear first-task action.
6. [Record actual work](06-record-work.jpg) — direct completion form, note, actual date and optional photo.
7. [Ordinary project on desktop](07-general-project-desktop.jpg) — two tasks, one complete, saved note and actual completion date.
8. [Ordinary project on mobile](08-general-project-mobile.jpg) — plot/cycle context, task selector, primary actions, no horizontal overflow.
9. [Ordinary booklet](09-general-booklet.jpg) — saved note and planned task in the work chapter; eight chapters without experimental results.

## Exercised behavior

- Same ordinary brief now proposes ใส่ปุ๋ย → ตัดหญ้า → เก็บเกี่ยว. Editable draft was saved locally.
- Created synthetic PRJ-2569-004 from the crop notebook: “ดูแลแปลงตัวอย่าง 1 รอบนี้”, plot 1, corn cycle 2. No experiment created.
- Added “ตัดหญ้ารอบแปลง” without a date; recorded completion note without a photo. Saved note appears in project and booklet with actual date 2026-11-25.
- Added “ใส่ปุ๋ยรอบถัดไป” without a date. It remains planned, not overdue. Mobile task selection works.
- Existing PRJ-2569-002 trial still renders four plant rows, height/leaves fields, photo and notes controls. Its current local draft was not modified or saved by this audit.
- Browser error log: empty. Viewport override reset after QA; ordinary project left open.

## Automated checks

`npm run check`: **643 passed, 0 failed**, relay **9/9**. Full output: [check.log](check.log).

Seven new behavioral tests cover ordinary/negated experimental briefs and software testing, empty project creation, inherited plot/cycle with rollback on persistence failure, kindless legacy projects, ordinary Word contents, undated status/notifications, and stale sample settings when rewriting a trial draft as ordinary work. Existing trial, evidence, inventory and cost tests continue to pass.

## Limits and accessibility observations

Forms have labelled controls, the short forms focus the first field, and ordinary mobile action buttons have at least 44 px height. Semantic controls were exercised through browser locators. Keyboard-only operation, screen reader output and measured color contrast were not comprehensively tested; this is not a WCAG conformance claim. No participant study or timing comparison was performed.

Task suggestions still use editable local templates, not an external AI service. Real-account sync, real camera, disconnected reconciliation and Office rendering were not tested in this follow-up. Prior experiment export evidence remains in `qa/projects-workflow/validation.md`. Cost/stock use existing canonical paths; this follow-up created no material movement or expense. All recorded data in this audit is synthetic.

Deployment: **NOT_DEPLOYED**. Same-origin API, loopback preview, DATA_ONLY and SAFE_OFF are unchanged.
