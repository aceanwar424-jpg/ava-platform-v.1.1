-- OWNED_BY: generic
-- Explicit participant consent gate for longitudinal wellness observations.
-- This migration contains no client identity or real participant data.

CREATE OR REPLACE FUNCTION public.wellness_accept_consent(
  p_program_id uuid,
  p_notice_version text,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid;
  v_enrollment public.wellness_enrollments%ROWTYPE;
  v_notice text;
BEGIN
  v_uid := public.wellness_require_user();
  v_tenant := public.wellness_actor_tenant();
  v_notice := btrim(COALESCE(p_notice_version, ''));

  IF p_accept IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Persetujuan harus diberikan secara eksplisit.';
  END IF;
  IF v_notice !~ '^[A-Za-z0-9._-]{3,80}$' THEN
    RAISE EXCEPTION 'Versi pemberitahuan privasi tidak valid.';
  END IF;

  SELECT e.* INTO v_enrollment
    FROM public.wellness_enrollments e
   WHERE e.tenant_id = v_tenant
     AND e.program_id = p_program_id
     AND e.auth_user_id = v_uid
     AND e.status IN ('invited', 'active', 'paused')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment program tidak ditemukan untuk akun ini.';
  END IF;

  UPDATE public.wellness_enrollments
     SET consent_status = 'granted',
         consented_at = COALESCE(consented_at, now()),
         status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
         activated_at = COALESCE(activated_at, now()),
         updated_at = now()
   WHERE id = v_enrollment.id;

  INSERT INTO public.wellness_audit_events
    (tenant_id, program_id, actor_user_id, action, entity_type, entity_id, detail)
  VALUES
    (v_tenant, p_program_id, v_uid, 'GRANT_CONSENT', 'enrollment', v_enrollment.id::text,
     jsonb_build_object('notice_version', v_notice, 'accepted_at', now()));

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', v_enrollment.id,
    'consent_status', 'granted',
    'notice_version', v_notice
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_enforce_observation_consent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_consent text;
BEGIN
  SELECT e.consent_status INTO v_consent
    FROM public.wellness_enrollments e
   WHERE e.id = NEW.enrollment_id
     AND e.tenant_id = NEW.tenant_id
     AND e.program_id = NEW.program_id
     AND e.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment aktif tidak ditemukan untuk pencatatan wellness.';
  END IF;
  IF COALESCE(v_consent, 'pending') NOT IN ('granted', 'not_required') THEN
    RAISE EXCEPTION 'Persetujuan peserta belum diberikan untuk program ini.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wellness_observation_consent_gate ON public.wellness_observations;
CREATE TRIGGER wellness_observation_consent_gate
  BEFORE INSERT ON public.wellness_observations
  FOR EACH ROW EXECUTE FUNCTION public.wellness_enforce_observation_consent();

CREATE OR REPLACE FUNCTION public.wellness_generate_reminders(p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_count integer:=0;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  INSERT INTO public.wellness_tasks
    (tenant_id,program_id,enrollment_id,reminder_rule_id,due_at,status,audience,payload,created_by)
  SELECT v_tenant,r.program_id,e.id,r.id,
         (current_date + r.send_time) AT TIME ZONE 'Asia/Jakarta','open','participant',
         jsonb_build_object('channel',r.channel,'message',r.message_template,'measurement_type',r.measurement_type),v_uid
    FROM public.wellness_reminder_rules r
    JOIN public.wellness_enrollments e
      ON e.program_id=r.program_id
     AND e.status='active'
     AND e.consent_status IN ('granted','not_required')
   WHERE r.tenant_id=v_tenant AND r.program_id=p_program_id AND r.is_active
     AND NOT EXISTS (
       SELECT 1 FROM public.wellness_observations o
        WHERE o.enrollment_id=e.id AND o.measured_at >= now()-(r.inactivity_days||' days')::interval
          AND (r.measurement_type='any'
            OR (r.measurement_type='blood_pressure' AND o.code='blood_pressure_systolic')
            OR (r.measurement_type='blood_glucose' AND o.code='blood_glucose'))
     )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'tasks_created',v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.wellness_accept_consent(uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wellness_enforce_observation_consent() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wellness_accept_consent(uuid,text,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wellness_enforce_observation_consent() TO service_role;

COMMENT ON FUNCTION public.wellness_accept_consent(uuid,text,boolean)
  IS 'Records explicit participant consent and a versioned privacy notice in the wellness audit trail.';
COMMENT ON FUNCTION public.wellness_enforce_observation_consent()
  IS 'Rejects wellness observations until participant consent or an approved not-required basis is recorded.';
