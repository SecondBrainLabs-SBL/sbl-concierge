const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../harness.js'), 'utf8');
test('script-tag task restore uses hydrated cross-origin state over stale per-origin storage', async () => {
  const code = source.slice(source.indexOf('    const bg ='), source.indexOf('\n    let task ='));
  for (const current of [null, { goal: 'newer task' }]) {
    const bg = vm.runInNewContext(`${code}; bg`, {
      gone: false,
      sessionStorage: { getItem: () => JSON.stringify({ goal: 'stale task' }) },
      SBLStore: { local: { get: async () => current ? { sbl_task_v1: current } : {} } },
    });
    const restored = await bg({ op: 'get' });
    assert.equal(restored.task, current);
  }
});
