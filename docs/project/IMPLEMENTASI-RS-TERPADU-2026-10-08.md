# Implementasi fondasi RS terpadu — 8 Oktober 2026

OWNED_BY: generic. Keputusan desain pengguna 1–9 semuanya A; rincian di [rancangan](RANCANGAN-SOP-RS-TERPADU.md). Persetujuan skema berlaku untuk repo dan pengujian lokal, bukan produksi.

## Plan → Execute → Verify

Subtask masing-masing maksimum satu jam: inventaris sumber; kontrak governance; RPC dan RLS; UI setup; Sprint lifecycle; formulir/version/sign/amendment; uji SQL; simulasi UI; regresi; runbook dan Git. Fondasi menggunakan admissions dan user_profiles existing; tidak membuat identitas pasien atau katalog baru.

## Implikasi IP & Kepatuhan

Generic multi-tenant dan fixture sintetis. Tidak menyalin data/kontrak/tarif AVA, parameter terapi atau secret. Tidak menghubungi BPJS/PACS/vendor atau DB produksi. Template serta authority klinis harus disetujui profesi; administrator tidak menggantikan profesi. Nilai konfigurasi nyata belum ditetapkan. Review rancangan bukan pengesahan klinis/STR/SIP/privilege individual.

## Yang sudah berjalan

| Bagian | Implementasi | Bukti |
|---|---|---|
| Governance | Versioned draft → in_review → approved → active/retired; maker-checker; tanggal berlaku; idempotensi; audit | SQL dan UI, termasuk reviewer sama ditolak dan administrator ditolak untuk template/authority klinis |
| Konfigurasi | Administratif dasar, template, authority, Sprint; validasi server dan tanpa seed otomatis | Invalid/missing policy ditolak; policy resolver tidak mengaktifkan versi masa depan |
| Tech Sprint | Anggota per tim, skala/DoD/window/carry-over, create/edit backlog, assign/start/doing/done, koreksi Done sebelum close, snapshot/carry-over/velocity | Dua sprint menghasilkan velocity dari poin Done; versi baru tidak mengubah snapshot; next_planning dan audit estimasi diuji |
| Formulir klinis | Template aktif, field bertipe, authority per scope, sign profesi, amendment dari signed record ke encounter/scope sama | Isian wajib, false boolean, akses finance/lintas tenant, signature dan original tetap utuh diuji |
| Menu | cfg-rs-policy dan rs-clinical-forms baru; tech-sprint memakai renderer nyata; manifest generated | Route/judul/manifest dan generator sinkron |

Policy authority klinis hanya menyetujui role profesi, dan approval-nya memerlukan dokter/clinical governance. Pemeriksaan STR/SIP/privilege individual belum otomatis; perlu fondasi workforce dan pengesahan pemilik profesi sebelum penggunaan nyata.

## Verifikasi

- `node scripts/uji/test_policy_sprint.cjs`: 13 skenario SQL nyata PGlite, sintetis dan terisolasi.
- `node scripts/qa-policy-sprint.cjs`: 5 kelompok alur UI → SQL, desktop/mobile, escaping, error/retry. Fixture mengatur tanggal efektif untuk kebutuhan uji saja.
- Regresi `test_hospital_operations.cjs`: 21 skenario SQL; `qa-hospital-operations.cjs`: 27 UI. Pemeriksaan 21 route workflow original kini memakai kode workflow yang tepat, bukan semua menu dengan prefix rs-, karena form engine mempunyai route sendiri.
- Audit menu hidup, generator, parse JS dan diff check lingkup implementasi. Audit statis bukan bukti migrasi/deployment produksi.

Bukti: [SQL](../audit-evidence/2026-10-08/policy-sprint-simulation.json), [UI](../audit-evidence/2026-10-08/policy-sprint-ui.json), sprint-desktop.png, sprint-mobile.png, clinical-records.png pada folder tanggal yang sama. Runbook: `db/runbooks/0074_policy_sprint_clinical.md`; preflight read-only tersedia.

## Yang belum selesai dan tidak dinaikkan statusnya

**Ini fondasi, bukan penyelesaian seluruh menu parsial.** Kebijakan administratif belum diterapkan ke kalkulator room/billing existing. Authority belum menggantikan guard semua modul. Form engine belum menggantikan flowsheet ICU, partograf, MAR, kompatibilitas/ledger komponen darah, dan protokol sesi HD/kemoterapi.

Pekerjaan lanjutan: booking ruang/mesin/tim dan multi-session concurrency; integrasi ledger stok existing lintas unit; posting layanan, deposit/refund/payer/paket dan room charge sesuai policy; episode unit serta hubungan ibu–bayi; workforce/privilege; unit khusus dan indikator historis; adapter/simulator vendor yang ditandai; integrasi hub/readiness; UAT seluruh tenant. Tidak menaikkan status hanya karena template/form atau workflow koordinasi tersedia.

Tech Sprint menjadi ada untuk batas fungsi yang diuji; dua menu baru tetap parsial. Total katalog 253 entri: 211 ada, 42 parsial, 0 belum. Angka parsial bertambah karena ada dua menu fondasi baru; bukan klaim 40 gap original sudah ditutup. Board Sprint dibatasi 100 sprint/500 item dengan penanda, bukan seluruh arsip. Belum ada pengujian PostgreSQL multi-session, deployment produksi atau acceptance klinis RS.
