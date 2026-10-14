-- OWNED_BY: generic. Signed nursing sources; no automatic clinical decisions.
BEGIN;
-- Timestamp the actual record/signing operation after locks, not transaction start.
ALTER TABLE rs_clinical_records ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE rs_clinical_events ALTER COLUMN happened_at SET DEFAULT clock_timestamp();
DO $$DECLARE body text;needle text:='signed_by=a,signed_at=now()';BEGIN
 SELECT pg_get_functiondef('rs_clinical_command(text,jsonb,text)'::regprocedure) INTO body;
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Clinical signing clock contract changed';END IF;
 body:=replace(body,needle,'signed_by=a,signed_at=clock_timestamp()');EXECUTE body;
END $$;
CREATE TABLE rs_nursing_tasks(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),episode_id bigint NOT NULL REFERENCES rs_care_episodes(id),admission_id bigint NOT NULL REFERENCES admissions(id),clinical_record_id bigint NOT NULL UNIQUE REFERENCES rs_clinical_records(id),policy_snapshot jsonb NOT NULL,title text NOT NULL,due_at timestamptz NOT NULL,assignee_id uuid NOT NULL REFERENCES user_profiles(id),state text NOT NULL DEFAULT 'open' CHECK(state IN('open','completed','cancelled')),version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_by uuid,finished_at timestamptz,outcome_record_id bigint REFERENCES rs_clinical_records(id),assignment_record_id bigint REFERENCES rs_clinical_records(id));
CREATE TABLE rs_nursing_handovers(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),episode_id bigint NOT NULL REFERENCES rs_care_episodes(id),admission_id bigint NOT NULL REFERENCES admissions(id),clinical_record_id bigint NOT NULL UNIQUE REFERENCES rs_clinical_records(id),shift_code text NOT NULL,shift_start timestamptz NOT NULL,shift_end timestamptz NOT NULL,recipient_id uuid NOT NULL REFERENCES user_profiles(id),sender_id uuid NOT NULL REFERENCES user_profiles(id),task_snapshot jsonb NOT NULL,state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','accepted','rejected','withdrawn')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),received_at timestamptz,received_by uuid,receipt_evidence text,correction_record_id bigint REFERENCES rs_clinical_records(id),CHECK(shift_end>shift_start),CHECK(sender_id<>recipient_id));
CREATE UNIQUE INDEX rs_nursing_one_shift ON rs_nursing_handovers(tenant_id,admission_id,shift_start,shift_end) WHERE state NOT IN('rejected','withdrawn');
CREATE TABLE rs_nursing_notifications(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),task_id bigint NOT NULL REFERENCES rs_nursing_tasks(id),task_version integer NOT NULL,level integer NOT NULL CHECK(level BETWEEN 0 AND 2),recipient_id uuid NOT NULL REFERENCES user_profiles(id),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(task_id,task_version,level));
CREATE TABLE rs_nursing_requests(tenant_id uuid NOT NULL REFERENCES tenants(id),request_key text NOT NULL,actor uuid NOT NULL,action text NOT NULL,input jsonb NOT NULL,output jsonb NOT NULL,PRIMARY KEY(tenant_id,request_key));
CREATE TABLE rs_nursing_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),actor uuid NOT NULL,action text NOT NULL,task_id bigint REFERENCES rs_nursing_tasks(id),handover_id bigint REFERENCES rs_nursing_handovers(id),input jsonb NOT NULL,before_row jsonb,after_row jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE rs_nursing_observations(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),episode_id bigint NOT NULL REFERENCES rs_care_episodes(id),admission_id bigint NOT NULL REFERENCES admissions(id),clinical_record_id bigint NOT NULL UNIQUE REFERENCES rs_clinical_records(id),policy_snapshot jsonb NOT NULL,observed_at timestamptz NOT NULL,measurement_code text NOT NULL,measurement_label text NOT NULL,unit text NOT NULL,value numeric,status text NOT NULL CHECK(status IN('valid','entered_in_error')),amendment_of bigint UNIQUE REFERENCES rs_nursing_observations(id),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(status<>'valid' OR value IS NOT NULL),CHECK(status<>'entered_in_error' OR amendment_of IS NOT NULL));
CREATE FUNCTION rs_nursing_immutable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Nursing audit/notification immutable';END $$;
DO $$DECLARE name text;BEGIN FOREACH name IN ARRAY ARRAY['rs_nursing_notifications','rs_nursing_requests','rs_nursing_events','rs_nursing_observations'] LOOP EXECUTE format('CREATE TRIGGER immutable_source BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rs_nursing_immutable()',name);END LOOP;END $$;
CREATE FUNCTION rs_nursing_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Nursing source immutable';END IF;
 IF TG_TABLE_NAME='rs_nursing_tasks' THEN
  IF OLD.state<>'open' OR NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-ARRAY['state','version','assignee_id','finished_by','finished_at','outcome_record_id','assignment_record_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','assignee_id','finished_by','finished_at','outcome_record_id','assignment_record_id']) THEN RAISE EXCEPTION 'Nursing task transition invalid';END IF;
 ELSE
  IF OLD.state<>'pending' OR NEW.state NOT IN('accepted','rejected','withdrawn') OR NEW.version<>OLD.version+1 OR (NEW.received_by IS NULL OR (NEW.state<>'withdrawn' AND NEW.received_by IS DISTINCT FROM OLD.recipient_id) OR (NEW.state='withdrawn' AND NEW.correction_record_id IS NULL)) OR (to_jsonb(NEW)-ARRAY['state','version','received_at','received_by','receipt_evidence','correction_record_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','received_at','received_by','receipt_evidence','correction_record_id']) THEN RAISE EXCEPTION 'Nursing handover transition invalid';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER nursing_task_source BEFORE UPDATE OR DELETE ON rs_nursing_tasks FOR EACH ROW EXECUTE FUNCTION rs_nursing_source_guard();
