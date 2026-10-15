const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const mod = import('../tools/experience/mine.mjs');
const roots = []; test.afterEach(() => roots.splice(0).forEach(p => fs.rmSync(p, { recursive: true, force: true })));
const step = (text, over = {}) => ({ do: 'say', text, expect: {}, lines: [{ text: 'Answer', atMs: 100 }], firstLineMs: 100, busyMs: 110, modelCalls: 1, actions: [], dockExists: true, ...over });
function fixture(steps, events = [], judges = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbl-mine-')); roots.push(root);
  const dir = path.join(root, 'holdout/p/run-1'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'steps.json'), JSON.stringify({ set: 'holdout', persona: 'p', run: 1, steps }));
  fs.writeFileSync(path.join(dir, 'trace.jsonl'), events.map(x => JSON.stringify(x)).join('\n'));
  if (judges.length) fs.writeFileSync(path.join(root, 'judge.json'), JSON.stringify({ steps: judges }));
  return { root, dir };
}
test('mine joins real trace IDs, overlays timing, groups duplicate errors, and deduplicates overlapping inputs', async () => {
  const f = fixture([step('hello')], [
    { k: 'turn_open', turn: 'turn-1', t: 100, text: 'hello' },
    { k: 'line', turn: 'turn-1', t: 2100, text: 'Answer' },
    { k: 'line', turn: 'turn-1', t: 2200, text: 'repeat', refused: true },
    { k: 'error', turn: 'turn-1', t: 2201, detail: 'network 500' },
    { k: 'error', turn: 'turn-1', t: 2202, detail: 'network 502' },
    { k: 'model', turn: 'turn-1', t: 2202, path: '/agent/route', status: 'timeout' },
    { k: 'turn_end', turn: 'turn-1', t: 2300, status: 'failed' }
  ], [{ set: 'holdout', persona: 'p', run: 1, step: 0, useful: { verdict: 'fail', reason: 'No useful answer' } }]);
  const r = (await mod).mine([f.root, f.dir, f.root]);
  assert.equal(r.files, 1); assert.equal(r.matchedTurns, 1);
  for (const cause of ['score:E1.p50', 'trace:refused-line', 'trace:error:network #', 'model:/agent/route:timeout', 'judge:useful']) {
    const c = r.causes.find(x => x.cause === cause); assert.ok(c, cause); assert.equal(c.frequency, 1); assert.equal(c.example.turnId, 'turn-1');
  }
  assert.equal(r.flaggedSteps, 1);
});
test('mine attributes whole decision groups and actions in waits after stop, without flagging a later unrelated wait', async () => {
  const decision = { decisionGroup: 'plan', decisionPattern: '(starter|pro)' };
  const f = fixture([step('a', { expect: decision, lines: [{ text: 'starter' }] }), step('b', { expect: decision, lines: [{ text: 'pro' }] }),
    step('stop', { expect: { stop: true } }), { do: 'wait', tags: ['afterStop'], actions: [{ type: 'click' }] },
    step('continue'), { do: 'wait', tags: ['afterStop'], actions: [{ type: 'click' }] }]);
  const r = (await mod).mine([f.root]);
  assert.equal(r.causes.find(c => c.cause === 'score:E6.consistency').frequency, 2);
  const stopped = r.causes.find(c => c.cause === 'score:E9.afterStop'); assert.equal(stopped.frequency, 1); assert.equal(stopped.example.step, 3);
});
test('mine preserves aggregate percentile definitions: a passing pooled p50 does not become a per-turn p50 failure', async () => {
  const f = fixture([step('a'), step('b'), step('c', { firstLineMs: 2000 })]);
  assert.ok(!(await mod).mine([f.root]).causes.some(c => c.cause === 'score:E1.p50'));
});
test('mine ranks by frequency times severity, marks injected faults, and tolerates malformed or absent traces', async () => {
  const f = fixture([{ do: 'fault', code: 'down' }, step('a', { lines: [], dockExists: false }), step('b', { lines: [] })]);
  fs.writeFileSync(path.join(f.dir, 'trace.jsonl'), 'not json\n');
  const r = (await mod).mine([f.root]);
  assert.equal(r.causes[0].cause, 'score:E8.silent'); assert.equal(r.causes[0].rankScore, 4);
  assert.equal(r.causes[0].injectedFaultTurns, 2); assert.match(r.causes[0].example.turnId, /steps.json#1$/);
  assert.match(r.warnings[0], /malformed/);
  fs.unlinkSync(path.join(f.dir, 'trace.jsonl')); assert.match((await mod).mine([f.root]).warnings[0], /No trace/);
});
test('mine CLI emits parseable JSON and reviewable Markdown and rejects missing or empty inputs', async () => {
  const f = fixture([step('a', { lines: [] })]);
  const cli = (...args) => spawnSync(process.execPath, ['tools/experience/mine.mjs', ...args], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  const json = cli(f.root, '--json'); assert.equal(json.status, 0); assert.equal(JSON.parse(json.stdout).files, 1);
  const md = cli(f.root); assert.equal(md.status, 0); assert.match(md.stdout, /score:E8.silent/);
  assert.equal(cli().status, 1); assert.equal(cli(f.root, '--bogus').status, 1);
  fs.unlinkSync(path.join(f.dir, 'steps.json')); assert.equal(cli(f.root).status, 1);
});

test('mine reports literal honest-regex misses without changing expectations or calling them dishonesty', async () => {
  const f = fixture([step('dentists?', { expect: { honest: "no |not |n't|cannot|unable|none" }, lines: [{ text: 'I don’t have that case study.' }] })]);
  const r = (await mod).mine([f.root]);
  assert.equal(r.causes[0].cause, 'expectation:honest-regex-miss');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'steps.json'))).steps[0].expect.honest, "no |not |n't|cannot|unable|none");
});

test('mine keeps independent run roots and judges separate and matches repeated visitor messages in order', async () => {
  const a = fixture([step('repeat'), step('repeat')], [
    { k: 'turn_open', turn: 'first', text: 'repeat', t: 1 }, { k: 'line', turn: 'first', text: 'one', t: 100 },
    { k: 'turn_open', turn: 'second', text: 'repeat', t: 200 }, { k: 'line', turn: 'second', text: 'two', t: 300 }
  ], [{ set: 'holdout', persona: 'p', run: 1, step: 1, useful: { verdict: 'fail', reason: 'repeated answer' } }]);
  const b = fixture([step('repeat')]);
  const r = (await mod).mine([a.root, b.root]);
  assert.equal(r.files, 2); assert.equal(r.matchedTurns, 2);
  const c = r.causes.find(c => c.cause === 'judge:useful'); assert.equal(c.frequency, 1); assert.equal(c.example.turnId, 'second');
});
