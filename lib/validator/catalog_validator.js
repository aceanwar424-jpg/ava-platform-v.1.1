/**
 * Master Test Catalog Integrity Validator (Rule §4.3)
 * Menegakkan aturan integritas data katalog master:
 * - Kunci relasional immutable (Kode Material & Nama Pemeriksaan)
 * - Panel wajib dipecah menjadi baris analit individual
 * - Variabel reference range terpisah ke kolom individual
 * - Validasi pemetaan standar LOINC (OBX-3) & UCUM (OBX-6)
 */

const REQUIRED_HEADERS = [
  'Kode Material',
  'Nama Pemeriksaan',
  'Nama Analit',
  'Operator',
  'Batas Bawah',
  'Batas Atas',
  'Jenis Nilai',
  'Kelompok Usia',
  'Jenis Kelamin',
  'LOINC (OBX-3)',
  'UCUM (OBX-6)'
];

class CatalogValidator {
  /**
   * Parse CSV sederhanan
   * @param {string} csvText 
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      // Regex koma sederhana (perhatian pada tanda petik)
      const values = currentLine.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] !== undefined ? values[idx] : '';
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  /**
   * Validasi integritas katalog master
   * @param {string} csvText - Isi file CSV katalog
   * @returns {Object} Hasil Laporan Validasi
   */
  validate(csvText) {
    const { headers, rows } = this.parseCSV(csvText);
    const errors = [];
    const warnings = [];

    // 1. Validasi Kolom Wajib
    REQUIRED_HEADERS.forEach(reqHeader => {
      if (!headers.includes(reqHeader)) {
        errors.push({
          type: 'MISSING_COLUMN',
          message: `Kolom wajib '${reqHeader}' tidak ditemukan pada header CSV.`,
          severity: 'CRITICAL'
        });
      }
    });

    if (errors.length > 0) {
      return {
        is_valid: false,
        total_rows: rows.length,
        errors,
        warnings,
        summary: 'Gagal validasi header kolom wajib'
      };
    }

    // 2. Validasi Tiap Baris Data (Rule §4.3)
    rows.forEach((row, index) => {
      const rowNum = index + 2; // Header = baris 1

      // Rule 4.3.1: Kunci relasional tidak boleh kosong
      if (!row['Kode Material'] || !row['Nama Pemeriksaan']) {
        errors.push({
          row: rowNum,
          type: 'IMMUTABLE_KEY_EMPTY',
          message: `Baris ${rowNum}: 'Kode Material' atau 'Nama Pemeriksaan' kosong. Ini adalah kunci join yang immutable.`,
          severity: 'CRITICAL'
        });
      }

      // Rule 4.3.2: Panel wajib dipecah ke baris analit individual
      if (!row['Nama Analit'] || row['Nama Analit'] === row['Nama Pemeriksaan'] && row['Nama Pemeriksaan'].toLowerCase().includes('panel')) {
        warnings.push({
          row: rowNum,
          type: 'UNBROKEN_PANEL_DETECTED',
          message: `Baris ${rowNum}: Peringatan analit '${row['Nama Pemeriksaan']}'. Pastikan panel dipecah menjadi baris analit spesifik.`,
          severity: 'HIGH'
        });
      }

      // Rule 4.3.3: Reference range terpisah
      if (row['Batas Bawah'] === undefined || row['Batas Atas'] === undefined || row['Operator'] === undefined) {
        errors.push({
          row: rowNum,
          type: 'COLLAPSED_REFERENCE_RANGE',
          message: `Baris ${rowNum}: Kolom Operator/Batas Bawah/Batas Atas terkolaps atau tidak valid. Harus dipisah per kolom.`,
          severity: 'CRITICAL'
        });
      }

      // Rule 4.3.4: LOINC (OBX-3) & UCUM (OBX-6)
      if (!row['LOINC (OBX-3)']) {
        warnings.push({
          row: rowNum,
          type: 'MISSING_LOINC',
          message: `Baris ${rowNum}: LOINC (OBX-3) kosong. Direkomendasikan untuk sertifikasi LIS/FHIR.`,
          severity: 'MEDIUM'
        });
      }

      if (!row['UCUM (OBX-6)']) {
        warnings.push({
          row: rowNum,
          type: 'MISSING_UCUM',
          message: `Baris ${rowNum}: UCUM (OBX-6) kosong. Satuan pengukuran wajib standar LIS.`,
          severity: 'MEDIUM'
        });
      }
    });

    const isSuccess = errors.filter(e => e.severity === 'CRITICAL').length === 0;

    return {
      is_valid: isSuccess,
      total_rows: rows.length,
      critical_errors_count: errors.length,
      warnings_count: warnings.length,
      errors,
      warnings,
      summary: isSuccess
        ? `Lolos Validasi Integritas Data (${rows.length} baris analit diperiksa)`
        : `Gagal Validasi Integritas Data (${errors.length} kesalahan kritikal ditemukan)`
    };
  }
}

module.exports = { CatalogValidator };
