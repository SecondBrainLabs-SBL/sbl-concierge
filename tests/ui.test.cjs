const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { clampPosition, stateFor, firstNotHost } = require("../cursor.js");
const src = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const count = (re) => (src.match(re) || []).length;

test("all eight dock states are styled and driven by data-state", () => {
  for (const s of ["resting", "invitation", "conversation", "listening", "thinking", "acting", "needs-user", "complete"]) {
    if (s !== "resting") assert.match(src, new RegExp(`data-state="${s}"\\]`), s);
    assert.equal(stateFor({ [{ invitation: "invite", conversation: "open", listening: "listening", thinking: "thinking", acting: "acting", "needs-user": "needsUser", complete: "complete" }[s]]: true }), s === "resting" ? "resting" : s);
  }
  assert.equal(stateFor({}), "resting");
  assert.equal(stateFor({ open: true, thinking: true, needsUser: true }), "needs-user");
});

test("clampPosition keeps the dock inside the viewport", () => {
  const vp = { width: 1000, height: 700 };
  assert.deepEqual(clampPosition(-50, -50, vp), { x: 188, y: 8 });
  assert.deepEqual(clampPosition(5000, 5000, vp), { x: 812, y: 636 });
  assert.deepEqual(clampPosition(500, 300, vp), { x: 500, y: 300 });
  assert.equal(clampPosition(0, 0, { width: 320, height: 600 }).x, 160); // narrow: pinned to centre
});

test("accessibility: live region, reduced motion, Escape, keyboard move, focus ring", () => {
  assert.match(src, /class="latest" aria-live="polite"/);
  assert.match(src, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(src, /event\.key === "Escape"/);
  assert.match(src, /ArrowLeft/);
  assert.match(src, /:focus-visible/);
  assert.match(src, /aria-label="Move SBL dock/);
});

test("dock is draggable, resets on double-click, remembers its place", () => {
  assert.match(src, /pointerdown/);
  assert.match(src, /dblclick/);
  assert.match(src, /POS_KEY = "sbl_dock_pos_v1"/);
});

test("mic denial has one message path; the brain replaces the human avatar", () => {
  assert.equal(count(/const MIC_DENIED/), 1);
  assert.equal(count(/say\(MIC_DENIED\)/), 1);
  assert.match(src, /getURL\("assets\/sbl-brain\.png"\)/);
  assert.doesNotMatch(src, /data:image\/png;base64/);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  const war = manifest.web_accessible_resources.flatMap((entry) => entry.resources);
  assert.ok(war.includes("assets/sbl-brain.png") && !war.some((name) => /avatar/.test(name)));
  assert.doesNotMatch(src, /getURL\("assets\/sales-agent-avatar/);
  assert.ok(fs.statSync(path.join(__dirname, "..", "assets", "sbl-brain.png")).size > 1000);
});

test("no scripted step labels are rendered", () => {
  assert.doesNotMatch(src, /Step \d|Step \$\{|Understand your business|STEP_NAMES|setStep/);
});

test("the dock never counts as the element covering a click target", () => {
  const host = { id: "sbl-sales-concierge-root" }, button = { id: "go" };
  assert.equal(firstNotHost([host, button]), button);
  assert.equal(firstNotHost([host]), undefined);
  assert.equal(stateFor({ listening: true, complete: true }), "complete");
});

test("review fixes: escape in capture, pointer capture, no goal in header", () => {
  assert.match(src, /addEventListener\("keydown"[\s\S]{0,200}composedPath\(\)\.includes\(host\)/);
  assert.match(src, /setPointerCapture/);
  assert.match(src, /pointercancel/);
  assert.match(src, /--room/);
  assert.doesNotMatch(src, /stepLabel\.textContent = goal/);
});

test("voice start is guarded before its first await, and the mic card goes inert once used", () => {
  assert.match(src, /connecting = true;[^\n]*\n\s*voiceButton\.disabled = true;[\s\S]{0,240}await navigator\.permissions/);
  assert.match(src, /if \(state\.realtime \|\| state\.ears \|\| connecting/);
  assert.match(src, /closeMicCard = \(\) => \{[^}]*disabled = true/);
});

test("the voice is two sessions: ears (never heard) and mouth (never hears)", () => {
  assert.match(src, /function mouthInputTrack\(\)/, "the mouth gets a locally generated tone: it can never hear the visitor");
  assert.match(src, /stopMouthSpeech/, "barge-in: the mouth's playback stops when the visitor talks");
  assert.match(src, /session\.output_transcript\.delta is deliberately ignored/, "the ears' output is never drawn or recorded");
  assert.match(src, /sessionOffer\(ears, "ears"\)/, "the ears session is created as role ears");
  assert.match(src, /speakerEcho/, "a transcribed line that repeats what was just said aloud is dropped (speaker echo)");
});
