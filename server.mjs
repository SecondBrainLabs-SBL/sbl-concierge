import http from "node:http";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { appendTrace, modelEvent } from "./trace-log.mjs";
import { agentChatRequest, BACKEND_MODEL, buildLiveSession, LIVE_MODEL, parseThought, thinkRequest } from "./live-config.mjs";

const nodeRequire = createRequire(import.meta.url);
const { buildRequest, parseResult, cacheKey } = nodeRequire("./core/research.js");
const Record = nodeRequire("./core/record.js"); // the visitor record: the note call's prompt, forced tool and validation (docs/MEMORY.md)
const Router = nodeRequire("./core/router.js"); // the fast path's prompt, stream reader and route validation (docs/FAST-PATH.md)
const SBL_KNOWLEDGE = nodeRequire("./core/sbl-knowledge.js");
const SITE_MAP = nodeRequire("./core/site-map.js");
const port = Number(process.env.PORT || 8787);
const apiKey = process.env.OPENAI_API_KEY;

// Pin to this extension's own id (chrome-extension://<id>). Unset: pin to the first extension that calls, for this process's lifetime,
// so no second extension can spend the key. /health is open (no origin check) for curl.
let extensionOrigin = process.env.EXTENSION_ID ? `chrome-extension://${process.env.EXTENSION_ID}` : null;
// The script-tag bundle calls from the page itself, so the two site origins are allowed too; extensions stay pinned as before.
const PAGE_ORIGINS = ["https://sbl.so", "https://app.secondbrainlabs.com"];
const isAllowed = (origin) => {
  if (PAGE_ORIGINS.includes(origin)) return true;
  if (!origin?.startsWith("chrome-extension://")) return false;
  extensionOrigin ??= origin;
  return origin === extensionOrigin;
};

// Model calls (/agent/route, /agent/chat) are capped per visitor (X-SBL-V; without it, origin + remote address), plus a global ceiling that only bounds cost.
// Notes are one small call per turn and nothing waits on them: their own per-visitor counter (30/min), so they never use up the router's and the engine's.
// A refused call is not counted, so it never extends a block. Idle entries are swept on access (a plain Map, no timers). Windows are fixed, 60 s from a visitor's first call.
const CAP_PER_VISITOR = Number(process.env.CAP_PER_VISITOR) || 40;
const CAP_GLOBAL = Number(process.env.CAP_GLOBAL) || 600;
const visitors = new Map(), noteWins = new Map(), researchWins = new Map(), gWin = { start: 0, count: 0 };
export const visitorCount = () => visitors.size + noteWins.size + researchWins.size;
const visitorKey = (req) => String(req.headers["x-sbl-v"] || "").slice(0, 64) || `${req.headers.origin || ""}|${req.socket.remoteAddress}`;
function admit(map, req, per, g) { // -> null (admitted and counted) | "visitor_cap" | "global_cap"
  const now = Date.now();
  for (const [k, w] of map) if (now - w.start >= 60_000) map.delete(k);
  if (g && now - g.start >= 60_000) { g.start = now; g.count = 0; }
  const key = visitorKey(req), w = map.get(key) || { start: now, count: 0 };
  if (w.count >= per) return "visitor_cap";
  if (g && g.count >= CAP_GLOBAL) return "global_cap";
  w.count++; if (g) g.count++;
  map.set(key, w);
  return null;
}

// Feature calls share chat's visitor allowance; research has its own smaller allowance.
function limited(req, res, origin, map = visitors, per = CAP_PER_VISITOR) {
  const code = admit(map, req, per, gWin);
  if (!code) return false;
  send(res, 429, { error: "Too many requests; try again in a minute.", code }, origin);
  return true;
}

