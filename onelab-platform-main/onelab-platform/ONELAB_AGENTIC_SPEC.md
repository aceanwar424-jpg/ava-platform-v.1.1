# OneLab Platform — Agentic AI Module
## Spesifikasi Sistem & Skema Database (Build Spec v1.0)

> Dokumen ini adalah build specification untuk di-upload ke Claude Desktop/Claude Code.
> Target: 2 agent pertama — (1) Document Compliance Agent, (2) Content & Branding Agent —
> terintegrasi ke OneLab Platform (SIMRS) existing.

---

## 1. PRINSIP DESAIN (WAJIB DIPATUHI SAAT BUILD)

1. **Human-in-the-loop mutlak**: Tidak ada output AI yang PUBLISHED tanpa approval manusia. Status akhir hanya bisa diubah oleh user dengan role `APPROVER`.
2. **Agent tidak loop bebas**: Semua pekerjaan dipicu oleh (a) cron scheduler, (b) event dari sistem, atau (c) aksi user. Agent tidak memutuskan sendiri kapan bekerja.
3. **Deterministik di luar, LLM di dalam**: Orkestrasi = state machine di PostgreSQL + BullMQ. LLM hanya dipanggil di dalam worker untuk transformasi konten.
4. **Satu pintu ke LLM**: Semua panggilan AI lewat `llm-gateway` service. Tidak ada worker yang memanggil API NVIDIA/Gemini langsung.
5. **Tidak ada PII pasien** yang dikirim ke API eksternal. Kedua agent ini hanya memproses dokumen QMS dan konten marketing — bukan data pasien.
6. **Audit trail penuh**: Setiap transisi status dicatat di `task_events`. Setiap panggilan LLM dicatat di `llm_requests`.
7. **Firewall Isi vs Format**: Saat repair/generate dokumen, referensi dokumen lain HANYA boleh dipakai untuk struktur/format, TIDAK untuk menyalin isi substantif antar jenis dokumen yang tidak terkait.

---

## 2. ARSITEKTUR TINGKAT TINGGI

```
┌─────────────────────────────────────────────────────────────┐
│                    OneLab Platform (existing)                │
│  Modul: Pendaftaran │ LIS │ Billing │ Inventory │ MCU │ ...  │
│  Menu baru: [Dokumen QMS] [Content Studio] [Approval Inbox]  │
└──────────────┬──────────────────────────────────────────────┘
               │ REST API (internal)
┌──────────────▼──────────────────────────────────────────────┐
│              AGENTIC SERVICE (Node.js, service baru)         │
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ API Layer  │  │  Scheduler  │  │   Approval Engine    │  │
│  │ (Express/  │  │  (cron via  │  │  (state machine di   │  │
│  │  NestJS)   │  │   BullMQ)   │  │   PostgreSQL)        │  │
│  └─────┬──────┘  └──────┬──────┘  └──────────┬───────────┘  │
│        │                │                     │              │
│  ┌─────▼────────────────▼─────────────────────▼───────────┐ │
│  │              BullMQ Queues (Redis)                      │ │
│  │  q:doc-ingest │ q:gap-analysis │ q:doc-repair          │ │
│  │  q:doc-generate │ q:content-plan │ q:content-make      │ │
│  │  q:render (Playwright/PPTX)                             │ │
│  └─────┬───────────────────────────────────────────────────┘ │
│        │ Workers (concurrency 2-3)                           │
│  ┌─────▼──────────────────────────────────────────────────┐ │
│  │                    LLM GATEWAY                           │ │
│  │  Provider: NVIDIA NIM (primary) │ Gemini (fallback)     │ │
│  │  Fitur: key rotation, rate limiter, retry+backoff,      │ │
│  │  response cache (Redis), request logging, cost meter    │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│  PostgreSQL (shared dengan platform) + Redis + File Storage │
│  (folder /storage: uploads, drafts, published, renders)      │
└──────────────────────────────────────────────────────────────┘
```

