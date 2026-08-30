-- ══════════════════════════════════════════════════════════════
-- OneLab — Selaraskan penanda diagnosis utama pada icd_diagnostics
-- ──────────────────────────────────────────────────────────────
-- MASALAH
--   Modul Anamnesa SUDAH lama memakai kolom `diagnose_type` bernilai
--   'PRIMARY' atau 'SECONDARY', dan itulah yang diisi petugas lewat antarmuka.
--
--   Migrasi Fase 3 kemudian menambahkan kolom boolean `is_primary` beserta
--   pemicu penjaga "satu kunjungan satu diagnosis utama". Kolom itu TIDAK
--   PERNAH diisi oleh antarmuka mana pun, sehingga:
--     · pemicu penjaganya tidak pernah berjalan
--     · garis waktu pasien selalu menulis "Diagnosis sekunder", termasuk untuk
--       diagnosis yang sebenarnya utama
--     · laporan RL membaca kolom yang selalu kosong
--
--   Ini kekeliruan saat menyusun Fase 3: menambah cara kedua untuk menyatakan
--   hal yang sudah punya cara pertama.
--
-- CARA MEMPERBAIKI
--   `diagnose_type` tetap menjadi SATU-SATUNYA sumber kebenaran karena itulah
--   yang diisi antarmuka. `is_primary` dipertahankan sebagai turunan yang
--   diisi otomatis, supaya kueri dan laporan yang sudah menggunakannya tetap
--   bekerja tanpa harus diubah.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- Isi ulang data lama agar konsisten
UPDATE public.icd_diagnostics
   SET is_primary = (upper(coalesce(diagnose_type, '')) = 'PRIMARY')
 WHERE is_primary IS DISTINCT FROM (upper(coalesce(diagnose_type, '')) = 'PRIMARY');

-- Jaga keselarasan untuk data berikutnya
CREATE OR REPLACE FUNCTION public.trg_sync_primary_dx()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- diagnose_type adalah sumber kebenaran; is_primary hanya turunannya
  IF NEW.diagnose_type IS NOT NULL THEN
    NEW.is_primary := (upper(NEW.diagnose_type) = 'PRIMARY');
  ELSIF NEW.is_primary IS TRUE THEN
    -- bila hanya is_primary yang diisi (mis. dari modul lain), lengkapi pasangannya
    NEW.diagnose_type := 'PRIMARY';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS icd_sync_primary ON public.icd_diagnostics;
CREATE TRIGGER icd_sync_primary
  BEFORE INSERT OR UPDATE ON public.icd_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_primary_dx();

-- Pemicu "satu kunjungan satu diagnosis utama" dari Fase 3 kini benar-benar
-- berjalan, karena is_primary sudah terisi. Dipasang ulang agar urutannya
-- berada SETELAH penyelarasan di atas.
DROP TRIGGER IF EXISTS icd_single_primary ON public.icd_diagnostics;
CREATE TRIGGER icd_single_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.icd_diagnostics
  FOR EACH ROW WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.trg_single_primary_dx();

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT coalesce(diagnose_type, '(kosong)') AS jenis,
       count(*) FILTER (WHERE is_primary)     AS ditandai_utama,
       count(*) FILTER (WHERE NOT is_primary) AS ditandai_sekunder,
       count(*)                               AS total
FROM public.icd_diagnostics
GROUP BY diagnose_type
ORDER BY 1;
-- Yang benar: baris PRIMARY seluruhnya masuk kolom ditandai_utama,
-- baris SECONDARY seluruhnya masuk kolom ditandai_sekunder.
