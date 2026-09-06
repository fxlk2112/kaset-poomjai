import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".cloudflare-staging-dist");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const integrationCommit = git("rev-parse", "origin/develop");
const releaseCommit = git("rev-parse", "HEAD");
execFileSync("git", ["merge-base", "--is-ancestor", integrationCommit, "HEAD"], { cwd: root });
const releaseId = `owner-main-${integrationCommit.slice(0, 7)}-${releaseCommit.slice(0, 7)}`;
const fixed = new Set(["index.html", "sw.js", "manifest.json", "logo.jpg", "data/weather-models.json"]);
const files = git("ls-files", "-z").split("\0").filter(file => file && (
  fixed.has(file) || /^(css|icons|images)\/.*\.(css|png|jpe?g|webp|svg|ico|gif|avif)$/i.test(file) || /^js\/(?!tests\/).*\.js$/.test(file)
));
if (files.some(file => /(^|\/)(private|local|products)(\/|$)|\.env|\.pem$/i.test(file))) {
  throw new Error("Private path in asset list");
}
const expected = new Set([...files, "js/deployment-config.js", "build.json", "_headers", "_redirects", "robots.txt"]);
async function checkExisting(directory, prefix = "") {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error("Asset staging must not contain symlinks");
    if (entry.isDirectory()) await checkExisting(path.join(directory, entry.name), relative + "/");
    else if (!expected.has(relative)) throw new Error("Unexpected existing staged asset: " + relative);
  }
}
await checkExisting(output);
for (const file of files) {
  const target = path.resolve(output, file);
  if (!target.startsWith(output + path.sep)) throw new Error("Invalid asset path");
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
const htmlPath = path.join(output, "index.html");
let html = await readFile(htmlPath, "utf8");
const runtimeTag = '<script src="js/runtime-config.js';
if (!html.includes(runtimeTag)) throw new Error("Runtime script anchor missing");
html = html.replace(runtimeTag, `<script src="js/deployment-config.js?v=${releaseId}"></script>\n  ${runtimeTag}`);
await writeFile(htmlPath, html);
// Keep the existing origin's cloud-session namespace and owner telemetry mode.
// The reviewed runtime still resolves backend requests to this origin's /api.
await writeFile(path.join(output, "js/deployment-config.js"),
  `globalThis.FarmUltimateLocalConfig = Object.freeze({ownerStagingHosts:["flytech-farmultimate-owner-staging.pongnarin-pa.workers.dev"]});\n`);
const swPath = path.join(output, "sw.js");
const sw = await readFile(swPath, "utf8");
if (!/const CACHE = "[^"]+";/.test(sw)) throw new Error("Service-worker cache anchor missing");
await writeFile(swPath, sw.replace(/const CACHE = "[^"]+";/, `const CACHE = "farmult-${releaseId}";`));
await writeFile(path.join(output, "build.json"), JSON.stringify({
  app: "FARMULTIMATE", release_id: releaseId, integration_commit: integrationCommit,
  release_commit: releaseCommit, safety: "DATA_ONLY / SAFE_OFF", output_control_allowed: false
}, null, 2) + "\n");
await writeFile(path.join(output, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex, nofollow, noarchive\n/index.html\n  Cache-Control: no-cache\n/sw.js\n  Cache-Control: no-cache\n/build.json\n  Cache-Control: no-store\n/js/deployment-config.js\n  Cache-Control: no-cache\n");
await writeFile(path.join(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
// Legacy Pages 404 redirect rules are not valid Workers redirects. Private source
// paths never enter this allowlisted package in the first place.
await writeFile(path.join(output, "_redirects"), "# No redirects for the owner main application.\n");
console.log(JSON.stringify({ result: "OWNER_SITE_BUILT", releaseId, assets: expected.size, integrationCommit, releaseCommit }));
