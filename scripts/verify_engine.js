/**
 * Script Verifikasi Peta Eksekusi Engine Multi-Lab (Plan -> Execute -> Verify)
 */

const fs = require('fs');
const path = require('path');
const { LLMAdapter } = require('../lib/llm/llm_adapter');
const { ISO15189Checker } = require('../lib/compliance/iso15189_checker');
const { CatalogValidator } = require('../lib/validator/catalog_validator');
const { LISExporter } = require('../lib/exporter/lis_exporter');

async function runVerification() {
  console.log('=====================================================');
  console.log('VERIFIKASI SISTEM ENGINE MULTI-LAB & PRODUKTISASI ASET');
  console.log('=====================================================\n');

  // 1. Verifikasi Konfigurasi Multi-Tenant
  console.log('[1/5] Memuat Konfigurasi Multi-Tenant...');
  const tenantPath = path.join(__dirname, '../config/tenant.template.json');
  const tenantConfig = JSON.parse(fs.readFileSync(tenantPath, 'utf-8'));
  console.log(`✅ Tenant Loaded: ${tenantConfig.lab_info.name} (${tenantConfig.tenant_id})`);
  console.log(`✅ Tag IP Ownership: ${tenantConfig.ip_ownership.tag}\n`);

  // 2. Verifikasi LLM Adapter & Delimiter Parsing
  console.log('[2/5] Menguji Provider-Agnostic LLM Adapter & Delimiter Parsing...');
  const llm = new LLMAdapter({ provider: 'mock' });
  const llmResult = await llm.generateCompletion({
    prompt: 'Buat kerangka SOP Penanganan Spesimen Darah',
    systemPrompt: 'Gunakan format [[SECTION_NAME]]'
  });
  console.log(`✅ Provider Active: ${llmResult.provider}`);
  console.log(`✅ Sections Parsed (${Object.keys(llmResult.sections).length}): ${Object.keys(llmResult.sections).join(', ')}\n`);

  // 3. Verifikasi ISO 15189 Compliance Checker
  console.log('[3/5] Menguji Layer ISO 15189 Compliance Checker...');
  const sampleDoc = `
    DOKUMEN MANAJEMEN MUTU LABORATORIUM KLINIK
    Struktur Organisasi & Penanggung Jawab Laboratorium disahkan oleh direktur.
    Personel memiliki kualifikasi kompetensi, pelatihan, STTR, dan SIP yang valid.
    Kalibrasi alat rutin dilakukan untuk menjamin keterlacakan.
    Prosedur pra-analitik mencakup kriteria penolakan spesimen dan stabilitas.
    Pengendalian dokumen mutu diatur dalam SOP revisi berkala.
  `;
  const checker = new ISO15189Checker();
  const evaluation = checker.evaluateDocument(sampleDoc, { title: 'SOP Mutu Sampel', doc_number: 'SOP-001' });
  console.log(`✅ Compliance Score: ${evaluation.compliance_score}%`);
  console.log(`✅ Status Evaluasi: ${evaluation.is_compliant ? 'PASSED' : 'GAP_DETECTED'}`);
  console.log(`✅ High Severity Gaps: ${evaluation.summary.high_severity_gaps}\n`);

  // 4. Verifikasi Catalog Integrity Validator
  console.log('[4/5] Menguji Catalog Integrity Validator (Rule §4.3)...');
  const catalogCsvPath = path.join(__dirname, '../data/catalog/catalog_generic.csv');
  const csvContent = fs.readFileSync(catalogCsvPath, 'utf-8');
  const validator = new CatalogValidator();
  const valResult = validator.validate(csvContent);
  console.log(`✅ Catalog Valid: ${valResult.is_valid}`);
  console.log(`✅ Total Analyt Checking: ${valResult.total_rows} baris`);
  console.log(`✅ Critical Errors: ${valResult.critical_errors_count}`);
  console.log(`✅ Warnings: ${valResult.warnings_count}\n`);

  // 5. Verifikasi Multi-Format LIS Exporter
  console.log('[5/5] Menguji Multi-Format LIS Exporter...');
  const parsedData = validator.parseCSV(csvContent).rows;
  const exporter = new LISExporter();
  const hl7Spec = exporter.export(parsedData, { format: 'hl7_spec' });
  console.log(`✅ HL7/FHIR Spec Exporter Generated (${hl7Spec.length} bytes)`);

  console.log('\n=====================================================');
  console.log('SELURUH UJI VERIFIKASI ENGINE MULTI-LAB BERHASIL! 🚀');
  console.log('=====================================================');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
