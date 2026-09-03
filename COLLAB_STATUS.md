# FARMULTIMATE Collaboration Status

- Updated: `2026-09-03 Asia/Bangkok`
- State: `FEATURE_BRANCH_PUBLISHED_RAW_REMOTE_CLEANUP_REQUIRED`
- Production branch: `master`
- Integration branch: `develop` — `NOT_PUBLISHED`
- Local baseline branch: `pick/collab-baseline-prep-20260902`
- Remote feature branch: `origin/pick/collab-baseline-prep-20260902`
- Baseline parent: current `origin/master` at `33ce343`
- Functional baseline commit: `c7b92e3`
- Codex relay branch: `pick/codex-relay-setup` — `LINK_PREFLIGHT_REVIEWED_FOLLOWUP_PREPARED_LOCAL`
- Folk handshake: `VERIFIED` on `origin/folk/codex-relay` at `d029570`
- Completed relay task: `FOLK-001` — `ACCEPTED_CODE_TEST_AUDIT_ONLY`
- Product audit task: `FOLK-002` — `PUBLISHED_PENDING_FOLK_RESULT`; not reissued
- Next link task: `FOLK-LINK-002` — existing-task ingress verification; `PREPARED_LOCAL_NOT_PUBLISHED`
- Latest verified Folk report commit: `b67bb4e165d304e6685fdd830b2b25ebafa7768e`
- Previous SUCHA publication: `2cbb09142e14294cccade47d2c7abe908a1ddb26` — `REMOTE_VERIFIED`
- Product implementation: `BLOCKED_WAITING_FOR_BASELINE`; fetched `origin/develop` is absent
- Current link ACK/task publication: `NEEDS_APPROVE_FEATURE_PUSH`; no new push performed in this review
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

## FOLK-001 Review Snapshot — 2026-09-03

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
  Both messages were subsequently published in `2cbb091`; remote hash readback passed.
- Scope of this SUCHA commit: this status file and two new SUCHA relay messages.
- Safety: `DATA_ONLY / SAFE_OFF / output_control_allowed=false / NOT_DEPLOYED`.

## Direct-Link Review — 2026-09-03

- New report: `56bd0199-0fa7-40d9-8222-860602a7f780`, task `FOLK-LINK-PREFLIGHT-001`.
  `reply_to=null` reflects the human copy/paste assignment; no previous ACK exists.
- Folk commit `b67bb4e165d304e6685fdd830b2b25ebafa7768e` matches the user-provided hash
  and adds exactly one Folk message to `c75a58e`; no product file changed.
- Incoming relay validation: `4/4 PASS`; report diff whitespace check: `PASS`.
- Verdict: `ACCEPTED_STATUS_ONLY`; direct connection: `BLOCKED_MISSING_COMPONENT`.
- Folk CLI `0.131.0`, absent sshd, draft syntax/privacy checks: `FOLK_REPORTED`.
  Ignored `.freebuff` artifacts are not in the remote tree and were not independently reviewed.
- SUCHA independently verified CLI `0.153.0-alpha.5`, SSH client `9.5p2`, no sshd
  command/service and only host `local`. Help exposes `queue --thread/--message`,
  proxy and WebSocket authentication; this is not proof of desktop-task delivery.
- Read-only `codex app-server daemon version`: exit 1, daemon lifecycle supports Unix only.
  Foreground app-server support and existing-task ingress are separate questions.
- Live connection, auto-wake, replay/reconnect and authorization tests: `NOT_RUN`.
  No current visual/cloud/hardware tests were performed; no listener or scheduler started.
- The user still wants direct communication. A Git watcher has not been selected as
  an equivalent substitute and conveys no established auto-wake capability.
- ACK: `b94fec82-1381-4996-905d-521a08962baf`, no response required.
- One new task: `FOLK-LINK-002`, message `29faf594-950b-4bd1-9ca3-4c7906cf84c2`.
  Owner Folk; read-only installed-CLI/ingress evidence and an activation proposal only.
  Product ownership remains unchanged; `FOLK-002` is still pending separately.
- Local evidence: `.freebuff/sucha-link-preflight-001/PREFLIGHT_REVIEW.md` (ignored).
- Outgoing link ACK/task: `PREPARED_LOCAL_NOT_PUBLISHED`; approval required before push.
- Safety remains `DATA_ONLY / SAFE_OFF / output_control_allowed=false / NOT_DEPLOYED`.

## Current Work Queue

| Area | Owner | Branch | Status | Notes |
|---|---|---|---|---|
| Sanitized shared baseline | Pick + SUCHA | `pick/collab-baseline-prep-20260902` | `REMOTE_PUBLISHED` | Functional baseline `c7b92e3`; no raw private lineage |
| Codex relay handshake | SUCHA ↔ Folk | `pick/codex-relay-setup` / `folk/codex-relay` | `FOLK_REPLY_REMOTE_VERIFIED` | Folk commit `d029570` matches the owner-provided hash; acknowledgement prepared |
| FOLK-001 Master Map code/test audit | Folk; SUCHA reviewer | `folk/codex-relay` (report only) | `ACCEPTED` | Independently verified code/test evidence; current visual and field checks remain unverified |
| FOLK-002 cloud pond session-boundary audit | Folk; SUCHA reviewer | `folk/codex-relay` (report only) | `PUBLISHED_PENDING_FOLK_RESULT` | Existing task preserved; not started during Folk link preflight and not reissued |
| SUCHA FOLK-001 ACK and FOLK-002 dispatch | SUCHA | `pick/codex-relay-setup` | `REMOTE_VERIFIED` | Published `2cbb091`; matching remote hash verified |
| FOLK-LINK-PREFLIGHT-001 | Folk; SUCHA reviewer | `folk/codex-relay` (report only) | `ACCEPTED_STATUS_ONLY` | Report `b67bb4e` verified; direct connection remains blocked; Folk local drafts unreviewed |
| FOLK-LINK-002 ingress verification | Folk; SUCHA reviewer | `folk/codex-relay` (report only) | `PREPARED_LOCAL_NOT_PUBLISHED` | Inspect installed CLI/desktop-task ingress; no installation, service start or message injection |
| SUCHA link ACK and follow-up dispatch | SUCHA | `pick/codex-relay-setup` | `NEEDS_APPROVE_FEATURE_PUSH` | Two new SUCHA messages plus status; ignored local preflight evidence excluded |
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
Folk can process `FOLK-LINK-002` (`29faf594-950b-4bd1-9ca3-4c7906cf84c2`)
once. Preserve the existing pending `FOLK-002`; do not repeat completed reports
or handshake. Prepare evidence and one concrete activation proposal, then
seek separate human approvals on the affected machines before system changes.
The relay authorizes no listener, SSH installation, scheduler, firewall change,
product implementation, branch deletion, develop creation, merge, deployment
or hardware action.
