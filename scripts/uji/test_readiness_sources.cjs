'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const file = path.join(__dirname, '..', '..', 'ava-platform', 'modules', 'system', 'readiness.js');
const source = fs.readFileSync(file, 'utf8');
const expectedSourceCounts = {
  'his-integration': 1,
  'lis-integration': 1,
  'wellness-program': 1,
  'partner-rewards': 2,
  'nutrition-quality': 2,
  'sanctuary-operations': 2,
  'tech-delivery': 3,
  'evidence-register': 2,
};

function createHarness({ failTable, emptyTable } = {}) {
  const calls = [];
  const routes = [];
  const target = { innerHTML: '' };
  let buttons = null;
  const root = {
    isConnected: true,
    innerHTML: '',
    querySelectorAll() {
      if (buttons) return buttons;
      buttons = [...this.innerHTML.matchAll(/data-readiness-destination="(\d+)"/g)].map(([, index]) => ({
        dataset: { readinessDestination: index },
        addEventListener(event, callback) {
          assert.equal(event, 'click');
          this.click = callback;
        },
      }));
      return buttons;
    },
    querySelector(selector) {
      return selector === '#readiness-sources' ? target : null;
    },
  };
  const context = {
    document: { getElementById: id => id === 'main-content' ? root : null },
    sbGetStrict: async (table, query) => {
      calls.push({ table, query });
      if (table === failTable) throw new Error('synthetic source unavailable');
      if (table === emptyTable) return [];
      if (table === 'spa_okupansi_ruangan') return [{ id: 1, status: 'Aktif', sesi_hari_ini: 2 }];
      return [{ id: 1, status: 'OPEN' }, { id: 2, status: 'CLOSED' }];
    },
    sbRpc: async name => {
      calls.push({ rpc: name });
      return { programs: [{ enrolled: 3, observations: 5, open_tasks: 1 }] };
    },
    navigate: (...args) => routes.push(args),
    console,
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: file });
  return { context, calls, routes, root, target };
}

(async () => {
  for (const [panel, sourceCount] of Object.entries(expectedSourceCounts)) {
    const harness = createHarness();
    await harness.context.renderReadiness({ panel });
    assert.equal(harness.calls.length, sourceCount, `${panel} should query each configured source`);
    assert.match(harness.root.innerHTML, /Belum diverifikasi dari sumber end-to-end/);
    assert.match(harness.target.innerHTML, /record terjangkau/);
    assert.doesNotMatch(harness.target.innerHTML, /synthetic source unavailable/);
    const routeButton = harness.root.querySelectorAll('[data-readiness-destination]')[0];
    routeButton.click();
    assert.ok(harness.routes.length > 0, `${panel} should navigate to a source module`);
  }

  const failed = createHarness({ failTable: 'permits' });
  await failed.context.renderReadiness({ panel: 'evidence-register' });
  assert.match(failed.target.innerHTML, /Tidak dapat dibaca/);
  assert.match(failed.target.innerHTML, /synthetic source unavailable/);
  assert.match(failed.target.innerHTML, /Kredensial tenaga/);
  assert.doesNotMatch(failed.target.innerHTML, /NaN/);

  const empty = createHarness({ emptyTable: 'permits' });
  await empty.context.renderReadiness({ panel: 'evidence-register' });
  assert.match(empty.target.innerHTML, /<b>0<\/b> record terjangkau/);

  const sanctuary = createHarness();
  await sanctuary.context.renderReadiness({ panel: 'sanctuary-operations' });
  sanctuary.root.querySelectorAll('[data-readiness-destination]')[1].click();
  assert.equal(sanctuary.routes[0][0], 'sanctuary-booking');
  assert.equal(sanctuary.routes[0][1].tab, 'rooms');

  const invalid = createHarness();
  await invalid.context.renderReadiness({ panel: 'unknown-panel' });
  assert.match(invalid.root.innerHTML, /Panel readiness tidak dikenal/);
  assert.equal(invalid.calls.length, 0);

  process.stdout.write('PASS: all 8 readiness panels query sources, show failures, and retain honest workflow status.\n');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
