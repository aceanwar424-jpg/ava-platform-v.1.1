-- ══════════════════════════════════════════════════════════════════════
-- OneLab · AGENTIC MODULE — FASE 8D (HORIZON 1: CLINICAL DECISION SUPPORT)
-- Menambah organ LAB_CDS di dalam departemen Lab Operations (reports_to LAB_HEAD):
--   🩺 LAB_CDS — Clinical Decision Support (Data Quality & Delta Check)
-- FUNGSI (khusus KESELAMATAN & MUTU DATA, BUKAN diagnosis):
--   • Delta check — hasil numerik pasien menyimpang jauh dari hasil SEBELUMNYA
--     (kemungkinan salah sampel/entri) → minta verifikasi manusia.
--   • Konsistensi interpretasi — nilai numerik di luar rentang tapi ditandai
--     "Normal" (atau sebaliknya) → kemungkinan salah entri.
-- GUARDRAIL KLINIS MUTLAK: agent TIDAK menafsirkan klinis, TIDAK memutuskan,
--   TIDAK merilis hasil. Hanya MENANDAI untuk diverifikasi DPJP/analis (manusia).
-- ----------------------------------------------------------------------
-- PRASYARAT : Fase 7H (Lab Ops) terpasang. IDEMPOTEN.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- §A. AGENT
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.agents (code, name, role_title, reports_to, department, charter, model_tier, active) VALUES
('LAB_CDS','Clinical Decision Support','Data Quality & Delta Check','LAB_HEAD','LAB_OPS',
 'Anda pendukung keputusan klinis (CDS) OneLab — TAPI perannya SEMPIT & AMAN: hanya menandai (1) hasil numerik yang menyimpang jauh dari hasil pasien SEBELUMNYA (delta check → kemungkinan salah sampel/entri, minta verifikasi), dan (2) inkonsistensi antara nilai numerik vs interpretasi/rentang (kemungkinan salah entri). Anda TIDAK PERNAH menafsirkan makna klinis, memberi diagnosis, menyarankan terapi, atau merilis hasil. Semua temuan Anda adalah untuk DIVERIFIKASI oleh analis/DPJP (manusia). Nyatakan bahwa ini pemeriksaan mutu data, bukan penilaian klinis.',
 'light', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, role_title=EXCLUDED.role_title, reports_to=EXCLUDED.reports_to,
  department=EXCLUDED.department, charter=EXCLUDED.charter, model_tier=EXCLUDED.model_tier, active=true;

-- ══════════════════════════════════════════════════════════════════════
-- §B. DECISION RIGHTS — R1 (monitoring/flag; verifikasi klinis = manusia)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO agentic.decision_rights (task_type, risk_class, auto_action, qa_agent, min_score, note) VALUES
('CDS_REVIEW','R1','AUTO_PUBLISH_NOQA',NULL,0,'CDS: delta check + konsistensi data hasil (flag; verifikasi manusia)')
ON CONFLICT (task_type) DO UPDATE SET
  risk_class=EXCLUDED.risk_class, auto_action=EXCLUDED.auto_action, note=EXCLUDED.note;

-- ══════════════════════════════════════════════════════════════════════
-- §C. RPC — pindai delta & konsistensi (baca public.lab_results)
--   Ambang delta 50% (heuristik generik; bisa disetel per parameter kelak).
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agentic_cds_scan(p_days INT DEFAULT 7, p_delta_pct NUMERIC DEFAULT 0.5)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public, agentic AS $$
  WITH recent AS (
    SELECT r.id, r.patient_name, r.product_id, r.product_name, r.result_numeric,
           r.interpretation, r.normal_min, r.normal_max, r.created_at,
           (SELECT p.result_numeric FROM public.lab_results p
             WHERE p.patient_name = r.patient_name AND p.product_id = r.product_id
               AND p.result_numeric IS NOT NULL AND p.created_at < r.created_at
             ORDER BY p.created_at DESC LIMIT 1) AS prior
    FROM public.lab_results r
    WHERE r.result_numeric IS NOT NULL
      AND r.created_at > now() - (COALESCE(p_days,7) || ' days')::interval
  )
  SELECT jsonb_build_object(
    -- Delta check: menyimpang jauh dari hasil sebelumnya
    'delta', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'patient_name', patient_name, 'product_name', product_name,
        'now', result_numeric, 'prior', prior,
        'change_pct', round(100.0 * (result_numeric - prior) / NULLIF(abs(prior),0), 0)) ORDER BY abs((result_numeric-prior)/NULLIF(abs(prior),0)) DESC)
      FROM recent
      WHERE prior IS NOT NULL AND prior <> 0
        AND abs(result_numeric - prior) / abs(prior) >= COALESCE(p_delta_pct,0.5)), '[]'::jsonb),
    -- Inkonsistensi: numerik di luar rentang tapi ditandai Normal, atau sebaliknya
    'inconsistent', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'patient_name', patient_name, 'product_name', product_name, 'result_numeric', result_numeric,
        'normal_min', normal_min, 'normal_max', normal_max, 'interpretation', interpretation))
      FROM recent
      WHERE normal_min IS NOT NULL AND normal_max IS NOT NULL AND (
        ((result_numeric < normal_min OR result_numeric > normal_max) AND interpretation ILIKE 'normal')
        OR (result_numeric >= normal_min AND result_numeric <= normal_max
            AND (interpretation ILIKE '%tinggi%' OR interpretation ILIKE '%rendah%' OR interpretation ILIKE '%kritis%'))
      )), '[]'::jsonb),
    'summary', jsonb_build_object(
      'delta', (SELECT count(*) FROM recent WHERE prior IS NOT NULL AND prior<>0 AND abs(result_numeric-prior)/abs(prior) >= COALESCE(p_delta_pct,0.5)),
      'inconsistent', (SELECT count(*) FROM recent WHERE normal_min IS NOT NULL AND normal_max IS NOT NULL AND (
        ((result_numeric < normal_min OR result_numeric > normal_max) AND interpretation ILIKE 'normal')
        OR (result_numeric >= normal_min AND result_numeric <= normal_max AND (interpretation ILIKE '%tinggi%' OR interpretation ILIKE '%rendah%' OR interpretation ILIKE '%kritis%')))),
      'checked', (SELECT count(*) FROM recent))
  );
$$;
GRANT EXECUTE ON FUNCTION public.agentic_cds_scan(INT,NUMERIC) TO anon, authenticated, service_role;

SELECT 'Agentic Fase 8D siap — Clinical Decision Support (LAB_CDS, flag mutu data; klinis=manusia)' AS status;
