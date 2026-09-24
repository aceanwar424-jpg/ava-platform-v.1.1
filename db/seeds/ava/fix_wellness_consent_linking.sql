-- SQL Patch: Force Reset Consent Status to 'pending' for UAT Participant Testing
-- Target: Supabase SQL Editor
-- Menyetel ulang consent_status menjadi 'pending' agar Kartu Persetujuan Peserta muncul untuk dites UAT.

-- 1. Tautkan auth_user_id dan setel consent_status = 'pending'
UPDATE public.wellness_enrollments e
SET auth_user_id = u.id,
    consent_status = 'pending',
    status = 'active',
    consented_at = NULL
FROM public.corporate_employees emp
JOIN auth.users u ON lower(u.email) = lower(emp.email)
WHERE e.corporate_employee_id = emp.id;

-- 2. Pastikan fungsi wellness_personal_dashboard adalah VOLATILE dan mengembalikan COALESCE(consent_status, 'pending')
CREATE OR REPLACE FUNCTION public.wellness_personal_dashboard()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_email text;
BEGIN
  v_uid := public.wellness_require_user();
  v_tenant := public.wellness_actor_tenant();

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    UPDATE public.wellness_enrollments e
       SET auth_user_id = v_uid, updated_at = now()
      FROM public.corporate_employees emp
     WHERE emp.id = e.corporate_employee_id
       AND lower(emp.email) = v_email
       AND e.tenant_id = v_tenant
       AND (e.auth_user_id IS NULL OR e.auth_user_id <> v_uid);
  END IF;

  RETURN jsonb_build_object(
    'programs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'code',p.code,'name',p.name,'description',p.description,
        'focus',p.focus,'starts_on',p.starts_on,'ends_on',p.ends_on,'status',p.status,
        'measurement_plan',p.measurement_plan,'reporting_plan',p.reporting_plan,
        'enrollment_id',e.id,'enrollment_status',e.status,'consent_status',COALESCE(e.consent_status,'pending')
      ) ORDER BY p.starts_on DESC)
      FROM public.wellness_enrollments e
      JOIN public.wellness_programs p ON p.id=e.program_id
      WHERE e.tenant_id=v_tenant AND e.auth_user_id=v_uid AND e.status IN ('invited','active','paused')
    ), '[]'::jsonb),
    'observations', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.measured_at DESC)
      FROM (
        SELECT o.id,o.program_id,o.group_id,o.code,o.value,o.unit,o.measurement_context,
               o.measured_at,o.received_at,o.source,o.verification_status,o.device_method,o.note
          FROM public.wellness_observations o
         WHERE o.tenant_id=v_tenant AND o.subject_user_id=v_uid
         ORDER BY o.measured_at DESC LIMIT 250
      ) x
    ), '[]'::jsonb),
    'open_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',t.id,'program_id',t.program_id,'task_type',t.task_type,'due_at',t.due_at,
        'status',t.status,'audience',t.audience,'payload',t.payload
      ) ORDER BY t.due_at)
      FROM public.wellness_tasks t
      JOIN public.wellness_enrollments e ON e.id=t.enrollment_id
      WHERE t.tenant_id=v_tenant AND e.auth_user_id=v_uid AND t.audience='participant' AND t.status IN ('open','sent')
    ), '[]'::jsonb)
  );
END;
$$;

-- 3. Verifikasi Status Enrollment Peserta
SELECT e.id, e.program_id, e.auth_user_id, e.consent_status, emp.email, emp.full_name
FROM public.wellness_enrollments e
JOIN public.corporate_employees emp ON emp.id = e.corporate_employee_id
ORDER BY e.created_at DESC;
