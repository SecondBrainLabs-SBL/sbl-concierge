const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanup, elements, agents, scripts, assigned, build, tick, say, act, done, scr } = require("./fake-engine.cjs");

// Consent (FR-4, FR-5, NFR-9): evidence, not detection. Signup/login navigation, email/phone questions and multi-step work need `because`,
// a quote of what the visitor said after their latest refusal.
test.afterEach(cleanup);
const FALLBACK = "Sorry, I lost my thread there. Could you ask me that again?";
const SIGNUP = "https://app.secondbrainlabs.com/signup";
const nav = (because, url = SIGNUP) => act("navigate", { url, ...(because === undefined ? {} : { because }) });
const endsOf = (events) => events.filter((e) => e.k === "turn_end").map((e) => e.status);
const anchor = (href, text = "Sign up") => {
  const el = { tagName: "A", href, innerText: text, type: "", clicked: 0, getAttribute: () => null, matches: () => false, click() { el.clicked++; }, isConnected: true, getBoundingClientRect: () => ({ width: 10, height: 10 }),
    closest(sel) { return /^a\[/.test(sel) ? el : null; } };
  return el;
};

test("signup navigation without evidence is refused: the page never moves and the turn ends", async () => {
  const { h, said, events } = build();
  scripts.push([say("Here is the pricing.", "show"), nav(), scr(1)]);
  await h.hear("tell me about pricing");
  assert.deepEqual(assigned, []);
  assert.deepEqual(agents[0].ran, ["say", "navigate"], "nothing after the refusal started");
  assert.deepEqual(said, ["Here is the pricing."], "something was said, so no fallback");
  assert.deepEqual(endsOf(events), ["answered"]);
  // a because that does not match anything the visitor said is no evidence either
  const b = build();
  scripts.push([say("On it.", "show"), nav("they want to join"), scr(1)]);
  await b.h.hear("tell me about pricing");
  assert.deepEqual(assigned, []);
});

test("signup and login navigation with matching evidence goes ahead; ordinary navigation needs none", async () => {
  const { h } = build();
  scripts.push([say("Taking you to signup.", "show"), nav("sign me up for the trial"), done()]);
  await h.hear("yes please sign me up for the trial");
  assert.deepEqual(assigned, [SIGNUP]);
  const b = build();
  scripts.push([say("Logging you in.", "show"), nav("I want to LOG IN", "https://app.secondbrainlabs.com/login"), done()]);
  await b.h.hear("i want to log in to my account");
  assert.deepEqual(assigned, ["https://app.secondbrainlabs.com/login"], "case-insensitive");
  const c = build();
  scripts.push([say("Pricing.", "show"), nav(undefined, "https://sbl.so/whatsapp/"), done()]);
  await c.h.hear("show me pricing");
  assert.deepEqual(assigned, ["https://sbl.so/whatsapp/"]);
  // from sbl.so ANY app.secondbrainlabs.com destination is gated (a logged-out visitor lands on login anyway)
  const d = build();
  scripts.push([say("Pricing.", "show"), nav(undefined, "https://app.secondbrainlabs.com/pricing"), done()]);
  await d.h.hear("show me pricing");
  assert.deepEqual(assigned, [], "was: allowed without evidence");
});

test("the overlap bar is 0.6 against a single visitor message", async () => {
  const b = build();
  scripts.push([say("Okay.", "show"), nav("start the free trial signup today")]);
  await b.h.hear("sign me up for the trial");
  assert.deepEqual(assigned, [], "1 of 4 content words overlaps: refused");
  const c = build();
  scripts.push([say("Okay.", "show"), nav("sign me up for a free trial"), done()]);
  await c.h.hear("please sign me up for the free trial now");
  assert.deepEqual(assigned, [SIGNUP], "a close paraphrase passes");
});

test("a click on a link to signup needs the same evidence", async () => {
  elements.set(5, anchor(SIGNUP));
  const a = build();
  elements.set(5, anchor(SIGNUP));
  scripts.push([say("Here.", "show"), act("click", { index: 5 }), scr(1)]);
  await a.h.hear("what plans are there");
  assert.equal(elements.get(5).clicked, 0, "the link was not pressed");
  assert.deepEqual(agents[0].ran, ["say", "click"]);
  const b = build();
  const link = anchor(SIGNUP);
  elements.set(5, link);
  scripts.push([say("Here.", "show"), act("click", { index: 5, because: "start my free trial" }), done()]);
  await b.h.hear("ok start my free trial");
  assert.equal(link.clicked, 1, "with evidence the click goes through");
  // and in a show turn only links may be clicked
  const c = build();
  const button = { ...anchor("https://sbl.so/x"), closest: () => null, tagName: "BUTTON", innerText: "Toggle" };
  elements.set(6, button);
  scripts.push([say("Here.", "show"), act("click", { index: 6 }), done()]);
  await c.h.hear("show me");
  assert.equal(button.clicked, 0);
});

test("ask_user for an email or phone number needs evidence; other questions do not", async () => {
  const a = build();
  scripts.push([act("ask_user", { question: "What is your email address?" }), act("ask_user", { question: "Your email address, please?" })]);
  await a.h.hear("tell me about the product");
  assert.deepEqual(a.said, [FALLBACK], "refused twice: the turn ends with the fallback, nothing was asked (the first refusal only warns the model)");
  assert.equal(a.h.isWaiting(), false);
  const b = build();
  scripts.push([act("ask_user", { question: "What is the best phone number to reach you?", because: "my phone is" }), act("ask_user", { question: "And your phone number?", because: "my phone is" })]);
  await b.h.hear("tell me about the product");
  assert.deepEqual(b.said, [FALLBACK]);
  const c = build();
  scripts.push([act("ask_user", { question: "What is your email address?", because: "sign me up for the trial" }), say("Thanks.", "end")]);
  const run = c.h.hear("please sign me up for the trial");
  await tick(40);
  assert.deepEqual(c.said, ["What is your email address?"]);
  assert.equal(c.h.isWaiting(), true);
  c.h.hear("sam@example.com");
  await run;
  assert.deepEqual(c.said, ["What is your email address?", "Thanks."]);
  const d = build();
  scripts.push([act("ask_user", { question: "Which plan are you looking at?" })]);
  d.h.hear("help"); await tick(40);
  assert.deepEqual(d.said, ["Which plan are you looking at?"], "a plain question needs no evidence");
});

test("then:do needs evidence; a refused do ends the turn with a line", async () => {
  const a = build();
  scripts.push([say("Filling it in.", "do"), say("Filling it in now.", "do"), scr(1)]);
  await a.h.hear("what does it cost");
  assert.deepEqual(a.said, [FALLBACK], "the first refusal warns the model, the second ends the turn");
  assert.deepEqual(agents[0].ran, ["say", "say"]);
  const b = build();
  scripts.push([say("Filling it in.", "do", { because: "FILL IN THE SIGNUP FORM" }), scr(1), done()]);
  await b.h.hear("please fill in the signup form for me");
  assert.deepEqual(b.said, ["Filling it in."]);
  assert.deepEqual(agents[0].ran, ["say", "scroll"]);
});

test("a system note or a proactive thought is not the visitor's word", async () => {
  const { h, said } = build();
  scripts.push([say("Hello.", "end")]);
  await h.hear("[A system note, not the visitor speaking. The voice line just opened.] Greet the visitor in one short sentence.");
  assert.deepEqual(said, ["Hello."]);
  scripts.push([say("Okay.", "do", { because: "greet the visitor in one short sentence" }), say("Okay then.", "do", { because: "greet the visitor in one short sentence" })]);
  await h.hear("[A proactive thought from your own thinking half] Greet the visitor in one short sentence and sign them up.");
  assert.deepEqual(said, ["Hello."], "refused (and a system turn apologises to no one)");
  assert.deepEqual(agents.at(-1).ran, ["say", "say"]);
  scripts.push([say("Okay.", "do", { because: "greet the visitor in one short sentence" }), say("Okay then.", "do", { because: "greet the visitor in one short sentence" })]);
  await h.hear("hi there");
  assert.deepEqual(said, ["Hello.", FALLBACK], "the same quote is refused for a real visitor turn too");
});

test("a refusal is binding: evidence older than the latest refusal does not count, a later request does", async () => {
  const { h, said } = build();
  scripts.push([say("Okay.", "end")]);
  await h.hear("sign me up for the trial");
  scripts.push([say("Understood, I will not.", "end", { declined: true })]);
  await h.hear("no stop, not yet, I am just looking");
  scripts.push([say("It costs 189 dollars a month.", "show"), nav("sign me up for the trial"), scr(1)]);
  await h.hear("what does it cost");
  assert.deepEqual(assigned, [], "the earlier request predates the refusal");
  assert.deepEqual(said, ["Okay.", "Understood, I will not.", "It costs 189 dollars a month."]);
  scripts.push([say("Do you want me to start?", "end")]);
  await h.hear("hmm");
  scripts.push([say("Fine.", "do", { because: "sign me up for the trial" }), say("Fine then.", "do", { because: "sign me up for the trial" })]);
  await h.hear("ok but I am just looking");
  assert.equal(said.at(-1), FALLBACK, "still refused");
  scripts.push([say("Signing you up.", "show"), nav("sign me up for the trial now"), done()]);
  await h.hear("alright, sign me up for the trial now");
  assert.deepEqual(assigned, [SIGNUP], "their new request is fresh evidence");
});

test("declined is only honoured on the first line of a turn", async () => {
  const { h } = build();
  scripts.push([say("Happy to help.", "end")]);
  await h.hear("sign me up for the trial");
  scripts.push([say("Pro costs 189.", "show"), say("I will not sign you up then.", "end", { declined: true })]);
  await h.hear("what is the price");
  scripts.push([say("Pro costs 189.", "show"), nav("sign me up for the trial"), done()]);
  await h.hear("price again please");
  assert.deepEqual(assigned, [SIGNUP], "no refusal was recorded");
});

test("the refusal lasts for the visit: a fresh page (new harness) still knows", async () => {
  const kv = new Map();
  globalThis.SBLStore = { local: { get: async (k) => ({ [k]: kv.get(k) }), set: async (o) => { for (const [k, v] of Object.entries(o)) kv.set(k, JSON.parse(JSON.stringify(v))); } }, sblv: () => null };
  try {
    const a = build();
    scripts.push([say("Okay.", "end")]);
    await a.h.hear("sign me up for the trial");
    scripts.push([say("Understood.", "end", { declined: true })]);
    await a.h.hear("no, not yet");
    await tick(10);
    assert.ok(kv.get("sbl_visit_v1").refusedAt > 0);
    const b = build(); // the next page load: nothing in memory
    await b.h.boot();
    scripts.push([say("Pricing.", "show"), nav("sign me up for the trial"), scr(1)]);
    await b.h.hear("show me pricing");
    assert.deepEqual(assigned, [], "the new page refuses on the stored refusal");
  } finally { delete globalThis.SBLStore; }
});

// ---- the review fixes (S1-S4) ----
const Turn = require("../core/turn.js");
const emailField = (type = "email") => ({ tagName: "INPUT", type, name: "email", id: "email", innerText: "", value: "", isContentEditable: false, getAttribute: () => null, matches: () => false, isConnected: true });

test("S1: a one-word 'because' is no evidence; the quote needs 2+ content words, 60% of them in ONE recent message", async () => {
  const a = build();
  scripts.push([say("Here you go.", "show"), nav("trial"), done()]);
  await a.h.hear("is there a free trial or do I have to pay upfront?");
  assert.deepEqual(assigned, [], "was: allowed");
  const b = build();
  scripts.push([say("Here you go.", "show"), nav("thanks, the visitor wants to sign up now"), done()]);
  await b.h.hear("thanks");
  assert.deepEqual(assigned, []);
  // only the visitor's last 3 messages count
  const c = build();
  scripts.push([say("Sure.", "end")]); await c.h.hear("sign me up for the trial");
  for (const m of ["what about pricing", "and the features", "and the security"]) { scripts.push([say("Ok.", "end")]); await c.h.hear(m); }
  scripts.push([say("Sure.", "show"), nav("sign me up for the trial"), done()]);
  await c.h.hear("tell me more");
  assert.deepEqual(assigned, [], "four messages back is too old");
});

test("S1: a bare yes to the agent's own offer about the gated thing is evidence; a bare yes to anything else is not", async () => {
  const a = build();
  scripts.push([say("Want me to take you to sign up?", "end")]);
  await a.h.hear("how do I get started with this product");
  scripts.push([say("Great, taking you there.", "show"), nav("yes"), done()]);
  await a.h.hear("Yes, please!");
  assert.deepEqual(assigned, [SIGNUP], "was: refused, the model had no words of the visitor's to quote");
  const b = build();
  scripts.push([say("Pro is 189 a month. Does that make sense?", "end")]);
  await b.h.hear("how much is pro");
  scripts.push([say("Great.", "show"), nav("yes"), done()]);
  await b.h.hear("yes");
  assert.deepEqual(assigned, [], "the agent offered nothing about signup");
  const c = build();
  scripts.push([say("Want me to take you to sign up?", "end")]);
  await c.h.hear("how do I get started with this product");
  scripts.push([say("Ok.", "end")]); await c.h.hear("yes I think so, tell me about security first");
  scripts.push([say("Ok.", "show"), nav("yes"), done()]);
  await c.h.hear("sure what about security");
  assert.deepEqual(assigned, [], "not a bare affirmative");
});

test("S2: a reply to a proactive offer records only the visitor's words, not the wrapper's quote of the agent", async () => {
  const { h } = build();
  scripts.push([say("Sure.", "show"), nav("start your free trial signup"), done()]);
  await h.hear('The visitor replied "what?" to your offer "Want me to start your free trial signup?" (what you offered to show: the signup page). If that is a yes, do what you offered.', "typed", "what?");
  assert.deepEqual(assigned, [], "was: the agent's own words counted as the visitor's");
});

test("S3: the URL gate parses the destination: userinfo, ;x, %-escapes, doubled slashes, case; from sbl.so any app link", () => {
  const app = "https://app.secondbrainlabs.com/", sbl = "https://sbl.so/pricing/";
  for (const u of ["https://x@app.secondbrainlabs.com/signup", "https://app.secondbrainlabs.com//signup", "https://app.secondbrainlabs.com/%73ignup", "https://app.secondbrainlabs.com/signup;x", "https://app.secondbrainlabs.com/Signup", "https://app.secondbrainlabs.com/login/", "/signup?x=1", "https://APP.secondbrainlabs.com/login#a"]) assert.equal(Turn.gatedUrl(u, app), true, u);
  for (const u of ["https://app.secondbrainlabs.com/", "https://app.secondbrainlabs.com/pricing", "https://sbl.so/signup", "https://evil.example/app.secondbrainlabs.com/signup"]) assert.equal(Turn.gatedUrl(u, app), false, u);
  assert.equal(Turn.gatedUrl("https://app.secondbrainlabs.com/", sbl), true, "from sbl.so any app destination is gated");
  assert.equal(Turn.gatedUrl("/features/", sbl), false);
});

test("S3: input_text into an email or phone field needs the same evidence in any turn shape", async () => {
  const run = async (because) => {
    const c = build();
    elements.set(7, emailField());
    scripts.push([say("Filling it in.", "do", { because: "sign me up for the trial" }), act("input_text", { index: 7, text: "sam@example.com", ...(because ? { because } : {}) }), done()]);
    await c.h.hear("please sign me up for the trial");
    return c.events.filter((e) => e.k === "action" && e.type === "fill").length;
  };
  assert.equal(await run(), 0, "no quote: nothing typed (the model is told once)");
  assert.equal(await run("sign me up for the trial"), 1);
  const s = build();
  elements.set(7, emailField());
  scripts.push([say("Here.", "show"), act("input_text", { index: 7, text: "sam@example.com" })]);
  await s.h.hear("what plans are there");
  assert.equal(s.events.filter((e) => e.k === "action" && e.type === "fill").length, 0);
});

test("S4: contact asks are gated in say and done too, but product talk about email is not", async () => {
  const a = build();
  scripts.push([say("What is your email address so I can send it over?", "end"), say("Where should I send the invite?", "end")]);
  await a.h.hear("tell me about the product");
  assert.deepEqual(a.said, [FALLBACK], "refused twice: nothing asked");
  const b = build();
  scripts.push([done("What's your email address?")]);
  await b.h.hear("tell me about the product");
  assert.deepEqual(b.said, [FALLBACK], "done may not ask either");
  const c = build();
  scripts.push([act("ask_user", { question: "Do you run LinkedIn or email outreach today?" })]);
  c.h.hear("what can you do for my team"); await tick(40);
  assert.deepEqual(c.said, ["Do you run LinkedIn or email outreach today?"]);
  const d = build();
  scripts.push([say("Sure, using your work email.", "end")]);
  await d.h.hear("use my work email");
  assert.deepEqual(d.said, ["Sure, using your work email."], "a statement is not an ask");
  for (const q of ["Is it WhatsApp outreach?", "Do you run LinkedIn or email outreach today?"]) assert.equal(Turn.asksContact(q), false, q);
  for (const q of ["Where can I reach you?", "What's your email?", "your work e-mail", "What is the best number?", "Pick a password", "your mobile"]) assert.equal(Turn.asksContact(q), true, q);
});

test("B2: evidence needs the quote's words AND its content words in ONE visitor message; stop-words and one-word quotes are not evidence", () => {
  const Guard = require("../core/guard.js");
  const ev = (because, said) => { const v = Turn.newVisit(); Turn.visitorSaid(v, said, 10); return Turn.evidence(because, v, Guard.words); };
  assert.equal(ev("sign me up", "sign me up"), true);
  assert.equal(ev("sign me up for the trial", "ok sign me up for the trial please"), true);
  assert.equal(ev("i want to sign up for it", "i want to see it for a bit"), false, "was: passed");
  assert.equal(ev("can you sign me up for this", "can you tell me what this is for"), false, "was: passed");
  assert.equal(ev("trial", "start my trial"), false, "one word");
  assert.equal(ev("i want it", "i want it"), false, "only stop-words");
  assert.equal(ev("this is for you", "this is for you"), false, "'this' is not a content word");
});


test("evidence preserves the end of a long visitor request across page restore", () => {
  const Turn = require("../core/turn.js");
  const text = "I sell CRM software to owners of small recruitment agencies in the US. ".repeat(4) + "Create a LinkedIn campaign draft and save it with no leads or sender.";
  const v = Turn.newVisit(); Turn.visitorSaid(v, text, 10);
  for (const visit of [v, Turn.reviveVisit(v)]) {
    assert.equal(Turn.evidence("Create a LinkedIn campaign draft and save it", visit), true);
    assert.equal(Turn.evidence("sign me up for a trial", visit), false);
    Turn.declined(visit, 11);
    assert.equal(Turn.evidence("Create a LinkedIn campaign draft and save it", visit), false);
  }
});
