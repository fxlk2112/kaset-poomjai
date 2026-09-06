# Owner health and weather dashboard

Task `OWNER-MONITOR-001`, owner SUCHA, branch `pick/owner-health-weather-v1`.
Integration source `40721b5`; prior owner release checkpoint `2b4658a` (PRs #5 and #6 dependencies).

The owner requested publishing the existing Pi 5/Pi Zero health dashboard and existing weather forecast on the same main app. Two prominent buttons above the plot map open separate pages: **สภาพอากาศ** and **สุขภาพระบบ**. They remain available when a plot is selected. Each page has a return-to-map button; the map's pond page focuses on water and links to the other pages. Health includes temperature, system load, uptime and 24-hour/7-day charts. The weather page retains the existing 10-model comparison and rain windows, identifies forecasts separately from station observations, and hides expired predictions.

## Data path

- Pi health: existing Pi SQLite database opened read-only → additive `sucha-owner-monitor.timer` every minute → outbound HTTPS → existing owner frontend Worker → new bounded `owner_monitor_snapshots` table. The stored health history contains the last observed sample per 15-minute interval for seven days, at most 700 points per source. This is sampled history, not every raw reading.
- Weather: existing Windows `SUCHA-AgTech-Weather10Model-Collector` (three hours, unchanged) → sanitized export → new `SUCHA-AgTech-OwnerWeb-WeatherPublisher` (15 minutes) → SSH to the Pi publisher → outbound HTTPS to the same app. Repeated forecast issues are idempotent.
- Browser: same-origin `/api/monitor/read` for owner-authorized health; `/api/monitor/weather` for the public, sanitized forecast already approved for the app. Current account authorization and active source linkage are checked server-side; no new login system is introduced.
- Health freshness is calculated from the observation timestamp on every read. No health publisher means readings become STALE after 180 seconds. Weather retains explicit issue/valid timestamps and expiry. Weather collection still depends on the existing Windows collector; Pi health continues when Windows is off.

## Boundaries

Only allowlisted metric fields and server-known weather model labels cross the cloud boundary. Credentials stay on the Pi in the existing systemd credential path. Network identity, coordinates, arbitrary errors and raw device payloads are excluded. The Worker accepts only active sensor publisher credentials, owner-scoped health reads, bounded JSON, and newer-only snapshots.

The only database change is an additive table holding at most one health and one weather snapshot per publisher owner. Existing account/sensor records, the sensor API Worker, water ingestion, source services, Pi field configuration, relay outputs, firewall and legacy Pages are unchanged. `DATA_ONLY / SAFE_OFF`; no actuator code, hardware command, reboot or inbound listener is added.

## Validation

- Navigation refinement: desktop/mobile browser checks verify both buttons are visible above the map, separate weather/health pages, return navigation, unchanged selection of all 13 map regions and a water-only pond page. No auth, data-feed, service or Worker logic changes are part of this UI refinement.
- Full check: 99 tests pass, relay 9 messages pass. Additional tests cover owner/source authorization, public/private separation, stale timestamps, unsafe/future rejection, private-field projection, oversized requests and newer-only publication.
- Wrangler bundle dry-run and binding type generation pass using current Workers types.
- Read-only publisher dry-run on the Pi found real current readings for both nodes and seven-day history (673/653 sampled points at check time).
- Isolated browser tests at 1280 x 720 and 390 x 844 passed health navigation, sign-in return, both metric cards, seven-day history and 10-model forecast rendering with zero script/console errors and no horizontal overflow. Health UI fixtures are synthetic; they do not constitute owner-session production verification.
- UI evidence: [mobile health fixture](../qa/owner-monitor/mobile-health-fixture.png) and [desktop forecast](../qa/owner-monitor/desktop-forecast.png). The test overlay labels synthetic health metrics.
- Deployment, real publisher receipts and independent live readback are recorded in `COLLAB_STATUS.md` after release.

## Live release evidence — 6 September 2026

Frontend code `27376a5` is live as Worker version `338de5f6-591e-4bd6-a448-0ebd259414bb`. Build metadata and five changed asset hashes match. Later installation fixes change only the host-side publisher, deployment line endings and documentation; they do not change the deployed frontend code.

The new snapshot table contains real health and weather publications with output control false. Independent readback at 09:09 Bangkok found both nodes GOOD, observations less than one minute old, and 673/653 sampled history points. The Pi timer successfully published a later snapshot without a manual trigger. The existing water dashboard and telemetry forwarder remain active.

The public forecast returns all ten models from the existing collector's 08:13 issue. The new Windows publisher task completed with exit result 0; duplicate delivery preserves the existing issue. Live desktop/mobile checks cover the public forecast and the health login entry. The real owner-session health view is still unverified; synthetic chart QA is labeled separately. See [live forecast](../qa/owner-monitor/mobile-forecast-live.png), [health login entry](../qa/owner-monitor/desktop-health-login-live.png), and [sanitized readback](../qa/owner-monitor/live-readback.json).

Installation exposed two host-specific issues that are now addressed: Git checkouts require LF for Linux scripts/units, and SQLite read-only WAL readers need access to coordination files. The unit permits that one source directory for WAL reader coordination while keeping the database file mounted read-only; the connection also enforces `mode=ro` and `query_only=ON`. The publisher identifies itself as `FARMULTIMATE-Owner-Monitor/1.0`. The default Python client encountered [Cloudflare error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/); no Cloudflare protection rule was disabled.

## Install and recovery

- Apply `worker/schema-owner-monitor.sql` to the existing canary database after verifying the configured identity; deploy only `wrangler.owner-main.jsonc` to the owner main Worker.
- Copy `scripts/owner-monitor` publisher/service/timer/install files to the Pi and run `install.sh`. It adds one isolated oneshot unit and timer, using the existing source database and credential. No source service restart is required.
- Run `install-weather-task.ps1 -ProjectRoot <existing irrigation project root>` on SUCHA's Windows host. The task reads the existing export and existing SSH target configuration. Safe receipts are logged under project `artifacts/owner-monitor`.
- Keep the installed script worktree available while the Windows publisher task uses it; reinstall the task with the new script location before retiring that worktree. The current task uses the logged-in owner's Windows context and has no stored password.
- Disable the new Pi timer/service with `uninstall.sh`; disable only the new Windows task with `uninstall-weather-task.ps1`. These preserve files, logs, source collectors and all stored data.
- Previous frontend rollback version: `8eb56284-a1af-45f3-855a-043871923279`. Leave the additive snapshot table in place when rolling back the frontend; do not delete or alter existing data.
