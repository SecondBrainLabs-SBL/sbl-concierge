// Choosing the right control to click.
//
// Substring matching is how "ICP" ends up clicking "ICP Filter" on the Add Leads tab
// when the agent wanted "Leads by SBL". A control is chosen only when one candidate
// is clearly the best; otherwise the agent is told what is actually on screen and
// picks from real labels rather than guessing.
(function attachControls(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLControls = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createControls() {
  const CLICKABLE = 'button, a, [role="button"], [role="tab"], [role="option"], [role="menuitem"], summary, .cursor-pointer';
  const STOPWORDS = new Set(["a", "an", "the", "to", "for", "of", "with", "your", "my", "and", "or", "by", "on", "in"]);
  // Words that mark a different job from the one being asked for. "Filter" is not
  // "leads"; "settings" is not "connect".
  const DIFFERENT_JOB = new Set(["filter", "filters", "settings", "help", "learn", "docs", "delete", "remove",
    "cancel", "close", "edit", "preview", "history", "export", "upgrade", "buy"]);
  const CONFIDENT = 35;
  const TOO_CLOSE = 8;

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function tokens(value) {
    return normalize(value).split(/[^a-z0-9]+/).filter((word) => word && !STOPWORDS.has(word));
  }

  function isVisible(element, view) {
    const style = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }

  function labelsOf(element) {
    const own = [
      element.getAttribute("aria-label"),
      element.innerText,
      element.value,
      element.getAttribute("title"),
    ];
    return own.map(normalize).filter(Boolean);
  }

  function score(candidate, wanted) {
    const want = normalize(wanted);
    const have = normalize(candidate);
    if (!want || !have) return 0;
    if (have === want) return 100;

    const wantWords = tokens(want);
    const haveWords = tokens(have);
    if (!wantWords.length || !haveWords.length) return 0;

    const matched = wantWords.filter((word) => haveWords.includes(word));
    const missing = wantWords.length - matched.length;
    const extra = haveWords.filter((word) => !wantWords.includes(word));
    // A short request is the easiest to over-match, so extra words cost more there.
    const extraCost = wantWords.length <= 1 ? 20 : 6;
    const jobMismatch = extra.filter((word) => DIFFERENT_JOB.has(word)).length;

    if (!missing) {
      return 50 - extra.length * extraCost - jobMismatch * 25;
    }
    return matched.length * 12 - missing * 12 - extra.length * extraCost - jobMismatch * 25;
  }

  function candidates(document, view = globalThis, options = {}) {
    const root = options.root || document;
    return [...root.querySelectorAll(CLICKABLE)]
      .filter((element) => isVisible(element, view))
      .filter((element) => !element.closest("[data-sbl-agent]"));
  }

  // names: every label that would be acceptable, best first. Returning the reason and
  // the real options matters as much as returning an element — the agent recovers by
  // choosing a label that exists rather than by guessing again.
  function find(names, document, view = globalThis, options = {}) {
    const wanted = (Array.isArray(names) ? names : [names]).map(normalize).filter(Boolean);
    if (!wanted.length) return { ok: false, reason: "no-name", options: [] };

    const ranked = candidates(document, view, options)
      .map((element) => {
        const best = Math.max(0, ...labelsOf(element).flatMap((label) => wanted.map((name) => score(label, name))));
        return { element, label: labelsOf(element)[0] || "", value: best };
      })
      .filter((entry) => entry.label)
      .sort((a, b) => b.value - a.value);

    const visibleOptions = ranked.slice(0, 12).map((entry) => entry.label);
    const best = ranked[0];
    if (!best || best.value < CONFIDENT) {
      return { ok: false, reason: "no-match", options: visibleOptions, bestGuess: best?.label, bestScore: best?.value ?? 0 };
    }
    const runnerUp = ranked.find((entry) => entry.element !== best.element);
    if (runnerUp && best.value - runnerUp.value < TOO_CLOSE) {
      return {
        ok: false, reason: "ambiguous", options: visibleOptions,
        between: [best.label, runnerUp.label],
      };
    }
    return { ok: true, element: best.element, label: best.label, value: best.value, options: visibleOptions };
  }

  function inventory(document, view = globalThis, options = {}) {
    return candidates(document, view, options)
      .map((element) => labelsOf(element)[0])
      .filter(Boolean)
      .filter((label, index, all) => all.indexOf(label) === index)
      .slice(0, 40);
  }

  return { CLICKABLE, CONFIDENT, find, score, tokens, labelsOf, candidates, inventory, normalize };
});
