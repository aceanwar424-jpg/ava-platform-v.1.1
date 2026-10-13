# Formulir dan metadata klinis 0111

OWNED_BY: generic. Paket lokal; tidak menerapkan migrasi ke produksi.

Formulir menampilkan semua template aktif yang diizinkan, dengan paging 50 baris. Catatan mempertahankan judul, label, policy ID dan versi asal. Nilai kosong berbeda dari 0 dan false. Pergantian tenant/petugas membuang cache, filter dan response lama; form lama tidak dapat mengirim.

Setup klinis menyediakan purpose, kode formulir, timezone, referensi/versi SOP dan parameter eksplisit untuk jadwal obat, custody, koreksi dan keputusan pulang. Tombol struktur field mengisi definisi field saja. Tidak mengisi nilai pasien atau menetapkan parameter medis. Tetap wajib submit, reviewer profesi berbeda, approve dan activate sesuai governance existing.

Amendment wajib sesuai scope/purpose dan kode formulir jika kedua versi memilikinya. Kompatibilitas template legacy tanpa kode dipertahankan. Catatan asli tetap immutable. Satu parent hanya dapat memiliki satu amendment signed; catatan berikutnya memakai head signed terbaru.

Pemberian obat mengunci record instruksi sumber, lalu memeriksa amendment signed kembali. Bila instruksi diganti, pemberian dari plan lama ditolak. Dokter menghentikan plan lama dan membuat instruksi/jadwal baru; apoteker melakukan verifikasi baru. Signing amendment mengunci parent sehingga transaksi pemberian dan perubahan instruksi tidak melewati pemeriksaan sumber secara bersamaan. Tidak ada perubahan dosis otomatis atau pengurangan stok gudang kedua.

Validasi akhir: 7 source SQL, 6 authenticated real-app browser, 8 regresi MAR/custody dan 3 integrasi discharge/kapasitas PASS. Dua urutan race memakai backend PostgreSQL berbeda dan membuktikan penantian Lock. Cluster sintetis ditutup/dihapus, tidak menyimpan file hasil baru. Cache/log runtime lama di luar repo tetap ada setelah automatic approval review menolak penghapusannya.

Runner: `test_clinical_form_sources.cjs`, `test_clinical_form_browser.cjs`; regresi `test_medication_administration_source.cjs` dan `test_capacity_signed_discharge.cjs` dengan RS_TEST_MIGRATION_0107=1, RS_TEST_MIGRATION_0108=1, RS_TEST_MIGRATION_0111=1. MAR memakai RS_TEST_NO_ARTIFACTS=1. RS_TEST_RUNTIME menunjuk runtime disposable lokal.

Batas acceptance: bukan penyelesaian flowsheet/handover/semua formulir spesifik unit atau seluruh jalur legacy. Setup policy masih menampilkan 100 versi terakhir tanpa filter/paging penuh. Matriks 44 tetap 2 tuntas lokal dan 42 parsial. Tidak ada sertifikasi klinis, koneksi vendor atau aktivasi produksi.

## Implikasi IP & Kepatuhan

Kunci katalog dan policy IDs/revision tidak diubah. Data uji sintetis, clinical authority/individual privilege/reviewer tetap diberlakukan. Metadata SOP manusia tidak disahkan otomatis. Sumber signed dan riwayat pemberian tetap utuh.
