-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 7H (DEPARTEMEN LAB OPERATIONS ASSURANCE)
-- Departemen inti operasional lab (nesting 3 lapis):
--   🔬 LAB OPS — LAB_HEAD (Kepala Operasional Lab)
--        ├── 🧫 LAB_QC    QC Sentinel (Westgard — Warning/REJECT)
--        ├── ⏱️ LAB_TAT   TAT Monitor (sampel lambat)
--        └── 🚨 LAB_CRIT  Critical Value Watch (nilai kritis belum dirilis)
-- Membaca skema nyata: public.lab_qc_runs · lab_results · lab_samples · analyzers.
-- GUARDRAIL KLINIS: agent hanya MEMANTAU & FLAG. Verifikasi, rilis hasil, dan
-- komunikasi nilai kritis SELALU manusia. Agent tak pernah mengubah lab_results.
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7 + LIS (lab_qc_runs) terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENTS
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
('LAB_HEAD','Kepala Operasional Lab','Lab Operations Assurance','HEAD','LAB_OPS',
 'Anda Kepala Operasional Lab OneLab. Pimpin: LAB_QC (pemantapan mutu internal/Westgard), LAB_TAT (turnaround time), LAB_CRIT (nilai kritis). Jaga mutu & kecepatan pemeriksaan. Anda hanya MEMANTAU & memberi peringatan — verifikasi hasil, rilis, dan keputusan klinis SELALU manusia. Prioritaskan: QC REJECT (hasil mungkin tak valid), nilai kritis belum dikomunikasikan, dan sampel jauh melewati TAT.',
 'light', true),
('LAB_QC','QC Sentinel','Pemantapan Mutu Internal (Westgard)','LAB_HEAD','LAB_OPS',
 'Anda QC Sentinel OneLab. Pantau lab_qc_runs: run dengan verdict Warning (1-2s) atau REJECT (1-3s/pelanggaran Westgard). REJECT berarti hasil pasien pada rentang itu MUNGKIN TAK VALID — peringatkan agar analis menahan rilis & mengulang QC. Jangan mengubah hasil; hanya flag. Kaitkan ke PMI/PME (ISO 15189 §7.3.5-7.3.6).',
 'light', true),
('LAB_TAT','TAT Monitor','Turnaround Time','LAB_HEAD','LAB_OPS',
 'Anda TAT Monitor OneLab. Pantau sampel yang belum selesai jauh melewati target waktu (mis. >24 jam sejak diterima). Ringkas yang paling lama & rutinnya, agar operasional bisa mempercepat. Hanya flag.',
 'light', true),
