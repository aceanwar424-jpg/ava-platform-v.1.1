# AUDIT SISTEM SAAT INI (TAHAP 0)
### Restrukturisasi Platform AVA Global Ecosystem
**Dokumen Referensi:** `AVA-DOC-ARCH-2026-V5.1` & `PROMPT-ANTIGRAVITY-Restrukturisasi-AVA-Global`  
**Status Tahap:** Tahap 0 — Selesai (Read-Only Audit)  
**Tanggal Audit:** 30 Agustus 2026  
**Auditor:** Principal Engineer / Antigravity Agent  

---

## A. INVENTARIS TEKNIS

### 1. Struktur Repositori & Pola Arsitektur
Sistem saat ini merupakan **Hybrid Monorepo** yang menggabungkan:
1. **Web Platform (SPA Vanilla JS/HTML5/CSS3):**
   - Direktori: `ava-platform/`
   - Entry point: `index.html` (didukung portal mandiri: `portal.html`, `nakes.html`, `nutri.html`, `portal_korporat.html`, `portal_perujuk.html`, `track.html`, `support.html`, `apps_portal.html`).
   - Script loader & dynamic imports: `js/core/router.js:1-257`, `js/core/modul-manifest.js:1-957`, `js/core/lazy.js:1-120`.
2. **Desktop App (Electron + React 18 + Vite + TypeScript + PGlite WASM):**
   - Direktori: `desktop-app/`
   - Framework & Versi (`desktop-app/package.json:20-39`): React v18.2.0, Vite v5.1.4, Electron v29.1.0, `@electric-sql/pglite` v0.5.4, TailwindCSS v3.4.1.
   - PGlite Embedded Database Engine: `desktop-app/src/` & `desktop-app/dist-electron/main.js`.
3. **Backend & Serverless Edge Functions:**
   - Direktori: `ava-platform/supabase/functions/`
   - Edge functions: `agentic-worker`, `docx-to-pdf`, `embed`, `gemini-proxy`, `llm-gateway`.
4. **Alat & Pipa CLI / Tooling:**
   - Direktori: `lib/` (modul modular: `assembler/smm_pack_assembler.js`, `compliance/iso15189_checker.js`, `exporter/lis_exporter.js`, `llm/llm_adapter.js`, `validator/catalog_validator.js`).
   - Direktori: `scripts/` (audit, manifest builder, color token enforcer, site exporter, license generator).
   - Direktori: `tools/` (`tools/content_pipeline.js`).
   - Direktori: `connector/` (`ava-platform/connector/` untuk interkoneksi analyzer LIS ASTM/HL7).

### 2. Dependensi & Ekosistem
- **Web SPA:** Memanfaatkan modul script native ES6 tanpa bundler berat di jalur web, dengan third-party minified vendor di `ava-platform/vendor/` (`docx-preview.min.js`, `docxtemplater.min.js`, `jszip.min.js`, `pizzip.min.js`).
- **Build & Deploy:** Menggunakan Vercel (`vercel.json`, `ava-platform/vercel.json`), Electron Builder untuk Windows (`desktop-app/package.json:40-100`), serta script automasi di `scripts/bangun-manifest.js` dan `scripts/ekspor-situs.js`.
- **CI/CD & Linter:** Belum ada pipeline GitHub Actions / automated CI terkonfigurasi. Pengujian sebagian besar berupa script Node.js lokal (`scripts/uji/`, `scripts/verify_engine.js`, `scripts/verify_phase4_5.js`).

---

## B. INVENTARIS DATABASE (POSTGRESQL / SUPABASE / PGLITE)

### 1. Sumber Skema & Migrasi
- **Master Seed SQL:** `ava-platform/database.sql` (3.006 baris, ~1.66 MB) memuat ~530+ tes katalog laboratorium, reference ranges, dan master data produk (`public.products:9-100+`).
- **Migrasi Berversi:** `db/migrations/` memuat 20 file migrasi berurutan (`0001_auth_lokal.sql` s/d `0020_bekukan_tarif_rujukan.sql`):
  - `0001_auth_lokal.sql`: Autentikasi lokal & session.
  - `0002_ava_health.sql`: Poliklinik & tindakan medis dasar.
  - `0003_rbac.sql`: Definisi peran pengguna & hak akses menu.
  - `0004_tenancy.sql`: Tabel `public.tenants` & fungsi `current_tenant_id()`.
  - `0006_sync_outbox.sql`: Tabel antrian outbox sinkronisasi offline-to-cloud.
  - `0008_satusehat.sql`: Pemetaan SATUSEHAT & FHIR resources.
  - `0010_agentic_canvas.sql`: Manajemen workflow agentic & prompt runs.
  - `0011_ar_aging_tat.sql` s/d `0020_bekukan_tarif_rujukan.sql`: Fitur keuangan, penawaran, portal akses, dan perujuk.

