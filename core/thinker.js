// When to ask the thinking model, and what it was told last time. Pure: the page feeds it moments and reads back "now?".
// There is no rule here about WHAT the visitor is or WHETHER to speak: that is the model's call. This only decides when a call
// is worth paying for, and keeps the record of what was said and how the visitor reacted, which goes back to the model.
(function attachThinker(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLThinker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createThinker() {
  // COST PLUMBING, not behaviour rules: these two numbers only bound spend.
  const MIN_GAP_MS = 25_000; // at least this long between two model calls, across page loads
  const MAX_CALLS = 6; // model calls per page load and path
  const SETTLE_MS = 1500; // capture plumbing: a wake waits until scrolling has stopped, so it never lands mid-flick
  const SAID_KEEP = 8;
  const SESSION_MS = 30 * 60_000;
  const WELCOME = "Hey, what are you looking to improve: finding leads, getting replies, or booking more meetings?";
  const awaitingWelcome = (messages) => messages.some((m) => m.role === "assistant" && m.text === WELCOME) && !messages.some((m) => m.role === "user");

  // A product welcome, not an inferred goal or permission to act.
  function firstVisitWelcome(firstVisit) {
    let pending = Boolean(firstVisit);
    return ({ blocked, hasConversation, refused = false }) => {
      if (hasConversation || refused) pending = false;
      if (!pending || blocked) return "";
      pending = false;
      return WELCOME;
    };
  }

  // The moments that may wake the model. Anything else (steady scrolling, mouse moves) is not one. Arriving ("page", "return") is not one:
  // a wake at second one can only come back "too soon" and then uses up the gap; the visit's first sign of engagement wakes it, and the digest carries the arrival.
  const MOMENTS = new Set(["section_done", "pause", "reread", "hover", "select", "copy", "deadclick", "exit", "settled"]);

  // state is the persisted object { at, lastWake, said: [{ at, say, goal, reaction, ms }] }; save(state) is called on change.
  function create({ now = () => Date.now(), state, save = () => {}, minGapMs = MIN_GAP_MS, maxCalls = MAX_CALLS } = {}) {
    if (!state || now() - (state.at || 0) > SESSION_MS) state = { at: 0, lastWake: state?.lastWake || 0, said: [] }; // a new visit starts a new record
    for (const s of state.said) if (s.reaction === "shown") s.reaction = "ignored"; // a bubble that was up when the page reloaded is gone
    const pending = []; // moments since the last wake
    const calls = new Map(); // path -> calls this page load
    let lastScroll = 0;
    const touch = () => { state.at = now(); save(state); };

    function moment(kind, detail) {
      if (!MOMENTS.has(kind)) return;
      pending.push({ kind, detail: detail ? String(detail).slice(0, 60) : "" });
      if (pending.length > 8) pending.shift();
    }
    const scrolled = () => { lastScroll = now(); };

    // blocked: a harness run is active, the visitor is mid-conversation, the tab is hidden, a bubble is up, a call is in flight.
    // Returns the moments that woke this call, or null.
    function ready(path, blocked) {
      if (blocked || !pending.length) return null;
      const t = now();
      if (t - state.lastWake < minGapMs || (calls.get(path) || 0) >= maxCalls || t - lastScroll < SETTLE_MS) return null;
      return pending.map((m) => (m.detail ? `${m.kind}: ${m.detail}` : m.kind));
    }
    function woke(path) {
      pending.length = 0;
      state.lastWake = now();
      calls.set(path, (calls.get(path) || 0) + 1);
      touch();
    }

    // What it said and how the visitor reacted. The next wake sees all of it, so it backs off by itself.
    function offer(say, goal) {
      for (const s of state.said) if (s.reaction === "shown") s.reaction = "ignored";
      state.said.push({ at: now(), say: String(say).slice(0, 300), goal: String(goal).slice(0, 300), reaction: "shown", ms: 0 });
      if (state.said.length > SAID_KEEP) state.said.shift();
      touch();
    }
    // reaction: accepted | replied | dismissed | ignored. Only the latest offer can be reacted to, while it is open
    // (or, for a reply, after it faded: a late answer still counts).
    function react(reaction) {
      const s = state.said.at(-1);
      if (!s || !(s.reaction === "shown" || (s.reaction === "ignored" && reaction === "replied"))) return false;
      s.reaction = reaction;
      s.ms = now() - s.at;
      touch();
      return true;
    }
    function silent(moments) {
      if (state.said.at(-1)?.reaction === "silent") state.said.pop(); // a run of silences is one entry, so it cannot push a dismissal out of the list
      state.said.push({ at: now(), say: "", goal: "", reaction: "silent", ms: 0, because: moments.join(", ").slice(0, 120) });
      if (state.said.length > SAID_KEEP) state.said.shift();
      touch();
    }
    const open = () => (state.said.at(-1)?.reaction === "shown" ? state.said.at(-1) : null);
    // For the model, plain lines, oldest first.
    function history() {
      const t = now();
      return state.said.map((s) => {
        const when = `${Math.max(1, Math.round((t - s.at) / 1000))} s ago`;
        if (s.reaction === "silent") return `${when}: you chose to stay silent (woken by ${s.because})`;
        const r = { shown: "still showing, no reaction yet", ignored: "the visitor did not react and it faded", accepted: "the visitor clicked it and you started showing them", replied: "the visitor answered it in the chat", dismissed: `the visitor dismissed it after ${Math.max(1, Math.round(s.ms / 1000))} s` }[s.reaction] || s.reaction;
        return `${when}: you said "${s.say}" (offering: ${s.goal}); ${r}`;
      });
    }
    return { moment, scrolled, ready, woke, offer, react, silent, open, history, state: () => state };
  }

  // The only thing that ever reaches the bubble: the opener, as plain spoken text. Reasoning, evidence and the
  // hypothesis are not parameters of this function and cannot leak through it.
  function bubbleLine(decision) {
    const s = String(decision?.opener ?? "").replace(/[*_`#>\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 400); // safety cap only; the prompt asks for a line of 20 words
    return decision?.speak === true ? s : "";
  }

  // The model's private read of the visitor is stored apart from the customer file (which voice and the acting model see) and goes
  // only back to the thinker. Older builds wrote it into the file as a "- Read:" line: strip those wherever the file is read.
  const withoutRead = (file) => String(file || "").split("\n").filter((l) => !l.startsWith("- Read: ")).join("\n").trim();

  return { create, bubbleLine, withoutRead, firstVisitWelcome, awaitingWelcome, MOMENTS, MIN_GAP_MS, MAX_CALLS, SESSION_MS };
});
