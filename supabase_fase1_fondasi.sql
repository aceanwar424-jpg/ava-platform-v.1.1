-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 1: Fondasi, Keamanan & Keselamatan Pasien
-- ──────────────────────────────────────────────────────────────
-- Cakupan berkas ini (aman, hanya menambah — RLS TIDAK diaktifkan di sini):
--   1.3  Alur komunikasi nilai kritis lab (ISO 15189)
--   1.5  Jejak audit: cuplikan data sebelum/sesudah
--
-- CATATAN HASIL AUDIT SKEMA (18 Jul 2026):
--   Sudah ADA, tidak perlu dibuat lagi:
--     · ref_ranges.critical_low / critical_high / condition_type
--     · lab_results.is_critical  (sudah diisi di 4 titik penyimpanan hasil)
--     · activity_logs.user_id / user_name
--   Jadi DETEKSI nilai kritis sudah berjalan. Yang belum ada adalah
--   pencatatan KOMUNIKASINYA — itulah isi berkas ini.
--
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── 1.3a  Penanda tindak lanjut pada hasil ─────────────────────
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS critical_notified_at timestamp,
  ADD COLUMN IF NOT EXISTS critical_notified_by text;

-- ── 1.3b  Catatan komunikasi nilai kritis ──────────────────────
-- Satu baris = satu upaya komunikasi. Sengaja dibuat banyak-ke-satu
-- karena upaya pertama bisa gagal (dokter tidak terjangkau) dan setiap
-- upaya wajib terekam untuk keperluan asesmen akreditasi.
CREATE TABLE IF NOT EXISTS public.critical_value_notifications (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.critical_value_notifications
  ADD COLUMN IF NOT EXISTS result_id      bigint,
  ADD COLUMN IF NOT EXISTS sample_id      bigint,
  ADD COLUMN IF NOT EXISTS admission_id   bigint,
  ADD COLUMN IF NOT EXISTS patient_name   text,
  ADD COLUMN IF NOT EXISTS test_name      text,
  ADD COLUMN IF NOT EXISTS result_value   text,
  ADD COLUMN IF NOT EXISTS unit           text,
  ADD COLUMN IF NOT EXISTS critical_range text,   -- ambang yang terlampaui, disalin saat kejadian
  -- siapa menghubungi siapa
  ADD COLUMN IF NOT EXISTS notified_by    text,   -- petugas lab yang menelepon
  ADD COLUMN IF NOT EXISTS notified_to    text,   -- dokter / perawat penerima
  ADD COLUMN IF NOT EXISTS notified_role  text,   -- Dokter | Perawat | DPJP | Lainnya
  ADD COLUMN IF NOT EXISTS method         text,   -- Telepon | WhatsApp | Langsung
  ADD COLUMN IF NOT EXISTS notified_at    timestamp,
  -- bukti bahwa pesan benar-benar diterima
  ADD COLUMN IF NOT EXISTS readback       boolean default false,  -- penerima mengulang nilai
  ADD COLUMN IF NOT EXISTS response       text,   -- tindakan yang diinstruksikan
  ADD COLUMN IF NOT EXISTS attempt_status text default 'Berhasil', -- Berhasil | Tidak Terjangkau
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.critical_value_notifications ADD CONSTRAINT fk_cvn_result
    FOREIGN KEY (result_id) REFERENCES public.lab_results(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table  THEN NULL; END $$;

-- ── 1.5  Jejak audit: cuplikan sebelum/sesudah ─────────────────
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS before_data jsonb,
  ADD COLUMN IF NOT EXISTS after_data  jsonb;

-- ── RLS (konsisten arsitektur saat ini; pengetatan = langkah 1.1) ──
ALTER TABLE public.critical_value_notifications DISABLE ROW LEVEL SECURITY;

-- ── Index ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cvn_result   ON public.critical_value_notifications(result_id);
CREATE INDEX IF NOT EXISTS idx_cvn_time     ON public.critical_value_notifications(notified_at);
CREATE INDEX IF NOT EXISTS idx_lr_critical  ON public.lab_results(is_critical)
  WHERE is_critical = true;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT 'critical_value_notifications' AS objek,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_name='critical_value_notifications') AS jumlah_kolom
UNION ALL
SELECT 'lab_results.critical_notified_at',
       count(*) FROM information_schema.columns
       WHERE table_name='lab_results' AND column_name='critical_notified_at'
UNION ALL
SELECT 'activity_logs.before_data',
       count(*) FROM information_schema.columns
       WHERE table_name='activity_logs' AND column_name='before_data';
