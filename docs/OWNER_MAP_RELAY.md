# OWNER-MAP-RELAY-001 — Booking map and relay readback

Owner: SUCHA. Branch: `pick/map-relay-v1`. Source: `origin/develop@40721b5` plus the deployed owner app checkpoint `9bca8d3`; PRs #5–#8 are source dependencies.

## Delivered scope

The Master Map now uses the exact image and all 13 polygon/label coordinates retrieved from https://kapcrop.co.th/booking on 2026-09-06. E5 is the current Booking strip, and J/G retain their current top-right/bottom-right positions. This is a visual plan, not a field survey. The captured reference and original image SHA256 are in `qa/map-relay/booking-reference.json`.

The existing weather and system-health pages remain separate. A third button, “รีเลย์ / สวิตช์”, jumps to the relay section on the same map page. It displays two observed 8CH modules, their relay-contact states and eight digital inputs per module, with an observation timestamp. These states do not prove that any pump or valve is operating.

The Pi publisher reads the existing observer JSON and projects only logical module IDs, timestamps, verification flags and boolean channel values. No address, MAC, serial, device credential or raw alert enters the cloud snapshot. The Worker projects again; the existing owner-session/source authorization remains required for reads. Public weather does not expose relay data. Missing, invalid, unverified and stale readings are not shown as current OFF. Observation age is checked again in the browser; polling remains every 60 seconds.

Only the isolated `sucha-owner-monitor.service` receives `SupplementaryGroups=sucha-relay-observer` to read the existing 0750 directory / 0640 snapshot. The source observer's ownership and permissions do not change. `ProtectSystem=strict` remains; the publisher does not gain write access to the observer state or hardware.

## Actual control is blocked

The owner's request includes relay operation. Field audit on 2026-09-06 confirmed that the two 8CH observer modules are online with valid identities/CRC. However, all 32 candidate output channels remain disabled and UNASSIGNED, and there is no installed output-controller service on Pi 5. Therefore the displayed ON/OFF controls are disabled. This release includes no actuator endpoint, queue, driver, simulated operation or hidden enable flag.

To implement real switching, first obtain the relay/module + CH-to-load list, load/electrical ratings and field protection evidence; then prepare the Pi 5 sole-writer controller with bounded leases, interlocks, command acknowledgements and commissioning checks for those exact loads. Do not infer physical wiring from the Booking image or logical module order. A UI button is not hardware commissioning.

## Validation and publication

- `npm run check`: 105 tests pass; 9 relay messages validate.
- `python scripts/owner-monitor/test_relay_snapshot.py`: 3 synthetic-file tests pass.
- Isolated Chrome: 360 x 800, 840 x 1180, 1280 x 900; map, keyboard E5 selection, weather/health routes, relay jump/login-return, locked controls and stale state pass without overflow or script errors.
- `*-fixture.png` shows explicitly synthetic owner responses, including an ON example; no real output was actuated to make screenshots. Real owner-session UI and physical iPad Safari remain unverified.
- Asset package contains 39 allowlisted files. Wrangler dry-run and Pi publisher preflight pass. Publication to the existing owner main Worker follows the owner's ongoing main-site authorization; no protected-branch merge or Pages/backend deployment.
- Deployed release `22acffe08bc24333bddf7867d4c13cd78721bab1`, frontend version `6098e543-bcc4-4b74-ae48-03a2fc8d9916`. Independent readback at 16:31 Bangkok confirmed build + nine asset hashes, fresh GOOD relay data for both 8CH modules, both Pi health sources GOOD, forecast 10 models, and the API backend unchanged. Missing/invalid owner sessions return 401/403. See `qa/map-relay/release-readback.json` and `publisher-readback.json`.
- The updated isolated Pi service successfully published and its timer, existing relay observer, water dashboard and telemetry forwarder all remain active. The installed publisher and service unit match their source hashes; previous files are backed up for rollback.

## Rollback

Frontend: redeploy previous Worker version `86e7be2a-f3f0-4fdd-9913-c776af61638c` using the existing owner-main profile. The prior version ignores optional relay fields and continues existing health/forecast behavior.

Pi publisher: the update saves only the previous publisher and isolated service unit under `/opt/sucha-owner-monitor/backups/OWNER-MAP-RELAY-001/`, validates original SHA256 before replacing either file, and uses atomic file replacement. To roll back, restore those two files with mode 0644 to `/opt/sucha-owner-monitor/publisher.py` and `/etc/systemd/system/sucha-owner-monitor.service`, run `systemctl daemon-reload`, then start `sucha-owner-monitor.service`. Do not stop or modify the source observer, dashboard or telemetry forwarder. The existing `scripts/owner-monitor/uninstall.sh` removes only the isolated publisher/timer if fully uninstalling that feature is desired. No secrets are copied into backups.

Safety: `DATA_ONLY / SAFE_OFF / NO_HARDWARE_COMMANDS`.
