# Owner main application

Pick selected the existing owner Worker as the main FARMULTIMATE application on 2026-09-05 and explicitly approved updating it from the latest `develop`.

- Main URL: https://flytech-farmultimate-owner-staging.pongnarin-pa.workers.dev/
- Worker: `flytech-farmultimate-owner-staging`. Keep this resource name to preserve the hostname and browser storage.
- Task: `OWNER-MAIN-001`; owner: SUCHA.
- Branch: `pick/owner-main-develop-40721b5`.
- Integration source: `40721b5bfa71670ea97aba0d247e5616277c018a`.
- Legacy Pages PR #4 is superseded as the active release target. Do not merge it to deploy the owner's main application.

## Release boundary

The release uploads an allowlisted frontend package and a small Worker gateway. `/api` and `/photo/*` use the existing `FARMULTIMATE_API` service binding to `flytech-farmultimate-api-canary`. GET `/api/health` calls the upstream's side-effect-free health action. API responses are not cached by the gateway or service worker.

No API Worker code, database migration, actual company record, sensor ingestion, cron, hardware command, DNS route, or old Pages deployment is changed. The existing API version is `87ab09f5-1da5-43b3-81c1-30c5a858b11f`; its configured output flag was independently read as false.

The generated frontend configuration preserves the existing `owner-canary` browser session namespace and owner sensor mode. All browser API calls resolve to the main app's own `/api`. The asset package excludes tests, Worker source, credentials, repository metadata and local field files. The forecast JSON remains a dated forecast snapshot; deployment is not evidence of fresh station data.

## Build and deploy

1. Fetch `origin` quietly, verify `origin/develop`, and preserve existing worktrees. Confirm the source commit has not changed before release.
2. Run `TZ=UTC npm run check`, then `npm run build:owner` from a clean, committed release branch.
3. Run Wrangler v4 with the existing Cloudflare authentication profile:

```text
wrangler deploy --config wrangler.owner-main.jsonc --dry-run --keep-vars
wrangler deploy --config wrangler.owner-main.jsonc --profile default --keep-vars
```

Only run the real deploy with owner authorization for this target. Keep GitHub protected branches intact; a manual Worker release does not merge its supporting code into `develop` or `master`.

4. Read `/build.json` and compare its integration and release commits. Check GET `/api/health`, POST `/api` with `{"action":"health"}`, the forecast asset, desktop/mobile Home, Master Map, Pond and Stock views, and the unchanged backend version.
5. Record the deployed version in `COLLAB_STATUS.md` and the source PR. Do not claim authenticated cloud write or physical sensor verification from these read-only checks.

## Rollback and known limits

The previous frontend version is `f062eb54-7ef1-481f-80a1-9ec40752a848`. Rollback, if needed and authorized, must target only the frontend Worker; do not roll back the API or data store.

The existing canary has D1 but no R2 photo binding. Photo upload/storage and authenticated Commerce/cloud-sync flows are not validated by this release. Real sensor freshness requires a valid owner session and incoming telemetry; `DATA_ONLY / SAFE_OFF` remains mandatory.
