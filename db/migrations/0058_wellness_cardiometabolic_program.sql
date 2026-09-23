-- 0058 — Program wellness kardiometabolik generik, multi-tenant, dan auditable
-- OWNED_BY: generic
--
-- MVP tervalidasi oleh proyek corporate: diabetes + hipertensi, hasil IHC,
-- pencatatan mandiri peserta, monitoring agregat HR, dan reminder operasional.
-- Tidak ada nama/ID klien yang ditanam pada skema atau fungsi.

CREATE TABLE IF NOT EXISTS public.wellness_programs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  corporate_id          bigint NOT NULL REFERENCES public.corporates(id),
  code                  text NOT NULL,
  name                  text NOT NULL,
  description           text,
  focus                 text[] NOT NULL DEFAULT ARRAY['diabetes','hypertension']::text[],
  starts_on             date NOT NULL,
  ends_on               date,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','pilot','active','paused','completed')),
  measurement_plan      jsonb NOT NULL DEFAULT '{}'::jsonb,
  reporting_plan        jsonb NOT NULL DEFAULT '{}'::jsonb,
  medical_governance    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wellness_program_dates_ck CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT wellness_program_code_uq UNIQUE (tenant_id, corporate_id, code)
);

CREATE TABLE IF NOT EXISTS public.wellness_enrollments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  program_id            uuid NOT NULL REFERENCES public.wellness_programs(id) ON DELETE CASCADE,
  corporate_id          bigint NOT NULL REFERENCES public.corporates(id),
  corporate_employee_id bigint REFERENCES public.corporate_employees(id),
  auth_user_id          uuid,
  person_id             uuid REFERENCES public.mpi_person(id),
  status                text NOT NULL DEFAULT 'invited'
                          CHECK (status IN ('invited','active','paused','completed','withdrawn')),
  consent_status        text NOT NULL DEFAULT 'pending'
                          CHECK (consent_status IN ('pending','granted','declined','withdrawn','not_required')),
  consented_at          timestamptz,
  activated_at          timestamptz,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wellness_enrollment_subject_ck CHECK (
    corporate_employee_id IS NOT NULL OR auth_user_id IS NOT NULL OR person_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS wellness_enrollment_employee_uq
  ON public.wellness_enrollments(program_id, corporate_employee_id)
  WHERE corporate_employee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wellness_enrollment_user_uq
  ON public.wellness_enrollments(program_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.wellness_import_batches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  program_id            uuid NOT NULL REFERENCES public.wellness_programs(id) ON DELETE CASCADE,
  corporate_id          bigint NOT NULL REFERENCES public.corporates(id),
  source_type           text NOT NULL DEFAULT 'ihc_bulk'
                          CHECK (source_type IN ('ihc_bulk','ihc_api','sftp','manual_admin')),
  source_file           text,
  checksum              text NOT NULL,
  status                text NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing','completed','completed_with_errors','failed')),
  total_rows            integer NOT NULL DEFAULT 0,
  accepted_rows         integer NOT NULL DEFAULT 0,
  rejected_rows         integer NOT NULL DEFAULT 0,
  error_details         jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  CONSTRAINT wellness_import_checksum_uq UNIQUE (tenant_id, program_id, checksum)
);

CREATE TABLE IF NOT EXISTS public.wellness_observations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  program_id            uuid NOT NULL REFERENCES public.wellness_programs(id) ON DELETE CASCADE,
  enrollment_id         uuid NOT NULL REFERENCES public.wellness_enrollments(id) ON DELETE CASCADE,
  corporate_id          bigint NOT NULL REFERENCES public.corporates(id),
  corporate_employee_id bigint REFERENCES public.corporate_employees(id),
  subject_user_id       uuid,
  group_id              uuid NOT NULL DEFAULT gen_random_uuid(),
  code                  text NOT NULL CHECK (code IN (
                          'blood_pressure_systolic','blood_pressure_diastolic','pulse_rate',
                          'blood_glucose','hba1c','body_weight','bmi')),
  value                 numeric NOT NULL,
  unit                  text NOT NULL,
  measurement_context   text,
  measured_at           timestamptz NOT NULL,
  received_at           timestamptz NOT NULL DEFAULT now(),
  source                text NOT NULL CHECK (source IN (
                          'self_reported','ihc_bulk','ihc_api','device','his','lis','manual_admin')),
  verification_status   text NOT NULL DEFAULT 'unverified'
                          CHECK (verification_status IN ('unverified','verified','amended','rejected')),
  device_method         text,
  note                  text,
  import_batch_id       uuid REFERENCES public.wellness_import_batches(id),
  client_record_id      text NOT NULL,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  amended_from_id       uuid REFERENCES public.wellness_observations(id),
  CONSTRAINT wellness_observation_value_ck CHECK (value >= 0),
  CONSTRAINT wellness_observation_idempotency_uq UNIQUE
    (tenant_id, program_id, source, client_record_id, code)
);

