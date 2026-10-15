// Visual showcase: dock entrance, panel morph, mic-ask card (mic NOT granted), agent cursor on sbl.so. Video + screenshots in tools/proof/out/.
// Safe by construction: sbl.so only, one navigation click (Pricing), hover only on plan cards; nothing on app.secondbrainlabs.com.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, ROOT_ID } from "./browser.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });
const R = `#${ROOT_ID}`;
const shots = [];
const ctx = await launch({ recordVideo: { dir: path.join(out, "video"), size: { width: 1440, height: 900 } } });
const page = ctx.pages()[0] || (await ctx.newPage());
const shot = async (name) => { const file = path.join(out, `showcase-${name}.png`); await page.screenshot({ path: file }); shots.push(file); };
await ctx.clearPermissions(); // the mic is never granted here: the card must stay a card

// The cursor runs in the extension's isolated world; the same cursor.js is loaded into the page so this script can drive its API.
const injectCursor = async () => {
  await page.addScriptTag({ path: path.join(here, "../../cursor.js") });
  await page.evaluate(() => { window.__ctl = SBLCursor.createController(document); });
};

try {
  // 1. entrance
  await page.goto("https://sbl.so/", { waitUntil: "commit" });
  await page.waitForSelector(R, { state: "attached", timeout: 30000 });
  await shot("1-entrance-mid");
  await page.waitForTimeout(1600);
  await shot("2-dock-resting");
  await page.waitForTimeout(4500); // the content script's async state load (pre-existing) resets "open" if it lands after a click
  // 2. panel morph
  const isOpen = () => page.evaluate((R) => document.querySelector(R).shadowRoot.querySelector(".panel").classList.contains("open"), R);
  await page.locator(`${R} .launcher`).click({ force: true });
  for (let tries = 0; tries < 4; tries++) { // a late state load can reset "open"; click again until it sticks
    await page.waitForTimeout(tries ? 1500 : 170);
    if (await isOpen()) break;
    if (tries) await page.locator(`${R} .launcher`).click({ force: true });
  }
  await shot("3-panel-morphing");
  await page.waitForTimeout(700);
  if (!(await isOpen())) { await page.locator(`${R} .launcher`).click({ force: true }); await page.waitForTimeout(900); }
  await shot("4-panel-open");
  await page.locator(`${R} .close`).click({ force: true });
  await page.waitForTimeout(700);
  // 3. mic ask
  await page.locator(`${R} .voice`).click({ force: true });
  await page.waitForSelector(`${R} .dock[data-mic="asking"]`, { timeout: 5000 });
  await page.waitForTimeout(800);
  await shot("5-mic-ask");
  // the pointer toward Chrome's prompt shows only while getUserMedia is pending; force that state to see it, without asking for the mic
  await page.evaluate((R) => { document.querySelector(R).shadowRoot.querySelector(".dock").dataset.mic = "prompt"; }, R);
  await page.waitForTimeout(700);
  await shot("5b-mic-prompt-pointer");
  await page.evaluate((R) => { document.querySelector(R).shadowRoot.querySelector(".dock").dataset.mic = "asking"; }, R);
  await page.locator(`${R} .mic-skip`).click({ force: true }); // "Keep typing": dismiss, never grant
  await page.waitForTimeout(500);
  await page.locator(`${R} .close`).click({ force: true });
  await page.waitForTimeout(700);
  // 4. cursor: the in-page 'See detailed pricing' link (off-screen: it scrolls into view smoothly first), spotlight, click
  await injectCursor();
  const pricing = await page.evaluateHandle(() => [...document.querySelectorAll('a[href="https://sbl.so/pricing/"]')].find((a) => /detailed pricing/i.test(a.textContent) && !a.target));
  await page.evaluate(async (el) => { const c = window.__ctl; c.show(true); c.narrate("Pricing"); await c.ensureVisible(el); c.spotlight(el); }, pricing);
  const travel = page.evaluate(async (el) => { const c = window.__ctl; await c.moveTo(c.pointFor(el)); }, pricing);
  await page.waitForTimeout(220);
  await shot("6-cursor-trail-mid-move");
  await travel;
  await page.waitForTimeout(350);
  await shot("7-cursor-spotlight-pricing");
  await Promise.all([
    page.waitForURL(/\/pricing\//, { timeout: 15000, waitUntil: "commit" }),
    page.evaluate((el) => window.__ctl.clickElement(el), pricing).catch(() => {}), // the page navigates under it
  ]);
  await page.waitForTimeout(2500);
  // 5. cursor: hover a plan card, with the tap ripple (no click)
  await injectCursor();
  const plan = await page.evaluateHandle(() => {
    let card = [...document.querySelectorAll("*")].find((el) => !el.children.length && /^\$189/.test(el.textContent.trim()));
    while (card && card.getBoundingClientRect().width < 300) card = card.parentElement;
    return card;
  });
  await page.evaluate(async (el) => {
    const c = window.__ctl;
    await c.ensureVisible(el);
    c.narrate("Pro plan"); c.spotlight(el);
    await c.moveTo(c.pointFor(el));
    for (const [n, k] of [[c.surface.ring, "tap"], [c.surface.arrow, "press"]]) { n.classList.remove(k); void n.getBoundingClientRect(); n.classList.add(k); }
  }, plan);
  await page.waitForTimeout(140);
  await shot("8-cursor-plan-ripple");
  await page.waitForTimeout(900);
  await shot("9-cursor-plan-hover");
  await page.evaluate(() => { window.__ctl.clearSpotlight(); window.__ctl.narrate(""); window.__ctl.show(false); });
  await page.waitForTimeout(500);
  // 6. edge glow while the cursor is acting (dock state forced: the real state lives in the isolated world)
  await page.evaluate((R) => { document.querySelector(R).shadowRoot.querySelector(".dock").dataset.state = "acting"; }, R);
  await page.evaluate(async () => { const c = window.__ctl; c.show(true); c.narrate("Working on it"); await c.moveTo({ x: 900, y: 420 }); });
  await page.waitForTimeout(900);
  await shot("10-edge-glow-acting");
  await page.evaluate((R) => { document.querySelector(R).shadowRoot.querySelector(".dock").dataset.state = "resting"; window.__ctl.show(false); window.__ctl.narrate(""); }, R);
  await page.waitForTimeout(900);
} finally {
  const video = page.video();
  await ctx.close();
  console.log(shots.join("\n"));
  console.log("VIDEO", video && (await video.path()));
}