**Keputusan penting**: Agentic Service adalah **service terpisah** dari core SIMRS
(proses Node.js sendiri, boleh satu server), berkomunikasi via REST + shared database
schema `agentic`. Alasan: crash/overload agent tidak boleh mengganggu operasional klinik.

---

## 3. TECH STACK

| Komponen | Pilihan | Catatan |
|---|---|---|
| Runtime | Node.js 20 LTS | Konsisten dengan tooling existing (docx, Playwright) |
| Framework API | Express + Zod (atau NestJS) | Zod untuk validasi payload |
| Database | PostgreSQL 15+ | Schema terpisah: `agentic` |
| Queue | BullMQ + Redis 7 | Queue, cron (repeatable jobs), rate limiting |
| ORM | Prisma | Migrasi terkelola, type-safe |
| LLM Primary | NVIDIA NIM API (build.nvidia.com) | OpenAI-compatible endpoint |
| LLM Fallback | Gemini API | Reuse key & prompt dari Document Engine existing |
| Render flyer | Playwright + Chromium headless | Reuse pipeline 531 flyer existing |
| Render dokumen | Library `docx` (npm) | Reuse konvensi format SOP 7-section existing |
| Render PPTX | `pptxgenjs` | Untuk materi presentasi dokter |
| Frontend | React + Tailwind | Embed sebagai menu di platform existing |
| File storage | Local disk `/storage` (fase 1) | S3-compatible menyusul jika perlu |

### 3.1 Konfigurasi NVIDIA NIM (LLM Gateway)

```
Endpoint : https://integrate.api.nvidia.com/v1/chat/completions
Auth     : Bearer <NVIDIA_API_KEY>  (dukung multi-key, rotasi round-robin)
Format   : OpenAI-compatible (messages[], model, temperature, max_tokens)
Model    : dikonfigurasi via env, contoh kandidat:
           - meta/llama-3.1-70b-instruct  (generasi dokumen/artikel)
           - meta/llama-3.1-8b-instruct   (task ringan: klasifikasi, ekstraksi metadata)
```

**Aturan gateway**:
- Rate limiter per key: konservatif, default 30 req/menit/key (sesuaikan setelah cek limit aktual akun).
- Retry: 3x dengan exponential backoff (2s, 8s, 30s) untuk HTTP 429/5xx.
- Jika semua key NVIDIA exhausted → fallback otomatis ke Gemini → jika gagal juga → job kembali ke queue dengan delay 10 menit.
- Cache: hash(prompt+model) → Redis TTL 24 jam. Berlaku untuk task idempotent (gap analysis, ekstraksi metadata). TIDAK untuk generasi konten kreatif.
- Semua request/response (truncated 2000 char) dicatat ke `llm_requests`.

---

## 4. SKEMA DATABASE (PostgreSQL, schema `agentic`)

> Jalankan sebagai Prisma schema atau raw SQL migration. Di bawah ditulis sebagai DDL agar eksplisit.

