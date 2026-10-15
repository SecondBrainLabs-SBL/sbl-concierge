// Verifies a generated site index (FR-8: a stale or failed index is reported, not silently used).
//   node tools/check-sitemap.mjs <site-map.js> [--live] [--max-age-days 14] [--diff <other-site-map.js>] [--max 400]
// Offline by default. --live re-fetches every non-blog page (4 concurrent, 300 ms gap). Exit 0 = ok, 1 = problems.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { get, norm, requestCount } from "./build-sitemap.mjs";

export const REQUIRED = ["/", "/pricing/", "/case-study/", "/agency/"];
const { canonPath } = createRequire(import.meta.url)("../core/router.js");
const pathOf = (p) => canonPath(p.url);
const isBlog = (p) => (pathOf(p) || "").startsWith("/blog/");

export const load = (file) => createRequire(import.meta.url)(path.resolve(file));

// -> list of problem strings (empty = good)
export function checkIndex(m, { now = Date.now(), maxAgeDays = 14 } = {}) {
  const errs = [];
  if (!m || typeof m !== "object") return ["not an object"];
  if (typeof m.site !== "string") errs.push("site missing");
  if (typeof m.text !== "string" || !m.text) errs.push("text missing");
  if (!Array.isArray(m.pages) || !m.pages.length) return [...errs, "pages missing or empty"];
  const t = Date.parse(m.generatedAt);
  if (Number.isNaN(t)) errs.push(`generatedAt not parseable: ${m.generatedAt}`);
  else if (now - t > maxAgeDays * 864e5) errs.push(`stale: generated ${m.generatedAt} (${Math.floor((now - t) / 864e5)} days old, max ${maxAgeDays})`);
  const seen = new Set();
  m.pages.forEach((p, i) => {
    if (!p || typeof p.url !== "string" || typeof p.title !== "string" || typeof p.type !== "string") return errs.push(`page #${i}: needs url, title, type`);
    const c = pathOf(p);
    if (!c) return errs.push(`page #${i}: ${p.url} is not an sbl.so URL`);
    if (seen.has(c)) errs.push(`duplicate canonical URL ${c}`);
    seen.add(c);
    if (isBlog(p) && p.type !== "blog post") errs.push(`${c} is under /blog/ but typed "${p.type}"`);
    if (p.sections !== undefined && !Array.isArray(p.sections)) errs.push(`${c}: sections is not an array`);
    (p.sections || []).forEach((s, j) => { if (typeof s?.heading !== "string" || !s.heading.trim()) errs.push(`${c}: section #${j} has an empty heading`); });
  });
  for (const r of REQUIRED) if (!seen.has(r)) errs.push(`required page missing: ${r}`);
  return errs;
}

const heads = (p) => new Set((p.sections || []).map((s) => s.heading));
// Pages added, removed and retyped from a to b, plus headings added/removed per page present in both.
export function diffIndex(a, b) {
  const A = new Map(a.pages.map((p) => [pathOf(p), p])), B = new Map(b.pages.map((p) => [pathOf(p), p]));
  const d = { added: [], removed: [], retyped: [], sections: [] };
  for (const [k, p] of B) if (!A.has(k)) d.added.push({ path: k, type: p.type });
  for (const [k, p] of A) {
    const q = B.get(k);
    if (!q) { d.removed.push({ path: k, type: p.type }); continue; }
    if (p.type !== q.type) d.retyped.push({ path: k, from: p.type, to: q.type });
    const ha = heads(p), hb = heads(q);
    const add = [...hb].filter((h) => !ha.has(h)), rem = [...ha].filter((h) => !hb.has(h));
    if (add.length || rem.length) d.sections.push({ path: k, added: add, removed: rem });
  }
  return d;
}

// Re-fetch every non-blog page. -> [{url, reason}] for the dead ones.
export async function liveCheck(m, concurrency = 4) {
  const todo = m.pages.filter((p) => !isBlog(p) && p.type !== "blog post"), dead = [];
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < todo.length) {
      const p = todo[i++], r = await get(p.url);
      if (!r.ok) dead.push({ url: p.url, reason: r.reason });
      else if (!norm(r.finalUrl)) dead.push({ url: p.url, reason: "redirects off-site to " + r.finalUrl });
    }
  }));
  return { checked: todo.length, dead };
}

async function main() {
  const argv = process.argv.slice(2), flag = (n) => argv.includes("--" + n), val = (n, d) => { const i = argv.indexOf("--" + n); return i < 0 ? d : argv[i + 1]; };
  const file = argv.find((a, i) => !a.startsWith("--") && !/^--(max-age-days|diff|max|delay|concurrency)$/.test(argv[i - 1] || ""));
  if (!file) { console.error("usage: check-sitemap.mjs <site-map.js> [--live] [--max-age-days N] [--diff other.js]"); process.exit(2); }
  const m = load(file);
  let bad = 0;
  const errs = checkIndex(m, { maxAgeDays: Number(val("max-age-days", 14)) });
  console.log(`${file}: ${m.pages?.length ?? 0} pages, generatedAt ${m.generatedAt}`);
  if (errs.length) { bad = 1; console.log(`PROBLEMS (${errs.length}):`); errs.forEach((e) => console.log("  - " + e)); } else console.log("offline checks: ok");
  if (flag("live")) {
    const r = await liveCheck(m);
    console.log(`live: ${r.checked - r.dead.length}/${r.checked} non-blog pages load (${requestCount()} requests)`);
    if (r.dead.length) { bad = 1; console.log("DEAD:"); r.dead.forEach((d) => console.log(`  - ${d.url}  ${d.reason}`)); }
  }
  if (val("diff")) {
    const d = diffIndex(m, load(val("diff")));
    console.log(`\ndiff ${file} -> ${val("diff")}: +${d.added.length} added, -${d.removed.length} removed, ${d.retyped.length} retyped`);
    d.added.forEach((x) => console.log(`  + ${x.path} [${x.type}]`));
    d.removed.forEach((x) => console.log(`  - ${x.path} [${x.type}]`));
    d.retyped.forEach((x) => console.log(`  ~ ${x.path}: ${x.from} -> ${x.to}`));
    d.sections.forEach((x) => console.log(`  # ${x.path}: +[${x.added.join(" | ")}] -[${x.removed.join(" | ")}]`));
  }
  process.exit(bad);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
