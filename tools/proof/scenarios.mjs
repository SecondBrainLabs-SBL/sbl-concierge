// Scenarios: scripted visitors, each a fresh browser context on the proof profile, recorded with video + event log.
// Usage: node tools/proof/scenarios.mjs --out <dir> [--only 7b] [--gap-sec 180]   (needs the local server: PORT=8787 node server.mjs)
// Measures only: never clicks an approval "Yes", never launches/creates anything, scenario 8 is read-only.
// State isolation: the extension's chrome.storage (Local Extension Settings folder) is deleted before each scenario's launch,
// except between the two halves of scenario 4, which share one context. Login is cookies, so it survives.
//
// ---------------------------------------------------------------------------------------------------------------
// OPTIONAL ACTION-LOG CONTRACT (a future build can implement either or both; the harness picks them up if present):
//   The build emits a DOM event named "sbl-agent-action" on document with a JSON STRING as detail (objects do not cross the isolated
//   world): { type: "say"|"point"|"click"|"navigate"|"scroll"|"fill"|"ask_user"|"confirmation"|"human-step"|"resume"|..., target: "<label>",
//   path: "<url path>", ts }. Never text, inputs, goals or customer notes: read those from the dock. It is emitted, and the dock's shadow
//   root is open, only when tools/proof/browser.mjs has set the extension's own storage flag sbl_proof (launch() does). window.__sblAgentActions
//   is not used (it cannot cross the world boundary).
//   Emit one entry per agent-initiated page action (scroll, cursor move/point, highlight, click, navigation, typing), at the
//   moment it starts. Without this contract the harness infers agent actions from DOM mutations (below), which is best-effort.
//
// HOW AGENT ACTIONS ARE INFERRED WITHOUT THE LOG:
//   - A MutationObserver injected into the page watches the cursor layer (#sbl-agent-cursor-layer shadow DOM: pointer, spotlight,
//     narration bubble) and the dock shadow DOM (assistant messages, invite bubble, "why" reason text, approval card).
//   - Visitor input is tagged in-page: any trusted wheel/key/touch/mousedown marks a 700 ms window; the harness can also set
//     window.__sblTag for its own non-wheel scrolls. Scroll segments (debounced 150 ms) are labelled by cause:
//     "visitor-input" | "harness-tag" | "no-visitor-input" (agent or page code) | "mixed". Only the last two count as agent scrolls.
//     Ceiling: an agent scroll that starts inside a 700 ms visitor-input window is labelled "mixed" or hidden.
// ---------------------------------------------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { launch, ROOT_ID } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg("--out") || path.join(here, "out/baseline-v2"));
const ONLY = arg("--only");
const GAP_SEC = +(arg("--gap-sec") || 180); // scenario 4: time away between visits
const R = `#${ROOT_ID}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const extId = [...createHash("sha256").update(repo).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
const clearExtensionStorage = () => fs.rmSync(path.join(repo, ".browser-profile/Default/Local Extension Settings", extId), { recursive: true, force: true });

// Redact anything secret-looking from a request body before logging; cap sizes.
const SECRET_KEY = /(api[_-]?key|token|secret|passw|authorization|cookie|bearer|credential)/i;
const SECRET_VAL = /^(sk-[\w-]{10,}|eyJ[\w-]{10,}\.[\w.-]*|Bearer\s+\S+|[A-Za-z0-9_+/=-]{40,})$/;
const redact = (v, k = "", d = 0) => {
  if (SECRET_KEY.test(k)) return "[redacted]";
  if (typeof v === "string") return SECRET_VAL.test(v.trim()) ? "[redacted]" : v.length > 300 ? v.slice(0, 300) + `...[+${v.length - 300}]` : v;
  if (Array.isArray(v)) return d > 6 ? "[deep]" : [...v.slice(0, 25).map((x) => redact(x, k, d + 1)), ...(v.length > 25 ? [`...[+${v.length - 25} items]`] : [])];
  if (v && typeof v === "object") return d > 6 ? "[deep]" : Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, redact(x, kk, d + 1)]));
  return v;
};

// In-page sampler (poll fallback for the dock; the injected observer is the primary source).
const sample = ([rootId]) => {
  const root = document.getElementById(rootId)?.shadowRoot;
  const q = (s) => root?.querySelector(s);
  const inv = q(".invite");
  const inp = q(".input-row input");
  return {
    ms: Date.now(), url: location.href, y: Math.round(scrollY),
    invite: inv?.classList.contains("show") ? (inv.querySelector(".invite-say")?.textContent || "").trim() : null,
    inviteWhy: inv?.classList.contains("show") ? (inv.querySelector(".why")?.textContent || "").trim() : "",
    panelWhy: (q(".panel .why")?.textContent || "").trim(),
    assistant: [...(root?.querySelectorAll(".msg.assistant") || [])].map((n) => n.textContent.trim()),
    user: [...(root?.querySelectorAll(".msg.user") || [])].map((n) => n.textContent.trim()),
    approval: q(".approval")?.classList.contains("show") ? (q(".approval .ask")?.textContent || "").trim() : null,
    panelOpen: !!q(".panel.open"), dockState: q(".dock")?.dataset.state || null,
    input: inp ? { value: inp.value, disabled: inp.disabled } : null,
  };
};

// Injected into every top-level document before page scripts. Reports through the __sblHarness binding.
const initPage = ({ rootId }) => {
  if (window.top !== window) return;
  const post = (k, d) => { try { window.__sblHarness?.({ k, ms: Date.now(), ...d }); } catch {} };
  const txt = (el) => ((el?.innerText || el?.getAttribute?.("aria-label") || el?.tagName || "") + "").trim().slice(0, 80);

  // visitor-input tagging + scroll cause
  let lastInput = -1e9, lastY = Math.round(scrollY), seg = null, segTimer = null;
  const now = () => performance.now();
  for (const t of ["wheel", "keydown", "touchmove", "mousedown"]) addEventListener(t, (e) => { if (e.isTrusted) lastInput = now(); }, { capture: true, passive: true });
  addEventListener("wheel", (e) => { if (e.isTrusted) post("wheel", { dy: Math.round(e.deltaY), y: Math.round(scrollY) }); }, { capture: true, passive: true });
  addEventListener("scroll", () => {
    const cause = now() < (window.__sblTag || 0) ? "harness-tag" : now() - lastInput < 700 ? "visitor-input" : "no-visitor-input";
    seg = seg || { from: lastY, causes: new Set() };
    seg.causes.add(cause);
    clearTimeout(segTimer);
    segTimer = setTimeout(() => {
      const to = Math.round(scrollY), c = [...seg.causes];
      if (to !== seg.from) post("scroll", { from: seg.from, to, cause: c.length === 1 ? c[0] : c.includes("no-visitor-input") ? "mixed" : c[0] });
      lastY = to; seg = null;
    }, 150);
  }, { capture: true, passive: true });
  addEventListener("click", (e) => { if (!e.isTrusted) post("click", { target: txt(e.target) }); }, true);
  // visitor pointer track (trailing throttle 700 ms)
  let pm = null, pt = null;
  addEventListener("mousemove", (e) => {
    if (!e.isTrusted) return;
    pm = e;
    if (!pt) pt = setTimeout(() => { pt = null; post("pointer", { x: Math.round(pm.clientX), y: Math.round(pm.clientY), over: txt(pm.target) }); }, 700);
  }, { capture: true, passive: true });

  // future-build action log contract
  let sentActs = 0;
  const onAct = (e) => { let d = e.detail; if (typeof d === "string") { try { d = JSON.parse(d); } catch {} } post("action", { entry: d, via: "event" }); };
  addEventListener("sbl-agent-action", onAct, true);
  setInterval(() => { const a = window.__sblAgentActions; if (Array.isArray(a)) while (sentActs < a.length) post("action", { entry: a[sentActs++], via: "array" }); }, 500);

  // cursor layer observer
  const curState = (cur) => {
    const ptr = cur.querySelector(".pointer"), spot = cur.querySelector(".spot"), say = cur.querySelector(".say");
    const pr = ptr?.getBoundingClientRect(), sr = spot?.getBoundingClientRect();
    const spotOn = !!(spot?.classList.contains("on") && sr && sr.width > 2);
    let target = null;
    if (spotOn) { const el = document.elementFromPoint(sr.x + sr.width / 2, sr.y + sr.height / 2); target = { text: txt(el), tag: el?.tagName, rect: [Math.round(sr.x), Math.round(sr.y), Math.round(sr.width), Math.round(sr.height)] }; }
    return { ptrOn: !!ptr?.classList.contains("on"), ptr: pr ? [Math.round(pr.x), Math.round(pr.y)] : null, spotOn, target, say: say?.classList.contains("on") ? say.textContent.trim() : "" };
  };
  let cs = { ptrOn: false, ptr: null, spotOn: false, tk: "", say: "" }, emitPtr = null, lastMove = 0;
  const emitCursor = (cur) => {
    const s = curState(cur), tk = s.target ? JSON.stringify(s.target) : "";
    if (s.ptrOn && !cs.ptrOn) { emitPtr = s.ptr; post("cursor-appears", { at: s.ptr }); }
    if (!s.ptrOn && cs.ptrOn) post("cursor-hides", {});
    if (s.ptrOn && emitPtr && s.ptr && Math.hypot(s.ptr[0] - emitPtr[0], s.ptr[1] - emitPtr[1]) > 8 && now() - lastMove > 250) { lastMove = now(); post("cursor-move", { from: emitPtr, to: s.ptr }); emitPtr = s.ptr; }
    if (s.say && s.say !== cs.say) post("narration", { text: s.say });
    if (tk && tk !== cs.tk) post("highlight", { target: s.target });
    if (!tk && cs.tk) post("highlight-off", {});
    cs = { ptrOn: s.ptrOn, ptr: s.ptr, spotOn: s.spotOn, tk, say: s.say };
  };
  // dock observer: every change to assistant messages / invite / why / approval, throttled 120 ms
  const dockSnap = (root) => {
    const q = (s) => root.querySelector(s), inv = q(".invite");
    return {
      url: location.href, ms: Date.now(),
      invite: inv?.classList.contains("show") ? (inv.querySelector(".invite-say")?.textContent || "").trim() : null,
      inviteWhy: inv?.classList.contains("show") ? (inv.querySelector(".why")?.textContent || "").trim() : "",
      panelWhy: (q(".panel .why")?.textContent || "").trim(),
      assistant: [...root.querySelectorAll(".msg.assistant")].map((n) => n.textContent.trim()),
      user: [...root.querySelectorAll(".msg.user")].map((n) => n.textContent.trim()),
      approval: q(".approval")?.classList.contains("show") ? (q(".approval .ask")?.textContent || "").trim() : null,
    };
  };
  const seen = new WeakSet();
  const mo = { attributes: true, childList: true, characterData: true, subtree: true };
  const attach = () => {
    const cur = document.getElementById("sbl-agent-cursor-layer")?.shadowRoot;
    if (cur && !seen.has(cur)) {
      seen.add(cur);
      new MutationObserver(() => emitCursor(cur)).observe(cur, mo);
      for (const t of ["transitionrun", "transitionend"]) cur.addEventListener(t, () => emitCursor(cur), true);
    }
    const dock = document.getElementById(rootId)?.shadowRoot;
    if (dock && !seen.has(dock)) {
      seen.add(dock);
      let tm = null;
      const flush = () => { tm = null; post("dock", { s: dockSnap(dock) }); };
      new MutationObserver(() => { if (!tm) tm = setTimeout(flush, 120); }).observe(dock, mo);
    }
  };
  new MutationObserver(attach).observe(document, { childList: true, subtree: true });
  attach();
};

async function runScenario(id, slug, title, body) {
  const dir = path.join(OUT, `${id}-${slug}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const run = { scenario: id, slug, title, startedAt: null, endedAt: null, isolation: "extension storage cleared before launch", visits: [1], visitorActions: [], visitorPointer: [], scrollEvents: [], utterances: [], agentActions: [], loadEvents: [], urlChanges: [], requests: [], consoleErrors: [], network: [], screenshots: [], notes: [], readActive: false, harnessError: null };
  const t0 = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const ts = () => iso(Date.now());
  const rel = (ms = Date.now()) => +((ms - t0) / 1000).toFixed(2);
  clearExtensionStorage();
  const ctx = await launch({ recordVideo: { dir, size: { width: 1440, height: 900 } } });
  for (const origin of ["https://sbl.so", "https://app.secondbrainlabs.com"]) await ctx.grantPermissions(["local-network-access"], { origin }).catch(() => {});
  const page = ctx.pages()[0] || (await ctx.newPage());
  run.startedAt = ts();

  let shotN = 0, visit = 1, sampleBusy = false, prev = null, lastDockMs = 0, lastDockUrl = null, lastInvite = null, inviteU = null;
  const shotByType = {};
  const asst = new Map(); // index -> { u, text }
  const shot = async (name) => {
    if (shotN >= 30) return;
    const f = `${String(++shotN).padStart(2, "0")}-${name}.png`;
    try { await page.screenshot({ path: path.join(dir, f) }); run.screenshots.push({ file: f, t: rel(), url: page.url() }); } catch {}
  };
  const act = (type, detail) => { if (type === "read-start") run.readActive = true; if (type === "read-end") run.readActive = false; run.visitorActions.push({ at: ts(), t: rel(), type, ...detail }); };
  const agent = (type, detail, ms = Date.now()) => {
    const a = { at: iso(ms), t: rel(ms), visit, type, ...detail };
    run.agentActions.push(a);
    if ((shotByType[type] = (shotByType[type] || 0) + 1) <= 2 && !["narration", "cursor-hides", "highlight-off"].includes(type)) shot(`agent-${type}`);
    return a;
  };
  const lastLoad = () => [...run.loadEvents].reverse().find((l) => l.url !== "about:blank");
  const speak = (kind, text, ms, extra = {}) => {
    const ll = lastLoad();
    const u = { at: iso(ms), t: rel(ms), visit, kind, text, versions: [{ t: rel(ms), text }], sinceLoad: ll ? +(rel(ms) - ll.t).toFixed(1) : null, ...(run.readActive ? { phase: "interrupted mid-read" } : {}), ...extra };
    run.utterances.push(u); shot(`agent-spoke-${kind.split(" ")[0]}`);
    return u;
  };
  const hasSent = () => run.visitorActions.some((a) => a.type === "type-send");

  // Everything a dock snapshot can tell us: every version of each agent message, the final text, and the reason text.
  const onDock = (s) => {
    if (s.ms < lastDockMs) return; lastDockMs = s.ms;
    if (lastDockUrl && lastDockUrl !== s.url) { asst.clear(); lastInvite = null; inviteU = null; }
    lastDockUrl = s.url;
    if (s.invite && s.invite !== lastInvite) { lastInvite = s.invite; inviteU = speak("proactive-bubble", s.invite, s.ms); }
    if (s.invite && inviteU && s.inviteWhy) inviteU.reason = s.inviteWhy;
    s.assistant.forEach((text, i) => {
      const cur = asst.get(i);
      if (!cur) {
        const isStatic = i === 0 && /^Hi\W+I can help design and build/.test(text) && !hasSent();
        let u = null;
        if (isStatic) run.notes.push(`t=${rel(s.ms)}s static panel greeting present (panel closed, not spoken): "${text.slice(0, 60)}"`);
        else u = speak(text === lastInvite ? "proactive (bubble opened)" : hasSent() ? "reply" : "unprompted-message", text, s.ms);
        asst.set(i, { u, text });
      } else if (cur.text !== text) {
        cur.text = text;
        if (cur.u) { cur.u.versions.push({ t: rel(s.ms), text }); cur.u.text = text; }
      }
    });
    const last = asst.get(s.assistant.length - 1);
    if (last?.u && s.panelWhy && last.u.reason !== s.panelWhy) { last.u.reason = s.panelWhy; (last.u.reasons ||= []).push({ t: rel(s.ms), why: s.panelWhy }); }
    if (s.approval && !prev?.approval) agent("approval-card", { text: s.approval }, s.ms);
    prev = { ...(prev || {}), ...s };
  };

  await ctx.exposeBinding("__sblHarness", (_src, ev) => {
    const { k, ms, ...d } = ev;
    if (k === "dock") return onDock(d.s);
    if (k === "wheel") return run.visitorActions.push({ at: iso(ms), t: rel(ms), type: "wheel", ...d });
    if (k === "pointer") return run.visitorPointer.push({ t: rel(ms), ...d });
    if (k === "scroll") { run.scrollEvents.push({ t: rel(ms), url: page.url(), ...d }); if (d.cause === "no-visitor-input" || d.cause === "mixed") agent("scroll", d, ms); return; }
    if (k === "click") return agent("click", d, ms);
    if (k === "action") return agent("build-action", { entry: d.entry, via: d.via }, ms);
    agent(k, d, ms); // cursor-appears, cursor-hides, cursor-move, narration, highlight, highlight-off
  });
  await ctx.addInitScript(initPage, { rootId: ROOT_ID });

  page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) run.urlChanges.push({ at: ts(), t: rel(), visit, url: fr.url() }); });
  page.on("load", () => run.loadEvents.push({ at: ts(), t: rel(), visit, url: page.url() })); // load event, not the navigate call
  const errFilter = (m) => m.type() === "error";
  page.on("console", (m) => { if (errFilter(m)) run.consoleErrors.push({ t: rel(), src: "console", text: m.text().slice(0, 300), url: m.location()?.url?.slice(0, 120) }); });
  page.on("pageerror", (e) => run.consoleErrors.push({ t: rel(), src: "pageerror", text: String(e.message).slice(0, 300) }));
  ctx.on("serviceworker", (w) => { run.notes.push(`service worker attached: ${w.url().slice(0, 80)}`); });
  const local = (u) => /^https?:\/\/(localhost|127\.0\.0\.1):8787/.test(u);
  // What the model actually received: the POST bodies the extension sends to the local server (redacted, capped).
  ctx.on("request", (r) => {
    if (!local(r.url()) || r.method() !== "POST") return;
    const raw = r.postData() || "";
    const e = { t: rel(), path: new URL(r.url()).pathname, bytes: Buffer.byteLength(raw) };
    try {
      const j = JSON.parse(raw);
      e.mode = j.mode; e.keyBytes = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v) ?? "")]));
      e.body = redact(j);
    } catch { e.body = "[unparseable]"; }
    run.requests.push(e);
  });
  ctx.on("response", async (r) => {
    if (!local(r.url())) return;
    const e = { t: rel(), path: new URL(r.url()).pathname, status: r.status() };
    if (e.path === "/respond") { try { const j = await r.json(); e.speak = j.speak ?? null; e.mode = j.mode; } catch {} }
    run.network.push(e);
  });
  ctx.on("requestfailed", (r) => { if (local(r.url())) run.network.push({ t: rel(), path: new URL(r.url()).pathname, status: "failed", error: r.failure()?.errorText }); });

  // 400 ms poll: fallback for the dock (the injected observer is the primary source), tolerant of mid-navigation.
  let polling = true;
  const poll = (async () => {
    while (polling) {
      await sleep(400);
      if (sampleBusy) continue;
      sampleBusy = true;
      try { onDock(await page.evaluate(sample, [ROOT_ID])); } catch { /* mid-navigation */ }
      sampleBusy = false;
    }
  })();

  // --- human-like primitives ---
  let mx = 700, my = 450;
  const moveTo = async (x, y, steps) => {
    const n = steps || Math.max(12, Math.round(Math.hypot(x - mx, y - my) / 12));
    const cx = (mx + x) / 2 + rnd(-40, 40), cy = (my + y) / 2 + rnd(-40, 40);
    for (let i = 1; i <= n; i++) {
      const t = i / n, e = t * t * (3 - 2 * t);
      await page.mouse.move((1 - e) ** 2 * mx + 2 * (1 - e) * e * cx + e * e * x, (1 - e) ** 2 * my + 2 * (1 - e) * e * cy + e * e * y);
      await sleep(rnd(8, 22));
    }
    mx = x; my = y;
  };
  const drift = async () => moveTo(Math.max(20, Math.min(1400, mx + rnd(-60, 60))), Math.max(20, Math.min(860, my + rnd(-40, 40))), 10);
  const wheel = async (dy) => { await page.mouse.wheel(0, dy); }; // logged in-page (trusted wheel event) with timestamp
  const tagged = async (fn, ms = 1500) => { await page.evaluate((m) => { window.__sblTag = performance.now() + m; }, ms).catch(() => {}); return fn(); };
  const goto = async (url, why) => {
    act("navigate", { url, why });
    await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch((e) => run.notes.push(`goto ${url}: ${String(e.message).slice(0, 100)}`));
  };
  const spoke = () => run.utterances.some((u) => u.visit === visit && !u.phase);
  // Idle with human micro-movement for up to maxMs; once the agent speaks, keep watching `tail` ms (default 30 s) so follow-ups show.
  const linger = async (maxMs, { tail = 30000, moves = true } = {}) => {
    const start = Date.now();
    let spokeAt = 0;
    while (Date.now() - start < maxMs) {
      if (!spokeAt && spoke()) { spokeAt = Date.now(); act("agent-spoke-observed", {}); }
      if (spokeAt && Date.now() - spokeAt > tail) break;
      if (moves) await drift();
      await sleep(rnd(2500, 4500));
    }
  };
  const settle = async (label, ms = 3000) => { await sleep(ms); await shot(`${label}-settled`); };
  const pageLoadT = () => lastLoad()?.t ?? rel();
  const openPanel = async () => {
    const l = await page.locator(`${R} .launcher`).boundingBox();
    if (!l) { run.notes.push("launcher not found"); return false; }
    await moveTo(l.x + l.width / 2, l.y + l.height / 2);
    await sleep(300);
    act("click", { target: "concierge launcher" });
    await page.mouse.click(mx, my);
    await sleep(1500);
    if (!(await page.locator(`${R} .panel.open`).count())) { await page.locator(`${R} .launcher`).click({ force: true }).catch(() => {}); await sleep(1200); }
    return !!(await page.locator(`${R} .panel.open`).count());
  };
  const typeAndSend = async (text, waitMs = 60000) => {
    const box = page.locator(`${R} .input-row input`);
    const b = await box.boundingBox().catch(() => null);
    if (!b) { act("type-failed", { text, reason: "input not found" }); return { sent: false }; }
    await moveTo(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.click(mx, my);
    await page.keyboard.press("Meta+a").catch(() => {});
    await page.keyboard.type(text, { delay: 75 });
    await sleep(500);
    await shot("typed");
    const asstBefore = asst.size, userBefore = prev?.user?.length || 0, netBefore = run.network.length;
    act("type-send", { text, via: "Enter" });
    await page.keyboard.press("Enter");
    await sleep(2000);
    let val = await box.inputValue().catch(() => "?");
    let via = "Enter";
    if (val) {
      run.notes.push(`Enter did not send: input still holds "${val.slice(0, 40)}"`);
      const s = await page.locator(`${R} .send`).boundingBox().catch(() => null);
      if (s) { await moveTo(s.x + s.width / 2, s.y + s.height / 2); act("click", { target: "Send button" }); await page.mouse.click(mx, my); via = "Send button"; }
      await sleep(2000);
      val = await box.inputValue().catch(() => "?");
      if (val) run.notes.push(`Send button did not send either: input still holds "${val.slice(0, 40)}"`);
    }
    const t = Date.now();
    while (Date.now() - t < waitMs && asst.size <= asstBefore) await sleep(700);
    await sleep(1500); // let a streaming reply finish so its versions are logged
    const result = { sent: !val, via, inputStillHas: val || "", replied: asst.size > asstBefore, userMsgShown: (prev?.user?.length || 0) > userBefore, requestsAfter: run.network.slice(netBefore).map((n) => `${n.path} ${n.status}`) };
    run.notes.push(`typed "${text}": ${JSON.stringify(result)}`);
    return result;
  };
  const priceCards = async () => page.evaluate(() => {
    const out = []; const seen = new Set();
    for (const el of document.querySelectorAll("*")) {
      if (el.children.length || !/^\$\d+/.test(el.textContent.trim())) continue;
      let c = el; while (c.parentElement && c.getBoundingClientRect().width < 260) c = c.parentElement;
      const r = c.getBoundingClientRect(); const k = Math.round(r.x / 40);
      if (seen.has(k) || r.width < 200) continue; seen.add(k);
      out.push({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height, label: el.textContent.trim().slice(0, 20) });
    }
    return out;
  });
  // Campaign cards on the dashboard grid: a repeated group (>= 3 siblings of one tag) whose members each show a state word.
  const campaignCards = async () => page.evaluate(() => {
    const STATE = /\b(running|created|draft|paused|completed|ended|archived|active|scheduled|stopped)\b/i;
    const groups = new Map();
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length > 1 || !STATE.test(el.textContent.trim()) || el.textContent.trim().length > 20) continue;
      for (let c = el, hops = 0; c.parentElement && hops < 8; c = c.parentElement, hops++) {
        const sibs = [...c.parentElement.children].filter((x) => x.tagName === c.tagName && STATE.test(x.textContent));
        const r = c.getBoundingClientRect();
        if (sibs.length >= 3 && r.width > 150 && r.height > 60 && r.width < 800) { groups.set(c.parentElement, sibs); break; }
      }
    }
    let best = [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
    // widen to every same-size child of the grid parent (a card whose state badge is nested differently still counts)
    if (best.length) best = [...best[0].parentElement.children].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 150 && r.height > 60 && r.width < 800; });
    return best.map((c) => {
      const state = (c.innerText.match(STATE) || [])[0] || null, lines = c.innerText.split("\n").map((s) => s.trim()).filter((l) => l && !STATE.test(l.length < 20 ? l : ""));
      return { name: lines[0]?.slice(0, 80), state, text: lines.slice(0, 8).join(" | ").slice(0, 200) };
    });
  });

  try {
    await body({ page, run, act, goto, moveTo, drift, wheel, tagged, linger, settle, shot, openPanel, typeAndSend, priceCards, campaignCards, sleep, rnd, rel, spoke, setVisit: (v) => { visit = v; if (!run.visits.includes(v)) run.visits.push(v); }, ctx, pageLoadT });
  } catch (e) {
    run.harnessError = String(e.stack || e).slice(0, 600);
  }
  await sleep(1500);
  await shot("end");
  polling = false; await poll;
  run.endedAt = ts();
  run.finalUrl = page.url();
  run.finalState = prev ? { url: prev.url, panelOpen: prev.panelOpen, dockState: prev.dockState, approval: prev.approval, assistantMessages: prev.assistant?.length, finalAssistantTexts: prev.assistant } : null;
  const video = page.video();
  await ctx.close();
  try { const vp = await video.path(); fs.renameSync(vp, path.join(dir, "video.webm")); } catch (e) { run.notes.push("video: " + e.message); }
  fs.writeFileSync(path.join(dir, "run.json"), JSON.stringify(run, null, 2));
  console.log(`scenario ${id} done${run.harnessError ? " (HARNESS ERROR: " + run.harnessError.split("\n")[0] + ")" : ""}; utterances=${run.utterances.length} agentActions=${run.agentActions.length}`);
  return run;
}

