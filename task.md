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
- [ ] Tambahkan `<select id="role-switcher-select">` pada `.sidebar-user-card` di `index.html`.
- [ ] Buat fungsi `switchActiveRole(newRole)` di `app.js` untuk alih role real-time tanpa logout.
- [ ] Tambahkan toggle sub-role Korporat (Maker vs Approver) pada `corporate-view`.
- [ ] Perbarui `renderSidebarMenu()` dan styling di `style.css` agar dropdown role switcher responsif.
- [ ] Verifikasi sintaks dan uji alih role lintas 5 mode (Pasien, Member, Corporate, Nakes, Referral).
- [ ] Dokumentasikan bukti pengujian pada `walkthrough.md`.

- [x] Audit referensi Admission read-only hingga variasi registrasi, Back Office, Queue, dan Queue Outpatient.
- [x] Dokumentasikan batas proses rawat jalan, layanan, medical kit, paket, langganan, dan pemakaian langganan.
- [x] Ubah rail menu bertingkat menjadi panel konteks domain → sub-menu → modul.
- [x] Pertahankan RBAC, action/route, breadcrumb, pencarian seluruh modul, Escape, dan responsivitas.
- [ ] Menunggu checkpoint skema/UAT sebelum enam variasi registrasi menjadi transaksi produksi terpisah.

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
