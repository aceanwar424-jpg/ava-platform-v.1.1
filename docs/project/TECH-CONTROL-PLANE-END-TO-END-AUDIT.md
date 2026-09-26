# Audit End-to-End AVA Tech Control Plane

Tanggal audit: 26 September 2026  
Target: `tech.avahealth.sbs` sebagai pusat kendali platform, tenant, lisensi, deployment, monitoring, support, dan operasional client.

## Putusan audit

Tech sudah memiliki fondasi, tetapi belum boleh disebut sebagai control plane operasional yang matang. Saat ini ia dapat menampilkan tenant, paket/lisensi, pemakaian, heartbeat dasar, dan audit event umum. Ia belum memiliki satu alur yang mengikat sinyal teknis menjadi tindakan operasional yang dapat ditugaskan, dieskalasikan, diselesaikan, dibuktikan, dan direview.

Kekurangan terpenting bukan jumlah menu. Kekurangannya adalah **ketiadaan kontrak operasional yang durable** antara monitoring, incident, problem preventif, change/release, backup, dan customer support.

## Bukti yang sudah ada

| Area | Bukti source | Status aktual |
|---|---|---|
| Tenant registry | `public.tenants`, `tenant_ringkasan`, `modules/tech-platform/tenants.js` | Ada; CRUD dan ringkasan pemakaian tersedia. |
| Paket dan lisensi | `tech_paket`, `tech_lisensi`, `tech_papan_lisensi`, `techLicenseActivation.js` | Ada; aktivasi dan pencabutan ada, tetapi pemisahan lisensi dari suspend tenant masih perlu workflow operasi. |
| Telemetri | `tenant_pemakaian`, `techTelemetry.js` | Ada; metrik agregat bulanan. Tidak cukup untuk diagnosis peristiwa atau korelasi request. |
| Heartbeat | `tech_client_heartbeats`, `tech_record_client_heartbeat`, `techControlPlane.js` | Ada; sekarang menampilkan HEALTHY/STALE/OFFLINE/UNKNOWN berbasis umur laporan. |
| Audit | `activity_logs`, `sys_audit_log` | Ada di beberapa jalur; belum menjadi audit operasional terpadu dengan correlation ID, incident ID, change ID, dan retention policy yang konsisten. |
| Control plane | `techControlPlane.js` | Ada sebagai cockpit status; belum menjadi command center yang dapat membuat/menugaskan/menyelesaikan tindakan. |
| Release | menu roadmap/modul/sprint dan template deployment | Sebagian; belum ada approval gate, deployment record, migration result, rollback evidence, atau tenant release matrix yang durable. |
| Backup/restore | script/runbook historis dan klaim QC lokal | Belum ada registry backup, freshness check, restore drill evidence, RPO/RTO per tenant, atau status yang dapat diverifikasi di Tech. |
| Incident/problem | menu delivery/isu tersedia | Belum ada kontrak data yang mengikat alert → incident → problem preventif → change → verifikasi. |
| Secret/access | pola environment reference dan fail-closed sudah ada | Belum ada access review terjadwal, key rotation evidence, break-glass log, atau expiry alert di Tech. |

## Gap kritis yang harus ditutup

### 1. Monitoring belum menjadi alert lifecycle

Heartbeat hanya menyimpan status terakhir. Belum ada:

- pemeriksaan freshness terjadwal;
- rule per tenant, environment, dan severity;
- deduplikasi alert;
- alert acknowledgement;
- maintenance window;
- routing ke owner/on-call;
- escalation timer;
- alert-to-incident linkage;
- synthetic check untuk login, database, storage, dan endpoint penting;
- pemisahan outage platform, outage tenant, dan masalah integrasi.

### 2. Belum ada Incident Management yang audit-ready

Incident wajib memiliki nomor, tenant, environment, service, severity, waktu terdeteksi, waktu diakui, waktu pulih, dampak, owner, komunikasi client, timeline event, workaround, root cause, dan post-incident review. Saat ini belum ada satu entitas durable yang memegang semua itu.

### 3. Problem preventif belum punya alur

Problem preventif berbeda dari incident. Ia berasal dari pola berulang, risiko kapasitas, temuan audit, backup yang gagal, sertifikat yang akan habis, atau dependency yang rentan. Ia harus memiliki risk statement, evidence, preventive action, owner, due date, verification, dan residual risk.

### 4. Backup belum dapat dibuktikan

Backup file saja bukan bukti pemulihan. Untuk tiap tenant dedicated perlu terlihat:

