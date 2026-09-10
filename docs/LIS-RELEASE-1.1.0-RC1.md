# AVA LIS 1.1.0 RC1 — 7 September 2026

OWNED_BY: ava. Status: kandidat rilis teruji lokal; aktivasi produksi belum dilakukan.

Pembaruan 8 September: commit `705dde4` telah ditemukan pada cabang remote `codex/lis-integrity-1.1.0-rc1`, yang kini berada di `06d0ffe`. Tidak dilakukan push ulang atau reset cabang. Domain LIS merespons HTTP 200 melalui Vercel; aset validasi publik memakai RPC transaksional, tetapi index belum memuat penanda cache RC1. Ini belum membuktikan backend 0052 aktif. Bukti: `docs/audit-evidence/lis-deployment-check-2026-09-08.json`. Pemeriksaan instalasi backend tanpa membaca data pasien disediakan di `db/checks/lis_release_preflight.sql`.

## Perubahan yang diimplementasikan

- Dashboard TAT memakai data respons server; nol tetap nol, periode kosong tanpa angka rekaan, error terpisah, pilihan tanggal bertahan.
- Grafik analyzer acak dan branding workstation vendor di layar hasil dihapus. Grafik asli perlu payload instrumen, bukan pengganti simulasi.
- Status panel mempertimbangkan semua analit aktif. Hubungan tabung dengan hasil memakai sample ID; nama gabungan tabung tidak membuat tes semu.
- Verifikasi dan rilis menggunakan RPC transaksi per kunjungan. Server memeriksa tenant, peran klinis, versi hasil, kelengkapan, status, pelaporan kritis dan panel yang belum selesai. Event snapshot tersimpan bersama transaksi; UI tidak menerbitkan event rilis palsu.
- Hasil final dikunci terhadap penyuntingan/penghapusan langsung. Hasil Validated yang disunting harus kembali Draft. Pengguna administrasi tidak otomatis mendapat hak rilis dokter.
- Log nilai kritis dan acknowledgment ditulis dalam satu transaksi. Read-back tidak tercentang otomatis; pelaporan berhasil mensyaratkannya. Logbook mengarah ke alur yang sama.
- Riwayat menggunakan patient ID atau nomor MR dalam tenant melalui kunjungan; tanpa identitas stabil tidak menebak dari nama. Hanya hasil final, 30 terbaru, analit yang sama.
- QR pihak ketiga yang membawa nomor kunjungan dihapus. Identitas otorisator berasal dari hasil; preview/draft diberi label. Pengaturan lokal tidak menjadi bukti PKI.
- Evaluator QC UI dan connector disatukan; input tak valid tidak lulus, prioritas penolakan tidak tertutup warning, R-4s memerlukan konteks run. Seri UI dipisahkan menurut lot/level/target/SD. Autoverifikasi lama diblokir sampai kebijakan server tervalidasi.
- Loader sampel/hasil mengambil halaman bertahap dan menampilkan kegagalan. Nilai kritis tidak disimpulkan dari warna merah saja; demografi yang kosong tidak dianggap cocok untuk seluruh rentang.
- Menu menjadi Verifikasi Teknis, Otorisasi & Rilis, Lot Kontrol, Kinerja & TAT. Layout review menyesuaikan lebar layar; beberapa keluaran teks pasien/hasil di-escape.
- Entry walk-in lama diarahkan ke kontrak admisi HIS–LIS. Harga dan pembayaran tetap menjadi tanggung jawab HIS.
- Connector memakai inbox disk, jurnal frame ASTM, validasi checksum/nomor frame, deduplikasi pesan yang masih antre, pemulihan antrean saat restart dan karantina setelah delapan kegagalan. Tombol unduh menyediakan ZIP connector operasional, menggantikan generator daemon contoh.

## Bukti verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `node scripts/verify-lis-integrity.cjs` | Lulus: TAT/panel/QC/riwayat/helper, migrasi berulang, transaksi atomik, peran, tenant, versi, hasil kritis/final; pembacaan RLS sebagai authenticated menolak tenant lain |
| `node scripts/verify-lis-his-sync.cjs` | Lulus lokal untuk kontrak 0051 dan frontend admisi; bukan uji produksi |
| `node scripts/verify-lis-connector.cjs` | Lulus: persist/restart, duplikat pending, karantina, checksum salah, frame terpotong/duplikat dan jurnal alat |
| `node scripts/verify-deploy-readiness.js` | Lulus pemeriksaan statis route/runtime config; tidak membuktikan deployment online |
| Browser fixture dengan modul aktual | Nol/empty/error/data sintetis tampil sesuai skenario; pilihan 7 hari tetap terpilih |
| Layout browser | Desktop 1275px dan iframe 733px: scrollWidth sama dengan clientWidth; tidak ada overflow horizontal pada fixture |

