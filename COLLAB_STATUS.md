# FARMULTIMATE Collaboration Status

- Updated: `2026-09-02 Asia/Bangkok`
- State: `LOCAL_SANITIZED_BASELINE_READY_FOR_OWNER_REVIEW`
- Production branch: `master`
- Integration branch: `develop` — `NOT_PUBLISHED`
- Local baseline branch: `pick/collab-baseline-prep-20260902`
- Baseline parent: current `origin/master` at `86a2780`
- Raw source branch: `sucha/sensor-phase1-local` — `LOCAL_ONLY_DO_NOT_PUSH`
- Production deploy trigger: push to `master`
- Working tree after baseline commit: expected `CLEAN`
- Push performed by baseline preparation: `NO`
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

## Current Work Queue

| Area | Owner | Branch | Status | Notes |
|---|---|---|---|---|
| Sanitized shared baseline | Pick + SUCHA | `pick/collab-baseline-prep-20260902` | `LOCAL_REVIEW_READY` | Squashed onto current master; no raw private lineage |
| Raw dashboard source | Pick + SUCHA | `sucha/sensor-phase1-local` | `LOCAL_ONLY_DO_NOT_PUSH` | Preserved as evidence and recovery source |
| Folk workstation onboarding | Folk | none | `BLOCKED_WAITING_FOR_BASELINE` | Remains blocked until approved branch and `develop` are published |

## Hotspot Locks

| File/Area | Owner | Lock state |
|---|---|---|
| Master Map and E1-E5 UI | Pick + SUCHA | `BASELINE_REVIEW` |
| Pond telemetry and runtime config | Pick + SUCHA | `BASELINE_REVIEW` |
| Stock/Lark integration from master | Pick + SUCHA | `PRESERVED_REVIEW` |
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
- [ ] Receive `APPROVE_FEATURE_PUSH` from Pick.
- [ ] Push the sanitized feature branch without touching `master`.
- [ ] Review the remote branch and create approved `develop`.
- [ ] Change state to `BASELINE_READY` after remote readback.

## Next Action

Owner reviews the local sanitized baseline and, if accepted, grants
`APPROVE_FEATURE_PUSH` for `pick/collab-baseline-prep-20260902` only.
