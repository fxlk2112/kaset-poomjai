# FARMULTIMATE Collaboration Status

- Updated: `2026-09-05 Asia/Bangkok`
- State: `BASELINE_READY`
- Development approval: `APPROVE_FARMULTIMATE_DEV_SETUP_ONCE`
- Legacy Pages branch: `master` at `0e2dbbaa4d170f4864d230b8d2a7169f6c65cadd`; unchanged by this release.
- Integration branch: `develop` — `REMOTE_VERIFIED` at `40721b5bfa71670ea97aba0d247e5616277c018a`.
- Integration preparation branch: `pick/integration-baseline-v2` — `REMOTE_VERIFIED` at the same branch head
- Functional baseline commit: `0ac5b826b5cf8b16b5b2b9ec81194273f27bd11a`
- Merge source: `origin/master` + `origin/pick/codex-relay-setup` at `d03b82c5cda86031d1dac07e47707f755002edff`
- Raw source branch: `sucha/sensor-phase1-local` — `PRESERVED / LOCAL_ONLY_DO_NOT_PUSH`
- Active release: `OWNER-MAIN-001`, owner SUCHA, branch `pick/owner-main-develop-40721b5`.
- Approved target: existing Worker `flytech-farmultimate-owner-staging`; Pick explicitly selected it as the main app on 2026-09-05, replacing the Pages URL for day-to-day use.
- Release source: `origin/develop@40721b5bfa71670ea97aba0d247e5616277c018a`.
- Production deployment: `OWNER_MAIN_DEPLOYED / READBACK_VERIFIED`.
- Main URL: https://flytech-farmultimate-owner-staging.pongnarin-pa.workers.dev/
- Deployed release commit: `8674b1d8c46efc0cdaa317a5cb4ac2a0aa46e17f`; Worker version: `329c90e5-7298-499d-9ab6-54bdf8774d7f`.
- Scope lock: owner frontend Worker entry/config, allowlisted asset packaging, deployment runtime configuration, service-worker cache, release tests/docs and status. Existing API Worker, database schema/data and actuator control are outside this release.
- Existing frontend rollback version: `f062eb54-7ef1-481f-80a1-9ec40752a848`.
- Existing API: `flytech-farmultimate-api-canary@87ab09f5-1da5-43b3-81c1-30c5a858b11f`; authenticated readback confirms `OUTPUT_CONTROL_ENABLED=false`. It has D1 and no R2 photo binding.
- Owner-main preflight: `75/75 PASS`, relay `9 messages PASS`, Wrangler dry-run/type generation pass; `37` public asset files, zero forbidden source paths or secret-scan hits.
- Browser QA: desktop `1280 x 720`, mobile `390 x 844` Home/Map/Pond/Stock inspected; no horizontal overflow, console errors or page errors. Local gateway health and forecast asset both return HTTP 200. Production runtime simulation confirms same-origin `/api` and preserved `owner-canary` storage namespace.
- Independent live readback: `/build.json` matches both source commits; eight core asset hashes match the staged release. GET `/api/health`, POST `/api` health and forecast JSON return HTTP 200. Both live browser viewports pass with same-origin API, preserved session namespace and zero console/page errors.
- Service binding readback: `FARMULTIMATE_API` points to the existing canary; the API deployment version remains unchanged. No hardware or authenticated business-data writes were performed by release validation.
- Known limits: live field telemetry and authenticated cloud writes are unverified; the existing API has no R2 photo binding. Screenshots use an empty, isolated browser context. Home has a pre-existing narrow empty-state caption on mobile; this release does not change its layout.

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
- Owner main Service Binding and deployed `/api`: `READBACK_VERIFIED`; original Pages target remains unchanged.
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
| Shared shell / contracts / CI / release preparation | SUCHA | `OWNER-MAIN-001 DEPLOYED`; source integration PR pending normal review |
| Owner main Cloudflare Worker | Pick + SUCHA | `OWNER_APPROVED / DEPLOYED / SAFE_OFF` |
| Legacy `master` and Pages | Existing owners | `UNCHANGED / PR4_SUPERSEDED_TARGET` |

## Development Push Policy

The one-time development approval authorizes publication of this reviewed baseline and routine pushes to owner feature branches under `docs/FEATURE_OWNERSHIP.md`. Future work uses Pull Requests into `develop`. It does not authorize direct routine pushes to `develop`, changes to `master`, production binding/deploy, secret/config writes, branch/data deletion or hardware action.

## Remaining External Setup

- GitHub protected-branch review remains required for source integration. The authenticated SUCHA account has write permission; no protected branch was changed by this owner-approved Worker release.
- Original Pages configuration and its repository-owner dependencies are not part of the selected main app target.

## Safety

`FRONTEND_DEPLOYED / DATA_ONLY / SAFE_OFF / output_control_allowed=false / Raspberry Pi 5 sole writer / BACKEND_UNCHANGED / HARDWARE_NOT_COMMISSIONED`

## Next Action

Use the owner main URL. Integrate the deployment tooling through the normal `develop` PR workflow; future product changes still use separate owner branches and the shared integration source.
