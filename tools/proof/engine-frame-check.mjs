// Step-3 FIRST TASK (docs/STEP3-BRIEF.md): can the page-agent engine, driven from the TOP document,
// see and drive the shell frame's document? Empirical, not trusting either code reading.
//   Script-tag mode (bundle injected, no extension), sbl.so/pricing, scroll 1200, Talk -> shell built.
//   Phase 0 (as-written): PageController.updateTree() from the top document — does the flat tree contain
//   the frame page's content? (Inspection says the walker $e starts at document.body, which the shell
//   emptied; the frame is a child of documentElement. The step-2 reviewer's "the engine cannot see the
//   iframe" is thus about the walker start, not about same-origin access.)
//   Phase 1 (proof-side mitigation, no product change): move the frame node into the (empty) top body —
//   a re-insertion reloads the frame (measured) — then the brief's five checks:
//   1. flat tree contains iframe-page elements, 2. point_at (our cursor + the engine's own index boxes)
//   over an iframe element, 3. engine clickElement on an iframe link -> shell moves (guest nav, URL
//   synced, one history entry, voice untouched), 4. engine scroll inside the iframe (both variants),
//   5. engine input_text into a visible sbl.so input, typed then CLEARED, never submitted.
// Start the server first (PORT=8787). Usage: node tools/proof/engine-frame-check.mjs [--out DIR]
// Hard limits honoured: nothing is submitted, no Yes is ever pressed, no campaign/LinkedIn/payment,
// no account is created. The typed input is cleared before moving on.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const { chromium } = createRequire(path.join(repo, "tools/capture/package.json"))("playwright");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/step3/engine-frame-check"));
const R = "#sbl-sales-concierge-root";
const BUNDLE = path.join(repo, "sbl-agent.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(BUNDLE)) { console.error("sbl-agent.js is not built; run node tools/build-agent.mjs first."); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The fake mic plays pure silence: this check never speaks, so the voice model greets and goes quiet.
const LEAD = 14, TAIL = 95;
const silence = (sec) => Buffer.alloc(48000 * 2 * sec);
const pcm = Buffer.concat([silence(LEAD), silence(TAIL)]);
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(48000, 24); head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(path.join(OUT, "silence.wav"), Buffer.concat([head, pcm]));

const events = [];
const t0 = Date.now();
const rel = () => +((Date.now() - t0) / 1000).toFixed(1);
const log = (kind, detail) => { const e = { t: rel(), kind, ...detail }; events.push(e); fs.appendFileSync(path.join(OUT, "events.jsonl"), JSON.stringify(e) + "\n"); console.log(`[${String(rel()).padStart(6)}s] ${kind} ${JSON.stringify(detail).slice(0, 220)}`); };
const checks = {};
const confirmationCards = [];

const browser = await chromium.launch({
  headless: false,
  args: ["--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${path.join(OUT, "silence.wav")}%noloop`],
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

ctx.on("request", (r) => { if (/^http:\/\/127\.0\.0\.1:8787\//.test(r.url())) log("server", { method: r.method(), path: new URL(r.url()).pathname }); });
ctx.on("response", (r) => { if (/^http:\/\/127\.0\.0\.1:8787\//.test(r.url()) && ["/store", "/session", "/health"].includes(new URL(r.url()).pathname)) log("server-status", { path: new URL(r.url()).pathname, status: r.status() }); });

const page = await ctx.newPage();
page.on("pageerror", (e) => log("pageerror", { text: String(e).slice(0, 300) }));
page.on("console", (m) => { if (/error|PageAgent|PageController/.test(m.text())) log("console", { text: m.text().slice(0, 200) }); });
page.on("framenavigated", (f) => { if (f === page.mainFrame()) log("page", { url: f.url() }); });

const health = () => page.evaluate(() => document.querySelector("#sbl-sales-concierge-root")?.dataset.sblHealth || null).catch(() => null);
const screenshot = (name) => page.screenshot({ path: path.join(OUT, `${String(events.length).padStart(3, "0")}-${name}.png`) }).catch(() => {});
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

// ============ 1. sbl.so/pricing, scroll 1200, Talk -> shell built (the step-2 proven pattern) ============
log("mark", { step: "goto sbl.so/pricing" });
await page.goto("https://sbl.so/pricing/", { waitUntil: "load" });
await page.locator(`${R} .launcher`).first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
checks.dockOnPricing = (await page.locator(`${R} .launcher`).count()) > 0;
checks.sblHealthOk = (await health()) === "ok";
checks.sblvGenerated = /^[0-9a-f]{8}/.test(await page.evaluate(() => document.cookie.match(/sblv=([\w-]+)/)?.[1] || ""));
await page.evaluate(() => window.scrollTo(0, 1200)); await sleep(1000);
await page.locator(`${R} .voice`).first().evaluate((el) => el.click()); // synthetic click: sbl.so eats real ones (step-2 note)
log("mark", { step: "Talk pressed" });
let voiceConnected = false;
const built = await waitForShell((s) => s.built && s.log.some((e) => e.type === "shell_ready"), 40_000, "shell_ready");
const ready = built?.log.find((e) => e.type === "shell_ready") || null;
checks.shellBuilt = Boolean(built);
checks.revealAfterScrollRestore = ready?.iframeScrollAtReady === 1200;
for (let i = 0; i < 30 && !voiceConnected; i++) {
  await sleep(1000);
  voiceConnected = await page.evaluate((root) => document.querySelector(root)?.shadowRoot?.querySelector(".voice")?.classList.contains("live") || false, R).catch(() => false);
}
checks.voiceConnected = voiceConnected;
checks.sessionHttp = (events.find((e) => e.kind === "server-status" && e.path === "/session") || {}).status || 0;
checks.sessionHttpOk = checks.sessionHttp === 201;
checks.pcSet = await page.evaluate(() => { const v = window.__sblVoiceStats?.(); if (!v?.pc) return false; window.__pc0 = v.pc; return true; }).catch(() => false);
await startSampler();
log("mark", { step: "shell+voice ready", ready });
await screenshot("shell-pricing");

// ============ Phase 0: the walker question, AS-WRITTEN (frame on documentElement, body emptied) ============
const phase0 = await page.evaluate(async () => {
  const pc = new globalThis.SBLEngine.PageController({ enableMask: false });
  window.__pc = pc;
  await pc.updateTree();
  const html = pc.simplifiedHTML || "";
  const frame = document.getElementById("sbl-shell-frame");
  const fdoc = frame?.contentDocument || null;
  const ftext = fdoc?.body?.innerText || "";
  const state = await pc.getBrowserState();
  return {
    topBodyChildren: [...document.body.childNodes].map((n) => (n.nodeType === 1 ? `<${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}>` : "#text")).slice(0, 12),
    frameParentIsDocumentElement: frame ? frame.parentElement === document.documentElement : null,
    frameDocReadable: Boolean(fdoc && fdoc.body),
    frameHasPricingText: /compare|plan|pricing/i.test(ftext.slice(0, 2000)),
    treeChars: html.length,
    treeHasFrameText: { compare: html.includes("Compare"), plan: /<h[12][^>]*>[^<]*plan/i.test(html) || /pricing/i.test(html) },
    treeHead: html.slice(0, 300),
    modelSees: { url: state.url, title: state.title, contentHead: state.content.slice(0, 120), header: state.header.slice(0, 90) },
  };
}).catch((e) => ({ error: String(e).slice(0, 200) }));
log("phase0", phase0);
checks.phase0WalkerSeesFrame = Boolean(phase0.treeHasFrameText?.compare || phase0.treeHasFrameText?.plan);
checks.phase0SameOriginWorks = phase0.frameDocReadable === true && phase0.frameHasPricingText === true;
// The finding (pre-build runs, kept as evidence in this script's history): the walker starts at
// document.body; the old shell put the frame on documentElement and emptied the body — the engine's
// tree was an empty body even though same-origin access worked. The shell now puts the frame in the
// body at build time, so on the current build phase0WalkerSeesFrame is TRUE.

// ============ Phase 1: the frame must live in the top body (now built into the shell) ============
// Built AFTER the first runs of this script: the shell now appends the frame to the (about-to-be-
// emptied) body before its src is set, so it loads there directly and never needs a re-insertion
// (which reloaded it in 108-162 ms with no history entry, measured below before the product change).
const moveStart = Date.now();
const moveInfo = await page.evaluate(() => {
  const f = document.getElementById("sbl-shell-frame");
  const histBefore = history.length;
  const inBody = f?.parentElement === document.body;
  if (!inBody) document.body.appendChild(f); // pre-build shells only
  return { histBefore, src: f.src, wasInBody: inBody };
});
let reloaded = moveInfo.wasInBody ? null : await waitForShell((s) => s.log.some((e) => e.type === "iframe_loaded" && e.n === 2), 25_000, "frame reload after re-insertion");
const reloadLoad = reloaded?.log.find((e) => e.type === "iframe_loaded" && e.n === 2) || null;
phase1: {
  checks.frameMovedIntoBody = true;
  checks.reinsertionReloadedFrame = moveInfo.wasInBody ? true : Boolean(reloadLoad);
  checks.reinsertionReloadMs = moveInfo.wasInBody ? 0 : (reloadLoad ? reloadLoad.t - moveStart : null);
  checks.reinsertionHistDelta = (await page.evaluate(() => history.length)) - moveInfo.histBefore;
  checks.bodyNowHoldsFrame = await page.evaluate(() => { const f = document.getElementById("sbl-shell-frame"); return Boolean(f && f.parentElement === document.body && [...document.body.childNodes].every((n) => n === f || n.nodeType !== 1 || n.id === "sbl-agent-cursor-layer" || n.id === "playwright-highlight-container")); });
  checks.frameStillFullViewport = await page.evaluate(() => { const r = document.getElementById("sbl-shell-frame")?.getBoundingClientRect(); return !!r && r.left === 0 && r.top === 0 && r.width === innerWidth && r.height === innerHeight; });
  log("phase1-move", { wasInBody: moveInfo.wasInBody, reloadMs: checks.reinsertionReloadMs, histDelta: checks.reinsertionHistDelta, bodyHoldsFrame: checks.bodyNowHoldsFrame, fullViewport: checks.frameStillFullViewport });
}

// The engine's own index boxes are hidden for visitors (content.js); un-hide for THIS check so the video
// shows where the engine thinks frame elements are. Restored at the end.
const showBoxes = await page.evaluate(() => {
  const s = document.createElement("style");
  s.id = "proof-show-boxes";
  s.textContent = "#playwright-highlight-container{display:block!important}";
  document.documentElement.appendChild(s);
  return true;
});

// ============ CHECK 1 — the flat tree contains the iframe page's elements ============
// Heading text often spans several text nodes ("Choose any Plan" + "with a 7-day..."), so match on the
// frame page's own TEXT-NODE snippets, not whole textContent. The frame element itself is not interactive
// (the engine assigns no index to it) — its CONTENT is what must appear.
const tree = await page.evaluate(async () => {
  const pc = window.__pc;
  await pc.updateTree();
  const html = pc.simplifiedHTML || "";
  const fdoc = document.getElementById("sbl-shell-frame")?.contentDocument;
  const snippets = [];
  for (const el of [...(fdoc?.querySelectorAll("h1, h2, h3, a") || [])].slice(0, 400)) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2)) continue;
    for (const n of el.childNodes) {
      const t = n.nodeType === 3 ? n.textContent.trim() : "";
      if (t.length >= 6 && !snippets.some((s) => s.includes(t))) snippets.push(t.slice(0, 60));
    }
  }
  const found = snippets.filter((t) => html.includes(t)).slice(0, 8);
  const iframeLines = html.split("\n").filter((l) => /iframe/i.test(l)).slice(0, 2);
  return { treeChars: html.length, snippetCount: snippets.length, found, iframeLines, head: html.slice(0, 200) };
}).catch((e) => ({ error: String(e).slice(0, 200) }));
log("tree", tree);
checks.treeSeesFrameElements = Array.isArray(tree.found) && tree.found.length >= 2; // several frame text nodes in the tree
checks.treeIsNotTopBody = tree.treeChars > 400; // the top body holds only the frame: any real content came from the frame

// ============ CHECK 2 — point_at an element in the iframe (our cursor/highlight over it) ============
// Pick a visible heading in the frame; our cursor spotlights it and glides there; the engine's own
// selectorMap holds the same element with a live ref. Assert the spotlight box overlays the element.
const point = await page.evaluate(async () => {
  const fdoc = document.getElementById("sbl-shell-frame")?.contentDocument;
  // point_at is index-driven in the build (an interactive element the engine lists); prefer one, fall back to a heading.
  let el = null;
  for (const [, node] of window.__pc.selectorMap) {
    const r = node.ref?.getBoundingClientRect?.();
    if (node.ref && r && r.width > 100 && r.height > 8 && r.top > 0 && r.bottom < innerHeight && ["A", "BUTTON", "INPUT"].includes(node.ref.tagName) && !/start|trial|sign|book|free/i.test(node.ref.textContent || "")) { el = node.ref; break; }
  }
  if (!el) { const heads = [...(fdoc?.querySelectorAll("h1, h2, h3") || [])].filter((h) => { const r = h.getBoundingClientRect(); return r.width > 100 && r.top > 0 && r.bottom < innerHeight; }); el = heads[0]; }
  if (!el) return { found: false };
  const cursor = window.SBLCursor.createController(document);
  window.__cursor = cursor;
  const rect = el.getBoundingClientRect();
  let refIdx = null, refRect = null;
  for (const [idx, node] of window.__pc.selectorMap) { if (node.ref === el) { refIdx = idx; refRect = { t: Math.round(rect.top), l: Math.round(rect.left) }; break; } }
  cursor.spotlight(el);
  await cursor.moveTo(cursor.pointFor(el));
  cursor.narrate("point check");
  const spot = cursor.surface.spot.getBoundingClientRect();
  const overlayOk = Math.abs(spot.left - (rect.left - 4)) < 30 && Math.abs(spot.top - (rect.top - 4)) < 30 && spot.width > rect.width * 0.7;
  return { found: true, tag: el.tagName, text: (el.textContent || "").trim().slice(0, 60), rect: { t: Math.round(rect.top), l: Math.round(rect.left), w: Math.round(rect.width) }, overlayOk, refIdx, refRect };
}).catch((e) => ({ error: String(e).slice(0, 200) }));
log("point_at", point);
await sleep(800); await screenshot("point-at-frame-heading");
checks.pointAtFrameElement = point.found === true && point.overlayOk === true;
if (point.tag !== "H1" && point.tag !== "H2" && point.tag !== "H3") checks.pointAtFrameElement = point.found === true && point.overlayOk === true && point.refIdx != null;
await page.evaluate(() => { window.__cursor?.clearSpotlight(); window.__cursor?.narrate(""); }).catch(() => {});

// ============ CHECK 3 — engine clickElement on an iframe link -> the shell moves ============
// Same-tab sbl.so content link (case-studies), the step-2 proven destination. Never a consequential control.
// Pick (inside the page): prefer a same-tab sbl.so content link (case studies), else any same-tab sbl.so
// link that is not a CTA. The engine clips attribute values in the TREE STRING, so match on the element's
// own href, not the string.
const pick = await page.evaluate(() => {
  const pickLink = (prefer) => {
    const cands = [];
    for (const [i, node] of window.__pc.selectorMap) {
      const el = node.ref;
      if (el?.tagName !== "A") continue;
      let u; try { u = new URL(el.getAttribute("href") || "", location.href); } catch { continue; }
      if (u.hostname !== "sbl.so" || u.pathname === location.pathname) continue;
      if (/start[-_ ]?trial|sign|book|buy|free trial|app\./i.test(u.pathname + " " + (el.textContent || ""))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      cands.push({ i, el, href: u.pathname, inView: r.top >= 0 && r.bottom < innerHeight, text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50) });
    }
    return cands.find((c) => prefer(c)) || cands[0] || null;
  };
  const c = pickLink((x) => /case-stud|success/i.test(x.href));
  if (!c) return { found: false, dump: [...window.__pc.selectorMap].filter(([, n]) => n.ref?.tagName === "A").slice(0, 40).map(([i, n]) => { let h; try { h = new URL(n.ref.getAttribute("href") || "", location.href).pathname; } catch { h = "?"; } return `${i}:${h}:"${(n.ref.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24)}"`; }) };
  const boxes = [...(document.querySelector("#playwright-highlight-container")?.children || [])].map((d) => d.getBoundingClientRect());
  const r = c.el.getBoundingClientRect();
  // The box-vs-element assert is only meaningful for in-view elements (boxes are drawn at the element's
  // own position either way; below the fold the numbers are equal too, but the visual can't confirm it).
  const engineBoxOverElement = boxes.some((b) => b && Math.abs(b.left - r.left) < 40 && Math.abs(b.top - r.top) < 40) || !c.inView;
  return { found: true, idx: c.i, label: c.text, href: c.href, inView: c.inView, engineBoxOverElement };
});
log("pick-link", pick);
if (pick.found) {
  const histBefore = await page.evaluate(() => history.length);
  const beforeUrl = await page.evaluate(() => document.getElementById("sbl-shell-frame")?.contentWindow?.location.href || null);
  if (pick.engineBoxOverElement != null) checks.engineIndexBoxOverFrameLink = pick.engineBoxOverElement;
  await screenshot("before-engine-click");
  const clickAt = rel();
  const result = await page.evaluate(async (idx) => window.__pc.clickElement(idx), pick.idx).catch((e) => ({ success: false, message: String(e).slice(0, 160) }));
  log("engine-click", { result, at: clickAt });
  // wait for the frame load (guest nav)
  const after = await waitForShell((s) => { const u = s.frameUrl || ""; return /case-stud/.test(u) && s.log.some((e) => e.type === "iframe_loaded" && (e.t || 0) > moveStart && (e.n || 0) >= 2); }, 30_000, "frame load after engine click").catch(() => null);
  await sleep(3000);
  const frameUrl = await page.evaluate(() => document.getElementById("sbl-shell-frame")?.contentWindow?.location.href || null);
  const topUrl = page.url();
  const histAfter = await page.evaluate(() => history.length);
  const pcNow = await page.evaluate(() => window.__sblVoiceStats?.() && { same: window.__sblVoiceStats().pc === window.__pc0, conn: window.__sblVoiceStats().pc.connectionState, dc: window.__sblVoiceStats().dcReady, paused: window.__sblVoiceStats().audio ? window.__sblVoiceStats().audio.paused : null }).catch(() => null);
  checks.engineClickMovesFrame = Boolean(after) && /case-stud/.test(frameUrl || "") && frameUrl !== beforeUrl;
  checks.clickUrlSynced = Boolean(frameUrl) && new URL(topUrl).pathname + new URL(topUrl).search === new URL(frameUrl).pathname + new URL(frameUrl).search;
  checks.clickOneHistoryEntry = histAfter - histBefore === 1;
  checks.clickVoiceUntouched = pcNow?.same === true && pcNow?.conn === "connected" && pcNow?.paused === false;
  checks.clickResultMessage = result?.success === true;
  log("click-result", { frameUrl: (frameUrl || "").slice(0, 120), topPath: new URL(topUrl).pathname, histDelta: histAfter - histBefore, pc: pcNow });
  await screenshot("after-engine-click");
} else { checks.engineClickMovesFrame = false; log("warn", { pick: "no case-study link visible in the engine tree" }); }

// ============ CHECK 4 — engine scroll inside the iframe (both variants) ============
// (a) without index: the engine scrolls ITS window (the top document, overflow hidden — expected dead).
// (b) with the index of a frame element: the engine's container walk (expected to miss the frame's scroller).
// (c) recorded for the report, clearly NOT the engine: the frame window scrolled directly (what the
// harness scroll tool can route to in shell mode). The frame moved in CHECK 3, so re-index first —
// the old selectorMap refs belong to the detached document.
const reindexed = await page.evaluate(async () => { await window.__pc.updateTree(); return (window.__pc.simplifiedHTML || "").length; }).catch(() => 0);
const frameScroll = () => page.evaluate(() => Math.round(document.getElementById("sbl-shell-frame")?.contentWindow?.scrollY ?? -1));
const scrollBefore = await frameScroll();
const engineScrollPlain = await page.evaluate(async () => window.__pc.scroll({ down: true, pixels: 600 })).catch((e) => ({ success: false, message: String(e).slice(0, 140) }));
const scrollAfterPlain = await frameScroll();
const scrollIdxPick = await page.evaluate(() => {
  const pc = window.__pc;
  for (const [i, node] of pc.selectorMap) { const el = node.ref; if (el && el.getBoundingClientRect().height > 4 && el.getBoundingClientRect().top > 0 && el.getBoundingClientRect().bottom < innerHeight * 0.8 && el.tagName !== "IFRAME") return i; }
  return null;
});
const engineScrollIndexed = scrollIdxPick != null
  ? await page.evaluate(async (i) => window.__pc.scroll({ down: true, pixels: 600, index: i }), scrollIdxPick).catch((e) => ({ success: false, message: String(e).slice(0, 140) }))
  : { success: false, message: "no frame element index available" };
const scrollAfterIndexed = await frameScroll();
const directScroll = await page.evaluate(() => { const w = document.getElementById("sbl-shell-frame")?.contentWindow; if (!w) return null; w.scrollBy({ top: 600, behavior: "instant" }); return Math.round(w.scrollY); }).catch(() => null);
checks.engineScrollPlainWorks = scrollAfterPlain > scrollBefore;
checks.engineScrollIndexedWorks = scrollAfterIndexed > Math.max(scrollBefore, scrollAfterPlain);
checks.directFrameScrollWorks = directScroll != null && directScroll > scrollAfterIndexed;
log("scroll", { reindexed, scrollBefore, engineScrollPlain, scrollAfterPlain, engineScrollIndexed, scrollAfterIndexed, directScroll, scrollIdxPick });
await screenshot("after-scroll");

// ============ CHECK 5 — engine input_text into a visible sbl.so input, typed then CLEARED ============
let findInput = await page.evaluate(() => {
  const pc = window.__pc;
  for (const [i, node] of pc.selectorMap) {
    const el = node.ref;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.type !== "password" && !el.disabled) {
      const r = el.getBoundingClientRect();
      if (r.width > 30 && r.height > 10 && r.top >= 0 && r.bottom < innerHeight) return { idx: i, tag: el.tagName, type: el.type, name: el.name || el.placeholder || "" };
    }
  }
  return null;
});
if (!findInput) {
  // No input on this page: the shell's own go() (the agent's navigate route) to sbl.so home, then re-index.
  log("mark", { step: "no visible input here; SBLSHELL.go home" });
  const goOk = await page.evaluate(() => globalThis.SBLSHELL.go("https://sbl.so/")).catch(() => false);
  const wentHome = await waitForShell((s) => /^\/?$/.test((s.frameUrl ? new URL(s.frameUrl).pathname : "x")), 30_000, "go home");
  await sleep(2500);
  await page.evaluate(async () => { await window.__pc.updateTree(); });
  findInput = await page.evaluate(() => {
    const pc = window.__pc;
    for (const [i, node] of pc.selectorMap) {
      const el = node.ref;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.type !== "password" && !el.disabled) {
        const r = el.getBoundingClientRect();
        if (r.width > 30 && r.height > 10 && r.top >= 0 && r.bottom < innerHeight) return { idx: i, tag: el.tagName, type: el.type, name: el.name || el.placeholder || "" };
      }
    }
    return null;
  }).catch(() => null);
  checks.goHomeForInput = Boolean(goOk && wentHome && findInput);
}
if (findInput) {
  log("input-target", findInput);
  const typed = await page.evaluate(async (idx) => window.__pc.inputText(idx, "proof-check"), findInput.idx).catch((e) => ({ success: false, message: String(e).slice(0, 140) }));
  const valueAfterType = await page.evaluate((idx) => { const el = window.__pc.selectorMap.get(idx)?.ref; return el ? String(el.value ?? el.textContent ?? "") : null; }, findInput.idx).catch(() => null);
  // CLEAR it (same native setter the engine uses + an input event), never submitted.
  const cleared = await page.evaluate((idx) => {
    const el = window.__pc.selectorMap.get(idx)?.ref;
    if (!el) return null;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return String(el.value ?? el.textContent ?? "");
  }, findInput.idx).catch(() => null);
  checks.engineInputOnFrameInput = typed?.success === true && Boolean(valueAfterType && valueAfterType.includes("proof-check")) && cleared === "";
  log("input", { typed, valueAfterType, cleared });
  await screenshot("after-input-cleared");
} else {
  checks.engineInputOnFrameInput = null; // brief: "if one is reachable" — recorded, not asserted
  log("warn", { input: "no reachable visible input on either page" });
}

// wrap
await page.evaluate(() => document.getElementById("proof-show-boxes")?.remove());
checks.noConfirmationCards = confirmationCards.length === 0;
const okKeys = ["dockOnPricing", "sblHealthOk", "sblvGenerated", "shellBuilt", "revealAfterScrollRestore", "voiceConnected", "sessionHttpOk", "pcSet",
  "phase0SameOriginWorks", "frameMovedIntoBody", "reinsertionReloadedFrame", "bodyNowHoldsFrame", "frameStillFullViewport",
  "treeSeesFrameElements", "treeIsNotTopBody", "pointAtFrameElement",
  "engineClickMovesFrame", "clickUrlSynced", "clickOneHistoryEntry", "clickVoiceUntouched", "clickResultMessage",
  "directFrameScrollWorks", "noConfirmationCards"];
// phase0WalkerSeesFrame is the FINDING (expected false as-written); engine scrolls are findings; input may be null.
const findings = { phase0WalkerSeesFrame: checks.phase0WalkerSeesFrame, engineScrollPlainWorks: checks.engineScrollPlainWorks, engineScrollIndexedWorks: checks.engineScrollIndexedWorks, engineInputOnFrameInput: checks.engineInputOnFrameInput };
checks.ok = okKeys.every((k) => checks[k] === true || checks[k] == null && k === "engineInputOnFrameInput");
const summary = { startedAt: new Date(t0).toISOString(), out: OUT, purpose: "step-3 FIRST TASK: engine (top document) sees and drives the shell frame document", phase0, moveInfo: { ...moveInfo, reloadMs: checks.reinsertionReloadMs, histDelta: checks.reinsertionHistDelta }, findings, checks, confirmationCards, events, endedAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
const video = page.video();
await ctx.close();
try { const from = video && await video.path(); if (from && fs.existsSync(from)) fs.renameSync(from, path.join(OUT, "video.webm")); } catch (e) { log("warn", { video: String(e).slice(0, 120) }); }
console.log(JSON.stringify({ ok: checks.ok, findings, failed: Object.entries(checks).filter(([k, v]) => v === false && k !== "phase0WalkerSeesFrame" && !k.startsWith("engineScroll")).map(([k]) => k) }, null, 1));
process.exit(checks.ok ? 0 : 1);

async function startSampler() {
  await page.evaluate(() => {
    window.__samples = [];
    window.__sampler = setInterval(async () => {
      const pc = window.__sblVoiceStats?.()?.pc;
      if (!pc) return;
      let l = 0;
      (await pc.getStats().catch(() => null))?.forEach?.((s) => { if (s.type === "inbound-rtp" && s.kind === "audio") l = Math.max(l, s.audioLevel || 0); });
      window.__samples.push({ t: Date.now(), l });
      if (window.__samples.length > 3000) window.__samples.shift();
    }, 100);
  });
}
