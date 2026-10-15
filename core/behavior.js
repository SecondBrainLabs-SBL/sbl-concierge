// The brain's eyes: what the visitor did, in order. Pure logic: the extension feeds it events; digest() turns them into a
// short, factual, timestamped account in plain language. No labels, no scores, no inference: a model reads the digest.
//
// Privacy: only short labels are stored (headings, aria-labels, button text, and on public marketing pages a few words the
// visitor pointed at or selected). No keystrokes, no input values. URLs are stored without their query string (utm and ?tab= kept).
//
// Time and storage are injected so this runs in node: createTracker({ now, load, save, onMoment }).
(function attachBehavior(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLBehavior = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBehaviorModule() {
  const SESSION_GAP = 30 * 60 * 1000; // a return after this long is a new visit
  const ACTIVE_WINDOW = 30 * 1000; // active = visible and interacted within this
  const LABEL_MAX = 60;
  const SAVE_EVERY = 5000;
  const EVENT_KEEP = 150;
  // Capture plumbing: what counts as an event worth recording or reporting as a moment. Not decisions about the visitor.
  const READ_MIN = 1000; // shorter in-view spans are scrolling past, not recorded
  const SECTION_DONE = 4000; // leaving a section after this long is a "section finished" moment
  const PAUSE = 6000; // no input this long after real reading is a "pause" moment
  const SUSTAINED = 15000; // "real reading": this much active time on the page

  // Public marketing pages hold no personal text, so there any ordinary label is fine; the dashboard keeps a strict UI vocabulary.
  const VOCAB = /^(a|an|the|to|for|your|my|our|us|now|get|sign|up|log|in|it|works|how|learn|more|with|and|see|all|case|studies|started|book|try|start|contact|free|talk|schedule|request|join|pricing|plans?|billing|campaigns?|leads?|inbox|settings|personas?|analytics|dashboard|home|help|docs?|support|features|faq|about|blog|new|create|back|next|continue|save|cancel|close|menu|search|filter|active|paused|draft|drafts|archived|completed)$/i;
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
  const safe = (value, surface) => {
    const s = clean(value);
    if (/@|https?:|www\./i.test(s)) return "";
    if (surface === "website") return s;
    const ok = s && (s.match(/\d/g) || []).length <= 2 && s.split(" ").length <= 4 && s.split(" ").every((w) => VOCAB.test(w));
    return ok ? s : "";
  };
  const quote = (text) => { const s = String(text || "").replace(/\s+/g, " ").trim().slice(0, 100); return /@|https?:|www\./i.test(s) ? "" : s; };

  // The one place a label is derived from an element. Text is read only from real controls and headings; anything holding
  // an input, textarea or editable area (a chat composer, a form row) yields nothing.
  function labelFor(el, surface) {
    const tag = String(el.tagName || "").toLowerCase();
    const attr = (name) => (el.getAttribute && el.getAttribute(name)) || "";
    if (el.isContentEditable || (el.closest && el.closest("[contenteditable]")) || (el.querySelector && el.querySelector("[contenteditable],input,textarea"))) return "";
    const text = /^(a|button|summary|h[1-3])$/.test(tag) || /^(button|tab|menuitem|option)$/.test(attr("role")) ? el.innerText : "";
    return safe(attr("aria-label") || attr("title") || (/^(input|textarea|select)$/.test(tag) ? "" : text), surface);
  }

  function referrerInfo(referrer) {
    try { const url = new URL(referrer); return { referrer: url.origin + url.pathname, name: url.hostname }; } catch { return { referrer: null, name: "" }; }
  }

  const secs = (ms) => Math.max(1, Math.round(ms / 1000));
  const clock = (ms) => `${Math.floor(Math.max(0, ms) / 60000)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, "0")}`;
  const ago = (ms) => (ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60000))} min` : ms < 86_400_000 ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / 86_400_000)} day(s)`);
  const pathOf = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url || ""; } };

  function fresh() {
    return { visits: { count: 0, prevAt: null }, lastSeenAt: null, startedAt: null, past: [], entry: null, pages: [], events: [], activeMs: 0, hiddenMs: 0 };
  }

  // What the visitor did, as plain lines. Facts only, oldest first, each with its minute:second into the visit.
  function digest(state, { now = Date.now(), looking = [], resting = null, hidden = false, idleMs = 0 } = {}) {
    const t0 = state.startedAt || now;
    const at = (t) => clock(t - t0);
    const out = [];
    const v = state.visits || { count: 1 };
    const back = (state.events || []).filter((x) => x.k === "return").at(-1); // reloaded the site after being away within the same visit
    out.push((v.count > 1 ? `visit number ${v.count}; the previous visit was ${ago(now - v.prevAt)} ago` : "first visit") + (back ? `; they left and came back ${ago(now - back.t)} ago after ${secs(back.ms)} s away, so everything below up to then is from before they left` : ""));
    for (const p of (state.past || []).slice(-2)) out.push(`earlier visit (${ago(now - p.at)} ago): viewed ${p.pages.map((x) => `"${x}"`).join(", ") || "nothing recorded"}${p.read.length ? `; read longest ${p.read.map((x) => `"${x}"`).join(", ")}` : ""}`);
    const e = state.entry;
    if (e) out.push(`arrived ${e.referrer ? `from ${e.name} (${e.referrer})` : "directly"} on "${e.landingTitle || e.landingPage}" (${e.landingPage})${Object.keys(e.utm || {}).length ? `, ${Object.entries(e.utm).map(([k, x]) => `${k}=${x}`).join(" ")}` : ""}`);
    for (const p of (state.pages || []).slice(-8)) out.push(`${at(p.at)} opened "${p.title || p.url}" (${pathOf(p.url)}); ${secs(p.dwellMs)} s there, ${secs(p.activeMs)} s of it active, scrolled to ${p.scroll}%`);

    // One line per distinct thing, placed where it first happened, with its count and total time.
    const groups = new Map();
    for (const ev of state.events || []) {
      const key = [ev.k, ev.label || ev.text || "", ev.page].join("|");
      const g = groups.get(key) || groups.set(key, { ...ev, n: 0, ms: 0 }).get(key);
      g.n++; g.ms += ev.ms || 0;
    }
    const lines = [];
    for (const g of groups.values()) {
      const x = g.n > 1 ? ` (${g.n} times)` : "";
      const plural = g.n > 1 ? "s" : "";
      const what = {
        read: () => `read "${g.label}" ${secs(g.ms)} s${x}`,
        hover: () => `hovered "${g.label}"${g.section ? ` in "${g.section}"` : ""} ${secs(g.ms)} s${x}`,
        reread: () => `scrolled back to "${g.label}" ${g.n} time${plural}`,
        select: () => (g.text ? `selected "${g.text}"${x}` : "selected some text"),
        copy: () => (g.text ? `copied "${g.text}"` : "copied some text"),
        click: () => `clicked "${g.label}"${g.section ? ` in "${g.section}"` : ""}${x}`,
        deadclick: () => `clicked "${g.label}" and nothing happened${x}`,
        reverse: () => `reversed scroll direction ${g.n} time${plural}`,
        away: () => `switched to another tab for ${secs(g.ms)} s and came back${x}`,
        exit: () => `moved the pointer out through the top of the window, toward the tab bar${x}`,
      }[g.k];
      if (what) lines.push(`${at(g.t)} ${what()}`);
    }
    out.push(...lines.slice(-30));

    const page = (state.pages || []).at(-1);
    const reads = page ? (state.events || []).filter((x) => x.k === "read" && x.page === page.url).map((x) => x.ms).sort((a, b) => a - b) : [];
    if (reads.length >= 3) out.push(`pace on ${pathOf(page.url)}: ${reads.length} sections in view, median ${secs(reads[reads.length >> 1])} s each`);
    for (const l of looking) out.push(`now looking at "${l.label}" (${secs(now - l.since)} s so far)`);
    if (resting) out.push(`pointer resting on "${resting.label}"${resting.section ? ` in "${resting.section}"` : ""} for ${secs(now - resting.since)} s so far`);
    if (hidden) out.push("the tab is in the background right now");
    else if (idleMs >= 3000) out.push(`no input for the last ${secs(idleMs)} s`);
    return out;
  }

  // The sections read longest this visit, for "what was seen last time".
  function topRead(events) {
    const ms = new Map();
    for (const e of events || []) if (e.k === "read") ms.set(e.label, (ms.get(e.label) || 0) + e.ms);
    return [...ms].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label]) => label);
  }

  function createTracker(options = {}) {
    const now = options.now || (() => Date.now());
    const moment = (kind, detail) => { if (options.onMoment) options.onMoment(kind, detail); };
    let state = fresh();
    const inView = new Map(); // key -> { label, kind, since }, only what is on screen right now
    const seen = new Set(); // section keys actually read this visit, to spot re-reads
    let resting = null;
    let hidden = false;
    let hiddenAt = 0;
    let lastTick = now();
    let lastActivity = 0;
    let lastSave = 0;
    let paused = false;
    let lastPct = 0, dir = 0, runFrom = 0;

    let awayAtLoad = 0; // how long since the stored record's last sign of life, as of this page load; consumed by the first pageview
    function hydrate(saved) {
      if (saved && typeof saved === "object" && Array.isArray(saved.pages)) {
        const { items, clicks, prior, modelInferences, ...rest } = saved; // fields of the old rule-based tracker
        state = { ...fresh(), ...rest };
      }
      inView.clear();
      lastTick = now();
      awayAtLoad = state.lastSeenAt ? lastTick - state.lastSeenAt : 0; // read now: the first tick after load would reset lastSeenAt
    }
    const initial = options.load && options.load();
    // Sync in node, a promise with chrome.storage. Wait for `ready` before feeding events.
    const ready = initial && initial.then ? initial.then(hydrate) : (hydrate(initial), Promise.resolve());

    const cur = () => state.pages[state.pages.length - 1];
    const section = () => [...inView.values()].reverse().find((i) => i.kind === "section")?.label || null;
    function log(k, data = {}) {
      state.events.push({ t: now(), k, page: cur() && cur().url, ...data });
      if (state.events.length > EVENT_KEEP) state.events.splice(0, state.events.length - EVENT_KEEP);
    }
    // A hidden tab never saves: it would overwrite what the visible tab wrote.
    function flush() {
      lastSave = now();
      if (options.save && !hidden) options.save(state);
    }
    // Called when a tab becomes visible, to pick up what other tabs wrote meanwhile.
    function rehydrate() {
      return Promise.resolve(options.load && options.load()).then(hydrate);
    }

    // Attributes the time since the last call to the page and the active/hidden totals. Everything time-based goes through here.
    function tick() {
      const t = now();
      const from = lastTick;
      lastTick = t;
      const page = cur();
      const d = t - from;
      // A gap this long is sleep or a frozen tab, not time spent on the page.
      if (!page || d <= 0 || d > SESSION_GAP) return;
      if (hidden) state.hiddenMs += d;
      else {
        state.lastSeenAt = t;
        page.dwellMs += d;
        const active = Math.max(0, Math.min(t, lastActivity + ACTIVE_WINDOW) - from);
        page.activeMs += active;
        state.activeMs += active;
        if (!paused && t - lastActivity >= PAUSE && page.activeMs >= SUSTAINED) { paused = true; moment("pause"); }
      }
      if (t - lastSave >= SAVE_EVERY) flush();
    }

    function pageview({ url, referrer = "", title = "", surface = "website" }) {
      const t = now();
      const isNew = !state.lastSeenAt || t - state.lastSeenAt > SESSION_GAP;
      if (isNew) awayAtLoad = 0;
      if (isNew) {
        const was = state.pages.length ? { at: state.lastSeenAt, pages: [...new Set(state.pages.slice(-6).map((p) => p.title || pathOf(p.url)))], read: topRead(state.events) } : null;
        state = { ...fresh(), visits: { count: state.visits.count + 1, prevAt: state.lastSeenAt }, past: [...(state.past || []), ...(was ? [was] : [])].slice(-3), startedAt: t };
        seen.clear();
        lastTick = t;
      } else {
        const away = awayAtLoad; // a fresh page load long after the last sign of life: they left and came back inside one visit
        awayAtLoad = 0;
        tick();
        if (away > ACTIVE_WINDOW) { log("return", { ms: away }); moment("return"); }
      }
      const u = new URL(url);
      const tab = u.searchParams.get("tab");
      const key = u.origin + u.pathname + (tab ? `?tab=${clean(tab)}` : "");
      if (cur() && cur().url === key && !isNew) return;
      const first = !state.pages.length;
      inView.clear();
      resting = null;
      lastPct = 0; dir = 0; runFrom = 0;
      if (!state.entry) {
        const utm = {};
        for (const [k, v] of u.searchParams) if (k.startsWith("utm_") && !v.includes("@")) utm[k] = clean(v);
        state.entry = { ...referrerInfo(referrer), utm, landingPage: u.pathname, landingTitle: clean(title) };
      }
      state.pages.push({ url: key, surface, title: clean(title), at: t, dwellMs: 0, activeMs: 0, scroll: 0 });
      state.pages = state.pages.slice(-30);
      state.lastSeenAt = t;
      lastActivity = t;
      paused = false;
      flush();
      if (isNew && state.visits.count > 1) moment("return");
      else if (!first) moment("page");
    }

    // kind: 'section' (headings/blocks) or 'cta' (buttons/links). Call with on=true when it enters view and on=false when it leaves.
    function expose(kind, label, on) {
      tick();
      label = safe(label, cur() && cur().surface);
      if (!label || !cur()) return;
      const key = `${cur().url}|${label}`;
      if (on) {
        if (inView.has(key)) return;
        inView.set(key, { label, kind, since: now() });
        if (kind === "section" && seen.has(key)) { log("reread", { label }); moment("reread", label); }
        return;
      }
      const item = inView.get(key);
      if (!item) return;
      inView.delete(key);
      const ms = now() - item.since;
      if (kind !== "section" || ms < READ_MIN) return;
      seen.add(key);
      log("read", { t: item.since, label, ms }); // stamped when it began
      if (ms >= SECTION_DONE) moment("section_done", label);
    }

    function activity() { tick(); lastActivity = now(); paused = false; }

    function visibility(isHidden) {
      tick();
      isHidden = Boolean(isHidden);
      if (isHidden && !hidden) { hiddenAt = now(); flush(); }
      if (!isHidden && hidden && hiddenAt) { log("away", { ms: now() - hiddenAt }); hiddenAt = 0; }
      hidden = isHidden;
    }

    // Deepest point reached, and every turn of direction after a real stretch of scrolling.
    function scroll(pct) {
      const page = cur();
      if (!page) return;
      pct = Math.max(0, Math.min(100, Math.round(pct)));
      page.scroll = Math.max(page.scroll, pct);
      const step = pct - lastPct;
      if (Math.abs(step) < 2) return;
      const d = step > 0 ? 1 : -1;
      if (d !== dir) {
        if (dir && Math.abs(lastPct - runFrom) >= 10) log("reverse", { to: d > 0 ? "down" : "up" });
        dir = d; runFrom = lastPct;
      }
      lastPct = pct;
    }

    // Only what the person did. The agent's own clicks say nothing about their intent, so they are dropped here.
    function click({ label, actor = "user" }) {
      if (actor !== "user") return;
      activity();
      label = safe(label, cur() && cur().surface);
      if (!label) return;
      log("click", { label, section: section() });
      flush();
    }

    // The pointer has rested on something for a moment (label = what it is, ms = how long so far).
    function rest(label, ms = 0) {
      label = safe(label, cur() && cur().surface);
      if (!label || !cur()) return;
      resting = { label, section: section(), since: now() - ms };
      moment("hover", label);
    }
    // The pointer moved off it: the rest becomes a recorded fact.
    function moveOff() {
      if (!resting) return;
      log("hover", { label: resting.label, section: resting.section, ms: now() - resting.since });
      resting = null;
    }
    function select(text, kind = "select") {
      const surface = cur() && cur().surface;
      log(kind, { text: surface === "website" ? quote(text) : "" });
      moment(kind);
    }
    function deadClick(label) {
      label = safe(label, cur() && cur().surface) || "something on the page";
      log("deadclick", { label });
      moment("deadclick", label);
    }
    function exit() { log("exit"); moment("exit"); }
    function settled() { moment("settled"); } // the page stopped changing (the dashboard finished drawing)

    function summary() {
      tick();
      const t = now();
      return {
        digest: digest(state, { now: t, looking: [...inView.values()].filter((i) => i.kind === "section"), resting, hidden, idleMs: lastActivity ? t - lastActivity : 0 }),
        visits: { count: state.visits.count, lastVisitAt: state.visits.prevAt, returning: state.visits.count > 1 },
        device: options.device || null,
        pages: (state.pages || []).slice(-5).map((p) => ({ url: p.url })),
      };
    }

    return { ready, rehydrate, pageview, expose, activity, visibility, scroll, click, rest, moveOff, select, deadClick, exit, settled, tick, summary, flush };
  }

  return { createTracker, labelFor, digest };
});
