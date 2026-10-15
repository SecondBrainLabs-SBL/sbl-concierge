// Judge: prompt assembly, verdict parsing, summary arithmetic, agreement/kappa, cache key. No network.
const test = require("node:test");
const assert = require("node:assert/strict");
const fx = require("./fixtures/experience/judge-step.json");
const load = () => import("../tools/experience/judge.mjs");
const v = (a, s, u) => ({ asked_vs_done: { verdict: a, reason: "r" }, show_match: { verdict: s, reason: "r" }, useful: { verdict: u, reason: "r" } });

test("prompt carries the visitor text, previous turn, lines, actions folded, urls and dock", async () => {
  const { buildUserText } = await load();
  const t = buildUserText(fx.step, fx.prev);
  assert.match(t, /Visitor typed: which plan fits a solo consultant/);
  assert.match(t, /Visitor: take me to the pricing page/);
  assert.match(t, /Taking you to pricing\./);
  assert.match(t, /\[3\.4s\] Starter at \$99/);
  assert.match(t, /point: 2 outreach seats \(x3\)/); // repeated actions folded
  assert.doesNotMatch(t, /say:/);                    // speech is not listed as an action
  assert.match(t, /URL before: https:\/\/sbl\.so\/pricing\//);
  assert.match(t, /URL after: https:\/\/sbl\.so\/pricing\/ \(HTTP 200\)/);
  assert.match(t, /Dock rectangle.*x=540 y=647 w=360 h=232/);
  assert.match(buildUserText(fx.step, []), /\(none, this is the first turn\)/);
});

test("verdict parsing accepts good output and rejects malformed output", async () => {
  const { parseVerdict } = await load();
  assert.equal(parseVerdict(JSON.stringify(v("pass", "n-a", "fail"))).show_match.verdict, "n-a");
  assert.throws(() => parseVerdict("not json"), /not valid JSON/);
  assert.throws(() => parseVerdict("[]"), /not an object/);
  const noRow = v("pass", "pass", "pass"); delete noRow.useful;
  assert.throws(() => parseVerdict(noRow), /missing row useful/);
  assert.throws(() => parseVerdict(v("maybe", "pass", "pass")), /bad verdict/);
  const noReason = v("pass", "pass", "pass"); noReason.show_match.reason = "  ";
  assert.throws(() => parseVerdict(noReason), /missing reason/);
});

test("summary arithmetic: pass rate is over judged (non n-a) steps", async () => {
  const { summarize } = await load();
  const s = summarize([v("pass", "n-a", "pass"), v("fail", "pass", "pass"), v("pass", "fail", "fail"), v("pass", "n-a", "pass")]);
  assert.deepEqual([s.asked_vs_done.pass, s.asked_vs_done.fail, s.asked_vs_done.na, s.asked_vs_done.rate], [3, 1, 0, 0.75]);
  assert.deepEqual([s.show_match.pass, s.show_match.fail, s.show_match.na, s.show_match.judged, s.show_match.rate], [1, 1, 2, 2, 0.5]);
  assert.equal(s.useful.rate, 0.75);
  assert.equal(summarize([v("pass", "n-a", "pass")]).show_match.rate, null); // nothing judged -> null, not 0
});

test("agreement and Cohen's kappa on hand-computed examples", async () => {
  const { agreement } = await load();
  // 10 items; a: 5 pass 5 fail; b: agrees on 4 pass + 4 fail, flips two. po=.8, pe=.5*.5+.5*.5=.5, kappa=(.8-.5)/.5=.6
  const a = ["pass", "pass", "pass", "pass", "pass", "fail", "fail", "fail", "fail", "fail"];
  const b = ["pass", "pass", "pass", "pass", "fail", "fail", "fail", "fail", "fail", "pass"];
  const r = agreement(a, b);
  assert.equal(r.n, 10); assert.equal(r.agree, 0.8); assert.ok(Math.abs(r.kappa - 0.6) < 1e-9);
  // three labels: a=[p,p,f,n], b=[p,f,f,n]; po=.75; pe=(.5*.25)+(.25*.5)+(.25*.25)=.125+.125+.0625=.3125; kappa=(.75-.3125)/.6875
  const r3 = agreement(["pass", "pass", "fail", "n-a"], ["pass", "fail", "fail", "n-a"]);
  assert.equal(r3.agree, 0.75); assert.ok(Math.abs(r3.kappa - 0.4375 / 0.6875) < 1e-9);
  // perfect agreement with variety -> kappa 1
  assert.equal(agreement(["pass", "fail"], ["pass", "fail"]).kappa, 1);
  // degenerate: both always the same single label -> chance agreement is 1, kappa undefined (null), agreement 100%
  const d = agreement(["pass", "pass", "pass"], ["pass", "pass", "pass"]);
  assert.equal(d.agree, 1); assert.equal(d.kappa, null);
  // one rater constant, other constant but different: po 0, pe 0, kappa 0
  assert.equal(agreement(["pass", "pass"], ["fail", "fail"]).kappa, 0);
  assert.equal(agreement([], []).agree, null);
  assert.throws(() => agreement(["pass"], []), /length/);
});

test("cache key changes with the step, the prompt, the image or the model, and is stable otherwise", async () => {
  const { cacheKey, buildUserText, SYSTEM } = await load();
  const base = { model: "m", system: SYSTEM, userText: buildUserText(fx.step, fx.prev), imageSha: "aa" };
  const k = cacheKey(base);
  assert.equal(k, cacheKey({ ...base }));
  assert.notEqual(k, cacheKey({ ...base, userText: buildUserText({ ...fx.step, text: "something else" }, fx.prev) }));
  assert.notEqual(k, cacheKey({ ...base, userText: buildUserText({ ...fx.step, url: "https://sbl.so/faq/" }, fx.prev) }));
  assert.notEqual(k, cacheKey({ ...base, system: SYSTEM + " Be nicer." }));
  assert.notEqual(k, cacheKey({ ...base, imageSha: "bb" }));
  assert.notEqual(k, cacheKey({ ...base, model: "m2" }));
});
