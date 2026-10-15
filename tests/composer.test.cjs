const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
function composer() {
  const input = new EventTarget(), form = new EventTarget(), sent = [];
  input.value = '';
  form.requestSubmit = () => form.dispatchEvent(new Event('submit', { cancelable: true }));
  const from = source.indexOf('  $("form").addEventListener("submit"');
  const to = source.indexOf('  voiceButton.addEventListener("click"', from);
  assert.ok(from > 0 && to > from);
  new Function('$', 'input', 'submitText', source.slice(from, to))(() => form, input, text => sent.push(text));
  const key = (props = {}) => { const e = new Event('keydown', { cancelable: true }); Object.assign(e, { key: 'Enter', ...props }); input.dispatchEvent(e); return e; };
  return { input, form, sent, key };
}
test('Enter submits the composed message once without relying on a button click', () => {
  const { input, form, sent, key } = composer();
  input.value = '  Create a draft  ';
  assert.equal(key().defaultPrevented, true);
  assert.deepEqual(sent, ['Create a draft']);
  assert.equal(input.value, '');
  form.requestSubmit();
  assert.equal(sent.length, 1, 'an extra submit with the cleared field cannot duplicate the turn');
  input.value = 'Use Send too'; form.requestSubmit();
  assert.deepEqual(sent, ['Create a draft', 'Use Send too']);
});
test('IME confirmation, held Enter and other keys do not send a message', () => {
  const { input, sent, key } = composer(); input.value = 'unfinished';
  for (const props of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { key: 'a' }]) key(props);
  assert.deepEqual(sent, []); assert.equal(input.value, 'unfinished');
});
