import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { onRequest } from "../api/[[path]].js";

test("fails closed when the service binding is missing", async () => {
  const request = new Request("https://dashboard.example.invalid/api", { method: "POST" });
  const response = await onRequest({ request, env: {} });

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "API_SERVICE_UNAVAILABLE"
  });
});

test("passes the original request through the internal service binding", async () => {
  const request = new Request("https://dashboard.example.invalid/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "health" })
  });
  let received;
  const expected = Response.json({ ok: true, source: "worker" }, { status: 202 });

  const response = await onRequest({
    request,
    env: {
      FARMULTIMATE_API: {
        fetch(value) {
          received = value;
          return expected;
        }
      }
    }
  });

  assert.equal(received, request);
  assert.equal(response, expected);
  assert.equal(response.status, 202);
});

test("does not expose an upstream error or public backend address", async () => {
  const response = await onRequest({
    request: new Request("https://dashboard.example.invalid/api"),
    env: {
      FARMULTIMATE_API: {
        fetch() {
          throw new Error("private upstream detail");
        }
      }
    }
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, error: "API_UPSTREAM_FAILED" });

  const source = readFileSync(new URL("../api/[[path]].js", import.meta.url), "utf8");
  assert.equal(/https?:\/\//i.test(source), false);
});
