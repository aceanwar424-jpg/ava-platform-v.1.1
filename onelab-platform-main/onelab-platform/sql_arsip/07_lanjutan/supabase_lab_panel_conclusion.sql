-- ══════════════════════════════════════════════════════════════
-- OneLab — Kesimpulan pemeriksaan tingkat PANEL (bukan per-test)
-- ──────────────────────────────────────────────────────────────
-- LATAR
--   lab_results.ai_conclusion menyimpan kesimpulan PER-TEST (satu baris hasil).
--   Yang belum ada: satu kesimpulan menyeluruh untuk seluruh panel sebuah
--   kunjungan — impresi klinis seperti "Dislipidemia" yang lahir dari POLA
--   lintas beberapa test (kolesterol + trigliserida tinggi), bukan dari satu
--   angka. Tabel ini menyimpannya, satu baris per kunjungan (admission_id).
--
-- INVARIAN YANG DIJAGA
--   Kesimpulan ini bersifat ANJURAN. Ia dibuat dari aturan pola deterministik,
--   lalu WAJIB dibaca, disunting bila perlu, dan dikonfirmasi oleh dokter
--   penanggung jawab sebelum dianggap sah. Kolom confirmed_by/confirmed_at
--   merekam konfirmasi itu; selama kosong, kesimpulan masih berstatus draf.
--   Tidak ada hasil yang boleh dirilis mengandalkan kolom ini tanpa konfirmasi
--   manusia — itu prinsip R3 (Clinical Decision Support) OneLab.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lab_panel_conclusions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id   bigint NOT NULL,
  visit_number   text,
  mr_number      text,
  patient_name   text,
  impression     text,                       -- teks kesimpulan (dapat disunting dokter)
  findings       jsonb DEFAULT '[]'::jsonb,   -- daftar pola terdeteksi (dislipidemia, dst)
  is_ai_generated boolean DEFAULT true,       -- true bila diisi generator pola, false bila diketik manual
  generated_at   timestamptz,
  generated_by   text,
  confirmed_by   text,                        -- dokter yang mengesahkan (NULL = masih draf)
  confirmed_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Satu kunjungan cukup satu kesimpulan panel. UNIQUE agar upsert-nya bersih.
CREATE UNIQUE INDEX IF NOT EXISTS uq_panel_concl_admission
  ON public.lab_panel_conclusions (admission_id);

-- ── RLS: mengikuti pola data klinis (hanya pengguna login) ────
ALTER TABLE public.lab_panel_conclusions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Bersihkan kebijakan lama bila migrasi dijalankan ulang.
  DROP POLICY IF EXISTS lab_panel_conclusions_clinical ON public.lab_panel_conclusions;
  -- Bila fungsi peran klinis tersedia (Fase 1), pakai itu; kalau tidak, izinkan
  -- semua pengguna login. Dibuat luwes supaya migrasi tidak gagal pada basis
  -- data yang belum menjalankan Fase 1.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_access_clinical') THEN
    EXECUTE $p$
      CREATE POLICY lab_panel_conclusions_clinical ON public.lab_panel_conclusions
        FOR ALL TO authenticated
        USING (public.can_access_clinical())
        WITH CHECK (public.can_access_clinical())
    $p$;
  ELSE
    EXECUTE $p$
      CREATE POLICY lab_panel_conclusions_clinical ON public.lab_panel_conclusions
        FOR ALL TO authenticated
        USING (true) WITH CHECK (true)
    $p$;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.lab_panel_conclusions TO authenticated;

-- Jaga updated_at.
CREATE OR REPLACE FUNCTION public.trg_panel_concl_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS panel_concl_touch ON public.lab_panel_conclusions;
CREATE TRIGGER panel_concl_touch
  BEFORE UPDATE ON public.lab_panel_conclusions
  FOR EACH ROW EXECUTE FUNCTION public.trg_panel_concl_touch();

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT 'lab_panel_conclusions siap' AS status;
