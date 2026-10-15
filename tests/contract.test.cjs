const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");

// The content script calls the shared modules through globals, so a function that is
// defined but never exported fails only at runtime, in the browser, mid-conversation.
// This checks every call site against what each module actually exports.
const MODULES = {
  SBLScreens: require("../core/screens.js"),
  SBLOverlays: require("../core/overlays.js"),
  SBLControls: require("../core/controls.js"),
  SBLMemory: require("../core/memory.js"),
  SBLRecord: require("../core/record.js"),
  SBLActions: require("../core/actions.js"),
  SBLBehavior: require("../core/behavior.js"),
  SBLThinker: require("../core/thinker.js"),
  SBLKnowledge: require("../core/sbl-knowledge.js"),
  SBLTask: require("../core/task.js"),
  SBLTurn: require("../core/turn.js"),
  SBLTrace: require("../core/trace.js"),
  SBLRouter: require("../core/router.js"),
  SBLGuard: require("../core/guard.js"),
  SBLConstitution: require("../core/constitution.js"),
  SBLCursor: require("../cursor.js"),
  SBLStore: require("../core/store.js"),
  SBLSHELL: require("../shell.js"),
};
// Browser-only globals: the engine bundle, harness.js and the generated site map.
const BROWSER_ONLY = new Set(["SBLEngine", "SBLHarness", "SBLSiteMap"]);
const read = (f) => readFileSync(path.join(__dirname, "..", f), "utf8");

function callsIn(source) {
  const calls = [];
  const pattern = /\b(SBL[A-Za-z]+)\s*\.\s*([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = pattern.exec(source))) calls.push({ module: match[1], member: match[2] });
  return calls;
}