```sql
CREATE SCHEMA IF NOT EXISTS agentic;

-- ============ 4.1 USERS & ROLES (map ke user platform existing) ============
CREATE TABLE agentic.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id VARCHAR(64) NOT NULL UNIQUE,  -- FK logis ke user SIMRS
  display_name  VARCHAR(120) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','APPROVER','REVIEWER_MEDIS','VIEWER')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ADMIN: konfigurasi sistem. APPROVER: approve semua jenis (Ace).
-- REVIEWER_MEDIS: wajib review konten medis sebelum ke APPROVER (dr. Laras / dr. Jessica).

-- ============ 4.2 TASKS: STATE MACHINE UTAMA (dipakai kedua agent) ============
CREATE TABLE agentic.tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         VARCHAR(20) NOT NULL CHECK (agent IN ('DOCUMENT','CONTENT')),
  task_type     VARCHAR(40) NOT NULL,
  -- DOCUMENT: DOC_INGEST | GAP_ANALYSIS | DOC_REPAIR | DOC_GENERATE | DOC_REVIEW_CYCLE
  -- CONTENT : PLAN_WEEKLY | MAKE_SOSMED | MAKE_ARTIKEL | MAKE_PPTX_DOKTER | MAKE_EVENT_BRIEF
  status        VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
                CHECK (status IN ('QUEUED','PROCESSING','DRAFT','IN_MEDICAL_REVIEW',
                                  'APPROVED','PUBLISHED','REJECTED','FAILED','CANCELLED')),
  priority      SMALLINT NOT NULL DEFAULT 5,          -- 1 tertinggi
  title         VARCHAR(300) NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',          -- input task (lihat kontrak §6)
  result        JSONB,                                 -- output (path file draft, metadata)
  error_message TEXT,
  needs_medical_review BOOLEAN NOT NULL DEFAULT false, -- true utk artikel/PPTX medis
  created_by    UUID REFERENCES agentic.users(id),     -- NULL = dibuat scheduler
  assigned_approver UUID REFERENCES agentic.users(id),
  parent_task_id UUID REFERENCES agentic.tasks(id),    -- rantai job (plan → make)
  scheduled_for TIMESTAMPTZ,                           -- utk konten terjadwal
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_status ON agentic.tasks(status);
CREATE INDEX idx_tasks_agent_type ON agentic.tasks(agent, task_type);
CREATE INDEX idx_tasks_scheduled ON agentic.tasks(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Transisi status yang SAH (enforce di application layer):
-- QUEUED → PROCESSING → (DRAFT | FAILED)
-- DRAFT → (IN_MEDICAL_REVIEW jika needs_medical_review) → APPROVED → PUBLISHED
-- DRAFT/IN_MEDICAL_REVIEW → REJECTED (+feedback) → QUEUED (retry dgn feedback sbg konteks)
-- FAILED → QUEUED (manual/auto-retry maks 3x)

-- ============ 4.3 TASK EVENTS: AUDIT TRAIL ============
CREATE TABLE agentic.task_events (
  id          BIGSERIAL PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES agentic.tasks(id),
  from_status VARCHAR(20),
  to_status   VARCHAR(20) NOT NULL,
  actor_type  VARCHAR(10) NOT NULL CHECK (actor_type IN ('SYSTEM','WORKER','USER')),
  actor_id    UUID,                       -- users.id jika USER
  note        TEXT,                       -- feedback rejection, alasan failure, dll
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_events_task ON agentic.task_events(task_id);

-- ============ 4.4 DOCUMENT REGISTRY: INVENTARIS DOKUMEN QMS ============
CREATE TABLE agentic.document_registry (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number     VARCHAR(60) UNIQUE,       -- ex: OL/SOP/LAB/001; NULL saat masih draft
  title          VARCHAR(300) NOT NULL,
  doc_level      SMALLINT NOT NULL CHECK (doc_level BETWEEN 1 AND 4),
  -- 1=Pedoman/Manual Mutu, 2=SOP, 3=Instruksi Kerja, 4=Formulir/Rekaman
  doc_type       VARCHAR(30) NOT NULL,     -- PEDOMAN|SOP|IK|FORMULIR|SK|PKS
  department     VARCHAR(60) NOT NULL,     -- LAB|FO|HOMECARE|MUTU|FARMASI|MCU|...
  iso_clause     VARCHAR(120),             -- ex: "ISO 15189:2022 7.3.1" (bisa multi, koma)
  status         VARCHAR(20) NOT NULL DEFAULT 'DISCOVERED'
                 CHECK (status IN ('DISCOVERED','NEEDS_REPAIR','DRAFT','PUBLISHED',
                                   'DUE_FOR_REVIEW','OBSOLETE','MISSING')),
  -- MISSING = ada di checklist tapi belum ada dokumennya (row virtual dari gap analysis)
  current_revision SMALLINT NOT NULL DEFAULT 0,
  effective_date DATE,
  next_review_date DATE,                   -- default effective+2 tahun; picu DOC_REVIEW_CYCLE
  source_file_path VARCHAR(500),           -- file asli hasil ingest
  current_file_path VARCHAR(500),          -- file versi terkini (draft/published)
  extracted_meta JSONB,                    -- hasil ekstraksi LLM saat ingest
  gap_notes      TEXT,                     -- temuan gap analysis
  linked_task_id UUID REFERENCES agentic.tasks(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_docreg_status ON agentic.document_registry(status);
CREATE INDEX idx_docreg_dept_level ON agentic.document_registry(department, doc_level);

-- ============ 4.5 DOCUMENT REVISIONS: RIWAYAT VERSI ============
CREATE TABLE agentic.document_revisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES agentic.document_registry(id),
  revision    SMALLINT NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  change_note TEXT,
  approved_by UUID REFERENCES agentic.users(id),
  approved_at TIMESTAMPTZ,
  UNIQUE(document_id, revision)
);

-- ============ 4.6 COMPLIANCE CHECKLIST: MASTER PERSYARATAN ISO/AKREDITASI ============
CREATE TABLE agentic.compliance_checklist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework     VARCHAR(40) NOT NULL,      -- 'ISO15189:2022' | 'AKREDITASI_KLINIK' | ...
  clause_ref    VARCHAR(60) NOT NULL,      -- ex: '8.3.2'
  requirement   TEXT NOT NULL,             -- deskripsi persyaratan
  required_doc_level SMALLINT,
  required_doc_type  VARCHAR(30),
  department    VARCHAR(60),
  is_mandatory  BOOLEAN NOT NULL DEFAULT true,
  matched_document_id UUID REFERENCES agentic.document_registry(id), -- diisi gap analysis
  match_confidence NUMERIC(3,2),           -- 0.00-1.00 dari LLM, <0.7 = flag manual check
  active        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(framework, clause_ref, required_doc_type, department)
);
-- Seed data: import dari breakdown Klausul 4-8 ISO 15189:2022 (siapkan CSV seed terpisah).

-- ============ 4.7 CONTENT CALENDAR ============
CREATE TABLE agentic.content_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  VARCHAR(30) NOT NULL
                CHECK (content_type IN ('SOSMED_POST','SOSMED_CAROUSEL','ARTIKEL',
                                        'PPTX_DOKTER','EVENT','FLYER')),
  topic         VARCHAR(300) NOT NULL,
  angle         TEXT,                      -- brief/hook copywriting
  framework     VARCHAR(10) DEFAULT 'PAS' CHECK (framework IN ('PAS','AIDA','EDU')),
  target_date   DATE NOT NULL,
  target_time   TIME,                      -- jam posting optimal
  channel       VARCHAR(30),               -- IG|LINKEDIN|WEB|WHATSAPP|OFFLINE
  related_test_codes TEXT[],               -- link ke master catalog 531 tes
  health_day_ref VARCHAR(120),             -- ex: 'Hari Diabetes Sedunia 14 Nov'
  source        VARCHAR(20) NOT NULL DEFAULT 'IMPORT'
                CHECK (source IN ('IMPORT','PLANNER_AI','MANUAL')),
  task_id       UUID REFERENCES agentic.tasks(id),  -- task MAKE_* yang dibuat dari slot ini
  status        VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
                CHECK (status IN ('PLANNED','IN_PRODUCTION','READY','PUBLISHED','SKIPPED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_date ON agentic.content_calendar(target_date);

-- ============ 4.8 CONTENT ASSETS: OUTPUT JADI ============
CREATE TABLE agentic.content_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id  UUID REFERENCES agentic.content_calendar(id),
  task_id      UUID NOT NULL REFERENCES agentic.tasks(id),
  asset_type   VARCHAR(20) NOT NULL CHECK (asset_type IN ('COPY','IMAGE','PDF','PPTX','HTML','DOCX')),
  file_path    VARCHAR(500),
  text_content TEXT,                       -- utk COPY: caption + hashtag
  meta         JSONB,                      -- dimensi, jumlah slide, sitasi artikel, dll
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ 4.9 LLM REQUESTS: LOG & COST METER ============
CREATE TABLE agentic.llm_requests (
  id            BIGSERIAL PRIMARY KEY,
  task_id       UUID REFERENCES agentic.tasks(id),
  provider      VARCHAR(20) NOT NULL,      -- NVIDIA|GEMINI
  model         VARCHAR(80) NOT NULL,
  key_alias     VARCHAR(40),               -- key mana yang dipakai (rotasi)
  prompt_hash   CHAR(64),
  prompt_preview TEXT,                     -- truncated 2000 char
  response_preview TEXT,
  input_tokens  INT,
  output_tokens INT,
  latency_ms    INT,
  status        VARCHAR(15) NOT NULL,      -- OK|RATE_LIMITED|ERROR|CACHED|FALLBACK
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_llm_req_created ON agentic.llm_requests(created_at);

-- ============ 4.10 PROMPT TEMPLATES: MASTER PROMPT TERKELOLA ============
CREATE TABLE agentic.prompt_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(60) NOT NULL UNIQUE, -- ex: DOC_REPAIR_SOP, MAKE_SOSMED_PAS
  version     SMALLINT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,      -- dengan placeholder {{var}}
  model_hint  VARCHAR(80),                 -- model yang disarankan
  temperature NUMERIC(2,1) DEFAULT 0.4,
  active      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Migrasikan master prompt Document Engine existing (termasuk rule Firewall Isi vs Format)
-- ke tabel ini agar bisa di-update tanpa deploy ulang.
```

