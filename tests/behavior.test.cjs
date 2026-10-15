const test = require("node:test");
const assert = require("node:assert/strict");
const { createTracker, labelFor } = require("../core/behavior.js");

function setup(saved) {
  let t = 1_700_000_000_000;
  let store = saved || null;
  const moments = [];
  const tracker = createTracker({ now: () => t, load: () => store, save: (s) => { store = JSON.parse(JSON.stringify(s)); }, device: "desktop", onMoment: (k, d) => moments.push(d ? `${k}:${d}` : k) });
  // Time passes with the person interacting, one second at a time.
  const spend = (seconds, { idle = false } = {}) => {
    for (let i = 0; i < seconds; i++) { t += 1000; if (!idle) tracker.activity(); else tracker.tick(); }
  };
  return { tracker, spend, moments, advance: (ms) => { t += ms; }, saved: () => { tracker.flush(); return store; } };
}
const view = (tracker, url, title, referrer = "", surface = "website") => tracker.pageview({ url, title, referrer, surface });
// A section in view for n seconds.
const read = (h, label, seconds) => { h.tracker.expose("section", label, true); h.spend(seconds); h.tracker.expose("section", label, false); };

test("digest: a visitor who hovers two plans, re-reads the logos and selects a phrase comes out as plain timestamped facts", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/pricing/?utm_source=newsletter", "Pricing", "https://www.google.com/search");
  h.spend(2);
  read(h, "Customer logos", 3);
  h.tracker.rest("Pro plan", 0); h.spend(6); h.tracker.moveOff();
  h.tracker.rest("Starter plan", 0); h.spend(4); h.tracker.moveOff();
  read(h, "Pricing", 8);
  read(h, "Customer logos", 2);
  h.tracker.select("unlimited workspaces");
  h.tracker.click({ label: "Get started" });
  const lines = h.tracker.summary().digest;
  assert.equal(lines[0], "first visit");
  assert.match(lines[1], /^arrived from www\.google\.com \(https:\/\/www\.google\.com\/search\) on "Pricing" \(\/pricing\/\), utm_source=newsletter$/);
  assert.ok(lines.some((l) => /^0:00 opened "Pricing" \(\/pricing\/\)/.test(l)));
  assert.ok(lines.includes("0:02 read \"Customer logos\" 5 s (2 times)"), lines.join("\n"));
  assert.ok(lines.some((l) => /hovered "Pro plan" 6 s$/.test(l)));
  assert.ok(lines.some((l) => /hovered "Starter plan" 4 s$/.test(l)));
  assert.ok(lines.some((l) => /scrolled back to "Customer logos" 1 time$/.test(l)));
  assert.ok(lines.some((l) => /selected "unlimited workspaces"$/.test(l)));
  assert.ok(lines.some((l) => /clicked "Get started"$/.test(l)));
  // Facts only: no label, score or stage anywhere in it.
  assert.doesNotMatch(lines.join("\n"), /persona|intent|interest|concern|stage|confidence|price-sensitive/i);
});

test("digest also says what is happening right now: looking at, resting on, idle, tab in the background", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  h.tracker.expose("section", "Case studies", true);
  h.spend(5);
  h.tracker.rest("Read the story", 3000);
  h.spend(4, { idle: true });
  const lines = h.tracker.summary().digest;
  assert.ok(lines.some((l) => /^now looking at "Case studies" \(9 s so far\)$/.test(l)));
  assert.ok(lines.some((l) => /^pointer resting on "Read the story" in "Case studies" for \d+ s so far$/.test(l)));
  assert.ok(lines.some((l) => /^no input for the last 4 s$/.test(l)));
  h.tracker.visibility(true);
  assert.ok(h.tracker.summary().digest.includes("the tab is in the background right now"));
});

test("digest: dead clicks, scroll reversals, exit and a tab switch", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  h.spend(3);
  h.tracker.deadClick("See pricing"); h.tracker.deadClick("See pricing");
  for (const pct of [10, 30, 50, 30, 10, 40]) h.tracker.scroll(pct);
  h.tracker.exit();
  h.tracker.visibility(true); h.advance(40_000); h.tracker.visibility(false);
  const text = h.tracker.summary().digest.join("\n");
  assert.match(text, /clicked "See pricing" and nothing happened \(2 times\)/);
  assert.match(text, /reversed scroll direction 2 times/);
  assert.match(text, /moved the pointer out through the top of the window, toward the tab bar/);
  assert.match(text, /switched to another tab for 40 s and came back/);
});

