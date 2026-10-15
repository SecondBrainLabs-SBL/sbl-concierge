// Scorecard rows, percentile, noise/compare, trace merge. Fixtures: tests/fixtures/experience/.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const FX = path.join(__dirname, "fixtures/experience");
const fx = (n) => JSON.parse(fs.readFileSync(path.join(FX, n), "utf8"));
const load = () => import("../tools/experience/score.mjs");
const score = async (name) => { const m = await load(); const d = fx(name); const sc = m.scoreRuns([{ run: 1, steps: d.steps.map((s, i) => ({ ...s, persona: d.persona, idx: i })) }]); return Object.fromEntries(sc.rows.map((r) => [r.id, r.mean])); };

test("percentile: nearest rank, ignores non-numbers", async () => {
  const { percentile } = await load();
  assert.strictEqual(percentile([4, 1, 3, 2], 50), 2);
  assert.strictEqual(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.strictEqual(percentile([5], 95), 5);
  assert.strictEqual(percentile([null, undefined, 7], 50), 7);
  assert.strictEqual(percentile([], 50), null);
});

test("good fixture meets every computable target", async () => {
  const r = await score("steps-good.json");
  assert.strictEqual(r["E1.p50"], 900);
  assert.strictEqual(r["E2.busy.p50"], 4000);
  assert.strictEqual(r["E2.calls.max"], 2);
  for (const id of ["E3.wrongLandings", "E4.occlusion", "E5.overMax", "E5.unrequestedNav", "E7.noQuestion", "E8.silent", "E8.stranded", "E9.afterStop", "E9.signup"]) assert.strictEqual(r[id], 0, id);
  assert.strictEqual(r["E6.consistency"], 1);
  assert.strictEqual(r["E7.recall.inSession"], 1);
  assert.strictEqual(r["E4.match"], null); // judged row
});

test("bad fixture: every objective row fires", async () => {
  const r = await score("steps-bad.json");
  assert.strictEqual(r["E8.silent"], 1);                 // "hello?" got no line
  assert.strictEqual(r["E8.stranded"], 1);               // dock gone at "o"
  assert.strictEqual(r["E3.wrongLandings"], 2);          // /faq/ instead of /pricing/; gtm.sbl.so 404
  assert.strictEqual(r["E4.occlusion"], 1);
  assert.strictEqual(r["E5.maxLines"], 3);
  assert.strictEqual(r["E5.overMax"], 1);
  assert.strictEqual(r["E5.unrequestedNav"], 1);
  assert.strictEqual(r["E6.consistency"], 0);            // Pro vs Starter
  assert.strictEqual(r["E7.recall.inSession"], null);    // only afterReload recalls exist
  assert.strictEqual(r["E7.recall.afterReload"], 0);     // 0 of 2
  assert.strictEqual(r["E7.noQuestion"], 1);
  assert.strictEqual(r["E9.afterStop"], 2);              // navigate on the stop step + click in the afterStop wait
  assert.strictEqual(r["E9.signup"], 2);                 // signup URL + email ask
  assert.strictEqual(r["E2.calls.max"], 6);
});

test("moved(): hash-only and unchanged URLs are not navigation", async () => {
  const { moved } = await load();
  assert.strictEqual(moved({ url: "https://sbl.so/a#x", urlBefore: "https://sbl.so/a", actions: [] }), false);
  assert.strictEqual(moved({ url: "https://sbl.so/b", urlBefore: "https://sbl.so/a", actions: [] }), true);
  assert.strictEqual(moved({ url: "https://sbl.so/a", urlBefore: "https://sbl.so/a", actions: [{ type: "navigate" }] }), true);
});

test("decision capture is case-insensitive and first match wins", async () => {
  const { captureOf } = await load();
  assert.strictEqual(captureOf({ lines: [{ text: "go with PRO, not Starter" }] }, "\\b(Starter|Pro|Elite)\\b"), "pro");
  assert.strictEqual(captureOf({ lines: [] }, "\\b(Starter|Pro|Elite)\\b"), null);
});

test("trace: parse, refused lines hidden, timings and model calls preferred over driver data", async () => {
  const { parseTrace, mergeTrace } = await load();
  const turns = parseTrace(fs.readFileSync(path.join(FX, "trace-sample.jsonl"), "utf8"));
  assert.strictEqual(turns.length, 1);
  assert.strictEqual(turns[0].refused, 1);
  const good = fx("steps-good.json").steps;
  const merged = mergeTrace(good, turns);
  const s = merged[1];
  assert.strictEqual(s.fromTrace, true);
  assert.strictEqual(s.firstLineMs, 600);
  assert.strictEqual(s.busyMs, 2000);
  assert.strictEqual(s.modelCalls, 3);
  assert.deepStrictEqual(s.modelCallMs, [700, 500, 400]);
  assert.strictEqual(s.lines.length, 1);          // the refused draft is not a visible line
  assert.strictEqual(merged[0].fromTrace, undefined); // no matching turn: driver data kept
});

test("aggregation over runs: per-run values, mean, spread; loadRuns reads steps+trace", async () => {
  const { loadRuns, scoreRuns } = await load();
  const runs = loadRuns(path.join(FX, "rundir"));
  assert.deepStrictEqual(runs.map((r) => r.run), [1, 2]);
  const sc = scoreRuns(runs);
  const p95 = sc.rows.find((r) => r.id === "E1.p95");
  assert.deepStrictEqual(p95.values, [1000, 2900]);
  assert.strictEqual(p95.mean, 1950);
  assert.strictEqual(p95.spread, 1900);
  assert.strictEqual(p95.pass, true);
  const one = scoreRuns([runs[0]]);
  assert.match(one.rows[0].note, /noise unknown/);
});

test("compare: better / worse / within noise uses the larger spread", async () => {
  const { compareScores } = await load();
  const mk = (mean, spread, op = "<=") => ({ rows: [{ id: "R", op, mean, spread }] });
  const v = (b, c) => compareScores(b, c)[0].verdict;
  assert.strictEqual(v(mk(10, 2), mk(11, 0)), "within noise");   // |1| <= 2
  assert.strictEqual(v(mk(10, 0), mk(11, 2)), "within noise");   // candidate spread counts too
  assert.strictEqual(v(mk(10, 1), mk(14, 1)), "worse");          // lower is better, went up
  assert.strictEqual(v(mk(10, 1), mk(6, 1)), "better");
  assert.strictEqual(v(mk(0.5, 0.1, ">="), mk(0.9, 0.1, ">=")), "better"); // higher is better
  assert.strictEqual(v(mk(0.9, 0.1, ">="), mk(0.5, 0.1, ">=")), "worse");
  assert.strictEqual(v(mk(null, null), mk(1, 0)), "n/a");
});

test("real baseline sample (t1: take me to pricing, A: integrations) fails E1 and E2", async () => {
  const r = await score("steps-real.json");
  assert.strictEqual(r["E1.p95"], 11812);            // 11.8 s to the first line
  assert.strictEqual(r["E2.calls.max"], 9);
  assert.strictEqual(r["E2.busy.p95"], 81810);
  assert.strictEqual(r["E3.wrongLandings"], 0);      // it did land on /pricing/
  assert.strictEqual(r["E5.overMax"], 0);
  const { scoreRuns } = await load();
  const d = fx("steps-real.json");
  const sc = scoreRuns([{ run: 1, steps: d.steps }]);
  assert.strictEqual(sc.rows.find((x) => x.id === "E1.p95").pass, false);
});

test("S8: /agent/route is a model call; the preview is not an agent line; E1.words is an info row", async () => {
  const { isModelPath, agentLines } = await import("../tools/experience/driver.mjs");
  assert.strictEqual(isModelPath("/agent/route"), true);
  assert.strictEqual(isModelPath("/agent/chat"), true);
  assert.strictEqual(isModelPath("/other"), false);
  const L = [{ who: "visitor", text: "hi" }, { who: "agent", text: "Pro is", preview: true }];
  assert.deepStrictEqual([agentLines(L, 0).real.length, agentLines(L, 0).any], [0, true]);
  assert.strictEqual(agentLines(L.slice(0, 1), 0).any, false);
  const { scoreRuns, renderMarkdown } = await load();
  const steps = [{ do: "say", text: "a", firstLineMs: 3000, firstWordsMs: 900 }, { do: "say", text: "b", firstLineMs: 2000, firstWordsMs: 700 }];
  const sc = scoreRuns([{ run: 1, steps }]);
  const w = sc.rows.find((r) => r.id === "E1.words"), l = sc.rows.find((r) => r.id === "E1.p50");
  assert.deepStrictEqual([w.mean, w.pass, sc.rows.find((r) => r.id === "E1.words.p95").mean, l.mean], [700, null, 900, 2000]);
  assert.match(renderMarkdown(sc), /E1\.words .*\| info \|/);
});
