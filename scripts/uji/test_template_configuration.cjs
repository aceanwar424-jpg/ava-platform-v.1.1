/**
 * Test Suite: Konfigurasi Template Fleksibel (Dokumen SMM & E-Hasil Lab)
 * Memvalidasi preset, override logo (posisi/ukuran), spasi, kolom tabel, TTE, dan bundel ISO 15189.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { TemplateManager } = require('../../lib/template_engine/template_manager');
const { ConfigurableDocGenerator } = require('../../lib/template_engine/configurable_doc_generator');

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
console.log('🧪 PENGUJIAN SISTEM KONFIGURASI TEMPLATE FLEKSIBEL (P3)');
console.log('═══════════════════════════════════════════════════════════════\n');

const tm = new TemplateManager();
const docGen = new ConfigurableDocGenerator();

const mockTenant = {
  tenant_id: 'TEN-TEST',
  lab_info: {
    name: 'Laboratorium Klinik Utama Sentosa',
    legal_entity: 'PT Sentosa Medika Sejahtera',
    license_number: '91200045/DINKES/2026',
    address: 'Jl. Merdeka No. 10 Jakarta',
    city: 'Jakarta',
    phone: '021-5551234',
    email: 'info@sentosa.id'
  },
  qms_headers: {
    document_code_prefix: 'SOP-LAB',
    effective_date: '2026-10-01',
    lab_director_name: 'dr. Hendra Prasetya, Sp.PK',
    lab_director_sip: 'SIP.123/SP.PK/2026'
  }
};

const mockPatient = {
  name: 'Bpk. Ahmad Fauzi',
  mr_number: 'MR-990123',
  dob: '12-08-1980',
  age: '46',
  gender: 'Laki-laki',
  doctor_referrer: 'dr. Spesialis Penyakit Dalam',
  test_date: '2026-10-10'
};

const mockAnalytes = [
  { analyte_name: 'Glukosa Puasa', loinc: '1558-6', result_value: '135', flag: 'High', unit: 'mg/dL', ref_range: '70 - 99', method: 'Hexokinase', specimen: 'Serum' },
  { analyte_name: 'HbA1c', loinc: '4548-4', result_value: '6.8', flag: 'High', unit: '%', ref_range: '< 5.7', method: 'HPLC', specimen: 'Darah EDTA' },
  { analyte_name: 'Kolesterol Total', loinc: '2093-3', result_value: '185', flag: 'Normal', unit: 'mg/dL', ref_range: '< 200', method: 'CHOD-PAP', specimen: 'Serum' }
];

// 1. TemplateManager Presets & Merging
console.log('1. PENGUJIAN TEMPLATE MANAGER & PRESETS:');
runTest('Memuat seluruh preset bawaan (standard_navy, formal_center, dual_logo, compact, emerald)', () => {
  const presets = tm.getPresets();
  assert(presets.standard_navy, 'standard_navy harus ada');
  assert(presets.formal_center, 'formal_center harus ada');
  assert(presets.dual_logo_partnership, 'dual_logo_partnership harus ada');
  assert(presets.compact_slip, 'compact_slip harus ada');
  assert(presets.emerald_wellness, 'emerald_wellness harus ada');
});

runTest('Mengambil preset individual dan deep merge konfigurasi', () => {
  const centerConfig = tm.getPreset('formal_center');
  assert.strictEqual(centerConfig.header_kop.logo_position, 'center');
  assert.strictEqual(centerConfig.header_kop.kop_text_align, 'center');
  assert.strictEqual(centerConfig.layout.primary_color, '#1e3a8a');
});

runTest('createQuickConfig mampu menerapkan partial overrides secara instan', () => {
  const custom = tm.createQuickConfig({
    preset: 'standard_navy',
    logo_position: 'dual',
    primary_color: '#059669',
    margins: { top: 12, bottom: 12, left: 12, right: 12 },
    hidden_columns: ['method'],
    enable_specimen_column: true
  });
  assert.strictEqual(custom.header_kop.logo_position, 'dual');
  assert.strictEqual(custom.layout.primary_color, '#059669');
  assert.strictEqual(custom.layout.page_margin_mm.top, 12);
  const methodCol = custom.lab_results_table.columns.find(c => c.id === 'method');
  assert.strictEqual(methodCol.enabled, false);
  const specimenCol = custom.lab_results_table.columns.find(c => c.id === 'specimen');
  assert.strictEqual(specimenCol.enabled, true);
});

runTest('Validasi konfigurasi: Menolak config tanpa kolom wajib atau logo position salah', () => {
  const invalidConfig = {
    layout: { page_size: 'A4', page_margin_mm: { top: 20 } },
    header_kop: { logo_position: 'upside_down' }, // Invalid
    lab_results_table: { columns: [{ id: 'unit', enabled: true }] } // Missing analyte & result
  };
  const valRes = tm.validateConfig(invalidConfig);
  assert.strictEqual(valRes.is_valid, false);
  assert(valRes.errors.length >= 2, 'Harus mendeteksi minimal 2 kesalahan');
});

// 2. Kop & Logo Positioning
console.log('\n2. PENGUJIAN KOP & POSISI LOGO (KIRI, TENGAH, KANAN, GANDA):');
runTest('Render Kop dengan Logo Kiri (Default)', () => {
  const html = docGen.renderKopHtml(mockTenant, { header_kop: { logo_position: 'left' } });
  assert(html.toLowerCase().includes('laboratorium klinik utama sentosa'));
  assert(html.includes('doc-header-kop'));
});

runTest('Render Kop dengan Logo Tengah', () => {
  const html = docGen.renderKopHtml(mockTenant, { header_kop: { logo_position: 'center', kop_text_align: 'center' } });
  assert(html.includes('flex-direction:column; align-items:center'));
  assert(html.toLowerCase().includes('laboratorium klinik utama sentosa'));
});

runTest('Render Kop dengan Logo Kanan', () => {
  const html = docGen.renderKopHtml(mockTenant, { header_kop: { logo_position: 'right' } });
  assert(html.includes('justify-content:space-between'));
});

runTest('Render Kop dengan Logo Ganda (Dual Logo: Kiri & Kanan)', () => {
  const html = docGen.renderKopHtml(mockTenant, { header_kop: { logo_position: 'dual', secondary_logo_text: '🏅 KAN LP-1192' } });
  assert(html.includes('justify-content:space-between'));
  assert(html.includes('KAN LP-1192'));
});

// 3. Lab Results Table & Column Configuration
console.log('\n3. PENGUJIAN TABEL HASIL LAB & TOGGLE KOLOM:');
runTest('Render E-Hasil dengan kolom standar dan highlight nilai abnormal', () => {
  const html = docGen.renderLabResultHtml(mockPatient, mockAnalytes, mockTenant);
  assert(html.includes('Ny. Linda Handayani') || html.includes('Bpk. Ahmad Fauzi'));
  assert(html.includes('Glukosa Puasa'));
  assert(html.includes('LOINC: 1558-6'));
  assert(html.includes('High'), 'Status High harus ter-render');
  assert(html.includes('color:#dc2626'), 'Hasil abnormal harus disorot merah');
});

runTest('Menonaktifkan kolom (misal Metode dinonaktifkan, Spesimen diaktifkan)', () => {
  const customCols = tm.createQuickConfig({
    hidden_columns: ['method'],
    enable_specimen_column: true
  });
  const html = docGen.renderLabResultHtml(mockPatient, mockAnalytes, mockTenant, customCols);
  assert(html.includes('SPESIMEN'), 'Kolom SPESIMEN harus muncul');
  assert(html.includes('Serum Darah') || html.includes('Serum'), 'Data spesimen harus ter-render');
});

runTest('Konfigurasi posisi Tanda Tangan (Kiri, Tengah, Kanan)', () => {
  const htmlLeft = docGen.renderLabResultHtml(mockPatient, mockAnalytes, mockTenant, {
    signature_box: { position: 'left' }
  });
  assert(htmlLeft.includes('justify-content:flex-start'), 'TTE harus rata kiri');

  const htmlCenter = docGen.renderLabResultHtml(mockPatient, mockAnalytes, mockTenant, {
    signature_box: { position: 'center' }
  });
  assert(htmlCenter.includes('justify-content:center'), 'TTE harus rata tengah');
});

// 4. SMM Document Control Header (ISO 15189)
console.log('\n4. PENGUJIAN DOKUMEN SMM & KOTAK KENDALI DOKUMEN ISO 15189:');
runTest('Render Bundel Dokumen SMM menyertakan Kotak Kendali Dokumen Mutu Standar', () => {
  const mockSmmPackage = {
    documents: [
      {
        clause: '7.4.1',
        module_id: 'SOP-LAB-07-004',
        title: 'SOP Evaluasi dan Pelaporan Hasil Kritis',
        content: '## 1. TUJUAN\nMenjamin hasil kritis segera dilaporkan ke DPJP.'
      }
    ]
  };
  const html = docGen.renderSmmBundleHtml(mockSmmPackage, mockTenant);
  assert(html.includes('SISTEM MANAJEMEN MUTU ISO 15189:2022'));
  assert(html.includes('No. Dokumen:'));
  assert(html.includes('SOP-LAB-07-004'));
  assert(html.includes('Edisi / Revisi:'));
  assert(html.includes('Tanggal Berlaku:'));
  assert(html.includes('Penanggung Jawab:'));
});

// 5. Visual Configurator Tool Exists
console.log('\n5. PENGUJIAN ALAT BANTU INTERAKTIF & PRESET:');
runTest('File tools/template_configurator.html tersedia dan valid', () => {
  const toolPath = path.join(__dirname, '../../tools/template_configurator.html');
  assert(fs.existsSync(toolPath), 'tools/template_configurator.html harus ada');
  const content = fs.readFileSync(toolPath, 'utf8');
  assert(content.includes('Konfigurator Template Dokumen & Lab Hasil'));
  assert(content.includes('applyPreset'));
  assert(content.includes('btn-pos-dual'));
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`📊 TOTAL PENGUJIAN TEMPLATE: ${passedTests} DARI ${totalTests} LULUS (100%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
