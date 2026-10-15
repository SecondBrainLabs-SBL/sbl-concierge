// Offline triage: node tools/experience/mine.mjs <run-dir>... [--json]
// Reuses the scorecard unchanged. These are evidence clusters, not proven root causes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROWS, parseTrace, mergeTrace, captureOf, honestMiss } from './score.mjs';

const bad = (row, n) => Number.isFinite(n) && (row.op === '<=' ? n > row.target : n < row.target);
const severity = (id) => /^E[39]\.|E5.unrequestedNav|E8.stranded/.test(id) ? 3 : /^E[12]\./.test(id) ? 1 : 2;
const normalizeError = (s) => String(s || 'unknown').replace(/https?:\/\/\S+/g, '[url]').replace(/\b[0-9a-f]{8}(?:-[0-9a-f]+)+\b/gi, '[id]').replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 160);
function filesBelow(dir, out) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) filesBelow(p, out);
    else if (d.name === 'steps.json') out.add(fs.realpathSync(p));
  }
}
function runRoot(file, set) {
  for (let p = path.dirname(file); p !== path.dirname(p); p = path.dirname(p)) if (path.basename(p) === set) return path.dirname(p);
  return path.dirname(file);
}

export function mine(dirs) {
  const files = new Set(), groups = new Map(), clusters = new Map(), judges = new Map(), warnings = [];
  for (const dir of dirs) {
    const p = fs.realpathSync(dir);
    if (!fs.statSync(p).isDirectory()) throw new Error(`Not a run directory: ${dir}`);
    filesBelow(p, files);
  }
  if (!files.size) throw new Error('No steps.json found in the supplied directories');
  let totalSteps = 0, matchedTurns = 0;
  const flagged = new Set();
  const add = (cause, weight, s, evidence) => {
    const c = clusters.get(cause) || { cause, severity: weight, hits: new Map() };
    if (!c.hits.has(s._key)) c.hits.set(s._key, { turnId: s._turn?.id || `${s._file}#${s.idx}`, file: s._file, step: s.idx, evidence, injectedFault: Boolean(s._fault) });
    clusters.set(cause, c); flagged.add(s._key);
  };
  for (const file of [...files].sort()) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(doc.steps)) throw new Error(`Missing steps array: ${file}`);
    const tf = path.join(path.dirname(file), 'trace.jsonl');
    const raw = fs.existsSync(tf) ? fs.readFileSync(tf, 'utf8') : '';
    if (!raw) warnings.push(`No trace: ${file}`);
    const malformed = raw.split('\n').filter((l) => { if (!l.trim()) return false; try { JSON.parse(l); return false; } catch { return true; } }).length;
    if (malformed) warnings.push(`${malformed} malformed trace lines: ${tf}`);
    const turns = parseTrace(raw), steps = mergeTrace(doc.steps, turns), root = runRoot(file, doc.set);
    const jf = path.join(root, 'judge.json');
    if (!judges.has(jf)) {
      const rows = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')).steps || [] : [];
      judges.set(jf, new Map(rows.map((j) => [`${j.set}/${j.persona}/${j.run}/${j.step}`, j])));
    }
    let next = 0, fault = null, stopped = false;
    for (const [idx, s] of steps.entries()) {
      if (s.do === 'fault') fault = s.code || null;
      if (s.do === 'say') stopped = Boolean(s.expect?.stop);
      else if (!(s.do === 'wait' && s.tags?.includes('afterStop'))) stopped = false;
      Object.assign(s, { persona: doc.persona, idx, _file: file, _key: `${file}#${idx}`, _fault: fault, _stopped: stopped });
      if (s.do === 'say') {
        const j = turns.findIndex((t, k) => k >= next && (t.open.text || '').trim() === (s.text || '').trim().slice(0, 500));
        if (j >= 0) { s._turn = turns[j]; next = j + 1; matchedTurns++; }
      }
      const j = judges.get(jf).get(`${doc.set}/${doc.persona}/${doc.run}/${idx}`);
      for (const row of ['asked_vs_done', 'show_match', 'useful']) if (j?.[row]?.verdict === 'fail') add(`judge:${row}`, 2, s, j[row].reason || 'provisional judge fail');
      if (s.error) add(`driver:${normalizeError(s.error)}`, 3, s, 'driver error');
      if (s.timedOut) add('driver:timeout', 2, s, 'driver timedOut');
      if (honestMiss(s)) add('expectation:honest-regex-miss', 2, s, 'honest expectation did not match');
      if (s.refusedLines || s._turn?.refused) add('trace:refused-line', 2, s, `${s.refusedLines || s._turn.refused} lines refused by a guard (may be correct)`);
      for (const e of s._turn?.errors || []) add(`trace:error:${normalizeError(e.detail)}`, 2, s, 'trace error');
      for (const m of s._turn?.models || []) if (m.status === 'timeout' || Number(m.status) >= 400) {
        const code = m.status === 'timeout' ? 'timeout' : `${Math.floor(Number(m.status) / 100)}xx`;
        add(`model:${m.path || 'unknown'}:${code}`, 2, s, `model status ${m.status}`);
      }
    }
    totalSteps += steps.length;
    const key = `${root}/${doc.set}/${doc.run}`;
    groups.set(key, [...(groups.get(key) || []), ...steps]);
  }
  // Evaluate actual pooled set/run rows first. Attribute a failed row only to contributing steps.
  // E6 needs its whole decision group; E9 needs the preceding stop for tagged wait steps.
  for (const steps of groups.values()) for (const row of ROWS.filter((r) => !r.info && !r.judged)) {
    if (!bad(row, row.f(steps))) continue;
    for (const s of steps) {
      let context = [s];
      if (row.id === 'E6.consistency') {
        if (!s.expect?.decisionGroup) continue;
        context = steps.filter((x) => x.persona === s.persona && x.expect?.decisionGroup === s.expect.decisionGroup);
        const vals = context.map((x) => captureOf(x, x.expect.decisionPattern));
        if (vals.length < 2 || vals.every((x) => x !== null && x === vals[0])) continue;
      } else if (row.id === 'E9.afterStop' && s.do === 'wait' && s._stopped) {
        context = [{ do: 'say', persona: s.persona, expect: { stop: true }, actions: [] }, s];
      }
      if (bad(row, row.f(context))) add(`score:${row.id}`, severity(row.id), s, `contributes to failed pooled row ${row.id}`);
    }
  }
  const causes = [...clusters.values()].map((c) => {
    const hits = [...c.hits.values()];
    return { cause: c.cause, severity: c.severity, frequency: hits.length, rankScore: hits.length * c.severity, injectedFaultTurns: hits.filter((x) => x.injectedFault).length, example: hits[0], turns: hits };
  }).sort((a, b) => b.rankScore - a.rankScore || b.severity - a.severity || b.frequency - a.frequency || a.cause.localeCompare(b.cause));
  return { files: files.size, steps: totalSteps, matchedTurns, flaggedSteps: flagged.size, ranking: 'frequency × severity; ties: severity, frequency, cause. Severity 3 safety/stranding/driver errors, 2 response quality/failures, 1 latency/call efficiency. Judge labels provisional; refused lines and injected faults can be expected. Clusters are evidence, not proven root causes.', causes, warnings };
}

export function markdown(result) {
  const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
  return [`${result.files} run files; ${result.steps} steps; ${result.matchedTurns} matched trace turns; ${result.flaggedSteps} flagged steps.`, '', result.ranking, '', '| Cause | Frequency | Severity | Rank | Fault turns | Example turn |', '|---|---:|---:|---:|---:|---|', ...result.causes.map((c) => `| ${esc(c.cause)} | ${c.frequency} | ${c.severity} | ${c.rankScore} | ${c.injectedFaultTurns} | ${esc(c.example.turnId)} |`), '', ...result.warnings.map((w) => `Warning: ${w}`)].join('\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), dirs = args.filter((a) => a !== '--json');
    if (!dirs.length || dirs.some((a) => a.startsWith('--'))) throw new Error('Usage: node tools/experience/mine.mjs <run-dir>... [--json]');
    const result = mine(dirs);
    console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : markdown(result));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
