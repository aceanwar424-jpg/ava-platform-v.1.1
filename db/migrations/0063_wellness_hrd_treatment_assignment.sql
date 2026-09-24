-- OWNED_BY: generic. HRD Treatment Assignment System for Corporate Wellness Programs.
-- Migration 0063: wellness_treatment_requests table + HRD participant tier list + assignment RPCs.

-- ============================================================
-- TABLE: wellness_treatment_requests
-- Stores HRD assignments of additional treatment to participants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wellness_treatment_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  program_id      uuid NOT NULL REFERENCES public.wellness_programs(id) ON DELETE CASCADE,
  enrollment_id   uuid NOT NULL REFERENCES public.wellness_enrollments(id) ON DELETE CASCADE,
  corporate_id    bigint NOT NULL REFERENCES public.corporates(id),
  requested_by    uuid NOT NULL,                 -- HRD user_id
  risk_tier       smallint NOT NULL CHECK (risk_tier BETWEEN 1 AND 4),
  treatment_type  text NOT NULL,                 -- e.g. 'konsultasi_dokter','program_diet','program_olahraga','followup_ihc','psikologis'
  treatment_label text NOT NULL,
  notes           text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')),
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wellness_treatment_req_program ON public.wellness_treatment_requests(program_id);
CREATE INDEX IF NOT EXISTS idx_wellness_treatment_req_enrollment ON public.wellness_treatment_requests(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_wellness_treatment_req_tenant ON public.wellness_treatment_requests(tenant_id);

-- ============================================================
-- FUNCTION: wellness_hrd_participant_tier_list
-- Returns per-tier participant roster for HRD (corporate-scoped)
-- Each row: enrollment_id, employee_id, name, tier, last BP, last glucose
-- Privacy note: HRD sees their own employees by employment relationship
-- ============================================================
CREATE OR REPLACE FUNCTION public.wellness_hrd_participant_tier_list(
  p_program_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_tenant   uuid;
  v_corporate bigint;
BEGIN
  v_uid     := public.wellness_require_user();
  v_tenant  := public.wellness_actor_tenant();

  -- Only corporate (HRD) role can call this
  IF NOT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = v_uid AND lower(COALESCE(role,'')) = 'corporate'
  ) THEN
    RAISE EXCEPTION 'Akses daftar peserta diperlukan. Hanya HRD perusahaan yang dapat melihat daftar ini.';
  END IF;

  SELECT corporate_id INTO v_corporate FROM public.user_profiles WHERE id = v_uid;
  IF v_corporate IS NULL THEN
    RAISE EXCEPTION 'Akun belum ditautkan ke perusahaan.';
  END IF;

  RETURN jsonb_build_object(
    'corporate_id', v_corporate,
    'tiers', COALESCE((
      WITH latest_obs AS (
        SELECT DISTINCT ON (o.enrollment_id, o.code)
          o.enrollment_id, o.code, o.value, o.measured_at
        FROM public.wellness_observations o
        JOIN public.wellness_enrollments e ON e.id = o.enrollment_id
        JOIN public.wellness_programs p ON p.id = e.program_id
        WHERE p.tenant_id = v_tenant AND p.corporate_id = v_corporate
          AND (p_program_id IS NULL OR p.id = p_program_id)
        ORDER BY o.enrollment_id, o.code, o.measured_at DESC
      ),
      participant_scores AS (
        SELECT
          e.id                AS enrollment_id,
          e.program_id,
          emp.id              AS employee_id_int,
          emp.employee_id     AS employee_code,
          emp.email           AS employee_email,
          COALESCE(emp.full_name, split_part(emp.email,'@',1)) AS participant_name,
          max(CASE WHEN lo.code = 'blood_pressure_systolic'  THEN lo.value END) AS sys,
          max(CASE WHEN lo.code = 'blood_pressure_diastolic' THEN lo.value END) AS dia,
          max(CASE WHEN lo.code = 'blood_glucose'            THEN lo.value END) AS glu,
          max(CASE WHEN lo.code = 'blood_pressure_systolic'  THEN lo.measured_at END) AS bp_at,
          max(CASE WHEN lo.code = 'blood_glucose'            THEN lo.measured_at END) AS glu_at
        FROM public.wellness_enrollments e
        JOIN public.corporate_employees emp ON emp.id = e.corporate_employee_id
        JOIN public.wellness_programs p ON p.id = e.program_id
        LEFT JOIN latest_obs lo ON lo.enrollment_id = e.id
        WHERE p.tenant_id = v_tenant AND p.corporate_id = v_corporate
          AND (p_program_id IS NULL OR p.id = p_program_id)
          AND e.status <> 'withdrawn'
        GROUP BY e.id, e.program_id, emp.id, emp.employee_id, emp.email, emp.full_name
      ),
      participant_tiers AS (
        SELECT *,
          CASE
            WHEN sys IS NULL AND dia IS NULL AND glu IS NULL THEN 0  -- unscreened
            WHEN sys >= 160 OR dia >= 100 OR glu >= 200 THEN 4
            WHEN sys >= 140 OR dia >= 90  OR glu >= 126 THEN 3
            WHEN sys >= 120 OR dia >= 80  OR glu >= 100 THEN 2
            ELSE 1
          END AS risk_tier
        FROM participant_scores
      ),
      pending_treatments AS (
        SELECT enrollment_id,
          count(*) FILTER (WHERE status IN ('pending','accepted','in_progress'))::integer AS active_requests
        FROM public.wellness_treatment_requests
        WHERE tenant_id = v_tenant AND corporate_id = v_corporate
        GROUP BY enrollment_id
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'enrollment_id',   pt.enrollment_id,
          'program_id',      pt.program_id,
          'employee_code',   pt.employee_code,
          'participant_name',pt.participant_name,
          'risk_tier',       pt.risk_tier,
          'sys',             pt.sys,
          'dia',             pt.dia,
          'glu',             pt.glu,
          'bp_at',           pt.bp_at,
          'glu_at',          pt.glu_at,
          'active_treatment_requests', COALESCE(trq.active_requests, 0)
        ) ORDER BY pt.risk_tier DESC, pt.participant_name
      )
      FROM participant_tiers pt
      LEFT JOIN pending_treatments trq ON trq.enrollment_id = pt.enrollment_id
    ), '[]'::jsonb),
    'treatment_requests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',             tr.id,
        'enrollment_id',  tr.enrollment_id,
        'risk_tier',      tr.risk_tier,
        'treatment_type', tr.treatment_type,
        'treatment_label',tr.treatment_label,
        'notes',          tr.notes,
        'status',         tr.status,
        'scheduled_at',   tr.scheduled_at,
        'created_at',     tr.created_at
      ) ORDER BY tr.created_at DESC)
      FROM public.wellness_treatment_requests tr
      WHERE tr.tenant_id = v_tenant AND tr.corporate_id = v_corporate
        AND (p_program_id IS NULL OR tr.program_id = p_program_id)
      LIMIT 100
    ), '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- FUNCTION: wellness_hrd_assign_treatment