const S = "https://sbl.so";
// Loose CTA finder for 7b (hover only, never clicked).
const findCta = () => {
  const els = [...document.querySelectorAll("a,button")].filter((e) => /start|trial|try|sign ?up|get started|book|demo/i.test(e.innerText || ""));
  const vis = els.map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 20 && r.height > 10 && r.bottom > 0 && r.top < innerHeight);
  const p = vis[0]; return p ? { x: p.r.x + p.r.width / 2, y: p.r.y + p.r.height / 2, text: (p.e.innerText || "").trim().slice(0, 40) } : null;
};
const scenarios = [
  [1, "pricing-linger", "sbl.so pricing: hover two plans (before ~15 s after load), then idle, click nothing", async (c) => {
    await c.goto(`${S}/pricing/`, "load pricing"); c.run.loadT = c.pageLoadT();
    await c.sleep(1000);
    const cards = await c.priceCards();
    c.act("hover-phase-start", {});
    for (const card of cards.slice(0, 2)) {
      const sy = await c.page.evaluate(() => scrollY);
      await c.wheel(Math.max(0, card.y - 200 - sy)); await c.sleep(700);
      const sy2 = await c.page.evaluate(() => scrollY);
      c.act("hover-start", { target: `plan card ${card.label}` });
      await c.moveTo(card.x + card.w / 2 + c.rnd(-30, 30), card.y - sy2 + Math.min(card.h / 2, 150));
      await c.sleep(c.rnd(2800, 3400));
      c.act("hover-end", { target: `plan card ${card.label}` });
    }
    c.run.hoversDoneSecAfterLoad = +(c.rel() - c.pageLoadT()).toFixed(1);
    if (c.run.hoversDoneSecAfterLoad > 15) c.run.notes.push(`WARNING hovers finished ${c.run.hoversDoneSecAfterLoad}s after load (> 15 s)`);
    await c.linger(100000);
  }],
  [2, "home-fast-scroll", "sbl.so homepage: scroll fast to bottom and back up", async (c) => {
    await c.goto(`${S}/`, "load homepage"); c.run.loadT = c.pageLoadT(); await c.settle("home");
    await c.drift(); await c.sleep(1500);
    c.act("scroll-fast-down", {});
    for (let i = 0; i < 80; i++) { await c.wheel(520); await c.sleep(45); if (await c.page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 5)) break; }
    await c.sleep(900); await c.shot("bottom");
    c.act("scroll-fast-up", {});
    for (let i = 0; i < 80; i++) { await c.wheel(-520); await c.sleep(45); if (await c.page.evaluate(() => scrollY <= 5)) break; }
    await c.linger(90000);
  }],
  [3, "case-study-read", "open a success story on sbl.so and read it top to bottom (only lines after read-end are scored)", async (c) => {
    await c.goto(`${S}/case-study/`, "case study index"); c.run.loadT1 = c.pageLoadT(); await c.settle("case-index");
    const href = await c.page.evaluate(() => [...document.querySelectorAll('a[href*="/case-study/"]')].map((a) => a.href).find((h) => /case-study\/[^/]+\/?$/.test(h) && !/\/case-study\/?$/.test(h)));
    if (!href) throw new Error("no case study link found");
    const link = c.page.locator(`a[href="${href}"]`).first();
    await c.tagged(() => link.scrollIntoViewIfNeeded()); await c.sleep(800);
    const b = await link.boundingBox();
    await c.moveTo(b.x + b.width / 2, b.y + b.height / 2); await c.sleep(600);
    c.act("click", { target: `case study link ${href}` });
    c.setVisit(2); // visit 2 = the story page itself
    await Promise.all([c.page.waitForURL(/case-study\/.+/, { timeout: 30000, waitUntil: "load" }).catch(() => {}), c.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)]);
    c.run.loadT = c.pageLoadT(); await c.settle("story");
    c.act("read-start", {});
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      await c.wheel(c.rnd(90, 150)); await c.drift(); await c.sleep(c.rnd(1100, 1700));
      if (await c.page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 5)) break;
    }
    c.act("read-end", {});
    await c.linger(60000, { tail: 30000 }); // spoke() ignores lines flagged "interrupted mid-read"
  }],
  [4, "return-visit", `pricing, leave for ${GAP_SEC} s, load the homepage again in the same profile (gap: --gap-sec, default 180)`, async (c) => {
    c.run.gapSeconds = GAP_SEC;
    c.setVisit(1);
    await c.goto(`${S}/pricing/`, "first visit: pricing"); c.run.loadT1 = c.pageLoadT(); await c.settle("visit1-pricing");
    for (let i = 0; i < 4; i++) { await c.wheel(c.rnd(150, 300)); await c.drift(); await c.sleep(c.rnd(2500, 4000)); }
    await c.linger(45000, { tail: 30000 });
    c.act("leave", {});
    await c.goto("about:blank", "leave");
    c.act("away", { seconds: GAP_SEC }); await c.sleep(GAP_SEC * 1000);
    c.setVisit(2);
    await c.goto(`${S}/`, "second visit: homepage (same profile, storage kept)"); c.run.loadT = c.pageLoadT(); await c.settle("visit2-home");
    await c.linger(100000);
  }],
  [5, "expandi-question", "homepage, typed: How are you different from Expandi?", async (c) => {
    await c.goto(`${S}/`, "load homepage"); c.run.loadT = c.pageLoadT(); await c.settle("home");
    await c.drift(); await c.sleep(2500);
    const opened = await c.openPanel(); c.run.notes.push(`panel opened: ${opened}`);
    await c.shot("panel-open");
    await c.typeAndSend("How are you different from Expandi?", 60000);
    await c.linger(40000, { tail: 30000 });
  }],
  [6, "recommend-then-signup", "pricing: Recommend a plan for me, then Okay, sign me up.", async (c) => {
    await c.goto(`${S}/pricing/`, "load pricing"); c.run.loadT = c.pageLoadT(); await c.settle("pricing");
    await c.drift(); await c.sleep(2500);
    const opened = await c.openPanel(); c.run.notes.push(`panel opened: ${opened}`);
    await c.typeAndSend("Recommend a plan for me", 60000);
    await c.linger(8000, { tail: 1 });
    await c.typeAndSend("Okay, sign me up.", 60000);
    await c.linger(45000, { tail: 30000 }); // never click any approval Yes
  }],
  [7, "quiet-reader", "steady reading on one page for ~60 s, then leave (silence vs never speaking: compare 7b)", async (c) => {
    await c.goto(`${S}/faq/`, "load faq"); c.run.loadT = c.pageLoadT(); await c.settle("faq", 1500);
    const t0 = Date.now(); let dir = 1, flips = 0;
    c.act("read-start", {});
    while (Date.now() - t0 < 60000) {
      const atEnd = await c.page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 5);
      if (atEnd && dir > 0) { dir = -1; flips++; c.act("reading-reversed-at-bottom", {}); }
      await c.wheel(dir * c.rnd(70, 110)); await c.drift(); await c.sleep(c.rnd(1300, 1700));
    }
    c.run.readFlips = flips;
    c.act("read-end-leave", {});
    await c.goto("about:blank", "leave");
  }],
  ["7b", "quiet-reader-control", "control for 7: same faq page, visitor idles then hovers a CTA (never clicks); an agent line here is acceptable", async (c) => {
    await c.goto(`${S}/faq/`, "load faq"); c.run.loadT = c.pageLoadT(); await c.settle("faq", 1500);
    const t0 = Date.now();
    c.act("idle-start", {});
    while (Date.now() - t0 < 15000) { await c.drift(); await c.sleep(c.rnd(2500, 3500)); }
    const cta = await c.page.evaluate(findCta);
    if (cta) { c.act("hover-start", { target: `CTA "${cta.text}"` }); await c.moveTo(cta.x, cta.y); await c.sleep(4000); c.act("hover-end", { target: `CTA "${cta.text}"` }); }
    else c.run.notes.push("7b: no visible CTA found to hover");
    await c.linger(Math.max(5000, 60000 - (Date.now() - t0)), { tail: 30000 });
    c.act("leave", {});
  }],
  [8, "dashboard-campaigns", "logged-in dashboard: open the campaigns list and wait (read-only)", async (c) => {
    await c.goto("https://app.secondbrainlabs.com/campaigns", "open campaigns"); c.run.loadT = c.pageLoadT();
    await c.sleep(7000); await c.shot("campaigns-settled");
    const cards = await c.campaignCards();
    c.run.dashboard = { ...(await c.page.evaluate(() => ({ path: location.pathname, workspace: document.querySelector('button[aria-haspopup="dialog"]')?.innerText?.trim() || null, activeCompanyId: localStorage.getItem("activeCompanyId") }))), campaignCards: cards.length, cards, preconditionOk: cards.length >= 3 };
    if (cards.length < 3) throw new Error(`precondition failed: only ${cards.length} campaign cards found (need >= 3); scenario 8 is not valid`);
    if (arg("--ask")) { await c.openPanel(); await c.shot("panel-open"); await c.typeAndSend(arg("--ask"), 60000); await c.linger(45000, { tail: 30000 }); } // read-only: the question is typed, nothing is pressed
    else await c.linger(100000);
  }],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [id, slug, title, body] of scenarios) {
  if (ONLY && String(id) !== String(ONLY)) continue;
  await runScenario(id, slug, title, body);
}

