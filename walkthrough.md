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

## Kesiapan Deploy Awal — 3 September 2026

- `vercel.json` kini mengenali `antrian.avahealth.sbs` dan mengarahkannya ke display antrean.
- HIS, kiosk, dan display memuat konfigurasi runtime dari `/api/runtime-config.js`; endpoint hanya mengirim URL Supabase dan anon key dari Vercel Environment Variables, tidak pernah service-role atau secret integrasi.
- Endpoint runtime berada di `api/` root repo, selaras dengan `vercel.json` root yang memakai `ava-platform` sebagai output statis; ia tidak bergantung pada folder output untuk menjadi Vercel Function.
- Kiosk memakai URL Supabase runtime yang sama, sehingga deploy tenant baru tidak lagi memerlukan perubahan source untuk endpoint `queue-public`.
- `scripts/verify-deploy-readiness.js` memeriksa kontrak ini secara statis.

Perubahan ini tidak menerapkan migrasi database dan tidak mengaktifkan integrasi vendor. Migrasi tenant-aware, konsolidasi SQL arsip, dan aktivasi SATUSEHAT/BPJS/payment/PACS tetap menunggu checkpoint pemilik proses.

## Antrean Multi-tenant & Kiosk Publik — Artefak Staging

- Migrasi `0048_antrean_tenant_device_public.sql` menambahkan tenant pada tiket, konfigurasi, loket, dan log antrean. Data lama dipetakan ke tenant lokal, sedangkan cloud memakai claim `tenant_id` pada JWT.
- Kode loket dan layanan kini dirancang unik per tenant, bukan global.
- Perangkat kiosk terdaftar di `queue_public_devices`; fungsi publik membaca tenant dari perangkat di server, bukan dari nilai yang dikirim browser.
- Penerbitan tiket memakai bucket rate-limit persisten per tenant/perangkat/layanan/menit dan nomor harian dikunci per tenant serta layanan.
- Seluruh RPC konsol panggilan yang memakai `SECURITY DEFINER` kini didefinisikan ulang dengan filter tenant eksplisit untuk panggil, ulang, lewati, kembalikan, dan pindah loket.
- View internal `queue_papan` tidak lagi dapat dibaca role anonim karena memuat nama pasien. Display publik mengambil hanya nomor, layanan, status, dan loket.
- Edge Function `queue-public` sekarang menuntut origin yang diizinkan dan `QUEUE_PUBLIC_DEVICE_ID` sebagai Supabase secret.
- `scripts/verify-queue-tenant-contract.js` memeriksa bahwa jalur publik tidak meminta nama pasien dan tidak kembali ke rate-limit memori.

Belum ada migrasi atau secret yang diterapkan ke cloud pada tahap ini. Sebelum staging, backup dan verifikasi claim tenant pengguna harus disetujui pemilik database.

Preflight read-only dan runbook staging tersedia di `db/preflight/0048_antrean_tenant_device_public_preflight.sql` dan `db/runbooks/0048_antrean_tenant_device_public.md`; keduanya menjadi bukti wajib sebelum cutover.

Katalog `db/MIGRATION_CATALOG.md` dan `scripts/audit-legacy-migrations.js` membedakan migrasi rilis formal dari SQL arsip. Ini mencegah operator menjalankan skrip fase lama secara acak ketika satu modul belum aktif.

## Configuration Hub HIS

- Master Data Hub tidak lagi hanya menonjolkan konfigurasi laboratorium. Ia kini memberi jalur langsung ke pasien/korporat/paket, loket/kiosk/jadwal, tenaga home care, dan kepatuhan/SATUSEHAT.
- Setiap kartu hanya mengarah ke renderer yang sudah ada; tidak ada layar placeholder atau akses baru yang ditambahkan.

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
Ia juga menyemai loket HIS standar yang dipetakan tepat ke layanan kiosk;
operator dapat mengubah nama/ruang lewat Konfigurasi Antrean tanpa nomor
tiket yang sudah terbit berubah.
Tidak ada deploy atau perubahan data cloud yang dilakukan pada pekerjaan ini.

