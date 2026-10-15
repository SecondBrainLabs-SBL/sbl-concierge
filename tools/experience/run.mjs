// Run the persona suite against a build.
//   node tools/experience/run.mjs --set dev|holdout|replay|faults|all [--persona id] [--runs 3] [--repo PATH] [--out DIR] [--concurrency 1] [--headed]
// The server must already be running on :8787 (this does not start it). Spends real model credits.
// --set faults needs the server started with ALLOW_FAULTS=1 (the fault steps make it answer as a failed model would; 'all' leaves faults out).
import fs from "node:fs";
import path from "node:path";
import { Visitor, DEFAULT_REPO, SERVER, httpStatus } from "./driver.mjs";
import { loadPersonas, SETS } from "./personas.mjs";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? def : process.argv[i + 1]; };
const set = arg("set", "dev"), only = arg("persona"), runs = Number(arg("runs", 3)), conc = Math.max(1, Number(arg("concurrency", 1)));
const repo = path.resolve(arg("repo", DEFAULT_REPO)), headed = process.argv.includes("--headed");
const out = path.resolve(arg("out", path.join(DEFAULT_REPO, "var/experience", new Date().toISOString().replace(/[:.]/g, "-"))));

if (!(set === "all" || SETS.includes(set))) { console.error(`--set must be one of ${SETS.join(", ")}, all`); process.exit(2); }
if (!fs.existsSync(path.join(repo, "sbl-agent.js"))) { console.error(`No sbl-agent.js in ${repo}; build the bundle there first.`); process.exit(2); }
if ((await httpStatus(`${SERVER}health`, 3000)) !== 200) {
  console.error(`The server is not up at ${SERVER}health. Start it first (cd <repo> && node server.mjs), then re-run. Not starting it for you.`);
  process.exit(1);
}

const jobs = [];
for (const s of set === "all" ? SETS.filter((x) => x !== "faults") : [set]) for (const p of loadPersonas(s)) if (!only || p.id === only) for (let n = 1; n <= runs; n++) jobs.push({ s, p, n });
if (!jobs.length) { console.error(`No persona matches (set=${set}, persona=${only || "*"}).`); process.exit(2); }

function traceFor(sblvs) {
  const dir = path.join(repo, "var/trace");
  if (!sblvs.size || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((f) =>
    fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => { if (!l.trim()) return false; try { return sblvs.has(JSON.parse(l).v); } catch { return false; } }));
}

async function runOne({ s, p, n }) {
  const dir = path.join(out, s, p.id, `run-${n}`), t0 = Date.now(), steps = [];
  const v = await Visitor.start({ repo, headed, start: p.start, outDir: dir });
  try {
    for (const st of p.steps) {
      let r;
      try {
        r = st.do === "fault" ? await v.fault(st.code) : st.do === "say" ? await v.say(st.text) : st.do === "wait" ? await v.wait(st.ms) : st.do === "goto" ? await v.goto(st.url) : st.do === "reload" ? await v.reload() : await v.scroll(st.y);
      } catch (e) { r = { do: st.do, error: String(e).slice(0, 300), lines: [], actions: [], dockExists: false }; }
      steps.push({ ...r, tags: st.tags || [], expect: st.expect || {} });
      // Stranded (no dock on the page it left us on): counted once on this step; then do what a visitor
      // would — come back to the site — so the rest of the persona still runs.
      if (r.dockExists === false) await v.goto(p.start || "https://sbl.so/").catch(() => {});
    }
  } finally { await v.close(); }
  await new Promise((r) => setTimeout(r, 1500)); // let the server flush its trace
  const trace = traceFor(new Set(steps.map((x) => x.sblv).filter(Boolean)));
  if (trace.length) fs.writeFileSync(path.join(dir, "trace.jsonl"), trace.join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "steps.json"), JSON.stringify({ persona: p.id, set: s, run: n, start: p.start, repo, wallMs: Date.now() - t0, steps }, null, 1));
  const calls = steps.reduce((a, x) => a + (x.modelCalls || 0), 0);
  console.log(`done ${s}/${p.id} run-${n}: ${steps.length} steps, ${calls} model calls, ${((Date.now() - t0) / 1000).toFixed(0)}s${steps.some((x) => x.timedOut) ? ", HAD TIMEOUTS" : ""}`);
  return { s, id: p.id, n, wallMs: Date.now() - t0, modelCalls: calls, timeouts: steps.filter((x) => x.timedOut).length, trace: trace.map((l) => JSON.parse(l)) };
}

const T0 = Date.now(), results = [], queue = [...jobs];
await Promise.all(Array.from({ length: conc }, async () => { for (let j; (j = queue.shift()); ) results.push(await runOne(j).catch((e) => { console.error(`FAILED ${j.s}/${j.p.id} run-${j.n}: ${e}`); return { s: j.s, id: j.p.id, n: j.n, failed: String(e) }; })); }));

const tok = { prompt: 0, cached: 0, completion: 0, withCounts: 0 };
for (const r of results) for (const e of r.trace || []) if (e.k === "model" && e.prompt != null) { tok.withCounts++; tok.prompt += e.prompt || 0; tok.cached += e.cached || 0; tok.completion += e.completion || 0; }
const summary = {
  out, repo, set, runs, wallMs: Date.now() - T0, jobs: results.length, failed: results.filter((r) => r.failed).length,
  modelCalls: results.reduce((a, r) => a + (r.modelCalls || 0), 0), timeouts: results.reduce((a, r) => a + (r.timeouts || 0), 0),
  cost: tok.withCounts ? { modelEventsWithTokens: tok.withCounts, promptTokens: tok.prompt, cachedTokens: tok.cached, completionTokens: tok.completion }
    : "no token counts (server trace absent or without usage); model-call count only",
  perRun: results.map(({ trace, ...r }) => r),
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, perRun: undefined }, null, 1));
console.log(`summary: ${path.join(out, "summary.json")}\nscore:   node tools/experience/score.mjs ${out}`);
