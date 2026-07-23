# Arsip Migrasi SQL

Seluruh berkas di sini **sudah dijalankan** di basis data Supabase produksi
(diverifikasi 19 Juli 2026 dengan memeriksa keberadaan tabel dan fungsinya
lewat REST API, bukan berdasarkan catatan).

Berkas dipindahkan ke sini agar direktori utama tidak menumpuk. **Jangan dihapus** —
seluruh skema basis data dibuat manual lewat SQL Editor, sehingga berkas inilah
satu-satunya catatan bagaimana basis data terbentuk. Bila suatu saat perlu
membangun ulang dari nol, urutan di bawah adalah panduannya.

Seluruh migrasi bersifat **idempoten** (`IF NOT EXISTS`), jadi aman dijalankan ulang.

---

## Urutan pembangunan ulang dari nol

### 1. `01_fondasi_awal/` — skema dasar
`supabase_v2` → `supabase_v3_complete` → `supabase_full` → `supabase_update` →
`supabase_complete_fix` → `supabase_setup_all` → `new_modules_schema` → `supabase_new_modules`

### 2. `02_modul_lama/` — modul per fitur
Absensi, konfigurasi lab, LIS, penomoran surat, MCU, identitas pasien, produk,
diskon registrasi, manajemen tugas, wiki.

### 3. `06_seed_data/` — data awal
`supabase_seed_master` + `supabase_seed_part01..08` (produk & tes),
`supabase_postal_codes_data` (kode pos Indonesia).

> Berukuran besar (±8 MB). Jalankan setelah skema siap.

### 4. `03_agentic/` — modul Agentic AI
`supabase_agentic` → `fase12` → `fase34` → `fase5` → `fase6` → `fase6b` → `fase6c` →
`fase7` → `fase7b` → `fase7c` → `fase7f_it` → `fase7g_it` → `fase7h_lab` →
`fase7i_hr` → `fase7j_scm` → `fase7k_cleanup` → `fase7l_bizops` → `fase7m_clinical` →
`frameworks`

> `fase7m_clinical` menambah organ Pharmacy & Inpatient. Sifatnya menaikkan
> penanda saja — keputusan klinis tetap di tangan manusia.

### 5. `04_roadmap_fase/` — hasil audit fungsional (18–19 Juli 2026)

Urutan ini **wajib dipatuhi** karena fase berikutnya memakai fungsi dari fase sebelumnya:

| Urut | Berkas | Isi |
|---|---|---|
| 1 | `supabase_inventory_fase0.sql` | Dokumentasi skema inventory yang sebelumnya dibuat manual |
| 2 | `supabase_homecare_fase0.sql` | Master nakes & tarif |
| 3 | `supabase_fase1_fondasi.sql` | Nilai kritis lab, jejak audit |
| 4 | `supabase_fase1_rls_a.sql` | RLS: tutup akses tanpa login pada data pasien |
| 5 | `supabase_fase1_rls_a_fix.sql` | Perbaikan: kebijakan lama yang permisif membocorkan `patient_ids` |
| 6 | `supabase_fase1_rpc.sql` | Fungsi berwewenang & atomik — **prasyarat hampir semua fase berikutnya** |
| 7 | `supabase_fase1_rpc_fix.sql` | Perbaikan: `write_audit` sempat dapat dipanggil tanpa login |
| 8 | `supabase_fase1_rls_b.sql` | RLS per peran (klinis, keuangan, kepegawaian) |
| 9 | `supabase_inventory_fase2.sql` | Batch/kedaluwarsa, pengeluaran barang |
| 10 | `supabase_homecare_fase2.sql` | Dokumentasi kunjungan |
| 11 | `supabase_inventory_fase345.sql` | Retur pembelian |
| 12 | `supabase_homecare_fase345.sql` | Penagihan & kepuasan pasien |
| 13 | `supabase_fase2.sql` | Resep BHP, telusur lot, gudang, anggaran, faktur supplier |
| 14 | `supabase_fase3.sql` | Catatan klinis, alergi, tanda vital, antrian, perjanjian |
| 15 | `supabase_fase2b.sql` | Stok per lokasi, shift kas, jadwal kalibrasi |
| 16 | `supabase_fase5_lis.sql` | Autoverifikasi, rujukan lab luar |
| 17 | `supabase_fase4.sql` | Bagan akun, jurnal, buku besar, pusat biaya |
| 18 | `supabase_fase4b.sql` | Penggajian, PPh 21, saldo cuti |
| 19 | `supabase_fase5_ris.sql` | RIS & arsip citra PACS |
| 20 | `supabase_fase5_cabang.sql` | Fondasi multi-cabang |
| 21 | `supabase_icd_selaras.sql` | Perbaikan: `is_primary` dijadikan turunan `diagnose_type` |

