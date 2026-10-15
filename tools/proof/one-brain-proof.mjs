// Step-3 tuning-round-1 proof (run-12): the four defects the founder's live session exposed.
//   finance ask -> ONE line, then navigate + point_at the section the line is about (the outlined
//     element's own text must carry the narrated topic; screenshot at the point);
//   strategy question -> ONE answer only (no re-worded repeats — the one-line-per-turn dedupe);
//   signup ask -> asked exactly once, then waits (no near-verbatim re-ask);
//   plus the standing checks: shell+voice, the mouth speaks authored lines (echo), one voice
//   session across the moves, sblv hop, no submit, no cards, the filler measurement.
// Start the server first (PORT=8787). Usage: node tools/proof/one-brain-proof.mjs --out tools/proof/out/step3/run-12
// Hard limits: no Yes on cards, no campaigns, no LinkedIn, no pay, no account creation, stop before submit.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/step3/run-12"));
const R = "#sbl-sales-concierge-root";
const BUNDLE = path.join(repo, "sbl-agent.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(BUNDLE)) { console.error("sbl-agent.js is not built; run node tools/build-agent.mjs first."); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const LEAD = 16;
const VISITOR_LINES = [
  { text: "Do you have something for finance companies?", wait: 55 }, // -> one line + navigate + point at the section
  { text: "What was the strategy in it?", wait: 55 }, // -> one answer only
  { text: "Okay, sign me up.", wait: 70 }, // -> asked once, then waits
];
const ANSWER_TEXT = "My email is proof dot test at uberip dot com.";
const ANSWER_REPEATS = 3, ANSWER_GAP = 70;
const piece = (name, text) => { const f = path.join(OUT, name); execSync(`say -o ${f} --data-format=LEI16@48000 ${JSON.stringify(text)}`); return f; };
const silence = (sec) => Buffer.alloc(48000 * 2 * Math.max(0, sec));
const data = (f) => { const b = fs.readFileSync(f); return b.subarray(b.indexOf("data") + 8); };
const pcmParts = [silence(LEAD)];
const lineStarts = [], lineDur = [];
let cursorSec = LEAD;
for (const line of VISITOR_LINES) {
  const f = piece(`line-${lineStarts.length}.wav`, line.text);
  const dur = Number(execSync(`afinfo ${JSON.stringify(f)} 2>/dev/null | sed -n 's/.*estimated duration: //;s/ sec.*//p'`).toString().trim()) || 3;
  lineStarts.push(+cursorSec.toFixed(2));
  lineDur.push(+dur.toFixed(2));
  pcmParts.push(data(f), silence(line.wait));
  cursorSec += dur + line.wait;
}
const answerStarts = [];
const answerPiece = piece("answer.wav", ANSWER_TEXT);
const answerDur = Number(execSync(`afinfo ${JSON.stringify(answerPiece)} 2>/dev/null | sed -n 's/.*estimated duration: //;s/ sec.*//p'`).toString().trim()) || 6;
for (let i = 0; i < ANSWER_REPEATS; i++) {
  answerStarts.push(+cursorSec.toFixed(2));
  pcmParts.push(data(answerPiece), silence(ANSWER_GAP));
  cursorSec += answerDur + ANSWER_GAP;
}
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcmParts.reduce((a, b) => a + b.length, 0), 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(48000, 24); head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write("data", 36); head.writeUInt32LE(pcmParts.reduce((a, b) => a + b.length, 0), 40);
fs.writeFileSync(path.join(OUT, "speech.wav"), Buffer.concat([head, ...pcmParts]));

// the same overlap math the product's dedupe uses (guard.overlap), for scoring the run's own lines
const STOP = new Set("the a an and or but is are was were be been am i you he she it we they them his her its our your their this that these those of in on at to for with by from as so then than if not no do does did done will would can could should may might must have has had what which who whom how why when where all any some more most very just also into about over under again once here there yes yeah okay ok".split(" "));
const words = (t) => String(t || "").toLowerCase().replace(/[-_/]/g, " ").replace(/([a-z])\.([a-z])/g, "$1 $2").replace(/[^a-z0-9$%, ]+/g, " ").split(/\s+/).map((w) => w.replace(/[.,]+$/, "")).map((w) => (w.length >= 4 && /[^0-9.]/.test(w) ? w.replace(/s$/, "") : w)).filter((w) => w.length > 2 && !STOP.has(w));
const overlap = (a, b) => {
  const wa = [...new Set(words(a))], wb = [...new Set(words(b))];
  if (!wa.length || !wb.length) return 0;
  const [small, big] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const bs = new Set(big);
  let hits = 0;
  for (const w of small) if (bs.has(w)) hits++;
  return hits / small.length;
};

const events = [];
const actions = [];
const pointDetails = []; // the sbl-point proof hook: { label, text, topic, corrected, path }
const t0 = Date.now();
const rel = () => +((Date.now() - t0) / 1000).toFixed(1);
const log = (kind, detail) => { const e = { t: rel(), kind, ...detail }; events.push(e); fs.appendFileSync(path.join(OUT, "events.jsonl"), JSON.stringify(e) + "\n"); console.log(`[${String(rel()).padStart(6)}s] ${kind} ${JSON.stringify(detail).slice(0, 260)}`); };
const checks = {};
const confirmationCards = [];
const lineResults = [];

const browser = await chromium.launch({
  headless: false,
  args: ["--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${path.join(OUT, "speech.wav")}%noloop`],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
await ctx.grantPermissions(["microphone", "local-network-access"]).catch(async () => {
  for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) {
    await ctx.grantPermissions(["microphone", "local-network-access"], { origin }).catch(() => {});
  }
});
await ctx.exposeBinding("__sblAct", (_s, detail) => {
  try {
    const e = JSON.parse(detail);
    e.t = rel();
    if (e.type === "point-detail") { pointDetails.push(e); log("point-detail", e); return; }
    actions.push(e);
    if (e.type === "confirmation") confirmationCards.push({ t: rel(), target: e.target });
    log("action", e);
  } catch { /* not ours */ }
});
await ctx.addInitScript(() => {
  const K = "sbl_store_v1"; if (!sessionStorage.getItem(K)) sessionStorage.setItem(K, JSON.stringify({ sbl_proof: 1 }));
  addEventListener("sbl-agent-action", (e) => window.__sblAct?.(typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)), true);
  addEventListener("sbl-point", (e) => { try { window.__sblAct?.(JSON.stringify({ type: "point-detail", ...JSON.parse(e.detail) })); } catch {} }, true);
});
await ctx.addInitScript(fs.readFileSync(BUNDLE, "utf8"));

ctx.on("request", (r) => { if (/^http:\/\/127\.0\.0\.1:8787\//.test(r.url())) log("server", { method: r.method(), path: new URL(r.url()).pathname }); });
ctx.on("response", (r) => { if (/^http:\/\/127\.0\.0\.1:8787\//.test(r.url()) && ["/store", "/session", "/agent/chat", "/health"].includes(new URL(r.url()).pathname)) log("server-status", { path: new URL(r.url()).pathname, status: r.status() }); });

const page = await ctx.newPage();
const pages = [page];
page.on("pageerror", (e) => log("pageerror", { text: String(e).slice(0, 300) }));
for (const p of pages) p.on("framenavigated", (f) => { if (f === p.mainFrame()) log("page", { url: f.url(), tab: pages.indexOf(p) }); });

const health = (p) => p.evaluate(() => document.querySelector("#sbl-sales-concierge-root")?.dataset.sblHealth || null).catch(() => null);
const screenshot = (p, name) => p.screenshot({ path: path.join(OUT, `${String(events.length).padStart(3, "0")}-${name}.png`) }).catch(() => {});
const shellState = () => page.evaluate(() => window.__sblShellState?.() || null).catch(() => null);
const waitForShell = async (pred, ms, what) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const s = await shellState();
    if (s && pred(s)) return s;
    await sleep(200);
  }
  log("warn", { timeout: what });
  return null;
};
const transcriptOf = (p) => p.evaluate((root) => {
  const r = document.querySelector(root)?.shadowRoot;
  if (!r) return [];
  return [...r.querySelectorAll(".messages .msg, .messages .event")].map((m) => ({
    role: m.classList.contains("user") ? "user" : m.classList.contains("event") ? "event" : "assistant",
    voice: Boolean(m.dataset.voice),
    text: m.textContent.trim().slice(0, 300),
  }));
}, R).catch(() => []);
const assistantLines = async (p) => (await transcriptOf(p)).filter((l) => l.role === "assistant").map((l) => l.text);
const mouthLog = (p) => p.evaluate(() => window.__sblMouthLog?.() || null).catch(() => null);
const startSampler = (p) => p.evaluate(() => {
  window.__samples = [];
  window.__silenceRun = (a, b) => {
    const w = (window.__samples || []).filter((s) => s.t >= a && s.t <= b);
    const on = w.map((s, i) => (s.l > 0.01 ? i : -1)).filter((i) => i >= 0);
    if (on.length < 2) return null;
    let best = 0, run = 0;
    for (let i = on[0]; i <= on.at(-1); i++) { if (w[i].l > 0.01) { best = Math.max(best, run); run = 0; } else run += 100; }
    return best;
  };
  window.__firstAudible = () => { const s = (window.__samples || []).find((x) => x.l > 0.01); return s ? s.t : null; };
  window.__sampler = setInterval(async () => {
    const pc = window.__sblVoiceStats?.()?.pc;
    if (!pc) return;
    let l = 0;
    (await pc.getStats().catch(() => null))?.forEach?.((s) => { if (s.type === "inbound-rtp" && s.kind === "audio") l = Math.max(l, s.audioLevel || 0); });
    window.__samples.push({ t: Date.now(), l });
    if (window.__samples.length > 9000) window.__samples.shift();
  }, 100);
});
const audioMaxIn = (p, a, b) => p.evaluate(([x, y]) => Math.max(0, ...(window.__samples || []).filter((s) => s.t >= x && s.t <= y).map((s) => s.l)), [a, b]).catch(() => null);
const utterAt = (i) => t0 + (lineStarts[i] ?? 1e9) * 1000;
const utterEnd = (i) => utterAt(i) + lineDur[i] * 1000;
const answerAt = (i) => t0 + (answerStarts[i] ?? 1e9) * 1000;

// The lines the brain authored between two wall-clock marks come from the mouth log's authored
// entries (the dock's line list races with the greeting; the mouth log does not).

// ============ 1. pricing, Talk, shell + voice ============
log("mark", { step: "goto sbl.so/pricing" });
// sbl.so's "load" event can hang past 30 s on a heavy asset (seen live: the first run-12 attempt
// died here before any check ran). domcontentloaded is what the proof needs — the bundle boots at
// document start — and one retry absorbs a hung first attempt.
const gotoSite = async (url) => {
  try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }); }
  catch { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }); }
};
await gotoSite("https://sbl.so/pricing/");
await page.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
checks.dockOnPricing = (await page.locator(`${R} .launcher`).count()) > 0;
checks.sblHealthOk = (await health(page)) === "ok";
await page.evaluate(() => window.scrollTo(0, 1200)); await sleep(800);
await page.locator(`${R} .voice`).first().evaluate((el) => el.click());
log("mark", { step: "Talk pressed" });
let voiceLive = false;
for (let i = 0; i < 40 && !voiceLive; i++) {
  await sleep(1000);
  voiceLive = await page.evaluate((root) => document.querySelector(root)?.shadowRoot?.querySelector(".voice")?.classList.contains("live") || false, R).catch(() => false);
}
checks.voiceConnected = voiceLive;
checks.pcSet = await page.evaluate(() => { const v = window.__sblVoiceStats?.(); if (!v?.pc) return false; window.__pc0 = v.pc; return true; }).catch(() => false);
const built = await waitForShell((s) => s.built && s.log.some((e) => e.type === "shell_ready"), 30_000, "shell_ready");
checks.shellBuilt = Boolean(built);
await startSampler(page);

// ============ (F) finance ask -> ONE line + navigate + point at the section the line is about ============
{
  const i = 0;
  const at = utterAt(i), end = utterEnd(i), rel0 = lineStarts[i];
  log("visitor-line", { i, wavAt: lineStarts[i], dur: lineDur[i], text: VISITOR_LINES[i].text });
  await sleep(55_000);
  const mouth = await mouthLog(page);
  const authored = (mouth?.authored || []).filter((m) => m.at > end);
  const first = authored[0] || null;
  const reWords = first ? authored.slice(1).filter((m) => overlap(m.text, first.text) >= 0.25).length : -1;
  const navs = actions.filter((a) => a.type === "navigate" && a.t > rel0);
  const points = actions.filter((a) => a.type === "point" && a.t > rel0);
  const details = pointDetails.filter((d) => d.t > rel0);
  const spokenHere = await audioMaxIn(page, at, Date.now());
  const pcNow = await page.evaluate(() => window.__sblVoiceStats?.() && { same: window.__sblVoiceStats().pc === window.__pc0, conn: window.__sblVoiceStats().pc.connectionState }).catch(() => null);
  // the outlined element's own text must carry the narrated topic (point ≠ narration)
  const lineWords = new Set(words(first?.text || ""));
  const aligned = details.map((d) => ({
    label: d.label,
    textMatches: (words(d.text || "").filter((w) => lineWords.has(w)).length) >= 1 || Boolean(d.corrected),
    corrected: d.corrected || null,
    topicHit: (words((d.topic || []).join(" ")).length) >= 1,
  }));
  const res = { step: "F", firstLine: first?.text?.slice(0, 160), reWords, navs: navs.map((n) => n.target), points: points.slice(-3).map((p) => p.target), pointDetails: aligned, answeredAudibly: spokenHere, pc: pcNow };
  lineResults.push(res);
  checks.F_oneLine = Boolean(first) && reWords === 0;
  checks.F_movedAndPointed = navs.length > 0 && points.length > 0;
  checks.F_pointAligns = aligned.length > 0 && aligned.some((a) => a.textMatches);
  checks.F_audible = spokenHere != null && spokenHere > 0.01;
  checks.F_oneVoiceSession = pcNow?.same === true && pcNow?.conn === "connected";
  log("line-result", res);
  await screenshot(page, "F-finance-point");
  fs.writeFileSync(path.join(OUT, "website-phase.json"), JSON.stringify({ transcript: await transcriptOf(page), mouth: await mouthLog(page), actions: actions.slice(), pointDetails: pointDetails.slice() }, null, 1));
}

// ============ (S) strategy question -> ONE answer only ============
{
  const i = 1;
  const at = utterAt(i), end = utterEnd(i), rel1 = lineStarts[i];
  log("visitor-line", { i, wavAt: lineStarts[i], dur: lineDur[i], text: VISITOR_LINES[i].text });
  await sleep(50_000);
  const mouth = await mouthLog(page);
  const authored = (mouth?.authored || []).filter((m) => m.at > end);
  const first = authored[0] || null;
  const reWords = first ? authored.slice(1).filter((m) => overlap(m.text, first.text) >= 0.25).length : -1;
  const aligned = pointDetails.filter((d) => d.t > rel1).map((d) => ({ label: d.label, text: (d.text || "").slice(0, 90), corrected: d.corrected || null }));
  const pcNow = await page.evaluate(() => window.__sblVoiceStats?.() && { same: window.__sblVoiceStats().pc === window.__pc0, conn: window.__sblVoiceStats().pc.connectionState }).catch(() => null);
  const res = { step: "S", firstLine: first?.text?.slice(0, 160), reWords, linesAfterFirst: authored.slice(1).map((m) => m.text.slice(0, 90)), pointDetails: aligned, pc: pcNow };
  lineResults.push(res);
  checks.S_oneAnswer = Boolean(first) && reWords === 0;
  checks.S_oneVoiceSession = pcNow?.same === true && pcNow?.conn === "connected";
  log("line-result", res);
  await screenshot(page, "S-strategy-answer");
}

// ============ (U) "sign me up" -> asked exactly once, then waits ============
{
  const i = 2;
  const at = utterAt(i), end = utterEnd(i), relEnd2 = lineStarts[i] + lineDur[i];
  log("visitor-line", { i, wavAt: lineStarts[i], dur: lineDur[i], text: VISITOR_LINES[i].text });
  const sblv = await page.evaluate(() => document.cookie.match(/sblv=([\w-]+)/)?.[1]).catch(() => null);
  const hopNavMark = { url: null };
  const onNav = (f) => { if (f === page.mainFrame() && /app\.secondbrainlabs\.com/.test(f.url()) && !hopNavMark.url) hopNavMark.url = f.url(); };
  page.on("framenavigated", onNav);
  let app = null;
  while (Date.now() < end + 120_000 && !app) {
    await sleep(1000);
    app = ctx.pages().find((p) => /app\.secondbrainlabs\.com/.test(p.url())) || null;
  }
  page.off("framenavigated", onNav);
  checks.U_appLanded = Boolean(app);
  if (!app) { lineResults.push({ step: "U", error: "no app page within 120 s" }); }
  else {
    if (!pages.includes(app)) { pages.push(app); app.on("pageerror", (e) => log("pageerror", { text: String(e).slice(0, 300) })); }
    const hopUrl = hopNavMark.url || app.url();
    checks.U_sblvRode = Boolean(sblv) && new URL(hopUrl).searchParams.get("sblv") === sblv;
    log("app-hop", { hopUrl: hopUrl.slice(0, 140) });
    await app.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    checks.U_dockOnApp = (await app.locator(`${R} .launcher`).count()) > 0;
    checks.U_sblHealthApp = (await health(app)) === "ok";
    // auto-reconnect: the voice returns WITHOUT a press (the one-shot flag from the website session)
    let appLive = false;
    for (let i2 = 0; i2 < 45 && !appLive; i2++) {
      await sleep(1000);
      appLive = await app.evaluate((root) => document.querySelector(root)?.shadowRoot?.querySelector(".voice")?.classList.contains("live") || false, R).catch(() => false);
    }
    checks.U_voiceAutoReconnects = appLive;
    // the questions the brain asked after "sign me up": ask_user actions + question-shaped says
    let asks = [];
    const askDeadline = Date.now() + 150_000;
    while (Date.now() < askDeadline && !asks.length) {
      await sleep(1000);
      asks = actions.filter((a) => a.type === "ask_user" && a.t > relEnd2);
    }
    const mouthAtWatchStart = await mouthLog(app);
    const questionsAtWatchStart = (mouthAtWatchStart?.authored || []).filter((m) => m.at > t0 + relEnd2 * 1000 && /\?\s*$/.test(m.text)).map((m) => m.text);
    // then watch for re-asks for 45 s (ask-once: silence = wait, not a re-ask loop)
    await sleep(45_000);
    const askUserAfter = actions.filter((a) => a.type === "ask_user" && a.t > relEnd2).length;
    const mouth2 = await mouthLog(app);
    const questionsSaid2 = (mouth2?.authored || []).filter((m) => m.at > t0 + relEnd2 * 1000 && /\?\s*$/.test(m.text)).map((m) => m.text);
    const newQuestionsInWatch = questionsSaid2.filter((q) => !questionsAtWatchStart.some((o) => overlap(q, o) >= 0.5));
    // no two questions overlap >= 0.5 (never re-asked verbatim or near-verbatim)
    let reAsk = 0;
    for (let x = 0; x < questionsSaid2.length; x++) for (let y = x + 1; y < questionsSaid2.length; y++) if (overlap(questionsSaid2[x], questionsSaid2[y]) >= 0.5) reAsk++;
    // the spoken answer lands and is typed; nothing submitted, no password
    let typedEmail = null, answeredAt = null;
    const fillDeadline = Date.now() + 240_000; // the app reconnect re-reads the WAV from its start (the documented replay artifact): the real answer instance can land ~205 s after the reconnect
    const readForm = () => app.evaluate(() => [...document.querySelectorAll("input")].filter((el) => el.type !== "hidden" && (el.offsetParent !== null || el.getBoundingClientRect().width > 0)).map((el) => ({ type: el.type, name: (el.name || el.id || "") + " " + (el.placeholder || ""), value: el.value || "", password: el.type === "password" }))).catch(() => []);
    while (Date.now() < fillDeadline && !(typedEmail && answeredAt)) {
      await sleep(2000);
      const form = await readForm();
      typedEmail ||= form.find((f) => (/email/i.test(f.name) || f.type === "email") && /@|\bproof\b|uberip|huberip/i.test(f.value))?.value || null; // the signup field is type=email with no name (the founder's form)
      if (!answeredAt) answeredAt = (actions.find((a) => a.type === "answer" && a.t > relEnd2) || {}).t || null;
    }
    const formAll = await readForm();
    // Full-phase ask measurement (the 45 s window above can close before a late follow-up lands): how
    // many ask_user actions the whole signup phase took, whether any two were near-verbatim, and
    // whether anything was asked AFTER the last answer (ask -> wait -> act, never loop).
    const askUserAll = actions.filter((a) => a.type === "ask_user" && a.t > relEnd2);
    const answersAll = actions.filter((a) => a.type === "answer" && a.t > relEnd2);
    const lastAnswerAt = answersAll.length ? answersAll.at(-1).t : null;
    const asksAfterLastAnswer = lastAnswerAt == null ? askUserAll.length : askUserAll.filter((a) => a.t > lastAnswerAt).length;
    checks.U_askedOnce = askUserAll.length <= 2 && reAsk === 0; // one ask; one follow-up naming what is missing is the sanctioned shape (a replay feeds non-answers)
    checks.U_thenWaits = asksAfterLastAnswer === 0 && newQuestionsInWatch.length === 0;
    checks.U_emailFilled = Boolean(typedEmail);
    checks.U_passwordUntouched = !(formAll.find((f) => f.password && f.value.trim()));
    checks.U_answeredByVoice = Boolean(answeredAt);
    checks.U_noFillItYourself = !(await transcriptOf(app)).some((l) => /fill it (in )?yourself|type it (in )?yourself|you can fill|do it yourself/i.test(l.text));
    const formState = formAll.filter((f) => f.value).map((f) => `${f.type}:${(f.name || "?").slice(0, 16)}=${f.value.slice(0, 30)}`);
    log("U-form", { typedEmail, answeredAt, formState, asks: askUserAll.length, asksAfterLastAnswer, questionsSaid2, newQuestionsInWatch });
    await app.screenshot({ path: path.join(OUT, "U-signup-form.png") }).catch(() => {});
    fs.writeFileSync(path.join(OUT, "app-phase.json"), JSON.stringify({
      transcript: await transcriptOf(app),
      mouth: await mouthLog(app),
      hopUrl,
      actions: actions.slice(),
      pointDetails: pointDetails.slice(),
    }, null, 1));
    lineResults.push({ step: "U", hopUrl: hopUrl.slice(0, 140), asks: askUserAll.length, asksAfterLastAnswer, answers: answersAll.map((a) => a.t), questionsSaid: questionsSaid2, newQuestionsInWatch, answeredAt, typedEmail, formState });
  }
}

// ============ the filler measurement ============
const websitePhase = fs.existsSync(path.join(OUT, "website-phase.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "website-phase.json"), "utf8")) : null;
const appPhase = fs.existsSync(path.join(OUT, "app-phase.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "app-phase.json"), "utf8")) : null;
const spokenAll = [...(websitePhase?.mouth?.spoken || []), ...(appPhase?.mouth?.spoken || [])];
const extraSpoken = spokenAll.filter((s) => !s.echoed && s.role === "assistant");
const fillerReport = {
  requestLikeUtterances: VISITOR_LINES.length,
  voiceSpokenLines: spokenAll.length,
  echoedLines: spokenAll.filter((s) => s.echoed).length,
  nonEchoedVoiceLines: extraSpoken.length,
  pollutedTurns: extraSpoken.length,
  extraWordsPerPollutedTurn: extraSpoken.map((s) => ({ text: s.text.slice(0, 140), words: s.text.split(/\s+/).length })),
};
checks.fillerMeasured = spokenAll.length > 0;
checks.noConfirmationCards = confirmationCards.length === 0;

// ============ wrap ============
const videoHandles = pages.map((p, i) => ({ index: i + 1, handle: p.video() }));
await ctx.close();
for (const v of videoHandles) {
  try { const from = v.handle && await v.handle.path(); if (from && fs.existsSync(from)) fs.renameSync(from, path.join(OUT, v.index === 1 ? "video.webm" : `video-${v.index}.webm`)); } catch (e) { log("warn", { video: String(e).slice(0, 120) }); }
}
const okKeys = ["dockOnPricing", "sblHealthOk", "voiceConnected", "pcSet", "shellBuilt",
  "F_oneLine", "F_movedAndPointed", "F_pointAligns", "F_audible", "F_oneVoiceSession",
  "S_oneAnswer", "S_oneVoiceSession",
  "U_appLanded", "U_sblvRode", "U_dockOnApp", "U_sblHealthApp", "U_voiceAutoReconnects", "U_askedOnce", "U_thenWaits", "U_emailFilled", "U_passwordUntouched", "U_answeredByVoice", "U_noFillItYourself",
  "fillerMeasured", "noConfirmationCards"];
checks.ok = okKeys.every((k) => checks[k] === true);
const summary = { startedAt: new Date(t0).toISOString(), out: OUT, visitorLines: VISITOR_LINES, answerText: ANSWER_TEXT, lineStarts, lineDur, answerStarts, answerDur, lineResults, fillerReport, checks, confirmationCards, websitePhase, appPhase, endedAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ok: checks.ok, failed: Object.entries(checks).filter(([k, v]) => v === false).map(([k]) => k) }, null, 1));
process.exit(checks.ok ? 0 : 1);
