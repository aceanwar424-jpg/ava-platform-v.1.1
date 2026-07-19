-- ══════════════════════════════════════════════════════════════
-- OneLab — Antrian Modalitas (Modality Worklist) & Penerimaan PACS
-- ──────────────────────────────────────────────────────────────
-- LATAR
--   Alur RIS lama melompat dari "Dijadwalkan" langsung ke "Dikerjakan".
--   Yang hilang adalah langkah nyata di lapangan: order dikirim ke ANTRIAN
--   ALAT (modality worklist), radiografer memanggilnya di mesin, memotret,
--   lalu citra MASUK ke konsol penerimaan PACS untuk ditinjau/disunting.
--
-- BATAS JUJUR
--   PACS/RIS komersial mendorong order ke mesin lewat DICOM Modality Worklist
--   (MWL) dan menerima citra lewat C-STORE — keduanya butuh gateway DICOM
--   tersendiri di jaringan. Web app ini TIDAK berbicara DICOM langsung ke alat.
--   Kolom di bawah merekam LANGKAH KERJANYA (kapan dikirim ke alat, alat mana,
--   siapa radiografernya, kapan citra diterima) sehingga prosesnya tertelusur;
--   pengiriman/penerimaan citra tetap manual sampai gateway DICOM dipasang.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.radiology_orders
  ADD COLUMN IF NOT EXISTS device_name             text,          -- nama/kode alat tujuan (mis. "CT-01")
  ADD COLUMN IF NOT EXISTS device_room             text,          -- ruang pemeriksaan
  ADD COLUMN IF NOT EXISTS radiographer            text,          -- petugas yang memotret
  ADD COLUMN IF NOT EXISTS queued_to_device_at     timestamptz,   -- kapan dikirim ke antrian alat
  ADD COLUMN IF NOT EXISTS acquisition_started_at  timestamptz,   -- kapan mulai akuisisi
  ADD COLUMN IF NOT EXISTS received_from_device_at timestamptz;   -- kapan citra diterima di konsol PACS

-- Indeks untuk memuat antrian alat dengan cepat.
CREATE INDEX IF NOT EXISTS idx_ris_orders_status ON public.radiology_orders (status, scheduled_at);

-- ── Verifikasi ─────────────────────────────────────────────────
-- Yang benar: keenam kolom muncul.
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='radiology_orders'
  AND column_name IN ('device_name','device_room','radiographer',
                      'queued_to_device_at','acquisition_started_at','received_from_device_at')
ORDER BY column_name;