---

## 5. PIPELINE AGENT (ALUR JOB DETAIL)

### 5.1 Document Compliance Agent

```
[Upload ZIP dokumen existing via UI]
        │
        ▼
(q:doc-ingest) INGEST WORKER
  - Ekstrak zip → /storage/uploads/{batch_id}/
  - Per file: konversi ke teks (docx→mammoth, pdf→pdf-parse)
  - LLM call (model kecil): ekstrak metadata → title, doc_type, doc_level,
    department, doc_number, revision, effective_date
  - INSERT ke document_registry (status=DISCOVERED)
  - Selesai semua file → auto-enqueue GAP_ANALYSIS
        │
        ▼
(q:gap-analysis) GAP ANALYSIS WORKER
  - Load compliance_checklist aktif + seluruh document_registry
  - LLM call per klausul (batched 10 klausul/call): cocokkan requirement ↔ dokumen
    Output JSON: {clause_ref, matched_doc_id|null, confidence, gap_note}
  - Update checklist.matched_document_id + confidence
  - Dokumen tidak standar format → registry.status=NEEDS_REPAIR → buat task DOC_REPAIR
  - Klausul tanpa dokumen → registry row baru status=MISSING → buat task DOC_GENERATE
  - Hasil ringkas → dashboard "Compliance Score" (% klausul terpenuhi per departemen)
        │
        ├──────────────► (q:doc-repair) REPAIR WORKER
        │                 - Input: file asli + prompt DOC_REPAIR_{doc_type}
        │                 - Terapkan rule Firewall Isi vs Format
        │                 - Output: docx baru via library docx (format 7-section utk SOP)
        │                 - Simpan /storage/drafts/ → task.status=DRAFT
        │
        └──────────────► (q:doc-generate) GENERATE WORKER
                          - Input: requirement klausul + Pedoman induk terkait (konteks)
                          - Output: draft docx lengkap → task.status=DRAFT
        │
        ▼
APPROVAL INBOX (UI)
  - Repair: tampilkan DIFF view (teks lama vs baru, side-by-side)
  - Generate: full document preview
  - Approve → status=APPROVED → PUBLISH:
      * assign doc_number otomatis (format: OL/{TYPE}/{DEPT}/{seq})
      * insert document_revisions, set next_review_date = effective + 2 tahun
      * copy file ke /storage/published/ → tampil di menu Dokumen QMS SIMRS
  - Reject + feedback → task kembali QUEUED, feedback di-inject ke prompt retry
        │
        ▼
(cron harian 02:00) REVIEW CYCLE
  - Scan registry: next_review_date <= today+30 → status=DUE_FOR_REVIEW
    → buat task DOC_REPAIR (mode: review berkala) → antri approval
  - Re-run gap analysis jika checklist berubah sejak run terakhir
```

