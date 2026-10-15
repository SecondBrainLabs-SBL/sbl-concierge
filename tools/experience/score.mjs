// Scorecard: E1..E9 from run output (steps.json + optional trace.jsonl). See SPEC NFR-1..NFR-9.
//   node tools/experience/score.mjs <run-dir> [--json] [--compare <baseline-dir>]
// <run-dir> may be a whole run (contains <set>/<persona>/run-<n>/steps.json) or any subtree of one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rx } from "./personas.mjs";

// ---- helpers ------------------------------------------------------------
/** Nearest-rank percentile; null for an empty list. */
export function percentile(arr, p) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  return a.length ? a[Math.max(0, Math.ceil((p / 100) * a.length) - 1)] : null;
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const nums = (a) => a.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
const SBL = /^https?:\/\/(sbl\.so|app\.secondbrainlabs\.com)(\/|$|\?|#)/;
const noHash = (u) => (u || "").replace(/#.*$/, "");
const EMAIL_ASK = /\byour (work |business |best )?e-?mail\b|\be-?mail (address|me)\b|\b(share|enter|provide|give|type|drop)\b.{0,20}\be-?mail\b/i;
const asksEmail = (t) => EMAIL_ASK.test(t) || (/\be-?mail\b/i.test(t) && t.includes("?"));
const SIGNUP_URL = /app\.secondbrainlabs\.com\/(signup|sign-up|register)/i;
// Actions that do something to the page or the visitor's data. say/point/resume/wait/ask only talk or gesture.
const BENIGN_ACTIONS = /^(say|point|point-align|resume|wait|ask_user|ask|confirmation)$/;
const text = (s) => (s.lines || []).map((l) => l.text).join(" ");
const isSay = (s) => s.do === "say";

// ---- trace --------------------------------------------------------------
/** Group trace events into turns (in order of turn_open). */
export function parseTrace(raw) {
  const turns = new Map();
  for (const line of (raw || "").split("\n")) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e.turn) continue;
    const t = turns.get(e.turn) || { id: e.turn, lines: [], refused: 0, models: [], navs: [], errors: [], open: null, end: null, last: 0 };
    turns.set(e.turn, t);
    t.last = Math.max(t.last, e.t || 0);
    if (e.k === "turn_open") t.open = e;
    else if (e.k === "turn_end") t.end = e;
    else if (e.k === "line") (e.refused ? (t.refused++, 0) : t.lines.push(e));
    else if (e.k === "model") { if (e.path !== "/agent/note") t.models.push(e); } // the note call runs after the turn is over: not one of its calls
    else if (e.k === "nav") t.navs.push(e);
    else if (e.k === "error") t.errors.push(e);
  }
  return [...turns.values()].filter((t) => t.open).sort((a, b) => a.open.t - b.open.t);
}
/** Overlay trace facts on driver steps: say steps are matched to typed/spoken turns in order by text. */
export function mergeTrace(steps, turns) {
  let i = 0;
  return steps.map((s) => {
    if (!isSay(s) || !turns?.length) return s;
    const j = turns.findIndex((t, k) => k >= i && (t.open.text || "").trim() === (s.text || "").trim().slice(0, 500));
    if (j < 0) return s;
    i = j + 1;
    const t = turns[j], o = t.open.t;
    return {
      ...s, fromTrace: true,
      lines: t.lines.map((l) => ({ atMs: l.t - o, text: l.text })),
      firstLineMs: t.lines.length ? t.lines[0].t - o : null,
      busyMs: Math.max(t.end ? t.end.t : t.last, o) - o,
      modelCalls: t.models.length, modelCallMs: t.models.map((m) => m.ms),
      refusedLines: t.refused, traceNavs: t.navs.length, traceStatus: t.end?.status ?? null,
    };
  });
}

