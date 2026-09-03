# FARMULTIMATE Collaboration Status

- Updated: `2026-09-03 Asia/Bangkok`
- State: `FEATURE_BRANCH_PUBLISHED_RAW_REMOTE_CLEANUP_REQUIRED`
- Production branch: `master`
- Integration branch: `develop` — `NOT_PUBLISHED`
- Local baseline branch: `pick/collab-baseline-prep-20260902`
- Remote feature branch: `origin/pick/collab-baseline-prep-20260902`
- Baseline parent: current `origin/master` at `33ce343`
- Functional baseline commit: `c7b92e3`
- Codex relay branch: `pick/codex-relay-setup` — `HANDSHAKE_VERIFIED_TASK_QUEUED`
- Folk handshake: `VERIFIED` on `origin/folk/codex-relay` at `d029570`
- Current relay task: `FOLK-001` — read-only Master Map code/test audit
- Codex host discovery: `local` only; Folk is not currently a directly addressable host
- Raw source branch: `sucha/sensor-phase1-local` — `LOCAL_ONLY_DO_NOT_PUSH`
- Legacy remote raw branch: `origin/sucha/sensor-phase1-local` at `9674741` —
  `QUARANTINE_NEEDS_EXPLICIT_REMOVAL_APPROVAL`
- Production deploy trigger: push to `master`
- Working tree after baseline commit: expected `CLEAN`
- Feature-branch push and remote hash readback: `PASS`
- Deployment performed by baseline preparation: `NO`

## Validation

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

## Current Work Queue

| Area | Owner | Branch | Status | Notes |
|---|---|---|---|---|
| Sanitized shared baseline | Pick + SUCHA | `pick/collab-baseline-prep-20260902` | `REMOTE_PUBLISHED` | Functional baseline `c7b92e3`; no raw private lineage |
| Codex relay handshake | SUCHA ↔ Folk | `pick/codex-relay-setup` / `folk/codex-relay` | `FOLK_REPLY_REMOTE_VERIFIED` | Folk commit `d029570` matches the owner-provided hash; acknowledgement prepared |
| FOLK-001 Master Map code/test audit | Folk | `folk/codex-relay` (report only) | `AWAITING_FOLK_RESULT` | Read-only product audit; no implementation, current visual QA or field-survey claim |
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

Folk fetches and reads `origin/pick/codex-relay-setup`, processes only task
`FOLK-001` (`d208721b-9ce3-4a61-ba5a-48b473ac9bec`), and prepares one report
reply on `folk/codex-relay`. Reply publication still requires human approval
on Folk's machine. The relay does not remove the separate requirement for
`APPROVE_RAW_REMOTE_REMOVAL` before baseline cleanup and approved `develop`
publication. No product implementation, pull request, `master` push,
deployment, or hardware action is authorized by the task message.
