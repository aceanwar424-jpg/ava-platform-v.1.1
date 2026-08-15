-- ══════════════════════════════════════════════════════════════
-- OneLab · Laboratory Information System (LIS) — Migrasi Tambahan
-- Jalankan SEKALI di Supabase SQL Editor.
-- Aman dijalankan ulang (idempoten): semua ADD COLUMN IF NOT EXISTS.
-- Prasyarat: supabase_config_lab.sql sudah dijalankan lebih dulu.
-- ══════════════════════════════════════════════════════════════

-- ── 1. LAB_RESULTS — kolom nilai kritis, batas kritis, TAT, rilis ──
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS is_critical        boolean default false,
  ADD COLUMN IF NOT EXISTS critical_low       numeric,
  ADD COLUMN IF NOT EXISTS critical_high      numeric,
  ADD COLUMN IF NOT EXISTS condition_type     text,      -- normal | risk | critical
  ADD COLUMN IF NOT EXISTS critical_ack_by    text,
  ADD COLUMN IF NOT EXISTS critical_ack_at    timestamp,
  ADD COLUMN IF NOT EXISTS critical_ack_note  text,
  ADD COLUMN IF NOT EXISTS released_by        text,
  ADD COLUMN IF NOT EXISTS released_at        timestamp;

-- ── 2. LAB_SAMPLES — target TAT (opsional, default dari produk) ──
ALTER TABLE public.lab_samples
  ADD COLUMN IF NOT EXISTS tat_target_hours   integer,
  ADD COLUMN IF NOT EXISTS label_id           bigint;

-- ── 3. LAB_QC_RUNS — log Quality Control analyzer (Westgard) ────
CREATE TABLE IF NOT EXISTS public.lab_qc_runs (
  id             bigint generated always as identity primary key,
  analyzer_id    bigint references public.analyzers(id),
  analyzer_name  text,
  test_name      text not null,
  qc_level       text,                 -- Level 1 / 2 / 3
  lot_number     text,
  target         numeric,              -- mean target QC
  sd             numeric,              -- 1 standar deviasi
  measured       numeric not null,     -- nilai terukur
  z_score        numeric,              -- (measured - target)/sd
  verdict        text,                 -- In Control / Warning (1-2s) / REJECT (1-3s)
  notes          text,
  run_by         text,
  run_at         timestamp default now(),
  created_at     timestamp default now()
);

-- ── 4. Index untuk performa worklist / trend / QC ──────────────
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_prod ON public.lab_results(patient_name, product_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status       ON public.lab_results(status);
CREATE INDEX IF NOT EXISTS idx_lab_results_sample       ON public.lab_results(sample_id);
CREATE INDEX IF NOT EXISTS idx_lab_samples_status       ON public.lab_samples(status);
CREATE INDEX IF NOT EXISTS idx_qc_runs_analyzer         ON public.lab_qc_runs(analyzer_id);

-- ── 5. RLS (mengikuti pola aplikasi saat ini) ──────────────────
-- CATATAN KEAMANAN: aplikasi ini me-non-aktifkan RLS pada tabel medis.
-- Untuk produksi klinis, sebaiknya AKTIFKAN RLS + policy berbasis auth.uid().
ALTER TABLE public.lab_qc_runs DISABLE ROW LEVEL SECURITY;

SELECT 'LIS migration done — lab_results/+lab_samples cols, lab_qc_runs created' AS status;
