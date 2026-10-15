// Relaunches the user-test browser with --remote-debugging-port and screenshots its real page via CDP.
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const bundle = fs.readFileSync(path.join(repo, "sbl-agent.js"), "utf8");
const ctx = await chromium.launchPersistentContext(path.join(repo, ".browser-profile"), {
  headless: false, viewport: { width: 1440, height: 900 }, args: ["--remote-debugging-port=9333"],
});
for (const o of ["https://sbl.so", "https://app.secondbrainlabs.com"]) await ctx.grantPermissions(["microphone", "local-network-access"], { origin: o }).catch(() => {});
await ctx.addInitScript(bundle);
await ctx.addInitScript(() => { const K = "sbl_store_v1"; if (!sessionStorage.getItem(K)) sessionStorage.setItem(K, JSON.stringify({ sbl_proof: 1 })); });
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto("https://sbl.so/");
await page.bringToFront();
console.log("READY with CDP on 9333");
// every 5 s: screenshot to /tmp so the orchestrator can read what the user sees
for (let i = 0; i < 240; i++) {
  await page.waitForTimeout(5000);
  try { await page.screenshot({ path: "/private/var/folders/rc/xpcf30jn1_14dtq3hfmvj0j40000gn/T/opencode/user-cdp.png" }); } catch {}
}
await new Promise(() => {});
