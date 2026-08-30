-- ═══════════════════════════════════════════════════════════════
-- 0026 — FONDASI FASE 0: EVENT OUTBOX & STRUKTUR DIMENSI KEUANGAN
-- Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.7, 16.8 & Bab 17 (ADR-07)
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabel Event Outbox (Asynchronous Event Bus)
-- Mengirim sinyal event ke unit lain tanpa mengekspos payload klinis K4
CREATE TABLE IF NOT EXISTS public.sys_event_outbox (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  -- gen_random_bytes() milik pgcrypto tidak tersedia di PGlite (mesin lokal
  -- desktop), dan pemakaiannya di sini membuat SELURUH migrasi 0026-0028
  -- gagal terpasang di instalasi klinik. gen_random_uuid() ada di inti
  -- PostgreSQL sejak versi 13 — alasan yang sama sudah dicatat di
  -- 0016_token_tanpa_pgcrypto.sql.
  event_id        varchar(64) NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  event_name      varchar(100) NOT NULL, -- misal: lab.result.released, mpi.person.merged
  event_version   integer NOT NULL DEFAULT 1,
  aggregate_type  varchar(50) NOT NULL,  -- misal: lab_order, person, invoice
  aggregate_id    varchar(100) NOT NULL,
  tenant_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  brand_code      varchar(10) NOT NULL REFERENCES public.brands(code),
  actor_user_id   uuid,
  actor_role      varchar(50),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at    timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'PENDING' -- PENDING, PUBLISHED, FAILED, DEAD_LETTER
);

CREATE INDEX IF NOT EXISTS idx_sys_event_status ON public.sys_event_outbox (status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sys_event_name ON public.sys_event_outbox (event_name);

-- 2. Tabel Struktur Chart of Accounts (COA Berdimensi)
CREATE TABLE IF NOT EXISTS public.fin_accounts (
  code                varchar(30) PRIMARY KEY,
  name                varchar(150) NOT NULL,
  type                varchar(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  parent_code         varchar(30) REFERENCES public.fin_accounts(code),
  is_postable         boolean NOT NULL DEFAULT true,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Seed Struktur COA Dasar & Akun Eliminasi Konsolidasi Holding (Bab 1B.2)
INSERT INTO public.fin_accounts (code, name, type, is_postable)
VALUES
  ('1000', 'AKTIVA',                                'ASSET',     false),
  ('1101', 'Kas & Bank Operasional',                'ASSET',     true),
  ('1103', 'Piutang Usaha & Klaim Asuransi',        'ASSET',     true),
  ('1105', 'Persediaan Reagen & Farmasi',           'ASSET',     true),
  ('2000', 'KEWAJIBAN',                             'LIABILITY', false),
  ('2101', 'Hutang Usaha & Supplier',               'LIABILITY', true),
  ('2105', 'Pendapatan Diterima di Muka (Sanctuary)','LIABILITY', true),
  ('3000', 'EKUITAS',                               'EQUITY',    false),
  ('3101', 'Modal Disetor PT AVA Health Solution',  'EQUITY',    true),
  ('4000', 'PENDAPATAN',                            'REVENUE',   false),
  ('4101', 'Pendapatan Laboratorium (AVA Lab)',     'REVENUE',   true),
  ('4102', 'Pendapatan Klinik & MCU (AVA Health)',  'REVENUE',   true),
  ('4103', 'Pendapatan Homecare (AVA Care)',        'REVENUE',   true),
  ('4104', 'Pendapatan Produk D2C (AVA Nutrition)', 'REVENUE',   true),
  ('4105', 'Pendapatan Wellness (AVA Sanctuary)',   'REVENUE',   true),
  ('4106', 'Pendapatan Jasa Platform (AVA Tech)',   'REVENUE',   true),
  ('4999', 'ELIMINASI: Transfer Internal Antar-Brand','REVENUE', true),
  ('5000', 'BEBAN POKOK PENDAPATAN (HPP)',          'EXPENSE',   false),
  ('5101', 'Beban Reagen & BHP Medis',              'EXPENSE',   true),
  ('5102', 'Beban Bahan Baku Produksi Maklon',      'EXPENSE',   true),
  ('5999', 'ELIMINASI: HPP Transfer Internal',      'EXPENSE',   true),
  ('6000', 'BEBAN OPERASIONAL & GAJI',              'EXPENSE',   false),
  ('6101', 'Beban Gaji, Jasa Medis & Payroll',      'EXPENSE',   true)
ON CONFLICT (code) DO NOTHING;

-- 3. Tabel Tarif Transfer Pricing Internal Antar-Brand (Bab 1B.2)
CREATE TABLE IF NOT EXISTS public.fin_internal_transfer_rates (
  id              uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  from_brand      varchar(10) NOT NULL REFERENCES public.brands(code),
  to_brand        varchar(10) NOT NULL REFERENCES public.brands(code),
  service_code    varchar(50) NOT NULL,
  rate_amount     bigint NOT NULL,
  valid_from      date NOT NULL DEFAULT CURRENT_DATE,
  valid_until     date,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_internal_transfer UNIQUE (from_brand, to_brand, service_code, valid_from)
);
