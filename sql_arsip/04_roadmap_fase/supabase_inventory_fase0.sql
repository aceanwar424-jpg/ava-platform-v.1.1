-- ══════════════════════════════════════════════════════════════
-- OneLab — INVENTORY & LOGISTIK · FASE 0 (Fondasi Skema)
-- ──────────────────────────────────────────────────────────────
-- Tujuan: mencatat resmi SELURUH tabel & kolom yang sudah dipakai
-- oleh modules/inventory.js tetapi belum ada di migration manapun.
-- Aman dijalankan berulang (idempoten): IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Jalankan di Supabase SQL Editor.
--
-- CATATAN ARSITEKTUR: aplikasi saat ini mengakses REST via anon key dari
-- browser, sehingga RLS di-DISABLE agar konsisten dengan tabel lain.
-- Pengetatan RLS/RPC adalah pekerjaan Fase 5 (Governance), bukan Fase 0.
-- ══════════════════════════════════════════════════════════════

-- ── 1. INVENTORY_ITEMS — lengkapi kolom MRP yang hilang ────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS item_code          text,
  ADD COLUMN IF NOT EXISTS item_name          text,
  ADD COLUMN IF NOT EXISTS category           text,
  ADD COLUMN IF NOT EXISTS description         text,
  ADD COLUMN IF NOT EXISTS unit                text,
  ADD COLUMN IF NOT EXISTS stock_qty           numeric default 0,
  ADD COLUMN IF NOT EXISTS min_stock           numeric default 0,
  ADD COLUMN IF NOT EXISTS max_stock           numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price          numeric default 0,
  ADD COLUMN IF NOT EXISTS location            text,
  ADD COLUMN IF NOT EXISTS supplier_id         bigint,
  -- Parameter MRP (dipakai openItemForm/saveItem/renderMRPDashboard)
  ADD COLUMN IF NOT EXISTS lead_time_days      integer default 7,
  ADD COLUMN IF NOT EXISTS safety_stock        numeric default 0,
  ADD COLUMN IF NOT EXISTS avg_monthly_usage   numeric default 0,
  ADD COLUMN IF NOT EXISTS reorder_point       numeric default 0,
  ADD COLUMN IF NOT EXISTS is_active           boolean default true,
  ADD COLUMN IF NOT EXISTS description_notes   text,
  ADD COLUMN IF NOT EXISTS updated_at          timestamp default now();

