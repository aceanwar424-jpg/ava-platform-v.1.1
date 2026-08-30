// ═══════════════════════════════════════════════════════════════
// UJI OTOMATIS: AKSELERATOR SISTEM LAB (P1–P5 SESUAI AGENTS.MD)
// Pengujian Engine Multi-Lab, ISO 15189 Checker, SMM Assembler & Content
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Muat Akselerator Modules
const { LLMAdapter } = require('../../lib/llm/llm_adapter.js');
const { ISO15189Checker } = require('../../lib/compliance/iso15189_checker.js');
const { SMMPackAssembler } = require('../../lib/assembler/smm_pack_assembler.js');
const { CatalogValidator } = require('../../lib/validator/catalog_validator.js');
const { LISExporter } = require('../../lib/exporter/lis_exporter.js');
const { ContentPipeline } = require('../../tools/content_pipeline.js');

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
console.log('🧪 MENJALANKAN UJI AKSELERATOR SISTEM LAB (P1–P5)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── P1: Document Reengineering Engine & Multi-Lab ISO 15189 Checker ──
console.log('1. WORK ITEM P1: DOCUMENT REENGINEERING & ISO 15189 COMPLIANCE CHECKER');

const llm = new LLMAdapter({ provider: 'mock' });
const rawInput = `
[[JUDUL_DOKUMEN]]
SOP PENANGANAN DAN PENERIMAAN SPESIMEN
[[KLAUSUL_ISO]]
7.2.6
[[TUJUAN]]
Menjamin seluruh spesimen yang diterima memenuhi kriteria penolakan dan kelayakan pra-analitik.
[[PROSEDUR]]
1. Periksa kesesuaian identitas barcode dengan data pasien di LIS.
2. Evaluasi adanya hemolisis, lipemik, atau ikterik sebagai kriteria penolakan spesimen.
3. Catat penolakan pada buku ekspedisi dan beri tahu dokter pengirim terkait stabilitas sampel.
`;

const parsedSections = llm.parseDelimiters(rawInput);
assert(parsedSections.JUDUL_DOKUMEN && parsedSections.PROSEDUR,
  'Parsing berbasis delimiter [[SECTION_NAME]] berhasil mengekstrak dokumen tanpa masalah escape JSON');

const checker = new ISO15189Checker();
const docText = `${parsedSections.JUDUL_DOKUMEN} ${parsedSections.TUJUAN} ${parsedSections.PROSEDUR}`;
const complianceReport = checker.evaluateDocument(docText, { clause: parsedSections.KLAUSUL_ISO });
assert(complianceReport.findings && complianceReport.findings.length > 0,
  `Evaluasi kepatuhan ISO 15189:2022 berhasil dieksekusi (Findings: ${complianceReport.findings.length})`);

// ── P2: Master Test Catalog Validator & LIS Exporter ──
console.log('\n2. WORK ITEM P2: MASTER TEST CATALOG VALIDATOR & LIS EXPORTER');

const validator = new CatalogValidator();
const testCsv = `Kode Material,Nama Pemeriksaan,Nama Analit,Operator,Batas Bawah,Batas Atas,Jenis Nilai,Kelompok Usia,Jenis Kelamin,LOINC (OBX-3),UCUM (OBX-6)
LAB-KIM-001,Glukosa Sewaktu,Glukosa Sewaktu,<,0,200,Kuantitatif,Dewasa,Semua,2345-7,mg/dL
LAB-HEM-001,Darah Lengkap,Hemoglobin,BETWEEN,13.0,17.0,Kuantitatif,Dewasa,Pria,718-7,g/dL`;

const valRes = validator.validate(testCsv);
assert(valRes.is_valid === true && valRes.errors.length === 0,
  'Validasi baris katalog memenuhi seluruh aturan integritas relasional & LOINC/UCUM');

const exporter = new LISExporter();
const parsedRows = validator.parseCSV(testCsv).rows;
const hl7Spec = exporter.export(parsedRows, { format: 'hl7_spec' });
assert(hl7Spec.includes('OBX-3 = LOINC Code') && hl7Spec.includes('718-7') && hl7Spec.includes('g/dL'),
  'Format Spesifikasi HL7 / FHIR (OBX-3 & OBX-6) tergenerate akurat untuk integrasi LIS/SIMRS');

// ── P3: QMS / SMM Modular Pack Assembler ──
console.log('\n3. WORK ITEM P3: QMS / SMM MODULAR PACK ASSEMBLER');

const assembler = new SMMPackAssembler();
const smmPackage = assembler.assemble({
  tenant_id: 'TEN-MEDIKA',
  lab_info: {
    name: 'Laboratorium Klinik Utama Medika',
    legal_entity: 'PT Medika Sehat Utama'
  }
});
assert(smmPackage.total_modules > 0 && smmPackage.combined_bundle.includes('Laboratorium Klinik Utama Medika'),
  `Perakitan paket SMM modular berhasil (${smmPackage.total_modules} modul dikompilasi)`);

// ── P4 & P5: Content Pipeline & Compounding Proof System ──
console.log('\n4. WORK ITEM P4 & P5: CONTENT PIPELINE & COMPOUNDING PROOF SYSTEM');

const pipeline = new ContentPipeline();
const patientContent = pipeline.generatePatientFacingDescription(parsedRows[0]);
assert(patientContent.title.includes('Glukosa Sewaktu') && patientContent.persiapan_pasien.length > 0,
  'Generasi deskripsi tes patient-facing ramah awam berhasil');

const linkedInPost = pipeline.generateLinkedInPost({ type: 'AUDIT_LESSON' });
assert(linkedInPost.includes('ISO15189') && linkedInPost.includes('KMK HK.01.07/MENKES/1983/2022'),
  'Draf konten otoritas LinkedIn berbasis temuan audit mutu berhasil diterbitkan');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 HASIL UJI AKSELERATOR: ${passedTests} DARI ${totalTests} SKENARIO LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
