-- ══════════════════════════════════════════════════════════════
-- OneLab · ASET TETAP & JADWAL KALIBRASI
--   A. fixed_assets   — daftar aset tetap (boleh tertaut ke master alat lab)
--   B. depreciations  — penyusutan garis lurus per periode 'YYYY-MM'
--   C. ast_asset_book_v — tampilan nilai buku berjalan untuk layar
--   D. ast_run_depreciation(p_period) — hitung + catat jurnal penyusutan
--
-- Jadwal kalibrasi memakai tabel public.asset_maintenance dan fungsi
-- public.complete_maintenance yang SUDAH ADA (supabase_fase2b.sql).
-- Berkas ini tidak membuat ulang keduanya.
--
-- PRASYARAT : supabase_fase1_rpc.sql (write_audit, current_app_role)
--             supabase_fase2b.sql   (asset_maintenance, complete_maintenance)
--             supabase_fase4.sql    (post_journal, gl_mappings 'asset.depr')
-- SIFAT     : IDEMPOTEN — aman dijalankan berulang.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- A. ASET TETAP
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id         bigint generated always as identity primary key,
  created_at timestamp default now()
);

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS kode               text,
  ADD COLUMN IF NOT EXISTS nama               text,
  ADD COLUMN IF NOT EXISTS kategori           text,      -- Alat Lab, Kendaraan, Bangunan, Perangkat IT, dll
  ADD COLUMN IF NOT EXISTS analyzer_id        bigint,    -- opsional: tautan ke master alat lab (public.analyzers)
  ADD COLUMN IF NOT EXISTS tanggal_perolehan  date,
  ADD COLUMN IF NOT EXISTS nilai_perolehan    numeric default 0,
  ADD COLUMN IF NOT EXISTS masa_manfaat_bulan integer default 60,
  ADD COLUMN IF NOT EXISTS nilai_residu       numeric default 0,
  ADD COLUMN IF NOT EXISTS lokasi             text,
  ADD COLUMN IF NOT EXISTS penanggung_jawab   text,
  ADD COLUMN IF NOT EXISTS status             text default 'Aktif',  -- Aktif | Dilepas | Rusak
  ADD COLUMN IF NOT EXISTS cost_center        text,      -- kode unit layanan, dipakai saat mencatat jurnal
  ADD COLUMN IF NOT EXISTS catatan            text,
  ADD COLUMN IF NOT EXISTS updated_at         timestamp default now();

-- Kode aset dipakai manusia untuk menempel label fisik, jadi harus unik.
-- Partial index: aset lama yang kodenya belum diisi tidak ikut terkunci.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ast_kode
  ON public.fixed_assets(kode) WHERE kode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ast_status   ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_ast_analyzer ON public.fixed_assets(analyzer_id);

-- ══════════════════════════════════════════════════════════════
-- B. PENYUSUTAN
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.depreciations (
  id         bigint generated always as identity primary key,
  created_at timestamp default now()
);

ALTER TABLE public.depreciations
  ADD COLUMN IF NOT EXISTS asset_id           bigint,
  ADD COLUMN IF NOT EXISTS periode            text,     -- 'YYYY-MM'
  ADD COLUMN IF NOT EXISTS nilai_penyusutan   numeric default 0,
  ADD COLUMN IF NOT EXISTS nilai_buku_setelah numeric default 0,
  ADD COLUMN IF NOT EXISTS journal_id         bigint,
  ADD COLUMN IF NOT EXISTS updated_at         timestamp default now();

-- PENJAGA UTAMA: satu aset hanya boleh punya satu baris penyusutan per periode.
-- Ini yang membuat penyusutan tidak bisa tercatat dua kali walaupun tombolnya
-- ditekan berulang atau dua orang menjalankannya bersamaan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_depr_asset_periode
  ON public.depreciations(asset_id, periode);
CREATE INDEX IF NOT EXISTS idx_depr_periode ON public.depreciations(periode);

-- ══════════════════════════════════════════════════════════════
-- C. TAMPILAN NILAI BUKU
-- Layar aset butuh nilai buku berjalan; menghitungnya di sini membuat
-- angka di layar dan angka di pembukuan berasal dari satu sumber.
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.ast_asset_book_v;
CREATE VIEW public.ast_asset_book_v AS
SELECT
  a.*,
  coalesce(d.akumulasi, 0)                          AS akumulasi_penyusutan,
  coalesce(a.nilai_perolehan,0) - coalesce(d.akumulasi,0) AS nilai_buku,
  CASE WHEN coalesce(a.masa_manfaat_bulan,0) > 0
       THEN round((coalesce(a.nilai_perolehan,0) - coalesce(a.nilai_residu,0))
                  / a.masa_manfaat_bulan, 2)
       ELSE 0 END                                   AS penyusutan_bulanan,
  d.periode_terakhir
FROM public.fixed_assets a
LEFT JOIN (
  SELECT asset_id,
         sum(coalesce(nilai_penyusutan,0)) AS akumulasi,
         max(periode)                      AS periode_terakhir
  FROM public.depreciations
  GROUP BY asset_id
) d ON d.asset_id = a.id;

