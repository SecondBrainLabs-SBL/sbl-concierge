// usage: node drive.mjs <label> <task,task,...> [port]   e.g. node drive.mjs g345 T3,T4,T5
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
import { startProxy } from "./proxy.mjs";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [, , LABEL, TASKS, PORT = "8787"] = process.argv;
const OUT = path.join(HERE, "out", LABEL); fs.mkdirSync(OUT, { recursive: true });
const MODEL = /BACKEND_MODEL = "([^"]+)"/.exec(fs.readFileSync(path.join(HERE, "../../live-config.mjs"), "utf8"))[1];
const KNOW = fs.readFileSync(path.join(HERE, "../browser-use-trial/knowledge.txt"), "utf8");
const SYSTEM = "You are SBL's own concierge, showing a prospective customer around sbl.so and the SBL product.\nWork by yourself, be efficient, and report only what you actually saw on the page.\n\nSBL KNOWLEDGE:\n" + KNOW;
const NUDGE = "\nKeep working until the goal is fully achieved. Never defer work to a later turn; you have many steps available.";
const SAFETY = "\nHARD LIMITS: never launch/run/start a campaign, never connect a LinkedIn account, never enter payment details or buy anything, never invite people, never message anyone, never import real leads. If a captcha appears, stop and report it (done with success=false).";
const TESTVALS = "\nIf a form needs a phone number use 9999999999; if it needs a company website URL use https://example.com. Never invent any other value; if you lack a required value, stop and report it.";
const TASKS_TXT = {
  T1: ["https://sbl.so/", "A visitor who runs a small lead-gen agency asks which plan fits them. Go to the pricing page of https://sbl.so, work out the best plan for them, and finish by stating the plan, its price and the exact on-page evidence (quote the page text)."],
  T1s: ["https://sbl.so/pricing/", "Open https://sbl.so/pricing/ . Read every plan card. A small lead-gen agency needs multiple client workspaces and a few seats. Choose the cheapest plan that fits, and finish by stating plan name, monthly price, and quoting the exact on-page text you based it on."],
  T2: ["https://sbl.so/", "Find the customer success story on sbl.so most similar to a small B2B lead-gen agency and open it; report the customer and the headline result."],
  T2s: ["https://sbl.so/", "Start at https://sbl.so . Find the customer stories / case studies / testimonials section (check the nav and footer). Open the story about an agency or lead-gen company. Report customer name and the headline result number exactly as shown on that page."],
  T3: ["https://sbl.so/", "Create a new SBL free-trial account. Start from https://sbl.so (use the Try For Free / sign up button). Use the create_inbox tool to get a disposable email address and use it to sign up. Name: CX Test. Company: CX-TEST Trial. For any password field use the fill_secret tool with name sbl_password (index = the password input). If email verification is required, use get_latest_email to fetch the link or code and complete it. If signup only offers Google/LinkedIn sign-in with no email option, stop and report. Finish when you are logged in (or at the first thing that needs a human), and report what each step was." + TESTVALS],
  T4: [null, "You are logged in to a new SBL test account (continue in this browser). Complete any onboarding, arrive on the dashboard, and begin creating a first LinkedIn outreach campaign for 'a lead-gen agency selling appointment setting to B2B SaaS founders'. Go as far as a saved DRAFT and stop before any step that launches, imports real leads, connects LinkedIn or asks for payment. Report exactly where you stopped and why, and the campaign id from the URL. If a password is asked use the fill_secret tool with name sbl_password." + TESTVALS],
  S: ["https://sbl.so/", "This is a capability test. Step 1: call point_at on the Pricing link in the top navigation with label 'Pricing'. Step 2: call ask_user to ask the visitor how many teammates they have. Step 3: call confirm with title 'Open pricing?' and body 'I will open the pricing page.'; if the answer starts with yes, click the Pricing link. Step 4: finish with done."],
  T4L: ["https://app.secondbrainlabs.com/login", "Log in to the existing SBL test account at this page with email EMAIL_X (use the email+password option; for the password field use the fill_secret tool with name sbl_password). Then " + "Complete any onboarding, arrive on the dashboard, and begin creating a first LinkedIn outreach campaign for 'a lead-gen agency selling appointment setting to B2B SaaS founders'. Go as far as a saved DRAFT and stop before any step that launches, imports real leads, connects LinkedIn or asks for payment. Report exactly where you stopped and why, and the campaign id from the URL." + TESTVALS],
  T5: [null, "Read-only, do not change anything: find where campaign statistics/analytics are shown for the draft campaign in this account and report what is there."],
};
// ---- mail.tm
const MAIL = "https://api.mail.tm"; const mail = {};
async function createInbox() {
  const dom = (await (await fetch(MAIL + "/domains")).json())["hydra:member"][0].domain;
  const addr = `cxtest${crypto.randomBytes(4).toString("hex")}@${dom}`, pw = crypto.randomBytes(12).toString("base64url");
  await fetch(MAIL + "/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, password: pw }) });
  mail.token = (await (await fetch(MAIL + "/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr, password: pw }) })).json()).token; mail.addr = addr;
  fs.writeFileSync(path.join(HERE, "out/test-email.txt"), addr); return addr;
}
async function latestEmail() {
  if (!mail.token) return "No inbox yet; call create_inbox first";
  const h = { Authorization: "Bearer " + mail.token };
  for (let i = 0; i < 12; i++) {
    const ms = (await (await fetch(MAIL + "/messages", { headers: h })).json())["hydra:member"] || [];
    if (ms.length) { const m = await (await fetch(MAIL + "/messages/" + ms[0].id, { headers: h })).json(); const text = m.text || "";
      const links = [...new Set((text + " " + (m.html || []).join(" ")).match(/https?:\/\/[^\s\]\)>"']+/g) || [])];
      return `From: ${m.from?.address}\nSubject: ${m.subject}\nBody:\n${text.slice(0, 1500)}\nLinks:\n${links.join("\n")}`; }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return "No email arrived within 60s; try again or resend.";
}
const pwFile = path.join(HERE, "out/.pw"); if (!fs.existsSync(pwFile)) fs.writeFileSync(pwFile, crypto.randomBytes(9).toString("base64url") + "A1!");
const SECRET = { sbl_password: fs.readFileSync(pwFile, "utf8") };
// ---- state
const { srv, stats } = await startProxy(+PORT);
let T = null; // current task
const log = (...a) => fs.appendFileSync(path.join(OUT, "driver.log"), a.join(" ") + "\n");
function summary() { // resume text held by the driver
  const s = T.steps; if (!s.length) return "";
  return `Last memory: ${s.at(-1).reflection?.memory || ""}\nRecent actions: ` + s.slice(-12).map((x) => `[${x.idx + 1}] ${x.action.name}(${JSON.stringify(x.action.input).slice(0, 80)}) -> ${String(x.action.output).slice(0, 90)}`).join(" | ") + `\nCurrent inbox email: ${mail.addr || "none yet"}`;
}
const bindings = {
  get: () => T && T.active ? { active: true, goal: T.goal, resume: T.steps.length ? summary() : "", opts: { model: MODEL, baseURL: `http://127.0.0.1:${PORT}/v1`, maxSteps: Math.max(2, 40 - T.steps.length), system: SYSTEM, extras: !!T.extras, sameTab: process.env.SAMETAB === "1", headless: !!T.headless } } : { active: false },
  started: (a) => { T.starts.push({ t: Date.now(), ...a }); },
  step: (s) => { T.steps.push(s); },
  done: (r) => { T.result = r; T.active = false; T.finish?.(); },
  crash: (e) => { T.crashes.push(e); },
  create_inbox: () => createInbox(), get_latest_email: () => latestEmail(),
  secret: (n) => SECRET[n], blocked: (b) => { T.blocked.push(b); }, pointed: (p) => T.events.push({ pointed: p }),
  activity: (a) => T.events.push({ activity: a }), confirm: (c) => { T.events.push({ confirm: c }); return "yes (driver auto-answer)"; },
  ask: (q) => { T.events.push({ ask: q }); return "3"; },
};
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ bypassCSP: true, viewport: { width: 1366, height: 850 }, recordVideo: { dir: path.join(OUT, "video"), size: { width: 1366, height: 850 } } });
const page = await ctx.newPage();
await page.exposeFunction("__pa", async (m, a) => { try { const r = await bindings[m](a ? JSON.parse(a) : null); return r === undefined ? null : JSON.stringify(r); } catch (e) { log("binding err", m, e); return JSON.stringify("ERR " + e); } });
await ctx.grantPermissions(["local-network-access"], { origin: "https://sbl.so" }).catch((e) => log("perm", e.message));
for (const o of ["https://app.secondbrainlabs.com", "https://www.sbl.so", "https://secondbrainlabs.com"]) await ctx.grantPermissions(["local-network-access"], { origin: o }).catch(() => {});
// bundle injects CSS into <head> at import time, so it must run after the DOM exists
await ctx.addInitScript("(()=>{const f=()=>{" + fs.readFileSync(path.join(HERE, "out/glue.iife.js"), "utf8") + "};document.readyState==='loading'?addEventListener('DOMContentLoaded',f):f()})()");
const ALLOWED = /(^|\.)(sbl\.so|secondbrainlabs\.com)$/;
await ctx.route("**/*", (route) => {
  const r = route.request(), u = new URL(r.url());
  if (r.isNavigationRequest() && (()=>{try{return r.frame().parentFrame()===null}catch{return true}})() && !ALLOWED.test(u.hostname) && u.protocol.startsWith("http")) { log("BLOCKED nav", u.hostname); T && T.blockedNav.push(r.url().slice(0, 100)); return route.abort(); }
  if (/(^|\.)(linkedin\.com|stripe\.com)$/.test(u.hostname) && r.isNavigationRequest()) { log("BLOCKED", u.hostname); return route.abort(); }
  route.continue();
});
ctx.on("page", (p) => { if (p !== page) { log("NEW TAB", p.url()); T && T.newTabs.push(p.url()); } });
page.on("load", () => { if (T && T.active) T.loads.push({ t: Date.now(), url: page.url() }); });
page.on("console", (m) => { const t = m.text(); if (/error/i.test(m.type()) && T) T.consoleErrs.push(t.slice(0, 150)); });
const DUMP = async (name) => { const d = path.join(OUT, name); fs.mkdirSync(d, { recursive: true });
  await page.screenshot({ path: path.join(d, "final.png") }).catch(() => {});
  const body = await page.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => ""); fs.writeFileSync(path.join(d, "final-page.txt"), (page.url() + "\n" + body).split(SECRET.sbl_password).join("***")); return { url: page.url(), body }; };

const results = [];
for (const name of TASKS.split(",")) {
  let [start, goalRaw] = TASKS_TXT[name]; goalRaw = goalRaw.replace("EMAIL_X", process.env.ACCT_EMAIL || "");
  const extras = process.env.EXTRAS === "1", headless = process.env.HEADLESS === "1";
  T = { name, goal: goalRaw + NUDGE + SAFETY, steps: [], starts: [], loads: [], crashes: [], blocked: [], blockedNav: [], newTabs: [], events: [], consoleErrs: [], active: true, extras, headless, result: null };
  const p0 = stats.calls, e0 = stats.log.length; const t0 = Date.now();
  const snap = () => page.evaluate(() => [...document.body.children, ...document.head.querySelectorAll("style")].map((e) => { const c = getComputedStyle(e); return e.tagName + "#" + e.id + "." + String(e.className).slice(0, 40) + " pos=" + c.position + " z=" + c.zIndex + " len=" + (e.outerHTML.length) + " shadow=" + !!e.shadowRoot; }).filter((s) => /pos=(fixed|absolute)|STYLE/.test(s)));
  if (name === "S") T.domBefore = await snap();
  const fin = new Promise((r) => (T.finish = r));
  if (start) await page.goto(start, { waitUntil: "domcontentloaded" }); else await page.evaluate(() => window.__paRun()).catch((e) => log("run eval", e));
  const timeout = new Promise((r) => setTimeout(() => r("timeout"), 12 * 60 * 1000));
  const why = await Promise.race([fin.then(() => "done"), timeout]);
  if (why === "timeout") { T.active = false; }
  await new Promise((r) => setTimeout(r, 2500));
  if (name === "S") { T.domAfter = await snap(); }
  const dt = (Date.now() - t0) / 1000; const fp = await DUMP(name);
  const n = T.steps.length, tok = T.steps.reduce((a, s) => a + (s.usage?.totalTokens || 0), 0);
  const row = { task: name, model: MODEL, why, steps: n, seconds: +dt.toFixed(1), sec_per_step: +(dt / Math.max(n, 1)).toFixed(1),
    agent_success: T.result?.success ?? null, final_result: T.result?.data ?? null, tokens: tok, cost_derived_usd: +(tok * 0.000215 / 1000).toFixed(4),
    prompt_tokens: T.steps.reduce((a, s) => a + (s.usage?.promptTokens || 0), 0), completion_tokens: T.steps.reduce((a, s) => a + (s.usage?.completionTokens || 0), 0),
    step_errors_last: T.steps.at(-1)?.errors ?? 0, proxy_calls: stats.calls - p0, proxy_http_errors: stats.log.slice(e0).filter((x) => x.status !== 200).length, proxy_errs: stats.errors.length,
    page_loads: T.loads.length, agent_starts: T.starts.length, resumes: T.starts.filter((s) => s.resumed).length, loads: T.loads.map((l) => l.url), crashes: T.crashes, blocked_clicks: T.blocked, blocked_nav: T.blockedNav, new_tabs: T.newTabs,
    dom_chars_avg: Math.round(T.steps.reduce((a, s) => a + s.browserStateChars, 0) / Math.max(n, 1)), dom_chars_max: Math.max(0, ...T.steps.map((s) => s.browserStateChars)), sys_chars: T.steps[0]?.sysChars, has_image: T.steps.some((s) => s.hasImage),
    final_url: fp.url, steps_log: T.steps.map((s) => ({ i: s.idx + 1, url: s.url, goal: s.reflection?.next_goal, eval: s.reflection?.evaluation_previous_goal, act: s.action.name, in: JSON.stringify(s.action.input).slice(0, 160), out: String(s.action.output).slice(0, 200), tok: s.usage?.totalTokens })), events: T.events, domBefore: T.domBefore, domAfter: T.domAfter, console_errs: T.consoleErrs.slice(0, 10) };
  fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(row, null, 1).split(SECRET.sbl_password).join("***")); results.push(row);
  console.log(name, JSON.stringify({ why, steps: n, seconds: row.seconds, ok: row.agent_success, loads: row.page_loads, resumes: row.resumes, tok })); console.log("RESULT:", String(row.final_result).slice(0, 400));
  if (name === "T3" && !/secondbrainlabs/.test(fp.url)) { /* keep going anyway; T4 decides */ }
}
fs.writeFileSync(path.join(OUT, "proxy-log.json"), JSON.stringify(stats.log));
await ctx.close(); await browser.close(); srv.close();
console.log("videos:", fs.readdirSync(path.join(OUT, "video")).map((f) => f + ":" + fs.statSync(path.join(OUT, "video", f)).size));
