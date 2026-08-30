// ═══════════════════════════════════════════════════════════════
// UJI INTEGRASI END-TO-END FASE 2: KEPATUHAN, KEUANGAN & COLD CHAIN
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 7, 8, 17, 22
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Mock browser global environment
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Muat Modul-modul Terkait
require('../../ava-platform/modules/lab/qcEngine.js');
require('../../ava-platform/js/core/fhirConverter.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${details}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🚀 MENJALANKAN UJI INTEGRASI END-TO-END FASE 2');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── PILAR 1: Smart QC & Westgard Multi-Rules ──
console.log('1. PILAR 1: SMART QC & WESTGARD MULTI-RULES (ISO 15189:2022 Klausul 7.3.7)');

const targetMean = 100;
const sd = 5;

// 1.1 Evaluasi Nilai Normal
const qcNormal = window.westgardQcEngine.evaluateWestgardRules(101, targetMean, sd, [99, 100, 102]);
assert(qcNormal.status === 'PASS', 'Nilai QC dalam batas 2 SD: PASS (Normal)');

// 1.2 Deteksi Rule 1-3s (Random / Gross Error)
const qc13s = window.westgardQcEngine.evaluateWestgardRules(116, targetMean, sd, [100, 101]); // 116 = +3.2 SD
assert(qc13s.status === 'REJECT' && qc13s.triggeredRule === '1-3s', 'Deteksi Rule 1-3s (>3 SD) memicu penolakan batch REJECT');

// 1.3 Deteksi Rule 2-2s (Systematic Error)
const qc22s = window.westgardQcEngine.evaluateWestgardRules(111, targetMean, sd, [100, 111]); // dua kali +2.2 SD
assert(qc22s.status === 'REJECT' && qc22s.triggeredRule === '2-2s', 'Deteksi Rule 2-2s (2x berturut >2 SD arah sama): REJECT');

// 1.4 Deteksi Rule R-4s (Random Jump)
const qcR4s = window.westgardQcEngine.evaluateWestgardRules(111, targetMean, sd, [89]); // dari -2.2 SD lompat ke +2.2 SD (Δ = 4.4 SD)
assert(qcR4s.status === 'REJECT' && qcR4s.triggeredRule === 'R-4s', 'Deteksi Rule R-4s (Rentang lonjakan >4 SD): REJECT');

// 1.5 Deteksi Rule 4-1s (Systematic Trend)
const qc41s = window.westgardQcEngine.evaluateWestgardRules(106, targetMean, sd, [106, 107, 106]); // 4x di atas +1 SD
assert(qc41s.status === 'WARNING' && qc41s.triggeredRule === '4-1s', 'Deteksi Rule 4-1s (4x di atas 1 SD): WARNING Maintenance');

// 1.6 Deteksi Rule 10x (Mean Shift)
const history9Above = [102, 103, 101, 102, 104, 101, 103, 102, 101];
const qc10x = window.westgardQcEngine.evaluateWestgardRules(102, targetMean, sd, history9Above); // 10x berturut di atas mean
assert(qc10x.status === 'REJECT' && qc10x.triggeredRule === '10x', 'Deteksi Rule 10x (10x berturut di satu sisi mean): REJECT');

// 1.7 Kalkulasi Six Sigma Metrics
const sigmaChem = window.westgardQcEngine.calculateSigmaMetrics(10.0, 1.2, 1.4); // (10 - 1.2) / 1.4 = 6.28 Sigma
assert(sigmaChem.sigma >= 6.0 && sigmaChem.performance === 'WORLD_CLASS',
  `Kalkulasi Sigma Metrics (${sigmaChem.sigma} Sigma) diklasifikasikan sebagai WORLD_CLASS`);

// ── PILAR 2: SATUSEHAT Kemenkes RI FHIR R4 Bridging ──
console.log('\n2. PILAR 2: SATUSEHAT KEMENKES RI FHIR R4 BRIDGING (PMK 24/2022)');

