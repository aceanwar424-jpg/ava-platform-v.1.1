-- ══════════════════════════════════════════════════════════════
-- OneLab — HOME CARE · FASE 0 (Fondasi Data)
-- ──────────────────────────────────────────────────────────────
-- Tujuan Fase 0:
--   1. Master Nakes (tenaga kesehatan) tertaut ke employees
--   2. Master tarif & komisi per layanan / per nakes (ganti fee 15% hardcode)
--   3. Lengkapi kolom homecare_orders untuk keterhubungan & jejak audit
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
--
-- CATATAN: RLS di-DISABLE agar konsisten arsitektur anon-key saat ini.
-- Pengetatan akses data pasien (UU PDP) adalah pekerjaan Fase 5.
-- ══════════════════════════════════════════════════════════════

-- ── 1. HOMECARE_STAFF — master Nakes ───────────────────────────
CREATE TABLE IF NOT EXISTS public.homecare_staff (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.homecare_staff
  ADD COLUMN IF NOT EXISTS employee_id     bigint,   -- FK ke employees (opsional)
  ADD COLUMN IF NOT EXISTS staff_name      text,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS role_title      text,     -- Perawat, Analis, Fisioterapis, Dokter
  ADD COLUMN IF NOT EXISTS competencies    text,     -- daftar layanan yang boleh dikerjakan
  ADD COLUMN IF NOT EXISTS coverage_area   text,     -- wilayah cakupan kunjungan
  ADD COLUMN IF NOT EXISTS commission_pct  numeric default 15,  -- override default 15%
  ADD COLUMN IF NOT EXISTS is_active        boolean default true,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.homecare_staff ADD CONSTRAINT fk_hcstaff_employee
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL; END $$;

-- ── 2. HOMECARE_TARIFFS — master tarif & komisi per layanan ────
CREATE TABLE IF NOT EXISTS public.homecare_tariffs (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.homecare_tariffs
  ADD COLUMN IF NOT EXISTS service_type   text,     -- selaras HC_SERVICES di modul
  ADD COLUMN IF NOT EXISTS base_price      numeric default 0,
  ADD COLUMN IF NOT EXISTS commission_pct  numeric default 15,
  ADD COLUMN IF NOT EXISTS commission_flat numeric default 0,  -- alternatif nominal tetap
  ADD COLUMN IF NOT EXISTS is_active        boolean default true,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

-- Seed tarif awal dari daftar layanan yang ada di modul (skip jika sudah ada)
INSERT INTO public.homecare_tariffs (service_type, base_price, commission_pct)
SELECT s, 0, 15
FROM (VALUES
  ('Pengambilan Sampel Darah'),('Cek Gula Darah'),('Cek Kolesterol'),
  ('Injeksi'),('Perawatan Luka'),('Fisioterapi'),('Nebulizer'),
  ('Cek Tekanan Darah'),('EKG Home Visit'),('Paket MCU Home'),
  ('Konsultasi Dokter'),('Lainnya')
) AS v(s)
WHERE NOT EXISTS (
  SELECT 1 FROM public.homecare_tariffs t WHERE t.service_type = v.s
);

-- ── 3. HOMECARE_ORDERS — lengkapi kolom keterhubungan & audit ──
CREATE TABLE IF NOT EXISTS public.homecare_orders (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.homecare_orders
  -- kolom yang sudah dipakai modul (idempoten bila sudah ada)
  ADD COLUMN IF NOT EXISTS order_number    text,
  ADD COLUMN IF NOT EXISTS patient_name    text,
  ADD COLUMN IF NOT EXISTS patient_phone   text,
  ADD COLUMN IF NOT EXISTS patient_address text,
  ADD COLUMN IF NOT EXISTS service_type    text,
  ADD COLUMN IF NOT EXISTS scheduled_date  date,
  ADD COLUMN IF NOT EXISTS scheduled_time  text,
  ADD COLUMN IF NOT EXISTS assigned_staff  text,
  ADD COLUMN IF NOT EXISTS status          text default 'Baru',
  ADD COLUMN IF NOT EXISTS total_amount    numeric default 0,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS partner_id      bigint,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now(),
  -- kolom BARU Fase 0 untuk fase-fase berikutnya
  ADD COLUMN IF NOT EXISTS staff_id        bigint,  -- tautan ke homecare_staff
  ADD COLUMN IF NOT EXISTS patient_id      bigint,  -- tautan ke pasien/medrecord (opsional)
  ADD COLUMN IF NOT EXISTS commission_amount numeric default 0,  -- fee nakes terhitung
  ADD COLUMN IF NOT EXISTS cancel_reason   text;    -- alasan pembatalan (Fase 1)

DO $$ BEGIN
  ALTER TABLE public.homecare_orders ADD CONSTRAINT fk_hcorder_staff
    FOREIGN KEY (staff_id) REFERENCES public.homecare_staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Disable RLS (konsisten arsitektur saat ini) ─────────────
ALTER TABLE public.homecare_staff   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homecare_tariffs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.homecare_orders  DISABLE ROW LEVEL SECURITY;

-- ── 5. Index ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hc_sched     ON public.homecare_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_hc_status    ON public.homecare_orders(status);
CREATE INDEX IF NOT EXISTS idx_hc_staff     ON public.homecare_orders(staff_id);
CREATE INDEX IF NOT EXISTS idx_hcstaff_act  ON public.homecare_staff(is_active);
CREATE INDEX IF NOT EXISTS idx_hctariff_svc ON public.homecare_tariffs(service_type);

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('homecare_orders','homecare_staff','homecare_tariffs')
ORDER BY table_name;
