// Appends a flow label to the newest capture session, so a run can be segmented
// into named flows ("campaign brief", "connect LinkedIn") while recording continues.
import { readdir, appendFile, stat } from "node:fs/promises";
import path from "node:path";

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error('Usage: node note.mjs "connect LinkedIn account"');
  process.exit(1);
}

const root = path.resolve("captures");
const sessions = await readdir(root);
const withTimes = await Promise.all(sessions.map(async (name) => ({
  name, at: (await stat(path.join(root, name))).mtimeMs,
})));
const newest = withTimes.sort((a, b) => b.at - a.at)[0];
if (!newest) {
  console.error("No capture session found. Start the recorder first.");
  process.exit(1);
}

const file = path.join(root, newest.name, "events.jsonl");
await appendFile(file, `${JSON.stringify({
  kind: "note", id: `m${Date.now()}`, ts: new Date().toISOString(), text,
})}\n`, "utf8");
console.log(`marked "${text}" in ${newest.name}`);
