---
name: assemble-smm-pack
description: Prosedur teknis otomatis untuk merakit paket dokumen Sistem Manajemen Mutu (SMM) ISO 15189:2022 siap-cetak berbasis konfigurasi tenant faskes/lab.
---

# Skill: Assemble SMM Pack (ISO 15189:2022)

Skill ini digunakan untuk mengompilasi modul-modul SMM klausul ISO 15189:2022 menjadi satu bundel dokumen resmi ber-kop instansi secara otomatis dan idempoten.

## Prasyarat
- Konfigurasi tenant faskes berada di `config/tenant.<nama-tenant>.json`.
- Pustaka template SMM berbasis klausul berada di `templates/smm/iso15189/`.

## Langkah Eksekusi

### 1. Perakitan Programatik (Node.js)
```javascript
const { SMMPackAssembler } = require('../../../lib/assembler/smm_pack_assembler');
const fs = require('fs');

const assembler = new SMMPackAssembler();
const tenantConfig = JSON.parse(fs.readFileSync('config/tenant.klinik-medika.json', 'utf8'));

// Opsi kustomisasi tata letak (opsional)
const layoutOverride = {
  header_kop: {
    logo_position: 'left', // 'left' | 'center' | 'right' | 'dual'
    divider_line_style: 'double'
  }
};

const result = assembler.assembleHtmlPackage(tenantConfig, layoutOverride);
fs.writeFileSync('artifacts/smm_bundles/smm_bundle_output.html', result.html_bundle, 'utf8');
console.log(`Paket SMM tersimpan: ${result.total_modules} modul dikompilasi.`);
```

### 2. Validasi Kepatuhan Klausul (Compliance Check)
Sebelum merilis ke klien, jalankan evaluasi otomatis:
```javascript
const { ISO15189Checker } = require('../../../lib/compliance/iso15189_checker');
const checker = new ISO15189Checker();
const report = checker.evaluatePackage(result.documents);
console.log(`Skor Kesiapan: ${report.overall_score}% - Status: ${report.status}`);
```

## Aturan Kepatuhan & IP (§4.1 & §4.2)
- Tidak boleh menyertakan nama instansi/ID AVA pada template inti (`OWNED_BY: generic`).
- Setiap halaman wajib memuat Kotak Kendali Dokumen Mutu Standar (No. Dokumen, Edisi/Revisi, Tanggal Berlaku, Penanggung Jawab).
