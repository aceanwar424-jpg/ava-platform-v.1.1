# STATUS PROYEK AVAQUEEN PLATFORM

> Dokumen gabungan dari rencana, checklist, dan bukti verifikasi. Detail historis dipertahankan di bawah setiap bagian.

## Verifikasi restrukturisasi sebelum melanjutkan LIS — 10 September 2026

### Rencana dan checklist
- [x] Baca aturan baru, struktur dan riwayat Git; baseline main 27a3a85. Pertahankan perubahan Apps yang sedang berjalan.
- [x] Verifikasi boundary/domain dan lokasi runtime, migrasi, laporan serta skrip LIS.
- [x] Regresi LIS–HIS dan connector lulus. Uji integritas menemukan fallback R-4s lintas run dari commit restrukturisasi ce5e923.
- [x] Perbaiki regresi terarah dan selaraskan fixture/dokumentasi terkait (≤1 jam).
- [x] Ulangi uji terdampak, cek menu/manifest dan paket connector; catat batas kelanjutan rilis (≤1 jam).

### Implikasi IP & Kepatuhan
OWNED_BY: ava. Perubahan terbatas pada regresi kode, fixture sintetis dan dokumentasi; tidak mengubah master, nilai rujukan, data pasien atau DB produksi. R-4s menerima konteks satu run secara eksplisit, bukan menebaknya dari riwayat. Referensi primer diperiksa 10 September 2026: https://www.westgard.com/westgard-rules.html. Struktur baru, pengamanan sesi dan pekerjaan Apps dipertahankan. Dokumen historis di bawah tidak menjadi instruksi untuk mengembalikan fallback yang keliru.

### Bukti penutupan verifikasi LIS — 11 September 2026
- Checkout terbaru main `0405e33`; commit sesudah baseline mengubah kompatibilitas antrean lokal (0048/local-engine), bukan memindahkan runtime LIS. Perubahan Apps, backlog, dan teks lot kontrol dari pekerjaan lain dipertahankan.
- Struktur: 6 boundary dan 17/17 domain valid; seluruh 125 berkas manifest runtime serta 35 jalur pada manifest historis RC1 masih tersedia. Ini verifikasi keberadaan, bukan kesamaan hash dengan rilis lama.
- Audit menu statis: 214 menu diperiksa, tanpa renderer, tabel/view, RPC, handler atau entri manifest yang hilang. Tidak menyatakan seluruh fitur sudah lolos UAT.
- Regresi akibat restrukturisasi direproduksi pada `verify-lis-integrity.cjs`: fallback R-4s mengambil dua nilai riwayat tanpa identitas run. Fallback sudah dihapus; fixture lama kini memberikan pasangan kontrol dalam run yang sama secara eksplisit dan menambahkan kasus negatif lintas run.
- Sesudah koreksi: verify-lis-integrity, verify-lis-his-sync, verify-lis-connector, syntax LIS dan verify-deploy-readiness lulus. Suite fase 2 lulus 14/14 skenario sintetis; bukan koneksi ke layanan eksternal.
- ZIP connector dibangun ulang. Pemeriksaan 11 September membuktikan 8 entri, isi sumber sesuai checkout dengan normalisasi LF, dan tidak memuat config.json. SHA256: `9ea3de71ff55efa8d85fd4c7122d47bc51fcb70a6cdd591f71d539e4beb014ff`.
- Kesimpulan: struktur baru dapat digunakan untuk melanjutkan pengembangan LIS; tidak perlu mengembalikan folder atau dokumen lama. Belum melakukan deploy, migrasi, pembacaan DB operasional, atau perubahan master. Dokumen RC1 tetap catatan historis; paket/manifest rilis berikutnya perlu mencerminkan baseline terkini dan pengujian staging.

## implementation_plan

# Rencana Implementasi â€” Penyempurnaan HIS & Antrean Publik

## Fase Restrukturisasi Multi-Domain â€” Audit Awal

### Struktur repositori final yang aman

```text
AVAQUEEN-platform-main/
â”œâ”€â”€ ava-platform/       # static runtime utama; URL deploy tidak berubah
â”œâ”€â”€ api/                # server functions dan runtime config
â”œâ”€â”€ config/             # domain, menu, boundary, tenant/deployment config
â”œâ”€â”€ db/                 # migrasi resmi, preflight, runbook, parity
â”œâ”€â”€ desktop-app/        # PGlite/Electron dan instalasi lokal
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ architecture/  # blueprint dan dokumen arsitektur
â”‚   â”œâ”€â”€ audit/          # laporan audit
â”‚   â””â”€â”€ project/        # plan, checklist, walkthrough, backlog
â”œâ”€â”€ scripts/            # generator, verifier, dan test
â”œâ”€â”€ security/           # kebijakan dan artefak security
â”œâ”€â”€ templates/          # template QMS dan deployment
â””â”€â”€ tools/              # utilitas pendukung
```

`ava-platform/` sengaja tetap menjadi satu static runtime karena seluruh domain
berbagi router, auth, asset, manifest, dan connector. Pemisahan produk dilakukan
di dalam boundary registry dan folder modul; memecah static root menjadi enam
build terpisah sekarang akan menambah duplikasi dan risiko route rusak.

### Keputusan arsitektur

Repositori tetap menjadi satu monorepo, tetapi aplikasi dipisahkan secara bertahap
berdasarkan enam boundary produk: `public-web`, `clinical-platform`,
`patient-portal`, `tech-platform`, `wellness-platform`, dan `public-surfaces`.
Folder lama tidak langsung dihapus. Fase pertama hanya menambahkan boundary,
registry, dan compatibility alias sehingga versi lokal tetap dapat dijalankan
selama satu kelompok aplikasi dipindahkan.

Fase AVA Tech kini sudah dipindahkan secara fisik ke
`ava-platform/modules/tech-platform/`. Manifest dibangkitkan ulang dari lokasi
baru; tidak dibuat salinan ganda pada folder lama sehingga sumber modul tetap
satu.

### Urutan fase eksekusi

1. **F0 â€” Baseline & freeze kontrak:** bekukan `config/domain.json`, inventaris
   route, renderer, manifest, asset bersama, auth, dan database reference.
2. **F1 â€” Boundary AVA Tech:** tempatkan tenant, customer, subscription,
   license, telemetry, monitoring, dan custom-module registry di bawah
   `tech-platform` melalui adapter, tanpa memindahkan file legacy terlebih dahulu.
3. **F2 â€” Portal & public surfaces:** pisahkan patient/corporate/wellness portal
   dan kiosk/display dari shell operasional; pertahankan URL lama melalui rewrite.
4. **F3 â€” Clinical platform:** kelompokkan HIS, LIS, radiologi, dan shared
   clinical services setelah dependency map dan UAT per domain disetujui.
5. **F4 â€” Packaging & customer deployment:** tambahkan manifest tenant:
   deployment mode, app version, DB version, enabled modules, license status,
   dan custom configuration.
6. **F5 â€” Retirement:** hapus alias, arsip SQL, dan artefak lama hanya setelah
   audit referensi, parity database, build lokal, dan smoke test domain lulus.

Artefak registry dan template deployment fase ini adalah
`config/application-boundaries.json` dan `config/deployment.template.json`.
Validasi dijalankan melalui `node scripts/verify-application-boundaries.js`.

### Audit menu awal

- 217 menu terdaftar; 214 menu berstatus `ada` dan seluruhnya memiliki route,
  renderer, dependency data, dan manifest.
- 19 menu hanya memiliki gap metadata `PAGE_TITLES`; gap ini diperbaiki pada
  router tanpa mengubah route atau hak akses.
- Kandidat review produk, bukan menu mati: viewer LIS, AVA Tech roadmap/modul/
  isu/sprint, analyzer, paket/membership, workforce/remunerasi, supportive
  examination, dan portal wellness.
- Catatan implementasi parsial yang terlihat dari konfigurasi: PACS masih
  menunggu sumber DICOM, sementara unggah manual adalah fallback yang valid.

### Implikasi IP & Kepatuhan

- Boundary baru bersifat generik dan tidak menyalin data, harga, atau identitas
  pelanggan AVA ke produk reusable.
- Tidak ada perubahan skema database, migrasi cloud, atau penghapusan data pada
  fase audit ini; local tetap menjadi sumber kebenaran.
- Data klinis dan data pasien tidak dipindahkan ke dokumentasi struktur. Semua
  pemindahan berikutnya wajib mempertahankan tenant isolation, RBAC, audit trail,
  dan referensi ISO 15189:2022 yang sudah ada.
- Penghapusan arsip atau database hanya boleh dilakukan setelah checkpoint
  pemilik data dan bukti dependency/parity tersedia.

### Hasil defect bisnis

- R-4s kini menerima riwayat kontrol lama sebagai fallback kompatibilitas, serta
  tetap mendukung daftar level pada run yang sama.
- Logbook nilai kritis memiliki helper validasi payload/SLA untuk simulasi dan
  kontrak UI; transaksi database tetap melalui jalur ack yang sudah ada.

## Tujuan

Membuat ruang `his.avahealth.sbs` dapat dipakai secara konsisten untuk alur HIS yang sudah ada, serta menyatukan pengambilan tiket dari `kiosk.avahealth.sbs` dengan konsol dan display `antrian.avahealth.sbs` melalui kontrak antrean yang sama.

## Batasan

- Tidak mengubah data produksi atau melakukan deploy tanpa langkah rilis eksplisit.
- Tidak mengaktifkan SATUSEHAT, payment gateway, atau integrasi eksternal lain.
- Endpoint publik kiosk hanya boleh menerbitkan tiket tanpa identitas pasien dan hanya untuk layanan yang diizinkan; kontrol petugas tetap terautentikasi.

## Work items

- [x] Petakan menu HIS, rute, renderer, dan modul termuat.
- [x] Perbaiki wiring atau kegagalan UI yang ditemukan dalam ruang HIS.
- [x] Jalankan audit menu serta suite HIS yang relevan.
- [x] Catat bukti hasil dan batas verifikasi.
- [x] Perbaiki kepadatan dan ketahanan layout sidebar HIS.
- [x] Audit final: menu, router, renderer, tombol, manifest, dan aksesibilitas UI.
- [x] Selesaikan seluruh temuan UI/routing yang dapat diperbaiki tanpa migrasi data.
- [x] Verifikasi regresi menyeluruh dan catat gap yang membutuhkan keputusan manusia.
- [x] Petakan ketidakselarasan kiosk, layar antrean, dan kontrak data antrean.
- [x] Bangun jalur simulasi lintas-subdomain yang memakai satu sumber antrean.
- [x] Verifikasi simulasi ambil nomor â†’ tampil pada layar antrean.
- [x] Jadikan kontrak kiosk sebagai migrasi HIS resmi, terjejak dan bukan skrip lepas.
- [x] Hubungkan Edge Function produksi ke prosedur kiosk khusus berbasis service-role.
- [x] Verifikasi migrasi, build desktop, dan kesiapan deploy Vercel/Supabase.
- [x] Ubah rail desktop menjadi sidebar ringkas berbasis ikon dengan grouping accordion yang tetap utuh.
- [x] Padatkan proporsi sidebar, topbar, dan area konten tanpa mengubah navigasi atau RBAC.
- [x] Konsolidasikan menu HIS menjadi domain kerja â†’ layanan â†’ modul agar layanan penunjang tidak memanjangkan sidebar.
- [x] Tambahkan pemilih seluruh modul HIS yang dapat dicari dari rail ringkas.
- [x] Tampilkan breadcrumb domain â†’ layanan â†’ modul secara konsisten saat navigasi.
- [x] Verifikasi akses RBAC, rute lama, responsivitas, dan kualitas skrip setelah penyempurnaan navigasi.
- [x] Pecah presentasi konfigurasi HIS menjadi domain master yang selaras dengan pola audit master.
- [x] Tambahkan konteks jumlah modul pada layanan sidebar tanpa mengubah definisi hak akses.
- [x] Jalankan audit regresi menu setelah pemetaan presentasi HIS diperbarui.

## Implikasi IP & Kepatuhan

- Perubahan mempertahankan data klinis di domain HIS dan tidak menambahkan data pasien nyata.
- Tidak ada aset AVA yang dipindahkan menjadi produk generik dalam pekerjaan ini.
- Kontrol RBAC, audit trail, dan pemisahan data klinis tetap menjadi batas desain; hasil uji lokal bukan pengganti validasi klinis, regulatori, atau integrasi produksi.
- Kiosk publik tidak mengirim atau menampilkan nama pasien. Penerbitan tiket dibatasi pada layanan yang diizinkan dan harus melalui endpoint khusus, bukan hak tulis tabel langsung.
- Antrean tetap induk HIS. Kiosk dan display adalah klien publik terbatas; hanya service-role server yang dapat menerbitkan tiket kiosk dan setiap tiket ditandai sumbernya.
- Perubahan sidebar hanya mengubah presentasi antarmuka dan preferensi lokal browser; tidak mengubah skema data, hak akses, maupun data klinis.
- Penggabungan menu HIS mempertahankan seluruh route dan penapisan RBAC yang telah ada; yang berubah hanya hierarki tampilan navigasi.
- Pemilih modul hanya memakai definisi menu yang sudah lolos RBAC di browser; ia tidak membaca atau menulis data klinis maupun menambah hak akses.

## Fase Kesiapan Produksi â€” 3 September 2026

### Urutan implementasi

1. [x] Konfigurasi runtime Vercel untuk URL dan anon key Supabase tanpa mengekspos service-role atau secret klinis.
2. [x] Jadikan `antrian.avahealth.sbs` route resmi menuju display antrean dalam konfigurasi deploy yang sama.
3. [x] Tambahkan pemeriksaan statis readiness deploy agar host dan runtime config tidak kembali terlewat.
4. [x] Siapkan migrasi antrean tenant-aware: tenant pada konfigurasi, loket, tiket, log, tampilan publik, dan RPC.
5. [x] Terapkan di kode proteksi endpoint publik yang tahan multi-instance: device registry, rate limit tersimpan, dan origin allowlist.
5a. [x] Siapkan preflight read-only dan runbook rollback untuk penerapan staging migrasi 0048.
6. [ ] Konsolidasikan SQL arsip menjadi migrasi formal berurutan, lengkap dengan preflight serta rollback operasional.
6a. [x] Tambahkan katalog dan audit otomatis agar referensi SQL arsip tidak hilang atau tidak terdokumentasi.
7. [x] Perluas Configuration Hub menjadi delapan domain HIS: fasilitas, praktisi, pasien, korporat, MCU, pembayaran, antrean, dan obat. Setiap domain mengarahkan modul yang siap dan menandai master yang masih berupa kerangka.
7a. [x] Pisahkan kembali menu konfigurasi/master dari menu operasional; tambahkan kerangka navigasi untuk cabang/unit, praktisi, pasien, korporat, MCU, pembayaran, antrean, obat, promo, dan telemedicine.
7b. [x] Rancang alur end-to-end, kontrak master, RBAC, integrasi, dan urutan rilis untuk 20 master baru sebelum membuat skema atau CRUD.
7c. [x] Paket Foundation P0 disiapkan sebagai source-only: registry multi-tenant, audit, preflight, runbook, dan UI 20 domain; belum diterapkan ke database mana pun.
8. [ ] Tambahkan test regresi RBAC dan alur kiosk â†’ loket â†’ display menggunakan database sementara.
9. [ ] Aktifkan integrasi eksternal hanya melalui staging dan UAT pemilik proses per vendor.

### Checkpoint wajib sebelum langkah 4, 6, dan 9

- Persetujuan pemilik database untuk perubahan skema dan rencana backup/rollback.
- Konfirmasi tenant produksi yang menjadi target serta pemilik data migrasi.
- Kredensial dan kontrak sandbox resmi untuk SATUSEHAT, BPJS, payment gateway, PACS, atau analyzer.

### Implikasi IP & Kepatuhan

- Endpoint runtime hanya dapat memuat konfigurasi aman untuk browser: URL dan anon key.
- Tenant-aware queue serta setiap migrasi skema tidak diterapkan ke cloud sebelum checkpoint karena mengubah data operasional.
- Secret integrasi hanya hidup pada fungsi server dan tidak boleh dimasukkan ke source atau Vercel public config.
- Struktur Configuration Hub adalah navigasi dan kerangka UI; tidak membuat tabel, mengubah data master, atau menyatakan master yang belum memiliki formulir sebagai fitur siap produksi.
- Menu baru tetap berstatus parsial sampai ada skema, validasi, RBAC, dan formulir penyimpanan yang disetujui. Tidak ada perubahan data master atau data pasien dalam tahap ini.
- Rancangan 20 master memisahkan konfigurasi dari transaksi dan memakai fixture sintetis; pelaksanaannya tidak mengizinkan secret integrasi di browser atau data klinis lintas tenant.

## Registry Master HIS â€” Implementasi Source 4 September 2026

### Urutan implementasi

