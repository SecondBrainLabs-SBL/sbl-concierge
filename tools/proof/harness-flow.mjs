// Harness proof: a FRESH, logged-out browser (temp profile, extension loaded) walks the whole acquisition path with the agent.
//   sbl.so/pricing: "recommend a plan" -> it shows pricing -> "sign me up" -> signup (asks email, password in the masked box) -> onboarding
//   (asks only for what it needs) -> dashboard, still holding the conversation.
// Usage: node tools/proof/harness-flow.mjs [--out tools/proof/out/harness-flow]   (needs the local server: PORT=8787 node server.mjs)
// The visitor is played by this script: it answers questions from the sanctioned identity below and types the password into the dock's masked box.
// Sanctioned for this proof: ONE new test account (identity "CX Test", company "CX-TEST Trial", a disposable mail.tm inbox). It never presses a
// confirmation card's Yes, never pays, never connects LinkedIn, never launches or creates a campaign. Records video + the action log.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { enableProof } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/harness-flow"));
const R = "#sbl-sales-concierge-root";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- the sanctioned test identity (never printed: the password) ----
const ID = { name: "CX Test", company: "CX-TEST Trial", phone: "9999999999", url: "https://example.com", password: crypto.randomBytes(9).toString("base64url") + "Aa1!" };
const MAIL = "https://api.mail.tm";
const jpost = (u, body, h = {}) => fetch(MAIL + u, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(body) }).then((r) => r.json());
async function createInbox() {
  const domain = (await (await fetch(MAIL + "/domains")).json())["hydra:member"][0].domain;
  const address = `cxtest${crypto.randomBytes(4).toString("hex")}@${domain}`, pw = crypto.randomBytes(12).toString("base64url");
  await jpost("/accounts", { address, password: pw });
  const { token } = await jpost("/token", { address, password: pw });
  return { address, token };
}
async function inboxMessages(inbox) {
  const h = { Authorization: `Bearer ${inbox.token}` };
  const list = (await (await fetch(`${MAIL}/messages`, { headers: h })).json())["hydra:member"] || [];
  return Promise.all(list.map(async (m) => { const full = await (await fetch(`${MAIL}/messages/${m.id}`, { headers: h })).json(); const text = `${full.text || ""} ${(full.html || []).join(" ")}`; return { subject: full.subject, text, links: [...new Set(text.match(/https?:\/\/[^\s\]\)>"'\\]+/g) || [])], code: (text.match(/\b(\d{6})\b/) || [])[1] || (text.match(/\b(\d{4,8})\b/) || [])[1] || null }; }));
}

const inbox = await createInbox();
const log = { startedAt: new Date().toISOString(), email: inbox.address, actions: [], timeline: [], answers: [], humanSteps: [], notes: [] };
const t0 = Date.now(), rel = () => +((Date.now() - t0) / 1000).toFixed(1);
const note = (n) => { log.notes.push(`${rel()}s ${n}`); console.log(`[${rel()}s] ${n}`); };
note(`inbox ${inbox.address}`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sbl-flow-"));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${repo}`, `--load-extension=${repo}`],
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
});
await enableProof(ctx); // opens the dock's shadow root to this script and turns the action log on (type, target label, path, time only)
await ctx.exposeBinding("__sblAct", (_s, detail) => { try { const e = JSON.parse(detail); log.actions.push({ t: rel(), ...e }); } catch { /* not ours */ } });
await ctx.addInitScript(() => { addEventListener("sbl-agent-action", (e) => window.__sblAct?.(typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)), true); });
// P5(d): every request body that leaves the browser to the local server or OpenAI is kept in memory only, to grep for the password at the end.
const bodies = [];
ctx.on("request", (r) => { if (/127\.0\.0\.1:8787|localhost:8787|openai\.com/.test(r.url())) bodies.push(r.postData() || ""); });
const page = ctx.pages()[0] || (await ctx.newPage());
page.on("framenavigated", (f) => { if (f === page.mainFrame()) log.timeline.push({ t: rel(), url: f.url() }); });

// ---- looking at the dock ----
const dock = () => page.evaluate((r) => {
  const s = document.querySelector(r)?.shadowRoot;
  if (!s) return null;
  const secret = s.querySelector(".secret-row");
  return {
    state: s.querySelector(".dock")?.dataset.state, url: location.href,
    messages: [...s.querySelectorAll(".messages .msg")].map((n) => `${n.classList.contains("user") ? "visitor" : "agent"}: ${n.textContent.trim()}`),
    approval: s.querySelector(".approval")?.classList.contains("show") ? s.querySelector(".approval .ask")?.textContent : null,
    secret: secret && !secret.hidden ? s.querySelector(".secret-label")?.textContent : null,
  };
}, R).catch(() => null);
const say = (text) => page.evaluate(([r, t]) => { const s = document.querySelector(r).shadowRoot; const f = s.querySelector("form"); s.querySelector("input").value = t; f.requestSubmit(); }, [R, text]);
const lastAction = () => log.actions.filter((a) => a.type !== "step").at(-1);

async function openDock() {
  await page.locator(`${R} .launcher`).evaluate((el) => el.click()).catch(() => {});
  await sleep(1200);
}
// Idle = the agent has done nothing for `quiet` s and the dock is not thinking or acting.
async function idle(quiet = 14, max = 240) {
  const start = Date.now();
  for (;;) {
    await sleep(1500);
    const d = await dock();
    if (await answerIfAsked(d)) continue;
    const last = log.actions.at(-1);
    const busy = d && /^(thinking|acting)$/.test(d.state);
    if (!busy && (!last || rel() - last.t > quiet)) return d;
    if (Date.now() - start > max * 1000) { note("idle timeout"); return d; }
  }
}

// ---- playing the visitor ----
let answered = 0;
const ANSWERS = [
  [/(full name|your name|name).*(phone|number)|(phone|number).*name/i, () => `${ID.name}, ${ID.phone}`], // a two-part question gets both answers
  [/hear about|referral|how did you|attribution|source/i, () => "Others is fine"],
  [/solo|team|seat|linkedin|whatsapp|plan|budget|people|how many/i, () => "Just me, LinkedIn only, starting small"],
  [/e-?mail/i, () => inbox.address],
  [/phone|mobile|whatsapp|number/i, () => ID.phone],
  [/website|url|site|link|domain/i, () => ID.url],
  [/company|business|organi[sz]ation|agency/i, () => ID.company],
  [/name/i, () => ID.name],
];
async function answerIfAsked(d) {
  d ||= await dock();
  if (!d) return false;
  if (d.approval) { // never press Yes
    note(`confirmation card shown, pressing Not yet: ${d.approval.split("\n")[0]}`);
    log.notes.push("CONFIRMATION CARD SHOWN (Yes never pressed)");
    await page.locator(`${R} .cancel`).click().catch(() => {}); // a real click: the card ignores scripted ones
    return true;
  }
  if (d.secret) { // the masked box: the visitor types the password, it never touches the model
    note("masked box asked for a secret; typing the password into it");
    const box = page.locator(`${R} .secret-row input`);
    await box.fill(ID.password);
    await box.press("Enter"); // the masked box only accepts the visitor's own (trusted) Enter
    answered++; log.answers.push({ t: rel(), to: "secret", value: "[password]" });
    await sleep(800);
    return true;
  }
  const ask = log.actions.filter((a) => a.type === "ask_user").at(-1);
  if (ask && ask.t > (log.lastAnswerAt || 0) && d.state === "needs-user") {
    const q = (d.messages.filter((m) => m.startsWith("agent: ")).at(-1) || "").slice(7); // the log carries no text: read the question in the dock
    const hit = ANSWERS.find(([re]) => re.test(q));
    const value = hit ? hit[1]() : "I am not sure; what would you suggest?";
    log.lastAnswerAt = rel(); log.answers.push({ t: rel(), q, a: hit ? value : `[no rule] ${value}` });
    note(`agent asked "${q.slice(0, 90)}" -> "${value}"`);
    await say(value); answered++;
    await sleep(1000);
    return true;
  }
  const human = log.actions.filter((a) => a.type === "human-step").at(-1);
  if (human && human.t > (log.lastHumanAt || 0)) { // captcha / verification / 2FA: this script is the human
    log.lastHumanAt = rel();
    const what = (d.messages.filter((m) => m.startsWith("agent: ")).at(-1) || "").slice(7);
    note(`human step: ${what}`);
    await playHuman(what);
    return true;
  }
  return false;
}
async function playHuman(what) {
  log.humanSteps.push({ t: rel(), what });
  if (/captcha|robot|puzzle/i.test(what)) { log.notes.push("CAPTCHA: cannot be played by the script"); return; }
  for (let i = 0; i < 12; i++) { // the email lands within a minute
    const msgs = await inboxMessages(inbox);
    if (msgs.length) {
      const m = msgs[0];
      note(`email "${m.subject}" (code ${m.code ? "yes" : "no"}, links ${m.links.length})`);
      const verify = m.links.find((l) => /verify|confirm|activate|token|magic|auth/i.test(l)) || null;
      if (m.code && /code|otp|digit/i.test(what + m.subject)) {
        const field = page.locator("input[autocomplete=one-time-code], input[name*=otp i], input[name*=code i], input[inputmode=numeric], input[type=text]:visible").first();
        await field.fill(m.code).catch(() => {}); await page.keyboard.press("Enter").catch(() => {});
      } else if (verify) {
        const tab = await ctx.newPage(); await tab.goto(verify, { waitUntil: "load" }).catch(() => {}); await sleep(4000); note(`opened the verification link in a second tab (${new URL(verify).hostname})`); await tab.close();
        await page.bringToFront();
      }
      return;
    }
    await sleep(5000);
  }
  log.notes.push("no email arrived");
}

// ================= the run =================
const steps = [];
const mark = async (name) => { const d = await dock(); steps.push({ name, t: rel(), url: page.url(), dock: d?.state, lastMessages: (d?.messages || []).slice(-3) }); await page.screenshot({ path: path.join(OUT, `${String(steps.length).padStart(2, "0")}-${name}.png`) }).catch(() => {}); };

try {
  await page.goto("https://sbl.so/pricing/", { waitUntil: "load" });
  await sleep(4000);
  await openDock();
  await mark("pricing-loaded");
  note('visitor: "Recommend a plan for me"');
  await say("Recommend a plan for me");
  let d = await idle();
  await mark("after-recommend");
  const acts1 = log.actions.filter((a) => !["step", "resume"].includes(a.type)).map((a) => a.type);

  note('visitor: "Okay, sign me up."');
  await say("Okay, sign me up.");
  const deadline = Date.now() + 11 * 60 * 1000;
  let sawDashboard = false;
  while (Date.now() < deadline) {
    d = await idle(16, 200);
    const url = new URL(page.url());
    if (/^\/onboarding/.test(url.pathname) && !log.dumped && d && !/^(thinking|acting)$/.test(d.state)) { // one-off: record what the required dropdown is, for engine work
      const t = page.getByText("Select an option", { exact: true }).first();
      if (await t.count().catch(() => 0)) {
        log.dumped = true;
        const grab = () => page.evaluate(() => { const b = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Select an option"); let n = b; for (let i = 0; i < 4 && n.parentElement; i++) n = n.parentElement; return { trigger: n.outerHTML.slice(0, 3000), portals: [...document.querySelectorAll("[role=listbox],[role=option],[data-radix-popper-content-wrapper],[data-radix-select-viewport],ul[role],[data-headlessui-state]")].map((e) => e.outerHTML.slice(0, 1500)).slice(0, 6) }; });
        fs.writeFileSync(path.join(OUT, "dropdown-before.json"), JSON.stringify(await grab(), null, 1));
        await t.click({ timeout: 4000 }).catch(() => {}); await sleep(800);
        fs.writeFileSync(path.join(OUT, "dropdown-open.json"), JSON.stringify(await grab(), null, 1));
        await page.screenshot({ path: path.join(OUT, "dropdown-open.png") });
        await page.keyboard.press("Escape"); note("dumped the dropdown DOM");
      }
    }
    if (/secondbrainlabs\.com$/.test(url.hostname) && !/^\/(login|signup|onboarding)/.test(url.pathname)) { sawDashboard = true; }
    if (sawDashboard) { await sleep(6000); d = await dock(); break; }
    // stalled short of the dashboard: give it one more nudge in the visitor's words
    const stalled = d && !/^(thinking|acting|needs-user)$/.test(d.state);
    if (stalled) { const n = log.answers.length; if (n < 30 && rel() - (log.lastNudge || 0) > 45) { log.lastNudge = rel(); note("stalled; visitor: \"please carry on\""); await say("Please carry on"); } }
  }
  await mark("end");
  const final = await dock();
  log.final = { url: page.url(), dockState: final?.state, messages: final?.messages || [], reachedDashboard: sawDashboard };
  log.stepsMarks = steps;
  log.acts1 = acts1;
} catch (e) {
  log.error = String(e.stack || e).slice(0, 800);
  note(`harness error: ${log.error.split("\n")[0]}`);
  await page.screenshot({ path: path.join(OUT, "error.png") }).catch(() => {});
}

// P5(d): the password must not be in the action log, the extension's storage, the dock transcript or any request body (it lives only in this process).
try {
  const worker = ctx.serviceWorkers()[0];
  const store = worker ? JSON.stringify(await worker.evaluate(async () => ({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null).catch(() => ({})) }))) : "";
  const has = (t) => t.includes(ID.password);
  log.leakCheck = { actionLog: has(JSON.stringify(log)), storage: has(store), storageBytes: store.length, requestBodies: bodies.some(has), requests: bodies.length, dockTranscript: has(JSON.stringify(log.final?.messages || [])) };
  note(`password leak check: ${JSON.stringify(log.leakCheck)}`);
} catch (e) { log.leakCheck = { error: String(e).slice(0, 200) }; }
const video = page.video();
await ctx.close();
try { fs.renameSync(await video.path(), path.join(OUT, "video.webm")); } catch (e) { log.notes.push("video: " + e.message); }
log.endedAt = new Date().toISOString();
const redact = (s) => s.split(ID.password).join("[password]");
fs.writeFileSync(path.join(OUT, "actions.json"), redact(JSON.stringify(log, null, 1)));
const count = (t) => log.actions.filter((a) => a.type === t).length;
const md = [
  `# harness-flow ${log.startedAt}`, "",
  `Test account email: ${log.email} (identity ${ID.name}, company ${ID.company}); password is random and not recorded.`,
  `Reached the dashboard: ${log.final?.reachedDashboard ?? false}. Final url: ${log.final?.url}`,
  `Actions: say ${count("say")}, point ${count("point")}, click ${count("click")}, navigate ${count("navigate")}, fill ${count("fill")}, scroll ${count("scroll")}, ask_user ${count("ask_user")}, human-step ${count("human-step")}, confirmation ${count("confirmation")}, resume ${count("resume")}, error ${count("error")}, steps ${count("step")}.`,
  "", "## Timeline", ...log.timeline.map((x) => `- ${x.t}s ${x.url}`),
  "", "## Visitor answers", ...log.answers.map((a) => `- ${a.t}s ${a.q ? `"${a.q.slice(0, 100)}" -> ${a.a}` : `${a.to}`}`),
  "", "## Steps", ...steps.map((s) => `- ${s.t}s ${s.name}: ${s.url} (dock ${s.dock})`),
  "", "## Notes", ...log.notes.map((n) => `- ${n}`),
  "", "## Dock transcript at the end", ...(log.final?.messages || []).map((m) => `- ${m}`),
].join("\n");
fs.writeFileSync(path.join(OUT, "summary.md"), redact(md));
console.log(redact(md));
process.exit(0);
