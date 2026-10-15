const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../core/task.js");

const NOW = 1_000_000;

test("a fresh active task resumes; an old, finished, waiting or out-of-budget one does not", () => {
  const t = T.newTask("show me pricing", NOW);
  assert.equal(T.shouldResume(t, NOW + 1000), true);
  assert.equal(T.shouldResume(t, NOW + T.TTL_MS), false, "10 minutes untouched is over");
  assert.equal(T.shouldResume({ ...t, steps: T.BUDGET }, NOW + 1000), false, "step budget spent");
  assert.equal(T.shouldResume({ ...t, resumes: T.MAX_RESUMES }, NOW + 1000), false, "resume cap");
  assert.equal(T.shouldResume({ ...t, status: "waiting_user" }, NOW + 1000), false, "waits for the visitor, not for a page load");
  assert.equal(T.shouldResume({ ...t, status: "stopped" }, NOW + 1000), false);
  assert.equal(T.shouldResume({ ...t, status: "waiting_human" }, NOW + 1000), true, "a page load usually means the human step was done");
  assert.equal(T.shouldResume(null, NOW), false);
  assert.equal(T.BUDGET, 40);
  assert.equal(T.TTL_MS, 10 * 60_000);
});

test("every recorded step refreshes the task, keeps the name and arguments, and masks secrets", () => {
  const t = T.newTask("sign up", NOW);
  const mask = (s) => s.split("hunter2").join("[hidden]");
  T.record(t, "input_text", { index: 3, text: "typed hunter2 here" }, "input_text|x", mask, NOW + 5000);
  assert.equal(t.updatedAt, NOW + 5000);
  assert.equal(t.log[0].name, "input_text");
  assert.match(t.log[0].args, /\[hidden\]/);
  assert.doesNotMatch(JSON.stringify(t), /hunter2/);
  for (let i = 0; i < 100; i++) T.record(t, "click", { index: i }, `k${i}`, undefined, NOW);
  assert.ok(t.log.length <= 60, "the log is bounded");
  assert.equal(JSON.parse(JSON.stringify(t)).goal, "sign up", "plain data: it survives storage");
});

test("what was said is remembered once, in order, and bounded", () => {
  const t = T.newTask("g", NOW);
  T.said(t, "Here is pricing.");
  T.said(t, "Here is pricing.");
  T.said(t, "  ");
  assert.deepEqual(t.said, ["Here is pricing."]);
  for (let i = 0; i < 30; i++) T.said(t, `line ${i}`);
  assert.equal(t.said.length, 12);
  assert.equal(t.said.at(-1), "line 29");
});

test("loop detection counts only repeats that did nothing: failed, or the page looked the same", () => {
  const t = T.newTask("g", NOW);
  const step = (name, key, progress) => { const v = T.loopVerdict(t, name, key); const e = T.record(t, name, {}, key, undefined, NOW); e.progress = progress; return v; };
  assert.deepEqual([1, 2].map(() => step("click", "click|A|Pricing", false)), ["ok", "ok"]);
  assert.equal(step("click", "click|A|Pricing", false), "warn");
  assert.equal(step("click", "click|A|Pricing", false), "warn");
  assert.equal(step("click", "click|A|Pricing", false), "stop");
  // a different target in between starts the count again
  assert.equal(step("click", "click|A|Signup", false), "ok");
  assert.equal(step("click", "click|A|Pricing", false), "ok");
  // waiting is not a loop
  for (let i = 0; i < 8; i++) assert.equal(step("wait", "wait", false), "ok");
});

test("a wizard's Continue pressed many times on the same URL is progress, never a loop", () => {
  const t = T.newTask("sign up", NOW);
  for (let i = 0; i < 10; i++) {
    assert.equal(T.loopVerdict(t, "click", "click|BUTTON|Continue|/onboarding"), "ok", `press ${i + 1}`);
    T.record(t, "click", {}, "click|BUTTON|Continue|/onboarding", undefined, NOW).progress = true; // the page content changed each time
  }
  // one that changed nothing does not count as progress, and an unknown outcome (the page unloaded) breaks the chain
  const u = T.newTask("g", NOW);
  for (let i = 0; i < 2; i++) T.record(u, "click", {}, "k", undefined, NOW).progress = false;
  T.record(u, "click", {}, "k", undefined, NOW); // killed by a navigation: no result recorded
  assert.equal(T.loopVerdict(u, "click", "k"), "ok");
});

