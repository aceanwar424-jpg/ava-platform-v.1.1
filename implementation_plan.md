# Rencana Implementasi — Penyempurnaan HIS & Antrean Publik

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
- [x] Verifikasi simulasi ambil nomor → tampil pada layar antrean.
- [x] Jadikan kontrak kiosk sebagai migrasi HIS resmi, terjejak dan bukan skrip lepas.
- [x] Hubungkan Edge Function produksi ke prosedur kiosk khusus berbasis service-role.
- [x] Verifikasi migrasi, build desktop, dan kesiapan deploy Vercel/Supabase.
- [x] Ubah rail desktop menjadi sidebar ringkas berbasis ikon dengan grouping accordion yang tetap utuh.
- [x] Padatkan proporsi sidebar, topbar, dan area konten tanpa mengubah navigasi atau RBAC.
- [x] Konsolidasikan menu HIS menjadi domain kerja → layanan → modul agar layanan penunjang tidak memanjangkan sidebar.
- [x] Tambahkan pemilih seluruh modul HIS yang dapat dicari dari rail ringkas.
- [x] Tampilkan breadcrumb domain → layanan → modul secara konsisten saat navigasi.
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

## Fase Kesiapan Produksi — 3 September 2026

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
8. [ ] Tambahkan test regresi RBAC dan alur kiosk → loket → display menggunakan database sementara.
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

## Registry Master HIS — Implementasi Source 4 September 2026

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

## Audit Admission & Navigasi Konteks — 5 September 2026

### Urutan implementasi

1. [x] Audit read-only hub Admission, enam variasi registrasi, form kosong,
   Back Office, Queue, dan Queue Outpatient.
2. [x] Dokumentasikan perbedaan tujuan, tahapan, dan field kritis agar
   registrasi layanan, kit, paket, langganan, serta penggunaan langganan tidak
   kembali disatukan secara keliru.
3. [x] Ganti accordion rail bertingkat dengan panel konteks dua kolom:
   domain → sub-menu → modul.
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

## Penyempurnaan Workspace Admission — 5 September 2026

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

## Ergonomi Form Admission — 5 September 2026

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

## Konsolidasi Navigasi HIS & Shell Operasional — 5 September 2026

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

## Penyelesaian End-to-End Admission — 6 September 2026

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

## Audit dan viewer Pelayanan Klinis — 6 September 2026

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

## Audit struktur operasional referensi HIS — 6 September 2026

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

## Implementasi struktur operasional HIS — 6 September 2026

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

## Perombakan web publik AVA Health — 2026-09-05
Rencana: (1) audit portal dan routing (≤1 jam), (2) bangun profil publik responsif, detail brand, katalog, sejarah, sertifikasi, kontak (≤1 jam), (3) validasi tautan/aset/routing dan preview (≤1 jam).
Arah visual: editorial kesehatan, putih dan navy, aksen emerald, tipografi besar, enam brand sebagai portofolio bisnis. Pertahankan stack statis dan deployment Vercel yang ada.
### Implikasi IP & Kepatuhan
OWNED_BY: ava untuk konten situs perusahaan yang sudah tersedia; tidak dipindahkan menjadi produk generik. Tidak mengubah master katalog, DB, provider LLM, atau aplikasi operasional. Hapus autentikasi dari halaman publik; hanya tautkan apps.avahealth.sbs. Tidak menerbitkan klaim sertifikasi, manfaat klinis, tanggal sejarah, atau produk tersedia tanpa bukti. Kontak bersumber portal lama. Metadata sumber dan kebutuhan verifikasi dicatat dalam audit. Publikasi produksi terpisah dari penyuntingan lokal.

