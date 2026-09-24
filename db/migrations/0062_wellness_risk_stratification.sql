-- OWNED_BY: generic. Multi-tenant 4-Level Risk Stratification for HR Corporate Dashboard.

CREATE OR REPLACE FUNCTION public.wellness_corporate_dashboard(
  p_program_id uuid DEFAULT NULL, p_corporate_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_corporate bigint; v_internal boolean;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant(); v_internal:=public.wellness_actor_internal();
  SELECT corporate_id INTO v_corporate FROM public.user_profiles WHERE id=v_uid;
  IF NOT v_internal AND NOT EXISTS(
    SELECT 1 FROM public.user_profiles WHERE id=v_uid AND lower(COALESCE(role,''))='corporate'
  ) THEN RAISE EXCEPTION 'Akses monitoring corporate diperlukan.'; END IF;
  IF v_internal AND p_corporate_id IS NOT NULL THEN v_corporate:=p_corporate_id; END IF;
  IF v_corporate IS NULL THEN RAISE EXCEPTION 'Akun belum ditautkan ke perusahaan.'; END IF;

  RETURN jsonb_build_object(
    'privacy_mode','aggregate_only',
    'small_cell_threshold',5,
    'programs',COALESCE((
      WITH latest_obs AS (
        SELECT DISTINCT ON (enrollment_id, code)
          enrollment_id, code, value, measured_at
        FROM public.wellness_observations
        ORDER BY enrollment_id, code, measured_at DESC
      ),
      part_scores AS (
        SELECT 
          e.id AS enrollment_id,
          e.program_id,
          max(CASE WHEN o.code = 'blood_pressure_systolic' THEN o.value END) AS sys,
          max(CASE WHEN o.code = 'blood_pressure_diastolic' THEN o.value END) AS dia,
          max(CASE WHEN o.code = 'blood_glucose' THEN o.value END) AS glu
        FROM public.wellness_enrollments e
        LEFT JOIN latest_obs o ON o.enrollment_id = e.id
        WHERE e.status <> 'withdrawn'
        GROUP BY e.id, e.program_id
      ),
      part_tiers AS (
        SELECT
          program_id,
          enrollment_id,
          (sys IS NOT NULL OR dia IS NOT NULL OR glu IS NOT NULL) AS is_screened,
          CASE 
            WHEN (sys >= 160 OR dia >= 100 OR glu >= 200) THEN 4
            WHEN (sys >= 140 OR dia >= 90 OR glu >= 126) THEN 3
            WHEN (sys >= 120 OR dia >= 80 OR glu >= 100) THEN 2
            WHEN (sys IS NOT NULL OR dia IS NOT NULL OR glu IS NOT NULL) THEN 1
            ELSE 0
          END AS risk_level
        FROM part_scores
      ),
      prog_risk AS (
        SELECT
          program_id,
          count(*) FILTER (WHERE is_screened)::integer AS screened_count,
          count(*) FILTER (WHERE NOT is_screened)::integer AS unscreened_count,
          count(*) FILTER (WHERE risk_level = 1)::integer AS risk_l1_count,
          count(*) FILTER (WHERE risk_level = 2)::integer AS risk_l2_count,
          count(*) FILTER (WHERE risk_level = 3)::integer AS risk_l3_count,
          count(*) FILTER (WHERE risk_level = 4)::integer AS risk_l4_count
        FROM part_tiers
        GROUP BY program_id
      )
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.starts_on DESC) FROM (
        SELECT p.id,p.code,p.name,p.description,p.focus,p.starts_on,p.ends_on,p.status,
          count(DISTINCT e.id)::integer AS enrolled,
          count(DISTINCT e.auth_user_id) FILTER(WHERE e.auth_user_id IS NOT NULL)::integer AS linked_accounts,
          count(DISTINCT o.enrollment_id) FILTER(WHERE o.measured_at>=now()-interval '7 days')::integer AS active_7d,
          count(o.id) FILTER(WHERE o.measured_at>=now()-interval '30 days')::integer AS measurements_30d,
          count(DISTINCT o.enrollment_id) FILTER(WHERE o.code='blood_pressure_systolic' AND o.measured_at>=now()-interval '30 days')::integer AS bp_coverage_30d,
          count(DISTINCT o.enrollment_id) FILTER(WHERE o.code='blood_glucose' AND o.measured_at>=now()-interval '30 days')::integer AS glucose_coverage_30d,
          CASE WHEN count(DISTINCT o.enrollment_id) FILTER(WHERE o.code='blood_pressure_systolic' AND o.measured_at>=now()-interval '30 days')>=5
            THEN round(avg(o.value) FILTER(WHERE o.code='blood_pressure_systolic' AND o.measured_at>=now()-interval '30 days'),1) END AS avg_systolic_30d,
          CASE WHEN count(DISTINCT o.enrollment_id) FILTER(WHERE o.code='blood_pressure_diastolic' AND o.measured_at>=now()-interval '30 days')>=5
            THEN round(avg(o.value) FILTER(WHERE o.code='blood_pressure_diastolic' AND o.measured_at>=now()-interval '30 days'),1) END AS avg_diastolic_30d,
          CASE WHEN count(DISTINCT o.enrollment_id) FILTER(WHERE o.code='blood_glucose' AND o.measured_at>=now()-interval '30 days')>=5
            THEN round(avg(o.value) FILTER(WHERE o.code='blood_glucose' AND o.measured_at>=now()-interval '30 days'),1) END AS avg_glucose_30d,
          (count(DISTINCT o.enrollment_id) FILTER(WHERE o.measured_at>=now()-interval '30 days')<5) AS small_cell_suppressed,
          COALESCE(r.screened_count, 0) AS screened_count,
          COALESCE(r.unscreened_count, 0) AS unscreened_count,
          COALESCE(r.risk_l1_count, 0) AS risk_l1_count,
          COALESCE(r.risk_l2_count, 0) AS risk_l2_count,
          COALESCE(r.risk_l3_count, 0) AS risk_l3_count,
          COALESCE(r.risk_l4_count, 0) AS risk_l4_count
        FROM public.wellness_programs p
        LEFT JOIN public.wellness_enrollments e ON e.program_id=p.id AND e.status<>'withdrawn'
        LEFT JOIN public.wellness_observations o ON o.enrollment_id=e.id
        LEFT JOIN prog_risk r ON r.program_id=p.id
        WHERE p.tenant_id=v_tenant AND p.corporate_id=v_corporate AND (p_program_id IS NULL OR p.id=p_program_id)
        GROUP BY p.id, r.screened_count, r.unscreened_count, r.risk_l1_count, r.risk_l2_count, r.risk_l3_count, r.risk_l4_count
      ) s
    ),'[]'::jsonb),
    'imports',CASE WHEN v_internal THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',b.id,'program_id',b.program_id,'source_file',b.source_file,'status',b.status,
        'total_rows',b.total_rows,'accepted_rows',b.accepted_rows,'rejected_rows',b.rejected_rows,'created_at',b.created_at) ORDER BY b.created_at DESC)
      FROM public.wellness_import_batches b WHERE b.tenant_id=v_tenant AND b.corporate_id=v_corporate LIMIT 20
    ),'[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wellness_corporate_dashboard(uuid,bigint) TO authenticated;
