// A visible pointer that moves the way a hand does: curved, eased, with a small
// overshoot and correction, then dispatches the full event sequence a real pointer
// produces so the host application cannot tell the difference.
(function attachCursor(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLCursor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCursor() {
  const MIN_MS = 320;
  const MAX_MS = 1100;
  const PX_PER_MS = 1.6;

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function distance(from, to) {
    return Math.hypot(to.x - from.x, to.y - from.y);
  }

  // Longer moves take longer, but sub-linearly — the same shape as human pointing.
  function durationFor(from, to) {
    const span = distance(from, to);
    return Math.max(MIN_MS, Math.min(MAX_MS, MIN_MS + Math.sqrt(span) * PX_PER_MS * 6));
  }

  // Two control points pushed off the straight line, so the path bows like a wrist
  // movement instead of travelling down the diagonal.
  function controlPoints(from, to, random = Math.random) {
    const span = distance(from, to) || 1;
    const nx = -(to.y - from.y) / span;
    const ny = (to.x - from.x) / span;
    const bow = Math.min(120, span * 0.18) * (random() * 0.8 + 0.3) * (random() < 0.5 ? -1 : 1);
    const jitter = () => (random() - 0.5) * Math.min(30, span * 0.06);
    return [
      { x: from.x + (to.x - from.x) * 0.3 + nx * bow + jitter(), y: from.y + (to.y - from.y) * 0.3 + ny * bow + jitter() },
      { x: from.x + (to.x - from.x) * 0.7 + nx * bow * 0.6 + jitter(), y: from.y + (to.y - from.y) * 0.7 + ny * bow * 0.6 + jitter() },
    ];
  }

  function bezier(from, c1, c2, to, t) {
    const u = 1 - t;
    return {
      x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
      y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
    };
  }

  // A sampled path, eased in time. The last point is always exactly the target.
  function path(from, to, options = {}) {
    const random = options.random || Math.random;
    const steps = options.steps || Math.max(16, Math.round(durationFor(from, to) / 16));
    const [c1, c2] = options.control || controlPoints(from, to, random);
    const points = [];
    for (let index = 0; index <= steps; index++) {
      const point = bezier(from, c1, c2, to, easeInOut(index / steps));
      points.push({ x: Math.round(point.x * 100) / 100, y: Math.round(point.y * 100) / 100 });
    }
    points[points.length - 1] = { x: to.x, y: to.y };
    return points;
  }

  // People overshoot a distant target slightly, then correct back onto it.
  function withOvershoot(from, to, options = {}) {
    const random = options.random || Math.random;
    const span = distance(from, to);
    if (span < 220) return [path(from, to, options)];
    const scale = (Math.min(28, span * 0.05) * (0.5 + random() * 0.6)) / span;
    const past = { x: Math.round(to.x + (to.x - from.x) * scale), y: Math.round(to.y + (to.y - from.y) * scale) };
    return [path(from, past, options), path(past, to, { ...options, steps: 8 })];
  }

  // Typing rhythm: quick within words, a beat after punctuation, occasional hesitation.
  function typingPlan(text, options = {}) {
    const random = options.random || Math.random;
    const base = options.base ?? 55;
    return [...text].map((character) => {
      let delay = base + random() * 55;
      if (/[.,!?;:]/.test(character)) delay += 90 + random() * 120;
      else if (character === " " && random() < 0.18) delay += 70 + random() * 110;
      else if (random() < 0.04) delay += 140 + random() * 200;
      return { character, delay: Math.round(delay) };
    });
  }

  function createSurface(document) {
    const existing = document.getElementById("sbl-agent-cursor-layer");
    if (existing) return existing.__sbl;
    const host = document.createElement("div");
    host.id = "sbl-agent-cursor-layer";
    host.dataset.pageAgentIgnore = "true"; // the page-agent engine must not list our own pointer layer as page elements
    host.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "open" });
    // ponytail: getURL throws "Extension context invalidated" after a reload and chrome is absent in tests; the chip then shows no mark.
    let brain = "";
    try { brain = globalThis.chrome.runtime.getURL("assets/sbl-brain.png"); } catch { /* no mark */ }
    const LAYER_HTML = `
      <style>
        :host { --font:-apple-system,"SF Pro Text",Inter,system-ui,sans-serif; }
        .pointer { position:fixed; left:0; top:0; width:26px; height:26px; margin:-3px 0 0 -3px; opacity:0; transition:opacity .18s ease; will-change:transform;
          filter:drop-shadow(0 2px 3px rgba(15,23,42,.35)) drop-shadow(0 0 .5px rgba(15,23,42,.5)); }
        .pointer.on { opacity:1; }
        .pointer svg { display:block; width:100%; height:100%; transform-origin:5px 3px; }
        .pointer svg.press { animation:press .24s ease-out; }
        @keyframes press { 40%{transform:scale(.9)} }
        .ghost { position:fixed; left:0; top:0; width:16px; height:16px; margin:-5px 0 0 -5px; border-radius:50%; opacity:0; transition:opacity .18s linear; will-change:transform;
          background:radial-gradient(circle,rgba(99,102,241,.75),rgba(56,189,248,0) 70%); }
        .trail .ghost { opacity:var(--o); }
        .ring { position:fixed; left:0; top:0; width:0; height:0; }
        .ring::before, .ring::after { content:""; position:absolute; left:0; top:0; border-radius:50%; opacity:0; transform:translate(-50%,-50%) scale(.3); }
        .ring::before { width:30px; height:30px; border:1.5px solid rgba(37,99,235,.9); background:rgba(99,102,241,.12); }
        .ring::after { width:64px; height:64px; border:1px solid rgba(56,189,248,.55); }
        .ring.tap::before { animation:tap-in .32s cubic-bezier(.16,1,.3,1); }
        .ring.tap::after { animation:tap-out .85s cubic-bezier(.16,1,.3,1); }
        @keyframes tap-in { 0%{opacity:.9;transform:translate(-50%,-50%) scale(.3)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1)} }
        @keyframes tap-out { 0%{opacity:.5;transform:translate(-50%,-50%) scale(.3)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1)} }
        .chip { position:fixed; left:0; top:0; display:flex; align-items:center; gap:6px; max-width:260px; padding:4px 10px 4px 5px; border-radius:999px; opacity:0; transition:opacity .2s ease; will-change:transform;
          background:rgba(255,255,255,.96); color:#172033; font:600 11px/1.3 var(--font); letter-spacing:-.01em;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.6), 0 0 0 .5px rgba(15,23,42,.12), 0 6px 18px rgba(15,23,42,.16); }
        @supports (backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px)) { .chip { background:rgba(255,255,255,.8); -webkit-backdrop-filter:blur(16px) saturate(180%); backdrop-filter:blur(16px) saturate(180%); } }
        .chip.on { opacity:1; }
        .chip img { width:16px; height:16px; border-radius:50%; object-fit:contain; background:#fff; }
        .chip img[src=""] { display:none; }
        .tag { background:linear-gradient(135deg,#2563eb,#6366f1); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .say { max-width:200px; font-weight:500; font-size:12px; color:#334155; }
        .say:not(.on) { display:none; }
        .spot { position:fixed; left:0; top:0; width:0; height:0; border-radius:10px; opacity:0; transition:opacity .25s ease;
          box-shadow:0 0 0 200vmax rgba(15,23,42,.18), 0 0 0 2px rgba(56,189,248,.6), 0 0 0 7px rgba(56,189,248,.16), 0 0 28px rgba(37,99,235,.3); }
        .spot.on { opacity:1; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
      </style>
      <div class="spot"></div>
      <div class="ghosts"><i class="ghost" style="--o:.5"></i><i class="ghost" style="--o:.36"></i><i class="ghost" style="--o:.24"></i><i class="ghost" style="--o:.12"></i></div>
      <div class="pointer" aria-hidden="true"><svg viewBox="0 0 24 24">
        <path d="M5 2.5 L5 19 L9.2 15.2 L11.8 21 L14.6 19.7 L12 14 L18 13.6 Z"
          fill="#0b1220" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
      </svg></div>
      <div class="ring"></div>
      <div class="chip"><img alt="" src="${brain}"><span class="tag">SBL</span><span class="say"></span></div>`;
    shadow.innerHTML = globalThis.SBL_TT ? globalThis.SBL_TT.createHTML(LAYER_HTML) : LAYER_HTML; // policy from core/store.js (Trusted Types pages)
    (document.body || document.documentElement).appendChild(host);
    const surface = {
      host,
      pointer: shadow.querySelector(".pointer"),
      arrow: shadow.querySelector(".pointer svg"),
      ring: shadow.querySelector(".ring"),
      say: shadow.querySelector(".say"),
      chip: shadow.querySelector(".chip"),
      spot: shadow.querySelector(".spot"),
      ghostBox: shadow.querySelector(".ghosts"),
      ghosts: [...shadow.querySelectorAll(".ghost")],
      trail: null,
      at: { x: Math.round((globalThis.innerWidth || 1200) / 2), y: Math.round((globalThis.innerHeight || 800) * 0.75) },
    };
    host.__sbl = surface;
    return surface;
  }

  function frame() {
    return new Promise((resolve) => {
      let raf;
      const done = () => { clearTimeout(timer); if (raf != null) globalThis.cancelAnimationFrame?.(raf); resolve(); };
      const timer = setTimeout(done, 80); // background tabs can suspend animation frames entirely
      raf = globalThis.requestAnimationFrame?.(done);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const reduced = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // Sample until the reading is unchanged 3 times running (50ms apart); false if the ~3s cap was hit first.
  async function settle(read, sleep = wait, max = 60) {
    let last, still = 0;
    for (let tick = 0; tick < max && still < 3; tick++) {
      await sleep(50);
      const now = read();
      still = now === last ? still + 1 : 0;
      last = now;
    }
    return still >= 3;
  }

  function pointerInit(x, y, extra = {}) {
    return { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: globalThis, ...extra };
  }

  const HOST_ID = "sbl-sales-concierge-root";
  const SHELL_FRAME_ID = "sbl-shell-frame"; // the shell (step 2): the frame fills the viewport, so points over its content resolve inside the frame's document
  const firstNotHost = (elements) => elements.find((el) => el.id !== HOST_ID);
  // What is under a point, across same-origin frames: the top document answers with the frame
  // element itself; descend into it (offsetting by its box, which for the shell frame is 0,0)
  // so the harness's hands work on the page the visitor is looking at.
  function underAt(doc, x, y) {
    let els;
    try { els = doc.elementsFromPoint(x, y); } catch { return []; }
    const first = firstNotHost(els);
    if (first?.id === SHELL_FRAME_ID) {
      let inner = null;
      try { inner = first.contentDocument; } catch { inner = null; }
      if (inner) {
        const box = first.getBoundingClientRect();
        const deeper = underAt(inner, x - box.left, y - box.top);
        if (deeper.length) return deeper;
      }
    }
    return els;
  }
  // Dock helpers (pure, so tests can reach them). x is the dock's horizontal centre, y the top of its bar.
  function clampPosition(x, y, vp, size = { w: 360, h: 56 }) {
    const half = Math.min(size.w, vp.width - 16) / 2;
    return {
      x: Math.min(Math.max(x, half + 8), vp.width - half - 8),
      y: Math.min(Math.max(y, 8), Math.max(8, vp.height - size.h - 8)),
    };
  }
  // One data-state for the dock; the most demanding thing going on wins.
  function stateFor({ open, invite, listening, thinking, acting, needsUser, complete } = {}) {
    if (needsUser) return "needs-user";
    if (acting) return "acting";
    if (thinking) return "thinking";
    if (complete) return "complete";
    if (listening) return "listening";
    if (open) return "conversation";
    return invite ? "invitation" : "resting";
  }

  function createController(document) {
    const surface = createSurface(document);

    function place(point) {
      surface.at = point;
      const at = `translate(${point.x}px, ${point.y}px)`;
      surface.pointer.style.transform = at;
      surface.ring.style.transform = at;
      surface.chip.style.transform = `translate(${Math.min(point.x + 18, (globalThis.innerWidth || 1200) - 270)}px, ${point.y + 16}px)`;
      // Ghosts lag the pointer by 2, 4, 6, 8 frames; they fade in .18s once the move ends.
      if (surface.trail) {
        surface.trail.unshift(point);
        surface.trail.length = 9;
        surface.ghosts.forEach((ghost, index) => { const past = surface.trail[(index + 1) * 2]; ghost.style.transform = `translate(${past.x}px, ${past.y}px)`; });
      }
    }

    // Dim the page (~.18) around the target and ring it in a soft blue halo; the overlay is inert.
    function spotlight(element) {
      const rect = element.getBoundingClientRect();
      const radius = parseFloat(globalThis.getComputedStyle(element).borderTopLeftRadius) || 0;
      Object.assign(surface.spot.style, {
        transform: `translate(${rect.left - 4}px, ${rect.top - 4}px)`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px`,
        borderRadius: `${Math.max(8, radius + 4)}px`,
      });
      surface.spot.classList.add("on");
    }
    const clearSpotlight = () => surface.spot.classList.remove("on");

    function show(on = true) {
      surface.pointer.classList.toggle("on", on);
      surface.chip.classList.toggle("on", on);
    }

    function narrate(text) {
      surface.say.textContent = text || "";
      surface.say.classList.toggle("on", Boolean(text));
    }

    async function moveTo(target, options = {}) {
      show(true);
      if (!reduced()) { surface.trail = Array(9).fill(surface.at); surface.ghostBox.classList.add("trail"); }
      const started = Date.now();
      movement: for (const leg of withOvershoot(surface.at, target, options)) {
        for (const point of leg) {
          place(point);
          const under = underAt(document, point.x, point.y)[0];
          under?.dispatchEvent(new PointerEvent("pointermove", pointerInit(point.x, point.y, { pointerType: "mouse" })));
          await frame();
          if (Date.now() - started > 1500) { place(target); break movement; }
        }
      }
      surface.trail = null;
      surface.ghostBox.classList.remove("trail");
    }

    function pointFor(element, random = Math.random) {
      const rect = element.getBoundingClientRect();
      // Aim near the middle, not dead centre.
      return {
        x: Math.round(rect.left + rect.width * (0.38 + random() * 0.24)),
        y: Math.round(rect.top + rect.height * (0.38 + random() * 0.24)),
      };
    }

    function describeElement(element) {
      if (!element) return "nothing";
      const label = (element.getAttribute?.("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
      return `<${element.tagName.toLowerCase()}>${label ? ` "${label}"` : ""}`;
    }

    // What a real click at this point would land on. Anything else covering the
    // target — a modal, a toast, a sticky header — means a person could not click it
    // either, so the agent must deal with the obstruction rather than pretend.
    function topmostAt(point) {
      return firstNotHost(underAt(document, point.x, point.y)); // our own dock never counts as an obstruction
    }

    function hits(point, element) {
      const top = topmostAt(point);
      if (!top) return false;
      return top === element || element.contains(top) || top.contains(element);
    }

    // Coordinates are relative to the viewport, so an element below the fold has a
    // rect that is not on screen. Clicking it there would aim into empty space.
    async function ensureVisible(element, options = {}) {
      const height = globalThis.innerHeight || 800;
      const width = globalThis.innerWidth || 1200;
      let rect = element.getBoundingClientRect();
      // On screen is not enough: an option scrolled out of its own list's clipped area has a rect on screen but nothing there to hit (the click would land on the page).
      const under = topmostAt({ x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) });
      const reachable = under && (under === element || element.contains(under));
      if (reachable && rect.bottom > 40 && rect.top < height - 40 && rect.right > 0 && rect.left < width) return rect;
      element.scrollIntoView({ behavior: reduced() ? "instant" : "smooth", block: "center", inline: "nearest" });
      // Smooth scrolling has no end event, and the scroller may be an inner container: done when the element itself holds still.
      await settle(() => { const box = element.getBoundingClientRect(); return `${Math.round(box.top)},${Math.round(box.left)}`; });
      return element.getBoundingClientRect();
    }

    async function clickElement(element, options = {}) {
      await ensureVisible(element, options);
      let target = pointFor(element, options.random);
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { ok: false, reason: "not-rendered", message: "The control has no size on screen." };
      }
      // Try a few points before deciding something is in the way: rounded corners and
      // overlapping labels can hide the first pick without blocking the control.
      if (!hits(target, element)) {
        const candidates = [
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          { x: rect.left + 6, y: rect.top + rect.height / 2 },
          { x: rect.right - 6, y: rect.top + rect.height / 2 },
        ].map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));
        const reachable = candidates.find((point) => hits(point, element));
        if (reachable) target = reachable;
        else {
          const blocker = topmostAt({ x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) });
          await moveTo(target, options);
          return {
            ok: false, reason: "blocked", blockedBy: describeElement(blocker),
            message: `Something is covering that control: ${describeElement(blocker)}. Close it first.`,
          };
        }
      }

      spotlight(element);
      await moveTo(target, options);
      await wait(90 + Math.random() * 140);
      // Dispatch on what is actually under the pointer, which is what a real click hits.
      const receiver = topmostAt(target) || element;
      const init = pointerInit(target.x, target.y, { pointerType: "mouse", button: 0, buttons: 1 });
      receiver.dispatchEvent(new PointerEvent("pointerover", init));
      receiver.dispatchEvent(new MouseEvent("mouseover", init));
      receiver.dispatchEvent(new PointerEvent("pointerdown", init));
      receiver.dispatchEvent(new MouseEvent("mousedown", init));
      if (typeof element.focus === "function") element.focus({ preventScroll: true });
      for (const [node, name] of [[surface.ring, "tap"], [surface.arrow, "press"]]) {
        node.classList.remove(name);
        void node.getBoundingClientRect(); // restart the animation
        node.classList.add(name);
      }
      await wait(60 + Math.random() * 70);
      const up = pointerInit(target.x, target.y, { pointerType: "mouse", button: 0, buttons: 0 });
      receiver.dispatchEvent(new PointerEvent("pointerup", up));
      receiver.dispatchEvent(new MouseEvent("mouseup", up));
      receiver.dispatchEvent(new MouseEvent("click", up));
      clearSpotlight();
      return { ok: true, x: target.x, y: target.y };
    }

    function setValue(element, value) {
      const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    }

    // SBL writes campaign messages in a TipTap (ProseMirror) editor, which is a
    // contenteditable element. Assigning .value there does nothing at all, so text has
    // to be inserted the way a keyboard inserts it.
    function isEditable(element) {
      return Boolean(element) && (element.isContentEditable || element.classList?.contains("ProseMirror")
        || element.getAttribute?.("contenteditable") === "true");
    }

    function selectAllIn(element) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = globalThis.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function insertText(element, text) {
      // execCommand still drives the editor's own input handling, which keeps
      // ProseMirror's document model in step with what is on screen.
      const inserted = document.execCommand("insertText", false, text);
      if (inserted) return true;
      element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return false;
    }

    async function typeIntoEditable(element, text, options = {}) {
      await clickElement(element, options);
      element.focus({ preventScroll: true });
      selectAllIn(element);
      document.execCommand("delete", false);
      const visible = text.slice(0, options.maxChars ?? 90);
      for (const step of typingPlan(visible, options)) {
        insertText(element, step.character);
        // A slash opens the editor's command menu; dismiss it so it cannot swallow
        // the rest of the message.
        if (step.character === "/") element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await wait(step.delay);
      }
      if (text.length > visible.length) insertText(element, text.slice(visible.length));
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return element.textContent;
    }

    // Wheel events so virtualised lists and scroll containers react as they would to
    // a real mouse, with the pointer travelling rather than jumping.
    async function scrollBy(amount, options = {}) {
      const steps = Math.max(3, Math.min(14, Math.round(Math.abs(amount) / 120)));
      const perStep = amount / steps;
      const container = options.container || document.scrollingElement || document.documentElement;
      for (let index = 0; index < steps; index++) {
        const at = surface.at;
        const under = options.container || underAt(document, at.x, at.y)[0] || container;
        under.dispatchEvent(new WheelEvent("wheel", { deltaY: perStep, bubbles: true, cancelable: true }));
        container.scrollBy({ top: perStep, behavior: "instant" });
        await wait(40 + Math.random() * 40);
      }
      return { scrollY: globalThis.scrollY };
    }

    async function scrollToElement(element, options = {}) {
      const rect = element.getBoundingClientRect();
      const height = globalThis.innerHeight || 800;
      if (rect.top >= 60 && rect.bottom <= height - 60) return { alreadyVisible: true };
      const delta = Math.round(rect.top - height * 0.4);
      await scrollBy(delta, options);
      return { scrolled: delta, scrollY: globalThis.scrollY };
    }

    // Long text is typed for a while, then completed — a brief should not take a minute.
    async function typeInto(element, text, options = {}) {
      if (isEditable(element)) return typeIntoEditable(element, text, options);
      await clickElement(element, options);
      setValue(element, "");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      const visible = text.slice(0, options.maxChars ?? 90);
      let typed = "";
      for (const step of typingPlan(visible, options)) {
        typed += step.character;
        element.dispatchEvent(new KeyboardEvent("keydown", { key: step.character, bubbles: true }));
        setValue(element, typed);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent("keyup", { key: step.character, bubbles: true }));
        await wait(step.delay);
      }
      if (text.length > visible.length) {
        setValue(element, text);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return element.value;
    }

    return {
      moveTo, clickElement, typeInto, typeIntoEditable, isEditable, scrollBy, scrollToElement,
      ensureVisible, spotlight, clearSpotlight, hits, topmostAt, describeElement, narrate, show, place, surface, pointFor,
    };
  }

  return { frame, settle, firstNotHost, underAt, clampPosition, stateFor, easeInOut, controlPoints, bezier, path, withOvershoot, typingPlan, durationFor, distance, createController };
});
