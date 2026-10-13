# Kapasitas historis dan statistik rawat inap 0110

OWNED_BY: generic. Cutover dan observasi sumber, tanpa rekonstruksi bed sebelum cutover.

## Setup dan penggunaan

1. Pastikan ownership bed/stay tenant sudah dipetakan. Opening menolak flag bed/timestamp/ownership stay yang tidak lengkap. Ini bukan alat migrasi ownership produksi.
2. Di Kapasitas RS, buat definisi: timezone laporan dan timezone timestamp legacy, waktu sensus, denominator bed aktif/aktif selain perbaikan, metode hari perawatan calendar_inclusive/census, aturan pasien masuk–keluar sehari (0/1 untuk hari perawatan dan lama rawat), sumber/versi serta evidence SOP tenant.
3. Ajukan → reviewer statistik berbeda menyetujui → aktifkan. Cutover adalah waktu nyata, bukan tanggal buatan. Aktivasi gagal cepat bila sumber sedang ditulis; retry setelah penulisan selesai tidak membuat opening parsial.
4. Opening mengambil semua bed milik tenant dan stay aktif. Perubahan sumber selanjutnya menghasilkan ledger append-only. Timestamp masuk/keluar yang diketahui disimpan sebagai epoch ber-offset; perubahan konfigurasi/timezone tidak menafsir ulang epoch lama. Timestamp legacy pada opening memakai timezone yang direview; penulisan sumber baru mencatat timezone sesi penulis.
5. Pilih versi dan tanggal laporan. Hanya hari penuh setelah tanggal cutover dan sudah selesai, maksimal 366 hari; versi arsip tidak melampaui akhir coverage. Versi baru mengarsipkan coverage sebelumnya dan mengambil opening sumber baru.

## Perhitungan dan bukti

Rumus agregat mengacu [Juknis Profil Kesehatan Kemenkes, edisi 2022, pengantar Desember 2023, Tabel 8 halaman PDF 48–50](https://www.kemkes.go.id/app_asset/file_content_download/172247989066aaf512936579.51341712.pdf), diakses 2026-10-13. Ini basis formula yang diketahui, bukan klaim edisi terbaru atau pengesahan pelaporan nasional. Definisi hari/sensus dan denominator disahkan tenant.

- Bed-hari: jumlah bed sesuai definisi pada titik sensus setiap hari. Rata-rata bed = bed-hari / hari periode.
- BOR = hari perawatan / bed-hari × 100.
- ALOS = total lama dirawat pasien keluar / pasien keluar hidup+mati. Lama rawat memakai selisih tanggal lokal; aturan masuk–keluar sehari eksplisit.
- TOI = (bed-hari − hari perawatan) / pasien keluar.
- BTO = pasien keluar / rata-rata bed dalam periode; tidak otomatis dianggap angka tahunan.

Calendar inclusive menghitung pasien aktif dan pasien keluar pada tanggal terkait; census memakai pasien pada titik sensus. Aturan tambahan pasien masuk–keluar sehari tidak menggandakan pasien yang sudah dihitung pada census. Perubahan jumlah bed dihitung dari ledger bertanggal, bukan jumlah bed sekarang. Denominator/pasien keluar nol menghasilkan null (“Tidak tersedia”), bukan angka tebakan.

Report menyimpan setup_version, source_watermark serta input/output pada audit append-only. Seluruh pembacaan memakai batas ledger yang sama. Nama/MR pasien tidak disalin ke snapshot statistik. UI menampilkan denominator harian dan metadata sumber. Tidak ada pengiriman SIRS.

Timestamp/bed-stay yang tidak konsisten atau keluar backdate yang belum direkonsiliasi membuat laporan ditolak. Source klinis perlu dikoreksi/ditinjau melalui jalur yang sah; modul statistik tidak mengedit keputusan medis atau menghasilkan histori bed yang tidak diketahui. Pembukaan versi baru tidak “memperbaiki” histori lama dengan angka palsu.

## Bukti lokal

```
node --max-old-space-size=512 --v8-pool-size=1 scripts/uji/test_capacity_source.cjs
node --max-old-space-size=512 --v8-pool-size=1 scripts/uji/test_capacity_browser.cjs
```

Dengan RS_TEST_MIGRATION_0107=1 dan RS_TEST_MIGRATION_0108=1:

```
node --max-old-space-size=512 --v8-pool-size=1 scripts/uji/test_capacity_signed_discharge.cjs
```

RS_TEST_RUNTIME harus menunjuk PostgreSQL disposable yang disetujui. Jalankan serial. 10 source/calculation scenarios, 6 real app authenticated browser scenarios dan 3 integrasi pemulangan profesional = 19 PASS. Histori beberapa hari adalah fixture kalkulasi sintetis yang dinyatakan, bukan bukti sumber telah direkam selama beberapa hari nyata. Capture asli dibuktikan terpisah lewat source admission/transfer, contention opening, rotasi timezone/version serta licensed signed discharge/pharmacy/housekeeping. Browser membuktikan boot/router, setup/review/opening, report, refusal/clearing, context dan mobile. Cluster/dummy/browser dibersihkan tanpa output file baru.

## Implikasi IP & Kepatuhan

Persetujuan skema operasional/uji lokal terdahulu dipakai. Tidak mengubah join master, menyambung produksi atau mengimpor histori pasien. Review klinis sumber dan definisi statistik tenant nyata tetap dilakukan pihak berwenang. Snapshot/audit asli immutable; metode dan provenance eksplisit.
