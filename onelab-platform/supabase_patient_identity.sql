-- ════════════════════════════════════════════════════════════════
-- PATIENT IDENTITY REBUILD — postal code lookup, multi-ID support,
-- extended demographic fields (matches Virtu Digilab reference structure)
-- ════════════════════════════════════════════════════════════════

-- ── 1. POSTAL CODE LOOKUP (for address autofill) ──────────────────
-- Indonesian postal codes mapped to subdistrict/district/city/province.
-- Used to auto-populate address fields when user types a kode pos,
-- while remaining fully editable afterward (per requirement).
CREATE TABLE IF NOT EXISTS public.postal_codes (
  id           bigint generated always as identity primary key,
  postal_code  text not null,
  subdistrict  text,   -- Kelurahan/Desa
  district     text,   -- Kecamatan
  city         text,   -- Kabupaten/Kota
  province     text
);
CREATE INDEX IF NOT EXISTS idx_postal_codes_code ON public.postal_codes(postal_code);

-- ── 2. PATIENT IDS (multi-ID support, e.g. ID Card + STR/SIP + Visa) ──
-- One patient can have multiple identity documents, matching the
-- "Add ID" sub-table in the reference (ID Type / ID Number / Issuer Country).
CREATE TABLE IF NOT EXISTS public.patient_ids (
  id              bigint generated always as identity primary key,
  admission_id    bigint references public.admissions(id) on delete cascade,
  is_primary      boolean default false,
  id_type         text not null,   -- see allowed values below
  id_number       text not null,
  issuer_country  text default 'Indonesia',
  created_at      timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_patient_ids_admission ON public.patient_ids(admission_id);
-- Allowed id_type values (enforced at application layer, matches reference dropdown):
-- STR/SIP Number, ID Card Number, Organization Identifier, Health Plan Identifier,
-- Work Permit, Workers' Comp Number, WIC Identifier, VISA, Visitor Permit,
-- Visit Number, Unique Specimen ID, Medicare/CMS, Universal Device Identifier,
-- Unspecified Identifier

-- ── 3. EXTEND ADMISSIONS — full Virtu-style patient demographic fields ──
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_salutation     text;            -- Mr/Mrs/Ms/dll
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_place_of_birth text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_country_of_birth text default 'Indonesia';
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_email          text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_blood_type     text;            -- A/B/AB/O (+/-)
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_marital_status text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_religion       text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_ethnicity      text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_category       text default 'WNI'; -- WNI/WNA
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_photo_url      text;
-- Structured address (in addition to existing free-text patient_address, which becomes
-- the manually-editable detail line — street/house number — while these are the
-- postal-code-driven administrative levels)
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_postal_code    text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_subdistrict    text;  -- Kelurahan
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_district       text;  -- Kecamatan
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_city           text;  -- Kab/Kota
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS patient_province       text;
-- MR Number — persistent patient identifier across visits (separate from visit_number)
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS mr_number              text;
CREATE INDEX IF NOT EXISTS idx_admissions_mr_number ON public.admissions(mr_number);

-- ── 4. PRODUCT ITEM SPECIMEN (per-component specimen type) ──────────
-- Extends package_items so each individual test component within a
-- panel (e.g. WBC/RBC/HGB under "Hematologi Lengkap") can carry its
-- own specimen type, matching the Virtu "Product Item List" Specimen
-- column. This is finer-grained than products.sampel_type (whole-test level).
CREATE TABLE IF NOT EXISTS public.product_items (
  id              bigint generated always as identity primary key,
  product_id      bigint references public.products(id) on delete cascade,
  code            text,             -- e.g. WBC, RBC, HGB
  uom             text,
  name_id         text not null,
  name_en         text,
  display_order   integer default 1,
  specimen_type   text,             -- e.g. "BLOOD, WHOLE" — drives label printing
  is_active       boolean default true
);
CREATE INDEX IF NOT EXISTS idx_product_items_product ON public.product_items(product_id);

-- ── ROW LEVEL SECURITY (match existing project convention: open to authenticated) ──
ALTER TABLE public.postal_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_ids   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "postal_codes_all"  ON public.postal_codes;
DROP POLICY IF EXISTS "patient_ids_all"   ON public.patient_ids;
DROP POLICY IF EXISTS "product_items_all" ON public.product_items;
CREATE POLICY "postal_codes_all"  ON public.postal_codes  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "patient_ids_all"   ON public.patient_ids   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "product_items_all" ON public.product_items FOR ALL USING (true) WITH CHECK (true);
