const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// The store adapter: chrome.storage passthrough in the extension, and in script-tag mode the server blob
// (keyed by sblv) with a sessionStorage write-through cache and per-tab cosmetics.

// Fresh module per scenario: the adapter captures its backend and cache at load time.
let epoch = 0;
function load(env) {
  for (const name of ["chrome", "document", "location", "history", "sessionStorage", "fetch"]) delete globalThis[name];
  // Retry timers from an older instance must not answer a newer scenario's fake: only the current epoch's fetch responds.
  const myEpoch = ++epoch;
  globalThis.__sblEpoch = myEpoch;
  Object.assign(globalThis, env); // crypto is node's own (randomUUID): same call the browser makes
  if (env.fetch) {
    const mine = env.fetch;
    globalThis.fetch = (url, opts) => (globalThis.__sblEpoch === myEpoch ? mine(url, opts) : Promise.reject(new Error("stale epoch")));
  }
  const file = path.resolve(__dirname, "../core/store.js");
  delete require.cache[file];
  return require(file);
}

const session = () => {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};
const UUID = "11111111-1111-4111-8111-111111111111";
const base = (over = {}) => ({
  sessionStorage: session(),
  document: { cookie: "", addEventListener() {} },
  location: { href: "https://sbl.so/", hostname: "sbl.so" },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ data: null }) }),
  ...over,
});

test("as the extension it is chrome.storage itself: behaviour unchanged", () => {
  const local = { get: async () => ({}) };
  const onChanged = { addListener() {} };
  const store = load({ chrome: { storage: { local, onChanged } } });
  assert.equal(store.local, local);
  assert.equal(store.onChanged, onChanged);
  assert.equal(store.sblv(), null, "no visitor id in extension mode: the decoration stays off");
});

test("script tag: durable keys go to the server blob and the sessionStorage cache, cosmetics stay in the tab", async () => {
  const puts = [];
  const store = load(base({ fetch: async (url, opts = {}) => {
    if (opts.method === "PUT") puts.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ data: null }) };
  } }));
  const changes = [];
  store.onChanged.addListener((c, area) => changes.push([area, c]));

  await store.local.set({ sbl_sales_concierge_memory_v1: { turns: 2 } });
  await store.local.set({ sbl_proof: true }); // cosmetic: cached, never pushed
  await store.local.set({ sbl_dock_pos_v1: { x: 1, y: 2 } });
  await new Promise((r) => setTimeout(r, 25)); // the push is fire-and-forget: let the flush land

  assert.deepEqual(puts.map((p) => Object.keys(p)), [["sbl_sales_concierge_memory_v1"]], "one durable set, one push; cosmetic keys never reach the server");
  assert.deepEqual(await store.local.get("sbl_proof"), { sbl_proof: true });
  assert.deepEqual(await store.local.get(["sbl_sales_concierge_memory_v1", "sbl_dock_pos_v1", "absent"]), { sbl_sales_concierge_memory_v1: { turns: 2 }, sbl_dock_pos_v1: { x: 1, y: 2 } });
  const cached = JSON.parse(globalThis.sessionStorage.getItem("sbl_store_v1"));
  assert.deepEqual(cached.sbl_dock_pos_v1, { x: 1, y: 2 }, "write-through cache holds cosmetics too");
  assert.deepEqual(changes[0], ["local", { sbl_sales_concierge_memory_v1: { oldValue: undefined, newValue: { turns: 2 } } }], "onChanged fires in-tab, chrome-shaped");

  await store.local.remove("sbl_sales_concierge_memory_v1");
  await new Promise((r) => setTimeout(r, 25));
  assert.deepEqual(await store.local.get("sbl_sales_concierge_memory_v1"), {});
  assert.deepEqual(puts.at(-1), {}, "the server blob drops the removed key");
});