-- ══════════════════════════════════════════════════════════════
-- D. FUNGSI: jalankan penyusutan satu periode
-- Metode garis lurus: (nilai perolehan − nilai residu) ÷ masa manfaat.
-- Penyusutan berhenti begitu nilai buku menyentuh nilai residu, sehingga
-- nilai buku tidak pernah menjadi negatif.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ast_run_depreciation(p_period text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role    text := public.current_app_role();
  v_awal    date;
  v_akhir   date;
  v_a       record;
  v_bulanan numeric;
  v_akum    numeric;
  v_sisa    numeric;
  v_nilai   numeric;
  v_buku    numeric;
  v_jurnal  jsonb;
  v_jid     bigint;
  v_n       integer := 0;
  v_lewat   integer := 0;
  v_total   numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Harus login';
  END IF;

  -- Penyusutan menyentuh pembukuan, jadi wewenangnya dibatasi.
  IF v_role NOT IN ('super_admin','direktur','manager','finance_staff') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menjalankan penyusutan', coalesce(v_role,'-');
  END IF;

  IF p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Format periode harus YYYY-MM, diterima: %', coalesce(p_period,'(kosong)');
  END IF;

  v_awal  := to_date(p_period, 'YYYY-MM');
  v_akhir := (v_awal + interval '1 month' - interval '1 day')::date;

  IF v_awal > current_date THEN
    RAISE EXCEPTION 'Periode % belum berjalan — penyusutan tidak bisa dimajukan', p_period;
  END IF;

  -- Dua orang yang menekan tombol bersamaan diantrikan, bukan saling menimpa.
  PERFORM pg_advisory_xact_lock(hashtext('ast_run_depreciation'));

  FOR v_a IN
    SELECT * FROM fixed_assets
    WHERE coalesce(status,'Aktif') = 'Aktif'
      AND coalesce(masa_manfaat_bulan,0) > 0
      AND coalesce(nilai_perolehan,0) > 0
      AND tanggal_perolehan IS NOT NULL
      AND tanggal_perolehan <= v_akhir      -- aset yang belum diperoleh tidak disusutkan
    ORDER BY id
  LOOP
    -- Idempoten: periode yang sudah pernah disusutkan untuk aset ini dilewati.
    IF EXISTS (SELECT 1 FROM depreciations
               WHERE asset_id = v_a.id AND periode = p_period) THEN
      v_lewat := v_lewat + 1;
      CONTINUE;
    END IF;

    SELECT coalesce(sum(coalesce(nilai_penyusutan,0)),0) INTO v_akum
    FROM depreciations WHERE asset_id = v_a.id;

    v_bulanan := round((coalesce(v_a.nilai_perolehan,0) - coalesce(v_a.nilai_residu,0))
                       / v_a.masa_manfaat_bulan, 2);

    -- Sisa yang masih boleh disusutkan sampai nilai buku menyentuh residu.
    v_sisa  := (coalesce(v_a.nilai_perolehan,0) - coalesce(v_a.nilai_residu,0)) - v_akum;
    v_nilai := least(v_bulanan, greatest(v_sisa, 0));

    -- Aset yang sudah habis disusutkan dilewati tanpa menghasilkan jurnal nol.
    IF v_nilai <= 0 THEN
      CONTINUE;
    END IF;

    v_buku := coalesce(v_a.nilai_perolehan,0) - (v_akum + v_nilai);

    -- Pemetaan 'asset.depr' sudah ada di gl_mappings:
    -- debit 6-1200 Beban Penyusutan, kredit 1-2900 Akumulasi Penyusutan.
    v_jurnal := public.post_journal(
      'asset.depr',
      v_nilai,
      format('Penyusutan %s — %s (%s)', p_period, coalesce(v_a.nama,'Aset'), coalesce(v_a.kode,'-')),
      'asset',
      v_a.id,
      v_a.cost_center,
      v_akhir
    );
    v_jid := nullif(v_jurnal->>'entry_id','')::bigint;

    INSERT INTO depreciations(asset_id, periode, nilai_penyusutan, nilai_buku_setelah,
                              journal_id, updated_at)
    VALUES (v_a.id, p_period, v_nilai, v_buku, v_jid, now());

    v_n     := v_n + 1;
    v_total := v_total + v_nilai;
  END LOOP;

  PERFORM public.write_audit('depreciation','depreciations', p_period,
    format('Penyusutan periode %s: %s aset dicatat, %s dilewati, total %s',
           p_period, v_n, v_lewat, v_total), p_period);

  RETURN jsonb_build_object(
    'ok', true, 'periode', p_period,
    'jumlah_aset', v_n, 'dilewati', v_lewat, 'total', v_total);
END $$;

COMMENT ON FUNCTION public.ast_run_depreciation(text) IS
  'Penyusutan garis lurus satu periode. Idempoten per (aset, periode); nilai buku berhenti di nilai residu.';

-- ══════════════════════════════════════════════════════════════
-- E. RLS & PERIZINAN
-- Aset tetap bukan data pasien, jadi RLS tidak diaktifkan — sejalan
-- dengan tabel non-klinis lain di proyek ini.
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.fixed_assets  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciations DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT SELECT ON public.fixed_assets TO anon;

-- depreciations sengaja hanya bisa dibaca dari layar. Penambahannya hanya
-- lewat ast_run_depreciation supaya setiap baris penyusutan selalu punya
-- jurnal pasangannya dan tidak bisa diketik manual.
GRANT SELECT ON public.depreciations TO anon, authenticated;

GRANT SELECT ON public.ast_asset_book_v TO anon, authenticated;

REVOKE ALL    ON FUNCTION public.ast_run_depreciation(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.ast_run_depreciation(text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- F. VERIFIKASI
-- ══════════════════════════════════════════════════════════════
SELECT 'tabel' AS jenis, table_name AS nama FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('fixed_assets','depreciations','asset_maintenance')
UNION ALL
SELECT 'tampilan', table_name FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'ast_asset_book_v'
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN ('ast_run_depreciation','complete_maintenance','post_journal')
UNION ALL
SELECT 'pemetaan jurnal', event_key || ' → D:' || debit_code || ' K:' || credit_code
FROM public.gl_mappings WHERE event_key = 'asset.depr'
ORDER BY 1, 2;
