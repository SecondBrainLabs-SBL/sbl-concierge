// M1 live proof: website intent -> concierge chat -> dashboard -> unlaunched "[CX-TEST]" campaign.
// Needs the local server (PORT=8787 node server.mjs) and a logged-in .browser-profile. Never approves a launch.
// Output: NN-<step>.png files and receipt.json in $M1_OUT (default: the session scratchpad).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { launch } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.M1_OUT || "/private/tmp/claude-501/-Users-ayushsingh-Downloads-agentic-commerce/de473858-ef80-4848-bb35-7e1b0436e76b/scratchpad/m1";
fs.mkdirSync(OUT, { recursive: true });
const WORKSPACE = "Second Brain Labs - 02";
const TAG = "[CX-TEST]";
const APP = "https://app.secondbrainlabs.com";
const knowledge = fs.readFileSync(path.join(here, "../../core/sbl-knowledge.js"), "utf8");
const KNOWN = [...new Set(knowledge.match(/\$\d[\d,]*/g))].map((p) => Number(p.replace(/[$,]/g, "")));
// ponytail: a quoted price counts as published if it is one, or the sum of two (e.g. a plan plus extra seats).
const published = (p) => KNOWN.some((a) => a === p || KNOWN.some((b) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some((k) => a * k === p || a + b * k === p)));

// Default (no args): read-only verification of the newest [CX-TEST] campaign; nothing is created or changed.
// The full effectful journey needs --run. Exactly one JSON object goes to stdout; all other logging goes to stderr.
if (!process.argv.includes("--run")) {
  const API = "https://client.secondbrainlabs.com";
  const out = { build: "", environment: "local-node", endpoint: "", source_hash: process.env.GENESIS_SOURCE_HASH || "", campaignId: null, name: null, state: null, messagesVerified: false, verifiedAt: null, ok: false };
  let ctxV;
  try {
    out.build = execSync("git rev-parse --short HEAD", { cwd: path.join(here, "../..") }).toString().trim();
    ctxV = await launch();
    const pg = ctxV.pages()[0] || (await ctxV.newPage());
    await pg.goto("https://app.secondbrainlabs.com/campaigns");
    await pg.waitForTimeout(6000);
    if (/\/(login|signup)/.test(new URL(pg.url()).pathname)) throw new Error("dashboard shows the login page");
    const company = await pg.evaluate(() => localStorage.getItem("activeCompanyId"));
    if (company !== "706") throw new Error(`active workspace is ${company}, expected 706`);
    out.endpoint = `${API}/companies/${company}/campaigns/?isArchived=false&includeWorkflows=false`;
    const get = (url) => pg.evaluate(async (u) => (await (await fetch(u, { credentials: "include" })).json()).payload, url);
    const rows = (await get(out.endpoint)).filter((c) => c.name?.startsWith("[CX-TEST]")).sort((a, b) => b.id - a.id);
    if (!rows.length) throw new Error("no [CX-TEST] campaign found");
    const full = await get(`${API}/companies/${company}/campaigns/${rows[0].id}`);
    out.campaignId = String(full.id);
    out.name = full.name;
    out.state = full.status === 9 ? "created (not launched)" : `status ${full.status}`;
    const now = { new: full.nonConnectedLeadsMessage, connected: full.initialMessage, f1: full.followupMessages?.[0]?.message, f2: full.followupMessages?.[1]?.message };
    let saved = null;
    try { const m = JSON.parse(fs.readFileSync(path.join(OUT, "receipt.json"), "utf8")).notes.persistedMessages; saved = { new: m.newLeadsMessage, connected: m.connectedLeadsMessage, f1: m.followups[0], f2: m.followups[1] }; } catch { console.error("no receipt.json: checking non-empty only"); }
    out.messagesVerified = Object.entries(now).every(([k, v]) => String(v || "").trim() && (!saved || v === saved[k]));
    out.ok = full.status === 9 && out.messagesVerified;
  } catch (error) { out.error = String(error.message || error); console.error(out.error); }
  out.verifiedAt = new Date().toISOString();
  await ctxV?.close().catch(() => {});
  console.log(JSON.stringify(out));
  process.exit(out.ok ? 0 : 1);
}