1. [x] Tambahkan satu registry per-tenant untuk 20 domain master, kode unik, periode berlaku, status, dan versioning.
2. [x] Tambahkan RPC tulis terbatas peran, jejak append-only, alasan perubahan, dan soft archive.
3. [x] Hubungkan `queue_device` ke `queue_public_devices` tanpa memberi browser hak tulis perangkat publik.
4. [x] Tambahkan daftar, cari/filter, tambah, ubah, arsip, dan lihat audit untuk seluruh 20 domain dari menu serta hub Configuration.
5. [x] Buat preflight staging, runbook, katalog migrasi, dan pemeriksa kontrak statis 20 menu/domain.
6. [x] Bangkitkan ulang peta menu/manifest dan jalankan audit menu, keamanan modul, antrean, serta sintaks.
7. [ ] Terapkan `0050_his_master_registry.sql` ke staging sesudah backup dan persetujuan pemilik database.
8. [ ] UAT pemilik proses per domain, lalu aktivasi integrasi vendor hanya pada sandbox resmi.

### Implikasi IP & Kepatuhan

- Registry bersifat generik dan parameterized per tenant; tidak menyemai data pasien, kontrak, harga, atau credential pihak mana pun.
- Hanya referensi `vault://...` yang diterima UI untuk Telemedicine/SATUSEHAT. Secret, token, serta password tidak disimpan di browser maupun payload master.
- Perubahan master ber-governance membutuhkan alasan dan snapshot audit. Arsip tidak menghapus riwayat.
- Migrasi source tidak sama dengan perubahan database. Rilis staging/produksi tetap memerlukan backup, preflight, dan UAT sesuai `db/runbooks/0050_his_master_registry.md`.

## Audit Admission & Navigasi Konteks â€” 5 September 2026

### Urutan implementasi

1. [x] Audit read-only hub Admission, enam variasi registrasi, form kosong,
   Back Office, Queue, dan Queue Outpatient.
2. [x] Dokumentasikan perbedaan tujuan, tahapan, dan field kritis agar
   registrasi layanan, kit, paket, langganan, serta penggunaan langganan tidak
   kembali disatukan secara keliru.
3. [x] Ganti accordion rail bertingkat dengan panel konteks dua kolom:
   domain â†’ sub-menu â†’ modul.
4. [x] Pertahankan penyaringan RBAC, route/action asal, shortcut pencarian
   modul, breadcrumb, Escape, serta perilaku mobile.
5. [ ] Rancang kontrak transaksi dan UAT pemilik proses untuk enam variasi
   registrasi sebelum perubahan skema atau transaksi produksi.

### Implikasi IP & Kepatuhan

- Audit referensi hanya memetakan pola proses generik melalui layar kosong dan
  tidak memindahkan data, identitas, atau aset visual pihak ketiga.
- Perubahan navigasi bersifat presentasi lokal: tidak mengubah database,
  data klinis, hak akses, maupun integrasi eksternal.
- Pemisahan registrasi menjadi transaksi produksi memerlukan checkpoint
  pemilik database karena melibatkan model transaksi, pricing snapshot,
  penjaminan, paket, dan audit trail.

## Penyempurnaan Workspace Admission â€” 5 September 2026

### Urutan implementasi

1. [x] Padatkan halaman daftar registrasi: hilangkan breadcrumb/topbar khusus
   halaman, kartu KPI besar, serta header ganda; satukan tanggal, notifikasi,
   dan identitas pengguna pada satu header kerja.
2. [x] Letakkan pencarian, tanggal, jenis, laporan, tindakan registrasi, dan
   filter status dalam toolbar ringkas di atas tabel yang mengisi sisa layar.
3. [x] Pindahkan formulir registrasi/edit dari modal lebar ke workspace penuh
   yang tetap memakai state, validasi, serta proses simpan yang ada.
4. [x] Pertahankan modal hanya untuk pencarian/pemilihan data pendukung dan
   konfirmasi singkat; jangan mengubah kontrak API atau skema transaksi.
5. [x] Verifikasi sintaks, peta menu, audit menu/keamanan, dan preview lokal
   tanpa menulis data pasien.

### Implikasi IP & Kepatuhan

- Perubahan ini hanya mengatur presentasi dan alur kerja browser; tidak
  menambah field, mengubah skema database, kontrak API, atau data klinis.
- Form tetap menggunakan state dan validasi yang ada. Setiap variasi transaksi
  (OPD, layanan, kit, paket, langganan, pemakaian) masih berstatus bertahap
  sampai UAT proses dan checkpoint pemilik database menyetujui kontrak
  transaksinya.
- Tidak ada data pasien nyata dalam fixture, screenshot, atau dokumentasi
  verifikasi. Pop-up pemilih pendukung tetap berada di ruang aplikasi dan
  tunduk pada RBAC yang telah ada.

## Audit Login Lintas Domain & Menu — 2026

- [x] Aset CSS, JavaScript, font, dan gambar frontend pada domain privat dapat
  dimuat sebelum login; source map, konfigurasi, SQL, database, connector, dan
  file rahasia tetap ditolak.
- [x] Halaman login staf dibuat responsif, ber-brand, sadar nama domain, tanpa
  credential demo, auto-login, atau secret.
- [x] Seluruh 217 menu memiliki rute dan judul halaman; audit menu hidup tidak
  menemukan renderer, handler, tabel, RPC, atau manifest yang hilang.
- [x] Peta menu dan dokumentasi menu dibangkitkan ulang dari
  `config/menu.json`; route ID dan RBAC tidak diubah.
- [x] Security domain: 12/12 lulus; audit modul: 2.817/2.817 lulus; suite
  regresi: 17/17 suite lulus.

### Implikasi IP & Kepatuhan

- Perubahan hanya menyentuh presentasi login, kebijakan penyajian aset publik,
  dan artefak navigasi yang dibangkitkan. Tidak ada perubahan skema, connector,
  hak akses, atau data pasien.
- Aset yang dibuka anonim dibatasi ke kebutuhan rendering frontend; akses data
  dan endpoint aplikasi tetap melalui autentikasi, RBAC, dan RLS.

## Ergonomi Form Admission â€” 5 September 2026

### Urutan implementasi

1. [x] Ubah navigasi tahap form dari tab horizontal menjadi mini rail vertikal
   di sisi kiri pada desktop; setiap tahap tetap memiliki teks, urutan, dan
   target klik yang jelas.
2. [x] Padatkan lebar/padding field serta baris metadata agar dua kolom tetap
   proporsional, mudah dipindai, dan tidak mengurangi tinggi area input.
3. [x] Pertahankan tab horizontal yang dapat digulir pada ponsel agar rail
   tidak mengambil ruang kerja sempit.
4. [x] Verifikasi form OPD, variasi tab, kembali ke daftar, serta sintaks dan
   audit sumber tanpa menyimpan transaksi.

### Implikasi IP & Kepatuhan

- Perubahan murni pada komposisi tampilan dan ergonomi; tidak mengubah field,
  validasi, data pasien, hak akses, kontrak API, maupun skema transaksi.
- Identitas dan informasi layanan yang muncul saat verifikasi tetap sintetis
  atau keadaan kosong. Tidak ada penyimpanan, ekspor, atau integrasi eksternal.

## Konsolidasi Navigasi HIS & Shell Operasional â€” 5 September 2026

### Urutan implementasi

1. [x] Audit ulang read-only struktur menu referensi sampai level kelompok dan
   sub-menu operasional, tanpa membuka data transaksi atau melakukan perubahan.
2. [x] Lengkapi konteks Admission dengan empat kelompok kerja: Admission,
   Back Office, Queue, dan Queue Outpatient; koreksi lokasi presentasi menu
   yang masih terpencar tanpa menghapus rute atau mengubah RBAC.
3. [x] Terapkan shell navigasi ringkas yang seragam pada domain HIS: rail
   ikon, panel konteks dua tingkat, dan header operasional tanpa breadcrumb
   atau indikator API yang tidak relevan bagi petugas.
4. [x] Rapikan elemen form berulang melalui CSS terlingkup dan hapus label
   tahap yang tidak diperlukan, dengan fallback responsif pada tablet/ponsel.
5. [x] Jalankan audit menu, keamanan, sintaks, serta preview klik lintas
   kelompok; catat menu yang hanya bisa diverifikasi sampai level renderer.

### Implikasi IP & Kepatuhan

- Audit referensi dilakukan read-only pada struktur navigasi dan layar kosong;
  data pasien, daftar transaksi, konfigurasi, dan ekspor tidak disentuh.
- Pemetaan ulang hanya mengubah presentasi menu. Rute, RBAC, tabel, API, dan
  kontrak transaksi tetap memakai implementasi yang ada.
- Tidak ada data pasien nyata ditambahkan pada dokumentasi, fixture, maupun
  pengujian. Perubahan skema atau integrasi tetap memerlukan checkpoint
  pemilik database.

## Penyelesaian End-to-End Admission â€” 6 September 2026

### Urutan implementasi

1. [x] Petakan ulang enam alur Admission ke data dan kontrak yang sudah ada:
   OPD, layanan langsung, medical kit, paket, langganan, dan pemakaian paket.
2. [x] Buat tiap alur memiliki konteks layanan, field wajib, validasi pra-simpan,
   serta ringkasan transaksi yang berbeda tanpa menambah kolom basis data.
3. [x] Rapikan workspace daftar, form, pemilih layanan/paket, pembayaran,
   kasir, laporan, dan handoff antrean dengan komponen kompak responsif.
4. [x] Tambahkan pemeriksaan konsistensi mode pada UI dan payload, serta jalur
   aman bila data master atau layanan pendukung belum tersedia.
5. [x] Uji tiap mode hingga renderer/validasi/transisi dapat dicapai tanpa
   menyimpan transaksi; jalankan audit menu, sintaks, dan keamanan.

### Implikasi IP & Kepatuhan

- Tidak ada perubahan skema `admissions`, tabel master, nomor antrean, atau
  integrasi eksternal. Penyimpanan tetap memakai kontrak yang sudah ada.
- Uji dilakukan pada layar kosong atau data sintetis lokal; tidak membuat,
  mengubah, menghapus, mengekspor, atau mencetak data pasien produksi.
- Aturan klinis, diskon, penjamin, dan penebusan hak paket yang membutuhkan
  keputusan bisnis/DB tetap diberi validasi UI. Perubahan aturan otoritatif
  atau migrasi tabel memerlukan checkpoint pemilik database.

## Audit dan viewer Pelayanan Klinis â€” 6 September 2026

### Urutan implementasi

1. [x] Petakan menu referensi layanan ke kelompok HIS yang tepat dan tandai
   mana yang menjadi workflow klinis serta mana yang hanya viewer hasil LIS.
2. [x] Tambahkan viewer hasil read-only untuk Patologi Klinik, Mikrobiologi,
   dan Patologi Anatomi, dengan filter, status rilis, nilai rujukan, flag,
   serta jejak waktu sinkronisasi.
3. [x] Rapikan menu Pelayanan Klinis dan layar penunjang agar Audiometri,
   Spirometri, EKG/Treadmill, radiologi, dan hasil LIS tidak tercampur.
4. [x] Bangun ulang peta menu/manifest dan uji rute, responsivitas, serta
   audit menu hidup tanpa membuat atau mengubah hasil pasien.

### Implikasi IP & Kepatuhan

- Viewer HIS hanya membaca hasil yang telah dirilis oleh LIS. Tidak ada input,
  koreksi, validasi, persetujuan, atau pelepasan hasil dari sisi HIS.
- Tidak ada perubahan skema, koneksi LIS, konfigurasi perangkat, maupun data
  klinis produksi. Penyambungan API/LIS nyata tetap memerlukan checkpoint
  pemilik integrasi dan aturan otorisasi hasil.
- Nama bidang bersifat generik dan parameterized; data uji tetap kosong/lokal.

## Audit struktur operasional referensi HIS â€” 6 September 2026

### Urutan audit

1. [x] Inventarisasi menu Keuangan, Rekam Medis, Paket Layanan, Remunerasi,
   SATUSEHAT, dan Workforce terhadap rute serta modul AVA saat ini.
2. [x] Petakan alur lintas modul, pemilik proses, sumber data, dan batas
   antara konfigurasi dengan operasi.
3. [x] Catat kesenjangan menu, risiko duplikasi alur, dan prioritas desain.
4. [ ] Setelah persetujuan pemilik, rancang pengelompokan menu dan implementasi
   bertahap tanpa mengubah data atau integrasi produksi.

### Implikasi IP & Kepatuhan

- Audit hanya membaca struktur menu, rute, dan kode lokal. Tidak membuka,
  membuat, mengubah, atau menyalin data pasien, transaksi, kredensial, atau
  konfigurasi eksternal.
- Perubahan pada payroll, remunerasi, rekam medis, maupun SATUSEHAT bersifat
  berdampak tinggi dan akan memerlukan checkpoint bisnis/DB sebelum implementasi.

## Implementasi struktur operasional HIS â€” 6 September 2026

### Urutan implementasi

1. [x] Pisahkan menu operasional dari konfigurasi untuk Rekam Medis, Paket &
   Membership, Keuangan & Remunerasi, Workforce, serta Integrasi SATUSEHAT.
2. [x] Lengkapi hub navigasi dan rute yang dapat memakai kontrak data yang
   sudah ada; perbaiki label, tujuan, dan tab agar tidak ada menu tumpang tindih.
3. [x] Implementasikan dashboard/reminder read-only untuk gap yang tidak
   memerlukan skema baru dan audit kembali tiap rute.
4. [x] Tinjau kebutuhan tabel/RPC baru untuk entitlement paket, period closing
   remunerasi, dan antrean retry SATUSEHAT; berhenti untuk checkpoint sebelum
   migrasi atau koneksi eksternal.
5. [x] Uji visual serta audit syntax/menu/manifest/keamanan tanpa transaksi.

### Implikasi IP & Kepatuhan

- Penyempurnaan UI, rute, dan laporan baca-saja tidak mengubah data klinis.
- Ledger entitlement paket, payroll/remunerasi, dan integrasi SATUSEHAT
  berpotensi mengubah skema atau mengirim data eksternal. Implementasi
  otoritatifnya hanya dilakukan setelah checkpoint pemilik database/integrasi.
- Tidak ada data pasien nyata dipakai untuk uji. Konfigurasi dan contoh harus
  generik/parameterized agar tidak mengikat ke satu fasilitas.

## Perombakan web publik AVA Health â€” 2026-09-05
Rencana: (1) audit portal dan routing (â‰¤1 jam), (2) bangun profil publik responsif, detail brand, katalog, sejarah, sertifikasi, kontak (â‰¤1 jam), (3) validasi tautan/aset/routing dan preview (â‰¤1 jam).
Arah visual: editorial kesehatan, putih dan navy, aksen emerald, tipografi besar, enam brand sebagai portofolio bisnis. Pertahankan stack statis dan deployment Vercel yang ada.
### Implikasi IP & Kepatuhan
OWNED_BY: ava untuk konten situs perusahaan yang sudah tersedia; tidak dipindahkan menjadi produk generik. Tidak mengubah master katalog, DB, provider LLM, atau aplikasi operasional. Hapus autentikasi dari halaman publik; hanya tautkan apps.avahealth.sbs. Tidak menerbitkan klaim sertifikasi, manfaat klinis, tanggal sejarah, atau produk tersedia tanpa bukti. Kontak bersumber portal lama. Metadata sumber dan kebutuhan verifikasi dicatat dalam audit. Publikasi produksi terpisah dari penyuntingan lokal.