- backup terakhir berhasil;
- lokasi dan encryption status;
- retention;
- checksum/manifest;
- hasil restore drill;
- RPO aktual;
- RTO aktual;
- owner;
- pengecualian atau kegagalan;
- tanggal drill berikutnya.

Jangan menyimpan credential storage atau isi backup di Tech UI.

### 5. Release belum terhubung ke tenant

Setiap tenant harus memiliki matriks versi:

```text
tenant → environment → app_version → db_version → license → last_deploy → health
```

Tanpa itu, operator tidak dapat menjawab versi apa yang digunakan AHM atau Moksa, apakah migration sudah berjalan, dan apakah rollback tersedia.

### 6. Log masih tersebar

Log teknis, audit, activity log, heartbeat, dan telemetry harus dapat dicari menggunakan:

```text
correlation_id
request_id
tenant_id
installation_id
incident_id
change_id
actor_id
```

Tanpa correlation ID, penelusuran kendala akan tetap manual.

### 7. Customer support belum terhubung ke operasi

Tiket client harus dapat dikaitkan ke tenant, kontrak/SLA, incident, problem, release, dan komunikasi. Status “selesai” tidak cukup; harus ada bukti solusi dan konfirmasi client bila berdampak langsung pada layanan.

## Target arsitektur operasional

```text
Synthetic checks + heartbeat + logs + backup checks + security checks
                              │
                              ▼
                        Alert registry
                              │
                 dedupe / severity / routing
                              │
                              ▼
       Incident ───────► Problem preventif ───────► Change / Release
          │                         │                       │
          └──── client update ◄─────┴──── evidence ─────────┘
                              │
                              ▼
                    Post-incident review
                              │
                              ▼
                    KPI, SLA, risk, trend
```

## Domain data yang diperlukan

Implementasi berikutnya sebaiknya menggunakan tabel tenant-aware dan append-only event untuk histori:

| Entitas | Tujuan minimum |
|---|---|
| `tech_installations` | Registrasi instalasi per tenant/environment, versi, domain, region, mode deployment. |
| `tech_service_checks` | Definisi health check, interval, timeout, expected response, owner. |
| `tech_check_results` | Hasil check immutable dengan latency, status, evidence pointer, correlation ID. |
| `tech_alerts` | Alert terdeduplikasi dengan severity, state, rule, maintenance suppression, dan timestamps. |
| `tech_incidents` | Dampak, timeline, owner, severity, SLA clock, komunikasi, resolution, PIR. |
| `tech_problems` | Pola/risiko preventif, RCA, preventive action, due date, residual risk, verification. |
| `tech_changes` | Perubahan source/config/schema/secret, approval, risk, rollback plan, evidence. |
| `tech_releases` | Versi core, migration version, artifact checksum, deployment status, tenant rollout. |
| `tech_backup_runs` | Status backup, freshness, retention, checksum, storage reference, RPO/RTO. |
| `tech_restore_drills` | Evidence restore, hasil, duration, dataset class, gap, next drill. |
| `tech_support_tickets` | Permintaan client, SLA, owner, linked incident/problem/change. |
| `tech_access_reviews` | Review role, secret/key rotation, break-glass, reviewer, expiry. |
| `tech_operational_events` | Event envelope bersama untuk korelasi dan audit lintas domain. |

Semua entitas harus membawa `tenant_id` jika tenant-scoped, dan event global harus membawa `scope_type` yang eksplisit. Jangan menaruh password, token, private key, data pasien, atau full backup payload dalam tabel operasi.

## Status severity dan SLA awal

| Severity | Contoh | Acknowledge | Target pemulihan / containment |
|---|---|---:|---:|
| P0 | Semua tenant atau layanan klinis kritis tidak tersedia | 15 menit | 4 jam atau failover/contingency aktif |
| P1 | Satu tenant dedicated tidak dapat beroperasi | 30 menit | 8 jam |
| P2 | Fitur penting terganggu dengan workaround | 4 jam kerja | 2 hari kerja |
| P3 | Minor defect, pertanyaan, preventive improvement | 1 hari kerja | Terjadwal dalam release |

Nilai ini harus menjadi konfigurasi produk dan disepakati dalam SLA client. Ia bukan klaim kontrak sampai disetujui.

## Cockpit Tech yang dituju

Halaman control plane harus memiliki enam lapisan:

1. **Overview** — status platform, tenant, instalasi, alert aktif, incident P0–P2, backup stale, release tertunda.
2. **Tenant detail** — domain, environment, lisensi, versi, heartbeat, check, alert, incident, backup, support, dan riwayat perubahan.
3. **Operations queue** — alert yang belum diakui, incident aktif, preventive problem jatuh tempo, backup gagal, certificate/key mendekati expiry.
4. **Release center** — release candidate, approval, preflight, deployment per tenant, migration result, rollback readiness.
5. **Evidence & audit** — timeline immutable berdasarkan correlation ID dan linked entity.
6. **Administration** — owner/on-call, SLA, maintenance window, retention, access review, notification routing.

