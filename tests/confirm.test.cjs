const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore, recheck, compare } = require("../core/actions.js");

const base = { action: "pause", target: "Pause Campaign", targetId: "8603", effect: "Stops outreach", cost: "none", path: "/campaigns/8603", workspaceId: "706" };
const same = { target: base.target, targetId: base.targetId, path: base.path, workspaceId: base.workspaceId, cost: base.cost };
const boundYes = (s, p = base) => { const { id, hash } = s.propose(p); assert.ok(s.bind(id, { hash, text: "yes" }).ok); return id; };

test("propose returns an id and a hash over the fields", () => {
  const s = createStore();
  const a = s.propose(base), b = s.propose({ ...base, cost: "10 credits" });
  assert.match(a.hash, /^[0-9a-f]{8}$/);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.hash, b.hash);
  assert.equal(a.hash, createStore().propose(base).hash);
});

test("a bound yes is single-use and only counts for its own hash", async () => {
  const s = createStore();
  const { id, hash } = s.propose(base);
  assert.equal(s.bind(id, { hash: "deadbeef" }).ok, false);
  assert.equal(s.bind(id, { hash }).ok, true);
  assert.equal(s.bind(id, { hash }).ok, false, "a second yes on the same proposal is refused");
  let runs = 0;
  assert.equal((await s.execute(id, same, async () => { runs++; })).ok, true);
  assert.equal(runs, 1);
  const other = s.propose({ ...base, targetId: "1" });
  assert.equal(s.bind(other.id, { hash }).ok, false, "yes for one proposal cannot bind another");
});

test("execute without a bound yes never runs", async () => {
  const s = createStore();
  const { id } = s.propose(base);
  let runs = 0;
  const r = await s.execute(id, same, async () => { runs++; });
  assert.deepEqual([r.ok, r.blocked, runs], [false, "unbound", 0]);
});

test("a changed target, target id, path, workspace or cost invalidates", async () => {
  for (const [k, v] of [["target", "Resume Campaign"], ["targetId", "8598"], ["path", "/campaigns/8598"], ["workspaceId", "126"], ["cost", "25 credits"]]) {
    const s = createStore();
    const id = boundYes(s);
    let runs = 0;
    const r = await s.execute(id, { ...same, [k]: v }, async () => { runs++; });
    assert.deepEqual([r.ok, r.blocked, r.changed, runs], [false, "recheck", [k], 0], k);
    assert.equal(s.get(id).state, "invalid");
  }
});

test("a recheck failure spends the yes: fixing the screen does not revive it", async () => {
  const s = createStore();
  const id = boundYes(s);
  await s.execute(id, { ...same, target: "Other" }, async () => {});
  const again = await s.execute(id, same, async () => { throw new Error("must not run"); });
  assert.equal(again.ok, false);
});

test("recheck ignores whitespace and null-vs-missing", () => {
  assert.equal(recheck({ ...base, cost: null }, { ...same, cost: undefined }).ok, true);
  assert.equal(recheck({ ...base, target: "Pause  Campaign " }, same).ok, true);
});

test("a second execute for the same id is refused: no double effects", async () => {
  const s = createStore();
  const id = boundYes(s);
  let runs = 0;
  const run = async () => { runs++; };
  const [a, b] = await Promise.all([s.execute(id, same, run), s.execute(id, same, run)]);
  assert.deepEqual([a.ok, b.ok, runs], [true, false, 1]);
  assert.equal((await s.execute(id, same, run)).ok, false);
  assert.equal(runs, 1);
});

test("a run that throws is failed, not retried", async () => {
  const s = createStore();
  const id = boundYes(s);
  const r = await s.execute(id, same, async () => { throw new Error("click blocked"); });
  assert.deepEqual([r.ok, r.blocked, s.get(id).state], [false, "run", "failed"]);
  assert.equal((await s.execute(id, same, async () => {})).ok, false);
});

test("queued and delivered are different recorded states", async () => {
  const outcome = async (confirmed) => {
    const s = createStore();
    const id = boundYes(s);
    await s.execute(id, same, async () => {});
    assert.equal(s.verify(id, confirmed, "x").ok, true);
    return s.get(id).state;
  };
  assert.equal(await outcome(true), "done");
  assert.equal(await outcome(null), "queued");
  assert.equal(await outcome(false), "failed");
  assert.equal(createStore().verify("nope", true).ok, false);
});

test("verify needs an executed action", () => {
  const s = createStore();
  const id = boundYes(s);
  assert.equal(s.verify(id, true).ok, false);
});

test("read-back: only a changed state counts; unchanged, missing and unknown stay queued", () => {
  assert.deepEqual(compare("status 7", "status 9"), { state: "changed", confirmed: true });
  assert.deepEqual(compare("status 7", "status 7"), { state: "unchanged", confirmed: null });
  assert.deepEqual(compare("status 7", null), { state: "missing", confirmed: null });
  assert.deepEqual(compare(null, "status 7"), { state: "unknown", confirmed: null });
  assert.deepEqual(compare("status 7", undefined), { state: "unknown", confirmed: null });
});
