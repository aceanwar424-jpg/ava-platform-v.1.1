-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 1.1b : Pengetatan akses per peran
-- ──────────────────────────────────────────────────────────────
-- JANGAN DIJALANKAN SEBELUM 1.1a TERBUKTI AMAN DI APLIKASI.
--
-- Kebijakan di sini menerjemahkan matriks yang SUDAH ADA di
-- modules/settings_users.js (ROLE_DEFAULT_PAGES) menjadi aturan
-- di tingkat basis data — bukan matriks baru.
--
--   sales         : partner, maps, leads, marketing, okr, mcu, surat, mou
--                   → TIDAK punya satu pun halaman klinis
--   operasional   : lab, klinik, rekam medis, homecare, inventory
--   hrd_staff     : kepegawaian saja
--   finance_staff : kasir & keuangan saja
--   viewer        : dashboard saja
--   spv/manager/direktur/super_admin : seluruh operasional
--
-- RISIKO: kebijakan yang salah membuat pengguna melihat layar kosong.
-- Uji dengan SATU akun per peran sebelum dianggap selesai.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- Peran yang boleh menyentuh data klinis.
-- 'sales' dan 'viewer' sengaja TIDAK ada di daftar ini.
CREATE OR REPLACE FUNCTION public.can_access_clinical()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() IN
    ('super_admin','direktur','manager','spv','operasional')
$$;

-- Peran yang boleh menyentuh data keuangan.
CREATE OR REPLACE FUNCTION public.can_access_finance()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() IN
    ('super_admin','direktur','manager','finance_staff')
$$;

-- Peran yang boleh menyentuh data kepegawaian.
CREATE OR REPLACE FUNCTION public.can_access_hr()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() IN
    ('super_admin','direktur','manager','hrd_staff')
$$;

-- ── Data klinis: ganti kebijakan "asal login" jadi per peran ───
DO $$
DECLARE
  t text;
  daftar text[] := ARRAY[
    'lab_results','lab_samples','admissions','anamnesas',
    'homecare_orders','homecare_visit_records','critical_value_notifications',
    'patient_ids','families','family_members','sample_labels','sample_label_items'
  ];
BEGIN
  FOREACH t IN ARRAY daftar LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- kebijakan longgar dari 1.1a dicabut
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_clinical', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (public.can_access_clinical()) WITH CHECK (public.can_access_clinical())',
        t || '_clinical', t
      );
      RAISE NOTICE 'kebijakan klinis: %', t;
    END IF;
  END LOOP;
END $$;

-- ── Data keuangan ──────────────────────────────────────────────
DO $$
DECLARE
  t text;
  daftar text[] := ARRAY['invoices','cashier_transactions'];
BEGIN
  FOREACH t IN ARRAY daftar LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_finance', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (public.can_access_finance()) WITH CHECK (public.can_access_finance())',
        t || '_finance', t
      );
      RAISE NOTICE 'kebijakan keuangan: %', t;
    END IF;
  END LOOP;
END $$;

-- ── Data kepegawaian ───────────────────────────────────────────
-- Karyawan tetap boleh melihat datanya sendiri (lewat user_profiles.id).
DO $$
DECLARE
  t text;
  daftar text[] := ARRAY['employees','leave_requests','attendance','work_schedules'];
BEGIN
  FOREACH t IN ARRAY daftar LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_hr', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (public.can_access_hr()) WITH CHECK (public.can_access_hr())',
        t || '_hr', t
      );
      RAISE NOTICE 'kebijakan kepegawaian: %', t;
    END IF;
  END LOOP;
END $$;

-- ── Profil pengguna: baca sendiri; super_admin kelola semua ────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_self  ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_admin ON public.user_profiles;

CREATE POLICY user_profiles_self ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_app_role() IN ('super_admin','direktur','manager','hrd_staff'));

CREATE POLICY user_profiles_admin ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.current_app_role() = 'super_admin')
  WITH CHECK (public.current_app_role() = 'super_admin');

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT c.relname AS tabel, p.polname AS kebijakan, c.relrowsecurity AS rls_aktif
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname='public'
  AND c.relname IN ('lab_results','admissions','invoices','employees','user_profiles')
ORDER BY c.relname, p.polname;

-- Uji cepat peran (jalankan sambil login sebagai pengguna tertentu):
--   SELECT public.current_app_role(), public.can_access_clinical();

-- ══════════════════════════════════════════════════════════════
-- PEMBATALAN — kembali ke kebijakan longgar 1.1a
-- ══════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'lab_results','lab_samples','admissions','anamnesas',
--     'homecare_orders','homecare_visit_records','critical_value_notifications',
--     'patient_ids','families','family_members','sample_labels','sample_label_items'
--   ] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_clinical', t);
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
--                     USING (true) WITH CHECK (true)', t||'_authenticated', t);
--   END LOOP;
-- END $$;
