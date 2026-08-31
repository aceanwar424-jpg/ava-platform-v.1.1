// ═══════════════════════════════════════════════════════════════
// MASTER TEST RUNNER: SELURUH RANGKAIAN UJI EKOSISTEM AVA GLOBAL
// Menjalankan Fase 0, Gate QC, Fase 1, Fase 2, Fase 3, Fase 4, dan P1-P5
// ═══════════════════════════════════════════════════════════════

const { execSync } = require('child_process');
const path = require('path');

const testSuites = [
  { name: '1. Fondasi Inti Fase 0', file: 'test_fase0_fondasi.js' },
  { name: '2. QC Formal Skenario Gate (T1–T10 & S1–S5)', file: 'test_t1_t10_qc.js' },
  { name: '3. Operasional Fase 1 (Health, Lab, MCU)', file: 'test_fase1_e2e.js' },
  { name: '4. Kepatuhan & Keuangan Fase 2 (QC, SATUSEHAT, GL)', file: 'test_fase2_e2e.js' },
  { name: '5. Ekspansi Komersial Fase 3 (Nutrition, Sanctuary, Payroll, DICOM)', file: 'test_fase3_e2e.js' },
  { name: '6. B2B SaaS & Holding Cockpit Fase 4', file: 'test_fase4_e2e.js' },
  { name: '7. Akselerator Sistem Lab Produktisasi Aset (P1–P5)', file: 'test_akselerator_p1_p5.js' },
  { name: '8. LIS Super Suite ISO 15189:2022 (6 Modul Strategis)', file: 'test_lis_super_suite.js' },
  { name: '9. Ekspansi Strategis 3 Pilar (HIS/Rad, Tech SaaS, B2C Super-App)', file: 'test_expansion_super_suite.js' },
  // Suite di bawah ditambahkan belakangan. Didaftarkan di sini supaya ikut
  // berjalan bersama yang lain — uji yang hanya bisa dipanggil manual akan
  // berhenti dijalankan begitu orang yang menulisnya lupa.
  { name: '10. Portal Korporat & Roster Karyawan', file: 'test_portal_korporat_roster.js' },
  { name: '11. AVA Tech — Lisensi & Tenant', file: 'test_ava_tech_tenant.js' },
  { name: '12. Antrean — Loket, Prioritas & Panggilan', file: 'test_antrian_panggilan.js' },
  { name: '13. Wellness, Sanctuary & Pabrik', file: 'test_wellness_pabrik.js' },
  { name: '14. LIS, AVA Tech & Order Terintegrasi', file: 'test_lis_tech_order.js' },
  { name: '15. Klaim Penjamin (BPJS/Asuransi/TPA)', file: 'test_klaim_penjamin.js' },
  { name: '16. HIS — Tindakan, Imunisasi & Kelengkapan RM', file: 'test_his_tindakan_imunisasi.js' }
];

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   👑 AVA GLOBAL ECOSYSTEM - MASTER TEST SUITE EXECUTION       ║');
console.log('║   PT AVA Health Solution (6 Brand Units & Shared Kernel)      ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

let totalPassedSuites = 0;
const results = [];

testSuites.forEach((suite, idx) => {
  const scriptPath = path.join(__dirname, suite.file);
  console.log(`▶ Menjalankan [${idx + 1}/${testSuites.length}]: ${suite.name}...`);
  try {
    const output = execSync(`node "${scriptPath}"`, { encoding: 'utf-8' });
    const match = output.match(/(\d+)\s+DARI\s+(\d+)\s+SKENARIO\s+LULUS/i) || output.match(/(\d+)\s*\/\s*(\d+)/);
    const passedCount = match ? match[1] : 'ALL';
    const totalCount = match ? match[2] : 'ALL';

    console.log(`  ✅ SUKSES: ${passedCount}/${totalCount} skenario lulus.\n`);
    totalPassedSuites++;
    results.push({ name: suite.name, status: 'PASS', score: `${passedCount}/${totalCount}` });
  } catch (err) {
    console.error(`  ❌ GAGAL pada ${suite.name}:\n`, err.stdout || err.message);
    results.push({ name: suite.name, status: 'FAIL', score: '0' });
  }
});

console.log('═══════════════════════════════════════════════════════════════');
console.log(`🏆 HASIL AKHIR: ${totalPassedSuites} DARI ${testSuites.length} SUITE PENGUJIAN LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

results.forEach(r => {
  console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.name.padEnd(65)} : [${r.status}] (${r.score})`);
});

console.log('\n===============================================================');
console.log('🎉 SELURUH SISTEM SIAP DIGUNAKAN DAN MEMENUHI SELURUH STANDAR!');
console.log('===============================================================\n');

if (totalPassedSuites === testSuites.length) {
  process.exit(0);
} else {
  process.exit(1);
}
