-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7J (DEPARTEMEN SUPPLY CHAIN)
-- Mengaktifkan LOGISTIK → Departemen Supply Chain (nesting 3 lapis):
--   🚚 SUPPLY CHAIN — LOGISTIK (Kepala Supply Chain)
--        ├── 📦 SCM_STOCK  Stock & FEFO Sentinel (menipis + kedaluwarsa)
--        └── 🧾 SCM_PO     Procurement — draft PO (harga [[KONFIRMASI]])
-- Membaca skema inventory nyata: public.inventory_items · inventory_batches ·
-- suppliers. Task: SCM_TICK · STOCK_WATCH · PO_DRAFT. RPC agentic_scm_scan.
-- GUARDRAIL: agent hanya DRAFT & ALERT — pembelian/PR tetap MANUSIA.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + inventory fase0/fase2 terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENTS — aktifkan LOGISTIK sbg kepala dept + anggota
-- ══════════════════════════════════════════════════════════════════════
UPDATE agentic.agents SET
  name = 'Kepala Supply Chain', role_title = 'Manajer Logistik & Procurement',
  department = 'SUPPLY_CHAIN', reports_to = 'HEAD', active = true, model_tier = 'light',
  charter = 'Anda Kepala Supply Chain OneLab (lab klinik). Pimpin tim: SCM_STOCK (pengawas stok & kedaluwarsa) dan SCM_PO (draft pengadaan). Jaga ketersediaan reagen & BHP agar operasional lab tak berhenti: pantau stok menipis (di bawah reorder point), item kedaluwarsa (FEFO), dan usulkan pengadaan. Anda hanya membuat DRAFT & peringatan — keputusan & transaksi pembelian SELALU manusia. Harga yang tak pasti tandai [[KONFIRMASI]].'
  WHERE code = 'LOGISTIK';

INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
('SCM_STOCK','Stock & FEFO Sentinel','Pengawas Stok & Kedaluwarsa','LOGISTIK','SUPPLY_CHAIN',
 'Anda pengawas stok OneLab. Pantau inventory: item di bawah reorder point / stok minimum, dan batch mendekati/melewati kedaluwarsa (FEFO). Ringkas yang paling kritis lebih dulu (reagen esensial, stok habis, kedaluwarsa ≤30 hari). Jangan mengarang angka — pakai data yang diberikan; harga tak pasti [[KONFIRMASI]].',
 'light', true),
