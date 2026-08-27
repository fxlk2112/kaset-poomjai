import { chromium } from "file:///C:/Users/SFS-RTFV/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "qa");
await fs.mkdir(outDir, { recursive: true });

const url = "http://127.0.0.1:4173/?sensorPreview=1&qa=1";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--disable-gpu", "--hide-scrollbars"]
});

const consoleErrors = [];
const pageErrors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.removeItem("farmult-session-v1");
  sessionStorage.setItem("kaset-route-v1", JSON.stringify({ view: "iot" }));
});
await page.route("**/*", route => {
  const requestUrl = new URL(route.request().url());
  if (requestUrl.hostname === "127.0.0.1" || requestUrl.protocol === "data:") return route.continue();
  if (requestUrl.hostname === "farmbackup.carfork123.workers.dev") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { data: null, updated_at: 0 } })
    });
  }
  if (route.request().resourceType() === "stylesheet") {
    return route.fulfill({ status: 200, contentType: "text/css", body: "" });
  }
  if (route.request().resourceType() === "script") {
    return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  }
  return route.abort("blockedbyclient");
});
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => pageErrors.push(String(error)));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
try {
  await page.locator(".sensor-digital-twin").waitFor({ state: "visible", timeout: 8000 });
} catch (error) {
  const debug = {
    url: page.url(),
    title: await page.title(),
    bodyText: (await page.locator("body").innerText().catch(() => "")).slice(0, 1200),
    consoleErrors,
    pageErrors
  };
  await page.screenshot({ path: path.join(outDir, "implementation-debug-timeout.png"), fullPage: true }).catch(() => {});
  console.error(JSON.stringify(debug, null, 2));
  throw error;
}
await page.locator(".digital-hero img").evaluate(image => image.complete && image.naturalWidth > 0);
await page.waitForTimeout(350);

const mobileMetrics = await page.evaluate(() => {
  const rect = selector => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom } : null;
  };
  const canvases = [...document.querySelectorAll("canvas")].map(canvas => ({
    id: canvas.id,
    width: canvas.width,
    height: canvas.height,
    pixels: canvas.toDataURL().length
  }));
  return {
    viewport: { width: innerWidth, height: innerHeight },
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    auth: {
      locked: document.documentElement.classList.contains("auth-locked"),
      gateDisplay: getComputedStyle(document.getElementById("authGate")).display,
      persistentSessionPresent: localStorage.getItem("farmult-session-v1") !== null
    },
    bodyClass: document.body.className,
    digitalTwin: rect(".sensor-digital-twin"),
    header: rect(".digital-header"),
    hero: rect(".digital-hero"),
    panel: rect(".digital-panel"),
    footer: rect(".digital-footer"),
    title: document.querySelector(".digital-title h1")?.textContent?.trim(),
    live: document.querySelector(".digital-live")?.textContent?.trim(),
    safeOff: document.querySelector(".digital-footer b")?.textContent?.trim(),
    forbiddenOutputText: /เปิดปั๊ม|เปิดวาล์ว|สั่งรีเลย์/.test(document.body.innerText),
    canvases
  };
});

if (mobileMetrics.auth.locked || mobileMetrics.auth.gateDisplay !== "none" || mobileMetrics.auth.persistentSessionPresent) {
  throw new Error("Local sensor preview must bypass the auth gate without storing a session");
}

const mobileViewport = path.join(outDir, "implementation-mobile-390x844.png");
const mobileFull = path.join(outDir, "implementation-mobile-390-full.png");
await page.screenshot({ path: mobileViewport });
await page.screenshot({ path: mobileFull, fullPage: true });

await page.locator(".digital-brand").focus();
const focusVisible = await page.locator(".digital-brand").evaluate(button => button.matches(":focus-visible") || document.activeElement === button);
await page.locator(".digital-brand").click();
await page.waitForTimeout(120);
const logoNavigationWorked = await page.locator(".sensor-digital-twin").count() === 0;

await page.evaluate(() => App.nav("iot"));
await page.locator(".sensor-digital-twin").waitFor({ state: "visible" });
await page.waitForTimeout(120);
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(80);
const footerReachable = await page.locator(".digital-footer").isVisible();

await page.setViewportSize({ width: 1024, height: 1000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(180);
const desktopMetrics = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight },
  scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  appWidth: document.querySelector("#app")?.getBoundingClientRect().width,
  twinWidth: document.querySelector(".sensor-digital-twin")?.getBoundingClientRect().width
}));
const desktopShot = path.join(outDir, "implementation-desktop-1024x1000.png");
await page.screenshot({ path: desktopShot });

const report = {
  url,
  mobileMetrics,
  desktopMetrics,
  interactions: { focusVisible, logoNavigationWorked, footerReachable },
  consoleErrors,
  pageErrors,
  screenshots: { mobileViewport, mobileFull, desktopShot }
};
await fs.writeFile(path.join(outDir, "browser-evidence.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

await browser.close();
