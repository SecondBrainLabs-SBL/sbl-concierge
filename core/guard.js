// What the harness never decides for the visitor, and what it never lets the model see. Pure: no storage, no DOM writes.
(function attachGuard(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGuard() {
  // Consequential = spends money, changes what is live, or reaches other people. Signing up, logging in, creating a draft
  // campaign and generating content are deliberately absent: the visitor asked for those, so the agent does them.
  // Matched per line of a control's label (<= 80 chars), so a long card that merely mentions "delete" is not a delete button.
  // [what it is, pattern]. The first is what the visitor is told above the card ("This will ...").
  const RULES = [
    ["change a campaign's run state (launch, run, pause, resume or end it)", /\blaunch\b|\b(?:run|start|pause|resume|end|stop)\s+(?:the\s+|this\s+|my\s+)?campaigns?\b|^(?:pause|resume)\b|\brun for new leads\b|\bturn (?:on|off) conversations\b/i],
    ["spend money", /\bpay(?:ment)? now\b|^pay\b|\bpay \S*\d|\bcomplete (?:purchase|payment|order)\b|\bplace order\b|\bcheck ?out\b|\bbuy\b|\bpurchase\b|\bsubscribe\b|\bupgrade\b|\brent\b|\badd (?:a )?(?:payment|card)\b|\bhire (?:a )?profile/i],
    ["delete or remove something", /\b(?:delete|remove|archive)\b/i],
    ["disconnect an account", /\bdisconnect\b/i],
    ["SEND a message to someone", /^send$|\bsend (?:a |the |your )?(?:message|reply|dm)\b|\bsend (?:now|invit\w*|(?:a )?(?:connection )?request)\b|^approve\b/i],
    ["import leads (this can use credits)", /\bimport (?:leads|contacts|to campaign)\b|\bstart import\b|\bextract\b/i],
    ["invite people", /\binvite\b/i],
  ];
  const DIALOG_NEUTRAL = /^(?:cancel|close|no|back|not now|keep|dismiss|later|×|x)$/i;

  // labels: strings a control shows (text, aria-label, title, value). Returns why it is consequential, or null.
  function consequential(labels) {
    for (const raw of [].concat(labels || [])) {
      for (const line of String(raw || "").split("\n")) {
        const text = line.replace(/\s+/g, " ").trim();
        if (!text || text.length > 80) continue;
        for (const [why, pattern] of RULES) if (pattern.test(text)) return why;
      }
    }
    return null;
  }

  // A control inside a dialog whose own headline is consequential ("Delete campaign?") is consequential, whatever it says ("Confirm", "Yes", "OK").
  function inDialog(dialogLines, labels) {
    const why = consequential(dialogLines);
    if (!why) return null;
    const own = [].concat(labels || []).map((l) => String(l || "").replace(/\s+/g, " ").trim()).filter(Boolean);
    return own.length && own.every((l) => DIALOG_NEUTRAL.test(l)) ? null : why;
  }

  // An icon-only control with no name, inside a message composer or an action bar, cannot be judged by its label: treat it as consequential.
  const unlabeled = (labels, inRiskyArea) => (inRiskyArea && ![].concat(labels || []).some((l) => String(l || "").trim()) ? "press an unlabelled control in a message or action area" : null);

  // Replaces every known secret (2+ chars would garble ordinary text, so 3+) wherever it appears.
  function maskSecrets(text, secrets = []) {
    let out = String(text ?? "");
    for (const secret of new Set(secrets)) if (typeof secret === "string" && secret.length >= 3) out = out.split(secret).join("[hidden]");
    return out;
  }

  // Values currently typed into password fields, by the visitor or by us.
  // Includes a "show password" toggle that turned the field into type=text.
  const PASSWORD_FIELDS = 'input[type=password], input[autocomplete*="password" i], input[name*="pass" i], input[id*="pass" i]';
  const passwordValues = (scope) => [...scope.querySelectorAll(PASSWORD_FIELDS)].map((el) => el.value).filter(Boolean);
  const isPasswordField = (el) => Boolean(el?.matches?.(PASSWORD_FIELDS));

  // A link or form that would open a second tab strands the run in a tab the visitor is not looking at.
  function sameTab(element) {
    const holder = element?.closest?.("a[target],form[target]");
    if (!holder || !holder.target || holder.target === "_self") return false;
    holder.target = "_self";
    return true;
  }

  // The hosts the agent may take the visitor to. Anything else is the visitor's own business.
  // Exactly the hosts the content script runs on (manifest.json), not any subdomain.
  const SBL_HOSTS = ["sbl.so", "app.secondbrainlabs.com"];
  const isSblUrl = (url) => { try { const u = new URL(url); return u.protocol === "https:" && SBL_HOSTS.includes(u.hostname); } catch { return false; } };

  // What the visitor reads and hears: plain sentences. The model sometimes reaches for markdown.
  const plain = (text) => String(text ?? "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*`]+/g, "").replace(/^\s*(?:#+|[-•>])\s+/gm, "").replace(/\s+/g, " ").trim();

  // ---- semantic overlap (the founder session's re-word loop: the same content spoken 2-3x in
  // different words; a keyed dedupe never catches a re-wording) ----
  const STOP = new Set("the a an and or but is are was were be been am i you he she it we they them his her its our your their this that these those of in on at to for with by from as so then than if not no do does did done will would can could should may might must have has had what which who whom how why when where all any some more most very just also into about over under again once here there yes yeah okay ok".split(" "));
  const words = (t) => String(t || "").toLowerCase().replace(/[-_/]/g, " ").replace(/([a-z])\.([a-z])/g, "$1 $2").replace(/[^a-z0-9$%, ]+/g, " ").split(/\s+/).map((w) => w.replace(/[.,]+$/, "")).map((w) => (w.length >= 4 && /[^0-9.]/.test(w) ? w.replace(/s$/, "") : w)).filter((w) => w.length > 2 && !STOP.has(w));
  // Share of the SMALLER line's words that appear in the bigger one: 1.0 when one contains the other
  // (an echo, the mouth reading two adjacent lines as one), high when a line was re-worded, low for
  // genuinely new content. The dedupe guards compare this against a threshold.
  function overlap(a, b) {
    const wa = [...new Set(words(a))], wb = [...new Set(words(b))];
    if (!wa.length || !wb.length) return 0;
    const [small, big] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
    const bigSet = new Set(big);
    let hits = 0;
    for (const w of small) if (bigSet.has(w)) hits++;
    return hits / small.length;
  }
  // What a line is ABOUT: content words (stopwords and twits dropped, light singular-stemming) plus
  // numbers and amounts ($60,000, 30 days) — the pointers a section-lookup can match against.
  function topicWords(text) {
    return words(text).slice(0, 14);
  }

  return { consequential, inDialog, unlabeled, maskSecrets, passwordValues, isPasswordField, sameTab, isSblUrl, plain, overlap, words, topicWords, RULES };
});
