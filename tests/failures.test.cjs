const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { cleanup, agents, scripts, build } = require("./fake-engine.cjs");
const Router = require("../core/router.js");
require("../core/site-map.js"); // the harness only routes when the site index is loaded

// T50 / FR-6, NFR-13, AC-7: every failure ends the turn with one honest line. Docs: docs/FAILURES.md.
test.afterEach(cleanup);
const UNAVAILABLE = "My assistant is temporarily unavailable, so I cannot do this right now. Please try again in a little while.";
const CAPPED = "I am getting a lot of questions at once. Give me a few seconds and ask again.";
const make = (route, over = {}) => build({ route, limits: { hold: 5, ...over.limits }, ...over });
const errors = (events) => events.filter((e) => e.k === "error").map((e) => e.detail);
const ends = (events) => events.filter((e) => e.k === "turn_end").map((e) => e.status);

// ---- the page: routeCall ----
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
function page({ proof = false, fault = null, ext = true, answer, fetch }) {
  const src = read("content.js"), from = src.indexOf("  // Fault injection"), to = src.indexOf("  // Visitor memory");
  assert.ok(from > 0 && to > from, "the page's server calls are where this test expects them");
  const sent = [];
  const make = new Function("SERVER", "proof", "sessionStorage", "SBLRouter", "fetch", `${src.slice(from, to)}; return { routeCall, serverRaw, setHeaders: (fn) => visitorHeaders = fn };`);
  globalThis.chrome = ext ? { runtime: { id: "x", sendMessage: async (m) => { sent.push(m); return answer; } } } : undefined;
  return { ...make("http://s", proof, { getItem: (k) => (k === "sbl_fault" ? fault : null) }, Router, async (url, init) => { sent.push({ url, headers: init.headers }); return fetch(); }), sent };
}
test.after(() => { delete globalThis.chrome; });

test("routeCall (extension): the server's answer becomes a failure code; ok with no route stays null", async () => {
  const code = async (status, body, ok = false) => (await page({ answer: { ok, status, body } }).routeCall({}, {}));
  assert.deepEqual(await code(403, { error: { code: "assistant_unavailable" } }), { failed: "unavailable" });
  assert.deepEqual(await code(401, {}), { failed: "unavailable" });
  assert.deepEqual(await code(429, { code: "visitor_cap" }), { failed: "capped" });
  assert.deepEqual(await code(429, { code: "global_cap" }), { failed: "capped" });
  assert.deepEqual(await code(502, { error: "x" }), { failed: "down" });
  assert.deepEqual(await code(504, {}), { failed: "down" });
  assert.deepEqual(await code(0, { error: "Server unreachable" }), { failed: "down" });
  assert.deepEqual(await code(403, { error: "Unexpected request origin" }), { failed: "down" }, "unknown is down");
  assert.deepEqual(await code(429, {}), { failed: "down" });
  assert.equal(await code(200, { route: null }, true), null);
  assert.deepEqual(await code(200, { route: { line: "hi" } }, true), { line: "hi" });
});

test("routeCall (script tag): the same codes from fetch statuses, a network error and a stream error are all down or the code", async () => {
  const code = (fetch) => page({ ext: false, fetch }).routeCall({}, {});
  const json = (status, body) => () => new Response(JSON.stringify(body), { status });
  assert.deepEqual(await code(json(403, { error: { code: "assistant_unavailable" } })), { failed: "unavailable" });
  assert.deepEqual(await code(json(429, { code: "visitor_cap" })), { failed: "capped" });
  assert.deepEqual(await code(json(502, {})), { failed: "down" });
  assert.deepEqual(await code(() => { throw new TypeError("fetch failed"); }), { failed: "down" });
  assert.deepEqual(await code(() => new Response('data: {"error":"The model took too long."}\n\n', { status: 200 })), { failed: "down" });
  assert.deepEqual(await code(() => new Response('data: {"line":"Hi"}\n\ndata: {"route":null}\n\n', { status: 200 })), null);
});