### 5.2 Content & Branding Agent

```
(cron mingguan, Senin 05:00) PLANNER WORKER
  - Load content_calendar 14 hari ke depan
  - Cek slot kosong vs target frekuensi (konfigurasi: ex. 3 post/minggu, 1 artikel/minggu)
  - Referensi: hari kesehatan nasional/internasional (tabel seed statis) +
    master catalog tes (related_test_codes) + web search tren kesehatan (opsional fase 2)
  - LLM call: generate slot baru (topic, angle, framework, channel, jam posting)
    → INSERT content_calendar (source=PLANNER_AI, status=PLANNED)
  - Buat task MAKE_* untuk slot H-4 hari → status calendar=IN_PRODUCTION
        │
        ▼
(q:content-make) MAKER WORKERS — per content_type:

  MAKE_SOSMED:
    1. LLM: caption + hook + hashtag (prompt MAKE_SOSMED_{framework},
       rule 70/30 education-first + anti-hyperbole dari Content Optimizer)
    2. Enqueue q:render → Playwright render flyer 1080x1350 (template OneLab existing)
    3. Simpan content_assets (COPY + IMAGE) → task.status=DRAFT

  MAKE_ARTIKEL:
    1. LLM: outline → draft artikel (800-1200 kata) WAJIB dengan daftar sumber/sitasi
    2. needs_medical_review=true → route ke dr. Laras/dr. Jessica dulu
    3. Output HTML + DOCX → DRAFT → IN_MEDICAL_REVIEW → APPROVED

  MAKE_PPTX_DOKTER:
    1. Input: topik (dari kalender/manual) + audiens + durasi
    2. LLM: outline slide → konten per slide + speaker notes + referensi
    3. Render pptxgenjs dengan template OneLab → needs_medical_review=true

  MAKE_EVENT_BRIEF:
    1. Input: nama event, tanggal, tema, target peserta
    2. LLM: rundown + checklist logistik + brief materi promosi
       → auto-buat slot calendar utk konten promosi event (H-14, H-7, H-1)
    3. Output DOCX brief → DRAFT
        │
        ▼
APPROVAL INBOX → APPROVED → PUBLISHED:
  - Sosmed: tandai READY di calendar, tampil di "Content Studio" utk di-download/
    dijadwalkan (auto-posting ke IG/Meta API = fase berikutnya, jangan di fase 1)
  - Artikel: publish ke web/arsip internal
  - PPTX/Event brief: available for download
```

