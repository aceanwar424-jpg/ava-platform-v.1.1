const fs = require('fs');
const path = require('path');
const { SMMPackAssembler } = require('../../lib/assembler/smm_pack_assembler');
const { ISO15189Checker } = require('../../lib/compliance/iso15189_checker');
const { LLMAdapter } = require('../../lib/llm/llm_adapter');

let totalTests = 0;
let passedTests = 0;

function assert(condition, name, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${name}: ${details}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔬 UJI WORK ITEM P1: DOCUMENT REENGINEERING ENGINE MULTI-LAB');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Uji Multi-Tenant Assembly untuk 2 Lab Berbeda
console.log('--- 1. Multi-Tenant Assembly (2 Independent Labs) ---');
const configMedika = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/tenant.klinik-medika.json'), 'utf8'));
const configSentosa = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/tenant.laboratorium-sentosa.json'), 'utf8'));

const assembler = new SMMPackAssembler();

// Assembly Tenant A
const packMedika = assembler.assemble(configMedika);
assert(packMedika.total_modules === 9, 'Tenant A (Medika) menghasilkan 9 modul SMM lengkap');
assert(packMedika.combined_bundle.includes('Klinik Pratama Medika Sejahtera'), 'Tenant A menyematkan nama lab Medika');
assert(packMedika.combined_bundle.includes('dr. Budi Setiawan, Sp.PK'), 'Tenant A menyematkan nama penanggung jawab Medika');
assert(!packMedika.combined_bundle.includes('{{'), 'Tenant A tidak menyisakan placeholder kurung kurawal');
assert(!packMedika.combined_bundle.toLowerCase().includes('ava queen') && !packMedika.combined_bundle.toLowerCase().includes('ava diagnostics'), 'Tenant A bebas dari string hardcoded AVA');

// Assembly Tenant B
const packSentosa = assembler.assemble(configSentosa);
assert(packSentosa.total_modules === 9, 'Tenant B (Sentosa) menghasilkan 9 modul SMM lengkap');
assert(packSentosa.combined_bundle.includes('Laboratorium Bio-Sentosa Utama'), 'Tenant B menyematkan nama lab Sentosa');
assert(packSentosa.combined_bundle.includes('dr. Ratna Dewi Sartika, Sp.PK, M.Kes'), 'Tenant B menyematkan nama penanggung jawab Sentosa');
assert(!packSentosa.combined_bundle.includes('{{'), 'Tenant B tidak menyisakan placeholder kurung kurawal');
assert(!packSentosa.combined_bundle.toLowerCase().includes('ava queen') && !packSentosa.combined_bundle.toLowerCase().includes('ava diagnostics'), 'Tenant B bebas dari string hardcoded AVA');

// 2. Uji ISO 15189:2022 Compliance Checker & Gap Reporting
console.log('\n--- 2. ISO 15189:2022 Compliance Evaluation & Gap Reporting ---');
const checker = new ISO15189Checker();

const evalMedika = checker.evaluateDocument(packMedika.combined_bundle, {
  title: 'Paket SMM - Klinik Medika Sejahtera'
});
console.log(`Evaluasi Medika: Score ${evalMedika.compliance_score}%, Status: ${evalMedika.is_compliant ? 'AUDIT READY' : 'NEEDS REVISION'}`);
assert(evalMedika.compliance_score === 100, 'Tenant A memenuhi 100% klausul ISO 15189:2022 (9/9 Klausul terpenuhi)');
assert(evalMedika.is_compliant === true, 'Tenant A dinyatakan lolos audit kesiapan ISO 15189');

const evalSentosa = checker.evaluateDocument(packSentosa.combined_bundle, {
  title: 'Paket SMM - Bio-Sentosa'
});
console.log(`Evaluasi Sentosa: Score ${evalSentosa.compliance_score}%, Status: ${evalSentosa.is_compliant ? 'AUDIT READY' : 'NEEDS REVISION'}`);
assert(evalSentosa.compliance_score === 100, 'Tenant B memenuhi 100% klausul ISO 15189:2022 (9/9 Klausul terpenuhi)');
assert(evalSentosa.is_compliant === true, 'Tenant B dinyatakan lolos audit kesiapan ISO 15189');

// Uji Gap Report pada dokumen yang tidak lengkap (Sengaja tidak memuat flebotomi/PMI)
const incompleteDoc = `
DOKUMEN KEBIJAKAN MANAJEMEN MUTU
Kerahasiaan dan ketidakberpihakan dijamin oleh penanggung jawab laboratorium klinik berbadan hukum.
Personel memiliki sertifikasi pelatihan dan STTR.
Pemeliharaan alat dan kalibrasi rutin dikerjakan.
Pengendalian dokumen revisi berkala diatur dalam panduan mutu.
Manajemen risiko dan audit internal dilakukan berkala.
`;
const evalIncomplete = checker.evaluateDocument(incompleteDoc, { title: 'Dokumen Parsial' });
assert(evalIncomplete.compliance_score < 100, 'Dokumen parsial terdeteksi memiliki gap klausul');
assert(evalIncomplete.summary.gaps_detected > 0, `Laporan gap mendeteksi ${evalIncomplete.summary.gaps_detected} klausul yang belum terpenuhi`);

// 3. Uji Provider-Agnostic LLM Adapter & Delimiter Parsing
console.log('\n--- 3. Provider-Agnostic LLM Adapter & Delimiter Parsing ---');
const llm = new LLMAdapter({ provider: 'mock' });
const rawAiOutput = `
[[STATUS]]
SUCCESS
[[RESULT_HEADER]]
DRAFT SOP MANAJEMEN SPESIMEN KLINIK
[[CONTENT]]
Prosedur penanganan spesimen darah vena sesuai ISO 15189:2022 klausul 7.2.
[[ISO_CLAUSE_SUMMARY]]
Klausul 7.2 Pra-analitik terpenuhi dengan kriteria penolakan spesimen.
`;
const parsed = llm.parseDelimiters(rawAiOutput);
assert(parsed.STATUS === 'SUCCESS' && parsed.RESULT_HEADER && parsed.CONTENT && parsed.ISO_CLAUSE_SUMMARY,
  'LLM Adapter berhasil mem-parsing struktur teks medis dengan delimiter [[SECTION_NAME]] tanpa JSON escaping issue');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`🎉 HASIL PENGUJIAN P1: ${passedTests}/${totalTests} UJI LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════');

if (passedTests !== totalTests) {
  process.exit(1);
}
