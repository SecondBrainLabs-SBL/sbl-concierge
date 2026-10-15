// Turns raw capture sessions into the endpoint index: every API call collapsed to a
// path template, with the component that triggers it, the screen it happens on, the
// screenshot, and inferred request/response shapes. Also emits the ordered flows.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_ID = /^[A-Za-z0-9_-]{16,}$/;
const HEX = /^[0-9a-f]{24,}$/i;

// Collapses "/companies/42/campaigns/1907" to "/companies/:companyId/campaigns/:campaignId"
// so repeated visits to different records become one endpoint.
export function templatePath(pathname) {
  const segments = pathname.split("/");
  return segments.map((segment, index) => {
    if (!segment) return segment;
    const previous = segments[index - 1] || "";
    const placeholder = `:${camel(singular(previous))}Id`.replace(/^:Id$/, ":id");
    if (/^\d+$/.test(segment)) return placeholder;
    if (UUID.test(segment)) return placeholder;
    if (HEX.test(segment)) return placeholder;
    if (OPAQUE_ID.test(segment) && !/^[a-z-]+$/.test(segment)) return placeholder;
    return segment;
  }).join("/");
}

function singular(word) {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/(ch|sh|ss|x|z)es$/i.test(word)) return word.replace(/es$/i, "");
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.replace(/s$/i, "");
  return word;
}

function camel(word) {
  const parts = word.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!parts.length) return "";
  return parts[0].toLowerCase() + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join("");
}

const ASSET_PATH = /\.(css|js|mjs|map|png|jpe?g|svg|gif|webp|avif|woff2?|ttf|eot|ico|txt|xml)$/i;

// Framework traffic (bundles, RSC prefetches, page documents) is recorded but kept out
// of the endpoint index, which is meant to describe the API an agent would call.
export function classify(event) {
  const pathname = event.path || "";
  if (pathname.startsWith("/_next/") || pathname.startsWith("/__next") || ASSET_PATH.test(pathname)) return "asset";
  if (event.query && "_rsc" in event.query) return "rsc";
  if (event.resourceType === "document") return "page";
  return "api";
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// Merges several samples into one shape, remembering which fields were not always present.
export function shapeOf(value, depth = 0) {
  if (depth > 3) return "…";
  const kind = typeOf(value);
  if (kind === "array") {
    if (!value.length) return ["empty"];
    return [shapeOf(value[0], depth + 1)];
  }
  if (kind === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) out[key] = shapeOf(item, depth + 1);
    return out;
  }
  if (kind === "string") return value.length > 40 ? "string" : `string(${JSON.stringify(value).slice(0, 42)})`;
  return kind;
}

function mergeShape(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out = { ...a };
    for (const [key, value] of Object.entries(b)) out[key] = key in a ? mergeShape(a[key], value) : value;
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) return [mergeShape(a[0], b[0])];
  if (a === b) return a;
  const left = String(a).replace(/\(.*\)/, "");
  const right = String(b).replace(/\(.*\)/, "");
  return left === right ? left : `${left}|${right}`;
}

export function buildIndex(events, options = {}) {
  const keep = options.include || ["api"];
  const byId = new Map(events.filter((e) => e.id).map((e) => [e.id, e]));
  const endpoints = new Map();
  const screens = new Map();
  const skipped = {};
  const flows = [];
  let flow = null;
  // The last thing that could have caused a request: a component interaction, or a
  // page load. Without this, every call a page makes on load is blamed on whichever
  // link was clicked before navigating.
  let anchor = null;

  for (const event of events) {
    if (event.kind === "navigate") anchor = event;
    if (event.kind === "note") {
      flow = { label: event.text, startedAt: event.ts, steps: [] };
      flows.push(flow);
      continue;
    }
    if (["click", "input", "submit"].includes(event.kind)) {
      anchor = event;
      const screen = screenKey(event.url);
      const entry = screens.get(screen) || { screen, urls: new Set(), components: new Map() };
      entry.urls.add(event.url);
      const componentKey = `${event.tag}:${event.label}`;
      if (!entry.components.has(componentKey)) {
        entry.components.set(componentKey, {
          kind: event.kind, tag: event.tag, type: event.type, role: event.role, testId: event.testId,
          label: event.label, selector: event.selector, section: event.section, box: event.box,
          screenshot: event.screenshot,
        });
      }
      screens.set(screen, entry);
      flow?.steps.push({
        actionId: event.id, kind: event.kind, label: event.label, tag: event.tag,
        url: event.url, screenshot: event.screenshot, requests: [],
      });
      continue;
    }
    if (event.kind !== "request") continue;
    const category = classify(event);
    if (!keep.includes(category)) {
      skipped[category] = (skipped[category] || 0) + 1;
      continue;
    }

    const template = templatePath(event.path);
    const key = `${event.method} ${event.host}${template}`;
    const record = endpoints.get(key) || {
      key, method: event.method, host: event.host, template, calls: 0,
      statuses: {}, queryKeys: new Set(), requestShape: undefined, responseShape: undefined,
      durationsMs: [], triggeredBy: new Map(), screens: new Set(), flows: new Set(), examplePaths: new Set(),
    };
    record.calls++;
    record.statuses[event.status ?? event.failure ?? "failed"] = (record.statuses[event.status ?? "failed"] || 0) + 1;
    record.examplePaths.add(event.path);
    if (typeof event.durationMs === "number") record.durationsMs.push(event.durationMs);
    for (const queryKey of Object.keys(event.query || {})) record.queryKeys.add(queryKey);
    if (event.requestBody !== undefined) record.requestShape = mergeShape(record.requestShape, shapeOf(event.requestBody));
    if (event.responseBody !== undefined) record.responseShape = mergeShape(record.responseShape, shapeOf(event.responseBody));

    const action = anchor || (event.actionId ? byId.get(event.actionId) : null);
    if (action) {
      const componentKey = action.kind === "navigate" ? `load:${screenKey(action.url)}` : `${action.tag}:${action.label}`;
      const existing = record.triggeredBy.get(componentKey);
      if (existing) existing.count++;
      else record.triggeredBy.set(componentKey, {
        count: 1, kind: action.kind, tag: action.tag, role: action.role, label: action.label,
        selector: action.selector, section: action.section, box: action.box,
        screenshot: action.screenshot, screen: screenKey(action.url), url: action.url,
      });
      record.screens.add(screenKey(action.url));
    }
    if (flow) {
      record.flows.add(flow.label);
      const step = flow.steps.find((s) => s.actionId === event.actionId) || flow.steps[flow.steps.length - 1];
      step?.requests.push({ method: event.method, path: event.path, status: event.status });
    }
    endpoints.set(key, record);
  }

  const list = [...endpoints.values()].map((record) => ({
    ...record,
    queryKeys: [...record.queryKeys],
    screens: [...record.screens],
    flows: [...record.flows],
    examplePaths: [...record.examplePaths].slice(0, 3),
    medianMs: median(record.durationsMs),
    durationsMs: undefined,
    triggeredBy: [...record.triggeredBy.values()].sort((a, b) => b.count - a.count),
  })).sort((a, b) => (a.host + a.template).localeCompare(b.host + b.template));

  return {
    endpoints: list,
    screens: [...screens.values()].map((entry) => ({
      screen: entry.screen, urls: [...entry.urls].slice(0, 5), components: [...entry.components.values()],
    })),
    flows,
    skipped,
  };
}

