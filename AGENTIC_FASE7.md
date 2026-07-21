# AGENTIC — FASE 7 : Panduan Implementasi Lengkap
### Departemenisasi (Service Assurance & Marketing) · Konfig AI di web · Audit/CAPA · Perakit .docx

Dokumen ini adalah panduan **implementasi & pemakaian** Fase 7 (7 · 7B · 7C · 7D).
Ikuti berurutan dari atas. Bagian 1–3 = pasang. Bagian 4 = pakai. Bagian 5 = referensi.
Bagian 6 = yang masih perlu Anda kerjakan.

---

## 0. Ringkasan — apa yang berubah

Organisasi agent naik dari **flat** (HEAD → semua organ) menjadi **3 lapis**
(HEAD → Kepala Departemen → anggota). Peran QA lama menjadi **gerbang mutu** di
dalam departemennya.

```
👑 CEO (Anda)
└── 👔 HEAD  (Chief of Staff — mengambil keputusan sesuai Matriks Mandat)
    ├── 🧪 SERVICE ASSURANCE — SA_HEAD (Manajer Mutu)
    │     ├── 📚 SA_DOC    Document Controller (kendali dokumen L1–L4)
    │     ├── 🔍 SA_AUDIT  Auditor Mutu Internal
    │     ├── 📜 SA_REG    Regulatory & Compliance Watch
    │     ├── 🛠️ SA_CAPA   CAPA & Manajemen Risiko
    │     └── ✅ QA_MUTU   Gerbang Mutu (penilai dokumen)
    ├── ✍️ MARKETING — MKT_HEAD (Kepala Marketing)
    │     ├── 🔑 MKT_SEO     SEO & Content Strategist
    │     ├── 📝 MKT_COPY    Copywriter
    │     ├── 🎨 MKT_DESIGN  Designer / Creative
    │     ├── 📣 MKT_SOCIAL  Social & Community
    │     └── ✅ QA_KONTEN   Gerbang Konten (penilai konten)
    ├── 🖥️ IT PROFESIONAL — IT_HEAD (Manajer IT)
    │     ├── 🛎️ IT_SRE    Site Reliability / Ops
    │     ├── 🔐 IT_SEC    Keamanan Informasi
    │     ├── 🗄️ IT_DATA   Data & LIS / Integrasi
    │     └── ⚙️ IT_DEV    Pengembangan & Otomasi (self-heal prompt)
    └── 📋 TEAM_OPS · 🚚 LOGISTIK (lintas-fungsi, lapor ke HEAD)
```

Tambahan besar lain:
- **Konfig AI di web** — set model/API/video dari tab Organisasi tanpa re-deploy.
- **Audit internal + CAPA** terstruktur.
- **Mesin perakit `.docx`** — dokumen resmi dengan format 100% identik master.

---

## 1. Prasyarat

- Fase 0–6c **sudah terpasang** (tabel `agentic.*`, `agentic-worker`, `llm-gateway`).
- Akses ke **Supabase SQL Editor** dan **Edge Functions** (deploy).
- Bucket Storage **`agentic`** aktif (dari Fase 12) — dipakai upload master `.docx`.

Semua SQL Fase 7 **idempoten** (aman dijalankan ulang).

---

## 2. Deploy — urutan WAJIB

Jalankan **berurutan**. Jangan lewati langkah.

