---
name: validate-catalog
description: Prosedur validasi otomatis integritas relasional, LOINC (OBX-3), UCUM (OBX-6), dan audit acuan Master Test Catalog siap-LIS.
---

# Skill: Validate Master Test Catalog (Siap-LIS)

Skill ini digunakan untuk memvalidasi bahwa dataset katalog tes memenuhi seluruh **Deny Rules integritas data (§4.3 di AGENTS.md)** sebelum diekspor atau dilisensikan ke LIS/SIMRS klien.

## Aturan Integritas Data Wajib (§4.3)
1. **Kunci Relasional**: `Kode Material` dan `Nama Pemeriksaan` adalah kunci join immutable (tidak boleh diubah/hilang).
2. **Pemeriksaan Panel**: Panel (misal CBC, Urinalisis, Profil Lipid) wajib dipecah menjadi baris analit individual.
3. **Pemisahan Rentang Rujukan**: Variabel reference range wajib terpisah ke kolom individual:
   - `Operator` (`<`, `>`, `<=`, `>=`, `BETWEEN`, `-`)
   - `Batas Bawah`
   - `Batas Atas`
   - `Jenis Nilai` (`Kuantitatif` / `Kualitatif`)
   - `Kelompok Usia` & `Jenis Kelamin`
4. **Interoperabilitas HL7/FHIR**:
   - `LOINC (OBX-3)`: Kode LOINC terstandarisasi (format: `1234-5`).
   - `UCUM (OBX-6)`: Satuan ukur standar UCUM (misal `mg/dL`, `g/dL`, `U/L`, `%`).

## Langkah Eksekusi

### 1. Validasi File CSV/TSV
```javascript
const { CatalogValidator } = require('../../../lib/validator/catalog_validator');
const fs = require('fs');

const validator = new CatalogValidator();
const csvData = fs.readFileSync('data/catalog/catalog_generic.csv', 'utf8');

const result = validator.validate(csvData);
console.log('Status Valid:', result.is_valid);
console.log('Total Baris:', result.total_rows);
if (!result.is_valid) {
  console.error('Critical Errors:', result.errors);
}
```

### 2. Ekspor ke Multi-Format
```javascript
const { LISExporter } = require('../../../lib/exporter/lis_exporter');
const exporter = new LISExporter();

// Ekspor ke CSV / TSV / Excel XML (.xls) / HL7 Spec
const xlsContent = exporter.export(result.rows, { format: 'excel_xml' });
fs.writeFileSync('data/catalog/catalog_generic.xls', xlsContent, 'utf8');
```
