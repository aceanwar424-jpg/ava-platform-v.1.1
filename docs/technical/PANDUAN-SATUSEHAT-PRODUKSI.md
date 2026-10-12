# PANDUAN PENGAJUAN KREDENSIAL PRODUKSI SATUSEHAT KEMENKES RI
**Prosedur Administratif, Verifikasi Faskes & Aktivasi Bridging Laboratorium (PMK 24/2022)**

> **OWNED_BY: generic / regulatory guide**  
> Ditujukan untuk: Penanggung Jawab Faskes, Bagian Rekam Medis / SIMRS, dan Compliance Officer.

---

## 1. Landasan Hukum & Mandat Integrasi
Sesuai **Permenkes No. 24 Tahun 2022 tentang Rekam Medis Elektronik (RME)**:
- Seluruh Fasilitas Pelayanan Kesehatan (Puskesmas, Klinik, Rumah Sakit, dan Laboratorium Kesehatan Mandiri) wajib menyelenggarakan RME dan terhubung ke platform SATUSEHAT Kemenkes RI.
- Data hasil pemeriksaan penunjang laboratorium wajib dikirim dalam format standar **HL7 FHIR R4** menggunakan terminologi baku **LOINC** dan **UCUM**.

---

## 2. Syarat Dokumen Administratif Faskes
Sebelum mengajukan API Key Produksi, faskes wajib menyiapkan dokumen resmi:
1. **Surat Izin Operasional Faskes** yang masih berlaku (dari Dinas Kesehatan / PTSP / OSS).
2. **Kode Faskes Kemenkes RI:**
   - Untuk Klinik: Kode Faskes dari Registrasi Klinik (*registrasiklinik.kemkes.go.id*).
   - Untuk RS: Kode RS dari SIRS (*sirs.kemkes.go.id*).
   - Untuk Lab Mandiri: Registrasi Laboratorium Kesehatan.
3. **Surat Penunjukan Penanggung Jawab RME & Narahubung Teknis** yang ditandatangani oleh Pimpinan Faskes bermeterai Rp 10.000.
4. **Pakta Integritas Kerahasiaan Data Medis** sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

---

## 3. Langkah-Langkah Pengajuan Melalui Portal Kemenkes DTO

### Tahap 1: Pendaftaran Akun Faskes di Portal SATUSEHAT
1. Akses portal resmi: `https://satusehat.kemkes.go.id/platform`.
2. Login menggunakan akun penanggung jawab faskes atau buat akun baru.
3. Daftarkan profil fasilitas kesehatan dan masukkan Kode Registrasi Faskes Kemenkes.

### Tahap 2: Pengujian Integrasi di Environment Sandbox (Staging)
1. DTO Kemenkes akan menerbitkan kredensial Sandbox:
   - `Sandbox Client ID`
   - `Sandbox Client Secret`
   - `Organization ID` Faskes
2. Masukkan kredensial ke adapter LIS kita (`lib/interop/satusehat_client.js`).
3. Jalankan pengujian 4 resource wajib:
   - `ServiceRequest` (Order Lab DPJP)
   - `Specimen` (Spesimen Darah / Urin)
   - `Observation` (Hasil Uji Analit berbasis LOINC & UCUM)
   - `DiagnosticReport` (Laporan Hasil Kumulatif ber-TTE)
4. Pastikan transaksi di Sandbox berhasil dengan respons HTTP `201 Created`.

### Tahap 3: Pengajuan Verifikasi & Pelolosan (*Go-Live Production*)
1. Masuk ke menu *Request Production Access* di portal SATUSEHAT.
2. Unggah bukti transaksi sukses di Sandbox (Request payload & Response ID dari Kemenkes).
3. Unggah Pakta Integritas dan Surat Permohonan Go-Live.
4. Tim DTO Kemenkes akan melakukan verifikasi administratif dalam waktu 3–7 hari kerja.
5. Setelah disetujui, `Production Client ID` dan `Production Client Secret` akan aktif di dashboard faskes.

---

## 4. Konfigurasi Pada Sistem LIS AVAQUEEN Platform

Setelah kredensial produksi diperoleh:
1. Buka file konfigurasi tenant faskes klien (misal: `config/tenant.<client-name>.json`).
2. Masukkan parameter produksi:
   ```json
   {
     "satusehat": {
       "simulation_mode": false,
       "base_url": "https://api-satusehat.kemkes.go.id/fhir-r4/v1",
       "auth_url": "https://api-satusehat.kemkes.go.id/oauth2/v1",
       "client_id": "MASUKKAN_PRODUCTION_CLIENT_ID_KEMENKES",
       "client_secret": "MASUKKAN_PRODUCTION_CLIENT_SECRET_KEMENKES",
       "organization_id": "MASUKKAN_ORGANIZATION_ID_FASKES"
     }
   }
   ```
3. LIS akan otomatis melakukan *token exchange* setiap 60 menit dan menyinkronkan seluruh hasil laboratorium terverifikasi ke satu database rekam medis nasional SATUSEHAT.
