# OWNER-RELAY-BENCH-001 — independent unloaded relay channels

Owner SUCHA; branch `pick/relay-bench-v1`; integration source `origin/develop@40721b5`, v1 checkpoint `d42c264` (PR #10, dependencies #5–#9).

## Current owner correction

Pick confirmed no connected loads, authorized `APPROVE_RELAY_BENCH_CLOUD`, then reported slow clicks and the one-channel restriction. Protocol v2 addresses that same no-load test: independently operate up to 16 channels, retain fixed five-second hardware timers, provide individual OFF and global OFF, and reduce polling/connection delay. Field irrigation remains disabled. Pi 5 remains the sole hardware writer.

## User flow

FLYTECH → รีเลย์ / สวิตช์ → existing owner login → “เริ่มทดสอบ · ยืนยันไม่มีโหลด”. A session lasts 15 minutes. Each “เปิด 5 วิ” affects its channel; other channels remain usable. “ปิด” closes that channel; “ปิดทุกช่อง” closes both modules; “จบการทดสอบ” closes all and disarms. Pending/received states are distinct from real ON/OFF readback. Stop is delivered over the network and is not a hardwired emergency stop. End bench mode before attaching any load.

## Changes and preserved boundaries

- Each active channel has its own command and hardware timer. Repeated ON on that channel cannot extend the timer. Cross-tab uniqueness is enforced in D1 and independently on Pi.
- The additive v2 migration adds an action column and replaces only the dedicated bench queue's global index with a channel index. It disarms/cancels pending bench commands for rollout; all four existing audit rows are preserved. Existing business tables are unchanged.
- Individual OFF records cancellation of any in-flight ON id, so a delayed ON HTTP request cannot start after OFF completes. Global OFF uses a stop generation; agent restart disarms and cancels queued work.
- Owner sessions and scoped device credentials retain their existing boundaries. No owner token/session is extracted, fabricated or stored in Git. Browser requests remain on the same public origin.
- Pi protocol v2 batches up to 16 commands and acknowledgements, prioritizes OFF, and consumes each id durably before writing. Requests expire after eight seconds. ON is never retried automatically.
- Every ON still verifies device identity, address, firmware, CRC, NORMAL mode and allowed relay states. Unknown ON or a write/readback fault causes OFF recovery. Config identities remain pinned locally.
- Only fixed five-second flash ON, individual OFF and all-OFF frames are available. No latched ON, toggle or register-configuration builder exists. Manufacturer reference: https://www.waveshare.com/wiki/Modbus_POE_ETH_Relay_(C).
- HTTPS connections are reused. Active Pi polling has a 50 ms scheduling pause; inactive polling has a one-second pause. Both also include actual I/O time. Worker requests use fewer sequential D1 round trips.
- Browser pending feedback is immediate, per-channel requests are independent, and readbacks update existing DOM buttons instead of rebuilding the page. Real contact states change only from Pi observations.
- Old agent protocol versions cannot enable v2 pulses. The original observer, telemetry forwarder, dashboard and monitor timer are untouched.

## Verification

- 114 JavaScript/Worker tests, eight Python fault-path tests, and nine-message relay validation pass.
- Browser QA at 360×800, 840×1180 and 1280×900 verifies immediate pending feedback, independent channels, individual OFF, automatic OFF, global OFF, delayed-ON cancellation, login/session locks, no horizontal overflow and no script errors. These use actual Worker/SQLite handlers with an explicitly synthetic Pi.
- Real Pi-controller test: all 16 outputs read ON simultaneously after a 4,215 ms batch, then all automatically read OFF. Individual OFF took 490 ms locally and left the two other active channels unchanged. Global OFF readback passed. See `qa/relay-bench/v2/hardware.json`; this is physical evidence, not a cloud-owner-session test.
- Baseline read-only timing: both devices read in 236–238 ms. One fresh HTTPS request took 502 ms; subsequent reused requests took 184–203 ms. These isolate local reads/transport and are not browser click-to-relay latency.
- V2 cloud schema readback passed with all four prior audit rows preserved. V2 publication and final live readback follow in this same task.
- The browser connector times out. A real owner browser → v2 cloud → Pi ON/OFF timing measurement remains pending; no simulated measurement is presented as real end-to-end timing.

## Operations and rollback

The isolated `sucha-relay-bench.service` uses its own account, restricted systemd unit, existing scoped credential, exclusive writer lock and durable journal. During rollout it is stopped and outputs verified OFF before changing queue schema and agent. Restart only after the matching v2 Worker is deployed; startup disarms stale sessions.

Safe rollback: stop/disable only `sucha-relay-bench.service` (OFF readback on shutdown), leaving all original telemetry services active. Preserve the queue tables and journal. If the previous frontend version `f73672eb-bb83-4733-bc6e-a8b2f6d203ce` is restored, keep the bench service stopped until matching versions and an empty/disarmed queue are verified; never run a v1 agent against v2 OFF commands. No protected-branch merge, load commissioning, data deletion or firewall change is authorized by this work.