test("the fault header is sent only in proof mode with sbl_fault set (both transports)", async () => {
  const ok = { ok: true, status: 200, body: { route: null } }, stream = () => new Response('data: {"route":null}\n\n');
  const ext = async (o) => { const p = page({ answer: ok, ...o }); await p.routeCall({}, {}); return p.sent[0].headers?.["X-SBL-Fault"]; };
  const tag = async (o) => { const p = page({ ext: false, fetch: stream, ...o }); await p.routeCall({}, {}); return p.sent[0].headers["X-SBL-Fault"]; };
  for (const via of [ext, tag]) {
    assert.equal(await via({ proof: true, fault: "down" }), "down");
    assert.equal(await via({ proof: false, fault: "down" }), undefined, "no proof flag: never sent");
    assert.equal(await via({ proof: true, fault: null }), undefined, "no fault set: not sent");
  }
  assert.match(read("background.js"), /X-SBL-\(V\|Turn\|Fault\)/, "the extension's background forwards it");
  assert.match(read("server.mjs"), /Access-Control-Allow-Headers": "Content-Type, Authorization, X-SBL-V, X-SBL-Turn, X-SBL-Fault"/);
});

// ---- the harness ----
test("unavailable and capped: one fixed line at once, an error event with the code, no engine, the turn ends failed", async () => {
  for (const [failed, line] of [["unavailable", UNAVAILABLE], ["capped", CAPPED]]) {
    cleanup();
    const { h, said, events } = make(async () => ({ failed }));
    const t0 = Date.now();
    await h.hear("what does the pricing look like");
    assert.ok(Date.now() - t0 < 100, `${failed}: the line is not waiting on a timer`);
    assert.deepEqual(said, [line]);
    assert.equal(agents.length, 0, `${failed}: the engine would fail the same way, so none was created`);
    assert.deepEqual(errors(events), [failed]);
    assert.deepEqual(ends(events), ["failed"]);
  }
});

test("down: the engine runs the turn; if its model call fails too the visitor gets the unavailable line, once", async () => {
  for (const data of ["Server error: bad gateway", "Network request failed", "Authentication failed: assistant_unavailable", "HTTP 503: x"]) {
    cleanup();
    const { h, said } = make(async () => ({ failed: "down" }));
    scripts.push([{ fail: data }]);
    await h.hear("what does the pricing look like");
    assert.equal(agents.length, 1, "down keeps the engine fallback");
    assert.deepEqual(said, [UNAVAILABLE], data);
  }
});

test("down and a hung engine: the short watchdog ends the turn with the unavailable line, not the generic one", async () => {
  const { h, said, events } = make(async () => ({ failed: "down" }), { limits: { downWatchdog: 40 } });
  scripts.push([{ hang: true }]);
  await h.hear("what does the pricing look like");
  assert.deepEqual(said, [UNAVAILABLE]);
  assert.deepEqual(ends(events), ["failed"]);
});

test("down and a working engine: the engine's answer is what the visitor reads", async () => {
  const { h, said } = make(async () => ({ failed: "down" }));
  scripts.push([{ name: "done", args: { text: "Pro is $189.", success: true } }]);
  await h.hear("what does the pricing look like");
  assert.deepEqual(said, ["Pro is $189."]);
});

// ---- the server ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function boot(name, port, env) {
  for (const k of ["OPENAI_API_KEY", "ALLOW_FAULTS", "FAULT_SLOW_MS"]) delete process.env[k];
  Object.assign(process.env, { PORT: String(port), TRACE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "sbl-fail-")), ...env });
  const mod = await import(`../server.mjs?${name}`);
  if (!mod.server.listening) await new Promise((r) => mod.server.once("listening", r));
  return { mod, base: `http://127.0.0.1:${port}` };
}
const post = (base, p, headers = {}) => fetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://sbl.so", "X-SBL-V": "vis-1", ...headers }, body: JSON.stringify({ message: "which plan?", url: "https://sbl.so/", title: "Home", conversation: [], stream: false }) });
const PATHS = ["/agent/route", "/agent/chat", "/agent/note"];

