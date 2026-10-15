const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../core/constitution.js");
const K = require("../core/sbl-knowledge.js");
const S = require("../core/screens.js");

const args = { knowledge: K.full(), screens: S.reference() };

test("the prompt is a short constitution plus everything SBL knows, not a rule table", () => {
  const text = C.system(args);
  assert.match(text, /salesperson sharing the visitor's screen/);
  assert.match(text, /free trial started/);
  assert.match(text, /Show, don't tell/);
  assert.match(text, /After you have answered, stop and wait for the visitor/);
  assert.doesNotMatch(text, /Keep working until the goal is fully achieved/);
  assert.match(text, /say takes a required `then`/);
  assert.match(text, /Never invent anything about the visitor/);
  assert.match(text, /fill_secret/);
  assert.match(text, /confirmation card/);
  assert.match(text, /captcha/);
  assert.match(text, /short spoken sentences/);
  assert.doesNotMatch(text, /GOAL ENGINE|objectiveHint|prepare_campaign|TOOL AND BROWSER RULES|WHERE THINGS ARE/);
  assert.ok(text.indexOf("Show, don't tell") < text.indexOf("# SBL KNOWLEDGE"), "constitution first, knowledge after");
  assert.ok(text.indexOf("# SBL KNOWLEDGE") < text.indexOf("# DASHBOARD SCREENS"));
});

test("all of the knowledge is included, whatever the topic", () => {
  const text = C.system(args);
  for (const part of ["PUBLIC PRICING", "$189", "WHO IT IS FOR", "CHANNELS", "DASHBOARD MODULES", "INTEGRATIONS", "PUBLISHED NUMBERS", "FAQ", "COMING SOON"]) assert.match(text, new RegExp(part.replace("$", "\\$")));
  assert.equal(text.includes(K.full()), true);
  assert.match(text, /DASHBOARD SIDEBAR/);
  assert.match(text, /Hire a profile instead/, "screen knowledge is reference text");
});

test("only the site map's .text is used, and its absence is fine", () => {
  assert.match(C.system({ ...args, siteMap: { text: "SBL SITE MAP /pricing/", pages: [{ url: "big" }] } }), /# SITE MAP[\s\S]*SBL SITE MAP \/pricing\//);
  assert.doesNotMatch(C.system({ ...args, siteMap: { text: "map", pages: [{ url: "https://big.example" }] } }), /big\.example/, "the structured pages are never sent");
  assert.doesNotMatch(C.system(args), /# SITE MAP/);
  assert.doesNotMatch(C.system({ ...args, siteMap: undefined }), /SITE MAP/);
  assert.doesNotMatch(C.system({ ...args, siteMap: "plain string" }), /plain string/);
});

test("the stable part is byte-identical between runs, so it caches; the customer part comes separately", () => {
  assert.equal(C.system(args), C.system({ ...args }));
  const ctx = C.context({ surface: "dashboard", url: "https://app.secondbrainlabs.com/campaigns", workspace: "Acme", customerFile: "- runs 20 campaigns", conversation: [{ role: "user", text: "hi" }, { role: "assistant", text: "hello" }], account: { plan: "Pro" } });
  assert.match(ctx, /workspace Acme/);
  assert.match(ctx, /runs 20 campaigns/);
  assert.match(ctx, /Visitor: hi\nYou: hello/);
  assert.match(C.context({}), /\(empty\)/);
  assert.match(C.context({}), /\(none yet\)/);
});