### 2.1 SQL (Supabase → SQL Editor)
| Urutan | File | Isi |
|---|---|---|
| 1 | `supabase_agentic_fase7.sql` | Organ departemen, kolom `department`, registry template, channel_specs, decision_rights, prompt, RPC |
| 2 | `supabase_agentic_fase7b.sql` | Tabel `ai_config` + RPC konfig (map = service_role saja) |
| 3 | `supabase_agentic_fase7c.sql` | Tabel `audit_findings` + `capa` + RPC + prompt audit/CAPA |
| 4 | `supabase_agentic_frameworks.sql` | Seed checklist **Akreditasi Klinik** (fokus lab) + **ISO 9001:2015** (melengkapi ISO 15189 yang sudah ada) |
| 5 | `supabase_agentic_fase7f_it.sql` | **Departemen IT Profesional** (IT_SRE·IT_SEC·IT_DATA·IT_DEV) + task `IT_SEC_AUDIT` + RPC postur keamanan |
| 6 | `supabase_agentic_fase7j_scm.sql` | **Departemen Supply Chain** (aktifkan LOGISTIK: SCM_STOCK·SCM_PO) + RPC `agentic_scm_scan` + task SCM_TICK/STOCK_WATCH/PO_DRAFT |
| 7 | `supabase_agentic_fase7i_hr.sql` | **Departemen People & Credentialing** (HR_CRED·HR_ROSTER) + tabel `staff_credentials` + RPC scan/CRUD + task HR_TICK/CRED_WATCH |
| 8 | `supabase_agentic_fase7g_it.sql` | **Perluasan IT** — `INTEGRATION_HEALTH` (sampel tertahan + analyzer diam) & `BACKUP_VERIFY` (tabel `agentic.backup_log` + kesegaran pg_dump) |
| 9 | `supabase_agentic_fase7h_lab.sql` | **Departemen Lab Operations Assurance** (LAB_QC·LAB_TAT·LAB_CRIT) + RPC `agentic_lab_scan` + task LAB_TICK/QC_WATCH/TAT_MONITOR/CRITICAL_WATCH |
| 10 | `supabase_agentic_fase7k_cleanup.sql` | **Clear-up** — aktifkan task reserved (MASTER_LIST/DOC_DISTRIBUTE/DOC_OBSOLETE/PLAN_CAMPAIGN/ROSTER_CHECK), hapus IT_BACKUP_CHECK usang, **wire video** (MAKE_VIDEO) |
| 11 | `supabase_agentic_fase7l_bizops.sql` | **4 departemen Biz-Ops** — Finance (AR/leak/recon), Growth/CRM (lead/deal/MOU), CX (keluhan+feedback, buat tabel `complaints`/`customer_feedback`), Executive Digest |
| 12 | `supabase_agentic_fase7m_clinical.sql` | **Pharmacy** (kedaluwarsa FEFO · warning di-override · register narkotika) + **Inpatient** (okupansi · LOS · charge nol) — flag-only, klinis=manusia |
| 13 | `supabase_agentic_fase8a_insight.sql` | **Horizon 1: Predictive Intelligence** (INSIGHT) — prediksi stockout (stok/laju vs lead time), tren kunjungan/pendapatan, risiko penagihan. Advisory (R1). |

Setiap file harus berakhir dengan pesan `... siap ...`. Bila error, hentikan dan
perbaiki sebelum lanjut file berikutnya.

### 2.2 Edge Functions (re-deploy)
| Fungsi | Kenapa |
|---|---|
| `agentic-worker` | Handler baru: SA/MKT tick, carousel, SEO, blog, brief, audit, CAPA |
| `llm-gateway` | Kini baca setelan dari DB (Konfig AI) + `mode:'video'` |

### 2.3 UI (tanpa build)
Refresh browser. File berikut sudah berisi semua perubahan UI:
`modules/agentic/org.js`, `modules/agentic/docs.js`, `modules/agentic/docxfill.js`
(dimuat via `index.html`).

### 2.4 Cron (opsional, disarankan)
Di SQL Editor tambahkan (ganti `<PROJECT>` & `<SERVICE_ROLE_KEY>` — lihat blok
`§CRON DEPARTEMEN` di akhir `supabase_agentic_fase7.sql`):
```sql
select cron.schedule('agentic-sa-tick','*/30 * * * *',  $$ select public.agentic_org_kick('SA_TICK'); $$);
select cron.schedule('agentic-mkt-tick','15,45 * * * *', $$ select public.agentic_org_kick('MKT_TICK'); $$);
```

---

## 3. Verifikasi pasca-deploy (checklist)

