# Changelog & Riwayat Versi Master Test Catalog

> **Format Versi:** `vMAJOR.MINOR.PATCH-YYYYMMDD`  
> **Status:** Siap-LIS / Siap Lisensi B2B • Terverifikasi ISO 15189:2022 & HL7/FHIR

---

## [v1.0.0-20261010] — 10 Oktober 2026

### 📌 Ringkasan Rilis
- Ekstraksi dan restrukturisasi lengkap dari 532 produk pemeriksaan klinis menjadi **633 baris analit individual**.
- Pemisahan mutlak seluruh data harga privat AVA; hanya dataset acuan klinis generik netral yang disertakan (`OWNED_BY: generic`).
- Validasi kepatuhan 100% terhadap aturan integritas relasional data (§4.3 di `AGENTS.md`).

### ✨ Fitur & Format yang Didukung
1. **Pemisahan Kolom Rentang Rujukan**:
   - Kolom `Operator`, `Batas Bawah`, `Batas Atas`, `Jenis Nilai`, `Kelompok Usia`, dan `Jenis Kelamin` terpisah secara atomik untuk integrasi LIS/SIMRS tanpa pembersihan manual.
2. **Interoperabilitas Standar Internasional**:
   - Pemetaan **LOINC = OBX-3** pada seluruh analit kuantitatif & kualitatif.
   - Pemetaan **UCUM = OBX-6** untuk satuan ukur baku internasional (ISO/IEEE/HL7).
3. **Ekspor Multi-Format**:
   - `catalog_generic.csv` (146.3 KB)
   - `catalog_generic.tsv` (146.3 KB)
   - `catalog_generic.xls` (563.0 KB - Excel Spreadsheet XML resmi)
   - `catalog_hl7_spec_sample.md` (Spesifikasi integrasi LIS/FHIR)

### 📚 Hierarki Sumber Acuan Klinis (§4.2)
1. **Pedoman Nasional**: KMK No. HK.01.07/MENKES/1983/2022 (Standar Akreditasi Lab Klinik).
2. **Pedoman Klinis Internasional**:
   - American Diabetes Association (ADA 2024) untuk Glukosa & HbA1c.
   - National Kidney Foundation / KDIGO untuk Estimasi LFG & Kreatinin.
   - NCEP ATP III untuk Profil Lipid (Kolesterol, Trigliserida, HDL, LDL).
3. **Standar Konsensus Konsorsium**:
   - CLSI H20 & C28-A3 untuk batas rujukan hematologi dan kimia klinis.
4. **IFU Kit Reagen**:
   - Petunjuk penggunaan kit reagen analitis sebagai standar operasional spesifik alat/metode.
