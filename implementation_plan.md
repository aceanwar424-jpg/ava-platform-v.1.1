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

1. [ ] Padatkan halaman daftar registrasi: hilangkan breadcrumb/topbar khusus
   halaman, kartu KPI besar, serta header ganda; satukan tanggal, notifikasi,
   dan identitas pengguna pada satu header kerja.
2. [ ] Letakkan pencarian, tanggal, jenis, laporan, tindakan registrasi, dan
   filter status dalam toolbar ringkas di atas tabel yang mengisi sisa layar.
3. [ ] Pindahkan formulir registrasi/edit dari modal lebar ke workspace penuh
   yang tetap memakai state, validasi, serta proses simpan yang ada.
4. [ ] Pertahankan modal hanya untuk pencarian/pemilihan data pendukung dan
   konfirmasi singkat; jangan mengubah kontrak API atau skema transaksi.
5. [ ] Verifikasi sintaks, peta menu, audit menu/keamanan, dan preview lokal
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

## Perombakan web publik AVA Health — 2026-09-05
Rencana: (1) audit portal dan routing (≤1 jam), (2) bangun profil publik responsif, detail brand, katalog, sejarah, sertifikasi, kontak (≤1 jam), (3) validasi tautan/aset/routing dan preview (≤1 jam).
Arah visual: editorial kesehatan, putih dan navy, aksen emerald, tipografi besar, enam brand sebagai portofolio bisnis. Pertahankan stack statis dan deployment Vercel yang ada.
### Implikasi IP & Kepatuhan
OWNED_BY: ava untuk konten situs perusahaan yang sudah tersedia; tidak dipindahkan menjadi produk generik. Tidak mengubah master katalog, DB, provider LLM, atau aplikasi operasional. Hapus autentikasi dari halaman publik; hanya tautkan apps.avahealth.sbs. Tidak menerbitkan klaim sertifikasi, manfaat klinis, tanggal sejarah, atau produk tersedia tanpa bukti. Kontak bersumber portal lama. Metadata sumber dan kebutuhan verifikasi dicatat dalam audit. Publikasi produksi terpisah dari penyuntingan lokal.

## Pengayaan profil publik premium — 2026-09-05
Rencana: 1) teliti sumber kesehatan primer dan rumus kalkulator (≤1 jam); 2) perluas enam profil brand, visi/misi, model bisnis, alur manufaktur sebagai skenario operasional (≤1 jam); 3) bangun jurnal kesehatan bersumber dan kalkulator lokal BMI/kalori serta penyempurnaan premium (≤1 jam); 4) verifikasi kalkulasi, konten, tautan, ekspor dan preview (≤1 jam).
### Implikasi IP & Kepatuhan
OWNED_BY: ava. Pengguna mengotorisasi rancangan dengan asumsi semua lini sudah berjalan. Asumsi manufaktur/farmasi diberi penanda konsep, tidak menjadi klaim izin atau operasi faktual. Tidak menambah klaim CPOB/izin edar terverifikasi. Artikel orisinal berbasis sumber primer yang diperiksa tanggal 2026-09-05; tidak mengaku telah ditinjau dokter. Kalkulator khusus dewasa, bukan diagnosis atau resep diet; input hanya di memori browser. Tidak mengubah master data, vendor atau sistem produksi.
