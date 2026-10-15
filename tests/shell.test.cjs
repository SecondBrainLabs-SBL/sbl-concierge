const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");

// The shell (step 2): the history stack's placement rules, the boot rule (top/guest/none), and the wiring
// that must exist for Talk to turn a page into the shell.
const shell = require("../shell.js"); // node: the pure helpers only (the browser wiring stands down without window/document)

test("normalizeUrl: the stack key drops the hash and keeps path and search", () => {
  assert.equal(shell.normalizeUrl("https://sbl.so/case-study/#respond"), "https://sbl.so/case-study/");
  assert.equal(shell.normalizeUrl("https://sbl.so/pricing/?coupon=SBL20"), "https://sbl.so/pricing/?coupon=SBL20");
  assert.equal(shell.normalizeUrl("/pricing/"), "https://x.invalid/pricing/", "a relative input still normalizes, never throws");
  assert.equal(shell.normalizeUrl("https://[bad"), null);
});

test("place: a new page is appended after pos and drops forward entries; a known page reuses its entry", () => {
  const stack = [
    { key: "https://sbl.so/pricing/", url: "https://sbl.so/pricing/", title: "", scroll: 0 },
    { key: "https://sbl.so/case-study/", url: "https://sbl.so/case-study/", title: "", scroll: 0 },
    { key: "https://sbl.so/linkedin/expandi/", url: "https://sbl.so/linkedin/expandi/", title: "", scroll: 0 },
  ];
  // Back to the listing (a traversal): the same entry, no duplicate.
  assert.deepEqual(shell.place(stack, 2, "https://sbl.so/case-study/"), { stack, pos: 1 });
  // A fresh click from the middle of history: the forward entry is dropped, the new page follows pos.
  const placed = shell.place(stack, 1, "https://sbl.so/pricing-plans/");
  assert.equal(placed.pos, 2);
  assert.equal(placed.stack.length, 3);
  assert.equal(placed.stack.at(-1).key, "https://sbl.so/pricing-plans/");
  assert.ok(!placed.stack.some((e) => e.key === "https://sbl.so/linkedin/expandi/"), "the forward entry was dropped");
  // The same URL can never appear twice.
  const twice = shell.place(placed.stack, 2, "https://sbl.so/pricing/");
  assert.equal(twice.pos, 0);
  assert.equal(twice.stack.filter((e) => e.key === "https://sbl.so/pricing/").length, 1);
});

// The boot rule is one function in tools/build-agent.mjs whose source is inlined into the bundle: this test
// calls the same function the bundle runs, with fake globals, then restores them.
test("boot rule: top of the two SBL origins = main, shell frame on sbl.so = guest, everything else = none", async () => {
  const { bootMode } = await import("../tools/build-agent.mjs");
  const keep = { window: globalThis.window, location: globalThis.location };
  const set = (w, loc) => { globalThis.window = w; globalThis.location = loc; };
  const top = {}; top.top = top;
  try {
    set(top, { href: "https://sbl.so/pricing/", hostname: "sbl.so" });
    assert.equal(bootMode(), "main");
    set(top, { href: "https://app.secondbrainlabs.com/signup", hostname: "app.secondbrainlabs.com" });
    assert.equal(bootMode(), "main");
    set(top, { href: "https://example.com/", hostname: "example.com" });
    assert.equal(bootMode(), "none");
    const frame = {}; frame.top = top; frame.frameElement = { id: "sbl-shell-frame" };
    set(frame, { href: "https://sbl.so/case-study/", hostname: "sbl.so" });
    assert.equal(bootMode(), "guest");
    frame.frameElement = { id: "ad-frame-7" };
    assert.equal(bootMode(), "none", "a foreign frame never boots anything");
    Object.defineProperty(frame, "frameElement", { get() { throw new Error("cross-origin"); } });
    assert.equal(bootMode(), "none", "a cross-origin parent is not ours");
    // An app page inside the frame is impossible by construction (the interceptor hops it) — so it is none.
    frame.frameElement = { id: "sbl-shell-frame" };
    set(frame, { href: "https://app.secondbrainlabs.com/signup", hostname: "app.secondbrainlabs.com" });
    assert.equal(bootMode(), "none");
  } finally {
    if (keep.window === undefined) delete globalThis.window; else globalThis.window = keep.window;
    if (keep.location === undefined) delete globalThis.location; else globalThis.location = keep.location;
  }
});

test("the bundle and manifest carry the shell: guest branch in the wrapper, shell.js before content.js, store first", async () => {
  const { build } = await import("../tools/build-agent.mjs");
  build(); // regenerates sbl-agent.js (gitignored) from the current sources
  const manifest = JSON.parse(readFileSync(path.join(__dirname, "../manifest.json"), "utf8"));
  const js = manifest.content_scripts[0].js;
  assert.ok(js.indexOf("core/store.js") === 0, "store first: everything else may use it");
  assert.ok(js.indexOf("shell.js") < js.indexOf("content.js"), "shell.js before content.js");
  const bundle = readFileSync(path.join(__dirname, "../sbl-agent.js"), "utf8");
  assert.match(bundle, /sbl-shell-frame/, "the wrapper knows the shell frame");
  assert.match(bundle, /SBL_SHELL_GUEST/, "the wrapper exposes the guest mode flag");
  const content = readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(content, /if \(globalThis\.SBL_SHELL_GUEST\) return;/, "content.js stands down inside the shell frame");
  assert.match(content, /if \(!dashboard && !globalThis\.chrome\?\.runtime\?\.id\) \{ try \{ globalThis\.SBLSHELL\?\.build\(\)/,
    "voice connecting builds the shell — script-tag mode ONLY (the extension keeps its per-page-load behavior)");
  assert.match(content, /SBLSHELL\?\.wire\(\{ tracker: visitor \}\)/, "the tracker is wired into the shell");
  assert.match(content, /SBLSHELL\?\.active\?\.\(\)/, "trackRoute stands down inside the shell");
  const harness = readFileSync(path.join(__dirname, "../harness.js"), "utf8");
  assert.match(harness, /SBLSHELL\?\.active\?\.\(\)[\s\S]{0,400}SBLSHELL\.go\(target\.href\)/, "agent navigate goes through the shell frame");
  const shellSource = readFileSync(path.join(__dirname, "../shell.js"), "utf8");
  assert.match(shellSource, /pointer-events:none/, "the snapshot overlay can never eat a click, even stale");
  assert.match(shellSource, /overlay\.style\.visibility = "hidden"[\s\S]{0,80}\/\/ the snapshot yields[\s\S]{0,200}firstReveal/, "frameLoad hides the overlay when the new page loads");
  assert.match(shellSource, /if \(!ok\) overlay\.style\.visibility = "hidden";/, "a move that times out hides the overlay too");
  assert.match(shellSource, /pointerdown[\s\S]{0,400}pointerup[\s\S]{0,200}hopFrom/, "the app hop commits on the trusted press (pointerup on the same link), not only on click");
});

test("the shell module exposes what content.js and the harness call", () => {
  for (const name of ["build", "wire", "go", "active", "move", "normalizeUrl", "place"]) assert.ok(name in shell, `SBLSHELL.${name}`);
});
