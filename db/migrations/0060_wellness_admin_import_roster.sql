-- Migration 0060: Direct Wellness Roster CSV Import in Apps Pengelola
-- OWNED_BY: ava

CREATE OR REPLACE FUNCTION public.wellness_admin_import_roster(p_program_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid;
  v_program record;
  rec record;
  v_count integer := 0;
  v_full text;
  v_emp_code text;
BEGIN
  v_uid := public.wellness_require_user();
  v_tenant := public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN
    RAISE EXCEPTION 'Akses admin wellness diperlukan.';
  END IF;

  SELECT * INTO v_program FROM public.wellness_programs WHERE id = p_program_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program tidak ditemukan.';
  END IF;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    employee_id text, nik text, first_name text, last_name text, email text, department text, job_position text
  )
  LOOP
    IF rec.email IS NOT NULL AND btrim(rec.email) <> '' THEN
      v_full := btrim(COALESCE(rec.first_name,'') || ' ' || COALESCE(rec.last_name,''));
      IF v_full = '' THEN v_full := rec.email; END IF;
      v_emp_code := COALESCE(NULLIF(btrim(rec.employee_id),''), NULLIF(btrim(rec.nik),''), 'EMP-' || substr(gen_random_uuid()::text,1,8));

      INSERT INTO public.corporate_employees (corporate_id, employee_id, nik, full_name, email, department, job_position, status)
      VALUES (
        v_program.corporate_id,
        v_emp_code,
        COALESCE(NULLIF(btrim(rec.nik),''), v_emp_code),
        v_full,
        lower(btrim(rec.email)),
        rec.department,
        rec.job_position,
        'Aktif'
      )
      ON CONFLICT DO NOTHING;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  PERFORM public.wellness_admin_enroll_roster(p_program_id);

  RETURN jsonb_build_object('ok', true, 'imported_rows', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.wellness_admin_import_roster(uuid, jsonb) TO authenticated;
