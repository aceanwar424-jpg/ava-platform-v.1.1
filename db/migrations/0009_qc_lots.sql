-- 0009 — Master lot bahan kontrol (QC)
--
-- Tanpa tabel ini, kolom target / sd / z_score / verdict di lab_qc_runs
-- selalu kosong: connector hanya bisa mencatat angka mentah, dan penilaian
-- Westgard harus dikerjakan manual. Padahal justru penilaian itulah bukti
-- mutu yang diminta ISO 15189, bukan daftar angkanya.
--
-- Satu baris = satu analit pada satu level, untuk satu lot bahan kontrol,
-- pada satu alat.

CREATE TABLE IF NOT EXISTS public.lab_qc_lots (
  id             bigserial PRIMARY KEY,
  analyzer_id    bigint,
  test_name      text NOT NULL,        -- kode tes sebagaimana dikirim alat (host code)
  qc_level       text,                 -- Level 1 / 2 / 3, Normal, Abnormal, …
  lot_number     text,
  target         numeric NOT NULL,     -- mean acuan dari sisipan bahan kontrol
  sd             numeric NOT NULL CHECK (sd > 0),
  unit           text,
  berlaku_sampai date,
  is_active      boolean NOT NULL DEFAULT true,
  catatan        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Pencarian saat hasil QC masuk: alat + tes + level (+ lot bila disebut).
CREATE INDEX IF NOT EXISTS idx_lab_qc_lots_cari
  ON public.lab_qc_lots (analyzer_id, test_name, qc_level)
  WHERE is_active;

-- Riwayat dibaca untuk aturan Westgard yang butuh rentetan (2-2s, 4-1s, 10x).
CREATE INDEX IF NOT EXISTS idx_lab_qc_runs_riwayat
  ON public.lab_qc_runs (analyzer_id, test_name, qc_level, run_at DESC);
