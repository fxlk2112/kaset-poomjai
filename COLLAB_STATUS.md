# FARMULTIMATE Collaboration Status

## Active task: OWNER-SUMMARY-005

- Owner SUCHA; branch `pick/owner-summary-v1`; source `188b03b`, freshly fetched `origin/develop@40721b5` retained as ancestor.
- Owner requested the remote owner summary and explicitly authorized publishing to the existing main website on 2026-09-12.
- Scope lock: new `js/owner-summary.js`, `css/owner-summary.css`, summary-only map/app/auth navigation, sensor timer exclusion on the summary page, index assets, related tests/docs/QA. No Commerce, backend/schema, Pi service/config, or hardware changes.
- Queue: implement real-source summary and field checklist -> calculation/access/freshness tests -> mobile/tablet/desktop visual verification -> main Worker dry-run/deploy -> independent public readback.
- Status: DEPLOYED_AND_READBACK_VERIFIED. Public release `5e98145`, frontend Worker `b679d63f-eb54-4048-b43b-25333550cc2b`; 141 tests and 9 relay messages pass. Eight live asset hashes match, owner-session UI shows fresh water/energy/Pi sources, signed-out monitor returns 401, backend version unchanged. Responsive DOM checks at 390/840/1280 have no horizontal overflow; Windows screenshot scaling artifacts and physical iOS acceptance remain distinct limits. See `docs/OWNER_SUMMARY.md` and `qa/owner-summary/`. DATA_ONLY / SAFE_OFF / Pi 5 sole writer; no Pi/config/hardware changes.

## Active task: OWNER-WATER-FRESHNESS-004

- Owner SUCHA; source `488da97`; branch `pick/water-cloud-freshness-v1`.
- Scope: diagnosed stale public water readings; change only existing Pi 5 outbound telemetry interval from 300 to 60 seconds with backup/readback. Keep device acquisition, water database, credentials, backend, UI freshness threshold and hardware control unchanged.
- Evidence: source DB age under one minute; public water age four minutes; active forwarder runtime interval 300 seconds; accepted publishes spaced five minutes. Public energy is fresh.
- Status: FIXED_AND_READBACK_VERIFIED. Running interval 60 seconds; two consecutive accepted deliveries one minute apart, zero pending outbox, public reservoir view LIVE. Existing public asset release 266ac8e unchanged. See `docs/WATER_CLOUD_FRESHNESS.md`.


## Active task: OWNER-MONITOR-DETAILS-003

- Owner SUCHA; branch `pick/energy-water-details-v1`; source `b137b08`, freshly fetched develop ancestor retained. Continue the owner dashboard improvement/release request.
- Scope lock: energy observation history projection, energy Worker contract/UI/tests, new pond detail UI/tests, `js/sensors.js` insertion, `index.html`/`sw.js` asset references, matching CSS, monitor documentation/QA. No Commerce, controller, meter settings, water calibration, database schema or new hardware commands.
- Deliver 1h/24h/7d/30d energy charts with bounded data and truthful coverage; reservoir storage change, rate, quality/coverage, missing water-temperature and flow measurements, explicit evaporation scenarios. No inference that every level drop is leakage; no air-temperature substitution. Current measurement acceptance remains pending.
- Status: DEPLOYED_AND_READBACK_VERIFIED. Owner Cloud/LAN release `266ac8e`; JS 136/136, Python observations 8/8, owner-monitor 6/6, relay 9. Live UI, asset hashes and unauthenticated 401 verified; no hardware commands. Measurement commissioning and LAN browser CA trust remain pending. See `docs/MONITOR_DETAILS.md`.

## Active task: OWNER-ENERGY-LIVE-002

