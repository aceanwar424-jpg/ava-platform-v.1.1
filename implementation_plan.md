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
7. [~] Perluas Configuration Hub untuk master fasilitas, tenaga kesehatan, antrean, korporat, dan integrasi; master pembayaran/MCU masih perlu layar data khusus.
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
