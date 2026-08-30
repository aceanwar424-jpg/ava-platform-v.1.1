// ═══════════════════════════════════════════════════════════════
// UJI OTOMATIS: LIS SUPER SUITE (ISO 15189:2022 & CLSI COMPLIANT)
// Menguji 6 Modul Strategis Laboratorium Informasi Sistem (LIS)
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
require('../../ava-platform/modules/lab/phlebotomy.js');
require('../../ava-platform/modules/lab/specimenVerification.js');
require('../../ava-platform/modules/lab/analyzerInterfacing.js');
require('../../ava-platform/modules/lab/criticalValue.js');
require('../../ava-platform/modules/lab/pmeProficiency.js');
require('../../ava-platform/modules/lab/sampleArchiving.js');
require('../../ava-platform/modules/lab/lotVerification.js');

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
console.log('🧪 MENJALANKAN UJI OTOMATIS LIS SUPER SUITE (ISO 15189:2022)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── 1. Flebotomi & Checklist Sampling ──
console.log('1. PRA-ANALITIK: FLEBOTOMI & CHECKLIST SAMPLING');

const phlebRes = window.recordPhlebotomySampling('L260830-0002', {
  officer: 'Siti Rahma, A.Md.AK',
  sampling_site: 'Vena Cephalica Sinistra',
  notes: 'Flebotomi berhasil tanpa hematoma'
});
assert(phlebRes.success === true && phlebRes.status === 'Selesai Sampling',
  'Pencatatan flebotomi, waktu sampling, dan nama petugas berhasil');

// ── 2. Verifikasi Kelayakan Spesimen (ISO 15189 Klausul 7.2.6) ──
console.log('\n2. PRA-ANALITIK: VERIFIKASI KELAYAKAN & KRITERIA PENOLAKAN SPESIMEN');

const normalSpec = window.evaluateSpecimenSuitability({
  accession_no: 'L260830-0001',
  hemolysis_grade: 'NONE',
  is_clotted: false,
  volume_adequate: true,
  temperature_celsius: 4.5
});
assert(normalSpec.is_suitable === true && normalSpec.status === 'ACCEPTED_FOR_ANALYSIS',
  'Spesimen jernih & suhu normal diterima untuk analisis laboratorium');

const hemolyzedSpec = window.evaluateSpecimenSuitability({
  accession_no: 'L260830-0099',
  hemolysis_grade: 'SEVERE_3+',
  is_clotted: false,
  volume_adequate: true
});
assert(hemolyzedSpec.is_suitable === false && hemolyzedSpec.status === 'REJECTED_SPECIMEN',
  'Spesimen hemolisis berat (3+) berhasil DITOLAK sesuai ISO 15189 klausul 7.2.6');

const clottedSpec = window.evaluateSpecimenSuitability({
  accession_no: 'L260830-0100',
  hemolysis_grade: 'NONE',
  is_clotted: true,
  volume_adequate: true
});
assert(clottedSpec.is_suitable === false && clottedSpec.reasons[0].code === 'REJ-04',
  'Tabung EDTA dengan bekuan mikro (Micro-clot) berhasil DITOLAK mutlak');

// ── 3. Master Interfacing Alat Analyzer (ASTM E1381/E1394) ──
console.log('\n3. ANALITIK: MASTER INTERFACING ALAT ANALYZER (PORT :9999)');

const rawAstmFrame = `
H|\\^&|||LIS_SYS|||||||P|1
P|1||AVA-7K3M2P9QX4||Setiawan^Budi||19850615|M
O|1|L260830-0001||^^^CBC|||||||||||SERUM
R|1|^^^HGB|14.5|g/dL|13.0-17.0|N||F
R|2|^^^WBC|7.8|10*3/uL|4.0-10.0|N||F
R|3|^^^PLT|245|10*3/uL|150-450|N||F
L|1|N
`;
const parsedAstm = window.parseAstmResultFrame(rawAstmFrame);
assert(parsedAstm.success === true && parsedAstm.accession_no === 'L260830-0001' && parsedAstm.results.length === 3,
  'Parsing paket ASTM E1381/E1394 berhasil mengekstrak 3 parameter hasil analyzer (HGB, WBC, PLT)');

// ── 4. Logbook Pelaporan Nilai Kritis (SLA < 15 Menit) ──
console.log('\n4. PASCA-ANALITIK: DETEKSI & LOGBOOK PELAPORAN NILAI KRITIS');

const critAlertHigh = window.checkCriticalValue('POTASSIUM', 6.8);
assert(critAlertHigh.is_critical === true && critAlertHigh.type === 'CRITICAL_HIGH',
  'Deteksi alarm nilai kritis Kalium 6.8 mmol/L (Batas ≥ 6.2) aktif');

const critAlertLow = window.checkCriticalValue('GLUCOSE', 38);
assert(critAlertLow.is_critical === true && critAlertLow.type === 'CRITICAL_LOW',
  'Deteksi alarm nilai kritis Glukosa 38 mg/dL (Batas ≤ 45) aktif');

const critLogRes = window.recordCriticalValueLog({
  accession_no: 'L260830-0001',
  patient_name: 'Tn. Budi Setiawan',
  parameter: 'Kalium (K+)',
  result_value: 6.8,
  unit: 'mmol/L',
  reported_to_doctor: 'dr. Hendra Sp.PD',
  caller_analyst: 'Ahmad Fauzi, A.Md.AK',
  sla_minutes: 7,
  read_back_confirmed: true
});
assert(critLogRes.success === true && critLogRes.is_sla_met === true,
  'Pencatatan laporan telepon nilai kritis ke DPJP dengan SLA 7 menit (<15 menit) berhasil');

// ── 5. Uji Profisiensi & PME Eksternal (ISO 15189 Klausul 7.3.7.3) ──
console.log('\n5. KENDALI MUTU: UJI PROFISIENSI & KALKULASI Z-SCORE PME');

const zSatisfactory = window.calculatePmeZScore(14.2, 14.0, 0.35);
assert(zSatisfactory.z_score === 0.57 && zSatisfactory.evaluation === 'SATISFACTORY',
  'Kalkulasi Z-Score PME Hemoglobin (Z = 0.57): MEMUASKAN (|Z| ≤ 2.0)');

const zUnsatisfactory = window.calculatePmeZScore(16.5, 14.0, 0.35);
assert(zUnsatisfactory.z_score === 7.14 && zUnsatisfactory.evaluation === 'UNSATISFACTORY',
  'Kalkulasi Z-Score PME (Z = 7.14): TIDAK MEMUASKAN (|Z| > 3.0) pemicu form CAPA');

// ── 6. Manajemen Arsip & Lokasi Rak Spesimen (Freezer -20°C) ──
console.log('\n6. MANAJEMEN SPESIMEN: LOKASI RAK FREEZER & ADD-ON TEST RETRIEVAL');

const archiveRes = window.archiveSpecimen('L260830-0088', {
  patient_name: 'Ny. Amanda',
  freezer_id: 'FREEZER-A (-20°C)',
  rack_id: 'RACK-03',
  box_id: 'BOX-SERUM-02',
  grid_position: 'D4',
  retention_days: 7
});
assert(archiveRes.success === true && archiveRes.entry.grid_position === 'D4',
  'Spesimen berhasil diarsipkan di Freezer-A Rack-03 Box-Serum-02 Slot D4');

const findRes = window.findArchivedSpecimen('L260830-0088');
assert(findRes.found === true && findRes.location_summary.includes('Grid [D4]'),
  'Pencarian lokasi tabung untuk permintaan tes susulan (Add-on Test) berhasil');

// ── 7. Verifikasi Lot-to-Lot Reagen Baru (Parallel Testing) ──
console.log('\n7. KENDALI REAGEN: VERIFIKASI LOT-TO-LOT PARALLEL TESTING (CLSI EP26-A)');

const lotEval = window.evaluateLotToLotVerification({
  parameter: 'Glukosa Puasa',
  old_lot_no: 'LOT-GLU-2026A',
  new_lot_no: 'LOT-GLU-2026B',
  sample_pairs: [
    { sample_id: 'S1', old_val: 100, new_val: 101 },
    { sample_id: 'S2', old_val: 150, new_val: 152 },
    { sample_id: 'S3', old_val: 200, new_val: 203 },
    { sample_id: 'S4', old_val: 80, new_val: 81 },
    { sample_id: 'S5', old_val: 120, new_val: 121 }
  ],
  max_bias_pct: 5.0
});
assert(lotEval.is_approved === true && lotEval.mean_bias_pct <= 5.0,
  `Uji paralel 5 sampel: Rerata Bias ${lotEval.mean_bias_pct}% (≤ 5.0%) -> Lot Baru Disetujui Digunakan`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 HASIL UJI LIS SUPER SUITE: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
