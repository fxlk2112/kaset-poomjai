# FARMULTIMATE Collaboration Baseline Manifest

- Prepared: `2026-09-02 Asia/Bangkok`
- Source branch: `sucha/sensor-phase1-local`
- Source upstream state after product checkpoint: `ahead 22 / behind 0`
- Source vs current `origin/master`: `26 source-only / 32 master-only`
- Merge base: `a0f7c40f62acc0fb714043fbd247cb7ebdc7f021`
- Publication state: `LOCAL_ONLY_DO_NOT_PUSH_RAW_BRANCH`
- Deployment state: `NOT_DEPLOYED`

## Decision

Do not publish the raw source branch as the collaboration baseline. Production
`master` has advanced independently, and the source lineage contains local/private
runtime metadata that is not needed by a second workstation.

Prepare the shared baseline in an isolated worktree created from the latest
`origin/master`. Bring across the reviewed dashboard work as a squashed change,
exclude private canary/runtime material, resolve overlap deliberately, and run the
full validation suite before requesting any push approval.

## Reviewed local-only commits

### Already present on the feature upstream but not on current master

- `e2bbab7` — local-only sensor telemetry phase 1
- `d5994ed` — graphical reservoir telemetry dashboard
- `0ac7e03` — local sensor preview without blocking login
- `9674741` — full-size capacity gauge

### Source commits ahead of the feature upstream before baseline preparation

- `506bd0b` — telemetry runtime and migration safety
- `b7eec6e` — independent sensor phase-1 QA
- `5a19768` — owner canary configuration
- `63f8613` — local staging owner-canary integration
- `2925c53` — real sensor canary activation notes
- `febe168` — owner real-sensor staging preparation
- `2762fd0` — migration gate hardening
- `382577d` — owner real-sensor staging verification
- `f0d0a8b` — low-water status clarification
- `bd55a24` — low-water wording refinement
- `8ddbf59` — one-minute dashboard refresh
- `59bb8e9` — home/water navigation
- `007ace8` — local Pi-health dashboard
- `a2e877c` — private cloud sensor staging
- `d8bf047` — reservoir graphic driven by water level
- `9cc65fb` — seven calibrated reservoir levels
- `9bd9b43` — graphical pond water balance
- `0845dbe` — live Pi 5 water balance
- `ccfaa8f` — GET-only farm weather forecast
- `8e68d51` — two-machine collaboration workflow

### Baseline-preparation checkpoint

- `43ed0b1` — direct-open Master Map revision C, compact E5, corrected G/J,
  forecast-only model snapshot, regression tests, and desktop/mobile evidence

## Candidate product set

The checkpoint `43ed0b1` contains the reviewed runnable product set:

- `css/style.css`
- `data/weather-models.json`
- `images/farm-map/README.md`
- `images/farm-map/pixel-art-farm-master-v1.png`
- `index.html`
- `js/app.js`
- `js/auth.js`
- `js/farm-map.js`
- `js/sensors.js`
- `js/tests/auth-direct-open.test.mjs`
- `js/tests/farm-map.test.mjs`
- `js/tests/sensors.test.mjs`
- `package.json`
- `qa/implementation-master-map-desktop.png`
- `qa/implementation-master-map-mobile.png`
- `sw.js`

`design-qa.md` is the shareable visual handoff for this set. It contains no
private endpoint or device identity.

## Held outside the shared baseline

These files remain local and must not be staged into the collaboration baseline:

- `docs/CLOUD_STAGING_DEPLOYMENT.md` — contains private deployment endpoints and
  deployment identifiers
- `scripts/capture-design-qa.mjs` — currently targets a private staging host
- `qa/comparison-reference-vs-master-map.png` — optional comparison artifact
- `qa/e5-geometry-preview.png` — local geometry debug artifact
- `qa/e5-source-crop.png` — local source crop
- `qa/reference-booking-desktop-normalized.png` — local reference capture
- `qa/reference-booking-desktop.png` — local reference capture

