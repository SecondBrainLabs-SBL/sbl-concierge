// Headed user test: script-tag mode (no extension), REAL mic, logged-in profile.
// Usage: node tools/proof/user-test.mjs   — keep the terminal open; Ctrl+C ends the session.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const bundle = fs.readFileSync(path.join(repo, "sbl-agent.js"), "utf8");
const ctx = await chromium.launchPersistentContext(path.join(repo, ".browser-profile"), {
  headless: false,
  viewport: { width: 1440, height: 900 },
});
for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) {
  await ctx.grantPermissions(["microphone", "local-network-access"], { origin }).catch(() => {});
}
await ctx.addInitScript(bundle);
await ctx.addInitScript(() => { const K = "sbl_store_v1"; if (!sessionStorage.getItem(K)) sessionStorage.setItem(K, JSON.stringify({ sbl_proof: 1 })); });
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto("https://sbl.so/");
await page.bringToFront();
console.log("READY: browser is open on sbl.so (window brought to front). Press Talk to start. Dashboard test: the profile is logged in to the CX-TEST workspace (app.secondbrainlabs.com). Hard limits: no Yes on cards, no campaigns, no LinkedIn connect, no payment.");
console.log("Close the browser window when done (or Ctrl+C here).");
await new Promise(() => {}); // stay up until the user closes it