## Pengayaan profil publik premium — 2026-09-05
Rencana: 1) teliti sumber kesehatan primer dan rumus kalkulator (≤1 jam); 2) perluas enam profil brand, visi/misi, model bisnis, alur manufaktur sebagai skenario operasional (≤1 jam); 3) bangun jurnal kesehatan bersumber dan kalkulator lokal BMI/kalori serta penyempurnaan premium (≤1 jam); 4) verifikasi kalkulasi, konten, tautan, ekspor dan preview (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Pengguna mengotorisasi rancangan dengan asumsi semua lini sudah berjalan. Asumsi manufaktur/farmasi diberi penanda konsep, tidak menjadi klaim izin atau operasi faktual. Tidak menambah klaim CPOB/izin edar terverifikasi. Artikel orisinal berbasis sumber primer yang diperiksa tanggal 2026-09-05; tidak mengaku telah ditinjau dokter. Kalkulator khusus dewasa, bukan diagnosis atau resep diet; input hanya di memori browser. Tidak mengubah master data, vendor atau sistem produksi.

## Konten komersial setelah discovery — 2026-09-05
Rencana: susun positioning AVA Tech dan hierarki AVA/Queen (≤1 jam); terapkan beranda, tiga solusi faskes, demo/pilot, model biaya, investor dan ekspansi produk (≤1 jam); verifikasi seluruh halaman, konsistensi status, tautan dan preview (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Sumber fakta adalah jawaban pemilik dalam percakapan: seluruh lini dalam pengembangan; HIS/LIS/Apps siap demo; laporan terbukti di demo tanpa jenis laporan spesifik terkonfirmasi; tersedia demo/uji coba terbatas. Hindari angka traction, sertifikat, nama anak PT, bukti produksi atau laporan contoh yang belum diberikan. Queen adalah brand usaha sendiri, AVA korporat dan AVA Tech B2B. Produk herbal prioritas ekspansi, pabrik bukan klaim kapasitas aktual. Biaya setup/modular ditambah lisensi bulanan tanpa harga rekaan. Tidak mengubah data master, aplikasi operasional atau integrasi eksternal; tautan email hanya menyiapkan permintaan pengguna, bukan mengirim pesan.

## Struktur multipage dan identitas bisnis — 2026-09-05
Rencana: audit dokumen identitas (≤1 jam), pecah halaman dan navigasi (≤1 jam), tulis profil rinci serta Health/Lab fisik dan Care & Wellness inklusif (≤1 jam), verifikasi tautan lintas halaman/preview (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Sumber: instruksi terbaru pemilik, AVA HEALTH SOLUTION THE FUTURE.md (Vol 3.0, 2026), dan AVA-DOC-ARCH-2026-V5_Arsitektur_Sistem_6_Unit_Usaha.md. PDF tidak ditemukan melalui pencarian file termasuk hidden/ignored; lokasi diminta, pekerjaan independen dilanjutkan. Publikasikan narasi korporat, visi, nilai, dan lingkup bisnis; jangan salin formulasi, HPP/harga privat, proyeksi investor internal, atau rincian teknis rahasia. Instruksi terbaru mengungguli cakupan Care khusus perempuan dalam dokumen lama. Faskes dan lab milik sendiri dijelaskan berdasarkan konfirmasi pemilik; jangan reka alamat, izin, jaringan cabang, sertifikasi, tanggal pendirian. Tidak mengubah DB atau aplikasi operasional.

## Kisah perusahaan & founder — 2026-09-06
Rencana: perluas narasi dari dokumen korporat dan discovery (≤1 jam), buat halaman sejarah serta founder dengan ruang foto (≤1 jam), verifikasi halaman dan tautan (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Founder/Owner/CEO: Ace Anwar sesuai dokumen induk dan instruksi pemilik. Gunakan pengalaman operasional lab, informatika dan mutu yang tersedia. Tidak mengarang pendidikan, tanggal berdiri, pengalaman pasien, pencapaian, kutipan pribadi atau timeline bertanggal. Sejarah ditulis sebagai latar dan perkembangan gagasan; rencana ekspansi dipisahkan dari status saat ini. Ruang foto disengaja sesuai permintaan, tanpa foto orang pengganti atau URL gambar rusak. Konten publik tidak memuat formula/proyeksi internal.

## Audit dan perapihan LIS — 2026-09-06
Rencana: audit navigasi dan akses produksi (≤1 jam), rapikan label/pengelompokan serta tema khusus LIS (≤1 jam), periksa rute, generator, dan sintaks (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Perubahan presentasi aplikasi sendiri, tanpa pemindahan aset ke produk generik. Tidak mengubah ID menu, RBAC, skema, nilai rujukan, aturan QC, validasi klinis atau integrasi produksi. Akses produksi berhenti pada halaman login; pengujian kode lokal tanpa data pasien. Istilah klinis penting dipertahankan; rincian teknis tetap ada dalam deskripsi dan konfigurasi.

## LIS → HIS: pemilihan layanan dan tagihan — 2026-09-06
Rencana: (1) telusuri kontrak admisi/layanan dan hapus harga/branding workstation (≤1 jam); (2) buat API transaksi layanan klinis dan antrean rekonsiliasi HIS dengan identitas order, deduplikasi, dan konflik versi (≤1 jam); (3) tampilkan perubahan LIS pada admisi HIS, gunakan perhitungan HIS saat penetapan tagihan, uji sintetis dan dokumentasikan deployment (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Pengguna mengotorisasi sinkronisasi skema HIS/LIS; implementasi migrasi lokal dan kontrak API boleh dikerjakan. Tidak menjalankan migrasi/menulis DB produksi. LIS mengirim ID layanan tanpa nominal pembayaran; HIS tetap menentukan harga/diskon dan status pembayaran. Tidak mengubah kunci master tes, hasil tervalidasi atau transaksi sudah dibayar. Perubahan layanan dikirim sebagai permintaan teraudit ke HIS, bukan menimpa tagihan final. Data pengujian sintetis; API wajib autentikasi, pembatasan tenant dan idempotensi.

## Audit mendalam LIS berbasis brosur — 2026-09-06
Rencana: baca 12 halaman brosur beserta visual (≤1 jam), audit modul/UI/status/API dan reproduksi temuan menggunakan data sintetis (≤1 jam), tulis matriks gap/prioritas/menu/alur target dan kriteria penerimaan (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava untuk hasil audit; brosur Sysmex adalah referensi pihak ketiga, bukan materi untuk disalin ke produk. Gunakan kemampuan dan prinsip alur sebagai pembanding, tanpa menyalin merek, tampilan, screenshot, atau klaim instalasi. Audit tidak menyatakan sertifikasi atau kesetaraan produk. Tidak mengubah proses klinis, data master, DB produksi, atau menjalankan pengiriman data pasien. Prioritas perubahan didasarkan pada bukti kode dan uji sintetis; status deployment dicatat terpisah.
# Perbaikan dan rilis LIS — 2026-09-06

Rencana per irisan ≤1 jam: (1) benahi kebenaran dashboard/grafik/status panel dan pesan simpan; (2) satukan evaluator QC serta tutup autoverifikasi tidak aman; (3) perbaiki identitas riwayat, laporan dan helper/entry lama; (4) perkuat API transisi hasil dan connector, uji sintetis; (5) rapikan menu/responsivitas, jalankan release checks dan periksa target deployment; (6) rilis artefak yang lolos, dokumentasikan bukti dan batas operasional.

## Implikasi IP & Kepatuhan

OWNED_BY: ava. Pengguna secara eksplisit meminta implementasi dan release setelah audit. Otorisasi ini mencakup perbaikan aplikasi dan persiapan/deployment rilis pada target proyek yang terbukti; tidak mencakup mengarang SOP klinis, mengubah nilai master, memindahkan data pasien atau mengaktifkan fitur belum tervalidasi. Perubahan operasional diuji dengan data sintetis. Autoverifikasi tetap ditahan jika penjagaan server belum tervalidasi. Tidak menyalin aset brosur. Hindari mengikutsertakan perubahan task lain pada rilis; status deployment dan pengujian alat dilaporkan apa adanya.

## Penyelarasan navigasi LIS dengan audit layanan referensi — 7 September 2026

### Urutan implementasi

1. [x] Audit read-only menu, sub-menu, halaman, tab, toolbar, tabel, dan alur layanan referensi—termasuk anamnesis/specimen, audiometri, spirometri, patologi, radiologi, dan layanan penunjang.
2. [x] Bedakan secara eksplisit tiga batas kerja: HIS klinis, LIS pra/analitik/pasca-analitik, dan viewer hasil lintas-sistem.
3. [x] Rapikan menu LIS menjadi kelompok kerja yang ringkas dan berorientasi peran tanpa menduplikasi input klinis dari HIS.
4. [x] Tambahkan konteks handoff order/hasil untuk layanan non-lab sebagai navigasi baca-saja atau tautan antar-workspace bila rute telah tersedia.
5. [x] Verifikasi rute, RBAC/menu, sintaks, dan responsivitas menggunakan data kosong/sintetis; jangan membuat transaksi, data pasien, atau koneksi produksi.

### Implikasi IP & Kepatuhan

- Audit referensi hanya membaca UI yang terlihat dan tidak menyalin data pasien, konfigurasi privat, atau aset visual pihak ketiga.
- LIS tetap menjadi sumber kerja spesimen, pemeriksaan, mutu, validasi, dan rilis hasil lab. Audiometri, spirometri, radiologi, dan anamnesis klinis tetap dimiliki HIS; LIS hanya menerima order atau menyajikan hasil yang memang berada pada kontrak data yang disetujui.
- Tahap ini tidak mengubah skema, RLS, integrasi analyzer, koneksi LIS/HIS produksi, atau hasil klinis. Perubahan kontrak lintas-sistem memerlukan checkpoint pemilik database dan integrasi.

## Konsistensi halaman kerja LIS dan tema terang/gelap — 7 September 2026

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

## Koreksi sasaran: workspace HIS — 7 September 2026

### Urutan implementasi

1. [x] Pastikan pemetaan `his.avahealth.sbs` menuju workspace HIS, bukan LIS; keduanya berbagi artefak build tetapi lingkup menu dipilih menurut host.
2. [x] Terapkan pola halaman penuh pada alur HIS yang panjang: registrasi sudah berupa workspace, anamnesis dipindahkan dari modal ke halaman penuh.
3. [x] Kurangi ikon dekoratif pada toolbar/form Registrasi HIS dan gunakan label tindakan eksplisit.
4. [x] Wariskan perbaikan tema dan kontras global ke HIS; tidak mengubah skema maupun transaksi.

### Implikasi IP & Kepatuhan

- Ini hanya koreksi target UI HIS. Tidak mengubah nilai klinis, data pasien, antrean, tagihan, otorisasi, skema, atau layanan produksi.
- Dialog pendek tetap dipakai untuk tindakan atomik seperti konfirmasi, pemilih cepat, atau penerbitan nomor; input klinis/administratif panjang menggunakan halaman penuh.

## Konsolidasi indeks seluruh kategori HIS — 7 September 2026

### Urutan implementasi

1. [x] Audit ulang pola navigasi referensi secara baca-saja: domain di rel kiri, kelompok proses pada area kerja, lalu daun menu di dalam kelompok.
2. [x] Ubah indeks kategori HIS menjadi direktori ringkas: navigasi kelompok di sisi area kerja dan daftar fungsi di kanan, tanpa menambah rute atau mengubah RBAC.
3. [x] Ringkas ukuran kartu, jarak, dan ikon dekoratif; pertahankan deskripsi serta status ketersediaan agar fungsi tetap dapat dipindai.
4. [x] Verifikasi pembentukan menu, semua action, sintaks, aksesibilitas keyboard, tema terang/gelap, dan regresi menu hidup.

### Implikasi IP & Kepatuhan

- Referensi eksternal hanya dipakai untuk memahami pola navigasi dan informasi yang terlihat; tidak menyalin aset visual, data pasien, konfigurasi privat, atau data transaksi.
- Perubahan terbatas pada layer presentasi/navigasi lokal. Tidak mengubah peta peran, rute, skema, tabel, RPC, data klinis, tagihan, antrean, maupun integrasi produksi.
- Label status tetap tertulis, bukan hanya dibedakan oleh warna. Menu yang belum tersedia tetap ditandai dan tidak dibuat seolah berfungsi.

## Perapihan pusat konfigurasi HIS — 8 September 2026

### Urutan implementasi

1. [x] Tinjau ulang peta konfigurasi terhadap rute master dan operasional yang tersedia.
2. [x] Ubah pusat konfigurasi serta halaman domainnya menjadi direktori teks yang padat dan konsisten dengan indeks kategori.
3. [x] Hilangkan ikon dekoratif dari tombol/tab konfigurasi dan pertahankan status serta field scope sebagai teks eksplisit.
4. [x] Jalankan pemeriksaan rute, handler, sintaks, dan regresi manifest; tanpa menjalankan perubahan master atau integrasi.

### Implikasi IP & Kepatuhan

- Implementasi hanya merapikan presentasi rute konfigurasi yang telah ada. Tidak membuat atau mengubah data master, konfigurasi perangkat, kredensial, antrean, maupun koneksi eksternal.
- Item yang belum memiliki form operasional harus tetap diberi status jujur; perubahan skema dan penyambungan DB memerlukan checkpoint pemilik database.

## Workspace konfigurasi antrean — 8 September 2026

### Urutan implementasi

1. [x] Audit modal pada alur HIS untuk membedakan aksi atomik dari formulir konfigurasi yang memerlukan konteks.
2. [x] Pindahkan formulir loket dan prefiks/kuota layanan dari modal ke halaman kerja penuh dengan kembali eksplisit.
3. [x] Pertahankan validasi, pemetaan tabel, dan penyegaran daftar setelah simpan; tidak menjalankan tulis data saat pengujian.
4. [x] Jalankan pemeriksaan sintaks, struktur menu, rute/handler, dan integritas modul.

### Implikasi IP & Kepatuhan

- Perubahan hanya menggeser UI formulir yang sudah ada; payload, validasi, tabel, serta kewenangan penulisan tetap sama.
- Loket, kuota, perangkat antrean, dan koneksi kiosk/display tidak dibuat atau diubah oleh pekerjaan ini. Aktivasi/penyelarasan lingkungan produksi tetap memerlukan checkpoint integrasi.

## Workspace perjanjian pasien — 8 September 2026

### Urutan implementasi

1. [x] Klasifikasikan form perjanjian sebagai workflow panjang: identitas, layanan, jadwal, sumber daya, catatan, dan validasi bentrok.
2. [x] Ubah form modal menjadi halaman kerja penuh dengan kembali/batal eksplisit ke daftar perjanjian.
3. [x] Pertahankan validasi mandatory dan pengecekan sumber daya sebelum simpan; kembali ke daftar hanya setelah respons berhasil.
4. [x] Jalankan pemeriksaan sintaks serta regresi menu/rute/modul tanpa membuat perjanjian baru.

### Implikasi IP & Kepatuhan

- Tidak ada perjanjian, identitas pasien, nomor telepon, atau pesan pengingat yang dibuat/diubah selama pekerjaan ini.
- Perubahan UI tidak mengubah aturan validasi, payload, penerima pesan, atau integrasi eksternal. Pengiriman pengingat tetap aksi eksplisit operator.

## Workspace master paket — 8 September 2026

### Urutan implementasi

1. [x] Klasifikasikan form paket sebagai form panjang: kode, nama, segmentasi, dua tarif, HPP, TAT, deskripsi, persiapan, dan status.
2. [x] Ubah buat/ubah paket dari modal menjadi halaman kerja penuh dengan kembali eksplisit ke katalog paket.
3. [x] Pertahankan validasi kode/nama, payload, dan penyegaran katalog setelah simpan sukses.
4. [x] Jalankan pemeriksaan sintaks, menu/rute, keamanan modul, dan pemeriksaan diff tanpa melakukan perubahan master.

### Implikasi IP & Kepatuhan

- Ini perubahan presentasi form. Tidak membuat, mengubah, menghapus, atau menerbitkan paket, tarif, HPP, maupun instruksi persiapan pasien.
- Penetapan katalog/tarif dan perubahan master tetap tunduk pada otorisasi operasional yang ada; tidak ada skema atau integrasi produksi yang diubah.

## Penuntasan menu konfigurasi yang terlihat belum aktif — 8 September 2026

### Urutan implementasi

1. [x] Periksa seluruh status di `config/menu.json`: seluruh 214 menu aktif, tidak ada menu berstatus `belum`.
2. [x] Cocokkan label `Kerangka master` dengan registry CRUD yang sudah ada dan sambungkan setiap master yang dipetakan.
3. [x] Tambahkan domain Integrasi & Konektivitas untuk flow antrean, registry kiosk/display, telemedicine, dan SATUSEHAT.
4. [x] Verifikasi sintaks, struktur menu, handler/rute, dan audit modul; tidak menjalankan migrasi atau menulis data produksi.

### Implikasi IP & Kepatuhan

- Label kesiapan hanya diubah setelah rute master dan field registry ditemukan di kode. Ini bukan klaim bahwa konfigurasi telah diisi atau integrasi eksternal telah diaktifkan.
- SATUSEHAT, kiosk/display lintas-domain, dan telemedicine tetap menyimpan hanya referensi secret; aktivasi koneksi dan migrasi lingkungan produksi memerlukan checkpoint pemilik integrasi/database.

## Audit Apps fase awal — 7 September 2026

### Rencana (sub-task masing-masing < 1 jam)
1. Audit halaman publik dan sumber login, modal, cache, serta sesi.
2. Rapikan login responsif: bahasa Indonesia, akun kosong, hapus akses demo publik dan klaim sertifikasi tanpa bukti.
3. Perbaiki autentikasi fail-closed, peran dari profil, dan pemulihan sesi; modal tertutup tidak dapat difokuskan.
4. Verifikasi sintaks, regresi autentikasi dengan mock sintetis, rute, dan browser desktop/mobile lokal.

### Implikasi IP & Kepatuhan
OWNED_BY: ava (pemeliharaan aplikasi yang sudah ada; bukan ekstraksi produk generik).
Tidak mengubah skema, kunci katalog, nilai klinis, provider LLM, atau integrasi eksternal. Tidak menulis data produksi. Data uji sintetis. Klaim sertifikasi di halaman masuk dihapus karena bukti tidak tersedia dalam audit. Otorisasi server/RLS dan simulasi klinis di modul lain tetap perlu audit terpisah sebelum peluncuran produksi.

### Hasil audit Apps — 8 September 2026
Implementasi lokal dan verifikasi selesai. Detail bukti pada walkthrough.md dan docs/AUDIT_APPS_FASE_AWAL_2026-09-08.md. Reload sementara meminta login ulang; SSO query token dihentikan sampai tersedia verifikasi server. Tidak ada deployment atau penulisan produksi.

## Menu Apps siap uji — 8 September 2026
### Rencana
1. Inventarisasi menu, target panel, renderer, dan status fungsi (<1 jam).
2. Satukan label Indonesia, perbaiki routing/active state dan pemuatan data (<1 jam).
3. Isi beranda/profil dari akun; pisahkan fitur konsep, tampilkan empty/error state nyata (<1 jam).
4. Uji semua target menu pada fixture sintetis lokal dan regresi autentikasi (<1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Tidak mengubah skema, data katalog, integrasi, RBAC server, atau data produksi. Tidak mengisi halaman kosong dengan data pasien/hasil/keuangan rekaan. Menu konsep tetap terdokumentasi dan ditandai belum tersedia; tidak dianggap operasional. Fixture hanya di server localhost terpisah dan tidak ikut output deployment.

## Audit keamanan domain dan sesi — 10 September 2026
### Rencana
1. Audit statis autentikasi, kredensial, routing dan inventaris domain; pemeriksaan HTTP tanpa login/data pasien (<1 jam).
2. Hapus kredensial demo/bypass dan penerimaan sesi dari URL; batasi persistensi sesi dan file deploy (<1 jam).
3. Uji negatif sintetis, dokumentasikan risiko backend/produksi dan tindakan deployment (<1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Perbaikan keamanan untuk sistem ini; tidak menyalin aset ke produk generik, mengubah master/katalog, atau membaca data pasien. Tidak menghubungkan DB produksi. Klaim keamanan dibatasi bukti; rotasi akun dan RLS produksi membutuhkan akses administratif yang terverifikasi. Hanya www.avahealth.sbs merupakan website publik; domain operasional memerlukan kontrol akses.

### Klarifikasi dan hasil keamanan — 10 September 2026
Pengguna menegaskan semua domain selain www harus membutuhkan akun staf. Gerbang server memakai UUID staf yang disetujui administrator; metadata role browser bukan dasar akses. Konfigurasi kosong menolak akses, sehingga daftar staf dan build Vercel harus disiapkan sebelum penerapan. Pengujian lokal selesai; deployment, rotasi akun dan verifikasi backend produksi belum selesai. Tidak ada perubahan DB produksi.