Buka **Agentic AI → tab Organisasi**:
- [ ] Struktur tampil **3 lapis** (dua kartu departemen berisi kepala + anggota).
- [ ] Ada tombol **🧪 Patroli Mutu** & **✍️ Patroli Marketing** di header.
- [ ] Panel **📐 Template Dokumen Resmi** muncul.
- [ ] Panel **⚙️ Konfigurasi AI** muncul dan menampilkan daftar setelan.

Tab **Compliance**:
- [ ] Panel **🔍 Audit Internal & CAPA** muncul di bawah checklist klausul.

Uji cepat:
- [ ] Klik **Patroli Mutu** → toast "Service Assurance ditugaskan"; setelah worker jalan,
  muncul pesan patroli di kotak pesan HEAD.
- [ ] Konfig AI → ubah satu nilai non-rahasia (mis. model) → **Simpan** → toast sukses.

> Kalau panel bertuliskan "Jalankan supabase_agentic_fase7X.sql" → SQL terkait belum
> dijalankan. Kalau video/model tak berubah → `llm-gateway` belum di-redeploy.

---

## 4. Cara memakai tiap komponen

### 4.1 Departemen Service Assurance

**Patroli otomatis (SA_TICK)** — via tombol *Patroli Mutu* atau cron. Yang dilakukan:
1. Dokumen **jatuh tempo review** → dibuatkan task perbaikan.
2. Klausul **wajib tanpa dokumen** → dibuatkan `DOC_GENERATE` (maks 3 per tick).
3. Melapor gap & kombinasi jenis/level yang **belum punya template master**.

**Audit internal (AUDIT_EXECUTE)** — tab Compliance → panel Audit → **Jalankan Audit
Internal** → isi area (mis. "Pra-analitik"). Hasil: temuan NC (MAYOR/MINOR/OBSERVASI)
tersimpan; temuan MAYOR/MINOR **otomatis** memicu CAPA.

**CAPA** — tabel CAPA di panel yang sama; ubah status lewat dropdown
(OPEN → IN_PROGRESS → VERIFICATION → CLOSED).

**Analisis lain:** `AUDIT_PLAN` (rencana audit tahunan) & `REG_WATCH` (analisis
kepatuhan) menghasilkan draft markdown.

**Framework kepatuhan (checklist).** Semula hanya **ISO 15189:2022**. Dengan
`supabase_agentic_frameworks.sql` kini juga mencakup **Akreditasi Klinik** (Bab TKK ·
PMKP · PPK, dengan blok **PPK-LAB** khusus pelayanan laboratorium) dan **ISO 9001:2015**.
Gap analysis, compliance score, dan patroli SA otomatis membaca ketiganya. Di tab
**Compliance** ada **filter Framework** pada tabel checklist, dan kartu skor kini
berlabel framework. *Catatan: kode Elemen Penilaian (EP) Akreditasi Klinik memakai
pengelompokan standar; sesuaikan `clause_ref` ke nomor EP resmi Kepdirjen bila perlu
untuk berkas survei.*

### 4.2 Departemen Marketing

Alur produksi konten (bisa dirantai):
```
CONTENT_ANALYSIS  →  MAKE_CAROUSEL / MAKE_BLOG_SEO
 (topik → brief)      (brief → slide+gambar / artikel SEO)
```
- **CONTENT_ANALYSIS** — topik → brief (angle, kanal, format, jumlah slide, kata kunci
  SEO, risiko medis). Set payload `auto_produce:true` → langsung antre carousel bila non-medis.
- **MAKE_CAROUSEL** — brief → N slide (copy per slide) + **N gambar berdimensi kanal**
  (lihat tabel kanal di §5.4). Dibatasi maks 6 gambar/task (anggaran waktu).
- **SEO_RESEARCH → MAKE_BLOG_SEO** — riset kata kunci → artikel blog 800–1200 kata +
  judul/meta/heading + sitasi.