CREATE TRIGGER nursing_handover_source BEFORE UPDATE OR DELETE ON rs_nursing_handovers FOR EACH ROW EXECUTE FUNCTION rs_nursing_source_guard();
ALTER FUNCTION ops_validate_policy(text,jsonb) RENAME TO ops_validate_policy_before_nursing_sources;
CREATE FUNCTION ops_validate_policy(p_kind text,p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE purpose text:=p->>'purpose';key_name text;wanted text;BEGIN
 PERFORM ops_validate_policy_before_nursing_sources(p_kind,p);
 IF p_kind<>'clinical_template' OR purpose NOT IN('nursing_task','nursing_task_outcome','nursing_shift','nursing_observation','nursing_task_reassignment') OR purpose IS NULL THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'signer_roles') r WHERE ops_professional_role(r)<>'nurse') THEN RAISE EXCEPTION 'Nursing SOP memerlukan timezone dan signer profesi perawat';END IF;
 FOR key_name,wanted IN SELECT * FROM (VALUES('title','text'),('due_at','text'),('assignee_id','text')) f(key_name,wanted) WHERE purpose='nursing_task' UNION ALL SELECT * FROM (VALUES('task_id','number'),('outcome','text'),('evidence','text')) f WHERE purpose='nursing_task_outcome' UNION ALL SELECT * FROM (VALUES('shift_code','text'),('shift_start','text'),('shift_end','text'),('situation','text'),('background','text'),('assessment','text'),('recommendation','text')) f WHERE purpose='nursing_shift' LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'=key_name AND f->>'type'=wanted AND f->'required'='true'::jsonb) THEN RAISE EXCEPTION 'Field nursing source wajib: %',key_name;END IF;
 END LOOP;
 IF purpose='nursing_task_reassignment' THEN
  FOREACH key_name IN ARRAY ARRAY['task_id','assignee_id','evidence'] LOOP wanted:=CASE key_name WHEN 'task_id' THEN 'number' ELSE 'text' END;IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'=key_name AND f->>'type'=wanted AND f->'required'='true'::jsonb) THEN RAISE EXCEPTION 'Field penugasan wajib: %',key_name;END IF;END LOOP;
 END IF;
 IF purpose='nursing_observation' THEN
  FOREACH key_name IN ARRAY ARRAY['observed_at','measurement_code','status'] LOOP IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'=key_name AND f->>'type'='text' AND f->'required'='true'::jsonb) THEN RAISE EXCEPTION 'Field observasi wajib: %',key_name;END IF;END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE f->>'key'='value' AND f->>'type'='number') OR jsonb_typeof(p->'measurements') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'measurements') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Definisi pengukuran/unit SOP wajib';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'measurements') m WHERE jsonb_typeof(m) IS DISTINCT FROM 'object' OR jsonb_typeof(m->'code') IS DISTINCT FROM 'string' OR jsonb_typeof(m->'label') IS DISTINCT FROM 'string' OR jsonb_typeof(m->'unit') IS DISTINCT FROM 'string' OR coalesce(m->>'code','') !~ '^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$' OR coalesce(length(trim(m->>'label')),0) NOT BETWEEN 1 AND 200 OR coalesce(length(trim(m->>'unit')),0) NOT BETWEEN 1 AND 100) OR (SELECT count(DISTINCT m->>'code') FROM jsonb_array_elements(p->'measurements') m)<>jsonb_array_length(p->'measurements') THEN RAISE EXCEPTION 'Kode/label/unit unik eksplisit wajib';END IF;
 END IF;
 IF purpose='nursing_task' THEN
  IF jsonb_typeof(p->'task_escalation') IS DISTINCT FROM 'object' OR jsonb_typeof(p->'task_escalation'->'head_after_minutes') IS DISTINCT FROM 'number' OR jsonb_typeof(p->'task_escalation'->'supervisor_after_minutes') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Aturan eskalasi eksplisit wajib';END IF;
  IF (p->'task_escalation'->>'head_after_minutes')::numeric<0 OR (p->'task_escalation'->>'supervisor_after_minutes')::numeric<=(p->'task_escalation'->>'head_after_minutes')::numeric OR NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=(p->'task_escalation'->>'head_user_id')::uuid AND tenant_id=current_tenant_id() AND ops_professional_role(role)='nurse') OR NOT EXISTS(SELECT 1 FROM user_profiles WHERE id=(p->'task_escalation'->>'supervisor_user_id')::uuid AND tenant_id=current_tenant_id() AND lower(role) IN('head_operation','direktur')) THEN RAISE EXCEPTION 'Jalur kepala unit/supervisor tenant dan tenggat berjenjang wajib';END IF;
 END IF;
