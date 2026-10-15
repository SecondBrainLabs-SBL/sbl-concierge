import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
export const ROOT_ID = "sbl-sales-concierge-root";
// The dock is closed to page scripts and the action log is silent unless this flag is set in the extension's own storage (the page cannot reach it).
export async function enableProof(ctx) {
  const worker = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  await worker.evaluate(() => chrome.storage.local.set({ sbl_proof: true }));
}
export async function launch({ headless = false, recordVideo } = {}) {
  // Chrome keeps the extension's service-worker script in the profile and can serve a stale background.js after an edit.
  fs.rmSync(path.join(repo, ".browser-profile/Default/Service Worker"), { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(path.join(repo, ".browser-profile"), {
    headless: false, // MV3 extensions need headed; ponytail: headless arg honored via new-headless flag below
    args: [`--disable-extensions-except=${repo}`, `--load-extension=${repo}`, ...(headless ? ["--headless=new"] : [])],
    viewport: { width: 1440, height: 900 },
    ...(recordVideo && { recordVideo }),
  });
  await enableProof(ctx);
  return ctx;
}
