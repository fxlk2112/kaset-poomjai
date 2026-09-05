import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const requestedPort = Number(process.env.FARMULTIMATE_UAT_PORT || 4174);
const port = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  ? requestedPort
  : 4174;
const upstreamApi = String(process.env.FARMULTIMATE_UAT_API || "").trim();
const upstreamToken = String(process.env.FARMULTIMATE_UAT_TOKEN || "").trim();
const sourceId = "MAIN_WATER_LEVEL_PI_ZERO_01";
const allowedActions = new Set(["health", "sensor_current", "sensor_history"]);
const metrics = {
  health: 0,
  sensor_current: 0,
  sensor_history: 0,
  rejected: 0,
  upstreamErrors: 0
};
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function validUpstream(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch (error) {
    return false;
  }
}

if (!validUpstream(upstreamApi) || !/^[0-9a-f]{64}$/i.test(upstreamToken)) {
  throw new Error("Owner-canary UAT credentials are missing or invalid.");
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, "application/json; charset=utf-8", JSON.stringify(value));
}

function isTrustedOrigin(request) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return true;
  return origin === `http://${host}:${port}` || origin === `http://localhost:${port}`;
}

async function readJsonBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16 * 1024) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function proxyOwnerApi(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }
  if (!isTrustedOrigin(request)) {
    metrics.rejected += 1;
    sendJson(response, 403, { ok: false, error: "LOCAL_ORIGIN_REQUIRED" });
    return;
  }

  let incoming;
  try {
    incoming = await readJsonBody(request);
  } catch (error) {
    sendJson(response, error.message === "REQUEST_TOO_LARGE" ? 413 : 400, { ok: false, error: "INVALID_REQUEST" });
    return;
  }

  const action = String(incoming && incoming.action || "");
  if (!allowedActions.has(action)) {
    metrics.rejected += 1;
    sendJson(response, 403, { ok: false, error: "READ_ONLY_UAT_ACTION_REJECTED" });
    return;
  }
  metrics[action] += 1;

  const payload = { action, token: upstreamToken };
  if (action === "sensor_current") payload.source_id = sourceId;
  if (action === "sensor_history") {
    payload.source_id = sourceId;
    payload.hours = Math.min(168, Math.max(1, Number(incoming.hours) || 24));
    payload.limit = Math.min(400, Math.max(1, Number(incoming.limit) || 400));
  }

  try {
    const upstream = await fetch(upstreamApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(15000)
    });
    const text = await upstream.text();
    if (text.includes(upstreamToken) || text.includes(upstreamApi)) {
      throw new Error("SENSITIVE_UPSTREAM_RESPONSE");
    }
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { throw new Error("INVALID_UPSTREAM_RESPONSE"); }
    sendJson(response, upstream.ok ? 200 : 502, parsed);
  } catch (error) {
    metrics.upstreamErrors += 1;
    sendJson(response, 502, { ok: false, error: "OWNER_CANARY_UNAVAILABLE" });
  }
}

function uatBootstrap() {
  return `"use strict";
globalThis.FARMULTIMATE_LOCAL_UAT = true;
globalThis.FarmUltimateLocalConfig = Object.freeze({
  ownerCanaryApiUrl: location.origin + "/__owner-api",
  ownerStagingHosts: []
});\n`;
}

function uatSession() {
  return `"use strict";
if (typeof Auth !== "undefined") {
  Auth.session = Object.freeze({
    token: "LOCAL_PROXY_ONLY",
    email: "owner-uat@local.invalid",
    name: "Owner Sensor UAT",
    localUat: true
  });
  Auth.suppress = true;
}\n`;
}

async function transformedIndex() {
  const source = await readFile(path.join(root, "index.html"), "utf8");
  const withBootstrap = source.replace(
    /(<script\s+src=["']js\/runtime-config\.js[^>]*><\/script>)/i,
    '<script src="/__uat-bootstrap.js"></script>\n  $1'
  );
  return withBootstrap.replace(
    /(<script\s+src=["']js\/auth\.js[^>]*><\/script>)/i,
    '$1\n  <script src="/__uat-session.js"></script>'
  );
}

async function transformedAuth() {
  const source = await readFile(path.join(root, "js", "auth.js"), "utf8");
  const original = "} else if (Auth.session) {";
  if (!source.includes(original)) throw new Error("AUTH_UAT_GUARD_NOT_FOUND");
  return source.replace(original, "} else if (Auth.session && !globalThis.FARMULTIMATE_LOCAL_UAT) {");
}

async function serveStatic(pathname, request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "text/plain; charset=utf-8", "Method not allowed");
    return;
  }

  if (pathname === "/__uat-bootstrap.js") {
    send(response, 200, types[".js"], request.method === "HEAD" ? "" : uatBootstrap());
    return;
  }
  if (pathname === "/__uat-session.js") {
    send(response, 200, types[".js"], request.method === "HEAD" ? "" : uatSession());
    return;
  }
  if (pathname === "/" || pathname === "/index.html") {
    const html = await transformedIndex();
    send(response, 200, types[".html"], request.method === "HEAD" ? "" : html);
    return;
  }
  if (pathname === "/js/auth.js") {
    const script = await transformedAuth();
    send(response, 200, types[".js"], request.method === "HEAD" ? "" : script);
    return;
  }

  const relative = pathname.replace(/^\/+/, "");
  if (!relative || relative.split(/[\\/]/).some(part => part.startsWith("."))) {
    send(response, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  let target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error("OUTSIDE_ROOT");
  const info = await stat(target);
  if (info.isDirectory()) target = path.join(target, "index.html");
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff"
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(target).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", `http://${host}`).pathname);
    if (pathname === "/__uat-shutdown") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
        return;
      }
      if (!isTrustedOrigin(request)) {
        sendJson(response, 403, { ok: false, error: "LOCAL_ORIGIN_REQUIRED" });
        return;
      }
      sendJson(response, 200, { ok: true });
      setTimeout(() => server.close(() => process.exit(0)), 25);
    }
    else if (pathname === "/__uat-evidence") {
      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        policy: "READ_ONLY_ALLOWLIST",
        allowedCalls: {
          health: metrics.health,
          sensor_current: metrics.sensor_current,
          sensor_history: metrics.sensor_history
        },
        rejected: metrics.rejected,
        upstreamErrors: metrics.upstreamErrors
      });
    }
    else if (pathname === "/__owner-api") await proxyOwnerApi(request, response);
    else await serveStatic(pathname, request, response);
  } catch (error) {
    send(response, 404, "text/plain; charset=utf-8", "Not found");
  }
});

server.listen(port, host, () => {
  console.log(`OWNER_CANARY_UAT_READY http://${host}:${port}/?api=owner-canary&sensorData=real&qa=staging`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