- **MAKE_DESIGN_BRIEF** — konten → brief kreatif; opsi auto-antre carousel.
- **MKT_TICK** (tombol *Patroli Marketing*/cron) — jaga kalender 14 hari terisi;
  bila tipis → buat `PLAN_WEEKLY`.

### 4.2a Departemen Lab Operations Assurance (Fase 7H) — CORE

Departemen **LAB_OPS** (LAB_HEAD → LAB_QC · LAB_TAT · LAB_CRIT). Membaca `lab_qc_runs`,
`lab_results`, `lab_samples` nyata.
- **LAB_TICK** (kartu dept Lab Operations → *Patroli*, atau cron): pindai sekaligus —
  QC menyimpang, nilai kritis belum dirilis, sampel lewat TAT → laporan + **ALERT** ke CEO
  bila ada QC **REJECT** atau **nilai kritis** belum dirilis.
- **QC_WATCH**: `lab_qc_runs` verdict Warning/REJECT (Westgard). REJECT = hasil pada rentang
  itu mungkin tak valid → tahan rilis & ulang QC. Kait PMI/PME (ISO 15189 §7.3.5-6).
- **CRITICAL_WATCH**: hasil interpretasi **Kritis** yang **belum `Released`** → keselamatan
  pasien; ALERT agar segera diverifikasi & dikomunikasikan.
- **TAT_MONITOR**: sampel `Pending`/`In Process` >24 jam sejak diterima.
- **GUARDRAIL KLINIS:** agent hanya **memantau & flag**. Verifikasi, rilis hasil, dan
  komunikasi nilai kritis **SELALU manusia** — agent tidak pernah mengubah `lab_results`.
- Cron opsional: `select cron.schedule('agentic-lab-tick','*/20 * * * *', $$ select public.agentic_org_kick('LAB_TICK'); $$);`

### 4.2b Departemen IT Profesional

Kepala IT (`IT_HEAD`) memimpin: **IT_SRE** (keandalan), **IT_SEC** (keamanan),
**IT_DATA** (data & LIS), **IT_DEV** (otomasi & self-heal prompt). Tugas otomatis:
- **IT_CHECK** (tombol *IT Check* / kartu dept IT → *Patroli*, atau cron 6 jam) — diag
  jalur AI, bebaskan task macet, dan **self-heal prompt** (Fase 6C, bisa di-rollback).
- **IT_SEC_AUDIT** (tombol **🔐 Audit Keamanan**) — audit postur keamanan berbasis data
  nyata: kunci/secret belum diset, task auto-publish tanpa QA, task macet, kegagalan 7 hari,
  dan **konten medis yang ter-auto** (harus 0 — kalau >0 ditandai KRITIS + ALERT ke CEO).
  **Nilai secret tidak pernah ditampilkan** — hanya status terisi/kosong.
**Perluasan IT (Fase 7G):**
- **🔌 Cek Integrasi** (`INTEGRATION_HEALTH`, tombol header): deteksi sampel tertahan
  `In Process` >6 jam (hasil tak masuk) + analyzer **terintegrasi & aktif** yang tak mengirim
  hasil auto (integrasi mungkin putus) → ALERT ke CEO. Baca `lab_samples`/`lab_results`/`analyzers`.
- **💾 Cek Backup** (`BACKUP_VERIFY`, tombol header): verifikasi kesegaran backup via
  `agentic.backup_log`. **Wajib:** skrip pg_dump Anda mencatat tiap dump ke
  `agentic_backup_log_add` (snippet curl di §CRON `supabase_agentic_fase7g_it.sql`). Backup basi
  (>26 jam) / tak ada catatan / gagal → ALERT. Kalau belum mencatat, agent menandai "tidak ada
  catatan backup" sebagai temuan.

### 4.2c Departemen Supply Chain (Fase 7J)

