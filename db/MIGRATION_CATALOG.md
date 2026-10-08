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

## Parity lokal → Supabase

DB lokal PGlite adalah sumber kebenaran untuk sinkronisasi data aplikasi desktop.
Gunakan pemeriksaan read-only terlebih dahulu:

```text
node scripts/db-parity-local-authoritative.cjs --deep
```

Laporan hanya berisi metadata tabel, jumlah baris, dan digest; tidak menulis data
cloud. Untuk menerapkan upsert lokal ke Supabase, operator harus memasok
`SUPABASE_SERVICE_ROLE_KEY` melalui environment dan menegaskan sumber kebenaran:

```text
node scripts/db-parity-local-authoritative.cjs --deep --apply --confirm-local-authoritative
```

Perintah apply tidak menghapus baris cloud yang tidak ada di lokal. Penghapusan
cloud memerlukan prosedur terpisah, backup, daftar tabel, dan persetujuan pemilik
database. Tabel tanpa primary key dilewati karena tidak aman untuk di-upsert.

## Operasional RS — 0070–0073 (6 Oktober 2026)

- `0070_hospital_operations.sql`: workflow operasional bertahap, penugasan dan bukti.
- `0071_hospital_bed_flow.sql`: reservasi, proteksi episode dan housekeeping.
- `0072_hospital_staff_roles.sql`: perluasan provisioning role RS.
- `0073_hospital_operations_hardening.sql`: penyelesaian forward-only untuk 0070–0072 yang terlanjur dipush proses workspace lain saat implementasi; role tahap tanpa substitusi profesi oleh administrator, RLS baca per layanan, direktori staf minimal, audit reservasi, kapasitas aktual, proteksi housekeeping dan RPC master bed. Tidak mengubah checksum 0070–0072.

Prasyarat: baseline rawat inap existing dan migrasi tenant/auth/RBAC. Preflight: `db/preflight/0070_hospital_operations_preflight.sql`. Runbook: `db/runbooks/0070_hospital_operations.md`. Pemetaan tenant bed lama wajib ditinjau; jangan backfill seluruh bed ke satu tenant. Persetujuan chat hanya skema repo/uji lokal. Tidak ada instruksi apply produksi pada pekerjaan ini.

Verifikasi: `node scripts/uji/test_hospital_operations.cjs` memakai RPC/trigger SQL nyata dan fixture sintetis; `node scripts/qa-hospital-operations.cjs` menghubungkan browser ke PGlite. Sink jurnal/audit lama adalah fixture, bukan validasi akuntansi/produksi. Unit khusus memakai workflow koordinasi dan referensi sumber; tidak mengklaim mesin klinis/stock ledger baru.

## Governance, Sprint dan formulir — 0074–0076 (8 Oktober 2026)
- 0074: versi konfigurasi administratif/template/authority/Sprint, maker-checker, gate aktivasi, effective date, idempotensi, tenant/RBAC dan event audit. Tidak seeded ke tenant nyata.
- 0075: membership tim, backlog/estimasi, planning, DoD, koreksi sebelum close, snapshot selesai, carry-over dan velocity historis.
- 0076: catatan klinis tenant-scoped ke admissions existing, template aktif, pengesahan profesi dan authority, RLS scope, amendment tanpa overwrite.
Prasyarat: baseline tenant/auth/RBAC/admissions dan 0070–0073. Preflight: db/preflight/0074_policy_sprint_clinical.sql. Runbook: db/runbooks/0074_policy_sprint_clinical.md. Tidak diterapkan produksi. Policy administratif belum menjadi kalkulator billing, authority belum menggantikan seluruh RBAC legacy, form engine belum menggantikan mesin klinis khusus. STR/SIP/privilege individual belum otomatis diverifikasi oleh form engine.
