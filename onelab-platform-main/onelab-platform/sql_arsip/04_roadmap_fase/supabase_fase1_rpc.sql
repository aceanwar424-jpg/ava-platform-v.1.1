-- ══════════════════════════════════════════════════════════════
-- OneLab — FASE 1.2 + 1.4 + 1.5 : RPC berwewenang & atomik
-- ──────────────────────────────────────────────────────────────
-- MASALAH YANG DIPERBAIKI
--
-- 1.2  Wewenang hanya diperiksa di browser. getUserRole() membaca
--      window.currentUser, sehingga siapa pun yang membuka peramban dapat
--      mengubahnya lalu menyetujui PR bernilai berapa pun.
--
-- 1.4  Alur penting menulis ke banyak tabel secara berurutan tanpa transaksi.
--      Bila putus di tengah, stok berkurang tetapi kartu stok tidak tercatat —
--      selisih yang baru ketahuan saat opname dan tidak bisa ditelusuri.
--
-- 1.5  Jejak audit belum menyeluruh dan tidak menyimpan kondisi sebelum/sesudah.
--
-- CARA KERJA
--   Setiap fungsi di bawah adalah SATU transaksi. Semua perubahan berhasil
--   bersama atau dibatalkan bersama. Pemeriksaan peran dilakukan di dalam
--   basis data memakai current_app_role(), sehingga tidak bisa dilewati dari
--   sisi klien. Jejak audit ditulis di fungsi yang sama.
--
-- PRASYARAT: supabase_fase1_rls_a.sql sudah dijalankan (menyediakan
--            current_app_role()).
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── Penolong: nama pengguna yang sedang login ──────────────────
CREATE OR REPLACE FUNCTION public.current_app_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(trim(p.full_name), ''), 'Pengguna')
  FROM public.user_profiles p WHERE p.id = auth.uid()
$$;

