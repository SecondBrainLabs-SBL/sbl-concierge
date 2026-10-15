// Server side of the turn trace (FR-15, docs/TRACE-SCHEMA.md): append events as JSON lines, and build the `model` event.
// Kept out of server.mjs so tests can import it; nothing here may ever throw into a visitor request (NFR-11).
import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_DIR = fileURLToPath(new URL("./var/trace/", import.meta.url));
const str = (v, n = 64) => (typeof v === "string" && v ? v.slice(0, n) : null);

// body: one event or an array. Adds `ts` (server receive time). Returns whether it was written; a failure is swallowed.
export function appendTrace(body, { dir = process.env.TRACE_DIR || DEFAULT_DIR, ts = Date.now() } = {}) {
  try {
    const events = (Array.isArray(body) ? body : [body]).filter((e) => e && typeof e === "object" && !Array.isArray(e)).slice(0, 100);
    if (!events.length) return false;
    mkdirSync(dir, { recursive: true });
    appendFileSync(`${dir}/${new Date(ts).toISOString().slice(0, 10)}.jsonl`, events.map((e) => JSON.stringify({ ...e, ts })).join("\n") + "\n");
    return true;
  } catch { return false; } // ponytail: no retry or buffer; a trace is best-effort, add a queue if a hosted pilot needs durability
}

// One upstream model call. headers are the request's (node lowercases them); missing ones give turn: null.
export function modelEvent({ path, ms, status, usage = {}, headers = {}, firstMs }) {
  return { t: Date.now(), v: str(headers["x-sbl-v"]), turn: str(headers["x-sbl-turn"]), k: "model", path, ms, ...(Number.isFinite(firstMs) ? { firstMs } : {}), status, prompt: usage?.prompt_tokens, completion: usage?.completion_tokens, cached: usage?.prompt_tokens_details?.cached_tokens };
}