---

## 6. KONTRAK PAYLOAD TASK (JSONB `tasks.payload`)

```jsonc
// DOC_REPAIR
{ "document_id": "uuid", "mode": "format_fix | periodic_review",
  "prompt_code": "DOC_REPAIR_SOP", "rejection_feedback": null }

// DOC_GENERATE
{ "checklist_id": "uuid", "doc_type": "SOP", "doc_level": 2,
  "department": "LAB", "parent_pedoman_id": "uuid|null" }

// MAKE_SOSMED
{ "calendar_id": "uuid", "framework": "PAS", "channel": "IG",
  "related_test_codes": ["GLU","HBA1C"], "render_template": "flyer_v2" }

// MAKE_ARTIKEL
{ "calendar_id": "uuid", "topic": "...", "target_words": 1000,
  "audience": "awam", "min_citations": 3 }

// MAKE_PPTX_DOKTER
{ "topic": "...", "audience": "dokter umum", "duration_min": 30,
  "slide_count_hint": 15, "requested_by": "uuid" }

// MAKE_EVENT_BRIEF
{ "event_name": "...", "event_date": "2026-09-10", "theme": "...",
  "target_participants": 100, "location": "..." }
```

---

## 7. API ENDPOINTS (Agentic Service)

```
POST   /api/agentic/documents/ingest          # upload zip → buat batch + task ingest
GET    /api/agentic/documents/registry        # list + filter (status, dept, level)
GET    /api/agentic/documents/compliance      # compliance score per framework/dept
POST   /api/agentic/documents/:id/republish   # trigger review manual

GET    /api/agentic/calendar?from=&to=        # kalender konten
POST   /api/agentic/calendar                  # tambah slot manual
POST   /api/agentic/tasks                     # buat task manual (ex. PPTX on-demand)

GET    /api/agentic/inbox                     # approval inbox (filter role user)
GET    /api/agentic/tasks/:id                 # detail + preview draft + diff
POST   /api/agentic/tasks/:id/approve
POST   /api/agentic/tasks/:id/reject          # body: { feedback: string }
POST   /api/agentic/tasks/:id/retry

GET    /api/agentic/monitor/queues            # depth per queue, failed jobs
GET    /api/agentic/monitor/llm-usage         # req count, token, per provider/hari
```

