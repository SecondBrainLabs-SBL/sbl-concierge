// Dialogs, drawers and popups.
//
// Anything modal blocks every control behind it, so the agent has to notice one,
// understand what it is asking, and either dismiss it or answer it. Without this the
// agent kept trying to click controls it could not reach and handed the work back.
(function attachOverlays(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLOverlays = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOverlays() {
  const OVERLAY = [
    '[role="dialog"]', '[role="alertdialog"]', "dialog[open]", '[aria-modal="true"]',
    '[data-state="open"][class*="dialog" i]', '[class*="modal" i][class*="open" i]',
    '[class*="drawer" i][data-state="open"]',
  ].join(", ");

  // Ordered by how clearly each one means "let me out of here".
  const DISMISS = [
    /^×$/, /^✕$/, /^x$/, /^close$/, /^close dialog$/, /^dismiss$/,
    /^cancel$/, /^not now$/, /^maybe later$/, /^no thanks$/, /^skip$/, /^skip for now/,
    /^got it$/, /^okay$/, /^ok$/, /^done$/,
  ];

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isVisible(element, view) {
    const style = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0"
      && rect.width > 0 && rect.height > 0;
  }

  // Only the innermost dialogs: a wrapper around a dialog is not itself the dialog.
  function open(document, view = globalThis) {
    const found = [...document.querySelectorAll(OVERLAY)].filter((element) => isVisible(element, view));
    return found.filter((element) => !found.some((other) => other !== element && element.contains(other)));
  }

  function title(overlay) {
    const heading = overlay.querySelector('h1, h2, h3, [role="heading"], [class*="title" i]');
    return normalize(heading?.innerText || overlay.getAttribute("aria-label") || "").slice(0, 90);
  }

  function choices(overlay, view = globalThis) {
    return [...overlay.querySelectorAll('button, [role="button"]')]
      .filter((element) => isVisible(element, view))
      .map((element) => normalize(element.innerText || element.getAttribute("aria-label")))
      .filter(Boolean)
      .slice(0, 8);
  }

  function labelOf(element) {
    return normalize(element.innerText || element.getAttribute("aria-label") || element.getAttribute("title"));
  }

  // A labelled dismiss control first; failing that, the small icon button in the
  // corner, which is what an unlabelled close button almost always is.
  function dismissControl(overlay, view = globalThis) {
    const controls = [...overlay.querySelectorAll('button, [role="button"], a')].filter((element) => isVisible(element, view));
    for (const pattern of DISMISS) {
      const match = controls.find((control) => pattern.test(labelOf(control)));
      if (match) return match;
    }
    const rect = overlay.getBoundingClientRect();
    return controls.find((control) => {
      const box = control.getBoundingClientRect();
      return box.width <= 48 && box.height <= 48
        && box.top - rect.top < 64 && rect.right - box.right < 64;
    }) || null;
  }

  // A dialog that asks a real question should be answered, not dismissed. "You have a
  // saved draft — continue or delete?" has no safe default the agent can pick alone.
  function needsDecision(overlay, view = globalThis) {
    const options = choices(overlay, view);
    const dismissive = options.filter((option) => DISMISS.some((pattern) => pattern.test(option)));
    return options.length - dismissive.length > 1;
  }

  function describe(overlay, view = globalThis) {
    return {
      title: title(overlay),
      choices: choices(overlay, view),
      needsDecision: needsDecision(overlay, view),
      hasDismissControl: Boolean(dismissControl(overlay, view)),
    };
  }

  return { OVERLAY, DISMISS, open, title, choices, dismissControl, needsDecision, describe, normalize };
});
