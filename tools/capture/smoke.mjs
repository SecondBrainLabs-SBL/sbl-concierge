// Drives the recorder against a local page to prove interactions, screenshots and
// action-to-request attribution all land in events.jsonl. Needs the website preview
// workshop running on 127.0.0.1:4320 (any local app with a login form and an XHR works).
import { startRecorder } from "./record.mjs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";

const target = process.env.SMOKE_URL || "http://127.0.0.1:4320";
const password = process.env.SMOKE_PASSWORD;
if (!password) {
  console.error("Set SMOKE_PASSWORD to the local app's operator password, and SMOKE_URL if it is not on 127.0.0.1:4320.");
  process.exit(2);
}
const out = path.join(os.tmpdir(), `sbl-capture-smoke-${Date.now()}`);

const recorder = await startRecorder({
  startUrl: target,
  outDir: out,
  apiHosts: "127.0.0.1",
  profileDir: path.join(out, "profile"),
  launch: { headless: true, viewport: { width: 1280, height: 900 }, args: [] },
});

const { page } = recorder;
await recorder.note("smoke: operator sign in");
await page.fill("input[type=password]", password);
await page.click("button[type=submit]");
await page.waitForLoadState("networkidle");
await recorder.note("smoke: read the preview list");
await page.evaluate(() => fetch("/api/demos").then((r) => r.json()));
await page.waitForTimeout(500);
await recorder.stop();

const events = (await readFile(path.join(out, "events.jsonl"), "utf8"))
  .trim().split("\n").map((line) => JSON.parse(line));

const clicks = events.filter((e) => e.kind === "click");
const inputs = events.filter((e) => e.kind === "input");
const requests = events.filter((e) => e.kind === "request");
const notes = events.filter((e) => e.kind === "note");

assert.ok(clicks.length >= 1, "records a click");
assert.ok(inputs.length >= 1, "records a field change");
assert.ok(notes.length === 2, "records flow labels");
assert.ok(requests.length >= 1, "records API requests");

const submit = clicks.find((c) => c.tag === "button");
assert.ok(submit?.selector, "click has a selector");
assert.ok(submit.box.width > 0 && submit.box.height > 0, "click has an on-screen box");
assert.ok(submit.screenshot, "click has a screenshot");

const attributed = requests.find((r) => r.actionId);
assert.ok(attributed, "at least one request is attributed to an action");
assert.ok(events.some((e) => e.id === attributed.actionId), "attribution points at a recorded action");

const secret = inputs.find((i) => i.type === "password");
assert.equal(secret?.value, "[redacted]", "password values are not stored");
const raw = await readFile(path.join(out, "events.jsonl"), "utf8");
assert.ok(!raw.includes(password), "the password never reaches the log");
assert.ok(!/"cookie":/i.test(raw) || /"cookie":"\[redacted\]"/i.test(raw), "cookies are redacted");

console.log(`ok — ${clicks.length} clicks, ${inputs.length} inputs, ${requests.length} requests`);
console.log(`     ${submit.tag} "${submit.label}" at ${JSON.stringify(submit.box)} -> ${attributed.method} ${attributed.path} (${attributed.status})`);
await rm(out, { recursive: true, force: true });
