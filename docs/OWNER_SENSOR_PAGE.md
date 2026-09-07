# Owner sensor page

Task `OWNER-SENSOR-001`, owner SUCHA, branch `pick/owner-sensor-page-v1`.
Source integration is `40721b5`; this release includes the already deployed owner gateway from PR #5 (`3f60172`). Target: the existing owner main Worker, using the same origin and session namespace.

## Behavior

The sensor page previously returned before checking health whenever no owner session existed. It therefore displayed an indefinite connection check with blank readings. Public health and forecast loading now run independently of the owner session, while current/history reads still require the existing authenticated account.

The page provides a sensor-specific sign-in entry, returns to the pond after successful login, and distinguishes expired sessions, accounts without a linked source, no readings, old readings, failed requests and a failed history request. It includes manual refresh and 24-hour/7-day history selection. The page checks telemetry every minute while visible; this does not change the field publisher's cadence.

Changing accounts clears cached telemetry immediately and discards responses from the old session. Read requests have a deadline. A failed history request does not erase a successful current reading. Unsafe backend health blocks private reads. Missing readings no longer draw a zero-depth line. Expired forecast snapshots are labelled and their predictions are withheld until a new snapshot exists.

## Validation before release

- `TZ=UTC npm run check`: 85 tests passed; relay 9 messages passed.
- Isolated browser QA at 1280 x 720 and 390 x 844: sign-in entry, return to pond, current/history rendering, manual refresh, 7-day history, history failure and expired-session reauthentication passed; no horizontal overflow or JavaScript/console errors.
- Authenticated browser scenarios used **synthetic local responses**; no real account credentials were entered and no real login, cloud save or data write was performed by QA.
- Screenshots: [mobile signed-out state](../qa/owner-sensor-page/mobile-signed-out.png), [desktop authenticated fixture](../qa/owner-sensor-page/desktop-authenticated-fixture.png). The authenticated screenshot is explicitly labelled as synthetic QA.
- Read-only D1 aggregate audit confirmed one active source has incoming readings. The second audit found an observed sample at `2026-09-06T01:10:48.440Z`, age 131 seconds at query time, against a 180-second stale threshold. This is a point-in-time ingestion check, not a continuous freshness guarantee or a field calibration sign-off.
- Real owner login and the corresponding private telemetry readback in Pick's browser remain for the owner to verify. Credentials must be entered only in the app, never in chat or Git.

## Safety and deployment boundary

`DATA_ONLY / SAFE_OFF`. This is a frontend change only. The API Worker, database schema/data, sensor ingestion, hardware configuration, protected branches and old Pages deployment are unchanged. No API key, private endpoint or field coordinate is published.

Deployed to the existing owner main Worker on 2026-09-06: code `f60bfd2fa5bcb14ac71b5296de85d77e4fd07229`, version `8eb56284-a1af-45f3-855a-043871923279`. Independent live readback matched the build/source commits and five changed/core asset hashes. Live desktop/mobile signed-out and login-entry checks passed with no overflow or script/console errors. Backend version is unchanged. The previous frontend rollback version is `329c90e5-7298-499d-9ab6-54bdf8774d7f`.

## Owner use

Open the main app, select water management, then open the pond. If the page asks for login, use the existing account linked to the sensor. It returns to the pond automatically. A green website connection badge confirms the API is reachable; the reading's timestamp and status indicate sensor freshness separately.
