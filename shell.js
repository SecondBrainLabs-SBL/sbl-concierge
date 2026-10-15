// shell.js — step 2: Talk turns an sbl.so page into the shell. Voice (the dock) lives in the top document;
// site pages change inside a same-origin frame; the URL bar and title follow the frame; browser Back moves
// the frame back through sbl.so history without leaving the shell (probed: tools/proof/nav-probe.mjs variant A —
// the top document survives a joint-session traversal, the frame restores by itself, one entry per move).
//
// Two sides, decided by the document this file lands in:
// - Top document: globalThis.SBLSHELL — content.js calls build() when voice connects, harness.js routes
//   agent navigations through go() so a page change never kills the shell (or the voice).
// - Inside #sbl-shell-frame: guest mode. No dock here (content.js stands down). This side installs the
//   link rules (sbl.so stays in the frame; app links hop top-level with ?sblv) and captures visitor
//   behavior, forwarding it to the host, which feeds the one behavior tracker (core/behavior.js shapes).
//
// The blank flash between pages (the prototype's confirmed defect) is covered by a snapshot overlay: a
// same-origin DOM clone of the current frame page (its own stylesheets ride along) shown until the next
// page's load fires. A canvas snapshot would need a rendering library the bundle does not have; a second
// (buffer) iframe was probed to pollute the joint history so browser Back restores the wrong page.
(function attachShell(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLSHELL = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createShellModule() {
  // ---- pure helpers (node-testable) ----
  // The stack key: no hash (an in-page anchor is not a move).
  function normalizeUrl(url) {
    try { const u = new URL(url, "https://x.invalid"); return u.origin + u.pathname + u.search; } catch { return null; }
  }
  // Where a loaded url lands in the stack: a known key reuses its entry (Back, Forward, a click to a visited
  // page); a new key is placed right after pos, dropping forward entries (a fresh click from history).
  function place(stack, pos, key) {
    const at = stack.findIndex((e) => e.key === key);
    if (at >= 0) return { stack, pos: at };
    return { stack: [...stack.slice(0, pos + 1), { key, url: key, title: "", scroll: 0 }], pos: pos + 1 };
  }

  // ---- browser wiring ----
  if (typeof window === "undefined" || typeof document === "undefined") {
    // node (tests): the pure helpers plus the host API's names; the browser wiring itself stands down.
    return { normalizeUrl, place, build, move, wire, go: (url) => move(url, "agent"), active: () => false };
  }
  let inFrame = false;
  try { inFrame = window.top !== window && window.frameElement?.id === "sbl-shell-frame"; } catch { inFrame = false; }
  if (inFrame) { guestSide(); return { normalizeUrl, place }; }
  if (window.top !== window) return { normalizeUrl, place }; // a foreign frame: nothing of ours runs here

  // ================= host side (the top document) =================

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = []; // in-page, proof-readable: every shell decision with its wall time
  const pushLog = (type, detail = {}) => {
    log.push({ t: Date.now(), type, ...detail });
    if (log.length > 400) log.splice(0, log.length - 400);
  };
  let tracker = null;
  let built = false;
  let frame = null;
  let overlay = null;
  let pos = -1;
  let stack = []; // [{ key, url, title, scroll }]
  let loadN = 0;
  const waiters = [];

  const frameWin = () => (frame?.isConnected ? frame.contentWindow : null);
  const frameLoc = () => { try { const w = frameWin(); return w ? w.location : null; } catch { return null; } };

  // The overlay container survives body.replaceChildren (it sits on documentElement, like the dock host).
  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement("div");
    overlay.id = "sbl-snap";
    overlay.setAttribute("aria-hidden", "true");
    // Above the frame (2147483000), below the dock host (2147483647). overflow:hidden + scrollTop restores
    // the captured scroll without a transform, so the page's own position:fixed parts stay pinned.
    // pointer-events:none: even a stale overlay (a load that never fired) can never eat a click.
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483001;background:#fff;overflow:hidden;visibility:hidden;pointer-events:none";
    document.documentElement.append(overlay);
    return overlay;
  }

  const styleKeys = new Set(); // stylesheets already carried over for the overlay's sake
  function carryStyles(doc) {
    if (!overlay) return;
    for (const el of doc.querySelectorAll('link[rel="stylesheet"][href], style')) {
      const key = el.tagName === "LINK" ? `link:${el.getAttribute("href")}` : `style:${(el.textContent || "").slice(0, 200)}`;
      if (styleKeys.has(key)) continue;
      styleKeys.add(key);
      try { document.head.append(el.cloneNode(true)); } catch { /* a node the top document refuses: the overlay renders without it */ }
    }
  }

  // A snapshot of the frame's current page (the old page stays visible while the next one loads).
  function snapshot() {
    try {
      const w = frameWin();
      const doc = w?.document;
      if (!doc || !doc.body) return false;
      ensureOverlay();
      carryStyles(doc);
      const body = doc.body.cloneNode(true);
      // Inert by construction: nothing here may execute, play or re-fetch an embed during the 1-2 s it is shown.
      body.querySelectorAll("script, iframe, frame, video, audio, embed, object").forEach((el) => el.remove());
      body.style.margin = "0"; // the page's own body margin rules already apply to a <body> clone in the top document
      overlay.replaceChildren(body);
      overlay.scrollTop = w.scrollY;
      return true;
    } catch { return false; }
  }

  function sync(stamp = false) {
    try {
      const w = frameWin();
      const l = w.location;
      const path = l.pathname + l.search + l.hash;
      if (stamp || location.pathname + location.search + location.hash !== path) {
        history.replaceState({ sblShell: 1, i: pos }, "", path); // the URL bar follows the frame; no extra entry
      }
      document.title = w.document.title;
    } catch { /* mid-hop to the app origin: the top document is leaving; nothing to sync */ }
  }

  function firstReveal(w) { // async: wipe the original page around the frame, restore the scroll the visitor had before Talk, then reveal — only once
    return (async () => {
      const y = buildScrollY;
      // The frame lives INSIDE the top body (it was put there at build, before its src was set, so it
      // loaded there directly and never reloads for this). The walker of the page-agent engine starts
      // at document.body: with the frame on documentElement it sees an empty page (step-3's
      // engine-frame check). The wipe keeps the frame and our cursor layer; everything else goes.
      const wipe = () => { for (const n of [...document.body.childNodes]) { if (n === frame || n.id === "sbl-agent-cursor-layer") continue; n.remove(); } };
      let tries = 0;
      for (;;) {
        try { w.scrollTo(0, y); } catch {}
        try { if (Math.round(w.scrollY) === y || tries++ > 8) break; } catch { break; }
        wipe();
        await sleep(180);
      }
      wipe();
      frame.style.visibility = "visible";
      document.documentElement.style.overflow = "hidden";
      pushLog("shell_ready", { msToReady: Date.now() - buildAt, iframeScrollAtReady: Math.round(w.scrollY), scrollYBefore: y, tries, historyLength: history.length });
    })();
  }

  function frameLoad() {
    try { overlay.style.visibility = "hidden"; } catch {} // the snapshot yields to the real page (restored: bb4e0a6 dropped it when firstReveal was factored out)
    const w = frameWin();
    let href = null;
    try { href = w?.location.href; } catch { return; }
    if (!href || href === "about:blank") return; // the frame sits in the body before its src is set: the about:blank load is not a page
    loadN++;
    if (!w) return;
    const n = loadN;
    const posBefore = pos;
    const key = normalizeUrl(href);
    if (n === 1) void firstReveal(w); // reveal only after the scroll restore has really taken (see firstReveal)
    if (key && stack.some((e) => e.key === key)) {
      pos = stack.findIndex((e) => e.key === key); // a traversal (Back/Forward) or a click to a visited page: same entry
      if (stack[pos].scroll) { try { w.scrollTo(0, stack[pos].scroll); } catch {} }
    } else if (key) {
      const placed = place(stack, pos, key);
      stack = placed.stack;
      pos = placed.pos;
    }
    try { stack[pos].title = w.document.title; } catch {}
    sync(true);
    try { w.postMessage({ sblShellCmd: "activate" }, location.origin); } catch {}
    setTimeout(() => { try { w.postMessage({ sblShellCmd: "activate" }, location.origin); } catch {} }, 400);
    pushLog("iframe_loaded", { n, url: href.slice(0, 120), pos, historyLength: history.length, returning: n > 1 && pos !== posBefore });
    const due = waiters.splice(0);
    due.forEach((r) => r());
  }

  let buildScrollY = 0;
  let buildAt = 0;

  // Talk calls this when voice connects on an sbl.so page: the page becomes the shell around the current URL.
  function build() {
    if (built) return true;
    if (location.hostname !== "sbl.so") return false; // the shell is the website only (HANDOFF Q5); the dashboard stays as is
    built = true;
    buildAt = Date.now();
    buildScrollY = Math.round(scrollY);
    const url = location.href;
    stack = [{ key: normalizeUrl(url), url, title: document.title, scroll: buildScrollY }];
    pos = 0;
    pushLog("shell_build", { scrollYBefore: buildScrollY, url: url.slice(0, 120), historyLength: history.length });
    frame = document.createElement("iframe");
    frame.id = "sbl-shell-frame";
    frame.title = document.title || "SBL";
    frame.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#fff;z-index:2147483000;visibility:hidden";
    // Into the top body FIRST, src after: the frame loads directly where the page-agent engine's
    // walker looks for it (document.body), so it never needs a re-insertion (which reloads it).
    // The about:blank load this produces before the src load is skipped in frameLoad.
    try { document.body.appendChild(frame); } catch { document.documentElement.append(frame); } // a body-less document: the walker has nothing anyway
    frame.src = url; // one load
    frame.onload = frameLoad;
    ensureOverlay();
    // URL/title sync and scroll capture for the stack, on the prototype's 500 ms tick.
    setInterval(() => {
      if (!built) return;
      try { const y = frameWin()?.scrollY; if (typeof y === "number" && stack[pos]) stack[pos].scroll = Math.round(y); } catch {}
      sync(false);
    }, 500);
    return true;
  }

  // A page change inside the shell: snapshot, then move the frame. Resolves when the new page's load fires.
  async function move(url, via) {
    if (!built || !frame) return false;
    const w = frameWin();
    let y = 0;
    try { y = Math.round(w.scrollY); } catch {}
    if (stack[pos]) stack[pos].scroll = y; // where the visitor left this page
    if (snapshot()) overlay.style.visibility = "visible"; // no blank flash while the next page loads
    pushLog("move_start", { url: String(url).slice(0, 120), scroll: y, via });
    const done = new Promise((r) => waiters.push(r));
    try { frame.src = url; } catch { overlay.style.visibility = "hidden"; return false; }
    const ok = await Promise.race([done.then(() => true), sleep(15000).then(() => false)]);
    if (!ok) overlay.style.visibility = "hidden"; // the load never fired: show the frame's real (stale) state, never a frozen snapshot
    pushLog("move_done", { url: String(url).slice(0, 120), ok });
    return ok;
  }

  addEventListener("popstate", () => {
    // The probe (variant A) showed frame restorations arrive WITHOUT a popstate; one here means the top
    // entry itself moved (e.g. Back below the shell's first entry) — the top document is about to be
    // replaced and the shell ends: the next sbl.so page boots the bundle normally (step-1 behavior).
    if (!built) return;
    pushLog("popstate", { href: location.href.slice(0, 120), i: history.state?.i });
  });

  // ---- behavior forwarding from the frame, into the one tracker content.js owns ----
  function wire({ tracker: t }) {
    tracker = t;
    addEventListener("message", (ev) => {
      if (ev.origin !== location.origin) return;
      const m = ev.data;
      if (!m || m.__sblShellEvent !== 1) return;
      if (frame && ev.source !== frame.contentWindow) return; // only the shell frame talks
      const { type, data } = m;
      if (type === "sbl_log") { pushLog(data?.type || "iframe_event", { ...(data || {}), via: "iframe" }); return; }
      if (!tracker) return;
      try {
        if (type === "pageview") tracker.pageview({ url: data.url, referrer: data.referrer || "", title: data.title || "", surface: "website" });
        else if (type === "expose") tracker.expose(data.kind || "section", data.label, Boolean(data.on));
        else if (type === "scroll") tracker.scroll(data.pct);
        else if (type === "click") tracker.click({ label: data.label, actor: data.actor || "user" });
        else if (type === "select") tracker.select(data.text || "", data.kind === "copy" ? "copy" : "select");
        else if (type === "activity") tracker.activity();
        else if (type === "visibility") tracker.visibility(Boolean(data.hidden));
      } catch { /* a malformed event must never break the page */ }
    });
  }

  // Proof/debug state, the prototype's __protoLog equivalent.
  globalThis.__sblShellState = () => ({
    built, pos, stack, frameUrl: frameLoc()?.href || null,
    historyLength: history.length, log: log.slice(-200),
  });

  return {
    normalizeUrl, place,
    build, move, wire,
    go: (url) => move(url, "agent"), // harness navigate: a page change that keeps the shell and the voice up
    active: () => Boolean(built && frame?.isConnected),
  };
});

