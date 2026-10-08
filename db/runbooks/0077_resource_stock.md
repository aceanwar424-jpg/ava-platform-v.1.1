# Booking sumber daya dan stok antarunit — 0077–0078

OWNED_BY: generic. Persetujuan sesi mencakup skema repo dan uji lokal. Tidak ada penerapan produksi dalam pekerjaan ini.

## Prasyarat dan urutan
1. Baseline tenant/auth/RBAC, rawat inap, master HIS 0050 dan 0070–0076 harus tersedia.
2. Untuk 0078, master persediaan, batch, gudang, saldo lokasi dan stock_ledger existing harus tersedia. Cocokkan kolom, tipe, unique item/lokasi, RLS dan owner fungsi melalui preflight 0077_resource_stock.sql. Fixture pengujian memakai kontrak sumber minimal, bukan seluruh migrasi persediaan lama.
3. Terapkan 0077 lalu 0078 hanya pada database lokal yang disetujui. Pisahkan pengesahan/penerapan produksi.
4. Jangan memetakan semua data lama ke satu tenant. Review daftar ID item/gudang dengan pemilik data. Draft `stock_ownership` melalui Stok Antarunit → Rancang pemetaan sumber lama; review/approve/activate oleh orang berbeda pada Kebijakan Operasional; Terapkan ownership. Mapping merujuk ID lama dan tidak menulis nilai/kunci master. Ownership yang berbeda ditolak; perubahan ownership native memblokir operasi.
5. Konfigurasikan authority per unit. Booking memerlukan `resource.reserve/confirm/start/complete/cancel/expire`. Stok memerlukan `stock.initialize/reconcile/receive/issue/return/transfer/quarantine/release/waste/link_order`. Maker-checker release harus terpisah sesuai authority.
6. Konfigurasikan policy `resources` per unit menggunakan master ruang/perangkat/service_capacity aktif. Kapasitas ruang harus eksplisit; mesin fisik kapasitas satu. Buffer, timezone dan expiry eksplisit.
7. Opening tiap lot dibuat lewat Stok Antarunit. Scope policy otomatis `stock-lot:<batch_id>`. Domain, timezone dan posisi tersedia/karantina ditinjau terpisah. Total harus sama saldo batch dan tidak melampaui saldo master/lokasi. Opening tidak menambah stok fisik.

## Alur yang tersedia
- Booking service merujuk order RS aktif dan admission sumber; maintenance tidak membutuhkan pasien. Multi-resource diperiksa dan disimpan atomik. Optimistic version/idempotency melindungi retry dan perubahan usang. Booking expired tidak menahan kapasitas. Penggunaan aktif menahan slot tanpa batas sampai selesai; buffer pemulihan tetap menahan kapasitas setelah selesai.
- Penerimaan/pengeluaran/afkir menulis saldo batch, item, lokasi dan ledger sumber dalam transaksi. Transfer/state movement menulis dua delta posisi dan tidak menggandakan total fisik.
- Retur merujuk pengeluaran asal dan pasien/order yang sama; kumulatif retur tidak dapat melampaui issue. Retur domain klinis wajib karantina.
- Karantina tidak dapat dipakai. Release domain CSSD/darah memerlukan order kualitas terkait lot yang selesai dan role profesi. Blood issue ke pasien diblokir: sumber komponen individual/crossmatch belum tersedia. Pharmacy diblokir karena memakai sumber pharmacy_drugs/pharmacy_stock_ledger tersendiri.
- Jika penulis persediaan lama mengubah saldo sumber, command berhenti. Buat opening versi baru yang disahkan dan terapkan reconcile. Posisi merupakan cache; ledger before/after tetap tersimpan. Saldo legacy yang korup harus diperbaiki melalui proses sumber terlebih dahulu.

## Batas bukti dan rollback
PGlite menjalankan SQL PostgreSQL dalam satu sesi; pengujian ini belum membuktikan konkurensi dua koneksi server PostgreSQL. Accounting, adapter farmasi/darah, billing kamar dan mesin klinis unit bukan acceptance modul ini. Renderer/menu tetap parsial.

Jangan menghapus ledger/event produksi. Pensiunkan policy, hentikan command, koreksi dengan versi/rekonsiliasi baru. Rollback schema memerlukan backup dan kajian referensi. Tidak ada down migration destruktif.

## Uji dan cleanup
Jalankan berurutan dengan Node heap 4096 MB: test_resource_booking.cjs, test_shared_inventory.cjs, qa-resource-booking.cjs, qa-shared-stock.cjs, test_policy_sprint.cjs, qa-policy-sprint.cjs, test_hospital_operations.cjs, qa-hospital-operations.cjs. Semua data bersifat sintetis pada DB in-memory; teardown dalam finally, tanpa seed tenant nyata. Screenshot/JSON adalah bukti sintetis, bukan record pasien yang disimpan.