-- HRD submits treatment assignment for selected enrollments
-- ============================================================
CREATE OR REPLACE FUNCTION public.wellness_hrd_assign_treatment(
  p_program_id     uuid,
  p_enrollment_ids uuid[],
  p_treatment_type text,
  p_treatment_label text,
  p_notes          text DEFAULT NULL,
  p_scheduled_at   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        uuid;
  v_tenant     uuid;
  v_corporate  bigint;
  v_eid        uuid;
  v_tier       smallint;
  v_inserted   integer := 0;
BEGIN
  v_uid     := public.wellness_require_user();
  v_tenant  := public.wellness_actor_tenant();

  IF NOT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = v_uid AND lower(COALESCE(role,'')) = 'corporate'
  ) THEN
    RAISE EXCEPTION 'Hanya HRD perusahaan yang dapat membuat permintaan treatment.';
  END IF;

  SELECT corporate_id INTO v_corporate FROM public.user_profiles WHERE id = v_uid;
  IF v_corporate IS NULL THEN RAISE EXCEPTION 'Akun belum ditautkan ke perusahaan.'; END IF;

  IF p_treatment_type IS NULL OR trim(p_treatment_type) = '' THEN
    RAISE EXCEPTION 'Jenis treatment harus dipilih.';
  END IF;
  IF array_length(p_enrollment_ids, 1) IS NULL OR array_length(p_enrollment_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal 1 peserta untuk di-assign.';
  END IF;

  FOREACH v_eid IN ARRAY p_enrollment_ids LOOP
    -- Verify enrollment belongs to this corporate
    IF NOT EXISTS(
      SELECT 1 FROM public.wellness_enrollments e
      JOIN public.wellness_programs p ON p.id = e.program_id
      WHERE e.id = v_eid AND p.tenant_id = v_tenant AND p.corporate_id = v_corporate AND p.id = p_program_id
    ) THEN
      RAISE EXCEPTION 'Enrollment % tidak ditemukan atau tidak berhak diakses.', v_eid;
    END IF;

    -- Compute current risk tier for the enrollment
    SELECT CASE
      WHEN max(CASE WHEN o.code='blood_pressure_systolic' THEN o.value END) >= 160
        OR max(CASE WHEN o.code='blood_pressure_diastolic' THEN o.value END) >= 100
        OR max(CASE WHEN o.code='blood_glucose' THEN o.value END) >= 200 THEN 4
      WHEN max(CASE WHEN o.code='blood_pressure_systolic' THEN o.value END) >= 140
        OR max(CASE WHEN o.code='blood_pressure_diastolic' THEN o.value END) >= 90
        OR max(CASE WHEN o.code='blood_glucose' THEN o.value END) >= 126 THEN 3
      WHEN max(CASE WHEN o.code='blood_pressure_systolic' THEN o.value END) >= 120
        OR max(CASE WHEN o.code='blood_pressure_diastolic' THEN o.value END) >= 80
        OR max(CASE WHEN o.code='blood_glucose' THEN o.value END) >= 100 THEN 2
      ELSE 1
    END INTO v_tier
    FROM public.wellness_observations o
    WHERE o.enrollment_id = v_eid;

    INSERT INTO public.wellness_treatment_requests(
      tenant_id, program_id, enrollment_id, corporate_id,
      requested_by, risk_tier, treatment_type, treatment_label, notes, scheduled_at
    ) VALUES (
      v_tenant, p_program_id, v_eid, v_corporate,
      v_uid, COALESCE(v_tier,1), p_treatment_type, p_treatment_label, p_notes, p_scheduled_at
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  -- Audit log
  INSERT INTO public.wellness_audit_events(tenant_id, program_id, actor_user_id, action, entity_type, detail)
  VALUES(v_tenant, p_program_id, v_uid, 'HRD_ASSIGN_TREATMENT', 'treatment_request',
    jsonb_build_object('treatment_type', p_treatment_type, 'enrolled_count', v_inserted, 'enrollment_ids', p_enrollment_ids));

  RETURN jsonb_build_object('ok', true, 'assigned_count', v_inserted, 'treatment_type', p_treatment_type);
END;
$$;

-- ============================================================
-- GRANT permissions
-- ============================================================
REVOKE ALL ON TABLE public.wellness_treatment_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.wellness_treatment_requests TO service_role;

REVOKE ALL ON FUNCTION public.wellness_hrd_participant_tier_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wellness_hrd_assign_treatment(uuid, uuid[], text, text, text, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wellness_hrd_participant_tier_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wellness_hrd_assign_treatment(uuid, uuid[], text, text, text, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.wellness_hrd_participant_tier_list(uuid) IS
  'Returns per-tier participant roster for HRD. Shows employee name + current risk tier based on latest observation. Corporate-scoped.';
COMMENT ON FUNCTION public.wellness_hrd_assign_treatment(uuid, uuid[], text, text, text, timestamptz) IS
  'HRD assigns additional wellness treatment to selected participants. Validates corporate ownership. Audited.';
