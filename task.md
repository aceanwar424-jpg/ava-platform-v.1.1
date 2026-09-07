# Checklist — Penyempurnaan HIS

- [x] Inventaris HIS selesai.
- [x] Temuan UI/routing HIS direproduksi.
- [x] Perbaikan terapkan tanpa menyentuh skema data.
- [x] Audit menu tidak menemukan renderer, tabel/view, RPC, handler, atau manifest yang hilang untuk ruang HIS.
- [x] Suite uji HIS lulus.
- [x] Bukti dicatat di `walkthrough.md`.
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
- [x] Menu HIS dirapikan dalam hierarki domain kerja → layanan → modul tanpa menghapus akses menu mana pun.
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
- [x] Dokumentasikan bukti pengujian pada `walkthrough.md`.
- [x] Audit final 47 view panels & Arsitektur 5 Pilar Navigasi 7 Modul Wellness dengan Wearable Device Sync (100% Pass).

- [x] Audit referensi Admission read-only hingga variasi registrasi, Back Office, Queue, dan Queue Outpatient.
- [x] Dokumentasikan batas proses rawat jalan, layanan, medical kit, paket, langganan, dan pemakaian langganan.
- [x] Ubah rail menu bertingkat menjadi panel konteks domain → sub-menu → modul.
- [x] Pertahankan RBAC, action/route, breadcrumb, pencarian seluruh modul, Escape, dan responsivitas.
- [ ] Menunggu checkpoint skema/UAT sebelum enam variasi registrasi menjadi transaksi produksi terpisah.

## Workspace Admission — 5 September 2026

- [x] Daftar registrasi menggunakan header kerja ringkas dan area tabel utama.
- [x] Toolbar menggabungkan pencarian, filter periode/jenis/status, laporan, dan registrasi.
- [x] Form tambah/ubah Admission dibuka sebagai halaman kerja, bukan modal.
- [x] Popup hanya dipakai untuk pemilih data dan konfirmasi kecil.
- [x] Sintaks, menu, keamanan, dan preview lokal diverifikasi tanpa transaksi data.

## Ergonomi Form Admission — 5 September 2026

- [x] Mini rail tahapan ditempatkan di kiri form desktop.
- [x] Field, kolom, dan ruang antarbaris diproporsikan ulang untuk kerja cepat.
- [x] Mobile memakai tab horizontal yang tetap mudah disentuh.
- [x] Alur form dan pemeriksaan regresi diverifikasi tanpa menyimpan data.

## Konsolidasi Navigasi HIS & Shell Operasional — 5 September 2026

- [x] Audit read-only kelompok menu referensi.
- [x] Admission memuat Admission, Back Office, Queue, dan Queue Outpatient.
- [x] Shell navigasi/header operasional diterapkan konsisten pada HIS.
- [x] Label tahap yang tidak diperlukan dihapus dan form responsif dipertahankan.
- [x] Menu, renderer, keamanan, dan preview lintas kelompok diverifikasi.

## Penyelesaian End-to-End Admission — 6 September 2026

- [x] Petakan kontrak dan field per jenis registrasi.
- [x] Bedakan konteks, validasi, dan ringkasan tiap alur Admission.
- [x] Rapikan daftar, form, pemilih layanan, pembayaran, kasir, laporan, dan handoff antrean.
- [x] Uji renderer serta transisi tanpa menyimpan transaksi.

## Audit dan viewer Pelayanan Klinis — 6 September 2026

- [x] Petakan workflow klinis versus viewer hasil LIS.
- [x] Tambahkan viewer Patologi Klinik, Mikrobiologi, dan Patologi Anatomi.
- [x] Rapikan menu Pelayanan Klinis dan penunjang.
- [x] Bangun ulang peta/manifest dan verifikasi tanpa transaksi klinis.

## Audit struktur operasional referensi HIS — 6 September 2026

- [x] Audit menu dan alur Keuangan, Rekam Medis, Paket, Remunerasi, SATUSEHAT, Workforce.
- [x] Petakan modul yang tersebar serta gap prioritas.
- [x] Rancang ulang menu dan implementasi aman setelah persetujuan pengguna.

## Implementasi struktur operasional HIS — 6 September 2026

- [x] Pisahkan navigasi operasional dan konfigurasi.
- [x] Lengkapi hub/rute yang memakai kontrak data yang sudah ada.
- [x] Implementasikan ringkasan baca-saja dan audit alur.
- [x] Tinjau checkpoint schema/integrasi untuk gap berisiko tinggi.
- [x] Verifikasi visual, menu, manifest, sintaks, dan keamanan.

