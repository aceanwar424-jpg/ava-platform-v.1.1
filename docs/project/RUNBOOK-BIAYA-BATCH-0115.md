# Biaya batch aktual — 0115

OWNED_BY: generic. Keputusan pemilik 6B (biaya batch yang dipakai) dan 7A (reversal independen), persetujuan skema/uji lokal. Tidak ada data pasien nyata atau harga privat.

## Setup dan alur

1. Pada lingkungan lokal yang sudah memiliki sumber farmasi dan jurnal, terapkan migrasi sampai 0115. Produksi memerlukan persetujuan terpisah. Atur akses menu cfg-medicine dan peran finance/finance_staff; akses ini tidak memberi kewenangan tindakan klinis.
2. Buka Konfigurasi Obat → Biaya Batch & Jurnal. Finance memilih cost center dan akun aktif untuk penerimaan, dispensing, retur, koreksi tambah/kurang; isi timezone, IDR, presisi nominal dan bukti kebijakan. Sistem membuat mapping baru dengan namespace tenant, tanpa menimpa mapping lama. Reviewer berbeda menyetujui snapshot. Akun retur wajib membalik akun dispensing.
3. Receipt aktual membuat proposal biaya dari harga perolehan yang diketik. Batch opening perlu deklarasi biaya dan bukti kepemilikan/perolehan. Reviewer finance berbeda menyetujui. Nilai master lama nol tidak menjadi biaya nol otomatis; biaya nol yang memang sah harus dinyatakan dan direview.
4. Resep dokter → verifikasi apoteker → dispensing FEFO tetap memakai sumber klinis aktual. Movement biaya menyimpan setiap item dan batch yang dipakai, tanpa mengurangi stok atau menambah tagihan lagi. MAR, waste dan serah pulang tidak membuat pengeluaran gudang kedua.
5. Finance memilih movement, setup dan tanggal jurnal untuk membuat draft. Reviewer berbeda memeriksa bukti dan mengesahkan. Biaya adalah quantity batch × harga perolehan yang direview, dibulatkan di server. Unknown cost tetap pending; tidak menghalangi dispensing hanya karena biaya belum lengkap. Nol sah mempunyai hasil posted dengan journal_id kosong, bukan jurnal nominal rekaan.
6. Retur fisik harus disahkan pada sumber custody. Valuasi retur memakai biaya dispensing asli, meski basis batch sekarang berbeda. Total quantity dan kredit pembulatan tidak boleh melampaui transaksi asal; retur terakhir menerima sisa pembulatan. Draft dengan snapshot/alokasi berubah ditolak dan dibuat ulang setelah review.
7. Koreksi jurnal memerlukan request reversal beralasan dan reviewer berbeda. Reverse retur aktif terlebih dahulu sebelum biaya dispensing asal. Jurnal asal, movement, stok, invoice dan audit tetap dipertahankan. Periode tertutup menolak posting/reversal secara atomik, termasuk penutupan bersamaan.
8. Histori sumber menampilkan actor, versi, alasan dan bukti review. Daftar dan picker mempunyai pagination; bukti yang diketik tetap ada saat mengganti halaman. Respons actor/tenant lama tidak boleh menimpa halaman baru.
9. Dispensing sebelum cutover tidak diambil otomatis. Pilih hanya ledger existing yang sudah memiliki scope tenant dan item batch yang sah, sertakan bukti rekonsiliasi, lalu deklarasikan. Tidak merekonstruksi ownership global yang tidak diketahui dan tidak mengubah histori fisik.

## Batas penerimaan

Paket ini menutup gap valuasi batch/COGS lokal; keseluruhan menu cfg-medicine dan rs-ward-pharmacy masih memerlukan acceptance master/formulary lifecycle, ownership alergi legacy dan integrasi unit lainnya. Perubahan basis/akun tidak menghitung ulang jurnal atau invoice final. Setup akuntansi dan rekonsiliasi opening memerlukan review manusia; tidak membuat saldo opening otomatis. Currency hanya IDR sesuai sumber jurnal platform saat ini. Tidak ada FX, transfer bank, koneksi vendor atau penerapan produksi.

## Verifikasi lokal

Runner scripts/uji/test_stock_cost_sources.cjs memakai sumber SQL aktual, test_stock_cost_races.cjs memakai backend PostgreSQL berbeda, dan test_stock_cost_browser.cjs memakai index/boot/router/RBAC serta RPC terautentikasi aktual dengan data sintetis. RS_TEST_RUNTIME menunjuk runtime disposable; runner menutup browser/database dan menghapus cluster miliknya pada finally. Regresi MAR dan pulang dapat mengaktifkan RS_TEST_MIGRATION_0107/0108/0111/0113/0115=1 dan RS_TEST_NO_ARTIFACTS=1. Jangan aktifkan flag0115 pada cost fixture karena fixture itu menerapkannya sendiri.