---

## 8. STRUKTUR FOLDER PROJECT (monorepo)

```
onelab-agentic/
├── apps/
│   ├── api/                    # Express/NestJS API layer + approval engine
│   │   └── src/routes, src/services, src/middleware(auth: validasi token SIMRS)
│   ├── workers/                # Proses terpisah: node apps/workers/main.js
│   │   └── src/
│   │       ├── doc-ingest.worker.ts
│   │       ├── gap-analysis.worker.ts
│   │       ├── doc-repair.worker.ts
│   │       ├── doc-generate.worker.ts
│   │       ├── content-planner.worker.ts
│   │       ├── content-maker.worker.ts
│   │       └── render.worker.ts          # Playwright + pptxgenjs (concurrency=1)
│   └── web/                    # React: Approval Inbox, Content Studio, Compliance Dash
├── packages/
│   ├── llm-gateway/            # satu-satunya modul yang tahu API key
│   │   └── src/providers/nvidia.ts, gemini.ts, rotator.ts, limiter.ts, cache.ts
│   ├── db/                     # Prisma schema + migrations + seed
│   │   └── seed/iso15189-checklist.csv, health-days.csv, prompt-templates.json
│   ├── renderers/              # reuse: flyer Playwright templates, docx builder, pptx
│   └── shared/                 # types, zod schemas, konstanta status
├── storage/                    # uploads/ drafts/ published/ renders/ (gitignore)
├── docker-compose.yml          # postgres, redis (dev)
└── .env.example
```

