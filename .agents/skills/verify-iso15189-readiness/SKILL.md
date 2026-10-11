---
name: verify-iso15189-readiness
description: Prosedur evaluasi kesiapan audit akreditasi laboratorium ISO 15189:2022 & KAN LP/LK secara otomatis lintas 12 klausul kunci.
---

# Skill: Verify ISO 15189:2022 Readiness (Audit KAN LP/LK)

Skill ini digunakan untuk melakukan evaluasi kesiapan audit akreditasi laboratorium medis berbasis standar ISO 15189:2022 edisi terkini, memvalidasi pemenuhan 12 klausul inti, dan mendeteksi kesenjangan (gap analysis) secara programatik sebelum asesmen eksternal KAN (Komite Akreditasi Nasional).

---

## Matriks 12 Klausul Inti ISO 15189:2022

| No | Klausul | Nama Klausul | Dokumen Acuan Standar |
|---|---|---|---|
| 1 | 4.1 | Ketidakberpihakan & Kerahasiaan Informasi | SK Kebijakan Ketidakberpihakan (`SMM_L1_001`) |
| 2 | 5.1 | Persyaratan Badan Hukum & Tata Kelola Lab | Pedoman Tata Kelola Klinik & Pj Lab (`SMM_L1_002`) |
| 3 | 6.2 | Kompetensi Personel, STR/SIP & Pelatihan | SOP Kredensial & Kaji Ulang SDM (`SMM_L2_001`) |
| 4 | 6.4 | Keterlacakan Kalibrasi & Pemeliharaan Alat | SOP Kalibrasi & Pemeliharaan Alat (`SMM_L2_002`) |
| 5 | 6.6 | Pengelolaan Reagen & Bahan Habis Pakai (CLSI EP26-A) | SOP Reagen, Lot-to-Lot, Cold Chain (`SMM_L2_007`) |
| 6 | 7.2 | Proses Pra-Analitik & Kriteria Penolakan | SOP Flebotomi, Aksesi, Rejection (`SMM_L2_003`) |
| 7 | 7.3 | Proses Pemeriksaan, Verifikasi Metode & PMI/PME | SOP Kontrol Mutu IQC & EQA (`SMM_L2_004`) |
| 8 | 7.3.7| Autoverifikasi Hasil & Sistem Uji Delta (CLSI AUTO10-A) | SOP Autoverifikasi & Delta Check (`SMM_L2_008`) |
| 9 | 7.4 | Pasca-Analitik & Pelaporan Nilai Kritis (SLA < 30m) | SOP Nilai Kritis & Validasi Sp.PK (`SMM_L2_005`) |
| 10| 7.5 | Retensi Spesimen Pasca-Analitik & Limbah Medis B3 | SOP Retensi Spesimen & Limbah B3 (`SMM_L2_009`) |
| 11| 8.2 | Pengendalian Dokumen Mutu & Pengarsipan | WI Pengendalian Dokumen Mutu (`SMM_L3_001`) |
| 12| 8.5 | Manajemen Risiko, IKP & Tindakan Korektif (CAPA) | SOP Risk Register, IKP, CAPA (`SMM_L2_006`) |

---

## Eksekusi Evaluasi Kesiapan Programatik

Jalankan evaluasi kepatuhan menggunakan engine compliance checker bawaan:

```javascript
const { ISO15189Checker } = require('../../../lib/compliance/iso15189_checker');
const fs = require('fs');

const checker = new ISO15189Checker();
const targetDocumentText = fs.readFileSync('path/to/dokumen_smm_gabungan.md', 'utf8');

const report = checker.evaluateDocument(targetDocumentText, {
  title: 'Audit Kesiapan Lab Medika',
  doc_number: 'AUDIT-2026-001'
});

console.log(`Skor Kesiapan: ${report.compliance_score}%`);
console.log(`Status Audit: ${report.is_compliant ? 'AUDIT READY (LOLOS)' : 'NEEDS REVISION (KTS DETECTED)'}`);

// Daftar Temuan & Klausul yang belum terpenuhi (Gap)
if (report.gap_count > 0) {
  console.warn(`Ditemukan ${report.gap_count} klausul yang belum lengkap:`);
  report.findings.filter(f => f.status !== 'FULFILLED').forEach(f => {
    console.warn(`- Klausul ${f.clause_code} (${f.clause_title}): Status ${f.status}`);
  });
}
```

---

## Kriteria Lolos Audit Kesiapan (Definition of Ready)
1. **Skor Kepatuhan:** Minimal 100% dari 12 klausul kunci berstatus `FULFILLED`.
2. **Bebas Kontradiksi:** Tidak ada bendera `CONTRADICTED` akibat frasa negasi terdeteksi.
3. **Netralitas IP:** Seluruh template berstatus `OWNED_BY: generic` tanpa kebocoran data rahasia instansi/klien lain.
4. **Jejak Audit ISO:** Tersedia tanggal revisi, nomor dokumen, dan pengesahan Direktur / Pj Laboratorium.
