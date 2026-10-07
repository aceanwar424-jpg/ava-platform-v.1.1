'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', '..', 'ava-platform', 'modules', 'system', 'config', 'master_registry.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function createHarness(rpcResult) {
  const messages = [];
  let closed = 0;
  let renders = 0;
  const context = {
    prompt: () => 'Synthetic test reason',
    FormData: class {
      constructor(form) { this.form = form; }
      get(key) { return this.form.values[key] ?? ''; }
    },
    sbRpc: async () => rpcResult,
    toast: (message, type) => messages.push({ message, type }),
    closeModalForce: () => { closed += 1; },
    document: { getElementById: () => null },
    console,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: sourcePath });
  vm.runInContext(`
    masterRegistryState.domain = 'specialty';
    masterRegistryState.records = [{ id: 7, code: 'SYN-1', name: 'Synthetic master' }];
    renderMasterRegistry = async () => { globalThis.__renders = (globalThis.__renders || 0) + 1; };
  `, context);
  return {
    context,
    messages,
    closed: () => closed,
    renders: () => context.__renders || renders,
  };
}

function createForm() {
  const submit = { disabled: false, textContent: 'Simpan master' };
  return {
    values: { code: 'SYN-1', name: 'Synthetic master', status: 'draft', category: 'Dokter Umum' },
    querySelector: selector => selector === 'button[type="submit"]' ? submit : null,
    submit,
  };
}

async function save(harness) {
  const form = createForm();
  await harness.context.saveMasterRecord({
    preventDefault() {},
    currentTarget: form,
  }, null);
  return form;
}

test('upsert tanpa record terkonfirmasi tidak menampilkan sukses', async () => {
  for (const response of [null, { ok: false }, { ok: true }]) {
    const harness = createHarness(response);
    const form = await save(harness);
    assert.equal(harness.closed(), 0);
    assert.equal(harness.renders(), 0);
    assert.ok(harness.messages.some(item => item.type === 'err' && /tidak mengonfirmasi/i.test(item.message)));
    assert.equal(form.submit.disabled, false);
  }
});

test('upsert dengan record terkonfirmasi menampilkan sukses dan memuat ulang', async () => {
  const harness = createHarness({ id: 42 });
  await save(harness);
  assert.equal(harness.closed(), 1);
  assert.equal(harness.renders(), 1);
  assert.ok(harness.messages.some(item => item.type === 'ok'));
});

test('pengarsipan tanpa record terkonfirmasi tidak menampilkan sukses', async () => {
  for (const response of [null, { error: 'not archived' }, {}]) {
    const harness = createHarness(response);
    await harness.context.archiveMasterRecord(7);
    assert.equal(harness.renders(), 0);
    assert.ok(harness.messages.some(item => item.type === 'err' && /tidak mengonfirmasi/i.test(item.message)));
  }
});

test('pengarsipan dengan record terkonfirmasi menampilkan sukses dan memuat ulang', async () => {
  const harness = createHarness({ id: 7 });
  await harness.context.archiveMasterRecord(7);
  assert.equal(harness.renders(), 1);
  assert.ok(harness.messages.some(item => item.type === 'ok'));
});
