-- ══════════════════════════════════════════════════════════════
-- OneLab · Registrasi Klinik — Family Registry & Diskon Berjenjang
-- Jalankan SEKALI di Supabase SQL Editor. Idempoten (aman diulang).
-- Prasyarat: supabase_config_lab.sql sudah dijalankan.
-- ══════════════════════════════════════════════════════════════

-- ── 1. FAMILIES — registry keluarga (kartu keluarga / membership) ──
CREATE TABLE IF NOT EXISTS public.families (
  id             bigint generated always as identity primary key,
  family_code    text unique,                 -- FAM-0001
  family_name    text not null,               -- "Keluarga Budi Santoso"
  pic_name       text,                        -- kepala keluarga / PIC
  pic_phone      text,
  address        text,
  -- Skema diskon anggota
  discount_type  text default 'percent',      -- percent | fixed
  discount_value numeric default 0,           -- mis. 10 (%) atau 50000 (Rp)
  membership_no  text,
  valid_until    date,
  status         text default 'Aktif',        -- Aktif | Non-Aktif
  notes          text,
  created_by     text,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

-- ── 2. FAMILY_MEMBERS — anggota dalam satu keluarga ───────────────
CREATE TABLE IF NOT EXISTS public.family_members (
  id            bigint generated always as identity primary key,
  family_id     bigint references public.families(id) on delete cascade,
  family_name   text,
  member_name   text not null,
  relationship  text,                          -- Kepala Keluarga, Istri, Anak, dll
  gender        text,
  birth_date    date,
  phone         text,
  id_number     text,                          -- NIK
  is_primary    boolean default false,
  notes         text,
  created_at    timestamp default now()
);

-- ── 3. ADMISSIONS — kolom diskon berjenjang + voucher ─────────────
ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS discount_scheme    text default 'umum',  -- umum | family | corporate
  ADD COLUMN IF NOT EXISTS scheme_ref_id      bigint,               -- family_id / corporate_id
  ADD COLUMN IF NOT EXISTS scheme_name        text,
  ADD COLUMN IF NOT EXISTS scheme_discount    numeric default 0,    -- Rp diskon dari skema
  ADD COLUMN IF NOT EXISTS family_id          bigint,
  ADD COLUMN IF NOT EXISTS voucher_id         bigint,
  ADD COLUMN IF NOT EXISTS voucher_code       text,
  ADD COLUMN IF NOT EXISTS voucher_discount   numeric default 0,    -- Rp diskon dari voucher
  ADD COLUMN IF NOT EXISTS gross_amount       numeric default 0,    -- total sebelum diskon apapun
  ADD COLUMN IF NOT EXISTS line_discount      numeric default 0;    -- total diskon per-baris

-- ── 4. Index ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_families_status       ON public.families(status);
CREATE INDEX IF NOT EXISTS idx_admissions_family     ON public.admissions(family_id);

-- ── 5. RLS (mengikuti pola aplikasi saat ini) ─────────────────────
ALTER TABLE public.families        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members  DISABLE ROW LEVEL SECURITY;

-- ── 6. Contoh data (opsional, boleh dihapus) ──────────────────────
INSERT INTO public.families (family_code, family_name, pic_name, pic_phone, discount_type, discount_value, status)
VALUES ('FAM-0001','Keluarga Contoh','Budi Santoso','0812xxxxxxx','percent',10,'Aktif')
ON CONFLICT (family_code) DO NOTHING;

SELECT 'Registration discount migration done — families, family_members, admissions cols' AS status;
