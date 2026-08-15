# OneLab — Fase 3: Rekam Medis & Alur Klinik

> Induk: [ONELAB_ROADMAP.md](ONELAB_ROADMAP.md) · Sebelumnya: [Fase 2](ONELAB_FASE2.md) · Berikutnya: [Fase 4](ONELAB_FASE4.md)

**Kenapa fase ini.** Rekam medis adalah inti SIMRS, dan saat ini modulnya hanya **289 baris
dengan 5 fungsi**: cari pasien, muat, tampilkan, cetak. Tidak ada satu pun cara untuk *menulis*
catatan klinis. Tanpa ini, klaim tidak bisa disusun (Fase 5.2) dan kesinambungan perawatan
tidak terdokumentasi.

Yang sudah kuat dan jadi pijakan: **Admission** (51 fungsi — identitas, kode pos, keluarga,
korporat, paket, voucher, baris layanan, label sampel) dan **Anamnesa** (keluhan + ICD + label).

---

## 3.1 Rekam medis bisa ditulis (SOAP / CPPT)

**Masalah.** `modules/medrecord.js` hanya membaca `admissions`, `anamnesas`, dan `lab_results`
lalu mencetaknya. Dokter tidak punya tempat menulis di dalam sistem.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Catatan SOAP | Subjective, Objective, Assessment, Plan — per kunjungan, per pemberi asuhan |
| CPPT | Catatan Perkembangan Pasien Terintegrasi: satu lini masa yang diisi dokter, perawat, analis, gizi — masing-masing dengan peran & waktunya |
| Tanda tangan | Catatan yang sudah ditandatangani terkunci; koreksi dibuat sebagai adendum, bukan menimpa |
| Templat | Templat per jenis layanan agar pengisian cepat dan seragam |

**Aturan penting.** Rekam medis tidak boleh bisa dihapus atau diedit diam-diam. Setiap perubahan
menyisakan jejak (bergantung Fase 1.5).

---

## 3.2 Daftar masalah, alergi, tanda vital + tren

**Masalah.** Anamnesa mencatat keluhan per kunjungan, tetapi informasi yang seharusnya
**menempel di pasien** — alergi, penyakit kronis, riwayat operasi — ikut terkubur per kunjungan.
Petugas harus membuka kunjungan lama satu per satu.

**Yang dikerjakan.**

- **Daftar alergi** tingkat pasien, tampil menonjol di setiap layar klinis. Ini pengaman
  keselamatan, bukan sekadar data.
- **Daftar masalah aktif** (diagnosis kronis yang sedang berjalan) beserta status
  aktif/teratasi.
- **Tanda vital terstruktur** — bukan teks bebas. Home Care sudah punya polanya
  (`homecare_visit_records`: TD, nadi, suhu, napas, SpO₂, berat); pola yang sama dipakai untuk
  rawat jalan.
- **Grafik tren** untuk parameter berulang: tekanan darah, berat, HbA1c, kolesterol.
  Berlaku juga untuk hasil lab (menutup kebutuhan di audit LIS).

---

## 3.3 Diagnosis berkode ICD-10 oleh dokter

**Masalah.** Tabel `icd_diagnostics` sudah ada dan dipakai di Anamnesa, tetapi belum menjadi
alur diagnosis resmi: belum ada pembedaan diagnosis utama vs sekunder, dan belum tersimpan
sebagai bagian rekam medis yang bisa ditarik untuk klaim maupun pelaporan.

**Yang dikerjakan.**

- Pencarian ICD-10 yang cepat (kode atau istilah Indonesia)
- Penandaan **diagnosis utama** dan **sekunder** per kunjungan
- Diagnosis tersimpan di rekam medis, bukan hanya di catatan anamnesa
- Menjadi sumber untuk: klaim BPJS (Fase 5.2), laporan RL Kemenkes (Fase 5.4), dan statistik
  10 penyakit terbanyak

---

## 3.4 Garis waktu kunjungan pasien

**Masalah.** Riwayat pasien tersebar di beberapa tabel dan modul. Tidak ada satu layar yang
menjawab "apa saja yang pernah terjadi pada pasien ini".