test("no key: the three model endpoints answer 403 with the unavailable code at once, no upstream call", async (t) => {
  const realFetch = globalThis.fetch; let upstream = 0;
  globalThis.fetch = async (url, init) => (String(url).includes("api.openai.com") ? (upstream++, new Response("", { status: 500 })) : realFetch(url, init));
  const { mod, base } = await boot("nokey", 8802, {});
  t.after(() => { globalThis.fetch = realFetch; mod.server.close(); });
  for (const p of PATHS) {
    const t0 = Date.now(), r = await post(base, p);
    assert.equal(r.status, 403, p);
    assert.equal((await r.json()).error.code, "assistant_unavailable", p);
    assert.ok(Date.now() - t0 < 1000, `${p} answers at once`);
  }
  assert.equal(upstream, 0);
  assert.equal((await (await fetch(`${base}/health`)).json()).liveConfigured, false);
});

test("X-SBL-Fault is honoured only when the server started with ALLOW_FAULTS=1", async (t) => {
  const realFetch = globalThis.fetch; let upstream = 0;
  globalThis.fetch = async (url, init) => (String(url).includes("api.openai.com") ? (upstream++, new Response("", { status: 500 })) : realFetch(url, init));
  t.after(() => { globalThis.fetch = realFetch; });
  const on = await boot("faults-on", 8803, { OPENAI_API_KEY: "k", ALLOW_FAULTS: "1", FAULT_SLOW_MS: "60" });
  for (const p of PATHS) {
    let r = await post(on.base, p, { "X-SBL-Fault": "unavailable" });
    assert.deepEqual([r.status, (await r.json()).error.code], [403, "assistant_unavailable"], p);
    r = await post(on.base, p, { "X-SBL-Fault": "capped" });
    assert.deepEqual([r.status, (await r.json()).code], [429, "visitor_cap"], p);
    r = await post(on.base, p, { "X-SBL-Fault": "down" });
    assert.equal(r.status, 502, p);
    const t0 = Date.now(); r = await post(on.base, p, { "X-SBL-Fault": "slow" });
    assert.equal(r.status, 504, p);
    assert.ok(Date.now() - t0 >= 50, "slow waits first");
  }
  assert.equal(upstream, 0, "a fault never calls upstream");
  on.mod.server.close();
  const off = await boot("faults-off", 8804, { OPENAI_API_KEY: "k" });
  t.after(() => off.mod.server.close());
  for (const f of ["unavailable", "capped", "down", "slow"]) {
    const r = await post(off.base, "/agent/route", { "X-SBL-Fault": f });
    assert.equal(r.status, 502, `${f}: ignored; the (stubbed, failing) upstream answered`);
  }
  assert.equal(upstream, 4, "the header was ignored, so the model was called each time");
  await sleep(0);
});

// ---- the suite ----
const P = () => import("../tools/experience/personas.mjs");
const S = () => import("../tools/experience/score.mjs");
test("persona schema: fault steps and replyWithinMs; the faults persona validates", async () => {
  const { validatePersona, loadPersonas } = await P();
  const mk = (step) => ({ id: "x", description: "d", start: "https://sbl.so/", steps: [{ do: "say", text: "hi", tags: [], expect: {}, ...step }] });
  for (const code of ["unavailable", "capped", "down", "slow", null]) assert.deepEqual(validatePersona(mk({ do: "fault", text: undefined, code })), [], String(code));
  assert.ok(validatePersona(mk({ do: "fault", code: "bogus" })).some((m) => /fault needs code/.test(m)));
  assert.ok(validatePersona(mk({ do: "fault" })).some((m) => /fault needs code/.test(m)), "a missing code is not null");
  assert.deepEqual(validatePersona(mk({ expect: { replyWithinMs: 3000, honest: "unavailable" } })), []);
  assert.ok(validatePersona(mk({ expect: { replyWithinMs: -1 } })).some((m) => /replyWithinMs/.test(m)));
  const [f] = loadPersonas("faults");
  assert.deepEqual(f.steps.filter((s) => s.do === "fault").map((s) => s.code), ["unavailable", "capped", "down", "slow", null]);
  for (const s of f.steps.filter((x) => x.do === "say").slice(0, 4)) assert.ok(s.expect.mustReply && s.expect.maxLines === 1 && s.expect.noNav && s.expect.replyWithinMs && s.expect.honest);
});

