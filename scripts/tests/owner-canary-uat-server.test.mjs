import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPath = path.join(repositoryRoot, "scripts", "owner-canary-uat-server.mjs");
const testToken = "a".repeat(64);

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function freePort() {
  const probe = createServer();
  const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  return port;
}

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`UAT server startup timeout: ${stderr}`)), 10000);
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
      if (stdout.includes("OWNER_CANARY_UAT_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.once("exit", code => {
      if (!stdout.includes("OWNER_CANARY_UAT_READY")) {
        clearTimeout(timer);
        reject(new Error(`UAT server exited early (${code}): ${stderr}`));
      }
    });
  });
}

test("owner-canary UAT server isolates credentials and rejects write actions", async () => {
  const upstreamRequests = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    upstreamRequests.push(payload);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      data: payload.action === "health"
        ? { mode: "SENSOR_PHASE1_READ_ONLY", output_control_allowed: false }
        : { output_control_allowed: false, rows: [] }
    }));
  });
  const upstreamPort = await listen(upstream);
  const uatPort = await freePort();
  const upstreamUrl = `http://127.0.0.1:${upstreamPort}/api`;
  const child = spawn(process.execPath, [serverPath], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      FARMULTIMATE_UAT_API: upstreamUrl,
      FARMULTIMATE_UAT_TOKEN: testToken,
      FARMULTIMATE_UAT_PORT: String(uatPort)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForReady(child);
    const base = `http://127.0.0.1:${uatPort}`;

    const index = await fetch(`${base}/?api=owner-canary&sensorData=real`).then(response => response.text());
    const bootstrapAt = index.indexOf("/__uat-bootstrap.js");
    const runtimeAt = index.indexOf("js/runtime-config.js");
    const authAt = index.indexOf("js/auth.js");
    const sessionAt = index.indexOf("/__uat-session.js");
    const sensorsAt = index.indexOf("js/sensors.js");
    assert.ok(bootstrapAt >= 0 && bootstrapAt < runtimeAt);
    assert.ok(authAt < sessionAt && sessionAt < sensorsAt);

    const auth = await fetch(`${base}/js/auth.js`).then(response => response.text());
    assert.match(auth, /Auth\.session && !globalThis\.FARMULTIMATE_LOCAL_UAT/);

    const injected = [
      await fetch(`${base}/__uat-bootstrap.js`).then(response => response.text()),
      await fetch(`${base}/__uat-session.js`).then(response => response.text())
    ].join("\n");
    assert.doesNotMatch(injected, new RegExp(testToken));
    assert.doesNotMatch(injected, new RegExp(upstreamUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(injected, /LOCAL_PROXY_ONLY/);

    const health = await fetch(`${base}/__owner-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "health", token: "BROWSER_SENTINEL" })
    });
    assert.equal(health.status, 200);

    const history = await fetch(`${base}/__owner-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sensor_history", source_id: "OTHER", hours: 999, limit: 9999 })
    });
    assert.equal(history.status, 200);

    const forbidden = await fetch(`${base}/__owner-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", token: "BROWSER_SENTINEL" })
    });
    assert.equal(forbidden.status, 403);

    const crossOrigin = await fetch(`${base}/__owner-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.invalid" },
      body: JSON.stringify({ action: "health" })
    });
    assert.equal(crossOrigin.status, 403);

    assert.equal(upstreamRequests.length, 2);
    assert.equal(upstreamRequests[0].token, testToken);
    assert.equal(upstreamRequests[1].token, testToken);
    assert.equal(upstreamRequests[1].source_id, "MAIN_WATER_LEVEL_PI_ZERO_01");
    assert.equal(upstreamRequests[1].hours, 168);
    assert.equal(upstreamRequests[1].limit, 400);

    const evidence = await fetch(`${base}/__uat-evidence`).then(response => response.json());
    assert.deepEqual(evidence.allowedCalls, { health: 1, sensor_current: 0, sensor_history: 1 });
    assert.equal(evidence.rejected, 2);
    assert.equal(evidence.upstreamErrors, 0);

    const shutdown = await fetch(`${base}/__uat-shutdown`, { method: "POST" });
    assert.equal(shutdown.status, 200);
    const [exitCode] = await once(child, "exit");
    assert.equal(exitCode, 0);
  } finally {
    if (child.exitCode === null) child.kill();
    await new Promise(resolve => upstream.close(resolve));
  }
});
