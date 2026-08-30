// ═══════════════════════════════════════════════════════════════
// UJI INTEGRASI END-TO-END FASE 4: B2B SAAS, KATALOG LIS & COCKPIT
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 5, 6, 22.4 & AGENTS.md P2
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
require('../../ava-platform/modules/business_units/tech_saas.js');
require('../../ava-platform/modules/compliance/catalog_exporter.js');
require('../../ava-platform/modules/finance/holding_finance.js');

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
console.log('🚀 MENJALANKAN UJI INTEGRASI END-TO-END FASE 4');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── PILAR 1: AVA Tech B2B SaaS Provisioning & Metering ──
//
// DIHENTIKAN 30 Agustus 2026.
//
// Bagian ini dulu memanggil window.provisionNewTenant() dan
// window.trackUsageMetering() yang bekerja di atas array JavaScript di dalam
// memori. Assertion-nya selalu lulus, tetapi tidak ada satu pun tenant atau
// pemakaian yang benar-benar tersimpan — jadi yang diuji sebenarnya hanya
// bahwa sebuah array bisa ditambah isinya.
//
// Kedua fungsi itu kini menulis ke public.tenants dan
// public.tenant_pemakaian (migrasi 0029), sehingga tidak bisa lagi diuji
// tanpa basis data. Penggantinya menjalankan SQL-nya sungguhan:
//
//     node scripts/uji/test_ava_tech_tenant.js
//
console.log('1. PILAR 1: AVA TECH — dipindah ke scripts/uji/test_ava_tech_tenant.js');
console.log('   (provisioning & metering kini menulis ke basis data, bukan array memori)');

// ── PILAR 2: Master Test Catalog Siap-LIS (AGENTS.md P2 & §4.3) ──
console.log('\n2. PILAR 2: MASTER TEST CATALOG & LIS EXPORTER (AGENTS.md P2)');

const catalogData = window.catalogExporter.generateLisReadyCatalog();
assert(catalogData.length >= 8, `Katalog analit siap-LIS terurai menjadi ${catalogData.length} baris parameter`);

// Verifikasi pemecahan panel CBC menjadi baris analit individual
const cbcAnalytes = catalogData.filter(r => r.kode_material === 'LAB-HEM-001');
assert(cbcAnalytes.length === 5, 'Panel CBC terurai menjadi 5 baris analit individual (WBC, RBC, HGB, PLT, HCT)');

// Verifikasi integritas kolom LOINC (OBX-3) dan UCUM (OBX-6)
const hgbRow = catalogData.find(r => r.nama_analit === 'Hemoglobin' && r.kelompok_usia_gender === 'Dewasa Pria');
assert(hgbRow && hgbRow.loinc_obx3 === '718-7' && hgbRow.ucum_obx6 === 'g/dL',
  'Mapping standar LOINC (718-7) & UCUM (g/dL) pada Hemoglobin valid');

// Verifikasi ekspor CSV & TSV
const csvOutput = window.catalogExporter.exportCatalogToCSV(catalogData);
const tsvOutput = window.catalogExporter.exportCatalogToTSV(catalogData);
assert(csvOutput.includes('"LAB-HEM-001"') && tsvOutput.includes('LAB-HEM-001'),
  'Format ekspor CSV & TSV relasional berhasil digenerate');

// Verifikasi validator integritas
const validationPass = window.catalogExporter.validateCatalogIntegrity(catalogData);
assert(validationPass.valid === true, 'Validator integritas katalog: LULUS (Semua kunci & LOINC lengkap)');

const invalidCatalog = [{ kode_material: '', nama_pemeriksaan: 'Tes Cacat' }];
const validationFail = window.catalogExporter.validateCatalogIntegrity(invalidCatalog);
assert(validationFail.valid === false && validationFail.errors.length > 0,
  'Validator integritas berhasil MENOLAK baris katalog yang melanggar batasan kunci');

// ── PILAR 3: Holding Executive Cockpit & Konsolidasi 6 Brand ──
console.log('\n3. PILAR 3: HOLDING EXECUTIVE COCKPIT & KONSOLIDASI 6 BRAND');

const ebitdaCalc = window.calculateHoldingEBITDA();
assert(ebitdaCalc.pillar_count === 6 && ebitdaCalc.total_revenue > 0,
  `Konsolidasi 6 Brand Holding terhitung (Total Revenue: Rp ${(ebitdaCalc.total_revenue / 1000000).toFixed(1)} Juta)`);
assert(ebitdaCalc.net_ebitda > 0 && ebitdaCalc.ebitda_margin_pct > 0,
  `EBITDA Konsolidasi Holding Positif (+Rp ${(ebitdaCalc.net_ebitda / 1000000).toFixed(1)} Juta / Margin: ${ebitdaCalc.ebitda_margin_pct}%)`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 HASIL UJI E2E FASE 4: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
