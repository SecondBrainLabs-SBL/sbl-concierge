// Which sbl.so links produce a real click event? nav items vs content links vs CTA buttons.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("https://sbl.so/pricing/", { waitUntil: "load" });
await sleep(2500);
await page.evaluate(() => {
  window.__trace = [];
  for (const type of ["click"]) document.addEventListener(type, (e) => window.__trace.push(`click@${e.target.tagName}.${String(e.target.className).split(" ")[0].slice(0, 14)}(tr=${e.isTrusted})`), true);
});
const candidates = {
  navSuccessStories: 'nav a[href*="case-stud"]:visible, header a[href*="case-stud"]:visible',
  tryForFreeNav: 'a:has-text("Try For Free"):visible',
  contentCaseStud: 'main a[href*="case-stud"]:visible, article a[href*="case-stud"]:visible, .elementor-widget-theme-post-content a[href*="case-stud"]:visible',
  anyCaseStud: 'a[href*="case-stud"]:visible',
  signupContent: 'a[href*="app.secondbrainlabs.com"]:visible',
};
const seed = () => page.evaluate(() => {
  window.__trace = [];
  document.addEventListener("click", (e) => window.__trace.push(`click@${e.target.tagName}.${String(e.target.className).split(" ")[0].slice(0, 14)}(tr=${e.isTrusted})`), true);
});
await seed();
for (const [name, sel] of Object.entries(candidates)) {
  const n = await page.locator(sel).count().catch(() => -1);
  if (n <= 0) { console.log(`${name}: none (${n})`); continue; }
  const el = page.locator(sel).first();
  const tag = await el.evaluate((e) => `${e.tagName}.${String(e.className).split(" ").slice(0, 2).join(".").slice(0, 30)} href=${e.getAttribute("href")?.slice(0, 50)} target=${e.target || "-"}`).catch(() => "?");
  const clicked = await el.click({ timeout: 6000 }).then(() => true).catch((e) => { console.log(`${name}: FAILED ${e.message.split("\n")[0].slice(0, 60)}`); return false; });
  if (!clicked) continue;
  // the site's JS may navigate instantly: read the trace with no sleep, and re-seed if the document changed
  const trace = await page.evaluate(() => (window.__trace || []).splice(0)).catch(() => ["(document replaced by navigation — trace lost)"]);
  console.log(`${name}: ${tag}`);
  console.log(`   events: ${JSON.stringify(trace)}`);
  const url = page.url();
  if (!/pricing/.test(url)) { console.log("   navigated to", url.slice(-50), "— going back"); await page.goBack().catch(() => {}); await sleep(1500); await seed(); }
}
await browser.close();
