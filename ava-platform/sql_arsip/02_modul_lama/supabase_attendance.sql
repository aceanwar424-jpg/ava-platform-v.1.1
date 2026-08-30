-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Attendance, Work Locations, Positions (Org Structure)
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. work_locations (multi-titik GPS) ───────────────────────
CREATE TABLE IF NOT EXISTS public.work_locations (
  id          bigint generated always as identity primary key,
  name        text NOT NULL,
  latitude    numeric(10,7) NOT NULL,
  longitude   numeric(10,7) NOT NULL,
  radius_m    integer DEFAULT 10,
  notes       text,
  is_active   boolean DEFAULT true,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);

-- ── 2. attendance ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
  id                    bigint generated always as identity primary key,
  employee_id           bigint references public.employees(id),
  employee_name         text NOT NULL,
  tanggal               date NOT NULL,
  shift_code            text,
  location_name         text,
  -- Clock In
  clock_in_at           timestamp,
  clock_in_lat          numeric(10,7),
  clock_in_lng          numeric(10,7),
  clock_in_foto_url     text,
  clock_in_distance_m   integer DEFAULT 0,
  clock_in_status       text,  -- OnTime, Late, VeryLate
  -- Clock Out
  clock_out_at          timestamp,
  clock_out_lat         numeric(10,7),
  clock_out_lng         numeric(10,7),
  clock_out_foto_url    text,
  clock_out_distance_m  integer DEFAULT 0,
  -- Computed
  total_jam_kerja       numeric(5,2),
  leave_type            text,  -- null, Cuti, Sakit, Izin, Alpa
  notes                 text,
  created_at            timestamp DEFAULT now(),
  updated_at            timestamp DEFAULT now(),
  UNIQUE(employee_name, tanggal)
);

-- ── 3. work_schedules — update schema ─────────────────────────
-- Kolom baru untuk jam sabtu dan rotasi
ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS shift_code          text DEFAULT 'P1',
  ADD COLUMN IF NOT EXISTS jam_masuk_weekday   time,
  ADD COLUMN IF NOT EXISTS jam_pulang_weekday  time,
  ADD COLUMN IF NOT EXISTS jam_masuk_sabtu     time,
  ADD COLUMN IF NOT EXISTS jam_pulang_sabtu    time,
  ADD COLUMN IF NOT EXISTS rotation_type       text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS rotation_partner_id bigint;

-- Migrate existing jam_masuk → jam_masuk_weekday jika ada
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_schedules' AND column_name='jam_masuk') THEN
    UPDATE public.work_schedules SET jam_masuk_weekday = jam_masuk::time WHERE jam_masuk_weekday IS NULL AND jam_masuk IS NOT NULL;
    UPDATE public.work_schedules SET jam_pulang_weekday = jam_pulang::time WHERE jam_pulang_weekday IS NULL AND jam_pulang IS NOT NULL;
  END IF;
END $$;

-- ── 4. positions (jabatan & org structure) ────────────────────
CREATE TABLE IF NOT EXISTS public.positions (
  id          bigint generated always as identity primary key,
  title       text NOT NULL,
  department  text,
  level       integer DEFAULT 3,  -- 1=CEO, 2=Manager, 3=Staff, 4=Support
  parent_id   bigint references public.positions(id),
  is_medical  boolean DEFAULT false,
  min_salary  numeric DEFAULT 0,
  max_salary  numeric DEFAULT 0,
  description text,
  created_by  text,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);

-- ── 5. report_records (history pelaporan) ─────────────────────
CREATE TABLE IF NOT EXISTS public.report_records (
  id            bigint generated always as identity primary key,
  report_type   text NOT NULL,  -- INM, IKP, SISDMK, SIMPEL, etc
  title         text,
  period        text,           -- 2025-Q1, 2025-06, dll
  submitted_by  text,
  submitted_at  timestamp,
  file_url      text,
  status        text DEFAULT 'Submitted',
  notes         text,
  task_id       bigint references public.tasks(id),
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date   ON public.attendance(employee_name, tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_tanggal    ON public.attendance(tanggal);
CREATE INDEX IF NOT EXISTS idx_work_locations_active ON public.work_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_positions_dept        ON public.positions(department, level);
CREATE INDEX IF NOT EXISTS idx_report_records_type   ON public.report_records(report_type);

-- ── Disable RLS ───────────────────────────────────────────────
ALTER TABLE public.work_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_records DISABLE ROW LEVEL SECURITY;

-- ✅ Migration Attendance & Org Structure selesai
