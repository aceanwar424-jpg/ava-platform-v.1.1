-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Project MCU v5 — Kolom Baru
-- Jalankan di Supabase SQL Editor
-- Safe: semua ALTER pakai IF NOT EXISTS via DO block
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN

-- ── 1. Kolom Project Master (baru) ────────────────────────────

-- Ganti pic_onelab → pic_sales & pic_spv (rename safe dengan ADD)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='pic_sales') THEN
  ALTER TABLE public.projects ADD COLUMN pic_sales text;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='pic_spv') THEN
  ALTER TABLE public.projects ADD COLUMN pic_spv text;
END IF;

-- Tanggal pelaksanaan (hari-H)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='tanggal_pelaksanaan') THEN
  ALTER TABLE public.projects ADD COLUMN tanggal_pelaksanaan date;
END IF;

-- SLA
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='sla_category') THEN
  ALTER TABLE public.projects ADD COLUMN sla_category text; -- SMALL, MEDIUM, LARGE
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='sla_deadline_persiapan') THEN
  ALTER TABLE public.projects ADD COLUMN sla_deadline_persiapan date;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='sla_hasil_kontraktual') THEN
  ALTER TABLE public.projects ADD COLUMN sla_hasil_kontraktual text DEFAULT 'H+5';
END IF;

-- Payment & credit
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='skema_pembayaran') THEN
  ALTER TABLE public.projects ADD COLUMN skema_pembayaran text DEFAULT 'CREDIT';
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='credit_hold_status') THEN
  ALTER TABLE public.projects ADD COLUMN credit_hold_status text DEFAULT 'CLEAR';
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='status_financial') THEN
  ALTER TABLE public.projects ADD COLUMN status_financial text DEFAULT 'OPEN'; -- OPEN, INVOICED, PAID, CLOSED
END IF;

-- F-05 Lock
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='f05_locked') THEN
  ALTER TABLE public.projects ADD COLUMN f05_locked boolean DEFAULT false;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='f05_signed_at') THEN
  ALTER TABLE public.projects ADD COLUMN f05_signed_at timestamp;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='f06_signed_at') THEN
  ALTER TABLE public.projects ADD COLUMN f06_signed_at timestamp;
END IF;

-- RAB fields
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rab_total') THEN
  ALTER TABLE public.projects ADD COLUMN rab_total numeric DEFAULT 0;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rab_hpp') THEN
  ALTER TABLE public.projects ADD COLUMN rab_hpp numeric DEFAULT 0;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rab_margin_pct') THEN
  ALTER TABLE public.projects ADD COLUMN rab_margin_pct numeric DEFAULT 30;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rab_days') THEN
  ALTER TABLE public.projects ADD COLUMN rab_days integer DEFAULT 1;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rab_parameter_tests') THEN
  ALTER TABLE public.projects ADD COLUMN rab_parameter_tests text; -- JSON array of product IDs
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rab_actual') THEN
  ALTER TABLE public.projects ADD COLUMN rab_actual numeric DEFAULT 0;
END IF;

-- Harga & MG
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='harga_per_peserta') THEN
  ALTER TABLE public.projects ADD COLUMN harga_per_peserta numeric DEFAULT 0;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='nilai_kontrak') THEN
  ALTER TABLE public.projects ADD COLUMN nilai_kontrak numeric DEFAULT 0;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='minimum_guarantee') THEN
  ALTER TABLE public.projects ADD COLUMN minimum_guarantee integer DEFAULT 0;
END IF;

-- BAST & Billing
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='bast_signed_at') THEN
  ALTER TABLE public.projects ADD COLUMN bast_signed_at timestamp;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='dasar_tagihan_bast') THEN
  ALTER TABLE public.projects ADD COLUMN dasar_tagihan_bast integer DEFAULT 0;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='rekap_billing_final') THEN
  ALTER TABLE public.projects ADD COLUMN rekap_billing_final numeric DEFAULT 0;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='all_deviasi_resolved') THEN
  ALTER TABLE public.projects ADD COLUMN all_deviasi_resolved boolean DEFAULT false;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='f020_signed_3') THEN
  ALTER TABLE public.projects ADD COLUMN f020_signed_3 boolean DEFAULT false;
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='client_receipt_confirmed_at') THEN
  ALTER TABLE public.projects ADD COLUMN client_receipt_confirmed_at timestamp;
