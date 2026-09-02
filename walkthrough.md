# Walkthrough — Penyempurnaan HIS

## Ruang lingkup

Perbaikan dibatasi pada `his.avahealth.sbs`: navigasi dan konteks UI. Tidak ada
migrasi database, perubahan data klinis, atau pemanggilan integrasi eksternal.

## Temuan dan perbaikan

- Tombol tetap di rail bawah selalu menunjuk ke `lis-settings`, bahkan saat
  aplikasi disajikan dari `his.avahealth.sbs`. Akibatnya staf HIS memperoleh
  pintasan yang salah menuju konfigurasi connector analyzer/LIS.
- Tag rail juga selalu memakai `ISO 15189:2022`, yang merupakan konteks LIS.
- `ava-platform/index.html` kini menyesuaikan label, tag, dan target tombol
  berdasarkan workspace. Pada HIS tombol menjadi **Pengaturan Sistem HIS**,
  bertag **HIS / RME**, dan membuka `settings` melalui router yang sama sehingga
  kontrol RBAC tetap berlaku. LIS mempertahankan tombol connector-nya.
- Pengaturan tidak lagi menampilkan atau menyediakan template SQL untuk
  menonaktifkan RLS seluruh tabel. Kontrol isolasi data tetap berada di database;
  panel hanya menyisakan diagnostik skema dan bantuan konfirmasi akun yang harus
  dijalankan melalui prosedur administrasi tercatat.
- Sidebar HIS diperkuat agar grup accordion dan submenu selalu seukuran
  kontennya, rail selalu menumpuk dari atas, dan submenu memiliki tinggi
  minimum. Grup tidak lagi dibuka secara otomatis hanya karena berada di
  urutan pertama; grup aktif saja yang terbuka setelah navigasi tersinkron.
  Versi URL stylesheet diperbarui agar browser mengambil aturan sidebar baru.
- UI responsif kini memakai drawer penuh pada lebar layar ≤768px, lengkap
  dengan scrim untuk menutup navigasi. Ini menggantikan rail 56px lama yang
  tidak kompatibel dengan label accordion. Fokus keyboard diberi indikator
  yang konsisten pada kendali interaktif. Pada layar kecil breadcrumb disimpan
  agar judul halaman dan identitas pengguna tetap terbaca tanpa overflow.
- Final audit menemukan lima rute menu LIS aktif yang belum dipetakan router
  (`lab-result`, `lab-validation`, `lab-approval`, `lab-qc`, dan
  `lab-report`) dan satu blok JavaScript yang terpotong pada
  `modules/lab/admission.js`. Kelimanya kini memanggil renderer `renderLab`
  yang tepat; blok duplikat yang tidak lengkap dihapus tanpa mengubah alur data.

## Bukti verifikasi

- Pemeriksaan sintaks JavaScript inline `index.html`: lulus.
- `node --check ava-platform/modules/system/settings.js`: lulus; pencarian
  `Disable RLS`/`disable_rls` pada modul pengaturan tidak menemukan sisa kontrol.
- `node scripts/uji/test_fase1_e2e.js`: 13/13 lulus.
- `node scripts/uji/test_his_tindakan_imunisasi.js`: 18/18 lulus.
- `node scripts/uji/test_alur_tagihan_order.js`: 13/13 lulus.
- `node scripts/audit-menu-hidup.js`: menu aktif, renderer, tabel/view, RPC,
  handler, dan manifest bersih; tidak ada layar mati.
- `node scripts/audit-keamanan-modul.js`: 2.252/2.252 pemeriksaan lulus,
  termasuk sintaks semua modul dan konsistensi manifest.
- `node scripts/uji/test_lis_super_suite.js`: 13/13 lulus;
  `test_wellness_pabrik.js`: 23/23; `test_lis_tech_order.js`: 22/22;
  `test_klaim_penjamin.js`: 11/11; dan `test_his_tindakan_imunisasi.js`: 18/18.
- Pemeriksaan sintaks inline `index.html`, `router.js`, dan
  `modules/lab/admission.js`, serta `git diff --check`, lulus.