### 8.1 Environment Variables

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
NVIDIA_API_KEYS=key1,key2,key3          # comma-separated, rotasi otomatis
NVIDIA_MODEL_MAIN=meta/llama-3.1-70b-instruct
NVIDIA_MODEL_LIGHT=meta/llama-3.1-8b-instruct
GEMINI_API_KEYS=key1,key2               # fallback (reuse dari Document Engine)
LLM_RATE_LIMIT_PER_KEY_PER_MIN=30
WORKER_CONCURRENCY=2
STORAGE_ROOT=/var/onelab/storage
SIMRS_BASE_URL=http://localhost:3000    # utk validasi auth token & publish hook
```

---

## 9. GUARDRAILS & VALIDASI OUTPUT (implementasi wajib)

1. **Schema validation**: Semua output LLM yang structured wajib JSON → parse dengan Zod.
   Gagal parse → retry 1x dengan pesan error di-inject → masih gagal → task FAILED.
2. **Firewall Isi vs Format**: system prompt DOC_* wajib memuat rule: referensi hanya
   untuk struktur; dilarang menyalin isi substantif lintas jenis dokumen.
3. **Placeholder policy**: Nilai yang butuh konfirmasi operator (angka klinis, harga,
   nama penanggung jawab) HARUS ditulis sebagai `[[KONFIRMASI: ...]]` — tidak boleh
   dikarang LLM. Approval UI highlight semua placeholder tersisa.
4. **Sitasi artikel**: MAKE_ARTIKEL tanpa min_citations terpenuhi → auto-reject internal
   sebelum masuk inbox.
5. **Anti-hyperbole**: reuse rule Content Optimizer (dilarang klaim menyembuhkan,
   superlatif tanpa data, dsb.) di semua prompt MAKE_*.
6. **Retry budget**: max 3 auto-retry per task; lewat itu → FAILED + notifikasi.
7. **Concurrency cap**: worker LLM max 2-3 paralel; render worker = 1 (Chromium berat).
8. **Kill switch**: env `AGENTIC_PAUSED=true` → semua scheduler & worker berhenti
   mengambil job baru (job berjalan diselesaikan).

---

## 10. URUTAN BUILD (fase untuk Claude Desktop/Code)

**Fase 0 — Fondasi (build pertama)**
- [ ] Setup monorepo, docker-compose (Postgres+Redis), Prisma schema §4, migrasi
- [ ] packages/llm-gateway: provider NVIDIA + Gemini, rotasi key, limiter, log ke llm_requests
- [ ] Smoke test: 1 endpoint POST /tasks → worker dummy → status DRAFT

**Fase 1 — State machine & Approval**
- [ ] Approval engine: enforce transisi status §4.2 + task_events
- [ ] API §7 (tasks, inbox, approve/reject/retry)
- [ ] Web: Approval Inbox (list, preview, approve/reject dgn feedback), auth via token SIMRS

**Fase 2 — Document Agent**
- [ ] Ingest worker (zip → parse → metadata → registry)
- [ ] Seed compliance_checklist ISO 15189:2022 (CSV) + gap analysis worker
- [ ] Repair & generate workers (migrasi master prompt existing ke prompt_templates)
- [ ] Compliance dashboard + publish flow (doc_number otomatis, revisi)
- [ ] Cron review cycle harian

**Fase 3 — Content Agent**
- [ ] Import content plan Excel 6 bulan → content_calendar
- [ ] Planner worker (cron mingguan) + seed health-days.csv
- [ ] MAKE_SOSMED (+ render Playwright reuse template flyer)
- [ ] MAKE_ARTIKEL (+ jalur IN_MEDICAL_REVIEW)
- [ ] MAKE_PPTX_DOKTER + MAKE_EVENT_BRIEF
- [ ] Content Studio UI (kalender + download asset)

**Fase 4 — Hardening**
- [ ] Monitor dashboard (queue depth, LLM usage/cost, failed jobs)
- [ ] Notifikasi (email/WhatsApp webhook) saat ada item baru di inbox
- [ ] Backup storage + retensi log

---

## 11. CATATAN INTEGRASI KE SIMRS EXISTING

- Menu SIMRS memanggil Agentic Service via REST; auth = forward token user SIMRS,
  Agentic Service validasi ke SIMRS_BASE_URL (atau shared JWT secret).
- Dokumen PUBLISHED muncul di menu Dokumen QMS via query ke document_registry
  (read-only dari sisi SIMRS) — SIMRS tidak menulis ke schema agentic.
- Master catalog 531 tes: sediakan endpoint read di SIMRS (GET /api/catalog/tests)
  yang dipakai Content Agent untuk related_test_codes. Jangan duplikasi data.
- Jangan expose Agentic Service ke publik; hanya jaringan internal/VPN.

— END OF SPEC —
