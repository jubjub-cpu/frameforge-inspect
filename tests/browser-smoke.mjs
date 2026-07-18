import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const port = Number(process.env.FRAMEFORGE_TEST_PORT || 4192);
const deployed = process.env.FRAMEFORGE_BASE_URL?.trim();
const base = deployed ? `${deployed.replace(/\/$/, "")}/` : `http://127.0.0.1:${port}/`;
const target = process.env.PLAYWRIGHT_MODULE || "playwright";
const specifier = /^[A-Za-z]:[\\/]/.test(target) ? pathToFileURL(target).href : target;
const { chromium } = await import(specifier);
const desktopShot = fileURLToPath(new URL("../docs/screenshots/frameforge-inspection-desktop.png", import.meta.url));
const mobileShot = fileURLToPath(new URL("../docs/screenshots/frameforge-inspection-mobile.png", import.meta.url));
const fixturePath = fileURLToPath(new URL("../assets/fixtures/flat-export.png", import.meta.url));
const server = deployed ? null : spawn(process.execPath, ["tools/static-server.mjs", "--port", String(port)], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});

async function ready() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("FrameForge server did not start");
}

async function inspectRevision(page) {
  await page.locator('[data-fixture="blown-highlights"]').click();
  await page.locator("#workbench-title").getByText("Overexposed studio still").waitFor({ state: "visible" });
  await page.locator("#run-analysis").click();
  await page.locator("#analysis-status").getByText("Revision required").waitFor({ state: "visible" });
  assert.ok((await page.locator(".finding.high").count()) >= 1);
  assert.equal(await page.locator("#approve-delivery").isEnabled(), true);
  await page.locator("#baseline-select").selectOption("balanced-launch");
  await page.locator(".delta-grid").waitFor({ state: "visible" });
  await page.locator("#request-revision").click();
  assert.match(await page.locator("#decision-summary").innerText(), /Revision requested/);
}

let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await desktop.newPage();
  const errors = [];
  const failed = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => failed.push(request.url()));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.locator("[data-fixture]").count(), 3);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("skip-link")), true);
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => location.hash), "#workspace");

  await inspectRevision(page);
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: desktopShot, fullPage: true });
  const downloadWait = page.waitForEvent("download");
  await page.locator("#export-report").click();
  assert.match((await downloadWait).suggestedFilename(), /frameforge-inspection\.json$/);
  await page.locator("#show-overlay").uncheck();
  assert.equal(await page.locator("#overlay-canvas").isHidden(), true);
  await page.locator("#show-overlay").check();
  await page.locator("#local-image").setInputFiles(fixturePath);
  await page.locator("#source-kind").getByText("Local browser file").waitFor({ state: "visible" });
  await page.locator("#run-analysis").click();
  await page.locator("#analysis-status").getByText("Revision required").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);

  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(base, { waitUntil: "networkidle" });
  await inspectRevision(mobilePage);
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  await mobilePage.evaluate(() => document.activeElement?.blur());
  await mobilePage.screenshot({ path: mobileShot, fullPage: true });
  await mobile.close();

  const errorContext = await browser.newContext();
  const errorPage = await errorContext.newPage();
  await errorPage.route("**/data/fixtures.json", (route) => route.abort());
  await errorPage.goto(base, { waitUntil: "domcontentloaded" });
  await errorPage.getByRole("heading", { name: "The synthetic image studio could not be loaded." }).waitFor({ state: "visible" });
  assert.equal(await errorPage.getByRole("button", { name: "Retry" }).isVisible(), true);
  await errorContext.close();

  console.log("FRAMEFORGE BROWSER TESTS PASSED");
  console.log(JSON.stringify({
    target: deployed ? "deployed" : "local",
    fixtures: 3,
    canvasPixels: true,
    regionalOverlay: true,
    baselineComparison: true,
    localUpload: true,
    humanDecision: true,
    keyboard: true,
    desktopOverflow: false,
    mobileOverflow: false,
    consoleErrors: 0,
    failedRequests: 0,
  }));
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
