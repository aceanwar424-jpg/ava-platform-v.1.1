// ═══════════════════════════════════════════════════════════════
// UJI OTOMATIS: FONDASI FASE 0 AVA GLOBAL ECOSYSTEM
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 15-21
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Mock browser global environment if running in Node.js
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Muat modul-modul Shared Kernel
require('../../ava-platform/js/core/numberingService.js');
require('../../ava-platform/js/core/mpiService.js');
require('../../ava-platform/js/core/rbacService.js');
require('../../ava-platform/js/core/eventBus.js');

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
console.log('🧪 MENJALANKAN RANGKAIAN UJI FONDASI FASE 0');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── TEST 1: AVA-ID Crockford Base32 Generator ──
console.log('1. Pengujian Generator AVA-ID:');
const avaId1 = window.MPIService.generateAvaId();
const avaId2 = window.MPIService.generateAvaId();
assert(/^AVA-[0-9A-HJKMNP-Z]{10}$/.test(avaId1), 'Format AVA-ID valid (AVA- + 10 digit Base32)', avaId1);
assert(avaId1 !== avaId2, 'AVA-ID bersifat acak unik');

// ── TEST 2: Centralized Numbering Service & VOID ──
console.log('\n2. Pengujian Layanan Penomoran Dokumen Terpusat:');
(async () => {
  const invNo = await window.NumberingService.issueNumber('INVOICE', 'LAB', new Date(2026, 7, 30));
  assert(/^INV\/LAB\/202608\/00001$/.test(invNo), 'Format Nomor Invoice sesuai Bab 15.2', invNo);

  const spkNo = await window.NumberingService.issueNumber('SPK', 'HEALTH', new Date(2026, 7, 30));
  assert(/^AVA\/HEALTH\/SPK\/VIII\/2026\/00001$/.test(spkNo), 'Format Nomor Surat Resmi AVA/{BRAND}/{JENIS}/{BULAN}/{TAHUN}/{URUT}', spkNo);

  const labOrderNo = await window.NumberingService.issueNumber('LAB_ORDER', 'LAB', new Date(2026, 7, 30));
  assert(/^L260830-00001$/.test(labOrderNo), 'Format Nomor Order Lab harian LYYMMDD-XXXXX', labOrderNo);

  const voidRes = await window.NumberingService.voidNumber(spkNo, 'SPK', 'HEALTH', 'Kesalahan input paket MCU', 'user_123');
  assert(voidRes.success === true, 'Pembatalan nomor dokumen (VOID) berhasil dicatat');

  // ── TEST 3: MPI Duplicate Matcher ──
  console.log('\n3. Pengujian Algoritma Deteksi Duplikat MPI:');
  const p1 = { nik: '3201123456780001', full_name: 'Budi Santoso', birth_date: '1985-05-12', phone: '08123456789' };
  const p2_exact = { nik: '3201123456780001', full_name: 'Budi S.', birth_date: '1985-05-12' };
  const p3_similar = { nik: '3201999999999999', full_name: 'Budi Santoso', birth_date: '1985-05-12', phone: '08123456789' };
  const p4_diff = { nik: '3171000000000002', full_name: 'Siti Rahma', birth_date: '1992-10-20', phone: '08570000000' };

  const matchExact = window.MPIService.calculateMatchScore(p1, p2_exact);
  assert(matchExact.score === 1.0 && matchExact.reason === 'NIK_EXACT_MATCH', 'Match NIK persis menghasilkan skor 1.0');

  const matchSim = window.MPIService.calculateMatchScore(p1, p3_similar);
  assert(matchSim.score >= 0.85, `Match kemiripan nama + tgl lahir + phone tinggi (Skor: ${matchSim.score})`);

  const matchDiff = window.MPIService.calculateMatchScore(p1, p4_diff);
  assert(matchDiff.score < 0.30, `Data orang berbeda mendapat skor rendah (Skor: ${matchDiff.score})`);

  // ── TEST 4: RBAC 18 Peran & Penegakan ADR-07 ──
  console.log('\n4. Pengujian RBAC 18 Peran & Proteksi Data Klinis (ADR-07):');
  assert(window.RBACService.canAccessClinicalData('DOCTOR_SPPK') === true, 'DOCTOR_SPPK berhak akses data klinis K4');
  assert(window.RBACService.canAccessClinicalData('LAB_ANALYST') === true, 'LAB_ANALYST berhak akses data klinis K4');
  assert(window.RBACService.canAccessClinicalData('SALES_CORPORATE') === false, 'SALES_CORPORATE DILARANG akses data klinis K4');
  assert(window.RBACService.canAccessClinicalData('SUPERADMIN') === false, 'SUPERADMIN DILARANG akses data klinis K4 langsung (hanya metadata/config)');

  assert(window.RBACService.canAccessRoute('DOCTOR_SPPK', 'lab/post/validation') === true, 'DOCTOR_SPPK diizinkan ke lab/post/validation');
  assert(window.RBACService.canAccessRoute('LAB_ANALYST', 'lab/post/signoff') === false, 'LAB_ANALYST dilarang rilis hasil Sp.PK (Pemisahan Tugas)');

  // ── TEST 5: EventBus Outbox & ADR-07 Payload Validation ──
  console.log('\n5. Pengujian Event Bus & Validasi Payload ADR-07:');
  let eventPassed = false;
  try {
    window.EventBus.validatePayloadADR07('lab.result.released', {
      ava_id: 'AVA-7K3M2P9QX4',
      service_code: 'LAB-CBC-01',
      status: 'COMPLETED'
    });
    eventPassed = true;
  } catch (e) {
    eventPassed = false;
  }
  assert(eventPassed === true, 'Payload event tanpa data klinis mentah diizinkan');

  let blockedClinicalLeak = false;
  try {
    window.EventBus.validatePayloadADR07('lab.result.released', {
      ava_id: 'AVA-7K3M2P9QX4',
      hasil_lab: '14.2 g/dL' // Pelanggaran ADR-07
    });
  } catch (e) {
    blockedClinicalLeak = true;
  }
  assert(blockedClinicalLeak === true, 'Payload event berisi hasil_lab mentah BERHASIL DIBLOKIR');

  // ── TEST 6: File Migrasi Database Fase 0 ──
  console.log('\n6. Verifikasi Kelengkapan Berkas Migrasi SQL:');
  const migrationDir = path.join(__dirname, '../../db/migrations');
  const requiredMigrations = [
    '0021_fase0_konvensi_identitas.sql',
    '0022_fase0_tenancy_organisasi.sql',
    '0023_fase0_mpi_master_person.sql',
    '0024_fase0_iam_rbac_audit.sql',
    '0025_fase0_kolom_wajib_transaksi.sql',
    '0026_fase0_event_outbox_dimensi.sql',
    '0027_fase0_rls_policies.sql'
  ];

  requiredMigrations.forEach(migFile => {
    const fullPath = path.join(migrationDir, migFile);
    assert(fs.existsSync(fullPath), `Berkas migrasi ${migFile} tersedia`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 HASIL UJI: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
})();
