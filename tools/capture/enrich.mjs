// Links each recorded endpoint to the code that implements it, by searching the
// sbl-app repository at a chosen ref. Reading from a git ref means the working tree
// is never touched and no checkout is needed.
//
// Routes are declared in two shapes, and both are resolved to a full path:
//   { path: "/users", handlers: [usersRouter] }      // top-level mount table
//   companiesRouter.use("/:companyId/campaigns", r)  // nested mount
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const REPO = process.env.SBL_REPO || "C:/Users/syash/sbl-app";
const REF = process.env.SBL_REF || "origin/release/17sep26";
// git pathspec wildcards match a single path segment, and `**` needs `:(glob)` magic,
// so each directory level is listed explicitly.
const SERVER_GLOBS = [
  "apps/*/src/server/*.ts",
  "apps/*/src/server/routes/*.ts",
  "apps/*/src/server/routes/*/*.ts",
  "apps/*/src/routes/*.ts",
];

async function git(args) {
  try {
    const { stdout } = await run("git", ["-C", REPO, ...args], { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch {
    return ""; // git grep exits non-zero when nothing matches.
  }
}

async function gitGrep(pattern, globs = SERVER_GLOBS) {
  const out = await git(["grep", "-n", "-E", pattern, REF, "--", ...globs]);
  return out.trim().split("\n").filter(Boolean);
}

function parseMatch(line) {
  const match = line.match(/^([^:]+):([^:]+):(\d+):(.*)$/);
  return match ? { ref: match[1], file: match[2], line: Number(match[3]), text: match[4].trim().slice(0, 200) } : null;
}

const fileCache = new Map();
async function fileLines(file) {
  if (!fileCache.has(file)) fileCache.set(file, (await git(["show", `${REF}:${file}`])).split("\n"));
  return fileCache.get(file);
}

// Where each router is mounted, and inside which parent router.
let mountsPromise;
async function mounts() {
  mountsPromise ??= (async () => {
    const map = new Map();
    for (const line of await gitGrep('handlers:\\s*\\[')) {
      const parsed = parseMatch(line);
      if (!parsed) continue;
      const lines = await fileLines(parsed.file);
      const routers = (lines[parsed.line - 1] || "").match(/\[([^\]]*)/)?.[1]
        || (lines[parsed.line] || "");
      // The `path:` key sits just above `handlers:`.
      let prefix = null;
      for (let offset = 1; offset <= 4; offset++) {
        const found = (lines[parsed.line - 1 - offset] || "").match(/path:\s*["'`]([^"'`]+)["'`]/);
        if (found) { prefix = found[1]; break; }
      }
      for (const name of routers.split(",").map((r) => r.trim()).filter((r) => /^\w+$/.test(r))) {
        if (prefix && !map.has(name)) map.set(name, { prefix, parent: null, at: `${parsed.file}:${parsed.line}` });
      }
    }
    for (const line of await gitGrep('\\w+\\.use\\(\\s*["\'`]/')) {
      const parsed = parseMatch(line);
      if (!parsed) continue;
      const found = parsed.text.match(/(\w+)\.use\(\s*["'`]([^"'`]+)["'`]\s*,\s*([\w,\s]+)\)?/);
      if (!found) continue;
      for (const name of found[3].split(",").map((r) => r.trim()).filter((r) => /^\w+$/.test(r))) {
        if (!map.has(name)) map.set(name, { prefix: found[2], parent: found[1], at: `${parsed.file}:${parsed.line}` });
      }
    }
    return map;
  })();
  return mountsPromise;
}

async function fullPrefix(router, seen = new Set()) {
  const map = await mounts();
  const parts = [];
  let current = router;
  while (current && !seen.has(current)) {
    seen.add(current);
    const mount = map.get(current);
    if (!mount) break;
    parts.unshift(mount.prefix);
    current = mount.parent;
  }
  return parts.join("").replace(/\/+/g, "/");
}

// Compares "/companies/:companyId/campaigns/:id" with a recorded
// "/companies/:companyId/campaigns/:campaignId" by ignoring parameter names.
function normalize(value) {
  return value.replace(/:[A-Za-z0-9_]+/g, ":x").replace(/\/+$/, "").toLowerCase() || "/";
}

async function resolveRoute(match, verb) {
  const lines = await fileLines(match.file);
  for (let offset = 0; offset <= 8; offset++) {
    const line = lines[match.line - 1 - offset];
    if (line === undefined) break;
    const found = line.match(/(\w+)\s*\.\s*(get|post|put|patch|delete)\s*\(/i);
    if (!found) continue;
    if (found[2].toLowerCase() !== verb) return null;
    return { router: found[1], verbLine: match.line - offset, definition: line.trim().slice(0, 120) };
  }
  return null;
}

function searchKeys(template) {
  const literals = template.split("/").filter((segment) => segment && !segment.startsWith(":"));
  return [...literals].reverse().slice(0, 3);
}

export async function enrichEndpoint(endpoint) {
  const verb = endpoint.method.toLowerCase();
  const wanted = normalize(endpoint.template);
  const results = [];
  const seen = new Set();

  for (const key of searchKeys(endpoint.template)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const line of (await gitGrep(`["'\`]/${escaped}(["'\`/]|$)`)).slice(0, 40)) {
      const parsed = parseMatch(line);
      if (!parsed || seen.has(`${parsed.file}:${parsed.line}`)) continue;
      seen.add(`${parsed.file}:${parsed.line}`);
      const route = await resolveRoute(parsed, verb);
      if (!route) continue;
      const literal = parsed.text.match(/["'`](\/[^"'`]*)["'`]/)?.[1] || "";
      const prefix = await fullPrefix(route.router);
      const fullPath = `${prefix}${literal}`.replace(/\/+/g, "/");
      results.push({
        file: parsed.file, line: parsed.line, key, router: route.router,
        definition: route.definition, literal, fullPath,
        exact: normalize(fullPath) === wanted,
        confidence: normalize(fullPath) === wanted ? "exact"
          : normalize(fullPath).endsWith(normalize(endpoint.template).split("/").pop()) ? "partial" : "weak",
      });
    }
    if (results.some((r) => r.exact)) break;
  }

  // List endpoints are often the router's own root, written as `.get("/", …)`, which
  // has no distinctive literal to search for. Resolve those through the mount map.
  if (!results.some((r) => r.exact)) {
    const map = await mounts();
    for (const [router] of map) {
      if (normalize(await fullPrefix(router)) !== wanted) continue;
      for (const line of await gitGrep(`${router}\\s*\\.\\s*${verb}\\s*\\(`)) {
        const parsed = parseMatch(line);
        if (!parsed) continue;
        const lines = await fileLines(parsed.file);
        const nearby = lines.slice(parsed.line - 1, parsed.line + 3).join(" ");
        if (!/["'`]\/["'`]/.test(nearby)) continue;
        const prefix = await fullPrefix(router);
        results.unshift({
          file: parsed.file, line: parsed.line, key: "(root)", router,
          definition: parsed.text, literal: "/", fullPath: prefix,
          exact: true, confidence: "exact",
        });
      }
    }
  }

  results.sort((a, b) => Number(b.exact) - Number(a.exact));
  return results.slice(0, 5);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  const indexFile = process.argv[2] || path.resolve("captures/index/endpoints.json");
  const index = JSON.parse(await readFile(indexFile, "utf8"));
  const lines = ["# Endpoint → source", "", `Repository \`${REPO}\` at \`${REF}\`.`, ""];
  let exact = 0;
  for (const endpoint of index.endpoints) {
    const matches = await enrichEndpoint(endpoint);
    endpoint.source = matches;
    if (matches.some((m) => m.exact)) exact++;
    lines.push(`### \`${endpoint.method} ${endpoint.template}\``, "");
    if (!matches.length) lines.push("- no source match (external service, or a path built from constants)");
    for (const match of matches) {
      lines.push(`- ${match.exact ? "**exact**" : match.confidence} \`${match.fullPath}\` — \`${match.file}:${match.line}\` (${match.router})`);
    }
    lines.push("");
  }
  await writeFile(indexFile, JSON.stringify(index, null, 2), "utf8");
  await writeFile(path.join(path.dirname(indexFile), "SOURCE.md"), lines.join("\n"), "utf8");
  console.log(`${exact}/${index.endpoints.length} endpoints matched exactly to source at ${REF}`);
}
