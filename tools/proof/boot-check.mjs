// Step-2 FIRST CHECK: the step-1 bundle still boots on sbl.so with no extension (dock, health, sblv, /store hit),
// and the built wrapper's frame rule is visible: the bundle stands down in foreign frames.
// Usage: node tools/proof/boot-check.mjs [--out tools/proof/out/step2/boot-check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/step2/boot-check"));
const R = "#sbl-sales-concierge-root";
const BUNDLE = path.join(repo, "sbl-agent.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const checks = {};

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.grantPermissions(["microphone", "local-network-access"], { origin: "https://sbl.so" }).catch(() => {});
// The proof flag makes the dock's shadow root open to the proof (step-1 pattern: seed only if absent, never
// overwrite the write-through cache a previous page left).
await ctx.addInitScript(() => { const K = "sbl_store_v1"; if (!sessionStorage.getItem(K)) sessionStorage.setItem(K, JSON.stringify({ sbl_proof: 1 })); });
await ctx.addInitScript(fs.readFileSync(BUNDLE, "utf8"));
const page = await ctx.newPage();
const serverHits = [];
ctx.on("request", (r) => { if (r.url().startsWith("http://127.0.0.1:8787/")) serverHits.push(r.url().slice(21, 60)); });

await page.goto("https://sbl.so/", { waitUntil: "load" });
await page.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
checks.dockBoots = (await page.locator(`${R} .launcher`).count()) > 0;
checks.sblHealth = await page.evaluate((root) => document.querySelector(root)?.dataset.sblHealth || null, R);
checks.sblvCookie = /sblv=[\w-]+/.test(await page.evaluate(() => document.cookie));
checks.storeHit = serverHits.some((h) => h.startsWith("/store"));
await page.screenshot({ path: path.join(OUT, "home-dock.png") });

// The bundle must stand down in a foreign frame (step-1 rule, unchanged): an ad-like iframe on the page gets no dock.
const frameDock = await page.evaluate(async () => {
  const f = document.createElement("iframe");
  f.src = "https://sbl.so/"; // a frame whose boot the wrapper must refuse
  f.style.cssText = "width:300px;height:200px;position:fixed;left:-9999px";
  document.body.append(f);
  await new Promise((r) => setTimeout(r, 4000));
  try { return Boolean(f.contentDocument.querySelector("#sbl-sales-concierge-root")); } catch { return "cross-origin"; }
});
checks.noDockInForeignFrame = frameDock === false;
await page.screenshot({ path: path.join(OUT, "frame-check.png") });

checks.ok = checks.dockBoots && checks.sblHealth === "ok" && checks.sblvCookie && checks.storeHit && checks.noDockInForeignFrame;
await browser.close();
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ checks, serverHits: serverHits.slice(0, 8) }, null, 1));
console.log(JSON.stringify({ ok: checks.ok, checks }, null, 1));
process.exit(checks.ok ? 0 : 1);