- Verifikasi UI pada `http://his.localhost:5174/`: rail menampilkan **AVA
  CLINIC / Hospital & Clinical System**; tombol baru membuka **Pusat Pengaturan
  & Konfigurasi**, bukan pengaturan LIS, dan panel administrasi hanya
  menampilkan bantuan konfirmasi akun serta diagnostik skema.
- Verifikasi sidebar HIS setelah perbaikan: grup **Pelayanan Klinis** yang
  aktif menampilkan seluruh submenu; grup lain tertutup rapat dan rail dapat
  digulir tanpa ruang kosong besar.
- Verifikasi langsung pada `his.localhost:5174` menunjukkan pintasan bawah
  berlabel **Pengaturan Sistem HIS** dan halaman EMR tampil normal. Pada
  `lis.localhost:5174`, menu **Input Hasil & Delta** membuka halaman
  **Input Hasil & Delta Check**, bukan layar kosong atau fallback.

## Batas verifikasi

Pengujian memakai lingkungan lokal dan data kosong. Koneksi produksi,
SATUSEHAT, perangkat analyzer, serta penerapan migrasi pada database produksi
tidak diuji atau diubah.

Selain itu, menu yang berstatus roadmap (7 `belum` dan 1 `parsial`) perlu
keputusan produk sebelum dibuka penuh. Pemeriksaan kepatuhan ISO pada engine
masih berupa pemeriksaan konten otomatis; ia bukan pengganti penilaian auditor
ISO 15189:2022. Kedua hal tersebut sengaja tidak diubah karena membutuhkan
validasi pemilik proses dan, untuk lingkungan produksi, checkpoint manusia.

## Penyambungan Kiosk dan Display Antrean

### Temuan dan perbaikan

- `kiosk/index.html` sebelumnya menerbitkan nomor di `localStorage` per
  subdomain. Nomor tersebut tidak mungkin terlihat dari
  `antrian.avahealth.sbs`, karena penyimpanan browser tidak dibagi antar-host.
- `monitor/antrian.html` juga hanya menampilkan nomor contoh dan tombol demo;
  ia tidak pernah membaca sumber antrean HIS.
- Ditambahkan kontrak `kiosk/queue-api.js`: kiosk menerbitkan tiket anonim ke
  endpoint publik yang terbatas dan display hanya membaca nomor, layanan, dan
  status. Nama pasien tidak keluar ke kiosk atau TV.
- Mode lokal memakai endpoint simulator di engine desktop yang sama; mode
  produksi memakai Edge Function `queue-public`. Hak tulis tabel tidak pernah
  diberikan ke browser publik. Layanan dibatasi ke enam opsi kiosk dan sentuhan
  ganda dibatasi 2,5 detik per layanan.
- Perbaikan kompatibilitas engine lokal: akun bootstrap kini menggunakan UUID
  sah, sehingga engine tidak lagi berhenti sebelum simulasi dapat dijalankan.

### Bukti verifikasi

- `http://kiosk.localhost:5174/` memuat status **Mode simulasi lokal**.
- Engine sintetis terisolasi pada `127.0.0.1:54329` menerbitkan tiket
  `U001` untuk layanan Umum dengan `ahead: 0`.
- `http://antrian.localhost:5174/` membaca sumber yang sama dan menampilkan
  **1 menunggu** pada Poli Umum tanpa data pasien.
- `node --check` lulus untuk `kiosk/app.js`, `kiosk/queue-api.js`, dan
  `desktop-app/electron/local-engine.js`; pemeriksaan HTML inline, peta
  domain, `git diff --check`, serta build Electron juga lulus.

### Catatan deploy produksi

Untuk mengaktifkan dua domain produksi, terapkan migrasi HIS
`db/migrations/0047_kiosk_antrean_publik.sql` lalu deploy Edge Function
`supabase/functions/queue-public`. Migrasi menandai asal tiket (`staff` atau
`kiosk`) dan membuat RPC khusus yang hanya bisa dipanggil service-role.
Migrasi ini juga membuat `queue_config` bila instalasi lama hanya memiliki
`queue_tickets`, sehingga tidak bergantung pada urutan pemasangan fitur loket.
Tidak ada deploy atau perubahan data cloud yang dilakukan pada pekerjaan ini.