## Pengayaan profil publik premium â€” 2026-09-05
Rencana: 1) teliti sumber kesehatan primer dan rumus kalkulator (â‰¤1 jam); 2) perluas enam profil brand, visi/misi, model bisnis, alur manufaktur sebagai skenario operasional (â‰¤1 jam); 3) bangun jurnal kesehatan bersumber dan kalkulator lokal BMI/kalori serta penyempurnaan premium (â‰¤1 jam); 4) verifikasi kalkulasi, konten, tautan, ekspor dan preview (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Pengguna mengotorisasi rancangan dengan asumsi semua lini sudah berjalan. Asumsi manufaktur/farmasi diberi penanda konsep, tidak menjadi klaim izin atau operasi faktual. Tidak menambah klaim CPOB/izin edar terverifikasi. Artikel orisinal berbasis sumber primer yang diperiksa tanggal 2026-09-05; tidak mengaku telah ditinjau dokter. Kalkulator khusus dewasa, bukan diagnosis atau resep diet; input hanya di memori browser. Tidak mengubah master data, vendor atau sistem produksi.

## Konten komersial setelah discovery â€” 2026-09-05
Rencana: susun positioning AVA Tech dan hierarki AVA/Queen (â‰¤1 jam); terapkan beranda, tiga solusi faskes, demo/pilot, model biaya, investor dan ekspansi produk (â‰¤1 jam); verifikasi seluruh halaman, konsistensi status, tautan dan preview (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Sumber fakta adalah jawaban pemilik dalam percakapan: seluruh lini dalam pengembangan; HIS/LIS/Apps siap demo; laporan terbukti di demo tanpa jenis laporan spesifik terkonfirmasi; tersedia demo/uji coba terbatas. Hindari angka traction, sertifikat, nama anak PT, bukti produksi atau laporan contoh yang belum diberikan. Queen adalah brand usaha sendiri, AVA korporat dan AVA Tech B2B. Produk herbal prioritas ekspansi, pabrik bukan klaim kapasitas aktual. Biaya setup/modular ditambah lisensi bulanan tanpa harga rekaan. Tidak mengubah data master, aplikasi operasional atau integrasi eksternal; tautan email hanya menyiapkan permintaan pengguna, bukan mengirim pesan.

## Struktur multipage dan identitas bisnis â€” 2026-09-05
Rencana: audit dokumen identitas (â‰¤1 jam), pecah halaman dan navigasi (â‰¤1 jam), tulis profil rinci serta Health/Lab fisik dan Care & Wellness inklusif (â‰¤1 jam), verifikasi tautan lintas halaman/preview (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Sumber: instruksi terbaru pemilik, `docs/architecture/AVA HEALTH SOLUTION THE FUTURE.md` (Vol 3.0, 2026), dan `docs/architecture/AVA-DOC-ARCH-2026-V5_Arsitektur_Sistem_6_Unit_Usaha.md`. PDF tidak ditemukan melalui pencarian file termasuk hidden/ignored; lokasi diminta, pekerjaan independen dilanjutkan. Publikasikan narasi korporat, visi, nilai, dan lingkup bisnis; jangan salin formulasi, HPP/harga privat, proyeksi investor internal, atau rincian teknis rahasia. Instruksi terbaru mengungguli cakupan Care khusus perempuan dalam dokumen lama. Faskes dan lab milik sendiri dijelaskan berdasarkan konfirmasi pemilik; jangan reka alamat, izin, jaringan cabang, sertifikasi, tanggal pendirian. Tidak mengubah DB atau aplikasi operasional.

## Kisah perusahaan & founder â€” 2026-09-06
Rencana: perluas narasi dari dokumen korporat dan discovery (â‰¤1 jam), buat halaman sejarah serta founder dengan ruang foto (â‰¤1 jam), verifikasi halaman dan tautan (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Founder/Owner/CEO: Ace Anwar sesuai dokumen induk dan instruksi pemilik. Gunakan pengalaman operasional lab, informatika dan mutu yang tersedia. Tidak mengarang pendidikan, tanggal berdiri, pengalaman pasien, pencapaian, kutipan pribadi atau timeline bertanggal. Sejarah ditulis sebagai latar dan perkembangan gagasan; rencana ekspansi dipisahkan dari status saat ini. Ruang foto disengaja sesuai permintaan, tanpa foto orang pengganti atau URL gambar rusak. Konten publik tidak memuat formula/proyeksi internal.

## Audit dan perapihan LIS â€” 2026-09-06
Rencana: audit navigasi dan akses produksi (â‰¤1 jam), rapikan label/pengelompokan serta tema khusus LIS (â‰¤1 jam), periksa rute, generator, dan sintaks (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Perubahan presentasi aplikasi sendiri, tanpa pemindahan aset ke produk generik. Tidak mengubah ID menu, RBAC, skema, nilai rujukan, aturan QC, validasi klinis atau integrasi produksi. Akses produksi berhenti pada halaman login; pengujian kode lokal tanpa data pasien. Istilah klinis penting dipertahankan; rincian teknis tetap ada dalam deskripsi dan konfigurasi.

## LIS â†’ HIS: pemilihan layanan dan tagihan â€” 2026-09-06
Rencana: (1) telusuri kontrak admisi/layanan dan hapus harga/branding workstation (â‰¤1 jam); (2) buat API transaksi layanan klinis dan antrean rekonsiliasi HIS dengan identitas order, deduplikasi, dan konflik versi (â‰¤1 jam); (3) tampilkan perubahan LIS pada admisi HIS, gunakan perhitungan HIS saat penetapan tagihan, uji sintetis dan dokumentasikan deployment (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Pengguna mengotorisasi sinkronisasi skema HIS/LIS; implementasi migrasi lokal dan kontrak API boleh dikerjakan. Tidak menjalankan migrasi/menulis DB produksi. LIS mengirim ID layanan tanpa nominal pembayaran; HIS tetap menentukan harga/diskon dan status pembayaran. Tidak mengubah kunci master tes, hasil tervalidasi atau transaksi sudah dibayar. Perubahan layanan dikirim sebagai permintaan teraudit ke HIS, bukan menimpa tagihan final. Data pengujian sintetis; API wajib autentikasi, pembatasan tenant dan idempotensi.

## Audit mendalam LIS berbasis brosur â€” 2026-09-06
Rencana: baca 12 halaman brosur beserta visual (â‰¤1 jam), audit modul/UI/status/API dan reproduksi temuan menggunakan data sintetis (â‰¤1 jam), tulis matriks gap/prioritas/menu/alur target dan kriteria penerimaan (â‰¤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava untuk hasil audit; brosur Sysmex adalah referensi pihak ketiga, bukan materi untuk disalin ke produk. Gunakan kemampuan dan prinsip alur sebagai pembanding, tanpa menyalin merek, tampilan, screenshot, atau klaim instalasi. Audit tidak menyatakan sertifikasi atau kesetaraan produk. Tidak mengubah proses klinis, data master, DB produksi, atau menjalankan pengiriman data pasien. Prioritas perubahan didasarkan pada bukti kode dan uji sintetis; status deployment dicatat terpisah.
# Perbaikan dan rilis LIS â€” 2026-09-06

Rencana per irisan â‰¤1 jam: (1) benahi kebenaran dashboard/grafik/status panel dan pesan simpan; (2) satukan evaluator QC serta tutup autoverifikasi tidak aman; (3) perbaiki identitas riwayat, laporan dan helper/entry lama; (4) perkuat API transisi hasil dan connector, uji sintetis; (5) rapikan menu/responsivitas, jalankan release checks dan periksa target deployment; (6) rilis artefak yang lolos, dokumentasikan bukti dan batas operasional.

## Implikasi IP & Kepatuhan

OWNED_BY: ava. Pengguna secara eksplisit meminta implementasi dan release setelah audit. Otorisasi ini mencakup perbaikan aplikasi dan persiapan/deployment rilis pada target proyek yang terbukti; tidak mencakup mengarang SOP klinis, mengubah nilai master, memindahkan data pasien atau mengaktifkan fitur belum tervalidasi. Perubahan operasional diuji dengan data sintetis. Autoverifikasi tetap ditahan jika penjagaan server belum tervalidasi. Tidak menyalin aset brosur. Hindari mengikutsertakan perubahan task lain pada rilis; status deployment dan pengujian alat dilaporkan apa adanya.

## Penyelarasan navigasi LIS dengan audit layanan referensi â€” 7 September 2026

### Urutan implementasi

1. [x] Audit read-only menu, sub-menu, halaman, tab, toolbar, tabel, dan alur layanan referensiâ€”termasuk anamnesis/specimen, audiometri, spirometri, patologi, radiologi, dan layanan penunjang.
2. [x] Bedakan secara eksplisit tiga batas kerja: HIS klinis, LIS pra/analitik/pasca-analitik, dan viewer hasil lintas-sistem.
3. [x] Rapikan menu LIS menjadi kelompok kerja yang ringkas dan berorientasi peran tanpa menduplikasi input klinis dari HIS.
4. [x] Tambahkan konteks handoff order/hasil untuk layanan non-lab sebagai navigasi baca-saja atau tautan antar-workspace bila rute telah tersedia.
5. [x] Verifikasi rute, RBAC/menu, sintaks, dan responsivitas menggunakan data kosong/sintetis; jangan membuat transaksi, data pasien, atau koneksi produksi.

### Implikasi IP & Kepatuhan

- Audit referensi hanya membaca UI yang terlihat dan tidak menyalin data pasien, konfigurasi privat, atau aset visual pihak ketiga.
- LIS tetap menjadi sumber kerja spesimen, pemeriksaan, mutu, validasi, dan rilis hasil lab. Audiometri, spirometri, radiologi, dan anamnesis klinis tetap dimiliki HIS; LIS hanya menerima order atau menyajikan hasil yang memang berada pada kontrak data yang disetujui.
- Tahap ini tidak mengubah skema, RLS, integrasi analyzer, koneksi LIS/HIS produksi, atau hasil klinis. Perubahan kontrak lintas-sistem memerlukan checkpoint pemilik database dan integrasi.

## Konsistensi halaman kerja LIS dan tema terang/gelap â€” 7 September 2026

### Urutan implementasi

1. [x] Inventarisasi dialog berdasarkan risiko dan panjang tugas: halaman penuh untuk input kerja klinis; dialog singkat hanya untuk konfirmasi, pencarian cepat, atau tindakan atomik.
2. [x] Ubah input hasil pemeriksaan (batch dan per-tes) menjadi workspace halaman penuh dengan kembali ke daftar hasil yang jelas; anamnesis serta pemeriksaan penunjang mengikuti pola yang sama.
3. [x] Kurangi ikon dekoratif pada toolbar, tombol, kartu, dan keluaran cetak; pertahankan hanya ikon yang membantu orientasi global.
4. [x] Terapkan token warna semantik pada workspace LIS agar teks, status, fokus, dan latar terbaca pada tema terang serta gelap.
5. [x] Uji sintaks, menu/manifest, pemeriksaan kontras kode, dan tinjauan visual dua tema memakai data kosong/sintetis.

### Implikasi IP & Kepatuhan

- Perubahan ini hanya mengatur presentasi dan navigasi lokal; tidak mengubah skema, payload, status klinis, nilai hasil, data pasien, atau integrasi produksi.
- Status klinis tetap selalu ditulis sebagai teks selain warna. Tema tidak mengubah arti status, urutan validasi, ataupun otorisasi peran.
- Tidak memakai ataupun merekam data pasien nyata saat pengujian visual.

## Koreksi sasaran: workspace HIS â€” 7 September 2026

### Urutan implementasi

1. [x] Pastikan pemetaan `his.avahealth.sbs` menuju workspace HIS, bukan LIS; keduanya berbagi artefak build tetapi lingkup menu dipilih menurut host.
2. [x] Terapkan pola halaman penuh pada alur HIS yang panjang: registrasi sudah berupa workspace, anamnesis dipindahkan dari modal ke halaman penuh.
3. [x] Kurangi ikon dekoratif pada toolbar/form Registrasi HIS dan gunakan label tindakan eksplisit.
4. [x] Wariskan perbaikan tema dan kontras global ke HIS; tidak mengubah skema maupun transaksi.

### Implikasi IP & Kepatuhan

- Ini hanya koreksi target UI HIS. Tidak mengubah nilai klinis, data pasien, antrean, tagihan, otorisasi, skema, atau layanan produksi.
- Dialog pendek tetap dipakai untuk tindakan atomik seperti konfirmasi, pemilih cepat, atau penerbitan nomor; input klinis/administratif panjang menggunakan halaman penuh.

## Konsolidasi indeks seluruh kategori HIS â€” 7 September 2026

### Urutan implementasi

1. [x] Audit ulang pola navigasi referensi secara baca-saja: domain di rel kiri, kelompok proses pada area kerja, lalu daun menu di dalam kelompok.
2. [x] Ubah indeks kategori HIS menjadi direktori ringkas: navigasi kelompok di sisi area kerja dan daftar fungsi di kanan, tanpa menambah rute atau mengubah RBAC.
3. [x] Ringkas ukuran kartu, jarak, dan ikon dekoratif; pertahankan deskripsi serta status ketersediaan agar fungsi tetap dapat dipindai.
4. [x] Verifikasi pembentukan menu, semua action, sintaks, aksesibilitas keyboard, tema terang/gelap, dan regresi menu hidup.

### Implikasi IP & Kepatuhan

- Referensi eksternal hanya dipakai untuk memahami pola navigasi dan informasi yang terlihat; tidak menyalin aset visual, data pasien, konfigurasi privat, atau data transaksi.
- Perubahan terbatas pada layer presentasi/navigasi lokal. Tidak mengubah peta peran, rute, skema, tabel, RPC, data klinis, tagihan, antrean, maupun integrasi produksi.
- Label status tetap tertulis, bukan hanya dibedakan oleh warna. Menu yang belum tersedia tetap ditandai dan tidak dibuat seolah berfungsi.

## Perapihan pusat konfigurasi HIS â€” 8 September 2026

### Urutan implementasi

1. [x] Tinjau ulang peta konfigurasi terhadap rute master dan operasional yang tersedia.
2. [x] Ubah pusat konfigurasi serta halaman domainnya menjadi direktori teks yang padat dan konsisten dengan indeks kategori.
3. [x] Hilangkan ikon dekoratif dari tombol/tab konfigurasi dan pertahankan status serta field scope sebagai teks eksplisit.
4. [x] Jalankan pemeriksaan rute, handler, sintaks, dan regresi manifest; tanpa menjalankan perubahan master atau integrasi.

### Implikasi IP & Kepatuhan

- Implementasi hanya merapikan presentasi rute konfigurasi yang telah ada. Tidak membuat atau mengubah data master, konfigurasi perangkat, kredensial, antrean, maupun koneksi eksternal.
- Item yang belum memiliki form operasional harus tetap diberi status jujur; perubahan skema dan penyambungan DB memerlukan checkpoint pemilik database.

## Workspace konfigurasi antrean â€” 8 September 2026

### Urutan implementasi

1. [x] Audit modal pada alur HIS untuk membedakan aksi atomik dari formulir konfigurasi yang memerlukan konteks.
2. [x] Pindahkan formulir loket dan prefiks/kuota layanan dari modal ke halaman kerja penuh dengan kembali eksplisit.
3. [x] Pertahankan validasi, pemetaan tabel, dan penyegaran daftar setelah simpan; tidak menjalankan tulis data saat pengujian.
4. [x] Jalankan pemeriksaan sintaks, struktur menu, rute/handler, dan integritas modul.

### Implikasi IP & Kepatuhan

- Perubahan hanya menggeser UI formulir yang sudah ada; payload, validasi, tabel, serta kewenangan penulisan tetap sama.
- Loket, kuota, perangkat antrean, dan koneksi kiosk/display tidak dibuat atau diubah oleh pekerjaan ini. Aktivasi/penyelarasan lingkungan produksi tetap memerlukan checkpoint integrasi.

## Workspace perjanjian pasien â€” 8 September 2026

### Urutan implementasi

1. [x] Klasifikasikan form perjanjian sebagai workflow panjang: identitas, layanan, jadwal, sumber daya, catatan, dan validasi bentrok.
2. [x] Ubah form modal menjadi halaman kerja penuh dengan kembali/batal eksplisit ke daftar perjanjian.
3. [x] Pertahankan validasi mandatory dan pengecekan sumber daya sebelum simpan; kembali ke daftar hanya setelah respons berhasil.
4. [x] Jalankan pemeriksaan sintaks serta regresi menu/rute/modul tanpa membuat perjanjian baru.

### Implikasi IP & Kepatuhan

- Tidak ada perjanjian, identitas pasien, nomor telepon, atau pesan pengingat yang dibuat/diubah selama pekerjaan ini.
- Perubahan UI tidak mengubah aturan validasi, payload, penerima pesan, atau integrasi eksternal. Pengiriman pengingat tetap aksi eksplisit operator.

## Workspace master paket â€” 8 September 2026

### Urutan implementasi

1. [x] Klasifikasikan form paket sebagai form panjang: kode, nama, segmentasi, dua tarif, HPP, TAT, deskripsi, persiapan, dan status.
2. [x] Ubah buat/ubah paket dari modal menjadi halaman kerja penuh dengan kembali eksplisit ke katalog paket.
3. [x] Pertahankan validasi kode/nama, payload, dan penyegaran katalog setelah simpan sukses.
4. [x] Jalankan pemeriksaan sintaks, menu/rute, keamanan modul, dan pemeriksaan diff tanpa melakukan perubahan master.

### Implikasi IP & Kepatuhan

- Ini perubahan presentasi form. Tidak membuat, mengubah, menghapus, atau menerbitkan paket, tarif, HPP, maupun instruksi persiapan pasien.
- Penetapan katalog/tarif dan perubahan master tetap tunduk pada otorisasi operasional yang ada; tidak ada skema atau integrasi produksi yang diubah.

## Penuntasan menu konfigurasi yang terlihat belum aktif â€” 8 September 2026

### Urutan implementasi

1. [x] Periksa seluruh status di `config/menu.json`: seluruh 214 menu aktif, tidak ada menu berstatus `belum`.
2. [x] Cocokkan label `Kerangka master` dengan registry CRUD yang sudah ada dan sambungkan setiap master yang dipetakan.
3. [x] Tambahkan domain Integrasi & Konektivitas untuk flow antrean, registry kiosk/display, telemedicine, dan SATUSEHAT.
4. [x] Verifikasi sintaks, struktur menu, handler/rute, dan audit modul; tidak menjalankan migrasi atau menulis data produksi.

### Implikasi IP & Kepatuhan

- Label kesiapan hanya diubah setelah rute master dan field registry ditemukan di kode. Ini bukan klaim bahwa konfigurasi telah diisi atau integrasi eksternal telah diaktifkan.
- SATUSEHAT, kiosk/display lintas-domain, dan telemedicine tetap menyimpan hanya referensi secret; aktivasi koneksi dan migrasi lingkungan produksi memerlukan checkpoint pemilik integrasi/database.

## Audit Apps fase awal â€” 7 September 2026

### Rencana (sub-task masing-masing < 1 jam)
1. Audit halaman publik dan sumber login, modal, cache, serta sesi.
2. Rapikan login responsif: bahasa Indonesia, akun kosong, hapus akses demo publik dan klaim sertifikasi tanpa bukti.
3. Perbaiki autentikasi fail-closed, peran dari profil, dan pemulihan sesi; modal tertutup tidak dapat difokuskan.
4. Verifikasi sintaks, regresi autentikasi dengan mock sintetis, rute, dan browser desktop/mobile lokal.

### Implikasi IP & Kepatuhan
OWNED_BY: ava (pemeliharaan aplikasi yang sudah ada; bukan ekstraksi produk generik).
Tidak mengubah skema, kunci katalog, nilai klinis, provider LLM, atau integrasi eksternal. Tidak menulis data produksi. Data uji sintetis. Klaim sertifikasi di halaman masuk dihapus karena bukti tidak tersedia dalam audit. Otorisasi server/RLS dan simulasi klinis di modul lain tetap perlu audit terpisah sebelum peluncuran produksi.

### Hasil audit Apps â€” 8 September 2026
Implementasi lokal dan verifikasi selesai. Detail bukti berada di bagian walkthrough dokumen ini dan docs/AUDIT_APPS_FASE_AWAL_2026-09-08.md. Reload sementara meminta login ulang; SSO query token dihentikan sampai tersedia verifikasi server. Tidak ada deployment atau penulisan produksi.

## Menu Apps siap uji â€” 8 September 2026
### Rencana
1. Inventarisasi menu, target panel, renderer, dan status fungsi (<1 jam).
2. Satukan label Indonesia, perbaiki routing/active state dan pemuatan data (<1 jam).
3. Isi beranda/profil dari akun; pisahkan fitur konsep, tampilkan empty/error state nyata (<1 jam).
4. Uji semua target menu pada fixture sintetis lokal dan regresi autentikasi (<1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Tidak mengubah skema, data katalog, integrasi, RBAC server, atau data produksi. Tidak mengisi halaman kosong dengan data pasien/hasil/keuangan rekaan. Menu konsep tetap terdokumentasi dan ditandai belum tersedia; tidak dianggap operasional. Fixture hanya di server localhost terpisah dan tidak ikut output deployment.

## Audit keamanan domain dan sesi â€” 10 September 2026
### Rencana
1. Audit statis autentikasi, kredensial, routing dan inventaris domain; pemeriksaan HTTP tanpa login/data pasien (<1 jam).
2. Hapus kredensial demo/bypass dan penerimaan sesi dari URL; batasi persistensi sesi dan file deploy (<1 jam).
3. Uji negatif sintetis, dokumentasikan risiko backend/produksi dan tindakan deployment (<1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Perbaikan keamanan untuk sistem ini; tidak menyalin aset ke produk generik, mengubah master/katalog, atau membaca data pasien. Tidak menghubungkan DB produksi. Klaim keamanan dibatasi bukti; rotasi akun dan RLS produksi membutuhkan akses administratif yang terverifikasi. Hanya www.avahealth.sbs merupakan website publik; domain operasional memerlukan kontrol akses.

### Klarifikasi dan hasil keamanan â€” 10 September 2026
Pengguna menegaskan semua domain selain www harus membutuhkan akun staf. Gerbang server memakai UUID staf yang disetujui administrator; metadata role browser bukan dasar akses. Konfigurasi kosong menolak akses, sehingga daftar staf dan build Vercel harus disiapkan sebelum penerapan. Pengujian lokal selesai; deployment, rotasi akun dan verifikasi backend produksi belum selesai. Tidak ada perubahan DB produksi.

---

## task

# Checklist â€” Penyempurnaan HIS

## Restrukturisasi Multi-Domain â€” Audit & Fase Eksekusi

- [x] Audit 217 menu terhadap router, renderer, data dependency, dan manifest.
- [x] Identifikasi 19 gap metadata `PAGE_TITLES`.
- [x] Lengkapi judul halaman untuk menu yang sudah memiliki implementasi.
- [x] Catat dua suite regresi yang gagal sebagai defect terpisah, bukan dianggap
  sebagai masalah struktur folder.
- [ ] Bekukan kontrak domain, route, auth, shared assets, dan DB reference.
- [x] Tambahkan registry enam application boundary tanpa memutus path legacy.
- [x] Tambahkan template deployment tenant untuk local/web installation.
- [x] Tambahkan validator boundary terhadap `config/domain.json` dan filesystem.
- [x] Perbaiki rule Westgard R-4s dengan kompatibilitas riwayat QC lama dan
  dukungan same-run multi-level.
- [x] Perbaiki helper pencatatan nilai kritis agar memvalidasi payload dan SLA
  <15 menit tanpa membuat transaksi database palsu.
- [x] Pindahkan lima modul AVA Tech ke `modules/tech-platform/` dan regenerasi
  manifest tanpa memutus router atau connector.
- [x] Verifikasi ulang connector, menu hidup, security, auth, dan seluruh suite.
- [ ] Bangun dependency map sebelum memindahkan file.
- [ ] Buat boundary `tech-platform` dengan adapter kompatibilitas.
- [ ] Pisahkan portal dan public surfaces dengan rewrite route lama.
- [ ] Kelompokkan clinical platform setelah UAT domain.
- [ ] Tambahkan manifest tenant/deployment/module untuk instalasi customer.
- [ ] Verifikasi build lokal, parity DB, smoke test, dan rollback tiap fase.
- [ ] Hapus alias/arsip/artefak hanya setelah seluruh referensi nol dan checkpoint
  pemilik data disetujui.

- [x] Inventaris HIS selesai.
- [x] Temuan UI/routing HIS direproduksi.
- [x] Perbaikan terapkan tanpa menyentuh skema data.
- [x] Audit menu tidak menemukan renderer, tabel/view, RPC, handler, atau manifest yang hilang untuk ruang HIS.
- [x] Suite uji HIS lulus.
- [x] Bukti dicatat di bagian walkthrough dokumen ini.
- [x] Sidebar HIS tidak menyisakan ruang kosong antar accordion dan submenu tidak dapat terkompresi.
- [x] Audit final UI dan navigasi selesai.
- [x] Temuan yang dapat ditindak diperbaiki.
- [x] Suite regresi menyeluruh lulus.
- [x] Kiosk memakai sumber antrean bersama, bukan `localStorage` per-subdomain.
- [x] Display antrean membaca nomor dan panggilan dari sumber yang sama.
- [x] Simulasi lintas-subdomain diverifikasi tanpa data pasien nyata.
- [x] Kontrak kiosk dipindahkan ke migrasi HIS resmi dan bukan skrip SQL lepas.
- [x] Edge Function produksi memakai prosedur kiosk khusus berbasis service-role.
- [x] Peta domain, build desktop, dan audit regresi diverifikasi ulang.
- [x] Sidebar desktop ringkas: ikon sebagai keadaan awal, ekspansi eksplisit, dan grouping accordion tetap tersedia.
- [x] Kepadatan visual topbar dan konten disesuaikan untuk layar operasional.
- [x] Menu HIS dirapikan dalam hierarki domain kerja â†’ layanan â†’ modul tanpa menghapus akses menu mana pun.
- [x] Pemilih modul dan pencarian menu HIS tersedia dari rail ringkas.
- [x] Breadcrumb kontekstual memperlihatkan domain, layanan, dan halaman aktif.
- [x] Regresi navigasi serta sintaks skrip diverifikasi.
- [x] Konfigurasi HIS dikelompokkan menjadi akses, data awal, pasien, fasilitas, antrean, jadwal, dan integrasi.
- [x] Jumlah modul terlihat pada level layanan sidebar.
- [x] Audit menu HIS diulang setelah penyempurnaan.
- [x] Konfigurasi runtime deploy dan redirect antrian ditambahkan tanpa menyentuh data klinis.
- [x] Pemeriksaan statis readiness deploy ditambahkan.
- [x] Migrasi antrean multi-tenant dan proteksi perangkat publik disiapkan; belum diterapkan ke database mana pun.
- [x] Pemeriksaan kontrak statis antrean multi-tenant ditambahkan.
- [x] Preflight read-only dan runbook staging/rollback migrasi 0048 disiapkan.
- [x] Audit otomatis referensi migrasi legacy dan katalog jalur rilis ditambahkan.
- [x] Configuration Hub diperluas dengan jalur HIS yang sudah tersedia.
- [x] Delapan domain Configuration HIS dapat dibuka langsung dari sidebar dan membedakan modul tersedia dari kerangka master.
- [x] Menu konfigurasi dan menu operasional dipisahkan; 20 master baru ditambahkan sebagai kerangka berstatus parsial dengan field blueprint yang terlihat.
- [x] Rancangan end-to-end 20 master diselesaikan sebelum eksekusi skema/CRUD.
- [x] Registry source untuk 20 master dibuat: daftar, filter, tambah, ubah, arsip, audit, dan field domain spesifik.
- [x] Migrasi `0050` menegakkan tenant isolation, role write gate, versioning, audit append-only, dan sinkronisasi perangkat antrean.
- [x] Preflight, runbook, katalog migrasi, serta pemeriksa kontrak 20 menu/domain tersedia.
- [x] Peta menu dan manifest dibangkitkan ulang; audit menu, audit keamanan, dan uji antrean lulus.
- [x] Tambahkan `<select id="role-switcher-select">` pada `.sidebar-user-card` di `index.html`.
- [x] Buat fungsi `switchActiveRole(newRole)` di `app.js` untuk alih role real-time tanpa logout.
- [x] Tambahkan toggle sub-role Korporat (Maker vs Approver) pada `corporate-view`.
- [x] Perbarui `renderSidebarMenu()` dan styling di `style.css` agar dropdown role switcher responsif.
- [x] Verifikasi sintaks dan uji alih role lintas 5 mode (Pasien, Member, Corporate, Nakes, Referral).
- [x] Dokumentasikan bukti pengujian pada bagian walkthrough dokumen ini.
- [x] Audit final 47 view panels & Arsitektur 5 Pilar Navigasi 7 Modul Wellness dengan Wearable Device Sync (100% Pass).

- [x] Audit referensi Admission read-only hingga variasi registrasi, Back Office, Queue, dan Queue Outpatient.
- [x] Dokumentasikan batas proses rawat jalan, layanan, medical kit, paket, langganan, dan pemakaian langganan.
- [x] Ubah rail menu bertingkat menjadi panel konteks domain â†’ sub-menu â†’ modul.
- [x] Pertahankan RBAC, action/route, breadcrumb, pencarian seluruh modul, Escape, dan responsivitas.
- [ ] Menunggu checkpoint skema/UAT sebelum enam variasi registrasi menjadi transaksi produksi terpisah.

## Workspace Admission â€” 5 September 2026

- [x] Daftar registrasi menggunakan header kerja ringkas dan area tabel utama.
- [x] Toolbar menggabungkan pencarian, filter periode/jenis/status, laporan, dan registrasi.
- [x] Form tambah/ubah Admission dibuka sebagai halaman kerja, bukan modal.
- [x] Popup hanya dipakai untuk pemilih data dan konfirmasi kecil.
- [x] Sintaks, menu, keamanan, dan preview lokal diverifikasi tanpa transaksi data.

## Ergonomi Form Admission â€” 5 September 2026

- [x] Mini rail tahapan ditempatkan di kiri form desktop.
- [x] Field, kolom, dan ruang antarbaris diproporsikan ulang untuk kerja cepat.
- [x] Mobile memakai tab horizontal yang tetap mudah disentuh.
- [x] Alur form dan pemeriksaan regresi diverifikasi tanpa menyimpan data.

## Konsolidasi Navigasi HIS & Shell Operasional â€” 5 September 2026

- [x] Audit read-only kelompok menu referensi.
- [x] Admission memuat Admission, Back Office, Queue, dan Queue Outpatient.
- [x] Shell navigasi/header operasional diterapkan konsisten pada HIS.
- [x] Label tahap yang tidak diperlukan dihapus dan form responsif dipertahankan.
- [x] Menu, renderer, keamanan, dan preview lintas kelompok diverifikasi.

## Penyelesaian End-to-End Admission â€” 6 September 2026

- [x] Petakan kontrak dan field per jenis registrasi.
- [x] Bedakan konteks, validasi, dan ringkasan tiap alur Admission.
- [x] Rapikan daftar, form, pemilih layanan, pembayaran, kasir, laporan, dan handoff antrean.
- [x] Uji renderer serta transisi tanpa menyimpan transaksi.

## Audit dan viewer Pelayanan Klinis â€” 6 September 2026

- [x] Petakan workflow klinis versus viewer hasil LIS.
- [x] Tambahkan viewer Patologi Klinik, Mikrobiologi, dan Patologi Anatomi.
- [x] Rapikan menu Pelayanan Klinis dan penunjang.
- [x] Bangun ulang peta/manifest dan verifikasi tanpa transaksi klinis.

## Audit struktur operasional referensi HIS â€” 6 September 2026

- [x] Audit menu dan alur Keuangan, Rekam Medis, Paket, Remunerasi, SATUSEHAT, Workforce.
- [x] Petakan modul yang tersebar serta gap prioritas.
- [x] Rancang ulang menu dan implementasi aman setelah persetujuan pengguna.

## Implementasi struktur operasional HIS â€” 6 September 2026

- [x] Pisahkan navigasi operasional dan konfigurasi.
- [x] Lengkapi hub/rute yang memakai kontrak data yang sudah ada.
- [x] Implementasikan ringkasan baca-saja dan audit alur.
- [x] Tinjau checkpoint schema/integrasi untuk gap berisiko tinggi.
- [x] Verifikasi visual, menu, manifest, sintaks, dan keamanan.

## Web publik AVA Health â€” 2026-09-05
- [x] Audit sumber portal, pemetaan domain, dan perubahan pengguna.
- [ ] Rombak portal menjadi profil perusahaan dengan detail brand dan katalog publik.
- [ ] Satukan login ke apps.avahealth.sbs.
- [ ] Verifikasi struktur, navigasi, aset, dan routing; catat bukti.

## Web publik AVA Health â€” hasil 2026-09-05
- [x] Profil perusahaan, enam detail brand, delapan kategori produk/layanan, filter, perjalanan bisnis, sertifikasi, dan kontak.
- [x] Satu tautan login menuju https://apps.avahealth.sbs/; autentikasi di portal publik dihapus.
- [x] Pemeriksaan anchor, ID unik, aset/manifest ekspor, batas publik-operasional dan syntax lulus.
- [x] Routing Vercel/subdomain tetap sesuai generator; halaman dan empat aset HTTP 200.
- [ ] Verifikasi pemilik untuk tanggal sejarah, dokumen sertifikasi, katalog resmi, lokasi, dan kontak.
- [ ] Publikasi produksi (belum dilakukan).

## Pengayaan web publik premium
- [ ] Enam profil brand: visi, misi, model bisnis, rantai layanan.
- [ ] Skenario manufaktur obat/nutrisi/personal care dan kemitraan.
- [ ] Jurnal kesehatan lengkap dengan sumber dan tanggal pemeriksaan referensi.
- [ ] Kalkulator BMI dan estimasi energi dengan validasi dan batas penggunaan.
- [ ] Verifikasi dan preview.

### Selesai â€” pengayaan premium
- [x] Enam profil brand: visi, misi, model bisnis, rantai layanan.
- [x] Model manufaktur obat/nutrisi/personal care dan kemitraan.
- [x] Tujuh artikel utuh, sumber primer, tanggal pemeriksaan referensi.
- [x] BMI & estimasi energi, validasi, reset, input lokal.
- [x] Verifikasi kalkulasi, 15 halaman, tautan, aset, dan HTTP preview.
- [ ] Peninjauan klinis/editorial dan verifikasi fakta korporat sebelum publikasi.

## Konten komersial hasil discovery
- [ ] AVA Tech dominan dan Queen sebagai brand usaha sendiri.
- [ ] Tiga halaman solusi, penawaran modular, demo dan pilot.
- [ ] Investor, kemitraan dan produk herbal dengan status akurat.
- [ ] Validasi dan preview.

### Selesai â€” konten komersial hasil discovery
- [x] AVA Tech dominan dan Queen sebagai brand usaha sendiri.
- [x] Tiga halaman solusi, model biaya, demo dan pilot.
- [x] Investor, kemitraan dan produk herbal sesuai status pengembangan.
- [x] Dokumen konten untuk peninjauan.
- [x] Validasi 19 halaman dan HTTP preview.
- [ ] Publikasi produksi (belum dilakukan).

## Multipage & identitas â€” 2026-09-06
- [x] Cari PDF termasuk hidden/ignored; pelajari dokumen induk Markdown yang ditemukan.
- [x] Beranda ringkas dan navigasi ke halaman masing-masing.
- [x] Profil korporat rinci, Health/Lab bisnis fisik, Care & Wellness inklusif.
- [x] Validasi 30 halaman, link/aset, regresi kalkulator dan HTTP 200.
- [ ] Dokumen PDF identitas: menunggu nama/lokasi dari pengguna.
- [ ] Publikasi produksi: belum dilakukan.

## Kisah AVA dan founder â€” 2026-09-06
- [x] Halaman Founder, Owner & CEO dengan ruang foto potret yang disengaja.
- [x] Halaman Cerita & Perjalanan dengan enam bab tematik, tanpa tahun rekaan.
- [x] Ringkasan serta tautan di Tentang AVA; struktur multipage tetap terjaga.
- [x] Validasi 32 halaman, link, ID/H1, rebuild deterministik, kalkulator dan HTTP.
- [ ] Foto founder: akan diberikan pengguna.

## Audit LIS â€” 2026-09-06
- [x] Audit menu sumber dan halaman masuk produksi.
- [ ] Rapikan kelompok, label, judul navigasi dan tema LIS.
- [ ] Verifikasi rute, generator, sintaks dan catat keterbatasan audit.
- [x] Rapikan kelompok, label, judul navigasi dan tema LIS.
- [x] Verifikasi 24 rute/metadata, generator dan sintaks; dokumentasikan batas audit produksi dan uji visual tertunda.

## Sinkronisasi layanan LISâ€“HIS
- [ ] Hapus branding workstation dan harga admisi LIS.
- [ ] API permintaan layanan idempotent dan penautan kunjungan HIS.
- [ ] Rekonsiliasi permintaan LIS di admisi HIS dengan tarif HIS.
- [ ] Uji sintetis, bukti, dan catatan aktivasi migrasi.
- [x] Hapus branding workstation dan seluruh nominal harga dari admisi LIS.
- [x] API katalog/kunjungan/sinkronisasi/sampel idempotent dengan pembatasan tenant dan peran.
- [x] Rincian layanan masuk admisi HIS; tarif dan pembayaran tetap HIS; konflik serta tagihan pending dijaga di server.
- [x] Uji PostgreSQL sintetis dan frontend; verifikasi browser lokal; dokumentasi aktivasi produksi terpisah.

## Audit mendalam LIS / pembanding HCLAB
- [x] Baca teks dan visual 12 halaman brosur.
- [x] Audit kode UI, navigasi, siklus sampel/hasil, QC, integrasi dan kontrol akses; keterbatasan pengujian login/viewport/deployment dicatat.
- [x] Reproduksi 11 kasus dengan fixture sintetis; regresi HISâ€“LIS tetap lulus.
- [x] Susun laporan bukti, menu/alur target dan backlog prioritas.
- [ ] Tindak lanjut terpisah: perbaikan P0/P1 dan pengujian staging berdasarkan laporan audit.
# Perbaikan dan rilis LIS â€” 2026-09-06

- [x] Dashboard/grafik, agregasi panel dan persistensi hasil.
- [x] Evaluator QC/autoverifikasi tertahan, identitas laporan dan helper legacy.
- [x] API transisi, connector dan pengujian regresi lokal.
- [x] Menu/layout, ZIP connector operasional, dan catatan kandidat rilis.
- [ ] Aktivasi staging/produksi: menunggu identitas proyek dan akses migrasi/deployment.
- [ ] Penerimaan klinis lanjutan: amended report, penjagaan QC server, delivery acknowledgment dan UAT alat nyata; lihat docs/LIS-RELEASE-1.1.0-RC1.md.

## Penyelarasan LIS dengan audit layanan referensi â€” 2026-09-07

- [x] Inventarisasi read-only layanan referensi, termasuk menu/submenu, tab, toolbar, tabel, dan tahapan kerja.
- [x] Dokumentasikan batas HIS klinis â†” LIS â†” viewer hasil lintas-sistem.
- [x] Rapikan workspace layanan penunjang menjadi halaman penuh tanpa mengubah payload atau skema.
- [x] Evaluasi dan rapikan pengelompokan menu LIS setelah temuan referensi lengkap.
- [x] Jalankan pemeriksaan sintaks, menu/manifest, dan uji UI tanpa data produksi.

## Konsistensi halaman kerja LIS dan tema â€” 2026-09-07

- [x] Klasifikasikan dialog besar versus dialog aksi singkat.
- [x] Jadikan input hasil batch dan per-tes sebagai halaman kerja.
- [x] Kurangi ikon dekoratif dan pertegas label tindakan.
- [x] Audit serta perbaiki kontras tema terang/gelap di workspace yang disentuh.
- [x] Jalankan validasi teknis dan visual tanpa data produksi.

## Koreksi target HIS â€” 2026-09-07

- [x] Verifikasi pemetaan host HIS dan LIS.
- [x] Terapkan halaman penuh untuk anamnesis serta pertahankan registrasi HIS sebagai workspace.
- [x] Rapikan label dan ikon dekoratif pada registrasi HIS.
- [x] Terapkan tema/kontras global pada HIS tanpa perubahan data.

## Konsolidasi indeks kategori HIS â€” 2026-09-07

- [x] Audit ulang pola domain â†’ kelompok â†’ fungsi pada HIS referensi secara read-only.
- [x] Terapkan direktori kategori ringkas pada HIS.
- [x] Rapikan hierarki, ukuran, ikon, dan perilaku responsif.
- [x] Jalankan regresi menu/rute, sintaks, aksesibilitas, dan tema.

## Perapihan pusat konfigurasi HIS â€” 2026-09-08

- [x] Cocokkan peta menu konfigurasi dengan rute master dan operasional.
- [x] Ringkas pusat konfigurasi dan halaman domain.
- [x] Kurangi ikon dekoratif tanpa mengurangi informasi status/field.
- [x] Jalankan pemeriksaan rute, handler, sintaks, dan regresi manifest.

## Workspace konfigurasi antrean â€” 2026-09-08

- [x] Klasifikasikan modal antrean berdasarkan panjang/risko tugas.
- [x] Jadikan form loket dan layanan sebagai halaman kerja.
- [x] Pertahankan validasi dan refresh daftar setelah simpan.
- [x] Verifikasi sintaks dan regresi menu/modul tanpa menulis data.

## Workspace perjanjian pasien â€” 2026-09-08

- [x] Pindahkan form perjanjian panjang dari modal ke halaman kerja.
- [x] Pertahankan validasi bentrok dan kembali eksplisit ke daftar.
- [x] Jalankan pemeriksaan sintaks serta regresi menu/rute/modul.

## Workspace master paket â€” 2026-09-08

- [x] Pindahkan form buat/ubah paket ke halaman kerja.
- [x] Pertahankan validasi dan pengembalian ke katalog paket setelah simpan.
- [x] Jalankan pemeriksaan sintaks, menu/rute, keamanan, dan diff.

## Penuntasan menu konfigurasi â€” 2026-09-08

- [x] Verifikasi tidak ada menu berstatus belum pada peta.
- [x] Hubungkan semua label master yang semula kerangka ke registry CRUD yang tersedia.
- [x] Tambahkan domain Integrasi & Konektivitas.
- [x] Jalankan audit rute/handler/modul tanpa migrasi atau perubahan data.

## Audit Apps fase awal â€” 2026-09-07
- [x] Audit halaman publik dan kode login/sesi/modal.
- [x] Rapikan pintu masuk responsif dan hilangkan akses demo publik.
- [x] Tutup fallback autentikasi dan peran browser.
- [x] Verifikasi sintaks, regresi sintetis, rute, dan UI lokal.
- [x] Dokumentasikan temuan tersisa dan status penerapan.

## Menu Apps siap uji â€” 2026-09-08
- [ ] Inventarisasi target dan status menu.
- [ ] Rapikan penamaan, routing, active state, dan renderer.
- [ ] Lengkapi beranda/profil serta empty/error states.
- [ ] Uji seluruh menu dengan fixture sintetis dan dokumentasikan hasil.

## Audit keamanan â€” 10 September 2026
- [ ] Inventaris domain dan pemeriksaan HTTP tanpa autentikasi.
- [ ] Hapus kredensial demo/bypass dan sesi URL.
- [ ] Batasi sesi/cache dan eksposur file deployment.
- [ ] Uji regresi negatif dan catat batas verifikasi produksi.

### Hasil audit keamanan â€” 10 September 2026
- [x] Inventaris 44 hostname dan HTTP tanpa kredensial; hasil DNS/timeout dicatat.
- [x] Hapus isian demo, bypass lokal, sesi URL dan role metadata fallback.
- [x] Siapkan gerbang staf server, no-store, purge cache dan pembatasan file/domain publik.
- [x] 22 tes sintetis lulus; generator routing dan pemeriksaan deploy statis lulus.
- [ ] Isi daftar UUID staf dan konfigurasi server, build/deploy Vercel, uji produksi.
- [ ] Rotasi kredensial terdampak, cabut sesi dan audit RLS/grant/backend produksi.

---

## walkthrough

# Walkthrough â€” Penyempurnaan HIS

## Audit Struktur Multi-Domain â€” 6 September 2026

### Temuan

- Audit menu menemukan 217 menu konfigurasi. Tidak ada menu aktif tanpa route,
  renderer, tabel/view, RPC, handler, atau manifest.
- Sebanyak 19 menu tidak memiliki `PAGE_TITLES`, sehingga judul topbar dapat
  jatuh ke ID teknis. Metadata tersebut telah dilengkapi di router.
- Suite regresi menyeluruh masih melaporkan dua defect perilaku: rule R-4s pada
  suite Kepatuhan/Keuangan dan pencatatan telepon nilai kritis pada LIS Super
  Suite. Keduanya bukan akibat restrukturisasi folder dan harus diperbaiki dalam
  work item domain masing-masing.
- PACS/DICOM diberi label implementasi yang jujur: viewer tersedia, tetapi
  sumber citra DICOM jaringan belum tersambung; unggah manual tetap tersedia.

### Fase yang disetujui

Restrukturisasi dilakukan dari boundary dan adapter terlebih dahulu, dimulai dari
AVA Tech sebagai control plane customer. Pemindahan fisik file, penghapusan arsip,
dan perubahan database ditunda sampai dependency map, parity database lokal-cloud,
dan smoke test per domain menghasilkan bukti.

Registry boundary tersedia di
`config/application-boundaries.json`, template deployment di
`config/deployment.template.json`, dan validator di
`scripts/verify-application-boundaries.js`. Registry memetakan seluruh 17 situs
ke enam boundary tanpa menggandakan domain atau menghapus path lama.

### Bukti verifikasi

- `node scripts/uji/audit_all_menus.js`: 217 menu; 0 menu aktif tanpa route.
- `node scripts/audit-menu-hidup.js`: layar mati, tabel/view, RPC, handler, dan
  manifest hilang semuanya bersih.
- `node scripts/audit-keamanan-modul.js`: 2.970/2.970 pemeriksaan lulus.
- `node scripts/uji/run_all_tests.js`: 15/17 suite lulus; dua kegagalan dicatat
  sebagai gap perilaku yang belum diselesaikan.
- `node scripts/verify-application-boundaries.js`: 6 boundary dan 17/17 domain
  valid; seluruh entrypoint dan legacy root tersedia.
- `node scripts/bangun-vercel.js` dan `node scripts/bangun-manifest.js --periksa`:
  routing deploy dan 224 halaman manifest tetap konsisten.
- Security domain 11/11, portal auth 12/12, dan AVA Tech tenant 8/8 lulus.
- Lima modul AVA Tech dipindahkan ke `ava-platform/modules/tech-platform/`.
  Tidak ada referensi aktif ke path `modules/business_units/tech_*` yang lama.
- Jalur connector tetap memuat `modules/lab/qcEngine.js`; manifest baru
  berisi 224 halaman dan audit menu hidup tetap bersih.

### Defect bisnis ditutup

- Rule R-4s sebelumnya hanya membaca `sameRunValues`, sedangkan kontrak uji
  lama mengirim kontrol sebelumnya. Evaluator sekarang memakai same-run eksplisit
  bila tersedia dan fallback dua titik terakhir untuk kompatibilitas.
- `recordCriticalValueLog` sebelumnya selalu gagal meskipun suite membutuhkan
  validasi kontrak pencatatan. Helper sekarang menolak payload tidak lengkap,
  memvalidasi SLA numerik, dan menandai SLA `<15` menit; penulisan produksi
  tetap dilakukan melalui transaksi pelaporan/read-back.
- Suite penuh sekarang **17/17 lulus (100%)**.

### Status penutupan fase

Root repository sekarang hanya menyisakan folder operasional utama. Dokumen
arsitektur berada di `docs/architecture`, artefak kerja berada di `docs/project`,
dan laporan audit tetap di `docs/audit`. Static runtime `ava-platform`,
`desktop-app`, database, API, dan scripts tidak dipindahkan ke lokasi baru yang
dapat memutus path deploy atau connector.

Fase baseline, boundary, deployment packaging, dan pemindahan AVA Tech sudah
selesai. Portal/public surfaces dan clinical platform sudah memiliki boundary
resmi tanpa pemindahan ulang entrypoint yang memang sudah dipakai bersama.
Retirement arsip/database tetap ditahan karena membutuhkan dependency map
zero-reference dan audit parity database dengan environment lokal yang disiapkan.

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
- UI responsif kini memakai drawer penuh pada lebar layar â‰¤768px, lengkap
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

## Kesiapan Deploy Awal â€” 3 September 2026

- `vercel.json` kini mengenali `antrian.avahealth.sbs` dan mengarahkannya ke display antrean.
- HIS, kiosk, dan display memuat konfigurasi runtime dari `/api/runtime-config.js`; endpoint hanya mengirim URL Supabase dan anon key dari Vercel Environment Variables, tidak pernah service-role atau secret integrasi.
- Endpoint runtime berada di `api/` root repo, selaras dengan `vercel.json` root yang memakai `ava-platform` sebagai output statis; ia tidak bergantung pada folder output untuk menjadi Vercel Function.
- Kiosk memakai URL Supabase runtime yang sama, sehingga deploy tenant baru tidak lagi memerlukan perubahan source untuk endpoint `queue-public`.
- `scripts/verify-deploy-readiness.js` memeriksa kontrak ini secara statis.

Perubahan ini tidak menerapkan migrasi database dan tidak mengaktifkan integrasi vendor. Migrasi tenant-aware, konsolidasi SQL arsip, dan aktivasi SATUSEHAT/BPJS/payment/PACS tetap menunggu checkpoint pemilik proses.

## Antrean Multi-tenant & Kiosk Publik â€” Artefak Staging

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
- Contoh hierarki: **Pelayanan Klinis â†’ Radiologi & Pencitraan â†’ Order,
  PACS, Unggah Studi, Bacaan**, serta **Pelayanan Klinis â†’ Jantung, Paru &
  Indera â†’ EKG, Treadmill, Audiometri & Spirometri**.
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
- Pola navigasinya adalah rail ikon permanen â†’ pemilih semua modul dengan
  pencarian â†’ hub modul berbentuk kartu â†’ dropdown aksi. Kelompok tingkat atas
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
  domain â†’ layanan â†’ modul.
- Inventaris panel dibangun dari menu sidebar setelah filter RBAC diterapkan.
  Karena itu panel tidak memperlihatkan menu yang tidak diizinkan untuk peran
  aktif, tidak membuat daftar rute kedua, dan tidak membuka akses data baru.
- Breadcrumb topbar kini menampilkan konteks domain â†’ layanan â†’ halaman aktif.
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
  & Hak Akses**, **Data Awal & Migrasi**, dan **Master Klinis â†’ Pasien &
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

## Configuration Hub â€” Domain Master HIS

- Menu **Pengaturan Sistem â†’ Master Konfigurasi HIS** kini memuat delapan
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

## Pemisahan Menu Configuration dan Operasional

- **Pengaturan & Master HIS** kini khusus memuat akses/data awal, master
  fasilitas, praktisi/pasien, korporat/keuangan, parameter klinis, antrean,
  perangkat, obat, promo, dan integrasi.
- Konfigurasi antrean dipindahkan dari **Alur Pasien** ke **Pengaturan**.
  Konsol panggilan, kiosk, layar antrean, pendaftaran, pemeriksaan MCU,
  farmasi, kasir, dan booking tetap merupakan halaman operasional.
- Kerangka baru ditambahkan untuk cabang/plant; unit, ruang, kelas, dan alat;
  spesialisasi serta fee; penjamin/alergi/ICD; kontrak/jabatan korporat;
  parameter MCU; bank/EDC/mapping akun; flow/device antrean; formularium;
  promo; dan telemedicine. Kartu fokus sekarang juga menampilkan blueprint
  field untuk setiap master.
- Peta menu dibangkitkan ulang: 197 menu (162 tersedia, 28 parsial, 7 belum).
  Audit memeriksa 160 menu tersedia dan tidak menemukan layar, renderer,
  tabel/view, RPC, handler, atau manifest yang hilang.

## Rancangan End-to-End 20 Master

- Rancangan lengkap disimpan di `docs/RANCANGAN_E2E_20_MASTER_HIS.md` sebelum
  perubahan skema atau CRUD dimulai. Ia mencakup model relasi, field minimum,
  workflow, status/versioning, RBAC, outbox integrasi, acceptance criteria,
  dan paket rilis.
- Hasil desain mengunci batas penting: Configuration tidak menjalankan
  transaksi; perangkat kiosk tidak mendapat akses DB; transaksi menyimpan
  snapshot master; dan sistem tenant-aware wajib diterapkan dari awal.
- Referensi integrasi menggunakan dokumentasi primer SATUSEHAT dan HL7 FHIR;
  aktivasi tetap dibatasi sandbox lalu UAT, tanpa penggunaan secret atau data
  pasien nyata pada tahap perancangan.

## Registry Master HIS â€” Implementasi Source

- Semua 20 menu Configuration yang sebelumnya hanya mengarah ke hub kini
  langsung menuju `master-records` dengan domain eksplisit. Setiap domain
  mempunyai daftar, pencarian, filter status, tambah, ubah, soft archive,
  versi, dan jejak audit.
- `ava-platform/modules/system/config/master_registry.js` mendefinisikan field
  domain untuk fasilitas, klinis/SDM, keuangan/promo, antrean, serta integrasi.
  Form SATUSEHAT/Telemedicine menerima `vault://...` reference saja; tidak ada
  input API key, token, password, atau data pasien.
- `0050_his_master_registry.sql` membuat registry tenant-aware, RLS baca per
  tenant, RPC tulis berperan, audit append-only, code uniqueness, periode
  efektif, dan pengarsipan. Domain `queue_device` menyinkronkan device aktif
  ke `queue_public_devices`; tenant lain tidak dapat menimpa device ID publik.
- Preflight dan prosedur rollout/rollback operasional tersedia di
  `db/preflight/0050_his_master_registry_preflight.sql` dan
  `db/runbooks/0050_his_master_registry.md`.

### Bukti verifikasi source

- `node scripts/verify-master-registry-contract.js`: 20 menu/domain, definisi
  UI, dan seed migrasi konsisten.
- `node scripts/bangun-menu.js` dan `node scripts/bangun-manifest.js`: lulus;
  peta saat ini berisi 197 menu (161 tersedia, 29 parsial, 7 belum).
- `node scripts/audit-menu-hidup.js`: 159 menu berstatus tersedia, tanpa
  renderer, tabel/view, RPC, handler, atau manifest yang hilang.
- `node scripts/audit-keamanan-modul.js`: 2.350/2.350 pemeriksaan lulus.
- `node scripts/uji/test_antrian_panggilan.js`: 11/11 lulus.
- `node --check` untuk router, Configuration Hub, registry master, dan
  pemeriksa kontrak; serta `git diff --check`: lulus.

### Batas verifikasi

Migrasi `0050` belum dijalankan ke staging maupun produksi, sehingga belum
ada data master baru, perangkat publik, ataupun integrasi vendor yang diubah.
Pengujian database nyata harus mengikuti runbook dengan backup, preflight, dan
UAT pemilik proses terlebih dahulu.

## Audit Admission & Navigasi Konteks â€” 5 September 2026

### Bukti audit referensi (read-only)

- Hub Admission terbukti memakai empat kelompok kerja: Admission, Back Office,
  Queue, dan Queue Outpatient.
- Kelompok Admission memiliki enam alur berbeda: rawat jalan, layanan, medical
  kit, paket layanan, langganan paket, serta pemakaian langganan.
- Form kosong memperlihatkan pemisahan tahap dan field: rawat jalan membawa
  unit/dokter/jadwal; layanan memiliki line item dan prioritas; medical kit
  memiliki tanggal layanan/status; paket memakai kategori/paket/add-on;
  langganan menyimpan kuantitas/bonus/kedaluwarsa; pemakaian memilih hak paket
  aktif.
- Tidak ada transaksi, data pasien, konfigurasi, ekspor, atau perubahan lain
  yang dilakukan selama audit.

### Perubahan source

- ava-platform/index.html kini membangkitkan rail sebagai daftar domain
  ringkas dan membuka panel konteks dua kolom untuk sub-menu serta modul.
- ava-platform/css/style.css membuat rail desktop tetap 64px, menambahkan
  panel konteks yang responsif, dan mencegah cache class sidebar lama
  memperlebar rail kembali.
- Enam pintu registrasi ditampilkan dalam layanan Registrasi & Admisi. Variasi
  non-OPD berstatus Bertahap agar perbedaan kontrak transaksi tidak
  disalahartikan sebagai fitur produksi yang sudah lengkap.
- Action/rute berasal dari definisi menu yang sama setelah penyaringan RBAC;
  pencarian Semua Modul dan breadcrumb tetap memakai inventaris tersebut.
- Audit proses dan batas implementasi tersimpan di
  docs/archive/AUDIT_REFERENSI_ADMISSION_2026-09-05.md.

### Verifikasi

- Preview lokal HIS: klik ikon Alur Pasien membuka panel dua kolom dan
  menampilkan enam item Registrasi & Admisi; klik Fasilitas & Antrean
  menampilkan tiga sub-menu layanan serta empat modul antrean pada kolom
  kanan.
- Rute Registrasi Medical Kit membuka header, konteks, dan form mode khusus
  tanpa menulis data saat diuji; formulir kemudian ditutup dengan Batal.
- Pemeriksaan terakhir: sintaks skrip inline index dan admission/router valid;
  peta menu sesuai source (202 menu: 161 ada, 34 parsial, 7 belum); audit
  menu hidup lulus; audit keamanan 2.350/2.350 lulus; kontrak registry
  20 domain lulus.

## Perombakan situs publik AVA Health â€” 2026-09-05
OWNED_BY: ava. Portal publik dibangun ulang sebagai company profile; autentikasi multi-role, sesi mock, dan tautan operasional tidak lagi ada pada halaman utama. Login tunggal menuju apps.avahealth.sbs. Enam brand menggunakan detail native, katalog delapan kategori dapat difilter, seluruh konten tetap tersedia tanpa JavaScript. Menu responsif mendukung Escape dan fokus keyboard.
Bukti: node scripts/verify-public-profile.js PASS (anchor, ID unik, aset/ekspor, brand, katalog, batas autentikasi). Syntax kedua berkas JS lulus. node scripts/bangun-vercel.js --periksa PASS. HTTP 200 untuk /portal.html, /css/public-profile.css, /js/public-profile.js, /apps/doctors.jpg, /css/logo-ava-global.png pada preview lokal :5186. Pratinjau dibuka di Codex. Tidak dilakukan pengujian visual browser atau deploy produksi. Audit sumber dan konten yang perlu verifikasi: docs/archive/audit/07-PUBLIC-COMPANY-PROFILE.md. Perubahan aplikasi operasional yang sudah ada tidak disunting oleh pekerjaan ini.

## Pengayaan premium, brand, jurnal & kalkulator â€” 2026-09-05
OWNED_BY: ava. Ditambahkan 6 halaman profil brand (visi, 3 misi, pelanggan, portofolio, model pendapatan, 5 tahap alur, fungsi organisasi, evaluasi dan hubungan ekosistem), 1 halaman model manufaktur dengan jalur obat/nonsteril, nutrisi dan personal care, serta bagian kemitraan. Semua asumsi operasi baru ditandai konsep portofolio, bukan fakta izin/fasilitas.
Tujuh artikel orisinal tersedia sebagai halaman HTML utuh dengan empat bagian, sumber primer, tanggal pemeriksaan referensi, dan status belum ditinjau klinis. Tema: persiapan lab, interpretasi hasil digital, makan seimbang, aktivitas fisik, skincare, tidur, dan keamanan produk. Pembaruan editorial tidak dijanjikan otomatis.
Kalkulator lokal memakai kategori BMI CDC usia â‰¥20 tahun dan Mifflinâ€“St Jeor, usia dibatasi 20â€“78, faktor aktivitas ditampilkan sebagai asumsi simulasi. Tidak memberi defisit energi/resep diet; tidak menyimpan/mengirim input. Hasil lama disembunyikan saat input berubah/reset; submit dinonaktifkan sampai JS aktif. Menu tetap tersedia tanpa JavaScript.
Bukti verifikasi: verify-public-profile PASS; verify-public-editorial PASS untuk 15 halaman, 6 profil, 7 artikel, seluruh tautan/aset/anchor, satu H1, rebuild deterministik, contoh energi laki-laki 1730/2076 dan perempuan 1564 kkal, ambang BMI 18.5/25/30, serta penolakan input tidak valid. Pemeriksaan routing generator PASS. HTTP 200 untuk portal, profil Health/Care, manufaktur, artikel nutrisi, dan JS kalkulator. Tidak dilakukan browser visual QA atau publikasi produksi.

## Workspace Admission â€” 5 September 2026

- Halaman daftar sekarang memakai header kerja satu baris berisi judul,
  konteks singkat, tanggal, tema, notifikasi, dan identitas pengguna. Topbar
  global/breadcrumb/API key tidak ditampilkan pada rute Admission; toolbar
  daftar berada langsung di atas tabel.
- Pencarian, periode, jenis kunjungan, filter status, laporan, dan tindakan
  registrasi dipadatkan dalam satu alur. Area tabel mengisi ruang kerja yang
  tersisa dan memiliki keadaan kosong yang informatif.
- Tambah dan ubah registrasi kini membuka workspace penuh dengan tombol
  kembali, tab tahapan, dan footer tindakan. Laporan Admission juga menjadi
  halaman ringkasan penuh. Modal tetap dipakai oleh pemilih paket/pasien dan
  tindakan pendukung yang memang berukuran kecil.
- Preview lokal `his.localhost` diverifikasi tanpa menyimpan data: rute
  Admission â†’ `+ Registrasi` menampilkan formulir penuh â†’ kembali ke daftar;
  `Laporan` menampilkan halaman ringkasan penuh â†’ kembali ke daftar.
- Pemeriksaan source lulus: `node --check` untuk Admission dan router,
  `bangun-menu.js --periksa`, `audit-menu-hidup.js` (159 menu tanpa temuan),
  `audit-keamanan-modul.js` (2.350/2.350), serta `git diff --check` pada
  berkas terkait.

## Ergonomi Form Admission â€” 5 September 2026

- Navigasi tahap Pasien, Pembayaran, Unit & Layanan, serta Kasir kini berupa
  mini rail vertikal di kiri form desktop. Setiap tombol membawa ikon, nama,
  urutan tahap, serta keadaan aktif yang jelas tanpa mengambil lebar kolom
  form.
- Isi form dibuat lebih padat secara proporsional: padding input, jarak antar
  grup, metadata kunjungan, dan area teks disesuaikan hanya dalam workspace
  Admission. Bidang input serta tombol tahap tetap memiliki target klik yang
  nyaman.
- Pada lebar tablet/ponsel, rail berubah menjadi tab horizontal yang dapat
  digulir agar area input tidak terpotong.
- Preview lokal tanpa penyimpanan data membuktikan `+ Registrasi` membuka
  rail vertikal dan perpindahan ke tahap Pembayaran bekerja. Syntax Admission,
  pemeriksaan menu, audit 159 menu, audit keamanan 2.350/2.350, dan
  `git diff --check` lulus.

## Konten komersial setelah discovery â€” selesai 2026-09-05
OWNED_BY: ava. Beranda kini memprioritaskan AVA Tech, demo HIS/LIS/Apps dan uji coba terbatas. Ditambahkan tiga halaman solusi (laboratorium mandiri, klinik pratama, klinik utama), halaman investasi, biaya setup/modular + lisensi bulanan, lingkup pengembangan khusus, dan kriteria evaluasi pilot. Consumer portfolio memakai Queen; perusahaan tetap AVA Health Solution. Narasi manufaktur sebelumnya diganti fokus produk herbal/nutrisi/personal care dan opsi maklon; pabrik sendiri hanya arah jangka panjang. Tidak ada bukti laporan spesifik, traction, fasilitas, atau harga yang direka.
Bukti: verify-public-profile PASS; verify-public-editorial PASS untuk 19 halaman, tautan/aset/anchor, rebuild deterministik, hierarki teknologi sebelum brand, status demo/pilot, identitas korporat, penghapusan narasi pabrik nonsteril lama, dan regresi kalkulator. Generator routing --periksa PASS. HTTP 200 untuk portal, tiga solusi, dan investasi pada :5186. Dokumen editorial: docs/WEB-CONTENT-AVA-BUSINESS.md. Tidak mengubah aplikasi operasional atau mempublikasikan produksi; visual browser tidak diuji pada tahap penulisan konten ini.

## Website multipage & profil korporat â€” 2026-09-06
OWNED_BY: ava. Beranda dipadatkan menjadi pengantar dan tiga jalur utama. Menu membuka dokumen HTML tersendiri: Tentang AVA, Unit Bisnis, Solusi Sistem, Kemitraan, Insight, dan Kontak. Halaman kalkulator, sertifikasi, demo, model biaya, portofolio, dan investasi terpisah. Link internal lama dipetakan ke halaman tujuan pada build.
Identitas diringkas dari `docs/architecture/AVA HEALTH SOLUTION THE FUTURE.md` (Volume 3.0, 2026) serta `docs/architecture/AVA-DOC-ARCH-2026-V5_Arsitektur_Sistem_6_Unit_Usaha.md`, dengan instruksi terbaru pemilik sebagai acuan tertinggi: faskes/lab milik sendiri adalah bisnis fisik; Care & Wellness untuk semua kalangan, Sanctuary sebagai bagian payung tersebut. Profil tentang memuat identitas, visi, tujuh misi, enam nilai, pimpinan dan arah perjalanan. Tidak menyalin formula R&D, HPP, harga privat, proyeksi internal, atau nomor izin yang belum ada. PDF dicari termasuk hidden/ignored, tidak ditemukan; lokasi diminta secara asynchronous. Tidak mengaku telah membaca PDF.
Verifikasi: verify-public-profile PASS (beranda â‰¤4 section, menu membuka halaman, tanpa form login); verify-public-editorial PASS (30 halaman, semua target/anchor, satu H1 per halaman, rebuild deterministik, bisnis fisik dan inklusivitas Care); regresi kalkulator PASS; generator routing --periksa PASS. HTTP 200 untuk 30 halaman dan JS kalkulator. Pencarian narasi lama hanya menemukan pernyataan eksplisit Sanctuary tidak dibatasi perempuan. Tidak ada pengujian visual browser atau deploy produksi pada pekerjaan ini.

## Konsolidasi navigasi dan shell HIS â€” 2026-09-06

- Audit read-only pada referensi menu Admission dikonsolidasikan menjadi empat
  kelompok operasional: **Admission** (enam jenis registrasi), **Back Office**
  (laporan registrasi), **Queue** (antrean, konsol, dan kiosk), serta **Queue
  Outpatient** (antrean poli umum/spesialis). Jadwal dan perjanjian diletakkan
  sebagai layanan tersendiri pada Alur Pasien; konfigurasi flow/loket/perangkat
  ditempatkan pada Administrasi Sistem, terpisah dari operasi loket.
- Rail HIS tetap hanya berupa ikon. Saat domain dibuka, panel konteks dua kolom
  menampilkan kelompok layanan di kiri dan modul di kanan. Tidak ada label
  visual â€œtahapâ€ pada form maupun status progres pada kartu navigasi.
- Seluruh layar HIS non-kiosk memakai shell ringkas yang sama: breadcrumb
  teknis, subnav horizontal, dan badge API key disembunyikan; strip atas hanya
  menyimpan tanggal, tema, notifikasi, dan profil. Header halaman, toolbar,
  tab, form, kartu, dan tabel dipadatkan secara terlingkup.
- Preview lokal tanpa simpan data membuktikan: panel Alur Pasien menampilkan
  empat kelompok; Back Office membuka laporan Admission; Queue Outpatient
  membuka antrean poli dengan filter Dokter aktif; `+ Registrasi` membuka
  workspace penuh dengan bagian Pasien, Pembayaran, Unit & Layanan, serta
  Kasir tanpa tulisan tahap.
- Verifikasi akhir: `bangun-menu.js --periksa`, manifest 175 rute, audit 161
  menu berstatus ada (layar/tabel/RPC/handler/manifest bersih), audit keamanan
  2.350/2.350, kontrak registry 20 domain, sintaks router/admission/clinicflow/
  aiGateway/lazy dan skrip inline index semuanya lulus. Tidak ada transaksi,
  konfigurasi produksi, atau data pasien yang dibuat/diubah selama verifikasi.

## Kisah AVA & Founder â€” 2026-09-06
OWNED_BY: ava. scripts/public-company-story.js menjadi sumber narasi. Ditambahkan public/founder.html dan public/sejarah.html; Tentang AVA menampilkan ringkasan, ruang foto dan tautan ke cerita lengkap. Foto berupa slot potret 4:5, bukan gambar orang lain atau URL rusak, sesuai permintaan eksplisit. Identitas Ace Anwar sebagai Founder, Owner & CEO mengikuti dokumen dan konfirmasi pemilik. Narasi mengembangkan konteks operasional lab, informatika, mutu, hubungan bisnis fisik dengan AVA Tech, identitas Queen, tahap demo dan arah wellness/produk. Enam bab sejarah adalah tema perjalanan, bukan timeline bertanggal; tidak ada kutipan, pendidikan, capaian atau peristiwa personal rekaan.
Verifikasi: verify-public-editorial PASS (32 halaman, link/aset/anchor, H1/ID, rebuild deterministik, foto slot dan enam bab); verify-public-profile PASS; regresi kalkulator PASS; generator routing PASS; halaman tentang/founder/sejarah HTTP 200 pada :5186. Belum dipublikasikan. Foto founder dan kronologi bertanggal dapat dilengkapi setelah data pemilik tersedia.

## Audit LIS â€” 2026-09-06
Perapihan selesai untuk 24 menu dalam tujuh kelompok, judul topbar, konteks navigasi satu kolom, serta tema LIS khusus. Bukti: `node scripts/bangun-menu.js --periksa` lulus; Node VM memeriksa sintaks script index/router dan merender empat menu sampel; perbandingan HEAD memastikan ID dan metadata selain label tetap sama. Produksi hanya diperiksa hingga halaman login, tanpa akses pasien atau deployment. Audit rinci: docs/archive/AUDIT-LIS-2026-09-06.md. Verifikasi visual setelah login dan transaksi klinis belum dilakukan.

## Penyelesaian End-to-End Admission â€” 2026-09-06

Enam jalur Admission kini berbagi kontrak `admissions` yang ada, namun tidak lagi
berbagi konteks operasional secara buta. Form memuat konteks per jalur dan
validasi pra-simpan: OPD (unit/fasilitas, dokter, waktu), layanan langsung
(jalur dan waktu layanan), medical kit (tanggal, kode, kesiapan serta penanda
line-item), paket (kategori dan paket), langganan (periode dan kuota), serta
pemakaian langganan (referensi hak, tanggal dan kuantitas). Konteks disimpan
bersama JSON layanan yang sudah digunakan oleh kontrak lama; tidak ada migrasi
skema, transaksi, atau perubahan basis data produksi.

Tampilan diperpadat dengan blok konteks tiga kolom responsif, toolbar layanan
ringkas, tabel layanan yang dapat digulir horizontal pada layar sempit, dan
tab kerja yang tetap berurutan Pasien, Pembayaran, Unit & Layanan/Medical Kit,
Kasir. Preview lokal tanpa penyimpanan mengonfirmasi form OPD dan Medical Kit,
termasuk field wajib dan kolom penanda kit. Panel Alur Pasien menampilkan enam
opsi Admission dengan tujuan masing-masing.

Verifikasi: `node --check` untuk Admission dan lazy loader, pemeriksa struktur
menu, audit 161 menu hidup, audit keamanan 2.350/2.350, kontrak registry 20
domain, dan `git diff --check` semuanya lulus. Penegakan saldo/masa berlaku
langganan secara atomik masih memerlukan ledger klinis server-side dan
checkpoint perubahan skema; UI tidak mengklaim telah menggantikan kontrol
otoritatif tersebut.

## Audit dan viewer Pelayanan Klinis â€” 2026-09-06

Tiga menu baru ditambahkan pada Pelayanan Klinis: Viewer Hasil Patologi
Klinik, Mikrobiologi, dan Patologi Anatomi. Ketiganya hanya membaca
`lab_results` yang sudah released/approved (atau mempunyai waktu rilis),
menampilkan pasien/kunjungan, hasil, satuan, rentang rujukan, flag, waktu
rilis, dan validator/approver. Tidak tersedia operasi tulis dari HIS.

Menu penunjang yang sebelumnya tercampur dipisah menjadi Dashboard Pemeriksaan
Penunjang, EKG & Treadmill, Audiometri, dan Spirometri. Uji preview lokal
memastikan rute viewer Patologi Klinik/Mikrobiologi dirender dengan filter dan
indikator read-only; Audiometri membuka tipe serta field audiometri secara
langsung. Tidak ada form yang disimpan.

Verifikasi akhir: struktur menu (210 menu; 169 ada), manifest 180 rute, audit
167 menu hidup tanpa layar/tabel/RPC/handler/manifest mati, audit keamanan
2.470/2.470, sintaks modul/router, kontrak registry 20 domain, serta diff
check lulus. Rincian keputusan ada di `docs/archive/AUDIT-PELAYANAN-KLINIS-2026-09-06.md`.

## Audit struktur operasional referensi HIS â€” 2026-09-06

Audit baca-saja selesai untuk Finance, Medical Record, Package Service,
Remuneration, SATUSEHAT, dan Workforce. Hasilnya memisahkan fungsi yang sudah
ada, yang tersebar lintas domain, dan gap yang memerlukan keputusan data/bisnis
sebelum dibangun. Tidak ada menu, skema, hasil pasien, transaksi, kredensial,
atau integrasi produksi yang diubah. Rincian workflow dan prioritas tersedia
di `docs/archive/AUDIT-STRUKTUR-OPERASIONAL-HIS-2026-09-06.md`.

## Implementasi struktur operasional HIS â€” 2026-09-06

Navigasi HIS dipadatkan tanpa mengaburkan pemisahan tanggung jawab: Arsip,
MPI, dan governance rekam medis berada dalam **Rekam Medis & Privasi**;
operasional pasien paket berada dalam **Paket & Membership**; payroll dipisah
sebagai **Remunerasi** dari pembukuan; Workforce diberi hub tersendiri. Ikon
pada sidebar rail untuk kelompok baru telah ditambahkan sehingga rail tetap
mini, konsisten, dan dapat dipindai cepat.

Tiga hub baru tersedia dan seluruhnya memakai data baca-saja yang telah ada:
Paket & Membership mengarahkan ke registrasi, langganan, pemakaian hak, master
paket, serta paket korporat; Hub Remunerasi menyatukan roster, presensi,
karyawan, payroll, komisi, dan fee home care; Workforce menyatukan personalia,
struktur, roster, presensi, kalender shift, serta tugas. Mereka memberi
urutan kerja dan batas kontrol, bukan pintasan yang melewati proses approval.

Verifikasi: pemeriksa struktur menu lulus dengan 213 menu aktif, audit 210
menu aktif bersih dari layar/tabel/RPC/handler/manifest mati, audit keamanan
modul 2.970/2.970 lulus, serta `node --check` hub dan router lulus.
Preview lokal mengonfirmasi rail berikon dan rute `#package-service`,
`#remuneration`, serta `#workforce` dirender tanpa penyimpanan data. Rute
lama `tech-analyzer` yang sebelumnya tidak memiliki handler juga kini diarahkan
ke layar Interfacing Analyzer yang sudah ada dan lolos uji preview lokal.

Batas yang disengaja: ledger entitlement paket yang atomik, period closing
payroll/remunerasi, dan pengiriman/retry SATUSEHAT memerlukan tabel/RPC atau
integrasi eksternal. Tidak ada migrasi, finalisasi payroll, ataupun pengiriman
SATUSEHAT dilakukan; tahap tersebut menunggu checkpoint pemilik DB/integrasi.

## LISâ€“HIS: layanan tanpa harga di LIS â€” 2026-09-06
Implementasi: branding AVA LAB; harga per tes/preset/total dihapus; API katalog tanpa harga, muat kunjungan HIS, registrasi/sinkron layanan, sampel idempotent, dan rekonsiliasi tagihan khusus HIS. Migrasi 0051 menjaga tenant/peran, audit permintaan, snapshot layanan dan blok pembayaran sebelum rekonsiliasi. Penerimaan order berbayar tanpa perubahan layanan tetap diperbolehkan.
Bukti: `node scripts/verify-lis-his-sync.cjs` mengeksekusi migrasi dan RPC aktual pada PostgreSQL PGlite terisolasi dengan data sintetis; create/retry, add-on, sample retry, panel analit, role/tenant/anon, konflik, pembatalan klinis dan penetapan tagihan lulus. Browser CUA preview lokal: AVA LAB/Permintaan Pemeriksaan terlihat, checkbox tes bekerja, ringkasan hanya Kode/Pemeriksaan tanpa harga. Preview sintetis sementara sudah dihapus.
Batas: tidak menerapkan migrasi ke produksi. Pemetaan tenant admisi historis perlu diverifikasi sebelum aktivasi; uji kompatibilitas skema/RLS aktual harus dilakukan di staging. Detail kontrak dan langkah aktivasi: docs/LIS-HIS-SERVICE-SYNC.md.
# Bukti audit mendalam LIS â€” 2026-09-06

- Sumber: `C:\Users\acean\Downloads\2020_HCLAB-LIS_Brochure.pdf`, 12 halaman diekstrak dan dirender; montage diperiksa. Hasil kerja sementara berada di `tmp/pdfs/lis-audit/`.
- Laporan: [AUDIT-LIS-MENDALAM-2026-09-06.md](docs/archive/AUDIT-LIS-MENDALAM-2026-09-06.md), berisi prioritas, provenance, matriks brosur, rancangan menu/alur dan acceptance.
- `node scripts/audit-lis-deep.cjs`: 11 kasus OBSERVED; ini reproduksi cacat, bukan acceptance pass. Bukti terstruktur: `docs/audit-evidence/lis-deep-findings.json`.
- `node --check scripts/audit-lis-deep.cjs`: lulus.
- `node scripts/verify-lis-his-sync.cjs`: PASS PostgreSQL (tenant/RBAC/katalog/retry/panel/konflik/billing) dan PASS frontend (payload klinis/retry/ack barcode/tanpa harga).
- Audit ini menambah dokumentasi dan fixture lokal. Tidak mengubah kode klinis, master data, DB produksi atau mengaktifkan migrasi. SQL arsip, helper tanpa pemanggil dan simulator ditandai terpisah dari jalur runtime utama.
- Belum diverifikasi: seluruh UI dengan login/peran di staging, viewport lintas perangkat, RLS/RPC produksi yang terpasang, perangkat analyzer nyata dan distribusi hasil nyata.

## Implementasi kandidat rilis LIS â€” 2026-09-07

- Catatan perubahan, saran akhir dan urutan aktivasi: `docs/LIS-RELEASE-1.1.0-RC1.md`.
- `verify-lis-integrity.cjs` lulus setelah migrasi 0052 dijalankan dua kali pada PGlite sintetis; pemeriksaan RLS sebagai authenticated tidak melihat tenant lain.
- `verify-lis-connector.cjs` lulus; `verify-lis-his-sync.cjs` lulus; sintaks 24 modul LIS lulus; pemeriksaan statis deployment lulus.
- Browser fixture memakai modul aktual tanpa API produksi: kondisi nol, error dan data sintetis diverifikasi; filter 7 hari bertahan. Lebar desktop 1275 dan iframe 733 masing-masing memiliki scrollWidth=clientWidth. Screenshot layout diperiksa melalui CUA.
- Fixture dipindahkan ke `scripts/fixtures/lis-release-check.html` sesudah pengujian, sehingga bukan halaman publik rilis. Untuk mengulang, salin sementara ke root static ava-platform dan hapus salinan setelah uji.
- ZIP connector dibangun dari kode operasional + evaluator QC + contoh konfigurasi kosong; tidak menyertakan config.json/kunci/spool. Dibangkitkan dengan `scripts/build-lis-connector.cjs`.
- Remote repo/cabang main teridentifikasi. Belum tersedia project link Vercel atau kredensial migrasi Supabase; informasi diminta dari pengguna. Tidak menjalankan DB produksi atau mengklaim deployment selesai.

## Audit layanan referensi & perapihan workspace penunjang LIS â€” 2026-09-07

- Audit Chrome dilakukan read-only terhadap delapan domain Services. Tidak ada pencarian/pembukaan data pasien, simpan, cetak, ekspor, sinkronisasi, atau perubahan konfigurasi. Inventaris UI dan workflow tersimpan di [AUDIT_TRUSTMEDIS_SERVICES_2026-09-07.md](docs/archive/AUDIT_TRUSTMEDIS_SERVICES_2026-09-07.md).
- Menu LIS menambahkan kelompok Konteks Klinis & Penunjang yang memanfaatkan rute yang telah ada: Anamnesis & Observasi, Audiometri, Spirometri, serta EKG & Pemeriksaan Penunjang. Tidak ada rute, API, payload, skema, atau hak akses baru.
- Form penunjang sekarang merupakan workspace halaman penuh dengan rail ringkas untuk konteks, pengukuran, interpretasi, serta tinjau/simpan. Alur status di form dikunci; transisi tetap dilakukan dari daftar secara berurutan Draft â†’ Validated â†’ Approved.
- Bukti source: `node --check ava-platform/modules/system/supportive.js`, `node scripts/bangun-menu.js --periksa`, `node scripts/audit-menu-hidup.js`, dan `git diff --check` lulus. Audit menu hidup memeriksa 214 menu aktif tanpa layar, tabel/view, RPC, handler, atau manifest mati.
- Tidak dilakukan uji visual browser terhadap perubahan workspace ini maupun deploy/migrasi produksi. Integrasi eksternal, object storage lampiran, dan perubahan skema tetap di luar irisan ini.
# Konsistensi workspace LIS dan tema â€” 2026-09-07

- Input hasil batch dan per-tes kini memakai halaman kerja penuh, dengan tombol kembali yang eksplisit ke daftar hasil. Tidak ada perubahan payload ataupun urutan Draft â†’ Validated â†’ Approved.
- Form anamnesis dan pemeriksaan penunjang mengikuti pola halaman kerja; dialog tersisa hanya untuk tindakan yang singkat atau konfirmasi.
- Toolbar dan aksi pemeriksaan penunjang memakai label teks seperti `Input pemeriksaan`, `Ubah`, dan `Cetak`; ikon dekoratif tidak lagi menjadi satu-satunya petunjuk aksi.
- Tema terang/gelap memakai token semantik pada informasi, status, dan peringatan. Pemeriksaan rasio teks/latar utama: terang `17.06:1` dan `4.55:1`; gelap `15.19:1` dan `7.30:1`; status pada latar lembut gelap minimum `5.42:1`.
- Bukti teknis: `node --check` untuk results/supportive/anamnesa/utils, `node scripts/bangun-menu.js --periksa`, `node scripts/audit-menu-hidup.js`, `node scripts/audit-keamanan-modul.js` (2970/2970), dan `git diff --check` lulus.

# Koreksi target HIS â€” 2026-09-07

- `his.avahealth.sbs` dipetakan ke workspace `his`; `lis.avahealth.sbs` tetap ke workspace `lis`. Keduanya menggunakan artefak statis yang sama, tetapi scope menu dan halaman awal ditentukan host.
- Registrasi HIS tetap sebagai halaman penuh. Tombol, pencarian, tanggal, tab form, dan placeholder foto diringkas menjadi label teks tanpa ikon dekoratif.
- Anamnesis HIS telah menjadi halaman penuh pada perubahan ini; form panjang tidak lagi dibatasi tinggi modal.

## Konsolidasi indeks kategori HIS â€” 2026-09-07

- Indeks kategori sekarang memakai pola domain â†’ kelompok â†’ fungsi: rel kiri memilih domain, direktori kelompok berada di sisi area kerja, dan kartu fungsi di kanan. Pola ini memakai data yang sama dari `config/menu.json`, sehingga tidak ada ID menu, route, atau aturan role baru.
- Kartu fungsi dipadatkan menjadi teks, deskripsi, dan penanda `Buka`; ikon dekoratif tidak lagi mendominasi halaman. Menu dengan status belum tersedia tetap terlihat dan tidak dapat diklik.
- Direktori kelompok dapat dinavigasi dengan keyboard dan memiliki target scroll semantik; pada layar kecil ia berubah menjadi strip horizontal sehingga tidak memakan tinggi halaman kerja.
- Hub Paket & Membership, Remunerasi, serta Workforce juga disederhanakan: kartu tidak lagi mengandalkan emoji sebagai penanda aksi dan judul/bar status memakai teks eksplisit.
- Verifikasi lokal: `node --check` untuk utilitas dan modul HIS, pemeriksaan skrip inline `index.html`, `node scripts/bangun-menu.js --periksa`, `node scripts/audit-menu-hidup.js` (214 menu aktif, tanpa layar/tabel/RPC/handler/manifest mati), `node scripts/audit-keamanan-modul.js` (2970/2970 lulus), serta `git diff --check` lulus. Tidak ada data, database, atau deployment produksi yang diubah.

## Perapihan pusat konfigurasi HIS â€” 2026-09-08

- Halaman Pengaturan & Master HIS dan setiap domain konfigurasi sekarang menggunakan teks ringkas, tab domain yang dapat diakses keyboard, kartu field scope yang padat, serta tombol tindakan eksplisit. Ikon dekoratif dihapus dari judul, tab, dan daftar tindakan.
- Peta master dan operasional dipertahankan: `Kelola master` hanya menuju halaman master yang terpetakan, `Buka operasional` menuju layar kerja yang telah ada, dan item tanpa form tetap diberi label jujur `Belum memiliki form domain khusus`.
- Verifikasi: `node --check ava-platform/modules/system/config/config_home.js`, `node --check ava-platform/modules/his/operations_hubs.js`, `node --check ava-platform/js/core/utils.js`, pemeriksaan menu, audit menu hidup (214 menu), audit keamanan (2970/2970), serta `git diff --check` seluruhnya lulus. Tidak ada data master, perangkat, antrean, integrasi, atau deployment produksi yang diubah.

## Workspace konfigurasi antrean â€” 2026-09-08

- Form `Loket Baru/Ubah Loket` dan `Pengaturan Layanan` sekarang memakai halaman kerja penuh. Keduanya memiliki konteks, tombol kembali/batal ke daftar, dan submit form eksplisitâ€”bukan lagi dialog dengan tinggi terbatas.
- Fungsi penyimpanan, validasi kode/prefiks, pemetaan `queue_counters` dan `queue_config`, serta refresh daftar setelah berhasil disimpan tetap dipertahankan. Penerbitan nomor antrean tetap merupakan aksi pendek tersendiri; tidak dipindahkan secara mekanis ke halaman lain.
- Bukti: `node --check ava-platform/modules/his/queue_config.js`, `node scripts/bangun-menu.js --periksa`, `node scripts/audit-menu-hidup.js` (214 menu aktif bersih), `node scripts/audit-keamanan-modul.js` (2970/2970), dan `git diff --check` lulus. Tidak ada simpan data, migrasi, atau deployment produksi dalam verifikasi.

## Workspace perjanjian pasien â€” 2026-09-08

- Form perjanjian dipindahkan ke halaman kerja penuh; tombol kembali dan batal mengembalikan operator ke daftar. Pembuatan berhasil mengembalikan halaman ke daftar yang dimuat ulang.
- Validasi nama/waktu wajib serta pemeriksaan bentrok sumber daya sebelum simpan dipertahankan. Tidak ada data pasien atau perjanjian yang digunakan saat verifikasi.
- Bukti: `node --check ava-platform/modules/his/clinicflow.js`, `node --check ava-platform/modules/his/queue_config.js`, pemeriksaan menu, audit menu hidup (214 menu), audit keamanan (2970/2970), dan `git diff --check` lulus.

## Workspace master paket â€” 2026-09-08

- Form buat/ubah paket menjadi halaman kerja penuh. Setelah simpan berhasil, layar kembali membangun katalog paket penuh sebelum memuat dataâ€”bukan mencoba menyegarkan elemen daftar yang sudah tidak ada di halaman form.
- Validasi kode dan nama, payload paket, serta alur pengelolaan isi pemeriksaan yang terpisah dipertahankan. Tidak ada paket, tarif, HPP, atau master yang ditulis selama verifikasi.
- Bukti: `node --check ava-platform/modules/system/config/config_package.js`, pemeriksaan menu, audit menu hidup (214 menu aktif), audit keamanan (2970/2970), dan `git diff --check` lulus.

## Penuntasan menu konfigurasi â€” 2026-09-08

- Pemeriksaan `config/menu.json` menemukan `TOTAL_NON_ACTIVE=0`: seluruh 214 menu pada peta bertanda aktif. Tidak ada item `belum` yang disembunyikan atau diaktifkan secara kosmetik.
- Label `Kerangka master` pada pusat konfigurasi dikoreksi menjadi `Tersedia` karena setiap label tersebut telah dipetakan ke domain CRUD di `MASTER_REGISTRY`. Domain baru Integrasi & Konektivitas membuka flow antrean, registry kiosk/display, telemedicine, dan setup SATUSEHAT dari satu tempat.
- Bukti: `node --check ava-platform/modules/system/config/config_home.js`, `node scripts/bangun-menu.js --periksa`, audit menu hidup (214 menu, tanpa layar/tabel/RPC/handler/manifest mati), audit keamanan (2970/2970), dan `git diff --check` lulus. Tidak ada migrasi, data master, secret, integrasi eksternal, atau deployment produksi yang diubah.

## Pemeriksaan kesiapan runtime menu â€” 2026-09-09

- Validasi statis tambahan memuat registry konfigurasi dan membuktikan bahwa semua item pada 11 domain mempunyai rute halaman atau domain CRUD; tidak ada lagi item pusat konfigurasi yang hanya berupa label.
- `verify-master-registry-contract.js` lulus untuk 20 menu/domain. `verify-queue-tenant-contract.js` lulus untuk isolasi tenant, registry perangkat, rate limit, dan minimisasi data. `verify-deploy-readiness.js` lulus untuk domain publik dan konfigurasi runtime secara statis.
- Batas yang tetap berlaku: kelulusan statis tidak menjalankan migrasi ataupun mengaktifkan koneksi pihak ketiga di lingkungan produksi. SQL/migrasi tersedia dan harus diterapkan terlebih dahulu pada staging oleh pemilik database sebelum modul yang bergantung data dapat digunakan pada domain produksi.

## Audit Apps fase awal â€” selesai lokal, 8 September 2026

- Pintu masuk publik diaudit baca-saja; tidak melakukan login/transaksi produksi.
- Login disederhanakan dan responsif; demo publik, kredensial bawaan, klaim sertifikasi tanpa bukti, dan pendaftaran sukses tiruan dihapus.
- Autentikasi fail-closed: profil/peran diverifikasi, akses korporat memakai RPC, token/flag tiruan tidak memulihkan sesi. Logout membersihkan token. Reload sementara memerlukan login ulang.
- Modal tertutup tidak muncul pada pohon aksesibilitas. Kontras pilihan aktif diperbaiki. Desktop 1280Ã—720, mobile 390Ã—844, dan lebar 320 diperiksa via browser; tidak ada overflow horizontal pada 320px.
- Dua belas uji regresi sintetis lulus (12/12); sintaks JS/SW dan sinkronisasi domain lulus.
- Aksi pembayaran/pencairan dan beberapa simulasi klinis diganti pesan belum tersedia. Banner versi uji menandai dashboard yang masih memuat contoh.
- Laporan terperinci: docs/AUDIT_APPS_FASE_AWAL_2026-09-08.md. Masih perlu audit server/RLS, pemisahan contoh, transaksi cashback, dan EHR berdasarkan ID sebelum produksi.
- Belum deploy. Checkout juga berisi perubahan HIS/LIS lain; tidak menerbitkan perubahan tersebut sebagai bagian pekerjaan Apps.

## Audit keamanan domain dan sesi â€” 10 September 2026
OWNED_BY: ava. Laporan: docs/archive/AUDIT_SECURITY_2026-09-10.md. Bukti HTTP tanpa login: docs/audit-evidence/security-http-2026-09-10.json (44 hostname + 6 jalur www). Markup password demo ditemukan pada produksi Apps dan Corp; tidak mencoba login dengan kredensial tersebut. HTTP 200 pada path konfigurasi tidak dianggap bukti kebocoran file karena kemungkinan SPA fallback.
Perbaikan lokal menghapus kredensial/demo/bypass, URL session injection, localStorage token dan role metadata fallback; menambahkan middleware staf HttpOnly cookie/UUID allowlist, CSRF check, domain public allowlist, no-store dan pembersihan service worker. Hanya www publik. Konfigurasi staf wajib tersedia sebelum deploy; konfigurasi kosong menutup domain privat.
Verifikasi: node --test scripts/uji/test_security_domains.cjs scripts/uji/test_apps_auth.cjs = 22/22 PASS; bangun-vercel --periksa PASS; verify-deploy-readiness PASS; syntax JS dan git diff --check PASS. Pengujian middleware berbasis Web Request sintetis, bukan build Vercel.
Belum deployment: alat browser timeout dua kali ketika membuka tab dashboard Vercel. Belum membaca/mengubah DB produksi, merotasi password atau mencabut semua sesi. Daftar UUID staf belum tersedia. Detail batasan dan langkah penerapan ada di laporan. Perubahan lokal pengguna yang sudah ada dipertahankan.

---

## Verifikasi restrukturisasi sebelum melanjutkan Apps — 10 September 2026

### Rencana dan checklist
- [x] Baca AGENTS.md baru dan status Git; baseline bersih pada cde7799.
- [x] Cocokkan lokasi Apps, AVA Tech, dokumen, fixture, dan entrypoint dengan boundary registry.
- [x] Jalankan pemeriksaan boundary/domain serta regresi login dan keamanan.
- [x] Koreksi rujukan laporan Apps yang menunjuk lokasi arsip yang tidak ada.
- [x] Lanjutkan verifikasi kontrak menu Apps di atas baseline baru; pertahankan pengamanan sesi/cache.

### Implikasi IP & Kepatuhan
OWNED_BY: ava. Verifikasi baca-saja, uji sintetis tanpa koneksi DB produksi. Tidak memindahkan runtime, mengubah skema/master, mengembalikan penyimpanan token lama, atau menimpa perubahan keamanan dari pekerjaan lain. Pembaruan berikutnya dibatasi ke kontrak menu/tes dan rujukan dokumentasi Apps.

### Bukti awal
- verify-application-boundaries: 6 boundary, 17/17 domain, semua entrypoint dan root tersedia.
- bangun-vercel --periksa: sesuai config/domain.json.
- test_apps_auth + test_security_domains: 24/24 lulus.
- Syntax app.js dan navigation.js: lulus.
- Apps tetap di ava-platform/apps; fixture di scripts/uji; AVA Tech di ava-platform/modules/tech-platform. Rencana/checklist/bukti memakai berkas ini, backlog memakai docs/project/backlog.md.
- Service worker terbaru membersihkan cache Apps lama dan unregister; tidak dikembalikan ke versi precache sebelumnya.

### Hasil verifikasi lanjutan struktur Apps
- test_apps_navigation: 6/6 lulus. Setiap halaman terdaftar memiliki tepat satu target HTML; tidak ada view-panel bersarang; menu peran tidak duplikat; maker/approver terpisah; aset lokal dan urutan script valid.
- verify-deploy-readiness: lulus secara statis; bukan bukti deploy atau UAT produksi.
- Rujukan laporan Apps dikoreksi ke docs/AUDIT_APPS_FASE_AWAL_2026-09-08.md yang benar-benar tersedia. Laporan audit lama lainnya berada di docs/archive; direktori docs/audit tidak ada pada baseline ini.
- Total verifikasi terfokus: 24 uji login/keamanan + 6 uji struktur/navigasi lulus. Tidak ada perubahan kode runtime atau pengamanan sesi dalam langkah verifikasi ini.
- Lanjutan pekerjaan produk: pengujian visual final dan kelengkapan alur menu Apps tetap perlu diselesaikan; verifikasi struktur tidak menyatakan seluruh layanan siap produksi.

---

## Verifikasi perapihan aplikasi sebelah — 11 September 2026

### Rencana dan checklist

- [x] Pastikan working tree bersih serta identifikasi commit terakhir setelah perapihan file/folder.
- [x] Telaah dampak commit terhadap connector LIS, QC/lot verification, dokumentasi proyek, dan tes Apps.
- [x] Jalankan ulang regresi Apps, domain/session security, Fase 2, connector LIS, dan readiness deployment statis.
- [x] Pastikan tidak ada perubahan data, migrasi, atau deploy produksi selama verifikasi.

### Implikasi IP & Kepatuhan

OWNED_BY: ava. Verifikasi bersifat lokal dan memakai fixture sintetis. Tidak ada data pasien, kredensial, konfigurasi secret, koneksi DB produksi, ataupun perubahan skema yang dibaca atau diubah. Bukti readiness statis bukan persetujuan untuk mengaktifkan integrasi eksternal atau menerapkan migrasi produksi.

### Bukti

- Working tree bersih pada `2322ad6` (`finalize LIS connector and portal audit fixes`). Commit ini memperbarui connector LIS, evaluator QC/lot verification, artefak connector, status/backlog proyek, serta menambah regresi navigasi Apps; tidak memindahkan entrypoint aplikasi.
- `node --test scripts/uji/test_apps_auth.cjs scripts/uji/test_security_domains.cjs scripts/uji/test_apps_navigation.cjs`: **30/30 lulus**.
- `node scripts/uji/test_fase2_e2e.js`: **14/14 skenario lulus**, meliputi QC Westgard, transformasi FHIR, jurnal konsolidasi, dan cold-chain fixture.
- `node scripts/verify-lis-connector.cjs`: lulus untuk restart durable, deduplikasi, karantina, checksum, frame terfragmentasi, provenance perangkat, dan evaluator QC bersama.
- `node scripts/verify-deploy-readiness.js`: lulus secara statis. Tidak ada deploy ataupun UAT lingkungan produksi.

---

## Pemulihan sesi login lintas domain — 11 September 2026

### Rencana dan checklist

- [x] Reproduksi sumber masalah secara baca-saja pada aset publik HIS dan LIS; keduanya masih melayani skrip autentikasi yang sama.
- [x] Telusuri urutan autentikasi browser, refresh token, pemuatan profil akses, dan boot halaman tanpa menggunakan kredensial maupun membaca data produksi.
- [x] Bedakan sesi tidak sah dari profil/RBAC yang belum tersedia; tambahkan pemulihan refresh token pada boot dan layar akses yang jelas tanpa membuka data klinis.
- [x] Tambahkan regresi untuk mencegah token sesi dihapus hanya karena profil gagal dimuat atau karena refresh token tidak tersedia.
- [x] Jalankan pemeriksaan sintaks dan suite autentikasi/domain yang terdampak; catat batas deploy/UAT.

### Implikasi IP & Kepatuhan

OWNED_BY: ava. Perbaikan dibatasi pada mekanisme sesi browser dan pesan akses. Tidak menyimpan atau mencetak kredensial, token, data pasien, UUID pengguna, maupun konfigurasi rahasia. Tidak mengubah skema, RLS, profil pengguna, database, atau deployment produksi. Akses klinis tetap fail-closed: sesi yang valid tetapi tanpa profil/RBAC tidak boleh membuka aplikasi dan harus menampilkan penjelasan yang dapat ditindaklanjuti, bukan diberi peran bawaan.

### Bukti

- Aset publik HIS dan LIS pada saat pemeriksaan sama-sama melayani `js/auth.js` lama (8.999 byte) yang memuat pola reload lalu menghapus token saat pembacaan profil gagal. Pemeriksaan hanya membaca aset publik dan tidak menjalankan login.
- `sbGetStrict` dipakai khusus untuk gerbang profil agar penolakan RLS/jaringan tidak berubah menjadi daftar kosong. Pesan pengguna tidak memaparkan detail PostgREST/RLS; sesi Auth sah dipertahankan pada layar `Akses perlu diverifikasi` sampai pengguna memilih masuk dengan akun lain.
- Boot `index.html` kini mencoba refresh token sekali sebelum menyatakan sesi tidak sah. Semua host berbasis shell bersama—HIS, LIS, OPS, Tech, Care, Nutri, Sanctuary, Console, Nakes, Corporate, CRM, Wellness, Kiosk, Lacak, dan Antrean—menerima perbaikan ini saat bundle yang sama dideploy. Portal `apps` sudah menampilkan error fail-closed tanpa reload setelah klik login dan tetap tercakup oleh regresi portal.
- `node --test scripts/uji/test_root_auth_session.cjs scripts/uji/test_security_domains.cjs scripts/uji/test_apps_auth.cjs scripts/uji/test_apps_navigation.cjs`: **33/33 lulus**.
- `node --check ava-platform/js/core/api.js`, `node --check ava-platform/js/auth.js`, `node scripts/bangun-menu.js --periksa`, `node scripts/audit-menu-hidup.js` (214 menu), `node scripts/verify-deploy-readiness.js`, serta `git diff --check`: lulus.
- Belum deploy. Perubahan baru berlaku pada domain produksi setelah build/deploy dari commit ini selesai. Sesudah deploy, UAT minimal perlu memakai satu akun staf yang memang sudah memiliki profil/peran dan satu akun tanpa profil untuk memastikan layar akses muncul tanpa loop; tidak perlu membuat atau mengubah akun selama UAT.
