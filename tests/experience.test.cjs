// Persona files, schema, hard limits, dev/holdout separation, and the driver's pure pieces (no browser).
const test = require("node:test");
const assert = require("node:assert");
const P = () => import("../tools/experience/personas.mjs");
const D = () => import("../tools/experience/driver.mjs");

test("every persona file validates (known keys, regexes compile, hard limits)", async () => {
  const { SETS, loadPersonas, validatePersona } = await P();
  let n = 0;
  for (const set of SETS) for (const p of loadPersonas(set)) {
    n++;
    assert.deepStrictEqual(validatePersona(p), [], `${set}/${p.file}`);
    if (set !== "replay") assert.ok(p.steps.length >= 6 && p.steps.length <= 10, `${p.id}: ${p.steps.length} steps`);
  }
  assert.strictEqual(loadPersonas("dev").length, 6);
  assert.strictEqual(loadPersonas("holdout").length, 4);
  assert.strictEqual(loadPersonas("replay").length, 1);
  assert.ok(n >= 11);
});

test("validator rejects unknown keys, bad regexes, hard-limit wording, foreign emails", async () => {
  const { validatePersona } = await P();
  const mk = (step) => ({ id: "x", description: "d", start: "https://sbl.so/", steps: [{ do: "say", text: "hi", tags: [], expect: {}, ...step }] });
  assert.ok(validatePersona(mk({ expect: { bogus: 1 } })).some((m) => /unknown key bogus/.test(m)));
  assert.ok(validatePersona(mk({ expect: { landsOn: "(" } })).some((m) => /does not compile/.test(m)));
  assert.ok(validatePersona(mk({ text: "my password is hunter2" })).some((m) => /hard limit/.test(m)));
  assert.ok(validatePersona(mk({ text: "email me at a@b.com" })).some((m) => /email other than/.test(m)));
  assert.deepStrictEqual(validatePersona(mk({ text: "use proof.test@uberip.com" })), []);
  assert.ok(validatePersona(mk({ do: "goto", url: "https://sbl.so/signup" })).some((m) => /signup/.test(m)));
  assert.ok(validatePersona(mk({ expect: { decisionGroup: "g", decisionPattern: "a|b" } })).some((m) => /one capture group/.test(m)));
});

test("dev and holdout share no identical say text", async () => {
  const { loadPersonas } = await P();
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const say = (set) => new Set(loadPersonas(set).flatMap((p) => p.steps.filter((s) => s.do === "say").map((s) => norm(s.text))));
  const dev = say("dev");
  for (const t of say("holdout")) assert.ok(!dev.has(t), `shared: ${t}`);
});

test("replay persona is the founder's visitor lines in order, every one must be answered in at most 2 lines", async () => {
  const { loadPersonas } = await P();
  const [r] = loadPersonas("replay");
  assert.strictEqual(r.steps[0].text, "hey");
  assert.strictEqual(r.steps.at(-1).text.startsWith("okay can u show me proicing"), true);
  for (const s of r.steps) { assert.strictEqual(s.expect.mustReply, true); assert.strictEqual(s.expect.maxLines, 2); }
  const guarded = r.steps.filter((s) => s.expect.noNav && s.expect.noSignup);
  assert.ok(guarded.length >= 1 && /Don't take me to the campaign/.test(guarded[0].text));
});

test("isQuiet: needs 5 s with no line, no call in flight, dock not busy", async () => {
  const { isQuiet } = await D();
  const base = { now: 10_000, lastLineAt: 4_000, lastBusyAt: 0, inflight: 0, dockState: "conversation" };
  assert.strictEqual(isQuiet(base), true);
  assert.strictEqual(isQuiet({ ...base, lastLineAt: 6_000 }), false);        // only 4 s since the line
  assert.strictEqual(isQuiet({ ...base, inflight: 1 }), false);
  assert.strictEqual(isQuiet({ ...base, dockState: "thinking" }), false);
  assert.strictEqual(isQuiet({ ...base, dockState: "acting" }), false);
  assert.strictEqual(isQuiet({ ...base, lastBusyAt: 7_000 }), false);        // dock was busy 3 s ago
  assert.strictEqual(isQuiet({ ...base, dockState: "needs-user" }), true);   // waiting on the visitor is not busy
});

test("expireInflight drops requests at the 60 s cap only", async () => {
  const { expireInflight } = await D();
  const m = new Map([["old", { start: 0 }], ["new", { start: 50_000 }]]);
  const dropped = expireInflight(m, 60_000);
  assert.deepStrictEqual(dropped.map(([k]) => k), ["old"]);
  assert.deepStrictEqual([...m.keys()], ["new"]);
});

test("rect overlap and union geometry", async () => {
  const { rectsOverlap, unionRect } = await D();
  const r = (x, y, width, height) => ({ x, y, width, height });
  assert.strictEqual(rectsOverlap(r(0, 0, 10, 10), r(5, 5, 10, 10)), true);
  assert.strictEqual(rectsOverlap(r(0, 0, 10, 10), r(10, 0, 10, 10)), false);   // touching edges only
  assert.strictEqual(rectsOverlap(r(0, 0, 10, 10), null), false);
  assert.strictEqual(rectsOverlap(r(0, 0, 0, 10), r(0, 0, 10, 10)), false);     // empty rect
  assert.deepStrictEqual(unionRect([r(0, 0, 10, 10), null, r(20, 5, 10, 10)]), r(0, 0, 30, 15));
  assert.strictEqual(unionRect([null]), null);
});