## Sidebar Ringkas Desktop

- Rail desktop sekarang dimulai pada lebar 64 px dan hanya menampilkan ikon
  kelompok. Klik ikon kelompok atau kontrol chevron di area brand memperluas
  rail menjadi 232 px; pengelompokan accordion dan submenu yang sama tetap
  dipakai.
- Preferensi lebar rail disimpan per-browser (`ava_sidebar_expanded`), sedangkan
  layar kecil tetap menggunakan drawer mobile sehingga label tidak tersembunyi
  pada perangkat sentuh.
- Tinggi topbar dan padding area kerja dipadatkan untuk meningkatkan area kerja;
  font submenu saat diperluas diperkecil tetapi tetap di atas 11 px.

## Konsolidasi Menu HIS

- Renderer HIS kini menggabungkan 10 kategori sumber menjadi domain kerja
  yang lebih pendek. Setiap domain membuka daftar layanan lebih dahulu, lalu
  modul operasionalnya; peta menu, route, dan RBAC tetap memakai sumber yang
  sama.
- Contoh hierarki: **Pelayanan Klinis → Radiologi & Pencitraan → Order,
  PACS, Unggah Studi, Bacaan**, serta **Pelayanan Klinis → Jantung, Paru &
  Indera → EKG, Treadmill, Audiometri & Spirometri**.
- `node scripts/audit-menu-hidup.js` setelah perubahan: 158 menu berstatus
  tersedia diperiksa; tidak ada renderer, tabel/view, RPC, handler, atau
  manifest yang hilang.

Konfigurasi `supabase/config.toml` menetapkan `verify_jwt = false` hanya untuk
`queue-public`, karena kiosk adalah perangkat publik tanpa sesi pengguna.
Function sendiri hanya menerima enam layanan yang diizinkan, menerapkan
pembatasan sentuhan, dan memakai service-role di server; browser tetap tidak
memegang kredensial ataupun hak tulis tabel.

Sesi demo `master_ava_*` kini hanya diizinkan pada host lokal. Di produksi
token itu dibersihkan dan pengguna harus masuk lewat Supabase Auth dengan JWT
valid; sebelumnya token demo tersebut diteruskan ke API dan menghasilkan
kesalahan `Expected 3 parts in JWT`. Form konfigurasi loket juga menyediakan
seluruh nama layanan kiosk agar pemetaan loket tidak salah ketik.

## Audit Referensi Navigasi HIS (read-only)

- Audit dilakukan pada 2 September 2026 terhadap menu yang tersedia untuk
  akun referensi, tanpa membuka formulir transaksi, membuat data, atau
  menampilkan data pasien.
- Pola navigasinya adalah rail ikon permanen → pemilih semua modul dengan
  pencarian → hub modul berbentuk kartu → dropdown aksi. Kelompok tingkat atas
  yang ditemukan: Configuration, Home, Admission, Services, Outpatient,
  Finance, Medical Record, Package Service, Remuneration, dan Workforce.
- Kedalaman yang diverifikasi mencakup Admission (termasuk delapan jenis
  antrean), layanan penunjang klinis, Outpatient, Finance, dan Configuration.
  Temuan ini dipakai sebagai referensi pola informasi saja; tidak ada aset,
  data, atau identitas merek pihak ketiga yang disalin ke HIS AVA.

## Penyempurnaan Discovery Menu HIS

- Rail HIS tetap ringkas dan berkelompok, tetapi sekarang memiliki tombol
  **Semua Modul** serta shortcut `Ctrl+K`. Panel yang muncul mendukung pencarian
  nama modul, layanan, domain, maupun deskripsi dan menampilkan jalur lengkap
  domain → layanan → modul.