LOGISTIK kini aktif sebagai **Kepala Supply Chain** memimpin **SCM_STOCK** (pengawas stok
& FEFO) dan **SCM_PO** (draft pengadaan). Membaca inventory nyata (`inventory_items`,
`inventory_batches`, `suppliers`).
- **SCM_TICK** (kartu dept Supply Chain → *Patroli*, atau cron): scan item di bawah reorder
  point + batch mendekati/melewati kedaluwarsa (FEFO) → laporan; item menipis → antre
  **PO_DRAFT**; kirim **ALERT** ke CEO bila ada stok habis / kedaluwarsa masih bertumpuk.
- **STOCK_WATCH**: laporan stok/kedaluwarsa on-demand (detail).
- **PO_DRAFT**: draft usulan pembelian per pemasok (jumlah dari `suggested_qty`, harga
  `[[KONFIRMASI]]` bila 0) → dikirim ke CEO. **Guardrail: pembelian/PR resmi = manusia**;
  agent tidak pernah menyentuh `purchase_requests` atau transaksi.
- Cron opsional: `select cron.schedule('agentic-scm-tick','0 */4 * * *', $$ select public.agentic_org_kick('SCM_TICK'); $$);`

### 4.2d Departemen People & Credentialing (Fase 7I)

Departemen **PEOPLE** (HR_HEAD → HR_CRED, HR_ROSTER). Membuat tabel `public.staff_credentials`.
- **Input data:** tab Organisasi → panel **🪪 Kredensial Nakes** → **Tambah**: nama, profesi,
  jenis (STR/SIP/sertifikat), nomor, tanggal terbit & **kedaluwarsa**, penerbit.
- **HR_TICK** (panel → *Patroli Kredensial*, atau cron): pindai STR/SIP/sertifikat →
  **KEDALUWARSA** (ALERT ke CEO) & **≤90 hari** (INFO). Langsung menyuplai Akreditasi Klinik
  (TKK kredensial) & ISO 15189 §6.2.
- **CRED_WATCH**: laporan on-demand.
- Tabel juga menandai kredensial **tanpa tanggal kedaluwarsa** untuk dilengkapi.
- Guardrail: agent hanya memantau & mengingatkan; keputusan SDM = manusia.
- (HR_ROSTER: reserved — deteksi anomali absensi menyusul.)
- Cron opsional: `select cron.schedule('agentic-hr-tick','0 8 * * *', $$ select public.agentic_org_kick('HR_TICK'); $$);`

### 4.2e Biz-Ops: Finance · Growth/CRM · CX · Executive (Fase 7L)

Empat departemen advisory (semua **flag/draft — tanpa transaksi/kirim oleh agent**).
- 💰 **Finance** (`FIN_TICK`): aging piutang (0-30/31-60/61-90/>90) dari `invoices`, invoice
  Draft mengendap (bocor), selisih kas `cashier_shifts`. Sub: `AR_AGING`·`REV_LEAK`·`RECON`.
- 🤝 **Growth & CRM** (`GROWTH_TICK`): follow-up lewat tempo & skoring (`leads`), deal mandek
  (ambang `idle_days` per tahap `crm_pipeline_stages`), **MOU akan berakhir ≤60 hari** (`mous`).
- 💬 **Customer Experience** (`CX_TICK`): panel **💬 Keluhan Pelanggan** (tab Organisasi) untuk
  input keluhan; `COMPLAINT_TRIAGE` mengklasifikasi + **draft respons** (keluhan hasil/klinis →
  tandai perlu verifikasi manusia); `FEEDBACK_SUMMARY` ringkas NPS. Membuat tabel
  `complaints` & `customer_feedback`. ISO 15189 §7.7.
- 📊 **Executive Digest** (tombol **📊 Digest Eksekutif**): satu ringkasan lintas-domain untuk
  CEO — mutu, lab, stok, kredensial, piutang, keluhan, kontrak, backup. (TEAM_OPS diaktifkan.)
- Cron opsional: `FIN_TICK`/`GROWTH_TICK`/`CX_TICK` tiap 4-6 jam; `EXEC_DIGEST` pagi hari.

