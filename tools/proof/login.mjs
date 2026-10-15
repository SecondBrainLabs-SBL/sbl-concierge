import { launch } from "./browser.mjs";
const ctx = await launch();
const page = ctx.pages()[0] || (await ctx.newPage());
const ok = (u) => u.hostname.endsWith("secondbrainlabs.com") && !/\/(login|signup)/.test(u.pathname);
await page.goto("https://app.secondbrainlabs.com/campaigns");
const deadline = Date.now() + 30 * 60 * 1000;
// require URL to stay logged-in for 5s (initial load can pass before the client redirect to /login)
for (;;) {
  if (Date.now() > deadline) throw new Error("login timeout");
  if (ok(new URL(page.url()))) { await page.waitForTimeout(5000); if (ok(new URL(page.url()))) break; }
  else await page.waitForTimeout(1000);
}
console.log("LOGGED_IN", new URL(page.url()).pathname);
await ctx.close();
