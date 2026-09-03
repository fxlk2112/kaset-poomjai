# FARMULTIMATE Collaboration Status

- Updated: `2026-09-03 Asia/Bangkok`
- State: `FEATURE_BRANCH_PUBLISHED_RAW_REMOTE_CLEANUP_REQUIRED`
- Production branch: `master`
- Integration branch: `develop` — `NOT_PUBLISHED`
- Local baseline branch: `pick/collab-baseline-prep-20260902`
- Remote feature branch: `origin/pick/collab-baseline-prep-20260902`
- Baseline parent: current `origin/master` at `33ce343`
- Functional baseline commit: `c7b92e3`
- Codex relay branch: `pick/codex-relay-setup` — `REVIEW_COMPLETE_NEXT_AUDIT_PREPARED_LOCAL`
- Folk handshake: `VERIFIED` on `origin/folk/codex-relay` at `d029570`
- Completed relay task: `FOLK-001` — `ACCEPTED_CODE_TEST_AUDIT_ONLY`
- Next relay task: `FOLK-002` — read-only cloud pond session-boundary audit; `PREPARED_LOCAL_NOT_PUBLISHED`
- Latest verified Folk report commit: `c75a58e51bb7661bafc4ac9427e6f7dcb2f18b75`
- Product implementation: `BLOCKED_WAITING_FOR_BASELINE`; fetched `origin/develop` is absent
- Current ACK/task publication: `NEEDS_APPROVE_FEATURE_PUSH`; no push performed in this review
- Codex host discovery: `local` only; Folk is not currently a directly addressable host
- Raw source branch: `sucha/sensor-phase1-local` — `LOCAL_ONLY_DO_NOT_PUSH`
- Legacy remote raw branch: `origin/sucha/sensor-phase1-local` at `9674741` —
  `QUARANTINE_NEEDS_EXPLICIT_REMOVAL_APPROVAL`
- Production deploy trigger: push to `master`
- Working tree after baseline commit: expected `CLEAN`
- Feature-branch push and remote hash readback: `PASS`
- Deployment performed by baseline preparation: `NO`

## Historical Baseline Validation

These baseline results predate the current relay review. They are not fresh
desktop/mobile evidence for FOLK-001 or FOLK-002.

- `npm run check`: `56/56 PASS`
- Node SQLite migration validation: `PASS`
- `schema4.sql`: market-price history preserved from master
- `schema5.sql`: replay-safe Phase 1 telemetry schema
- Unsafe telemetry output flag rejected by database constraint: `PASS`
- Added-line credential/private endpoint/location scan: `PASS`
- PNG metadata scan: `PASS`
- Desktop browser: `1280 x 720`, no horizontal overflow, no console warning/error
- Mobile browser: `390 x 844`, no horizontal overflow, no console warning/error
- E5, pond handoff, G/J correction, Home, Stock, and Water navigation: `PASS`
- Codex relay tests: `4/4 PASS`; total Node tests: `60/60 PASS`
- Incoming Folk relay validation: `2/2 PASS`; one new handshake and no product code changes
- Outgoing SUCHA relay validation: `3/3 PASS`; initial handshake plus acknowledgement and one task
- Relay transport: Git only; no LAN listener or firewall change

## Current Relay Review — 2026-09-03

- Incoming message `0a10ab1e-fd33-4535-8232-e5b77ec60a87` replies to task
  `d208721b-9ce3-4a61-ba5a-48b473ac9bec`; no earlier SUCHA ACK matched this result.
- Handshake `38efdaac-6716-4dae-92e8-868aaef9ba24` already has ACK
  `74ff8811-85d4-4218-af31-1c69c6901f17`; it was not acknowledged again.
- Report source `d029570d619b191bb6d2e25a4c7f7be0ba8300d8` is an ancestor of
  report commit `c75a58e51bb7661bafc4ac9427e6f7dcb2f18b75`.
- The report commit adds exactly one Folk message and no product code.
- Audited product code, tests and check command match SUCHA's starting
  `ca9acdd260afc9351ca946096430bef947627b7f`; only collaboration metadata differs.
- Independent `npm run check`: `60/60 PASS`, zero failures/skips.
- Incoming relay validation: `3/3 PASS`; outgoing local relay: `5/5 PASS`.
- Verdict: `ACCEPTED` within the FOLK-001 code/test scope; `NEEDS_REVISION: NONE`.
- Current desktop/mobile visual QA: `NOT_RUN`. Field geometry: `NOT_SURVEYED`.
  Polygon constants and code wiring do not establish field accuracy or browser behavior.
- Product implementation remains `BLOCKED_WAITING_FOR_BASELINE`; state is not
  `BASELINE_READY` and `origin/develop` is absent. No substitute baseline is used.
