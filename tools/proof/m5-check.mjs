// M5 proof: research card on the dashboard. Starts/stops the local server itself (EXTENSION_ID unset). Never presses Yes; no campaign is created.
// One JSON receipt on stdout; logs on stderr. Exit 0 only if every check is true.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";
import { launch } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "../..");
const OUT = process.env.M5_OUT || "/private/tmp/claude-501/-Users-ayushsingh-Downloads-agentic-commerce/de473858-ef80-4848-bb35-7e1b0436e76b/scratchpad/m5";
fs.mkdirSync(OUT, { recursive: true });
const R = "#sbl-sales-concierge-root";
const log = (...a) => console.error(...a);
const out = { build: "", environment: "local-node", endpoint: "http://127.0.0.1:8787/research", source_hash: process.env.GENESIS_SOURCE_HASH || "", researched: false, sourcesShown: false, suggestionShown: false, useThisProposedBrief: false, cancelled: false, ok: false };
let ctx, server;
try {
  out.build = execSync("git rev-parse --short HEAD", { cwd: repo }).toString().trim();
  const dot = Object.fromEntries((fs.existsSync(path.join(repo, ".env")) ? fs.readFileSync(path.join(repo, ".env"), "utf8") : "").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  const env = { ...dot, ...process.env, PORT: "8787" }; delete env.EXTENSION_ID; // key comes from the environment/.env, never printed
  server = spawn("node", ["server.mjs"], { cwd: repo, env, stdio: "ignore" });
  for (let i = 0; i < 20; i++) { if (await fetch("http://127.0.0.1:8787/health").then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
  fs.rmSync(path.join(repo, ".browser-profile/Default/Service Worker"), { recursive: true, force: true }); // Chrome keeps a stale background.js otherwise (cookies untouched)
  ctx = await launch();
  for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) await ctx.grantPermissions(["local-network-access"], { origin }).catch(() => {});
  const page = ctx.pages()[0] || (await ctx.newPage());
  const sleep = (ms) => page.waitForTimeout(ms);
  await page.goto("https://app.secondbrainlabs.com/campaigns");
  await sleep(7000);
  if (/\/(login|signup)/.test(new URL(page.url()).pathname)) throw new Error("dashboard shows the login page");
  const company = await page.evaluate(() => localStorage.getItem("activeCompanyId"));
  if (company !== "706") throw new Error(`active workspace is ${company}, expected 706`);

  const box = page.locator(`${R} input[aria-label="Message SBL"]`);
  const events = () => page.locator(`${R} .messages .event`).allTextContents().catch(() => []);
  const idle = async () => !(await box.isDisabled().catch(() => true));
  async function send(text) {
    if (!(await page.locator(`${R} .panel.open`).count())) await page.locator(`${R} .launcher`).click({ force: true });
    await box.waitFor({ state: "visible", timeout: 10_000 });
    await box.fill(text);
    await page.locator(`${R} .send`).click({ force: true });
  }
  async function settle(waitMs = 180_000) {
    const end = Date.now() + waitMs;
    await sleep(2000);
    while (Date.now() < end && !(await idle())) await sleep(1000);
    await sleep(1500);
  }
  const card = () => page.locator(`${R} .card`);

  const base = (await events()).length;
  const fresh = async () => (await events()).slice(base);
  await send("Any Indian festival in the next 3 weeks I could run an experiment around?");
  await settle();
  // Web evidence varies run to run: one retry with a more specific ask if the first came back inconclusive.
  if (!(await card().locator("a.src").count())) { log("first research had no sources; retrying once"); await send("Please research it: which major Indian festivals fall in the next 3 weeks, with sources?"); await settle(); }
  const ev = await fresh();
  out.researched = ev.some((e) => /^Working: research$/.test(e)) && ev.some((e) => /^Research (done|inconclusive)/.test(e));
  out.sourcesShown = (await card().locator("a.src").count()) > 0 && /\(\d{4}-\d{2}-\d{2}\)/.test(await card().locator("a.src").first().innerText().catch(() => ""));
  out.suggestionShown = (await card().locator(".research-use").count()) > 0;
  log("research", JSON.stringify({ ev: ev.slice(-6), src: await card().locator("a.src").count() }));
  if (!out.researched) out.debug = { card: (await card().textContent().catch(() => "")).slice(0, 300), evs: (await events()).slice(-3), msgs: (await page.locator(`${R} .messages .msg`).allTextContents()).slice(-4).map((t) => t.slice(0, 200)) };
  await page.screenshot({ path: path.join(OUT, "m5-1-research-card.png") });

  if (out.suggestionShown) {
    const before = (await page.locator(`${R} .msg.assistant`).count());
    const evBefore = (await events()).length;
    await card().locator(".research-use").click({ force: true });
    await settle();
    const answer = (await page.locator(`${R} .latest`).innerText().catch(() => "")).trim();
    const tools = (await events()).slice(evBefore).filter((e) => e.startsWith("Working: ")).map((e) => e.slice(9));
    const created = tools.some((t) => /create campaign/.test(t));
    out.useThisProposedBrief = (await page.locator(`${R} .msg.assistant`).count()) > before && /\?|proceed|go ahead|shall|want me/i.test(answer) && /campaign|brief/i.test(answer) && !created;
    out.useThisAnswer = answer.slice(0, 400);
    log("use this", answer.slice(0, 200), "| created:", created);
    await page.screenshot({ path: path.join(OUT, "m5-2-use-this.png") });
  }

  await send("Now research what LinkedIn outreach benchmarks competitors like Apollo and Lemlist publish for reply rates.");
  const base2 = (await events()).length;
  const t0 = Date.now();
  for (;;) { // cancel within 1s of the Researching card appearing
    if (await card().locator(".research-cancel").count()) { await card().locator(".research-cancel").click({ force: true }); break; }
    if (Date.now() - t0 > 120_000) break;
    await sleep(100);
  }
  await settle();
  out.cancelled = (await events()).slice(base2).some((e) => /^Research cancelled/.test(e)) && /cancelled/i.test(await card().innerText().catch(() => ""));
  await page.screenshot({ path: path.join(OUT, "m5-3-cancelled.png") });

  out.ok = out.researched && out.sourcesShown && out.suggestionShown && out.useThisProposedBrief && out.cancelled;
} catch (error) {
  out.error = String(error.message || error).slice(0, 400);
  log(out.error);
}
await ctx?.close().catch(() => {});
server?.kill();
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
