// Step-1 proof: the WHOLE concierge runs from the served bundle (sbl-agent.js) with NO extension loaded.
//   sbl.so home -> dock/orb -> voice connects with a fake mic, one spoken utterance answered -> click through to
//   pricing (full load) -> dock reappears and the conversation survives via the server store -> click the sign-up
//   link to app.secondbrainlabs.com -> the URL carries ?sblv=<id>, the bundle runs there and the state continues.
// Start the server first: (set -a; source ../sbl-sales-agent/.env; set +a; unset EXTENSION_ID; PORT=8787 node server.mjs &)
// Usage: node tools/proof/script-tag.mjs [--out tools/proof/out/step1/run-1]
// Hard limits honoured: never presses Yes on a confirmation card, never touches campaigns, LinkedIn or payment,
// and stops before the sign-up form is used: no account is created.
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/step1/run-1"));
const RESTART = process.argv.includes("--restart"); // kill + restart the server between home and pricing: durable state must survive
const R = "#sbl-sales-concierge-root";
const BUNDLE = path.join(repo, "sbl-agent.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(BUNDLE)) { console.error("sbl-agent.js is not built; run node tools/build-agent.mjs first."); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// One WAV: silence (connect + greeting), the utterance, silence for the answer. Chrome plays it once (%noloop).
const LEAD = 16, TAIL = 30;
const wav = path.join(OUT, "utterance.wav");
const piece = (name, text) => { const f = path.join(OUT, name); execSync(`say -o ${f} --data-format=LEI16@48000 ${JSON.stringify(text)}`); return f; };
const utterance = piece("utterance-src.wav", "What is S B L, in one sentence?");
const silence = (sec) => Buffer.alloc(48000 * 2 * sec);
const data = (f) => { const b = fs.readFileSync(f); return b.subarray(b.indexOf("data") + 8); };
const pcm = Buffer.concat([silence(LEAD), data(utterance), silence(TAIL)]);
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(48000, 24); head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(wav, Buffer.concat([head, pcm]));

const events = []; // one JSON object per line -> events.jsonl
const t0 = Date.now();
const rel = () => +((Date.now() - t0) / 1000).toFixed(1);
const log = (kind, detail) => { const e = { t: rel(), kind, ...detail }; events.push(e); fs.appendFileSync(path.join(OUT, "events.jsonl"), JSON.stringify(e) + "\n"); console.log(`[${String(rel()).padStart(6)}s] ${kind} ${JSON.stringify(detail).slice(0, 220)}`); };
const checks = {};
const confirmationCards = [];

const browser = await chromium.launch({
  headless: false,
  args: ["--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}%noloop`],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
// Local Network Access (page -> 127.0.0.1:8787) and the mic, for both site origins; fake-ui keeps Chrome from prompting.
await ctx.grantPermissions(["microphone", "local-network-access"]).catch(async () => {
  for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) {
    await ctx.grantPermissions(["microphone", "local-network-access"], { origin }).catch(() => {});
  }
});
await ctx.exposeBinding("__sblAct", (_s, detail) => {
  try { const e = JSON.parse(detail); if (e.type === "confirmation") confirmationCards.push({ t: rel(), target: e.target }); log("action", e); } catch { /* not ours */ }
});
// Order matters: the proof flag must exist before the bundle boots on every document. In script-tag mode the store
// adapter reads its cosmetics from the sessionStorage cache blob ("sbl_store_v1"), so seed it in that shape — but never
// overwrite it: on a same-tab full load the previous page's write-through cache (its memory) is in there.
await ctx.addInitScript(() => { const K = "sbl_store_v1"; if (!sessionStorage.getItem(K)) sessionStorage.setItem(K, JSON.stringify({ sbl_proof: 1 })); addEventListener("sbl-agent-action", (e) => window.__sblAct?.(typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)), true); });
await ctx.addInitScript(fs.readFileSync(BUNDLE, "utf8")); // what the WordPress <script> tag will load

// Every call the bundle makes to the local server: /store hits, /session hits, with the sblv they carry.
ctx.on("request", (r) => {
  if (!/^http:\/\/127\.0\.0\.1:8787\//.test(r.url())) return;
  const u = new URL(r.url());
  log("server", { method: r.method(), path: u.pathname, sblv: u.searchParams.get("sblv") || undefined });
});
ctx.on("response", (r) => {
  if (!/^http:\/\/127\.0\.0\.1:8787\//.test(r.url())) return;
  const u = new URL(r.url());
  if (["/store", "/session", "/health"].includes(u.pathname)) log("server-status", { path: u.pathname, status: r.status(), sblv: u.searchParams.get("sblv") || undefined });
});

const page = await ctx.newPage();
page.on("pageerror", (e) => log("pageerror", { text: String(e).slice(0, 300) }));
const pages = [page];
for (const p of pages) p.on("framenavigated", (f) => { if (f === p.mainFrame()) log("page", { url: f.url(), tab: pages.indexOf(p) }); });

const health = (p) => p.evaluate(() => document.querySelector("#sbl-sales-concierge-root")?.dataset.sblHealth || null).catch(() => null);
const sblvCookie = (p) => p.evaluate(() => document.cookie.match(/sblv=([\w-]+)/)?.[1] || null).catch(() => null);
// The dock transcript (open shadow root: the proof flag is set). `voice` marks lines the voice session put there.
const transcript = (p) => p.evaluate((root) => {
  const s = document.querySelector(root)?.shadowRoot;
  if (!s) return null;
  return [...s.querySelectorAll(".messages .msg")].map((m) => `${m.classList.contains("user") ? "USER" : "ASSISTANT"}${m.dataset.voice ? "(voice)" : ""}: ${m.textContent.trim().slice(0, 160)}`);
}, R).catch(() => null);
const screenshot = (name) => page.screenshot({ path: path.join(OUT, `${String(events.length).padStart(3, "0")}-${name}.png`) }).catch(() => {});

// ============ 1. sbl.so home: the dock/orb appears from the bundle ============
log("mark", { step: "goto sbl.so home" });
await page.goto("https://sbl.so/", { waitUntil: "load" });
await page.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
checks.dockOnHome = (await page.locator(`${R} .launcher`).count()) > 0;
checks.sblHealthHome = await health(page);
const sblvHome = await sblvCookie(page);
log("mark", { step: "home loaded", dock: checks.dockOnHome, sblHealth: checks.sblHealthHome, sblv: sblvHome });
checks.sblvGenerated = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(sblvHome || "");
checks.storeGetOnHome = events.some((e) => e.kind === "server" && e.path === "/store" && e.sblv === sblvHome);
await screenshot("home-dock");

// ============ 2. voice: connect once, one utterance answered (fake mic plays the WAV) ============
log("mark", { step: "voice connect" });
await page.locator(`${R} .voice`).first().evaluate((el) => el.click());
const utterAt = Date.now() + LEAD * 1000; // the WAV reaches the spoken part after LEAD seconds of silence
let voiceLines = 0, answered = null;
for (let i = 0; i < 70 && !answered; i++) {
  await sleep(1000);
  const s = await page.evaluate((root) => {
    const r = document.querySelector(root)?.shadowRoot;
    return {
      live: r?.querySelector(".voice")?.classList.contains("live") || false,
      state: r?.querySelector(".dock")?.dataset.state || null,
      lines: [...r?.querySelectorAll(".messages .msg.assistant[data-voice]") || []].map((m) => m.textContent.trim().slice(0, 160)),
    };
  }, R).catch(() => null);
  if (!s) break;
  if (s.live && !checks.voiceConnected) { checks.voiceConnected = true; log("mark", { step: "voice live" }); }
  if (s.lines.length > voiceLines) {
    const fresh = s.lines.slice(voiceLines);
    voiceLines = s.lines.length;
    for (const line of fresh) log("voice-line", { text: line });
    if (Date.now() >= utterAt && fresh.length) answered = fresh.at(-1);
  }
}
checks.utteranceAnswered = Boolean(answered);
checks.sessionHttp = (events.find((e) => e.kind === "server-status" && e.path === "/session") || {}).status || 0;
await sleep(8000); // let the spoken answer finish streaming and its 1.9s save-timer fire before any navigation
const homeTranscriptFull = await transcript(page);
log("mark", { step: "voice done", connected: checks.voiceConnected, answered, sessionStatus: checks.sessionHttp, homeTranscript: homeTranscriptFull });
await screenshot("voice");

// ============ 3. click through to pricing (full load): dock reappears, state survives ============
// Lines are compared by their text (replayed lines lose the voice marker): a pricing line counts as carried when its
// text equals or contains a home line's text, either direction (streaming may have grown a line's text).
const bare = (l) => l.replace(/^(USER|ASSISTANT)(\(voice\))?: /, "").trim();
const overlap = (a, b) => {
  const at = (a || []).map(bare).filter(Boolean), bt = (b || []).map(bare).filter(Boolean);
  return at.filter((x) => bt.some((y) => y === x || y.includes(x) || x.includes(y)));
};
log("mark", { step: "click to pricing" });
const beforeNav = rel();
if (RESTART) { // the server dies before the pricing page boots: its hydrate fails and must retry, not give up
  try { const pid = execSync("lsof -t -nP -iTCP:8787 -sTCP:LISTEN").toString().trim(); if (pid) execSync(`kill ${pid}`); log("mark", { step: "server killed", pid }); } catch (e) { log("warn", { kill: String(e).slice(0, 120) }); }
  for (let i = 0; i < 20; i++) { await sleep(250); try { execSync("lsof -t -nP -iTCP:8787 -sTCP:LISTEN"); } catch { break; } }
  log("mark", { step: "server down" });
}
const pricingLink = page.locator('a[href*="/pricing"]:visible').first();
const homeTranscript = await transcript(page);
if (await pricingLink.count()) await pricingLink.click();
else { log("mark", { step: "no pricing link found; direct goto" }); await page.goto("https://sbl.so/pricing/", { waitUntil: "load" }); }
await page.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
await sleep(4000); // loadState: the (failing, with --restart) hydrate attempt and the transcript replay from the cache
checks.dockOnPricing = (await page.locator(`${R} .launcher`).count()) > 0;
const sblvPricing = await sblvCookie(page);
checks.sameSblvOnPricing = sblvPricing === sblvHome;
if (RESTART) { // the server comes back while the pricing page is still retrying its hydrate
  const restartAt = rel();
  const out2 = fs.openSync(path.join(OUT, "server-restarted.log"), "a");
  const child = spawn("node", ["server.mjs"], { cwd: repo, env: { ...process.env, PORT: "8787" }, detached: true, stdio: ["ignore", out2, out2] });
  child.unref();
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(500); try { up = (await fetch("http://127.0.0.1:8787/health")).ok; } catch {} }
  log("mark", { step: "server restarted", up });
  // the bounded backoff (5 tries x 2s) or the next save's on-demand retry must land the hydrate and drain the queue
  for (let i = 0; i < 30; i++) {
    if (events.some((e) => e.kind === "server-status" && e.path === "/store" && e.status === 200 && e.sblv === sblvHome && e.t > restartAt)) break;
    await sleep(1000);
  }
  await sleep(3000);
  checks.hydrateAfterRestart = events.some((e) => e.kind === "server-status" && e.path === "/store" && e.status === 200 && e.sblv === sblvHome && e.t > restartAt);
  let blob = null;
  try { blob = JSON.parse(fs.readFileSync(path.join(repo, "var/store", `${sblvHome}.json`), "utf8")); } catch { /* no blob */ }
  const blobText = JSON.stringify(blob?.sbl_sales_concierge_memory_v1?.messages || []);
  const homeBare = (homeTranscript || []).map(bare).filter((t) => t.length > 12);
  checks.restartKeptState = homeBare.some((line) => blobText.includes(line.slice(0, 60)));
  log("mark", { step: "restart checked", hydrateAfterRestart: checks.hydrateAfterRestart, blobHasHomeLines: checks.restartKeptState });
}
const pricingTranscript = await transcript(page);
checks.storeGetOnPricing = events.some((e) => e.kind === "server" && e.path === "/store" && e.sblv === sblvHome && e.t > beforeNav);
const carried = overlap(homeTranscript, pricingTranscript);
checks.memorySurvivedPricing = carried.length > 0;
log("mark", { step: "pricing loaded", dock: checks.dockOnPricing, sblv: sblvPricing, carriedLines: carried.length, carried: carried.slice(0, 4), pricingTranscript });
await screenshot("pricing-dock");

// ============ 4. the sign-up link to the app domain: ?sblv rides along, state continues. STOPS HERE (no sign-up) ============
log("mark", { step: "click sign-up link to app.secondbrainlabs.com" });
const signupLink = page.locator('a[href*="app.secondbrainlabs.com"]:visible').first();
if (!(await signupLink.count())) { log("mark", { step: "no app link on pricing; trying home" }); await page.goto("https://sbl.so/", { waitUntil: "load" }); await sleep(3000); }
const link2 = page.locator('a[href*="app.secondbrainlabs.com"]:visible').first();
const beforeApp = rel();
const tabsBefore = ctx.pages().length;
await link2.first().click().catch(async (e) => { log("warn", { click: String(e).slice(0, 120) }); });
let app = null;
for (let i = 0; i < 20 && !app; i++) {
  await sleep(1000);
  app = ctx.pages().find((p) => /app\.secondbrainlabs\.com/.test(p.url())) || null;
}
if (!app) log("warn", { step: "the app page never opened" });
if (app) {
  if (!pages.includes(app)) { pages.push(app); app.on("pageerror", (e) => log("pageerror", { text: String(e).slice(0, 300) })); }
  await app.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
  await sleep(5000); // hydrate from the URL's sblv + transcript replay
  const url = new URL(app.url());
  checks.appLanded = true;
  // The decorated link carried ?sblv= (visible in the logged navigation); the app page adopts it and strips it from the
  // URL with history.replaceState at boot, so pasted links cannot rebind a later visitor.
  checks.handoffRodeAlong = events.some((e) => e.kind === "page" && /app\.secondbrainlabs\.com/.test(e.url || "") && new URL(e.url).searchParams.get("sblv") === sblvHome);
  checks.urlStripped = !url.searchParams.has("sblv");
  checks.dockOnApp = (await app.locator(`${R} .launcher`).count()) > 0;
  checks.sblHealthApp = await health(app);
  checks.storeGetOnApp = events.some((e) => e.kind === "server" && e.path === "/store" && e.sblv === sblvHome && e.t > beforeApp);
  const appTranscript = await transcript(app);
  const carriedApp = overlap(homeTranscript, appTranscript);
  checks.memoryContinuityOnApp = carriedApp.length > 0;
  log("mark", { step: "app loaded", url: app.url().slice(0, 120), handoffRodeAlong: checks.handoffRodeAlong, urlStripped: checks.urlStripped, dock: checks.dockOnApp, sblHealth: checks.sblHealthApp, carriedLines: carriedApp.length, carried: carriedApp.slice(0, 4), appTranscript });
  await app.screenshot({ path: path.join(OUT, "app-continuity.png") }).catch(() => {});
}
checks.confirmationCardsShown = confirmationCards.length; // Yes is never pressed by anyone here
checks.neverSubmitted = true; // the proof types nothing, fills nothing, submits nothing

// ============ wrap up ============
checks.ok = ["dockOnHome", "sblvGenerated", "voiceConnected", "utteranceAnswered", "dockOnPricing", "sameSblvOnPricing", "storeGetOnPricing", "memorySurvivedPricing", "appLanded", "handoffRodeAlong", "urlStripped", "dockOnApp", "storeGetOnApp", "memoryContinuityOnApp"]
  .every((k) => checks[k]);
if (RESTART) checks.ok = checks.ok && checks.hydrateAfterRestart && checks.restartKeptState;
const videos = pages.map((p, i) => ({ index: i + 1, handle: p.video() })); // handles before close
await browser.close();
for (const v of videos) {
  try { const from = v.handle && await v.handle.path(); if (from && fs.existsSync(from)) fs.renameSync(from, path.join(OUT, v.index === 1 ? "video.webm" : `video-${v.index}.webm`)); } catch (e) { log("warn", { video: String(e).slice(0, 120) }); }
}
const summary = { startedAt: new Date(t0).toISOString(), out: OUT, sblv: sblvHome, bundle: `${(fs.statSync(BUNDLE).size / 1024).toFixed(0)} KB`, checks, confirmationCards, voiceLines, endedAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ok: checks.ok, checks }, null, 1));
process.exit(checks.ok ? 0 : 1);