function screenKey(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.host + templatePath(parsed.pathname);
  } catch {
    return url;
  }
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function markdown({ endpoints, screens, flows }) {
  const lines = ["# SBL endpoint index", "", `Generated ${new Date().toISOString()} from recorded sessions.`, "",
    `${endpoints.length} endpoints · ${screens.length} screens · ${flows.length} labelled flows`, ""];

  lines.push("## Endpoints", "");
  for (const endpoint of endpoints) {
    lines.push(`### \`${endpoint.method} ${endpoint.template}\``, "");
    lines.push(`- Host: \`${endpoint.host}\` · calls: ${endpoint.calls} · status: ${Object.entries(endpoint.statuses).map(([s, n]) => `${s}×${n}`).join(", ")} · median ${endpoint.medianMs ?? "–"} ms`);
    if (endpoint.queryKeys.length) lines.push(`- Query: ${endpoint.queryKeys.map((k) => `\`${k}\``).join(", ")}`);
    if (endpoint.flows.length) lines.push(`- Flows: ${endpoint.flows.join(" · ")}`);
    for (const trigger of endpoint.triggeredBy.slice(0, 4)) {
      lines.push(`- Triggered by ${trigger.kind} on \`<${trigger.tag}>\` **${trigger.label || "(no label)"}**` +
        `${trigger.section ? ` under "${trigger.section}"` : ""} at (${trigger.box?.x}, ${trigger.box?.y}) ${trigger.box?.width}×${trigger.box?.height}` +
        `${trigger.screenshot ? ` — ![](${trigger.screenshot})` : ""}`);
      lines.push(`  - screen: \`${trigger.screen}\` · selector: \`${trigger.selector}\``);
    }
    if (endpoint.requestShape) lines.push("", "Request:", "```json", JSON.stringify(endpoint.requestShape, null, 2).slice(0, 1200), "```");
    if (endpoint.responseShape) lines.push("", "Response:", "```json", JSON.stringify(endpoint.responseShape, null, 2).slice(0, 1200), "```");
    lines.push("");
  }

  lines.push("## Flows", "");
  for (const item of flows) {
    lines.push(`### ${item.label}`, "");
    for (const step of item.steps) {
      const calls = step.requests.map((r) => `${r.method} ${r.path} (${r.status})`).join("; ");
      lines.push(`1. ${step.kind} **${step.label || "(no label)"}** on \`${step.url}\`${calls ? ` → ${calls}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function loadSessions(root) {
  const sessions = await readdir(root, { withFileTypes: true });
  const events = [];
  for (const entry of sessions) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, "events.jsonl");
    let raw;
    try { raw = await readFile(file, "utf8"); } catch { continue; }
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.screenshot) event.screenshot = path.posix.join(entry.name, event.screenshot.replace(/\\/g, "/"));
        events.push(event);
      } catch { /* A partially written final line is expected while recording. */ }
    }
  }
  return events.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  const root = process.argv[2] || path.resolve("captures");
  const events = await loadSessions(root);
  const include = process.argv.includes("--all") ? ["api", "page", "rsc", "asset"] : ["api"];
  const result = buildIndex(events, { include });
  const out = path.join(root, "index");
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "endpoints.json"), JSON.stringify(result, null, 2), "utf8");
  await writeFile(path.join(out, "ENDPOINTS.md"), markdown(result), "utf8");
  console.log(`${events.length} events → ${result.endpoints.length} endpoints, ${result.screens.length} screens, ${result.flows.length} flows (skipped: ${JSON.stringify(result.skipped)})`);
  console.log(`Wrote ${path.join(out, "ENDPOINTS.md")}`);
}
