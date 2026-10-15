// Probe: what Trusted Types state does app.secondbrainlabs.com enforce, and what still works?
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("https://app.secondbrainlabs.com/signup?coupon=SBL20&sblv=40ea5057-37cb-478e-9a74-d0b660949253", { waitUntil: "domcontentloaded" }).catch((e) => console.error("goto:", String(e).slice(0, 100)));
await page.waitForTimeout(6000);
const out = await page.evaluate(() => {
  const tryAssign = (fn) => { try { fn(); return "ok"; } catch (e) { return String(e).slice(0, 120); } };
  const meta = [...document.querySelectorAll('meta[http-equiv]')].map((m) => `${m.httpEquiv}: ${m.content?.slice(0, 200)}`);
  const div = document.createElement("div");
  const sh = div.attachShadow({ mode: "open" });
  const policyNames = globalThis.trustedTypes ? Object.getOwnPropertyNames(Object.getPrototypeOf(globalThis.trustedTypes)) : null;
  let policy = null;
  try { policy = globalThis.trustedTypes?.createPolicy("sbl-probe", { createHTML: (s) => s }); } catch (e) { policy = String(e).slice(0, 120); }
  return {
    hasTT: Boolean(globalThis.trustedTypes),
    defaultPolicy: globalThis.trustedTypes?.defaultPolicy ? "exists" : "none",
    policyNames,
    createPolicyResult: policy ? (typeof policy === "string" ? policy : "created") : "n/a",
    meta,
    divInnerHTML: tryAssign(() => { div.innerHTML = "<b>x</b>"; }),
    shadowInnerHTML: tryAssign(() => { sh.innerHTML = "<b>x</b>"; }),
    withPolicy: typeof policy === "object" && policy ? tryAssign(() => { sh.innerHTML = policy.createHTML("<b>y</b>"); }) : "n/a",
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();