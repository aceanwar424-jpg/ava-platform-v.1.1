/**
 * LIS Multi-Format Exporter (Work Item P2)
 * Mengonversi dataset katalog master ke format LIS (CSV, TSV, JSON)
 * Menyertakan pemetaan HL7 v2 / FHIR (OBX-3 LOINC, OBX-6 UCUM) dan Audit Traceability.
 */

const fs = require('fs');

class LISExporter {
  /**
   * Ekspor data katalog ke format CSV / TSV / JSON
   * @param {Array<Object>} catalogRows - Baris data katalog ter-parse
   * @param {Object} options
   * @param {string} options.format - 'csv' | 'tsv' | 'json' | 'hl7_spec'
   * @param {boolean} [options.includeAuditTraceability=true]
   * @returns {string} Text hasil ekspor
   */
  export(catalogRows, options = {}) {
    const { format = 'csv', includeAuditTraceability = true } = options;

    if (format === 'json') {
      return JSON.stringify(catalogRows, null, 2);
    }

    if (format === 'hl7_spec') {
      return this._exportHL7Spec(catalogRows);
    }

    const delimiter = format === 'tsv' ? '\t' : ',';
    if (!catalogRows || catalogRows.length === 0) return '';

    const headers = Object.keys(catalogRows[0]);
    if (!includeAuditTraceability) {
      const auditIdx = headers.indexOf('Status Verifikasi Acuan');
      if (auditIdx > -1) headers.splice(auditIdx, 1);
    }

    let result = headers.map(h => `"${h}"`).join(delimiter) + '\n';

    catalogRows.forEach(row => {
      const line = headers.map(h => {
        const val = row[h] !== undefined ? String(row[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(delimiter);
      result += line + '\n';
    });

    return result;
  }

  _exportHL7Spec(catalogRows) {
    let specText = `# SPESIFIKASI INTEGRASI LIS / SIMRS (HL7 v2 & FHIR)\n\n`;
    specText += `Generated on: ${new Date().toISOString()}\n`;
    specText += `Standard Mapping: OBX-3 = LOINC Code | OBX-6 = UCUM Unit\n\n`;
    specText += `| Material Code | Exam Name | Analyte Name | OBX-3 (LOINC) | OBX-6 (UCUM) | Ref Range (Min-Max) | Audit Status |\n`;
    specText += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    catalogRows.forEach(row => {
      const refRange = `${row['Operator'] || ''} ${row['Batas Bawah'] || ''} - ${row['Batas Atas'] || ''} ${row['UCUM (OBX-6)'] || ''}`;
      specText += `| ${row['Kode Material']} | ${row['Nama Pemeriksaan']} | ${row['Nama Analit']} | ${row['LOINC (OBX-3)']} | ${row['UCUM (OBX-6)']} | ${refRange} | ${row['Status Verifikasi Acuan'] || 'UNAUDITED'} |\n`;
    });

    return specText;
  }
}

module.exports = { LISExporter };
