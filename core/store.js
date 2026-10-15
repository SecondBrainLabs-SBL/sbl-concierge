// One store for everything the agent keeps, behind the chrome.storage API surface the call sites already use.
// Two backends:
// - chrome.storage when the code runs as the extension: passthrough, behaviour unchanged.
// - otherwise (script tag) our server: one JSON blob per visitor keyed by the sblv cookie, write-through cached
//   in sessionStorage so a same-tab reload reads locally even if the server is unreachable. Per-tab cosmetics
//   (dock position, proof flag) never leave the tab; the running task is per tab by nature (harness.js, sessionStorage).
(function attachStore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBLStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStore() {
  const SERVER = "http://127.0.0.1:8787"; // same base the extension's background.js proxies to
  const CACHE_KEY = "sbl_store_v1"; // sessionStorage: the write-through cache of the durable blob
  // Tab-local keys never reach the server or another tab. Anything else is durable visitor state.
  const COSMETIC = new Set(["sbl_dock_pos_v1", "sbl_proof"]);

  const ext = globalThis.chrome?.storage?.local;
  if (ext) return { local: ext, onChanged: globalThis.chrome.storage.onChanged, sblv: () => null };

  // Pages may enforce Trusted Types (the dashboard does). One policy lets our two innerHTML templates (dock, cursor) through;
  // in the extension's isolated world the page CSP never applied, so the policy there is harmless but unused.
  try { const tt = globalThis.trustedTypes?.createPolicy("sbl-agent", { createHTML: (s) => s }); if (tt) globalThis.SBL_TT = tt; } catch { /* policy name taken: the site's own default policy may already pass strings through */ }

  // ---- the visitor id (script-tag mode only): a first-party cookie so it survives restarts and is shared across tabs.
  // The handoff from the decorated sign-up link (?sblv=) is honored ONLY on the app domain and ONLY when no valid cookie
  // exists — the cookie always wins on sbl.so — and the param is stripped from the URL afterwards, so a pasted or shared
  // link cannot rebind a later visitor to the first reader's id.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  let visitorId = "";
  function sblv() {
    if (visitorId) return visitorId;
    const fromCookie = (document.cookie.match(/(?:^|;\s*)sblv=([^;]*)/) || [])[1] || "";
    const fromUrl = new URL(location.href).searchParams.get("sblv");
    if (UUID.test(fromCookie)) {
      visitorId = fromCookie;
    } else if (location.hostname === "app.secondbrainlabs.com" && UUID.test(fromUrl || "")) {
      visitorId = fromUrl;
      try {
        const u = new URL(location.href);
        u.searchParams.delete("sblv");
        history.replaceState(null, "", u);
      } catch { /* leave the param; the cookie still binds this visitor */ }
    } else {
      visitorId = crypto.randomUUID();
    }
    document.cookie = `sblv=${visitorId}; max-age=31536000; path=/; SameSite=Lax`;
    return visitorId;
  }

  // The id rides every link the page points at app.secondbrainlabs.com: rewritten with the URL API as the
  // anchor appears (sbl.so's own scripts navigate from pointer events and the click event never fires on
  // them — measured in step 2's probes — so a click-time-only decoration misses real visitors' clicks).
  // The capture listener stays: it covers anchors created and clicked between passes, and idempotent rewrites.
  if (typeof document !== "undefined") {
    const decorate = (a) => {
      let u; try { u = new URL(a.href, location.href); } catch { return; }
      if (u.hostname !== "app.secondbrainlabs.com" || u.searchParams.has("sblv")) return;
      u.searchParams.set("sblv", sblv());
      a.href = u.href;
    };
    document.addEventListener("click", (event) => {
      const a = event.target?.closest?.("a[href]");
      if (a) decorate(a);
    }, true);
    const decorateAll = () => { try { for (const a of document.querySelectorAll('a[href*="app.secondbrainlabs.com"]')) decorate(a); } catch { /* a page that rewrites itself under us: the next pass retries */ } };
    decorateAll();
    const pass = setInterval(decorateAll, 1000);
    try { pass.unref?.(); } catch { /* a number in the browser */ }
  }

  // ---- the durable blob: cache first (sync), server truth on boot ----
  const cache = (() => { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}") || {}; } catch { return {}; } })();
  const dirty = new Set(); // keys this tab has set since boot: a late hydrate must never overwrite them, and a push includes them
  const saveCache = () => { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full or blocked */ } };
  const durableOnly = () => { const d = {}; for (const [k, v] of Object.entries(cache)) if (!COSMETIC.has(k)) d[k] = v; return d; };
  let hydrated = false; // the server blob read at least once: nothing is pushed before that, so a partial blob can never replace it
  let failures = 0; // consecutive failed hydrates; bounds the timer-driven retries (a durable push retries on demand regardless)
  let hydrating = null;
  let retryTimer = null;
  function hydrate() {
    if (hydrated) return Promise.resolve();
    if (hydrating) return hydrating;
    hydrating = fetch(`${SERVER}/store?sblv=${sblv()}`, { signal: AbortSignal.timeout(3000) })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(({ data }) => {
        hydrated = true;
        failures = 0;
        // A task cleared on the app must also disappear from the website's older session cache.
        if (!dirty.has("sbl_task_v1") && !Object.hasOwn(data || {}, "sbl_task_v1")) delete cache.sbl_task_v1;
        for (const [k, v] of Object.entries(data && typeof data === "object" ? data : {})) if (!dirty.has(k)) cache[k] = v;
        saveCache();
      })
      .catch(() => { failures++; }) // offline or a pending LNA prompt: the sessionStorage cache answers meanwhile
      .finally(() => {
        hydrating = null;
        if (!hydrated && !retryTimer && failures < 5) { // bounded backoff; a push retries on demand without waiting for the timer
          retryTimer = setTimeout(() => { retryTimer = null; hydrate().then(flushPending, flushPending); }, 2000);
          try { retryTimer.unref?.(); } catch { /* a number in the browser */ }
        }
      });
    return hydrating;
  }
  let pushing = false;
  let pendingPush = false;
  async function flushPending() {
    if (!hydrated || pushing || !pendingPush) return;
    pendingPush = false;
    pushing = true;
    try {
      const body = JSON.stringify(durableOnly());
      const r = await fetch(`${SERVER}/store?sblv=${sblv()}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(5000),
        ...(body.length <= 60_000 ? { keepalive: true } : {}), // a navigation (the app hop) must not abort the PUT; the keepalive body cap is 64 KB
      });
      if (!r.ok) { pendingPush = true; console.warn(`sbl store: server kept nothing (${r.status}); blob may exceed the cap`); }
    } catch { pendingPush = true; } // offline: the cache holds it; the next save or hydrate retries
    finally {
      pushing = false;
      if (pendingPush && hydrated) flushPending(); // a save landed during the PUT: flush once more
    }
  }
  async function push() {
    pendingPush = true;
    await hydrate(); // retry on demand: never push a partial blob over the server's
    await flushPending();
  }

  // ---- chrome.storage.local-shaped API ----
  const listeners = new Set();
  const fire = (changes) => { for (const fn of listeners) { try { fn(changes, "local"); } catch {} } };
  async function get(keys) {
    const want = keys == null ? Object.keys(cache) : Array.isArray(keys) ? keys : [keys];
    if (want.some((k) => !COSMETIC.has(k))) await hydrate(); // cosmetics are answered from the tab cache alone
    const out = {};
    for (const k of want) if (k in cache) out[k] = cache[k];
    return out;
  }
  async function set(obj) {
    const changes = {};
    for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: cache[k], newValue: v }; cache[k] = v; dirty.add(k); }
    saveCache();
    fire(changes);
    if (Object.keys(obj).some((k) => !COSMETIC.has(k))) push();
  }
  async function remove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    const changes = {};
    for (const k of list) { if (!(k in cache)) continue; changes[k] = { oldValue: cache[k] }; delete cache[k]; dirty.add(k); }
    if (!Object.keys(changes).length) return;
    saveCache();
    fire(changes);
    if (list.some((k) => !COSMETIC.has(k))) push();
  }

  return { local: { get, set, remove }, onChanged: { addListener: (fn) => listeners.add(fn) }, sblv };
});