// Fault injection (tests and the gate): only with ALLOW_FAULTS=1 does X-SBL-Fault answer as that failure would, without calling upstream. Otherwise the header is ignored.
const FAULTS = process.env.ALLOW_FAULTS === "1", FAULT_SLOW_MS = Number(process.env.FAULT_SLOW_MS) || 10_000;
const UNAVAILABLE_BODY = { error: { code: "assistant_unavailable", message: "assistant_unavailable" } }; // what the harness reads as "no credits / bad key / no key"
// The shared front of the three model endpoints, after the origin check: answers a fault, a missing key or a cap and returns true; false lets the call go on.
async function refused(req, res, origin, notes) {
  const asked = FAULTS ? req.headers["x-sbl-fault"] : "", f = ["unavailable", "capped", "down", "slow"].includes(asked) ? asked : "";
  if (f === "slow") await new Promise((r) => setTimeout(r, FAULT_SLOW_MS));
  const code = f || !apiKey ? "" : notes ? admit(noteWins, req, 30) : admit(visitors, req, CAP_PER_VISITOR, gWin);
  const [status, body] = f === "unavailable" || (!f && !apiKey) ? [403, UNAVAILABLE_BODY]
    : f === "down" ? [502, { error: "Unable to reach the model." }]
    : f === "slow" ? [504, { error: "The model took too long." }]
    : f === "capped" || code ? [429, { error: "Too many requests; try again in a minute.", code: code || "visitor_cap" }] : [];
  if (!status) return false;
  if (!res.destroyed) send(res, status, body, origin);
  return true;
}

function corsHeaders(origin) {
  const allowed = isAllowed(origin);
  return {
  "Access-Control-Allow-Origin": allowed ? origin : "null",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-SBL-V, X-SBL-Turn, X-SBL-Fault",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Private-Network": "true",
  "Vary": "Origin",
  };
}

