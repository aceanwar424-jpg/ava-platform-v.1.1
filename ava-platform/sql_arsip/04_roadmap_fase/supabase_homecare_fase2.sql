-- ══════════════════════════════════════════════════════════════
-- OneLab — HOME CARE · FASE 2 (Dokumentasi Klinis & Kepatuhan)
-- ──────────────────────────────────────────────────────────────
-- Menambah homecare_visit_records: tanda vital, catatan asuhan,
-- tindakan, persetujuan (consent) pasien, dan bukti kunjungan.
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.homecare_visit_records (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.homecare_visit_records
  ADD COLUMN IF NOT EXISTS order_id       bigint,
  -- Tanda vital
  ADD COLUMN IF NOT EXISTS bp_systolic    integer,
  ADD COLUMN IF NOT EXISTS bp_diastolic   integer,
  ADD COLUMN IF NOT EXISTS pulse          integer,
  ADD COLUMN IF NOT EXISTS temperature    numeric,
  ADD COLUMN IF NOT EXISTS resp_rate      integer,
  ADD COLUMN IF NOT EXISTS spo2           integer,
  ADD COLUMN IF NOT EXISTS weight         numeric,
  ADD COLUMN IF NOT EXISTS height         numeric,
  -- Catatan klinis
  ADD COLUMN IF NOT EXISTS complaint      text,   -- keluhan
  ADD COLUMN IF NOT EXISTS nursing_notes  text,   -- catatan asuhan
  ADD COLUMN IF NOT EXISTS actions_done   text,   -- tindakan yang dilakukan
  -- Kepatuhan / bukti
  ADD COLUMN IF NOT EXISTS consent_given  boolean default false,
  ADD COLUMN IF NOT EXISTS consent_name   text,   -- nama penandatangan consent
  ADD COLUMN IF NOT EXISTS photo_url      text,   -- bukti kunjungan
  ADD COLUMN IF NOT EXISTS recorded_by    text,
  ADD COLUMN IF NOT EXISTS recorded_at    timestamp default now(),
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.homecare_visit_records ADD CONSTRAINT fk_hcvisit_order
    FOREIGN KEY (order_id) REFERENCES public.homecare_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.homecare_visit_records DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_hcvisit_order ON public.homecare_visit_records(order_id);

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='homecare_visit_records';
