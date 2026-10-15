// M4 proof: dashboard reads + one confirmation demo. Never presses Yes; nothing is changed.
// Needs the local server (PORT=8787 node server.mjs, EXTENSION_ID unset) and a logged-in .browser-profile on workspace 706.
// One JSON receipt on stdout; logs on stderr. Exit 0 only if the card showed the right target, went away on navigation, and no campaign changed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launch } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.M4_OUT || "/private/tmp/claude-501/-Users-ayushsingh-Downloads-agentic-commerce/de473858-ef80-4848-bb35-7e1b0436e76b/scratchpad/m4";
fs.mkdirSync(OUT, { recursive: true });
const API = "https://client.secondbrainlabs.com";
const R = "#sbl-sales-concierge-root";
const log = (...a) => console.error(...a);
const out = { build: "", environment: "local-node", endpoint: "", source_hash: process.env.GENESIS_SOURCE_HASH || "", reads: {}, card: null, cardGoneAfterNavigation: false, statesBefore: null, statesUnchanged: false, ok: false };
let ctx;
try {
  out.build = execSync("git rev-parse --short HEAD", { cwd: path.join(here, "../..") }).toString().trim();
  ctx = await launch();
  for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) await ctx.grantPermissions(["local-network-access"], { origin }).catch(() => {});
  const page = ctx.pages()[0] || (await ctx.newPage());
  const sleep = (ms) => page.waitForTimeout(ms);
  await page.goto("https://app.secondbrainlabs.com/campaigns");
  await sleep(7000);
  if (/\/(login|signup)/.test(new URL(page.url()).pathname)) throw new Error("dashboard shows the login page");
  const company = await page.evaluate(() => localStorage.getItem("activeCompanyId"));
  if (company !== "706") throw new Error(`active workspace is ${company}, expected 706 (Second Brain Labs - 02)`);
  out.endpoint = `${API}/companies/${company}/campaigns/?isArchived=false&includeWorkflows=false`;
  const get = (url) => page.evaluate(async (u) => (await (await fetch(u, { credentials: "include" })).json()).payload, url);
  const states = async () => Object.fromEntries((await get(out.endpoint)).map((c) => [c.id, c.status]));
  out.statesBefore = await states();
  const campaigns = await get(out.endpoint);
  const chats = await get(`${API}/companies/${company}/users/?status=unarchived&sortBy=lastMessageCreatedAt`);

  const box = page.locator(`${R} input[aria-label="Message SBL"]`);
  const events = () => page.locator(`${R} .messages .event`).allTextContents().catch(() => []);
  const cardShown = () => page.locator(`${R} .approval.show`).count().then((n) => n > 0).catch(() => false);
  async function ask(text, waitMs = 150_000) {
    if (!(await page.locator(`${R} .panel.open`).count())) await page.locator(`${R} .launcher`).click({ force: true });
    await box.waitFor({ state: "visible", timeout: 10_000 });
    const beforeEvents = (await events()).length;
    const beforeAssistant = await page.locator(`${R} .msg.assistant`).count();
    await page.evaluate(() => { window.__m4 = 1; });
    await box.fill(text);
    await page.locator(`${R} .send`).click({ force: true });
    const deadline = Date.now() + waitMs;
    for (;;) {
      await sleep(1000);
      // A full page load (the app navigating) ends the turn: the model resumes on the user's next message.
      if (!(await page.evaluate(() => window.__m4 === 1).catch(() => false))) { await sleep(5000); log("page reloaded mid-turn"); break; }
      if (Date.now() > deadline) {
        out.debug = { url: page.url(), events: (await events()).slice(-12), latest: await page.locator(`${R} .latest`).textContent().catch(() => null) };
        await page.screenshot({ path: path.join(OUT, "m4-timeout.png") }).catch(() => {});
        throw new Error(`no reply within ${waitMs / 1000}s to: ${text}`);
      }
      if (!(await box.isDisabled().catch(() => true)) && (await page.locator(`${R} .msg.assistant`).count()) > beforeAssistant) break;
    }
    await sleep(1500);
    const tools = (await events()).slice(beforeEvents).filter((e) => e.startsWith("Working: ")).map((e) => e.slice(9));
    return { tools, answer: (await page.locator(`${R} .latest`).innerText().catch(() => "")).slice(0, 600) };
  }

  const q1 = await ask("what's happening in my campaigns?");
  out.reads.campaigns = { ...q1, usedRead: q1.tools.some((t) => /read campaigns|read campaign stats/.test(t)), grounded: campaigns.some((c) => q1.answer.toLowerCase().includes(String(c.name).slice(0, 18).toLowerCase())) || /\b(\d+|no|none)\b.*campaign|campaign.*\b\d+\b/i.test(q1.answer) };
  await page.screenshot({ path: path.join(OUT, "m4-1-campaigns.png") });
  log("q1", JSON.stringify(out.reads.campaigns));

  const q2 = await ask("show me conversations that need me");
  const names = chats.slice(0, 20).map((c) => String(c.name).split(/\s+/)[0].toLowerCase());
  const flagged = chats.slice(0, 20).filter((c) => c.hasPendingApproval || c.aiChatOff).length;
  out.reads.conversations = { ...q2, usedRead: q2.tools.some((t) => /read conversations/.test(t)), flaggedInApi: flagged, grounded: names.some((n) => n.length > 2 && q2.answer.toLowerCase().includes(n)) || (flagged === 0 && /\b(no|none|nothing|not|zero)\b/i.test(q2.answer)) };
  await page.screenshot({ path: path.join(OUT, "m4-2-conversations.png") });
  log("q2", JSON.stringify(out.reads.conversations));

  // 1) The asked-for pause: the [CX-TEST] campaigns are Created (never launched), so SBL offers no Pause control on them.
  //    The right answer is an honest refusal, not a card for a control that does not exist.
  const created = campaigns.filter((c) => /^\[CX-TEST\] LinkedIn Demo Booking/.test(c.name)).sort((a, b) => b.id - a.id)[0];
  if (!created) throw new Error("no [CX-TEST] LinkedIn Demo Booking campaign in the workspace");
  const q3 = await ask("pause the [CX-TEST] LinkedIn Demo Booking campaign");
  out.reads.pauseCreatedCampaign = { ...q3, cardShown: await cardShown(), campaignId: created.id, sblState: created.status };
  await page.screenshot({ path: path.join(OUT, "m4-3a-pause-created.png") });
  log("pause created", JSON.stringify(out.reads.pauseCreatedCampaign));
  if (await cardShown()) await page.locator(`${R} .cancel`).click({ force: true }); // never Yes

  // 2) A card for a control that does exist: Pause Campaign on a Running campaign. Yes is never pressed.
  const wanted = campaigns.find((c) => String(c.id) === (process.env.M4_TARGET || "1463"));
  if (!wanted) throw new Error("the running demo campaign is not in this workspace");
  let q4 = await ask(`pause campaign ${wanted.id} (${String(wanted.name).slice(0, 40)})`);
  const nudges = [`Yes, campaign ${wanted.id}. Open it and its Actions menu, and put up the pause confirmation card. Do not pause it yourself.`, "Open the Actions menu on this campaign and put up the pause confirmation card. Do not click pause yourself.", "The menu is open now: put up the pause confirmation card for this campaign. Do not click pause yourself."];
  for (const nudge of nudges) {
    if (await cardShown()) break;
    log("no card yet; nudging");
    q4 = await ask(nudge);
    log("  tools:", q4.tools.join(", "), "|", q4.answer.slice(0, 160));
  }
  out.reads.pauseRequest = q4;
  const shown = await cardShown();
  if (!shown) {
    out.debug = { menuItems: await page.evaluate(() => [...document.querySelectorAll("[role=menuitem]")].map((e) => e.innerText.trim())), popper: await page.evaluate(() => [...document.querySelectorAll("[data-radix-popper-content-wrapper]")].map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 200))), events: (await events()).slice(-14) };
    await page.screenshot({ path: path.join(OUT, "m4-nocard.png") });
  }
  const text = shown ? await page.locator(`${R} .approval .ask`).innerText() : "";
  out.card = { shown, text, url: new URL(page.url()).pathname, hasPause: /pause/i.test(text), hasCampaignId: text.includes(String(wanted.id)) || page.url().includes(`/campaigns/${wanted.id}`) };
  out.card.rightTarget = shown && out.card.hasPause && out.card.hasCampaignId;
  await page.screenshot({ path: path.join(OUT, "m4-3-confirmation-card.png") });
  log("card", JSON.stringify(out.card));

  // Navigate inside the app (a reload would trivially clear the card): the card must go away.
  if (shown) {
    const other = page.locator(`a[href^="/campaigns/"]:not([href="/campaigns/${wanted.id}"])`).first();
    if (await other.count()) await other.click().catch(() => {});
    else await page.locator('a[href="/campaigns"]').first().click().catch(() => {});
    await sleep(3500);
    out.cardGoneAfterNavigation = !(await cardShown());
    out.cardNavigatedTo = new URL(page.url()).pathname;
    await page.screenshot({ path: path.join(OUT, "m4-4-card-gone.png") });
  }

  const after = await states();
  out.statesUnchanged = JSON.stringify(after) === JSON.stringify(out.statesBefore);
  out.ok = Boolean(out.card?.rightTarget) && out.cardGoneAfterNavigation && out.statesUnchanged;
} catch (error) {
  out.error = String(error.message || error).slice(0, 400);
  log(out.error);
}
await ctx?.close().catch(() => {});
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