test("pointing and talking are never loop failures, even on the same target forever", () => {
  const t = T.newTask("g", NOW);
  const step = (name, key) => { const v = T.loopVerdict(t, name, key); const e = T.record(t, name, {}, key, undefined, NOW); e.progress = false; return v; };
  for (const name of ["point_at", "say", "ask_user", "remember", "human_step"]) {
    const fresh = T.newTask("g", NOW);
    for (let i = 0; i < 10; i++) {
      const v = T.loopVerdict(fresh, name, `${name}|x`);
      const e = T.record(fresh, name, {}, `${name}|x`, undefined, NOW); e.progress = false;
      assert.equal(v, "ok", `${name} attempt ${i + 1}: never warn/stop`);
    }
  }
});

test("the visitor speaking resets the repeat streak (the barrier)", () => {
  const t = T.newTask("g", NOW);
  const fail = (key) => { T.record(t, "click", {}, key, undefined, NOW).progress = false; };
  for (let i = 0; i < 4; i++) fail("click|A|Pricing");
  assert.equal(T.loopVerdict(t, "click", "click|A|Pricing"), "stop", "five in a row is a stop");
  T.heard(t, NOW + 10); // the visitor speaks
  assert.equal(T.repeats(t, "click|A|Pricing"), 0, "the streak is broken");
  assert.equal(T.loopVerdict(t, "click", "click|A|Pricing"), "ok");
  fail("click|A|Pricing"); fail("click|A|Pricing");
  assert.equal(T.loopVerdict(t, "click", "click|A|Pricing"), "warn", "a new streak climbs again from zero");
});

test("a halted waiting_user task is not an open question: only the agent's own ask_user waits for an answer", () => {
  const t = T.newTask("g", NOW);
  t.status = "waiting_user"; t.question = "How should I get past this?";
  assert.equal(T.awaitingAnswer(t), false, "a wall/pause/budget halt waits for nothing: the next request is a new task");
  const a = T.newTask("g", NOW);
  a.status = "waiting_user"; a.awaiting = "answer"; a.question = "What is your email?";
  assert.equal(T.awaitingAnswer(a), true, "the agent's own question waits for its answer");
  assert.equal(T.awaitingAnswer(null), false);
  assert.equal(T.awaitingAnswer({ ...a, status: "active" }), false);
});

test("bouncing between pages cannot outrun the step budget, the resume cap or the visitor clock", () => {
  const t = T.newTask("bounce", NOW);
  // every page load runs a few actions and dies before any end-of-step hook: steps are counted when an action starts
  while (T.shouldResume(t, NOW + 1000) ) {
    T.resumed(t);
    for (let i = 0; i < 3; i++) { T.record(t, "navigate", { url: i % 2 ? "/a" : "/b" }, `navigate|${i}`, undefined, NOW + 1000); T.step(t); }
  }
  assert.ok(t.steps >= T.BUDGET || t.resumes >= T.MAX_RESUMES, "it stopped by itself");
  assert.ok(t.steps <= T.BUDGET + 3);
  // steady activity does not keep a task alive: only the visitor speaking does
  const busy = T.newTask("g", NOW);
  T.record(busy, "click", {}, "k", undefined, NOW + T.TTL_MS - 1);
  assert.equal(busy.updatedAt, NOW + T.TTL_MS - 1);
  assert.equal(T.shouldResume(busy, NOW + T.TTL_MS + 1), false, "10 minutes after the visitor's last word it is over");
  assert.equal(T.expired(busy, NOW + T.TTL_MS + 1), true);
  T.heard(busy, NOW + T.TTL_MS);
  assert.equal(T.shouldResume(busy, NOW + T.TTL_MS + 1), true, "the visitor speaking restarts the clock");
});

test("the continuation preface carries the goal, the steps done, what was said, and the budget", () => {
  const t = T.newTask("sign the visitor up", NOW);
  T.record(t, "navigate", { url: "/pricing" }, "navigate|/pricing", undefined, NOW).result = "navigating";
  T.said(t, "Here is the Pro plan.");
  t.steps = 7;
  t.question = "What is your email?";
  const p = T.preface(t);
  assert.match(p, /CONTINUATION/);
  assert.match(p, /Goal: sign the visitor up/);
  assert.match(p, /1\. navigate .*\/pricing.* -> navigating/);
  assert.match(p, /Here is the Pro plan\./);
  assert.match(p, /What is your email\?/);
  assert.match(p, /7 of 40/);
});
