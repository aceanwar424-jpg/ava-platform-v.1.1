/**
 * Generator Aset Lengkap P3, P4, P5
 * 1. P3: Dokumen Bundel SMM Siap-Cetak (HTML) & E-Hasil Lab Ber-Kop Konfigurasi
 * 2. P4: Batch Content Engine (633 Analit -> Kamus Pasien & Kalender LinkedIn)
 * 3. P5: Case Study Compounding Proof System
 */

const fs = require('fs');
const path = require('path');
const { SMMPackAssembler } = require('../lib/assembler/smm_pack_assembler');
const { ConfigurableDocGenerator } = require('../lib/template_engine/configurable_doc_generator');
const { ContentPipeline } = require('../tools/content_pipeline');
const { CaseStudyGenerator } = require('../lib/compounding/case_study_generator');
const { CatalogValidator } = require('../lib/validator/catalog_validator');

function runFullAssetGeneration() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 EKSEKUSI PENUNTASAN P3, P4, P5 (TEMPLATE, KONTEN & BUKTI)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buat direktori artefak jika belum ada
  const dirs = [
    path.join(__dirname, '../artifacts/smm_bundles'),
    path.join(__dirname, '../artifacts/lab_results'),
    path.join(__dirname, '../artifacts/case_studies'),
    path.join(__dirname, '../data/content')
  ];
  dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // ── 1. P3: DOKUMEN SMM BUNDLE BER-KOP RESMI PER-TENANT ──
  console.log('[1/4] Merakit Bundel Dokumen SMM Siap-Cetak (HTML) per-Tenant...');
  const configMedika = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/tenant.klinik-medika.json'), 'utf8'));
  const configSentosa = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/tenant.laboratorium-sentosa.json'), 'utf8'));

  const assembler = new SMMPackAssembler();
  
  // Tenant A: Klinik Medika (Logo Kiri Standar)
  const bundleMedika = assembler.assembleHtmlPackage(configMedika);
  const outMedikaPath = path.join(__dirname, '../artifacts/smm_bundles/smm_bundle_medika.html');
  fs.writeFileSync(outMedikaPath, bundleMedika.html_bundle, 'utf8');
  console.log(`  ✓ SMM Bundle Medika tersimpan: ${outMedikaPath} (${(bundleMedika.html_bundle.length / 1024).toFixed(1)} KB)`);

  // Tenant B: Lab Sentosa (Kustom: Logo Tengah, Border Ganda)
  const customLayoutSentosa = {
    header_kop: {
      logo_position: 'center',
      kop_text_align: 'center',
      divider_line_style: 'double',
      divider_line_color: '#0284c7'
    }
  };
  const bundleSentosa = assembler.assembleHtmlPackage(configSentosa, customLayoutSentosa);
  const outSentosaPath = path.join(__dirname, '../artifacts/smm_bundles/smm_bundle_sentosa.html');
  fs.writeFileSync(outSentosaPath, bundleSentosa.html_bundle, 'utf8');
  console.log(`  ✓ SMM Bundle Sentosa (Logo Tengah) tersimpan: ${outSentosaPath} (${(bundleSentosa.html_bundle.length / 1024).toFixed(1)} KB)`);

  // ── 2. P3: LEMBAR SERTIFIKAT E-HASIL LAB DENGAN KOP KUSTOM ──
  console.log('\n[2/4] Merender Lembar E-Hasil Laboratorium Pasien Ber-Kop Kustom...');
  const docGen = new ConfigurableDocGenerator();

  const samplePatient = {
    name: 'Ny. Linda Handayani',
    mr_number: 'MR-892401',
    dob: '14 Mei 1988',
    age: '38',
    gender: 'Perempuan',
    doctor_referrer: 'dr. Hendra Prasetya, Sp.PK',
    test_date: '09 Oktober 2026'
  };

  const sampleAnalytes = [
    { analyte_name: 'Glukosa Darah Puasa', loinc: '1558-6', result_value: '118', flag: 'High', unit: 'mg/dL', ref_range: '70 - 99', method: 'Hexokinase / Photometry' },
    { analyte_name: 'HbA1c (Hemoglobin A1c)', loinc: '4548-4', result_value: '5.9', flag: 'High', unit: '%', ref_range: '< 5.7', method: 'HPLC Ion-Exchange' },
    { analyte_name: 'Kolesterol Total', loinc: '2093-3', result_value: '228', flag: 'High', unit: 'mg/dL', ref_range: '< 200', method: 'CHOD-PAP' },
    { analyte_name: 'Trigliserida', loinc: '2571-8', result_value: '142', flag: 'Normal', unit: 'mg/dL', ref_range: '< 150', method: 'GPO-PAP' },
    { analyte_name: 'SGOT (AST)', loinc: '1920-8', result_value: '24', flag: 'Normal', unit: 'U/L', ref_range: '< 35', method: 'IFCC UV without P5P' },
    { analyte_name: 'SGPT (ALT)', loinc: '1742-6', result_value: '28', flag: 'Normal', unit: 'U/L', ref_range: '< 35', method: 'IFCC UV without P5P' }
  ];

  // Template Default (Logo Kiri)
  const eHasilDefault = docGen.renderLabResultHtml(samplePatient, sampleAnalytes, configMedika);
  const outHasilDefault = path.join(__dirname, '../artifacts/lab_results/e_hasil_sample_medika_default.html');
  fs.writeFileSync(outHasilDefault, eHasilDefault, 'utf8');
  console.log(`  ✓ E-Hasil Medika tersimpan: ${outHasilDefault}`);

  // Template Kustom Sentosa (Logo Kanan, Kolom Uji Disesuaikan)
  const customHasilSentosa = docGen.renderLabResultHtml(samplePatient, sampleAnalytes, configSentosa, {
    header_kop: { logo_position: 'right', kop_text_align: 'left' }
  });
  const outHasilSentosa = path.join(__dirname, '../artifacts/lab_results/e_hasil_sample_sentosa_custom.html');
  fs.writeFileSync(outHasilSentosa, customHasilSentosa, 'utf8');
  console.log(`  ✓ E-Hasil Sentosa (Logo Kanan) tersimpan: ${outHasilSentosa}`);

  // ── 3. P4: BATCH CONTENT ENGINE (633 ANALIT -> KAMUS PASIEN & LINKEDIN) ──
  console.log('\n[3/4] Menjalankan Batch Content Pipeline untuk 633 Analit Katalog...');
  const catalogCsvPath = path.join(__dirname, '../data/catalog/catalog_generic.csv');
  const catalogCsv = fs.readFileSync(catalogCsvPath, 'utf8');
  const { rows } = new CatalogValidator().parseCSV(catalogCsv);

  const pipeline = new ContentPipeline();
  const patientCatalogResult = pipeline.generateBatchPatientCatalog(rows);
  const outPatientCatalogPath = path.join(__dirname, '../data/content/patient_facing_catalog.json');
  fs.writeFileSync(outPatientCatalogPath, JSON.stringify(patientCatalogResult, null, 2), 'utf8');
  console.log(`  ✓ Kamus Panduan Pasien berhasil dibuat: ${outPatientCatalogPath}`);
  console.log(`    (Mencakup ${patientCatalogResult.total_examinations} pemeriksaan klinis terurai)`);

  const linkedinCalendar = pipeline.generateLinkedInEditorialCalendar();
  const outLinkedinPath = path.join(__dirname, '../data/content/linkedin_content_calendar.md');
  fs.writeFileSync(outLinkedinPath, linkedinCalendar, 'utf8');
  console.log(`  ✓ Draf Kalender Editorial LinkedIn tersimpan: ${outLinkedinPath}`);

  // ── 4. P5: CASE STUDY COMPOUNDING PROOF GENERATOR ──
  console.log('\n[4/4] Membangun Lembar Studi Kasus Otomatis (Before vs. After)...');
  const caseStudyGen = new CaseStudyGenerator();
  const study = caseStudyGen.generateCaseStudy({
    tenant_info: { name: configMedika.lab_info.name },
    before_metrics: {
      qms_readiness_score: 42,
      assembly_time_days: 90,
      loinc_ucum_compliance_pct: 15,
      critical_gaps: 6
    },
    after_metrics: {
      qms_readiness_score: 100,
      assembly_time_hours: 2,
      loinc_ucum_compliance_pct: 100,
      critical_gaps: 0
    }
  });

  const outStudyMd = path.join(__dirname, '../artifacts/case_studies/case_study_iso15189_transformation.md');
  fs.writeFileSync(outStudyMd, study.markdown, 'utf8');
  console.log(`  ✓ Studi Kasus Markdown tersimpan: ${outStudyMd}`);

  const outStudyHtml = path.join(__dirname, '../artifacts/case_studies/case_study_iso15189_transformation.html');
  fs.writeFileSync(outStudyHtml, study.html, 'utf8');
  console.log(`  ✓ Studi Kasus Card HTML tersimpan: ${outStudyHtml}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 SELURUH ASET P3, P4, DAN P5 BERHASIL DIPRODUKSI 100%!');
  console.log('═══════════════════════════════════════════════════════════════');
}

runFullAssetGeneration();