// ---- loading ------------------------------------------------------------
function findFiles(dir, name, out = []) {
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) findFiles(p, name, out); else if (d.name === name) out.push(p);
  }
  return out;
}
/** -> [{ run, steps: [...] }] with one entry per run index, personas pooled. */
export function loadRuns(dir) {
  const byRun = new Map();
  for (const f of findFiles(dir, "steps.json").sort()) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const tf = path.join(path.dirname(f), "trace.jsonl");
    const turns = fs.existsSync(tf) ? parseTrace(fs.readFileSync(tf, "utf8")) : [];
    const steps = mergeTrace(doc.steps, turns).map((s, i) => ({ ...s, persona: doc.persona, idx: i }));
    byRun.set(doc.run, [...(byRun.get(doc.run) || []), ...steps]);
  }
  return [...byRun].sort((a, b) => a[0] - b[0]).map(([run, steps]) => ({ run, steps }));
}

// ---- row computations (each takes one run's steps, returns a number or null) ----
const sayTimes = (steps, f) => nums(steps.filter(isSay).map(f));
const timed = (steps) => steps.filter(isSay).filter((s) => ["inform", "navigate"].includes(s.expect?.class));
const landsOk = (s) => { const re = s.expect?.landsOn; return !re || rx(re).test(s.url || "") || rx(re).test(s.shellUrl || ""); };
const wrongLanding = (s) => {
  const top = s.shellUrl || s.url;
  return !landsOk(s) || (s.urlStatus != null && s.urlStatus >= 400) || (top && /^https?:/.test(top) && !SBL.test(top));
};
export const moved = (s) => (s.actions || []).some((a) => a.type === "navigate")
  || (s.traceNavs || 0) > 0
  || (s.urlBefore != null && noHash(s.url) !== noHash(s.urlBefore))
  || (s.shellUrlBefore != null && s.shellUrl != null && noHash(s.shellUrl) !== noHash(s.shellUrlBefore));
const navViolation = (s) => s.expect?.noNav && (s.do === "say" || s.do === "wait" || s.do === "scroll") && moved(s);
const signupViolation = (s) => s.expect?.noSignup && (
  [s.url, s.shellUrl, ...(s.navigations || [])].some((u) => SIGNUP_URL.test(u || "")) || (s.lines || []).some((l) => asksEmail(l.text)));
export const captureOf = (s, pattern) => { const m = rx(pattern).exec(text(s)); return m ? (m[1] || "").toLowerCase() : null; };
const sideEffect = (s) => (s.actions || []).some((a) => !BENIGN_ACTIONS.test(a.type)) || moved(s);

/** Steps that fall under a stop: the stop step itself and any wait tagged afterStop that follows it. */
function stopped(steps) {
  const out = [];
  steps.forEach((s, i) => {
    if (!(isSay(s) && s.expect?.stop)) return;
    out.push(s);
    for (let j = i + 1; j < steps.length && steps[j].persona === s.persona && steps[j].tags?.includes("afterStop") && steps[j].do === "wait"; j++) out.push(steps[j]);
  });
  return out;
}
function decisionShare(steps) {
  const groups = {};
  steps.filter((s) => s.expect?.decisionGroup).forEach((s) => (groups[`${s.persona}/${s.expect.decisionGroup}`] ||= []).push(captureOf(s, s.expect.decisionPattern)));
  const g = Object.values(groups).filter((v) => v.length >= 2);
  return g.length ? g.filter((v) => v.every((x) => x !== null && x === v[0])).length / g.length : null;
}
function recallShare(steps, reload) {
  let want = 0, got = 0;
  for (const s of steps.filter(isSay)) {
    if (Boolean(s.tags?.includes("afterReload")) !== reload) continue;
    for (const r of s.expect?.recalls || []) { want++; if (rx(r).test(text(s))) got++; }
  }
  return want ? got / want : null;
}

/** A step whose `honest` regex is not matched by what the agent said (steps without one never miss). */
export const honestMiss = (s) => isSay(s) && Boolean(s.expect?.honest) && !rx(s.expect.honest).test(text(s));