test("digest: a return visit carries what was seen last time; pace and skimming are stated as numbers", () => {
  const a = setup();
  view(a.tracker, "https://sbl.so/pricing/", "Pricing");
  read(a, "Pro plan", 9);
  const b = setup(a.saved());
  b.advance(2 * 86_400_000);
  view(b.tracker, "https://sbl.so/", "SBL");
  const lines = b.tracker.summary().digest;
  assert.match(lines[0], /^visit number 2; the previous visit was 2 day\(s\) ago$/);
  assert.match(lines[1], /^earlier visit \(2 day\(s\) ago\): viewed "Pricing"; read longest "Pro plan"$/);
  for (const [label, s] of [["A", 2], ["B", 2], ["C", 2]]) read(b, label, s);
  assert.ok(b.tracker.summary().digest.some((l) => /^pace on \/: 3 sections in view, median 2 s each$/.test(l)));
});

test("moments: which captured things are reported, and which are not", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  assert.deepEqual(h.moments, [], "the first page of a first visit is an arrival, not a moment");
  read(h, "Skimmed", 0.5 * 1);            // in view for one tick only: scrolling past, nothing recorded
  read(h, "Short look", 2);               // recorded but not a finished section
  assert.deepEqual(h.moments, []);
  read(h, "Hero", 5);
  assert.deepEqual(h.moments, ["section_done:Hero"]);
  read(h, "Hero", 1);                     // back on it: a re-read
  assert.ok(h.moments.includes("reread:Hero"));
  h.tracker.rest("Pro plan", 900); h.tracker.select("x y z"); h.tracker.select("x y z", "copy"); h.tracker.deadClick("Tab"); h.tracker.exit(); h.tracker.settled();
  assert.deepEqual(h.moments.slice(-6), ["hover:Pro plan", "select", "copy", "deadclick:Tab", "exit", "settled"]);
  view(h.tracker, "https://sbl.so/pricing/", "Pricing");
  assert.equal(h.moments.at(-1), "page");
});

test("moments: a pause after real reading, once; steady activity is never a moment", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  h.spend(20);                              // reading steadily: nothing reported
  assert.deepEqual(h.moments, []);
  h.spend(8, { idle: true });
  assert.deepEqual(h.moments, ["pause"]);
  h.spend(8, { idle: true });
  assert.deepEqual(h.moments, ["pause"], "one pause per stretch");
  h.tracker.activity(); h.spend(8, { idle: true });
  assert.deepEqual(h.moments, ["pause", "pause"]);
});

test("moments: a return visit is one", () => {
  const a = setup();
  view(a.tracker, "https://sbl.so/pricing/", "Pricing");
  const b = setup(a.saved());
  b.advance(3 * 3600 * 1000);
  view(b.tracker, "https://sbl.so/", "SBL");
  assert.deepEqual(b.moments, ["return"]);
});

test("a reload minutes later in the same visit is a return: a moment and a digest line, not 'first visit' alone", () => {
  const a = setup();
  view(a.tracker, "https://sbl.so/pricing/", "Pricing");
  const saved = a.saved();
  saved.lastSeenAt -= 180_000; // the page was last alive 3 minutes before this load
  const b = setup(saved);
  b.tracker.visibility(false); // the page's first tick must not erase the time away
  view(b.tracker, "https://sbl.so/", "SBL");
  assert.ok(b.moments.includes("return"));
  assert.ok(b.tracker.summary().digest.some((l) => /^first visit; they left and came back .* after 180 s away/.test(l)));
});

test("hidden-tab time is never active time, idle time beyond 30s stops counting", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  h.spend(10);
  h.tracker.visibility(true);
  h.advance(120_000);
  h.tracker.visibility(false);
  let s = h.saved();
  assert.equal(s.hiddenMs, 120_000);
  assert.equal(s.activeMs, 10_000);
  assert.equal(s.pages[0].dwellMs, 10_000);
  h.tracker.activity(); h.spend(50, { idle: true });
  assert.equal(h.saved().activeMs, 10_000 + 30_000);
});

test("agent clicks are never the visitor's behaviour", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  h.tracker.click({ label: "Get started", actor: "agent" });
  assert.ok(!h.tracker.summary().digest.some((l) => /clicked/.test(l)));
  h.tracker.click({ label: "Get started" });
  assert.ok(h.tracker.summary().digest.some((l) => /clicked "Get started"/.test(l)));
});

