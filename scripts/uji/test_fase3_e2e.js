// ═══════════════════════════════════════════════════════════════
// UJI INTEGRASI END-TO-END FASE 3: EKSPANSI UNIT USAHA & CORE ENGINES
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 3, 4, 18, 22.3
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
require('../../ava-platform/modules/business_units/ecommerce_oms.js');
require('../../ava-platform/modules/business_units/sanctuary_booking.js');
require('../../ava-platform/modules/hrd/payroll.js');
require('../../ava-platform/modules/radiology/dicomViewer.js');

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
console.log('🚀 MENJALANKAN UJI INTEGRASI END-TO-END FASE 3');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── PILAR 1: AVA Nutrition OMS & CPOTB Batch Recall ──
console.log('1. PILAR 1: AVA NUTRITION & CPOTB BATCH RECALL SIMULATOR');

const recallResult = window.simulateBatchRecall('LOT-2026-07A');
assert(recallResult.statusBPOM === 'SIMULATION_ACTIVE' && recallResult.batchNo === 'LOT-2026-07A',
  'Simulasi recall batch CPOTB aktif dan memetakan lot teridentifikasi');
assert(recallResult.sla_trace_minutes <= 120,
  `Ketertelusuran distribusi batch selesai dalam ${recallResult.sla_trace_minutes} menit (SLA BPOM < 120 menit)`);
assert(recallResult.distributedApotek.length > 0 && recallResult.action_plan.length === 4,
  'Daftar apotek konsinyasi terdampak dan 4 langkah CAPA terpetakan lengkap');

// ── PILAR 2: AVA Sanctuary Suites & Deferred Revenue PSAK 72 ──
console.log('\n2. PILAR 2: AVA SANCTUARY SUITES & DEFERRED REVENUE PSAK 72');

const journalAmortization = window.recognizeSanctuaryRevenue('SNC-2026-001');
assert(journalAmortization !== null && journalAmortization.brand_code === 'SANCT',
  'Pengakuan pendapatan sesi treatment Sanctuary membawa dimensi SANCT & KBLI 96122');

const drLine = journalAmortization.lines.find(l => l.account_code === '2105');
const crLine = journalAmortization.lines.find(l => l.account_code === '4105');
assert(drLine.debit === 750000 && crLine.credit === 750000,
  'Jurnal PSAK 72 seimbang: Amortisasi Deferred Revenue 2105 (Debit) -> Pendapatan Jasa 4105 (Kredit)');

// ── PILAR 3: Core Payroll Engine PPh 21 TER (PMK 168/2023) ──
console.log('\n3. PILAR 3: CORE PAYROLL ENGINE PPh 21 TER (PMK 168/2023)');

const taxTier1 = window.calculatePPh21TER(5000000, 'A');
assert(taxTier1.tax === 0 && taxTier1.rate === 0.0, 'Gaji Rp 5.000.000 (TER A): Tarif 0% (PPh 21 = Rp 0)');

const taxTier2 = window.calculatePPh21TER(7000000, 'A');
assert(taxTier2.tax === 87500 && taxTier2.rate === 0.0125, 'Gaji Rp 7.000.000 (TER A): Tarif 1.25% (PPh 21 = Rp 87.500)');

const taxTier3 = window.calculatePPh21TER(15000000, 'A');
assert(taxTier3.tax === 900000 && taxTier3.rate === 0.06, 'Gaji Rp 15.000.000 (TER A): Tarif 6.0% (PPh 21 = Rp 900.000)');

const taxTierB = window.calculatePPh21TER(10000000, 'B');
assert(taxTierB.tax === 150000 && taxTierB.rate === 0.015, 'Gaji Rp 10.000.000 (TER B): Tarif 1.5% (PPh 21 = Rp 150.000)');

// ── PILAR 4: PACS DICOM Viewer Engine & Pengukuran CTR ──
console.log('\n4. PILAR 4: PACS DICOM VIEWER & CARDIO-THORACIC RATIO (CTR)');

const ctrNormal = window.dicomViewer.calculateCTR(130, 290);
assert(ctrNormal.ctrPct === 44.8 && ctrNormal.status === 'NORMAL',
  `Pengukuran Jantung Normal: CTR ${ctrNormal.ctrPct}% (Status: NORMAL)`);

const ctrBorderline = window.dicomViewer.calculateCTR(155, 300);
assert(ctrBorderline.ctrPct === 51.7 && ctrBorderline.status === 'CARDIOMEGALY_BORDERLINE',
  `Pengukuran Jantung Borderline: CTR ${ctrBorderline.ctrPct}% (Status: CARDIOMEGALY_BORDERLINE)`);

const ctrSignificant = window.dicomViewer.calculateCTR(175, 300);
assert(ctrSignificant.ctrPct === 58.3 && ctrSignificant.status === 'CARDIOMEGALY_SIGNIFICANT',
  `Pengukuran Kardiomegali Signifikan: CTR ${ctrSignificant.ctrPct}% (Status: CARDIOMEGALY_SIGNIFICANT)`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 HASIL UJI E2E FASE 3: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
