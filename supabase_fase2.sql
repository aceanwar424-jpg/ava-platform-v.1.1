-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 2 : Menyambung yang Sudah Ada
-- ──────────────────────────────────────────────────────────────
--   2.1  Resep BHP per tes + potong stok otomatis dari Lab/MCU/Radiologi
--   2.7  Telusur lot: hasil pemeriksaan tahu memakai batch reagen yang mana
--   2.4  Faktur supplier + pencocokan tiga arah
--   2.5  Kontrol anggaran pada PR
--   2.6  Multi-gudang + pemindahan antar lokasi
--
-- TEMUAN YANG DIJAWAB (audit 18 Jul 2026, temuan kritis #2):
--   Lab, MCU, dan Radiologi tidak pernah memotong stok. Pemakaian reagen
--   harian tidak tercatat, sehingga avg_monthly_usage untuk MRP tidak pernah
--   akurat dan harga pokok per pemeriksaan tidak terukur.
--
-- PRASYARAT: supabase_fase1_rpc.sql sudah dijalankan (current_app_role,
--            current_app_name, write_audit).
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 2.1  RESEP BHP — barang apa saja yang terpakai untuk satu tes
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_consumables (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.product_consumables
  ADD COLUMN IF NOT EXISTS product_id   bigint,
  ADD COLUMN IF NOT EXISTS item_id      bigint,
  ADD COLUMN IF NOT EXISTS qty_per_test numeric default 1,
  ADD COLUMN IF NOT EXISTS is_active    boolean default true,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.product_consumables
    ADD CONSTRAINT uq_product_item UNIQUE (product_id, item_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_pc_product ON public.product_consumables(product_id);

-- ══════════════════════════════════════════════════════════════
-- 2.7  KONSUMSI PER HASIL — sekaligus telusur lot & dasar harga pokok
-- ══════════════════════════════════════════════════════════════
-- Satu baris = satu barang yang terpakai untuk satu hasil pemeriksaan.
-- Menjawab dua arah: dari lot -> hasil mana saja yang memakainya (penarikan
-- reagen bermasalah), dan dari hasil -> lot apa yang dipakai (telusur ISO 15189).
CREATE TABLE IF NOT EXISTS public.lab_result_consumption (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.lab_result_consumption
  ADD COLUMN IF NOT EXISTS result_id   bigint,
  ADD COLUMN IF NOT EXISTS product_id  bigint,
  ADD COLUMN IF NOT EXISTS item_id     bigint,
  ADD COLUMN IF NOT EXISTS item_name   text,
  ADD COLUMN IF NOT EXISTS qty         numeric default 0,
  ADD COLUMN IF NOT EXISTS batch_id    bigint,
  ADD COLUMN IF NOT EXISTS batch_no    text,
  ADD COLUMN IF NOT EXISTS unit_cost   numeric default 0,
  ADD COLUMN IF NOT EXISTS total_cost  numeric default 0,
  ADD COLUMN IF NOT EXISTS consumed_at timestamp default now();

CREATE INDEX IF NOT EXISTS idx_lrc_result ON public.lab_result_consumption(result_id);
CREATE INDEX IF NOT EXISTS idx_lrc_batch  ON public.lab_result_consumption(batch_id);

-- Penanda agar satu hasil tidak dipotong dua kali
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS consumed_at timestamp;

-- ══════════════════════════════════════════════════════════════
-- 2.1  FUNGSI: potong stok sesuai resep BHP untuk satu hasil
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.consume_for_result(p_result_id bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res    record;
  v_rec    record;
  v_item   record;
  v_new    numeric;
  v_left   numeric;
  v_batch  record;
  v_take   numeric;
  v_first  bigint := NULL;
  v_firstno text := NULL;
  v_count  int := 0;
  v_total  numeric := 0;
BEGIN
  SELECT * INTO v_res FROM lab_results WHERE id = p_result_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','hasil tidak ditemukan'); END IF;

  -- Idempoten: sekali potong per hasil
  IF v_res.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'skipped','sudah dipotong sebelumnya');
  END IF;
  IF v_res.product_id IS NULL THEN
    RETURN jsonb_build_object('ok',true,'skipped','hasil tanpa product_id');
  END IF;

  FOR v_rec IN
    SELECT * FROM product_consumables
    WHERE product_id = v_res.product_id AND coalesce(is_active,true) = true
  LOOP
    SELECT * INTO v_item FROM inventory_items WHERE id = v_rec.item_id FOR UPDATE;
    CONTINUE WHEN NOT FOUND;

    v_new := coalesce(v_item.stock_qty,0) - coalesce(v_rec.qty_per_test,0);
    -- Stok minus TIDAK menghalangi pekerjaan klinis; dicatat apa adanya
    -- agar selisihnya terlihat dan bisa ditelusuri.
    UPDATE inventory_items SET stock_qty = v_new, updated_at = now() WHERE id = v_item.id;

    INSERT INTO stock_ledger(item_id, item_code, item_name, movement_type, qty, balance_after,
                             unit_price, ref_type, ref_id, ref_number, notes, created_by, created_at)
    VALUES (v_item.id, v_item.item_code, v_item.item_name, 'OUT',
            -coalesce(v_rec.qty_per_test,0), v_new, coalesce(v_item.unit_price,0),
            'lab', p_result_id, v_res.product_name,
            concat('Pemakaian otomatis: ', coalesce(v_res.product_name,'tes')),
            'Sistem', now());

    -- FEFO + catat lot yang benar-benar terpakai (2.7)
    v_first := NULL; v_firstno := NULL;
    IF coalesce(v_item.track_batch,false) THEN
      v_left := coalesce(v_rec.qty_per_test,0);
      FOR v_batch IN
        SELECT * FROM inventory_batches
        WHERE item_id = v_item.id AND coalesce(qty_remaining,0) > 0
        ORDER BY expiry_date NULLS LAST, id
        FOR UPDATE
      LOOP
        EXIT WHEN v_left <= 0;
        v_take := least(v_left, v_batch.qty_remaining);
        UPDATE inventory_batches SET qty_remaining = qty_remaining - v_take, updated_at = now()
          WHERE id = v_batch.id;
        IF v_first IS NULL THEN v_first := v_batch.id; v_firstno := v_batch.batch_no; END IF;
        v_left := v_left - v_take;
      END LOOP;
    END IF;

    INSERT INTO lab_result_consumption(result_id, product_id, item_id, item_name, qty,
                                       batch_id, batch_no, unit_cost, total_cost, consumed_at)
    VALUES (p_result_id, v_res.product_id, v_item.id, v_item.item_name,
            coalesce(v_rec.qty_per_test,0), v_first, v_firstno,
            coalesce(v_item.unit_price,0),
            coalesce(v_item.unit_price,0) * coalesce(v_rec.qty_per_test,0), now());

    v_count := v_count + 1;
    v_total := v_total + coalesce(v_item.unit_price,0) * coalesce(v_rec.qty_per_test,0);
  END LOOP;

  UPDATE lab_results SET consumed_at = now() WHERE id = p_result_id;

  RETURN jsonb_build_object('ok',true,'items',v_count,'cost',v_total);
END $$;

-- ── Pemicu: setiap hasil baru langsung memotong stok ───────────
-- Dipasang sebagai trigger, bukan dipanggil dari JavaScript, karena hasil
-- dibuat dari empat jalur berbeda di modul lab. Dengan trigger, tidak ada
-- jalur yang bisa terlewat.
CREATE OR REPLACE FUNCTION public.trg_consume_on_result()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.consume_for_result(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Pekerjaan klinis TIDAK BOLEH terhalang oleh urusan persediaan.
  RAISE WARNING 'Konsumsi BHP gagal untuk hasil %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lab_results_consume ON public.lab_results;
CREATE TRIGGER lab_results_consume
  AFTER INSERT ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.trg_consume_on_result();

-- ══════════════════════════════════════════════════════════════
-- 2.6  MULTI-GUDANG + PEMINDAHAN
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.warehouses (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS code       text,
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS wh_type    text default 'Gudang',  -- Gudang | Unit | Kit Nakes
  ADD COLUMN IF NOT EXISTS location   text,
  ADD COLUMN IF NOT EXISTS is_active  boolean default true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

INSERT INTO public.warehouses (code, name, wh_type)
SELECT v.c, v.n, v.t FROM (VALUES
  ('WH-PUSAT','Gudang Pusat','Gudang'),
  ('WH-LAB','Laboratorium','Unit'),
  ('WH-RAD','Radiologi','Unit'),
  ('WH-HC','Kit Home Care','Kit Nakes')
) AS v(c,n,t)
WHERE NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.code = v.c);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.stock_transfers
  ADD COLUMN IF NOT EXISTS transfer_number text,
  ADD COLUMN IF NOT EXISTS item_id      bigint,
  ADD COLUMN IF NOT EXISTS from_wh_id   bigint,
  ADD COLUMN IF NOT EXISTS to_wh_id     bigint,
  ADD COLUMN IF NOT EXISTS qty          numeric default 0,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS created_by   text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

-- ══════════════════════════════════════════════════════════════
-- 2.4  FAKTUR SUPPLIER + PENCOCOKAN TIGA ARAH
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_invoices (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.vendor_invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS po_id          bigint,
  ADD COLUMN IF NOT EXISTS supplier_id    bigint,
  ADD COLUMN IF NOT EXISTS supplier_name  text,
  ADD COLUMN IF NOT EXISTS invoice_date   date,
  ADD COLUMN IF NOT EXISTS due_date       date,
  ADD COLUMN IF NOT EXISTS total_amount   numeric default 0,
  ADD COLUMN IF NOT EXISTS match_status   text default 'Belum Dicocokkan', -- Cocok | Selisih | Belum Dicocokkan
  ADD COLUMN IF NOT EXISTS match_note     text,
  ADD COLUMN IF NOT EXISTS payment_status text default 'Belum Dibayar',
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS created_by     text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamp default now();

CREATE INDEX IF NOT EXISTS idx_vi_po ON public.vendor_invoices(po_id);

-- Pencocokan tiga arah: PO vs penerimaan vs faktur
CREATE OR REPLACE FUNCTION public.match_vendor_invoice(p_invoice_id bigint, p_tolerance numeric DEFAULT 0.02)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv      record;
  v_ordered  numeric;
  v_received numeric;
  v_po_value numeric;
  v_diff     numeric;
  v_status   text;
  v_note     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;

  SELECT * INTO v_inv FROM vendor_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Faktur tidak ditemukan'; END IF;
  IF v_inv.po_id IS NULL THEN RAISE EXCEPTION 'Faktur belum ditautkan ke PO'; END IF;

  SELECT coalesce(sum(qty_ordered),0), coalesce(sum(qty_received),0),
         coalesce(sum(coalesce(qty_received,0) * coalesce(unit_price,0)),0)
    INTO v_ordered, v_received, v_po_value
    FROM po_items WHERE po_id = v_inv.po_id;

  v_diff := coalesce(v_inv.total_amount,0) - v_po_value;

  IF v_received = 0 THEN
    v_status := 'Selisih';
    v_note   := 'Barang belum diterima — faktur tidak boleh dibayar';
  ELSIF v_po_value > 0 AND abs(v_diff) / v_po_value <= p_tolerance THEN
    v_status := 'Cocok';
    v_note   := format('Nilai penerimaan %s, faktur %s (selisih %s)', v_po_value, v_inv.total_amount, v_diff);
  ELSE
    v_status := 'Selisih';
    v_note   := format('Selisih %s di luar toleransi. Penerimaan %s vs faktur %s',
                       v_diff, v_po_value, v_inv.total_amount);
  END IF;

  UPDATE vendor_invoices SET match_status = v_status, match_note = v_note, updated_at = now()
    WHERE id = p_invoice_id;

  PERFORM public.write_audit('match','vendor_invoices', p_invoice_id::text,
    concat('Pencocokan tiga arah: ', v_status, ' — ', v_note), v_inv.invoice_number);

  RETURN jsonb_build_object('ok',true,'status',v_status,'note',v_note,
                            'qty_ordered',v_ordered,'qty_received',v_received,
                            'nilai_penerimaan',v_po_value,'selisih',v_diff);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2.5  ANGGARAN PER DIVISI
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.budgets (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS division   text,
  ADD COLUMN IF NOT EXISTS period     text,          -- '2026' atau '2026-07'
  ADD COLUMN IF NOT EXISTS category   text,          -- opsional, per kategori barang
  ADD COLUMN IF NOT EXISTS amount     numeric default 0,
  ADD COLUMN IF NOT EXISTS notes      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp default now();

CREATE INDEX IF NOT EXISTS idx_budget_div ON public.budgets(division, period);

-- Sisa pagu divisi pada satu periode (PR yang sudah disetujui dihitung terpakai)
CREATE OR REPLACE FUNCTION public.budget_remaining(p_division text, p_period text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_budget numeric; v_used numeric;
BEGIN
  SELECT coalesce(sum(amount),0) INTO v_budget
    FROM budgets WHERE division = p_division AND period = p_period;

  SELECT coalesce(sum(total_amount),0) INTO v_used
    FROM purchase_requests
    WHERE division = p_division
      AND to_char(created_at,'YYYY-MM') LIKE p_period || '%'
      AND status NOT IN ('Rejected','Draft');

  RETURN jsonb_build_object('budget',v_budget,'used',v_used,'remaining',v_budget - v_used);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan — konsisten Fase 1
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lab_result_consumption'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                    USING (true) WITH CHECK (true)', t||'_authenticated', t);
  END LOOP;
END $$;

ALTER TABLE public.product_consumables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invoices     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets             DISABLE ROW LEVEL SECURITY;

-- Fungsi internal / hanya pengguna login (pelajaran dari celah write_audit)
REVOKE ALL ON FUNCTION public.consume_for_result(bigint)          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_consume_on_result()             FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_vendor_invoice(bigint,numeric) FROM public, anon;
REVOKE ALL ON FUNCTION public.budget_remaining(text,text)         FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_vendor_invoice(bigint,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_remaining(text,text)          TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- Verifikasi
-- ══════════════════════════════════════════════════════════════
SELECT 'tabel baru' AS jenis, table_name AS nama
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('product_consumables','lab_result_consumption','warehouses',
                     'stock_transfers','vendor_invoices','budgets')
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('consume_for_result','match_vendor_invoice','budget_remaining')
UNION ALL
SELECT 'pemicu', tgname FROM pg_trigger WHERE tgname='lab_results_consume'
ORDER BY 1,2;
