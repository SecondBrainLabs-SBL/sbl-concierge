const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// T51 / NFR-13: the model-call cap is per visitor (X-SBL-V), with a global ceiling that only bounds cost. In-process server, stubbed upstream, a controlled clock.
test("capacity: one visitor at the cap is refused while another is served; refusals do not count; the window rolls; the global ceiling applies; idle entries are swept", async (t) => {
  Object.assign(process.env, { PORT: "8801", OPENAI_API_KEY: "test-key", TRACE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "sbl-cap-")), CAP_PER_VISITOR: "3", CAP_GLOBAL: "5" });
  const realFetch = globalThis.fetch, realNow = Date.now;
  let upstream = 0, clock = realNow();
  globalThis.fetch = async (url, init) => (String(url).includes("api.openai.com") ? (upstream++, new Response("", { status: 500 })) : realFetch(url, init));
  Date.now = () => clock;
  const mod = await import("../server.mjs?cap");
  if (!mod.server.listening) await new Promise((r) => mod.server.once("listening", r));
  t.after(() => { globalThis.fetch = realFetch; Date.now = realNow; mod.server.close(); });
  const base = "http://127.0.0.1:8801";
  const route = (v, path = "/agent/route") => realFetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://sbl.so", ...(v ? { "X-SBL-V": v } : {}) }, body: JSON.stringify({ message: "which plan?", url: "https://sbl.so/", title: "Home", conversation: [], stream: false }) });
  const code = async (r) => (r.status === 429 ? (await r.json()).code : null);

  for (let i = 0; i < 3; i++) assert.notEqual((await route("vis-A")).status, 429, `A call ${i + 1} is let through`);
  const refused = await route("vis-A");
  assert.equal(refused.status, 429);
  assert.equal((await refused.json()).code, "visitor_cap");
  const before = upstream;
  assert.equal(await code(await route("vis-A")), "visitor_cap");
  assert.equal(upstream, before, "a refused call never reaches the model");
  for (let i = 0; i < 2; i++) assert.notEqual((await route("vis-B")).status, 429, "B is served while A is capped");

  assert.equal(await code(await route("vis-B")), "global_cap", "5 calls in the window: the global ceiling answers the next one, whoever asks");
  assert.equal(await code(await route("vis-C")), "global_cap");

  clock += 59_000;
  assert.equal(await code(await route("vis-A")), "visitor_cap", "still inside A's window");
  clock += 1_001;
  assert.notEqual((await route("vis-A")).status, 429, "refused calls did not extend the block: A's window rolled 60 s after its first call");

  clock += 120_000; // everyone is idle
  assert.notEqual((await route("vis-D")).status, 429);
  assert.equal(mod.visitorCount(), 1, "idle visitors were swept; only D remains");

  for (let i = 0; i < 3; i++) assert.notEqual((await route(null)).status, 429, "no header: keyed by origin + address");
  assert.equal(await code(await route(null)), "visitor_cap");
  assert.notEqual((await route("vis-E")).status, 429, "a visitor with a header is not the header-less key");

  clock += 120_000;
  const note = (v) => realFetch(`${base}/agent/note`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://sbl.so", "X-SBL-V": v }, body: "{}" });
  for (let i = 0; i < 30; i++) assert.equal((await note("vis-N")).status, 400, "an empty note body is read and rejected, not capped");
  assert.equal(await code(await note("vis-N")), "visitor_cap", "notes: 30 a minute per visitor");
  assert.equal((await note("vis-M")).status, 400, "another visitor's notes are unaffected");
  assert.notEqual((await route("vis-N")).status, 429, "notes do not use up the router's allowance");
  for (const endpoint of ["/respond", "/session", "/research"]) {
    clock += 120_000;
    const post = (v, body = {}) => realFetch(`${base}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://sbl.so", "X-SBL-V": v }, body: JSON.stringify(body) });
    const before = upstream;
    for (let i = 0; i < 3; i++) assert.notEqual((await post("feature-A")).status, 429);
    assert.equal(await code(await post("feature-A")), "visitor_cap", endpoint);
    assert.notEqual((await post("feature-B")).status, 429, `${endpoint}: B unaffected`);
    assert.equal(upstream, before, "invalid and capped requests never reach upstream");
  }

});