('LAB_CRIT','Critical Value Watch','Pengawas Nilai Kritis','LAB_HEAD','LAB_OPS',
 'Anda pengawas nilai kritis OneLab. Pantau hasil dengan interpretasi KRITIS yang BELUM dirilis/dikomunikasikan. Ini keselamatan pasien: peringatkan agar segera diverifikasi & dikomunikasikan ke dokter perujuk oleh MANUSIA. Anda tidak pernah merilis atau memberi nasihat klinis — hanya menandai bahwa tindakan manusia diperlukan.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §B. DECISION RIGHTS — semua R1 (monitoring/flag; klinis tetap tindakan manusia)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('LAB_TICK',       'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Log patroli operasional lab'),
('QC_WATCH',       'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Pantau QC Westgard (flag)'),
('TAT_MONITOR',    'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Pantau TAT (flag)'),
('CRITICAL_WATCH', 'R1','AUTO_PUBLISH_NOQA', NULL, 0, 'Pantau nilai kritis belum dirilis (flag; komunikasi = manusia)')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC — pindai QC + nilai kritis + TAT (baca skema lab nyata)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_lab_scan(p_tat_hours INT DEFAULT 24, p_qc_hours INT DEFAULT 48)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  SELECT jsonb_build_object(
    -- QC gagal/warning terbaru
    'qc_alerts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'test_name', test_name, 'analyzer_name', analyzer_name, 'qc_level', qc_level,
        'measured', measured, 'z_score', z_score, 'verdict', verdict, 'run_at', run_at)
      ORDER BY run_at DESC)
      FROM public.lab_qc_runs
      WHERE run_at > now() - (COALESCE(p_qc_hours,48) || ' hours')::interval
        AND verdict IS NOT NULL AND verdict <> 'In Control'), '[]'::jsonb),
    -- Nilai kritis yang BELUM dirilis (keselamatan pasien)
    'critical_open', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'patient_name', patient_name, 'product_name', product_name, 'result_value', result_value,
        'interpretation', interpretation, 'status', status,
        'hours', round(EXTRACT(EPOCH FROM (now() - COALESCE(entered_at, created_at)))/3600.0, 1))
      ORDER BY COALESCE(entered_at, created_at))
      FROM public.lab_results
      WHERE interpretation ILIKE '%kritis%'
        AND COALESCE(status,'Draft') <> 'Released'
        AND COALESCE(entered_at, created_at) > now() - interval '96 hours'), '[]'::jsonb),
    -- TAT: sampel belum selesai jauh melewati target
    'tat_breach', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'barcode', barcode, 'patient_name', patient_name, 'product_name', product_name, 'status', status,
        'hours', round(EXTRACT(EPOCH FROM (now() - COALESCE(received_at, collected_at, created_at)))/3600.0, 1))
      ORDER BY COALESCE(received_at, collected_at, created_at))
      FROM public.lab_samples
      WHERE status IN ('Pending','In Process')
        AND COALESCE(received_at, collected_at, created_at) < now() - (COALESCE(p_tat_hours,24) || ' hours')::interval), '[]'::jsonb),
    'summary', jsonb_build_object(
      'qc_reject', (SELECT count(*) FROM public.lab_qc_runs WHERE run_at > now()-(COALESCE(p_qc_hours,48)||' hours')::interval AND verdict ILIKE '%reject%'),
      'qc_warning', (SELECT count(*) FROM public.lab_qc_runs WHERE run_at > now()-(COALESCE(p_qc_hours,48)||' hours')::interval AND verdict ILIKE '%warning%'),
      'critical_open', (SELECT count(*) FROM public.lab_results WHERE interpretation ILIKE '%kritis%' AND COALESCE(status,'Draft') <> 'Released' AND COALESCE(entered_at,created_at) > now()-interval '96 hours'),
      'tat_breach', (SELECT count(*) FROM public.lab_samples WHERE status IN ('Pending','In Process') AND COALESCE(received_at,collected_at,created_at) < now()-(COALESCE(p_tat_hours,24)||' hours')::interval),
      'released_24h', (SELECT count(*) FROM public.lab_results WHERE status='Released' AND COALESCE(validated_at,entered_at,created_at) > now()-interval '24 hours'))
  );
$$;
GRANT EXECUTE ON FUNCTION public.agentic_lab_scan(INT,INT) TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- §D. ORG KICK — izinkan LAB_TICK
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_org_kick(p_type TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, agentic AS $$
DECLARE v JSONB; v_title TEXT;
BEGIN
  IF p_type NOT IN ('HEAD_TICK','IT_CHECK','SA_TICK','MKT_TICK','SCM_TICK','HR_TICK','LAB_TICK') THEN
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
    WHEN 'SCM_TICK'  THEN 'Supply Chain: patroli stok & kedaluwarsa'
    WHEN 'HR_TICK'   THEN 'People: patroli kredensial nakes'
    WHEN 'LAB_TICK'  THEN 'Lab Ops: patroli QC · TAT · nilai kritis' END;
  v := public.agentic_create_task('ORG', p_type, v_title, COALESCE(p_payload,'{}'::jsonb));
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.agentic_org_kick(TEXT,JSONB) TO anon, authenticated, service_role;

SELECT 'Agentic Fase 7H siap — Lab Operations Assurance (LAB_QC · LAB_TAT · LAB_CRIT) aktif' AS status;