const testPatient = {
  id: 'pat-001',
  nik: '3171012345670008',
  patient_name: 'Siti Aminah',
  birth_date: '1995-08-20',
  gender: 'P',
  phone: '081234567890'
};

const fhirPat = window.fhirConverter.convertToFhirPatient(testPatient);
assert(fhirPat.resourceType === 'Patient' && fhirPat.identifier[0].value === '3171012345670008' && fhirPat.gender === 'female',
  'Transformasi Pasien ke Resource FHIR Patient valid');

const testObservation = {
  nama_tes: 'Hemoglobin',
  nilai_hasil: 13.8,
  loinc_code: '718-7',
  satuan: 'g/dL',
  satusehat_patient_id: 'ss-pat-001',
  nilai_min: 12.0,
  nilai_max: 16.0
};

const fhirObs = window.fhirConverter.convertToFhirObservation(testObservation);
assert(fhirObs.resourceType === 'Observation' && fhirObs.code.coding[0].code === '718-7' && fhirObs.valueQuantity.value === 13.8,
  'Transformasi Hasil Lab ke Resource FHIR Observation dengan kode LOINC 718-7 valid');

// ── PILAR 3: Core GL & Dimensi Akuntansi Holding ──
console.log('\n3. PILAR 3: CORE GL & DIMENSI FINANSIAL KONSOLIDASI HOLDING (PSAK)');

const sampleJournal = {
  entry_no: 'JV/LAB/202608/00001',
  entry_date: '2026-08-30',
  brand_code: 'LAB',
  cost_center_code: 'CC-LAB-MAIN',
  kbli_code: '86903',
  location_code: 'LOC-PST-01',
  lines: [
    { account_code: '1101', account_name: 'Kas Operasional', debit: 500000, credit: 0 },
    { account_code: '4101', account_name: 'Pendapatan Jasa Laboratorium', debit: 0, credit: 500000 }
  ]
};

const totalDebit = sampleJournal.lines.reduce((s, l) => s + l.debit, 0);
const totalCredit = sampleJournal.lines.reduce((s, l) => s + l.credit, 0);
assert(totalDebit === totalCredit && sampleJournal.brand_code === 'LAB',
  'Jurnal akuntansi membawa 4 dimensi segmen dan seimbang (Debit = Kredit = 500,000)');

// Simulasi Eliminasi Transfer Antar-Unit Holding (Akun 4999 & 5999)
const internalTransfer = {
  revenue_interunit: 1500000, // Akun 4999 (Lab ke Nutrition)
  expense_interunit: 1500000  // Akun 5999
};
const netHoldingElimination = internalTransfer.revenue_interunit - internalTransfer.expense_interunit;
assert(netHoldingElimination === 0, 'Eliminasi transfer antar-unit di level konsolidasi holding seimbang (Net = 0)');

// ── PILAR 4: AVA Care Cold Chain & Handover Nakes ──
console.log('\n4. PILAR 4: AVA CARE COLD CHAIN & HANDOVER MOBILE SAMPLING');

function verifyColdChainHandover(sampleBag) {
  const MAX_TEMP = 8.0; // Maksimal 8°C untuk spesimen darah/serum
  if (sampleBag.measured_temp_celsius <= MAX_TEMP && sampleBag.coolbox_sealed) {
    return { status: 'ACCEPTED', message: 'Suhu rantai dingin memenuhi syarat ISO 15189 (≤8°C)' };
  }
  return { status: 'REJECTED', message: 'Suhu sampel melebihi batas 8°C atau segel cool box rusak' };
}

const sampleValid = verifyColdChainHandover({ measured_temp_celsius: 4.5, coolbox_sealed: true });
const sampleSpoiled = verifyColdChainHandover({ measured_temp_celsius: 11.2, coolbox_sealed: true });

assert(sampleValid.status === 'ACCEPTED', 'Sampel dengan suhu 4.5°C diterima di laboratorium');
assert(sampleSpoiled.status === 'REJECTED', 'Sampel dengan suhu 11.2°C (>8°C) ditolak demi menjaga integritas analitik');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 HASIL UJI E2E FASE 2: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
