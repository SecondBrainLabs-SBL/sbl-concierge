// Step-2 proof: the shell on sbl.so. Scripted visitor, no extension, fresh profile, bundle injected
// (step-1 pattern), mic + LNA granted, video + events recorded.
//   pricing@1200 -> Talk (real dock button) -> voice connects and the page becomes the shell ->
//   real clicks: pricing -> Success Stories -> investment-firm study -> Expandi comparison, all inside the
//   frame, one voice session, URL/title synced, no blank flash (video frame check) ->
//   scroll + outline a heading from the TOP document (same-origin control) ->
//   browser Back -> the frame goes back one page, still in shell, one entry per move ->
//   the sign-up link -> top-level hop to app.secondbrainlabs.com?sblv= -> voice reconnects with context.
// Start the server first: (set -a; source ../sbl-sales-agent/.env; set +a; unset EXTENSION_ID; PORT=8787 node server.mjs &)
// Usage: node tools/proof/shell-proof.mjs [--out tools/proof/out/step2/run-1]
// Hard limits honoured: never presses Yes on a confirmation card, never touches campaigns, LinkedIn or payment,
// and stops before the sign-up form is used: no account is created.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/step2/run-1"));
const R = "#sbl-sales-concierge-root";
const BUNDLE = path.join(repo, "sbl-agent.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(BUNDLE)) { console.error("sbl-agent.js is not built; run node tools/build-agent.mjs first."); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// One WAV: silence (connect + greeting), the utterance, silence. Chrome plays it once (%noloop).
const LEAD = 16, TAIL = 45;
const wav = path.join(OUT, "utterance.wav");
const piece = (name, text) => { const f = path.join(OUT, name); execSync(`say -o ${f} --data-format=LEI16@48000 ${JSON.stringify(text)}`); return f; };
const utterance = piece("utterance-src.wav", "What is S B L, in one sentence?");
const silence = (sec) => Buffer.alloc(48000 * 2 * sec);
const data = (f) => { const b = fs.readFileSync(f); return b.subarray(b.indexOf("data") + 8); };
const pcm = Buffer.concat([silence(LEAD), data(utterance), silence(TAIL)]);
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(48000, 24); head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(wav, Buffer.concat([head, pcm]));

const events = [];
const t0 = Date.now();
const videoT0 = t0; // the video's first frame is within ~1 frame of the context's creation
const rel = () => +((Date.now() - t0) / 1000).toFixed(1);
const log = (kind, detail) => { const e = { t: rel(), kind, ...detail }; events.push(e); fs.appendFileSync(path.join(OUT, "events.jsonl"), JSON.stringify(e) + "\n"); console.log(`[${String(rel()).padStart(6)}s] ${kind} ${JSON.stringify(detail).slice(0, 200)}`); };
const checks = {};
const confirmationCards = [];

const browser = await chromium.launch({
  headless: false,
  args: ["--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}%noloop`],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
await ctx.grantPermissions(["microphone", "local-network-access"]).catch(async () => {
  for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) {
    await ctx.grantPermissions(["microphone", "local-network-access"], { origin }).catch(() => {});
  }
});
await ctx.exposeBinding("__sblAct", (_s, detail) => {
  try { const e = JSON.parse(detail); if (e.type === "confirmation") confirmationCards.push({ t: rel(), target: e.target }); log("action", e); } catch { /* not ours */ }
});
await ctx.addInitScript(() => {
  const K = "sbl_store_v1"; if (!sessionStorage.getItem(K)) sessionStorage.setItem(K, JSON.stringify({ sbl_proof: 1 }));
  addEventListener("sbl-agent-action", (e) => window.__sblAct?.(typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)), true);
});
await ctx.addInitScript(fs.readFileSync(BUNDLE, "utf8"));

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
const transcript = (p) => p.evaluate((root) => {
  const s = document.querySelector(root)?.shadowRoot;
  if (!s) return null;
  return [...s.querySelectorAll(".messages .msg")].map((m) => `${m.classList.contains("user") ? "USER" : "ASSISTANT"}${m.dataset.voice ? "(voice)" : ""}: ${m.textContent.trim().slice(0, 200)}`);
}, R).catch(() => null);
const screenshot = (name) => page.screenshot({ path: path.join(OUT, `${String(events.length).padStart(3, "0")}-${name}.png`) }).catch(() => {});

// The in-page audio sampler (the prototype's): inbound audio level of THE voice peer connection, 10 Hz.
const startSampler = (p) => p.evaluate(() => {
  window.__samples = [];
  window.__gapBetween = (a, b) => {
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
    if (window.__samples.length > 6000) window.__samples.shift();
  }, 100);
});

// The shell's own in-page log/state (shell.js exposes it): polled by this script between steps.
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

// ============ 1. sbl.so/pricing, scroll to 1200, press Talk (real dock button), voice connects ============
log("mark", { step: "goto sbl.so/pricing" });
await page.goto("https://sbl.so/pricing/", { waitUntil: "load" });
await page.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
checks.dockOnPricing = (await page.locator(`${R} .launcher`).count()) > 0;
checks.sblHealthPricing = await health(page);
const sblv = await sblvCookie(page);
checks.sblvGenerated = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(sblv || "");
log("mark", { step: "pricing loaded", dock: checks.dockOnPricing, sblHealth: checks.sblHealthPricing, sblv });
await page.evaluate(() => window.scrollTo(0, 1200)); await sleep(1000); // pre-Talk only
const talkAt = rel();
// Step-1's proven press pattern: a synthetic click on the real dock button. A real (trusted) pointer click at
// the button is eaten on sbl.so pages (5/5 click-probes: mousedown+mouseup land, the click event never fires —
// pre-existing, also on the pre-shell build; flagged in implementation-notes). The Talk handler has no
// isTrusted gate, so the real connectLive path runs either way.
await page.locator(`${R} .voice`).first().evaluate((el) => el.click());
log("mark", { step: "Talk pressed" });

const utterAt = t0 + LEAD * 1000;
let voiceConnected = false, answered = null, voiceLines = 0;
const utteranceDeadline = utterAt + 75_000;
while (Date.now() < utteranceDeadline && (!voiceConnected || !answered)) {
  await sleep(1000);
  const s = await page.evaluate((root) => {
    const r = document.querySelector(root)?.shadowRoot;
    return {
      live: r?.querySelector(".voice")?.classList.contains("live") || false,
      lines: [...r?.querySelectorAll(".messages .msg.assistant[data-voice]") || []].map((m) => m.textContent.trim().slice(0, 200)),
      shell: window.__sblShellState?.() ? { built: window.__sblShellState().built, ready: window.__sblShellState().log.find((e) => e.type === "shell_ready") || null } : null,
    };
  }, R).catch(() => null);
  if (!s) break;
  if (s.live && !voiceConnected) { voiceConnected = true; log("mark", { step: "voice live" }); }
  if (s.shell?.built && !checks.shellBuilt) {
    const ready = s.shell.ready || {};
    if (ready.type !== "shell_ready") continue; // built but not revealed yet: keep polling for the real entry
    checks.shellBuilt = true;
    checks.revealAfterScrollRestore = ready.iframeScrollAtReady === 1200;
    checks.revealTries = ready.tries;
    log("mark", { step: "shell built", ready });
  }
  if (s.lines.length > voiceLines) {
    const fresh = s.lines.slice(voiceLines);
    voiceLines = s.lines.length;
    for (const line of fresh) log("voice-line", { text: line });
    if (Date.now() >= utterAt && fresh.length) answered = fresh.at(-1);
  }
}
checks.voiceConnected = voiceConnected;
checks.utteranceAnswered = Boolean(answered);
checks.sessionHttp = (events.find((e) => e.kind === "server-status" && e.path === "/session") || {}).status || 0;
await sleep(9000); // the spoken answer finishes and its 1.9 s save-timer fires
const shellTranscript = await transcript(page);
const shellLines = (shellTranscript || []).map((l) => l.replace(/^(USER|ASSISTANT)(\(voice\))?: /, "").trim()).filter((l) => l.length > 12);
log("mark", { step: "voice+shell ready", shellBuilt: checks.shellBuilt, revealOk: checks.revealAfterScrollRestore, answered, shellTranscript });
await screenshot("shell-pricing");
// The dock must still be the top document's (it floats above the shell frame).
checks.dockAboveShell = (await page.locator(`${R} .launcher`).count()) > 0;
// Voice identity, once, on the pricing document (the top document must never reload after this).
checks.pcSet = await page.evaluate(() => { const v = window.__sblVoiceStats?.(); if (!v?.pc) return false; window.__pc0 = v.pc; window.__bornAt = window.__docBornProbe = Date.now(); return true; }).catch(() => false);
await startSampler(page);

const SPEAK = [
  "Here is a longer thought while we move around the site together. Our platform helps agencies reach prospects on LinkedIn and WhatsApp, and every conversation stays in one place so nothing gets lost.",
  "Let me keep talking while we look at the next page. The campaigns are written from your own offer, replies come back into a single inbox, and you can step in whenever a lead is warm.",
  "I am still here as we move again. You can compare plans, read customer stories, or just ask me anything, and I will remember what you told me about your agency along the way.",
];

// ============ 2. three moves inside the frame: click, the agent's go() route, click ============
// m1/m3 are real clicks (the visitor's path); m2 is driven by the shell's own go()/move() — the
// agent-navigate route (harness navigate -> SBLSHELL.go). Runs 1-2 only exercised guest-side click
// moves; the go() path had zero video evidence, so run-3+ proves it here: overlay visible during
// the load, hidden after, frame interactive after (m3's real click moves it again).
const frameLoc = () => page.frameLocator("#sbl-shell-frame");
const STUDY = "https://sbl.so/case-study/cold-outreach-case-study-how-we-helped-an-investment-firm-build-high-intent-membership-demand-for-a-private-investment-club/";
const moves = [
  { name: "m1 pricing -> success-stories listing (real click)", how: "click", sel: 'a[href*="case-stud"]:visible', expect: /case-stud/ },
  { name: "m2 listing -> investment-firm study (agent route: SBLSHELL.go)", how: "go", url: STUDY, expect: /investment-firm/ },
  { name: "m3 study -> expandi comparison (real click)", how: "click", sel: 'a[href*="expandi"]:visible', expect: /expandi/ },
];
const moveResults = [];
let lastPos = 0;
let digestCheckedAt = 0; // after the moves, the digest must show the frame pages as the visitor's own
for (let i = 0; i < moves.length; i++) {
  const mv = moves[i];
  // A line is spoken right before the move, so the audio gap across the move is real (prototype's LONG lines).
  const spoke = await page.evaluate((text) => { window.__sblSay?.(text); return Boolean(window.__sblSay); }, SPEAK[i]).catch(() => false);
  await sleep(3500); // the line is audible by now
  const histBefore = await page.evaluate(() => history.length);
  const pcBefore = await page.evaluate(() => window.__sblVoiceStats?.() && { same: window.__sblVoiceStats().pc === window.__pc0, conn: window.__sblVoiceStats().pc.connectionState, dc: window.__sblVoiceStats().dcReady, paused: window.__sblVoiceStats().audio ? window.__sblVoiceStats().audio.paused : null }).catch(() => null);
  const startWall = Date.now();
  log("move_start", { move: mv.name, t_rel: rel(), how: mv.how });
  let clicked = false, goOk = false, overlay = null;
  if (mv.how === "click") {
    const link = frameLoc().locator(`${mv.sel}`).first();
    try { await link.waitFor({ state: "visible", timeout: 8000 }); await link.click({ timeout: 8000 }); clicked = true; } catch (e) { log("warn", { move: mv.name, click: String(e).split("\n")[0].slice(0, 140) }); }
    if (!clicked) { moveResults.push({ move: mv.name, clicked: false }); break; }
  } else {
    // go() is not awaited: move() shows the snapshot overlay synchronously, then loads. The overlay
    // state is sampled while pending (during) and again once move_done lands (after).
    await page.evaluate((u) => { window.__goP = globalThis.SBLSHELL.go(u); }, mv.url);
    overlay = { during: await page.evaluate(() => { const o = document.getElementById("sbl-snap"); return { vis: o?.style.visibility || null, hasContent: Boolean(o?.firstElementChild) }; }).catch(() => null) };
    const done = await waitForShell((x) => x.log.some((e) => e.type === "move_done"), 25_000, `move_done for ${mv.name}`);
    overlay.after = await page.evaluate(() => { const o = document.getElementById("sbl-snap"); return { vis: o?.style.visibility || null, hasContent: Boolean(o?.firstElementChild) }; }).catch(() => null);
    goOk = Boolean(done?.log.some((e) => e.type === "move_done" && e.ok));
    if (!goOk) { moveResults.push({ move: mv.name, goOk: false }); break; }
  }
  const s = await waitForShell((x) => x.log.some((e) => e.type === "iframe_loaded" && e.pos > lastPos), 25_000, `iframe_loaded for ${mv.name}`);
  const loadedWall = s?.log.filter((e) => e.type === "iframe_loaded").at(-1)?.t || null;
  await sleep(3000); // settle: sync, save timer, streaming
  const after = await shellState();
  const pcAfter = await page.evaluate(() => window.__sblVoiceStats?.() && { same: window.__sblVoiceStats().pc === window.__pc0, conn: window.__sblVoiceStats().pc.connectionState, dc: window.__sblVoiceStats().dcReady, paused: window.__sblVoiceStats().audio ? window.__sblVoiceStats().audio.paused : null }).catch(() => null);
  const frameHref = await page.evaluate(() => document.getElementById("sbl-shell-frame")?.contentWindow?.location.href || null).catch(() => null);
  const topHref = page.url();
  const topTitle = await page.title();
  const histAfter = await page.evaluate(() => history.length);
  // The gap is the prototype's: silence while the move is in flight (move start -> load +1.5 s).
  // Extending past the settle counts the line ENDING as a "gap", which is just speech being over.
  const gapEnd = Math.min(Date.now() - 500, (loadedWall || Date.now()) + 1500);
  const gap = await page.evaluate(([a, b]) => window.__gapBetween?.(a, b) ?? null, [startWall, gapEnd]).catch(() => null);
  const res = {
    move: mv.name, how: mv.how, clicked, goOk, overlay, spoke, loadMs: loadedWall ? loadedWall - startWall : null,
    pcSame: pcAfter?.same === true && pcBefore?.same === true, conn: pcAfter?.conn, dc: pcAfter?.dc, audioPaused: pcAfter?.paused,
    audioGapMs: gap, histDelta: histAfter - histBefore,
    urlSynced: Boolean(frameHref) && new URL(topHref).pathname + new URL(topHref).search === new URL(frameHref).pathname + new URL(frameHref).search,
    titleSynced: Boolean(topTitle) && topTitle === (after?.stack?.[after?.pos]?.title ?? topTitle),
    framePath: frameHref ? new URL(frameHref).pathname.slice(0, 70) : null, pos: after?.pos,
  };
  moveResults.push(res);
  const navigated = mv.how === "click" ? res.clicked : res.goOk;
  checks[`move${i + 1}Ok`] = navigated && res.pcSame && res.histDelta === 1 && res.urlSynced && mv.expect.test(res.framePath || "");
  if (res.audioGapMs != null) checks[`move${i + 1}Gap`] = res.audioGapMs <= 1000;
  if (mv.how === "go") { // the overlay contract on the agent route
    checks.move2OverlayDuring = overlay?.during?.vis === "visible" && overlay?.during?.hasContent === true;
    checks.move2OverlayAfter = overlay?.after?.vis === "hidden";
    log("overlay", { during: overlay?.during, after: overlay?.after });
  }
  lastPos = after?.pos ?? lastPos;
  log("move_result", res);
  await screenshot(`shell-${mv.name.split(" ")[0]}`);
  if (i === 0) digestCheckedAt = rel(); // the digest assert runs at the end, when the tracker's save timer has flushed
}
checks.moves = moveResults;
checks.frameInteractiveAfterGo = Boolean(checks.move3Ok); // the real click after the agent-route move moved the frame again
const histAtBuild = await page.evaluate(() => window.__sblShellState?.().log.find((e) => e.type === "shell_ready")?.historyLength || null).catch(() => null);
checks.oneEntryPerMove = moveResults.every((m) => m.histDelta === 1);
log("mark", { step: "moves done", histAtBuild, histNow: await page.evaluate(() => history.length) });

// ============ 3b. the brief's extra assert: a forwarded iframe-page event landed in the digest/behavior pipeline ============
// (checked after the moves, when the tracker's 1 s tick and save timer have flushed)
{
  const digest = await page.evaluate(() => window.__sblVisitorDigest?.() || []).catch(() => []);
  const opened = digest.filter((l) => /opened /.test(l) && (/case-study/.test(l) || /expandi/.test(l)));
  const clickedLine = digest.filter((l) => /clicked /.test(l));
  const scrolled = digest.filter((l) => /scrolled to \d+%/.test(l) && !/scrolled to 0%/.test(l));
  checks.digestGotIframeEvents = opened.length >= 2 && clickedLine.length > 0 && scrolled.length > 0;
  log("digest", { opened, clickedLine: clickedLine.slice(-3), scrolled: scrolled.slice(-2), totalLines: digest.length });
}

// ============ 3. scroll inside the shell and outline a heading from the TOP document ============
const outline = await page.evaluate(() => {
  const f = document.getElementById("sbl-shell-frame");
  const d = f?.contentDocument;
  if (!d) return null;
  d.defaultView.scrollTo(0, 1600);
  const heads = [...d.querySelectorAll("h1, h2, h3")].filter((h) => h.getClientRects().length && h.getBoundingClientRect().width > 0);
  const h = heads.find((x) => x.getBoundingClientRect().top > 0) || heads[0];
  if (!h) return { found: false };
  h.scrollIntoView({ block: "center", behavior: "instant" });
  h.style.outline = "5px solid #e11d48";
  h.style.outlineOffset = "6px";
  const r = h.getBoundingClientRect();
  return { found: true, text: h.textContent.trim().slice(0, 60), headingTopInViewport: Math.round(r.top), viewportH: d.defaultView.innerHeight, iframeScrollY: Math.round(d.defaultView.scrollY) };
}).catch((e) => ({ error: String(e).slice(0, 140) }));
await sleep(2500);
checks.sameOriginOutline = Boolean(outline?.found) && Math.abs((outline.headingTopInViewport || 9999) - (outline.viewportH || 0) / 2) < (outline.viewportH || 0) / 2 + 40;
log("mark", { step: "outline from top document", outline });
await screenshot("shell-outlined-heading");

// ============ 4. browser Back inside the shell: one page back, still in shell ============
const bornBefore = await page.evaluate(() => window.__docBornProbe || null);
const histBeforeBack = await page.evaluate(() => history.length);
const backAtWall = Date.now();
log("move_start", { move: "back", t_rel: rel() });
await page.goBack({ timeout: 15_000 }).catch((e) => log("warn", { back: String(e).split("\n")[0].slice(0, 140) }));
await waitForShell((x) => /investment-firm/.test(x.frameUrl || "") && x.pos === 2, 20_000, "back to the investment study");
await sleep(3500);
const afterBack = await shellState();
const bornAfter = await page.evaluate(() => window.__docBornProbe || null);
const histAfterBack = await page.evaluate(() => history.length);
const pcBack = await page.evaluate(() => window.__sblVoiceStats?.() && { same: window.__sblVoiceStats().pc === window.__pc0, conn: window.__sblVoiceStats().pc.connectionState, paused: window.__sblVoiceStats().audio ? window.__sblVoiceStats().audio.paused : null }).catch(() => null);
const frameAfterBack = await page.evaluate(() => document.getElementById("sbl-shell-frame")?.contentWindow?.location.href || null).catch(() => null);
checks.backInsideShell = Boolean(afterBack?.built) && Boolean(frameAfterBack) && /investment-firm/.test(frameAfterBack || "") && /investment-firm/.test(new URL(page.url()).pathname);
checks.backTopDocSurvived = bornAfter === bornBefore && bornBefore != null;
checks.backNoNewEntry = histAfterBack - histBeforeBack === 0;
checks.backVoiceStillSame = pcBack?.same === true && pcBack?.conn === "connected";
const backLoaded = afterBack?.log.filter((e) => e.type === "iframe_loaded").at(-1)?.t || null;
const backGap = await page.evaluate(([a, b]) => window.__gapBetween?.(a, b) ?? null, [backAtWall, Math.min(Date.now() - 500, (backLoaded || backAtWall) + 1500)]).catch(() => null);
checks.backAudioGap = backGap == null ? true : backGap <= 1000;
log("mark", { step: "back done", backUrl: page.url().slice(0, 110), frameUrl: (frameAfterBack || "").slice(0, 110), born: { before: bornBefore, after: bornAfter }, hist: { before: histBeforeBack, after: histAfterBack }, pc: pcBack, backGap, shellState: afterBack && { built: afterBack.built, pos: afterBack.pos, stack: afterBack.stack.map((e) => e.key.slice(-40)) } });
await screenshot("shell-after-back");

// ============ 5. the sign-up link: REAL PRESS -> top-level hop with ?sblv, voice reconnects with context ============
// Playwright mouse.down/up only — no locator.click, no synthetic el.click(). sbl.so suppresses the
// click event on real presses, so this pins the guest's pointerup commit: the trusted press alone
// must take the app-bound CTA top-level, decorated with sblv.
log("mark", { step: "real-press the sign-up CTA inside the frame" });
const appSel = 'a[href*="app.secondbrainlabs.com"]:visible'; // the nav CTA (Try For Free) qualifies
let hopPressed = false;
try {
  // Back returned mid-page; the sticky header CTA sits at the top of the frame. Scroll up, then pick
  // the first app-bound link whose box is actually inside the viewport (:visible alone matched an
  // off-viewport menu link in run-3 — a mouse press does not scroll the way locator.click does).
  await page.evaluate(() => document.getElementById("sbl-shell-frame")?.contentWindow?.scrollTo(0, 0)).catch(() => {});
  await sleep(900);
  const cta = frameLoc().locator(appSel);
  const n = await cta.count();
  let box = null;
  for (let i = 0; i < n && !box; i++) {
    const b = await cta.nth(i).boundingBox().catch(() => null);
    if (b && b.width > 4 && b.height > 4 && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 900) box = b;
  }
  if (!box) throw new Error(`no app CTA inside the viewport (of ${n} candidates)`);
  const px = box.x + box.width / 2, py = box.y + box.height / 2;
  await page.mouse.move(px, py); await sleep(150);
  await page.mouse.down(); await sleep(100); await page.mouse.up();
  hopPressed = true;
  log("hop_press", { at: [Math.round(px), Math.round(py)], realPress: true });
} catch (e) { log("warn", { hop: String(e).split("\n")[0].slice(0, 140) }); }
checks.hopClicked = hopPressed;
let app = null;
for (let i = 0; i < 25 && !app; i++) {
  await sleep(1000);
  app = ctx.pages().find((p) => /app\.secondbrainlabs\.com/.test(p.url())) || null;
}
checks.appLanded = Boolean(app);
if (app) {
  if (!pages.includes(app)) { pages.push(app); app.on("pageerror", (e) => log("pageerror", { text: String(e).slice(0, 300) })); }
  const hopNav = events.filter((e) => e.kind === "page" && /app\.secondbrainlabs\.com/.test(e.url || "")).at(0);
  const hopUrl = hopNav?.url || app.url();
  checks.handoffRodeAlong = /\?|&/.test(hopUrl) && new URL(hopUrl).searchParams.get("sblv") === sblv;
  log("mark", { step: "app hop", hopUrl: hopUrl.slice(0, 130), sblvRode: checks.handoffRodeAlong });
  const onApp = app === page ? page : app;
  await onApp.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
  await sleep(5000);
  checks.dockOnApp = (await onApp.locator(`${R} .launcher`).count()) > 0;
  checks.sblHealthApp = await health(onApp);
  checks.storeGetOnApp = events.some((e) => e.kind === "server" && e.path === "/store" && e.sblv === sblv && e.t > (hopNav?.t || 0));
  const appTranscript = await transcript(onApp);
  const bare = (l) => l.replace(/^(USER|ASSISTANT)(\(voice\))?: /, "").trim();
  const appBare = (appTranscript || []).map(bare).filter(Boolean);
  const carried = shellLines.filter((x) => appBare.some((y) => y === x || y.includes(x.slice(0, 60)) || x.includes(y.slice(0, 60))));
  checks.memoryCarriedToApp = carried.length >= 1;
  const u = new URL(onApp.url());
  checks.urlStripped = !u.searchParams.has("sblv");
  log("mark", { step: "app loaded", dock: checks.dockOnApp, sblHealth: checks.sblHealthApp, carriedLines: carried.length, carried: carried.slice(0, 3), appTranscript });
  await onApp.screenshot({ path: path.join(OUT, "app-continuity.png") }).catch(() => {});
  // Voice reconnects (the proof presses Talk — auto-reconnect is not built this step; measured, not hidden).
  const talkAppAt = Date.now();
  await onApp.locator(`${R} .voice`).first().evaluate((el) => el.click()).catch((e) => log("warn", { talkApp: String(e).split("\n")[0].slice(0, 120) }));
  await startSampler(onApp);
  let appLive = false, appLine = null, appLines = 0;
  for (let i = 0; i < 45 && (!appLive || !appLine); i++) {
    await sleep(1000);
    const s = await onApp.evaluate((root) => {
      const r = document.querySelector(root)?.shadowRoot;
      return { live: r?.querySelector(".voice")?.classList.contains("live") || false, lines: [...r?.querySelectorAll(".messages .msg.assistant[data-voice]") || []].map((m) => m.textContent.trim().slice(0, 200)) };
    }, R).catch(() => null);
    if (!s) break;
    if (s.live && !appLive) { appLive = true; log("mark", { step: "app voice live" }); }
    if (s.lines.length > appLines) { appLine = s.lines.at(-1); appLines = s.lines.length; log("voice-line", { text: appLine, onApp: true }); }
  }
  checks.voiceReconnectedOnApp = appLive;
  const firstAudio = await onApp.evaluate(() => window.__firstAudible?.() || null).catch(() => null);
  checks.firstAudioAfterTalkMs = firstAudio ? firstAudio - talkAppAt : null;
  checks.firstAudioAfterHopMs = firstAudio && hopNav ? firstAudio - (t0 + hopNav.t * 1000) : null;
  checks.continuationLine = Boolean(appLine);
  log("mark", { step: "app voice", firstAudioAfterTalkMs: checks.firstAudioAfterTalkMs, firstAudioAfterHopMs: checks.firstAudioAfterHopMs, line: appLine });
}
checks.confirmationCardsShown = confirmationCards.length;
checks.neverSubmitted = true; // the proof types nothing, fills nothing, submits nothing

// ============ wrap: video analysis (no fully-white viewport frame during a move), summary ============
const videoHandles = pages.map((p, i) => ({ index: i + 1, handle: p.video() }));
await ctx.close();
for (const v of videoHandles) {
  try { const from = v.handle && await v.handle.path(); if (from && fs.existsSync(from)) fs.renameSync(from, path.join(OUT, v.index === 1 ? "video.webm" : `video-${v.index}.webm`)); } catch (e) { log("warn", { video: String(e).slice(0, 120) }); }
}
// White-run analysis on the shell video: the top 560px (the dock sits lower), 10 fps, per-frame luma.
// White runs are reported with their video time; runs inside a move window fail the check.
const videoFile = path.join(OUT, "video.webm");
const moveWindows = [];
const talkMark = events.find((e) => e.kind === "mark" && e.step === "Talk pressed");
const builtMark = events.find((e) => e.kind === "mark" && e.step === "shell built");
if (talkMark && builtMark) moveWindows.push({ name: "build-reveal", a: talkMark.t - 1, b: builtMark.t + 3 });
for (const e of events) {
  if (e.kind === "move_start" && e.move && e.move !== "back") moveWindows.push({ name: e.move, a: e.t - 1.5, b: e.t + 14 });
  if (e.kind === "move_start" && e.move === "back") moveWindows.push({ name: "back", a: e.t - 1.5, b: e.t + 12 });
}
let whiteRuns = [];
if (fs.existsSync(videoFile)) {
  try {
    const raw = execSync(`ffmpeg -hide_banner -i ${JSON.stringify(videoFile)} -vf "fps=10,crop=520:600:0:0,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null`, { maxBuffer: 64 * 1024 * 1024 }).toString();
    const frames = [];
    let pt = null;
    for (const line of raw.split("\n")) {
      const m = line.match(/pts_time:([\d.]+)/);
      if (m) { pt = parseFloat(m[1]); continue; }
      const y = line.match(/YAVG=([\d.]+)/);
      if (y && pt != null) { frames.push({ t: pt, y: parseFloat(y[1]) }); pt = null; }
    }
    fs.writeFileSync(path.join(OUT, "luma-frames.json"), JSON.stringify(frames.map((f) => ({ t: +f.t.toFixed(1), y: +f.y.toFixed(1) }))));
    let run = null;
    for (const f of frames) {
      if (f.y > 250) { if (!run) run = { a: f.t, b: f.t, n: 0 }; run.b = f.t; run.n++; }
      else if (run) { whiteRuns.push(run); run = null; }
    }
    if (run) whiteRuns.push(run);
    whiteRuns = whiteRuns.filter((r) => r.n >= 5); // >= 0.5 s of near-white (the prototype's flash was 0.6-2.5 s)
    for (const r of whiteRuns) {
      r.duringMove = (moveWindows.find((w) => r.b > w.a && r.a < w.b) || {}).name || null;
    }
  } catch (e) { log("warn", { ffmpeg: String(e).slice(0, 160) }); }
}
checks.noWhiteFlashDuringMoves = whiteRuns.filter((r) => r.duringMove).length === 0;
log("white-runs", { whiteRuns: whiteRuns.map((r) => ({ a: +r.a.toFixed(1), b: +r.b.toFixed(1), n: r.n, duringMove: r.duringMove })), moveWindows: moveWindows.map((w) => ({ name: w.name, a: w.a, b: w.b })) });

checks.ok = ["dockOnPricing", "sblvGenerated", "voiceConnected", "utteranceAnswered", "shellBuilt", "revealAfterScrollRestore", "dockAboveShell", "pcSet",
  "move1Ok", "move2Ok", "move3Ok", "move2OverlayDuring", "move2OverlayAfter", "oneEntryPerMove", "digestGotIframeEvents", "sameOriginOutline",
  "backInsideShell", "backTopDocSurvived", "backNoNewEntry", "backVoiceStillSame",
  "hopClicked", "appLanded", "handoffRodeAlong", "dockOnApp", "storeGetOnApp", "memoryCarriedToApp", "urlStripped", "voiceReconnectedOnApp",
  "noWhiteFlashDuringMoves"]
  .every((k) => checks[k]);
const summary = { startedAt: new Date(t0).toISOString(), out: OUT, sblv, bundle: `${(fs.statSync(BUNDLE).size / 1024).toFixed(0)} KB`, checks, confirmationCards, moveResults, whiteRuns: whiteRuns.map((r) => ({ a: +r.a.toFixed(1), b: +r.b.toFixed(1), n: r.n, duringMove: r.duringMove })), endedAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ok: checks.ok, failed: Object.entries(checks).filter(([, v]) => v === false).map(([k]) => k) }, null, 1));
process.exit(checks.ok ? 0 : 1);
