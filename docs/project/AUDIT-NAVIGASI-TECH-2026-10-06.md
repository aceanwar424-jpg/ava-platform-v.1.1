# Audit navigasi AVA Tech — 6 Oktober 2026

OWNED_BY: generic

## Ruang lingkup dan bukti
Audit sumber lokal yang melayani tech.avahealth.sbs, manifest menu, router, navigasi global, control plane dan formulir tenant. Referensi pengguna digunakan sebagai pola hierarki; identitas/data pada gambar tidak disalin. Produksi tidak dapat dibuka melalui alat web; temuan runtime di bawah berasal dari fixture browser lokal, bukan verifikasi sesi produksi. Tidak ada perubahan kode aplikasi atau backend pada tahap audit ini.

Manifest `config/menu.json` mendefinisikan 23 entri Tech dalam 5 kelompok, ditambah kategori Agentic terpisah. Jumlah yang terlihat mengikuti izin akun.

## Temuan terverifikasi

| Prioritas | Temuan | Bukti | Dampak |
|---|---|---|---|
| P1 | Sidebar membuka panel konteks dua kolom, bukan halaman direktori | `index.html:1077` memanggil `openNavigationContext`; panel `navigation-context` berada di luar main-content | Lapisan navigasi berada di atas halaman kerja; konteks terasa bertingkat ke kanan |
| P1 | Control plane menampilkan beberapa fungsi saat pembukaan awal | `techControlPlane.js:78–185` membuat semua `.tcp-panel` tanpa hidden dan tidak memanggil pemilih panel awal | Ringkasan, tiket, pengaturan dan deployment menumpuk |
| P1 | Form tambah/ubah tenant masih modal | `tenants.js:194–198`, `tntForm` menggunakan `openModal` | Belum memenuhi pola daftar → detail → edit halaman penuh |
| P2 | Ada dua sistem direktori yang berbeda | `openCategory` di `index.html:1382` membuat indeks halaman; sidebar aktual menggunakan panel konteks | Perilaku navigasi tidak konsisten; indeks lama juga menggulung ke kelompok dalam halaman panjang |
| P2 | Router belum menyediakan riwayat halaman dalam fungsi navigate | `js/core/router.js:198` mengganti main-content melalui handler; tidak menyimpan state/history di fungsi itu | Perlu mekanisme Back, breadcrumb klik, refresh dan deep link yang diuji, bukan hanya mengganti konten |
| P2 | Fungsi operasional muncul di beberapa tempat | Control plane memuat tiket, kesehatan, deployment; manifest juga menyediakan tech-isu, tech-telemetri, tech-roadmap, tenants | Ringkasan boleh menautkan; editor dan proses utama perlu satu halaman tujuan |
| P2 | Tiket control plane mencampur form baru, ringkasan alert/incident/problem/backup/change dan tabel tiket | `techControlPlane.js:108–133` | Pengguna harus membedakan beberapa jenis pekerjaan dalam satu panel |

Bukti browser: `docs/audit-evidence/2026-10-06/tech-navigation.json`. Dengan backend sintetis kosong dan jaringan diblokir, panel awal yang terlihat adalah ringkasan (2 blok), tiket, pengaturan, deployment. Setelah memilih ringkasan secara eksplisit, hanya 2 blok ringkasan tersisa. Panel kesehatan tidak dibuat pada data kosong; perlu empty state tersendiri ketika dipisahkan.

## Struktur halaman yang dituju

Sidebar tetap ringkas. Klik kategori mengganti area kerja utama dengan direktori kartu; klik kartu membuka halaman fungsi. Pilihan yang memiliki anak membuka direktori berikutnya, bukan dropdown/panel ke kanan. Daftar data membuka halaman detail; tombol tambah/edit membuka halaman formulir. Konfirmasi singkat boleh dialog, tetapi halaman kerja/form bukan popup.

| Kelompok sidebar | Isi direktori |
|---|---|
| Operasi Platform | Ringkasan, Pusat Kendali, Rilis & Perubahan, Modul & Versi, Tiket, Studio Database, Riwayat Aktivitas |
| Tenant & Lisensi | Tenant & Klien, Lisensi Instalasi, Penerbitan & Aktivasi, Kesehatan Sistem |
| Komersial | Prospek, Penawaran, Kontrak, Paket & Harga, Tagihan |
| Integrasi & Konektor | Ekspor Katalog, SATUSEHAT, Analyzer, Monitor AI |
| Tim & Delivery | Tim, Pekerjaan & Kapasitas, Implementasi & SLA |

Contoh urutan: Tech → Tenant & Lisensi → Tenant & Klien → Detail tenant → Ubah tenant. Deployment menjadi tujuan tersendiri dari detail tenant. Contoh referensi Configuration → SAP → Business Partner digunakan sebagai pola saja; tidak menambah modul SAP yang belum ada.

Pusat Kendali menjadi ringkasan dengan tautan ke tujuan operasional. Tiket, Incident, Problem, Backup, Perubahan, Deployment, Pengaturan dan Trace memiliki tujuan halaman yang jelas. Hindari menduplikasi formulir tiket/deployment pada dashboard.

## Urutan implementasi yang dapat diuji
1. Navigasi halaman khusus Tech: gunakan inventaris menu setelah penyaringan role; arahkan klik sidebar ke direktori. Jangan mengganti perilaku HIS/LIS/Apps tanpa scope tersendiri.
2. State halaman: breadcrumb klik, Back, rute direktori/list/detail/edit, refresh dan pemulihan filter daftar. Tambahkan penjagaan form belum tersimpan.
3. Pisahkan control plane: satu fungsi per halaman, loading/empty/error per sumber. Awali dengan memperbaiki panel awal bertumpuk.
4. Migrasi tenant list/detail/tambah/edit/deployment dari modal ke halaman, memakai izin dan API yang sudah ada.
5. Audit lanjutan setiap handler dari 23 entri, terutama modul bersama komersial/SDM dan Agentic; jangan mengklaim semua form sudah diperiksa hanya dari audit awal ini.

## Kriteria penerimaan
- Klik sidebar Tech tidak membuka navigation-context atau lapisan submenu kanan.
- Setiap direktori, daftar, detail dan editor memiliki judul serta breadcrumb yang sesuai.
- Back kembali ke filter/halaman daftar yang sama; refresh/deep link tidak kehilangan tujuan.
- Satu area kerja utama; halaman ringkasan tidak memuat form fungsi lain di bawahnya.
- Izin menu dan route tetap ditegakkan; URL langsung tidak membuka akses tambahan.
- Detail tenant yang tidak ditemukan/ditolak memiliki pesan serta jalan kembali.
- Form belum tersimpan terlindungi ketika pindah halaman.
- Uji desktop/mobile, keyboard, kondisi kosong/error dan respons async yang datang setelah perpindahan halaman.

## Implikasi IP & Kepatuhan
Tidak ada perubahan skema, kontrak API, data master, izin backend atau integrasi produksi yang diperlukan untuk tahap navigasi. Fixture harus sintetis. Data contoh dari screenshot pengguna tidak boleh dijadikan seed aplikasi. Perubahan UI shared harus dibatasi ke ruang Tech dan diverifikasi tidak merusak ruang lain.