Semua status harus mempunyai freshness timestamp dan sumber. Nilai kosong ditampilkan sebagai `UNKNOWN`, bukan `0` atau `HEALTHY`.

## Alur operasional end-to-end

### A. Kendala teknis

1. Check/heartbeat gagal.
2. Rule membuat atau menggabungkan alert.
3. Alert diroute ke owner berdasarkan tenant dan service.
4. Operator acknowledge; SLA clock mulai tercatat.
5. Jika berdampak, alert dipromosikan menjadi incident.
6. Timeline dan komunikasi dicatat.
7. Workaround atau rollback dilakukan melalui change yang terhubung.
8. Health check pulih; incident masuk monitoring period.
9. Post-incident review menetapkan problem preventif jika ada pola atau akar penyebab.

### B. Problem preventif

1. Temuan berasal dari trend, audit, backup drill, security review, atau incident berulang.
2. Problem diberi risk, owner, due date, dan prioritas.
3. Preventive action dibuat sebagai change/release.
4. Evidence hasil tindakan disimpan.
5. Verifikator menyatakan efektif/tidak efektif.
6. Residual risk dicatat dan problem ditutup hanya setelah verifikasi.

### C. Release tenant

1. Core release dibuat dan checksum dicatat.
2. Migration dan rollback plan direview.
3. Staging tenant menjalani preflight.
4. Backup freshness diperiksa.
5. Approval diberikan.
6. Deployment dilakukan per tenant.
7. Synthetic check dan smoke test dijalankan.
8. Hasil deployment dicatat.
9. Jika gagal, rollback atau pause rollout.
10. Tenant release matrix diperbarui.

### D. Backup dan restore

1. Backup job melapor hasil signed/hashed.
2. Tech memeriksa freshness dan retention.
3. Kegagalan membuat alert P1/P2 sesuai dampak.
4. Restore drill berkala memakai environment non-produksi.
5. RPO/RTO aktual dicatat.
6. Gap drill menjadi problem preventif.

## Prioritas implementasi

### P0 — membuat operasi dapat dipercaya

- Event envelope dan correlation ID.
- Alert registry, dedupe, acknowledge, routing, maintenance window.
- Incident registry dan SLA clock.
- Tenant/installation/environment registry.
- Backup freshness dan restore evidence registry.
- Release/change record minimal dengan approval dan rollback plan.

### P1 — mengurangi pekerjaan manual

- Problem preventif dan CAPA-like workflow.
- Support ticket linked ke incident/problem.
- Alert notification adapters.
- Tenant detail timeline.
- Release rollout matrix AHM/Moksa.
- Access review dan key expiry monitor.

### P2 — optimasi komersial

- Usage-to-invoice reconciliation.
- Customer success/adoption metrics.
- SLA report per tenant.
- Capacity trend dan forecast.
- Self-service client status page dengan data yang disaring.

## Dedicated AHM dan Klinik Utama Moksa

Keduanya sebaiknya mulai pada staging dedicated database dengan checklist yang sama:

- tenant manifest valid;
- database isolated;
- domain verified;
- secret references tersedia;
- migration ledger cocok;
- backup berhasil;
- restore drill lulus;
- heartbeat dan synthetic checks aktif;
- alert route memiliki owner;
- release/rollback tercatat;
- UAT sign-off;
- production handover.

Perbedaannya berada pada konfigurasi fitur, domain, repository, dan owner. Mesin monitoring, incident, release, backup evidence, dan audit harus sama.

## Batasan dan checkpoint

Audit ini tidak menghubungkan database produksi, membuat backup cloud, membuat repository client, mengubah DNS, atau mengaktifkan alert eksternal. Semua itu memerlukan target yang eksplisit, credential/secret melalui secret manager, backup sebelum migrasi, dan persetujuan pemilik data. Data uji untuk audit tetap sintetis.

## Kesimpulan kesiapan

Tech saat ini **fondasi control plane**, belum **production operations platform**. Dua dedicated tenant sudah memiliki manifest staging, tetapi belum siap disebut go-live sampai P0 di atas tersedia dan dibuktikan pada staging. Urutan yang benar adalah mematangkan observability, incident/problem, evidence backup/restore, dan release governance terlebih dahulu; setelah itu baru provisioning AHM dan Klinik Utama Moksa.
