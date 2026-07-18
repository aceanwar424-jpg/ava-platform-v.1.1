-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 1.1a : Tutup akses anon ke data pasien
-- ──────────────────────────────────────────────────────────────
-- MENUTUP LUBANG YANG SEBENARNYA:
--   anon key tertanam di js/core/api.js dan ada di setiap browser.
--   Selama RLS mati, siapa pun yang menyalin kunci itu bisa membaca
--   seluruh data pasien lewat REST tanpa login sama sekali.
--
-- Berkas ini HANYA membedakan "sudah login" vs "belum login".
-- Pemisahan per peran (mis. sales tidak boleh lihat hasil lab)
-- ada di supabase_fase1_rls_b.sql, dijalankan SETELAH yang ini terbukti aman.
--
-- Kenapa dipisah: risiko terkunci pada langkah ini hampir nol karena
-- semua pengguna nyata sudah login. Pengetatan per peran punya risiko
-- nyata dan harus diuji dengan akun tiap peran.
--
-- PRASYARAT MUTLAK: Fase 1.0 sudah live (aplikasi mengirim JWT pengguna).
--   Cek cepat: buka aplikasi, login, pastikan data tetap tampil.
--   Bila aplikasi masih mengirim anon key, menjalankan berkas ini akan
--   membuat seluruh layar kosong.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── Penolong: peran pengguna saat ini, dinormalkan ─────────────
-- SECURITY DEFINER agar tetap bisa membaca user_profiles walau tabel itu
-- kelak ikut dilindungi RLS. Dipakai oleh berkas 1.1b.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p.role, 'viewer')))
           WHEN 'admin'      THEN 'super_admin'
           WHEN 'head'       THEN 'super_admin'
           WHEN 'superadmin' THEN 'super_admin'
           ELSE lower(trim(coalesce(p.role, 'viewer')))
         END
  FROM public.user_profiles p
  WHERE p.id = auth.uid()
$$;

COMMENT ON FUNCTION public.current_app_role() IS
  'Peran aplikasi pengguna yang sedang login, sudah dinormalkan (admin/head/superadmin -> super_admin). Cerminan getUserRole() di js/auth.js.';

-- ── Aktifkan RLS + kebijakan "harus sudah login" ───────────────
-- Batch 1 sengaja hanya berisi tabel yang memuat data pasien.
-- PENTING: seluruh kebijakan lama dihapus lebih dulu, bukan hanya yang
-- bernama "<tabel>_authenticated". Migrasi terdahulu sempat memasang
-- kebijakan tanpa klausa TO (berlaku untuk PUBLIC, termasuk anon), dan
-- karena kebijakan RLS bersifat permisif, satu saja yang longgar sudah
-- membatalkan seluruh pengetatan. Lihat supabase_fase1_rls_a_fix.sql.
DO $$
DECLARE
  t   text;
  pol record;
  daftar text[] := ARRAY[
    'lab_results',
    'lab_samples',
    'admissions',
    'anamnesas',
    'homecare_orders',
    'homecare_visit_records',
    'critical_value_notifications',
    'patient_ids',
    'families',
    'family_members',
    'sample_labels',
    'sample_label_items'
  ];
BEGIN
  FOREACH t IN ARRAY daftar LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN

      FOR pol IN
        SELECT p.polname FROM pg_policy p
        JOIN pg_class c     ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t);
      END LOOP;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_authenticated', t
      );

      RAISE NOTICE 'RLS aktif: %', t;
    ELSE
      RAISE NOTICE 'dilewati (tabel tidak ada): %', t;
    END IF;
  END LOOP;
END $$;

-- ── Verifikasi ─────────────────────────────────────────────────
-- Semua baris harus rls_aktif = true dan punya tepat 1 kebijakan.
SELECT c.relname                        AS tabel,
       c.relrowsecurity                 AS rls_aktif,
       count(p.polname)                 AS jumlah_kebijakan
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN (
    'lab_results','lab_samples','admissions','anamnesas',
    'homecare_orders','homecare_visit_records','critical_value_notifications',
    'patient_ids','families','family_members','sample_labels','sample_label_items')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- ══════════════════════════════════════════════════════════════
-- PEMBATALAN (bila aplikasi bermasalah, jalankan blok ini)
-- ══════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'lab_results','lab_samples','admissions','anamnesas',
--     'homecare_orders','homecare_visit_records','critical_value_notifications',
--     'patient_ids','families','family_members','sample_labels','sample_label_items'
--   ] LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--   END LOOP;
-- END $$;