const receipt = { campaignName: null, state: null, href: null, workspaceLabel: null, workspaceIdSource: null, steps: [], startedAt: new Date().toISOString(), finishedAt: null, ok: false, notes: {} };
// Fresh concierge memory and visitor history for every run (a prior chat inside 30 min silences the proactive bubble).
// Login lives in cookies, not here. Extension storage sits under the profile's Local Extension Settings.
// Only this extension's folder: an unpacked extension's id is sha256(absolute path), hex digits mapped 0-f -> a-p.
const repo = path.resolve(here, "../..");
const extId = [...createHash("sha256").update(repo).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
fs.rmSync(path.join(repo, ".browser-profile/Default/Local Extension Settings", extId), { recursive: true, force: true });
const ctx = await launch();
// Chrome's Local Network Access blocks a public page's extension from reaching the loopback server unless allowed
// (a real user gets a prompt; a headed test profile does not). Without it the concierge silently falls back to flow.js.
for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) await ctx.grantPermissions(["local-network-access"], { origin }).catch(() => {});
const page = ctx.pages()[0] || (await ctx.newPage());
// Every campaign write the app makes, so a claimed "saved" can be checked against what SBL actually accepted.
receipt.notes.campaignWrites = [];
page.on("response", async (res) => {
  const req = res.request();
  if (req.method() === "PATCH" && /\/companies\/\d+\/campaigns\/\d+/.test(req.url())) {
    receipt.notes.campaignWrites.push({ at: new Date().toISOString(), url: req.url().replace(/^.*companies/, "companies"), status: res.status(), body: (req.postData() || "").slice(0, 200) });
  }
});
const sleep = (ms) => page.waitForTimeout(ms);
const R = "#sbl-sales-concierge-root";
let n = 0;
async function shot(name) {
  const file = path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
async function step(num, name, fn) {
  const entry = { n: num, name, screenshot: null, ok: false };
  receipt.steps.push(entry);
  try { Object.assign(entry, await fn()); entry.ok = entry.ok !== false; }
  catch (error) { entry.ok = false; entry.error = String(error.message || error).slice(0, 400); }
  entry.screenshot ||= await shot(`${num}-${name}-end`).catch(() => null);
  console.log(entry.ok ? "PASS" : "FAIL", num, name, entry.error || "");
  return entry;
}
const latest = () => page.locator(`${R} .latest`).innerText().catch(() => "");
const assistantCount = () => page.locator(`${R} .msg.assistant`).count().catch(() => 0);
async function openPanel() {
  if (!(await page.locator(`${R} .panel.open`).count())) await page.locator(`${R} .launcher`).click();
  await page.locator(`${R} input[aria-label=Message]`).waitFor({ state: "visible", timeout: 10_000 });
}
// One user turn: type, send, wait until the model (and any tool it ran) is done.
async function say(text, { waitMs = 240_000 } = {}) {
  await openPanel();
  const before = await assistantCount();
  const box = page.locator(`${R} input[aria-label=Message]`);
  await box.fill(text);
  // The dashboard's modal traps focus, so Enter can miss the panel's input; the Send button is reliable.
  await page.locator(`${R} .send`).click();
  await sleep(600);
  if (await box.inputValue().catch(() => "")) await page.locator(`${R} .send`).click({ force: true });
  const deadline = Date.now() + waitMs;
  for (;;) {
    await sleep(1000);
    if (Date.now() > deadline) throw new Error(`no reply within ${waitMs / 1000}s to: ${text.slice(0, 50)}`);
    const busy = await box.isDisabled().catch(() => true); // also true while the page navigates
    if (!busy && (await assistantCount()) > before) break;
  }
  await sleep(1500);
  return latest();
}

// 1 ---------------------------------------------------------------- website dwell + proactive bubble
let bubble = "";
await step(1, "website-intent", async () => {
  await page.goto("https://sbl.so/");
  await sleep(4000);
  await page.goto("https://sbl.so/agency/");
  await sleep(4000);
  await page.goto("https://sbl.so/pricing/");
  const end = Date.now() + 25_000;
  let y = 0;
  while (Date.now() < end) {
    await page.mouse.move(300 + Math.random() * 700, 200 + Math.random() * 400, { steps: 8 });
    y = (y + 260) % 2400;
    await page.mouse.wheel(0, y % 520 < 260 ? 260 : -160);
    await sleep(1800);
  }
  const dwell = await shot("1-pricing-dwell");
  const invite = page.locator(`${R} .invite.show .invite-say`);
  await invite.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  bubble = (await invite.innerText().catch(() => "")).trim();
  const file = await shot("1-proactive-bubble");
  receipt.notes.proactiveBubble = bubble || null;
  return { ok: Boolean(bubble), screenshot: file, dwellScreenshot: dwell, bubble, error: bubble ? undefined : "no proactive bubble within 60s" };
});

// 2 ---------------------------------------------------------------- pricing question
await step(2, "pricing-question", async () => {
  if (bubble) await page.locator(`${R} .invite-say`).click().catch(() => {});
  const reply = await say("Which plan fits a 5-person agency doing LinkedIn outreach?");
  const file = await shot("2-pricing-reply");
  const mentionsPlan = /\b(starter|pro|elite|enterprise|agency)\b/i.test(reply);
  const invented = (reply.match(/\$\d[\d,]*/g) || []).filter((p) => !published(Number(p.replace(/[$,]/g, ""))));
  receipt.notes.pricingReply = reply;
  return { ok: mentionsPlan && !invented.length, screenshot: file, reply, error: !mentionsPlan ? "reply names no plan" : invented.length ? `prices neither in sbl-knowledge.js nor a sum of two of them: ${invented}` : undefined };
});

// 3 ---------------------------------------------------------------- business + agree to recommendation
await step(3, "business-and-agree", async () => {
  const first = await say("I sell a CRM to small recruitment agencies in the US; help me get demos");
  const second = await say("Yes, that recommendation sounds right. Let's go with it.");
  return { ok: Boolean(first && second), screenshot: await shot("3-agreed"), replies: [first, second] };
});

// 4 ---------------------------------------------------------------- dashboard, workspace, resume
await step(4, "dashboard-workspace", async () => {
  await page.goto(`${APP}/campaigns`);
  await sleep(6000);
  if (/\/(login|signup)/.test(new URL(page.url()).pathname)) throw Object.assign(new Error("dashboard shows the login page"), { fatal: true });
  const trigger = page.locator('button[aria-haspopup="dialog"]').first();
  let label = (await trigger.innerText()).trim();
  if (label !== WORKSPACE) {
    await trigger.click();
    await page.locator("[role=radiogroup] label", { hasText: new RegExp(`^${WORKSPACE}$`) }).click();
    await page.waitForFunction((w) => document.querySelector('button[aria-haspopup="dialog"]')?.innerText.trim() === w, WORKSPACE, { timeout: 20_000 });
    await sleep(4000);
    label = (await trigger.innerText()).trim();
  }
  const ls = await page.evaluate(() => ({ activeCompanyId: localStorage.getItem("activeCompanyId"), keys: Object.keys(localStorage) }));
  receipt.workspaceLabel = label;
  receipt.workspaceIdSource = `localStorage.activeCompanyId=${ls.activeCompanyId} (set by the app when the switcher radio value changes; the URL carries no id; API paths are /companies/${ls.activeCompanyId}/...); label = first button[aria-haspopup=dialog] in the sidebar`;
  const campaigns = await shot("4-campaigns");
  await openPanel();
  await sleep(1500);
  const opening = await latest();
  receipt.notes.dashboardOpeningLine = opening;
  return { ok: label === WORKSPACE && ls.activeCompanyId === "706", screenshot: await shot("4-concierge-resume"), campaignsScreenshot: campaigns, opening, error: label !== WORKSPACE ? `workspace is "${label}"` : undefined };
});

const loggedOut = receipt.steps[3].error?.includes("login page");
// 5 ---------------------------------------------------------------- build the campaign, one turn at a time
const built = { editor: false, approval: false, turns: [] };
receipt.notes.buildTurns = built.turns;
if (!loggedOut) await step(5, "build-campaign", async () => {
  const titleOf = () => page.evaluate(() => document.querySelector("span.truncate.text-base")?.textContent?.trim() || "");
  const inEditor = () => /\/campaigns\/\d+/.test(new URL(page.url()).pathname);
  // Nudges by what is on screen, so the model is asked for exactly one thing at a time.
  const quote = " Quote the text back to me exactly as saved.";
  const editorAsks = [
    "Yes. Now write the new leads message (the first message, under the New Leads tab) yourself, for recruitment agency owners." + quote,
    "Good. Now switch to the Connected Leads tab.",
    "Now write the connected leads message yourself." + quote,
    "Good. Now write follow up 1 yourself." + quote,
    "Good. Now write follow up 2 yourself." + quote,
    "Now show me the launch approval so I can review. Do not launch anything.",
  ];
  let asked = false;
  let editorTurn = 0;
  for (let turn = 1; turn <= 18 && !built.approval; turn++) {
    await page.locator(`${R} .approval.show`).count().then((c) => { built.approval = c > 0; });
    if (built.approval) break;
    const dialog = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || "");
    let ask;
    if (inEditor()) {
      built.editor = true;
      const title = await titleOf();
      if (title && !title.startsWith(TAG)) ask = `Rename the campaign so its name starts with ${TAG}.`;
      else ask = editorAsks[Math.min(editorTurn++, editorAsks.length - 1)];
    } else if (/Add your leads/i.test(dialog)) ask = "I have no list yet. Add leads later; I'll bring them after I review the messages.";
    else if (/Connect your LinkedIn/i.test(dialog)) ask = "Create the campaign now. I'll connect LinkedIn myself later, so do not hire a profile.";
    else if (/Campaign brief/i.test(dialog)) ask = "The brief looks good. Continue.";
    else if (!asked) { asked = true; ask = `Yes, please build the campaign now. Its name must start with ${TAG}. Use LinkedIn. Begin with the brief.`; }
    else ask = "Inspect the screen and continue from where it is. Do not open a new campaign wizard.";
    const reply = await say(ask);
    built.turns.push({ turn, ask, reply, url: page.url() });
    built.said = await page.locator(`${R} .msg.assistant`).allInnerTexts(); // every assistant line, not just the last
    await shot(`5-turn-${String(turn).padStart(2, "0")}`);
    if (editorTurn > editorAsks.length + 2) break;
  }
  await page.locator(`${R} .approval.show`).count().then((c) => { built.approval = c > 0; });
  if (built.approval) await page.locator(`${R} .approval.show`).scrollIntoViewIfNeeded().catch(() => {});
  const file = await shot("5-approval-panel");
  return { ok: built.editor && built.approval, screenshot: file, error: !built.editor ? "never reached the campaign editor" : !built.approval ? "approval control never appeared" : undefined };
});

