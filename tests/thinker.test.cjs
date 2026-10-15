const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { create, bubbleLine, withoutRead, MOMENTS, MIN_GAP_MS, MAX_CALLS } = require("../core/thinker.js");
const { firstVisitWelcome, awaitingWelcome } = require("../core/thinker.js");

test("a first-visit welcome waits until idle and appears only once", () => {
  const welcome = firstVisitWelcome(true);
  assert.equal(welcome({ blocked: true }), "");
  assert.match(welcome({ blocked: false }), /what are you looking to improve/);
  assert.equal(welcome({ blocked: false }), "");
});

test("returning visitors, conversation and refusals suppress the welcome permanently", () => {
  assert.equal(firstVisitWelcome(false)({ blocked: false }), "");
  for (const input of [{ hasConversation: true }, { refused: true }]) {
    const welcome = firstVisitWelcome(true);
    assert.equal(welcome({ blocked: true, ...input }), "");
    assert.equal(welcome({ blocked: false }), "");
  }
});

test("an unanswered welcome blocks further proactive work, including after memory reload", () => {
  const text = firstVisitWelcome(true)({ blocked: false });
  const restored = JSON.parse(JSON.stringify([{ role: "assistant", text }]));
  assert.equal(awaitingWelcome(restored), true);
  assert.equal(awaitingWelcome([...restored, { role: "user", text: "I want more replies" }]), false);
  assert.equal(awaitingWelcome([{ role: "assistant", text: "A different answer" }]), false);
});

function setup(opts = {}) {
  let t = 1_700_000_000_000;
  const saves = [];
  const th = create({ now: () => t, state: opts.state, save: (s) => saves.push(JSON.stringify(s)), ...opts });
  return { th, saves, advance: (ms) => { t += ms; } };
}

test("which moments wake the thinker, and which things are not moments", () => {
  assert.deepEqual([...MOMENTS].sort(), ["copy", "deadclick", "exit", "hover", "pause", "reread", "section_done", "select", "settled"]);
  const { th, advance } = setup();
  advance(60_000);
  for (const junk of ["scroll", "mousemove", "keydown", "tick", "anything"]) th.moment(junk);
  assert.equal(th.ready("/", false), null, "steady scrolling and mouse movement never wake it");
  th.moment("hover", "Pro plan");
  assert.deepEqual(th.ready("/", false), ["hover: Pro plan"]);
  th.moment("section_done", "Pricing");
  assert.deepEqual(th.ready("/", false), ["hover: Pro plan", "section_done: Pricing"]);
});

test("a wake is blocked during a run, a conversation, a bubble or a call in flight, and the moment is kept", () => {
  const { th, advance } = setup();
  advance(60_000);
  th.moment("pause");
  assert.equal(th.ready("/", true), null, "blocked: a harness run is active, or the visitor is talking, or a bubble is up");
  assert.deepEqual(th.ready("/", false), ["pause"], "the same moment is still there once the block lifts");
});

test("minimum gap between calls, across page loads; the gap is cost plumbing", () => {
  const first = setup();
  first.advance(60_000);
  first.th.moment("pause");
  assert.ok(first.th.ready("/", false));
  first.th.woke("/");
  first.th.moment("reread", "Logos");
  assert.equal(first.th.ready("/", false), null, "right after a call");
  first.advance(MIN_GAP_MS - 1);
  assert.equal(first.th.ready("/", false), null);
  first.advance(1);
  assert.deepEqual(first.th.ready("/", false), ["reread: Logos"]);
  // The next page load reads the stored record: the gap survives it.
  const next = setup({ state: first.th.state() });
  next.th.moment("pause");
  assert.equal(next.th.ready("/pricing/", false), null);
  next.th.moment("page"); next.th.moment("return");
  next.advance(60_000 + MIN_GAP_MS);
  assert.deepEqual(next.th.ready("/pricing/", false), ["pause"], "arriving is not a wake-up on its own");
});

test("per-page ceiling: no more than MAX_CALLS model calls on one path; another path has its own", () => {
  const { th, advance } = setup();
  for (let i = 0; i < MAX_CALLS; i++) {
    advance(MIN_GAP_MS);
    th.moment("pause");
    assert.ok(th.ready("/pricing/", false), `call ${i + 1}`);
    th.woke("/pricing/");
  }
  advance(MIN_GAP_MS);
  th.moment("pause");
  assert.equal(th.ready("/pricing/", false), null, "ceiling reached");
  assert.ok(th.ready("/", false), "a different page is a fresh budget");
});

test("no wake mid-scroll: steady reading waits until the scrolling has stopped", () => {
  const { th, advance } = setup();
  advance(60_000);
  th.moment("section_done", "Hero");
  th.scrolled();
  assert.equal(th.ready("/", false), null, "still scrolling");
  advance(1000);
  assert.equal(th.ready("/", false), null);
  advance(600);
  assert.deepEqual(th.ready("/", false), ["section_done: Hero"]);
});

test("back-off bookkeeping: shown, ignored, dismissed, accepted and silent are all fed back to the next wake", () => {
  const { th, advance } = setup();
  th.offer("Want to see a story like yours?", "show the agency story");
  assert.ok(th.open());
  advance(4000);
  assert.equal(th.react("dismissed"), true);
  assert.equal(th.open(), null);
  assert.equal(th.react("accepted"), false, "only an open offer can be reacted to");
  advance(30_000);
  th.offer("Pro looks interesting?", "point at Pro");
  advance(10_000);
  th.offer("Second try", "g"); // the previous one was never answered: it becomes ignored
  advance(5_000);
  th.silent(["pause", "hover"]);
  const lines = th.history();
  assert.equal(lines.length, 4);
  assert.match(lines[0], /you said "Want to see a story like yours\?" \(offering: show the agency story\); the visitor dismissed it after 4 s$/);
  assert.match(lines[1], /"Pro looks interesting\?".*did not react and it faded/);
  assert.match(lines[2], /"Second try".*still showing, no reaction yet/);
  assert.match(lines[3], /you chose to stay silent \(woken by pause, hover\)/);
  assert.ok(!/hypothesis|confidence|evidence/.test(lines.join("\n")), "no reasoning in the record the model sees");
  assert.equal(th.react("replied"), false, "the latest entry is a silence, not an offer");
});

