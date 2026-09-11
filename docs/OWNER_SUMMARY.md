# OWNER-SUMMARY-005 — remote owner overview

Owner: SUCHA. Branch: `pick/owner-summary-v1`. Source: `188b03b`; current
`origin/develop@40721b5` is an ancestor. On 2026-09-12 Pick explicitly requested
implementation and publication to the existing owner main website.

## Behavior

Open FLYTECH → สรุปสำหรับเจ้าของ on the map, or `/?view=owner-summary` on
the main origin. The page uses the existing owner account and returns to the
summary after login. It shows water capacity/depth/estimated volume, actual
Bangkok-calendar-day energy counter growth, Pi 5/Pi Zero health and a field-visit
preparation list. Detailed water, energy and health views stay accessible.

Only two existing read requests per refresh: `sensor_current` and `/monitor/read`
with 24-hour history. Refresh coalesces in-flight calls, checks at most once per
minute, and pauses while hidden. The sensor page's additional polling is skipped
while the summary is active. Re-entering account context discards previous data
and late responses. Either read can fail independently; expired access clears both.
No credentials or telemetry are copied to new persistent browser storage.

Freshness is recalculated from each observed timestamp (180 seconds); invalid
future times, faults and stale values do not become current readings. Old times
remain visible. Historical energy growth is labelled with actual first/last
points and coverage, even when the latest source becomes stale. There is no
midnight interpolation: only points in the current Bangkok calendar day count.
Fewer than two points, missing/fault values or counter decreases suppress totals.
Large gaps are labelled. Negative power is preserved and is not proof of export.

Meter commissioning is pending. Circuit assignment, CT verification and display
comparison are not inferred. Reservoir geometry is still uncalibrated. Field
tasks are a preparation list, not completion records. No new alerts are sent.

## Scope and verification

Frontend only; no Worker logic/config, D1 schema/data migration, backend deploy,
Pi service/config or actuator changes. This release updates the public main
Worker assets; LAN retains its previous release and remains available.
DATA_ONLY / SAFE_OFF / Raspberry Pi 5 sole writer.

- Unit/contract checks: 141 passing and 9 valid relay messages.
- Synthetic fixture: fresh, stale, failed reads and signed-out states; layout
  widths 390, 840, 1280. Real-app navigation/login return checked separately.
- Screenshots inspected through Codex browser. Its screenshot renderer has a
  Windows scale/stitching artifact; DOM width measurements independently verify
  no horizontal overflow. This is not physical iPad/Safari acceptance.
- Production build/version/hash/auth readback appended after deployment.

## Release

Pending release and independent readback. Preserve previous owner frontend
version for scoped rollback; do not roll back API or data storage.
