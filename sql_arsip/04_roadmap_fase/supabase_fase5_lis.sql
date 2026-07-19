-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 5.5 : LIS Lanjutan
-- ──────────────────────────────────────────────────────────────
--   Autoverifikasi berbasis aturan
--   Kriteria penolakan spesimen yang terstandar
--   Eskalasi TAT
--   Rujukan pemeriksaan ke lab luar
--   (Levey-Jennings & Westgard multi-run dihitung di sisi klien dari
--    lab_qc_runs yang sudah ada — tidak perlu tabel baru)
--
-- KONDISI AWAL (hasil pembacaan kode):
--   Sudah ada  : lab_qc_runs dengan z_score dan verdict Westgard sederhana
--                (1-2s / 1-3s), analyzers dengan kalibrasi_berikutnya,
--                delta check, penolakan sampel berupa teks bebas.
--   Belum ada  : aturan autoverifikasi, kriteria penolakan baku,
--                eskalasi TAT, dan rujukan lab luar.
--
-- PRASYARAT: supabase_fase1_rpc.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- AUTOVERIFIKASI
-- ══════════════════════════════════════════════════════════════
-- Hasil normal yang lolos seluruh syarat keluar otomatis, sehingga analis
-- memusatkan perhatian pada yang menyimpang. Aturan sengaja dibuat per
-- pemeriksaan, bukan global, agar bisa dimulai dari sedikit parameter yang
-- paling stabil.
CREATE TABLE IF NOT EXISTS public.autoverify_rules (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.autoverify_rules
  ADD COLUMN IF NOT EXISTS product_id        bigint,
  ADD COLUMN IF NOT EXISTS is_active         boolean default false,
  ADD COLUMN IF NOT EXISTS require_in_range  boolean default true,  -- harus di dalam rentang rujukan
  ADD COLUMN IF NOT EXISTS require_not_critical boolean default true,
  ADD COLUMN IF NOT EXISTS require_delta_ok  boolean default true,  -- delta check tidak mencurigakan
  ADD COLUMN IF NOT EXISTS require_qc_pass   boolean default true,  -- QC hari itu lolos
  ADD COLUMN IF NOT EXISTS max_delta_pct     numeric default 30,    -- ambang lonjakan antar pemeriksaan
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS updated_at        timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.autoverify_rules ADD CONSTRAINT uq_autoverify_product UNIQUE (product_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Jejak: setiap hasil yang lolos otomatis WAJIB tercatat supaya bisa ditinjau
-- berkala. Autoverifikasi tanpa jejak adalah risiko, bukan efisiensi.
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS autoverified_at timestamp,
  ADD COLUMN IF NOT EXISTS autoverify_note text;

-- ══════════════════════════════════════════════════════════════
-- KRITERIA PENOLAKAN SPESIMEN
-- ══════════════════════════════════════════════════════════════
-- KOREKSI ATAS AUDIT: dokumen audit menyebut alasan penolakan berupa teks
-- bebas. Itu KELIRU — modules/lab/checkin.js sudah memakai daftar pilih
-- SAMPLE_REJECT_REASONS berisi sebelas alasan terstandar yang memadai.
--
-- Tabel ini TIDAK menggantikannya, melainkan memberi KODE pada tiap alasan
-- (HEM, LIP, VOL, ...) supaya penolakan dapat diringkas menjadi statistik mutu
-- pra-analitik per periode. Daftar di kode tetap menjadi sumber tampilan.
CREATE TABLE IF NOT EXISTS public.rejection_reasons (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.rejection_reasons
  ADD COLUMN IF NOT EXISTS code       text,
  ADD COLUMN IF NOT EXISTS reason     text,
  ADD COLUMN IF NOT EXISTS category   text,   -- Pra-analitik | Identitas | Wadah | Volume
  ADD COLUMN IF NOT EXISTS is_active  boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

INSERT INTO public.rejection_reasons (code, reason, category)
SELECT v.c, v.r, v.k FROM (VALUES
  ('HEM','Spesimen hemolisis',                'Pra-analitik'),
  ('LIP','Spesimen lipemik',                  'Pra-analitik'),
  ('IKT','Spesimen ikterik',                  'Pra-analitik'),
  ('CLOT','Spesimen membeku / ada bekuan',    'Pra-analitik'),
  ('VOL','Volume tidak mencukupi',            'Volume'),
  ('WADAH','Salah wadah / antikoagulan',      'Wadah'),
  ('LABEL','Label tidak sesuai / tidak terbaca','Identitas'),
  ('NOID','Tanpa identitas pasien',           'Identitas'),
  ('EXP','Tabung kedaluwarsa',                'Wadah'),
  ('DELAY','Keterlambatan pengiriman',        'Pra-analitik'),
  ('SUHU','Suhu pengiriman tidak sesuai',     'Pra-analitik'),
  ('LAIN','Lainnya',                          'Pra-analitik')
) AS v(c,r,k)
WHERE NOT EXISTS (SELECT 1 FROM public.rejection_reasons x WHERE x.code = v.c);

ALTER TABLE public.lab_samples
  ADD COLUMN IF NOT EXISTS rejection_code text;

-- ══════════════════════════════════════════════════════════════
-- ESKALASI TAT
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.lab_samples
  ADD COLUMN IF NOT EXISTS priority        text default 'Rutin',  -- Rutin | Cito
  ADD COLUMN IF NOT EXISTS tat_escalated_at timestamp;

-- ══════════════════════════════════════════════════════════════
-- RUJUKAN LAB LUAR
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.referral_labs (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.referral_labs
  ADD COLUMN IF NOT EXISTS name         text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS is_active    boolean default true,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

CREATE TABLE IF NOT EXISTS public.referred_tests (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.referred_tests
  ADD COLUMN IF NOT EXISTS sample_id      bigint,
  ADD COLUMN IF NOT EXISTS admission_id   bigint,
  ADD COLUMN IF NOT EXISTS product_id     bigint,
  ADD COLUMN IF NOT EXISTS product_name   text,
  ADD COLUMN IF NOT EXISTS patient_name   text,
  ADD COLUMN IF NOT EXISTS referral_lab_id bigint,
  ADD COLUMN IF NOT EXISTS lab_name       text,
  ADD COLUMN IF NOT EXISTS sent_at        timestamp,
  ADD COLUMN IF NOT EXISTS expected_at    date,
  ADD COLUMN IF NOT EXISTS result_at      timestamp,
  ADD COLUMN IF NOT EXISTS result_value   text,
  ADD COLUMN IF NOT EXISTS cost           numeric default 0,   -- biaya dibayar ke lab rujukan
  ADD COLUMN IF NOT EXISTS price          numeric default 0,   -- harga ke pasien
  ADD COLUMN IF NOT EXISTS status         text default 'Dikirim', -- Dikirim | Diterima | Dibatalkan
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

CREATE INDEX IF NOT EXISTS idx_reft_status ON public.referred_tests(status, sent_at);

-- ══════════════════════════════════════════════════════════════
-- Fungsi: catat hasil lolos autoverifikasi
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mark_autoverified(p_result_id bigint, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  SELECT * INTO v_res FROM lab_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hasil tidak ditemukan'; END IF;

  UPDATE lab_results
    SET status = 'Validated', autoverified_at = now(), autoverify_note = p_note
    WHERE id = p_result_id;

  PERFORM public.write_audit('autoverify','lab_results', p_result_id::text,
    concat('Lolos autoverifikasi: ', p_note), v_res.patient_name,
    NULL, jsonb_build_object('product', v_res.product_name, 'value', v_res.result_value));

  RETURN jsonb_build_object('ok', true);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.autoverify_rules   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_reasons  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_labs      DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT p.polname FROM pg_policy p
             JOIN pg_class c ON c.oid=p.polrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='referred_tests'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.referred_tests', pol.polname); END LOOP;
  EXECUTE 'ALTER TABLE public.referred_tests ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY referred_tests_authenticated ON public.referred_tests
           FOR ALL TO authenticated USING (true) WITH CHECK (true)';
END $$;

REVOKE ALL ON FUNCTION public.mark_autoverified(bigint,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_autoverified(bigint,text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
SELECT 'tabel' AS jenis, table_name AS nama FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('autoverify_rules','rejection_reasons','referral_labs','referred_tests')
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname='mark_autoverified'
ORDER BY 1,2;