function send(res, status, payload, origin) {
  res.writeHead(status, { ...corsHeaders(origin), "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readJson(req, limit = 80_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// OpenAI rejects a lone UTF-16 surrogate (the site map and knowledge text are cut mid-emoji/bold-letter in places): repair every string before sending.
const json = (o) => JSON.stringify(o, (k, v) => (typeof v === "string" ? v.toWellFormed() : v));

// ponytail: in-memory research cache (24h, 50 entries, oldest evicted) and live-controller map; lost on restart.
const researchCache = new Map();
const researchRuns = new Map();
const RESEARCH_TTL = 24 * 60 * 60_000;
const RESEARCH_TIMEOUT = 60_000;

async function runResearch(body) {
  const started = Date.now();
  const question = String(body.question ?? "").trim();
  const done = (id, status, result, cached = false) => ({ id, status, result, cached, elapsedMs: Date.now() - started });
  // Client may pass its own id (so it can cancel before the response returns).
  const id = /^[\w-]{8,64}$/.test(body.id || "") && !researchRuns.has(body.id) ? body.id : randomUUID();
  const key = cacheKey(question, body.customer, body.country);
  const hit = researchCache.get(key);
  if (hit && Date.now() - hit.at < RESEARCH_TTL) return done(id, hit.result.status === "inconclusive" ? "inconclusive" : "done", hit.result, true);
  const ctl = new AbortController();
  researchRuns.set(id, ctl);
  const timer = setTimeout(() => ctl.abort(), RESEARCH_TIMEOUT);
  try {
    const request = buildRequest({ question, customer: body.customer, today: new Date().toISOString().slice(0, 10), country: body.country, budget: { maxSources: 5, maxOutputTokens: 4000 }, model: BACKEND_MODEL });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: json(request),
      signal: ctl.signal,
    });
    if (!response.ok) return done(id, "error", { error: `Upstream ${response.status}` });
    const result = parseResult(await response.json().catch(() => ({})));
    if (result.status === "useful") {
      researchCache.set(key, { at: Date.now(), result });
      if (researchCache.size > 50) researchCache.delete(researchCache.keys().next().value);
    }
    return done(id, result.status === "useful" ? "done" : "inconclusive", result);
  } catch (error) {
    return ctl.cancelled ? done(id, "cancelled", null) : done(id, "error", { error: error.name === "AbortError" ? "Research timed out" : "Research call failed" });
  } finally {
    clearTimeout(timer);
    researchRuns.delete(id);
  }
}

// The script-tag visitor store: one JSON blob per visitor id (last-write-wins), file-backed so a restart keeps state.
// sblv comes from the client, so it is validated before any path use.
const STORE_DIR = new URL("./var/store/", import.meta.url);
mkdirSync(STORE_DIR, { recursive: true });
const SBLV_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const storePath = (sblv) => new URL(`${sblv}.json`, STORE_DIR);

export const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const originAllowed = isAllowed(origin);
  if (req.method === "OPTIONS") {
    res.writeHead(originAllowed ? 204 : 403, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    send(res, 200, { ok: true, liveConfigured: Boolean(apiKey), model: LIVE_MODEL }, origin);
    return;
  }

  if (req.method === "POST" && req.url === "/session") {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    if (limited(req, res, origin)) return;
    if (!apiKey) {
      send(res, 503, {
        error: "OPENAI_API_KEY is not set. Text demo mode remains available.",
      }, origin);
      return;
    }

    const startedAt = Date.now();
    try {
      const body = await readJson(req);
      if (typeof body.sdp !== "string" || !body.sdp.trim()) {
        send(res, 400, { error: "An SDP offer is required" }, origin);
        return;
      }

      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      if (process.env.OPENAI_SAFETY_IDENTIFIER) {
        headers["OpenAI-Safety-Identifier"] = process.env.OPENAI_SAFETY_IDENTIFIER;
      }

      const response = await fetch("https://api.openai.com/v1/live/sessions", {
        method: "POST",
        headers,
        body: json({
          session: buildLiveSession(body.context, body.role === "ears" || body.role === "mouth" ? body.role : "voice"),
          transport: { type: "webrtc", sdp: body.sdp },
        }),
      });

      const responseBody = await response.text();
      console.log(`/session ${response.status} ${Date.now() - startedAt}ms`);
      res.writeHead(response.status, { ...corsHeaders(origin), "Content-Type": "application/json" });
      res.end(responseBody);
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 502;
      console.log(`/session ${status} ${Date.now() - startedAt}ms`);
      send(res, status, { error: `Unable to create GPT-Live session: ${error.message}` }, origin);
    }
    return;
  }

  if (req.method === "POST" && req.url === "/respond") {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    if (limited(req, res, origin)) return;
    if (!apiKey) {
      send(res, 503, { error: "OPENAI_API_KEY is not set. Text demo mode remains available." }, origin);
      return;
    }
    try {
      const body = await readJson(req, 120_000);
      if (body.mode !== "proactive") {
        send(res, 400, { error: "mode must be 'proactive'" }, origin);
        return;
      }
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: json(thinkRequest(body.context)),
        signal: AbortSignal.timeout(45_000),
      });
      const data = await response.json().catch(() => ({}));
      console.log(`USAGE /respond t=${new Date().toISOString()} http=${response.status} status=${data.status} in=${data.usage?.input_tokens} out=${data.usage?.output_tokens} cached=${data.usage?.input_tokens_details?.cached_tokens}`);
      if (!response.ok) {
        console.error(`/respond upstream ${response.status}: ${data.error?.message || "unknown error"}`);
        send(res, 502, { error: `Model call failed (${response.status}).` }, origin);
        return;
      }
      send(res, 200, parseThought(data), origin);
    } catch (error) {
      console.error(`/respond failed: ${error.message}`);
      send(res, error instanceof SyntaxError ? 400 : 502, { error: "Unable to get a concierge response." }, origin);
    }
    return;
  }

  // The in-page engine's model calls (chat-completions). Same origin check and cap as /respond; the key never leaves this process.
  if (req.method === "POST" && req.url === "/agent/chat") {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    if (await refused(req, res, origin)) return;
    try {
      const request = agentChatRequest(await readJson(req, 500_000));
      if (!request) {
        send(res, 400, { error: "not an engine request" }, origin);
        return;
      }
      const t0 = Date.now();
      // gpt-5.6-luna refuses function tools with reasoning_effort on /v1/chat/completions ("use
      // /v1/responses or reasoning_effort none", measured 2026-10-02) — and effort none was the
      // erratic-flow defect step 3 fixed. So the chat-shaped request the engine sends is translated
      // to /v1/responses and the reply is translated back to the chat.completion shape the engine parses.
      const q = request;
      const responsesBody = {
        model: q.model,
        reasoning: { effort: q.reasoning_effort },
        input: q.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: q.tools.map((t) => ({ type: "function", name: t.function.name, description: t.function.description, parameters: t.function.parameters })),
        ...(q.tool_choice ? { tool_choice: q.tool_choice === "required" ? "required" : { type: "function", name: q.tool_choice.function?.name } } : {}),
        ...(q.parallel_tool_calls !== undefined ? { parallel_tool_calls: q.parallel_tool_calls } : {}),
        ...(q.max_completion_tokens ? { max_output_tokens: q.max_completion_tokens } : {}),
      };
      let response;
      try {
        response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: json(responsesBody),
          signal: AbortSignal.timeout(55_000),
        });
      } catch (error) { // a failed or timed-out upstream call is a model event too (silent timeouts must show in the trace)
        appendTrace(modelEvent({ path: "/agent/chat", ms: Date.now() - t0, status: error?.name === "TimeoutError" ? "timeout" : "error", headers: req.headers }));
        throw error;
      }
      // Pass the upstream status and body through: the engine's retry logic reads them. Errors are logged without the body's content.
      let text = await response.text();
      // /v1/responses reply -> the chat.completion shape the engine parses (choices[0].message.tool_calls
      // with a JSON arguments string) and the USAGE line reads.
      if (response.ok) {
        try {
          const r = JSON.parse(text);
          const out = r.output || [];
          const msg = out.filter((o) => o.type === "message").flatMap((o) => o.content || []).map((c) => c.text || "").join("").trim();
          const calls = out.filter((o) => o.type === "function_call").map((o) => ({ id: o.call_id || o.id, type: "function", function: { name: o.name, arguments: o.arguments || "{}" } }));
          const usage = r.usage || {};
          text = JSON.stringify({
            id: r.id, object: "chat.completion", model: r.model,
            choices: [{ index: 0, message: { role: "assistant", content: msg || null, ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: calls.length ? "tool_calls" : (r.status === "incomplete" ? "length" : "stop") }],
            usage: { prompt_tokens: usage.input_tokens ?? 0, completion_tokens: usage.output_tokens ?? 0, total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0), prompt_tokens_details: { cached_tokens: usage.input_tokens_details?.cached_tokens ?? 0 } },
          });
        } catch { /* a non-JSON upstream body passes through; the engine sees the raw error */ }
      }
      let j = {}; try { j = JSON.parse(text) || {}; } catch {}
      const ms = Date.now() - t0;
      console.log(`USAGE /agent/chat t=${new Date().toISOString()} http=${response.status} ms=${ms} finish=${j.choices?.[0]?.finish_reason} prompt=${j.usage?.prompt_tokens} completion=${j.usage?.completion_tokens} cached=${j.usage?.prompt_tokens_details?.cached_tokens}`);
      appendTrace(modelEvent({ path: "/agent/chat", ms, status: response.status, usage: j.usage, headers: req.headers })); // FR-15; never throws
      if (!response.ok) { let e = {}; try { e = JSON.parse(text)?.error || {}; } catch {} console.error(`/agent/chat upstream ${response.status} ${e.type || ""} ${e.code || ""}`); }
      // No credits or a bad key is not something a retry fixes: answer 403 with a clear code, so the engine stops and the visitor is told plainly.
      if (response.status === 401 || response.status === 403 || (response.status === 429 && /insufficient_quota|credit_balance/.test(text))) {
        send(res, 403, UNAVAILABLE_BODY, origin);
        return;
      }
      res.writeHead(response.status, { ...corsHeaders(origin), "Content-Type": "application/json" });
      res.end(text);
    } catch (error) {
      console.error(`/agent/chat failed: ${error.name}`);
      send(res, error instanceof SyntaxError ? 400 : 502, { error: "Unable to reach the model." }, origin);
    }
    return;
  }

  // The fast path (docs/FAST-PATH.md): a small streamed model call that writes the first line and picks the route. Relayed as SSE:
  // {"line": text so far} events, then one {"route": {...}} (validated against the site index; null when unusable). {"stream": false}: the final JSON only.
  if (req.method === "POST" && req.url === "/agent/route") {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    if (await refused(req, res, origin)) return;
    let body, rq;
    try { body = await readJson(req, 40_000); rq = Router.request(body); } catch { rq = null; }
    if (!rq) {
      send(res, 400, { error: "not a route request" }, origin);
      return;
    }
    for (const key of ["message", "customerFile", "lastAgentLine"]) rq[key] = Record.maskContacts(rq[key]);
    rq.conversation = rq.conversation.map(Record.maskContacts);
    const streaming = body.stream !== false;
    const t0 = Date.now();
    const ctl = new AbortController();
    const killFirst = setTimeout(() => ctl.abort(new Error("timeout")), Number(process.env.ROUTE_FIRST_MS) || 3000); // to the first byte
    const killAll = setTimeout(() => ctl.abort(new Error("timeout")), Number(process.env.ROUTE_TOTAL_MS) || 6000); // in all
    res.on("close", () => { if (!res.writableEnded) ctl.abort(new Error("gone")); });
    let status = "error", usage, firstMs, args = "", sent = "", begun = false, failed = false;
    const begin = () => { if (!streaming || begun) return; begun = true; res.writeHead(200, { ...corsHeaders(origin), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" }); };
    const sse = (o) => { begin(); res.write(`data: ${JSON.stringify(o)}\n\n`); };
    const fail = (code, message) => { if (begun) { sse({ error: message }); res.end(); } else send(res, code, { error: message }, origin); };
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: json(Router.upstream({ model: BACKEND_MODEL, knowledge: SBL_KNOWLEDGE.full(), siteMap: SITE_MAP, req: rq })),
        signal: ctl.signal,
      });
      status = response.status;
      if (!response.ok) {
        await response.body?.cancel?.().catch(() => {});
        console.error(`/agent/route upstream ${response.status}`);
        fail(502, "Unable to reach the model.");
        return;
      }
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buf = "";
      const onEvent = (ev) => {
        if (ev.type === "response.function_call_arguments.delta") {
          args += ev.delta || "";
          const { text } = Router.extractLine(args);
          if (text && text !== sent) {
            if (firstMs === undefined) firstMs = Date.now() - t0;
            sent = text;
            if (streaming && !/"then"\s*:\s*"do"/.test(args)) sse({ line: text }); // a "do" line waits for the harness to check the visitor's own words
          }
        } else if (ev.type === "response.function_call_arguments.done" && typeof ev.arguments === "string") args = ev.arguments;
        else if (ev.type === "response.completed") usage = ev.response?.usage;
        else if (ev.type === "response.failed" || ev.type === "error") failed = true;
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        clearTimeout(killFirst);
        buf += decoder.decode(value, { stream: true });
        for (let i; (i = buf.indexOf("\n\n")) >= 0;) {
          const data = buf.slice(0, i).split("\n").find((l) => l.startsWith("data:"));
          buf = buf.slice(i + 2);
          if (data) { try { onEvent(JSON.parse(data.slice(5))); } catch { /* a malformed event is skipped */ } }
        }
      }
      let route = null;
      if (!failed) { try { route = Router.validate(JSON.parse(args), SITE_MAP, rq.url); } catch { /* unusable arguments: no route */ } }
      if (failed) { status = 502; fail(502, "The model call failed."); return; }
      if (streaming) { sse({ route }); res.end(); } else send(res, 200, { route }, origin);
    } catch (error) {
      status = ctl.signal.aborted ? (ctl.signal.reason?.message === "gone" ? "gone" : "timeout") : "error";
      console.error(`/agent/route failed: ${status}`);
      if (!res.writableEnded && !res.destroyed) fail(status === "timeout" ? 504 : 502, status === "timeout" ? "The model took too long." : "Unable to reach the model.");
    } finally {
      clearTimeout(killFirst); clearTimeout(killAll);
      const ms = Date.now() - t0;
      const u = usage ? { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens, prompt_tokens_details: { cached_tokens: usage.input_tokens_details?.cached_tokens } } : undefined;
      console.log(`USAGE /agent/route t=${new Date().toISOString()} http=${status} ms=${ms} first=${firstMs} prompt=${u?.prompt_tokens} completion=${u?.completion_tokens} cached=${u?.prompt_tokens_details?.cached_tokens}`);
      appendTrace(modelEvent({ path: "/agent/route", ms, firstMs, status, usage: u, headers: req.headers }));
    }
    return;
  }

  // Visitor memory (docs/MEMORY.md): one small non-streamed call after a turn ends. Returns the whole new record, validated (bounds, no contact details).
  if (req.method === "POST" && req.url === "/agent/note") {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    if (await refused(req, res, origin, true)) return;
    let rq;
    try { rq = Record.request(await readJson(req, 40_000)); } catch { rq = null; }
    if (!rq) {
      send(res, 400, { error: "not a note request" }, origin);
      return;
    }
    const t0 = Date.now();
    const ctl = new AbortController();
    const kill = setTimeout(() => ctl.abort(new Error("timeout")), Number(process.env.NOTE_MS) || 6000);
    res.on("close", () => { if (!res.writableEnded) ctl.abort(new Error("gone")); });
    let status = "error", usage;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: json(Record.upstream({ model: BACKEND_MODEL, req: rq })),
        signal: ctl.signal,
      });
      status = response.status;
      if (!response.ok) {
        await response.body?.cancel?.().catch(() => {});
        console.error(`/agent/note upstream ${response.status}`);
        send(res, 502, { error: "Unable to reach the model." }, origin);
        return;
      }
      const j = await response.json();
      usage = j.usage;
      const record = Record.parse(j, rq.seq);
      if (!record) { status = 502; send(res, 502, { error: "The model returned no record." }, origin); return; }
      send(res, 200, { record }, origin);
    } catch (error) {
      status = ctl.signal.aborted ? (ctl.signal.reason?.message === "gone" ? "gone" : "timeout") : "error";
      console.error(`/agent/note failed: ${status}`);
      if (!res.writableEnded && !res.destroyed) send(res, status === "timeout" ? 504 : 502, { error: status === "timeout" ? "The model took too long." : "Unable to reach the model." }, origin);
    } finally {
      clearTimeout(kill);
      const ms = Date.now() - t0;
      const u = usage ? { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens, prompt_tokens_details: { cached_tokens: usage.input_tokens_details?.cached_tokens } } : undefined;
      console.log(`USAGE /agent/note t=${new Date().toISOString()} http=${status} ms=${ms} prompt=${u?.prompt_tokens} completion=${u?.completion_tokens} cached=${u?.prompt_tokens_details?.cached_tokens}`);
      appendTrace(modelEvent({ path: "/agent/note", ms, status, usage: u, headers: req.headers }));
    }
    return;
  }

  if (req.method === "POST" && (req.url === "/research" || req.url === "/research/cancel")) {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    if (req.url === "/research" && limited(req, res, origin, researchWins, 3)) return;
    try {
      const body = await readJson(req);
      if (req.url === "/research/cancel") {
        const ctl = researchRuns.get(body.id);
        if (ctl) { ctl.cancelled = true; ctl.abort(); }
        send(res, 200, { id: body.id, status: ctl ? "cancelled" : "not_running" }, origin);
        return;
      }
      if (!apiKey) {
        send(res, 503, { error: "OPENAI_API_KEY is not set." }, origin);
        return;
      }
      if (!String(body.question ?? "").trim()) {
        send(res, 400, { error: "question is required" }, origin);
        return;
      }
      send(res, 200, await runResearch(body), origin);
    } catch (error) {
      send(res, error instanceof SyntaxError ? 400 : 502, { error: "Unable to run research." }, origin);
    }
    return;
  }

  // The built agent bundle (node tools/build-agent.mjs): what a WordPress <script> tag or the proof harness loads.
  if (req.method === "GET" && req.url === "/agent.js") {
    try {
      res.writeHead(200, { ...corsHeaders(origin), "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      res.end(readFileSync(new URL("./sbl-agent.js", import.meta.url)));
      console.log(`/agent.js ${origin || "(no origin)"}`);
    } catch {
      send(res, 404, { error: "sbl-agent.js is not built; run node tools/build-agent.mjs" }, origin);
    }
    return;
  }

  // The turn trace (FR-15): the page posts events, fire-and-forget; one JSON line each in var/trace/. A write failure still answers 204.
  if (req.method === "POST" && req.url === "/trace") {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    try { appendTrace(await readJson(req, 64_000)); } catch {
      send(res, 400, { error: "Bad trace body" }, origin);
      return;
    }
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.url.startsWith("/store")) {
    if (!originAllowed) {
      send(res, 403, { error: "Unexpected request origin" }, origin);
      return;
    }
    const sblv = new URL(req.url, "http://x").searchParams.get("sblv") || "";
    if (!SBLV_RE.test(sblv)) {
      send(res, 400, { error: "A valid sblv visitor id is required" }, origin);
      return;
    }
    if (req.method === "GET") {
      let data = null;
      try { data = JSON.parse(readFileSync(storePath(sblv), "utf8")); } catch { /* no blob yet */ }
      const bytes = data ? JSON.stringify(data).length : 0;
      console.log(`/store GET sblv=${sblv} bytes=${bytes}`);
      send(res, 200, { data }, origin);
      return;
    }
    if (req.method === "PUT") {
      try {
        const data = await readJson(req); // 80 KB cap, same limit as every other body
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          send(res, 400, { error: "The store body must be a JSON object" }, origin);
          return;
        }
        const bytes = JSON.stringify(data).length;
        const tmp = storePath(`${sblv}.${process.pid}.tmp`); // unique per process: two tabs must not interleave one tmp file
        writeFileSync(tmp, JSON.stringify(data));
        renameSync(tmp, storePath(sblv)); // atomic: a half-written blob is never served
        console.log(`/store PUT sblv=${sblv} bytes=${bytes}`);
        send(res, 200, { ok: true }, origin);
      } catch (error) {
        send(res, error instanceof SyntaxError ? 400 : 500, { error: error.message || "Store write failed" }, origin);
      }
      return;
    }
    send(res, 405, { error: "Method not allowed" }, origin);
    return;
  }

  send(res, 404, { error: "Not found" }, origin);
});

server.listen(port, "127.0.0.1", () => { // loopback only
  if (!extensionOrigin) console.warn("EXTENSION_ID is unset: pinning to the first extension that calls. Set it to pin your extension's id up front.");
  console.log(`SBL Sales Concierge GPT-Live server: http://127.0.0.1:${port}`);
  console.log(apiKey ? `${LIVE_MODEL} is configured.` : "No API key: text demo mode only.");
});
