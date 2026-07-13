-- ══════════════════════════════════════════════════════════════════════
-- OneLab · Perdalam Master Produk — Code Item (analit) + Integrasi Alat
-- Jalankan SEKALI di Supabase → SQL Editor. Idempoten (aman diulang).
-- ----------------------------------------------------------------------
-- Model: 1 TES (products) memiliki 1..N CODE ITEM (product_items / analit).
--   • Darah Lengkap  → RBC, WBC, PLT, HGB, HCT ...   (panel, banyak item)
--   • SGOT           → SGOT                          (1 item)
--   • Glukosa        → GLU                           (1 item)
-- Tiap code item punya: kode item, LOINC, satuan, rentang normal, tipe
-- hasil, dan KODE HOST (kode transmisi analyzer) untuk integrasi alat/LIS.
-- Saat pasien memesan, tes dipecah per code item di modul Lab (tiap item
-- punya nilai hasil sendiri) — didukung kolom baru di lab_results.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. PRODUCT_ITEMS (code item / analit) — perkaya kolom ──────────────
ALTER TABLE public.product_items
  ADD COLUMN IF NOT EXISTS loinc_code   text,                        -- LOINC per analit
  ADD COLUMN IF NOT EXISTS result_type  text default 'numeric',      -- numeric | text | select
  ADD COLUMN IF NOT EXISTS decimals     integer default 1,           -- jml desimal utk numeric
  ADD COLUMN IF NOT EXISTS ref_low      numeric,                     -- batas bawah normal (quick)
  ADD COLUMN IF NOT EXISTS ref_high     numeric,                     -- batas atas normal (quick)
  ADD COLUMN IF NOT EXISTS ref_text     text,                        -- rujukan kualitatif (mis. "Negatif")
  ADD COLUMN IF NOT EXISTS host_code    text,                        -- kode transmisi analyzer (integrasi)
  ADD COLUMN IF NOT EXISTS analyzer_id  bigint;                      -- alat penghasil analit ini
CREATE INDEX IF NOT EXISTS idx_product_items_host ON public.product_items(host_code);

-- ── 2. PRODUCTS — kode host order ke analyzer (LIS ↔ alat) ──────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS host_code text;   -- kode order tes ke analyzer

-- ── 3. REF_RANGES — target code item + dukung hasil kualitatif (teks) ───
ALTER TABLE public.ref_ranges
  ADD COLUMN IF NOT EXISTS product_item_id bigint,                  -- ref range per analit
  ADD COLUMN IF NOT EXISTS value_type      text default 'numeric',  -- numeric | qualitative
  ADD COLUMN IF NOT EXISTS expected_values text,                    -- kualitatif: "Negatif,Neg,Negative"
  ADD COLUMN IF NOT EXISTS item_code       text;
CREATE INDEX IF NOT EXISTS idx_ref_ranges_item ON public.ref_ranges(product_item_id);

-- ── 4. LAB_RESULTS — siap dipecah per code item (analit) ───────────────
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS product_item_id bigint,   -- FK ke product_items
  ADD COLUMN IF NOT EXISTS item_code       text,     -- RBC / WBC / GLU ...
  ADD COLUMN IF NOT EXISTS item_name       text,     -- nama analit
  ADD COLUMN IF NOT EXISTS loinc_code      text,     -- LOINC analit (utk integrasi/pelaporan)
  ADD COLUMN IF NOT EXISTS host_code       text;     -- kode host dari analyzer
CREATE INDEX IF NOT EXISTS idx_lab_results_item ON public.lab_results(product_item_id);

SELECT 'Product code-item + instrument-integration columns ready' AS status;