test("scorer: E8.late counts steps whose first line came after replyWithinMs; honestMiss checks the regex", async () => {
  const { scoreRuns, honestMiss } = await S();
  const say = (firstLineMs, lines, expect) => ({ do: "say", persona: "f", lines: lines ?? [{ text: "My assistant is temporarily unavailable." }], firstLineMs, expect });
  const steps = [say(2900, 0, { replyWithinMs: 3000 }), say(3100, 0, { replyWithinMs: 3000 }), say(9000, 0, {}), say(11000, 0, { replyWithinMs: 12000 }), say(13000, 0, { replyWithinMs: 12000, honest: "nothing like this" })];
  const row = (id) => scoreRuns([{ run: 1, steps }]).rows.find((r) => r.id === id);
  assert.equal(row("E8.late").mean, 2);
  assert.equal(honestMiss(steps[4]), true);
  assert.equal(honestMiss(steps[0]), false);
  assert.equal(steps.filter(honestMiss).length, 1);
});

test("gate faults: passes on a clean run, fails on a late reply, a silent turn, an honest miss, and says so with exit 1 when there is no faults run", () => {
  const gate = (dir) => spawnSync(process.execPath, [path.join(__dirname, "../tools/experience/gate.mjs"), "faults"], { env: { ...process.env, SBL_EXP_DIR: dir }, encoding: "utf8" });
  const run = (steps) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbl-gate-")), d = path.join(dir, "2026-10-13", "faults", "faults", "run-1");
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "steps.json"), JSON.stringify({ persona: "faults", set: "faults", run: 1, steps }));
    return dir;
  };
  const say = (over = {}, expect = {}) => ({ do: "say", text: "q", lines: [{ atMs: 900, text: "My assistant is temporarily unavailable." }], firstLineMs: 900, actions: [], url: "https://sbl.so/", urlBefore: "https://sbl.so/", dockExists: true, tags: [], expect: { mustReply: true, replyWithinMs: 3000, honest: "unavailable", noNav: true, ...expect }, ...over });
  let r = gate(run([say(), { do: "fault", code: null, lines: [], actions: [], dockExists: true, tags: [], expect: {} }]));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /PASS faults/);
  r = gate(run([say({ firstLineMs: 3500 })]));
  assert.equal(r.status, 1); assert.match(r.stdout, /late=1/);
  r = gate(run([say({ lines: [], firstLineMs: null })]));
  assert.equal(r.status, 1); assert.match(r.stdout, /silent=1/);
  r = gate(run([say({ lines: [{ atMs: 5, text: "I lost my thread." }] })]));
  assert.equal(r.status, 1); assert.match(r.stdout, /honestMisses=1/);
  r = gate(run([say({ url: "https://sbl.so/pricing/" })]));
  assert.equal(r.status, 1); assert.match(r.stdout, /nav=1/);
  r = gate(fs.mkdtempSync(path.join(os.tmpdir(), "sbl-gate-empty-")));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /no faults run found/);
});


test("all feature calls carry the same visitor identity on both transports", async () => {
  for (const ext of [true, false]) {
    const p = page({ ext, answer: { ok: true, status: 200, body: {} }, fetch: () => new Response("{}") });
    p.setHeaders(() => ({ "X-SBL-V": "visitor-1" }));
    for (const endpoint of ["/respond", "/session", "/research"]) await p.serverRaw(endpoint, {});
    assert.equal(p.sent.length, 3);
    for (const req of p.sent) assert.equal(req.headers["X-SBL-V"], "visitor-1");
  }
});
