# FARMULTIMATE Collaboration Status

- Updated: `2026-09-05 Asia/Bangkok`
- State: `BASELINE_READY`
- Development approval: `APPROVE_FARMULTIMATE_DEV_SETUP_ONCE`
- Production branch: `master` at `dba54778aa5043c1d699ec7136d30fd4d18da71c`
- Integration branch: `develop` — `REMOTE_VERIFIED`
- Integration preparation branch: `pick/integration-baseline-v2` — `REMOTE_VERIFIED` at the same branch head
- Functional baseline commit: `0ac5b826b5cf8b16b5b2b9ec81194273f27bd11a`
- Merge source: `origin/master` + `origin/pick/codex-relay-setup` at `d03b82c5cda86031d1dac07e47707f755002edff`
- Raw source branch: `sucha/sensor-phase1-local` — `PRESERVED / LOCAL_ONLY_DO_NOT_PUSH`
- Active release: `OWNER-MAIN-001`, owner SUCHA, branch `pick/owner-main-develop-40721b5`.
- Approved target: existing Worker `flytech-farmultimate-owner-staging`; Pick explicitly selected it as the main app on 2026-09-05, replacing the Pages URL for day-to-day use.
- Release source: `origin/develop@40721b5bfa71670ea97aba0d247e5616277c018a`.
- Production deployment: `OWNER_MAIN_READY_TO_DEPLOY / NOT_DEPLOYED`.
- Scope lock: owner frontend Worker entry/config, allowlisted asset packaging, deployment runtime configuration, service-worker cache, release tests/docs and status. Existing API Worker, database schema/data and actuator control are outside this release.
- Existing frontend rollback version: `f062eb54-7ef1-481f-80a1-9ec40752a848`.
- Existing API: `flytech-farmultimate-api-canary@87ab09f5-1da5-43b3-81c1-30c5a858b11f`; authenticated readback confirms `OUTPUT_CONTROL_ENABLED=false`. It has D1 and no R2 photo binding.
- Owner-main preflight: `75/75 PASS`, relay `9 messages PASS`, Wrangler dry-run/type generation pass; `37` public asset files, zero forbidden source paths or secret-scan hits.
- Browser QA: desktop `1280 x 720`, mobile `390 x 844` Home/Map/Pond/Stock inspected; no horizontal overflow, console errors or page errors. Local gateway health and forecast asset both return HTTP 200. Production runtime simulation confirms same-origin `/api` and preserved `owner-canary` storage namespace.

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

- Branch protection is `BLOCKED_NEEDS_REPOSITORY_ADMIN`: the authenticated SUCHA account has push permission but not repository admin permission. An admin must apply this once to `develop` and `master`: Pull Request required, one human approval, `npm-check`, no force push or deletion.
- Configure the Pages `FARMULTIMATE_API` Service Binding only during an approved production release.

## Safety

`DATA_ONLY / SAFE_OFF / output_control_allowed=false / Raspberry Pi 5 sole writer / NOT_DEPLOYED`

## Next Action

Deploy the committed OWNER-MAIN-001 candidate to the existing owner Worker under Pick's explicit target approval, then independently read the deployed build, API safety flags and desktop/mobile views. Keep the backend and data unchanged.