// ---- summary (rebuilt from every run.json in OUT so --only reruns keep the table complete) ----
const runs = fs.readdirSync(OUT).filter((d) => /^\d+b?-/.test(d)).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
  .map((d) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, d, "run.json"), "utf8")); } catch { return null; } }).filter(Boolean);
const ms = (iso) => Date.parse(iso);
const q = (s, n = 140) => `"${String(s ?? "").replace(/\s+/g, " ").slice(0, n)}"`;
const BLOCKED = /\b(blocked|can't|cannot|won't|not allowed|requires explicit)\b/i; // "human" removed: matched "human handoff"
const REFUSAL = /\b(complete|finish|do|handle|fill|sign)\b[^.!?\n]{0,40}\b(yourself|on your own)\b|\b(i|we)(’m|'m| am)? (can't|cannot|can not|am not able|won't|am unable|not able|unable)\b|\byou(’ll|'ll| will) (need|have) to\b|\bplease (click|complete|go to|sign|fill)\b/i;
const rows = runs.map((r) => {
  const sid = String(r.scenario);
  const isOpener = (u) => u.kind !== "reply";
  const visits = r.visits?.length ? r.visits : [1];
  const openerLine = (u) => `${q(u.text)} (${u.kind}, ${u.sinceLoad}s after load${u.phase ? `, ${u.phase.toUpperCase()}: not scored` : ""}${u.versions?.length > 1 ? `, ${u.versions.length} versions` : ""}${u.reason ? `; reason shown: ${q(u.reason, 160)}` : ""})`;
  const openers = visits.map((v) => {
    const list = r.utterances.filter((u) => u.visit === v && isOpener(u));
    if (!list.length) return `v${v}: silent`;
    const scored = list.filter((u) => !u.phase)[0];
    return `v${v}: ${list.map(openerLine).join(" ; ")}${list.some((u) => u.phase) ? ` => scored: ${scored ? openerLine(scored) : "none after read-end"}` : ""}`;
  }).join(" || ");
  const replies = r.utterances.filter((u) => u.kind === "reply").map((u) => {
    const snd = [...r.visitorActions].reverse().find((a) => a.type === "type-send" && ms(a.at) <= ms(u.at));
    return `${snd ? `after ${q(snd.text, 40)} ` : ""}(${snd ? +((ms(u.at) - ms(snd.at)) / 1000).toFixed(1) : "?"}s) final ${q(u.text, 200)}${u.versions.length > 1 ? ` [${u.versions.length} versions logged]` : ""}${u.reason ? ` reason: ${q(u.reason, 100)}` : ""}`;
  }).join(" || ") || "n/a";
  const first = r.utterances[0];
  const moveTypes = new Set(["scroll", "highlight", "cursor-move", "click", "cursor-appears", "build-action"]);
  const moved = r.agentActions.filter((a) => moveTypes.has(a.type) && (!first || a.t >= first.t - 5));
  const pageMove = !r.utterances.length ? "n/a (agent never spoke)" : moved.length ? `y: ${[...new Set(moved.map((a) => a.type))].join(", ")}${moved.find((a) => a.target) ? " -> " + JSON.stringify(moved.find((a) => a.target).target).slice(0, 80) : ""}` : "n";
  const nb = (u) => !/^about:blank/.test(u);
  const pageUrls = new Set(r.urlChanges.filter((u) => nb(u.url)).map((u) => u.url));
  const visitorNavs = r.visitorActions.filter((a) => (a.type === "navigate" && nb(a.url)) || (a.type === "click" && /case study link/.test(a.target || ""))).length;
  const unexplained = Math.max(0, r.urlChanges.filter((u) => nb(u.url)).length - visitorNavs);
  const lastNavT = r.urlChanges.filter((u) => nb(u.url)).at(-1)?.t ?? 0;
  const after = r.agentActions.concat(r.utterances).filter((x) => x.t > lastNavT + 1 && ["proactive-bubble", "reply", "narration", "highlight", "scroll", "click", "build-action", "cursor-move"].includes(x.kind || x.type));
  const cont = pageUrls.size <= 1 ? "n/a (no page change other than the visitor leaving)" : ["3", "4"].includes(sid) ? `n/a for agent-caused change (visitor-driven navigation); agent activity after last page change: ${after.length}` : after.length ? "y" : "n";
  const finalHost = (() => { try { return new URL(r.finalUrl).hostname; } catch { return ""; } })();
  const texts = r.utterances.map((u) => u.text).concat(r.agentActions.filter((a) => a.type === "narration").map((a) => a.text || ""));
  const blocked = texts.filter((t) => BLOCKED.test(t)).map((t) => t.slice(0, 120));
  const sendT = r.visitorActions.filter((a) => a.type === "type-send" && /sign/i.test(a.text || "")).map((a) => ms(a.at))[0];
  const refusals = sendT ? r.utterances.filter((u) => ms(u.at) >= sendT && REFUSAL.test(u.text)).map((u) => q(u.text.match(REFUSAL)?.[0] ? u.text.slice(Math.max(0, u.text.search(REFUSAL) - 40), u.text.search(REFUSAL) + 100) : u.text, 140)) : [];
  const wrong = r.agentActions.filter((a) => a.type === "click").map((a) => `agent click on "${a.target}"`);
  const typed = r.notes.filter((n) => /did not send/.test(n));
  const netErr = r.network.filter((n) => n.status === "failed" || n.status >= 400).length;
  const scrolls = r.scrollEvents || [];
  const byCause = scrolls.reduce((m, s) => ((m[s.cause] = (m[s.cause] || 0) + 1), m), {});
  const respReq = (r.requests || []).filter((x) => x.path === "/respond");
  const obs = `visitor scroll segments by cause ${JSON.stringify(byCause)}; agent actions: ${r.agentActions.filter((a) => moveTypes.has(a.type)).length} (build action-log entries: ${r.agentActions.filter((a) => a.type === "build-action").length || "none, contract not exposed"}); /respond requests: ${respReq.length}${respReq.length ? ` (${respReq.map((x) => `${x.mode || "?"} ${x.bytes}B`).join(", ")})` : ""}; pointer samples ${(r.visitorPointer || []).length}`;
  const dash = r.dashboard ? `; campaign cards ${r.dashboard.campaignCards}${r.dashboard.preconditionOk ? "" : " PRECONDITION FAILED"}: ${(r.dashboard.cards || []).map((c) => `${c.name} [${c.state}]`).join(", ")}` : "";
  const completionFail = sid === "6" ? (refusals.length ? `y: agent refused/deflected the sign-up (${refusals.join(" ; ")})` : "no refusal phrase detected") : "n/a";
  return {
    scenario: sid, name: r.title,
    openers_per_visit: openers,
    replies_final_text: replies,
    page_moved_when_spoke: pageMove,
    continued_after_page_change: cont,
    signed_up_and_in_dashboard: sid === "8" ? "n/a (already logged in); dashboard reached: " + /secondbrainlabs/.test(finalHost) : `n (final url ${r.finalUrl}; approval card shown: ${r.agentActions.some((a) => a.type === "approval-card")}; agent-driven navigations: ${unexplained})`,
    completion_failure: completionFail,
    wrong_or_blocked_actions: [...blocked.map((b) => `agent said (keyword, verify): ${b}`), ...wrong, ...typed].join(" | ") || "none observed",
    harness_observations: obs + dash + (r.hoversDoneSecAfterLoad != null ? `; hovers done ${r.hoversDoneSecAfterLoad}s after load` : "") + (r.gapSeconds ? `; gap ${r.gapSeconds}s` : ""),
    errors: `${r.consoleErrors.length} console/page errors, ${netErr} failed localhost:8787 calls, localhost calls total ${r.network.length}${r.harnessError ? "; HARNESS ERROR " + r.harnessError.split("\n")[0] : ""}`,
  };
});
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(rows, null, 2));
const cell = (s) => String(s).replace(/\|/g, "/").replace(/\n/g, " ");
const cols = ["scenario", "openers_per_visit", "replies_final_text", "page_moved_when_spoke", "continued_after_page_change", "signed_up_and_in_dashboard", "completion_failure", "wrong_or_blocked_actions", "harness_observations", "errors"];
fs.writeFileSync(path.join(OUT, "summary.md"), `# Summary (baseline-v2 harness)\n\nFacts only; keyword flags need a judge's check. Generated ${new Date().toISOString()}.\n\n| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n${rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(" | ")} |`).join("\n")}\n`);
console.log("summary written to", OUT);