- Owner SUCHA; branch `pick/energy-live-observation-v1`; source `57b2668`, with freshly fetched `origin/develop@40721b5` verified as ancestor. Preserve deployed pond/LAN functionality and completed D1 index work.
- Pick explicitly requested connecting the installed meter to the dashboard on 2026-09-10 after successful function-03 readings on Pi Zero. Scope includes dedicated data-only acquisition/storage services on Pi Zero/Pi 5 and the existing owner Cloud/LAN dashboard release; no actuator or meter-register writes.
- Writable lock: `scripts/energy-observer/`, energy projection in `scripts/owner-monitor/publisher.py` and its energy tests, energy-only status handling in `scripts/lan/app.py` and tests, `worker/energy-contract.js` and energy tests, `js/energy.js`, `css/energy.css`, energy docs/QA and this entry. Commerce, controller, existing water acquisition and D1 schema remain untouched.
- Queue: confirm runtime/ACL -> implement separately labelled unverified observations with durable spool and deduplication -> contract/recovery/visual tests -> deploy scoped observer/ingest and Cloud/LAN assets -> independent readback.
- Installed adapter is Waveshare USB TO RS232/485, non-isolated; meter address 1, 9600, parity NONE observed in owner video. CRC-valid readings pass after owner selected RS485. Exact CT/phase/direction and display comparison remain unverified. Existing commissioned energy profile gates are preserved. New observations cannot become GOOD, pump run-state, cost estimates, or control inputs.
- Status: DEPLOYED / CLOUD_OWNER_DASHBOARD_VERIFIED / MEASUREMENT_ACCEPTANCE_PENDING. Cloud and LAN assets `e0914d376959d9229de82b86d5bb45b3a2c861a1`; main Worker version `f50215be-6114-4616-a428-6e2b6a1e70d3`. Dedicated receiver/observer active; Cloud values match the Pi 5 source record. Scoped receiver-stop recovery drained the local outbox with zero duplicate IDs. Canonical values remain null and observation quality UNVERIFIED. JavaScript 132/132, observation Python 7/7, owner-monitor 6/6, LAN 8/8 pass. Cloud live owner-session UI verified with no console errors. LAN TLS/asset/API-401 readbacks pass using the existing project CA; Codex browser does not trust that CA, so live LAN owner-session UI remains unverified. No physical WAN-disconnection test. See `docs/ENERGY_LIVE_OBSERVATIONS.md` and `qa/energy-live/`.
- Source integration: feature branch pushed with remote hash match. No duplicate PR found for this head. Draft PR creation returned GitHub integration HTTP 403 `Resource not accessible by integration`; PR remains NOT_CREATED, with no protected branch merge. This is a source-review blocker only; the owner-approved deployed dashboard is verified.

## Local task: OWNER-D1-QUEUED-INDEX-001

- Owner SUCHA; branch `pick/d1-queued-index-20260910`; base deployed source `fba867ea0af77d8046ab654cded326c496d0ec83`, which contains `origin/develop@40721b5`. Release base preserves newer LAN safety guards absent from the older integration tree.
- Scope lock: `worker/relay-bench-schema.sql`, new `worker/relay-bench-migrate-queued-index.sql`, related index tests, `docs/D1_QUEUED_INDEX.md`, `qa/d1-queued-index/`, and this task entry. Existing pond/LAN task entries and all runtime logic remain unchanged.
- User authorized remote read-only metadata/EXPLAIN and local migration preparation on 2026-09-10. Production D1 migration requires separate approval of the concrete SQL. No Worker/Pi deployment, control calls or hardware changes.
- Status: REMOTE_INDEX_APPLIED / QUERY_PLANS_VERIFIED / NO_WORKER_OR_PI_DEPLOYMENT. Pick granted `APPROVE_FARM_D1_INDEX_MIGRATION`; only the queued partial index was created. Remote readback preserves all old indexes, both plans use the new index, and a bounded health read is fresh/ready with fault NONE. Pre-migration validation: `TZ=UTC npm run check` 129/129 and 9 relay messages PASS. Evidence: `qa/d1-queued-index/migration-readback.json`; runbook: `docs/D1_QUEUED_INDEX.md`.

