// The turn trace (FR-15, docs/TRACE-SCHEMA.md): what the page records about a turn, posted fire-and-forget to the local server.
// Pure but for post(): the harness builds one tracer, masks every text through its own mask(), and nothing here is ever awaited.
(function attachTrace(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLTrace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTrace(root) {
  const SERVER = "http://127.0.0.1:8787"; // the same base store.js and content.js use
  const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const KEY = "sbl_trace_v1"; // per tab: the counter and the open turn survive a page load, so a resumed run stays in its turn

  // Fire and forget: the extension goes through background.js (Local Network Access), a script tag calls the server itself.
  function post(event, base = SERVER) {
    try {
      if (root.chrome?.runtime?.id) root.chrome.runtime.sendMessage({ type: "concierge-fetch", path: "/trace", method: "POST", body: event }).catch(() => {});
      else root.fetch(`${base}/trace`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true }).catch(() => {});
    } catch { /* tracing never breaks the dock */ }
  }

  // Origin + path only: a query string or hash can carry tokens or what the visitor typed.
  const bare = (u) => { try { const x = new URL(String(u)); return clip(x.origin + x.pathname, 300); } catch { return clip(String(u ?? "").split(/[?#]/)[0], 300); } };
  const NUMBER = /\d(?:[ -]?\d){12,18}/g; // 13-19 digits, possibly spaced or dashed: a card number
  const maskNumbers = (t) => String(t ?? "").replace(NUMBER, "[number]"); // also applied to what leaves the page for the router and the note call

  // v: the visitor id (null in the extension: a per-tab random one stands in). send: where events go. mask: the harness's secret mask.
  // storage: undefined = this tab's sessionStorage, resolved here (a blocked one throws on access); null = none, the tracer then lives in memory.
  function create({ v, send = () => {}, mask = (s) => s, now = Date.now, storage }) {
    if (storage === undefined) { try { storage = root.sessionStorage; } catch { storage = null; } }
    const rnd = (n) => Math.random().toString(36).slice(2, 2 + n).padEnd(n, "0");
    let s = { n: 0, turn: null, ended: true, v: null, url: null, tab: null };
    try {
      const o = JSON.parse(storage?.getItem(KEY) || "{}");
      if (o && typeof o === "object") s = { ...s, ...o };
    } catch { /* blocked or corrupt storage: counters restart per page */ }
    if (!Number.isFinite(s.n)) s.n = 0;
    if (typeof s.v !== "string" || !s.v) s.v = null;
    if (typeof s.tab !== "string" || !s.tab) s.tab = rnd(4);
    if (typeof s.turn !== "string") s.turn = null;
    s.v ||= String(root.crypto?.randomUUID?.() ?? `x${rnd(12)}`);
    const vid = String(v || s.v);
    const keep = () => { try { storage?.setItem(KEY, JSON.stringify(s)); } catch {} };
    const emit = (k, fields) => { try { const r = send({ t: now(), v: vid, turn: s.turn, k, ...fields }); r?.catch?.(() => {}); } catch {} };
    const text = (t, n) => { let m; try { m = mask(String(t ?? "")); } catch { m = "[hidden]"; } return clip(String(m ?? "").replace(NUMBER, "[number]"), n); };
    const safe = (f, dflt) => (...a) => { try { return f(...a); } catch { return dflt; } }; // tracing never throws into the caller
    return {
      open: safe((t, mode, url) => { s.turn = `${vid.slice(0, 8)}-${s.tab}-${++s.n}`; s.ended = false; keep(); emit("turn_open", { text: text(t, 500), mode, url: bare(url) }); }),
      line: safe((t, refused) => { emit("line", { text: text(t, 500), ...(refused ? { refused: true } : {}) }); }),
      action: safe((type, target, turn) => { emit("action", { type: clip(type, 40), target: text(target, 120), ...(turn ? { turn } : {}) }); }), // turn: the turn that did it, when it is not the open one
      nav: safe((url) => { const u = bare(url); if (u === s.url) return; s.url = u; keep(); emit("nav", { url: u }); }),
      error: safe((detail) => { emit("error", { detail: text(detail, 300) }); }),
      end: safe((status, url) => { if (s.ended || !s.turn) return; s.ended = true; keep(); emit("turn_end", { status, url: bare(url) }); }), // once per turn
      headers: safe(() => ({ "X-SBL-V": vid, "X-SBL-Turn": s.turn || "" }), {}),
      turn: () => s.turn,
      state: () => ({ turn: s.turn, n: s.n, tab: s.tab, ended: s.ended }), // rides on the task record across the cross-origin hop
      seed: safe((o) => { if (o && typeof o.turn === "string" && typeof o.tab === "string" && Number.isFinite(o.n) && o.n >= s.n) { s.turn = o.turn; s.n = o.n; s.tab = o.tab; s.ended = Boolean(o.ended); keep(); } }),
    };
  }
  return { create, post, clip, maskNumbers };
});
