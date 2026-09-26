# Backlog Development Tech Control Plane

Tanggal: 26 September 2026  
Acuan: `docs/project/TECH-CONTROL-PLANE-END-TO-END-AUDIT.md`

## Status saat ini

### Sudah selesai

- Registry tenant, lisensi, telemetry, dan heartbeat tersedia.
- Status heartbeat membedakan HEALTHY, STALE, OFFLINE, dan UNKNOWN.
- Manifest dedicated staging AHM dan Klinik Utama Moksa tersedia.
- Registry source untuk event, alert, incident, problem, change, backup, restore drill, dan support ticket tersedia melalui migration `0065`.
- Control Plane membaca queue operasi dan menyediakan pencatatan tiket dari CS.
- False success pada simulasi save ditolak.
- Simulasi login 14/14 lulus.
- Audit menu hidup lulus.

## P0 — wajib selesai sebelum staging UAT

### P0.1 Backend transition workflow

**Belum selesai:** tombol untuk acknowledge/resolve alert, membuka incident, mengubah status incident, membuat problem preventif, dan menutup problem belum memiliki RPC server-side.

**Rencana:** buat RPC idempotent dengan validasi role, tenant scope, state transition, actor, timestamp, alasan, dan audit event.

**Acceptance:** setiap perubahan status memiliki actor, waktu, alasan, correlation ID, dan tidak dapat melompati transisi yang dilarang.

### P0.2 Central event correlation

**Belum selesai:** event UI, error API, heartbeat, support ticket, dan audit belum otomatis memakai envelope correlation yang sama.

**Rencana:** tetapkan helper correlation ID di client/server dan wajibkan pada request, error, alert, incident, change, dan support ticket.

**Acceptance:** satu correlation ID dapat menampilkan timeline lengkap dari gejala sampai verifikasi.

### P0.3 Synthetic monitoring

**Belum selesai:** heartbeat ada, tetapi belum ada scheduler untuk login, read, write-test, database connectivity, storage, dan endpoint kritis.

**Rencana:** buat check registry, schedule runner, timeout, retry, dedupe fingerprint, maintenance window, dan alert routing.

**Acceptance:** kegagalan sintetis menghasilkan satu alert deduplicated, bukan data palsu atau alert berulang tanpa kontrol.

### P0.4 Backup freshness dan restore evidence

**Belum selesai:** tabel evidence tersedia, tetapi belum ada connector/job yang mengisi hasil backup, checksum, retention, restore drill, RPO, dan RTO.

**Rencana:** sambungkan job backup staging, simpan metadata saja, jalankan restore drill terjadwal, dan buat alert backup stale/failed.

**Acceptance:** Tech dapat menjawab backup terakhir, umur backup, hasil restore terakhir, RPO/RTO aktual, dan gap terbuka.

### P0.5 Release/change gate

**Belum selesai:** release dan change masih berupa registry; belum ada approval gate, migration ledger, preflight, smoke test, rollback, dan tenant rollout status.

**Rencana:** buat state machine draft → review → approved → running → succeeded/rolled_back, dengan evidence wajib.

**Acceptance:** deployment tanpa approval, backup fresh, rollback plan, dan smoke test tidak dapat ditandai sukses.

## P1 — wajib sebelum dua tenant dedicated go-live

### P1.1 Tenant installation registry

Simpan installation ID, environment, domain, repository, app version, database version, region, owner, dan last deployment.

### P1.2 Incident SLA dan escalation

Tambahkan timer acknowledge/restore, owner/on-call, escalation level, maintenance suppression, serta notifikasi email/webhook yang tidak mengandung data pasien.

### P1.3 Problem preventif dan root cause

Tambahkan RCA, contributing factor, preventive action, due date, residual risk, verifier, dan effectiveness review.

### P1.4 Support desk lengkap

Tambahkan channel client, lampiran evidence terkontrol, komunikasi, status waiting client, resolution, reopen, dan hubungan ke incident/problem/change.

### P1.5 Access review dan secret expiry

Tambahkan review role berkala, expiry key/domain certificate, break-glass approval, dan log pencabutan akses.

### P1.6 Dedicated tenant readiness

AHM dan Klinik Utama Moksa harus masing-masing lulus:

- database isolation;
- migration parity;
- domain verification;
- secret reference check;
- backup dan restore drill;
- heartbeat dan synthetic check;
- alert routing;
- UAT;
- rollback drill;
- handover.

## P2 — kesiapan komersial dan skala

- SLA report per tenant.
- Usage-to-invoice reconciliation.
- Customer success dan adoption metrics.
- Capacity trend dan forecast.
- Client status page dengan data tersaring.
- Export audit dan evidence per tenant.
- Tenant offboarding dan data export.
- Release channel: stable, pilot, dan emergency patch.

## Dependensi yang belum tersedia

- target staging database untuk migration `0065`;
- scheduler/worker untuk synthetic check dan backup check;
- storage backup yang disetujui;
- notification channel dan on-call owner;
- domain, repository, serta secret environment AHM;
- domain, repository, serta secret environment Klinik Utama Moksa;
- SLA dan kebijakan support yang disepakati client;
- approval pemilik database sebelum migration staging.

## Urutan eksekusi

1. RPC transition dan event correlation.
2. Synthetic monitoring dan alert routing.
3. Backup/restore evidence.
4. Release/change gate.
5. Incident SLA, problem preventif, dan support desk.
6. Staging dedicated AHM.
7. Staging dedicated Klinik Utama Moksa.
8. UAT dan rollback drill.
9. Production handover.

## Definition of done

Tech hanya boleh disebut siap operasi jika operator dapat menerima satu laporan kendala, menemukan bukti, mengaitkan correlation ID, membuat incident, menjalankan change terkontrol, memverifikasi pemulihan, membuat preventive problem, dan menghasilkan audit timeline tanpa mengubah database secara manual.