- ACK `5be03e68-78b4-4629-a8aa-8ca483bd43a1` closes FOLK-001 without requesting a reply.
- Task `8a9409c6-d97c-4be0-9cf3-97582177ba7d` assigns only FOLK-002 to Folk.
  Both new messages are local and await human-approved feature publication.
- Scope of this SUCHA commit: this status file and two new SUCHA relay messages.
- Safety: `DATA_ONLY / SAFE_OFF / output_control_allowed=false / NOT_DEPLOYED`.

## Current Work Queue

| Area | Owner | Branch | Status | Notes |
|---|---|---|---|---|
| Sanitized shared baseline | Pick + SUCHA | `pick/collab-baseline-prep-20260902` | `REMOTE_PUBLISHED` | Functional baseline `c7b92e3`; no raw private lineage |
| Codex relay handshake | SUCHA ↔ Folk | `pick/codex-relay-setup` / `folk/codex-relay` | `FOLK_REPLY_REMOTE_VERIFIED` | Folk commit `d029570` matches the owner-provided hash; acknowledgement prepared |
| FOLK-001 Master Map code/test audit | Folk; SUCHA reviewer | `folk/codex-relay` (report only) | `ACCEPTED` | Independently verified code/test evidence; current visual and field checks remain unverified |
| FOLK-002 cloud pond session-boundary audit | Folk; SUCHA reviewer | `folk/codex-relay` (report only) | `PREPARED_LOCAL_NOT_PUBLISHED` | Source `c75a58e`; only one new Folk relay JSON may be written; product ownership unchanged |
| SUCHA FOLK-001 ACK and FOLK-002 dispatch | SUCHA | `pick/codex-relay-setup` | `NEEDS_APPROVE_FEATURE_PUSH` | Two new SUCHA messages plus this status file; no push yet |
| Raw dashboard source | Pick + SUCHA | `sucha/sensor-phase1-local` | `LOCAL_ONLY_DO_NOT_PUSH` | Preserved as evidence and recovery source |
| Legacy raw remote | Pick approval required | `origin/sucha/sensor-phase1-local` | `QUARANTINED_NEEDS_REMOVAL_APPROVAL` | Older remote copy contains hard-coded cloud staging host literals; no credential match found by the targeted scan |
| Folk workstation onboarding | Folk | `folk/codex-relay` | `READY_FOR_READ_ONLY_AUDIT` | Handshake verified; product implementation still waits for legacy remote resolution and approved `develop` |

## Hotspot Locks

| File/Area | Owner | Lock state |
|---|---|---|
| Master Map and E1-E5 UI | Pick + SUCHA | `PUBLISHED_BASELINE` |
| Pond telemetry and runtime config | Pick + SUCHA | `PUBLISHED_BASELINE` |
| Stock/Lark integration from master | Pick + SUCHA | `PRESERVED_IN_PUBLISHED_BASELINE` |
| `.github/workflows/deploy.yml` | Pick | `PRODUCTION_GATE_DO_NOT_EDIT` |

## Baseline Checklist

- [x] Classify modified, untracked, and local-history files.
- [x] Scan source work for credentials and private field data.
- [x] Preserve raw work in local checkpoints.
- [x] Create isolated branch from current `origin/master`.
- [x] Squash reviewed dashboard work without importing raw branch history.
- [x] Preserve current master Stock/Lark/mobile UX changes.
- [x] Split the conflicting database migrations into `schema4` and `schema5`.
- [x] Remove private staging configuration and nonessential QA artifacts.
- [x] Run tests, schema validation, privacy scan, and browser QA.
- [x] Receive `APPROVE_FEATURE_PUSH` from Pick.
- [x] Rebase onto the latest `origin/master` and rerun safety validation.
- [x] Push the sanitized feature branch without touching `master`.
- [x] Independently read back the remote feature hash.
- [ ] Remove the legacy remote raw branch after explicit destructive-action approval.
- [ ] Review the remote branch and create approved `develop`.
- [ ] Change state to `BASELINE_READY` after approved `develop` publication and readback.

## Next Action

Request `APPROVE_FEATURE_PUSH` from Pick for this reviewed local relay commit
on `pick/codex-relay-setup`. After approved publication and remote readback,
Folk can fetch and process only `FOLK-002`
(`8a9409c6-d97c-4be0-9cf3-97582177ba7d`) once. Do not repeat the handshake or
FOLK-001. Folk writes one report on its own relay branch and separately asks
the human on that machine for feature-push approval. Existing baseline and
raw-remote approval gates remain open; this relay authorizes no product
implementation, branch deletion, develop creation, merge, deployment or
hardware action.
