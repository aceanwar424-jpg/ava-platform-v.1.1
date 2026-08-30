-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 8A (HORIZON 1: PREDICTIVE INTELLIGENCE)
-- Mengubah organ dari REAKTIF → PREDIKTIF. Departemen INSIGHT:
--   🔮 INSIGHT — INSIGHT_HEAD → INSIGHT_STOCK · INSIGHT_DEMAND · INSIGHT_RISK
-- Proyeksi dari data nyata:
--   • Stockout: stok / laju pakai → hari-menuju-habis vs lead time (akan habis
--     sebelum pesanan tiba?)  — inventory_items (avg_monthly_usage, lead_time_days)
--   • Demand/Revenue: tren kunjungan & pendapatan  — admissions (visit_date, net_amount)
--   • Collection risk: piutang berisiko tak tertagih  — invoices
-- GUARDRAIL: proyeksi = ADVISORY (R1). Keputusan (beli, tagih) tetap manusia.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + modul inventory/admissions/finance. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
('INSIGHT_HEAD','Kepala Predictive Intelligence','Analitik Prediktif','HEAD','INSIGHT',
 'Anda Kepala Predictive Intelligence OneLab. Pimpin: INSIGHT_STOCK (prediksi kehabisan stok), INSIGHT_DEMAND (tren permintaan & pendapatan), INSIGHT_RISK (risiko penagihan). Ubah pemantauan reaktif jadi PROYEKSI ke depan agar tim bertindak lebih dini. Semua ADVISORY — keputusan (pembelian, penagihan, kapasitas) tetap manusia. Jangan mengarang angka; nyatakan asumsi proyeksi.',
 'light', true),
('INSIGHT_STOCK','Prediksi Stok','Peramalan Kehabisan Stok','INSIGHT_HEAD','INSIGHT',
 'Anda peramal stok OneLab. Dari stok saat ini & laju pemakaian, hitung perkiraan HARI MENUJU HABIS dan bandingkan dengan lead time pengadaan. Sorot item yang akan habis SEBELUM pesanan tiba (butuh pesan sekarang). Nyatakan asumsi (laju rata-rata). Hanya proyeksi.',
 'light', true),
('INSIGHT_DEMAND','Tren Permintaan','Peramalan Kunjungan & Pendapatan','INSIGHT_HEAD','INSIGHT',
 'Anda analis tren OneLab. Bandingkan kunjungan & pendapatan periode terakhir vs sebelumnya, tunjukkan arah tren (naik/turun) dan besarannya. Beri konteks singkat untuk perencanaan kapasitas/kampanye. Hanya proyeksi berbasis data historis.',
 'light', true),
