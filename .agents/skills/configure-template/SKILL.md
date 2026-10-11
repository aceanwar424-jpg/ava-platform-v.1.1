---
name: configure-template
description: Prosedur kustomisasi tata letak deklaratif untuk kop, posisi logo, kolom tabel hasil, margin, dan tanda tangan digital QR TTE.
---

# Skill: Configure Document & Lab Result Templates

Skill ini digunakan untuk mengonfigurasi tata letak visual lembar E-Hasil laboratorium dan dokumen Sistem Manajemen Mutu (SMM).

## Opsi Utama Template
- **Logo Kop**: `left`, `center`, `right`, `dual` (kiri faskes, kanan akreditasi KAN/partner).
- **Tabel Hasil Lab**: Kolom dapat diaktifkan/dinonaktifkan (`enabled: true/false`), diatur persentase lebar (`width_pct`), perataan (`align`), dan highlight nilai abnormal.
- **Tanda Tangan**: QR Code TTE BSrE tersertifikasi, posisi (`right`, `center`, `left`), nama dokter Sp.PK, nomor SIP.

## Contoh Kode Eksekusi Cepat
```javascript
const { TemplateManager } = require('../../../lib/template_engine/template_manager');
const { ConfigurableDocGenerator } = require('../../../lib/template_engine/configurable_doc_generator');

const tm = new TemplateManager();
const generator = new ConfigurableDocGenerator();

// Pilih preset dan timpa parsial
const customConfig = tm.createQuickConfig({
  preset: 'dual_logo_partnership',
  primary_color: '#0f2963',
  hidden_columns: ['method'],
  enable_specimen_column: true
});

const htmlHasil = generator.renderLabResultHtml(patientData, analytesList, tenantConfig, customConfig);
```

## Penggunaan Visual
Buka [tools/template_configurator.html](file:///d:/AVAQUEEN-platform-main/tools/template_configurator.html) langsung di browser untuk mengatur slider dan melihat preview A4 secara interaktif.
