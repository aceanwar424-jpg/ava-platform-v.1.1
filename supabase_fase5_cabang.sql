-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 5.6 : Multi-cabang (fondasi)
-- ──────────────────────────────────────────────────────────────
-- PENDEKATAN: MENAMBAH, BUKAN MENGUBAH
--   Menambahkan penanda cabang pada transaksi dan menautkan pengguna ke cabang,
--   TANPA menyaring paksa data yang sudah ada. Seluruh data lama otomatis
--   menjadi milik cabang utama, sehingga tidak ada satu pun layar yang berubah
--   perilakunya hari ini.
--
-- KENAPA PENYARINGAN BELUM DIPAKSAKAN
--   Menyaring per cabang di tingkat RLS akan langsung mengosongkan layar bagi
--   pengguna yang belum ditautkan ke cabang mana pun. Itu risiko yang tidak
--   sebanding selama operasional masih satu lokasi.
--
--   Struktur di bawah membuat penyaringan itu tinggal "dinyalakan" kelak:
--   kolomnya sudah ada, datanya sudah terisi, dan fungsi current_branch()
--   sudah tersedia untuk dipakai kebijakan RLS.
--
-- KAPAN DILANJUTKAN
--   Saat cabang kedua benar-benar dibuka. Menambahkan penanda cabang SETELAH
--   data membesar jauh lebih mahal daripada menyiapkannya sekarang — itulah
--   alasan fondasi ini dipasang lebih dulu.
--
-- PRASYARAT: supabase_fase1_rpc.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.branches (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS code       text,
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS address    text,
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS is_main    boolean default false,
  ADD COLUMN IF NOT EXISTS is_active  boolean default true,
  ADD COLUMN IF NOT EXISTS notes      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.branches ADD CONSTRAINT uq_branch_code UNIQUE (code);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.branches (code, name, is_main, is_active)
SELECT 'PUSAT', 'Kantor Pusat', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.branches WHERE code = 'PUSAT');

-- Pengguna ditautkan ke cabang; NULL berarti dapat melihat seluruh cabang
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS branch_id bigint;

-- Penanda cabang pada transaksi. Semua nullable dan diisi cabang utama untuk
-- data yang sudah ada, sehingga tidak ada perilaku lama yang berubah.
DO $$
DECLARE
  t text;
  v_main bigint;
  daftar text[] := ARRAY[
    'admissions','lab_samples','lab_results','anamnesas',
    'radiology_orders','homecare_orders','queue_tickets','appointments',
    'cashier_transactions','invoices','journal_entries',
    'inventory_items','goods_issues','purchase_requests','purchase_orders',
    'stock_opname','employees','clinical_notes','vital_signs'
  ];
BEGIN
  SELECT id INTO v_main FROM public.branches WHERE code = 'PUSAT';

  FOREACH t IN ARRAY daftar LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_id bigint', t);
      EXECUTE format('UPDATE public.%I SET branch_id = %s WHERE branch_id IS NULL', t, v_main);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(branch_id)', 'idx_'||t||'_branch', t);
      RAISE NOTICE 'penanda cabang dipasang: %', t;
    END IF;
  END LOOP;
END $$;

-- Cabang pengguna yang sedang login; NULL = lintas cabang
CREATE OR REPLACE FUNCTION public.current_branch()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.branch_id FROM public.user_profiles p WHERE p.id = auth.uid()
$$;

-- Cabang aktif untuk transaksi baru: cabang pengguna, atau cabang utama
CREATE OR REPLACE FUNCTION public.default_branch()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT p.branch_id FROM public.user_profiles p WHERE p.id = auth.uid()),
    (SELECT b.id FROM public.branches b WHERE b.is_main LIMIT 1)
  )
$$;

ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.current_branch() FROM public, anon;
REVOKE ALL ON FUNCTION public.default_branch() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_branch() TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_branch() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- LANGKAH BERIKUTNYA — sengaja BELUM dijalankan
-- ══════════════════════════════════════════════════════════════
-- Saat cabang kedua dibuka dan setiap pengguna sudah ditautkan ke cabangnya,
-- penyaringan dinyalakan dengan mengganti kebijakan RLS menjadi seperti ini:
--
--   CREATE POLICY admissions_branch ON public.admissions
--     FOR ALL TO authenticated
--     USING (public.current_branch() IS NULL OR branch_id = public.current_branch())
--     WITH CHECK (branch_id = public.default_branch());
--
-- Jangan dijalankan sebelum SELURUH pengguna punya branch_id, atau layar mereka
-- akan kosong.
-- ══════════════════════════════════════════════════════════════

SELECT 'cabang' AS jenis, count(*)::text AS jumlah FROM public.branches
UNION ALL
SELECT 'tabel bertanda cabang', count(*)::text FROM information_schema.columns
  WHERE table_schema='public' AND column_name='branch_id'
UNION ALL
SELECT 'fungsi', count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('current_branch','default_branch');