test("visits accumulate across sbl.so and the dashboard without a new visit", () => {
  const a = setup();
  view(a.tracker, "https://sbl.so/", "SBL");
  a.spend(5);
  const b = setup(a.saved());
  b.advance(2000);
  view(b.tracker, "https://app.secondbrainlabs.com/signup", "Sign up", "https://sbl.so/", "dashboard");
  const s = b.saved();
  assert.equal(s.visits.count, 1);
  assert.deepEqual(s.pages.map((p) => p.surface), ["website", "dashboard"]);
  assert.equal(s.entry.landingPage, "/");
});

test("the old rule-based tracker's saved fields are dropped on load", () => {
  const a = setup();
  view(a.tracker, "https://sbl.so/", "SBL");
  const old = { ...a.saved(), items: { x: 1 }, clicks: [1], prior: ["pricing"], modelInferences: { intent: {} } };
  const s = setup(old).saved();
  assert.equal(s.items, undefined);
  assert.equal(s.modelInferences, undefined);
});

test("clicking an input stores only a label, never a value", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  const input = { tagName: "INPUT", value: "secret@example.com", innerText: "secret@example.com", getAttribute: (n) => ({ "aria-label": "Email" })[n] || "" };
  h.tracker.click({ label: labelFor(input), value: input.value });
  const textarea = { tagName: "TEXTAREA", value: "my private note", innerText: "my private note", getAttribute: () => "" };
  h.tracker.click({ label: labelFor(textarea) });
  assert.ok(!/secret@example|private note/.test(JSON.stringify(h.saved())));
});

test("rows, names, emails and composers never become stored text; on the dashboard not even selections or hovers", () => {
  const h = setup();
  h.tracker.pageview({ url: "https://app.secondbrainlabs.com/chat?utm_email=a@b.com&utm_source=x", title: "", surface: "dashboard" });
  const el = (tagName, innerText, extra = {}) => ({ tagName, innerText, getAttribute: () => "", ...extra });
  assert.equal(labelFor(el("A", "Jane Doe jane@acme.com")), "");
  assert.equal(labelFor(el("A", "Jane Doe")), "");
  assert.equal(labelFor(el("H2", "Acme Corp Q3 Campaign")), "");
  assert.equal(labelFor(el("A", "Pricing")), "Pricing");
  assert.equal(labelFor(el("DIV", "Pricing draft", { querySelector: () => ({}) })), "");
  assert.equal(labelFor(el("A", "Pricing", { querySelector: () => ({}) })), "");
  h.tracker.click({ label: "jane@acme.com" });
  h.tracker.expose("section", "Jane Doe", true);
  h.tracker.rest("Sarah Connor", 900);
  h.tracker.select("Sarah Connor called me");
  h.spend(5);
  const s = h.saved(), text = JSON.stringify(s) + h.tracker.summary().digest.join("\n");
  assert.deepEqual(s.entry.utm, { utm_source: "x" });
  assert.ok(!/jane|acme|@|sarah|connor/i.test(text), text);
  assert.ok(s.events.some((e) => e.k === "select" && e.text === ""), "the selection is recorded as a fact, without its words");
});

test("website labels allow numbers and ordinary words, but never emails or links; selections too", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  const el = (tagName, innerText) => ({ tagName, innerText, getAttribute: () => "" });
  assert.equal(labelFor(el("H2", "How it works"), "website"), "How it works");
  assert.equal(labelFor(el("H2", "5,000+ teams"), "website"), "5,000+ teams");
  assert.equal(labelFor(el("H2", "x".repeat(100)), "website").length, 60);
  assert.equal(labelFor(el("A", "mail jane@acme.com"), "website"), "");
  assert.equal(labelFor(el("A", "see https://x.co"), "website"), "");
  h.tracker.select("write to jane@acme.com");
  h.tracker.select("unlimited workspaces");
  const texts = h.saved().events.filter((e) => e.k === "select").map((e) => e.text);
  assert.deepEqual(texts, ["", "unlimited workspaces"]);
});

test("a hidden tab never saves, and a sleep gap is a break, not dwell", () => {
  const h = setup();
  view(h.tracker, "https://sbl.so/", "SBL");
  h.spend(10);
  h.tracker.flush();
  const before = JSON.stringify(h.saved());
  h.tracker.visibility(true);
  h.advance(60_000);
  h.tracker.click({ label: "Pricing" });
  h.tracker.flush();
  assert.equal(JSON.stringify(h.saved()), before);
});
