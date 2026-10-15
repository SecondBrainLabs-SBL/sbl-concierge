import { launch } from "./browser.mjs";
const [url, out] = process.argv.slice(2);
const ctx = await launch();
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(url);
await page.waitForTimeout(3000);
console.log("ROOT_PRESENT", await page.evaluate(() => !!document.getElementById("sbl-sales-concierge-root")));
await page.screenshot({ path: out });
await ctx.close();
