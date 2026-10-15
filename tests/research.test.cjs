const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../core/research.js");

const customer = { goal: "book demos", audience: "recruiters in India", channel: "linkedin", email: "a@secret.com", phone: "+91999000111", notes: "PRIVATE-NOTE", campaigns: [{ name: "Camp B", state: "running", leads: ["Zed Person"] }, { name: "Camp A", state: "created" }] };

test("buildRequest: web_search, schema, no private leak, today/country", () => {
  const r = R.buildRequest({ question: "Any festival soon?", customer, today: "2026-09-30", country: "IN", budget: { maxSources: 5, maxOutputTokens: 1500 }, model: "m" });
  assert.deepEqual(r.tools, [{ type: "web_search" }]);
  assert.equal(r.model, "m");
  assert.equal(r.max_output_tokens, 1500);
  assert.equal(r.text.format.type, "json_schema");
  assert.deepEqual([...r.text.format.schema.required].sort(), ["conflicts", "findings", "moment", "relevance", "status", "suggestion", "uncertainty"]);
  const s = JSON.stringify(r);
  for (const p of ["a@secret.com", "+91999000111", "PRIVATE-NOTE", "Zed Person"]) assert.ok(!s.includes(p), p);
  assert.ok(s.includes("2026-09-30") && s.includes('"IN"') || s.includes("Country focus: IN"));
  assert.ok(!s.includes("Camp A") && !s.includes("Camp B"), "campaign names never leave");
  assert.ok(/count\W+2/.test(s) && s.includes("80%"));
});

test("parseResult: good, malformed, missing findings", () => {
  const good = { status: "useful", findings: [{ claim: "x" }], conflicts: [], uncertainty: "", relevance: "", moment: null, suggestion: null };
  const wrap = (t) => ({ output: [{ type: "message", content: [{ type: "output_text", text: t }] }] });
  assert.deepEqual(R.parseResult(wrap(JSON.stringify(good))), good);
  const bad = R.parseResult(wrap("not json"));
  assert.equal(bad.status, "inconclusive");
  assert.deepEqual(bad.findings, []);
  assert.ok(bad.error);
  assert.equal(R.parseResult(wrap('{"status":"useful"}')).status, "inconclusive");
  assert.equal(R.parseResult().status, "inconclusive");
});

test("cacheKey normalizes case, whitespace, campaign order", () => {
  const a = R.cacheKey("  Any  Festival? ", customer);
  const b = R.cacheKey("any festival?", { ...customer, goal: " BOOK  demos", campaigns: [{ name: "x", state: "Created" }, { name: "y", state: "RUNNING" }] });
  assert.equal(a, b);
  assert.notEqual(a, R.cacheKey("other", customer));
  assert.notEqual(R.cacheKey("q", customer, "IN"), R.cacheKey("q", customer, "US"));
});

test("server wiring: cache only useful, key has country, fresh id on collision, not_running", () => {
  const s = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.mjs"), "utf8");
  assert.match(s, /if \(result\.status === "useful"\) \{\s*researchCache\.set/);
  assert.match(s, /cacheKey\(question, body\.customer, body\.country\)/);
  assert.match(s, /!researchRuns\.has\(body\.id\) \? body\.id : randomUUID\(\)/);
  // Per-visitor research caps are exercised against the server in capacity.test.cjs.
  assert.match(s, /"not_running"/);
});