### 4.3 Konfig AI (tab Organisasi → ⚙️ Konfigurasi AI)

Set model/API langsung dari web. **Kosongkan** nilai = pakai Secret/env lama.
Perubahan berlaku di **panggilan AI berikutnya** (tanpa re-deploy).

| Key | Kategori | Fungsi |
|---|---|---|
| `NVIDIA_API_KEYS` 🔒 | NVIDIA | Kunci API (pisah koma). Rahasia — tak ditampilkan balik. |
| `NVIDIA_MODEL_MAIN` | NVIDIA | Model teks berat (task utama). |
| `NVIDIA_MODEL_LIGHT` | NVIDIA | Model teks cepat (QA/terjemah). |
| `NVIDIA_IMAGE_MODEL` | Gambar | Model gambar prioritas (koma). |
| `NVIDIA_VIDEO_MODEL` | Video | Model text-to-video (kosong = video mati). |
| `VIDEO_ENABLED` | Video | `true`/`false`. |
| `GEMINI_API_KEYS` 🔒 | Gemini | Kunci fallback teks + pembaca PDF. |
| `GEMINI_MODEL` | Gemini | Model Gemini. |
| `IMAGE_FILTER_STRICT` | Lanjut | `true` = tolak prompt gambar berisiko. |
| `LLM_RATE_LIMIT_PER_KEY_PER_MIN` | Lanjut | Batas request/kunci/menit. |

> **Keamanan:** nilai 🔒 hanya dibaca `llm-gateway` (service_role) via
> `agentic_config_map`; UI (anon) tak pernah bisa membacanya kembali.

### 4.4 Template Dokumen + Perakit .docx (fidelity 100%)

Inti fitur Service Assurance. Langkah pemakaian:

**a. Siapkan master `.docx`.** Buat file Word **persis** dokumen resmi Anda (kop,
header, footer, font, ukuran, margin, spasi, penomoran — semua final). Di posisi isi
yang berubah, tulis token, contoh:
```
Judul       : {{JUDUL}}
No. Dokumen : {{NO_DOKUMEN}}
Tujuan      : {{TUJUAN}}
Prosedur    : {{PROSEDUR}}
```
Aturan penulisan token (penting agar terbaca engine):
- Pakai **kurung ganda** `{{NAMA}}`, huruf besar + garis bawah.
- Ketik tiap token **dalam sekali ketik** (jangan pindah kursor di tengah `{{` atau `}}`).
  Nama di dalamnya boleh terpecah antar-run — engine tahan itu; yang tak boleh hanya
  `{{` / `}}`-nya sendiri yang terbelah.
- **Matikan autocorrect / smart-quotes** di Word saat mengetik token.
- Token boleh diletakkan di **header/footer** juga.
- **Belum didukung:** baris tabel berulang/loop (mis. daftar langkah dinamis). Bila
  butuh, minta penambahan dukungan loop.

**b. Daftarkan template.** Tab Organisasi → panel Template → **Tambah Template**:
pilih **Level (L1–L4)** & **Jenis** (SOP/IK/FORM/…), unggah **master `.docx`**, isi
**Daftar placeholder** (satu per baris), opsional isi spesifikasi format & unggah
**contoh dokumen jadi** (referensi).

**c. Uji.** Klik **⬇ Tes Rakit .docx** pada baris template → sistem mengisi tiap
`{{…}}` dengan `[CONTOH: nama]` lalu **mengunduh** hasilnya. Buka di Word: header,
footer, font, margin, spasi harus **identik master**, hanya isi token yang berubah.
Jika ya → master Anda valid dan siap dipakai generator.

> Engine inti: `agDocxFill(masterArrayBuffer, {KEY:value})` di
> `modules/agentic/docxfill.js` (sudah diuji round-trip otomatis: placeholder normal &
> terpecah antar-run, header/footer, dan entri biner utuh).

### 4.5 Video (opsional)

1. Konfig AI → isi `NVIDIA_VIDEO_MODEL` (model text-to-video aktif di akun NVIDIA) +
   `VIDEO_ENABLED=true`.
