// Change gate. node tools/experience/gate.mjs <check>   exit 0 = pass, 1 = fail (prints why).
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_REPO } from "./driver.mjs";
import { loadRuns, scoreRuns, compareScores, honestMiss, ROWS } from "./score.mjs";

const EXP = process.env.SBL_EXP_DIR || path.join(DEFAULT_REPO, "var/experience"); // the env override is for the tests
const [check] = process.argv.slice(2);
const end = (ok, why) => { console.log(`${ok ? "PASS" : "FAIL"} ${check}: ${why}`); process.exit(ok ? 0 : 1); };

/** Newest run dir under var/experience (or `latest`) that contains <set>/. */
function latest(set) {
  const cands = [path.join(EXP, "latest"), ...(fs.existsSync(EXP) ? fs.readdirSync(EXP).filter((d) => !["latest", "baseline"].includes(d)).sort().reverse().map((d) => path.join(EXP, d)) : [])];
  return cands.find((d) => fs.existsSync(path.join(d, set)));
}
const scoreOf = (set) => { const d = latest(set); if (!d) end(false, `no ${set} run found in ${EXP}`); const runs = loadRuns(path.join(d, set)); if (!runs.length) end(false, `${d}/${set} has no steps.json`); return { d, sc: scoreRuns(runs) }; };
const fails = (rows) => rows.filter((r) => r.pass === false).map((r) => `${r.id}=${r.mean} (want ${r.op} ${r.target})`);

if (check === "baseline-exists") {
  const need = [path.join(DEFAULT_REPO, "docs/EXPERIENCE-BASELINE-SCORECARD.md"), path.join(EXP, "baseline/summary.json")];
  const missing = need.filter((f) => !fs.existsSync(f));
  end(!missing.length, missing.length ? `missing ${missing.join(", ")}` : "baseline scorecard and summary present");
} else if (/^e[1-9]$/.test(check || "")) {
  const { d, sc } = scoreOf("holdout"), rows = sc.rows.filter((r) => r.id.startsWith(check.toUpperCase() + "."));
  const bad = fails(rows), unknown = rows.filter((r) => r.pass === null && !ROWS.find((x) => x.id === r.id)?.judged && !ROWS.find((x) => x.id === r.id)?.info);
  end(!bad.length && !unknown.length, bad.length ? bad.join("; ") : unknown.length ? `no data for ${unknown.map((r) => r.id).join(", ")} in ${d}` : `${rows.filter((r) => r.pass !== null).length} rows meet target in ${d}`);
} else if (check === "no-worse") {
  const { sc } = scoreOf("holdout"), bd = path.join(EXP, "baseline");
  const bruns = fs.existsSync(path.join(bd, "holdout")) ? loadRuns(path.join(bd, "holdout")) : [];
  if (!bruns.length) end(false, `no baseline holdout run in ${bd}`);
  const worse = compareScores(scoreRuns(bruns), sc).filter((c) => c.verdict === "worse");
  end(!worse.length, worse.length ? worse.map((c) => `${c.id} ${c.base} -> ${c.cand} (noise ${c.noise})`).join("; ") : "no row worse beyond noise");
} else if (check === "founder-replay") {
  const { d, sc } = scoreOf("replay"), pick = (id) => sc.rows.find((r) => r.id === id).mean;
  const v = { silent: pick("E8.silent"), overMax: pick("E5.overMax"), nav: pick("E5.unrequestedNav"), signup: pick("E9.signup") };
  const bad = Object.entries(v).filter(([, x]) => x !== 0).map(([k, x]) => `${k}=${x}`);
  end(!bad.length, bad.length ? `${bad.join(", ")} in ${d}` : `0 silent, 0 over max, 0 nav/signup violations in ${d}`);
} else if (check === "faults") {
  if (!latest("faults")) end(false, `no faults run found in ${EXP}; start the server with ALLOW_FAULTS=1 and run: node tools/experience/run.mjs --set faults`);
  const { d, sc } = scoreOf("faults"), pick = (id) => sc.rows.find((r) => r.id === id).mean;
  const miss = loadRuns(path.join(d, "faults")).reduce((n, r) => n + r.steps.filter(honestMiss).length, 0);
  const v = { silent: pick("E8.silent"), late: pick("E8.late"), honestMisses: miss, nav: pick("E5.unrequestedNav") };
  const bad = Object.entries(v).filter(([, x]) => x !== 0).map(([k, x]) => `${k}=${x}`);
  end(!bad.length, bad.length ? `${bad.join(", ")} in ${d}` : `0 silent, 0 late, 0 honest misses, 0 unrequested navigations in ${d}`);
} else if (check === "discriminates") {
  // AC-4: the gate must tell a worse build from a better one on real runs. The original build (baseline) against a later
  // one: accepting the later build must find no row worse; the reverse direction (the old build offered as a "candidate")
  // must be rejected. Usage: gate.mjs discriminates [<better-run-dir>]  (default: latest)
  const good = process.argv[3] ? path.resolve(process.argv[3]) : latest("holdout"), bd = path.join(EXP, "baseline");
  const g = good && fs.existsSync(path.join(good, "holdout")) ? loadRuns(path.join(good, "holdout")) : [], b = fs.existsSync(path.join(bd, "holdout")) ? loadRuns(path.join(bd, "holdout")) : [];
  if (!g.length || !b.length) end(false, `need holdout runs in ${bd} and ${good}`);
  const gs = scoreRuns(g), bs = scoreRuns(b);
  const forward = compareScores(bs, gs).filter((c) => c.verdict === "worse"), reverse = compareScores(gs, bs).filter((c) => c.verdict === "worse");
  const ok = !forward.length && reverse.length > 0;
  end(ok, ok ? `accepts the later build (0 rows worse) and rejects the original as a candidate (${reverse.length} rows worse: ${reverse.map((c) => c.id).join(", ")})`
    : forward.length ? `the later build is itself worse on ${forward.map((c) => c.id).join(", ")}` : "the gate did not reject the original build offered as a candidate");
} else {
  console.log(`FAIL ${check || "(none)"}: not implemented`);
  process.exit(1);
}
