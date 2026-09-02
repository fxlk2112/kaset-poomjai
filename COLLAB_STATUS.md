# FARMULTIMATE Collaboration Status

- Updated: `2026-09-03 Asia/Bangkok`
- State: `FEATURE_BRANCH_PUBLISHED_RAW_REMOTE_CLEANUP_REQUIRED`
- Production branch: `master`
- Integration branch: `develop` — `NOT_PUBLISHED`
- Local baseline branch: `pick/collab-baseline-prep-20260902`
- Remote feature branch: `origin/pick/collab-baseline-prep-20260902`
- Baseline parent: current `origin/master` at `33ce343`
- Functional baseline commit: `c7b92e3`
- Codex relay branch: `pick/codex-relay-setup` — `REMOTE_HANDSHAKE_READY`
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
- Relay envelope validation: `1/1 PASS`
- Relay transport: Git only; no LAN listener or firewall change

## Current Work Queue

| Area | Owner | Branch | Status | Notes |
|---|---|---|---|---|
| Sanitized shared baseline | Pick + SUCHA | `pick/collab-baseline-prep-20260902` | `REMOTE_PUBLISHED` | Functional baseline `c7b92e3`; no raw private lineage |
| Codex relay handshake | SUCHA → Folk | `pick/codex-relay-setup` | `REMOTE_HANDSHAKE_READY` | One validated handshake request; Git transport only |
| Raw dashboard source | Pick + SUCHA | `sucha/sensor-phase1-local` | `LOCAL_ONLY_DO_NOT_PUSH` | Preserved as evidence and recovery source |
| Legacy raw remote | Pick approval required | `origin/sucha/sensor-phase1-local` | `QUARANTINED_NEEDS_REMOVAL_APPROVAL` | Older remote copy contains hard-coded cloud staging host literals; no credential match found by the targeted scan |
| Folk workstation onboarding | Folk | `folk/codex-relay` | `HANDSHAKE_ALLOWED_FEATURE_WORK_BLOCKED` | Relay handshake may proceed; feature work waits for legacy remote resolution and approved `develop` |

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

Send `docs/FOLK_CODEX_RELAY_PROMPT_TH.md` to Codex on Folk's workstation and
receive a validated handshake on `folk/codex-relay`. The relay does not remove
the separate requirement for `APPROVE_RAW_REMOTE_REMOVAL` before baseline
cleanup and approved `develop` publication. No pull request, `master` push, or
deployment is authorized.
