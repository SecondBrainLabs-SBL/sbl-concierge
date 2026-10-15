// The turn, as data (docs/TURN-CONTRACT.md): one visitor message opens one turn; the first line declares its shape (end / show / do);
// the shape fixes the budget and the tools on offer. Pure: the harness owns timers and the engine; this decides.
(function attachTurn(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLTurn = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTurn() {
  const ENGINE_WATCHDOG_MS = 25_000; // the engine opens the turn (no router): its first line took p50 4.8 s, max 8.1 s
  const WATCHDOG_MS = 8_000; // no visible line this long after the message: fallback line, turn over
  const LIMITS = { end: { actions: 3, ms: 20_000 }, show: { actions: 3, ms: 20_000 }, do: { actions: 12, ms: 120_000 } };
  const THENS = Object.keys(LIMITS);
  const OVERLAP_MIN = 0.6;
  const SAID_KEEP = 4, VISIT_KEEP = 12;
  const FALLBACK = "Sorry, I lost my thread there. Could you ask me that again?";
  const FIRST = ["say", "ask_user", "done"];
  // request_human_call is not an action (it is how a hand-off turn ends), so a show turn may reach it.
  const SHOW = ["navigate", "scroll", "point_at", "click", "say", "done", "request_human_call"];
  const CLOSING = ["say", "done", "request_human_call"];
  const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

  const create = (gen, now = Date.now(), { system = false } = {}) => ({ id: gen, then: null, actions: 0, lines: 0, said: [], startedAt: now, ended: false, system: Boolean(system), waited: 0, lineAt: 0, opened: "" }); // opened: the line the router already said (the engine must not open again); waited: ms spent on the visitor (not the turn's time); lineAt: actions done when the last line was said
  // Back from a page load (the task record carries it): the same turn, with what it has left. Ended or malformed: null (the caller opens a fresh one).
  const revive = (o) => {
    if (!o || typeof o !== "object" || o.ended || !Number.isFinite(o.id) || !Number.isFinite(o.startedAt)) return null;
    return { id: o.id, then: THENS.includes(o.then) ? o.then : null, actions: Math.max(0, Number(o.actions) || 0), lines: Math.max(0, Number(o.lines) || 0),
      said: Array.isArray(o.said) ? o.said.slice(-SAID_KEEP).map((s) => clip(s, 300)) : [], startedAt: o.startedAt, ended: false, system: Boolean(o.system), waited: Math.max(0, Number(o.waited) || 0), lineAt: Math.max(0, Number(o.lineAt) || 0), opened: clip(o.opened, 300) };
  };
  const snap = (t) => ({ ...t, said: [...t.said] });
  const lineSaid = (t, text) => { t.lines++; t.lineAt = t.actions; t.said.push(text); if (t.said.length > SAID_KEEP) t.said.shift(); };

  const limit = (t) => (t.then ? LIMITS[t.then] : null);
  const exhausted = (t) => { const l = limit(t); return Boolean(l && t.actions >= l.actions); };
  const msLeft = (t, now = Date.now()) => { const l = limit(t); return l ? Math.max(0, l.ms - (now - t.startedAt - (t.waited || 0))) : null; };
  // first: only a line or a question is offered; show/do: the actions of that shape; closing: budget spent, only a closing line or done.
  const phase = (t) => (t.ended ? "over" : !t.then ? "first" : t.then === "end" || exhausted(t) ? "closing" : t.then);
  // A show turn that has promised and not yet acted cannot speak again (seen live: the model repeats its opening line instead of navigating): no say until one action has happened.
  const allowed = (t) => { const p = phase(t); return p === "show" && t.actions === 0 ? SHOW.filter((n) => n !== "say") : ({ first: FIRST, show: SHOW, closing: CLOSING, over: ["done"], do: null })[p]; }; // null: everything
  // After a line is recorded: does it end the turn? end/show: the closing line is the second; do: only once its budget is spent.
  const closes = (t) => (t.then === "end" ? true : t.then === "show" ? t.lines >= 2 : t.then === "do" ? exhausted(t) : false);

  // What the model is told every step (page instructions), so the cached system prompt never changes.
  function guide(t, now = Date.now()) {
    const l = limit(t), left = l ? Math.max(0, l.actions - t.actions) : 0, secs = Math.ceil((msLeft(t, now) ?? 0) / 1000);
    const p = phase(t);
    if (p === "first") return "TURN: a new turn begins. Your tools now are say, ask_user and done. Begin with ONE say (or one ask_user); its `then` field declares what follows: end (this line is the whole answer), show (you will show it: up to 3 actions, then one closing line), do (multi-step work the visitor asked for).";
    if (p === "closing") return `TURN (${t.then}): your actions are used. Finish with one closing say, or done.`;
    const said = t.opened ? ` The opening line is already said (do not say it or another opening): "${t.opened}".` : "";
    if (p === "show") return t.actions === 0 ? `TURN (show): you have said your line.${said} Now act: navigate to the page or point_at the thing (${l.actions} actions, ${secs}s). Do not speak again before acting.` : `TURN (show): ${left} of ${l.actions} actions left (navigate, scroll, point_at, click on links), ${secs}s. Then one closing say, or done.`;
    return `TURN (do): ${left} of ${l.actions} actions left, ${secs}s.${said} Call done when the work the visitor asked for is finished.`;
  }

  // ---- consent: evidence, not detection ----
  // The destination is parsed, not pattern-matched: userinfo, `;x`, %-escapes and doubled slashes all land on the same path. From sbl.so, ANY app link is gated (a logged-out visitor is sent to login anyway).
  const gatedUrl = (u, from) => {
    let x, onSbl = false;
    try { x = new URL(String(u || ""), from); } catch { return false; }
    if (x.hostname.toLowerCase() !== "app.secondbrainlabs.com") return false;
    try { onSbl = new URL(from).hostname.toLowerCase() === "sbl.so"; } catch { /* no base */ }
    let p = x.pathname; try { p = decodeURIComponent(p); } catch { /* keep raw */ }
    return onSbl || /^\/(signup|login)/.test(p.replace(/;[^/]*/g, "").replace(/\/+/g, "/").toLowerCase());
  };
  // Asking for THEIR contact detail or a password. "Do you run LinkedIn or email outreach today?" and "WhatsApp outreach" are product talk, not asks.
  const CONTACT = /\byour (work |business |personal )?e-?mail|e-?mail address|what(?:'s|\u2019s| is) (?:your|the best) (?:e-?mail|number|phone)|phone number|\byour (?:phone|number|mobile)|telephone|where (?:should|can|do) (?:i|we) (?:send|reach)|password|passcode/i;
  const asksContact = (q) => CONTACT.test(String(q || ""));
  const asksContactLine = (l) => asksContact(l) && /\?|\b(?:tell|give|share|send|enter|type|provide)\b/i.test(l); // a spoken line must also ask: "Sure, using your work email." only says

  // The visit record: what the visitor said (for evidence; `after` = the agent's line it answered), the agent's last line, and when they last declined something. Survives page loads on the task record.
  const newVisit = () => ({ refusedAt: 0, said: [], lastLine: "", lastUrl: "" }); // lastUrl: the page the last turn ended on (a different page at the next message = the visitor moved themselves)
  const reviveVisit = (o) => {
    const v = newVisit();
    if (o && typeof o === "object") {
      v.refusedAt = Number(o.refusedAt) || 0;
      v.lastLine = clip(o.lastLine, 300); v.lastUrl = clip(o.lastUrl, 300);
      if (Array.isArray(o.said)) v.said = o.said.filter((m) => m && Number.isFinite(m.at) && typeof m.text === "string").slice(-VISIT_KEEP).map((m) => ({ at: m.at, text: clip(m.text, 800), after: clip(m.after, 300) }));
    }
    return v;
  };
  const mergeVisit = (a, b) => {
    const seen = new Set(), said = [...a.said, ...b.said].sort((x, y) => x.at - y.at).filter((m) => { const k = `${m.at}|${m.text}`; return seen.has(k) ? false : (seen.add(k), true); });
    return { refusedAt: Math.max(a.refusedAt, b.refusedAt), said: said.slice(-VISIT_KEEP), lastLine: a.lastLine || b.lastLine || "", lastUrl: a.lastUrl || b.lastUrl || "" };
  };
  const visitorSaid = (v, text, at) => { const line = clip(text, 800); if (line) { v.said.push({ at, text: line, after: v.lastLine || "" }); if (v.said.length > VISIT_KEEP) v.said.shift(); } };
  const declined = (v, at) => { v.refusedAt = Math.max(v.refusedAt, at); };
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
  const BARE_YES = /^(?:(?:yes|yeah|yep|ok|okay|sure|please|go ahead|do it|let'?s do it|sounds good)(?: |$))+$/;
  const BARE_NO = /^(?:stop|no|not now|not yet|no thanks|don'?t|wait|cancel)\b/;
  const bare = (t, re) => { const n = norm(t); return Boolean(n) && n.split(" ").length <= 4 && re.test(n); };
  const bareRefusal = (t) => bare(t, BARE_NO);
  const GATED_THING = /sign ?up|trial|log ?in|e-?mail|phone|call/i;
  const OFFER = /\?|\b(?:can|could|shall|want|happy|ready)\b/i;
  // Evidence: the quote (at least 2 words, at least 1 content word) sits in ONE of the visitor's last 3 messages, after the latest refusal: >=60% of ALL its words
  // AND >=60% of its content words are in that same message; or the visitor's latest message is a bare yes to the agent's own question/offer about the gated thing.
  // Content words are judged here (not by Guard.words, whose stemming makes "this" a word): `words` is kept only for the callers' signature.
  const STOP = new Set("this that these those it its is for what can you me up to a an the i want wants and or of in on at my we be do so with how are am as if about please ok".split(" "));
  const evidence = (because, v, words) => {
    const all = (t) => String(t || "").toLowerCase().match(/[a-z0-9']+/g) || [];
    const stem = (w) => (w.length >= 4 ? w.replace(/s$/, "") : w);
    const q = [...new Set(all(clip(because, 300)))], content = [...new Set(q.filter((w) => !STOP.has(w) && w.length > 2).map(stem))];
    const share = (list, have) => list.filter((w) => have.has(w)).length / list.length;
    if (q.length >= 2 && content.length >= 1 && v.said.slice(-3).some((m) => m.at > v.refusedAt && share(q, new Set(all(m.text))) >= OVERLAP_MIN && share(content, new Set(all(m.text).map(stem))) >= OVERLAP_MIN)) return true;
    const last = v.said.at(-1);
    return Boolean(last && last.at > v.refusedAt && bare(last.text, BARE_YES) && GATED_THING.test(last.after || "") && OFFER.test(last.after));
  };

  return { create, revive, snap, lineSaid, limit, exhausted, msLeft, phase, allowed, closes, guide, gatedUrl, asksContact, asksContactLine, newVisit, reviveVisit, mergeVisit, visitorSaid, declined, evidence, bareRefusal,
    WATCHDOG_MS, ENGINE_WATCHDOG_MS, LIMITS, THENS, OVERLAP_MIN, FALLBACK, FIRST, SHOW, CLOSING };
});
