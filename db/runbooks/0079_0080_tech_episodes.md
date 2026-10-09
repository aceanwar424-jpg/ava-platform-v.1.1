# Lifecycle Tech dan episode unit — 0079–0080

OWNED_BY: generic. Izin sesi mencakup skema operasional dan tes lokal; tidak mencakup produksi atau koneksi vendor.

## Prasyarat

0079 memakai sumber 0065 `tech_support_tickets` dan `tech_changes`; 0080 memakai admission, rawat inap, master HIS 0050 dan 0070–0078. Jalankan preflight read-only pada DB lokal yang diizinkan, cocokkan tipe/RLS/owner fungsi. Jalankan 0079 lalu 0080 satu kali melalui migration runner. Jangan membuat tenant default atau mengubah identity/master lama.

## Penggunaan

- Tiket: buat → triage dengan pemilik tenant → mulai/tunggu → bukti penyelesaian → verifikasi tutup oleh orang berbeda. Reopen menyimpan histori. Penugasan hanya saat triage.
- Perubahan: draft dengan risiko/rollback → review → pengesahan terpisah → preflight → catat hasil dan versi. Rollback mempertahankan histori dan mencabut verifikasi instalasi yang merujuk rilis tersebut.
- Instalasi: laporkan modul/instalasi/environment/versi dari perubahan sukses, lalu verifikasi manual oleh orang berbeda dengan bukti. Ini pencatatan bukti, bukan deploy atau telemetry live.
- Episode: konfigurasi authority dan template yang disahkan; `episode.open` administratif, aksi `clinical.episode.*` sesuai profesi. Buka episode pending dengan cutover eksplisit saat ini, terima oleh orang berbeda, tautkan observasi sah, transfer menurut keputusan sah dan terima di tujuan. Admission tetap sama. Bed fisik tetap melalui sumber Rawat Inap; transfer episode tidak memindahkan bed.
- Tutup encounter setelah pemulangan sumber dan tugas aktif selesai/dibatalkan beralasan. Admission sumber yang sudah selesai tidak dapat dibuka kembali; kunjungan ulang memakai admission baru.
- Bayi mempunyai admission sendiri. Relasi ibu–bayi memerlukan catatan persalinan disahkan yang menyebut identitas bayi. Koreksi memerlukan amendment klinis sumber, menyimpan relasi lama berstatus amended dan relasi baru; tidak mengganti identitas pasien/master.

## Bukti dan cleanup

Jalankan serial dengan `node --max-old-space-size=4096`: `scripts/uji/test_tech_lifecycle.cjs`, `scripts/qa-tech-lifecycle.cjs`, `scripts/uji/test_care_episodes.cjs`, `scripts/qa-care-episodes.cjs`. Fixture PGlite kontrak minimal ditutup dalam finally. JSON/screenshot sintetis berada di docs/audit-evidence/2026-10-09.

Uji konkurensi native: siapkan npm prefix baru di temporary directory bernama `avaqueen-rs-pg-*`, install tepat `@embedded-postgres/windows-x64@17.10.0-beta.17` dan `pg@8.23.1` dengan `--ignore-scripts --no-audit --no-fund --save-exact`. Set `RS_TEST_RUNTIME` ke prefix lalu jalankan `scripts/uji/test_rs_concurrency.cjs`. Script memvalidasi target temporary, menjalankan PostgreSQL 17.10 pada loopback/random port, memakai dua backend PID berbeda, membuktikan contender menunggu lock, menutup semua sesi/server dan menghapus cluster dalam finally. Hapus prefix runtime setelah verifikasi cleanup; jangan menggunakan DB desktop existing. Paket wrapper berlabel beta; binary dan versi aktual dicatat di evidence.

## Batas dan pemulihan

Konkurensi hanya membuktikan skenario dalam evidence, bukan semua transaksi atau skema legacy penuh. MAR/flowsheet, privilege individu, billing dan integrasi unit khusus belum menjadi acceptance episode ini. Tidak menaikkan seluruh 44 status melalui keberadaan renderer/RPC. Jangan menghapus event/history; lakukan koreksi/amendment atau retirement policy. Perubahan frontend Tech lain di workspace dipertahankan.