**Yang dikerjakan.** Satu lini masa yang menggabungkan: pendaftaran, anamnesa, catatan SOAP,
hasil lab, hasil radiologi, pemeriksaan penunjang, kunjungan Home Care, resep (bila kelak ada),
dan pembayaran — terurut waktu, bisa disaring per jenis.

---

## 3.5 Antrian bernomor + layar panggil

**Masalah.** Kata "antrian" di kode hanya muncul sebagai label hitungan pendaftaran hari ini
(`Total Antrian` di Anamnesa). Tidak ada nomor antrian, tidak ada urutan panggil, tidak ada
layar tunggu.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Nomor antrian | Terbit saat pendaftaran, per jenis layanan (Lab / Radiologi / Dokter) |
| Papan panggil | Halaman layar penuh untuk TV ruang tunggu — nomor sekarang & berikutnya |
| Panggil ulang | Tombol panggil ulang dan lewati bila pasien tidak hadir |
| Estimasi tunggu | Dari rata-rata waktu layanan per loket |

---

## 3.6 Perjanjian / booking + pengingat

**Masalah.** Semua pasien saat ini datang langsung. Tidak ada cara memesan waktu, padahal
Home Care sudah punya konsep jadwal dan deteksi bentrok yang bisa ditiru.

**Yang dikerjakan.**

- Slot waktu per layanan & per sumber daya (dokter, alat, ruang)
- Pemesanan oleh petugas; tautan konfirmasi via WA
- Pengingat H-1 otomatis (pola pesan WA sudah dipakai di Home Care)
- Kehadiran tercatat: hadir / tidak hadir / batal, untuk mengukur tingkat mangkir

---

## Skema yang dibutuhkan

Berkas migrasi: `supabase_fase3_rekam_medis.sql`

```sql
-- catatan klinis
CREATE TABLE IF NOT EXISTS clinical_notes (
  patient_id, admission_id, note_type,        -- SOAP | CPPT | adendum
  subjective, objective, assessment, plan,
  author_name, author_role, signed_at, locked, ...
);

-- menempel di pasien, bukan per kunjungan
CREATE TABLE IF NOT EXISTS patient_allergies (patient_id, allergen, reaction, severity, ...);
CREATE TABLE IF NOT EXISTS patient_problems  (patient_id, icd_code, diagnosis, status, onset_date, ...);
CREATE TABLE IF NOT EXISTS vital_signs       (patient_id, admission_id, systolic, diastolic,
                                              pulse, temperature, resp_rate, spo2, weight, height, ...);

-- diagnosis resmi per kunjungan
CREATE TABLE IF NOT EXISTS encounter_diagnoses (admission_id, icd_code, diagnosis, is_primary, ...);

-- antrian & perjanjian
CREATE TABLE IF NOT EXISTS queue_tickets (queue_number, service_type, status, called_at, ...);
CREATE TABLE IF NOT EXISTS appointments   (patient_id, service_type, resource, scheduled_at,
                                           status, reminder_sent_at, ...);
```

---

## Definisi selesai

- [ ] Dokter bisa menulis catatan SOAP dan menandatanganinya dari dalam sistem
- [ ] Alergi pasien tampil otomatis di setiap layar klinis pasien tersebut
- [ ] Tekanan darah dan HbA1c pasien kronis bisa dilihat sebagai grafik tren
- [ ] Setiap kunjungan punya diagnosis utama berkode ICD-10
- [ ] Satu layar menampilkan seluruh riwayat pasien lintas modul
- [ ] Pasien mendapat nomor antrian dan terpanggil lewat layar ruang tunggu
- [ ] Pasien bisa dijadwalkan dan menerima pengingat H-1

## Risiko fase ini

| Risiko | Penanganan |
|---|---|
| Rekam medis elektronik menuntut kepatuhan hukum | Kunci setelah tanda tangan + adendum, jangan izinkan edit bebas (butuh Fase 1.5) |
| Dokter enggan mengetik saat praktik ramai | Sediakan templat per layanan; ukur waktu pengisian sebelum diperluas |
| Identitas pasien ganda merusak lini masa | Rapikan penggabungan data pasien lebih dulu — `patient_ids` sudah ada di Admission |
