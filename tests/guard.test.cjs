const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../core/guard.js");

test("consequential controls are caught", () => {
  for (const label of ["Run Campaign", "Launch", "Launch campaign", "Pause Campaign", "Resume", "End campaign", "Run for new leads", "Turn on conversations",
    "Pay now", "Buy credits", "Checkout", "Subscribe", "Upgrade", "Purchase", "Hire a profile instead — skip and create campaign",
    "Delete", "Remove", "Archive campaign", "Disconnect", "Send", "Send message", "Import leads", "Import to campaign", "Invite member", "Send invite",
    "Approve", "Send now", "Send connection request", "Rent", "Rent profile", "Pay", "Pay $99", "Extract", "Extract leads"]) {
    assert.ok(G.consequential([label]), `${label} must go through the confirmation card`);
  }
});

test("signing up, logging in, drafts and generating are the agent's to do", () => {
  for (const label of ["Sign up", "Sign up free", "Start your free trial", "Try for free", "Get started", "Log in", "Continue", "Next", "Submit",
    "Create Campaign", "Create account", "New Campaign", "Generate", "Generate ideas", "Enhance", "Save draft", "Pricing", "Book a demo", "See plans"]) {
    assert.equal(G.consequential([label]), null, `${label} must not be gated`);
  }
});

test("false positives: verification codes, prose that mentions a verb, long marketing text and field labels are not gated", () => {
  for (const label of ["Send code", "Send verification email", "Resend code", "Campaigns", "Running", "Payment methods are listed in Billing", "Suspend", "Approved", "Extraction settings", "Parent", "Payment history"]) {
    assert.equal(G.consequential([label]), null, label);
  }
  // a whole card whose text mentions delete or pause is judged per short line, not as one blob
  assert.equal(G.consequential(["Cold outreach case study: how we helped a creator generate pipeline and never had to delete or pause a campaign again"]), null);
  assert.equal(G.consequential(["Outbound that books meetings\nRead the story"]), null);
  assert.ok(G.consequential(["Reach the founders\nDelete"]), "a short line inside a bigger control still counts");
  assert.ok(G.consequential(["", "Pause"]), "any of the control's labels counts (aria-label, title)");
  assert.equal(G.consequential(null), null);
});

test("secrets are masked wherever they appear, and short strings are left alone", () => {
  assert.equal(G.maskSecrets("[3]<input type=password value=hunter2 /> and hunter2 again", ["hunter2"]), "[3]<input type=password value=[hidden] /> and [hidden] again");
  assert.equal(G.maskSecrets("ab", ["ab"]), "ab", "2 characters would garble ordinary text");
  assert.equal(G.maskSecrets("nothing here", []), "nothing here");
  assert.equal(G.maskSecrets(undefined, ["abcdef"]), "");
  const scope = { querySelectorAll: (sel) => (/input\[type=password\]/.test(sel) ? [{ value: "s3cret!" }, { value: "" }] : []) };
  assert.deepEqual(G.passwordValues(scope), ["s3cret!"]);
});

test("target=_blank links and forms are rewritten to the same tab", () => {
  const holder = { target: "_blank" };
  const inner = { closest: (sel) => (/a\[target\]/.test(sel) ? holder : null) };
  assert.equal(G.sameTab(inner), true);
  assert.equal(holder.target, "_self");
  assert.equal(G.sameTab(inner), false, "already same tab");
  assert.equal(G.sameTab({ closest: () => null }), false);
  assert.equal(G.sameTab(null), false);
});

test("the agent only takes the visitor to SBL pages", () => {
  for (const u of ["https://sbl.so/pricing/", "https://app.secondbrainlabs.com/signup"]) assert.equal(G.isSblUrl(u), true, u);
  for (const u of ["https://evil.example/sbl.so", "https://sbl.so.evil.com/", "javascript:alert(1)", "not a url", "https://notsbl.so/", "https://www.sbl.so/", "https://client.secondbrainlabs.com/", "http://sbl.so/"]) assert.equal(G.isSblUrl(u), false, u);
});

