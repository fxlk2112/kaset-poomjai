# Owner Sensor Local UAT

## Why `index.html` does not show owner telemetry by itself

Opening `index.html` directly has no authenticated owner session and no machine-local owner-canary endpoint. This is intentional: a static file must not contain a real API endpoint or session token. The sensor screen therefore stays empty until an authorized local UAT process supplies both values in memory.

## Safe local flow

`scripts/owner-canary-uat-server.mjs` is a loopback-only static server and read-only proxy. An authorized machine-local launcher supplies these process environment variables without writing them to Git:

- `FARMULTIMATE_UAT_API`
- `FARMULTIMATE_UAT_TOKEN`
- optional `FARMULTIMATE_UAT_PORT` (default `4174`)

The browser opens:

```text
http://127.0.0.1:4174/?api=owner-canary&sensorData=real&qa=staging
```

The browser receives only the sentinel `LOCAL_PROXY_ONLY`. The proxy replaces it with the temporary owner session in process memory and allows only:

- `health`
- `sensor_current`
- `sensor_history`

All other API actions return `403 READ_ONLY_UAT_ACTION_REJECTED`. The proxy binds only to `127.0.0.1`, rejects browser requests from other origins, caps history range and row count, prevents upstream credentials from being reflected, and exposes aggregate request evidence at `/__uat-evidence`.

The launcher is responsible for issuing a short-lived session, shutting the server down through `POST /__uat-shutdown`, expiring the session in `finally`, and clearing the environment variables. Never place the endpoint or session in source, a command pasted into chat, browser storage, screenshots, logs, or relay messages.

## Production boundary

The deployed app continues to use same-origin `/api` through the `FARMULTIMATE_API` Service Binding. This local UAT tool does not configure Cloudflare Pages, deploy a Worker, merge to `master`, or enable output control.

Safety state: `DATA_ONLY / SAFE_OFF / output_control_allowed=false / NOT_DEPLOYED`.