## Active task: OWNER-POND-VISUAL-002

- Owner SUCHA; branch `pick/pond-visual-v2`; source `0d610e2`, freshly fetched develop ancestor verified. Pick requested the 33% water illustration reaching the first foreground pier and more visible, gradual level changes.
- Writable lock: reservoir presentation in `js/sensors.js`, matching CSS and existing visual-contract tests, status and `qa/pond-visual/`. Reuse existing artwork with continuous interpolation. Display anchors are illustrative, not sensor calibration or surveyed geometry; depth, volume, capacity, freshness and control/API logic are unchanged.
- Acceptance: 32.8–33% reaches the foreground pier base, small percentage changes affect the image, truthful readings and fault/stale handling, responsive screenshots, existing checks and scoped Cloud/LAN static release. No controller restart, output action, credential/config change or Commerce edit. Status `IN_PROGRESS`.

## Delivered task: OWNER-LAN-001 — owner device setup pending

- Owner SUCHA; branch `pick/lan-fallback-v1`; source `858d4ce`, freshly fetched develop ancestor verified. Pick explicitly requested all four LAN fallback sections: offline site, independent LAN login, one Pi controller for LAN/Cloud, visible transport and saved forecast.
- Writable lock: new `scripts/lan/`, LAN coordinator beside existing relay agent, scoped service drop-in, LAN runtime/UI/build hooks, Worker transport arbitration, forecast caching, tests/docs/QA and status. Commerce and field commissioning remain excluded. The explicit LAN request supersedes the earlier collaboration-only LAN restriction for this task.
- Runtime scope: dedicated LAN HTTPS service on Pi 5, same-owner offline password verifier in protected local storage, existing Pi writer extended through a permission-restricted local socket, no-load five-second pulses only, no router/WAN/Windows-firewall change. Existing relay driver identity/mode checks and bus serialization stay in place.
- Delivery: main frontend Worker version `248fbc15-6d16-4c5a-9b1a-6940ac3b9359`, frontend/LAN asset release `538f106c98ad7aa448df0476c4d998e314ae3e8b`. Initial LAN release `e2530f8` / `9a5aeac9-191e-43a1-8ec0-e54a84acfadc` was superseded to finalize service startup and certificate MIME through Workers asset headers. Pre-LAN frontend `5558d5ae-76cc-4813-9e91-47768b9aab0f` remains the full-feature rollback reference. Existing API backend remains `87ab09f5-1da5-43b3-81c1-30c5a858b11f`. No D1 migration, protected-branch merge, field commissioning or router/firewall change.
- Pi delivery: LAN HTTPS and weather timer active; existing controller replaced through one scoped drop-in; same writer/bus locks and fixed five-second hardware timers retained. Dedicated Avahi alias service resolves `farmultimate.local` from Windows. Protected local owner verifier and HttpOnly cookie sessions prepared; private keys and account verifier never enter Git. Gunicorn variable-name collision and Avahi reverse-record collision were resolved during installation; final services/readbacks pass.
- Validation: `TZ=UTC npm run check` 126/126; relay 9/9; Python controller/auth 22/22; service-user Gunicorn configuration check; TLS chain/hostname and auth/network/host/origin guards; mobile/desktop screenshots for live LAN and Cloud plus login fixtures. LAN cold-browser traffic to external origins was blocked. Actual Pi SQLite via isolated fixture-auth readback: water GOOD, both Pi sources GOOD, history available; energy remains INGEST_NOT_READY.
- Physical no-load bench: two channels ON_VERIFIED during scoped Cloud transport failure, independent OFF, timed auto-OFF, reconnect/restart without replay, cached forecast retained on failed fetch. Final all 16 channels OFF, session disarmed. The test did not disconnect the real WAN/router. Reports/screenshots: `qa/lan-fallback/`; operations/rollback: `docs/LAN_FALLBACK.md`.
- Final independent readback: all 13 deployed runtime files match reviewed source; six scoped/existing services/timers active; controller ready, fault NONE, all 16 OFF and disarmed; outage flag absent; correct public iOS profile MIME; LAN TLS and logical-name resolution pass. The final patch changes certificate delivery only on the website; the already photographed UI and physically tested coordinator are unchanged.
- Status `DEPLOYED / LAN_READY / OWNER_DEVICE_SETUP_PENDING`. Owner must install/trust the public farm certificate once and sign in on the farm Wi-Fi; real owner phone/password UAT, physical WAN removal, DHCP address change and full rollback drill remain unverified. Open `/lan-setup.html` on the existing main app. Irrigation remains SAFE_OFF; only the previously approved no-load bench can pulse.

