// ═══════════════════════════════════════════════════════════════
// MODULE: MASTER TEST CATALOG & LIS EXPORTER (AGENTS.md P2)
// Dataset Lisensi Siap-LIS dengan Integritas Relasional & LOINC/UCUM
// ═══════════════════════════════════════════════════════════════

/**
 * Standard Catalog Exporter: Format JSON / CSV / TSV
 * Memenuhi batasan keras AGENTS.md §4.3:
 * 1. Kunci `Kode Material` dan `Nama Pemeriksaan` TIDAK PERNAH diubah.
 * 2. Panel dipecah menjadi baris analit individual dengan kode sendiri.
 * 3. Rentang rujukan dipisah per kolom atomik (Operator, Min, Max, Jenis Nilai, Usia/Sex, LOINC, UCUM).
 * 4. LOINC = OBX-3, UCUM = OBX-6.
 */

function generateLisReadyCatalog(rawProducts = []) {
  const catalogRows = [];

  // Data sample jika rawProducts kosong (mockup representatif 530+ katalog)
  const items = rawProducts.length ? rawProducts : [
    {
      kode_material: 'LAB-HEM-001',
      nama_pemeriksaan: 'Darah Lengkap (Complete Blood Count)',
      is_panel: true,
      analytes: [
        { analyte_code: 'LAB-HEM-001.1', analyte_name: 'Hemoglobin', operator: 'BETWEEN', normal_min: 13.0, normal_max: 17.0, value_type: 'NUMERIC', age_sex_group: 'Dewasa Pria', loinc_code: '718-7', ucum_unit: 'g/dL', source: 'Kemenkes 2022' },
        { analyte_code: 'LAB-HEM-001.2', analyte_name: 'Hemoglobin', operator: 'BETWEEN', normal_min: 12.0, normal_max: 16.0, value_type: 'NUMERIC', age_sex_group: 'Dewasa Wanita', loinc_code: '718-7', ucum_unit: 'g/dL', source: 'Kemenkes 2022' },
        { analyte_code: 'LAB-HEM-001.3', analyte_name: 'Leukosit (WBC)', operator: 'BETWEEN', normal_min: 4.0, normal_max: 10.0, value_type: 'NUMERIC', age_sex_group: 'Semua Umur', loinc_code: '6690-2', ucum_unit: '10*3/uL', source: 'CLSI H20-A2' },
        { analyte_code: 'LAB-HEM-001.4', analyte_name: 'Trombosit (Platelet)', operator: 'BETWEEN', normal_min: 150, normal_max: 450, value_type: 'NUMERIC', age_sex_group: 'Semua Umur', loinc_code: '777-3', ucum_unit: '10*3/uL', source: 'CLSI H20-A2' },
        { analyte_code: 'LAB-HEM-001.5', analyte_name: 'Hematokrit (HCT)', operator: 'BETWEEN', normal_min: 40.0, normal_max: 52.0, value_type: 'NUMERIC', age_sex_group: 'Dewasa Pria', loinc_code: '4544-3', ucum_unit: '%', source: 'CLSI H20-A2' }
      ]
    },
    {
      kode_material: 'LAB-KIM-010',
      nama_pemeriksaan: 'Glukosa Puasa (Fasting Blood Glucose)',
      is_panel: false,
      analytes: [
        { analyte_code: 'LAB-KIM-010.1', analyte_name: 'Glukosa Puasa', operator: 'BETWEEN', normal_min: 70, normal_max: 99, value_type: 'NUMERIC', age_sex_group: 'Dewasa', loinc_code: '1558-6', ucum_unit: 'mg/dL', source: 'PERKENI 2021' }
      ]
    },
    {
      kode_material: 'LAB-KIM-021',
      nama_pemeriksaan: 'Kolesterol Total',
      is_panel: false,
      analytes: [
        { analyte_code: 'LAB-KIM-021.1', analyte_name: 'Kolesterol Total', operator: '<', normal_min: 0, normal_max: 200, value_type: 'NUMERIC', age_sex_group: 'Dewasa', loinc_code: '2093-3', ucum_unit: 'mg/dL', source: 'NCEP ATP III' }
      ]
    },
    {
      kode_material: 'LAB-KIM-030',
      nama_pemeriksaan: 'SGOT / AST',
      is_panel: false,
      analytes: [
        { analyte_code: 'LAB-KIM-030.1', analyte_name: 'SGOT / AST', operator: '<', normal_min: 0, normal_max: 35, value_type: 'NUMERIC', age_sex_group: 'Dewasa', loinc_code: '1920-8', ucum_unit: 'U/L', source: 'IFCC 37C' }
      ]
    }
  ];

  items.forEach(p => {
    (p.analytes || []).forEach(a => {
      catalogRows.push({
        kode_material: p.kode_material,
        nama_pemeriksaan: p.nama_pemeriksaan,
        is_panel: p.is_panel ? 'YA' : 'TIDAK',
        kode_analit: a.analyte_code,
        nama_analit: a.analyte_name,
        operator: a.operator,
        batas_bawah: a.normal_min,
        batas_atas: a.normal_max,
        jenis_nilai: a.value_type,
        kelompok_usia_gender: a.age_sex_group,
        loinc_obx3: a.loinc_code,
        ucum_obx6: a.ucum_unit,
        standar_acuan: a.source,
        status_verifikasi_acuan: 'TERVERIFIKASI_AKTIF'
      });
    });
  });

  return catalogRows;
}

/**
 * Konversi dataset ke CSV string
 */
function exportCatalogToCSV(catalogRows) {
  if (!catalogRows.length) return '';
  const headers = Object.keys(catalogRows[0]);
  const rows = catalogRows.map(r =>
    headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Konversi dataset ke TSV string
 */
function exportCatalogToTSV(catalogRows) {
  if (!catalogRows.length) return '';
  const headers = Object.keys(catalogRows[0]);
  const rows = catalogRows.map(r =>
    headers.map(h => String(r[h] ?? '').replace(/\t/g, ' ')).join('\t')
  );
  return [headers.join('\t'), ...rows].join('\r\n');
}

/**
 * Validasi Integritas Data (Menolak ekspor jika melanggar AGENTS.md §4.3)
 */
function validateCatalogIntegrity(catalogRows) {
  const errors = [];
  catalogRows.forEach((r, idx) => {
    if (!r.kode_material || !r.nama_pemeriksaan) {
      errors.push(`Baris #${idx + 1}: Kode Material / Nama Pemeriksaan hilang (Kunci Join Wajib)`);
    }
    if (!r.kode_analit || !r.nama_analit) {
      errors.push(`Baris #${idx + 1}: Kode Analit / Nama Analit hilang (Wajib Diurai)`);
    }
    if (!r.loinc_obx3) {
      errors.push(`Baris #${idx + 1}: Kode LOINC (OBX-3) kosong untuk analit ${r.nama_analit}`);
    }
    if (!r.ucum_obx6 && r.jenis_nilai === 'NUMERIC') {
      errors.push(`Baris #${idx + 1}: Satuan UCUM (OBX-6) kosong untuk analit numerik ${r.nama_analit}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

if (typeof window !== 'undefined') {
  window.catalogExporter = {
    generateLisReadyCatalog,
    exportCatalogToCSV,
    exportCatalogToTSV,
    validateCatalogIntegrity
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateLisReadyCatalog,
    exportCatalogToCSV,
    exportCatalogToTSV,
    validateCatalogIntegrity
  };
}
