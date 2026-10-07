const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../ava-platform/js/core/bpjsBridge.js'), 'utf8');
function load(blocked = false) {
  const removed = [];
  const context = { window: {}, localStorage: {
    getItem() { throw Error('Must not read secrets'); },
    setItem() { throw Error('Must not store secrets'); },
    removeItem(key) { if (blocked) throw Error('Storage blocked'); removed.push(key); }
  }, fetch() { throw Error('Must not make requests'); } };
  vm.runInNewContext(source, context);
  return { bridge: context.window.BPJS_BRIDGE, removed };
}
test('BPJS cannot return a participant, SEP or authentication success', async () => {
  const { bridge, removed } = load();
  assert.equal(bridge.getConfig().enabled, false);
  assert.deepEqual(removed, ['ava_bpjs_bridge_config']);
  for (const method of ['generateSignature', 'getAuthHeaders', 'cariPesertaByNIK', 'createSEP']) {
    await assert.rejects(bridge[method]({ synthetic: true }), { code: 'BPJS_NOT_CONNECTED' });
  }
  assert.throws(() => bridge.saveConfig({ synthetic: true }), { code: 'BPJS_NOT_CONNECTED' });
});
test('blocked browser storage still leaves bridge explicitly unavailable', async () => {
  const { bridge } = load(true);
  await assert.rejects(bridge.createSEP({}), { code: 'BPJS_NOT_CONNECTED' });
});