('INSIGHT_RISK','Risiko Penagihan','Peramalan Piutang Berisiko','INSIGHT_HEAD','INSIGHT',
 'Anda analis risiko penagihan OneLab. Perkirakan piutang yang berisiko tidak tertagih (makin tua makin berisiko) dan sorot yang paling perlu tindakan. Hanya proyeksi; penagihan & write-off oleh manusia.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §B. DECISION RIGHTS — R1 advisory
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('INSIGHT_TICK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Log patroli prediktif'),
('FORECAST_STOCKOUT','R1','AUTO_PUBLISH_NOQA',NULL,0,'Prediksi kehabisan stok (flag)'),
('FORECAST_DEMAND','R1','AUTO_PUBLISH_NOQA',NULL,0,'Tren permintaan & pendapatan'),
('COLLECTION_RISK','R1','AUTO_PUBLISH_NOQA',NULL,0,'Risiko penagihan piutang')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC — proyeksi (baca inventory_items, admissions, invoices)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_insight_scan()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  WITH stk AS (
    SELECT item_name, item_code, stock_qty, avg_monthly_usage, COALESCE(lead_time_days,7) AS lead_time_days,
           CASE WHEN COALESCE(avg_monthly_usage,0) > 0
                THEN round(COALESCE(stock_qty,0) / (avg_monthly_usage/30.0), 1) END AS days_to_stockout
    FROM public.inventory_items
    WHERE COALESCE(is_active,true) AND COALESCE(avg_monthly_usage,0) > 0
  )
  SELECT jsonb_build_object(
    -- Akan habis sebelum/sekitar pesanan tiba (days_to_stockout <= lead_time + 7)
    'stockout_soon', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'item_name', item_name, 'stock_qty', stock_qty, 'avg_monthly_usage', avg_monthly_usage,
        'days_to_stockout', days_to_stockout, 'lead_time_days', lead_time_days,
        'urgent', (days_to_stockout <= lead_time_days)) ORDER BY days_to_stockout)
      FROM stk WHERE days_to_stockout IS NOT NULL AND days_to_stockout <= lead_time_days + 7), '[]'::jsonb),
    'demand', jsonb_build_object(
      'visits_7d',      (SELECT count(*) FROM public.admissions WHERE visit_date >= CURRENT_DATE - 7),
      'visits_prev_7d', (SELECT count(*) FROM public.admissions WHERE visit_date >= CURRENT_DATE - 14 AND visit_date < CURRENT_DATE - 7),
      'visits_30d',     (SELECT count(*) FROM public.admissions WHERE visit_date >= CURRENT_DATE - 30),
      'revenue_30d',    (SELECT COALESCE(sum(net_amount),0) FROM public.admissions WHERE visit_date >= CURRENT_DATE - 30),
      'revenue_prev_30d',(SELECT COALESCE(sum(net_amount),0) FROM public.admissions WHERE visit_date >= CURRENT_DATE - 60 AND visit_date < CURRENT_DATE - 30)),
    'ar_risk', jsonb_build_object(
      'at_risk_amount', (SELECT COALESCE(sum(total_amount),0) FROM public.invoices WHERE paid_at IS NULL AND COALESCE(status,'') NOT IN ('Paid','Lunas','Cancelled','Void','Batal') AND due_date < CURRENT_DATE - 60),
      'at_risk_count',  (SELECT count(*) FROM public.invoices WHERE paid_at IS NULL AND COALESCE(status,'') NOT IN ('Paid','Lunas','Cancelled','Void','Batal') AND due_date < CURRENT_DATE - 60),
      'overdue_amount', (SELECT COALESCE(sum(total_amount),0) FROM public.invoices WHERE paid_at IS NULL AND COALESCE(status,'') NOT IN ('Paid','Lunas','Cancelled','Void','Batal') AND due_date < CURRENT_DATE)),
    'summary', jsonb_build_object(
      'stockout_soon', (SELECT count(*) FROM stk WHERE days_to_stockout IS NOT NULL AND days_to_stockout <= lead_time_days + 7),
      'stockout_urgent', (SELECT count(*) FROM stk WHERE days_to_stockout IS NOT NULL AND days_to_stockout <= lead_time_days))
  );
$$;
GRANT EXECUTE ON FUNCTION public.agentic_insight_scan() TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §D. ORG KICK — izinkan INSIGHT_TICK
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK','SCM_TICK','HR_TICK','LAB_TICK','FIN_TICK','GROWTH_TICK','CX_TICK','EXEC_DIGEST','PHARMA_TICK','WARD_TICK','INSIGHT_TICK') THEN
    RAISE EXCEPTION 'Tipe organ tidak dikenal: %', p_type;
  END IF;
  IF EXISTS (SELECT 1 FROM agentic.tasks WHERE task_type=p_type AND status IN ('QUEUED','PROCESSING')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'masih ada yang antri/berjalan');
  END IF;
  v_title := CASE p_type
    WHEN 'INSIGHT_TICK' THEN 'Predictive: proyeksi stok · permintaan · risiko'
    WHEN 'PHARMA_TICK' THEN 'Farmasi: patroli kedaluwarsa · keselamatan · narkotika'
    WHEN 'WARD_TICK'   THEN 'Rawat Inap: patroli okupansi · LOS · charge'
    WHEN 'HEAD_TICK' THEN 'HEAD: tick organisasi' WHEN 'IT_CHECK' THEN 'Kepala IT: pemeriksaan sistem'
    WHEN 'SA_TICK' THEN 'Service Assurance: patroli mutu & dokumen' WHEN 'MKT_TICK' THEN 'Marketing: patroli konten & kalender'
    WHEN 'SCM_TICK' THEN 'Supply Chain: patroli stok & kedaluwarsa' WHEN 'HR_TICK' THEN 'People: patroli kredensial nakes'
    WHEN 'LAB_TICK' THEN 'Lab Ops: patroli QC · TAT · nilai kritis' WHEN 'FIN_TICK' THEN 'Finance: patroli piutang & kas'
    WHEN 'GROWTH_TICK' THEN 'Growth: patroli prospek & kontrak' WHEN 'CX_TICK' THEN 'CX: patroli keluhan & umpan balik'
    WHEN 'EXEC_DIGEST' THEN 'Executive: digest lintas-domain' ELSE p_type END;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.agentic_org_kick(TEXT,JSONB) TO anon, authenticated, service_role;

SELECT 'Agentic Fase 8A siap — Predictive Intelligence (INSIGHT) aktif' AS status;
