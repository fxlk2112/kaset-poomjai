# Owner electricity dashboard

Task `OWNER-ENERGY-001`; owner SUCHA; feature `pick/energy-dashboard-v1`.
Source `9e821b456b028150c1e8aa05eb8d578e775cd0c4`, including the deployed owner features and relay v2. Fresh `origin/develop@40721b5` remains an ancestor. Pick explicitly approved dashboard publication on 7 September 2026; the existing one-time development approval covers the feature push and draft PR. No protected branch merge.

## What the owner gets

Open the existing main website → FLYTECH → **พลังงานไฟฟ้า**. The new fourth map button opens a separate page. Sign in with the existing sensor-owner account; login/cancel returns to energy. The page shows current kW, accumulated import kWh, PF, Hz, L1/L2/L3 voltage and current, and the last 24 hours of measured power. Multiple commissioned circuit sources have a selector. Refresh is bounded to 30 seconds while visible, with a 12-second request timeout and immediate loading feedback.

Missing, faulted, unverified and stale readings do not become zero or current values. A measured zero remains zero. Graph points use the last actual reading of each 15-minute bucket; gaps longer than 20 minutes and fault samples break the trace. Accumulated import kWh is not today's consumption or a cost estimate. History is not persisted in the browser, and an account change invalidates pending responses and clears private data.

## Current installation truth

The owner supplied marketplace screenshots for Acrel ADL400N-CT/D16 and said the device arrived. These are not nameplate, CT ratio, wiring or calibration evidence. No exact current rating is asserted on the page.

Read-only Pi preflight on this release found **no `energy_samples` table and no live meter samples**. The older root project has prepared ADL400N read-only decoder, collector and Pi ingestion candidates; they were not installed or commissioned by this dashboard task. The website therefore reports `INGEST_NOT_READY`, in Thai as waiting for meter connection. No production fixture rows were inserted.

The remaining field step is to have a qualified installer verify the actual meter/three CT identities, installation and phase/direction/ratio, isolated RS485 interface, serial settings and register word order against the display. Then commission the existing read-only acquisition path into Pi 5. This release does not wire mains, enable the reader, change meter settings, infer pump state or command any relay.

Manufacturer reference: [Acrel ADL400N-CT product](https://www.acrelenergy.com/products/three-phase-energy-meter-ADL400N-CT/) and [Acrel ADL400N-CT manual](https://www.acrel-group.com/acrel-group/2025/07/22/adl400n-ct-2manual.pdf). The family supports electrical parameter measurement and RS485 Modbus RTU; actual installed variant still requires verification.

## Data and access

The existing outbound Pi monitor publisher adds an optional energy section to its owner-private health snapshot. It uses a SQLite read-only connection and `PRAGMA query_only`; a missing table or incompatible optional energy schema cannot break health publishing. Existing health/relay observation fields remain intact. No database migration, new credential, inbound listener, service configuration or firmware change.

The existing `/api/monitor/publish` credential and `/api/monitor/read` owner-session checks are reused. The Worker strictly projects known circuit identities, model/register profile, timestamps, commissioning flags, bounded history and finite metrics. It removes raw identity/free text and disallows control capability. It recalculates freshness on reads; malformed energy is isolated from health. Public weather never includes energy. Only the same owner-main Worker is deployed; the separate API backend and relay control modules remain unchanged.

## Verification

- 124 JavaScript/Worker tests and nine relay messages pass.
- Six Python monitor tests pass, including absent/schema-invalid energy input, read-only sample projection and preserved real zero.
- Isolated Chrome at 390×844, 840×1180 and 1280×900: four map buttons, separate page, login return, missing data, measured fixture, stale fixture, back to relay panel; no overflow or script errors.
- `qa/energy/*-measured-fixture.png` has a visible QA banner; all authenticated browser QA is synthetic. No owner session was extracted or fabricated on production.
- `qa/energy/pi-preflight.json`: current real Pi no-energy state, two health sources and two relay observation modules preserved; candidate snapshot size below the existing 512 KB cap.
- Live asset hashes, actual cloud snapshot and publisher readback are recorded separately after publication. Physical meter-to-browser readings remain unverified until field setup.

## Rollback

Previous frontend Worker version: `28e8dc23-78ab-452e-81a2-e0d04f2fae27`. Roll back only that frontend Worker if needed; keep the existing backend and relay service unchanged. The optional energy field in health snapshots is ignored by the previous frontend.

Before replacing only `/opt/sucha-owner-monitor/publisher.py`, verify its hash equals the source checkpoint and preserve `publisher.py.pre-energy-20260907` beside it. To undo the optional sender extension, restore that file with its prior permissions and run the existing monitor service once. Its timer and service configuration require no edits. Do not delete tables, telemetry or relay audit rows.
