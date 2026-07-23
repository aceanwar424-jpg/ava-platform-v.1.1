# OneLab — Fase 5: Kepatuhan & Ekspansi

> Induk: [ONELAB_ROADMAP.md](ONELAB_ROADMAP.md) · Sebelumnya: [Fase 4](ONELAB_FASE4.md)

**Kenapa fase ini terakhir.** Semuanya pekerjaan besar yang **bergantung pada fase sebelumnya**
dan sebagian butuh keputusan bisnis lebih dulu. Klaim BPJS mustahil tanpa diagnosis berkode
(Fase 3.3); Satu Sehat menuntut data kunjungan yang rapi; RIS menuntut modul tersendiri.

---

## 5.1 Satu Sehat (FHIR) Kemenkes

**Status sekarang.** Menu ada dan bertanda *soon*. Tidak ada kode sama sekali.

**Kenapa penting.** Integrasi Satu Sehat kini menjadi kewajiban bagi fasilitas pelayanan
kesehatan. Tanpa ini, fasilitas tidak memenuhi ketentuan interoperabilitas nasional.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Registrasi & kredensial | Daftar organisasi, dapatkan `client_id`/`secret`, kelola token |
| Pemetaan sumber daya FHIR | `Patient`, `Encounter`, `Condition`, `Observation` (hasil lab), `Procedure`, `Practitioner`, `Organization`, `Location` |
| Identitas | NIK pasien sebagai kunci; `patient_ids` di Admission sudah menyediakan strukturnya |
| Pengiriman | Kunjungan, diagnosis, hasil lab dikirim setelah divalidasi — bukan real-time per ketikan |
| Antrean & ulang kirim | Kegagalan jaringan masuk antrean, dicoba ulang, tercatat statusnya |
| Kode standar | LOINC untuk pemeriksaan lab, ICD-10 untuk diagnosis |

**Prasyarat.** Fase 3.3 (diagnosis ICD-10) dan data pemeriksaan yang sudah terkode.

---

## 5.2 Klaim BPJS / INA-CBG

**Status sekarang.** BPJS hanya muncul sebagai (a) pilihan cara bayar di Admission dan
(b) potongan 4% di penggajian. Tidak ada klaim.

**Dampak.** Selama belum ada, pendapatan dari pasien BPJS tidak dapat ditagihkan lewat sistem.

**Yang dikerjakan.**

- Verifikasi kepesertaan (VClaim) — cek nomor kartu, hak kelas, status aktif
- Rujukan masuk dan Surat Eligibilitas Peserta (SEP)
- Pemetaan tindakan & diagnosis ke **grouper INA-CBG**
- Berkas klaim beserta kelengkapan dokumen pendukung
- Pelacakan status: diajukan → verifikasi → disetujui / dikembalikan
- Rekonsiliasi pembayaran klaim ke piutang (Fase 4)

**Keputusan bisnis dulu.** Ini pekerjaan besar dan hanya masuk akal bila memang melayani pasien
BPJS dalam volume berarti.

---

## 5.3 RIS sebagai modul tersendiri

**Status sekarang.** `modules/radiology.js` — 393 baris, 11 fungsi, menyimpan hasil ke tabel
`lab_results`. Hanya unggah berkas dan cetak.

**Kenapa harus dipisah.** Selama volume kecil, menumpang di tabel lab masih bertahan. Tetapi
struktur itu tidak akan bisa menampung penjadwalan modalitas, alur baca radiolog, maupun PACS.

**Yang dikerjakan.**

| Bagian | Rincian |
|---|---|
| Order & penjadwalan | Pemesanan per modalitas (X-ray, USG, CT) dengan slot dan persiapan pasien |
| DICOM Modality Worklist | Identitas pasien terkirim ke alat, tidak diketik ulang — sumber utama salah pasien |
| PACS | Integrasi penyimpanan citra dan penampil DICOM, minimal tautan ke server citra |
| Alur baca | Antrean baca → penugasan radiolog → dibaca → diverifikasi → ditandatangani |
| Templat laporan | Per jenis pemeriksaan, dengan temuan terstruktur |
| Pembanding | Menampilkan pemeriksaan sebelumnya berdampingan |
| Temuan kritis | Notifikasi wajib-baca — pola yang sama dengan nilai kritis lab (Fase 1.3) |
| Dosis radiasi | Pencatatan per pemeriksaan, diperlukan untuk audit BAPETEN |

---

## 5.4 Laporan Kemenkes RL 1–5

**Status sekarang.** `modules/regulatory_reports.js` — 263 baris, 8 fungsi. Isinya pelacak tugas
pelaporan generik: mengingatkan bahwa laporan harus dibuat, tetapi tidak membuatkan laporannya.

**Yang dikerjakan.** Format RL 1–5 yang **terisi otomatis dari data**:

- RL 1 — data dasar fasilitas
- RL 2 — ketenagaan
- RL 3 — kegiatan pelayanan
- RL 4 — morbiditas & mortalitas (dari diagnosis ICD-10, Fase 3.3)
- RL 5 — pengunjung, kunjungan, dan 10 besar penyakit

Ekspor sesuai format yang diminta, beserta riwayat pengiriman.

---

## 5.5 LIS lanjutan

LIS sudah 80%. Sisanya adalah penyempurnaan yang membedakan lab bagus dari lab terakreditasi.

