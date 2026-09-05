# Audit Referensi Admission — 5 September 2026

## Ruang lingkup dan batas

Audit dilakukan *read-only* pada sistem referensi dengan akun yang diberikan
pemilik. Hanya hub, daftar kosong, dan formulir kosong yang dibuka untuk
memahami struktur informasi. Tidak ada pasien, nomor rekam medis, transaksi,
konfigurasi, ekspor, atau data lain yang dibuat, diubah, maupun disalin.

Dokumen ini adalah analisis pola proses generik. Nama produk, data operasional,
dan identitas visual sistem referensi tidak menjadi bagian dari HIS AVA.

## Pola navigasi yang diverifikasi

1. Rail ikon adalah navigasi primer yang selalu tersedia.
2. Memilih domain **Admission** membuka hub yang berisi empat kelompok kerja:
   **Admission**, **Back Office**, **Queue**, dan **Queue Outpatient**.
3. Memilih satu kelompok membuka daftar proses spesifik, bukan menambah
   seluruh kedalaman menu ke rail.
4. Daftar transaksi memakai toolbar tambah/cetak/muat ulang/filter, grid
   ringkasan, serta pagination. Form dibuka sebagai ruang kerja terpisah dan
   dapat dibatalkan tanpa perubahan.

Pola ini menjadi dasar panel navigasi konteks HIS AVA: domain di rail,
sub-menu pada kolom pertama, dan modul/proses pada kolom kedua.

## Matriks proses Admission

| Proses | Tujuan | Tahap kerja | Perbedaan field/proses yang penting |
| --- | --- | --- | --- |
| Registrasi rawat jalan | Kunjungan klinik terjadwal atau walk-in | Pasien → Pembayaran → Unit klinik → Kasir | Metode admisi, jadwal/unit/dokter, kuota, dan layanan minimum yang wajib terikat pada jadwal. |
| Registrasi layanan | Tindakan/layanan langsung, dengan atau tanpa perangkat/kit | Pasien → Pembayaran → Layanan → Kasir | Baris layanan berisi prioritas, harga satuan, diskon persen/nominal, subtotal, promosi, dan status layanan dengan/ tanpa kit. |
| Registrasi medical kit | Pendaftaran layanan yang bergantung pada kit/perangkat | Pasien → Pembayaran → Layanan → Kasir | Memiliki tanggal layanan wajib dan siklus status proses sebelum selesai diregistrasikan; bukan sekadar salinan registrasi layanan umum. |
| Registrasi paket layanan | Menjual/mendaftarkan bundel layanan atau MCU | Pasien → Pembayaran → Layanan → Kasir | Memilih kategori paket lalu paket; mendukung produk paket dan add-on terpisah, total add-on, serta total net paket. |
| Langganan paket | Membuat hak penggunaan berulang suatu paket | Pasien → Pembayaran → Langganan → Kasir | Nomor/tanggal langganan otomatis; detail item, kuantitas item/bonus, masa berlaku, harga, dan nilai total. |
| Pemakaian langganan | Menebus satu atau lebih hak dari paket aktif | Pasien → Pemakaian | Memilih paket aktif, menampilkan tanggal kedaluwarsa dan sisa penggunaan; menghasilkan nomor/tanggal registrasi penggunaan. |

### Elemen yang dipakai bersama

- Pencarian/validasi pasien dan ringkasan identitas dasar.
- Riwayat kunjungan untuk menghindari pendaftaran yang salah konteks.
- Status pembayaran dan jejak kasir pada proses yang memungut biaya.
- Nomor dokumen otomatis, tanggal/jam operasional, pembatalan aman, dan cetak
  dokumen setelah penyimpanan yang sah.

### Batas pemisahan proses

- **Paket** adalah katalog/bundel yang dapat dijual; **langganan** adalah hak
  penggunaan pasien setelah pembelian; **pemakaian langganan** adalah
  penebusan hak tersebut. Ketiganya tidak boleh disatukan sebagai satu tipe
  transaksi biasa.
- **Medical kit** perlu status dan tanggal layanan sendiri karena ada
  ketergantungan persediaan/perangkat. Ia tidak boleh disamakan dengan layanan
  tanpa kit.
- **Rawat jalan** harus menyimpan konteks klinik, praktisi, jadwal, dan
  kapasitas; sedangkan registrasi layanan langsung tidak selalu membutuhkannya.

## Kelompok pendukung di domain Admission

| Kelompok | Menu yang terlihat | Fungsi operasional |
| --- | --- | --- |
| Back Office | Laporan registrasi medical kit | Pelaporan/rekap proses kit, terpisah dari pendaftaran. |
| Queue | Registrasi, timbangan, ECG, pencitraan, dokter, audiometri/spirometri, resepsionis, laboratorium | Antrean per titik layanan/pekerjaan, bukan satu antrean generik. |
| Queue Outpatient | Antrean umum dan spesialis | Tampilan/operasi antrean berdasarkan jenis poli. |

## Pemetaan penerapan HIS AVA

- Rail HIS tidak lagi menjadi tempat menumpuk domain, layanan, dan modul.
  Klik satu domain membuka panel konteks dua kolom.
- Kolom kiri memuat kelompok layanan yang sudah lolos filter RBAC; kolom kanan
  memuat modul beserta deskripsi prosesnya. Pemilihan modul tetap memakai
  action/route asal dan tidak membuat jalur akses kedua.
- Struktur sekarang dapat menyajikan pemisahan **Registrasi & Admisi**,
  **Antrean/Loket/Kiosk**, dan **Jadwal/Kapasitas** tanpa membuat sidebar
  setinggi layar menjadi daftar panjang.
- Enam pintu registrasi ditampilkan di dalam layanan **Registrasi & Admisi**.
  Rawat jalan memakai alur yang sudah tersedia; lima varian lain diberi status
  **Bertahap** dan konteks field/workflow agar tidak terlihat sebagai form
  generik yang sudah setara secara transaksi.

## Catatan implementasi lanjutan

HIS AVA saat ini sudah memiliki halaman registrasi umum, antrean, konsol,
kiosk, jadwal, kasir, dan konfigurasi paket. Enam variasi registrasi pada
matriks di atas memerlukan kontrak data dan aturan transaksi yang berbeda.
Membuatnya menjadi CRUD produksi terpisah akan menyentuh skema master/transaksi
dan karena itu membutuhkan checkpoint pemilik database, backup, preflight, dan
UAT. Tahap navigasi ini tidak melakukan perubahan skema ataupun data klinis.

## Implikasi IP dan kepatuhan

- Tidak ada data pasien nyata, harga, template, atau aset visual sistem
  referensi yang dipindahkan ke HIS AVA.
- Form transaksi produksi harus tetap tenant-aware, berjejak audit, menjalankan
  validasi role, dan menyimpan snapshot harga/master yang berlaku saat
  transaksi.
- Hak pemakaian paket dan data antrean merupakan data operasional klinis; akses
  kiosk publik tetap dibatasi endpoint server yang telah disetujui, bukan hak
  tulis basis data langsung.