test("a late reply to a faded offer is recorded as a reply", () => {
  const { th } = setup();
  th.offer("Hello", "g");
  th.offer("Hello again", "g");
  th.react("ignored");
  assert.equal(th.react("replied"), true);
  assert.match(th.history().at(-1), /answered it in the chat/);
});

test("the record is kept short, persisted on every change, and a new visit starts a clean one", () => {
  const { th, advance, saves } = setup();
  for (let i = 0; i < 12; i++) th.offer(`line ${i}`, "g");
  assert.equal(th.history().length, 8);
  assert.ok(saves.length >= 12);
  const stored = JSON.parse(saves.at(-1));
  assert.equal(stored.said.at(-1).say, "line 11");
  const later = setup({ state: { ...stored, at: 1_700_000_000_000 - 31 * 60_000 } });
  assert.deepEqual(later.th.history(), []);
});

test("reason text can never reach the bubble: only the opener of a speaking decision is returned", () => {
  const decision = { speak: true, opener: "You keep coming back to Pro. Want a look at a team like yours?", goal: "g", read: "price-sensitive agency owner (confidence 0.9; evidence: hovered Pro)", hypothesis: "price-sensitive", evidence: ["hovered Pro"], why: ["pricing dwell"] };
  const line = bubbleLine(decision);
  assert.equal(line, "You keep coming back to Pro. Want a look at a team like yours?");
  for (const secret of ["price-sensitive", "confidence", "evidence", "pricing dwell", "hovered Pro"]) assert.ok(!line.includes(secret), secret);
  assert.equal(bubbleLine({ ...decision, speak: false }), "", "silence shows nothing, whatever else is in the answer");
  assert.equal(bubbleLine({ speak: true, read: "reasoning only" }), "", "no opener, no bubble");
  assert.equal(bubbleLine({ speak: true, opener: "**Hi** `there` [x]\nnext" }), "Hi there x next", "plain text, no markdown");
  assert.ok(bubbleLine({ speak: true, opener: "x".repeat(1000) }).length <= 400);
});

test("the thinker's opener reaches the page only as an input to the brain; no bubble, no second speaker", () => {
  const src = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(src, /const line = SBLThinker\.bubbleLine\(d\)/);
  assert.doesNotMatch(src, /invite-say"\)\.textContent/, "no bubble: the opener is spoken by the brain, once");
  assert.doesNotMatch(src, /classList\.add\("show"\)[^\n]*invite|invite\.classList\.add\("show"\)/, "the invite element is never shown");
  assert.doesNotMatch(src, /class="why"|\.why\b|whyText|class="tags"|renderTags|inferences|maybeProactive|PROACTIVE_/);
  assert.doesNotMatch(src, /invite[^\n]*(d\.read|hypothesis|evidence)/);
  // The read goes to the customer file, not to the screen.
  assert.match(src, /saveRead\(d\.read\)/);
  assert.doesNotMatch(src, /withRead/);
  assert.equal((src.match(/loadRead\(\)/g) || []).length, 1, "the read is loaded once, for thinkRequest only");
  // The thinker's opener feeds the brain (its own hypothesis/opener data in the brain's prompt).
  assert.match(src, /offerToBrain/);
  assert.match(src, /proactive thought from your own thinking half/);
  // A reply to an open offer goes to the model with the offer: no yes-word list on the page.
  assert.match(src, /If that is a yes, do what you offered/);
});

test("the rule machinery is gone from the tracker, the config and the page", () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const code = read("core/behavior.js") + read("content.js") + read("live-config.mjs");
  for (const gone of ["TOPICS", "INTERESTS", "REFERRERS", "infer(", "TOPIC_SLUGS", "PERSONA_SLUGS", "PROACTIVE_MIN", "PROACTIVE_SLOW", "setInferences", "seenNotClicked", "CTA_TEXT", "heuristicStage"]) assert.ok(!code.includes(gone), gone);
});

test("the customer file given to voice and the harness carries no read line, old ones included", () => {
  const file = "- Sells a CRM\n- Read: Agency owner (confidence 0.5; evidence: hovered Pro)\n- Wants 200 leads a week";
  assert.equal(withoutRead(file), "- Sells a CRM\n- Wants 200 leads a week");
  assert.equal(withoutRead(undefined), "");
  const src = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(src, /return SBLThinker\.withoutRead\(/, "customerFile() is the one source for voice, harness and greeting");
  assert.match(src, /edit\(SBLThinker\.withoutRead\(base\)\)/);
});

test("a run of silences is one entry, so it cannot push a dismissal out of the list", () => {
  const { th } = setup();
  th.offer("Want to see pricing?", "show pricing");
  th.react("dismissed");
  for (let i = 0; i < 20; i++) th.silent(["pause"]);
  const h = th.history();
  assert.equal(h.length, 2);
  assert.match(h[0], /dismissed/);
});

test("a bubble that was showing when the page reloaded is ignored, not still showing", () => {
  const { th } = setup();
  th.offer("Hi", "show");
  const again = create({ state: JSON.parse(JSON.stringify(th.state())), now: () => th.state().at + 1000 });
  assert.equal(again.open(), null);
  assert.match(again.history()[0], /did not react/);
});