-- ── 2. SUPPLIERS — pastikan kolom yang dipakai form tersedia ───
CREATE TABLE IF NOT EXISTS public.suppliers (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_name    text,
  ADD COLUMN IF NOT EXISTS contact_name     text,
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS address          text,
  ADD COLUMN IF NOT EXISTS rating           numeric,
  ADD COLUMN IF NOT EXISTS item_categories  text,
  ADD COLUMN IF NOT EXISTS payment_terms    text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS is_active        boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

-- ── 3. PURCHASE_REQUESTS — kolom approval 3-jenjang ────────────
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS pr_number        text,
  ADD COLUMN IF NOT EXISTS requested_by     text,
  ADD COLUMN IF NOT EXISTS division         text,
  ADD COLUMN IF NOT EXISTS needed_date      date,
  ADD COLUMN IF NOT EXISTS reason           text,
  ADD COLUMN IF NOT EXISTS total_amount     numeric default 0,
  ADD COLUMN IF NOT EXISTS status           text default 'Draft',
  -- Jenjang SPV
  ADD COLUMN IF NOT EXISTS spv_status       text default 'Pending',
  ADD COLUMN IF NOT EXISTS spv_approver     text,
  ADD COLUMN IF NOT EXISTS spv_at           timestamp,
  ADD COLUMN IF NOT EXISTS spv_note         text,
  -- Jenjang Manager
  ADD COLUMN IF NOT EXISTS manager_status   text default 'Pending',
  ADD COLUMN IF NOT EXISTS manager_approver text,
  ADD COLUMN IF NOT EXISTS manager_at       timestamp,
  ADD COLUMN IF NOT EXISTS manager_note     text,
  -- Jenjang Head of Operations
  ADD COLUMN IF NOT EXISTS headops_status   text default 'Pending',
  ADD COLUMN IF NOT EXISTS headops_approver text,
  ADD COLUMN IF NOT EXISTS headops_at       timestamp,
  ADD COLUMN IF NOT EXISTS headops_note     text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamp default now();

-- ── 4. PR_ITEMS — line item Purchase Request ───────────────────
CREATE TABLE IF NOT EXISTS public.pr_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.pr_items
  ADD COLUMN IF NOT EXISTS pr_id       bigint,
  ADD COLUMN IF NOT EXISTS item_id     bigint,
  ADD COLUMN IF NOT EXISTS item_code   text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category    text,
  ADD COLUMN IF NOT EXISTS uom         text,
  ADD COLUMN IF NOT EXISTS unit_price  numeric default 0,
  ADD COLUMN IF NOT EXISTS qty         numeric default 0,
  ADD COLUMN IF NOT EXISTS subtotal    numeric default 0;

-- ── 5. PURCHASE_ORDERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_number     text,
  ADD COLUMN IF NOT EXISTS pr_id         bigint,
  ADD COLUMN IF NOT EXISTS supplier_id   bigint,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS order_date    date,
  ADD COLUMN IF NOT EXISTS expected_date date,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS status        text default 'Draft',
  ADD COLUMN IF NOT EXISTS total_amount  numeric default 0,
  ADD COLUMN IF NOT EXISTS created_by    text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

-- ── 6. PO_ITEMS — line item Purchase Order (+ qty_received) ────
CREATE TABLE IF NOT EXISTS public.po_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.po_items
  ADD COLUMN IF NOT EXISTS po_id        bigint,
  ADD COLUMN IF NOT EXISTS item_id      bigint,
  ADD COLUMN IF NOT EXISTS item_code    text,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS uom          text,
  ADD COLUMN IF NOT EXISTS unit_price   numeric default 0,
  ADD COLUMN IF NOT EXISTS qty_ordered  numeric default 0,
  ADD COLUMN IF NOT EXISTS qty_received numeric default 0,
  ADD COLUMN IF NOT EXISTS subtotal     numeric default 0;

-- ── 7. STOCK_LEDGER — histori pergerakan stok permanen ─────────
CREATE TABLE IF NOT EXISTS public.stock_ledger (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.stock_ledger
  ADD COLUMN IF NOT EXISTS item_id       bigint,
  ADD COLUMN IF NOT EXISTS item_code     text,
  ADD COLUMN IF NOT EXISTS item_name     text,
  ADD COLUMN IF NOT EXISTS movement_type text,   -- IN | OUT | ADJUST | TRANSFER
  ADD COLUMN IF NOT EXISTS qty           numeric default 0,
  ADD COLUMN IF NOT EXISTS balance_after numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS ref_type      text,   -- manual | po | opname | issue | transfer
  ADD COLUMN IF NOT EXISTS ref_id        bigint,
  ADD COLUMN IF NOT EXISTS ref_number    text,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS created_by    text;

-- ── 8. STOCK_OPNAME (header) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_opname (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.stock_opname
  ADD COLUMN IF NOT EXISTS opname_number       text,
  ADD COLUMN IF NOT EXISTS opname_type         text,   -- Mingguan | Bulanan
  ADD COLUMN IF NOT EXISTS period_label        text,
  ADD COLUMN IF NOT EXISTS status              text default 'Draft',
  ADD COLUMN IF NOT EXISTS conducted_by        text,
  ADD COLUMN IF NOT EXISTS conducted_at        timestamp,
  ADD COLUMN IF NOT EXISTS total_items_checked integer default 0,
  ADD COLUMN IF NOT EXISTS total_selisih_value numeric default 0;

-- ── 9. STOCK_OPNAME_ITEMS (detail) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.stock_opname_items
  ADD COLUMN IF NOT EXISTS opname_id     bigint,
  ADD COLUMN IF NOT EXISTS item_id       bigint,
  ADD COLUMN IF NOT EXISTS item_code     text,
  ADD COLUMN IF NOT EXISTS item_name     text,
  ADD COLUMN IF NOT EXISTS system_qty    numeric default 0,
  ADD COLUMN IF NOT EXISTS physical_qty  numeric default 0,
  ADD COLUMN IF NOT EXISTS selisih       numeric default 0,
  ADD COLUMN IF NOT EXISTS unit_price    numeric default 0,
  ADD COLUMN IF NOT EXISTS selisih_value numeric default 0;

-- ── 10. INVENTORY_DOC_CHAT — diskusi per dokumen PR/PO ─────────
CREATE TABLE IF NOT EXISTS public.inventory_doc_chat (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.inventory_doc_chat
  ADD COLUMN IF NOT EXISTS doc_type    text,   -- pr | po
  ADD COLUMN IF NOT EXISTS doc_id      bigint,
  ADD COLUMN IF NOT EXISTS message     text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_id   uuid;

-- ── 11. Foreign keys (aman: skip jika sudah ada) ───────────────
DO $$ BEGIN
  ALTER TABLE public.pr_items ADD CONSTRAINT fk_pr_items_pr
    FOREIGN KEY (pr_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.po_items ADD CONSTRAINT fk_po_items_po
    FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.purchase_orders ADD CONSTRAINT fk_po_pr
    FOREIGN KEY (pr_id) REFERENCES public.purchase_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stock_opname_items ADD CONSTRAINT fk_opname_items_opname
    FOREIGN KEY (opname_id) REFERENCES public.stock_opname(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 12. Disable RLS (konsisten arsitektur anon-key saat ini) ───
ALTER TABLE public.inventory_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_items           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_doc_chat DISABLE ROW LEVEL SECURITY;

-- ── 13. Index untuk query yang sering dipakai modul ────────────
CREATE INDEX IF NOT EXISTS idx_inv_stock        ON public.inventory_items(stock_qty);
CREATE INDEX IF NOT EXISTS idx_inv_active       ON public.inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr      ON public.pr_items(pr_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po      ON public.po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_ledger_item      ON public.stock_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created   ON public.stock_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_opname_items_op  ON public.stock_opname_items(opname_id);
CREATE INDEX IF NOT EXISTS idx_docchat_doc      ON public.inventory_doc_chat(doc_type, doc_id);

-- ── Verifikasi tabel inventory yang kini tercatat ──────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('inventory_items','suppliers','purchase_requests','pr_items',
                     'purchase_orders','po_items','stock_ledger','stock_opname',
                     'stock_opname_items','inventory_doc_chat')
ORDER BY table_name;