/** Row definitions. op: "<=" or ">=" is the pass direction. */
export const ROWS = [
  { id: "E1.p50", name: "First reaction p50 (ms)", op: "<=", target: 1500, f: (st) => percentile(sayTimes(st, (s) => s.firstLineMs), 50) },
  { id: "E1.p95", name: "First reaction p95 (ms)", op: "<=", target: 3000, f: (st) => percentile(sayTimes(st, (s) => s.firstLineMs), 95) },
  { id: "E1.words", name: "First words p50 (ms, preview or first line; info)", info: true, f: (st) => percentile(sayTimes(st, (s) => s.firstWordsMs), 50) },
  { id: "E1.words.p95", name: "First words p95 (ms, info)", info: true, f: (st) => percentile(sayTimes(st, (s) => s.firstWordsMs), 95) },
  { id: "E2.busy.p50", name: "Busy p50, inform/navigate (ms)", op: "<=", target: 8000, f: (st) => percentile(nums(timed(st).map((s) => s.busyMs)), 50) },
  { id: "E2.busy.p95", name: "Busy p95, inform/navigate (ms)", op: "<=", target: 15000, f: (st) => percentile(nums(timed(st).map((s) => s.busyMs)), 95) },
  { id: "E2.calls.p50", name: "Model calls p50", op: "<=", target: 3, f: (st) => percentile(nums(timed(st).map((s) => s.modelCalls)), 50) },
  { id: "E2.calls.max", name: "Model calls max", op: "<=", target: 3, f: (st) => { const a = nums(timed(st).map((s) => s.modelCalls)); return a.length ? Math.max(...a) : null; } },
  { id: "E3.wrongLandings", name: "Wrong landings (miss, 4xx/5xx, off-site)", op: "<=", target: 0, f: (st) => st.filter(wrongLanding).length },
  { id: "E4.occlusion", name: "Highlight covered by dock (steps)", op: "<=", target: 0, f: (st) => st.filter((s) => s.overlap === true).length },
  { id: "E4.match", name: "Highlight matches line (judged)", op: ">=", target: 0.85, judged: true, f: () => null, note: "judged row, not computed here" },
  { id: "E5.maxLines", name: "Lines per turn, max", op: "<=", target: 2, f: (st) => { const a = nums(st.filter(isSay).map((s) => (s.lines || []).length)); return a.length ? Math.max(...a) : null; } },
  { id: "E5.overMax", name: "Steps over maxLines", op: "<=", target: 0, f: (st) => st.filter((s) => isSay(s) && (s.lines || []).length > (s.expect?.maxLines ?? 2)).length },
  { id: "E5.unrequestedNav", name: "Unrequested navigations (noNav)", op: "<=", target: 0, f: (st) => st.filter(navViolation).length },
  { id: "E6.consistency", name: "Decision groups that agree", op: ">=", target: 0.9, f: decisionShare },
  { id: "E7.recall.inSession", name: "Recall in session", op: ">=", target: 1, f: (st) => recallShare(st, false) },
  { id: "E7.recall.afterReload", name: "Recall after reload", op: ">=", target: 0.9, f: (st) => recallShare(st, true) },
  { id: "E7.noQuestion", name: "Re-asked facts (noQuestion violated)", op: "<=", target: 0, f: (st) => st.filter((s) => isSay(s) && s.expect?.noQuestion && text(s).includes("?")).length },
  { id: "E8.silent", name: "Silent turns", op: "<=", target: 0, f: (st) => st.filter((s) => isSay(s) && s.expect?.mustReply !== false && !(s.lines || []).length).length },
  { id: "E8.late", name: "Replies later than replyWithinMs", op: "<=", target: 0, f: (st) => st.filter((s) => isSay(s) && s.expect?.replyWithinMs && (s.firstLineMs ?? 0) > s.expect.replyWithinMs).length },
  { id: "E8.stranded", name: "Stranded turns (no dock at end)", op: "<=", target: 0, f: (st) => st.filter((s) => s.dockExists === false).length },
  { id: "E9.afterStop", name: "Actions after stop (steps)", op: "<=", target: 0, f: (st) => stopped(st).filter(sideEffect).length },
  { id: "E9.signup", name: "Signup/email ask without request", op: "<=", target: 0, f: (st) => st.filter(signupViolation).length },
];
const meets = (row, v) => (v === null || row.info ? null : row.op === "<=" ? v <= row.target : v >= row.target);