2. Gateway menerima `POST {mode:'video', prompt}` lewat endpoint NVIDIA yang sama dengan
   gambar (genai + antrian NVCF).
3. Video long-running (menit) vs Edge Function ±150 dtk → bila model lambat >110 dtk,
   gateway membalas **rapi** `{pending:true, reqId}` (HTTP 504), bukan menggantung.
   Untuk produksi video penuh perlu pola **background job** (belum di-wire ke task konten).

---

## 5. Referensi

### 5.1 File yang ditamb/diubah
| File | Peran |
|---|---|
| `supabase_agentic_fase7.sql` | Organ departemen, template registry, channel_specs, decision_rights, prompt, RPC |
| `supabase_agentic_fase7b.sql` | `ai_config` + RPC konfig |
| `supabase_agentic_fase7c.sql` | `audit_findings` + `capa` + RPC + prompt |
| `supabase/functions/agentic-worker/index.ts` | Handler task baru (§5.3) |
| `supabase/functions/llm-gateway/index.ts` | Baca Konfig AI dari DB + `mode:'video'` |
| `modules/agentic/org.js` | Render pohon 3 lapis, panel Template & Konfig AI, tombol patroli |
| `modules/agentic/docs.js` | Panel Audit & CAPA di tab Compliance |
| `modules/agentic/docxfill.js` | **Baru** — mesin perakit `.docx` |
| `index.html` | Memuat `docxfill.js` |

### 5.2 Tabel DB baru
`agentic.doc_templates` · `agentic.channel_specs` · `agentic.ai_config` ·
`agentic.audit_findings` · `agentic.capa` · kolom `agentic.agents.department` ·
`content_assets.asset_type` +`CAROUSEL` +`VIDEO`.

### 5.3 Task type — pemilik, mandat, handler
| task_type | Dept | Mandat | Handler? |
|---|---|---|---|
| `SA_TICK` | SA | R1 log | ✅ |
| `AUDIT_PLAN` | SA | R2 · QA_MUTU 70 | ✅ |
| `AUDIT_EXECUTE` | SA | R2 · QA_MUTU 75 | ✅ (→ auto CAPA) |
| `CAPA_TRACK` | SA | R2 · QA_MUTU 70 | ✅ |
| `REG_WATCH` | SA | R1 log | ✅ |
| `DOC_DISTRIBUTE` | SA | R1 log | ⏳ reserved (handler menyusul) |
| `DOC_OBSOLETE` | SA | R2 | ⏳ reserved |
| `MASTER_LIST` | SA | R1 log | ⏳ reserved |
| `MKT_TICK` | MKT | R1 log | ✅ |
| `CONTENT_ANALYSIS` | MKT | R1 log | ✅ |
| `MAKE_CAROUSEL` | MKT | R1 · QA_KONTEN 75 | ✅ |
| `SEO_RESEARCH` | MKT | R1 log | ✅ |
| `MAKE_BLOG_SEO` | MKT | R2 · QA_KONTEN 80 | ✅ |
| `MAKE_DESIGN_BRIEF` | MKT | R1 log | ✅ |
| `PLAN_CAMPAIGN` | MKT | R2 · QA_KONTEN 70 | ✅ (tombol Rencana Kampanye) |
| `MASTER_LIST` · `DOC_DISTRIBUTE` · `DOC_OBSOLETE` | SA | R1 | ✅ (7K — auto via SA_TICK / tombol Daftar Induk) |
| `ROSTER_CHECK` | People | R1 | ✅ (7K — auto via HR_TICK, baca `attendance`) |
| `MAKE_VIDEO` | MKT | R2 · QA_KONTEN 75 | ✅ (7K — tombol Buat Video; render aktif bila VIDEO_ENABLED+model) |
| `IT_CHECK` | IT | R1 log | ✅ (diag + reaper + self-heal) |
| `IT_SEC_AUDIT` | IT | R1 log | ✅ (audit postur keamanan) |
| `INTEGRATION_HEALTH` · `BACKUP_VERIFY` | IT | R1 | ✅ (7G) |

