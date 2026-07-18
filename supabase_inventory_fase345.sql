-- ══════════════════════════════════════════════════════════════
-- OneLab — INVENTORY & LOGISTIK · FASE 3-5
--   Fase 3 (MRP lanjutan)  : dihitung dari histori ledger (no schema)
--   Fase 4 (Reporting)     : agregasi runtime (no schema)
--   Fase 1 leftover + F5   : purchase_returns (retur supplier) + audit
-- Aman dijalankan berulang (idempoten). Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── PURCHASE_RETURNS — retur barang ke supplier (header) ───────
CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.purchase_returns
  ADD COLUMN IF NOT EXISTS return_number text,
  ADD COLUMN IF NOT EXISTS po_id         bigint,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS return_date   date,
  ADD COLUMN IF NOT EXISTS reason        text,   -- Rusak, Salah kirim, Kadaluarsa
  ADD COLUMN IF NOT EXISTS total_items   integer default 0,
  ADD COLUMN IF NOT EXISTS total_value   numeric default 0,
  ADD COLUMN IF NOT EXISTS status        text default 'Selesai',
  ADD COLUMN IF NOT EXISTS created_by    text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

-- ── PURCHASE_RETURN_ITEMS — detail retur ───────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_return_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.purchase_return_items
  ADD COLUMN IF NOT EXISTS return_id   bigint,
  ADD COLUMN IF NOT EXISTS item_id     bigint,
  ADD COLUMN IF NOT EXISTS item_code   text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS uom         text,
  ADD COLUMN IF NOT EXISTS qty         numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price  numeric default 0,
  ADD COLUMN IF NOT EXISTS subtotal    numeric default 0;

DO $$ BEGIN
  ALTER TABLE public.purchase_return_items ADD CONSTRAINT fk_pret_items
    FOREIGN KEY (return_id) REFERENCES public.purchase_returns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.purchase_returns      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pret_po    ON public.purchase_returns(po_id);
CREATE INDEX IF NOT EXISTS idx_pret_items ON public.purchase_return_items(return_id);

SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('purchase_returns','purchase_return_items')
ORDER BY table_name;