### 2. Status Data: Live vs Dummy
- **Data Live / Nyata:**
  - Katalog Tes & Reference Ranges: `public.products`, `public.reference_ranges` (530+ baris terstandarisasi yang sedang dipakai operasional AVA/AVA Lab).
  - Standar Acuan & Validasi: `data/catalog/catalog_generic.csv`, `data/qms_registry_synced.json`.
- **Data Demo / Transaksional Dummy:**
  - Sebagian rekam medis pasien di lingkungan dev (`public.patients`, `public.orders`, `public.invoices`) berupa data sintetis pengujian lokal.

### 3. Kesenjangan Skema Kunci terhadap Blueprint V5.1 (ADR-01 s/d ADR-08)
- **Primary Keys:** Sebagian tabel memakai UUID (`db/migrations/0004_tenancy.sql:14`), namun sebagian tabel legacy masih menggunakan integer auto-increment (`serial`/`bigserial`). Belum ada implementasi UUID v7 terstandarisasi.
- **Isolasi Tenancy & 9 Kolom Wajib (Bab 16.2 Blueprint):**
  - Kolom `tenant_id` baru ditanam pada tabel `local_auth_users` dan `user_profiles` (`0004_tenancy.sql:31-43`), namun belum ada di tabel transaksional operasional (`orders`, `samples`, `examinations`, `invoices`).
  - Belum ada 9 kolom wajib di setiap tabel: `id`, `tenant_id`, `brand_code`, `cost_center_code`, `kbli_code`, `created_at`, `created_by`, `updated_at`, `is_deleted`.
- **Row Level Security (RLS):** RLS sudah didefinisikan sebagian pada modul portal, namun belum dipaksakan secara universal di seluruh tabel PostgreSQL/PGlite.
- **Audit Trail Immutability:** Audit logger ada di `js/core/auditLogger.js`, namun belum menggunakan immutable append-only dengan cryptographic hash chain di tingkat tabel basis data.

---

## C. INVENTARIS FUNGSIONAL & ALUR

### 1. Modul Berfungsi Penuh (Fully Functional)
- **Operasional Lab & LIS:** `modules/lab/` (Check-in, Registrasi Sampel, Input Hasil, Validasi Hasil, Reference Range Viewer, Cetak PDF).
- **Master Katalog & LIS Exporter:** `lib/exporter/lis_exporter.js`, `lib/validator/catalog_validator.js`.
- **Offline PGlite Database Sync:** `desktop-app/src/`, `0006_sync_outbox.sql`.
- **Auth & Role Switcher:** `js/auth.js`, `db/migrations/0003_rbac.sql`.
- **SATUSEHAT FHIR Transformer:** `js/core/fhirConverter.js`, `modules/compliance/satusehat.js`.

### 2. Modul Ada tapi Setengah Jadi / Mock Data
- **AVA Sanctuary (Spa & Wellness):** `modules/business_units/sanctuary_booking.js` (UI booking tersedia, namun integrasi pemisahan tindakan medis vs spa `is_medical_procedure` belum dihubungkan ke supervisi dokter).
- **AVA Nutrition (Pabrik / FMCG Maklon):** `nutri.html` & `modules/business_units/ecommerce_oms.js` (Katalog D2C siap, namun tracking batch CPOTB/CPPOB maklon masih mock/statis).
- **Holding Finance & Konsolidasi:** `modules/finance/holding_finance.js` (Visualisasi cockpit tersedia, namun belum otomatis menarik jurnal eliminasi transaksi antar-brand).
- **Kiosk Antrian:** `kiosk/` & `monitor/antrian.html` (Tersedia antarmuka layar sentuh, namun sinkronisasi nomor loket dengan poli EMR belum sepenuhnya bi-directional real-time).

### 3. Kode Yatim & Rute Flat
- `js/core/router.js:5-42` mendefinisikan 40+ rute flat (`marketing`, `voucher`, `mou`, `cashier`, `admission`, `bpjs-claim`, `surat`). Banyak rute yang berpotensi tabrakan domain dan belum mengikuti konvensi 3 segmen `unit/domain/fitur` (ADR-05).

---

## D. INVENTARIS INTEGRASI & KEAMANAN

