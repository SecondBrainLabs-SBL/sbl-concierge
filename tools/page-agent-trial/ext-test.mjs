import { chromium } from "playwright"; import path from "node:path"; import fs from "node:fs"; import os from "node:os";
import { startProxy } from "./proxy.mjs";
const HERE = path.dirname(new URL(import.meta.url).pathname); const ext = path.join(HERE, "ext");
const { srv } = await startProxy(8899);
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "pa-ext-")), { channel: "chromium", headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
await ctx.grantPermissions(["local-network-access"], { origin: "https://sbl.so" }); const p = await ctx.newPage(); await p.goto("https://sbl.so/", { waitUntil: "domcontentloaded" });
let r = null; for (let i = 0; i < 40 && !r; i++) { await p.waitForTimeout(1500); r = await p.evaluate(() => document.documentElement.dataset.paExt || null).catch(() => null); }
console.log("url", p.url()); console.log(r); await ctx.close(); srv.close();