END IF;

-- Lokasi pelaksanaan
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='lokasi_pelaksanaan') THEN
  ALTER TABLE public.projects ADD COLUMN lokasi_pelaksanaan text; -- ONSITE, OFFSITE, CLINIC
END IF;

-- Corporate link
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='corporate_id') THEN
  ALTER TABLE public.projects ADD COLUMN corporate_id bigint;
END IF;

-- Stage tracking (v5 pakai step_id string S01..S31, bukan integer)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='current_step') THEN
  ALTER TABLE public.projects ADD COLUMN current_step integer DEFAULT 1;
END IF;

-- NPS
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='nps_score') THEN
  ALTER TABLE public.projects ADD COLUMN nps_score integer;
END IF;

RAISE NOTICE 'projects: semua kolom baru berhasil ditambahkan';

END $$;

-- ── 2. Tabel project_steps — tambah kolom baru (tabel sudah ada) ──
-- Kolom lama: project_id, step_number, step_name, step_group, status,
--             due_date, done_date, done_by, notes, attachments, updated_at
-- Kolom BARU yang dibutuhkan MCU v5:

ALTER TABLE public.project_steps
  ADD COLUMN IF NOT EXISTS step_id    text,         -- S01..S31
  ADD COLUMN IF NOT EXISTS phase_id   text,         -- F1..F6
  ADD COLUMN IF NOT EXISTS form_data  text,         -- JSON semua field form per stage
  ADD COLUMN IF NOT EXISTS done_date  timestamp;    -- override done_date dari date ke timestamp (aman, already date)

-- Buat unique constraint step_id per project (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_steps_project_id_step_id_key'
  ) THEN
    ALTER TABLE public.project_steps
      ADD CONSTRAINT project_steps_project_id_step_id_key
      UNIQUE (project_id, step_id);
  END IF;
END $$;

-- ── 3. Tabel rab_items (jika belum ada) ───────────────────────
CREATE TABLE IF NOT EXISTS public.rab_items (
  id           bigint generated always as identity primary key,
  project_id   bigint NOT NULL references public.projects(id) ON DELETE CASCADE,
  category     text   NOT NULL,             -- LAB_TEST, OPS
  product_id   text,                        -- FK ke products.id (jika LAB_TEST)
  item_name    text   NOT NULL,
  unit         text,
  qty          numeric DEFAULT 0,
  qty_actual   numeric DEFAULT 0,
  unit_price   numeric DEFAULT 0,
  total_price  numeric DEFAULT 0,           -- plan
  total_actual numeric DEFAULT 0,           -- realisasi
  notes        text,                        -- kategori|scheme|source
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);

-- ── 4. Index untuk performa ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_steps_project_id ON public.project_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_step_id    ON public.project_steps(step_id);
CREATE INDEX IF NOT EXISTS idx_rab_items_project_id     ON public.rab_items(project_id);
CREATE INDEX IF NOT EXISTS idx_rab_items_category       ON public.rab_items(category);
CREATE INDEX IF NOT EXISTS idx_projects_status          ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_tanggal         ON public.projects(tanggal_pelaksanaan);

-- ── 5. Disable RLS (sesuai pola file lain) ────────────────────
ALTER TABLE public.project_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_items     DISABLE ROW LEVEL SECURITY;

-- ── 6. Sync pic_sales dari pic_onelab yang sudah ada ──────────
UPDATE public.projects
SET pic_sales = pic_onelab
WHERE pic_sales IS NULL AND pic_onelab IS NOT NULL;

-- ✅ Migration MCU v5 selesai
