-- ══════════════════════════════════════════════════════════════════════
-- OneLab · MASTER SETUP — Klinik / Registrasi / LIS
-- ----------------------------------------------------------------------
-- Jalankan SEKALI di Supabase → SQL Editor (boleh diulang; idempoten).
-- Mencakup SEMUA objek yang dibutuhkan fitur terbaru:
--   • Registrasi: kolom demografi pasien, diskon berjenjang, family registry
--   • Produk: is_panel, product_items (komponen panel)
--   • Label sampel: sample_labels, sample_label_items  ← belum ada di file lain!
--   • LIS: nilai kritis, TAT, QC analyzer
--   • Voucher: voucher_campaigns, vouchers
--
-- Prasyarat minimum: supabase_config_lab.sql sudah dijalankan (tabel dasar
-- products, packages, package_items, admissions, analyzers, ref_ranges,
-- lab_samples, lab_results). Script ini melengkapi sisanya secara aman.
-- ══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. PRODUCTS — pastikan penanda panel ada
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_panel boolean default false;

-- 1b. PRODUCT_ITEMS — komponen tes dalam panel (WBC/RBC/HGB, dst)
CREATE TABLE IF NOT EXISTS public.product_items (
  id            bigint generated always as identity primary key,
  product_id    bigint references public.products(id) on delete cascade,
  code          text,
  uom           text,
  name_id       text not null,
  name_en       text,
  display_order integer default 1,
  specimen_type text,                 -- mis. "BLOOD, WHOLE" → penentu label
  is_active     boolean default true
);
CREATE INDEX IF NOT EXISTS idx_product_items_product ON public.product_items(product_id);

-- ─────────────────────────────────────────────────────────────────────
-- 2. ADMISSIONS — demografi pasien (Virtu-style) + diskon berjenjang
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.admissions
  -- demografi & identitas
  ADD COLUMN IF NOT EXISTS mr_number                text,
  ADD COLUMN IF NOT EXISTS patient_salutation       text,
  ADD COLUMN IF NOT EXISTS patient_place_of_birth   text,
  ADD COLUMN IF NOT EXISTS patient_country_of_birth text default 'Indonesia',
  ADD COLUMN IF NOT EXISTS patient_email            text,
  ADD COLUMN IF NOT EXISTS patient_blood_type       text,
  ADD COLUMN IF NOT EXISTS patient_marital_status   text,
  ADD COLUMN IF NOT EXISTS patient_religion         text,
  ADD COLUMN IF NOT EXISTS patient_ethnicity        text,
  ADD COLUMN IF NOT EXISTS patient_category         text default 'WNI',
  ADD COLUMN IF NOT EXISTS patient_photo_url        text,
  ADD COLUMN IF NOT EXISTS patient_postal_code      text,
  ADD COLUMN IF NOT EXISTS patient_subdistrict      text,
  ADD COLUMN IF NOT EXISTS patient_district         text,
  ADD COLUMN IF NOT EXISTS patient_city             text,
  ADD COLUMN IF NOT EXISTS patient_province         text,
  ADD COLUMN IF NOT EXISTS patient_class            text,
  ADD COLUMN IF NOT EXISTS payment_type             text,
  -- diskon berjenjang & voucher
  ADD COLUMN IF NOT EXISTS discount_scheme          text default 'umum',  -- umum|family|corporate
  ADD COLUMN IF NOT EXISTS scheme_ref_id            bigint,
  ADD COLUMN IF NOT EXISTS scheme_name              text,
  ADD COLUMN IF NOT EXISTS scheme_discount          numeric default 0,
  ADD COLUMN IF NOT EXISTS family_id                bigint,
  ADD COLUMN IF NOT EXISTS voucher_id               bigint,
  ADD COLUMN IF NOT EXISTS voucher_code             text,
  ADD COLUMN IF NOT EXISTS voucher_discount         numeric default 0,
  ADD COLUMN IF NOT EXISTS gross_amount             numeric default 0,
  ADD COLUMN IF NOT EXISTS line_discount            numeric default 0;
CREATE INDEX IF NOT EXISTS idx_admissions_mr_number ON public.admissions(mr_number);
CREATE INDEX IF NOT EXISTS idx_admissions_family    ON public.admissions(family_id);

