import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("current application keeps the account gate and login form", async () => {
  const html = await source("index.html");
  assert.equal(html.includes('id="authGate"'), true);
  assert.equal(html.includes("auth-locked"), true);
  assert.equal(/type=["']password["']/.test(html), true);
});

test("dashboard renderer does not require a cloud session", async () => {
  const app = await source("js/app.js");
  assert.match(app, /Direct-open: หน้าแดชบอร์ดและข้อมูล local/);
  assert.equal(app.includes('if (typeof Auth === "undefined" || !Auth.session) {'), false);
});

test("missing session opens the gate and preview bypass requires loopback", async () => {
  const auth = await source("js/auth.js");
  assert.ok(auth.includes('if (!Auth.session) { Auth.showGate(); return; }'));
  assert.ok(auth.includes('return localHost &&'));
  assert.ok(auth.includes('const AUTH_API = FarmUltimateRuntime.apiUrl;'));
});
