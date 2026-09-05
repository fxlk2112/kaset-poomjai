# FARMULTIMATE Collaboration Status

- Updated: `2026-09-05 Asia/Bangkok`
- State: `BASELINE_READY`
- Development approval: `APPROVE_FARMULTIMATE_DEV_SETUP_ONCE`
- Production branch: `master` at `0e2dbbaa4d170f4864d230b8d2a7169f6c65cadd`
- Integration branch: `develop` — `REMOTE_VERIFIED` at `40721b5bfa71670ea97aba0d247e5616277c018a`
- Integration preparation branch: `pick/integration-baseline-v2` — `REMOTE_VERIFIED` at the same branch head
- Functional baseline commit: `0ac5b826b5cf8b16b5b2b9ec81194273f27bd11a`
- Merge source: `origin/master` + `origin/pick/codex-relay-setup` at `d03b82c5cda86031d1dac07e47707f755002edff`
- Raw source branch: `sucha/sensor-phase1-local` — `PRESERVED / LOCAL_ONLY_DO_NOT_PUSH`
- Production deployment: `RELEASE_CANDIDATE_PREPARED / NOT_DEPLOYED`

## Release Candidate 2026-09-05

- Release branch: `pick/release-develop-40721b5`.
- Release input: `origin/master@0e2dbbaa4d170f4864d230b8d2a7169f6c65cadd` plus `origin/develop@40721b5bfa71670ea97aba0d247e5616277c018a`.
- Public readback exposed a newer untracked static build, `farmult-v110-cycle-auto`. Its five changed text assets and referenced app icon were recovered before integration so the release does not silently remove deployed functionality.
- Conflicts in `index.html`, `js/app.js` and `sw.js` were resolved by keeping the reviewed direct-open integration shell, preserving the deployed cycle/task improvements, loading Map/Telemetry modules, and retaining `DATA_ONLY / SAFE_OFF` guards.
- Release cache identity: `farmult-v111-release-40721b5`.
- Local validation: `70/70 PASS`; desktop `1280 x 720` and mobile `390 x 844` Home/Water views pass with zero console/page errors and no horizontal overflow.
- Public `/api` and `/api/health` currently return the static HTML shell, so the production Pages Function and `FARMULTIMATE_API` binding are not yet verified.
- Merge to `master` remains locked until `APPROVE_PRODUCTION_DEPLOY`.

## Baseline V2 Result

- Master commerce/auth changes and the reviewed Farm/Map/Telemetry baseline are merged in an isolated worktree.
- Conflict resolution completed for `index.html`, `js/app.js` and `sw.js`; no unmerged path remains.
- Deployed runtime uses same-origin `/api`. A Pages Function forwards requests through the `FARMULTIMATE_API` Service Binding and fails closed when unavailable.
- Farm and Commerce remain parts of one static app, one repository, one integration branch and one release.
- Feature ownership is defined in `docs/FEATURE_OWNERSHIP.md`.
- Same-origin architecture and its release gate are defined in `docs/SAME_ORIGIN_API.md`.

## Validation

- `npm run check`: `64/64 PASS`, zero failed/skipped.
- UTC runner reproduction after timezone fix: `64/64 PASS`.
- GitHub Actions `npm-check`: `PASS`, code run `33950163815` and status run `33950212687`.
- Relay tree on the integration worktree: `9 messages PASS`.
- Incoming `origin/folk/codex-relay`: `6 messages PASS`.
- Git conflict markers/unmerged paths: `NONE`.
- Desktop browser `1280 x 720`: Home and Master Map `PASS`; no horizontal overflow.
- Mobile browser `390 x 844`: Master Map and Stock `PASS`; no horizontal overflow.
- Browser console warnings/errors: `0`.
- Current production Service Binding and deployed `/api` response: `NOT_TESTED / NOT_DEPLOYED`.
- Field geometry/survey: `NOT_SURVEYED`.
- Hardware output/commissioning: `NOT_RUN`.

## Relay Review

- Folk report `21b91065-5089-4878-b679-489c19426280` replies once to `29faf594-950b-4bd1-9ca3-4c7906cf84c2` and was already acknowledged by SUCHA message `5629206a-d0ea-4c77-8c27-29644b44695b`.
- Folk blocker `4a6cfff6-3b4c-4b9f-ab12-06696d4738e1` was already covered by that ACK and requires no duplicate acknowledgement.
- Direct Codex ingress remains optional and blocked. Git feature branches and Pull Requests are the active collaboration channel.
- Old handshake, FOLK-001 and link reports must not be reissued.

## Ownership and Locks

| Area | Owner | Current lock |
|---|---|---|
| Farm / Map / Planner / Analytics / Water / Telemetry | Pick + SUCHA | `AVAILABLE_BY_TASK_LOCK` |
| Stock / Sales / Products / Import / Market Price | Folk | `READY_FROM_ORIGIN_DEVELOP` |
| Shared shell / contracts / CI / release preparation | SUCHA | `AVAILABLE_BY_TASK_LOCK` |
| `master` and Cloudflare production | Pick approval | `LOCKED_NEEDS_APPROVE_PRODUCTION_DEPLOY` |

## Development Push Policy

The one-time development approval authorizes publication of this reviewed baseline and routine pushes to owner feature branches under `docs/FEATURE_OWNERSHIP.md`. Future work uses Pull Requests into `develop`. It does not authorize direct routine pushes to `develop`, changes to `master`, production binding/deploy, secret/config writes, branch/data deletion or hardware action.

## Remaining External Setup

- Branch protection is active on `develop` and `master`; PR #2 independently demonstrated one required human approval and required `npm-check` enforcement.
- Configure and independently read back the Pages `FARMULTIMATE_API` Service Binding during the approved production release.

## Safety

`DATA_ONLY / SAFE_OFF / output_control_allowed=false / Raspberry Pi 5 sole writer / NOT_DEPLOYED`

## Next Action

Push `pick/release-develop-40721b5` and open one release PR into `master`; merge/deploy only after `APPROVE_PRODUCTION_DEPLOY` and production binding readiness are confirmed.
