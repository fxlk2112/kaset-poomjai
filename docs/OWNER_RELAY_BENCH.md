# OWNER-RELAY-BENCH-001 — unloaded relay bench

Owner SUCHA; branch `pick/relay-bench-v1`; source `origin/develop@40721b5` plus deployed checkpoint `2d2050f` (PRs #5–#9 dependencies).

## Authorization and current result

On 2026-09-06 Pick confirmed that no loads are connected and requested actual relay switching for testing. A bounded no-load controller is installed on Pi 5. Real testing passed all 16 channels: ON readback, autonomous five-second OFF readback, and an additional early-OFF test. All channels were left OFF. The persistent service is now active/enabled and waits for an authenticated owner to start a no-load session.

Pick granted `APPROVE_RELAY_BENCH_CLOUD` on 2026-09-06, resolving the previous automatic approval rejection. Both new tables and both indexes exactly match the prepared schema. The owner-main frontend is deployed at release `fce08bdf9079c3453d5fd13448e631ed5e53af15`, Worker version `f73672eb-bb83-4733-bc6e-a8b2f6d203ce`. At 21:05 Bangkok, independent readback verified six live asset hashes, an authenticated Pi heartbeat three seconds old, acknowledged stop generation, no active session, both modules ready and all 16 outputs OFF. Requests without owner/device authentication return 401. The backend version remains `87ab09f5-1da5-43b3-81c1-30c5a858b11f`.

The approved scope is limited to the two tables and indexes in `worker/relay-bench-schema.sql` in the existing bound database, the prepared owner-main Worker/frontend, the isolated Pi bench service, and independent verification of cloud receipt and owner access. No existing business tables, field mappings, protected branches or original telemetry services are changed.

## User flow

FLYTECH → รีเลย์ / สวิตช์ → existing sensor-owner login → “เริ่มทดสอบ · ยืนยันไม่มีโหลด”. A session lasts 15 minutes. “เปิด 5 วิ” energizes one channel using the relay's own five-second timer. Another channel cannot start while one is queued or active. “ปิด” ends the active pulse early; “ปิดทุกช่อง” requests OFF for both modules; “จบการทดสอบ” also ends the session. These commands await Pi delivery and are not a hardwired emergency stop.

End and disable bench mode before connecting loads. Pump/valve commissioning and all field-channel assignments remain outside this task.

## Implementation and safety

- Browser → same-origin `/api/relay-bench/*` → existing D1 binding → outbound Pi polling. Pi 5 is the sole writer; no Windows Modbus, inbound listener or firewall changes.
- Existing owner-session/source authorization is required. The device credential can only poll/acknowledge, not arm or enqueue. Unknown channels, foreign origins, long durations and stale/unverified readings fail closed.
- `relay_bench_state` stores session/stop generations; `relay_bench_commands` stores auditable outcomes. Conditional insertion and a partial unique index enforce one active pulse across concurrent tabs. Commands expire after eight seconds; ON is never automatically retried.
- The isolated service uses an exclusive local writer lock and a durable SQLite consume-before-write journal. Agent restart disarms the cloud session and cannot replay a consumed ON.
- The controller pins the existing observer configuration hash and checks device identity, address, firmware, NORMAL mode and CRC before writes. Private identities and credentials stay on Pi.
- The only write frames are function 05 at `0x0200 + channel - 1`, value 50, or at `0x00FF`, value 0. No latched ON, toggle, register configuration or field-control frame builder exists.
- Actual units are Waveshare Modbus POE ETH Relay (C), two 8-output/8-input modules, firmware raw version 100. Manufacturer timer reference: https://www.waveshare.com/wiki/Modbus_POE_ETH_Relay_(C) — flash-on interval is value × 100 ms.
- Hardware timers bound ON independently of the Pi/cloud/browser. Startup/shutdown and lost connectivity attempt OFF with readback. An unknown device is never written. The original read-only observer is unchanged.
- The map explicitly labels `NO LOAD TEST` and `FIELD SAFE_OFF`. Existing telemetry's output flag refers to its field-control API; separate bench capability is declared in build metadata and the new bench API.

## Evidence and limitations

- 111 JavaScript/Worker tests and 9-message relay validation pass.
- Six Python fault-path tests pass: frame limits, durable dedupe, expired commands, ambiguous writes, stop generations and idle connection recovery.
- `qa/relay-bench/hardware-self-test.json` records real unloaded ON/automatic-OFF success for all 16 channels and early OFF.
- Isolated Chrome QA uses actual Worker handlers/SQLite with a labeled synthetic Pi adapter at 360×800, 840×1180 and 1280×900. Session arm, pulse/ACK, automatic OFF, early OFF, disarm and sign-out locks pass without overflow/script errors. Fixture screenshots are not hardware evidence.
- The deployed assets also pass the same three-viewport browser fixture checks. They validate UI behavior separately from hardware evidence; no fixture request reaches the real command API.
- Real owner browser → cloud → Pi ON/OFF remains unverified. The browser connector timed out; no owner session was extracted or fabricated. Live Pi polling and stop acknowledgement are verified independently in `qa/relay-bench/cloud-readback.json`. All four original services/timers remain active.

## Install and rollback

`scripts/relay-bench/install.sh` prepares the isolated service and runs a read-only preflight; it does not start the writer. Local Pi configuration records the no-load authorization and observer fingerprint. The existing token is supplied through systemd LoadCredential.

The approved publication started the unit with `systemctl enable --now sucha-relay-bench.service`. `scripts/relay-bench/uninstall.sh` stops/disables it and invalidates the local no-load confirmation while retaining the journal/config for audit. Original observer, dashboard, monitor timer and forwarder remain untouched.

Cloud rollback: set only `RELAY_BENCH_ENABLED=false`, or restore frontend version `6098e543-bcc4-4b74-ae48-03a2fc8d9916`. The Pi treats an unavailable API as loss of control and attempts OFF; previously issued hardware pulses still expire independently. Keep the additive tables and audit history; do not delete existing data.