test("script tag: a failed hydrate is retried, nothing is pushed before one succeeds, and dirty keys win the late merge", async () => {
  // The server is down at boot and for the first save: the queue must hold, then drain once the server answers,
  // without the server's (older) copy of a locally dirty key overwriting what this tab has.
  const puts = [];
  let serverUp = false;
  const serverData = { sbl_customer_file_v1: { visitor: "SERVER copy" }, sbl_read_v1: { note: "server note" } };
  const store = load(base({ fetch: async (url, opts = {}) => {
    if (opts.method === "PUT") {
      if (!serverUp) throw new Error("down");
      puts.push(JSON.parse(opts.body));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (!serverUp) throw new Error("down");
    return { ok: true, status: 200, json: async () => ({ data: serverUp ? serverData : null }) };
  } }));
  await store.local.set({ sbl_customer_file_v1: { visitor: "LOCAL copy" } }); // durable: push waits for the hydrate
  assert.equal(puts.length, 0, "no PUT while the hydrate has never succeeded");

  serverUp = true; // the retry (on demand from the queued push) now lands
  await store.local.set({ sbl_sales_concierge_memory_v1: { turns: 1 } }); // a second save: retried hydrate + flushed queue
  for (let i = 0; i < 120 && !puts.length; i++) await new Promise((r) => setTimeout(r, 25)); // the drain may ride the 2s retry timer
  assert.ok(puts.length >= 1, "the queued push drains once the hydrate succeeds");
  const blob = puts.at(-1);
  assert.equal(blob.sbl_customer_file_v1.visitor, "LOCAL copy", "the late hydrate did not overwrite the dirty key");
  assert.equal(blob.sbl_read_v1.note, "server note", "the late hydrate merged the key this tab never touched");
  assert.deepEqual(await store.local.get("sbl_customer_file_v1"), { sbl_customer_file_v1: { visitor: "LOCAL copy" } });
});

test("script tag: the server blob hydrates a new tab (continuity), and the cache answers when the server is down", async () => {
  const sess = session(); // one sessionStorage: the same tab across a reload
  const store = load(base({ sessionStorage: sess, fetch: async () => ({ ok: true, status: 200, json: async () => ({ data: { sbl_customer_file_v1: { visitor: "likes demos" } } }) }) }));
  assert.deepEqual(await store.local.get("sbl_customer_file_v1"), { sbl_customer_file_v1: { visitor: "likes demos" } });

  // Same tab, server unreachable: the sessionStorage cache written by the hydrate still answers.
  const store2 = load(base({ sessionStorage: sess, fetch: async () => { throw new Error("down"); } }));
  assert.deepEqual(await store2.local.get("sbl_customer_file_v1"), { sbl_customer_file_v1: { visitor: "likes demos" } });
});

test("the visitor id: cookie wins; the handoff param only on the app domain, stripped after adoption", () => {
  const store = load(base());
  const first = store.sblv();
  assert.match(first, /^[0-9a-f-]{36}$/);
  assert.match(globalThis.document.cookie, new RegExp(`sblv=${first}`), "a first-party cookie carries it");
  assert.equal(store.sblv(), first, "stable for the document's life");

  // sbl.so: a ?sblv= param is ignored entirely — the cookie (or a fresh id) wins always.
  const onSite = load(base({ location: { href: `https://sbl.so/pricing/?sblv=${UUID}`, hostname: "sbl.so" } }));
  const siteId = onSite.sblv();
  assert.match(siteId, /^[0-9a-f-]{36}$/);
  assert.notEqual(siteId, UUID, "the param is not adopted on sbl.so");

  // app domain, no valid cookie yet: the decorated sign-up link's id is adopted and stripped from the URL.
  const replacements = [];
  const handed = load(base({
    location: { href: `https://app.secondbrainlabs.com/signup?coupon=SBL20&sblv=${UUID}`, hostname: "app.secondbrainlabs.com" },
    history: { replaceState: (_s, _t, url) => replacements.push(String(url)) },
  }));
  assert.equal(handed.sblv(), UUID, "the sign-up link's id wins where no cookie exists");
  assert.equal(replacements.length, 1, "history.replaceState removes the handoff param");
  assert.ok(!replacements[0].includes("sblv="), "the URL no longer carries it");

  // app domain with a valid cookie: the cookie wins, the param is neither adopted nor touched.
  const withCookie = load(base({
    document: { cookie: `sblv=${UUID}; path=/`, addEventListener() {} },
    location: { href: "https://app.secondbrainlabs.com/signup?sblv=22222222-2222-4222-8222-222222222222", hostname: "app.secondbrainlabs.com" },
    history: { replaceState: (_s, _t, url) => replacements.push(String(url)) },
  }));
  assert.equal(withCookie.sblv(), UUID, "an existing valid cookie beats the param");
  assert.equal(replacements.length, 1, "no replaceState when nothing was adopted");

  const junk = load(base({ location: { href: "https://app.secondbrainlabs.com/signup?sblv=not-a-uuid", hostname: "app.secondbrainlabs.com" } }));
  assert.notEqual(junk.sblv(), "not-a-uuid", "a malformed param is ignored, not adopted");
});
test("returning from the app cannot resurrect a task absent from the server", async () => {
  const tab = session();
  tab.setItem('sbl_store_v1', JSON.stringify({ sbl_task_v1: { goal: 'old campaign' }, sbl_proof: true }));
  const store = load(base({ sessionStorage: tab }));
  assert.deepEqual(await store.local.get('sbl_task_v1'), {});
  assert.equal(JSON.parse(tab.getItem('sbl_store_v1')).sbl_task_v1, undefined);
  assert.equal((await store.local.get('sbl_proof')).sbl_proof, true);
});

test("a task started locally during hydration survives an empty server response", async () => {
  let release;
  const response = new Promise(r => { release = r; });
  const store = load(base({ fetch: async (_url, options = {}) => options.method === 'PUT'
    ? { ok: true, json: async () => ({}) } : response }));
  const pending = store.local.get('sbl_task_v1');
  await store.local.set({ sbl_task_v1: { goal: 'new campaign' } });
  release({ ok: true, json: async () => ({ data: {} }) });
  assert.deepEqual(await pending, { sbl_task_v1: { goal: 'new campaign' } });
});
