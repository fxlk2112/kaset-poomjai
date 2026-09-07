import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../../css/style.css", import.meta.url), "utf8");

test("home page exposes the FLYTECH entry to the farm map", () => {
  assert.match(appSource, /class="home-water-entry"/);
  assert.match(appSource, /<strong>FLYTECH<\/strong>/);
  assert.match(appSource, /onclick="App\.nav\('iot'\)"/);
  assert.match(styleSource, /\.home-water-entry\s*\{/);
});