> "⏳ reserved" = sudah ada di Matriks Mandat (terlihat di UI) tapi **belum ada handler**;
> jangan dibuat manual dulu — akan `FAILED` "handler belum diimplementasikan". Tidak ada
> patroli yang membuatnya otomatis, jadi aman.

### 5.4 Dimensi gambar per kanal (`agentic.channel_specs`)
| Kode | Kanal | Ukuran | Rasio |
|---|---|---|---|
| `IG_FEED` | Instagram Feed | 1080×1350 | 4:5 |
| `IG_SQUARE` | Instagram Kotak | 1080×1080 | 1:1 |
| `IG_STORY` | Story (IG/FB) | 1080×1920 | 9:16 |
| `TIKTOK` | TikTok | 1080×1920 | 9:16 |
| `WA` | WhatsApp | 1080×1080 | 1:1 |
| `FB_FEED` | Facebook Feed | 1200×1500 | 4:5 |
| `YT_THUMB` | YouTube Thumb | 1280×720 | 16:9 |

### 5.5 Catatan mandat (keamanan konten)
- `MAKE_CAROUSEL` = R1 (mandat penuh HEAD, gerbang QA_KONTEN ≥75).
- `MAKE_BLOG_SEO` = R2 (HEAD menyetujui, **publish tetap CEO**). Artikel terdeteksi
  `needs_medical_review` → publish manual Anda + gerbang QA_KONTEN ≥80.
- Konten klaim medis **selalu** jalur manusia, apa pun matriksnya.

---

## 6. Yang MASIH perlu Anda kerjakan (untuk menyempurnakan)

Jembatan `.docx` dan video **sudah dibangun** (Fase 7K/7D). Yang tersisa = **input Anda**:

1. **Master `.docx`.** Jembatan isi→placeholder **sudah jalan**: di **Dokumen QMS** tiap
   dokumen ber-isi punya tombol **🧩 .docx** yang mengambil template master (per level/jenis),
   memetakan isi ke placeholder via LLM, lalu mengunduh `.docx` final **berformat identik master**.
   Anda tinggal **unggah master `.docx` bertoken `{{…}}`** (tab Organisasi → Template). Tanpa
   master, tombol memberi tahu "belum ada master untuk level/jenis ini".

2. **Video.** Pipeline **sudah di-wire**: Content Studio → **🎬 Buat Video** membuat script +
   memanggil `mode:'video'`. Anda tinggal isi **`NVIDIA_VIDEO_MODEL` + `VIDEO_ENABLED=true`**
   (Konfig AI) dengan model text-to-video aktif. Bila belum, task tetap menghasilkan **script**
   (video ditandai "belum dibuat"). Untuk video durasi menit perlu **background job** menyusul.

3. **Backup logging.** `BACKUP_VERIFY` butuh skrip pg_dump Anda mencatat tiap dump ke
   `agentic_backup_log_add` (snippet curl di §CRON `supabase_agentic_fase7g_it.sql`).

3. **Sub-modul SA lanjutan (Fase 7C+).** `DOC_DISTRIBUTE`, `DOC_OBSOLETE`, `MASTER_LIST`,
   `PLAN_CAMPAIGN` masih "reserved". Bila diperlukan, minta implementasi handler-nya.

### Checklist tindakan Anda
- [ ] Deploy 3 SQL berurutan (§2.1) + re-deploy 2 edge function (§2.2).
- [ ] Verifikasi UI (§3).
- [ ] Isi/verifikasi Konfig AI (§4.3).
- [ ] Buat & unggah **minimal 1 master `.docx`** dengan token, lalu **Tes Rakit** (§4.4).
- [ ] Kirim master itu (atau daftar placeholder finalnya) untuk memasang jembatan §6.1(b).
- [ ] (Opsional) isi model video (§4.5).