- Inventaris panel dibangun dari menu sidebar setelah filter RBAC diterapkan.
  Karena itu panel tidak memperlihatkan menu yang tidak diizinkan untuk peran
  aktif, tidak membuat daftar rute kedua, dan tidak membuka akses data baru.
- Breadcrumb topbar kini menampilkan konteks domain → layanan → halaman aktif.
  Tombol arah atas/bawah, Enter, dan Escape didukung di pemilih modul.
- Verifikasi: sintaks semua skrip inline `index.html` valid; audit menu hidup
  memeriksa 158 menu dan melaporkan tidak ada renderer, tabel/view, RPC,
  handler, atau manifest yang hilang; `git diff --check` untuk berkas yang
  diubah pada pekerjaan ini bersih.

## Audit Referensi Konfigurasi Master (read-only)

- Audit 2 September 2026 memakai akun master yang diberikan pengguna dan hanya
  membuka hub/dropdown serta satu contoh layar daftar konfigurasi; tidak ada
  data dibuat, diubah, maupun dihapus.
- Konfigurasi mempunyai 17 hub: System, SAP, Outpatient, Branch, Patient,
  Doctor, Corporate, MCU, Finance, Promotion, Health Facility, Branch Queue,
  Virtu Apps, Workforce, Medicine, Telemedicine, dan Satu Sehat.
- Pola UI yang tervalidasi pada daftar Queue Counter adalah tab kerja MDI,
  judul daftar, toolbar Add/Refresh/filter, grid berkolom, dan pagination.
  Struktur ini menjadi referensi pola CRUD saja; data dan identitas merek
  pihak ketiga tidak dipindahkan ke HIS AVA.

## Penyempurnaan Struktur Konfigurasi HIS

- Sidebar HIS sekarang menempatkan konfigurasi sebagai domain kerja: **Sistem
  & Hak Akses**, **Data Awal & Migrasi**, dan **Master Klinis → Pasien &
  Keluarga**. Ini menggantikan satu ember pengaturan yang sebelumnya berisi
  semua fungsi sistem.
- **Fasilitas & Antrean** menjadi domain tersendiri, berisi layanan **Antrean,
  Loket & Kiosk**, **Jadwal & Kapasitas**, serta **Tenaga & Penugasan**.
  Modul queue, console, kiosk, konfigurasi antrean, jadwal, dispatch, dan
  master nakes mempertahankan route/action asalnya.
- Badge jumlah modul pada setiap layanan memberi konteks kedalaman navigasi
  tanpa memperlebar rail. Pemetaan hanya dilakukan setelah filter RBAC,
  sehingga tidak menambahkan atau mengungkap akses baru.
- Verifikasi pascaperubahan: sintaks inline dan CSS valid; audit 158 menu
  lulus tanpa renderer, tabel/view, RPC, handler, atau manifest hilang.

## Configuration Hub — Domain Master HIS

- Menu **Pengaturan Sistem → Master Konfigurasi HIS** kini memuat delapan
  pintu masuk: Fasilitas & Unit, Praktisi & Fee, Pasien & Penjamin, Korporat
  & Kontrak, Parameter MCU, Pembayaran, Antrean, serta Master Obat.
- Tiap pintu masuk meneruskan fokus ke hub Configuration. Modul yang sudah
  tersedia (misalnya antrean, jadwal, pendaftaran, kasir, farmasi, dan MCU)
  memiliki tombol buka; master yang belum punya formulir penyimpanan diberi
  penanda **Kerangka master**, bukan tautan yang berakhir pada layar kosong.
- Peta menu dibangkitkan ulang dari `config/menu.json`: 177 menu total
  (161 tersedia, 9 parsial, 7 belum). Audit menu aktif memeriksa 159 item dan
  tidak menemukan renderer, tabel/view, RPC, handler, atau manifest hilang.
- Batas: perubahan ini tidak membuat atau memigrasikan tabel master,
  tidak menulis data klinis, dan tidak mengaktifkan integrasi vendor.