### 1. Integrasi Eksternal
- **AI Gateway Multi-Provider:** `js/core/aiGateway.js` & `lib/llm/llm_adapter.js` (Mendukung Google Gemini, Groq, OpenAI, Ollama).
- **Kemenkes SATUSEHAT:** `js/core/fhirConverter.js` (Transformasi JSON FHIR R4: Patient, Encounter, Condition, Observation, Specimen).
- **BPJS Kesehatan:** `js/core/bpjsBridge.js` (Simulasi jembatan VClaim).
- **Alat Lab (Analyzer):** `connector/ava-connector.js` & `connector/ava-connector.js` (Penerima koneksi RS-232 / TCP-IP untuk parsing ASTM/HL7 LIS).
- **Hardware Periferal:** `js/core/barcode.js`, `js/core/escposPrinter.js` (Thermal printing struk & barcode tabung spesimen).

### 2. Temuan Keamanan Kredensial
- ⚠️ **Kredensial API Key Ditemukan di File Teks Workspace:**
  - `ava-platform/.env:7-8` memuat API Key Google Gemini aktif.
  - `ava-platform/.env:20` memuat publishable key Supabase.
  - `ava-platform/js/config.local.js:8-9` memuat salinan API Key Gemini.
  - `desktop-app/LOGIN_ADMIN_PERTAMA.txt:1-5` memuat kredensial default admin lokal.

---

## E. TEMUAN RISIKO & KATEGORISASI

| Tingkat Bahaya | Temuan & Lokasi | Dampak | Rekomendasi Mitigasi |
|---|---|---|---|
| 🚨 **KRITIS** | Kredensial API Key tersimpan plaintext di `.env` dan `config.local.js` (`ava-platform/.env:7-20`). | Risiko penyalahgunaan kuota AI dan akses cloud database bila terekspos publik. | Pindahkan API key ke environment variable runtime / secret manager dan pastikan `.env` tidak pernah ter-commit. |
| 🚨 **KRITIS** | Belum ada isolasi data medis antar-unit (ADR-07 belum dipaksakan di data layer). | Modul non-klinis secara teknis masih dapat query langsung ke tabel pasien/order jika tidak dibatasi RLS. | Terapkan RLS dan filter view K4 di PostgreSQL, gunakan event payload outbox tanpa nilai medis untuk non-klinis. |
| ⚠️ **TINGGI** | Belum ada dimensi `brand_code`, `kbli_code`, `cost_center_code` di tabel transaksi. | Laporan keuangan holding dan segmentasi 6 brand tidak bisa dikonsolidasi secara otomatis per KBLI. | Tambahkan 9 kolom wajib di Fase 0 melalui migrasi skema expand yang non-destruktif. |
| ⚠️ **TINGGI** | Penamaan route masih flat (`router.js:5-42`), memicu duplikasi logika di berbagai modul. | Kesulitan pemeliharaan RBAC granular dan audit trail per domain bisnis. | Migrasikan rute ke konvensi 3 segmen `unit/domain/fitur` secara bertahap via Strangler Fig. |
| 🟡 **SEDANG** | Tabel audit log (`auditLogger.js`) belum immutable & belum ada hash-chaining di DB. | Tidak memenuhi standar forensik ISO 15189:2022 klausul audit trail & UU PDP. | Bangun tabel `audit_trail` append-only dengan hash chain `sha256(prev_hash + payload)`. |
| 🔵 **RENDAH** | String identitas "AVA" masih tersebar di beberapa komentar dan label UI. | Inkonsistensi branding terhadap AVA Global Ecosystem. | Ekstrak konstanta branding ke `tenant.config` terpusat. |

---

## F. DAFTAR PERTANYAAN & CHECKPOINT (GATE 0)

1. **Status Kredensial Supabase Production:** Apakah proyek Supabase `https://mrmymstxnhffomubtpyo.supabase.co` (`ava-platform/.env:19`) saat ini berisi data pasien live aktif, atau hanya environment staging/dev?
2. **Prioritas Modul Bisnis Unit:** Apakah setelah fondasi Fase 0 selesai, migrasi diarahkan terlebih dahulu ke AVA Lab + AVA Health (klinik & lab), atau paralel dengan modul AVA Nutrition & Sanctuary?

---
🛑 **GATE 0 REACHED: Audit Tahap 0 selesai dalam mode read-only. Tidak ada kode produksi yang diubah.**  
**Menunggu persetujuan manusia untuk melangkah ke Tahap 1 (Gap Register).**