-- 2b. PATIENT_IDS — dokumen identitas multi-baris (Add ID)
CREATE TABLE IF NOT EXISTS public.patient_ids (
  id             bigint generated always as identity primary key,
  admission_id   bigint references public.admissions(id) on delete cascade,
  is_primary     boolean default false,
  id_type        text not null,
  id_number      text not null,
  issuer_country text default 'Indonesia',
  created_at     timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_patient_ids_admission ON public.patient_ids(admission_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. FAMILIES + FAMILY_MEMBERS — registry keluarga (diskon Family Member)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.families (
  id             bigint generated always as identity primary key,
  family_code    text unique,
  family_name    text not null,
  pic_name       text,
  pic_phone      text,
  address        text,
  discount_type  text default 'percent',   -- percent | fixed
  discount_value numeric default 0,
  membership_no  text,
  valid_until    date,
  status         text default 'Aktif',
  notes          text,
  created_by     text,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  id           bigint generated always as identity primary key,
  family_id    bigint references public.families(id) on delete cascade,
  family_name  text,
  member_name  text not null,
  relationship text,
  gender       text,
  birth_date   date,
  phone        text,
  id_number    text,
  is_primary   boolean default false,
  notes        text,
  created_at   timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_families_status       ON public.families(status);

-- ─────────────────────────────────────────────────────────────────────
-- 4. SAMPLE LABELS — label barcode per spesimen (dibuat saat registrasi)
--    (tabel ini SEBELUMNYA tidak ada di file SQL manapun)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sample_labels (
  id             bigint generated always as identity primary key,
  label_barcode  text,
  admission_id   bigint references public.admissions(id) on delete cascade,
  visit_number   text,
  patient_name   text,
  patient_dob    date,
  patient_gender text,
  sampel_type    text,
  status         text default 'Created',   -- Created | CheckedIn
  collected_at   timestamp,
  collected_by   text,
  checked_in_at  timestamp,
  created_by     text,
  created_at     timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_sample_labels_admission ON public.sample_labels(admission_id);
CREATE INDEX IF NOT EXISTS idx_sample_labels_barcode   ON public.sample_labels(label_barcode);
CREATE INDEX IF NOT EXISTS idx_sample_labels_status    ON public.sample_labels(status);

CREATE TABLE IF NOT EXISTS public.sample_label_items (
  id           bigint generated always as identity primary key,
  label_id     bigint references public.sample_labels(id) on delete cascade,
  product_id   bigint,
  product_name text,
  kategori     text,
  created_at   timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_sample_label_items_label ON public.sample_label_items(label_id);

-- ─────────────────────────────────────────────────────────────────────
-- 5. LAB RESULTS / SAMPLES — kolom LIS (nilai kritis, TAT, rilis)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS sample_id         bigint,
  ADD COLUMN IF NOT EXISTS is_critical       boolean default false,
  ADD COLUMN IF NOT EXISTS critical_low      numeric,
  ADD COLUMN IF NOT EXISTS critical_high     numeric,
  ADD COLUMN IF NOT EXISTS condition_type    text,
  ADD COLUMN IF NOT EXISTS critical_ack_by   text,
  ADD COLUMN IF NOT EXISTS critical_ack_at   timestamp,
  ADD COLUMN IF NOT EXISTS critical_ack_note text,
  ADD COLUMN IF NOT EXISTS released_by       text,
  ADD COLUMN IF NOT EXISTS released_at       timestamp;

ALTER TABLE public.lab_samples
  ADD COLUMN IF NOT EXISTS tat_target_hours  integer,
  ADD COLUMN IF NOT EXISTS label_id          bigint;

-- 5b. LAB_QC_RUNS — log Quality Control analyzer (Westgard)
CREATE TABLE IF NOT EXISTS public.lab_qc_runs (
  id            bigint generated always as identity primary key,
  analyzer_id   bigint references public.analyzers(id),
  analyzer_name text,
  test_name     text not null,
  qc_level      text,
  lot_number    text,
  target        numeric,
  sd            numeric,
  measured      numeric not null,
  z_score       numeric,
  verdict       text,
  notes         text,
  run_by        text,
  run_at        timestamp default now(),
  created_at    timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_qc_runs_analyzer ON public.lab_qc_runs(analyzer_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_prod ON public.lab_results(patient_name, product_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status       ON public.lab_results(status);
CREATE INDEX IF NOT EXISTS idx_lab_samples_status       ON public.lab_samples(status);

-- ─────────────────────────────────────────────────────────────────────
-- 6. VOUCHER — pastikan tabel campaign & voucher ada
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voucher_campaigns (
  id             bigint generated always as identity primary key,
  campaign_name  text not null,
  campaign_code  text unique,
  description    text,
  discount_type  text default 'percent',   -- percent | fixed
  discount_value numeric default 0,
  min_purchase   numeric default 0,
  services       text,
  valid_from     date,
  valid_until    date,
  max_usage      integer default 0,
  is_active      boolean default true,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

CREATE TABLE IF NOT EXISTS public.vouchers (
  id              bigint generated always as identity primary key,
  campaign_id     bigint references public.voucher_campaigns(id) on delete cascade,
  campaign_name   text,
  code            text unique not null,
  status          text default 'Active',    -- Active | Used | Expired | Cancelled
  recipient_name  text,
  recipient_phone text,
  issued_at       timestamp default now(),
  used_at         timestamp,
  expires_at      timestamp,
  notes           text,
  created_at      timestamp default now()
);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);

-- ─────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY — mengikuti pola aplikasi saat ini (RLS OFF)
--    CATATAN KEAMANAN: untuk produksi klinis, aktifkan RLS + policy
--    berbasis auth.uid(). Aplikasi ini memakai anon key di sisi klien.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.product_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_ids        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.families           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_labels      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_label_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_qc_runs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_campaigns  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers           DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 8. Contoh data keluarga (opsional — boleh dihapus)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.families (family_code, family_name, pic_name, discount_type, discount_value, status)
VALUES ('FAM-0001','Keluarga Contoh','Budi Santoso','percent',10,'Aktif')
ON CONFLICT (family_code) DO NOTHING;

-- ── VERIFIKASI ────────────────────────────────────────────────────────
SELECT 'MASTER SETUP selesai — registrasi, diskon, family, label sampel, LIS, voucher tercakup' AS status;
