# Circle completion validation

Date: 2026-11-25 (Asia/Bangkok). Owner: Codex for Folk. Branch: `codex/projects-trials-v1`. Task lock: `PROJECTS-TRIALS-20261124`.

## Implemented behavior

- Plot-wide and crop-cycle history have an independent circle completion button beside each detail button. Planned work opens completion; recorded success is a disabled green tick; failed work is a disabled red cross. Closed-project work cannot be completed through the circle.
- Project task trees use the same control. Mobile places the circle beside the selected subtask dropdown. Clicking a desktop task title still selects that task.
- Chemical/fertilizer tasks, including other task types with chemical/fertilizer cost items, open the existing editable activity form in completion-review mode. Actual date defaults to today; the planned date is retained on the saved activity. Quantity, cost, stock mode, project, notes and photos can be reviewed before the explicit confirmation button.
- Confirmation updates the existing canonical activity. It does not add a second activity or open another completion dialog. Cancelling changes no task status, cost or stock. Existing experiment-draft guards and completed-task resubmission guards apply.

## Browser checks

Used an isolated loopback preview on port 4180 with synthetic data only. Original preview on port 4178 and its unfinished drafts were left untouched. No cloud, production or hardware calls were made.

| Check | Observed result |
| --- | --- |
| Crop history circle -> material review -> cancel | Fertilizer remains planned; recorded/planned counts 6/4; cycle cost remains 2,815 baht; stock remains 53 bags plus 25 kg open. |
| Link existing planned activity to project | Project becomes 1/2 completed; project cost remains 350 baht. |
| Project circle -> actual material review | Shows today's actual date and selected existing project; requires a stated price for the legacy sample row. |
| Confirm 0.2 bag at 650 baht/bag | Saves 130 baht once; project 350 -> 480; cycle 2,815 -> 2,945. |
| Stock after confirmation | Sealed stock remains 53 bags; opened stock 25 -> 15 kg (10 kg consumed). |
| Saved activity details | Original planned date 27 Nov retained; actual date 25 Nov; 0.2 bag / 10 kg / 130 baht; project and crop round retained. |
| Reload | Cycle total still 2,945, recorded/planned counts 7/3, one newly completed fertilizer activity. |
| Ordinary project task | Added synthetic mowing task, used mobile circle, recorded note and completed without photo; project becomes 3/3, cost remains 480. |
| Plot-wide history | Same circle/detail separation; completed fertilizer shown under actual date and round 2; water circle opens completion; cancel leaves planned work intact. |
| Desktop | 1440 x 940; circle and detail targets remain separate. |
| Mobile | 390 x 844; document width 390; history and selected-project circle hit areas are 44 x 44; quantity form and confirmation usable. |
| Browser errors | Empty final error log. |

Screenshots saved and visually inspected:

- [Crop history desktop](history-desktop.jpg)
- [Crop history mobile](history-mobile.jpg)
- [Project desktop](project-desktop.jpg)
- [Project mobile](project-mobile.jpg)
- [Material review mobile](review-mobile.jpg)
- [Saved material details](material-saved-detail.jpg)
- [Plot-wide history desktop](plot-history-desktop.jpg)

Visual QA found and corrected two issues: the inspection form helper overwrote the confirmation label, and the mobile project tree hid the new circle with its desktop-only container. The final screenshots/readback verify both corrections. Viewport override reset and temporary QA tab closed.

## Automated verification and limits

`npm run check`: **662 passed, 0 failed**, relay **9/9**. `git diff --check`: passed (line-ending notices only). Five new regression tests cover material routing without mutations, ordinary routing and terminal/closed states, accessible escaped markup, project membership/draft guards and stale completed-form resubmission. Existing financial/stock and history tests remain green.

Validation is local, synthetic and single-browser. Live cloud synchronization and simultaneous-device updates are outside this check. Existing task editing/return-to-plan actions remain the explicit path for corrections; completed circles do not undo stock usage.

Deployment: **NOT_DEPLOYED**. No commit, push, merge, production, configuration, secret or hardware changes.
