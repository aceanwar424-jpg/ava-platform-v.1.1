-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 1.1a (PERBAIKAN) : bersihkan kebijakan lama yang permisif
-- ──────────────────────────────────────────────────────────────
-- MASALAH YANG DIPERBAIKI
--   supabase_fase1_rls_a.sql hanya menghapus kebijakan bernama
--   "<tabel>_authenticated", padahal sebagian tabel sudah punya kebijakan
--   lama dari migrasi terdahulu. Contoh nyata di supabase_patient_identity.sql:
--
--       CREATE POLICY "patient_ids_all" ON public.patient_ids
--         FOR ALL USING (true) WITH CHECK (true);
--
--   Tanpa klausa TO, kebijakan itu berlaku untuk PUBLIC — termasuk anon.
--   Karena kebijakan RLS bersifat permisif (di-OR-kan), satu kebijakan
--   longgar sudah cukup membatalkan seluruh pengetatan.
--
--   Terbukti saat pengujian: 9 tabel tertutup, tetapi patient_ids
--   (berisi NIK dan identitas pasien) masih terbaca anon.
--
-- YANG DILAKUKAN
--   Menghapus SELURUH kebijakan pada tabel batch-1, lalu memasang ulang
--   tepat satu kebijakan "harus sudah login".
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t   text;
  pol record;
  n   int;
  daftar text[] := ARRAY[
    'lab_results','lab_samples','admissions','anamnesas',
    'homecare_orders','homecare_visit_records','critical_value_notifications',
    'patient_ids','families','family_members','sample_labels','sample_label_items'
  ];
BEGIN
  FOREACH t IN ARRAY daftar LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN

      -- 1. hapus SEMUA kebijakan yang menempel, apa pun namanya
      n := 0;
      FOR pol IN
        SELECT p.polname
        FROM pg_policy p
        JOIN pg_class c    ON c.oid = p.polrelid
        JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname='public' AND c.relname=t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, t);
        n := n + 1;
      END LOOP;

      -- 2. pastikan RLS menyala
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- 3. pasang satu-satunya kebijakan: harus sudah login
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_authenticated', t
      );

      RAISE NOTICE '% : % kebijakan lama dihapus, diganti 1 kebijakan authenticated', t, n;
    END IF;
  END LOOP;
END $$;

-- ── Verifikasi: setiap tabel harus rls_aktif=true, kebijakan=1, peran=authenticated ──
SELECT c.relname                                   AS tabel,
       c.relrowsecurity                            AS rls_aktif,
       count(p.polname)                            AS jumlah_kebijakan,
       coalesce(string_agg(DISTINCT
         CASE WHEN p.polroles = '{0}'::oid[] THEN 'PUBLIC(!)'
              ELSE (SELECT string_agg(r.rolname, ',')
                    FROM pg_roles r WHERE r.oid = ANY(p.polroles)) END, ', '), '-') AS berlaku_untuk
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE ns.nspname='public'
  AND c.relname IN ('lab_results','lab_samples','admissions','anamnesas',
                    'homecare_orders','homecare_visit_records','critical_value_notifications',
                    'patient_ids','families','family_members','sample_labels','sample_label_items')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- Kolom berlaku_untuk HARUS berisi 'authenticated'.
-- Bila muncul 'PUBLIC(!)' berarti masih ada kebijakan longgar yang tersisa.

-- ══════════════════════════════════════════════════════════════
-- CATATAN untuk batch berikutnya
-- ══════════════════════════════════════════════════════════════
-- Kebijakan longgar serupa juga ada pada tabel non-pasien berikut,
-- dan perlu ditangani saat tabel-tabel itu masuk cakupan RLS:
--   · postal_codes           (supabase_patient_identity.sql)
--   · product_items          (supabase_patient_identity.sql)
--   · letter_departments     (supabase_letter_numbering.sql)
--   · letter_number_format   (supabase_letter_numbering.sql)
-- Ketiganya bukan data pasien, sehingga tidak mendesak.