END $$;
CREATE FUNCTION rs_nursing_observation_command(p_episode bigint,p_record bigint,p_amendment bigint,p_key text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;admission_value bigint;ep rs_care_episodes;r rs_clinical_records;p ops_policy_versions;prior rs_nursing_observations;observation rs_nursing_observations;req rs_nursing_requests;definition jsonb;stamp timestamptz;number_value numeric;status_value text;inp jsonb;result jsonb;
BEGIN
 a:=ops_actor(ARRAY['nurse','perawat']);PERFORM ops_assert_permission('rs-nurse-station','clinical.nursing.observe');IF p_amendment IS NOT NULL THEN PERFORM ops_assert_permission('rs-nurse-station','clinical.nursing.observe_amend');END IF;
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Request dan alasan observasi wajib';END IF;
 inp:=jsonb_build_object('episode',p_episode,'record',p_record,'amendment',p_amendment,'reason',p_reason);PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':nursing:'||p_key,0));SELECT * INTO req FROM rs_nursing_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor<>a OR req.action<>'observe' OR req.input IS DISTINCT FROM inp THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN req.output;END IF;
 SELECT admission_id INTO admission_value FROM rs_care_episodes WHERE id=p_episode AND tenant_id=t;PERFORM 1 FROM admissions WHERE id=admission_value AND tenant_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Episode tenant tidak ditemukan';END IF;
 SELECT * INTO ep FROM rs_care_episodes WHERE id=p_episode AND tenant_id=t FOR UPDATE;
 IF p_amendment IS NULL AND (ep.state<>'active' OR NOT EXISTS(SELECT 1 FROM rs_encounter_lifecycle WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open') OR EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=ep.admission_id AND tenant_id=t AND status<>'Dirawat')) THEN RAISE EXCEPTION 'Observasi baru memerlukan episode aktif';END IF;
 r:=rs_nursing_signed_source(p_record,'nursing_observation',ep.admission_id);SELECT * INTO p FROM ops_policy_versions WHERE id=r.policy_id;PERFORM ops_validate_policy('clinical_template',p.payload);
 SELECT m INTO definition FROM jsonb_array_elements(p.payload->'measurements') m WHERE m->>'code'=r.form_values->>'measurement_code';
 status_value:=r.form_values->>'status';IF definition IS NULL OR status_value IS NULL OR status_value NOT IN('valid','entered_in_error') OR coalesce(r.form_values->>'observed_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Kode/status/waktu pengukuran eksplisit wajib';END IF;
 stamp:=(r.form_values->>'observed_at')::timestamptz;IF stamp<ep.started_at OR stamp>r.created_at OR stamp>clock_timestamp() OR ep.ended_at IS NOT NULL AND stamp>ep.ended_at THEN RAISE EXCEPTION 'Waktu observasi di luar episode sumber';END IF;
 IF status_value='valid' THEN IF jsonb_typeof(r.form_values->'value') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Nilai numerik pengukuran wajib';END IF;number_value:=(r.form_values->>'value')::numeric;END IF;
 IF p_amendment IS NOT NULL THEN
  SELECT * INTO prior FROM rs_nursing_observations WHERE id=p_amendment AND tenant_id=t AND episode_id=ep.id AND admission_id=ep.admission_id;
  IF NOT FOUND OR prior.clinical_record_id IS DISTINCT FROM r.amendment_of OR prior.measurement_code IS DISTINCT FROM definition->>'code' OR EXISTS(SELECT 1 FROM rs_nursing_observations WHERE amendment_of=prior.id) THEN RAISE EXCEPTION 'Amendment observasi harus dari source parent/code/episode yang sama';END IF;
 ELSE IF r.amendment_of IS NOT NULL OR status_value='entered_in_error' THEN RAISE EXCEPTION 'Parent observasi asli wajib untuk koreksi';END IF;END IF;
 INSERT INTO rs_nursing_observations(tenant_id,episode_id,admission_id,clinical_record_id,policy_snapshot,observed_at,measurement_code,measurement_label,unit,value,status,amendment_of,created_by) VALUES(t,ep.id,ep.admission_id,r.id,to_jsonb(p),stamp,definition->>'code',definition->>'label',definition->>'unit',number_value,status_value,p_amendment,a) RETURNING * INTO observation;result:=to_jsonb(observation);
 INSERT INTO rs_nursing_requests VALUES(t,p_key,a,'observe',inp,result);INSERT INTO rs_nursing_events(tenant_id,actor,action,input,after_row) VALUES(t,a,'observe',inp,result);RETURN result;
END $$;
CREATE FUNCTION rs_nursing_signed_source(p_record bigint,p_purpose text,p_admission bigint) RETURNS rs_clinical_records LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r rs_clinical_records;BEGIN
 SELECT * INTO r FROM rs_clinical_records WHERE id=p_record AND tenant_id=current_tenant_id() AND admission_id=p_admission AND signed_at IS NOT NULL AND signed_by=auth.uid() FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM ops_policy_versions WHERE id=r.policy_id AND tenant_id=r.tenant_id AND kind='clinical_template' AND scope='rs-nurse-station' AND payload->>'purpose'=p_purpose) OR EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=r.id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Catatan nursing signed milik pelaksana dan purpose terkini wajib';END IF;RETURN r;
END $$;
CREATE FUNCTION rs_nursing_assert_recipient(p_user uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role_name text;authority jsonb;rule jsonb;BEGIN
 SELECT lower(role) INTO role_name FROM user_profiles WHERE id=p_user AND tenant_id=current_tenant_id() AND ops_professional_role(role)='nurse' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Perawat penerima tenant wajib';END IF;
 authority:=ops_active_policy('authority','rs-nurse-station');SELECT value INTO rule FROM jsonb_array_elements(authority->'payload'->'rules') WHERE value->>'action'=p_action;
 IF rule IS NULL OR NOT(rule->'roles' ? role_name) THEN RAISE EXCEPTION 'Penerima belum berwenang pada authority SOP';END IF;PERFORM ops_assert_individual_privilege('rs-nurse-station',p_action,p_user);
END $$;
CREATE FUNCTION rs_nursing_assert_task_heads(p_admission bigint,p_task bigint DEFAULT NULL,p_recorded_before timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN
 PERFORM 1 FROM rs_clinical_records r JOIN rs_nursing_tasks t ON t.clinical_record_id=r.id AND t.tenant_id=r.tenant_id WHERE t.tenant_id=current_tenant_id() AND t.admission_id=p_admission AND t.state='open' AND (p_task IS NULL OR t.id=p_task) ORDER BY r.id FOR SHARE OF r;
 IF EXISTS(SELECT 1 FROM rs_nursing_tasks t JOIN rs_clinical_records child ON child.amendment_of=t.clinical_record_id AND child.tenant_id=t.tenant_id AND child.signed_at IS NOT NULL WHERE t.tenant_id=current_tenant_id() AND t.admission_id=p_admission AND t.state='open' AND (p_task IS NULL OR t.id=p_task) AND (p_recorded_before IS NULL OR child.signed_at<=p_recorded_before)) THEN RAISE EXCEPTION 'Instruksi tugas sudah diamend; batalkan/replan sesuai SOP';END IF;
END $$;
CREATE FUNCTION rs_nursing_command(p_action text,p_data jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;admission_value bigint;req rs_nursing_requests;ep rs_care_episodes;task rs_nursing_tasks;h rs_nursing_handovers;r rs_clinical_records;p ops_policy_versions;result jsonb;before_value jsonb;tasks jsonb;recipient uuid;due timestamptz;start_value timestamptz;end_value timestamptz;item jsonb;level_value integer;notification rs_nursing_notifications;
BEGIN
 a:=ops_actor(ARRAY['nurse','perawat']);
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 150 OR length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Input/request/alasan wajib';END IF;
 PERFORM ops_assert_permission('rs-nurse-station','clinical.nursing.'||p_action);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':nursing:'||p_key,0));SELECT * INTO req FROM rs_nursing_requests WHERE tenant_id=t AND request_key=p_key;
 IF FOUND THEN IF req.actor<>a OR req.action<>p_action OR req.input IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'Retry actor/input berbeda';END IF;RETURN req.output;END IF;
 IF p_action IN('create_task','handover') THEN SELECT admission_id INTO admission_value FROM rs_care_episodes WHERE id=(p_data->>'episode_id')::bigint AND tenant_id=t;
 ELSIF p_action IN('complete','cancel','escalate','reassign') THEN SELECT admission_id INTO admission_value FROM rs_nursing_tasks WHERE id=(p_data->>'id')::bigint AND tenant_id=t;
 ELSIF p_action IN('accept','reject','withdraw') THEN SELECT admission_id INTO admission_value FROM rs_nursing_handovers WHERE id=(p_data->>'id')::bigint AND tenant_id=t;END IF;
 PERFORM 1 FROM admissions WHERE id=admission_value AND tenant_id=t FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Encounter tenant tidak ditemukan';END IF;
 IF EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=admission_value AND tenant_id=t AND status<>'Dirawat') AND NOT EXISTS(SELECT 1 FROM inpatient_stays WHERE admission_id=admission_value AND tenant_id=t AND status='Dirawat') THEN RAISE EXCEPTION 'Stay sumber telah selesai';END IF;
 IF p_action IN('create_task','handover') THEN SELECT * INTO ep FROM rs_care_episodes WHERE id=(p_data->>'episode_id')::bigint AND tenant_id=t FOR UPDATE;
 ELSIF p_action IN('complete','cancel','escalate','reassign') THEN SELECT * INTO task FROM rs_nursing_tasks WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO ep FROM rs_care_episodes WHERE admission_id=task.admission_id AND tenant_id=t AND state='active' FOR UPDATE;
 ELSIF p_action IN('accept','reject','withdraw') THEN SELECT * INTO h FROM rs_nursing_handovers WHERE id=(p_data->>'id')::bigint AND tenant_id=t;SELECT * INTO ep FROM rs_care_episodes WHERE id=h.episode_id AND tenant_id=t FOR UPDATE;
 ELSE RAISE EXCEPTION 'Aksi nursing tidak didukung';END IF;
 IF ep.id IS NULL OR ep.state<>'active' OR NOT EXISTS(SELECT 1 FROM rs_encounter_lifecycle WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open') THEN RAISE EXCEPTION 'Episode aktif/encounter terbuka milik tenant wajib';END IF;
 IF p_action='create_task' THEN
  r:=rs_nursing_signed_source((p_data->>'clinical_record_id')::bigint,'nursing_task',ep.admission_id);SELECT * INTO p FROM ops_policy_versions WHERE id=r.policy_id;
  PERFORM ops_validate_policy('clinical_template',p.payload);IF r.created_at<ep.started_at THEN RAISE EXCEPTION 'Source tugas dibuat sebelum episode';END IF;recipient:=(r.form_values->>'assignee_id')::uuid;PERFORM 1 FROM user_profiles WHERE id=recipient AND tenant_id=t AND ops_professional_role(role)='nurse' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Perawat penanggung jawab tenant wajib';END IF;PERFORM rs_nursing_assert_recipient(recipient,'clinical.nursing.complete');
  IF r.form_values->>'due_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Deadline ISO offset eksplisit wajib';END IF;due:=(r.form_values->>'due_at')::timestamptz;
  IF due<ep.started_at OR length(trim(coalesce(r.form_values->>'title','')))<3 THEN RAISE EXCEPTION 'Judul/deadline dalam episode wajib';END IF;
  INSERT INTO rs_nursing_tasks(tenant_id,episode_id,admission_id,clinical_record_id,policy_snapshot,title,due_at,assignee_id,created_by) VALUES(t,ep.id,ep.admission_id,r.id,to_jsonb(p),r.form_values->>'title',due,recipient,a) RETURNING * INTO task;result:=to_jsonb(task);
 ELSIF p_action IN('complete','cancel','escalate','reassign') THEN
  SELECT * INTO task FROM rs_nursing_tasks WHERE id=task.id AND tenant_id=t FOR UPDATE;before_value:=to_jsonb(task);IF task.version IS DISTINCT FROM (p_data->>'version')::integer OR task.state<>'open' THEN RAISE EXCEPTION 'Task version/state berubah';END IF;
  IF p_action='reassign' THEN
   r:=rs_nursing_signed_source((p_data->>'clinical_record_id')::bigint,'nursing_task_reassignment',task.admission_id);recipient:=(r.form_values->>'assignee_id')::uuid;
   IF (r.form_values->>'task_id')::bigint IS DISTINCT FROM task.id OR r.created_at<task.created_at OR length(trim(coalesce(r.form_values->>'evidence','')))<3 THEN RAISE EXCEPTION 'Source penugasan tidak sesuai tugas';END IF;
   PERFORM 1 FROM user_profiles WHERE id=recipient AND tenant_id=t AND ops_professional_role(role)='nurse' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Penerima tugas tenant tidak valid';END IF;PERFORM rs_nursing_assert_recipient(recipient,'clinical.nursing.complete');
   UPDATE rs_nursing_tasks SET assignee_id=recipient,assignment_record_id=r.id,version=version+1 WHERE id=task.id RETURNING * INTO task;result:=to_jsonb(task);
  ELSIF p_action='escalate' THEN
   level_value:=(p_data->>'level')::integer;IF level_value IS NULL OR level_value NOT BETWEEN 0 AND 2 THEN RAISE EXCEPTION 'Level eskalasi wajib';END IF;
   due:=task.due_at+make_interval(secs=>CASE level_value WHEN 0 THEN 0 WHEN 1 THEN (task.policy_snapshot->'payload'->'task_escalation'->>'head_after_minutes')::double precision*60 ELSE (task.policy_snapshot->'payload'->'task_escalation'->>'supervisor_after_minutes')::double precision*60 END);
   IF clock_timestamp()<due OR (level_value>0 AND NOT EXISTS(SELECT 1 FROM rs_nursing_notifications WHERE task_id=task.id AND task_version=task.version AND level=level_value-1)) THEN RAISE EXCEPTION 'Tenggat/level eskalasi sebelumnya belum terpenuhi';END IF;
   recipient:=CASE level_value WHEN 0 THEN task.assignee_id WHEN 1 THEN (task.policy_snapshot->'payload'->'task_escalation'->>'head_user_id')::uuid ELSE (task.policy_snapshot->'payload'->'task_escalation'->>'supervisor_user_id')::uuid END;
   PERFORM 1 FROM user_profiles WHERE id=recipient AND tenant_id=t AND CASE WHEN level_value<2 THEN ops_professional_role(role)='nurse' ELSE lower(role) IN('head_operation','direktur') END FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Penerima eskalasi sumber sudah berubah';END IF;
   INSERT INTO rs_nursing_notifications(tenant_id,task_id,task_version,level,recipient_id,created_by) VALUES(t,task.id,task.version,level_value,recipient,a) ON CONFLICT(task_id,task_version,level) DO NOTHING;
   SELECT * INTO notification FROM rs_nursing_notifications WHERE task_id=task.id AND task_version=task.version AND level=level_value;result:=to_jsonb(notification);
  ELSE
   IF task.assignee_id<>a THEN RAISE EXCEPTION 'Hanya perawat penanggung jawab task';END IF;
   r:=rs_nursing_signed_source((p_data->>'clinical_record_id')::bigint,'nursing_task_outcome',task.admission_id);
   IF p_action='complete' THEN PERFORM rs_nursing_assert_task_heads(task.admission_id,task.id,r.signed_at);END IF;
   IF (r.form_values->>'task_id')::bigint IS DISTINCT FROM task.id OR r.created_at<task.created_at OR r.form_values->>'outcome' IS DISTINCT FROM (CASE p_action WHEN 'complete' THEN 'completed' ELSE 'cancelled' END) OR length(trim(coalesce(r.form_values->>'evidence','')))<3 THEN RAISE EXCEPTION 'Outcome sumber tidak sesuai tugas';END IF;
   UPDATE rs_nursing_tasks SET state=CASE p_action WHEN 'complete' THEN 'completed' ELSE 'cancelled' END,version=version+1,finished_by=a,finished_at=clock_timestamp(),outcome_record_id=r.id WHERE id=task.id RETURNING * INTO task;result:=to_jsonb(task);
  END IF;
 ELSIF p_action='handover' THEN
  r:=rs_nursing_signed_source((p_data->>'clinical_record_id')::bigint,'nursing_shift',ep.admission_id);recipient:=(p_data->>'recipient_id')::uuid;
  PERFORM 1 FROM user_profiles WHERE id=recipient AND tenant_id=t AND ops_professional_role(role)='nurse' FOR SHARE;IF NOT FOUND OR recipient=a THEN RAISE EXCEPTION 'Perawat penerima berbeda dan milik tenant wajib';END IF;PERFORM rs_nursing_assert_recipient(recipient,'clinical.nursing.accept');IF r.created_at<ep.started_at THEN RAISE EXCEPTION 'Source shift dibuat sebelum episode';END IF;
  IF r.form_values->>'shift_start' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' OR r.form_values->>'shift_end' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Waktu shift ISO offset eksplisit wajib';END IF;
  start_value:=(r.form_values->>'shift_start')::timestamptz;end_value:=(r.form_values->>'shift_end')::timestamptz;
  IF start_value<ep.started_at OR end_value<=start_value OR start_value>clock_timestamp() OR end_value>clock_timestamp() OR length(trim(coalesce(r.form_values->>'shift_code','')))<1 THEN RAISE EXCEPTION 'Shift telah berlangsung dalam episode wajib';END IF;
  PERFORM 1 FROM rs_nursing_tasks WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open' ORDER BY id FOR UPDATE;
  PERFORM rs_nursing_assert_task_heads(ep.admission_id);
  IF EXISTS(SELECT 1 FROM rs_nursing_tasks WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open' AND assignee_id<>a) THEN RAISE EXCEPTION 'Semua tugas terbuka episode harus milik pengirim handover';END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') INTO tasks FROM rs_nursing_tasks x WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open';
  INSERT INTO rs_nursing_handovers(tenant_id,episode_id,admission_id,clinical_record_id,shift_code,shift_start,shift_end,recipient_id,sender_id,task_snapshot) VALUES(t,ep.id,ep.admission_id,r.id,r.form_values->>'shift_code',start_value,end_value,recipient,a,tasks) RETURNING * INTO h;result:=to_jsonb(h);
 ELSE
  SELECT * INTO h FROM rs_nursing_handovers WHERE id=h.id AND tenant_id=t FOR UPDATE;before_value:=to_jsonb(h);
  IF h.state<>'pending' OR h.version IS DISTINCT FROM (p_data->>'version')::integer OR (p_action<>'withdraw' AND (h.recipient_id<>a OR h.sender_id=a)) OR length(trim(coalesce(p_data->>'receipt_evidence','')))<3 THEN RAISE EXCEPTION 'Penerima/state/version/bukti handover tidak sesuai';END IF;
  IF p_action='withdraw' THEN r:=rs_nursing_signed_source((p_data->>'clinical_record_id')::bigint,'nursing_shift',h.admission_id);IF NOT EXISTS(WITH RECURSIVE lineage AS(SELECT id,amendment_of,0 depth FROM rs_clinical_records WHERE id=r.id AND tenant_id=t AND admission_id=h.admission_id UNION ALL SELECT c.id,c.amendment_of,l.depth+1 FROM rs_clinical_records c JOIN lineage l ON c.id=l.amendment_of WHERE c.tenant_id=t AND c.admission_id=h.admission_id AND l.depth<100) SELECT 1 FROM lineage WHERE id=h.clinical_record_id AND depth>0) THEN RAISE EXCEPTION 'Penarikan wajib amendment SBAR sumber';END IF;END IF;
  IF p_action='accept' THEN
   PERFORM 1 FROM rs_clinical_records WHERE id=h.clinical_record_id AND tenant_id=t FOR SHARE;IF EXISTS(SELECT 1 FROM rs_clinical_records WHERE amendment_of=h.clinical_record_id AND signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Handover source diamend';END IF;
   PERFORM 1 FROM rs_nursing_tasks WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open' ORDER BY id FOR UPDATE;
   PERFORM rs_nursing_assert_task_heads(ep.admission_id);
   SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') INTO tasks FROM rs_nursing_tasks x WHERE admission_id=ep.admission_id AND tenant_id=t AND state='open';IF tasks IS DISTINCT FROM h.task_snapshot THEN RAISE EXCEPTION 'Tugas sumber berubah; tolak dan ajukan handover terkini';END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(h.task_snapshot) LOOP UPDATE rs_nursing_tasks SET assignee_id=a,assignment_record_id=NULL,version=version+1 WHERE id=(item->>'id')::bigint AND tenant_id=t;END LOOP;
  END IF;
  UPDATE rs_nursing_handovers SET state=CASE p_action WHEN 'accept' THEN 'accepted' WHEN 'withdraw' THEN 'withdrawn' ELSE 'rejected' END,correction_record_id=CASE WHEN p_action='withdraw' THEN r.id ELSE NULL END,version=version+1,received_at=clock_timestamp(),received_by=a,receipt_evidence=p_data->>'receipt_evidence' WHERE id=h.id RETURNING * INTO h;result:=to_jsonb(h);
 END IF;
 INSERT INTO rs_nursing_requests VALUES(t,p_key,a,p_action,p_data,result);INSERT INTO rs_nursing_events(tenant_id,actor,action,task_id,handover_id,input,before_row,after_row) VALUES(t,a,p_action,task.id,h.id,p_data,before_value,result);RETURN result;
END $$;
CREATE FUNCTION rs_nursing_board(p_admission bigint,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();tasks jsonb;handovers jsonb;records jsonb;episodes jsonb;encounter_value jsonb;BEGIN
 PERFORM ops_actor(ARRAY['nurse','perawat']);PERFORM ops_assert_permission('rs-nurse-station','clinical.nursing.read');
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR NOT EXISTS(SELECT 1 FROM admissions WHERE id=p_admission AND tenant_id=t) THEN RAISE EXCEPTION 'Encounter tenant/offset tidak valid';END IF;
 SELECT jsonb_build_object('id',id,'patient_name',patient_name,'mr_number',mr_number,'visit_number',visit_number,'patient_dob',patient_dob) INTO encounter_value FROM admissions WHERE id=p_admission AND tenant_id=t;
 SELECT coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('overdue',x.state='open' AND x.due_at<clock_timestamp())),'[]') INTO tasks FROM(SELECT task.*,EXISTS(SELECT 1 FROM rs_clinical_records child WHERE child.amendment_of=task.clinical_record_id AND child.tenant_id=task.tenant_id AND child.signed_at IS NOT NULL) source_amended,EXISTS(SELECT 1 FROM rs_clinical_records child WHERE child.amendment_of=task.outcome_record_id AND child.tenant_id=task.tenant_id AND child.signed_at IS NOT NULL) outcome_amended,(SELECT full_name FROM user_profiles u WHERE u.id=task.assignee_id AND u.tenant_id=task.tenant_id) assignee_name FROM rs_nursing_tasks task WHERE task.tenant_id=t AND task.admission_id=p_admission ORDER BY task.id DESC LIMIT 51 OFFSET p_offset)x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO handovers FROM(SELECT h.*,EXISTS(SELECT 1 FROM rs_clinical_records child WHERE child.amendment_of=h.clinical_record_id AND child.tenant_id=h.tenant_id AND child.signed_at IS NOT NULL) source_amended FROM rs_nursing_handovers h WHERE h.tenant_id=t AND h.admission_id=p_admission ORDER BY h.id DESC LIMIT 51 OFFSET p_offset)x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO episodes FROM(SELECT id,unit_code,state FROM rs_care_episodes WHERE tenant_id=t AND admission_id=p_admission ORDER BY id DESC LIMIT 51 OFFSET p_offset)x;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO records FROM(SELECT c.id,c.signed_by,c.amendment_of,p.payload->>'purpose' purpose,p.payload->>'title' title,p.payload->'fields' template_fields,c.policy_id,c.form_values,c.created_at FROM rs_clinical_records c JOIN ops_policy_versions p ON p.id=c.policy_id AND p.tenant_id=c.tenant_id WHERE c.tenant_id=t AND c.admission_id=p_admission AND c.signed_at IS NOT NULL AND p.scope='rs-nurse-station' AND rs_clinical_can_read(p.id) AND NOT EXISTS(SELECT 1 FROM rs_clinical_records newer WHERE newer.amendment_of=c.id AND newer.signed_at IS NOT NULL) ORDER BY c.id DESC LIMIT 51 OFFSET p_offset)x;
 RETURN jsonb_build_object('encounter',encounter_value,'tasks',tasks,'handovers',handovers,'episodes',episodes,'observations',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('is_head',NOT EXISTS(SELECT 1 FROM rs_nursing_observations newer WHERE newer.amendment_of=o.id) AND NOT EXISTS(SELECT 1 FROM rs_clinical_records c WHERE c.amendment_of=o.clinical_record_id AND c.signed_at IS NOT NULL))) FROM(SELECT * FROM rs_nursing_observations WHERE tenant_id=t AND admission_id=p_admission ORDER BY observed_at DESC,id DESC LIMIT 51 OFFSET p_offset)o),'[]'),'records',records,'staff',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name)) FROM user_profiles u WHERE u.tenant_id=t AND ops_professional_role(u.role)='nurse'),'[]'),'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM(SELECT id,task_id,task_version,level,recipient_id,created_at FROM rs_nursing_notifications WHERE tenant_id=t AND task_id IN(SELECT id FROM rs_nursing_tasks WHERE tenant_id=t AND admission_id=p_admission) ORDER BY id DESC LIMIT 51 OFFSET p_offset)n),'[]'));
