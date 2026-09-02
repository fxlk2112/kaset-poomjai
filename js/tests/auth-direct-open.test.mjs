import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("dashboard has no blocking login page", async () => {
  const html = await source("index.html");
  assert.equal(html.includes('id="authGate"'), false);
  assert.equal(html.includes("auth-locked"), false);
  assert.equal(/type=["']password["']/.test(html), false);
});

test("dashboard renderer does not require a cloud session", async () => {
  const app = await source("js/app.js");
  assert.match(app, /Direct-open: หน้าแดชบอร์ดและข้อมูล local/);
  assert.equal(app.includes('if (typeof Auth === "undefined" || !Auth.session) {'), false);
});

test("expired or missing cloud session cannot reopen a login gate", async () => {
  const auth = await source("js/auth.js");
  assert.match(auth, /Direct-open: หน้าหลักต้องเปิดได้เสมอ/);
  assert.equal(auth.includes("Auth.showGate();"), false);
});
