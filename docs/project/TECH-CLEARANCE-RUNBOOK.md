# Runbook Clearance AVA Tech

Tanggal: 2 Oktober 2026  
Ruang lingkup: `tech.avahealth.sbs`, tenant AHM, dan Klinik Utama Moksa.

Runbook ini memisahkan bukti yang bisa dihasilkan dari workspace lokal dari bukti yang hanya boleh diambil di staging. Semua fixture memakai identitas `SYNTHETIC-*`; jangan memakai data pasien nyata.

## 1. Uji lokal tanpa akses eksternal

Jalankan dari root repository:

```powershell
node scripts/qa-release-readiness.cjs
node scripts/qa-lis-current.cjs
node scripts/uji/run_all_tests.js
node scripts/qa-monitor-flow.cjs
node scripts/uji/test_ui_recovery.cjs
node scripts/qa-module-render.cjs
```

Hasil yang diharapkan:

- `LIS CURRENT CONTRACT: PASS`;
- suite regresi lokal lulus;
- readiness boleh berstatus `BLOCKED_FOR_STAGING` karena domain/repository tenant masih placeholder;
- bukti JSON tersimpan di `docs/audit-evidence/2026-10-02/release-readiness.json`.

Untuk audit browser lintas domain:

```powershell
$env:PLAYWRIGHT_MODULE='C:\Users\acean\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node scripts/qa-domain-readability.cjs
```

Catat viewport, URL lokal, tanggal, dan commit. Audit ini tidak membuktikan database atau DNS.

## 2. Persiapan staging

Pemilik database harus menyetujui nama project staging, tenant UUID staging AHM/Moksa, backup dan rollback database, secret manager, owner on-call, kanal notifikasi, maintenance window, dan batas data sintetis. Jangan menjalankan migration dari runbook ini dengan koneksi production.

## 3. Urutan migrasi staging

Jalankan satu per satu dan simpan output SQL:

```text
0065_tech_operations_control_plane.sql
0066_tech_operations_transitions.sql
0067_tech_auto_telemetry.sql
0068_tech_deployment_center.sql
0069_rbac_user_provisioning.sql
```

Setelah setiap file, hentikan proses bila ada error. Jangan melompati nomor migration.

Verifikasi RPC inti:

```sql
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'tech_ops_record_event','tech_ops_open_incident',
    'tech_ops_transition_incident','tech_ops_transition_problem',
    'tech_ops_approve_change','tech_ops_ingest_client_error',
    'tech_ops_save_deployment','create_auth_user','get_my_access',
    'list_user_access','set_user_access'
  )
order by p.proname, arguments;
```

Verifikasi privilege provisioning:

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('create_auth_user','get_my_access','list_user_access','set_user_access')
order by routine_name, grantee;
```

Hasil wajib: `anon` tidak memiliki `EXECUTE`; `authenticated` hanya memiliki fungsi yang diperlukan.

## 4. Uji incident sintetis

Gunakan tenant UUID staging, bukan placeholder dan bukan tenant production. Buat satu event `SYNTHETIC-SAVE-FAIL-001`, lalu pastikan:

1. event memiliki `correlation_id`;
2. alert terbentuk atau digabung berdasarkan fingerprint;
3. incident dibuka hanya sekali;
4. actor, tenant, severity, waktu, dan alasan tersimpan;
5. `OPEN → MITIGATING → MONITORING → RESOLVED → CLOSED` berhasil;
6. transition ilegal ditolak;
7. timeline dapat dicari berdasarkan correlation ID;
8. payload tidak memuat password, token, query string, atau data pasien.

Contoh nilai sintetis:

```text
tenant: <STAGING_TENANT_UUID>
incident_no: INC-SYNTHETIC-001
severity: P2
title: Uji kendala penyimpanan sintetis
correlation_id: CORR-SYNTHETIC-001
impact: Tidak ada data pasien; hanya fixture QA
```

## 5. Uji provisioning dan role

Dengan akun Super Admin staging:

1. buat `synthetic.operator@example.invalid` dengan password uji sementara;
2. pastikan Auth user dan `user_profiles` berada pada tenant yang sama;
3. pastikan activity log `user.provisioned` tercatat;
4. masuk sebagai Operator dan pastikan menu admin tidak terlihat;
5. uji HRD, IHC, dan tenant user sesuai scope masing-masing;
6. coba ubah role dari akun non-Super Admin dan pastikan ditolak server;
7. coba membaca tenant lain dan pastikan ditolak RLS;
8. disable/hapus akun uji sesuai prosedur staging.

Jangan memasukkan password staging ke screenshot, tiket, commit, atau dokumen.

## 6. Uji deployment Vercel

Isi manifest AHM dan Moksa melalui form Tech setelah domain/repository resmi disetujui. Secret tetap di environment Vercel atau secret manager.

1. simpan konfigurasi dan pastikan status awal `PENDING_SYNC`;
2. sinkronkan project staging;
3. pastikan project dibuat atau ditemukan tanpa duplikasi;
4. pastikan domain ditambahkan dan status DNS/TLS terbaca;
5. buka domain staging dan jalankan smoke test login/read/write sintetis;
6. uji token salah dan pastikan status gagal dapat ditindaklanjuti;
7. uji rollback ke deployment sebelumnya;
8. catat deployment ID, commit, domain, waktu, actor, dan hasil.

Jangan menjalankan create project/domain terhadap production sebelum change approval.

## 7. Uji backup, restore, scheduler, dan notifikasi

Bagian ini memerlukan worker dan storage staging yang disetujui:

1. jalankan backup sintetis dan simpan metadata checksum, retention, serta waktu;
2. pastikan Tech menampilkan umur backup dan status stale/failed secara jujur;
3. restore ke database staging terpisah;
4. catat durasi restore dan hitung RPO/RTO aktual;
5. matikan endpoint synthetic check secara terkontrol;
6. pastikan satu alert deduplicated terbentuk;
7. pastikan notifikasi hanya memuat metadata operasional;
8. pulihkan endpoint, jalankan smoke test, dan tutup incident dengan evidence;
9. jadikan gap restore sebagai preventive problem bila drill gagal.

## 8. Go / no-go

Nyatakan **GO staging UAT** hanya bila migration, privilege/RLS, incident lifecycle, provisioning role, Vercel staging, backup/restore, scheduler, notification, manifest final AHM/Moksa, dan rollback plan semuanya memiliki bukti.

Nyatakan **NO-GO** bila ada migration error, tenant leakage, false success, backup stale tanpa alert, deployment tanpa approval, atau bukti hanya berasal dari UI tanpa konfirmasi server.