> Berkas 21 membetulkan kekeliruan fase 3, yang menambahkan `is_primary` padahal
> antarmuka Anamnesa sudah memakai `diagnose_type`. Kolom yang tidak pernah terisi
> itu membuat garis waktu pasien selalu menulis "Diagnosis sekunder".

### 6. `05_modul_baru/` — modul yang sebelumnya kosong
`supabase_inpatient.sql` (rawat inap) · `supabase_pharmacy.sql` (farmasi) ·
`supabase_crm.sql` (pipeline & pendapatan) ·
`supabase_assets.sql` (aset tetap, penyusutan & jadwal kalibrasi)

### 7. `07_lanjutan/` — penyempurnaan alur (verifikasi 23 Juli 2026)

Diverifikasi lewat REST (objek benar-benar ada di DB), bukan catatan:

| Berkas | Verifikasi | Isi |
|---|---|---|
| `supabase_lab_panel_conclusion.sql` | tabel `lab_panel_conclusions` → 200 | Kesimpulan klinis tingkat panel (mis. dislipidemia) di layar Approval |
| `supabase_agentic_doc_sign.sql` | `agentic_doc_review_data/_signatures` balas JSON | RPC QMS: TTD, no. dokumen, publish, hapus template, riwayat chat editor AI |
| `supabase_agentic_overlap.sql` | `agentic_overlap_status`/`_scan_semantic` jalan | Deteksi tumpang-tindih antar-SOP (leksikal Jaccard + semantik pgvector) |
| `supabase_agentic_rag.sql` | `agentic_rag_status` → `{docs_total:37}` | RAG "Tanya Dokumen": chunk + embedding pgvector 768-dim (butuh extension `vector` + edge fn `embed`) |
| `supabase_homecare_maps.sql` | `homecare_ensure_token` balas token | Kolom lat/lng, pelacakan lokasi nakes & pasien |
| `supabase_homecare_nakes.sql` | kolom `access_token` 200 + `homecare_staff_portal` jalan | Portal nakes lewat token (`nakes.html?t=…`) — order + berbagi lokasi tanpa login |
| `supabase_ris_modality_worklist.sql` | kolom `device_name` dll → 200 | Langkah "kirim ke antrian alat" + konsol penerimaan PACS di RIS |

> Prasyarat RAG di luar SQL: `CREATE EXTENSION vector` sudah aktif, dan edge
> function `supabase/functions/embed` sudah di-deploy. Status `docs_indexed:0`
> berarti struktur siap tetapi belum ada dokumen yang diindeks.

---

## Prasyarat antar berkas

Beberapa fungsi dipakai berulang oleh migrasi lain. Bila dijalankan di luar urutan,
migrasi akan gagal dengan pesan "function does not exist":

| Fungsi | Dibuat di | Dipakai oleh |
|---|---|---|
| `current_app_role()` | `fase1_rls_a.sql` | hampir seluruh fase berikutnya |
| `current_app_name()`, `write_audit()` | `fase1_rpc.sql` | fase 2, 3, 4, 5, dan modul baru |
| `post_journal()` | `fase4.sql` | `fase4b.sql`, modul rawat inap |

---

## Yang perlu disiapkan di luar SQL

- **Bucket `pacs`** di Supabase Storage untuk arsip citra radiologi.
  Wajib **non-publik** — citra medis tidak boleh dapat diakses tanpa login.

---

## Catatan penting

- Migrasi ini menyentuh data pasien dan keuangan. Sebelum menjalankan ulang di
  basis data berisi data nyata, **buat cadangan lebih dulu**.
- Beberapa berkas berakhiran `_fix` adalah perbaikan atas kekeliruan migrasi
  sebelumnya. Keduanya tetap disimpan agar riwayat perbaikannya terlihat —
  jangan hanya menjalankan yang `_fix` tanpa berkas aslinya.