## Previous task: OWNER-MAP-HEADING-001

- Owner SUCHA; branch `pick/map-heading-v1`; source `936195ee0c4544c6e1987ab8d01801aff95ae991` with freshly fetched `origin/develop` verified as ancestor. Existing work preserved.
- Pick requested changing the map overview heading from `ภาพรวมระบบชลประทาน` to `ภาพรวมระบบการจัดการ` on the current owner website. This follows the authorized owner-site UI work.
- Writable lock: only the heading in `js/farm-map.js`, this status and `qa/map-heading/` evidence. No API, data, device, relay-control, styling or Commerce changes.
- Acceptance: exact new heading on the deployed map; existing checks, responsive browser readback, diff/secret review and release verification. Status: `DEPLOYED / VERIFIED`.
- Release `8f7f41d32f212ed5b0d3a61a4cce594ed1c15119`, frontend version `5558d5ae-76cc-4813-9e91-47768b9aab0f`; rollback frontend `8b6fe6bb-7fc7-4e36-8b0a-1a3d674cf597`. 124 checks and nine relay messages pass. Actual anonymous production phone/desktop screenshots verify the exact heading, no overflow and no script errors; build/map/service-worker hashes match. Evidence: `qa/map-heading/`. Next: owner refreshes the map page.

## Previous task: OWNER-ENERGY-001

- Owner SUCHA; branch `pick/energy-dashboard-v1`; source `9e821b456b028150c1e8aa05eb8d578e775cd0c4`, with freshly fetched `origin/develop@40721b5` as ancestor. Existing worktree clean and preserved.
- Pick requested an electricity dashboard and production publication on 2026-09-07. Supplied listing identifies Acrel ADL400N-CT/D16; actual nameplate, CT variant and installation remain unverified.
- Writable lock: new energy UI/CSS/contracts/tests, energy-only hooks in map/App/auth/index, existing read-only monitor projection/publisher, related QA/docs and this status. Commerce belongs to Folk. Relay control, device readers, schema, wiring, meter settings and field control stay unchanged.
- Acceptance: separate energy page from the map; responsive kW/kWh/three-phase voltage/current/PF/Hz and 24-hour history; owner-authenticated data; explicit missing/stale/fault states; no invented measurements; contract/publisher/UI regression checks, secret review, publication and independent readback.
- Live Pi read-only preflight: `energy_samples` table absent. Prepared local ADL400N reader/ingest candidates were never commissioned; do not install or enable those as part of dashboard publication. Extend outbound monitor snapshots to report readiness and project future verified samples only. Energy remains `DATA_ONLY / SAFE_OFF`.
- Status: `DEPLOYED / AWAITING_METER_SETUP`. Release `e6c0dcd3f8111a1e8ed6eb611597462f80e6eb45`; frontend Worker `8b6fe6bb-7fc7-4e36-8b0a-1a3d674cf597`. Nine live assets hash-match, missing/invalid owner sessions return 401/403, API backend unchanged. Actual cloud energy snapshot reports `INGEST_NOT_READY`, zero energy sources; Pi 5/Pi Zero health GOOD and two relay observation modules preserved. Only the isolated outbound publisher file changed on Pi; its backup/hash verified and all four checked services/timers active.
- Validation: 124 JavaScript/Worker tests, six Python monitor tests and nine relay messages pass. Chrome phone/tablet/desktop fixture views, login return and map/relay navigation pass. Actual production anonymous mobile page passes without API mocks, overflow or script errors. Physical meter readings and a real signed-in owner browser remain unverified. Evidence: `qa/energy/`; next: owner opens FLYTECH → พลังงานไฟฟ้า, then completes meter/CT/RS485 field verification before real readings can begin.