// ---- aggregate ----------------------------------------------------------
export function scoreRuns(runs) {
  const rows = ROWS.map((r) => {
    const values = runs.map((x) => r.f(x.steps));
    const v = nums(values), m = mean(v);
    return { id: r.id, name: r.name, op: r.op, target: r.target, info: r.info, values, mean: m, spread: v.length ? Math.max(...v) - Math.min(...v) : null, pass: meets(r, m), note: r.note || (runs.length < 2 ? "1 run: noise unknown" : undefined) };
  });
  return { runs: runs.length, steps: runs.reduce((n, r) => n + r.steps.length, 0), rows };
}
/** better / worse / within noise per row; delta must exceed the larger of the two spreads. */
export function compareScores(base, cand) {
  const bm = Object.fromEntries(base.rows.map((r) => [r.id, r]));
  return cand.rows.map((c) => {
    const b = bm[c.id];
    if (!b || b.mean === null || c.mean === null) return { id: c.id, base: b?.mean ?? null, cand: c.mean, delta: null, verdict: "n/a" };
    const delta = c.mean - b.mean, noise = Math.max(b.spread || 0, c.spread || 0);
    const verdict = !c.op ? "n/a" : Math.abs(delta) <= noise ? "within noise" : (c.op === "<=" ? delta < 0 : delta > 0) ? "better" : "worse";
    return { id: c.id, base: b.mean, cand: c.mean, delta, noise, verdict };
  });
}

// ---- output -------------------------------------------------------------
const fmt = (v) => (v === null || v === undefined ? "n/a" : Number.isInteger(v) ? String(v) : v.toFixed(2));
export function renderMarkdown(sc) {
  const L = [`Runs: ${sc.runs}, steps: ${sc.steps}`, "", "| Row | Value per run | Mean | Target | Pass | Noise (max-min) |", "|---|---|---|---|---|---|"];
  for (const r of sc.rows) L.push(`| ${r.id} ${r.name} | ${r.values.map(fmt).join(", ")} | ${fmt(r.mean)} | ${r.info ? "info" : `${r.op} ${r.target}`} | ${r.pass === null ? "n/a" : r.pass ? "pass" : "FAIL"} | ${fmt(r.spread)}${r.note ? ` (${r.note})` : ""} |`);
  return L.join("\n");
}
export const renderCompare = (cmp) => ["| Row | Baseline | Candidate | Delta | Verdict |", "|---|---|---|---|---|", ...cmp.map((c) => `| ${c.id} | ${fmt(c.base)} | ${fmt(c.cand)} | ${fmt(c.delta)} | ${c.verdict} |`)].join("\n");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), dir = a.find((x) => !x.startsWith("--") && a[a.indexOf(x) - 1] !== "--compare");
  if (!dir) { console.error("usage: node score.mjs <run-dir> [--json] [--compare <baseline-dir>]"); process.exit(2); }
  const sc = scoreRuns(loadRuns(dir));
  const cmpDir = a[a.indexOf("--compare") + 1];
  const base = a.includes("--compare") ? scoreRuns(loadRuns(cmpDir)) : null;
  const cmp = base ? compareScores(base, sc) : null;
  if (a.includes("--json")) console.log(JSON.stringify({ candidate: sc, baseline: base, compare: cmp }, null, 1));
  else { if (base) console.log("BASELINE\n" + renderMarkdown(base) + "\n\nCANDIDATE"); console.log(renderMarkdown(sc)); if (cmp) console.log("\nCOMPARE\n" + renderCompare(cmp)); }
}