## Safety and privacy scan

- High-confidence credential/token/private-key matches: `0`
- Added lines in checkpoint `43ed0b1`: no private IP, coordinate, MAC, infra ID,
  credential URL, or Cloudflare host added
- Raw source history contains review-only local endpoint, cloud-host, infrastructure
  ID, and coordinate literals; some equivalents also pre-date this work on master
- Result: raw branch remains `DO_NOT_PUSH`; shared baseline must be a sanitized
  squashed integration branch

## Functional contract

- `DATA_ONLY`
- `SAFE_OFF`
- `output_control_allowed=false`
- Raspberry Pi 5 remains the sole eventual output writer
- Windows/Codex remains supervisory and must not direct-write Modbus
- No pump, valve, relay, commissioning, production write, or deployment is
  authorized by this baseline preparation

## Validation evidence

- `npm run check`: `56/56 PASS`
- Staged added-line privacy scan: `PASS`
- Desktop and mobile Master Map evidence reviewed
- E5 excludes staff accommodation and the pond edge
- G/J correction and pond telemetry handoff covered by tests

## Required reconciliation before a push request

1. Create an isolated local worktree from current `origin/master`.
2. Apply the reviewed source work as a squash; do not publish raw history.
3. Preserve current master product/stock changes while resolving shared-file
   overlaps.
4. Omit private canary/runtime files and local-only reference artifacts.
5. Remove new hard-coded private endpoints and location defaults from the shared
   diff.
6. Run syntax/tests, privacy scan, diff review, and desktop/mobile readback.
7. Only then request `APPROVE_FEATURE_PUSH` for the sanitized feature branch.

## Reconciliation result

- Local integration branch: `pick/collab-baseline-prep-20260902`
- Parent: current `origin/master` at `33ce343`
- Method: local squash into an isolated worktree; raw source history was not
  attached to the integration branch
- Conflicts resolved: `.gitignore`, `css/style.css`, `index.html`, `js/app.js`,
  `js/auth.js`, `js/lark.js`, `sw.js`, `worker/schema4.sql`, and
  `worker/src/lark.js`
- Master behavior preserved: Stock/Lark sync, R2 photo route, market-price
  history, mobile UX, Home, and current navigation
- Dashboard behavior added: direct-open shell, read-only pond telemetry, Master
  Map revision C, compact E5, corrected G/J, reservoir graphics, and forecast-only
  weather model comparison
- Migration collision resolved: the existing market schema remains `schema4.sql`;
  Phase 1 telemetry is now the replay-safe `schema5.sql`
- Private staging endpoints, canary configuration, machine LAN endpoints, and
  nonessential local QA artifacts were excluded
- Runtime private integrations now fail closed unless an approved machine-local
  configuration is injected before `js/runtime-config.js` loads
- Before publication, the baseline was refreshed onto the latest master commit
  `33ce343`; the two cache/version conflicts in `index.html` and `sw.js` were
  reconciled without changing the deployment workflow
- Functional baseline commit: `c7b92e3`
- Final state: `FEATURE_BRANCH_PUBLISHED_AWAITING_DEVELOP_APPROVAL`

### Reconciliation validation

- JavaScript syntax and Node tests: `56/56 PASS`
- SQLite migration sequence and schema5 replay via Node SQLite: `PASS`
- Unsafe `output_control_allowed=1` database insert: `REJECTED`
- Added-line privacy scan: `PASS`
- PNG metadata scan across 12 product/evidence assets: `PASS`
- Browser desktop `1280 x 720`: `PASS`
- Browser mobile `390 x 844`: `PASS`
- E5 selection, pond handoff, Home/Stock/Water preservation: `PASS`
- Browser console warnings/errors: `0`
- Feature-branch push and remote hash readback: `PASS`
- Deploy: `NO`