## Previous task: OWNER-RELAY-BENCH-001

- Current owner correction: reduce button latency and allow multiple unloaded channels to operate independently. Extend this same task to protocol v2: per-channel PULSE/OFF commands and uniqueness, five-second hardware timers unchanged, immediate pending UI, faster Pi polling with persistent HTTPS, related schema migration/tests/QA, a shared transport lock and scoped observer-launch drop-in, and publication to the already approved owner-main target. The read-only observer source/config remain unchanged. Source checkpoint `d42c264`. No loads or field-control commissioning.
- Owner SUCHA; branch `pick/relay-bench-v1`; source `origin/develop@40721b5` plus deployed checkpoint `2d2050f` (PRs #5–#9 dependencies).
- Explicit owner authorization on 2026-09-06: no loads are connected; implement actual relay ON/OFF for testing from the existing web page. This is a bounded no-load bench-control task, not irrigation commissioning.
- Writable lock: relay UI and map safety labels, relay-only App/auth hooks, new Worker bench API/contracts and additive bench tables, frontend route/config, new isolated Pi bench agent/install/uninstall, release metadata wording, related tests, `qa/relay-bench/`, `docs/OWNER_RELAY_BENCH.md`, this status file. Commerce, observer source/config, telemetry/controller candidate logic and maps stay unchanged; the observer receives only the scoped serialization launcher to share gateway access with bench control.
- Acceptance: owner-authenticated 15-minute no-load sessions; independent unloaded channels; hardware timed flash ON for 5 seconds; early OFF and disarm; fresh identity/mode/CRC checks; durable deduplication and expired commands discarded; real ON and automatic/early OFF readback through Pi 5; no Windows Modbus, inbound port or firewall change; fault-path tests, screenshots, scoped secret review, live readback and rollback.
- V1 checkpoint: `DEPLOYED / PI_CONNECTED`. Pick granted `APPROVE_RELAY_BENCH_CLOUD` on 2026-09-06. Two new tables and two indexes match on independent readback. Release `fce08bdf9079c3453d5fd13448e631ed5e53af15`, frontend version `f73672eb-bb83-4733-bc6e-a8b2f6d203ce`: six live asset hashes match; owner/device authentication guards return 401 when absent; the backend version is unchanged. The isolated Pi service is active/enabled, with fresh heartbeat, stop acknowledgement, both 8CH modules READY, no active session and all 16 outputs OFF. All four original services/timers remain active.
- V1 validation: 111 JavaScript/Worker tests, six Python tests and 9-message relay validation pass. Local and deployed-asset browser QA covers actual Worker handlers and SQLite with a labeled synthetic Pi adapter at phone/tablet/desktop sizes. Prior real hardware checks passed all 16 channels with autonomous five-second OFF and early OFF. Owner-session browser-to-cloud-to-Pi ON/OFF remains unverified because the browser connector times out; no owner session was extracted/fabricated. Evidence and rollback: `docs/OWNER_RELAY_BENCH.md`, `qa/relay-bench/`. Next: owner opens FLYTECH → รีเลย์ / สวิตช์, signs in and starts a no-load session.

- V2 status: `DEPLOYED / READY / ALL_OFF`. Frontend release `86f7bc7`, Worker `28e8dc23-78ab-452e-81a2-e0d04f2fae27`; six asset hashes match and the backend is unchanged. 114 JavaScript tests, eight Python tests and nine relay messages pass; local/live-asset phone/tablet/desktop fixture QA passes. Real Pi test read all 16 channels ON together, individual OFF preserved other channels, timers/global OFF passed. Four concurrent read-only probes pass after sharing a connection lock with the unchanged observer source. No recovery fault since restart; cloud-poll median 280 ms, not click-to-contact timing. All services active, protocol v2 connected, session disarmed and all 16 outputs OFF. All four prior command audit rows preserved. Evidence: `qa/relay-bench/v2/`. Next: owner refreshes the main site and tries independent channels.

## Previous task: OWNER-MAP-RELAY-001

- Owner SUCHA; branch `pick/map-relay-v1`; source `origin/develop@40721b5` plus deployed owner checkpoint `9bca8d3` (PRs #5–#8 dependencies).
- Request: update this app's Master Map from the current company Booking page and put relay/switch controls on the same page.
- Writable lock: `js/farm-map.js`, new `js/relay-panel.js`, relay-only hooks in `js/app.js`, `js/auth.js`, `js/sensors.js`, `index.html`, `css/style.css`, map image, `worker/monitor-contract.js`, read-only `scripts/owner-monitor/` publisher and service, related tests, `qa/map-relay/`, `docs/OWNER_MAP_RELAY.md`, this status file. Commerce stays with Folk.
- Acceptance: source image and all 13 polygons match the live Booking reference; responsive map navigation; owner-authorized real relay/DI observations without private identities; stale/unknown states remain explicit; controls stay disabled while channel mapping and the Pi controller are missing; full checks, screenshots, deployment dry-run and independent readback.
- Status: `MAP_AND_READBACK_DEPLOYED / ACTUAL_CONTROL_BLOCKED`. Fresh Pi audit finds two healthy read-only 8CH modules; 32 candidate channels remain UNASSIGNED/disabled and no output-controller service is installed. Wiring details requested from Pick. No hardware command will be sent or queued in this release.
- Safety: `DATA_ONLY / SAFE_OFF`; frontend and the existing isolated outbound monitor publisher updated. No Modbus writes, source-service changes, firewall changes, actuator deployment or protected-branch merge.
- Release `22acffe08bc24333bddf7867d4c13cd78721bab1`; frontend version `6098e543-bcc4-4b74-ae48-03a2fc8d9916`. Independent readback at 16:31 Bangkok: nine asset hashes and build match, relay snapshot fresh with two GOOD 8CH modules, Pi 5/Pi Zero GOOD, forecast 10 models, backend version unchanged. The isolated monitor service succeeded and all four checked services/timers remain active.
- Tests: 105 JavaScript/Worker tests + 3 Python tests + 9-message relay validation PASS. Local/live Chrome phone/tablet/desktop screenshots and navigation PASS. Fixture screenshots are labeled; real owner-session browser and physical hardware actuation were not tested. Evidence: `qa/map-relay/`; rollback in `docs/OWNER_MAP_RELAY.md`.

## Previous task: OWNER-FLYTECH-ENTRY-001

- Owner SUCHA; branch `pick/flytech-entry-v1`; integration source `origin/develop@40721b5`, prior owner checkpoint `9e80e64` (PRs #5, #6 and #7 dependencies).
- Owner request and deployment approval: make the Home water-entry card taller, replace its droplet icon with the supplied FLYTECH logo, change the title to `FLYTECH` and subtitle to `Precision AgTech Solutions`, and publish to the existing owner main website.
- Writable lock: only the Home entry markup in `js/app.js`, its styles in `css/style.css`, the corresponding existing assertion in `js/tests/navigation.test.mjs`, supplied logo under `images/brand/`, `qa/flytech-entry/`, `docs/OWNER_FLYTECH_ENTRY.md` and this status file. SUCHA owns the shared-shell changes. The click still opens the same plot map.
- Acceptance: supplied logo appears faithfully; taller card and complete requested text at phone/tablet/desktop sizes; map navigation works; `npm run check`, screenshots, asset/secret review, release dry-run and independent live readback pass.
- Safety: UI-only; `DATA_ONLY / SAFE_OFF`. Existing auth, data feeds, device services, backend, Worker configuration, Commerce and other logos are outside scope.
- Status: `DEPLOYED / LIVE_READBACK_VERIFIED`; 99 tests and 9-message relay validation pass. Live browser QA passes at phone 360 x 800, tablet 840 x 1180 and desktop 1280 x 900: supplied logo loaded, exact text, 136/154px card height, no overflow and preserved map navigation. Browser checks use isolated Chrome contexts; physical iPad Safari is not verified.
- Release commit `36fe596719979622a664a0f739963731eea266cd`; frontend Worker version `86e7be2a-f3f0-4fdd-9913-c776af61638c`. Independent readback at 15:15 Bangkok: build and four asset hashes match, including the unchanged supplied JPEG; backend version remains `87ab09f5-1da5-43b3-81c1-30c5a858b11f`, public health output false. Rollback frontend version: `0cf534c7-1323-4819-b957-e5ab7c238834`. Evidence: `qa/flytech-entry/release-readback.json` and phone/tablet screenshots.

## Previous task: OWNER-MONITOR-001

- Owner follow-up (2026-09-06): SUCHA refined the same task/PR #7. Writable UI scope: `js/farm-map.js`, `js/sensors.js`, `css/style.css`, related QA evidence, `docs/OWNER_MONITOR.md` and this status file. Separate **สภาพอากาศ** and **สุขภาพระบบ** buttons now sit above the plot map, open separate pages, and keep the map's pond view focused on water. Existing auth, data feeds, Worker logic/config, device services and Commerce were outside this follow-up. Status: `UI_DEPLOYED / LIVE_READBACK_VERIFIED`; desktop/mobile navigation and visual checks pass, 99 tests and relay validation pass.
- Current frontend release `21ea1096b2a768198ae99ee4409dea55a1929c11`, version `0cf534c7-1323-4819-b957-e5ab7c238834`, independently verified at 11:13 Bangkok. Build and four asset hashes match; the existing public forecast returns 10 models and the API backend version is unchanged. Live QA verifies two buttons above the map, separate pages, the return path and a water-only pond view. Rollback frontend version: `338de5f6-591e-4bd6-a448-0ebd259414bb`. Evidence: `qa/owner-monitor/map-navigation-readback.json` and `*-map-navigation.png`.
- Owner SUCHA; branch `pick/owner-health-weather-v1`; integration source `origin/develop@40721b5`, existing owner release checkpoint `2b4658a` (PRs #5 and #6 dependencies).
- Request: publish the existing Pi 5/Pi Zero health dashboard and existing 10-model forecast on the same owner main website, with ongoing refresh.
- Scope lock: monitor-only Worker modules and new snapshot table, owner frontend Worker/config, `js/sensors.js`, sensor login-return hook in `js/auth.js`, dashboard navigation in `js/farm-map.js`, `js/runtime-config.js`, `css/style.css`, related tests, scripts/owner-monitor publisher/install/uninstall and their scoped LF attributes, forecast snapshot, QA evidence, docs and status.
- Deployment scope: same owner main Worker; additive snapshot storage only; an outbound-only Pi health publisher and a Windows task forwarding the existing sanitized forecast export. Existing sensor API/ingestion, source services, field settings and Commerce stay unchanged.
- Acceptance: owner-authorized health reads, sanitized projection only, bounded payloads and polling, stale state based on observation timestamps, verified real health/forecast delivery, desktop/mobile QA, full checks, independent cloud readback and rollback/uninstall path.
- `DATA_ONLY / SAFE_OFF / NO_HARDWARE_CONTROL`; no inbound Pi listener or firewall change, actuator command, reboot, existing-record alteration or protected-branch merge.
- Status: `DEPLOYED / REAL_DATA_READBACK_VERIFIED` on 2026-09-06; 99 tests and relay 9 messages pass; desktop/mobile UI QA, binding type generation and Wrangler dry-run pass.
- Initial dashboard release commit `27376a5284c6c0a4fb7e758ac684dd0928d22da9`, Worker version `338de5f6-591e-4bd6-a448-0ebd259414bb`; its build metadata and five changed asset hashes matched. Superseded by the navigation refinement recorded above. The API backend remains at `87ab09f5-1da5-43b3-81c1-30c5a858b11f`.
- Installed the isolated Pi health publisher and 60-second timer. At 09:09 Bangkok, manual and automatic publications passed; independent cloud readback found both Pi sources GOOD and fresh, with 673/653 sampled history points. Existing water dashboard and telemetry forwarder remain active. Source rows remain read-only; only SQLite WAL reader coordination files need directory write access.
- Published the real forecast issue from 08:13 Bangkok: 10 models, forecast-only, no station truth. The new 15-minute Windows forwarding task returned LastTaskResult 0; the existing three-hour collector also remains successful and unchanged. Pi health continues without Windows; new forecast issues depend on the Windows collector and its logged-in scheduled-task context.
- Live public forecast and signed-out health views passed at 1280 x 720 and 390 x 844, with zero console/script errors and no horizontal overflow. Missing/invalid owner sessions receive 401/403. Health charts after login passed with labeled synthetic fixtures; Pick's real owner-session browser view remains unverified.
- Operational corrections: LF-only Linux deployment files, explicit service User-Agent, and a writable SQLite coordination directory with the database file itself mounted read-only. No security rules were disabled. Detailed evidence and uninstall paths: `docs/OWNER_MONITOR.md` and `qa/owner-monitor/`.

## Previous task: OWNER-SENSOR-001

- Owner: SUCHA; branch: `pick/owner-sensor-page-v1`.
- Source: `origin/develop@40721b5bfa71670ea97aba0d247e5616277c018a` plus deployed owner gateway/tooling checkpoint `3f601723feef2dc9184425fd6861594617f45d82` (PR #5 dependency).
- Scope: repair sensor loading, account access, refresh and error states on the existing owner main website.
- Writable lock: `js/sensors.js`, sensor-only hooks in `js/auth.js`, sensor styles in `css/style.css`, `js/tests/sensor-access.test.mjs`, `js/tests/sensors.test.mjs`, `docs/OWNER_SENSOR_PAGE.md`, `qa/owner-sensor-page/*.png`, this status file.
- Acceptance: public health works without login; private sensor reads require the existing owner session; account changes discard old readings; requests finish or show a retry state; current/history failures remain distinct; desktop/mobile screenshots and full `npm run check` pass.
- Safety: `DATA_ONLY / SAFE_OFF`; no API deployment, database write, ingestion change or hardware action. Commerce ownership remains with Folk.
- Status: `FRONTEND_DEPLOYED / READBACK_VERIFIED` on 2026-09-06; full check 85 tests and relay 9 messages pass, desktop/mobile browser checks pass, Wrangler dry-run passes.
- Release commit: `f60bfd2fa5bcb14ac71b5296de85d77e4fd07229`; frontend Worker version: `8eb56284-a1af-45f3-855a-043871923279`.
- Live readback: build/source commit match; five changed/core asset hashes match; GET `/api/health` confirms `SENSOR_PHASE1_READ_ONLY` and output false. Desktop/mobile live signed-out page and login entry have no overflow or script/console errors.
- Backend version remains `87ab09f5-1da5-43b3-81c1-30c5a858b11f`. Read-only D1 aggregate checks confirmed incoming readings for the active source. Actual owner login and private readings in Pick's browser remain unverified; authenticated browser QA used local synthetic responses.
- Next action: Pick opens the sensor page on the same main URL and signs in with the existing sensor owner account if prompted. Source integration uses normal review into `develop`, with PR #5 as its dependency.

## Previous gateway release checkpoint (2026-09-05)

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
