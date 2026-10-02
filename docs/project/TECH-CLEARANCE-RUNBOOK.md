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
node scripts/qa-domain-readability.cjs
node scripts/qa-module-render.cjs
node scripts/qa-monitor-flow.cjs
```

Script otomatis mencari Playwright dari instalasi lokal atau runtime workspace. Jika runtime berada di lokasi lain, isi `PLAYWRIGHT_MODULE` secara manual.

Catat viewport, URL lokal, tanggal, dan commit. Audit ini tidak membuktikan database atau DNS.

## 2. Persiapan staging

Bagian ini menyiapkan environment saja. Migration belum dijalankan pada tahap ini.

### 2.1 Tetapkan bentuk environment

Gunakan dua project database staging terpisah agar pola isolasinya sama dengan dedicated production:

| Tenant | Project database staging | Domain aplikasi staging | Repository/branch |
|---|---|---|---|
| AHM | `ava-ahm-staging` | isi domain staging resmi | repo AHM / `staging` |
| Klinik Utama Moksa | `ava-moksa-staging` | isi domain staging resmi | repo Moksa / `staging` |

Nama di atas adalah contoh. Ganti dengan nama final yang disepakati dan jangan memakai domain production.

### 2.2 Siapkan akses internal untuk staging

Bagian ini **bukan pendaftaran user client**. Ini hanya daftar orang internal AVA/platform yang boleh menyiapkan dan mengawasi environment staging melalui Tech atau provider infrastrukturnya:

| Akses internal | Fungsi | Boleh masuk Tech? |
|---|---|---|
| Owner platform | Menyetujui perubahan dan rollback | Ya, Super Admin terbatas |
| Operator Tech | Mengisi deployment dan memantau status | Ya, role operasional Tech |
| Database owner | Menyetujui SQL, backup, dan restore | Tidak wajib; cukup akses database staging |
| QA/UAT internal | Menjalankan skenario sintetis | Tidak wajib; memakai akun aplikasi staging |
| On-call | Menerima alert dan mengakui incident | Ya jika menangani operasi Tech |

Berikan akses minimum, aktifkan MFA, dan catat email owner di change record. Jangan membagikan service-role key, password, atau token melalui chat.

### 2.2.1 User client dibuat di platform masing-masing

AHM dan Klinik Utama Moksa tidak perlu memakai Tech untuk operasional harian. Akun client dibuat pada aplikasi yang mereka gunakan:

| Pengguna | Platform akun | Contoh kewenangan |
|---|---|---|
| Super Admin AVA / operator platform | Tech | Tenant, deployment, health, incident, release |
| Admin klinik Moksa | HIS/LIS Moksa | Registrasi, pelayanan, hasil, inventory sesuai kontrak |
| Dokter/analis/perawat Moksa | HIS atau LIS | Modul klinis sesuai role fasilitas |
| HR AHM | HIS/Wellness/portal korporat AHM | Roster, hasil, evaluasi, treatment sesuai kewenangan |
| Karyawan AHM | Portal/Wellness AHM | Consent, input mandiri, melihat hasil yang diizinkan |
| Operator IHC | Modul hasil/IHC yang ditetapkan | Impor atau pengiriman hasil tanpa menjadi pengguna Tech |

Tech hanya menerima telemetry, status, incident, dan metadata operasi yang diperlukan. Tech tidak menjadi tempat client menginput rekam medis, hasil laboratorium, roster, atau treatment. Role dan RLS client tetap ditegakkan di HIS/LIS/portal masing-masing.

### 2.3 Buat project database staging

Untuk masing-masing tenant:

1. buat project Supabase/database staging;
2. pilih region yang disetujui pemilik data;
3. catat `project_ref`, URL API, dan nama environment;
4. aktifkan log/audit bawaan;
5. buat backup awal kosong sebelum migration;
6. pastikan project tidak memakai data pasien production;
7. buat tenant UUID staging yang akan dipakai pada UAT;
8. simpan nilai non-secret pada change record.

Yang dicatat di Tech/manifest hanya nama reference environment, misalnya `AHM_DATABASE_URL` dan `AHM_SUPABASE_ANON_KEY`. Nilai secret dimasukkan ke secret manager atau environment Vercel, bukan ke repository.

### 2.4 Siapkan project hosting staging

Untuk setiap tenant buat atau pilih project Vercel staging:

1. hubungkan repository yang benar;
2. pilih branch `staging` atau branch release yang disetujui;
3. set build command dan output sesuai project;
4. isi environment variable staging dari secret manager;
5. pastikan `VERCEL_TOKEN` hanya berada di server-side Tech;
6. pastikan `VERCEL_TEAM_ID` benar jika project berada pada Team;
7. deploy commit yang sudah lulus QC lokal;
8. catat deployment ID dan commit SHA.

Jangan memasukkan token Vercel ke form browser, file tenant, screenshot, atau commit.

### 2.5 Siapkan domain dan DNS staging

Gunakan subdomain khusus staging, misalnya `ahm-staging.<domain-anda>` dan `moksa-staging.<domain-anda>`.

1. tambahkan domain staging pada project Vercel;
2. salin nilai DNS yang diminta Vercel;
3. buat record DNS pada provider domain;
4. tunggu status verification dan TLS menjadi valid;
5. uji `https://domain-staging/...` dari browser;
6. pastikan domain production tidak berubah;
7. catat waktu verifikasi, record, dan actor.

Jika DNS belum disetujui, gunakan URL preview Vercel dan jangan mengubah DNS production.

### 2.6 Siapkan backup, notifikasi, dan operasi

Sebelum migration, owner harus mengisi:

- lokasi backup staging dan retention;
- jadwal backup serta restore drill;
- owner on-call dan escalation level;
- kanal notifikasi (email/webhook internal);
- maintenance window;
- SLA acknowledgement dan recovery untuk UAT;
- prosedur rollback database dan deployment.

Simpan hanya metadata backup di Tech: waktu, status, checksum/manifest, retention, dan evidence pointer. Jangan menaruh isi backup atau credential storage di aplikasi.

### 2.7 Isi Deployment Center Tech

Setelah project siap, login sebagai Super Admin dan isi form **Pengaturan deployment tenant** untuk setiap tenant:

| Field | Isi |
|---|---|
| Tenant ID | UUID tenant staging yang sudah dibuat |
| Environment | `Staging` |
| Provider | `vercel` |
| Nama project | project Vercel staging |
| Domain | domain staging yang sudah diverifikasi |
| Branch | `staging` atau branch release |
| Repository URL | URL repository staging resmi |

Klik **Simpan & antrekan sinkronisasi**. Status yang benar sebelum adapter bekerja adalah `PENDING_SYNC`; jangan menganggap domain sudah aktif hanya karena konfigurasi tersimpan.

### 2.8 Checklist checkpoint sebelum migration

Migration baru boleh dimulai jika semua jawaban berikut `YA`:

- project database AHM dan Moksa sudah terpisah;
- backup awal dan rollback plan tersedia;
- owner database menyetujui urutan migration;
- secret reference sudah terisi tanpa nilai secret di repo;
- domain staging tidak memakai domain production;
- repository dan branch sudah diverifikasi;
- owner on-call dan kanal notifikasi tersedia;
- tenant UUID staging sudah dicatat;
- data uji disepakati sintetis;
- change record memiliki approver dan maintenance window.

Jika satu jawaban `TIDAK`, berhenti di tahap persiapan dan jangan menjalankan SQL. Jangan menjalankan migration dari runbook ini dengan koneksi production.

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