// 6 ---------------------------------------------------------------- readback (approval is NEVER clicked)
if (!loggedOut) await step(6, "readback", async () => {
  await page.goto(`${APP}/campaigns`);
  await sleep(6000);
  const id = await page.evaluate(() => localStorage.getItem("activeCompanyId"));
  const rows = await page.evaluate(async (company) => {
    const r = await fetch(`https://client.secondbrainlabs.com/companies/${company}/campaigns/?isArchived=false&includeWorkflows=false`, { credentials: "include" });
    return ((await r.json()).payload || []).map((c) => ({ id: c.id, name: c.name, status: c.status, createdAt: c.createdAt, initialMessage: c.initialMessage, followups: (c.followupMessages || []).map((f) => f.message) }));
  }, id);
  const since = Date.parse(receipt.startedAt);
  const mine = rows.filter((c) => c.name?.startsWith(TAG) && Date.parse(c.createdAt) >= since - 60_000);
  const row = mine[0];
  await page.locator('input[placeholder*="Search a campaign"]').fill(TAG).catch(() => {});
  await sleep(1500);
  const file = await shot("6-readback");
  if (!row) return { ok: false, screenshot: file, error: `no ${TAG} campaign created during this run (workspace ${id})` };
  receipt.campaignName = row.name;
  receipt.state = row.status === 9 ? "created (not launched)" : `status ${row.status}`;
  receipt.href = `${APP}/campaigns/${row.id}`;
  // The list omits nonConnectedLeadsMessage (the "New Leads" first message), so read the campaign itself.
  const full = await page.evaluate(async ([company, cid]) => {
    const c = (await (await fetch(`https://client.secondbrainlabs.com/companies/${company}/campaigns/${cid}`, { credentials: "include" })).json()).payload;
    return { newLeadsMessage: c.nonConnectedLeadsMessage, connectedLeadsMessage: c.initialMessage, followups: (c.followupMessages || []).map((f) => f.message), revision: c.revision };
  }, [id, row.id]);
  receipt.notes.persistedMessages = full;
  // Everything the agent said it wrote must be exactly what SBL stored: each persisted text has to appear verbatim in the
  // replies (it was asked to quote them); an SBL-generated default never does.
  const strip = (t) => String(t).replace(/[*_`>\s]+/g, " ").trim();
  const said = strip([...(built.said || []), ...built.turns.map((t) => t.reply)].join(" "));
  const persisted = { "new leads message": full.newLeadsMessage, "connected leads message": full.connectedLeadsMessage, "follow up 1": full.followups[0], "follow up 2": full.followups[1] };
  const mismatched = Object.entries(persisted).filter(([, text]) => !text || !said.includes(strip(text))).map(([name]) => name);
  receipt.notes.messageCheck = { checked: Object.keys(persisted), mismatched };
  return { ok: row.status === 9 && row.name.startsWith(TAG) && !mismatched.length, screenshot: file, row, error: row.status !== 9 ? `unexpected status ${row.status}` : mismatched.length ? `persisted differs from what the agent reported writing: ${mismatched}` : undefined };
});

receipt.finishedAt = new Date().toISOString();
receipt.ok = receipt.steps.every((s) => s.ok);
fs.writeFileSync(path.join(OUT, "receipt.json"), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
await ctx.close();
