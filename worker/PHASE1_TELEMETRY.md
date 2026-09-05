# Phase 1 telemetry API

This branch is deployed only to the owner-controlled Cloudflare canary. The FARMULTIMATE production frontend and legacy production API have not been cut over.

## Safety contract

- `OUTPUT_CONTROL_ENABLED` defaults to `false`.
- Scheduled water control returns without changing state while the flag is false.
- `water_sync`, `water_set`, `water_register`, `water_keys`, `water_poll` and `water_report` fail closed.
- Sensor payloads must contain `output_control_allowed: false`.
- Sensor device tokens are independent from water-control device keys and are stored only as SHA-256 hashes.
- Lark `status`, `push` and `pull` now require a server-verified admin session.
- Browser CORS is limited to `ALLOWED_ORIGINS`; server-to-server ingest does not rely on CORS.

## Actions

User session required:

- `sensor_register`: create or rotate one token for a `source_id`; token is returned once.
- `sensor_devices`: list device metadata and last-seen status without returning tokens.
- `sensor_revoke`: revoke the token for a `source_id`.
- `sensor_current`: read the newest sample and freshness status.
- `sensor_history`: read 1-168 hours of bounded history.

Device bearer token required:

- `sensor_ingest`: append one normalized sample idempotently using `(user_id, source_id, observed_at)`.

## Migration order

Apply `schema.sql`, `schema2.sql`, `schema3.sql`, `schema4.sql`, then `schema5.sql` to an empty D1 database. `schema2.sql` describes the complete `water_systems` table, including `lat`, `lng` and `note`; `schema4.sql` adds market-price history; and `schema5.sql` creates only Phase 1 telemetry objects and is safe to replay.

Before applying anything to an existing D1 database, inspect `PRAGMA table_info(water_systems)` against a read-only snapshot. If any legacy water column is missing, prepare and review a separate one-column `ALTER TABLE` repair for that exact snapshot; do not bundle an unverified legacy repair into the telemetry migration.

## Local validation

Run `npm run check` from the repository root and run Python `unittest` discovery for `worker/tests/test_*.py`.

The owner canary receives real Pi 5 telemetry in DATA ONLY mode. Do not deploy or cut over production until the separate production-readiness, owner-account and migration gates are approved.

## Owner real-data staging

- Open only from the local Windows host with `?api=owner-canary&sensorData=real&qa=staging`.
- The owner-canary login/session and per-account browser cache use a separate namespace from the unchanged legacy-production frontend.
- The page requires a real owner session before `sensor_current` or `sensor_history` can return data.
- Pause `farmultimate-telemetry-forwarder.service` before running `scripts/migrate-owner-sensor-canary.ps1`; the script requires both confirmation switches, rejects synthetic owner accounts and independently verifies the transferred device, history, latest row, expired test sessions and zero unsafe samples.
- Restart the forwarder immediately after the migration attempt, including on failure, then verify a new accepted sample under the owner account.
- This staging route does not enable output control and is not a production cutover.

Owner enrollment and real-data migration passed on 2026-08-27. The active Pi 5 device, latest row and 274 historical rows moved to the owner account; test devices/sessions were disabled, authenticated owner API checks passed and sample 275 was accepted after the forwarder restarted. `scripts/verify-owner-session-canary.ps1` performs API verification with a random short-lived session created only in process memory and expires it immediately without using the owner's password or browser session.
