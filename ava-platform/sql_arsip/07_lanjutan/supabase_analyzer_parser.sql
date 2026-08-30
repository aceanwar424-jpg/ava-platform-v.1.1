-- ══════════════════════════════════════════════════════════════════════
-- OneLab · LIS — PROFIL PARSER PER ALAT (konfigurasi kiriman + sinkronisasi)
-- Menyimpan cara mem-parse kiriman TIAP alat (posisi field kode/nilai/unit +
-- dari mana barcode sampel diambil), agar auto-match tak lagi bergantung pada
-- format hardcoded. Diisi & diuji dari modul "Config Parser" di OneLab.
-- IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.analyzers
  ADD COLUMN IF NOT EXISTS parser_config jsonb;

-- Contoh isi parser_config (untuk referensi; diisi lewat UI):
-- ASTM:
--   {"format":"delimited","fieldSep":"|","compSep":"^",
--    "resultRecord":"R","codeField":2,"codeComp":"last","valueField":3,"unitField":4,"flagField":6,
--    "barcodeRecord":"O","barcodeField":2,"barcodeComp":""}
-- HL7:
--   {"format":"delimited","fieldSep":"|","compSep":"^",
--    "resultRecord":"OBX","codeField":3,"codeComp":0,"valueField":5,"unitField":6,"flagField":8,
--    "barcodeRecord":"OBR","barcodeField":3,"barcodeComp":0}

-- Backfill sample_barcode pada pesan yang sudah punya barcode terparse tidak
-- dilakukan di sini (dikerjakan modul saat sinkronisasi).

SELECT 'Parser config siap — analyzers.parser_config (jsonb) ditambahkan' AS status;
