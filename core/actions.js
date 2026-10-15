// The consequential-action contract: propose -> bind the user's yes -> recheck -> execute once -> verify.
// Pure: no DOM, no storage. The caller supplies `current` (what the screen says now) and `run` (the one click).
(function attachActions(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLActions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createActionsModule() {
  const FIELDS = ["action", "target", "targetId", "effect", "cost", "path", "workspaceId"];
  const CHECKED = ["target", "targetId", "path", "workspaceId", "cost"]; // a change in any of these needs a fresh yes
  const norm = (v) => (v === undefined || v === null ? null : String(v).trim().replace(/\s+/g, " "));
  // The hash is an identity for "this exact proposal", not a defense: it is not secret or collision-resistant, and safety rests on bind()'s state machine and recheck().
  // ponytail: FNV-1a; swap for crypto.subtle if proposals ever cross a trust boundary.
  // cost is part of the proposal text and identity, but a screen rarely quotes one: recheck compares it only against whatever `current.cost` the caller supplies.
  const hashOf = (fields) => {
    let h = 0x811c9dc5;
    for (const ch of JSON.stringify(FIELDS.map((k) => fields[k]))) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    return h.toString(16).padStart(8, "0");
  };

  function recheck(proposal, current = {}) {
    const changed = CHECKED.filter((k) => norm(proposal[k]) !== norm(current[k]));
    return changed.length ? { ok: false, changed, message: `${changed.join(", ")} changed since the proposal; ask again.` } : { ok: true, changed: [] };
  }

  // states: proposed -> bound -> executing -> executed -> done | queued | failed;  invalid / refused end it early.
  function createStore() {
    const items = new Map();
    let n = 0;
    return {
      propose(input = {}) {
        const proposal = Object.fromEntries(FIELDS.map((k) => [k, norm(input[k])]));
        const id = `act${++n}`;
        const hash = hashOf(proposal);
        items.set(id, { id, hash, proposal, state: "proposed", answer: null, result: null });
        return { id, hash };
      },
      get: (id) => items.get(id) || null,
      // Only the yes that carries this proposal's own hash counts, and only once.
      bind(id, answer = {}) {
        const item = items.get(id);
        if (!item) return { ok: false, message: "Unknown proposal." };
        if (item.state !== "proposed") return { ok: false, message: `Proposal already ${item.state}.` };
        if (answer.hash !== item.hash) return { ok: false, message: "That answer belongs to a different proposal." };
        item.state = "bound";
        item.answer = { hash: answer.hash, text: String(answer.text ?? "yes") };
        return { ok: true };
      },
      recheck(id, current) {
        const item = items.get(id);
        return item ? recheck(item.proposal, current) : { ok: false, changed: [], message: "Unknown proposal." };
      },
      // Runs `run` only for a bound proposal whose recheck passes; the yes is spent before `run` starts, so a retry cannot double the effect.
      async execute(id, current, run) {
        const item = items.get(id);
        if (!item) return { ok: false, blocked: "unknown", message: "Unknown proposal." };
        if (item.state !== "bound") return { ok: false, blocked: item.state === "proposed" ? "unbound" : "used", message: item.state === "proposed" ? "No yes is bound to this proposal." : `Already ${item.state}; not running it again.` };
        const check = recheck(item.proposal, current);
        if (!check.ok) { item.state = "invalid"; return { ok: false, blocked: "recheck", changed: check.changed, message: check.message }; }
        item.state = "executing";
        try { item.result = await run(item.proposal); } catch (error) { item.state = "failed"; return { ok: false, blocked: "run", message: String(error?.message || error) }; }
        item.state = "executed";
        return { ok: true, result: item.result };
      },
      // confirmed: true = the state read back matches the goal (done); false = it contradicts it (failed); null/undefined = unknown (queued, not delivered).
      verify(id, confirmed, evidence) {
        const item = items.get(id);
        if (!item || item.state !== "executed") return { ok: false, message: "Nothing executed to verify." };
        item.state = confirmed === true ? "done" : confirmed === false ? "failed" : "queued";
        item.evidence = evidence ?? null;
        return { ok: true, state: item.state };
      },
      cancel(id) {
        const item = items.get(id);
        if (item && (item.state === "proposed" || item.state === "bound")) item.state = "invalid";
      },
    };
  }

  // Read-back mapping: before/now are the campaign state strings (null = row missing, undefined/null before = unknown).
  // Only a real change counts (confirmed:true); unchanged, missing or unknown stay queued (confirmed:null).
  function compare(before, now) {
    const state = before == null || now === undefined ? "unknown" : now === null ? "missing" : now === before ? "unchanged" : "changed";
    return { state, confirmed: state === "changed" ? true : null };
  }

  return { createStore, recheck, compare, hashOf, FIELDS };
});
