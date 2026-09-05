import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../worker/frontend-owner.js";

test("owner Worker serves static assets without contacting the API", async () => {
  const response = await worker.fetch(new Request("https://app.example/"), {
    ASSETS: { fetch: async () => new Response("app") },
    FARMULTIMATE_API: { fetch: () => { throw new Error("unexpected upstream"); } }
  });
  assert.equal(await response.text(), "app");
});

test("owner Worker forwards POST /api body and auth header unchanged", async () => {
  const request = new Request("https://app.example/api", {
    method: "POST", headers: { Authorization: "Bearer synthetic-test" },
    body: JSON.stringify({ action: "sensor_current" })
  });
  const response = await worker.fetch(request, {
    FARMULTIMATE_API: { fetch: async forwarded => {
      assert.equal(forwarded.url, request.url);
      assert.equal(forwarded.headers.get("Authorization"), "Bearer synthetic-test");
      assert.deepEqual(await forwarded.json(), { action: "sensor_current" });
      return Response.json({ ok: true });
    } }
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
});

test("GET health uses the side-effect-free upstream health action", async () => {
  const response = await worker.fetch(new Request("https://app.example/api/health"), {
    FARMULTIMATE_API: { fetch: async request => {
      assert.equal(request.method, "POST");
      assert.deepEqual(await request.json(), { action: "health" });
      return Response.json({ ok: true, data: { output_control_allowed: false } });
    } }
  });
  assert.equal((await response.json()).data.output_control_allowed, false);
});

test("photo route preserves the path used in upstream-generated image URLs", async () => {
  const response = await worker.fetch(new Request("https://app.example/photo/synthetic.png"), {
    FARMULTIMATE_API: { fetch: async request => {
      assert.equal(new URL(request.url).pathname, "/photo/synthetic.png");
      return new Response("image", { headers: { "Content-Type": "image/png" } });
    } }
  });
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(await response.text(), "image");
});

test("missing or failing upstream never falls back to the HTML app", async () => {
  const missing = await worker.fetch(new Request("https://app.example/api"), {});
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error, "API_SERVICE_UNAVAILABLE");
  const failed = await worker.fetch(new Request("https://app.example/api"), {
    FARMULTIMATE_API: { fetch: async () => { throw new Error("private upstream detail"); } }
  });
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { ok: false, error: "API_UPSTREAM_FAILED" });
});
