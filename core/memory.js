// The conversation's memory. Nothing is ever deleted: navigating from the marketing
// site to the dashboard, reloading, or reconnecting voice must all continue the same
// conversation rather than start a new one.
//
// Storage is injected so this can be tested without a browser and reused outside the
// extension later.
(function attachMemory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLMemory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMemoryModule() {
  const VERSION = 1;
  // What the model is told about earlier turns. The whole transcript is kept; only
  // what is *sent* is bounded, because a session has a finite context.
  const MODEL_CHARS = 4000;
  const MODEL_TURNS = 40;
  // Persisted (not sent) bounds. ponytail: oldest turns fall off storage past these; a
  // real store would archive them instead. Far beyond anything a session produces.
  const PERSIST_TURNS = 2000;
  const PERSIST_WS_TURNS = 500;
  // Away longer than this counts as a return rather than the same sitting.
  const RETURN_GAP = 30 * 60_000;
  // Ids come from the page (URL, DOM), so they are constrained before use as keys.
  const VALID_ID = /^(?!__proto__$|constructor$|prototype$)[\w-]{1,64}$/;

  const PROFILE_LIST_CAP = 10;
  const emptyProfile = () => ({ objections: [], questions: [], interests: [], lastGoal: null, lastPages: [], updatedAt: null });

  function emptyState() {
    return {
      version: VERSION,
      conversationId: null,
      startedAt: null,
      updatedAt: null,
      stage: "business",
      facts: {},
      messages: [],
      milestones: [],
      // Account-bound state. facts/messages/milestones above stay website-level and are
      // carried into the app; whatever is learned or said once a workspace is bound
      // lives under workspaces[id] and is only ever shown while that workspace is current.
      workspaceId: null,
      workspaces: Object.create(null), // null prototype: ids come from the page
      returnedAfter: null,
      // Visitor profile: shared scope like facts, so it survives login/logout and is carried
      // across visits. ponytail: stated facts only; the model writes it via remember_visitor.
      profile: emptyProfile(),
      // The visitor record (core/record.js): written by the harness after each turn; same shared scope, so it survives loads, the app hop and return visits.
      record: null,
    };
  }

  function createMemory(options = {}) {
    const now = options.now || (() => Date.now());
    const id = options.id || (() => `c-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    let state = emptyState();
    let dirty = false;

    const ws = () => (state.workspaceId && Object.hasOwn(state.workspaces, state.workspaceId) ? state.workspaces[state.workspaceId] : null);
    // Where new facts, turns and milestones go: the bound workspace, else the website.
    const scope = () => ws() || state;

    function touch() {
      state.updatedAt = now();
      dirty = true;
    }

    function start() {
      if (!state.conversationId) {
        state.conversationId = id();
        state.startedAt = now();
        touch();
      }
      return state.conversationId;
    }

    // Repeated identical assistant lines are noise, usually a re-render after
    // navigation rather than the agent saying the same thing twice.
    function isEcho(role, text) {
      const list = scope().messages;
      const last = list[list.length - 1];
      return Boolean(last && last.role === role && last.text === text && now() - last.at < 4000);
    }

    function append(role, text, kind = "message") {
      const clean = String(text || "").trim();
      if (!clean || isEcho(role, clean)) return null;
      start();
      const entry = { role, text: clean, kind, at: now() };
      scope().messages.push(entry);
      touch();
      return entry;
    }

    // Facts are the durable part: what the business sells, who it targets, which
    // campaign is open. They survive every reload and are never trimmed.
    function remember(facts = {}) {
      let changed = false;
      for (const [key, value] of Object.entries(facts)) {
        if (value === undefined || value === null || value === "") continue;
        const target = scope();
        if (target.facts[key] === value) continue;
        target.facts[key] = value;
        changed = true;
      }
      if (changed) { start(); touch(); }
      return state.facts;
    }

    // Merge a patch into the profile. Lists dedupe and keep the newest PROFILE_LIST_CAP.
    function rememberProfile(patch = {}) {
      const p = state.profile;
      const str = (v, n = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
      const add = (list, values, n = 5000) => {
        for (const v of [].concat(values ?? []).map((x) => str(x)).filter(Boolean)) {
          const at = list.indexOf(v);
          if (at >= 0) list.splice(at, 1);
          list.push(v);
        }
        list.splice(0, Math.max(0, list.length - n));
      };
      for (const key of ["name", "company", "role"]) if (str(patch[key], 80)) p[key] = str(patch[key], 80);
      add(p.objections, patch.objections ?? patch.objection, PROFILE_LIST_CAP);
      add(p.questions, patch.questions ?? patch.question, PROFILE_LIST_CAP);
      add(p.interests, patch.interests ?? patch.interest, PROFILE_LIST_CAP);
      add(p.lastPages, patch.page ?? patch.lastPages, 5);
      if (str(patch.goal ?? patch.lastGoal, 40)) p.lastGoal = str(patch.goal ?? patch.lastGoal, 40);
      p.updatedAt = now();
      touch();
      return profile();
    }

    const profile = () => JSON.parse(JSON.stringify(state.profile));
    const record = () => (state.record ? JSON.parse(JSON.stringify(state.record)) : null);
    function setRecord(next) {
      state.record = next && typeof next === "object" ? JSON.parse(JSON.stringify(next)) : null;
      if (state.record) start();
      touch();
    }

    function milestone(name, detail = {}) {
      start();
      const list = scope().milestones;
      list.push({ name, detail, at: now() });
      touch();
      return list[list.length - 1];
    }

    function setStage(stage) {
      if (!stage || state.stage === stage) return state.stage;
      state.stage = stage;
      touch();
      return stage;
    }

    function transcript() {
      const w = ws();
      if (!w) return state.messages.slice();
      return [...state.messages, ...w.messages].sort((a, b) => (a.at || 0) - (b.at || 0));
    }

    function facts() {
      return { ...state.facts, ...ws()?.facts };
    }

    // Bind to an account workspace. Prefer the stable id; the label is display only
    // (two workspaces can share one). Switching never merges: it just changes scope.
    // ephemeral: the id was derived from a label, so nothing bound to it is ever persisted
    // and it is dropped on any switch.
    function bindWorkspace(workspaceId, label, { ephemeral = false } = {}) {
      const key = String(workspaceId ?? "");
      if (!VALID_ID.test(key)) return null;
      for (const [other, w] of Object.entries(state.workspaces)) if (w.ephemeral && other !== key) delete state.workspaces[other];
      const w = Object.hasOwn(state.workspaces, key) ? state.workspaces[key] : (state.workspaces[key] = { label: null, facts: {}, messages: [], milestones: [], ephemeral });
      if (label) w.label = label;
      state.workspaceId = key;
      touch();
      return workspace();
    }

    function workspace() {
      const w = ws();
      return w ? { id: state.workspaceId, label: w.label } : null;
    }

    // Logout: everything account-bound goes, website context stays.
    function clearAccount() {
      state.workspaceId = null;
      state.workspaces = Object.create(null);
      touch();
    }

    // Account data has its own storage key. Ephemeral (label-only) scopes are never written.
    function serializeAccount() {
      const out = {};
      for (const [key, w] of Object.entries(state.workspaces)) {
        if (!w.ephemeral) out[key] = { ...w, messages: w.messages.slice(-PERSIST_WS_TURNS) };
      }
      return out;
    }

    // Merge what another tab stored into memory (never replaces, never binds), so a write
    // from a stale copy cannot drop a newer turn.
    function hydrateAccount(saved) {
      if (!saved || typeof saved !== "object") return;
      const seen = (list) => new Set(list.map((m) => `${m.at}|${m.role || m.name}|${m.text || ""}`));
      for (const [key, w] of Object.entries(saved)) {
        if (!VALID_ID.test(key) || !w || typeof w !== "object") continue;
        const mine = Object.hasOwn(state.workspaces, key) ? state.workspaces[key] : (state.workspaces[key] = { label: null, facts: {}, messages: [], milestones: [] });
        const extra = (from, into) => {
          if (!Array.isArray(from)) return;
          const have = seen(into);
          for (const m of from) if (m && (m.text || m.name) && !have.has(`${m.at}|${m.role || m.name}|${m.text || ""}`)) into.push(m);
          into.sort((a, b) => (a.at || 0) - (b.at || 0));
        };
        extra(w.messages, mine.messages);
        extra(w.milestones, mine.milestones);
        mine.label = mine.label || w.label || null;
        mine.facts = { ...(w.facts && typeof w.facts === "object" ? w.facts : {}), ...mine.facts };
      }
    }

    function stage() {
      return state.stage;
    }

    // What a fresh model session needs in order to carry on mid-conversation.
    function contextForModel(limits = {}) {
      const maxChars = limits.maxChars || MODEL_CHARS;
      const maxTurns = limits.maxTurns || MODEL_TURNS;
      const recent = [];
      const all = transcript();
      const w = ws();
      let used = 0;
      for (let index = all.length - 1; index >= 0 && recent.length < maxTurns; index--) {
        const entry = all[index];
        if (entry.kind === "event") continue;
        const line = `${entry.role}: ${entry.text}`;
        if (used + line.length > maxChars) break;
        used += line.length;
        recent.unshift({ role: entry.role, text: entry.text });
      }
      return {
        conversationId: state.conversationId,
        resumed: all.length > recent.length,
        stage: state.stage,
        knownFacts: facts(),
        milestones: [...state.milestones, ...(w ? w.milestones : [])].slice(-8),
        recentConversation: recent,
        totalTurns: all.length,
        fromWebsite: state.messages.length > 0 || Object.keys(state.facts).length > 0,
        workspace: workspace(),
        profile: profile(),
        returning: state.returnedAfter && now() - state.returnedAfter.at < RETURN_GAP
          ? `Returning after ${Math.round((now() - state.returnedAfter.lastSeenAt) / 86_400_000)} day(s), last seen ${new Date(state.returnedAfter.lastSeenAt).toISOString()}. Offer to resume from the known facts.`
          : null,
      };
    }

    // Facts are stored as the person said them ("We sell a CRM"), so the lead-in is
    // stripped before it is read back, or the line reads "you sell We sell a CRM".
    function withoutLeadIn(text) {
      return String(text)
        .replace(/^\s*(?:we|i)\s+(?:want|would like|need|aim|hope|intend)\s+to\s+/i, "")
        .replace(/^\s*(we|i|our (?:company|business|team))\s+(?:sell|sells|offer|offers|are|is|do|build|provide|help)\s+/i, "")
        .replace(/^\s*(?:it'?s|its)\s+/i, "")
        .replace(/^\s*to\s+/i, "")
        .trim();
    }

    // A one-line reminder for the person, so a reload does not feel like a reset.
    function resumeLine() {
      const known = facts();
      if (!transcript().length) return null;
      const parts = [];
      if (known.business) parts.push(`you sell ${withoutLeadIn(known.business)}`);
      if (known.audience) parts.push(`targeting ${withoutLeadIn(known.audience)}`);
      if (known.goal) parts.push(`to ${withoutLeadIn(known.goal)}`);
      if (!parts.length) return "Picking up where we left off.";
      return `Picking up where we left off — ${parts.join(", ")}.`;
    }

    // Website-level only: account data is stored separately (serializeAccount).
    function serialize() {
      const { workspaces, workspaceId, ...shared } = state;
      return { ...shared, messages: state.messages.slice(-PERSIST_TURNS) };
    }

    function hydrate(saved) {
      if (!saved || typeof saved !== "object") return state;
      const restored = { ...emptyState(), ...saved };
      restored.messages = Array.isArray(saved.messages) ? saved.messages.filter((m) => m && m.text) : [];
      restored.facts = saved.facts && typeof saved.facts === "object" ? saved.facts : {};
      restored.milestones = Array.isArray(saved.milestones) ? saved.milestones : [];
      restored.profile = { ...emptyProfile(), ...(saved.profile && typeof saved.profile === "object" ? saved.profile : {}) };
      restored.record = saved.record && typeof saved.record === "object" ? saved.record : null;
      for (const key of ["objections", "questions", "interests", "lastPages"]) if (!Array.isArray(restored.profile[key])) restored.profile[key] = [];
      // Always starts unbound: this page proves which workspace it is on. Account data
      // arrives separately via hydrateAccount.
      restored.workspaceId = null;
      restored.workspaces = Object.create(null);
      dirty = false;
      // Coming back after a gap is remembered (until it ages out) so every page of the
      // return knows it, not only the first to load.
      const gone = saved.updatedAt && now() - saved.updatedAt;
      if (gone > RETURN_GAP) {
        restored.returnedAfter = { lastSeenAt: saved.updatedAt, at: now() };
        dirty = true;
      }
      state = restored;
      return state;
    }

    // Only ever called when the person asks for a fresh start.
    function reset() {
      state = emptyState();
      touch();
      return state;
    }

    function pending() {
      return dirty;
    }

    function saved() {
      dirty = false;
    }

    return {
      start, append, remember, rememberProfile, profile, record, setRecord, milestone, setStage, transcript, facts, stage,
      bindWorkspace, workspace, clearAccount, serializeAccount, hydrateAccount,
      contextForModel, resumeLine, serialize, hydrate, reset, pending, saved,
    };
  }

  return { createMemory, emptyState, VERSION, MODEL_CHARS, MODEL_TURNS };
});
