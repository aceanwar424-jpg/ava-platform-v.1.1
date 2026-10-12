# CHECKLIST ONBOARDING & VALIDASI MENU TES KLIEN (LIS CATALOG GAP ANALYSIS)
**Prosedur Standar Penyesuaian Katalog Master Generik ke Operasional Laboratorium Klien**

> **OWNED_BY: generic / operational guide**  
> Digunakan oleh tim implementasi LIS saat pertama kali melakukan onboarding klien laboratorium / klinik baru.

---

## 1. Prinsip Operasional & Hierarki Acuan (§4.2 AGENTS.md)

Saat memasang Master Test Catalog ke sistem klien:
1. **Aturan Kunci Join:** Nilai kolom `Kode Material` dan `Nama Pemeriksaan` dari Master Catalog tidak boleh diubah jika menggunakan schema join relasional bawaan.
2. **Hierarki Sumber Nilai Rujukan (Wajib Dipatuhi):**
   - **Tingkat 1:** Pedoman Nasional Kemenkes RI (PMK relevan).
   - **Tingkat 2:** Pedoman Klinis Asosiasi Spesialis (PDS PatKLIn, PERKENI, PAPDI).
   - **Tingkat 3:** Konsensus Internasional (CLSI, IFCC, ADA, ATA).
   - **Tingkat 4:** **IFU (Instructions for Use / Package Insert) Kit Reagen yang Dibeli Lab Klien Sebagai Standar Operasional yang Mengikat**.

---

## 2. Formulir Checklist Onboarding Klien

### Bagian A: Informasi Faskes & Profil Operasional
- [ ] Nama Faskes / Laboratorium Klien: _____________________________________________
- [ ] Tipe Faskes: [ ] Lab Mandiri Swasta  [ ] Klinik Pratama  [ ] Klinik Utama  [ ] Rumah Sakit (Tipe: ____)
- [ ] Penanggung Jawab Laboratorium (dr. Sp.PK): _____________________________________
- [ ] Nomor SIP Sp.PK: ___________________________________________________________
- [ ] Database LIS Klien: [ ] PostgreSQL  [ ] MySQL / MariaDB  [ ] MS SQL Server  [ ] Oracle
- [ ] Status Akreditasi: [ ] Belum Akreditasi  [ ] Menuju ISO 15189:2022  [ ] KAN LP/LK Aktif

---

### Bagian B: Inventarisasi Instrumen / Analyzer Klien
Catat seluruh instrumen yang akan diintegrasikan ke LIS:

| No | Merk & Tipe Analyzer | Parameter Uji Utama | Protokol Komunikasi | Port / Koneksi Fisik |
| :- | :------------------- | :------------------ | :------------------ | :------------------- |
| 1  | misal: Sysmex XN-350 | Hematologi Lengkap  | ASTM E1381/E1394    | TCP/IP (Ethernet)    |
| 2  | misal: Mindray BS-240| Kimia Klinik        | HL7 v2 / ASTM       | RS-232 (Serial DB9)  |
| 3  | misal: Cobas e411    | Imunologi / Hormon  | ASTM E1381/E1394    | RS-232 (Serial DB9)  |
| 4  | misal: Urised / Dirui| Urinalisis          | Serial / ASCII      | RS-232               |

---

### Bagian C: Matriks Gap Analysis Menu Tes & Verifikasi IFU Reagen

Lakukan *reconcile* antara menu tes rutin klien dengan Master Catalog 633 analit:

- [ ] **Langkah 1:** Minta daftar menu pemeriksaan aktif klien (beserta merk kit reagen yang dipakai).
- [ ] **Langkah 2:** Bandingkan dengan file `data/catalog/catalog_generic.csv`.
- [ ] **Langkah 3:** Verifikasi Nilai Rujukan terhadap IFU reagen vendor klien:

| Nama Tes Klien | Analit Master Catalog | Kode LOINC | Rentang Master | Rentang IFU Reagen Klien | Status Reconcile |
| :--- | :--- | :---: | :---: | :---: | :---: |
| Glukosa Puasa  | GLUKOSA PUASA         | `1558-6`   | 70 - 100 mg/dL | 74 - 106 mg/dL (Hexokinase) | [ ] MATCH [x] ADJUST IFU |
| Kolesterol Total| KOLESTEROL TOTAL     | `2093-3`   | 0 - 200 mg/dL  | 0 - 200 mg/dL (CHOD-PAP)    | [x] MATCH [ ] ADJUST IFU |
| Asam Urat (L)  | ASAM URAT             | `3084-1`   | 3.5 - 7.2 mg/dL| 3.4 - 7.0 mg/dL (Uricase)   | [ ] MATCH [x] ADJUST IFU |
| Kreatinin      | KREATININ             | `2160-0`   | 0.6 - 1.2 mg/dL| 0.67 - 1.17 mg/dL (Jaffe)   | [ ] MATCH [x] ADJUST IFU |

- [ ] **Langkah 4:** Tandai analit yang memerlukan penyesuaian nilai rujukan lokal pada file override klien: `config/tenant.<client-name>.catalog_overrides.json`.

---

### Bagian D: Verifikasi Ambang Batas Nilai Kritis (*Panic Ranges*)
- [ ] Konfirmasi 12 parameter gawat darurat klinis bersama Dokter Penanggung Jawab (Sp.PK) klien:
  - [ ] Hemoglobin: Bawah ≤ 7.0 g/dL | Atas ≥ 20.0 g/dL
  - [ ] Trombosit: Bawah ≤ 20.000 /µL | Atas ≥ 1.000.000 /µL
  - [ ] Leukosit: Bawah ≤ 2.000 /µL | Atas ≥ 30.000 /µL
  - [ ] Glukosa: Bawah ≤ 45 mg/dL | Atas ≥ 450 mg/dL
  - [ ] Kalium: Bawah ≤ 2.8 mmol/L | Atas ≥ 6.2 mmol/L
  - [ ] Natrium: Bawah ≤ 120 mmol/L | Atas ≥ 160 mmol/L
- [ ] Verifikasi alur TBaK (Tulis, Baca, Konfirmasi) dan SLA pelaporan (< 30 menit).

---

### Bagian E: Tanda Tangan Persetujuan Konfigurasi

Disetujui oleh:

**Dokter Penanggung Jawab Lab Klien**  
Nama: ________________________________  
Tanggal: ____ / ____ / 2026  
Tanda Tangan: _________________________  

**Lead Implementasi Solusi LIS**  
Nama: ________________________________  
Tanggal: ____ / ____ / 2026  
Tanda Tangan: _________________________  
