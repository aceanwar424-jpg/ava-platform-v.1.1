# Bukti booking dan stok antarunit

## Implikasi IP & Kepatuhan
OWNED_BY: generic. Tidak ada data pasien/AVA nyata, integrasi vendor atau penerapan produksi. Master dan ledger sumber dipakai tanpa menggandakan kunci. Pemetaan ownership source legacy merupakan metadata operasional yang harus disahkan; tidak mengubah nilai identitas master. Dummy hanya DB in-memory yang ditutup pada success/failure.

## Implementasi lokal
0077 + Booking Sumber Daya: konfigurasi kapasitas sumber, multi-resource atomik, peak overlap, buffer, expiry, order/encounter source, version/idempotency, penggunaan melampaui slot, completion dan paginasi.

0078 + Stok Antarunit RS: lot opening maker-checker, pemetaan ownership legacy, saldo sumber tersinkron, transfer/karantina/release, issue/retur/afkir, order kualitas, trace ledger dan approved reconciliation. RS unit menu mempunyai tautan menuju booking, stok dan formulir klinis.

## Batas penerimaan
Belum menutup seluruh menu parsial. Billing kamar/penjamin/deposit, adaptasi pharmacy source, komponen darah/crossmatch, encounter/unit episode, ibu-bayi, MAR/flowsheet khusus, privilege/STR-SIP, indikator historis, simulator/integrasi dan readiness masih perlu implementasi/validasi. Mengunci transaksi yang belum mempunyai sumber valid tidak dihitung sebagai penyelesaian fitur tersebut. Perubahan Apps pekerjaan lain tidak termasuk.

Bukti berada di docs/audit-evidence/2026-10-09. Kontrak source inventory fixture minimal; server PostgreSQL multi-koneksi dan skema legacy penuh belum divalidasi. Lihat runbook/preflight 0077_resource_stock.
