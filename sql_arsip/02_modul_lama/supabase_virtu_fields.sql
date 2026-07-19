-- ══════════════════════════════════════════════════════════════════
-- OneLab · Penyesuaian field mengikuti Virtu Digilab
-- (Master Product lengkap + Anamnesa antropometri). Idempoten.
-- ══════════════════════════════════════════════════════════════════

-- ── PRODUCTS — field ala Virtu ─────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS type            text default 'DIAGNOSTIC', -- Type
  ADD COLUMN IF NOT EXISTS service_mapping text,                      -- Service Mapping
  ADD COLUMN IF NOT EXISTS nama_en         text,                      -- Name (En)
  ADD COLUMN IF NOT EXISTS gender          text default 'All',        -- All | M | F
  ADD COLUMN IF NOT EXISTS age_note        text,                      -- Age (rentang/keterangan)
  ADD COLUMN IF NOT EXISTS description_id  text,                      -- Description (ID)
  ADD COLUMN IF NOT EXISTS description_en  text,                      -- Description (EN)
  ADD COLUMN IF NOT EXISTS benefit_id      text,                      -- Benefit (ID)
  ADD COLUMN IF NOT EXISTS benefit_en      text,                      -- Benefit (EN)
  ADD COLUMN IF NOT EXISTS preparation_id  text,                      -- Preparation (ID)
  ADD COLUMN IF NOT EXISTS preparation_en  text,                      -- Preparation (EN)
  ADD COLUMN IF NOT EXISTS show_on_virtu   boolean default true,
  ADD COLUMN IF NOT EXISTS homecare        boolean default false,
  ADD COLUMN IF NOT EXISTS medical_kit     boolean default false,
  ADD COLUMN IF NOT EXISTS peduli_lindungi boolean default false;

-- ── ANAMNESAS — practitioner, test date, antropometri lengkap ──────
ALTER TABLE public.anamnesas
  ADD COLUMN IF NOT EXISTS practitioner    text,
  ADD COLUMN IF NOT EXISTS test_date       date,
  ADD COLUMN IF NOT EXISTS ideal_weight    numeric,
  ADD COLUMN IF NOT EXISTS abdomen_circ    numeric,  -- lingkar perut (cm)
  ADD COLUMN IF NOT EXISTS chest_circ      numeric,  -- lingkar dada (cm)
  ADD COLUMN IF NOT EXISTS head_circ       numeric,  -- lingkar kepala (cm)
  ADD COLUMN IF NOT EXISTS notes           text;

ALTER TABLE public.anamnesas ADD COLUMN IF NOT EXISTS observation text;

-- ── ICD-X DIAGNOSTIC (per kunjungan) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.icd_diagnostics (
  id            bigint generated always as identity primary key,
  admission_id  bigint references public.admissions(id) on delete cascade,
  icd_code      text,
  diagnose_name text,
  diagnose_type text default 'PRIMARY',   -- PRIMARY | SECONDARY
  case_type     text default 'NEW',       -- NEW | OLD
  description   text,
  dx_date       date,
  created_by    text,
  created_at    timestamp default now()
);
ALTER TABLE public.icd_diagnostics DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_icd_admission ON public.icd_diagnostics(admission_id);

SELECT 'Virtu fields (products + anamnesas + ICD) ready' AS status;
