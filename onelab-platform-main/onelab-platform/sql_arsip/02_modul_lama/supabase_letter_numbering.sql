-- ════════════════════════════════════════════════════════════════
-- SURAT KELUAR — Pengelolaan Departemen & Format Penomoran
-- ════════════════════════════════════════════════════════════════

-- ── 1. DEPARTEMEN (untuk kode surat per departemen) ──────────────
CREATE TABLE IF NOT EXISTS public.letter_departments (
  id           bigint generated always as identity primary key,
  dept_code    text not null unique,   -- contoh: OPS, FIN, HRD, MKT
  dept_name    text not null,          -- contoh: Operasional, Finance, HRD
  is_active    boolean default true,
  created_at   timestamp default now()
);

-- ── 2. FORMAT PENOMORAN (template yang bisa disusun bebas via token) ──
-- format_template menyimpan urutan token dipisah '/', contoh:
--   "{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}"
-- Tokens yang didukung: {SEQ} {SEQ2} {SEQ3} {SEQ4} {TYPE} {DEPT} {ORG}
--                        {MONTH} {MONTH_ROMAN} {YEAR} {YEAR_SHORT}
CREATE TABLE IF NOT EXISTS public.letter_number_format (
  id               bigint generated always as identity primary key,
  format_template  text not null default '{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}',
  org_code         text not null default 'OL',
  org_city         text not null default 'Tangerang Selatan',
  seq_reset_period text not null default 'monthly',  -- monthly | yearly | never
  is_active        boolean default true,
  updated_at       timestamp default now()
);
-- Ensure only one active config row by convention (app enforces this, not a DB constraint)
INSERT INTO public.letter_number_format (format_template, org_code, org_city, seq_reset_period)
SELECT '{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}', 'OL', 'Tangerang Selatan', 'monthly'
WHERE NOT EXISTS (SELECT 1 FROM public.letter_number_format);

-- ── 3. EXTEND letter_sequences & outgoing_letters with dept_code ──
ALTER TABLE public.letter_sequences  ADD COLUMN IF NOT EXISTS dept_code text;
ALTER TABLE public.outgoing_letters  ADD COLUMN IF NOT EXISTS dept_code text;

-- Update the uniqueness constraint on letter_sequences to also key on dept_code,
-- so each department gets its own independent running sequence per type/period.
ALTER TABLE public.letter_sequences DROP CONSTRAINT IF EXISTS letter_sequences_year_month_type_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS letter_sequences_unique_key
  ON public.letter_sequences (year, month, type_code, COALESCE(dept_code, ''));

-- ── RLS (open to authenticated, matching project convention) ─────
ALTER TABLE public.letter_departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_number_format  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "letter_departments_all"   ON public.letter_departments;
DROP POLICY IF EXISTS "letter_number_format_all" ON public.letter_number_format;
CREATE POLICY "letter_departments_all"   ON public.letter_departments   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "letter_number_format_all" ON public.letter_number_format FOR ALL USING (true) WITH CHECK (true);

-- ── Seed a few common departments to start with (safe to edit/delete after) ──
INSERT INTO public.letter_departments (dept_code, dept_name) VALUES
  ('OPS', 'Operasional'),
  ('FIN', 'Finance'),
  ('HRD', 'Human Resources'),
  ('MKT', 'Marketing'),
  ('LAB', 'Laboratorium')
ON CONFLICT (dept_code) DO NOTHING;