test("what the visitor reads is plain text", () => {
  assert.equal(G.plain("**Pro** is [here](https://sbl.so/pricing/)\n- one\n# Head"), "Pro is here one Head");
  assert.equal(G.plain("test_user@example.com `x`"), "test_user@example.com x");
});

test("a control inside a consequential dialog is consequential, whatever it is called; cancelling is not", () => {
  const dialog = ["Delete campaign?", "This cannot be undone."];
  for (const label of ["Confirm", "Yes", "OK", "Continue", "Delete"]) assert.ok(G.inDialog(dialog, [label]), label);
  for (const label of ["Cancel", "Close", "No", "Not now", "Back"]) assert.equal(G.inDialog(dialog, [label]), null, label);
  assert.equal(G.inDialog(["Welcome to SBL", "Pick a plan"], ["Continue"]), null, "an ordinary dialog is not gated");
  assert.equal(G.inDialog(["Send invite to your team?"], ["Confirm"]) !== null, true);
});

test("an unnamed icon button in a message composer or action bar is consequential; elsewhere it is not", () => {
  assert.ok(G.unlabeled([], true));
  assert.ok(G.unlabeled(["", " "], true));
  assert.equal(G.unlabeled([], false), null);
  assert.equal(G.unlabeled(["Attach"], true), null, "a named control is judged by its name");
});

test("password masking also covers a revealed password (type=text toggle)", () => {
  
  const fields = [{ value: "abc12345", matches: () => true }, { value: "", matches: () => true }];
  const scope = { querySelectorAll: (sel) => (/autocomplete\*="password" i/.test(sel) && /name\*="pass" i/.test(sel) && /id\*="pass" i/.test(sel) ? fields : []) };
  assert.deepEqual(G.passwordValues(scope), ["abc12345"]);
  assert.equal(G.isPasswordField({ matches: () => true }), true);
  assert.equal(G.isPasswordField({ matches: () => false }), false);
  assert.equal(G.isPasswordField(null), false);
});

test("overlap: containment is 1.0 (an echo, the mouth reading two lines as one), a re-wording is high, new content is low", () => {
  const line1 = "Here's the core idea: SBL finds intent-rich buyers, runs the conversation, and hands you qualified meetings.";
  const line2 = "Absolutely — I'll take you to the use cases so you can compare the main ways teams use SBL.";
  const concat = "Here's the core idea: SBL finds intent-rich buyers, runs the conversation, and hands you qualified meetings.Absolutely — I'll take you to the use cases so you can compare the main ways teams use SBL.";
  assert.equal(G.overlap(concat, line1), 1, "the concatenated echo contains the whole first line");
  assert.ok(G.overlap(concat, line2) >= 0.9, "and the whole second line");
  // the founder's re-word loop: the same strategy, three wordings
  const s1 = "The strategy was a three-day, persona-led LinkedIn system: target the right finance buyers, tailor messages to their triggers, then scale carefully across six profiles.";
  const s2 = "The strategy is laid out here: define finance-specific personas and triggers first, then run tightly controlled, human-sounding outreach across six profiles.";
  assert.ok(G.overlap(s1, s2) >= 0.25, `a re-worded repeat clears the within-turn bar (got ${G.overlap(s1, s2).toFixed(2)})`);
  assert.ok(G.overlap("The campaign added $60,000 in monthly pipeline in its first 30 days.", "The strategy was a three-day persona-led LinkedIn system with triggers and QA-checked outreach.") < 0.4, "different content stays low");
  assert.equal(G.overlap("", line1), 0);
});

test("topicWords: content words and amounts, no stopwords or twits", () => {
  const t = G.topicWords("Yes—the campaign added $60,000 in monthly pipeline in its first 30 days, using six LinkedIn profiles and no ads or cold email.");
  assert.ok(t.includes("campaign"), JSON.stringify(t));
  assert.ok(t.includes("$60,000"), "amounts survive");
  assert.ok(t.includes("pipeline"));
  assert.ok(!t.includes("the") && !t.includes("in"), "stopwords are gone");
  const s = G.topicWords("The strategy is laid out here: define finance-specific personas and triggers first, then run tightly controlled outreach.");
  assert.ok(s.includes("strategy") && s.includes("finance"), JSON.stringify(s));
});