// ================= guest side (inside #sbl-shell-frame) =================
// Runs only in the shell's frame (checked above). No dock here: the guest installs the link rules and
// captures what the visitor does on this page, forwarding it to the host document.
function guestSide() {
  const T = window.top;
  const send = (type, data = {}) => { try { T.postMessage({ __sblShellEvent: 1, type, data }, location.origin); } catch { /* the host is gone (unload): nothing to send to */ } };
  const ilog = (type, detail = {}) => send("sbl_log", { type, ...detail });

  // ---- link rules (the prototype's interceptor, inside the iframe) ----
  // An app-bound link is the step-1 hop: top-level, with the visitor id along (URL API only).
  // One helper, one guard: the trusted-press path and the click path both come here, and a hop
  // never happens twice (the document is leaving; a second assign is noise at best).
  let hopping = false;
  function hopFrom(a, rule) {
    if (hopping) return;
    hopping = true;
    let u; try { u = new URL(a.getAttribute("href"), location.href); } catch { hopping = false; return; }
    if (!/(^|\.)secondbrainlabs\.com$/.test(u.hostname)) { hopping = false; return; }
    try { u.searchParams.set("sblv", globalThis.SBLStore.sblv()); } catch { /* no id: hop as the link stands */ }
    ilog("hop_start", { href: u.href.slice(0, 120), rule });
    T.location.assign(u.href);
  }
  const appLink = (el) => {
    const a = el?.closest?.("a[href]");
    if (!a) return null;
    try { return /(^|\.)secondbrainlabs\.com$/.test(new URL(a.getAttribute("href"), location.href).hostname) ? a : null; }
    catch { return null; }
  };
  // The trusted-press path: sbl.so suppresses the click event on real presses (the site's own scripts
  // navigate from pointer events), so a click-only rule would never hop for a real visitor. Commit on
  // pointerup over the SAME link: a press that slides off is a cancel, not a hop (pointerdown alone
  // never commits — the user may still be holding the button).
  let pressLink = null;
  addEventListener("pointerdown", (ev) => {
    if (!ev.isTrusted) return;
    pressLink = appLink(ev.target);
  }, true);
  addEventListener("pointerup", (ev) => {
    if (!ev.isTrusted) return;
    const a = pressLink && ev.target && ev.target.closest?.("a[href]") === pressLink ? pressLink : null;
    pressLink = null;
    if (a) hopFrom(a, "app link, trusted press (pointerup on the same link) -> TOP-level with ?sblv");
  }, true);
  addEventListener("pointercancel", () => { pressLink = null; }, true);
  addEventListener("click", (ev) => {
    const a = ev.target?.closest?.("a[href]");
    if (!a) return;
    let u; try { u = new URL(a.getAttribute("href"), location.href); } catch { return; }
    if (u.hostname === "sbl.so") {
      // sbl.so links that would leave (new tab / top): kept inside the shell instead.
      if (["_blank", "_top", "_parent"].includes(a.target)) {
        ev.preventDefault();
        ilog("link_intercept", { href: u.href.slice(0, 120), rule: "sbl.so target=_blank -> opened inside the shell" });
        location.assign(u.href);
      }
      // else: a same-tab sbl.so link loads in this frame by default — a move like any other.
    } else if (/(^|\.)secondbrainlabs\.com$/.test(u.hostname)) {
      ev.preventDefault();
      hopFrom(a, "app link -> TOP-level navigation with ?sblv");
    } // else: an external link is left to the browser default (new tab / new page) — not ours to intercept.
  }, true);

  // ---- behavior capture, forwarded (core/behavior.js call shapes; the host's tracker does the record) ----
  const label = (el) => { try { return globalThis.SBLBehavior?.labelFor(el, "website") || ""; } catch { return ""; } };
  const pageview = () => send("pageview", { url: location.href, title: document.title, referrer: document.referrer });
  // Clicks: on sbl.so the site's own scripts suppress the click event (real pointer presses produce no
  // click anywhere — step 2's probes), so capture on pointerdown, which does fire; click is kept for
  // synthetic presses (the agent's) and for pages where the click survives.
  const clickForward = (ev) => {
    if (!ev.isTrusted) return;
    const el = ev.target?.closest?.("a, button, [role=button], [role=tab], summary");
    if (el) send("click", { label: label(el), actor: "user" });
  };
  document.addEventListener("pointerdown", clickForward, true);
  document.addEventListener("click", clickForward, true);
  // Sections in view (the same headings content.js tracks on a plain page).
  const tracked = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const l = tracked.get(en.target);
      if (l) send("expose", { kind: "section", label: l, on: en.isIntersecting && en.intersectionRatio >= 0.5 });
    }
  }, { threshold: [0, 0.5] });
  const scan = () => {
    for (const el of document.querySelectorAll("h1, h2, h3")) {
      if (tracked.has(el)) continue;
      const l = label(el);
      if (l) { tracked.set(el, l); io.observe(el); }
    }
  };
  scan();
  setInterval(scan, 3000);
  // Scroll depth.
  let lastPct = -1;
  addEventListener("scroll", () => {
    const pct = Math.max(0, Math.min(100, Math.round(((scrollY + innerHeight) / Math.max(document.documentElement.scrollHeight, 1)) * 100)));
    if (pct !== lastPct) { lastPct = pct; send("scroll", { pct }); }
  }, { passive: true });
  // Selecting and copying text (public marketing pages keep the words).
  let selTimer, lastSel = "";
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = getSelection();
      const text = String(sel || "").trim();
      if (text.length < 3 || text === lastSel || sel.anchorNode?.parentElement?.closest("input, textarea, [contenteditable]")) return;
      lastSel = text;
      send("select", { text });
    }, 900);
  });
  document.addEventListener("copy", () => { const text = String(getSelection() || "").trim(); if (text) send("select", { text, kind: "copy" }); });
  // Activity (throttled) and tab visibility: the host's tracker keeps its active/idle accounting true.
  let lastAct = 0;
  for (const type of ["mousemove", "keydown", "touchstart", "wheel"]) {
    addEventListener(type, (e) => {
      if (e.isTrusted && Date.now() - lastAct > 1000) { lastAct = Date.now(); send("activity"); }
    }, { passive: true, capture: true });
  }
  document.addEventListener("visibilitychange", () => send("visibility", { hidden: document.hidden }));

  // The host activates the frame it shows. The pageview waits for that: a hidden frame (a buffer restore,
  // or the first hidden load) never double-counts. The host re-sends after 400 ms in case this ran late.
  addEventListener("message", (ev) => {
    if (ev.origin !== location.origin || ev.source !== T) return;
    const m = ev.data || {};
    if (m.sblShellCmd === "activate") pageview();
  });
}
