# Phase 1 telemetry API

This branch is local-only and has not been deployed.

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

Apply `schema.sql`, `schema2.sql`, `schema3.sql`, then `schema4.sql` to an empty D1 database. For the existing database, apply `schema4.sql` exactly once: it first adds the three missing `water_systems` columns (`lat`, `lng`, `note`) and then creates the telemetry tables. Verify the current schema against a D1 snapshot before any production migration.

## Local validation

Run `npm run check` from the repository root and run Python `unittest` discovery for `worker/tests/test_*.py`.

Do not deploy this branch until a separate production-readiness and data-migration approval is given.
