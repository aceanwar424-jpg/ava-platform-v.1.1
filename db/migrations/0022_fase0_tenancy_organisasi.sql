-- ═══════════════════════════════════════════════════════════════
-- 0022 — FONDASI FASE 0: TENANCY, BRAND, KBLI REGISTRY & ACTIVITY MATRIX
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 1B, 15, 16.3
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabel Brand (6 Brand + HQ)
CREATE TABLE IF NOT EXISTS public.brands (
  code            varchar(10) PRIMARY KEY, -- HEALTH, LAB, CARE, NUTRI, TECH, SANCT, HQ
  name            varchar(100) NOT NULL,
  tagline         text,
  primary_color   varchar(20),
  logo_url        text,
  doc_prefix      varchar(10) NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed Data 6 Brand + HQ
INSERT INTO public.brands (code, name, tagline, primary_color, doc_prefix, status)
VALUES 
  ('HQ',      'AVA Global Holding',        'Integrated Health & Wellness Ecosystem', '#0f172a', 'HQ',    'ACTIVE'),
  ('HEALTH',  'AVA Health',                'Modern Clinical Healthcare & Corporate MCU', '#0284c7', 'HLT',   'ACTIVE'),
  ('LAB',     'AVA Lab',                   'Precision Diagnostics & ISO 15189 LIS',   '#059669', 'LAB',   'ACTIVE'),
  ('CARE',    'AVA Care',                  'Personalized Homecare & Caregiving',      '#d97706', 'CAR',   'ACTIVE'),
  ('NUTRI',   'AVA Nutrition',             'Evidence-Based Supplements & FMCG',      '#16a34a', 'NUT',   'ACTIVE'),
  ('SANCT',   'AVA Sanctuary',             'Holistic Wellness, Postnatal & Spa',      '#e11d48', 'SNC',   'ACTIVE'),
  ('TECH',    'AVA Tech',                  'Healthcare Platform & Core Engineering',  '#7c3aed', 'TCH',   'ACTIVE')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  primary_color = EXCLUDED.primary_color,
  doc_prefix = EXCLUDED.doc_prefix;

-- 2. Tabel Cost Center
CREATE TABLE IF NOT EXISTS public.cost_centers (
  code                varchar(20) PRIMARY KEY,
  name                varchar(100) NOT NULL,
  brand_code          varchar(10) NOT NULL REFERENCES public.brands(code),
  parent_code         varchar(20) REFERENCES public.cost_centers(code),
  manager_employee_id uuid,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Penyelarasan dengan cost_centers warisan ──────────────────────────────
--
-- Mesin lokal memuat sql_arsip/04_roadmap_fase/supabase_fase4.sql SEBELUM
-- menjalankan migrasi, dan berkas itu sudah membuat public.cost_centers
-- dengan bentuk lain (id sebagai PK, code tanpa unik, tanpa brand_code).
-- Akibatnya CREATE TABLE IF NOT EXISTS di atas menjadi no-op, lalu INSERT di
-- bawah gagal dengan: column "brand_code" ... does not exist.
--
-- Karena runner migrasi melempar galat dan BERHENTI, kegagalan di sini
-- membuat 0023 dan seterusnya tidak pernah terpasang sama sekali — seluruh
-- fondasi Fase 0 diam-diam absen padahal berkasnya ada.
--
-- Blok berikut menyamakan bentuknya lebih dulu. Pada basis data bersih
-- semuanya no-op, karena kolomnya sudah dibuat oleh CREATE TABLE di atas.
ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS brand_code          varchar(10),
  ADD COLUMN IF NOT EXISTS parent_code         varchar(20),
  ADD COLUMN IF NOT EXISTS manager_employee_id uuid,
  ADD COLUMN IF NOT EXISTS is_active           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now();

-- ON CONFLICT (code) menuntut indeks unik pada code. Tabel warisan hanya
-- punya code sebagai kolom biasa, jadi indeksnya dibuat di sini bila belum ada.
CREATE UNIQUE INDEX IF NOT EXISTS cost_centers_code_uq ON public.cost_centers (code);

INSERT INTO public.cost_centers (code, name, brand_code)
VALUES
  ('CC-HQ-CORP',    'Holding Corporate & Governance', 'HQ'),
  ('CC-HLT-CLINIC', 'Poliklinik Rawat Jalan',         'HEALTH'),
  ('CC-HLT-MCU',    'MCU Korporat & On-Site',         'HEALTH'),
  ('CC-LAB-OPS',    'Operasional Laboratorium LIS',   'LAB'),
  ('CC-CAR-HOME',   'Homecare Dispatch & Field',      'CARE'),
  ('CC-NUT-PROD',   'Manufaktur & Suplemen Pabrik',   'NUTRI'),
  ('CC-NUT-OMS',    'E-Commerce & Konsinyasi D2C',    'NUTRI'),
  ('CC-SNC-SPA',    'Wellness & Medspa Sanctuary',    'SANCT'),
  ('CC-TCH-ENG',    'Software Engineering & Platform','TECH')
ON CONFLICT (code) DO NOTHING;

-- 3. Tabel Lokasi Fisik Faskes / Fasilitas
CREATE TABLE IF NOT EXISTS public.locations (
  code            varchar(20) PRIMARY KEY,
  name            varchar(100) NOT NULL,
  address         text NOT NULL,
  city            varchar(50) NOT NULL,
  -- 'Asia/Jakarta' sendiri 12 karakter, jadi varchar(10) membuat kolom ini
  -- tidak muat menampung nilai bawaannya sendiri — setiap INSERT gagal
  -- dengan "value too long for type character varying(10)". Dilebarkan ke 40,
  -- cukup untuk nama zona IANA terpanjang yang dipakai di Indonesia dan
  -- sekitarnya (mis. 'Asia/Makassar', 'Asia/Jayapura').
  timezone        varchar(40) NOT NULL DEFAULT 'Asia/Jakarta',
  brand_codes     text[] NOT NULL DEFAULT '{"HQ","HEALTH","LAB","CARE","NUTRI","SANCT","TECH"}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.locations (code, name, address, city, timezone)
VALUES
  ('LOC-PST-01', 'AVA Central Hub & Lab', 'Jl. Sudirman No. 120', 'Jakarta', 'Asia/Jakarta'),
  ('LOC-BDG-01', 'AVA Regional West Java', 'Jl. Asia Afrika No. 45', 'Bandung', 'Asia/Jakarta')
ON CONFLICT (code) DO NOTHING;

-- 4. Tabel Registri KBLI 2025 & Transisi 2020 (Bab 1B.3)
CREATE TABLE IF NOT EXISTS public.kbli_registry (
  kbli_code       varchar(10) NOT NULL,
  kbli_version    varchar(10) NOT NULL DEFAULT '2025', -- 2020 / 2025
  title           varchar(200) NOT NULL,
  brand_code      varchar(10) NOT NULL REFERENCES public.brands(code),
  risk_level      varchar(30) NOT NULL DEFAULT 'MENENGAH_TINGGI',
  converted_from  varchar(10),
  status          varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kbli_code, kbli_version)
);

INSERT INTO public.kbli_registry (kbli_code, kbli_version, title, brand_code, risk_level, converted_from)
VALUES
  ('86105', '2025', 'Aktivitas Klinik Swasta & Rawat Jalan', 'HEALTH', 'MENENGAH_TINGGI', '86105'),
  ('86903', '2025', 'Aktivitas Laboratorium Medis & Klinik', 'LAB', 'MENENGAH_TINGGI', '86903'),
  ('86904', '2025', 'Aktivitas Pelayanan Keperawatan & Home Care', 'CARE', 'MENENGAH_RENDAH', '86904'),
  ('10799', '2025', 'Industri Pangan & Suplemen Olahan', 'NUTRI', 'MENENGAH_TINGGI', '10799'),
  ('47721', '2025', 'Perdagangan Eceran Farmasi & Suplemen', 'NUTRI', 'RENDAH', '47721'),
  ('96122', '2025', 'Aktivitas Spa & Kebugaran Wellness', 'SANCT', 'MENENGAH_RENDAH', '96122'),
  ('62019', '2025', 'Aktivitas Pengembangan Aplikasi Kesehatan', 'TECH', 'RENDAH', '63122')
ON CONFLICT (kbli_code, kbli_version) DO NOTHING;

-- 5. Tabel Izin Operasional & Standar (Permits)
CREATE TABLE IF NOT EXISTS public.permits (
  id                  uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id           uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  permit_type         varchar(50) NOT NULL, -- IZIN_KLINIK, IZIN_LAB, PJK3_HIPERKES, BPOM_NIE, HALAL, ISO15189
  permit_number       varchar(100) NOT NULL,
  kbli_code           varchar(10) NOT NULL,
  location_code       varchar(20) REFERENCES public.locations(code),
  issued_at           date NOT NULL,
  expires_at          date NOT NULL,
  issuing_authority   varchar(150) NOT NULL,
  document_url        text,
  status              varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_permit_num UNIQUE (tenant_id, permit_type, permit_number)
);

-- 6. Tabel Penanggung Jawab Teknis Izin (Permit PIC)
CREATE TABLE IF NOT EXISTS public.permit_pics (
  id                  uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  permit_id           uuid NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  employee_id         uuid,
  pic_name            varchar(150) NOT NULL,
  role_title          varchar(100) NOT NULL, -- PENANGGUNG_JAWAB_MEDIS, DOKTER_SPPK, APOTEKER_PJ
  license_number      varchar(100) NOT NULL, -- STR / SIP / SIK
  license_expires_at  date NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 7. Tabel Matriks Kesahihan Kegiatan vs Izin (service_activity_map)
-- Menjawab "layanan ini sah dijual di bawah izin yang mana?"
CREATE TABLE IF NOT EXISTS public.service_activity_map (
  id                    uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  tenant_id             uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  service_code          varchar(50) NOT NULL,
  brand_code            varchar(10) NOT NULL REFERENCES public.brands(code),
  kbli_code             varchar(10) NOT NULL,
  permit_id             uuid REFERENCES public.permits(id),
  is_medical_procedure  boolean NOT NULL DEFAULT false, -- True jika butuh izin klinik & dokter PJ aktif
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_service_activity UNIQUE (tenant_id, service_code, brand_code)
);
