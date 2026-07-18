-- ══════════════════════════════════════════════════════════════
-- OneLab — INVENTORY & LOGISTIK · FASE 2 (Warehouse & IM)
-- ──────────────────────────────────────────────────────────────
-- Menambah:
--   1. inventory_batches   — batch/lot + tanggal kedaluwarsa (FEFO)
--   2. goods_issues        — dokumen pengeluaran barang (goods issue)
--   3. goods_issue_items   — detail item yang dikeluarkan
--   4. kolom track_batch pada inventory_items
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── 1. INVENTORY_ITEMS — flag pelacakan batch ──────────────────
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS track_batch boolean default false;

-- ── 2. INVENTORY_BATCHES — batch/lot & kedaluwarsa ─────────────
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS item_id       bigint,
  ADD COLUMN IF NOT EXISTS item_code     text,
  ADD COLUMN IF NOT EXISTS batch_no      text,
  ADD COLUMN IF NOT EXISTS expiry_date   date,
  ADD COLUMN IF NOT EXISTS qty_received  numeric default 0,
  ADD COLUMN IF NOT EXISTS qty_remaining numeric default 0,
  ADD COLUMN IF NOT EXISTS received_date date,
  ADD COLUMN IF NOT EXISTS po_id         bigint,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.inventory_batches ADD CONSTRAINT fk_batch_item
    FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. GOODS_ISSUES — dokumen pengeluaran barang (header) ──────
CREATE TABLE IF NOT EXISTS public.goods_issues (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.goods_issues
  ADD COLUMN IF NOT EXISTS gi_number     text,
  ADD COLUMN IF NOT EXISTS issue_date     date,
  ADD COLUMN IF NOT EXISTS purpose        text,   -- Pemakaian Lab, MCU, Homecare, Rusak, dll
  ADD COLUMN IF NOT EXISTS division       text,   -- cost center / divisi tujuan
  ADD COLUMN IF NOT EXISTS ref_type       text,   -- lab | mcu | radiology | homecare | manual
  ADD COLUMN IF NOT EXISTS ref_id         bigint, -- id order sumber (opsional)
  ADD COLUMN IF NOT EXISTS total_items    integer default 0,
  ADD COLUMN IF NOT EXISTS total_value    numeric default 0,
  ADD COLUMN IF NOT EXISTS status         text default 'Selesai',
  ADD COLUMN IF NOT EXISTS issued_by      text,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

-- ── 4. GOODS_ISSUE_ITEMS — detail pengeluaran ──────────────────
CREATE TABLE IF NOT EXISTS public.goods_issue_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.goods_issue_items
  ADD COLUMN IF NOT EXISTS gi_id       bigint,
  ADD COLUMN IF NOT EXISTS item_id     bigint,
  ADD COLUMN IF NOT EXISTS item_code   text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS uom         text,
  ADD COLUMN IF NOT EXISTS qty         numeric default 0,
  ADD COLUMN IF NOT EXISTS batch_id    bigint,
  ADD COLUMN IF NOT EXISTS batch_no    text,
  ADD COLUMN IF NOT EXISTS unit_price  numeric default 0,
  ADD COLUMN IF NOT EXISTS subtotal    numeric default 0;

DO $$ BEGIN
  ALTER TABLE public.goods_issue_items ADD CONSTRAINT fk_gi_items_gi
    FOREIGN KEY (gi_id) REFERENCES public.goods_issues(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Disable RLS (konsisten arsitektur saat ini) ─────────────
ALTER TABLE public.inventory_batches  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_issues       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_issue_items  DISABLE ROW LEVEL SECURITY;

-- ── 6. Index ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_batch_item   ON public.inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON public.inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_gi_date      ON public.goods_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_gi_items_gi  ON public.goods_issue_items(gi_id);

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('inventory_batches','goods_issues','goods_issue_items')
ORDER BY table_name;
