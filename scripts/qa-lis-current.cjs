// Current LIS contract gate. Uses synthetic fixtures only; it must not connect to a database.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = 'ava-platform/modules/lab';
function load(file, extra = {}) {
  const context = {
    window: {},
    console,
    document: { getElementById: () => ({ innerHTML: '', style: {} }) },
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(`${root}/${file}`, 'utf8'), context, { filename: file });
  return context;
}

function check(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const tatOutput = { innerHTML: '' };
const tat = load('tat.js', { document: { getElementById: () => tatOutput } });
vm.runInContext("tatData={n_total:0,n_tuntas:0,total_median:null,total_p90:null,tahap:[]};tatGambar()", tat);
check('TAT kosong memakai empty-state jujur', () => {
  assert.equal(tatOutput.innerHTML.includes('45 mnt'), false);
  assert.equal(tatOutput.innerHTML.includes('—'), true);
});

const qc = require('../ava-platform/modules/lab/qcEngine.js');
check('QC non-numeric ditolak', () => assert.equal(qc.evaluateWestgardRules('not-a-number', 100, 1, []).status, 'INVALID'));

const analyzer = load('analyzerInterfacing.js');
check('Frame ASTM kosong ditolak', () => assert.equal(analyzer.parseAstmResultFrame('').success, false));
check('Frame ASTM sintetis valid diterima', () => {
  const result = analyzer.parseAstmResultFrame('H|\\^&\nO|1|SYNTHETIC-001\nR|1|^^^GLU|95|mg/dL|70-110|N||F\nL|1|N');
  assert.equal(result.success, true);
  assert.equal(result.accession_no, 'SYNTHETIC-001');
  assert.equal(result.results.length, 1);
});

const archive = load('sampleArchiving.js');
check('Barcode arsip tidak dikenal tidak mengarang lokasi', () => {
  const result = archive.findArchivedSpecimen('UNKNOWN-SYNTHETIC');
  assert.equal(result.found, false);
  assert.equal(result.entry, null);
  assert.equal(result.location_summary, null);
});

const autoverify = load('autoverify.js', { isCriticalResult: () => false });
check('Autoverifikasi memakai range normal_min/normal_max', () => {
  const inRange = autoverify.autoverifyCheck({ status: 'Draft', result_numeric: 95, result_value: '95', normal_min: 70, normal_max: 110, is_critical: false }, {
    is_active: true, require_in_range: true, require_not_critical: true,
  });
  const outRange = autoverify.autoverifyCheck({ status: 'Draft', result_numeric: 150, result_value: '150', normal_min: 70, normal_max: 110, is_critical: false }, {
    is_active: true, require_in_range: true, require_not_critical: true,
  });
  assert.equal(inRange.pass, true);
  assert.equal(outRange.pass, false);
});

console.log('LIS CURRENT CONTRACT: PASS (6 checks, synthetic fixtures only)');