| Bagian | Kondisi sekarang | Yang ditambahkan |
|---|---|---|
| **Autoverifikasi** | Semua hasil divalidasi manual | Aturan: hasil normal, delta check aman, QC hari itu lolos → keluar otomatis. Analis fokus pada yang menyimpang |
| **Antarmuka alat** | Parser HL7/ASTM lewat **tempel manual** | Sambungan langsung (TCP/serial bridge) dua arah: order ke alat, hasil masuk sendiri |
| **Levey-Jennings & Westgard** | QC tercatat + verdict sederhana | Grafik kendali dan penerapan aturan Westgard otomatis; blokir input hasil bila QC hari itu gagal |
| **Rujukan lab luar** | Tidak ada | Alur pemeriksaan yang dirujuk: kirim, lacak, terima hasil, hitung marginnya |
| **Kriteria penolakan** | Teks bebas | Daftar pilih terstandar: hemolisis, lipemik, ikterik, volume kurang, salah wadah, tanpa identitas |
| **Penyimpanan spesimen** | Tidak ada | Lokasi simpan (rak/freezer), masa simpan, dan pemusnahan |
| **Eskalasi TAT** | Waktu terpantau | Peringatan otomatis ke SPV saat target terlampaui; prioritas cito |

---

## 5.6 Multi-cabang / unit

**Masalah.** Semua data menyatu tanpa konsep cabang. Bila OneLab beroperasi di lebih dari satu
lokasi, tidak ada cara memisahkan stok, pendapatan, antrian, maupun hak akses per cabang.

**Yang dikerjakan.**

- Entitas cabang/unit dan penandaan cabang pada transaksi
- Hak akses per cabang (bergantung Fase 1.1)
- Stok per cabang (memanfaatkan gudang dari Fase 2.6)
- Laporan konsolidasi dan per cabang

**Catatan.** Menambahkan ini setelah data besar jauh lebih mahal daripada merancangnya lebih
awal. Bila ekspansi cabang sudah pasti, pertimbangkan memajukan sebagian pekerjaannya ke Fase 2.

---

## Skema yang dibutuhkan

Berkas migrasi: `supabase_fase5_kepatuhan.sql`

```sql
-- Satu Sehat
CREATE TABLE IF NOT EXISTS satusehat_mappings (local_type, local_id, fhir_resource,
                                               fhir_id, last_synced_at, status, ...);
CREATE TABLE IF NOT EXISTS satusehat_queue    (payload, resource_type, attempts,
                                               status, error, ...);

-- BPJS
CREATE TABLE IF NOT EXISTS bpjs_sep    (admission_id, sep_number, card_number,
                                        referral_no, issued_at, ...);
CREATE TABLE IF NOT EXISTS bpjs_claims (sep_id, inacbg_code, tariff, status,
                                        submitted_at, paid_at, ...);

-- RIS
CREATE TABLE IF NOT EXISTS radiology_orders  (patient_id, modality, procedure_code,
                                              scheduled_at, status, ...);
CREATE TABLE IF NOT EXISTS radiology_reports (order_id, findings, impression,
                                              radiologist, read_at, signed_at, ...);
CREATE TABLE IF NOT EXISTS radiology_dose    (order_id, dose_value, unit, ...);

-- LIS lanjutan
CREATE TABLE IF NOT EXISTS autoverify_rules  (product_id, condition, action, ...);
CREATE TABLE IF NOT EXISTS referral_labs     (name, contact, price_list, ...);
CREATE TABLE IF NOT EXISTS referred_tests    (sample_id, referral_lab_id, sent_at,
                                              result_at, cost, price, ...);
CREATE TABLE IF NOT EXISTS specimen_storage  (sample_id, location, stored_at,
                                              expires_at, disposed_at, ...);

-- multi cabang
CREATE TABLE IF NOT EXISTS branches (code, name, address, ...);
```

---

## Definisi selesai

- [ ] Kunjungan, diagnosis, dan hasil lab terkirim ke Satu Sehat dan statusnya terlacak
- [ ] Pasien BPJS bisa dibuatkan SEP dan klaimnya diajukan dari dalam sistem
- [ ] Pemeriksaan radiologi dijadwalkan, identitas terkirim ke alat, dan dibaca lewat alur bertanda tangan
- [ ] Laporan RL 1–5 terisi otomatis dari data, bukan diketik ulang
- [ ] Hasil normal dengan QC lolos keluar otomatis tanpa validasi manual
- [ ] Hasil dari analyzer masuk tanpa salin-tempel
- [ ] Laporan bisa ditampilkan per cabang dan konsolidasi

## Risiko fase ini

| Risiko | Penanganan |
|---|---|
| Satu Sehat & BPJS punya spesifikasi yang berubah | Rancang lapisan pemetaan terpisah agar perubahan tidak menyentuh modul inti |
| Autoverifikasi meloloskan hasil yang seharusnya ditinjau | Mulai dari sedikit parameter paling stabil; catat semua yang lolos otomatis untuk ditinjau berkala |
| PACS/DICOM butuh infrastruktur di luar aplikasi web | Putuskan lebih dulu: server citra sendiri atau layanan pihak ketiga |
| Multi-cabang terlambat dirancang | Bila ekspansi sudah pasti, majukan sebagian ke Fase 2 |
