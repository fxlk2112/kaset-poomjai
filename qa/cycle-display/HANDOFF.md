# Attachment dates and actual crop-cycle work

- Owner: Codex for Folk; explicit user-requested Farm/Project follow-up. SUCHA retains integration review.
- Branch: `codex/cycle-execution-file-dates`, source `43e5902`; refreshed `origin/develop` verified as ancestor.
- Task / Scope: Fix invalid/missing attachment-date display and include partial/unsuccessful actual work in the crop-cycle overview. Verify that cost/stock remain single-counted; preserve seven incomplete entries.
- Files changed: `js/project-records.js`, scoped `cycleJourneyHtml` in `js/app.js`, `index.html`, `sw.js`, `tests/cycle-display-integrity.test.cjs`, this evidence directory and `COLLAB_STATUS.md`.
- Commit: Feature commit containing this handoff (`git log -1 --format=%h -- qa/cycle-display/HANDOFF.md`).
- Validation: **824 tests PASS, 0 FAIL; relay 9 PASS**; browser desktop/mobile acceptance and persisted local QA reconciliation passed.
- Blocked / Risks: No blocker. Responsive viewport testing is not a physical-phone test. No production readback was attempted because deployment was explicitly excluded.
- Deployment: **NOT_DEPLOYED**. No production-account writes, backend changes, schema migration, hardware actions or changes to the canonical cost/stock mutation logic.
- Next action: SUCHA reviews this feature branch into `develop`.

## Behavior

- Attachment dates that are absent, empty, invalid or of an unsupported type display **ไม่ระบุวันที่แนบ**. Valid timestamps retain their actual Thai-formatted date. Blank authors no longer produce an empty separator. The renderer does not populate or change source metadata.
- The cycle overview uses the existing actual-execution predicate and distinguishes **ทำสำเร็จ**, **ทำบางส่วน**, and **ทำแล้วแต่ผลไม่เป็นไปตามเป้า**. Both the summary and care/harvest milestones include actual partial work.
- A milestone with partial or unsuccessful work uses a clock instead of a success tick. Failed work without a recorded actual execution remains excluded; planned work stays separate. Planned harvesting is not counted as a care plan.
- UI asset/cache versions updated for a future release only. No deployment performed.

## Tests and evidence

- Four focused regressions cover missing/invalid/valid file dates, partial/full unsuccessful execution, mixed care/harvest/planned/unperformed outcomes, and repeated render/save/reload without changing the financial ledger or seven incomplete fixtures.
- An initial test fixture comparison found existing load-time defaults (`doneNote`, `doneTime`, `wateringSessions`). The test now initializes the fixture through the normal save/load path before taking its baseline; no application migration or source-data change was needed.
- Isolated loopback-only QA at **1440 × 1000** and **390 × 844**, using the shipped handlers with local SQLite/R2 adapters. The cycle containing only one partial fertilizer activity displays **ทำบางส่วน 1 งาน · รอทำ 0 งาน** and **50 baht** cost.
- Mobile edit/save still requires confirmation of actual **1 kg / 50 baht**. After confirmation and reload, there is one work record, stock stays **9 kg** and plot/cycle/project each show **50 baht**.
- Persisted local database readback: **LOCAL_DISPLAY_ACCEPTANCE_PASS**. All original fields of seven incomplete synthetic records remain unchanged, including blank dates, null quantities and supported zero costs. Attachment timestamps also remain unchanged. Only existing load-time empty defaults may be added.
- The seven real incomplete worksheet entries were not accessed or modified. No values were inferred. Local server stopped and temporary viewport reset after testing.
- The local QA harness intentionally disallows team-review API calls; the unrelated pending-review card therefore displays “ยังตรวจสอบไม่ได้”. This does not represent a production regression.

Screenshots contain synthetic local QA only:

- [Missing, invalid and valid attachment dates](attachment-dates.jpg)
- [Desktop partial-work overview](desktop-cycle.jpg)
- [Mobile partial-work overview](mobile-cycle.jpg)
- [Mobile stock after repeat save](mobile-stock.jpg)

Raw local sessions, generated harness, test database and account snapshots stay ignored under `tmp/`.
