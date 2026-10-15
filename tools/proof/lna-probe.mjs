// Step 1 first check: can a page on https://sbl.so call http://127.0.0.1:8787 directly (Local Network Access)?
// Run: node tools/proof/lna-probe.mjs [--arg=--some-chrome-flag ...]. Server must be running.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const args = process.argv.filter((a) => a.startsWith("--arg=")).map((a) => a.slice(6));
const grant = process.argv.includes("--grant");
const browser = await chromium.launch({ headless: false, args });
const ctx = await browser.newContext();
if (grant) await ctx.grantPermissions(["local-network-access"], { origin: "https://sbl.so" }).catch((e) => console.error("grant failed:", String(e).slice(0, 120)));
const page = await ctx.newPage();
const consoleMsgs = [];
page.on("console", (m) => consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on("dialog", (d) => { consoleMsgs.push(`dialog: ${d.message()}`); d.dismiss(); });
await page.goto("https://sbl.so/pricing/", { waitUntil: "domcontentloaded" });
const probe = (code) => page.evaluate(code).catch((e) => ({ threw: String(e) }));
const get = await probe(async () => { try { const r = await fetch("http://127.0.0.1:8787/health", { signal: AbortSignal.timeout(8000) }); return { ok: r.ok, status: r.status, body: await r.text() }; } catch (e) { return { error: String(e) }; } });
const post = await probe(async () => { try { const r = await fetch("http://127.0.0.1:8787/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "nope" }), signal: AbortSignal.timeout(8000) }); return { status: r.status, body: await r.text() }; } catch (e) { return { error: String(e) }; } });
console.log(JSON.stringify({ version: browser.version(), args, get, post, consoleMsgs }, null, 1));
await browser.close();
