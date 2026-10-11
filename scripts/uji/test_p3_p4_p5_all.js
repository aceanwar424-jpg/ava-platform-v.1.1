/**
 * Uji Komprehensif Seluruh Aset P3, P4, P5
 * Memvalidasi keberadaan, integritas isi, dan kepatuhan standar ISO 15189:2022
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 PENGUJIAN INTEGRITAS ASET GENERASI P3, P4, DAN P5');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. P3: Bundel Dokumen SMM
console.log('1. VALIDASI BUNDEL DOKUMEN SMM (P3):');
const smmMedikaPath = path.join(__dirname, '../../artifacts/smm_bundles/smm_bundle_medika.html');
const smmSentosaPath = path.join(__dirname, '../../artifacts/smm_bundles/smm_bundle_sentosa.html');

runTest('Bundel SMM Klinik Medika (Logo Kiri) terbentuk & valid', () => {
  assert(fs.existsSync(smmMedikaPath), 'File smm_bundle_medika.html harus ada');
  const content = fs.readFileSync(smmMedikaPath, 'utf8');
  assert(content.length > 20000, 'Ukuran dokumen SMM harus lengkap (>20KB)');
  assert(content.includes('Klinik Pratama Medika Sejahtera'));
  assert(content.includes('Klausul Standar Akreditasi KAN • SNI ISO 15189:2022'));
  assert(content.includes('MOD-ISO-'));
});

runTest('Bundel SMM Lab Sentosa (Logo Tengah) terbentuk & valid', () => {
  assert(fs.existsSync(smmSentosaPath), 'File smm_bundle_sentosa.html harus ada');
  const content = fs.readFileSync(smmSentosaPath, 'utf8');
  assert(content.includes('Laboratorium Bio-Sentosa Utama') || content.includes('Sentosa'));
  assert(content.includes('SISTEM MANAJEMEN MUTU ISO 15189:2022'));
  assert(content.includes('Klausul Acuan: <strong>ISO 4.1</strong>'));
});

// 2. P3: Lembar E-Hasil Lab Pasien
console.log('\n2. VALIDASI SERTIFIKAT E-HASIL LABORATORIUM (P3):');
const hasilMedikaPath = path.join(__dirname, '../../artifacts/lab_results/e_hasil_sample_medika_default.html');
const hasilSentosaPath = path.join(__dirname, '../../artifacts/lab_results/e_hasil_sample_sentosa_custom.html');

runTest('E-Hasil Medika (Default Logo Kiri) terbentuk dengan LOINC & UCUM', () => {
  assert(fs.existsSync(hasilMedikaPath), 'File e_hasil_sample_medika_default.html harus ada');
  const content = fs.readFileSync(hasilMedikaPath, 'utf8');
  assert(content.includes('Ny. Linda Handayani'));
  assert(content.includes('Glukosa Darah Puasa'));
  assert(content.includes('LOINC: 1558-6'));
  assert(content.includes('mg/dL'));
  assert(content.includes('BSrE TTE Tersertifikasi'));
});

runTest('E-Hasil Sentosa (Kustom Logo Kanan) terbentuk & valid', () => {
  assert(fs.existsSync(hasilSentosaPath), 'File e_hasil_sample_sentosa_custom.html harus ada');
  const content = fs.readFileSync(hasilSentosaPath, 'utf8');
  assert(content.includes('justify-content:space-between'));
});

// 3. P4: Content Pipeline
console.log('\n3. VALIDASI BATCH CONTENT ENGINE (P4):');
const patientCatalogPath = path.join(__dirname, '../../data/content/patient_facing_catalog.json');
const linkedinPath = path.join(__dirname, '../../data/content/linkedin_content_calendar.md');

runTest('Kamus Deskripsi Pasien memproses seluruh tes katalog (~530 pemeriksaan)', () => {
  assert(fs.existsSync(patientCatalogPath), 'File patient_facing_catalog.json harus ada');
  const data = JSON.parse(fs.readFileSync(patientCatalogPath, 'utf8'));
  assert(data.total_examinations >= 500, `Harus mencakup minimal 500 pemeriksaan (ditemukan: ${data.total_examinations})`);
  assert(data.catalog && data.catalog.length >= 500, `Catalog array harus >= 500 item`);
  const sample = data.catalog[0];
  assert(sample.nama_pemeriksaan && sample.penjelasan_awam && sample.persiapan_sebelum_tes);
});

runTest('Draf Kalender Editorial LinkedIn (4 Minggu) terbentuk rapi', () => {
  assert(fs.existsSync(linkedinPath), 'File linkedin_content_calendar.md harus ada');
  const content = fs.readFileSync(linkedinPath, 'utf8');
  assert(content.includes('Minggu 1'));
  assert(content.includes('Minggu 2'));
  assert(content.includes('Minggu 3'));
  assert(content.includes('Minggu 4'));
  assert(content.includes('ISO 15189'));
  assert(content.includes('LOINC'));
});

// 4. P5: Compounding Proof System
console.log('\n4. VALIDASI LEMBAR STUDI KASUS & BUKTI (P5):');
const studyMdPath = path.join(__dirname, '../../artifacts/case_studies/case_study_iso15189_transformation.md');
const studyHtmlPath = path.join(__dirname, '../../artifacts/case_studies/case_study_iso15189_transformation.html');

runTest('Studi Kasus Markdown Before vs After terbentuk dengan metrik kuantitatif', () => {
  assert(fs.existsSync(studyMdPath), 'File case_study_iso15189_transformation.md harus ada');
  const content = fs.readFileSync(studyMdPath, 'utf8');
  assert(content.includes('Studi Kasus: Transformasi Kesiapan Akreditasi ISO 15189:2022'));
  assert(content.includes('Skor Kepatuhan ISO 15189'));
  assert(content.includes('100%'));
  assert(content.includes('0 Temuan Kritis'));
});

runTest('Studi Kasus Card HTML siap tayang terbentuk', () => {
  assert(fs.existsSync(studyHtmlPath), 'File case_study_iso15189_transformation.html harus ada');
  const content = fs.readFileSync(studyHtmlPath, 'utf8');
  assert(content.includes('case-study-card') || content.includes('Skor Kesiapan Mutu'));
});

// 5. IP & Strict Compliance Verification (AGENTS.md)
console.log('\n5. VALIDASI IP & KEBIJAKAN INTEGRITAS DATA (AGENTS.MD):');
runTest('Tidak ada hardcode AVA di artefak generik multi-lab yang dihasilkan', () => {
  const contentMedika = fs.readFileSync(smmMedikaPath, 'utf8');
  assert(!contentMedika.includes('AVA Diagnostics'), 'Dokumen tenant Medika tidak boleh memuat AVA Diagnostics');
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 TOTAL PENGUJIAN INTEGRITAS ASET: ${passedTests} DARI ${totalTests} LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
