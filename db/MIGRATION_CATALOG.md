# Katalog migrasi database

## Jalur resmi

Migrasi yang boleh diterapkan untuk instalasi baru dan rilis bertahap berada di `db/migrations/` dan dijalankan berurutan berdasarkan nomor. Jalur saat ini mencakup `0048_antrean_tenant_device_public.sql`, `0049_homecare_bridging_his_lis.sql`, lalu `0050_his_master_registry.sql`.

`0050_his_master_registry.sql` wajib didahului preflight dan runbook yang ada di `db/preflight/0050_his_master_registry_preflight.sql` serta `db/runbooks/0050_his_master_registry.md`. Migrasi ini belum merupakan perintah untuk mengaktifkan SATUSEHAT/Telemedicine atau melakukan deploy produksi.

## SQL arsip

`ava-platform/sql_arsip/` adalah sumber historis untuk modul yang belum dikonsolidasikan ke jalur resmi. Berkas itu **bukan** instruksi untuk menjalankan SQL secara acak di produksi.

Sebelum suatu modul bergantung pada SQL arsip pada staging/produksi:

1. Catat dependensi melalui `node scripts/audit-legacy-migrations.js`.
2. Buat migrasi formal baru yang idempoten di `db/migrations/`.
3. Tambahkan preflight dan runbook rollback.
4. Uji database kosong serta upgrade dari instalasi lama.
5. Hanya setelah itu ubah pesan UI dari nama SQL arsip ke nomor migrasi resmi.

## Larangan

- Jangan menjalankan beberapa berkas `supabase_fase*.sql` tanpa urutan dan backup.
- Jangan menjalankan SQL arsip langsung pada produksi untuk memperbaiki layar kosong.
- Jangan menganggap audit statis sebagai bukti migrasi telah diterapkan ke cloud.
