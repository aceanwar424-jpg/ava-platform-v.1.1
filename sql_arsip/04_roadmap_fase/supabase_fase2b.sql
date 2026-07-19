-- ══════════════════════════════════════════════════════════════
-- OneLab — Lanjutan Fase 2 & sebagian Fase 4 (tanpa keputusan akuntansi)
-- ──────────────────────────────────────────────────────────────
--   2.6  Stok per lokasi + pemindahan antar gudang
--   2.5  Kontrol anggaran pada Purchase Request
--   4.7  Tutup kas per shift kasir
--   4.5  Jadwal kalibrasi & pemeliharaan alat (TANPA penyusutan)
--
-- Bagian penyusutan, bagan akun, jurnal, dan PPh 21 sengaja TIDAK disertakan
-- karena memerlukan keputusan akuntan dan konsultan pajak.
--
-- PRASYARAT: supabase_fase1_rpc.sql, supabase_fase2.sql
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 2.6  STOK PER LOKASI
-- ══════════════════════════════════════════════════════════════
-- KEPUTUSAN RANCANGAN: inventory_items.stock_qty tetap menjadi TOTAL yang
-- dipakai seluruh layar yang sudah ada. Tabel ini hanya RINCIAN sebarannya,
-- sehingga pemindahan antar lokasi tidak mengubah total dan tidak ada satu pun
-- layar lama yang rusak.
CREATE TABLE IF NOT EXISTS public.stock_by_location (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.stock_by_location
  ADD COLUMN IF NOT EXISTS item_id      bigint,
  ADD COLUMN IF NOT EXISTS warehouse_id bigint,
  ADD COLUMN IF NOT EXISTS qty          numeric default 0,
  ADD COLUMN IF NOT EXISTS updated_at   timestamp default now();

DO $$ BEGIN
  ALTER TABLE public.stock_by_location ADD CONSTRAINT uq_item_wh UNIQUE (item_id, warehouse_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Seluruh stok yang ada sekarang dianggap berada di Gudang Pusat.
-- Hanya dijalankan sekali; barang yang sudah punya rincian dilewati.
INSERT INTO public.stock_by_location (item_id, warehouse_id, qty, updated_at)
SELECT i.id, w.id, coalesce(i.stock_qty,0), now()
FROM public.inventory_items i
CROSS JOIN (SELECT id FROM public.warehouses WHERE code='WH-PUSAT' LIMIT 1) w
WHERE NOT EXISTS (SELECT 1 FROM public.stock_by_location s WHERE s.item_id = i.id);

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_item_id bigint, p_from_wh bigint, p_to_wh bigint, p_qty numeric, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.current_app_role();
  v_name text := public.current_app_name();
  v_item record; v_from record; v_to record;
  v_avail numeric; v_no text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('spv','manager','direktur','super_admin','operasional') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang memindahkan barang', v_role;
  END IF;
  IF p_from_wh = p_to_wh THEN RAISE EXCEPTION 'Lokasi asal dan tujuan sama'; END IF;
  IF coalesce(p_qty,0) <= 0 THEN RAISE EXCEPTION 'Jumlah pemindahan harus lebih dari nol'; END IF;

  SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barang tidak ditemukan'; END IF;
  SELECT * INTO v_from FROM warehouses WHERE id = p_from_wh;
  SELECT * INTO v_to   FROM warehouses WHERE id = p_to_wh;
  IF v_from IS NULL OR v_to IS NULL THEN RAISE EXCEPTION 'Gudang tidak ditemukan'; END IF;

  SELECT coalesce(qty,0) INTO v_avail FROM stock_by_location
    WHERE item_id = p_item_id AND warehouse_id = p_from_wh FOR UPDATE;
  IF coalesce(v_avail,0) < p_qty THEN
    RAISE EXCEPTION 'Stok di % tidak mencukupi: tersedia %, diminta %',
      v_from.name, coalesce(v_avail,0), p_qty;
  END IF;

  UPDATE stock_by_location SET qty = qty - p_qty, updated_at = now()
    WHERE item_id = p_item_id AND warehouse_id = p_from_wh;

  INSERT INTO stock_by_location (item_id, warehouse_id, qty, updated_at)
  VALUES (p_item_id, p_to_wh, p_qty, now())
  ON CONFLICT (item_id, warehouse_id)
  DO UPDATE SET qty = stock_by_location.qty + EXCLUDED.qty, updated_at = now();

  v_no := 'TRF/' || to_char(now(),'YYYY') || '/' || lpad((floor(random()*99999))::text,5,'0');

  INSERT INTO stock_transfers(transfer_number, item_id, from_wh_id, to_wh_id, qty,
                              notes, created_by, updated_at)
  VALUES (v_no, p_item_id, p_from_wh, p_to_wh, p_qty, p_notes, v_name, now());

  -- Total tidak berubah; kartu stok mencatat perpindahannya saja.
  INSERT INTO stock_ledger(item_id, item_code, item_name, movement_type, qty, balance_after,
                           unit_price, ref_type, ref_id, ref_number, notes, created_by, created_at)
  VALUES (p_item_id, v_item.item_code, v_item.item_name, 'TRANSFER', p_qty,
          coalesce(v_item.stock_qty,0), coalesce(v_item.unit_price,0),
          'transfer', NULL, v_no,
          concat(v_from.name, ' → ', v_to.name, coalesce(' · '||p_notes,'')), v_name, now());

  PERFORM public.write_audit('transfer','stock_transfers', v_no,
    format('Pindah %s %s dari %s ke %s', p_qty, v_item.item_name, v_from.name, v_to.name),
    v_item.item_name);

  RETURN jsonb_build_object('ok',true,'transfer_number',v_no);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 4.7  TUTUP KAS PER SHIFT
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.cashier_shifts
  ADD COLUMN IF NOT EXISTS cashier_name    text,
  ADD COLUMN IF NOT EXISTS cashier_id      uuid,
  ADD COLUMN IF NOT EXISTS opened_at       timestamp,
  ADD COLUMN IF NOT EXISTS closed_at       timestamp,
  ADD COLUMN IF NOT EXISTS opening_balance numeric default 0,
  ADD COLUMN IF NOT EXISTS system_total    numeric default 0,  -- dihitung sistem
  ADD COLUMN IF NOT EXISTS counted_total   numeric default 0,  -- hasil hitung fisik
  ADD COLUMN IF NOT EXISTS variance        numeric default 0,
  ADD COLUMN IF NOT EXISTS variance_note   text,
  ADD COLUMN IF NOT EXISTS status          text default 'Buka', -- Buka | Tutup
  ADD COLUMN IF NOT EXISTS deposited_at    timestamp,
  ADD COLUMN IF NOT EXISTS deposit_ref     text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamp default now();

CREATE INDEX IF NOT EXISTS idx_shift_status ON public.cashier_shifts(status, opened_at);

-- Tutup shift: total sistem dihitung dari transaksi, bukan diketik petugas
CREATE OR REPLACE FUNCTION public.close_cashier_shift(
  p_shift_id bigint, p_counted numeric, p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shift record; v_sys numeric; v_var numeric; v_name text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;

  SELECT * INTO v_shift FROM cashier_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift tidak ditemukan'; END IF;
  IF v_shift.status = 'Tutup' THEN RAISE EXCEPTION 'Shift sudah ditutup'; END IF;

  -- Penerimaan tunai selama shift berlangsung
  SELECT coalesce(sum(amount),0) INTO v_sys
  FROM cashier_transactions
  WHERE created_at >= v_shift.opened_at
    AND created_at <= now()
    AND coalesce(payment_method,'Tunai') ILIKE '%tunai%';

  v_sys := v_sys + coalesce(v_shift.opening_balance,0);
  v_var := coalesce(p_counted,0) - v_sys;

  IF v_var <> 0 AND coalesce(trim(p_note),'') = '' THEN
    RAISE EXCEPTION 'Ada selisih kas sebesar %. Penjelasan wajib diisi.', v_var;
  END IF;

  UPDATE cashier_shifts
    SET closed_at = now(), system_total = v_sys, counted_total = coalesce(p_counted,0),
        variance = v_var, variance_note = p_note, status = 'Tutup', updated_at = now()
    WHERE id = p_shift_id;

  PERFORM public.write_audit('shift_close','cashier_shifts', p_shift_id::text,
    format('Tutup shift %s — sistem %s, hitung %s, selisih %s',
           v_shift.cashier_name, v_sys, p_counted, v_var),
    v_shift.cashier_name, NULL,
    jsonb_build_object('system',v_sys,'counted',p_counted,'variance',v_var,'note',p_note));

  RETURN jsonb_build_object('ok',true,'system_total',v_sys,'counted',p_counted,'variance',v_var);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 4.5  JADWAL KALIBRASI & PEMELIHARAAN ALAT (tanpa penyusutan)
-- ══════════════════════════════════════════════════════════════
-- Bersinggungan dengan QC lab: alat yang lewat jatuh tempo kalibrasi
-- seharusnya tidak dipakai mengeluarkan hasil.
CREATE TABLE IF NOT EXISTS public.asset_maintenance (
  id bigint generated always as identity primary key,
  created_at timestamp default now()
);
ALTER TABLE public.asset_maintenance
  ADD COLUMN IF NOT EXISTS analyzer_id   bigint,
  ADD COLUMN IF NOT EXISTS asset_name    text,
  ADD COLUMN IF NOT EXISTS maint_type    text default 'Kalibrasi', -- Kalibrasi | Preventif | Perbaikan
  ADD COLUMN IF NOT EXISTS interval_days integer default 365,
  ADD COLUMN IF NOT EXISTS due_date      date,
  ADD COLUMN IF NOT EXISTS done_at       date,
  ADD COLUMN IF NOT EXISTS performed_by  text,
  ADD COLUMN IF NOT EXISTS vendor        text,
  ADD COLUMN IF NOT EXISTS cost          numeric default 0,
  ADD COLUMN IF NOT EXISTS certificate_no text,
  ADD COLUMN IF NOT EXISTS result        text,   -- Lulus | Tidak Lulus | Perlu Tindak Lanjut
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamp default now();

CREATE INDEX IF NOT EXISTS idx_maint_due ON public.asset_maintenance(due_date, done_at);

-- Menyelesaikan satu jadwal sekaligus menerbitkan jadwal berikutnya
CREATE OR REPLACE FUNCTION public.complete_maintenance(
  p_id bigint, p_result text, p_cert text DEFAULT NULL, p_cost numeric DEFAULT 0, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m record; v_next date; v_name text := public.current_app_name();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  SELECT * INTO v_m FROM asset_maintenance WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jadwal tidak ditemukan'; END IF;

  UPDATE asset_maintenance
    SET done_at = current_date, result = p_result, certificate_no = p_cert,
        cost = coalesce(p_cost,0), performed_by = v_name,
        notes = coalesce(p_notes, notes), updated_at = now()
    WHERE id = p_id;

  -- Jadwal berikutnya hanya diterbitkan bila hasilnya lulus
  IF p_result = 'Lulus' AND coalesce(v_m.interval_days,0) > 0 THEN
    v_next := current_date + v_m.interval_days;
    INSERT INTO asset_maintenance(analyzer_id, asset_name, maint_type, interval_days,
                                  due_date, updated_at)
    VALUES (v_m.analyzer_id, v_m.asset_name, v_m.maint_type, v_m.interval_days, v_next, now());
  END IF;

  PERFORM public.write_audit('maintenance','asset_maintenance', p_id::text,
    format('%s %s: %s', v_m.maint_type, v_m.asset_name, p_result), v_m.asset_name);

  RETURN jsonb_build_object('ok',true,'next_due',v_next);
END $$;

-- ══════════════════════════════════════════════════════════════
-- RLS & perizinan
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.stock_by_location  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance  DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT p.polname FROM pg_policy p
             JOIN pg_class c ON c.oid=p.polrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='cashier_shifts'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.cashier_shifts', pol.polname); END LOOP;
  EXECUTE 'ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY cashier_shifts_authenticated ON public.cashier_shifts
           FOR ALL TO authenticated USING (true) WITH CHECK (true)';
END $$;

REVOKE ALL ON FUNCTION public.transfer_stock(bigint,bigint,bigint,numeric,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.close_cashier_shift(bigint,numeric,text)          FROM public, anon;
REVOKE ALL ON FUNCTION public.complete_maintenance(bigint,text,text,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.transfer_stock(bigint,bigint,bigint,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cashier_shift(bigint,numeric,text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_maintenance(bigint,text,text,numeric,text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
SELECT 'tabel' AS jenis, table_name AS nama FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('stock_by_location','cashier_shifts','asset_maintenance')
UNION ALL
SELECT 'fungsi', proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('transfer_stock','close_cashier_shift','complete_maintenance')
ORDER BY 1,2;