-- ── Penolong: catat jejak audit ────────────────────────────────
CREATE OR REPLACE FUNCTION public.write_audit(
  p_action text, p_table text, p_record_id text, p_description text,
  p_record_name text DEFAULT NULL, p_before jsonb DEFAULT NULL, p_after jsonb DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.activity_logs
    (action, table_name, record_id, description, record_name,
     user_id, user_name, created_at, before_data, after_data)
  VALUES
    (p_action, p_table, p_record_id, p_description, p_record_name,
     auth.uid(), public.current_app_name(), now(), p_before, p_after)
$$;

-- ══════════════════════════════════════════════════════════════
-- 1.2  PERSETUJUAN PURCHASE REQUEST — wewenang ditegakkan di server
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_pr(
  p_pr_id bigint, p_tier text, p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role   text := public.current_app_role();
  v_name   text := public.current_app_name();
  v_pr     record;
  v_now    timestamptz := now();
  v_next   text;
  v_status text;
  v_before jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF p_tier NOT IN ('spv','manager','headops') THEN
    RAISE EXCEPTION 'Jenjang tidak dikenal: %', p_tier;
  END IF;

  -- FOR UPDATE mengunci baris: dua penyetuju bersamaan tidak saling menimpa
  SELECT * INTO v_pr FROM purchase_requests WHERE id = p_pr_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase Request tidak ditemukan'; END IF;

  -- Wewenang per jenjang — cerminan invCanApprove* di modules/inventory.js
  IF p_tier = 'spv' AND v_role NOT IN ('spv','manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyetujui jenjang SPV', v_role;
  END IF;
  IF p_tier = 'manager' AND v_role NOT IN ('manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyetujui jenjang Manager', v_role;
  END IF;
  IF p_tier = 'headops' AND v_role NOT IN ('direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyetujui jenjang Head of Operations', v_role;
  END IF;

  -- Jenjang ini memang sedang menunggu?
  IF (p_tier='spv'     AND coalesce(v_pr.spv_status,'')     <> 'Pending')
  OR (p_tier='manager' AND coalesce(v_pr.manager_status,'') <> 'Pending')
  OR (p_tier='headops' AND coalesce(v_pr.headops_status,'') <> 'Pending') THEN
    RAISE EXCEPTION 'Jenjang % tidak dalam status menunggu persetujuan', p_tier;
  END IF;

  -- Urutan jenjang: yang sebelumnya harus sudah Approved atau memang di-Skip
  IF p_tier = 'manager' AND coalesce(v_pr.spv_status,'') NOT IN ('Approved','Skip') THEN
    RAISE EXCEPTION 'Jenjang SPV belum selesai';
  END IF;
  IF p_tier = 'headops' AND coalesce(v_pr.manager_status,'') NOT IN ('Approved','Skip') THEN
    RAISE EXCEPTION 'Jenjang Manager belum selesai';
  END IF;

  v_before := to_jsonb(v_pr);

  IF p_tier = 'spv' THEN
    UPDATE purchase_requests SET spv_status='Approved', spv_approver=v_name,
           spv_at=v_now, spv_note=p_note WHERE id=p_pr_id;
  ELSIF p_tier = 'manager' THEN
    UPDATE purchase_requests SET manager_status='Approved', manager_approver=v_name,
           manager_at=v_now, manager_note=p_note WHERE id=p_pr_id;
  ELSE
    UPDATE purchase_requests SET headops_status='Approved', headops_approver=v_name,
           headops_at=v_now, headops_note=p_note WHERE id=p_pr_id;
  END IF;

  -- Status induk: jenjang Pending berikutnya, atau Approved bila semua lolos
  SELECT * INTO v_pr FROM purchase_requests WHERE id = p_pr_id;
  v_next := CASE
    WHEN coalesce(v_pr.spv_status,'')     = 'Pending' THEN 'SPV'
    WHEN coalesce(v_pr.manager_status,'') = 'Pending' THEN 'Manager'
    WHEN coalesce(v_pr.headops_status,'') = 'Pending' THEN 'Head Ops'
    ELSE NULL END;
  v_status := CASE WHEN v_next IS NULL THEN 'Approved' ELSE 'Menunggu ' || v_next END;

  UPDATE purchase_requests SET status=v_status, updated_at=v_now WHERE id=p_pr_id;

  PERFORM public.write_audit('approve','purchase_requests', p_pr_id::text,
    format('Setujui jenjang %s → %s', upper(p_tier), v_status),
    v_pr.pr_number, v_before,
    jsonb_build_object('tier',p_tier,'status',v_status,'oleh',v_name,'catatan',p_note));

  RETURN jsonb_build_object('ok',true,'status',v_status,'tier',p_tier,'oleh',v_name);
END $$;

CREATE OR REPLACE FUNCTION public.reject_pr(
  p_pr_id bigint, p_tier text, p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.current_app_role();
  v_name text := public.current_app_name();
  v_pr   record;
  v_now  timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF coalesce(trim(p_note),'') = '' THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi';
  END IF;

  SELECT * INTO v_pr FROM purchase_requests WHERE id = p_pr_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase Request tidak ditemukan'; END IF;

  IF p_tier = 'spv' AND v_role NOT IN ('spv','manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang', v_role; END IF;
  IF p_tier = 'manager' AND v_role NOT IN ('manager','direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang', v_role; END IF;
  IF p_tier = 'headops' AND v_role NOT IN ('direktur','super_admin') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang', v_role; END IF;

  IF p_tier = 'spv' THEN
    UPDATE purchase_requests SET spv_status='Rejected', spv_approver=v_name,
           spv_at=v_now, spv_note=p_note, status='Rejected', updated_at=v_now WHERE id=p_pr_id;
  ELSIF p_tier = 'manager' THEN
    UPDATE purchase_requests SET manager_status='Rejected', manager_approver=v_name,
           manager_at=v_now, manager_note=p_note, status='Rejected', updated_at=v_now WHERE id=p_pr_id;
  ELSE
    UPDATE purchase_requests SET headops_status='Rejected', headops_approver=v_name,
           headops_at=v_now, headops_note=p_note, status='Rejected', updated_at=v_now WHERE id=p_pr_id;
  END IF;

  PERFORM public.write_audit('reject','purchase_requests', p_pr_id::text,
    format('Tolak jenjang %s: %s', upper(p_tier), p_note), v_pr.pr_number,
    to_jsonb(v_pr), jsonb_build_object('tier',p_tier,'alasan',p_note,'oleh',v_name));

  RETURN jsonb_build_object('ok',true,'status','Rejected','oleh',v_name);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 1.4  PENYESUAIAN STOK — atomik + wewenang + alasan wajib
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_item_id bigint, p_new_qty numeric, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.current_app_role();
  v_name text := public.current_app_name();
  v_item record;
  v_diff numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('spv','manager','direktur','super_admin','operasional') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyesuaikan stok', v_role;
  END IF;
  IF coalesce(trim(p_reason),'') = '' THEN
    RAISE EXCEPTION 'Alasan penyesuaian wajib diisi';
  END IF;

  SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barang tidak ditemukan'; END IF;

  v_diff := p_new_qty - coalesce(v_item.stock_qty, 0);
  IF v_diff = 0 THEN RETURN jsonb_build_object('ok',true,'note','tidak ada perubahan'); END IF;

  UPDATE inventory_items SET stock_qty = p_new_qty, updated_at = now() WHERE id = p_item_id;

  INSERT INTO stock_ledger(item_id, item_code, item_name, movement_type, qty, balance_after,
                           unit_price, ref_type, ref_id, ref_number, notes, created_by, created_at)
  VALUES (p_item_id, v_item.item_code, v_item.item_name, 'ADJUST', v_diff, p_new_qty,
          v_item.unit_price, 'manual', NULL, NULL, p_reason, v_name, now());

  PERFORM public.write_audit('adjust','inventory_items', p_item_id::text,
    format('Sesuaikan stok %s: %s → %s (%s)', v_item.item_name, v_item.stock_qty, p_new_qty, p_reason),
    v_item.item_name,
    jsonb_build_object('stock_qty', v_item.stock_qty),
    jsonb_build_object('stock_qty', p_new_qty, 'alasan', p_reason));

  RETURN jsonb_build_object('ok',true,'balance',p_new_qty,'diff',v_diff);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 1.4  PENGELUARAN BARANG — satu transaksi utuh
--      header + rincian + potong stok + kartu stok + batch FEFO
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.post_goods_issue(
  p_purpose text, p_division text, p_issue_date date, p_notes text, p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  text := public.current_app_role();
  v_name  text := public.current_app_name();
  v_gi_id bigint;
  v_gi_no text;
  v_line  jsonb;
  v_item  record;
  v_qty   numeric;
  v_total numeric := 0;
  v_count int := 0;
  v_new   numeric;
  v_left  numeric;
  v_batch record;
  v_take  numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('spv','manager','direktur','super_admin','operasional') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang mengeluarkan barang', v_role;
  END IF;
  IF jsonb_array_length(coalesce(p_lines,'[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Tidak ada item yang dikeluarkan';
  END IF;

  v_gi_no := 'GI/' || to_char(now(),'YYYY') || '/' ||
             lpad((floor(random()*99999))::text, 5, '0');

  INSERT INTO goods_issues(gi_number, issue_date, purpose, division, ref_type,
                           total_items, total_value, status, issued_by, notes, updated_at)
  VALUES (v_gi_no, coalesce(p_issue_date, current_date), p_purpose, p_division, 'manual',
          0, 0, 'Selesai', v_name, p_notes, now())
  RETURNING id INTO v_gi_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := (v_line->>'qty')::numeric;
    CONTINUE WHEN v_qty IS NULL OR v_qty <= 0;

    SELECT * INTO v_item FROM inventory_items
      WHERE id = (v_line->>'item_id')::bigint FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Barang id % tidak ditemukan', v_line->>'item_id'; END IF;

    -- Stok kurang membatalkan SELURUH dokumen, bukan sebagian
    IF coalesce(v_item.stock_qty,0) < v_qty THEN
      RAISE EXCEPTION 'Stok % tidak mencukupi: tersedia %, diminta %',
        v_item.item_name, coalesce(v_item.stock_qty,0), v_qty;
    END IF;

    v_new := coalesce(v_item.stock_qty,0) - v_qty;
    UPDATE inventory_items SET stock_qty = v_new, updated_at = now() WHERE id = v_item.id;

    INSERT INTO goods_issue_items(gi_id, item_id, item_code, description, uom, qty,
                                  unit_price, subtotal)
    VALUES (v_gi_id, v_item.id, v_item.item_code, v_item.item_name, v_item.unit, v_qty,
            coalesce(v_item.unit_price,0), coalesce(v_item.unit_price,0)*v_qty);

    INSERT INTO stock_ledger(item_id, item_code, item_name, movement_type, qty, balance_after,
                             unit_price, ref_type, ref_id, ref_number, notes, created_by, created_at)
    VALUES (v_item.id, v_item.item_code, v_item.item_name, 'OUT', -v_qty, v_new,
            coalesce(v_item.unit_price,0), 'issue', v_gi_id, v_gi_no,
            concat_ws(' · ', p_purpose, p_division), v_name, now());

    -- FEFO: habiskan batch berkedaluwarsa terdekat lebih dulu
    IF coalesce(v_item.track_batch,false) THEN
      v_left := v_qty;
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
        v_left := v_left - v_take;
      END LOOP;
    END IF;

    v_total := v_total + coalesce(v_item.unit_price,0)*v_qty;
    v_count := v_count + 1;
  END LOOP;

  UPDATE goods_issues SET total_items = v_count, total_value = v_total WHERE id = v_gi_id;

  PERFORM public.write_audit('issue','goods_issues', v_gi_id::text,
    format('Pengeluaran %s item · %s', v_count, p_purpose), v_gi_no,
    NULL, jsonb_build_object('gi_number',v_gi_no,'total',v_total,'lines',p_lines));

  RETURN jsonb_build_object('ok',true,'gi_id',v_gi_id,'gi_number',v_gi_no,
                            'total_items',v_count,'total_value',v_total);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 1.4  PENERIMAAN BARANG DARI PO — satu transaksi utuh
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.receive_po(
  p_po_id bigint, p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.current_app_role();
  v_name text := public.current_app_name();
  v_po   record;
  v_line jsonb;
  v_poi  record;
  v_item record;
  v_qty  numeric;
  v_new  numeric;
  v_any  boolean := false;
  v_full boolean;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('spv','manager','direktur','super_admin','operasional') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menerima barang', v_role;
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase Order tidak ditemukan'; END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) LOOP
    v_qty := (v_line->>'qty')::numeric;
    CONTINUE WHEN v_qty IS NULL OR v_qty <= 0;

    SELECT * INTO v_poi FROM po_items WHERE id = (v_line->>'po_item_id')::bigint FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF coalesce(v_poi.qty_received,0) + v_qty > coalesce(v_poi.qty_ordered,0) THEN
      RAISE EXCEPTION 'Penerimaan % melebihi jumlah pesanan (dipesan %, sudah diterima %)',
        v_poi.description, v_poi.qty_ordered, v_poi.qty_received;
    END IF;

    UPDATE po_items SET qty_received = coalesce(qty_received,0) + v_qty WHERE id = v_poi.id;
    v_any := true;

    IF v_poi.item_id IS NOT NULL THEN
      SELECT * INTO v_item FROM inventory_items WHERE id = v_poi.item_id FOR UPDATE;
      IF FOUND THEN
        v_new := coalesce(v_item.stock_qty,0) + v_qty;
        UPDATE inventory_items SET stock_qty = v_new, updated_at = now() WHERE id = v_item.id;

        INSERT INTO stock_ledger(item_id, item_code, item_name, movement_type, qty, balance_after,
                                 unit_price, ref_type, ref_id, ref_number, notes, created_by, created_at)
        VALUES (v_item.id, v_item.item_code, v_item.item_name, 'IN', v_qty, v_new,
                coalesce(v_item.unit_price,0), 'po', p_po_id, v_po.po_number,
                'Penerimaan PO', v_name, now());

        -- Batch dicatat bila barang dilacak batch dan datanya diisi
        IF coalesce(v_item.track_batch,false)
           AND (coalesce(v_line->>'batch_no','') <> '' OR (v_line->>'expiry_date') IS NOT NULL) THEN
          INSERT INTO inventory_batches(item_id, item_code, batch_no, expiry_date,
                                        qty_received, qty_remaining, received_date, po_id,
                                        supplier_name, unit_price, updated_at)
          VALUES (v_item.id, v_item.item_code, nullif(v_line->>'batch_no',''),
                  nullif(v_line->>'expiry_date','')::date, v_qty, v_qty, current_date, p_po_id,
                  v_po.supplier_name, coalesce(v_item.unit_price,0), now());
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_any THEN RAISE EXCEPTION 'Tidak ada jumlah penerimaan yang diisi'; END IF;

  SELECT bool_and(coalesce(qty_received,0) >= coalesce(qty_ordered,0))
    INTO v_full FROM po_items WHERE po_id = p_po_id;
  v_status := CASE WHEN v_full THEN 'Diterima Lengkap' ELSE 'Sebagian Diterima' END;

  UPDATE purchase_orders SET status = v_status, updated_at = now() WHERE id = p_po_id;

  PERFORM public.write_audit('receive','purchase_orders', p_po_id::text,
    format('Penerimaan barang → %s', v_status), v_po.po_number,
    NULL, jsonb_build_object('status',v_status,'lines',p_lines));

  RETURN jsonb_build_object('ok',true,'status',v_status);
END $$;

-- ══════════════════════════════════════════════════════════════
-- 1.4  PENYELESAIAN STOCK OPNAME — satu transaksi utuh
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.finish_opname(
  p_opname_id bigint, p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := public.current_app_role();
  v_name text := public.current_app_name();
  v_op   record;
  v_line jsonb;
  v_oi   record;
  v_item record;
  v_phys numeric;
  v_diff numeric;
  v_val  numeric;
  v_total numeric := 0;
  v_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Harus login'; END IF;
  IF v_role NOT IN ('spv','manager','direktur','super_admin','operasional') THEN
    RAISE EXCEPTION 'Peran % tidak berwenang menyelesaikan opname', v_role;
  END IF;

  SELECT * INTO v_op FROM stock_opname WHERE id = p_opname_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesi opname tidak ditemukan'; END IF;
  IF v_op.status = 'Selesai' THEN RAISE EXCEPTION 'Sesi opname sudah selesai'; END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) LOOP
    SELECT * INTO v_oi FROM stock_opname_items
      WHERE id = (v_line->>'opname_item_id')::bigint FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_phys := coalesce((v_line->>'physical_qty')::numeric, v_oi.system_qty);
    v_diff := v_phys - coalesce(v_oi.system_qty,0);
    v_val  := v_diff * coalesce(v_oi.unit_price,0);

    UPDATE stock_opname_items
      SET physical_qty = v_phys, selisih = v_diff, selisih_value = v_val
      WHERE id = v_oi.id;

    v_count := v_count + 1;
    v_total := v_total + v_val;

    IF v_diff <> 0 AND v_oi.item_id IS NOT NULL THEN
      SELECT * INTO v_item FROM inventory_items WHERE id = v_oi.item_id FOR UPDATE;
      IF FOUND THEN
        UPDATE inventory_items SET stock_qty = v_phys, updated_at = now() WHERE id = v_item.id;
        INSERT INTO stock_ledger(item_id, item_code, item_name, movement_type, qty, balance_after,
                                 unit_price, ref_type, ref_id, ref_number, notes, created_by, created_at)
        VALUES (v_item.id, v_item.item_code, v_item.item_name, 'ADJUST', v_diff, v_phys,
                coalesce(v_item.unit_price,0), 'opname', p_opname_id, v_op.opname_number,
                'Hasil Stock Opname', v_name, now());
      END IF;
    END IF;
  END LOOP;

  UPDATE stock_opname
    SET status='Selesai', total_items_checked=v_count, total_selisih_value=v_total
    WHERE id = p_opname_id;

  PERFORM public.write_audit('opname','stock_opname', p_opname_id::text,
    format('Opname selesai: %s item, selisih nilai %s', v_count, v_total),
    v_op.opname_number, NULL,
    jsonb_build_object('items',v_count,'selisih_value',v_total));

  RETURN jsonb_build_object('ok',true,'items',v_count,'selisih_value',v_total);
END $$;

-- ── Hak pakai: hanya pengguna yang sudah login ─────────────────
-- PENTING: fungsi penolong ikut ditutup. Bila terlewat, anon dapat memanggil
-- write_audit (SECURITY DEFINER, menulis ke activity_logs) dan memalsukan
-- jejak audit — terbukti pada pengujian pertama. Lihat supabase_fase1_rpc_fix.sql.
REVOKE ALL ON FUNCTION public.write_audit(text,text,text,text,text,jsonb,jsonb)
  FROM public, anon, authenticated;   -- internal saja
REVOKE ALL ON FUNCTION public.current_app_role() FROM public, anon;
REVOKE ALL ON FUNCTION public.current_app_name() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_name() TO authenticated;

REVOKE ALL ON FUNCTION public.approve_pr(bigint,text,text)        FROM public, anon;
REVOKE ALL ON FUNCTION public.reject_pr(bigint,text,text)         FROM public, anon;
REVOKE ALL ON FUNCTION public.adjust_stock(bigint,numeric,text)   FROM public, anon;
REVOKE ALL ON FUNCTION public.post_goods_issue(text,text,date,text,jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.receive_po(bigint,jsonb)            FROM public, anon;
REVOKE ALL ON FUNCTION public.finish_opname(bigint,jsonb)         FROM public, anon;

GRANT EXECUTE ON FUNCTION public.approve_pr(bigint,text,text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pr(bigint,text,text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(bigint,numeric,text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_goods_issue(text,text,date,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_po(bigint,jsonb)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_opname(bigint,jsonb)         TO authenticated;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT p.proname AS fungsi,
       pg_get_function_identity_arguments(p.oid) AS argumen,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('approve_pr','reject_pr','adjust_stock',
                    'post_goods_issue','receive_po','finish_opname',
                    'current_app_role','current_app_name','write_audit')
ORDER BY p.proname;
