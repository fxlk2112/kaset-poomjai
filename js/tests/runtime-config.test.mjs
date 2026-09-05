import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../runtime-config.js", import.meta.url), "utf8");
const publicApi = "https://api.example.invalid";
const ownerApi = "https://owner-api.example.invalid";
const stagingHost = "owner-staging.example.invalid";

function runtimeFor(href, config = {}) {
  const context = {
    URL,
    location: { href },
    FARMULTIMATE_PUBLIC_API_URL: publicApi,
    FarmUltimateLocalConfig: config
  };
  vm.runInNewContext(source, context);
  return context.FarmUltimateRuntime;
}

function ownerConfig() {
  return {
    ownerCanaryApiUrl: ownerApi,
    ownerStagingHosts: [stagingHost],
    localPiHealthApiUrl: "http://127.0.0.1:8789/health",
    localWaterBalanceApiUrl: "http://127.0.0.1:8789/water-balance"
  };
}

test("shared localhost defaults to public API with private integrations disabled", () => {
  const runtime = runtimeFor("http://127.0.0.1:4173/?sensorPreview=1");
  assert.equal(runtime.apiMode, "local-public");
  assert.equal(runtime.apiUrl, publicApi);
  assert.equal(runtime.isSameOriginApi, false);
  assert.equal(runtime.isOwnerCanary, false);
  assert.equal(runtime.hasLocalPiHealth, false);
  assert.equal(runtime.piHealthApiUrl, "");
  assert.equal(runtime.hasLocalWaterBalance, false);
  assert.equal(runtime.waterBalanceApiUrl, "");
});

test("localhost can select a machine-local owner canary configuration", () => {
  const runtime = runtimeFor("http://127.0.0.1:4173/?api=owner-canary", ownerConfig());
  assert.equal(runtime.apiMode, "owner-canary");
  assert.equal(runtime.isOwnerCanary, true);
  assert.equal(runtime.apiUrl, ownerApi);
  assert.equal(runtime.isRealSensorStaging, false);
  assert.equal(runtime.storageNamespace, "owner-canary");
  assert.equal(runtime.hasLocalPiHealth, true);
  assert.equal(runtime.waterBalanceSource, "PI5_LIVE_GET_ONLY");
});

test("real sensor staging remains an explicit localhost request", () => {
  const runtime = runtimeFor(
    "http://localhost:4173/?api=owner-canary&sensorData=real",
    ownerConfig()
  );
  assert.equal(runtime.isOwnerCanary, true);
  assert.equal(runtime.isRealSensorStaging, true);
});

test("only an exact configured cloud staging host selects owner telemetry", () => {
  const runtime = runtimeFor(`https://${stagingHost}/`, ownerConfig());
  assert.equal(runtime.apiMode, "same-origin");
  assert.equal(runtime.isCloudStaging, true);
  assert.equal(runtime.isRealSensorStaging, true);
  assert.equal(runtime.apiUrl, `https://${stagingHost}/api`);
  assert.equal(runtime.isSameOriginApi, true);
  assert.equal(runtime.hasLocalPiHealth, false);
  assert.equal(runtime.hasLocalWaterBalance, false);

  const lookalike = runtimeFor(`https://${stagingHost}.evil.invalid/`, ownerConfig());
  assert.equal(lookalike.apiMode, "same-origin");
  assert.equal(lookalike.isCloudStaging, false);
  assert.equal(lookalike.isOwnerCanary, false);
  assert.equal(lookalike.apiUrl, `https://${stagingHost}.evil.invalid/api`);
});

test("deployed pages cannot switch API through query parameters alone", () => {
  const runtime = runtimeFor("https://dashboard.example.invalid/?api=owner-canary", ownerConfig());
  assert.equal(runtime.apiMode, "same-origin");
  assert.equal(runtime.isOwnerCanary, false);
  assert.equal(runtime.apiUrl, "https://dashboard.example.invalid/api");
  assert.equal(runtime.isSameOriginApi, true);
});

test("an invalid machine-local endpoint fails closed", () => {
  const config = ownerConfig();
  config.ownerCanaryApiUrl = "not-a-url";
  const runtime = runtimeFor("http://localhost:4173/?api=owner-canary", config);
  assert.equal(runtime.isOwnerCanary, false);
  assert.equal(runtime.apiUrl, publicApi);
});

test("a deployed page ignores a public API global and stays on its own origin", () => {
  const runtime = runtimeFor("https://app.example.invalid/stock");
  assert.equal(runtime.apiMode, "same-origin");
  assert.equal(runtime.apiUrl, "https://app.example.invalid/api");
  assert.equal(runtime.apiUrl.includes("api.example.invalid"), false);
});
