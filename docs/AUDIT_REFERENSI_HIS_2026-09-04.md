# Audit Referensi HIS — 4 September 2026

## Ruang lingkup dan batas

Audit dilakukan secara *read-only* pada sistem referensi menggunakan akun yang
diberikan pemilik. Tidak ada record dibuat, diedit, dihapus, diekspor, maupun
diubah. Dokumen ini mencatat pola informasi dan pengalaman pengguna generik,
bukan data, aset, atau identitas produk pihak ketiga.

## Pola shell aplikasi

- Header memuat identitas pengguna, email, dan konteks cabang aktif.
- Rail ikon permanen adalah navigasi primer; sebuah tombol membuka pemilih
  semua modul.
- Pemilih semua modul menyediakan pencarian dan pengelompokan tingkat atas:
  Configuration, Home, Admission, Services, Outpatient, Finance, Medical
  Record, Package Service, Remuneration, Satu Sehat, dan Workforce.
- Halaman operasional dibuka sebagai tab kerja di bawah header. Setiap tab
  dapat ditutup tanpa menutup hub utama.
- Dashboard memakai kartu KPI, filter periode/cabang, tombol reload, promosi,
  dan grafik ringkasan transaksi/pembayaran/layanan.

## Configuration — struktur yang diverifikasi

Hub Configuration memakai kartu ringkas, masing-masing memiliki tombol
dropdown. Ada 17 kelompok:

| Domain | Cakupan submenu yang terlihat |
| --- | --- |
| System | Init Menu, Roles, User |
| SAP / akuntansi | business partner, tipe partner, mapping pembayaran-akun, master akun, EDC, mapping produk-akun |
| Outpatient | ruang poli, jadwal dan generator jadwal praktisi, mapping tindakan, jadwal cuti |
| Branch | hari libur dan plant/cabang |
| Patient | pasien, title, relasi, mapping relasi, penjamin, kondisi, alergi, ICD-9-CM, ICD-10 |
| Doctor | praktisi, jasa, spesialisasi, fee/referral/guarantee configuration |
| Corporate | perusahaan, kontrak, level/jabatan, kontrak fasilitas kesehatan |
| MCU | exposure, hasil/final health status, master/mapping produk, fisik, rekomendasi, audiometri, spirometri, skala berat, visus, tekanan darah, tipe, habit/disease/detail |
| Finance | daily mail, bank, EDC, metode pembayaran |
| Promotion | deal/voucher/discount dan discount type |
| Health Facility | class/people/product/address, reschedule, kontrasepsi, gejala dan mapping produk-gejala, unit/equipment/service class/test unit |
| Branch Queue | flow rawat jalan, display, counter, ruang, tipe, flow layanan, kiosk display, outlet |
| Virtu Apps | menu, role, user function |
| Workforce | team, generator/setting jadwal, availability, tarif homecare |
| Medicine | kategori, tipe, bentuk, aturan, instruksi, master dan waktu konsumsi |
| Telemedicine | jadwal, setup video meeting, webhook |
| Satu Sehat | setup integrasi |

## Pola daftar dan formulir master

Satu contoh master konfigurasi diverifikasi sampai ke layar list dan formulir
kosong (tanpa menyimpan apa pun):

1. Klik submenu membuka tab kerja berjudul daftar master.
2. Toolbar konsisten berisi **Add**, **Refresh**, dan pencarian nama/kode.
3. Grid menyajikan kolom Action, kode, label/entitas terkait, dan status aktif.
4. Pagination menyediakan navigasi halaman dan indikator jumlah record.
5. Add membuka formulir pada panel di atas daftar, dengan field wajib bertanda
   asterisk, pilihan relasi, status aktif, serta **Cancel** dan **Save**.
6. Cancel menutup formulir tanpa perubahan.

## Alur yang diturunkan untuk HIS AVA

1. Pengguna memilih domain besar dari rail/pemilih modul.
2. Pengguna masuk ke hub domain, lalu memilih master spesifik.
3. Layar master membedakan daftar, pencarian/filter, dan formulir edit agar
   konteks tidak hilang.
4. Master yang belum mempunyai penyimpanan harus tetap tampil sebagai
   "kerangka"—bukan tombol yang mengarah ke layar kosong.
5. Queue, kiosk, dan display berada dalam domain yang sama karena ketiganya
   mengelola satu alur antrean, bukan tiga sistem independen.

## Implikasi IP & kepatuhan

- Referensi dipakai sebagai pola navigasi dan CRUD, bukan untuk disalin secara
  visual atau fungsional secara identik.
- HIS AVA harus menggunakan istilah, data, desain, dan skema yang dimiliki
  sendiri atau generik.
- Implementasi master yang menyentuh skema atau database produksi memerlukan
  checkpoint pemilik database, backup, rollback, dan uji UAT.