('SCM_PO','Procurement','Draft Purchase Order','LOGISTIK','SUPPLY_CHAIN',
 'Anda staf pengadaan OneLab. Dari daftar item menipis, susun DRAFT usulan pembelian per pemasok: item, jumlah usulan, pemasok, dan estimasi harga (tandai [[KONFIRMASI]] bila tak pasti). Anda TIDAK membuat PR resmi maupun transaksi — hanya draft untuk ditinjau manusia.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §B. DECISION RIGHTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('SCM_TICK',    'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Log patroli supply chain'),
('STOCK_WATCH', 'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Analisis stok & kedaluwarsa internal'),
('PO_DRAFT',    'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Draft usulan pembelian (dikirim ke CEO) — pembelian/PR resmi tetap MANUSIA')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC — pindai stok menipis + FEFO (baca skema inventory nyata)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_scm_scan(p_expiry_days INT DEFAULT 60)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    -- Item menipis: stok ≤ reorder point (atau ≤ min stock bila reorder point 0)
    'low_stock', COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'gap')::numeric DESC) FROM (
      SELECT jsonb_build_object(
        'item_code', i.item_code, 'item_name', i.item_name, 'category', i.category,
        'unit', i.unit, 'stock_qty', i.stock_qty,
        'threshold', GREATEST(COALESCE(i.reorder_point,0), COALESCE(i.min_stock,0)),
        'gap', GREATEST(0, GREATEST(COALESCE(i.reorder_point,0), COALESCE(i.min_stock,0)) - COALESCE(i.stock_qty,0)),
        'suggested_qty', GREATEST(0,
           COALESCE(NULLIF(i.max_stock,0), COALESCE(i.reorder_point,0) + COALESCE(i.safety_stock,0), COALESCE(i.min_stock,0)*2)
           - COALESCE(i.stock_qty,0)),
        'avg_monthly_usage', i.avg_monthly_usage, 'lead_time_days', i.lead_time_days,
        'unit_price', i.unit_price, 'supplier', s.supplier_name
      ) AS row
      FROM public.inventory_items i
      LEFT JOIN public.suppliers s ON s.id = i.supplier_id
      WHERE COALESCE(i.is_active,true)
        AND (
          (COALESCE(i.reorder_point,0) > 0 AND COALESCE(i.stock_qty,0) <= i.reorder_point)
          OR (COALESCE(i.reorder_point,0) = 0 AND COALESCE(i.min_stock,0) > 0 AND COALESCE(i.stock_qty,0) <= i.min_stock)
        )
      LIMIT 100) q), '[]'::jsonb),
    -- FEFO: batch mendekati kedaluwarsa (qty tersisa > 0)
    'expiring', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'item_code', b.item_code, 'batch_no', b.batch_no, 'expiry_date', b.expiry_date,
        'qty_remaining', b.qty_remaining, 'days_left', (b.expiry_date - CURRENT_DATE))
      ORDER BY b.expiry_date)
      FROM public.inventory_batches b
      WHERE COALESCE(b.qty_remaining,0) > 0 AND b.expiry_date IS NOT NULL
        AND b.expiry_date <= CURRENT_DATE + (COALESCE(p_expiry_days,60) || ' days')::interval
        AND b.expiry_date >= CURRENT_DATE), '[]'::jsonb),
    -- Sudah kedaluwarsa tapi masih ada stok (harus ditarik)
    'expired', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'item_code', b.item_code, 'batch_no', b.batch_no, 'expiry_date', b.expiry_date,
        'qty_remaining', b.qty_remaining))
      FROM public.inventory_batches b
      WHERE COALESCE(b.qty_remaining,0) > 0 AND b.expiry_date IS NOT NULL
        AND b.expiry_date < CURRENT_DATE), '[]'::jsonb),
    'summary', jsonb_build_object(
      'low_count', (SELECT count(*) FROM public.inventory_items i WHERE COALESCE(i.is_active,true)
        AND ((COALESCE(i.reorder_point,0) > 0 AND COALESCE(i.stock_qty,0) <= i.reorder_point)
          OR (COALESCE(i.reorder_point,0) = 0 AND COALESCE(i.min_stock,0) > 0 AND COALESCE(i.stock_qty,0) <= i.min_stock))),
      'out_of_stock', (SELECT count(*) FROM public.inventory_items i WHERE COALESCE(i.is_active,true) AND COALESCE(i.stock_qty,0) <= 0),
      'expiring_count', (SELECT count(*) FROM public.inventory_batches b WHERE COALESCE(b.qty_remaining,0) > 0
        AND b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (COALESCE(p_expiry_days,60) || ' days')::interval),
      'expired_count', (SELECT count(*) FROM public.inventory_batches b WHERE COALESCE(b.qty_remaining,0) > 0 AND b.expiry_date < CURRENT_DATE))
  );
$$;
GRANT EXECUTE ON FUNCTION public.agentic_scm_scan(INT) TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §D. ORG KICK — izinkan SCM_TICK
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK','SCM_TICK') THEN
    RAISE EXCEPTION 'Tipe organ tidak dikenal: %', p_type;
  END IF;
  IF EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'masih ada yang antri/berjalan');
  END IF;
  v_title := CASE p_type
    WHEN 'HEAD_TICK' THEN 'HEAD: tick organisasi'
    WHEN 'IT_CHECK'  THEN 'Kepala IT: pemeriksaan sistem'
    WHEN 'SA_TICK'   THEN 'Service Assurance: patroli mutu & dokumen'
    WHEN 'MKT_TICK'  THEN 'Marketing: patroli konten & kalender'
    WHEN 'SCM_TICK'  THEN 'Supply Chain: patroli stok & kedaluwarsa' END;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.agentic_org_kick(TEXT,JSONB) TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §E. PROMPT
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.prompt_templates (code, system_prompt, user_prompt_template, model_hint, temperature) VALUES
('PO_DRAFT',
 E'Anda staf pengadaan OneLab. Dari daftar item menipis (JSON), susun DRAFT usulan pembelian dalam MARKDOWN, DIKELOMPOKKAN per pemasok. Untuk tiap item: nama, jumlah usulan (pakai suggested_qty), satuan, estimasi harga (unit_price bila ada; bila 0/kosong tulis [[KONFIRMASI]]). Tambahkan subtotal per pemasok bila harga tersedia. Akhiri dengan catatan: "Draft — pembelian & PR resmi tetap keputusan manusia." JANGAN mengarang harga atau pemasok yang tak ada di data.',
 E'ITEM MENIPIS (JSON):\n{{items}}\n\nCATATAN: {{notes}}',
 'light', 0.3)
ON CONFLICT (code) DO UPDATE SET
  system_prompt=EXCLUDED.system_prompt, user_prompt_template=EXCLUDED.user_prompt_template,
  model_hint=EXCLUDED.model_hint, temperature=EXCLUDED.temperature, active=true;

SELECT 'Agentic Fase 7J siap — Departemen Supply Chain (SCM_STOCK · SCM_PO) aktif' AS status;