END $$;
CREATE FUNCTION rs_nursing_inbox(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN
 PERFORM ops_actor(ARRAY['nurse','perawat','head_operation','direktur']);IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Offset invalid';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM(SELECT id,task_id,task_version,level,created_at FROM rs_nursing_notifications WHERE tenant_id=current_tenant_id() AND recipient_id=auth.uid() ORDER BY id DESC LIMIT 51 OFFSET p_offset)n),'[]');END $$;
CREATE FUNCTION rs_nursing_escalate_due(p_admission bigint,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid:=current_tenant_id();a uuid;task rs_nursing_tasks;level_value integer;stamp timestamptz;result jsonb:='[]';errors jsonb:='[]';BEGIN
 a:=ops_actor(ARRAY['nurse','perawat']);PERFORM ops_assert_permission('rs-nurse-station','clinical.nursing.escalate');
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR NOT EXISTS(SELECT 1 FROM admissions WHERE id=p_admission AND tenant_id=t) THEN RAISE EXCEPTION 'Encounter tenant/offset tidak valid';END IF;
 FOR task IN SELECT * FROM(SELECT * FROM rs_nursing_tasks WHERE tenant_id=t AND admission_id=p_admission ORDER BY id DESC LIMIT 50 OFFSET p_offset) visible WHERE state='open' AND due_at<=clock_timestamp() LOOP
  FOR level_value IN 0..2 LOOP
   stamp:=task.due_at+make_interval(secs=>CASE level_value WHEN 0 THEN 0 WHEN 1 THEN (task.policy_snapshot->'payload'->'task_escalation'->>'head_after_minutes')::double precision*60 ELSE (task.policy_snapshot->'payload'->'task_escalation'->>'supervisor_after_minutes')::double precision*60 END);IF stamp>clock_timestamp() THEN EXIT;END IF;
   BEGIN result:=result||jsonb_build_array(rs_nursing_command('escalate',jsonb_build_object('id',task.id,'version',task.version,'level',level_value,'reason','Automatic in-app due escalation'),'ns-auto:'||a::text||':'||task.id::text||':'||task.version::text||':'||level_value::text));
   EXCEPTION WHEN OTHERS THEN errors:=errors||jsonb_build_array(jsonb_build_object('task_id',task.id,'level',level_value,'message',SQLERRM));EXIT;END;
  END LOOP;
 END LOOP;RETURN jsonb_build_object('notifications',result,'errors',errors);
END $$;
-- Share admission lock order with pharmacy, discharge and episode sources.
CREATE FUNCTION rs_nursing_exit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN
 IF (TG_TABLE_NAME='inpatient_stays' AND to_jsonb(OLD)->>'discharged_at' IS NULL AND to_jsonb(NEW)->>'discharged_at' IS NOT NULL) OR (TG_TABLE_NAME='rs_encounter_lifecycle' AND to_jsonb(OLD)->>'state'='open' AND to_jsonb(NEW)->>'state'='closed') THEN
  PERFORM 1 FROM admissions WHERE id=NEW.admission_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM rs_nursing_tasks WHERE tenant_id=NEW.tenant_id AND admission_id=NEW.admission_id AND state='open') OR EXISTS(SELECT 1 FROM rs_nursing_handovers WHERE tenant_id=NEW.tenant_id AND admission_id=NEW.admission_id AND state='pending') THEN RAISE EXCEPTION 'Tugas/serah terima keperawatan belum selesai';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER nursing_inpatient_exit BEFORE UPDATE OF discharged_at ON inpatient_stays FOR EACH ROW EXECUTE FUNCTION rs_nursing_exit_guard();
CREATE TRIGGER nursing_encounter_exit BEFORE UPDATE OF state ON rs_encounter_lifecycle FOR EACH ROW EXECUTE FUNCTION rs_nursing_exit_guard();
CREATE FUNCTION rs_nursing_transfer_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN
 IF OLD.state='active' AND NEW.state='transferred' AND EXISTS(SELECT 1 FROM rs_nursing_handovers WHERE tenant_id=OLD.tenant_id AND admission_id=OLD.admission_id AND state='pending') THEN RAISE EXCEPTION 'Penerimaan/penolakan handover pending wajib sebelum transfer unit';END IF;RETURN NEW;
END $$;
CREATE TRIGGER nursing_transfer_source BEFORE UPDATE OF state ON rs_care_episodes FOR EACH ROW EXECUTE FUNCTION rs_nursing_transfer_guard();
REVOKE ALL ON FUNCTION rs_nursing_transfer_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_nursing_exit_guard() FROM PUBLIC,anon,authenticated;
DO $$DECLARE name text;BEGIN FOREACH name IN ARRAY ARRAY['rs_nursing_tasks','rs_nursing_handovers','rs_nursing_notifications','rs_nursing_requests','rs_nursing_events','rs_nursing_observations'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',name);END LOOP;END $$;
REVOKE ALL ON FUNCTION ops_validate_policy_before_nursing_sources(text,jsonb),ops_validate_policy(text,jsonb),rs_nursing_immutable(),rs_nursing_source_guard(),rs_nursing_signed_source(bigint,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_nursing_assert_recipient(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_nursing_assert_task_heads(bigint,bigint,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rs_nursing_command(text,jsonb,text),rs_nursing_board(bigint,integer),rs_nursing_inbox(integer),rs_nursing_observation_command(bigint,bigint,bigint,text,text),rs_nursing_escalate_due(bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rs_nursing_command(text,jsonb,text),rs_nursing_board(bigint,integer),rs_nursing_inbox(integer),rs_nursing_observation_command(bigint,bigint,bigint,text,text),rs_nursing_escalate_due(bigint,integer) TO authenticated;
COMMIT;