CREATE INDEX IF NOT EXISTS wellness_observation_subject_idx
  ON public.wellness_observations(tenant_id, subject_user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS wellness_observation_corporate_idx
  ON public.wellness_observations(tenant_id, corporate_id, program_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS wellness_observation_enrollment_idx
  ON public.wellness_observations(enrollment_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS public.wellness_reminder_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  program_id            uuid NOT NULL REFERENCES public.wellness_programs(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  measurement_type      text NOT NULL CHECK (measurement_type IN ('blood_pressure','blood_glucose','any')),
  inactivity_days       integer NOT NULL DEFAULT 1 CHECK (inactivity_days BETWEEN 1 AND 90),
  channel               text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp','task_only')),
  send_time             time NOT NULL DEFAULT '08:00',
  message_template      text NOT NULL,
  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness_tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  program_id            uuid NOT NULL REFERENCES public.wellness_programs(id) ON DELETE CASCADE,
  enrollment_id         uuid NOT NULL REFERENCES public.wellness_enrollments(id) ON DELETE CASCADE,
  reminder_rule_id      uuid REFERENCES public.wellness_reminder_rules(id) ON DELETE SET NULL,
  task_type             text NOT NULL DEFAULT 'measurement_reminder'
                          CHECK (task_type IN ('measurement_reminder','medical_review','data_quality','follow_up')),
  due_at                timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sent','completed','cancelled','failed')),
  audience              text NOT NULL DEFAULT 'participant' CHECK (audience IN ('participant','ihc','ava_operations')),
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS wellness_task_daily_uq
  ON public.wellness_tasks(reminder_rule_id, enrollment_id, ((due_at AT TIME ZONE 'Asia/Jakarta')::date))
  WHERE reminder_rule_id IS NOT NULL AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.wellness_audit_events (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  program_id            uuid,
  actor_user_id         uuid NOT NULL,
  action                text NOT NULL,
  entity_type           text NOT NULL,
  entity_id             text,
  detail                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.wellness_actor_tenant()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.wellness_actor_internal()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = auth.uid()
       AND lower(COALESCE(role,'')) IN (
         'super_admin','admin','admin_faskes','head_operation','direktur','manager','spv','tech'
       )
  )
$$;

CREATE OR REPLACE FUNCTION public.wellness_actor_medical()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.wellness_actor_internal() OR EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = auth.uid()
       AND lower(COALESCE(role,'')) IN ('dokter','doctor_sppk','operasional','staff')
  )
$$;

CREATE OR REPLACE FUNCTION public.wellness_require_user()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR public.wellness_actor_tenant() IS NULL THEN
    RAISE EXCEPTION 'Sesi atau profil pengguna tidak valid.';
  END IF;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_personal_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid;
BEGIN
  v_uid := public.wellness_require_user();
  v_tenant := public.wellness_actor_tenant();
  RETURN jsonb_build_object(
    'programs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'code',p.code,'name',p.name,'description',p.description,
        'focus',p.focus,'starts_on',p.starts_on,'ends_on',p.ends_on,'status',p.status,
        'measurement_plan',p.measurement_plan,'reporting_plan',p.reporting_plan,
        'enrollment_id',e.id,'enrollment_status',e.status,'consent_status',e.consent_status
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

CREATE OR REPLACE FUNCTION public.wellness_record_self(
  p_program_id uuid, p_measurement_type text, p_payload jsonb,
  p_measured_at timestamptz, p_context text DEFAULT NULL,
  p_device_method text DEFAULT NULL, p_note text DEFAULT NULL,
  p_client_record_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid; v_tenant uuid; v_enroll record; v_group uuid:=gen_random_uuid();
  v_client text; v_sys numeric; v_dia numeric; v_pulse numeric; v_glucose numeric;
BEGIN
  v_uid := public.wellness_require_user(); v_tenant := public.wellness_actor_tenant();
  IF p_measured_at IS NULL OR p_measured_at > now()+interval '5 minutes' OR p_measured_at < now()-interval '1 year' THEN
    RAISE EXCEPTION 'Waktu pengukuran tidak valid.';
  END IF;
  SELECT e.* INTO v_enroll FROM public.wellness_enrollments e
   WHERE e.tenant_id=v_tenant AND e.program_id=p_program_id AND e.auth_user_id=v_uid AND e.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Anda belum aktif pada program ini.'; END IF;
  v_client := COALESCE(NULLIF(btrim(p_client_record_id),''), gen_random_uuid()::text);

  IF p_measurement_type='blood_pressure' THEN
    v_sys := NULLIF(p_payload->>'systolic','')::numeric;
    v_dia := NULLIF(p_payload->>'diastolic','')::numeric;
    v_pulse := NULLIF(p_payload->>'pulse','')::numeric;
    IF v_sys IS NULL OR v_dia IS NULL OR v_sys NOT BETWEEN 40 AND 300 OR v_dia NOT BETWEEN 30 AND 200 OR v_dia >= v_sys THEN
      RAISE EXCEPTION 'Nilai tekanan darah tidak valid.';
    END IF;
    IF v_pulse IS NOT NULL AND v_pulse NOT BETWEEN 20 AND 250 THEN RAISE EXCEPTION 'Nilai denyut tidak valid.'; END IF;
    INSERT INTO public.wellness_observations
      (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,
       code,value,unit,measurement_context,measured_at,source,verification_status,device_method,note,client_record_id,created_by)
    VALUES
      (v_tenant,p_program_id,v_enroll.id,v_enroll.corporate_id,v_enroll.corporate_employee_id,v_uid,v_group,
       'blood_pressure_systolic',v_sys,'mmHg',p_context,p_measured_at,'self_reported','unverified',p_device_method,p_note,v_client,v_uid),
      (v_tenant,p_program_id,v_enroll.id,v_enroll.corporate_id,v_enroll.corporate_employee_id,v_uid,v_group,
       'blood_pressure_diastolic',v_dia,'mmHg',p_context,p_measured_at,'self_reported','unverified',p_device_method,p_note,v_client,v_uid);
    IF v_pulse IS NOT NULL THEN
      INSERT INTO public.wellness_observations
        (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,
         code,value,unit,measurement_context,measured_at,source,verification_status,device_method,note,client_record_id,created_by)
      VALUES (v_tenant,p_program_id,v_enroll.id,v_enroll.corporate_id,v_enroll.corporate_employee_id,v_uid,v_group,
        'pulse_rate',v_pulse,'bpm',p_context,p_measured_at,'self_reported','unverified',p_device_method,p_note,v_client,v_uid);
    END IF;
  ELSIF p_measurement_type='blood_glucose' THEN
    v_glucose := NULLIF(p_payload->>'value','')::numeric;
    IF v_glucose IS NULL OR v_glucose NOT BETWEEN 20 AND 600 THEN RAISE EXCEPTION 'Nilai gula darah tidak valid.'; END IF;
    IF COALESCE(p_context,'') NOT IN ('fasting','random','postprandial','before_meal','before_sleep') THEN
      RAISE EXCEPTION 'Konteks gula darah tidak valid.';
    END IF;
    INSERT INTO public.wellness_observations
      (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,
       code,value,unit,measurement_context,measured_at,source,verification_status,device_method,note,client_record_id,created_by)
    VALUES (v_tenant,p_program_id,v_enroll.id,v_enroll.corporate_id,v_enroll.corporate_employee_id,v_uid,v_group,
      'blood_glucose',v_glucose,'mg/dL',p_context,p_measured_at,'self_reported','unverified',p_device_method,p_note,v_client,v_uid);
  ELSE
    RAISE EXCEPTION 'Jenis pengukuran tidak didukung.';
  END IF;

  INSERT INTO public.wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
  VALUES(v_tenant,p_program_id,v_uid,'CREATE_SELF_OBSERVATION','observation_group',v_group::text,
    jsonb_build_object('measurement_type',p_measurement_type,'source','self_reported'));
  RETURN jsonb_build_object('ok',true,'group_id',v_group,'verification_status','unverified');
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',true,'duplicate',true,'client_record_id',v_client);
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  RETURN jsonb_build_object(
    'corporates',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.corporate_name) ORDER BY c.corporate_name)
      FROM public.corporates c WHERE COALESCE(c.status,'Aktif') IN ('Aktif','Prospek')),'[]'::jsonb),
    'programs',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
      SELECT p.*,
        (SELECT count(*) FROM public.wellness_enrollments e WHERE e.program_id=p.id) AS enrolled,
        (SELECT count(*) FROM public.wellness_observations o WHERE o.program_id=p.id) AS observations,
        (SELECT count(*) FROM public.wellness_tasks t WHERE t.program_id=p.id AND t.status='open') AS open_tasks,
        c.corporate_name
      FROM public.wellness_programs p JOIN public.corporates c ON c.id=p.corporate_id
      WHERE p.tenant_id=v_tenant ORDER BY p.created_at DESC
    ) x),'[]'::jsonb),
    'reminder_rules',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM public.wellness_reminder_rules r WHERE r.tenant_id=v_tenant),'[]'::jsonb),
    'imports',COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC)
      FROM (SELECT * FROM public.wellness_import_batches WHERE tenant_id=v_tenant ORDER BY created_at DESC LIMIT 30) b),'[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_admin_save_program(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_id uuid; v_corporate bigint; v_code text; v_name text;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  v_id:=NULLIF(p_data->>'id','')::uuid; v_corporate:=NULLIF(p_data->>'corporate_id','')::bigint;
  v_code:=upper(regexp_replace(COALESCE(p_data->>'code',''),'[^A-Za-z0-9_-]','','g'));
  v_name:=btrim(COALESCE(p_data->>'name',''));
  IF v_corporate IS NULL OR length(v_code)<3 OR length(v_name)<3 THEN RAISE EXCEPTION 'Perusahaan, kode, dan nama program wajib diisi.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.corporates WHERE id=v_corporate) THEN RAISE EXCEPTION 'Perusahaan tidak ditemukan.'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.wellness_programs
      (tenant_id,corporate_id,code,name,description,focus,starts_on,ends_on,status,measurement_plan,reporting_plan,created_by)
    VALUES(v_tenant,v_corporate,v_code,v_name,NULLIF(p_data->>'description',''),
      ARRAY['diabetes','hypertension']::text[],COALESCE(NULLIF(p_data->>'starts_on','')::date,current_date),
      NULLIF(p_data->>'ends_on','')::date,COALESCE(NULLIF(p_data->>'status',''),'draft'),
      COALESCE(p_data->'measurement_plan','{}'::jsonb),COALESCE(p_data->'reporting_plan','{}'::jsonb),v_uid)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.wellness_programs SET corporate_id=v_corporate,code=v_code,name=v_name,
      description=NULLIF(p_data->>'description',''),starts_on=COALESCE(NULLIF(p_data->>'starts_on','')::date,starts_on),
      ends_on=NULLIF(p_data->>'ends_on','')::date,status=COALESCE(NULLIF(p_data->>'status',''),status),
      measurement_plan=COALESCE(p_data->'measurement_plan',measurement_plan),
      reporting_plan=COALESCE(p_data->'reporting_plan',reporting_plan),updated_by=v_uid,updated_at=now()
    WHERE id=v_id AND tenant_id=v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Program tidak ditemukan pada tenant aktif.'; END IF;
  END IF;
  INSERT INTO public.wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id)
  VALUES(v_tenant,v_id,v_uid,'SAVE_PROGRAM','program',v_id::text);
  RETURN jsonb_build_object('ok',true,'id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_admin_enroll_roster(p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_program record; v_added integer:=0; v_linked integer:=0;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  SELECT * INTO v_program FROM public.wellness_programs WHERE id=p_program_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program tidak ditemukan.'; END IF;
  INSERT INTO public.wellness_enrollments
    (tenant_id,program_id,corporate_id,corporate_employee_id,auth_user_id,status,consent_status,activated_at,created_by)
  SELECT v_tenant,v_program.id,v_program.corporate_id,e.id,
         (SELECT u.id FROM auth.users u WHERE lower(u.email)=lower(e.email) LIMIT 1),
         'active','pending',now(),v_uid
    FROM public.corporate_employees e
   WHERE e.corporate_id=v_program.corporate_id AND COALESCE(e.status,'')<>'Keluar'
  ON CONFLICT (program_id,corporate_employee_id) WHERE corporate_employee_id IS NOT NULL
  DO UPDATE SET auth_user_id=COALESCE(public.wellness_enrollments.auth_user_id,EXCLUDED.auth_user_id),updated_at=now();
  GET DIAGNOSTICS v_added=ROW_COUNT;
  SELECT count(*) INTO v_linked FROM public.wellness_enrollments WHERE program_id=p_program_id AND auth_user_id IS NOT NULL;
  INSERT INTO public.wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
  VALUES(v_tenant,p_program_id,v_uid,'ENROLL_ROSTER','program',p_program_id::text,jsonb_build_object('affected',v_added,'linked_accounts',v_linked));
  RETURN jsonb_build_object('ok',true,'affected',v_added,'linked_accounts',v_linked);
END;
$$;

CREATE OR REPLACE FUNCTION public.wellness_admin_save_reminder(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid; v_tenant uuid; v_program uuid; v_id uuid;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_internal() THEN RAISE EXCEPTION 'Akses admin wellness diperlukan.'; END IF;
  v_program:=NULLIF(p_data->>'program_id','')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.wellness_programs WHERE id=v_program AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'Program tidak ditemukan.'; END IF;
  IF length(btrim(COALESCE(p_data->>'name','')))<3 OR length(btrim(COALESCE(p_data->>'message_template','')))<3 THEN
    RAISE EXCEPTION 'Nama dan isi pengingat wajib diisi.';
  END IF;
  INSERT INTO public.wellness_reminder_rules
    (tenant_id,program_id,name,measurement_type,inactivity_days,channel,send_time,message_template,created_by)
  VALUES(v_tenant,v_program,btrim(p_data->>'name'),COALESCE(NULLIF(p_data->>'measurement_type',''),'any'),
    COALESCE(NULLIF(p_data->>'inactivity_days','')::integer,1),COALESCE(NULLIF(p_data->>'channel',''),'in_app'),
    COALESCE(NULLIF(p_data->>'send_time','')::time,'08:00'::time),btrim(p_data->>'message_template'),v_uid)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id);
END;
$$;

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
    JOIN public.wellness_enrollments e ON e.program_id=r.program_id AND e.status='active'
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

CREATE OR REPLACE FUNCTION public.wellness_import_ihc(
  p_program_id uuid, p_source_file text, p_checksum text, p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid; v_tenant uuid; v_program record; v_batch uuid; v_existing record;
  v_row jsonb; v_idx integer:=0; v_employee record; v_enroll record; v_client text; v_group uuid;
  v_sys numeric; v_dia numeric; v_pulse numeric; v_glucose numeric; v_hba1c numeric; v_time timestamptz; v_context text;
  v_accepted integer:=0; v_rejected integer:=0; v_errors jsonb:='[]'::jsonb;
BEGIN
  v_uid:=public.wellness_require_user(); v_tenant:=public.wellness_actor_tenant();
  IF NOT public.wellness_actor_medical() THEN RAISE EXCEPTION 'Akses impor IHC diperlukan.'; END IF;
  IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 OR jsonb_array_length(p_rows)>5000 THEN
    RAISE EXCEPTION 'Batch harus berisi 1–5000 baris.';
  END IF;
  SELECT * INTO v_program FROM public.wellness_programs WHERE id=p_program_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program tidak ditemukan.'; END IF;
  SELECT * INTO v_existing FROM public.wellness_import_batches
    WHERE tenant_id=v_tenant AND program_id=p_program_id AND checksum=p_checksum;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'batch_id',v_existing.id,
    'accepted_rows',v_existing.accepted_rows,'rejected_rows',v_existing.rejected_rows,'errors',v_existing.error_details); END IF;
  INSERT INTO public.wellness_import_batches
    (tenant_id,program_id,corporate_id,source_file,checksum,total_rows,created_by)
  VALUES(v_tenant,p_program_id,v_program.corporate_id,NULLIF(btrim(p_source_file),''),btrim(p_checksum),jsonb_array_length(p_rows),v_uid)
  RETURNING id INTO v_batch;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_idx:=v_idx+1;
    BEGIN
      SELECT * INTO STRICT v_employee FROM public.corporate_employees
       WHERE corporate_id=v_program.corporate_id AND employee_id=btrim(v_row->>'employee_id') LIMIT 1;
      SELECT * INTO STRICT v_enroll FROM public.wellness_enrollments
       WHERE program_id=p_program_id AND corporate_employee_id=v_employee.id AND status='active' LIMIT 1;
      v_time:=NULLIF(v_row->>'measured_at','')::timestamptz;
      IF v_time IS NULL OR v_time>now()+interval '5 minutes' OR v_time<now()-interval '2 years' THEN RAISE EXCEPTION 'measured_at tidak valid'; END IF;
      v_client:=COALESCE(NULLIF(btrim(v_row->>'external_id'),''),p_checksum||':'||v_idx::text); v_group:=gen_random_uuid();
      v_sys:=NULLIF(v_row->>'systolic','')::numeric; v_dia:=NULLIF(v_row->>'diastolic','')::numeric;
      v_pulse:=NULLIF(v_row->>'pulse','')::numeric; v_glucose:=NULLIF(v_row->>'glucose','')::numeric;
      v_hba1c:=NULLIF(v_row->>'hba1c','')::numeric;
      v_context:=COALESCE(NULLIF(v_row->>'glucose_context',''),'random');
      IF v_sys IS NULL AND v_dia IS NULL AND v_glucose IS NULL AND v_hba1c IS NULL THEN RAISE EXCEPTION 'tidak ada nilai pemeriksaan'; END IF;
      IF (v_sys IS NULL)<>(v_dia IS NULL) THEN RAISE EXCEPTION 'sistolik dan diastolik harus berpasangan'; END IF;
      IF v_sys IS NOT NULL THEN
        IF v_sys NOT BETWEEN 40 AND 300 OR v_dia NOT BETWEEN 30 AND 200 OR v_dia>=v_sys THEN RAISE EXCEPTION 'tekanan darah tidak valid'; END IF;
        INSERT INTO public.wellness_observations
          (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
           measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
        VALUES
          (v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'blood_pressure_systolic',v_sys,'mmHg','ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid),
          (v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'blood_pressure_diastolic',v_dia,'mmHg','ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
        ON CONFLICT DO NOTHING;
        IF v_pulse IS NOT NULL THEN
          IF v_pulse NOT BETWEEN 20 AND 250 THEN RAISE EXCEPTION 'denyut tidak valid'; END IF;
          INSERT INTO public.wellness_observations
            (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
             measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
          VALUES(v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'pulse_rate',v_pulse,'bpm','ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
      IF v_glucose IS NOT NULL THEN
        IF v_glucose NOT BETWEEN 20 AND 600 THEN RAISE EXCEPTION 'gula darah tidak valid'; END IF;
        IF v_context NOT IN ('fasting','random','postprandial','before_meal','before_sleep') THEN RAISE EXCEPTION 'konteks gula darah tidak valid'; END IF;
        INSERT INTO public.wellness_observations
          (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
           measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
        VALUES(v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'blood_glucose',v_glucose,'mg/dL',
          v_context,v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
        ON CONFLICT DO NOTHING;
      END IF;
      IF v_hba1c IS NOT NULL THEN
        IF v_hba1c NOT BETWEEN 2 AND 25 THEN RAISE EXCEPTION 'HbA1c tidak valid'; END IF;
        INSERT INTO public.wellness_observations
          (tenant_id,program_id,enrollment_id,corporate_id,corporate_employee_id,subject_user_id,group_id,code,value,unit,
           measurement_context,measured_at,source,verification_status,device_method,import_batch_id,client_record_id,created_by)
        VALUES(v_tenant,p_program_id,v_enroll.id,v_program.corporate_id,v_employee.id,v_enroll.auth_user_id,v_group,'hba1c',v_hba1c,'%',
          'ihc',v_time,'ihc_bulk','verified','IHC',v_batch,v_client,v_uid)
        ON CONFLICT DO NOTHING;
      END IF;
      v_accepted:=v_accepted+1;
    EXCEPTION WHEN OTHERS THEN
      v_rejected:=v_rejected+1;
      v_errors:=v_errors||jsonb_build_array(jsonb_build_object('row',v_idx,'employee_id',v_row->>'employee_id','error',SQLERRM));
    END;
  END LOOP;
  UPDATE public.wellness_import_batches SET accepted_rows=v_accepted,rejected_rows=v_rejected,error_details=v_errors,
    status=CASE WHEN v_rejected=0 THEN 'completed' WHEN v_accepted=0 THEN 'failed' ELSE 'completed_with_errors' END,completed_at=now()
  WHERE id=v_batch;
  INSERT INTO public.wellness_audit_events(tenant_id,program_id,actor_user_id,action,entity_type,entity_id,detail)
  VALUES(v_tenant,p_program_id,v_uid,'IMPORT_IHC','import_batch',v_batch::text,jsonb_build_object('accepted',v_accepted,'rejected',v_rejected));
  RETURN jsonb_build_object('ok',true,'batch_id',v_batch,'accepted_rows',v_accepted,'rejected_rows',v_rejected,'errors',v_errors);
END;
$$;

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
    'programs',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.starts_on DESC) FROM (
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
        (count(DISTINCT o.enrollment_id) FILTER(WHERE o.measured_at>=now()-interval '30 days')<5) AS small_cell_suppressed
      FROM public.wellness_programs p
      LEFT JOIN public.wellness_enrollments e ON e.program_id=p.id AND e.status<>'withdrawn'
      LEFT JOIN public.wellness_observations o ON o.enrollment_id=e.id
      WHERE p.tenant_id=v_tenant AND p.corporate_id=v_corporate AND (p_program_id IS NULL OR p.id=p_program_id)
      GROUP BY p.id
    ) s),'[]'::jsonb),
    'imports',CASE WHEN v_internal THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',b.id,'program_id',b.program_id,'source_file',b.source_file,'status',b.status,
        'total_rows',b.total_rows,'accepted_rows',b.accepted_rows,'rejected_rows',b.rejected_rows,'created_at',b.created_at) ORDER BY b.created_at DESC)
      FROM public.wellness_import_batches b WHERE b.tenant_id=v_tenant AND b.corporate_id=v_corporate LIMIT 20
    ),'[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$$;

ALTER TABLE public.wellness_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.wellness_programs,public.wellness_enrollments,public.wellness_import_batches,
  public.wellness_observations,public.wellness_reminder_rules,public.wellness_tasks,public.wellness_audit_events
  FROM anon,authenticated;
GRANT ALL ON public.wellness_programs,public.wellness_enrollments,public.wellness_import_batches,
  public.wellness_observations,public.wellness_reminder_rules,public.wellness_tasks,public.wellness_audit_events
  TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.wellness_audit_events_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.wellness_actor_tenant(),public.wellness_actor_internal(),public.wellness_actor_medical(),public.wellness_require_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wellness_personal_dashboard(),public.wellness_record_self(uuid,text,jsonb,timestamptz,text,text,text,text),
  public.wellness_admin_dashboard(),public.wellness_admin_save_program(jsonb),public.wellness_admin_enroll_roster(uuid),
  public.wellness_admin_save_reminder(jsonb),public.wellness_generate_reminders(uuid),
  public.wellness_import_ihc(uuid,text,text,jsonb),public.wellness_corporate_dashboard(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wellness_personal_dashboard(),public.wellness_record_self(uuid,text,jsonb,timestamptz,text,text,text,text),
  public.wellness_admin_dashboard(),public.wellness_admin_save_program(jsonb),public.wellness_admin_enroll_roster(uuid),
  public.wellness_admin_save_reminder(jsonb),public.wellness_generate_reminders(uuid),
  public.wellness_import_ihc(uuid,text,text,jsonb),public.wellness_corporate_dashboard(uuid,bigint)
  TO authenticated,service_role;

COMMENT ON TABLE public.wellness_programs IS 'OWNED_BY: generic; parameterized corporate wellness program.';
COMMENT ON TABLE public.wellness_observations IS 'Longitudinal observation with provenance; self-reported data is never auto-verified.';
COMMENT ON FUNCTION public.wellness_corporate_dashboard(uuid,bigint) IS 'Aggregate-only HR dashboard with small-cell suppression.';
