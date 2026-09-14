# AVA Global Ecosystem Platform

Repositori ini adalah sumber aplikasi web AVA Health Solution, aplikasi desktop lokal, migrasi database, dan dokumentasi pengembangan. Root repository adalah satu-satunya titik deploy Vercel.

## Peta cepat

| Lokasi | Peran |
| --- | --- |
| `ava-platform/` | Aplikasi web statis: HIS, LIS, kiosk, antrian, portal, dan monitor. |
| `api/` dan `middleware.js` | Endpoint serta kontrol akses Vercel. |
| `vercel.json` | Konfigurasi deploy kanonis; output deploy adalah `ava-platform/`. |
| `db/migrations/` | Jalur migrasi database resmi dan berurutan. |
| `db/preflight/`, `db/runbooks/` | Pemeriksaan serta prosedur sebelum migrasi. |
| `ava-platform/sql_arsip/` | Rekam historis SQL; bukan jalur deploy dan tidak boleh dijalankan langsung di produksi. |
| `desktop-app/` | Aplikasi Electron dan mesin lokal PGlite. |
| `scripts/` | Verifikasi boundary, keamanan, menu, deploy readiness, dan rilis connector. |
| `docs/` | Dokumentasi aktif, bukti audit, serta arsip yang diindeks pada `docs/README.md`. |
| `data/catalog/` | Katalog generik yang tervalidasi; bukan data pasien. |

## Aturan sumber kebenaran

- Gunakan `vercel.json` di root. `ava-platform/vercel.json` dipertahankan hanya sebagai konfigurasi historis untuk export lama, bukan target deploy saat ini.
- Tambahkan migrasi baru hanya ke `db/migrations/`, dengan preflight dan runbook bila menyentuh database. Baca `db/MIGRATION_CATALOG.md` terlebih dahulu.
- Jangan menjalankan berkas dari `ava-platform/sql_arsip/` langsung ke staging atau produksi.
- Jangan menyimpan kredensial, data operasional, cadangan, atau data pasien di Git. Aturan lokal dan artefak build dijaga oleh `.gitignore`; paket deploy dibatasi oleh `.vercelignore`.
- Jangan menghapus folder arsip atau `ava-platform/downloads/ava-lis-connector-1.1.0.zip` tanpa memperbarui skrip rilis dan manifest terkait.

## Pemeriksaan sebelum commit/deploy

Jalankan dari root repository menggunakan Node.js:

```powershell
node scripts/verify-application-boundaries.js
node scripts/verify-deploy-readiness.js
node scripts/audit-menu-hidup.js
node scripts/verify-tenant-rls-coverage.cjs
node scripts/scan-tracked-secrets.cjs
node scripts/verify-desktop-artifact.cjs desktop-app/release
git diff --check
```

Untuk verifikasi database staging, jalankan query read-only
[`db/checks/tenant_rls_coverage.sql`](db/checks/tenant_rls_coverage.sql) setelah migration
diterapkan; gate statis tidak menggantikan bukti runtime `pg_policies` dan uji isolasi
antar-tenant.

Control plane produksi berada di rute `tech-control-plane` pada domain Tech.
Migration `0054_tech_control_plane_observability.sql` menambahkan heartbeat
tenant-scoped yang persisten; heartbeat tidak boleh dianggap sehat bila RPC atau
koneksi backend tidak tersedia.

### Windows code signing

Rilis desktop Windows menggunakan Microsoft Trusted Signing melalui workflow
[`desktop-windows-signed.yml`](.github/workflows/desktop-windows-signed.yml).
Workflow berhenti fail-closed bila konfigurasi signing belum tersedia,
menandatangani `.exe`, memverifikasi Authenticode, lalu mengunggah artefak
bertanda tangan.

Tambahkan secret berikut pada GitHub Actions repository:

- `TRUSTED_SIGNING_TENANT_ID`
- `TRUSTED_SIGNING_CLIENT_ID`
- `TRUSTED_SIGNING_CLIENT_SECRET`
- `TRUSTED_SIGNING_ENDPOINT`
- `TRUSTED_SIGNING_ACCOUNT_NAME`
- `TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`

Service principal hanya boleh memiliki izin signing pada Trusted Signing
account. Jangan menyimpan certificate, private key, atau secret tersebut di
repository. Publikasi update `electron-updater` tetap harus dilakukan melalui
release channel yang benar-benar terkonfigurasi.

Konfigurasi signing sengaja ditunda sampai tenant/client pertama siap. Control
Plane menampilkan status `NOT_CONFIGURED` tanpa membuat credential placeholder;
nilai runtime nantinya diisi melalui jalur release terotorisasi, bukan melalui
frontend atau database operasional.
Migration `0055_tenant_rls_legacy_completion.sql` melengkapi boundary RLS tabel
tenant-bearing lama yang ditemukan oleh audit coverage yang diperluas.

Untuk perubahan yang menyentuh antrean, LIS, atau katalog, jalankan pemeriksaan khusus yang relevan di `scripts/`. Jangan menghubungkan atau menulis ke database produksi tanpa backup, preflight, runbook, dan persetujuan pemilik data.

## Dokumentasi dan status

Status pekerjaan, bukti verifikasi, dan implikasi IP/kepatuhan dicatat pada `docs/project/STATUS-PROYEK.md`. Indeks dokumentasi tersedia di `docs/README.md`.

## Kepemilikan dan kepatuhan

`OWNED_BY: ava`. Repositori dapat memuat aset operasional AVA. Template atau komponen yang akan dijadikan produk multi-tenant harus diparameterkan dan tidak boleh membawa data pasien, harga, kontrak, atau kredensial AVA.
