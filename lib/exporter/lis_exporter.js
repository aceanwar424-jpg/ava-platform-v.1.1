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

    if (format === 'excel_xml' || format === 'xls') {
      return this._exportExcelXml(catalogRows, includeAuditTraceability);
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

  _exportExcelXml(catalogRows, includeAuditTraceability = true) {
    if (!catalogRows || catalogRows.length === 0) return '';
    const headers = Object.keys(catalogRows[0]);
    if (!includeAuditTraceability) {
      const auditIdx = headers.indexOf('Status Verifikasi Acuan');
      if (auditIdx > -1) headers.splice(auditIdx, 1);
    }

    const escapeXml = (str) => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F2963"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0F2963" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowStyle">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Master_Test_Catalog">
  <Table ss:DefaultRowHeight="20">
`;

    // Header Row
    xml += `   <Row ss:StyleID="HeaderStyle" ss:Height="24">\n`;
    headers.forEach(h => {
      xml += `    <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
    });
    xml += `   </Row>\n`;

    // Data Rows
    catalogRows.forEach(row => {
      xml += `   <Row ss:StyleID="RowStyle">\n`;
      headers.forEach(h => {
        const val = row[h] !== undefined ? String(row[h]) : '';
        const isNumeric = val !== '' && !isNaN(val) && !isNaN(parseFloat(val)) && !val.includes('-') && !val.includes('+');
        const cellType = isNumeric ? 'Number' : 'String';
        xml += `    <Cell><Data ss:Type="${cellType}">${escapeXml(val)}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;
    });

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
  }
}

module.exports = { LISExporter };