## Web publik AVA Health — 2026-09-05
- [x] Audit sumber portal, pemetaan domain, dan perubahan pengguna.
- [ ] Rombak portal menjadi profil perusahaan dengan detail brand dan katalog publik.
- [ ] Satukan login ke apps.avahealth.sbs.
- [ ] Verifikasi struktur, navigasi, aset, dan routing; catat bukti.

## Web publik AVA Health — hasil 2026-09-05
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

### Selesai — pengayaan premium
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

### Selesai — konten komersial hasil discovery
- [x] AVA Tech dominan dan Queen sebagai brand usaha sendiri.
- [x] Tiga halaman solusi, model biaya, demo dan pilot.
- [x] Investor, kemitraan dan produk herbal sesuai status pengembangan.
- [x] Dokumen konten untuk peninjauan.
- [x] Validasi 19 halaman dan HTTP preview.
- [ ] Publikasi produksi (belum dilakukan).

## Multipage & identitas — 2026-09-06
- [x] Cari PDF termasuk hidden/ignored; pelajari dokumen induk Markdown yang ditemukan.
- [x] Beranda ringkas dan navigasi ke halaman masing-masing.
- [x] Profil korporat rinci, Health/Lab bisnis fisik, Care & Wellness inklusif.
- [x] Validasi 30 halaman, link/aset, regresi kalkulator dan HTTP 200.
- [ ] Dokumen PDF identitas: menunggu nama/lokasi dari pengguna.
- [ ] Publikasi produksi: belum dilakukan.

## Kisah AVA dan founder — 2026-09-06
- [x] Halaman Founder, Owner & CEO dengan ruang foto potret yang disengaja.
- [x] Halaman Cerita & Perjalanan dengan enam bab tematik, tanpa tahun rekaan.
- [x] Ringkasan serta tautan di Tentang AVA; struktur multipage tetap terjaga.
- [x] Validasi 32 halaman, link, ID/H1, rebuild deterministik, kalkulator dan HTTP.
- [ ] Foto founder: akan diberikan pengguna.

## Audit LIS — 2026-09-06
- [x] Audit menu sumber dan halaman masuk produksi.
- [ ] Rapikan kelompok, label, judul navigasi dan tema LIS.
- [ ] Verifikasi rute, generator, sintaks dan catat keterbatasan audit.
- [x] Rapikan kelompok, label, judul navigasi dan tema LIS.
- [x] Verifikasi 24 rute/metadata, generator dan sintaks; dokumentasikan batas audit produksi dan uji visual tertunda.

## Sinkronisasi layanan LIS–HIS
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
- [x] Reproduksi 11 kasus dengan fixture sintetis; regresi HIS–LIS tetap lulus.
- [x] Susun laporan bukti, menu/alur target dan backlog prioritas.
- [ ] Tindak lanjut terpisah: perbaikan P0/P1 dan pengujian staging berdasarkan laporan audit.
# Perbaikan dan rilis LIS — 2026-09-06

- [x] Dashboard/grafik, agregasi panel dan persistensi hasil.
- [x] Evaluator QC/autoverifikasi tertahan, identitas laporan dan helper legacy.
- [x] API transisi, connector dan pengujian regresi lokal.
- [x] Menu/layout, ZIP connector operasional, dan catatan kandidat rilis.
- [ ] Aktivasi staging/produksi: menunggu identitas proyek dan akses migrasi/deployment.
- [ ] Penerimaan klinis lanjutan: amended report, penjagaan QC server, delivery acknowledgment dan UAT alat nyata; lihat docs/LIS-RELEASE-1.1.0-RC1.md.

## Penyelarasan LIS dengan audit layanan referensi — 2026-09-07

- [x] Inventarisasi read-only layanan referensi, termasuk menu/submenu, tab, toolbar, tabel, dan tahapan kerja.
- [x] Dokumentasikan batas HIS klinis ↔ LIS ↔ viewer hasil lintas-sistem.
- [x] Rapikan workspace layanan penunjang menjadi halaman penuh tanpa mengubah payload atau skema.
- [x] Evaluasi dan rapikan pengelompokan menu LIS setelah temuan referensi lengkap.
- [x] Jalankan pemeriksaan sintaks, menu/manifest, dan uji UI tanpa data produksi.
