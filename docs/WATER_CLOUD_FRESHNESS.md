# OWNER-WATER-FRESHNESS-004

Owner: SUCHA. Source: 488da97. Date: 2026-09-11.

## Problem and evidence

The public reservoir view became STALE between otherwise successful publishes.
Pi 5 had a water observation less than one minute old while the Cloud view was
about four minutes old. The outbound-only water forwarder was active, configured
with CLOUD_MIN_INTERVAL_SECONDS=300, and accepted deliveries were five minutes
apart (occasionally six due to sample timing). The UI's three-minute freshness
limit was working as designed. Energy observations and public assets were current.

## Applied repair

Changed only CLOUD_MIN_INTERVAL_SECONDS from 300 to 60 in the existing Pi 5
forwarder environment file. Kept its polling interval at 30 seconds. Preserved
all other bytes, file ownership/permissions and credentials; created a local
backup. Restarted only farmultimate-telemetry-forwarder.service. The water reader
remained active. No backend/frontend release, source database changes, sensor
calibration, controller restart or hardware commands.

The first apply verification raced process startup and automatically restored
the prior configuration. The second verified the effective process environment
after startup, confirming 60 seconds and an active service.

This is the approved owner runtime override; the legacy standalone install
package still defaults to 300 seconds. Preserve the 60-second owner override
when reinstalling that package. More frequent actual observations are uploaded;
no timestamps or freshness limits are adjusted to conceal stale data.

## Verification

- Effective running interval: 60 seconds; source reader active.
- First accepted Cloud delivery after repair: 2026-09-11T15:43:28Z.
- Authenticated public web view changed from STALE to LIVE with a 16-second-old
  reading (22:43 local time). Pending outbox: zero.
- No code changes; validation is configuration/readback, not a new test-suite run.
- Consecutive delivery and final readback recorded below.

Safety: DATA_ONLY / SAFE_OFF / no actuator actions.

- Subsequent delivery 2026-09-11T15:44:28Z was accepted, 60 seconds after the
  prior observation. Outbox remained empty. Public view independently refreshed
  after this delivery. No change to public asset release 266ac8e.