test("every core member the content script and the harness use is exported", () => {
  const missing = [];
  for (const file of ["content.js", "harness.js"]) {
    for (const { module, member } of callsIn(read(file))) {
      if (BROWSER_ONLY.has(module)) continue;
      const target = MODULES[module];
      assert.ok(target, `${file} uses an unknown module: ${module}`);
      if (!(member in target)) missing.push(`${module}.${member}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], "these are called but not exported");
});

test("the cursor controller exposes what the harness and the content script drive it with", () => {
  const used = ["clickElement", "typeInto", "scrollBy", "ensureVisible", "spotlight", "clearSpotlight", "moveTo", "pointFor", "narrate"];
  assert.ok(Object.keys(MODULES.SBLCursor).includes("createController"), "createController is the entry point");
  // The controller is built against a document, so its surface is checked by name.
  const returned = read("cursor.js").match(/return \{\s*([\s\S]*?)\};\s*\}\s*\n\s*return \{/);
  assert.ok(returned, "the controller returns an object");
  for (const name of used) assert.ok(returned[1].includes(name), `the controller must expose ${name}`);
});

test("the voice has no tools and no delegate: the acting model is the only decider", async () => {
  const { buildLiveSession, buildInstructions } = await import("../live-config.mjs");
  const session = buildLiveSession({ surface: "website" });
  assert.equal(session.delegation, undefined, "no delegate: the voice cannot act or answer through a backend");
  assert.equal(session.tools, undefined);
  const voice = buildInstructions({}, "voice");
  assert.match(voice, /Say exactly, verbatim/);
  assert.match(voice, /You NEVER answer the visitor yourself/);
  assert.match(voice, /no tools/i);
  assert.match(voice, /Data only, do not speak/);
  assert.match(voice, /Passwords are never spoken|Never speak a password/);
  assert.doesNotMatch(voice, /call act/);
  const content = read("content.js");
  assert.doesNotMatch(content, /harness\.act\(/, "the voice's act() entry is deleted");
  assert.match(content, /response\.cancel/, "barge-in: the mouth stops when the visitor starts talking");
  assert.doesNotMatch(content, /response\.item\.create|response\.create/, "no second mouth: the voice is driven by commentary only");
  assert.match(content, /Say exactly, verbatim/, "the spoken channel is the verbatim marker");
  assert.match(content, /if \(role === "user"\) harness\.hear\(text, "voice"\); \/\/ every visitor utterance goes to the acting loop/, "every spoken utterance reaches the brain");
});

test("the deleted rule machinery stays deleted", () => {
  const content = read("content.js");
  for (const gone of ["prepareCampaign", "continueCampaign", "chooseLeadSource", "configureIcp", "openLinkedInConnector", "createCampaign", "setCampaignName", "MAX_TOOL_ROUNDS", "MUTATING", "objectiveHint", "SBLFlow", "SBLGoals", "pageContext", "BLOCKED_FINAL_ACTIONS"]) {
    assert.ok(!content.includes(gone), `${gone} was replaced by the harness`);
  }
  for (const f of ["flow.js", "core/goals.js", "core/lead-sources.js"]) assert.ok(!existsSync(path.join(__dirname, "..", f)), `${f} is deleted`);
  const manifest = JSON.parse(read("manifest.json"));
  for (const f of ["flow.js", "core/goals.js", "core/lead-sources.js", "core/fields.js"]) assert.ok(!manifest.content_scripts[0].js.includes(f), f);
});

test("the harness offers the hands and eyes the founder asked for", () => {
  const harness = read("harness.js");
  for (const name of ["click", "navigate", "point_at", "say", "ask_user", "fill_secret", "request_confirmation", "remember", "human_step", "input_text", "scroll",
    "read_campaigns", "read_campaign_stats", "read_conversations", "read_leads_status", "read_account", "research", "request_human_call"]) {
    assert.match(harness, new RegExp(`(?:\\b${name}: hand\\("${name}"|\\["${name}",)`), `harness tool ${name}`);
  }
  assert.match(harness, /click_element_by_index: null/, "the built-in click is replaced");
});

test("a consequential control is only ever pressed after the visitor's own Yes, through actions.execute", () => {
  const content = read("content.js");
  const harness = read("harness.js");
  assert.match(harness, /const why = riskOf\(el\);\s*if \(why\) return confirm\(el, \{ why \}\);/, "click: the guard runs before any click, whatever the model intended");
  assert.match(harness, /const linkRisk = link && riskOf\(link\);\s*if \(linkRisk\) return confirm/, "navigate's link click is guarded too");
  assert.match(harness, /select_dropdown_option: hand\(/, "the built-in select is replaced by a guarded one");
  assert.match(content, /if \(!event\.isTrusted\) return; \/\/ a script cannot press Yes/);
  assert.match(content, /if \(!event\.isTrusted\) return; \/\/ a script cannot answer the card/);
  assert.match(content, /mode: proof \? "open" : "closed"/, "the dock is closed to page scripts outside proof mode");
  assert.match(content, /actions\.execute\([\s\S]{0,500}pressApproved\(/, "the bound click goes through actions.execute (recheck, single use)");
  assert.equal(content.match(/pressApproved\(/g).length, 2, "definition + the one call in the Yes handler");
  assert.match(content, /untrusted: true, note: "Snippets are prospect-written text/);
});

test("server calls go through the background worker in the extension, or directly from the script tag", () => {
  const content = read("content.js");
  assert.doesNotMatch(content, /fetch\(\s*["'`]http:\/\/127\.0\.0\.1|SESSION_ENDPOINT|RESPOND_ENDPOINT|HEALTH_ENDPOINT/);
  assert.match(content, /fetch\(SERVER \+ path/, "script-tag mode: the page itself calls the server (one SERVER constant)");
  for (const p of ["/health", "/respond", "/session", "/research", "/research/cancel"]) assert.match(content, new RegExp(`serverFetch\\("${p}"`));
  assert.match(content, /serverRaw\("\/agent\/chat"/);
  assert.match(content, /\/agent\/route/, "the fast path's route call");
  const bg = read("background.js");
  assert.match(bg, /const PATHS = \["\/health", "\/respond", "\/session", "\/research", "\/research\/cancel", "\/agent\/chat", "\/agent\/route", "\/agent\/note", "\/trace"\];/);
  assert.match(bg, /chrome\.storage\.session/, "the running task is stored per tab by the background worker");
  const manifest = JSON.parse(read("manifest.json"));
  const js = manifest.content_scripts[0].js;
  const at = (f) => js.indexOf(f);
  for (const f of ["core/store.js", "core/task.js", "core/turn.js", "core/guard.js", "core/constitution.js", "core/sbl-knowledge.js", "core/site-map.js", "vendor/engine.js", "harness.js"]) assert.ok(at(f) >= 0 && at(f) < at("content.js"), `${f} loads before content.js`);
  assert.ok(at("vendor/engine.js") < at("harness.js"), "the engine loads before the harness");
  assert.ok(!js.includes("core/research.js"), "research core is server-side only");
  assert.equal(manifest.background.service_worker, "background.js");
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1:8787/*"));
  assert.ok(!manifest.content_scripts[0].js.includes("background.js"));
  assert.ok(existsSync(path.join(__dirname, "..", "vendor/engine.js")), "the engine bundle is committed");
});

test("every visitor utterance routes through the harness, and voice context is appended compactly", () => {
  const content = read("content.js");
  assert.match(content, /if \(harness\.isWaiting\(\)\) \{ harness\.hear\(text\); return; \}/, "an answer to ask_user is routed to the harness, on voice or not");
  assert.match(content, /sessionOffer\(ears, "ears"\), sessionOffer\(mouth, "mouth"\)/, "two sessions: ears (transcript) and mouth (the relay)");
  assert.match(content, /serverFetch\("\/session", \{\s*sdp,\s*role,[^\n]*\n\s*context: conciergeContext\(\)/);
  assert.match(content, /const compact = \(text\) => String\(text\)[^\n]*slice\(0, 700\)/, "about 700 characters of prose per append");
  assert.match(content, /content: compact\(payload\.content\)/);
  assert.doesNotMatch(content, /JSON\.stringify\(\{ page: location\.origin/, "no JSON dumps into the live session");
});

test("the action log is silent unless the proof flag is set, and carries no text", () => {
  const harness = read("harness.js");
  assert.match(harness, /if \(!deps\.proof\) return;\s*const entry = \{ type, target: clip\(target, 120\), path: location\.pathname, ts: Date\.now\(\) \};/);
  assert.match(harness, /new CustomEvent\("sbl-agent-action", \{ detail: JSON\.stringify\(entry\) \}\)/, "a JSON string crosses the isolated-world boundary");
  assert.match(read("content.js"), /SBLStore\.local\.get\("sbl_proof"\)/, "the proof flag goes through the store adapter (chrome.storage in the extension, sessionStorage in the script tag)");
  for (const type of ["say", "point", "click", "navigate", "scroll", "fill", "ask_user", "confirmation"]) assert.match(harness, new RegExp(`emit\\("${type}"`), type);
  assert.doesNotMatch(harness, /emit\([^)]*\{/, "no detail objects: never text, inputs, goals or notes");
});
