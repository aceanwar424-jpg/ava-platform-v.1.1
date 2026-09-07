# Audit read-only — layanan Trustmedis sebagai acuan LIS/HIS

**Tanggal audit:** 7 September 2026  
**Lingkup:** struktur menu, navigasi, nama halaman, toolbar, kolom tabel, tab form, dan alur kerja yang terlihat.  
**Batas:** tidak ada pencarian pasien, pembukaan data pasien, simpan, cetak, sinkronisasi, ekspor, atau perubahan konfigurasi pada sistem referensi. Nama, nomor, alamat, hasil, dan data finansial tidak dicatat.

## Pola navigasi yang tervalidasi

`rail ikon → pemilih modul global → domain layanan → kartu hub → leaf menu → halaman MDI/tab`.

Kartu hub dapat membuka halaman utama atau menu drop-down. Halaman kerja memakai pola desktop kompak: judul, toolbar satu baris, pencarian/filter, grid data, legenda status, dan paginator. Layar khusus hanya memakai panel/tabs bila prosesnya benar-benar bertahap.

## Peta Services

| Domain | Hub / leaf yang diamati | Bentuk kerja | Batas implementasi AVA |
|---|---|---|---|
| Anamnesa & Specimen | Transaction → Anamnesa & Specimen | Work queue dan workbench bertab | HIS sebagai input klinis; LIS menerima order/specimen sesudahnya |
| Audiometry | Transaction → Audiometry | Work queue spesifik disiplin | Workspace penunjang; hasil mengikuti validasi/rilis |
| Spirometry | Transaction → Spirometry | Work queue spesifik disiplin | Workspace penunjang; hasil mengikuti validasi/rilis |
| Supportive | Transaction → Supportive Investigation | Hub pemeriksaan penunjang | EKG/treadmill dan penunjang dipisahkan dari analitik lab |
| Clinical Pathology | Transaction → Lab Result; Back Office → Lab Diagnostic Report | Hasil, sync terkontrol, laporan | LIS sumber hasil; HIS viewer saja |
| Microbiology | Transaction → Microbiology | Work queue spesifik disiplin | Viewer/sinkron hasil LIS, bukan input ganda di HIS |
| Anatomical Pathology | Transaction → Anatomical Pathology | Work queue, sync terkontrol | Viewer/sinkron hasil LIS, bukan engine input HIS |
| Radiology | Transaction → X-RAY, USG | Work queue per modalitas dan sync | RIS/PACS sumber operasional; HIS daftar/hasil terintegrasi |

## Detail layar

### 1. Anamnesa & Specimen

Halaman **Anamnesa & Specimen Forms** menempatkan daftar antrean pasien di atas workbench.

- Toolbar: Refresh; pencarian `MR Number / Name ...`; Filter; paginator; legenda transaksi selesai/belum selesai.
- Tabel antrean: Order Number, Register Number, Registration Date, Invoice Group, MR Number, Name, Gender, Age, Medical Kit, Status.
- Konteks tindakan: Order Number, Get Weightscale Data, Verify Patient, Next Queue, View Examination, Barcode/Registration Number.
- Tab workbench vertikal: Patient, Anamnesa, Specimen, Observation, Notes, ICD X Diagnostic.
- Kelompok bidang Patient yang terlihat: identitas, tanggal lahir/usia, gender, telepon/email, nomor registrasi, golongan darah, alamat hingga negara/kewarganegaraan.
- Footer: Cancel, Print, Save.

Alur referensi: pilih antrean → verifikasi pasien/konteks → isi anamnesis, spesimen, observasi, catatan dan diagnosis → lanjut antrean bila diperlukan → simpan/cetak. Pada AVA, alur ini dipertahankan sebagai HIS pra-analitik; LIS tidak boleh membuat anamnesis kedua.

### 2. Audiometri dan Spirometri

Keduanya dipisahkan sebagai domain layanan tersendiri, tidak menjadi formulir generik. Audiometri menunjukkan halaman **Audiometry List** dengan Refresh, pencarian `Register Number / MR ...`, Filter, paginator, legenda status, serta kolom Action, Registration Date, Register Number, Class Name, MR Number, Name, Invoice Number, Invoice Group, Age, Status. Spirometri mengikuti pola hub `Transaction → Spirometry` yang setara.

Keputusan AVA: dua rute tetap berdedikasi. Keduanya menjadi **Konteks Klinis & Penunjang** pada LIS agar petugas melihat rangkaian order–hasil, tetapi data/persetujuan klinis tidak disalin ke modul analitik.

### 3. Clinical Pathology

- Hub: Transaction dan Back Office.
- Transaction: Lab Result dan Sync Peduli Lindungi.
- Back Office: Lab Diagnostic Report.
- Layar Lab Result: toolbar Synchronize Data, Refresh, pencarian Registration Number, Filter; status legend/pagination.
- Kolom: Action, Order Number, Register Number, MR Number, Patient Name, Created At, Medical Kit, Status.

Keputusan AVA: **LIS adalah sumber kebenaran** untuk entry, validasi dan rilis hasil. HIS hanya menerima hasil berstatus released melalui viewer read-only. Sinkronisasi tidak dibuat sebagai tombol default; kelak hanya job/admin terotorisasi setelah checkpoint integrasi.

### 4. Anatomical Pathology dan Microbiology

Anatomical Pathology memiliki daftar khusus, toolbar Sync Anatomical Pathology, Refresh, pencarian Register Number/MR, Filter, paginator dan legenda status. Kolom menggunakan pola antrean layanan: Action, tanggal registrasi, register number, class, MR, nama, invoice, invoice group, usia dan status. Microbiology memiliki leaf Transaction → Microbiology.

Keputusan AVA: keduanya ditampilkan sebagai status sinkron/viewer hasil pada HIS. Pengelolaan analit, validasi, rilis dan lampiran tetap berada di LIS atau LIS eksternal yang disetujui.

### 5. Radiology

Hub Transaction terbagi menjadi **X-RAY** dan **USG**. X-RAY menampilkan toolbar Sync X-RAY, Refresh, pencarian Register Number/MR, Filter, legenda, paginator, dan kolom antrean yang sama dengan layanan modalitas lainnya. USG merupakan leaf terpisah.

Keputusan AVA: radiologi tetap RIS/PACS; pola antrean modalitas dipakai sebagai referensi HIS, bukan dipindahkan ke LIS.

## Implementasi AVA yang dilakukan pada irisan ini

1. Menu LIS mendapat kelompok **Konteks Klinis & Penunjang**: Anamnesis & Observasi, Audiometri, Spirometri, serta EKG & Pemeriksaan Penunjang. Keempatnya menuju renderer/rute yang sudah ada; tidak ada endpoint, skema, atau duplikasi data baru.
2. Form input/edit penunjang diubah menjadi workspace halaman penuh dengan rail ringkas: Kunjungan & jenis → Pengukuran → Interpretasi → Tinjau & simpan.
3. Status hasil tidak bisa dipilih bebas di form. Status tetap bergerak melalui daftar sesuai urutan Draft → Validated → Approved.

## Batas yang masih disengaja

- Tidak ada migrasi data, perubahan RLS, koneksi analyzer, sinkronisasi eksternal, atau pengiriman SATUSEHAT.
- Lampiran grafik spirometri masih memakai kontrak data yang ada; pemindahan ke object storage memerlukan desain dan checkpoint skema/integrasi.
- UI referensi diaudit sebagai pola proses, bukan untuk disalin secara visual atau fungsional secara mentah.