Fixture tidak terhubung database. Bukti awal cacat pada laporan audit tetap merupakan catatan sebelum perbaikan; `audit-lis-deep.cjs` adalah baseline historis dan bukan release gate versi ini.

## Urutan aktivasi

1. Tentukan proyek Supabase/Vercel dan akun deployment yang benar. Repo remote sudah teridentifikasi, tetapi lingkungan kerja belum menyediakan kredensial migrasi atau project link Vercel.
2. Backup sesuai prosedur fasilitas, kemudian uji migrasi `0051_lis_his_service_sync.sql` dan `0052_lis_result_integrity.sql` pada salinan staging tanpa data pasien nyata dalam fixture. 0052 mengandalkan kolom LIS dasar/rilis/nilai kritis dari migrasi sebelumnya.
3. Verifikasi pemetaan tenant kunjungan lama dan peran akun. RLS tidak menebak tenant untuk baris historis yang belum dipetakan. Periksa permissive policies/grants lama: restrictive policy baru membatasi tenant, bukan memberikan seluruh hak tulis baru.
4. Jalankan alur staging lengkap HIS→order→sampel→hasil→verifikasi→otorisasi→HIS, termasuk gagal jaringan, nilai kritis, pembatalan layanan, dua tenant dan hak dokter. Uji koneksi alat nyata secara terpisah.
5. Terapkan backend lebih dahulu dan frontend dari versi yang sama dalam jendela pemeliharaan. UI baru memerlukan RPC 0052; jangan memublikasikan frontend sendirian sebagai rilis siap pakai.
6. Bangun ZIP dengan `node scripts/build-lis-connector.cjs`. Distribusikan folder paket utuh. Kunci akses diisi pada workstation tujuan, tidak ada di arsip.
7. Smoke test domain LIS/HIS dengan akun uji. Catat deployment ID, commit, migration version dan hasil uji sebelum menutup rilis.

Rollback harus mengembalikan versi frontend/backend yang kompatibel. Jangan mencabut penguncian hasil final atau menghapus audit event hanya untuk membuat versi lama kembali berjalan. Jika backend belum bisa diaktifkan, pertahankan kandidat rilis dan selesaikan aktivasi di staging dahulu.

## Saran akhir menyeluruh dan pekerjaan berikutnya

**Wajib sebelum operasional diperluas:**

1. **Koreksi hasil final berversi.** Rilis ini mengunci hasil final; alur amended report yang membuat versi pengganti, alasan, persetujuan dan pemberitahuan ulang masih perlu dibangun. Jangan membuka kembali edit langsung sebagai jalan pintas.
2. **QC sebagai penjagaan server.** Evaluator telah disatukan, tetapi kaitan alat–analit–run QC–hasil pasien dan kebijakan pelepasan perlu disahkan serta diuji. Autoverifikasi tetap ditahan. Jumlah aturan bukan bukti validasi klinis.
3. **Distribusi hasil yang terlacak.** Event transaksi kini persisten, tetapi worker delivery, acknowledgment HIS/portal, retry dan token akses laporan berversi belum lengkap. Jangan menganggap adanya event berarti penerima sudah menerima hasil. Tinjau pula jalur WhatsApp lama sebelum pengiriman hasil nyata.
4. **Pemulihan connector dan idempotensi server.** Pengiriman masih at least once. Pesan `.dead` dan sesi `.partial` perlu prosedur rekonsiliasi; uji saat server menyimpan tetapi respons hilang. Validasi instrument-specific ASTM/HL7 tetap diperlukan.
5. **UAT peran dan tenant lintas modul.** Cakup arsip, ekspor, QC, rujukan, laporan, master dan akses langsung endpoint. Perbaikan escaping terarah bukan pengganti audit keamanan menyeluruh. Validasi pemetaan tenant historis tanpa menebak identitas.
6. **Operasional rilis:** backup/restore yang pernah diuji, pemantauan error/sinkronisasi, SOP downtime dan penanggung jawab setiap antrean gagal.

**Setelah satu pilot terbukti:** pusat antrean yang dapat ditindaklanjuti; pelacakan rujukan dan lampiran hasil eksternal; pemakaian reagen aktual/FEFO; label/pencetakan yang diuji dengan printer fasilitas; TAT per area dan prioritas; akses bantuan sesuai peran.

**Tunda sampai ada kebutuhan nyata:** modul khusus mikrobiologi, patologi anatomi, bank darah, analitik lanjutan atau aturan autoverifikasi tambahan. Jangan memperbanyak menu kosong atau menggunakan klaim sertifikasi untuk menggantikan bukti proses.

## Batas rilis ini

Kode dan pengujian lokal tersedia. Belum ada deployment ID produksi, migrasi produksi, penerimaan alat nyata, atau persetujuan SOP QC yang diverifikasi dalam task ini. Karena itu label yang tepat adalah **release candidate**, belum rilis klinis produksi siap operasional penuh.
